import { resolveAllowedOrigin } from '../_shared/cors.ts';
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
import {
  buildPaymentIntentIdempotencyPayload,
  sha256HexOfString,
  type IdempotencyCustomer,
  type IdempotencyItem,
  type IdempotencyShipping,
} from '../_shared/checkout-idempotency.ts';
import {
  findExistingDraftOrder,
  recordDraftUpdatedEvent,
  replaceDraftOrderItems,
} from '../_shared/update-draft-order.ts';
import {
  cancelStripePaymentIntentsBestEffort,
  cancelSupersededPendingOrders,
  type SupersededOrder,
} from '../_shared/cancel-superseded-orders.ts';

function isPostgresUniqueViolation(e: unknown): boolean {
  return Boolean(
    e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '23505',
  );
}

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

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

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

/**
 * Synchronní zavolání pipedrive-sync s ošetřenou chybou.
 *
 * **Pozor**: Dříve šlo o fire-and-forget `void fetch(...)`. V Supabase Edge runtime se po `return`
 * z handleru zruší pending I/O — fetch se k make-server-93a20b6f vůbec nedostal a `pipedrive_sync_status`
 * v DB zůstával `null` (sync se ani nezaregistroval). Pro spolehlivost teď fetch awaitujeme; chyby
 * jen logujeme, aby selhání Pipedrivu nezablokovalo úspěšnou odpověď klientovi.
 */
async function invokeEshopPipedriveTransferSync(orderId: string, fallbackRequestUrl?: string): Promise<void> {
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
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ orderId, mode: 'b2b_transfer_open' }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[submit-transfer-order] eshop/pipedrive-sync HTTP', res.status, t.slice(0, 500));
    }
  } catch (e) {
    console.error('[submit-transfer-order] eshop/pipedrive-sync:', e);
  }
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('origin')),
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
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse(req, { error: 'Missing DATABASE_URL.' }, 500);
  }

  let payload: {
    items?: unknown;
    shipping?: unknown;
    customer?: unknown;
    schoolInquiry?: unknown;
    checkoutDraftId?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body.' }, 400);
  }

  const { items, shipping, customer, schoolInquiry } = payload;

  const draftId = typeof payload.checkoutDraftId === 'string'
    ? payload.checkoutDraftId.trim().slice(0, 64)
    : '';

  if (!validateItems(items)) {
    return jsonResponse(req, { error: 'Neplatné položky košíku.' }, 400);
  }
  if (!validateShipping(shipping)) {
    return jsonResponse(req, { error: 'Neplatná doprava.' }, 400);
  }
  if (!validateCustomer(customer)) {
    return jsonResponse(req, {
      error: 'Neplatné zákaznické údaje (ulice včetně čísla domu, PSČ 5 číslic).',
    }, 400);
  }

  if (!validateSeparateDeliveryIfNeeded(shipping)) {
    return jsonResponse(req, {
      error: 'Vyplňte doručovací ulici včetně čísla a platné PSČ (5 číslic).',
    }, 400);
  }

  const custEmail = normalizeEmail((customer as CheckoutCustomer).email);
  if (!isValidEmailFormat(custEmail)) {
    return jsonResponse(req, { error: EMAIL_FORMAT_HINT_CS }, 400);
  }
  const custDomain = custEmail.split('@')[1];
    if (!custDomain || !(await domainAcceptsMailForForms(custDomain))) {
    return jsonResponse(req, { error: EMAIL_MX_REJECT_CS }, 400);
  }

  const ico = String(customer.ico || '').trim().replace(/\s/g, '');
  if (!ico) {
    return jsonResponse(req, { error: 'Pro platbu převodem vyplňte IČO.' }, 400);
  }

  if (shipping.method === 'zasilkovna' && !shipping.pickupPointId) {
    return jsonResponse(req, { error: 'Pro Zásilkovnu musíte vybrat výdejní místo.' }, 400);
  }

  const shipPriceErr = validateShippingPriceHalers(shipping.method, shipping.price);
  if (shipPriceErr) {
    return jsonResponse(req, { error: shipPriceErr }, 400);
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  const supabaseAnon = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse(req, { error: 'Chybí SUPABASE_URL / SUPABASE_ANON_KEY pro ověření ceníku.' }, 500);
  }
  try {
    const { products, bundles } = await loadCheckoutCatalog(supabaseUrl, {
      Authorization: `Bearer ${supabaseAnon}`,
      apikey: supabaseAnon,
    });
    const priceErr = validateCheckoutPricing(items as CheckoutItemInput[], products, bundles);
    if (priceErr) {
      return jsonResponse(req, { error: priceErr }, 400);
    }
  } catch (e) {
    console.error('[submit-transfer-order] catalog validation:', e);
    return jsonResponse(req, {
      error: 'Nepodařilo se ověřit košík vůči ceníku. Zkuste to prosím znovu.',
    }, 503);
  }

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = subtotal + shipping.price;
  if (subtotal <= 0 || total <= 0) {
    return jsonResponse(req, { error: 'Celková částka musí být kladná.' }, 400);
  }

  const noteText =
    schoolInquiry != null && typeof schoolInquiry === 'object'
      ? JSON.stringify({ schoolInquiry }, null, 2).slice(0, 12000)
      : null;

  const schoolInquiryJson =
    schoolInquiry != null && typeof schoolInquiry === 'object' && !Array.isArray(schoolInquiry)
      ? JSON.stringify(schoolInquiry)
      : null;

  const idempotencyCanonical = buildPaymentIntentIdempotencyPayload(
    items as IdempotencyItem[],
    shipping as IdempotencyShipping,
    customer as IdempotencyCustomer,
    'transfer' as const,
    schoolInquiryJson,
  );
  const idempotencyKey = await sha256HexOfString(JSON.stringify(idempotencyCanonical));

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  /** Lock primárně per draft (1 řádek per draft = serializovat všechny POSTy téhož tabu).
   *  Bez draftId fallback na idempotencyKey (zachová zpětnou kompatibilitu). */
  const lockKeyText = draftId ? `draft:${draftId}` : `idemp:${idempotencyKey}`;

  try {
    await sql`select pg_advisory_lock(hashtext(${lockKeyText}::text))`;
    try {
      /* ---------------------------------------------------------------
       * NOVÁ DRAFT PATH — UPDATE existující pending objednávky in-place.
       *
       * Když pro `draftId` už pending objednávka existuje (uživatel přepnul
       * dopravu / upravil košík / změnil zákazníka), neudělá se nový INSERT
       * + supersession, ale UPDATE existující. `id`, `order_number` zůstávají;
       * e-mail „převod přijat" se NEposílá podruhé (uživatel ho dostal poprvé)
       * a Pipedrive sync se zase pokusí — `syncEshopOrderToPipedriveFromDb`
       * má vlastní idempotenci přes `pipedrive_deal_id`.
       * ------------------------------------------------------------- */
      if (draftId) {
        const existingDraft = await findExistingDraftOrder(sql, draftId);
        if (existingDraft) {
          const draftOrderId = existingDraft.id;
          /** Pokud má objednávka už `pipedrive_deal_id`, je už dokončená (zaplacená nebo
           *  alespoň přenesená do Pipedrive) — neměníme. */
          const finalizedRows = await sql<{ pipedrive_deal_id: string | null }[]>`
            select pipedrive_deal_id from public.orders where id = ${draftOrderId}::uuid limit 1
          `;
          if (finalizedRows[0]?.pipedrive_deal_id) {
            return jsonResponse(req, {
              success: true,
              orderId: draftOrderId,
              orderNumber: existingDraft.order_number,
              deduplicated: true,
            });
          }

          try {
            await sql.begin(async (tx) => {
              await tx`
                update public.orders
                set
                  customer_email = ${customer.email.trim()},
                  customer_name = ${customer.name.trim()},
                  customer_phone = ${customer.phone.trim()},
                  school_name = ${customer.schoolName?.trim() || null},
                  ico = ${ico},
                  street = ${customer.street.trim()},
                  city = ${customer.city.trim()},
                  zip = ${customer.zip.trim()},
                  shipping_method = ${shipping.method},
                  shipping_price = ${shipping.price ?? 0},
                  pickup_point_id = ${shipping.pickupPointId ?? null},
                  pickup_point_name = ${shipping.pickupPointName ?? null},
                  payment_method = 'transfer',
                  subtotal = ${subtotal},
                  total = ${total},
                  note = ${noteText},
                  idempotency_key = ${idempotencyKey},
                  updated_at = now()
                where id = ${draftOrderId}::uuid
              `;
              await replaceDraftOrderItems(tx, draftOrderId, items as IdempotencyItem[]);
              await recordDraftUpdatedEvent(tx, {
                orderId: draftOrderId,
                actor: 'customer',
                details: {
                  source: 'submit-transfer-order',
                  oldTotal: existingDraft.total,
                  newTotal: total,
                  shippingMethod: shipping.method,
                  paymentMethod: 'transfer',
                  ico,
                },
              });
            });
          } catch (updateErr) {
            console.error('[submit-transfer-order] Draft UPDATE in-place failed:', updateErr);
            const message = updateErr instanceof Error ? updateErr.message : 'Update objednávky selhal.';
            return jsonResponse(req, { error: message }, 500);
          }

          console.log(
            `[submit-transfer-order] Draft updated in-place: order=${draftOrderId.slice(0, 8)}… draft=${draftId.slice(0, 8)}… total=${total}`,
          );

          /** Pipedrive sync je idempotentní (kontroluje `pipedrive_deal_id`), takže
           *  při UPDATE buď doplní deal, který se předtím nepovedl, nebo skip. */
          invokeEshopPipedriveTransferSync(draftOrderId, req.url);

          return jsonResponse(req, {
            success: true,
            orderId: draftOrderId,
            orderNumber: existingDraft.order_number,
            updated: true,
          });
        }
      }

      const existingEarly = await sql<{ id: string; order_number: string }[]>`
        select id, order_number from public.orders
        where idempotency_key = ${idempotencyKey}
        limit 1
      `;
      if (existingEarly.length > 0) {
        // Existující objednávka stejného hashe (bez draftId, např. legacy session).
        return jsonResponse(req, {
          success: true,
          orderId: existingEarly[0].id,
          orderNumber: existingEarly[0].order_number,
          deduplicated: true,
        });
      }

      type TxOutcome =
        | { kind: 'new'; row: { id: string; order_number: string }; superseded: SupersededOrder[] }
        | { kind: 'dup'; row: { id: string; order_number: string } };

      const outcome = await sql.begin(async (tx): Promise<TxOutcome> => {
        let inserted: { id: string; order_number: string }[];
        try {
          inserted = await tx<{ id: string; order_number: string }[]>`
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
              note,
              idempotency_key,
              checkout_draft_id
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
              ${noteText},
              ${idempotencyKey},
              ${draftId || null}
            )
            returning id, order_number
          `;
        } catch (insErr) {
          if (isPostgresUniqueViolation(insErr)) {
            const again = await tx<{ id: string; order_number: string }[]>`
              select id, order_number from public.orders
              where idempotency_key = ${idempotencyKey}
              limit 1
            `;
            if (again[0]) return { kind: 'dup', row: again[0] };
          }
          throw insErr;
        }

        const orderRow = inserted[0];
        if (!orderRow) {
          throw new Error('Insert returned no row.');
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

        await tx`
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

        const supersededInTx = draftId
          ? await cancelSupersededPendingOrders(tx, draftId, orderRow.id)
          : [];

        return { kind: 'new', row: orderRow, superseded: supersededInTx };
      });

      if (outcome.kind === 'dup') {
        return jsonResponse(req, {
          success: true,
          orderId: outcome.row.id,
          orderNumber: outcome.row.order_number,
          deduplicated: true,
        });
      }

      const orderRow = outcome.row;

      if (outcome.superseded.length > 0) {
        console.log(
          `[submit-transfer-order] Superseded ${outcome.superseded.length} pending order(s) for draft ${draftId.slice(0, 8)}…`,
        );
        const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();
        void cancelStripePaymentIntentsBestEffort(
          outcome.superseded.map((s) => s.stripe_payment_intent_id),
          stripeKey,
          'submit-transfer-order',
        );
      }

      try {
        await sendOrderEmail(sql, { orderId: orderRow.id, emailType: 'order_transfer_received' });
      } catch (e) {
        console.error('[submit-transfer-order] Email:', e);
      }

      await invokeEshopPipedriveTransferSync(orderRow.id, req.url);

      return jsonResponse(req, {
        success: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
      });
    } finally {
      try {
        await sql`select pg_advisory_unlock(hashtext(${lockKeyText}::text))`;
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Submit failed.';
    console.error('[submit-transfer-order]', msg);
    return jsonResponse(req, { error: msg }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
