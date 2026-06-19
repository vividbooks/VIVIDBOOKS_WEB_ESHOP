import { useEffect } from 'react';
import { COOKIE_CONSENT_CHANGED } from '@/lib/cookieConsentStorage';
import { syncGoogleConsentFromStorage } from '@/lib/googleConsentMode';

/**
 * Synchronizace GTM Consent Mode s cookie bannerem (včetně změn z jiného tabu).
 */
export function GoogleConsentBridge() {
  useEffect(() => {
    syncGoogleConsentFromStorage();

    const onChanged = () => syncGoogleConsentFromStorage();
    window.addEventListener(COOKIE_CONSENT_CHANGED, onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED, onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, []);

  return null;
}
