/**
 * Sdílené konstanty bez import.meta — bezpečné pro Edge (Deno) i Vite.
 */

export const MARKETING_ORIGIN_PRIMARY_DEFAULT = 'https://new.vividbooks.com';

export const MARKETING_ORIGIN_WWW = 'https://www.vividbooks.com';

export const MARKETING_ORIGIN_APEX = 'https://vividbooks.com';

/** Primární + příprava www/apex pro whitelist odkazů */
export const MARKETING_ORIGINS_CANONICAL_SET: readonly string[] = [
  MARKETING_ORIGIN_PRIMARY_DEFAULT,
  MARKETING_ORIGIN_WWW,
  MARKETING_ORIGIN_APEX,
];
