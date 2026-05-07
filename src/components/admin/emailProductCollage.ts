import { getProductImage, getProductUnitPriceInHaler } from '../cartUpsellUtils';
import type { ProductBundleRecord } from '../../utils/bundlePricing';
import { getMarketingSiteOrigin } from '../../config/marketingSite';

export type EmailProductCollageLayout = 'grid' | 'list' | 'compact';

/** Velikost náhledu v mailu (šířka obrázku). */
export type EmailProductCollageImageSize = 's' | 'm' | 'l';

export type EmailProductCollageDisplayOptions = {
  /** Počet sloupců u rozložení „mřížka“ i „malé náhledy“. */
  gridColumns: 2 | 3;
  imageSize: EmailProductCollageImageSize;
};

export const DEFAULT_PRODUCT_COLLAGE_DISPLAY: EmailProductCollageDisplayOptions = {
  gridColumns: 2,
  imageSize: 'm',
};

/** Snímek položky pro e-mail (odeslané HTML je soběstačné). */
export type EmailProductCollageItem = {
  k: 'p' | 'b';
  id: string;
  title: string;
  image: string;
  teaser: string;
  price: string;
  href: string;
};

export type EmailProductCollagePayloadV1 = { v: 1; layout: EmailProductCollageLayout; items: EmailProductCollageItem[] };

export type EmailProductCollagePayloadV2 = {
  v: 2;
  layout: EmailProductCollageLayout;
  items: EmailProductCollageItem[];
  gridColumns?: 2 | 3;
  imageSize?: EmailProductCollageImageSize;
};

const SITE = getMarketingSiteOrigin();

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function imageWidths(size: EmailProductCollageImageSize): { grid: number; list: number; compact: number } {
  switch (size) {
    case 's':
      return { grid: 180, list: 72, compact: 56 };
    case 'l':
      return { grid: 360, list: 130, compact: 88 };
    case 'm':
    default:
      return { grid: 280, list: 100, compact: 72 };
  }
}

export function formatPriceKc(haler: number): string {
  if (haler <= 0) return 'Cena na vyžádání';
  return `${(haler / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Kč`;
}

export function snapshotFromProduct(p: any): EmailProductCollageItem {
  const id = String(p.id || '');
  const img = getProductImage(p) || '';
  const haler = getProductUnitPriceInHaler(p);
  return {
    k: 'p',
    id,
    title: String(p.name || p.title || 'Produkt').trim(),
    image: img,
    teaser: '',
    price: formatPriceKc(haler),
    href: `${SITE}/produkt/${encodeURIComponent(id)}`,
  };
}

export function snapshotFromBundle(b: ProductBundleRecord, productsById: Map<string, any>): EmailProductCollageItem {
  const id = String(b.id);
  let image = '';
  for (const pid of b.productIds || []) {
    const p = productsById.get(String(pid));
    if (p) {
      const im = getProductImage(p);
      if (im) {
        image = im;
        break;
      }
    }
  }
  const haler = Math.max(0, Math.round(Number(b.bundlePriceHaler) || 0));
  const slug = String(b.slug || b.id || '');
  return {
    k: 'b',
    id,
    title: String(b.title || 'Balíček').trim(),
    image,
    teaser: '',
    price: formatPriceKc(haler),
    href: `${SITE}/balicek/${encodeURIComponent(slug)}`,
  };
}

function normalizeDisplay(raw: Partial<EmailProductCollageDisplayOptions> | undefined): EmailProductCollageDisplayOptions {
  const gridColumns = raw?.gridColumns === 3 ? 3 : 2;
  const imageSize =
    raw?.imageSize === 's' || raw?.imageSize === 'l' ? raw.imageSize : 'm';
  return { gridColumns, imageSize };
}

export function encodeProductCollagePayload(
  layout: EmailProductCollageLayout,
  items: EmailProductCollageItem[],
  display: EmailProductCollageDisplayOptions = DEFAULT_PRODUCT_COLLAGE_DISPLAY,
): string {
  const d = normalizeDisplay(display);
  const payload: EmailProductCollagePayloadV2 = {
    v: 2,
    layout,
    items,
    gridColumns: d.gridColumns,
    imageSize: d.imageSize,
  };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return btoa(JSON.stringify({ v: 2, layout: 'grid', items: [], ...DEFAULT_PRODUCT_COLLAGE_DISPLAY }));
  }
}

export function decodeProductCollagePayload(raw: string | null | undefined): {
  layout: EmailProductCollageLayout;
  items: EmailProductCollageItem[];
  display: EmailProductCollageDisplayOptions;
} {
  if (!raw || !raw.trim()) {
    return { layout: 'grid', items: [], display: { ...DEFAULT_PRODUCT_COLLAGE_DISPLAY } };
  }
  try {
    const json = JSON.parse(decodeURIComponent(escape(atob(raw.trim()))));
    const layout = (['grid', 'list', 'compact'].includes(json.layout) ? json.layout : 'grid') as EmailProductCollageLayout;
    const items = Array.isArray(json.items)
      ? json.items
          .filter((x: any) => x && (x.k === 'p' || x.k === 'b') && x.id && x.title)
          .map((x: any) => ({
            k: x.k === 'b' ? 'b' : 'p',
            id: String(x.id),
            title: String(x.title || ''),
            image: String(x.image || ''),
            teaser: String(x.teaser || ''),
            price: String(x.price || ''),
            href: String(x.href || ''),
          }))
      : [];
    const display = normalizeDisplay({
      gridColumns: json.gridColumns,
      imageSize: json.imageSize,
    });
    return { layout, items, display };
  } catch {
    return { layout: 'grid', items: [], display: { ...DEFAULT_PRODUCT_COLLAGE_DISPLAY } };
  }
}

type CellCtx = EmailProductCollageDisplayOptions & { w: ReturnType<typeof imageWidths> };

function linkCell(it: EmailProductCollageItem, inner: string): string {
  const href = safeAttr(it.href);
  return `<a href="${href}" style="text-decoration:none;color:#001161;">${inner}</a>`;
}

/** Mírné zaoblení obálek (e-mail klienti); menší než dřív. */
const R_GRID = 6;
const R_LIST = 4;
const R_COMPACT = 4;

function cellGrid(it: EmailProductCollageItem, ctx: CellCtx): string {
  const title = escapeHtml(it.title);
  const price = escapeHtml(it.price);
  const img = safeAttr(it.image);
  const alt = safeAttr(it.title.slice(0, 120));
  const maxW = ctx.w.grid;
  const imgHtml = it.image
    ? `<img src="${img}" alt="${alt}" width="${maxW}" style="display:block;width:100%;max-width:${maxW}px;height:auto;border-radius:${R_GRID}px;border:0;margin:0 auto;" />`
    : '';
  return linkCell(
    it,
    `${imgHtml}` +
      `<p style="margin:10px 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1.3;color:#001161;">${title}</p>` +
      `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#7C3AED;">${price}</p>`,
  );
}

function cellListRow(it: EmailProductCollageItem, ctx: CellCtx, dividerBelow: boolean): string {
  const title = escapeHtml(it.title);
  const price = escapeHtml(it.price);
  const href = safeAttr(it.href);
  const img = safeAttr(it.image);
  const alt = safeAttr(it.title.slice(0, 120));
  const thumb = ctx.w.list;
  const imgTd = it.image
    ? `<a href="${href}" style="text-decoration:none;"><img src="${img}" alt="${alt}" width="${thumb}" style="display:block;width:${thumb}px;max-width:100%;height:auto;border-radius:${R_LIST}px;border:0;" /></a>`
    : `<span style="display:block;width:${thumb}px;height:1px;"></span>`;
  const tdW = thumb + 10;
  const line = dividerBelow ? 'border-bottom:1px solid #e2e8f0;' : '';
  return (
    `<tr>` +
    `<td width="${tdW}" valign="middle" style="padding:12px 14px 12px 0;${line}">${imgTd}</td>` +
    `<td valign="middle" style="padding:12px 0;${line}font-family:Arial,Helvetica,sans-serif;">` +
    linkCell(
      it,
      `<p style="margin:0 0 6px 0;font-size:17px;font-weight:700;line-height:1.25;color:#001161;">${title}</p>` +
        `<p style="margin:0;font-size:15px;font-weight:700;color:#7C3AED;">${price}</p>`,
    ) +
    `</td></tr>`
  );
}

function cellCompact(it: EmailProductCollageItem, ctx: CellCtx, colPct: string, rowBorder = ''): string {
  const title = escapeHtml(it.title);
  const price = escapeHtml(it.price);
  const img = safeAttr(it.image);
  const alt = safeAttr(it.title.slice(0, 80));
  const thumb = ctx.w.compact;
  const imgHtml = it.image
    ? `<img src="${img}" alt="${alt}" width="${thumb}" style="display:block;width:${thumb}px;max-width:100%;height:auto;border-radius:${R_COMPACT}px;border:0;margin:0 auto 6px auto;" />`
    : '';
  return (
    `<td width="${colPct}" valign="top" style="padding:8px 6px;vertical-align:top;text-align:center;${rowBorder}">` +
    linkCell(
      it,
      `${imgHtml}` +
        `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:1.3;color:#001161;">${title}</p>` +
        `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#7C3AED;">${price}</p>`,
    ) +
    `</td>`
  );
}

export function buildProductCollageInnerHtml(
  layout: EmailProductCollageLayout,
  items: EmailProductCollageItem[],
  display: EmailProductCollageDisplayOptions = DEFAULT_PRODUCT_COLLAGE_DISPLAY,
): string {
  const d = normalizeDisplay(display);
  const ctx: CellCtx = { ...d, w: imageWidths(d.imageSize) };

  if (items.length === 0) {
    return (
      `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;text-align:center;line-height:1.5;padding:12px 8px;">` +
      `Upravte koláž v postranním panelu — náhled se promítá do mailu.` +
      `</p>`
    );
  }

  if (layout === 'list') {
    let inner = '';
    for (let i = 0; i < items.length; i++) {
      inner += cellListRow(items[i], ctx, i < items.length - 1);
    }
    return (
      `<div style="border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;overflow:hidden;">` +
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0;width:100%;">` +
      inner +
      `</table></div>`
    );
  }

  if (layout === 'compact') {
    const cols = d.gridColumns;
    const colPct = cols === 3 ? '33.33%' : '50%';
    const rowCount = Math.ceil(items.length / cols);
    let inner = '';
    for (let i = 0; i < items.length; i += cols) {
      const rowIdx = i / cols;
      const line = rowIdx < rowCount - 1 ? 'border-bottom:1px solid #e2e8f0;' : '';
      inner += '<tr>';
      for (let j = 0; j < cols; j++) {
        if (i + j < items.length) inner += cellCompact(items[i + j], ctx, colPct, line);
        else inner += `<td width="${colPct}" style="${line}"></td>`;
      }
      inner += '</tr>';
    }
    return (
      `<div style="border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;overflow:hidden;">` +
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0;width:100%;">` +
      inner +
      `</table></div>`
    );
  }

  /* grid */
  const cols = d.gridColumns;
  const colPct = cols === 3 ? '33.33%' : '50%';
  const rowCount = Math.ceil(items.length / cols);
  let inner = '';
  for (let i = 0; i < items.length; i += cols) {
    const rowIdx = i / cols;
    const line = rowIdx < rowCount - 1 ? 'border-bottom:1px solid #e2e8f0;' : '';
    inner += '<tr>';
    for (let j = 0; j < cols; j++) {
      if (i + j < items.length) {
        inner += `<td width="${colPct}" valign="top" style="padding:10px 8px;${line}">${cellGrid(items[i + j], ctx)}</td>`;
      } else {
        inner += `<td width="${colPct}" style="${line}"></td>`;
      }
    }
    inner += '</tr>';
  }
  return (
    `<div style="border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;overflow:hidden;">` +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0;width:100%;">` +
    inner +
    `</table></div>`
  );
}

export function buildProductCollageBlockHtml(
  layout: EmailProductCollageLayout,
  items: EmailProductCollageItem[],
  blockId: string,
  display: EmailProductCollageDisplayOptions = DEFAULT_PRODUCT_COLLAGE_DISPLAY,
): string {
  const d = normalizeDisplay(display);
  const encoded = encodeProductCollagePayload(layout, items, d);
  const inner = buildProductCollageInnerHtml(layout, items, d);
  const id = safeAttr(blockId);
  const encAttr = safeAttr(encoded);
  return (
    `<div data-vb-block="product-collage" data-vb-block-id="${id}" data-product-collage="true" ` +
    `data-vb-pc-layout="${layout}" data-vb-pc-encoded="${encAttr}" ` +
    `style="padding:0;background:transparent;">${inner}</div>`
  );
}

export function readProductCollageStateFromElement(el: Element | null): {
  layout: EmailProductCollageLayout;
  items: EmailProductCollageItem[];
  display: EmailProductCollageDisplayOptions;
} {
  if (!el) {
    return { layout: 'grid', items: [], display: { ...DEFAULT_PRODUCT_COLLAGE_DISPLAY } };
  }
  const raw = el.getAttribute('data-vb-pc-encoded');
  const layoutAttr = el.getAttribute('data-vb-pc-layout');
  const decoded = decodeProductCollagePayload(raw);
  if (layoutAttr && ['grid', 'list', 'compact'].includes(layoutAttr)) {
    decoded.layout = layoutAttr as EmailProductCollageLayout;
  }
  return decoded;
}
