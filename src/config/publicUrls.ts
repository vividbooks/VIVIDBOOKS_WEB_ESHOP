const DEFAULT_PUBLIC_SITE_ORIGIN = 'https://new.vividbooks.com';

export const LEGACY_CZ_SITE_ORIGIN = 'https://www.vividbooks.cz';
export const APP_SITE_ORIGIN = 'https://app.vividbooks.com';
export const API_SITE_ORIGIN = 'https://api.vividbooks.com';
export const ESHOP_SITE_ORIGIN = 'https://eshop.vividbooks.com';

export const PUBLIC_SITE_ENV_KEYS = ['VITE_PUBLIC_SITE_URL', 'PUBLIC_SITE_URL', 'SITE_URL'] as const;

export function normalizeUrlOrigin(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.replace(/\/+$/, '');
}

export function resolvePublicSiteOrigin(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeUrlOrigin(candidate);
    }
  }
  return DEFAULT_PUBLIC_SITE_ORIGIN;
}

export function joinUrl(origin: string, path = ''): string {
  const base = normalizeUrlOrigin(origin);
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/${path}`;
}

export function publicSiteUrl(path = '', origin = DEFAULT_PUBLIC_SITE_ORIGIN): string {
  return joinUrl(origin, path);
}

export function legacyCzUrl(path = ''): string {
  return joinUrl(LEGACY_CZ_SITE_ORIGIN, path);
}

export function appUrl(path = ''): string {
  return joinUrl(APP_SITE_ORIGIN, path);
}

export function apiUrl(path = ''): string {
  return joinUrl(API_SITE_ORIGIN, path);
}

export function eshopUrl(path = ''): string {
  return joinUrl(ESHOP_SITE_ORIGIN, path);
}

export function privacyPolicyUrl(): string {
  return legacyCzUrl('/gdpr');
}

export function previewDefaultCtaUrl(origin = DEFAULT_PUBLIC_SITE_ORIGIN): string {
  return publicSiteUrl('/vyzkousejte', origin);
}

export function productsListingUrl(origin = DEFAULT_PUBLIC_SITE_ORIGIN): string {
  return publicSiteUrl('/produkty', origin);
}
