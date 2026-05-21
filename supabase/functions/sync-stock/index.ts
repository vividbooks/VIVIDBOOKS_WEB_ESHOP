import { resolveAllowedOrigin } from '../_shared/cors.ts';
const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
});

const BASECOM_API_URL = 'https://api.baselinker.com/connector.php';

type JsonRecord = Record<string, unknown>;

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
    },
  });
}

function getDatabaseUrl() {
  return (Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '').trim();
}

function isDebugEnabled(url: URL, body: unknown) {
  const queryValue = (url.searchParams.get('debug') || '').toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(queryValue)) return true;
  if (body && typeof body === 'object' && 'debug' in body) {
    return Boolean((body as { debug?: unknown }).debug);
  }
  return false;
}

function sampleArray<T>(items: T[], count: number) {
  return items.slice(0, count);
}

function toSafeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function detectFeedFormat(text: string, contentType: string | null) {
  const trimmed = text.trim();
  const type = (contentType || '').toLowerCase();

  if (type.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (type.includes('xml') || trimmed.startsWith('<?xml') || trimmed.startsWith('<')) return 'xml';
  if (type.includes('csv')) return 'csv';

  const firstLine = trimmed.split(/\r?\n/, 1)[0] || '';
  if (/[;,]/.test(firstLine)) return 'csv';

  return 'unknown';
}

function parseDelimitedLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { totalItems: 0, sampleItems: [] as JsonRecord[] };
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const parseLine = (line: string) => parseDelimitedLine(line, delimiter);

  const headers = parseLine(headerLine);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: JsonRecord = {};
    headers.forEach((header, index) => {
      row[header || `column_${index + 1}`] = values[index] ?? '';
    });
    return row;
  });

  return {
    totalItems: rows.length,
    sampleItems: sampleArray(rows, 5),
  };
}

function extractJsonItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  for (const key of ['items', 'products', 'data', 'inventory', 'rows']) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }

  const arrayEntry = Object.values(record).find((value) => Array.isArray(value));
  return Array.isArray(arrayEntry) ? arrayEntry : [record];
}

function decodeXmlValue(value: string) {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseXml(text: string) {
  const itemTagMatch = text.match(/<([A-Z0-9_:-]+)>(?:\s|\r|\n)*<([A-Z0-9_:-]+)>/i);
  const itemTag = itemTagMatch?.[2];

  if (!itemTag) {
    throw new Error('Could not detect repeated XML item tag.');
  }

  const itemRegex = new RegExp(`<${itemTag}\\b[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, 'gi');
  const rows: JsonRecord[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = itemRegex.exec(text)) !== null) {
    const block = match[1];
    const row: JsonRecord = {};
    const fieldRegex = /<([A-Z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
    let fieldMatch: RegExpExecArray | null = null;

    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldValue = fieldMatch[2];
      if (fieldValue.includes(`<${fieldName}`)) continue;

      if (row[fieldName] === undefined) {
        row[fieldName] = decodeXmlValue(fieldValue);
      } else if (Array.isArray(row[fieldName])) {
        (row[fieldName] as unknown[]).push(decodeXmlValue(fieldValue));
      } else {
        row[fieldName] = [row[fieldName], decodeXmlValue(fieldValue)];
      }
    }

    rows.push(Object.keys(row).length > 0 ? row : { raw: block.trim().slice(0, 2000) });
  }

  return {
    totalItems: rows.length,
    sampleItems: sampleArray(rows, 5),
  };
}

async function inspectFeed(feedUrl: string | null) {
  if (!feedUrl) {
    return {
      format: 'unknown',
      totalItems: 0,
      sampleItems: [] as unknown[],
      rawPreview: '',
      error: 'Missing BASECOM_INVENTORY_FEED_URL.',
      ok: false,
    };
  }

  const response = await fetch(feedUrl);
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Feed HTTP ${response.status}: ${rawText.slice(0, 300)}`);
  }

  const format = detectFeedFormat(rawText, response.headers.get('content-type'));
  let totalItems = 0;
  let sampleItems: unknown[] = [];

  try {
    if (format === 'json') {
      const parsed = JSON.parse(rawText);
      const items = extractJsonItems(parsed);
      totalItems = items.length;
      sampleItems = sampleArray(items, 5);
    } else if (format === 'xml') {
      const parsed = parseXml(rawText);
      totalItems = parsed.totalItems;
      sampleItems = parsed.sampleItems;
    } else if (format === 'csv') {
      const parsed = parseCsv(rawText);
      totalItems = parsed.totalItems;
      sampleItems = parsed.sampleItems;
    } else {
      sampleItems = [{ raw: rawText.slice(0, 2000) }];
    }
  } catch (parseError) {
    sampleItems = [{ raw: rawText.slice(0, 2000), parseError: toSafeErrorMessage(parseError) }];
  }

  return {
    format,
    totalItems,
    sampleItems,
    rawPreview: rawText.slice(0, 2000),
    contentType: response.headers.get('content-type') || '',
    ok: true,
  };
}

async function callBasecomApi<T = Record<string, unknown>>(apiToken: string, method: string, parameters: Record<string, unknown>) {
  const body = new URLSearchParams({
    method,
    parameters: JSON.stringify(parameters),
  });

  const response = await fetch(BASECOM_API_URL, {
    method: 'POST',
    headers: {
      'X-BLToken': apiToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  let parsed: Record<string, unknown> = {};

  try {
    parsed = rawText ? JSON.parse(rawText) as Record<string, unknown> : {};
  } catch {
    parsed = { raw: rawText };
  }

  if (!response.ok) {
    throw new Error(`Base.com HTTP ${response.status}: ${rawText.slice(0, 300)}`);
  }

  if (parsed.status !== 'SUCCESS') {
    const message = typeof parsed.error_message === 'string'
      ? parsed.error_message
      : JSON.stringify(parsed);
    throw new Error(`Base.com ${method} failed: ${message}`);
  }

  return parsed as T;
}

function normalizeInventories(data: Record<string, unknown>) {
  const inventories = data.inventories;
  if (Array.isArray(inventories)) return inventories;
  if (inventories && typeof inventories === 'object') {
    return Object.entries(inventories as Record<string, unknown>).map(([key, value]) => {
      if (value && typeof value === 'object') {
        return {
          inventory_id: (value as Record<string, unknown>).inventory_id ?? (value as Record<string, unknown>).id ?? key,
          ...(value as Record<string, unknown>),
        };
      }

      return {
        inventory_id: key,
        name: value,
      };
    });
  }
  return [];
}

function pickFirstInventoryId(inventories: unknown[]) {
  for (const inventory of inventories) {
    if (inventory && typeof inventory === 'object') {
      const value = (inventory as Record<string, unknown>).inventory_id
        ?? (inventory as Record<string, unknown>).id;
      if (value !== undefined && value !== null && String(value).length > 0) {
        return String(value);
      }
    }
  }
  return null;
}

function normalizeStockItems(data: Record<string, unknown>) {
  const products = data.products;
  if (Array.isArray(products)) return products;
  if (products && typeof products === 'object') {
    return Object.entries(products as Record<string, unknown>).map(([key, value]) => {
      if (value && typeof value === 'object') {
        return { productKey: key, ...(value as Record<string, unknown>) };
      }
      return { productKey: key, value };
    });
  }
  return [];
}

function sampleStock(items: unknown[]) {
  return sampleArray(items, 10).map((item) => {
    if (!item || typeof item !== 'object') return item;
    const record = item as Record<string, unknown>;
    return {
      sku: record.sku ?? record.product_id ?? record.productKey ?? null,
      quantity: record.quantity ?? record.stock ?? record.available ?? null,
      raw: record,
    };
  });
}

function normalizeExternalStorages(data: Record<string, unknown>) {
  const storages = data.storages;
  if (Array.isArray(storages)) return storages;
  if (storages && typeof storages === 'object') return Object.values(storages as Record<string, unknown>);
  return [];
}

function pickFirstStorageId(storages: unknown[]) {
  for (const storage of storages) {
    if (storage && typeof storage === 'object') {
      const value = (storage as Record<string, unknown>).storage_id ?? (storage as Record<string, unknown>).id;
      if (value !== undefined && value !== null && String(value).length > 0) {
        return String(value);
      }
    }
  }
  return null;
}

async function inspectInventoryStock(apiToken: string, inventoryId: string) {
  const stockResponse = await callBasecomApi<Record<string, unknown>>(
    apiToken,
    'getInventoryProductsStock',
    { inventory_id: Number.isNaN(Number(inventoryId)) ? inventoryId : Number(inventoryId) },
  );
  const stockItems = normalizeStockItems(stockResponse);
  return {
    inventoryId,
    sampleProducts: sampleStock(stockItems),
    totalProducts: stockItems.length,
  };
}

async function inspectExternalStorageStock(apiToken: string, storageId: string) {
  const quantityResponse = await callBasecomApi<Record<string, unknown>>(
    apiToken,
    'getExternalStorageProductsQuantity',
    { storage_id: storageId },
  );
  const products = normalizeStockItems(quantityResponse);
  return {
    storageId,
    sampleProducts: sampleStock(products),
    totalProducts: products.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  }

  const url = new URL(req.url);
  let body: unknown = null;

  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        body = await req.json();
      } catch {
        return jsonResponse(req, { error: 'Invalid JSON body.' }, 400);
      }
    }
  }

  const debug = isDebugEnabled(url, body);
  if (!debug) {
    return jsonResponse(req, { status: 'sync not implemented yet, use ?debug=true' });
  }

  const databaseUrl = getDatabaseUrl();
  const feedUrl = (Deno.env.get('BASECOM_INVENTORY_FEED_URL') || '').trim();
  const apiToken = (Deno.env.get('BASECOM_API_TOKEN') || '').trim();

  const result = {
    feed: {
      format: 'unknown',
      totalItems: 0,
      sampleItems: [] as unknown[],
      error: null as string | null,
    },
    inventories: [] as unknown[],
    externalStorages: [] as unknown[],
    inventoryStocks: [] as unknown[],
    stockFromInventory96309: {
      sampleProducts: [] as unknown[],
      totalProducts: 0,
      error: null as string | null,
    },
    stockFromExternalStorage: {
      storageId: null as string | null,
      sampleProducts: [] as unknown[],
      totalProducts: 0,
      error: null as string | null,
    },
    apiTokenWorks: false,
    feedUrlWorks: false,
    dbPoolerConfigured: Boolean(databaseUrl),
    apiError: null as string | null,
  };

  try {
    const feed = await inspectFeed(feedUrl);
    result.feed = {
      format: feed.format,
      totalItems: feed.totalItems,
      sampleItems: feed.sampleItems,
      error: null,
    };
    result.feedUrlWorks = feed.ok;
  } catch (error) {
    result.feed.error = toSafeErrorMessage(error);
    result.feedUrlWorks = false;
  }

  try {
    if (!apiToken) {
      throw new Error('Missing BASECOM_API_TOKEN.');
    }

    const [inventoriesResponse, storagesResponse] = await Promise.all([
      callBasecomApi<Record<string, unknown>>(apiToken, 'getInventories', {}),
      callBasecomApi<Record<string, unknown>>(apiToken, 'getExternalStoragesList', {}),
    ]);
    const inventories = normalizeInventories(inventoriesResponse);
    const externalStorages = normalizeExternalStorages(storagesResponse);
    result.inventories = inventories;
    result.externalStorages = externalStorages;

    const inventoryIds = inventories
      .map((inventory) => inventory && typeof inventory === 'object'
        ? String((inventory as Record<string, unknown>).inventory_id ?? (inventory as Record<string, unknown>).id ?? '')
        : '')
      .filter(Boolean);

    const inventoryResults = await Promise.all(inventoryIds.map(async (inventoryId) => {
      try {
        return await inspectInventoryStock(apiToken, inventoryId);
      } catch (error) {
        return {
          inventoryId,
          sampleProducts: [] as unknown[],
          totalProducts: 0,
          error: toSafeErrorMessage(error),
        };
      }
    }));
    result.inventoryStocks = inventoryResults;

    const inv96309 = inventoryResults.find((entry: any) => entry.inventoryId === '96309');
    if (inv96309) {
      result.stockFromInventory96309 = {
        sampleProducts: inv96309.sampleProducts || [],
        totalProducts: inv96309.totalProducts || 0,
        error: inv96309.error || null,
      };
    } else {
      result.stockFromInventory96309.error = 'Inventory 96309 nebyl nalezen.';
    }

    const storageId = pickFirstStorageId(externalStorages);
    result.stockFromExternalStorage.storageId = storageId;
    if (storageId) {
      try {
        const externalResult = await inspectExternalStorageStock(apiToken, storageId);
        result.stockFromExternalStorage = {
          storageId: externalResult.storageId,
          sampleProducts: externalResult.sampleProducts,
          totalProducts: externalResult.totalProducts,
          error: null,
        };
      } catch (error) {
        result.stockFromExternalStorage.error = toSafeErrorMessage(error);
      }
    } else {
      result.stockFromExternalStorage.error = 'Nebyl nalezen žádný external storage.';
    }

    result.apiTokenWorks = true;
  } catch (error) {
    result.apiError = toSafeErrorMessage(error);
    result.apiTokenWorks = false;
  }

  return jsonResponse(req, result);
});
