/**
 * Klient pro Fulfillment.cz — https://client.api.fulfillment.cz/
 *
 * `GET /v2/fulfillment/warehouse-variants` vrací u každé varianty kusový stav
 * a zvlášť kusy přijaté v kartonech / na paletách (`mastercase_*`).
 *
 * Kódy: `code` je SKU fulfilmentu (`DS36066094`), `ext_code` je náš kód
 * (`ZK1000`). Registrujeme oba, aby párování fungovalo z obou stran.
 */

import { isPlaceholderStockSku, normalizeStockSku, parsePackSku } from './stock-quantity.ts';
import type { FulfilmentStockRow } from './fulfilment-stock.ts';
import { DEFAULT_FULFILMENT_WAREHOUSE_KEY, readEnvWithAliases } from './fulfilment-stock.ts';

export const FULFILMENT_CZ_DEFAULT_URL = 'https://client.api.fulfillment.cz/v2/fulfillment/warehouse-variants';

/** API dovoluje limit až 1000 záznamů na stránku. */
const PAGE_LIMIT = 1000;
const MAX_PAGES = 20;

export type FulfilmentCzConfig = {
  token: string;
  url?: string | null;
  warehouseKey?: string | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Dostupné kusy varianty. `available_quantity` už má odečtené rezervace
 * a žádosti (dle dokumentace může být i záporné); když ho API nepošle,
 * spočítáme ho z hrubého stavu.
 */
function resolveAvailableUnits(
  record: Record<string, unknown>,
  keys: { available: string; total: string; reserved: string; requested: string },
): number {
  const available = toFiniteNumber(record[keys.available]);
  if (available !== null) return available;

  const total = toFiniteNumber(record[keys.total]);
  if (total === null) return 0;

  const reserved = toFiniteNumber(record[keys.reserved]) ?? 0;
  const requested = toFiniteNumber(record[keys.requested]) ?? 0;
  return total - reserved - requested;
}

function extractDataRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
  }
  if (!payload || typeof payload !== 'object') return [];

  const data = (payload as Record<string, unknown>).data;
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
  }
  return [];
}

/**
 * Přeloží odpověď `warehouse-variants` na skladové řádky e-shopu.
 *
 * Kusový stav a kusy v kartonech se sčítají — `mastercase_*` podle dokumentace
 * kusové SKU nezahrnuje, takže se nic nepočítá dvakrát. U kartonové varianty
 * (`…-C10`) zůstává hodnota v kartonech a na kusy ji přepočítá
 * `computeEffectiveStockQuantity`.
 */
export function parseFulfilmentCzWarehouseVariants(payload: unknown): {
  rows: FulfilmentStockRow[];
  totalCount: number | null;
  error: string | null;
} {
  const envelope = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const code = toFiniteNumber(envelope.code);
  if (code !== null && code !== 200) {
    const message = typeof envelope.message === 'string' && envelope.message
      ? envelope.message
      : `API vrátilo kód ${code}.`;
    return { rows: [], totalCount: null, error: message };
  }

  const rows: FulfilmentStockRow[] = [];

  for (const record of extractDataRows(payload)) {
    const looseUnits = resolveAvailableUnits(record, {
      available: 'available_quantity',
      total: 'quantity',
      reserved: 'reserved_quantity',
      requested: 'requested_quantity',
    });
    const mastercaseUnits = resolveAvailableUnits(record, {
      available: 'mastercase_available_quantity',
      total: 'mastercase_quantity',
      reserved: 'mastercase_reserved_quantity',
      requested: 'mastercase_requested_quantity',
    });

    const quantity = looseUnits + mastercaseUnits;

    const codes = [record.ext_code, record.code]
      .map((value) => String(value ?? '').trim())
      .filter((value) => value && !isPlaceholderStockSku(value));

    for (const sku of [...new Set(codes)]) {
      rows.push({
        sku,
        quantity,
        unitsPerPack: parsePackSku(sku)?.unitsPerPack ?? null,
      });
    }
  }

  return {
    rows: dropDoubleCountedPackRows(rows),
    totalCount: toFiniteNumber(envelope.totalCount),
    error: null,
  };
}

/**
 * Kartonová varianta (`ZK1000-C10`) je stejná zásoba jako `mastercase_*` u kusové
 * varianty, jen vyjádřená v kartonech. Kusová varianta ji už obsahuje v kusech,
 * takže kartonový řádek zahodíme — jinak by se stav počítal dvakrát.
 *
 * Když kartonové SKU přijde samo (bez kusové varianty), necháme ho a na kusy
 * ho přepočítá `computeEffectiveStockQuantity`.
 */
function dropDoubleCountedPackRows(rows: FulfilmentStockRow[]): FulfilmentStockRow[] {
  const looseSkus = new Set(
    rows.filter((row) => !parsePackSku(row.sku)).map((row) => normalizeStockSku(row.sku)),
  );

  return rows.filter((row) => {
    const pack = parsePackSku(row.sku);
    if (!pack) return true;
    return !looseSkus.has(normalizeStockSku(pack.baseSku));
  });
}

/** Token se hledá i pod dalšími rozumnými názvy, ne jen pod jedním přesným. */
const TOKEN_ENV_NAMES = [
  'FULFILLMENT_CZ_API_TOKEN',
  'FULFILLMENT_CZ_TOKEN',
  'FULFILLMENT_CZ_API_KEY',
  'FULFILLMENT_API_TOKEN',
];

/** Secret uložený pod jiným názvem než čekáme (`…_API_TOKEN`, `…_KEY`, …). */
function findTokenByScan(listEnvNames?: () => string[]): string | null {
  if (!listEnvNames) return null;
  try {
    const match = listEnvNames().find((name) => {
      const upper = name.toUpperCase();
      if (!/^FULF[A-Z]*MENT/.test(upper)) return false;
      if (upper.includes('URL') || upper.includes('STOCK')) return false;
      return upper.endsWith('TOKEN') || upper.endsWith('KEY');
    });
    return match || null;
  } catch {
    return null;
  }
}

export function readFulfilmentCzConfig(
  getEnv: (name: string) => string | undefined,
  listEnvNames?: () => string[],
): FulfilmentCzConfig | null {
  let token = '';
  for (const name of TOKEN_ENV_NAMES) {
    token = readEnvWithAliases(getEnv, name);
    if (token) break;
  }

  /**
   * `FULFILMENT_STOCK_TOKEN` bez `FULFILMENT_STOCK_URL` obecný adaptér nezapne,
   * takže jde o token pro Fulfillment.cz — ten svou URL zná.
   */
  if (!token && !readEnvWithAliases(getEnv, 'FULFILMENT_STOCK_URL')) {
    token = readEnvWithAliases(getEnv, 'FULFILMENT_STOCK_TOKEN');
  }

  if (!token) {
    const scanned = findTokenByScan(listEnvNames);
    if (scanned) token = (getEnv(scanned) || '').trim();
  }

  if (!token) return null;

  return {
    token,
    url: readEnvWithAliases(getEnv, 'FULFILLMENT_CZ_API_URL') || FULFILMENT_CZ_DEFAULT_URL,
    warehouseKey: readEnvWithAliases(getEnv, 'FULFILMENT_STOCK_WAREHOUSE_KEY') || DEFAULT_FULFILMENT_WAREHOUSE_KEY,
  };
}

/** Fulfillment.cz čeká token přímo v `Authorization`, bez schématu `Bearer`. */
export function buildFulfilmentCzHeaders(config: FulfilmentCzConfig): Record<string, string> {
  return {
    Authorization: config.token,
    Accept: 'application/json',
  };
}

export function buildFulfilmentCzPageUrl(config: FulfilmentCzConfig, offset: number, limit = PAGE_LIMIT) {
  const url = new URL(config.url || FULFILMENT_CZ_DEFAULT_URL);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return url.toString();
}

export async function fetchFulfilmentCzStock(
  config: FulfilmentCzConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: FulfilmentStockRow[]; warehouseKey: string; error: string | null }> {
  const warehouseKey = config.warehouseKey || DEFAULT_FULFILMENT_WAREHOUSE_KEY;
  const rows: FulfilmentStockRow[] = [];
  let offset = 0;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await fetchImpl(buildFulfilmentCzPageUrl(config, offset), {
        headers: buildFulfilmentCzHeaders(config),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Odpověď není JSON: ${text.slice(0, 200)}`);
      }

      const parsed = parseFulfilmentCzWarehouseVariants(payload);
      if (parsed.error) throw new Error(parsed.error);

      const pageRowCount = extractDataRows(payload).length;
      rows.push(...parsed.rows);
      offset += pageRowCount;

      if (!pageRowCount || pageRowCount < PAGE_LIMIT) break;
      if (parsed.totalCount !== null && offset >= parsed.totalCount) break;
    }

    return { rows, warehouseKey, error: null };
  } catch (error) {
    return {
      rows,
      warehouseKey,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
