import { resolveAllowedOrigin } from '../_shared/cors.ts';
import { requireAdminJwt } from '../_shared/admin-auth.ts';
import { parsePriceTextToKc } from '../_shared/product-price.ts';

type SyncProductPayload = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  price?: string | number | null;
  priceAmount?: number | null;
  description?: string | null;
  image?: string | null;
  isbn?: string | null;
  shoptetId?: string | null;
  basecomProductId?: string | null;
  basecomSku?: string | null;
  metadata?: {
    isbn?: string | null;
    ean?: string | null;
  } | null;
};

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-user-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function cleanString(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '-' || normalized === '—') return null;
  return normalized;
}

/** Volné porovnání identifikátorů (SKU/EAN/název) — bez diakritiky, mezer a interpunkce. */
function normalizeLoose(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
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
  return {
    id: String(inventoryId),
    name: typeof record.name === 'string' ? record.name : typeof record.title === 'string' ? record.title : null,
    defaultPriceGroup: record.default_price_group !== undefined && record.default_price_group !== null
      ? String(record.default_price_group)
      : null,
  };
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

type InventoryCandidate = {
  productId: string;
  sku: string;
  ean: string;
  name: string;
};

/**
 * Načte katalog skladu z Base.com (getInventoryProductsList) jako seznam kandidátů
 * pro párování. Pozn.: API stránkuje po 1000 produktech; pro větší katalog je nutné
 * dotáhnout další stránky přes `page`. Vividbooks katalog je pod limitem.
 */
async function fetchInventoryCandidates(apiToken: string, inventoryId: string | number): Promise<InventoryCandidate[]> {
  const listResponse = await callBasecomApi(apiToken, 'getInventoryProductsList', {
    inventory_id: inventoryId,
  });
  const products = listResponse.products && typeof listResponse.products === 'object'
    ? listResponse.products as Record<string, unknown>
    : {};

  return Object.entries(products).map(([productId, value]) => {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
      productId: String((record.id ?? record.product_id ?? productId) || ''),
      sku: String(record.sku ?? ''),
      ean: String(record.ean ?? ''),
      name: String(record.name ?? record.text_fields_name ?? ''),
    };
  });
}

type MatchResult = {
  productId: string;
  matchType: 'sku' | 'ean' | 'name';
  duplicateProductIds: string[];
};

/**
 * Najde existující produkt ve skladu podle žebříčku SKU → EAN → název.
 * - SKU a EAN jsou spolehlivé; použijí se vždy, když sedí.
 * - Název je záložní a použije se JEN tehdy, když sedí právě jeden produkt
 *   (aby se omylem nespároval špatný záznam).
 * `duplicateProductIds` = všechny další shody (indikace už existujících duplicit ve skladu).
 */
function matchExistingProduct(
  candidates: InventoryCandidate[],
  keys: { sku: string | null; ean: string | null; name: string | null },
): MatchResult | null {
  const skuNorm = normalizeLoose(keys.sku);
  const eanNorm = normalizeLoose(keys.ean);
  const nameNorm = normalizeLoose(keys.name);

  if (skuNorm) {
    const bySku = candidates.filter((item) =>
      normalizeLoose(item.sku) === skuNorm ||
      normalizeLoose(item.productId) === skuNorm
    );
    if (bySku.length > 0) {
      return {
        productId: bySku[0].productId,
        matchType: 'sku',
        duplicateProductIds: bySku.slice(1).map((c) => c.productId),
      };
    }
  }

  if (eanNorm) {
    const byEan = candidates.filter((item) => Boolean(normalizeLoose(item.ean)) && normalizeLoose(item.ean) === eanNorm);
    if (byEan.length > 0) {
      return {
        productId: byEan[0].productId,
        matchType: 'ean',
        duplicateProductIds: byEan.slice(1).map((c) => c.productId),
      };
    }
  }

  if (nameNorm) {
    const byName = candidates.filter((item) => normalizeLoose(item.name) === nameNorm);
    // Podle názvu párujeme jen při jednoznačné shodě.
    if (byName.length === 1) {
      return { productId: byName[0].productId, matchType: 'name', duplicateProductIds: [] };
    }
  }

  return null;
}

async function addOrUpdateInventoryProduct(
  apiToken: string,
  parameters: Record<string, unknown>,
  existingBasecomProductId: string | null,
) {
  try {
    return await callBasecomApi(apiToken, 'addInventoryProduct', parameters);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      existingBasecomProductId
      && message.includes('No product with ID')
    ) {
      const retryParameters = { ...parameters };
      delete retryParameters.product_id;
      return await callBasecomApi(apiToken, 'addInventoryProduct', retryParameters);
    }
    throw error;
  }
}

function pickSku(product: SyncProductPayload) {
  const candidates = [
    cleanString(product.shoptetId),
    cleanString(product.basecomSku),
    cleanString(product.isbn),
    cleanString(product.metadata?.isbn),
    cleanString(product.metadata?.ean),
    cleanString(product.id),
  ];
  return candidates.find(Boolean) || null;
}

function pickEan(product: SyncProductPayload) {
  const candidates = [
    cleanString(product.metadata?.ean),
    cleanString(product.isbn),
    cleanString(product.metadata?.isbn),
  ];
  return candidates.find(Boolean) || null;
}

function parsePrice(product: SyncProductPayload) {
  const fromPrice = parsePriceTextToKc(product.price);
  if (fromPrice !== null) return Number(fromPrice.toFixed(2));

  if (typeof product.priceAmount === 'number' && Number.isFinite(product.priceAmount)) {
    return Number(product.priceAmount.toFixed(2));
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  const adminGate = await requireAdminJwt(req);
  if (adminGate instanceof Response) {
    return adminGate;
  }

  try {
    const { product } = await req.json().catch(() => ({ product: null })) as { product?: SyncProductPayload | null };
    if (!product) {
      return jsonResponse(req, { error: 'Missing product payload.' }, 400);
    }

    const productId = cleanString(product.id);
    const productName = cleanString(product.name);
    const productType = cleanString(product.type);
    const apiToken = cleanString(Deno.env.get('BASECOM_API_TOKEN'));

    if (!productId || !productName) {
      return jsonResponse(req, { error: 'Produkt musí mít ID a název.' }, 400);
    }
    if (!apiToken) {
      return jsonResponse(req, { error: 'Missing BASECOM_API_TOKEN.' }, 500);
    }
    if (productType === 'online' || productType === 'license') {
      return jsonResponse(req, { error: 'Digitální produkty do Base.com skladu nesynchronizujeme.' }, 400);
    }

    const inventoriesResponse = await callBasecomApi(apiToken, 'getInventories', {});
    const firstInventory = pickFirstInventory(normalizeInventories(inventoriesResponse));
    if (!firstInventory) {
      return jsonResponse(req, { error: 'V Base.com nebyl nalezen žádný sklad.' }, 500);
    }
    const inventoryIdParam = Number.isNaN(Number(firstInventory.id)) ? firstInventory.id : Number(firstInventory.id);

    const sku = pickSku(product);
    const ean = pickEan(product);
    const price = parsePrice(product);
    const description = cleanString(product.description);
    const image = cleanString(product.image);

    // --- Kontrola proti skladu: zabránit duplicitám ---------------------------
    // Před založením vždy prohledáme katalog skladu (SKU → EAN → název) a když
    // produkt už existuje, místo vytváření ho aktualizujeme.
    let existingBasecomProductId = cleanString(product.basecomProductId);
    let matchType: 'stored_id' | 'sku' | 'ean' | 'name' | null = existingBasecomProductId ? 'stored_id' : null;
    let duplicateProductIds: string[] = [];

    if (!existingBasecomProductId) {
      const candidates = await fetchInventoryCandidates(apiToken, inventoryIdParam);
      const match = matchExistingProduct(candidates, { sku, ean, name: productName });
      if (match) {
        existingBasecomProductId = match.productId;
        matchType = match.matchType;
        duplicateProductIds = match.duplicateProductIds;
      }
    }
    // -------------------------------------------------------------------------

    const parameters: Record<string, unknown> = {
      inventory_id: inventoryIdParam,
      is_bundle: false,
      sku: sku || undefined,
      ean: ean || undefined,
      text_fields: {
        name: productName,
        ...(description ? { description } : {}),
      },
      ...(price !== null && firstInventory.defaultPriceGroup
        ? { prices: { [firstInventory.defaultPriceGroup]: price } }
        : {}),
      ...(existingBasecomProductId ? { product_id: existingBasecomProductId } : {}),
      ...(image && /^https?:\/\//i.test(image) ? { images: { 0: `url:${image}` } } : {}),
    };

    const syncResponse = await addOrUpdateInventoryProduct(apiToken, parameters, existingBasecomProductId);
    const syncedProductId = cleanString(syncResponse.product_id) || existingBasecomProductId;

    return jsonResponse(req, {
      ok: true,
      inventoryId: firstInventory.id,
      inventoryName: firstInventory.name,
      basecomProductId: syncedProductId,
      basecomSku: sku,
      ean,
      price,
      warnings: syncResponse.warnings ?? null,
      // 'created' jen když jsme nic nenašli; jinak 'updated' + jak jsme spárovali.
      mode: existingBasecomProductId ? 'updated' : 'created',
      matchType,
      // Neprázdné = ve skladu jsou další záznamy se stejným SKU/EAN (existující duplicity k úklidu).
      duplicateProductIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Base.com sync failed.';
    return jsonResponse(req, { error: message }, 500);
  }
});
