alter table public.order_items
  add column if not exists bundle_id text,
  add column if not exists bundle_title text;
