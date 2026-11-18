import { getSupabaseBrowser } from '../lib/supabaseBrowser';
import { readCookieConsent } from '../lib/cookieConsentStorage';

const ANON_KEY = 'vb_id';
const TOUCHPOINT_FLAG = 'vb_touchpoint_sent';

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon_' + Math.random().toString(36).slice(2);
  }
}

/**
 * Stejné anonymní ID, jaké nese `marketing_touchpoints.anon_id`. Pokladna ho
 * ukládá k objednávce, aby šel nákup dohledat zpět ke kliknutí z reklamy.
 */
export function getMarketingAnonId(): string {
  return getAnonId();
}

function readParams(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = p.get(k);
    if (v) out[k] = v;
  }
  return out;
}

export async function captureMarketingTouchpoint(): Promise<void> {
  if (typeof window === 'undefined') return;
  const params = readParams();
  const hasSignal = params.gclid || params.gbraid || params.wbraid || params.utm_source || params.utm_campaign;
  if (!hasSignal) return;

  // dedupe per session
  try {
    if (sessionStorage.getItem(TOUCHPOINT_FLAG) === '1') return;
  } catch { /* ignore */ }

  const consent = readCookieConsent();
  const anonId = getAnonId();

  try {
    const sb = getSupabaseBrowser();
    await sb.from('marketing_touchpoints').insert({
      anon_id: anonId,
      gclid: params.gclid || null,
      gbraid: params.gbraid || null,
      wbraid: params.wbraid || null,
      utm_source: params.utm_source || null,
      utm_medium: params.utm_medium || null,
      utm_campaign: params.utm_campaign || null,
      utm_content: params.utm_content || null,
      utm_term: params.utm_term || null,
      landing_url: window.location.href.slice(0, 2000),
      referrer: document.referrer ? document.referrer.slice(0, 2000) : null,
      consent_analytics: consent?.analytics === true,
      consent_marketing: consent?.marketing === true,
    });
    try { sessionStorage.setItem(TOUCHPOINT_FLAG, '1'); } catch { /* ignore */ }
  } catch {
    // best-effort; never block page load
  }
}
