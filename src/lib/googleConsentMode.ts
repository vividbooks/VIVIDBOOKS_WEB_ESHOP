import { hasValidCookieConsent, readCookieConsent, type CookieConsentRecord } from '@/lib/cookieConsentStorage';

function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag !== 'function') {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer!.push(args);
    };
  }
}

/**
 * GA4 / GTM Consent Mode v2 — synchronizace s cookie bannerem.
 * Mapování: analytické → analytics_storage, marketingové → ad_storage, ad_user_data, ad_personalization.
 */
export function applyGoogleConsentFromRecord(record: CookieConsentRecord | null): void {
  if (typeof window === 'undefined') return;
  ensureGtagStub();

  const analytics = record?.analytics === true;
  const marketing = record?.marketing === true;

  window.gtag!('consent', 'update', {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  });
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
