/**
 * Merch produkt se více Shoptet variantami (velikosti) v jednom záznamu katalogu.
 * Uloženo např. po importu productsComplete.xml (sloučení podle SHOPITEM).
 */
export type MerchVariantOption = {
  /** Stabilní id řádku varianty, např. shoptet-v-934 */
  id: string;
  /** Popisek pro UI (např. Velikost z parametru Shoptetu) */
  label: string;
  price: string;
  priceAmount: number;
  /** SKU / kód varianty ve Shoptetu — sklad */
  shoptetId: string;
  shopifyVariantId?: string;
  metadata: {
    shoptetVariantId: string;
    shoptetVariantCode: string;
    shoptetProductId: string;
    source?: string;
  };
};
