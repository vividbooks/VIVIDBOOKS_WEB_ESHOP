/**
 * Resend — odesílání marketingových e-mailů (náhrada Mailchimp kampaní).
 * Transakční e-maily (objednávky, webináře) zůstávají na Mandrillu.
 *
 * Secrets:
 * - RESEND_API_KEY        (povinný)
 * - RESEND_FROM_EMAIL     (default `vitek@vividbooks.com`)
 * - RESEND_FROM_NAME      (default `Vítek z Vividbooks`)
 * - RESEND_REPLY_TO       (default `vitek@vividbooks.com`)
 * - RESEND_MAX_RPS        (default 2 — limit Resend API; při vyšším tieru zvýšit)
 */

export type ResendSendInput = {
  to: string;
  subject: string;
  /** HTML tělo. Nepovinné, pokud je vyplněný `text`. */
  html?: string;
  /** Tělo v prostém textu — e-mail pak vypadá jako běžná osobní zpráva. */
  text?: string;
  /** Přepis defaultního odesílatele (`Jméno <adresa>`). */
  from?: string;
  replyTo?: string;
  /** Extra hlavičky — např. List-Unsubscribe. */
  headers?: Record<string, string>;
  /** Resend tagy (max 10) — dohledání v Resend dashboardu / webhooku. Jen [a-zA-Z0-9_-]. */
  tags?: { name: string; value: string }[];
};

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; retryable: boolean };

export function getResendApiKey(): string | null {
  const k = Deno.env.get('RESEND_API_KEY')?.trim();
  return k || null;
}

export function getResendDefaultFrom(): string {
  const email = Deno.env.get('RESEND_FROM_EMAIL')?.trim() || 'vitek@vividbooks.com';
  const name = Deno.env.get('RESEND_FROM_NAME')?.trim() || 'Vítek z Vividbooks';
  return `${name} <${email}>`;
}

function getMaxRps(): number {
  const n = Number(Deno.env.get('RESEND_MAX_RPS') || '');
  return Number.isFinite(n) && n > 0 ? n : 2;
}

/** Jednoduchý in-memory rate limiter (per Edge isolate) — drží min. rozestup mezi requesty. */
let lastSendAtMs = 0;
async function rateLimitGate(): Promise<void> {
  const minGapMs = Math.ceil(1000 / getMaxRps());
  const now = Date.now();
  const wait = lastSendAtMs + minGapMs - now;
  lastSendAtMs = Math.max(now, lastSendAtMs + minGapMs);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Odešle jeden e-mail přes Resend. Retry na 429/5xx s exponenciálním backoffem (max 3 pokusy).
 * Nikdy nevyhazuje — vrací výsledek, volající rozhoduje (send engine ukládá `failed`).
 */
export async function sendResendEmail(input: ResendSendInput): Promise<ResendSendResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { ok: false, status: 0, error: 'RESEND_API_KEY není nastaven', retryable: false };
  }

  if (!input.html && !input.text) {
    return { ok: false, status: 0, error: 'Chybí html i text', retryable: false };
  }

  const body = {
    from: input.from || getResendDefaultFrom(),
    to: [input.to],
    subject: input.subject,
    ...(input.html ? { html: input.html } : {}),
    ...(input.text ? { text: input.text } : {}),
    reply_to: input.replyTo || Deno.env.get('RESEND_REPLY_TO')?.trim() || 'vitek@vividbooks.com',
    ...(input.headers ? { headers: input.headers } : {}),
    ...(input.tags?.length ? { tags: input.tags.slice(0, 10) } : {}),
  };

  const maxAttempts = 3;
  let lastError = '';
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await rateLimitGate();
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json() as { id?: string };
        return { ok: true, id: String(data.id || '') };
      }
      lastStatus = res.status;
      lastError = (await res.text()).slice(0, 300);
      if (!RETRYABLE_STATUSES.has(res.status)) {
        return { ok: false, status: res.status, error: lastError, retryable: false };
      }
    } catch (e) {
      lastStatus = 0;
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
  }
  return { ok: false, status: lastStatus, error: lastError, retryable: true };
}
