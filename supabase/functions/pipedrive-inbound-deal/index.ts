import { resolveAllowedOrigin } from '../_shared/cors.ts';
/**
 * Inbound: Pipedrive deal (typicky WON) → objednávka v Postgres + fronta exportu **jen Base.com**.
 *
 * Webhook rozlišuje dva scénáře podle pole „Eshop ID" (custom field 26e4a2f8…, UI ID 12586):
 *
 *   A) Pole je **prázdné** → deal byl ručně založený obchodníkem v CRM. Vytvoříme NOVOU
 *      objednávku se zdrojem `pipedrive`, dopravou z ENV (default PPL) a předáme do Base.com.
 *
 *   B) Pole je **vyplněné** (nebo k dealu existuje řádek v `orders.pipedrive_deal_id`) → deal
 *      vznikl synchronizací z e‑shopu (typicky platba převodem). Obchodník mohl produkty v dealu
 *      upravit. Najdeme původní objednávku přes `order_number`, **přepíšeme `order_items` podle
 *      dealu**, nastavíme `payment_status = 'paid'` + `paid_at`, a exportujeme / aktualizujeme Base:
 *      při prvním exportu `addOrder` se stavem z `BASECOM_ORDER_STATUS_ID_PIPEDRIVE_INBOUND`; pokud už
 *      Base export proběhl (`orders.basecom_order_id`), zařadí se jen `setOrderStatus` na stejný stav.
 *
 * Volání:
 * - Webhook z Pipedrive: POST …/pipedrive-inbound-deal?token=<PIPEDRIVE_INBOUND_WEBHOOK_SECRET>
 *   Tělo = standardní JSON webhooku (meta.entity_id / current.id / data.id = deal ID).
 * - Test ručně: POST stejná URL, stejný token, JSON { "deal_id": 12345 }
 * - GET/HEAD → vždy 200 (Pipedrive při kontrole často volá URL bez ?token=; s tokenem vracíme bohatší JSON).
 * - POST s platným tokenem a prázdným / neúplným tělem → 200 (ping / test), ne 400 — jinak Pipedrive hlásí „inaccessible".
 *
 * Vyžaduje: PIPEDRIVE_API_TOKEN, PIPEDRIVE_INBOUND_WEBHOOK_SECRET.
 * Bez osoby / bez e-mailu: objednávka (scénář A) se vytvoří s poznámkou a placeholdery; do Base.com se export pošle i tak (kvůli ručním dealům v CRM).
 * Volitelně:
 *   - PIPEDRIVE_INBOUND_PIPELINE_IDS (čárkou oddělená ID pipeline, prázdné = všechny),
 *   - PIPEDRIVE_INBOUND_SHIPPING_METHOD (default `ppl`),
 *   - PIPEDRIVE_INBOUND_SHIPPING_PRICE_HALER (default 8900 = 89 Kč),
 *   - BASECOM_ORDER_STATUS_ID_PIPEDRIVE_INBOUND (BaseLinker `order_status_id` — např. stav „Do expedice — manuálně"; bez hodnoty zůstane výchozí z `process-export-queue`),
 *   - PIPEDRIVE_INBOUND_ESHOP_ORDER_ID_FIELD (override hash custom pole „Eshop ID" pro lookup).
 *   - PIPEDRIVE_INBOUND_DEAL_ORDER_NUMBER_FIELD (override hash pole „číslo objednávky" na dealu, UI ID 12530,
 *     default 3525a2dc…) — u scénáře A (nová objednávka z PD) se hodnota uloží do `orders.order_number`, není-li obsazená ani v kolizi s jinou objednávkou (čte se z plochého deal objektu, z mapy `custom_fields` i z pole záznamů stejných jako u některých webhooků).
 *
 * Spuštění `process-export-queue` po zápisu objednávky probíhá na pozadí (`EdgeRuntime.waitUntil`), aby odpověď
 * webhooku nepřesáhla časový limit kvůli dlouhému Base.com (jinak Pipedrive opakuje doručení).
 *
 * Nasazení: supabase functions deploy pipedrive-inbound-deal --no-verify-jwt
 */
import postgres from 'npm:postgres';
import { processExportQueueCronHeaders } from '../_shared/process-export-queue-auth.ts';

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pipedrive-inbound-token',
  /** GET/HEAD: Pipedrive při kontrole dostupnosti webhooku volá URL v prohlížeči nebo HEAD requestem — dříve jen POST → 405 → „inaccessible“. */
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
});

const DEFAULT_SHIPPING_METHOD = 'ppl';
const DEFAULT_SHIPPING_PRICE_HALER = 8900;

/** Custom pole „Eshop ID" na dealu (UI ID 12586). Při založení dealu z e‑shopu ho plní
 *  `make-server-93a20b6f` přes `getEshopOrderIdPayload()` hodnotou `order_number`. Pokud je vyplněné,
 *  webhook deal považuje za pokračování e‑shopové objednávky a místo nového INSERTu provede UPDATE +
 *  re-export. Pokud je prázdné, deal je ručně založený v CRM → vznikne nová objednávka se zdrojem `pipedrive`. */
const PIPEDRIVE_ESHOP_ORDER_ID_FIELD_KEY_DEFAULT = '26e4a2f8dc44e49f369c468ccc816ad668b37d92';

/** Vlastní pole na dealu (Pipedrive UI ID 12530) — požadované číslo objednávky v e‑shopu pro scénář A. */
const PIPEDRIVE_INBOUND_DEAL_ORDER_NUMBER_FIELD_KEY_DEFAULT =
  '3525a2dc77a0cfdaa1b4d15ac7d4175a4c6cb11c';

const ADMIN_NOTE_MISSING_PIPEDRIVE_PERSON =
  'Pipedrive import: u dealu chybí osoba i kontakt u organizace. Doplňte u objednávky e-mail a kontakt na zákazníka.';

const ADMIN_NOTE_MISSING_EMAIL =
  'Pipedrive import: u osoby u dealu chybí e-mail. Doplňte platný kontakt v objednávce.';

const ADMIN_NOTE_ZERO_VALUE_FALLBACK =
  'Pipedrive import: deal měl nulovou částku nebo nešly načíst produkty; použita minimální řádka 1 Kč — zkontrolujte položky.';

/** Číslo stavu objednávky v BaseLinkeru pro inbound z Pipedrive (např. „Do expedice — manuálně"). */
function inboundPipedriveBaseOrderStatusId(): number | null {
  const raw = (Deno.env.get('BASECOM_ORDER_STATUS_ID_PIPEDRIVE_INBOUND') || '').trim();
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
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
    headers: {
      'Content-Type': 'application/json',
      ...getFunctionAuthHeaders(),
      ...processExportQueueCronHeaders(),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `process-export-queue HTTP ${response.status}`);
  }
}

/** Po INSERT/UPDATE objednávky nesmí webhook čekat na celý běh `process-export-queue` (Base.com / iDoklad)
 *  — často překročí limit času odpovědi → Pipedrive hlásí selhání a opakuje doručení. Dokončení úlohy naplánujeme
 *  přes Edge `waitUntil` (stejný vzor jako u make-server slack/RAG). */
function scheduleProcessExportQueueKick(fallbackRequestUrl?: string): void {
  const task = invokeProcessExportQueue(fallbackRequestUrl).catch((e) => {
    console.error('[pipedrive-inbound] process-export-queue:', e);
  });
  try {
    const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (typeof er?.waitUntil === 'function') {
      er.waitUntil(task);
      return;
    }
  } catch {
    /* ignore */
  }
  void task;
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
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t) return t;
  }
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
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t) return t;
  }
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

/** Skalární vlastní pole Pipedrive: v1 API často přímo string/číslo, v2 / některé odpovědi `{ type, value }`. */
function pipedriveScalarCustomFieldToString(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw).trim();
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (typeof o.value === 'string') return o.value.trim();
    if (typeof o.value === 'number' && Number.isFinite(o.value)) return String(o.value).trim();
  }
  return '';
}

/** Vyčte hodnotu pole „Eshop ID" z dealu. Hash klíče lze přepsat env `PIPEDRIVE_INBOUND_ESHOP_ORDER_ID_FIELD`,
 *  ale výchozí hodnota odpovídá produkčnímu poli na Pipedrive UI ID 12586. Podporuje v1 plochý objekt dealu
 *  i `data.custom_fields` z webhooků / novějších odpovědí. */
function readEshopOrderNumberFromDeal(deal: Record<string, unknown>): string {
  const fieldKey = (Deno.env.get('PIPEDRIVE_INBOUND_ESHOP_ORDER_ID_FIELD') || '').trim()
    || PIPEDRIVE_ESHOP_ORDER_ID_FIELD_KEY_DEFAULT;

  let raw: unknown = deal[fieldKey];
  let s = pipedriveScalarCustomFieldToString(raw);
  if (s) return s;

  const cf = deal.custom_fields;
  if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
    const nested = (cf as Record<string, unknown>)[fieldKey];
    s = pipedriveScalarCustomFieldToString(nested);
    if (s) return s;
  }

  /** Záloha: UI ID pole jako string klíče (JSON klíče jsou vždy stringy). */
  const byUiId = deal['12586'];
  s = pipedriveScalarCustomFieldToString(byUiId);
  if (s) return s;

  if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
    const nestedUi = (cf as Record<string, unknown>)['12586'];
    s = pipedriveScalarCustomFieldToString(nestedUi);
    if (s) return s;
  }

  return '';
}

/** Vyčtení vlastního pole dealu podle hash klíče z nastavení PD nebo podle UI ID (řetězec, např. `12530`).
 *  Podporuje plochý objekt dealu, `custom_fields` jako mapu i pole záznamů (některé webhooky / novější payloady). */
function extractPipedriveDealCustomScalar(
  deal: Record<string, unknown>,
  fieldKey: string,
  uiIdStr: string,
): string {
  const tryContainer = (container: Record<string, unknown>): string => {
    let v = pipedriveScalarCustomFieldToString(container[fieldKey]);
    if (v) return v;
    v = pipedriveScalarCustomFieldToString(container[uiIdStr]);
    return v || '';
  };

  let s = tryContainer(deal);
  if (s) return s;

  const cf = deal.custom_fields;
  if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
    s = tryContainer(cf as Record<string, unknown>);
    if (s) return s;
  }

  if (Array.isArray(cf)) {
    const uiNum = Number.parseInt(uiIdStr, 10);
    for (const entry of cf) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const o = entry as Record<string, unknown>;
      const idRaw = o.id ?? o.field_id ?? o.fieldId;
      const idStr = idRaw != null ? String(idRaw).trim() : '';
      const hashRaw = typeof o.key === 'string'
        ? o.key.trim()
        : typeof o.hash === 'string'
        ? o.hash.trim()
        : '';
      const matches =
        hashRaw === fieldKey ||
        idStr === uiIdStr ||
        (Number.isInteger(uiNum) && idStr === String(uiNum));
      if (!matches) continue;
      const rawVal = o.value ?? o.values ?? o;
      s = pipedriveScalarCustomFieldToString(rawVal);
      if (s) return s;
    }
  }

  return '';
}

/** Číslo objednávky ze dealu (jen scénář A) — pole UI ID **12530**, hash **3525a2dc…** (`PIPEDRIVE_INBOUND_DEAL_ORDER_NUMBER_FIELD`). */
function readInboundDealExplicitOrderNumberFromDeal(deal: Record<string, unknown>): string {
  const fieldKey = (Deno.env.get('PIPEDRIVE_INBOUND_DEAL_ORDER_NUMBER_FIELD') || '').trim()
    || PIPEDRIVE_INBOUND_DEAL_ORDER_NUMBER_FIELD_KEY_DEFAULT;
  return extractPipedriveDealCustomScalar(deal, fieldKey, '12530');
}

function normalizeInboundExplicitOrderNumber(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80) return null;
  return t;
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
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  const url = new URL(req.url);

  /** Reachability: Pipedrive ověření často volá GET/HEAD na základní URL bez query — 401 = „webhook inaccessible“. */
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      });
    }
    if (verifyInboundToken(req, url)) {
      return jsonResponse(req, {
        ok: true,
        service: 'pipedrive-inbound-deal',
        hint: 'Webhook accepts POST with Pipedrive JSON or { "deal_id": number }.',
      }, 200);
    }
    return jsonResponse(req, {
      ok: true,
      service: 'pipedrive-inbound-deal',
      probe: 'reachable',
      hint: 'Pipedrive URL check: OK. Real deliveries: POST with ?token= or x-pipedrive-inbound-token header.',
    }, 200);
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  if (!verifyInboundToken(req, url)) {
    logInbound('unauthorized', { hint: 'token v URL ?token= nebo hlavička x-pipedrive-inbound-token' });
    return jsonResponse(req, { error: 'Unauthorized.' }, 401);
  }

  const rawBody = await req.text();
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return jsonResponse(req, {
      ok: true,
      accepted: false,
      hint: 'Empty body — no import. Send Pipedrive webhook JSON or { "deal_id": number }.',
    }, 200);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse(req, { ok: true, accepted: false, hint: 'Body must be a JSON object.' }, 200);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(req, { ok: true, accepted: false, hint: 'Invalid JSON — use Pipedrive webhook payload or { "deal_id": number }.' }, 200);
  }

  const dealId = extractDealId(payload);
  if (!dealId) {
    logInbound('no_deal_id', { keys: Object.keys(payload).slice(0, 20) });
    return jsonResponse(req, 
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
    return jsonResponse(req, { error: 'PIPEDRIVE_API_TOKEN not configured.' }, 500);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse(req, { error: 'Missing DATABASE_URL.' }, 500);
  }

  logInbound('start', { dealId });

  const deal = await pipedriveApiGet<Record<string, unknown>>(apiToken, `/deals/${dealId}`);
  if (!deal) {
    logInbound('skipped', { dealId, reason: 'deal_not_found' });
    return jsonResponse(req, { skipped: true, reason: 'deal_not_found', dealId }, 200);
  }

  const status = String(deal.status || '').toLowerCase();
  if (status !== 'won') {
    logInbound('skipped', { dealId, reason: 'deal_not_won', status });
    return jsonResponse(req, { skipped: true, reason: 'deal_not_won', dealId, status }, 200);
  }

  const pipelineId = parsePipedriveEntityId(deal.pipeline_id);
  if (pipelineId != null && !pipelineAllowed(pipelineId)) {
    logInbound('skipped', { dealId, reason: 'pipeline_not_allowed', pipelineId });
    return jsonResponse(req, { skipped: true, reason: 'pipeline_not_allowed', dealId, pipelineId }, 200);
  }

  const pdInboundBaseStatusId = inboundPipedriveBaseOrderStatusId();

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

  const inboundExplicitOrderCandidate = normalizeInboundExplicitOrderNumber(
    readInboundDealExplicitOrderNumberFromDeal(deal),
  );

  const note = JSON.stringify({
    source: 'pipedrive_inbound',
    pipedriveDealId: dealId,
    dealTitle: deal.title,
    missingPipedriveContact,
    missingEmailOnly,
    zeroValueFallback: usedZeroValueFallback,
    pipedriveDealOrderNumberField: inboundExplicitOrderCandidate || undefined,
  }).slice(0, 12000);

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  /** Lookup mapování deal → existující eshop objednávka.
   *
   *  Priorita:
   *    1) Pole „Eshop ID" (custom field 26e4a2f8…) → match přes `orders.order_number`.
   *       Eshop hodnotu plní při zakládání dealu z webu (`syncEshopOrderToPipedriveFromDb` →
   *       `getEshopOrderIdPayload`). Když je vyplněné, deal vznikl z eshopu a chceme UPDATE.
   *    2) `pipedrive_deal_id` → match na `orders.pipedrive_deal_id` (záchranná síť pro deal,
   *       kde někdo Eshop ID smazal, nebo pro re‑run webhooku po předchozím INSERTu z A scénáře).
   *
   *  Když ani jedno netrefí, deal je „ručně založený v CRM" → scénář A: nová objednávka
   *  se zdrojem `pipedrive` a dopravou PPL.
   */
  const eshopOrderNumber = readEshopOrderNumberFromDeal(deal);

  try {
    let existing: { id: string; order_number: string; status: string; payment_status: string | null }[] = [];
    if (eshopOrderNumber) {
      existing = await sql<{ id: string; order_number: string; status: string; payment_status: string | null }[]>`
        select id, order_number, status, payment_status
          from public.orders
         where order_number = ${eshopOrderNumber}
         limit 1
      `;
    }
    if (existing.length === 0) {
      existing = await sql<{ id: string; order_number: string; status: string; payment_status: string | null }[]>`
        select id, order_number, status, payment_status
          from public.orders
         where pipedrive_deal_id = ${dealIdStr}
         limit 1
      `;
    }

    /* ============================================================================ */
    /* SCÉNÁŘ B — UPDATE existující objednávky (deal pochází z eshopu, byl `won`).   */
    /* ============================================================================ */
    if (existing.length > 0) {
      const target = existing[0];

      /* Idempotence pro `addOrder`: když už jednou Base.com doběhl do `done` (nebo právě běží),
       * druhý pending řádek pro nový export nepřidáváme. Pokud už známe `basecom_order_id`, zařadíme
       * pouze `setOrderStatus` na stav z BASECOM_ORDER_STATUS_ID_PIPEDRIVE_INBOUND. */
      const exportRows = await sql<{ service: string; status: string }[]>`
        select service, status
          from public.export_queue
         where order_id = ${target.id}::uuid
           and service = 'basecom'
      `;
      const existingExportServices = new Set(
        exportRows
          .filter((r) => r.status === 'pending' || r.status === 'processing' || r.status === 'done')
          .map((r) => r.service),
      );

      await sql.begin(async (tx) => {
        await tx`delete from public.order_items where order_id = ${target.id}::uuid`;
        for (const line of lines) {
          await tx`
            insert into public.order_items (
              order_id,
              product_id,
              product_name,
              variant,
              quantity,
              unit_price,
              total_price
            ) values (
              ${target.id}::uuid,
              ${line.productId},
              ${line.productName},
              null,
              ${line.quantity},
              ${line.unitPriceHaler},
              ${line.unitPriceHaler * line.quantity}
            )
          `;
        }

        await tx`
          update public.orders set
            subtotal = ${subtotal},
            total = ${total},
            shipping_price = ${shippingPrice},
            shipping_method = ${shipMethod},
            payment_status = 'paid',
            status = 'paid',
            paid_at = coalesce(paid_at, now()),
            pipedrive_deal_id = ${dealIdStr},
            updated_at = now()
          where id = ${target.id}::uuid
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
            ${target.id}::uuid,
            'pipedrive_inbound_update',
            ${target.status},
            'paid',
            ${JSON.stringify({
              pipedriveDealId: dealId,
              eshopOrderNumber: eshopOrderNumber || null,
              replacedItems: lines.length,
              prevPaymentStatus: target.payment_status,
            })}::jsonb,
            'pipedrive'
          )
        `;
      });

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

      const baseMetaRows = await sql<{ basecom_order_id: string | null }[]>`
        select basecom_order_id from public.orders where id = ${target.id}::uuid limit 1
      `;
      const savedBlOrderId = String(baseMetaRows[0]?.basecom_order_id || '').trim();

      const queuedServices: string[] = [];
      const skippedServices: string[] = [];

      const basePayloadFull = {
        orderId: target.id,
        pipedriveDealId: dealId,
        items: lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          quantity: l.quantity,
          unitPrice: l.unitPriceHaler,
        })),
        customer: customerSnapshot,
        shipping: shippingSnapshot,
        ...(pdInboundBaseStatusId != null ? { basecomOrderStatusId: pdInboundBaseStatusId } : {}),
      };

      let queuedExportKick = false;

      if (
        pdInboundBaseStatusId != null &&
        savedBlOrderId &&
        existingExportServices.has('basecom')
      ) {
        await sql`
          insert into public.export_queue (order_id, service, status, payload)
          values (
            ${target.id}::uuid,
            'basecom',
            'pending',
            ${JSON.stringify({
              pipedriveInboundSetStatus: true,
              baseLinkerOrderId: savedBlOrderId,
              basecomOrderStatusId: pdInboundBaseStatusId,
            })}::jsonb
          )
        `;
        queuedServices.push('basecom_set_status');
        queuedExportKick = true;
      } else if (!existingExportServices.has('basecom')) {
        await sql`
          insert into public.export_queue (order_id, service, status, payload)
          values (
            ${target.id}::uuid,
            'basecom',
            'pending',
            ${JSON.stringify(basePayloadFull)}::jsonb
          )
        `;
        queuedServices.push('basecom');
        queuedExportKick = true;
      } else {
        skippedServices.push('basecom');
      }

      if (queuedExportKick) {
        scheduleProcessExportQueueKick(req.url);
      }

      logInbound('updated', {
        dealId,
        orderId: target.id,
        orderNumber: target.order_number,
        eshopOrderNumber: eshopOrderNumber || null,
        replacedItems: lines.length,
        queuedServices,
        skippedServices,
      });

      return jsonResponse(req, {
        success: true,
        mode: 'updated',
        orderId: target.id,
        orderNumber: target.order_number,
        dealId,
        eshopOrderNumber: eshopOrderNumber || null,
        replacedItems: lines.length,
        queuedServices,
        skippedServices,
      }, 200);
    }

    /* ============================================================================ */
    /* SCÉNÁŘ A — nová objednávka (ručně založený deal v CRM, bez Eshop ID matche).  */
    /* ============================================================================ */
    let orderNumberForInsert: string | null = inboundExplicitOrderCandidate;
    if (orderNumberForInsert) {
      const clash = await sql<{ id: string }[]>`
        select id from public.orders where order_number = ${orderNumberForInsert} limit 1
      `;
      if (clash.length > 0) {
        logInbound('inbound_explicit_order_number_taken', {
          dealId,
          orderNumber: orderNumberForInsert,
        });
        orderNumberForInsert = null;
      }
    }

    const hadExplicitOrderNumberAttempt = Boolean(orderNumberForInsert);

    let inserted: { id: string; order_number: string }[];
    try {
      inserted = await sql<{ id: string; order_number: string }[]>`
      insert into public.orders (
        status,
        source,
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
        order_number,
        paid_at
      ) values (
        ${orderStatus},
        'pipedrive',
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
        ${orderNumberForInsert},
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
          return jsonResponse(req, {
            skipped: true,
            mode: 'skipped',
            reason: 'already_imported',
            dealId,
            orderId: race[0].id,
            orderNumber: race[0].order_number,
          }, 200);
        }
        if (hadExplicitOrderNumberAttempt) {
          logInbound('inbound_order_number_unique_fallback', { dealId });
          inserted = await sql<{ id: string; order_number: string }[]>`
      insert into public.orders (
        status,
        source,
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
        order_number,
        paid_at
      ) values (
        ${orderStatus},
        'pipedrive',
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
        ${null},
        ${missingPipedriveContact ? null : new Date()}
      )
      returning id, order_number
    `;
        } else {
          throw insertErr;
        }
      } else {
        throw insertErr;
      }
    }

    const row = inserted[0];
    if (!row) {
      return jsonResponse(req, { error: 'Insert failed.' }, 500);
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

    const customerSnapshotA = {
      email: email.trim(),
      name,
      phone: phone.trim() || null,
      schoolName,
      ico: hasIco ? ico : null,
      street: street.trim() || '—',
      city: city.trim() || '—',
      zip: zip.trim() || '—',
    };
    const shippingSnapshotA = { method: shipMethod, price: shippingPrice };

    /** Base.com i bez kompletního kontaktu v PD — ruční dealy musí do skladu; řádek v `orders` má placeholder e-mail + admin_note. */
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
          customer: customerSnapshotA,
          shipping: shippingSnapshotA,
          ...(pdInboundBaseStatusId != null ? { basecomOrderStatusId: pdInboundBaseStatusId } : {}),
        })}::jsonb
      )
    `;

    scheduleProcessExportQueueKick(req.url);

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

    logInbound('created', {
      dealId,
      orderNumber: row.order_number,
      orderId: row.id,
      missingPipedriveContact,
      missingEmailOnly,
      usedZeroValueFallback,
    });
    return jsonResponse(req, {
      success: true,
      mode: 'created',
      orderId: row.id,
      orderNumber: row.order_number,
      dealId,
      eshopOrderNumber: eshopOrderNumber || null,
      ...(missingPipedriveContact
        ? {
          warning:
            'Objednávka vytvořena bez kompletního kontaktu ve Pipedrive — Base.com export byl zařazen (doplňte zákazníka v administraci). Faktura iDoklad jen pokud je u dealu platný e-mail.',
        }
        : {}),
    }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    console.error('[pipedrive-inbound]', msg);
    return jsonResponse(req, { error: msg }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
