/** Balíkové SKU ve skladu: např. PC1000-C10 = 1 balík = 10 ks základního PC1000. */

export type StockInventoryItem = {
  sku: string;
  productId?: string | null;
  quantity: number | null;
};

const PLACEHOLDER_STOCK_SKUS = new Set(['', 'new', 'null', 'undefined', '-', 'none', 'n/a']);

const STOCK_META_KEYS = new Set([
  'product_id',
  'sku',
  'ean',
  'name',
  'quantity',
  'stock',
  'available',
  'reservations',
  'variants',
  'variant_reservations',
  'prices',
  'tax_rate',
]);

export function isPlaceholderStockSku(value?: string | null) {
  return PLACEHOLDER_STOCK_SKUS.has(String(value || '').trim().toLowerCase());
}

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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function warehouseMapFromObject(record: Record<string, unknown>) {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    if (STOCK_META_KEYS.has(key)) continue;
    const parsed = toFiniteNumber(value);
    if (parsed === null) continue;
    out[key] = parsed;
  }
  return out;
}

/**
 * Base.com `getInventoryProductsStock` vrací u produktu mapu skladů:
 * `{ product_id, stock: { bl_132291: -23, bl_xxxxx: 150 } }`.
 */
export function extractWarehouseStockMap(raw: unknown): Record<string, number> {
  if (raw === null || raw === undefined || raw === '') return {};
  const direct = toFiniteNumber(raw);
  if (direct !== null) return { _: direct };
  if (typeof raw !== 'object') return {};

  const record = raw as Record<string, unknown>;
  if (record.stock && typeof record.stock === 'object' && !Array.isArray(record.stock)) {
    const nested = warehouseMapFromObject(record.stock as Record<string, unknown>);
    if (Object.keys(nested).length) return nested;
  }

  for (const key of ['quantity', 'available'] as const) {
    const nestedRaw = record[key];
    if (nestedRaw && typeof nestedRaw === 'object' && !Array.isArray(nestedRaw)) {
      const nested = warehouseMapFromObject(nestedRaw as Record<string, unknown>);
      if (Object.keys(nested).length) return nested;
    }
  }

  const siblingMap = warehouseMapFromObject(record);
  if (Object.keys(siblingMap).length) return siblingMap;

  const single = toFiniteNumber(record.quantity ?? record.available ?? record.stock);
  if (single !== null) return { _: single };
  return {};
}

/**
 * Prodejné kusy pro e-shop: sečte sklady s kladným stavem, aby záporný
 * výchozí sklad (přeobjednávky) neschoval fyzické kusy na fulfilmentu.
 * Když nic kladného není, vrátí preferovaný sklad nebo součet (0 / záporné).
 */
export function parseSellableWarehouseQuantity(
  raw: unknown,
  preferredWarehouse?: string | null,
): number | null {
  const map = extractWarehouseStockMap(raw);
  const values = Object.values(map);
  if (!values.length) return null;

  const positives = values.filter((quantity) => quantity > 0);
  if (positives.length) return positives.reduce((sum, quantity) => sum + quantity, 0);

  if (preferredWarehouse && Object.prototype.hasOwnProperty.call(map, preferredWarehouse)) {
    return map[preferredWarehouse];
  }

  return values.reduce((sum, quantity) => sum + quantity, 0);
}

export function inventoryHasSku(sku: string, inventoryProducts: StockInventoryItem[]) {
  const trimmed = String(sku || '').trim();
  if (!trimmed || isPlaceholderStockSku(trimmed)) return false;

  return inventoryProducts.some((item) => {
    const inventorySku = resolveInventorySku(item);
    if (isSameStockSku(inventorySku, trimmed)) return true;
    const pack = parsePackSku(inventorySku);
    return Boolean(pack && isSameStockSku(pack.baseSku, trimmed));
  });
}

/** První SKU z kandidátů, které existuje ve skladu (přeskočí Shoptet „new“). */
export function resolveStockLookupSku(
  candidates: Array<string | null | undefined>,
  inventoryProducts: StockInventoryItem[],
): string | null {
  const cleaned = candidates
    .map((value) => String(value || '').trim())
    .filter((value) => value && !isPlaceholderStockSku(value));

  for (const sku of cleaned) {
    const effective = computeEffectiveStockQuantity(sku, inventoryProducts);
    if (effective.quantity !== null || inventoryHasSku(sku, inventoryProducts)) return sku;
  }

  return cleaned[0] || null;
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
  if (!sku || isPlaceholderStockSku(sku)) {
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
