/**
 * Předmět učitele (pole OSOBY 9095 „Subject") z trial formuláře → Pipedrive.
 *
 * Do 9095 zapisuje jako první legacy `api.vividbooks.com`, které u happy‑path
 * trialu osobu zakládá — a zapisuje tam „Other" (319). Původní enrich hodnoty
 * jen přiděloval (`set` sjednocení) nebo plnil výhradně prázdné pole (`enum`),
 * takže 319 v poli zůstalo navždy a skutečný výběr z formuláře se nikdy
 * neprojevil. Proto je tady výběr z formuláře **autoritativní**: „Other" se
 * odebere, jakmile uživatel označil konkrétní předmět.
 */

/** Kód předmětu z trial formuláře (Webflow data-value) → option ID pole osoby 9095. */
export const TRIAL_FORM_SUBJECT_TO_PD_ENUM: Record<string, number> = {
  Physics: 309,        // Fyzika
  Chemistry: 310,      // Chemie
  'Mathematics-1': 311, // Matematika (1. stupeň)
  'Mathematics-2': 311, // Matematika (2. stupeň)
  NaturalHistory: 312, // Přírodopis / Biology
  PrimaryScience: 413, // Prvouka
  'CzechLang-1': 414,  // Český jazyk (1. stupeň)
  'CzechLang-2': 414,  // Český jazyk (2. stupeň)
  'Other-1': 319,      // Jiné (1. stupeň)
  'Other-2': 319,      // Jiné (2. stupeň)
};

/** Volba „Jiné" pole 9095 — legacy API ji nastaví i tehdy, když učitel vybral konkrétní předmět. */
export const PIPEDRIVE_PERSON_SUBJECT_OPTION_OTHER = 319;

/** Všechna známá option ID pole 9095 (Subject) — i pro detekci pole podle voleb. */
export const PIPEDRIVE_PERSON_SUBJECT_OPTION_IDS = [309, 310, 311, 312, 413, 414, 319];

/** Předměty z trial formuláře → unikátní option ID pole 9095 v pořadí výběru. */
export function mapTrialSubjectsToPipedriveOptionIds(subjects: string[]): number[] {
  const out: number[] = [];
  for (const raw of Array.isArray(subjects) ? subjects : []) {
    const id = TRIAL_FORM_SUBJECT_TO_PD_ENUM[String(raw || '').trim()];
    if (typeof id === 'number' && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * „Jiné" (319) až na konec. Pole typu `enum` pobere jen jednu hodnotu a bere se
 * první — bez tohoto řazení by u výběru „Jiné (1. stupeň) + Přírodopis" vyhrálo
 * „Other", protože předměty 1. stupně jdou ve formuláři první.
 */
export function sortSubjectOptionIdsOtherLast(optionIds: number[]): number[] {
  const ids = Array.isArray(optionIds) ? optionIds : [];
  return [
    ...ids.filter((id) => id !== PIPEDRIVE_PERSON_SUBJECT_OPTION_OTHER),
    ...ids.filter((id) => id === PIPEDRIVE_PERSON_SUBJECT_OPTION_OTHER),
  ];
}

function parseNumericId(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Z hodnoty custom pole osoby (string „413,311" / číslo / pole / `{ id }`) vytáhne option ID. */
export function parsePipedrivePersonOptionIds(value: unknown): number[] {
  if (value == null || value === '') return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  const out: number[] = [];
  for (const item of arr) {
    const raw =
      typeof item === 'object' && item !== null
        ? ((item as Record<string, unknown>).id ?? (item as Record<string, unknown>).value)
        : item;
    const n = parseNumericId(raw);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Payload pro pole 9095 (Subject) vůči **existující** hodnotě v Pipedrive:
 *
 *   - `set` (multi) → sjednocení stávajících a vybraných ID, ale „Other" (319)
 *     se z výsledku odebere, jakmile v něm je aspoň jeden konkrétní předmět.
 *     Když se výsledek neliší od stávajícího stavu, vrátí `null` (žádný PUT).
 *   - `enum` (single) a fallback → vybere první konkrétní předmět („Other" až
 *     jako poslední možnost) a zapíše ho, když je pole prázdné nebo v něm je
 *     jen „Other". Ručně vybraný konkrétní předmět obchodníka nepřepisuje.
 *
 * Vrací `null`, když pole/volby chybí nebo není co měnit.
 */
export function buildPipedrivePersonSubjectFieldPayload(
  meta: { key: string; fieldType: string } | null,
  newOptionIds: number[],
  existingRaw: unknown,
): Record<string, unknown> | null {
  if (!meta?.key || !Array.isArray(newOptionIds) || !newOptionIds.length) return null;
  const existing = parsePipedrivePersonOptionIds(existingRaw);
  /** Explicitní `boolean` — jinak si TypeScript odvodí type predicate a zúží `existing` na `319[]`. */
  const isOther = (id: number): boolean => id === PIPEDRIVE_PERSON_SUBJECT_OPTION_OTHER;

  if (meta.fieldType.toLowerCase() === 'set') {
    const union: number[] = [...existing];
    for (const id of newOptionIds) {
      if (!union.includes(id)) union.push(id);
    }
    const target = union.some((id) => !isOther(id)) ? union.filter((id) => !isOther(id)) : union;
    const unchanged =
      target.length === existing.length && target.every((id) => existing.includes(id));
    if (unchanged) return null;
    return { [meta.key]: target };
  }

  const preferred = sortSubjectOptionIdsOtherLast(newOptionIds)[0];
  if (preferred == null) return null;
  /** Prázdné pole doplníme; „Other" od legacy API přepíšeme konkrétním předmětem. */
  const overwritable = existing.length === 0 || existing.every(isOther);
  if (!overwritable || existing.includes(preferred)) return null;
  return { [meta.key]: preferred };
}
