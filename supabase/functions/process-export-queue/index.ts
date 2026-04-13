import postgres from 'npm:postgres';
import { idokladSdkHeaders, idokladSdkPostJsonHeaders } from '../_shared/idoklad-sdk-headers.ts';
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
  payment_status: string | null;
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
  pipedrive_deal_id: string | null;
  school_inquiry: unknown | null;
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

function idokladEnvBool(name: string, fallback: boolean): boolean {
  const raw = (Deno.env.get(name) || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  return fallback;
}

/** `DocumentType.IssuedInvoice` v iDoklad API — jen tyto řady jdou na `POST IssuedInvoices`. */
const IDOKLAD_DOC_TYPE_ISSUED_INVOICE = 0;

function normalizeIdokladSequenceName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Formát čísla dokladu v iDokladu (pole `NumberFormat` u řady) — výchozí výběr řady bez křehkého párování podle názvu. */
const IDOKLAD_ISSUED_INVOICE_NUMBER_FORMAT = '07{RR}{NNNN}';

/** Cache na běh instance (jméno → ID), ať se seznam nečte u každé faktury. */
let idokladNumericSequenceNameCache: { name: string; id: number } | null = null;
/** Cache pro výchozí řadu podle `NumberFormat`. */
let idokladNumericSequenceFormatCache: { format: string; id: number } | null = null;

function parseNumericSequencesItems(body: Record<string, unknown>): unknown[] {
  const dataBlock = (body.Data ?? body.data) as Record<string, unknown> | undefined;
  const items = dataBlock?.Items ?? dataBlock?.items ?? body.Items ?? body.items;
  return Array.isArray(items) ? items : [];
}

/** Primárně `IDOKLAD_NUMERIC_SEQUENCE_ID`, jinak `IDOKLAD_NUMERIC_SEQUENCE_NAME`, jinak řada s `NumberFormat` = `07{RR}{NNNN}`. Vrací i token po případném refreshi (401). */
async function resolveIdokladNumericSequenceId(
  tokenIn: string,
): Promise<{ numericSequenceId: number | undefined; token: string }> {
  let token = tokenIn;
  const idRaw = (Deno.env.get('IDOKLAD_NUMERIC_SEQUENCE_ID') || '').trim();
  if (idRaw) {
    const n = Number.parseInt(idRaw, 10);
    return {
      numericSequenceId: Number.isFinite(n) ? n : undefined,
      token,
    };
  }
  const nameRaw = (Deno.env.get('IDOKLAD_NUMERIC_SEQUENCE_NAME') || '').trim();
  const targetFormat = IDOKLAD_ISSUED_INVOICE_NUMBER_FORMAT.trim();

  if (nameRaw) {
    const cachedSeq = idokladNumericSequenceNameCache;
    if (cachedSeq && cachedSeq.name === nameRaw) {
      return { numericSequenceId: cachedSeq.id, token };
    }
  } else {
    const cachedFmt = idokladNumericSequenceFormatCache;
    if (cachedFmt && cachedFmt.format === targetFormat) {
      return { numericSequenceId: cachedFmt.id, token };
    }
  }

  const targetNorm = nameRaw ? normalizeIdokladSequenceName(nameRaw) : '';
  const matches: Array<{ id: number; year: number }> = [];
  let page = 1;
  const pageSize = 100;

  while (page <= 100) {
    const url = new URL('https://api.idoklad.cz/v3/NumericSequences');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));

    let res = await fetch(url.toString(), {
      headers: idokladSdkHeaders(token),
    });
    if (res.status === 401) {
      token = await getIdokladAccessToken(true);
      res = await fetch(url.toString(), {
        headers: idokladSdkHeaders(token),
      });
    }

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `iDoklad NumericSequences HTTP ${res.status}: ${JSON.stringify(body).slice(0, 400)}`,
      );
    }

    const items = parseNumericSequencesItems(body);
    for (const raw of items) {
      const row = raw as Record<string, unknown>;
      const docType = Number(row.DocumentType ?? row.documentType ?? -1);
      if (docType !== IDOKLAD_DOC_TYPE_ISSUED_INVOICE) continue;
      const id = Number(row.Id ?? row.id);
      const year = Number(row.Year ?? row.year ?? 0);
      if (!Number.isFinite(id)) continue;

      if (nameRaw) {
        const name = String(row.Name ?? row.name ?? '');
        if (normalizeIdokladSequenceName(name) !== targetNorm) continue;
      } else {
        const numberFormat = String(row.NumberFormat ?? row.numberFormat ?? '').trim();
        if (numberFormat !== targetFormat) continue;
      }

      matches.push({ id, year: Number.isFinite(year) ? year : 0 });
    }

    const dataBlock = (body.Data ?? body.data) as Record<string, unknown> | undefined;
    const totalPages = Number(dataBlock?.TotalPages ?? dataBlock?.totalPages ?? 1);
    if (items.length < pageSize || page >= totalPages) break;
    page += 1;
  }

  if (matches.length === 0) {
    const hint = nameRaw
      ? `název „${nameRaw}“`
      : `NumberFormat „${targetFormat}“`;
    throw new Error(
      `iDoklad: číselná řada pro vydané faktury nenalezena (${hint}). Ověřte Nastavení → Číselné řady.`,
    );
  }

  const y = new Date().getFullYear();
  const chosen = matches.find((m) => m.year === y)
    ?? [...matches].sort((a, b) => b.year - a.year)[0];

  if (nameRaw) {
    idokladNumericSequenceNameCache = { name: nameRaw, id: chosen.id };
  } else {
    idokladNumericSequenceFormatCache = { format: targetFormat, id: chosen.id };
  }
  return { numericSequenceId: chosen.id, token };
}

/** Hodnoty dle [iDoklad API v3](https://api.idoklad.cz/Help/v3/cs/index.html) / nastavení účtu — lze přepsat secrety. */
/**
 * ID způsobu úhrady v iDokladu (Nastavení → Způsoby úhrady). Výchozí `3` často odpovídá hotovosti —
 * pro Stripe platby kartou nastavte `IDOKLAD_PAYMENT_OPTION_ID_CARD` na ID „karta / online“ z iDokladu.
 */
function resolveIdokladPaymentOptionId(order: { payment_method: string }): number {
  const fallback = idokladEnvInt(
    'IDOKLAD_PAYMENT_OPTION_ID',
    idokladEnvInt('IDOKLAD_PAYMENT_TYPE_ID', 3),
  );
  const cardLike = ['card', 'apple_pay', 'google_pay'].includes(order.payment_method);
  if (cardLike) {
    const raw = (Deno.env.get('IDOKLAD_PAYMENT_OPTION_ID_CARD') || '').trim();
    if (raw) {
      const n = Number.parseInt(raw, 10);
      if (Number.isInteger(n)) return n;
    }
    return fallback;
  }
  if (order.payment_method === 'transfer') {
    const raw = (Deno.env.get('IDOKLAD_PAYMENT_OPTION_ID_TRANSFER') || '').trim();
    if (raw) {
      const n = Number.parseInt(raw, 10);
      if (Number.isInteger(n)) return n;
    }
  }
  return fallback;
}

function getIdokladNumericSettings() {
  return {
    countryIdCz: idokladEnvInt('IDOKLAD_COUNTRY_ID', 2),
    /** Na faktuře je `PaymentOptionId` (Způsob úhrady), ne starší `PaymentTypeId`. Fallback na `IDOKLAD_PAYMENT_TYPE_ID` kvůli existujícím secretům. */
    paymentOptionId: idokladEnvInt(
      'IDOKLAD_PAYMENT_OPTION_ID',
      idokladEnvInt('IDOKLAD_PAYMENT_TYPE_ID', 3),
    ),
    currencyIdCzk: idokladEnvInt('IDOKLAD_CURRENCY_ID', 1),
    priceTypeWithVat: idokladEnvInt('IDOKLAD_PRICE_TYPE_WITH_VAT', 1),
    vatRateReduced: idokladEnvInt('IDOKLAD_VAT_RATE_REDUCED', 2),
    vatRateStandard: idokladEnvInt('IDOKLAD_VAT_RATE_STANDARD', 1),
    /** „Zahrnout do DP“ — u faktury je povinné `IsIncomeTax`. */
    isIncomeTax: idokladEnvBool('IDOKLAD_IS_INCOME_TAX', true),
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

function checkoutSchoolInquiryIsPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

/** Objednávka ze školního formuláře na webu (/objednat), ne z importu Pipedrivu. */
function isSchoolSelfServiceEshopOrder(row: Pick<OrderRow, 'pipedrive_deal_id' | 'school_inquiry' | 'note'>): boolean {
  const pd = String(row.pipedrive_deal_id || '').trim();
  if (pd.length > 0) return false;
  if (checkoutSchoolInquiryIsPresent(row.school_inquiry)) return true;
  const note = row.note?.trim();
  if (!note) return false;
  try {
    const parsed = JSON.parse(note) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return false;
    const si = parsed.schoolInquiry;
    return si != null && typeof si === 'object' && !Array.isArray(si);
  } catch {
    return false;
  }
}

function resolveBasecomOrderStatusId(order: OrderRow): number {
  const defaultRaw = Deno.env.get('BASECOM_ORDER_STATUS_ID');
  const schoolRaw = (Deno.env.get('BASECOM_ORDER_STATUS_ID_SCHOOL_ESHOP') || '').trim();
  const defaultId = Number.parseInt(defaultRaw || '', 10);
  if (!Number.isInteger(defaultId)) {
    throw new Error('Invalid BASECOM_ORDER_STATUS_ID.');
  }
  if (!schoolRaw || !isSchoolSelfServiceEshopOrder(order)) {
    return defaultId;
  }
  const schoolId = Number.parseInt(schoolRaw, 10);
  return Number.isInteger(schoolId) ? schoolId : defaultId;
}

async function handleBasecomExport(sql: postgres.Sql, orderId: string) {
  const orderRows = await sql<OrderRow[]>`
    select
      o.id,
      o.order_number,
      o.status,
      o.payment_status,
      o.customer_name,
      o.customer_email,
      o.customer_phone,
      o.school_name,
      o.ico,
      o.street,
      o.city,
      o.zip,
      o.shipping_method,
      o.shipping_price,
      o.pickup_point_id,
      o.pickup_point_name,
      o.payment_method,
      o.note,
      o.created_at,
      o.invoice_status,
      o.pipedrive_deal_id,
      cs.school_inquiry as school_inquiry
    from public.orders o
    left join public.checkout_sessions cs on cs.id = o.checkout_session_id
    where o.id = ${orderId}::uuid
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
  const customSourceIdRaw = Deno.env.get('BASECOM_CUSTOM_SOURCE_ID');

  if (!apiToken || !customSourceIdRaw) {
    throw new Error('Missing Base.com environment configuration.');
  }

  const orderStatusId = resolveBasecomOrderStatusId(order);
  const customSourceId = Number.parseInt(customSourceIdRaw, 10);

  if (!Number.isInteger(customSourceId)) {
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

/**
 * Označí vydanou fakturu jako plně uhrazenou (PaymentStatus = Uhrazeno). Samotné `DateOfPayment` v POST IssuedInvoices
 * často nestačí — v UI zůstane „neuhrazeno“, dokud neexistuje záznam platby (viz IdokladSdk IssuedDocumentPaymentClient.FullyPay).
 */
async function idokladFullyPayInvoice(
  tokenIn: string,
  invoiceNumericId: string,
  dateOfPaymentYmd: string,
): Promise<string> {
  let token = tokenIn;
  const id = invoiceNumericId.trim();
  if (!id) {
    throw new Error('iDoklad FullyPay: missing invoice id.');
  }
  const url = new URL(`https://api.idoklad.cz/v3/IssuedDocumentPayments/FullyPay/${encodeURIComponent(id)}`);
  url.searchParams.set('dateOfPayment', dateOfPaymentYmd);
  let res = await fetch(url.toString(), {
    method: 'PUT',
    headers: idokladSdkHeaders(token),
  });
  if (res.status === 401) {
    token = await getIdokladAccessToken(true);
    res = await fetch(url.toString(), {
      method: 'PUT',
      headers: idokladSdkHeaders(token),
    });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`iDoklad FullyPay HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return token;
}

function parseIdokladInvoiceResponse(data: IdokladInvoiceResponse) {
  const payload = (data.Data ?? data.data ?? data) as Record<string, unknown> | undefined;
  const invoiceId = payload?.Id ?? payload?.id;
  const documentNumber = payload?.DocumentNumber ?? payload?.documentNumber;

  if (invoiceId === undefined || invoiceId === null || !documentNumber) {
    throw new Error(`iDoklad response missing invoice identifiers: ${JSON.stringify(data).slice(0, 400)}`);
  }

  return {
    invoiceId: String(invoiceId),
    documentNumber: String(documentNumber),
  };
}

/** Další pořadové číslo v řadě — `GET /v3/NumericSequences/DocumentNumbers/0` (IssuedInvoice = 0). */
async function fetchIdokladNextDocumentSerial(
  tokenIn: string,
  numericSequenceId: number,
  issueIso: string,
): Promise<{ documentSerialNumber: number; token: string }> {
  let token = tokenIn;
  const url = new URL('https://api.idoklad.cz/v3/NumericSequences/DocumentNumbers/0');
  url.searchParams.set('date', issueIso);
  url.searchParams.set('numericSequenceId', String(numericSequenceId));

  let res = await fetch(url.toString(), {
    headers: idokladSdkHeaders(token),
  });
  if (res.status === 401) {
    token = await getIdokladAccessToken(true);
    res = await fetch(url.toString(), {
      headers: idokladSdkHeaders(token),
    });
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `iDoklad DocumentNumbers HTTP ${res.status}: ${JSON.stringify(body).slice(0, 400)}`,
    );
  }
  const data = (body.Data ?? body.data) as Record<string, unknown> | undefined;
  const unique = (data?.Unique ?? data?.unique) as Record<string, unknown> | undefined;
  const custom = (data?.Custom ?? data?.custom) as Record<string, unknown> | undefined;
  const serial = unique?.DocumentSerialNumber ?? unique?.documentSerialNumber
    ?? custom?.DocumentSerialNumber ?? custom?.documentSerialNumber;
  const n = Number(serial);
  if (!Number.isFinite(n)) {
    throw new Error(
      `iDoklad DocumentNumbers: chybí DocumentSerialNumber v odpovědi: ${JSON.stringify(body).slice(0, 400)}`,
    );
  }
  return { documentSerialNumber: n, token };
}

/** Vytvoření kontaktu v iDokladu — API vyžaduje `PartnerId` (Id kontaktu), ne vnořené `PartnerAddress`. */
async function createIdokladPartnerContact(
  order: OrderRow,
  idok: ReturnType<typeof getIdokladNumericSettings>,
  tokenIn: string,
): Promise<{ partnerId: number; token: string }> {
  let token = tokenIn;
  const companyName = (order.school_name?.trim() || order.customer_name || 'Zákazník').slice(0, 200);
  /** Oficiální iDoklad SDK posílá Newtonsoft výchozí = PascalCase; camelCase se na model nepropáruje. */
  const contactBody: Record<string, unknown> = {
    CompanyName: companyName,
    CountryId: idok.countryIdCz,
    Street: String(order.street || '').slice(0, 100),
    City: String(order.city || '').slice(0, 50),
    PostalCode: String(order.zip || '').slice(0, 11),
    Email: order.customer_email,
  };
  if (order.customer_phone?.trim()) {
    contactBody.Phone = String(order.customer_phone).slice(0, 20);
  }
  if (order.ico?.trim()) {
    contactBody.IdentificationNumber = String(order.ico).slice(0, 20);
  }

  let res = await fetch('https://api.idoklad.cz/v3/Contacts', {
    method: 'POST',
    headers: idokladSdkPostJsonHeaders(token),
    body: JSON.stringify(contactBody),
  });
  if (res.status === 401) {
    token = await getIdokladAccessToken(true);
    res = await fetch('https://api.idoklad.cz/v3/Contacts', {
      method: 'POST',
      headers: idokladSdkPostJsonHeaders(token),
      body: JSON.stringify(contactBody),
    });
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `iDoklad Contacts HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  const data = (body.Data ?? body.data) as Record<string, unknown> | undefined;
  const partnerId = Number(data?.Id ?? data?.id);
  if (!Number.isFinite(partnerId)) {
    throw new Error(
      `iDoklad Contacts: chybí Id v odpovědi: ${JSON.stringify(body).slice(0, 400)}`,
    );
  }
  return { partnerId, token };
}

async function handleIdokladExport(sql: postgres.Sql, orderId: string) {
  const orderRows = await sql<OrderRow[]>`
    select
      id,
      order_number,
      status,
      payment_status,
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
  const issueIso = toIsoDate(issueDate);
  const isPaid =
    order.status === 'paid'
    || String(order.payment_status || '').toLowerCase() === 'paid';
  /** Uhrazené online objednávky: datum úhrady + splatnost = den vystavení (Stripe i dokončené Pipedrive). */
  const maturityIso = isPaid ? issueIso : toIsoDate(addDays(issueDate, 14));

  let token = await getIdokladAccessToken();
  const { numericSequenceId, token: tokenAfterResolve } = await resolveIdokladNumericSequenceId(token);
  token = tokenAfterResolve;
  if (numericSequenceId === undefined) {
    throw new Error(
      'iDoklad: NumericSequenceId je povinné (nastavte IDOKLAD_NUMERIC_SEQUENCE_ID nebo řadu s NumberFormat 07{RR}{NNNN}).',
    );
  }

  const { documentSerialNumber, token: tokenAfterSerial } = await fetchIdokladNextDocumentSerial(
    token,
    numericSequenceId,
    issueIso,
  );
  token = tokenAfterSerial;

  const { partnerId, token: tokenAfterContact } = await createIdokladPartnerContact(order, idok, token);
  token = tokenAfterContact;

  /** PascalCase jako oficiální IdokladSdk (Newtonsoft default) — viz IssuedInvoicePostModel. */
  const payload: Record<string, unknown> = {
    Description: `Objednávka ${order.order_number}`,
    PartnerId: partnerId,
    DocumentSerialNumber: documentSerialNumber,
    IsIncomeTax: idok.isIncomeTax,
    PaymentOptionId: resolveIdokladPaymentOptionId(order),
    NumericSequenceId: numericSequenceId,
    DateOfIssue: issueIso,
    DateOfMaturity: maturityIso,
    DateOfTaxing: issueIso,
    IsEet: false,
    DiscountPercentage: 0,
    CurrencyId: idok.currencyIdCzk,
    ExchangeRate: 1,
    ExchangeRateAmount: 1,
    OrderNumber: order.order_number,
    Items: [
      ...orderItems.map((item) => ({
        Name: item.product_name,
        Amount: item.quantity,
        UnitPrice: amountInCzk(item.unit_price),
        PriceType: idok.priceTypeWithVat,
        VatRateType: idok.vatRateReduced,
        DiscountPercentage: 0,
        IsTaxMovement: true,
      })),
      ...(order.shipping_price > 0
        ? [{
            Name: `Doprava — ${deliveryMethodLabel(order.shipping_method)}`,
            Amount: 1,
            UnitPrice: amountInCzk(order.shipping_price),
            PriceType: idok.priceTypeWithVat,
            VatRateType: idok.vatRateStandard,
            DiscountPercentage: 0,
            IsTaxMovement: true,
          }]
        : []),
    ],
  };
  if (order.note?.trim()) {
    payload.Note = order.note.trim().slice(0, 2000);
  }

  let response = await fetch('https://api.idoklad.cz/v3/IssuedInvoices', {
    method: 'POST',
    headers: idokladSdkPostJsonHeaders(token),
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    token = await getIdokladAccessToken(true);
    response = await fetch('https://api.idoklad.cz/v3/IssuedInvoices', {
      method: 'POST',
      headers: idokladSdkPostJsonHeaders(token),
      body: JSON.stringify(payload),
    });
  }

  const data = await response.json().catch(() => ({} as IdokladInvoiceResponse)) as IdokladInvoiceResponse;
  if (!response.ok) {
    throw new Error(`iDoklad HTTP ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const parsed = parseIdokladInvoiceResponse(data);
  if (isPaid) {
    token = await idokladFullyPayInvoice(token, parsed.invoiceId, issueIso);
  }
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
    /** Uvolnění řádků ve `processing` po timeoutu Edge workeru (catch se nespustí). Vyžaduje sloupec `updated_at` (migrace 20260409180000). */
    try {
      await sql`
        update public.export_queue
        set
          status = 'pending',
          last_error = case
            when coalesce(trim(last_error), '') = '' then 'processing timeout (worker obnoven)'
            else trim(last_error) || ' | processing timeout (worker obnoven)'
          end,
          next_retry_at = now()
        where status = 'processing'
          and updated_at < now() - interval '15 minutes'
      `;
    } catch (recoveryErr) {
      console.warn('[process-export-queue] stuck-processing recovery:', recoveryErr);
    }

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
                invoice_number = ${result.documentNumber},
                idoklad_invoice_id = ${result.invoiceId}
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
