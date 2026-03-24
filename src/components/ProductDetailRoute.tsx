import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { ProductDetailPage } from './ProductDetailPage';
import { useProducts } from '../contexts/ProductsContext';
import { useCart } from '../contexts/CartContext';
import { getProductUnitPriceInHaler } from './cartUpsellUtils';
import { mergeSchoolOrderDraft, matchSchoolSubjectKeysFromCategory } from '../utils/schoolOrderDraft';

export function ProductDetailRoute() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { products, isLoading } = useProducts();
  const { addItem, items } = useCart();

  const productId = id ? decodeURIComponent(id) : '';
  const product   = products.find(p => p.id === productId);

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
      onOrder={() => {
        const predmetQ = product.category ? `&predmet=${encodeURIComponent(product.category)}` : '';
        const state = { category: product.category };

        if (product.type === 'online' || product.type === 'license') {
          mergeSchoolOrderDraft({
            selSubjects: product.category ? [product.category] : [],
            selTypes: ['digital'],
            digitalSubjects: product.category ? [product.category] : [],
          });
          navigate(`/objednat?step=2${predmetQ}`, { state });
          return;
        }

        const subjKeys = matchSchoolSubjectKeysFromCategory(product.category);
        mergeSchoolOrderDraft({
          selTypes: ['workbook'],
          ...(subjKeys.length > 0 ? { selSubjects: subjKeys } : {}),
        });

        if (product.type === 'workbook' && product.shopifyVariantId) {
          const pid = String(product.id);
          const vid = product.shopifyVariantId;
          const already = items.some((i) => i.productId === pid && i.variantId === vid);
          if (!already) {
            addItem({
              productId: pid,
              productName: product.name || 'Produkt',
              variantId: vid,
              quantity: 1,
              unitPrice: getProductUnitPriceInHaler(product),
              imageUrl: product.image || undefined,
            });
          }
        }

        navigate(`/objednat?step=2${predmetQ}`, { state });
      }}
      onProductSelect={(p) => navigate(`/produkt/${encodeURIComponent(p.id)}`)}
    />
  );
}