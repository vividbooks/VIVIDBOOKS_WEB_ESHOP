/**
 * Inbound: Pipedrive deal (typicky WON) → objednávka v Postgres + fronta exportu (Base.com / volitelně iDoklad).
 *
 * Volání:
 * - Webhook z Pipedrive: POST …/pipedrive-inbound-deal?token=<PIPEDRIVE_INBOUND_WEBHOOK_SECRET>
 *   Tělo = standardní JSON webhooku (meta.id / current.id = deal ID).
 * - Test ručně: POST stejná URL, stejný token, JSON { "deal_id": 12345 }
 * - GET/HEAD → vždy 200 (Pipedrive při kontrole často volá URL bez ?token=; s tokenem vracíme bohatší JSON).
 * - POST s platným tokenem a prázdným / neúplným tělem → 200 (ping / test), ne 400 — jinak Pipedrive hlásí „inaccessible“.
 *
 * Vyžaduje: PIPEDRIVE_API_TOKEN, PIPEDRIVE_INBOUND_WEBHOOK_SECRET.
 * Bez osoby / bez e-mailu / nulová hodnota: objednávka se vytvoří s poznámkou a placeholdery; export jen při kompletním kontaktu.
 * Volitelně: PIPEDRIVE_INBOUND_PIPELINE_IDS (čárkou oddělená ID pipeline, prázdné = všechny).
 *
 * Nasazení: supabase functions deploy pipedrive-inbound-deal --no-verify-jwt
 */
import postgres from 'npm:postgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pipedrive-inbound-token',
  /** GET/HEAD: Pipedrive při kontrole dostupnosti webhooku volá URL v prohlížeči nebo HEAD requestem — dříve jen POST → 405 → „inaccessible“. */
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
};

const DEFAULT_SHIPPING_METHOD = 'dpd';
const DEFAULT_SHIPPING_PRICE_HALER = 8900;

const ADMIN_NOTE_MISSING_PIPEDRIVE_PERSON =
  'Pipedrive import: u dealu chybí osoba i kontakt u organizace. Doplňte u objednávky e-mail a kontakt na zákazníka.';

const ADMIN_NOTE_MISSING_EMAIL =
  'Pipedrive import: u osoby u dealu chybí e-mail. Doplňte platný kontakt v objednávce.';

const ADMIN_NOTE_ZERO_VALUE_FALLBACK =
  'Pipedrive import: deal měl nulovou částku nebo nešly načíst produkty; použita minimální řádka 1 Kč — zkontrolujte položky.';

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

/** Pipedrive vrací ID jako číslo, řetězec nebo objekt `{ value, id, … }`. */
function parsePipedriveEntityId(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    /** Jen celé číslo v řetězci — parseInt z UUID prefixu by vracelo náhodné číslo. */
    if (!/^\d+$/.test(t)) return null;
    const n = Number.parseInt(t, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const nested = o.value ?? o.id ?? o.person_id ?? o.org_id;
    if (nested !== undefined && nested !== value) return parsePipedriveEntityId(nested);
  }
  return null;
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

  /** Webhooks v2: deal ID je v meta.entity_id; objekt dealu je `data` (ne `current`). */
  const meta = body.meta as Record<string, unknown> | undefined;
  if (meta) {
    const fromEntity = parsePipedriveEntityId(meta.entity_id ?? meta.entityId);
    if (fromEntity != null) return fromEntity;
  }

  const dataObj = body.data as Record<string, unknown> | undefined;
  if (dataObj) {
    const fromData = parsePipedriveEntityId(dataObj.id);
    if (fromData != null) return fromData;
  }

  /** Legacy webhooks v1: meta.id = číselné ID entity (ne UUID jako ve v2). */
  if (meta && typeof meta.id === 'number' && Number.isInteger(meta.id)) return meta.id as number;
  if (meta && typeof meta.id === 'string') {
    const s = meta.id.trim();
    if (/^\d+$/.test(s)) {
      const n = Number.parseInt(s, 10);
      if (Number.isInteger(n) && n > 0) return n;
    }
  }

  const current = body.current as Record<string, unknown> | undefined;
  if (current) {
    const fromCurrent = parsePipedriveEntityId(current.id);
    if (fromCurrent != null) return fromCurrent;
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

/** Viditelné v Supabase → Edge Functions → Logs (ne jen shutdown/boot). */
function logInbound(event: string, data?: Record<string, unknown>) {
  console.log(`[pipedrive-inbound] ${event}`, data ? JSON.stringify(data) : '');
}

function isPostgresUniqueViolation(e: unknown): boolean {
  return Boolean(
    e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '23505',
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  /** Reachability: Pipedrive ověření často volá GET/HEAD na základní URL bez query — 401 = „webhook inaccessible“. */
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (verifyInboundToken(req, url)) {
      return jsonResponse({
        ok: true,
        service: 'pipedrive-inbound-deal',
        hint: 'Webhook accepts POST with Pipedrive JSON or { "deal_id": number }.',
      }, 200);
    }
    return jsonResponse({
      ok: true,
      service: 'pipedrive-inbound-deal',
      probe: 'reachable',
      hint: 'Pipedrive URL check: OK. Real deliveries: POST with ?token= or x-pipedrive-inbound-token header.',
    }, 200);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  if (!verifyInboundToken(req, url)) {
    logInbound('unauthorized', { hint: 'token v URL ?token= nebo hlavička x-pipedrive-inbound-token' });
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const rawBody = await req.text();
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return jsonResponse({
      ok: true,
      accepted: false,
      hint: 'Empty body — no import. Send Pipedrive webhook JSON or { "deal_id": number }.',
    }, 200);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ ok: true, accepted: false, hint: 'Body must be a JSON object.' }, 200);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: true, accepted: false, hint: 'Invalid JSON — use Pipedrive webhook payload or { "deal_id": number }.' }, 200);
  }

  const dealId = extractDealId(payload);
  if (!dealId) {
    logInbound('no_deal_id', { keys: Object.keys(payload).slice(0, 20) });
    return jsonResponse(
      {
        ok: true,
        skipped: true,
        reason: 'no_deal_id',
        hint:
          'Could not resolve deal id from payload (expected meta.entity_id / data.id — Webhooks v2 — or legacy meta.id / current.id / deal_id).',
      },
      200,
    );
  }

  const apiToken = (Deno.env.get('PIPEDRIVE_API_TOKEN') || '').trim();
  if (!apiToken) {
    return jsonResponse({ error: 'PIPEDRIVE_API_TOKEN not configured.' }, 500);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  logInbound('start', { dealId });

  const deal = await pipedriveApiGet<Record<string, unknown>>(apiToken, `/deals/${dealId}`);
  if (!deal) {
    logInbound('skipped', { dealId, reason: 'deal_not_found' });
    return jsonResponse({ skipped: true, reason: 'deal_not_found', dealId }, 200);
  }

  const status = String(deal.status || '').toLowerCase();
  if (status !== 'won') {
    logInbound('skipped', { dealId, reason: 'deal_not_won', status });
    return jsonResponse({ skipped: true, reason: 'deal_not_won', dealId, status }, 200);
  }

  const pipelineId = parsePipedriveEntityId(deal.pipeline_id);
  if (pipelineId != null && !pipelineAllowed(pipelineId)) {
    logInbound('skipped', { dealId, reason: 'pipeline_not_allowed', pipelineId });
    return jsonResponse({ skipped: true, reason: 'pipeline_not_allowed', dealId, pipelineId }, 200);
  }

  const personIdFromDeal = parsePipedriveEntityId(deal.person_id);
  let person: Record<string, unknown> | null = null;

  if (personIdFromDeal) {
    person = await pipedriveApiGet<Record<string, unknown>>(apiToken, `/persons/${personIdFromDeal}`);
  }

  if (!person) {
    const orgIdForPerson = parsePipedriveEntityId(deal.org_id);
    if (orgIdForPerson) {
      const list = await pipedriveApiGet<unknown[]>(apiToken, `/organizations/${orgIdForPerson}/persons`, {
        limit: 100,
        status: 'all_not_deleted',
      });
      const persons = Array.isArray(list) ? list : [];
      const withEmail = persons.find((p) => readPersonEmail(p as Record<string, unknown>));
      person = (withEmail as Record<string, unknown>) || (persons[0] as Record<string, unknown>) || null;
    }
  }

  /** Bez osoby / bez e-mailu — objednávku stejně vytvoříme; v adminu je poznámka + placeholder e-mail. */
  let missingPipedriveContact = !person;
  let missingEmailOnly = false;

  let email = '';
  let name = '';
  let phone = '';
  let street = '';
  let city = '';
  let zip = '';

  if (person) {
    email = readPersonEmail(person);
    name = String(person.name || '').trim() || 'Zákazník Pipedrive';
    phone = readPersonPhone(person);
    const line = personPostalLine(person);
    street = line.street;
    city = line.city;
    zip = line.zip;
    if (!email.trim()) {
      missingPipedriveContact = true;
      missingEmailOnly = true;
      const pid = personIdFromDeal ?? parsePipedriveEntityId(person.id) ?? dealId;
      email = `pipedrive-person-${pid}@missing-email.invalid`;
    }
  } else {
    email = `pipedrive-deal-${dealId}@missing-contact.invalid`;
    name = '(Pipedrive — bez osoby)';
    phone = '';
  }

  let schoolName: string | null = null;
  let ico: string | null = null;

  const orgId = parsePipedriveEntityId(deal.org_id);
  if (orgId != null && orgId > 0) {
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
  /** Nulová hodnota / prázdné produkty — minimální řádek 1 Kč, ať import nespadne na 400. */
  let usedZeroValueFallback = false;
  if (subtotal <= 0) {
    usedZeroValueFallback = true;
    lines.length = 0;
    lines.push({
      productId: `pipedrive-deal:${dealId}`,
      productName: String(deal.title || `Deal ${dealId}`),
      quantity: 1,
      unitPriceHaler: 100,
    });
    subtotal = 100;
  }

  const total = subtotal + shippingPrice;
  const hasIco = Boolean(ico && ico.replace(/\D/g, '').length > 0);
  const dealIdStr = String(dealId);
  const orderStatus = missingPipedriveContact ? 'processing' : 'paid';
  const paymentStatus = missingPipedriveContact ? 'pending' : 'paid';
  let adminNote: string | null = missingPipedriveContact
    ? (missingEmailOnly ? ADMIN_NOTE_MISSING_EMAIL : ADMIN_NOTE_MISSING_PIPEDRIVE_PERSON)
    : null;
  if (usedZeroValueFallback) {
    adminNote = adminNote
      ? `${adminNote}\n\n${ADMIN_NOTE_ZERO_VALUE_FALLBACK}`
      : ADMIN_NOTE_ZERO_VALUE_FALLBACK;
  }

  const note = JSON.stringify({
    source: 'pipedrive_inbound',
    pipedriveDealId: dealId,
    dealTitle: deal.title,
    missingPipedriveContact,
    missingEmailOnly,
    zeroValueFallback: usedZeroValueFallback,
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
      logInbound('skipped', {
        dealId,
        reason: 'already_imported',
        orderId: existing[0].id,
      });
      return jsonResponse({
        skipped: true,
        reason: 'already_imported',
        dealId,
        orderId: existing[0].id,
      }, 200);
    }

    let inserted: { id: string; order_number: string }[];
    try {
      inserted = await sql<{ id: string; order_number: string }[]>`
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
        admin_note,
        pipedrive_deal_id,
        paid_at
      ) values (
        ${orderStatus},
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
        ${paymentStatus},
        ${subtotal},
        ${total},
        ${note},
        ${adminNote},
        ${dealIdStr},
        ${missingPipedriveContact ? null : new Date()}
      )
      returning id, order_number
    `;
    } catch (insertErr) {
      if (isPostgresUniqueViolation(insertErr)) {
        const race = await sql<{ id: string; order_number: string }[]>`
          select id, order_number from public.orders where pipedrive_deal_id = ${dealIdStr} limit 1
        `;
        if (race.length > 0) {
          logInbound('skipped', {
            dealId,
            reason: 'already_imported_race',
            orderId: race[0].id,
          });
          return jsonResponse({
            skipped: true,
            reason: 'already_imported',
            dealId,
            orderId: race[0].id,
            orderNumber: race[0].order_number,
          }, 200);
        }
      }
      throw insertErr;
    }

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

    if (!missingPipedriveContact) {
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

      await sql`
        insert into public.export_queue (order_id, service, status, payload)
        values (
          ${row.id}::uuid,
          'idoklad',
          'pending',
          ${JSON.stringify({ orderId: row.id, pipedriveDealId: dealId })}::jsonb
        )
      `;

      try {
        await invokeProcessExportQueue(req.url);
      } catch (e) {
        console.error('[pipedrive-inbound] process-export-queue:', e);
      }
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
        ${orderStatus},
        ${JSON.stringify({
          pipedriveDealId: dealId,
          missingPipedriveContact,
        })}::jsonb,
        'pipedrive'
      )
    `;

    logInbound('success', {
      dealId,
      orderNumber: row.order_number,
      orderId: row.id,
      missingPipedriveContact,
      missingEmailOnly,
      usedZeroValueFallback,
    });
    return jsonResponse({
      success: true,
      orderId: row.id,
      orderNumber: row.order_number,
      dealId,
      ...(missingPipedriveContact
        ? {
          warning:
            'Objednávka vytvořena bez kontaktu ve Pipedrive — v administraci doplňte zákazníka (admin poznámka + placeholder e-mail).',
        }
        : {}),
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    console.error('[pipedrive-inbound]', msg);
    return jsonResponse({ error: msg }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
