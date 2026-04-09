/**
 * Veřejné odkazy na objednávku (sledování, PDF faktury) — HMAC podle `ORDER_TRACKING_HMAC_SECRET`.
 */
import { timingSafeEqual } from 'node:crypto';

const PREFIX = 'vb-order|';

export async function computeOrderTrackingToken(orderId: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${PREFIX}${orderId}`));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function verifyOrderTrackingToken(
  orderId: string,
  secret: string,
  token: string,
): Promise<boolean> {
  const expected = await computeOrderTrackingToken(orderId, secret);
  const t = token.trim().toLowerCase();
  if (t.length !== 32 || expected.length !== 32) return false;
  const enc = new TextEncoder();
  const a = enc.encode(expected);
  const b = enc.encode(t);
  return timingSafeEqual(a, b);
}
