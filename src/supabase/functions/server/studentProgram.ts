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
 * Princip kódů: jedna fakulta = jedna „škola“ v legacy Vividbooks adminu. První ověřený
 * student fakulty spustí legacy free-trial (14 dní), kódy se uloží k fakultě a dostane je
 * každý další student. Prodloužení platnosti dělá obchod v legacy adminu a zapíše
 * `codes_valid_until` — cron hlídá blížící se konec.
 */
import type { Context, Hono } from 'npm:hono';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import {
  accessValidUntilFromGraduation,
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
const LEGACY_TRIAL_DEFAULT_DAYS = 14;

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
  /** `per_faculty` = jedna škola v legacy adminu na fakultu (výchozí); `per_student` = každý student vlastní trial. */
  legacyMode: 'per_faculty' | 'per_student';
  /** Volat legacy free-trial API automaticky při prvním ověření na fakultě. */
  autoIssueCodes: boolean;
  /** Interval půlročního check-inu ve dnech. */
  checkinIntervalDays: number;
  /** Kam chodí denní digest (nové registrace, absolventi, fakulty k prodloužení). Prázdné = neposílat. */
  digestEmail: string;
  /** Jméno odesílatele u oslovení fakult. */
  outreachFromName: string;
  outreachReplyTo: string;
  /** Kolik dní před `codes_valid_until` upozornit obchod. */
  extensionWarnDays: number;
};

export const DEFAULT_SETTINGS: StudentProgramSettings = {
  legacyMode: 'per_faculty',
  autoIssueCodes: true,
  checkinIntervalDays: 182,
  digestEmail: 'vitek@vividbooks.com',
  outreachFromName: 'Vítek Škop (Vividbooks)',
  outreachReplyTo: 'vitek@vividbooks.com',
  extensionWarnDays: 21,
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
    if (!res.ok || (status && status !== 'sent' && status !== 'queued')) {
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
  next_checkin_at: string | null;
  checkin_count: number;
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
  teacher_code: string | null;
  student_code: string | null;
  codes_valid_until: string | null;
  codes_source: string | null;
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
      : p(`<strong>Přístupové kódy vám pošleme zvlášť</strong> — připravujeme je ručně a ozveme se do dvou pracovních dnů.`);
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
    until ? p(`Přístup platí po celou dobu vašeho studia a ještě půl roku po něm${until ? ` (aktuálně do <strong>${esc(fmtCzDate(until))}</strong>)` : ''}. Jednou za půl roku vám napíšeme a zeptáme se, jak se vám daří — kdykoli si můžete údaje upravit tady: <a href="${esc(meLink)}" style="color:#001161;">moje studium</a>.`) : '',
    fac
      ? p(`<span style="color:#64748b;font-size:13px;">Fakulta: ${esc(fac.faculty)} — ${esc(fac.university)}</span>`)
      : '',
  ].join('');
  return { subject: 'Váš přístup do Vividbooks je aktivní', html: shell('Přístup aktivní', content) };
}

function checkinEmail(origin: string, s: StudentRow): { subject: string; html: string } {
  const meLink = siteUrl(origin, `/studenti/aktualizace?t=${encodeURIComponent(String(s.access_token || ''))}`);
  const content = [
    h2('Jak se vám daří?'),
    p(greeting(s)),
    p(`uběhlo půl roku od chvíle, kdy jste získali přístup do Vividbooks. Rádi bychom věděli, jestli ještě studujete a jestli vám materiály pomáhají — třeba na praxi nebo v seminářích.`),
    p(`Stačí minuta: potvrďte, kdy studium končí, a řekněte nám, jak Vividbooks používáte. Díky tomu vám přístup poběží dál bez přerušení.`),
    `<p style="margin:24px 0;text-align:center;">${buildVividbooksBrandCta(meLink, 'Aktualizovat moje studium')}</p>`,
    p(`<span style="color:#64748b;font-size:13px;">Chcete pozvánky na workshopy a webináře pro budoucí učitele? V aktualizaci stačí doplnit telefon nebo zaškrtnout newsletter.</span>`),
  ].join('');
  return { subject: 'Vividbooks: krátká aktualizace vašeho studia', html: shell('Půlroční check-in', content) };
}

function graduatingEmail(origin: string, s: StudentRow, until: string | null): { subject: string; html: string } {
  const meLink = siteUrl(origin, `/studenti/aktualizace?t=${encodeURIComponent(String(s.access_token || ''))}`);
  const content = [
    h2('Blíží se konec studia — a co dál?'),
    p(greeting(s)),
    p(`podle našich záznamů právě končíte studium. Gratulujeme! Přístup do Vividbooks vám necháme ještě půl roku${until ? ` (do ${esc(fmtCzDate(until))})` : ''}, abyste měli materiály po ruce i v prvních měsících ve škole.`),
    p(`Prozraďte nám, kam nastupujete. Rádi vaší nové škole ukážeme Vividbooks a připravíme ukázku pro váš ročník — a když ještě studujete dál, jen posuňte datum konce studia.`),
    `<p style="margin:24px 0;text-align:center;">${buildVividbooksBrandCta(meLink, 'Nahlásit, kam nastupuji')}</p>`,
  ].join('');
  return { subject: 'Končíte studium? Vividbooks vám zůstává ještě půl roku', html: shell('Konec studia', content) };
}

function expiredEmail(origin: string, s: StudentRow): { subject: string; html: string } {
  const trialLink = siteUrl(origin, '/vyzkousejte');
  const content = [
    h2('Studentský přístup skončil'),
    p(greeting(s)),
    p(`půl roku po konci studia končí i studentský přístup do Vividbooks. Děkujeme, že jste s námi byli — a doufáme, že se materiály osvědčily.`),
    p(`Učíte? Vaše škola může Vividbooks vyzkoušet zdarma jako škola a poté objednat licenci pro celý sbor. Stačí vyplnit krátký formulář nebo nám napsat na hello@vividbooks.com — rádi připravíme kalkulaci pro vaši školu.`),
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

/** Platnost přístupu studenta = max(konec studia + 6 měsíců, ruční prodloužení). */
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
  };
}

/* ── legacy Vividbooks free-trial API ──────────────────────────────────────── */

type LegacyResult =
  | { status: 'codes'; teacherCode: string; studentCode: string; kind: 'created' | 'existing_trial' }
  | { status: 'thank_only' }
  | { status: 'error'; reason: string; message: string; httpStatus: number };

async function callLegacyFreeTrial(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  schoolName: string;
  vat: string;
  newsletter: boolean;
  subjects: string[];
  stages: string[];
}): Promise<LegacyResult> {
  const base = (Deno.env.get('LEGACY_VIVIDBOOKS_WEB_API_BASE') || 'https://api.vividbooks.com').replace(/\/+$/, '');
  const body = new URLSearchParams();
  body.append('FirstName', input.firstName);
  body.append('LastName', input.lastName);
  body.append('FullName', `${input.firstName} ${input.lastName}`.trim());
  body.append('Email', input.email);
  body.append('Phone', input.phone);
  body.append('flexdatalist-School', input.schoolName);
  body.append('School', input.schoolName);
  body.append('Position', 'Student');
  body.append('Whence', 'studenti');
  body.append('Region', '');
  if (input.newsletter) body.append('Checkbox-NL', 'yes');
  body.append('CountryCode', 'cz');
  body.append('CountryCodeSelect', '');
  body.append('Version', '');
  body.append('Dealer', '');
  body.append('Vat', input.vat);
  input.subjects.forEach((v) => body.append('TeacherSubjects', v));
  input.stages.forEach((v) => body.append('SchoolStages', v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${base}/web/free-trial-ajax`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
      redirect: 'manual',
      signal: controller.signal,
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) return { status: 'thank_only' };
    const raw = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      data = null;
    }
    const teacher = typeof data?.teacherCode === 'string' ? data.teacherCode.trim() : '';
    const student = typeof data?.studentCode === 'string' ? data.studentCode.trim() : '';
    const reason = typeof data?.reason === 'string' ? data.reason : '';
    if (res.ok && data?.success === true && teacher && student) {
      return { status: 'codes', teacherCode: teacher, studentCode: student, kind: 'created' };
    }
    if (teacher && student) {
      return { status: 'codes', teacherCode: teacher, studentCode: student, kind: 'existing_trial' };
    }
    if (res.ok && !data) return { status: 'thank_only' };
    const msg = reason || (typeof data?.message === 'string' ? data.message : '') || `HTTP ${res.status}`;
    return { status: 'error', reason, message: msg, httpStatus: res.status };
  } catch (e) {
    return { status: 'error', reason: 'network', message: e instanceof Error ? e.message : String(e), httpStatus: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Zajistí kódy pro studenta: nejdřív kódy fakulty (ruční nebo z dřívějšího trialu),
 * jinak podle nastavení zavolá legacy API. Vrací, co se má uložit ke studentovi.
 */
async function ensureCodesForStudent(
  sb: SupabaseClient,
  s: StudentRow,
  fac: FacultyRow | null,
  settings: StudentProgramSettings,
): Promise<{ teacherCode: string | null; studentCode: string | null; legacyResult: string; legacyReason: string }> {
  if (fac && fac.teacher_code && fac.student_code && settings.legacyMode === 'per_faculty') {
    return { teacherCode: fac.teacher_code, studentCode: fac.student_code, legacyResult: 'faculty_codes', legacyReason: '' };
  }
  if (!settings.autoIssueCodes) {
    return { teacherCode: null, studentCode: null, legacyResult: 'manual_pending', legacyReason: 'autoIssueCodes=false' };
  }
  const first = String(s.first_name || '').trim() || 'Student';
  const last = String(s.last_name || '').trim() || 'Vividbooks';
  const facLabel = fac ? facultyLabel({ facultyShort: fac.faculty_short, faculty: fac.faculty, universityShort: fac.university_short }) : 'Studenti učitelství';
  const perFaculty = settings.legacyMode === 'per_faculty' && !!fac;
  const legacy = await callLegacyFreeTrial({
    firstName: first,
    lastName: last,
    email: s.university_email,
    phone: String(s.phone || ''),
    schoolName: perFaculty ? `${facLabel} – studenti (Vividbooks student program)` : `${facLabel} – student ${first} ${last}`,
    vat: perFaculty ? String(fac?.ico || '') : '',
    newsletter: s.newsletter === true,
    subjects: Array.isArray(s.subjects) ? (s.subjects as string[]) : [],
    stages: Array.isArray(s.school_stages) ? (s.school_stages as string[]) : [],
  });
  if (legacy.status === 'codes') {
    if (perFaculty && fac) {
      const validUntil = addDays(new Date(), LEGACY_TRIAL_DEFAULT_DAYS).toISOString().slice(0, 10);
      await sb
        .from('student_program_faculties')
        .update({
          teacher_code: legacy.teacherCode,
          student_code: legacy.studentCode,
          codes_source: 'legacy_trial',
          codes_issued_at: new Date().toISOString(),
          codes_valid_until: fac.codes_valid_until || validUntil,
          codes_note: `Založeno automaticky přes free-trial API (${legacy.kind}). Prodloužit v legacy adminu Vividbooks.`,
        })
        .eq('id', fac.id);
      await logEvent(sb, { facultyId: fac.id, studentId: s.id, type: 'faculty_codes_issued', payload: { kind: legacy.kind } });
    }
    return { teacherCode: legacy.teacherCode, studentCode: legacy.studentCode, legacyResult: `legacy_${legacy.kind}`, legacyReason: '' };
  }
  if (legacy.status === 'thank_only') {
    return { teacherCode: null, studentCode: null, legacyResult: 'legacy_thank_only', legacyReason: 'API nevrátilo kódy (thank_only)' };
  }
  return { teacherCode: null, studentCode: null, legacyResult: 'legacy_error', legacyReason: `${legacy.reason || ''} ${legacy.message}`.trim().slice(0, 300) };
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

  const warnBefore = addDays(new Date(), settings.extensionWarnDays).toISOString().slice(0, 10);
  const facultiesNeedingExtension = faculties
    .filter((f) => f.teacher_code && (perFaculty.get(f.id)?.active || 0) > 0 && (!f.codes_valid_until || f.codes_valid_until <= warnBefore))
    .map((f) => ({ id: f.id, facultyShort: f.faculty_short, codesValidUntil: f.codes_valid_until, activeStudents: perFaculty.get(f.id)?.active || 0 }));
  const studentsWithoutCodes = activeStudents.filter((s) => !s.teacher_code).length;
  const graduatingSoon = activeStudents.filter((s) => s.expected_graduation && s.expected_graduation >= today && s.expected_graduation <= addDays(new Date(), 90).toISOString().slice(0, 10)).length;
  const checkinsDue = activeStudents.filter((s) => s.next_checkin_at && s.next_checkin_at <= new Date().toISOString()).length;

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
      facultiesNeedingExtension,
      studentsWithoutCodes,
      graduatingSoon,
      checkinsDue,
      pendingOlderThan3Days: pending.filter((s) => Date.parse(String(s.created_at)) < Date.now() - 3 * DAY_MS).length,
    },
    months,
    perFaculty: faculties.map((f) => ({
      id: f.id,
      facultyShort: f.faculty_short,
      university: f.university,
      kind: f.kind,
      outreachStatus: f.outreach_status,
      estimatedStudents: f.estimated_students,
      hasCodes: !!f.teacher_code,
      codesValidUntil: f.codes_valid_until,
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
    if (personalEmail && !isValidEmailFormat(personalEmail)) return c.json({ error: 'Osobní e-mail nemá správný formát.' }, 400);
    if (personalEmail && personalEmail === universityEmail) return c.json({ error: 'Osobní e-mail musí být jiný než univerzitní.' }, 400);
    if (!graduation) return c.json({ error: 'Vyberte prosím předpokládaný konec studia.' }, 400);
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
        access_valid_until: accessValidUntilFromGraduation(graduation),
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
      if (sentAt && Date.now() - sentAt > 7 * DAY_MS) {
        return c.json({ valid: false, expired: true, error: 'Odkaz už vypršel. Zaregistrujte se prosím znovu, pošleme nový.' }, 410);
      }

      const settings = await readSettings();
      const codes = await ensureCodesForStudent(sb, s, fac, settings);
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
        legacy_result: codes.legacyResult,
        legacy_reason: codes.legacyReason || null,
        next_checkin_at: addDays(new Date(), settings.checkinIntervalDays).toISOString(),
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
      await logEvent(sb, { studentId: s.id, facultyId: fac?.id || null, type: 'verified', payload: { legacyResult: codes.legacyResult, legacyReason: codes.legacyReason || null, mailSent: sent.ok } });

      if (!codes.teacherCode) {
        const settingsNow = settings;
        if (settingsNow.digestEmail) {
          await sendMandrill({
            toEmail: settingsNow.digestEmail,
            subject: `[Studenti] Student bez kódů: ${fresh.university_email}`,
            html: shell('Student bez kódů', [
              h2('Student ověřen, ale kódy nevznikly'),
              p(`${esc(fresh.first_name)} ${esc(fresh.last_name)} (${esc(fresh.university_email)}), ${esc(fac?.faculty_short || 'bez fakulty')}.`),
              p(`Legacy výsledek: <code>${esc(codes.legacyResult)}</code> ${esc(codes.legacyReason)}`),
              p(`Doplňte kódy fakulty v adminu (Marketing → Studenti → Fakulty) nebo přímo u studenta; po doplnění se dají poslat tlačítkem „Poslat kódy znovu“.`),
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
        if (graduation) {
          update.expected_graduation = graduation;
          update.access_valid_until = accessValidUntilFromGraduation(graduation);
        }
        if (s.status === 'graduating' || s.status === 'active') newStatus = 'active';
        update.next_checkin_at = addDays(new Date(), settings.checkinIntervalDays).toISOString();
      } else if (studyStatus === 'graduated') {
        newStatus = 'alumni';
        if (graduation) {
          update.expected_graduation = graduation;
          update.access_valid_until = accessValidUntilFromGraduation(graduation);
        } else if (!s.expected_graduation || s.expected_graduation > todayIso()) {
          const g = todayIso();
          update.expected_graduation = g;
          update.access_valid_until = accessValidUntilFromGraduation(g);
        }
        update.next_checkin_at = addDays(new Date(), Math.round(settings.checkinIntervalDays / 2)).toISOString();
        if (['teaching', 'not_teaching', 'studying_further'].includes(employerStatus)) update.employer_status = employerStatus;
        if (employerSchoolName) update.employer_school_name = employerSchoolName;
        if (employerSchoolIco) update.employer_school_ico = employerSchoolIco;
        if (employerSchoolName || employerSchoolIco) update.employer_status = update.employer_status || 'teaching';
      } else if (studyStatus === 'ended') {
        newStatus = 'declined';
        update.next_checkin_at = null;
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
            p(`Studentský přístup platí do ${esc(fmtCzDate(String(update.access_valid_until || s.access_valid_until || '')))} — ideální chvíle nabídnout škole ukázku a kalkulaci.`),
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
      if (queue === 'checkin_due') query = query.lte('next_checkin_at', new Date().toISOString()).in('status', ['active', 'graduating', 'alumni']);
      if (queue === 'graduating_soon') query = query.gte('expected_graduation', todayIso()).lte('expected_graduation', addDays(new Date(), 90).toISOString().slice(0, 10)).in('status', ['active', 'graduating']);
      if (queue === 'alumni_no_school') query = query.in('status', ['alumni', 'expired']).is('employer_school_name', null);
      if (queue === 'pending_old') query = query.eq('status', 'pending').lte('created_at', addDays(new Date(), -3).toISOString());
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
    'expected_graduation', 'status', 'teacher_code', 'student_code', 'access_extended_until', 'engagement',
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
      if (typeof update.expected_graduation === 'string') {
        update.access_valid_until = accessValidUntilFromGraduation(String(update.expected_graduation));
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
      // Bez kódů → zkusit doplnit z fakulty.
      if (!s.teacher_code && fac?.teacher_code) {
        const upd = { teacher_code: fac.teacher_code, student_code: fac.student_code, codes_issued_at: new Date().toISOString(), legacy_result: 'faculty_codes' };
        await sb.from('student_program_students').update(upd).eq('id', s.id);
        s = { ...s, ...upd } as StudentRow;
      }
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

  app.post(`${ADMIN_PREFIX}/students/:id/send-checkin`, async (c) => {
    const gate = await adminGate(c);
    if (gate instanceof Response) return gate;
    try {
      const sb = getSb();
      const { data: found } = await sb.from('student_program_students').select('*').eq('id', c.req.param('id')).maybeSingle();
      if (!found) return c.json({ error: 'Student nenalezen.' }, 404);
      const s = found as StudentRow;
      if (!s.access_token) return c.json({ error: 'Student ještě není ověřený.' }, 400);
      const settings = await readSettings();
      const mail = checkinEmail(deps.publicSiteOrigin(), s);
      const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['checkin-manual'] });
      if (sent.ok) {
        await sb.from('student_program_students').update({ last_checkin_sent_at: new Date().toISOString(), checkin_count: (Number(s.checkin_count) || 0) + 1, next_checkin_at: addDays(new Date(), settings.checkinIntervalDays).toISOString() }).eq('id', s.id);
      }
      await logEvent(sb, { studentId: s.id, type: 'checkin_sent', payload: { manual: true, sent: sent.ok }, actor: (gate as { email: string }).email });
      return c.json({ ok: sent.ok, detail: sent.detail || null });
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
      const cols = ['university_email', 'personal_email', 'phone', 'first_name', 'last_name', 'faculty', 'university', 'status', 'expected_graduation', 'access_valid_until', 'access_extended_until', 'teacher_code', 'student_code', 'uses_in_practice', 'employer_status', 'employer_school_name', 'employer_school_ico', 'newsletter', 'checkin_count', 'last_response_at', 'created_at', 'verified_at', 'notes'];
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
    'teacher_code', 'student_code', 'codes_source', 'codes_valid_until', 'codes_note', 'email_domains', 'website',
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
      if ((update.teacher_code || update.student_code) && !update.codes_source) update.codes_source = 'manual';
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
        s.legacyMode = s.legacyMode === 'per_student' ? 'per_student' : 'per_faculty';
        s.autoIssueCodes = s.autoIssueCodes !== false;
        s.checkinIntervalDays = Math.max(30, Math.min(365, Number(s.checkinIntervalDays) || 182));
        s.extensionWarnDays = Math.max(1, Math.min(90, Number(s.extensionWarnDays) || 21));
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

  /* ── cron: půlroční check-iny, přechody stavů, digest ─────────────────────── */

  const runCron = async (opts?: { dryRun?: boolean }) => {
    const sb = getSb();
    const settings = await readSettings();
    const origin = deps.publicSiteOrigin();
    const now = new Date();
    const nowIso = now.toISOString();
    const today = todayIso();
    const summary = { checkins: 0, graduating: 0, expired: 0, errors: [] as string[], digestSent: false, dryRun: opts?.dryRun === true };
    const budgetEnd = Date.now() + 45_000;

    const { data: rows, error } = await sb
      .from('student_program_students')
      .select('*')
      .in('status', ['active', 'graduating', 'alumni'])
      .limit(2000);
    if (error) throw new Error(error.message);
    const students = (rows || []) as StudentRow[];

    for (const s of students) {
      if (Date.now() > budgetEnd) {
        summary.errors.push('time budget exhausted');
        break;
      }
      try {
        const until = effectiveAccessUntil(s);
        // 1) konec přístupu (půl roku po studiu)
        if (until && until < today && s.status !== 'expired') {
          if (!opts?.dryRun) {
            const mail = expiredEmail(origin, s);
            const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['expired'] });
            if (s.personal_email) await sendMandrill({ toEmail: String(s.personal_email), subject: mail.subject, html: mail.html, tags: ['expired-personal'] });
            await sb.from('student_program_students').update({ status: 'expired', next_checkin_at: null }).eq('id', s.id);
            await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'expired', payload: { sent: sent.ok } });
          }
          summary.expired += 1;
          continue;
        }
        // 2) konec studia → graduating (jednorázový e-mail „kam nastupujete“)
        if (s.status === 'active' && s.expected_graduation && s.expected_graduation <= today) {
          if (!opts?.dryRun) {
            const mail = graduatingEmail(origin, s, until);
            const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['graduating'] });
            if (s.personal_email) await sendMandrill({ toEmail: String(s.personal_email), subject: mail.subject, html: mail.html, tags: ['graduating-personal'] });
            await sb
              .from('student_program_students')
              .update({ status: 'graduating', next_checkin_at: addDays(now, 45).toISOString(), last_checkin_sent_at: nowIso, checkin_count: (Number(s.checkin_count) || 0) + 1 })
              .eq('id', s.id);
            await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'graduating', payload: { sent: sent.ok } });
          }
          summary.graduating += 1;
          continue;
        }
        // 3) půlroční check-in
        if (s.next_checkin_at && s.next_checkin_at <= nowIso && s.access_token) {
          if (!opts?.dryRun) {
            const mail = s.status === 'alumni' ? graduatingEmail(origin, s, until) : checkinEmail(origin, s);
            const sent = await sendMandrill({ toEmail: s.university_email, toName: `${s.first_name || ''} ${s.last_name || ''}`.trim(), subject: mail.subject, html: mail.html, tags: ['checkin'] });
            if (s.personal_email && s.status !== 'active') await sendMandrill({ toEmail: String(s.personal_email), subject: mail.subject, html: mail.html, tags: ['checkin-personal'] });
            const noResponseTwice = (Number(s.checkin_count) || 0) >= 2 && !s.last_response_at;
            await sb
              .from('student_program_students')
              .update({
                last_checkin_sent_at: nowIso,
                checkin_count: (Number(s.checkin_count) || 0) + 1,
                next_checkin_at: addDays(now, settings.checkinIntervalDays).toISOString(),
                ...(noResponseTwice && s.engagement === 'unknown' ? { engagement: 'inactive' } : {}),
              })
              .eq('id', s.id);
            await logEvent(sb, { studentId: s.id, facultyId: s.faculty_id, type: 'checkin_sent', payload: { sent: sent.ok, n: (Number(s.checkin_count) || 0) + 1 } });
          }
          summary.checkins += 1;
        }
      } catch (e) {
        summary.errors.push(`${s.university_email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4) denní digest pro Vítka / obchod
    if (settings.digestEmail && !opts?.dryRun) {
      try {
        const since = addDays(now, -1).toISOString();
        const faculties = await loadFaculties(sb);
        const { data: all } = await sb.from('student_program_students').select('*');
        const everyone = (all || []) as StudentRow[];
        const newVerified = everyone.filter((s) => s.verified_at && String(s.verified_at) >= since);
        const newRegistered = everyone.filter((s) => String(s.created_at || '') >= since);
        const responded = everyone.filter((s) => s.last_response_at && String(s.last_response_at) >= since);
        const goals = await readGoals();
        const ov = buildOverview(everyone, faculties, goals, settings);
        const needExt = ov.queues.facultiesNeedingExtension;
        const somethingHappened = newVerified.length || newRegistered.length || responded.length || needExt.length || summary.graduating || summary.expired || ov.queues.studentsWithoutCodes;
        if (somethingHappened) {
          const facById = new Map(faculties.map((f) => [f.id, f]));
          const li = (s: StudentRow) => `<li>${esc(s.first_name)} ${esc(s.last_name)} — ${esc(facById.get(String(s.faculty_id))?.faculty_short || '?')} (${esc(s.university_email)})</li>`;
          const content = [
            h2(`Studentský program — denní přehled ${now.toLocaleDateString('cs-CZ')}`),
            p(`<strong>${ov.totals.active}</strong> aktivních studentů z cíle ${goals.targetStudents} (${ov.progress.studentsPct ?? 0} %). Pokrytí PedF: ${ov.coverage.pedfCovered}/${ov.coverage.pedfTotal}. Partnerské fakulty: ${ov.coverage.partners}.`),
            newRegistered.length ? `<p style="margin:0 0 6px;font-weight:700;">Nové registrace (${newRegistered.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${newRegistered.map(li).join('')}</ul>` : '',
            newVerified.length ? `<p style="margin:0 0 6px;font-weight:700;">Ověřeno (${newVerified.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${newVerified.map(li).join('')}</ul>` : '',
            responded.length ? `<p style="margin:0 0 6px;font-weight:700;">Odpověděli na check-in (${responded.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${responded.map((s) => `<li>${esc(s.first_name)} ${esc(s.last_name)} — ${esc(s.status)}${s.employer_school_name ? `, škola: ${esc(s.employer_school_name)}` : ''}${s.uses_in_practice === true ? ', používá' : s.uses_in_practice === false ? ', nepoužívá' : ''}</li>`).join('')}</ul>` : '',
            summary.graduating || summary.expired ? p(`Dnes: ${summary.graduating} studentů přešlo do „končí studium“, ${summary.expired} přístupů skončilo, ${summary.checkins} check-inů odesláno.`) : '',
            needExt.length ? `<p style="margin:0 0 6px;font-weight:700;color:#b45309;">Prodloužit v legacy adminu (${needExt.length})</p><ul style="margin:0 0 16px;padding-left:20px;">${needExt.map((f) => `<li>${esc(f.facultyShort)} — platí do ${esc(f.codesValidUntil || 'neuvedeno')}, ${f.activeStudents} aktivních</li>`).join('')}</ul>` : '',
            ov.queues.studentsWithoutCodes ? p(`<span style="color:#b91c1c;">${ov.queues.studentsWithoutCodes} ověřených studentů je bez kódů — doplňte kódy fakulty v adminu.</span>`) : '',
            `<p style="margin:20px 0 0;text-align:center;">${buildVividbooksBrandCta(siteUrl(origin, '/marketing/studenti'), 'Otevřít admin Studenti')}</p>`,
          ].join('');
          const sent = await sendMandrill({ toEmail: settings.digestEmail, subject: `[Studenti] ${ov.totals.active} aktivních · ${newRegistered.length} nových · ${needExt.length} k prodloužení`, html: shell('Denní přehled', content, 'Interní přehled'), tags: ['digest'] });
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
