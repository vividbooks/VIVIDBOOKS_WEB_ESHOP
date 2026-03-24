import type postgres from 'npm:postgres';

export const WORKFLOW_STEP_KEYS = [
  'payment_received',
  'order_persisted',
  'customer_email_sent',
  'basecom_exported',
  'idoklad_exported',
  'shipment_created',
] as const;

export type WorkflowStepKey = typeof WORKFLOW_STEP_KEYS[number];
export type WorkflowStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'stuck' | 'skipped';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertState = 'open' | 'acknowledged' | 'resolved' | 'suppressed';

export type WorkflowStepUpsertInput = {
  orderId: string;
  stepKey: WorkflowStepKey;
  status: WorkflowStepStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
  attemptCount?: number | null;
};

export type OrderAlertUpsertInput = {
  orderId?: string | null;
  alertType: string;
  severity: AlertSeverity;
  dedupeKey: string;
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
};

export async function ensureWorkflowSteps(sql: postgres.Sql, orderId: string) {
  for (const stepKey of WORKFLOW_STEP_KEYS) {
    await upsertWorkflowStep(sql, {
      orderId,
      stepKey,
      status: 'pending',
    });
  }
}

export async function upsertWorkflowStep(sql: postgres.Sql, input: WorkflowStepUpsertInput) {
  const startedAt = input.startedAt ?? (input.status === 'running' ? new Date().toISOString() : null);
  const completedAt = input.completedAt ?? (
    input.status === 'done' || input.status === 'skipped'
      ? new Date().toISOString()
      : null
  );
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  await sql`
    insert into public.order_workflow_steps (
      order_id,
      step_key,
      status,
      started_at,
      completed_at,
      last_checked_at,
      attempt_count,
      last_error,
      metadata,
      updated_at
    ) values (
      ${input.orderId}::uuid,
      ${input.stepKey},
      ${input.status},
      ${startedAt},
      ${completedAt},
      now(),
      ${input.attemptCount ?? 0},
      ${input.lastError ?? null},
      ${metadata}::jsonb,
      now()
    )
    on conflict (order_id, step_key) do update
    set
      status = excluded.status,
      started_at = coalesce(public.order_workflow_steps.started_at, excluded.started_at, now()),
      completed_at = case
        when excluded.status in ('done', 'skipped') then coalesce(excluded.completed_at, public.order_workflow_steps.completed_at, now())
        when excluded.status in ('pending', 'running', 'failed', 'stuck') then null
        else public.order_workflow_steps.completed_at
      end,
      last_checked_at = now(),
      attempt_count = coalesce(excluded.attempt_count, public.order_workflow_steps.attempt_count),
      last_error = excluded.last_error,
      metadata = coalesce(excluded.metadata, public.order_workflow_steps.metadata),
      updated_at = now()
  `;
}

export async function openOrUpdateOrderAlert(sql: postgres.Sql, input: OrderAlertUpsertInput) {
  const payload = input.payload ? JSON.stringify(input.payload) : null;

  await sql`
    insert into public.order_alerts (
      order_id,
      alert_type,
      severity,
      state,
      dedupe_key,
      title,
      message,
      first_seen_at,
      last_seen_at,
      payload,
      updated_at
    ) values (
      ${input.orderId ?? null}::uuid,
      ${input.alertType},
      ${input.severity},
      'open',
      ${input.dedupeKey},
      ${input.title},
      ${input.message},
      now(),
      now(),
      ${payload}::jsonb,
      now()
    )
    on conflict (dedupe_key) do update
    set
      order_id = coalesce(excluded.order_id, public.order_alerts.order_id),
      alert_type = excluded.alert_type,
      severity = excluded.severity,
      title = excluded.title,
      message = excluded.message,
      payload = coalesce(excluded.payload, public.order_alerts.payload),
      last_seen_at = now(),
      state = case
        when public.order_alerts.state = 'suppressed' then 'suppressed'
        when public.order_alerts.state = 'acknowledged' then 'acknowledged'
        else 'open'
      end,
      resolved_at = case
        when public.order_alerts.state = 'resolved' then null
        else public.order_alerts.resolved_at
      end,
      updated_at = now()
  `;
}

export async function resolveOrderAlerts(
  sql: postgres.Sql,
  params: {
    orderId?: string | null;
    alertTypes?: string[];
    dedupeKeys?: string[];
  },
) {
  const alertTypes = params.alertTypes ?? [];
  const dedupeKeys = params.dedupeKeys ?? [];

  await sql`
    update public.order_alerts
    set
      state = 'resolved',
      resolved_at = now(),
      updated_at = now()
    where state in ('open', 'acknowledged')
      and (${params.orderId ?? null}::uuid is null or order_id = ${params.orderId ?? null}::uuid)
      and (${alertTypes.length} = 0 or alert_type = any(${alertTypes}::text[]))
      and (${dedupeKeys.length} = 0 or dedupe_key = any(${dedupeKeys}::text[]))
  `;
}
