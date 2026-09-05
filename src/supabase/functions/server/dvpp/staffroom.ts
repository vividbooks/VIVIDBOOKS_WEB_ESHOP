/**
 * DVPP zdarma — sborovna (referral bez zadávání cizích e-mailů).
 *
 * Cesty dovnitř: osobní odkaz / školní kód (`/s/{code}`), kód od ředitele, doména školy,
 * registrace na webinář se školou, „vzkaz kolegovi“ v režimu WP29.
 * Do milníku se počítá jen kontakt `subscribed` a aktivovaný (přehrání ≥ 3 min nebo certifikát);
 * zakladatel a ředitel se počítají hned.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  GRACE_DAYS, isDirectorPosition, milestoneTargetForTeachers, normalizeStaffroomCode, recountStaffroom,
  staffroomCodeFromRandom, type StaffroomStatus,
} from './milestones.ts';
import { findSchoolByRedIzo, linkSubscriberToSchool, refreshSchoolStatus, type SchoolRow } from './schools.ts';
import { recordFunnelEvent } from './events.ts';
import { addDaysIso, b64url, nowIso, randomBytes, sha256Hex, type SubscriberRow } from './shared.ts';

export type StaffroomRow = {
  red_izo: string;
  code: string;
  founder_id: string | null;
  milestone_target: number;
  confirmed_count: number;
  status: StaffroomStatus;
  unlocked_by: string | null;
  unlocked_at: string | null;
  grace_until: string | null;
  created_at: string;
};

const SR_COLUMNS = 'red_izo, code, founder_id, milestone_target, confirmed_count, status, unlocked_by, unlocked_at, grace_until, created_at';

export async function getStaffroom(sb: SupabaseClient, redIzo: string): Promise<StaffroomRow | null> {
  const { data } = await sb.from('staffrooms').select(SR_COLUMNS).eq('red_izo', redIzo).maybeSingle();
  return (data as StaffroomRow | null) ?? null;
}

export async function getStaffroomByCode(sb: SupabaseClient, code: string): Promise<StaffroomRow | null> {
  const c = normalizeStaffroomCode(code);
  if (c.length < 4) return null;
  const { data } = await sb.from('staffrooms').select(SR_COLUMNS).eq('code', c).maybeSingle();
  return (data as StaffroomRow | null) ?? null;
}

async function uniqueCode(sb: SupabaseClient): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = staffroomCodeFromRandom(randomBytes(6));
    const { data } = await sb.from('staffrooms').select('red_izo').eq('code', code).maybeSingle();
    if (!data) return code;
  }
  return staffroomCodeFromRandom(randomBytes(8), 8);
}

/** Založí sborovnu školy (pokud není) a přidá zakladatele jako člena. */
export async function ensureStaffroom(
  sb: SupabaseClient,
  school: SchoolRow,
  founder: SubscriberRow | null,
  via: 'founder' | 'director' | 'registration' | 'domain' | 'manual' = 'founder',
): Promise<{ staffroom: StaffroomRow; created: boolean }> {
  let sr = await getStaffroom(sb, school.red_izo);
  let created = false;
  if (!sr) {
    const code = await uniqueCode(sb);
    const { error } = await sb.from('staffrooms').insert({
      red_izo: school.red_izo,
      code,
      founder_id: founder?.id || null,
      milestone_target: milestoneTargetForTeachers(school.teachers_count),
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    sr = await getStaffroom(sb, school.red_izo);
    if (!sr) throw new Error('Sborovnu se nepodařilo založit.');
    created = true;
    if (founder) {
      await recordFunnelEvent(sb, { event: 'staffroom_created', subscriberId: founder.id, email: founder.email, redIzo: school.red_izo });
    }
  }
  if (founder) await addMember(sb, sr.red_izo, founder.id, via, null, via === 'founder' || via === 'director');
  return { staffroom: sr, created };
}

export async function addMember(
  sb: SupabaseClient,
  redIzo: string,
  subscriberId: string,
  via: 'founder' | 'link' | 'code' | 'director' | 'domain' | 'registration' | 'referral' | 'manual',
  invitedBy: string | null,
  activatedNow = false,
): Promise<{ added: boolean }> {
  const { data: existing } = await sb.from('staffroom_members').select('red_izo').eq('subscriber_id', subscriberId).maybeSingle();
  if (existing) return { added: false };
  const { error } = await sb.from('staffroom_members').insert({
    red_izo: redIzo,
    subscriber_id: subscriberId,
    via,
    invited_by: invitedBy,
    activated_at: activatedNow ? nowIso() : null,
  });
  if (error) { console.warn('[dvpp/staffroom] addMember', error.message); return { added: false }; }
  await linkSubscriberToSchool(sb, subscriberId, redIzo);
  return { added: true };
}

/** Aktivace člena (≥ 3 min přehrání nebo certifikát) — teprve pak se počítá do milníku. */
export async function activateMember(sb: SupabaseClient, subscriberId: string): Promise<void> {
  const { data } = await sb.from('staffroom_members').select('red_izo, activated_at').eq('subscriber_id', subscriberId).maybeSingle();
  const m = data as { red_izo: string; activated_at: string | null } | null;
  if (!m || m.activated_at) return;
  await sb.from('staffroom_members').update({ activated_at: nowIso() }).eq('subscriber_id', subscriberId);
  await recountOne(sb, m.red_izo);
}

/** Přidá přihlášeného přes kód/odkaz. Vrací sborovnu a jestli je nový člen. */
export async function joinByCode(
  sb: SupabaseClient,
  subscriber: SubscriberRow,
  code: string,
  invitedBy: string | null,
): Promise<{ ok: true; staffroom: StaffroomRow; school: SchoolRow; added: boolean } | { ok: false; error: string; status: number }> {
  const sr = await getStaffroomByCode(sb, code);
  if (!sr) return { ok: false, error: 'Tenhle školní kód neznáme. Zkontrolujte ho s kolegou.', status: 404 };
  const school = await findSchoolByRedIzo(sb, sr.red_izo);
  if (!school) return { ok: false, error: 'Škola k tomuto kódu chybí v rejstříku.', status: 404 };
  const r = await addMember(sb, sr.red_izo, subscriber.id, invitedBy ? 'referral' : 'code', invitedBy || sr.founder_id);
  if (r.added) {
    if (invitedBy || sr.founder_id) {
      await sb.from('subscribers').update({ referred_by: invitedBy || sr.founder_id }).eq('id', subscriber.id).is('referred_by', null);
    }
    await recordFunnelEvent(sb, {
      event: 'invite_confirmed', subscriberId: subscriber.id, email: subscriber.email, redIzo: sr.red_izo,
      attribution: { referrerId: invitedBy || sr.founder_id },
      meta: { code: sr.code },
    });
    await recountOne(sb, sr.red_izo);
  }
  return { ok: true, staffroom: (await getStaffroom(sb, sr.red_izo)) ?? sr, school, added: r.added };
}

/** Ředitel/zástupce odemkne sborovnu své školy bez milníku. */
export async function directorUnlock(
  sb: SupabaseClient,
  subscriber: SubscriberRow,
): Promise<{ ok: true; staffroom: StaffroomRow } | { ok: false; error: string; status: number }> {
  if (!isDirectorPosition(subscriber.position_label)) {
    return { ok: false, error: 'Odemknutí školním kódem je pro vedení školy. Změňte si pozici v profilu, pokud jste ředitel/ka nebo zástupce.', status: 403 };
  }
  if (!subscriber.school_red_izo) return { ok: false, error: 'Nejdřív vyberte školu v profilu.', status: 400 };
  const school = await findSchoolByRedIzo(sb, subscriber.school_red_izo);
  if (!school) return { ok: false, error: 'Škola chybí v rejstříku.', status: 404 };
  const { staffroom } = await ensureStaffroom(sb, school, subscriber, 'director');
  await sb.from('staffrooms').update({
    status: 'unlocked', unlocked_by: 'director', unlocked_at: nowIso(), grace_until: null,
  }).eq('red_izo', staffroom.red_izo);
  await sb.from('schools').update({ milestone_reached_at: nowIso() }).eq('red_izo', staffroom.red_izo).is('milestone_reached_at', null);
  await recordFunnelEvent(sb, { event: 'director_unlock', subscriberId: subscriber.id, email: subscriber.email, redIzo: staffroom.red_izo });
  await refreshSchoolStatus(sb, staffroom.red_izo);
  return { ok: true, staffroom: (await getStaffroom(sb, staffroom.red_izo))! };
}

export type MemberView = { firstName: string; lastInitial: string; activated: boolean; via: string; joinedAt: string; isMe: boolean };

/** Stav sborovny pro dashboard učitele. */
export async function staffroomView(sb: SupabaseClient, subscriber: SubscriberRow): Promise<{
  school: SchoolRow | null;
  staffroom: StaffroomRow | null;
  members: MemberView[];
  confirmed: number;
  target: number;
  missing: number;
  myReferred: number;
  shareUrl: string | null;
  colleaguesInBase: number;
}> {
  if (!subscriber.school_red_izo) {
    return { school: null, staffroom: null, members: [], confirmed: 0, target: 8, missing: 8, myReferred: 0, shareUrl: null, colleaguesInBase: 0 };
  }
  const [school, sr, { count: colleagues }] = await Promise.all([
    findSchoolByRedIzo(sb, subscriber.school_red_izo),
    getStaffroom(sb, subscriber.school_red_izo),
    sb.from('subscribers').select('id', { count: 'exact', head: true }).eq('school_red_izo', subscriber.school_red_izo).eq('status', 'subscribed'),
  ]);
  const target = sr?.milestone_target ?? milestoneTargetForTeachers(school?.teachers_count);
  let members: MemberView[] = [];
  let myReferred = 0;
  if (sr) {
    const { data } = await sb
      .from('staffroom_members')
      .select('subscriber_id, via, joined_at, activated_at, invited_by, subscribers!inner(first_name, last_name, status)')
      .eq('red_izo', sr.red_izo)
      .order('joined_at', { ascending: true })
      .limit(200);
    type Row = { subscriber_id: string; via: string; joined_at: string; activated_at: string | null; invited_by: string | null; subscribers: { first_name: string | null; last_name: string | null; status: string } };
    const rows = (data || []) as unknown as Row[];
    members = rows
      .filter((r) => r.subscribers?.status === 'subscribed')
      .map((r) => ({
        firstName: r.subscribers.first_name || 'Kolega',
        lastInitial: (r.subscribers.last_name || '').slice(0, 1),
        activated: !!r.activated_at || r.via === 'founder' || r.via === 'director',
        via: r.via,
        joinedAt: r.joined_at,
        isMe: r.subscriber_id === subscriber.id,
      }));
    myReferred = rows.filter((r) => r.invited_by === subscriber.id && r.subscribers?.status === 'subscribed' && (r.activated_at || r.via === 'director')).length;
  }
  const confirmed = sr?.confirmed_count ?? 0;
  return {
    school, staffroom: sr, members, confirmed, target,
    missing: Math.max(0, target - confirmed), myReferred,
    shareUrl: sr ? `/s/${sr.code}` : null,
    colleaguesInBase: colleagues || 0,
  };
}

/** Přepočet jedné sborovny; vrací nový stav. */
export async function recountOne(sb: SupabaseClient, redIzo: string, now = new Date()): Promise<StaffroomRow | null> {
  const sr = await getStaffroom(sb, redIzo);
  if (!sr) return null;
  const { data } = await sb
    .from('staffroom_members')
    .select('via, activated_at, subscribers!inner(status)')
    .eq('red_izo', redIzo)
    .limit(500);
  type Row = { via: string; activated_at: string | null; subscribers: { status: string } };
  const confirmed = ((data || []) as unknown as Row[]).filter(
    (r) => r.subscribers?.status === 'subscribed' && (r.activated_at || r.via === 'founder' || r.via === 'director'),
  ).length;
  const pinned = sr.unlocked_by === 'director' || sr.unlocked_by === 'customer' || sr.unlocked_by === 'manual';
  const res = recountStaffroom({
    status: sr.status, target: sr.milestone_target, confirmed, graceUntil: sr.grace_until, now, pinned,
  });
  const patch: Record<string, unknown> = { confirmed_count: confirmed, status: res.status, grace_until: res.graceUntil };
  if (res.unlockedNow) {
    patch.unlocked_at = nowIso();
    if (!pinned) patch.unlocked_by = 'milestone';
  }
  await sb.from('staffrooms').update(patch).eq('red_izo', redIzo);
  if (res.unlockedNow) {
    await sb.from('schools').update({ milestone_reached_at: nowIso() }).eq('red_izo', redIzo).is('milestone_reached_at', null);
    await recordFunnelEvent(sb, { event: 'staffroom_unlocked', redIzo, meta: { confirmed, target: sr.milestone_target } });
  } else if (res.status === 'grace' && sr.status !== 'grace') {
    await recordFunnelEvent(sb, { event: 'staffroom_grace', redIzo, meta: { confirmed, target: sr.milestone_target, graceDays: GRACE_DAYS } });
  }
  await refreshSchoolStatus(sb, redIzo);
  return getStaffroom(sb, redIzo);
}

/** Cron: přepočet všech sboroven + úklid nepotvrzených vzkazů (14 dní). */
export async function recountAll(sb: SupabaseClient): Promise<{ recounted: number; cleanedReferrals: number }> {
  const { data } = await sb.from('staffrooms').select('red_izo').limit(10000);
  let recounted = 0;
  for (const r of (data || []) as Array<{ red_izo: string }>) {
    await recountOne(sb, r.red_izo);
    recounted++;
  }
  const cutoff = addDaysIso(-14);
  const { data: old } = await sb
    .from('referrals')
    .update({ invitee_email: null, status: 'expired' })
    .eq('status', 'sent')
    .lt('sent_at', cutoff)
    .select('id');
  return { recounted, cleanedReferrals: (old || []).length };
}

/* ── „Vzkaz kolegovi“ — režim WP29 ────────────────────────────────────────── */

export const REFERRAL_DAILY_LIMIT = 10;

export type ColleagueMessageDeps = {
  sendEmail: (opts: { toEmail: string; toName: string; subject: string; html: string }) => Promise<boolean>;
  buildColleagueEmailHtml: (opts: { inviterName: string; schoolName: string; message: string; joinUrl: string }) => string;
  publicOrigin: string;
};

/**
 * Jedna zpráva jménem odesílatele, bez marketingového obsahu, bez připomínky, bez odměny za odeslání.
 * Adresa se po 14 dnech bez reakce maže (cron). Limit 10 denně na odesílatele, dedupe 30 dní.
 */
export async function sendColleagueMessage(
  sb: SupabaseClient,
  deps: ColleagueMessageDeps,
  input: { inviter: SubscriberRow; email: string; message: string; clientIp: string | null },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const email = String(input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Zadejte platný e-mail kolegy.', status: 400 };
  if (email === input.inviter.email) return { ok: false, error: 'To je váš vlastní e-mail.', status: 400 };
  if (!input.inviter.school_red_izo) return { ok: false, error: 'Nejdřív vyberte školu v profilu.', status: 400 };
  const school = await findSchoolByRedIzo(sb, input.inviter.school_red_izo);
  if (!school) return { ok: false, error: 'Škola chybí v rejstříku.', status: 404 };
  const { staffroom } = await ensureStaffroom(sb, school, input.inviter, 'founder');

  const hash = await sha256Hex(email);
  const dayAgo = addDaysIso(-1);
  const monthAgo = addDaysIso(-30);
  const [{ count: today }, { data: dup }] = await Promise.all([
    sb.from('referrals').select('id', { count: 'exact', head: true }).eq('inviter_id', input.inviter.id).gte('sent_at', dayAgo),
    sb.from('referrals').select('id').eq('invitee_email_hash', hash).gte('sent_at', monthAgo).limit(1),
  ]);
  if ((today || 0) >= REFERRAL_DAILY_LIMIT) return { ok: false, error: 'Dnes už jste poslali 10 vzkazů. Zkuste to zítra, nebo pošlete kolegům odkaz sami.', status: 429 };
  if ((dup || []).length) return { ok: false, error: 'Tomuhle kolegovi už vzkaz odešel. Další pošleme nejdřív za 30 dní.', status: 409 };

  const message = String(input.message || '').replace(/<[^>]+>/g, '').trim().slice(0, 600);
  const token = b64url(randomBytes(18));
  const { error } = await sb.from('referrals').insert({
    inviter_id: input.inviter.id,
    red_izo: staffroom.red_izo,
    invitee_email: email,
    invitee_email_hash: hash,
    token,
    review_flag: email.includes('+') ? 'alias' : null,
  });
  if (error) return { ok: false, error: error.message, status: 500 };

  const inviterName = [input.inviter.first_name, input.inviter.last_name].filter(Boolean).join(' ') || 'Kolega ze školy';
  const joinUrl = `${deps.publicOrigin}/s/${staffroom.code}?r=${encodeURIComponent(token)}`;
  const sent = await deps.sendEmail({
    toEmail: email,
    toName: email,
    subject: `${inviterName}: vzkaz ze sborovny ${school.name}`,
    html: deps.buildColleagueEmailHtml({ inviterName, schoolName: school.name, message, joinUrl }),
  });
  if (!sent) console.warn('[dvpp/staffroom] vzkaz kolegovi se neodeslal');
  await recordFunnelEvent(sb, { event: 'invite_sent', subscriberId: input.inviter.id, email: input.inviter.email, redIzo: staffroom.red_izo });
  return { ok: true };
}

/** Po přihlášení: pokud existuje vzkaz na tento e-mail, potvrdí ho a vrátí inviter id. */
export async function confirmReferralForEmail(sb: SupabaseClient, email: string, subscriberId: string): Promise<{ inviterId: string | null; code: string | null }> {
  const hash = await sha256Hex(String(email).trim().toLowerCase());
  const { data } = await sb
    .from('referrals')
    .select('id, inviter_id, red_izo')
    .eq('invitee_email_hash', hash)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1);
  const r = ((data || [])[0] as { id: string; inviter_id: string; red_izo: string | null } | undefined) ?? null;
  if (!r) return { inviterId: null, code: null };
  await sb.from('referrals').update({
    status: 'confirmed', confirmed_at: nowIso(), confirmed_subscriber_id: subscriberId, invitee_email: null,
  }).eq('id', r.id);
  const sr = r.red_izo ? await getStaffroom(sb, r.red_izo) : null;
  return { inviterId: r.inviter_id, code: sr?.code ?? null };
}
