import type { CartItem } from '../contexts/CartContext';
import {
  getProductImage,
  getProductUnitPriceInHaler,
  getProductVariantId,
} from '../components/cartUpsellUtils';

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
};

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

/** Součet katalogových cen produktů v balíčku (haléře). */
export function bundleCatalogListSumHaler(bundle: ProductBundleRecord, catalog: any[]): number {
  return (bundle.productIds || []).reduce((sum, rawId) => {
    const p = catalog.find((x) => String(x.id) === String(rawId));
    return sum + (p ? getProductUnitPriceInHaler(p) : 0);
  }, 0);
}

export function buildBundleCartLines(
  products: any[],
  bundle: ProductBundleRecord,
  bundleInstanceId: string,
): CartItem[] {
  const rows = allocateBundleUnitPrices(products, bundle.productIds || [], bundle.bundlePriceHaler);
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
