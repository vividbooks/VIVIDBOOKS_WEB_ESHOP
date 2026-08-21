import { resolveAllowedOrigin } from '../_shared/cors.ts';
import {
  computeEffectiveStockQuantity,
  extractWarehouseStockMap,
  parseSellableWarehouseQuantity,
  resolveStockLookupSku,
} from '../_shared/stock-quantity.ts';
type CatalogProduct = {
  id: string;
  name?: string | null;
  type?: string | null;
  category?: string | null;
  image?: string | null;
  price?: string | null;
  isbn?: string | null;
  shoptetId?: string | null;
  basecomProductId?: string | null;
  basecomSku?: string | null;
  metadata?: {
    isbn?: string | null;
    ean?: string | null;
  } | null;
};

type InventoryProduct = {
  productId: string;
  name: string;
  sku: string;
  ean: string;
  quantity: number | null;
  warehouseQuantities: Record<string, number>;
};

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
});

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
    },
  });
}

function normalizeLoose(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function getFunctionBaseUrl(fallbackRequestUrl?: string) {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  if (supabaseUrl) return supabaseUrl;

  if (fallbackRequestUrl) {
    try {
      return new URL(fallbackRequestUrl).origin;
    } catch {
      return '';
    }
  }

  return '';
}

function getFunctionAuthHeaders() {
  const functionKey = (
    Deno.env.get('PROJECT_PUBLIC_ANON_KEY')
    || Deno.env.get('PUBLIC_ANON_KEY')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || Deno.env.get('SUPABASE_ANON_KEY')
    || ''
  ).trim();

  return functionKey
    ? {
        Authorization: `Bearer ${functionKey}`,
        apikey: functionKey,
      }
    : {};
}

async function callBasecomApi(apiToken: string, method: string, parameters: Record<string, unknown>) {
  const body = new URLSearchParams({
    method,
    parameters: JSON.stringify(parameters),
  });

  const response = await fetch('https://api.baselinker.com/connector.php', {
    method: 'POST',
    headers: {
      'X-BLToken': apiToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  let parsed: Record<string, unknown> = {};

  try {
    parsed = rawText ? JSON.parse(rawText) as Record<string, unknown> : {};
  } catch {
    parsed = { raw: rawText };
  }

  if (!response.ok) {
    throw new Error(`Base.com ${method} HTTP ${response.status}: ${rawText.slice(0, 300)}`);
  }
  if (parsed.status !== 'SUCCESS') {
    const message = typeof parsed.error_message === 'string'
      ? parsed.error_message
      : JSON.stringify(parsed);
    throw new Error(`Base.com ${method} failed: ${message}`);
  }

  return parsed;
}

function normalizeInventories(data: Record<string, unknown>) {
  const inventories = data.inventories;
  if (Array.isArray(inventories)) return inventories;
  if (inventories && typeof inventories === 'object') {
    return Object.entries(inventories as Record<string, unknown>).map(([key, value]) => {
      if (value && typeof value === 'object') {
        return {
          inventory_id: (value as Record<string, unknown>).inventory_id ?? (value as Record<string, unknown>).id ?? key,
          ...(value as Record<string, unknown>),
        };
      }
      return { inventory_id: key, name: value };
    });
  }
  return [];
}

function parseInventoryRecord(record: Record<string, unknown>) {
  const inventoryId = record.inventory_id ?? record.id;
  if (inventoryId === undefined || inventoryId === null || String(inventoryId).trim() === '') return null;
  const warehouses = Array.isArray(record.warehouses)
    ? record.warehouses.map((value) => String(value)).filter(Boolean)
    : [];
  const defaultWarehouse = typeof record.default_warehouse === 'string'
    ? record.default_warehouse
    : warehouses[0] || null;
  return {
    id: String(inventoryId),
    name: typeof record.name === 'string' ? record.name : typeof record.title === 'string' ? record.title : null,
    defaultWarehouse,
    warehouses,
    isDefault: record.is_default === true || record.is_default === 1 || record.is_default === 'true',
  };
}

async function fetchPagedProducts(
  apiToken: string,
  method: 'getInventoryProductsStock' | 'getInventoryProductsList',
  inventoryId: string | number,
) {
  const merged: Record<string, Record<string, unknown>> = {};
  for (let page = 1; page <= 20; page++) {
    const response = await callBasecomApi(apiToken, method, {
      inventory_id: inventoryId,
      page,
    });
    const products = response.products && typeof response.products === 'object'
      ? response.products as Record<string, Record<string, unknown>>
      : {};
    const keys = Object.keys(products);
    if (!keys.length) break;
    Object.assign(merged, products);
    if (keys.length < 1000) break;
  }
  return merged;
}

function mergeWarehouseMaps(...maps: Array<Record<string, number>>) {
  const out: Record<string, number> = {};
  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      const prev = out[key];
      out[key] = prev == null ? value : Math.max(prev, value);
    }
  }
  return out;
}

async function loadCatalogProducts(requestUrl: string) {
  const baseUrl = getFunctionBaseUrl(requestUrl);
  if (!baseUrl) {
    throw new Error('Missing base URL for catalog fetch.');
  }

  const response = await fetch(`${baseUrl}/functions/v1/make-server-93a20b6f/products`, {
    headers: {
      ...getFunctionAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Product catalog HTTP ${response.status}`);
  }

  const data = await response.json().catch(() => ({ products: [] }));
  return Array.isArray(data?.products) ? data.products as CatalogProduct[] : [];
}

async function loadInventoryProducts() {
  const apiToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();
  if (!apiToken) {
    throw new Error('Missing BASECOM_API_TOKEN.');
  }

  const [inventoriesResponse, warehousesResponse] = await Promise.all([
    callBasecomApi(apiToken, 'getInventories', {}),
    callBasecomApi(apiToken, 'getInventoryWarehouses', {}),
  ]);
  const inventories = normalizeInventories(inventoriesResponse);
  const parsedInventories = inventories
    .map((item) => (item && typeof item === 'object' ? parseInventoryRecord(item as Record<string, unknown>) : null))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const primaryInventory = parsedInventories.find((item) => item.isDefault) || parsedInventories[0] || null;
  if (!primaryInventory) {
    throw new Error('No inventory_id found in Base.com response.');
  }

  const warehouseMeta = Array.isArray(warehousesResponse.warehouses)
    ? (warehousesResponse.warehouses as Array<Record<string, unknown>>).map((row) => {
        const warehouseType = String(row.warehouse_type || 'bl');
        const warehouseId = row.warehouse_id ?? row.id;
        const key = warehouseId === undefined || warehouseId === null
          ? ''
          : `${warehouseType}_${warehouseId}`;
        return {
          key,
          type: warehouseType,
          id: warehouseId == null ? null : String(warehouseId),
          name: typeof row.name === 'string' ? row.name : null,
          isDefault: row.is_default === true || row.is_default === 1,
        };
      }).filter((row) => row.key)
    : [];

  const productsByKey = new Map<string, InventoryProduct>();

  for (const inventory of parsedInventories) {
    const inventoryId = Number.isNaN(Number(inventory.id)) ? inventory.id : Number(inventory.id);
    const [stockProducts, listProducts] = await Promise.all([
      fetchPagedProducts(apiToken, 'getInventoryProductsStock', inventoryId),
      fetchPagedProducts(apiToken, 'getInventoryProductsList', inventoryId),
    ]);

    const allProductIds = new Set([
      ...Object.keys(listProducts),
      ...Object.keys(stockProducts),
    ]);

    for (const productId of allProductIds) {
      const value = listProducts[productId] || {};
      const stockRecord = stockProducts[productId] || {};
      const warehouseQuantities = mergeWarehouseMaps(
        extractWarehouseStockMap(value),
        extractWarehouseStockMap(stockRecord),
      );
      const next: InventoryProduct = {
        productId,
        name: String(value?.name || stockRecord?.name || ''),
        sku: String(value?.sku || stockRecord?.sku || productId || ''),
        ean: String(value?.ean || stockRecord?.ean || ''),
        quantity: parseSellableWarehouseQuantity({ stock: warehouseQuantities }, inventory.defaultWarehouse),
        warehouseQuantities,
      };
      const mergeKey = next.sku ? `sku:${next.sku.toLowerCase()}` : `id:${productId}`;
      const existing = productsByKey.get(mergeKey) || productsByKey.get(`id:${productId}`);
      if (!existing) {
        productsByKey.set(mergeKey, next);
        continue;
      }
      const mergedWarehouses = mergeWarehouseMaps(existing.warehouseQuantities, next.warehouseQuantities);
      productsByKey.set(mergeKey, {
        ...existing,
        name: existing.name || next.name,
        sku: existing.sku || next.sku,
        ean: existing.ean || next.ean,
        warehouseQuantities: mergedWarehouses,
        quantity: parseSellableWarehouseQuantity({ stock: mergedWarehouses }, primaryInventory.defaultWarehouse),
      });
    }
  }

  return {
    inventoryId: primaryInventory.id,
    inventoryName: primaryInventory.name,
    warehouseId: primaryInventory.defaultWarehouse,
    warehouses: primaryInventory.warehouses,
    warehouseMeta,
    inventories: parsedInventories.map((item) => ({
      id: item.id,
      name: item.name,
      defaultWarehouse: item.defaultWarehouse,
      warehouses: item.warehouses,
      isDefault: item.isDefault,
    })),
    products: Array.from(productsByKey.values()),
  };
}

function matchInventoryProduct(product: CatalogProduct, inventoryProducts: InventoryProduct[]) {
  const explicitBaseIdNorm = normalizeLoose(product.basecomProductId);
  const explicitSkuNorm = normalizeLoose(product.basecomSku);
  const lookupIdNorm = normalizeLoose(product.shoptetId);
  const eanNorm = normalizeLoose(product.metadata?.ean);
  const isbnNorm = normalizeLoose(product.isbn || product.metadata?.isbn);
  const nameNorm = normalizeLoose(product.name);

  let matched = inventoryProducts.find((item) =>
    explicitBaseIdNorm && normalizeLoose(item.productId) === explicitBaseIdNorm
  );
  let matchType: string | null = matched ? 'basecom_product_id' : null;

  if (!matched) {
    matched = inventoryProducts.find((item) =>
      explicitSkuNorm && normalizeLoose(item.sku) === explicitSkuNorm
    );
    if (matched) matchType = 'basecom_sku';
  }

  if (!matched) {
    matched = inventoryProducts.find((item) =>
      lookupIdNorm && (
        normalizeLoose(item.productId) === lookupIdNorm ||
        normalizeLoose(item.sku) === lookupIdNorm ||
        normalizeLoose(item.ean) === lookupIdNorm
      )
    );
    if (matched) matchType = 'lookup_id';
  }

  if (!matched && (eanNorm || isbnNorm)) {
    matched = inventoryProducts.find((item) => {
      const itemEan = normalizeLoose(item.ean);
      const itemSku = normalizeLoose(item.sku);
      return Boolean(eanNorm && (itemEan === eanNorm || itemSku === eanNorm))
        || Boolean(isbnNorm && (itemEan === isbnNorm || itemSku === isbnNorm));
    });
    if (matched) matchType = 'ean_or_isbn';
  }

  if (!matched && nameNorm) {
    matched = inventoryProducts.find((item) => normalizeLoose(item.name) === nameNorm);
    if (matched) matchType = 'name';
  }

  return {
    matched: matched || null,
    matchType,
  };
}

function getStockStatus(quantity: number | null) {
  if (quantity === null) {
    return {
      code: 'unknown',
      label: 'Čeká na naskladnění',
    };
  }

  if (quantity <= 0) {
    return {
      code: 'waiting',
      label: 'Čeká na naskladnění',
    };
  }

  if (quantity <= 10) {
    return {
      code: 'low',
      label: `Posledních ${quantity} ks`,
    };
  }

  return {
    code: 'in_stock',
    label: 'Skladem',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  if (req.method !== 'GET') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  try {
    const url = new URL(req.url);
    const productId = (url.searchParams.get('productId') || '').trim();
    const shoptetSkuOverride = (url.searchParams.get('shoptetSku') || '').trim();
    const onlyPhysical = url.searchParams.get('physicalOnly') !== 'false';

    const [catalogProducts, inventory] = await Promise.all([
      loadCatalogProducts(req.url),
      loadInventoryProducts(),
    ]);

    const filteredCatalog = catalogProducts.filter((product) => (
      !onlyPhysical || (product.type !== 'online' && product.type !== 'license')
    ));

    function buildItem(product: CatalogProduct, overrideShoptetSku?: string) {
      const forMatch = overrideShoptetSku
        ? { ...product, shoptetId: overrideShoptetSku }
        : product;
      const { matched, matchType } = matchInventoryProduct(forMatch, inventory.products);
      const lookupSku = resolveStockLookupSku([
        overrideShoptetSku,
        product.shoptetId,
        product.basecomSku,
        matched?.sku,
      ], inventory.products);
      const effectiveStock = computeEffectiveStockQuantity(lookupSku, inventory.products);
      const quantity = effectiveStock.quantity;
      const stockStatus = getStockStatus(quantity);

      return {
        id: product.id,
        name: product.name || '',
        type: product.type || null,
        category: product.category || null,
        image: product.image || null,
        price: product.price || null,
        isbn: product.isbn || product.metadata?.isbn || null,
        ean: product.metadata?.ean || null,
        shoptetId: product.shoptetId || null,
        basecomProductId: product.basecomProductId || null,
        basecomSku: product.basecomSku || null,
        quantity,
        baseQuantity: effectiveStock.baseQuantity,
        packContributions: effectiveStock.packContributions,
        stockStatus,
        matched: Boolean(matched),
        matchType,
        matchedProductId: matched?.productId || null,
        matchedSku: matched?.sku || null,
        lookupSku,
        warehouseQuantities: matched
          ? inventory.products.find((item) => item.productId === matched.productId)?.warehouseQuantities || {}
          : {},
        inventoryId: inventory.inventoryId,
        inventoryName: inventory.inventoryName,
        warehouseId: inventory.warehouseId,
      };
    }

    if (productId) {
      const catalogProduct = filteredCatalog.find((p) => p.id === productId);
      if (!catalogProduct) {
        return jsonResponse(req, { error: 'Product not found.' }, 404);
      }

      const item = buildItem(catalogProduct, shoptetSkuOverride || undefined);
      return jsonResponse(req, {
        item,
        inventory: {
          inventoryId: inventory.inventoryId,
          inventoryName: inventory.inventoryName,
          warehouseId: inventory.warehouseId,
          warehouses: inventory.warehouses,
          warehouseMeta: inventory.warehouseMeta,
          inventories: inventory.inventories,
        },
      });
    }

    const items = filteredCatalog.map((product) => buildItem(product));

    return jsonResponse(req, {
      inventory: {
        inventoryId: inventory.inventoryId,
        inventoryName: inventory.inventoryName,
        warehouseId: inventory.warehouseId,
        warehouses: inventory.warehouses,
        warehouseMeta: inventory.warehouseMeta,
        inventories: inventory.inventories,
      },
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load product stock status.';
    return jsonResponse(req, { error: message }, 500);
  }
});
