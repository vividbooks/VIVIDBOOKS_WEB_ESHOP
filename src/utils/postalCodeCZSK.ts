/**
 * PSČ pro ČR a SK — po normalizaci přesně 5 číslic.
 */

export function normalizePostalCodeDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/\D/g, '');
}

export function isValidCZSKPostalCode(raw: string): boolean {
  const d = normalizePostalCodeDigits(raw);
  return d.length === 5 && /^\d{5}$/.test(d);
}

export const POSTAL_CODE_HINT_CS = 'Zadejte platné PSČ (5 číslic, např. 110 00).';
