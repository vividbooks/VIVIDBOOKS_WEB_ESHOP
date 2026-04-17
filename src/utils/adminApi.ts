import { projectId, publicAnonKey } from './supabase/info';
import { fetchJsonWithRetry } from './fetchWithRetry';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/admin`;
const HEADERS = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

/** GET na binární odpovědi — bez `Content-Type: application/json` (některé servery podle něj vrací JSON místo raw PDF). */
const HEADERS_AUTH_ONLY: Record<string, string> = {
  Authorization: `Bearer ${publicAnonKey}`,
  Accept: 'application/pdf',
};

/** Edge funkce s `requireAdminJwt` — anon + JWT uživatele (viz supabase/functions/_shared/admin-auth.ts). */
async function edgeAdminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json',
  };
  try {
    const { getSupabaseBrowser } = await import('../lib/supabaseBrowser');
    const { data: { session } } = await getSupabaseBrowser().auth.getSession();
    if (session?.access_token) {
      h['X-User-Access-Token'] = session.access_token;
    }
  } catch {
    /* ignore */
  }
  return h;
}

async function edgeAdminHeadersPdf(): Promise<Record<string, string>> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${publicAnonKey}`,
    Accept: 'application/pdf',
  };
  try {
    const { getSupabaseBrowser } = await import('../lib/supabaseBrowser');
    const { data: { session } } = await getSupabaseBrowser().auth.getSession();
    if (session?.access_token) {
      h['X-User-Access-Token'] = session.access_token;
    }
  } catch {
    /* ignore */
  }
  return h;
}

export type CollectionName = 'blog' | 'novinky' | 'webinare' | 'fixed-pages' | 'hero-slidy' | 'predmety' | 'notifikace' | 'tabs';

export async function fetchCollection(name: CollectionName): Promise<any[]> {
  const result = await fetchJsonWithRetry<{ items?: unknown }>(
    `${BASE}/${name}`,
    { headers: HEADERS },
    { maxAttempts: 4, baseDelayMs: 350 },
  );
  if (!result.ok) {
    console.error(`[Admin] Fetch ${name} failed:`, result.error);
    return [];
  }
  const raw = result.data?.items;
  return Array.isArray(raw) ? raw : [];
}

export async function createItem(collection: CollectionName, item: any): Promise<any> {
  const res = await fetch(`${BASE}/${collection}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create failed: ${err}`);
  }
  return res.json();
}

export async function updateItem(collection: CollectionName, id: string, updates: any): Promise<void> {
  const res = await fetch(`${BASE}/${collection}/${id}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Update failed: ${err}`);
  }
}

export async function deleteItem(collection: CollectionName, id: string): Promise<void> {
  const res = await fetch(`${BASE}/${collection}/${id}`, {
    method: 'DELETE',
    headers: HEADERS,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Delete failed: ${err}`);
  }
}

/**
 * Pořadí hero slidů — pouze existující `PUT /admin/hero-slidy/:id` (merge `order`).
 * Endpoint `/reorder` na některých deployích vracel 404; sekvenční PUT je bezpečný i pro KV (žádné paralelní přepisy).
 */
export async function reorderHeroSlides(orderedIds: string[]): Promise<void> {
  const items = await fetchCollection('hero-slidy');
  const byId = new Map(items.map((i: any) => [String(i.id), i]));

  const pairs: { id: string; order: number }[] = [];
  let ord = 1;
  const seen = new Set<string>();

  for (const raw of orderedIds) {
    const sid = String(raw);
    if (byId.has(sid)) {
      pairs.push({ id: sid, order: ord++ });
      seen.add(sid);
    }
  }
  for (const row of items) {
    const sid = String((row as any).id);
    if (!seen.has(sid)) {
      pairs.push({ id: sid, order: ord++ });
      seen.add(sid);
    }
  }

  for (const { id, order } of pairs) {
    const row = byId.get(id) as any;
    const cur = Number(row?.order) || 0;
    if (cur === order) continue;
    await updateItem('hero-slidy', id, { order });
  }
}

export async function seedCollection(collection: string, items: any[]): Promise<void> {
  const res = await fetch(`${BASE}/seed/${collection}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Seed failed: ${err}`);
  }
}

// Products use the same API prefix
const PRODUCTS_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

export async function fetchProducts(): Promise<any[]> {
  try {
    const res = await fetch(`${PRODUCTS_BASE}/products`, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.products || [];
  } catch (e) {
    console.error('[Admin] Fetch products failed:', e);
    return [];
  }
}

export async function createProduct(product: any): Promise<any> {
  const res = await fetch(`${PRODUCTS_BASE}/products`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(product),
  });
  return res.json();
}

export async function updateProduct(id: string, updates: any): Promise<void> {
  await fetch(`${PRODUCTS_BASE}/products/${id}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify(updates),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await fetch(`${PRODUCTS_BASE}/products/${id}`, {
    method: 'DELETE',
    headers: HEADERS,
  });
}

const ADMIN_ORDERS_BASE = `https://${projectId}.supabase.co/functions/v1/admin-orders`;
const ADMIN_ORDER_ACTION_BASE = `https://${projectId}.supabase.co/functions/v1/admin-order-action`;
const IDOKLAD_INVOICE_PDF_BASE = `https://${projectId}.supabase.co/functions/v1/idoklad-invoice-pdf`;
const ADMIN_ORDER_ALERTS_BASE = `https://${projectId}.supabase.co/functions/v1/admin-order-alerts`;
const ADMIN_PRODUCT_COMMERCE_BASE = `https://${projectId}.supabase.co/functions/v1/admin-product-commerce`;
const ADMIN_PRODUCT_BASE_SYNC_BASE = `https://${projectId}.supabase.co/functions/v1/admin-product-base-sync`;
const ADMIN_ANALYTICS_BASE = `https://${projectId}.supabase.co/functions/v1/admin-analytics`;

export interface AdminOrderListItem {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  school_name?: string | null;
  customer_email: string;
  total: number;
  status: string;
  basecom_status?: string | null;
  payment_status?: string | null;
  shipping_method: string;
  tracking_number?: string | null;
  items_summary?: string | null;
  /** Jen objednávky plakátů (admin záložka). */
  poster_fulfillment_status?: string | null;
}

export interface AdminOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variant?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  bundle_id?: string | null;
  bundle_title?: string | null;
  stock_quantity?: number | null;
  stock_source?: string | null;
  stock_sku?: string | null;
  stock_inventory_id?: string | null;
  stock_inventory_name?: string | null;
  stock_match?: string | null;
  stock_error?: string | null;
}

export interface AdminOrderStockMeta {
  apiTokenWorks: boolean;
  feedUrlWorks: boolean;
  inventoryId?: string | null;
  inventoryName?: string | null;
  warehouseId?: string | null;
  apiError?: string | null;
  feedError?: string | null;
}

export interface AdminProductCommerceStock {
  apiTokenWorks: boolean;
  inventoryId?: string | null;
  inventoryName?: string | null;
  warehouseId?: string | null;
  lookupValue?: string | null;
  matchType?: string | null;
  matched: boolean;
  quantity?: number | null;
  matchedProductId?: string | null;
  matchedProductName?: string | null;
  matchedProductEan?: string | null;
  matchedProductSku?: string | null;
  error?: string | null;
}

export interface AdminProductCommerceSummary {
  total_units_sold: number;
  total_orders: number;
  total_revenue: number;
  first_sold_at?: string | null;
  last_sold_at?: string | null;
}

export interface AdminProductCommerceDestination {
  school_name?: string | null;
  customer_name: string;
  city?: string | null;
  zip?: string | null;
  shipping_method: string;
  total_units: number;
  order_count: number;
  last_sold_at?: string | null;
}

export interface AdminProductCommerceHistoryItem {
  order_id: string;
  order_number: string;
  created_at: string;
  status: string;
  customer_name: string;
  school_name?: string | null;
  city?: string | null;
  zip?: string | null;
  shipping_method: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AdminProductBaseSyncResult {
  ok: boolean;
  inventoryId?: string | null;
  inventoryName?: string | null;
  basecomProductId?: string | null;
  basecomSku?: string | null;
  ean?: string | null;
  warnings?: unknown;
  mode?: 'created' | 'updated';
}

export interface AdminOrderEvent {
  id: string;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  details?: any;
  actor?: string | null;
  created_at: string;
}

export interface AdminOrderWorkflowStep {
  id: string;
  step_key: string;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  last_checked_at?: string | null;
  attempt_count: number;
  last_error?: string | null;
  metadata?: any;
}

export interface AdminOrderAlert {
  id: string;
  /** `order` = tabulka order_alerts, `site` = app_incidents (webináře, …) */
  origin?: 'order' | 'site';
  order_id?: string | null;
  order_number?: string | null;
  webinar_id?: string | null;
  webinar_title?: string | null;
  contact_email?: string | null;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  state: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  title: string;
  message: string;
  dedupe_key: string;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  payload?: any;
}

export interface AdminAlertSummary {
  total_open: number;
  critical_open: number;
  warning_open: number;
  acknowledged_open: number;
}

export interface AdminAnalyticsTrendPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  units: number;
  shipments: number;
  schoolOrders: number;
}

export interface AdminAnalyticsBreakdownItem {
  category?: string;
  method?: string;
  status?: string;
  revenue?: number;
  units?: number;
  orders?: number;
  count?: number;
}

export interface AdminAnalyticsProductItem {
  productId: string;
  productName: string;
  category: string;
  units: number;
  revenue: number;
  orderCount: number;
  topSchools: Array<{
    ico: string;
    schoolName: string;
    units: number;
    revenue: number;
    orderCount: number;
  }>;
}

export interface AdminAnalyticsSchoolItem {
  ico: string;
  schoolName: string;
  revenue: number;
  units: number;
  orderCount: number;
  shipmentCount: number;
  lastOrderedAt: string;
  topCategories: string[];
  topProducts: string[];
}

export interface AdminAnalyticsSchoolProductItem {
  ico: string;
  schoolName: string;
  productId: string;
  productName: string;
  category: string;
  units: number;
  revenue: number;
}

export interface AdminAnalyticsHeatmap {
  schools: Array<{
    ico: string;
    schoolName: string;
  }>;
  products: Array<{
    productId: string;
    productName: string;
    category: string;
  }>;
  cells: Array<{
    ico: string;
    productId: string;
    productName: string;
    units: number;
    revenue: number;
  }>;
}

export interface AdminAnalyticsResponse {
  period: {
    days: number | null;
    label: string;
    startDate: string;
    endDate: string;
  };
  overview: {
    revenue: number;
    orderCount: number;
    shipmentCount: number;
    unitsSold: number;
    averageOrderValue: number;
    schoolRevenue: number;
    schoolOrderCount: number;
    uniqueSchools: number;
    openAlerts: number;
  };
  charts: {
    trend: AdminAnalyticsTrendPoint[];
    categoryBreakdown: AdminAnalyticsBreakdownItem[];
    shippingBreakdown: AdminAnalyticsBreakdownItem[];
    paymentBreakdown: AdminAnalyticsBreakdownItem[];
    statusBreakdown: AdminAnalyticsBreakdownItem[];
  };
  products: {
    allProducts: AdminAnalyticsProductItem[];
    topByRevenue: AdminAnalyticsProductItem[];
    topByUnits: AdminAnalyticsProductItem[];
  };
  schools: {
    topSchools: AdminAnalyticsSchoolItem[];
    topSchoolProducts: AdminAnalyticsSchoolProductItem[];
    heatmap: AdminAnalyticsHeatmap;
  };
  operations: {
    alerts: {
      info: number;
      warning: number;
      critical: number;
      totalOpen: number;
    };
    workflow: Array<{
      status: string;
      count: number;
    }>;
    averageHoursToPay: number | null;
    averageHoursToShip: number | null;
    averageHoursToDeliver: number | null;
  };
}

export interface AdminOrderDetail {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string | null;
  school_name?: string | null;
  ico?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  shipping_method: string;
  shipping_price: number;
  pickup_point_id?: string | null;
  pickup_point_name?: string | null;
  tracking_number?: string | null;
  payment_method: string;
  payment_status?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_receipt_url?: string | null;
  pipedrive_deal_id?: string | number | null;
  pipedrive_sync_status?: string | null;
  pipedrive_sync_error?: string | null;
  pipedrive_synced_at?: string | null;
  subtotal: number;
  total: number;
  basecom_status?: string | null;
  basecom_order_id?: string | null;
  invoice_status?: string | null;
  invoice_number?: string | null;
  /** iDoklad IssuedInvoice Id — stažení PDF přes Edge funkci */
  idoklad_invoice_id?: string | null;
  zasilkovna_status?: string | null;
  zasilkovna_packet_id?: string | null;
  note?: string | null;
  admin_note?: string | null;
  cancelled_reason?: string | null;
  retry_count?: number | null;
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  poster_fulfillment_status?: string | null;
}

/** Stav plnění z Base.com (Baselinker) — admin-orders GET detail. */
export type AdminBasecomFulfillmentStep = {
  key: 'received_base' | 'received_fulfillment' | 'packed' | 'shipped';
  label: string;
  done: boolean;
  source: 'tag' | 'api_field' | 'history' | 'inferred';
};

export type AdminBasecomFulfillment =
  | {
    ok: true;
    orderFound: boolean;
    steps: AdminBasecomFulfillmentStep[];
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

export async function fetchAdminOrders(params: {
  filter?: 'all' | 'new' | 'shipped' | 'problem';
  search?: string;
  page?: number;
  pageSize?: number;
  /** Jen řádky s `poster_fulfillment_status` (objednávky jen z plakátů v košíku). */
  posterOnly?: boolean;
}) {
  const url = new URL(ADMIN_ORDERS_BASE);
  url.searchParams.set('filter', params.filter || 'all');
  url.searchParams.set('search', params.search || '');
  url.searchParams.set('page', String(params.page || 1));
  url.searchParams.set('pageSize', String(params.pageSize || 20));
  if (params.posterOnly) url.searchParams.set('poster', '1');

  const res = await fetch(url.toString(), { headers: await edgeAdminHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin orders failed: ${err}`);
  }

  return res.json() as Promise<{
    items: AdminOrderListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export async function fetchAdminOrderDetail(id: string) {
  const res = await fetch(`${ADMIN_ORDERS_BASE}/${id}`, { headers: await edgeAdminHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin order detail failed: ${err}`);
  }

  return res.json() as Promise<{
    order: AdminOrderDetail;
    items: AdminOrderItem[];
    events: AdminOrderEvent[];
    workflowSteps: AdminOrderWorkflowStep[];
    alerts: AdminOrderAlert[];
    stockMeta?: AdminOrderStockMeta;
    basecomFulfillment?: AdminBasecomFulfillment;
  }>;
}

/** Stažení PDF faktury z iDokladu (přes Edge funkci, stejná hlavička jako admin API). */
export async function downloadIdokladInvoicePdf(orderId: string, filenameBase: string): Promise<void> {
  const res = await fetch(
    `${IDOKLAD_INVOICE_PDF_BASE}?orderId=${encodeURIComponent(orderId)}`,
    { headers: await edgeAdminHeadersPdf() },
  );
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw;
    try {
      const j = JSON.parse(raw) as { error?: string; detail?: string; hint?: string };
      if (j.error) {
        msg = j.error;
        if (j.detail) msg += `: ${j.detail}`;
        if (j.hint) msg += ` (${j.hint})`;
      }
    } catch {
      /* use raw */
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = filenameBase.replace(/[^\w.\-\sáčďéěíňóřšťúůýž]+/gi, '_').trim().slice(0, 80) || 'faktura';
  a.download = `${safe}.pdf`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function runAdminOrderAction(payload: {
  action:
    | 'retry_export'
    | 'retry_idoklad_export'
    | 'cancel_order'
    | 'mark_shipped'
    | 'sync_pipedrive'
    | 'set_poster_fulfillment';
  orderId: string;
  cancelledReason?: string;
  trackingNumber?: string;
  /** true = jen aktualizace štítků/PRINT u existujícího dealu */
  refreshPipedrive?: boolean;
  posterFulfillmentStatus?: 'pending' | 'done';
}) {
  const res = await fetch(ADMIN_ORDER_ACTION_BASE, {
    method: 'POST',
    headers: await edgeAdminHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Admin order action failed: ${err}`);
  }

  return res.json();
}

export async function fetchAdminAlertSummary() {
  const url = new URL(ADMIN_ORDER_ALERTS_BASE);
  url.searchParams.set('mode', 'summary');

  const res = await fetch(url.toString(), { headers: await edgeAdminHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin alert summary failed: ${err}`);
  }

  return res.json() as Promise<{
    summary: AdminAlertSummary;
  }>;
}

export async function fetchAdminOrderAlerts(params?: {
  state?: 'all' | 'open' | 'acknowledged' | 'resolved';
  severity?: '' | 'info' | 'warning' | 'critical';
  /** Kód typu z `order_alerts.alert_type` (např. basecom_failed). Prázdné = všechny. */
  alertType?: string;
  /** `all` = objednávky + web; `orders` = jen e-shop; `site` = jen app_incidents */
  scope?: 'all' | 'orders' | 'site';
  page?: number;
  pageSize?: number;
}) {
  const url = new URL(ADMIN_ORDER_ALERTS_BASE);
  url.searchParams.set('state', params?.state || 'open');
  url.searchParams.set('severity', params?.severity || '');
  url.searchParams.set('page', String(params?.page || 1));
  url.searchParams.set('pageSize', String(params?.pageSize || 20));
  const at = (params?.alertType || '').trim();
  if (at) url.searchParams.set('alertType', at);
  url.searchParams.set('scope', params?.scope || 'all');

  const res = await fetch(url.toString(), { headers: await edgeAdminHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin order alerts failed: ${err}`);
  }

  return res.json() as Promise<{
    items: AdminOrderAlert[];
    total: number;
    page: number;
    pageSize: number;
    /** Distinct typy v DB — pro filtr v adminu */
    alertTypes: string[];
    scope?: 'all' | 'orders' | 'site';
  }>;
}

export async function runAdminOrderAlertAction(payload: {
  action: 'acknowledge' | 'resolve';
  alertId: string;
}) {
  const res = await fetch(ADMIN_ORDER_ALERTS_BASE, {
    method: 'POST',
    headers: await edgeAdminHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Admin order alert action failed: ${err}`);
  }

  return res.json();
}

export async function fetchAdminProductCommerce(params: {
  productId: string;
  productName?: string;
  shoptetId?: string | null;
  isbn?: string | null;
  ean?: string | null;
}) {
  const url = new URL(ADMIN_PRODUCT_COMMERCE_BASE);
  url.searchParams.set('productId', params.productId);
  if (params.productName) url.searchParams.set('productName', params.productName);
  if (params.shoptetId) url.searchParams.set('shoptetId', params.shoptetId);
  if (params.isbn) url.searchParams.set('isbn', params.isbn);
  if (params.ean) url.searchParams.set('ean', params.ean);

  const res = await fetch(url.toString(), { headers: await edgeAdminHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin product commerce failed: ${err}`);
  }

  return res.json() as Promise<{
    product: {
      id: string;
      name?: string | null;
      shoptetId?: string | null;
    };
    stock: AdminProductCommerceStock;
    sales: {
      summary: AdminProductCommerceSummary;
      destinations: AdminProductCommerceDestination[];
      history: AdminProductCommerceHistoryItem[];
    };
  }>;
}

export async function runAdminProductBaseSync(product: any) {
  const res = await fetch(ADMIN_PRODUCT_BASE_SYNC_BASE, {
    method: 'POST',
    headers: await edgeAdminHeaders(),
    body: JSON.stringify({ product }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Product Base.com sync failed: ${err}`);
  }

  return res.json() as Promise<AdminProductBaseSyncResult>;
}

export async function fetchAdminAnalytics(params?: { days?: number | 'all' }) {
  const url = new URL(ADMIN_ANALYTICS_BASE);
  if (params?.days !== undefined) {
    url.searchParams.set('days', String(params.days));
  }

  const res = await fetch(url.toString(), { headers: await edgeAdminHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin analytics failed: ${err}`);
  }

  return res.json() as Promise<AdminAnalyticsResponse>;
}

export interface AdminSchoolListItem {
  name: string;
  ico: string;
  address: string;
  kraj: string;
  typ?: string;
  redIzo?: string;
  orgId: number | null;
  orgName: string | null;
  status: string;
  matchedBy: 'ico' | 'name' | null;
  ownerName?: string | null;
  products: string[];
  wonDeals: number;
  openDeals: number;
  totalDeals: number;
  source: 'csv';
}

export interface AdminSchoolPerson {
  id: number;
  name: string;
  email?: string | { value: string }[];
  phone?: string | { value: string }[];
  position?: string;
  subjects?: string[];
  stupen?: string;
  customFields?: Record<string, unknown>;
}

export interface AdminSchoolDeal {
  id: number;
  title: string;
  status: 'won' | 'lost' | 'open';
  value?: number;
  currency?: string;
  add_time?: string;
  won_time?: string;
  lost_time?: string;
  customFields?: Record<string, unknown>;
  products?: Array<{
    id?: number | null;
    name: string;
    quantity?: number | null;
    item_price?: number | null;
    sum?: number | null;
  }>;
}

export interface AdminSchoolActivity {
  id: number;
  subject?: string;
  type?: string;
  done?: boolean;
  due_date?: string;
  add_time?: string;
  marked_as_done_time?: string;
  note?: string;
  user_name?: string;
}

export interface AdminSchoolOrderSummary {
  orderCount: number;
  totalRevenue: number;
  purchasedProducts: Array<{
    name: string;
    quantity: number;
    orderCount: number;
  }>;
  digitalLicenses: string[];
  /** Náhled posledních objednávek (např. prvních 20 z načteného okna). */
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    createdAt: string;
    status: string;
    paymentStatus?: string | null;
    total: number;
    items: Array<{
      productName: string;
      quantity: number;
      totalPrice: number;
    }>;
  }>;
  /** Kompletní historie v rámci načteného okna (max 500 řádků z DB). */
  allOrders?: Array<{
    id: string;
    orderNumber: string;
    createdAt: string;
    status: string;
    paymentStatus?: string | null;
    total: number;
    items: Array<{
      productName: string;
      quantity: number;
      totalPrice: number;
    }>;
  }>;
}

export interface AdminSchoolDetailResponse {
  school: {
    name: string;
    ico: string;
    address: string;
    kraj: string;
    typ?: string;
    redIzo?: string;
  };
  organization: {
    id: number;
    name: string;
    address?: string;
  } | null;
  owner: {
    id: number | null;
    name: string;
    firstName: string;
    email: string;
    phone: string;
    photoUrl: string;
  } | null;
  owner_name?: string | null;
  persons: AdminSchoolPerson[];
  deals: AdminSchoolDeal[];
  activities: AdminSchoolActivity[];
  orderSummary: AdminSchoolOrderSummary;
  productsSummary: string[];
  teacherCode?: string | null;
  studentCode?: string | null;
  status: string;
}

export async function fetchAdminSchools(params?: {
  q?: string;
  product?: string;
  subject?: string;
  limit?: number;
}) {
  const url = new URL(`${PRODUCTS_BASE}/admin/schools`);
  if (params?.q) url.searchParams.set('q', params.q);
  if (params?.product) url.searchParams.set('product', params.product);
  if (params?.subject) url.searchParams.set('subject', params.subject);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin schools failed: ${err}`);
  }

  return res.json() as Promise<{
    items: AdminSchoolListItem[];
    total: number;
    q: string;
    product: string;
    subject: string;
  }>;
}

export async function fetchAdminSchoolDetail(params: {
  orgId?: number | null;
  ico?: string;
  name?: string;
}) {
  const url = new URL(`${PRODUCTS_BASE}/admin/pipedrive/school-detail`);
  if (params.orgId) url.searchParams.set('orgId', String(params.orgId));
  if (params.ico) url.searchParams.set('ico', params.ico);
  if (params.name) url.searchParams.set('name', params.name);

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch admin school detail failed: ${err}`);
  }

  return res.json() as Promise<AdminSchoolDetailResponse>;
}