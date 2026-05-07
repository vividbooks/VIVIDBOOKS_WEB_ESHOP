/**
 * Parsování Shoptet exportu productsComplete.xml → produkty typu `merch`.
 * Jedna položka Shoptetu (SHOPITEM) = jeden záznam v katalogu; varianty v `merchVariants`.
 *
 * Ve výchozím režimu platí filtr kořenových kategorií (`SHOPTET_IMPORT_ALLOWED_ROOTS`).
 * Volitelně: `includeAllCategories` (celý export) nebo `extraAllowedRoots`.
 */

import type { MerchVariantOption } from '../types/merchVariants';
import {
  SHOPTET_IMPORT_ALLOWED_ROOTS,
  mergeShoptetAllowedRoots,
} from '../config/shoptetImportAllowedRoots';

export type ShoptetProductsParseOptions = {
  /** Přidá další názvy segmentů k výchozímu seznamu (stejná logika jako v administraci). */
  extraAllowedRoots?: readonly string[];
  /** Bez whitelistu — každý SHOPITEM s kategorií; kořen bere po přeskočení „E-shop“ apod. */
  includeAllCategories?: boolean;
};

export { SHOPTET_IMPORT_ALLOWED_ROOTS, mergeShoptetAllowedRoots, parseShoptetExtraRootsEnv } from '../config/shoptetImportAllowedRoots';

export type ShoptetMerchMergedProduct = {
  id: string;
  name: string;
  price: string;
  priceAmount: number;
  /** Když se liší min/max cena variant */
  priceAmountMax?: number;
  category: string;
  type: 'merch';
  merchCategory: string;
  merchSubcategory?: string;
  image?: string;
  /** Více URL fotek (jen pokud jich je alespoň 2). */
  images?: string[];
  description?: string;
  buttonType: 'cart';
  /** Primární SKU (první varianta) — kompatibilita se skladem */
  shoptetId: string;
  merchVariants: MerchVariantOption[];
  metadata: {
    shoptetProductId: string;
    source: 'shoptet-import';
    mergedFromVariants: true;
    variantCount: number;
  };
  availabilityDisplay?: 'on_order';
};

type CategoryGate = { mode: 'filter'; roots: readonly string[] } | { mode: 'all' };

function decodeXmlText(s: string): string {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripHtml(html: string): string {
  let t = decodeXmlText(html);
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/p>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t.slice(0, 8000);
}

function firstMatch(re: RegExp, text: string, group = 1): string {
  const m = re.exec(text);
  return m ? m[group] : '';
}

function allMatches(re: RegExp, text: string, group = 1): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  while ((m = r.exec(text))) out.push(m[group]);
  return out;
}

function parseCdata(tagName: string, block: string): string {
  const re = new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, 'i');
  const m = re.exec(block);
  if (m) return m[1];
  const re2 = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const m2 = re2.exec(block);
  return m2 ? m2[1] : '';
}

/** Bez diakritiky + lower — Shoptet někdy liší znaky v cestě kategorie. */
function categorySegmentKey(s: string): string {
  return decodeXmlText(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * Najde v cestě „A > B > C“ segment, který odpovídá povolené kořenové kategorii
 * (ne jen prvnímu segmentu — např. „E-shop > Žákovské knížky“).
 */
function matchAllowedCategoryInPath(pathRaw: string): { canonical: string; subTail: string[] } | null {
  const segments = decodeXmlText(pathRaw)
    .split(/\s*>\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  const keys = new Map<string, string>();
  for (const allowed of ALLOWED_ROOTS) {
    keys.set(categorySegmentKey(allowed), allowed);
  }
  for (let i = 0; i < segments.length; i++) {
    const canonical = keys.get(categorySegmentKey(segments[i]));
    if (canonical) {
      return { canonical, subTail: segments.slice(i + 1) };
    }
  }
  return null;
}

function itemAllowed(categoriesBlock: string): { ok: boolean; merchCategory: string; merchSubcategory: string } {
  const tryPath = (pathInner: string): { merchCategory: string; merchSubcategory: string } | null => {
    const hit = matchAllowedCategoryInPath(pathInner);
    if (!hit) return null;
    const sub = hit.subTail.length ? hit.subTail.join(' › ') : '';
    return { merchCategory: hit.canonical, merchSubcategory: sub };
  };

  const def = firstMatch(/<DEFAULT_CATEGORY[^>]*>([\s\S]*?)<\/DEFAULT_CATEGORY>/i, categoriesBlock, 1);
  const fromDef = tryPath(def);
  if (fromDef) return { ok: true, ...fromDef };

  const cats = allMatches(/<CATEGORY[^>]*>([\s\S]*?)<\/CATEGORY>/gi, categoriesBlock, 1);
  for (const c of cats) {
    const fromCat = tryPath(c);
    if (fromCat) return { ok: true, ...fromCat };
  }
  return { ok: false, merchCategory: '', merchSubcategory: '' };
}

function parseVariantParams(variantBlock: string): Record<string, string> {
  const names = allMatches(/<PARAMETER>\s*<NAME>([\s\S]*?)<\/NAME>/gi, variantBlock, 1);
  const values = allMatches(/<VALUE>([\s\S]*?)<\/VALUE>/gi, variantBlock, 1);
  const map: Record<string, string> = {};
  for (let i = 0; i < names.length && i < values.length; i++) {
    map[decodeXmlText(names[i]).trim()] = decodeXmlText(values[i]).trim();
  }
  return map;
}

function formatMergedPriceLabel(amounts: number[]): { price: string; min: number; max: number } {
  const sorted = [...new Set(amounts)].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) {
    return { price: `${min} Kč`, min, max };
  }
  return {
    price: `od ${min.toLocaleString('cs-CZ')} Kč`,
    min,
    max,
  };
}

/** Shoptet často dává URL v CDATA, protokol-relative //…, nebo jen odkaz IMAGE_REF na pořadí v <IMAGES>. */
function normalizeShoptetImageUrl(raw: string): string {
  const t = decodeXmlText(raw).trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  return '';
}

function urlsFromImageTagBody(inner: string): string[] {
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(inner);
  const payload = (cdata ? cdata[1] : inner).trim();
  if (!payload) return [];
  const u = normalizeShoptetImageUrl(payload);
  return u ? [u] : [];
}

function parseImageTagsInFragment(fragment: string): string[] {
  const urls: string[] = [];
  const imgRe = /<IMAGE\b[^>]*>([\s\S]*?)<\/IMAGE>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(fragment))) {
    urls.push(...urlsFromImageTagBody(im[1]));
  }
  return urls;
}

function resolveShoptetImageRef(refRaw: string, gallery: string[]): string {
  const ref = decodeXmlText(refRaw).trim();
  if (!ref) return '';
  const asUrl = normalizeShoptetImageUrl(ref);
  if (asUrl) return asUrl;
  const n = parseInt(ref, 10);
  if (!Number.isFinite(n) || gallery.length === 0) return '';
  if (n >= 1 && n <= gallery.length) return gallery[n - 1];
  if (n >= 0 && n < gallery.length) return gallery[n];
  return '';
}

/** Všechny nalezené URL (galerie + rozřešené IMAGE_REF u variant), bez duplicit. */
function extractShoptetShopItemImageUrls(block: string): string[] {
  const imagesSection = firstMatch(/<IMAGES>([\s\S]*?)<\/IMAGES>/i, block, 1);
  const gallery = parseImageTagsInFragment(imagesSection || '');
  const loose = imagesSection ? [] : parseImageTagsInFragment(block);
  const baseGallery = gallery.length ? gallery : loose;

  const refs = allMatches(/<IMAGE_REF>([\s\S]*?)<\/IMAGE_REF>/gi, block, 1);
  const fromRefs: string[] = [];
  for (const r of refs) {
    const u = resolveShoptetImageRef(r, baseGallery);
    if (u) fromRefs.push(u);
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const u of [...baseGallery, ...fromRefs]) {
    if (u && !seen.has(u)) {
      seen.add(u);
      ordered.push(u);
    }
  }
  return ordered;
}

/** Část SHOPITEM před prvním VARIANT — u produktů bez variant bývá cena a kód zde. */
function shopItemHeadBeforeVariants(block: string): string {
  const idx = block.search(/<VARIANT\b/i);
  return idx < 0 ? block : block.slice(0, idx);
}

/**
 * Jednoduchý produkt bez uzlů VARIANT: kód + PRICE_VAT na úrovni položky.
 */
function parseItemLevelCodeAndPrice(block: string, shoptetProductId: string): {
  code: string;
  priceAmount: number;
} | null {
  const head = shopItemHeadBeforeVariants(block);
  let code = decodeXmlText(firstMatch(/<CODE>([\s\S]*?)<\/CODE>/i, head, 1)).trim();
  if (!code) code = decodeXmlText(firstMatch(/<EAN>([\s\S]*?)<\/EAN>/i, head, 1)).trim();
  if (!code) code = decodeXmlText(firstMatch(/<PRODUCTNO>([\s\S]*?)<\/PRODUCTNO>/i, head, 1)).trim();
  const priceVatRaw = firstMatch(/<PRICE_VAT>([\s\S]*?)<\/PRICE_VAT>/i, head, 1).trim();
  if (!priceVatRaw) return null;
  const priceAmount = Number(priceVatRaw.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(priceAmount)) return null;
  const finalCode = code || `shoptet-item-${shoptetProductId}`;
  return { code: finalCode, priceAmount };
}

function parseShopItem(block: string, shoptetProductId: string): ShoptetMerchMergedProduct | null {
  const name = decodeXmlText(firstMatch(/<NAME>([\s\S]*?)<\/NAME>/i, block, 1)).trim();
  const catSection = firstMatch(/<CATEGORIES>([\s\S]*?)<\/CATEGORIES>/i, block, 1) || '';
  const { ok, merchCategory, merchSubcategory: merchSubFromPath } = itemAllowed(catSection);
  if (!ok) return null;

  const merchSubcategory = merchSubFromPath.trim();

  const imageUrls = extractShoptetShopItemImageUrls(block);
  const image = imageUrls[0] || '';

  let description = parseCdata('DESCRIPTION', block);
  if (!description.trim()) description = parseCdata('SHORT_DESCRIPTION', block);
  description = stripHtml(description);

  const variantRe = /<VARIANT\s+id="(\d+)">([\s\S]*?)<\/VARIANT>/gi;
  const variantRows: MerchVariantOption[] = [];
  let vm: RegExpExecArray | null;
  while ((vm = variantRe.exec(block))) {
    const vid = vm[1];
    const vb = vm[2];
    const code = decodeXmlText(firstMatch(/<CODE>([\s\S]*?)<\/CODE>/i, vb, 1)).trim();
    const priceVatRaw = firstMatch(/<PRICE_VAT>([\s\S]*?)<\/PRICE_VAT>/i, vb, 1).trim();
    const priceAmount = Number(priceVatRaw.replace(/\s/g, '').replace(',', '.'));
    if (!code || !Number.isFinite(priceAmount)) continue;

    const params = parseVariantParams(vb);
    const sizeLabel = params['Velikost'] || params['velikost'] || '';
    const label = sizeLabel || 'Varianta';

    variantRows.push({
      id: `shoptet-v-${vid}`,
      label,
      price: `${Math.round(priceAmount)} Kč`,
      priceAmount: Math.round(priceAmount),
      shoptetId: code,
      metadata: {
        shoptetProductId,
        shoptetVariantId: vid,
        shoptetVariantCode: code,
      },
    });
  }

  if (variantRows.length === 0) {
    const fb = parseItemLevelCodeAndPrice(block, shoptetProductId);
    if (fb) {
      variantRows.push({
        id: `shoptet-v-${shoptetProductId}`,
        label: 'Základní',
        price: `${Math.round(fb.priceAmount)} Kč`,
        priceAmount: Math.round(fb.priceAmount),
        shoptetId: fb.code,
        metadata: {
          shoptetProductId,
          shoptetVariantId: shoptetProductId,
          shoptetVariantCode: fb.code,
        },
      });
    }
  }

  if (variantRows.length === 0) return null;

  variantRows.sort((a, b) => a.priceAmount - b.priceAmount);
  const amounts = variantRows.map((v) => v.priceAmount);
  const { price, min, max } = formatMergedPriceLabel(amounts);

  return {
    id: `shoptet-p-${shoptetProductId}`,
    name,
    price,
    priceAmount: min,
    priceAmountMax: min !== max ? max : undefined,
    category: merchCategory,
    type: 'merch',
    merchCategory,
    merchSubcategory: merchSubcategory || undefined,
    image: image || undefined,
    ...(imageUrls.length > 1 ? { images: imageUrls } : {}),
    ...(merchCategory === 'Nástěnné obrazy a tabule' ? { availabilityDisplay: 'on_order' as const } : {}),
    description: description || undefined,
    buttonType: 'cart',
    shoptetId: variantRows[0].shoptetId,
    merchVariants: variantRows,
    metadata: {
      shoptetProductId,
      source: 'shoptet-import',
      mergedFromVariants: true,
      variantCount: variantRows.length,
    },
  };
}

/** Vyparsuje celý XML řetězec exportu productsComplete — jeden záznam na SHOPITEM. */
export function parseShoptetProductsCompleteXml(xml: string): ShoptetMerchMergedProduct[] {
  const out: ShoptetMerchMergedProduct[] = [];
  const itemRe = /<SHOPITEM\s+id="(\d+)">([\s\S]*?)<\/SHOPITEM>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const merged = parseShopItem(m[2], m[1]);
    if (merged) out.push(merged);
  }
  return out;
}

export function summarizeShoptetImportByCategory(products: ShoptetMerchMergedProduct[]): Record<string, number> {
  const byCat: Record<string, number> = {};
  for (const p of products) {
    const k = p.merchCategory || '?';
    byCat[k] = (byCat[k] ?? 0) + 1;
  }
  return byCat;
}
