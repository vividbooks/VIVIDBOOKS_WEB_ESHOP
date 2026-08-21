import { resolveAllowedOrigin } from '../_shared/cors.ts';
import {
  fetchFulfilmentCzStock,
  readFulfilmentCzConfig,
} from '../_shared/fulfilment-cz-stock.ts';
import {
  fetchFulfilmentStock,
  readFulfilmentStockConfig,
} from '../_shared/fulfilment-stock.ts';
import {
  computeEffectiveStockQuantity,
  extractVariantStockMaps,
  extractWarehouseStockMap,
  listProductVariants,
  parsePackSku,
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
  extraParameters: Record<string, unknown> = {},
) {
  const merged: Record<string, Record<string, unknown>> = {};
  for (let page = 1; page <= 20; page++) {
    const response = await callBasecomApi(apiToken, method, {
      inventory_id: inventoryId,
      page,
      ...extraParameters,
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

async function fetchInventoryProductsData(
  apiToken: string,
  inventoryId: string | number,
  productIds: string[],
) {
  const merged: Record<string, Record<string, unknown>> = {};
  const uniqueIds = [...new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean))];

  for (let i = 0; i < uniqueIds.length; i += 50) {
    const chunk = uniqueIds.slice(i, i + 50).map((id) => {
      const numeric = Number(id);
      return Number.isFinite(numeric) ? numeric : id;
    });
    try {
      const response = await callBasecomApi(apiToken, 'getInventoryProductsData', {
        inventory_id: inventoryId,
        products: chunk,
      });
      const products = response.products && typeof response.products === 'object'
        ? response.products as Record<string, Record<string, unknown>>
        : {};
      Object.assign(merged, products);
    } catch {
      // Detail variant nesmí shodit celý stav skladu.
    }
  }

  return merged;
}

function extractXmlValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function loadFeedPackProducts() {
  const feedUrl = (Deno.env.get('BASECOM_INVENTORY_FEED_URL') || '').trim();
  if (!feedUrl) return [] as InventoryProduct[];

  try {
    const response = await fetch(feedUrl);
    const rawText = await response.text();
    if (!response.ok) return [];

    const itemRegex = /<SHOPITEM\b[^>]*>([\s\S]*?)<\/SHOPITEM>/gi;
    const products: InventoryProduct[] = [];
    let match: RegExpExecArray | null = null;
    while ((match = itemRegex.exec(rawText)) !== null) {
      const block = match[1];
      const sku = extractXmlValue(block, 'CODE');
      if (!sku || !parsePackSku(sku)) continue;
      const quantity = Number(
        extractXmlValue(block, 'STOCK')
        || extractXmlValue(block, 'QUANTITY')
        || extractXmlValue(block, 'AMOUNT'),
      );
      if (!Number.isFinite(quantity)) continue;
      products.push({
        productId: sku,
        name: extractXmlValue(block, 'NAME'),
        sku,
        ean: extractXmlValue(block, 'EAN'),
        quantity,
        warehouseQuantities: { feed: quantity },
      });
    }
    return products;
  } catch {
    return [];
  }
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

async function loadInventoryProducts(extraLookupSkus: string[] = []) {
  const apiToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();
  if (!apiToken) {
    throw new Error('Missing BASECOM_API_TOKEN.');
  }

  const [inventoriesResponse, warehousesResponse, storagesResponse] = await Promise.all([
    callBasecomApi(apiToken, 'getInventories', {}),
    callBasecomApi(apiToken, 'getInventoryWarehouses', {}),
    callBasecomApi(apiToken, 'getExternalStoragesList', {}).catch(() => ({ storages: [] })),
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

  const upsertInventoryProduct = (next: InventoryProduct) => {
    const skuKey = next.sku ? `sku:${next.sku.toLowerCase()}` : '';
    const idKey = next.productId ? `id:${next.productId}` : '';
    if (!skuKey && !idKey) return;
    const existing = (skuKey ? productsByKey.get(skuKey) : undefined)
      || (idKey ? productsByKey.get(idKey) : undefined);
    if (!existing) {
      if (skuKey) productsByKey.set(skuKey, next);
      else productsByKey.set(idKey, next);
      return;
    }
    const warehouseQuantities = mergeWarehouseMaps(existing.warehouseQuantities, next.warehouseQuantities);
    const merged: InventoryProduct = {
      ...existing,
      name: existing.name || next.name,
      sku: existing.sku || next.sku,
      ean: existing.ean || next.ean,
      productId: existing.productId || next.productId,
      warehouseQuantities,
      quantity: parseSellableWarehouseQuantity({ stock: warehouseQuantities }, primaryInventory.defaultWarehouse),
    };
    const mergedSkuKey = merged.sku ? `sku:${merged.sku.toLowerCase()}` : idKey;
    productsByKey.set(mergedSkuKey, merged);
  };

  for (const inventory of parsedInventories) {
    const inventoryId = Number.isNaN(Number(inventory.id)) ? inventory.id : Number(inventory.id);
    const [stockProducts, listProducts] = await Promise.all([
      fetchPagedProducts(apiToken, 'getInventoryProductsStock', inventoryId),
      fetchPagedProducts(apiToken, 'getInventoryProductsList', inventoryId),
    ]);

    const allProductIds = [...new Set([
      ...Object.keys(listProducts),
      ...Object.keys(stockProducts),
    ])];

    const productIdsWithVariants = allProductIds.filter((productId) => {
      const stockRecord = stockProducts[productId] || {};
      const value = listProducts[productId] || {};
      return Object.keys({
        ...extractVariantStockMaps(stockRecord),
        ...extractVariantStockMaps(value),
      }).length > 0;
    });
    const productData = await fetchInventoryProductsData(apiToken, inventoryId, productIdsWithVariants);

    for (const productId of allProductIds) {
      const value = listProducts[productId] || {};
      const stockRecord = stockProducts[productId] || {};
      const dataRecord = productData[productId]
        || Object.values(productData).find((row) => String(row.id || row.product_id || '') === productId)
        || {};
      const warehouseQuantities = mergeWarehouseMaps(
        extractWarehouseStockMap(value),
        extractWarehouseStockMap(stockRecord),
        extractWarehouseStockMap(
          dataRecord.stock != null ? { stock: dataRecord.stock } : {},
        ),
      );
      upsertInventoryProduct({
        productId,
        name: String(value?.name || dataRecord?.name || stockRecord?.name || ''),
        sku: String(value?.sku || dataRecord?.sku || stockRecord?.sku || productId || ''),
        ean: String(value?.ean || dataRecord?.ean || stockRecord?.ean || ''),
        quantity: parseSellableWarehouseQuantity({ stock: warehouseQuantities }, inventory.defaultWarehouse),
        warehouseQuantities,
      });

      const variantStockMaps = {
        ...extractVariantStockMaps(stockRecord),
        ...extractVariantStockMaps(value),
      };
      const variants = listProductVariants(dataRecord, variantStockMaps);
      const fallbackVariants = variants.length
        ? variants
        : Object.entries(variantStockMaps).map(([variantId, map]) => ({
            variantId,
            sku: '',
            ean: '',
            name: '',
            warehouseQuantities: map,
          }));

      for (const variant of fallbackVariants) {
        if (variant.sku) {
          upsertInventoryProduct({
            productId: variant.variantId || `${productId}:${variant.sku}`,
            name: variant.name || String(value?.name || ''),
            sku: variant.sku,
            ean: variant.ean,
            warehouseQuantities: variant.warehouseQuantities,
            quantity: parseSellableWarehouseQuantity(
              { stock: variant.warehouseQuantities },
              inventory.defaultWarehouse,
            ),
          });
          continue;
        }
        if (!Object.keys(variant.warehouseQuantities).length) continue;
        const parentSku = String(value?.sku || dataRecord?.sku || '').trim();
        const parent = (parentSku ? productsByKey.get(`sku:${parentSku.toLowerCase()}`) : undefined)
          || productsByKey.get(`id:${productId}`);
        if (!parent) continue;
        const warehouseQuantities = mergeWarehouseMaps(parent.warehouseQuantities, variant.warehouseQuantities);
        upsertInventoryProduct({
          ...parent,
          warehouseQuantities,
          quantity: parseSellableWarehouseQuantity({ stock: warehouseQuantities }, inventory.defaultWarehouse),
        });
      }
    }
  }

  const externalStorages = Array.isArray(storagesResponse.storages)
    ? (storagesResponse.storages as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.storage_id || ''),
        name: typeof row.name === 'string' ? row.name : '',
        methods: Array.isArray(row.methods) ? row.methods.map((value) => String(value)) : [],
      })).filter((row) => row.id)
    : [];

  const fulfillmentStorages = externalStorages.filter((storage) => (
    storage.id.startsWith('warehouse_')
    || storage.id.startsWith('shop_')
    || /fulfil|fulfill|3pl|skladon|ppl|sync/i.test(`${storage.id} ${storage.name}`)
  ));
  const externalStorageErrors: Array<{ id: string; error: string }> = [];

  for (const storage of fulfillmentStorages) {
    if (storage.methods.length && !storage.methods.includes('getExternalStorageProductsList')) continue;
    try {
      for (let page = 0; page <= 20; page++) {
        const listResponse = await callBasecomApi(apiToken, 'getExternalStorageProductsList', {
          storage_id: storage.id,
          page,
        });
        const rows = Array.isArray(listResponse.products)
          ? listResponse.products as Array<Record<string, unknown>>
          : listResponse.products && typeof listResponse.products === 'object'
            ? Object.values(listResponse.products as Record<string, Record<string, unknown>>)
            : [];
        if (!rows.length) {
          if (page === 0) continue;
          break;
        }
        for (const row of rows) {
          const sku = String(row.sku || row.product_id || '').trim();
          if (!sku) continue;
          const quantity = Number(
            row.quantity ?? row.stock ?? row.qty ?? row.amount ?? row.available,
          );
          if (!Number.isFinite(quantity)) continue;
          const warehouseKey = storage.id;
          const existing = productsByKey.get(`sku:${sku.toLowerCase()}`);
          const warehouseQuantities = mergeWarehouseMaps(
            existing?.warehouseQuantities || {},
            { [warehouseKey]: quantity },
          );
          productsByKey.set(`sku:${sku.toLowerCase()}`, {
            productId: existing?.productId || String(row.product_id || sku),
            name: existing?.name || String(row.name || ''),
            sku: existing?.sku || sku,
            ean: existing?.ean || String(row.ean || ''),
            warehouseQuantities,
            quantity: parseSellableWarehouseQuantity({ stock: warehouseQuantities }, primaryInventory.defaultWarehouse),
          });
        }
        if (rows.length < 100) break;
      }
    } catch (error) {
      externalStorageErrors.push({
        id: storage.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const feedProduct of await loadFeedPackProducts()) {
    upsertInventoryProduct(feedProduct);
  }

  const extraPackSkus = [...new Set(extraLookupSkus.flatMap((value) => {
    const sku = String(value || '').trim();
    if (!sku) return [] as string[];
    return parsePackSku(sku) ? [sku] : [sku, `${sku}-C10`];
  }))].filter((sku) => !productsByKey.has(`sku:${sku.toLowerCase()}`));

  const extraInventoryId = Number.isNaN(Number(primaryInventory.id))
    ? primaryInventory.id
    : Number(primaryInventory.id);

  const packLookups = extraPackSkus.slice(0, 8);
  for (let i = 0; i < packLookups.length; i += 4) {
    const chunk = packLookups.slice(i, i + 4);
    await Promise.all(chunk.map(async (packSku) => {
      try {
        const [extraList, extraStock] = await Promise.all([
          fetchPagedProducts(apiToken, 'getInventoryProductsList', extraInventoryId, { filter_sku: packSku }),
          fetchPagedProducts(apiToken, 'getInventoryProductsStock', extraInventoryId, { filter_sku: packSku }),
        ]);
        const extraIds = [...new Set([...Object.keys(extraList), ...Object.keys(extraStock)])];
        for (const extraId of extraIds) {
          const value = extraList[extraId] || {};
          const stockRecord = extraStock[extraId] || {};
          const sku = String(value?.sku || stockRecord?.sku || packSku).trim();
          const warehouseQuantities = mergeWarehouseMaps(
            extractWarehouseStockMap(value),
            extractWarehouseStockMap(stockRecord),
          );
          if (!sku) continue;
          upsertInventoryProduct({
            productId: extraId,
            name: String(value?.name || stockRecord?.name || ''),
            sku,
            ean: String(value?.ean || stockRecord?.ean || ''),
            warehouseQuantities,
            quantity: parseSellableWarehouseQuantity(
              { stock: warehouseQuantities },
              primaryInventory.defaultWarehouse,
            ),
          });
        }
      } catch {
        // Doplňkové filter_sku nesmí shodit stav skladu.
      }
    }));
  }

  const readEnv = (name: string) => Deno.env.get(name);
  const listEnvNames = () => {
    try {
      return Object.keys(Deno.env.toObject());
    } catch {
      return [];
    }
  };
  const fulfilmentCzConfig = readFulfilmentCzConfig(readEnv, listEnvNames);
  const genericFulfilmentConfig = fulfilmentCzConfig ? null : readFulfilmentStockConfig(readEnv);

  const fulfilment = fulfilmentCzConfig
    ? await fetchFulfilmentCzStock(fulfilmentCzConfig)
    : genericFulfilmentConfig
      ? await fetchFulfilmentStock(genericFulfilmentConfig)
      : null;
  const fulfilmentSource = fulfilmentCzConfig
    ? 'fulfillment.cz'
    : genericFulfilmentConfig
      ? 'generic'
      : null;

  for (const row of fulfilment?.rows || []) {
    const sku = row.sku.trim();
    if (!sku) continue;
    const existing = productsByKey.get(`sku:${sku.toLowerCase()}`);
    const warehouseQuantities = mergeWarehouseMaps(
      existing?.warehouseQuantities || {},
      { [fulfilment!.warehouseKey]: row.quantity },
    );
    upsertInventoryProduct({
      productId: existing?.productId || `fulfilment:${sku}`,
      name: existing?.name || '',
      sku: existing?.sku || sku,
      ean: existing?.ean || '',
      warehouseQuantities,
      quantity: parseSellableWarehouseQuantity(
        { stock: warehouseQuantities },
        primaryInventory.defaultWarehouse,
      ),
    });
  }

  const products = Array.from(productsByKey.values());

  return {
    inventoryId: primaryInventory.id,
    inventoryName: primaryInventory.name,
    warehouseId: primaryInventory.defaultWarehouse,
    warehouses: primaryInventory.warehouses,
    warehouseMeta,
    fulfilment: {
      configured: Boolean(fulfilmentSource),
      source: fulfilmentSource,
      warehouseKey: fulfilment?.warehouseKey || null,
      rowCount: fulfilment?.rows.length ?? 0,
      error: fulfilment?.error || null,
    },
    externalStorages,
    externalStorageErrors,
    packSkuCount: products.filter((item) => Boolean(parsePackSku(item.sku))).length,
    inventories: parsedInventories.map((item) => ({
      id: item.id,
      name: item.name,
      defaultWarehouse: item.defaultWarehouse,
      warehouses: item.warehouses,
      isDefault: item.isDefault,
    })),
    products,
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

    const catalogProducts = await loadCatalogProducts(req.url);

    // Dohledání balíkových SKU stojí volání Base.com, proto jen pro dotaz na jeden produkt.
    const extraLookupSkus = [shoptetSkuOverride];
    if (productId) {
      const requested = catalogProducts.find((item) => item.id === productId);
      extraLookupSkus.push(String(requested?.shoptetId || ''), String(requested?.basecomSku || ''));
    }

    const inventory = await loadInventoryProducts(extraLookupSkus);

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
        warehouseQuantities: (() => {
          const fromMatch = matched
            ? inventory.products.find((item) => item.productId === matched.productId)?.warehouseQuantities || {}
            : {};
          const fromLookup = lookupSku
            ? inventory.products.find((item) => item.sku.toLowerCase() === lookupSku.toLowerCase())?.warehouseQuantities || {}
            : {};
          return mergeWarehouseMaps(fromMatch, fromLookup);
        })(),
        inventoryId: inventory.inventoryId,
        inventoryName: inventory.inventoryName,
        warehouseId: inventory.warehouseId,
      };
    }

    function inventoryMeta() {
      return {
        inventoryId: inventory.inventoryId,
        inventoryName: inventory.inventoryName,
        warehouseId: inventory.warehouseId,
        warehouses: inventory.warehouses,
        warehouseMeta: inventory.warehouseMeta,
        fulfilment: inventory.fulfilment,
        externalStorages: inventory.externalStorages,
        externalStorageErrors: inventory.externalStorageErrors,
        packSkuCount: inventory.packSkuCount,
        inventories: inventory.inventories,
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
        inventory: inventoryMeta(),
      });
    }

    const items = filteredCatalog.map((product) => buildItem(product));

    return jsonResponse(req, {
      inventory: inventoryMeta(),
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load product stock status.';
    return jsonResponse(req, { error: message }, 500);
  }
});
