import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { publicAnonKey } from '../utils/supabase/info';
import { edgeFunctionBase } from '../utils/edgeFunctionBase';
import { promotionCardBadgeTextsForProduct, type ProductBundleRecord } from '../utils/bundlePricing';
import { applyAllDigitalBundleStripe } from '../utils/digitalSubscription';

interface ProductsContextType {
  products: any[];
  isLoading: boolean;
  fetchProducts: () => Promise<void>;
  /** Aktivní akční balíčky (jako z /product-bundles) — bobánky na kartách. */
  productBundles: ProductBundleRecord[];
  getProductPromotionCardBadges: (product: any) => string[];
}

const ProductsContext = createContext<ProductsContextType>({
  products: [],
  isLoading: false,
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

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiBase = edgeFunctionBase();
      const productsUrl = `${apiBase}/products?v=${Date.now()}`;
      const bundlesUrl = `${apiBase}/product-bundles?v=${Date.now()}`;
      const [pRes, bRes] = await Promise.all([
        fetch(productsUrl, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(bundlesUrl, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
      ]);
      if (!pRes.ok) throw new Error(`Server error: ${pRes.status}`);
      const data = await pRes.json();
      if (data.products) {
        setProducts(data.products.map((p: any) => applyAllDigitalBundleStripe(p)));
      }
      if (bRes.ok) {
        const bJson = await bRes.json();
        setProductBundles(Array.isArray(bJson.bundles) ? bJson.bundles : []);
      } else {
        setProductBundles([]);
      }
    } catch (err) {
      console.error('ProductsContext fetch failed:', err);
    } finally {
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
      value={{ products, isLoading, fetchProducts, productBundles, getProductPromotionCardBadges }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export const useProducts = () => useContext(ProductsContext);
