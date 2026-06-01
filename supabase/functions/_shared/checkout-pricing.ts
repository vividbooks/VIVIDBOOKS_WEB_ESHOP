import { getProductUnitPriceInHaler, parsePriceTextToKc } from './product-price.ts';

/**
 * Ověření cen košíku oproti katalogu (make-server /products + /product-bundles).
 * Použití: create-payment-intent, submit-transfer-order.
 */

export type CheckoutItemInput = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  variant?: string;
  bundleId?: string;
  bundleTitle?: string;
  posterMerch?: boolean;
};

export type ProductBundleRecord = {
  id: string;
  title: string;
  productIds: string[];
  bundlePriceHaler: number;
  bundleKind?: 'standard' | 'nx_plus_one_subject';
  freeItemCount?: number;
  paidItemCount?: number;
  bundleSubjectLabels?: string[];
};

const PRICE_TOLERANCE_HALER = 5;
const BUNDLE_TOTAL_TOLERANCE_HALER = 25;

const SHIPPING_HALER_BY_METHOD: Record<string, number> = {
  dpd: 8900,
  zasilkovna: 7900,
  gls: 8900,
  ppl: 9900,
};

export function validateShippingPriceHalers(method: string, priceHalers: number): string | null {
  const expected = SHIPPING_HALER_BY_METHOD[method];
  if (expected === undefined) {
    return 'Neplatná doprava.';
  }
  if (priceHalers !== expected) {
    return 'Neplatná cena dopravy.';
  }
  return null;
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export async function loadCheckoutCatalog(
  supabaseUrl: string,
  authHeaders: Record<string, string>,
): Promise<{ products: any[]; bundles: ProductBundleRecord[] }> {
  const base = supabaseUrl.replace(/\/$/, '');
  const productsUrl = `${base}/functions/v1/make-server-93a20b6f/products`;
  const bundlesUrl = `${base}/functions/v1/make-server-93a20b6f/product-bundles`;

  const [pJson, bJson] = await Promise.all([
    fetchJson(productsUrl, authHeaders),
    fetchJson(bundlesUrl, authHeaders),
  ]);

  const products = Array.isArray((pJson as { products?: unknown })?.products)
    ? (pJson as { products: any[] }).products
    : [];
  const bundlesRaw = Array.isArray((bJson as { bundles?: unknown })?.bundles)
    ? (bJson as { bundles: ProductBundleRecord[] }).bundles
    : [];

  return { products, bundles: bundlesRaw };
}

function getProductVariantId(product: any): string | undefined {
  const variantId = product.shopifyVariantId || product.variantId;
  if (typeof variantId === 'string' && variantId.trim().length > 0) return variantId.trim();
  const merch = product.merchVariants;
  if (Array.isArray(merch)) {
    for (const v of merch) {
      const vid = v?.shopifyVariantId;
      if (typeof vid === 'string' && vid.trim().length > 0) return vid.trim();
    }
  }
  if (String(product.type || '').toLowerCase() === 'merch' && Array.isArray(merch) && merch.length > 0) {
    for (const v of merch) {
      const sku = typeof v?.shoptetId === 'string' ? v.shoptetId.trim() : '';
      if (sku) return sku;
    }
    for (const v of merch) {
      const metaVid = v?.metadata?.shoptetVariantId;
      if (typeof metaVid === 'string' && metaVid.trim().length > 0) return metaVid.trim();
    }
    for (const v of merch) {
      const rowId = typeof v?.id === 'string' ? v.id.trim() : '';
      if (rowId) return rowId;
    }
  }
  const shoptetProduct = product.shoptetId || product.shoptetProductId;
  if (typeof shoptetProduct === 'string' && shoptetProduct.trim().length > 0) {
    return shoptetProduct.trim();
  }
  return undefined;
}

function variantMatchPriceHaler(product: any, variantLabel: string): number | null {
  const label = variantLabel.trim().toLowerCase();
  const merch = product.merchVariants;
  if (!Array.isArray(merch)) return null;
  for (const v of merch) {
    const vl = typeof v?.label === 'string' ? v.label.trim().toLowerCase() : '';
    const vid = typeof v?.id === 'string' ? v.id.trim().toLowerCase() : '';
    if (vl && vl === label) {
      const fromText = parsePriceTextToKc(v?.price);
      if (fromText !== null) return Math.round(fromText * 100);
      if (typeof v.priceAmount === 'number' && Number.isFinite(v.priceAmount)) {
        return Math.max(0, Math.round(v.priceAmount * 100));
      }
    }
    if (vid && vid === label) {
      const fromText = parsePriceTextToKc(v?.price);
      if (fromText !== null) return Math.round(fromText * 100);
      if (typeof v.priceAmount === 'number' && Number.isFinite(v.priceAmount)) {
        return Math.max(0, Math.round(v.priceAmount * 100));
      }
    }
  }
  return null;
}

function expectedUnitPriceForLine(product: any, variant?: string): number {
  if (variant?.trim()) {
    const vPrice = variantMatchPriceHaler(product, variant);
    if (vPrice !== null) return vPrice;
  }
  return getProductUnitPriceInHaler(product);
}

function bundleIsNxPlusOneSubject(bundle: ProductBundleRecord): boolean {
  if (bundle.bundleKind === 'nx_plus_one_subject') return true;
  const labels = bundle.bundleSubjectLabels;
  const paid = bundle.paidItemCount;
  const free = bundle.freeItemCount;
  if (!Array.isArray(labels) || labels.length < 1) return false;
  if (typeof paid !== 'number' || paid < 1 || typeof free !== 'number' || free < 1) return false;
  return (bundle.productIds || []).length === 0;
}

/**
 * `paid` z konfigurace = velikost sady (počet ks v košíku spouštějící 1 bonus). `free` = kolik
 * z této sady je zdarma. `total` = `paid` (alias) — počet ks na 1 sadu. Reálně placených v sadě
 * je `paid − free`. Konfigurace musí mít `free < paid`. (Paritní s `src/utils/bundlePricing.ts`.)
 */
function getNxPlusSubjectSlotCounts(bundle: ProductBundleRecord): { paid: number; free: number; total: number } | null {
  if (!bundleIsNxPlusOneSubject(bundle)) return null;
  const labels = bundle.bundleSubjectLabels || [];
  if (labels.length === 0) return null;
  const free = Math.max(0, Math.floor(Number(bundle.freeItemCount) || 0));
  const paid = Math.max(0, Math.floor(Number(bundle.paidItemCount) || 0));
  if (paid < 1 || free < 1) return null;
  if (free >= paid) return null;
  return { paid, free, total: paid };
}

const KNOWN_SUBJECTS = ['Fyzika', 'Chemie', 'Přírodopis', 'Matematika', 'Anglický jazyk', 'Český jazyk', 'Prvouka'];

function parseSubject(title: string): string | null {
  const low = title.toLowerCase();
  return KNOWN_SUBJECTS.find((subject) => low.includes(subject.toLowerCase())) ?? null;
}

function parseGrade(title: string): number | null {
  const rocnik = title.match(/(\d{1,2})\.\s*ro[cč]n[ií]k/i);
  if (rocnik) return Number.parseInt(rocnik[1], 10);
  const afterSubject = title.match(/(?:fyzika|chemie|p[rř][íi]rodopis|matematika|jazyk|prvouka)\s*(\d{1,2})/i);
  if (afterSubject) return Number.parseInt(afterSubject[1], 10);
  const standalone = title.match(/\b([1-9])\b(?!\.\s*d[íi]l)/i);
  if (standalone) return Number.parseInt(standalone[1], 10);
  return null;
}

function pGrade(product: any): number | null {
  if (product.rocnik) {
    const parsed = Number.parseInt(product.rocnik, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return parseGrade(String(product.name || product.title || ''));
}

const BUNDLE_SUBJECT_MATH_1 = 'Matematika 1. stupeň';
const BUNDLE_SUBJECT_MATH_2 = 'Matematika 2. stupeň';
const OTHER_SUBJECT_LABEL = 'Ostatní';

function productBundleSubjectLabel(p: any): string {
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

function productMatchesBundleSubjectLabels(p: any, labels: string[] | undefined | null): boolean {
  if (!labels || labels.length === 0) return false;
  const plabel = productBundleSubjectLabel(p);
  if (labels.includes(plabel)) return true;
  const hasSpecificMathStage = labels.includes(BUNDLE_SUBJECT_MATH_1) || labels.includes(BUNDLE_SUBJECT_MATH_2);
  if (!hasSpecificMathStage && labels.includes('Matematika')) {
    if (plabel === BUNDLE_SUBJECT_MATH_1 || plabel === BUNDLE_SUBJECT_MATH_2) return true;
    if (plabel === 'Matematika') return true;
  }
  return false;
}

type SubjectBundleQtyUnit = {
  productId: string;
  product: any;
  unitPriceHaler: number;
  isFree: boolean;
};

/**
 * Server-side kopie alokace pro `nx_plus_one_subject` balíčky.
 *
 * Bonus se aplikuje **per titul** (paritní s `src/utils/bundlePricing.ts`): pro každý titul
 * `freeForGroup = floor(qty / slots.total) * slots.free`, kde `slots.total = paidItemCount`
 * (= velikost sady; např. paid=10 znamená „za každých 10 ks téhož titulu 1 zdarma“). Mix titulů
 * (např. 5× PM6100 + 5× PM6200) tedy nepředstavuje uzavřenou sadu a žádný bonus nedostane.
 */
function allocateSubjectBundleQuantities(
  products: any[],
  bundle: ProductBundleRecord,
  quantities: Record<string, number>,
): SubjectBundleQtyUnit[] | null {
  const slots = getNxPlusSubjectSlotCounts(bundle);
  const labels = bundle.bundleSubjectLabels || [];
  if (!slots || labels.length === 0) return null;

  type Group = { productId: string; product: any; qty: number; unitPriceHaler: number };
  const groups: Group[] = [];
  for (const [rawId, rawQ] of Object.entries(quantities)) {
    const q = Math.max(0, Math.floor(Number(rawQ) || 0));
    if (q <= 0) continue;
    const product = products.find((p) => String(p.id) === String(rawId));
    if (!product || !getProductVariantId(product)) return null;
    if (!productMatchesBundleSubjectLabels(product, labels)) return null;
    groups.push({
      productId: String(product.id),
      product,
      qty: q,
      unitPriceHaler: getProductUnitPriceInHaler(product),
    });
  }

  if (groups.length === 0) return null;

  groups.sort((a, b) => String(a.productId).localeCompare(String(b.productId), 'cs'));

  const out: SubjectBundleQtyUnit[] = [];
  for (const g of groups) {
    const completeSets = Math.floor(g.qty / slots.total);
    const freeForGroup = completeSets * slots.free;
    for (let i = 0; i < g.qty; i++) {
      out.push({
        productId: g.productId,
        product: g.product,
        unitPriceHaler: g.unitPriceHaler,
        isFree: i < freeForGroup,
      });
    }
  }

  return out;
}

function subjectBundleSelectionPaidListSumHaler(
  products: any[],
  bundle: ProductBundleRecord,
  quantities: Record<string, number>,
): number {
  const alloc = allocateSubjectBundleQuantities(products, bundle, quantities);
  if (!alloc) return 0;
  return alloc.filter((u) => !u.isFree).reduce((s, u) => s + u.unitPriceHaler, 0);
}

function allocateBundleUnitPrices(
  products: any[],
  productIdsInOrder: string[],
  bundlePriceHaler: number,
): Array<{ productId: string; unitPrice: number }> {
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
    unitPrice: unitPrices[i] ?? 0,
  }));
}

/**
 * Vrátí `null` pokud OK, jinak text chyby.
 */
export function validateCheckoutPricing(
  items: CheckoutItemInput[],
  products: any[],
  bundles: ProductBundleRecord[],
): string | null {
  const productById = new Map<string, any>(products.map((p) => [String(p.id), p]));

  const byBundle = new Map<string, CheckoutItemInput[]>();
  const nonBundle: CheckoutItemInput[] = [];

  for (const it of items) {
    if (it.bundleId?.trim()) {
      const bid = it.bundleId.trim();
      const arr = byBundle.get(bid) ?? [];
      arr.push(it);
      byBundle.set(bid, arr);
    } else {
      nonBundle.push(it);
    }
  }

  for (const line of nonBundle) {
    const p = productById.get(String(line.productId));
    if (!p) {
      return `Neznámý produkt v košíku (${line.productId}).`;
    }
    /**
     * Digitální učebnice (rozšířený přístup / licence) se prodávají výhradně jako
     * Stripe předplatné nebo přes „Poptávka pro školu" – jednorázový nákup v košíku
     * by skončil platbou za měsíční cenu bez aktivace předplatného. Bug v upsellu
     * v košíku (objednávka VB-2026-0137) ukázal, že tato položka se může do košíku
     * dostat. Backend ji proto v platbě kartou / převodem odmítá vždy.
     */
    const ptype = String(p.type || '').toLowerCase();
    if (ptype === 'online' || ptype === 'license') {
      return 'Digitální přístup nelze objednat přes košík – použijte předplatné nebo poptávku pro školu.';
    }
    const expected = expectedUnitPriceForLine(p, line.variant);
    if (Math.abs(line.unitPrice - expected) > PRICE_TOLERANCE_HALER) {
      return 'Cena neodpovídá aktuálnímu ceníku. Obnovte stránku a zkuste znovu.';
    }
  }

  for (const [bundleId, group] of byBundle) {
    const bundle = bundles.find((b) => String(b.id) === String(bundleId));
    if (!bundle) {
      return 'Neplatný balíček v košíku. Obnovte stránku.';
    }

    if (bundleIsNxPlusOneSubject(bundle)) {
      const quantities: Record<string, number> = {};
      for (const line of group) {
        const pid = String(line.productId);
        quantities[pid] = (quantities[pid] ?? 0) + line.quantity;
      }
      const expectedPaid = subjectBundleSelectionPaidListSumHaler(products, bundle, quantities);
      if (expectedPaid <= 0) {
        return 'Neplatná sestava balíčku. Obnovte stránku.';
      }
      const actualPaid = group.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
      if (Math.abs(expectedPaid - actualPaid) > BUNDLE_TOTAL_TOLERANCE_HALER) {
        return 'Cena balíčku neodpovídá ceníku. Obnovte stránku a zkuste znovu.';
      }
      continue;
    }

    const ids = bundle.productIds || [];
    if (ids.length === 0) {
      return 'Neplatná definice balíčku.';
    }
    const allocated = allocateBundleUnitPrices(products, ids, bundle.bundlePriceHaler);
    if (allocated.length !== ids.length) {
      return 'Košík neodpovídá aktuálnímu balíčku. Obnovte stránku.';
    }

    const expectedByProduct = new Map(allocated.map((a) => [a.productId, a.unitPrice]));

    const k0 = group[0]?.quantity;
    if (!Number.isInteger(k0) || k0 < 1) {
      return 'Neplatné množství v balíčku.';
    }
    if (!group.every((l) => l.quantity === k0)) {
      return 'Balíček má nekonzistentní množství. Obnovte stránku.';
    }

    const groupTotal = group.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const expectedBundleSum = k0 * bundle.bundlePriceHaler;
    if (Math.abs(groupTotal - expectedBundleSum) > BUNDLE_TOTAL_TOLERANCE_HALER) {
      return 'Cena balíčku neodpovídá ceníku. Obnovte stránku a zkuste znovu.';
    }

    for (const line of group) {
      const exp = expectedByProduct.get(String(line.productId));
      if (exp === undefined) {
        return 'Neplatné položky v balíčku. Obnovte stránku.';
      }
      if (Math.abs(line.unitPrice - exp) > PRICE_TOLERANCE_HALER) {
        return 'Rozdělení ceny balíčku neodpovídá ceníku. Obnovte stránku.';
      }
    }
  }

  return null;
}
