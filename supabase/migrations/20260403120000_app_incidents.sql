-- Centrální incidenty mimo čistě e‑shopové order_alerts (webináře, budoucí procesy).
-- Stejný životní cyklus: open → acknowledged → resolved.

create table if not exists public.app_incidents (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'site',
  incident_type text not null,
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
  order_id uuid references public.orders(id) on delete set null,
  webinar_id text,
  webinar_title text,
  contact_email text,
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_app_incidents_state
  on public.app_incidents (state, severity, last_seen_at desc);

create index if not exists idx_app_incidents_webinar
  on public.app_incidents (webinar_id, state)
  where webinar_id is not null;

create index if not exists idx_app_incidents_email
  on public.app_incidents (contact_email, state)
  where contact_email is not null;

alter table public.app_incidents enable row level security;

drop policy if exists "service_role_can_select_app_incidents" on public.app_incidents;
create policy "service_role_can_select_app_incidents"
on public.app_incidents
for select
to service_role
using (true);

drop policy if exists "service_role_can_insert_app_incidents" on public.app_incidents;
create policy "service_role_can_insert_app_incidents"
on public.app_incidents
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_update_app_incidents" on public.app_incidents;
create policy "service_role_can_update_app_incidents"
on public.app_incidents
for update
to service_role
using (true)
with check (true);
