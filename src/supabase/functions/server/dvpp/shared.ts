/**
 * DVPP zdarma — sdílené pomocné funkce serverových modulů (Deno / Edge funkce).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

let cached: SupabaseClient | null = null;

/** Service-role klient pro Postgres (subscribers, schools, staffrooms, …). */
export function sbService(): SupabaseClient {
  if (cached) return cached;
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !key) throw new Error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function normEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function icoDigits(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  return /^\d{8}$/.test(d) ? d : null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * 86400_000).toISOString();
}

export function firstLast(name: string): { first: string; last: string } {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

/** Minimální podoba kontaktu, se kterou moduly pracují. */
export type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: 'subscribed' | 'pending' | 'unsubscribed' | 'cleaned';
  position_label: string | null;
  school_name: string | null;
  ico: string | null;
  is_customer: boolean | null;
  school_red_izo: string | null;
  teacher_type: string | null;
  referred_by: string | null;
  dvpp_profile: Record<string, unknown> | null;
  subject_interest_scores: Record<string, number> | null;
  merge_fields: Record<string, unknown> | null;
  dvpp_first_login_at: string | null;
  dvpp_last_login_at: string | null;
};

export const SUBSCRIBER_COLUMNS =
  'id, email, first_name, last_name, status, position_label, school_name, ico, is_customer, school_red_izo, teacher_type, referred_by, dvpp_profile, subject_interest_scores, merge_fields, dvpp_first_login_at, dvpp_last_login_at';

export async function getSubscriberById(sb: SupabaseClient, id: string): Promise<SubscriberRow | null> {
  const { data } = await sb.from('subscribers').select(SUBSCRIBER_COLUMNS).eq('id', id).maybeSingle();
  return (data as SubscriberRow | null) ?? null;
}

export async function getSubscriberByEmail(sb: SupabaseClient, email: string): Promise<SubscriberRow | null> {
  const { data } = await sb.from('subscribers').select(SUBSCRIBER_COLUMNS).eq('email', normEmail(email)).maybeSingle();
  return (data as SubscriberRow | null) ?? null;
}

/** UTM + anonymní klíč z těla požadavku / query — sjednocený tvar pro funnel_events. */
export type Attribution = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  sessionKey?: string | null;
  referrerId?: string | null;
};

export function attributionFrom(obj: Record<string, unknown> | null | undefined): Attribution {
  const o = obj || {};
  const pick = (k: string) => {
    const v = o[k] ?? o[`utm_${k}`];
    const s = String(v ?? '').trim().slice(0, 120);
    return s || null;
  };
  return {
    source: pick('source'),
    medium: pick('medium'),
    campaign: pick('campaign'),
    content: pick('content'),
    sessionKey: String(o.sessionKey ?? o.vb_id ?? '').trim().slice(0, 80) || null,
    referrerId: String(o.referrerId ?? '').trim() || null,
  };
}

export type JsonBody = Record<string, unknown>;

export async function readJson(req: Request): Promise<JsonBody> {
  try {
    const j = await req.json();
    return j && typeof j === 'object' ? (j as JsonBody) : {};
  } catch {
    return {};
  }
}
