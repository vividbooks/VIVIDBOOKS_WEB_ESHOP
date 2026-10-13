/**
 * Osobní maily Kabinetu (Vividbooks Ultra) přes transakční API Ecomailu.
 *
 * Klíč `ECOMAIL_KEY` žije jen tady ve webovém projektu, proto Kabinet maily neposílá sám,
 * ale přes tuhle routu:
 *
 * - `POST /make-server-93a20b6f/kabinet/ecomail/send`   tělo `{ messages: [...] }`, max 50 zpráv
 * - `GET  /make-server-93a20b6f/kabinet/ecomail/health` `{ hasKey, domains }`
 *
 * Ověření: hlavička `x-identity-secret` = secret `IDENTITY_UPSERT_SECRET` (stejné sdílené
 * tajemství, jakým Ultra volá `/identity/registr-export` a `/identity/upsert`; v Ultra je to
 * `IDENTITY_UPSERT_SECRET` ve Vaultu). Na rozdíl od `identityUpsertAuthorized` tu neplatí
 * service-role JWT ani handoff tajemství — jen jedno tajemství, porovnané v konstantním čase.
 *
 * Do logu jdou jen počty a chyby, nikdy těla mailů, adresáti ani klíč.
 */
import type { Context, Hono } from 'npm:hono';

import { getEcomailKey } from './ecomailClient.ts';

const ECOMAIL_API = 'https://api2.ecomailapp.cz';
export const MAX_MESSAGES = 50;
const CONCURRENCY = 8;
const MAX_429_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 10_000;
const SEND_TIMEOUT_MS = 20_000;

/* ── Ověření ─────────────────────────────────────────────────────────────── */

/** Porovnání řetězců v konstantním čase (nezávisle na místě první odlišnosti i na délce). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export type AuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

export function kabinetEcomailAuth(
  req: Request,
  getEnv: (name: string) => string | undefined = (n) => Deno.env.get(n),
): AuthResult {
  const expected = getEnv('IDENTITY_UPSERT_SECRET')?.trim() || '';
  if (!expected) return { ok: false, status: 503, error: 'IDENTITY_UPSERT_SECRET není nastavený.' };
  const given = req.headers.get('x-identity-secret')?.trim() || '';
  if (!given || !timingSafeEqualString(given, expected)) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true };
}

/* ── Validace těla ───────────────────────────────────────────────────────── */

export type KabinetMessage = {
  id: string;
  to: { email: string; name?: string };
  subject: string;
  text: string;
  html: string;
  from_name: string;
  from_email: string;
  reply_to: string;
};

export type ValidationError = { index: number; id?: string; error: string };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const LINE_BREAK = /[\r\n]/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function headerField(value: unknown, field: string, max: number, required: boolean): string {
  const s = str(value);
  if (s === null) {
    if (!required && (value === undefined || value === null)) return '';
    throw new Error(`${field} musí být text`);
  }
  const t = s.trim();
  if (required && !t) throw new Error(`${field} je prázdné`);
  if (t.length > max) throw new Error(`${field} je delší než ${max} znaků`);
  if (LINE_BREAK.test(t)) throw new Error(`${field} nesmí obsahovat konec řádku`);
  return t;
}

function validateOne(raw: unknown): KabinetMessage {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('zpráva musí být objekt');
  const m = raw as Record<string, unknown>;

  const idRaw = typeof m.id === 'number' && Number.isFinite(m.id) ? String(m.id) : m.id;
  const id = headerField(idRaw, 'id', 100, true);

  const toRaw = m.to;
  if (!toRaw || typeof toRaw !== 'object' || Array.isArray(toRaw)) throw new Error('to musí být objekt {email, name?}');
  const toObj = toRaw as Record<string, unknown>;
  const toEmail = headerField(toObj.email, 'to.email', 254, true).toLowerCase();
  if (!isValidEmail(toEmail)) throw new Error('to.email není platný e-mail');
  const toName = headerField(toObj.name, 'to.name', 200, false);

  const subject = headerField(m.subject, 'subject', 300, true);

  const text = str(m.text);
  const html = str(m.html);
  if (text === null) throw new Error('text musí být text');
  if (html === null) throw new Error('html musí být text');
  if (!text.trim() && !html.trim()) throw new Error('text i html jsou prázdné');
  if (text.length > 100_000) throw new Error('text je delší než 100 000 znaků');
  if (html.length > 500_000) throw new Error('html je delší než 500 000 znaků');

  const fromName = headerField(m.from_name, 'from_name', 100, true);
  const fromEmail = headerField(m.from_email, 'from_email', 254, true).toLowerCase();
  if (!isValidEmail(fromEmail)) throw new Error('from_email není platný e-mail');
  if (!fromEmail.endsWith('@vividbooks.com')) throw new Error('from_email musí být z domény vividbooks.com');

  const replyTo = headerField(m.reply_to, 'reply_to', 254, true).toLowerCase();
  if (!isValidEmail(replyTo)) throw new Error('reply_to není platný e-mail');

  return {
    id,
    to: toName ? { email: toEmail, name: toName } : { email: toEmail },
    subject,
    text,
    html,
    from_name: fromName,
    from_email: fromEmail,
    reply_to: replyTo,
  };
}

export type ParsedBody = { ok: true; messages: KabinetMessage[] } | { ok: false; errors: ValidationError[] };

export function parseSendBody(body: unknown): ParsedBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: [{ index: -1, error: 'tělo musí být objekt {messages: [...]}' }] };
  }
  const list = (body as { messages?: unknown }).messages;
  if (!Array.isArray(list)) return { ok: false, errors: [{ index: -1, error: 'messages musí být pole' }] };
  if (list.length === 0) return { ok: false, errors: [{ index: -1, error: 'messages je prázdné' }] };
  if (list.length > MAX_MESSAGES) {
    return { ok: false, errors: [{ index: -1, error: `nejvýš ${MAX_MESSAGES} zpráv na volání (přišlo ${list.length})` }] };
  }
  const errors: ValidationError[] = [];
  const messages: KabinetMessage[] = [];
  const seen = new Set<string>();
  list.forEach((raw, index) => {
    const rawId = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : undefined;
    const idHint = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).slice(0, 100) : undefined;
    try {
      const msg = validateOne(raw);
      if (seen.has(msg.id)) throw new Error('duplicitní id');
      seen.add(msg.id);
      messages.push(msg);
    } catch (e) {
      errors.push({ index, ...(idHint ? { id: idHint } : {}), error: e instanceof Error ? e.message : String(e) });
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, messages };
}

/* ── Odeslání ────────────────────────────────────────────────────────────── */

export type SendResult = { id: string; ok: boolean; ecomail_id?: string; error?: string; retry?: boolean };

export type SendDeps = {
  key: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export function ecomailPayload(m: KabinetMessage) {
  return {
    message: {
      subject: m.subject,
      from_name: m.from_name,
      from_email: m.from_email,
      reply_to: m.reply_to,
      text: m.text,
      html: m.html,
      to: [{ email: m.to.email, name: m.to.name || '' }],
      options: { click_tracking: true, open_tracking: true },
    },
  };
}

/** Retry-After v sekundách nebo jako HTTP datum → milisekundy (null, když chybí/nečitelné). */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const secs = Number(header.trim());
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

function errorText(status: number, data: unknown): string {
  const d = data as Record<string, unknown> | string | null;
  const msg = typeof d === 'string' ? d : JSON.stringify((d as Record<string, unknown> | null)?.errors ?? (d as Record<string, unknown> | null)?.message ?? d);
  return `Ecomail ${status}: ${String(msg).slice(0, 300)}`;
}

export async function sendOne(m: KabinetMessage, deps: SendDeps): Promise<SendResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const body = JSON.stringify(ecomailPayload(m));
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(`${ECOMAIL_API}/transactional/send-message`, {
        method: 'POST',
        headers: { key: deps.key, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (e) {
      return { id: m.id, ok: false, error: `síť: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), retry: true };
    }
    const raw = await res.text();
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch { /* necháme text */ }

    if (res.status === 429) {
      const wait = retryAfterMs(res.headers.get('retry-after')) ?? 1000 * (attempt + 1);
      if (attempt < MAX_429_RETRIES && wait <= MAX_RETRY_WAIT_MS) {
        await sleep(wait);
        continue;
      }
      return { id: m.id, ok: false, error: errorText(429, data), retry: true };
    }
    if (!res.ok) {
      return { id: m.id, ok: false, error: errorText(res.status, data), ...(res.status >= 500 ? { retry: true } : {}) };
    }
    const results = (data as { results?: Record<string, unknown> } | null)?.results;
    const ecomailId = results?.id != null ? String(results.id) : '';
    const accepted = Number(results?.total_accepted_recipients ?? 1);
    if (!ecomailId || accepted === 0) {
      return { id: m.id, ok: false, error: errorText(res.status, data) };
    }
    return { id: m.id, ok: true, ecomail_id: ecomailId };
  }
}

/** Pošle zprávy, souběžně nejvýš `CONCURRENCY`, výsledky ve stejném pořadí. */
export async function sendAll(messages: KabinetMessage[], deps: SendDeps, concurrency = CONCURRENCY): Promise<SendResult[]> {
  const results: SendResult[] = new Array(messages.length);
  let next = 0;
  const worker = async () => {
    while (next < messages.length) {
      const i = next++;
      results[i] = await sendOne(messages[i], deps);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, messages.length) }, worker));
  return results;
}

/* ── Zdraví ──────────────────────────────────────────────────────────────── */

const DOMAIN_FIELD = /domain|name|status|state|verif|valid|dkim|spf|dmarc|active/i;

/** Zkrátí odpověď `/domains` na doménu a skalární stavová pole. */
export function summarizeDomains(data: unknown): Array<Record<string, unknown>> {
  const d = data as { data?: unknown; domains?: unknown } | null;
  const rows: unknown[] = Array.isArray(data) ? data : Array.isArray(d?.data) ? d!.data as unknown[] : Array.isArray(d?.domains) ? d!.domains as unknown[] : [];
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return { domain: String(row) };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (!DOMAIN_FIELD.test(k)) continue;
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
    }
    return out;
  });
}

/* ── Routy ───────────────────────────────────────────────────────────────── */

async function handleSend(c: Context) {
  const auth = kabinetEcomailAuth(c.req.raw);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const key = getEcomailKey();
  if (!key) return c.json({ error: 'ECOMAIL_KEY není nastavený.' }, 503);

  const body = await c.req.json().catch(() => null);
  const parsed = parseSendBody(body);
  if (!parsed.ok) {
    console.warn(`[kabinet-ecomail] neplatné tělo: ${parsed.errors.length} chyb`);
    return c.json({ error: 'invalid_body', errors: parsed.errors }, 400);
  }
  const results = await sendAll(parsed.messages, { key });
  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`[kabinet-ecomail] odesláno ${sent}/${results.length}, chyby ${failed.length}`);
  for (const f of failed.slice(0, 5)) console.warn(`[kabinet-ecomail] ${f.error}${f.retry ? ' (retry)' : ''}`);
  return c.json({ results });
}

async function handleHealth(c: Context) {
  const auth = kabinetEcomailAuth(c.req.raw);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const key = getEcomailKey();
  if (!key) return c.json({ hasKey: false, domains: null });
  try {
    const res = await fetch(`${ECOMAIL_API}/domains`, {
      headers: { key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    const raw = await res.text();
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch { /* text */ }
    if (!res.ok) return c.json({ hasKey: true, domains: null, error: errorText(res.status, data) });
    return c.json({ hasKey: true, domains: summarizeDomains(data) });
  } catch (e) {
    return c.json({ hasKey: true, domains: null, error: e instanceof Error ? e.message : String(e) });
  }
}

export function registerKabinetEcomailRoutes(app: Hono): void {
  app.post('/make-server-93a20b6f/kabinet/ecomail/send', handleSend);
  app.post('/kabinet/ecomail/send', handleSend);
  app.get('/make-server-93a20b6f/kabinet/ecomail/health', handleHealth);
  app.get('/kabinet/ecomail/health', handleHealth);
}
