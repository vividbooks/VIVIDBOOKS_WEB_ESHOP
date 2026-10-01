/**
 * Transakční e-maily (objednávky, webináře, DVPP, studentský program).
 *
 * Volající dál skládají zprávu ve formátu Mandrill API (`messages/send`) a volají
 * `sendTransactionalMail(init)` místo `fetch('https://mandrillapp.com/…/messages/send', init)`.
 * Adaptér zprávu přeloží pro Resend a vrátí odpověď ve tvaru Mandrillu
 * (`[{ email, status: 'sent' | 'rejected', _id, reject_reason }]`), takže zpracování
 * výsledku na straně volajících zůstává beze změny.
 *
 * Secrets:
 * - RESEND_API_KEY            (povinný pro Resend)
 * - TRANSACTIONAL_PROVIDER    `resend` (default) | `mandrill` — nouzový návrat na Mandrill bez deploye
 * - MANDRILL_API_KEY          jen pro `mandrill`
 */

const MANDRILL_SEND_URL = 'https://mandrillapp.com/api/1.0/messages/send';
const RESEND_SEND_URL = 'https://api.resend.com/emails';

type MandrillRecipient = { email: string; name?: string; type?: 'to' | 'cc' | 'bcc' };
type MandrillAttachment = { type?: string; name: string; content: string };
type MandrillMessage = {
  html?: string;
  text?: string;
  subject?: string;
  from_email?: string;
  from_name?: string;
  to?: MandrillRecipient[];
  headers?: Record<string, string>;
  attachments?: MandrillAttachment[];
  tags?: string[];
  bcc_address?: string;
};

export function getTransactionalProvider(): 'resend' | 'mandrill' {
  return Deno.env.get('TRANSACTIONAL_PROVIDER')?.trim().toLowerCase() === 'mandrill' ? 'mandrill' : 'resend';
}

function formatAddress(email: string, name?: string): string {
  const n = String(name || '').replace(/["<>\r\n]/g, '').trim();
  return n ? `${n} <${email}>` : email;
}

/** Resend tagy: jen [A-Za-z0-9_-], max 10. */
function toResendTags(tags: string[] | undefined): { name: string; value: string }[] {
  const clean = (tags || []).map((t) => String(t).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256)).filter(Boolean);
  return [...new Set(clean)].slice(0, 10).map((value, i) => ({ name: `tag_${i}`, value }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendViaResend(message: MandrillMessage): Promise<Response> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const recipients = (message.to || []).filter((r) => r?.email);
  if (!apiKey) return jsonResponse({ status: 'error', name: 'Invalid_Key', message: 'RESEND_API_KEY není nastaven' }, 500);
  if (recipients.length === 0) return jsonResponse({ status: 'error', name: 'ValidationError', message: 'Chybí příjemce' }, 400);

  const headers = { ...(message.headers || {}) };
  const replyTo = headers['Reply-To'] || headers['reply-to'];
  delete headers['Reply-To'];
  delete headers['reply-to'];

  const bcc = recipients.filter((r) => r.type === 'bcc').map((r) => r.email);
  if (message.bcc_address) bcc.push(message.bcc_address);

  const payload: Record<string, unknown> = {
    from: formatAddress(message.from_email || 'hello@vividbooks.com', message.from_name || 'Vividbooks'),
    to: recipients.filter((r) => !r.type || r.type === 'to').map((r) => formatAddress(r.email, r.name)),
    subject: message.subject || '',
    ...(message.html ? { html: message.html } : {}),
    ...(message.text ? { text: message.text } : {}),
  };
  const cc = recipients.filter((r) => r.type === 'cc').map((r) => r.email);
  if (cc.length) payload.cc = cc;
  if (bcc.length) payload.bcc = bcc;
  if (replyTo) payload.reply_to = replyTo;
  if (Object.keys(headers).length) payload.headers = headers;
  if (message.attachments?.length) {
    payload.attachments = message.attachments.map((a) => ({
      filename: a.name,
      content: a.content,
      ...(a.type ? { content_type: a.type } : {}),
    }));
  }
  const tags = toResendTags(message.tags);
  if (tags.length) payload.tags = tags;

  const toList = recipients.map((r) => r.email);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(RESEND_SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return jsonResponse(toList.map((email) => ({ email, status: 'sent', _id: data?.id || '', reject_reason: null })));
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 2) {
      const reason = `resend_${res.status}: ${String(data?.message || data?.name || '').slice(0, 200)}`;
      console.log(`[TransactionalMail] Resend ${res.status} pro ${toList.join(', ')}: ${reason}`);
      /* 4xx = odmítnutí konkrétní zprávy → tvar Mandrillu s `rejected`; 5xx = chyba služby. */
      if (res.status >= 500) return jsonResponse({ status: 'error', name: 'GeneralError', message: reason }, 502);
      return jsonResponse(toList.map((email) => ({ email, status: 'rejected', _id: '', reject_reason: reason })));
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  return jsonResponse({ status: 'error', name: 'GeneralError', message: 'unreachable' }, 502);
}

/**
 * Náhrada za `fetch(MANDRILL_SEND_URL, init)`. `init.body` je JSON `{ key?, message }`
 * ve formátu Mandrillu.
 */
export async function sendTransactionalMail(init: { method?: string; headers?: HeadersInit; body: string }): Promise<Response> {
  if (getTransactionalProvider() === 'mandrill') {
    const parsed = JSON.parse(init.body);
    const key = parsed?.key || Deno.env.get('MANDRILL_API_KEY');
    return fetch(MANDRILL_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed, key }),
    });
  }
  let message: MandrillMessage;
  try {
    message = JSON.parse(init.body)?.message || {};
  } catch {
    return jsonResponse({ status: 'error', name: 'ValidationError', message: 'Neplatné tělo zprávy' }, 400);
  }
  return sendViaResend(message);
}

/**
 * Klíč aktivního poskytovatele — volající ho používají jako „je transakční pošta nastavená?“
 * a posílají ho v těle zprávy jako `key` (Resend větev ho ignoruje).
 */
export function transactionalMailKey(): string | undefined {
  const name = getTransactionalProvider() === 'mandrill' ? 'MANDRILL_API_KEY' : 'RESEND_API_KEY';
  return Deno.env.get(name)?.trim() || undefined;
}
