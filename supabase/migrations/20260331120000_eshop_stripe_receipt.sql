alter table public.orders
  add column if not exists stripe_receipt_url text;
