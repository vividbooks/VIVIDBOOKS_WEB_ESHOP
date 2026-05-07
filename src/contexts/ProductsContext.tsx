import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { promotionCardBadgeTextsForProduct, type ProductBundleRecord } from '../utils/bundlePricing';

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
      const productsUrl = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/products?v=${Date.now()}`;
      const bundlesUrl = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/product-bundles?v=${Date.now()}`;
      const [pRes, bRes] = await Promise.all([
        fetch(productsUrl, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(bundlesUrl, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
      ]);
      if (!pRes.ok) throw new Error(`Server error: ${pRes.status}`);
      const data = await pRes.json();
      if (data.products) {
        setProducts(data.products);
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
