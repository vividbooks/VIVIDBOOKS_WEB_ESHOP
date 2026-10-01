/**
 * DVPP zdarma — police certifikátů.
 *
 * PDF dál generuje prohlížeč (src/lib/webinarCertificateDocument.ts); tady se osvědčení
 * eviduje (číslo, program, hodiny, lektor), aby ho učitel našel v účtu a ředitel ve výkazu.
 * Osvědčení za záznam vzniká až po dokončeném DVPP dotazníku (KV `webinar_survey_{webinarId}_{md5(email)}`).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import md5 from 'npm:md5';
import * as kv from '../kv_store.tsx';
import { recordFunnelEvent } from './events.ts';
import { activateMember } from './staffroom.ts';
import { enrollDvpp } from './automations.ts';
import type { SubscriberRow } from './shared.ts';

export type CertificateRow = {
  id: string;
  number: string;
  kind: string;
  webinar_id: string | null;
  video_id: string | null;
  series_id: string | null;
  title: string;
  hours: number;
  lecturer: string | null;
  holder_name: string | null;
  issued_at: string;
  pdf_url: string | null;
};

const COLS = 'id, number, kind, webinar_id, video_id, series_id, title, hours, lecturer, holder_name, issued_at, pdf_url';

/** Stejný algoritmus jako v klientu (webinarCertificateDocument.ts): VB-DVPP-{rok}-{6 znaků}. */
export function certificateNumber(programId: string, email: string, year = new Date().getFullYear()): string {
  const h = md5(`${programId}|${email.trim().toLowerCase()}`).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `VB-DVPP-${year}-${h.slice(0, 6)}`;
}

export async function hasCompletedDvppSurvey(webinarId: string, email: string): Promise<boolean> {
  const rec = await kv.get(`webinar_survey_${webinarId}_${md5(email.trim().toLowerCase())}`);
  return !!rec;
}

export async function listCertificates(sb: SupabaseClient, subscriberId: string): Promise<CertificateRow[]> {
  const { data } = await sb.from('certificates').select(COLS).eq('subscriber_id', subscriberId).order('issued_at', { ascending: false });
  return (data || []) as CertificateRow[];
}

export async function issueCertificate(
  sb: SupabaseClient,
  subscriber: SubscriberRow,
  input: {
    kind?: 'dvpp' | 'feedback' | 'series' | 'champion';
    webinarId?: string | null;
    videoId?: string | null;
    seriesId?: string | null;
    title: string;
    hours?: number;
    lecturer?: string | null;
    holderName?: string | null;
    /** Admin/serverové vystavení bez kontroly dotazníku. */
    skipSurveyCheck?: boolean;
  },
): Promise<{ ok: true; certificate: CertificateRow; created: boolean } | { ok: false; error: string; status: number }> {
  const kind = input.kind || 'dvpp';
  const programId = input.seriesId || input.webinarId || input.videoId || '';
  if (!programId || !input.title) return { ok: false, error: 'Chybí program.', status: 400 };

  if (kind === 'dvpp' && !input.skipSurveyCheck) {
    const wid = input.webinarId || input.videoId || '';
    const done = wid ? await hasCompletedDvppSurvey(wid, subscriber.email) : false;
    if (!done) return { ok: false, error: 'Osvědčení se vystaví až po dokončení DVPP dotazníku k záznamu.', status: 409 };
  }

  const number = certificateNumber(programId, subscriber.email);
  const { data: existing } = await sb.from('certificates').select(COLS).eq('number', number).maybeSingle();
  if (existing) return { ok: true, certificate: existing as CertificateRow, created: false };

  const holder = input.holderName || [subscriber.first_name, subscriber.last_name].filter(Boolean).join(' ') || null;
  const { data, error } = await sb.from('certificates').insert({
    subscriber_id: subscriber.id,
    number,
    kind,
    webinar_id: input.webinarId || null,
    video_id: input.videoId || null,
    series_id: input.seriesId || null,
    title: String(input.title).slice(0, 300),
    hours: Number(input.hours) > 0 ? Number(input.hours) : 2,
    lecturer: input.lecturer || null,
    holder_name: holder,
  }).select(COLS).single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const { data: again } = await sb.from('certificates').select(COLS).eq('number', number).maybeSingle();
      if (again) return { ok: true, certificate: again as CertificateRow, created: false };
    }
    return { ok: false, error: error.message, status: 500 };
  }
  await recordFunnelEvent(sb, {
    event: 'certificate', subscriberId: subscriber.id, email: subscriber.email, redIzo: subscriber.school_red_izo,
    meta: { number, kind, programId, hours: input.hours || 2 },
  });
  await activateMember(sb, subscriber.id);
  await enrollDvpp(sb, 'dvpp_certificate', subscriber.id);
  return { ok: true, certificate: data as CertificateRow, created: true };
}

/** Výkaz pro ředitele: hodiny DVPP sboru za období. */
export async function schoolCertificateReport(
  sb: SupabaseClient,
  redIzo: string,
  sinceIso: string,
): Promise<{ teachers: Array<{ name: string; email: string; certificates: number; hours: number }>; totalHours: number; totalCertificates: number }> {
  const { data } = await sb
    .from('certificates')
    .select('hours, holder_name, subscribers!inner(email, first_name, last_name, school_red_izo)')
    .gte('issued_at', sinceIso)
    .eq('subscribers.school_red_izo', redIzo)
    .limit(5000);
  type Row = { hours: number; holder_name: string | null; subscribers: { email: string; first_name: string | null; last_name: string | null } };
  const map = new Map<string, { name: string; email: string; certificates: number; hours: number }>();
  for (const r of (data || []) as unknown as Row[]) {
    const email = r.subscribers.email;
    const cur = map.get(email) || {
      name: r.holder_name || [r.subscribers.first_name, r.subscribers.last_name].filter(Boolean).join(' ') || email,
      email, certificates: 0, hours: 0,
    };
    cur.certificates += 1;
    cur.hours += Number(r.hours) || 0;
    map.set(email, cur);
  }
  const teachers = Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  return {
    teachers,
    totalHours: teachers.reduce((a, t) => a + t.hours, 0),
    totalCertificates: teachers.reduce((a, t) => a + t.certificates, 0),
  };
}
