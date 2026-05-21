import { resolveAllowedOrigin } from '../_shared/cors.ts';
/**
 * Denní job: pending_payment starší 21 dní → zrušit, případně Base.com storno, e-mail zákazníkovi.
 */
import postgres from 'npm:postgres';
import { callBasecomSetOrderStatus } from '../_shared/basecom-set-order-status.ts';
import { sendOrderEmail } from '../_shared/order-email.ts';

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const CANCEL_REASON = 'Automatické storno — nezaplaceno po 3 týdnech';

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
  });
}

function verifyServiceAuth(req: Request): boolean {
  const expected = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!expected) return false;
  const auth = req.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';
  return token === expected;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }
  if (!verifyServiceAuth(req)) {
    return jsonResponse(req, { error: 'Unauthorized.' }, 401);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse(req, { error: 'Missing DATABASE_URL.' }, 500);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  const basecomToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();
  const basecomCancelledStatus = Number.parseInt(
    Deno.env.get('BASECOM_CANCELLED_ORDER_STATUS_ID') || '438574',
    10,
  );

  let cancelled = 0;
  let errors = 0;

  try {
    const stale = await sql<{ id: string; order_number: string; basecom_order_id: string | null; customer_email: string; status: string }[]>`
      select id, order_number, basecom_order_id, customer_email, status
      from public.orders
      where status in ('incomplete', 'pending_payment')
        and created_at < now() - interval '21 days'
      order by created_at asc
      limit 200
    `;

    for (const row of stale) {
      try {
        if (row.basecom_order_id && basecomToken && Number.isInteger(basecomCancelledStatus)) {
          const oid = Number.parseInt(String(row.basecom_order_id), 10);
          if (Number.isInteger(oid)) {
            try {
              await callBasecomSetOrderStatus(basecomToken, oid, basecomCancelledStatus);
            } catch (be) {
              console.error(`[cancel-stale-orders] Base.com ${row.order_number}:`, be);
            }
          }
        }

        const previousStatus = row.status;
        await sql.begin(async (tx) => {
          await tx`
            update public.orders
            set
              status = 'cancelled',
              cancelled_at = now(),
              cancelled_reason = ${CANCEL_REASON},
              updated_at = now()
            where id = ${row.id}::uuid
              and status in ('incomplete', 'pending_payment')
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
              ${row.id}::uuid,
              'auto_cancel',
              ${previousStatus},
              'cancelled',
              ${JSON.stringify({ reason: CANCEL_REASON, previousStatus })}::jsonb,
              'system'
            )
          `;
        });

        /** E-mail „auto-cancelled unpaid" má smysl jen pro objednávky, které zákazník opravdu odeslal
         *  (= dorazil aspoň do `pending_payment`). U `incomplete` nikdy nepotvrdil objednávku, takže
         *  by ho e-mail mátl („zrušili jsme vaši objednávku" — žádnou neudělal). Mlčky uklidíme. */
        if (previousStatus === 'pending_payment') {
          try {
            await sendOrderEmail(sql, { orderId: row.id, emailType: 'order_auto_cancelled_unpaid' });
          } catch (mailErr) {
            console.error(`[cancel-stale-orders] Email ${row.order_number}:`, mailErr);
          }
        }

        cancelled += 1;
      } catch (e) {
        errors += 1;
        console.error(`[cancel-stale-orders] ${row.order_number}:`, e);
      }
    }

    return jsonResponse(req, { processed: stale.length, cancelled, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cancel-stale-orders failed';
    return jsonResponse(req, { error: msg }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
