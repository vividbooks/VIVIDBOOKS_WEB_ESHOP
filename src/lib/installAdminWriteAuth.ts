import { isProtectedContentWrite } from '../supabase/functions/server/contentWriteGuard';

const FN_MARKER = '/functions/v1/make-server-93a20b6f';

/**
 * Zápisy obsahu webu (POST/PUT/PATCH/DELETE na /admin/webinare, /admin/blog, /products, …)
 * server pouští jen s JWT přihlášeného admina v `X-User-Access-Token`.
 * Administrace volá tyto routy z mnoha míst s pouhým anon klíčem — tahle pojistka hlavičku
 * doplní centrálně u každého takového fetch, pokud ji volající už neposlal.
 * Ostatní požadavky (GET, veřejné routy, jiné domény) nechává beze změny; Supabase klient
 * se načítá líně až při prvním chráněném zápisu, takže veřejný web nic nestojí.
 */
export function installAdminWriteAuth(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const w = window as typeof window & { __vbAdminWriteAuth?: boolean };
  if (w.__vbAdminWriteAuth) return;
  w.__vbAdminWriteAuth = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      const idx = url.indexOf(FN_MARKER);
      if (idx < 0) return origFetch(input, init);
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const pathname = new URL(url, window.location.origin).pathname;
      if (!isProtectedContentWrite(method, pathname.slice(pathname.indexOf(FN_MARKER)))) {
        return origFetch(input, init);
      }
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (headers.has('X-User-Access-Token')) return origFetch(input, init);

      const { getEdgeFunctionHeaders } = await import('./edgeFunctionHeaders');
      const auth = await getEdgeFunctionHeaders(false);
      if (!auth['X-User-Access-Token']) return origFetch(input, init);
      headers.set('X-User-Access-Token', auth['X-User-Access-Token']);
      if (!headers.has('Authorization')) headers.set('Authorization', auth.Authorization);
      if (!headers.has('apikey')) headers.set('apikey', auth.apikey);

      if (input instanceof Request) return origFetch(new Request(input, { ...init, headers }));
      return origFetch(input, { ...init, headers });
    } catch (e) {
      console.warn('[admin-write-auth] nepodařilo se doplnit přihlášení, posílám beze změny', e);
      return origFetch(input, init);
    }
  };
}
