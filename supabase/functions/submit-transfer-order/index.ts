/**
 * Školní / B objednávka s platbou převodem (pouze s IČO). Bez Stripe PI, bez export_queue.
 */
import postgres from 'npm:postgres';
import { sendOrderEmail } from '../_shared/order-email.ts';
import {
  isValidEmailFormat,
  normalizeEmail,
  EMAIL_FORMAT_HINT_CS,
  EMAIL_MX_REJECT_CS,
} from '../_shared/email-validation.ts';
import { domainAcceptsMailForForms } from '../_shared/email-mx.ts';
import { isValidCZSKPostalCode } from '../_shared/postal-code-czsk.ts';
import { hasStreetWithHouseNumber } from '../_shared/street-house-number.ts';
import {
  loadCheckoutCatalog,
  validateCheckoutPricing,
  validateShippingPriceHalers,
  type CheckoutItemInput,
} from '../_shared/checkout-pricing.ts';

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

/** Neblokuje odpověď klientovi; chyby jen do logu. */
function fireEshopPipedriveTransferSync(orderId: string, fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  const url = baseUrl ? `${baseUrl}/functions/v1/make-server-93a20b6f/eshop/pipedrive-sync` : '';
  if (!url) {
    console.error('[submit-transfer-order] Missing SUPABASE_URL for eshop/pipedrive-sync.');
    return;
  }
  const key = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!key) {
    console.error('[submit-transfer-order] Missing SUPABASE_SERVICE_ROLE_KEY for eshop/pipedrive-sync.');
    return;
  }
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ orderId, mode: 'b2b_transfer_open' }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        console.error('[submit-transfer-order] eshop/pipedrive-sync HTTP', res.status, t.slice(0, 500));
      }
    })
    .catch((e) => {
      console.error('[submit-transfer-order] eshop/pipedrive-sync:', e);
    });
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  let payload: {
    items?: unknown;
    shipping?: unknown;
    customer?: unknown;
    schoolInquiry?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const { items, shipping, customer, schoolInquiry } = payload;

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

  const ico = String(customer.ico || '').trim().replace(/\s/g, '');
  if (!ico) {
    return jsonResponse({ error: 'Pro platbu převodem vyplňte IČO.' }, 400);
  }

  if (shipping.method === 'zasilkovna' && !shipping.pickupPointId) {
    return jsonResponse({ error: 'Pro Zásilkovnu musíte vybrat výdejní místo.' }, 400);
  }

  const shipPriceErr = validateShippingPriceHalers(shipping.method, shipping.price);
  if (shipPriceErr) {
    return jsonResponse({ error: shipPriceErr }, 400);
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  const supabaseAnon = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse({ error: 'Chybí SUPABASE_URL / SUPABASE_ANON_KEY pro ověření ceníku.' }, 500);
  }
  try {
    const { products, bundles } = await loadCheckoutCatalog(supabaseUrl, {
      Authorization: `Bearer ${supabaseAnon}`,
      apikey: supabaseAnon,
    });
    const priceErr = validateCheckoutPricing(items as CheckoutItemInput[], products, bundles);
    if (priceErr) {
      return jsonResponse({ error: priceErr }, 400);
    }
  } catch (e) {
    console.error('[submit-transfer-order] catalog validation:', e);
    return jsonResponse({
      error: 'Nepodařilo se ověřit košík vůči ceníku. Zkuste to prosím znovu.',
    }, 503);
  }

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = subtotal + shipping.price;
  if (subtotal <= 0 || total <= 0) {
    return jsonResponse({ error: 'Celková částka musí být kladná.' }, 400);
  }

  const noteText =
    schoolInquiry != null && typeof schoolInquiry === 'object'
      ? JSON.stringify({ schoolInquiry }, null, 2).slice(0, 12000)
      : null;

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const inserted = await sql<{ id: string; order_number: string }[]>`
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
        subtotal,
        total,
        note
      ) values (
        'pending_payment',
        ${customer.email.trim()},
        ${customer.name.trim()},
        ${customer.phone.trim()},
        ${customer.schoolName?.trim() || null},
        ${ico},
        ${customer.street.trim()},
        ${customer.city.trim()},
        ${customer.zip.trim()},
        'CZ',
        ${shipping.method},
        ${shipping.price ?? 0},
        ${shipping.pickupPointId ?? null},
        ${shipping.pickupPointName ?? null},
        'transfer',
        'pending',
        ${subtotal},
        ${total},
        ${noteText}
      )
      returning id, order_number
    `;

    const orderRow = inserted[0];
    if (!orderRow) {
      return jsonResponse({ error: 'Uložení objednávky selhalo.' }, 500);
    }

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
      await sql`
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
          ${orderRow.id}::uuid,
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

    await sql`
      insert into public.order_events (
        order_id,
        event_type,
        from_status,
        to_status,
        details,
        actor
      ) values (
        ${orderRow.id}::uuid,
        'order_created',
        null,
        'pending_payment',
        ${JSON.stringify({ paymentMethod: 'transfer', ico })}::jsonb,
        'customer'
      )
    `;

    try {
      await sendOrderEmail(sql, { orderId: orderRow.id, emailType: 'order_transfer_received' });
    } catch (e) {
      console.error('[submit-transfer-order] Email:', e);
    }

    fireEshopPipedriveTransferSync(orderRow.id, req.url);

    return jsonResponse({
      success: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Submit failed.';
    console.error('[submit-transfer-order]', msg);
    return jsonResponse({ error: msg }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
