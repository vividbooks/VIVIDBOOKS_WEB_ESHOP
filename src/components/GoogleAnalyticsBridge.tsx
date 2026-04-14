import React, { useEffect } from 'react';
import { useLocation } from 'react-router';
import {
  COOKIE_CONSENT_CHANGED,
  hasValidCookieConsent,
  readCookieConsent,
} from '@/lib/cookieConsentStorage';
import {
  applyGoogleConsentFromRecord,
  isGoogleAnalyticsEnabled,
  sendGaPageView,
} from '@/lib/googleAnalytics';

/**
 * Synchronizace GA4 Consent Mode s cookie bannerem + virtuální page_view pro SPA (veřejný katalog).
 */
export function GoogleAnalyticsBridge() {
  const location = useLocation();

  useEffect(() => {
    if (!isGoogleAnalyticsEnabled()) return;

    const sync = () => {
      const c = readCookieConsent();
      if (c && hasValidCookieConsent()) {
        applyGoogleConsentFromRecord(c);
      } else {
        applyGoogleConsentFromRecord(null);
      }
    };

    sync();
    window.addEventListener(COOKIE_CONSENT_CHANGED, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED, sync);
  }, []);

  useEffect(() => {
    if (!isGoogleAnalyticsEnabled()) return;
    sendGaPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}
