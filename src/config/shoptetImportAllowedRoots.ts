/**
 * Kořenové názvy segmentů v cestě kategorie ze Shoptetu (např. „E-shop > Pracovní sešity > …“).
 * Stačí shoda kteréhokoli segmentu s jedním z těchto řetězců (viz `matchAllowedCategoryInPath`).
 */
export const SHOPTET_IMPORT_ALLOWED_ROOTS = [
  'Nástěnné obrazy a tabule',
  'Žákovské knížky',
  'Pracovní sešity',
  'Digitální učebnice',
  'Digitální licence',
  'Vividboard',
  'Didaktické pomůcky',
  'Plakáty',
  'Tištěné učebnice',
] as const;

const EXTRA_ENV_SPLIT = /[,;\n]+/;

/** Rozparsuje např. env `VITE_SHOPTET_IMPORT_EXTRA_ROOTS` nebo `SHOPTET_IMPORT_EXTRA_ROOTS`. */
export function parseShoptetExtraRootsEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(EXTRA_ENV_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mergeShoptetAllowedRoots(extra?: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ');
  for (const raw of [...SHOPTET_IMPORT_ALLOWED_ROOTS, ...(extra || [])]) {
    const key = norm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}
