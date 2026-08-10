import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  StickyNote,
  X,
} from 'lucide-react';
import { useProducts } from '../../contexts/ProductsContext';
import { publicAnonKey } from '../../utils/supabase/info';
import { edgeFunctionBase } from '../../utils/edgeFunctionBase';
import { fetchSchoolSearchResults } from '../../utils/schoolSearchApi';
import { isDistributorOrderableProduct } from '../../utils/distributorCatalog';
import { checkoutTextInputClass } from '../../utils/formFieldClasses';
import { RouteHydrateFallback } from '../RouteHydrateFallback';
import { SEOHead } from '../SEOHead';

type AccessState = 'checking' | 'granted' | 'denied' | 'unconfigured';

const ICO_PATTERN = /^\d{6,10}$/;

/** Klíč z prvního otevření odkazu — díky němu si distributor může uložit holé `/distributor`. */
const STORED_KEY_NAME = 'vividbooks_distributor_key';

function readStoredKey(): string {
  try {
    return (window.localStorage.getItem(STORED_KEY_NAME) || '').trim();
  } catch {
    return '';
  }
}

function writeStoredKey(key: string) {
  try {
    if (key) window.localStorage.setItem(STORED_KEY_NAME, key);
    else window.localStorage.removeItem(STORED_KEY_NAME);
  } catch {
    /* Soukromý režim / zablokované úložiště — odkaz s `?k=` funguje dál. */
  }
}

function newSubmissionId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function productSortKey(product: any): string {
  return `${String(product?.category || 'Ostatní')}|${String(product?.name || product?.title || '')}`;
}

function productLabel(product: any): string {
  return String(product?.name || product?.title || product?.id || '');
}

/** Hledání bez ohledu na diakritiku a velikost písmen. */
function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function czechTitleWord(count: number): string {
  if (count === 1) return 'titul';
  if (count >= 2 && count <= 4) return 'tituly';
  return 'titulů';
}

/** Názvy firem často končí tečkou („a.s.“) — druhou tečku na konci věty nepřidáváme. */
function confirmationSentence({ orderNumber, companyName }: { orderNumber: string; companyName: string }): string {
  const base = orderNumber ? `Evidujeme ji pod číslem ${orderNumber}` : 'Objednávku jsme přijali';
  const sentence = companyName ? `${base} pro ${companyName}` : base;
  return sentence.endsWith('.') ? sentence : `${sentence}.`;
}

/**
 * Neveřejná objednávka pro distributory (`/distributor?k=<klíč>`).
 *
 * Klíč z odkazu se po ověření uloží do prohlížeče, takže distributor si může uložit
 * jen `/distributor`. Formulář sbírá jen IČO, počty kusů a poznámku — ceny se nezobrazují
 * a e‑maily se neposílají. Odeslání zakládá objednávku se `source='distributor'`
 * a deal v Pipedrive pipeline 8.
 */
export function DistributorOrderPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = (searchParams.get('k') || '').trim();
  const token = tokenFromUrl || readStoredKey();
  const { products, isLoading: productsLoading } = useProducts();

  const [access, setAccess] = useState<AccessState>('checking');
  const [ico, setIco] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLoading, setCompanyLoading] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<{ orderNumber: string; companyName: string } | null>(null);
  const submissionIdRef = useRef(newSubmissionId());

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setAccess('denied');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${edgeFunctionBase()}/distributor/access?k=${encodeURIComponent(token)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (cancelled) return;
        if (res.ok) {
          setAccess('granted');
          writeStoredKey(token);
        } else if (res.status === 503) {
          setAccess('unconfigured');
        } else {
          setAccess('denied');
          /** Klíč mezitím vypršel / byl změněn — ať uložená kopie neblokuje nový odkaz. */
          writeStoredKey('');
        }
      } catch {
        if (!cancelled) setAccess('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /** Název firmy podle IČO (CSV škol / ARES) — jen pro kontrolu, do objednávky ho doplní server. */
  useEffect(() => {
    const value = ico.replace(/\s/g, '');
    if (!ICO_PATTERN.test(value)) {
      setCompanyName('');
      setCompanyLoading(false);
      return;
    }
    const controller = new AbortController();
    setCompanyLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await fetchSchoolSearchResults({ ico: value }, { signal: controller.signal });
        setCompanyName(results[0]?.name || '');
      } catch {
        setCompanyName('');
      } finally {
        setCompanyLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      setCompanyLoading(false);
    };
  }, [ico]);

  const catalog = useMemo(() => {
    const orderable = products.filter(isDistributorOrderableProduct);
    orderable.sort((a, b) => productSortKey(a).localeCompare(productSortKey(b), 'cs'));
    const groups = new Map<string, any[]>();
    for (const product of orderable) {
      const category = String(product.category || '').trim() || 'Ostatní';
      const list = groups.get(category) || [];
      list.push(product);
      groups.set(category, list);
    }
    return [...groups.entries()];
  }, [products]);

  const searchTerm = normalizeForSearch(search);
  /** Kategorie s produkty odpovídajícími hledání; bez hledání celý katalog. */
  const visibleCatalog = useMemo(() => {
    if (!searchTerm) return catalog;
    return catalog
      .map(([category, items]) => {
        const categoryMatches = normalizeForSearch(category).includes(searchTerm);
        const matched = categoryMatches
          ? items
          : items.filter((p: any) => normalizeForSearch(productLabel(p)).includes(searchTerm));
        return [category, matched] as [string, any[]];
      })
      .filter(([, items]) => items.length > 0);
  }, [catalog, searchTerm]);

  const productById = useMemo(() => {
    const map = new Map<string, any>();
    for (const [, items] of catalog) {
      for (const product of items) map.set(String(product.id), product);
    }
    return map;
  }, [catalog]);

  const selectedLines = useMemo(
    () => Object.entries(quantities).filter(([, qty]) => qty > 0),
    [quantities],
  );
  const totalPieces = selectedLines.reduce((sum, [, qty]) => sum + qty, 0);

  /** Počet kusů v kategorii — vedle názvu ve sbalené hlavičce. */
  const piecesByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [category, items] of catalog) {
      const sum = items.reduce((total: number, p: any) => total + (quantities[String(p.id)] || 0), 0);
      if (sum > 0) counts.set(category, sum);
    }
    return counts;
  }, [catalog, quantities]);

  const toggleCategory = useCallback((category: string) => {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setQuantities((prev) => {
      const next = { ...prev };
      const safe = Math.max(0, Math.min(10000, Math.floor(quantity) || 0));
      if (safe === 0) delete next[productId];
      else next[productId] = safe;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const icoValue = ico.replace(/\s/g, '');
    if (!ICO_PATTERN.test(icoValue)) {
      setError('Zadejte platné IČO (6–10 číslic).');
      return;
    }
    if (selectedLines.length === 0) {
      setError('Vyberte alespoň jeden produkt.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${edgeFunctionBase()}/distributor/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          /** Klíč jde v těle, ne ve vlastní hlavičce — ta by u cross-origin POSTu vyžadovala
           *  povolení v CORS preflightu a prohlížeč by odeslání zablokoval. */
          token,
          ico: icoValue,
          note,
          submissionId: submissionIdRef.current,
          items: selectedLines.map(([productId, quantity]) => ({ productId, quantity })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        orderNumber?: string;
        companyName?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.');
        return;
      }
      setSubmitted({
        orderNumber: data.orderNumber || '',
        companyName: data.companyName || companyName,
      });
      submissionIdRef.current = newSubmissionId();
    } catch {
      setError('Objednávku se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.');
    } finally {
      setSubmitting(false);
    }
  }, [companyName, ico, note, selectedLines, token]);

  const startNewOrder = useCallback(() => {
    setSubmitted(null);
    setQuantities({});
    setNote('');
    setError('');
  }, []);

  /**
   * Stejný fullscreen spinner jako lazy-route hydrateFallback / App Suspense —
   * ať při otevření neproblikne text („Načítám…“ / „Ověřujeme…“) před animací
   * a ať se formulář neukáže dřív, než je hotové ověření i katalog.
   */
  if (access === 'checking' || (access === 'granted' && productsLoading && catalog.length === 0)) {
    return <RouteHydrateFallback />;
  }

  if (access !== 'granted') {
    return (
      <StatusScreen>
        <h1 className="text-[20px] font-bold text-[#001161]">
          {access === 'unconfigured' ? 'Objednávkový formulář zatím není aktivní' : 'Odkaz není platný'}
        </h1>
        <p className="max-w-md text-center text-[14px] text-[#001161]/70">
          {access === 'unconfigured'
            ? 'Kontaktujte prosím svého obchodního zástupce Vividbooks.'
            : 'Použijte prosím odkaz, který jste dostali od Vividbooks. Bez platného klíče formulář nelze otevřít.'}
        </p>
      </StatusScreen>
    );
  }

  if (submitted) {
    return (
      <StatusScreen>
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
          <Check className="size-7 text-emerald-600" />
        </div>
        <h1 className="text-[22px] font-bold text-[#001161]">Objednávka odeslána</h1>
        <p className="max-w-md text-center text-[14px] text-[#001161]/70">
          {`${confirmationSentence(submitted)} Ozve se vám váš obchodní zástupce.`}
        </p>
        <button
          type="button"
          onClick={startNewOrder}
          className="rounded-full bg-[#001161] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#03025a]"
        >
          Vytvořit další objednávku
        </button>
      </StatusScreen>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6fb] py-10 px-4">
      <SEOHead title="Objednávka pro distributory" path="/distributor" noIndex />
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#5b4fd8]">Vividbooks</p>
          <h1 className="mt-1 text-[28px] font-bold text-[#001161]">Objednávka pro distributory</h1>
          <p className="mt-2 text-[14px] text-[#001161]/70">
            Vyplňte IČO své společnosti, zvolte počty kusů a objednávku odešlete. Ceny a dopravu s vámi
            dořeší obchodní zástupce.
          </p>
        </header>

        <section className="mb-4 rounded-[20px] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#001161]">
            <Building2 className="size-4" />
            IČO společnosti
          </div>
          <input
            value={ico}
            onChange={(e) => setIco(e.target.value.replace(/[^\d\s]/g, ''))}
            inputMode="numeric"
            placeholder="12345678"
            className={checkoutTextInputClass(false)}
          />
          <div className="mt-2 min-h-[20px] text-[13px] text-[#001161]/70">
            {companyLoading && 'Hledáme společnost…'}
            {!companyLoading && companyName && `Nalezeno: ${companyName}`}
            {!companyLoading && !companyName && ICO_PATTERN.test(ico.replace(/\s/g, '')) &&
              'Společnost jsme v rejstříku nenašli — objednávku můžete přesto odeslat.'}
          </div>
        </section>

        <section className="mb-4 rounded-[20px] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#001161]">
            <Package className="size-4" />
            Produkty
            {totalPieces > 0 && (
              <span className="rounded-full bg-[#001161]/10 px-2 py-0.5 text-[12px] font-bold text-[#001161]">
                {`${totalPieces} ks`}
              </span>
            )}
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#001161]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat produkt…"
              aria-label="Hledat produkt"
              className="w-full rounded-[14px] border border-[#001161]/10 bg-white py-3 pl-11 pr-10 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
            />
            {search && (
              <button
                type="button"
                aria-label="Zrušit hledání"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[#001161]/40 hover:bg-[#001161]/5 hover:text-[#001161]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {catalog.length === 0 ? (
            <p className="py-6 text-[14px] text-[#001161]/60">Katalog je momentálně prázdný.</p>
          ) : visibleCatalog.length === 0 ? (
            <p className="py-6 text-[14px] text-[#001161]/60">{`Hledání „${search}" nic nenašlo.`}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleCatalog.map(([category, items]) => {
                /** Při hledání jsou nalezené kategorie vždy rozbalené, jinak si je uživatel otevírá sám. */
                const isOpen = searchTerm ? true : openCategories[category] === true;
                const pieces = piecesByCategory.get(category) || 0;
                return (
                  <div key={category} className="rounded-[14px] border border-[#001161]/10">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left"
                    >
                      <ChevronDown
                        className={`size-4 shrink-0 text-[#001161]/50 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                      />
                      <span className="text-[14px] font-bold text-[#001161]">{category}</span>
                      <span className="text-[12px] text-[#001161]/40">{`${items.length}`}</span>
                      {pieces > 0 && (
                        <span className="ml-auto rounded-full bg-[#001161]/10 px-2 py-0.5 text-[12px] font-bold text-[#001161]">
                          {`${pieces} ks`}
                        </span>
                      )}
                    </button>
                    {isOpen && (
                      <ul className="flex flex-col divide-y divide-[#001161]/5 border-t border-[#001161]/10 px-4">
                        {items.map((product: any) => {
                          const id = String(product.id);
                          const qty = quantities[id] || 0;
                          return (
                            <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                              <span className="text-[14px] text-[#001161]">{productLabel(product)}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  aria-label={`Ubrat ${productLabel(product)}`}
                                  onClick={() => setQuantity(id, qty - 1)}
                                  disabled={qty === 0}
                                  className="flex size-8 items-center justify-center rounded-full border border-[#001161]/10 text-[#001161] disabled:opacity-30"
                                >
                                  <Minus className="size-3.5" />
                                </button>
                                <input
                                  value={qty === 0 ? '' : qty}
                                  onChange={(e) => setQuantity(id, Number(e.target.value.replace(/\D/g, '')))}
                                  inputMode="numeric"
                                  placeholder="0"
                                  aria-label={`Počet kusů — ${productLabel(product)}`}
                                  className="w-14 rounded-[10px] border border-[#001161]/10 px-2 py-1.5 text-center text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8]"
                                />
                                <button
                                  type="button"
                                  aria-label={`Přidat ${productLabel(product)}`}
                                  onClick={() => setQuantity(id, qty + 1)}
                                  className="flex size-8 items-center justify-center rounded-full border border-[#001161]/10 text-[#001161]"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-4 rounded-[20px] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#001161]">
            <StickyNote className="size-4" />
            Poznámka k objednávce
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder="Termín dodání, kontaktní osoba, číslo vaší objednávky…"
            className="w-full resize-y rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8] focus:ring-2 focus:ring-[#5b4fd8]/15"
          />
        </section>

        <section className="mb-4 rounded-[20px] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#001161]">
            <ClipboardList className="size-4" />
            Souhrn objednávky
          </div>
          {selectedLines.length === 0 ? (
            <p className="text-[14px] text-[#001161]/60">Zatím jste nevybrali žádný produkt.</p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-[#001161]/5">
                {selectedLines.map(([productId, qty]) => (
                  <li key={productId} className="flex items-center gap-3 py-2.5">
                    <span className="flex-1 text-[14px] text-[#001161]">
                      {productLabel(productById.get(productId)) || productId}
                    </span>
                    <span className="text-[14px] font-bold text-[#001161]">{`${qty} ks`}</span>
                    <button
                      type="button"
                      aria-label={`Odebrat ${productLabel(productById.get(productId)) || productId}`}
                      onClick={() => setQuantity(productId, 0)}
                      className="flex size-7 items-center justify-center rounded-full text-[#001161]/40 hover:bg-[#001161]/5 hover:text-[#001161]"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-[#001161]/10 pt-3 text-[14px] font-bold text-[#001161]">
                <span>{`Celkem ${selectedLines.length} ${czechTitleWord(selectedLines.length)}`}</span>
                <span>{`${totalPieces} ks`}</span>
              </div>
            </>
          )}
        </section>

        {error && (
          <p className="mb-3 rounded-[14px] bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#001161] px-6 py-4 text-[15px] font-bold text-white hover:bg-[#03025a] disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Odesíláme…' : 'Odeslat objednávku'}
        </button>
      </div>
    </div>
  );
}

function StatusScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f6fb] px-4">
      <SEOHead title="Objednávka pro distributory" path="/distributor" noIndex />
      {children}
    </div>
  );
}

export default DistributorOrderPage;
