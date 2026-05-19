import { resolveAllowedOrigin } from '../_shared/cors.ts';
import postgres from 'npm:postgres';
import { requireAdminJwt } from '../_shared/admin-auth.ts';

type OrderListRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  school_name: string | null;
  customer_email: string;
  total: number;
  status: string;
  basecom_status: string | null;
  payment_status: string | null;
  shipping_method: string;
  tracking_number: string | null;
  items_summary: string | null;
  poster_fulfillment_status: string | null;
  source: string;
};

type OrderDetailRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  customer_email: string;
  customer_name: string;
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
  tracking_number: string | null;
  payment_method: string;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  stripe_receipt_url: string | null;
  pipedrive_deal_id: string | null;
  pipedrive_sync_status: string | null;
  pipedrive_sync_error: string | null;
  pipedrive_synced_at: string | null;
  subtotal: number;
  total: number;
  basecom_status: string | null;
  basecom_order_id: string | null;
  invoice_status: string | null;
  invoice_number: string | null;
  idoklad_invoice_id: string | null;
  zasilkovna_status: string | null;
  zasilkovna_packet_id: string | null;
  note: string | null;
  admin_note: string | null;
  cancelled_reason: string | null;
  retry_count: number | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
};

type OrderItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  bundle_id: string | null;
  bundle_title: string | null;
};

type OrderItemWithStockRow = OrderItemRow & {
  stock_quantity: number | null;
  stock_source: string | null;
  stock_sku: string | null;
  stock_inventory_id: string | null;
  stock_inventory_name: string | null;
  stock_match: string | null;
  stock_error: string | null;
};

type OrderEventRow = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  details: unknown;
  actor: string | null;
  created_at: string;
};

type WorkflowStepRow = {
  id: string;
  step_key: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  last_checked_at: string | null;
  attempt_count: number;
  last_error: string | null;
  metadata: unknown;
};

type OrderAlertRow = {
  id: string;
  alert_type: string;
  severity: string;
  state: string;
  title: string;
  message: string;
  dedupe_key: string;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  payload: unknown;
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

async function hasColumn(
  sql: ReturnType<typeof postgres>,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as exists
  `;
  return Boolean(rows[0]?.exists);
}

function normalizeFilter(filter: string | null) {
  switch (filter) {
    case 'new':
    case 'shipped':
    case 'problem':
    case 'incomplete':
    case 'pending_payment':
      return filter;
    default:
      return 'all';
  }
}

function normalizeKey(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Krok plnění v Base.com (štítky a/nebo heuristiky z API). */
type BasecomFulfillmentStep = {
  key: 'received_base' | 'received_fulfillment' | 'packed' | 'shipped';
  label: string;
  done: boolean;
  source: 'tag' | 'api_field' | 'history' | 'inferred';
};

type BasecomFulfillmentPayload =
  | {
    ok: true;
    orderFound: boolean;
    steps: BasecomFulfillmentStep[];
    tagNames: string[];
    signals: {
      pickState: number | null;
      packState: number | null;
      deliveryPackageNr: string;
      pickPackHistoryEvents: number;
    };
  }
  | {
    ok: false;
    reason: string;
    error?: string;
  };

function parseCsvEnv(name: string): string[] {
  const raw = (Deno.env.get(name) || '').trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function readIntish(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function tagMatchesAny(tagNames: string[], patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const normalizedTags = tagNames.map((t) => normalizeKey(t));
  for (const p of patterns) {
    const np = normalizeKey(p);
    if (!np) continue;
    for (const nt of normalizedTags) {
      if (nt === np || nt.includes(np) || np.includes(nt)) return true;
    }
  }
  return false;
}

function collectRawTagIdsFromOrder(o: Record<string, unknown>): unknown[] {
  const candidates = [o.tags, o.order_tags];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  for (const [key, val] of Object.entries(o)) {
    if (!key.toLowerCase().includes('tag')) continue;
    if (Array.isArray(val)) return val;
  }
  return [];
}

function buildOrderTagIdToNameMap(tagData: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  const tags = tagData.tags;
  if (tags && typeof tags === 'object' && !Array.isArray(tags)) {
    for (const [k, v] of Object.entries(tags as Record<string, unknown>)) {
      if (typeof v === 'string') {
        map.set(k, v);
        continue;
      }
      if (v && typeof v === 'object') {
        const name = (v as Record<string, unknown>).name;
        if (typeof name === 'string') map.set(k, name);
      }
    }
  }
  if (Array.isArray(tags)) {
    for (const item of tags) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = row.tag_id ?? row.id;
      const name = row.name;
      if (id != null && typeof name === 'string') map.set(String(id), name);
    }
  }
  return map;
}

async function resolveOrderTagNames(o: Record<string, unknown>, apiToken: string): Promise<string[]> {
  const raw = collectRawTagIdsFromOrder(o);
  const out: string[] = [];

  const hasNumericIds = raw.some((t) => typeof t === 'number' || (typeof t === 'string' && /^\d+$/.test(t)));

  if (hasNumericIds) {
    try {
      const tagData = await callBasecomApi(apiToken, 'getOrderTags', {});
      const idMap = buildOrderTagIdToNameMap(tagData);
      for (const t of raw) {
        const id = String(t);
        const name = idMap.get(id);
        if (name) out.push(name);
        else if (typeof t === 'string' && !/^\d+$/.test(t)) out.push(t);
        else if (typeof t === 'number') out.push(idMap.get(String(t)) ?? id);
      }
      return out.filter(Boolean);
    } catch {
      // fall through to raw strings
    }
  }

  for (const t of raw) {
    if (typeof t === 'string') out.push(t);
    else if (typeof t === 'number') out.push(String(t));
  }
  return out;
}

async function loadBasecomFulfillment(basecomOrderId: string | null): Promise<BasecomFulfillmentPayload> {
  const apiToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();
  if (!apiToken) {
    return { ok: false, reason: 'missing_token' };
  }
  const trimmed = (basecomOrderId || '').trim();
  if (!trimmed) {
    return { ok: false, reason: 'no_basecom_order' };
  }
  const oid = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(oid)) {
    return { ok: false, reason: 'invalid_basecom_order_id' };
  }

  let ordersData: Record<string, unknown>;
  try {
    ordersData = await callBasecomApi(apiToken, 'getOrders', {
      order_id: oid,
      get_unconfirmed_orders: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: 'get_orders_failed', error: message };
  }

  const orders = ordersData.orders as unknown[] | undefined;
  const o = orders?.[0] as Record<string, unknown> | undefined;
  if (!o) {
    return {
      ok: true,
      orderFound: false,
      steps: [
        { key: 'received_base', label: 'Přijato base', done: false, source: 'inferred' },
        { key: 'received_fulfillment', label: 'Přijato fulfillment', done: false, source: 'inferred' },
        { key: 'packed', label: 'Zabaleno', done: false, source: 'inferred' },
        { key: 'shipped', label: 'Expedováno', done: false, source: 'inferred' },
      ],
      tagNames: [],
      signals: {
        pickState: null,
        packState: null,
        deliveryPackageNr: '',
        pickPackHistoryEvents: 0,
      },
    };
  }

  let history: unknown[] = [];
  try {
    const hData = await callBasecomApi(apiToken, 'getOrderPickPackHistory', { order_id: oid });
    const h = hData.history;
    if (Array.isArray(h)) history = h;
  } catch {
    history = [];
  }

  const tagNames = await resolveOrderTagNames(o, apiToken);

  const pickState = readIntish(o.pick_state ?? o.pick_status);
  const packState = readIntish(o.pack_state ?? o.pack_status);
  const deliveryNr = typeof o.delivery_package_nr === 'string' ? o.delivery_package_nr.trim() : '';

  let hasPickFinished = false;
  let hasPackFinished = false;
  for (const h of history) {
    if (!h || typeof h !== 'object') continue;
    const at = readIntish((h as Record<string, unknown>).action_type);
    if (at === 5) hasPickFinished = true;
    if (at === 11) hasPackFinished = true;
  }

  const envBase = parseCsvEnv('BASECOM_FULFILLMENT_TAG_BASE');
  const envFulfillment = parseCsvEnv('BASECOM_FULFILLMENT_TAG_FULFILLMENT');
  const envPacked = parseCsvEnv('BASECOM_FULFILLMENT_TAG_PACKED');
  const envShipped = parseCsvEnv('BASECOM_FULFILLMENT_TAG_SHIPPED');

  const step1Done = envBase.length > 0
    ? tagMatchesAny(tagNames, envBase)
    : true;
  const step1Source: BasecomFulfillmentStep['source'] = envBase.length > 0 ? 'tag' : 'inferred';

  const step2Done = envFulfillment.length > 0
    ? tagMatchesAny(tagNames, envFulfillment)
    : hasPickFinished || pickState === 1;
  const step2Source: BasecomFulfillmentStep['source'] = envFulfillment.length > 0
    ? 'tag'
    : hasPickFinished
    ? 'history'
    : pickState === 1
    ? 'api_field'
    : 'inferred';

  const step3Done = envPacked.length > 0
    ? tagMatchesAny(tagNames, envPacked)
    : hasPackFinished || packState === 1;
  const step3Source: BasecomFulfillmentStep['source'] = envPacked.length > 0
    ? 'tag'
    : hasPackFinished
    ? 'history'
    : packState === 1
    ? 'api_field'
    : 'inferred';

  const step4Done = envShipped.length > 0
    ? tagMatchesAny(tagNames, envShipped)
    : deliveryNr.length > 0;
  const step4Source: BasecomFulfillmentStep['source'] = envShipped.length > 0
    ? 'tag'
    : deliveryNr.length > 0
    ? 'api_field'
    : 'inferred';

  const steps: BasecomFulfillmentStep[] = [
    { key: 'received_base', label: 'Přijato base', done: step1Done, source: step1Source },
    { key: 'received_fulfillment', label: 'Přijato fulfillment', done: step2Done, source: step2Source },
    { key: 'packed', label: 'Zabaleno', done: step3Done, source: step3Source },
    { key: 'shipped', label: 'Expedováno', done: step4Done, source: step4Source },
  ];

  return {
    ok: true,
    orderFound: true,
    steps,
    tagNames,
    signals: {
      pickState,
      packState,
      deliveryPackageNr: deliveryNr,
      pickPackHistoryEvents: history.length,
    },
  };
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

async function loadFeedIndex() {
  const feedUrl = (Deno.env.get('BASECOM_INVENTORY_FEED_URL') || '').trim();
  if (!feedUrl) {
    return {
      works: false,
      error: 'Missing BASECOM_INVENTORY_FEED_URL.',
      byCode: new Map<string, Record<string, unknown>>(),
      byName: new Map<string, Record<string, unknown>>(),
    };
  }

  try {
    const response = await fetch(feedUrl);
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Feed HTTP ${response.status}: ${rawText.slice(0, 300)}`);
    }

    const itemRegex = /<SHOPITEM\b[^>]*>([\s\S]*?)<\/SHOPITEM>/gi;
    const byCode = new Map<string, Record<string, unknown>>();
    const byName = new Map<string, Record<string, unknown>>();
    let match: RegExpExecArray | null = null;

    while ((match = itemRegex.exec(rawText)) !== null) {
      const block = match[1];
      const item = {
        NAME: extractXmlValue(block, 'NAME'),
        CODE: extractXmlValue(block, 'CODE'),
        EAN: extractXmlValue(block, 'EAN'),
        PRICE: extractXmlValue(block, 'PRICE'),
      };

      if (item.CODE) byCode.set(normalizeKey(item.CODE), item);
      if (item.NAME) byName.set(normalizeKey(item.NAME), item);
    }

    return { works: true, error: null, byCode, byName };
  } catch (error) {
    return {
      works: false,
      error: error instanceof Error ? error.message : 'Feed lookup failed.',
      byCode: new Map<string, Record<string, unknown>>(),
      byName: new Map<string, Record<string, unknown>>(),
    };
  }
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

async function loadBasecomStockIndex() {
  const apiToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();
  if (!apiToken) {
    return {
      works: false,
      error: 'Missing BASECOM_API_TOKEN.',
      inventoryId: null as string | null,
      inventoryName: null as string | null,
      warehouseId: null as string | null,
      bySku: new Map<string, { sku: string; quantity: number | null; raw: Record<string, unknown> }>(),
    };
  }

  try {
    const inventoriesResponse = await callBasecomApi(apiToken, 'getInventories', {});
    const inventories = normalizeInventories(inventoriesResponse);
    const firstInventory = pickFirstInventory(inventories);
    if (!firstInventory) {
      throw new Error('No inventory_id found in Base.com response.');
    }

    const stockResponse = await callBasecomApi(apiToken, 'getInventoryProductsStock', {
      inventory_id: Number.isNaN(Number(firstInventory.id)) ? firstInventory.id : Number(firstInventory.id),
    });
    const products = stockResponse.products;
    const bySku = new Map<string, { sku: string; quantity: number | null; raw: Record<string, unknown> }>();

    if (products && typeof products === 'object') {
      for (const [key, value] of Object.entries(products as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const record = value as Record<string, unknown>;
        const sku = String(record.sku ?? record.product_id ?? key);
        const rawQuantity = record.quantity ?? record.stock ?? record.available ?? null;
        const quantity = parseWarehouseQuantity(rawQuantity, firstInventory.defaultWarehouse);

        bySku.set(normalizeKey(sku), {
          sku,
          quantity,
          raw: record,
        });
      }
    }

    return {
      works: true,
      error: null,
      inventoryId: firstInventory.id,
      inventoryName: firstInventory.name,
      warehouseId: firstInventory.defaultWarehouse,
      bySku,
    };
  } catch (error) {
    return {
      works: false,
      error: error instanceof Error ? error.message : 'Base.com stock lookup failed.',
      inventoryId: null,
      inventoryName: null,
      warehouseId: null,
      bySku: new Map<string, { sku: string; quantity: number | null; raw: Record<string, unknown> }>(),
    };
  }
}

async function enrichOrderItemsWithStock(items: OrderItemRow[]) {
  const [feedIndex, apiIndex] = await Promise.all([
    loadFeedIndex(),
    loadBasecomStockIndex(),
  ]);

  const enrichedItems: OrderItemWithStockRow[] = items.map((item) => {
    const apiMatch = apiIndex.bySku.get(normalizeKey(item.product_id));
    const feedMatch = feedIndex.byCode.get(normalizeKey(item.product_id))
      || feedIndex.byName.get(normalizeKey(item.product_name));

    return {
      ...item,
      stock_quantity: apiMatch?.quantity ?? null,
      stock_source: apiMatch ? 'basecom_api' : feedMatch ? 'feed' : null,
      stock_sku: apiMatch?.sku ?? (typeof feedMatch?.CODE === 'string' && feedMatch.CODE ? feedMatch.CODE : item.product_id),
      stock_inventory_id: apiIndex.inventoryId,
      stock_inventory_name: apiIndex.inventoryName,
      stock_match: apiMatch ? 'sku' : feedMatch ? (feedMatch.CODE ? 'code' : 'name') : null,
      stock_error: apiIndex.error,
    };
  });

  return {
    items: enrichedItems,
    stockMeta: {
      apiTokenWorks: apiIndex.works,
      feedUrlWorks: feedIndex.works,
      inventoryId: apiIndex.inventoryId,
      inventoryName: apiIndex.inventoryName,
      warehouseId: apiIndex.warehouseId,
      apiError: apiIndex.error,
      feedError: feedIndex.error,
    },
  };
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

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const detailId = parts[parts.length - 1] === 'admin-orders' ? null : parts[parts.length - 1];

    if (detailId) {
      const orderRows = await sql<OrderDetailRow[]>`
        select
          id,
          order_number,
          created_at,
          status,
          customer_email,
          customer_name,
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
          tracking_number,
          payment_method,
          payment_status,
          stripe_payment_intent_id,
          stripe_receipt_url,
          pipedrive_deal_id,
          pipedrive_sync_status,
          pipedrive_sync_error,
          pipedrive_synced_at,
          subtotal,
          total,
          basecom_status,
          basecom_order_id,
          invoice_status,
          invoice_number,
          idoklad_invoice_id,
          zasilkovna_status,
          zasilkovna_packet_id,
          note,
          admin_note,
          cancelled_reason,
          retry_count,
          paid_at,
          shipped_at,
          delivered_at,
          cancelled_at,
          poster_fulfillment_status
        from public.orders
        where id = ${detailId}::uuid
        limit 1
      `;

      const order = orderRows[0];
      if (!order) {
        return jsonResponse(req, { error: 'Order not found.' }, 404);
      }

      const [items, events, workflowSteps, alerts] = await Promise.all([
        sql<OrderItemRow[]>`
          select
            id,
            product_id,
            product_name,
            variant,
            quantity,
            unit_price,
            total_price,
            bundle_id,
            bundle_title
          from public.order_items
          where order_id = ${detailId}::uuid
          order by id asc
        `,
        sql<OrderEventRow[]>`
          select
            id,
            event_type,
            from_status,
            to_status,
            details,
            actor,
            created_at
          from public.order_events
          where order_id = ${detailId}::uuid
          order by created_at asc
        `,
        sql<WorkflowStepRow[]>`
          select
            id,
            step_key,
            status,
            started_at,
            completed_at,
            last_checked_at,
            attempt_count,
            last_error,
            metadata
          from public.order_workflow_steps
          where order_id = ${detailId}::uuid
          order by created_at asc
        `,
        sql<OrderAlertRow[]>`
          select
            id,
            alert_type,
            severity,
            state,
            title,
            message,
            dedupe_key,
            first_seen_at,
            last_seen_at,
            acknowledged_at,
            acknowledged_by,
            resolved_at,
            payload
          from public.order_alerts
          where order_id = ${detailId}::uuid
          order by
            case severity when 'critical' then 0 when 'warning' then 1 else 2 end,
            last_seen_at desc
        `,
      ]);

      const stockData = await enrichOrderItemsWithStock(items);
      const basecomFulfillment = await loadBasecomFulfillment(order.basecom_order_id);

      return jsonResponse(req, {
        order,
        items: stockData.items,
        events,
        workflowSteps,
        alerts,
        stockMeta: stockData.stockMeta,
        basecomFulfillment,
      });
    }

    const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1);
    const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('pageSize') || '20', 10), 1), 100);
    const offset = (page - 1) * pageSize;
    const search = (url.searchParams.get('search') || '').trim();
    const filter = normalizeFilter(url.searchParams.get('filter'));
    const posterOnly = url.searchParams.get('poster') === '1' || url.searchParams.get('poster') === 'true';
    const includeSuperseded = url.searchParams.get('includeSuperseded') === '1'
      || url.searchParams.get('includeSuperseded') === 'true';
    const hasSourceColumn = await hasColumn(sql, 'orders', 'source');
    /** Objednávka z inbound webhooku (scénář A) — vždy `pipedrive_inbound`; sloupec `source` může na starší DB chybět. */
    const pipedriveInboundOriginJoin = sql`
      left join (
        select distinct order_id
        from public.order_events
        where event_type = 'pipedrive_inbound'
      ) pdi on pdi.order_id = o.id
    `;
    /** Jednotná definice „původ Pipedrive“: explicitní sloupec nebo audit událost (retroaktivně bez migrace). */
    const pipedriveSourceMatch = hasSourceColumn
      ? sql`(pdi.order_id is not null or o.source = 'pipedrive')`
      : sql`(pdi.order_id is not null)`;
    const sourceProjection = hasSourceColumn
      ? sql`case when pdi.order_id is not null then 'pipedrive' else o.source end`
      : sql`case when pdi.order_id is not null then 'pipedrive' else 'eshop' end`;
    /** `source=eshop|pipedrive|all` — filtr zdroje objednávky pro admin seznam. */
    const sourceParam = (url.searchParams.get('source') || '').trim().toLowerCase();
    const sourceFilter: 'eshop' | 'pipedrive' | null =
      sourceParam === 'eshop' || sourceParam === 'pipedrive' ? sourceParam : null;
    const searchPattern = `%${search}%`;

    const searchClause = search
      ? sql`and (o.order_number ilike ${searchPattern} or o.customer_email ilike ${searchPattern})`
      : sql``;

    const posterClause = posterOnly
      ? sql`and o.poster_fulfillment_status is not null`
      : sql``;

    const sourceClause = sourceFilter === 'pipedrive'
      ? sql`and ${pipedriveSourceMatch}`
      : sourceFilter === 'eshop'
        ? sql`and not (${pipedriveSourceMatch})`
        : sql``;

    const filterClause = filter === 'new'
      ? sql`and o.status in ('paid', 'processing', 'exported')`
      : filter === 'shipped'
        ? sql`and o.status in ('shipped', 'delivered')`
        : filter === 'problem'
          ? sql`and o.status in ('failed', 'cancelled')`
          : filter === 'incomplete'
            ? sql`and o.status = 'incomplete'`
            : filter === 'pending_payment'
              ? sql`and o.status = 'pending_payment'`
              : sql``;

    /** Skrýt audit-trail záznamy supersession (cancelled s reason 'Superseded by new checkout attempt')
     *  z výchozího seznamu — admin v hlavním přehledu nepotřebuje vidět historické pokusy stejného
     *  draftu. Filter 'problem' i explicit search/`includeSuperseded=1` je nadále zobrazí. */
    const supersededClause = (filter === 'problem' || search || includeSuperseded)
      ? sql``
      : sql`and not (o.status = 'cancelled' and o.cancelled_reason = 'Superseded by new checkout attempt')`;

    const [countRows, items] = await Promise.all([
      sql<{ count: number }[]>`
        select count(*)::int as count
        from public.orders o
        ${pipedriveInboundOriginJoin}
        where true
        ${searchClause}
        ${posterClause}
        ${filterClause}
        ${supersededClause}
        ${sourceClause}
      `,
      sql<OrderListRow[]>`
        select
          o.id,
          o.order_number,
          o.created_at,
          o.customer_name,
          o.school_name,
          o.customer_email,
          o.total,
          o.status,
          o.basecom_status,
          o.payment_status,
          o.shipping_method,
          o.tracking_number,
          o.poster_fulfillment_status,
          ${sourceProjection} as source,
          string_agg((oi.quantity::text || '× ' || oi.product_name), ', ' order by oi.id) as items_summary
        from public.orders o
        ${pipedriveInboundOriginJoin}
        left join public.order_items oi on oi.order_id = o.id
        where true
        ${searchClause}
        ${posterClause}
        ${filterClause}
        ${supersededClause}
        ${sourceClause}
        group by
          o.id,
          o.order_number,
          o.created_at,
          o.customer_name,
          o.school_name,
          o.customer_email,
          o.total,
          o.status,
          o.basecom_status,
          o.payment_status,
          o.shipping_method,
          o.tracking_number,
          o.poster_fulfillment_status,
          pdi.order_id
          ${hasSourceColumn ? sql`, o.source` : sql``}
        order by o.created_at desc
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return jsonResponse(req, {
      items,
      total: countRows[0]?.count ?? 0,
      page,
      pageSize,
      filter,
      search,
      posterOnly,
      source: sourceFilter,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load admin orders.';
    return jsonResponse(req, { error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
