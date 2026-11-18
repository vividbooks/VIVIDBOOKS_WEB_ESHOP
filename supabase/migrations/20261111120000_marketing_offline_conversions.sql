-- Offline konverze (Data Manager API): tracking uploadů konverzí do Google Ads.
create table if not exists public.marketing_offline_conversions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'ultra_license',
  external_id text,
  email_hash text,
  gclid text,
  conversion_action text,
  conversion_value numeric,
  currency text not null default 'CZK',
  occurred_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','uploaded','failed','skipped')),
  uploaded_at timestamptz,
  error text,
  response jsonb,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists marketing_offline_conversions_status_idx on public.marketing_offline_conversions (status, created_at desc);
create index if not exists marketing_offline_conversions_occurred_idx on public.marketing_offline_conversions (occurred_at desc);

alter table public.marketing_offline_conversions enable row level security;
