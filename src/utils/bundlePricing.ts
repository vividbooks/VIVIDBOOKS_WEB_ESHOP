import type { CartItem } from '../contexts/CartContext';
import {
  getProductImage,
  getProductUnitPriceInHaler,
  getProductVariantId,
  isPrintProduct,
  parseSubject,
  pGrade,
} from '../components/cartUpsellUtils';

/**
 * `standard` — jedna cena balíčku se rozdělí mezi vybrané produkty.
 * `nx_plus_one_subject` — předmět + počty kusů; bonus = nejlevnější kusy v sestavě po násobcích (paid+free).
 */
export type ProductBundleKind = 'standard' | 'nx_plus_one_subject';

const OTHER_SUBJECT_LABEL = 'Ostatní';

export const BUNDLE_SUBJECT_MATH_1 = 'Matematika 1. stupeň';
export const BUNDLE_SUBJECT_MATH_2 = 'Matematika 2. stupeň';

/**
 * Štítek předmětu pro filtr balíčků a administraci (matematika → 1. nebo 2. stupeň podle kategorie).
 */
export function productBundleSubjectLabel(p: any): string {
  const cat = String(p.category || '').trim();
  const name = String(p.name || '').trim();
  const lowCat = cat.toLowerCase();

  if (lowCat.includes('matematika')) {
    if (lowCat.includes('1. stupe') || lowCat.includes('1.stupe')) return BUNDLE_SUBJECT_MATH_1;
    if (lowCat.includes('2. stupe') || lowCat.includes('2.stupe')) return BUNDLE_SUBJECT_MATH_2;
    if (/\b1\.\s*stupe/i.test(cat)) return BUNDLE_SUBJECT_MATH_1;
    if (/\b2\.\s*stupe/i.test(cat)) return BUNDLE_SUBJECT_MATH_2;
    const g = pGrade(p);
    if (g != null && g >= 1 && g <= 5) return BUNDLE_SUBJECT_MATH_1;
    if (g != null && g >= 6 && g <= 9) return BUNDLE_SUBJECT_MATH_2;
  }

  const hay = `${name} ${cat}`;
  return parseSubject(hay) ?? OTHER_SUBJECT_LABEL;
}

/** @deprecated alias — používejte `productBundleSubjectLabel`. */
export function productSubjectLabelForBundle(p: any): string {
  return productBundleSubjectLabel(p);
}

export function productMatchesBundleSubjectLabels(p: any, labels: string[] | undefined | null): boolean {
  if (!labels || labels.length === 0) return false;
  const plabel = productBundleSubjectLabel(p);
  if (labels.includes(plabel)) return true;
  /**
   * Zpětná kompatibilita: samotný štítek „Matematika“ (bez 1./2. stupeň) zahrne oba stupně.
   * Když je v balíčku už konkrétní stupeň, široká „Matematika“ se neaplikuje (jinak by kombinace
   * „Matematika“ + „2. stupeň“ omylem pustila i 1. stupeň).
   */
  const hasSpecificMathStage = labels.includes(BUNDLE_SUBJECT_MATH_1) || labels.includes(BUNDLE_SUBJECT_MATH_2);
  if (!hasSpecificMathStage && labels.includes('Matematika')) {
    if (plabel === BUNDLE_SUBJECT_MATH_1 || plabel === BUNDLE_SUBJECT_MATH_2) return true;
    if (plabel === 'Matematika') return true;
  }
  return false;
}

/** Všechny produkty z katalogu, které jdou objednat a spadají pod štítky balíčku (OR). */
export function productsEligibleForSubjectBundle(bundle: ProductBundleRecord, catalog: any[]): any[] {
  if (!bundleIsNxPlusOneSubject(bundle)) return [];
  const labels = bundle.bundleSubjectLabels || [];
  if (labels.length === 0) return [];
  return catalog.filter(
    (p) => getProductVariantId(p) && isPrintProduct(p) && productMatchesBundleSubjectLabels(p, labels),
  );
}

export type NxPlusSubjectSlots = { paid: number; free: number; total: number };

/** Platné sloty pro `nx_plus_one_subject`, jinak `null`. */
export function getNxPlusSubjectSlotCounts(bundle: ProductBundleRecord): NxPlusSubjectSlots | null {
  if (!bundleIsNxPlusOneSubject(bundle)) return null;
  const labels = bundle.bundleSubjectLabels || [];
  if (labels.length === 0) return null;
  const free = Math.max(0, Math.floor(Number(bundle.freeItemCount) || 0));
  const paid = Math.max(0, Math.floor(Number(bundle.paidItemCount) || 0));
  if (paid < 1 || free < 1) return null;
  return { paid, free, total: paid + free };
}

/** Počet „řádků“ balíčku pro UI (tituly / sloty). */
export function bundleSlotTotalCount(bundle: ProductBundleRecord): number {
  const subj = getNxPlusSubjectSlotCounts(bundle);
  if (subj) return subj.total;
  return (bundle.productIds || []).length;
}

/** Počet kusů sešitů pro školní souhrn (1 ks na slot). */
export function bundleWorkbookSlotCountForSchoolOrder(
  bundle: ProductBundleRecord,
  workbookIdSet: Set<string>,
): number {
  if (bundleIsNxPlusOneSubject(bundle)) {
    return getNxPlusSubjectSlotCounts(bundle)?.total ?? 0;
  }
  const ids = bundle.productIds || [];
  const n = ids.filter((pid) => workbookIdSet.has(String(pid))).length;
  return n > 0 ? n : Math.max(1, ids.length);
}

export type ProductBundleRecord = {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  productIds: string[];
  bundlePriceHaler: number;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
  /** Výchozí `standard` (chybí-li v uložených datech). */
  bundleKind?: ProductBundleKind;
  /** Jen `nx_plus_one_subject`: kolik kusů zdarma v každé sadě (nejlevnější v sestavě). */
  freeItemCount?: number;
  /** Jen `nx_plus_one_subject`: štítky předmětu (OR). */
  bundleSubjectLabels?: string[];
  /** Jen `nx_plus_one_subject`: počet placených kusů v jedné sadě. */
  paidItemCount?: number;
};

/**
 * Akce 10+1 podle předmětu — v KV může chybět `bundleKind` nebo být zastaralý zápis.
 * Standardní pevný balíček má vždy neprázdné `productIds`.
 */
export function bundleIsNxPlusOneSubject(bundle: ProductBundleRecord | undefined | null): boolean {
  if (!bundle) return false;
  if (bundle.bundleKind === 'nx_plus_one_subject') return true;
  const labels = bundle.bundleSubjectLabels;
  const paid = bundle.paidItemCount;
  const free = bundle.freeItemCount;
  if (!Array.isArray(labels) || labels.length < 1) return false;
  if (typeof paid !== 'number' || paid < 1 || typeof free !== 'number' || free < 1) return false;
  return (bundle.productIds || []).length === 0;
}

/** Skryje automatickou poznámku z administrace balíčků (neukazovat zákazníkům na webu). */
export function stripBundleAdminBoilerplate(text: string | undefined | null): string | undefined {
  if (text == null || typeof text !== 'string') return undefined;
  const cleaned = text
    .replace(
      /\s*Vytvořeno automaticky jako šablona\.?\s*Upravte nebo smažte v administraci E-shop\s*[→>]\s*Balíčky\.?\s*/gi,
      '',
    )
    .trim();
  return cleaned || undefined;
}

/**
 * Rozdělí cenu balíčku mezi položky podle katalogových cen (largest remainder),
 * součet unitPrice v haléřích = bundlePriceHaler (po 1 ks na produkt v balíčku).
 */
export function allocateBundleUnitPrices(
  products: any[],
  productIdsInOrder: string[],
  bundlePriceHaler: number,
): Array<{
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  imageUrl?: string;
}> {
  const lines: Array<{ product: any; list: number }> = [];
  for (const rawId of productIdsInOrder) {
    const product = products.find((p) => String(p.id) === String(rawId));
    const variantId = product ? getProductVariantId(product) : undefined;
    if (!product || !variantId) continue;
    lines.push({ product, list: getProductUnitPriceInHaler(product) });
  }

  if (lines.length === 0) return [];
  const n = lines.length;
  const target = Math.max(0, Math.round(bundlePriceHaler));

  const totalList = lines.reduce((s, l) => s + l.list, 0);
  const unitPrices: number[] = new Array(n).fill(0);

  if (totalList <= 0) {
    const each = Math.floor(target / n);
    let rem = target - each * n;
    for (let i = 0; i < n; i++) {
      unitPrices[i] = each + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
    }
  } else {
    const exact = lines.map((l) => (l.list / totalList) * target);
    const floors = exact.map((x) => Math.floor(x));
    let remainder = target - floors.reduce((a, b) => a + b, 0);
    const order = [...lines.keys()].sort(
      (a, b) => (exact[b] - floors[b]) - (exact[a] - floors[a]),
    );
    for (let i = 0; i < n; i++) unitPrices[i] = floors[i];
    for (let k = 0; k < remainder; k++) {
      unitPrices[order[k]]++;
    }
  }

  return lines.map((l, i) => ({
    productId: String(l.product.id),
    productName: l.product.name || l.product.title || 'Produkt',
    variantId: getProductVariantId(l.product),
    variantName: typeof l.product.category === 'string' && l.product.category.trim()
      ? l.product.category.trim()
      : undefined,
    unitPrice: unitPrices[i] ?? 0,
    imageUrl: getProductImage(l.product),
  }));
}

function cartRowsFromPaidFreeRows(
  paidRows: Array<{
    productId: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    unitPrice: number;
    imageUrl?: string;
  }>,
  freeRows: typeof paidRows,
  bundle: ProductBundleRecord,
  bundleInstanceId: string,
): CartItem[] {
  const rows = [...paidRows, ...freeRows];
  return rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    variantId: row.variantId,
    variantName: row.variantName,
    quantity: 1,
    unitPrice: row.unitPrice,
    imageUrl: row.imageUrl,
    bundleId: bundle.id,
    bundleTitle: bundle.title,
    bundleInstanceId,
  }));
}

export type SubjectBundleQtyUnit = {
  productId: string;
  product: any;
  unitPriceHaler: number;
  isFree: boolean;
};

/**
 * Rozdělí kusy v košíku: v každé celé sadě (paid+free) jsou zdarma nejlevnější kusy v celém výběru.
 * Vrátí `null`, pokud není co dělit, počet není násobkem sady, nebo produkt nepatří do štítků.
 */
export function allocateSubjectBundleQuantities(
  products: any[],
  bundle: ProductBundleRecord,
  quantities: Record<string, number>,
): SubjectBundleQtyUnit[] | null {
  const slots = getNxPlusSubjectSlotCounts(bundle);
  const labels = bundle.bundleSubjectLabels || [];
  if (!slots || labels.length === 0) return null;

  const units: Array<{ productId: string; product: any; unitPriceHaler: number }> = [];
  for (const [rawId, rawQ] of Object.entries(quantities)) {
    const q = Math.max(0, Math.floor(Number(rawQ) || 0));
    if (q <= 0) continue;
    const product = products.find((p) => String(p.id) === String(rawId));
    if (!product || !getProductVariantId(product)) return null;
    if (!productMatchesBundleSubjectLabels(product, labels)) return null;
    const price = getProductUnitPriceInHaler(product);
    for (let i = 0; i < q; i++) {
      units.push({ productId: String(product.id), product, unitPriceHaler: price });
    }
  }

  const total = units.length;
  if (total === 0) return null;
  if (total % slots.total !== 0) return null;

  const freeSlots = (total / slots.total) * slots.free;
  units.sort((a, b) => (
    a.unitPriceHaler !== b.unitPriceHaler
      ? a.unitPriceHaler - b.unitPriceHaler
      : String(a.productId).localeCompare(String(b.productId), 'cs')
  ));

  return units.map((u, i) => ({
    ...u,
    isFree: i < freeSlots,
  }));
}

export type SubjectBundleQtySummary = {
  total: number;
  setSize: number;
  paidPerSet: number;
  freePerSet: number;
  completeSets: number;
  remainder: number;
  freePieces: number;
  paidPieces: number;
  needsForNextSet: number;
  isValidMultiple: boolean;
};

/** Průběžný souhrn počtů (i když zatím není násobek sady). */
export function subjectBundleQtySummary(
  bundle: ProductBundleRecord,
  quantities: Record<string, number>,
): SubjectBundleQtySummary | null {
  const slots = getNxPlusSubjectSlotCounts(bundle);
  if (!slots) return null;
  let total = 0;
  for (const rawQ of Object.values(quantities)) {
    total += Math.max(0, Math.floor(Number(rawQ) || 0));
  }
  const completeSets = Math.floor(total / slots.total);
  const remainder = total % slots.total;
  const freePieces = completeSets * slots.free;
  const paidPieces = total - freePieces;
  const needsForNextSet = remainder === 0 ? 0 : slots.total - remainder;
  return {
    total,
    setSize: slots.total,
    paidPerSet: slots.paid,
    freePerSet: slots.free,
    completeSets,
    remainder,
    freePieces,
    paidPieces,
    needsForNextSet,
    isValidMultiple: total > 0 && remainder === 0,
  };
}

/** Katalogový součet všech vybraných kusů bez uplatnění bonusu (nápověda před dokončením sady). */
export function subjectBundleQuantitiesRawCatalogSumHaler(
  products: any[],
  quantities: Record<string, number>,
): number {
  let sum = 0;
  for (const [rawId, rawQ] of Object.entries(quantities)) {
    const q = Math.max(0, Math.floor(Number(rawQ) || 0));
    if (q <= 0) continue;
    const p = products.find((x) => String(x.id) === String(rawId));
    if (p) sum += getProductUnitPriceInHaler(p) * q;
  }
  return sum;
}

function aggregateSubjectQtyUnitsToCartItems(
  allocated: SubjectBundleQtyUnit[],
  bundle: ProductBundleRecord,
  baseInstanceId: string,
): CartItem[] {
  type Agg = { product: any; qty: number; unitPrice: number; isFree: boolean };
  const map = new Map<string, Agg>();
  for (const u of allocated) {
    const tier = u.isFree ? 'f' : 'p';
    const key = `${u.productId}::${tier}`;
    const prev = map.get(key);
    if (prev) prev.qty += 1;
    else {
      map.set(key, {
        product: u.product,
        qty: 1,
        unitPrice: u.isFree ? 0 : u.unitPriceHaler,
        isFree: u.isFree,
      });
    }
  }

  const rows: CartItem[] = [];
  for (const [, g] of map) {
    const variantId = getProductVariantId(g.product);
    if (!variantId) continue;
    rows.push({
      productId: String(g.product.id),
      productName: g.product.name || g.product.title || 'Produkt',
      variantId,
      variantName: typeof g.product.category === 'string' && g.product.category.trim()
        ? g.product.category.trim()
        : undefined,
      quantity: g.qty,
      unitPrice: g.unitPrice,
      imageUrl: getProductImage(g.product),
      bundleId: bundle.id,
      bundleTitle: bundle.title,
      bundleInstanceId: `${baseInstanceId}#${g.isFree ? 'free' : 'paid'}:${String(g.product.id)}`,
    });
  }

  rows.sort((a, b) => {
    const af = a.bundleInstanceId?.includes('#free:') ? 1 : 0;
    const bf = b.bundleInstanceId?.includes('#free:') ? 1 : 0;
    if (af !== bf) return af - bf;
    return String(a.productName).localeCompare(String(b.productName), 'cs');
  });
  return rows;
}

/** Součet katalogových cen placených kusů po uplatnění bonusu (náhled / shoda s košíkem). */
export function subjectBundleSelectionPaidListSumHaler(
  products: any[],
  bundle: ProductBundleRecord,
  quantities: Record<string, number>,
): number {
  const alloc = allocateSubjectBundleQuantities(products, bundle, quantities);
  if (!alloc) return 0;
  return alloc.filter((u) => !u.isFree).reduce((s, u) => s + u.unitPriceHaler, 0);
}

/**
 * Součet katalogových cen pro srovnání s cenou balíčku (jen standardní balíček).
 */
export function bundleCatalogListSumHaler(bundle: ProductBundleRecord, catalog: any[]): number {
  if (bundleIsNxPlusOneSubject(bundle)) return 0;
  return (bundle.productIds || []).reduce((sum, rawId) => {
    const p = catalog.find((x) => String(x.id) === String(rawId));
    return sum + (p ? getProductUnitPriceInHaler(p) : 0);
  }, 0);
}

/** Celkový katalogový součet všech titulů v balíčku. */
export function bundleFullCatalogListSumHaler(bundle: ProductBundleRecord, catalog: any[]): number {
  if (bundleIsNxPlusOneSubject(bundle)) return 0;
  return (bundle.productIds || []).reduce((sum, rawId) => {
    const p = catalog.find((x) => String(x.id) === String(rawId));
    return sum + (p ? getProductUnitPriceInHaler(p) : 0);
  }, 0);
}

export type BuildBundleCartLinesOptions = {
  /** Jen `nx_plus_one_subject`: počty kusů podle `productId`. */
  subjectQuantities?: Record<string, number>;
};

export function buildBundleCartLines(
  products: any[],
  bundle: ProductBundleRecord,
  bundleInstanceId: string,
  options?: BuildBundleCartLinesOptions,
): CartItem[] {
  if (bundleIsNxPlusOneSubject(bundle)) {
    const qty = options?.subjectQuantities;
    if (!qty) return [];
    const allocated = allocateSubjectBundleQuantities(products, bundle, qty);
    if (!allocated || allocated.length === 0) return [];
    return aggregateSubjectQtyUnitsToCartItems(allocated, bundle, bundleInstanceId);
  }

  const ids = bundle.productIds || [];
  const paidRows = allocateBundleUnitPrices(products, ids, bundle.bundlePriceHaler);
  if (paidRows.length !== ids.length) return [];
  return cartRowsFromPaidFreeRows(paidRows, [], bundle, bundleInstanceId);
}
