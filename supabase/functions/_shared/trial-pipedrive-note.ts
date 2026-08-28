/**
 * České poznámky pro trial obchody zakládané e-shopem do Pipedrive.
 *
 * Kontext: přístupové kódy k trialu vydává legacy API Vividbooks
 * (`https://api.vividbooks.com/web/free-trial-ajax`). Když je vydá, založí si
 * samo i obchod v Pipedrive. Když je **odmítne vydat** (nebo vrátí jen už
 * existující kódy), žádná stopa v CRM by nevznikla — proto obchod zakládá
 * e-shop a označí ho labelem „Trial web (interactive) - 2.0".
 *
 * Obchodník ale z labelu nepozná, **proč** kódy nevznikly. Tenhle modul staví
 * poznámku, která to vysvětlí česky a lidsky: co API odpovědělo, proč je obchod
 * značený jako trial 2.0 a co s tím dál.
 *
 * Čistý modul bez závislostí — importuje ho edge funkce i unit testy.
 */

/**
 * Scénář volání Pipedrive z trial formuláře — určuje pipeline / stage /
 * popis aktivity / fallback ownera. Label je vždy stejný (option 359 na poli
 * 12463 = „Trial web (interactive) - 2.0"), liší se obchodní pipeline.
 */
export type TrialPipedriveScenario =
  | 'active_subscription'      // legacy reason "You have active subscription trial yet."
  | 'email_used_in_school'     // legacy reason "Email is used yet." (opětovná žádost o kód)
  | 'existing_active_trial'    // legacy odpověděla existujícími trial kódy (kind=existing_trial) — škola aktuálně má trial
  | 'open_deal_in_progress';   // škola má v CRM otevřený (rozjednaný) deal a přesto vyplnila trial formulář

/** Název labelu (deal pole 12463, option 359), na který se poznámka odkazuje. */
export const TRIAL_PIPEDRIVE_LABEL_NAME = 'Trial web (interactive) - 2.0';

export interface TrialScenarioExplanation {
  /** Krátký titulek poznámky — první řádek, ať je poznat v deal feedu. */
  headline: string;
  /** Nadpis bloku o kódech (u existing_active_trial jde o „nové" kódy). */
  codesHeading: string;
  /** Proč kódy nevznikly — 1–3 věty, česky, bez žargonu. */
  codesReason: string;
  /** Doslovná odpověď legacy API, když ji známe i bez dat z frontendu. */
  apiReason?: string;
  /** Proč je obchod zrovna „trial 2.0" — scénářová část (obecná je společná). */
  labelReason: string;
  /** Kam obchod padá a proč právě tam. */
  pipelineLabel: string;
  /** Doporučený další krok pro obchodníka. */
  nextStep: string;
}

const SCENARIO_EXPLANATIONS: Record<TrialPipedriveScenario, TrialScenarioExplanation> = {
  active_subscription: {
    headline: 'Žádost o trial z webu — kódy se nevydaly (škola má aktivní předplatné)',
    codesHeading: 'Proč se nevygenerovaly přístupové kódy',
    codesReason:
      'Škola už má u Vividbooks aktivní placené předplatné. API Vividbooks proto ' +
      'zkušební přístup nevydalo — trial se nezakládá tam, kde už běží plná licence. ' +
      'Zákazník na webu dostal informaci, že ho bude kontaktovat obchodník.',
    apiReason: 'You have active subscription trial yet.',
    labelReason:
      'Obchod nevznikl z vydaných kódů, ale z odmítnuté žádosti o trial — jde tedy ' +
      'o poptávku po rozšíření u platícího zákazníka.',
    pipelineLabel: 'CZ-Sales-Upsell-CZ2 → Kontaktováno [CZ2] (škola už platí, řeší se rozšíření)',
    nextStep:
      'Zavolat a zjistit, co zákazník potřebuje — typicky přístup pro dalšího učitele ' +
      'nebo další předmět. Nabídnout rozšíření licence.',
  },
  email_used_in_school: {
    headline: 'Žádost o trial z webu — kódy se nevydaly (e-mail už je ve Vividbooks evidovaný)',
    codesHeading: 'Proč se nevygenerovaly přístupové kódy',
    codesReason:
      'Zadaný e-mail je u školy ve Vividbooks už evidovaný — trial pro něj byl vystavený ' +
      'dřív (typicky ručně v adminu nebo při starší žádosti). Jeden e-mail může trial ' +
      'dostat jen jednou, API Vividbooks proto nové kódy nevydalo. ' +
      'Zákazník na webu dostal informaci, že ho bude kontaktovat obchodník.',
    apiReason: 'Email is used yet.',
    labelReason:
      'Jde o opětovnou žádost o kód ze stejné školy — zákazník se o Vividbooks aktivně ' +
      'zajímá, ale sám se k přístupu nedostane.',
    pipelineLabel: 'CZ-Sales-Akvizice-CZ1 → Lead / Prospekt [CZ1]',
    nextStep:
      'Ověřit, kdo ve škole kódy má (často je má kolega a nepředal je), případně vystavit ' +
      'nový trial ručně v adminu Vividbooks a domluvit další postup.',
  },
  existing_active_trial: {
    headline: 'Žádost o trial z webu — nové kódy se nevydaly (škola má aktivní trial)',
    codesHeading: 'Proč se nevygenerovaly nové přístupové kódy',
    codesReason:
      'Škola má právě teď aktivní zkušební přístup. API Vividbooks proto nový trial ' +
      'nezaložilo — jen zopakovalo kódy, které škole už běží, a ty se zákazníkovi ' +
      'zobrazily na webu.',
    labelReason:
      'Zákazník si o trial žádá znovu i přesto, že škole běží — je to signál zájmu ' +
      'a zároveň riziko, že se ke kódům uvnitř školy nikdo nedostal.',
    pipelineLabel: 'CZ-Sales-Akvizice-CZ1 → Lead / Prospekt [CZ1]',
    nextStep:
      'Zavolat, ověřit, jestli s trialem opravdu pracují, a rovnou otevřít téma ' +
      'přechodu na předplatné.',
  },
  open_deal_in_progress: {
    headline: 'Žádost o trial z webu — škola má v CRM rozjednaný obchod',
    codesHeading: 'Proč se nevygenerovaly přístupové kódy',
    codesReason:
      'Škola má v CRM rozjednaný obchod, přesto někdo znovu vyplnil webový formulář ' +
      'na zkušební přístup. Kódy tímto obchodem nevznikly — vydání trialu se řeší ' +
      'v rámci probíhajícího jednání, ne automaticky z webu.',
    labelReason:
      'Obchod zakládá e-shop u každého odeslaného formuláře, aby se žádost neztratila ' +
      'vedle probíhajícího jednání.',
    pipelineLabel: 'CZ-Sales-Akvizice-CZ1 → Lead / Prospekt [CZ1]',
    nextStep:
      'Spojit žádost s rozjednaným obchodem — ozval se nejspíš další člověk ze školy, ' +
      'který o jednání neví.',
  },
};

export function getTrialScenarioExplanation(scenario: TrialPipedriveScenario): TrialScenarioExplanation {
  return SCENARIO_EXPLANATIONS[scenario] ?? SCENARIO_EXPLANATIONS.email_used_in_school;
}

/** Společné vysvětlení, proč obchod vůbec nese label „Trial web (interactive) - 2.0". */
export const TRIAL_LABEL_COMMON_REASON =
  `Obchod nezaložilo API Vividbooks, ale e-shopový formulář „Vyzkoušejte" na webu ` +
  `(vividbooks.cz/vyzkousejte). Když API kódy vydá, založí si obchod samo; když je ` +
  `nevydá, nevznikla by v CRM žádná stopa — proto ho zakládá web a označuje labelem ` +
  `„${TRIAL_PIPEDRIVE_LABEL_NAME}". Label tedy znamená: žádost o trial přišla z webu ` +
  `a nedoběhla do kódů, musí ji převzít obchodník.`;

/** Kódy z trial formuláře → česky, ať obchodník v poznámce nečte „Mathematics-2". */
const TRIAL_SUBJECT_LABELS_CS: Record<string, string> = {
  Physics: 'Fyzika',
  Chemistry: 'Chemie',
  'Mathematics-1': 'Matematika (1. stupeň)',
  'Mathematics-2': 'Matematika (2. stupeň)',
  NaturalHistory: 'Přírodopis',
  PrimaryScience: 'Prvouka',
  'CzechLang-1': 'Český jazyk (1. stupeň)',
  'CzechLang-2': 'Český jazyk (2. stupeň)',
  'Other-1': 'Jiné (1. stupeň)',
  'Other-2': 'Jiné (2. stupeň)',
};

const TRIAL_STAGE_LABELS_CS: Record<string, string> = {
  'SchoolStage-1': '1. stupeň',
  'SchoolStage-2': '2. stupeň',
};

/** Neznámý kód necháme, jak přišel — radši surová hodnota než ztracená informace. */
export function trialSubjectLabelCs(code: string): string {
  return TRIAL_SUBJECT_LABELS_CS[code] ?? code;
}

export function trialSchoolStageLabelCs(code: string): string {
  return TRIAL_STAGE_LABELS_CS[code] ?? code;
}

export interface TrialDealNoteParams {
  scenario: TrialPipedriveScenario;
  contactName?: string;
  email?: string;
  phone?: string;
  position?: string;
  schoolName?: string;
  ico?: string;
  /** Kódy předmětů z formuláře (učitel). */
  subjects?: string[];
  /** Kódy stupňů z formuláře (zástupce). */
  schoolStages?: string[];
  /** Doslovný `reason` z legacy API, pokud ho frontend poslal. */
  legacyReason?: string;
  /** Hláška, kterou zákazník viděl na webu (pokud ji frontend poslal). */
  legacyMessage?: string;
  /** Pro školu už existoval otevřený trial obchod — nový se nezakládal. */
  deduplicated?: boolean;
  /** Datum a čas odeslání formuláře, už naformátované (např. „28. 8. 2026 14:32"). */
  submittedAt?: string;
}

function cleanLine(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Poznámka do obchodu — plain text (řádky). Pipedrive verze je HTML
 * (`buildTrialDealNoteHtml`), tahle podoba se hodí do logů a testů.
 */
export function buildTrialDealNoteText(params: TrialDealNoteParams): string {
  const info = getTrialScenarioExplanation(params.scenario);
  const apiReason = cleanLine(params.legacyReason) || cleanLine(info.apiReason);
  const lines: string[] = [];

  lines.push(info.headline);
  lines.push('');

  lines.push(`${info.codesHeading}:`);
  lines.push(info.codesReason);
  if (apiReason) lines.push(`Odpověď API Vividbooks: „${apiReason}"`);
  const shownMessage = cleanLine(params.legacyMessage);
  if (shownMessage) lines.push(`Zákazník na webu viděl: „${shownMessage}"`);
  lines.push('');

  lines.push(`Proč je obchod označený „${TRIAL_PIPEDRIVE_LABEL_NAME}":`);
  lines.push(TRIAL_LABEL_COMMON_REASON);
  lines.push(info.labelReason);
  lines.push(`Zařazení: ${info.pipelineLabel}`);
  lines.push('');

  lines.push('Další krok:');
  lines.push(info.nextStep);

  if (params.deduplicated) {
    lines.push('');
    lines.push(
      '⚠️ Opakovaná žádost: pro školu už byl v Pipedrive otevřený trial obchod, ' +
        'nový se proto nezakládal — tahle poznámka je u toho existujícího.',
    );
  }

  const detail: string[] = [];
  const contactName = cleanLine(params.contactName);
  const email = cleanLine(params.email);
  const phone = cleanLine(params.phone);
  const position = cleanLine(params.position);
  const schoolName = cleanLine(params.schoolName);
  const ico = cleanLine(params.ico);
  const subjects = (params.subjects ?? []).map(cleanLine).filter(Boolean).map(trialSubjectLabelCs);
  const stages = (params.schoolStages ?? []).map(cleanLine).filter(Boolean).map(trialSchoolStageLabelCs);
  const submittedAt = cleanLine(params.submittedAt);

  if (contactName) detail.push(`Kontakt: ${contactName}`);
  if (email) detail.push(`E‑mail: ${email}`);
  if (phone) detail.push(`Telefon: ${phone}`);
  if (position) detail.push(`Pozice: ${position}`);
  if (schoolName) detail.push(`Škola: ${schoolName}`);
  if (ico) detail.push(`IČO: ${ico}`);
  if (subjects.length) detail.push(`Předměty: ${subjects.join(', ')}`);
  if (stages.length) detail.push(`Stupně: ${stages.join(', ')}`);
  if (submittedAt) detail.push(`Odesláno: ${submittedAt}`);

  if (detail.length) {
    lines.push('');
    lines.push('Údaje z formuláře:');
    lines.push(...detail);
  }

  return lines.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Nadpisy sekcí, které v HTML poznámce ztučníme — jediné řádky končící dvojtečkou.
 *  (Řádky s údaji mají tvar „Kontakt: Jan Novák", takže dvojtečkou nekončí.) */
function isNoteHeading(line: string): boolean {
  return line.endsWith(':');
}

/** Poznámka do obchodu ve formátu, který Pipedrive u notes renderuje (HTML). */
export function buildTrialDealNoteHtml(params: TrialDealNoteParams): string {
  return buildTrialDealNoteText(params)
    .split('\n')
    .map((line) => {
      const safe = escapeHtml(line);
      if (!line) return '';
      if (line === getTrialScenarioExplanation(params.scenario).headline) return `<b>${safe}</b>`;
      return isNoteHeading(line) ? `<b>${safe}</b>` : safe;
    })
    .join('<br>');
}

/**
 * Krátká varianta do poznámky aktivity — obchodník ji vidí v úkolu, tak ať tam
 * není celý elaborát, ale hlavní důvod ano.
 */
export function buildTrialActivityNoteText(
  params: TrialDealNoteParams & { intro?: string },
): string {
  const info = getTrialScenarioExplanation(params.scenario);
  const apiReason = cleanLine(params.legacyReason) || cleanLine(info.apiReason);
  const lines: string[] = [];

  const intro = cleanLine(params.intro);
  if (intro) lines.push(intro);
  lines.push(`${info.codesHeading}: ${info.codesReason}`);
  if (apiReason) lines.push(`Odpověď API Vividbooks: „${apiReason}"`);
  lines.push(`Další krok: ${info.nextStep}`);

  const contactName = cleanLine(params.contactName);
  const email = cleanLine(params.email);
  const phone = cleanLine(params.phone);
  const position = cleanLine(params.position);
  const schoolName = cleanLine(params.schoolName);
  const ico = cleanLine(params.ico);
  if (contactName) lines.push(`Kontakt: ${contactName}`);
  if (email) lines.push(`E‑mail: ${email}`);
  if (phone) lines.push(`Telefon: ${phone}`);
  if (position) lines.push(`Pozice: ${position}`);
  if (schoolName) lines.push(`Škola: ${schoolName}`);
  if (ico) lines.push(`IČO: ${ico}`);
  if (params.deduplicated) {
    lines.push('⚠️ Zákazník žádal o trial znovu (otevřený obchod už existoval).');
  }

  return lines.filter(Boolean).join('\n');
}
