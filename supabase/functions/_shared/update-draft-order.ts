/**
 * Společné utility pro **in-place update** existujícího `pending_payment` řádku
 * stejného `checkout_draft_id` v `create-payment-intent` a `submit-transfer-order`.
 *
 * Účel: pro daný draft existuje vždy max 1 řádek (garantováno migrací
 * `20260508160000_orders_one_pending_per_draft.sql` přes partial unique index).
 * Když uživatel mezi pokusy o zaplacení změní košík/dopravu/zákazníka, neudělá
 * se INSERT + supersession, ale UPDATE existujícího — `id`, `order_number` a
 * `payment_resume_token` přežijí, takže odkazy mailů / „Pokračovat v platbě"
 * tlačítka stále vedou na stejnou objednávku.
 */

type TaggedSql = {
  <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type DraftOrderRow = {
  id: string;
  order_number: string | null;
  payment_resume_token: string | null;
  stripe_payment_intent_id: string | null;
  idempotency_key: string | null;
  total: number | null;
  payment_method: string | null;
  status: string;
  checkout_session_id: string | null;
};

/**
 * Načte případnou existující `pending_payment` objednávku stejného draftu.
 * Vrací nejnovější (i když by se díky unique indexu měla najít max jedna).
 */
export async function findExistingDraftOrder(
  sql: TaggedSql,
  draftId: string,
): Promise<DraftOrderRow | null> {
  const draft = String(draftId || '').trim();
  if (!draft) return null;
  const rows = await sql<DraftOrderRow[]>`
    select
      id,
      order_number,
      payment_resume_token,
      stripe_payment_intent_id,
      idempotency_key,
      total,
      payment_method,
      status,
      checkout_session_id
    from public.orders
    where checkout_draft_id = ${draft}
      and status = 'pending_payment'
    order by created_at desc
    limit 1
    for update
  `;
  return rows[0] || null;
}

export type CheckoutItemForUpdate = {
  productId: string;
  productName: string;
  variant?: string | null;
  quantity: number;
  unitPrice: number;
  bundleId?: string | null;
  bundleTitle?: string | null;
};

/**
 * Smaže existující `order_items` daného řádku a založí je znovu z aktuálního košíku.
 * Položky se nedají bezpečně updatovat in-place (uživatel mohl jeden produkt
 * odebrat a jiný přidat — variant/bundle změny by byly spletité), proto
 * delete + insert v jedné transakci.
 */
export async function replaceDraftOrderItems(
  tx: TaggedSql,
  orderId: string,
  items: ReadonlyArray<CheckoutItemForUpdate>,
): Promise<void> {
  await tx`delete from public.order_items where order_id = ${orderId}::uuid`;
  for (const item of items) {
    const variant = typeof item.variant === 'string' && item.variant.trim()
      ? item.variant.trim()
      : null;
    const bundleId = typeof item.bundleId === 'string' && item.bundleId.trim()
      ? item.bundleId.trim()
      : null;
    const bundleTitle = typeof item.bundleTitle === 'string' && item.bundleTitle.trim()
      ? item.bundleTitle.trim()
      : null;
    await tx`
      insert into public.order_items (
        order_id,
        product_id,
        product_name,
        variant,
        quantity,
        unit_price,
        total_price,
        bundle_id,
        bundle_title
      ) values (
        ${orderId}::uuid,
        ${item.productId},
        ${item.productName},
        ${variant},
        ${item.quantity},
        ${item.unitPrice},
        ${item.unitPrice * item.quantity},
        ${bundleId},
        ${bundleTitle}
      )
    `;
  }
}

/**
 * Audit záznam o tom, co se v draftu změnilo (pro debugging — admin v detailu
 * objednávky uvidí časovou osu, jak se měnily PI / částka / doprava).
 */
export async function recordDraftUpdatedEvent(
  tx: TaggedSql,
  params: {
    orderId: string;
    actor: 'customer' | 'system';
    details: Record<string, unknown>;
  },
): Promise<void> {
  await tx`
    insert into public.order_events (
      order_id,
      event_type,
      from_status,
      to_status,
      details,
      actor
    ) values (
      ${params.orderId}::uuid,
      'draft_updated',
      'pending_payment',
      'pending_payment',
      ${JSON.stringify(params.details)}::jsonb,
      ${params.actor}
    )
  `;
}
