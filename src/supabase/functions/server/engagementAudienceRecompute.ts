/**
 * Rozřazení kontaktů do engagement audience (tagy) podle reálné aktivity.
 *
 * Záměrně bez LLM — open/click/recency je deterministické a levnější než AI.
 * Každý `subscribed` kontakt dostane právě jeden z tagů eng-* (mutually exclusive).
 *
 * Buckety:
 * - eng-hot   — open/click za posledních 30 dní
 * - eng-warm  — open/click za 31–90 dní
 * - eng-cold  — měl aktivitu někdy, ale > 90 dní
 * - eng-never — nikdy neotevřel / neklikl (nebo chybí data)
 * - eng-new   — přihlášen ≤ 14 dní a zatím bez aktivity (podmnožina „nových“)
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const ENGAGEMENT_TAG_DEFS = [
  { slug: 'eng-hot', name: 'Eng · Aktivní (30 dní)' },
  { slug: 'eng-warm', name: 'Eng · Teplý (90 dní)' },
  { slug: 'eng-cold', name: 'Eng · Chladný (>90 dní)' },
  { slug: 'eng-never', name: 'Eng · Bez aktivity' },
  { slug: 'eng-new', name: 'Eng · Nový (14 dní)' },
] as const;

export type EngagementBucket = (typeof ENGAGEMENT_TAG_DEFS)[number]['slug'];

const MS_DAY = 86_400_000;

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
  const joinedRaw = input.subscribedAt || input.createdAt;
  const joined = joinedRaw ? Date.parse(joinedRaw) : NaN;
  if (Number.isFinite(joined) && (now - joined) / MS_DAY <= 14) return 'eng-new';
  return 'eng-never';
}

/** Heuristika skóre 0–100 z recency (doplní sloupec engagement_score). */
export function scoreFromRecency(bucket: EngagementBucket, lastActivityMs: number | null, nowMs = Date.now()): number {
  if (bucket === 'eng-hot' && lastActivityMs != null) {
    const days = (nowMs - lastActivityMs) / MS_DAY;
    return Math.max(55, Math.min(100, Math.round(100 - days * 1.5)));
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

export type EngagementRecomputeResult = {
  ok: true;
  limit: number;
  offset: number;
  processed: number;
  updatedTags: number;
  updatedScores: number;
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
    .select('id, last_opened_at, last_clicked_at, subscribed_at, created_at, engagement_score')
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
  const ID_IN_CHUNK = 120; /* PostgREST GET .in() na 1000 UUID často → Bad Request */

  /* Aktuální eng-* tagy u dávky — ať neměníme, když bucket sedí. */
  const ids = list.map((r) => r.id as string);
  const currentEng = new Map<string, string>(); /* subscriber_id → tag_id */
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

  for (const row of list) {
    const id = row.id as string;
    const bucket = classifyEngagementBucket({
      lastOpenedAt: (row.last_opened_at as string | null) ?? null,
      lastClickedAt: (row.last_clicked_at as string | null) ?? null,
      subscribedAt: (row.subscribed_at as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
      nowMs: now,
    });
    counts[bucket] += 1;
    const wantTagId = tagByBucket.get(bucket)!;
    const activityMs = latestActivityMs(
      (row.last_opened_at as string | null) ?? null,
      (row.last_clicked_at as string | null) ?? null,
    );
    const score = scoreFromRecency(bucket, activityMs, now);
    if ((row.engagement_score as number) !== score) {
      scoreUpdates.push({ id, engagement_score: score });
    }

    const have = currentEng.get(id);
    if (have === wantTagId) continue;
    toAdd.push({ subscriber_id: id, tag_id: wantTagId, source: 'system' });
  }

  /* Smazat staré eng-* u změněných kontaktů, pak přiřadit nový bucket. */
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
    counts,
  };
}
