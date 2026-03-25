/**
 * Paths for full-page redirects (Stripe return_url, window.location).
 * React Router `navigate()` už basename z `import.meta.env.BASE_URL` řeší samo.
 */

/** Cesta včetně Vite `base`, např. `/VIVIDBOOKS_WEB_ESHOP/objednavka/dekujeme`. */
export function appPath(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  const rawBase = import.meta.env.BASE_URL || '/';
  const base = rawBase === '/' ? '' : rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  if (!base) {
    return `/${trimmed}`;
  }
  return `${base}/${trimmed}`;
}

/**
 * Absolutní URL (např. pro Stripe `return_url`). Volat jen v prohlížeči.
 * `pathWithOptionalQuery` může být `/objednavka/dekujeme` nebo `/foo?a=1`.
 */
export function absoluteAppUrl(pathWithOptionalQuery: string): string {
  const origin = window.location.origin;
  const q = pathWithOptionalQuery.indexOf('?');
  const pathPart = q >= 0 ? pathWithOptionalQuery.slice(0, q) : pathWithOptionalQuery;
  const search = q >= 0 ? pathWithOptionalQuery.slice(q) : '';
  return `${origin}${appPath(pathPart)}${search}`;
}
