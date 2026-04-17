import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Package, LayoutGrid, List, Grid3x3, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type { ProductBundleRecord } from '../../utils/bundlePricing';
import {
  type EmailProductCollageDisplayOptions,
  type EmailProductCollageImageSize,
  type EmailProductCollageItem,
  type EmailProductCollageLayout,
  snapshotFromProduct,
  snapshotFromBundle,
} from './emailProductCollage';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { Authorization: `Bearer ${publicAnonKey}` } as const;
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

const LIVE_DEBOUNCE_MS = 220;

export type EmailProductCollageLivePayload = {
  blockId: string;
  layout: EmailProductCollageLayout;
  items: EmailProductCollageItem[];
  display: EmailProductCollageDisplayOptions;
};

export type EmailProductCollagePanelProps = {
  blockId: string;
  getSnapshot: () => {
    layout: EmailProductCollageLayout;
    items: EmailProductCollageItem[];
    display: EmailProductCollageDisplayOptions;
  };
  onLiveUpdate: (payload: EmailProductCollageLivePayload) => void;
};

function searchFold(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function EmailProductCollagePanel({ blockId, getSnapshot, onLiveUpdate }: EmailProductCollagePanelProps) {
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;
  const onLiveUpdateRef = useRef(onLiveUpdate);
  onLiveUpdateRef.current = onLiveUpdate;

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<ProductBundleRecord[]>([]);
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<EmailProductCollageLayout>('grid');
  const [selected, setSelected] = useState<EmailProductCollageItem[]>([]);
  const [gridColumns, setGridColumns] = useState<2 | 3>(2);
  const [imageSize, setImageSize] = useState<EmailProductCollageImageSize>('m');
  const [tab, setTab] = useState<'products' | 'bundles'>('products');

  useEffect(() => {
    const snap = getSnapshotRef.current();
    setLayout(snap.layout);
    setSelected([...snap.items]);
    setGridColumns(snap.display.gridColumns);
    setImageSize(snap.display.imageSize);
    setSearch('');
    setTab('products');
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pRes, bRes] = await Promise.all([
          fetch(`${SERVER}/products`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
          fetch(`${SERVER}/admin/product-bundles`, { headers: AUTH_H }),
        ]);
        if (!pRes.ok) throw new Error('Produkty se nepodařilo načíst.');
        const pJson = await pRes.json();
        const bJson = bRes.ok ? await bRes.json() : { bundles: [] };
        if (cancelled) return;
        setProducts(Array.isArray(pJson.products) ? pJson.products : []);
        setBundles(Array.isArray(bJson.bundles) ? bJson.bundles : []);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error(e instanceof Error ? e.message : 'Chyba načítání');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  const display: EmailProductCollageDisplayOptions = useMemo(
    () => ({ gridColumns, imageSize }),
    [gridColumns, imageSize],
  );

  const selectedSig = useMemo(() => JSON.stringify(selected), [selected]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      onLiveUpdateRef.current({
        blockId,
        layout,
        items: selected,
        display,
      });
    }, LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [blockId, layout, selectedSig, display]);

  const productsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of products) {
      if (p?.id != null) m.set(String(p.id), p);
    }
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchFold(search.trim());
    if (!q) return products;
    return products.filter((p) => {
      const hay = searchFold(
        [p.name, p.title, p.category, p.description, p.id].filter(Boolean).join(' '),
      );
      return hay.includes(q);
    });
  }, [products, search]);

  const addProduct = useCallback((p: any) => {
    const snap = snapshotFromProduct(p);
    setSelected((prev) => {
      if (prev.some((x) => x.k === 'p' && x.id === snap.id)) return prev;
      return [...prev, snap];
    });
  }, []);

  const addBundle = useCallback(
    (b: ProductBundleRecord) => {
      const snap = snapshotFromBundle(b, productsById);
      setSelected((prev) => {
        if (prev.some((x) => x.k === 'b' && x.id === snap.id)) return prev;
        return [...prev, snap];
      });
    },
    [productsById],
  );

  const removeAt = (i: number) => {
    setSelected((prev) => prev.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: -1 | 1) => {
    setSelected((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const showColumnPicker = layout === 'grid' || layout === 'compact';

  return (
    <div className="rounded-xl border border-[#7C3AED]/25 bg-[#fafbfd]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100/80 bg-white/80">
        <Package className="w-4 h-4 text-[#7C3AED] shrink-0" />
        <h3 id="vb-email-pc-title" className="text-[12px] font-bold text-[#001161] truncate" style={F}>
          Produktová koláž
        </h3>
      </div>

      <div className="shrink-0 px-3 py-2.5 border-b border-gray-100/90 bg-white/70 space-y-2">
        <p style={F} className="text-[9px] font-bold uppercase tracking-wide text-[#001161]/40">
          Zobrazení v mailu · živý náhled
        </p>
        {showColumnPicker && (
          <div>
            <p style={F} className="text-[9px] font-bold text-[#001161]/35 mb-1">
              Počet sloupců
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setGridColumns(2)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold cursor-pointer ${
                  gridColumns === 2
                    ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                    : 'border-gray-200 bg-white text-[#001161]/70'
                }`}
                style={F}
              >
                2 sloupce
              </button>
              <button
                type="button"
                onClick={() => setGridColumns(3)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold cursor-pointer ${
                  gridColumns === 3
                    ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                    : 'border-gray-200 bg-white text-[#001161]/70'
                }`}
                style={F}
              >
                3 sloupce
              </button>
            </div>
          </div>
        )}
        <div>
          <p style={F} className="text-[9px] font-bold text-[#001161]/35 mb-1">
            Velikost obrázků
          </p>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: 's' as const, label: 'Menší' },
                { id: 'm' as const, label: 'Střední' },
                { id: 'l' as const, label: 'Větší' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setImageSize(id)}
                className={`rounded-lg border px-1 py-1.5 text-[10px] font-bold cursor-pointer ${
                  imageSize === id
                    ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                    : 'border-gray-200 bg-white text-[#001161]/65'
                }`}
                style={F}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-3 py-3 space-y-3">
        <div className="space-y-3">
          <div>
            <p style={F} className="text-[9px] font-bold uppercase tracking-wide text-[#001161]/40 mb-1.5">
              Rozložení v mailu
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'grid' as const, label: 'Mřížka', icon: LayoutGrid },
                  { id: 'list' as const, label: 'Seznam', icon: List },
                  { id: 'compact' as const, label: 'Malé', icon: Grid3x3 },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLayout(id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[10px] font-bold transition-colors cursor-pointer ${
                    layout === id
                      ? 'border-[#7C3AED] bg-[#7C3AED]/8 text-[#001161]'
                      : 'border-gray-200 bg-white text-[#001161] hover:bg-gray-50'
                  }`}
                  style={F}
                >
                  <Icon className="w-4 h-4 opacity-70" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={F} className="text-[9px] font-bold uppercase tracking-wide text-[#001161]/40 mb-1.5">
              Vybrané (pořadí = v mailu)
            </p>
            {selected.length === 0 ? (
              <p style={F} className="text-[11px] text-[#001161]/45 py-2 text-center rounded-lg border border-dashed border-gray-200 bg-white">
                Přidejte produkty nebo balíček níže.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {selected.map((it, i) => (
                  <li
                    key={`${it.k}-${it.id}-${i}`}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white px-2 py-1.5"
                  >
                    {it.image ? (
                      <img src={it.image} alt="" className="w-8 h-11 object-cover rounded border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-8 h-11 rounded bg-gray-200 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p style={F} className="text-[11px] font-bold text-[#001161] truncate">
                        {it.k === 'b' ? `Balíček: ${it.title}` : it.title}
                      </p>
                      <p style={F} className="text-[9px] text-[#001161]/45">
                        {it.price}
                      </p>
                    </div>
                    <div className="flex flex-col gap-0 shrink-0">
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Nahoru"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"
                        onClick={() => move(i, 1)}
                        disabled={i === selected.length - 1}
                        aria-label="Dolů"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="text-[10px] font-bold text-red-600 hover:underline px-1 shrink-0"
                      style={F}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-1.5 border-b border-gray-100 pb-2">
            <button
              type="button"
              onClick={() => setTab('products')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                tab === 'products' ? 'bg-[#001161] text-white' : 'bg-gray-100 text-[#001161]/60 hover:bg-gray-200'
              }`}
              style={F}
            >
              Produkty
            </button>
            <button
              type="button"
              onClick={() => setTab('bundles')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                tab === 'bundles' ? 'bg-[#001161] text-white' : 'bg-gray-100 text-[#001161]/60 hover:bg-gray-200'
              }`}
              style={F}
            >
              Balíčky
            </button>
          </div>

          {tab === 'products' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#001161]/30" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat…"
                className="w-full rounded-lg border border-gray-200 pl-8 pr-2 py-2 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                style={F}
              />
            </div>
          )}
        </div>

        <div
          className="mt-2"
          role="region"
          aria-label={tab === 'products' ? 'Seznam produktů' : 'Seznam balíčků'}
        >
          {tab === 'products' &&
            (loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
              </div>
            ) : (
              <ul className="space-y-1 pb-1">
                {filteredProducts.slice(0, 200).map((p) => (
                  <li key={String(p.id)}>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-2 rounded-lg border border-gray-100 hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 px-2 py-1.5 text-left transition-colors cursor-pointer bg-white"
                    >
                      {getProductThumb(p) ? (
                        <img
                          src={getProductThumb(p)!}
                          alt=""
                          className="w-8 h-10 object-cover rounded border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-10 rounded bg-gray-100 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p style={F} className="text-[11px] font-bold text-[#001161] truncate">
                          {p.name || p.title || p.id}
                        </p>
                      </div>
                      <span style={F} className="text-[9px] font-bold text-[#7C3AED] shrink-0">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'bundles' &&
            (loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
              </div>
            ) : bundles.length === 0 ? (
              <p style={F} className="text-[11px] text-[#001161]/45 py-4 text-center">
                Žádné balíčky. Vytvořte je v administraci.
              </p>
            ) : (
              <ul className="space-y-1.5 pb-1">
                {bundles.map((b) => (
                  <li key={String(b.id)}>
                    <button
                      type="button"
                      onClick={() => addBundle(b)}
                      className="w-full flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-50 px-2 py-2 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p style={F} className="text-[11px] font-bold text-[#001161]">
                          {b.title}
                        </p>
                        <p style={F} className="text-[9px] text-[#001161]/50">
                          {(b.bundlePriceHaler / 100).toLocaleString('cs-CZ')} Kč · {(b.productIds || []).length}{' '}
                          produktů
                        </p>
                      </div>
                      <span style={F} className="text-[9px] font-bold text-amber-900 shrink-0">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    </div>
  );
}

function getProductThumb(p: any): string | null {
  const u = p?.image || p?.imageUrl || p?.coverImage;
  return typeof u === 'string' && u.trim() ? u.trim() : null;
}
