/**
 * DVPP zdarma — čistá logika bez Deno/Supabase závislostí (testuje se v scripts/run-unit-tests.ts).
 *
 * - milník sborovny podle velikosti sboru
 * - odhad počtu pedagogů z počtu žáků
 * - doména školního e-mailu vs. freemail
 * - stav sborovny po přepočtu
 * - úroveň přístupu do knihovny
 * - školní kód
 */

/** Freemaily, u kterých doména nic neříká o škole (polovina báze). */
export const FREEMAIL_DOMAINS = new Set([
  'seznam.cz', 'gmail.com', 'centrum.cz', 'email.cz', 'post.cz', 'yahoo.com', 'volny.cz',
  'icloud.com', 'hotmail.com', 'centrum.sk', 'atlas.cz', 'aol.com', 'outlook.com', 'hotmail.cz',
  'tiscali.cz', 'azet.sk', 'me.com', 'live.com', 'protonmail.com', 'proton.me', 'outlook.cz',
  'gmail.cz', 'o2.cz', 'quick.cz', 'post.sk', 'zoznam.sk', 'yahoo.co.uk', 'msn.com', 'email.com',
  'seznam.sk', 'inmail.sk', 'googlemail.com', 'raz-dva.cz', 'chello.cz', 'iol.cz', 'wo.cz', 'volny.sk',
]);

export function emailDomain(email: string): string {
  const at = String(email || '').trim().toLowerCase().lastIndexOf('@');
  if (at < 0) return '';
  return String(email).trim().toLowerCase().slice(at + 1);
}

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(String(domain || '').toLowerCase());
}

/** Doména, podle které se dá kontakt spárovat se školou; '' u freemailu. */
export function schoolDomainFromEmail(email: string): string {
  const d = emailDomain(email);
  if (!d || isFreemailDomain(d)) return '';
  return d;
}

/** Doména z webu školy nebo e-mailu ředitele v rejstříku (bez www, bez cesty). */
export function domainFromWebOrEmail(value: string): string {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('@')) return schoolDomainFromEmail(v);
  const noProto = v.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const host = noProto.split(/[/?#]/)[0];
  if (!host.includes('.')) return '';
  return isFreemailDomain(host) ? '' : host;
}

/**
 * Milník sborovny (potvrzení a aktivovaní kolegové) podle velikosti sboru.
 * Kapitola 4 strategie: 4 / 8 / 12 / 16, neznámá velikost = 8.
 */
export function milestoneTargetForTeachers(teachersCount: number | null | undefined): number {
  const n = Number(teachersCount);
  if (!Number.isFinite(n) || n <= 0) return 8;
  if (n <= 10) return 4;
  if (n <= 25) return 8;
  if (n <= 50) return 12;
  return 16;
}

/**
 * Odhad počtu pedagogů, když výkaz chybí: cca 1 učitel na 12 žáků na ZŠ, min. 3.
 * Malotřídka (jen 1. stupeň, do 60 žáků) má typicky 3–6 pedagogů.
 */
export function estimateTeachersFromPupils(pupilsCount: number | null | undefined): number | null {
  const p = Number(pupilsCount);
  if (!Number.isFinite(p) || p <= 0) return null;
  return Math.max(3, Math.round(p / 12));
}

export type StaffroomStatus = 'building' | 'unlocked' | 'grace' | 'expired';

export type StaffroomRecountInput = {
  status: StaffroomStatus;
  target: number;
  confirmed: number;
  graceUntil: string | null;
  now: Date;
  /** Odemčeno ředitelem / zákazník / ručně = milník se nehlídá. */
  pinned: boolean;
};

export type StaffroomRecountResult = {
  status: StaffroomStatus;
  graceUntil: string | null;
  unlockedNow: boolean;
};

export const GRACE_DAYS = 30;

/**
 * Přepočet stavu sborovny (cron denně + po každém potvrzení):
 * building → unlocked při dosažení milníku; unlocked → grace při poklesu (30 dní);
 * grace → unlocked při návratu, → expired po vypršení lhůty; expired → unlocked při návratu.
 */
export function recountStaffroom(input: StaffroomRecountInput): StaffroomRecountResult {
  const { status, target, confirmed, graceUntil, now, pinned } = input;
  if (pinned) return { status: 'unlocked', graceUntil: null, unlockedNow: status !== 'unlocked' };
  const reached = confirmed >= target;
  if (reached) return { status: 'unlocked', graceUntil: null, unlockedNow: status !== 'unlocked' };
  if (status === 'building') return { status: 'building', graceUntil: null, unlockedNow: false };
  if (status === 'unlocked') {
    const until = new Date(now.getTime() + GRACE_DAYS * 86400_000).toISOString();
    return { status: 'grace', graceUntil: until, unlockedNow: false };
  }
  if (status === 'grace') {
    const untilMs = graceUntil ? Date.parse(graceUntil) : NaN;
    if (Number.isFinite(untilMs) && untilMs > now.getTime()) {
      return { status: 'grace', graceUntil, unlockedNow: false };
    }
    return { status: 'expired', graceUntil: null, unlockedNow: false };
  }
  return { status: 'expired', graceUntil: null, unlockedNow: false };
}

export type AccessLevel = 'guest' | 'starter' | 'full';

export type AccessInput = {
  loggedIn: boolean;
  staffroomStatus: StaffroomStatus | null;
  /** Kolik potvrzených kolegů tento člověk přivedl. */
  referredConfirmed: number;
  isCustomer: boolean;
  /** Platnost individuálního přístupu (rok za prvního kolegu). */
  personalAccessUntil: string | null;
  now: Date;
};

/** Kolik záznamů smí „starter“ (přihlášený bez sborovny) otevřít. */
export const STARTER_RECORDINGS_LIMIT = 3;

/**
 * Úroveň přístupu do knihovny:
 * full   = sborovna odemčená (i v ochranné lhůtě), zákazník, nebo přivedl aspoň 1 kolegu (rok)
 * starter = přihlášený, 3 záznamy
 * guest  = nepřihlášený, jen upoutávky a prvních 10 minut
 */
export function resolveAccessLevel(input: AccessInput): AccessLevel {
  if (!input.loggedIn) return 'guest';
  if (input.isCustomer) return 'full';
  if (input.staffroomStatus === 'unlocked' || input.staffroomStatus === 'grace') return 'full';
  if (input.referredConfirmed >= 1) return 'full';
  if (input.personalAccessUntil && Date.parse(input.personalAccessUntil) > input.now.getTime()) return 'full';
  return 'starter';
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez 0/O, 1/I/L

/** Školní kód: 6 znaků z abecedy bez zaměnitelných znaků, např. „K7PX4M“. */
export function staffroomCodeFromRandom(randomBytes: Uint8Array, length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const b = randomBytes[i % randomBytes.length] ?? 0;
    out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeStaffroomCode(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').slice(0, 8);
}

/** Pozice, které smí odemknout sborovnu jako vedení školy. */
export function isDirectorPosition(positionLabel: string | null | undefined): boolean {
  const p = String(positionLabel || '').toLowerCase();
  return (
    p.includes('ředitel') || p.includes('reditel') || p.includes('headmaster') ||
    p.includes('deputy') || p.includes('zástup') || p.includes('zastup')
  );
}

/**
 * Stav školy z počtu aktivních kontaktů a sborovny (kapitola 6 strategie).
 */
export function schoolStatusFrom(input: {
  isCustomer: boolean;
  staffroomStatus: StaffroomStatus | null;
  activeContacts: number;
  everHadContacts: boolean;
}): 'customer' | 'staffroom' | 'active' | 'trace' | 'blank' | 'lost' {
  if (input.isCustomer) return 'customer';
  if (input.staffroomStatus === 'unlocked' || input.staffroomStatus === 'grace') return 'staffroom';
  if (input.activeContacts >= 3) return 'active';
  if (input.activeContacts >= 1) return 'trace';
  return input.everHadContacts ? 'lost' : 'blank';
}

/** Typ učitele z odpovědí kvízu — deterministické skórování, sdílené se serverem i klientem. */
export type TeacherType = 'badatel' | 'trener' | 'vypravec' | 'architekt';

export function teacherTypeFromAnswers(answers: Record<string, string | string[] | undefined>): TeacherType {
  const score: Record<TeacherType, number> = { badatel: 0, trener: 0, vypravec: 0, architekt: 0 };
  const pain = String(answers.pain_point || '');
  if (pain === 'motivace') { score.vypravec += 2; score.badatel += 1; }
  if (pain === 'diferenciace') { score.trener += 2; score.architekt += 1; }
  if (pain === 'ai') { score.architekt += 2; score.badatel += 1; }
  if (pain === 'svp') { score.architekt += 2; }
  if (pain === 'hodnoceni') { score.trener += 2; }
  if (pain === 'tabule') { score.vypravec += 1; score.badatel += 1; }
  const style = String(answers.style || '');
  if (style === 'objevovani') score.badatel += 3;
  if (style === 'procvicovani') score.trener += 3;
  if (style === 'vyklad') score.vypravec += 3;
  if (style === 'planovani') score.architekt += 3;
  const subjects = Array.isArray(answers.subjects) ? answers.subjects : [];
  if (subjects.some((s) => ['fyzika', 'chemie', 'prirodopis', 'prvouka'].includes(String(s)))) score.badatel += 1;
  if (subjects.includes('matematika')) score.trener += 1;
  const order: TeacherType[] = ['badatel', 'trener', 'vypravec', 'architekt'];
  return order.reduce((best, t) => (score[t] > score[best] ? t : best), 'badatel');
}
