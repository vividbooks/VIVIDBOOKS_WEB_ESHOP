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
 *
 * Kromě Ultra hlídá i vlastní kritické routy webu (`probeWebRoutes`) — volají se
 * bez tajemství, takže 401 znamená „routa žije“, 404 „routa v nasazené verzi chybí“
 * a BOOT_ERROR „funkce nenaběhla“. Rozlišení je tam schválně: v září 2026 zmizel
 * z nasazené verze /identity/registr-export a 404 se dva a půl dne pletlo za spadlou
 * funkci, přestože web celou dobu běžel.
 *
 * Jednou za hodinu navíc zavolá hlídač synchronizací Kabinetu na projektu Ultra
 * a když hlásí problémy, pošle je mailem — Kabinet sám Resend klíč nemá.
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

/** Vlastní funkce webu — sonduje se zvenčí přes veřejnou URL, ať platí stejná cesta jako pro Kabinet. */
const WEB_FN_URL = 'https://iekkundgizzdbmkzatdl.supabase.co/functions/v1/make-server-93a20b6f';
/** Routy, bez kterých nedotečou data do registru. Volají se bez tajemství, čeká se 401. */
const WEB_ROUTES: { name: string; path: string }[] = [
  { name: 'Export do registru', path: '/identity/registr-export?limit=1' },
  { name: 'Export webinářů do registru', path: '/identity/registr-webinars?limit=1' },
];
const KABINET_WATCHDOG_URL = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/registr/hooks/sync/watchdog';
const KABINET_INTERVAL_MS = 60 * 60_000;
const WEB_DOWN_AFTER = 2;
const WEB_REMINDER_MS = 60 * 60_000;

type Probe = { name: string; ok: boolean; status: number | null; ms: number; error?: string };

/** Tři stavy, které se nesmí zaměnit — proto je nese sonda samostatně, ne jen jako ok/chyba. */
type RouteVerdict = 'ok' | 'missing-route' | 'boot-error' | 'unknown';

type RouteProbe = Probe & { verdict: RouteVerdict; path: string };

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
  webStatus: 'ok' | 'broken';
  webConsecutiveFailures: number;
  webSince: string | null;
  webLastAlertAt: string | null;
  webLastProbes: RouteProbe[];
  kabinetLastCheckAt: string | null;
  kabinetLastAlertAt: string | null;
  kabinetLastProblems: number | null;
  kabinetLastError: string | null;
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
  webStatus: 'ok',
  webConsecutiveFailures: 0,
  webSince: null,
  webLastAlertAt: null,
  webLastProbes: [],
  kabinetLastCheckAt: null,
  kabinetLastAlertAt: null,
  kabinetLastProblems: null,
  kabinetLastError: null,
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

/**
 * Sonda na vlastní routu webu. Volá se schválně bez tajemství, takže zdravá routa
 * odpoví 401 — tím se pozná, že v nasazené verzi existuje. Rozlišuje tři stavy:
 *  - 401 (nebo 200)  → routa žije
 *  - 404             → routa v nasazené verzi chybí (funkce běží, jen ji nezná)
 *  - BOOT_ERROR/503  → funkce vůbec nenaběhla
 */
async function probeWebRoute(name: string, path: string): Promise<RouteProbe> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${WEB_FN_URL}${path}`, { method: 'GET', signal: controller.signal });
    const body = await res.text().catch(() => '');
    const ms = Date.now() - started;
    let verdict: RouteVerdict = 'unknown';
    if (res.status === 401 || res.status === 200) verdict = 'ok';
    else if (res.status === 404) verdict = 'missing-route';
    else if (body.includes('BOOT_ERROR') || res.status === 503) verdict = 'boot-error';
    return { name, path, verdict, ok: verdict === 'ok', status: res.status, ms };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name,
      path,
      verdict: 'unknown',
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: message.slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeWebRoutes(): Promise<RouteProbe[]> {
  return await Promise.all(WEB_ROUTES.map((route) => probeWebRoute(route.name, route.path)));
}

function verdictLabel(verdict: RouteVerdict): string {
  switch (verdict) {
    case 'ok':
      return 'v pořádku (routa odpovídá 401, jak má)';
    case 'missing-route':
      return 'CHYBÍ ROUTA — funkce běží, ale nasazená verze tuhle cestu nezná (404). Nejspíš se nasadilo z větve, kde ten kód není.';
    case 'boot-error':
      return 'SPADLÁ FUNKCE — edge funkce vůbec nenaběhla (BOOT_ERROR), typicky chybí modul nebo export.';
    default:
      return 'NEJASNÝ STAV — odpověď nesedí na žádný ze známých případů.';
  }
}

function webProbesText(probes: RouteProbe[]): string {
  return probes
    .map(
      (p) =>
        `• ${p.name} (${p.path.split('?')[0]}): ${verdictLabel(p.verdict)}\n  odpověď ${p.status ?? 'žádná'}, ${p.ms} ms${p.error ? `, ${p.error}` : ''}`,
    )
    .join('\n');
}

/** Hlídač synchronizací Kabinetu. Tajemství je z projektu Ultra; bez něj se kontrola přeskočí. */
async function checkKabinetSync(): Promise<{ skipped: boolean; problems: number | null; text: string; error: string | null }> {
  const secret = Deno.env.get('REGISTR_SYNC_SECRET')?.trim() || '';
  if (!secret) {
    return {
      skipped: true,
      problems: null,
      text: '',
      error: 'REGISTR_SYNC_SECRET není na projektu webu nastavený, kontrola Kabinetu se přeskakuje.',
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(KABINET_WATCHDOG_URL, {
      method: 'POST',
      headers: { 'x-registr-secret': secret, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
    const raw = await res.text().catch(() => '');
    if (!res.ok) {
      return { skipped: false, problems: null, text: '', error: `Kabinet odpověděl ${res.status}: ${raw.slice(0, 200)}` };
    }
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { skipped: false, problems: null, text: '', error: `Kabinet nevrátil JSON: ${raw.slice(0, 200)}` };
    }
    const problems = typeof data.problems === 'number' ? data.problems : null;
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const text = sources
      .map((source) => {
        const row = (source || {}) as Record<string, unknown>;
        const name = String(row.name ?? row.source ?? row.key ?? 'zdroj');
        const detail = Object.entries(row)
          .filter(([key]) => !['name', 'source', 'key'].includes(key))
          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
          .join(', ');
        return `• ${name}${detail ? ` — ${detail}` : ''}`;
      })
      .join('\n');
    return { skipped: false, problems, text: text || raw.slice(0, 1000), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { skipped: false, problems: null, text: '', error: message.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resend bere jen `html`. Hlídač si texty skládá po řádcích, takže je tady zabalíme —
 * bez toho odejde e-mail s prázdným tělem (tak to bylo do 7. 9. 2026 u všech hlášek o Ultra).
 */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;white-space:pre-wrap">${escaped}</div>`;
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
    html: textToHtml(text),
    tags: [{ name: 'kind', value: `ultra-watchdog-${kind}` }],
  });
  if (!result.ok) {
    console.error('[ultra-watchdog] e-mail se neodeslal:', result.status, result.error);
    return null;
  }
  return `${kind}@${now}`;
}

/** E-mail o vlastních routách webu. Do předmětu i textu jde, který ze tří stavů nastal. */
async function notifyWeb(kind: 'broken' | 'reminder' | 'fixed', state: WatchdogState, probes: RouteProbe[]): Promise<string | null> {
  const now = new Date().toISOString();
  const bad = probes.filter((p) => p.verdict !== 'ok');
  const missing = bad.some((p) => p.verdict === 'missing-route');
  const boot = bad.some((p) => p.verdict === 'boot-error');
  const headline = boot
    ? 'spadlá funkce (BOOT_ERROR)'
    : missing
      ? 'chybějící routa (404)'
      : 'nejasný stav';
  const subject =
    kind === 'fixed'
      ? '🟢 Vividbooks web: routy pro registr zase odpovídají'
      : kind === 'reminder'
        ? `🔴 Vividbooks web: ${headline} trvá`
        : `🔴 Vividbooks web: ${headline}`;
  const lead =
    kind === 'fixed'
      ? `Výpadek trval od ${pragueTime(state.webSince)} do ${pragueTime(now)}. Data, která mezitím nedotekla, dotáhne synchronizace v Kabinetu.`
      : boot
        ? 'Edge funkce webu vůbec nenaběhla. Nasazená verze se nespustí — podívej se do logů funkce na chybějící modul nebo export.'
        : missing
          ? 'Funkce webu běží, ale nasazená verze tuhle routu nezná. Nejde o pád: kód s routou nejspíš není ve větvi main, ze které nasazuje CI.'
          : 'Sonda dostala odpověď, která nesedí na žádný známý případ. Mrkni na to ručně.';
  const text = [
    lead,
    '',
    `Čas kontroly: ${pragueTime(now)}`,
    '',
    webProbesText(probes),
    '',
    'Co to znamená:',
    '• 401 = routa v nasazené verzi existuje a chce tajemství — správný stav.',
    '• 404 = routa v nasazené verzi chybí, přestože funkce běží.',
    '• BOOT_ERROR = funkce nenaběhla vůbec.',
    '',
    'Deploy: GitHub Actions → „Deploy Supabase Edge functions“ (nasazuje z větve main).',
    'Logy: https://supabase.com/dashboard/project/iekkundgizzdbmkzatdl/functions',
    '',
    '— hlídač na projektu webu (make-server-93a20b6f, /cron/ultra-watchdog)',
  ].join('\n');
  const result = await sendResendEmail({
    to: alertRecipient(),
    subject,
    html: textToHtml(text),
    tags: [{ name: 'kind', value: `web-watchdog-${kind}` }],
  });
  if (!result.ok) {
    console.error('[ultra-watchdog] e-mail o routách webu se neodeslal:', result.status, result.error);
    return null;
  }
  return `web-${kind}@${now}`;
}

/** E-mail o synchronizacích Kabinetu — posílá se jen když hlídač hlásí problémy. */
async function notifyKabinet(problems: number, detail: string): Promise<string | null> {
  const now = new Date().toISOString();
  const text = [
    `Hlídač synchronizací Kabinetu hlásí ${problems} ${problems === 1 ? 'problém' : problems < 5 ? 'problémy' : 'problémů'}.`,
    '',
    `Čas kontroly: ${pragueTime(now)}`,
    '',
    detail || '(hlídač neposlal podrobnosti)',
    '',
    'Kabinet: https://app.vividbooks.com',
    '',
    '— hlídač na projektu webu (make-server-93a20b6f, /cron/ultra-watchdog)',
  ].join('\n');
  const result = await sendResendEmail({
    to: alertRecipient(),
    subject: `🟠 Kabinet: synchronizace hlásí ${problems} ${problems === 1 ? 'problém' : 'problémů'}`,
    html: textToHtml(text),
    tags: [{ name: 'kind', value: 'kabinet-sync-watchdog' }],
  });
  if (!result.ok) {
    console.error('[ultra-watchdog] e-mail o Kabinetu se neodeslal:', result.status, result.error);
    return null;
  }
  return `kabinet@${now}`;
}

/** Sondy na vlastní routy webu + stavová logika, ať mail nechodí každou minutu. */
async function runWebRoutesCheck(state: WatchdogState, now: Date): Promise<string | null> {
  const nowIso = now.toISOString();
  const probes = await probeWebRoutes();
  state.webLastProbes = probes;
  const broken = probes.filter((p) => p.verdict !== 'ok');
  let sent: string | null = null;

  if (broken.length) {
    state.webConsecutiveFailures += 1;
    if (state.webStatus === 'ok' && state.webConsecutiveFailures >= WEB_DOWN_AFTER) {
      state.webStatus = 'broken';
      state.webSince = nowIso;
      sent = await notifyWeb('broken', state, probes);
      state.webLastAlertAt = nowIso;
    } else if (
      state.webStatus === 'broken' &&
      state.webLastAlertAt &&
      now.getTime() - new Date(state.webLastAlertAt).getTime() >= WEB_REMINDER_MS
    ) {
      sent = await notifyWeb('reminder', state, probes);
      state.webLastAlertAt = nowIso;
    }
  } else {
    state.webConsecutiveFailures = 0;
    if (state.webStatus === 'broken') {
      sent = await notifyWeb('fixed', state, probes);
      state.webStatus = 'ok';
      state.webSince = null;
      state.webLastAlertAt = nowIso;
    }
  }
  return sent;
}

/** Hodinové zavolání hlídače Kabinetu. Mail jen při problems > 0. */
async function runKabinetCheck(state: WatchdogState, now: Date): Promise<string | null> {
  const last = state.kabinetLastCheckAt ? new Date(state.kabinetLastCheckAt).getTime() : 0;
  if (now.getTime() - last < KABINET_INTERVAL_MS) return null;

  const nowIso = now.toISOString();
  state.kabinetLastCheckAt = nowIso;
  const result = await checkKabinetSync();
  state.kabinetLastError = result.error;
  state.kabinetLastProblems = result.problems;
  if (result.skipped) {
    console.log('[ultra-watchdog]', result.error);
    return null;
  }
  if (result.error) {
    console.error('[ultra-watchdog] hlídač Kabinetu selhal:', result.error);
    return null;
  }
  if (typeof result.problems === 'number' && result.problems > 0) {
    const sent = await notifyKabinet(result.problems, result.text);
    if (sent) state.kabinetLastAlertAt = nowIso;
    return sent;
  }
  return null;
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

  // Vlastní routy webu a hlídač Kabinetu běží nezávisle na stavu Ultra — každý má svou
  // stavovou logiku, ať se e-maily nepřebíjejí a nechodí každou minutu.
  const webSent = await runWebRoutesCheck(state, now).catch((error) => {
    console.error('[ultra-watchdog] kontrola rout webu selhala:', error);
    return null;
  });
  const kabinetSent = await runKabinetCheck(state, now).catch((error) => {
    console.error('[ultra-watchdog] kontrola Kabinetu selhala:', error);
    return null;
  });

  sent = sent || webSent || kabinetSent;
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
    // ?probe=web — jen sondy na vlastní routy a stav Kabinetu, bez mailu a bez zápisu stavu.
    if (c.req.query('probe') === 'web') {
      const webProbes = await probeWebRoutes();
      const kabinet = await checkKabinetSync();
      return c.json({
        ok: webProbes.every((p) => p.verdict === 'ok'),
        webProbes,
        kabinet: { skipped: kabinet.skipped, problems: kabinet.problems, error: kabinet.error },
      });
    }
    const result = await runUltraWatchdogCheck();
    return c.json({
      ok: true,
      status: result.state.status,
      sent: result.sent,
      probes: result.probes,
      webStatus: result.state.webStatus,
      webProbes: result.state.webLastProbes,
      kabinetProblems: result.state.kabinetLastProblems,
    });
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
