import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Loader2, Package, ShoppingCart } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useProducts } from '../contexts/ProductsContext';
import { useCart } from '../contexts/CartContext';
import { buildBundleCartLines, stripBundleAdminBoilerplate, type ProductBundleRecord } from '../utils/bundlePricing';
import { getProductUnitPriceInHaler } from './cartUpsellUtils';
import { BookCoverThumb } from './checkout/BookCoverThumb';
import { SEOHead } from './SEOHead';
import { buildOgImageAlt, resolveShareImageUrl } from '../utils/ogImage';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/product-bundles`;

function formatKc(haler: number): string {
  return `${(haler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

export function BundlePage() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const navigate = useNavigate();
  const { products, isLoading: productsLoading } = useProducts();
  const { addItem, openCart } = useCart();

  const [bundles, setBundles] = useState<ProductBundleRecord[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadBundles = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      if (!res.ok) throw new Error('Nepodařilo se načíst balíčky.');
      const data = await res.json();
      setBundles(Array.isArray(data.bundles) ? data.bundles : []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Chyba');
      setBundles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBundles();
  }, [loadBundles]);

  const bundle = useMemo(() => {
    if (!bundleId) return undefined;
    return bundles.find((b) => b.id === bundleId || b.slug === bundleId);
  }, [bundles, bundleId]);

  const resolvedProducts = useMemo(() => {
    if (!bundle) return [];
    return (bundle.productIds || [])
      .map((id) => products.find((p) => String(p.id) === String(id)))
      .filter(Boolean) as any[];
  }, [bundle, products]);

  const listTotalHaler = useMemo(() => (
    resolvedProducts.reduce((s, p) => s + getProductUnitPriceInHaler(p), 0)
  ), [resolvedProducts]);

  const bundleShareCategory = resolvedProducts[0]?.category as string | undefined;

  const bundleDescPublic = useMemo(
    () => stripBundleAdminBoilerplate(bundle?.description),
    [bundle?.description],
  );

  const handleAddBundle = () => {
    if (!bundle || productsLoading || !products.length) return;
    setAdding(true);
    try {
      const instanceId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `bi-${Date.now()}`;
      const lines = buildBundleCartLines(products, bundle, instanceId);
      if (lines.length === 0) return;
      for (const line of lines) {
        addItem(line);
      }
      openCart();
    } finally {
      setAdding(false);
    }
  };

  const ready =
    !loading
    && !productsLoading
    && bundle
    && resolvedProducts.length > 0
    && resolvedProducts.length === (bundle.productIds || []).length;

  return (
    <div className="min-h-[60vh] px-4 md:px-8 py-8 max-w-3xl mx-auto">
      <SEOHead
        title={bundle ? bundle.title : 'Balíček'}
        description={bundleDescPublic || 'Výhodný balíček produktů Vividbooks.'}
        path={bundleId ? `/balicek/${bundleId}` : ''}
        image={resolveShareImageUrl({ category: bundleShareCategory })}
        imageAlt={
          bundle
            ? buildOgImageAlt({ title: bundle.title, categoryLabel: bundleShareCategory })
            : buildOgImageAlt({ title: 'Balíček produktů' })
        }
        imageWidth={1200}
        imageHeight={630}
      />

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-[13px] text-[#001161]/60 hover:text-[#001161] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Zpět
      </button>

      {loading ? (
        <div className="flex items-center gap-2 text-[#001161]/50">
          <Loader2 className="w-5 h-5 animate-spin" />
          Načítání balíčku…
        </div>
      ) : fetchError ? (
        <p className="text-red-600 text-[14px]">{fetchError}</p>
      ) : !bundle ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto text-[#001161]/20 mb-4" />
          <p className="text-[#001161] font-['Fenomen_Sans'] text-[16px]">Tento balíček neexistuje nebo není k dispozici.</p>
          <Link to="/" className="inline-block mt-4 text-[14px] text-[#001161] underline">
            Na hlavní stránku
          </Link>
        </div>
      ) : (
        <>
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[40px] leading-tight mb-3">
            {bundle.title}
          </h1>
          {bundleDescPublic && (
            <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/65 leading-relaxed mb-8">
              {bundleDescPublic}
            </p>
          )}

          <div className="rounded-[24px] border border-[#001161]/10 bg-white p-5 md:p-6 mb-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#001161]/40 font-bold">Cena balíčku</p>
                <p className="text-[28px] font-bold text-[#001161] font-['Fenomen_Sans']">
                  {formatKc(bundle.bundlePriceHaler || 0)}
                </p>
                {listTotalHaler > 0 && listTotalHaler > (bundle.bundlePriceHaler || 0) && (
                  <p className="text-[13px] text-emerald-700 mt-1">
                    {`Úspora oproti katalogu: ${formatKc(listTotalHaler - (bundle.bundlePriceHaler || 0))}`}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!ready || adding}
                onClick={handleAddBundle}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-[16px] bg-[#001161] hover:bg-[#000a3d] disabled:opacity-50 text-white font-['Fenomen_Sans'] text-[14px] font-bold transition-all cursor-pointer"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                Přidat balíček do košíku
              </button>
            </div>

            {!ready && !productsLoading && (
              <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                Některé produkty z balíčku nejsou v katalogu nebo nejdou objednat. Zkuste obnovit stránku za chvíli.
              </p>
            )}

            <ul className="space-y-4">
              {resolvedProducts.map((p) => (
                <li key={String(p.id)} className="flex gap-4 items-start">
                  <BookCoverThumb
                    imageUrl={p.image || p.imageUrl}
                    alt={p.name || ''}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/produkt/${encodeURIComponent(String(p.id))}`}
                      className="font-['Fenomen_Sans'] text-[15px] font-bold text-[#001161] hover:underline leading-snug"
                    >
                      {p.name || p.title}
                    </Link>
                    {p.category && (
                      <p className="text-[12px] text-[#001161]/45 mt-0.5">{p.category}</p>
                    )}
                    <p className="text-[13px] text-[#001161]/55 mt-1">
                      {`Katalog: ${formatKc(getProductUnitPriceInHaler(p))}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
