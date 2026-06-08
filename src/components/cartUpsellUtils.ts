export type CartUpsellLine = {
  productTitle: string;
  variantId?: string;
};

export { getProductUnitPriceInHaler } from '../utils/productPrice';

const KNOWN_SUBJECTS = ['Fyzika', 'Chemie', 'Přírodopis', 'Matematika', 'Anglický jazyk', 'Český jazyk', 'Prvouka'];

export const SUBJECT_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  'Fyzika': { accent: '#3730a3', bg: '#f0f4ff', text: '#3730a3' },
  'Chemie': { accent: '#9d174d', bg: '#fdf2f8', text: '#9d174d' },
  'Přírodopis': { accent: '#166534', bg: '#f0fdf4', text: '#166534' },
  'Matematika': { accent: '#9a3412', bg: '#fff7ed', text: '#9a3412' },
  'Anglický jazyk': { accent: '#1e40af', bg: '#eff6ff', text: '#1e40af' },
  'Český jazyk': { accent: '#6b21a8', bg: '#faf5ff', text: '#6b21a8' },
  'Prvouka': { accent: '#9f1239', bg: '#fff1f2', text: '#9f1239' },
  default: { accent: '#001161', bg: '#f8fafc', text: '#001161' },
};

export function parseSubject(title: string): string | null {
  const low = title.toLowerCase();
  return KNOWN_SUBJECTS.find((subject) => low.includes(subject.toLowerCase())) ?? null;
}

export function parseGrade(title: string): number | null {
  const rocnik = title.match(/(\d{1,2})\.\s*ro[cč]n[ií]k/i);
  if (rocnik) return Number.parseInt(rocnik[1], 10);

  const afterSubject = title.match(/(?:fyzika|chemie|p[rř][íi]rodopis|matematika|jazyk|prvouka)\s*(\d{1,2})/i);
  if (afterSubject) return Number.parseInt(afterSubject[1], 10);

  const standalone = title.match(/\b([1-9])\b(?!\.\s*d[íi]l)/i);
  if (standalone) return Number.parseInt(standalone[1], 10);

  return null;
}

export function catMatch(product: any, subject: string): boolean {
  return (product.category || '').toLowerCase().includes(subject.toLowerCase());
}

export function pGrade(product: any): number | null {
  if (product.rocnik) {
    const parsed = Number.parseInt(product.rocnik, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return parseGrade(product.name || product.title || '');
}

export function isDigitalProduct(product: any): boolean {
  const type = (product.type || '').toLowerCase();
  const name = (product.name || product.title || '').toLowerCase();
  return type === 'online' || name.includes('přístup') || name.includes('digitální') || name.includes('licence');
}

export function isPrintProduct(product: any): boolean {
  return !isDigitalProduct(product);
}

export function isAddable(product: any): boolean {
  return !!getProductVariantId(product);
}

/**
 * ID řádku košíku / balíčku: Shopify variantId, jinak u merchu Shoptet SKU / id varianty (viz ProductDetailPage `effectiveCartVariantId`),
 * jinak shoptetId u záznamu produktu.
 */
export function getProductVariantId(product: any): string | undefined {
  const variantId = product.shopifyVariantId || product.variantId;
  if (typeof variantId === 'string' && variantId.trim().length > 0) return variantId.trim();
  const merch = product.merchVariants;
  if (Array.isArray(merch)) {
    for (const v of merch) {
      const vid = v?.shopifyVariantId;
      if (typeof vid === 'string' && vid.trim().length > 0) return vid.trim();
    }
  }
  if (String(product.type || '').toLowerCase() === 'merch' && Array.isArray(merch) && merch.length > 0) {
    for (const v of merch) {
      const sku = typeof v?.shoptetId === 'string' ? v.shoptetId.trim() : '';
      if (sku) return sku;
    }
    for (const v of merch) {
      const metaVid = v?.metadata?.shoptetVariantId;
      if (typeof metaVid === 'string' && metaVid.trim().length > 0) return metaVid.trim();
    }
    for (const v of merch) {
      const rowId = typeof v?.id === 'string' ? v.id.trim() : '';
      if (rowId) return rowId;
    }
  }
  const shoptetProduct = product.shoptetId || product.shoptetProductId;
  if (typeof shoptetProduct === 'string' && shoptetProduct.trim().length > 0) {
    return shoptetProduct.trim();
  }
  return undefined;
}

export function getProductImage(product: any): string | undefined {
  return product.image || product.imageUrl || product.coverImage || undefined;
}

export function getCartUpsellRecommendations(cartLines: CartUpsellLine[], products: any[]) {
  const subjects = new Set<string>();
  const grades = new Set<number>();
  const variantToProduct = new Map<string, any>();

  for (const product of products) {
    const variantId = getProductVariantId(product);
    if (variantId) variantToProduct.set(variantId, product);
  }

  for (const line of cartLines) {
    const dbProduct = line.variantId ? variantToProduct.get(line.variantId) : undefined;
    const enrichedTitle = dbProduct
      ? `${dbProduct.name || ''} ${dbProduct.category || ''}`
      : line.productTitle;

    const subject = parseSubject(enrichedTitle) || (dbProduct?.category ? parseSubject(dbProduct.category) : null);
    if (subject) subjects.add(subject);

    const grade = parseGrade(enrichedTitle) ?? parseGrade(line.productTitle);
    if (grade) grades.add(grade);
  }

  const varIds = new Set(cartLines.map((line) => line.variantId).filter(Boolean));

  const hasDigital = cartLines.some((line) => {
    const title = line.productTitle.toLowerCase();
    const dbProduct = line.variantId ? variantToProduct.get(line.variantId) : undefined;
    const dbName = (dbProduct?.name || '').toLowerCase();
    const dbType = (dbProduct?.type || '').toLowerCase();

    return title.includes('přístup')
      || title.includes('digitální')
      || title.includes('online')
      || title.includes('licence')
      || dbName.includes('přístup')
      || dbName.includes('digitální')
      || dbType === 'online';
  });

  const hasPrint = cartLines.some((line) => {
    const dbProduct = line.variantId ? variantToProduct.get(line.variantId) : undefined;
    const dbType = (dbProduct?.type || '').toLowerCase();
    if (dbType === 'online') return false;

    const title = line.productTitle.toLowerCase();
    return !title.includes('přístup') && !title.includes('digitální') && !title.includes('online') && !title.includes('licence');
  });

  const allProducts = products.filter((product) => (
    !!(product.name || product.title) &&
    !!getProductImage(product)
  ));

  let crossCard: { grade: number; items: any[] } | null = null;
  if (grades.size > 0 && subjects.size > 0) {
    const grade = [...grades][0];
    const cartSubjects = [...subjects];
    const items = allProducts.filter((product) => {
      if (!isPrintProduct(product)) return false;
      if (varIds.has(getProductVariantId(product))) return false;
      if (cartSubjects.some((subject) => catMatch(product, subject))) return false;
      return pGrade(product) === grade;
    }).slice(0, 6);

    if (items.length > 0) {
      crossCard = { grade, items };
    }
  }

  /**
   * „Další díly“ = stejný předmět a stejný ročník jako v košíku (jiné tituly / díly),
   * ne jiné ročníky — jinak u „6. ročník“ vyskakovala 1. a 2. třída.
   */
  let seriesCard: { subject: string; items: any[]; colors: { accent: string; bg: string; text: string } } | null = null;
  if (subjects.size > 0) {
    const subject = [...subjects][0];
    const referenceGrades = new Set(
      cartLines.map((line) => {
        const dbProduct = line.variantId ? variantToProduct.get(line.variantId) : undefined;
        const enrichedTitle = dbProduct
          ? `${dbProduct.name || ''} ${dbProduct.category || ''}`
          : line.productTitle;

        const parsedSubject =
          parseSubject(enrichedTitle) || (dbProduct?.category ? parseSubject(dbProduct.category) : null);
        if (parsedSubject !== subject) return null;

        return (
          parseGrade(enrichedTitle) ??
          parseGrade(line.productTitle) ??
          (dbProduct ? pGrade(dbProduct) : null)
        );
      }).filter((grade): grade is number => grade !== null),
    );

    if (referenceGrades.size > 0) {
      const items = allProducts.filter((product) => {
        if (!catMatch(product, subject)) return false;
        if (!isPrintProduct(product)) return false;
        if (varIds.has(getProductVariantId(product))) return false;

        const grade = pGrade(product);
        return grade !== null && referenceGrades.has(grade);
      }).slice(0, 6);

      if (items.length > 0) {
        seriesCard = {
          subject,
          items,
          colors: SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.default,
        };
      }
    }
  }

  let digitalCard: { items: any[]; subjects: string[] } | null = null;
  if (hasPrint && !hasDigital && subjects.size > 0) {
    const cartSubjects = [...subjects];
    digitalCard = { items: [], subjects: cartSubjects };
  }

  return {
    crossCard,
    seriesCard,
    digitalCard,
  };
}
