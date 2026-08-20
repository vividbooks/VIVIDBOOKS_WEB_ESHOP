/**
 * Mapování školní poptávky (POST /orders, school_inquiry) na řádky dealu v Pipedrive.
 * Stejný tvar jako e-shop `order_items`: product_id, quantity, unit_price (haléře).
 *
 * Řádky `bundle:` se rozbalí z `workbooks.bundles[].lines` (na rozdíl od e-shopu,
 * kde se balíčky zatím přeskakují — u školní objednávky jsou běžné).
 */

import { getProductUnitPriceInHaler, parsePriceTextToKc } from './product-price.ts';

export type SchoolPipedriveOrderLineItem = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

type CatalogLookup = Map<string, unknown> | Record<string, unknown>;

function catalogGet(catalog: CatalogLookup, id: string): unknown {
  if (catalog instanceof Map) return catalog.get(id);
  return catalog[id];
}

function positiveInt(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** `2× Fyzika PS` / `2x Fyzika` → 2; jinak 1 (případně explicitní `quantity`). */
export function parseSchoolBundleLineQuantity(line: { name?: unknown; quantity?: unknown }): number {
  const explicit = positiveInt(line.quantity);
  if (explicit > 0) return explicit;
  const name = String(line.name ?? '').trim();
  const match = name.match(/^(\d+)\s*[×xX]\s+/);
  if (match) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return 1;
}

function unitPriceHalerFromItemOrCatalog(itemPrice: unknown, catalogItem: unknown): number {
  const fromItem = parsePriceTextToKc(itemPrice);
  if (fromItem !== null) return Math.round(fromItem * 100);
  return getProductUnitPriceInHaler(catalogItem);
}

function workbooksFromBody(body: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const wb = body?.workbooks;
  if (wb && typeof wb === 'object' && !Array.isArray(wb)) {
    return wb as Record<string, unknown>;
  }
  return null;
}

function inquiryItems(body: Record<string, unknown> | null | undefined): unknown[] {
  const wb = workbooksFromBody(body);
  if (Array.isArray(wb?.items) && wb.items.length) return wb.items;
  if (Array.isArray(body?.items) && body.items.length) return body.items;
  return [];
}

function inquiryBundles(body: Record<string, unknown> | null | undefined): Array<Record<string, unknown>> {
  const wb = workbooksFromBody(body);
  const raw = wb?.bundles;
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && !Array.isArray(b));
}

function findBundleForItem(
  item: Record<string, unknown>,
  bundleId: string,
  bundles: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  const fromItem = String(item.bundleId ?? '').trim();
  const wanted = fromItem || bundleId;
  if (!wanted) return null;
  return bundles.find((b) => String(b.bundleId ?? b.id ?? '').trim() === wanted) ?? null;
}

function pushLine(
  out: SchoolPipedriveOrderLineItem[],
  productId: string,
  quantity: number,
  unitPrice: number,
) {
  if (!productId || productId.startsWith('bundle:') || productId.startsWith('subject:')) return;
  if (quantity <= 0) return;
  out.push({
    product_id: productId,
    quantity,
    unit_price: Math.max(0, Math.round(unitPrice)),
  });
}

function expandBundleLines(
  out: SchoolPipedriveOrderLineItem[],
  bundle: Record<string, unknown> | null,
  setQuantity: number,
  catalog: CatalogLookup,
) {
  if (!bundle || setQuantity <= 0) return;
  const lines = Array.isArray(bundle.lines) ? bundle.lines : [];
  for (const raw of lines) {
    const line = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const productId = String(line.id ?? line.productId ?? line.product_id ?? '').trim();
    const innerQty = parseSchoolBundleLineQuantity(line);
    const catalogItem = catalogGet(catalog, productId);
    const unitPrice = unitPriceHalerFromItemOrCatalog(line.price, catalogItem);
    pushLine(out, productId, setQuantity * innerQty, unitPrice);
  }
}

/**
 * Sestaví Pipedrive řádky z těla školní objednávky.
 * Digitál / Vividboard se sem nedávají — zůstávají v poznámce dealu.
 */
export function mapSchoolInquiryToPipedriveOrderItems(
  body: Record<string, unknown> | null | undefined,
  catalog: CatalogLookup,
): SchoolPipedriveOrderLineItem[] {
  const out: SchoolPipedriveOrderLineItem[] = [];
  const bundles = inquiryBundles(body);

  for (const raw of inquiryItems(body)) {
    const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const qty = positiveInt(item.quantity ?? item.qty);
    if (qty <= 0) continue;

    const rawId = String(item.id ?? item.productId ?? item.product_id ?? '').trim();
    if (!rawId) continue;

    if (rawId.startsWith('bundle:')) {
      const bundleId = rawId.slice('bundle:'.length);
      const bundle = findBundleForItem(item, bundleId, bundles);
      expandBundleLines(out, bundle, qty, catalog);
      continue;
    }

    const catalogItem = catalogGet(catalog, rawId);
    const unitPrice = unitPriceHalerFromItemOrCatalog(item.price, catalogItem);
    pushLine(out, rawId, qty, unitPrice);
  }

  return out;
}

export function schoolInquiryShippingMethod(body: Record<string, unknown> | null | undefined): string {
  const shipping = body?.shipping;
  if (!shipping || typeof shipping !== 'object' || Array.isArray(shipping)) return '';
  return String((shipping as Record<string, unknown>).method ?? '').trim();
}

export function schoolInquiryShippingPriceHaler(body: Record<string, unknown> | null | undefined): number {
  const shipping = body?.shipping;
  if (!shipping || typeof shipping !== 'object' || Array.isArray(shipping)) return 0;
  return Math.max(0, Math.round(Number((shipping as Record<string, unknown>).price) || 0));
}

export function schoolInquiryPickupPointName(body: Record<string, unknown> | null | undefined): string | null {
  const shipping = body?.shipping;
  if (!shipping || typeof shipping !== 'object' || Array.isArray(shipping)) return null;
  const name = String((shipping as Record<string, unknown>).pickupPointName ?? '').trim();
  return name || null;
}
