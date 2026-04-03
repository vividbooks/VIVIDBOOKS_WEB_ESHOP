/**
 * Ukládání souhlasu s cookies podle zákona č. 110/2019 Sb. (GDPR) a ePrivacy (implementační praxe ÚOOÚ):
 * výslovný souhlas před nepovinnými cookies, oddělené kategorie, záznam času a verze zásad, možnost změny.
 */

export const COOKIE_CONSENT_POLICY_VERSION = '2026-04-02';

const STORAGE_KEY_V2 = 'vividbooks_cookie_consent_v2';
/** @deprecated — dříve jen „Rozumím“ bez granularizace */
const STORAGE_KEY_V1 = 'vividbooks_cookie_consent_v1';

export const COOKIE_CONSENT_CHANGED = 'vividbooks:cookie-consent-changed';

export interface CookieConsentRecord {
  policyVersion: string;
  /** ISO 8601 — okamžik uložení souhlasu nebo odmítnutí nepovinných */
  consentAt: string;
  /** Technicky nezbytné — vždy true */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.policyVersion !== 'string' || typeof o.consentAt !== 'string') return null;
    if (typeof o.analytics !== 'boolean' || typeof o.marketing !== 'boolean') return null;
    return {
      policyVersion: o.policyVersion,
      consentAt: o.consentAt,
      necessary: true,
      analytics: o.analytics,
      marketing: o.marketing,
    };
  } catch {
    return null;
  }
}

/** Platný záznam jen pokud odpovídá aktuální verzi zásad (po změně zásad znovu nabídnout volbu). */
export function hasValidCookieConsent(): boolean {
  const c = readCookieConsent();
  return c !== null && c.policyVersion === COOKIE_CONSENT_POLICY_VERSION;
}

export function saveCookieConsent(partial: Pick<CookieConsentRecord, 'analytics' | 'marketing'>): CookieConsentRecord {
  const record: CookieConsentRecord = {
    policyVersion: COOKIE_CONSENT_POLICY_VERSION,
    consentAt: new Date().toISOString(),
    necessary: true,
    analytics: partial.analytics,
    marketing: partial.marketing,
  };
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(record));
    try {
      localStorage.removeItem(STORAGE_KEY_V1);
    } catch {
      /* ignore */
    }
  } catch {
    /* private mode atd. */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED, { detail: record }));
  }
  return record;
}

export function acceptAllCookies(): CookieConsentRecord {
  return saveCookieConsent({ analytics: true, marketing: true });
}

export function rejectOptionalCookies(): CookieConsentRecord {
  return saveCookieConsent({ analytics: false, marketing: false });
}

export const OPEN_COOKIE_SETTINGS = 'vividbooks:open-cookie-settings';

export function openCookieSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS));
}
