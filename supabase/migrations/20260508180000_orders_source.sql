-- Přidá sloupec public.orders.source pro rozlišení původu objednávky.
-- 'eshop'     – objednávka vznikla na webu (běžný checkout, Stripe / převod),
-- 'pipedrive' – objednávka vznikla z Pipedrive dealu (won) přes pipedrive-inbound-deal webhook
--               (typicky ručně založený deal v CRM bez vyplněného custom pole "Eshop ID").
--
-- Retroaktivní zpětné označení historie: kdokoli, kdo má v `order_events` řádek typu
-- `pipedrive_inbound`, byl založen webhookem (před zavedením tohoto sloupce). Tyto objednávky
-- přemapujeme z výchozího `'eshop'` na `'pipedrive'`, ať admin seznam ukazuje správný zdroj.

alter table public.orders
  add column if not exists source text not null default 'eshop'
  check (source in ('eshop', 'pipedrive'));

update public.orders o
   set source = 'pipedrive'
 where o.source = 'eshop'
   and exists (
     select 1
       from public.order_events oe
      where oe.order_id = o.id
        and oe.event_type = 'pipedrive_inbound'
   );

create index if not exists idx_orders_source on public.orders (source);
