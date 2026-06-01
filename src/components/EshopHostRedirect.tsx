import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { buildEshopLegacyRedirectUrl, isEshopLegacyHost } from '@/config/eshopLegacyRedirects';

/**
 * Po přesunu DNS z Shoptetu (eshop.vividbooks.com) na marketing web:
 * 301-like replace na www.vividbooks.com s mapou cest ze starého e-shopu.
 */
export function EshopHostRedirect() {
  const location = useLocation();
  const doneRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isEshopLegacyHost(window.location.hostname)) return;

    const key = `${location.pathname}${location.search}${location.hash}`;
    if (doneRef.current === key) return;
    doneRef.current = key;

    const target = buildEshopLegacyRedirectUrl(location.pathname, location.search, location.hash);
    if (target === `${window.location.origin}${location.pathname}${location.search}${location.hash}`) return;

    window.location.replace(target);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
