/** Párování písanek pro praváky (PCJx00) a leváky (PCJx20). */

const RIGHT_TO_LEFT: Record<string, string> = {
  PCJ1100: 'PCJ1120',
  PCJ1200: 'PCJ1220',
  PCJ1300: 'PCJ1320',
  PCJ1500: 'PCJ1520',
  PCJ1600: 'PCJ1620',
  PCJ1700: 'PCJ1720',
};

const LEFT_TO_RIGHT: Record<string, string> = Object.fromEntries(
  Object.entries(RIGHT_TO_LEFT).map(([right, left]) => [left, right]),
);

export type PisankaHandedness = 'right' | 'left';

type HandednessProduct = {
  id?: string;
  name?: string;
  shoptetId?: string | null;
  basecomSku?: string | null;
  handedness?: string | null;
  hideFromCatalog?: boolean | null;
  metadata?: { handedness?: string | null } | null;
};

function productSku(product: HandednessProduct): string {
  return String(product.shoptetId || product.basecomSku || '').trim().toUpperCase();
}

export function isPisankaProduct(product: HandednessProduct): boolean {
  const name = String(product.name || '').toLowerCase();
  if (name.includes('písanka') || name.includes('pisanka')) return true;
  const sku = productSku(product);
  return Boolean(RIGHT_TO_LEFT[sku] || LEFT_TO_RIGHT[sku]);
}

export function getPisankaHandedness(product: HandednessProduct): PisankaHandedness | null {
  const explicit = product.handedness || product.metadata?.handedness;
  if (explicit === 'left' || explicit === 'right') return explicit;
  const sku = productSku(product);
  if (LEFT_TO_RIGHT[sku]) return 'left';
  if (RIGHT_TO_LEFT[sku] && isPisankaProduct(product)) return 'right';
  return null;
}

export function getPisankaPairSku(product: HandednessProduct): string | null {
  const sku = productSku(product);
  return RIGHT_TO_LEFT[sku] || LEFT_TO_RIGHT[sku] || null;
}

export function findPisankaHandednessPair<T extends HandednessProduct>(
  product: T,
  products: readonly T[],
): T | null {
  const pairSku = getPisankaPairSku(product);
  if (!pairSku) return null;
  return products.find((p) => productSku(p) === pairSku) || null;
}

export function isHiddenFromCatalog(product: HandednessProduct): boolean {
  if (product.hideFromCatalog === true) return true;
  return getPisankaHandedness(product) === 'left';
}
