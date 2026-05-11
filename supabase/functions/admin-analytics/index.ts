import { resolveAllowedOrigin } from '../_shared/cors.ts';
import postgres from 'npm:postgres';
import { requireAdminJwt } from '../_shared/admin-auth.ts';

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  status: string;
  payment_status: string | null;
  payment_method: string;
  shipping_method: string;
  school_name: string | null;
  ico: string | null;
  total: number;
  subtotal: number;
  shipping_price: number;
};

type OrderItemRow = {
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type AlertSummaryRow = {
  severity: string;
  total: number;
};

type WorkflowSummaryRow = {
  status: string;
  total: number;
};

type CatalogProduct = {
  id: string;
  name?: string | null;
  category?: string | null;
  type?: string | null;
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

function parseDays(rawValue: string | null) {
  if (!rawValue || rawValue === '90') return 90;
  if (rawValue === 'all' || rawValue === '0') return null;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 90;
  return Math.min(Math.round(parsed), 730);
}

function normalizeLoose(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function sanitizeIco(value: string | null | undefined) {
  return String(value || '').replace(/\D+/g, '');
}

function revenueEligible(order: OrderRow) {
  return order.payment_status === 'paid' && !['cancelled', 'refunded', 'failed'].includes(order.status);
}

function shippedEligible(order: OrderRow) {
  return !!order.shipped_at || ['shipped', 'delivered'].includes(order.status);
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function topNamesFromMap(map: Map<string, number>, limit = 3) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs'))
    .slice(0, limit)
    .map(([name]) => name);
}

function average(numbers: number[]) {
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function normalizeProductAnalyticsItem(item: {
  productId: string;
  productName: string;
  category: string;
  units: number;
  revenue: number;
  orderIds: Set<string>;
  schools: Map<string, {
    ico: string;
    schoolName: string;
    units: number;
    revenue: number;
    orderIds: Set<string>;
  }>;
}) {
  return {
    productId: item.productId,
    productName: item.productName,
    category: item.category,
    units: item.units,
    revenue: item.revenue,
    orderCount: item.orderIds.size,
    topSchools: Array.from(item.schools.values())
      .map((school) => ({
        ico: school.ico,
        schoolName: school.schoolName,
        units: school.units,
        revenue: school.revenue,
        orderCount: school.orderIds.size,
      }))
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue || a.schoolName.localeCompare(b.schoolName, 'cs')),
  };
}

async function loadCatalogProducts(requestUrl: string) {
  const baseUrl = getFunctionBaseUrl(requestUrl);
  if (!baseUrl) {
    throw new Error('Missing base URL for product catalog fetch.');
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

  const requestUrl = new URL(req.url);
  const days = parseDays(requestUrl.searchParams.get('days'));
  const since = days === null
    ? null
    : new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const [orders, items, openAlerts, workflowSummary, catalogProducts] = await Promise.all([
      since
        ? sql<OrderRow[]>`
            select
              id,
              order_number,
              created_at,
              paid_at,
              shipped_at,
              delivered_at,
              cancelled_at,
              status,
              payment_status,
              payment_method,
              shipping_method,
              school_name,
              ico,
              total,
              subtotal,
              shipping_price
            from public.orders
            where created_at >= ${since.toISOString()}
            order by created_at asc
          `
        : sql<OrderRow[]>`
            select
              id,
              order_number,
              created_at,
              paid_at,
              shipped_at,
              delivered_at,
              cancelled_at,
              status,
              payment_status,
              payment_method,
              shipping_method,
              school_name,
              ico,
              total,
              subtotal,
              shipping_price
            from public.orders
            order by created_at asc
          `,
      since
        ? sql<OrderItemRow[]>`
            select
              oi.order_id,
              oi.product_id,
              oi.product_name,
              oi.quantity,
              oi.unit_price,
              oi.total_price
            from public.order_items oi
            join public.orders o on o.id = oi.order_id
            where o.created_at >= ${since.toISOString()}
            order by oi.order_id asc
          `
        : sql<OrderItemRow[]>`
            select
              oi.order_id,
              oi.product_id,
              oi.product_name,
              oi.quantity,
              oi.unit_price,
              oi.total_price
            from public.order_items oi
            join public.orders o on o.id = oi.order_id
            order by oi.order_id asc
          `,
      sql<AlertSummaryRow[]>`
        select severity, count(*)::int as total
        from public.order_alerts
        where state = 'open'
        group by severity
      `,
      since
        ? sql<WorkflowSummaryRow[]>`
            select s.status, count(*)::int as total
            from public.order_workflow_steps s
            join public.orders o on o.id = s.order_id
            where o.created_at >= ${since.toISOString()}
            group by s.status
          `
        : sql<WorkflowSummaryRow[]>`
            select status, count(*)::int as total
            from public.order_workflow_steps
            group by status
          `,
      loadCatalogProducts(req.url).catch(() => [] as CatalogProduct[]),
    ]);

    const productById = new Map<string, CatalogProduct>();
    const productByName = new Map<string, CatalogProduct>();
    for (const product of catalogProducts) {
      if (product.id) productById.set(product.id, product);
      if (product.name) productByName.set(normalizeLoose(product.name), product);
    }

    const ordersById = new Map(orders.map((order) => [order.id, order]));
    const revenueOrders = orders.filter(revenueEligible);
    const revenueOrderIds = new Set(revenueOrders.map((order) => order.id));
    const schoolRevenueOrders = revenueOrders.filter((order) => sanitizeIco(order.ico));
    const revenueItems = items.filter((item) => revenueOrderIds.has(item.order_id));

    const trendStart = (() => {
      if (since) return startOfDay(since);
      const firstDate = revenueOrders[0]?.created_at || orders[0]?.created_at;
      return firstDate ? startOfDay(new Date(firstDate)) : startOfDay(new Date());
    })();
    const trendEnd = startOfDay(new Date());
    const trendMap = new Map<string, {
      date: string;
      label: string;
      revenue: number;
      orders: number;
      units: number;
      shipments: number;
      schoolOrders: number;
    }>();

    for (
      let cursor = new Date(trendStart);
      cursor.getTime() <= trendEnd.getTime();
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    ) {
      const key = formatDayKey(cursor);
      trendMap.set(key, {
        date: key,
        label: formatShortDate(key),
        revenue: 0,
        orders: 0,
        units: 0,
        shipments: 0,
        schoolOrders: 0,
      });
    }

    const shippingBreakdown = new Map<string, { method: string; orders: number; revenue: number }>();
    const paymentBreakdown = new Map<string, { method: string; orders: number; revenue: number }>();
    const statusBreakdown = new Map<string, number>();
    const categoryBreakdown = new Map<string, { category: string; revenue: number; units: number; orderIds: Set<string> }>();
    const productBreakdown = new Map<string, {
      productId: string;
      productName: string;
      category: string;
      units: number;
      revenue: number;
      orderIds: Set<string>;
      schools: Map<string, {
        ico: string;
        schoolName: string;
        units: number;
        revenue: number;
        orderIds: Set<string>;
      }>;
    }>();
    const schoolBreakdown = new Map<string, {
      ico: string;
      schoolName: string;
      revenue: number;
      units: number;
      orderCount: number;
      shipmentCount: number;
      lastOrderedAt: string;
      categories: Map<string, number>;
      products: Map<string, number>;
    }>();
    const schoolProductBreakdown = new Map<string, {
      ico: string;
      schoolName: string;
      productId: string;
      productName: string;
      category: string;
      units: number;
      revenue: number;
    }>();

    const hoursToPay: number[] = [];
    const hoursToShip: number[] = [];
    const hoursToDeliver: number[] = [];

    for (const order of orders) {
      statusBreakdown.set(order.status, (statusBreakdown.get(order.status) || 0) + 1);

      if (order.paid_at) {
        const value = (new Date(order.paid_at).getTime() - new Date(order.created_at).getTime()) / 36e5;
        if (Number.isFinite(value) && value >= 0) hoursToPay.push(value);
      }

      if (order.shipped_at) {
        const startAt = order.paid_at || order.created_at;
        const value = (new Date(order.shipped_at).getTime() - new Date(startAt).getTime()) / 36e5;
        if (Number.isFinite(value) && value >= 0) hoursToShip.push(value);

        const shippedKey = formatDayKey(order.shipped_at);
        const current = trendMap.get(shippedKey);
        if (current) current.shipments += 1;
      }

      if (order.delivered_at && order.shipped_at) {
        const value = (new Date(order.delivered_at).getTime() - new Date(order.shipped_at).getTime()) / 36e5;
        if (Number.isFinite(value) && value >= 0) hoursToDeliver.push(value);
      }

      if (!revenueEligible(order)) continue;

      const createdKey = formatDayKey(order.created_at);
      const trend = trendMap.get(createdKey);
      if (trend) {
        trend.revenue += order.total;
        trend.orders += 1;
        if (sanitizeIco(order.ico)) trend.schoolOrders += 1;
      }

      const shippingEntry = shippingBreakdown.get(order.shipping_method) || {
        method: order.shipping_method,
        orders: 0,
        revenue: 0,
      };
      shippingEntry.orders += 1;
      shippingEntry.revenue += order.total;
      shippingBreakdown.set(order.shipping_method, shippingEntry);

      const paymentEntry = paymentBreakdown.get(order.payment_method) || {
        method: order.payment_method,
        orders: 0,
        revenue: 0,
      };
      paymentEntry.orders += 1;
      paymentEntry.revenue += order.total;
      paymentBreakdown.set(order.payment_method, paymentEntry);

      const ico = sanitizeIco(order.ico);
      if (!ico) continue;

      const schoolName = String(order.school_name || order.order_number || 'Bez názvu školy').trim();
      const schoolEntry = schoolBreakdown.get(ico) || {
        ico,
        schoolName,
        revenue: 0,
        units: 0,
        orderCount: 0,
        shipmentCount: 0,
        lastOrderedAt: order.created_at,
        categories: new Map<string, number>(),
        products: new Map<string, number>(),
      };
      schoolEntry.schoolName = schoolEntry.schoolName || schoolName;
      schoolEntry.revenue += order.total;
      schoolEntry.orderCount += 1;
      schoolEntry.shipmentCount += shippedEligible(order) ? 1 : 0;
      schoolEntry.lastOrderedAt = schoolEntry.lastOrderedAt > order.created_at ? schoolEntry.lastOrderedAt : order.created_at;
      schoolBreakdown.set(ico, schoolEntry);
    }

    for (const item of revenueItems) {
      const order = ordersById.get(item.order_id);
      if (!order) continue;

      const productMeta = productById.get(item.product_id) || productByName.get(normalizeLoose(item.product_name));
      const category = String(productMeta?.category || 'Bez kategorie').trim() || 'Bez kategorie';
      const productKey = item.product_id || normalizeLoose(item.product_name);
      const productName = String(productMeta?.name || item.product_name || 'Produkt').trim();

      const createdKey = formatDayKey(order.created_at);
      const trend = trendMap.get(createdKey);
      if (trend) trend.units += item.quantity;

      const categoryEntry = categoryBreakdown.get(category) || {
        category,
        revenue: 0,
        units: 0,
        orderIds: new Set<string>(),
      };
      categoryEntry.revenue += item.total_price;
      categoryEntry.units += item.quantity;
      categoryEntry.orderIds.add(item.order_id);
      categoryBreakdown.set(category, categoryEntry);

      const productEntry = productBreakdown.get(productKey) || {
        productId: item.product_id,
        productName,
        category,
        units: 0,
        revenue: 0,
        orderIds: new Set<string>(),
        schools: new Map<string, {
          ico: string;
          schoolName: string;
          units: number;
          revenue: number;
          orderIds: Set<string>;
        }>(),
      };
      productEntry.units += item.quantity;
      productEntry.revenue += item.total_price;
      productEntry.orderIds.add(item.order_id);
      productBreakdown.set(productKey, productEntry);

      const ico = sanitizeIco(order.ico);
      if (!ico) continue;

      const schoolEntry = schoolBreakdown.get(ico);
      if (!schoolEntry) continue;

      schoolEntry.units += item.quantity;
      schoolEntry.categories.set(category, (schoolEntry.categories.get(category) || 0) + item.total_price);
      schoolEntry.products.set(productName, (schoolEntry.products.get(productName) || 0) + item.total_price);

      const productSchoolEntry = productEntry.schools.get(ico) || {
        ico,
        schoolName: schoolEntry.schoolName,
        units: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };
      productSchoolEntry.units += item.quantity;
      productSchoolEntry.revenue += item.total_price;
      productSchoolEntry.orderIds.add(item.order_id);
      productEntry.schools.set(ico, productSchoolEntry);

      const schoolProductKey = `${ico}:${productKey}`;
      const schoolProductEntry = schoolProductBreakdown.get(schoolProductKey) || {
        ico,
        schoolName: schoolEntry.schoolName,
        productId: item.product_id,
        productName,
        category,
        units: 0,
        revenue: 0,
      };
      schoolProductEntry.units += item.quantity;
      schoolProductEntry.revenue += item.total_price;
      schoolProductBreakdown.set(schoolProductKey, schoolProductEntry);
    }

    const allProducts = Array.from(productBreakdown.values())
      .map(normalizeProductAnalyticsItem);

    const topProductsByRevenue = [...allProducts]
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.productName.localeCompare(b.productName, 'cs'))
      .slice(0, 10);

    const topProductsByUnits = [...allProducts]
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue || a.productName.localeCompare(b.productName, 'cs'))
      .slice(0, 10);

    const topSchools = Array.from(schoolBreakdown.values())
      .map((item) => ({
        ico: item.ico,
        schoolName: item.schoolName,
        revenue: item.revenue,
        units: item.units,
        orderCount: item.orderCount,
        shipmentCount: item.shipmentCount,
        lastOrderedAt: item.lastOrderedAt,
        topCategories: topNamesFromMap(item.categories),
        topProducts: topNamesFromMap(item.products),
      }))
      .sort((a, b) => b.revenue - a.revenue || b.orderCount - a.orderCount || a.schoolName.localeCompare(b.schoolName, 'cs'))
      .slice(0, 10);

    const heatmapSchools = topSchools.slice(0, 6);
    const heatmapSchoolSet = new Set(heatmapSchools.map((item) => item.ico));
    const heatmapProducts = Array.from(schoolProductBreakdown.values())
      .filter((item) => heatmapSchoolSet.has(item.ico))
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
      .reduce<Array<{ productId: string; productName: string; category: string }>>((acc, item) => {
        if (acc.some((current) => current.productId === item.productId && current.productName === item.productName)) {
          return acc;
        }
        if (acc.length >= 8) return acc;
        acc.push({
          productId: item.productId,
          productName: item.productName,
          category: item.category,
        });
        return acc;
      }, []);
    const heatmapProductSet = new Set(heatmapProducts.map((item) => `${item.productId}:${item.productName}`));

    const heatmapCells = Array.from(schoolProductBreakdown.values())
      .filter((item) => heatmapSchoolSet.has(item.ico) && heatmapProductSet.has(`${item.productId}:${item.productName}`))
      .map((item) => ({
        ico: item.ico,
        productId: item.productId,
        productName: item.productName,
        units: item.units,
        revenue: item.revenue,
      }));

    const alertCounts = {
      info: 0,
      warning: 0,
      critical: 0,
    };
    for (const row of openAlerts) {
      if (row.severity === 'info' || row.severity === 'warning' || row.severity === 'critical') {
        alertCounts[row.severity] = row.total;
      }
    }

    const totalRevenue = revenueOrders.reduce((sum, order) => sum + order.total, 0);
    const shipmentCount = orders.filter(shippedEligible).length;
    const totalUnits = revenueItems.reduce((sum, item) => sum + item.quantity, 0);

    return jsonResponse(req, {
      period: {
        days,
        label: days === null ? 'Celé období' : `Posledních ${days} dní`,
        startDate: formatDayKey(trendStart),
        endDate: formatDayKey(trendEnd),
      },
      overview: {
        revenue: totalRevenue,
        orderCount: revenueOrders.length,
        shipmentCount,
        unitsSold: totalUnits,
        averageOrderValue: revenueOrders.length ? Math.round(totalRevenue / revenueOrders.length) : 0,
        schoolRevenue: schoolRevenueOrders.reduce((sum, order) => sum + order.total, 0),
        schoolOrderCount: schoolRevenueOrders.length,
        uniqueSchools: schoolBreakdown.size,
        openAlerts: alertCounts.info + alertCounts.warning + alertCounts.critical,
      },
      charts: {
        trend: Array.from(trendMap.values()),
        categoryBreakdown: Array.from(categoryBreakdown.values())
          .map((item) => ({
            category: item.category,
            revenue: item.revenue,
            units: item.units,
            orders: item.orderIds.size,
          }))
          .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
          .slice(0, 8),
        shippingBreakdown: Array.from(shippingBreakdown.values())
          .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue),
        paymentBreakdown: Array.from(paymentBreakdown.values())
          .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue),
        statusBreakdown: Array.from(statusBreakdown.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status, 'cs')),
      },
      products: {
        allProducts: [...allProducts]
          .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.productName.localeCompare(b.productName, 'cs')),
        topByRevenue: topProductsByRevenue,
        topByUnits: topProductsByUnits,
      },
      schools: {
        topSchools,
        topSchoolProducts: Array.from(schoolProductBreakdown.values())
          .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.schoolName.localeCompare(b.schoolName, 'cs'))
          .slice(0, 20),
        heatmap: {
          schools: heatmapSchools.map((item) => ({
            ico: item.ico,
            schoolName: item.schoolName,
          })),
          products: heatmapProducts,
          cells: heatmapCells,
        },
      },
      operations: {
        alerts: {
          ...alertCounts,
          totalOpen: alertCounts.info + alertCounts.warning + alertCounts.critical,
        },
        workflow: workflowSummary
          .map((row) => ({
            status: row.status,
            count: row.total,
          }))
          .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status, 'cs')),
        averageHoursToPay: average(hoursToPay),
        averageHoursToShip: average(hoursToShip),
        averageHoursToDeliver: average(hoursToDeliver),
      },
    });
  } catch (error) {
    return jsonResponse(req, {
      error: error instanceof Error ? error.message : 'Failed to load admin analytics.',
    }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
