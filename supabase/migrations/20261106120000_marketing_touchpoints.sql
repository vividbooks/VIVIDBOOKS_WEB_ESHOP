-- Marketing touchpoints: zachycení click ID (gclid/gbraid/wbraid) a UTM při příchodu.
-- Slouží k atribuci offline konverzí (trial, licence, objednávka) ke kampaním.
-- Vkládá frontend (anon) při první návštěvě; čtení jen přes service role (Edge/admin).

create table if not exists public.marketing_touchpoints (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  gclid text,
  gbraid text,
  wbraid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_url text,
  referrer text,
  consent_analytics boolean not null default false,
  consent_marketing boolean not null default false,
  person_id uuid,
  order_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists marketing_touchpoints_anon_id_idx on public.marketing_touchpoints (anon_id, created_at desc);
create index if not exists marketing_touchpoints_gclid_idx on public.marketing_touchpoints (gclid) where gclid is not null;
create index if not exists marketing_touchpoints_created_at_idx on public.marketing_touchpoints (created_at desc);

alter table public.marketing_touchpoints enable row level security;

-- Kdokoli může zaznamenat touchpoint (click ID nejsou PII; bez anon_id ne).
drop policy if exists marketing_touchpoints_insert_anon on public.marketing_touchpoints;
create policy marketing_touchpoints_insert_anon
  on public.marketing_touchpoints
  for insert
  to anon, authenticated
  with check (anon_id is not null and length(anon_id) > 0);

-- Čtení jen service role (RLS bypass) — admin přes Edge funkce.
