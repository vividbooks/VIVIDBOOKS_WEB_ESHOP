import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
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
  extractVariantStockMaps,
  listProductVariants,
  parseSellableWarehouseQuantity,
  resolveStockLookupSku,
} from '../supabase/functions/_shared/stock-quantity.ts';
import {
  buildFulfilmentRequestHeaders,
  parseFulfilmentStock,
  parseStockQuantityValue,
  parseUnitsPerPackValue,
  readFulfilmentStockConfig,
} from '../supabase/functions/_shared/fulfilment-stock.ts';
import {
  buildFulfilmentCzHeaders,
  buildFulfilmentCzPageUrl,
  parseFulfilmentCzWarehouseVariants,
  readFulfilmentCzConfig,
} from '../supabase/functions/_shared/fulfilment-cz-stock.ts';
import { sanitizeMerchVariantSkus } from '../src/utils/stockSku.ts';
import {
  classifyOutlineLabel,
  compileOutlineToHtml,
  parseOutlineText,
} from '../src/supabase/functions/server/emailOutline.ts';
// @ts-expect-error — MCP server je čisté ESM bez typů (spouští ho Cursor přes `node`).
import {
  buildRequestUrl,
  createRequestHandler,
  createTools,
  matchesFieldQuery,
  parseEnvFile,
  readApiToken,
  resolveApiPath,
  truncateForResponse,
} from './mcp/pipedrive-mcp-server.mjs';
// @ts-expect-error — instalátor MCP configu je čisté ESM bez typů.
import {
  buildInstallLink,
  installGlobalMcp,
  interpolateWorkspaceFolder,
  mergeMcpServers,
} from './mcp/install-cursor-mcp.mjs';

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

  const cartonOverSoldLoose = computeEffectiveStockQuantity('ZK1000', [
    { sku: 'ZK1000', productId: '572787922', quantity: -23 },
    { sku: 'ZK1000-C10', productId: '1', quantity: 12 },
  ]);
  assert.equal(cartonOverSoldLoose.quantity, 120);
  assert.equal(cartonOverSoldLoose.baseQuantity, -23);
  assert.equal(cartonOverSoldLoose.packContributions[0].packSku, 'ZK1000-C10');

  const variantMaps = extractVariantStockMaps({
    product_id: 1,
    stock: { bl_132291: -23 },
    variants: { '99': { bl_132291: 12 } },
  });
  assert.equal(variantMaps['99'].bl_132291, 12);

  const variants = listProductVariants({
    sku: 'ZK1000',
    variants: {
      '99': { sku: 'ZK1000-C10', ean: '', name: 'karton', stock: { bl_132291: 12 } },
    },
  }, variantMaps);
  assert.equal(variants[0].sku, 'ZK1000-C10');
  assert.equal(variants[0].warehouseQuantities.bl_132291, 12);
});

registerTest('fulfilment: „37/37“ a „karton (10ks)“ se přečtou jako kusy a velikost balení', () => {
  assert.equal(parseStockQuantityValue('37/37'), 37);
  assert.equal(parseStockQuantityValue('267 / 267'), 267);
  assert.equal(parseStockQuantityValue('1 250'), 1250);
  assert.equal(parseStockQuantityValue(0), 0);
  assert.equal(parseStockQuantityValue(''), null);
  assert.equal(parseStockQuantityValue('skladem'), null);

  assert.equal(parseUnitsPerPackValue('karton (10ks)'), 10);
  assert.equal(parseUnitsPerPackValue('kus'), null);
  assert.equal(parseUnitsPerPackValue(10), 10);
  assert.equal(parseUnitsPerPackValue(1), null);
});

registerTest('fulfilment: JSON řádky s dvojím kódem dají kusy i kartony pro ZK1000', () => {
  const rows = parseFulfilmentStock(JSON.stringify({
    products: [
      { code: 'DS36066094, ZK1000', quantity: '37/37', unit: 'kus' },
      { code: 'DS36066094-C10, ZK1000-C10', quantity: '267/267', unit: 'karton (10ks)' },
    ],
  }));

  const bySku = new Map(rows.map((row) => [row.sku, row.quantity]));
  assert.equal(bySku.get('ZK1000'), 37);
  assert.equal(bySku.get('DS36066094'), 37);
  assert.equal(bySku.get('ZK1000-C10'), 267);

  /** Sklad Base.com a fulfilmentu se u téhož SKU slučují do jedné mapy skladů. */
  const mergedLooseQuantity = parseSellableWarehouseQuantity(
    { stock: { bl_132291: -23, fulfillment_ff: bySku.get('ZK1000')! } },
    'bl_132291',
  );
  assert.equal(mergedLooseQuantity, 37);

  const effective = computeEffectiveStockQuantity('ZK1000', [
    { sku: 'ZK1000', productId: '572787922', quantity: mergedLooseQuantity },
    { sku: 'ZK1000-C10', productId: 'fulfilment:ZK1000-C10', quantity: bySku.get('ZK1000-C10')! },
  ]);
  assert.equal(effective.quantity, 2707);
  assert.equal(effective.packContributions[0].unitQuantity, 2670);
});

registerTest('fulfilment: bez suffixu -C10 se z velikosti balení dopočítá kartonové SKU', () => {
  const rows = parseFulfilmentStock(JSON.stringify([
    { sku: 'PM2400', quantity: 12, pack_size: 10 },
  ]));

  assert.deepEqual(rows, [{ sku: 'PM2400-C10', quantity: 12, unitsPerPack: 10 }]);
});

registerTest('fulfilment: XML i CSV export se přečtou stejně jako JSON', () => {
  const xml = parseFulfilmentStock(`<?xml version="1.0"?><stocks>
    <item><CODE>ZK1000</CODE><STOCK>37</STOCK></item>
    <item><CODE>ZK1000-C10</CODE><STOCK>267</STOCK></item>
  </stocks>`);
  assert.deepEqual(xml.map((row) => [row.sku, row.quantity]), [['ZK1000', 37], ['ZK1000-C10', 267]]);

  const csv = parseFulfilmentStock('kód;množství\nZK1000;37/37\nZK1000-C10;267/267');
  assert.deepEqual(csv.map((row) => [row.sku, row.quantity]), [['ZK1000', 37], ['ZK1000-C10', 267]]);

  assert.deepEqual(parseFulfilmentStock(''), []);
  assert.deepEqual(parseFulfilmentStock('{nevalidni json'), []);
});

registerTest('fulfilment: bez FULFILMENT_STOCK_URL se zdroj nezapne', () => {
  const env: Record<string, string> = {};
  assert.equal(readFulfilmentStockConfig((name) => env[name]), null);

  env.FULFILMENT_STOCK_URL = 'https://ff.example.com/stock';
  env.FULFILMENT_STOCK_TOKEN = 'secret-token';
  const config = readFulfilmentStockConfig((name) => env[name]);
  assert.equal(config?.url, 'https://ff.example.com/stock');
  assert.equal(config?.warehouseKey, 'fulfillment_ff');
  assert.equal(buildFulfilmentRequestHeaders(config!).Authorization, 'Bearer secret-token');

  env.FULFILMENT_STOCK_TOKEN_HEADER = 'X-Api-Key';
  const custom = readFulfilmentStockConfig((name) => env[name])!;
  assert.equal(buildFulfilmentRequestHeaders(custom)['X-Api-Key'], 'secret-token');
  assert.equal(buildFulfilmentRequestHeaders(custom).Authorization, undefined);
});

registerTest('fulfillment.cz: kartonová varianta se nepočítá dvakrát', () => {
  /**
   * Reálná odpověď produkce: kusová varianta má kartony už v `mastercase_*`
   * (37 + 2670 = 2707 ks) a `ZK1000-C10` je stejná zásoba v kartonech.
   */
  const { rows, totalCount, error } = parseFulfilmentCzWarehouseVariants({
    code: 200,
    message: '',
    totalCount: 2,
    data: [
      {
        variant_id: 1887274,
        code: 'DS36066094',
        ext_code: 'ZK1000',
        quantity: 40,
        available_quantity: 37,
        reserved_quantity: 3,
        mastercase_quantity: 2670,
        mastercase_available_quantity: 2670,
      },
      {
        variant_id: 1887275,
        code: 'DS36066094-C10',
        ext_code: 'ZK1000-C10',
        quantity: 267,
        available_quantity: 267,
      },
    ],
  });

  assert.equal(error, null);
  assert.equal(totalCount, 2);

  const bySku = new Map(rows.map((row) => [row.sku, row.quantity]));
  assert.equal(bySku.get('ZK1000'), 2707);
  assert.equal(bySku.get('DS36066094'), 2707);
  assert.equal(bySku.has('ZK1000-C10'), false, 'kartonový řádek se zahodí');
  assert.equal(bySku.has('DS36066094-C10'), false);

  const effective = computeEffectiveStockQuantity('ZK1000', [
    { sku: 'ZK1000', productId: 'ff', quantity: bySku.get('ZK1000')! },
  ]);
  assert.equal(effective.quantity, 2707);

  /** Kartonové SKU bez kusové varianty se naopak přepočte na kusy. */
  const packOnly = parseFulfilmentCzWarehouseVariants({
    data: [{ ext_code: 'PP2100-C10', available_quantity: 5 }],
  });
  assert.equal(packOnly.rows[0].sku, 'PP2100-C10');
  assert.equal(
    computeEffectiveStockQuantity('PP2100', [
      { sku: 'PP2100-C10', productId: 'ff', quantity: 5 },
    ]).quantity,
    50,
  );
});

registerTest('fulfillment.cz: kusy v kartonech se přičtou, rezervace se odečtou', () => {
  /** `mastercase_*` podle dokumentace kusové SKU nezahrnuje, takže se sčítá. */
  const { rows } = parseFulfilmentCzWarehouseVariants({
    code: 200,
    data: [{
      code: 'DS62202039',
      ext_code: 'PM2400',
      quantity: 3,
      available_quantity: 2,
      reserved_quantity: 1,
      mastercase_quantity: 303,
      mastercase_available_quantity: 302,
    }],
  });
  assert.equal(rows.find((row) => row.sku === 'PM2400')?.quantity, 304);

  /** Bez `available_quantity` se dostupnost dopočítá z hrubého stavu. */
  const fallback = parseFulfilmentCzWarehouseVariants({
    data: [{ ext_code: 'PP2100', quantity: 10, reserved_quantity: 4, requested_quantity: 1 }],
  });
  assert.equal(fallback.rows[0].quantity, 5);

  /** Přeprodaná varianta zůstane záporná, ať badge nelže. */
  const oversold = parseFulfilmentCzWarehouseVariants({
    data: [{ ext_code: 'ZK1000', available_quantity: -5 }],
  });
  assert.equal(oversold.rows[0].quantity, -5);
});

registerTest('fulfillment.cz: chybová odpověď a stránkování', () => {
  const failed = parseFulfilmentCzWarehouseVariants({ code: 401, message: 'Unauthorized', data: [] });
  assert.equal(failed.error, 'Unauthorized');
  assert.deepEqual(failed.rows, []);

  assert.deepEqual(parseFulfilmentCzWarehouseVariants(null).rows, []);

  const env: Record<string, string> = { FULFILLMENT_CZ_API_TOKEN: 'ff-token' };
  const config = readFulfilmentCzConfig((name) => env[name])!;
  assert.equal(config.warehouseKey, 'fulfillment_ff');
  assert.equal(
    buildFulfilmentCzPageUrl(config, 1000),
    'https://client.api.fulfillment.cz/v2/fulfillment/warehouse-variants?limit=1000&offset=1000',
  );

  /** Token jde do Authorization bez „Bearer“, jak vyžaduje Fulfillment.cz. */
  assert.equal(buildFulfilmentCzHeaders(config).Authorization, 'ff-token');
  assert.equal(readFulfilmentCzConfig(() => undefined), null);
});

registerTest('fulfillment.cz: token se najde v obou zápisech i pod jiným názvem', () => {
  /** Brand je „Fulfillment.cz“ (dvě L), britské „fulfilment“ má jedno. */
  const single = { FULFILMENT_CZ_API_TOKEN: 'a' };
  assert.equal(readFulfilmentCzConfig((name) => (single as Record<string, string>)[name])?.token, 'a');

  const double = { FULFILLMENT_CZ_API_TOKEN: 'b' };
  assert.equal(readFulfilmentCzConfig((name) => (double as Record<string, string>)[name])?.token, 'b');

  const shortName = { FULFILLMENT_CZ_TOKEN: 'c' };
  assert.equal(readFulfilmentCzConfig((name) => (shortName as Record<string, string>)[name])?.token, 'c');

  /** Neznámý název se dohledá skenem prostředí. */
  const odd = { FULFILLMENTCZ_APIKEY: 'd' };
  assert.equal(
    readFulfilmentCzConfig((name) => (odd as Record<string, string>)[name], () => Object.keys(odd))?.token,
    'd',
  );

  /** S vlastní URL patří token obecnému adaptéru, ne klientovi Fulfillment.cz. */
  const generic = { FULFILMENT_STOCK_TOKEN: 'e', FULFILMENT_STOCK_URL: 'https://x' };
  assert.equal(
    readFulfilmentCzConfig((name) => (generic as Record<string, string>)[name], () => Object.keys(generic)),
    null,
  );

  /** Bez URL obecný adaptér nejde zapnout, takže token patří Fulfillment.cz. */
  const tokenOnly = { FULFILMENT_STOCK_TOKEN: 'g' };
  const fromStockToken = readFulfilmentCzConfig((name) => (tokenOnly as Record<string, string>)[name]);
  assert.equal(fromStockToken?.token, 'g');
  assert.equal(fromStockToken?.url, 'https://client.api.fulfillment.cz/v2/fulfillment/warehouse-variants');

  /** Obecný adaptér zvládne dvojité L stejně jako jedno. */
  const genericDouble = { FULFILLMENT_STOCK_URL: 'https://feed.example/stock', FULFILLMENT_STOCK_TOKEN: 'f' };
  const genericConfig = readFulfilmentStockConfig((name) => (genericDouble as Record<string, string>)[name]);
  assert.equal(genericConfig?.url, 'https://feed.example/stock');
  assert.equal(genericConfig?.token, 'f');
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

registerTest('email outline roztřídí české popisky bloků', () => {
  assert.equal(classifyOutlineLabel('Blok s nadpisem a žlutou barvou'), 'heading');
  assert.equal(classifyOutlineLabel('Odstavec'), 'paragraph');
  assert.equal(classifyOutlineLabel('Webinář'), 'webinar');
  assert.equal(classifyOutlineLabel('Zvýraznění žlutá'), 'highlight');
  assert.equal(classifyOutlineLabel('Tlačítko'), 'button');

  const blocks = parseOutlineText(
    [
      '=== SKUPINA karta ===',
      'NADPIS: Matematika je priorita',
      'ODSTAVEC: Bla bla bla',
      'WEBINÁŘ: Pozvánka na webinář | slug=matematika-jaro | layout=hero',
      'ZVYRAZNĚNÍ žlutá: Každý jedenáctý sešit zdarma',
    ].join('\n'),
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'section');
  assert.equal(blocks[0].items?.length, 4);
  assert.equal(blocks[0].items?.[0].type, 'heading');
  assert.equal(blocks[0].items?.[0].text, 'Matematika je priorita');
  assert.equal(blocks[0].items?.[2].type, 'webinar');
  assert.equal(blocks[0].items?.[2].slug, 'matematika-jaro');

  const html = compileOutlineToHtml(blocks);
  assert.match(html, /data-vb-block="section"/);
  assert.match(html, /Matematika je priorita/);
  assert.match(html, /data-ai-webinar-slug="matematika-jaro"/);
  assert.match(html, /data-vb-block="highlight"/);
});

registerTest('MCP: parseEnvFile načte token i s uvozovkami a komentáři', () => {
  const parsed = parseEnvFile(
    ['# komentář', 'export PIPEDRIVE_API_TOKEN="tok en"', "OTHER='hodnota'", 'PRAZDNY=', 'bez_rovnitka'].join('\n'),
  );

  assert.equal(parsed.PIPEDRIVE_API_TOKEN, 'tok en');
  assert.equal(parsed.OTHER, 'hodnota');
  assert.equal(parsed.PRAZDNY, '');
  assert.equal('bez_rovnitka' in parsed, false);
});

registerTest('MCP: readApiToken sáhne do .env, když Cursor nedosadí ${env:…}', () => {
  const envFile = resolve(process.cwd(), 'scripts/mcp/__fixtures__/token.env');

  assert.equal(readApiToken({ PIPEDRIVE_API_TOKEN: 'z-prostredi' }, envFile), 'z-prostredi');
  assert.equal(readApiToken({ PIPEDRIVE_API_TOKEN: '${env:PIPEDRIVE_API_TOKEN}' }, envFile), 'token-ze-souboru');
  assert.equal(readApiToken({}, envFile), 'token-ze-souboru');
  assert.equal(readApiToken({}, resolve(process.cwd(), 'scripts/mcp/__fixtures__/neexistuje.env')), '');
});

registerTest('MCP: resolveApiPath povolí jen cesty Pipedrive API', () => {
  assert.deepEqual(resolveApiPath('/api/v2/deals/123'), { pathname: '/api/v2/deals/123', search: '' });
  assert.deepEqual(resolveApiPath('v1/dealFields?limit=500'), { pathname: '/v1/dealFields', search: 'limit=500' });

  assert.throws(() => resolveApiPath('https://api.pipedrive.com/v1/deals'), /jen cestu API/);
  assert.throws(() => resolveApiPath('/v1/../../etc/passwd'), /Nepovolená cesta/);
  assert.throws(() => resolveApiPath('/webhooks'), /musí začínat/);
  assert.throws(() => resolveApiPath(''), /Chybí parametr/);
});

registerTest('MCP: buildRequestUrl spojí query a zahodí api_token z URL', () => {
  const url = buildRequestUrl('https://api.pipedrive.com', '/v1/dealFields?start=0', {
    limit: 500,
    api_token: 'tajne',
    ids: [1, 2],
    prazdne: null,
  });

  assert.equal(url.origin + url.pathname, 'https://api.pipedrive.com/v1/dealFields');
  assert.equal(url.searchParams.get('start'), '0');
  assert.equal(url.searchParams.get('limit'), '500');
  assert.equal(url.searchParams.get('ids'), '1,2');
  assert.equal(url.searchParams.has('api_token'), false);
  assert.equal(url.searchParams.has('prazdne'), false);
});

registerTest('MCP: matchesFieldQuery hledá podle názvu, hashe i názvu volby', () => {
  const field = {
    id: 12586,
    key: '26e4a2f8dc44e49f369c468ccc816ad668b37d92',
    name: 'Eshop ID',
    field_type: 'varchar',
    options: [{ id: 419, label: 'E-shop B2C' }],
  };

  assert.equal(matchesFieldQuery(field, 'eshop id'), true);
  assert.equal(matchesFieldQuery(field, '26e4a2f8'), true);
  assert.equal(matchesFieldQuery(field, '12586'), true);
  assert.equal(matchesFieldQuery(field, 'b2c'), true);
  assert.equal(matchesFieldQuery(field, 'faktura'), false);
});

registerTest('MCP: truncateForResponse zkrátí velkou odpověď', () => {
  assert.equal(truncateForResponse('krátké', 100), 'krátké');

  const long = truncateForResponse('x'.repeat(50), 10);
  assert.equal(long.startsWith('x'.repeat(10)), true);
  assert.match(long, /odpověď zkrácena \(50 znaků\)/);
});

registerTest('MCP: nástroje volají Pipedrive read-only s hlavičkou x-api-token', async () => {
  const calls: Array<{ url: string; method?: string; token?: string }> = [];
  const fetchImpl = async (url: URL, init: { method?: string; headers: Record<string, string> }) => {
    calls.push({ url: url.toString(), method: init.method, token: init.headers['x-api-token'] });
    return new Response(
      JSON.stringify({
        success: true,
        data: [
          { id: 12586, key: '26e4a2f8', name: 'Eshop ID', field_type: 'varchar' },
          { id: 1, key: 'label', name: 'Label', field_type: 'enum', options: [{ id: 419, label: 'E-shop B2C' }] },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const tools = createTools({ apiBaseUrl: 'https://api.pipedrive.com', apiToken: 'test-token', fetchImpl });

  const fields = JSON.parse(await tools.pipedrive_find_field.run({ entity: 'deal', query: 'b2c' }));
  assert.equal(fields.total_fields, 2);
  assert.equal(fields.matches.length, 1);
  assert.equal(fields.matches[0].key, 'label');
  assert.equal(fields.matches[0].options[0].id, 419);

  await tools.pipedrive_search.run({ entity: 'products', term: 'DPD', exact_match: true, limit: 5 });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.pipedrive.com/v1/dealFields?limit=500');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].token, 'test-token');
  assert.match(calls[1].url, /^https:\/\/api\.pipedrive\.com\/api\/v2\/products\/search\?/);
  assert.match(calls[1].url, /term=DPD/);
  assert.match(calls[1].url, /exact_match=true/);

  await assert.rejects(() => tools.pipedrive_find_field.run({ entity: 'faktura', query: 'x' }), /Neznámá entita/);
});

registerTest('MCP: bez tokenu vrátí nástroj srozumitelnou chybu, ne pád serveru', async () => {
  const tools = createTools({
    apiBaseUrl: 'https://api.pipedrive.com',
    apiToken: '',
    fetchImpl: async () => {
      throw new Error('fetch se nemá volat bez tokenu');
    },
  });
  const handle = createRequestHandler(tools);

  const response = await handle({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'pipedrive_get', arguments: { path: '/api/v2/deals' } },
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /Chybí PIPEDRIVE_API_TOKEN/);
});

registerTest('MCP: handshake a tools/list odpovídají MCP protokolu', async () => {
  const handle = createRequestHandler(createTools({ apiBaseUrl: 'https://api.pipedrive.com', apiToken: 't' }));

  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'pipedrive-api');

  const legacy = await handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(legacy.result.protocolVersion, '2025-06-18');

  const list = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((tool: { name: string }) => tool.name).sort(), [
    'pipedrive_find_field',
    'pipedrive_get',
    'pipedrive_search',
  ]);
  assert.equal(list.result.tools.every((tool: { inputSchema?: unknown }) => Boolean(tool.inputSchema)), true);

  const unknownMethod = await handle({ jsonrpc: '2.0', id: 4, method: 'resources/list' });
  assert.equal(unknownMethod.error.code, -32601);

  const unknownTool = await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'pipedrive_delete' } });
  assert.equal(unknownTool.error.code, -32602);
});

registerTest('MCP: server běží přes stdio proti mock Pipedrive API', async () => {
  const requestLog: string[] = [];
  const api = createServer((req, res) => {
    requestLog.push(`${req.method} ${req.url} token=${req.headers['x-api-token']}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { id: 123, title: 'Objednávka VB-2026-0099' } }));
  });
  await new Promise<void>((listening) => api.listen(0, '127.0.0.1', listening));
  const { port } = api.address() as AddressInfo;

  const child = spawn('node', [resolve(process.cwd(), 'scripts/mcp/pipedrive-mcp-server.mjs')], {
    env: {
      ...process.env,
      PIPEDRIVE_API_TOKEN: 'stdio-token',
      PIPEDRIVE_API_BASE_URL: `http://127.0.0.1:${port}`,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const responses: Array<Record<string, any>> = [];
  let buffer = '';
  const twoResponses = new Promise<void>((received) => {
    child.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) responses.push(JSON.parse(line));
        if (responses.length === 2) received();
        newline = buffer.indexOf('\n');
      }
    });
  });

  try {
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })}\n`,
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'pipedrive_get', arguments: { path: '/api/v2/deals/123' } },
      })}\n`,
    );

    await Promise.race([
      twoResponses,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('MCP server neodpověděl do 10 s')), 10_000)),
    ]);
  } finally {
    child.stdin.end();
    child.kill();
    await new Promise<void>((closed) => api.close(() => closed()));
  }

  assert.equal(responses[0].result.serverInfo.name, 'pipedrive-api');
  assert.equal(responses[1].result.isError, undefined);
  assert.match(responses[1].result.content[0].text, /Objednávka VB-2026-0099/);
  assert.deepEqual(requestLog, ['GET /api/v2/deals/123 token=stdio-token']);
});

registerTest('MCP instalátor: ${workspaceFolder} se nahradí absolutní cestou', () => {
  const resolved = interpolateWorkspaceFolder(
    {
      command: 'node',
      args: ['${workspaceFolder}/scripts/mcp/pipedrive-mcp-server.mjs'],
      env: { PIPEDRIVE_API_TOKEN: '${env:PIPEDRIVE_API_TOKEN}' },
      cislo: 42,
    },
    '/Users/dan/vividbooks',
  );

  assert.deepEqual(resolved.args, ['/Users/dan/vividbooks/scripts/mcp/pipedrive-mcp-server.mjs']);
  assert.equal(resolved.env.PIPEDRIVE_API_TOKEN, '${env:PIPEDRIVE_API_TOKEN}');
  assert.equal(resolved.cislo, 42);
});

registerTest('MCP instalátor: merge zachová cizí servery a rozliší přidané/přepsané', () => {
  const merged = mergeMcpServers(
    { mcpServers: { supabase: { url: 'https://mcp.supabase.com/mcp' }, pipedrive: { url: 'https://stary/mcp' } } },
    { pipedrive: { url: 'https://mcp.pipedrive.ai/mcp' }, 'pipedrive-api': { type: 'stdio', command: 'node' } },
  );

  assert.equal(merged.config.mcpServers.supabase.url, 'https://mcp.supabase.com/mcp');
  assert.equal(merged.config.mcpServers.pipedrive.url, 'https://mcp.pipedrive.ai/mcp');
  assert.deepEqual(merged.added, ['pipedrive-api']);
  assert.deepEqual(merged.updated, ['pipedrive']);
  assert.deepEqual(merged.unchanged, []);
});

registerTest('MCP instalátor: deeplink nese base64 konfiguraci serveru', () => {
  const link = buildInstallLink('pipedrive', { url: 'https://mcp.pipedrive.ai/mcp' });

  assert.equal(link.startsWith('cursor://anysphere.cursor-deeplink/mcp/install?name=pipedrive&config='), true);
  const encoded = decodeURIComponent(link.split('config=')[1]);
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')), {
    url: 'https://mcp.pipedrive.ai/mcp',
  });
});

registerTest('MCP instalátor: zápis do ~/.cursor/mcp.json zálohuje a nepřepíše cizí servery', () => {
  const tmpHome = mkdtempSync(resolve(tmpdir(), 'vb-mcp-install-'));
  const globalConfigPath = resolve(tmpHome, '.cursor', 'mcp.json');
  mkdirSync(dirname(globalConfigPath), { recursive: true });
  writeFileSync(globalConfigPath, JSON.stringify({ mcpServers: { jiny: { url: 'https://priklad/mcp' } } }, null, 2));

  const preview = installGlobalMcp({ repoRoot: process.cwd(), globalConfigPath, dryRun: true });
  assert.deepEqual(preview.added.sort(), ['pipedrive', 'pipedrive-api']);
  assert.deepEqual(JSON.parse(readFileSync(globalConfigPath, 'utf8')).mcpServers, {
    jiny: { url: 'https://priklad/mcp' },
  });

  const written = installGlobalMcp({ repoRoot: process.cwd(), globalConfigPath });
  const result = JSON.parse(readFileSync(globalConfigPath, 'utf8'));

  assert.equal(result.mcpServers.jiny.url, 'https://priklad/mcp');
  assert.equal(result.mcpServers.pipedrive.url, 'https://mcp.pipedrive.ai/mcp');
  assert.equal(
    result.mcpServers['pipedrive-api'].args[0],
    resolve(process.cwd(), 'scripts/mcp/pipedrive-mcp-server.mjs'),
  );
  assert.equal(result.mcpServers['pipedrive-api'].args[0].includes('${workspaceFolder}'), false);
  assert.equal(JSON.parse(readFileSync(written.backupPath, 'utf8')).mcpServers.pipedrive, undefined);

  rmSync(tmpHome, { recursive: true, force: true });
});

await run();
