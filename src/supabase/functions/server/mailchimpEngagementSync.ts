/**
 * Rychlý sync Mailchimp member_rating → subscribers.merge_fields._mc_member_rating.
 *
 * Plný activity-feed (open/click do email_events) je pomalý (1 API call / kontakt).
 * Member rating (1–5) Mailchimp počítá z engagementu a jde stáhnout při listování members.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

type Supabase = ReturnType<typeof createClient>;

type McMember = {
  id: string;
  email_address: string;
  member_rating?: number;
  last_changed?: string;
  stats?: { avg_open_rate?: number; avg_click_rate?: number };
};

function dcFromKey(apiKey: string): string {
  const i = apiKey.lastIndexOf('-');
  const dc = i >= 0 ? apiKey.slice(i + 1).trim() : '';
  if (!/^[a-z]+\d+$/i.test(dc)) throw new Error('MAILCHIMP klíč musí končit datacentrem (…-us19).');
  return dc;
}

async function mcFetch<T>(server: string, apiKey: string, path: string): Promise<T> {
  const res = await fetch(`https://${server}.api.mailchimp.com/3.0${path}`, {
    headers: {
      Authorization: `apikey ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Mailchimp ${res.status}: ${t.slice(0, 240)}`);
  }
  return res.json() as Promise<T>;
}

export type MailchimpEngagementSyncResult = {
  ok: true;
  listIdMc: string;
  scanned: number;
  updated: number;
  ratingHistogram: Record<string, number>;
  hasMore: boolean;
  nextOffset: number | null;
};

/**
 * Projdi stránku members a zapiš rating do merge_fields.
 * Body offset/limit — volitelně dávkově (Edge timeout).
 */
export async function runMailchimpEngagementRatingsSync(
  supabase: Supabase,
  opts: {
    apiKey: string;
    listIdMc: string;
    offset?: number;
    pageSize?: number;
    /** Max members to process this call (default 2000). */
    maxMembers?: number;
  },
): Promise<MailchimpEngagementSyncResult> {
  const server = dcFromKey(opts.apiKey);
  const listIdMc = opts.listIdMc.trim();
  const pageSize = Math.min(Math.max(opts.pageSize ?? 1000, 1), 1000);
  const maxMembers = Math.min(Math.max(opts.maxMembers ?? 2000, 1), 5000);
  let apiOffset = Math.max(opts.offset ?? 0, 0);
  let scanned = 0;
  let updated = 0;
  const ratingHistogram: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, none: 0 };
  let hasMore = false;
  let nextOffset: number | null = null;

  while (scanned < maxMembers) {
    const room = maxMembers - scanned;
    const count = Math.min(pageSize, room);
    const page = await mcFetch<{ members?: McMember[]; total_items?: number }>(
      server,
      opts.apiKey,
      `/lists/${listIdMc}/members?offset=${apiOffset}&count=${count}&status=subscribed`,
    );
    const members = page.members || [];
    if (members.length === 0) {
      hasMore = false;
      nextOffset = null;
      break;
    }

    const emails = members.map((m) => m.email_address.toLowerCase().trim()).filter(Boolean);
    const byEmail = new Map<string, { id: string; email: string; merge_fields: unknown }>();
    const EMAIL_CHUNK = 80; /* velké .in(email) přes PostgREST GET → Bad Request */
    for (let i = 0; i < emails.length; i += EMAIL_CHUNK) {
      const chunk = emails.slice(i, i + EMAIL_CHUNK);
      const { data: subs, error: subErr } = await supabase
        .from('subscribers')
        .select('id, email, merge_fields')
        .in('email', chunk);
      if (subErr) throw new Error(`subscribers by email: ${subErr.message}`);
      for (const s of subs || []) {
        byEmail.set(String(s.email).toLowerCase(), s as { id: string; email: string; merge_fields: unknown });
      }
    }

    for (const m of members) {
      scanned += 1;
      const email = m.email_address.toLowerCase().trim();
      const sub = byEmail.get(email);
      const rating = typeof m.member_rating === 'number' && m.member_rating >= 1 && m.member_rating <= 5
        ? Math.round(m.member_rating)
        : null;
      ratingHistogram[rating != null ? String(rating) : 'none'] += 1;
      if (!sub) continue;

      const prev = (sub.merge_fields && typeof sub.merge_fields === 'object'
        ? { ...(sub.merge_fields as Record<string, unknown>) }
        : {}) as Record<string, unknown>;
      const next = {
        ...prev,
        _mc_member_rating: rating,
        _mc_avg_open_rate: m.stats?.avg_open_rate ?? prev._mc_avg_open_rate ?? null,
        _mc_avg_click_rate: m.stats?.avg_click_rate ?? prev._mc_avg_click_rate ?? null,
        _mc_last_changed: m.last_changed || prev._mc_last_changed || null,
      };
      const same =
        prev._mc_member_rating === next._mc_member_rating
        && prev._mc_avg_open_rate === next._mc_avg_open_rate
        && prev._mc_avg_click_rate === next._mc_avg_click_rate
        && prev._mc_last_changed === next._mc_last_changed;
      if (same) continue;

      const { error: upErr } = await supabase
        .from('subscribers')
        .update({ merge_fields: next })
        .eq('id', sub.id);
      if (upErr) throw new Error(upErr.message);
      updated += 1;
    }

    apiOffset += members.length;
    if (members.length < count) {
      hasMore = false;
      nextOffset = null;
      break;
    }
    hasMore = true;
    nextOffset = apiOffset;
  }

  return {
    ok: true,
    listIdMc,
    scanned,
    updated,
    ratingHistogram,
    hasMore,
    nextOffset,
  };
}

/** Mapování Mailchimp member_rating (1–5) → engagement bucket. null = nepoužít. */
export function bucketFromMailchimpRating(rating: unknown): 'eng-hot' | 'eng-warm' | 'eng-cold' | 'eng-never' | null {
  const n = typeof rating === 'number' ? rating : Number(rating);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n >= 4) return 'eng-hot';
  if (n >= 3) return 'eng-warm';
  if (n >= 2) return 'eng-cold';
  return 'eng-never';
}
