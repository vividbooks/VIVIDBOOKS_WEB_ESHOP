import postgres from 'npm:postgres';
import {
  openOrUpdateOrderAlert,
  resolveOrderAlerts,
  upsertWorkflowStep,
} from '../_shared/order-monitoring.ts';

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  payment_status: string | null;
  payment_method: string;
  basecom_status: string | null;
  /** Objednávky jen z plakátů — bez exportu do Base.com. */
  poster_fulfillment_status: string | null;
  invoice_status: string | null;
  tracking_number: string | null;
  stripe_payment_intent_id: string | null;
  stripe_receipt_url: string | null;
  pipedrive_deal_id: string | null;
};

type QueueRow = {
  id: string;
  order_id: string;
  service: string;
  status: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  completed_at: string | null;
};

type EmailEventRow = {
  order_id: string;
  details_json: string | null;
  created_at: string;
};

type ExistingAlertRow = {
  dedupe_key: string;
  state: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const cronSecret = Deno.env.get('MONITOR_ORDER_WORKFLOWS_CRON_SECRET')?.trim();

function isAuthorizedCronRequest(req: Request) {
  if (!cronSecret) return true;
  const secretHeader = req.headers.get('x-cron-secret')?.trim();
  const secretQuery = new URL(req.url).searchParams.get('cronSecret')?.trim();
  return secretHeader === cronSecret || secretQuery === cronSecret;
}

const MONITORED_ALERT_TYPES = [
  'customer_email_missing',
  'basecom_stuck',
  'basecom_failed',
  'idoklad_stuck',
  'idoklad_failed',
  'export_queue_processing_too_long',
  'stripe_receipt_missing',
  'transfer_payment_stale',
] as const;

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

function minutesSince(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  return diffMs / 60000;
}

function parseJsonRecord(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function emailStatusInfo(events: EmailEventRow[]) {
  const latest = events[0];
  if (!latest) return { status: 'missing' as const, error: null as string | null };
  const details = parseJsonRecord(latest.details_json);
  const error = typeof details.error === 'string' ? details.error : null;
  return error
    ? { status: 'failed' as const, error }
    : { status: 'done' as const, error: null as string | null };
}

function severityByMinutes(minutes: number, warningAfter: number, criticalAfter: number) {
  return minutes >= criticalAfter ? 'critical' : minutes >= warningAfter ? 'warning' : null;
}

/** Převod čekající na platbu — bez Base/iDoklad fronty. */
function isTransferPendingOrder(order: OrderRow) {
  return order.status === 'pending_payment' && order.payment_method === 'transfer';
}

function severityByTransferAgeDays(days: number) {
  if (days >= 15) return 'critical' as const;
  if (days >= 10) return 'warning' as const;
  if (days >= 7) return 'info' as const;
  return null;
}

function dedupeKey(alertType: string, orderId: string, suffix?: string) {
  return suffix
    ? `${alertType}:order:${orderId}:${suffix}`
    : `${alertType}:order:${orderId}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!isAuthorizedCronRequest(req)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const orders = await sql<OrderRow[]>`
      select
        id,
        order_number,
        created_at,
        status,
        payment_status,
        payment_method,
        basecom_status,
        poster_fulfillment_status,
        invoice_status,
        tracking_number,
        stripe_payment_intent_id,
        stripe_receipt_url,
        pipedrive_deal_id
      from public.orders
      where created_at >= now() - interval '30 days'
        and status not in ('delivered', 'refunded')
      order by created_at desc
      limit 500
    `;

    if (orders.length === 0) {
      return jsonResponse({
        processedOrders: 0,
        openedOrUpdatedAlerts: 0,
        resolvedAlerts: 0,
      });
    }

    const orderIds = orders.map((order) => order.id);
    const [queueRows, emailEvents, existingAlerts] = await Promise.all([
      sql<QueueRow[]>`
        select
          id,
          order_id,
          service,
          status,
          retry_count,
          max_retries,
          last_error,
          next_retry_at,
          created_at,
          completed_at
        from public.export_queue
        where order_id = any(${orderIds}::uuid[])
          and service in ('basecom', 'idoklad', 'email')
        order by created_at desc
      `,
      sql<EmailEventRow[]>`
        select
          order_id,
          details::text as details_json,
          created_at
        from public.order_events
        where order_id = any(${orderIds}::uuid[])
          and event_type = 'email'
        order by created_at desc
      `,
      sql<ExistingAlertRow[]>`
        select dedupe_key, state
        from public.order_alerts
        where state in ('open', 'acknowledged')
          and (
            order_id = any(${orderIds}::uuid[])
            or alert_type = any(${[...MONITORED_ALERT_TYPES]}::text[])
          )
      `,
    ]);

    const queueByOrder = new Map<string, QueueRow[]>();
    for (const row of queueRows) {
      const current = queueByOrder.get(row.order_id) || [];
      current.push(row);
      queueByOrder.set(row.order_id, current);
    }

    const emailsByOrder = new Map<string, EmailEventRow[]>();
    for (const event of emailEvents) {
      const current = emailsByOrder.get(event.order_id) || [];
      current.push(event);
      emailsByOrder.set(event.order_id, current);
    }

    const seenAlertKeys = new Set<string>();
    let openedOrUpdatedAlerts = 0;

    for (const order of orders) {
      const orderAgeMinutes = minutesSince(order.created_at);
      const orderAgeDays = orderAgeMinutes / 60 / 24;
      const queues = queueByOrder.get(order.id) || [];
      const baseQueue = queues.find((row) => row.service === 'basecom');
      const idokladQueue = queues.find((row) => row.service === 'idoklad');
      const hasBasecomQueue = queues.some((row) => row.service === 'basecom');
      const hasIdokladQueue = queues.some((row) => row.service === 'idoklad');
      const transferPending = isTransferPendingOrder(order);
      const latestEmailStatus = emailStatusInfo(emailsByOrder.get(order.id) || []);

      await upsertWorkflowStep(sql, {
        orderId: order.id,
        stepKey: 'payment_received',
        status: order.payment_status === 'paid' ? 'done' : order.payment_status === 'failed' ? 'failed' : 'pending',
        lastError: order.payment_status === 'failed' ? 'Stripe payment failed.' : null,
      });

      await upsertWorkflowStep(sql, {
        orderId: order.id,
        stepKey: 'order_persisted',
        status: 'done',
        metadata: {
          orderNumber: order.order_number,
        },
      });

      const skipEmailAutomation = Boolean(order.pipedrive_deal_id);
      const emailStepStatus =
        order.status === 'cancelled'
          ? 'skipped'
          : skipEmailAutomation
            ? 'skipped'
            : latestEmailStatus.status === 'done'
              ? 'done'
              : latestEmailStatus.status === 'failed'
                ? 'failed'
                : orderAgeMinutes >= 5
                  ? 'stuck'
                  : 'pending';

      await upsertWorkflowStep(sql, {
        orderId: order.id,
        stepKey: 'customer_email_sent',
        status: emailStepStatus,
        lastError: latestEmailStatus.error,
      });

      let baseStepStatus: 'pending' | 'running' | 'done' | 'failed' | 'stuck' | 'skipped' = 'pending';
      if (order.status === 'cancelled') {
        baseStepStatus = 'skipped';
      } else if (transferPending) {
        baseStepStatus = 'skipped';
      } else if (order.basecom_status === 'skipped' || order.poster_fulfillment_status != null) {
        baseStepStatus = 'skipped';
      } else if (order.basecom_status === 'done' || ['exported', 'shipped', 'delivered'].includes(order.status)) {
        baseStepStatus = 'done';
      } else if (order.basecom_status === 'failed') {
        baseStepStatus = 'failed';
      } else if (baseQueue?.status === 'processing') {
        baseStepStatus = minutesSince(baseQueue.created_at) >= 10 ? 'stuck' : 'running';
      } else if (order.payment_status === 'paid' && !hasBasecomQueue && orderAgeMinutes >= 5) {
        baseStepStatus = 'stuck';
      } else if (order.payment_status === 'paid' && orderAgeMinutes >= 10) {
        baseStepStatus = 'stuck';
      } else if (!hasBasecomQueue && order.payment_status !== 'paid') {
        baseStepStatus = 'pending';
      }

      await upsertWorkflowStep(sql, {
        orderId: order.id,
        stepKey: 'basecom_exported',
        status: baseStepStatus,
        attemptCount: baseQueue?.retry_count ?? 0,
        lastError: baseQueue?.last_error ?? null,
      });

      let idokladStepStatus: 'pending' | 'running' | 'done' | 'failed' | 'stuck' | 'skipped' = 'pending';
      if (order.status === 'cancelled') {
        idokladStepStatus = 'skipped';
      } else if (transferPending) {
        idokladStepStatus = 'skipped';
      } else if (order.invoice_status === 'done') {
        idokladStepStatus = 'done';
      } else if (order.invoice_status === 'failed') {
        idokladStepStatus = 'failed';
      } else if (!hasIdokladQueue) {
        idokladStepStatus = 'skipped';
      } else if (idokladQueue?.status === 'processing') {
        idokladStepStatus = minutesSince(idokladQueue.created_at) >= 15 ? 'stuck' : 'running';
      } else if (orderAgeMinutes >= 20) {
        idokladStepStatus = 'stuck';
      }

      await upsertWorkflowStep(sql, {
        orderId: order.id,
        stepKey: 'idoklad_exported',
        status: idokladStepStatus,
        attemptCount: idokladQueue?.retry_count ?? 0,
        lastError: idokladQueue?.last_error ?? null,
      });

      await upsertWorkflowStep(sql, {
        orderId: order.id,
        stepKey: 'shipment_created',
        status: order.status === 'cancelled' ? 'skipped' : order.tracking_number ? 'done' : 'pending',
        metadata: order.tracking_number ? { trackingNumber: order.tracking_number } : null,
      });

      if (
        order.payment_status === 'paid'
        && latestEmailStatus.status !== 'done'
        && !order.pipedrive_deal_id
      ) {
        const severity = severityByMinutes(orderAgeMinutes, 2, 5);
        if (severity) {
          const key = dedupeKey('customer_email_missing', order.id);
          seenAlertKeys.add(key);
          await openOrUpdateOrderAlert(sql, {
            orderId: order.id,
            alertType: 'customer_email_missing',
            severity,
            dedupeKey: key,
            title: `Chybí potvrzovací email u ${order.order_number}`,
            message: latestEmailStatus.error
              ? `Potvrzovací email selhal: ${latestEmailStatus.error}`
              : `Objednávka je zaplacená ${Math.floor(orderAgeMinutes)} min, ale potvrzovací email stále nemá úspěšný záznam.`,
            payload: {
              orderNumber: order.order_number,
              paymentStatus: order.payment_status,
            },
          });
          openedOrUpdatedAlerts += 1;
        }
      }

      if (
        order.payment_status === 'paid'
        && order.stripe_payment_intent_id
        && !order.stripe_receipt_url
      ) {
        const severity = severityByMinutes(orderAgeMinutes, 10, 30);
        if (severity) {
          const key = dedupeKey('stripe_receipt_missing', order.id);
          seenAlertKeys.add(key);
          await openOrUpdateOrderAlert(sql, {
            orderId: order.id,
            alertType: 'stripe_receipt_missing',
            severity,
            dedupeKey: key,
            title: `Chybí Stripe receipt u ${order.order_number}`,
            message:
              `Objednávka má PaymentIntent (${order.stripe_payment_intent_id.slice(0, 14)}…), ale sloupec stripe_receipt_url je prázdný.`,
            payload: {
              orderNumber: order.order_number,
              stripePaymentIntentId: order.stripe_payment_intent_id,
            },
          });
          openedOrUpdatedAlerts += 1;
        }
      }

      if (transferPending) {
        const sev = severityByTransferAgeDays(orderAgeDays);
        if (sev) {
          const key = dedupeKey('transfer_payment_stale', order.id);
          seenAlertKeys.add(key);
          await openOrUpdateOrderAlert(sql, {
            orderId: order.id,
            alertType: 'transfer_payment_stale',
            severity: sev,
            dedupeKey: key,
            title: `Platba převodem čeká — ${order.order_number}`,
            message:
              `Objednávka čeká na převod ${orderAgeDays.toFixed(1)} d. Po 21 dnech se automaticky stornuje (cancel-stale-orders).`,
            payload: {
              orderNumber: order.order_number,
              ageDays: orderAgeDays,
            },
          });
          openedOrUpdatedAlerts += 1;
        }
      }

      if (order.basecom_status === 'failed') {
        const key = dedupeKey('basecom_failed', order.id);
        seenAlertKeys.add(key);
        await openOrUpdateOrderAlert(sql, {
          orderId: order.id,
          alertType: 'basecom_failed',
          severity: 'critical',
          dedupeKey: key,
          title: `Base.com export selhal u ${order.order_number}`,
          message: baseQueue?.last_error || 'Base.com export skončil ve stavu failed.',
          payload: {
            orderNumber: order.order_number,
            retryCount: baseQueue?.retry_count ?? 0,
          },
        });
        openedOrUpdatedAlerts += 1;
      } else if (
        order.payment_status === 'paid'
        && order.basecom_status !== 'done'
        && order.basecom_status !== 'skipped'
        && !transferPending
      ) {
        const severity = severityByMinutes(orderAgeMinutes, 3, 8);
        if (severity) {
          const key = dedupeKey('basecom_stuck', order.id);
          seenAlertKeys.add(key);
          await openOrUpdateOrderAlert(sql, {
            orderId: order.id,
            alertType: 'basecom_stuck',
            severity,
            dedupeKey: key,
            title: `Base.com export čeká u ${order.order_number}`,
            message: baseQueue?.status === 'processing'
              ? `Export je ve stavu processing ${Math.floor(minutesSince(baseQueue.created_at))} min.`
              : `Objednávka je zaplacená ${Math.floor(orderAgeMinutes)} min a Base.com je stále pending.`,
            payload: {
              orderNumber: order.order_number,
              queueStatus: baseQueue?.status ?? null,
              retryCount: baseQueue?.retry_count ?? 0,
            },
          });
          openedOrUpdatedAlerts += 1;
        }
      }

      if (order.invoice_status === 'failed' && !transferPending) {
        const key = dedupeKey('idoklad_failed', order.id);
        seenAlertKeys.add(key);
        await openOrUpdateOrderAlert(sql, {
          orderId: order.id,
          alertType: 'idoklad_failed',
          severity: 'warning',
          dedupeKey: key,
          title: `iDoklad export selhal u ${order.order_number}`,
          message: idokladQueue?.last_error || 'iDoklad export skončil ve stavu failed.',
          payload: {
            orderNumber: order.order_number,
            retryCount: idokladQueue?.retry_count ?? 0,
          },
        });
        openedOrUpdatedAlerts += 1;
      } else if (
        order.payment_status === 'paid'
        && order.invoice_status !== 'done'
        && hasIdokladQueue
        && !transferPending
      ) {
        const severity = severityByMinutes(orderAgeMinutes, 15, 30);
        if (severity) {
          const key = dedupeKey('idoklad_stuck', order.id);
          seenAlertKeys.add(key);
          await openOrUpdateOrderAlert(sql, {
            orderId: order.id,
            alertType: 'idoklad_stuck',
            severity,
            dedupeKey: key,
            title: `iDoklad export čeká u ${order.order_number}`,
            message: idokladQueue?.status === 'processing'
              ? `Fakturace je ve stavu processing ${Math.floor(minutesSince(idokladQueue.created_at))} min.`
              : `Objednávka je zaplacená ${Math.floor(orderAgeMinutes)} min a iDoklad je stále pending.`,
            payload: {
              orderNumber: order.order_number,
              queueStatus: idokladQueue?.status ?? null,
              retryCount: idokladQueue?.retry_count ?? 0,
            },
          });
          openedOrUpdatedAlerts += 1;
        }
      }

      for (const queue of queues.filter((row) => row.status === 'processing')) {
        const processingMinutes = minutesSince(queue.created_at);
        if (processingMinutes < 10) continue;
        const key = dedupeKey('export_queue_processing_too_long', order.id, queue.service);
        seenAlertKeys.add(key);
        await openOrUpdateOrderAlert(sql, {
          orderId: order.id,
          alertType: 'export_queue_processing_too_long',
          severity: processingMinutes >= 20 ? 'critical' : 'warning',
          dedupeKey: key,
          title: `Queue ${queue.service} visí v processing u ${order.order_number}`,
          message: `Fronta ${queue.service} je ve stavu processing ${Math.floor(processingMinutes)} min.`,
          payload: {
            orderNumber: order.order_number,
            queueItemId: queue.id,
            service: queue.service,
            retryCount: queue.retry_count,
          },
        });
        openedOrUpdatedAlerts += 1;
      }
    }

    const staleAlertKeys = existingAlerts
      .map((alert) => alert.dedupe_key)
      .filter((key) => !seenAlertKeys.has(key));

    if (staleAlertKeys.length > 0) {
      await resolveOrderAlerts(sql, { dedupeKeys: staleAlertKeys });
    }

    return jsonResponse({
      processedOrders: orders.length,
      openedOrUpdatedAlerts,
      resolvedAlerts: staleAlertKeys.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow monitoring failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
