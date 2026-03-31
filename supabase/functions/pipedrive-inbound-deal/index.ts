/**
 * Inbound: Pipedrive deal (typicky WON) → objednávka v Postgres + fronta exportu (Base.com / volitelně iDoklad).
 *
 * Volání:
 * - Webhook z Pipedrive: POST …/pipedrive-inbound-deal?token=<PIPEDRIVE_INBOUND_WEBHOOK_SECRET>
 *   Tělo = standardní JSON webhooku (meta.id / current.id = deal ID).
 * - Test ručně: POST stejná URL, stejný token, JSON { "deal_id": 12345 }
 *
 * Vyžaduje: PIPEDRIVE_API_TOKEN, PIPEDRIVE_INBOUND_WEBHOOK_SECRET.
 * Volitelně: PIPEDRIVE_INBOUND_PIPELINE_IDS (čárkou oddělená ID pipeline, prázdné = všechny).
 *
 * Nasazení: supabase functions deploy pipedrive-inbound-deal --no-verify-jwt
 */
import postgres from 'npm:postgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pipedrive-inbound-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_SHIPPING_METHOD = 'dpd';
const DEFAULT_SHIPPING_PRICE_HALER = 8900;

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getFunctionBaseUrl(fallbackRequestUrl?: string) {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  if (supabaseUrl) return supabaseUrl.replace(/\/$/, '');
  if (fallbackRequestUrl) {
    try {
      return new URL(fallbackRequestUrl).origin;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function getProcessExportQueueUrl(fallbackRequestUrl?: string) {
  const base = getFunctionBaseUrl(fallbackRequestUrl);
  return base ? `${base}/functions/v1/process-export-queue` : '';
}

function getFunctionAuthHeaders() {
  const functionKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  return functionKey
    ? { Authorization: `Bearer ${functionKey}`, apikey: functionKey }
    : {};
}

async function invokeProcessExportQueue(fallbackRequestUrl?: string) {
  const url = getProcessExportQueueUrl(fallbackRequestUrl);
  if (!url) throw new Error('Missing base URL for process-export-queue.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getFunctionAuthHeaders() },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `process-export-queue HTTP ${response.status}`);
  }
}

async function pipedriveApiGet<T>(
  apiToken: string,
  path: string,
  query: Record<string, string | number> = {},
): Promise<T | null> {
  const url = new URL(`https://api.pipedrive.com/v1${path}`);
  url.searchParams.set('api_token', apiToken);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    console.error('[pipedrive-inbound]', path, json?.error || res.status);
    return null;
  }
  return (json?.data ?? null) as T | null;
}

function readPersonEmail(person: Record<string, unknown>): string {
  const raw = person?.email;
  if (!Array.isArray(raw)) return '';
  for (const entry of raw) {
    const v = typeof entry === 'object' && entry && 'value' in entry
      ? String((entry as { value?: string }).value || '').trim()
      : String(entry || '').trim();
    if (v) return v;
  }
  return '';
}

function readPersonPhone(person: Record<string, unknown>): string {
  const raw = person?.phone;
  if (!Array.isArray(raw)) return '';
  for (const entry of raw) {
    const v = typeof entry === 'object' && entry && 'value' in entry
      ? String((entry as { value?: string }).value || '').trim()
      : String(entry || '').trim();
    if (v) return v;
  }
  return '';
}

function personPostalLine(person: Record<string, unknown>): { street: string; city: string; zip: string } {
  const a = person?.postal_address;
  if (a && typeof a === 'object') {
    const o = a as Record<string, string | undefined>;
    return {
      street: String(o.formatted_address || o.value || `${o.route || ''} ${o.street_number || ''}` || '').trim(),
      city: String(o.locality || o.sublocality || '').trim(),
      zip: String(o.postal_code || '').trim(),
    };
  }
  return { street: '', city: '', zip: '' };
}

function moneyToHaler(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function verifyInboundToken(req: Request, url: URL): boolean {
  const secret = (Deno.env.get('PIPEDRIVE_INBOUND_WEBHOOK_SECRET') || '').trim();
  if (!secret) return false;
  const q = (url.searchParams.get('token') || '').trim();
  const header = (req.headers.get('x-pipedrive-inbound-token') || '').trim();
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return q === secret || header === secret || auth === secret;
}

function extractDealId(body: Record<string, unknown>): number | null {
  const direct = body.deal_id ?? body.dealId;
  if (typeof direct === 'number' && Number.isInteger(direct) && direct > 0) return direct;
  if (typeof direct === 'string') {
    const n = Number.parseInt(direct, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }

  const meta = body.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta.id === 'number' && Number.isInteger(meta.id)) return meta.id as number;
  if (meta && typeof meta.id === 'string') {
    const n = Number.parseInt(meta.id, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }

  const current = body.current as Record<string, unknown> | undefined;
  if (current && typeof current.id === 'number' && Number.isInteger(current.id)) return current.id as number;
  if (current && typeof current.id === 'string') {
    const n = Number.parseInt(current.id, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }

  return null;
}

function pipelineAllowed(pipelineId: number): boolean {
  const raw = (Deno.env.get('PIPEDRIVE_INBOUND_PIPELINE_IDS') || '').trim();
  if (!raw) return true;
  const allowed = new Set(
    raw.split(',').map((s) => Number.parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n)),
  );
  return allowed.has(pipelineId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const url = new URL(req.url);
  if (!verifyInboundToken(req, url)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const apiToken = (Deno.env.get('PIPEDRIVE_API_TOKEN') || '').trim();
  if (!apiToken) {
    return jsonResponse({ error: 'PIPEDRIVE_API_TOKEN not configured.' }, 500);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const dealId = extractDealId(payload);
  if (!dealId) {
    return jsonResponse({ error: 'Could not resolve Pipedrive deal id.' }, 400);
  }

  const deal = await pipedriveApiGet<Record<string, unknown>>(apiToken, `/deals/${dealId}`);
  if (!deal) {
    return jsonResponse({ error: `Deal ${dealId} not found in Pipedrive.` }, 404);
  }

  const status = String(deal.status || '').toLowerCase();
  if (status !== 'won') {
    return jsonResponse({ skipped: true, reason: 'deal_not_won', dealId, status }, 200);
  }

  const pipelineIdRaw = deal.pipeline_id;
  const pipelineId = typeof pipelineIdRaw === 'number' ? pipelineIdRaw : Number.parseInt(String(pipelineIdRaw), 10);
  if (Number.isInteger(pipelineId) && !pipelineAllowed(pipelineId)) {
    return jsonResponse({ skipped: true, reason: 'pipeline_not_allowed', dealId, pipelineId }, 200);
  }

  const personIdRaw = deal.person_id;
  const personId = typeof personIdRaw === 'number'
    ? personIdRaw
    : Number.parseInt(String(personIdRaw ?? '0'), 10);
  if (!Number.isInteger(personId) || personId <= 0) {
    return jsonResponse({ error: 'Deal has no linked person.' }, 400);
  }

  const person = await pipedriveApiGet<Record<string, unknown>>(apiToken, `/persons/${personId}`);
  if (!person) {
    return jsonResponse({ error: `Person ${personId} not found.` }, 404);
  }

  const email = readPersonEmail(person);
  const name = String(person.name || '').trim() || 'Zákazník Pipedrive';
  const phone = readPersonPhone(person);
  if (!email) {
    return jsonResponse({ error: 'Person has no email.' }, 400);
  }

  let { street, city, zip } = personPostalLine(person);
  let schoolName: string | null = null;
  let ico: string | null = null;

  const orgIdRaw = deal.org_id;
  const orgId = typeof orgIdRaw === 'number'
    ? orgIdRaw
    : Number.parseInt(String(orgIdRaw ?? '0'), 10);
  if (Number.isInteger(orgId) && orgId > 0) {
    const org = await pipedriveApiGet<Record<string, unknown>>(apiToken, `/organizations/${orgId}`);
    if (org) {
      schoolName = String(org.name || '').trim() || null;
      const vat = org.vat;
      if (typeof vat === 'string' && vat.trim()) {
        ico = vat.trim().replace(/\s/g, '');
      }
      if (!street && org.address) {
        const addr = String(org.address || '').trim();
        if (addr) street = addr;
      }
    }
  }

  const products = await pipedriveApiGet<unknown[]>(apiToken, `/deals/${dealId}/products`, { limit: 100 });
  const lines: Array<{ productId: string; productName: string; quantity: number; unitPriceHaler: number }> = [];
  if (Array.isArray(products)) {
    for (const raw of products) {
      const p = raw as Record<string, unknown>;
      const qty = typeof p.quantity === 'number' ? Math.max(1, Math.floor(p.quantity)) : 1;
      const unit = moneyToHaler(p.item_price ?? p.sum);
      const prId = p.product_id != null ? String(p.product_id) : 'unknown';
      const prName = String(p.name || `Produkt ${prId}`).trim() || `Produkt ${prId}`;
      lines.push({
        productId: `pipedrive:${prId}`,
        productName: prName,
        quantity: qty,
        unitPriceHaler: unit > 0 ? unit : moneyToHaler((Number(deal.value) || 0) / Math.max(1, qty)),
      });
    }
  }

  const dealValueHaler = moneyToHaler(deal.value);
  const shipMethod = (Deno.env.get('PIPEDRIVE_INBOUND_SHIPPING_METHOD') || DEFAULT_SHIPPING_METHOD).trim();
  const shipPrice = Number.parseInt(Deno.env.get('PIPEDRIVE_INBOUND_SHIPPING_PRICE_HALER') || '', 10);
  const shippingPrice = Number.isInteger(shipPrice) && shipPrice >= 0 ? shipPrice : DEFAULT_SHIPPING_PRICE_HALER;

  let subtotal = lines.reduce((s, l) => s + l.unitPriceHaler * l.quantity, 0);
  if (lines.length === 0 && dealValueHaler > 0) {
    lines.push({
      productId: `pipedrive-deal:${dealId}`,
      productName: String(deal.title || `Deal ${dealId}`),
      quantity: 1,
      unitPriceHaler: dealValueHaler,
    });
    subtotal = dealValueHaler;
  }
  if (subtotal <= 0) {
    return jsonResponse({ error: 'Deal has no value and no products.' }, 400);
  }

  const total = subtotal + shippingPrice;
  const hasIco = Boolean(ico && ico.replace(/\D/g, '').length > 0);
  const dealIdStr = String(dealId);
  const note = JSON.stringify({
    source: 'pipedrive_inbound',
    pipedriveDealId: dealId,
    dealTitle: deal.title,
  }).slice(0, 12000);

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const existing = await sql<{ id: string }[]>`
      select id from public.orders where pipedrive_deal_id = ${dealIdStr} limit 1
    `;
    if (existing.length > 0) {
      return jsonResponse({
        skipped: true,
        reason: 'already_imported',
        dealId,
        orderId: existing[0].id,
      }, 200);
    }

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
        note,
        pipedrive_deal_id,
        paid_at
      ) values (
        'paid',
        ${email.trim()},
        ${name},
        ${phone.trim() || null},
        ${schoolName},
        ${hasIco ? ico : null},
        ${street.trim() || '—'},
        ${city.trim() || '—'},
        ${zip.trim() || '—'},
        'CZ',
        ${shipMethod},
        ${shippingPrice},
        null,
        null,
        'invoice',
        'paid',
        ${subtotal},
        ${total},
        ${note},
        ${dealIdStr},
        now()
      )
      returning id, order_number
    `;

    const row = inserted[0];
    if (!row) {
      return jsonResponse({ error: 'Insert failed.' }, 500);
    }

    for (const line of lines) {
      await sql`
        insert into public.order_items (
          order_id,
          product_id,
          product_name,
          variant,
          quantity,
          unit_price,
          total_price
        ) values (
          ${row.id}::uuid,
          ${line.productId},
          ${line.productName},
          null,
          ${line.quantity},
          ${line.unitPriceHaler},
          ${line.unitPriceHaler * line.quantity}
        )
      `;
    }

    const customerSnapshot = {
      email: email.trim(),
      name,
      phone: phone.trim() || null,
      schoolName,
      ico: hasIco ? ico : null,
      street: street.trim() || '—',
      city: city.trim() || '—',
      zip: zip.trim() || '—',
    };
    const shippingSnapshot = { method: shipMethod, price: shippingPrice };

    await sql`
      insert into public.export_queue (order_id, service, status, payload)
      values (
        ${row.id}::uuid,
        'basecom',
        'pending',
        ${JSON.stringify({
          orderId: row.id,
          pipedriveDealId: dealId,
          items: lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            quantity: l.quantity,
            unitPrice: l.unitPriceHaler,
          })),
          customer: customerSnapshot,
          shipping: shippingSnapshot,
        })}::jsonb
      )
    `;

    if (hasIco) {
      await sql`
        insert into public.export_queue (order_id, service, status, payload)
        values (
          ${row.id}::uuid,
          'idoklad',
          'pending',
          ${JSON.stringify({ orderId: row.id, pipedriveDealId: dealId })}::jsonb
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
        ${row.id}::uuid,
        'pipedrive_inbound',
        null,
        'paid',
        ${JSON.stringify({ pipedriveDealId: dealId })}::jsonb,
        'pipedrive'
      )
    `;

    try {
      await invokeProcessExportQueue(req.url);
    } catch (e) {
      console.error('[pipedrive-inbound] process-export-queue:', e);
    }

    return jsonResponse({
      success: true,
      orderId: row.id,
      orderNumber: row.order_number,
      dealId,
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    console.error('[pipedrive-inbound]', msg);
    return jsonResponse({ error: msg }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
