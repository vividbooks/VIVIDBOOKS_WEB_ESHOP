import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface ProductsContextType {
  products: any[];
  isLoading: boolean;
  fetchProducts: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType>({
  products: [],
  isLoading: false,
  fetchProducts: async () => {},
});

/**
 * Produkty jen v paměti — ukládání celého katalogu do localStorage (~MB) vyčerpalo kvótu
 * a blokovalo zápis Supabase session / OAuth (QuotaExceededError).
 */
export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/products?v=${Date.now()}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error('ProductsContext fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <ProductsContext.Provider value={{ products, isLoading, fetchProducts }}>
      {children}
    </ProductsContext.Provider>
  );
}

export const useProducts = () => useContext(ProductsContext);
