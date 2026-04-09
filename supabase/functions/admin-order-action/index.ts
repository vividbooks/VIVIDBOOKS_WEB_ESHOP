import postgres from 'npm:postgres';
import { upsertWorkflowStep } from '../_shared/order-monitoring.ts';

type ActionPayload = {
  action?: string;
  orderId?: string;
  cancelledReason?: string;
  trackingNumber?: string;
  /** true = jen PUT štítků/PRINT u existujícího dealu */
  refreshPipedrive?: boolean;
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

function getEshopPipedriveSyncUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/make-server-93a20b6f/eshop/pipedrive-sync` : '';
}

function inferPipedriveEshopMode(row: { ico: string | null; payment_method: string }):
  'b2c_card_won' | 'b2b_card_won' | 'b2b_transfer_open' {
  const ico = String(row.ico || '').trim().replace(/\s/g, '');
  if (row.payment_method === 'transfer') {
    return ico ? 'b2b_transfer_open' : 'b2c_card_won';
  }
  return ico ? 'b2b_card_won' : 'b2c_card_won';
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

  const { action, orderId, cancelledReason, trackingNumber, refreshPipedrive } = payload;
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

    if (action === 'retry_idoklad_export') {
      /** Mezi pokusy může být řádek pending + last_error, nebo processing (zaseknuto); jen čisté pending bez chyby neobnovujeme. */
      const idokladRetryable = await sql<{ id: string }[]>`
        select id from public.export_queue
        where order_id = ${orderId}::uuid
          and service = 'idoklad'
          and (
            status = 'failed'
            or status = 'processing'
            or (status = 'pending' and coalesce(trim(last_error), '') <> '')
          )
        limit 1
      `;
      if (idokladRetryable.length === 0) {
        return jsonResponse(
          {
            error:
              'Žádný export do iDokladu k opakování (očekává se failed, processing, nebo pending s chybou ve frontě).',
          },
          400,
        );
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
            and service = 'idoklad'
            and (
              status = 'failed'
              or status = 'processing'
              or (status = 'pending' and coalesce(trim(last_error), '') <> '')
            )
        `;

        await tx`
          update public.orders
          set invoice_status = 'pending'
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
            ${order.status},
            ${JSON.stringify({ action: 'retry_idoklad_export' })}::jsonb,
            'admin'
          )
        `;

        await upsertWorkflowStep(tx, {
          orderId,
          stepKey: 'idoklad_exported',
          status: 'pending',
          attemptCount: 0,
          lastError: null,
          metadata: {
            source: 'admin',
            action: 'retry_idoklad_export',
          },
        });
      });

      try {
        await invokeProcessExportQueue(req.url);
      } catch (queueError) {
        const message = queueError instanceof Error ? queueError.message : 'Unknown process-export-queue invocation error.';
        console.error('[admin-order-action] process-export-queue (idoklad retry) failed:', message);
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

    if (action === 'sync_pipedrive') {
      const pdRows = await sql<
        { pipedrive_deal_id: string | null; ico: string | null; payment_method: string; status: string }[]
      >`
        select pipedrive_deal_id, ico, payment_method, status
        from public.orders
        where id = ${orderId}::uuid
        limit 1
      `;
      const pd = pdRows[0];
      if (!pd) {
        return jsonResponse({ error: 'Order not found.' }, 404);
      }
      const existing = String(pd.pipedrive_deal_id || '').trim();
      const refresh = refreshPipedrive === true;
      if (existing && !refresh) {
        return jsonResponse({ error: 'Tato objednávka už má propojený Pipedrive deal.' }, 400);
      }
      if (!existing && refresh) {
        return jsonResponse({ error: 'Deal v Pipedrive ještě neexistuje — použijte Vytvořit deal.' }, 400);
      }
      if (!refresh && ['cancelled', 'refunded', 'failed', 'draft'].includes(pd.status)) {
        return jsonResponse({ error: 'Pro tento stav objednávky nelze vytvořit deal.' }, 400);
      }

      const mode = inferPipedriveEshopMode(pd);
      const syncUrl = getEshopPipedriveSyncUrl(req.url);
      if (!syncUrl) {
        return jsonResponse({ error: 'Missing SUPABASE_URL for Pipedrive sync.' }, 500);
      }
      const headers = getFunctionAuthHeaders();
      if (!headers.Authorization) {
        return jsonResponse({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY for internal call.' }, 500);
      }

      const syncRes = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ orderId, mode, refreshOnly: refresh }),
      });
      const syncText = await syncRes.text();
      let syncJson: Record<string, unknown> = {};
      try {
        syncJson = JSON.parse(syncText) as Record<string, unknown>;
      } catch {
        /* ignore */
      }

      if (!syncRes.ok) {
        return jsonResponse(
          {
            error: typeof syncJson.error === 'string' ? syncJson.error : `Pipedrive sync HTTP ${syncRes.status}`,
            detail: syncText.slice(0, 800),
          },
          502,
        );
      }

      if (syncJson.skipped === true) {
        const reason = typeof syncJson.reason === 'string' ? syncJson.reason : 'unknown';
        return jsonResponse(
          {
            success: false,
            skipped: true,
            reason,
            detail: syncJson,
          },
          200,
        );
      }

      await sql`
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
          ${order.status},
          ${JSON.stringify({ action: refresh ? 'refresh_pipedrive' : 'sync_pipedrive', mode, result: syncJson })}::jsonb,
          'admin'
        )
      `;

      return jsonResponse({ success: true, result: syncJson });
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order action failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
