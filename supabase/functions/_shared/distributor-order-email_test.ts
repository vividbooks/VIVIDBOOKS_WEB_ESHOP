/** deno test --no-check --node-modules-dir=none supabase/functions/_shared/distributor-order-email_test.ts */
import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  DISTRIBUTOR_NO_PROMISE_TEXT,
  DISTRIBUTOR_SALES_REP_TEXT,
  DISTRIBUTOR_SHIP_24H_TEXT,
  distributorOrderEmailLeadSentences,
  distributorOrderEmailSubject,
  distributorOrderEmailVariant,
  distributorShip24hEligible,
  distributorSummaryEmailSent,
} from './distributor-order-email.ts';

const KNOWN_CZ = { knownDistributor: true, country: 'CZ', subtotalHaler: 1_250_000 };

Deno.test('text 24 h přesně podle zadání (pracovní dny, „zpravidla“, faktura e-mailem)', () => {
  assertEquals(
    DISTRIBUTOR_SHIP_24H_TEXT,
    'Děkujeme, objednávku jsme přijali. Zásilku odešleme zpravidla do 24 hodin (v pracovní dny), fakturu vám pošleme e-mailem.',
  );
});

Deno.test('varianta 1: Pipedrive vypnutý + objednávka podle pravidel → jen slib 24 h, bez obchodního zástupce', () => {
  const v = distributorOrderEmailVariant({ salesRepFollowUp: false, ship24h: distributorShip24hEligible(KNOWN_CZ) });
  assertEquals(v, 'ship24h');
  const lead = distributorOrderEmailLeadSentences(v).join(' ');
  assert(lead.includes('do 24 hodin'));
  assert(!/obchodní zástupce/.test(lead));
});

Deno.test('varianta 2: Pipedrive zapnutý + objednávka podle pravidel → slib 24 h i obchodní zástupce', () => {
  const v = distributorOrderEmailVariant({ salesRepFollowUp: true, ship24h: distributorShip24hEligible(KNOWN_CZ) });
  assertEquals(v, 'ship24h_sales_rep');
  assertEquals(distributorOrderEmailLeadSentences(v), [DISTRIBUTOR_SHIP_24H_TEXT, DISTRIBUTOR_SALES_REP_TEXT]);
});

Deno.test('varianta 3: mimo pravidla → původní text bez slibu 24 h', () => {
  const outside = [
    { ...KNOWN_CZ, knownDistributor: false },
    { ...KNOWN_CZ, subtotalHaler: 5_000_001 },
    { ...KNOWN_CZ, country: 'SK' },
    { ...KNOWN_CZ, subtotalHaler: 0 },
    { ...KNOWN_CZ, subtotalHaler: null },
  ];
  for (const input of outside) {
    assertEquals(distributorShip24hEligible(input), false, JSON.stringify(input));
    const withRep = distributorOrderEmailLeadSentences(distributorOrderEmailVariant({ salesRepFollowUp: true, ship24h: false }));
    const noRep = distributorOrderEmailLeadSentences(distributorOrderEmailVariant({ salesRepFollowUp: false, ship24h: false }));
    assertEquals(withRep, [DISTRIBUTOR_SALES_REP_TEXT]);
    assertEquals(noRep, [DISTRIBUTOR_NO_PROMISE_TEXT]);
    assert(!withRep.join(' ').includes('24 hodin') && !noRep.join(' ').includes('24 hodin'));
  }
  /** Přesně 50 000 Kč ještě projde, chybějící země = CZ (formulář jinou nepošle). */
  assertEquals(distributorShip24hEligible({ ...KNOWN_CZ, subtotalHaler: 5_000_000 }), true);
  assertEquals(distributorShip24hEligible({ ...KNOWN_CZ, country: null }), true);
  assertEquals(distributorShip24hEligible({ ...KNOWN_CZ, country: ' cz ' }), true);
});

Deno.test('předmět: „Potvrzení objednávky VB-… – Vividbooks“', () => {
  assertEquals(distributorOrderEmailSubject('VB-2026-0623'), 'Potvrzení objednávky VB-2026-0623 – Vividbooks');
});

Deno.test('odeslané shrnutí se pozná i z jsonb řetězce, chyba se nepočítá', () => {
  assertEquals(distributorSummaryEmailSent(null), false);
  assertEquals(distributorSummaryEmailSent([]), false);
  assertEquals(
    distributorSummaryEmailSent([{ details: JSON.stringify({ emailType: 'distributor_order_received', error: 'x' }) }]),
    false,
  );
  assertEquals(distributorSummaryEmailSent([{ details: { emailType: 'order_confirmed', subject: 's' } }]), false);
  assertEquals(distributorSummaryEmailSent([{ details: '{rozbité' }]), false);
  assertEquals(
    distributorSummaryEmailSent([{ details: JSON.stringify({ emailType: 'distributor_order_received', subject: 'S' }) }]),
    true,
  );
  assertEquals(distributorSummaryEmailSent([{ details: { emailType: 'distributor_order_received', subject: 'S' } }]), true);
});
