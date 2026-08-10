-- Rozšíří public.orders.source o hodnotu 'distributor'.
-- 'distributor' – objednávka z neveřejné distributorské stránky (/distributor/objednavka):
--                 zakládá deal v Pipedrive pipeline 8 (Channel Partners Performance CP2),
--                 do Base.com ani iDokladu se nikdy neexportuje.

alter table public.orders
  drop constraint if exists orders_source_check;

alter table public.orders
  add constraint orders_source_check
  check (source in ('eshop', 'pipedrive', 'distributor'));
