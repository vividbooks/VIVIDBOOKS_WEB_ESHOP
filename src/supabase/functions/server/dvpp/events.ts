/**
 * DVPP zdarma — události funnelu.
 *
 * `funnel_events` v Postgresu je jediný zdroj pravdy pro KPI strom. Meta Conversions API
 * a GA4 Measurement Protocol dostávají kopii (server-side, hashované PII), aby šly
 * optimalizovat kampaně na „potvrzený kontakt“ místo na formulář.
 *
 * Secrets (volitelné; bez nich se jen zapisuje do DB):
 *   META_PIXEL_ID, META_CAPI_TOKEN, META_TEST_EVENT_CODE
 *   GA4_MEASUREMENT_ID, GA4_API_SECRET
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sha256Hex, type Attribution } from './shared.ts';

export type FunnelEventName =
  | 'visit'
  | 'lead'              // e-mail zadán (magic link vyžádán / registrace)
  | 'confirmed'         // double opt-in / první přihlášení potvrzeno
  | 'profile_done'      // kvíz Jaký jste učitel dokončen
  | 'school_linked'     // kontakt má RED_IZO
  | 'play'              // přehrání záznamu (≥ 3 min = aktivace)
  | 'certificate'
  | 'staffroom_created'
  | 'invite_shared'     // odkaz/kód sdílen (klik na sdílení)
  | 'invite_sent'       // vzkaz kolegovi odeslán (WP29 režim)
  | 'invite_confirmed'  // kolega se přihlásil přes odkaz/kód
  | 'staffroom_unlocked'
  | 'staffroom_grace'
  | 'vote'
  | 'director_unlock'
  | 'webinar_registered';

export type FunnelEventInput = {
  event: FunnelEventName | string;
  subscriberId?: string | null;
  email?: string | null;
  redIzo?: string | null;
  attribution?: Attribution | null;
  meta?: Record<string, unknown>;
  /** Pro Meta CAPI (event_source_url, client_ip, user_agent). */
  request?: { url?: string; ip?: string | null; userAgent?: string | null } | null;
  /** Deduplikace s browser pixelem (stejné event_id). */
  eventId?: string | null;
};

const META_EVENT_MAP: Record<string, string> = {
  lead: 'Lead',
  confirmed: 'CompleteRegistration',
  profile_done: 'Subscribe',
  play: 'ViewContent',
  certificate: 'Certificate',
  invite_shared: 'InviteShared',
  invite_sent: 'InviteSent',
  invite_confirmed: 'InviteAccepted',
  staffroom_unlocked: 'SchoolMilestone',
  webinar_registered: 'Schedule',
};

export async function recordFunnelEvent(sb: SupabaseClient, input: FunnelEventInput): Promise<void> {
  const email = input.email ? String(input.email).trim().toLowerCase() : '';
  const emailHash = email ? await sha256Hex(email) : null;
  const a = input.attribution || {};
  try {
    const { error } = await sb.from('funnel_events').insert({
      event: String(input.event).slice(0, 60),
      subscriber_id: input.subscriberId || null,
      email_hash: emailHash,
      red_izo: input.redIzo || null,
      source: a.source || null,
      medium: a.medium || null,
      campaign: a.campaign || null,
      content: a.content || null,
      referrer_id: a.referrerId || null,
      session_key: a.sessionKey || null,
      meta: input.meta && typeof input.meta === 'object' ? input.meta : {},
    });
    if (error) console.warn('[dvpp/events] insert', error.message);
  } catch (e) {
    console.warn('[dvpp/events] insert threw', e instanceof Error ? e.message : e);
  }

  /* Kopie do reklamních platforem — nikdy neblokuje odpověď uživateli. */
  await Promise.allSettled([
    forwardToMeta(input, emailHash),
    forwardToGa4(input, emailHash),
  ]);
}

async function forwardToMeta(input: FunnelEventInput, emailHash: string | null): Promise<void> {
  const pixelId = Deno.env.get('META_PIXEL_ID')?.trim();
  const token = Deno.env.get('META_CAPI_TOKEN')?.trim();
  if (!pixelId || !token) return;
  const name = META_EVENT_MAP[String(input.event)];
  if (!name) return;
  const testCode = Deno.env.get('META_TEST_EVENT_CODE')?.trim();
  const userData: Record<string, unknown> = {};
  if (emailHash) userData.em = [emailHash];
  if (input.request?.ip) userData.client_ip_address = input.request.ip;
  if (input.request?.userAgent) userData.client_user_agent = input.request.userAgent;
  const body = {
    data: [{
      event_name: name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: input.request?.url || undefined,
      event_id: input.eventId || undefined,
      user_data: userData,
      custom_data: { ...(input.meta || {}), red_izo: input.redIzo || undefined },
    }],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) console.warn('[dvpp/events] meta capi', res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.warn('[dvpp/events] meta capi threw', e instanceof Error ? e.message : e);
  }
}

async function forwardToGa4(input: FunnelEventInput, emailHash: string | null): Promise<void> {
  const mid = Deno.env.get('GA4_MEASUREMENT_ID')?.trim();
  const secret = Deno.env.get('GA4_API_SECRET')?.trim();
  if (!mid || !secret) return;
  const clientId = input.attribution?.sessionKey || emailHash?.slice(0, 32) || 'server';
  const body = {
    client_id: clientId,
    ...(input.subscriberId ? { user_id: input.subscriberId } : {}),
    events: [{
      name: `dvpp_${String(input.event).replace(/[^a-z0-9_]/gi, '_')}`.slice(0, 40),
      params: {
        ...(input.redIzo ? { school_id: input.redIzo } : {}),
        ...(input.attribution?.source ? { source: input.attribution.source } : {}),
        ...(input.attribution?.campaign ? { campaign: input.attribution.campaign } : {}),
        engagement_time_msec: 1,
      },
    }],
  };
  try {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(mid)}&api_secret=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
    });
  } catch (e) {
    console.warn('[dvpp/events] ga4 mp threw', e instanceof Error ? e.message : e);
  }
}

/** Kontext požadavku pro CAPI (IP, UA, URL) z Hono requestu. */
export function requestContext(req: Request): { url: string; ip: string | null; userAgent: string | null } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || null;
  return { url: req.headers.get('referer') || req.url, ip, userAgent: req.headers.get('user-agent') };
}

/** Souhrn pro dashboard: počty událostí po dnech a typech za N dní. */
export async function funnelSummary(sb: SupabaseClient, days = 30): Promise<{
  byEvent: Record<string, number>;
  byDay: Array<{ day: string; event: string; count: number }>;
}> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await sb
    .from('funnel_events')
    .select('event, created_at')
    .gte('created_at', since)
    .limit(50000);
  const byEvent: Record<string, number> = {};
  const byDayMap = new Map<string, number>();
  for (const row of (data || []) as Array<{ event: string; created_at: string }>) {
    byEvent[row.event] = (byEvent[row.event] || 0) + 1;
    const day = String(row.created_at).slice(0, 10);
    const k = `${day}|${row.event}`;
    byDayMap.set(k, (byDayMap.get(k) || 0) + 1);
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([k, count]) => { const [day, event] = k.split('|'); return { day, event, count }; })
    .sort((a, b) => a.day.localeCompare(b.day));
  return { byEvent, byDay };
}
