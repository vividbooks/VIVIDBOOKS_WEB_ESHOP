/** CZ/SK PSČ — po normalizaci přesně 5 číslic. */

export function normalizePostalCodeDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/\D/g, '');
}

export function isValidCZSKPostalCode(raw: string): boolean {
  const d = normalizePostalCodeDigits(raw);
  return d.length === 5 && /^\d{5}$/.test(d);
}
