/**
 * Datum narození zadávané třemi poli (den, měsíc, rok) místo nativního kalendáře,
 * ve kterém se na telefonu k roku narození muselo doklikat po měsících zpět.
 * Ven jde pořád stejná hodnota jako z <input type="date">: `YYYY-MM-DD`, nebo ''.
 */

export type BirthDateParts = { day: string; month: string; year: string };

export const EMPTY_BIRTH_DATE_PARTS: BirthDateParts = { day: '', month: '', year: '' };

export const BIRTH_YEAR_MIN = 1900;

const digits = (s: string, max: number) => String(s ?? '').replace(/\D+/g, '').slice(0, max);

/** Nechá jen číslice a ořízne na délku pole (den 2, měsíc 2, rok 4). */
export function sanitizeBirthDateParts(p: BirthDateParts): BirthDateParts {
  return { day: digits(p.day, 2), month: digits(p.month, 2), year: digits(p.year, 4) };
}

/** `YYYY-MM-DD` → části bez úvodních nul (5, 3, 1980). Neplatný vstup → prázdná pole. */
export function birthDatePartsFromIso(iso: string): BirthDateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return { ...EMPTY_BIRTH_DATE_PARTS };
  return { day: String(parseInt(m[3], 10)), month: String(parseInt(m[2], 10)), year: m[1] };
}

/**
 * Části → `YYYY-MM-DD`. Vrací '' , dokud není vyplněný den, měsíc i čtyřmístný rok,
 * když takový den v kalendáři není (31. 2.), nebo když je datum v budoucnu či před rokem 1900.
 */
export function birthDateIsoFromParts(p: BirthDateParts, now: Date = new Date()): string {
  const s = sanitizeBirthDateParts(p);
  if (!s.day || !s.month || s.year.length !== 4) return '';
  const d = parseInt(s.day, 10);
  const m = parseInt(s.month, 10);
  const y = parseInt(s.year, 10);
  if (y < BIRTH_YEAR_MIN || m < 1 || m > 12 || d < 1) return '';
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) return '';
  const iso = `${s.year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (iso > todayIso) return '';
  return iso;
}

/** Všechna tři pole jsou vyplněná, ale platné datum z nich nevzniklo → ukázat nápovědu. */
export function birthDatePartsLookInvalid(p: BirthDateParts, now: Date = new Date()): boolean {
  const s = sanitizeBirthDateParts(p);
  if (!s.day || !s.month || s.year.length !== 4) return false;
  return birthDateIsoFromParts(s, now) === '';
}
