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
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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

function parseWarehouseQuantity(rawQuantity: unknown, defaultWarehouse: string | null) {
  if (rawQuantity === null || rawQuantity === undefined || rawQuantity === '') return null;
  if (typeof rawQuantity === 'number') return Number.isFinite(rawQuantity) ? rawQuantity : null;
  if (typeof rawQuantity === 'string') {
    const parsed = Number(rawQuantity);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof rawQuantity === 'object') {
    const quantityMap = rawQuantity as Record<string, unknown>;
    const preferred = defaultWarehouse ? quantityMap[defaultWarehouse] : undefined;
    const fallback = preferred ?? Object.values(quantityMap)[0];
    if (fallback === null || fallback === undefined || fallback === '') return null;
    const parsed = Number(fallback);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function pickFirstInventory(inventories: unknown[]) {
  const first = inventories[0];
  if (!first || typeof first !== 'object') return null;
  const record = first as Record<string, unknown>;
  const inventoryId = record.inventory_id ?? record.id;
  if (inventoryId === undefined || inventoryId === null || String(inventoryId).trim() === '') return null;
  const defaultWarehouse = typeof record.default_warehouse === 'string'
    ? record.default_warehouse
    : Array.isArray(record.warehouses) && typeof record.warehouses[0] === 'string'
      ? record.warehouses[0]
      : null;
  return {
    id: String(inventoryId),
    name: typeof record.name === 'string' ? record.name : typeof record.title === 'string' ? record.title : null,
    defaultWarehouse,
  };
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

  const inventoriesResponse = await callBasecomApi(apiToken, 'getInventories', {});
  const inventories = normalizeInventories(inventoriesResponse);
  const firstInventory = pickFirstInventory(inventories);
  if (!firstInventory) {
    throw new Error('No inventory_id found in Base.com response.');
  }

  const [stockResponse, listResponse] = await Promise.all([
    callBasecomApi(apiToken, 'getInventoryProductsStock', {
      inventory_id: Number.isNaN(Number(firstInventory.id)) ? firstInventory.id : Number(firstInventory.id),
    }),
    callBasecomApi(apiToken, 'getInventoryProductsList', {
      inventory_id: Number.isNaN(Number(firstInventory.id)) ? firstInventory.id : Number(firstInventory.id),
    }),
  ]);

  const stockProducts = stockResponse.products && typeof stockResponse.products === 'object'
    ? stockResponse.products as Record<string, Record<string, unknown>>
    : {};
  const listProducts = listResponse.products && typeof listResponse.products === 'object'
    ? listResponse.products as Record<string, Record<string, unknown>>
    : {};

  const products: InventoryProduct[] = Object.entries(listProducts).map(([productId, value]) => {
    const stockRecord = stockProducts[productId] || {};
    return {
      productId,
      name: String(value?.name || ''),
      sku: String(value?.sku || ''),
      ean: String(value?.ean || ''),
      quantity: parseWarehouseQuantity(
        stockRecord.quantity ?? stockRecord.stock ?? stockRecord.available ?? null,
        firstInventory.defaultWarehouse,
      ),
    };
  });

  return {
    inventoryId: firstInventory.id,
    inventoryName: firstInventory.name,
    warehouseId: firstInventory.defaultWarehouse,
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
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
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
      const quantity = matched?.quantity ?? null;
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
        stockStatus,
        matched: Boolean(matched),
        matchType,
        matchedProductId: matched?.productId || null,
        matchedSku: matched?.sku || null,
        inventoryId: inventory.inventoryId,
        inventoryName: inventory.inventoryName,
        warehouseId: inventory.warehouseId,
      };
    }

    if (productId) {
      const catalogProduct = filteredCatalog.find((p) => p.id === productId);
      if (!catalogProduct) {
        return jsonResponse({ error: 'Product not found.' }, 404);
      }

      const item = buildItem(catalogProduct, shoptetSkuOverride || undefined);
      return jsonResponse({
        item,
      });
    }

    const items = filteredCatalog.map((product) => buildItem(product));

    return jsonResponse({
      inventory: {
        inventoryId: inventory.inventoryId,
        inventoryName: inventory.inventoryName,
        warehouseId: inventory.warehouseId,
      },
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load product stock status.';
    return jsonResponse({ error: message }, 500);
  }
});
