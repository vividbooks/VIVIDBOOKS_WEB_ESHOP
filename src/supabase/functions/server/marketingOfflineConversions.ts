/**
 * Offline konverze: pull konverzí z Ultra + upload do Google Ads přes Data Manager API.
 * Vyžaduje GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_CONVERSION_ACTION (UPLOAD_CLICKS resource),
 * GOOGLE_ADS_* OAuth a GOOGLE_ADS_LOGIN_CUSTOMER_ID (volitelně).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './growthKv.ts';

function sb() {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !key) throw new Error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

const ULTRA_BASE = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/public/marketing/conversions';
const KEY_RUNS = 'marketing:offline:runs';

function secret(): string {
  return (Deno.env.get('MARKETING_SNAPSHOT_SECRET') || Deno.env.get('IDENTITY_UPSERT_SECRET') || '').trim();
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function accessToken(): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')?.trim();
  const refreshToken = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN')?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return null;
  return j.access_token;
}

export async function syncOfflineConversions(): Promise<Record<string, unknown>> {
  const sbc = sb();
  const s = secret();
  if (!s) throw new Error('Chybí MARKETING_SNAPSHOT_SECRET / IDENTITY_UPSERT_SECRET.');
  const customerId = (Deno.env.get('GOOGLE_ADS_CUSTOMER_ID') || '').replace(/\D/g, '');
  const conversionAction = Deno.env.get('GOOGLE_ADS_CONVERSION_ACTION')?.trim();
  const started = Date.now();
  const run: Record<string, unknown> = { at: new Date().toISOString() };

  // 1) pull conversions from Ultra (last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // Autorizace jen přes X-Marketing-Secret; Bearer musí být anon klíč Ultra,
  // protože gateway jinak vrátí "Missing bearer token".
  const ultraAnon = (Deno.env.get('ULTRA_ANON_KEY') || '').trim();
  const r = await fetch(ULTRA_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Marketing-Secret': s,
      ...(ultraAnon ? { Authorization: `Bearer ${ultraAnon}` } : {}),
    },
    body: JSON.stringify({ since, limit: 500 }),
  });
  const text = await r.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { /* ignore */ }
  if (!r.ok) throw new Error(`Ultra conversions ${r.status}: ${j?.error || text.slice(0, 200)}`);
  const events: any[] = j?.events || [];

  // 2) dedupe against existing. Dřív přeskočené řádky zkusíme znovu — e-mail se
  //    může doplnit z kódu školy nebo z registru škol.
  const { data: existing } = await sbc.from('marketing_offline_conversions').select('external_id, status');
  const existingByExternal = new Map((existing || []).map((x: any) => [x.external_id, String(x.status || '')]));

  const pending: any[] = [];
  for (const e of events) {
    const previousStatus = existingByExternal.get(e.license_id);
    if (previousStatus && previousStatus !== 'skipped') continue;
    const emailHash = e.email ? await sha256Hex(normEmail(e.email)) : null;
    const hasIdentifier = Boolean(emailHash || e.gclid);
    /** Bez výslovného souhlasu s marketingem se e-mail do Google Ads neposílá. */
    const consentMarketing = e.consent_marketing === true ? true : (e.consent_marketing === false ? false : null);
    const row = {
      source: 'ultra_license',
      external_id: e.license_id,
      email_hash: emailHash,
      gclid: e.gclid || null,
      conversion_action: conversionAction || null,
      conversion_value: e.value_czk || 0,
      currency: 'CZK',
      occurred_at: e.occurred_at,
      consent_marketing: consentMarketing,
      status: hasIdentifier ? 'pending' : 'skipped',
      error: hasIdentifier ? null : 'no identifier (gclid/email)',
      blocked_reason: !hasIdentifier
        ? 'no identifier'
        : (consentMarketing === true ? null : 'consent_marketing'),
    };
    if (previousStatus === 'skipped') {
      if (row.status !== 'pending') continue;
      const { error: updErr } = await sbc
        .from('marketing_offline_conversions')
        .update({
          email_hash: row.email_hash,
          gclid: row.gclid,
          conversion_action: row.conversion_action,
          consent_marketing: row.consent_marketing,
          status: 'pending',
          error: null,
          blocked_reason: row.blocked_reason,
        })
        .eq('external_id', e.license_id);
      if (updErr) { run.updateError = updErr.message; continue; }
      if (row.blocked_reason === null) pending.push({ ...row, email: e.email });
      continue;
    }
    const { error: insErr } = await sbc.from('marketing_offline_conversions').insert(row);
    if (insErr && !insErr.message.includes('duplicate')) {
      run.insertError = insErr.message;
    } else if (row.blocked_reason === null) {
      pending.push({ ...row, email: e.email });
    }
  }
  run.pulled = events.length;
  run.newPending = pending.length;
  const { count: blocked } = await sbc
    .from('marketing_offline_conversions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('blocked_reason', 'consent_marketing');
  run.blockedByConsent = blocked ?? 0;

  // 3) upload to Data Manager API if configured
  if (conversionAction && customerId && pending.length) {
    const token = await accessToken();
    if (!token) {
      run.uploadSkipped = 'no OAuth token (check GOOGLE_ADS_* secrets + datamanager scope)';
    } else {
      const ingestEvents = pending.map((p: any) => {
        const ev: any = {
          eventTimestamp: new Date(p.occurred_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          conversionValue: p.conversion_value || undefined,
          currency: 'CZK',
        };
        if (p.gclid) ev.adIdentifiers = { gclid: p.gclid };
        if (p.email_hash) ev.userData = { hashedEmail: p.email_hash };
        return ev;
      });
      const payload = {
        destinations: [{ destination: 'GOOGLE_ADS', customerId, conversionAction }],
        events: ingestEvents,
      };
      try {
        const res = await fetch('https://datamanager.googleapis.com/v1/events:ingest', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const t = await res.text();
        let j2: any = {};
        try { j2 = JSON.parse(t); } catch { /* ignore */ }
        if (res.ok) {
          run.uploaded = pending.length;
          await sbc.from('marketing_offline_conversions')
            .update({ status: 'uploaded', uploaded_at: new Date().toISOString(), response: j2 })
            .in('external_id', pending.map((p: any) => p.external_id));
        } else {
          run.uploadError = `${res.status}: ${t.slice(0, 300)}`;
          await sbc.from('marketing_offline_conversions')
            .update({ status: 'failed', error: `${res.status}: ${t.slice(0, 300)}` })
            .in('external_id', pending.map((p: any) => p.external_id));
        }
      } catch (e: any) {
        run.uploadError = String(e?.message || e);
      }
    }
  } else if (!conversionAction) {
    run.note = 'Nastavte GOOGLE_ADS_CONVERSION_ACTION (UPLOAD_CLICKS resource) pro upload.';
  }

  run.ms = Date.now() - started;
  const runs = ((await kv.get(KEY_RUNS)) as any[]) || [];
  await kv.set(KEY_RUNS, [run, ...runs].slice(0, 30));
  return { ok: true, ...run };
}

export function registerMarketingOfflineConversionsRoutes(deps: { app: any; requireAdmin: (req: Request) => Promise<Response | unknown>; cronSecretOk: (c: any) => boolean }): void {
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
  both('post', '/cron/marketing-offline-conversions', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'unauthorized' }, 401);
    try { return c.json({ ok: true, run: await syncOfflineConversions() }); }
    catch (e: any) { return c.json({ error: e?.message || String(e) }, 500); }
  });
  both('post', '/admin/marketing/offline-conversions/sync', admin(async (c) => {
    return c.json({ ok: true, run: await syncOfflineConversions() });
  }));
  both('get', '/admin/marketing/offline-conversions', admin(async (c) => {
    const sbc = sb();
    const { data, error } = await sbc.from('marketing_offline_conversions').select('*').order('occurred_at', { ascending: false }).limit(100);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ conversions: data || [] });
  }));
}
