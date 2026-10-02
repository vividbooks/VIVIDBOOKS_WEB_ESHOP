/**
 * DVPP zdarma — týdenní digest „Nové v knihovně“ jako draft do EmailBuilderu (/mailing/emaily).
 * Draft se uloží do KV `vb:email-draft:{id}` v HTML módu; odeslání zůstává ruční (test → kampaň),
 * podle provozního pravidla „nikdy nerozesílat ostrou kampaň bez pokynu“.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as kv from '../kv_store.tsx';
import { digestSubject, pickNewVideos, type DigestVideo } from './content.ts';
import { getSeries } from './catalog.ts';
import { listTopics } from './votes.ts';

const SITE = 'https://dvppzdarma.cz';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type UpcomingWebinar = { title: string; slug: string; day: number; monthNum: number; year: number; time: string; lecturer?: string };

function upcoming(webinars: Array<Record<string, unknown>>, now: Date): UpcomingWebinar | null {
  const list = webinars
    .filter((w) => !w.isPast && Number.isFinite(Number(w.day)) && Number.isFinite(Number(w.monthNum)) && Number.isFinite(Number(w.year)))
    .map((w) => ({
      title: String(w.title || ''), slug: String(w.slug || w.id || ''), day: Number(w.day), monthNum: Number(w.monthNum), year: Number(w.year),
      time: String(w.time || ''), lecturer: w.lecturer ? String(w.lecturer) : undefined,
      ts: new Date(Number(w.year), Number(w.monthNum) - 1, Number(w.day)).getTime(),
    }))
    .filter((w) => w.ts >= now.getTime() - 86400_000)
    .sort((a, b) => a.ts - b.ts);
  return list[0] || null;
}

const P = 'margin:0 0 12px;font-size:16px;line-height:1.6;color:#333333;';
const H2 = 'margin:26px 0 10px;font-size:20px;line-height:1.3;color:#F06632;font-weight:800;';

function videoCard(v: DigestVideo): string {
  const url = `${SITE}/knihovna/zaznam/${encodeURIComponent(v.id)}`;
  const meta = [v.lecturer, v.durationMinutes ? `${v.durationMinutes} min` : null].filter(Boolean).join(' · ');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px;"><tr>
    <td width="150" valign="top" style="padding-right:12px;">${v.thumbnail ? `<a href="${url}"><img src="${esc(v.thumbnail)}" width="150" alt="" style="display:block;width:150px;border-radius:10px;" /></a>` : ''}</td>
    <td valign="top"><a href="${url}" style="font-size:16px;font-weight:800;color:#001161;text-decoration:none;">${esc(v.name)}</a>${meta ? `<br><span style="font-size:13px;color:#718096;">${esc(meta)}</span>` : ''}<br><a href="${url}" style="font-size:13px;font-weight:700;color:#F06632;">Přehrát a získat osvědčení →</a></td>
  </tr></table>`;
}

export async function buildDigestDraft(
  sb: SupabaseClient,
  input: { videos: DigestVideo[]; webinars: Array<Record<string, unknown>>; now?: Date; sinceDays?: number },
): Promise<{ id: string; subject: string; previewText: string; headline: string; bodyHtml: string; ctaText: string; ctaUrl: string; audience: 'newsletter'; builderMode: 'html'; status: 'draft'; tags: string[] }> {
  const now = input.now || new Date();
  const newVideos = pickNewVideos(input.videos, input.sinceDays ?? 7, now);
  const [series, topics] = await Promise.all([getSeries(), listTopics(sb, null)]);
  const web = upcoming(input.webinars, now);
  const weekLabel = `${now.getDate()}. ${now.getMonth() + 1}.`;

  let body = `<p style="${P}">Dobrý den {{first_name|učiteli}},</p>`;
  body += `<p style="${P}">tady je týdenní přehled z knihovny DVPP zdarma: co přibylo, co se hraje nejvíc a o čem hlasujete.</p>`;

  body += `<h2 style="${H2}">Nové v knihovně</h2>`;
  body += newVideos.map(videoCard).join('');

  const topSeries = series.slice(0, 2);
  if (topSeries.length) {
    body += `<h2 style="${H2}">Řady, které dávají 8 hodin DVPP</h2>`;
    for (const s of topSeries) {
      body += `<p style="${P}"><strong style="color:#001161;">${esc(s.title)}</strong> · ${s.videoIds.length} dílů · ${s.hours} h<br><span style="font-size:14px;color:#4a5568;">${esc(s.description || '')}</span><br><a href="${SITE}/knihovna" style="font-size:13px;font-weight:700;color:#F06632;">Otevřít řadu →</a></p>`;
    }
  }

  if (web) {
    body += `<h2 style="${H2}">Naživo tento týden</h2>`;
    body += `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px;"><tr><td style="background:#001161;border-radius:14px;padding:18px 20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.65);">${web.day}. ${web.monthNum}. ${web.year} · ${esc(web.time)}</p>
      <p style="margin:0 0 12px;font-size:17px;font-weight:800;color:#ffffff;">${esc(web.title)}</p>
      <a href="https://www.vividbooks.com/webinar/${encodeURIComponent(web.slug)}" style="display:inline-block;background:#F06632;color:#ffffff;font-weight:800;font-size:14px;padding:11px 22px;border-radius:100px;text-decoration:none;">Rezervovat místo zdarma</a>
      <p style="margin:12px 0 0;font-size:12px;color:rgba(255,255,255,0.65);">Přiveďte kolegu ze stejné školy a máte rok záznamů.</p>
    </td></tr></table>`;
  }

  const openTopics = topics.filter((t) => t.status === 'open').slice(0, 3);
  if (openTopics.length) {
    body += `<h2 style="${H2}">Natočíme příště: hlasujte</h2>`;
    body += `<ul style="margin:0 0 12px;padding-left:20px;">${openTopics.map((t) => `<li style="${P}"><a href="${SITE}/knihovna#hlasovani" style="color:#001161;font-weight:700;text-decoration:none;">${esc(t.title)}</a> <span style="color:#718096;font-size:13px;">(${t.votes_count} hlasů)</span></li>`).join('')}</ul>`;
  }

  body += `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 0;"><tr><td style="background:#F3F0FF;border-radius:16px;padding:16px 18px;">
    <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#001161;">Vaše sborovna</p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#333333;">Za jednoho kolegu máte celý rok záznamů. Když se přidá třetina sboru, má knihovnu zdarma celá škola. Odkaz sdílíte sami, e-maily kolegů od vás nepotřebujeme.</p>
    <a href="${SITE}/sborovna" style="font-size:14px;font-weight:800;color:#F06632;">Otevřít sborovnu a zkopírovat odkaz →</a>
  </td></tr></table>`;

  const subject = digestSubject(newVideos, weekLabel);
  const id = `dvpp-digest-${now.toISOString().slice(0, 10)}`;
  const draft = {
    id,
    subject,
    previewText: newVideos.length > 1 ? `${newVideos.length} nové záznamy, hlasování a termín naživo.` : 'Nové záznamy, hlasování a termín naživo.',
    headline: 'Nové v knihovně DVPP zdarma',
    bodyHtml: body,
    ctaText: 'Otevřít knihovnu',
    ctaUrl: `${SITE}/knihovna`,
    audience: 'newsletter' as const,
    builderMode: 'html' as const,
    status: 'draft' as const,
    tags: ['dvpp', 'digest'],
  };
  return draft;
}

/** Uloží draft do KV (stejný klíč jako EmailBuilder). `fullHtml` doplní dep z index.tsx (vividbooksEmailTemplate). */
export async function saveDigestDraft(draft: Record<string, unknown>, fullHtml: string): Promise<void> {
  const now = new Date().toISOString();
  const key = `vb:email-draft:${draft.id}`;
  const existing = (await kv.get(key)) as Record<string, unknown> | null;
  await kv.set(key, { ...(existing || {}), ...draft, fullHtml, createdAt: (existing?.createdAt as string) || now, updatedAt: now });
}
