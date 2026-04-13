-- Plakátové objednávky: ruční plnění v adminu, bez exportu do Base.com
alter table public.orders
  add column if not exists poster_fulfillment_status text;

comment on column public.orders.poster_fulfillment_status is
  'NULL = běžná objednávka. pending|done = pouze objednávky jen z položek posterMerch (plakáty / na objednávku).';
