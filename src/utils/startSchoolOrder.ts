import type { NavigateFunction } from 'react-router';
import type { SchoolOrderMerchContext } from '../components/ProductDetailPage';
import { getProductUnitPriceInHaler } from '../components/cartUpsellUtils';
import { isMerchWallArtBoardsProduct } from './merchProducts';
import { matchSchoolSubjectKeysFromCategory, mergeSchoolOrderDraft } from './schoolOrderDraft';

type CartLine = { productId: string; variantId: string };

type StartSchoolOrderCart = {
  addItem: (item: {
    productId: string;
    productName: string;
    variantId: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    imageUrl?: string;
    itemGroup?: string;
    posterMerch?: true;
  }) => void;
  items: CartLine[];
};

export function startSchoolOrder(
  navigate: NavigateFunction,
  cart: StartSchoolOrderCart,
  product?: any,
  ctx?: SchoolOrderMerchContext,
) {
  if (!product) {
    navigate(cart.items.length > 0 ? '/objednat?step=2' : '/objednat');
    return;
  }

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

  const merchVid = ctx?.shopifyVariantId?.trim();
  const merchSku = ctx?.shoptetSku?.trim();
  const fallbackVid = product.shopifyVariantId?.trim();
  const lineVariantId = merchVid || merchSku || fallbackVid || '';

  if ((product.type === 'workbook' || product.type === 'merch') && lineVariantId) {
    const pid = String(product.id);
    const vid = lineVariantId;
    const already = cart.items.some((item) => item.productId === pid && item.variantId === vid);
    if (!already) {
      const posterMerch =
        product.type === 'merch'
        && (product.availabilityDisplay === 'on_order' || isMerchWallArtBoardsProduct(product));
      cart.addItem({
        productId: pid,
        productName: ctx?.productDisplayName ?? (product.name || 'Produkt'),
        variantId: vid,
        variantName: ctx?.variantLabel,
        quantity: 1,
        unitPrice: ctx ? ctx.unitPriceHaler : getProductUnitPriceInHaler(product),
        imageUrl: product.image || undefined,
        itemGroup: product.category || product.merchCategory || product.type || undefined,
        ...(posterMerch ? { posterMerch: true as const } : {}),
      });
    }
  }

  navigate(`/objednat?step=2${predmetQ}`, { state });
}
