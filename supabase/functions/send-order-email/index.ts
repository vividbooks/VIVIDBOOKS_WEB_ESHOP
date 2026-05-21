import { resolveAllowedOrigin } from '../_shared/cors.ts';
import postgres from 'npm:postgres';
import { sendOrderEmail, type OrderEmailType } from '../_shared/order-email.ts';
import { upsertWorkflowStep } from '../_shared/order-monitoring.ts';

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
    },
  });
}

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

function isCustomerConfirmationEmailType(emailType: OrderEmailType) {
  return emailType === 'order_confirmed' || emailType === 'order_transfer_received';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse(req, { error: 'Missing DATABASE_URL.' }, 500);
  }

  let payload: { orderId?: string; emailType?: OrderEmailType };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body.' }, 400);
  }

  if (!payload.orderId || !payload.emailType) {
    return jsonResponse(req, { error: 'Missing orderId or emailType.' }, 400);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const result = await sendOrderEmail(sql, {
      orderId: payload.orderId,
      emailType: payload.emailType,
    });

    await sql`
      insert into public.order_events (
        order_id,
        event_type,
        from_status,
        to_status,
        details,
        actor
      ) values (
        ${payload.orderId}::uuid,
        'email',
        null,
        null,
        ${JSON.stringify({
          emailType: payload.emailType,
          subject: result.subject,
        })}::jsonb,
        'system'
      )
    `;

    if (isCustomerConfirmationEmailType(payload.emailType)) {
      await upsertWorkflowStep(sql, {
        orderId: payload.orderId,
        stepKey: 'customer_email_sent',
        status: 'done',
        lastError: null,
        metadata: {
          emailType: payload.emailType,
          subject: result.subject,
        },
      });
    }

    return jsonResponse(req, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send order email.';

    try {
      await sql`
        insert into public.order_events (
          order_id,
          event_type,
          from_status,
          to_status,
          details,
          actor
        ) values (
          ${payload.orderId}::uuid,
          'email',
          null,
          null,
          ${JSON.stringify({
            emailType: payload.emailType,
            error: message,
          })}::jsonb,
          'system'
        )
      `;
    } catch {
      // Email logging is best-effort only.
    }

    if (isCustomerConfirmationEmailType(payload.emailType)) {
      try {
        await upsertWorkflowStep(sql, {
          orderId: payload.orderId,
          stepKey: 'customer_email_sent',
          status: 'failed',
          lastError: message,
          metadata: {
            emailType: payload.emailType,
          },
        });
      } catch {
        // Workflow tracking is best-effort only here.
      }
    }

    return jsonResponse(req, { error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
