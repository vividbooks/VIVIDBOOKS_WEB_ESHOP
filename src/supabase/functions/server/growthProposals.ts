/**
 * Growth proposals: pravidlový engine generující návrhy změn kampaní,
 * approval workflow a aplikace přes Google Ads API (validate_only → confirm).
 */
import { sbService } from './dvpp/shared.ts';
import { gadsConfig, gads } from './googleAdsGrowth.ts';
import * as kv from './growthKv.ts';
import { proposalKey, shouldPauseKeyword, shouldAddNegative, isLowCtr } from './growthRules.ts';

const KEY_RUNS = 'growth:proposals:runs';

function autoApplyEnabled(): boolean {
  return Deno.env.get('GROWTH_AUTO_APPLY_ENABLED')?.trim().toLowerCase() === 'true';
}

// ---- generate proposals from last 7 days of metrics ----

export async function generateProposals(): Promise<{ created: number; skipped: number }> {
  const sb = sbService();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // existing proposals to avoid duplicates (aplikované posledních 14 dní také)
  const { data: existing } = await sb.from('growth_proposals')
    .select('type, entity_id, status, applied_at')
    .in('status', ['draft', 'approved', 'applied']);
  const appliedCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const existingKeys = new Set(
    (existing || [])
      .filter((r: any) => r.status !== 'applied' || !r.applied_at || new Date(r.applied_at).getTime() >= appliedCutoff)
      .map((r: any) => proposalKey(String(r.type), String(r.entity_id))),
  );

  const proposals: any[] = [];
  let skipped = 0;

  // 1) pause_keyword: keyword with cost >= 5 CZK, 0 conversions, >= 10 clicks over 7d
  const { data: kwRows } = await sb.from('growth_metrics_daily')
    .select('keyword_id, keyword_text, campaign_id, ad_group_id, cost_micros, clicks, conversions, impressions')
    .eq('level', 'keyword').gte('date', since);
  const kwAgg = new Map<string, any>();
  for (const r of kwRows || []) {
    const key = `${r.campaign_id}:${r.ad_group_id}:${r.keyword_id}`;
    const a = kwAgg.get(key) || { keyword_id: r.keyword_id, keyword_text: r.keyword_text, campaign_id: r.campaign_id, ad_group_id: r.ad_group_id, cost: 0, clicks: 0, conv: 0, impr: 0 };
    a.cost += Number(r.cost_micros || 0);
    a.clicks += Number(r.clicks || 0);
    a.conv += Number(r.conversions || 0);
    a.impr += Number(r.impressions || 0);
    kwAgg.set(key, a);
  }
  for (const a of kwAgg.values()) {
    if (shouldPauseKeyword(a)) {
      const k = proposalKey('pause_keyword', String(a.keyword_id));
      if (existingKeys.has(k)) { skipped++; continue; }
      proposals.push({
        type: 'pause_keyword',
        entity_type: 'keyword',
        entity_id: a.keyword_id,
        entity_name: a.keyword_text,
        current_value: { status: 'ENABLED' },
        proposed_value: { status: 'PAUSED' },
        evidence: { window_days: 7, cost_czk: a.cost / 1_000_000, clicks: a.clicks, conversions: a.conv, impressions: a.impr },
        expected_impact: { save_czk_per_week: a.cost / 1_000_000 },
      });
    }
  }

  // 2) add_negative: search term with cost >= 2 CZK, 0 conversions, >= 5 clicks
  const { data: stRows } = await sb.from('growth_search_terms_daily')
    .select('search_term, campaign_id, ad_group_id, cost_micros, clicks, conversions, impressions')
    .gte('date', since);
  const stAgg = new Map<string, any>();
  for (const r of stRows || []) {
    const key = `${r.campaign_id}:${r.ad_group_id}:${r.search_term}`;
    const a = stAgg.get(key) || { search_term: r.search_term, campaign_id: r.campaign_id, ad_group_id: r.ad_group_id, cost: 0, clicks: 0, conv: 0, impr: 0 };
    a.cost += Number(r.cost_micros || 0);
    a.clicks += Number(r.clicks || 0);
    a.conv += Number(r.conversions || 0);
    a.impr += Number(r.impressions || 0);
    stAgg.set(key, a);
  }
  for (const a of stAgg.values()) {
    if (shouldAddNegative(a)) {
      const k = proposalKey('add_negative', `${a.campaign_id}:${a.search_term}`);
      if (existingKeys.has(k)) { skipped++; continue; }
      proposals.push({
        type: 'add_negative',
        entity_type: 'search_term',
        entity_id: `${a.campaign_id}:${a.search_term}`,
        entity_name: a.search_term,
        current_value: { negative: false },
        proposed_value: { negative: true, match_type: 'PHRASE' },
        evidence: { window_days: 7, cost_czk: a.cost / 1_000_000, clicks: a.clicks, conversions: a.conv, impressions: a.impr, campaign_id: a.campaign_id },
        expected_impact: { save_czk_per_week: a.cost / 1_000_000 },
      });
    }
  }

  // 3) flag_low_ctr: campaign with impressions >= 1000 and CTR < 1% over 7d
  const { data: campRows } = await sb.from('growth_metrics_daily')
    .select('campaign_id, campaign_name, impressions, clicks, cost_micros, conversions')
    .eq('level', 'campaign').gte('date', since);
  const campAgg = new Map<string, any>();
  for (const r of campRows || []) {
    const a = campAgg.get(r.campaign_id) || { campaign_id: r.campaign_id, campaign_name: r.campaign_name, impr: 0, clicks: 0, cost: 0, conv: 0 };
    a.impr += Number(r.impressions || 0);
    a.clicks += Number(r.clicks || 0);
    a.cost += Number(r.cost_micros || 0);
    a.conv += Number(r.conversions || 0);
    campAgg.set(r.campaign_id, a);
  }
  for (const a of campAgg.values()) {
    if (isLowCtr(a)) {
      const k = proposalKey('flag_low_ctr', String(a.campaign_id));
      if (existingKeys.has(k)) { skipped++; continue; }
      proposals.push({
        type: 'flag_low_ctr',
        entity_type: 'campaign',
        entity_id: a.campaign_id,
        entity_name: a.campaign_name,
        current_value: { ctr: a.clicks / a.impr },
        proposed_value: { action: 'review_ad_copy_and_keywords' },
        evidence: { window_days: 7, impressions: a.impr, clicks: a.clicks, ctr: a.clicks / a.impr, cost_czk: a.cost / 1_000_000, conversions: a.conv },
        expected_impact: { note: 'Nízké CTR — zkontrolovat nadpisy inzerátů a klíčová slova (bez automatické změny).' },
      });
    }
  }

  if (proposals.length) {
    const { error } = await sb.from('growth_proposals').insert(proposals);
    if (error) throw new Error(`insert proposals: ${error.message}`);
  }

  const run = { at: new Date().toISOString(), created: proposals.length, skipped };
  const runs = ((await kv.get(KEY_RUNS)) as any[]) || [];
  await kv.set(KEY_RUNS, [run, ...runs].slice(0, 30));
  return { created: proposals.length, skipped };
}

// ---- apply a proposal ----

export async function applyProposal(id: string, approvedBy: string): Promise<{ ok: boolean; error?: string }> {
  const sb = sbService();
  const { data: p, error: fetchErr } = await sb.from('growth_proposals').select('*').eq('id', id).maybeSingle();
  if (fetchErr || !p) return { ok: false, error: 'Návrh nenalezen.' };
  if (p.status !== 'approved') return { ok: false, error: 'Návrh není ve stavu schváleno.' };

  const cfg = gadsConfig();
  const mock = !cfg;
  let auditAction = p.type;
  if (!mock && !autoApplyEnabled()) return { ok: false, error: 'Auto-apply je vypnuté (GROWTH_AUTO_APPLY_ENABLED != true).' };
  if (mock) {
    // Mock mode: mark as applied without calling Google Ads API
    await sb.from('growth_proposals').update({ status: 'applied', applied_at: new Date().toISOString(), result: { mock: true, note: 'Ukázkový režim — Google Ads API není připojeno.' }, error: null }).eq('id', id);
    await sb.from('growth_audit_log').insert({ actor: approvedBy, action: auditAction, entity: p.entity_id, before: p.current_value, after: p.proposed_value, result: { mock: true } });
    return { ok: true };
  }

  const cid = cfg.customerId;
  let mutateBody: any = null;

  if (p.type === 'pause_keyword') {
    const ev = p.evidence || {};
    const adGroupId = ev.ad_group_id || p.proposed_value?.ad_group_id;
    const keywordId = p.entity_id;
    if (!adGroupId || !keywordId) return { ok: false, error: 'Chybí ad_group_id / keyword_id.' };
    mutateBody = {
      mutateOperations: [{
        adGroupCriterionOperation: {
          update: { resourceName: `customers/${cid}/adGroupCriteria/${adGroupId}~${keywordId}`, status: 'PAUSED' },
          updateMask: 'status',
        },
      }],
      partialFailure: true,
    };
  } else if (p.type === 'add_negative') {
    const ev = p.evidence || {};
    const campaignId = ev.campaign_id;
    const term = p.entity_name;
    if (!campaignId || !term) return { ok: false, error: 'Chybí campaign_id / term.' };
    mutateBody = {
      mutateOperations: [{
        campaignCriterionOperation: {
          create: { campaign: `customers/${cid}/campaigns/${campaignId}`, negative: true, keyword: { text: term, matchType: 'PHRASE' } },
        },
      }],
      partialFailure: true,
    };
  } else {
    return { ok: false, error: `Typ ${p.type} se neaplikuje automaticky (jen informativní).` };
  }

  try {
    // validate_only dry run first
    const dry = await gads(cfg, mutateBody.mutateOperations[0].adGroupCriterionOperation ? '/googleAds:mutate' : '/googleAds:mutate', { ...mutateBody, validateOnly: true });
    // then real apply
    const res = await gads(cfg, '/googleAds:mutate', mutateBody);
    await sb.from('growth_proposals').update({ status: 'applied', applied_at: new Date().toISOString(), result: res, error: null }).eq('id', id);
    await sb.from('growth_audit_log').insert({ actor: approvedBy, action: auditAction, entity: p.entity_id, before: p.current_value, after: p.proposed_value, result: res });
    return { ok: true };
  } catch (e: any) {
    const msg = e?.message || String(e);
    await sb.from('growth_proposals').update({ status: 'failed', error: msg }).eq('id', id);
    await sb.from('growth_audit_log').insert({ actor: approvedBy, action: auditAction, entity: p.entity_id, before: p.current_value, after: p.proposed_value, result: null, error: msg });
    return { ok: false, error: msg };
  }
}

// ---- routes ----

export function registerGrowthProposalsRoutes(deps: { app: any; requireAdmin: (req: Request) => Promise<Response | unknown>; cronSecretOk: (c: any) => boolean }): void {
  const { app } = deps;
  const P = '/make-server-93a20b6f';
  const both = (method: 'get' | 'post' | 'put', path: string, handler: (c: any) => Promise<Response> | Response) => {
    app[method](`${P}${path}`, handler);
    app[method](path, handler);
  };
  const admin = (fn: (c: any) => Promise<Response>) => async (c: any) => {
    const gate = await deps.requireAdmin(c.req.raw);
    if (gate instanceof Response) return gate;
    try { return await fn(c); } catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  };

  both('post', '/cron/growth-proposals', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await generateProposals() }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });
  both('post', '/admin/growth-proposals/generate', admin(async (c) => {
    return c.json({ ok: true, run: await generateProposals() });
  }));
  both('get', '/admin/growth-proposals', admin(async (c) => {
    const sb = sbService();
    const status = c.req.query('status');
    let q = sb.from('growth_proposals').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ proposals: data || [], mock: !gadsConfig() });
  }));
  both('post', '/admin/growth-proposals/:id/approve', admin(async (c) => {
    const id = c.req.param('id');
    const sb = sbService();
    const { data: u } = await sb.from('growth_proposals').update({ status: 'approved', approved_by: 'admin', updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
    return c.json({ ok: true, proposal: u });
  }));
  both('post', '/admin/growth-proposals/:id/reject', admin(async (c) => {
    const id = c.req.param('id');
    const sb = sbService();
    const { data: u } = await sb.from('growth_proposals').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
    return c.json({ ok: true, proposal: u });
  }));
  both('post', '/admin/growth-proposals/:id/apply', admin(async (c) => {
    const id = c.req.param('id');
    const res = await applyProposal(id, 'admin');
    return c.json(res, res.ok ? 200 : 400);
  }));
  both('get', '/admin/growth-audit-log', admin(async (c) => {
    const sb = sbService();
    const { data, error } = await sb.from('growth_audit_log').select('*').order('at', { ascending: false }).limit(50);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ entries: data || [] });
  }));
}
