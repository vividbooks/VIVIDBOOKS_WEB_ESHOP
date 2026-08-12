/**
 * Server-side admin checks for Edge Functions (orders, analytics, …).
 * Klient posílá `Authorization: Bearer <anon>` + `X-User-Access-Token: <user JWT>` (stejně jako u ostatních funkcí).
 *
 * Secrets: ADMIN_ALLOWED_EMAILS (čárkou), volitelně ADMIN_ALLOWLIST_OFF=true pro lokální vývoj.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveAllowedOrigin } from './cors.ts';

/** Stejné CORS jako ostatní e-shop Edge funkce (admin volá z prohlížeče s anon + user JWT). */
function getAllowedFunctionOrigin(origin: string | null): string {
  return resolveAllowedOrigin(origin);
}

const ADMIN_FUNCTION_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': getAllowedFunctionOrigin(null),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-user-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...ADMIN_FUNCTION_CORS_HEADERS,
      'Access-Control-Allow-Origin': getAllowedFunctionOrigin(req.headers.get('origin')),
    },
  });
}

/** JWT s rolí anon/service_role — nesmí se brát jako přihlášení admina. */
function isAnonOrServiceJwt(token: string, anonKey: string): boolean {
  if (!token) return true;
  if (anonKey && token === anonKey) return true;
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: string };
    const role = String(payload?.role || '');
    return role === 'anon' || role === 'service_role';
  } catch {
    return false;
  }
}

/** Uživatelský JWT (ne anon) z hlaviček — stejná konvence jako make-server-954b19ad. */
export function getUserAccessTokenFromRequest(req: Request): string {
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? '';
  const fromX = req.headers.get('X-User-Access-Token')?.trim();
  if (fromX && !isAnonOrServiceJwt(fromX, anon)) return fromX;
  const auth = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (auth && !isAnonOrServiceJwt(auth, anon)) return auth;
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
    return json({ error: 'Server misconfigured.' }, 500, req);
  }
  const token = getUserAccessTokenFromRequest(req);
  if (!token) {
    return json(
      { error: 'Unauthorized. Chybí přihlášení — obnovte stránku a přihlaste se znovu.' },
      401,
      req,
    );
  }
  // Service role spolehlivěji ověří user JWT na Edge (anon client občas vrací false negative).
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || anon;
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) {
    console.warn(
      `[admin-auth] getUser failed: ${error?.message || 'no email'} (tokenLen=${token.length})`,
    );
    return json(
      {
        error:
          'Unauthorized. Neplatná nebo vypršelá session — obnovte stránku a přihlaste se znovu přes Google.',
      },
      401,
      req,
    );
  }
  const em = user.email.trim().toLowerCase();
  if (!isAdminEmailAllowed(em)) {
    return json({ error: 'Forbidden.' }, 403, req);
  }
  return { email: user.email };
}
