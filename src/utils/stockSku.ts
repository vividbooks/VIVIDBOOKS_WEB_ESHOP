/**
 * Shoptet při importu bez reálného kódu varianty často uloží CODE = "new".
 * To není skladové SKU (ZK1000, TO61A2, …) a nesmí se posílat do Base.com / stock API.
 */
const PLACEHOLDER_STOCK_SKUS = new Set(['', 'new', 'null', 'undefined', '-', 'none', 'n/a']);

export function isPlaceholderStockSku(value?: string | null) {
  return PLACEHOLDER_STOCK_SKUS.has(String(value || '').trim().toLowerCase());
}

export function resolveProductStockSku(
  product: { shoptetId?: string | null; basecomSku?: string | null },
  variant?: { shoptetId?: string | null } | null,
): string | null {
  const variantSku = String(variant?.shoptetId || '').trim();
  if (variantSku && !isPlaceholderStockSku(variantSku)) return variantSku;
  const productSku = String(product.shoptetId || product.basecomSku || '').trim();
  return productSku && !isPlaceholderStockSku(productSku) ? productSku : null;
}

type MerchVariantSku = { shoptetId?: string | null };

export function sanitizeMerchVariantSkus<
  T extends {
    type?: string | null;
    shoptetId?: string | null;
    basecomSku?: string | null;
    merchVariants?: MerchVariantSku[] | null;
  },
>(product: T): T {
  if (product.type !== 'merch' || !Array.isArray(product.merchVariants) || product.merchVariants.length === 0) {
    return product;
  }

  const fallback = resolveProductStockSku(product);
  if (!fallback) return product;

  let changed = false;
  const merchVariants = product.merchVariants.map((variant) => {
    if (!isPlaceholderStockSku(variant?.shoptetId)) return variant;
    changed = true;
    return { ...variant, shoptetId: fallback };
  });

  return changed ? { ...product, merchVariants } : product;
}
