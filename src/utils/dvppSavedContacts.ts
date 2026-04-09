/**
 * Uložené kontakty z brány DVPP dotazníku (pouze v prohlížeči).
 */

export type SavedDvppContact = {
  name: string;
  email: string;
  birthDateIso: string;
  schoolName: string;
  ico: string;
  savedAt: number;
};

const STORAGE_KEY = 'vividbooks_dvpp_survey_contacts_v1';
const MAX = 14;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function keyOf(c: {
  name: string;
  email: string;
  birthDateIso: string;
  schoolName: string;
  ico: string;
}): string {
  const ico = String(c.ico).replace(/\D/g, '');
  return `${norm(c.email)}|${norm(c.name)}|${c.birthDateIso.trim()}|${norm(c.schoolName)}|${ico}`;
}

export function loadSavedDvppContacts(): SavedDvppContact[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is SavedDvppContact =>
          !!x &&
          typeof (x as SavedDvppContact).name === 'string' &&
          typeof (x as SavedDvppContact).email === 'string' &&
          typeof (x as SavedDvppContact).birthDateIso === 'string' &&
          typeof (x as SavedDvppContact).schoolName === 'string' &&
          typeof (x as SavedDvppContact).ico === 'string',
      )
      .map((x) => ({
        name: String(x.name).trim(),
        email: String(x.email).trim(),
        birthDateIso: String(x.birthDateIso).trim(),
        schoolName: String(x.schoolName).trim(),
        ico: String(x.ico).replace(/\D/g, '').slice(0, 10),
        savedAt: typeof x.savedAt === 'number' ? x.savedAt : Date.now(),
      }))
      .filter(
        (x) =>
          x.name.length > 0 &&
          x.email.length > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(x.birthDateIso) &&
          x.schoolName.length > 0 &&
          x.ico.replace(/\D/g, '').length >= 8,
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberDvppContact(parts: {
  name: string;
  email: string;
  birthDateIso: string;
  schoolName: string;
  ico: string;
}): void {
  const name = parts.name.trim();
  const email = parts.email.trim();
  const birthDateIso = parts.birthDateIso.trim();
  const schoolName = parts.schoolName.trim();
  const ico = parts.ico.replace(/\D/g, '').slice(0, 10);
  if (
    !name ||
    !email ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDateIso) ||
    !schoolName ||
    ico.length < 8
  ) {
    return;
  }
  const entry: SavedDvppContact = { name, email, birthDateIso, schoolName, ico, savedAt: Date.now() };
  const prev = loadSavedDvppContacts();
  const k = keyOf(entry);
  const filtered = prev.filter((a) => keyOf(a) !== k);
  const next = [entry, ...filtered].slice(0, MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}
