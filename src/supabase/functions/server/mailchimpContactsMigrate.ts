/**
 * Mailchimp → Postgres (subscribers, lists, tags, campaigns, volitelně email_events).
 * Běží v Edge (Deno) se secrets z Deno.env.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

export type MailchimpResumeCursor = {
  /** Offset Mailchimp API GET …/members?offset= */
  offset: number;
  /** Přeskoč prvních N záznamů v aktuální stránce (po přerušení uprostřed stránky). */
  skipInPage: number;
};

export type MailchimpMigrateOptions = {
  mailchimpApiKey: string;
  /** Datacentrum (us19). Když chybí, odvodí se z klíče …-us19. */
  mailchimpServer?: string;
  listIdMc: string;
  /** Activity feed = N× HTTP na člena; na velké audience může překročit limit Edge. */
  includeActivity?: boolean;
  /** Omezí počet synchronizovaných členů (např. 10 pro rychlý test). */
  maxMembers?: number;
  /** Max. počet členů v tomto jednom běhu (postupný import); další dávka přes resumeFrom. */
  membersPerRun?: number;
  /** Pokračování po předchozí dávce (z pole nextResume v odpovědi). */
  resumeFrom?: MailchimpResumeCursor;
};

export type MailchimpMigrateResult = {
  ok: boolean;
  error?: string;
  membersSynced?: number;
  campaignsUpserted?: number;
  emailEventsUpserted?: number;
  activityErrors?: number;
  warning?: string;
  /** Nastavený strop počtu kontaktů (testovací import). */
  limitedToMaxMembers?: number;
  /** total_items z první stránky GET …/members — pro diagnostiku při membersSynced === 0. */
  mailchimpMembersApiTotalItems?: number;
  /** Jsou v Mailchimpu ještě členi k načtení? */
  membersImportHasMore?: boolean;
  /** Další dávka: pošli v těle jako resumeFrom. */
  nextResume?: MailchimpResumeCursor;
};

type Supabase = ReturnType<typeof createClient>;

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

type McMembersPage = { members?: McMember[]; total_items?: number };

type McActivityItem = {
  action: string;
  timestamp: string;
  url?: string;
  campaign_id?: string;
  type?: string;
  ip?: string;
  user_agent?: string;
  activity_id?: string;
  [k: string]: unknown;
};

type McActivityFeed = { activity: McActivityItem[] };

type McCampaign = {
  id: string;
  type?: string;
  status?: string;
  settings?: { title?: string; subject_line?: string; preview_text?: string };
  send_time?: string;
  archive_url?: string;
  recipients?: { list_id?: string };
};

type McCampaignsPage = { campaigns: McCampaign[]; total_items?: number };

const BATCH = 400;
const ACTIVITY_CONCURRENCY = 6;
const MEMBER_PAGE = 1000;

function mailchimpDatacenterFromApiKey(apiKey: string): string {
  const i = apiKey.lastIndexOf('-');
  const dc = i >= 0 ? apiKey.slice(i + 1).trim() : '';
  if (!/^[a-z]+\d+$/i.test(dc)) {
    throw new Error('MAILCHIMP_SERVER_PREFIX nebo klíč ve tvaru …-us19.');
  }
  return dc;
}

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

function mapActivityToEvent(
  action: string,
): 'send' | 'open' | 'click' | 'bounce' | 'complaint' | 'unsubscribe' | 'resubscribe' | null {
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

export function slugTag(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '')
      .slice(0, 120) || 'tag'
  );
}

/** Jedna UPSERT dávka nesmí obsahovat stejný conflict klíč 2× (Postgres 21000). */
function dedupeByLast<T>(items: T[], key: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(key(item), item);
  return [...map.values()];
}

async function mcFetch<T>(server: string, apiKey: string, path: string, init?: RequestInit): Promise<T> {
  // Edge/Deno: nepoužívat Node Buffer — Basic auth je ASCII, stačí btoa.
  const auth = btoa(`anystring:${apiKey}`);
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
    console.log(`[mailchimp-migrate] 429, čekám ${retryAfter}s`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return mcFetch<T>(server, apiKey, path, init);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailchimp ${res.status} ${path}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let i = 0;
  async function worker() {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker));
}

async function ensureList(
  supabase: Supabase,
  mailchimpListId: string,
  listName?: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('lists')
    .upsert(
      { mailchimp_list_id: mailchimpListId, name: listName || null, meta: {} },
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

async function syncCampaigns(
  supabase: Supabase,
  server: string,
  apiKey: string,
  listUuidByMcId: Map<string, string>,
): Promise<number> {
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
      const unique = dedupeByLast(rows, r => r.mailchimp_campaign_id as string);
      const { error } = await supabase
        .from('campaigns')
        .upsert(unique, { onConflict: 'mailchimp_campaign_id' });
      if (error) throw error;
      imported += unique.length;
    }
    offset += count;
    if (chunk.length < count) break;
  }
  return imported;
}

async function resolveCampaignUuids(supabase: Supabase): Promise<Map<string, string>> {
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

async function getOrCreateLinkId(supabase: Supabase, campaignUuid: string, url: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('email_links')
    .select('id')
    .eq('campaign_id', campaignUuid)
    .eq('url', url)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: ins, error } = await supabase
    .from('email_links')
    .insert({ campaign_id: campaignUuid, url })
    .select('id')
    .single();
  if (error) {
    const { data: again } = await supabase
      .from('email_links')
      .select('id')
      .eq('campaign_id', campaignUuid)
      .eq('url', url)
      .maybeSingle();
    return again?.id || null;
  }
  return ins?.id || null;
}

export async function runMailchimpContactsMigrate(
  supabase: Supabase,
  opts: MailchimpMigrateOptions,
): Promise<MailchimpMigrateResult> {
  const apiKey = opts.mailchimpApiKey.trim();
  const listIdMc = opts.listIdMc.trim();
  const server = (opts.mailchimpServer || '').trim() || mailchimpDatacenterFromApiKey(apiKey);
  const includeActivity = opts.includeActivity === true;
  const maxMembers =
    typeof opts.maxMembers === 'number' && Number.isFinite(opts.maxMembers) && opts.maxMembers >= 1
      ? Math.min(Math.floor(opts.maxMembers), 50_000)
      : undefined;

  const membersPerRun =
    typeof opts.membersPerRun === 'number' && Number.isFinite(opts.membersPerRun) && opts.membersPerRun >= 1
      ? Math.min(Math.floor(opts.membersPerRun), 10_000)
      : undefined;

  let apiOffset =
    typeof opts.resumeFrom?.offset === 'number' && opts.resumeFrom.offset >= 0
      ? Math.floor(opts.resumeFrom.offset)
      : 0;
  let skipInPage =
    typeof opts.resumeFrom?.skipInPage === 'number' && opts.resumeFrom.skipInPage >= 0
      ? Math.floor(opts.resumeFrom.skipInPage)
      : 0;

  let membersSynced = 0;
  let campaignsUpserted = 0;
  let emailEventsUpserted = 0;
  let activityErrors = 0;

  const listMeta = await mcFetch<{ name?: string }>(server, apiKey, `/lists/${listIdMc}`);
  const listUuid = await ensureList(supabase, listIdMc, listMeta.name);
  const listUuidByMcId = new Map<string, string>([[listIdMc, listUuid]]);
  const hashToSubscriberId = new Map<string, string>();
  const allHashes: string[] = [];

  let membersApiTotalItems: number | undefined;
  let nextResume: MailchimpResumeCursor | undefined;

  const computeNextResume = (
    rawLen: number,
    curOffset: number,
    curSkip: number,
  ): MailchimpResumeCursor | undefined => {
    if (curSkip < rawLen) return { offset: curOffset, skipInPage: curSkip };
    if (rawLen < MEMBER_PAGE) return undefined;
    return { offset: curOffset + MEMBER_PAGE, skipInPage: 0 };
  };

  while (true) {
    const page = await mcFetch<McMembersPage>(
      server,
      apiKey,
      `/lists/${listIdMc}/members?offset=${apiOffset}&count=${MEMBER_PAGE}&include_merge_fields=true`,
    );
    if (membersApiTotalItems === undefined && typeof page.total_items === 'number') {
      membersApiTotalItems = page.total_items;
    }
    const raw = page.members || [];

    if (raw.length === 0) {
      nextResume = undefined;
      break;
    }

    if (skipInPage >= raw.length) {
      if (raw.length < MEMBER_PAGE) {
        nextResume = undefined;
        break;
      }
      apiOffset += MEMBER_PAGE;
      skipInPage = 0;
      continue;
    }

    let work = raw.slice(skipInPage);

    if (maxMembers != null) {
      const room = maxMembers - membersSynced;
      if (room <= 0) {
        nextResume = computeNextResume(raw.length, apiOffset, skipInPage);
        break;
      }
      if (work.length > room) work = work.slice(0, room);
    }

    let stoppedForBatch = false;
    if (membersPerRun != null) {
      const room = membersPerRun - membersSynced;
      if (room <= 0) {
        nextResume = computeNextResume(raw.length, apiOffset, skipInPage);
        break;
      }
      if (work.length > room) {
        work = work.slice(0, room);
        stoppedForBatch = true;
      }
    }

    if (!work.length) break;

    const members = work;

    const rows = dedupeByLast(
      members.map(m => memberToSubscriberRow(m, listIdMc)),
      r => r.email as string,
    );
    const { data: upserted, error: upErr } = await supabase
      .from('subscribers')
      .upsert(rows, { onConflict: 'email' })
      .select('id,email');
    if (upErr) {
      const msg = upErr.message || String(upErr);
      if (/relation|does not exist|subscribers/i.test(msg)) {
        return {
          ok: false,
          error:
            'Tabulky email marketingu neexistují. Aplikuj migraci 20260415140000_email_marketing_core.sql v Supabase.',
        };
      }
      return { ok: false, error: msg };
    }

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
      const { error: tErr } = await supabase.from('tags').upsert(tagRows, { onConflict: 'slug' });
      if (tErr) return { ok: false, error: tErr.message };
    }

    let slugToTagId = new Map<string, string>();
    if (tagSlugs.size > 0) {
      const { data: allTags } = await supabase.from('tags').select('id,slug').in('slug', [...tagSlugs]);
      slugToTagId = new Map((allTags || []).map(t => [t.slug, t.id]));
    }

    const subTagRows: { subscriber_id: string; tag_id: string; source: string }[] = [];
    const subTagSeen = new Set<string>();
    for (const m of members) {
      const email = m.email_address.toLowerCase().trim();
      const sid = emailToId.get(email);
      if (!sid) continue;
      for (const t of m.tags || []) {
        const slug = slugTag((t.name || '').trim());
        const tid = slugToTagId.get(slug);
        if (!tid) continue;
        const pair = `${sid}\0${tid}`;
        if (subTagSeen.has(pair)) continue;
        subTagSeen.add(pair);
        subTagRows.push({ subscriber_id: sid, tag_id: tid, source: 'mailchimp' });
      }
    }
    if (subTagRows.length) {
      const { error: stErr } = await supabase.from('subscriber_tags').upsert(subTagRows, {
        onConflict: 'subscriber_id,tag_id',
      });
      if (stErr) return { ok: false, error: stErr.message };
    }

    const slRowsRaw = members
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
    const slRows = dedupeByLast(slRowsRaw, r => `${(r as { subscriber_id: string }).subscriber_id}\0${listUuid}`);

    if (slRows.length) {
      const { error: slErr } = await supabase.from('subscriber_lists').upsert(slRows, {
        onConflict: 'subscriber_id,list_id',
      });
      if (slErr) return { ok: false, error: slErr.message };
    }

    for (const m of members) allHashes.push(m.id);
    membersSynced += members.length;
    skipInPage += members.length;

    const hitMaxSample = maxMembers != null && membersSynced >= maxMembers;
    const hitBatchLimit = membersPerRun != null && membersSynced >= membersPerRun;

    if (hitMaxSample || hitBatchLimit || stoppedForBatch) {
      nextResume = computeNextResume(raw.length, apiOffset, skipInPage);
      break;
    }

    if (skipInPage >= raw.length) {
      if (raw.length < MEMBER_PAGE) {
        nextResume = undefined;
        break;
      }
      apiOffset += MEMBER_PAGE;
      skipInPage = 0;
    }
  }

  /** Jen dávkový import (membersPerRun): kampaně/aktivita až po poslední dávce. Test maxMembers=10 kampaně stále synchronizuje. */
  const holdCampaignsForLaterBatch = nextResume != undefined && membersPerRun != null;

  if (!holdCampaignsForLaterBatch) {
    campaignsUpserted = await syncCampaigns(supabase, server, apiKey, listUuidByMcId);
  }

  if (includeActivity && allHashes.length > 0 && !holdCampaignsForLaterBatch) {
    const campaignUuidByMc = await resolveCampaignUuids(supabase);
    await mapLimit(allHashes, ACTIVITY_CONCURRENCY, async hash => {
      let feed: McActivityFeed;
      try {
        feed = await mcFetch<McActivityFeed>(server, apiKey, `/lists/${listIdMc}/members/${hash}/activity-feed`);
      } catch (e) {
        activityErrors++;
        console.warn(`[mailchimp-migrate] activity ${hash}:`, (e as Error).message);
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

        const urlPart = url ? createHash('sha256').update(url).digest('hex').slice(0, 16) : '-';
        const dedupeKey = ['mc', listIdMc, hash, ev, ts, mcCamp || '-', urlPart].join(':');
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
        const chunk = dedupeByLast(
          emailEvents.slice(i, i + BATCH),
          r => String((r as { dedupe_key?: string }).dedupe_key ?? ''),
        );
        const { error } = await supabase.from('email_events').upsert(chunk, { onConflict: 'dedupe_key' });
        if (error) {
          console.warn('[mailchimp-migrate] email_events:', error.message);
          activityErrors++;
        } else emailEventsUpserted += chunk.length;
      }
    });
  }

  const zeroMismatch =
    membersSynced === 0 && membersApiTotalItems != null && membersApiTotalItems > 0
      ? `Mailchimp hlásí u tohoto listu total_items=${membersApiTotalItems}, ale nepodařilo se naimportovat žádný záznam — zkontroluj list ID a oprávnění klíče.`
      : null;
  const limitNote =
    maxMembers != null
      ? `Import byl omezen na prvních ${maxMembers} kontaktů (test). Celý list spusť bez limitu.`
      : null;
  const batchNote = holdCampaignsForLaterBatch
    ? `Tato dávka skončila dřív — v odpovědi je nextResume. Další požadavek pošli se stejným audience a stejným membersPerRun a tělem { "resumeFrom": nextResume, "membersPerRun": … }. Kampaně a aktivita se doplní až po poslední dávce (kdy membersImportHasMore bude false).`
    : null;
  const warning =
    !includeActivity && allHashes.length > 0
      ? [zeroMismatch, limitNote, batchNote, 'Aktivita (opens/clicks) nebyla importována. Zapni „včetně aktivity“ nebo použij lokální skript pro dlouhý běh.']
          .filter(Boolean)
          .join(' ')
      : includeActivity && allHashes.length > 2000
        ? [zeroMismatch, limitNote, batchNote, 'Velký počet kontaktů: aktivita může trvat dlouho nebo narazit na limit Edge funkce.']
            .filter(Boolean)
            .join(' ')
        : [zeroMismatch, limitNote, batchNote].filter(Boolean).join(' ') || undefined;

  const membersImportHasMore = nextResume != undefined;

  return {
    ok: true,
    membersSynced,
    campaignsUpserted,
    emailEventsUpserted,
    activityErrors,
    warning,
    ...(membersImportHasMore ? { membersImportHasMore: true, nextResume } : {}),
    ...(maxMembers != null ? { limitedToMaxMembers: maxMembers } : {}),
    ...(membersApiTotalItems != null ? { mailchimpMembersApiTotalItems: membersApiTotalItems } : {}),
  };
}
