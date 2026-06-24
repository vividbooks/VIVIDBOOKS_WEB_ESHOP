import { apiUrl } from './publicSiteUrl';
import { projectId, publicAnonKey } from './supabase/info';

/** AJAX varianta `/web/free-trial` — JsonResponse místo redirect (handleWebhookAjax). */
export const FREE_TRIAL_AJAX_URL = apiUrl('/web/free-trial-ajax');

const TRIAL_PIPEDRIVE_UPSELL_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/trial-active-subscription-pipedrive`;

const TRIAL_PIPEDRIVE_REREQUEST_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/trial-email-used-pipedrive`;

const TRIAL_PIPEDRIVE_EXISTING_ACTIVE_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/trial-existing-active-pipedrive`;

const TRIAL_PIPEDRIVE_OPEN_DEAL_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/trial-open-deal-pipedrive`;

const TRIAL_PIPEDRIVE_PERSON_FIELDS_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/trial-person-fields-pipedrive`;

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
        'Tento e-mail je u vaší školy už v systému Vividbooks. Nový přístup z formuláře nezískáte — obraťte se na kolegy ve škole nebo na vášeho obchodního zástupce. Brzy vás bude kontaktovat náš obchodní zástupce a navrhne další postup.',
    };
  }
  if (reason === 'You have active subscription trial yet.') {
    return {
      code: 'active_subscription_trial',
      message: 'Vaše škola už má aktivní předplatné. Brzy vás bude kontaktovat náš obchodní zástupce a navrhne další postup.',
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
 * Společné fire-and-forget volání edge endpointů pro trial flow do Pipedrive.
 *
 * Dva scénáře — liší se pipeline / stage / default owner / poznámka aktivity,
 * label je stejný (option 359 na poli 12463 = „Trial web (interactive) - 2.0"):
 *
 *   - `trial-active-subscription-pipedrive` — když legacy API vrátí
 *     `active_subscription_trial` (škola už má aktivní předplatné). Pipeline 7
 *     `CZ-Sales-Upsell-CZ2`, stage 40 `Kontaktováno [CZ2]`.
 *
 *   - `trial-email-used-pipedrive` — když legacy API vrátí `email_used_in_school`
 *     (uživatel/škola už trial v Vividbooks adminu má, žádá o kód znovu).
 *     Pipeline 6 `CZ-Sales-Akvizice-CZ1`, stage 37 `Lead / Prospekt [CZ1]`.
 *     Default owner Gabriela Švédová, když organizace nemá current_deal_owner.
 *
 * Volání je „nejlepší úsilí" — chyba se neeskaluje na UI, jen zaloguje do konzole.
 */
async function postTrialPipedriveSync(url: string, label: string, fields: FreeTrialFields): Promise<void> {
  try {
    const { fullName } = splitFullNameForTrial(fields.name);
    const body = {
      schoolName: fields.schoolName,
      ico: fields.vat,
      name: fullName || fields.name,
      email: fields.email,
      phone: fields.phone,
      position: fields.position,
      /** Předměty (učitel) a stupně (zástupce) — server z nich nastaví pole osoby 9095 / 9099. */
      teacherSubjects: fields.teacherSubjects,
      schoolStages: fields.schoolStages,
    };
    const res = await fetch(url, {
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
        `[${label}] HTTP ${res.status}: ${text.slice(0, 200)}`,
      );
    }
  } catch (error) {
    console.warn(`[${label}] error:`, error);
  }
}

export function notifyTrialActiveSubscriptionToPipedrive(fields: FreeTrialFields): Promise<void> {
  return postTrialPipedriveSync(TRIAL_PIPEDRIVE_UPSELL_URL, 'trial-pipedrive-upsell', fields);
}

export function notifyTrialEmailUsedToPipedrive(fields: FreeTrialFields): Promise<void> {
  return postTrialPipedriveSync(TRIAL_PIPEDRIVE_REREQUEST_URL, 'trial-pipedrive-rerequest', fields);
}

/**
 * Škola **aktuálně má** aktivní trial (legacy vrátila existující kódy) — pošle
 * aktivitu do akviziční pipeline (6/37) s notou „Škola aktuálně má trial a žádá
 * si o další." Volá se ze `submitFreeTrialAjax` po detekci `kind: 'existing_trial'`.
 */
export function notifyTrialExistingActiveToPipedrive(fields: FreeTrialFields): Promise<void> {
  return postTrialPipedriveSync(
    TRIAL_PIPEDRIVE_EXISTING_ACTIVE_URL,
    'trial-pipedrive-existing-active',
    fields,
  );
}

/**
 * Škola má v CRM **rozjednaný obchod** (`pdStatus === 'in_progress'`) a přesto
 * vyplnila trial formulář. I tady musí vzniknout deal (pipeline 6/37) — když už
 * pro organizaci existuje otevřený trial deal, server jen přidá aktivitu
 * (deduplikace v `syncTrialPipedriveDeal`).
 */
export function notifyTrialOpenDealToPipedrive(fields: FreeTrialFields): Promise<void> {
  return postTrialPipedriveSync(
    TRIAL_PIPEDRIVE_OPEN_DEAL_URL,
    'trial-pipedrive-open-deal',
    fields,
  );
}

/**
 * Po **úspěšném** založení trialu (legacy API vrátilo přístupové kódy, `kind:
 * 'created'`). Legacy API už v Pipedrive založilo deal i osobu, ale nenastaví
 * custom pole osoby — server přes tento endpoint dohraje pozici (9093), předmět
 * (9095) a stupeň (9099). Nezakládá žádný deal (aby nevznikl duplikát).
 */
export function notifyTrialCreatedPersonFieldsToPipedrive(fields: FreeTrialFields): Promise<void> {
  return postTrialPipedriveSync(
    TRIAL_PIPEDRIVE_PERSON_FIELDS_URL,
    'trial-pipedrive-person-fields',
    fields,
  );
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
    triggerTrialPipedriveSync(err.code, fields);
    return {
      status: 'error',
      code: err.code,
      message: err.message || `Chyba serveru (${res.status}).`,
    };
  }

  const codes = parseTrialCodes(data);
  const success = data?.success === true;

  if (success && codes) {
    /** Trial úspěšně založen — fire-and-forget dohrání custom polí osoby v Pipedrive
     *  (pozice 9093, předmět 9095, stupeň 9099). Deal/osobu už vytvořilo legacy API. */
    void notifyTrialCreatedPersonFieldsToPipedrive(fields);
    return { status: 'codes', studentCode: codes.student, teacherCode: codes.teacher, kind: 'created' };
  }
  if (success && !codes) {
    return { status: 'thank_only' };
  }

  if (codes) {
    /** Škola aktuálně má aktivní trial — fire-and-forget zápis do Pipedrive
     *  (akviziční pipeline, aktivita „Aktuálně aktivní trial"). */
    void notifyTrialExistingActiveToPipedrive(fields);
    return { status: 'codes', studentCode: codes.student, teacherCode: codes.teacher, kind: 'existing_trial' };
  }

  const err = parseFreeTrialError(data);
  triggerTrialPipedriveSync(err.code, fields);
  return { status: 'error', code: err.code, message: err.message };
}

/**
 * Routing fire-and-forget Pipedrive volání podle reason code z legacy
 * `/web/free-trial-ajax`:
 *
 *  - `active_subscription_trial` → upsell pipeline (CZ-Sales-Upsell-CZ2)
 *  - `email_used_in_school`      → akviziční pipeline (CZ-Sales-Akvizice-CZ1)
 *
 *  Generic / nejasné chyby Pipedrive nevolají (např. „request failed").
 */
function triggerTrialPipedriveSync(
  code: 'email_used_in_school' | 'active_subscription_trial' | 'generic',
  fields: FreeTrialFields,
): void {
  if (code === 'active_subscription_trial') {
    void notifyTrialActiveSubscriptionToPipedrive(fields);
    return;
  }
  if (code === 'email_used_in_school') {
    void notifyTrialEmailUsedToPipedrive(fields);
  }
}
