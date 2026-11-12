/** deno test --node-modules-dir=none --allow-read src/supabase/functions/server/distributorOrder_test.ts */
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { distributorCrmHandoff, distributorDeliveryFromBody } from './distributorOrder.ts';
import {
  checkDistributorDelivery,
  deliveryFromSeatAddress,
  distributorPipedriveSyncEnabled,
  emptyDistributorDelivery,
  readLastDistributorDelivery,
  rememberDistributorDelivery,
} from '../../../utils/distributorDelivery.ts';

const GOOD = {
  recipientName: 'Jana Nováková',
  company: 'Knihy Dobrovský s.r.o.',
  street: 'Komunardů 1584/42',
  city: 'Praha 7',
  zip: '170 00',
};

/* ---------- K13: povinná doručovací adresa na serveru ---------- */

Deno.test('server: bez doručovací adresy → 400 s českou hláškou', () => {
  const r = distributorDeliveryFromBody({});
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.status, 400);
    assert(/doručovací adres/i.test(r.error), r.error);
  }
  assertEquals(distributorDeliveryFromBody(null).ok, false);
  assertEquals(distributorDeliveryFromBody({ delivery: 'Komunardů 1, Praha' }).ok, false);
});

Deno.test('server: nevalidní části adresy → 400 (jméno 2 slova, ulice s číslem, město, PSČ 5 číslic, firma)', () => {
  const bad: Array<[Record<string, string>, RegExp]> = [
    [{ recipientName: 'Jana' }, /Příjemce/],
    [{ recipientName: '' }, /jméno a příjmení/],
    [{ company: '  ' }, /firmu/],
    [{ street: 'Komunardů' }, /číslo popisné/],
    [{ street: '' }, /ulici/],
    [{ city: '' }, /město/],
    [{ zip: '1700' }, /PSČ/],
    [{ zip: 'abcde' }, /PSČ/],
  ];
  for (const [patch, re] of bad) {
    const r = distributorDeliveryFromBody({ delivery: { ...GOOD, ...patch } });
    assertEquals(r.ok, false, JSON.stringify(patch));
    if (!r.ok) {
      assertEquals(r.status, 400);
      assert(re.test(r.error), `${JSON.stringify(patch)} → ${r.error}`);
    }
  }
});

Deno.test('server: platná adresa → sloupce orders.delivery_* (PSČ bez mezery, země CZ)', () => {
  const r = distributorDeliveryFromBody({ delivery: { ...GOOD, country: 'SK' } });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.columns, {
      delivery_recipient_name: 'Jana Nováková',
      delivery_street: 'Komunardů 1584/42',
      delivery_city: 'Praha 7',
      delivery_zip: '17000',
    });
    assertEquals(r.delivery.company, 'Knihy Dobrovský s.r.o.');
    assertEquals(r.delivery.country, 'CZ');
  }
});

/* ---------- K11: přepínač Pipedrive ---------- */

function handoffSpy(flag: unknown, opts: { flagThrows?: boolean; syncThrows?: boolean } = {}) {
  const calls = { sync: 0, kabinet: [] as Array<[number, string]>, events: [] as Array<Record<string, unknown>> };
  const deps = {
    orderId: 'o-1',
    orderNumber: 'VB-2026-0700',
    readSyncFlag: async () => {
      if (opts.flagThrows) throw new Error('kv down');
      return flag;
    },
    syncPipedrive: async () => {
      calls.sync += 1;
      if (opts.syncThrows) throw new Error('PD 500');
      return { dealId: 4242 };
    },
    importToKabinet: (dealId: number, orderNumber: string) => {
      calls.kabinet.push([dealId, orderNumber]);
    },
    insertEvent: async (e: Record<string, unknown>) => {
      calls.events.push(e);
    },
    log: () => {},
  };
  return { deps, calls };
}

Deno.test('přepínač chybí (null) → Pipedrive i Kabinet jako dřív', async () => {
  const { deps, calls } = handoffSpy(null);
  const r = await distributorCrmHandoff(deps);
  assertEquals(r.pipedriveSync, true);
  assertEquals(r.pipedrive, { dealId: 4242 });
  assertEquals(calls.sync, 1);
  assertEquals(calls.kabinet, [[4242, 'VB-2026-0700']]);
  assertEquals(calls.events.length, 0);
});

Deno.test('přepínač false → nevolá Pipedrive ani Kabinet, zapíše order_events pipedrive_skipped', async () => {
  for (const flag of [false, 'false', { enabled: false }]) {
    const { deps, calls } = handoffSpy(flag);
    const r = await distributorCrmHandoff(deps);
    assertEquals(r.pipedriveSync, false, JSON.stringify(flag));
    assertEquals(r.pipedrive, null);
    assertEquals(calls.sync, 0);
    assertEquals(calls.kabinet.length, 0);
    assertEquals(calls.events.length, 1);
    assertEquals(calls.events[0].event_type, 'pipedrive_skipped');
    assertEquals(calls.events[0].order_id, 'o-1');
  }
});

Deno.test('přepínač nečitelný → bezpečně zapnutý; pád Pipedrive objednávku neshodí', async () => {
  const a = handoffSpy(null, { flagThrows: true });
  assertEquals((await distributorCrmHandoff(a.deps)).pipedriveSync, true);
  assertEquals(a.calls.sync, 1);

  const b = handoffSpy(true, { syncThrows: true });
  const r = await distributorCrmHandoff(b.deps);
  assertEquals(r.pipedriveSync, true);
  assertEquals(r.pipedrive, null);
  assertEquals(b.calls.kabinet, [[0, 'VB-2026-0700']]);
});

Deno.test('distributorPipedriveSyncEnabled: vypne jen výslovné false', () => {
  for (const v of [undefined, null, true, 'true', '', {}, { enabled: true }, 1]) assertEquals(distributorPipedriveSyncEnabled(v), true, String(v));
  for (const v of [false, 0, 'false', ' OFF ', { enabled: false }]) assertEquals(distributorPipedriveSyncEnabled(v), false, String(v));
});

/* ---------- K13: formulář (sdílená logika stránky) ---------- */

Deno.test('formulář: prázdná adresa nejde odeslat', () => {
  const r = checkDistributorDelivery(emptyDistributorDelivery('Knihy Dobrovský s.r.o.'));
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.field, 'recipientName');
});

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

Deno.test('formulář: předvyplnění poslední adresy z localStorage podle IČO', () => {
  const s = memoryStorage();
  assertEquals(readLastDistributorDelivery(s, '27082440'), null);
  const ok = checkDistributorDelivery(GOOD);
  assert(ok.ok);
  if (!ok.ok) return;
  rememberDistributorDelivery(s, '27082440', ok.delivery);
  assertEquals(readLastDistributorDelivery(s, '27082440'), ok.delivery);
  /** Úvodní nuly a mezery v IČO nevadí, jiné IČO adresu nevidí. */
  assertEquals(readLastDistributorDelivery(s, '027082440'), ok.delivery);
  assertEquals(readLastDistributorDelivery(s, '12345678'), null);
  /** Rozbitá data ani nevalidní IČO nespadnou. */
  s.m.set('vividbooks_distributor_delivery:12345678', '{nejson');
  assertEquals(readLastDistributorDelivery(s, '12345678'), null);
  assertEquals(readLastDistributorDelivery(s, '12'), null);
  assertEquals(readLastDistributorDelivery(null, '27082440'), null);
});

Deno.test('formulář: „Použít adresu sídla“ rozloží adresu z rejstříku a jméno příjemce nechá', () => {
  const cur = { ...emptyDistributorDelivery(), recipientName: 'Jana Nováková' };
  const d = deliveryFromSeatAddress(cur, { name: 'Knihy Dobrovský s.r.o.', address: 'Komunardů 1584/42, 17000 Praha 7' });
  assertEquals(d.recipientName, 'Jana Nováková');
  assertEquals(d.company, 'Knihy Dobrovský s.r.o.');
  assertEquals(d.street, 'Komunardů 1584/42');
  assertEquals(d.zip, '17000');
  assert(d.city.startsWith('Praha'), d.city);
});

/* ---------- zapojení do handleru a stránky (aby logika nezůstala mimo tok) ---------- */

const here = new URL('.', import.meta.url);

Deno.test('handler POST /distributor/orders: adresa se ověří před uložením a jde do delivery_*, Pipedrive jen přes přepínač', async () => {
  const src = await Deno.readTextFile(new URL('./index.tsx', here));
  const start = src.indexOf("app.post('/make-server-93a20b6f/distributor/orders'");
  assert(start > 0);
  const end = src.indexOf('\napp.', start + 10);
  const handler = src.slice(start, end);
  const check = handler.indexOf('distributorDeliveryFromBody(');
  const insert = handler.indexOf(".from('orders')");
  assert(check > 0 && insert > 0 && check < insert, 'validace adresy musí být před insertem');
  assert(/\.\.\.delivery\.columns/.test(handler), 'insert ukládá orders.delivery_*');
  const hs = handler.indexOf('distributorCrmHandoff(');
  assert(hs > 0, 'předání obchodu přes přepínač');
  const he = handler.indexOf('\n    });', hs);
  const outside = handler.slice(0, hs) + handler.slice(he);
  assert(!outside.includes('syncEshopOrderToPipedriveFromDb('), 'Pipedrive se nesmí volat mimo přepínač');
  assert(!outside.includes('importDistributorDealToKabinet('), 'Kabinet se nesmí volat mimo přepínač');
  /** Opakovaný POST (stejné submissionId) vrací potvrzení podle původní objednávky. */
  const dedup = handler.slice(handler.indexOf('deduplicated: true') - 900, handler.indexOf('deduplicated: true'));
  assert(dedup.includes("'pipedrive_skipped'") && dedup.includes('salesRepFollowUp'), 'deduplikovaná odpověď nese salesRepFollowUp');
});

Deno.test('stránka: odeslání zastaví chybějící adresa, posílá delivery a čte poslední adresu', async () => {
  const src = await Deno.readTextFile(new URL('../../../components/distributor/DistributorOrderPage.tsx', here));
  const submit = src.slice(src.indexOf('const handleSubmit'), src.indexOf('const startNewOrder'));
  const check = submit.indexOf('checkDistributorDelivery(');
  const guard = submit.indexOf('prefilledIcoRef.current !== icoValue');
  assert(guard > 0 && guard < check, 'adresa předchozího IČO se nesmí odeslat nové firmě');
  const post = submit.indexOf('/distributor/orders');
  assert(check > 0 && post > 0 && check < post, 'kontrola adresy před odesláním');
  assert(/delivery:\s*deliveryCheck\.delivery/.test(submit), 'adresa jde v těle požadavku');
  assert(src.includes('readLastDistributorDelivery('), 'předvyplnění z localStorage');
  assert(src.includes('rememberDistributorDelivery('), 'uložení po odeslání');
  assert(src.includes('Použít adresu sídla'), 'tlačítko adresy sídla');
  /** Předvyplnění čeká na vyhledání firmy pro aktuální IČO a adresu jiné firmy nepřenáší. */
  assert(/companyIco !== value/.test(src), 'předvyplnění jen pro výsledek aktuálního IČO');
  assert(/previousIco\s*\n?\s*(\/\*\*[^*]*\*\/\s*)?\?\s*\{\s*\.\.\.emptyDistributorDelivery\(companyName\)/.test(src), 'přechod na jiné IČO adresu vyprázdní');
});

Deno.test('e-mail shrnutí: slib obchodního zástupce jen když jde objednávka přes Pipedrive', async () => {
  const { distributorOrderReceivedLead } = await import('../../../../supabase/functions/_shared/order-email.ts');
  assert(/obchodní zástupce/.test(distributorOrderReceivedLead(true)));
  assert(!/obchodní zástupce/.test(distributorOrderReceivedLead(false)));
});
