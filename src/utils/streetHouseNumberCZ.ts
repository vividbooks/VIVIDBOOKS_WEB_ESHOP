/**
 * Ulice musí obsahovat číslo popisné/orientační (alespoň jednu číslici).
 */

export function hasStreetWithHouseNumber(street: string): boolean {
  const s = street.trim();
  if (s.length < 2) return false;
  return /\d/.test(s);
}

export const STREET_NUMBER_HINT_CS =
  'Dopište číslo domu (popisné nebo orientační) do pole „Ulice a číslo“ — např. Ostravská 12.';
