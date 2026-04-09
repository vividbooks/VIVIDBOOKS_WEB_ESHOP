/**
 * GET ?orderId=<uuid> — vrátí PDF vydané faktury z iDokladu (Reports API).
 * Stejná autentizace jako ostatní admin funkce (Bearer anon / service role).
 */
import postgres from 'npm:postgres';
import { idokladSdkHeaders } from '../_shared/idoklad-sdk-headers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

type IdokladTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getIdokladAccessToken(forceRefresh = false) {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }
  const clientId = Deno.env.get('IDOKLAD_CLIENT_ID');
  const clientSecret = Deno.env.get('IDOKLAD_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Missing iDoklad OAuth configuration.');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'idoklad_api',
  });
  const response = await fetch('https://identity.idoklad.cz/server/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({} as IdokladTokenResponse & { error?: string })) as IdokladTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token || !data.expires_in) {
    const hint = data.error_description || data.error || '';
    throw new Error(`iDoklad token fetch failed HTTP ${response.status}${hint ? `: ${hint}` : ''}`);
  }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Math.max(60, data.expires_in - 60) * 1000),
  };
  return data.access_token;
}

/** Filtr seznamu v iDokladu v3 je `(Vlastnost~operátor~hodnota)`, ne OData. Viz `FilterExpression.ToString()` v SDK. */
function buildIdokladListFilterDocumentNumberEq(documentNumber: string): string {
  return `(DocumentNumber~eq~${documentNumber.trim()})`;
}

function buildIdokladListFilterDocumentNumberCt(documentNumber: string): string {
  return `(DocumentNumber~ct~${documentNumber.trim()})`;
}

/** Vyhledání číselného Id faktury podle čísla dokladu (když v DB chybně není API Id). */
async function findIssuedInvoiceNumericIdByDocumentNumber(
  tokenIn: string,
  documentNumber: string,
): Promise<{ id: number; token: string } | null> {
  let token = tokenIn;
  const filters = [
    buildIdokladListFilterDocumentNumberEq(documentNumber),
    buildIdokladListFilterDocumentNumberCt(documentNumber),
  ];

  for (const filter of filters) {
    const listUrl = new URL('https://api.idoklad.cz/v3/IssuedInvoices');
    listUrl.searchParams.set('page', '1');
    listUrl.searchParams.set('pageSize', '10');
    listUrl.searchParams.set('filter', filter);

    let res = await fetch(listUrl.toString(), {
      method: 'GET',
      headers: idokladSdkHeaders(token),
    });
    if (res.status === 401) {
      token = await getIdokladAccessToken(true);
      res = await fetch(listUrl.toString(), {
        method: 'GET',
        headers: idokladSdkHeaders(token),
      });
    }
    if (!res.ok) continue;
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const data = (body.Data ?? body.data) as Record<string, unknown> | undefined;
    const items = (data?.Items ?? data?.items) as Record<string, unknown>[] | undefined;
    const first = items?.[0];
    const n = Number(first?.Id ?? first?.id);
    if (Number.isFinite(n)) {
      return { id: n, token };
    }
  }
  return null;
}

/** Ověření, že Id existuje jako vydaná faktura (GET detail). */
async function getIssuedInvoiceDetailExists(
  tokenIn: string,
  numericId: string,
): Promise<{ ok: boolean; token: string }> {
  let token = tokenIn;
  const url = `https://api.idoklad.cz/v3/IssuedInvoices/${encodeURIComponent(numericId.trim())}`;
  let res = await fetch(url, { method: 'GET', headers: idokladSdkHeaders(token) });
  if (res.status === 401) {
    token = await getIdokladAccessToken(true);
    res = await fetch(url, { method: 'GET', headers: idokladSdkHeaders(token) });
  }
  return { ok: res.ok, token };
}

/** GET PDF reportu — několik variant cesty (IssuedInvoice vs číselný typ dokumentu 0). */
async function fetchIssuedInvoicePdfFromReports(
  tokenIn: string,
  invoiceIdForUrl: string,
): Promise<{ res: Response; token: string }> {
  let token = tokenIn;
  const trimmed = invoiceIdForUrl.trim();
  const candidates: string[] = [
    `https://api.idoklad.cz/v3/Reports/IssuedInvoice/${encodeURIComponent(trimmed)}/Pdf`,
  ];
  if (/^\d+$/.test(trimmed)) {
    candidates.push(`https://api.idoklad.cz/v3/Reports/0/${trimmed}/Pdf`);
  }

  let last: Response | null = null;
  for (const pdfUrl of candidates) {
    let pdfRes = await fetch(pdfUrl, {
      method: 'GET',
      headers: idokladSdkHeaders(token),
    });
    if (pdfRes.status === 401) {
      token = await getIdokladAccessToken(true);
      pdfRes = await fetch(pdfUrl, {
        method: 'GET',
        headers: idokladSdkHeaders(token),
      });
    }
    last = pdfRes;
    if (pdfRes.ok) {
      return { res: pdfRes, token };
    }
    if (pdfRes.status !== 404) {
      return { res: pdfRes, token };
    }
  }
  return { res: last!, token };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  const url = new URL(req.url);
  const orderId = (url.searchParams.get('orderId') || '').trim();
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return jsonResponse({ error: 'Missing or invalid orderId.' }, 400);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const rows = await sql<{ idoklad_invoice_id: string | null; invoice_status: string | null; invoice_number: string | null }[]>`
      select idoklad_invoice_id, invoice_status, invoice_number
      from public.orders
      where id = ${orderId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) {
      return jsonResponse({ error: 'Order not found.' }, 404);
    }
    if (row.invoice_status !== 'done' || !row.idoklad_invoice_id?.trim()) {
      return jsonResponse({ error: 'Invoice is not available for this order.' }, 400);
    }

    const idokladNumericId = row.idoklad_invoice_id.trim();
    const safeName = (row.invoice_number || `faktura-${orderId.slice(0, 8)}`)
      .replace(/[^\w.\-áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+/g, '_')
      .slice(0, 120);

    let token = await getIdokladAccessToken();
    let { res: pdfRes, token: tokenAfterPdf } = await fetchIssuedInvoicePdfFromReports(
      token,
      idokladNumericId,
    );
    token = tokenAfterPdf;

    /** Při 404 zkusit Id z listu podle čísla faktury (filtr musí být `(DocumentNumber~eq~…)` jako v SDK). */
    let diagnosticId = idokladNumericId;
    if (pdfRes.status === 404 && row.invoice_number?.trim()) {
      const found = await findIssuedInvoiceNumericIdByDocumentNumber(token, row.invoice_number.trim());
      if (found && String(found.id) !== idokladNumericId) {
        diagnosticId = String(found.id);
        token = found.token;
        await sql`
          update public.orders
          set idoklad_invoice_id = ${diagnosticId}
          where id = ${orderId}::uuid
        `;
        const second = await fetchIssuedInvoicePdfFromReports(token, diagnosticId);
        pdfRes = second.res;
        token = second.token;
      }
    }

    if (!pdfRes.ok) {
      const errText = await pdfRes.text().catch(() => '');
      const detail = await getIssuedInvoiceDetailExists(token, diagnosticId);
      token = detail.token;
      const hint404 = pdfRes.status === 404
        ? (
          detail.ok
            ? 'Detail faktury v iDokladu existuje, ale Reports PDF vrátilo 404. Zkuste nastavit IDOKLAD_APP_NAME / IDOKLAD_APP_VERSION (stejně jako název aplikace u OAuth klienta v iDokladu).'
            : 'idoklad_invoice_id v DB neodpovídá dokladu v iDokladu (GET IssuedInvoices/{id} také selhalo). Zkontrolujte uložené Id z API po vytvoření faktury.'
        )
        : undefined;
      return jsonResponse(
        {
          error: `iDoklad PDF HTTP ${pdfRes.status}`,
          detail: errText.slice(0, 500),
          hint: hint404,
        },
        502,
      );
    }

    const buf = await pdfRes.arrayBuffer();

    /** iDoklad často vrací `application/json` s `Data` = base64 PDF (stejně jako IdokladSdk `GetAsync<string>`), ne raw stream. */
    let pdfBytes: Uint8Array;
    const head = new Uint8Array(buf.slice(0, 5));
    const isPdfMagic = head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
    if (isPdfMagic) {
      pdfBytes = new Uint8Array(buf);
    } else {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf));
      const trimmed = text.trimStart();
      if (!trimmed.startsWith('{')) {
        return jsonResponse(
          {
            error: 'Neočekávaný tvar odpovědi PDF z iDokladu (není ani raw PDF, ani JSON).',
            detail: text.slice(0, 200),
          },
          502,
        );
      }
      let parsed: { Data?: unknown; data?: unknown; IsSuccess?: boolean; isSuccess?: boolean };
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        return jsonResponse({ error: 'Odpověď z iDokladu není platné PDF ani JSON.' }, 502);
      }
      const b64 = parsed.Data ?? parsed.data;
      if (typeof b64 !== 'string' || !b64.trim()) {
        return jsonResponse(
          { error: 'JSON z iDokladu neobsahuje Data (base64 PDF).', detail: text.slice(0, 300) },
          502,
        );
      }
      try {
        const binary = atob(b64.replace(/\s/g, ''));
        pdfBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          pdfBytes[i] = binary.charCodeAt(i);
        }
      } catch {
        return jsonResponse({ error: 'Dekódování base64 PDF z iDokladu selhalo.' }, 502);
      }
    }

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[idoklad-invoice-pdf]', message);
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
});
