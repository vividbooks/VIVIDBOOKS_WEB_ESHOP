-- Growth metrics: denní metriky z Google Ads (kampaně, ad groups, klíčová slova, search terms).
-- Zápis jen přes service role (Edge ETL); čtení admin přes Edge funkce.

create table if not exists public.growth_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  level text not null check (level in ('campaign','ad_group','keyword')),
  campaign_id text,
  campaign_name text,
  ad_group_id text,
  ad_group_name text,
  keyword_id text,
  keyword_text text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost_micros bigint not null default 0,
  conversions numeric not null default 0,
  conversion_value numeric not null default 0,
  currency text not null default 'CZK',
  created_at timestamptz not null default now(),
  unique (date, level, campaign_id, ad_group_id, keyword_id)
);

create table if not exists public.growth_search_terms_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_id text,
  ad_group_id text,
  search_term text not null,
  match_type text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost_micros bigint not null default 0,
  conversions numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (date, campaign_id, ad_group_id, search_term)
);

create index if not exists growth_metrics_daily_date_idx on public.growth_metrics_daily (date desc);
create index if not exists growth_metrics_daily_campaign_idx on public.growth_metrics_daily (campaign_id, date desc);
create index if not exists growth_search_terms_daily_date_idx on public.growth_search_terms_daily (date desc);
create index if not exists growth_search_terms_daily_term_idx on public.growth_search_terms_daily (search_term, date desc);

alter table public.growth_metrics_daily enable row level security;
alter table public.growth_search_terms_daily enable row level security;
-- Žádné anon/authenticated policy → jen service role (Edge) čte/zapisuje.
