import postgres from 'npm:postgres';
import { upsertWorkflowStep } from '../_shared/order-monitoring.ts';

type ActionPayload = {
  action?: string;
  orderId?: string;
  cancelledReason?: string;
  trackingNumber?: string;
};

type OrderEmailType = 'order_confirmed' | 'order_shipped' | 'order_cancelled';

type OrderStatusRow = {
  id: string;
  status: string;
  basecom_status: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

function getFunctionBaseUrl(fallbackRequestUrl?: string) {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  if (supabaseUrl) return supabaseUrl;

  if (fallbackRequestUrl) {
    try {
      return new URL(fallbackRequestUrl).origin;
    } catch {
      return '';
    }
  }

  return '';
}

function getSendOrderEmailUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/send-order-email` : '';
}

function getProcessExportQueueUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/process-export-queue` : '';
}

function getFunctionAuthHeaders() {
  const functionKey = (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || Deno.env.get('PROJECT_PUBLIC_ANON_KEY')
    || Deno.env.get('PUBLIC_ANON_KEY')
    || Deno.env.get('SUPABASE_ANON_KEY')
    || ''
  ).trim();
  return functionKey
    ? {
        Authorization: `Bearer ${functionKey}`,
        apikey: functionKey,
      }
    : {};
}

async function invokeOrderEmail(orderId: string, emailType: OrderEmailType, fallbackRequestUrl?: string) {
  const url = getSendOrderEmailUrl(fallbackRequestUrl);
  if (!url) {
    throw new Error('Missing base URL for send-order-email invocation.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getFunctionAuthHeaders(),
    },
    body: JSON.stringify({ orderId, emailType }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `send-order-email HTTP ${response.status}`);
  }
}

async function invokeProcessExportQueue(fallbackRequestUrl?: string) {
  const url = getProcessExportQueueUrl(fallbackRequestUrl);
  if (!url) {
    throw new Error('Missing base URL for process-export-queue invocation.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getFunctionAuthHeaders(),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `process-export-queue HTTP ${response.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  let payload: ActionPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const { action, orderId, cancelledReason, trackingNumber } = payload;
  if (!action || !orderId) {
    return jsonResponse({ error: 'Missing action or orderId.' }, 400);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const orderRows = await sql<OrderStatusRow[]>`
      select id, status, basecom_status
      from public.orders
      where id = ${orderId}::uuid
      limit 1
    `;

    const order = orderRows[0];
    if (!order) {
      return jsonResponse({ error: 'Order not found.' }, 404);
    }

    if (action === 'retry_export') {
      if (order.basecom_status !== 'failed') {
        return jsonResponse({ error: 'Retry export is only available for failed Base.com exports.' }, 400);
      }

      await sql.begin(async (tx) => {
        await tx`
          update public.export_queue
          set
            status = 'pending',
            retry_count = 0,
            next_retry_at = now(),
            last_error = null,
            completed_at = null
          where order_id = ${orderId}::uuid
            and service = 'basecom'
            and status = 'failed'
        `;

        await tx`
          update public.orders
          set
            basecom_status = 'pending',
            status = 'processing',
            retry_count = 0
          where id = ${orderId}::uuid
        `;

        await tx`
          insert into public.order_events (
            order_id,
            event_type,
            from_status,
            to_status,
            details,
            actor
          ) values (
            ${orderId}::uuid,
            'admin_action',
            ${order.status},
            'processing',
            ${JSON.stringify({ action: 'retry_export' })}::jsonb,
            'admin'
          )
        `;

        await upsertWorkflowStep(tx, {
          orderId,
          stepKey: 'basecom_exported',
          status: 'pending',
          attemptCount: 0,
          lastError: null,
          metadata: {
            source: 'admin',
            action: 'retry_export',
          },
        });
      });

      try {
        await invokeProcessExportQueue(req.url);
      } catch (queueError) {
        const message = queueError instanceof Error ? queueError.message : 'Unknown process-export-queue invocation error.';
        console.error('[admin-order-action] process-export-queue invocation failed:', message);
      }

      return jsonResponse({ success: true });
    }

    if (action === 'cancel_order') {
      if (!['paid', 'processing', 'exported'].includes(order.status)) {
        return jsonResponse({ error: 'Cancellation is not allowed for this order status.' }, 400);
      }

      await sql.begin(async (tx) => {
        await tx`
          update public.orders
          set
            status = 'cancelled',
            cancelled_at = now(),
            cancelled_reason = ${cancelledReason?.trim() || null}
          where id = ${orderId}::uuid
        `;

        await tx`
          insert into public.order_events (
            order_id,
            event_type,
            from_status,
            to_status,
            details,
            actor
          ) values (
            ${orderId}::uuid,
            'admin_action',
            ${order.status},
            'cancelled',
            ${JSON.stringify({
              action: 'cancel_order',
              cancelledReason: cancelledReason?.trim() || null,
            })}::jsonb,
            'admin'
          )
        `;

        await upsertWorkflowStep(tx, {
          orderId,
          stepKey: 'shipment_created',
          status: 'skipped',
          lastError: cancelledReason?.trim() || 'Order was cancelled.',
          metadata: {
            source: 'admin',
            action: 'cancel_order',
          },
        });

      });

      try {
        await invokeOrderEmail(orderId, 'order_cancelled', req.url);
      } catch (emailError) {
        const message = emailError instanceof Error ? emailError.message : 'Unknown send-order-email invocation error.';
        console.error('[admin-order-action] order_cancelled email failed:', message);
      }

      return jsonResponse({ success: true });
    }

    if (action === 'mark_shipped') {
      if (order.status !== 'exported') {
        return jsonResponse({ error: 'Only exported orders can be marked as shipped.' }, 400);
      }

      if (!trackingNumber?.trim()) {
        return jsonResponse({ error: 'Tracking number is required.' }, 400);
      }

      await sql.begin(async (tx) => {
        await tx`
          update public.orders
          set
            status = 'shipped',
            shipped_at = now(),
            tracking_number = ${trackingNumber.trim()}
          where id = ${orderId}::uuid
        `;

        await tx`
          insert into public.order_events (
            order_id,
            event_type,
            from_status,
            to_status,
            details,
            actor
          ) values (
            ${orderId}::uuid,
            'admin_action',
            ${order.status},
            'shipped',
            ${JSON.stringify({
              action: 'mark_shipped',
              trackingNumber: trackingNumber.trim(),
            })}::jsonb,
            'admin'
          )
        `;

        await upsertWorkflowStep(tx, {
          orderId,
          stepKey: 'shipment_created',
          status: 'done',
          lastError: null,
          metadata: {
            source: 'admin',
            action: 'mark_shipped',
            trackingNumber: trackingNumber.trim(),
          },
        });

      });

      try {
        await invokeOrderEmail(orderId, 'order_shipped', req.url);
      } catch (emailError) {
        const message = emailError instanceof Error ? emailError.message : 'Unknown send-order-email invocation error.';
        console.error('[admin-order-action] order_shipped email failed:', message);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order action failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
