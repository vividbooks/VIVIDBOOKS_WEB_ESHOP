import { resolveAllowedOrigin } from '../_shared/cors.ts';
import postgres from 'npm:postgres';
import { requireAdminJwt } from '../_shared/admin-auth.ts';
import { computeEffectiveStockQuantity } from '../_shared/stock-quantity.ts';

type ProductSalesSummaryRow = {
  total_units_sold: number;
  total_orders: number;
  total_revenue: number;
  first_sold_at: string | null;
  last_sold_at: string | null;
};

type ProductSaleRow = {
  order_id: string;
  order_number: string;
  created_at: string;
  status: string;
  customer_name: string;
  school_name: string | null;
  city: string | null;
  zip: string | null;
  shipping_method: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type ProductDestinationRow = {
  school_name: string | null;
  customer_name: string;
  city: string | null;
  zip: string | null;
  shipping_method: string;
  total_units: number;
  order_count: number;
  last_sold_at: string | null;
};

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-user-access-token',
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

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

function normalizeLoose(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
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
    throw new Error(`Base.com HTTP ${response.status}: ${rawText.slice(0, 300)}`);
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

async function fetchStockSnapshot(params: {
  stockLookupId: string | null;
  productName: string | null;
  isbn: string | null;
  ean: string | null;
}) {
  const apiToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();
  if (!apiToken) {
    return {
      apiTokenWorks: false,
      inventoryId: null as string | null,
      inventoryName: null as string | null,
      warehouseId: null as string | null,
      lookupValue: params.stockLookupId,
      matchType: null as string | null,
      matched: false,
      quantity: null as number | null,
      error: 'Missing BASECOM_API_TOKEN.',
    };
  }

  try {
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
      ? stockResponse.products as Record<string, unknown>
      : {};
    const listProducts = listResponse.products && typeof listResponse.products === 'object'
      ? listResponse.products as Record<string, unknown>
      : {};

    const allProductIds = new Set([
      ...Object.keys(listProducts),
      ...Object.keys(stockProducts),
    ]);

    const candidates = Array.from(allProductIds).map((productId) => {
      const value = listProducts[productId];
      return {
        productId,
        ...(value && typeof value === 'object' ? value as Record<string, unknown> : {}),
      };
    });

    const lookupIdNorm = normalizeLoose(params.stockLookupId);
    const eanNorm = normalizeLoose(params.ean);
    const isbnNorm = normalizeLoose(params.isbn);
    const nameNorm = normalizeLoose(params.productName);

    let matchedCandidate: Record<string, unknown> | null = null;
    let matchType: string | null = null;

    if (lookupIdNorm) {
      matchedCandidate = candidates.find((item) =>
        normalizeLoose(String(item.productId)) === lookupIdNorm ||
        normalizeLoose(String(item.sku ?? '')) === lookupIdNorm ||
        normalizeLoose(String(item.ean ?? '')) === lookupIdNorm
      ) || null;
      if (matchedCandidate) matchType = 'lookup_id';
    }

    if (!matchedCandidate && (eanNorm || isbnNorm)) {
      matchedCandidate = candidates.find((item) => {
        const itemEan = normalizeLoose(String(item.ean ?? ''));
        return Boolean(itemEan) && (itemEan === eanNorm || itemEan === isbnNorm);
      }) || null;
      if (matchedCandidate) matchType = 'ean';
    }

    if (!matchedCandidate && nameNorm) {
      matchedCandidate = candidates.find((item) => normalizeLoose(String(item.name ?? '')) === nameNorm) || null;
      if (matchedCandidate) matchType = 'name';
    }

    const matchedProductId = matchedCandidate ? String(matchedCandidate.productId ?? '') : null;
    const matchedRecord = matchedProductId && stockProducts[matchedProductId] && typeof stockProducts[matchedProductId] === 'object'
      ? stockProducts[matchedProductId] as Record<string, unknown>
      : null;

    const inventoryProducts = candidates.map((item) => {
      const productId = String(item.productId ?? '');
      const stockRecord = productId && stockProducts[productId] && typeof stockProducts[productId] === 'object'
        ? stockProducts[productId] as Record<string, unknown>
        : null;
      return {
        sku: String(item.sku ?? stockRecord?.sku ?? productId ?? ''),
        productId,
        quantity: stockRecord
          ? parseWarehouseQuantity(
              stockRecord.quantity ?? stockRecord.stock ?? stockRecord.available ?? null,
              firstInventory.defaultWarehouse,
            )
          : null,
      };
    });

    const lookupSku = params.stockLookupId
      || (matchedCandidate ? String(matchedCandidate.sku ?? matchedCandidate.productId ?? '') : null);
    const effectiveStock = computeEffectiveStockQuantity(lookupSku, inventoryProducts);
    const quantity = effectiveStock.quantity;

    return {
      apiTokenWorks: true,
      inventoryId: firstInventory.id,
      inventoryName: firstInventory.name,
      warehouseId: firstInventory.defaultWarehouse,
      lookupValue: params.stockLookupId,
      matchType,
      matched: Boolean(matchedRecord) || quantity !== null,
      quantity,
      baseQuantity: effectiveStock.baseQuantity,
      packContributions: effectiveStock.packContributions,
      matchedProductId,
      matchedProductName: matchedCandidate ? String(matchedCandidate.name ?? '') : null,
      matchedProductEan: matchedCandidate ? String(matchedCandidate.ean ?? '') : null,
      matchedProductSku: matchedCandidate ? String(matchedCandidate.sku ?? '') : null,
      error: (matchedRecord || quantity !== null)
        ? null
        : 'Produkt nebyl ve skladových datech Base.com nalezen podle dostupných identifikátorů.',
    };
  } catch (error) {
    return {
      apiTokenWorks: false,
      inventoryId: null,
      inventoryName: null,
      warehouseId: null,
      lookupValue: params.stockLookupId,
      matchType: null,
      matched: false,
      quantity: null,
      matchedProductId: null,
      matchedProductName: null,
      matchedProductEan: null,
      matchedProductSku: null,
      error: error instanceof Error ? error.message : 'Base.com stock lookup failed.',
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  if (req.method !== 'GET') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  const adminGate = await requireAdminJwt(req);
  if (adminGate instanceof Response) {
    return adminGate;
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse(req, { error: 'Missing DATABASE_URL.' }, 500);
  }

  const url = new URL(req.url);
  const productId = (url.searchParams.get('productId') || '').trim();
  const productName = (url.searchParams.get('productName') || '').trim();
  const shoptetId = (url.searchParams.get('shoptetId') || '').trim();
  const isbn = (url.searchParams.get('isbn') || '').trim();
  const ean = (url.searchParams.get('ean') || '').trim();

  if (!productId) {
    return jsonResponse(req, { error: 'Missing productId.' }, 400);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const statusFilter = sql`and o.status not in ('failed', 'cancelled')`;

    const [summaryRows, salesRows, destinationRows, stock] = await Promise.all([
      sql<ProductSalesSummaryRow[]>`
        select
          coalesce(sum(oi.quantity), 0)::int as total_units_sold,
          count(distinct o.id)::int as total_orders,
          coalesce(sum(oi.total_price), 0)::int as total_revenue,
          min(o.created_at) as first_sold_at,
          max(o.created_at) as last_sold_at
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.product_id = ${productId}
        ${statusFilter}
      `,
      sql<ProductSaleRow[]>`
        select
          o.id as order_id,
          o.order_number,
          o.created_at,
          o.status,
          o.customer_name,
          o.school_name,
          o.city,
          o.zip,
          o.shipping_method,
          oi.quantity,
          oi.unit_price,
          oi.total_price
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.product_id = ${productId}
        ${statusFilter}
        order by o.created_at desc
        limit 100
      `,
      sql<ProductDestinationRow[]>`
        select
          nullif(max(o.school_name), '') as school_name,
          max(o.customer_name) as customer_name,
          nullif(max(o.city), '') as city,
          nullif(max(o.zip), '') as zip,
          max(o.shipping_method) as shipping_method,
          coalesce(sum(oi.quantity), 0)::int as total_units,
          count(distinct o.id)::int as order_count,
          max(o.created_at) as last_sold_at
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.product_id = ${productId}
        ${statusFilter}
        group by coalesce(nullif(o.school_name, ''), o.customer_name), coalesce(o.city, ''), coalesce(o.zip, '')
        order by total_units desc, last_sold_at desc
        limit 20
      `,
      fetchStockSnapshot({
        stockLookupId: shoptetId || null,
        productName: productName || null,
        isbn: isbn || null,
        ean: ean || null,
      }),
    ]);

    const summary = summaryRows[0] || {
      total_units_sold: 0,
      total_orders: 0,
      total_revenue: 0,
      first_sold_at: null,
      last_sold_at: null,
    };

    return jsonResponse(req, {
      product: {
        id: productId,
        name: productName || null,
        shoptetId: shoptetId || null,
      },
      stock,
      sales: {
        summary,
        destinations: destinationRows,
        history: salesRows,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load product commerce data.';
    return jsonResponse(req, { error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
