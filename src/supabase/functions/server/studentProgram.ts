/**
 * Studentský program Vividbooks — studenti učitelství dostanou přístup zdarma
 * po dobu studia (+ 6 měsíců po něm).
 *
 * Co modul dělá:
 *  - veřejná registrace (`/student-program/register`) → ověřovací e-mail na univerzitní adresu
 *  - ověření (`/student-program/verify`) → kódy fakulty (legacy free-trial API nebo ručně
 *    z adminu), uvítací e-mail, zápis do subscribers, událost
 *  - self-service aktualizace (`/student-program/me`, `/student-program/update`) — student
 *    potvrdí, že ještě studuje, nahlásí konec studia, školu, kam nastoupil, telefon
 *  - admin API (`/admin/student-program/*`) — přehled, CRM studentů, fakulty, kontakty,
 *    oslovení fakult, cíle, export
 *  - cron (`/cron/student-program`) — půlroční check-iny, přechody stavů, denní digest
 *
 * Datový model: migrace 20260903120000_student_program.sql. Seznam fakult:
 * supabase/functions/_shared/student-program-faculties.ts.
 *
 * Princip kódů: **každý student má vlastní organizaci a vlastní kódy v Kabinetu**
 * (registr Vividbooks Ultra, hooky `/api/registr/hooks/web/*`). Při ověření univerzitního
 * e-mailu se zavolá `create-school` (bez trialu) a hned `create-subscription-licence` na
 * 12 měsíců (bundle všech předmětů, individuální licence). **Každý rok** student přístup
 * obnoví kliknutím na odkaz, který přijde na univerzitní e-mail — tím prokáže, že adresu
 * pořád má. Obnovení = další `create-subscription-licence` na rok. Bez obnovení přístup
 * po ochranné lhůtě skončí.
 */
import type { Context, Hono } from 'npm:hono';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import {
  facultyLabel,
  graduationMonthToDate,
  matchUniversityEmail,
  STUDENT_PROGRAM_FACULTIES,
  STUDENT_PROGRAM_GRACE_MONTHS,
  type StudentProgramFaculty,
} from '../../../../supabase/functions/_shared/student-program-faculties.ts';
import {
  buildVividbooksBrandCta,
  buildVividbooksBrandShell,
} from '../../../../supabase/functions/_shared/email-brand-shell.ts';
import { EMAIL_FORCE_LIGHT_HEAD } from '../../../../supabase/functions/_shared/email-force-light.ts';
import { requireAdminJwt } from '../../../../supabase/functions/_shared/admin-auth.ts';

const FN = '/make-server-93a20b6f';
const PUBLIC_PREFIX = `${FN}/student-program`;
const ADMIN_PREFIX = `${FN}/admin/student-program`;
const CRON_PATH = `${FN}/cron/student-program`;

const KV_GOALS = 'student_program_goals';
const KV_SETTINGS = 'student_program_settings';

const DAY_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_RESEND_MIN_MS = 2 * 60 * 1000;
const VERIFICATION_LINK_TTL_MS = 7 * DAY_MS;
/** Kabinet (registr Ultra) — stejná tajemství jako Edge funkce `kabinet-trial`. */
const DEFAULT_KABINET_BASE = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/registr/hooks/web';
const DEFAULT_KABINET_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGl1dnFnbHNteGRzbnlhemloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjU3NDAsImV4cCI6MjA4NjQwMTc0MH0.lVO7a-wuM2vkqsJcgqvLkthTmrt5g0R3U_Tu0jU7bfY';

export type StudentProgramDeps = {
  serviceClient: () => SupabaseClient | null;
  publicSiteOrigin: () => string;
  /** Kontrola formátu + MX — stejná jako u trial formuláře. */
  assertEmailDeliverable?: (email: string) => Promise<{ ok: boolean; message?: string }>;
  /** Zápis do vlastního mailingu (subscribers) — neblokující. */
  upsertSubscriber?: (
    supabase: SupabaseClient,
    input: Record<string, unknown>,
  ) => Promise<{ ok: true; subscriberId: string } | { ok: false; error: string }>;
};

/* ── nastavení a cíle (KV) ─────────────────────────────────────────────────── */

export type StudentProgramGoals = {
  /** Cílový počet aktivních studentů k `targetDate`. */
  targetStudents: number;
  targetDate: string;
  /** Kolik z 9 pedagogických fakult má mít aspoň jednoho aktivního studenta. */
  targetPedfCoverage: number;
  /** Kolik fakult má být ve stavu partner (oficiální spolupráce / rozeslání studentům). */
  targetFacultyPartners: number;
  /** Podíl studentů, kteří v check-inu potvrdí, že Vividbooks používají (%). */
  targetActiveShare: number;
  /** Podíl absolventů, u kterých známe školu, kam nastoupili (%). */
  targetAlumniSchoolKnown: number;
  note?: string;
};

export const DEFAULT_GOALS: StudentProgramGoals = {
  targetStudents: 300,
  targetDate: '2027-06-30',
  targetPedfCoverage: 9,
  targetFacultyPartners: 5,
  targetActiveShare: 50,
  targetAlumniSchoolKnown: 60,
  note: 'První akademický rok programu — sbíráme data o tom, které fakulty reagují a jak studenti materiály používají.',
};

export type StudentProgramSettings = {
  /** Zakládat kódy a licenci v Kabinetu automaticky při ověření (jinak vkládá admin ručně). */
  autoIssueCodes: boolean;
  /** Délka studentské licence v měsících (výchozí rok). */
  licenceMonths: number;
  /** Individuální licence = přihlášení jen z jednoho zařízení najednou (brání sdílení kódů). */
  individualLicence: boolean;
  /** Kolik dní před koncem poslat první výzvu k obnovení. */
  renewalReminderDays: number;
  /** Kolik dní po konci ještě jde obnovit, než přístup přejde do `expired`. */
  renewalGraceDays: number;
  /** Kam chodí denní digest (nové registrace, obnovení, absolventi, studenti bez kódů). Prázdné = neposílat. */
  digestEmail: string;
  /** Jméno odesílatele u oslovení fakult. */
  outreachFromName: string;
  outreachReplyTo: string;
};

export const DEFAULT_SETTINGS: StudentProgramSettings = {
  autoIssueCodes: true,
  licenceMonths: 12,
  individualLicence: true,
  renewalReminderDays: 30,
  renewalGraceDays: 30,
  digestEmail: 'vitek@vividbooks.com',
  outreachFromName: 'Vítek Škop (Vividbooks)',
  outreachReplyTo: 'vitek@vividbooks.com',
};

async function readGoals(): Promise<StudentProgramGoals> {
  const saved = (await kv.get(KV_GOALS)) as Partial<StudentProgramGoals> | null;
  return { ...DEFAULT_GOALS, ...(saved || {}) };
}

async function readSettings(): Promise<StudentProgramSettings> {
  const saved = (await kv.get(KV_SETTINGS)) as Partial<StudentProgramSettings> | null;
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

/* ── helpery ───────────────────────────────────────────────────────────────── */

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function cleanEmail(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function cleanText(v: unknown, max = 200): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanPhone(v: unknown): string {
  const raw = String(v ?? '').replace(/[^\d+ ]/g, '').trim();
  return raw.slice(0, 32);
}

function cleanStringArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => cleanText(x, 60)).filter(Boolean).slice(0, max);
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/** ISO datum + N měsíců (přetečení dne srovná na konec měsíce). */
function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, d));
  if (target.getUTCMonth() !== (((m - 1 + months) % 12) + 12) % 12) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

/** ISO → d/m/Y, jak chce starý API přes Kabinet. */
function legacyDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS);
}

function fmtCzDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function firstNameOf(s: { first_name?: string | null }): string {
  return String(s.first_name || '').trim();
}

function greeting(s: { first_name?: string | null }): string {
  const fn = firstNameOf(s);
  return fn ? `Dobrý den, ${esc(fn)},` : 'Dobrý den,';
}

/** Studenti tykají si mezi sebou, my jim vykáme — ale vřele. */
function siteUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/* ── Mandrill (transakční e-maily, stejné nastavení jako zbytek serveru) ──────── */

async function sendMandrill(opts: {
  toEmail: string;
  toName?: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
  tags?: string[];
}): Promise<{ ok: boolean; detail?: string }> {
  const key = Deno.env.get('MANDRILL_API_KEY');
  if (!key) return { ok: false, detail: 'MANDRILL_API_KEY missing' };
  try {
    const res = await fetch('https://mandrillapp.com/api/1.0/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        message: {
          html: opts.html,
          subject: opts.subject,
          from_email: 'hello@vividbooks.com',
          from_name: opts.fromName || 'Vividbooks',
          to: [{ email: opts.toEmail, name: opts.toName || '', type: 'to' }],
          headers: { 'Reply-To': opts.replyTo || 'hello@vividbooks.com' },
          track_opens: true,
          track_clicks: false,
          tags: ['student-program', ...(opts.tags || [])].slice(0, 10),
        },
      }),
    });
    const body = await res.json().catch(() => null);
    const first = Array.isArray(body) ? body[0] : null;
    const status = first?.status;
    if (!res.ok || (status && status !== 'sent' && status !== 'queued' && status !== 'scheduled')) {
      return { ok: false, detail: `${res.status} ${status || ''} ${first?.reject_reason || ''}`.trim() };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/* ── e-mailové šablony ─────────────────────────────────────────────────────── */

function shell(title: string, content: string, headerSubtitle?: string): string {
  return buildVividbooksBrandShell({
    title,
    headerSubtitle: headerSubtitle ?? 'Studentský program',
    content,
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
  });
}

function p(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;">${html}</p>`;
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#001161;">${esc(text)}</h2>`;
}

function codeBox(label: string, code: string): string {
  return `<td style="padding:6px;"><div style="border:1px solid rgba(0,17,97,0.12);border-radius:14px;padding:12px 16px;background:#fbfbfd;">
<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(0,17,97,0.5);margin-bottom:4px;">${esc(label)}</div>
<div style="font-family:Menlo,Consolas,monospace;font-size:20px;font-weight:700;color:#001161;letter-spacing:0.06em;">${esc(code)}</div>
</div></td>`;
}

type StudentRow = Record<string, unknown> & {
  id: string;
  university_email: string;
  personal_email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  faculty_id: string | null;
  status: string;
  expected_graduation: string | null;
  access_valid_until: string | null;
  access_extended_until: string | null;
  access_token: string | null;
  teacher_code: string | null;
  student_code: string | null;
  codes_issued_at: string | null;
  codes_valid_until: string | null;
  next_checkin_at: string | null;
  checkin_count: number;
  renewal_token: string | null;
  renewal_sent_at: string | null;
  renewal_stage: number;
  renewal_count: number;
  renewed_at: string | null;
  legacy_admin_link: string | null;
};

type FacultyRow = Record<string, unknown> & {
  id: string;
  university: string;
  university_short: string;
  faculty: string;
  faculty_short: string;
  ico: string | null;
  kind: 'pedf' | 'other';
  email_domains: string[];
  outreach_status: string;
  estimated_students: number | null;
  is_active: boolean;
};

function verificationEmail(origin: string, s: StudentRow, token: string, fac: FacultyRow | null): { subject: string; html: string } {
  const link = siteUrl(origin, `/studenti?t=${encodeURIComponent(token)}`);
  const content = [
    h2('Potvrďte svůj univerzitní e-mail'),
    p(greeting(s)),
    p(
      `děkujeme za zájem o Vividbooks pro studenty učitelství${fac ? ` na ${esc(facultyLabel({ facultyShort: fac.faculty_short, faculty: fac.faculty, universityShort: fac.university_short }))}` : ''}. Zbývá jediný krok: potvrdit, že tenhle e-mail je váš.`,
    ),
    `<p style="margin:24px 0;text-align:center;">${buildVividbooksBrandCta(link, 'Potvrdit e-mail a získat přístup')}</p>`,
    p(`<span style="color:#64748b;font-size:13px;">Odkaz platí 7 dní. Když jste o přístup nežádali, e-mail klidně ignorujte.</span>`),
  ].join('');
  return { subject: 'Potvrďte e-mail a získejte Vividbooks zdarma', html: shell('Potvrzení e-mailu', content) };
}

function codesEmail(origin: string, s: StudentRow, fac: FacultyRow | null, until: string | null): { subject: string; html: string } {
  const appLink = siteUrl(origin, '/otevrit');
  const meLink = s.access_token ? siteUrl(origin, `/studenti/aktualizace?t=${encodeURIComponent(s.access_token)}`) : siteUrl(origin, '/studenti');
  const codes =
    s.teacher_code && s.student_code
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr>${codeBox('Kód pro učitele', s.teacher_code)}${codeBox('Kód pro žáka', s.student_code)}</tr></table>`
      : p(`<strong>Přístupové kódy vám pošleme zvlášť</strong> — zakládáme je ručně a ozveme se do dvou pracovních dnů.`);
  const content = [
    h2('Vítejte ve Vividbooks'),
    p(greeting(s)),
    p(
      `váš přístup je aktivní. Používejte stejné materiály, se kterými učí přes 600 základních škol: knihovnu lekcí a pracovních listů, vividboard, procvičování a editory pro vlastní materiály.`,
    ),
    codes,
    p(
      `<strong>Jak začít:</strong> otevřete aplikaci, zvolte přihlášení kódem školy a zadejte <em>kód pro učitele</em>. Kód pro žáka použijte, když si chcete vyzkoušet, co uvidí děti (na druhém zařízení nebo v anonymním okně).`,
    ),
    `<p style="margin:24px 0;text-align:center;">${buildVividbooksBrandCta(appLink, 'Otevřít aplikaci')}</p>`,
    until ? p(`Přístup platí do <strong>${esc(fmtCzDate(until))}</strong>. Měsíc před koncem vám na univerzitní e-mail přijde odkaz — kliknutím přístup obnovíte na další rok, dokud studujete. Údaje si kdykoli upravíte tady: <a href="${esc(meLink)}" style="color:#001161;">moje studium</a>.`) : '',
    fac
      ? p(`<span style="color:#64748b;font-size:13px;">Fakulta: ${esc(fac.faculty)} — ${esc(fac.university)}</span>`)
      : '',
  ].join('');
  return { subject: 'Váš přístup do Vividbooks je aktivní', html: shell('Přístup aktivní', content) };
}

function renewalEmail(origin: string, s: StudentRow, token: string, until: string | null, stage: number): { subject: string; html: string } {
  const link = siteUrl(origin, `/studenti/obnovit?t=${encodeURIComponent(token)}`);
  const when = until ? fmtCzDate(until) : '';
  const past = !!until && until < todayIso();
  const headline = past ? 'Váš studentský přístup skončil — obnovte ho' : stage >= 2 ? 'Za pár dní končí váš přístup do Vividbooks' : 'Obnovte si Vividbooks na další rok';
  const content = [
    h2(headline),
    p(greeting(s)),
    p(
      past
        ? `studentský přístup do Vividbooks skončil ${esc(when)}. Nic není ztraceno: pokud ještě studujete, stačí kliknout níže a přístup se obnoví na další rok — se stejnými kódy.`
        : `váš studentský přístup do Vividbooks platí do <strong>${esc(when)}</strong>. Pokud ještě studujete, obnovte ho jedním kliknutím na další rok — kódy zůstávají stejné.`,
    ),
    `<p style="margin:24px 0;text-align:center;">${buildVividbooksBrandCta(link, 'Ještě studuji — obnovit přístup')}</p>`,
    p(`<span style="color:#64748b;font-size:13px;">Odkaz posíláme na univerzitní adresu, protože tím ověříme, že jste stále student. Když jste studium dokončili, dejte nám vědět přes odkaz níže — rádi vaší škole ukážeme Vividbooks.</span>`),
    s.access_token ? p(`<a href="${esc(siteUrl(origin, `/studenti/aktualizace?t=${encodeURIComponent(s.access_token)}`))}" style="color:#001161;font-size:13px;">Dostudoval/a jsem — kam nastupuji</a>`) : '',
  ].join('');
  return { subject: past ? 'Obnovte si studentský přístup do Vividbooks' : `Vividbooks: obnovte přístup do ${when}`, html: shell('Roční obnovení', content) };
}

/** Kopie na osobní e-mail — jen upozornění, odkaz je v univerzitní schránce. */
function renewalHeadsUpEmail(s: StudentRow, until: string | null): { subject: string; html: string } {
  const content = [
    h2('Zkontrolujte univerzitní schránku'),
    p(greeting(s)),
    p(`na váš univerzitní e-mail <strong>${esc(s.university_email)}</strong> jsme poslali odkaz k ročnímu obnovení přístupu do Vividbooks${until ? ` (platí do ${esc(fmtCzDate(until))})` : ''}. Stačí na něj kliknout.`),
    p(`<span style="color:#64748b;font-size:13px;">Nemáte už k univerzitní schránce přístup? Napište nám na hello@vividbooks.com a domluvíme se.</span>`),
  ].join('');
  return { subject: 'Vividbooks: odkaz k obnovení je ve vaší univerzitní schránce', html: shell('Roční obnovení', content) };
}

function renewedEmail(origin: string, s: StudentRow, until: string | null): { subject: string; html: string } {
  const appLink = siteUrl(origin, '/otevrit');
  const content = [
    h2('Přístup obnoven na další rok'),
    p(greeting(s)),
    p(`děkujeme za potvrzení. Váš studentský přístup do Vividbooks teď platí do <strong>${esc(until ? fmtCzDate(until) : '')}</strong>. Kódy zůstávají stejné.`),
    s.teacher_code && s.student_code
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr>${codeBox('Kód pro učitele', s.teacher_code)}${codeBox('Kód pro žáka', s.student_code)}</tr></table>`
      : '',
    `<p style="margin:24px 0;text-align:center;">${buildVividbooksBrandCta(appLink, 'Otevřít aplikaci')}</p>`,
  ].join('');
  return { subject: 'Vividbooks: přístup obnoven na další rok', html: shell('Přístup obnoven', content) };
}

function expiredEmail(origin: string, s: StudentRow): { subject: string; html: string } {
  const trialLink = siteUrl(origin, '/vyzkousejte');
  const studentLink = siteUrl(origin, '/studenti');
  const content = [
    h2('Studentský přístup skončil'),
    p(greeting(s)),
    p(`váš studentský přístup do Vividbooks skončil, protože nebyl obnoven. Děkujeme, že jste s námi byli — a doufáme, že se materiály osvědčily.`),
    p(`Ještě studujete? Zaregistrujte se znovu univerzitním e-mailem na <a href="${esc(studentLink)}" style="color:#001161;">vividbooks.com/studenti</a>. Učíte? Vaše škola může Vividbooks vyzkoušet zdarma a poté objednat licenci pro celý sbor — napište nám na hello@vividbooks.com, rádi připravíme kalkulaci.`),
    `<p style="margin:24px 0;text-align:center;">${buildVividbooksBrandCta(trialLink, 'Vyzkoušet Vividbooks se školou')}</p>`,
  ].join('');
  return { subject: 'Váš studentský přístup do Vividbooks skončil', html: shell('Konec přístupu', content) };
}

/* ── oslovení fakult: šablony jménem Vítka ─────────────────────────────────── */

export type OutreachTemplateKey = 'intro_dean' | 'intro_department' | 'followup' | 'students_broadcast';

export const OUTREACH_TEMPLATES: Array<{ key: OutreachTemplateKey; label: string; hint: string }> = [
  { key: 'intro_dean', label: 'Úvodní e-mail vedení fakulty', hint: 'Proděkan/ka pro studium, děkan/ka — prosba o rozeslání studentům.' },
  { key: 'intro_department', label: 'Úvodní e-mail katedře', hint: 'Vedoucí katedry (matematika, fyzika, chemie, biologie, primární pedagogika) — vzorky a workshop.' },
  { key: 'followup', label: 'Připomenutí', hint: 'Krátký follow-up po 10–14 dnech bez odpovědi.' },
  { key: 'students_broadcast', label: 'Text pro studenty', hint: 'Zpráva, kterou fakulta přepošle studentům (do IS, newsletteru, Facebook skupiny).' },
];

export function renderOutreachTemplate(
  key: OutreachTemplateKey,
  ctx: { facultyName: string; university: string; contactName?: string; link: string; senderName: string; department?: string },
): { subject: string; text: string } {
  const contact = ctx.contactName ? `Dobrý den, ${ctx.contactName},` : 'Dobrý den,';
  const sign = `\n\nS pozdravem\n${ctx.senderName}\nspoluzakladatel Vividbooks\nvitek@vividbooks.com · www.vividbooks.com`;
  switch (key) {
    case 'intro_dean':
      return {
        subject: `Vividbooks zdarma pro studenty učitelství — ${ctx.facultyName}`,
        text:
          `${contact}\n\n` +
          `jmenuji se ${ctx.senderName} a s kolegy tvoříme Vividbooks — pracovní sešity a učební materiály pro základní školy v tištěné i online podobě. Používá je přes 600 základních škol v ČR a všechny předměty mají doložku MŠMT.\n\n` +
          `Rádi bychom nabídli studentům ${ctx.facultyName} (${ctx.university}) plný přístup do online aplikace zdarma po celou dobu studia a ještě půl roku po něm. Studenti tak přijdou na praxi a později do škol s materiály, které už znají — hotové lekce, pracovní listy, procvičování i editory pro vlastní přípravy.\n\n` +
          `Pro fakultu z toho neplyne žádný závazek: student zadá univerzitní e-mail na ${ctx.link}, potvrdí ho a přístup má do minuty. Oceníme, když odkaz pošlete studentům učitelství (např. přes studijní oddělení nebo IS).\n\n` +
          `Nabízíme také:\n` +
          `• vzorky tištěných pracovních sešitů zdarma pro katedry a didaktické semináře,\n` +
          `• workshop nebo přednášku pro studenty (prezenčně či online, 60–90 minut),\n` +
          `• data o tom, jak studenti materiály využívají — anonymně, pro fakultu.\n\n` +
          `Kdyby to dávalo smysl, rád se na 20 minut spojím online a ukážu aplikaci naživo. Vyhovoval by vám některý termín příští týden?` +
          sign,
      };
    case 'intro_department':
      return {
        subject: `Vzorky a přístup zdarma pro studenty — ${ctx.department || 'katedra'} ${ctx.facultyName}`,
        text:
          `${contact}\n\n` +
          `jmenuji se ${ctx.senderName} a jsem spoluzakladatel Vividbooks. Tvoříme pracovní sešity a učební materiály pro ZŠ (matematika, fyzika, chemie, přírodopis, prvouka, písanky) s online podporou pro výuku v hodině.\n\n` +
          `Píšu vám, protože studenti ${ctx.department ? `${ctx.department} ` : ''}na ${ctx.facultyName} budou brzy stát před třídou — a my jim chceme dát do ruky materiály, které v praxi používá přes 600 škol. Každý student má u nás přístup do aplikace zdarma po celou dobu studia: ${ctx.link}\n\n` +
          `Katedře rádi pošleme sadu tištěných pracovních sešitů zdarma (na semináře didaktiky, k porovnání koncepcí, jako podklad pro seminární práce) a připravíme workshop pro studenty — jak stavět hodinu s aktivním objevováním, jak pracovat s diferenciací nebo jak si tvořit vlastní pracovní listy.\n\n` +
          `Stačí mi napsat, kolik kusů a pro jaké ročníky/předměty dávají smysl, a pošleme je poštou.` +
          sign,
      };
    case 'followup':
      return {
        subject: `Re: Vividbooks zdarma pro studenty učitelství — ${ctx.facultyName}`,
        text:
          `${contact}\n\n` +
          `jen krátce navazuji na svůj e-mail z minulého týdne. Nabídka přístupu do Vividbooks zdarma pro studenty ${ctx.facultyName} platí a stačí studentům přeposlat odkaz ${ctx.link}.\n\n` +
          `Kdyby vám pomohl krátký text pro studenty nebo vzorky sešitů pro katedru, pošlu obratem. Případně mi napište, na koho na fakultě se mám obrátit — nechci vás zatěžovat.` +
          sign,
      };
    case 'students_broadcast':
    default:
      return {
        subject: `Vividbooks zdarma pro studenty ${ctx.facultyName}`,
        text:
          `Studujete učitelství? Vividbooks — pracovní sešity a učební materiály, se kterými učí přes 600 základních škol — máte po celou dobu studia zdarma.\n\n` +
          `Co získáte: hotové lekce a pracovní listy pro matematiku, fyziku, chemii, přírodopis, prvouku a 1. stupeň, vividboard pro interaktivní hodinu, procvičování pro žáky a editory pro vlastní přípravy na praxi.\n\n` +
          `Jak na to: zadejte svůj univerzitní e-mail na ${ctx.link}, potvrďte odkaz v e-mailu a do minuty máte přístup. Platí po celou dobu studia a ještě půl roku po něm.`,
      };
  }
}

/* ── datové operace ────────────────────────────────────────────────────────── */

async function logEvent(
  sb: SupabaseClient,
  ev: { studentId?: string | null; facultyId?: string | null; type: string; payload?: Record<string, unknown>; actor?: string },
): Promise<void> {
  try {
    await sb.from('student_program_events').insert({
      student_id: ev.studentId ?? null,
      faculty_id: ev.facultyId ?? null,
      type: ev.type,
      payload: ev.payload ?? {},
      actor: ev.actor ?? 'system',
    });
  } catch (e) {
    console.warn('[student-program] event log failed:', e instanceof Error ? e.message : e);
  }
}

/** Doplní chybějící fakulty ze sdíleného seznamu (nepřepisuje ručně editovaná pole). */
async function seedFaculties(sb: SupabaseClient): Promise<{ inserted: number }> {
  const { data: existing, error } = await sb.from('student_program_faculties').select('id');
  if (error) throw new Error(error.message);
  const have = new Set((existing || []).map((r: { id: string }) => r.id));
  const rows = STUDENT_PROGRAM_FACULTIES.filter((f) => !have.has(f.id)).map((f) => ({
    id: f.id,
    university: f.university,
    university_short: f.universityShort,
    faculty: f.faculty,
    faculty_short: f.facultyShort,
    city: f.city,
    region: f.region,
    ico: f.ico,
    email_domains: f.emailDomains,
    kind: f.kind,
    website: f.website,
    estimated_students: f.estimatedStudents,
    notes: f.note ?? null,
  }));
  if (rows.length === 0) return { inserted: 0 };
  const { error: insErr } = await sb.from('student_program_faculties').insert(rows);
  if (insErr) throw new Error(insErr.message);
  return { inserted: rows.length };
}

async function loadFaculties(sb: SupabaseClient, opts?: { activeOnly?: boolean }): Promise<FacultyRow[]> {
  let q = sb.from('student_program_faculties').select('*').order('kind', { ascending: true }).order('faculty_short', { ascending: true });
  if (opts?.activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data || []) as FacultyRow[];
  if (rows.length === 0) {
    await seedFaculties(sb);
    const again = await sb.from('student_program_faculties').select('*');
    if (again.error) throw new Error(again.error.message);
    rows = (again.data || []) as FacultyRow[];
  }
  // Pedagogické fakulty první, pak abecedně — `order('kind')` by dalo „other“ před „pedf“.
  return rows.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'pedf' ? -1 : 1) : a.faculty_short.localeCompare(b.faculty_short, 'cs')));
}

function facultyToShared(r: FacultyRow): StudentProgramFaculty {
  return {
    id: r.id,
    university: r.university,
    universityShort: r.university_short,
    faculty: r.faculty,
    facultyShort: r.faculty_short,
    city: String(r.city || ''),
    region: String(r.region || ''),
    ico: String(r.ico || ''),
    emailDomains: Array.isArray(r.email_domains) ? r.email_domains : [],
    kind: r.kind,
    website: String(r.website || ''),
    estimatedStudents: typeof r.estimated_students === 'number' ? r.estimated_students : null,
  };
}

function publicFaculty(r: FacultyRow) {
  return {
    id: r.id,
    university: r.university,
    universityShort: r.university_short,
    faculty: r.faculty,
    facultyShort: r.faculty_short,
    city: r.city,
    kind: r.kind,
    emailDomains: r.email_domains,
  };
}

/** Platnost přístupu studenta = max(konec roční licence, ruční prodloužení). */
function effectiveAccessUntil(s: Pick<StudentRow, 'access_valid_until' | 'access_extended_until'>): string | null {
  const a = s.access_valid_until || null;
  const b = s.access_extended_until || null;
  if (a && b) return a > b ? a : b;
  return a || b;
}

function publicStudentView(s: StudentRow, fac: FacultyRow | null) {
  return {
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    universityEmail: s.university_email,
    personalEmail: s.personal_email,
    phone: s.phone,
    status: s.status,
    expectedGraduation: s.expected_graduation,
    accessValidUntil: effectiveAccessUntil(s),
    teacherCode: s.teacher_code,
    studentCode: s.student_code,
    codesValidUntil: s.codes_valid_until,
    faculty: fac ? publicFaculty(fac) : null,
    subjects: Array.isArray(s.subjects) ? s.subjects : [],
    schoolStages: Array.isArray(s.school_stages) ? s.school_stages : [],
    studyProgramme: s.study_programme ?? null,
    employerStatus: s.employer_status ?? 'unknown',
    employerSchoolName: s.employer_school_name ?? null,
    employerSchoolIco: s.employer_school_ico ?? null,
    usesInPractice: s.uses_in_practice ?? null,
    newsletter: s.newsletter === true,
    checkinCount: s.checkin_count ?? 0,
    renewalCount: Number(s.renewal_count) || 0,
    renewedAt: s.renewed_at ?? null,
  };
}

/* ── Kabinet (registr Ultra): organizace + roční licence na studenta ─────────── */

type KabinetResult = { ok: boolean; status: number; body: Record<string, unknown> | null; text: string };

/** Volání hooku Kabinetu s tajemstvím (stejná konfigurace jako Edge funkce `kabinet-trial`). */
async function kabinetHook(path: string, body: Record<string, unknown> | null, method: 'POST' | 'GET' = 'POST'): Promise<KabinetResult> {
  const secret = (Deno.env.get('KABINET_SECRET') || Deno.env.get('REGISTR_MAKE_SECRET') || '').trim();
  if (!secret) return { ok: false, status: 0, body: null, text: 'KABINET_SECRET není nastavený.' };
  const base = (Deno.env.get('KABINET_API_BASE') || DEFAULT_KABINET_BASE).replace(/\/+$/, '');
  const anon = (Deno.env.get('KABINET_ANON_KEY') || DEFAULT_KABINET_ANON).trim();
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
        accept: 'application/json',
        'x-registr-secret': secret,
        'x-registr-client': 'web',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, body: parsed, text };
  } catch (e) {
    return { ok: false, status: 0, body: null, text: e instanceof Error ? e.message : String(e) };
  }
}

function kabinetErrorText(r: KabinetResult): string {
  const b = r.body;
  const errs = b?.errors;
  const msg = Array.isArray(errs) ? errs.join(' ') : typeof errs === 'string' ? errs : typeof b?.message === 'string' ? b.message : typeof b?.error === 'string' ? b.error : '';
  return `${r.status ? `HTTP ${r.status}` : 'síť'}: ${msg || r.text.slice(0, 200)}`.slice(0, 300);
}

function studentOrgName(s: StudentRow, fac: FacultyRow | null): string {
  const first = String(s.first_name || '').trim() || 'Student';
  const last = String(s.last_name || '').trim() || 'Vividbooks';
  const facLabel = fac ? facultyLabel({ facultyShort: fac.faculty_short, faculty: fac.faculty, universityShort: fac.university_short }) : 'studenti učitelství';
  return `Student ${first} ${last} (${facLabel})`;
}

/**
 * Roční licence na kódu studenta: `create-subscription-licence` (bundle všech předmětů,
 * interaktivní, individuální). Vrací konec licence (ISO) nebo chybu.
 */
async function issueYearLicence(
  teacherCode: string,
  startsOn: string,
  settings: StudentProgramSettings,
): Promise<{ ok: true; endsOn: string; legacyLicenceId: number | null } | { ok: false; error: string }> {
  const endsOn = addMonthsIso(startsOn, Math.max(1, settings.licenceMonths || 12));
  const r = await kabinetHook('/create-subscription-licence', {
    teacherCode,
    subjectName: ['bundle'],
    startsOn: legacyDate(startsOn),
    endsOn: legacyDate(endsOn),
    contentType: 'interactive',
    individual: settings.individualLicence === false ? 'no' : 'yes',
  });
  if (!r.ok) return { ok: false, error: kabinetErrorText(r) };
  const lic = Number(r.body?.licenceId);
  return { ok: true, endsOn, legacyLicenceId: Number.isFinite(lic) && lic > 0 ? lic : null };
}

/**
 * Založí studentovi vlastní organizaci v Kabinetu (bez trialu) a roční licenci.
 * Vrací, co se má uložit ke studentovi; při chybě zůstávají kódy prázdné a student jde do fronty.
 */
async function issueCodesForStudent(
  s: StudentRow,
  fac: FacultyRow | null,
  settings: StudentProgramSettings,
): Promise<{ teacherCode: string | null; studentCode: string | null; codesValidUntil: string | null; adminLink: string | null; legacyResult: string; legacyReason: string }> {
  if (!settings.autoIssueCodes) {
    return { teacherCode: null, studentCode: null, codesValidUntil: null, adminLink: null, legacyResult: 'manual_pending', legacyReason: 'autoIssueCodes=false' };
  }
  /**
   * Pojistka: starý systém hledá školu podle e-mailu. Kdyby univerzitní e-mail už patřil
   * nějaké škole (bývalý trial, učitel z fakulty), `create-school` by vrátil JEJÍ kódy a
   * Kabinet by ji přejmenoval na studenta. Takové případy jdou do fronty „Bez kódů“.
   */
  const check = await kabinetHook(`/trial-check?email=${encodeURIComponent(s.university_email)}`, null, 'GET');
  if (!check.ok) {
    return { teacherCode: null, studentCode: null, codesValidUntil: null, adminLink: null, legacyResult: 'kabinet_check_failed', legacyReason: kabinetErrorText(check) };
  }
  const orgIds = Array.isArray(check.body?.organizationIds) ? (check.body!.organizationIds as unknown[]) : [];
  if (check.body?.emailKnown === true || orgIds.length > 0) {
    const orgName = typeof check.body?.organizationName === 'string' ? check.body.organizationName : '';
    return {
      teacherCode: null,
      studentCode: null,
      codesValidUntil: null,
      adminLink: null,
      legacyResult: 'email_known_in_kabinet',
      legacyReason: `Univerzitní e-mail už v Kabinetu patří organizaci${orgName ? ` „${orgName}“` : ''} (${orgIds.length} org.). Založte studentovi kódy ručně, nebo ať použije jinou univerzitní adresu.`,
    };
  }
  const created = await kabinetHook('/create-school', {
    schoolName: studentOrgName(s, fac),
    countryCode: 'cz',
    email: s.university_email,
    address: fac ? `${fac.faculty}, ${fac.university}` : '',
    withFreeLicence: 'no',
  });
  const teacherCode = typeof created.body?.teacherCode === 'string' ? created.body.teacherCode.trim().toUpperCase() : '';
  const studentCode = typeof created.body?.studentCode === 'string' ? created.body.studentCode.trim().toUpperCase() : '';
  const adminLink = typeof created.body?.adminLink === 'string' ? created.body.adminLink : null;
  if (!created.ok || !teacherCode || !studentCode) {
    return { teacherCode: null, studentCode: null, codesValidUntil: null, adminLink, legacyResult: 'kabinet_create_failed', legacyReason: kabinetErrorText(created) };
  }
  const lic = await issueYearLicence(teacherCode, todayIso(), settings);
  if (!lic.ok) {
    // Organizace vznikla, ale licence ne — kódy uložíme, admin doplní licenci (nebo „Prodloužit o rok“).
    return { teacherCode, studentCode, codesValidUntil: null, adminLink, legacyResult: 'kabinet_licence_failed', legacyReason: lic.error };
  }
  return { teacherCode, studentCode, codesValidUntil: lic.endsOn, adminLink, legacyResult: 'kabinet_created', legacyReason: '' };
}

/** Roční obnovení: nová licence od většího z (dnes, konec současné). */
async function renewStudentLicence(
  s: StudentRow,
  settings: StudentProgramSettings,
): Promise<{ ok: true; endsOn: string } | { ok: false; error: string }> {
  if (!s.teacher_code) return { ok: false, error: 'Student nemá kódy.' };
  const today = todayIso();
  const current = s.codes_valid_until || s.access_valid_until || today;
  const startsOn = current > today ? current : today;
  const lic = await issueYearLicence(s.teacher_code, startsOn, settings);
  if (!lic.ok) return lic;
  return { ok: true, endsOn: lic.endsOn };
}

/* ── cron secret ───────────────────────────────────────────────────────────── */

function cronAuthorized(c: Context): boolean {
  const secret = Deno.env.get('MAILING_CRON_SECRET')?.trim() || Deno.env.get('WEBINAR_REMINDER_CRON_SECRET')?.trim();
  if (!secret) return false;
  const auth = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const hdr = c.req.header('X-Cron-Secret') || '';
  return auth === secret || hdr === secret;
}

/* ── přehled / metriky ─────────────────────────────────────────────────────── */

function monthKey(iso: string): string {
  return String(iso).slice(0, 7);
}

function buildOverview(students: StudentRow[], faculties: FacultyRow[], goals: StudentProgramGoals, settings: StudentProgramSettings) {
  const today = todayIso();
  const byStatus: Record<string, number> = {};
  for (const s of students) byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  const activeStatuses = new Set(['active', 'graduating', 'alumni']);
  const activeStudents = students.filter((s) => activeStatuses.has(s.status));
  const verified = students.filter((s) => s.status !== 'pending');
  const pending = students.filter((s) => s.status === 'pending');

  const perFaculty = new Map<string, { total: number; active: number; alumni: number; responded: number; usesYes: number }>();
  for (const s of students) {
    const fid = s.faculty_id || '_none';
    const cur = perFaculty.get(fid) || { total: 0, active: 0, alumni: 0, responded: 0, usesYes: 0 };
    cur.total += 1;
    if (activeStatuses.has(s.status)) cur.active += 1;
    if (s.status === 'alumni') cur.alumni += 1;
    if (s.last_response_at) cur.responded += 1;
    if (s.uses_in_practice === true) cur.usesYes += 1;
    perFaculty.set(fid, cur);
  }

  const pedf = faculties.filter((f) => f.kind === 'pedf');
  const pedfCovered = pedf.filter((f) => (perFaculty.get(f.id)?.active || 0) > 0).length;
  const otherCovered = faculties.filter((f) => f.kind === 'other' && (perFaculty.get(f.id)?.active || 0) > 0).length;
  const partners = faculties.filter((f) => f.outreach_status === 'partner').length;
  const contacted = faculties.filter((f) => f.outreach_status !== 'not_contacted').length;

  const responded = activeStudents.filter((s) => s.last_response_at);
  const usesYes = responded.filter((s) => s.uses_in_practice === true).length;
  const activeShare = responded.length ? Math.round((usesYes / responded.length) * 100) : null;

  const alumni = students.filter((s) => s.status === 'alumni' || s.status === 'expired');
  const alumniSchoolKnown = alumni.filter((s) => s.employer_school_name || s.employer_school_ico).length;
  const alumniSchoolShare = alumni.length ? Math.round((alumniSchoolKnown / alumni.length) * 100) : null;

  const months: Record<string, { registered: number; verified: number }> = {};
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - 11, 1);
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    months[d.toISOString().slice(0, 7)] = { registered: 0, verified: 0 };
  }
  for (const s of students) {
    const mk = monthKey(String(s.created_at || ''));
    if (months[mk]) months[mk].registered += 1;
    if (s.verified_at) {
      const vk = monthKey(String(s.verified_at));
      if (months[vk]) months[vk].verified += 1;
    }
  }

  const soon = addDays(new Date(), settings.renewalReminderDays).toISOString().slice(0, 10);
  const facById = new Map(faculties.map((f) => [f.id, f]));
  const renewalDue = activeStudents
    .filter((s) => s.status === 'active' && s.teacher_code && effectiveAccessUntil(s) && String(effectiveAccessUntil(s)) <= soon)
    .sort((a, b) => String(effectiveAccessUntil(a)).localeCompare(String(effectiveAccessUntil(b))))
    .map((s) => ({ id: s.id, name: `${s.first_name || ''} ${s.last_name || ''}`.trim(), email: s.university_email, facultyShort: facById.get(String(s.faculty_id))?.faculty_short || null, accessValidUntil: effectiveAccessUntil(s), renewalStage: Number(s.renewal_stage) || 0, renewalSentAt: s.renewal_sent_at }));
  const studentsWithoutCodes = activeStudents.filter((s) => !s.teacher_code).length;
  const studentsWithoutLicence = activeStudents.filter((s) => s.teacher_code && !s.codes_valid_until).length;
  const renewedThisYear = students.filter((s) => (Number(s.renewal_count) || 0) > 0).length;
  const expiredRecently = students.filter((s) => s.status === 'expired' && s.updated_at && String(s.updated_at) >= addDays(new Date(), -90).toISOString()).length;

  const withPhone = activeStudents.filter((s) => s.phone).length;
  const withPersonalEmail = activeStudents.filter((s) => s.personal_email).length;

  const estimatedPool = pedf.reduce((acc, f) => acc + (f.estimated_students || 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    goals,
    totals: {
      registered: students.length,
      pending: pending.length,
      verified: verified.length,
      active: activeStudents.length,
      byStatus,
      verificationRate: students.length ? Math.round((verified.length / students.length) * 100) : null,
      withPhone,
      withPersonalEmail,
      newsletter: activeStudents.filter((s) => s.newsletter === true).length,
    },
    coverage: {
      pedfTotal: pedf.length,
      pedfCovered,
      otherTotal: faculties.length - pedf.length,
      otherCovered,
      partners,
      contacted,
      estimatedPool,
      poolShare: estimatedPool ? Math.round((activeStudents.length / estimatedPool) * 1000) / 10 : null,
    },
    engagement: {
      responded: responded.length,
      usesYes,
      activeShare,
      checkinsSent: students.reduce((acc, s) => acc + (Number(s.checkin_count) || 0), 0),
      responseRate: activeStudents.length ? Math.round((responded.length / activeStudents.length) * 100) : null,
    },
    alumni: {
      total: alumni.length,
      schoolKnown: alumniSchoolKnown,
      schoolShare: alumniSchoolShare,
      teaching: alumni.filter((s) => s.employer_status === 'teaching').length,
    },
    progress: {
      studentsPct: goals.targetStudents ? Math.min(100, Math.round((activeStudents.length / goals.targetStudents) * 100)) : null,
      pedfPct: goals.targetPedfCoverage ? Math.min(100, Math.round((pedfCovered / goals.targetPedfCoverage) * 100)) : null,
      partnersPct: goals.targetFacultyPartners ? Math.min(100, Math.round((partners / goals.targetFacultyPartners) * 100)) : null,
      activeSharePct: activeShare == null ? null : Math.min(100, Math.round((activeShare / Math.max(1, goals.targetActiveShare)) * 100)),
      alumniSchoolPct: alumniSchoolShare == null ? null : Math.min(100, Math.round((alumniSchoolShare / Math.max(1, goals.targetAlumniSchoolKnown)) * 100)),
      daysToTarget: Math.max(0, Math.round((Date.parse(goals.targetDate) - Date.now()) / DAY_MS)),
    },
    queues: {
      renewalDue: renewalDue.slice(0, 50),
      renewalDueCount: renewalDue.length,
      studentsWithoutCodes,
      studentsWithoutLicence,
      renewedTotal: renewedThisYear,
      expiredRecently,
      pendingOlderThan3Days: pending.filter((s) => !String(s.source || '').startsWith('import-') && Date.parse(String(s.created_at)) < Date.now() - 3 * DAY_MS).length,
      importedNotInvited: pending.filter((s) => String(s.source || '').startsWith('import-') && !s.verification_sent_at).length,
    },
    months,
    perFaculty: faculties.map((f) => ({
      id: f.id,
      facultyShort: f.faculty_short,
      university: f.university,
      kind: f.kind,
      outreachStatus: f.outreach_status,
      estimatedStudents: f.estimated_students,
      ...(perFaculty.get(f.id) || { total: 0, active: 0, alumni: 0, responded: 0, usesYes: 0 }),
    })),
  };
}

/* ── registrace routes ─────────────────────────────────────────────────────── */

export function registerStudentProgramRoutes(app: Hono, deps: StudentProgramDeps): void {
  const getSb = (): SupabaseClient => {
    const sb = deps.serviceClient();
    if (!sb) throw new Error('Chybí service role env.');
    return sb;
  };

  const adminGate = async (c: Context): Promise<Response | { email: string }> => {
    const gate = await requireAdminJwt(c.req.raw);
    return gate;
  };

  /* ── veřejné ─────────────────────────────────────────────────────────────── */

  app.get(`${PUBLIC_PREFIX}/faculties`, async (c) => {
    try {
      const faculties = await loadFaculties(getSb(), { activeOnly: true });
      return c.json({ faculties: faculties.map(publicFaculty), graceMonths: STUDENT_PROGRAM_GRACE_MONTHS });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Živá kontrola e-mailu ve formuláři: je to univerzitní adresa? Které fakulty připadají v úvahu? */
  app.get(`${PUBLIC_PREFIX}/check-email`, async (c) => {
    const email = cleanEmail(c.req.query('email'));
    if (!email || !isValidEmailFormat(email)) return c.json({ ok: false, reason: 'invalid' });
    try {
      const faculties = await loadFaculties(getSb(), { activeOnly: true });
      const match = matchUniversityEmail(email, faculties.map(facultyToShared));
      if (!match) return c.json({ ok: false, reason: 'not_university', domain: email.split('@')[1] });
      const { data: existing } = await getSb()
        .from('student_program_students')
        .select('id, status')
        .eq('university_email', email)
        .maybeSingle();
      return c.json({
        ok: true,
        university: match.university,
        universityShort: match.universityShort,
        faculties: match.faculties.map((f) => ({ id: f.id, faculty: f.faculty, facultyShort: f.facultyShort, kind: f.kind })),
        existingStatus: existing?.status || null,
      });
    } catch (e) {
      return c.json({ ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.post(`${PUBLIC_PREFIX}/register`, async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: 'Neplatný požadavek.' }, 400);
    }
    const universityEmail = cleanEmail(body.universityEmail);
    const personalEmail = cleanEmail(body.personalEmail);
    const firstName = cleanText(body.firstName, 80);
    const lastName = cleanText(body.lastName, 80);
    const phone = cleanPhone(body.phone);
    const facultyId = cleanText(body.facultyId, 60);
    const studyProgramme = cleanText(body.studyProgramme, 160);
    const subjects = cleanStringArray(body.subjects);
    const schoolStages = cleanStringArray(body.schoolStages, 4);
    const graduation = graduationMonthToDate(String(body.expectedGraduation || ''));
    const consentTerms = body.consentTerms === true;
    const newsletter = body.newsletter === true;
    const source = cleanText(body.source, 60) || 'web-studenti';
    const utm = body.utm && typeof body.utm === 'object' ? (body.utm as Record<string, unknown>) : {};

    if (!firstName || !lastName) return c.json({ error: 'Vyplňte prosím jméno a příjmení.' }, 400);
    if (!universityEmail || !isValidEmailFormat(universityEmail)) return c.json({ error: 'Zadejte platný univerzitní e-mail.' }, 400);
    if (!personalEmail || !isValidEmailFormat(personalEmail)) return c.json({ error: 'Zadejte prosím i osobní e-mail — použijeme ho, až vám školní schránka skončí.' }, 400);
    if (personalEmail === universityEmail) return c.json({ error: 'Osobní e-mail musí být jiný než univerzitní.' }, 400);
    if (matchUniversityEmail(personalEmail)) return c.json({ error: 'Jako osobní e-mail použijte adresu mimo univerzitu (např. Gmail nebo Seznam).' }, 400);
    if (!consentTerms) return c.json({ error: 'Pro založení přístupu potřebujeme souhlas s podmínkami.' }, 400);

    try {
      const sb = getSb();
      const faculties = await loadFaculties(sb, { activeOnly: true });
      const match = matchUniversityEmail(universityEmail, faculties.map(facultyToShared));
      if (!match) {
        return c.json(
          {
            error: 'Tenhle e-mail nevypadá jako adresa české univerzity připravující učitele. Použijte prosím školní e-mail — nebo nám napište na hello@vividbooks.com a domluvíme se.',
            code: 'not_university',
          },
          400,
        );
      }
      const fac = faculties.find((f) => f.id === facultyId && match.faculties.some((m) => m.id === f.id)) || faculties.find((f) => f.id === match.faculties[0]?.id) || null;

      if (deps.assertEmailDeliverable) {
        const gate = await deps.assertEmailDeliverable(universityEmail);
        if (!gate.ok) return c.json({ error: gate.message || 'E-mail se nepodařilo ověřit.' }, 400);
      }

      const { data: existing } = await sb
        .from('student_program_students')
        .select('*')
        .eq('university_email', universityEmail)
        .maybeSingle();

      const origin = deps.publicSiteOrigin();
      const nowIso = new Date().toISOString();

      if (existing && existing.status !== 'pending') {
        const s = existing as StudentRow;
        // Už ověřený student — nezakládáme znovu, jen pošleme kódy / odkaz na aktualizaci.
        if (s.status === 'active' || s.status === 'graduating' || s.status === 'alumni') {
          const mail = codesEmail(origin, s, fac, effectiveAccessUntil(s));
          await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['codes-resend'] });
          await logEvent(sb, { studentId: s.id, type: 'codes_resent', payload: { via: 'register' } });
          return c.json({ status: 'already_active', message: 'Tenhle e-mail už přístup má — poslali jsme vám přístupové údaje znovu.' });
        }
        if (s.status === 'expired' && s.teacher_code) {
          // Vypršelý přístup: nová registrace = obnovení. Pošleme obnovovací odkaz na univerzitní e-mail.
          const token = randomToken();
          await sb.from('student_program_students').update({ renewal_token: token, renewal_sent_at: nowIso, personal_email: personalEmail || s.personal_email, phone: phone || s.phone }).eq('id', s.id);
          const mail = renewalEmail(origin, s, token, effectiveAccessUntil(s), 3);
          await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['renewal-reregister'] });
          await logEvent(sb, { studentId: s.id, type: 'renewal_sent', payload: { via: 'register' } });
          return c.json({ status: 'pending', resent: true, emailSent: true, message: 'Váš dřívější přístup skončil. Poslali jsme vám na univerzitní e-mail odkaz k obnovení.' });
        }
        return c.json({ status: 'contact_us', message: 'Tenhle e-mail už u nás je, ale přístup není aktivní. Napište nám na hello@vividbooks.com a dáme to do pořádku.' });
      }

      const token = randomToken();
      const baseRow = {
        university_email: universityEmail,
        personal_email: personalEmail || null,
        phone: phone || null,
        first_name: firstName,
        last_name: lastName,
        faculty_id: fac?.id || null,
        study_programme: studyProgramme || null,
        subjects,
        school_stages: schoolStages,
        expected_graduation: graduation,
        consent_terms: true,
        newsletter,
        source,
        utm,
        status: 'pending',
        verification_token: token,
        verification_sent_at: nowIso,
      };

      let studentId: string;
      let resent = false;
      if (existing) {
        const lastSent = existing.verification_sent_at ? Date.parse(existing.verification_sent_at) : 0;
        if (Date.now() - lastSent < VERIFICATION_RESEND_MIN_MS) {
          return c.json({ status: 'pending', resent: false, message: 'Ověřovací e-mail jsme poslali před chvílí — zkontrolujte schránku (i spam).' });
        }
        const { error } = await sb.from('student_program_students').update(baseRow).eq('id', existing.id);
        if (error) throw new Error(error.message);
        studentId = existing.id;
        resent = true;
      } else {
        const { data: inserted, error } = await sb.from('student_program_students').insert(baseRow).select('id').single();
        if (error) throw new Error(error.message);
        studentId = inserted.id;
      }

      const s = { ...baseRow, id: studentId } as unknown as StudentRow;
      const mail = verificationEmail(origin, s, token, fac);
      const sent = await sendMandrill({ toEmail: universityEmail, toName: `${firstName} ${lastName}`, subject: mail.subject, html: mail.html, tags: ['verification'] });
      await logEvent(sb, {
        studentId,
        facultyId: fac?.id || null,
        type: resent ? 'verification_resent' : 'registered',
        payload: { sent: sent.ok, detail: sent.detail || null, source },
      });
      if (!sent.ok) console.warn('[student-program] verification mail failed:', sent.detail);
      return c.json({ status: 'pending', resent, emailSent: sent.ok, message: sent.ok ? 'Poslali jsme ověřovací odkaz na váš univerzitní e-mail.' : 'Registraci máme, ale e-mail se nepodařilo odeslat. Zkuste to za chvíli znovu nebo nám napište.' });
    } catch (e) {
      console.error('[student-program] register:', e);
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.get(`${PUBLIC_PREFIX}/verify`, async (c) => {
    const token = cleanText(c.req.query('t'), 120);
    if (!token) return c.json({ valid: false, error: 'Chybí ověřovací token.' }, 400);
    try {
      const sb = getSb();
      const { data: found, error } = await sb.from('student_program_students').select('*').eq('verification_token', token).maybeSingle();
      if (error) throw new Error(error.message);
      if (!found) return c.json({ valid: false, error: 'Odkaz je neplatný nebo už byl použit.' }, 404);
      const s = found as StudentRow;
      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === s.faculty_id) || null;
      const origin = deps.publicSiteOrigin();

      if (s.status !== 'pending') {
        // Opakované kliknutí — vrátíme stav, kódy neposíláme znovu.
        return c.json({ valid: true, alreadyVerified: true, student: publicStudentView(s, fac) });
      }
      const sentAt = s.verification_sent_at ? Date.parse(String(s.verification_sent_at)) : 0;
      if (sentAt && Date.now() - sentAt > VERIFICATION_LINK_TTL_MS) {
        return c.json({ valid: false, expired: true, error: 'Odkaz už vypršel. Zaregistrujte se prosím znovu, pošleme nový.' }, 410);
      }

      const settings = await readSettings();
      const codes = await issueCodesForStudent(s, fac, settings);
      const nowIso = new Date().toISOString();
      const accessToken = s.access_token || randomToken();
      const update = {
        status: 'active',
        verified_at: nowIso,
        verification_token: null,
        access_token: accessToken,
        teacher_code: codes.teacherCode,
        student_code: codes.studentCode,
        codes_issued_at: codes.teacherCode ? nowIso : null,
        codes_valid_until: codes.codesValidUntil,
        access_valid_until: codes.codesValidUntil,
        legacy_admin_link: codes.adminLink,
        legacy_result: codes.legacyResult,
        legacy_reason: codes.legacyReason || null,
        renewal_stage: 0,
        renewal_token: null,
      };
      const { error: upErr } = await sb.from('student_program_students').update(update).eq('id', s.id);
      if (upErr) throw new Error(upErr.message);
      const fresh = { ...s, ...update } as StudentRow;

      // subscribers (vlastní mailing) — neblokující
      if (deps.upsertSubscriber) {
        try {
          const up = await deps.upsertSubscriber(sb, {
            email: fresh.university_email,
            firstName: fresh.first_name,
            lastName: fresh.last_name,
            phone: fresh.phone,
            schoolName: fac ? `${fac.faculty} ${fac.university_short}` : null,
            positionLabel: 'Student učitelství',
            source: 'other',
            contactType: 'unknown',
            status: 'subscribed',
            tags: ['student-program', ...(fac ? [`studenti-${fac.id}`] : [])],
            mergeFields: { student_program: true, faculty_id: fac?.id || null, expected_graduation: fresh.expected_graduation },
          });
          if (up.ok) await sb.from('student_program_students').update({ subscriber_id: up.subscriberId }).eq('id', s.id);
        } catch (subErr) {
          console.warn('[student-program] subscriber upsert:', subErr instanceof Error ? subErr.message : subErr);
        }
      }

      const mail = codesEmail(origin, fresh, fac, effectiveAccessUntil(fresh));
      const sent = await sendMandrill({ toEmail: fresh.university_email, toName: `${fresh.first_name || ''} ${fresh.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['codes'] });
      if (fresh.personal_email) {
        // Kopie na osobní e-mail — ať má student kódy i po ztrátě školní schránky.
        await sendMandrill({ toEmail: String(fresh.personal_email), toName: `${fresh.first_name || ''} ${fresh.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['codes-personal'] });
      }
      if (!sent.ok) console.warn('[student-program] codes mail failed:', sent.detail);
      await logEvent(sb, { studentId: s.id, facultyId: fac?.id || null, type: 'verified', payload: { legacyResult: codes.legacyResult, legacyReason: codes.legacyReason || null, mailSent: sent.ok, mailDetail: sent.detail || null } });

      if (!codes.teacherCode || !codes.codesValidUntil) {
        if (settings.digestEmail) {
          await sendMandrill({
            toEmail: settings.digestEmail,
            subject: `[Studenti] ${codes.teacherCode ? 'Student bez licence' : 'Student bez kódů'}: ${fresh.university_email}`,
            html: shell('Student bez kódů', [
              h2(codes.teacherCode ? 'Kódy vznikly, ale roční licence ne' : 'Student ověřen, ale kódy nevznikly'),
              p(`${esc(fresh.first_name)} ${esc(fresh.last_name)} (${esc(fresh.university_email)}), ${esc(fac?.faculty_short || 'bez fakulty')}.`),
              p(`Kabinet: <code>${esc(codes.legacyResult)}</code> ${esc(codes.legacyReason)}`),
              p(codes.teacherCode ? `V adminu (Marketing → Studenti → detail) klikněte „Prodloužit o rok“ — založí licenci v Kabinetu.` : codes.legacyResult === 'email_known_in_kabinet' ? `E-mail už v Kabinetu patří škole — založte studentovi vlastní školu a licenci ručně v Kabinetu a kódy vložte v adminu (Marketing → Studenti → detail), pak „Poslat kódy znovu“.` : `V adminu (Marketing → Studenti → detail) klikněte „Založit kódy“ znovu, nebo kódy vložte ručně a pošlete tlačítkem „Poslat kódy znovu“.`),
            ].join(''), 'Interní upozornění'),
            tags: ['admin-alert'],
          });
        }
      }

      return c.json({ valid: true, student: publicStudentView(fresh, fac), codesPending: !codes.teacherCode });
    } catch (e) {
      console.error('[student-program] verify:', e);
      return c.json({ valid: false, error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /**
   * Roční obnovení: odkaz z e-mailu na univerzitní adresu. Kliknutí = ověření, že student
   * schránku pořád má → nová roční licence v Kabinetu, stejné kódy.
   */
  app.get(`${PUBLIC_PREFIX}/renew`, async (c) => {
    const token = cleanText(c.req.query('t'), 120);
    if (!token) return c.json({ valid: false, error: 'Chybí obnovovací token.' }, 400);
    try {
      const sb = getSb();
      const { data: found, error } = await sb.from('student_program_students').select('*').eq('renewal_token', token).maybeSingle();
      if (error) throw new Error(error.message);
      if (!found) return c.json({ valid: false, error: 'Odkaz je neplatný nebo už byl použit.' }, 404);
      const s = found as StudentRow;
      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === s.faculty_id) || null;
      const settings = await readSettings();
      const origin = deps.publicSiteOrigin();
      if (!['active', 'graduating', 'expired'].includes(s.status)) {
        return c.json({ valid: false, error: 'Tento přístup už nejde obnovit. Napište nám na hello@vividbooks.com.' }, 400);
      }
      const lic = await renewStudentLicence(s, settings);
      if (!lic.ok) {
        await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'renewal_failed', payload: { error: lic.error }, actor: 'student' });
        if (settings.digestEmail) {
          await sendMandrill({ toEmail: settings.digestEmail, subject: `[Studenti] Obnovení selhalo: ${s.university_email}`, html: shell('Obnovení selhalo', [h2('Student klikl na obnovení, Kabinet licenci nezaložil'), p(`${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.university_email)})`), p(`<code>${esc(lic.error)}</code>`), p('V adminu klikněte „Prodloužit o rok“, až bude Kabinet dostupný.')].join(''), 'Interní upozornění'), tags: ['admin-alert'] });
        }
        return c.json({ valid: false, error: 'Obnovení se teď nepodařilo. Zkuste odkaz otevřít za chvíli znovu — nebo nám napište, dořešíme to ručně.' }, 502);
      }
      const nowIso = new Date().toISOString();
      const update = {
        status: 'active',
        access_valid_until: lic.endsOn,
        codes_valid_until: lic.endsOn,
        renewal_token: null,
        renewal_stage: 0,
        renewal_count: (Number(s.renewal_count) || 0) + 1,
        renewed_at: nowIso,
        last_response_at: nowIso,
        engagement: s.engagement === 'unknown' || s.engagement === 'inactive' ? 'active' : s.engagement,
      };
      const { error: upErr } = await sb.from('student_program_students').update(update).eq('id', s.id);
      if (upErr) throw new Error(upErr.message);
      const fresh = { ...s, ...update } as StudentRow;
      await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'renewed', payload: { endsOn: lic.endsOn, n: update.renewal_count }, actor: 'student' });
      const mail = renewedEmail(origin, fresh, lic.endsOn);
      const rsent = await sendMandrill({ toEmail: fresh.university_email, toName: `${fresh.first_name || ''} ${fresh.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['renewed'] });
      if (!rsent.ok) console.warn('[student-program] renewed mail failed:', rsent.detail);
      if (fresh.personal_email) await sendMandrill({ toEmail: String(fresh.personal_email), subject: mail.subject, html: mail.html, tags: ['renewed-personal'] });
      return c.json({ valid: true, student: publicStudentView(fresh, fac) });
    } catch (e) {
      console.error('[student-program] renew:', e);
      return c.json({ valid: false, error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Self-service pohled (odkaz z e-mailů). */
  app.get(`${PUBLIC_PREFIX}/me`, async (c) => {
    const token = cleanText(c.req.query('t'), 120);
    if (!token) return c.json({ error: 'Chybí token.' }, 400);
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('access_token', token).maybeSingle();
      if (!found) return c.json({ error: 'Odkaz je neplatný.' }, 404);
      const s = found as StudentRow;
      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === s.faculty_id) || null;
      return c.json({ student: publicStudentView(s, fac) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Self-service aktualizace: stále studuji / dostudoval jsem / kam nastupuji / telefon / používám. */
  app.post(`${PUBLIC_PREFIX}/update`, async (c) => {
    const token = cleanText(c.req.query('t'), 120);
    if (!token) return c.json({ error: 'Chybí token.' }, 400);
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: 'Neplatný požadavek.' }, 400);
    }
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('access_token', token).maybeSingle();
      if (!found) return c.json({ error: 'Odkaz je neplatný.' }, 404);
      const s = found as StudentRow;
      const settings = await readSettings();
      const studyStatus = cleanText(body.studyStatus, 30); // studying | graduated | ended
      const graduation = body.expectedGraduation ? graduationMonthToDate(String(body.expectedGraduation)) : null;
      const usesRaw = body.usesInPractice;
      const usesInPractice = usesRaw === true ? true : usesRaw === false ? false : null;
      const phone = body.phone !== undefined ? cleanPhone(body.phone) : null;
      const personalEmail = body.personalEmail !== undefined ? cleanEmail(body.personalEmail) : null;
      const employerStatus = cleanText(body.employerStatus, 30);
      const employerSchoolName = cleanText(body.employerSchoolName, 200);
      const employerSchoolIco = cleanText(body.employerSchoolIco, 12).replace(/\D/g, '');
      const feedback = cleanText(body.feedback, 1500);
      const newsletter = body.newsletter === true ? true : body.newsletter === false ? false : null;
      const nowIso = new Date().toISOString();

      const update: Record<string, unknown> = {
        last_response_at: nowIso,
        last_self_report: {
          at: nowIso,
          studyStatus: studyStatus || null,
          usesInPractice,
          feedback: feedback || null,
          employerStatus: employerStatus || null,
        },
      };
      if (usesInPractice !== null) {
        update.uses_in_practice = usesInPractice;
        update.engagement = usesInPractice ? 'active' : 'passive';
      }
      if (phone !== null) update.phone = phone || null;
      if (personalEmail !== null) {
        if (personalEmail && !isValidEmailFormat(personalEmail)) return c.json({ error: 'Osobní e-mail nemá správný formát.' }, 400);
        update.personal_email = personalEmail || null;
      }
      if (newsletter !== null) update.newsletter = newsletter;

      let newStatus = s.status;
      if (studyStatus === 'studying') {
        if (graduation) update.expected_graduation = graduation;
        if (s.status === 'graduating') newStatus = 'active';
      } else if (studyStatus === 'graduated') {
        // Absolvent: přístup doběhne do konce zaplaceného roku, dál se neobnovuje.
        if (s.status !== 'expired') newStatus = 'alumni';
        update.expected_graduation = graduation || s.expected_graduation || todayIso();
        update.renewal_token = null;
        if (['teaching', 'not_teaching', 'studying_further'].includes(employerStatus)) update.employer_status = employerStatus;
        if (employerSchoolName) update.employer_school_name = employerSchoolName;
        if (employerSchoolIco) update.employer_school_ico = employerSchoolIco;
        if (employerSchoolName || employerSchoolIco) update.employer_status = update.employer_status || 'teaching';
      } else if (studyStatus === 'ended') {
        newStatus = 'declined';
        update.renewal_token = null;
      } else if (['teaching', 'not_teaching', 'studying_further'].includes(employerStatus)) {
        update.employer_status = employerStatus;
        if (employerSchoolName) update.employer_school_name = employerSchoolName;
        if (employerSchoolIco) update.employer_school_ico = employerSchoolIco;
      }
      update.status = newStatus;

      const { error } = await sb.from('student_program_students').update(update).eq('id', s.id);
      if (error) throw new Error(error.message);
      await logEvent(sb, {
        studentId: s.id,
        facultyId: s.faculty_id,
        type: 'self_update',
        payload: { studyStatus, statusFrom: s.status, statusTo: newStatus, usesInPractice, employerStatus: update.employer_status || null, employerSchoolName: employerSchoolName || null },
        actor: 'student',
      });

      // Absolvent nahlásil školu → obchod má vědět hned.
      if (newStatus === 'alumni' && (employerSchoolName || employerSchoolIco) && settings.digestEmail) {
        await sendMandrill({
          toEmail: settings.digestEmail,
          subject: `[Studenti] Absolvent nastupuje: ${employerSchoolName || employerSchoolIco}`,
          html: shell('Absolvent nastupuje do školy', [
            h2('Absolvent nahlásil školu'),
            p(`${esc(s.first_name)} ${esc(s.last_name)} (${esc(s.university_email)}${s.personal_email ? `, ${esc(s.personal_email)}` : ''}${phone || s.phone ? `, tel. ${esc(phone || s.phone)}` : ''})`),
            p(`Škola: <strong>${esc(employerSchoolName || '—')}</strong>${employerSchoolIco ? ` (IČO ${esc(employerSchoolIco)})` : ''}`),
            p(`Používá Vividbooks: ${usesInPractice === true ? 'ano' : usesInPractice === false ? 'ne' : 'neuvedeno'}${feedback ? `<br/>Vzkaz: „${esc(feedback)}“` : ''}`),
            p(`Studentský přístup platí do ${esc(fmtCzDate(effectiveAccessUntil(s) || ''))} — ideální chvíle nabídnout škole ukázku a kalkulaci.`),
          ].join(''), 'Interní upozornění'),
          tags: ['admin-alert'],
        });
      }

      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === s.faculty_id) || null;
      return c.json({ ok: true, student: publicStudentView({ ...s, ...update } as StudentRow, fac) });
    } catch (e) {
      console.error('[student-program] update:', e);
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /* ── admin ───────────────────────────────────────────────────────────────── */

  app.get(`${ADMIN_PREFIX}/overview`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const [faculties, goals, settings] = await Promise.all([loadFaculties(sb), readGoals(), readSettings()]);
      const { data: students, error } = await sb.from('student_program_students').select('*');
      if (error) throw new Error(error.message);
      return c.json({ overview: buildOverview((students || []) as StudentRow[], faculties, goals, settings), settings });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.get(`${ADMIN_PREFIX}/students`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const q = cleanText(c.req.query('q'), 120).toLowerCase();
      const status = cleanText(c.req.query('status'), 30);
      const facultyId = cleanText(c.req.query('facultyId'), 60);
      const queue = cleanText(c.req.query('queue'), 40);
      const limit = Math.max(1, Math.min(500, Number(c.req.query('limit') || 200) || 200));
      const offset = Math.max(0, Number(c.req.query('offset') || 0) || 0);
      let query = sb.from('student_program_students').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      if (facultyId) query = query.eq('faculty_id', facultyId);
      if (q) {
        const like = `%${q.replace(/[%_,()]/g, '')}%`;
        query = query.or(`university_email.ilike.${like},personal_email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},employer_school_name.ilike.${like}`);
      }
      if (queue === 'no_codes') query = query.is('teacher_code', null).in('status', ['active', 'graduating', 'alumni']);
      if (queue === 'no_licence') query = query.not('teacher_code', 'is', null).is('codes_valid_until', null).in('status', ['active', 'graduating', 'alumni']);
      if (queue === 'alumni_no_school') query = query.in('status', ['alumni', 'expired']).is('employer_school_name', null);
      if (queue === 'pending_old') query = query.eq('status', 'pending').lte('created_at', addDays(new Date(), -3).toISOString());
      if (queue === 'imported') query = query.like('source', 'import-%').eq('status', 'pending');
      if (queue === 'renewal_due') {
        const settings = await readSettings();
        query = query.not('teacher_code', 'is', null).eq('status', 'active').lte('access_valid_until', addDays(new Date(), settings.renewalReminderDays).toISOString().slice(0, 10)).order('access_valid_until', { ascending: true });
      }
      if (queue === 'expired_recent') query = query.eq('status', 'expired').gte('updated_at', addDays(new Date(), -90).toISOString());
      query = query.range(offset, offset + limit - 1);
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return c.json({ items: data || [], total: count ?? (data || []).length, limit, offset });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.get(`${ADMIN_PREFIX}/students/:id/events`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const { data, error } = await getSb()
        .from('student_program_events')
        .select('*')
        .eq('student_id', c.req.param('id'))
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return c.json({ items: data || [] });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  const STUDENT_EDITABLE = new Set([
    'first_name', 'last_name', 'personal_email', 'phone', 'faculty_id', 'study_programme', 'subjects', 'school_stages',
    'expected_graduation', 'status', 'teacher_code', 'student_code', 'codes_valid_until', 'access_valid_until', 'access_extended_until', 'engagement',
    'uses_in_practice', 'employer_status', 'employer_school_name', 'employer_school_ico', 'newsletter', 'notes', 'next_checkin_at',
  ]);

  app.put(`${ADMIN_PREFIX}/students/:id`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        if (!STUDENT_EDITABLE.has(k)) continue;
        update[k] = typeof v === 'string' && v.trim() === '' ? null : v;
      }
      if (Object.keys(update).length === 0) return c.json({ error: 'Nic k uložení.' }, 400);
      const sb = getSb();
      const { data, error } = await sb.from('student_program_students').update(update).eq('id', c.req.param('id')).select('*').single();
      if (error) throw new Error(error.message);
      await logEvent(sb, { studentId: c.req.param('id'), facultyId: (data as StudentRow).faculty_id, type: 'admin_update', payload: { fields: Object.keys(update) }, actor: (gate as { email: string }).email });
      return c.json({ ok: true, item: data });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.post(`${ADMIN_PREFIX}/students/:id/resend-codes`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('id', c.req.param('id')).maybeSingle();
      if (!found) return c.json({ error: 'Student nenalezen.' }, 404);
      let s = found as StudentRow;
      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === s.faculty_id) || null;
      if (!s.teacher_code) return c.json({ error: 'Student nemá kódy — nejdřív je založte (tlačítko „Založit kódy“) nebo vložte ručně.' }, 400);
      if (!s.access_token) {
        const accessToken = randomToken();
        await sb.from('student_program_students').update({ access_token: accessToken }).eq('id', s.id);
        s = { ...s, access_token: accessToken };
      }
      const mail = codesEmail(deps.publicSiteOrigin(), s, fac, effectiveAccessUntil(s));
      const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['codes-resend'] });
      await logEvent(sb, { studentId: s.id, type: 'codes_resent', payload: { sent: sent.ok, detail: sent.detail || null }, actor: (gate as { email: string }).email });
      return c.json({ ok: sent.ok, detail: sent.detail || null, hasCodes: !!s.teacher_code });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /**
   * Admin: pozvat importovaný kontakt (stav pending bez tokenu) — pošle ověřovací e-mail,
   * po kliknutí projde student stejnou cestou jako z formuláře (kódy, uvítání, subscribers).
   */
  app.post(`${ADMIN_PREFIX}/students/:id/invite`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('id', c.req.param('id')).maybeSingle();
      if (!found) return c.json({ error: 'Student nenalezen.' }, 404);
      const s = found as StudentRow;
      if (s.status !== 'pending') return c.json({ error: 'Student už je ověřený.' }, 400);
      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === s.faculty_id) || null;
      const token = randomToken();
      const nowIso = new Date().toISOString();
      const { error } = await sb.from('student_program_students').update({ verification_token: token, verification_sent_at: nowIso }).eq('id', s.id);
      if (error) throw new Error(error.message);
      const mail = verificationEmail(deps.publicSiteOrigin(), { ...s, verification_token: token } as StudentRow, token, fac);
      const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['invite'] });
      await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'invited', payload: { sent: sent.ok, detail: sent.detail || null }, actor: (gate as { email: string }).email });
      return c.json({ ok: sent.ok, detail: sent.detail || null });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Admin: (znovu) založit kódy přes legacy API — student bez kódů, nebo po opravě dat (force=1). */
  app.post(`${ADMIN_PREFIX}/students/:id/issue-codes`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('id', c.req.param('id')).maybeSingle();
      if (!found) return c.json({ error: 'Student nenalezen.' }, 404);
      const s = found as StudentRow;
      if (s.status === 'pending') return c.json({ error: 'Student ještě neověřil e-mail.' }, 400);
      if (s.teacher_code && c.req.query('force') !== '1') return c.json({ error: 'Student už kódy má. Pro nové volání API použijte force=1.' }, 400);
      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === s.faculty_id) || null;
      const settings = await readSettings();
      const codes = await issueCodesForStudent(s, fac, { ...settings, autoIssueCodes: true });
      const nowIso = new Date().toISOString();
      const upd = {
        teacher_code: codes.teacherCode ?? s.teacher_code,
        student_code: codes.studentCode ?? s.student_code,
        codes_issued_at: codes.teacherCode ? nowIso : s.codes_issued_at,
        codes_valid_until: codes.codesValidUntil ?? s.codes_valid_until,
        access_valid_until: codes.codesValidUntil ?? s.access_valid_until,
        legacy_admin_link: codes.adminLink ?? s.legacy_admin_link,
        legacy_result: codes.legacyResult,
        legacy_reason: codes.legacyReason || null,
      };
      await sb.from('student_program_students').update(upd).eq('id', s.id);
      await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'codes_issued_admin', payload: { legacyResult: codes.legacyResult, legacyReason: codes.legacyReason || null }, actor: (gate as { email: string }).email });
      return c.json({ ok: !!codes.teacherCode, legacyResult: codes.legacyResult, legacyReason: codes.legacyReason || null, item: { ...s, ...upd } });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Admin: poslat obnovovací odkaz (na univerzitní e-mail + upozornění na osobní). */
  app.post(`${ADMIN_PREFIX}/students/:id/send-renewal`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('id', c.req.param('id')).maybeSingle();
      if (!found) return c.json({ error: 'Student nenalezen.' }, 404);
      const s = found as StudentRow;
      if (!s.teacher_code) return c.json({ error: 'Student nemá kódy — obnovení nemá co prodloužit.' }, 400);
      const token = s.renewal_token || randomToken();
      const nowIso = new Date().toISOString();
      const stage = Math.max(1, Number(s.renewal_stage) || 0);
      await sb.from('student_program_students').update({ renewal_token: token, renewal_sent_at: nowIso, renewal_stage: stage }).eq('id', s.id);
      const until = effectiveAccessUntil(s);
      const mail = renewalEmail(deps.publicSiteOrigin(), s, token, until, stage);
      const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['renewal-manual'] });
      if (s.personal_email) {
        const hu = renewalHeadsUpEmail(s, until);
        await sendMandrill({ toEmail: String(s.personal_email), subject: hu.subject, html: hu.html, tags: ['renewal-headsup'] });
      }
      await logEvent(sb, { studentId: s.id, type: 'renewal_sent', payload: { manual: true, sent: sent.ok }, actor: (gate as { email: string }).email });
      return c.json({ ok: sent.ok, detail: sent.detail || null });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Admin: prodloužit o rok rovnou (bez kliknutí studenta) — např. po telefonu nebo když Kabinet selhal. */
  app.post(`${ADMIN_PREFIX}/students/:id/renew`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('id', c.req.param('id')).maybeSingle();
      if (!found) return c.json({ error: 'Student nenalezen.' }, 404);
      const s = found as StudentRow;
      const settings = await readSettings();
      const lic = await renewStudentLicence(s, settings);
      if (!lic.ok) return c.json({ ok: false, error: lic.error }, 502);
      const nowIso = new Date().toISOString();
      const upd = {
        status: s.status === 'expired' || s.status === 'graduating' ? 'active' : s.status,
        access_valid_until: lic.endsOn,
        codes_valid_until: lic.endsOn,
        renewal_token: null,
        renewal_stage: 0,
        renewal_count: (Number(s.renewal_count) || 0) + 1,
        renewed_at: nowIso,
        legacy_result: 'kabinet_renewed_admin',
        legacy_reason: null,
      };
      await sb.from('student_program_students').update(upd).eq('id', s.id);
      await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'renewed', payload: { endsOn: lic.endsOn, admin: true }, actor: (gate as { email: string }).email });
      const mail = renewedEmail(deps.publicSiteOrigin(), { ...s, ...upd } as StudentRow, lic.endsOn);
      await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['renewed-admin'] });
      return c.json({ ok: true, endsOn: lic.endsOn, item: { ...s, ...upd } });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.delete(`${ADMIN_PREFIX}/students/:id`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const { error } = await getSb().from('student_program_students').delete().eq('id', c.req.param('id'));
      if (error) throw new Error(error.message);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.get(`${ADMIN_PREFIX}/export.csv`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const [{ data, error }, faculties] = await Promise.all([sb.from('student_program_students').select('*').order('created_at', { ascending: false }), loadFaculties(sb)]);
      if (error) throw new Error(error.message);
      const facById = new Map(faculties.map((f) => [f.id, f]));
      const cols = ['university_email', 'personal_email', 'phone', 'first_name', 'last_name', 'faculty', 'university', 'status', 'expected_graduation', 'access_valid_until', 'access_extended_until', 'teacher_code', 'student_code', 'codes_valid_until', 'renewal_count', 'renewed_at', 'uses_in_practice', 'employer_status', 'employer_school_name', 'employer_school_ico', 'newsletter', 'checkin_count', 'last_response_at', 'created_at', 'verified_at', 'notes'];
      const csvCell = (v: unknown) => {
        const s = v == null ? '' : Array.isArray(v) ? v.join('|') : String(v);
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [cols.join(';')];
      for (const row of (data || []) as StudentRow[]) {
        const fac = row.faculty_id ? facById.get(row.faculty_id) : null;
        const rec: Record<string, unknown> = { ...row, faculty: fac?.faculty_short || '', university: fac?.university || '' };
        lines.push(cols.map((k) => csvCell(rec[k])).join(';'));
      }
      return new Response(`\uFEFF${lines.join('\n')}`, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="studenti-${todayIso()}.csv"` },
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.get(`${ADMIN_PREFIX}/faculties`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const [faculties, contactsRes, studentsRes] = await Promise.all([
        loadFaculties(sb),
        sb.from('student_program_faculty_contacts').select('*').order('created_at', { ascending: true }),
        sb.from('student_program_students').select('faculty_id, status, uses_in_practice, last_response_at'),
      ]);
      if (contactsRes.error) throw new Error(contactsRes.error.message);
      if (studentsRes.error) throw new Error(studentsRes.error.message);
      const stats = new Map<string, { total: number; active: number; alumni: number; usesYes: number; responded: number }>();
      for (const s of (studentsRes.data || []) as Array<{ faculty_id: string | null; status: string; uses_in_practice: boolean | null; last_response_at: string | null }>) {
        const k = s.faculty_id || '_none';
        const cur = stats.get(k) || { total: 0, active: 0, alumni: 0, usesYes: 0, responded: 0 };
        cur.total += 1;
        if (['active', 'graduating', 'alumni'].includes(s.status)) cur.active += 1;
        if (s.status === 'alumni') cur.alumni += 1;
        if (s.uses_in_practice === true) cur.usesYes += 1;
        if (s.last_response_at) cur.responded += 1;
        stats.set(k, cur);
      }
      const contactsByFaculty = new Map<string, unknown[]>();
      for (const ct of (contactsRes.data || []) as Array<{ faculty_id: string }>) {
        const list = contactsByFaculty.get(ct.faculty_id) || [];
        list.push(ct);
        contactsByFaculty.set(ct.faculty_id, list);
      }
      return c.json({
        items: faculties.map((f) => ({
          ...f,
          stats: stats.get(f.id) || { total: 0, active: 0, alumni: 0, usesYes: 0, responded: 0 },
          contacts: contactsByFaculty.get(f.id) || [],
        })),
        unassigned: stats.get('_none') || null,
        templates: OUTREACH_TEMPLATES,
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.post(`${ADMIN_PREFIX}/faculties/seed`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      return c.json({ ok: true, ...(await seedFaculties(getSb())) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  const FACULTY_EDITABLE = new Set([
    'estimated_students', 'is_active', 'outreach_status', 'outreach_owner', 'last_contacted_at', 'next_followup_at', 'samples_sent_at', 'workshop_at', 'notes',
    'email_domains', 'website',
  ]);

  app.put(`${ADMIN_PREFIX}/faculties/:id`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        if (!FACULTY_EDITABLE.has(k)) continue;
        update[k] = typeof v === 'string' && v.trim() === '' ? null : v;
      }
      if (Object.keys(update).length === 0) return c.json({ error: 'Nic k uložení.' }, 400);
      const sb = getSb();
      const { data, error } = await sb.from('student_program_faculties').update(update).eq('id', c.req.param('id')).select('*').single();
      if (error) throw new Error(error.message);
      await logEvent(sb, { facultyId: c.req.param('id'), type: 'faculty_update', payload: { fields: Object.keys(update) }, actor: (gate as { email: string }).email });
      return c.json({ ok: true, item: data });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.post(`${ADMIN_PREFIX}/faculties/:id/contacts`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const name = cleanText(body.name, 120);
      if (!name) return c.json({ error: 'Chybí jméno kontaktu.' }, 400);
      const row = {
        faculty_id: c.req.param('id'),
        name,
        role: cleanText(body.role, 120) || null,
        department: cleanText(body.department, 160) || null,
        email: cleanEmail(body.email) || null,
        phone: cleanPhone(body.phone) || null,
        notes: cleanText(body.notes, 2000) || null,
      };
      const { data, error } = await getSb().from('student_program_faculty_contacts').insert(row).select('*').single();
      if (error) throw new Error(error.message);
      return c.json({ ok: true, item: data });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.put(`${ADMIN_PREFIX}/contacts/:id`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const allowed = new Set(['name', 'role', 'department', 'email', 'phone', 'status', 'last_contacted_at', 'last_reply_at', 'notes']);
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) if (allowed.has(k)) update[k] = typeof v === 'string' && v.trim() === '' ? null : v;
      if (Object.keys(update).length === 0) return c.json({ error: 'Nic k uložení.' }, 400);
      const { data, error } = await getSb().from('student_program_faculty_contacts').update(update).eq('id', c.req.param('id')).select('*').single();
      if (error) throw new Error(error.message);
      return c.json({ ok: true, item: data });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.delete(`${ADMIN_PREFIX}/contacts/:id`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const { error } = await getSb().from('student_program_faculty_contacts').delete().eq('id', c.req.param('id'));
      if (error) throw new Error(error.message);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Návrh e-mailu pro fakultu (jménem Vítka) — jen text, odeslání je zvlášť. */
  app.post(`${ADMIN_PREFIX}/outreach/draft`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const facultyId = cleanText(body.facultyId, 60);
      const key = cleanText(body.template, 40) as OutreachTemplateKey;
      if (!OUTREACH_TEMPLATES.some((t) => t.key === key)) return c.json({ error: 'Neznámá šablona.' }, 400);
      const sb = getSb();
      const faculties = await loadFaculties(sb);
      const fac = faculties.find((f) => f.id === facultyId);
      if (!fac) return c.json({ error: 'Fakulta nenalezena.' }, 404);
      const settings = await readSettings();
      const link = siteUrl(deps.publicSiteOrigin(), `/studenti?f=${encodeURIComponent(fac.id)}`);
      const draft = renderOutreachTemplate(key, {
        facultyName: `${fac.faculty} ${fac.university_short}`,
        university: fac.university,
        contactName: cleanText(body.contactName, 120) || undefined,
        department: cleanText(body.department, 160) || undefined,
        link,
        senderName: settings.outreachFromName.replace(/\s*\(.*\)$/, ''),
      });
      return c.json({ ok: true, ...draft, link });
    } catch (e) {
      return c.json({ error: e instanceof Response ? 'auth' : e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Odeslání oslovení (jen po explicitním kliknutí v adminu). */
  app.post(`${ADMIN_PREFIX}/outreach/send`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const facultyId = cleanText(body.facultyId, 60);
      const contactId = cleanText(body.contactId, 60);
      const toEmail = cleanEmail(body.toEmail);
      const toName = cleanText(body.toName, 120);
      const subject = cleanText(body.subject, 200);
      const text = String(body.text || '').trim().slice(0, 8000);
      if (!toEmail || !isValidEmailFormat(toEmail)) return c.json({ error: 'Neplatný e-mail příjemce.' }, 400);
      if (!subject || !text) return c.json({ error: 'Chybí předmět nebo text.' }, 400);
      const settings = await readSettings();
      const html = shell(
        subject,
        text
          .split(/\n{2,}/)
          .map((para) => p(esc(para).replace(/\n/g, '<br/>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#001161;">$1</a>')))
          .join(''),
        'Pro fakulty a katedry',
      );
      const sent = await sendMandrill({ toEmail, toName, subject, html, fromName: settings.outreachFromName, replyTo: settings.outreachReplyTo, tags: ['outreach'] });
      const sb = getSb();
      const nowIso = new Date().toISOString();
      if (sent.ok) {
        if (contactId) await sb.from('student_program_faculty_contacts').update({ status: 'contacted', last_contacted_at: nowIso }).eq('id', contactId);
        if (facultyId) {
          const { data: fac } = await sb.from('student_program_faculties').select('outreach_status').eq('id', facultyId).maybeSingle();
          const upd: Record<string, unknown> = { last_contacted_at: nowIso, next_followup_at: addDays(new Date(), 12).toISOString() };
          if (!fac || fac.outreach_status === 'not_contacted') upd.outreach_status = 'contacted';
          await sb.from('student_program_faculties').update(upd).eq('id', facultyId);
        }
      }
      await logEvent(sb, { facultyId: facultyId || null, type: 'outreach_sent', payload: { toEmail, subject, contactId: contactId || null, sent: sent.ok, detail: sent.detail || null }, actor: (gate as { email: string }).email });
      return c.json({ ok: sent.ok, detail: sent.detail || null });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.get(`${ADMIN_PREFIX}/faculties/:id/events`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const { data, error } = await getSb()
        .from('student_program_events')
        .select('*')
        .eq('faculty_id', c.req.param('id'))
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return c.json({ items: data || [] });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.get(`${ADMIN_PREFIX}/goals`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    return c.json({ goals: await readGoals(), settings: await readSettings(), defaults: { goals: DEFAULT_GOALS, settings: DEFAULT_SETTINGS } });
  });

  app.put(`${ADMIN_PREFIX}/goals`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const body = (await c.req.json()) as { goals?: Partial<StudentProgramGoals>; settings?: Partial<StudentProgramSettings> };
      if (body.goals) {
        const g = { ...(await readGoals()), ...body.goals };
        g.targetStudents = Math.max(0, Number(g.targetStudents) || 0);
        g.targetPedfCoverage = Math.max(0, Math.min(9, Number(g.targetPedfCoverage) || 0));
        g.targetFacultyPartners = Math.max(0, Number(g.targetFacultyPartners) || 0);
        g.targetActiveShare = Math.max(0, Math.min(100, Number(g.targetActiveShare) || 0));
        g.targetAlumniSchoolKnown = Math.max(0, Math.min(100, Number(g.targetAlumniSchoolKnown) || 0));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(g.targetDate))) g.targetDate = DEFAULT_GOALS.targetDate;
        await kv.set(KV_GOALS, g);
      }
      if (body.settings) {
        const s = { ...(await readSettings()), ...body.settings };
        s.autoIssueCodes = s.autoIssueCodes !== false;
        s.licenceMonths = Math.max(1, Math.min(60, Number(s.licenceMonths) || 12));
        s.individualLicence = s.individualLicence !== false;
        s.renewalReminderDays = Math.max(3, Math.min(120, Number(s.renewalReminderDays) || 30));
        s.renewalGraceDays = Math.max(0, Math.min(180, Number(s.renewalGraceDays) || 30));
        s.digestEmail = cleanEmail(s.digestEmail);
        s.outreachFromName = cleanText(s.outreachFromName, 80) || DEFAULT_SETTINGS.outreachFromName;
        s.outreachReplyTo = cleanEmail(s.outreachReplyTo) || DEFAULT_SETTINGS.outreachReplyTo;
        await kv.set(KV_SETTINGS, s);
      }
      return c.json({ ok: true, goals: await readGoals(), settings: await readSettings() });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /* ── cron: roční obnovení (výzvy 30/7/0 dní), vypršení po ochranné lhůtě, digest ──── */

  const runCron = async (opts?: { dryRun?: boolean }) => {
    const sb = getSb();
    const settings = await readSettings();
    const origin = deps.publicSiteOrigin();
    const now = new Date();
    const nowIso = now.toISOString();
    const today = todayIso();
    const summary = { reminders: 0, expired: 0, errors: [] as string[], digestSent: false, dryRun: opts?.dryRun === true };
    const budgetEnd = Date.now() + 45_000;

    const { data: rows, error } = await sb
      .from('student_program_students')
      .select('*')
      .in('status', ['active', 'graduating', 'alumni'])
      .not('teacher_code', 'is', null)
      .limit(3000);
    if (error) throw new Error(error.message);
    const students = (rows || []) as StudentRow[];

    const sendReminder = async (s: StudentRow, stage: number, until: string) => {
      const token = s.renewal_token || randomToken();
      const mail = renewalEmail(origin, s, token, until, stage);
      const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['renewal', `renewal-${stage}`] });
      if (s.personal_email) {
        const hu = renewalHeadsUpEmail(s, until);
        await sendMandrill({ toEmail: String(s.personal_email), subject: hu.subject, html: hu.html, tags: ['renewal-headsup'] });
      }
      await sb.from('student_program_students').update({ renewal_token: token, renewal_sent_at: nowIso, renewal_stage: stage }).eq('id', s.id);
      await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'renewal_sent', payload: { stage, sent: sent.ok, until } });
    };

    for (const s of students) {
      if (Date.now() > budgetEnd) {
        summary.errors.push('time budget exhausted');
        break;
      }
      try {
        const until = effectiveAccessUntil(s);
        if (!until) continue;
        const daysLeft = daysBetween(today, until);
        const stage = Number(s.renewal_stage) || 0;

        // 1) Po ochranné lhůtě bez obnovení → expired (absolventům přístup prostě doběhne).
        if (daysLeft < -settings.renewalGraceDays || (s.status === 'alumni' && daysLeft < 0)) {
          if (!opts?.dryRun) {
            const mail = expiredEmail(origin, s);
            const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['expired'] });
            if (s.personal_email) await sendMandrill({ toEmail: String(s.personal_email), subject: mail.subject, html: mail.html, tags: ['expired-personal'] });
            await sb.from('student_program_students').update({ status: 'expired', renewal_token: null, renewal_stage: 0 }).eq('id', s.id);
            await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'expired', payload: { sent: sent.ok, until } });
          }
          summary.expired += 1;
          continue;
        }
        if (s.status !== 'active') continue; // absolventi a končící se neobnovují automaticky

        // 2) Výzvy k obnovení: 30 dní před (stage 1), 7 dní před (2), v den konce (3), 14 dní po (4).
        let wanted = 0;
        if (daysLeft <= -14) wanted = 4;
        else if (daysLeft <= 0) wanted = 3;
        else if (daysLeft <= 7) wanted = 2;
        else if (daysLeft <= settings.renewalReminderDays) wanted = 1;
        if (wanted > stage) {
          if (!opts?.dryRun) await sendReminder(s, wanted, until);
          summary.reminders += 1;
        }
      } catch (e) {
        summary.errors.push(`${s.university_email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3) denní digest pro Vítka / obchod
    if (settings.digestEmail && !opts?.dryRun) {
      try {
        const since = addDays(now, -1).toISOString();
        const faculties = await loadFaculties(sb);
        const { data: all } = await sb.from('student_program_students').select('*');
        const everyone = (all || []) as StudentRow[];
        const newVerified = everyone.filter((s) => s.verified_at && String(s.verified_at) >= since);
        const newRegistered = everyone.filter((s) => String(s.created_at || '') >= since);
        const renewed = everyone.filter((s) => s.renewed_at && String(s.renewed_at) >= since);
        const responded = everyone.filter((s) => s.last_response_at && String(s.last_response_at) >= since && !(s.renewed_at && String(s.renewed_at) >= since));
        const goals = await readGoals();
        const ov = buildOverview(everyone, faculties, goals, settings);
        const somethingHappened = newVerified.length || newRegistered.length || renewed.length || responded.length || summary.expired || ov.queues.studentsWithoutCodes;
        if (somethingHappened) {
          const facById = new Map(faculties.map((f) => [f.id, f]));
          const li = (s: StudentRow) => `<li>${esc(s.first_name)} ${esc(s.last_name)} — ${esc(facById.get(String(s.faculty_id))?.faculty_short || '?')} (${esc(s.university_email)})</li>`;
          const content = [
            h2(`Studentský program — denní přehled ${now.toLocaleDateString('cs-CZ')}`),
            p(`<strong>${ov.totals.active}</strong> aktivních studentů z cíle ${goals.targetStudents} (${ov.progress.studentsPct ?? 0} %). Pokrytí PedF: ${ov.coverage.pedfCovered}/${ov.coverage.pedfTotal}. Partnerské fakulty: ${ov.coverage.partners}.`),
            newRegistered.length ? `<p style="margin:0 0 6px;font-weight:700;">Nové registrace (${newRegistered.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${newRegistered.map(li).join('')}</ul>` : '',
            newVerified.length ? `<p style="margin:0 0 6px;font-weight:700;">Ověřeno a kódy (${newVerified.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${newVerified.map(li).join('')}</ul>` : '',
            renewed.length ? `<p style="margin:0 0 6px;font-weight:700;">Obnovili na další rok (${renewed.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${renewed.map(li).join('')}</ul>` : '',
            responded.length ? `<p style="margin:0 0 6px;font-weight:700;">Aktualizovali údaje (${responded.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${responded.map((s) => `<li>${esc(s.first_name)} ${esc(s.last_name)} — ${esc(s.status)}${s.employer_school_name ? `, škola: ${esc(s.employer_school_name)}` : ''}${s.uses_in_practice === true ? ', používá' : s.uses_in_practice === false ? ', nepoužívá' : ''}</li>`).join('')}</ul>` : '',
            summary.reminders || summary.expired ? p(`Dnes: ${summary.reminders} výzev k obnovení, ${summary.expired} přístupů skončilo bez obnovení.`) : '',
            ov.queues.renewalDueCount ? p(`Čeká na obnovení (do ${settings.renewalReminderDays} dnů): <strong>${ov.queues.renewalDueCount}</strong> studentů.`) : '',
            ov.queues.studentsWithoutCodes ? p(`<span style="color:#b91c1c;">${ov.queues.studentsWithoutCodes} ověřených studentů je bez kódů — v adminu „Založit kódy“.</span>`) : '',
            `<p style="margin:20px 0 0;text-align:center;">${buildVividbooksBrandCta(siteUrl(origin, '/marketing/studenti'), 'Otevřít admin Studenti')}</p>`,
          ].join('');
          const sent = await sendMandrill({ toEmail: settings.digestEmail, subject: `[Studenti] ${ov.totals.active} aktivních · ${newRegistered.length} nových · ${renewed.length} obnovilo`, html: shell('Denní přehled', content, 'Interní přehled'), tags: ['digest'] });
          summary.digestSent = sent.ok;
        }
      } catch (e) {
        summary.errors.push(`digest: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return summary;
  };

  app.post(CRON_PATH, async (c) => {
    if (!cronAuthorized(c)) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const result = await runCron();
      if (result.errors.length) console.warn('[student-program cron]', result.errors.join(' | '));
      return c.json({ ok: true, ...result });
    } catch (e) {
      return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  /** Admin: spustit cron ručně (dryRun=1 jen spočítá, nic neposílá). */
  app.post(`${ADMIN_PREFIX}/run-cron`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const dryRun = c.req.query('dryRun') === '1';
      const result = await runCron({ dryRun });
      return c.json({ ok: true, ...result });
    } catch (e) {
      return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });
}
