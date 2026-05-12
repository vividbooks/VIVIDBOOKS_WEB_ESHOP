/**
 * Kanonická marketingová doména (www) + legacy/apex alternativy.
 * Build: VITE_PUBLIC_SITE_URL přepíše primární origin (canonical, OG, breadcrumbs).
 */

import {
  MARKETING_ORIGIN_APEX,
  MARKETING_ORIGIN_PRIMARY_DEFAULT,
  MARKETING_ORIGIN_WWW,
  MARKETING_ORIGINS_CANONICAL_SET,
} from './marketingSiteConstants';

export {
  MARKETING_ORIGIN_APEX,
  MARKETING_ORIGIN_PRIMARY_DEFAULT,
  MARKETING_ORIGIN_WWW,
  MARKETING_ORIGINS_CANONICAL_SET,
};

export function getMarketingSiteOrigin(): string {
  try {
    const v = import.meta.env?.VITE_PUBLIC_SITE_URL as string | undefined;
    if (v?.trim()) return v.trim().replace(/\/$/, '');
  } catch {
    /* např. kontext bez import.meta */
  }
  return MARKETING_ORIGIN_PRIMARY_DEFAULT;
}

/** Absolutní URL na marketingovém webu (path začíná /). */
export function marketingUrl(path: string): string {
  const origin = getMarketingSiteOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${p}`;
}

/** Hostitelé, které bereme jako „naše“ odkazy (AI builder, validace). */
export function getMarketingSiteHostnameWhitelist(): string[] {
  const origins = new Set<string>([...MARKETING_ORIGINS_CANONICAL_SET, getMarketingSiteOrigin()]);
  try {
    const extra = import.meta.env?.VITE_MARKETING_SITE_ORIGINS_EXTRA as string | undefined;
    extra
      ?.split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean)
      .forEach((o) => origins.add(o));
  } catch {
    /* ignore */
  }
  return [...origins].map((o) => {
    try {
      return new URL(o).hostname;
    } catch {
      return '';
    }
  }).filter(Boolean);
}
