import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2, Package, Sparkles } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useProducts } from '../contexts/ProductsContext';
import { bundleIsNxPlusOneSubject, type ProductBundleRecord } from '../utils/bundlePricing';
import { mergeSchoolOrderDraft } from '../utils/schoolOrderDraft';
import { SEOHead } from './SEOHead';
import { resolveShareImageUrl } from '../utils/ogImage';
import { ProductBundlePromoTile } from './ProductBundlePromoTile';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/product-bundles`;

export function AkcePage() {
  const { products, isLoading: productsLoading } = useProducts();
  const navigate = useNavigate();

  const [bundles, setBundles] = useState<ProductBundleRecord[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kvBundleAddingId, setKvBundleAddingId] = useState<string | null>(null);

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

  /** Akce typu N+M (10+1) se přes web neobjednává — ve výpisu Akcí ji nezobrazujeme. */
  const visibleBundles = useMemo(
    () => bundles.filter((b) => !bundleIsNxPlusOneSubject(b)),
    [bundles],
  );

  const handleAddKvBundleToSchoolOrder = (bundle: ProductBundleRecord) => {
    if (kvBundleAddingId || productsLoading || !products.length) return;
    if (bundleIsNxPlusOneSubject(bundle)) {
      navigate(`/balicek/${encodeURIComponent(bundle.slug || bundle.id)}`);
      return;
    }
    setKvBundleAddingId(bundle.id);
    try {
      const subjects = new Set<string>();
      for (const rawId of bundle.productIds || []) {
        const p = products.find((x) => String(x.id) === String(rawId));
        const cat = p?.category;
        if (cat && String(cat).trim()) subjects.add(String(cat).trim());
      }
      mergeSchoolOrderDraft({
        selTypes: ['workbook'],
        ...(subjects.size > 0 ? { selSubjects: Array.from(subjects) } : {}),
      });
      navigate('/objednat?step=2', { state: { addSchoolBundle: { id: bundle.id } } });
    } finally {
      setKvBundleAddingId(null);
    }
  };

  return (
    <div className="min-h-[60vh] px-4 md:px-8 py-8 max-w-6xl mx-auto">
      <SEOHead
        title="Akce — výhodné balíčky"
        description="Akční balíčky učebnic a materiálů Vividbooks. Přidejte balíček do objednávky pro školu."
        path="/akce"
        image={resolveShareImageUrl({})}
        imageAlt="Akční balíčky Vividbooks"
        imageWidth={1200}
        imageHeight={630}
      />

      <div className="mb-10 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900/90 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          {'E-shop'}
        </div>
        <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[34px] md:text-[44px] leading-tight mb-3">
          {'Akce'}
        </h1>
        <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/65 max-w-2xl mx-auto md:mx-0 leading-relaxed">
          {
            'Vybrané balíčky za zvýhodněnou cenu. Kompletní obsah a popis najdete u detailu akce.'
          }
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-[#001161]/50">
          <Loader2 className="w-6 h-6 animate-spin" />
          Načítání akcí…
        </div>
      ) : fetchError ? (
        <p className="text-center text-red-600 text-[14px] py-12">{fetchError}</p>
      ) : visibleBundles.length === 0 ? (
        <div className="text-center py-20 rounded-[28px] border border-dashed border-[#001161]/15 bg-[#f8f9fc]">
          <Package className="w-14 h-14 mx-auto text-[#001161]/15 mb-4" />
          <p className="font-['Fenomen_Sans'] text-[16px] text-[#001161]/70">
            {'Zatím tu nejsou žádné aktivní akční balíčky.'}
          </p>
          <Link to="/" className="inline-block mt-6 text-[14px] font-bold text-[#001161] underline">
            {'Zpět do katalogu'}
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 list-none p-0 m-0 w-full items-stretch">
          {visibleBundles.map((bundle) => (
            <li key={bundle.id} className="min-h-0 flex h-full">
              <div className="w-full min-h-0 flex flex-col">
                <ProductBundlePromoTile
                  bundle={bundle}
                  products={products}
                  heading={bundle.title}
                  narrowGrid
                  onAddToSchoolOrder={handleAddKvBundleToSchoolOrder}
                  addingBundleId={kvBundleAddingId}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
