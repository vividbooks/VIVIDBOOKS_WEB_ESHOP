/** Musí odpovídat doméně v SEOHead a nasazení (canonical / sdílení). */
export const SITE_URL = 'https://www.vividbooks.com';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Soubory v public/og/categories/{slug}.png — generované / nahraditelné v CMS. */
const CATEGORY_OG_SLUGS = new Set([
  'matematika',
  'fyzika',
  'chemie',
  'prirodopis',
  'cesky-jazyk',
  'prvouka',
  'anglicky-jazyk',
]);

/**
 * Z řetězce kategorie produktu nebo názvu předmětu odvodí klíč souboru og/categories/{slug}.png
 * (např. „Matematika 2. stupeň“ → matematika, URL slug „matematika-2-stupen“ → matematika).
 */
export function categoryToOgSlug(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().toLowerCase();

  const tryOrder: [string, string][] = [
    ['anglick', 'anglicky-jazyk'],
    ['česk', 'cesky-jazyk'],
    ['cesk', 'cesky-jazyk'],
    ['matematik', 'matematika'],
    ['fyzik', 'fyzika'],
    ['chemi', 'chemie'],
    ['přírodopis', 'prirodopis'],
    ['prirodopis', 'prirodopis'],
    ['prvouk', 'prvouka'],
  ];

  for (const [needle, slug] of tryOrder) {
    if (s.includes(needle)) return slug;
  }

  return null;
}

export function categoryOgImageAbsoluteUrl(slug: string): string {
  return `${SITE_URL}/og/categories/${slug}.png`;
}

/**
 * Pro sdílení: platná absolutní URL obrázku produktu, jinak šablona předmětu, jinak výchozí OG.
 */
export function resolveShareImageUrl(opts: {
  explicitImage?: string | null;
  category?: string | null;
}): string {
  const img = opts.explicitImage?.trim();
  if (img) {
    if (/^https?:\/\//i.test(img)) return img;
    if (img.startsWith('/')) return `${SITE_URL}${img}`;
  }

  const slug = opts.category ? categoryToOgSlug(opts.category) : null;
  if (slug && CATEGORY_OG_SLUGS.has(slug)) {
    return categoryOgImageAbsoluteUrl(slug);
  }

  return DEFAULT_OG_IMAGE;
}

export function buildOgImageAlt(opts: {
  title?: string;
  productName?: string;
  categoryLabel?: string;
}): string {
  if (opts.productName?.trim()) {
    const c = opts.categoryLabel?.trim();
    return c
      ? `Náhled produktu ${opts.productName.trim()} — ${c}, Vividbooks`
      : `Náhled produktu ${opts.productName.trim()}, Vividbooks`;
  }
  if (opts.title?.trim() && opts.categoryLabel?.trim()) {
    return `${opts.title.trim()} — ${opts.categoryLabel.trim()}, Vividbooks`;
  }
  if (opts.title?.trim()) return `${opts.title.trim()} — Vividbooks`;
  return 'Vividbooks — interaktivní učebnice pro základní školy';
}
