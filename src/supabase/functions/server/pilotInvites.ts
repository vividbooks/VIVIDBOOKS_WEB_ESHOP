/**
 * Pilotáž matematiky — pozvání kolegů z přihlášky na /matematika-pilotovani.
 *
 *   POST /pilot/school-lookup  { email }  → škola podle e-mailu učitele (Kabinet trial-check, bez kódů)
 *   POST /pilot/invite         { inviterEmail, inviterName, emails[], message, subjects[], mode }
 *        mode 'invite' — pozvánka do školy pozvávajícího (škola musí být v Kabinetu)
 *        mode 'tip'    — tip na pilotáž pro kolegu nebo vedení (bez kódu školy)
 *
 * Kód školy se nikdy nevrací do prohlížeče. Do pozvánky jde jen tehdy, když má kolega adresu
 * ve stejné školní doméně jako pozvávající; ostatním přijde pozvánka bez kódu („kód vám dá …“).
 * Pozvávající dostane kopii se seznamem adres, takže pozná, kdyby pozvánky poslal někdo jiný jeho jménem.
 *
 * Secrets: KABINET_SECRET (= REGISTR_MAKE_SECRET v Kabinetu), volitelně KABINET_API_BASE, KABINET_ANON_KEY;
 * pošta přes `_shared/transactional-mail.ts` (Resend).
 */
import type { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { emailDomain, isFreemailDomain } from './dvpp/milestones.ts';
import { sendTransactionalMail, transactionalMailKey } from '../../../../supabase/functions/_shared/transactional-mail.ts';
import { EMAIL_FORCE_LIGHT_HEAD } from '../../../../supabase/functions/_shared/email-force-light.ts';
import { buildVividbooksBrandCta, buildVividbooksBrandShell } from '../../../../supabase/functions/_shared/email-brand-shell.ts';

const DEFAULT_KABINET_BASE = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api/registr/hooks/web';
const DEFAULT_KABINET_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGl1dnFnbHNteGRzbnlhemloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjU3NDAsImV4cCI6MjA4NjQwMTc0MH0.lVO7a-wuM2vkqsJcgqvLkthTmrt5g0R3U_Tu0jU7bfY';
const APP_LOGIN_URL = 'https://nove.vividbooks.com/prihlaseni/ucitel';

export const MAX_INVITES_PER_REQUEST = 15;
export const MAX_INVITES_PER_DAY = 30;
export const INVITE_DEDUPE_DAYS = 14;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Eligibility = {
  ok?: boolean;
  status?: string;
  known?: boolean;
  emailKnown?: boolean;
  organizationIds?: string[];
  primaryOrganizationId?: string | null;
  organizationName?: string | null;
  teacherCode?: string | null;
  activeTrial?: { endsOn?: string | null } | null;
  paidSubjects?: string[];
};

const SUBJECT_LABELS: [RegExp, string][] = [
  [/^math/i, 'Matematiku'],
  [/^phys/i, 'Fyziku'],
  [/^chem/i, 'Chemii'],
  [/^(biol|nature|prirod)/i, 'Přírodopis'],
  [/^(prvouk|primary-science|world)/i, 'Prvouku'],
  [/^(czech|cesk|cj)/i, 'Český jazyk'],
  [/^(geo|zemep)/i, 'Zeměpis'],
  [/^(hist|dejep)/i, 'Dějepis'],
];

export function subjectLabels(codes: string[] | undefined): string[] {
  const out: string[] = [];
  for (const code of codes || []) {
    const hit = SUBJECT_LABELS.find(([re]) => re.test(String(code)));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
  }
  return out;
}

export function normalizeEmails(list: unknown, exclude: string): string[] {
  const raw = Array.isArray(list) ? list : String(list || '').split(/[\s,;]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const e = String(item || '').trim().toLowerCase();
    if (!e || e === exclude || seen.has(e) || !EMAIL_RE.test(e)) continue;
    seen.add(e);
    out.push(e);
    if (out.length >= MAX_INVITES_PER_REQUEST) break;
  }
  return out;
}

/** Kód školy smí do pozvánky jen na adresu ve stejné školní (ne freemail) doméně jako pozvávající. */
export function mayShareCode(inviterEmail: string, colleagueEmail: string): boolean {
  const d = emailDomain(inviterEmail);
  return !!d && !isFreemailDomain(d) && emailDomain(colleagueEmail) === d;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cleanText(s: unknown, max: number): string {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/[\r\t]+/g, ' ').trim().slice(0, max);
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function kabinetCheck(email: string): Promise<Eligibility | null> {
  const secret = (Deno.env.get('KABINET_SECRET') || '').trim();
  if (!secret) throw new Error('KABINET_SECRET není nastavený.');
  const base = (Deno.env.get('KABINET_API_BASE') || DEFAULT_KABINET_BASE).replace(/\/+$/, '');
  const anon = (Deno.env.get('KABINET_ANON_KEY') || DEFAULT_KABINET_ANON).trim();
  const res = await fetch(`${base}/trial-check?email=${encodeURIComponent(email)}`, {
    headers: { 'x-registr-secret': secret, 'x-registr-client': 'web-pilot-invite', apikey: anon, Authorization: `Bearer ${anon}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Kabinet odpověděl ${res.status}.`);
  return (await res.json().catch(() => null)) as Eligibility | null;
}

function hasSchool(e: Eligibility | null): e is Eligibility & { primaryOrganizationId: string } {
  return !!e && e.known === true && !!e.primaryOrganizationId;
}

async function sendMail(opts: { to: string; subject: string; html: string; fromName: string; replyTo: string; tag: string }): Promise<boolean> {
  const key = transactionalMailKey();
  if (!key) return false;
  try {
    const res = await sendTransactionalMail({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        message: {
          html: opts.html,
          subject: opts.subject,
          from_email: 'hello@vividbooks.com',
          from_name: opts.fromName,
          to: [{ email: opts.to, name: opts.to, type: 'to' }],
          headers: { 'Reply-To': opts.replyTo },
          tags: [opts.tag],
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as Array<{ status?: string }> | null;
    return res.ok && Array.isArray(data) && data.some((r) => r.status === 'sent' || r.status === 'queued');
  } catch (err) {
    console.warn('[pilot/invite] odeslání selhalo:', err instanceof Error ? err.message : err);
    return false;
  }
}

function subjectList(subjects: string[]): string {
  const items: string[] = [];
  if (subjects.includes('mat')) items.push('<li style="margin:0 0 6px;"><strong>Matematika</strong>: interaktivní učebnice, pracovní listy a procvičování</li>');
  if (subjects.includes('prij')) items.push('<li style="margin:0 0 6px;"><strong>Přijímací zkoušky</strong>: testy Cermat od roku 2015 a test nanečisto s časomírou</li>');
  if (!items.length) return '';
  return `<p style="margin:0 0 6px;font-size:16px;color:#4a5568;">Co v aplikaci najdete:</p><ul style="margin:0 0 20px;padding-left:20px;font-size:16px;color:#4a5568;line-height:1.6;">${items.join('')}</ul>`;
}

function quote(message: string): string {
  return message
    ? `<blockquote style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #7C3AED;background:#f3eeff;border-radius:0 10px 10px 0;font-size:15px;color:#333;line-height:1.6;">${esc(message).replace(/\n/g, '<br>')}</blockquote>`
    : '';
}

export function buildInviteEmailHtml(opts: {
  inviterName: string; schoolName: string; message: string; subjects: string[]; teacherCode: string | null;
}): string {
  const who = firstName(opts.inviterName);
  const url = opts.teacherCode ? `${APP_LOGIN_URL}?kod=${encodeURIComponent(opts.teacherCode)}` : APP_LOGIN_URL;
  const codeNote = opts.teacherCode
    ? `Kód školy pro učitele se vyplní sám. Kdyby ho aplikace chtěla: <strong style="color:#001161;">${esc(opts.teacherCode)}</strong>.`
    : `Při zakládání účtu zadáte kód školy pro učitele. Dá vám ho ${esc(who)} nebo vedení školy.`;
  return buildVividbooksBrandShell({
    title: `${opts.inviterName} vás zve do Vividbooks`,
    headerSubtitle: opts.schoolName,
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
    content:
      `<p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#001161;line-height:1.25;">${esc(opts.inviterName)} vás zve do Vividbooks</p>` +
      `<p style="margin:0 0 18px;font-size:16px;color:#4a5568;line-height:1.6;">Dobrý den,<br>${esc(who)} z vaší školy (<strong style="color:#001161;">${esc(opts.schoolName)}</strong>) vás zve do aplikace Vividbooks. Škola má matematiku a Přijímací zkoušky zdarma do konce školního roku, pro všechny učitele i žáky.</p>` +
      quote(opts.message) +
      subjectList(opts.subjects) +
      `<p style="margin:0 0 20px;">${buildVividbooksBrandCta(url, 'Vytvořit si účet')}</p>` +
      `<p style="margin:0 0 10px;font-size:13px;color:#718096;line-height:1.6;">${codeNote}</p>` +
      `<p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">Tenhle e-mail odešel jednorázově na přání odesílatele. Pokud odesílatele neznáte, e-mail ignorujte.</p>`,
    footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Odesláno přes vividbooks.com (Vividbooks s.r.o.) na přání odesílatele: ${esc(opts.inviterName)}.</p>`,
  });
}

export function buildTipEmailHtml(opts: { inviterName: string; message: string; pilotUrl: string }): string {
  const who = firstName(opts.inviterName);
  return buildVividbooksBrandShell({
    title: `${opts.inviterName} vám posílá tip na matematiku Vividbooks`,
    headerSubtitle: 'Pilotáž matematiky 2026/27',
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
    content:
      `<p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#001161;line-height:1.25;">${esc(opts.inviterName)} vám posílá tip na matematiku Vividbooks</p>` +
      `<p style="margin:0 0 18px;font-size:16px;color:#4a5568;line-height:1.6;">${esc(who)} chce vyzkoušet Vividbooks s celou školou. Do konce školního roku je to pro školy zdarma: matematika pro 1. i 2. stupeň a aplikace Přijímací zkoušky, pro všechny učitele i žáky.</p>` +
      quote(opts.message) +
      `<p style="margin:0 0 20px;">${buildVividbooksBrandCta(opts.pilotUrl, 'Přihlásit školu do pilotáže')}</p>` +
      `<p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">Přihláška zabere minutu. Tenhle e-mail odešel jednorázově na přání odesílatele. Pokud odesílatele neznáte, e-mail ignorujte.</p>`,
    footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Odesláno přes vividbooks.com (Vividbooks s.r.o.) na přání odesílatele: ${esc(opts.inviterName)}.</p>`,
  });
}

function buildInviterCopyHtml(opts: { inviterName: string; mode: 'invite' | 'tip'; sent: string[] }): string {
  const list = opts.sent.map((e) => `<li style="margin:0 0 4px;">${esc(e)}</li>`).join('');
  const what = opts.mode === 'tip' ? 'tip na pilotáž matematiky' : 'pozvánku do Vividbooks';
  return buildVividbooksBrandShell({
    title: 'Pozvánky odešly',
    headerSubtitle: 'Pilotáž matematiky 2026/27',
    headExtra: EMAIL_FORCE_LIGHT_HEAD,
    content:
      `<p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#001161;line-height:1.25;">Poslali jsme ${what}</p>` +
      `<p style="margin:0 0 10px;font-size:16px;color:#4a5568;line-height:1.6;">${esc(firstName(opts.inviterName))}, vaším jménem odešlo na tyto adresy:</p>` +
      `<ul style="margin:0 0 18px;padding-left:20px;font-size:15px;color:#4a5568;line-height:1.6;">${list}</ul>` +
      `<p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">Pozvánky jste neposílali? Napište nám na hello@vividbooks.com.</p>`,
  });
}

function json(c: any, body: unknown, status = 200) {
  return c.json(body, status);
}

export function registerPilotInviteRoutes(app: Hono, deps: { publicOrigin: () => string }): void {
  app.post('/make-server-93a20b6f/pilot/school-lookup', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json(c, { ok: false, message: 'Zadejte platný e-mail.' }, 400);
    try {
      const e = await kabinetCheck(email);
      if (!hasSchool(e)) return json(c, { ok: true, found: false });
      return json(c, {
        ok: true,
        found: true,
        schoolName: e.organizationName || 'Vaše škola',
        status: e.status || '',
        subjects: subjectLabels(e.paidSubjects),
        trialEndsOn: e.activeTrial?.endsOn || null,
      });
    } catch (err) {
      console.error('[pilot/school-lookup]', err instanceof Error ? err.message : err);
      return json(c, { ok: false, message: 'Školu se teď nepodařilo ověřit. Zkuste to prosím za chvíli.' }, 502);
    }
  });

  app.post('/make-server-93a20b6f/pilot/invite', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const mode: 'invite' | 'tip' = body.mode === 'tip' ? 'tip' : 'invite';
    const inviterEmail = String(body.inviterEmail || '').trim().toLowerCase();
    const inviterName = cleanText(body.inviterName, 80) || 'Kolega ze školy';
    const message = cleanText(body.message, 600);
    const subjects = (Array.isArray(body.subjects) ? body.subjects : ['mat', 'prij']).map(String);
    if (!EMAIL_RE.test(inviterEmail)) return json(c, { ok: false, message: 'Zadejte svůj platný e-mail.' }, 400);
    const emails = normalizeEmails(body.emails, inviterEmail);
    if (!emails.length) return json(c, { ok: false, message: 'Zadejte alespoň jeden e-mail kolegy.' }, 400);
    if (!transactionalMailKey()) return json(c, { ok: false, message: 'Odesílání e-mailů teď nefunguje. Zkuste to prosím později.' }, 503);

    const day = new Date().toISOString().slice(0, 10);
    const rlKey = `pilot_invite_rl:${await sha256Hex(inviterEmail)}:${day}`;
    const usedToday = Number((await kv.get(rlKey))?.count || 0);
    if (usedToday + emails.length > MAX_INVITES_PER_DAY) {
      return json(c, { ok: false, message: `Za den můžete poslat nejvýš ${MAX_INVITES_PER_DAY} pozvánek. Zkuste to prosím zítra.` }, 429);
    }

    let inviter: Eligibility | null = null;
    try {
      inviter = await kabinetCheck(inviterEmail);
    } catch (err) {
      console.error('[pilot/invite] kabinet', err instanceof Error ? err.message : err);
      return json(c, { ok: false, message: 'Školu se teď nepodařilo ověřit. Zkuste to prosím za chvíli.' }, 502);
    }
    if (mode === 'invite' && !hasSchool(inviter)) {
      return json(c, { ok: false, code: 'SCHOOL_UNKNOWN', message: 'Váš e-mail u nás nemáme, a tak nevíme, do které školy kolegy pozvat.' }, 404);
    }
    const schoolName = inviter?.organizationName || 'vaše škola';
    const orgId = inviter?.primaryOrganizationId || null;
    const pilotUrl = `${deps.publicOrigin()}/matematika-pilotovani#prihlaska`;

    const results: { email: string; status: 'sent' | 'has_account' | 'already_invited' | 'failed' }[] = [];
    for (const email of emails) {
      const dedupeKey = `pilot_invite_to:${mode}:${await sha256Hex(email)}`;
      const prev = await kv.get(dedupeKey);
      if (prev?.at && Date.now() - Date.parse(prev.at) < INVITE_DEDUPE_DAYS * 864e5) {
        results.push({ email, status: 'already_invited' });
        continue;
      }
      if (mode === 'invite' && orgId) {
        const colleague = await kabinetCheck(email).catch(() => null);
        if (hasSchool(colleague) && (colleague.organizationIds || [colleague.primaryOrganizationId]).includes(orgId)) {
          results.push({ email, status: 'has_account' });
          continue;
        }
      }
      const html =
        mode === 'tip'
          ? buildTipEmailHtml({ inviterName, message, pilotUrl })
          : buildInviteEmailHtml({
              inviterName, schoolName, message, subjects,
              teacherCode: inviter?.teacherCode && mayShareCode(inviterEmail, email) ? inviter.teacherCode : null,
            });
      const subject = mode === 'tip' ? `${inviterName} vám posílá tip na matematiku Vividbooks` : `${inviterName} vás zve do Vividbooks`;
      const ok = await sendMail({ to: email, subject, html, fromName: `${inviterName} přes Vividbooks`, replyTo: inviterEmail, tag: `pilot_${mode}` });
      results.push({ email, status: ok ? 'sent' : 'failed' });
      if (ok) await kv.set(dedupeKey, { at: new Date().toISOString(), orgId });
    }

    const sent = results.filter((r) => r.status === 'sent').map((r) => r.email);
    if (sent.length) {
      await kv.set(rlKey, { count: usedToday + sent.length });
      await kv.set(`pilot_invite_log:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`, {
        mode, inviterEmail, inviterName, schoolName, orgId, sent, results, at: new Date().toISOString(),
      });
      await sendMail({
        to: inviterEmail,
        subject: mode === 'tip' ? 'Tip na pilotáž jsme poslali' : 'Pozvánky do Vividbooks odešly',
        html: buildInviterCopyHtml({ inviterName, mode, sent }),
        fromName: 'Vividbooks',
        replyTo: 'hello@vividbooks.com',
        tag: 'pilot_invite_copy',
      });
    }
    return json(c, { ok: true, results });
  });
}
