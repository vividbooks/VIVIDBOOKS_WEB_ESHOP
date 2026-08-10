import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Building2, Check, Loader2, Minus, Package, Plus, StickyNote } from 'lucide-react';
import { useProducts } from '../../contexts/ProductsContext';
import { publicAnonKey } from '../../utils/supabase/info';
import { edgeFunctionBase } from '../../utils/edgeFunctionBase';
import { fetchSchoolSearchResults } from '../../utils/schoolSearchApi';
import { isDistributorOrderableProduct } from '../../utils/distributorCatalog';
import { checkoutTextInputClass } from '../../utils/formFieldClasses';
import { SEOHead } from '../SEOHead';

type AccessState = 'checking' | 'granted' | 'denied' | 'unconfigured';

const ICO_PATTERN = /^\d{6,10}$/;

function newSubmissionId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function productSortKey(product: any): string {
  return `${String(product?.category || 'Ostatní')}|${String(product?.name || product?.title || '')}`;
}

/**
 * Neveřejná objednávka pro distributory (`/distributor/objednavka?k=<klíč>`).
 *
 * Formulář sbírá jen IČO, počty kusů a poznámku — ceny se nezobrazují a e‑maily se neposílají.
 * Odeslání zakládá objednávku se `source='distributor'` a deal v Pipedrive pipeline 8.
 */
export function DistributorOrderPage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('k') || '').trim();
  const { products, isLoading: productsLoading } = useProducts();

  const [access, setAccess] = useState<AccessState>('checking');
  const [ico, setIco] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLoading, setCompanyLoading] = useState(false);
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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
        if (res.ok) setAccess('granted');
        else if (res.status === 503) setAccess('unconfigured');
        else setAccess('denied');
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

  const selectedLines = useMemo(
    () => Object.entries(quantities).filter(([, qty]) => qty > 0),
    [quantities],
  );
  const totalPieces = selectedLines.reduce((sum, [, qty]) => sum + qty, 0);

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
          'X-Distributor-Token': token,
        },
        body: JSON.stringify({
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

  if (access === 'checking') {
    return (
      <StatusScreen>
        <Loader2 className="size-6 animate-spin text-[#001161]" />
        <p className="text-[14px] text-[#001161]/70">Ověřujeme odkaz…</p>
      </StatusScreen>
    );
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
          {submitted.orderNumber
            ? `Evidujeme ji pod číslem ${submitted.orderNumber}`
            : 'Objednávku jsme přijali'}
          {submitted.companyName ? ` pro ${submitted.companyName}.` : '.'}
          {' Ozve se vám váš obchodní zástupce.'}
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
      <SEOHead title="Objednávka pro distributory" path="/distributor/objednavka" noIndex />
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

          {productsLoading && catalog.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-[14px] text-[#001161]/60">
              <Loader2 className="size-4 animate-spin" />
              Načítáme katalog…
            </div>
          ) : catalog.length === 0 ? (
            <p className="py-6 text-[14px] text-[#001161]/60">Katalog je momentálně prázdný.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {catalog.map(([category, items]) => (
                <div key={category}>
                  <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#001161]/50">
                    {category}
                  </h2>
                  <ul className="flex flex-col divide-y divide-[#001161]/5">
                    {items.map((product: any) => {
                      const id = String(product.id);
                      const qty = quantities[id] || 0;
                      return (
                        <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="text-[14px] text-[#001161]">
                            {product.name || product.title || id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Ubrat ${product.name || id}`}
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
                              aria-label={`Počet kusů — ${product.name || id}`}
                              className="w-14 rounded-[10px] border border-[#001161]/10 px-2 py-1.5 text-center text-[14px] text-[#001161] outline-none focus:border-[#5b4fd8]"
                            />
                            <button
                              type="button"
                              aria-label={`Přidat ${product.name || id}`}
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
                </div>
              ))}
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
      {children}
    </div>
  );
}

export default DistributorOrderPage;
