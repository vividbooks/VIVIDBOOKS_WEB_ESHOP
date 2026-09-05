/**
 * DVPP zdarma — katalog knihovny („Netflix“ řádky).
 *
 * Záznamy dál žijí v KV (`vividbooks_dvpp_videos_v2` + minulé webináře), tady se z nich skládají
 * řádky pro přihlášeného: Pokračovat ve sledování · Doporučeno pro vás · Řady · Nejsledovanější ·
 * Podle tématu. Řady jsou v KV `vividbooks_dvpp_series_v1` (editace v adminu).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as kv from '../kv_store.tsx';
import { resolveAccessLevel, STARTER_RECORDINGS_LIMIT, type AccessLevel } from './milestones.ts';
import { getStaffroom } from './staffroom.ts';
import type { SubscriberRow } from './shared.ts';

export const SERIES_KEY = 'vividbooks_dvpp_series_v1';

export type CatalogVideo = {
  id: string;
  name: string;
  slug: string;
  thumbnail: string;
  youtubeUrl: string;
  topicIds: string[];
  description: string;
  durationMinutes?: number;
  lecturer?: string;
  subjects?: string[];
  trailerUrl?: string;
  /** Doplní server podle přístupu. */
  locked?: boolean;
  progress?: { position: number; duration: number | null; completed: boolean; updatedAt: string } | null;
  certificate?: { number: string; issuedAt: string } | null;
  plays30d?: number;
};

export type Series = {
  id: string;
  title: string;
  description: string;
  subjects: string[];
  videoIds: string[];
  hours: number;
  cover?: string;
  order?: number;
};

export type CatalogRow = { key: string; title: string; subtitle?: string; videos: CatalogVideo[] };

export async function getSeries(): Promise<Series[]> {
  const data = (await kv.get(SERIES_KEY)) as { series?: Series[] } | null;
  const list = Array.isArray(data?.series) ? data!.series! : [];
  return list
    .filter((s) => s && s.id && Array.isArray(s.videoIds))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function saveSeries(series: Series[]): Promise<void> {
  await kv.set(SERIES_KEY, { series, updatedAt: new Date().toISOString() });
}

const TOPIC_TO_SUBJECT: Record<string, string> = {
  fyzika: 'fyzika', matematika: 'matematika', chemie: 'chemie', prirodopis: 'prirodopis',
  prvouka: 'prvouka', 'cesky-jazyk': 'cesky-jazyk', cestina: 'cesky-jazyk',
};

function subjectsOfVideo(v: CatalogVideo, topicSlugById: Map<string, string>): string[] {
  const out = new Set<string>();
  for (const t of v.topicIds || []) {
    const slug = topicSlugById.get(t) || t;
    const s = TOPIC_TO_SUBJECT[String(slug).toLowerCase()];
    if (s) out.add(s);
  }
  for (const s of v.subjects || []) out.add(s);
  return Array.from(out);
}

export type AccessInfo = {
  level: AccessLevel;
  starterUsed: number;
  starterLimit: number;
  reason: 'guest' | 'customer' | 'staffroom' | 'referral' | 'personal' | 'starter';
  staffroomStatus: string | null;
};

export async function resolveAccess(sb: SupabaseClient, subscriber: SubscriberRow | null): Promise<AccessInfo> {
  if (!subscriber) return { level: 'guest', starterUsed: 0, starterLimit: STARTER_RECORDINGS_LIMIT, reason: 'guest', staffroomStatus: null };
  const sr = subscriber.school_red_izo ? await getStaffroom(sb, subscriber.school_red_izo) : null;
  const [{ count: referred }, { count: started }] = await Promise.all([
    sb.from('staffroom_members').select('subscriber_id', { count: 'exact', head: true }).eq('invited_by', subscriber.id).not('activated_at', 'is', null),
    sb.from('dvpp_progress').select('video_id', { count: 'exact', head: true }).eq('subscriber_id', subscriber.id),
  ]);
  const personalUntil = (subscriber.dvpp_profile?.personal_access_until as string | undefined) || null;
  const level = resolveAccessLevel({
    loggedIn: true,
    staffroomStatus: sr?.status ?? null,
    referredConfirmed: referred || 0,
    isCustomer: !!subscriber.is_customer,
    personalAccessUntil: personalUntil,
    now: new Date(),
  });
  const reason: AccessInfo['reason'] = subscriber.is_customer ? 'customer'
    : sr && (sr.status === 'unlocked' || sr.status === 'grace') ? 'staffroom'
    : (referred || 0) >= 1 ? 'referral'
    : level === 'full' ? 'personal' : 'starter';
  return { level, starterUsed: started || 0, starterLimit: STARTER_RECORDINGS_LIMIT, reason, staffroomStatus: sr?.status ?? null };
}

/** Sestaví řádky katalogu. `videos`/`topics` přijdou z existujícího GET /dvpp-videos. */
export async function buildCatalog(
  sb: SupabaseClient,
  input: {
    videos: CatalogVideo[];
    topics: Array<{ id: string; name: string; slug: string; order?: number }>;
    subscriber: SubscriberRow | null;
    access: AccessInfo;
  },
): Promise<{ rows: CatalogRow[]; series: Series[]; topics: typeof input.topics; access: AccessInfo; videos: CatalogVideo[] }> {
  const { videos, topics, subscriber, access } = input;
  const topicSlugById = new Map(topics.map((t) => [t.id, t.slug]));
  const byId = new Map(videos.map((v) => [v.id, v]));

  /* Progress + certifikáty přihlášeného. */
  let progress = new Map<string, NonNullable<CatalogVideo['progress']>>();
  let certs = new Map<string, NonNullable<CatalogVideo['certificate']>>();
  if (subscriber) {
    const [{ data: pr }, { data: ce }] = await Promise.all([
      sb.from('dvpp_progress').select('video_id, position_seconds, duration_seconds, completed, updated_at').eq('subscriber_id', subscriber.id),
      sb.from('certificates').select('video_id, webinar_id, number, issued_at').eq('subscriber_id', subscriber.id),
    ]);
    for (const p of (pr || []) as Array<{ video_id: string; position_seconds: number; duration_seconds: number | null; completed: boolean; updated_at: string }>) {
      progress.set(p.video_id, { position: p.position_seconds, duration: p.duration_seconds, completed: p.completed, updatedAt: p.updated_at });
    }
    for (const c of (ce || []) as Array<{ video_id: string | null; webinar_id: string | null; number: string; issued_at: string }>) {
      const key = c.video_id || c.webinar_id;
      if (key) certs.set(key, { number: c.number, issuedAt: c.issued_at });
    }
  }

  /* Nejsledovanější za 30 dní (z progressu všech). */
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: plays } = await sb.from('dvpp_progress').select('video_id').gte('updated_at', since).limit(20000);
  const playCount = new Map<string, number>();
  for (const p of (plays || []) as Array<{ video_id: string }>) playCount.set(p.video_id, (playCount.get(p.video_id) || 0) + 1);

  const startedIds = new Set(progress.keys());
  const decorated: CatalogVideo[] = videos.map((v) => {
    const pr = progress.get(v.id) || null;
    const locked = access.level === 'guest'
      ? true
      : access.level === 'full'
        ? false
        : !(startedIds.has(v.id) || startedIds.size < access.starterLimit);
    return {
      ...v,
      subjects: subjectsOfVideo(v, topicSlugById),
      locked,
      progress: pr,
      certificate: certs.get(v.id) || null,
      plays30d: playCount.get(v.id) || 0,
    };
  });
  const dbyId = new Map(decorated.map((v) => [v.id, v]));

  const rows: CatalogRow[] = [];

  const cont = decorated
    .filter((v) => v.progress && !v.progress.completed && !v.certificate)
    .sort((a, b) => Date.parse(b.progress!.updatedAt) - Date.parse(a.progress!.updatedAt))
    .slice(0, 12);
  if (cont.length) rows.push({ key: 'continue', title: 'Pokračovat ve sledování', subtitle: 'Rozkoukané záznamy a certifikáty k dokončení', videos: cont });

  /* Doporučeno: podle předmětů z profilu + skóre zájmu z chování. */
  const profSubjects = new Set<string>(Array.isArray(subscriber?.dvpp_profile?.subjects) ? (subscriber!.dvpp_profile!.subjects as string[]) : []);
  const scores = subscriber?.subject_interest_scores || {};
  const scoreOf = (v: CatalogVideo) => (v.subjects || []).reduce((a, s) => a + (profSubjects.has(s) ? 3 : 0) + (Number(scores[s]) || 0), 0);
  const rec = decorated
    .filter((v) => !v.certificate && scoreOf(v) > 0)
    .sort((a, b) => scoreOf(b) - scoreOf(a) || (b.plays30d || 0) - (a.plays30d || 0))
    .slice(0, 12);
  if (rec.length) rows.push({ key: 'recommended', title: 'Doporučeno pro vás', subtitle: 'Podle vašich předmětů', videos: rec });

  const series = await getSeries();
  for (const s of series) {
    const vids = s.videoIds.map((id) => dbyId.get(id)).filter(Boolean) as CatalogVideo[];
    if (vids.length) rows.push({ key: `series:${s.id}`, title: s.title, subtitle: `${vids.length} díl${vids.length === 1 ? '' : vids.length < 5 ? 'y' : 'ů'} · ${s.hours} h DVPP`, videos: vids });
  }

  const top = decorated.filter((v) => (v.plays30d || 0) > 0).sort((a, b) => (b.plays30d || 0) - (a.plays30d || 0)).slice(0, 10);
  if (top.length) rows.push({ key: 'top', title: 'Nejsledovanější tento měsíc', videos: top });

  const sortedTopics = [...topics].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'cs'));
  for (const t of sortedTopics) {
    const vids = decorated.filter((v) => (v.topicIds || []).includes(t.id));
    if (vids.length) rows.push({ key: `topic:${t.slug}`, title: t.name, videos: vids });
  }
  const untagged = decorated.filter((v) => !(v.topicIds || []).length);
  if (untagged.length) rows.push({ key: 'topic:ostatni', title: 'Další záznamy', videos: untagged });

  void byId;
  return { rows, series, topics: sortedTopics, access, videos: decorated };
}

/** Uloží pozici přehrávače; vrací, zda šlo o aktivaci (≥ 180 s poprvé). */
export async function saveProgress(
  sb: SupabaseClient,
  subscriberId: string,
  input: { videoId: string; position: number; duration?: number | null; completed?: boolean },
): Promise<{ activated: boolean; firstPlay: boolean }> {
  const { data: prev } = await sb.from('dvpp_progress').select('position_seconds, completed').eq('subscriber_id', subscriberId).eq('video_id', input.videoId).maybeSingle();
  const p = prev as { position_seconds: number; completed: boolean } | null;
  const position = Math.max(0, Math.floor(Number(input.position) || 0));
  const row = {
    subscriber_id: subscriberId,
    video_id: input.videoId,
    position_seconds: Math.max(position, p?.position_seconds || 0),
    duration_seconds: input.duration ? Math.floor(Number(input.duration)) : null,
    completed: !!(input.completed || p?.completed),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('dvpp_progress').upsert(row, { onConflict: 'subscriber_id,video_id' });
  if (error) console.warn('[dvpp/catalog] progress', error.message);
  const activated = (p?.position_seconds || 0) < 180 && position >= 180;
  return { activated, firstPlay: !p };
}
