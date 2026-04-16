-- Klíč pro idempotenci create-payment-intent (B2C); doplní Edge Function.
alter table public.orders
  add column if not exists idempotency_key text;

comment on column public.orders.idempotency_key is
  'SHA-256 hash stabilního obsahu košíku (B2C) pro znovupoužití PaymentIntent; viz create-payment-intent.';

create index if not exists idx_orders_idempotency_pending
  on public.orders (lower(trim(customer_email)), idempotency_key, created_at desc)
  where status = 'pending_payment' and idempotency_key is not null;
