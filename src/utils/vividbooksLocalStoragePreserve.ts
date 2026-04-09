/**
 * Klíče localStorage `vividbooks_*`, které nesmí startovní čistič (main.tsx)
 * ani uvolňování místa pro OAuth smazat — jinak mizí košík, adresy, cookies.
 */
export const VIVIDBOOKS_LS_PRESERVE = new Set([
  'vividbooks_cart_v1',
  'vividbooks_checkout_addresses_v1',
  /** Brána DVPP dotazníku — uložené identity (jméno, e-mail, škola…) */
  'vividbooks_dvpp_survey_contacts_v1',
  'vividbooks_cookie_consent_v1',
  'vividbooks_cookie_consent_v2',
  /** Admin Agent — snapshot konverzace */
  'vividbooks_web_operator_hub_messages_v1',
]);

/** True = bezpečně smazat jako starou cache katalogu (megabajty). */
export function isVividbooksRemovableCacheKey(key: string): boolean {
  return key.startsWith('vividbooks_') && !VIVIDBOOKS_LS_PRESERVE.has(key);
}
