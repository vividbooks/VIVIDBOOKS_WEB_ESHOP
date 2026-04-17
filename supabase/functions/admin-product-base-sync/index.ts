import { requireAdminJwt } from '../_shared/admin-auth.ts';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-user-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function cleanString(value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '-' || normalized === '—') return null;
  return normalized;
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
  if (typeof product.priceAmount === 'number' && Number.isFinite(product.priceAmount)) {
    return Number(product.priceAmount.toFixed(2));
  }

  const normalized = String(product.price || '')
    .replace(/\s/g, '')
    .replace('Kč', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const adminGate = await requireAdminJwt(req);
  if (adminGate instanceof Response) {
    return adminGate;
  }

  try {
    const { product } = await req.json().catch(() => ({ product: null })) as { product?: SyncProductPayload | null };
    if (!product) {
      return jsonResponse({ error: 'Missing product payload.' }, 400);
    }

    const productId = cleanString(product.id);
    const productName = cleanString(product.name);
    const productType = cleanString(product.type);
    const apiToken = cleanString(Deno.env.get('BASECOM_API_TOKEN'));

    if (!productId || !productName) {
      return jsonResponse({ error: 'Produkt musí mít ID a název.' }, 400);
    }
    if (!apiToken) {
      return jsonResponse({ error: 'Missing BASECOM_API_TOKEN.' }, 500);
    }
    if (productType === 'online' || productType === 'license') {
      return jsonResponse({ error: 'Digitální produkty do Base.com skladu nesynchronizujeme.' }, 400);
    }

    const inventoriesResponse = await callBasecomApi(apiToken, 'getInventories', {});
    const firstInventory = pickFirstInventory(normalizeInventories(inventoriesResponse));
    if (!firstInventory) {
      return jsonResponse({ error: 'V Base.com nebyl nalezen žádný sklad.' }, 500);
    }

    const sku = pickSku(product);
    const ean = pickEan(product);
    const price = parsePrice(product);
    const existingBasecomProductId = cleanString(product.basecomProductId);
    const description = cleanString(product.description);
    const image = cleanString(product.image);

    const parameters: Record<string, unknown> = {
      inventory_id: Number.isNaN(Number(firstInventory.id)) ? firstInventory.id : Number(firstInventory.id),
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

    return jsonResponse({
      ok: true,
      inventoryId: firstInventory.id,
      inventoryName: firstInventory.name,
      basecomProductId: syncedProductId,
      basecomSku: sku,
      ean,
      price,
      warnings: syncResponse.warnings ?? null,
      mode: existingBasecomProductId ? 'updated' : 'created',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Base.com sync failed.';
    return jsonResponse({ error: message }, 500);
  }
});
