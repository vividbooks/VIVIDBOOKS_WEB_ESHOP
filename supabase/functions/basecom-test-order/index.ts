import { resolveAllowedOrigin } from '../_shared/cors.ts';
const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

type BasecomResponse = {
  status?: string;
  order_id?: number | string;
  error_message?: string;
  warnings?: unknown;
};

type BaseInventoryProduct = {
  productId: string;
  name: string;
  sku: string;
  ean: string;
};

type SampleProduct = {
  productId: string;
  shoptetId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
    },
  });
}

function amount(value: number) {
  return Number(value.toFixed(2));
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

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Base.com ${method} HTTP ${response.status}`);
  }
  if (data?.status !== 'SUCCESS') {
    throw new Error(`Base.com ${method} failed: ${data?.error_message || JSON.stringify(data)}`);
  }
  return data as Record<string, unknown>;
}

async function loadBaseInventory(apiToken: string) {
  const inventoriesResponse = await callBasecomApi(apiToken, 'getInventories', {});
  const inventories = Array.isArray(inventoriesResponse.inventories) ? inventoriesResponse.inventories as Record<string, unknown>[] : [];
  const firstInventory = inventories[0];
  if (!firstInventory) {
    throw new Error('No Base.com inventory found.');
  }

  const inventoryId = Number(firstInventory.inventory_id);
  const warehouses = Array.isArray(firstInventory.warehouses) ? firstInventory.warehouses as string[] : [];
  const defaultWarehouse = typeof firstInventory.default_warehouse === 'string' ? firstInventory.default_warehouse : warehouses[0] || '';
  const warehouseId = Number(String(defaultWarehouse).replace(/^bl_/, '')) || null;

  const listResponse = await callBasecomApi(apiToken, 'getInventoryProductsList', { inventory_id: inventoryId });
  const rawProducts = listResponse.products && typeof listResponse.products === 'object'
    ? listResponse.products as Record<string, Record<string, unknown>>
    : {};
  const products: BaseInventoryProduct[] = Object.entries(rawProducts).map(([productId, product]) => ({
    productId,
    name: String(product.name || ''),
    sku: String(product.sku || ''),
    ean: String(product.ean || ''),
  }));

  return {
    inventoryId,
    warehouseId,
    products,
  };
}

function resolveBaseInventoryProduct(
  inventory: { inventoryId: number; warehouseId: number | null; products: BaseInventoryProduct[] },
  sampleProduct: SampleProduct,
) {
  const products = inventory.products;

  const shoptetNorm = normalizeLoose(sampleProduct.shoptetId);
  const skuNorm = normalizeLoose(sampleProduct.sku);
  const nameNorm = normalizeLoose(sampleProduct.productName);

  const matched = products.find((item) =>
    (shoptetNorm && (normalizeLoose(item.productId) === shoptetNorm || normalizeLoose(item.sku) === shoptetNorm || normalizeLoose(item.ean) === shoptetNorm))
    || (skuNorm && (normalizeLoose(item.sku) === skuNorm || normalizeLoose(item.ean) === skuNorm))
    || (nameNorm && normalizeLoose(item.name) === nameNorm)
  );

  return {
    inventoryId: inventory.inventoryId,
    warehouseId: inventory.warehouseId,
    matchedProductId: matched?.productId || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  const apiToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();
  const orderStatusIdRaw = (Deno.env.get('BASECOM_ORDER_STATUS_ID') || '').trim();
  const customSourceIdRaw = (Deno.env.get('BASECOM_CUSTOM_SOURCE_ID') || '').trim();

  if (!apiToken || !orderStatusIdRaw || !customSourceIdRaw) {
    return jsonResponse(req, { error: 'Missing Base.com environment configuration.' }, 500);
  }

  const orderStatusId = Number.parseInt(orderStatusIdRaw, 10);
  const customSourceId = Number.parseInt(customSourceIdRaw, 10);
  if (!Number.isInteger(orderStatusId) || !Number.isInteger(customSourceId)) {
    return jsonResponse(req, { error: 'Invalid Base.com numeric environment configuration.' }, 500);
  }

  const now = new Date();
  const stamp = now.toISOString();
  const sampleProducts: SampleProduct[] = [
    {
      productId: '67152e59b2423ee7483174e7',
      shoptetId: 'PP1200',
      sku: ':978-80-909485-4-9',
      productName: 'Prvouka 1. ročník / 2. díl',
      quantity: 1,
      unitPrice: 75,
    },
    {
      productId: '683db71315eb4088767661ab',
      shoptetId: 'PM1200',
      sku: '978-80-909485-5-6',
      productName: 'Matematika 1. ročník / 2. díl',
      quantity: 2,
      unitPrice: 75,
    },
    {
      productId: '6978da93905234d001014e47',
      shoptetId: 'CJN3',
      sku: 'CJN3',
      productName: 'Písanka pro nevázané písmo / 3.díl',
      quantity: 1,
      unitPrice: 39,
    },
  ];
  const sampleCustomer = {
    fullName: 'Mgr. Jana Testovací',
    company: 'ZŠ Testovací škola',
    ico: '12345678',
    phone: '+420777000111',
    email: 'test+basecom@vividbooks.com',
    street: 'U Testu 15',
    city: 'Brno',
    postcode: '60200',
    countryCode: 'CZ',
  };
  const inventory = await loadBaseInventory(apiToken);
  const resolvedProducts = sampleProducts.map((sampleProduct) => ({
    ...sampleProduct,
    ...resolveBaseInventoryProduct(inventory, sampleProduct),
  }));

  const parameters: Record<string, unknown> = {
    order_status_id: orderStatusId,
    custom_source_id: customSourceId,
    date_add: Math.floor(now.getTime() / 1000),
    user_comments: 'TEST objednavka vytvorena z diagnosticke Edge Function. Obsahuje vyplnenou dorucovaci i fakturacni adresu.',
    admin_comments: `TEST ORDER FROM CURSOR ${stamp}`,
    phone: sampleCustomer.phone,
    email: sampleCustomer.email,
    user_login: sampleCustomer.email,
    currency: 'CZK',
    payment_method: 'Platba kartou',
    payment_method_cod: false,
    paid: true,
    delivery_method: 'DPD',
    delivery_price: amount(0),
    delivery_fullname: sampleCustomer.fullName,
    delivery_company: sampleCustomer.company,
    delivery_address: sampleCustomer.street,
    delivery_city: sampleCustomer.city,
    delivery_postcode: sampleCustomer.postcode,
    delivery_country_code: sampleCustomer.countryCode,
    invoice_fullname: sampleCustomer.fullName,
    invoice_company: sampleCustomer.company,
    invoice_nip: sampleCustomer.ico,
    invoice_address: sampleCustomer.street,
    invoice_city: sampleCustomer.city,
    invoice_postcode: sampleCustomer.postcode,
    invoice_country_code: sampleCustomer.countryCode,
    products: resolvedProducts.map((sampleProduct) => ({
      name: sampleProduct.productName,
      storage: sampleProduct.matchedProductId ? 'db' : undefined,
      storage_id: sampleProduct.matchedProductId ? 0 : undefined,
      warehouse_id: sampleProduct.matchedProductId ? sampleProduct.warehouseId ?? undefined : undefined,
      product_id: sampleProduct.matchedProductId || sampleProduct.shoptetId,
      sku: sampleProduct.sku,
      attributes: `Shoptet ID: ${sampleProduct.shoptetId}`,
      quantity: sampleProduct.quantity,
      price_brutto: amount(sampleProduct.unitPrice),
      tax_rate: 0,
    })),
  };

  const body = new URLSearchParams({
    method: 'addOrder',
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

  const data = await response.json().catch(() => ({} as BasecomResponse)) as BasecomResponse;

  if (!response.ok) {
    return jsonResponse(req, { error: `Base.com HTTP ${response.status}` }, 500);
  }

  if (data.status !== 'SUCCESS') {
    return jsonResponse(req, {
      error: data.error_message || JSON.stringify(data.warnings || data),
    }, 500);
  }

  return jsonResponse(req, {
    success: true,
    basecomOrderId: data.order_id ? String(data.order_id) : null,
    sentAt: stamp,
    sampleCustomer,
    sampleProducts: resolvedProducts,
    note: 'Test order was sent to Base.com.',
  });
});
