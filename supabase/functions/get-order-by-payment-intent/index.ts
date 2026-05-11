import { resolveAllowedOrigin } from '../_shared/cors.ts';
import postgres from 'npm:postgres';
import { computeOrderTrackingToken, verifyOrderTrackingToken } from '../_shared/order-tracking-token.ts';

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  return (
    Deno.env.get('SUPABASE_DB_URL')
    || Deno.env.get('DATABASE_URL')
    || ''
  );
}

function getTrackingSecret() {
  return (Deno.env.get('ORDER_TRACKING_HMAC_SECRET') || '').trim();
}

function maskEmail(email: string) {
  const [localPart = '', domain = ''] = email.split('@');
  if (!localPart || !domain) return '';
  return `${localPart.slice(0, 1)}***@${domain}`;
}

function shippingLabel(method: string) {
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

type OrderItemRow = {
  product_id: string;
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
  subtotal: number;
  shipping_price: number;
  shipping_method: string;
  pickup_point_name: string | null;
  customer_email: string;
  status: string;
  payment_status: string | null;
  payment_method: string;
  stripe_receipt_url: string | null;
  stripe_payment_intent_id: string | null;
  shipped_at: string | null;
  tracking_number: string | null;
  invoice_status: string | null;
  idoklad_invoice_id: string | null;
  /** Objednávka jen z plakátů — ruční stav v adminu (pending | done). */
  poster_fulfillment_status: string | null;
};

type FulfillmentPhase = {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
};

function buildFulfillmentPayload(order: {
  status: string;
  payment_status: string | null;
  shipped_at: string | null;
  tracking_number: string | null;
  shipping_method: string;
  poster_fulfillment_status: string | null;
}): { phases: FulfillmentPhase[]; courier_label: string } {
  const paid = order.payment_status === 'paid';
  const courier = shippingLabel(order.shipping_method);
  const posterFlow = order.poster_fulfillment_status != null;
  const posterDone = order.poster_fulfillment_status === 'done';

  if (posterFlow) {
    let transitDetail: string | undefined;
    if (posterDone && order.tracking_number?.trim()) {
      transitDetail = `Sledovací číslo: ${order.tracking_number.trim()}`;
    }
    return {
      courier_label: courier,
      phases: [
        { key: 'received', label: 'Objednávka přijata', done: true },
        { key: 'paid', label: 'Objednávka zaplacena', done: paid },
        { key: 'printing', label: 'Objednávka se tiskne', done: posterDone },
        {
          key: 'transit',
          label: 'Objednávka je na cestě k vám',
          done: posterDone,
          detail: transitDetail,
        },
      ],
    };
  }

  /**
   * `exported` / `processing` = v naší DB včetně přenosu do BaseLinker/FF (např. „Vytvořeno v FF“),
   * ještě to není „zabaleno“ ani odesláno. Sklad + kurýr až u `shipped` / `delivered`.
   */
  const leftWarehouse = ['shipped', 'delivered'].includes(order.status);

  let phase4Detail: string | undefined;
  if (leftWarehouse) {
    phase4Detail = `Předáno kurýrovi ${courier}`;
  } else if (order.tracking_number?.trim()) {
    phase4Detail = `Sledovací číslo: ${order.tracking_number.trim()}`;
  }

  return {
    courier_label: courier,
    phases: [
      { key: 'received', label: 'Objednávka přijata', done: true },
      { key: 'paid', label: 'Objednávka zaplacena', done: paid },
      { key: 'packed', label: 'Objednávka je zabalena', done: leftWarehouse },
      {
        key: 'transit',
        label: 'Objednávka je na cestě k vám',
        done: leftWarehouse,
        detail: phase4Detail,
      },
    ],
  };
}

async function buildOrderSummaryResponse(
  sql: ReturnType<typeof postgres>,
  order: OrderHeadRow,
  transferThankYou: boolean,
) {
  const items = await sql<OrderItemRow[]>`
    select
      product_id,
      product_name,
      variant,
      quantity,
      unit_price,
      total_price
    from public.order_items
    where order_id = ${order.id}::uuid
    order by id asc
  `;

  const secret = getTrackingSecret();
  let tracking_token: string | null = null;
  if (secret) {
    try {
      tracking_token = await computeOrderTrackingToken(order.id, secret);
    } catch {
      tracking_token = null;
    }
  }

  const fulfillment = buildFulfillmentPayload(order);
  const invoice_ready = order.invoice_status === 'done' && Boolean(order.idoklad_invoice_id?.trim());

  return jsonResponse(req, {
    order_number: order.order_number,
    total: order.total,
    subtotal: order.subtotal,
    shipping_price: order.shipping_price,
    shipping_method: order.shipping_method,
    shipping_method_label: shippingLabel(order.shipping_method),
    pickup_point_name: order.pickup_point_name,
    customer_email: maskEmail(order.customer_email),
    status: order.status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    transfer_flow: transferThankYou,
    stripe_receipt_url: order.stripe_receipt_url,
    stripe_payment_intent_id: order.stripe_payment_intent_id,
    tracking_number: order.tracking_number,
    shipped_at: order.shipped_at,
    invoice_ready,
    tracking_token,
    fulfillment,
    items,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  if (req.method !== 'GET') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse(req, { error: 'Missing database configuration.' }, 500);
  }

  const url = new URL(req.url);
  const paymentIntentId = (url.searchParams.get('payment_intent_id') || '').trim();
  const orderNumber = (
    url.searchParams.get('order')?.trim()
    || url.searchParams.get('order_number')?.trim()
    || ''
  );
  const transferThankYou = url.searchParams.get('transfer') === '1';
  const trackingTokenParam = (url.searchParams.get('t') || '').trim();
  const emailParamRaw = (url.searchParams.get('email') || '').trim();
  const emailParamNorm = emailParamRaw.toLowerCase();

  if (!paymentIntentId && !orderNumber) {
    return jsonResponse(req, { error: 'Missing payment_intent_id or order (order_number).' }, 400);
  }

  if (paymentIntentId && orderNumber) {
    return jsonResponse(req, { error: 'Provide only one of payment_intent_id or order.' }, 400);
  }

  if (orderNumber.length > 80) {
    return jsonResponse(req, { error: 'Invalid order reference.' }, 400);
  }

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
          subtotal,
          shipping_price,
          shipping_method,
          pickup_point_name,
          customer_email,
          status,
          payment_status,
          payment_method,
          stripe_receipt_url,
          stripe_payment_intent_id,
          shipped_at,
          tracking_number,
          invoice_status,
          idoklad_invoice_id,
          poster_fulfillment_status
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
          subtotal,
          shipping_price,
          shipping_method,
          pickup_point_name,
          customer_email,
          status,
          payment_status,
          payment_method,
          stripe_receipt_url,
          stripe_payment_intent_id,
          shipped_at,
          tracking_number,
          invoice_status,
          idoklad_invoice_id,
          poster_fulfillment_status
        from public.orders
        where order_number = ${orderNumber}
        limit 1
      `;
    }

    const order = rows[0];
    if (!order) {
      return jsonResponse(req, { error: 'Order not found.' }, 404);
    }

    /**
     * Stejné ověření jako u čísla objednávky — PI z URL nesmí stačit samo (uniká např. z přesměrování Stripe).
     * Děkovná stránka u převodu (`transfer=1`) zůstává bez e-mailu/tokenu (jako dřív u order_number).
     */
    const needProof =
      (orderNumber && !paymentIntentId && !transferThankYou)
      || (paymentIntentId && !orderNumber && !transferThankYou);
    if (needProof) {
      const secret = getTrackingSecret();
      const tokenOk =
        Boolean(secret && trackingTokenParam)
        && await verifyOrderTrackingToken(order.id, secret, trackingTokenParam);
      const emailOk =
        emailParamNorm.includes('@')
        && order.customer_email.trim().toLowerCase() === emailParamNorm;
      if (!tokenOk && !emailOk) {
        return jsonResponse(req, {
          error:
            'Neplatný odkaz ke sledování. Použijte celý odkaz z e-mailu, nebo zadejte e-mail z objednávky na stránce sledování.',
        }, 403);
      }
    }

    const paidOk = order.payment_status === 'paid';
    const transferPending =
      transferThankYou
      && order.payment_method === 'transfer'
      && order.status === 'pending_payment';

    if (!paidOk && !transferPending) {
      return jsonResponse(req, { error: 'Order not found.' }, 404);
    }

    return await buildOrderSummaryResponse(sql, order, transferThankYou);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order lookup failed.';
    return jsonResponse(req, { error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
