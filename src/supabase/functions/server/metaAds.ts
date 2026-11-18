/**
 * Meta Ads: skeleton pro metriky a budoucí správu kampaní.
 * Zatím: denní pull metrik z Meta Marketing API (insights) do growth_metrics_daily (platform='meta').
 * Vyžaduje META_ACCESS_TOKEN a META_AD_ACCOUNT_ID (act_...).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './growthKv.ts';

function sb() {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !key) throw new Error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

function metaConfig(): { token: string; accountId: string } | null {
  const token = Deno.env.get('META_ACCESS_TOKEN')?.trim();
  const accountId = Deno.env.get('META_AD_ACCOUNT_ID')?.trim();
  if (!token || !accountId) return null;
  return { token, accountId: accountId.startsWith('act_') ? accountId : `act_${accountId}` };
}

const KEY_RUNS = 'meta:metrics:runs';

export async function pullMetaMetrics(date?: string): Promise<Record<string, unknown>> {
  const cfg = metaConfig();
  if (!cfg) return { ok: false, note: 'Meta Ads API není nastaveno (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID).' };
  const d = date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const started = Date.now();
  const run: Record<string, unknown> = { at: new Date().toISOString(), date: d };

  try {
    const url = `https://graph.facebook.com/v21.0/${cfg.accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions&time_range={"since":"${d}","until":"${d}"}&level=campaign&limit=500&access_token=${encodeURIComponent(cfg.token)}`;
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `Meta ${r.status}`);
    const rows = j?.data || [];
    const sbc = sb();
    const records = rows.map((row: any) => ({
      date: d,
      level: 'campaign',
      campaign_id: `meta:${row.campaign_id}`,
      campaign_name: row.campaign_name,
      ad_group_id: null,
      ad_group_name: null,
      keyword_id: null,
      keyword_text: null,
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      cost_micros: Math.round(Number(row.spend || 0) * 1_000_000),
      conversions: Number((row.actions || []).find((a: any) => a.action_type === 'purchase')?.value || 0),
      conversion_value: 0,
      currency: 'CZK',
    }));
    // upsert with platform distinction: store platform in campaign_id prefix (meta:) already
    if (records.length) {
      const { error } = await sbc.from('growth_metrics_daily').upsert(records, { onConflict: 'date,level,campaign_id,ad_group_id,keyword_id' });
      if (error) throw new Error(`upsert meta metrics: ${error.message}`);
    }
    run.rows = records.length;
  } catch (e: any) {
    run.error = e?.message || String(e);
  }

  run.ms = Date.now() - started;
  const runs = ((await kv.get('meta:metrics:runs')) as any[]) || [];
  await kv.set('meta:metrics:runs', [run, ...runs].slice(0, 30));
  return { ok: true, ...run };
}

export function registerMetaAdsRoutes(deps: { app: any; requireAdmin: (req: Request) => Promise<Response | unknown>; cronSecretOk: (c: any) => boolean }): void {
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
  both('post', '/cron/meta-metrics', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await pullMetaMetrics() }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });
  both('post', '/admin/meta-metrics/pull', admin(async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, run: await pullMetaMetrics(body?.date) });
  }));
}
