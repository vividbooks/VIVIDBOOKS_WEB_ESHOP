/** Sdílené klíče se cookieConsentStorage — musí sedět s inline skriptem v index.html. */
export const GOOGLE_CONSENT_LS_KEY = 'vividbooks_cookie_consent_v2';
export const GOOGLE_CONSENT_COOKIE_NAME = 'vb_cc_v2';

export type GoogleConsentState = {
  analytics_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
};

export function buildGoogleConsentState(analytics: boolean, marketing: boolean): GoogleConsentState {
  return {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  };
}

function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
}

/** GA4 / GTM Consent Mode v2 — okamžitě do dataLayer (gtag consent API). */
export function pushGoogleConsentUpdate(analytics: boolean, marketing: boolean): void {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  const state = buildGoogleConsentState(analytics, marketing);
  window.gtag!('consent', 'update', state);
  window.dataLayer!.push({
    event: 'vividbooks_consent_update',
    ...state,
  });
}
