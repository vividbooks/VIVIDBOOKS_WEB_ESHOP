import { apiUrl } from './publicSiteUrl';
import { projectId, publicAnonKey } from './supabase/info';

/** AJAX varianta `/web/free-trial` — JsonResponse místo redirect (handleWebhookAjax). */
export const FREE_TRIAL_AJAX_URL = apiUrl('/web/free-trial-ajax');

const TRIAL_PIPEDRIVE_UPSELL_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/trial-active-subscription-pipedrive`;

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
  | {
      status: 'error';
      message: string;
      /** Legacy API `reason` — pro bohatší UI (kontakt obchodníka). */
      code?: 'email_used_in_school' | 'active_subscription_trial' | 'generic';
    };

export function parseTrialCodes(data: Record<string, unknown> | null): { student: string; teacher: string } | null {
  if (!data) return null;
  const s = data.studentCode;
  const t = data.teacherCode;
  if (typeof s === 'string' && s.trim() && typeof t === 'string' && t.trim()) {
    return { student: s.trim(), teacher: t.trim() };
  }
  return null;
}

export function parseFreeTrialError(data: Record<string, unknown> | null): {
  message: string;
  code: 'email_used_in_school' | 'active_subscription_trial' | 'generic';
} {
  const reason = typeof data?.reason === 'string' ? data.reason : '';
  if (reason === 'Email is used yet.') {
    return {
      code: 'email_used_in_school',
      message:
        'Tento e-mail je u vaší školy už v systému Vividbooks. Nový přístup z formuláře nezískáte — obraťte se na kolegy ve škole nebo na vášeho obchodního zástupce.',
    };
  }
  if (reason === 'You have active subscription trial yet.') {
    return {
      code: 'active_subscription_trial',
      message: 'Vaše škola už má aktivní předplatné.',
    };
  }
  if (reason) return { code: 'generic', message: reason };
  const m = data?.message ?? data?.error ?? data?.detail ?? data?.title;
  return {
    code: 'generic',
    message: typeof m === 'string' ? m : 'Požadavek se nezdařil.',
  };
}

export function freeTrialErrorMessage(data: Record<string, unknown> | null): string {
  return parseFreeTrialError(data).message;
}

/**
 * Fire-and-forget vytvoření Pipedrive upsell dealu, když legacy `/web/free-trial-ajax`
 * vrátí reason "You have active subscription trial yet." — škola už má aktivní
 * předplatné, ale konkrétní uživatel přesto poslal žádost o trial.
 *
 * Edge funkce `trial-active-subscription-pipedrive` v `make-server-93a20b6f`:
 *   - založí (nebo doplní) Pipedrive organizaci a person
 *   - vytvoří deal v pipeline 7 (CZ-Sales-Upsell-CZ2), stage 40 (Kontaktováno [CZ2])
 *     s labelem 359 ("Trial web (interactive) - 2.0", deal field 12463)
 *   - přiřadí deal owner přes „current deal owner" (org pole 4056)
 *   - založí aktivitu "Kontaktovat" s notou "Zákazník žádá o trial." pro deal ownera
 *
 * Volání je „nejlepší úsilí" — chyba se neeskaluje na UI, jen zaloguje do konzole.
 */
export async function notifyTrialActiveSubscriptionToPipedrive(fields: FreeTrialFields): Promise<void> {
  try {
    const { fullName } = splitFullNameForTrial(fields.name);
    const body = {
      schoolName: fields.schoolName,
      ico: fields.vat,
      name: fullName || fields.name,
      email: fields.email,
      phone: fields.phone,
      position: fields.position,
    };
    const res = await fetch(TRIAL_PIPEDRIVE_UPSELL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        `[trial-pipedrive-upsell] HTTP ${res.status}: ${text.slice(0, 200)}`,
      );
    }
  } catch (error) {
    console.warn('[trial-pipedrive-upsell] error:', error);
  }
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
    const err = parseFreeTrialError(data);
    /** Škola už má aktivní předplatné, ale uživatel přesto poslal žádost o trial:
     *  fire-and-forget založení upsell dealu v Pipedrive (pipeline 7, stage 40,
     *  label „Trial web (interactive) - 2.0" 359, aktivita pro deal ownera). */
    if (err.code === 'active_subscription_trial') {
      void notifyTrialActiveSubscriptionToPipedrive(fields);
    }
    return {
      status: 'error',
      code: err.code,
      message: err.message || `Chyba serveru (${res.status}).`,
    };
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

  const err = parseFreeTrialError(data);
  if (err.code === 'active_subscription_trial') {
    void notifyTrialActiveSubscriptionToPipedrive(fields);
  }
  return { status: 'error', code: err.code, message: err.message };
}
