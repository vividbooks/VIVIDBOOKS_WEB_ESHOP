import { hasValidCookieConsent, readCookieConsent, type CookieConsentRecord } from '@/lib/cookieConsentStorage';

const GTAG_SCRIPT_ATTR = 'data-vividbooks-gtag';

/** Výchozí webový stream (veřejné ID — stejně je v prohlížeči po načtení gtag). Přepište přes `VITE_GA_MEASUREMENT_ID`. */
const DEFAULT_PROD_MEASUREMENT_ID = 'G-T2YTCB5DJZ';

function getMeasurementId(): string {
  const raw = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  const fromEnv = typeof raw === 'string' ? raw.trim() : '';
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return DEFAULT_PROD_MEASUREMENT_ID;
  return '';
}

export function isGoogleAnalyticsEnabled(): boolean {
  return /^G-[A-Z0-9]+$/i.test(getMeasurementId());
}

function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag !== 'function') {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
}

/**
 * GA4 + Consent Mode v2: výchozí denied, pak synchronizace s cookie bannerem.
 * Volat jednou při startu aplikace (main.tsx), před renderem.
 */
export function bootstrapGoogleAnalytics(): void {
  if (typeof window === 'undefined') return;
  const id = getMeasurementId();
  if (!isGoogleAnalyticsEnabled()) return;

  ensureGtagStub();

  window.gtag!('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  if (document.querySelector(`script[${GTAG_SCRIPT_ATTR}="${id}"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.setAttribute(GTAG_SCRIPT_ATTR, id);
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  script.onload = () => {
    window.gtag!('js', new Date());
    window.gtag!('config', id, { send_page_view: false });
    const c = readCookieConsent();
    if (c && hasValidCookieConsent()) {
      applyGoogleConsentFromRecord(c);
    }
  };
  document.head.appendChild(script);
}

export function applyGoogleConsentFromRecord(record: CookieConsentRecord | null): void {
  if (!isGoogleAnalyticsEnabled() || typeof window === 'undefined') return;
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

export function sendGaPageView(pagePath: string): void {
  if (!isGoogleAnalyticsEnabled() || typeof window === 'undefined') return;
  ensureGtagStub();
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: typeof document !== 'undefined' ? document.title : pagePath,
  });
}
