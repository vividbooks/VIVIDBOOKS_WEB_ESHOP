import {
  apiUrl,
  appUrl,
  eshopUrl,
  joinUrl,
  legacyCzUrl,
  previewDefaultCtaUrl,
  privacyPolicyUrl,
  productsListingUrl,
  PUBLIC_SITE_ENV_KEYS,
  resolvePublicSiteOrigin,
} from '../config/publicUrls';

function readBrowserEnvValue(name: string): string | undefined {
  try {
    return import.meta.env?.[name as keyof ImportMetaEnv] as string | undefined;
  } catch {
    return undefined;
  }
}

export function getPublicSiteOrigin(): string {
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const envOrigin = PUBLIC_SITE_ENV_KEYS.map((name) => readBrowserEnvValue(name)).find(Boolean);
  return resolvePublicSiteOrigin(runtimeOrigin, envOrigin);
}

export function publicSiteUrl(path = ''): string {
  return joinUrl(getPublicSiteOrigin(), path);
}

export function previewCtaUrl(): string {
  return previewDefaultCtaUrl(getPublicSiteOrigin());
}

export function productsUrl(): string {
  return productsListingUrl(getPublicSiteOrigin());
}

export { apiUrl, appUrl, eshopUrl, legacyCzUrl, privacyPolicyUrl };
