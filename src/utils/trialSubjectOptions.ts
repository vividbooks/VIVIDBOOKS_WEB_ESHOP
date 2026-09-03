/**
 * Předměty a stupně pro žádost o trial — sdílené mezi trial formulářem
 * (`/vyzkousejte`, `src/components/TrialPage.tsx`) a jednoklikovým trialem po
 * registraci na webinář (`src/components/WebinarPostRegistrationTrial.tsx`).
 *
 * Hodnoty (`value`) jsou kódy z Webflow (`data-value`), které legacy API
 * `api.vividbooks.com/web/free-trial-ajax` očekává v `TeacherSubjects` /
 * `SchoolStages`. Server je pak mapuje na option ID vlastních polí osoby
 * v Pipedrive — předmět 9095, stupeň 9099 (`supabase/functions/_shared/
 * pipedrive-person-subject.ts` a `mapTrialStageToPipedriveOptionIds`).
 *
 * Držet v jednom souboru je podstatné: dokud měl webinářový formulář vlastní
 * (prázdné) hodnoty, zůstal u trialů z webináře v Pipedrive předmět „Jiné"
 * od legacy API a natvrdo poslaný 2. stupeň.
 */

export type TrialSelectOption = { value: string; label: string };

/** Předměty 1. stupně (kódy jako ve Webflow / Mailchimp integraci). */
export const TEACHER_SUBJECTS_1ST: TrialSelectOption[] = [
  { value: 'Mathematics-1', label: 'Matematika' },
  { value: 'PrimaryScience', label: 'Prvouka' },
  { value: 'CzechLang-1', label: 'Český jazyk' },
  { value: 'Other-1', label: 'Jiné' },
];

/** Předměty 2. stupně (kódy jako ve Webflow / Mailchimp integraci). */
export const TEACHER_SUBJECTS_2ND: TrialSelectOption[] = [
  { value: 'Physics', label: 'Fyzika' },
  { value: 'Chemistry', label: 'Chemie' },
  { value: 'Mathematics-2', label: 'Matematika' },
  { value: 'NaturalHistory', label: 'Přírodopis' },
  { value: 'CzechLang-2', label: 'Český jazyk' },
  { value: 'Other-2', label: 'Jiné' },
];

/** Stupeň školy pro nevyučující role (zástupce, ředitel, poradce). */
export const DEPUTY_SCHOOL_STAGES: TrialSelectOption[] = [
  { value: 'SchoolStage-1', label: '1. stupeň' },
  { value: 'SchoolStage-2', label: '2. stupeň' },
];

/**
 * Na co se u dané pozice ptát:
 *   - `subjects` — učí, takže vybírá předměty (server z nich odvodí i stupeň),
 *   - `stages`   — ve škole pracuje, ale neučí → vybírá jen stupeň,
 *   - `none`     — rodič / jiné → nic (do Pipedrive se předmět ani stupeň nepíše).
 */
export type TrialSubjectQuestion = 'subjects' | 'stages' | 'none';

const ACADEMIC_TITLE_RE =
  /^(mgr|ing|phdr|rndr|paeddr|mudr|judr|mvdr|thdr|bc|bca|mba|doc|prof|dr|rsdr|phd|ph\.d)\.?$/i;
const TRAILING_DEGREE_RE = /,?\s*(mba|phd|ph\.d|dr)\.?\s*$/i;

/** „Mgr. Lenka Bakulová, MBA“ → „Lenka Bakulová“ */
export function displayNameWithoutTitles(full: string): string {
  const parts = String(full || '')
    .replace(TRAILING_DEGREE_RE, '')
    .replace(/[,\s]+$/g, '')
    .trim()
    .split(/\s+/)
    .filter((p) => p && !ACADEMIC_TITLE_RE.test(p.replace(/\.$/, '')));
  return parts.join(' ').trim() || String(full || '').trim();
}

/** Křestní jméno bez titulů — „Mgr. Lenka Bakulová, MBA“ → „Lenka“ */
export function givenNameWithoutTitles(full: string): string {
  const clean = displayNameWithoutTitles(full);
  return clean.split(/\s+/)[0] || clean;
}

/**
 * Webinářová pozice („Učitel/ka na ZŠ“) → hodnota v trial selectu („Učitel/ka“).
 * Bez toho se na /vyzkousejte neotevře výběr předmětů.
 */
export function mapWebinarPositionToTrialPosition(position: string): string {
  const p = normalizePositionLabel(position);
  if (/ucitel/.test(p)) return 'Učitel/ka';
  if (/zastupc/.test(p)) return 'Zástupce/kyně ředitele';
  if (/reditel/.test(p)) return 'Ředitel/ka';
  if (/metodik/.test(p)) return 'Metodik/čka';
  if (/rodic/.test(p)) return 'Rodič';
  if (!p) return '';
  return 'Jiné';
}

function normalizePositionLabel(position: string): string {
  return String(position || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Pozice → otázka. Musí zvládnout **oba** seznamy pozic, protože se liší:
 *   - trial formulář: „Učitel/ka", „Ředitel/ka", „Zástupce/kyně ředitele", „Metodik/čka", „Rodič", „Jiné",
 *   - webinář: „Učitel/ka na ZŠ / SŠ / VOŠ nebo VŠ", „Ředitel/ka školy",
 *     „Výchovný/á poradce/poradkyně", „Pedagogický pracovník/ce", „Rodič", „Jiné".
 */
export function trialSubjectQuestionForPosition(position: string): TrialSubjectQuestion {
  const p = normalizePositionLabel(position);
  if (!p) return 'none';
  if (/ucitel|pedagogick/.test(p)) return 'subjects';
  if (/zastupc|reditel|poradce|poradkyn|metodik/.test(p)) return 'stages';
  return 'none';
}

/**
 * Výběr z formuláře → pole pro `FreeTrialFields`. Posílá se jen to, na co se
 * u dané pozice ptáme — nikdy natvrdo dosazená hodnota (dřívější `SchoolStage-2`
 * u všech učitelů z webináře).
 */
export function buildTrialSubjectFields(params: {
  position: string;
  subjects1st: string[];
  subjects2nd: string[];
  schoolStages: string[];
}): { teacherSubjects: string[]; schoolStages: string[] } {
  const question = trialSubjectQuestionForPosition(params.position);
  if (question === 'subjects') {
    return {
      teacherSubjects: [...params.subjects1st, ...params.subjects2nd],
      schoolStages: [],
    };
  }
  if (question === 'stages') {
    return { teacherSubjects: [], schoolStages: [...params.schoolStages] };
  }
  return { teacherSubjects: [], schoolStages: [] };
}

/** Chybí povinný výběr? Vrátí hlášku pro UI, jinak `null`. */
export function trialSubjectSelectionError(params: {
  position: string;
  subjects1st: string[];
  subjects2nd: string[];
  schoolStages: string[];
}): string | null {
  const question = trialSubjectQuestionForPosition(params.position);
  if (question === 'subjects' && params.subjects1st.length === 0 && params.subjects2nd.length === 0) {
    return 'Vyberte prosím alespoň jeden předmět.';
  }
  if (question === 'stages' && params.schoolStages.length === 0) {
    return 'Vyberte prosím alespoň jeden stupeň školy.';
  }
  return null;
}

/**
 * Kód → čitelný název pro admin výpis a CSV export. U předmětů se přidává
 * stupeň, protože „Matematika" i „Český jazyk" jsou v obou stupních.
 */
const TRIAL_SELECTION_LABELS: Record<string, string> = {
  ...Object.fromEntries(TEACHER_SUBJECTS_1ST.map((o) => [o.value, `${o.label} (1. st.)`])),
  ...Object.fromEntries(TEACHER_SUBJECTS_2ND.map((o) => [o.value, `${o.label} (2. st.)`])),
  ...Object.fromEntries(DEPUTY_SCHOOL_STAGES.map((o) => [o.value, o.label])),
};

export function trialSelectionLabel(code: string): string {
  const key = String(code || '').trim();
  return TRIAL_SELECTION_LABELS[key] ?? key;
}

/** Seznam kódů → „Fyzika (2. st.), Matematika (1. st.)"; prázdný vstup → prázdný řetězec. */
export function formatTrialSelectionCodes(codes: string[] | null | undefined): string {
  if (!Array.isArray(codes) || codes.length === 0) return '';
  return codes.map(trialSelectionLabel).filter(Boolean).join(', ');
}
