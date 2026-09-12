/**
 * kabinet-trial — most z webu na Kabinet (registr škol a licencí Vividbooks Ultra).
 *
 * Prohlížeč (stránka /vyzkousejte-kabinet) volá tuhle funkci s anon klíčem, funkce
 * doplní tajemství KABINET_SECRET a přepošle žádost na Kabinet:
 *   POST /request  → POST  …/api/registr/hooks/web/trial-request  (založení / prodloužení trialu)
 *   GET  /check    → GET   …/api/registr/hooks/web/trial-check     (jen stav školy)
 * Odpověď Kabinetu se vrací beze změny až na kódy školy: ty z veřejného webu nikdy neodejdou
 * (u odmítnutých žádostí a u kontroly stavu se odstraní). Nic jiného funkce nedělá.
 *
 * Secrets: KABINET_SECRET (musí sedět s tajemstvím, které Kabinet ověřuje u
 * `/registr/hooks/web/*` — dnes `REGISTR_MAKE_SECRET`), volitelně KABINET_API_BASE,
 * KABINET_ANON_KEY (anon klíč projektu Ultra, výchozí je veřejný klíč níže).
 * Popis flow: vividbooks-ultra/docs/TRIAL-FLOW.md.
 */
import { resolveAllowedOrigin } from '../_shared/cors.ts';

const DEFAULT_KABINET_BASE = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/registr/hooks/web';
const DEFAULT_KABINET_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGl1dnFnbHNteGRzbnlhemloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjU3NDAsImV4cCI6MjA4NjQwMTc0MH0.lVO7a-wuM2vkqsJcgqvLkthTmrt5g0R3U_Tu0jU7bfY';

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

async function forward(path: string, init: RequestInit, origin: string | null): Promise<Response> {
  const secret = (Deno.env.get('KABINET_SECRET') || '').trim();
  if (!secret) return json({ ok: false, status: 'failed', message: 'KABINET_SECRET není nastavený.' }, 503, origin);
  const base = (Deno.env.get('KABINET_API_BASE') || DEFAULT_KABINET_BASE).replace(/\/+$/, '');
  const anon = (Deno.env.get('KABINET_ANON_KEY') || DEFAULT_KABINET_ANON).trim();
  try {
    const upstream = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        'x-registr-secret': secret,
        'x-registr-client': 'web',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      signal: AbortSignal.timeout(45_000),
    });
    let text = await upstream.text();
    // Veřejný web nesmí vydat kódy školy nikomu, kdo jen zná IČO: u odmítnutých žádostí je odstraníme.
    if (path.startsWith('/trial-request')) {
      try {
        const body = JSON.parse(text) as Record<string, unknown>;
        if (body && body.status !== 'created' && body.status !== 'extended') {
          delete body.teacherCode;
          delete body.studentCode;
          if (body.eligibility && typeof body.eligibility === 'object') {
            const elig = body.eligibility as Record<string, unknown>;
            delete elig.teacherCode;
            delete elig.studentCode;
            if (elig.activeTrial && typeof elig.activeTrial === 'object') {
              delete (elig.activeTrial as Record<string, unknown>).teacherCode;
              delete (elig.activeTrial as Record<string, unknown>).studentCode;
            }
          }
          text = JSON.stringify(body);
        }
      } catch {
        // není JSON — pošleme beze změny
      }
    }
    if (path.startsWith('/trial-check')) {
      try {
        const body = JSON.parse(text) as Record<string, unknown>;
        // Kódy zůstanou jen u známé školy bez přístupu (jsou neaktivní; aktivují se až vyplněním formuláře).
        const inactiveCodes = body.status === 'CAN_REGISTER' && body.known === true;
        if (!inactiveCodes) {
          delete body.teacherCode;
          delete body.studentCode;
        }
        if (body.activeTrial && typeof body.activeTrial === 'object') {
          delete (body.activeTrial as Record<string, unknown>).teacherCode;
          delete (body.activeTrial as Record<string, unknown>).studentCode;
        }
        text = JSON.stringify(body);
      } catch {
        // není JSON
      }
    }
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8', ...corsHeaders(origin) },
    });
  } catch (error) {
    console.error('[kabinet-trial] upstream failed:', error instanceof Error ? error.message : error);
    return json({ ok: false, status: 'failed', code: 'LEGACY_UNAVAILABLE', message: 'Kabinet neodpovídá, zkuste to prosím za chvíli.' }, 502, origin);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const url = new URL(req.url);
  // Cesta za názvem funkce: /functions/v1/kabinet-trial/<akce>
  const action = url.pathname.replace(/^.*\/kabinet-trial\/?/, '').replace(/\/+$/, '');

  if (req.method === 'POST' && action === 'request') {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, status: 'rejected', code: 'INVALID', message: 'Tělo musí být JSON.' }, 400, origin);
    }
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    // Z webu jde vždy trial z webu; důvod ani override si prohlížeč zvolit nesmí.
    const payload = { ...record, reason: 'web', override: false, dryRun: record.dryRun === true };
    return forward('/trial-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }, origin);
  }

  if (req.method === 'GET' && action === 'check') {
    const params = new URLSearchParams();
    for (const key of ['ico', 'email', 'teacherCode']) {
      const value = (url.searchParams.get(key) || '').trim();
      if (value) params.set(key, value);
    }
    if (![...params.keys()].length) return json({ ok: false, message: 'Zadejte IČO nebo e-mail.' }, 400, origin);
    return forward(`/trial-check?${params.toString()}`, { method: 'GET' }, origin);
  }

  return json({ ok: false, message: 'Neznámá akce. Použij POST /request nebo GET /check.' }, 404, origin);
});
