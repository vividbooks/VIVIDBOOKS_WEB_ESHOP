/**
 * Uložené fakturační adresy z minulých objednávek (pouze v prohlížeči).
 */

export type SavedCheckoutAddress = {
  street: string;
  city: string;
  zip: string;
  savedAt: number;
};

const STORAGE_KEY = 'vividbooks_checkout_addresses_v1';
const MAX = 14;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function keyOf(a: { street: string; city: string; zip: string }): string {
  const z = String(a.zip).replace(/\s/g, '');
  return `${norm(a.street)}|${norm(a.city)}|${z}`;
}

export function loadSavedCheckoutAddresses(): SavedCheckoutAddress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is SavedCheckoutAddress =>
          !!x &&
          typeof (x as SavedCheckoutAddress).street === 'string' &&
          typeof (x as SavedCheckoutAddress).city === 'string' &&
          typeof (x as SavedCheckoutAddress).zip === 'string',
      )
      .map((x) => ({
        street: String(x.street).trim(),
        city: String(x.city).trim(),
        zip: String(x.zip).trim().replace(/\s/g, ''),
        savedAt: typeof x.savedAt === 'number' ? x.savedAt : Date.now(),
      }))
      .filter((x) => x.street.length > 0 && x.city.length > 0 && x.zip.length > 0)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberCheckoutAddress(parts: { street: string; city: string; zip: string }): void {
  const street = parts.street.trim();
  const city = parts.city.trim();
  const zip = parts.zip.trim().replace(/\s/g, '');
  if (!street || !city || !zip) return;
  const entry: SavedCheckoutAddress = { street, city, zip, savedAt: Date.now() };
  const prev = loadSavedCheckoutAddresses();
  const k = keyOf(entry);
  const filtered = prev.filter((a) => keyOf(a) !== k);
  const next = [entry, ...filtered].slice(0, MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}
