import Stripe from 'npm:stripe';
import postgres from 'npm:postgres';
import { ensureWorkflowSteps, upsertWorkflowStep } from '../_shared/order-monitoring.ts';

type OrderItemMetadata = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  variant?: string;
  bundleId?: string;
  bundleTitle?: string;
  /** Položka z košíku označená jako plakát / merch „na objednávku“ — celá objednávka jen z těchto položek nejde do Base.com. */
  posterMerch?: boolean;
};

function isPosterOnlyOrder(items: OrderItemMetadata[]): boolean {
  return items.length > 0 && items.every((i) => i.posterMerch === true);
}

type CustomerMetadata = {
  email: string;
  name: string;
  phone: string;
  schoolName?: string;
  ico?: string;
  street: string;
  city: string;
  zip: string;
};

type ShippingMetadata = {
  method: string;
  price: number;
  pickupPointId?: string;
  pickupPointName?: string;
};

type CheckoutSessionRow = {
  cart_data: OrderItemMetadata[];
  customer_data: CustomerMetadata;
  shipping_data: ShippingMetadata;
  school_inquiry: unknown | null;
};

type OrderEmailType = 'order_confirmed' | 'order_shipped' | 'order_cancelled';

function parseJsonValue<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function normalizeItems(value: unknown): OrderItemMetadata[] {
  const parsed = parseJsonValue<unknown>(value);
  if (Array.isArray(parsed)) {
    return parsed as OrderItemMetadata[];
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown[] }).items)) {
    return (parsed as { items: OrderItemMetadata[] }).items;
  }
  throw new Error('Invalid cart_data in checkout_sessions.');
}

function normalizeCustomer(value: unknown): CustomerMetadata {
  const parsed = parseJsonValue<unknown>(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as CustomerMetadata;
  }
  throw new Error('Invalid customer_data in checkout_sessions.');
}

function normalizeShipping(value: unknown): ShippingMetadata {
  const parsed = parseJsonValue<unknown>(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as ShippingMetadata;
  }
  throw new Error('Invalid shipping_data in checkout_sessions.');
}

function okResponse() {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getDatabaseUrl() {
  return (
    Deno.env.get('SUPABASE_DB_URL')
    || Deno.env.get('DATABASE_URL')
    || ''
  );
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

function getSendOrderEmailUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/send-order-email` : '';
}

function getProcessExportQueueUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/process-export-queue` : '';
}

function getMakeServerOrdersUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/make-server-93a20b6f/orders` : '';
}

function getEshopPipedriveSyncUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/make-server-93a20b6f/eshop/pipedrive-sync` : '';
}

function extractStripeReceiptUrl(paymentIntent: Stripe.PaymentIntent): string | null {
  const lc = paymentIntent.latest_charge;
  if (lc && typeof lc === 'object' && 'receipt_url' in lc) {
    const u = (lc as Stripe.Charge).receipt_url;
    return typeof u === 'string' && u.trim() ? u.trim() : null;
  }
  return null;
}

/** Minimální tělo /orders, když chybí school_inquiry (starší klienti). */
function buildSchoolOrdersBodyFallback(
  customer: CustomerMetadata,
  shipping: ShippingMetadata,
  items: OrderItemMetadata[],
): Record<string, unknown> {
  const workbookItems = items.map((it) => ({
    id: it.productId,
    name: it.productName,
    price: `${Math.round(it.unitPrice / 100)},- Kč`,
    quantity: it.quantity,
  }));
  return {
    customer: { ...customer },
    deliveryAddress: null,
    digital: null,
    vividboard: null,
    workbooks: workbookItems.length
      ? {
        items: workbookItems,
        total: 0,
        totalItems: items.reduce((s, it) => s + it.quantity, 0),
      }
      : null,
    subjects: [],
    types: ['workbook'],
    hasSeparateDeliveryAddress: false,
    shipping: {
      method: shipping.method,
      price: shipping.price,
      pickupPointId: shipping.pickupPointId ?? null,
      pickupPointName: shipping.pickupPointName ?? null,
      pickupPointStreet: null,
      pickupPointCity: null,
      pickupPointZip: null,
    },
    paymentPreference: 'card',
  };
}

type SqlClient = ReturnType<typeof postgres>;

async function forwardSchoolInquiryToMakeServer(
  sql: SqlClient,
  opts: {
    eshopOrderId: string;
    paymentIntentId: string;
    schoolInquiry: unknown | null;
    orderSource: string | undefined;
    customer: CustomerMetadata;
    shipping: ShippingMetadata;
    items: OrderItemMetadata[];
    fallbackRequestUrl?: string;
  },
) {
  const {
    eshopOrderId,
    paymentIntentId,
    schoolInquiry,
    orderSource,
    customer,
    shipping,
    items,
    fallbackRequestUrl,
  } = opts;

  const hasStoredInquiry = schoolInquiry != null && typeof schoolInquiry === 'object' && !Array.isArray(schoolInquiry);
  const isSchoolObjednat = orderSource === 'school_objednat' || hasStoredInquiry;

  if (!isSchoolObjednat) {
    return;
  }

  const url = getMakeServerOrdersUrl(fallbackRequestUrl);
  if (!url) {
    console.error('[stripe-webhook] Missing base URL for make-server /orders.');
    return;
  }

  const headers = getFunctionAuthHeaders();
  if (!headers.Authorization) {
    console.error('[stripe-webhook] Missing anon/service key for make-server /orders.');
    return;
  }

  const claimed = await sql<{ id: string }[]>`
    update public.orders
    set school_pipedrive_forwarded_at = now()
    where id = ${eshopOrderId}::uuid
      and school_pipedrive_forwarded_at is null
    returning id
  `;

  if (claimed.length === 0) {
    return;
  }

  const baseBody = hasStoredInquiry
    ? { ...(schoolInquiry as Record<string, unknown>) }
    : buildSchoolOrdersBodyFallback(customer, shipping, items);

  const body = {
    ...baseBody,
    paidViaStripe: true,
    paidViaStripeSchoolFlow: true,
    eshopOrderId,
    stripePaymentIntentId: paymentIntentId,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `orders HTTP ${response.status}`);
    }

    console.log(
      '[stripe-webhook] School inquiry forwarded to make-server /orders for order',
      eshopOrderId,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[stripe-webhook] make-server /orders forward failed:', message);
    try {
      await sql`
        update public.orders
        set school_pipedrive_forwarded_at = null
        where id = ${eshopOrderId}::uuid
      `;
    } catch (revertErr) {
      console.error('[stripe-webhook] Failed to revert school_pipedrive_forwarded_at:', revertErr);
    }
  }
}

function extractChargeId(paymentIntent: Stripe.PaymentIntent): string | null {
  const lc = paymentIntent.latest_charge;
  if (typeof lc === 'string') return lc;
  if (lc && typeof lc === 'object' && 'id' in lc) return String((lc as { id: string }).id);
  return null;
}

function getFunctionAuthHeaders() {
  const functionKey = (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || Deno.env.get('PROJECT_PUBLIC_ANON_KEY')
    || Deno.env.get('PUBLIC_ANON_KEY')
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

async function invokeOrderEmail(orderId: string, emailType: OrderEmailType, fallbackRequestUrl?: string) {
  const url = getSendOrderEmailUrl(fallbackRequestUrl);
  if (!url) {
    throw new Error('Missing base URL for send-order-email invocation.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getFunctionAuthHeaders(),
    },
    body: JSON.stringify({ orderId, emailType }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `send-order-email HTTP ${response.status}`);
  }
}

async function invokeProcessExportQueue(fallbackRequestUrl?: string) {
  const url = getProcessExportQueueUrl(fallbackRequestUrl);
  if (!url) {
    throw new Error('Missing base URL for process-export-queue invocation.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getFunctionAuthHeaders(),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `process-export-queue HTTP ${response.status}`);
  }
}

async function invokeEshopPipedriveSync(
  orderId: string,
  mode: 'b2c_card_won' | 'b2b_card_won',
  fallbackRequestUrl?: string,
) {
  const url = getEshopPipedriveSyncUrl(fallbackRequestUrl);
  if (!url) {
    throw new Error('Missing base URL for eshop/pipedrive-sync invocation.');
  }
  const headers = getFunctionAuthHeaders();
  if (!headers.Authorization) {
    throw new Error('Missing service key for eshop/pipedrive-sync.');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ orderId, mode }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `eshop/pipedrive-sync HTTP ${response.status}`);
  }
}

type PendingOrderFallbackRow = {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  school_name: string | null;
  ico: string | null;
  street: string;
  city: string;
  zip: string;
  shipping_method: string;
  shipping_price: number;
  pickup_point_id: string | null;
  pickup_point_name: string | null;
};

type OrderItemFallbackRow = {
  product_id: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  bundle_id: string | null;
  bundle_title: string | null;
};

/**
 * Košík + zákazník pro webhook: checkout_sessions (canonical),
 * doplnění session UUID z orders.checkout_session_id když Stripe metadata chybí,
 * případně rekonstrukce z pending řádku orders + order_items.
 */
async function loadCheckoutContextForSucceededPayment(
  sql: SqlClient,
  paymentIntent: Stripe.PaymentIntent,
): Promise<{
  items: OrderItemMetadata[];
  customer: CustomerMetadata;
  shipping: ShippingMetadata;
  schoolInquiry: unknown | null;
}> {
  let checkoutSessionId = String(paymentIntent.metadata?.checkout_session_id ?? '').trim();

  if (!checkoutSessionId) {
    const oidRows = await sql<{ checkout_session_id: string | null }[]>`
      select checkout_session_id
      from public.orders
      where stripe_payment_intent_id = ${paymentIntent.id}
      limit 1
    `;
    const fromOrder = oidRows[0]?.checkout_session_id;
    if (fromOrder) checkoutSessionId = String(fromOrder).trim();
  }

  if (checkoutSessionId) {
    const checkoutSessionRows = await sql<CheckoutSessionRow[]>`
      select
        cart_data,
        customer_data,
        shipping_data,
        school_inquiry
      from public.checkout_sessions
      where id = ${checkoutSessionId}::uuid
      limit 1
    `;
    const checkoutSession = checkoutSessionRows[0];
    if (checkoutSession) {
      return {
        items: normalizeItems(checkoutSession.cart_data),
        customer: normalizeCustomer(checkoutSession.customer_data),
        shipping: normalizeShipping(checkoutSession.shipping_data),
        schoolInquiry: checkoutSession.school_inquiry ?? null,
      };
    }
    console.warn(
      '[stripe-webhook] checkout_sessions row missing; rebuilding from orders',
      paymentIntent.id,
      checkoutSessionId,
    );
  } else {
    console.warn(
      '[stripe-webhook] No checkout_session_id on PI or order; rebuilding from pending order',
      paymentIntent.id,
    );
  }

  const pendingRows = await sql<PendingOrderFallbackRow[]>`
    select
      id,
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
      pickup_point_name
    from public.orders
    where stripe_payment_intent_id = ${paymentIntent.id}
      and status = 'pending_payment'
    limit 1
  `;
  const po = pendingRows[0];
  if (!po) {
    throw new Error(
      `Cannot resolve checkout context for PaymentIntent ${paymentIntent.id} (no session, no pending order).`,
    );
  }

  const itemRows = await sql<OrderItemFallbackRow[]>`
    select
      product_id,
      product_name,
      variant,
      quantity,
      unit_price,
      bundle_id,
      bundle_title
    from public.order_items
    where order_id = ${po.id}::uuid
  `;

  if (itemRows.length === 0) {
    throw new Error(`Order ${po.id} has no items for webhook fallback.`);
  }

  const customer: CustomerMetadata = {
    email: po.customer_email.trim(),
    name: po.customer_name.trim(),
    phone: (po.customer_phone ?? '').trim(),
    ...(po.school_name?.trim() ? { schoolName: po.school_name.trim() } : {}),
    ...(po.ico?.trim() ? { ico: po.ico.trim() } : {}),
    street: po.street.trim(),
    city: po.city.trim(),
    zip: po.zip.trim(),
  };

  const shipping: ShippingMetadata = {
    method: po.shipping_method,
    price: Number.isInteger(po.shipping_price) ? po.shipping_price : 0,
    ...(po.pickup_point_id?.trim() ? { pickupPointId: po.pickup_point_id.trim() } : {}),
    ...(po.pickup_point_name?.trim() ? { pickupPointName: po.pickup_point_name.trim() } : {}),
  };

  const items: OrderItemMetadata[] = itemRows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    ...(row.variant?.trim() ? { variant: row.variant.trim() } : {}),
    ...(row.bundle_id?.trim()
      ? {
        bundleId: row.bundle_id.trim(),
        ...(row.bundle_title?.trim() ? { bundleTitle: row.bundle_title.trim() } : {}),
      }
      : {}),
  }));

  return {
    items,
    customer,
    shipping,
    schoolInquiry: null,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405);
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const databaseUrl = getDatabaseUrl();

  if (!stripeSecretKey || !stripeWebhookSecret || !databaseUrl) {
    console.error('[stripe-webhook] Missing required environment variables.');
    return errorResponse('Missing required environment variables.');
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error('[stripe-webhook] Missing stripe-signature header.');
    return errorResponse('Missing stripe-signature header.', 400);
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe signature.';
    console.error('[stripe-webhook] Signature verification failed:', message);
    return errorResponse(message, 400);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  let knownOrderId: string | null = null;
  let currentEventType = event.type;
  let currentPaymentIntentId: string | null = null;
  let createdOrderId: string | null = null;

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        (event.data.object as Stripe.PaymentIntent).id,
        { expand: ['latest_charge'] },
      );
      currentPaymentIntentId = paymentIntent.id;
      const receiptUrl = extractStripeReceiptUrl(paymentIntent);
      const { items, customer, shipping, schoolInquiry } = await loadCheckoutContextForSucceededPayment(
        sql,
        paymentIntent,
      );
      const posterOnly = isPosterOnlyOrder(items);

      const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const total = subtotal + (Number.isInteger(shipping.price) ? shipping.price : 0);

      try {
        await sql.begin(async (tx) => {
          const locked = await tx<{ id: string; status: string; order_number: string }[]>`
            select id, status, order_number
            from public.orders
            where stripe_payment_intent_id = ${paymentIntent.id}
            for update
            limit 1
          `;

          const existing = locked[0];
          const pm =
            paymentIntent.metadata?.payment_method
            || paymentIntent.payment_method_types?.[0]
            || 'card';
          const chargeId = extractChargeId(paymentIntent);

          if (existing) {
            knownOrderId = existing.id;
            if (existing.status === 'paid') {
              return;
            }
            if (existing.status === 'pending_payment') {
              const updated = await tx<{ id: string; order_number: string }[]>`
                update public.orders
                set
                  status = 'paid',
                  payment_status = 'paid',
                  stripe_charge_id = ${chargeId},
                  stripe_receipt_url = ${receiptUrl},
                  payment_method = ${pm},
                  paid_at = now(),
                  updated_at = now(),
                  poster_fulfillment_status = ${posterOnly ? 'pending' : null},
                  basecom_status = ${posterOnly ? 'skipped' : 'pending'}
                where id = ${existing.id}::uuid
                  and status = 'pending_payment'
                returning id, order_number
              `;
              if (updated.length === 0) {
                return;
              }
              const order = updated[0];
              createdOrderId = order.id;

              const eqCount = await tx<{ c: number }[]>`
                select count(*)::int as c
                from public.export_queue
                where order_id = ${order.id}::uuid
              `;
              if ((eqCount[0]?.c ?? 0) === 0) {
                if (!posterOnly) {
                  await tx`
                    insert into public.export_queue (
                      order_id,
                      service,
                      status,
                      payload
                    ) values (
                      ${order.id},
                      'basecom',
                      'pending',
                      ${JSON.stringify({ orderId: order.id, paymentIntentId: paymentIntent.id, items, customer, shipping })}::jsonb
                    )
                  `;
                }
                await tx`
                  insert into public.export_queue (
                    order_id,
                    service,
                    status,
                    payload
                  ) values (
                    ${order.id},
                    'idoklad',
                    'pending',
                    ${JSON.stringify({ orderId: order.id, paymentIntentId: paymentIntent.id })}::jsonb
                  )
                `;
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
                  ${order.id},
                  'payment',
                  'pending_payment',
                  'paid',
                  ${JSON.stringify({
                    stripeEventId: event.id,
                    paymentIntentId: paymentIntent.id,
                    amount: paymentIntent.amount,
                    path: 'pending_upgrade',
                  })}::jsonb,
                  'stripe'
                )
              `;

              await ensureWorkflowSteps(tx, order.id);
              await upsertWorkflowStep(tx, {
                orderId: order.id,
                stepKey: 'payment_received',
                status: 'done',
                metadata: {
                  stripeEventId: event.id,
                  paymentIntentId: paymentIntent.id,
                  amount: paymentIntent.amount,
                },
              });
              await upsertWorkflowStep(tx, {
                orderId: order.id,
                stepKey: 'order_persisted',
                status: 'done',
                metadata: {
                  orderNumber: order.order_number,
                },
              });
              if (posterOnly) {
                await upsertWorkflowStep(tx, {
                  orderId: order.id,
                  stepKey: 'basecom_exported',
                  status: 'skipped',
                  metadata: { reason: 'poster_only_order' },
                });
              }
              return;
            }

            console.warn(
              '[stripe-webhook] Order exists for PI but not pending/paid:',
              paymentIntent.id,
              existing.status,
            );
            return;
          }

          const insertedOrders = await tx<{ id: string; order_number: string }[]>`
            insert into public.orders (
              status,
              customer_email,
              customer_name,
              customer_phone,
              school_name,
              ico,
              street,
              city,
              zip,
              country,
              shipping_method,
              shipping_price,
              pickup_point_id,
              pickup_point_name,
              payment_method,
              payment_status,
              stripe_payment_intent_id,
              stripe_charge_id,
              stripe_receipt_url,
              subtotal,
              total,
              paid_at,
              poster_fulfillment_status,
              basecom_status
            ) values (
              'paid',
              ${customer.email},
              ${customer.name},
              ${customer.phone},
              ${customer.schoolName ?? null},
              ${customer.ico ?? null},
              ${customer.street},
              ${customer.city},
              ${customer.zip},
              'CZ',
              ${shipping.method},
              ${shipping.price ?? 0},
              ${shipping.pickupPointId ?? null},
              ${shipping.pickupPointName ?? null},
              ${pm},
              'paid',
              ${paymentIntent.id},
              ${chargeId},
              ${receiptUrl},
              ${subtotal},
              ${total},
              now(),
              ${posterOnly ? 'pending' : null},
              ${posterOnly ? 'skipped' : 'pending'}
            )
            returning id, order_number
          `;

          const order = insertedOrders[0];
          knownOrderId = order.id;
          createdOrderId = order.id;

          for (const item of items) {
            const variant = typeof item.variant === 'string' && item.variant.trim()
              ? item.variant.trim()
              : null;
            const bundleId = typeof item.bundleId === 'string' && item.bundleId.trim()
              ? item.bundleId.trim()
              : null;
            const bundleTitle = typeof item.bundleTitle === 'string' && item.bundleTitle.trim()
              ? item.bundleTitle.trim()
              : null;
            await tx`
              insert into public.order_items (
                order_id,
                product_id,
                product_name,
                variant,
                quantity,
                unit_price,
                total_price,
                bundle_id,
                bundle_title
              ) values (
                ${order.id},
                ${item.productId},
                ${item.productName},
                ${variant},
                ${item.quantity},
                ${item.unitPrice},
                ${item.unitPrice * item.quantity},
                ${bundleId},
                ${bundleTitle}
              )
            `;
          }

          if (!posterOnly) {
            await tx`
              insert into public.export_queue (
                order_id,
                service,
                status,
                payload
              ) values (
                ${order.id},
                'basecom',
                'pending',
                ${JSON.stringify({ orderId: order.id, paymentIntentId: paymentIntent.id, items, customer, shipping })}::jsonb
              )
            `;
          }
          await tx`
            insert into public.export_queue (
              order_id,
              service,
              status,
              payload
            ) values (
              ${order.id},
              'idoklad',
              'pending',
              ${JSON.stringify({ orderId: order.id, paymentIntentId: paymentIntent.id })}::jsonb
            )
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
              ${order.id},
              'payment',
              null,
              'paid',
              ${JSON.stringify({
                stripeEventId: event.id,
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                path: 'legacy_insert',
              })}::jsonb,
              'stripe'
            )
          `;

          await ensureWorkflowSteps(tx, order.id);
          await upsertWorkflowStep(tx, {
            orderId: order.id,
            stepKey: 'payment_received',
            status: 'done',
            metadata: {
              stripeEventId: event.id,
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
            },
          });
          await upsertWorkflowStep(tx, {
            orderId: order.id,
            stepKey: 'order_persisted',
            status: 'done',
            metadata: {
              orderNumber: order.order_number,
            },
          });
          if (posterOnly) {
            await upsertWorkflowStep(tx, {
              orderId: order.id,
              stepKey: 'basecom_exported',
              status: 'skipped',
              metadata: { reason: 'poster_only_order' },
            });
          }
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          console.log('[stripe-webhook] Duplicate payment_intent handled idempotently:', paymentIntent.id);
          return okResponse();
        }

        throw error;
      }

      if (createdOrderId) {
        const hasStoredInquiry =
          schoolInquiry != null
          && typeof schoolInquiry === 'object'
          && !Array.isArray(schoolInquiry);
        const isSchoolObjednat =
          paymentIntent.metadata?.order_source === 'school_objednat' || hasStoredInquiry;

        const icoNorm = String(customer.ico || '').trim().replace(/\s/g, '');
        const schoolNameTrim = String((customer as { schoolName?: string }).schoolName || '').trim();
        /** B2B i pro objednávku bez IČO, ale s vyplněnou školou — vznikne organizace v Pipedrive (matchování pak podle názvu),
         *  jinak by deal pro „test PŘGO gymnázium…" skončil jako B2C bez org a obchod by neviděl, že je to škola. */
        const eshopPipedriveMode: 'b2c_card_won' | 'b2b_card_won' =
          (icoNorm || schoolNameTrim) ? 'b2b_card_won' : 'b2c_card_won';

        const [emailResult, exportQueueResult, schoolOrdersResult, pipedriveSyncResult] = await Promise.allSettled([
          invokeOrderEmail(createdOrderId, 'order_confirmed', req.url),
          invokeProcessExportQueue(req.url),
          forwardSchoolInquiryToMakeServer(sql, {
            eshopOrderId: createdOrderId,
            paymentIntentId: paymentIntent.id,
            schoolInquiry,
            orderSource: paymentIntent.metadata?.order_source,
            customer,
            shipping,
            items,
            fallbackRequestUrl: req.url,
          }),
          isSchoolObjednat
            ? Promise.resolve()
            : invokeEshopPipedriveSync(createdOrderId, eshopPipedriveMode, req.url),
        ]);

        if (emailResult.status === 'rejected') {
          const message = emailResult.reason instanceof Error ? emailResult.reason.message : 'Unknown send-order-email invocation error.';
          console.error('[stripe-webhook] send-order-email invocation failed:', message);
          await upsertWorkflowStep(sql, {
            orderId: createdOrderId,
            stepKey: 'customer_email_sent',
            status: 'failed',
            lastError: message,
            metadata: {
              source: 'stripe-webhook',
              emailType: 'order_confirmed',
            },
          });
        }

        if (exportQueueResult.status === 'rejected') {
          const message = exportQueueResult.reason instanceof Error ? exportQueueResult.reason.message : 'Unknown process-export-queue invocation error.';
          console.error('[stripe-webhook] process-export-queue invocation failed:', message);
          await upsertWorkflowStep(sql, {
            orderId: createdOrderId,
            stepKey: 'basecom_exported',
            status: 'failed',
            lastError: message,
            metadata: {
              source: 'stripe-webhook',
              handoff: 'process-export-queue',
            },
          });
        }

        if (schoolOrdersResult.status === 'rejected') {
          const message = schoolOrdersResult.reason instanceof Error
            ? schoolOrdersResult.reason.message
            : 'Unknown school /orders forward error.';
          console.error('[stripe-webhook] make-server /orders forward invocation failed:', message);
        }

        if (pipedriveSyncResult.status === 'rejected' && !isSchoolObjednat) {
          const message = pipedriveSyncResult.reason instanceof Error
            ? pipedriveSyncResult.reason.message
            : 'Unknown eshop/pipedrive-sync error.';
          console.error('[stripe-webhook] eshop/pipedrive-sync invocation failed:', message);
        }
      }

      return okResponse();
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      currentPaymentIntentId = paymentIntent.id;

      await sql.begin(async (tx) => {
        const existingOrders = await tx<{ id: string; status: string }[]>`
          select id, status
          from public.orders
          where stripe_payment_intent_id = ${paymentIntent.id}
          limit 1
        `;

        const order = existingOrders[0];
        if (!order) return;
        knownOrderId = order.id;

        if (order.status === 'pending_payment') {
          await tx`
            insert into public.order_events (
              order_id,
              event_type,
              from_status,
              to_status,
              details,
              actor
            ) values (
              ${order.id},
              'payment_attempt_failed',
              'pending_payment',
              'pending_payment',
              ${JSON.stringify({
                stripeEventId: event.id,
                paymentIntentId: paymentIntent.id,
                lastPaymentError: paymentIntent.last_payment_error?.message ?? null,
                note: 'Order stays pending_payment for resume/retry.',
              })}::jsonb,
              'stripe'
            )
          `;
          return;
        }

        await tx`
          update public.orders
          set
            status = 'failed',
            payment_status = 'failed'
          where id = ${order.id}
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
            ${order.id},
            'payment',
            ${order.status},
            'failed',
            ${JSON.stringify({
              stripeEventId: event.id,
              paymentIntentId: paymentIntent.id,
              lastPaymentError: paymentIntent.last_payment_error?.message ?? null,
            })}::jsonb,
            'stripe'
          )
        `;

        await ensureWorkflowSteps(tx, order.id);
        await upsertWorkflowStep(tx, {
          orderId: order.id,
          stepKey: 'payment_received',
          status: 'failed',
          lastError: paymentIntent.last_payment_error?.message ?? 'Stripe payment failed.',
          metadata: {
            stripeEventId: event.id,
            paymentIntentId: paymentIntent.id,
          },
        });
      });

      return okResponse();
    }

    return okResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error.';
    console.error('[stripe-webhook] Processing failed:', message);

    if (knownOrderId) {
      try {
        const existingOrder = await sql<{ id: string }[]>`
          select id
          from public.orders
          where id = ${knownOrderId}::uuid
          limit 1
        `;

        if (existingOrder.length > 0) {
          await upsertWorkflowStep(sql, {
            orderId: knownOrderId,
            stepKey: 'payment_received',
            status: 'failed',
            lastError: message,
            metadata: {
              stripeEventId: event.id,
              paymentIntentId: currentPaymentIntentId,
              eventType: currentEventType,
            },
          });
          await sql`
            insert into public.order_events (
              order_id,
              event_type,
              from_status,
              to_status,
              details,
              actor
            ) values (
              ${knownOrderId}::uuid,
              'payment',
              null,
              null,
              ${JSON.stringify({
                stripeEventId: event.id,
                paymentIntentId: currentPaymentIntentId,
                eventType: currentEventType,
                processingError: message,
              })}::jsonb,
              'stripe'
            )
          `;
        }
      } catch (logError) {
        const logMessage = logError instanceof Error ? logError.message : 'Unknown order_events logging error.';
        console.error('[stripe-webhook] Failed to log processing error:', logMessage);
      }
    }

    return errorResponse(message);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
