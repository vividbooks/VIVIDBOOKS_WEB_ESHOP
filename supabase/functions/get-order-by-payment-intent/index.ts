import postgres from 'npm:postgres';

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

function getDatabaseUrl() {
  return (
    Deno.env.get('SUPABASE_DB_URL')
    || Deno.env.get('DATABASE_URL')
    || ''
  );
}

function maskEmail(email: string) {
  const [localPart = '', domain = ''] = email.split('@');
  if (!localPart || !domain) return '';
  return `${localPart.slice(0, 1)}***@${domain}`;
}

type OrderItemRow = {
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type OrderHeadRow = {
  id: string;
  order_number: string;
  total: number;
  shipping_method: string;
  pickup_point_name: string | null;
  customer_email: string;
  status: string;
  payment_status: string | null;
};

async function buildOrderSummaryResponse(
  sql: ReturnType<typeof postgres>,
  order: OrderHeadRow,
) {
  const items = await sql<OrderItemRow[]>`
    select
      product_name,
      variant,
      quantity,
      unit_price,
      total_price
    from public.order_items
    where order_id = ${order.id}::uuid
    order by id asc
  `;

  return jsonResponse({
    order_number: order.order_number,
    total: order.total,
    shipping_method: order.shipping_method,
    pickup_point_name: order.pickup_point_name,
    customer_email: maskEmail(order.customer_email),
    status: order.status,
    items,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing database configuration.' }, 500);
  }

  const url = new URL(req.url);
  const paymentIntentId = (url.searchParams.get('payment_intent_id') || '').trim();
  const orderNumber = (
    url.searchParams.get('order')?.trim()
    || url.searchParams.get('order_number')?.trim()
    || ''
  );

  if (!paymentIntentId && !orderNumber) {
    return jsonResponse({ error: 'Missing payment_intent_id or order (order_number).' }, 400);
  }

  if (paymentIntentId && orderNumber) {
    return jsonResponse({ error: 'Provide only one of payment_intent_id or order.' }, 400);
  }

  if (orderNumber.length > 80) {
    return jsonResponse({ error: 'Invalid order reference.' }, 400);
  }

  // TODO: Add real per-IP rate limiting here (max 10 req/min), e.g. using Upstash Redis or another shared store.
  // Stripe return page is anonymous, so this endpoint must stay public but narrowly scoped.

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    let rows: OrderHeadRow[];

    if (paymentIntentId) {
      rows = await sql<OrderHeadRow[]>`
        select
          id,
          order_number,
          total,
          shipping_method,
          pickup_point_name,
          customer_email,
          status,
          payment_status
        from public.orders
        where stripe_payment_intent_id = ${paymentIntentId}
        limit 1
      `;
    } else {
      rows = await sql<OrderHeadRow[]>`
        select
          id,
          order_number,
          total,
          shipping_method,
          pickup_point_name,
          customer_email,
          status,
          payment_status
        from public.orders
        where order_number = ${orderNumber}
        limit 1
      `;
    }

    const order = rows[0];
    if (!order || order.payment_status !== 'paid') {
      return jsonResponse({ error: 'Order not found.' }, 404);
    }

    return await buildOrderSummaryResponse(sql, order);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order lookup failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
