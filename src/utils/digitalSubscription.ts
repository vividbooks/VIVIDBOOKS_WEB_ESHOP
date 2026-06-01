/** CMS položka „Všechny digitální učebnice pro 2. stupeň“ — Stripe předplatné celého obsahu. */
export const ALL_DIGITAL_BUNDLE_PRODUCT_ID = '68fcbcb4c96236df1c3a1b9f';

export const ALL_DIGITAL_BUNDLE_STRIPE_MONTHLY_URL = 'https://api.vividbooks.com/predplatne/mesicni';
export const ALL_DIGITAL_BUNDLE_STRIPE_YEARLY_URL = 'https://api.vividbooks.com/predplatne/rocni';

export const ALL_DIGITAL_BUNDLE_PRICE_MONTHLY = '490,-/měsíc';
export const ALL_DIGITAL_BUNDLE_PRICE_YEARLY = '4.900,-/rok';

/** Digitální produkty s rodičovským Stripe předplatným (`online` + bundle licence). */
export function isDigitalStripeSubscriptionProduct(product: any): boolean {
  if (!product) return false;
  if (String(product.id) === ALL_DIGITAL_BUNDLE_PRODUCT_ID) return true;
  return String(product.type || '').toLowerCase() === 'online';
}

export function applyAllDigitalBundleStripe<T extends Record<string, unknown>>(product: T): T {
  if (!isDigitalStripeSubscriptionProduct(product)) return product;

  const next: T = {
    ...product,
    stripeMonthlyUrl: ALL_DIGITAL_BUNDLE_STRIPE_MONTHLY_URL,
    stripeYearlyUrl: ALL_DIGITAL_BUNDLE_STRIPE_YEARLY_URL,
  };

  if (String(product.id) === ALL_DIGITAL_BUNDLE_PRODUCT_ID) {
    return {
      ...next,
      priceMonthly: (product as any).priceMonthly || ALL_DIGITAL_BUNDLE_PRICE_MONTHLY,
      priceYearly: (product as any).priceYearly || ALL_DIGITAL_BUNDLE_PRICE_YEARLY,
    };
  }

  return next;
}

export function findAllDigitalBundleProduct(products: any[]): any | null {
  const fromCatalog = products.find((p) => String(p.id) === ALL_DIGITAL_BUNDLE_PRODUCT_ID);
  if (fromCatalog) return applyAllDigitalBundleStripe(fromCatalog);

  return applyAllDigitalBundleStripe({
    id: ALL_DIGITAL_BUNDLE_PRODUCT_ID,
    name: 'Všechny digitální učebnice pro 2. stupeň, rozšířený přístup',
    category: 'Ostatní',
    type: 'license',
    priceMonthly: ALL_DIGITAL_BUNDLE_PRICE_MONTHLY,
    priceYearly: ALL_DIGITAL_BUNDLE_PRICE_YEARLY,
  });
}

export function getDigitalSubjectShortLabel(product: any): string {
  const cat = String(product?.category || '').trim();
  if (!cat) return 'Tento předmět';
  return cat.replace(/\s+\d+\.\s*stupeň.*$/i, '').trim() || cat;
}
