-- Architektonická změna: pro daný `checkout_draft_id` smí v `orders` existovat
-- maximálně **jeden** řádek se statusem `pending_payment`. Nový create-payment-intent
-- a submit-transfer-order místo „nový INSERT + supersession starých" UPDATÍ
-- existující řádek na místě. Tím nevznikají audit-trail cancelled duplicity, které
-- mátly admina v hlavním seznamu objednávek.
--
-- Předpoklad: před vytvořením unique indexu vyčistíme případné existující duplicity
-- (jeden draft → 2+ pending řádky). Zachováme nejnovější, starší cancelneme s důvodem
-- 'Cleanup before unique pending-per-draft index'.

update public.orders older
set
  status = 'cancelled',
  cancelled_at = coalesce(older.cancelled_at, now()),
  cancelled_reason = coalesce(older.cancelled_reason, 'Cleanup before unique pending-per-draft index'),
  updated_at = now()
where older.status = 'pending_payment'
  and older.checkout_draft_id is not null
  and length(trim(older.checkout_draft_id)) > 0
  and exists (
    select 1
    from public.orders newer
    where newer.checkout_draft_id = older.checkout_draft_id
      and newer.status = 'pending_payment'
      and newer.created_at > older.created_at
  );

create unique index if not exists idx_orders_one_pending_per_draft
  on public.orders (checkout_draft_id)
  where status = 'pending_payment'
    and checkout_draft_id is not null
    and length(trim(checkout_draft_id)) > 0;

comment on index public.idx_orders_one_pending_per_draft is
  'Garantuje max 1 pending_payment řádek per checkout_draft_id. Backend ho v create-payment-intent / submit-transfer-order updatuje v place místo zakládání nového řádku.';
