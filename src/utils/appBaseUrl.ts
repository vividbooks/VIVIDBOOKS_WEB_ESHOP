/**
 * Paths for full-page redirects (Stripe return_url, window.location).
 * React Router `navigate()` už basename z `import.meta.env.BASE_URL` řeší samo.
 *
 * Na GitHub Pages musí být v return_url prefix projektu (`/VIVIDBOOKS_WEB_ESHOP/`).
 * Spolehlivě ho zjistíme z URL našeho bundlu (`…/assets/index-*.js`), ne jen z build-time BASE_URL
 * (ten může být `/`, pokud build neproběhl s GH_PAGES base).
 */

function pathPrefixFromImportMeta(): string {
  const rawBase = import.meta.env.BASE_URL || '/';
  if (rawBase === '/') return '';
  return rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
}

/**
 * Prefix bez trailing slash, např. '' nebo '/VIVIDBOOKS_WEB_ESHOP'.
 * Za běhu: z <script src="…/assets/…"> na stejné origin.
 */
export function getAppPathPrefix(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return pathPrefixFromImportMeta();
  }

  const marker = '/assets/';
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src]');

  for (let i = scripts.length - 1; i >= 0; i--) {
    try {
      const url = new URL(scripts[i].src, window.location.href);
      if (url.origin !== window.location.origin) continue;
      const { pathname } = url;
      const idx = pathname.indexOf(marker);
      if (idx < 0) continue;
      if (idx === 0) return '';
      return pathname.slice(0, idx).replace(/\/$/, '') || '';
    } catch {
      continue;
    }
  }

  return pathPrefixFromImportMeta();
}

/** Cesta včetně prefixu nasazení, např. `/VIVIDBOOKS_WEB_ESHOP/objednavka/dekujeme`. */
export function appPath(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  const prefix = getAppPathPrefix();
  if (!prefix) {
    return `/${trimmed}`;
  }
  return `${prefix}/${trimmed}`;
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
