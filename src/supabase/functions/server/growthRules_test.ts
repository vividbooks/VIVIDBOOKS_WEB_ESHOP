/**
 * Testy pravidel návrhového enginu — bez databáze a bez Google Ads.
 * Spuštění: `deno test src/supabase/functions/server/growthRules_test.ts`
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  RULES,
  proposalKey,
  shouldPauseKeyword,
  shouldAddNegative,
  isLowCtr,
  isRecentApplied,
} from './growthRules.ts';

const kw = (over: Partial<{ cost: number; clicks: number; conv: number; impr: number }> = {}) => ({
  cost: 10_000_000,
  clicks: 20,
  conv: 0,
  impr: 2000,
  ...over,
});

Deno.test('pause_keyword: utrácí, nekonvertuje, dost kliků', () => {
  assertEquals(shouldPauseKeyword(kw()), true);
});

Deno.test('pause_keyword: nesmí pauznout, když má konverzi', () => {
  assertEquals(shouldPauseKeyword(kw({ conv: 1 })), false);
});

Deno.test('pause_keyword: nesmí pauznout při nízké útratě', () => {
  assertEquals(shouldPauseKeyword(kw({ cost: RULES.pauseKeyword.minCostMicros - 1 })), false);
});

Deno.test('pause_keyword: nesmí pauznout při málo klicích', () => {
  assertEquals(shouldPauseKeyword(kw({ clicks: RULES.pauseKeyword.minClicks - 1 })), false);
});

Deno.test('add_negative: utrácí, nekonvertuje, dost kliků', () => {
  assertEquals(shouldAddNegative(kw({ cost: 3_000_000, clicks: 6 })), true);
});

Deno.test('add_negative: nesmí přidat při málo klikách', () => {
  assertEquals(shouldAddNegative(kw({ cost: 3_000_000, clicks: 4 })), false);
});

Deno.test('add_negative: nesmí přidat, když výraz konvertuje', () => {
  assertEquals(shouldAddNegative(kw({ cost: 3_000_000, clicks: 6, conv: 2 })), false);
});

Deno.test('low_ctr: nízké CTR při dost zobrazeních', () => {
  assertEquals(isLowCtr({ impr: 2000, clicks: 10 }), true);
});

Deno.test('low_ctr: nehlásí při málo zobrazeních', () => {
  assertEquals(isLowCtr({ impr: 500, clicks: 1 }), false);
});

Deno.test('low_ctr: nehlásí při zdravém CTR', () => {
  assertEquals(isLowCtr({ impr: 2000, clicks: 60 }), false);
});

Deno.test('deduplikace: klíč je typ + entita', () => {
  assertEquals(proposalKey('add_negative', 'mock_1:fyzika'), 'add_negative:mock_1:fyzika');
});

Deno.test('aplikovaný návrh se 14 dní nenavrhuje znovu', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  assertEquals(isRecentApplied('2026-11-10T12:00:00Z', now), true);
  assertEquals(isRecentApplied('2026-10-10T12:00:00Z', now), false);
  assertEquals(isRecentApplied(null, now), false);
});
