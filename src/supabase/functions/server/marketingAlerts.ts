/**
 * Alerting: denní kontrola anomálií (útrata bez konverzí, pokles konverzí, vysoké CPA)
 * a odeslání do Slack webhooku (SLACK_WEBHOOK_URL), pokud je nastaven.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './growthKv.ts';

function sb() {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !key) throw new Error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

const KEY_LAST = 'marketing:alerts:last';

async function sendSlack(text: string): Promise<void> {
  const url = Deno.env.get('SLACK_WEBHOOK_URL')?.trim();
  if (!url) return;
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
}

export async function runAlerts(): Promise<Record<string, unknown>> {
  const sbc = sb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: metrics } = await sbc.from('growth_metrics_daily').select('campaign_id, campaign_name, impressions, clicks, cost_micros, conversions').gte('date', since);
  const agg = new Map<string, any>();
  for (const r of metrics || []) {
    const a = agg.get(r.campaign_id) || { name: r.campaign_name, impr: 0, clicks: 0, cost: 0, conv: 0 };
    a.impr += Number(r.impressions || 0);
    a.clicks += Number(r.clicks || 0);
    a.cost += Number(r.cost_micros || 0);
    a.conv += Number(r.conversions || 0);
    agg.set(r.campaign_id, a);
  }

  const alerts: string[] = [];
  for (const [id, a] of agg) {
    const costCzk = a.cost / 1_000_000;
    if (costCzk >= 50 && a.conv === 0) alerts.push(`⚠️ Kampaň „${a.name}“ utratila ${costCzk.toFixed(0)} Kč bez konverze (7d).`);
    if (a.impr >= 1000 && a.clicks / a.impr < 0.005) alerts.push(`📉 Kampaň „${a.name}“ má CTR ${(a.clicks / a.impr * 100).toFixed(2)} % (7d).`);
    if (a.conv > 0 && costCzk / a.conv > 500) alerts.push(`💸 Kampaň „${a.name}“ má CPA ${(costCzk / a.conv).toFixed(0)} Kč (7d).`);
  }

  if (alerts.length) {
    await sendSlack(`*Marketing alerts (7d):*\n${alerts.join('\n')}`);
  }
  const run = { at: new Date().toISOString(), alerts: alerts.length, list: alerts };
  try {
    await kv.set(KEY_LAST, run);
  } catch { /* best-effort */ }
  return run;
}

export function registerMarketingAlertsRoutes(deps: { app: any; requireAdmin: (req: Request) => Promise<Response | unknown>; cronSecretOk: (c: any) => boolean }): void {
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
  both('post', '/cron/marketing-alerts', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await runAlerts() }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });
  both('post', '/admin/marketing/alerts/run', admin(async (c) => {
    return c.json({ ok: true, run: await runAlerts() });
  }));
  both('get', '/admin/marketing/alerts', admin(async (c) => {
    const last: any = await kv.get(KEY_LAST);
    return c.json({ last: last || null, slackConfigured: Boolean(Deno.env.get('SLACK_WEBHOOK_URL')?.trim()) });
  }));
}
