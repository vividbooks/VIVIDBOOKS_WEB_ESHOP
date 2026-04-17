/**
 * Heuristické skóre zájmu o předměty (Vividbooks slugy) z tagů, position_label a merge_fields.
 * Bez LLM — reprodukovatelné pravidla; klíčová slova doplň podle reálných tagů v MC.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

type Supabase = ReturnType<typeof createClient>;

/** Slugy odpovídající `src/data/subjectPages.ts` (aktivní předměty). */
export const SUBJECT_INTEREST_SLUGS = [
  'matematika',
  'fyzika',
  'chemie',
  'prirodopis',
  'prvouka',
  'cesky-jazyk',
] as const;

export type SubjectInterestSlug = (typeof SUBJECT_INTEREST_SLUGS)[number];

/** Nižší = slabší signál; tag často = vyšší váha než náhodné slovo v merge field. */
const WEIGHT_TAG = 2;
const WEIGHT_POSITION = 4;
const WEIGHT_MERGE = 1;

const KEYWORDS: Record<SubjectInterestSlug, string[]> = {
  matematika: [
    'matematika',
    'matematiky',
    'matematice',
    'mathematics',
    'math teacher',
    'maths teacher',
    ' učitel matematiky',
    'math ',
  ],
  fyzika: ['fyzika', 'fyziky', 'physics', 'physics teacher', ' učitel fyziky'],
  chemie: ['chemie', 'chemii', 'chemistry', 'chemistry teacher', ' učitel chemie', 'chemical'],
  prirodopis: [
    'přírodopis',
    'prirodopis',
    'přírodověda',
    'prirodoveda',
    'natural science',
    'biology teacher',
    ' učitel přírodopisu',
    'science teacher',
  ],
  prvouka: ['prvouka', 'prvouky', '1. stupeň', 'first grade teacher', 'primary teacher'],
  'cesky-jazyk': [
    'český jazyk',
    'cesky jazyk',
    'čeština',
    'cestina',
    'czech language',
    'czech teacher',
    ' učitel češtiny',
    ' učitel cestiny',
  ],
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function addScores(
  acc: Record<string, number>,
  haystack: string,
  weight: number,
): void {
  const h = norm(haystack);
  if (!h) return;
  for (const slug of SUBJECT_INTEREST_SLUGS) {
    for (const kw of KEYWORDS[slug]) {
      if (kw && h.includes(norm(kw))) {
        acc[slug] = (acc[slug] || 0) + weight;
        break;
      }
    }
  }
}

function mergeFieldsHaystack(mf: Record<string, unknown> | null | undefined): string {
  if (!mf || typeof mf !== 'object') return '';
  const parts: string[] = [];
  for (const v of Object.values(mf)) {
    if (v == null) continue;
    if (typeof v === 'string') parts.push(v);
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(String(v));
  }
  return parts.join(' | ');
}

export function computeSubjectInterestScores(input: {
  tagNames: string[];
  positionLabel: string | null | undefined;
  mergeFields: Record<string, unknown> | null | undefined;
}): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const name of input.tagNames) {
    if (name?.trim()) addScores(acc, name, WEIGHT_TAG);
  }
  if (input.positionLabel) addScores(acc, input.positionLabel, WEIGHT_POSITION);
  const mfText = mergeFieldsHaystack(input.mergeFields);
  if (mfText) addScores(acc, mfText, WEIGHT_MERGE);
  return acc;
}

export type SubjectRecomputeResult = {
  ok: true;
  limit: number;
  offset: number;
  processed: number;
  updated: number;
  /** Prvních pár řádků pro kontrolu v logu / odpovědi. */
  samples: { id: string; email: string; scores: Record<string, number> }[];
};

export async function runSubjectInterestRecompute(
  supabase: Supabase,
  opts: { limit: number; offset: number },
): Promise<SubjectRecomputeResult | { ok: false; error: string }> {
  const limit = Math.min(10_000, Math.max(1, Math.floor(opts.limit)));
  const offset = Math.max(0, Math.floor(opts.offset));

  const { data: subs, error: e1 } = await supabase
    .from('subscribers')
    .select('id, email, position_label, merge_fields')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (e1) return { ok: false, error: e1.message };
  const rows = subs || [];
  if (!rows.length) {
    return { ok: true, limit, offset, processed: 0, updated: 0, samples: [] };
  }

  const ids = rows.map((r: { id: string }) => r.id);

  /** Krátké dávky — `.in(subscriber_id, …)` na ~1000 UUID přeteče URL u PostgREST GET. */
  const IN_CHUNK = 120;
  const stRows: { subscriber_id: string; tag_id: string }[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const slice = ids.slice(i, i + IN_CHUNK);
    const { data: part, error: e2 } = await supabase
      .from('subscriber_tags')
      .select('subscriber_id, tag_id')
      .in('subscriber_id', slice);
    if (e2) return { ok: false, error: `subscriber_tags: ${e2.message}` };
    if (part?.length) stRows.push(...(part as { subscriber_id: string; tag_id: string }[]));
  }

  const tagIds = [...new Set(stRows.map((r: { tag_id: string }) => r.tag_id))];
  let tagNameById = new Map<string, string>();
  if (tagIds.length) {
    for (let i = 0; i < tagIds.length; i += IN_CHUNK) {
      const slice = tagIds.slice(i, i + IN_CHUNK);
      const { data: tags, error: e3 } = await supabase.from('tags').select('id, name').in('id', slice);
      if (e3) return { ok: false, error: `tags: ${e3.message}` };
      for (const t of tags || []) tagNameById.set((t as { id: string; name: string }).id, (t as { name: string }).name);
    }
  }

  const tagNamesBySub = new Map<string, string[]>();
  for (const r of stRows) {
    const sid = r.subscriber_id as string;
    const name = tagNameById.get(r.tag_id as string);
    if (!name) continue;
    if (!tagNamesBySub.has(sid)) tagNamesBySub.set(sid, []);
    tagNamesBySub.get(sid)!.push(name);
  }

  const updates: { id: string; email: string; scores: Record<string, number> }[] = [];
  for (const r of rows as {
    id: string;
    email: string;
    position_label: string | null;
    merge_fields: Record<string, unknown> | null;
  }[]) {
    const scores = computeSubjectInterestScores({
      tagNames: tagNamesBySub.get(r.id) || [],
      positionLabel: r.position_label,
      mergeFields: r.merge_fields,
    });
    updates.push({ id: r.id, email: r.email, scores });
  }

  let updated = 0;
  let firstUpdateError: string | null = null;
  const BATCH = 12;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await Promise.all(
      chunk.map(async u => {
        const { error } = await supabase.from('subscribers').update({ subject_interest_scores: u.scores }).eq('id', u.id);
        if (error) {
          if (!firstUpdateError) firstUpdateError = error.message;
          return;
        }
        updated++;
      }),
    );
  }
  if (firstUpdateError && updated === 0) {
    return { ok: false, error: `update subscribers: ${firstUpdateError}` };
  }

  const samples = updates
    .filter(u => Object.keys(u.scores).length > 0)
    .slice(0, 8)
    .map(u => ({ id: u.id, email: u.email, scores: u.scores }));

  return {
    ok: true,
    limit,
    offset,
    processed: updates.length,
    updated,
    samples,
  };
}
