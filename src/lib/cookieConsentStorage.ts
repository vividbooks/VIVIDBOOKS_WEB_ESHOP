import { applyGoogleConsentFromRecord } from '@/lib/googleConsentMode';

/**
 * Ukládání souhlasu s cookies podle zákona č. 110/2019 Sb. (GDPR) a ePrivacy (implementační praxe ÚOOÚ):
 * výslovný souhlas před nepovinnými cookies, oddělené kategorie, záznam času a verze zásad, možnost změny.
 */

export const COOKIE_CONSENT_POLICY_VERSION = '2026-04-02';

const STORAGE_KEY_V2 = 'vividbooks_cookie_consent_v2';
/** @deprecated — dříve jen „Rozumím“ bez granularizace */
const STORAGE_KEY_V1 = 'vividbooks_cookie_consent_v1';

/** Zrcadlo do cookie — když localStorage selže (ITP, režim soukromí, kvóta), lišta se jinak znovu zobrazuje. */
const CONSENT_COOKIE_NAME = 'vb_cc_v2';

/**
 * Verze zásad, u kterých ještě platí dříve uložený souhlas bez nového banneru.
 * Při skutečné změně textu zásad přidejte novou `COOKIE_CONSENT_POLICY_VERSION` a sem předchozí verzi.
 */
const ACCEPTED_POLICY_VERSIONS = new Set<string>([COOKIE_CONSENT_POLICY_VERSION, '2026-04-02']);

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

function parseRecord(o: Record<string, unknown>): CookieConsentRecord | null {
  if (typeof o.policyVersion !== 'string' || typeof o.consentAt !== 'string') return null;
  if (typeof o.analytics !== 'boolean' || typeof o.marketing !== 'boolean') return null;
  return {
    policyVersion: o.policyVersion,
    consentAt: o.consentAt,
    necessary: true,
    analytics: o.analytics,
    marketing: o.marketing,
  };
}

function readConsentFromCookie(): CookieConsentRecord | null {
  if (typeof document === 'undefined') return null;
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`));
    if (!m?.[1]) return null;
    const raw = decodeURIComponent(m[1].trim());
    const o = JSON.parse(raw) as Record<string, unknown>;
    return parseRecord(o);
  } catch {
    return null;
  }
}

function setConsentCookie(record: CookieConsentRecord): void {
  if (typeof document === 'undefined') return;
  try {
    const payload = encodeURIComponent(JSON.stringify(record));
    const maxAge = 400 * 24 * 60 * 60;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${CONSENT_COOKIE_NAME}=${payload};Path=/;Max-Age=${maxAge};SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
}

/** Starý formát — jen příznak, bez granularizace. */
function tryMigrateV1ToV2(): CookieConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1 === null || v1 === '') return null;
    const record: CookieConsentRecord = {
      policyVersion: COOKIE_CONSENT_POLICY_VERSION,
      consentAt: new Date().toISOString(),
      necessary: true,
      analytics: false,
      marketing: false,
    };
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(record));
      localStorage.removeItem(STORAGE_KEY_V1);
    } catch {
      /* ignore */
    }
    setConsentCookie(record);
    return record;
  } catch {
    return null;
  }
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw) {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const parsed = parseRecord(o);
      if (parsed) {
        setConsentCookie(parsed);
        return parsed;
      }
    }
  } catch {
    /* try cookie */
  }

  const fromCookie = readConsentFromCookie();
  if (fromCookie) {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(fromCookie));
    } catch {
      /* keep cookie only */
    }
    return fromCookie;
  }

  return tryMigrateV1ToV2();
}

/** Platný záznam = uložený souhlas a verze zásad, kterou ještě bereme jako vyřízenou volbu. */
export function hasValidCookieConsent(): boolean {
  const c = readCookieConsent();
  if (!c) return false;
  return ACCEPTED_POLICY_VERSIONS.has(c.policyVersion);
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
    /* localStorage nedostupné — spoléháme na cookie */
  }
  setConsentCookie(record);
  if (typeof window !== 'undefined') {
    applyGoogleConsentFromRecord(record);
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
