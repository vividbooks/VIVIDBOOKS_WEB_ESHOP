/**
 * Doplnění kontaktů (telefon, e-mail) k existující osobě v Pipedrive.
 *
 * Pipedrive `PUT /persons/{id}` s `phone`/`email` **přepíše celý seznam** hodnot osoby.
 * Proto novou hodnotu z objednávky / formuláře k osobě jen **přidáváme**: stávající
 * hodnoty (včetně štítků a primární) zůstanou, nová se připojí na konec. Když osoba
 * hodnotu už má, patch se neposílá.
 *
 * Tvary vstupu, které Pipedrive vrací:
 *   - plný záznam / výpis osob organizace: `phone: [{ value, primary, label }]`,
 *   - `/persons/search`: `phones: ['+420…']`, `emails: ['a@b.cz']` (bez štítků).
 */

export type PipedriveContactKind = 'phone' | 'email';

export type PipedriveContactEntry = { value: string; primary: boolean; label: string };

export type PipedriveContactRead = {
  entries: PipedriveContactEntry[];
  /** `true`, když záznam nese plné objekty (`phone: [{value, primary, label}]`);
   *  `false` u odpovědi search (jen řetězce) – před přepisem je pak potřeba plný záznam. */
  complete: boolean;
};

/** Normalizace pro porovnání: e-mail malými písmeny, telefon jen číslice bez předvolby 420 / 00420. */
export function normalizePipedriveContactValue(kind: PipedriveContactKind, value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (kind === 'email') return s.toLowerCase();
  let digits = s.replace(/\D+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('420')) digits = digits.slice(3);
  return digits;
}

/** Přečte stávající hodnoty kontaktu osoby (obě podoby odpovědi Pipedrive). */
export function readPipedriveContactEntries(record: any, kind: PipedriveContactKind): PipedriveContactRead {
  const entries: PipedriveContactEntry[] = [];
  const raw = record?.[kind];
  /** Plný tvar = pole `phone`/`email` přímo na záznamu. Bez něj (search vrací jen `phones`/`emails`,
   *  i prázdné, a index může být zpožděný) nevíme, co osoba má → před přepisem načíst detail. */
  let complete = Array.isArray(raw) || (raw != null && typeof raw === 'object');
  const pushObj = (entry: any) => {
    const value = String(entry?.value ?? '').trim();
    if (!value) return;
    entries.push({ value, primary: entry?.primary === true, label: String(entry?.label || 'work') });
  };
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === 'object') pushObj(entry);
      else if (String(entry ?? '').trim()) {
        complete = false;
        entries.push({ value: String(entry).trim(), primary: false, label: 'work' });
      }
    }
  } else if (raw && typeof raw === 'object') {
    pushObj(raw);
  } else if (String(raw ?? '').trim()) {
    complete = false;
    entries.push({ value: String(raw).trim(), primary: false, label: 'work' });
  }
  const plural = record?.[`${kind}s`];
  if (Array.isArray(plural)) {
    for (const entry of plural) {
      const value = String((entry && typeof entry === 'object' ? entry.value : entry) ?? '').trim();
      if (!value) continue;
      if (entries.some((e) => normalizePipedriveContactValue(kind, e.value) === normalizePipedriveContactValue(kind, value))) {
        continue;
      }
      complete = false;
      entries.push({ value, primary: false, label: 'work' });
    }
  }
  return { entries, complete };
}

export function pipedriveRecordHasContact(record: any, kind: PipedriveContactKind, value: string): boolean {
  const wanted = normalizePipedriveContactValue(kind, value);
  if (!wanted) return true;
  return readPipedriveContactEntries(record, kind).entries.some(
    (e) => normalizePipedriveContactValue(kind, e.value) === wanted,
  );
}

/**
 * Seznam hodnot pro `PUT /persons/{id}` = stávající + nová, nebo `null`, když osoba hodnotu
 * už má (nic neposílat). Bez stávajících hodnot se nová stane primární.
 */
export function mergePipedriveContactValue(
  existing: PipedriveContactEntry[],
  kind: PipedriveContactKind,
  value: string,
): PipedriveContactEntry[] | null {
  const v = String(value ?? '').trim();
  const wanted = normalizePipedriveContactValue(kind, v);
  if (!wanted) return null;
  if (existing.some((e) => normalizePipedriveContactValue(kind, e.value) === wanted)) return null;
  const kept = existing.map((e) => ({ value: e.value, primary: e.primary, label: e.label || 'work' }));
  const hasPrimary = kept.some((e) => e.primary);
  if (kept.length && !hasPrimary) kept[0].primary = true;
  return [...kept, { value: v, primary: kept.length === 0, label: 'work' }];
}

/**
 * Patch kontaktů pro existující osobu. Když `record` nese jen řetězce (search), načte plný
 * záznam přes `loadFull` – jinak by přepis smazal štítky / primární hodnotu.
 */
export async function buildPipedriveContactPatch(
  record: any,
  wanted: { phone?: string; email?: string },
  loadFull: () => Promise<any | null>,
): Promise<Record<string, PipedriveContactEntry[]>> {
  const kinds: PipedriveContactKind[] = [];
  if (wanted.phone && !pipedriveRecordHasContact(record, 'phone', wanted.phone)) kinds.push('phone');
  if (wanted.email && !pipedriveRecordHasContact(record, 'email', wanted.email)) kinds.push('email');
  if (!kinds.length) return {};

  let source = record;
  if (kinds.some((k) => !readPipedriveContactEntries(record, k).complete)) {
    const full = await loadFull().catch(() => null);
    if (!full) return {};
    source = full;
  }

  const patch: Record<string, PipedriveContactEntry[]> = {};
  for (const kind of kinds) {
    const merged = mergePipedriveContactValue(readPipedriveContactEntries(source, kind).entries, kind, wanted[kind] || '');
    if (merged) patch[kind] = merged;
  }
  return patch;
}
