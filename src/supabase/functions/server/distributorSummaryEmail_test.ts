/** deno test --no-check --node-modules-dir=none --allow-read src/supabase/functions/server/distributorSummaryEmail_test.ts */
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';

import {
  DISTRIBUTOR_SUMMARY_RESEND_MIN_AGE_MS,
  distributorSummaryEmailAttempts,
  ensureDistributorSummaryEmail,
  sendDistributorSummaryEmail,
} from './distributorSummaryEmail.ts';

const quiet = () => {};

/** Odpověď, která nikdy nepřijde – dokud ji nezruší `signal` (jako zaseklé volání 9. a 11. 11.). */
function hangingSend(signal: AbortSignal): Promise<Response> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
}

Deno.test('zaseklé volání send-order-email skončí po limitu a zkusí se ještě jednou', async () => {
  let calls = 0;
  const signals: AbortSignal[] = [];
  await sendDistributorSummaryEmail({
    timeoutMs: 30,
    log: quiet,
    send: (signal) => {
      calls++;
      signals.push(signal);
      return calls === 1 ? hangingSend(signal) : Promise.resolve(new Response('{"success":true}', { status: 200 }));
    },
  });
  assertEquals(calls, 2);
  assert(signals[0].aborted, 'první pokus se po limitu zruší');
});

Deno.test('dvakrát zaseklé → chyba (handler ji zapíše do order_events), žádné nekonečné čekání', async () => {
  let calls = 0;
  await assertRejects(
    () => sendDistributorSummaryEmail({ timeoutMs: 20, log: quiet, send: (s) => (calls++, hangingSend(s)) }),
    Error,
    'neodpověděl',
  );
  assertEquals(calls, 2);
});

Deno.test('opakování jen u Resendu (idempotence); nouzový Mandrill = jeden pokus', async () => {
  assertEquals(distributorSummaryEmailAttempts(undefined), 2);
  assertEquals(distributorSummaryEmailAttempts('resend'), 2);
  assertEquals(distributorSummaryEmailAttempts(' Mandrill '), 1);
  let calls = 0;
  await assertRejects(
    () => sendDistributorSummaryEmail({
      timeoutMs: 20,
      attempts: distributorSummaryEmailAttempts('mandrill'),
      log: quiet,
      send: (s) => (calls++, hangingSend(s)),
    }),
    Error,
  );
  assertEquals(calls, 1);
});

Deno.test('HTTP chyba z send-order-email se neopakuje (e-mail mohl být odmítnut)', async () => {
  let calls = 0;
  await assertRejects(
    () => sendDistributorSummaryEmail({
      log: quiet,
      send: () => (calls++, Promise.resolve(new Response('{"error":"Resend 422"}', { status: 500 }))),
    }),
    Error,
    'Resend 422',
  );
  assertEquals(calls, 1);
});

Deno.test('chybová odpověď, jejíž tělo se nedočte, nečeká neomezeně', async () => {
  let calls = 0;
  const stuckBody = () => new Response(new ReadableStream({ start() {/* nikdy nic nepošle */} }), { status: 500 });
  await assertRejects(
    () => sendDistributorSummaryEmail({ timeoutMs: 30, log: quiet, send: () => (calls++, Promise.resolve(stuckBody())) }),
    Error,
    'neodpověděl',
  );
  assertEquals(calls, 2);
});

Deno.test('opakované odeslání formuláře: chybějící shrnutí se doplní, odeslané se neposílá znovu', async () => {
  const old = DISTRIBUTOR_SUMMARY_RESEND_MIN_AGE_MS + 60_000;
  let sends = 0;
  const errors: string[] = [];
  const base = {
    log: quiet,
    send: () => (sends++, Promise.resolve()),
    recordError: (m: string) => (errors.push(m), Promise.resolve()),
  };

  /** VB-2026-0617 / 0621: žádná e-mailová událost → doplnit. */
  assertEquals(await ensureDistributorSummaryEmail({ ...base, orderAgeMs: old, loadEmailEvents: () => Promise.resolve([]) }), 'sent');
  assertEquals(sends, 1);

  /** Už odeslané (details jako jsonb řetězec) → nic. */
  const ok = [{ details: JSON.stringify({ emailType: 'distributor_order_received', subject: 'S' }) }];
  assertEquals(await ensureDistributorSummaryEmail({ ...base, orderAgeMs: old, loadEmailEvents: () => Promise.resolve(ok) }), 'already_sent');
  assertEquals(sends, 1);

  /** Dvojklik: původní požadavek ještě běží → neposílat podruhé. */
  assertEquals(await ensureDistributorSummaryEmail({ ...base, orderAgeMs: 5_000, loadEmailEvents: () => Promise.resolve([]) }), 'too_early');
  assertEquals(sends, 1);

  /** Selhání odeslání se zapíše a nic nespadne. */
  const failing = { ...base, send: () => Promise.reject(new Error('timeout')) };
  assertEquals(await ensureDistributorSummaryEmail({ ...failing, orderAgeMs: old, loadEmailEvents: () => Promise.resolve([]) }), 'failed');
  assertEquals(errors, ['timeout']);
});

/* ---------- zapojení do handleru ---------- */

const here = new URL('.', import.meta.url);

Deno.test('handler: volání send-order-email jde přes limit a deduplikace shrnutí doplní', async () => {
  const src = await Deno.readTextFile(new URL('./index.tsx', here));
  const fnStart = src.indexOf('async function invokeDistributorOrderSummaryEmail(');
  const fnEnd = src.indexOf('\n}\n', fnStart);
  const fn = src.slice(fnStart, fnEnd);
  assert(fn.includes('sendDistributorSummaryEmail('), 'volání s časovým limitem');
  assert(fn.includes("distributorSummaryEmailAttempts(Deno.env.get('TRANSACTIONAL_PROVIDER'))"), 'opakování podle poskytovatele');
  assert(/signal,?\s*\n/.test(fn), 'fetch dostává signal');

  const start = src.indexOf("app.post('/make-server-93a20b6f/distributor/orders'");
  const handler = src.slice(start, src.indexOf('\napp.', start + 10));
  const dedupEnd = handler.indexOf('deduplicated: true');
  const dedupStart = handler.indexOf("insertError.code === '23505'");
  const dedup = handler.slice(dedupStart, dedupEnd);
  assert(dedup.includes('ensureDistributorSummaryEmail('), 'opakovaný POST doplní chybějící shrnutí');
});
