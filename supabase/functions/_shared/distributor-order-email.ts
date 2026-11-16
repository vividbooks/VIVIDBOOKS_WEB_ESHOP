/**
 * Text potvrzovacího e-mailu distributorské objednávky (`distributor_order_received`).
 *
 * Slib „zásilku odešleme zpravidla do 24 hodin (v pracovní dny)“ dostane jen objednávka,
 * kterou dnes automat nebo obchodník vyřídí podle pravidel (schváleno Danem 15. 11. 2026):
 *   - známý distributor = stejné IČO už má dřívější distributorskou objednávku (nezrušenou),
 *   - doručení v ČR (Kč),
 *   - součet z katalogových cen ≤ 50 000 Kč (limit automatu je 50 000 Kč bez DPH po slevě;
 *     katalogová cena před slevou je vždy vyšší nebo stejná, takže nad limit slib nikdy nedáme).
 * Ostatní (nový distributor, nad limit, mimo ČR) dostanou původní text bez slibu 24 h.
 *
 * Pipedrive přepínač (`distributor_pipedrive_sync`):
 *   - zapnutý = deal dořeší obchodník → věta „Ozve se vám obchodní zástupce…“ zůstává,
 *   - vypnutý = objednávku odbaví automat v CRM → věta o obchodním zástupci se vynechá.
 *
 * Testy: `deno test --no-check supabase/functions/_shared/distributor-order-email_test.ts`
 */

/** Limit automatu v haléřích (50 000 Kč). */
export const DISTRIBUTOR_SHIP_24H_LIMIT_HALER = 5_000_000;

export const DISTRIBUTOR_SHIP_24H_TEXT =
  'Děkujeme, objednávku jsme přijali. Zásilku odešleme zpravidla do 24 hodin (v pracovní dny), fakturu vám pošleme e-mailem.';

export const DISTRIBUTOR_SALES_REP_TEXT =
  'Ozve se vám obchodní zástupce Vividbooks a dořeší ceny, dopravu i další detaily.';

export const DISTRIBUTOR_NO_PROMISE_TEXT =
  'Objednávku zpracujeme, fakturu vám pošleme e-mailem a zásilku odešleme na uvedenou doručovací adresu.';

/**
 * - `ship24h`            Pipedrive vypnutý, objednávka podle pravidel → jen slib 24 h
 * - `ship24h_sales_rep`  Pipedrive zapnutý, objednávka podle pravidel → slib 24 h + obchodní zástupce
 * - `sales_rep`          Pipedrive zapnutý, mimo pravidla → původní text (obchodní zástupce)
 * - `no_promise`         Pipedrive vypnutý, mimo pravidla → původní text bez obchodního zástupce
 */
export type DistributorOrderEmailVariant = 'ship24h' | 'ship24h_sales_rep' | 'sales_rep' | 'no_promise';

export type DistributorShip24hInput = {
  /** Stejné IČO má dřívější nezrušenou distributorskou objednávku. */
  knownDistributor: boolean;
  /** `orders.country` (distributorský formulář dnes posílá jen CZ). */
  country: string | null | undefined;
  /** `orders.subtotal` v haléřích (katalogové ceny, před distributorskou slevou). */
  subtotalHaler: number | null | undefined;
};

export function distributorShip24hEligible(input: DistributorShip24hInput): boolean {
  const country = String(input.country ?? 'CZ').trim().toUpperCase() || 'CZ';
  const subtotal = Number(input.subtotalHaler);
  return input.knownDistributor === true
    && country === 'CZ'
    && Number.isFinite(subtotal)
    && subtotal > 0
    && subtotal <= DISTRIBUTOR_SHIP_24H_LIMIT_HALER;
}

export function distributorOrderEmailVariant(opts: {
  salesRepFollowUp: boolean;
  ship24h: boolean;
}): DistributorOrderEmailVariant {
  if (opts.ship24h) return opts.salesRepFollowUp ? 'ship24h_sales_rep' : 'ship24h';
  return opts.salesRepFollowUp ? 'sales_rep' : 'no_promise';
}

/** Úvodní věty pod nadpisem (prostý text, HTML escapuje volající). */
export function distributorOrderEmailLeadSentences(variant: DistributorOrderEmailVariant): string[] {
  switch (variant) {
    case 'ship24h':
      return [DISTRIBUTOR_SHIP_24H_TEXT];
    case 'ship24h_sales_rep':
      return [DISTRIBUTOR_SHIP_24H_TEXT, DISTRIBUTOR_SALES_REP_TEXT];
    case 'sales_rep':
      return [DISTRIBUTOR_SALES_REP_TEXT];
    case 'no_promise':
    default:
      return [DISTRIBUTOR_NO_PROMISE_TEXT];
  }
}

export function distributorOrderEmailHasShip24h(variant: DistributorOrderEmailVariant): boolean {
  return variant === 'ship24h' || variant === 'ship24h_sales_rep';
}

export function distributorOrderEmailSubject(orderNumber: string): string {
  return `Potvrzení objednávky ${String(orderNumber || '').trim()} – Vividbooks`;
}

/**
 * Je k objednávce už úspěšně odeslané shrnutí? `details` u e-mailových událostí bývá jsonb
 * *řetězec* (send-order-email ukládá `JSON.stringify(...)::jsonb`), proto se případně parsuje.
 */
export function distributorSummaryEmailSent(events: Array<{ details?: unknown }> | null | undefined): boolean {
  for (const ev of events || []) {
    let d: unknown = ev?.details;
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch {
        continue;
      }
    }
    if (!d || typeof d !== 'object') continue;
    const rec = d as Record<string, unknown>;
    if (rec.emailType === 'distributor_order_received' && !rec.error) return true;
  }
  return false;
}
