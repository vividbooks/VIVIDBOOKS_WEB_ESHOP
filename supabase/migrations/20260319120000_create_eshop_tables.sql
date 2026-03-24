create extension if not exists pgcrypto;

create or replace function public.generate_order_number(p_created_at timestamptz default now())
returns text
language plpgsql
as $$
declare
  order_year text;
  order_prefix text;
  next_number integer;
begin
  order_year := to_char(coalesce(p_created_at, now()), 'YYYY');
  order_prefix := 'VB-' || order_year || '-';

  perform pg_advisory_xact_lock(hashtext('public.orders.order_number.' || order_year));

  select coalesce(
    max(substring(order_number from '([0-9]{4})$')::integer),
    0
  ) + 1
  into next_number
  from public.orders
  where order_number like order_prefix || '%';

  return order_prefix || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.orders_set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := public.generate_order_number(new.created_at);
  end if;

  return new;
end;
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Filled by tr_orders_set_order_number before insert.
  order_number text unique not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_payment', 'paid', 'processing', 'exported', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed')),
  customer_email text not null,
  customer_name text not null,
  customer_phone text,
  school_name text,
  ico text,
  street text,
  city text,
  zip text,
  country text default 'CZ',
  shipping_method text not null,
  shipping_price integer not null default 0,
  pickup_point_id text,
  pickup_point_name text,
  tracking_number text,
  payment_method text not null
    check (payment_method in ('card', 'apple_pay', 'google_pay', 'transfer', 'invoice')),
  payment_status text default 'pending',
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  subtotal integer not null,
  total integer not null,
  basecom_status text default 'pending',
  basecom_order_id text,
  invoice_status text default 'pending',
  invoice_number text,
  zasilkovna_status text default 'pending',
  zasilkovna_packet_id text,
  note text,
  admin_note text,
  cancelled_reason text,
  retry_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  variant text,
  quantity integer not null,
  unit_price integer not null,
  total_price integer not null
);

create table if not exists public.export_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  service text not null
    check (service in ('basecom', 'zasilkovna', 'idoklad', 'email')),
  status text default 'pending',
  payload jsonb,
  retry_count integer default 0,
  max_retries integer default 5,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  event_type text not null,
  from_status text,
  to_status text,
  details jsonb,
  actor text,
  created_at timestamptz default now()
);

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  stripe_payment_intent_id text unique,
  cart_data jsonb not null,
  customer_data jsonb not null,
  shipping_data jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_orders_status
  on public.orders (status);

create index if not exists idx_orders_payment_intent
  on public.orders (stripe_payment_intent_id);

create index if not exists idx_orders_email
  on public.orders (customer_email);

create index if not exists idx_orders_created
  on public.orders (created_at desc);

create index if not exists idx_orders_number
  on public.orders (order_number);

create index if not exists idx_export_queue_pending
  on public.export_queue (status, next_retry_at)
  where status in ('pending', 'processing');

create index if not exists idx_order_events_order
  on public.order_events (order_id, created_at desc);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.export_queue enable row level security;
alter table public.order_events enable row level security;
alter table public.checkout_sessions enable row level security;

drop policy if exists "customers_can_select_own_orders" on public.orders;
create policy "customers_can_select_own_orders"
on public.orders
for select
to authenticated
using (customer_email = auth.email());

drop policy if exists "customers_can_select_own_order_items" on public.order_items;
create policy "customers_can_select_own_order_items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = order_items.order_id
      and public.orders.customer_email = auth.email()
  )
);

drop policy if exists "service_role_can_insert_orders" on public.orders;
create policy "service_role_can_insert_orders"
on public.orders
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_insert_order_items" on public.order_items;
create policy "service_role_can_insert_order_items"
on public.order_items
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_select_export_queue" on public.export_queue;
create policy "service_role_can_select_export_queue"
on public.export_queue
for select
to service_role
using (true);

drop policy if exists "service_role_can_insert_export_queue" on public.export_queue;
create policy "service_role_can_insert_export_queue"
on public.export_queue
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_update_export_queue" on public.export_queue;
create policy "service_role_can_update_export_queue"
on public.export_queue
for update
to service_role
using (true)
with check (true);

drop policy if exists "service_role_can_select_order_events" on public.order_events;
create policy "service_role_can_select_order_events"
on public.order_events
for select
to service_role
using (true);

drop policy if exists "service_role_can_insert_order_events" on public.order_events;
create policy "service_role_can_insert_order_events"
on public.order_events
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_update_order_events" on public.order_events;
create policy "service_role_can_update_order_events"
on public.order_events
for update
to service_role
using (true)
with check (true);

drop policy if exists "service_role_can_select_checkout_sessions" on public.checkout_sessions;
create policy "service_role_can_select_checkout_sessions"
on public.checkout_sessions
for select
to service_role
using (true);

drop policy if exists "service_role_can_insert_checkout_sessions" on public.checkout_sessions;
create policy "service_role_can_insert_checkout_sessions"
on public.checkout_sessions
for insert
to service_role
with check (true);

drop policy if exists "service_role_can_update_checkout_sessions" on public.checkout_sessions;
create policy "service_role_can_update_checkout_sessions"
on public.checkout_sessions
for update
to service_role
using (true)
with check (true);

drop trigger if exists tr_orders_set_order_number on public.orders;
create trigger tr_orders_set_order_number
before insert on public.orders
for each row
execute function public.orders_set_order_number();

-- Reuses the shared helper created in an earlier migration: public.set_row_updated_at().
drop trigger if exists tr_orders_set_updated_at on public.orders;
create trigger tr_orders_set_updated_at
before update on public.orders
for each row
execute function public.set_row_updated_at();
