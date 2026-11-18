/**
 * Prahy pravidel pro návrhy optimalizace. Vytáhnuté z `growthProposals.ts`,
 * aby šly testovat bez databáze.
 */

export type Aggregate = {
  /** cena v mikrojednotkách měny (1 Kč = 1 000 000) */
  cost: number;
  clicks: number;
  conv: number;
  impr: number;
};

export const RULES = {
  pauseKeyword: { minCostMicros: 5_000_000, maxConversions: 0, minClicks: 10 },
  addNegative: { minCostMicros: 2_000_000, maxConversions: 0, minClicks: 5 },
  lowCtr: { minImpressions: 1000, maxCtr: 0.01 },
} as const;

/** Klíčové slovo utrácí, nekonvertuje a má dost kliků → pauznout. */
export function shouldPauseKeyword(a: Aggregate): boolean {
  const r = RULES.pauseKeyword;
  return a.cost >= r.minCostMicros && a.conv === r.maxConversions && a.clicks >= r.minClicks;
}

/** Vyhledávaný výraz utrácí, nekonvertuje a má dost kliků → přidat jako negativní. */
export function shouldAddNegative(a: Aggregate): boolean {
  const r = RULES.addNegative;
  return a.cost >= r.minCostMicros && a.conv === r.maxConversions && a.clicks >= r.minClicks;
}

/** Kampaň má dost zobrazení a nízké CTR → jen upozornit, nic neměnit. */
export function isLowCtr(a: Pick<Aggregate, 'impr' | 'clicks'>): boolean {
  const r = RULES.lowCtr;
  if (a.impr < r.minImpressions) return false;
  return a.clicks / a.impr < r.maxCtr;
}

/** Identita návrhu pro deduplikaci. */
export function proposalKey(type: string, entityId: string): string {
  return `${type}:${entityId}`;
}

/** Aplikovaný návrh se znovu nenavrhuje `days` dní. */
export function isRecentApplied(appliedAt: string | null | undefined, now: Date = new Date(), days = 14): boolean {
  if (!appliedAt) return false;
  const t = new Date(appliedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < days * 24 * 60 * 60 * 1000;
}
