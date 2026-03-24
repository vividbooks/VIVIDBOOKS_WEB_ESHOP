import Stripe from 'npm:stripe';
import postgres from 'npm:postgres';

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
    return jsonResponse({ error: 'Server configuration error.' }, 500);
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token || token.length < 32) {
    return jsonResponse({ error: 'Missing or invalid token.' }, 400);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const rows = await sql<
      {
        id: string;
        order_number: string;
        status: string;
        payment_status: string;
        stripe_payment_intent_id: string | null;
        subtotal: number;
        shipping_price: number;
        total: number;
      }[]
    >`
      select
        id,
        order_number,
        status,
        payment_status,
        stripe_payment_intent_id,
        subtotal,
        shipping_price,
        total
      from public.orders
      where payment_resume_token = ${token}
      limit 1
    `;

    const order = rows[0];
    if (!order) {
      return jsonResponse({ error: 'Neplatný odkaz nebo objednávka neexistuje.' }, 404);
    }

    if (order.status !== 'pending_payment' || order.payment_status !== 'pending') {
      if (order.status === 'paid' || order.payment_status === 'paid') {
        return jsonResponse({
          status: 'already_paid',
          orderNumber: order.order_number,
        });
      }
      return jsonResponse({
        error: 'Tuto objednávku už nelze zaplatit přes tento odkaz.',
        orderNumber: order.order_number,
      }, 409);
    }

    if (!order.stripe_payment_intent_id) {
      return jsonResponse({ error: 'Chybí platební údaje u objednávky.' }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
    const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);

    if (pi.status === 'succeeded') {
      return jsonResponse({
        status: 'already_paid',
        orderNumber: order.order_number,
      });
    }

    if (pi.status === 'canceled') {
      return jsonResponse({
        status: 'payment_cancelled',
        orderNumber: order.order_number,
        message: 'Platba byla zrušena. Vytvořte prosím novou objednávku nebo nás kontaktujte.',
      }, 409);
    }

    if (!pi.client_secret) {
      return jsonResponse({ error: 'Nepodařilo se načíst platební relaci.' }, 500);
    }

    return jsonResponse({
      status: 'requires_payment',
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      orderNumber: order.order_number,
      subtotal: order.subtotal,
      shippingPrice: order.shipping_price,
      total: order.total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume checkout failed.';
    console.error('[resume-checkout]', message);
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
