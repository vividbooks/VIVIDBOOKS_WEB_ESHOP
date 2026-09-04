import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendResendEmail } from './resendClient.ts';

/**
 * Kampaň „dorazíte dnes?“ — osobní textový e-mail přihlášeným na dnešní webinář.
 * Nový běh = nová položka (vlastní `confirm`, ať nejde odpálit omylem cizí seznam).
 */
type NudgeCampaign = {
  confirm: string;
  subject: string;
  /** Doplní se do věty „…na dnešní webinář {title}“. */
  title: string;
  /** Hodnota Resend tagu `webinar` — jen [a-zA-Z0-9_-]. */
  tag: string;
};

const NUDGE_CAMPAIGNS: Record<string, NudgeCampaign> = {
  'jak-nadchnout-zaky-pro-matematiku-na-2-stupni-2026': {
    confirm: 'math-2st-nudge-2026-09-01',
    subject: 'Dnešní webinář a nabídka přístupu',
    title: 'Jak nadchnout žáky pro matematiku na 2. stupni?',
    tag: 'math-2st-2026-09-01',
  },
  'jak-nadchnout-zaky-pro-matematiku-na-1-stupni-2026': {
    confirm: 'math-1st-nudge-2026-09-03',
    subject: 'Dnešní webinář a nabídka přístupu',
    title: 'Jak nadchnout žáky pro matematiku na 1. stupni?',
    tag: 'math-1st-2026-09-03',
  },
};

/**
 * Titul jako samostatný token. Lidé je píšou před jméno i za něj („Jana Kadlecová, Mgr.“),
 * proto se zahazují na obou koncích — jinak se z titulu stane příjmení v oslovení.
 */
const TITLE_TOKEN_RE =
  /^(mgr|ing|bc|bca|phdr|rndr|paeddr|paed\.dr|mudr|judr|mvdr|thdr|doc|prof|dr|dis|d\.i\.s|mba|ph\.?d|rsdr|dipl|akad|mga|thlic|lic)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MALE = new Set([
  'adam', 'aleš', 'ales', 'alexandr', 'alexander', 'andrej', 'antonín', 'antonin', 'anton',
  'bedřich', 'bedrich', 'bohumil', 'bohuslav', 'břetislav', 'ctibor', 'cyril', 'dalibor',
  'daniel', 'david', 'dominik', 'dušan', 'dusan', 'eduard', 'emil', 'erik', 'filip',
  'františek', 'frantisek', 'hynek', 'igor', 'ivan', 'ivo', 'jakub', 'jan', 'jaromír',
  'jaromir', 'jaroslav', 'jindřich', 'jindrich', 'jiří', 'jiri', 'josef', 'kamil', 'karel',
  'kryštof', 'krystof', 'ladislav', 'libor', 'lubomír', 'lubomir', 'luboš', 'lubos',
  'luděk', 'ludek', 'lukáš', 'lukas', 'marcel', 'marek', 'marian', 'martin', 'matěj',
  'matej', 'matouš', 'matous', 'matyáš', 'matyas', 'michal', 'miloslav', 'miloš', 'milos',
  'milan', 'miroslav', 'oldřich', 'oldrich', 'ondřej', 'ondrej', 'otakar', 'patrik',
  'pavel', 'petr', 'přemysl', 'premysl', 'radek', 'radim', 'richard', 'robert', 'roman',
  'rostislav', 'rudolf', 'stanislav', 'šimon', 'simon', 'štěpán', 'stepan', 'tadeáš',
  'tadeas', 'tomáš', 'tomas', 'václav', 'vaclav', 'viktor', 'vít', 'vítek', 'vitek',
  'vladimír', 'vladimir', 'vladislav', 'vojtěch', 'vojtech', 'zdeněk', 'zdenek', 'zbyněk',
  'zbynek', 'štefan', 'stefan', 'jáchym', 'jonáš', 'jonas', 'sebastian', 'oliver',
  'kristián', 'kristian', 'honza', 'jirka', 'kuba', 'denis', 'dennis', 'gabriel',
]);

const FEMALE = new Set([
  'andrea', 'nikola', 'dagmar', 'ingrid', 'karin', 'nicole', 'nicol', 'nikol', 'ester',
  'alice', 'lucie', 'marie', 'žofie', 'zofie', 'sofie', 'terezie', 'natálie', 'natalie',
  'julie', 'nela', 'sára', 'sara', 'hanna', 'nina', 'inna', 'michaela', 'eliška',
  'eliska', 'žaneta', 'zaneta', 'věra', 'vera', 'iryna', 'irina',
]);

/** Jméno rozpadlé na tokeny bez titulů a interpunkce. */
function nameTokens(full: string): string[] {
  return String(full || '')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !TITLE_TOKEN_RE.test(t.replace(/\.+$/, '')));
}

export function stripTitles(full: string): string {
  return nameTokens(full).join(' ');
}

function firstLast(full: string): { first: string; last: string } {
  const parts = nameTokens(full);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function genderOf(first: string): 'm' | 'f' | 'u' {
  const f = first.toLowerCase().trim();
  if (!f) return 'u';
  if (FEMALE.has(f)) return 'f';
  if (MALE.has(f)) return 'm';
  if (/(oslav|omír|omir|islav)$/.test(f)) return 'm';
  if (/[ae]$/.test(f) || /ie$/.test(f)) return 'f';
  return 'm';
}

function vocativeMaleLast(last: string): string {
  const low = last.toLowerCase();
  if (/(ý|í|y|i)$/.test(low)) return last;
  if (low.endsWith('ek')) return `${last.slice(0, -2)}ku`;
  if (low.endsWith('ec')) return `${last.slice(0, -2)}če`;
  if (low.endsWith('el')) return `${last.slice(0, -2)}le`;
  if (low.endsWith('a')) return `${last.slice(0, -1)}o`;
  if (/[rndtlkmpbvzscxghčřšžďťň]$/i.test(last)) return `${last}u`;
  return last;
}

export function formalGreeting(fullName: string): string {
  const { first, last } = firstLast(fullName);
  const g = genderOf(first);
  if (!first) return 'Dobrý den,';
  if (last.length > 0 && last.length <= 2) return 'Dobrý den,';
  if (!last) {
    return g === 'f' ? `Dobrý den, paní ${first}` : `Dobrý den, pane ${first}`;
  }
  if (g === 'f') return `Dobrý den, paní ${last}`;
  return `Dobrý den, pane ${vocativeMaleLast(last)}`;
}

/** Prostý text — v klientovi vypadá jako obyčejná osobní zpráva, ne jako šablona. */
export function buildNudgeText(greeting: string, webinarTitle: string): string {
  const g = greeting.replace(/,\s*$/, '');
  return [
    `${g},`,
    '',
    `děkujeme za přihlášení na dnešní webinář ${webinarTitle}`,
    '',
    'Jen se chci zeptat, jestli dnes v 18:00 dorazíte a jestli máte odkaz na připojení. Když ne, napište — hned ho pošlu.',
    '',
    'A pokud ještě nemáte přístup k materiálům matematiky ve Vividbooks, ozvěte se — pošlu vám ho, ať ho na večer máte.',
    '',
    'Stačí odepsat na tenhle mail.',
    '',
    'Vítek Škop',
    'Vividbooks',
  ].join('\n');
}

function isValidRecipientEmail(email: string): boolean {
  if (!EMAIL_RE.test(email)) return false;
  if (email.startsWith('mailto:')) return false;
  if (email.endsWith('@vividbooks.com')) return false;
  if (!email.includes('.')) return false;
  if (/[^\x00-\x7F]/.test(email)) return false;
  return true;
}

function sentKey(webinarId: string, email: string): string {
  return `vb:webinar-access-nudge:${webinarId}:${email}`;
}

type Reg = {
  email?: string;
  name?: string;
  usesVividbooks?: string;
};

function eligibleRegs(regs: Reg[], onlyWithoutAccess: boolean): { email: string; name: string }[] {
  const out: { email: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const reg of regs) {
    const email = String(reg.email || '').toLowerCase().trim();
    if (!isValidRecipientEmail(email) || seen.has(email)) continue;
    if (onlyWithoutAccess && String(reg.usesVividbooks || '').toLowerCase() !== 'no') continue;
    seen.add(email);
    out.push({ email, name: String(reg.name || '').trim() });
  }
  out.sort((a, b) => a.email.localeCompare(b.email));
  return out;
}

export async function adminPersonalReplySendHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (String(body?.confirm || '') !== 'webinar-replies-2026-09-01') {
      return c.json({ ok: false, error: 'Chybí confirm.' }, 400);
    }
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length || items.length > 15) {
      return c.json({ ok: false, error: 'Položek 1–15.' }, 400);
    }
    const sent: { to: string; id?: string }[] = [];
    const failed: { to: string; error: string }[] = [];
    for (const item of items) {
      const to = String(item?.to || '').toLowerCase().trim();
      const subject = String(item?.subject || '').trim();
      const html = String(item?.html || '').trim();
      if (!to || !subject || !html) {
        failed.push({ to, error: 'missing fields' });
        continue;
      }
      const result = await sendResendEmail({
        to,
        subject,
        html,
        tags: [{ name: 'kind', value: 'webinar-reply' }],
      });
      if (!result.ok) failed.push({ to, error: result.error });
      else sent.push({ to, id: result.id });
    }
    return c.json({ ok: failed.length === 0, sent: sent.length, failed });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || String(e) }, 500);
  }
}

export async function adminWebinarAccessNudgeHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const webinarId = String(body?.webinarId || '').trim();
    const confirm = String(body?.confirm || '').trim();
    const dryRun = body?.dryRun === true;
    const limit = Math.min(30, Math.max(1, Number(body?.limit) || 20));
    const afterEmail = String(body?.afterEmail || '').toLowerCase().trim();
    /** Výchozí = jen ti, co Vividbooks nemají (stejně jako první běh 1. 9.). */
    const onlyWithoutAccess = body?.onlyWithoutAccess !== false;

    const campaign = NUDGE_CAMPAIGNS[webinarId];
    if (!campaign) {
      return c.json(
        { ok: false, error: 'Neznámý webinarId.', known: Object.keys(NUDGE_CAMPAIGNS) },
        400,
      );
    }
    if (confirm !== campaign.confirm) {
      return c.json({ ok: false, error: 'Chybí nebo nesedí confirm.' }, 400);
    }

    const regs = (await kv.getByPrefix(`webinar_reg_${webinarId}_`)) as Reg[];
    const eligible = eligibleRegs(regs || [], onlyWithoutAccess);
    const remaining = eligible.filter((r) => !afterEmail || r.email > afterEmail);

    if (dryRun) {
      return c.json({
        ok: true,
        dryRun: true,
        webinarId,
        subject: campaign.subject,
        onlyWithoutAccess,
        eligible: eligible.length,
        remaining: remaining.length,
        preview: buildNudgeText(formalGreeting(remaining[0]?.name || ''), campaign.title),
        sample: remaining.slice(0, 8).map((r) => ({
          email: r.email,
          greeting: formalGreeting(r.name),
        })),
      });
    }

    const sent: { email: string; id?: string }[] = [];
    const skipped: { email: string; reason: string }[] = [];
    const failed: { email: string; error: string }[] = [];
    let lastEmail = afterEmail;
    let quotaHit = false;

    for (const rec of remaining) {
      if (sent.length >= limit) break;
      lastEmail = rec.email;
      const already = await kv.get(sentKey(webinarId, rec.email));
      if (already) {
        skipped.push({ email: rec.email, reason: 'already_sent' });
        continue;
      }
      const text = buildNudgeText(formalGreeting(rec.name), campaign.title);
      const result = await sendResendEmail({
        to: rec.email,
        subject: campaign.subject,
        text,
        tags: [
          { name: 'kind', value: 'webinar-access-nudge' },
          { name: 'webinar', value: campaign.tag },
        ],
      });
      if (!result.ok) {
        failed.push({ email: rec.email, error: result.error });
        if (/daily_quota|quota_exceeded/i.test(result.error)) {
          quotaHit = true;
          break;
        }
        continue;
      }
      await kv.set(sentKey(webinarId, rec.email), {
        sentAt: new Date().toISOString(),
        resendId: result.id,
        greeting: formalGreeting(rec.name),
      });
      sent.push({ email: rec.email, id: result.id });
    }

    const left = eligible.filter((r) => r.email > lastEmail).length;

    return c.json({
      ok: failed.length === 0 && !quotaHit,
      sent: sent.length,
      skipped: skipped.length,
      failed,
      lastEmail,
      remaining: left,
      eligible: eligible.length,
      quotaHit,
    });
  } catch (e: any) {
    return c.json({ ok: false, error: e?.message || String(e) }, 500);
  }
}
