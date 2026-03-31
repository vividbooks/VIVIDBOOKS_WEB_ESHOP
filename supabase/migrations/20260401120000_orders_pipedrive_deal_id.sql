-- Jednoznačná vazba deal → objednávka v e-shopu (inbound z Pipedrive webhooku).
alter table public.orders
  add column if not exists pipedrive_deal_id text;

create unique index if not exists idx_orders_pipedrive_deal_id_unique
  on public.orders (pipedrive_deal_id)
  where pipedrive_deal_id is not null and length(trim(pipedrive_deal_id)) > 0;
