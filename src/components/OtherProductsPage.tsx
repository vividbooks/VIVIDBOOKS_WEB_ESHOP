import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Package } from 'lucide-react';
import { useProducts } from '../contexts/ProductsContext';
import { SEOHead } from './SEOHead';
import { resolveShareImageUrl } from '../utils/ogImage';
import { UnifiedBookCard } from './UnifiedBookCard';
import {
  filterMerchByBrowse,
  isMerchProduct,
  merchCategoryCounts,
  merchSubcategoryCountsForCategory,
  type MerchBrowseState,
} from '../utils/merchProducts';

const PAGE_PATH = '/dalsi-produkty';

function browseFromSearchParams(sp: URLSearchParams): MerchBrowseState {
  const kat = sp.get('kat')?.trim();
  const pod = sp.get('pod')?.trim();
  if (!kat) return 'all';
  return { category: kat, subcategory: pod || null };
}

export function OtherProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, isLoading } = useProducts();

  const browse = useMemo(() => browseFromSearchParams(searchParams), [searchParams]);

  const allMerch = useMemo(() => products.filter(isMerchProduct), [products]);

  const visibleProducts = useMemo(
    () => filterMerchByBrowse(products, browse),
    [products, browse],
  );

  const categoryCounts = useMemo(() => merchCategoryCounts(products), [products]);
  const sortedCategories = useMemo(() => [...categoryCounts.keys()].sort(), [categoryCounts]);

  const subCounts = useMemo(() => {
    if (browse === 'all') return new Map<string, number>();
    return merchSubcategoryCountsForCategory(products, browse.category);
  }, [browse, products]);
  const sortedSubs = useMemo(() => [...subCounts.keys()].sort(), [subCounts]);

  const goAll = () => setSearchParams({}, { replace: true });
  const goCategory = (cat: string) => setSearchParams({ kat: cat }, { replace: true });
  const goSub = (cat: string, sub: string) =>
    setSearchParams({ kat: cat, pod: sub }, { replace: true });

  const titleSuffix =
    browse === 'all'
      ? ''
      : browse.subcategory
        ? ` — ${browse.category} — ${browse.subcategory}`
        : ` — ${browse.category}`;

  return (
    <div className="min-h-[60vh] px-4 md:px-8 py-8 max-w-6xl mx-auto">
      <SEOHead
        title={`Další produkty${titleSuffix}`}
        description="Doplňkový sortiment Vividbooks — žákovské knížky, plakáty a další materiály."
        path={PAGE_PATH}
        image={resolveShareImageUrl({})}
        imageAlt="Další produkty Vividbooks"
        imageWidth={1200}
        imageHeight={630}
      />

      <div className="mb-8">
        <nav className="flex flex-wrap items-center gap-2 text-[13px] text-[#001161]/55 mb-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#ff6a35] transition-colors font-['Fenomen_Sans',sans-serif]"
          >
            Katalog
          </button>
          <span aria-hidden>/</span>
          <span className="font-['Fenomen_Sans',sans-serif] text-[#001161] font-semibold">
            Další produkty
          </span>
        </nav>

        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/90 bg-violet-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-900/90 mb-3">
              <Package className="size-3.5 shrink-0" aria-hidden />
              E-shop
            </div>
            <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[40px] leading-tight">
              Další produkty
            </h1>
            <p className="mt-2 max-w-xl font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/65">
              Vyberte kategorii nebo prohlédněte celý sortiment doplňkových materiálů.
            </p>
          </div>
        </div>
      </div>

      {isLoading && products.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#001161] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : allMerch.length === 0 ? (
        <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/50 text-center py-16">
          Zatím zde nemáme žádné položky. Vraťte se prosím později.
        </p>
      ) : (
        <>
          {/* Dlaždice kategorií */}
          {browse === 'all' ? (
            <section className="mb-10">
              <h2 className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-wider text-[#001161]/40 mb-3">
                Kategorie
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {sortedCategories.map((cat) => {
                  const n = categoryCounts.get(cat) ?? 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => goCategory(cat)}
                      className="text-left rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-violet-300 hover:shadow-md transition-all font-['Fenomen_Sans',sans-serif]"
                    >
                      <p className="text-[15px] font-bold text-[#001161] leading-snug line-clamp-2">{cat}</p>
                      <p className="text-[12px] text-[#001161]/45 mt-1">{n} {n === 1 ? 'produkt' : n < 5 ? 'produkty' : 'produktů'}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => (browse.subcategory ? goCategory(browse.category) : goAll())}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-[#001161] hover:bg-gray-50 font-['Fenomen_Sans',sans-serif]"
                >
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  {browse.subcategory ? 'Zpět do skupiny' : 'Všechny kategorie'}
                </button>
              </div>

              {sortedSubs.length > 0 ? (
                <>
                  <h2 className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-wider text-[#001161]/40 mb-3">
                    Podkategorie — {browse.category}
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <button
                      type="button"
                      onClick={() => goCategory(browse.category)}
                      className={`px-4 py-2 rounded-full text-[13px] font-bold font-['Fenomen_Sans',sans-serif] transition-colors ${
                        !browse.subcategory
                          ? 'bg-[#001161] text-white'
                          : 'bg-gray-100 text-[#001161] hover:bg-gray-200'
                      }`}
                    >
                      Vše ve skupině
                    </button>
                    {sortedSubs.map((sub) => {
                      const n = subCounts.get(sub) ?? 0;
                      const active = browse.subcategory === sub;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => goSub(browse.category, sub)}
                          className={`px-4 py-2 rounded-full text-[13px] font-bold font-['Fenomen_Sans',sans-serif] transition-colors ${
                            active
                              ? 'bg-violet-600 text-white'
                              : 'bg-violet-50 text-violet-900 hover:bg-violet-100'
                          }`}
                        >
                          {sub}
                          <span className="opacity-60 font-normal ml-1">({n})</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </section>
          )}

          <section>
            <h2 className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-wider text-[#001161]/40 mb-4">
              Produkty
              {browse !== 'all' && !browse.subcategory && sortedSubs.length === 0 ? (
                <span className="font-normal normal-case text-[#001161]/35"> — {browse.category}</span>
              ) : null}
            </h2>
            {visibleProducts.length === 0 ? (
              <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/45 py-8 text-center">
                V tomto výběru zatím nic není.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {visibleProducts.map((p) => (
                  <UnifiedBookCard
                    key={p.id}
                    book={p}
                    onClick={() => navigate(`/produkt/${encodeURIComponent(p.id)}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default OtherProductsPage;
