/**
 * Čtení zásob z fulfilmentu (3PL). Fyzický sklad často není v Base.com — kusy
 * a kartony žijí jen v portálu fulfilmentu, takže e-shop bez tohoto zdroje
 * ukazuje „Čeká na naskladnění“ i u naskladněného titulu.
 *
 * Adaptér je záměrně nezávislý na dodavateli: bere feed nebo REST endpoint
 * (JSON / XML / CSV) a názvy polí lze přepsat proměnnými prostředí.
 */

import { isPlaceholderStockSku, parsePackSku } from './stock-quantity.ts';

export type FulfilmentStockRow = {
  sku: string;
  quantity: number;
  unitsPerPack: number | null;
};

export type FulfilmentStockConfig = {
  url: string;
  token?: string | null;
  tokenHeader?: string | null;
  skuFields?: string[];
  quantityFields?: string[];
  unitsPerPackFields?: string[];
  warehouseKey?: string;
};

const DEFAULT_SKU_FIELDS = [
  'sku',
  'code',
  'codes',
  'product_code',
  'productcode',
  'kod',
  'kód',
  'katalogove_cislo',
  'variant_code',
  'variantcode',
  'ean',
];

const DEFAULT_QUANTITY_FIELDS = [
  'quantity',
  'available',
  'available_quantity',
  'stock',
  'qty',
  'amount',
  'mnozstvi',
  'množství',
  'na_sklade',
  'na_skladě',
];

const DEFAULT_UNITS_PER_PACK_FIELDS = [
  'units_per_pack',
  'unitsperpack',
  'pack_size',
  'packsize',
  'mastercase',
  'mastercases',
  'ks_v_baleni',
  'ks_v_balení',
];

export const DEFAULT_FULFILMENT_WAREHOUSE_KEY = 'fulfillment_ff';

function normalizeFieldName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function pickField(record: Record<string, unknown>, candidates: string[]) {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    normalized.set(normalizeFieldName(key), value);
  }
  for (const candidate of candidates) {
    const value = normalized.get(normalizeFieldName(candidate));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

/**
 * Portály fulfilmentu často zobrazují „dostupné/celkem“ (např. `37/37`)
 * nebo číslo s mezerami jako oddělovačem tisíců.
 */
export function parseStockQuantityValue(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const available = trimmed.split('/')[0].trim();
  const cleaned = available.replace(/\s|\u00a0/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `karton (10ks)` / `10 ks` / `mastercase 10` → 10 */
export function parseUnitsPerPackValue(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 1 ? Math.trunc(raw) : null;
  if (typeof raw !== 'string') return null;

  const match = raw.match(/(\d+)\s*(?:ks|pcs|x)?/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

/** Jeden řádek může nést víc kódů (`DS36066094, ZK1000`) — vrátíme všechny. */
function splitCodes(raw: unknown): string[] {
  return String(raw ?? '')
    .split(/[,;|]+|\s{2,}/)
    .map((value) => value.trim())
    .filter((value) => value && !isPlaceholderStockSku(value));
}

function detectFormat(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';
  return 'csv';
}

function extractJsonRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
  }
  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  for (const key of ['products', 'items', 'data', 'rows', 'stock', 'stocks', 'result']) {
    const nested = record[key];
    if (nested === undefined) continue;
    const rows = extractJsonRecords(nested);
    if (rows.length) return rows;
  }

  // Mapa klíčovaná SKU: `{ "ZK1000": { quantity: 37 }, … }`
  const entries = Object.entries(record);
  const mapped = entries
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    .map(([key, value]) => ({ sku: key, ...(value as Record<string, unknown>) }));
  if (mapped.length) return mapped;

  const numeric = entries.filter(([, value]) => typeof value === 'number' || typeof value === 'string');
  if (numeric.length) {
    return numeric.map(([key, value]) => ({ sku: key, quantity: value }));
  }

  return [];
}

function decodeXmlValue(value: string) {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function extractXmlRecords(text: string): Record<string, unknown>[] {
  const blockRegex = /<(SHOPITEM|item|product|variant|row|stock|record)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const rows: Record<string, unknown>[] = [];
  let blockMatch: RegExpExecArray | null = null;

  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const block = blockMatch[2];
    const row: Record<string, unknown> = {};
    const fieldRegex = /<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
    let fieldMatch: RegExpExecArray | null = null;

    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const [, name, value] = fieldMatch;
      if (value.includes(`<${name}`)) continue;
      if (row[name] === undefined) row[name] = decodeXmlValue(value);
    }

    if (Object.keys(row).length) rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function extractCsvRecords(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0];
  const delimiter = header.includes(';') && !header.includes(',') ? ';' : ',';
  const columns = parseCsvLine(header, delimiter);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      row[column || `column_${index + 1}`] = values[index] ?? '';
    });
    return row;
  });
}

/**
 * Rozparsuje odpověď fulfilmentu na skladové řádky. Kartonová SKU se normalizují
 * na tvar `SKU-C{n}`, aby je přepočet balíků (`computeEffectiveStockQuantity`)
 * převedl na kusy.
 */
export function parseFulfilmentStock(
  raw: string,
  config: Pick<FulfilmentStockConfig, 'skuFields' | 'quantityFields' | 'unitsPerPackFields'> = {},
): FulfilmentStockRow[] {
  const text = String(raw || '');
  if (!text.trim()) return [];

  const format = detectFormat(text);
  let records: Record<string, unknown>[] = [];

  if (format === 'json') {
    try {
      records = extractJsonRecords(JSON.parse(text));
    } catch {
      return [];
    }
  } else if (format === 'xml') {
    records = extractXmlRecords(text);
  } else {
    records = extractCsvRecords(text);
  }

  const skuFields = config.skuFields?.length ? config.skuFields : DEFAULT_SKU_FIELDS;
  const quantityFields = config.quantityFields?.length ? config.quantityFields : DEFAULT_QUANTITY_FIELDS;
  const unitsPerPackFields = config.unitsPerPackFields?.length
    ? config.unitsPerPackFields
    : DEFAULT_UNITS_PER_PACK_FIELDS;

  const rows: FulfilmentStockRow[] = [];

  for (const record of records) {
    const quantity = parseStockQuantityValue(pickField(record, quantityFields));
    if (quantity === null) continue;

    const codes = skuFields.flatMap((field) => splitCodes(pickField(record, [field])));
    if (!codes.length) continue;

    const unitsPerPack = parseUnitsPerPackValue(pickField(record, unitsPerPackFields));

    for (const code of [...new Set(codes)]) {
      const pack = parsePackSku(code);
      const sku = !pack && unitsPerPack ? `${code}-C${unitsPerPack}` : code;
      rows.push({
        sku,
        quantity,
        unitsPerPack: pack?.unitsPerPack ?? unitsPerPack ?? null,
      });
    }
  }

  return rows;
}

export function readFulfilmentStockConfig(
  getEnv: (name: string) => string | undefined,
): FulfilmentStockConfig | null {
  const url = (getEnv('FULFILMENT_STOCK_URL') || '').trim();
  if (!url) return null;

  const splitList = (value: string | undefined) => (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    url,
    token: (getEnv('FULFILMENT_STOCK_TOKEN') || '').trim() || null,
    tokenHeader: (getEnv('FULFILMENT_STOCK_TOKEN_HEADER') || '').trim() || null,
    skuFields: splitList(getEnv('FULFILMENT_STOCK_SKU_FIELDS')),
    quantityFields: splitList(getEnv('FULFILMENT_STOCK_QUANTITY_FIELDS')),
    unitsPerPackFields: splitList(getEnv('FULFILMENT_STOCK_PACK_FIELDS')),
    warehouseKey: (getEnv('FULFILMENT_STOCK_WAREHOUSE_KEY') || '').trim() || DEFAULT_FULFILMENT_WAREHOUSE_KEY,
  };
}

export function buildFulfilmentRequestHeaders(config: FulfilmentStockConfig): Record<string, string> {
  const token = String(config.token || '').trim();
  if (!token) return { Accept: 'application/json, text/xml, text/csv, */*' };

  const header = String(config.tokenHeader || '').trim();
  if (header && header.toLowerCase() !== 'authorization') {
    return { Accept: 'application/json, text/xml, text/csv, */*', [header]: token };
  }

  return {
    Accept: 'application/json, text/xml, text/csv, */*',
    Authorization: token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`,
  };
}

export async function fetchFulfilmentStock(
  config: FulfilmentStockConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: FulfilmentStockRow[]; warehouseKey: string; error: string | null }> {
  const warehouseKey = config.warehouseKey || DEFAULT_FULFILMENT_WAREHOUSE_KEY;

  try {
    const response = await fetchImpl(config.url, { headers: buildFulfilmentRequestHeaders(config) });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    return { rows: parseFulfilmentStock(text, config), warehouseKey, error: null };
  } catch (error) {
    return {
      rows: [],
      warehouseKey,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
