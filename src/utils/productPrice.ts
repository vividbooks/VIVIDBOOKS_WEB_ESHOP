/**
 * Jednotný zdroj ceny produktu: textové pole `price` z administrace.
 * `priceAmount` je odvozené / záložní (legacy, feedy, importy).
 */

export function parsePriceTextToKc(raw: unknown): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (/zdarma/i.test(text)) return 0;

  const compact = text.replace(/\s/g, '');
  if (/^[^\d]*$/.test(compact)) return null;

  const normalized = compact
    .replace(/Kč/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function parseMerchVariantPriceToKc(variant: any): number | null {
  const fromText = parsePriceTextToKc(variant?.price);
  if (fromText !== null) return fromText;
  if (typeof variant?.priceAmount === 'number' && Number.isFinite(variant.priceAmount)) {
    return Math.max(0, variant.priceAmount);
  }
  return null;
}

export function getMerchVariantUnitPriceInHaler(variant: any): number {
  const kc = parseMerchVariantPriceToKc(variant);
  return kc !== null ? Math.round(kc * 100) : 0;
}

/** Cena v haléřích — primárně z `product.price`, jinak `priceAmount` nebo varianty merch. */
export function getProductUnitPriceInHaler(product: any): number {
  const fromPrice = parsePriceTextToKc(product?.price);
  if (fromPrice !== null) return Math.round(fromPrice * 100);

  const merch = product?.merchVariants;
  if (Array.isArray(merch) && merch.length > 0) {
    for (const v of merch) {
      const variantKc = parseMerchVariantPriceToKc(v);
      if (variantKc !== null) return Math.round(variantKc * 100);
    }
  }

  if (typeof product?.priceAmount === 'number' && Number.isFinite(product.priceAmount)) {
    return Math.max(0, Math.round(product.priceAmount * 100));
  }

  return 0;
}

/** Při zápisu produktu sjednotí `priceAmount` s parsovanou hodnotou z `price`. */
export function syncProductPriceAmount<T extends Record<string, unknown>>(product: T): T {
  const fromPrice = parsePriceTextToKc(product.price);
  if (fromPrice === null) return product;
  return { ...product, priceAmount: fromPrice };
}
