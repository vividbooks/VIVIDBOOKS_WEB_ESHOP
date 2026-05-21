-- Nový stav `incomplete` pro objednávky, které začaly checkout (create-payment-intent
-- vytvořil pending řádek), ale zákazník platbu nikdy nepokusil dokončit (nezmáčkl Pay
-- ve Stripe formuláři). V adminu se zobrazí jako „Nedokončená", `pending_payment`
-- zůstává pro objednávky, kde zákazník opravdu zadal/odeslal (převod = explicit submit,
-- karta = aspoň 1× attempted_payment) — admin to vidí jako „Čeká na platbu".
--
-- Změny:
--   1) Rozšířit CHECK na orders.status o 'incomplete'.
--   2) Re-create partial unique index `one_pending_per_draft` → `one_active_per_draft`,
--      který nově pokrývá i `incomplete` (jinak by se incomplete řádky duplikovaly mezi pokusy
--      a UPDATE in-place v create-payment-intent by neměl co najít).
--   3) Backfill: existující `pending_payment` karty / Apple Pay / Google Pay řádky, které
--      v `order_events` nemají žádný `payment_attempt_failed` ani `payment` záznam = zákazník
--      se o platbu nikdy nepokusil. Přeznačit na `incomplete`. Transfer + invoice se nemění.

begin;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check check (
    status = any (array[
      'draft'::text,
      'incomplete'::text,
      'pending_payment'::text,
      'paid'::text,
      'processing'::text,
      'exported'::text,
      'shipped'::text,
      'delivered'::text,
      'cancelled'::text,
      'refunded'::text,
      'failed'::text
    ])
  );

-- Nahradit původní index novým, který pokrývá oba „aktivní" stavy.
drop index if exists public.idx_orders_one_pending_per_draft;
drop index if exists public.idx_orders_one_active_per_draft;

create unique index idx_orders_one_active_per_draft
  on public.orders (checkout_draft_id)
  where status in ('incomplete', 'pending_payment')
    and checkout_draft_id is not null
    and length(trim(checkout_draft_id)) > 0;

comment on index public.idx_orders_one_active_per_draft is
  'Garantuje max 1 aktivní (incomplete | pending_payment) řádek per checkout_draft_id. Backend ho v create-payment-intent / submit-transfer-order updatuje v place místo zakládání nového řádku.';

-- Backfill: relabel old card-like orders that never had a payment attempt → incomplete.
-- Bezpečné — tyto řádky reprezentují zákazníky, kteří checkout opustili bez stisknutí Pay.
update public.orders o
set
  status = 'incomplete',
  updated_at = now()
where o.status = 'pending_payment'
  and o.payment_method in ('card', 'apple_pay', 'google_pay')
  and not exists (
    select 1
    from public.order_events e
    where e.order_id = o.id
      and e.event_type in ('payment_attempt_failed', 'payment')
  );

-- Audit event pro každý přepsaný řádek (aby v timeline objednávky bylo jasné, že migrace
-- ji přesunula).
insert into public.order_events (order_id, event_type, from_status, to_status, details, actor)
select
  o.id,
  'status_migration',
  'pending_payment',
  'incomplete',
  jsonb_build_object('reason', 'backfill_incomplete_status', 'migration', '20260519100000_orders_status_incomplete'),
  'system'
from public.orders o
where o.status = 'incomplete'
  and not exists (
    select 1 from public.order_events e
    where e.order_id = o.id
      and e.event_type = 'status_migration'
      and e.details ->> 'migration' = '20260519100000_orders_status_incomplete'
  );

commit;
