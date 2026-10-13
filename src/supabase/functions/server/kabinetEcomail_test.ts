/** deno test --node-modules-dir=none src/supabase/functions/server/kabinetEcomail_test.ts */
import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  type KabinetMessage,
  kabinetEcomailAuth,
  MAX_MESSAGES,
  parseSendBody,
  retryAfterMs,
  sendAll,
  sendOne,
  summarizeDomains,
  timingSafeEqualString,
} from './kabinetEcomail.ts';

const SECRET = 'tajne-sdilene-123';
const env = (vals: Record<string, string>) => (n: string) => vals[n];
const req = (headers: Record<string, string>) => new Request('https://x/kabinet/ecomail/send', { method: 'POST', headers });

function msg(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm1',
    to: { email: 'ucitel@skola.cz', name: 'Jana Nováková' },
    subject: 'Dobrý den',
    text: 'Ahoj',
    html: '<p>Ahoj</p>',
    from_name: 'Vítek Škop',
    from_email: 'vitek@vividbooks.com',
    reply_to: 'vitek@vividbooks.com',
    ...over,
  };
}

/* ── ověření ── */

Deno.test('timingSafeEqualString', () => {
  assert(timingSafeEqualString('abc', 'abc'));
  assert(!timingSafeEqualString('abc', 'abd'));
  assert(!timingSafeEqualString('abc', 'abcd'));
  assert(!timingSafeEqualString('', 'a'));
  assert(timingSafeEqualString('žluťoučký', 'žluťoučký'));
});

Deno.test('auth: správné tajemství v x-identity-secret projde', () => {
  assertEquals(kabinetEcomailAuth(req({ 'x-identity-secret': SECRET }), env({ IDENTITY_UPSERT_SECRET: SECRET })), { ok: true });
});

Deno.test('auth: špatné / chybějící tajemství → 401', () => {
  const e = env({ IDENTITY_UPSERT_SECRET: SECRET });
  assertEquals(kabinetEcomailAuth(req({ 'x-identity-secret': 'jine' }), e).ok, false);
  const r = kabinetEcomailAuth(req({}), e);
  assert(!r.ok && r.status === 401);
});

Deno.test('auth: tajemství v Authorization ani service-role JWT neplatí', () => {
  const e = env({ IDENTITY_UPSERT_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: 'srv' });
  assertEquals(kabinetEcomailAuth(req({ Authorization: `Bearer ${SECRET}` }), e).ok, false);
  assertEquals(kabinetEcomailAuth(req({ 'x-identity-secret': 'srv' }), e).ok, false);
});

Deno.test('auth: nenastavené tajemství na serveru → 503, i prázdná hlavička neprojde', () => {
  const r = kabinetEcomailAuth(req({ 'x-identity-secret': '' }), env({}));
  assert(!r.ok && r.status === 503);
});

/* ── validace ── */

Deno.test('validace: platná zpráva projde a normalizuje e-maily', () => {
  const r = parseSendBody({ messages: [msg({ to: { email: 'Ucitel@Skola.CZ' }, id: 42 })] });
  assert(r.ok);
  assertEquals(r.messages[0].to, { email: 'ucitel@skola.cz' });
  assertEquals(r.messages[0].id, '42');
});

Deno.test('validace: tvar těla', () => {
  assert(!parseSendBody(null).ok);
  assert(!parseSendBody([]).ok);
  assert(!parseSendBody({}).ok);
  assert(!parseSendBody({ messages: [] }).ok);
  assert(!parseSendBody({ messages: 'x' }).ok);
});

Deno.test('validace: max 50 zpráv', () => {
  const ok = Array.from({ length: MAX_MESSAGES }, (_, i) => msg({ id: `m${i}` }));
  assert(parseSendBody({ messages: ok }).ok);
  assert(!parseSendBody({ messages: [...ok, msg({ id: 'navic' })] }).ok);
});

Deno.test('validace: from_email jen z vividbooks.com', () => {
  for (const from of ['x@gmail.com', 'x@vividbooks.com.evil.cz', 'x@sub.vividbooks.com', 'x@evilvividbooks.com', 'neni-mail']) {
    const r = parseSendBody({ messages: [msg({ from_email: from })] });
    assert(!r.ok, from);
  }
  assert(parseSendBody({ messages: [msg({ from_email: 'Hello@VividBooks.com' })] }).ok);
});

Deno.test('validace: chyby e-mailů, délek a hlaviček', () => {
  const bad: Array<Record<string, unknown>> = [
    { to: { email: 'neplatny' } },
    { to: 'a@b.cz' },
    { to: { email: 'a@b.cz', name: 'x'.repeat(201) } },
    { reply_to: 'nic' },
    { subject: '' },
    { subject: 'x'.repeat(301) },
    { subject: 'a\r\nBcc: x@y.cz' },
    { from_name: '' },
    { text: '', html: '' },
    { html: 5 },
    { html: 'x'.repeat(500_001) },
    { id: '' },
    { id: { a: 1 } },
  ];
  for (const over of bad) {
    const r = parseSendBody({ messages: [msg(over)] });
    assert(!r.ok, JSON.stringify(over).slice(0, 80));
    assertEquals(r.errors[0].index, 0);
  }
});

Deno.test('validace: duplicitní id a index chyby', () => {
  const r = parseSendBody({ messages: [msg({ id: 'a' }), msg({ id: 'a' }), msg({ id: 'b', to: { email: 'x' } })] });
  assert(!r.ok);
  assertEquals(r.errors.map((e) => e.index), [1, 2]);
  assertEquals(r.errors[1].id, 'b');
});

/* ── odeslání (bez sítě) ── */

const valid = (n = 1): KabinetMessage[] => {
  const r = parseSendBody({ messages: Array.from({ length: n }, (_, i) => msg({ id: `m${i}` })) });
  if (!r.ok) throw new Error('fixture');
  return r.messages;
};

Deno.test('send: tělo pro Ecomail, hlavička key a ecomail_id', async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchFn = ((url: string, init: RequestInit) => {
    seen = { url, init };
    return Promise.resolve(new Response(JSON.stringify({ results: { id: 'abc123', total_accepted_recipients: 1 } }), { status: 200 }));
  }) as unknown as typeof fetch;
  const r = await sendOne(valid()[0], { key: 'K', fetchFn });
  assertEquals(r, { id: 'm0', ok: true, ecomail_id: 'abc123' });
  assertEquals(seen!.url, 'https://api2.ecomailapp.cz/transactional/send-message');
  assertEquals((seen!.init.headers as Record<string, string>).key, 'K');
  const body = JSON.parse(String(seen!.init.body));
  assertEquals(body.message.to, [{ email: 'ucitel@skola.cz', name: 'Jana Nováková' }]);
  assertEquals(body.message.options, { click_tracking: true, open_tracking: true });
  assertEquals(body.message.reply_to, 'vitek@vividbooks.com');
});

Deno.test('send: 429 počká podle Retry-After a zkusí znovu', async () => {
  let calls = 0;
  const waits: number[] = [];
  const fetchFn = (() => {
    calls++;
    if (calls === 1) return Promise.resolve(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }));
    return Promise.resolve(new Response(JSON.stringify({ results: { id: 7 } }), { status: 200 }));
  }) as unknown as typeof fetch;
  const r = await sendOne(valid()[0], { key: 'K', fetchFn, sleep: (ms) => (waits.push(ms), Promise.resolve()) });
  assertEquals(r.ok, true);
  assertEquals(r.ecomail_id, '7');
  assertEquals(waits, [2000]);
});

Deno.test('send: dlouhé Retry-After → retry: true bez čekání', async () => {
  const fetchFn = (() => Promise.resolve(new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }))) as unknown as typeof fetch;
  const r = await sendOne(valid()[0], { key: 'K', fetchFn, sleep: () => Promise.reject(new Error('nemá čekat')) });
  assertEquals(r.ok, false);
  assertEquals(r.retry, true);
});

Deno.test('send: 4xx bez retry, 5xx s retry', async () => {
  const mk = (status: number) => (() => Promise.resolve(new Response('{"errors":"x"}', { status }))) as unknown as typeof fetch;
  const a = await sendOne(valid()[0], { key: 'K', fetchFn: mk(422) });
  assertEquals([a.ok, a.retry], [false, undefined]);
  const b = await sendOne(valid()[0], { key: 'K', fetchFn: mk(503) });
  assertEquals([b.ok, b.retry], [false, true]);
});

Deno.test('sendAll: nejvýš 8 souběžně, pořadí výsledků drží', async () => {
  let active = 0;
  let peak = 0;
  const fetchFn = (async (_u: string, init: RequestInit) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 2));
    active--;
    const subj = JSON.parse(String(init.body)).message.to[0].email;
    return new Response(JSON.stringify({ results: { id: subj } }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await sendAll(valid(30), { key: 'K', fetchFn });
  assertEquals(r.length, 30);
  assertEquals(r.map((x) => x.id), Array.from({ length: 30 }, (_, i) => `m${i}`));
  assert(peak <= 8 && peak > 1, `peak ${peak}`);
});

Deno.test('retryAfterMs a summarizeDomains', () => {
  assertEquals(retryAfterMs('3'), 3000);
  assertEquals(retryAfterMs(null), null);
  assertEquals(retryAfterMs('nesmysl'), null);
  assertEquals(
    summarizeDomains([{ id: 1, domain: 'vividbooks.com', status: 'verified', dkim_valid: true, records: [{ a: 1 }] }]),
    [{ domain: 'vividbooks.com', status: 'verified', dkim_valid: true }],
  );
  assertEquals(summarizeDomains({ data: [{ name: 'a.cz' }] }), [{ name: 'a.cz' }]);
});
