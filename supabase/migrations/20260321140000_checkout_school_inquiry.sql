-- Školní payload pro /objednat (stejné tělo jako POST make-server /orders), pro forward po Stripe.
alter table public.checkout_sessions
  add column if not exists school_inquiry jsonb;

comment on column public.checkout_sessions.school_inquiry is
  'Volitelné: kompletní tělo školní poptávky (jako OrderPage → /orders), pro stripe-webhook po zaplacení kartou.';

-- Idempotence: jednou odeslat /orders na školní flow po úspěšné platbě.
alter table public.orders
  add column if not exists school_pipedrive_forwarded_at timestamptz;

comment on column public.orders.school_pipedrive_forwarded_at is
  'Čas úspěšného POST na make-server /orders (školní karta); null = ještě neodesláno nebo selhání (retry).';
