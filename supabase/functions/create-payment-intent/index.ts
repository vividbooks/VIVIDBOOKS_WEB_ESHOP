import Stripe from 'npm:stripe';
import postgres from 'npm:postgres';
import {
  isValidEmailFormat,
  normalizeEmail,
  EMAIL_FORMAT_HINT_CS,
  EMAIL_MX_REJECT_CS,
} from '../_shared/email-validation.ts';
import { domainAcceptsMailForForms } from '../_shared/email-mx.ts';
import { isValidCZSKPostalCode } from '../_shared/postal-code-czsk.ts';
import { hasStreetWithHouseNumber } from '../_shared/street-house-number.ts';

type CheckoutItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  variant?: string;
  bundleId?: string;
  bundleTitle?: string;
  posterMerch?: boolean;
};

type CheckoutShipping = {
  method: string;
  price: number;
  pickupPointId?: string;
  pickupPointName?: string;
  differentAddress?: boolean;
  deliveryAddress?: {
    recipientName?: string;
    street?: string;
    city?: string;
    zip?: string;
  };
};

type CheckoutCustomer = {
  email: string;
  name: string;
  phone: string;
  schoolName?: string;
  ico?: string;
  street: string;
  city: string;
  zip: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getDatabaseUrl() {
  return (
    Deno.env.get('SUPABASE_DB_URL')
    || Deno.env.get('DATABASE_URL')
    || ''
  );
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validateItems(items: unknown): items is CheckoutItem[] {
  return Array.isArray(items) && items.length > 0 && items.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    const variantOk = candidate.variant === undefined || typeof candidate.variant === 'string';
    const posterOk = candidate.posterMerch === undefined || candidate.posterMerch === true;
    return (
      typeof candidate.productId === 'string' &&
      typeof candidate.productName === 'string' &&
      isPositiveInteger(candidate.quantity) &&
      isNonNegativeInteger(candidate.unitPrice) &&
      variantOk &&
      posterOk
    );
  });
}

function validateCustomer(customer: unknown): customer is CheckoutCustomer {
  if (!customer || typeof customer !== 'object') return false;
  const candidate = customer as Record<string, unknown>;

  return (
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.phone === 'string' &&
    typeof candidate.street === 'string' &&
    typeof candidate.city === 'string' &&
    typeof candidate.zip === 'string' &&
    candidate.email.trim().length > 0 &&
    candidate.name.trim().length > 0 &&
    candidate.phone.trim().length > 0 &&
    candidate.street.trim().length > 0 &&
    hasStreetWithHouseNumber(String(candidate.street)) &&
    candidate.city.trim().length > 0 &&
    isValidCZSKPostalCode(String(candidate.zip))
  );
}

function validateSeparateDeliveryIfNeeded(shipping: unknown): boolean {
  if (!shipping || typeof shipping !== 'object') return true;
  const s = shipping as Record<string, unknown>;
  if (!s.differentAddress) return true;
  const da = s.deliveryAddress;
  if (!da || typeof da !== 'object') return false;
  const rec = da as Record<string, unknown>;
  const street = rec.street;
  const zip = rec.zip;
  return (
    typeof street === 'string' &&
    hasStreetWithHouseNumber(street) &&
    typeof zip === 'string' &&
    isValidCZSKPostalCode(zip)
  );
}

function validateShipping(shipping: unknown): shipping is CheckoutShipping {
  if (!shipping || typeof shipping !== 'object') return false;
  const candidate = shipping as Record<string, unknown>;

  return (
    typeof candidate.method === 'string' &&
    typeof candidate.price === 'number' &&
    Number.isInteger(candidate.price) &&
    candidate.price >= 0
  );
}

function generateResumeToken(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** B2C: stabilní hash (email + seřazené řádky + doprava) — bez cen a časů. */
async function buildB2CIdempotencyKey(
  items: CheckoutItem[],
  shipping: CheckoutShipping,
  email: string,
): Promise<string> {
  const lines = items
    .map((it) => ({
      productId: String(it.productId),
      quantity: it.quantity,
      variant: typeof it.variant === 'string' ? it.variant.trim() : '',
      bundleId: typeof it.bundleId === 'string' ? it.bundleId.trim() : '',
      posterMerch: it.posterMerch === true,
    }))
    .sort((a, b) => {
      const c = a.productId.localeCompare(b.productId);
      if (c !== 0) return c;
      const v = a.variant.localeCompare(b.variant);
      if (v !== 0) return v;
      return a.bundleId.localeCompare(b.bundleId);
    });
  const payload = JSON.stringify({
    email: normalizeEmail(email),
    items: lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      ...(l.variant ? { variant: l.variant } : {}),
      ...(l.bundleId ? { bundleId: l.bundleId } : {}),
      ...(l.posterMerch ? { posterMerch: true } : {}),
    })),
    shippingMethod: shipping.method,
  });
  const enc = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const databaseUrl = getDatabaseUrl();

  if (!stripeSecretKey || !databaseUrl) {
    return jsonResponse({ error: 'Missing Stripe or database configuration.' }, 500);
  }

  let payload: {
    items?: unknown;
    shipping?: unknown;
    customer?: unknown;
    schoolInquiry?: unknown;
    checkoutPaymentMethod?: unknown;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const { items, shipping, customer, schoolInquiry } = payload;

  const rawPm = payload.checkoutPaymentMethod;
  const checkoutPaymentMethod =
    rawPm === 'apple_pay' || rawPm === 'google_pay'
      ? rawPm
      : 'card';

  const schoolInquiryJson =
    schoolInquiry != null && typeof schoolInquiry === 'object' && !Array.isArray(schoolInquiry)
      ? JSON.stringify(schoolInquiry)
      : null;

  if (!validateItems(items)) {
    return jsonResponse({ error: 'Neplatné položky košíku.' }, 400);
  }

  if (!validateShipping(shipping)) {
    return jsonResponse({ error: 'Neplatná doprava.' }, 400);
  }

  if (!validateCustomer(customer)) {
    return jsonResponse({
      error: 'Neplatné zákaznické údaje (ulice včetně čísla domu, PSČ 5 číslic).',
    }, 400);
  }

  if (!validateSeparateDeliveryIfNeeded(shipping)) {
    return jsonResponse({
      error: 'Vyplňte doručovací ulici včetně čísla a platné PSČ (5 číslic).',
    }, 400);
  }

  const custEmail = normalizeEmail((customer as CheckoutCustomer).email);
  if (!isValidEmailFormat(custEmail)) {
    return jsonResponse({ error: EMAIL_FORMAT_HINT_CS }, 400);
  }
  const custDomain = custEmail.split('@')[1];
    if (!custDomain || !(await domainAcceptsMailForForms(custDomain))) {
    return jsonResponse({ error: EMAIL_MX_REJECT_CS }, 400);
  }

  if (shipping.method === 'zasilkovna' && !shipping.pickupPointId) {
    return jsonResponse({ error: 'Pro Zásilkovnu musíte vybrat výdejní místo.' }, 400);
  }

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = subtotal + shipping.price;

  if (subtotal <= 0 || total <= 0) {
    return jsonResponse({ error: 'Celková částka musí být kladná.' }, 400);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });
  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  const icoHas = Boolean((customer as CheckoutCustomer).ico?.trim());
  let idempotencyKeyB2c: string | null = null;
  if (!schoolInquiryJson && !icoHas) {
    idempotencyKeyB2c = await buildB2CIdempotencyKey(items, shipping, custEmail);
  }

  const idemLog = (key: string | null) => (key && key.length >= 8 ? key.slice(0, 8) : key ?? '—');

  async function insertOrderItems(tx: typeof sql, orderId: string) {
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
          ${orderId}::uuid,
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
  }

  let lastCreatedPaymentIntentId: string | null = null;

  try {
    const responseBody = await sql.begin(async (tx) => {
      const lockKey = idempotencyKeyB2c ?? crypto.randomUUID();
      await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      if (idempotencyKeyB2c) {
        const existingRows = await tx<Array<{
          id: string;
          stripe_payment_intent_id: string;
          payment_resume_token: string | null;
          checkout_session_id: string | null;
        }>>`
          select o.id, o.stripe_payment_intent_id, o.payment_resume_token, o.checkout_session_id
          from public.orders o
          where lower(trim(o.customer_email)) = lower(trim(${customer.email.trim()}))
            and o.idempotency_key = ${idempotencyKeyB2c}
            and o.status = 'pending_payment'
            and o.created_at > now() - interval '60 minutes'
          order by o.created_at desc
          limit 1
        `;
        const existing = existingRows[0];
        if (existing?.stripe_payment_intent_id) {
          const paymentIntent = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);
          if (paymentIntent.amount !== total) {
            await stripe.paymentIntents.update(paymentIntent.id, { amount: total });
          }
          const resumeOut = existing.payment_resume_token?.trim() || generateResumeToken();
          if (!existing.payment_resume_token?.trim()) {
            await tx`
              update public.orders
              set payment_resume_token = ${resumeOut}, updated_at = now()
              where id = ${existing.id}::uuid
            `;
          }
          if (existing.checkout_session_id) {
            await tx`
              update public.checkout_sessions
              set
                cart_data = ${JSON.stringify(items)}::jsonb,
                customer_data = ${JSON.stringify(customer)}::jsonb,
                shipping_data = ${JSON.stringify(shipping)}::jsonb,
                school_inquiry = ${schoolInquiryJson}::jsonb
              where id = ${existing.checkout_session_id}::uuid
            `;
          }
          await tx`
            update public.orders
            set
              customer_name = ${customer.name.trim()},
              customer_phone = ${customer.phone.trim()},
              school_name = ${customer.schoolName?.trim() || null},
              ico = ${customer.ico?.trim() || null},
              street = ${customer.street.trim()},
              city = ${customer.city.trim()},
              zip = ${customer.zip.trim()},
              shipping_method = ${shipping.method},
              shipping_price = ${shipping.price ?? 0},
              pickup_point_id = ${shipping.pickupPointId ?? null},
              pickup_point_name = ${shipping.pickupPointName ?? null},
              payment_method = ${checkoutPaymentMethod},
              subtotal = ${subtotal},
              total = ${total},
              updated_at = now()
            where id = ${existing.id}::uuid
          `;
          await tx`delete from public.order_items where order_id = ${existing.id}::uuid`;
          await insertOrderItems(tx, existing.id);

          console.log(
            `[create-payment-intent] email=${custEmail} idem=${idemLog(idempotencyKeyB2c)} reused=true`,
          );

          return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            resumeToken: resumeOut,
            reused: true,
          };
        }
      }

      const checkoutSessionId = crypto.randomUUID();
      const resumeToken = generateResumeToken();

      await tx`
        insert into public.checkout_sessions (
          id,
          cart_data,
          customer_data,
          shipping_data,
          school_inquiry
        ) values (
          ${checkoutSessionId}::uuid,
          ${JSON.stringify(items)}::jsonb,
          ${JSON.stringify(customer)}::jsonb,
          ${JSON.stringify(shipping)}::jsonb,
          ${schoolInquiryJson}::jsonb
        )
      `;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: 'czk',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          checkout_session_id: checkoutSessionId,
          payment_method: checkoutPaymentMethod,
          ...(schoolInquiryJson ? { order_source: 'school_objednat' } : {}),
        },
      });
      lastCreatedPaymentIntentId = paymentIntent.id;

      await tx`
        update public.checkout_sessions
        set stripe_payment_intent_id = ${paymentIntent.id}
        where id = ${checkoutSessionId}::uuid
      `;

      const inserted = await tx<{ id: string }[]>`
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
          subtotal,
          total,
          checkout_session_id,
          payment_resume_token,
          idempotency_key
        ) values (
          'pending_payment',
          ${customer.email.trim()},
          ${customer.name.trim()},
          ${customer.phone.trim()},
          ${customer.schoolName?.trim() || null},
          ${customer.ico?.trim() || null},
          ${customer.street.trim()},
          ${customer.city.trim()},
          ${customer.zip.trim()},
          'CZ',
          ${shipping.method},
          ${shipping.price ?? 0},
          ${shipping.pickupPointId ?? null},
          ${shipping.pickupPointName ?? null},
          ${checkoutPaymentMethod},
          'pending',
          ${paymentIntent.id},
          ${subtotal},
          ${total},
          ${checkoutSessionId}::uuid,
          ${resumeToken},
          ${idempotencyKeyB2c}
        )
        returning id
      `;

      const orderId = inserted[0]?.id;
      if (!orderId) {
        throw new Error('Order insert returned no id.');
      }

      await insertOrderItems(tx, orderId);

      console.log(
        `[create-payment-intent] email=${custEmail} idem=${idemLog(idempotencyKeyB2c)} reused=false`,
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        resumeToken,
        reused: false,
      };
    });

    return jsonResponse(responseBody);
  } catch (error) {
    if (lastCreatedPaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(lastCreatedPaymentIntentId);
      } catch (cancelErr) {
        console.error('[create-payment-intent] PI cancel after failed tx:', cancelErr);
      }
    }
    const message = error instanceof Error ? error.message : 'Stripe PaymentIntent creation failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
