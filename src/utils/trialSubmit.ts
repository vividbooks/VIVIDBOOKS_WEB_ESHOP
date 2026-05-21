import { apiUrl } from './publicSiteUrl';

/** AJAX varianta `/web/free-trial` — JsonResponse místo redirect (handleWebhookAjax). */
export const FREE_TRIAL_AJAX_URL = apiUrl('/web/free-trial-ajax');

export type FreeTrialFields = {
  name: string;
  email: string;
  phone: string;
  position: string;
  schoolName: string;
  vat: string;
  gdpr: boolean;
  newsletter: boolean;
  teacherSubjects: string[];
  schoolStages: string[];
};

/** Rozdělení „Jméno Příjmení“ pro API (FirstName / LastName / FullName). */
export function splitFullNameForTrial(full: string): { firstName: string; lastName: string; fullName: string } {
  const t = full.trim();
  if (!t) return { firstName: '', lastName: '', fullName: '' };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '', fullName: t };
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), fullName: t };
}

/**
 * Parametry přesně podle API (velikost písmen).
 * Checkbox-NL: při souhlasu s newsletterem hodnota `yes`.
 */
export function buildFreeTrialFormBody(fields: FreeTrialFields): URLSearchParams {
  const p = new URLSearchParams();
  const { firstName, lastName, fullName } = splitFullNameForTrial(fields.name);

  p.append('FirstName', firstName);
  p.append('LastName', lastName);
  p.append('FullName', fullName);
  p.append('Email', fields.email);
  p.append('Phone', fields.phone);
  p.append('flexdatalist-School', fields.schoolName);
  p.append('School', fields.schoolName);
  p.append('Position', fields.position);
  p.append('Whence', '');
  p.append('Region', '');
  if (fields.newsletter) {
    p.append('Checkbox-NL', 'yes');
  }
  p.append('CountryCode', 'cz');
  p.append('CountryCodeSelect', '');
  p.append('Version', '');
  p.append('Dealer', '');
  p.append('Vat', fields.vat);

  fields.teacherSubjects.forEach((v) => p.append('TeacherSubjects', v));
  fields.schoolStages.forEach((v) => p.append('SchoolStages', v));

  return p;
}

/** Výsledek odeslání — kódy i u `success: false` při aktivním trialu školy. */
export type FreeTrialSubmitResult =
  | {
      status: 'codes';
      studentCode: string;
      teacherCode: string;
      kind: 'created' | 'existing_trial';
    }
  | { status: 'thank_only' }
  | { status: 'error'; message: string };

export function parseTrialCodes(data: Record<string, unknown> | null): { student: string; teacher: string } | null {
  if (!data) return null;
  const s = data.studentCode;
  const t = data.teacherCode;
  if (typeof s === 'string' && s.trim() && typeof t === 'string' && t.trim()) {
    return { student: s.trim(), teacher: t.trim() };
  }
  return null;
}

export function freeTrialErrorMessage(data: Record<string, unknown> | null): string {
  const reason = typeof data?.reason === 'string' ? data.reason : '';
  if (reason === 'Email is used yet.') {
    return 'Tento e-mail je už evidovaný u školy v databázi.';
  }
  if (reason === 'You have active subscription trial yet.') {
    return 'Vaše škola už má aktivní předplatné.';
  }
  if (reason) return reason;
  const m = data?.message ?? data?.error ?? data?.detail ?? data?.title;
  return typeof m === 'string' ? m : 'Požadavek se nezdařil.';
}

export async function submitFreeTrialAjax(fields: FreeTrialFields): Promise<FreeTrialSubmitResult> {
  const body = buildFreeTrialFormBody(fields);
  const res = await fetch(FREE_TRIAL_AJAX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
    mode: 'cors',
    redirect: 'manual',
  });

  if (res.type === 'opaqueredirect' || [301, 302, 303, 307, 308].includes(res.status)) {
    return { status: 'thank_only' };
  }

  const rawText = await res.text();
  let data: Record<string, unknown> | null = null;
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  if (res.ok && !data) {
    return { status: 'thank_only' };
  }

  if (!res.ok) {
    return { status: 'error', message: freeTrialErrorMessage(data) || `Chyba serveru (${res.status}).` };
  }

  const codes = parseTrialCodes(data);
  const success = data?.success === true;

  if (success && codes) {
    return { status: 'codes', studentCode: codes.student, teacherCode: codes.teacher, kind: 'created' };
  }
  if (success && !codes) {
    return { status: 'thank_only' };
  }

  if (codes) {
    return { status: 'codes', studentCode: codes.student, teacherCode: codes.teacher, kind: 'existing_trial' };
  }

  return { status: 'error', message: freeTrialErrorMessage(data) };
}
