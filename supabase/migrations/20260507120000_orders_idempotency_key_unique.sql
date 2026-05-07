-- Jedna objednávka na stejný hash košíku (submit-transfer-order); sloupec přidal už 20260416120000—pro starší DB safety:
alter table public.orders add column if not exists idempotency_key text;

-- Jedna nevyřízená objednávka na stejný obsah košíku (převod / idempotence serveru).
-- Při duplicitním kliknutí nebo opakovaném POST se druhý INSERT s stejným idempotency_key selže
-- a handler vrátí stávající objednávku.
create unique index if not exists orders_idempotency_key_uq
  on public.orders (idempotency_key)
  where idempotency_key is not null and length(trim(idempotency_key)) > 0;
