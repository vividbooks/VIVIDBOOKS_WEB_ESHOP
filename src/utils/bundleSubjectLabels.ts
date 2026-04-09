/**
 * Odvození názvu předmětu pro zobrazení u balíčku (stejná logika jako u karet v katalogu).
 * Seřazeno od nejdelšího — aby „Anglický jazyk“ byl dříve než „Anglický“.
 */
const KNOWN_NAME_PREFIXES = [
  'Anglický jazyk',
  'Český jazyk',
  'Přírodopis',
  'Matematika',
  'Fyzika',
  'Chemie',
  'Prvouka',
];

/** Odstraní „ 1. stupeň“ / „ 2. stupeň“ z kategorie (např. Matematika 1. stupeň → Matematika). */
const STUPEN_SUFFIX = /\s+\d+\.\s*stupe[nň]/i;

function subjectFromProductName(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  for (const s of KNOWN_NAME_PREFIXES) {
    if (n.startsWith(s)) return s;
  }
  return null;
}

/**
 * Vrátí hrubý název předmětu pro jeden produkt (kategorie bez ročníku/stupně, jinak prefix názvu).
 */
export function coarseSubjectFromProduct(product: { name?: string; category?: string }): string {
  const cat = String(product.category || '').trim();
  if (cat) {
    const base = cat.replace(STUPEN_SUFFIX, '').trim();
    if (base) return base;
  }
  const fromName = subjectFromProductName(String(product.name || ''));
  if (fromName) return fromName;
  return cat || 'Ostatní';
}

const SUBJECT_SORT_ORDER: string[] = [
  'Matematika',
  'Český jazyk',
  'Prvouka',
  'Fyzika',
  'Chemie',
  'Přírodopis',
  'Anglický jazyk',
];

function compareSubjectLabels(a: string, b: string): number {
  const ia = SUBJECT_SORT_ORDER.indexOf(a);
  const ib = SUBJECT_SORT_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, 'cs');
}

/** Unikátní seznam předmětů v balíčku (pro náhled na Akcích). */
export function uniqueBundleSubjectLabels(products: Array<{ name?: string; category?: string }>): string[] {
  const set = new Set<string>();
  for (const p of products) {
    set.add(coarseSubjectFromProduct(p));
  }
  return [...set].sort(compareSubjectLabels);
}

/**
 * Unikátní plné kategorie z katalogu (např. „Matematika 1. stupeň“) v pořadí výskytu v balíčku.
 */
export function uniqueBundleCategoryLines(products: Array<{ category?: string }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of products) {
    const c = String(p.category || '').trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}
