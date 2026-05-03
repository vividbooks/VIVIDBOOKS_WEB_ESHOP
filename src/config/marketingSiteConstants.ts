/**
 * Sdílené konstanty bez import.meta — bezpečné pro Edge (Deno) i Vite.
 */

/** Krátký popisek webu — výchozí meta description, titulek homepage, OG / schema. */
export const MARKETING_SITE_TAGLINE_CS = 'Učení, které inspiruje a baví.';

export const MARKETING_ORIGIN_PRIMARY_DEFAULT = 'https://new.vividbooks.com';

export const MARKETING_ORIGIN_WWW = 'https://www.vividbooks.com';

export const MARKETING_ORIGIN_APEX = 'https://vividbooks.com';

/** Primární + příprava www/apex pro whitelist odkazů */
export const MARKETING_ORIGINS_CANONICAL_SET: readonly string[] = [
  MARKETING_ORIGIN_PRIMARY_DEFAULT,
  MARKETING_ORIGIN_WWW,
  MARKETING_ORIGIN_APEX,
];
