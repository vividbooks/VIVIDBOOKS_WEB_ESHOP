/**
 * Supersession pending objednávek pro daný `checkout_draft_id`.
 *
 * Když uživatel v pokladně přepne dopravu (DPD → Zásilkovna → GLS → …) nebo přepne mezi Stripe a
 * převodem, frontend pošle nový POST na create-payment-intent / submit-transfer-order, který založí
 * další `pending_payment` řádek (jiný idempotency_key — jiný hash košíku). Tato funkce při INSERT nového
 * řádku rovnou označí všechny předchozí pending objednávky téhož draftu jako `cancelled`, aby v adminu
 * nezůstávaly viset duplicity 21 dní (do `cancel-stale-orders`).
 */
// `postgres-js` typy nejsou pro Deno potřeba importovat — stačí strukturální typ tagged-template
// callable, který vyhovuje jak top-level `Sql`, tak `TransactionSql` v `sql.begin`.
type TaggedSql = {
  <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type SupersededOrder = {
  id: string;
  stripe_payment_intent_id: string | null;
  order_number: string | null;
};

export const SUPERSEDED_REASON = 'Superseded by new checkout attempt';

/**
 * Označí starší `pending_payment` objednávky stejného draftu jako `cancelled` a zaloguje order_event.
 * Volá se uvnitř transakce (`sql.begin`), aby supersession byla atomická s INSERT nové objednávky.
 *
 * Vrací zrušené řádky (s případným `stripe_payment_intent_id`), aby je volající mohl best-effort
 * zrušit i ve Stripe (uvolnit autorizaci na kartě).
 */
export async function cancelSupersededPendingOrders(
  tx: TaggedSql,
  draftId: string,
  keepOrderId: string,
  reason: string = SUPERSEDED_REASON,
): Promise<SupersededOrder[]> {
  const draft = (draftId || '').trim();
  if (!draft || !keepOrderId) return [];

  const rows = await tx<SupersededOrder[]>`
    update public.orders
    set
      status = 'cancelled',
      cancelled_at = now(),
      cancelled_reason = ${reason},
      updated_at = now()
    where checkout_draft_id = ${draft}
      and status = 'pending_payment'
      and id <> ${keepOrderId}::uuid
    returning id, stripe_payment_intent_id, order_number
  `;

  for (const row of rows) {
    await tx`
      insert into public.order_events (
        order_id,
        event_type,
        from_status,
        to_status,
        details,
        actor
      ) values (
        ${row.id}::uuid,
        'auto_cancel',
        'pending_payment',
        'cancelled',
        ${JSON.stringify({ reason: 'superseded', supersededBy: keepOrderId })}::jsonb,
        'system'
      )
    `;
  }

  return rows;
}

/**
 * Best-effort zrušení Stripe PaymentIntentů přes REST API (bez Stripe SDK — submit-transfer-order ho
 * nepoužívá a nemá smysl ho kvůli tomu nahrávat). Selhání jen logujeme — typicky 400 „PI cannot be
 * canceled" (succeeded / already canceled / requires_capture) je očekávaný stav.
 */
export async function cancelStripePaymentIntentsBestEffort(
  paymentIntentIds: ReadonlyArray<string | null | undefined>,
  stripeSecretKey: string,
  contextTag: string = 'cancel-superseded-orders',
): Promise<void> {
  const ids = paymentIntentIds
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter((id): id is string => id.length > 0);

  if (ids.length === 0) return;
  const key = (stripeSecretKey || '').trim();
  if (!key) {
    console.warn(`[${contextTag}] Skipping PI cancel — STRIPE_SECRET_KEY missing.`);
    return;
  }

  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(
        `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'cancellation_reason=abandoned',
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`[${contextTag}] PI cancel HTTP ${res.status} ${id}: ${body.slice(0, 240)}`);
      }
    } catch (e) {
      console.warn(`[${contextTag}] PI cancel failed ${id}:`, e);
    }
  }));
}
