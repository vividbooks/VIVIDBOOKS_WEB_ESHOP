/**
 * DVPP zdarma — hlasování „Natočíme příště“.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { recordFunnelEvent } from './events.ts';
import type { SubscriberRow } from './shared.ts';

export type TopicRow = {
  id: string;
  title: string;
  description: string | null;
  subjects: string[];
  status: string;
  votes_count: number;
  scheduled_webinar_id: string | null;
  myVote?: boolean;
};

export async function listTopics(sb: SupabaseClient, subscriberId: string | null): Promise<TopicRow[]> {
  const { data } = await sb
    .from('content_topics')
    .select('id, title, description, subjects, status, votes_count, scheduled_webinar_id')
    .in('status', ['open', 'scheduled'])
    .order('votes_count', { ascending: false })
    .limit(30);
  const topics = (data || []) as TopicRow[];
  if (subscriberId) {
    const { data: mine } = await sb.from('content_votes').select('topic_id').eq('subscriber_id', subscriberId);
    const set = new Set(((mine || []) as Array<{ topic_id: string }>).map((m) => m.topic_id));
    for (const t of topics) t.myVote = set.has(t.id);
  }
  return topics;
}

export async function toggleVote(
  sb: SupabaseClient,
  subscriber: SubscriberRow,
  topicId: string,
): Promise<{ ok: true; voted: boolean; votes: number } | { ok: false; error: string; status: number }> {
  const { data: topic } = await sb.from('content_topics').select('id, status').eq('id', topicId).maybeSingle();
  if (!topic || (topic as { status: string }).status !== 'open') return { ok: false, error: 'Tohle téma už není otevřené k hlasování.', status: 404 };
  const { data: existing } = await sb.from('content_votes').select('topic_id').eq('subscriber_id', subscriber.id).eq('topic_id', topicId).maybeSingle();
  let voted: boolean;
  if (existing) {
    await sb.from('content_votes').delete().eq('subscriber_id', subscriber.id).eq('topic_id', topicId);
    voted = false;
  } else {
    const { error } = await sb.from('content_votes').insert({ subscriber_id: subscriber.id, topic_id: topicId });
    if (error && !/duplicate|unique/i.test(error.message)) return { ok: false, error: error.message, status: 500 };
    voted = true;
    await recordFunnelEvent(sb, { event: 'vote', subscriberId: subscriber.id, email: subscriber.email, redIzo: subscriber.school_red_izo, meta: { topicId } });
  }
  const { count } = await sb.from('content_votes').select('subscriber_id', { count: 'exact', head: true }).eq('topic_id', topicId);
  await sb.from('content_topics').update({ votes_count: count || 0 }).eq('id', topicId);
  return { ok: true, voted, votes: count || 0 };
}

export async function upsertTopic(sb: SupabaseClient, input: Partial<TopicRow> & { id: string; title: string }): Promise<void> {
  await sb.from('content_topics').upsert({
    id: input.id.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    title: input.title,
    description: input.description ?? null,
    subjects: input.subjects ?? [],
    status: input.status ?? 'open',
    scheduled_webinar_id: input.scheduled_webinar_id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}
