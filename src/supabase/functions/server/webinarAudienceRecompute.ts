/**
 * Rozřazení kontaktů podle webinářových / MC tagů do typových audience (Web · …).
 * Na rozdílku od Eng · nejsou buckety exclusive — učitel matematiky na 1. stupni má oba tagy.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  classifyContactFromTagNames,
  WEBINAR_AUDIENCE_DEFS,
  type WebinarAudienceSlug,
} from '../../../lib/webinarAudienceClassify.ts';

const ID_IN_CHUNK = 120;

export type WebinarAudienceRecomputeResult = {
  ok: true;
  limit: number;
  offset: number;
  processed: number;
  updatedTags: number;
  withWebinar: number;
  counts: Record<WebinarAudienceSlug, number>;
};

async function ensureWebinarAudienceTags(
  supabase: SupabaseClient,
): Promise<Map<WebinarAudienceSlug, string>> {
  const map = new Map<WebinarAudienceSlug, string>();
  for (const def of WEBINAR_AUDIENCE_DEFS) {
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

export async function runWebinarAudienceRecompute(
  supabase: SupabaseClient,
  opts?: { limit?: number; offset?: number },
): Promise<WebinarAudienceRecomputeResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 2000);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const tagByBucket = await ensureWebinarAudienceTags(supabase);
  const allWbTagIds = [...tagByBucket.values()];
  const wbIdSet = new Set(allWbTagIds);

  const { data: rows, error } = await supabase
    .from('subscribers')
    .select('id')
    .eq('status', 'subscribed')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);

  const list = rows || [];
  const counts = Object.fromEntries(
    WEBINAR_AUDIENCE_DEFS.map((d) => [d.slug, 0]),
  ) as Record<WebinarAudienceSlug, number>;
  let updatedTags = 0;
  let withWebinar = 0;
  if (list.length === 0) {
    return { ok: true, limit, offset, processed: 0, updatedTags: 0, withWebinar: 0, counts };
  }

  const ids = list.map((r) => r.id as string);

  const stRows: { subscriber_id: string; tag_id: string }[] = [];
  for (let i = 0; i < ids.length; i += ID_IN_CHUNK) {
    const chunk = ids.slice(i, i + ID_IN_CHUNK);
    const { data: part, error: stErr } = await supabase
      .from('subscriber_tags')
      .select('subscriber_id, tag_id')
      .in('subscriber_id', chunk);
    if (stErr) throw new Error(`subscriber_tags: ${stErr.message}`);
    if (part?.length) stRows.push(...(part as { subscriber_id: string; tag_id: string }[]));
  }

  const tagIds = [...new Set(stRows.map((r) => r.tag_id))];
  const tagNameById = new Map<string, string>();
  for (let i = 0; i < tagIds.length; i += ID_IN_CHUNK) {
    const slice = tagIds.slice(i, i + ID_IN_CHUNK);
    const { data: tags, error: tErr } = await supabase.from('tags').select('id, name, slug').in('id', slice);
    if (tErr) throw new Error(`tags: ${tErr.message}`);
    for (const t of tags || []) {
      const slug = String((t as { slug?: string }).slug || '');
      if (slug.startsWith('wb-') || slug.startsWith('eng-')) continue;
      tagNameById.set((t as { id: string }).id, (t as { name: string }).name);
    }
  }

  const namesBySub = new Map<string, string[]>();
  const currentWb = new Map<string, Set<string>>();
  for (const id of ids) {
    namesBySub.set(id, []);
    currentWb.set(id, new Set());
  }
  for (const r of stRows) {
    const sid = r.subscriber_id;
    if (wbIdSet.has(r.tag_id)) {
      currentWb.get(sid)?.add(r.tag_id);
      continue;
    }
    const name = tagNameById.get(r.tag_id);
    if (name) namesBySub.get(sid)?.push(name);
  }

  const toAdd: { subscriber_id: string; tag_id: string; source: 'system' }[] = [];
  const changedIds: string[] = [];

  for (const id of ids) {
    const buckets = classifyContactFromTagNames(namesBySub.get(id) || []);
    if (buckets.includes('wb-webinar')) withWebinar += 1;
    for (const b of buckets) counts[b] += 1;

    const want = new Set(buckets.map((b) => tagByBucket.get(b)!));
    const have = currentWb.get(id) || new Set();
    const same = want.size === have.size && [...want].every((tid) => have.has(tid));
    if (same) continue;
    changedIds.push(id);
    for (const tid of want) {
      toAdd.push({ subscriber_id: id, tag_id: tid, source: 'system' });
    }
  }

  for (let i = 0; i < changedIds.length; i += ID_IN_CHUNK) {
    const chunk = changedIds.slice(i, i + ID_IN_CHUNK);
    const { error: delErr } = await supabase
      .from('subscriber_tags')
      .delete()
      .in('subscriber_id', chunk)
      .in('tag_id', allWbTagIds);
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

  return {
    ok: true,
    limit,
    offset,
    processed: list.length,
    updatedTags,
    withWebinar,
    counts,
  };
}
