import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Loader2, Minus, Package, Plus, ShoppingCart } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useProducts } from '../contexts/ProductsContext';
import { useCart } from '../contexts/CartContext';
import {
  allocateSubjectBundleQuantities,
  buildBundleCartLines,
  bundleCatalogListSumHaler,
  getNxPlusSubjectSlotCounts,
  productsEligibleForSubjectBundle,
  stripBundleAdminBoilerplate,
  subjectBundleQtySummary,
  subjectBundleQuantitiesRawCatalogSumHaler,
  subjectBundleSelectionPaidListSumHaler,
  bundleIsNxPlusOneSubject,
  type ProductBundleRecord,
} from '../utils/bundlePricing';
import { getProductUnitPriceInHaler } from './cartUpsellUtils';
import { BookCoverThumb } from './checkout/BookCoverThumb';
import { SEOHead } from './SEOHead';
import { buildOgImageAlt, resolveShareImageUrl } from '../utils/ogImage';
import { productDetailPath } from '../utils/slugify';
import {
  matchSchoolSubjectKeysFromCategory,
  mergeSchoolOrderDraft,
  sanitizeSubjectBundleSelections,
} from '../utils/schoolOrderDraft';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/product-bundles`;

function formatKc(haler: number): string {
  return `${(haler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function uzavreneSadyText(pocetSad: number): string {
  if (pocetSad <= 0) return '';
  if (pocetSad === 1) return '1× uzavřená sada';
  if (pocetSad >= 2 && pocetSad <= 4) return `${pocetSad}× uzavřené sady`;
  return `${pocetSad}× uzavřených sad`;
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
  /** Počty kusů u `nx_plus_one_subject` (productId → ks). */
  const [subjectQtyById, setSubjectQtyById] = useState<Record<string, number>>({});

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

  const isSubjectBundle = bundle ? bundleIsNxPlusOneSubject(bundle) : false;
  const subjectSlots = useMemo(() => (bundle ? getNxPlusSubjectSlotCounts(bundle) : null), [bundle]);

  useEffect(() => {
    setSubjectQtyById({});
  }, [bundle?.id]);

  const resolvedProducts = useMemo(() => {
    if (!bundle) return [];
    return (bundle.productIds || [])
      .map((id) => products.find((p) => String(p.id) === String(id)))
      .filter(Boolean) as any[];
  }, [bundle, products]);

  const eligibleSubjectProducts = useMemo(() => {
    if (!bundle || !isSubjectBundle) return [];
    const list = productsEligibleForSubjectBundle(bundle, products);
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'cs'));
  }, [bundle, products, isSubjectBundle]);

  const listTotalHaler = useMemo(
    () => (bundle ? bundleCatalogListSumHaler(bundle, products) : 0),
    [bundle, products],
  );

  const freeIdSet = useMemo(() => new Set<string>(), []);

  const subjectQtySummary = useMemo(
    () => (bundle && isSubjectBundle ? subjectBundleQtySummary(bundle, subjectQtyById) : null),
    [bundle, isSubjectBundle, subjectQtyById],
  );

  const subjectPaidListHaler = useMemo(() => {
    if (!bundle || !isSubjectBundle) return 0;
    return subjectBundleSelectionPaidListSumHaler(products, bundle, subjectQtyById);
  }, [bundle, isSubjectBundle, products, subjectQtyById]);

  const subjectRawCatalogHaler = useMemo(
    () => subjectBundleQuantitiesRawCatalogSumHaler(products, subjectQtyById),
    [products, subjectQtyById],
  );

  /** Per‑titul: bonus 10+1 platí samostatně pro každý titul, takže globální „rozpracovaná sada"
   *  jako u pooled výpočtu nemá smysl. Souhrnné údaje se počítají z `subjectQtySummary` a
   *  případné upozornění „chybí N ks u některého titulu" se zobrazuje jen jako prostý hint. */

  const bundleShareCategory = (bundle?.bundleSubjectLabels?.[0]
    || resolvedProducts[0]?.category) as string | undefined;

  const bundleDescPublic = useMemo(
    () => stripBundleAdminBoilerplate(bundle?.description),
    [bundle?.description],
  );

  const adjustSubjectQty = (productId: string, delta: number) => {
    setSubjectQtyById((prev) => {
      const cur = prev[productId] ?? 0;
      const next = Math.max(0, Math.floor(cur + delta));
      const copy = { ...prev };
      if (next <= 0) delete copy[productId];
      else copy[productId] = next;
      return copy;
    });
  };

  const setSubjectQtyFromInput = (productId: string, raw: string) => {
    if (raw === '') {
      setSubjectQtyById((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
      return;
    }
    const n = Math.max(0, Math.floor(Number(raw)));
    setSubjectQtyById((prev) => {
      const copy = { ...prev };
      if (n <= 0) delete copy[productId];
      else copy[productId] = n;
      return copy;
    });
  };

  const handleAddBundle = () => {
    if (!bundle || productsLoading || !products.length) return;
    if (isSubjectBundle) {
      if (!ready) return;
      const cleanedMap = sanitizeSubjectBundleSelections({ [bundle.id]: subjectQtyById });
      const cleaned = cleanedMap[bundle.id];
      if (!cleaned || Object.keys(cleaned).length === 0) return;
      const subjects = new Set<string>();
      for (const label of bundle.bundleSubjectLabels || []) {
        for (const k of matchSchoolSubjectKeysFromCategory(label)) subjects.add(k);
      }
      for (const rawId of Object.keys(subjectQtyById)) {
        const p = products.find((x) => String(x.id) === String(rawId));
        for (const k of matchSchoolSubjectKeysFromCategory(p?.category)) subjects.add(k);
      }
      mergeSchoolOrderDraft(
        {
          selTypes: ['workbook'],
          ...(subjects.size > 0 ? { selSubjects: Array.from(subjects) } : {}),
        },
        { replaceBundleQuantities: true, replaceSubjectBundleSelections: true },
      );
      setAdding(true);
      try {
        navigate('/objednat?step=2', {
          state: { addSchoolSubjectBundle: { bundleId: bundle.id, quantities: { ...subjectQtyById } } },
        });
      } finally {
        setAdding(false);
      }
      return;
    }
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

  const hideCatalogSavingsLine = bundle ? bundleIsNxPlusOneSubject(bundle) : false;

  const readyFixed =
    !loading
    && !productsLoading
    && bundle
    && !isSubjectBundle
    && resolvedProducts.length > 0
    && resolvedProducts.length === (bundle.productIds || []).length;

  const readySubject =
    !loading
    && !productsLoading
    && bundle
    && isSubjectBundle
    && !!subjectSlots
    && subjectSlots.total > 0
    && allocateSubjectBundleQuantities(products, bundle, subjectQtyById) !== null;

  const ready = isSubjectBundle ? readySubject : readyFixed;

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
                <p className="text-[11px] uppercase tracking-wide text-[#001161]/40 font-bold">
                  {isSubjectBundle ? 'K platbě (placené tituly)' : 'Cena balíčku'}
                </p>
                {isSubjectBundle ? (
                  <>
                    <p className="text-[28px] font-bold text-[#001161] font-['Fenomen_Sans'] m-0">
                      {subjectQtySummary?.isValidMultiple && subjectPaidListHaler > 0
                        ? formatKc(subjectPaidListHaler)
                        : subjectQtySummary && subjectQtySummary.total > 0 && !subjectQtySummary.isValidMultiple
                          ? formatKc(subjectRawCatalogHaler)
                          : '—'}
                    </p>
                    <p className="text-[13px] text-[#001161]/55 mt-1 m-0">
                      {subjectQtySummary?.isValidMultiple && subjectPaidListHaler > 0 ? (
                        <>
                          Zaplatíte za{' '}
                          {subjectQtySummary.paidPieces}
                          {' '}
                          ks; v košíku máte navíc
                          {' '}
                          <span className="text-emerald-800 font-semibold">
                            {subjectQtySummary.freePieces}
                            {' '}
                            ks zdarma
                          </span>
                          {' '}
                          (nejlevnější kusy v sestavě).
                          {subjectRawCatalogHaler > subjectPaidListHaler ? (
                            <>
                              {' '}
                              Oproti katalogu bez akce:
                              {' '}
                              <span className="text-emerald-800 font-semibold">
                                −
                                {formatKc(subjectRawCatalogHaler - subjectPaidListHaler)}
                              </span>
                              .
                            </>
                          ) : null}
                        </>
                      ) : subjectQtySummary && subjectQtySummary.total > 0 ? (
                        <>
                          Mezisoučet bez akce (celý katalog za vybrané kusy). Po doplnění na násobek
                          {' '}
                          {subjectQtySummary.setSize}
                          {' '}
                          ks se bonus započítá — chybí
                          {' '}
                          {subjectQtySummary.needsForNextSet}
                          {' '}
                          ks.
                        </>
                      ) : (
                        'Nastavte počty sešitů níže. Cena se dopočítá po dokončení celé akční sady (násobek ks).'
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[28px] font-bold text-[#001161] font-['Fenomen_Sans'] m-0">
                      {formatKc(bundle.bundlePriceHaler || 0)}
                    </p>
                    {!hideCatalogSavingsLine
                      && listTotalHaler > 0
                      && listTotalHaler > (bundle.bundlePriceHaler || 0) && (
                      <p className="text-[13px] text-emerald-700 mt-1 m-0">
                        {`Úspora oproti katalogu: ${formatKc(listTotalHaler - (bundle.bundlePriceHaler || 0))}`}
                      </p>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                disabled={!ready || adding}
                onClick={handleAddBundle}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-[16px] bg-[#001161] hover:bg-[#000a3d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-['Fenomen_Sans'] text-[14px] font-bold transition-all cursor-pointer"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {isSubjectBundle
                  ? 'Přidat do objednávky pro školu'
                  : 'Přidat balíček do košíku'}
              </button>
            </div>

            {isSubjectBundle && subjectQtySummary ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-[20px] border border-[#001161]/12 bg-[#f8f9fc] px-4 py-4 sm:px-5 sm:py-4">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-[#001161]/45 font-bold m-0 mb-1">
                    Celkem kusů
                  </p>
                  <p className="font-['Fenomen_Sans'] text-[32px] sm:text-[36px] font-bold text-[#001161] tabular-nums leading-none m-0">
                    {subjectQtySummary.total}
                  </p>
                  {subjectQtySummary.total === 0 ? (
                    <p className="text-[12px] text-[#001161]/45 mt-2 m-0">Zatím nic nevybráno</p>
                  ) : subjectQtySummary.completeSets > 0 ? (
                    <p className="text-[12px] text-[#001161]/55 mt-2 m-0 leading-snug">
                      {uzavreneSadyText(subjectQtySummary.completeSets)}
                      {' (bonus se počítá samostatně pro každý titul).'}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[#001161]/50 mt-2 m-0 leading-snug">
                      {`Pro bonus potřebujete ${subjectSlots?.total ?? 10} ks jednoho titulu (akce ${subjectSlots?.paid ?? 10}+${subjectSlots?.free ?? 1}).`}
                    </p>
                  )}
                </div>
                <div
                  className={`rounded-[20px] border px-4 py-4 sm:px-5 sm:py-4 ${
                    subjectQtySummary.freePieces > 0
                      ? 'border-emerald-200/90 bg-emerald-50/90'
                      : 'border-[#001161]/10 bg-white'
                  }`}
                >
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-[#065f46]/75 font-bold m-0 mb-1">
                    Zdarma v akci
                    {subjectSlots ? (
                      <span className="font-bold normal-case text-[#065f46]/85">
                        {` (${subjectSlots.paid}+${subjectSlots.free} na titul)`}
                      </span>
                    ) : null}
                  </p>
                  <p className="font-['Fenomen_Sans'] text-[32px] sm:text-[36px] font-bold tabular-nums leading-none m-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                    <span
                      className={
                        subjectQtySummary.freePieces === 0
                          ? 'text-[#001161]/30'
                          : 'text-emerald-800'
                      }
                    >
                      {subjectQtySummary.freePieces}
                    </span>
                  </p>
                  {subjectQtySummary.needsForNextSet > 0 ? (
                    <p className="text-[12px] text-[#065f46] mt-2 m-0 leading-snug">
                      {`U jednoho z titulů chybí ${subjectQtySummary.needsForNextSet} ks do dalšího bonusu.`}
                    </p>
                  ) : subjectQtySummary.freePieces > 0 ? (
                    <p className="text-[12px] text-emerald-900/80 mt-2 m-0">
                      {`Bonus uplatněn pro ${subjectQtySummary.completeSets > 1 ? `${subjectQtySummary.completeSets} sady` : '1 sadu'} u jednoho/jednotlivých titulů — můžete přidat do košíku.`}
                    </p>
                  ) : subjectQtySummary.total === 0 ? (
                    <p className="text-[12px] text-[#001161]/45 mt-2 m-0">Po dokončení sady jednoho titulu zde uvidíte bonus.</p>
                  ) : (
                    <p className="text-[12px] text-[#001161]/45 mt-2 m-0 leading-snug">
                      {`Bonus se počítá samostatně pro každý titul. Vyberte ${subjectSlots?.total ?? 10} ks stejného titulu.`}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {!ready && !productsLoading && !isSubjectBundle && (
              <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                Některé produkty z balíčku nejsou v katalogu nebo nejdou objednat. Zkuste obnovit stránku za chvíli.
              </p>
            )}

            {isSubjectBundle && subjectSlots && eligibleSubjectProducts.length === 0 && !productsLoading && (
              <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                Pro tento předmět zatím nejsou v katalogu žádné objednatelné produkty. Zkuste to později.
              </p>
            )}

            {isSubjectBundle && subjectSlots ? (
              <ul className="divide-y divide-[#001161]/08">
                {eligibleSubjectProducts.map((p) => {
                  const id = String(p.id);
                  const qty = subjectQtyById[id] ?? 0;
                  return (
                    <li key={id} className="flex gap-3 items-center px-3 py-2.5">
                      <BookCoverThumb
                        imageUrl={p.image || p.imageUrl}
                        alt={p.name || ''}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={productDetailPath(p, products)}
                          className="font-['Fenomen_Sans'] text-[14px] font-semibold text-[#001161] hover:underline"
                        >
                          {p.name || p.title}
                        </Link>
                        {p.category && (
                          <p className="text-[11px] text-[#001161]/45">{p.category}</p>
                        )}
                        <p className="text-[12px] text-[#001161]/55">
                          {formatKc(getProductUnitPriceInHaler(p))}
                          {qty > 0 ? ` · v sestavě: ${qty} ks` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Odebrat kus"
                          disabled={qty <= 0}
                          onClick={() => adjustSubjectQty(id, -1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#001161]/15 bg-white text-[#001161] disabled:opacity-30 hover:bg-[#001161]/05 cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          aria-label={`Počet kusů — ${p.name || p.title || 'produkt'}`}
                          value={qty}
                          onChange={(e) => setSubjectQtyFromInput(id, e.target.value)}
                          onBlur={(e) => {
                            if (e.target.value === '' || Number.isNaN(Number(e.target.value))) {
                              setSubjectQtyFromInput(id, '0');
                            }
                          }}
                          className="h-9 w-14 shrink-0 rounded-lg border border-[#001161]/15 bg-white px-1 text-center text-[14px] font-bold text-[#001161] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[#001161]/25"
                        />
                        <button
                          type="button"
                          aria-label="Přidat kus"
                          onClick={() => adjustSubjectQty(id, 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#001161] text-white hover:bg-[#000a3d] cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
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
                        to={productDetailPath(p, products)}
                        className="font-['Fenomen_Sans'] text-[15px] font-bold text-[#001161] hover:underline leading-snug"
                      >
                        {p.name || p.title}
                      </Link>
                      {p.category && (
                        <p className="text-[12px] text-[#001161]/45 mt-0.5">{p.category}</p>
                      )}
                      <p className="text-[13px] text-[#001161]/55 mt-1">
                        {freeIdSet.has(String(p.id))
                          ? (
                            <>
                              <span className="text-emerald-800 font-semibold">Zdarma</span>
                              <span className="text-[#001161]/45">
                                {` · katalog ${formatKc(getProductUnitPriceInHaler(p))}`}
                              </span>
                            </>
                          )
                          : `Katalog: ${formatKc(getProductUnitPriceInHaler(p))}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
