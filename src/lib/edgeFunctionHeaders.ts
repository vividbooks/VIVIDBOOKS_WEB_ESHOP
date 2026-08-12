import { publicAnonKey } from '/utils/supabase/info';
import { getSupabaseBrowser } from './supabaseBrowser';

/** Obnov session dřív než vyprší (autoRefresh v pozadí tabu často nestihne). */
const REFRESH_SKEW_MS = 5 * 60_000;

function sessionExpiresAtMs(session: { expires_at?: number } | null | undefined): number {
  return typeof session?.expires_at === 'number' ? session.expires_at * 1000 : 0;
}

function isExpiredOrNear(session: { expires_at?: number; access_token?: string } | null | undefined): boolean {
  if (!session?.access_token) return true;
  const exp = sessionExpiresAtMs(session);
  if (exp <= 0) return false;
  return exp < Date.now() + REFRESH_SKEW_MS;
}

/**
 * Vynutí refresh session. Vrací true, pokud máme platný access_token.
 */
export async function forceRefreshEdgeSession(): Promise<boolean> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.refreshSession();
  return !error && !!data.session?.access_token;
}

/**
 * Brána Supabase Edge Functions ověřuje JWT v `Authorization` — musí tam být platný anon JWT.
 * Uživatelský access_token se předává v `X-User-Access-Token`
 * (server: requireAdminJwt / getUserJwtFromRequest).
 *
 * Mailing admin endpointy (`/admin/mailchimp/*`, `/admin/email-drafts`, …) bez user JWT
 * vrací 401 Unauthorized.
 */
export async function getEdgeFunctionHeaders(includeJson = false): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowser();
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (isExpiredOrNear(session)) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      session = data.session;
    } else {
      const exp = sessionExpiresAtMs(session);
      // Vypršelo a refresh selhal — nepossuuj mrtvý JWT (server hlásí „Neplatná session“).
      if (!session?.access_token || (exp > 0 && exp <= Date.now())) {
        session = null;
      }
    }
  }

  const h: Record<string, string> = {
    Authorization: `Bearer ${publicAnonKey}`,
    apikey: publicAnonKey,
  };
  if (session?.access_token) {
    h['X-User-Access-Token'] = session.access_token;
  }
  if (includeJson) {
    h['Content-Type'] = 'application/json';
  }
  return h;
}

/** Stejné jako getEdgeFunctionHeaders, ale vyhodí srozumitelnou chybu, když chybí user JWT. */
export async function getRequiredEdgeFunctionHeaders(
  includeJson = false,
): Promise<Record<string, string>> {
  let h = await getEdgeFunctionHeaders(includeJson);
  if (!h['X-User-Access-Token']) {
    // Poslední pokus — force refresh (getSession někdy vrátí prázdno po cold start).
    const ok = await forceRefreshEdgeSession();
    if (ok) h = await getEdgeFunctionHeaders(includeJson);
  }
  if (!h['X-User-Access-Token']) {
    throw new Error(
      'Nejste přihlášeni (chybí nebo vypršela session). Obnovte stránku a přihlaste se znovu přes Google.',
    );
  }
  return h;
}

function looksLikeAuthFailure(status: number, bodyText: string): boolean {
  if (status !== 401 && status !== 403) return false;
  const t = bodyText.toLowerCase();
  return (
    t.includes('unauthorized') ||
    t.includes('neplatná') ||
    t.includes('vypršel') ||
    t.includes('chybí přihlášení') ||
    t.includes('forbidden')
  );
}

/**
 * fetch s admin JWT — při 401 jednou vynutí refresh session a zkusí znovu.
 * Používej pro mailing / email-drafts / další `requireAdminJwt` endpointy.
 */
export async function fetchWithAdminAuth(
  input: RequestInfo | URL,
  init?: RequestInit & { json?: boolean },
): Promise<Response> {
  const includeJson = init?.json ?? Boolean(init?.body && !(init.body instanceof FormData));
  const { json: _j, ...rest } = init || {};
  const headers = new Headers(rest.headers);
  const auth = await getRequiredEdgeFunctionHeaders(includeJson);
  for (const [k, v] of Object.entries(auth)) headers.set(k, v);

  let res = await fetch(input, { ...rest, headers });
  if (res.status !== 401 && res.status !== 403) return res;

  const cloneText = await res.clone().text().catch(() => '');
  if (!looksLikeAuthFailure(res.status, cloneText)) return res;

  const refreshed = await forceRefreshEdgeSession();
  if (!refreshed) return res;

  const auth2 = await getRequiredEdgeFunctionHeaders(includeJson);
  const headers2 = new Headers(rest.headers);
  for (const [k, v] of Object.entries(auth2)) headers2.set(k, v);
  return fetch(input, { ...rest, headers: headers2 });
}
