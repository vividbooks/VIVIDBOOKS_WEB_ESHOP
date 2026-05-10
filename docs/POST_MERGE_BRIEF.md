# Developer Brief — Post-Merge Actions for `cursor/pipedrive-webhook-source-update-c3c6`

This branch contains 18 commits and touches three areas:
**(1) Pipedrive inbound webhook A/B branching**,
**(2) checkout supersession + per-tab `checkoutDraftId` + UPDATE-in-place pending orders**,
**(3) Pipedrive deal owner / org / person fixes**.

After the merge, **DB migrations + redeploy of several Edge functions are required**, otherwise production will break (missing columns, stale handler).

PR: [#5](https://github.com/vividbooks/VIVIDBOOKS_WEB_ESHOP/pull/5)

---

## 1. DB migrations — apply **before** redeploying Edge functions

In this order (idempotent, `if not exists`):

```text
supabase/migrations/20260508135521_orders_checkout_draft.sql
supabase/migrations/20260508160000_orders_one_pending_per_draft.sql
supabase/migrations/20260508180000_orders_source.sql
```

What they add:

- `orders.checkout_draft_id text` + a partial index of pending rows per draft.
- **Cleanup of duplicates** (one draft → multiple `pending_payment` rows) + `unique index idx_orders_one_pending_per_draft` (max 1 `pending_payment` per draft).
- `orders.source text default 'eshop' check (eshop|pipedrive)` + index. **Retroactively** flags historical Pipedrive imports based on `order_events.event_type = 'pipedrive_inbound'`.

Watch out for:

- The second migration cancels older duplicates with reason `Cleanup before unique pending-per-draft index` — before running, it is wise to check the count:

```sql
select checkout_draft_id, count(*)
from public.orders
where status = 'pending_payment' and coalesce(trim(checkout_draft_id),'') <> ''
group by 1 having count(*) > 1;
```

- The third migration **must be applied before the new `pipedrive-inbound-deal` version starts running** (the handler inserts `source = 'pipedrive'`).

Applying: standard project workflow (Supabase CLI `db push` / Dashboard SQL Editor).

---

## 2. Redeploy Edge functions

The following handlers changed — redeploy all of them (from the repo root):

```bash
supabase functions deploy make-server-93a20b6f --no-verify-jwt
supabase functions deploy pipedrive-inbound-deal --no-verify-jwt
supabase functions deploy admin-orders
supabase functions deploy admin-order-action
supabase functions deploy create-payment-intent
supabase functions deploy submit-transfer-order
supabase functions deploy process-export-queue
supabase functions deploy stripe-webhook
```

What each function newly does:

- **`make-server-93a20b6f`** — `getEshopOrderIdPayload(orderNumber)` populates the custom field `26e4a2f8…` (Eshop ID, UI 12586) in `createPipedriveEshopDealAdvanced` (POST) and `refreshEshopPipedriveDealFromDb` (PUT). Unified deal-owner selection logic via the org field `current_deal_owner` (4056) with fallbacks (B2C → Daniel Ondrášek; card-paid B2B → Daniel; transfer B2B → Gabriela). `person create` populates `name + email + phone + position + org`. Position is mapped to the enum option ID of field 9093. ICO is written into the org field `CIN` (4033). Strict ICO match when creating an org.
- **`pipedrive-inbound-deal`** — A/B branching based on the "Eshop ID" field:
  - **A (field empty)**: a new `INSERT` into `orders` with `source = 'pipedrive'`, shipping `ppl`, push to `export_queue` (basecom + idoklad), synchronous `process-export-queue`.
  - **B (field populated, or matched via `pipedrive_deal_id`)**: in a transaction `DELETE` + `INSERT` of all `order_items` from the deal, recompute `subtotal/shipping/total`, `payment_status='paid'`, `status='paid'`, `paid_at = coalesce(paid_at, now())`. Push to `export_queue` only for services that do **not** have a `pending`/`processing`/`done` row yet (idempotency). Audit `order_events.event_type = 'pipedrive_inbound_update'`.
- **`create-payment-intent` + `submit-transfer-order`** — **UPDATE-in-place** of the pending order per `checkout_draft_id` (shared helper `_shared/update-draft-order.ts`); supersession of older drafts via `_shared/cancel-superseded-orders.ts`. The frontend sends `checkoutDraftId` (per-tab UUID). `submit-transfer-order` awaits `pipedrive-sync` (await instead of fire-and-forget). The service-role key is also accepted in the `apikey` header.
- **`admin-orders`** — returns `source` in the list + filter `?source=eshop|pipedrive`. Hides audit-trail superseded rows from the default listing.

---

## 3. Frontend (Vite build)

The build from `main` will run automatically through the standard pipeline (GitHub Pages). Changes:

- `CheckoutPage.tsx` — per-tab `checkoutDraftId` (see `src/utils/checkoutDraftId.ts`), debounced PI fetch, supersession.
- `StripePaymentSubmitForm.tsx` — for transfer payment "Continue" now triggers the "Submit order" function.
- `AdminOrdersPage.tsx` — source badge (E-shop / Pipedrive) + filter in the header.
- `adminApi.ts` — `AdminOrderListItem.source` + `fetchAdminOrders({ source })`.

No new **required** `VITE_*` variables.

---

## 4. ENV / Secrets

**No new required secrets.** All new env vars have reasonable defaults in code. Optional overrides (Supabase Edge Secrets, not `.env`):

- `PIPEDRIVE_ESHOP_ORDER_ID_FIELD_KEY` (default `26e4a2f8dc44e49f369c468ccc816ad668b37d92`) — hash key of the "Eshop ID" field used when populating the value during eshop deal creation.
- `PIPEDRIVE_INBOUND_ESHOP_ORDER_ID_FIELD` (same default) — override for lookup in the inbound webhook.
- `PIPEDRIVE_INBOUND_SHIPPING_METHOD` (default `ppl`), `PIPEDRIVE_INBOUND_SHIPPING_PRICE_HALER` (default `8900`).
- `PIPEDRIVE_ESHOP_B2C_OWNER_ID`, `PIPEDRIVE_ESHOP_CARD_PAID_FALLBACK_OWNER_ID`, `PIPEDRIVE_ESHOP_TRANSFER_FALLBACK_OWNER_ID`, `PIPEDRIVE_ESHOP_FALLBACK_OWNER_ID` — see the new comments in `.env.example` (lines 126–139).

If the user wants card-paid B2B to fall back to Daniel and transfer B2B to Gabriela, **set the two new IDs** in Edge Secrets — without them, the owner is taken from `current_deal_owner` (4056) or from the API token holder.

---

## 5. Pipedrive configuration in CRM (one-time check)

- Webhook URL **does not change** — `…/pipedrive-inbound-deal?token=…` stays the same.
- Verify the custom field **"Eshop ID" (UI ID 12586)** exists on the deal entity and is a text field. The eshop populates it automatically (`order_number` like `VB-…`) when creating a new deal.
- For historical "transfer" deals created before this deploy, **the field will be empty** → a second webhook after an edit would treat them as scenario A (new order). Either fill the `order_number` into Eshop ID manually, or rely on the fallback via `orders.pipedrive_deal_id` (the handler tries this as the second lookup).

---

## 6. Smoke tests after deployment

1. **Checkout supersession**:
   - Open the checkout, switch shipping/payment several times, finish one order. `orders` must contain **exactly one** `pending_payment` row per `checkout_draft_id` (unique index). Older rows of the same draft have `status='cancelled'` with `cancelled_reason` describing supersession.
   - Open the checkout **in two tabs** — each gets its own `checkoutDraftId` and its own `pending_payment`.
2. **Pipedrive A — manually created deal**:
   - In CRM create a new deal, an organization with ICO, a person with an email, products, mark won → in admin a new order with the **"Pipedrive" badge** appears, shipping PPL, Base.com export runs, iDoklad invoice is issued.
3. **Pipedrive B — eshop transfer**:
   - B1: order on the web with bank transfer payment → in Pipedrive the deal has Eshop ID = `order_number`. The salesperson adds a product → won → the original order has updated items, `paid_at` set, the **"E-shop" badge** stays, Base.com export runs.
   - B2: **the same deal won twice** → the second webhook returns `mode: 'updated'` with `skippedServices: ['basecom','idoklad']`, only audit `pipedrive_inbound_update`.
4. **Admin source filter** — `/admin/objednavky` → E-shop / Pipedrive filter works, the badge next to the order number matches `orders.source`.
5. **Audit-trail visibility** — superseded `cancelled` duplicates from the past **are not** in the default admin listing (only in the detail view / via the "all" filter).

---

## 7. Rollback plan

- Edge functions: `supabase functions deploy <name>` from `main` at the previous commit (before this branch).
- DB:
  - `orders.checkout_draft_id` and `orders.source` are nullable / have defaults → the old handler ignores them, no need to drop them.
  - `idx_orders_one_pending_per_draft` (unique) **does not** prevent the old code from working as long as the frontend keeps sending `checkoutDraftId`. If we also roll back the frontend so it stops sending it, the index will be inactive (partial `where checkout_draft_id is not null`).
  - As a last resort: `drop index if exists public.idx_orders_one_pending_per_draft;` and `drop index if exists public.idx_orders_checkout_draft_pending;`.

---

## 8. What to monitor in logs after deployment

- **Edge Function Logs `pipedrive-inbound-deal`** — look for the ratio of `event: created` vs `event: updated` (it should match real traffic; B updates are typical for transfers).
- **Edge Function Logs `create-payment-intent` + `submit-transfer-order`** — log `[supersede]` / `[update-draft]`; if the unique index starts failing, it indicates a draft race.
- **Admin orders** — visual check that there are no duplicates per draft and the source badge matches reality.
