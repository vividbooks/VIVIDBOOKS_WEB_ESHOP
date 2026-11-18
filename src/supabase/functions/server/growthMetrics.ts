/**
 * ETL: denní pull metrik z Google Ads (GAQL) do tabulek growth_metrics_daily / growth_search_terms_daily.
 */
import { gadsConfig, gads } from './googleAdsGrowth.ts';
import { sbService } from './dvpp/shared.ts';
import * as kv from './growthKv.ts';

const KEY_RUNS = 'growth:metrics:runs';

function yesterdayIso(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function fetchAllPages(cfg: any, query: string): Promise<any[]> {
  const out: any[] = [];
  let pageToken: string | undefined;
  do {
    const body: any = { query, pageSize: 10000 };
    if (pageToken) body.pageToken = pageToken;
    const j = await gads(cfg, '/googleAds:search', body);
    out.push(...(j.results || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

export async function pullGrowthMetrics(date?: string): Promise<Record<string, unknown>> {
  const cfg = gadsConfig();
  const d = date || yesterdayIso();
  const mock = !cfg;
  const sb = sbService();
  const started = Date.now();
  const run: Record<string, unknown> = { at: new Date().toISOString(), date: d, mock };
  // ---- Mock data (when no Google Ads credentials) ----
  // 30 dní historie, realistické CPC (~10 Kč) a záměrně pár "drahých a nefunkčních"
  // slov/termínů, aby pravidlový engine měl co navrhnout.
  const MOCK_DAYS = 30;
  const mockDates: string[] = date
    ? [d]
    : Array.from({ length: MOCK_DAYS }, (_, i) =>
        new Date(Date.now() - (MOCK_DAYS - 1 - i) * 86400000).toISOString().slice(0, 10));

  // deterministické kolísání 0,75–1,25 podle dne a entity
  function wobble(day: string, seed: number): number {
    let h = seed;
    for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) % 99991;
    return 0.75 + (h % 51) / 100;
  }

  type MockBase = { impressions: number; clicks: number; cpcCzk: number; conversions: number };
  const mockCampaignDefs = [
    { id: 'mock_1', name: 'Vividbooks – Fyzika 6. ročník', impressions: 900, clicks: 45, cpcCzk: 7.8, conversions: 1.6 },
    { id: 'mock_2', name: 'Vividbooks – Matematika 5. ročník', impressions: 600, clicks: 22, cpcCzk: 8.2, conversions: 0.7 },
    { id: 'mock_3', name: 'Vividbooks – Chemie 8. ročník', impressions: 700, clicks: 4, cpcCzk: 6.5, conversions: 0 },
    { id: 'mock_4', name: 'Vividbooks – Značka', impressions: 400, clicks: 12, cpcCzk: 6.0, conversions: 0.6 },
  ];
  const mockKeywordDefs = [
    { campaign: 'mock_1', adGroup: 'ag1', kwId: 'kw1', text: 'pracovní sešit fyzika 6. ročník', impressions: 500, clicks: 30, cpcCzk: 7.8, conversions: 1.2 },
    { campaign: 'mock_1', adGroup: 'ag1', kwId: 'kw2', text: 'fyzika sešit 6. třída', impressions: 150, clicks: 6, cpcCzk: 9.0, conversions: 0 },
    { campaign: 'mock_2', adGroup: 'ag2', kwId: 'kw3', text: 'matematika pracovní sešit 5. ročník', impressions: 300, clicks: 12, cpcCzk: 8.2, conversions: 0.4 },
    { campaign: 'mock_3', adGroup: 'ag3', kwId: 'kw4', text: 'chemie sešit 8. ročník', impressions: 300, clicks: 2, cpcCzk: 6.5, conversions: 0 },
  ];
  const mockTermDefs = [
    { campaign: 'mock_1', adGroup: 'ag1', term: 'fyzika pracovní sešit 6 ročník', impressions: 220, clicks: 9, cpcCzk: 7.8, conversions: 0.4 },
    { campaign: 'mock_1', adGroup: 'ag1', term: 'fyzika pdf zdarma', impressions: 120, clicks: 6, cpcCzk: 7.5, conversions: 0 },
    { campaign: 'mock_2', adGroup: 'ag2', term: 'matematika sešit 5. třída', impressions: 160, clicks: 6, cpcCzk: 8.2, conversions: 0.2 },
    { campaign: 'mock_3', adGroup: 'ag3', term: 'chemie učebnice 8. ročník', impressions: 110, clicks: 2, cpcCzk: 6.5, conversions: 0 },
  ];
  function mockScale(base: MockBase, day: string, seed: number) {
    const w = wobble(day, seed);
    const impressions = Math.max(1, Math.round(base.impressions * w));
    const clicks = Math.max(base.clicks === 0 ? 0 : 1, Math.round(base.clicks * w));
    return {
      impressions,
      clicks,
      cost_micros: Math.round(clicks * base.cpcCzk * 1_000_000),
      conversions: Math.round(base.conversions * w * 100) / 100,
    };
  }

  // 1) Campaign-level metrics
  try {
    let records: any[];
    if (mock) {
      records = mockDates.flatMap((day, di) => mockCampaignDefs.map((c, ci) => {
        const s = mockScale(c, day, 101 + ci);
        return {
          date: day, level: 'campaign', campaign_id: c.id, campaign_name: c.name,
          ad_group_id: null, ad_group_name: null, keyword_id: null, keyword_text: null,
          impressions: s.impressions, clicks: s.clicks, cost_micros: s.cost_micros,
          conversions: s.conversions, conversion_value: Math.round(s.conversions * 490),
          currency: 'CZK',
        };
      }));
    } else {
      const rows = await fetchAllPages(cfg!, `SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date = '${d}'`);
      records = rows.map((r: any) => ({
        date: d, level: 'campaign', campaign_id: String(r.campaign?.id ?? ''),
        campaign_name: r.campaign?.name ?? null, ad_group_id: null, ad_group_name: null,
        keyword_id: null, keyword_text: null, impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0), cost_micros: Number(r.metrics?.costMicros ?? 0),
        conversions: Number(r.metrics?.conversions ?? 0), conversion_value: Number(r.metrics?.conversionsValue ?? 0),
        currency: 'CZK',
      }));
    }
    // Replace, ne upsert: unikátní index obsahuje NULL sloupce, a v Postgresu
    // NULL != NULL, takže by se řádky kampaní při každém stažení duplikovaly.
    const dates = mock ? mockDates : [d];
    const del = await sb.from('growth_metrics_daily').delete().eq('level', 'campaign').in('date', dates);
    if (del.error) throw new Error(`delete campaign metrics: ${del.error.message}`);
    if (records.length) {
      const { error } = await sb.from('growth_metrics_daily').insert(records);
      if (error) throw new Error(`insert campaign metrics: ${error.message}`);
    }
    run.campaignRows = records.length;
  } catch (e: any) {
    run.campaignError = e?.message || String(e);
  }

  // 1b) Keyword-level metrics
  try {
    let records: any[];
    if (mock) {
      records = mockDates.flatMap((day) => mockKeywordDefs.map((k, ki) => {
        const s = mockScale(k, day, 211 + ki);
        return {
          date: day, level: 'keyword', campaign_id: k.campaign, campaign_name: null,
          ad_group_id: k.adGroup, ad_group_name: null, keyword_id: k.kwId, keyword_text: k.text,
          impressions: s.impressions, clicks: s.clicks, cost_micros: s.cost_micros,
          conversions: s.conversions, conversion_value: 0, currency: 'CZK',
        };
      }));
    } else {
      const rows = await fetchAllPages(cfg!, `SELECT campaign.id, ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE segments.date = '${d}'`);
      records = rows.map((r: any) => ({
        date: d, level: 'keyword', campaign_id: String(r.campaign?.id ?? ''),
        campaign_name: null, ad_group_id: String(r.adGroup?.id ?? ''), ad_group_name: null,
        keyword_id: String(r.adGroupCriterion?.criterionId ?? ''),
        keyword_text: r.adGroupCriterion?.keyword?.text ?? null,
        impressions: Number(r.metrics?.impressions ?? 0), clicks: Number(r.metrics?.clicks ?? 0),
        cost_micros: Number(r.metrics?.costMicros ?? 0), conversions: Number(r.metrics?.conversions ?? 0),
        conversion_value: 0, currency: 'CZK',
      }));
    }
    const dates = mock ? mockDates : [d];
    const del = await sb.from('growth_metrics_daily').delete().eq('level', 'keyword').in('date', dates);
    if (del.error) throw new Error(`delete keyword metrics: ${del.error.message}`);
    if (records.length) {
      const { error } = await sb.from('growth_metrics_daily').insert(records);
      if (error) throw new Error(`insert keyword metrics: ${error.message}`);
    }
    run.keywordRows = records.length;
  } catch (e: any) {
    run.keywordError = e?.message || String(e);
  }

  // 2) Search terms
  try {
    let records: any[];
    if (mock) {
      records = mockDates.flatMap((day) => mockTermDefs.map((s0, ti) => {
        const s = mockScale(s0, day, 307 + ti);
        return {
          date: day, campaign_id: s0.campaign, ad_group_id: s0.adGroup, search_term: s0.term,
          match_type: 'PHRASE', impressions: s.impressions, clicks: s.clicks,
          cost_micros: s.cost_micros, conversions: s.conversions,
        };
      }));
    } else {
      const rows = await fetchAllPages(cfg!, `SELECT campaign.id, ad_group.id, search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date = '${d}'`);
      records = rows.map((r: any) => ({
        date: d, campaign_id: String(r.campaign?.id ?? ''),
        ad_group_id: String(r.adGroup?.id ?? ''),
        search_term: String(r.searchTermView?.searchTerm ?? ''),
        match_type: r.searchTermView?.status ?? null,
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
        cost_micros: Number(r.metrics?.costMicros ?? 0),
        conversions: Number(r.metrics?.conversions ?? 0),
      })).filter((r: any) => r.search_term);
    }
    const dates = mock ? mockDates : [d];
    const del = await sb.from('growth_search_terms_daily').delete().in('date', dates);
    if (del.error) throw new Error(`delete search terms: ${del.error.message}`);
    if (records.length) {
      const { error } = await sb.from('growth_search_terms_daily').insert(records);
      if (error) throw new Error(`insert search terms: ${error.message}`);
    }
    run.searchTermRows = records.length;
  } catch (e: any) {
    run.searchTermError = e?.message || String(e);
  }

  run.ms = Date.now() - started;
  if (mock) run.mockDays = mockDates.length;
  const runs = ((await kv.get('growth:metrics:runs')) as any[]) || [];
  await kv.set('growth:metrics:runs', [run, ...runs].slice(0, 30));
  return { ok: true, ...run };
}

export function registerGrowthMetricsRoutes(deps: { app: any; requireAdmin: (req: Request) => Promise<Response | unknown>; cronSecretOk: (c: any) => boolean }): void {
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
  both('post', '/cron/growth-metrics', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await pullGrowthMetrics() }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });
  both('post', '/admin/growth-metrics/pull', admin(async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ ok: true, run: await pullGrowthMetrics(body?.date) });
  }));
  both('get', '/admin/growth-metrics/summary', admin(async (c) => {
    const sb = sbService();
    const { data, error } = await sb.from('growth_metrics_daily').select('*').order('date', { ascending: false }).limit(50);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ rows: data || [] });
  }));
}
