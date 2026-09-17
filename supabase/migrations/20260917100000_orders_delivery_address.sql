-- Jiná doručovací adresa z pokladny (přepínač „Doručit na jinou adresu“).
--
-- Dřív se ukládala jen do `checkout_sessions.shipping_data` (a to jen u karetních objednávek),
-- `orders` nesla pouze fakturační ulici/město/PSČ a export do Base.com (BaseLinker) i e‑maily
-- z ní četly fakturační adresu. Zásilka tak jela na fakturační adresu, i když učitelka zadala
-- doručení do školy (např. VB-2026-0468).
--
-- NULL ve všech sloupcích = doručit na fakturační adresu (`orders.street` / `city` / `zip`).

alter table public.orders
  add column if not exists delivery_recipient_name text,
  add column if not exists delivery_street text,
  add column if not exists delivery_city text,
  add column if not exists delivery_zip text;

comment on column public.orders.delivery_recipient_name is
  'Jiná doručovací adresa z pokladny — příjemce (jméno / škola). NULL = doručit na fakturační adresu.';
comment on column public.orders.delivery_street is
  'Jiná doručovací adresa z pokladny — ulice a číslo. NULL = doručit na fakturační adresu.';
comment on column public.orders.delivery_city is
  'Jiná doručovací adresa z pokladny — město. NULL = doručit na fakturační adresu.';
comment on column public.orders.delivery_zip is
  'Jiná doručovací adresa z pokladny — PSČ. NULL = doručit na fakturační adresu.';

-- Backfill: karetní objednávky mají adresu v `checkout_sessions.shipping_data`.
-- (Převodové objednávky `checkout_sessions` řádek nemají — u nich je adresa ztracená,
-- zůstala jen jako poznámka u dealu v Pipedrivu.)
--
-- Pozor: `shipping_data` je v praxi jsonb *řetězec* (create-payment-intent posílá
-- `JSON.stringify(shipping)` přes postgres.js, který ho serializuje jako JSON string),
-- proto se před čtením klíčů rozbaluje `#>> '{}'` → `::jsonb`.
with sess as (
  select
    id,
    case
      when jsonb_typeof(shipping_data) = 'string' then (shipping_data #>> '{}')::jsonb
      else shipping_data
    end as ship
  from public.checkout_sessions
  where shipping_data is not null
)
update public.orders o
   set delivery_recipient_name = nullif(trim(sess.ship -> 'deliveryAddress' ->> 'recipientName'), ''),
       delivery_street = nullif(trim(sess.ship -> 'deliveryAddress' ->> 'street'), ''),
       delivery_city = nullif(trim(sess.ship -> 'deliveryAddress' ->> 'city'), ''),
       delivery_zip = nullif(trim(sess.ship -> 'deliveryAddress' ->> 'zip'), '')
  from sess
 where sess.id = o.checkout_session_id
   and o.delivery_street is null
   and jsonb_typeof(sess.ship) = 'object'
   and (sess.ship ->> 'differentAddress') = 'true'
   and nullif(trim(sess.ship -> 'deliveryAddress' ->> 'street'), '') is not null;
