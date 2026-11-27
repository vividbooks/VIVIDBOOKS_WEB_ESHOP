import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { publicAnonKey } from '../utils/supabase/info';
import { edgeFunctionBase } from '../utils/edgeFunctionBase';
import { promotionCardBadgeTextsForProduct, type ProductBundleRecord } from '../utils/bundlePricing';
import { applyAllDigitalBundleStripe } from '../utils/digitalSubscription';
import { rewriteShoptetOrigImageUrl } from '../utils/supabaseImageThumbnail';

interface ProductsContextType {
  products: any[];
  isLoading: boolean;
  /** Chyba načtení katalogu (na rozdíl od skutečně prázdného katalogu). */
  loadError: boolean;
  fetchProducts: () => Promise<void>;
  /** Aktivní akční balíčky (jako z /product-bundles) — bobánky na kartách. */
  productBundles: ProductBundleRecord[];
  getProductPromotionCardBadges: (product: any) => string[];
}

const ProductsContext = createContext<ProductsContextType>({
  products: [],
  isLoading: false,
  loadError: false,
  fetchProducts: async () => {},
  productBundles: [],
  getProductPromotionCardBadges: () => [],
});

/**
 * Produkty jen v paměti — ukládání celého katalogu do localStorage (~MB) vyčerpalo kvótu
 * a blokovalo zápis Supabase session / OAuth (QuotaExceededError).
 */
export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<any[]>([]);
  const [productBundles, setProductBundles] = useState<ProductBundleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const apiBase = edgeFunctionBase();
      const productsUrl = `${apiBase}/products?v=${Date.now()}`;
      const bundlesUrl = `${apiBase}/product-bundles?v=${Date.now()}`;
      // Balíčky nesmějí blokovat katalog, když jejich vlastní endpoint neodpovídá.
      const pRes = await fetch(productsUrl, {
        headers: { Authorization: 'Bearer ' + publicAnonKey },
        signal: controller.signal,
      });
      if (!pRes.ok) throw new Error(`Server error: ${pRes.status}`);
      const data = await pRes.json();
      if (!Array.isArray(data.products)) throw new Error('Invalid products response');
      setProducts(
        data.products.map((p: any) => {
          const next = applyAllDigitalBundleStripe(p);
          if (typeof next?.image === 'string' && next.image) {
            next.image = rewriteShoptetOrigImageUrl(next.image);
          }
          return next;
        }),
      );
      // Akční balíčky nejsou součástí objednatelného katalogu.
      void fetch(bundlesUrl, { headers: { Authorization: 'Bearer ' + publicAnonKey }, signal: controller.signal })
        .then(async (res) => res.ok ? res.json() : { bundles: [] })
        .then((json) => setProductBundles(Array.isArray(json.bundles) ? json.bundles : []))
        .catch(() => setProductBundles([]));
    } catch (err) {
      setLoadError(true);
      console.error('ProductsContext fetch failed:', err);
    } finally {
      window.clearTimeout(timeout);
      setIsLoading(false);
    }
  }, []);

  const getProductPromotionCardBadges = useCallback(
    (product: any) => promotionCardBadgeTextsForProduct(product, productBundles),
    [productBundles],
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <ProductsContext.Provider
      value={{ products, isLoading, loadError, fetchProducts, productBundles, getProductPromotionCardBadges }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export const useProducts = () => useContext(ProductsContext);
