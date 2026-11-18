-- Pojítko objednávky na první dotyk z reklamy: pokladna ukládá anonymní ID,
-- které nese i `marketing_touchpoints.anon_id`. Bez něj nejde nákup dohledat
-- zpět ke kliknutí (gclid) u hostů bez účtu.

alter table public.orders
  add column if not exists marketing_anon_id text;

create index if not exists orders_marketing_anon_id_idx
  on public.orders (marketing_anon_id)
  where marketing_anon_id is not null;

-- Souhlas s marketingem u konverzí: bez něj se hashovaný e-mail nesmí poslat
-- do Google Ads (Data Manager) ani jako GA4 Measurement Protocol.
alter table public.marketing_conversions
  add column if not exists consent_marketing boolean,
  add column if not exists consent_analytics boolean;

alter table public.marketing_offline_conversions
  add column if not exists consent_marketing boolean,
  add column if not exists blocked_reason text;
