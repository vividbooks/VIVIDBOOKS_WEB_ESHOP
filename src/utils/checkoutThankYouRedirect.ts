import { appPath } from './appBaseUrl';

const PI_TRACKING_STORAGE_KEY = 'vvb_pi_tracking';

/** Token `t` pro get-order-by-payment-intent (doplnění k `payment_intent` z URL po návratu ze Stripe). */
export function getPaymentIntentTrackingFromStorage(paymentIntentId: string): string {
  if (typeof sessionStorage === 'undefined') return '';
  const pi = paymentIntentId.trim();
  if (!pi) return '';
  try {
    const raw = sessionStorage.getItem(PI_TRACKING_STORAGE_KEY);
    if (!raw) return '';
    const o = JSON.parse(raw) as { pi?: string; t?: string };
    return o.pi === pi && typeof o.t === 'string' ? o.t.trim() : '';
  } catch {
    return '';
  }
}

/** Uloží pár PI + sledovací token z create-payment-intent / resume-checkout (pro ověření u get-order-by-payment-intent). */
export function storePaymentIntentTrackingToken(paymentIntentId: string, trackingToken: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const pi = paymentIntentId.trim();
  const t = trackingToken.trim();
  if (!pi || !t) return;
  try {
    sessionStorage.setItem(PI_TRACKING_STORAGE_KEY, JSON.stringify({ pi, t }));
  } catch {
    /* ignore */
  }
}

/**
 * Po zaplacení: „Děkujeme“ s `payment_intent` a volitelně `t` ze sessionStorage (HMAC),
 * jinak jen `order` (převod).
 */
export function buildThankYouUrlAfterPayment(
  orderNumber: string | undefined,
  paymentIntentId: string | undefined,
): string {
  const thankYou = new URL(appPath('/objednavka/dekujeme'), window.location.origin);
  const pi = (paymentIntentId ?? '').trim();
  if (pi) {
    thankYou.searchParams.set('payment_intent', pi);
    if (typeof sessionStorage !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(PI_TRACKING_STORAGE_KEY);
        if (raw) {
          const o = JSON.parse(raw) as { pi?: string; t?: string };
          if (o.pi === pi && typeof o.t === 'string' && o.t.trim()) {
            thankYou.searchParams.set('t', o.t.trim());
          }
        }
      } catch {
        /* ignore */
      }
    }
    return thankYou.toString();
  }
  const num = (orderNumber ?? '').trim();
  if (num) thankYou.searchParams.set('order', num);
  return thankYou.toString();
}
