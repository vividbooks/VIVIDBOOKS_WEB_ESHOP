export const PHONE_CZ_HINT =
  'Zadejte platný český telefon (např. 739 056 178 nebo +420 739 056 178).';

export function normalizeCzechPhone(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const compact = value.replace(/[\s().-]+/g, '');
  if (/^\+420\d{9}$/.test(compact)) return compact;
  if (/^00420\d{9}$/.test(compact)) return `+420${compact.slice(5)}`;
  if (/^420\d{9}$/.test(compact)) return `+420${compact.slice(3)}`;
  if (/^\d{9}$/.test(compact)) return `+420${compact}`;

  return null;
}

export function isValidCzechPhone(raw: unknown): boolean {
  return normalizeCzechPhone(raw) != null;
}
