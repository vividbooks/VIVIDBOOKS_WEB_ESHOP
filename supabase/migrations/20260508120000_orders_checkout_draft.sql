-- Per-tab UUID pokladny — frontend posílá `checkoutDraftId` v POSTech na create-payment-intent / submit-transfer-order.
-- Server zruší starší `pending_payment` objednávky téhož draftu, aby v adminu nezůstávaly duplicity
-- vzniklé přepínáním dopravy nebo přepínáním mezi Stripe a převodem.

alter table public.orders add column if not exists checkout_draft_id text;

create index if not exists idx_orders_checkout_draft_pending
  on public.orders (checkout_draft_id, created_at desc)
  where status = 'pending_payment'
    and checkout_draft_id is not null
    and length(trim(checkout_draft_id)) > 0;

comment on column public.orders.checkout_draft_id is
  'Per-tab UUID pokladny — na server posílá frontend; nové pending objednávky téhož draftu nahrazují starší.';
