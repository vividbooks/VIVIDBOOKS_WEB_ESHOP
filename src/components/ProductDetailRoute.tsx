import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ProductDetailPage } from './ProductDetailPage';
import { useProducts } from '../contexts/ProductsContext';
import { useCart } from '../contexts/CartContext';
import { productDetailPath, productSlug } from '../utils/slugify';
import { startSchoolOrder } from '../utils/startSchoolOrder';

export function ProductDetailRoute() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { products, isLoading } = useProducts();
  const { addItem, items } = useCart();

  const slugOrId = id ? decodeURIComponent(id) : '';
  const product = useMemo(() => {
    if (!slugOrId) return null;
    return (
      products.find((p) => productSlug(p, products) === slugOrId) ||
      products.find((p) => String(p.id) === slugOrId) ||
      null
    );
  }, [products, slugOrId]);

  useEffect(() => {
    if (!product || !slugOrId) return;
    const canonical = productDetailPath(product, products);
    const current = `/produkt/${encodeURIComponent(slugOrId)}`;
    if (canonical !== current) {
      navigate(canonical, { replace: true });
    }
  }, [navigate, product, products, slugOrId]);

  if (isLoading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#001161] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="font-['Cooper_Light',serif] text-[#001161] text-[32px] mb-4">
            {'Produkt nenalezen'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="font-['Fenomen_Sans',sans-serif] text-[#FF6B1A] text-[16px] underline cursor-pointer"
          >
            {'Zp\u011bt do katalogu'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProductDetailPage
      product={product}
      products={products}
      onBack={() => navigate(-1)}
      onOrder={(ctx, orderProduct) => startSchoolOrder(navigate, { addItem, items }, orderProduct ?? product, ctx)}
      onProductSelect={(p) => navigate(productDetailPath(p, products))}
    />
  );
}