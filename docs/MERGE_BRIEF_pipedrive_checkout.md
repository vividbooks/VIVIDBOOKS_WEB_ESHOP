# Merge brief — `cursor/updates-pipedrive-order-duplicates-c6d6` → `main`

**PR**: [#4](https://github.com/vividbooks/web/pull/4)
**Scope**: Checkout supersession + in-place pending order, Pipedrive eshop deal owner rules, strict IČO match, person + shipping line items, eshop ID field, transfer-payment „Pokračovat" button.
**Production project**: `iekkundgizzdbmkzatdl` (Supabase).

---

## TL;DR

- **3 DB migrations** must be pushed (one is already applied via agent).
- **5 Edge Functions** must be deployed (already deployed by agent — re-deploy after merge to ensure parity with `main`).
- **5 Edge Secrets** must exist in Supabase (Daniel Ondrášek + Gabriela Švédová Pipedrive `user_id`s; Pipedrive person position field key).
- **Frontend rebuild & deploy** (Vite — checkout flow, `OrderConfirmationPage`, `checkoutDraftId.ts`).
- **Pipedrive workspace** — verify custom field IDs and product codes match.
- **Smoke test** — 7 scenarios (eshop card B2C / B2B, transfer B2B, school inquiry, shipping switching, IČO new org, person create with position).

---

## 1. Database migrations

Three migrations included in this PR. Apply via `supabase db push --linked` (or CI):

| Migration | Purpose | Status on prod (as of agent run) |
|---|---|---|
| `20260508135521_orders_checkout_draft.sql` | `checkout_draft_id` column + partial index over pending | ✅ already applied |
| `20260508160000_orders_one_pending_per_draft.sql` | Partial **unique** index `(checkout_draft_id) where status='pending_payment'` + cleanup of pre-existing duplicates | ✅ already applied |

**Idempotent**: re-running `supabase db push --linked` post-merge is safe.

---

## 2. Edge Functions to deploy

All these have new code paths in this PR. CI/`supabase functions deploy ...` should redeploy them post-merge (agent already deployed them on production, but parity check after merge is recommended):

| Function | Why | Critical? |
|---|---|---|
| `make-server-93a20b6f` | All Pipedrive logic (deal owner, IČO match, person create, shipping line, eshop ID field) | **Yes** |
| `create-payment-intent` | In-place draft UPDATE, draft path before INSERT | **Yes** |
| `submit-transfer-order` | In-place draft UPDATE, transfer path | **Yes** |
| `admin-orders` | Hide superseded `cancelled` audit rows from default list | Yes |
| `stripe-webhook` | (only if shared helpers changed — unlikely) | Optional |

CI command:
```bash
supabase functions deploy \
  make-server-93a20b6f \
  create-payment-intent \
  submit-transfer-order \
  admin-orders \
  --no-verify-jwt \
  --project-ref iekkundgizzdbmkzatdl
```

---

## 3. Edge Secrets (Supabase Dashboard → Edge Functions → Secrets)

### Required for full functionality

| Secret | Value | Purpose |
|---|---|---|
| `PIPEDRIVE_ESHOP_CARD_PAID_FALLBACK_OWNER_ID` | Pipedrive `user_id` of **Daniel Ondrášek** | Fallback owner for B2B orders when org `current_deal_owner` (ID 4056) is empty. Also fallback for B2C (per code logic). |
| `PIPEDRIVE_API_TOKEN` | (existing) | Already present — verify still valid. |

### Optional (have sensible defaults baked into code)

| Secret | When to set | Purpose |
|---|---|---|
| `PIPEDRIVE_ESHOP_B2B_FALLBACK_OWNER_ID` | Only if you want a different owner than `CARD_PAID_FALLBACK` for B2B (transfer + card) | Universal B2B fallback owner |
| `PIPEDRIVE_ESHOP_B2C_OWNER_ID` | Only if B2C should go to a different person than Daniel | B2C explicit override owner |
| `PIPEDRIVE_ESHOP_FALLBACK_OWNER_ID` | Only if all the above are unset | Last-resort generic fallback |
| `PIPEDRIVE_PERSON_POSITION_FIELD_KEY` | Only if auto-detection of „pozice" custom field on Pipedrive person fails | Manual override of person field key |
| `PIPEDRIVE_ESHOP_ORDER_NUMBER_FIELD_KEY` | Only if your Pipedrive workspace has the „Eshop ID" deal field under a different hash | Default `26e4a2f8dc44e49f369c468ccc816ad668b37d92` (id 12586) |
| `PIPEDRIVE_ESHOP_SHIPPING_PRODUCT_CODE_<METHOD>` | Only if shipping products in Pipedrive catalog have non-standard codes | Defaults: `DPD` / `PPL` / `GLS` / `ZZ` (Zásilkovna) |

### Deprecated — safe to delete

- `PIPEDRIVE_ESHOP_TRANSFER_FALLBACK_OWNER_ID` (was Gabriela Švédová) — code no longer reads this. B2B transfer payments now also use `PIPEDRIVE_ESHOP_CARD_PAID_FALLBACK_OWNER_ID` (Daniel) per business decision.

---

## 4. Pipedrive workspace verification

Before flipping production traffic, verify these custom field IDs/keys exist in your Pipedrive workspace (Settings → Custom fields):

### Organization fields

- **`current deal owner`** — field id `4056`, key `7825f3fdbf7a73a202047a54a429f556a5406b81`, type `user`. Used as primary owner source for B2B deals.
- **IČO field** (key auto-detected). Should already exist.

### Deal fields

- **`Eshop ID`** — field id `12586`, key `26e4a2f8dc44e49f369c468ccc816ad668b37d92`. Will be populated with `orders.order_number` (e.g. `VB-2026-0099`).
- **`paid status` enum** — field id `12585`, key `0e41017f4d0a3aa58177d7727844f98a6569d630`, option `489` „Zaplaceno". Set on card-won deals.
- **`product category`** — key `3f0c870ac132eec72589da1313e2388977c4a74f`. Set to `print` on eshop deals.
- **Pipeline `20`** + **stage `106`** — eshop deals land here.

### Person fields

- **Position** custom field — auto-detected by name (`pozice` / `role` / `funkce` / `position` / `job title` / `titul`). If your workspace has it under a different label, set `PIPEDRIVE_PERSON_POSITION_FIELD_KEY` Edge Secret.

### Catalog products (shipping line items)

Pipedrive catalog must contain products with these SKU/codes — eshop deals add a separate product line for shipping:

| Catalog code | Maps from `orders.shipping_method` |
|---|---|
| `DPD` | `dpd` |
| `PPL` | `ppl` |
| `GLS` | `gls` |
| `ZZ` | `zasilkovna` |

If a code is missing, the shipping line is silently skipped (warning in Edge log) — deal still goes through with regular items only.

---

## 5. Frontend (Vite build)

Files touched in `src/`:

- `src/components/checkout/CheckoutPage.tsx` — `checkoutDraftId` posted to backend, 600ms debounce, „Pokračovat" button doubles as transfer submit at step 4.
- `src/components/checkout/OrderConfirmationPage.tsx` — clears draft id from `sessionStorage` after thank-you.
- `src/utils/checkoutDraftId.ts` — new utility for per-tab UUID.

Standard build & deploy:
```bash
npm install
npm run build           # → docs/ output (GitHub Pages)
git add docs/ && git commit -m "build: …"   # only if you're using docs/ as deploy target
```

(or whatever your usual GitHub Pages / hosting flow is — consult `docs/DEPLOYMENT.md`).

---

## 6. Smoke test (post-deploy)

Run on production. Use a real test customer (or clean up Pipedrive deals afterwards).

| # | Scenario | Expected DB state | Expected Pipedrive state |
|---|---|---|---|
| 1 | **B2C card** (no IČO, no school) | 1 row `paid` | Deal `won`, owner = **Daniel**, no org, person without org_id |
| 2 | **B2B card with existing org IČO** | 1 row `paid` | Deal `won`, owner from `current_deal_owner` (or **Daniel** fallback), org matched by IČO |
| 3 | **B2B card with new IČO** (no Pipedrive org yet) | 1 row `paid` | **New org created** (IČO + name + address), deal `won`, owner Daniel |
| 4 | **B2B transfer** | 1 row `paid` | Deal `open`, owner from `current_deal_owner` (or **Daniel** fallback — was Gabriela before this PR) |
| 5 | **Switch shipping multiple times then pay card** | **1 row** `paid` (no `cancelled` audit rows) | 1 deal with current shipping/total |
| 6 | **Switch Stripe ↔ Transfer ↔ Stripe then pay card** | **1 row** `paid` | 1 deal with current values |
| 7 | **School inquiry form** (`/objednat`) with position filled | 1 row `paid` | Deal in school pipeline, person has `position` custom field set |

### How to verify

- **Admin orders list** (`/admin/objednavky`): default view should show **only the active row** for each draft. Click filter „Problémy" to see superseded audit rows (if any pre-PR data still exists).
- **Order detail → Events**: should contain `draft_updated` audit entries when checkout was modified mid-draft.
- **Pipedrive deal**:
  - Deal title format: `{personName} + e-shop B2C` or `{schoolName} + e-shop B2B`
  - Custom field „Eshop ID" = `VB-2026-NNNN`
  - Product list: order items + shipping product (e.g. `DPD`, `ZZ`)
  - Owner = expected user
- **Edge Function logs** (Supabase Dashboard → Functions → make-server-93a20b6f → Logs):
  - `[Pipedrive eshop b2c_card_won (B2C jednotlivec → Daniel)] owner z explicitního overrideu: user_id=…`
  - `[Pipedrive eshop b2b_card_won (B2B → org pole / Daniel)] owner z org pole current_deal_owner (ID 4056): user_id=…`
  - `[Pipedrive] Org create (strictIco=true): name="…" ico="…" address="…"`
  - `[Pipedrive] Person create: name="…" email="…" phone="…" position="…" org_id=…`
  - `[Pipedrive eshop] eshop ID pole = VB-2026-NNNN`
  - `[Pipedrive eshop] shipping line added: code=DPD pd_product_id=… price=89`
  - `[create-payment-intent] Draft updated in-place: order=… draft=… new_pi=pi_… old_pi=pi_…`
  - `[submit-transfer-order] Draft updated in-place: order=… draft=… total=…`

---

## 7. What to monitor first 24 h

- **Order count anomalies** — should drop to ~1 row per real order (vs 2-4 before). Compare with previous week's `select count(*) from orders where created_at > now() - interval '1 day'`.
- **Pipedrive deal owner distribution** — most B2B deals should now go to either the org's `current_deal_owner` or Daniel. No deals should silently land on the API token holder unless intentional.
- **Pipedrive new orgs** — verify newly-created orgs have IČO populated (custom field) + correct name/address. Check Stripe Dashboard for any `payment_intent.failed` storms (would indicate in-place UPDATE PI replacement issue).
- **Edge log warnings** to look out for:
  - `[Pipedrive eshop] skip shipping line: Pipedrive product code="ZZ" not found` → catalog product missing, contact Pipedrive admin.
  - `[create-payment-intent] Cancel old draft PI failed: …` → benign if Stripe PI was already in non-cancellable state, but watch for repeating patterns.
  - `[Pipedrive] Person position field auto: key=… name="…"` → confirms position field detection. If absent and position is being sent, set `PIPEDRIVE_PERSON_POSITION_FIELD_KEY`.

---

## 8. Rollback plan

If a critical regression appears, **revert in this order**:

1. **Edge Functions** — re-deploy `create-payment-intent`, `submit-transfer-order`, `admin-orders`, `make-server-93a20b6f` from `main` (the pre-merge commit).
2. **Frontend** — re-deploy previous build.
3. **DB** — migrations are additive (only `add column if not exists` + `create unique index if not exists`); leaving them in place is safe even with rolled-back code. The unique index on `(checkout_draft_id) where status='pending_payment'` would only break if old code tries to INSERT 2+ pending rows with same draft id — old code didn't even know about `checkout_draft_id`, so it always wrote NULL → unique index allows multiple NULLs → no conflict.
4. **Edge Secrets** — leave as-is; they're only read by new code.

In case the in-place UPDATE causes Stripe PI issues for ongoing checkouts, hot-fix would be to short-circuit `findExistingDraftOrder` to always return `null` in `create-payment-intent` and `submit-transfer-order` — that drops the new code path back to INSERT + supersession (the previous behavior).

---

## 9. Known caveats / things to communicate to the team

1. **Pipedrive `PIPEDRIVE_ESHOP_TRANSFER_FALLBACK_OWNER_ID` (Gabriela) is no longer used** — B2B transfers now go to Daniel. Coordinate with sales (Gabriela) so she expects the change.
2. **Apple Pay button** doesn't appear in non-Safari browsers — that's by design (Stripe falls back to card form). Don't treat it as a bug. For testing Apple Pay use real Safari on production HTTPS with Stripe-verified domain.
3. **Superseded audit rows from before this PR** still exist in DB but are now hidden from default admin list. They're accessible via `?includeSuperseded=1` URL param or filter „Problémy". If desired, run a cleanup `delete from public.orders where status='cancelled' and cancelled_reason='Superseded by new checkout attempt'` after a grace period.
4. **In-place UPDATE preserves `order_number`** — link in confirmation emails / „Pokračovat v platbě" stays valid through the entire checkout draft, even if user switches shipping/payment method multiple times.
5. **`order_events` table now records `draft_updated` events** — these are useful for support („what was the customer doing before they paid?"). Admin order detail Events tab shows them in chronological order.

---

## 10. Useful commands

```bash
# Verify migrations applied
npx supabase migration list --linked

# Apply pending migrations
npx supabase db push --linked

# Deploy all changed Edge Functions
npx supabase functions deploy \
  make-server-93a20b6f create-payment-intent submit-transfer-order admin-orders \
  --no-verify-jwt --project-ref iekkundgizzdbmkzatdl

# Inspect Edge logs (in Supabase Dashboard or via CLI)
npx supabase functions logs make-server-93a20b6f --project-ref iekkundgizzdbmkzatdl

# Quick DB check post-deploy
psql "$DATABASE_URL" -c "
  select status, count(*)
  from public.orders
  where created_at > now() - interval '1 hour'
  group by status order by count desc;"
```

---

**Author**: Cloud Agent (cursor/updates-pipedrive-order-duplicates-c6d6 branch)
**Date**: 2026-05-08
