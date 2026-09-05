/**
 * Podepsané tokeny pro mailing (double opt-in potvrzení, unsubscribe).
 * HMAC-SHA256 přes `purpose.email.exp`; secret MAILING_TOKEN_SECRET
 * (fallback SUPABASE_SERVICE_ROLE_KEY, aby flow fungovalo i bez nového secretu).
 *
 * Formát tokenu: base64url(`purpose.email.exp`) + '.' + base64url(hmac)
 * exp = unix sekundy; 0 = bez expirace (unsubscribe linky v patičce).
 */

export type MailingTokenPurpose = 'optin' | 'unsub' | 'dvpp-login';

function getSecret(): string {
  return (
    Deno.env.get('MAILING_TOKEN_SECRET')?.trim() ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    ''
  );
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<Uint8Array> {
  const secret = getSecret();
  if (!secret) throw new Error('Chybí MAILING_TOKEN_SECRET (ani fallback).');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return new Uint8Array(sig);
}

export async function createMailingToken(
  purpose: MailingTokenPurpose,
  email: string,
  expiresInDays?: number,
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const exp = expiresInDays && expiresInDays > 0
    ? Math.floor(Date.now() / 1000) + Math.floor(expiresInDays * 86400)
    : 0;
  const payload = `${purpose}.${cleanEmail}.${exp}`;
  const sig = await hmac(payload);
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(sig)}`;
}

/** Tracking token (open pixel / click redirect): podepsané `campaignId.subscriberId` (UUID, bez expirace). */
export async function createTrackingToken(campaignId: string, subscriberId: string): Promise<string> {
  const payload = `${campaignId}.${subscriberId}`;
  const sig = await hmac(`track.${payload}`);
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(sig)}`;
}

export async function verifyTrackingToken(
  token: string,
): Promise<{ ok: true; campaignId: string; subscriberId: string } | { ok: false; error: string }> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return { ok: false, error: 'Neplatný formát.' };
    const payload = new TextDecoder().decode(b64urlDecode(token.slice(0, dot)));
    const expected = b64url(await hmac(`track.${payload}`));
    if (expected !== token.slice(dot + 1)) return { ok: false, error: 'Neplatný podpis.' };
    const [campaignId, subscriberId] = payload.split('.');
    if (!campaignId || !subscriberId) return { ok: false, error: 'Neplatný obsah.' };
    return { ok: true, campaignId, subscriberId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function verifyMailingToken(
  purpose: MailingTokenPurpose,
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return { ok: false, error: 'Neplatný formát tokenu.' };
    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const payload = new TextDecoder().decode(b64urlDecode(payloadB64));
    const expected = b64url(await hmac(payload));
    if (expected !== sigB64) return { ok: false, error: 'Neplatný podpis tokenu.' };

    const parts = payload.split('.');
    /* email může obsahovat tečky — purpose je první část, exp poslední. */
    const gotPurpose = parts[0];
    const exp = Number(parts[parts.length - 1]);
    const email = parts.slice(1, -1).join('.');
    if (gotPurpose !== purpose) return { ok: false, error: 'Token je pro jinou akci.' };
    if (!email.includes('@')) return { ok: false, error: 'Token neobsahuje e-mail.' };
    if (exp > 0 && exp * 1000 < Date.now()) return { ok: false, error: 'Platnost odkazu vypršela.' };
    return { ok: true, email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
