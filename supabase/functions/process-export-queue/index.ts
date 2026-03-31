import postgres from 'npm:postgres';
import { sendOrderEmail, type OrderEmailType } from '../_shared/order-email.ts';
import { upsertWorkflowStep } from '../_shared/order-monitoring.ts';

type ExportQueueRow = {
  id: string;
  order_id: string;
  service: string;
  retry_count: number;
  max_retries: number;
  payload: {
    emailType?: OrderEmailType;
  } | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  school_name: string | null;
  ico: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  shipping_method: string;
  shipping_price: number;
  pickup_point_id: string | null;
  pickup_point_name: string | null;
  payment_method: string;
  note: string | null;
  created_at: string;
  invoice_status: string | null;
};

type OrderItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
};

type CatalogProduct = {
  id: string;
  name?: string;
  isbn?: string | null;
  shoptetId?: string | null;
  basecomProductId?: string | null;
  basecomSku?: string | null;
  metadata?: {
    isbn?: string | null;
    ean?: string | null;
  } | null;
};

type BaseInventoryProduct = {
  productId: string;
  name: string;
  sku: string;
  ean: string;
};

type BasecomResponse = {
  status?: string;
  order_id?: number | string;
  error_message?: string;
  warnings?: unknown;
};

type IdokladTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type IdokladInvoiceResponse = {
  Id?: number | string;
  DocumentNumber?: string;
  data?: {
    Id?: number | string;
    DocumentNumber?: string;
  };
  Data?: {
    Id?: number | string;
    DocumentNumber?: string;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function idokladEnvInt(name: string, fallback: number): number {
  const raw = (Deno.env.get(name) || '').trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Hodnoty dle [iDoklad API v3](https://api.idoklad.cz/Help/v3/cs/index.html) / nastavení účtu — lze přepsat secrety. */
function getIdokladNumericSettings() {
  return {
    countryIdCz: idokladEnvInt('IDOKLAD_COUNTRY_ID', 2),
    paymentTypeCardId: idokladEnvInt('IDOKLAD_PAYMENT_TYPE_ID', 3),
    currencyIdCzk: idokladEnvInt('IDOKLAD_CURRENCY_ID', 1),
    priceTypeWithVat: idokladEnvInt('IDOKLAD_PRICE_TYPE_WITH_VAT', 1),
    vatRateReduced: idokladEnvInt('IDOKLAD_VAT_RATE_REDUCED', 2),
    vatRateStandard: idokladEnvInt('IDOKLAD_VAT_RATE_STANDARD', 1),
  };
}

let idokladAccessTokenCache: { token: string; expiresAt: number } | null = null;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

function amountInCzk(valueInHaler: number) {
  return Number((valueInHaler / 100).toFixed(2));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case 'card':
      return 'Platba kartou';
    case 'apple_pay':
      return 'Apple Pay';
    case 'google_pay':
      return 'Google Pay';
    case 'transfer':
      return 'Bankovní převod';
    default:
      return 'Platba kartou';
  }
}

function deliveryMethodLabel(method: string) {
  switch (method) {
    case 'dpd':
      return 'DPD';
    case 'zasilkovna':
      return 'Zásilkovna';
    case 'gls':
      return 'GLS';
    case 'ppl':
      return 'PPL';
    default:
      return method;
  }
}

async function loadCatalogProductMap() {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  if (!supabaseUrl) return new Map<string, CatalogProduct>();

  const functionKey = (
    Deno.env.get('PROJECT_PUBLIC_ANON_KEY')
    || Deno.env.get('PUBLIC_ANON_KEY')
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || Deno.env.get('SUPABASE_ANON_KEY')
    || ''
  ).trim();
  const response = await fetch(`${supabaseUrl}/functions/v1/make-server-93a20b6f/products`, {
    headers: {
      ...(functionKey ? { Authorization: `Bearer ${functionKey}`, apikey: functionKey } : {}),
    },
  });

  if (!response.ok) {
    console.warn(`[process-export-queue] Product catalog fetch failed with HTTP ${response.status}. Falling back to order data.`);
    return new Map<string, CatalogProduct>();
  }

  const data = await response.json().catch(() => ({ products: [] }));
  const products = Array.isArray(data?.products) ? data.products as CatalogProduct[] : [];
  return new Map(products.map((product) => [product.id, product]));
}

function chooseBasecomSku(product: CatalogProduct | undefined, orderItem: OrderItemRow) {
  const candidates = [
    product?.shoptetId,
    product?.basecomSku,
    product?.isbn,
    product?.metadata?.isbn,
    product?.metadata?.ean,
    orderItem.product_id,
  ];
  const picked = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return String(picked || orderItem.product_id).trim();
}

function chooseBasecomProductId(product: CatalogProduct | undefined, orderItem: OrderItemRow) {
  const candidates = [
    product?.basecomProductId,
    product?.shoptetId,
    orderItem.product_id,
  ];
  const picked = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return String(picked || orderItem.product_id).trim();
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

async function loadBaseInventoryMap(apiToken: string) {
  const inventoriesResponse = await callBasecomApi(apiToken, 'getInventories', {});
  const inventories = Array.isArray(inventoriesResponse.inventories) ? inventoriesResponse.inventories as Record<string, unknown>[] : [];
  const firstInventory = inventories[0];
  if (!firstInventory) {
    return {
      inventoryId: null as number | null,
      warehouseId: null as number | null,
      products: [] as BaseInventoryProduct[],
    };
  }

  const inventoryId = Number(firstInventory.inventory_id);
  const warehouses = Array.isArray(firstInventory.warehouses) ? firstInventory.warehouses as string[] : [];
  const defaultWarehouse = typeof firstInventory.default_warehouse === 'string' ? firstInventory.default_warehouse : warehouses[0] || '';
  const warehouseId = Number(String(defaultWarehouse).replace(/^bl_/, '')) || null;

  const listResponse = await callBasecomApi(apiToken, 'getInventoryProductsList', { inventory_id: inventoryId });
  const rawProducts = listResponse.products && typeof listResponse.products === 'object'
    ? listResponse.products as Record<string, Record<string, unknown>>
    : {};

  const products = Object.entries(rawProducts).map(([productId, product]) => ({
    productId,
    name: String(product.name || ''),
    sku: String(product.sku || ''),
    ean: String(product.ean || ''),
  }));

  return { inventoryId, warehouseId, products };
}

function matchBaseInventoryProduct(
  catalogProduct: CatalogProduct | undefined,
  orderItem: OrderItemRow,
  inventoryProducts: BaseInventoryProduct[],
) {
  const explicitBaseIdNorm = normalizeLoose(catalogProduct?.basecomProductId);
  const lookupIdNorm = normalizeLoose(catalogProduct?.shoptetId);
  const eanNorm = normalizeLoose(catalogProduct?.metadata?.ean);
  const isbnNorm = normalizeLoose(catalogProduct?.isbn || catalogProduct?.metadata?.isbn);
  const nameNorm = normalizeLoose(catalogProduct?.name || orderItem.product_name);

  let matched = inventoryProducts.find((item) =>
    explicitBaseIdNorm && normalizeLoose(item.productId) === explicitBaseIdNorm
  );

  if (!matched) {
    matched = inventoryProducts.find((item) =>
    lookupIdNorm && (
      normalizeLoose(item.productId) === lookupIdNorm ||
      normalizeLoose(item.sku) === lookupIdNorm ||
      normalizeLoose(item.ean) === lookupIdNorm
    )
    );
  }

  if (!matched && (eanNorm || isbnNorm)) {
    matched = inventoryProducts.find((item) => {
      const itemEan = normalizeLoose(item.ean);
      const itemSku = normalizeLoose(item.sku);
      return Boolean(eanNorm && (itemEan === eanNorm || itemSku === eanNorm))
        || Boolean(isbnNorm && (itemEan === isbnNorm || itemSku === isbnNorm));
    });
  }

  if (!matched && nameNorm) {
    matched = inventoryProducts.find((item) => normalizeLoose(item.name) === nameNorm);
  }

  return matched || null;
}

async function handleBasecomExport(sql: postgres.Sql, orderId: string) {
  const orderRows = await sql<OrderRow[]>`
    select
      id,
      order_number,
      status,
      customer_name,
      customer_email,
      customer_phone,
      school_name,
      ico,
      street,
      city,
      zip,
      shipping_method,
      shipping_price,
      pickup_point_id,
      pickup_point_name,
      payment_method,
      note,
      created_at,
      invoice_status
    from public.orders
    where id = ${orderId}::uuid
    limit 1
  `;

  const order = orderRows[0];
  if (!order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const orderItems = await sql<OrderItemRow[]>`
    select
      product_id,
      product_name,
      quantity,
      unit_price
    from public.order_items
    where order_id = ${orderId}::uuid
    order by id asc
  `;

  if (orderItems.length === 0) {
    throw new Error(`Order ${order.order_number} has no items.`);
  }

  const productMap = await loadCatalogProductMap();

  const apiToken = Deno.env.get('BASECOM_API_TOKEN');
  const orderStatusIdRaw = Deno.env.get('BASECOM_ORDER_STATUS_ID');
  const customSourceIdRaw = Deno.env.get('BASECOM_CUSTOM_SOURCE_ID');

  if (!apiToken || !orderStatusIdRaw || !customSourceIdRaw) {
    throw new Error('Missing Base.com environment configuration.');
  }

  const orderStatusId = Number.parseInt(orderStatusIdRaw, 10);
  const customSourceId = Number.parseInt(customSourceIdRaw, 10);

  if (!Number.isInteger(orderStatusId) || !Number.isInteger(customSourceId)) {
    throw new Error('Invalid Base.com numeric environment configuration.');
  }

  const baseInventory = await loadBaseInventoryMap(apiToken);

  const parameters: Record<string, unknown> = {
    order_status_id: orderStatusId,
    custom_source_id: customSourceId,
    date_add: Math.floor(new Date(order.created_at).getTime() / 1000),
    user_comments: order.note || '',
    admin_comments: `VB order: ${order.order_number}`,
    phone: order.customer_phone || '',
    email: order.customer_email,
    user_login: order.customer_email,
    currency: 'CZK',
    payment_method: paymentMethodLabel(order.payment_method),
    payment_method_cod: false,
    paid: true,
    delivery_method: deliveryMethodLabel(order.shipping_method),
    delivery_price: amountInCzk(order.shipping_price),
    delivery_fullname: order.customer_name,
    delivery_company: order.school_name || '',
    delivery_address: order.street || '',
    delivery_city: order.city || '',
    delivery_postcode: order.zip || '',
    delivery_country_code: 'CZ',
    invoice_fullname: order.customer_name,
    invoice_company: order.school_name || '',
    invoice_nip: order.ico || '',
    invoice_address: order.street || '',
    invoice_city: order.city || '',
    invoice_postcode: order.zip || '',
    invoice_country_code: 'CZ',
    products: orderItems.map((item) => {
      const product = productMap.get(item.product_id);
      const matchedBaseProduct = matchBaseInventoryProduct(product, item, baseInventory.products);
      return {
        name: item.product_name,
        storage: matchedBaseProduct ? 'db' : undefined,
        storage_id: matchedBaseProduct ? 0 : undefined,
        warehouse_id: matchedBaseProduct ? baseInventory.warehouseId ?? undefined : undefined,
        // Only send Base product_id when we have a real inventory match.
        product_id: matchedBaseProduct ? matchedBaseProduct.productId : undefined,
        sku: chooseBasecomSku(product, item),
        ean: product?.metadata?.ean || undefined,
        attributes: product?.shoptetId ? `Shoptet ID: ${product.shoptetId}` : undefined,
        quantity: item.quantity,
        price_brutto: amountInCzk(item.unit_price),
        tax_rate: 0,
      };
    }),
  };

  if (order.pickup_point_id) {
    parameters.delivery_point_id = order.pickup_point_id;
  }

  if (order.pickup_point_name) {
    parameters.delivery_point_name = order.pickup_point_name;
  }

  // Base.com rate limit is 100 req/min, which is comfortably above this worker's batch size of 10.
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
    throw new Error(`Base.com HTTP ${response.status}`);
  }

  if (data.status !== 'SUCCESS') {
    const details = data.error_message || JSON.stringify(data.warnings || data);
    throw new Error(`Base.com addOrder failed: ${details}`);
  }

  return {
    orderId: data.order_id ? String(data.order_id) : '',
    sourceOrderStatus: order.status,
  };
}

async function getIdokladAccessToken(forceRefresh = false) {
  if (!forceRefresh && idokladAccessTokenCache && idokladAccessTokenCache.expiresAt > Date.now()) {
    return idokladAccessTokenCache.token;
  }

  const clientId = Deno.env.get('IDOKLAD_CLIENT_ID');
  const clientSecret = Deno.env.get('IDOKLAD_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing iDoklad OAuth configuration.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'idoklad_api',
  });

  const response = await fetch('https://identity.idoklad.cz/server/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json().catch(() => ({} as IdokladTokenResponse & { error?: string; error_description?: string })) as IdokladTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token || !data.expires_in) {
    const hint = data.error_description || data.error || '';
    throw new Error(
      `iDoklad token fetch failed HTTP ${response.status}${hint ? `: ${hint}` : ''}`,
    );
  }

  idokladAccessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Math.max(60, data.expires_in - 60) * 1000),
  };

  return data.access_token;
}

function parseIdokladInvoiceResponse(data: IdokladInvoiceResponse) {
  const payload = data.Data ?? data.data ?? data;
  const invoiceId = payload?.Id;
  const documentNumber = payload?.DocumentNumber;

  if (!invoiceId || !documentNumber) {
    throw new Error(`iDoklad response missing invoice identifiers: ${JSON.stringify(data).slice(0, 400)}`);
  }

  return {
    invoiceId: String(invoiceId),
    documentNumber: String(documentNumber),
  };
}

async function handleIdokladExport(sql: postgres.Sql, orderId: string) {
  const orderRows = await sql<OrderRow[]>`
    select
      id,
      order_number,
      status,
      customer_name,
      customer_email,
      customer_phone,
      school_name,
      ico,
      street,
      city,
      zip,
      shipping_method,
      shipping_price,
      pickup_point_id,
      pickup_point_name,
      payment_method,
      note,
      created_at,
      invoice_status
    from public.orders
    where id = ${orderId}::uuid
    limit 1
  `;

  const order = orderRows[0];
  if (!order) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const orderItems = await sql<OrderItemRow[]>`
    select
      product_id,
      product_name,
      quantity,
      unit_price
    from public.order_items
    where order_id = ${orderId}::uuid
    order by id asc
  `;

  if (orderItems.length === 0) {
    throw new Error(`Order ${order.order_number} has no items.`);
  }

  const idok = getIdokladNumericSettings();
  const issueDate = new Date();
  const payload = {
    Description: `Objednávka ${order.order_number}`,
    PartnerAddress: {
      Name: order.customer_name,
      Street: order.street || '',
      City: order.city || '',
      PostalCode: order.zip || '',
      CountryId: idok.countryIdCz,
      IdentificationNumber: order.ico || '',
      Email: order.customer_email,
      Phone: order.customer_phone || '',
      CompanyName: order.school_name || '',
    },
    DateOfIssue: toIsoDate(issueDate),
    DateOfMaturity: toIsoDate(addDays(issueDate, 14)),
    DateOfTaxing: toIsoDate(issueDate),
    IsEet: false,
    PaymentTypeId: idok.paymentTypeCardId,
    CurrencyId: idok.currencyIdCzk,
    OrderNumber: order.order_number,
    Items: [
      ...orderItems.map((item) => ({
        Name: item.product_name,
        Amount: item.quantity,
        UnitPrice: amountInCzk(item.unit_price),
        PriceType: idok.priceTypeWithVat,
        VatRateType: idok.vatRateReduced,
      })),
      ...(order.shipping_price > 0
        ? [{
            Name: `Doprava — ${deliveryMethodLabel(order.shipping_method)}`,
            Amount: 1,
            UnitPrice: amountInCzk(order.shipping_price),
            PriceType: idok.priceTypeWithVat,
            VatRateType: idok.vatRateStandard,
          }]
        : []),
    ],
  };

  let token = await getIdokladAccessToken();
  let response = await fetch('https://api.idoklad.cz/v3/IssuedInvoices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    token = await getIdokladAccessToken(true);
    response = await fetch('https://api.idoklad.cz/v3/IssuedInvoices', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  const data = await response.json().catch(() => ({} as IdokladInvoiceResponse)) as IdokladInvoiceResponse;
  if (!response.ok) {
    throw new Error(`iDoklad HTTP ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const parsed = parseIdokladInvoiceResponse(data);
  return {
    invoiceId: parsed.invoiceId,
    documentNumber: parsed.documentNumber,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const queueItems = await sql<ExportQueueRow[]>`
      select
        id,
        order_id,
        service,
        retry_count,
        max_retries,
        payload
      from public.export_queue
      where status = 'pending'
        and (next_retry_at is null or next_retry_at <= now())
      order by created_at asc
      limit 10
    `;

    const summary = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };

    for (const queueItem of queueItems) {
      const claimedRows = await sql<{ id: string }[]>`
        update public.export_queue
        set status = 'processing'
        where id = ${queueItem.id}::uuid
          and status = 'pending'
        returning id
      `;

      if (claimedRows.length === 0) {
        summary.skipped += 1;
        continue;
      }

      summary.processed += 1;

      try {
        if (queueItem.service === 'basecom') {
          await upsertWorkflowStep(sql, {
            orderId: queueItem.order_id,
            stepKey: 'basecom_exported',
            status: 'running',
            attemptCount: queueItem.retry_count + 1,
            lastError: null,
            metadata: {
              queueItemId: queueItem.id,
              service: queueItem.service,
            },
          });
        }

        if (queueItem.service === 'idoklad') {
          await upsertWorkflowStep(sql, {
            orderId: queueItem.order_id,
            stepKey: 'idoklad_exported',
            status: 'running',
            attemptCount: queueItem.retry_count + 1,
            lastError: null,
            metadata: {
              queueItemId: queueItem.id,
              service: queueItem.service,
            },
          });
        }

        if (queueItem.service === 'email') {
          await upsertWorkflowStep(sql, {
            orderId: queueItem.order_id,
            stepKey: 'customer_email_sent',
            status: 'running',
            attemptCount: queueItem.retry_count + 1,
            lastError: null,
            metadata: {
              queueItemId: queueItem.id,
              service: queueItem.service,
              emailType: queueItem.payload?.emailType ?? null,
            },
          });
        }

        const orderStateRows = await sql<{ status: string }[]>`
          select status
          from public.orders
          where id = ${queueItem.order_id}::uuid
          limit 1
        `;
        const currentOrderStatus = orderStateRows[0]?.status ?? null;

        if (currentOrderStatus === 'cancelled' && ['basecom', 'idoklad'].includes(queueItem.service)) {
          await sql.begin(async (tx) => {
            await tx`
              update public.export_queue
              set
                status = 'done',
                completed_at = now(),
                last_error = null
              where id = ${queueItem.id}::uuid
            `;

            if (queueItem.service === 'basecom') {
              await tx`
                update public.orders
                set basecom_status = 'cancelled'
                where id = ${queueItem.order_id}::uuid
              `;
            }

            if (queueItem.service === 'idoklad') {
              await tx`
                update public.orders
                set invoice_status = 'cancelled'
                where id = ${queueItem.order_id}::uuid
              `;
            }

            if (queueItem.service === 'basecom') {
              await upsertWorkflowStep(tx, {
                orderId: queueItem.order_id,
                stepKey: 'basecom_exported',
                status: 'skipped',
                lastError: 'Order was cancelled before export.',
                metadata: {
                  queueItemId: queueItem.id,
                  service: queueItem.service,
                },
              });
            }

            if (queueItem.service === 'idoklad') {
              await upsertWorkflowStep(tx, {
                orderId: queueItem.order_id,
                stepKey: 'idoklad_exported',
                status: 'skipped',
                lastError: 'Order was cancelled before export.',
                metadata: {
                  queueItemId: queueItem.id,
                  service: queueItem.service,
                },
              });
            }

            await tx`
              insert into public.order_events (
                order_id,
                event_type,
                from_status,
                to_status,
                details,
                actor
              ) values (
                ${queueItem.order_id}::uuid,
                'export',
                ${currentOrderStatus},
                ${currentOrderStatus},
                ${JSON.stringify({
                  service: queueItem.service,
                  queueItemId: queueItem.id,
                  skipped: true,
                  reason: 'Order was cancelled before export.',
                })}::jsonb,
                'system'
              )
            `;
          });

          summary.skipped += 1;
          continue;
        }

        if (queueItem.service === 'basecom') {
          const result = await handleBasecomExport(sql, queueItem.order_id);

          await sql.begin(async (tx) => {
            await tx`
              update public.export_queue
              set
                status = 'done',
                completed_at = now(),
                last_error = null
              where id = ${queueItem.id}::uuid
            `;

            await tx`
              update public.orders
              set
                basecom_status = 'done',
                basecom_order_id = ${result.orderId},
                status = 'exported',
                retry_count = ${queueItem.retry_count}
              where id = ${queueItem.order_id}::uuid
            `;

            await tx`
              insert into public.order_events (
                order_id,
                event_type,
                from_status,
                to_status,
                details,
                actor
              ) values (
                ${queueItem.order_id}::uuid,
                'export',
                ${result.sourceOrderStatus},
                'exported',
                ${JSON.stringify({
                  service: 'basecom',
                  queueItemId: queueItem.id,
                  basecomOrderId: result.orderId,
                })}::jsonb,
                'system'
              )
            `;

            await upsertWorkflowStep(tx, {
              orderId: queueItem.order_id,
              stepKey: 'basecom_exported',
              status: 'done',
              attemptCount: queueItem.retry_count + 1,
              lastError: null,
              metadata: {
                queueItemId: queueItem.id,
                basecomOrderId: result.orderId,
              },
            });
          });

          summary.succeeded += 1;
          continue;
        }

        if (queueItem.service === 'idoklad') {
          const result = await handleIdokladExport(sql, queueItem.order_id);

          await sql.begin(async (tx) => {
            await tx`
              update public.export_queue
              set
                status = 'done',
                completed_at = now(),
                last_error = null
              where id = ${queueItem.id}::uuid
            `;

            await tx`
              update public.orders
              set
                invoice_status = 'done',
                invoice_number = ${result.documentNumber}
              where id = ${queueItem.order_id}::uuid
            `;

            await tx`
              insert into public.order_events (
                order_id,
                event_type,
                from_status,
                to_status,
                details,
                actor
              ) values (
                ${queueItem.order_id}::uuid,
                'export',
                null,
                null,
                ${JSON.stringify({
                  service: 'idoklad',
                  queueItemId: queueItem.id,
                  invoiceId: result.invoiceId,
                  documentNumber: result.documentNumber,
                })}::jsonb,
                'system'
              )
            `;

            await upsertWorkflowStep(tx, {
              orderId: queueItem.order_id,
              stepKey: 'idoklad_exported',
              status: 'done',
              attemptCount: queueItem.retry_count + 1,
              lastError: null,
              metadata: {
                queueItemId: queueItem.id,
                invoiceId: result.invoiceId,
                documentNumber: result.documentNumber,
              },
            });
          });

          summary.succeeded += 1;
          continue;
        }

        if (queueItem.service === 'email') {
          const emailType = queueItem.payload?.emailType;
          if (!emailType) {
            throw new Error('Missing emailType in email queue payload.');
          }

          await sendOrderEmail(sql, {
            orderId: queueItem.order_id,
            emailType,
          });

          await sql.begin(async (tx) => {
            await tx`
              update public.export_queue
              set
                status = 'done',
                completed_at = now(),
                last_error = null
              where id = ${queueItem.id}::uuid
            `;

            await tx`
              insert into public.order_events (
                order_id,
                event_type,
                from_status,
                to_status,
                details,
                actor
              ) values (
                ${queueItem.order_id}::uuid,
                'email',
                null,
                null,
                ${JSON.stringify({
                  service: 'email',
                  emailType,
                  queueItemId: queueItem.id,
                })}::jsonb,
                'system'
              )
            `;

            await upsertWorkflowStep(tx, {
              orderId: queueItem.order_id,
              stepKey: 'customer_email_sent',
              status: 'done',
              attemptCount: queueItem.retry_count + 1,
              lastError: null,
              metadata: {
                queueItemId: queueItem.id,
                emailType,
              },
            });
          });

          summary.succeeded += 1;
          continue;
        }

        throw new Error(`Unsupported export service: ${queueItem.service}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown export error.';
        const nextRetryCount = queueItem.retry_count + 1;
        const shouldFail = nextRetryCount >= queueItem.max_retries;
        const backoffMinutes = 2 ** nextRetryCount;

        await sql.begin(async (tx) => {
          const orderRows = await tx<{ status: string }[]>`
            select status
            from public.orders
            where id = ${queueItem.order_id}::uuid
            limit 1
          `;

          const previousStatus = orderRows[0]?.status ?? null;

          await tx`
            update public.export_queue
            set
              status = ${shouldFail ? 'failed' : 'pending'},
              retry_count = ${nextRetryCount},
              last_error = ${message},
              next_retry_at = ${shouldFail ? null : new Date(Date.now() + (backoffMinutes * 60 * 1000)).toISOString()},
              completed_at = ${shouldFail ? new Date().toISOString() : null}
            where id = ${queueItem.id}::uuid
          `;

          if (queueItem.service === 'basecom') {
            await tx`
              update public.orders
              set
                basecom_status = ${shouldFail ? 'failed' : 'pending'},
                status = ${shouldFail ? 'failed' : 'paid'},
                retry_count = ${nextRetryCount}
              where id = ${queueItem.order_id}::uuid
            `;

            await upsertWorkflowStep(tx, {
              orderId: queueItem.order_id,
              stepKey: 'basecom_exported',
              status: shouldFail ? 'failed' : 'pending',
              attemptCount: nextRetryCount,
              lastError: message,
              metadata: {
                queueItemId: queueItem.id,
                retryCount: nextRetryCount,
                maxRetries: queueItem.max_retries,
                nextRetryInMinutes: shouldFail ? null : backoffMinutes,
              },
            });
          }

          if (queueItem.service === 'idoklad') {
            await tx`
              update public.orders
              set
                invoice_status = ${shouldFail ? 'failed' : 'pending'}
              where id = ${queueItem.order_id}::uuid
            `;

            await upsertWorkflowStep(tx, {
              orderId: queueItem.order_id,
              stepKey: 'idoklad_exported',
              status: shouldFail ? 'failed' : 'pending',
              attemptCount: nextRetryCount,
              lastError: message,
              metadata: {
                queueItemId: queueItem.id,
                retryCount: nextRetryCount,
                maxRetries: queueItem.max_retries,
                nextRetryInMinutes: shouldFail ? null : backoffMinutes,
              },
            });
          }

          if (queueItem.service === 'email') {
            await upsertWorkflowStep(tx, {
              orderId: queueItem.order_id,
              stepKey: 'customer_email_sent',
              status: shouldFail ? 'failed' : 'pending',
              attemptCount: nextRetryCount,
              lastError: message,
              metadata: {
                queueItemId: queueItem.id,
                retryCount: nextRetryCount,
                maxRetries: queueItem.max_retries,
                nextRetryInMinutes: shouldFail ? null : backoffMinutes,
                emailType: queueItem.payload?.emailType ?? null,
              },
            });
          }

          await tx`
            insert into public.order_events (
              order_id,
              event_type,
              from_status,
              to_status,
              details,
              actor
            ) values (
              ${queueItem.order_id}::uuid,
              ${queueItem.service === 'email' ? 'email' : 'export'},
              ${previousStatus},
              ${queueItem.service === 'basecom' ? (shouldFail ? 'failed' : 'paid') : null},
              ${JSON.stringify({
                service: queueItem.service,
                queueItemId: queueItem.id,
                retryCount: nextRetryCount,
                maxRetries: queueItem.max_retries,
                error: message,
                nextRetryInMinutes: shouldFail ? null : backoffMinutes,
              })}::jsonb,
              'system'
            )
          `;
        });

        summary.failed += 1;
      }
    }

    return jsonResponse(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Queue processing failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
