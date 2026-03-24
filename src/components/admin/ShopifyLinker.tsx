import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ShoppingCart, CheckCircle2, XCircle, Search, RefreshCw,
  ExternalLink, Save, ChevronDown, AlertCircle, Loader2, Link2,
  Download, FileSpreadsheet, ChevronUp, Wand2, Upload,
  Zap, FileUp, Table2
} from 'lucide-react';
import { fetchProducts, updateProduct } from '../../utils/adminApi';
import { shopifyFetch } from '../../utils/shopify/client';
import { isShopifyConfigured } from '../../utils/shopify/config';

// ── typy ──────────────────────────────────────────────────────────────────────
interface SupabaseProduct {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  shopifyVariantId?: string;
  shoptetProductId?: string;
  price?: number | string;
  priceAmount?: number;
  thumbnail?: string;
  image?: string;
  description?: string;
  isbn?: string;
  category?: string;
  type?: string;
  dolozka?: string;
  note?: string;
  previewLink?: string;
  appLink?: string;
  autori?: string;
  rokVydani?: string;
  pocetStranek?: number;
}

interface ShopifyVariant {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
}

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  variants: ShopifyVariant[];
}

// ── CSV / text helpers ────────────────────────────────────────────────────────
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parsePrice(raw: string | number | undefined): string {
  if (!raw) return '0.00';
  if (typeof raw === 'number') return raw.toFixed(2);
  const match = String(raw).match(/[\d\s]+[,.]?[\d]*/);
  if (!match) return '0.00';
  const num = parseFloat(match[0].replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

function typeLabel(type: string | undefined): string {
  switch (type) {
    case 'online': return 'Digit\u00e1ln\u00ed licence';
    case 'workbook': return 'Pracovn\u00ed se\u0161it';
    case 'vividboard': return 'Vividboard';
    default: return type || '';
  }
}

function escapeCSV(val: string | undefined): string {
  const s = String(val ?? '').replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? `"${s}"` : s;
}

// Podobnost řetězců (0–1) pro auto-matching
function similarity(a: string, b: string): number {
  const sa = slugify(a);
  const sb = slugify(b);
  if (sa === sb) return 1;
  if (sa.includes(sb) || sb.includes(sa)) return 0.85;
  // počet společných slov
  const wa = new Set(sa.split('-'));
  const wb = new Set(sb.split('-'));
  const common = [...wa].filter(w => wb.has(w) && w.length > 2).length;
  const total = Math.max(wa.size, wb.size);
  return total > 0 ? common / total : 0;
}

// Parsování Shopify export CSV → mapa handle/title → variantId (GID)
// Shopify standardní export NEOBSAHUJE Variant ID — jen Handle a Title.
// Variant ID získáme ze Storefront API (shopifyProducts), kde klíčujeme podle handle.
interface ShopifyCSVRow {
  handle: string;
  title: string;
  sku: string;
  option1Value: string;
  option2Value: string;
}

function parseShopifyExportCSV(text: string): ShopifyCSVRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const rawHeader = lines[0];
  const headers = parseCSVLine(rawHeader).map(h => h.toLowerCase().trim());

  const idx = (name: string) => headers.findIndex(h => h === name || h.includes(name));
  const iHandle = idx('handle');
  const iTitle = idx('title');
  const iSku = idx('variant sku');
  const iOpt1 = idx('option1 value');
  const iOpt2 = idx('option2 value');

  if (iHandle < 0) return [];

  const rows: ShopifyCSVRow[] = [];
  const seenHandles = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const handle = cols[iHandle]?.trim();
    if (!handle) continue;
    // jeden řádek na handle (první varianta stačí)
    if (seenHandles.has(handle)) continue;
    seenHandles.add(handle);
    rows.push({
      handle,
      title: iTitle >= 0 ? (cols[iTitle]?.trim() || '') : '',
      sku: iSku >= 0 ? (cols[iSku]?.trim() || '') : '',
      option1Value: iOpt1 >= 0 ? (cols[iOpt1]?.trim() || '') : '',
      option2Value: iOpt2 >= 0 ? (cols[iOpt2]?.trim() || '') : '',
    });
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── CSV export helpers ────────────────────────────────────────────────────────
const CSV_COLUMNS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category',
  'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value',
  'Variant SKU', 'Variant Grams',
  'Variant Inventory Tracker', 'Variant Inventory Qty',
  'Variant Inventory Policy', 'Variant Fulfillment Service',
  'Variant Price', 'Variant Compare At Price',
  'Variant Requires Shipping', 'Variant Taxable',
  'Image Src', 'Image Position', 'Image Alt Text',
  'SEO Title', 'SEO Description', 'Status',
];

interface ExportOptions {
  vendor: string;
  inventoryQty: number;
  published: boolean;
  requiresShipping: boolean;
  taxable: boolean;
  status: 'active' | 'draft' | 'archived';
  onlyUnlinked: boolean;
}

function buildExportCSV(products: SupabaseProduct[], opts: ExportOptions): string {
  const rows: string[][] = [CSV_COLUMNS];
  const source = opts.onlyUnlinked ? products.filter(p => !p.shopifyVariantId) : products;
  for (const p of source) {
    const name = p.name || p.title || p.id;
    rows.push([
      slugify(name), name,
      p.description ? `<p>${p.description.replace(/\n/g, '</p><p>')}</p>` : '',
      opts.vendor, '',
      typeLabel(p.type),
      [p.category, typeLabel(p.type), p.autori].filter(Boolean).join(', '),
      opts.published ? 'TRUE' : 'FALSE',
      'Title', 'Default Title',
      p.isbn || '', '0',
      'shopify', String(opts.inventoryQty), 'deny', 'manual',
      parsePrice(p.price ?? p.priceAmount), '',
      opts.requiresShipping ? 'TRUE' : 'FALSE',
      opts.taxable ? 'TRUE' : 'FALSE',
      p.image || p.thumbnail || '',
      p.image || p.thumbnail ? '1' : '',
      name, name,
      p.description ? p.description.slice(0, 160) : '',
      opts.status,
    ]);
  }
  return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

function downloadFile(content: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function normalizeVariantId(raw: string): string {
  if (!raw) return '';
  raw = raw.trim();
  if (raw.startsWith('gid://')) return raw;
  const urlMatch = raw.match(/variants\/(\d+)/);
  if (urlMatch) return `gid://shopify/ProductVariant/${urlMatch[1]}`;
  if (/^\d+$/.test(raw)) return `gid://shopify/ProductVariant/${raw}`;
  return raw;
}

// ── AUTO-MATCH PANEL ──────────────────────────────────────────────────────────
interface MatchResult {
  productId: string;
  productName: string;
  shopifyTitle: string;
  variantId: string;
  variantTitle: string;
  score: number;
  accepted: boolean;
}

function AutoMatchPanel({
  products,
  shopifyProducts,
  onApply,
}: {
  products: SupabaseProduct[];
  shopifyProducts: ShopifyProduct[];
  onApply: (matches: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [ran, setRan] = useState(false);

  function runMatch() {
    const results: MatchResult[] = [];
    for (const p of products) {
      if (p.shopifyVariantId) continue; // přeskočit už propojené
      const name = p.name || p.title || '';
      let best: MatchResult | null = null;
      for (const sp of shopifyProducts) {
        const score = Math.max(similarity(name, sp.title), similarity(name, sp.handle));
        if (score > 0.4 && (!best || score > best.score)) {
          const variant = sp.variants[0];
          best = {
            productId: p.id,
            productName: name,
            shopifyTitle: sp.title,
            variantId: variant.id,
            variantTitle: sp.variants.length > 1 ? variant.title : 'Default Title',
            score,
            accepted: score >= 0.7,
          };
        }
      }
      if (best) results.push(best);
    }
    setMatches(results.sort((a, b) => b.score - a.score));
    setRan(true);
  }

  function handleApply() {
    const map: Record<string, string> = {};
    matches.filter(m => m.accepted).forEach(m => { map[m.productId] = m.variantId; });
    onApply(map);
    setOpen(false);
  }

  const acceptedCount = matches.filter(m => m.accepted).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
      <button
        onClick={() => { setOpen(v => !v); if (!ran && !open) runMatch(); }}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-violet-600" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-bold text-[#001161]">
              {'Auto-p\u00e1rovat ze Shopify'}
            </div>
            <div className="text-[12px] text-gray-400">
              {'Automaticky spoj\u00ed produkty podle podobnosti n\u00e1zvu'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ran && (
            <span className="text-[11px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
              {`${acceptedCount} shod`}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {shopifyProducts.length === 0 ? (
            <div className="text-[13px] text-gray-400 text-center py-6">
              {'Nejprve na\u010dti produkty ze Shopify (tla\u010d\u00edtko \u201eObnovit Shopify\u201c naho\u0159e)'}
            </div>
          ) : !ran ? (
            <button
              onClick={runMatch}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[13px] font-bold transition-colors"
            >
              <Zap className="w-4 h-4" />
              {'Spustit auto-p\u00e1ruj\u00edc\u00ed algoritmus'}
            </button>
          ) : matches.length === 0 ? (
            <div className="text-[13px] text-gray-400 text-center py-6">
              {'Nepoda\u0159ilo se naj\u00edt \u017e\u00e1dn\u00e9 shody'}
            </div>
          ) : (
            <>
              <div className="text-[12px] text-gray-500 mb-3">
                {`Nalezeno ${matches.length} potenci\u00e1ln\u00edch shod. Za\u0161krtni ty, kter\u00e9 chce\u0161 pou\u017e\u00edt:`}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <div className="w-5" />
                  <div>{'Vividbooks produkt'}</div>
                  <div>{'Shopify produkt'}</div>
                  <div className="w-16 text-center">{'Shoda'}</div>
                </div>
                {matches.map(m => (
                  <div
                    key={m.productId}
                    className={`grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 items-center transition-colors ${
                      m.accepted ? 'bg-white' : 'bg-gray-50/50 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={m.accepted}
                      onChange={e => setMatches(prev =>
                        prev.map(x => x.productId === m.productId ? { ...x, accepted: e.target.checked } : x)
                      )}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <div className="text-[13px] text-[#001161] font-medium truncate">{m.productName}</div>
                    <div>
                      <div className="text-[13px] text-gray-700 truncate">{m.shopifyTitle}</div>
                      {m.variantTitle !== 'Default Title' && (
                        <div className="text-[10px] text-gray-400">{m.variantTitle}</div>
                      )}
                    </div>
                    <div className="w-16 text-center">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        m.score >= 0.85
                          ? 'bg-emerald-100 text-emerald-700'
                          : m.score >= 0.6
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {Math.round(m.score * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleApply}
                  disabled={acceptedCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {`Pou\u017e\u00edt ${acceptedCount} shod (je\u0161t\u011b neulo\u017eeno)`}
                </button>
                <button
                  onClick={() => setMatches(prev => prev.map(m => ({ ...m, accepted: true })))}
                  className="text-[12px] text-violet-600 hover:text-violet-800 transition-colors"
                >
                  {'Vybrat v\u0161e'}
                </button>
                <button
                  onClick={() => setMatches(prev => prev.map(m => ({ ...m, accepted: false })))}
                  className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {'Zru\u0161it v\u0161e'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── SHOPIFY CSV IMPORT PANEL ─────────────────────���────────────────────────────
// Shopify export CSV neobsahuje Variant ID — jen Handle.
// Variant ID dohledáme přes načtené shopifyProducts (Storefront API) podle handle.
interface PreviewMatch {
  product: SupabaseProduct;
  row: ShopifyCSVRow;
  resolvedVariantId: string; // z shopifyProducts podle handle
  score: number;
}

function CSVImportPanel({
  products,
  shopifyProducts,
  onApply,
}: {
  products: SupabaseProduct[];
  shopifyProducts: ShopifyProduct[];
  onApply: (matches: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<ShopifyCSVRow[]>([]);
  const [preview, setPreview] = useState<PreviewMatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filename, setFilename] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    setFilename(file.name);
    setParseError(null);
    setCsvRows([]);
    setPreview([]);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseShopifyExportCSV(text);

      if (parsed.length === 0) {
        const firstLine = text.split(/\r?\n/)[0] || '';
        setParseError(
          `CSV bylo na\u010dteno, ale sloupec "Handle" nebyl nalezen.\nHlavi\u010dka: ${firstLine.slice(0, 300)}`
        );
        return;
      }

      setCsvRows(parsed);

      // Pro každý CSV řádek:
      // 1. přes handle najdi Shopify produkt → získej Variant ID z API
      // 2. přes title/handle najdi odpovídající Supabase produkt
      const matches: PreviewMatch[] = [];
      const usedProductIds = new Set<string>();

      for (const row of parsed) {
        // Krok 1: handle → variantId ze Shopify API
        const shopifyMatch = shopifyProducts.find(sp =>
          sp.handle === row.handle ||
          similarity(sp.handle, row.handle) >= 0.9
        );
        const resolvedVariantId = shopifyMatch?.variants[0]?.id || '';

        // Krok 2: Supabase produkt
        let bestProduct: SupabaseProduct | null = null;
        let bestScore = 0;
        for (const p of products) {
          if (usedProductIds.has(p.id)) continue;
          const name = p.name || p.title || '';
          const score = Math.max(
            similarity(name, row.title),
            similarity(name, row.handle),
            p.slug ? similarity(p.slug, row.handle) : 0,
            shopifyMatch ? similarity(name, shopifyMatch.title) : 0,
          );
          if (score > bestScore) { bestScore = score; bestProduct = p; }
        }

        if (bestProduct && bestScore > 0.35) {
          usedProductIds.add(bestProduct.id);
          matches.push({ product: bestProduct, row, resolvedVariantId, score: bestScore });
        }
      }

      matches.sort((a, b) => b.score - a.score);
      setPreview(matches);
      setSelected(new Set(
        matches.filter(m => m.score >= 0.6 && m.resolvedVariantId).map(m => m.product.id)
      ));
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleApply() {
    const map: Record<string, string> = {};
    preview
      .filter(m => selected.has(m.product.id) && m.resolvedVariantId)
      .forEach(m => { map[m.product.id] = m.resolvedVariantId; });
    onApply(map);
    setOpen(false);
  }

  const noShopifyLoaded = shopifyProducts.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <FileUp className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-bold text-[#001161]">
              {'Importovat z Shopify CSV exportu'}
            </div>
            <div className="text-[12px] text-gray-400">
              {'Shopify Admin \u2192 Produkty \u2192 Exportovat \u2192 nahr\u00e1t CSV sem'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {csvRows.length > 0 && (
            <span className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
              {`${csvRows.length} produkt\u016f`}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {/* varování — Shopify není načteno */}
          {noShopifyLoaded && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-[12px] text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                <strong>{'Shopify produkty nejsou na\u010dteny!'}</strong>
                {' Klikni na \u201eShopify (\u2026)\u201c naho\u0159e, po\u010dkej na na\u010dten\u00ed a pak teprve nahr\u00e1v\u00e1j CSV. Bez toho nelze dohledat Variant ID.'}
              </span>
            </div>
          )}

          {/* instrukce */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5 text-[12px] text-blue-700">
            <strong>{'Jak to funguje: '}</strong>
            {'Shopify export CSV obsahuje sloupec Handle. Ten se spoj\u00ed se Shopify API (m\u00e1me na\u010dten\u00e9 naho\u0159e) a automaticky se doplhn\u00ed Variant ID.'}
          </div>

          {/* TLAČÍTKO — primární akce */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl text-[14px] font-bold transition-colors shadow-sm"
            >
              <FileUp className="w-5 h-5" />
              {'Vybrat CSV soubor'}
            </button>
            {filename && (
              <span className="text-[12px] text-gray-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {filename}
              </span>
            )}
          </div>

          {/* drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
            className="border-2 border-dashed border-gray-200 rounded-xl py-3 text-center text-[12px] text-gray-400 hover:border-orange-300 hover:bg-orange-50/20 transition-colors mb-4"
          >
            {'nebo p\u0159eta\u017euj .csv soubor sem'}
          </div>

          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleInputChange} className="hidden" />

          {/* chyba */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-[12px] font-bold text-red-700 mb-1">{'Chyba p\u0159i zpracov\u00e1n\u00ed CSV'}</p>
              <pre className="text-[11px] text-red-500 whitespace-pre-wrap break-all">{parseError}</pre>
            </div>
          )}

          {/* status */}
          {csvRows.length > 0 && preview.length === 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-[12px] text-amber-700">
              {`Na\u010dteno ${csvRows.length} handle z CSV, ale \u017e\u00e1dn\u00fd se nepoda\u0159ilo sp\u00e1rovat.`}
              {noShopifyLoaded && <strong>{' Nejprve na\u010dti produkty ze Shopify!'}</strong>}
            </div>
          )}
          {csvRows.length > 0 && preview.length > 0 && (
            <div className="text-[12px] text-gray-500 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {`Na\u010dteno ${csvRows.length} z CSV \u2192 sp\u00e1runo ${preview.length} produkt\u016f:`}
            </div>
          )}

          {/* tabulka výsledků */}
          {preview.length > 0 && (
            <>
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <div className="w-5" />
                  <div>{'Vividbooks'}</div>
                  <div>{'Handle (z CSV)'}</div>
                  <div>{'Variant ID (z API)'}</div>
                  <div className="w-14 text-center">{'Shoda'}</div>
                </div>
                {preview.map(m => (
                  <div
                    key={m.product.id}
                    className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 px-3 py-2.5 border-b border-gray-50 last:border-0 items-center ${selected.has(m.product.id) ? '' : 'opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(m.product.id)}
                      disabled={!m.resolvedVariantId}
                      onChange={e => setSelected(prev => {
                        const s = new Set(prev);
                        e.target.checked ? s.add(m.product.id) : s.delete(m.product.id);
                        return s;
                      })}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <div className="text-[12px] text-[#001161] font-medium truncate">
                      {m.product.name || m.product.title}
                    </div>
                    <div className="text-[12px] font-mono text-gray-500 truncate">{m.row.handle}</div>
                    <div className="text-[11px] font-mono truncate">
                      {m.resolvedVariantId
                        ? <span className="text-emerald-600">{'…' + m.resolvedVariantId.split('/').pop()}</span>
                        : <span className="text-red-400 text-[10px]">{'nenalezeno v API'}</span>
                      }
                    </div>
                    <div className="w-14 text-center">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                        m.score >= 0.85 ? 'bg-emerald-100 text-emerald-700'
                        : m.score >= 0.6 ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-600'
                      }`}>
                        {Math.round(m.score * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleApply}
                  disabled={selected.size === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-40 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  {`Doplnit ${selected.size} Variant ID`}
                </button>
                <span className="text-[11px] text-gray-400">
                  {'(je\u0161t\u011b neulo\u017eeno \u2014 klikni \u201eUlo\u017eit v\u0161echny zm\u011bny\u201c naho\u0159e)'}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── CSV EXPORT PANEL ──────────────────────────────────────────────────────────
function CSVExportPanel({ products }: { products: SupabaseProduct[] }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ExportOptions>({
    vendor: 'Vividbooks',
    inventoryQty: 99,
    published: false,
    requiresShipping: false,
    taxable: true,
    status: 'draft',
    onlyUnlinked: false,
  });

  const unlinked = products.filter(p => !p.shopifyVariantId).length;
  const exportCount = opts.onlyUnlinked ? unlinked : products.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-bold text-[#001161]">
              {'Export CSV pro Shopify import'}
            </div>
            <div className="text-[12px] text-gray-400">
              {'Shopify Admin \u2192 Produkty \u2192 Importovat'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
            {exportCount} {exportCount === 1 ? 'produkt' : exportCount < 5 ? 'produkty' : 'produkt\u016f'}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Vendor</label>
              <input type="text" value={opts.vendor}
                onChange={e => setOpts(o => ({ ...o, vendor: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#001161]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{'Po\u010det na sklad\u011b'}</label>
              <input type="number" value={opts.inventoryQty}
                onChange={e => setOpts(o => ({ ...o, inventoryQty: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#001161]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{'Stav'}</label>
              <select value={opts.status}
                onChange={e => setOpts(o => ({ ...o, status: e.target.value as any }))}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#001161] bg-white">
                <option value="draft">{'Koncept (doporu\u010deno)'}</option>
                <option value="active">{'Aktivn\u00ed'}</option>
                <option value="archived">{'Archivov\u00e1no'}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mb-5">
            {[
              { key: 'published', label: 'Published: TRUE' },
              { key: 'requiresShipping', label: 'Vy\u017eaduje doru\u010den\u00ed' },
              { key: 'taxable', label: 'Zdaniteln\u00e9 (DPH)' },
              { key: 'onlyUnlinked', label: `Jen nepropojeno (${unlinked} ks)` },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={(opts as any)[key]}
                  onChange={e => setOpts(o => ({ ...o, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#001161]" />
                <span className="text-[13px] text-gray-600">{label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={() => {
              const csv = buildExportCSV(products, opts);
              downloadFile(csv, `vividbooks-shopify-${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            disabled={exportCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {`St\u00e1hnout CSV (${exportCount} produkt\u016f)`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── HLAVNÍ KOMPONENTA ─────────────────────────────────────────────────────────
export default function ShopifyLinker() {
  const [products, setProducts] = useState<SupabaseProduct[]>([]);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyError, setShopifyError] = useState<string | null>(null);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [shoptetEdits, setShoptetEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const [search, setSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [shopifySearch, setShopifySearch] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const data = await fetchProducts();
    setProducts(data);
    const initEdits: Record<string, string> = {};
    const initShoptet: Record<string, string> = {};
    data.forEach((p: SupabaseProduct) => {
      initEdits[p.id] = p.shopifyVariantId || '';
      initShoptet[p.id] = p.shoptetProductId || '';
    });
    setEdits(initEdits);
    setShoptetEdits(initShoptet);
    setLoading(false);
  }, []);

  const loadShopifyProducts = useCallback(async () => {
    if (!isShopifyConfigured) return;
    setShopifyLoading(true);
    setShopifyError(null);
    try {
      const data = await shopifyFetch<any>(`
        query { products(first: 250) { edges { node {
          id title handle
          variants(first: 20) { edges { node {
            id title price { amount currencyCode }
          }}}
        }}}}
      `);
      setShopifyProducts(data.products.edges.map((e: any) => ({
        id: e.node.id, title: e.node.title, handle: e.node.handle,
        variants: e.node.variants.edges.map((ve: any) => ({
          id: ve.node.id, title: ve.node.title, price: ve.node.price,
        })),
      })));
    } catch (err: any) {
      setShopifyError(err.message);
    } finally {
      setShopifyLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); loadShopifyProducts(); }, [loadProducts, loadShopifyProducts]);

  // Aplikace auto-match / CSV import výsledků
  function applyMatches(map: Record<string, string>) {
    setEdits(prev => ({ ...prev, ...map }));
  }

  async function handleSave(productId: string) {
    setSaving(s => ({ ...s, [productId]: true }));
    try {
      const variantId = normalizeVariantId(edits[productId] || '');
      await updateProduct(productId, {
        shopifyVariantId: variantId || null,
        shoptetProductId: shoptetEdits[productId] || null,
      });
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, shopifyVariantId: variantId, shoptetProductId: shoptetEdits[productId] } : p
      ));
      setEdits(e => ({ ...e, [productId]: variantId }));
      setSaved(s => ({ ...s, [productId]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [productId]: false })), 2000);
    } catch (err) {
      console.error('[ShopifyLinker] Save error:', err);
    } finally {
      setSaving(s => ({ ...s, [productId]: false }));
    }
  }

  async function handleSaveAll() {
    const changed = products.filter(p => {
      const normalized = normalizeVariantId(edits[p.id] || '');
      return normalized !== (p.shopifyVariantId || '') || (shoptetEdits[p.id] || '') !== (p.shoptetProductId || '');
    });
    for (const p of changed) await handleSave(p.id);
  }

  const filtered = products.filter(p =>
    (p.name || p.title || '').toLowerCase().includes(search.toLowerCase())
  );
  const linked = products.filter(p => p.shopifyVariantId).length;
  const unlinked = products.length - linked;
  const shopifyFiltered = shopifyProducts.filter(sp =>
    sp.title.toLowerCase().includes(shopifySearch.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f7f8fc]">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#001161] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#ff6a35]" />
            {'Shopify Propojen\u00ed'}
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">
            {'Export, import a p\u0159i\u0159azen\u00ed Variant ID'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadShopifyProducts} disabled={shopifyLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
            <RefreshCw className={`w-3.5 h-3.5 ${shopifyLoading ? 'animate-spin' : ''}`} />
            {shopifyLoading ? 'Na\u010d\u00edt\u00e1m...' : `Shopify (${shopifyProducts.length})`}
          </button>
          <button onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] bg-[#001161] text-white rounded-lg hover:bg-[#001161]/90 transition-colors font-bold">
            <Save className="w-3.5 h-3.5" />
            {'Ulo\u017eit v\u0161echny zm\u011bny'}
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="text-2xl font-bold text-[#001161]">{products.length}</div>
          <div className="text-[12px] text-gray-400 mt-0.5">{'Celkem produkt\u016f'}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="text-2xl font-bold text-emerald-600">{linked}</div>
          <div className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {'Propojeno'}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="text-2xl font-bold text-orange-500">{unlinked}</div>
          <div className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-orange-400" /> {'Nepropojeno'}
          </div>
        </div>
      </div>

      {shopifyError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-[13px] text-red-600">{shopifyError}</p>
        </div>
      )}

      {/* NÁSTROJE — accordiony */}
      {!loading && (
        <>
          {/* 1. Export CSV (pro import do Shopify) */}
          <CSVExportPanel products={products} />

          {/* 2. Import z Shopify CSV exportu */}
          <CSVImportPanel products={products} shopifyProducts={shopifyProducts} onApply={applyMatches} />

          {/* 3. Auto-párovat podle názvu */}
          <AutoMatchPanel
            products={products}
            shopifyProducts={shopifyProducts}
            onApply={applyMatches}
          />
        </>
      )}

      {/* SEARCH */}
      <div className="relative mb-4 mt-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder={'Hledat produkt...'} value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#001161]" />
      </div>

      {/* TABULKA */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_2fr_2fr_auto] gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <div>{'Produkt'}</div>
            <div>{'Shoptet ID'}</div>
            <div>{'Shopify Variant ID'}</div>
            <div>{'Vybrat ze Shopify'}</div>
            <div className="w-20 text-center">{'Akce'}</div>
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-300 text-[13px]">{'Nenalezeny \u017e\u00e1dn\u00e9 produkty'}</div>
          )}

          {filtered.map(product => {
            const name = product.name || product.title || product.id;
            const currentVariant = edits[product.id] || '';
            const isLinked = Boolean(product.shopifyVariantId);
            const isDirty =
              normalizeVariantId(currentVariant) !== (product.shopifyVariantId || '') ||
              (shoptetEdits[product.id] || '') !== (product.shoptetProductId || '');

            return (
              <div key={product.id}
                className="grid grid-cols-[2fr_1fr_2fr_2fr_auto] gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors items-center">
                {/* název */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {product.thumbnail || product.image ? (
                    <img src={product.thumbnail || product.image} alt={name}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 border border-gray-100" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-4 h-4 text-orange-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#001161] truncate">{name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isLinked ? (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> {'Propojeno'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                          <XCircle className="w-3 h-3" /> {'Nepropojeno'}
                        </span>
                      )}
                      {isDirty && <span className="text-[10px] text-amber-500 font-bold">{'• zm\u011bn\u011bno'}</span>}
                    </div>
                  </div>
                </div>

                {/* Shoptet ID */}
                <input type="text" value={shoptetEdits[product.id] || ''}
                  onChange={e => setShoptetEdits(s => ({ ...s, [product.id]: e.target.value }))}
                  placeholder={'Shoptet ID'}
                  className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#001161] font-mono w-full" />

                {/* Variant ID */}
                <div className="flex flex-col gap-1">
                  <input type="text" value={currentVariant}
                    onChange={e => setEdits(ed => ({ ...ed, [product.id]: e.target.value }))}
                    placeholder={'URL, \u010d\u00edslo nebo GID...'}
                    className={`px-2.5 py-1.5 text-[12px] border rounded-lg focus:outline-none font-mono w-full ${
                      currentVariant && !product.shopifyVariantId
                        ? 'border-amber-300 focus:border-amber-500'
                        : 'border-gray-200 focus:border-[#001161]'
                    }`} />
                  {currentVariant && normalizeVariantId(currentVariant) !== currentVariant && (
                    <div className="text-[10px] text-gray-400 font-mono truncate px-1">
                      {'\u2192 '}{normalizeVariantId(currentVariant)}
                    </div>
                  )}
                </div>

                {/* Vybrat ze Shopify */}
                <div className="relative">
                  <button
                    onClick={() => { setOpenDropdown(openDropdown === product.id ? null : product.id); setShopifySearch(''); }}
                    disabled={shopifyLoading || !isShopifyConfigured}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] border rounded-lg transition-colors ${
                      shopifyLoading ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 hover:border-[#001161] text-gray-600 cursor-pointer'
                    }`}>
                    <span className="truncate">
                      {shopifyLoading ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{'Na\u010d\u00edt\u00e1m...'}</span>
                      ) : shopifyProducts.length === 0 ? '— \u017e\u00e1dn\u00e9 —'
                      : (() => {
                        const vid = normalizeVariantId(currentVariant);
                        for (const sp of shopifyProducts) {
                          const match = sp.variants.find(v => v.id === vid);
                          if (match) return `${sp.title}${sp.variants.length > 1 ? ` / ${match.title}` : ''}`;
                        }
                        return 'Vybrat...';
                      })()}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  </button>

                  {openDropdown === product.id && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-72 max-h-64 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-gray-100">
                        <input type="text" autoFocus value={shopifySearch}
                          onChange={e => setShopifySearch(e.target.value)}
                          placeholder={'Hledat v Shopify...'}
                          className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#001161]" />
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {shopifyFiltered.length === 0 && (
                          <div className="py-4 text-center text-[12px] text-gray-300">{'Nic nenalezeno'}</div>
                        )}
                        {shopifyFiltered.map(sp => (
                          <div key={sp.id} className="border-b border-gray-50 last:border-0">
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">{sp.title}</div>
                            {sp.variants.map(variant => (
                              <button key={variant.id}
                                onClick={() => { setEdits(ed => ({ ...ed, [product.id]: variant.id })); setOpenDropdown(null); }}
                                className="w-full text-left px-3 py-2 text-[12px] hover:bg-orange-50 transition-colors flex items-center justify-between gap-2">
                                <span className="text-[#001161] font-medium">
                                  {sp.variants.length > 1 ? variant.title : sp.title}
                                </span>
                                <span className="text-[11px] text-emerald-600 font-bold shrink-0">
                                  {parseFloat(variant.price.amount).toFixed(0)} {variant.price.currencyCode}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save */}
                <div className="w-20 flex justify-center">
                  {saved[product.id] ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> {'OK'}
                    </span>
                  ) : (
                    <button onClick={() => handleSave(product.id)} disabled={saving[product.id] || !isDirty}
                      className={`flex items-center gap-1 px-3 py-1.5 text-[12px] rounded-lg font-bold transition-all ${
                        isDirty ? 'bg-[#001161] text-white hover:bg-[#001161]/90' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      }`}>
                      {saving[product.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {'Ulo\u017eit'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end">
        <a href="https://admin.shopify.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-[#001161] transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
          {'Otev\u0159\u00edt Shopify Admin'}
        </a>
      </div>
    </div>
  );
}