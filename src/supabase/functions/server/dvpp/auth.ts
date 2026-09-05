/**
 * DVPP zdarma — přihlášení magic linkem (bez hesla).
 *
 * 1. POST /dvpp/auth/magic-link  { email, name?, next?, newsletter?, utm… }
 *    → kontakt v `subscribers` (nový = pending, source dvpp), podepsaný token (24 h), e-mail s odkazem
 * 2. GET  /dvpp/auth/verify?token=  → pending → subscribed (double opt-in v jednom kroku),
 *    vznikne session (token zná jen prohlížeč, v DB je sha256), vrátí { sessionToken, next }
 * 3. další požadavky posílají hlavičku `X-Dvpp-Session: <token>`
 *
 * Odhlášený kontakt se přihlásit smí (knihovna ≠ newsletter); zpět na `subscribed` jde
 * jen s výslovným souhlasem (`newsletter: true` při vyžádání odkazu).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { upsertSubscriber } from '../subscribersUpsert.ts';
import { createMailingToken, verifyMailingToken } from '../mailingTokens.ts';
import * as kv from '../kv_store.tsx';
import {
  addDaysIso, b64url, firstLast, getSubscriberByEmail, getSubscriberById, isEmail, normEmail, nowIso,
  randomBytes, sha256Hex, type Attribution, type SubscriberRow,
} from './shared.ts';

export const SESSION_HEADER = 'X-Dvpp-Session';
const SESSION_DAYS = 180;
const LINK_HOURS = 24;

type LoginIntent = {
  next: string;
  newsletter: boolean;
  name: string;
  attribution: Attribution;
  staffroomCode: string | null;
  createdAt: string;
};

function intentKey(email: string): string {
  return `dvpp_login_intent_${email}`;
}

export type MagicLinkDeps = {
  sendEmail: (opts: { toEmail: string; toName: string; subject: string; html: string }) => Promise<boolean>;
  buildLoginEmailHtml: (opts: { firstName: string; loginUrl: string; isNew: boolean }) => string;
  publicOrigin: string;
  functionBase: string;
};

export async function requestMagicLink(
  sb: SupabaseClient,
  deps: MagicLinkDeps,
  input: {
    email: string;
    name?: string;
    next?: string;
    newsletter?: boolean;
    staffroomCode?: string | null;
    attribution: Attribution;
  },
): Promise<{ ok: true; created: boolean; subscriberId: string } | { ok: false; error: string; status: number }> {
  const email = normEmail(input.email);
  if (!isEmail(email)) return { ok: false, error: 'Zadejte platný e-mail.', status: 400 };

  const { first, last } = firstLast(input.name || '');
  const up = await upsertSubscriber(sb, {
    email,
    firstName: first || null,
    lastName: last || null,
    source: 'dvpp',
    contactType: 'teacher',
    status: 'pending',
    tags: ['dvpp-knihovna'],
  });
  if (!up.ok) return { ok: false, error: up.error, status: 500 };

  const intent: LoginIntent = {
    next: safeNext(input.next),
    newsletter: input.newsletter === true,
    name: String(input.name || '').trim().slice(0, 120),
    attribution: input.attribution,
    staffroomCode: input.staffroomCode || null,
    createdAt: nowIso(),
  };
  await kv.set(intentKey(email), intent);

  const token = await createMailingToken('dvpp-login', email, LINK_HOURS / 24);
  const loginUrl = `${deps.publicOrigin}/knihovna/prihlaseni?token=${encodeURIComponent(token)}`;
  const sent = await deps.sendEmail({
    toEmail: email,
    toName: input.name || email,
    subject: up.created ? 'Váš vstup do knihovny DVPP zdarma' : 'Přihlášení do knihovny DVPP zdarma',
    html: deps.buildLoginEmailHtml({ firstName: first, loginUrl, isNew: up.created }),
  });
  if (!sent) console.warn('[dvpp/auth] login e-mail se neodeslal', email);
  return { ok: true, created: up.created, subscriberId: up.subscriberId };
}

function safeNext(next: unknown): string {
  const n = String(next || '').trim();
  if (!n.startsWith('/') || n.startsWith('//')) return '/knihovna';
  return n.slice(0, 300);
}

export type VerifyResult =
  | { ok: true; sessionToken: string; subscriber: SubscriberRow; next: string; intent: LoginIntent | null; firstLogin: boolean }
  | { ok: false; error: string; status: number };

export async function verifyMagicLink(
  sb: SupabaseClient,
  token: string,
  userAgent: string | null,
): Promise<VerifyResult> {
  const v = await verifyMailingToken('dvpp-login', String(token || ''));
  if (!v.ok) return { ok: false, error: v.error, status: 400 };
  const email = v.email;
  const intent = ((await kv.get(intentKey(email))) as LoginIntent | null) ?? null;

  let sub = await getSubscriberByEmail(sb, email);
  if (!sub) {
    const up = await upsertSubscriber(sb, { email, source: 'dvpp', contactType: 'teacher', status: 'pending', tags: ['dvpp-knihovna'] });
    if (!up.ok) return { ok: false, error: up.error, status: 500 };
    sub = await getSubscriberById(sb, up.subscriberId);
    if (!sub) return { ok: false, error: 'Kontakt se nepodařilo založit.', status: 500 };
  }

  /* pending → subscribed (klik v e-mailu = potvrzení). Odhlášený jen s výslovným souhlasem. */
  const patch: Record<string, unknown> = { dvpp_last_login_at: nowIso() };
  const firstLogin = !sub.dvpp_first_login_at;
  if (firstLogin) patch.dvpp_first_login_at = nowIso();
  if (sub.status === 'pending' || (sub.status === 'unsubscribed' && intent?.newsletter)) {
    patch.status = 'subscribed';
    patch.subscribed_at = nowIso();
    patch.unsubscribed_at = null;
    patch.merge_fields = {
      ...(sub.merge_fields || {}),
      consent_version: 'dvpp-knihovna-2026-09',
      consented_at: nowIso(),
    };
  }
  await sb.from('subscribers').update(patch).eq('id', sub.id);

  const raw = b64url(randomBytes(32));
  const tokenHash = await sha256Hex(raw);
  const { error } = await sb.from('dvpp_sessions').insert({
    subscriber_id: sub.id,
    token_hash: tokenHash,
    expires_at: addDaysIso(SESSION_DAYS),
    last_seen_at: nowIso(),
    user_agent: userAgent ? userAgent.slice(0, 300) : null,
  });
  if (error) return { ok: false, error: error.message, status: 500 };
  await kv.del(intentKey(email)).catch(() => {});

  const fresh = (await getSubscriberById(sb, sub.id)) ?? sub;
  return { ok: true, sessionToken: raw, subscriber: fresh, next: intent?.next || '/knihovna', intent, firstLogin };
}

/** Přihlášený kontakt ze session hlavičky, nebo null. Aktualizuje last_seen nejvýš 1× za hodinu. */
export async function getSessionSubscriber(sb: SupabaseClient, req: Request): Promise<SubscriberRow | null> {
  const raw = req.headers.get(SESSION_HEADER)?.trim() || new URL(req.url).searchParams.get('session')?.trim() || '';
  if (!raw || raw.length < 20) return null;
  const hash = await sha256Hex(raw);
  const { data } = await sb
    .from('dvpp_sessions')
    .select('id, subscriber_id, expires_at, last_seen_at, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle();
  const s = data as { id: string; subscriber_id: string; expires_at: string; last_seen_at: string | null; revoked_at: string | null } | null;
  if (!s || s.revoked_at) return null;
  if (Date.parse(s.expires_at) < Date.now()) return null;
  const lastSeen = s.last_seen_at ? Date.parse(s.last_seen_at) : 0;
  if (Date.now() - lastSeen > 3600_000) {
    await sb.from('dvpp_sessions').update({ last_seen_at: nowIso() }).eq('id', s.id);
  }
  return getSubscriberById(sb, s.subscriber_id);
}

export async function revokeSession(sb: SupabaseClient, req: Request): Promise<void> {
  const raw = req.headers.get(SESSION_HEADER)?.trim() || '';
  if (!raw) return;
  const hash = await sha256Hex(raw);
  await sb.from('dvpp_sessions').update({ revoked_at: nowIso() }).eq('token_hash', hash);
}
