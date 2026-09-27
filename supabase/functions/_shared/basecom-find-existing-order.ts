/**
 * Pojistka proti dvojímu exportu objednávky do Base (BaseLinker).
 *
 * `addOrder` může v Base proběhnout, a worker přitom odpověď nedostane (timeout, pád funkce). Položka fronty pak
 * zůstane ve stavu `processing`, po 15 minutách se vrátí do `pending` a export by objednávku založil podruhé.
 * Před `addOrder` proto zkontrolujeme, jestli už v Base není objednávka se stejným číslem z e‑shopu
 * (`extra_field_1` = `orders.order_number`, plníme ho při každém exportu).
 */

export type BaseOrderLookupRow = {
  order_id?: number | string | null;
  extra_field_1?: string | null;
};

/** Číslo objednávky pro porovnání: bez mezer kolem, bez ohledu na velikost písmen, max 50 znaků (limit pole v Base). */
export function normalizeBaseOrderReference(value: unknown): string {
  return String(value ?? '').trim().slice(0, 50).toLowerCase();
}

/**
 * Najde v seznamu objednávek z Base tu, která patří k číslu objednávky z e‑shopu.
 * Vrací ID objednávky v Base jako řetězec, nebo null. Při více shodách bere nejstarší (nejnižší ID) – to je ta původní.
 */
export function findExistingBaseOrderId(orders: readonly BaseOrderLookupRow[] | null | undefined, orderNumber: unknown): string | null {
  const wanted = normalizeBaseOrderReference(orderNumber);
  if (!wanted || !Array.isArray(orders)) return null;
  const ids = orders
    .filter((o) => normalizeBaseOrderReference(o?.extra_field_1) === wanted)
    .map((o) => Number(o?.order_id))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  return ids.length ? String(ids[0]) : null;
}

/** Parametry `getOrders`: objednávky daného zákazníka od dne před vznikem objednávky, včetně nepotvrzených. */
export function buildExistingBaseOrderLookupParams(order: { created_at: string | Date; customer_email?: string | null }): Record<string, unknown> {
  const createdMs = new Date(order.created_at).getTime();
  const from = Number.isFinite(createdMs) ? Math.floor(createdMs / 1000) - 86400 : Math.floor(Date.now() / 1000) - 30 * 86400;
  const params: Record<string, unknown> = { date_from: from, get_unconfirmed_orders: true };
  const email = String(order.customer_email ?? '').trim();
  if (email) params.filter_email = email;
  return params;
}
