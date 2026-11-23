/**
 * Štítek před jménem lektora na stránce webináře: „Lektor“, „Lektorka“, „Lektorky“, „Lektoři“.
 *
 * Pole `lecturer` je volný text („František Cáb“, „Jitka Krbcová a Eva Šrailová“,
 * „Specialistka na financování škol Ing. Petra Schwarzová“, „Tým Vividbooks“), takže štítek
 * odvozujeme z nalezených jmen. Když odhad nesedí (ženské příjmení bez -á, cizí jména),
 * přepíše ho nepovinné pole webináře `lecturerLabel`.
 */

const TITLES = /(?<![\p{L}])(?:prof|doc|rndr|phdr|paeddr|mudr|judr|mgr|ing|bc|ph\.?\s?d|csc|mba|dis)\.?(?![\p{L}])/giu;
/** Jméno = dvě až tři slova s velkým počátečním písmenem za sebou („Kateřina Machová Ondřejová“). */
const PERSON = /(?<![\p{L}\p{N}])\p{Lu}\p{Ll}+(?:[  ]\p{Lu}\p{Ll}+){1,2}(?![\p{L}\p{N}])/gu;
/** Slova, která vypadají jako jméno, ale člověka neoznačují. */
const NOT_A_PERSON = /(?<![\p{L}])(?:vividbooks|tým|team)(?![\p{L}])/iu;
/** V textu je ještě někdo další, koho nejmenujeme („a hosté“, „+ speciální host“). */
const MORE_PEOPLE = /\+|(?<![\p{L}])(?:host|hosté|hosty|hostů|tým|team|kolektiv)(?![\p{L}])/iu;

export type LecturerLabel = 'Lektor' | 'Lektorka' | 'Lektorky' | 'Lektoři';

/** Jména lidí nalezená ve volném textu pole `lecturer` (bez titulů a popisů). */
export function lecturerNames(lecturer: string | null | undefined): string[] {
  const text = String(lecturer || '').replace(TITLES, ',');
  return (text.match(PERSON) || []).filter((name) => !NOT_A_PERSON.test(name));
}

/** Ženské příjmení poznáme podle koncovky -á (Krbcová, Veselá). */
function isFemaleName(name: string): boolean {
  const surname = name.trim().split(/[  ]+/).pop() || '';
  return /á$/u.test(surname);
}

export function lecturerLabel(
  lecturer: string | null | undefined,
  override?: string | null,
): string {
  const manual = String(override || '').trim().replace(/:\s*$/, '');
  if (manual) return manual;

  const text = String(lecturer || '');
  const names = lecturerNames(text);
  if (names.length === 0 || MORE_PEOPLE.test(text)) return 'Lektoři';
  const allFemale = names.every(isFemaleName);
  if (names.length === 1) return allFemale ? 'Lektorka' : 'Lektor';
  return allFemale ? 'Lektorky' : 'Lektoři';
}
