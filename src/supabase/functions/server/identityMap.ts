/**
 * Kanonické mapování pro graf identit. Musí sedět s SQL:
 * identity_normalize_ico, identity_normalize_phone, identity_map_subject_token,
 * mailing_canonical_role, identity_map_email_source.
 */
import { normalizeCzechPhone } from '../../../utils/phoneCZ.ts';

export const IDENTITY_ROLES = [
  'teacher',
  'director',
  'deputy',
  'parent',
  'student',
  'homeschool',
  'school_admin',
  'other',
  'unknown',
] as const;

export type IdentityRole = (typeof IDENTITY_ROLES)[number];

export const IDENTITY_SUBJECTS = [
  'matematika',
  'fyzika',
  'chemie',
  'prirodopis',
  'prvouka',
  'cesky-jazyk',
  'other',
] as const;

export type IdentitySubject = (typeof IDENTITY_SUBJECTS)[number];

export const IDENTITY_EMAIL_SOURCES = [
  'mailchimp',
  'webinar',
  'checkout',
  'app',
  'pipedrive',
  'vb_id',
  'trial',
  'newsletter',
  'other',
] as const;

export type IdentityEmailSource = (typeof IDENTITY_EMAIL_SOURCES)[number];

export const IDENTITY_MEMBERSHIP_SOURCES = [
  'app_login',
  'webinar',
  'checkout',
  'pipedrive',
  'trial',
  'vb_id',
  'other',
] as const;

export type IdentityMembershipSource = (typeof IDENTITY_MEMBERSHIP_SOURCES)[number];

const ROLE_SET = new Set<string>(IDENTITY_ROLES);
const SUBJECT_SET = new Set<string>(IDENTITY_SUBJECTS);

/** Stejné pozice jako mailing_canonical_role() / MAILING_ROLE_OPTIONS. */
const ROLE_BY_POSITION: Record<string, IdentityRole> = {
  Teacher: 'teacher',
  'Physics teacher': 'teacher',
  'Chemistry teacher': 'teacher',
  'Physics and chemistry teacher': 'teacher',
  'Other subject teacher': 'teacher',
  Učitel: 'teacher',
  'Učitel/ka na ZŠ': 'teacher',
  'Učitel/ka na SŠ': 'teacher',
  'Učitel/ka na VOŠ nebo VŠ': 'teacher',
  'Učitel/ka': 'teacher',
  Headmaster: 'director',
  ředitel: 'director',
  ředitelka: 'director',
  Ředitel: 'director',
  'Ředitel/ka': 'director',
  'Ředitel/ka školy': 'director',
  'Deputy director': 'deputy',
  'Zástupce/kyně ředitele': 'deputy',
  Parent: 'parent',
  Rodič: 'parent',
  Student: 'student',
  Homeschooling: 'homeschool',
  'Secretary/economist': 'school_admin',
  'ICT coordinator': 'school_admin',
  Hospodářka: 'school_admin',
  Institution: 'school_admin',
  Other: 'other',
  Jiné: 'other',
  'Kontakt (záznam bez plné registrace)': 'other',
};

const SUBJECT_TOKEN: Record<string, IdentitySubject> = {
  physics: 'fyzika',
  fyzika: 'fyzika',
  chemistry: 'chemie',
  chemie: 'chemie',
  mathematics: 'matematika',
  'mathematics-1': 'matematika',
  'mathematics-2': 'matematika',
  'mathematics-1st': 'matematika',
  matematika: 'matematika',
  naturalhistory: 'prirodopis',
  'natural history': 'prirodopis',
  prirodopis: 'prirodopis',
  primaryscience: 'prvouka',
  'primary science': 'prvouka',
  prvouka: 'prvouka',
  czechlang: 'cesky-jazyk',
  'czechlang-1': 'cesky-jazyk',
  'czechlang-2': 'cesky-jazyk',
  'cesky-jazyk': 'cesky-jazyk',
  other: 'other',
  'other-1': 'other',
  'other-2': 'other',
};

const FIRST_STAGE_TOKENS = new Set([
  'mathematics-1',
  'primaryscience',
  'czechlang-1',
  'other-1',
  'schoolstage-1',
]);
const SECOND_STAGE_TOKENS = new Set([
  'mathematics-2',
  'czechlang-2',
  'other-2',
  'schoolstage-2',
]);

export function identityNormalizeIco(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return /^\d{8}$/.test(digits) ? digits : null;
}

export function identityNormalizePhone(raw: unknown): string | null {
  return normalizeCzechPhone(raw);
}

export function identityCanonicalRole(raw: unknown): IdentityRole {
  const t = String(raw ?? '').trim();
  if (!t) return 'unknown';
  if (ROLE_SET.has(t)) return t as IdentityRole;
  const mapped = ROLE_BY_POSITION[t];
  if (mapped) return mapped;
  const lower = t.toLowerCase();
  if (t.startsWith('Učitel') || lower.startsWith('učitel')) return 'teacher';
  if (t.startsWith('Ředitel') || lower.startsWith('ředitel') || lower.startsWith('reditel')) return 'director';
  if (t.startsWith('Zástup') || lower.startsWith('zástup')) return 'deputy';
  if (t.startsWith('Rodič') || lower.startsWith('rodič')) return 'parent';
  return 'other';
}

export function identityMapSubjectToken(raw: unknown): IdentitySubject | null {
  const key = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  if (SUBJECT_SET.has(key)) return key as IdentitySubject;
  return SUBJECT_TOKEN[key] ?? null;
}

export function identityMapSubjects(raw: unknown): IdentitySubject[] {
  const tokens: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) tokens.push(...splitSubjectTokens(item));
  } else {
    tokens.push(...splitSubjectTokens(raw));
  }
  const out: IdentitySubject[] = [];
  for (const tok of tokens) {
    const slug = identityMapSubjectToken(tok);
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

function splitSubjectTokens(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap(splitSubjectTokens);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.flatMap(splitSubjectTokens);
    } catch {
      /* fall through */
    }
  }
  return s.split(/[,;|]+/).map((p) => p.trim()).filter(Boolean);
}

export function identityMapStages(raw: unknown): number[] {
  const tokens: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) tokens.push(...splitSubjectTokens(item));
  } else {
    tokens.push(...splitSubjectTokens(raw));
  }
  const stages = new Set<number>();
  for (const tok of tokens) {
    const key = String(tok).trim().toLowerCase().replace(/\s+/g, '');
    if (FIRST_STAGE_TOKENS.has(key) || tok === 1 || tok === '1') stages.add(1);
    if (SECOND_STAGE_TOKENS.has(key) || tok === 2 || tok === '2') stages.add(2);
  }
  return [...stages].sort();
}

export function identityMapEmailSource(raw: unknown): IdentityEmailSource {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'mailchimp' || s === 'mailchimp_import') return 'mailchimp';
  if (s === 'webinar') return 'webinar';
  if (s === 'checkout') return 'checkout';
  if (s === 'app' || s === 'vividbooks-app-teacher-registration') return 'app';
  if (s === 'pipedrive') return 'pipedrive';
  if (s === 'vb_id') return 'vb_id';
  if (s === 'trial') return 'trial';
  if (s === 'newsletter') return 'newsletter';
  return 'other';
}

export function identityMapMembershipSource(raw: unknown): IdentityMembershipSource {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'app_login' || s === 'app') return 'app_login';
  if (s === 'webinar') return 'webinar';
  if (s === 'checkout') return 'checkout';
  if (s === 'pipedrive') return 'pipedrive';
  if (s === 'trial') return 'trial';
  if (s === 'vb_id') return 'vb_id';
  return 'other';
}

export function unionSubjects(a: string[] | null | undefined, b: string[] | null | undefined): IdentitySubject[] {
  const out: IdentitySubject[] = [];
  for (const item of [...(a || []), ...(b || [])]) {
    const slug = identityMapSubjectToken(item);
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

export function unionStages(a: number[] | null | undefined, b: number[] | null | undefined): number[] {
  const set = new Set<number>();
  for (const n of [...(a || []), ...(b || [])]) {
    const v = Number(n);
    if (v === 1 || v === 2) set.add(v);
  }
  return [...set].sort();
}

export function identityNormalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email || !email.includes('@') || email.length < 4) return null;
  return email;
}

export function identityNormalizeOrgCode(raw: unknown): string | null {
  const code = String(raw ?? '').trim().toUpperCase();
  return code || null;
}

export function identityNormalizeTeacherSlot(raw: unknown): string | null {
  const slot = String(raw ?? '').trim();
  return slot || null;
}
