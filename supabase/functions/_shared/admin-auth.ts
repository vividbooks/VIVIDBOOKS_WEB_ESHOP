/**
 * Server-side admin checks for Edge Functions (orders, analytics, …).
 * Klient posílá `Authorization: Bearer <anon>` + `X-User-Access-Token: <user JWT>` (stejně jako u ostatních funkcí).
 *
 * Secrets: ADMIN_ALLOWED_EMAILS (čárkou), volitelně ADMIN_ALLOWLIST_OFF=true pro lokální vývoj.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

/** Stejné CORS jako ostatní e-shop Edge funkce (admin volá z prohlížeče s anon + user JWT). */
export const ADMIN_FUNCTION_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-user-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...ADMIN_FUNCTION_CORS_HEADERS,
    },
  });
}

/** Uživatelský JWT (ne anon) z hlaviček — stejná konvence jako make-server-954b19ad. */
export function getUserAccessTokenFromRequest(req: Request): string {
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? '';
  const fromX = req.headers.get('X-User-Access-Token')?.trim();
  if (fromX && fromX !== anon) return fromX;
  const auth = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (auth && auth !== anon) return auth;
  return '';
}

export function parseAdminAllowlist(): Set<string> {
  const raw = Deno.env.get('ADMIN_ALLOWED_EMAILS')?.trim();
  const list = raw
    ? raw.split(/[,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    : ['vitek@vividbooks.com', 'dan@vividbooks.com'];
  return new Set(list);
}

export function isAdminEmailAllowed(email: string): boolean {
  return parseAdminAllowlist().has(email.trim().toLowerCase());
}

export async function requireAdminJwt(req: Request): Promise<{ email: string } | Response> {
  if (Deno.env.get('ADMIN_ALLOWLIST_OFF') === 'true' || Deno.env.get('ADMIN_ALLOWLIST_OFF') === '1') {
    return { email: 'dev@local' };
  }
  const url = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!url || !anon) {
    return json({ error: 'Server misconfigured.' }, 500);
  }
  const token = getUserAccessTokenFromRequest(req);
  if (!token) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  const em = user.email.trim().toLowerCase();
  if (!isAdminEmailAllowed(em)) {
    return json({ error: 'Forbidden.' }, 403);
  }
  return { email: user.email };
}
