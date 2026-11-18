/**
 * Marketing snapshot ETL: denní pull agregátů z Ultra (licence, usage, workbook orders, Pipedrive)
 * a uložení do KV (později migrace do Postgres tabulek growth_*).
 */
import * as kv from './growthKv.ts';

const KEY_LATEST = 'marketing:snapshot:latest';
const KEY_RUNS = 'marketing:snapshot:runs';
const ULTRA_BASE = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/public/marketing/snapshot';

function secret(): string {
  return (Deno.env.get('MARKETING_SNAPSHOT_SECRET') || Deno.env.get('IDENTITY_UPSERT_SECRET') || '').trim();
}

export type MarketingSnapshotDeps = {
  app: any;
  requireAdmin: (req: Request) => Promise<Response | unknown>;
  cronSecretOk: (c: any) => boolean;
};

export async function pullMarketingSnapshot(): Promise<Record<string, unknown>> {
  const s = secret();
  if (!s) throw new Error('Chybí MARKETING_SNAPSHOT_SECRET / IDENTITY_UPSERT_SECRET.');
  // Ultra má zapnuté ověření JWT na gateway, takže jako Bearer musí jít anon klíč
  // projektu Ultra. Naše vlastní autorizace je v hlavičce X-Marketing-Secret.
  const ultraAnon = (Deno.env.get('ULTRA_ANON_KEY') || '').trim();
  const r = await fetch(ULTRA_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Marketing-Secret': s,
      ...(ultraAnon ? { Authorization: `Bearer ${ultraAnon}` } : {}),
    },
    body: '{}',
  });
  const text = await r.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { /* ignore */ }
  if (!r.ok) throw new Error(`Ultra snapshot ${r.status}: ${j?.error || text.slice(0, 200)}`);

  const summary = {
    at: new Date().toISOString(),
    ok: true,
    totals: j?.totals || null,
    organizations: Number(j?.totals?.organizations ?? 0),
    attributionAvailable: j?.attribution_available ?? null,
  };
  await kv.set(KEY_LATEST, j);
  const runs = (await kv.get(KEY_RUNS)) as any[] || [];
  await kv.set(KEY_RUNS, [summary, ...runs].slice(0, 30));
  return summary;
}

export function registerMarketingSnapshotRoutes(deps: MarketingSnapshotDeps): void {
  const { app } = deps;
  const P = '/make-server-93a20b6f';
  const both = (method: 'get' | 'post', path: string, handler: (c: any) => Promise<Response> | Response) => {
    app[method](`${P}${path}`, handler);
    app[method](path, handler);
  };
  const admin = (fn: (c: any) => Promise<Response>) => async (c: any) => {
    const gate = await deps.requireAdmin(c.req.raw);
    if (gate instanceof Response) return gate;
    try { return await fn(c); } catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  };

  both('post', '/cron/marketing-snapshot', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await pullMarketingSnapshot() }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });

  both('get', '/admin/marketing/snapshot', admin(async (c) => {
    const latest = await kv.get(KEY_LATEST);
    const runs = (await kv.get(KEY_RUNS)) as any[] || [];
    return c.json({ latest, runs: runs.slice(0, 10) });
  }));

  both('post', '/admin/marketing/snapshot/pull', admin(async (c) => {
    return c.json({ ok: true, run: await pullMarketingSnapshot() });
  }));
}
