/**
 * Server-side konverze: denní sync zaplacených objednávek → marketing_conversions
 * + volitelný GA4 Measurement Protocol (pokud jsou GA4_MEASUREMENT_ID / GA4_API_SECRET).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './growthKv.ts';
import { gadsConfig } from './googleAdsGrowth.ts';

function sb() {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !key) throw new Error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

const KEY_RUNS = 'marketing:conversions:runs';

/**
 * Zaplacené objednávky v e-shopu nekončí stavem `paid` — po zaplacení je workflow
 * posune na `processing`/`exported`/`shipped`/`delivered`. Stejná množina jako
 * BOUGHT_ORDER_STATUSES v identityUpsert.ts.
 */
const PAID_STATUSES = ['paid', 'processing', 'exported', 'shipped', 'delivered'];

export async function syncPurchaseConversions(): Promise<Record<string, unknown>> {
  const sbc = sb();
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const started = Date.now();
  const run: Record<string, unknown> = { at: new Date().toISOString() };

  // 1) zaplacené objednávky za posledních 72h (starší exporty někdy nemají paid_at)
  const { data: orders, error: oErr } = await sbc
    .from('orders')
    .select('id, order_number, status, total, customer_email, paid_at, created_at, marketing_anon_id')
    .in('status', PAID_STATUSES)
    .or(`paid_at.gte.${since},and(paid_at.is.null,created_at.gte.${since})`);
  if (oErr) throw new Error(`orders: ${oErr.message}`);

  // 2) které už máme
  const { data: existing } = await sbc.from('marketing_conversions').select('order_id').eq('type', 'purchase');
  const have = new Set((existing || []).map((r: any) => r.order_id));

  const ga4Mid = Deno.env.get('GA4_MEASUREMENT_ID')?.trim();
  const ga4Secret = Deno.env.get('GA4_API_SECRET')?.trim();

  let inserted = 0;
  let ga4Sent = 0;
  const errors: string[] = [];

  for (const o of orders || []) {
    if (have.has(o.id)) continue;
    // 1) přímé pojítko z pokladny: orders.marketing_anon_id → marketing_touchpoints
    let anonId: string | null = null;
    let gclid: string | null = null;
    let personId: string | null = null;
    let consentMarketing: boolean | null = null;
    let consentAnalytics: boolean | null = null;

    try {
      if (o.marketing_anon_id) {
        const { data: tp } = await sbc.from('marketing_touchpoints')
          .select('anon_id, gclid, consent_analytics, consent_marketing')
          .eq('anon_id', String(o.marketing_anon_id))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tp) {
          anonId = tp.anon_id;
          gclid = tp.gclid;
          consentMarketing = tp.consent_marketing ?? null;
          consentAnalytics = tp.consent_analytics ?? null;
        }
      }

      // 2) záložní cesta, když objednávka anon ID nemá: e-mail → osoba → touchpoint
      if (!gclid && !anonId) {
        const { data: ie } = await sbc.from('identity_emails').select('person_id').eq('email', String(o.customer_email).toLowerCase()).maybeSingle();
        if (ie?.person_id) {
          personId = String(ie.person_id);
          const { data: tp } = await sbc.from('marketing_touchpoints').select('anon_id, gclid, consent_analytics, consent_marketing').eq('person_id', personId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (tp) {
            anonId = tp.anon_id;
            gclid = tp.gclid;
            consentMarketing = tp.consent_marketing ?? null;
            consentAnalytics = tp.consent_analytics ?? null;
          }
        }
      }
    } catch { /* best-effort */ }

    const valueCzk = (Number(o.total || 0) / 100);
    const { error: insErr } = await sbc.from('marketing_conversions').insert({
      type: 'purchase',
      value: valueCzk,
      currency: 'CZK',
      order_id: o.id,
      anon_id: anonId,
      gclid,
      person_id: personId,
      consent_marketing: consentMarketing,
      consent_analytics: consentAnalytics,
      occurred_at: o.paid_at || o.created_at || new Date().toISOString(),
    });
    if (insErr) { errors.push(`${o.id}: ${insErr.message}`); continue; }
    inserted++;

    // GA4 Measurement Protocol (best-effort), jen se souhlasem s analytikou
    if (ga4Mid && ga4Secret && anonId && consentAnalytics === true) {
      try {
        const r = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(ga4Mid)}&api_secret=${encodeURIComponent(ga4Secret)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: anonId,
            events: [{ name: 'purchase', params: { transaction_id: o.order_number, value: valueCzk, currency: 'CZK' } }],
          }),
        });
        if (r.ok) {
          ga4Sent++;
          await sbc.from('marketing_conversions').update({ ga4_sent_at: new Date().toISOString() }).eq('order_id', o.id).eq('type', 'purchase');
        } else {
          const t = await r.text();
          await sbc.from('marketing_conversions').update({ ga4_error: t.slice(0, 300) }).eq('order_id', o.id).eq('type', 'purchase');
        }
      } catch (e: any) {
        await sbc.from('marketing_conversions').update({ ga4_error: String(e?.message || e).slice(0, 300) }).eq('order_id', o.id).eq('type', 'purchase');
      }
    }
  }

  run.inserted = inserted;
  run.ga4Sent = ga4Sent;
  run.ga4Configured = !!(ga4Mid && ga4Secret);
  run.errors = errors;
  run.ms = Date.now() - started;
  const runs = ((await kv.get('marketing:conversions:runs')) as any[]) || [];
  await kv.set('marketing:conversions:runs', [run, ...runs].slice(0, 30));
  return { ok: true, ...run };
}

export function registerMarketingConversionsRoutes(deps: { app: any; requireAdmin: (req: Request) => Promise<Response | unknown>; cronSecretOk: (c: any) => boolean }): void {
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
  both('post', '/cron/marketing-conversions', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await syncPurchaseConversions() }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });
  both('post', '/admin/marketing/conversions/sync', admin(async (c) => {
    return c.json({ ok: true, run: await syncPurchaseConversions() });
  }));
  both('get', '/admin/marketing/conversions', admin(async (c) => {
    const sbc = sb();
    const { data, error } = await sbc.from('marketing_conversions').select('*').order('occurred_at', { ascending: false }).limit(100);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ conversions: data || [] });
  }));

  /** Zdraví přenosu konverzí: co má atribuci, co čeká na souhlas, co se neodeslalo. */
  both('get', '/admin/marketing/conversion-health', admin(async (c) => {
    const sbc = sb();

    const { data: purchases } = await sbc
      .from('marketing_conversions')
      .select('gclid, anon_id, consent_marketing, consent_analytics, value, occurred_at')
      .eq('type', 'purchase');

    const purch = { total: 0, withGclid: 0, withAnon: 0, consentMarketing: 0, consentAnalytics: 0, revenueCzk: 0 };
    for (const p of purchases || []) {
      purch.total += 1;
      if (p.gclid) purch.withGclid += 1;
      if (p.anon_id) purch.withAnon += 1;
      if (p.consent_marketing === true) purch.consentMarketing += 1;
      if (p.consent_analytics === true) purch.consentAnalytics += 1;
      purch.revenueCzk += Number(p.value || 0);
    }

    const { data: offline } = await sbc
      .from('marketing_offline_conversions')
      .select('status, gclid, email_hash, consent_marketing, blocked_reason, conversion_value');

    const off = {
      byStatus: { pending: 0, uploaded: 0, failed: 0, skipped: 0 } as Record<string, number>,
      blockedByConsent: 0,
      withGclid: 0,
      withEmail: 0,
      valueCzk: 0,
    };
    for (const o of offline || []) {
      const s = String(o.status || 'pending');
      off.byStatus[s] = (off.byStatus[s] || 0) + 1;
      if (s === 'pending' && o.blocked_reason === 'consent_marketing') off.blockedByConsent += 1;
      if (o.gclid) off.withGclid += 1;
      if (o.email_hash) off.withEmail += 1;
      off.valueCzk += Number(o.conversion_value || 0);
    }

    const convRun: any = ((await kv.get('marketing:conversions:runs')) as any[] | null)?.[0] || null;
    const offRun: any = ((await kv.get('marketing:offline:runs')) as any[] | null)?.[0] || null;
    const snapshotRun: any = ((await kv.get('marketing:snapshot:runs')) as any[] | null)?.[0] || null;

    return c.json({
      purchases: purch,
      offline: off,
      uploadConfigured: Boolean(Deno.env.get('GOOGLE_ADS_CONVERSION_ACTION')?.trim()),
      runs: { conversions: convRun, offline: offRun, snapshot: snapshotRun },
    });
  }));

  both('get', '/admin/marketing/performance', admin(async (c) => {
    const sbc = sb();
    const days = Number(c.req.query('days') || 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // daily Google Ads metrics
    const { data: metrics } = await sbc.from('growth_metrics_daily')
      .select('date, campaign_id, impressions, clicks, cost_micros, conversions, conversion_value')
      .eq('level', 'campaign').gte('date', since);
    // ukázková data poznáme podle mock_* kampaní (Google Ads API není připojeno)
    const isMock = (metrics || []).some((r: any) => String(r.campaign_id || '').startsWith('mock_'));
    const dailyMap = new Map<string, any>();
    for (const r of metrics || []) {
      const d = String(r.date);
      const a = dailyMap.get(d) || { date: d, impressions: 0, clicks: 0, cost_micros: 0, conversions: 0, conversion_value: 0 };
      a.impressions += Number(r.impressions || 0);
      a.clicks += Number(r.clicks || 0);
      a.cost_micros += Number(r.cost_micros || 0);
      a.conversions += Number(r.conversions || 0);
      a.conversion_value += Number(r.conversion_value || 0);
      dailyMap.set(d, a);
    }

    // server-side purchase conversions
    const { data: convs } = await sbc.from('marketing_conversions')
      .select('occurred_at, value').eq('type', 'purchase').gte('occurred_at', since + 'T00:00:00Z');
    const purchMap = new Map<string, { purchases: number; revenue: number }>();
    for (const c2 of convs || []) {
      const d = String(c2.occurred_at).slice(0, 10);
      const a = purchMap.get(d) || { purchases: 0, revenue: 0 };
      a.purchases += 1;
      a.revenue += Number(c2.value || 0);
      purchMap.set(d, a);
    }

    // touchpoints
    const { count: tpCount } = await sbc.from('marketing_touchpoints').select('id', { count: 'exact', head: true }).gte('created_at', since + 'T00:00:00Z');

    // proposals
    const { data: props } = await sbc.from('growth_proposals').select('status');
    const propCounts: Record<string, number> = {};
    for (const p of props || []) propCounts[p.status] = (propCounts[p.status] || 0) + 1;

    // top search terms by cost
    const { data: st } = await sbc.from('growth_search_terms_daily')
      .select('search_term, cost_micros, clicks, conversions').gte('date', since);
    const stAgg = new Map<string, any>();
    for (const r of st || []) {
      const a = stAgg.get(r.search_term) || { term: r.search_term, cost_micros: 0, clicks: 0, conversions: 0 };
      a.cost_micros += Number(r.cost_micros || 0);
      a.clicks += Number(r.clicks || 0);
      a.conversions += Number(r.conversions || 0);
      stAgg.set(r.search_term, a);
    }
    const topTerms = [...stAgg.values()].sort((a, b) => b.cost_micros - a.cost_micros).slice(0, 15);

    // build daily array
    const allDates = new Set([...dailyMap.keys(), ...purchMap.keys()]);
    const daily = [...allDates].sort().map((d) => {
      const m = dailyMap.get(d) || { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0, conversion_value: 0 };
      const p = purchMap.get(d) || { purchases: 0, revenue: 0 };
      // v ukázkovém režimu dopočítáme nákupy z konverzí, aby funnel/ROAS nebyl nulový
      const purchases = isMock ? Math.max(0, Math.round(m.conversions * 0.75)) : p.purchases;
      const revenue = isMock ? Math.round(purchases * 450 * 100) / 100 : Math.round(p.revenue * 100) / 100;
      return {
        date: d,
        impressions: m.impressions,
        clicks: m.clicks,
        spend_czk: Math.round(m.cost_micros / 1_000_000 * 100) / 100,
        ga_conversions: m.conversions,
        purchases,
        revenue_czk: revenue,
      };
    });

    const totals = daily.reduce((a: any, d: any) => ({
      impressions: a.impressions + d.impressions,
      clicks: a.clicks + d.clicks,
      spend_czk: a.spend_czk + d.spend_czk,
      ga_conversions: a.ga_conversions + d.ga_conversions,
      purchases: a.purchases + d.purchases,
      revenue_czk: a.revenue_czk + d.revenue_czk,
    }), { impressions: 0, clicks: 0, spend_czk: 0, ga_conversions: 0, purchases: 0, revenue_czk: 0 });

    return c.json({
      days,
      mock: isMock,
      apiConfigured: !!gadsConfig(),
      totals: { ...totals, touchpoints: tpCount || 0, proposalCounts: propCounts },
      daily,
      topSearchTerms: topTerms.map((t) => ({ ...t, cost_czk: Math.round(t.cost_micros / 1_000_000 * 100) / 100 })),
    });
  }));
}
