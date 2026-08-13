/**
 * Rozřazení kontaktů do engagement audience (tagy) podle reálné aktivity.
 *
 * Zdroj pravdy: email_events (Mailchimp import + Resend pixel/webhook) přes RPC
 * mailing_subscriber_last_activity — NE jen sloupce last_opened_at na subscribers
 * (ty po MC importu často zůstaly prázdné).
 *
 * Buckety (mutually exclusive):
 * - eng-hot   — open/click ≤ 30 dní
 * - eng-warm  — 31–90 dní
 * - eng-cold  — měl aktivitu, ale > 90 dní
 * - eng-never — nikdy neotevřel / neklikl
 * - eng-new   — přihlášen ≤ 14 dní a zatím bez aktivity
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { bucketFromMailchimpRating } from './mailchimpEngagementSync.ts';

export const ENGAGEMENT_TAG_DEFS = [
  { slug: 'eng-hot', name: 'Eng · Aktivní (30 dní)' },
  { slug: 'eng-warm', name: 'Eng · Teplý (90 dní)' },
  { slug: 'eng-cold', name: 'Eng · Chladný (>90 dní)' },
  { slug: 'eng-never', name: 'Eng · Bez aktivity' },
  { slug: 'eng-new', name: 'Eng · Nový (14 dní)' },
] as const;

export type EngagementBucket = (typeof ENGAGEMENT_TAG_DEFS)[number]['slug'];

const MS_DAY = 86_400_000;
const ID_IN_CHUNK = 120;

function latestActivityMs(lastOpened: string | null, lastClicked: string | null): number | null {
  const times = [lastOpened, lastClicked]
    .filter(Boolean)
    .map((iso) => Date.parse(String(iso)))
    .filter((n) => Number.isFinite(n));
  if (times.length === 0) return null;
  return Math.max(...times);
}

export function classifyEngagementBucket(input: {
  lastOpenedAt: string | null;
  lastClickedAt: string | null;
  subscribedAt: string | null;
  createdAt: string | null;
  /** Mailchimp member_rating 1–5 (z merge_fields._mc_member_rating) — fallback když chybí open/click. */
  mailchimpRating?: unknown;
  nowMs?: number;
}): EngagementBucket {
  const now = input.nowMs ?? Date.now();
  const activity = latestActivityMs(input.lastOpenedAt, input.lastClickedAt);
  if (activity != null) {
    const ageDays = (now - activity) / MS_DAY;
    if (ageDays <= 30) return 'eng-hot';
    if (ageDays <= 90) return 'eng-warm';
    return 'eng-cold';
  }
  const fromRating = bucketFromMailchimpRating(input.mailchimpRating);
  if (fromRating) return fromRating;
  const joinedRaw = input.subscribedAt || input.createdAt;
  const joined = joinedRaw ? Date.parse(joinedRaw) : NaN;
  if (Number.isFinite(joined) && (now - joined) / MS_DAY <= 14) return 'eng-new';
  return 'eng-never';
}

export function scoreFromRecency(bucket: EngagementBucket, lastActivityMs: number | null, nowMs = Date.now()): number {
  if (bucket === 'eng-hot') {
    if (lastActivityMs != null) {
      const days = (nowMs - lastActivityMs) / MS_DAY;
      return Math.max(55, Math.min(100, Math.round(100 - days * 1.5)));
    }
    return 70; /* Mailchimp rating 4–5 bez přesného data open */
  }
  if (bucket === 'eng-warm') return 35;
  if (bucket === 'eng-cold') return 10;
  if (bucket === 'eng-new') return 5;
  return 0;
}

async function ensureEngagementTags(supabase: SupabaseClient): Promise<Map<EngagementBucket, string>> {
  const map = new Map<EngagementBucket, string>();
  for (const def of ENGAGEMENT_TAG_DEFS) {
    const { data: existing, error: selErr } = await supabase
      .from('tags')
      .select('id, slug')
      .eq('slug', def.slug)
      .maybeSingle();
    if (selErr) throw new Error(`tags select ${def.slug}: ${selErr.message}`);
    if (existing?.id) {
      map.set(def.slug, existing.id as string);
      continue;
    }
    const { data: inserted, error: insErr } = await supabase
      .from('tags')
      .insert({ name: def.name, slug: def.slug })
      .select('id, slug')
      .single();
    if (insErr) throw new Error(`tags insert ${def.slug}: ${insErr.message}`);
    map.set(def.slug, inserted.id as string);
  }
  return map;
}

/** last open/click z email_events (+ fallback sloupce) — RPC; při chybě ruční agregace. */
async function loadLastActivity(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { lastOpenedAt: string | null; lastClickedAt: string | null }>> {
  const out = new Map<string, { lastOpenedAt: string | null; lastClickedAt: string | null }>();
  if (ids.length === 0) return out;

  for (let i = 0; i < ids.length; i += ID_IN_CHUNK) {
    const chunk = ids.slice(i, i + ID_IN_CHUNK);
    const { data, error } = await supabase.rpc('mailing_subscriber_last_activity', {
      p_ids: chunk,
    });
    if (!error && data) {
      for (const r of data as {
        subscriber_id: string;
        last_opened_at: string | null;
        last_clicked_at: string | null;
      }[]) {
        out.set(r.subscriber_id, {
          lastOpenedAt: r.last_opened_at,
          lastClickedAt: r.last_clicked_at,
        });
      }
      continue;
    }

    /* Fallback bez RPC — max z email_events v JS. */
    if (error) {
      console.warn('[engagement] RPC mailing_subscriber_last_activity:', error.message);
    }
    const { data: evs, error: evErr } = await supabase
      .from('email_events')
      .select('subscriber_id, event_type, occurred_at')
      .in('subscriber_id', chunk)
      .in('event_type', ['open', 'click'])
      .order('occurred_at', { ascending: false })
      .limit(8000);
    if (evErr) throw new Error(`email_events: ${evErr.message}`);
    for (const id of chunk) {
      if (!out.has(id)) out.set(id, { lastOpenedAt: null, lastClickedAt: null });
    }
    for (const e of evs || []) {
      const sid = e.subscriber_id as string;
      if (!sid) continue;
      const cur = out.get(sid) || { lastOpenedAt: null, lastClickedAt: null };
      const ts = (e.occurred_at as string) || null;
      if (!ts) continue;
      if (e.event_type === 'open' && !cur.lastOpenedAt) cur.lastOpenedAt = ts;
      if (e.event_type === 'click' && !cur.lastClickedAt) cur.lastClickedAt = ts;
      out.set(sid, cur);
    }
  }
  return out;
}

export type EngagementRecomputeResult = {
  ok: true;
  limit: number;
  offset: number;
  processed: number;
  updatedTags: number;
  updatedScores: number;
  backfilledTimestamps: number;
  withActivity: number;
  fromMailchimpRating: number;
  counts: Record<EngagementBucket, number>;
};

export async function runEngagementAudienceRecompute(
  supabase: SupabaseClient,
  opts?: { limit?: number; offset?: number },
): Promise<EngagementRecomputeResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 2000);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const tagByBucket = await ensureEngagementTags(supabase);
  const allEngTagIds = [...tagByBucket.values()];

  const { data: rows, error } = await supabase
    .from('subscribers')
    .select('id, last_opened_at, last_clicked_at, subscribed_at, created_at, engagement_score, merge_fields')
    .eq('status', 'subscribed')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const list = rows || [];
  const counts: Record<EngagementBucket, number> = {
    'eng-hot': 0,
    'eng-warm': 0,
    'eng-cold': 0,
    'eng-never': 0,
    'eng-new': 0,
  };
  const now = Date.now();
  let updatedTags = 0;
  let updatedScores = 0;
  let backfilledTimestamps = 0;
  let withActivity = 0;
  let fromMailchimpRating = 0;

  const ids = list.map((r) => r.id as string);
  const activityById = await loadLastActivity(supabase, ids);

  const currentEng = new Map<string, string>();
  for (let i = 0; i < ids.length; i += ID_IN_CHUNK) {
    const chunk = ids.slice(i, i + ID_IN_CHUNK);
    const { data: st, error: stErr } = await supabase
      .from('subscriber_tags')
      .select('subscriber_id, tag_id')
      .in('subscriber_id', chunk)
      .in('tag_id', allEngTagIds);
    if (stErr) throw new Error(`subscriber_tags select: ${stErr.message}`);
    for (const r of st || []) {
      currentEng.set(r.subscriber_id as string, r.tag_id as string);
    }
  }

  const toAdd: { subscriber_id: string; tag_id: string; source: 'system' }[] = [];
  const scoreUpdates: { id: string; engagement_score: number }[] = [];
  const stampUpdates: { id: string; last_opened_at: string | null; last_clicked_at: string | null }[] = [];

  for (const row of list) {
    const id = row.id as string;
    const fromEvents = activityById.get(id);
    const lastOpenedAt =
      fromEvents?.lastOpenedAt
      ?? (row.last_opened_at as string | null)
      ?? null;
    const lastClickedAt =
      fromEvents?.lastClickedAt
      ?? (row.last_clicked_at as string | null)
      ?? null;

    if (lastOpenedAt || lastClickedAt) withActivity += 1;

    /* Backfill sloupců, ať Audience UI i další filtry vidí stejnou pravdu. */
    const colOpen = (row.last_opened_at as string | null) ?? null;
    const colClick = (row.last_clicked_at as string | null) ?? null;
    if (
      (lastOpenedAt && lastOpenedAt !== colOpen)
      || (lastClickedAt && lastClickedAt !== colClick)
    ) {
      stampUpdates.push({
        id,
        last_opened_at: lastOpenedAt || colOpen,
        last_clicked_at: lastClickedAt || colClick,
      });
    }

    const mf = (row.merge_fields && typeof row.merge_fields === 'object')
      ? (row.merge_fields as Record<string, unknown>)
      : {};
    const mcRating = mf._mc_member_rating;
    const hadOpenClick = Boolean(lastOpenedAt || lastClickedAt);
    if (!hadOpenClick && bucketFromMailchimpRating(mcRating)) fromMailchimpRating += 1;

    const bucket = classifyEngagementBucket({
      lastOpenedAt,
      lastClickedAt,
      subscribedAt: (row.subscribed_at as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
      mailchimpRating: mcRating,
      nowMs: now,
    });
    counts[bucket] += 1;
    const wantTagId = tagByBucket.get(bucket)!;
    const activityMs = latestActivityMs(lastOpenedAt, lastClickedAt);
    const score = scoreFromRecency(bucket, activityMs, now);
    if ((row.engagement_score as number) !== score) {
      scoreUpdates.push({ id, engagement_score: score });
    }

    const have = currentEng.get(id);
    if (have === wantTagId) continue;
    toAdd.push({ subscriber_id: id, tag_id: wantTagId, source: 'system' });
  }

  const changedIds = [...new Set(toAdd.map((r) => r.subscriber_id))];
  for (let i = 0; i < changedIds.length; i += ID_IN_CHUNK) {
    const chunk = changedIds.slice(i, i + ID_IN_CHUNK);
    const { error: delErr } = await supabase
      .from('subscriber_tags')
      .delete()
      .in('subscriber_id', chunk)
      .in('tag_id', allEngTagIds);
    if (delErr) throw new Error(`subscriber_tags delete: ${delErr.message}`);
  }

  for (let i = 0; i < toAdd.length; i += 200) {
    const chunk = toAdd.slice(i, i + 200);
    const { data: inserted, error: insErr } = await supabase
      .from('subscriber_tags')
      .upsert(chunk, { onConflict: 'subscriber_id,tag_id', ignoreDuplicates: true })
      .select('subscriber_id');
    if (insErr) throw new Error(`subscriber_tags upsert: ${insErr.message}`);
    updatedTags += (inserted || []).length;
  }

  for (const u of stampUpdates) {
    const { error: upErr } = await supabase
      .from('subscribers')
      .update({
        last_opened_at: u.last_opened_at,
        last_clicked_at: u.last_clicked_at,
      })
      .eq('id', u.id);
    if (upErr) throw new Error(`timestamp backfill: ${upErr.message}`);
    backfilledTimestamps += 1;
  }

  for (const u of scoreUpdates) {
    const { error: upErr } = await supabase
      .from('subscribers')
      .update({ engagement_score: u.engagement_score })
      .eq('id', u.id);
    if (upErr) throw new Error(`score update: ${upErr.message}`);
    updatedScores += 1;
  }

  return {
    ok: true,
    limit,
    offset,
    processed: list.length,
    updatedTags,
    updatedScores,
    backfilledTimestamps,
    withActivity,
    fromMailchimpRating,
    counts,
  };
}
