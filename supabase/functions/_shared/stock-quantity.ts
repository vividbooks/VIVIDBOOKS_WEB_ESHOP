/** Balíkové SKU ve skladu: např. PC1000-C10 = 1 balík = 10 ks základního PC1000. */

export type StockInventoryItem = {
  sku: string;
  productId?: string | null;
  quantity: number | null;
};

export type StockPackContribution = {
  packSku: string;
  unitsPerPack: number;
  packQuantity: number;
  unitQuantity: number;
};

export type EffectiveStockQuantity = {
  quantity: number | null;
  baseQuantity: number | null;
  packContributions: StockPackContribution[];
};

const PACK_SKU_SUFFIX_RE = /^(.+)-C(\d+)$/i;

export function normalizeStockSku(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function parsePackSku(sku: string | null | undefined) {
  const trimmed = String(sku || '').trim();
  if (!trimmed) return null;

  const match = trimmed.match(PACK_SKU_SUFFIX_RE);
  if (!match) return null;

  const unitsPerPack = Number(match[2]);
  if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) return null;

  return {
    baseSku: match[1],
    unitsPerPack,
  };
}

function isSameStockSku(left: string | null | undefined, right: string | null | undefined) {
  const leftNorm = normalizeStockSku(left);
  const rightNorm = normalizeStockSku(right);
  return Boolean(leftNorm && rightNorm && leftNorm === rightNorm);
}

function resolveInventorySku(item: StockInventoryItem) {
  return String(item.sku || item.productId || '').trim();
}

function findInventoryQuantity(sku: string, inventoryProducts: StockInventoryItem[]) {
  const match = inventoryProducts.find((item) => isSameStockSku(resolveInventorySku(item), sku));
  return match?.quantity ?? null;
}

/**
 * Vrátí efektivní počet kusů pro e-shop produkt.
 * Zohlední volné kusy (PC1000) i balíky (PC1000-C10 → ×10).
 */
export function computeEffectiveStockQuantity(
  lookupSku: string | null | undefined,
  inventoryProducts: StockInventoryItem[],
): EffectiveStockQuantity {
  const sku = String(lookupSku || '').trim();
  if (!sku) {
    return { quantity: null, baseQuantity: null, packContributions: [] };
  }

  const selfPack = parsePackSku(sku);
  if (selfPack) {
    const packQuantity = findInventoryQuantity(sku, inventoryProducts);
    if (packQuantity === null) {
      return { quantity: null, baseQuantity: null, packContributions: [] };
    }

    return {
      quantity: packQuantity * selfPack.unitsPerPack,
      baseQuantity: 0,
      packContributions: [{
        packSku: sku,
        unitsPerPack: selfPack.unitsPerPack,
        packQuantity,
        unitQuantity: packQuantity * selfPack.unitsPerPack,
      }],
    };
  }

  const baseQuantity = findInventoryQuantity(sku, inventoryProducts);
  const packContributions: StockPackContribution[] = [];

  for (const item of inventoryProducts) {
    const inventorySku = resolveInventorySku(item);
    const pack = parsePackSku(inventorySku);
    if (!pack || !isSameStockSku(pack.baseSku, sku)) continue;
    if (item.quantity === null) continue;

    packContributions.push({
      packSku: inventorySku,
      unitsPerPack: pack.unitsPerPack,
      packQuantity: item.quantity,
      unitQuantity: item.quantity * pack.unitsPerPack,
    });
  }

  const hasBaseQuantity = baseQuantity !== null;
  const hasPackQuantity = packContributions.length > 0;

  if (!hasBaseQuantity && !hasPackQuantity) {
    return { quantity: null, baseQuantity: null, packContributions: [] };
  }

  const packUnits = packContributions.reduce((sum, entry) => sum + entry.unitQuantity, 0);

  return {
    quantity: (baseQuantity ?? 0) + packUnits,
    baseQuantity: hasBaseQuantity ? baseQuantity : 0,
    packContributions,
  };
}
