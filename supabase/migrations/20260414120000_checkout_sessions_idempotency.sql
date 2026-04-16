-- Idempotence create-payment-intent: stejný košík + zákazník + doprava nesmí vytvořit víc než jednu checkout_sessions / pending objednávku.

alter table public.checkout_sessions
  add column if not exists idempotency_key text;

create unique index if not exists checkout_sessions_idempotency_key_uq
  on public.checkout_sessions (idempotency_key)
  where idempotency_key is not null and length(trim(idempotency_key)) > 0;

comment on column public.checkout_sessions.idempotency_key is
  'SHA-256 (hex) kanonického payloadu — deduplikace paralelních POSTů z pokladny';
