import { publicAnonKey } from '/utils/supabase/info';
import { getSupabaseBrowser } from './supabaseBrowser';

/**
 * Brána Supabase Edge Functions ověřuje JWT v `Authorization` — musí tam být platný anon JWT.
 * Uživatelský access_token se předává v `X-User-Access-Token` (server: make-server-954b19ad getUserJwtFromRequest).
 */
export async function getEdgeFunctionHeaders(includeJson = false): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowser().auth.getSession();
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
