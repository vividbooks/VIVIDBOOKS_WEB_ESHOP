import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { parsePresenceValue, presenceFirstName } from '../src/lib/vividbooksPresence.ts';
import {
  appEntryTargetUrl,
  forgetAppEntryChoice,
  parseAppEntryChoice,
  readAppEntryChoice,
  rememberAppEntryChoice,
} from '../src/lib/appEntryChoice.ts';

import { computeOrderTrackingToken, verifyOrderTrackingToken } from '../supabase/functions/_shared/order-tracking-token.ts';
import { BASE_COMPANY_MAX_LENGTH, trimCompanyNameForBase } from '../supabase/functions/_shared/base-company-name.ts';
import {
  enrichCzechAddressParts,
  geocodeFreeFormAddressViaGoogle,
  looksLikeRegionName,
  parseFreeFormAddress,
  preferStreetWithHouseNumber,
  streetHasHouseNumber,
} from '../supabase/functions/_shared/czech-address-enrichment.ts';
import { orgAddressLine, personPostalLine } from '../supabase/functions/_shared/pipedrive-address.ts';
import {
  distributorContactPersonName,
  looksLikeLegalEntityName,
} from '../supabase/functions/_shared/pipedrive-distributor-person.ts';
import {
  allocateSubjectBundleQuantities,
  subjectBundleQtySummary,
  subjectBundleSelectionPaidListSumHaler,
  type ProductBundleRecord,
} from '../src/utils/bundlePricing.ts';
import {
  computeEffectiveStockQuantity,
  parseSellableWarehouseQuantity,
  resolveStockLookupSku,
} from '../supabase/functions/_shared/stock-quantity.ts';
import { sanitizeMerchVariantSkus } from '../src/utils/stockSku.ts';

type UnitTest = {
  name: string;
  fn: () => Promise<void> | void;
};

const tests: UnitTest[] = [];

function registerTest(name: string, fn: UnitTest['fn']) {
  tests.push({ name, fn });
}

async function run() {
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      // eslint-disable-next-line no-console
      console.log(`✅ ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`❌ ${name}`);
      console.error(error);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nTests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

registerTest('computeOrderTrackingToken is deterministic', async () => {
  const secret = 'test-secret';
  const orderId = 'order-123';

  const first = await computeOrderTrackingToken(orderId, secret);
  const second = await computeOrderTrackingToken(orderId, secret);

  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{32}$/);
});

registerTest('verifyOrderTrackingToken accepts valid token and rejects invalid token', async () => {
  const secret = 'another-secret';
  const orderId = 'order-456';

  const token = await computeOrderTrackingToken(orderId, secret);
  const ok = await verifyOrderTrackingToken(orderId, secret, token);
  assert.equal(ok, true);

  const badSecret = await verifyOrderTrackingToken(orderId, 'wrong-secret', token);
  assert.equal(badSecret, false);

  const badToken = `${token.slice(1)}a`;
  const malformed = await verifyOrderTrackingToken(orderId, secret, badToken);
  assert.equal(malformed, false);
});

registerTest('trimCompanyNameForBase keeps short names, normalizes whitespace, trims to Base limit', () => {
  assert.equal(BASE_COMPANY_MAX_LENGTH, 156);

  /** Krátký název projde beze změny. */
  assert.equal(
    trimCompanyNameForBase('Základní škola a Mateřská škola Praha 4'),
    'Základní škola a Mateřská škola Praha 4',
  );

  /** Vícenásobné mezery / odřádkování se znormalizují na jednu mezeru. */
  assert.equal(
    trimCompanyNameForBase('  Základní  škola\n Kolín,   Bezručova 980  '),
    'Základní škola Kolín, Bezručova 980',
  );

  /** Delší název než 156 znaků se ořízne přesně na limit. */
  const longName = 'Základní škola a Mateřská škola s rozšířenou výukou jazyků '.repeat(4).trim();
  assert.ok(longName.length > BASE_COMPANY_MAX_LENGTH);
  const trimmed = trimCompanyNameForBase(longName);
  assert.equal(trimmed?.length, BASE_COMPANY_MAX_LENGTH);
  assert.equal(trimmed, longName.slice(0, BASE_COMPANY_MAX_LENGTH));

  /** Prázdný / whitespace-only / null vstup vrací null. */
  assert.equal(trimCompanyNameForBase(''), null);
  assert.equal(trimCompanyNameForBase('   '), null);
  assert.equal(trimCompanyNameForBase(null), null);
  assert.equal(trimCompanyNameForBase(undefined), null);
});

registerTest('workflow promote-main-to-production.yml contains manual promote safeguards', () => {
  const workflowPath = resolve(process.cwd(), '.github/workflows/promote-main-to-production.yml');
  const raw = readFileSync(workflowPath, 'utf8');

  assert.ok(/on:\n\s*workflow_dispatch:/m.test(raw), 'workflow_dispatch trigger is present');
  assert.ok(/required:\s*true/.test(raw), 'manual inputs include required fields');
  assert.ok(/release_tag:/.test(raw), 'release_tag input exists');
  assert.ok(/reason:/.test(raw), 'reason input exists');
  assert.ok(/promote_strategy:/.test(raw), 'promote_strategy input exists');
  assert.ok(/git merge --no-edit origin\/main/.test(raw), 'default merge strategy uses merge commit');
  assert.ok(/git merge --ff-only origin\/main/.test(raw), 'ff-only strategy is supported');
  assert.ok(/Create release tag/.test(raw), 'release tag step exists');
  assert.ok(/Audit summary/.test(raw), 'audit summary step exists');
});

registerTest('allocateSubjectBundleQuantities applies 10+1 bonus per title (set size = paidItemCount)', () => {
  /**
   * Akce 10+1: paidItemCount=10 = velikost sady (počet ks v košíku spouštějící bonus),
   * freeItemCount=1 = ks zdarma v sadě. Tj. na každých 10 ks téhož titulu 1 zdarma (zaplatí 9).
   * Mix titulů NESMÍ vygenerovat bonus.
   */
  const bundle: ProductBundleRecord = {
    id: 'b1',
    title: 'Matematika 2. stupeň — 10+1',
    productIds: [],
    bundlePriceHaler: 0,
    bundleKind: 'nx_plus_one_subject',
    bundleSubjectLabels: ['Matematika 2. stupeň'],
    paidItemCount: 10,
    freeItemCount: 1,
  };

  const products = [
    {
      id: 'PM6100',
      name: 'PM6100',
      category: 'Matematika 2. stupeň',
      type: 'workbook',
      variantId: 'v-PM6100',
      priceAmount: 199,
    },
    {
      id: 'PM6200',
      name: 'PM6200',
      category: 'Matematika 2. stupeň',
      type: 'workbook',
      variantId: 'v-PM6200',
      priceAmount: 249,
    },
  ];

  /** 5+5 mix → ani jeden titul nedosáhl 10 → 0 zdarma. */
  const mix5plus5 = allocateSubjectBundleQuantities(products, bundle, { PM6100: 5, PM6200: 5 });
  assert.ok(mix5plus5, 'allocate should not return null for valid selection');
  assert.equal(mix5plus5!.length, 10, '10 jednotek dohromady');
  assert.equal(mix5plus5!.filter((u) => u.isFree).length, 0, 'mix titulů: 0 ks zdarma');

  /** 10 ks PM6100 → floor(10/10)=1 sada → 1 zdarma, 9 placených. */
  const tenPM6100 = allocateSubjectBundleQuantities(products, bundle, { PM6100: 10 });
  assert.ok(tenPM6100);
  assert.equal(tenPM6100!.length, 10);
  assert.equal(tenPM6100!.filter((u) => u.isFree).length, 1, '10 ks → 1 zdarma');

  /** 11 ks PM6100 → floor(11/10)=1 sada → 1 zdarma, 10 placených. */
  const elevenPM6100 = allocateSubjectBundleQuantities(products, bundle, { PM6100: 11 });
  assert.ok(elevenPM6100);
  assert.equal(elevenPM6100!.length, 11);
  assert.equal(elevenPM6100!.filter((u) => u.isFree).length, 1, '11 ks → 1 zdarma');
  assert.equal(elevenPM6100!.filter((u) => u.isFree)[0].productId, 'PM6100');

  /** 11× PM6100 + 5× PM6200 → 1 PM6100 zdarma, PM6200 plná cena (5 < 10). */
  const mixedWithSet = allocateSubjectBundleQuantities(products, bundle, { PM6100: 11, PM6200: 5 });
  assert.ok(mixedWithSet);
  assert.equal(mixedWithSet!.length, 16);
  const free = mixedWithSet!.filter((u) => u.isFree);
  assert.equal(free.length, 1, 'jen 1 zdarma');
  assert.equal(free[0].productId, 'PM6100', 'zdarma musí být z titulu, který dosáhl sady');

  /** 21× PM6100 → floor(21/10)=2 sady → 2 zdarma (regression test pro screenshot scenario). */
  const screenshotCase = allocateSubjectBundleQuantities(products, bundle, { PM6100: 21 });
  assert.ok(screenshotCase);
  assert.equal(screenshotCase!.filter((u) => u.isFree).length, 2, '21 ks → 2 zdarma');

  /** 22× PM6100 → floor(22/10)=2 sady → 2 zdarma (popis akce „22 ks → 2 zdarma“). */
  const twoSets = allocateSubjectBundleQuantities(products, bundle, { PM6100: 22 });
  assert.ok(twoSets);
  assert.equal(twoSets!.filter((u) => u.isFree).length, 2);

  /** Cena placených: 5+5 mix → katalog 5×199 + 5×249 = 224000 hal (žádný bonus). */
  const paidMix = subjectBundleSelectionPaidListSumHaler(products, bundle, { PM6100: 5, PM6200: 5 });
  assert.equal(paidMix, 5 * 19900 + 5 * 24900);

  /** Cena placených: 10× PM6100 → 9×199 = 179100 hal (1 zdarma). */
  const paidTen = subjectBundleSelectionPaidListSumHaler(products, bundle, { PM6100: 10 });
  assert.equal(paidTen, 9 * 19900, '10 ks: zaplatí za 9');

  /** Cena placených: 11× PM6100 → 10×199 = 199000 hal (1 zdarma). */
  const paidEleven = subjectBundleSelectionPaidListSumHaler(products, bundle, { PM6100: 11 });
  assert.equal(paidEleven, 10 * 19900);

  /** Cena placených: 21× PM6100 → 19×199 = 378100 hal (2 zdarma) — screenshot. */
  const paidTwentyOne = subjectBundleSelectionPaidListSumHaler(products, bundle, { PM6100: 21 });
  assert.equal(paidTwentyOne, 19 * 19900, '21 ks: zaplatí za 19 (2 zdarma)');
});

registerTest('subjectBundleQtySummary aggregates per-title counts and needs (set size = paid)', () => {
  const bundle: ProductBundleRecord = {
    id: 'b1',
    title: 'X',
    productIds: [],
    bundlePriceHaler: 0,
    bundleKind: 'nx_plus_one_subject',
    bundleSubjectLabels: ['Matematika 2. stupeň'],
    paidItemCount: 10,
    freeItemCount: 1,
  };

  /** Mix 5+5: žádný bonus; nejmenší zbývající ks pro další sadu = 10-5 = 5. */
  const s1 = subjectBundleQtySummary(bundle, { PM6100: 5, PM6200: 5 });
  assert.ok(s1);
  assert.equal(s1!.total, 10);
  assert.equal(s1!.setSize, 10, 'sada má 10 ks v košíku');
  assert.equal(s1!.paidPerSet, 9, 'placených v sadě = paid − free');
  assert.equal(s1!.freePerSet, 1);
  assert.equal(s1!.completeSets, 0);
  assert.equal(s1!.freePieces, 0);
  assert.equal(s1!.paidPieces, 10);
  assert.equal(s1!.needsForNextSet, 5, 'minimální zbývající kusů u libovolného titulu');
  assert.equal(s1!.isValidMultiple, false);

  /** 11+5: PM6100 1 sada uzavřená (zbytek 1, need=9), PM6200 zbytek 5 (need=5). Min=5. */
  const s2 = subjectBundleQtySummary(bundle, { PM6100: 11, PM6200: 5 });
  assert.ok(s2);
  assert.equal(s2!.completeSets, 1);
  assert.equal(s2!.freePieces, 1);
  assert.equal(s2!.paidPieces, 15);
  assert.equal(s2!.needsForNextSet, 5, 'PM6200 zbytek 5: 10-5 = 5');
  assert.equal(s2!.isValidMultiple, false);

  /** Čistých 20 PM6100: 2 sady, žádný zbytek, isValidMultiple=true. */
  const s3 = subjectBundleQtySummary(bundle, { PM6100: 20 });
  assert.ok(s3);
  assert.equal(s3!.completeSets, 2);
  assert.equal(s3!.freePieces, 2);
  assert.equal(s3!.paidPieces, 18);
  assert.equal(s3!.needsForNextSet, 0);
  assert.equal(s3!.isValidMultiple, true);

  /** 21 PM6100 (screenshot): 2 sady, zbytek 1, need=9, isValidMultiple=false ale 2 zdarma. */
  const s4 = subjectBundleQtySummary(bundle, { PM6100: 21 });
  assert.ok(s4);
  assert.equal(s4!.completeSets, 2);
  assert.equal(s4!.freePieces, 2, '21 ks → 2 zdarma');
  assert.equal(s4!.paidPieces, 19);
  assert.equal(s4!.needsForNextSet, 9, 'do třetí sady chybí 9 ks');

  /** Screenshot: PM6100=17, PM6200=17, PM7100=14, PM7200=14, PM8101=18, PM8201=18, PM9100=21, PM9200=21
      → 2+2+1+1+1+1+1+1 = NEFUN... počítám per titul:
      17→1, 17→1, 14→1, 14→1, 18→1, 18→1, 21→2, 21→2 → 10 free; min(7,7,4,4,8,8,1,1)→need 10-8=2. */
  const sScreenshot = subjectBundleQtySummary(bundle, {
    a: 17, b: 17, c: 14, d: 14, e: 18, f: 18, g: 21, h: 21,
  });
  assert.ok(sScreenshot);
  assert.equal(sScreenshot!.total, 140);
  assert.equal(sScreenshot!.freePieces, 10, 'celkem 10 zdarma napříč tituly');
  assert.equal(sScreenshot!.paidPieces, 130);
  assert.equal(sScreenshot!.needsForNextSet, 2, 'min remainder: 18%10=8 → need=2');
});

registerTest('deploy-edge-functions.yml has protected deploy requirements', () => {
  const workflowPath = resolve(process.cwd(), '.github/workflows/deploy-edge-functions.yml');
  const raw = readFileSync(workflowPath, 'utf8');

  assert.ok(/workflow_dispatch:/.test(raw), 'workflow supports manual dispatch');
  assert.ok(/SUPABASE_ACCESS_TOKEN/.test(raw), 'SUPABASE_ACCESS_TOKEN secret is required');
  assert.ok(/supabase functions deploy/.test(raw), 'edge functions deploy command is present');
  assert.ok(/permissions:/.test(raw), 'permissions block is configured');
});

registerTest('vividbooks presence cookie decodes what the app writes', () => {
  /** Stejné kódování jako `frontend/src/app/services/cross-site-presence.ts` ve vividbooks-ultra. */
  const encode = (payload: unknown) =>
    Buffer.from(JSON.stringify(payload), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const presence = parsePresenceValue(
    encode({
      v: 1,
      name: 'Jana Nováková',
      email: 'jana@example.cz',
      school: 'ZŠ Komenského',
      at: Date.now(),
    }),
  );

  assert.ok(presence, 'platná cookie se má rozparsovat');
  assert.equal(presence!.name, 'Jana Nováková');
  assert.equal(presence!.email, 'jana@example.cz');
  assert.equal(presence!.school, 'ZŠ Komenského');
  assert.equal(presence!.avatar, undefined);
  assert.equal(presenceFirstName(presence), 'Jana');

  const staleMs = 31 * 24 * 60 * 60 * 1000;
  assert.equal(
    parsePresenceValue(encode({ v: 1, name: 'Jana', at: Date.now() - staleMs })),
    null,
    'starší než měsíc už uživatele nepředstíráme',
  );
  assert.equal(
    parsePresenceValue(encode({ v: 2, name: 'Jana', at: Date.now() })),
    null,
    'neznámá verze se ignoruje',
  );
  assert.equal(
    parsePresenceValue(encode({ v: 1, name: '   ', at: Date.now() })),
    null,
    'bez jména nemáme co zobrazit',
  );
  assert.equal(parsePresenceValue('nonsense!!'), null, 'poškozená hodnota nesmí shodit web');
  assert.equal(presenceFirstName(null), '');
});

registerTest('rozcestník aplikací přijme jen známé volby', () => {
  assert.equal(parseAppEntryChoice('nova'), 'nova');
  assert.equal(parseAppEntryChoice('puvodni'), 'puvodni');
  assert.equal(parseAppEntryChoice('neco jineho'), null);
  assert.equal(parseAppEntryChoice(null), null);

  assert.ok(
    appEntryTargetUrl('nova').startsWith('https://nove.vividbooks.com'),
    'nová volba vede do nové aplikace',
  );
  assert.ok(
    appEntryTargetUrl('puvodni').startsWith('https://app.vividbooks.com'),
    'původní volba vede do staré aplikace',
  );
});

registerTest('zapamatovaná volba aplikace přežije i zablokované úložiště', () => {
  const original = Reflect.get(globalThis, 'window');
  const store = new Map<string, string>();

  try {
    Reflect.set(globalThis, 'window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });

    assert.equal(readAppEntryChoice(), null, 'bez volby se ptáme');
    rememberAppEntryChoice('puvodni');
    assert.equal(readAppEntryChoice(), 'puvodni');
    forgetAppEntryChoice();
    assert.equal(readAppEntryChoice(), null, 'po zapomenutí se ptáme znovu');

    Reflect.set(globalThis, 'window', {
      get localStorage(): never {
        throw new Error('storage blocked');
      },
    });
    assert.equal(readAppEntryChoice(), null, 'zablokované úložiště nesmí shodit rozcestník');
    rememberAppEntryChoice('nova');
  } finally {
    if (original === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      Reflect.set(globalThis, 'window', original);
    }
  }
});

/**
 * Adresy z Pipedrive → Base. Regrese: u českých adres jen s číslem popisným Pipedrive neplní
 * `street_number` (Google to vrací jako `premise`), takže se ulice skládala bez čísla —
 * „Pod Šternberkem 306" končilo v Base jako „Pod Šternberkem".
 */
registerTest('parseFreeFormAddress rozloží české adresy včetně názvu země', () => {
  assert.deepEqual(parseFreeFormAddress('Hradská 506, 747 64 Velká Polom, Česko'), {
    street: 'Hradská 506',
    city: 'Velká Polom',
    zip: '74764',
  });
  assert.deepEqual(parseFreeFormAddress('Pod Šternberkem 306, 763 02 Zlín 4-Louky, Czechia'), {
    street: 'Pod Šternberkem 306',
    city: 'Zlín 4-Louky',
    zip: '76302',
  });

  for (const country of ['Česko', 'ČR', 'Česká republika', 'Czechia', 'Czech Republic', 'Slovensko']) {
    const parsed = parseFreeFormAddress(`Hradská 506, 747 64 Velká Polom, ${country}`);
    assert.equal(parsed.city, 'Velká Polom', `název země „${country}" nesmí zůstat v městě`);
    assert.equal(parsed.street, 'Hradská 506', `název země „${country}"`);
  }
});

registerTest('streetHasHouseNumber a looksLikeRegionName rozpoznají nedoručitelnou ulici', () => {
  assert.equal(streetHasHouseNumber('Hradská 506'), true);
  assert.equal(streetHasHouseNumber('Tlumačovská 1237/32'), true);
  assert.equal(streetHasHouseNumber('Pod Šternberkem'), false);
  assert.equal(looksLikeRegionName('Jihomoravský kraj'), true);
  assert.equal(looksLikeRegionName('Kraslická'), false);
});

registerTest('preferStreetWithHouseNumber doplní číslo popisné jen u téže ulice', () => {
  assert.equal(preferStreetWithHouseNumber('Pod Šternberkem', 'Pod Šternberkem 306'), 'Pod Šternberkem 306');
  assert.equal(preferStreetWithHouseNumber('Hradská 506', 'Hradská 12'), 'Hradská 506');
  assert.equal(preferStreetWithHouseNumber('Hradská', 'Opavská 417'), 'Hradská');
  assert.equal(preferStreetWithHouseNumber('', 'Hradská 506'), 'Hradská 506');
  assert.equal(preferStreetWithHouseNumber('Hradská', ''), 'Hradská');
});

registerTest('adresa z Pipedrive Person si zachová číslo popisné z formatted_address', () => {
  assert.deepEqual(
    personPostalLine({
      postal_address: {
        route: 'Pod Šternberkem',
        locality: 'Zlín',
        sublocality: 'Louky',
        postal_code: '763 02',
        formatted_address: 'Pod Šternberkem 306, 763 02 Zlín 4-Louky, Czechia',
      },
    }),
    { street: 'Pod Šternberkem 306', city: 'Zlín', zip: '76302' },
  );

  /** Kompletní strukturovaná podpole (s číslem orientačním) se nesmí přepsat parsovaným textem. */
  assert.deepEqual(
    personPostalLine({
      postal_address: {
        route: 'Tlumačovská',
        street_number: '1237/32',
        locality: 'Praha 5 - Stodůlky',
        postal_code: '15500',
        formatted_address: 'Tlumačovská 1237/32, 155 00 Praha 5-Stodůlky, Czechia',
      },
    }),
    { street: 'Tlumačovská 1237/32', city: 'Praha 5 - Stodůlky', zip: '15500' },
  );
});

registerTest('adresa z Pipedrive Organization si zachová číslo popisné z org.address', () => {
  assert.deepEqual(
    orgAddressLine({
      address: 'Hradská 506, 747 64 Velká Polom, Česko',
      address_route: 'Hradská',
      address_locality: 'Velká Polom',
      address_postal_code: '747 64',
    }),
    { street: 'Hradská 506', city: 'Velká Polom', zip: '74764' },
  );
});

registerTest('enrichCzechAddressParts zahodí kraj místo ulice a přesune ulici z pole město', async () => {
  assert.deepEqual(
    await enrichCzechAddressParts(
      { street: 'Jihomoravský kraj', city: 'Rajhrad', zip: '66461' },
      { geocodeDisabled: true },
    ),
    { street: '', city: 'Rajhrad', zip: '66461' },
  );

  assert.deepEqual(
    await enrichCzechAddressParts(
      { street: 'Osvobození', city: 'Osvobození 535', zip: '27303' },
      { geocodeDisabled: true },
    ),
    { street: 'Osvobození 535', city: '', zip: '27303' },
  );

  /** Města s číslem („Zlín 4-Louky", „Praha 5") nejsou ulice — nesmí se přesouvat. */
  assert.deepEqual(
    await enrichCzechAddressParts(
      { street: 'Pod Šternberkem 306', city: 'Zlín 4-Louky', zip: '76302' },
      { geocodeDisabled: true },
    ),
    { street: 'Pod Šternberkem 306', city: 'Zlín 4-Louky', zip: '76302' },
  );
});

/** Edge funkce běží v Deno; pro test stačí `Deno.env` a stub `fetch` bez sítě. */
async function withStubbedRuntime(
  env: Record<string, string>,
  respondWith: (url: string) => unknown,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalDeno = Reflect.get(globalThis, 'Deno');
  Reflect.set(globalThis, 'Deno', { env: { get: (key: string) => env[key] } });
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return Promise.resolve(
      new Response(JSON.stringify(respondWith(url)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDeno === undefined) {
      Reflect.deleteProperty(globalThis, 'Deno');
    } else {
      Reflect.set(globalThis, 'Deno', originalDeno);
    }
  }
}

registerTest('geocoding přebírá číslo popisné z komponenty premise a ignoruje kraj', async () => {
  await withStubbedRuntime(
    { GOOGLE_MAPS_API_KEY: 'test-key' },
    () => ({
      status: 'OK',
      results: [{
        address_components: [
          { long_name: '306', types: ['premise'] },
          { long_name: 'Pod Šternberkem', types: ['route'] },
          { long_name: 'Zlín', types: ['locality'] },
          { long_name: '763 02', types: ['postal_code'] },
        ],
        formatted_address: 'Pod Šternberkem 306, 763 02 Zlín 4-Louky, Czechia',
      }],
    }),
    async () => {
      assert.deepEqual(await geocodeFreeFormAddressViaGoogle('Pod Šternberkem, 76302 Zlín'), {
        street: 'Pod Šternberkem 306',
        city: 'Zlín',
        zip: '76302',
      });
    },
  );

  await withStubbedRuntime(
    { GOOGLE_MAPS_API_KEY: 'test-key' },
    () => ({
      status: 'OK',
      results: [{
        address_components: [
          { long_name: 'Rajhrad', types: ['locality'] },
          { long_name: 'Jihomoravský kraj', types: ['administrative_area_level_1'] },
          { long_name: '664 61', types: ['postal_code'] },
        ],
        formatted_address: 'Jihomoravský kraj, 664 61 Rajhrad, Czechia',
      }],
    }),
    async () => {
      assert.deepEqual(await geocodeFreeFormAddressViaGoogle('664 61 Rajhrad'), {
        street: '',
        city: 'Rajhrad',
        zip: '66461',
      });
    },
  );
});

registerTest('ARES doplní číslo popisné jen tam, kde sídlo odpovídá adrese z dealu', async () => {
  /** Skutečné sídlo IČO 27670899 (ANSA Knihy) — zdroj čísla popisného u dealů z Pipedrive. */
  const ares = {
    sidlo: { nazevUlice: 'Pod Šternberkem', cisloDomovni: 306, nazevObce: 'Zlín', psc: 76302 },
  };

  await withStubbedRuntime({}, () => ares, async () => {
    assert.deepEqual(
      await enrichCzechAddressParts(
        { street: 'Pod Šternberkem', city: 'Zlín 4-Louky', zip: '76302' },
        { geocodeDisabled: true, ico: '27670899' },
      ),
      { street: 'Pod Šternberkem 306', city: 'Zlín 4-Louky', zip: '76302' },
    );

    /** Jiné PSČ = jiné místo (deal na adresu školy, sídlo distributora jinde) — ARES se nepoužije. */
    assert.deepEqual(
      await enrichCzechAddressParts(
        { street: 'Hradská', city: 'Velká Polom', zip: '74764' },
        { geocodeDisabled: true, ico: '27670899' },
      ),
      { street: 'Hradská', city: 'Velká Polom', zip: '74764' },
    );
  });
});

registerTest('distributorContactPersonName: s.r.o. nepoužije jako jméno osoby', () => {
  assert.equal(looksLikeLegalEntityName('Baar Group s.r.o.'), true);
  assert.equal(looksLikeLegalEntityName('EUROMEDIA GROUP, a.s.'), true);
  assert.equal(looksLikeLegalEntityName('ALBRA, spol. s r.o.'), true);
  assert.equal(looksLikeLegalEntityName('Jana Hrabačková'), false);
  assert.equal(looksLikeLegalEntityName('Petr Ježek'), false);

  assert.equal(
    distributorContactPersonName('Baar Group s.r.o.', 'peterek@baargroup.cz'),
    'Peterek',
  );
  assert.equal(
    distributorContactPersonName('EUROMEDIA GROUP, a.s.', 'polscakova.jaroslava@euromedia.cz'),
    'Polscakova Jaroslava',
  );
  assert.equal(
    distributorContactPersonName('Jana Hrabačková', 'jana.hrabackova@email.cz'),
    'Jana Hrabačková',
  );
  assert.equal(
    distributorContactPersonName('Petr Ježek', 'knihyjezek01@seznam.cz'),
    'Petr Ježek',
  );
  assert.equal(
    distributorContactPersonName('', 'ucebnice@ansa.cz'),
    'Ucebnice',
  );
});

registerTest('parseSellableWarehouseQuantity nesmí schovat fulfilment za záporný výchozí sklad', () => {
  const zk1000Stock = {
    product_id: 572787922,
    stock: {
      bl_132291: -23,
      bl_999001: 150,
    },
  };

  assert.equal(parseSellableWarehouseQuantity(zk1000Stock, 'bl_132291'), 150);

  assert.equal(
    parseSellableWarehouseQuantity({ stock: { bl_132291: 42 } }, 'bl_132291'),
    42,
  );

  assert.equal(
    parseSellableWarehouseQuantity({ stock: { bl_132291: -23 } }, 'bl_132291'),
    -23,
  );

  assert.equal(
    parseSellableWarehouseQuantity({ stock: { bl_1: 10, bl_2: 5 } }, 'bl_1'),
    15,
  );

  assert.equal(
    parseSellableWarehouseQuantity({
      stock: { bl_132291: -23, fulfillment_88: 180, shop_1: 180 },
    }, 'bl_132291'),
    180,
  );

  assert.equal(parseSellableWarehouseQuantity(null, 'bl_132291'), null);
});

registerTest('resolveStockLookupSku přeskočí Shoptet placeholder new a vezme ZK1000', () => {
  const inventory = [
    { sku: 'ZK1000', productId: '572787922', quantity: 150 },
    { sku: 'PC1000-C10', productId: '1', quantity: 2 },
    { sku: 'PC1000', productId: '2', quantity: 3 },
  ];

  assert.equal(
    resolveStockLookupSku(['new', 'ZK1000'], inventory),
    'ZK1000',
  );

  const packs = computeEffectiveStockQuantity('PC1000', inventory);
  assert.equal(packs.quantity, 23);
  assert.equal(packs.baseQuantity, 3);
  assert.equal(packs.packContributions.length, 1);
  assert.equal(packs.packContributions[0].unitQuantity, 20);
});

registerTest('sanitizeMerchVariantSkus nahradí CODE=new produktovým SKU ZK1000', () => {
  const sanitized = sanitizeMerchVariantSkus({
    type: 'merch',
    shoptetId: 'ZK1000',
    basecomSku: 'ZK1000',
    merchVariants: [{ shoptetId: 'new', label: 'Základní' }],
  });

  assert.equal(sanitized.merchVariants?.[0]?.shoptetId, 'ZK1000');
});

await run();
