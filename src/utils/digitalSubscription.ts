/** CMS položka „Všechny digitální učebnice pro 2. stupeň“ — Stripe předplatné celého obsahu. */
export const ALL_DIGITAL_BUNDLE_PRODUCT_ID = '68fcbcb4c96236df1c3a1b9f';

export const ALL_DIGITAL_BUNDLE_STRIPE_MONTHLY_URL = 'https://api.vividbooks.com/predplatne/mesicni';
export const ALL_DIGITAL_BUNDLE_STRIPE_YEARLY_URL = 'https://api.vividbooks.com/predplatne/rocni';

export const ALL_DIGITAL_BUNDLE_PRICE_MONTHLY = '490,-/měsíc';
export const ALL_DIGITAL_BUNDLE_PRICE_YEARLY = '4.900,-/rok';

/**
 * Jen skutečný balíček „Celé Vividbooks“ má Stripe odkaz vynucený na tuhle konstantu.
 * Dřív se testovalo i `type === 'online'`, což zasáhlo i samostatné předměty (matematika,
 * fyzika, ...) — jejich vlastní stripeMonthlyUrl/stripeYearlyUrl se tak při každém načtení
 * i uložení přepsaly na balíčkovou cenu 4 900 Kč/rok, i když produkt ukazoval jinou cenu.
 */
export function isDigitalStripeSubscriptionProduct(product: any): boolean {
  if (!product) return false;
  return String(product.id) === ALL_DIGITAL_BUNDLE_PRODUCT_ID;
}

/**
 * Předplatné jednoho předmětu 2. stupně (290 Kč/měsíc, 2 900 Kč/rok). Starý systém má checkout
 * na `/predplatne/{mesicni|rocni}/predmet/{id}`, id = předmět ve starém API.
 * Odkazy jsou vynucené v kódu: commit 9c2a24f je v katalogu přepsal na balíček a uložil,
 * takže rodič za 290 Kč skončil na Stripe u 490 Kč — samotné vypnutí přepisu je nevrátilo.
 */
const SUBJECT_LEGACY_ID_BY_PRODUCT_ID: Record<string, number> = {
  '68fcbcd2fe0a9f1c3484043f': 14, // Fyzika
  '6912f0e15acce25c82c7236c': 19, // Chemie
  '68fcbcc86bf08a83a4273e5e': 24, // Matematika 2. stupeň
  '6912f0f415e72b79d11b2103': 25, // Přírodopis
};

const SUBJECT_LEGACY_ID_BY_CATEGORY: Record<string, number> = {
  fyzika: 14,
  chemie: 19,
  'matematika 2. stupeň': 24,
  přírodopis: 25,
};

export function subjectStripeUrls(product: any): { monthly: string; yearly: string } | null {
  if (!product || String(product.type || '').toLowerCase() !== 'online') return null;
  const legacyId = SUBJECT_LEGACY_ID_BY_PRODUCT_ID[String(product.id)]
    ?? SUBJECT_LEGACY_ID_BY_CATEGORY[String(product.category || '').trim().toLowerCase()];
  if (!legacyId) return null;
  return {
    monthly: `https://api.vividbooks.com/predplatne/mesicni/predmet/${legacyId}`,
    yearly: `https://api.vividbooks.com/predplatne/rocni/predmet/${legacyId}`,
  };
}

export function applyAllDigitalBundleStripe<T extends Record<string, unknown>>(product: T): T {
  const subject = subjectStripeUrls(product);
  if (subject) {
    return { ...product, stripeMonthlyUrl: subject.monthly, stripeYearlyUrl: subject.yearly };
  }
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
