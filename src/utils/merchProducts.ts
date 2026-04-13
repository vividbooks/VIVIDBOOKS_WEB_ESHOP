import type { Product } from '../types/product';

/** Režim výpisu „dalších produktů“ v adminu i na e-shop stránce. */
export type MerchBrowseState =
  | null
  | 'all'
  | { category: string; subcategory: string | null };

export function isMerchProduct(p: Pick<Product, 'type'>): boolean {
  return p.type === 'merch';
}

/** Shoptet / katalog: „Nástěnné obrazy a tabule“ — plakáty, tabule (hero jako fotka přes celou plochu). */
export const MERCH_WALL_ART_BOARDS_CATEGORY = 'Nástěnné obrazy a tabule';

function textMentionsWallArtRoot(s: string): boolean {
  const t = s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return (
    t.includes('nastenne') &&
    (t.includes('obraz') || t.includes('tabul'))
  );
}

export function isMerchWallArtBoardsProduct(p: {
  type?: string;
  category?: string;
  merchCategory?: string;
}): boolean {
  if (p.type !== 'merch') return false;
  const a = String(p.merchCategory ?? '').trim();
  const b = String(p.category ?? '').trim();
  if (a === MERCH_WALL_ART_BOARDS_CATEGORY || b === MERCH_WALL_ART_BOARDS_CATEGORY) return true;
  return textMentionsWallArtRoot(`${a} ${b}`);
}

export function getMerchCategoryLabel(p: { merchCategory?: string; category?: string }): string {
  const v = String(p.merchCategory ?? '').trim();
  if (v) return v;
  const c = String(p.category ?? '').trim();
  if (c) return c;
  return 'Bez kategorie';
}

export function getMerchSubcategoryLabel(p: { merchSubcategory?: string }): string {
  return String(p.merchSubcategory ?? '').trim();
}

export function filterMerchByBrowse(products: Product[], state: Exclude<MerchBrowseState, null>): Product[] {
  let list = products.filter(isMerchProduct);
  if (state === 'all') return list;
  list = list.filter((p) => getMerchCategoryLabel(p) === state.category);
  if (state.subcategory) {
    list = list.filter((p) => getMerchSubcategoryLabel(p) === state.subcategory);
  }
  return list;
}

export function merchCategoryCounts(products: Product[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of products.filter(isMerchProduct)) {
    const k = getMerchCategoryLabel(p);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function merchSubcategoryCountsForCategory(products: Product[], category: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of products.filter(isMerchProduct)) {
    if (getMerchCategoryLabel(p) !== category) continue;
    const sub = getMerchSubcategoryLabel(p);
    if (!sub) continue;
    m.set(sub, (m.get(sub) ?? 0) + 1);
  }
  return m;
}
