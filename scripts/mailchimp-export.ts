/**
 * Mailchimp → Supabase (email marketing schema).
 *
 * Konfigurace (priorita: už nastavené process.env → .env → Supabase Management API):
 *
 * 1) Doporučeno — jeden token + ref projektu (načte Edge secrets z dashboardu a service role):
 *    SUPABASE_ACCESS_TOKEN=   (Personal Access Token, účet → Access Tokens; oprávnění secrets + API keys)
 *    SUPABASE_PROJECT_REF=    (volitelné — jinak se čte z src/utils/supabase/info.tsx)
 *
 * 2) Nebo klasicky v .env:
 *    MAILCHIMP_API_KEY=
 *    MAILCHIMP_SERVER_PREFIX=   (volitelné — z klíče …-us19)
 *    MAILCHIMP_LIST_ID | MAILCHIMP_AUDIENCE_NEWSLETTER
 *    SUPABASE_URL=
 *    SUPABASE_SERVICE_ROLE_KEY=
 *
 * Spuštění: npm run mailchimp-export
 *
 * Poznámky:
 * - Activity feed API vrací cca posledních 180 dní — importuje se, co přijde.
 * - Idempotentní: subscribers dle emailu, email_events dle dedupe_key, tagy/list M:N přepisované dávkově.
 * - PAT necommitovat; má přístup k tajemstvím projektu.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── env ─────────────────────────────────────────────────────────────────────

function loadDotEnv(cwd: string) {
  const p = resolve(cwd, '.env');
  if (!existsSync(p)) return;
  const raw = readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq < 1) continue;
    const k = s.slice(0, eq).trim();
    let v = s.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

/** projectId z autgenerovaného info.tsx (stejný ref jako v Supabase URL). */
function readProjectRefFromRepo(cwd: string): string | null {
  try {
    const p = resolve(cwd, 'src/utils/supabase/info.tsx');
    const raw = readFileSync(p, 'utf8');
    const m = raw.match(/projectId\s*=\s*["']([^"']+)["']/);
    return m?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

type ManagementSecretRow = { name: string; value?: string };

/** Načte Edge Function secrets + volitelně service_role z Management API (vyplní process.env). */
async function hydrateEnvFromSupabaseManagement(projectRef: string, accessToken: string) {
  const base = 'https://api.supabase.com/v1';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  console.log('Stahuji Edge secrets z Supabase Management API…');
  const secRes = await fetch(`${base}/projects/${encodeURIComponent(projectRef)}/secrets`, { headers });
  if (!secRes.ok) {
    const t = await secRes.text();
    throw new Error(
      `Supabase /secrets ${secRes.status}: ${t.slice(0, 400)}\n` +
        'Ověř SUPABASE_ACCESS_TOKEN (scope: edge_functions_secrets_read) a SUPABASE_PROJECT_REF.',
    );
  }
  const secrets = (await secRes.json()) as ManagementSecretRow[];
  if (!Array.isArray(secrets)) {
    throw new Error('Neočekávaná odpověď /secrets (není pole).');
  }
  let applied = 0;
  for (const row of secrets) {
    const name = row.name?.trim();
    const value = row.value?.trim();
    if (!name || !value) continue;
    if (process.env[name] === undefined) {
      process.env[name] = value;
      applied++;
    }
  }
  console.log(`Secrets: doplněno ${applied} proměnných (už nastavené v env se nepřepisují).`);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const keyRes = await fetch(
      `${base}/projects/${encodeURIComponent(projectRef)}/api-keys?reveal=true`,
      { headers },
    );
    if (keyRes.ok) {
      const keys = (await keyRes.json()) as Array<{ name?: string; type?: string; api_key?: string }>;
      if (Array.isArray(keys)) {
        const service = keys.find(k => {
          const n = `${k.name || ''} ${k.type || ''}`.toLowerCase();
          return n.includes('service') && k.api_key;
        });
        if (service?.api_key) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = service.api_key;
          console.log('Service role key načten z Management API (reveal).');
        }
      }
    } else {
      console.warn(
        'Service role: nepodařilo se načíst api-keys (volitelné). Nastav SUPABASE_SERVICE_ROLE_KEY ručně nebo ho přidej do Edge secrets.',
      );
    }
  }

  if (!process.env.SUPABASE_URL?.trim()) {
    process.env.SUPABASE_URL = `https://${projectRef}.supabase.co`;
    console.log(`SUPABASE_URL = ${process.env.SUPABASE_URL}`);
  }
}

function reqEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Chybí proměnná prostředí ${name}`);
  return v;
}

/** Datacentrum z klíče `…-us19` (stejné jako v Mailchimp dashboardu). */
function mailchimpDatacenterFromApiKey(apiKey: string): string {
  const i = apiKey.lastIndexOf('-');
  const dc = i >= 0 ? apiKey.slice(i + 1).trim() : '';
  if (!/^[a-z]+\d+$/i.test(dc)) {
    throw new Error(
      'Nastav MAILCHIMP_SERVER_PREFIX (např. us19), nebo použij API klíč ve tvaru …-us19.',
    );
  }
  return dc;
}

// ── Mailchimp HTTP ───────────────────────────────────────────────────────────

async function mcFetch<T>(server: string, apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const auth = Buffer.from(`anystring:${apiKey}`).toString('base64');
  const url = `https://${server}.api.mailchimp.com/3.0${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') || '5');
    console.warn(`Mailchimp 429, čekám ${retryAfter}s…`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return mcFetch<T>(server, apiKey, path, init);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailchimp ${res.status} ${path}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

type McMember = {
  id: string;
  email_address: string;
  unique_email_id?: string;
  status: string;
  merge_fields?: Record<string, string | number | boolean | null>;
  tags?: { id?: number; name: string }[];
  timestamp_opt?: string;
  timestamp_signup?: string;
};

type McMembersPage = {
  members: McMember[];
  total_items: number;
};

type McActivityItem = {
  action: string;
  timestamp: string;
  url?: string;
  campaign_id?: string;
  type?: string;
  [k: string]: unknown;
};

type McActivityFeed = {
  activity: McActivityItem[];
};

type McCampaign = {
  id: string;
  type?: string;
  status?: string;
  settings?: { title?: string; subject_line?: string; preview_text?: string };
  send_time?: string;
  archive_url?: string;
  recipients?: { list_id?: string };
};

type McCampaignsPage = {
  campaigns: McCampaign[];
  total_items: number;
};

// ── mapování ─────────────────────────────────────────────────────────────────

const CONTACT_TYPES = new Set(['teacher', 'school_admin', 'parent', 'homeschool', 'unknown']);

function mapMcStatus(s: string): 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending' {
  const x = (s || '').toLowerCase();
  if (x === 'subscribed' || x === 'transactional') return 'subscribed';
  if (x === 'unsubscribed') return 'unsubscribed';
  if (x === 'cleaned') return 'cleaned';
  if (x === 'pending') return 'pending';
  return 'subscribed';
}

function mergeStr(m: Record<string, string | number | boolean | null> | undefined, key: string): string | null {
  if (!m) return null;
  const v = m[key];
  if (v === null || v === undefined) return null;
  return String(v).trim() || null;
}

function inferContactType(merge: Record<string, string | number | boolean | null> | undefined): string {
  const raw =
    mergeStr(merge, 'CTYPE') ||
    mergeStr(merge, 'CONTACT') ||
    mergeStr(merge, 'ROLE') ||
    mergeStr(merge, 'MMERGE10');
  const t = (raw || '').toLowerCase();
  if (t.includes('teacher') || t.includes('učitel')) return 'teacher';
  if (t.includes('school') || t.includes('škola') || t.includes('admin')) return 'school_admin';
  if (t.includes('parent') || t.includes('rodič')) return 'parent';
  if (t.includes('home')) return 'homeschool';
  if (raw && CONTACT_TYPES.has(raw)) return raw;
  return 'unknown';
}

function mapActivityToEvent(action: string): 'send' | 'open' | 'click' | 'bounce' | 'complaint' | 'unsubscribe' | 'resubscribe' | null {
  const a = (action || '').toLowerCase();
  if (a === 'sent' || a === 'send') return 'send';
  if (a === 'open') return 'open';
  if (a === 'click') return 'click';
  if (a === 'bounce' || a === 'soft_bounce' || a === 'hard_bounce') return 'bounce';
  if (a === 'unsub' || a === 'unsubscribe') return 'unsubscribe';
  if (a === 'abuse' || a === 'spam') return 'complaint';
  if (a === 'sub' || a === 'resubscribe' || a === 'resub') return 'resubscribe';
  return null;
}

function slugTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .slice(0, 120) || 'tag';
}

// ── Supabase sync ────────────────────────────────────────────────────────────

const BATCH = 400;
const ACTIVITY_CONCURRENCY = 6;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function ensureList(
  supabase: SupabaseClient,
  mailchimpListId: string,
  listName?: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('lists')
    .upsert(
      {
        mailchimp_list_id: mailchimpListId,
        name: listName || null,
        meta: {},
      },
      { onConflict: 'mailchimp_list_id' },
    )
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

function memberToSubscriberRow(m: McMember, listIdMc: string) {
  const email = m.email_address.toLowerCase().trim();
  const mf = (m.merge_fields || {}) as Record<string, string | number | boolean | null>;
  const school = mergeStr(mf, 'SCHOOL') || mergeStr(mf, 'MMERGE5') || mergeStr(mf, 'SCHOOL_N');
  const ico = mergeStr(mf, 'ICO') || mergeStr(mf, 'MMERGE6') || mergeStr(mf, 'ICO_IC');
  const positionLabel = mergeStr(mf, 'SELECT');
  return {
    email,
    first_name: mergeStr(mf, 'FNAME'),
    last_name: mergeStr(mf, 'LNAME'),
    phone: mergeStr(mf, 'PHONE') || mergeStr(mf, 'MMERGE3'),
    contact_type: inferContactType(mf),
    position_label: positionLabel,
    source: 'mailchimp_import' as const,
    school_name: school,
    ico,
    status: mapMcStatus(m.status),
    merge_fields: mf as Record<string, unknown>,
    mc_member_id: m.id,
    mc_list_id: listIdMc,
    subscribed_at: m.timestamp_opt || m.timestamp_signup || null,
    unsubscribed_at: mapMcStatus(m.status) === 'unsubscribed' ? m.timestamp_opt || null : null,
  };
}

async function syncCampaigns(supabase: SupabaseClient, server: string, apiKey: string, listUuidByMcId: Map<string, string>) {
  let offset = 0;
  const count = 500;
  let imported = 0;
  for (;;) {
    const page = await mcFetch<McCampaignsPage>(server, apiKey, `/campaigns?offset=${offset}&count=${count}`);
    const chunk = page.campaigns || [];
    if (!chunk.length) break;
    const rows = chunk
      .filter(c => Boolean(c.id))
      .map(c => {
      const listMc = c.recipients?.list_id;
      return {
        mailchimp_campaign_id: c.id,
        list_id: listMc ? listUuidByMcId.get(listMc) || null : null,
        name: c.settings?.title || null,
        subject_line: c.settings?.subject_line || null,
        preview_text: c.settings?.preview_text || null,
        status: c.status || null,
        campaign_type: c.type || null,
        send_time: c.send_time || null,
        archive_url: c.archive_url || null,
        raw: c as unknown as Record<string, unknown>,
      };
    });
    if (rows.length) {
      const { error } = await supabase.from('campaigns').upsert(rows, {
        onConflict: 'mailchimp_campaign_id',
        ignoreDuplicates: false,
      });
      if (error) throw error;
      imported += rows.length;
    }
    offset += count;
    const totalHint = page.total_items != null ? ` / ${page.total_items}` : '';
    console.log(`Kampaně: offset ${offset}${totalHint}`);
    if (chunk.length < count) break;
  }
  console.log(`Kampaně hotovo: ${imported} řádků upsert.`);
}

async function resolveCampaignUuids(supabase: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, mailchimp_campaign_id')
      .not('mailchimp_campaign_id', 'is', null)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = data || [];
    for (const r of chunk) {
      if (r.mailchimp_campaign_id) map.set(r.mailchimp_campaign_id, r.id);
    }
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function getOrCreateLinkId(supabase: SupabaseClient, campaignUuid: string, url: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('email_links')
    .select('id')
    .eq('campaign_id', campaignUuid)
    .eq('url', url)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: ins, error } = await supabase.from('email_links').insert({ campaign_id: campaignUuid, url }).select('id').single();
  if (error) {
    const { data: again } = await supabase.from('email_links').select('id').eq('campaign_id', campaignUuid).eq('url', url).maybeSingle();
    return again?.id || null;
  }
  return ins?.id || null;
}

async function main() {
  const cwd = process.cwd();
  loadDotEnv(cwd);

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() || readProjectRefFromRepo(cwd) || '';

  if (accessToken) {
    if (!projectRef) {
      throw new Error(
        'SUPABASE_ACCESS_TOKEN je nastaven, ale chybí SUPABASE_PROJECT_REF a src/utils/supabase/info.tsx (projectId).',
      );
    }
    await hydrateEnvFromSupabaseManagement(projectRef, accessToken);
  } else if (!process.env.SUPABASE_URL?.trim() && projectRef) {
    process.env.SUPABASE_URL = `https://${projectRef}.supabase.co`;
  }

  const apiKey = reqEnv('MAILCHIMP_API_KEY');
  const server =
    process.env.MAILCHIMP_SERVER_PREFIX?.trim() || mailchimpDatacenterFromApiKey(apiKey);
  const listIdMc =
    process.env.MAILCHIMP_LIST_ID?.trim() ||
    process.env.MAILCHIMP_AUDIENCE_NEWSLETTER?.trim() ||
    process.env.MAILCHIMP_AUDIENCE_PRIMARY?.trim();
  if (!listIdMc) {
    throw new Error(
      'Chybí ID audience: nastav MAILCHIMP_LIST_ID nebo MAILCHIMP_AUDIENCE_NEWSLETTER (hodnota = Mailchimp list id).',
    );
  }
  const supabaseUrl = reqEnv('SUPABASE_URL');
  const serviceKey = reqEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log('Načítám metadata listu…');
  const listMeta = await mcFetch<{ name?: string }>(server, apiKey, `/lists/${listIdMc}`);
  const listUuid = await ensureList(supabase, listIdMc, listMeta.name);
  const listUuidByMcId = new Map<string, string>([[listIdMc, listUuid]]);
  const hashToSubscriberId = new Map<string, string>();

  console.log('Synchronizace členů (paginace)…');
  let offset = 0;
  const count = 1000;
  const allHashes: string[] = [];

  for (;;) {
    const page = await mcFetch<McMembersPage>(
      server,
      apiKey,
      `/lists/${listIdMc}/members?offset=${offset}&count=${count}&include_merge_fields=true`,
    );
    const members = page.members || [];
    if (!members.length) break;

    const rows = members.map(m => memberToSubscriberRow(m, listIdMc));
    const { data: upserted, error: upErr } = await supabase
      .from('subscribers')
      .upsert(rows, { onConflict: 'email' })
      .select('id,email');
    if (upErr) throw upErr;

    const emailToId = new Map((upserted || []).map(r => [r.email, r.id]));
    for (const m of members) {
      const sid = emailToId.get(m.email_address.toLowerCase().trim());
      if (sid) hashToSubscriberId.set(m.id, sid);
    }

    const tagSlugs = new Set<string>();
    const tagRows: { name: string; slug: string }[] = [];
    for (const m of members) {
      for (const t of m.tags || []) {
        const name = (t.name || '').trim();
        if (!name) continue;
        const slug = slugTag(name);
        if (tagSlugs.has(slug)) continue;
        tagSlugs.add(slug);
        tagRows.push({ name, slug });
      }
    }
    if (tagRows.length) {
      const { error: tErr } = await supabase.from('tags').upsert(tagRows, { onConflict: 'slug', ignoreDuplicates: false });
      if (tErr) throw tErr;
    }

    let slugToTagId = new Map<string, string>();
    if (tagSlugs.size > 0) {
      const { data: allTags } = await supabase.from('tags').select('id,slug').in('slug', [...tagSlugs]);
      slugToTagId = new Map((allTags || []).map(t => [t.slug, t.id]));
    }

    const subTagRows: { subscriber_id: string; tag_id: string; source: string }[] = [];
    for (const m of members) {
      const email = m.email_address.toLowerCase().trim();
      const sid = emailToId.get(email);
      if (!sid) continue;
      for (const t of m.tags || []) {
        const slug = slugTag((t.name || '').trim());
        const tid = slugToTagId.get(slug);
        if (tid) subTagRows.push({ subscriber_id: sid, tag_id: tid, source: 'mailchimp' });
      }
    }
    if (subTagRows.length) {
      const { error: stErr } = await supabase.from('subscriber_tags').upsert(subTagRows, {
        onConflict: 'subscriber_id,tag_id',
        ignoreDuplicates: false,
      });
      if (stErr) throw stErr;
    }

    const slRows = members
      .map(m => {
        const email = m.email_address.toLowerCase().trim();
        const sid = emailToId.get(email);
        if (!sid) return null;
        return {
          subscriber_id: sid,
          list_id: listUuid,
          mailchimp_unique_email_id: m.unique_email_id || null,
          status: mapMcStatus(m.status),
          subscribed_at: m.timestamp_opt || m.timestamp_signup || null,
          unsubscribed_at: mapMcStatus(m.status) === 'unsubscribed' ? m.timestamp_opt || null : null,
          raw: { mailchimp_member_id: m.id } as Record<string, unknown>,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    if (slRows.length) {
      const { error: slErr } = await supabase.from('subscriber_lists').upsert(slRows, {
        onConflict: 'subscriber_id,list_id',
      });
      if (slErr) throw slErr;
    }

    for (const m of members) allHashes.push(m.id);

    offset += count;
    const totalHint = page.total_items != null ? ` / ${page.total_items}` : '';
    console.log(`Členové: nahráno do offset ${offset}${totalHint}`);
    if (members.length < count) break;
  }

  console.log('Synchronizace kampaní…');
  await syncCampaigns(supabase, server, apiKey, listUuidByMcId);
  const campaignUuidByMc = await resolveCampaignUuids(supabase);

  console.log(`Stahuji activity feed (${allHashes.length} členů, concurrency ${ACTIVITY_CONCURRENCY})…`);
  let eventsInserted = 0;
  let activityErrors = 0;

  await mapLimit(allHashes, ACTIVITY_CONCURRENCY, async hash => {
    let feed: McActivityFeed;
    try {
      feed = await mcFetch<McActivityFeed>(server, apiKey, `/lists/${listIdMc}/members/${hash}/activity-feed`);
    } catch (e) {
      activityErrors++;
      console.warn(`Activity ${hash}:`, (e as Error).message);
      return;
    }
    const activities = feed.activity || [];
    if (!activities.length) return;

    const emailEvents: Record<string, unknown>[] = [];
    for (const a of activities) {
      const ev = mapActivityToEvent(a.action || (a.type as string) || '');
      if (!ev) continue;
      const ts = a.timestamp ? new Date(a.timestamp).toISOString() : new Date().toISOString();
      const mcCampRaw = a.campaign_id;
      const mcCamp =
        typeof mcCampRaw === 'string' ? mcCampRaw : mcCampRaw != null ? String(mcCampRaw) : null;
      const campUuid = mcCamp ? campaignUuidByMc.get(mcCamp) : null;
      const url = typeof a.url === 'string' ? a.url : null;

      let linkId: string | null = null;
      if (ev === 'click' && url && campUuid) {
        linkId = await getOrCreateLinkId(supabase, campUuid, url);
      }

      const dedupeKey = [
        'mc',
        listIdMc,
        hash,
        ev,
        ts,
        mcCamp || '-',
        url ? crypto.createHash('sha256').update(url).digest('hex').slice(0, 16) : '-',
      ].join(':');

      const subscriberId = hashToSubscriberId.get(hash) || null;
      emailEvents.push({
        event_type: ev,
        source: 'mailchimp',
        occurred_at: ts,
        campaign_id: campUuid,
        subscriber_id: subscriberId,
        link_id: linkId,
        ip_address: typeof a.ip === 'string' ? a.ip : null,
        user_agent: typeof a.user_agent === 'string' ? a.user_agent : null,
        provider_event_id: typeof a.activity_id === 'string' ? a.activity_id : null,
        dedupe_key: dedupeKey,
        metadata: a as Record<string, unknown>,
      });
    }

    for (let i = 0; i < emailEvents.length; i += BATCH) {
      const chunk = emailEvents.slice(i, i + BATCH);
      const { error } = await supabase.from('email_events').upsert(chunk, {
        onConflict: 'dedupe_key',
        ignoreDuplicates: false,
      });
      if (error) {
        console.warn('email_events batch:', error.message);
        activityErrors++;
      } else eventsInserted += chunk.length;
    }
  });

  console.log(`Hotovo. email_events upsert řádků (pokusů): ${eventsInserted}, chyb activity: ${activityErrors}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
