-- Server-side konverze (nákup, trial, …) pro GA4 Measurement Protocol a offline upload.
create table if not exists public.marketing_conversions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('purchase','trial_request','lead','activation')),
  value numeric,
  currency text not null default 'CZK',
  order_id uuid,
  anon_id text,
  gclid text,
  gbraid text,
  wbraid text,
  utm_campaign text,
  person_id uuid,
  occurred_at timestamptz not null default now(),
  ga4_sent_at timestamptz,
  ga4_error text,
  created_at timestamptz not null default now(),
  unique (type, order_id)
);

create index if not exists marketing_conversions_type_idx on public.marketing_conversions (type, occurred_at desc);
create index if not exists marketing_conversions_order_idx on public.marketing_conversions (order_id);

alter table public.marketing_conversions enable row level security;
-- Žádné anon policy → jen service role.
