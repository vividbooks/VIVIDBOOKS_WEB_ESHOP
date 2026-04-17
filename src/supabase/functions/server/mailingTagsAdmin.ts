/**
 * Admin API: tagy jako v Mailchimpu — lokální Postgres + volitelný push do Mailchimp API.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { slugTag } from './mailchimpContactsMigrate.ts';

export type MailingTagListRow = {
  id: string;
  name: string;
  slug: string;
  mailchimp_tag_id: string | null;
  subscriber_count: number;
};

export async function mailingTagsList(supabase: SupabaseClient): Promise<MailingTagListRow[]> {
  const { data: tags, error } = await supabase
    .from('tags')
    .select('id, name, slug, mailchimp_tag_id')
    .order('name');
  if (error) throw new Error(error.message);

  const { data: st, error: stErr } = await supabase.from('subscriber_tags').select('tag_id');
  if (stErr) throw new Error(stErr.message);

  const count = new Map<string, number>();
  for (const r of st || []) {
    const id = r.tag_id as string;
    count.set(id, (count.get(id) || 0) + 1);
  }

  return (tags || []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    slug: t.slug as string,
    mailchimp_tag_id: (t.mailchimp_tag_id as string | null) ?? null,
    subscriber_count: count.get(t.id as string) || 0,
  }));
}

export async function mailingTagCreate(
  supabase: SupabaseClient,
  rawName: string,
): Promise<{ id: string; name: string; slug: string; mailchimp_tag_id: string | null }> {
  const name = rawName.trim();
  if (!name) throw new Error('Název tagu je prázdný');
  const slug = slugTag(name);
  const { data, error } = await supabase
    .from('tags')
    .upsert({ name, slug }, { onConflict: 'slug' })
    .select('id, name, slug, mailchimp_tag_id')
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; name: string; slug: string; mailchimp_tag_id: string | null };
}

async function ensureTagsByNames(
  supabase: SupabaseClient,
  names: string[],
): Promise<Map<string, string>> {
  /** slug -> tag_id */
  const map = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugTag(name);
    const { data, error } = await supabase
      .from('tags')
      .upsert({ name, slug }, { onConflict: 'slug' })
      .select('id, slug')
      .single();
    if (error) throw new Error(error.message);
    if (data?.id && data.slug) map.set(data.slug as string, data.id as string);
  }
  return map;
}

async function mailchimpPushMemberTags(
  server: string,
  apiKey: string,
  listId: string,
  subscriberHash: string,
  addNames: string[],
  removeNames: string[],
): Promise<void> {
  const tags = [
    ...addNames.map((name) => ({ name: name.trim(), status: 'active' as const })),
    ...removeNames.map((name) => ({ name: name.trim(), status: 'inactive' as const })),
  ].filter((t) => t.name.length > 0);
  if (tags.length === 0) return;

  const auth = btoa(`anystring:${apiKey}`);
  const res = await fetch(
    `https://${server}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}/tags`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Mailchimp ${res.status}: ${t.slice(0, 400)}`);
  }
}

export type SubscriberTagsPatchBody = {
  addNames?: string[];
  removeTagIds?: string[];
  /** Když true a kontakt má mc_list_id + mc_member_id, zkusí stejnou změnu poslat do Mailchimp. */
  syncMailchimp?: boolean;
};

export type SubscriberTagsPatchResult = {
  ok: true;
  added: number;
  removed: number;
  mailchimpSynced?: boolean;
  mailchimpDetail?: string;
};

export async function mailingSubscriberTagsPatch(
  supabase: SupabaseClient,
  subscriberId: string,
  body: SubscriberTagsPatchBody,
): Promise<SubscriberTagsPatchResult> {
  const addNames = Array.isArray(body.addNames)
    ? body.addNames.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const removeTagIds = Array.isArray(body.removeTagIds)
    ? [...new Set(body.removeTagIds.map((s) => String(s).trim()).filter(Boolean))]
    : [];

  if (addNames.length === 0 && removeTagIds.length === 0) {
    return { ok: true, added: 0, removed: 0 };
  }

  const { data: sub, error: subErr } = await supabase
    .from('subscribers')
    .select('id, mc_list_id, mc_member_id')
    .eq('id', subscriberId)
    .maybeSingle();
  if (subErr) throw new Error(subErr.message);
  if (!sub?.id) throw new Error('Kontakt neexistuje');

  let added = 0;
  if (addNames.length > 0) {
    const slugToId = await ensureTagsByNames(supabase, addNames);
    const tagIds = [...new Set(slugToId.values())];
    if (tagIds.length) {
      const { data: existing } = await supabase
        .from('subscriber_tags')
        .select('tag_id')
        .eq('subscriber_id', subscriberId)
        .in('tag_id', tagIds);
      const have = new Set((existing || []).map((r) => r.tag_id as string));
      const newIds = tagIds.filter((id) => !have.has(id));
      const rows = newIds.map((tag_id) => ({
        subscriber_id: subscriberId,
        tag_id,
        source: 'manual' as const,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase.from('subscriber_tags').insert(rows);
        if (insErr) throw new Error(insErr.message);
        added = rows.length;
      }
    }
  }

  let removed = 0;
  if (removeTagIds.length > 0) {
    const { data: delRows, error: delErr } = await supabase
      .from('subscriber_tags')
      .delete()
      .eq('subscriber_id', subscriberId)
      .in('tag_id', removeTagIds)
      .select('tag_id');
    if (delErr) throw new Error(delErr.message);
    removed = delRows?.length ?? 0;
  }

  let mailchimpSynced: boolean | undefined;
  let mailchimpDetail: string | undefined;

  if (body.syncMailchimp === true && (addNames.length > 0 || removeTagIds.length > 0)) {
    const apiKey = Deno.env.get('MAILCHIMP_API_KEY')?.trim();
    const prefix = Deno.env.get('MAILCHIMP_SERVER_PREFIX')?.trim();
    const fromKey = (() => {
      const i = (apiKey || '').lastIndexOf('-');
      return i >= 0 ? apiKey!.slice(i + 1).trim() : '';
    })();
    const server = prefix || fromKey;
    const listId = (sub.mc_list_id as string | null)?.trim() || '';
    const memberHash = (sub.mc_member_id as string | null)?.trim() || '';

    if (apiKey && server && listId && memberHash) {
      let removeNames: string[] = [];
      if (removeTagIds.length > 0) {
        const { data: trows } = await supabase.from('tags').select('name').in('id', removeTagIds);
        removeNames = (trows || []).map((t) => String(t.name || '').trim()).filter(Boolean);
      }
      try {
        await mailchimpPushMemberTags(server, apiKey, listId, memberHash, addNames, removeNames);
        mailchimpSynced = true;
      } catch (e) {
        mailchimpSynced = false;
        mailchimpDetail = (e as Error).message;
      }
    } else {
      mailchimpSynced = false;
      mailchimpDetail = 'Chybí MAILCHIMP_API_KEY / listId / member hash u kontaktu — sync přeskočen.';
    }
  }

  return {
    ok: true,
    added,
    removed,
    ...(mailchimpSynced !== undefined ? { mailchimpSynced } : {}),
    ...(mailchimpDetail ? { mailchimpDetail } : {}),
  };
}
