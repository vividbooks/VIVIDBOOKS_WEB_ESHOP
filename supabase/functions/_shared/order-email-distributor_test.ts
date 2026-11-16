/**
 * `sendOrderEmail` (jádro funkce `send-order-email`) v testovacím režimu: falešná databáze
 * a podvržený `fetch` místo Resendu → nic se skutečně neodešle, kontroluje se předmět a text.
 *
 * deno test --no-check --node-modules-dir=none --allow-env supabase/functions/_shared/order-email-distributor_test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { sendOrderEmail } from './order-email.ts';

type Scenario = {
  known: boolean;
  country?: string;
  subtotal?: number;
};

const ORDER_ID = '11111111-2222-4333-8444-555555555555';

function fakeSql(s: Scenario) {
  const queries: string[] = [];
  const sql = ((strings: TemplateStringsArray, ..._values: unknown[]) => {
    const text = strings.join('?');
    queries.push(text);
    if (/from public\.orders\s+where id =/.test(text)) {
      return Promise.resolve([{
        id: ORDER_ID,
        order_number: 'VB-2026-0699',
        status: 'pending_payment',
        customer_email: 'objednavky@distributor.example',
        customer_name: 'Knihy Test s.r.o.',
        customer_phone: '+420 777 000 000',
        school_name: 'Knihy Test s.r.o.',
        ico: '12345678',
        street: 'Ulice 1',
        city: 'Praha',
        zip: '11000',
        note: 'Prosím do 14 h',
        shipping_method: 'none',
        shipping_price: 0,
        pickup_point_name: null,
        delivery_recipient_name: 'Jana Testová',
        delivery_street: 'Skladová 5',
        delivery_city: 'Brno',
        delivery_zip: '60200',
        tracking_number: null,
        payment_method: 'invoice',
        total: s.subtotal ?? 1_000_000,
        cancelled_reason: null,
        payment_resume_token: null,
        stripe_receipt_url: null,
        poster_fulfillment_status: null,
        source: 'distributor',
        country: s.country ?? 'CZ',
        subtotal: s.subtotal ?? 1_000_000,
        created_at: '2026-11-16T08:00:00Z',
      }]);
    }
    if (/from public\.order_items/.test(text)) {
      return Promise.resolve([
        { product_name: 'Fyzika 6 – pracovní sešit', quantity: 30, unit_price: 25000, total_price: 750000 },
        { product_name: 'Chemie 8 – pracovní sešit', quantity: 10, unit_price: 25000, total_price: 250000 },
      ]);
    }
    if (/select exists/.test(text) && /o\.source = 'distributor'/.test(text)) {
      return Promise.resolve([{ known: s.known }]);
    }
    return Promise.reject(new Error(`neočekávaný dotaz: ${text.slice(0, 80)}`));
  }) as unknown as Parameters<typeof sendOrderEmail>[0];
  return { sql, queries };
}

async function runSend(s: Scenario, salesRepFollowUp: boolean) {
  const sent: Array<Record<string, unknown>> = [];
  const realFetch = globalThis.fetch;
  Deno.env.set('TRANSACTIONAL_PROVIDER', 'resend');
  Deno.env.set('RESEND_API_KEY', 're_test_neodesila_se');
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith('https://api.resend.com/')) {
      return Promise.reject(new Error(`test nesmí volat ven: ${url}`));
    }
    sent.push({
      ...JSON.parse(String(init?.body || '{}')),
      _idempotencyKey: (init?.headers as Record<string, string>)?.['Idempotency-Key'],
    });
    return Promise.resolve(new Response(JSON.stringify({ id: 'test-id' }), { status: 200 }));
  }) as typeof fetch;
  try {
    const { sql } = fakeSql(s);
    const result = await sendOrderEmail(sql, { orderId: ORDER_ID, emailType: 'distributor_order_received', salesRepFollowUp });
    return { result, sent };
  } finally {
    globalThis.fetch = realFetch;
  }
}

Deno.test('send-order-email: známý distributor, Pipedrive vypnutý → slib 24 h, bez obchodního zástupce', async () => {
  const { result, sent } = await runSend({ known: true }, false);
  assertEquals(result.variant, 'ship24h');
  assertEquals(result.subject, 'Potvrzení objednávky VB-2026-0699 – Vividbooks');
  assertEquals(sent.length, 1);
  assertEquals(sent[0].subject, result.subject);
  assertEquals(sent[0].to, ['Knihy Test s.r.o. <objednavky@distributor.example>']);
  /** Opakované volání (timeout, doplnění) e-mail podruhé nepošle – Resend dostane stejný klíč. */
  assertEquals(sent[0]._idempotencyKey, `distributor_order_received/${ORDER_ID}`);
  const html = String(sent[0].html);
  assert(html.includes('Zásilku odešleme zpravidla do 24 hodin (v pracovní dny), fakturu vám pošleme e-mailem.'));
  assert(html.includes('Děkujeme za objednávku'));
  assert(!html.includes('obchodní zástupce'));
  /** Rekapitulace beze změny: firma, IČO, telefon, doručovací adresa, tituly, kusy, poznámka. */
  for (const part of ['Knihy Test s.r.o.', '12345678', '+420 777 000 000', 'Skladová 5', 'Fyzika 6', '40&nbsp;ks', 'Prosím do 14 h', 'VB-2026-0699']) {
    assert(html.includes(part), part);
  }
});

Deno.test('send-order-email: známý distributor, Pipedrive zapnutý → slib 24 h i obchodní zástupce', async () => {
  const { result, sent } = await runSend({ known: true }, true);
  assertEquals(result.variant, 'ship24h_sales_rep');
  const html = String(sent[0].html);
  assert(html.includes('do 24 hodin'));
  assert(html.includes('Ozve se vám obchodní zástupce Vividbooks'));
});

Deno.test('send-order-email: nový distributor / nad 50 000 Kč / mimo ČR → původní text bez 24 h', async () => {
  for (const s of [{ known: false }, { known: true, subtotal: 6_000_000 }, { known: true, country: 'SK' }]) {
    const { result, sent } = await runSend(s, true);
    assertEquals(result.variant, 'sales_rep', JSON.stringify(s));
    assertEquals(result.subject, 'Potvrzení objednávky VB-2026-0699 – Vividbooks');
    const html = String(sent[0].html);
    assert(!html.includes('24 hodin'), JSON.stringify(s));
    assert(html.includes('Evidujeme vaši distributorskou objednávku'));
    assert(html.includes('Ozve se vám obchodní zástupce Vividbooks'));
  }
  const { result } = await runSend({ known: false }, false);
  assertEquals(result.variant, 'no_promise');
});
