/**
 * Audience filtr pro kampaně i „uložit jako tag“.
 *
 * Pravidla (všechny vrstvy se protínají — AND):
 * - status subscribed (výchozí; u save-as-tag lze vypnout)
 * - includeTagIds: alespoň jeden tag (OR)
 * - excludeTagIds: žádný z těchto tagů
 * - sources: subscriber.source IN (…)
 * - positionLabels: position_label IN (…)
 * - subjectInterestSlugs: RPC subscriber_ids_by_subject_interests (OR mezi slugy)
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type AudienceFilter = {
  includeTagIds?: string[];
  excludeTagIds?: string[];
  sources?: string[];
  subjectInterestSlugs?: string[];
  positionLabels?: string[];
  /** Default true — kampaně nikdy neposílají unsubscribed/cleaned/pending. */
  subscribedOnly?: boolean;
};

const PAGE = 1000;
const ID_CHUNK = 200;

const ALLOWED_SOURCES = new Set([
  'newsletter',
  'trial',
  'webinar',
  'checkout',
  'mailchimp_import',
  'manual',
  'other',
]);

function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((x) => String(x || '').trim()).filter(Boolean))];
}

function asSlugList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean))];
}

function asSourceList(raw: unknown): string[] {
  return asIdList(raw).filter((s) => ALLOWED_SOURCES.has(s));
}

export function normalizeAudienceFilter(raw: unknown): AudienceFilter {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: AudienceFilter = {
    includeTagIds: asIdList(o.includeTagIds),
    excludeTagIds: asIdList(o.excludeTagIds),
    sources: asSourceList(o.sources),
    subjectInterestSlugs: asSlugList(o.subjectInterestSlugs),
    positionLabels: asIdList(o.positionLabels),
  };
  if (typeof o.subscribedOnly === 'boolean') out.subscribedOnly = o.subscribedOnly;
  return out;
}

/** True, když filtr nic neomezuje kromě (volitelně) statusu subscribed. */
export function isAudienceFilterEmpty(filter: AudienceFilter): boolean {
  return (
    (filter.includeTagIds?.length || 0) === 0 &&
    (filter.excludeTagIds?.length || 0) === 0 &&
    (filter.sources?.length || 0) === 0 &&
    (filter.subjectInterestSlugs?.length || 0) === 0 &&
    (filter.positionLabels?.length || 0) === 0
  );
}

async function subscriberIdsByTags(supabase: SupabaseClient, tagIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (tagIds.length === 0) return out;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('subscriber_tags')
      .select('subscriber_id')
      .in('tag_id', tagIds)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data || []) out.add(r.subscriber_id as string);
    if ((data || []).length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function subscriberIdsBySubjectInterests(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const { data, error } = await supabase.rpc('subscriber_ids_by_subject_interests', {
    p_slugs: slugs,
  });
  if (error) throw new Error(error.message);
  return new Set((data || []) as string[]);
}

function intersectNullable(a: Set<string> | null, b: Set<string> | null): Set<string> | null {
  if (a === null) return b;
  if (b === null) return a;
  const out = new Set<string>();
  for (const id of a) {
    if (b.has(id)) out.add(id);
  }
  return out;
}

/**
 * Vyhodnotí filtr → seznam subscriber id.
 * Při include-tag / subject množině nejdřív zúží ID a pak dofiltruje sloupce (rychlejší než full scan).
 */
export async function resolveAudienceSubscriberIds(
  supabase: SupabaseClient,
  rawFilter: unknown,
): Promise<string[]> {
  const filter = normalizeAudienceFilter(rawFilter);
  const subscribedOnly = filter.subscribedOnly !== false;
  const includeTagIds = filter.includeTagIds || [];
  const excludeTagIds = filter.excludeTagIds || [];
  const sources = filter.sources || [];
  const subjects = filter.subjectInterestSlugs || [];
  const positions = filter.positionLabels || [];

  let seed: Set<string> | null = null;
  if (includeTagIds.length > 0) {
    seed = await subscriberIdsByTags(supabase, includeTagIds);
  }
  if (subjects.length > 0) {
    seed = intersectNullable(seed, await subscriberIdsBySubjectInterests(supabase, subjects));
  }

  const excluded = excludeTagIds.length > 0
    ? await subscriberIdsByTags(supabase, excludeTagIds)
    : new Set<string>();

  const targetIds: string[] = [];

  const matchesRow = (id: string): boolean => {
    if (excluded.has(id)) return false;
    return true;
  };

  if (seed !== null) {
    const ids = [...seed];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const chunk = ids.slice(i, i + ID_CHUNK);
      let q = supabase.from('subscribers').select('id').in('id', chunk);
      if (subscribedOnly) q = q.eq('status', 'subscribed');
      if (sources.length > 0) q = q.in('source', sources);
      if (positions.length > 0) q = q.in('position_label', positions);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      for (const r of data || []) {
        const id = r.id as string;
        if (matchesRow(id)) targetIds.push(id);
      }
    }
    return targetIds;
  }

  let offset = 0;
  for (;;) {
    let q = supabase.from('subscribers').select('id');
    if (subscribedOnly) q = q.eq('status', 'subscribed');
    if (sources.length > 0) q = q.in('source', sources);
    if (positions.length > 0) q = q.in('position_label', positions);
    const { data, error } = await q.range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data || []) {
      const id = r.id as string;
      if (matchesRow(id)) targetIds.push(id);
    }
    if ((data || []).length < PAGE) break;
    offset += PAGE;
  }
  return targetIds;
}
