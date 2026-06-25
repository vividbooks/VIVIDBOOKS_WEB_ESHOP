import { hasValidCookieConsent, readCookieConsent, type CookieConsentRecord } from '@/lib/cookieConsentStorage';
import { pushGoogleConsentUpdate } from '@/lib/googleConsentSignals';

/**
 * GA4 / GTM Consent Mode v2 — synchronizace s cookie bannerem.
 * Mapování: analytické → analytics_storage, marketingové → ad_storage, ad_user_data, ad_personalization.
 */
export function applyGoogleConsentFromRecord(record: CookieConsentRecord | null): void {
  if (typeof window === 'undefined') return;
  pushGoogleConsentUpdate(record?.analytics === true, record?.marketing === true);
}

/** Po startu aplikace aplikovat uložený souhlas (pro návratné návštěvníky). */
export function syncGoogleConsentFromStorage(): void {
  if (typeof window === 'undefined') return;
  const c = readCookieConsent();
  if (c && hasValidCookieConsent()) {
    applyGoogleConsentFromRecord(c);
  } else {
    applyGoogleConsentFromRecord(null);
  }
}
