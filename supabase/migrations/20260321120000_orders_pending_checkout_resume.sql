-- Objednávka ve stavu pending_payment při vytvoření PaymentIntent + token pro dokončení platby z e-mailu + připomínky

alter table public.orders
  add column if not exists checkout_session_id uuid,
  add column if not exists payment_resume_token text,
  add column if not exists abandon_reminder_count integer not null default 0,
  add column if not exists last_abandon_reminder_at timestamptz;

comment on column public.orders.checkout_session_id is 'UUID řádku checkout_sessions (pokladna před platbou)';
comment on column public.orders.payment_resume_token is 'Tajný token pro odkaz „dokončit platbu“ v připomínkových e-mailech';
comment on column public.orders.abandon_reminder_count is 'Počet odeslaných připomínek nedokončené platby (max 4)';
comment on column public.orders.last_abandon_reminder_at is 'Čas poslední připomínky';

create unique index if not exists orders_payment_resume_token_uq
  on public.orders (payment_resume_token)
  where payment_resume_token is not null;

create index if not exists idx_orders_pending_payment_reminders
  on public.orders (status, created_at)
  where status = 'pending_payment' and payment_status = 'pending';
