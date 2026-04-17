import { appPath } from './appBaseUrl';

/**
 * Po zaplacení: „Děkujeme“ s `payment_intent` (GET podle PI nevyžaduje HMAC), jinak jen `order`
 * (může selhat u veřejného API bez `t` / email — preferujte PI z resume-checkout).
 */
export function buildThankYouUrlAfterPayment(
  orderNumber: string | undefined,
  paymentIntentId: string | undefined,
): string {
  const thankYou = new URL(appPath('/objednavka/dekujeme'), window.location.origin);
  const pi = (paymentIntentId ?? '').trim();
  if (pi) {
    thankYou.searchParams.set('payment_intent', pi);
    return thankYou.toString();
  }
  const num = (orderNumber ?? '').trim();
  if (num) thankYou.searchParams.set('order', num);
  return thankYou.toString();
}
