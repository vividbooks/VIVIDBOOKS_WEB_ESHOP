/**
 * Osobní maily Kabinetu (Vividbooks Ultra) přes Resend.
 *
 * Klíč `RESEND_API_KEY` žije jen tady ve webovém projektu, proto Kabinet maily neposílá sám,
 * ale přes tuhle routu:
 *
 * - `POST /make-server-93a20b6f/kabinet/posta/send`   tělo `{ messages: [...] }`, max 100 zpráv
 *   → jeden `POST https://api.resend.com/emails/batch` (batch podporuje `headers` i `tags`)
 * - `GET  /make-server-93a20b6f/kabinet/posta/health` `{ hasKey, domains: [{name, status}] }`
 *
 * Události (doručeno, otevřeno, klik, bounce, stížnost) přicházejí do webhooku Resendu
 * v index.tsx; ty s tagem `posta_id` se přepošlou do Kabinetu (`forwardPostaEvent`).
 *
 * Ověření: hlavička `x-identity-secret` = secret `IDENTITY_UPSERT_SECRET` (stejné sdílené
 * tajemství, jakým Ultra volá `/identity/registr-export` a `/identity/upsert`). Neplatí tu
 * service-role JWT ani handoff tajemství — jen jedno tajemství, porovnané v konstantním čase.
 *
 * Do logu jdou jen počty a chyby, nikdy těla mailů, adresáti ani klíč.
 */
import type { Context, Hono } from 'npm:hono';

const RESEND_API = 'https://api.resend.com';
export const MAX_MESSAGES = 100;
const MAX_429_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 10_000;
const SEND_TIMEOUT_MS = 30_000;
export const DEFAULT_POSTA_EVENTS_URL = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/posta/udalosti';

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

export function kabinetPostaAuth(
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
  unsubscribe_url: string;
  kampan: string;
  varianta: string;
};

export type ValidationError = { index: number; id?: string; error: string };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const LINE_BREAK = /[\r\n]/;
/** vividbooks.com nebo jakákoli její subdoména (news.vividbooks.com …). */
const VIVIDBOOKS_FROM_RE = /@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*vividbooks\.com$/;

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

/** Hodnota tagu Resendu smí obsahovat jen [A-Za-z0-9_-] (max 256); diakritika pryč, prázdná → `none`. */
export function sanitizeTagValue(value: string): string {
  const s = value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 256);
  return s || 'none';
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
  if (!VIVIDBOOKS_FROM_RE.test(fromEmail)) throw new Error('from_email musí být z domény vividbooks.com nebo její subdomény');

  const replyTo = headerField(m.reply_to, 'reply_to', 254, true).toLowerCase();
  if (!isValidEmail(replyTo)) throw new Error('reply_to není platný e-mail');

  const unsubscribeUrl = headerField(m.unsubscribe_url, 'unsubscribe_url', 2000, true);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(unsubscribeUrl);
  } catch {
    throw new Error('unsubscribe_url není platná adresa');
  }
  if (parsedUrl.protocol !== 'https:') throw new Error('unsubscribe_url musí být https');
  if (/[<>\s]/.test(unsubscribeUrl)) throw new Error('unsubscribe_url obsahuje nepovolené znaky');

  const kampan = headerField(m.kampan, 'kampan', 256, true);
  const varianta = headerField(m.varianta, 'varianta', 256, false);

  return {
    id,
    to: toName ? { email: toEmail, name: toName } : { email: toEmail },
    subject,
    text,
    html,
    from_name: fromName,
    from_email: fromEmail,
    reply_to: replyTo,
    unsubscribe_url: unsubscribeUrl,
    kampan,
    varianta,
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

/* ── Sestavení požadavku pro Resend ──────────────────────────────────────── */

/** `Jméno <adresa>`; jméno se speciálními znaky dá do uvozovek (bez `"` a `\`). */
export function formatAddress(name: string | undefined, email: string): string {
  const n = (name || '').replace(/["\\<>]/g, '').trim();
  if (!n) return email;
  return /^[\p{L}\p{N} .'_-]+$/u.test(n) ? `${n} <${email}>` : `"${n}" <${email}>`;
}

export function resendEmail(m: KabinetMessage) {
  return {
    from: formatAddress(m.from_name, m.from_email),
    to: [formatAddress(m.to.name, m.to.email)],
    reply_to: m.reply_to,
    subject: m.subject,
    text: m.text,
    html: m.html,
    headers: {
      'List-Unsubscribe': `<${m.unsubscribe_url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'posta_id', value: sanitizeTagValue(m.id) },
      { name: 'kampan', value: sanitizeTagValue(m.kampan) },
      { name: 'varianta', value: sanitizeTagValue(m.varianta) },
    ],
  };
}

/** Klíč idempotence pro Resend (24 h): stejná sada id = stejný požadavek, neodejde dvakrát. */
export async function idempotencyKey(messages: KabinetMessage[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(messages.map((m) => m.id).join('\n')));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `kabinet-posta-${hex}`;
}

/* ── Odeslání ────────────────────────────────────────────────────────────── */

export type SendResult = { id: string; ok: boolean; resend_id?: string; error?: string; retry?: boolean };

export type SendDeps = {
  key: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

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
  const msg = typeof d === 'string'
    ? d
    : [d?.name, d?.message].filter((x) => typeof x === 'string' && x).join(': ') || JSON.stringify(d);
  return `Resend ${status}: ${String(msg).slice(0, 300)}`;
}

const allFailed = (messages: KabinetMessage[], error: string, retry: boolean): SendResult[] =>
  messages.map((m) => ({ id: m.id, ok: false, error, ...(retry ? { retry: true } : {}) }));

/**
 * Pošle všechny zprávy jedním voláním `/emails/batch` (max 100). Batch je v Resendu atomický:
 * buď projdou všechny, nebo žádná — proto chyba platí pro celou dávku.
 */
export async function sendBatch(messages: KabinetMessage[], deps: SendDeps): Promise<SendResult[]> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const body = JSON.stringify(messages.map(resendEmail));
  const idem = await idempotencyKey(messages);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(`${RESEND_API}/emails/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deps.key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idem,
        },
        body,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (e) {
      return allFailed(messages, `síť: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), true);
    }
    const raw = await res.text();
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch { /* necháme text */ }

    if (res.status === 429 || res.status >= 500) {
      const wait = retryAfterMs(res.headers.get('retry-after')) ?? 1000 * (attempt + 1);
      if (attempt < MAX_429_RETRIES && wait <= MAX_RETRY_WAIT_MS) {
        await sleep(wait);
        continue;
      }
      return allFailed(messages, errorText(res.status, data), true);
    }
    if (!res.ok) return allFailed(messages, errorText(res.status, data), false);

    const rows = (data as { data?: Array<{ id?: unknown }> } | null)?.data;
    if (!Array.isArray(rows)) return allFailed(messages, errorText(res.status, data), false);
    return messages.map((m, i) => {
      const rid = rows[i]?.id;
      return typeof rid === 'string' && rid
        ? { id: m.id, ok: true, resend_id: rid }
        : { id: m.id, ok: false, error: 'Resend nevrátil id zprávy' };
    });
  }
}

/* ── Zdraví ──────────────────────────────────────────────────────────────── */

export function summarizeDomains(data: unknown): Array<{ name: string; status: string }> {
  const rows = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return { name: String(row.name ?? ''), status: String(row.status ?? '') };
  });
}

/* ── Webhook Resendu → Kabinet ───────────────────────────────────────────── */

export type PostaEvent = {
  posta_id: string;
  type: string;
  created_at: string;
  email: string;
  click_url?: string;
  bounce_type?: string;
};

/** Tagy z webhooku: Resend posílá objekt `{name: value}`, starší payloady pole `[{name, value}]`. */
export function webhookTag(tags: unknown, name: string): string | null {
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t && typeof t === 'object' && (t as { name?: unknown }).name === name) {
        const v = (t as { value?: unknown }).value;
        return typeof v === 'string' && v ? v : null;
      }
    }
    return null;
  }
  if (tags && typeof tags === 'object') {
    const v = (tags as Record<string, unknown>)[name];
    return typeof v === 'string' && v ? v : null;
  }
  return null;
}

/**
 * Z události webhooku udělá záznam pro Kabinet, nebo null (mail bez tagu `posta_id`).
 * `type` je už přeložený typ (delivered/open/click/bounce/complaint/failed/delivery_delayed),
 * `bounceType` hard/soft/undetermined.
 */
export function postaEventFromWebhook(
  event: {
    created_at?: string;
    data?: { to?: unknown; tags?: unknown; click?: { link?: unknown } };
  },
  type: string,
  bounceType?: string | null,
): PostaEvent | null {
  const postaId = webhookTag(event.data?.tags, 'posta_id');
  if (!postaId) return null;
  const to = event.data?.to;
  const email = Array.isArray(to) ? String(to[0] ?? '') : typeof to === 'string' ? to : '';
  const createdAt = event.created_at && !Number.isNaN(Date.parse(event.created_at))
    ? new Date(event.created_at).toISOString()
    : new Date().toISOString();
  const link = event.data?.click?.link;
  return {
    posta_id: postaId,
    type,
    created_at: createdAt,
    email: email.toLowerCase(),
    ...(type === 'click' && typeof link === 'string' && link ? { click_url: link } : {}),
    ...(type === 'bounce' && bounceType ? { bounce_type: bounceType } : {}),
  };
}

/** Přepošle událost do Kabinetu. Nikdy nevyhazuje — webhook Resendu na tom nesmí záviset. */
export async function forwardPostaEvent(
  ev: PostaEvent,
  opts: { getEnv?: (name: string) => string | undefined; fetchFn?: typeof fetch } = {},
): Promise<{ ok: boolean; error?: string }> {
  const getEnv = opts.getEnv ?? ((n: string) => Deno.env.get(n));
  const fetchFn = opts.fetchFn ?? fetch;
  const secret = getEnv('IDENTITY_UPSERT_SECRET')?.trim();
  if (!secret) return { ok: false, error: 'IDENTITY_UPSERT_SECRET chybí' };
  const url = getEnv('ULTRA_POSTA_EVENTS_URL')?.trim() || DEFAULT_POSTA_EVENTS_URL;
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-identity-secret': secret },
      body: JSON.stringify({ events: [ev] }),
      signal: AbortSignal.timeout(8_000),
    });
    await res.body?.cancel().catch(() => {});
    return res.ok ? { ok: true } : { ok: false, error: `Kabinet ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Routy ───────────────────────────────────────────────────────────────── */

function resendKey(): string | null {
  return Deno.env.get('RESEND_API_KEY')?.trim() || null;
}

async function handleSend(c: Context) {
  const auth = kabinetPostaAuth(c.req.raw);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const key = resendKey();
  if (!key) return c.json({ error: 'RESEND_API_KEY není nastavený.' }, 503);

  const body = await c.req.json().catch(() => null);
  const parsed = parseSendBody(body);
  if (!parsed.ok) {
    console.warn(`[kabinet-posta] neplatné tělo: ${parsed.errors.length} chyb`);
    return c.json({ error: 'invalid_body', errors: parsed.errors }, 400);
  }
  const results = await sendBatch(parsed.messages, { key });
  const sent = results.filter((r) => r.ok).length;
  console.log(`[kabinet-posta] odesláno ${sent}/${results.length}`);
  const firstErr = results.find((r) => !r.ok);
  if (firstErr) console.warn(`[kabinet-posta] chyba: ${firstErr.error}${firstErr.retry ? ' (retry)' : ''}`);
  return c.json({ results });
}

async function handleHealth(c: Context) {
  const auth = kabinetPostaAuth(c.req.raw);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const key = resendKey();
  if (!key) return c.json({ hasKey: false, domains: null });
  try {
    const res = await fetch(`${RESEND_API}/domains`, {
      headers: { Authorization: `Bearer ${key}` },
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

export function registerKabinetPostaRoutes(app: Hono): void {
  app.post('/make-server-93a20b6f/kabinet/posta/send', handleSend);
  app.post('/kabinet/posta/send', handleSend);
  app.get('/make-server-93a20b6f/kabinet/posta/health', handleHealth);
  app.get('/kabinet/posta/health', handleHealth);
}
