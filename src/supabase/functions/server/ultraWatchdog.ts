/**
 * Hlídač produkční databáze Vividbooks Ultra (projekt qypiuvqglsmxdsnyazih).
 *
 * Běží na projektu webu, tedy mimo infrastrukturu Ultra: pg_cron tady každou
 * minutu zavolá /cron/ultra-watchdog, ten změří tři sondy (databáze přes
 * PostgREST, Auth, Edge) a při změně stavu pošle e-mail přes Resend.
 *
 *  - „spadla“: databázová sonda selže 2× za sebou (≈ 2 minuty)
 *  - „zase běží“: po výpadku 2× za sebou uspěje
 *  - „je pomalá“: sonda trvá přes 5 s 3× za sebou (nejvýš jednou za hodinu)
 *  - připomínka každou hodinu, dokud výpadek trvá
 *
 * Stav je v KV (klíč ultra-watchdog:state), aby se e-maily neposílaly každou minutu.
 */
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendResendEmail } from './resendClient.ts';

const ULTRA_URL = 'https://qypiuvqglsmxdsnyazih.supabase.co';
const STATE_KEY = 'ultra-watchdog:state';
const PROBE_TIMEOUT_MS = 8_000;
const SLOW_MS = 5_000;
const DOWN_AFTER = 2;
const UP_AFTER = 2;
const SLOW_AFTER = 3;
const REMINDER_MS = 60 * 60_000;
const SLOW_ALERT_MS = 60 * 60_000;

type Probe = { name: string; ok: boolean; status: number | null; ms: number; error?: string };

type WatchdogState = {
  status: 'ok' | 'down';
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  slowStreak: number;
  since: string | null;
  lastCheckAt: string | null;
  lastAlertAt: string | null;
  lastSlowAlertAt: string | null;
  lastProbes: Probe[];
  lastEmail: string | null;
};

const defaultState = (): WatchdogState => ({
  status: 'ok',
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  slowStreak: 0,
  since: null,
  lastCheckAt: null,
  lastAlertAt: null,
  lastSlowAlertAt: null,
  lastProbes: [],
  lastEmail: null,
});

function alertRecipient(): string {
  return Deno.env.get('ULTRA_WATCHDOG_ALERT_TO')?.trim() || 'vitekskop@gmail.com';
}

function ultraAnonKey(): string {
  return Deno.env.get('ULTRA_ANON_KEY')?.trim() || '';
}

async function runProbe(name: string, url: string, init: RequestInit): Promise<Probe> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    // Tělo přečíst, aby se sonda počítala až po celé odpovědi (ne jen hlavičkách).
    await res.text().catch(() => '');
    return { name, ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, ok: false, status: null, ms: Date.now() - started, error: message.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeUltra(): Promise<Probe[]> {
  const anon = ultraAnonKey();
  return await Promise.all([
    runProbe('Databáze (PostgREST → Postgres)', `${ULTRA_URL}/rest/v1/rpc/health_ping`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
      body: '{}',
    }),
    runProbe('Auth', `${ULTRA_URL}/auth/v1/health`, { method: 'GET', headers: { apikey: anon } }),
    runProbe('Edge funkce api', `${ULTRA_URL}/functions/v1/api/health`, { method: 'GET', headers: { apikey: anon } }),
  ]);
}

function pragueTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
  } catch {
    return iso;
  }
}

function probesText(probes: Probe[]): string {
  return probes
    .map((p) => `• ${p.name}: ${p.ok ? 'OK' : 'CHYBA'} (${p.status ?? 'bez odpovědi'}, ${p.ms} ms${p.error ? `, ${p.error}` : ''})`)
    .join('\n');
}

async function notify(kind: 'down' | 'up' | 'slow' | 'reminder' | 'test', state: WatchdogState, probes: Probe[]): Promise<string | null> {
  const now = new Date().toISOString();
  const subject =
    kind === 'test'
      ? '🛠️ Vividbooks Ultra: hlídač databáze je zapnutý (zkušební e-mail)'
      : kind === 'down'
      ? '🔴 Vividbooks Ultra: databáze neodpovídá'
      : kind === 'up'
        ? '🟢 Vividbooks Ultra: databáze zase běží'
        : kind === 'slow'
          ? '🟠 Vividbooks Ultra: databáze je pomalá'
          : '🔴 Vividbooks Ultra: databáze stále neodpovídá';
  const lead =
    kind === 'test'
      ? 'Tohle je zkušební e-mail. Hlídač běží každou minutu a ozve se, když databáze přestane odpovídat, zase naběhne nebo bude dlouhodobě pomalá.'
      : kind === 'down'
      ? `Databázová sonda selhala ${state.consecutiveFailures}× za sebou.`
      : kind === 'up'
        ? `Výpadek trval od ${pragueTime(state.since)} do ${pragueTime(now)}.`
        : kind === 'slow'
          ? `Sonda do databáze trvá přes ${SLOW_MS / 1000} s už ${state.slowStreak}× za sebou.`
          : `Výpadek trvá od ${pragueTime(state.since)}.`;
  const text = [
    lead,
    '',
    `Čas kontroly: ${pragueTime(now)}`,
    '',
    probesText(probes),
    '',
    'Uživatelům se v aplikaci při selháních automaticky ukazuje bobánek s odkazem na app.vividbooks.com.',
    '',
    'Dashboard: https://supabase.com/dashboard/project/qypiuvqglsmxdsnyazih',
    'Logy: https://supabase.com/dashboard/project/qypiuvqglsmxdsnyazih/logs/postgres-logs',
    '',
    '— hlídač na projektu webu (make-server-93a20b6f, /cron/ultra-watchdog)',
  ].join('\n');
  const result = await sendResendEmail({
    to: alertRecipient(),
    subject,
    text,
    tags: [{ name: 'kind', value: `ultra-watchdog-${kind}` }],
  });
  if (!result.ok) {
    console.error('[ultra-watchdog] e-mail se neodeslal:', result.status, result.error);
    return null;
  }
  return `${kind}@${now}`;
}

export async function runUltraWatchdogCheck(): Promise<{ state: WatchdogState; probes: Probe[]; sent: string | null }> {
  const stored = (await kv.get(STATE_KEY).catch(() => null)) as Partial<WatchdogState> | null;
  const state: WatchdogState = { ...defaultState(), ...(stored || {}) };
  const probes = await probeUltra();
  const db = probes[0];
  const now = new Date();
  const nowIso = now.toISOString();
  let sent: string | null = null;

  state.lastCheckAt = nowIso;
  state.lastProbes = probes;

  if (!db.ok) {
    state.consecutiveFailures += 1;
    state.consecutiveSuccesses = 0;
    state.slowStreak = 0;
    if (state.status === 'ok' && state.consecutiveFailures >= DOWN_AFTER) {
      state.status = 'down';
      state.since = nowIso;
      sent = await notify('down', state, probes);
      state.lastAlertAt = nowIso;
    } else if (
      state.status === 'down' &&
      state.lastAlertAt &&
      now.getTime() - new Date(state.lastAlertAt).getTime() >= REMINDER_MS
    ) {
      sent = await notify('reminder', state, probes);
      state.lastAlertAt = nowIso;
    }
  } else {
    state.consecutiveSuccesses += 1;
    state.consecutiveFailures = 0;
    if (state.status === 'down' && state.consecutiveSuccesses >= UP_AFTER) {
      sent = await notify('up', state, probes);
      state.status = 'ok';
      state.since = null;
      state.lastAlertAt = nowIso;
    }
    if (db.ms > SLOW_MS) {
      state.slowStreak += 1;
      const lastSlow = state.lastSlowAlertAt ? new Date(state.lastSlowAlertAt).getTime() : 0;
      if (state.status === 'ok' && state.slowStreak >= SLOW_AFTER && now.getTime() - lastSlow >= SLOW_ALERT_MS) {
        sent = await notify('slow', state, probes);
        state.lastSlowAlertAt = nowIso;
      }
    } else {
      state.slowStreak = 0;
    }
  }

  if (sent) state.lastEmail = sent;
  await kv.set(STATE_KEY, state);
  return { state, probes, sent };
}

function cronAuthorized(c: Context): boolean {
  const secrets = [Deno.env.get('ULTRA_WATCHDOG_CRON_SECRET')?.trim(), Deno.env.get('MAILING_CRON_SECRET')?.trim()].filter(
    (value): value is string => Boolean(value),
  );
  const auth = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const hdr = c.req.header('X-Cron-Secret') || '';
  return secrets.some((secret) => auth === secret || hdr === secret);
}

/** POST /cron/ultra-watchdog — volá pg_cron každou minutu (stejné tajemství jako mailing cron). */
export async function handleUltraWatchdogCron(c: Context) {
  if (!cronAuthorized(c)) return c.json({ error: 'Unauthorized' }, 401);
  try {
    if (c.req.query('test') === '1') {
      const probes = await probeUltra();
      const sent = await notify('test', defaultState(), probes);
      return c.json({ ok: Boolean(sent), test: true, sent, probes });
    }
    const result = await runUltraWatchdogCheck();
    return c.json({ ok: true, status: result.state.status, sent: result.sent, probes: result.probes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ultra-watchdog] kontrola selhala:', message);
    return c.json({ ok: false, error: message }, 500);
  }
}

/** GET /ultra-watchdog/status — poslední stav bez tajemství (pro rychlý pohled). */
export async function handleUltraWatchdogStatus(c: Context) {
  const stored = (await kv.get(STATE_KEY).catch(() => null)) as WatchdogState | null;
  return c.json(stored || defaultState(), 200, { 'Cache-Control': 'no-store' });
}
