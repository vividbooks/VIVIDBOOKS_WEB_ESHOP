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
import {
  loadCheckoutCatalog,
  validateCheckoutPricing,
  validateShippingPriceHalers,
  type CheckoutItemInput,
} from '../_shared/checkout-pricing.ts';
import { computeOrderTrackingToken } from '../_shared/order-tracking-token.ts';
import {
  buildPaymentIntentIdempotencyPayload,
  sha256HexOfString,
} from '../_shared/checkout-idempotency.ts';
import {
  cancelStripePaymentIntentsBestEffort,
  cancelSupersededPendingOrders,
  type SupersededOrder,
} from '../_shared/cancel-superseded-orders.ts';
import {
  findExistingDraftOrder,
  recordDraftUpdatedEvent,
  replaceDraftOrderItems,
} from '../_shared/update-draft-order.ts';

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

async function trackingTokenForOrder(orderId: string): Promise<string | null> {
  const secret = (Deno.env.get('ORDER_TRACKING_HMAC_SECRET') || '').trim();
  if (!secret || !orderId) return null;
  return await computeOrderTrackingToken(orderId, secret);
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
    checkoutDraftId?: unknown;
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

  const draftId = typeof payload.checkoutDraftId === 'string'
    ? payload.checkoutDraftId.trim().slice(0, 64)
    : '';

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
    console.error('[create-payment-intent] catalog validation:', e);
    return jsonResponse({
      error: 'Nepodařilo se ověřit košík vůči ceníku. Zkuste to prosím znovu.',
    }, 503);
  }

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = subtotal + shipping.price;

  if (subtotal <= 0 || total <= 0) {
    return jsonResponse({ error: 'Celková částka musí být kladná.' }, 400);
  }

  /** Hash košíku — bez `paymentMethod`. Card/APay/GPay přes `automatic_payment_methods=true` jdou na stejný PaymentIntent,
   *  takže přepínání karta↔Apple Pay↔Google Pay nemá zakládat nové objednávky. */
  const idempotencyCanonical = buildPaymentIntentIdempotencyPayload(
    items,
    shipping,
    customer,
    'stripe',
    schoolInquiryJson,
  );
  const idempotencyKey = await sha256HexOfString(JSON.stringify(idempotencyCanonical));

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

  let checkoutSessionId = '';
  let resumeToken = '';
  let paymentIntent: Stripe.PaymentIntent;

  /** Lock primárně per draft (1 řádek per draft = serializovat všechny POSTy téhož tabu).
   *  Bez draftId fallback na idempotencyKey (zachová zpětnou kompatibilitu). */
  const lockKeyText = draftId ? `draft:${draftId}` : `idemp:${idempotencyKey}`;

  try {
    await sql`select pg_advisory_lock(hashtext(${lockKeyText}::text))`;

    /* ---------------------------------------------------------------
     * NOVÁ DRAFT PATH — UPDATE existujícího pending řádku in-place.
     *
     * Když pro `draftId` už pending objednávka existuje (uživatel přepnul
     * dopravu / upravil košík ve stejném checkout tabu), nezakládáme novou
     * objednávku, ale UPDATE existující. `id`, `order_number` a
     * `payment_resume_token` přežijí; Stripe PI se případně recreatne
     * (cancel staré + create nové) jen když se změnila částka, hash košíku
     * nebo je stará PI v `canceled` stavu. Mid-payment PI (processing /
     * requires_action / requires_confirmation) se nesahá — vrátí se existující
     * client_secret, aby se uživateli neztratil rozdělaný 3D-Secure flow.
     * ------------------------------------------------------------- */
    if (draftId) {
      const existingDraft = await findExistingDraftOrder(sql, draftId);
      if (existingDraft) {
        const draftOrderId = existingDraft.id;
        let existingPi: Stripe.PaymentIntent | null = null;
        if (existingDraft.stripe_payment_intent_id) {
          try {
            existingPi = await stripe.paymentIntents.retrieve(existingDraft.stripe_payment_intent_id);
          } catch (e) {
            console.warn(
              `[create-payment-intent] Existing draft PI fetch failed (${existingDraft.stripe_payment_intent_id}):`,
              e,
            );
          }
        }

        if (existingPi?.status === 'succeeded') {
          return jsonResponse({
            error: 'Tato platba je již dokončená.',
            alreadyPaid: true,
          }, 409);
        }

        /** Mid-payment: 3D-Secure / Apple Pay / processing — nesahat. Vrátit klientovi
         *  existující client_secret, ať doklikne to, co rozjel. */
        if (
          existingPi
          && (existingPi.status === 'processing'
            || existingPi.status === 'requires_action'
            || existingPi.status === 'requires_confirmation'
            || existingPi.status === 'requires_capture')
        ) {
          if (!existingPi.client_secret) {
            console.error('[create-payment-intent] Mid-flight PI missing client_secret.');
            return jsonResponse({ error: 'Nepodařilo se obnovit platbu. Obnovte stránku.' }, 500);
          }
          const tracking = await trackingTokenForOrder(draftOrderId);
          return jsonResponse({
            clientSecret: existingPi.client_secret,
            paymentIntentId: existingPi.id,
            resumeToken: existingDraft.payment_resume_token || '',
            ...(tracking ? { trackingToken: tracking } : {}),
          });
        }

        /** Stejný hash + stejná částka + PI ještě čeká na kartu → není co dělat,
         *  vrátit existující PI client_secret jako reuse. */
        if (
          existingPi
          && existingPi.status === 'requires_payment_method'
          && existingPi.amount === total
          && existingPi.currency === 'czk'
          && existingDraft.idempotency_key === idempotencyKey
        ) {
          if (!existingPi.client_secret) {
            console.error('[create-payment-intent] Same-config PI missing client_secret.');
            return jsonResponse({ error: 'Nepodařilo se obnovit platbu. Obnovte stránku.' }, 500);
          }
          const tracking = await trackingTokenForOrder(draftOrderId);
          return jsonResponse({
            clientSecret: existingPi.client_secret,
            paymentIntentId: existingPi.id,
            resumeToken: existingDraft.payment_resume_token || '',
            ...(tracking ? { trackingToken: tracking } : {}),
          });
        }

        /** Jinak: cancel staré PI (best-effort), create novou s aktuální částkou,
         *  UPDATE řádku v transakci. */
        if (existingPi && existingPi.status === 'requires_payment_method') {
          try {
            await stripe.paymentIntents.cancel(existingPi.id);
          } catch (e) {
            console.warn('[create-payment-intent] Cancel old draft PI failed:', e);
          }
        }

        /** Pro nový PI použít vlastní idempotency key — pokud klient pošle 2× ten samý request
         *  (např. React Strict Mode), Stripe vrátí stejnou PI, ne dvě. Hash zahrnuje draft id
         *  + cart hash, takže přepínání dopravy v rámci draftu vždy = jiný klíč = jiná PI. */
        const newPiIdempotencyKey =
          `eshop-pi-d-${draftId.slice(0, 16)}-${idempotencyKey}`.slice(0, 255);
        let newPi: Stripe.PaymentIntent;
        try {
          newPi = await stripe.paymentIntents.create(
            {
              amount: total,
              currency: 'czk',
              automatic_payment_methods: { enabled: true },
              metadata: {
                checkout_session_id: existingDraft.checkout_session_id || '',
                payment_method: checkoutPaymentMethod,
                checkout_draft_id: draftId,
                ...(schoolInquiryJson ? { order_source: 'school_objednat' } : {}),
              },
            },
            { idempotencyKey: newPiIdempotencyKey },
          );
        } catch (e) {
          console.error('[create-payment-intent] New PI for draft update failed:', e);
          const message = e instanceof Error ? e.message : 'Stripe PaymentIntent creation failed.';
          return jsonResponse({ error: message }, 500);
        }

        try {
          await sql.begin(async (tx) => {
            /** UPDATE všech polí, která se mohla změnit. `id`, `order_number`,
             *  `payment_resume_token`, `created_at`, `checkout_draft_id` zůstávají. */
            await tx`
              update public.orders
              set
                customer_email = ${customer.email.trim()},
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
                stripe_payment_intent_id = ${newPi.id},
                subtotal = ${subtotal},
                total = ${total},
                idempotency_key = ${idempotencyKey},
                updated_at = now()
              where id = ${draftOrderId}::uuid
            `;

            await replaceDraftOrderItems(tx, draftOrderId, items);

            await recordDraftUpdatedEvent(tx, {
              orderId: draftOrderId,
              actor: 'customer',
              details: {
                source: 'create-payment-intent',
                oldPaymentIntent: existingDraft.stripe_payment_intent_id,
                newPaymentIntent: newPi.id,
                oldTotal: existingDraft.total,
                newTotal: total,
                shippingMethod: shipping.method,
                paymentMethod: checkoutPaymentMethod,
              },
            });

            /** checkout_sessions je working tabulka — pokud existuje stará session,
             *  uvolnit její `idempotency_key` (jinak by nový INSERT z jiného draftu se stejnou
             *  konfigurací havaroval na UNIQUE). Ji samotnou nemažeme — orphan session se
             *  vyčistí cancel-stale-orders cronem. */
            await tx`
              update public.checkout_sessions
              set
                cart_data = ${JSON.stringify(items)}::jsonb,
                customer_data = ${JSON.stringify(customer)}::jsonb,
                shipping_data = ${JSON.stringify(shipping)}::jsonb,
                school_inquiry = ${schoolInquiryJson}::jsonb,
                idempotency_key = ${idempotencyKey},
                stripe_payment_intent_id = ${newPi.id}
              where stripe_payment_intent_id = ${existingDraft.stripe_payment_intent_id}
            `;
          });
        } catch (updateErr) {
          console.error('[create-payment-intent] Draft UPDATE in-place failed:', updateErr);
          /** Cleanup: nově vyrobenou PI zrušíme, abychom neměli orphaned PI ve Stripe. */
          try {
            await stripe.paymentIntents.cancel(newPi.id);
          } catch {
            /* ignore */
          }
          const message = updateErr instanceof Error ? updateErr.message : 'Update objednávky selhal.';
          return jsonResponse({ error: message }, 500);
        }

        if (!newPi.client_secret) {
          console.error('[create-payment-intent] New PI missing client_secret after draft update.');
          return jsonResponse({ error: 'Nepodařilo se vytvořit platbu. Zkuste to znovu.' }, 500);
        }
        console.log(
          `[create-payment-intent] Draft updated in-place: order=${draftOrderId.slice(0, 8)}… draft=${draftId.slice(0, 8)}… new_pi=${newPi.id} old_pi=${existingDraft.stripe_payment_intent_id || '(none)'}`,
        );

        const tracking = await trackingTokenForOrder(draftOrderId);
        return jsonResponse({
          clientSecret: newPi.client_secret,
          paymentIntentId: newPi.id,
          resumeToken: existingDraft.payment_resume_token || '',
          ...(tracking ? { trackingToken: tracking } : {}),
        });
      }
    }

    const existingRows = await sql<{ id: string; stripe_payment_intent_id: string | null }[]>`
      select id, stripe_payment_intent_id
      from public.checkout_sessions
      where idempotency_key = ${idempotencyKey}
      limit 1
      for update
    `;
    const existing = existingRows[0];

    if (existing?.stripe_payment_intent_id) {
      paymentIntent = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id, {
        expand: ['latest_charge'],
      });
      if (paymentIntent.currency !== 'czk' || paymentIntent.amount !== total) {
        console.warn('[create-payment-intent] Idempotent reuse: amount/currency mismatch, refusing reuse.');
        return jsonResponse({
          error: 'Košík se změnil — obnovte stránku a zkuste platbu znovu.',
        }, 409);
      }
      if (paymentIntent.status === 'succeeded') {
        return jsonResponse({
          error: 'Tato platba je již dokončená.',
          alreadyPaid: true,
        }, 409);
      }
      if (paymentIntent.status === 'canceled') {
        return jsonResponse({
          error: 'Platba byla zrušena. Vytvořte prosím novou objednávku z košíku.',
        }, 409);
      }

      const ordRows = await sql<{ id: string; payment_resume_token: string | null }[]>`
        select id, payment_resume_token
        from public.orders
        where stripe_payment_intent_id = ${paymentIntent.id}
        limit 1
      `;
      const resume = ordRows[0]?.payment_resume_token;
      const reuseOrderId = ordRows[0]?.id;
      if (!resume || !paymentIntent.client_secret) {
        console.error('[create-payment-intent] Reuse path: missing resume token or client_secret.');
        return jsonResponse({ error: 'Nepodařilo se obnovit platbu. Obnovte stránku.' }, 500);
      }

      // Reuse: i tady chceme zrušit ostatní pending záznamy téhož draftu (uživatel se vrátil
      // ke stejné kombinaci doprava+platba, ale mezitím vyzkoušel jinou — ta se má supersede).
      if (draftId && reuseOrderId) {
        try {
          const reuseSuperseded = await sql.begin((tx) =>
            cancelSupersededPendingOrders(tx, draftId, reuseOrderId),
          );
          if (reuseSuperseded.length > 0) {
            console.log(
              `[create-payment-intent] Reuse path: superseded ${reuseSuperseded.length} pending order(s) for draft ${draftId.slice(0, 8)}…`,
            );
            void cancelStripePaymentIntentsBestEffort(
              reuseSuperseded.map((s) => s.stripe_payment_intent_id),
              stripeSecretKey,
              'create-payment-intent',
            );
          }
        } catch (e) {
          console.warn('[create-payment-intent] Reuse path supersession failed:', e);
        }
      }

      const reuseTracking = reuseOrderId ? await trackingTokenForOrder(reuseOrderId) : null;
      return jsonResponse({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        resumeToken: resume,
        ...(reuseTracking ? { trackingToken: reuseTracking } : {}),
      });
    }

    if (existing?.id && !existing.stripe_payment_intent_id) {
      await sql`
        delete from public.checkout_sessions
        where id = ${existing.id}::uuid
      `;
    }

    checkoutSessionId = crypto.randomUUID();
    resumeToken = generateResumeToken();

    await sql`
      insert into public.checkout_sessions (
        id,
        cart_data,
        customer_data,
        shipping_data,
        school_inquiry,
        idempotency_key
      ) values (
        ${checkoutSessionId}::uuid,
        ${JSON.stringify(items)}::jsonb,
        ${JSON.stringify(customer)}::jsonb,
        ${JSON.stringify(shipping)}::jsonb,
        ${schoolInquiryJson}::jsonb,
        ${idempotencyKey}
      )
    `;

    /** Stejný klíč jako u DB — když klient pošle POST 2×, Stripe nevyrobí druhý PaymentIntent. */
    paymentIntent = await stripe.paymentIntents.create(
      {
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
      },
      { idempotencyKey: `eshop-pi-${idempotencyKey}`.slice(0, 255) },
    );

    await sql`
      update public.checkout_sessions
      set stripe_payment_intent_id = ${paymentIntent.id}
      where id = ${checkoutSessionId}::uuid
    `;

    let persistedOrderId: string | null = null;
    let persistedResumeToken = resumeToken;
    let supersededOrders: SupersededOrder[] = [];
    try {
      await sql.begin(async (tx) => {
        let inserted: { id: string; payment_resume_token: string | null }[];
        try {
          inserted = await tx<{ id: string; payment_resume_token: string | null }[]>`
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
              idempotency_key,
              checkout_draft_id
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
              ${idempotencyKey},
              ${draftId || null}
            )
            returning id, payment_resume_token
          `;
        } catch (insErr) {
          /** Race / dvojklik: druhý INSERT s tímtéž `idempotency_key` selže UNIQUE indexem.
           *  Vrátíme stávající `pending_payment` objednávku; PI z `existing.stripe_payment_intent_id` byla už spárována dřív. */
          if (insErr && typeof insErr === 'object' && 'code' in insErr && (insErr as { code?: string }).code === '23505') {
            const reuse = await tx<{ id: string; payment_resume_token: string | null; stripe_payment_intent_id: string | null }[]>`
              select id, payment_resume_token, stripe_payment_intent_id
              from public.orders
              where idempotency_key = ${idempotencyKey}
              limit 1
            `;
            const reuseRow = reuse[0];
            if (reuseRow?.id && reuseRow.payment_resume_token) {
              persistedOrderId = reuseRow.id;
              persistedResumeToken = reuseRow.payment_resume_token;
              return;
            }
          }
          throw insErr;
        }

        const row = inserted[0];
        if (!row?.id) {
          throw new Error('Order insert returned no id.');
        }
        persistedOrderId = row.id;
        persistedResumeToken = row.payment_resume_token || resumeToken;

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
              ${row.id}::uuid,
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

        if (draftId) {
          supersededOrders = await cancelSupersededPendingOrders(tx, draftId, row.id);
        }
      });
    } catch (orderErr) {
      console.error('[create-payment-intent] Pending order persist failed:', orderErr);
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (cancelErr) {
        console.error('[create-payment-intent] PI cancel failed:', cancelErr);
      }
      try {
        await sql`
          delete from public.checkout_sessions
          where id = ${checkoutSessionId}::uuid
        `;
      } catch {
        /* best-effort */
      }
      const message = orderErr instanceof Error ? orderErr.message : 'Uložení objednávky selhalo.';
      return jsonResponse({ error: message }, 500);
    }

    if (supersededOrders.length > 0) {
      console.log(
        `[create-payment-intent] Superseded ${supersededOrders.length} pending order(s) for draft ${draftId.slice(0, 8)}…`,
      );
      void cancelStripePaymentIntentsBestEffort(
        supersededOrders.map((s) => s.stripe_payment_intent_id),
        stripeSecretKey,
        'create-payment-intent',
      );
    }

    const thankYouTracking = persistedOrderId ? await trackingTokenForOrder(persistedOrderId) : null;
    return jsonResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      resumeToken: persistedResumeToken,
      ...(thankYouTracking ? { trackingToken: thankYouTracking } : {}),
    });
  } catch (error) {
    try {
      if (checkoutSessionId) {
        await sql`
          delete from public.checkout_sessions
          where id = ${checkoutSessionId}::uuid
            and stripe_payment_intent_id is null
        `;
      }
    } catch {
      // Cleanup is best-effort only.
    }

    const message = error instanceof Error ? error.message : 'Stripe PaymentIntent creation failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    try {
      await sql`select pg_advisory_unlock(hashtext(${lockKeyText}::text))`;
    } catch {
      /* ignore */
    }
    await sql.end({ timeout: 5 });
  }
});
