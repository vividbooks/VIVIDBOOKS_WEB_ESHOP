import { useCallback, useEffect, useState } from 'react';
import {
  type CookieConsentRecord,
  COOKIE_CONSENT_CHANGED,
  hasValidCookieConsent,
  readCookieConsent,
} from '@/lib/cookieConsentStorage';

/**
 * Stav souhlasu s cookies pro podmíněné načítání skriptů (analytika, marketing).
 * Po změně v jiném tabu aktualizuje přes storage event.
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentRecord | null>(() =>
    typeof window !== 'undefined' ? readCookieConsent() : null
  );

  const refresh = useCallback(() => {
    setConsent(readCookieConsent());
  }, []);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener(COOKIE_CONSENT_CHANGED, onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED, onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, [refresh]);

  const valid = hasValidCookieConsent();
  const analyticsAllowed = valid && (consent?.analytics ?? false);
  const marketingAllowed = valid && (consent?.marketing ?? false);

  return {
    consent,
    hasValidConsent: valid,
    analyticsAllowed,
    marketingAllowed,
    refresh,
  };
}
