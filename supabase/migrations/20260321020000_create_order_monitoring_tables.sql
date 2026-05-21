create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.order_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  step_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'stuck', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  last_checked_at timestamptz default now(),
  attempt_count integer not null default 0,
  last_error text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (order_id, step_key)
);

create table if not exists public.order_alerts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  alert_type text not null,
  severity text not null
    check (severity in ('info', 'warning', 'critical')),
  state text not null default 'open'
    check (state in ('open', 'acknowledged', 'resolved', 'suppressed')),
  dedupe_key text not null unique,
  title text not null,
  message text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_notified_at timestamptz,
  notification_count integer not null default 0,
  payload jsonb,
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_order_workflow_steps_order
  on public.order_workflow_steps (order_id, step_key);

create index if not exists idx_order_workflow_steps_status
  on public.order_workflow_steps (status, last_checked_at desc);

create index if not exists idx_order_alerts_state
  on public.order_alerts (state, severity, last_seen_at desc);

create index if not exists idx_order_alerts_order
  on public.order_alerts (order_id, state, severity);

alter table public.order_workflow_steps enable row level security;
alter table public.order_alerts enable row level security;

drop policy if exists "service_role_can_select_order_workflow_steps" on public.order_workflow_steps;
create policy "service_role_can_select_order_workflow_steps"
on public.order_workflow_steps
for select
to service_role
using (true);

drop policy if exists "service_role_can_insert_order_workflow_steps" on public.order_workflow_steps;
create policy "service_role_can_insert_order_workflow_steps"
on public.order_workflow_steps
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_update_order_workflow_steps" on public.order_workflow_steps;
create policy "service_role_can_update_order_workflow_steps"
on public.order_workflow_steps
for update
to service_role
using (true)
with check (true);

drop policy if exists "service_role_can_select_order_alerts" on public.order_alerts;
create policy "service_role_can_select_order_alerts"
on public.order_alerts
for select
to service_role
using (true);

drop policy if exists "service_role_can_insert_order_alerts" on public.order_alerts;
create policy "service_role_can_insert_order_alerts"
on public.order_alerts
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_update_order_alerts" on public.order_alerts;
create policy "service_role_can_update_order_alerts"
on public.order_alerts
for update
to service_role
using (true)
with check (true);

do $migration$
declare
  existing_job_id bigint;
  v_url text := coalesce(
    nullif(current_setting('app.monitor_order_workflows_url', true), ''),
    'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/monitor-order-workflows'
  );
  v_headers jsonb;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'monitor-order-workflows-every-minute'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  v_headers := jsonb_strip_nulls(
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', nullif(current_setting('app.monitor_order_workflows_cron_secret', true), '')
    )
  );

  perform cron.schedule(
    'monitor-order-workflows-every-minute',
    '* * * * *',
    $job$
      select net.http_post(
        url := v_url,
        headers := v_headers,
        body := '{}'::jsonb
      );
    $job$
  );
end;
$migration$;
