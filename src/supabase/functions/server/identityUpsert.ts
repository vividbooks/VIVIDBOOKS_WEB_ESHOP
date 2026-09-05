/**
 * Idempotentní upsert do grafu identit.
 * Match: email → app_user_id → pd_person_id → (org + teacher slot) → unikátní telefon.
 * Konflikt → identity_merge_review, žádný auto-merge.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { createClient } from 'npm:@supabase/supabase-js@2';
import md5 from 'npm:md5';
import { getServiceRoleEnv } from './subscribersUpsert.ts';
import {
  identityCanonicalRole,
  identityMapEmailSource,
  identityMapMembershipSource,
  identityMapSubjects,
  identityMapStages,
  identityNormalizeEmail,
  identityNormalizeIco,
  identityNormalizeOrgCode,
  identityNormalizePhone,
  identityNormalizeTeacherSlot,
  unionStages,
  unionSubjects,
  type IdentityEmailSource,
  type IdentityMembershipSource,
  type IdentityRole,
} from './identityMap.ts';
import { classifyIdentifiedWebPath } from '../../../lib/identityWebPath.ts';

export type IdentityUpsertInput = {
  email?: string | null;
  app_user_id?: string | null;
  pd_person_id?: number | string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;
  position_label?: string | null;
  subjects?: unknown;
  school_stages?: unknown;
  organization_code?: string | null;
  ico?: string | null;
  school_name?: string | null;
  pd_org_id?: number | string | null;
  pd_owner?: string | null;
  external_teacher_id?: string | null;
  subscriber_id?: string | null;
  email_source?: string | null;
  membership_source?: string | null;
  /** Další známé adresy téže osoby (profil vs slot, PD). Konflikt → merge_review. */
  extra_emails?: string[] | null;
  extraEmails?: string[] | null;
};

export type IdentityUpsertResult =
  | { ok: true; person_id: string; created: boolean; merge_review_id?: string }
  | { ok: false; error: string };

type PersonRow = {
  id: string;
  app_user_id: string | null;
  pd_person_id: number | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: IdentityRole;
  subjects: string[];
  school_stages: number[];
};

function asUuid(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

function asBigint(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function jwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: string };
    return String(payload?.role || '') || null;
  } catch {
    return null;
  }
}

export function identityUpsertAuthorized(req: Request): boolean {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim() || '';
  const auth = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  const headerSecret = req.headers.get('X-Identity-Secret')?.trim() || '';
  const secrets = [
    Deno.env.get('IDENTITY_UPSERT_SECRET'),
    Deno.env.get('VIVIDBOOKS_TEACHER_HANDOFF_SECRET'),
    Deno.env.get('TEACHER_HANDOFF_SECRET'),
    Deno.env.get('SSO_HANDOFF_SECRET'),
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  const candidates = [auth, headerSecret].filter(Boolean);
  if (service && candidates.includes(service)) return true;
  if (headerSecret && secrets.includes(headerSecret)) return true;
  if (auth && secrets.includes(auth)) return true;
  for (const tok of candidates) {
    if (anon && tok === anon) continue;
    if (jwtRole(tok) === 'service_role') return true;
  }
  return false;
}

export function scheduleIdentityUpsert(supabase: SupabaseClient, input: IdentityUpsertInput): void {
  void upsertIdentity(supabase, input).then((r) => {
    if (!r.ok) console.warn(`[identity] upsert: ${r.error}`);
  }).catch((e) => {
    console.warn('[identity] upsert:', e instanceof Error ? e.message : e);
  });
}

export function scheduleIdentityUpsertFromEnv(input: IdentityUpsertInput): void {
  const env = getServiceRoleEnv();
  if (!env) return;
  const sb = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  scheduleIdentityUpsert(sb, input);
}

export async function upsertIdentity(
  supabase: SupabaseClient,
  input: IdentityUpsertInput,
): Promise<IdentityUpsertResult> {
  try {
    const email = identityNormalizeEmail(input.email);
    const appUserId = asUuid(input.app_user_id);
    const pdPersonId = asBigint(input.pd_person_id);
    const phone = identityNormalizePhone(input.phone);
    const ico = identityNormalizeIco(input.ico);
    const orgCode = identityNormalizeOrgCode(input.organization_code);
    const teacherSlot = identityNormalizeTeacherSlot(input.external_teacher_id);
    const pdOrgId = asBigint(input.pd_org_id);
    const subscriberId = asUuid(input.subscriber_id);
    const schoolName = String(input.school_name ?? '').trim() || null;
    const pdOwner = String(input.pd_owner ?? '').trim() || null;
    const firstName = String(input.first_name ?? '').trim() || null;
    const lastName = String(input.last_name ?? '').trim() || null;
    const role = identityCanonicalRole(input.role || input.position_label);
    const subjects = identityMapSubjects(input.subjects);
    const stages = identityMapStages(input.school_stages).length
      ? identityMapStages(input.school_stages)
      : identityMapStages(input.subjects);
    const emailSource: IdentityEmailSource = identityMapEmailSource(input.email_source);
    const membershipSource: IdentityMembershipSource = identityMapMembershipSource(
      input.membership_source || input.email_source,
    );

    if (!email && !appUserId && !pdPersonId && !(orgCode && teacherSlot) && !phone) {
      if (ico || orgCode || pdOrgId != null) {
        const org = await upsertOrg(supabase, { ico, orgCode, pdOrgId, schoolName, pdOwner });
        if (!org.ok) return org;
        return { ok: true, person_id: '', created: false };
      }
      return { ok: false, error: 'Chybí klíč identity (email, app_user_id, pd_person_id, slot nebo telefon).' };
    }

    const candidateIds: string[] = [];
    const addId = (id: string | null | undefined) => {
      if (id && !candidateIds.includes(id)) candidateIds.push(id);
    };

    if (email) {
      const { data, error } = await supabase
        .from('identity_emails')
        .select('person_id')
        .eq('email', email)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      addId(data?.person_id);
    }

    if (appUserId) {
      const { data, error } = await supabase
        .from('identity_people')
        .select('id')
        .eq('app_user_id', appUserId)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      addId(data?.id);
    }

    if (pdPersonId != null) {
      const { data, error } = await supabase
        .from('identity_people')
        .select('id')
        .eq('pd_person_id', pdPersonId)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      addId(data?.id);
    }

    if (teacherSlot && (orgCode || ico)) {
      let orgQuery = supabase.from('identity_orgs').select('id');
      if (orgCode) orgQuery = orgQuery.eq('organization_code', orgCode);
      else orgQuery = orgQuery.eq('ico', ico);
      const { data: org, error: orgErr } = await orgQuery.maybeSingle();
      if (orgErr) return { ok: false, error: orgErr.message };
      if (org?.id) {
        const { data: mem, error: memErr } = await supabase
          .from('identity_memberships')
          .select('person_id')
          .eq('org_id', org.id)
          .eq('external_teacher_id', teacherSlot)
          .maybeSingle();
        if (memErr) return { ok: false, error: memErr.message };
        addId(mem?.person_id);
      }
    }

    if (phone && candidateIds.length === 0) {
      const { data, error } = await supabase
        .from('identity_people')
        .select('id')
        .eq('phone', phone);
      if (error) return { ok: false, error: error.message };
      const ids = [...new Set((data || []).map((r) => r.id))];
      if (ids.length === 1) addId(ids[0]);
    }

    let mergeReviewId: string | undefined;
    if (candidateIds.length > 1) {
      const reason = [
        email ? `email=${email}` : null,
        appUserId ? 'app_user_id' : null,
        pdPersonId != null ? 'pd_person_id' : null,
        teacherSlot ? 'org_slot' : null,
      ]
        .filter(Boolean)
        .join(',');
      const review = await writeMergeReviews(supabase, candidateIds, email, reason || 'conflict');
      mergeReviewId = review || undefined;
    }

    let created = false;
    let personId = candidateIds[0] || null;

    if (!personId) {
      const insertRow: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        phone,
        role,
        subjects,
        school_stages: stages,
        last_seen_at: new Date().toISOString(),
      };
      if (appUserId) insertRow.app_user_id = appUserId;
      if (pdPersonId != null) insertRow.pd_person_id = pdPersonId;
      const { data, error } = await supabase
        .from('identity_people')
        .insert(insertRow)
        .select('id')
        .single();
      if (error) return { ok: false, error: error.message };
      personId = data.id;
      created = true;
    } else {
      const { data: existing, error: loadErr } = await supabase
        .from('identity_people')
        .select('id, app_user_id, pd_person_id, first_name, last_name, phone, role, subjects, school_stages')
        .eq('id', personId)
        .single();
      if (loadErr) return { ok: false, error: loadErr.message };
      const patch = patchPerson(existing as PersonRow, {
        appUserId,
        pdPersonId,
        firstName,
        lastName,
        phone,
        role,
        subjects,
        stages,
        candidateIds,
      });
      if (Object.keys(patch).length) {
        const { error: updErr } = await supabase.from('identity_people').update(patch).eq('id', personId);
        if (updErr) {
          if (updErr.code === '23505') {
            const review = await writeMergeReviews(
              supabase,
              candidateIds.length ? candidateIds : [personId],
              email,
              'unique_conflict',
            );
            mergeReviewId = mergeReviewId || review || undefined;
          } else {
            return { ok: false, error: updErr.message };
          }
        }
      }
    }

    const extraEmails = [...new Set(
      [
        ...(Array.isArray(input.extra_emails) ? input.extra_emails : []),
        ...(Array.isArray(input.extraEmails) ? input.extraEmails : []),
      ]
        .map((item) => identityNormalizeEmail(item))
        .filter((item): item is string => Boolean(item) && item !== email),
    )];

    for (const address of [email, ...extraEmails].filter((item): item is string => Boolean(item))) {
      const attached = await attachEmail(supabase, {
        email: address,
        personId: personId!,
        subscriberId: address === email ? subscriberId : null,
        source: address === email ? emailSource : identityMapEmailSource(input.email_source),
      });
      if (!attached.ok) {
        if (attached.otherPersonId) {
          const review = await writeMergeReviews(
            supabase,
            [personId!, attached.otherPersonId],
            address,
            'email_belongs_to_other',
          );
          mergeReviewId = mergeReviewId || review || undefined;
        } else {
          return { ok: false, error: attached.error };
        }
      }
    }

    if (ico || orgCode || pdOrgId != null) {
      const orgId = await upsertOrg(supabase, { ico, orgCode, pdOrgId, schoolName, pdOwner });
      if (!orgId.ok) return orgId;
      if (orgId.id) {
        const mem = await upsertMembership(supabase, {
          personId: personId!,
          orgId: orgId.id,
          role,
          source: membershipSource,
          teacherSlot,
        });
        if (!mem.ok) {
          if (mem.otherPersonId) {
            const review = await writeMergeReviews(
              supabase,
              [personId!, mem.otherPersonId],
              email,
              'org_slot_belongs_to_other',
            );
            mergeReviewId = mergeReviewId || review || undefined;
          } else {
            return { ok: false, error: mem.error };
          }
        }
      }
    }

    return { ok: true, person_id: personId!, created, merge_review_id: mergeReviewId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function patchPerson(
  existing: PersonRow,
  next: {
    appUserId: string | null;
    pdPersonId: number | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: IdentityRole;
    subjects: string[];
    stages: number[];
    candidateIds: string[];
  },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
  };
  if (next.firstName && !existing.first_name) patch.first_name = next.firstName;
  if (next.lastName && !existing.last_name) patch.last_name = next.lastName;
  if (next.phone && !existing.phone) patch.phone = next.phone;
  if (next.role !== 'unknown' && (existing.role === 'unknown' || existing.role === 'other')) {
    patch.role = next.role;
  }
  const subjects = unionSubjects(existing.subjects, next.subjects);
  if (subjects.join(',') !== (existing.subjects || []).join(',')) patch.subjects = subjects;
  const stages = unionStages(existing.school_stages, next.stages);
  if (stages.join(',') !== (existing.school_stages || []).join(',')) patch.school_stages = stages;
  if (next.appUserId && !existing.app_user_id) patch.app_user_id = next.appUserId;
  if (next.pdPersonId != null && existing.pd_person_id == null) patch.pd_person_id = next.pdPersonId;
  return patch;
}

async function attachEmail(
  supabase: SupabaseClient,
  args: { email: string; personId: string; subscriberId: string | null; source: IdentityEmailSource },
): Promise<{ ok: true } | { ok: false; error: string; otherPersonId?: string }> {
  const { data: existing, error } = await supabase
    .from('identity_emails')
    .select('email, person_id, subscriber_id, is_primary')
    .eq('email', args.email)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  if (existing) {
    if (existing.person_id !== args.personId) {
      return { ok: false, error: 'email belongs to another person', otherPersonId: existing.person_id };
    }
    if (args.subscriberId && !existing.subscriber_id) {
      const { error: updErr } = await supabase
        .from('identity_emails')
        .update({ subscriber_id: args.subscriberId })
        .eq('email', args.email);
      if (updErr) return { ok: false, error: updErr.message };
    }
    return { ok: true };
  }

  const { count, error: cntErr } = await supabase
    .from('identity_emails')
    .select('email', { count: 'exact', head: true })
    .eq('person_id', args.personId);
  if (cntErr) return { ok: false, error: cntErr.message };

  const { error: insErr } = await supabase.from('identity_emails').insert({
    email: args.email,
    person_id: args.personId,
    subscriber_id: args.subscriberId,
    source: args.source,
    is_primary: (count || 0) === 0,
  });
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true };
}

async function upsertOrg(
  supabase: SupabaseClient,
  args: {
    ico: string | null;
    orgCode: string | null;
    pdOrgId: number | null;
    schoolName: string | null;
    pdOwner: string | null;
  },
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  let existing: { id: string; school_name: string | null; pd_owner: string | null; ico: string | null; organization_code: string | null; pd_org_id: number | null } | null = null;

  const tryFind = async (col: string, val: string | number) => {
    const { data, error } = await supabase.from('identity_orgs').select('id, school_name, pd_owner, ico, organization_code, pd_org_id').eq(col, val).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };

  try {
    if (args.ico) existing = await tryFind('ico', args.ico);
    if (!existing && args.orgCode) existing = await tryFind('organization_code', args.orgCode);
    if (!existing && args.pdOrgId != null) existing = await tryFind('pd_org_id', args.pdOrgId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (args.ico && !existing.ico) patch.ico = args.ico;
    if (args.orgCode && !existing.organization_code) patch.organization_code = args.orgCode;
    if (args.pdOrgId != null && existing.pd_org_id == null) patch.pd_org_id = args.pdOrgId;
    if (args.schoolName && !existing.school_name) patch.school_name = args.schoolName;
    if (args.pdOwner && !existing.pd_owner) patch.pd_owner = args.pdOwner;
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('identity_orgs').update(patch).eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, id: existing.id };
  }

  const insertRow: Record<string, unknown> = {
    ico: args.ico,
    organization_code: args.orgCode,
    pd_org_id: args.pdOrgId,
    school_name: args.schoolName,
    pd_owner: args.pdOwner,
  };
  const { data, error } = await supabase.from('identity_orgs').insert(insertRow).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

async function upsertMembership(
  supabase: SupabaseClient,
  args: {
    personId: string;
    orgId: string;
    role: IdentityRole;
    source: IdentityMembershipSource;
    teacherSlot: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string; otherPersonId?: string }> {
  if (args.teacherSlot) {
    const { data: slotOwner, error } = await supabase
      .from('identity_memberships')
      .select('person_id')
      .eq('org_id', args.orgId)
      .eq('external_teacher_id', args.teacherSlot)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (slotOwner && slotOwner.person_id !== args.personId) {
      return { ok: false, error: 'slot belongs to another person', otherPersonId: slotOwner.person_id };
    }
  }

  const { data: existing, error: findErr } = await supabase
    .from('identity_memberships')
    .select('id, role, external_teacher_id')
    .eq('person_id', args.personId)
    .eq('org_id', args.orgId)
    .maybeSingle();
  if (findErr) return { ok: false, error: findErr.message };

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (args.teacherSlot && !existing.external_teacher_id) patch.external_teacher_id = args.teacherSlot;
    if (args.role !== 'unknown' && existing.role === 'unknown') patch.role = args.role;
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('identity_memberships').update(patch).eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error: insErr } = await supabase.from('identity_memberships').insert({
    person_id: args.personId,
    org_id: args.orgId,
    role: args.role,
    source: args.source,
    external_teacher_id: args.teacherSlot,
  });
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true };
}

async function writeMergeReviews(
  supabase: SupabaseClient,
  personIds: string[],
  email: string | null,
  reason: string,
): Promise<string | null> {
  const unique = [...new Set(personIds)].filter(Boolean);
  if (unique.length < 2) return null;
  let firstId: string | null = null;
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const [a, b] = orderedPair(unique[i], unique[j]);
      const { data, error } = await supabase
        .from('identity_merge_review')
        .insert({ person_a_id: a, person_b_id: b, email, reason, status: 'open' })
        .select('id')
        .maybeSingle();
      if (error) {
        const { data: existing } = await supabase
          .from('identity_merge_review')
          .select('id')
          .eq('person_a_id', a)
          .eq('person_b_id', b)
          .eq('status', 'open')
          .maybeSingle();
        if (existing?.id && !firstId) firstId = existing.id;
        continue;
      }
      if (data?.id && !firstId) firstId = data.id;
    }
  }
  return firstId;
}

type SubscriberLookupRow = {
  id: string;
  status: string;
  last_opened_at?: string | null;
  last_clicked_at?: string | null;
  subscribed_at?: string | null;
  created_at?: string | null;
  merge_fields?: Record<string, unknown> | null;
};

type WebinarIdxEntry = {
  webinarId?: string;
  webinarTitle?: string;
  webinarSlug?: string;
  attended?: boolean;
  attendedAt?: string;
  registeredAt?: string;
};

const ENG_RANK: Record<string, number> = {
  'eng-hot': 5,
  'eng-warm': 4,
  'eng-cold': 3,
  'eng-new': 2,
  'eng-never': 1,
};

async function loadIdentityTagSlugs(supabase: SupabaseClient, subscriberIds: string[]): Promise<string[]> {
  if (!subscriberIds.length) return [];
  const { data: links } = await supabase
    .from('subscriber_tags')
    .select('tag_id')
    .in('subscriber_id', subscriberIds);
  const tagIds = [...new Set((links || []).map((row) => row.tag_id).filter(Boolean))];
  if (!tagIds.length) return [];
  const { data: tags } = await supabase.from('tags').select('slug').in('id', tagIds);
  return [...new Set((tags || []).map((row) => String(row.slug || '').trim()).filter(Boolean))];
}

function summarizeMailEngagement(rows: SubscriberLookupRow[], tagSlugs: string[]) {
  const engTags = tagSlugs.filter((slug) => slug.startsWith('eng-'));
  let rating: number | null = null;
  let lastOpenedAt: string | null = null;
  let lastClickedAt: string | null = null;
  for (const row of rows) {
    const mf = row.merge_fields && typeof row.merge_fields === 'object' ? row.merge_fields : {};
    const n = Number(mf._mc_member_rating);
    if (Number.isFinite(n) && (rating == null || n > rating)) rating = n;
    if (row.last_opened_at && (!lastOpenedAt || row.last_opened_at > lastOpenedAt)) lastOpenedAt = row.last_opened_at;
    if (row.last_clicked_at && (!lastClickedAt || row.last_clicked_at > lastClickedAt)) lastClickedAt = row.last_clicked_at;
  }
  const bucket = engTags.sort((a, b) => (ENG_RANK[b] || 0) - (ENG_RANK[a] || 0))[0] || null;
  return {
    bucket,
    tags: engTags,
    mailchimp_rating: rating,
    last_opened_at: lastOpenedAt,
    last_clicked_at: lastClickedAt,
  };
}

function webinarFromTags(tagSlugs: string[]) {
  const wb = tagSlugs.filter((slug) => slug.startsWith('wb-'));
  if (!wb.length) return null;
  return {
    source: 'tag' as const,
    webinar_id: null as string | null,
    title: wb.includes('wb-webinar') ? 'Webinář (tag)' : wb[0],
    slug: wb[0],
    attended: wb.includes('wb-webinar'),
    at: null as string | null,
    tags: wb,
  };
}

async function loadLastWebinar(supabase: SupabaseClient, emails: string[], _tagSlugs: string[]) {
  const keys = [...new Set(emails.map((email) => identityNormalizeEmail(email)).filter(Boolean))]
    .map((email) => `webinar_reg_email_idx_${md5(email)}`);
  if (!keys.length) return null;
  const { data } = await supabase.from('kv_store_33b2092f').select('value').in('key', keys);
  const entries: WebinarIdxEntry[] = [];
  for (const row of data || []) {
    if (Array.isArray(row.value)) entries.push(...(row.value as WebinarIdxEntry[]));
  }
  if (!entries.length) return null;
  const dated = entries
    .map((entry) => ({
      entry,
      at: entry.attendedAt || entry.registeredAt || '',
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const best = dated[0]?.entry;
  if (!best) return null;
  return {
    source: 'kv' as const,
    webinar_id: best.webinarId || null,
    title: best.webinarTitle || best.webinarId || null,
    slug: best.webinarSlug || null,
    attended: Boolean(best.attended),
    at: best.attendedAt || best.registeredAt || null,
    tags: [] as string[],
  };
}

const DEFAULT_ULTRA_ACTIVITY_URL =
  'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/public/identity-activity';

async function loadAppActivityFromUltra(input: {
  emails: string[];
  appUserId?: string | null;
  slots: Array<{ organization_code: string; external_teacher_id: string }>;
}): Promise<{
  last_app_day: string | null;
  worksheet_printed: boolean;
  last_worksheet_printed_at: string | null;
  queried: boolean;
}> {
  const empty = { last_app_day: null, worksheet_printed: false, last_worksheet_printed_at: null, queried: false };
  const secret = Deno.env.get('IDENTITY_UPSERT_SECRET')?.trim() || '';
  if (!secret) return empty;
  if (!input.emails.length && !input.appUserId && !input.slots.length) return { ...empty, queried: true };
  const url = (Deno.env.get('ULTRA_IDENTITY_ACTIVITY_URL') || DEFAULT_ULTRA_ACTIVITY_URL).trim();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-identity-secret': secret,
      },
      body: JSON.stringify({
        emails: input.emails,
        app_user_id: input.appUserId,
        slots: input.slots,
      }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) {
      console.warn(`[identity] ultra activity ${response.status}`);
      return empty;
    }
    const data = await response.json() as {
      last_app_day?: string | null;
      worksheet_printed?: boolean;
      last_worksheet_printed_at?: string | null;
    };
    return {
      last_app_day: data.last_app_day || null,
      worksheet_printed: Boolean(data.worksheet_printed),
      last_worksheet_printed_at: data.last_worksheet_printed_at || null,
      queried: true,
    };
  } catch (error) {
    console.warn('[identity] ultra activity:', error instanceof Error ? error.message : error);
    return empty;
  }
}

export async function identityLookupByEmail(supabase: SupabaseClient, rawEmail: string) {
  const email = identityNormalizeEmail(rawEmail);
  if (!email) return { ok: false as const, error: 'Neplatný e-mail' };
  const { data: row, error } = await supabase
    .from('identity_emails')
    .select('email, person_id, subscriber_id, source, is_primary')
    .eq('email', email)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!row) return { ok: true as const, found: false as const, email };
  const personId = row.person_id;
  const [{ data: person }, { data: emails }, { data: memberships }, { data: lastWeb }] = await Promise.all([
    supabase.from('identity_people').select('*').eq('id', personId).maybeSingle(),
    supabase.from('identity_emails').select('email, source, is_primary, subscriber_id').eq('person_id', personId),
    supabase
      .from('identity_memberships')
      .select('id, role, source, external_teacher_id, org_id, identity_orgs (id, ico, organization_code, school_name, pd_org_id, pd_owner)')
      .eq('person_id', personId),
    supabase
      .from('identity_web_events')
      .select('occurred_at, kind, path, entity_id')
      .eq('person_id', personId)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const subscriberIds = [...new Set((emails || []).map((item) => item.subscriber_id).filter(Boolean))] as string[];
  const personEmails = (emails || []).map((item) => item.email).filter(Boolean);
  const orgs = (memberships || []).map((item) => {
    const org = item.identity_orgs as Record<string, unknown> | Record<string, unknown>[] | null;
    return (Array.isArray(org) ? org[0] : org) || null;
  });
  const [subscriberRows, tagSlugs, purchases, lastWebinar, appActivity] = await Promise.all([
    subscriberIds.length
      ? supabase
          .from('subscribers')
          .select('id, status, last_opened_at, last_clicked_at, subscribed_at, created_at, merge_fields')
          .in('id', subscriberIds)
      : Promise.resolve({ data: [] as SubscriberLookupRow[] }),
    loadIdentityTagSlugs(supabase, subscriberIds),
    loadIdentityPurchases(supabase, {
      emails: personEmails,
      icos: orgs.map((org) => (org?.ico ? String(org.ico) : null)).filter((item): item is string => Boolean(item)),
    }),
    loadLastWebinar(supabase, personEmails, []),
    loadAppActivityFromUltra({
      emails: personEmails,
      appUserId: person?.app_user_id || null,
      slots: (memberships || [])
        .map((item) => {
          const org = item.identity_orgs as { organization_code?: string | null } | { organization_code?: string | null }[] | null;
          const row = Array.isArray(org) ? org[0] : org;
          const organizationCode = String(row?.organization_code || '').trim();
          const teacherSlot = String(item.external_teacher_id || '').trim();
          return organizationCode && teacherSlot
            ? { organization_code: organizationCode, external_teacher_id: teacherSlot }
            : null;
        })
        .filter((item): item is { organization_code: string; external_teacher_id: string } => Boolean(item)),
    }),
  ]);
  const statusById = new Map((subscriberRows.data || []).map((row) => [row.id, row.status]));
  const emailsWithOptIn = (emails || []).map((item) => ({
    ...item,
    mailing_status: item.subscriber_id ? statusById.get(item.subscriber_id) || null : null,
  }));
  const wbTags = tagSlugs.filter((slug) => slug.startsWith('wb-'));
  const lastWebinarResolved = lastWebinar
    ? { ...lastWebinar, tags: wbTags }
    : webinarFromTags(tagSlugs);
  return {
    ok: true as const,
    found: true as const,
    person,
    emails: emailsWithOptIn,
    memberships: memberships || [],
    last_web_event: lastWeb || null,
    last_webinar: lastWebinarResolved,
    mail_engagement: summarizeMailEngagement(subscriberRows.data || [], tagSlugs),
    app: appActivity,
    purchases,
  };
}

const BOUGHT_ORDER_STATUSES = ['paid', 'processing', 'exported', 'shipped', 'delivered'];

async function loadIdentityPurchases(
  supabase: SupabaseClient,
  keys: { emails: string[]; icos: string[] },
): Promise<{
  person: Array<Record<string, unknown>>;
  school: Array<Record<string, unknown>>;
}> {
  const emails = [...new Set(keys.emails.map((item) => item.trim().toLowerCase()).filter(Boolean))];
  const icos = [...new Set(keys.icos.map((item) => item.replace(/\D/g, '')).filter((item) => item.length === 8))];
  const empty = { person: [], school: [] };
  if (emails.length === 0 && icos.length === 0) return empty;

  const select =
    'id, order_number, status, customer_email, school_name, ico, total, paid_at, created_at, order_items (product_name, quantity)';
  const [byEmail, byIco] = await Promise.all([
    emails.length
      ? supabase.from('orders').select(select).in('status', BOUGHT_ORDER_STATUSES).in('customer_email', emails).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    icos.length
      ? supabase.from('orders').select(select).in('status', BOUGHT_ORDER_STATUSES).in('ico', icos).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const data = [...(byEmail.data || []), ...(byIco.data || [])];
  if (byEmail.error && byIco.error) return empty;

  const person: Array<Record<string, unknown>> = [];
  const school: Array<Record<string, unknown>> = [];
  const seenPerson = new Set<string>();
  const seenSchool = new Set<string>();
  for (const order of data) {
    const email = String(order.customer_email || '').trim().toLowerCase();
    const ico = String(order.ico || '').replace(/\D/g, '');
    const row = {
      order_number: order.order_number,
      status: order.status,
      total: order.total,
      paid_at: order.paid_at,
      school_name: order.school_name,
      ico: order.ico,
      items: (order.order_items || []).map((item: { product_name?: string; quantity?: number }) => ({
        name: item.product_name,
        quantity: item.quantity,
      })),
    };
    if (emails.includes(email) && !seenPerson.has(order.id)) {
      seenPerson.add(order.id);
      person.push(row);
    }
    if (icos.includes(ico) && !seenSchool.has(order.id)) {
      seenSchool.add(order.id);
      school.push(row);
    }
  }
  return { person, school };
}

const WEB_EVENT_DEDUPE_MS = 30 * 60 * 1000;

/** Identifikované zobrazení stránky. Nesmí subscribe. */
export async function recordIdentifiedWebEvent(
  supabase: SupabaseClient,
  input: { email?: string | null; name?: string | null; path?: string | null },
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const email = identityNormalizeEmail(input.email);
  if (!email) return { ok: false, error: 'Neplatný e-mail' };
  const classified = classifyIdentifiedWebPath(input.path);
  if (!classified) return { ok: true, skipped: true };

  const nameParts = String(input.name || '').trim().split(/\s+/).filter(Boolean);
  const upsert = await upsertIdentity(supabase, {
    email,
    first_name: nameParts[0] || null,
    last_name: nameParts.slice(1).join(' ') || null,
    email_source: 'vb_id',
  });
  if (!upsert.ok) return upsert;

  const since = new Date(Date.now() - WEB_EVENT_DEDUPE_MS).toISOString();
  const { count } = await supabase
    .from('identity_web_events')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', upsert.person_id)
    .eq('path', classified.path)
    .gte('occurred_at', since);
  if ((count || 0) > 0) return { ok: true, skipped: true };

  const { error } = await supabase.from('identity_web_events').insert({
    person_id: upsert.person_id,
    kind: classified.kind,
    path: classified.path,
    entity_id: classified.entity_id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
