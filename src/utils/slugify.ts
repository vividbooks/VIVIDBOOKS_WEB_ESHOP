export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

type ProductSlugSource = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
};

function productBaseSlug(product: ProductSlugSource): string {
  const fromName = slugify(String(product?.name ?? product?.title ?? '').trim());
  if (fromName) return fromName;
  const fromId = slugify(String(product?.id ?? '').trim());
  return fromId || 'produkt';
}

function productSlugIdentity(product: ProductSlugSource): string {
  return String(product?.id ?? product?.name ?? product?.title ?? '').trim();
}

export function productSlug(product: ProductSlugSource, allProducts?: readonly ProductSlugSource[]): string {
  const base = productBaseSlug(product);
  if (!allProducts?.length) return base;

  const siblings = allProducts
    .filter((item) => productBaseSlug(item) === base)
    .sort((a, b) => productSlugIdentity(a).localeCompare(productSlugIdentity(b), 'cs'));
  if (siblings.length <= 1) return base;

  const ownIdentity = productSlugIdentity(product);
  const idx = siblings.findIndex((item) => productSlugIdentity(item) === ownIdentity);
  return idx <= 0 ? base : `${base}-${idx + 1}`;
}

export function productDetailPath(product: ProductSlugSource, allProducts?: readonly ProductSlugSource[]): string {
  return `/produkt/${encodeURIComponent(productSlug(product, allProducts))}`;
}

const SLUG_TO_SUBJECT: Record<string, string> = {
  'matematika-2-stupen': 'Matematika 2. stupe\u0148',
  'matematika-1-stupen': 'Matematika 1. stupe\u0148',
  'fyzika': 'Fyzika',
  'chemie': 'Chemie',
  'prirodopis': 'P\u0159\u00edrodopis',
  'anglicky-jazyk': 'Anglick\u00fd jazyk',
  'cesky-jazyk': '\u010cesk\u00fd jazyk',
  'prvouka': 'Prvouka',
  '2-stupen': '2. stupe\u0148',
  '1-stupen': '1. stupe\u0148',
};

export const subjectToSlug = (subject: string): string => slugify(subject);
export const slugToSubject = (slug: string): string | null => SLUG_TO_SUBJECT[slug] ?? null;
