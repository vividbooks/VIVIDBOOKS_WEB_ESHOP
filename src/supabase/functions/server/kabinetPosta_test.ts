/** deno test --node-modules-dir=none src/supabase/functions/server/kabinetPosta_test.ts */
import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  DEFAULT_POSTA_EVENTS_URL,
  formatAddress,
  forwardPostaEvent,
  idempotencyKey,
  type KabinetMessage,
  kabinetPostaAuth,
  MAX_MESSAGES,
  parseSendBody,
  postaEventFromWebhook,
  resendEmail,
  retryAfterMs,
  sanitizeTagValue,
  sendBatch,
  summarizeDomains,
  timingSafeEqualString,
  webhookTag,
} from './kabinetPosta.ts';

const SECRET = 'tajne-sdilene-123';
const env = (vals: Record<string, string>) => (n: string) => vals[n];
const req = (headers: Record<string, string>) => new Request('https://x/kabinet/posta/send', { method: 'POST', headers });

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
    unsubscribe_url: 'https://www.vividbooks.com/odhlasit?t=abc',
    kampan: 'rozhybat-matiku',
    varianta: 'A',
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
  assertEquals(kabinetPostaAuth(req({ 'x-identity-secret': SECRET }), env({ IDENTITY_UPSERT_SECRET: SECRET })), { ok: true });
});

Deno.test('auth: špatné / chybějící tajemství → 401', () => {
  const e = env({ IDENTITY_UPSERT_SECRET: SECRET });
  assertEquals(kabinetPostaAuth(req({ 'x-identity-secret': 'jine' }), e).ok, false);
  const r = kabinetPostaAuth(req({}), e);
  assert(!r.ok && r.status === 401);
});

Deno.test('auth: tajemství v Authorization ani service-role JWT neplatí', () => {
  const e = env({ IDENTITY_UPSERT_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: 'srv' });
  assertEquals(kabinetPostaAuth(req({ Authorization: `Bearer ${SECRET}` }), e).ok, false);
  assertEquals(kabinetPostaAuth(req({ 'x-identity-secret': 'srv' }), e).ok, false);
});

Deno.test('auth: nenastavené tajemství na serveru → 503, i prázdná hlavička neprojde', () => {
  const r = kabinetPostaAuth(req({ 'x-identity-secret': '' }), env({}));
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

Deno.test('validace: max 100 zpráv', () => {
  assertEquals(MAX_MESSAGES, 100);
  const ok = Array.from({ length: MAX_MESSAGES }, (_, i) => msg({ id: `m${i}` }));
  assert(parseSendBody({ messages: ok }).ok);
  assert(!parseSendBody({ messages: [...ok, msg({ id: 'navic' })] }).ok);
});

Deno.test('validace: from_email jen vividbooks.com a subdomény', () => {
  for (const from of ['x@gmail.com', 'x@vividbooks.com.evil.cz', 'x@evilvividbooks.com', 'x@evil-vividbooks.com', 'neni-mail']) {
    assert(!parseSendBody({ messages: [msg({ from_email: from })] }).ok, from);
  }
  for (const from of ['Hello@VividBooks.com', 'vitek@news.vividbooks.com', 'a@b.c.vividbooks.com']) {
    assert(parseSendBody({ messages: [msg({ from_email: from })] }).ok, from);
  }
});

Deno.test('validace: chyby e-mailů, délek, hlaviček a odhlášení', () => {
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
    { unsubscribe_url: '' },
    { unsubscribe_url: 'http://www.vividbooks.com/odhlasit' },
    { unsubscribe_url: 'nesmysl' },
    { unsubscribe_url: 'https://x.cz/a>b' },
    { kampan: '' },
  ];
  for (const over of bad) {
    const r = parseSendBody({ messages: [msg(over)] });
    assert(!r.ok, JSON.stringify(over).slice(0, 80));
    assertEquals(r.errors[0].index, 0);
  }
  assert(parseSendBody({ messages: [msg({ varianta: undefined })] }).ok);
});

Deno.test('validace: duplicitní id a index chyby', () => {
  const r = parseSendBody({ messages: [msg({ id: 'a' }), msg({ id: 'a' }), msg({ id: 'b', to: { email: 'x' } })] });
  assert(!r.ok);
  assertEquals(r.errors.map((e) => e.index), [1, 2]);
  assertEquals(r.errors[1].id, 'b');
});

/* ── sestavení požadavku ── */

const valid = (n = 1, over: Record<string, unknown> = {}): KabinetMessage[] => {
  const r = parseSendBody({ messages: Array.from({ length: n }, (_, i) => msg({ id: `m${i}`, ...over })) });
  if (!r.ok) throw new Error('fixture: ' + JSON.stringify(r.errors));
  return r.messages;
};

Deno.test('sanitizeTagValue', () => {
  assertEquals(sanitizeTagValue('rozhybat-matiku_2'), 'rozhybat-matiku_2');
  assertEquals(sanitizeTagValue('Říjen 2026 / vlna 1'), 'Rijen_2026_vlna_1');
  assertEquals(sanitizeTagValue('a.b@c'), 'a_b_c');
  assertEquals(sanitizeTagValue(''), 'none');
  assertEquals(sanitizeTagValue('***'), 'none');
  assertEquals(sanitizeTagValue('x'.repeat(300)).length, 256);
});

Deno.test('formatAddress', () => {
  assertEquals(formatAddress('Vítek Škop', 'vitek@vividbooks.com'), 'Vítek Škop <vitek@vividbooks.com>');
  assertEquals(formatAddress(undefined, 'a@b.cz'), 'a@b.cz');
  assertEquals(formatAddress('Novák, Jan', 'a@b.cz'), '"Novák, Jan" <a@b.cz>');
  assertEquals(formatAddress('Zlý "<x@y.cz>"', 'a@b.cz'), '"Zlý x@y.cz" <a@b.cz>');
});

Deno.test('resendEmail: from, to, reply_to, hlavičky odhlášení a tagy', () => {
  const [m] = valid(1, { id: 'uuid-1.2', kampan: 'Rozhýbat matiku', varianta: 'B/2' });
  assertEquals(resendEmail(m), {
    from: 'Vítek Škop <vitek@vividbooks.com>',
    to: ['Jana Nováková <ucitel@skola.cz>'],
    reply_to: 'vitek@vividbooks.com',
    subject: 'Dobrý den',
    text: 'Ahoj',
    html: '<p>Ahoj</p>',
    headers: {
      'List-Unsubscribe': '<https://www.vividbooks.com/odhlasit?t=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'posta_id', value: 'uuid-1_2' },
      { name: 'kampan', value: 'Rozhybat_matiku' },
      { name: 'varianta', value: 'B_2' },
    ],
  });
});

Deno.test('idempotencyKey: závisí na id, max 256 znaků', async () => {
  const a = await idempotencyKey(valid(2));
  assertEquals(a, await idempotencyKey(valid(2)));
  assert(a !== await idempotencyKey(valid(3)));
  assert(a.length <= 256);
});

/* ── odeslání (bez sítě) ── */

type Seen = { url: string; init: RequestInit };
const okBatch = (n: number) => new Response(JSON.stringify({ data: Array.from({ length: n }, (_, i) => ({ id: `re_${i}` })) }), { status: 200 });

Deno.test('sendBatch: jeden POST na /emails/batch, Bearer, Idempotency-Key, resend_id podle pořadí', async () => {
  const seen: Seen[] = [];
  const fetchFn = ((url: string, init: RequestInit) => {
    seen.push({ url, init });
    return Promise.resolve(okBatch(3));
  }) as unknown as typeof fetch;
  const r = await sendBatch(valid(3), { key: 'K', fetchFn });
  assertEquals(r, [
    { id: 'm0', ok: true, resend_id: 're_0' },
    { id: 'm1', ok: true, resend_id: 're_1' },
    { id: 'm2', ok: true, resend_id: 're_2' },
  ]);
  assertEquals(seen.length, 1);
  assertEquals(seen[0].url, 'https://api.resend.com/emails/batch');
  const h = seen[0].init.headers as Record<string, string>;
  assertEquals(h.Authorization, 'Bearer K');
  assert(h['Idempotency-Key'].startsWith('kabinet-posta-'));
  const body = JSON.parse(String(seen[0].init.body));
  assertEquals(body.length, 3);
  assertEquals(body[1].tags[0], { name: 'posta_id', value: 'm1' });
  assertEquals(body[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

Deno.test('sendBatch: 429 počká podle Retry-After a zkusí znovu', async () => {
  let calls = 0;
  const waits: number[] = [];
  const fetchFn = (() => {
    calls++;
    if (calls === 1) return Promise.resolve(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }));
    return Promise.resolve(okBatch(1));
  }) as unknown as typeof fetch;
  const r = await sendBatch(valid(), { key: 'K', fetchFn, sleep: (ms) => (waits.push(ms), Promise.resolve()) });
  assertEquals(r[0].ok, true);
  assertEquals(waits, [2000]);
});

Deno.test('sendBatch: dlouhé Retry-After → retry: true u všech, bez čekání', async () => {
  const fetchFn = (() => Promise.resolve(new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }))) as unknown as typeof fetch;
  const r = await sendBatch(valid(2), { key: 'K', fetchFn, sleep: () => Promise.reject(new Error('nemá čekat')) });
  assertEquals(r.map((x) => [x.ok, x.retry]), [[false, true], [false, true]]);
});

Deno.test('sendBatch: 422 bez retry, 503 po opakováních s retry, síť s retry', async () => {
  const mk = (status: number) => (() => Promise.resolve(new Response('{"name":"validation_error","message":"x"}', { status }))) as unknown as typeof fetch;
  const a = await sendBatch(valid(), { key: 'K', fetchFn: mk(422) });
  assertEquals([a[0].ok, a[0].retry, a[0].error], [false, undefined, 'Resend 422: validation_error: x']);
  const b = await sendBatch(valid(), { key: 'K', fetchFn: mk(503), sleep: () => Promise.resolve() });
  assertEquals([b[0].ok, b[0].retry], [false, true]);
  const c = await sendBatch(valid(), { key: 'K', fetchFn: (() => Promise.reject(new Error('down'))) as unknown as typeof fetch });
  assertEquals([c[0].ok, c[0].retry], [false, true]);
});

Deno.test('retryAfterMs a summarizeDomains', () => {
  assertEquals(retryAfterMs('3'), 3000);
  assertEquals(retryAfterMs(null), null);
  assertEquals(retryAfterMs('nesmysl'), null);
  assertEquals(
    summarizeDomains({ object: 'list', data: [{ id: 'd1', name: 'vividbooks.com', status: 'verified', region: 'eu-west-1' }] }),
    [{ name: 'vividbooks.com', status: 'verified' }],
  );
  assertEquals(summarizeDomains(null), []);
});

/* ── webhook ── */

Deno.test('webhookTag: objekt i pole', () => {
  assertEquals(webhookTag({ posta_id: 'p1', kampan: 'k' }, 'posta_id'), 'p1');
  assertEquals(webhookTag([{ name: 'kampan', value: 'k' }, { name: 'posta_id', value: 'p2' }], 'posta_id'), 'p2');
  assertEquals(webhookTag({ kampan: 'k' }, 'posta_id'), null);
  assertEquals(webhookTag(undefined, 'posta_id'), null);
  assertEquals(webhookTag([{ name: 'posta_id', value: '' }], 'posta_id'), null);
});

Deno.test('postaEventFromWebhook: klik, bounce, bez tagu', () => {
  const click = postaEventFromWebhook({
    created_at: '2026-10-13T10:00:00.000Z',
    data: { to: ['Ucitel@Skola.cz'], tags: { posta_id: 'p1' }, click: { link: 'https://www.vividbooks.com/x' } },
  }, 'click');
  assertEquals(click, {
    posta_id: 'p1',
    type: 'click',
    created_at: '2026-10-13T10:00:00.000Z',
    email: 'ucitel@skola.cz',
    click_url: 'https://www.vividbooks.com/x',
  });
  const bounce = postaEventFromWebhook({ created_at: '2026-10-13T10:00:00Z', data: { to: 'a@b.cz', tags: [{ name: 'posta_id', value: 'p2' }] } }, 'bounce', 'hard');
  assertEquals(bounce?.bounce_type, 'hard');
  assertEquals(bounce?.email, 'a@b.cz');
  assertEquals(bounce?.click_url, undefined);
  const open = postaEventFromWebhook({ data: { to: ['a@b.cz'], tags: { posta_id: 'p3' }, click: { link: 'x' } } }, 'open', null);
  assertEquals(open?.click_url, undefined);
  assertEquals(open?.bounce_type, undefined);
  assert(!Number.isNaN(Date.parse(open!.created_at)));
  assertEquals(postaEventFromWebhook({ data: { to: ['a@b.cz'], tags: { kampan: 'k' } } }, 'open'), null);
});

Deno.test('forwardPostaEvent: URL, hlavička, tělo; chyba nevyhazuje', async () => {
  const ev = { posta_id: 'p1', type: 'open', created_at: '2026-10-13T10:00:00.000Z', email: 'a@b.cz' };
  const seen: Seen[] = [];
  const fetchFn = ((url: string, init: RequestInit) => {
    seen.push({ url, init });
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as unknown as typeof fetch;
  assertEquals(await forwardPostaEvent(ev, { getEnv: env({ IDENTITY_UPSERT_SECRET: SECRET }), fetchFn }), { ok: true });
  assertEquals(seen[0].url, DEFAULT_POSTA_EVENTS_URL);
  assertEquals((seen[0].init.headers as Record<string, string>)['x-identity-secret'], SECRET);
  assertEquals(JSON.parse(String(seen[0].init.body)), { events: [ev] });

  await forwardPostaEvent(ev, { getEnv: env({ IDENTITY_UPSERT_SECRET: SECRET, ULTRA_POSTA_EVENTS_URL: 'https://jinde.cz/u' }), fetchFn });
  assertEquals(seen[1].url, 'https://jinde.cz/u');

  const down = await forwardPostaEvent(ev, { getEnv: env({ IDENTITY_UPSERT_SECRET: SECRET }), fetchFn: (() => Promise.reject(new Error('down'))) as unknown as typeof fetch });
  assertEquals(down.ok, false);
  const e500 = await forwardPostaEvent(ev, { getEnv: env({ IDENTITY_UPSERT_SECRET: SECRET }), fetchFn: (() => Promise.resolve(new Response('', { status: 500 }))) as unknown as typeof fetch });
  assertEquals(e500, { ok: false, error: 'Kabinet 500' });
  assertEquals((await forwardPostaEvent(ev, { getEnv: env({}), fetchFn })).ok, false);
});
