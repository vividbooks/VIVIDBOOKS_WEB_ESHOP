import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { fetchProducts } from '../../utils/adminApi';
import { getProductImage, getProductVariantId, getProductUnitPriceInHaler } from '../cartUpsellUtils';
import { BookCoverThumb } from '../checkout/BookCoverThumb';
import {
  allocateBundleUnitPrices,
  productBundleSubjectLabel,
  type ProductBundleKind,
  type ProductBundleRecord,
} from '../../utils/bundlePricing';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

function parseKcInputToHaler(raw: string): number {
  const n = String(raw)
    .replace(/\s/g, '')
    .replace(/Kč/gi, '')
    .replace(',', '.');
  const v = Number.parseFloat(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v * 100);
}

function formatKcFromHaler(h: number): string {
  return (h / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const OTHER_SUBJECT_LABEL = 'Ostatní';

/** NFC + bez diakritiky — spolehlivější hledání (např. žá → žákovské). */
function searchFold(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function productSearchHaystack(p: any): string {
  const parts = [
    p.name,
    p.title,
    p.category,
    p.description,
    p.id,
    p.merchCategory,
    p.merchSubcategory,
    p.note,
    p.isbn,
  ];
  return searchFold(parts.filter((x) => x != null && String(x).trim() !== '').join(' \n '));
}

/** URL dalších fotek z `images` bez opakování hlavního obrázku. */
function productExtraGalleryUrls(p: any, max = 5): string[] {
  const main = (getProductImage(p) || '').trim();
  const raw = Array.isArray(p.images) ? p.images : [];
  const seen = new Set<string>();
  if (main) seen.add(main);
  const out: string[] = [];
  for (const u of raw) {
    if (typeof u !== 'string') continue;
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function BundleGalleryStrip({ urls, compact }: { urls: string[]; compact?: boolean }) {
  if (!urls.length) return null;
  const size = compact ? 'h-8 w-8' : 'h-9 w-9';
  return (
    <div
      className="flex flex-wrap gap-0.5"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {urls.map((u) => (
        <a
          key={u}
          href={u}
          target="_blank"
          rel="noreferrer"
          title="Otevřít obrázek"
          className={`${size} shrink-0 rounded-md border border-gray-200 overflow-hidden bg-gray-50 hover:ring-2 hover:ring-[#001161]/25`}
          onClick={(e) => e.stopPropagation()}
        >
          <img src={u} alt="" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

export default function ProductBundlesPage() {
  const [bundles, setBundles] = useState<ProductBundleRecord[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  /** Prázdné = všechny předměty; jinak OR mezi vybranými štítky (např. Matematika, Fyzika). */
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriceKc, setFormPriceKc] = useState('');
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);
  const [formValidFrom, setFormValidFrom] = useState('');
  const [formValidTo, setFormValidTo] = useState('');
  const [formBundleKind, setFormBundleKind] = useState<ProductBundleKind>('standard');
  const [formFreeItemCount, setFormFreeItemCount] = useState(0);
  /** Jen `nx_plus_one_subject`: OR mezi předměty (stejné štítky jako filtr katalogu). */
  const [formBundleSubjects, setFormBundleSubjects] = useState<string[]>([]);
  const [formPaidItemCount, setFormPaidItemCount] = useState(10);
  const [formProductCardBadgeEnabled, setFormProductCardBadgeEnabled] = useState(false);
  const [formProductCardBadgeText, setFormProductCardBadgeText] = useState('');

  const loadAll = useCallback(async (options?: { showLoading?: boolean }): Promise<ProductBundleRecord[]> => {
    const showLoading = options?.showLoading !== false;
    if (showLoading) setLoading(true);
    try {
      const [bRes, plist] = await Promise.all([
        fetch(`${API_BASE}/admin/product-bundles`, { headers: HEADERS }),
        fetchProducts(),
      ]);
      if (!bRes.ok) throw new Error('Balíčky se nepodařilo načíst.');
      const bJson = await bRes.json();
      const list: ProductBundleRecord[] = Array.isArray(bJson.bundles) ? bJson.bundles : [];
      setBundles(list);
      setProducts(plist);
      return list;
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Chyba načítání');
      return [];
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const subjectFilterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (!getProductVariantId(p)) continue;
      set.add(productBundleSubjectLabel(p));
    }
    return [...set].sort((a, b) => {
      if (a === OTHER_SUBJECT_LABEL) return 1;
      if (b === OTHER_SUBJECT_LABEL) return -1;
      return a.localeCompare(b, 'cs');
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    const qRaw = search.trim().toLowerCase();
    const qFold = qRaw ? searchFold(search.trim()) : '';
    return products.filter((p) => {
      if (!getProductVariantId(p)) return false;
      if (subjectFilters.length > 0 && !subjectFilters.includes(productBundleSubjectLabel(p))) return false;
      if (!qRaw) return true;
      if (productSearchHaystack(p).includes(qFold)) return true;
      const name = String(p.name || p.title || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const id = String(p.id || '').toLowerCase();
      return name.includes(qRaw) || cat.includes(qRaw) || id.includes(qRaw);
    });
  }, [products, search, subjectFilters]);

  const toggleSubjectFilter = (label: string) => {
    setSubjectFilters((prev) => (
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    ));
  };

  const toggleFormBundleSubject = (label: string) => {
    setFormBundleSubjects((prev) => (
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    ));
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriceKc('');
    setFormProductIds([]);
    setFormActive(true);
    setFormValidFrom('');
    setFormValidTo('');
    setFormBundleKind('standard');
    setFormFreeItemCount(0);
    setFormBundleSubjects([]);
    setFormPaidItemCount(10);
    setFormProductCardBadgeEnabled(false);
    setFormProductCardBadgeText('');
    setEditingId(null);
    setCreating(false);
    setSubjectFilters([]);
    setSearch('');
  };

  const startEdit = (b: ProductBundleRecord) => {
    setEditingId(b.id);
    setCreating(false);
    setFormTitle(b.title || '');
    setFormDescription(b.description || '');
    setFormPriceKc(
      b.bundleKind === 'nx_plus_one_subject' ? '' : formatKcFromHaler(b.bundlePriceHaler || 0),
    );
    setFormProductIds([...(b.productIds || [])]);
    setFormActive(b.isActive !== false);
    setFormValidFrom(b.validFrom ? b.validFrom.slice(0, 10) : '');
    setFormValidTo(b.validTo ? b.validTo.slice(0, 10) : '');
    const legacyKind = (b as ProductBundleRecord & { bundleKind?: string }).bundleKind;
    if (legacyKind === 'nx_plus_one') {
      toast.message('Zastaralý typ „pevné tituly N+zdarma“', {
        description: 'Balíček je teď upravte jako standardní nebo jako akci podle předmětu a znovu uložte.',
      });
    }
    if (b.bundleKind === 'nx_plus_one_subject') {
      setFormBundleKind('nx_plus_one_subject');
      setFormBundleSubjects([...(b.bundleSubjectLabels || [])]);
      setFormPaidItemCount(
        typeof b.paidItemCount === 'number' && b.paidItemCount > 0
          ? Math.floor(b.paidItemCount)
          : 10,
      );
      setFormFreeItemCount(
        typeof b.freeItemCount === 'number' && b.freeItemCount > 0
          ? Math.floor(b.freeItemCount)
          : 1,
      );
      setFormProductIds([]);
    } else {
      setFormBundleKind('standard');
      setFormBundleSubjects([]);
      setFormPaidItemCount(10);
      setFormFreeItemCount(0);
    }
    setFormProductCardBadgeEnabled(Boolean(b.productCardBadgeEnabled));
    setFormProductCardBadgeText(typeof b.productCardBadgeText === 'string' ? b.productCardBadgeText : '');
  };

  const nxSlices = useMemo(() => {
    if (formBundleKind === 'nx_plus_one_subject') {
      /**
       * Velikost sady = `formPaidItemCount` (počet ks v košíku spouštějící bonus).
       * Z této sady je `formFreeItemCount` zdarma; reálně placených je `paid − free`.
       */
      const total = Math.max(0, formPaidItemCount);
      const fn = Math.min(Math.max(0, formFreeItemCount), Math.max(0, total - 1));
      const fake = Array.from({ length: total }, (_, i) => `preview-${i}`);
      return {
        paidIds: fake.slice(0, total - fn),
        freeIds: fake.slice(total - fn),
      };
    }
    return { paidIds: formProductIds, freeIds: [] as string[] };
  }, [formProductIds, formBundleKind, formFreeItemCount, formPaidItemCount]);

  const previewSum = useMemo(() => {
    const h = parseKcInputToHaler(formPriceKc);
    if (formBundleKind === 'nx_plus_one_subject') {
      return {
        alloc: [] as ReturnType<typeof allocateBundleUnitPrices>,
        listSum: 0,
        targetHaler: 0,
        freePreview: [] as { productId: string; productName: string; unitPrice: number; ok: boolean }[],
      };
    }
    const paidIds = nxSlices.paidIds;
    const alloc = allocateBundleUnitPrices(products, paidIds, h);
    const listSum = paidIds.reduce((s, id) => {
      const p = products.find((x) => String(x.id) === String(id));
      return s + (p ? getProductUnitPriceInHaler(p) : 0);
    }, 0);
    return {
      alloc,
      listSum,
      targetHaler: h,
      freePreview: [] as { productId: string; productName: string; unitPrice: number; ok: boolean }[],
    };
  }, [formPriceKc, products, nxSlices.paidIds, formBundleKind]);

  const nxBonusInvalid =
    formBundleKind === 'nx_plus_one_subject'
    && (
      formFreeItemCount < 1
      || formPaidItemCount < 1
      || formBundleSubjects.length < 1
    );

  const saveDisabled =
    !formTitle.trim()
    || nxBonusInvalid
    || (formProductCardBadgeEnabled && !formProductCardBadgeText.trim())
    || (formBundleKind === 'standard' && (previewSum.targetHaler <= 0 || formProductIds.length === 0))
    || (formBundleKind === 'standard' && previewSum.alloc.length !== nxSlices.paidIds.length);

  const saveBlockReason = useMemo(() => {
    if (!formTitle.trim()) return 'Vyplňte název balíčku.';
    if (formProductCardBadgeEnabled && !formProductCardBadgeText.trim()) {
      return 'U bobánku na produktové kartě zadejte text nebo funkci vypněte.';
    }
    if (formBundleKind !== 'nx_plus_one_subject' && formProductIds.length === 0) {
      return 'Vyberte alespoň jeden produkt.';
    }
    if (formBundleKind === 'standard' && previewSum.targetHaler <= 0) return 'Zadejte kladnou cenu balíčku.';
    if (formBundleKind === 'nx_plus_one_subject') {
      if (formBundleSubjects.length < 1) return 'Vyberte alespoň jeden předmět balíčku.';
      if (formPaidItemCount < 1) return 'Zadejte počet placených položek (např. 10).';
      if (formFreeItemCount < 1) return 'Zadejte počet zdarma (např. 1).';
    }
    if (formBundleKind === 'standard' && previewSum.alloc.length !== nxSlices.paidIds.length) {
      return `Nelze uložit: ${previewSum.alloc.length} z ${nxSlices.paidIds.length} placených produktů má variantu pro e-shop. Zkontrolujte výběr.`;
    }
    return null;
  }, [
    formTitle,
    formProductIds.length,
    previewSum.targetHaler,
    previewSum.alloc.length,
    previewSum.freePreview,
    formBundleKind,
    formFreeItemCount,
       formPaidItemCount,
    formBundleSubjects.length,
    nxSlices.paidIds.length,
    formProductCardBadgeEnabled,
    formProductCardBadgeText,
  ]);

  const handleSave = async () => {
    if (saveDisabled) {
      if (saveBlockReason) toast.warning(saveBlockReason);
      return;
    }
    /** null se v JSON pošle a server přepíše / vymaže pole; undefined by se vůbec neposlalo. */
    const payload: Record<string, unknown> = {
      title: formTitle.trim(),
      description: formDescription.trim() ? formDescription.trim() : null,
      bundlePriceHaler: previewSum.targetHaler,
      isActive: formActive,
      validFrom: formValidFrom ? `${formValidFrom}T00:00:00.000Z` : null,
      validTo: formValidTo ? `${formValidTo}T23:59:59.999Z` : null,
      bundleKind: formBundleKind,
      productCardBadgeEnabled: formProductCardBadgeEnabled,
      productCardBadgeText:
        formProductCardBadgeEnabled && formProductCardBadgeText.trim()
          ? formProductCardBadgeText.trim()
          : null,
    };
    if (formBundleKind === 'standard') {
      payload.productIds = formProductIds;
      payload.freeItemCount = null;
      payload.bundleSubjectLabels = null;
      payload.paidItemCount = null;
    } else {
      payload.productIds = [];
      payload.bundleSubjectLabels = formBundleSubjects;
      payload.paidItemCount = Math.max(1, Math.floor(formPaidItemCount));
      payload.freeItemCount = Math.max(1, Math.floor(formFreeItemCount));
      payload.bundlePriceHaler = 0;
    }

    try {
      if (editingId) {
        const res = await fetch(`${API_BASE}/admin/product-bundles/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify(payload),
        });
        const errJson = await res.json().catch(() => null) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(errJson?.error || `Uložení selhalo (${res.status})`);
        }
        toast.success('Balíček uložen');
        const list = await loadAll({ showLoading: false });
        const refreshed = list.find((x) => String(x.id) === String(editingId));
        if (refreshed) startEdit(refreshed);
      } else {
        const body = { ...payload, id: `bundle-${Date.now()}` };
        const res = await fetch(`${API_BASE}/admin/product-bundles`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(body),
        });
        const errJson = await res.json().catch(() => null) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(errJson?.error || `Vytvoření selhalo (${res.status})`);
        }
        toast.success('Balíček vytvořen');
        await loadAll({ showLoading: false });
        resetForm();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat tento balíček?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/product-bundles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: HEADERS,
      });
      if (!res.ok) throw new Error('Mazání selhalo');
      toast.success('Smazáno');
      await loadAll({ showLoading: false });
      if (editingId === id) resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba');
    }
  };

  const copyShopLink = (id: string) => {
    const url = `${window.location.origin}/balicek/${encodeURIComponent(id)}`;
    void navigator.clipboard.writeText(url);
    toast.message('Odkaz zkopírován', { description: url });
  };

  const toggleProduct = (id: string) => {
    setFormProductIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  };

  const moveProductInBundle = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= formProductIds.length) return;
    setFormProductIds((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const removeProductFromBundle = (id: string) => {
    setFormProductIds((prev) => prev.filter((x) => x !== id));
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#001161] font-['Fenomen_Sans']">
            Balíčky produktů
          </h1>
          <p className="text-gray-500 mt-1 text-[14px] max-w-xl">
            Jedna cena balíčku, v košíku se rozdělí mezi řádky. Odkaz na e-shop:{' '}
            <code className="text-[12px] bg-gray-100 px-1 rounded">/balicek/id</code>
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            resetForm();
            setCreating(true);
          }}
          className="gap-2 bg-[#001161] hover:bg-[#000a3d]"
        >
          <Plus className="w-4 h-4" />
          Nový balíček
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Načítám…
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-[15px] font-bold text-[#001161] flex items-center gap-2">
              <Package className="w-4 h-4" />
              Uložené balíčky ({bundles.length})
            </h2>
            {bundles.length === 0 ? (
              <p className="text-[13px] text-gray-500">Zatím žádné. Vytvořte první vpravo.</p>
            ) : (
              <ul className="space-y-2">
                {bundles.map((b) => (
                  <li
                    key={b.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      editingId === b.id ? 'border-[#001161] bg-[#f8f9fc]' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="text-left font-semibold text-[#001161] text-[14px] hover:underline"
                      >
                        {b.title}
                      </button>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyShopLink(b.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#001161] hover:bg-gray-50"
                          title="Kopírovat odkaz"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={`/balicek/${encodeURIComponent(b.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#001161] hover:bg-gray-50"
                          title="Náhled"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(b.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-1">
                      {b.isActive === false ? 'Neaktivní' : 'Aktivní'}
                      {' · '}
                      {b.bundleKind === 'nx_plus_one_subject' ? (
                        <>cena dle výběru · </>
                      ) : (
                        <>{`${formatKcFromHaler(b.bundlePriceHaler || 0)} Kč · `}</>
                      )}
                      {b.bundleKind === 'nx_plus_one_subject'
                        ? `${b.paidItemCount ?? '?'}+${b.freeItemCount ?? '?'} zdarma · sada ${b.paidItemCount ?? '?'} ks (předmět)`
                        : `${(b.productIds || []).length} produktů`}
                      {b.bundleKind === 'nx_plus_one_subject' ? (
                        <span className="text-emerald-700 font-medium"> · výběr titulů na webu</span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(creating || editingId) && (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4 shadow-sm">
              <h2 className="text-[15px] font-bold text-[#001161]">
                {editingId ? 'Upravit balíček' : 'Nový balíček'}
              </h2>

              <div className="space-y-2">
                <Label>Název</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Např. Sada pro 7. ročník" />
              </div>

              <div className="space-y-2">
                <Label>Popis (volitelné)</Label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  placeholder="Krátký text na stránce balíčku"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-gray-100 bg-[#fafbfc] px-3 py-3">
                <Label className="text-[11px] uppercase text-gray-500">Typ balíčku</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-start gap-2 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      name="bundleKind"
                      checked={formBundleKind === 'standard'}
                      onChange={() => {
                        setFormBundleKind('standard');
                        setFormFreeItemCount(0);
                        setFormBundleSubjects([]);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <strong className="text-[#001161]">Standardní</strong>
                      <span className="block text-[11px] text-gray-500">
                        Jedna cena se rozdělí mezi všechny vybrané produkty (1 ks každý).
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      name="bundleKind"
                      checked={formBundleKind === 'nx_plus_one_subject'}
                      onChange={() => {
                        setFormBundleKind('nx_plus_one_subject');
                        setFormProductIds([]);
                        setFormPriceKc('');
                        if (formFreeItemCount < 1) setFormFreeItemCount(1);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <strong className="text-[#001161]">Akce N + zdarma (předmět)</strong>
                      <span className="block text-[11px] text-gray-500">
                        V administraci zvolíte jen předmět a počty; zákazník si tituly vybere na stránce balíčku.
                      </span>
                    </span>
                  </label>
                </div>
                {formBundleKind === 'nx_plus_one_subject' && subjectFilterOptions.length > 0 ? (
                  <div className="pt-2 space-y-2 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-3">
                    <Label className="text-[11px] uppercase text-gray-600">Předmět balíčku (OR)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {subjectFilterOptions.map((subj) => {
                        const on = formBundleSubjects.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => toggleFormBundleSubject(subj)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer max-w-full truncate ${
                              on
                                ? 'border-emerald-700 bg-emerald-100 text-emerald-900 font-semibold'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {subj}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px]">Velikost sady (kus, na který se uplatní bonus)</Label>
                        <Input
                          type="number"
                          min={1}
                          className="mt-1 max-w-[120px]"
                          value={formPaidItemCount || ''}
                          onChange={(e) => setFormPaidItemCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        />
                        <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                          Např. 10 = na každých 10 ks téhož titulu v košíku se uplatní bonus.
                        </p>
                      </div>
                      <div>
                        <Label className="text-[11px]">Počet zdarma v sadě</Label>
                        <Input
                          type="number"
                          min={1}
                          className="mt-1 max-w-[120px]"
                          value={formFreeItemCount || ''}
                          onChange={(e) => setFormFreeItemCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        />
                        <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                          Kolik kusů ze sady je zdarma (placených zůstává „velikost sady − zdarma").
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {formBundleKind === 'nx_plus_one_subject' ? (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-3 text-[13px] text-gray-700">
                  <p className="font-semibold text-[#001161] m-0 mb-1">Cena u zákazníka</p>
                  <p className="m-0 leading-snug">
                    Akce <strong>{formPaidItemCount}+{formFreeItemCount} zdarma</strong> platí
                    {' '}<strong>samostatně pro každý titul</strong>: na každých
                    {' '}{formPaidItemCount} ks <em>téhož titulu</em> v košíku
                    {' '}{formFreeItemCount || '…'}
                    {' '}{formFreeItemCount === 1 ? 'kus dostane' : 'kusy dostane'}
                    {' '}zákazník zdarma (zaplatí
                    {' '}{Math.max(0, formPaidItemCount - formFreeItemCount)} ks).
                    {' '}Mix titulů (např. 5+5) bonus negeneruje. Pole ceny balíčku se
                    u tohoto typu nepoužívá.
                  </p>
                  <p className="text-[11px] text-gray-500 m-0 mt-2">
                    Sada na titul: {formPaidItemCount} ks (z toho {Math.max(0, formPaidItemCount - formFreeItemCount)} placených + {formFreeItemCount} zdarma).
                    {' '}Příklad: při {formPaidItemCount * 2 + 1} ks → {2 * (formFreeItemCount || 0)} ks zdarma, {(formPaidItemCount * 2 + 1) - 2 * (formFreeItemCount || 0)} placených.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cena balíčku (Kč)</Label>
                    <Input value={formPriceKc} onChange={(e) => setFormPriceKc(e.target.value)} placeholder="999,00" />
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <p className="text-[12px] text-gray-500">
                      {'Katalogový součet: '}
                      <span className="font-semibold text-[#001161]">
                        {formatKcFromHaler(previewSum.listSum)} Kč
                      </span>
                    </p>
                    {previewSum.listSum > 0 && previewSum.targetHaler > previewSum.listSum && (
                      <p className="text-[11px] text-amber-700 mt-1">Cena balíčku je vyšší než součet katalogu.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Checkbox id="b-active" checked={formActive} onCheckedChange={(c) => setFormActive(c === true)} />
                  <Label htmlFor="b-active" className="font-normal cursor-pointer">Aktivní</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Platnost od</Label>
                  <Input type="date" value={formValidFrom} onChange={(e) => setFormValidFrom(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Platnost do</Label>
                  <Input type="date" value={formValidTo} onChange={(e) => setFormValidTo(e.target.value)} className="h-9" />
                </div>
              </div>

              <div className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="b-card-badge"
                    checked={formProductCardBadgeEnabled}
                    onCheckedChange={(c) => setFormProductCardBadgeEnabled(c === true)}
                  />
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor="b-card-badge" className="font-normal cursor-pointer text-[#001161]">
                      Bobánek na produktové kartě (katalog, předmět, související)
                    </Label>
                    <p className="text-[11px] text-gray-600 m-0 leading-snug">
                      Červený štítek vlevo nahoře na obálce u produktů v akci — u pevného balíčku jen vybrané tituly,
                      u akce podle předmětu všechny tištěné sešity daného předmětu v katalogu.
                    </p>
                  </div>
                </div>
                {formProductCardBadgeEnabled ? (
                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px]">Text bobánku</Label>
                    <Input
                      value={formProductCardBadgeText}
                      onChange={(e) => setFormProductCardBadgeText(e.target.value)}
                      placeholder="např. Akce 25+1"
                      className="max-w-md"
                    />
                  </div>
                ) : null}
              </div>

              {formBundleKind !== 'nx_plus_one_subject' ? (
              <div className="space-y-2">
                <Label>Produkty v balíčku (pořadí = pořadí v košíku)</Label>
                {formProductIds.length > 0 && (
                  <div className="rounded-xl border border-[#001161]/15 bg-[#f4f6fb] p-3 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide m-0">
                      Vybrané v balíčku ({formProductIds.length})
                    </p>
                    <ul className="space-y-2 max-h-[min(360px,50vh)] overflow-y-auto">
                      {formProductIds.map((id, idx) => {
                        const p = products.find((x) => String(x.id) === id);
                        if (!p) {
                          return (
                            <li
                              key={id}
                              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-2 text-[12px] text-amber-900"
                            >
                              <span className="font-mono text-[11px] shrink-0">{idx + 1}.</span>
                              <span className="min-w-0">V katalogu chybí produkt ID: {id}</span>
                              <button
                                type="button"
                                onClick={() => removeProductFromBundle(id)}
                                className="text-[11px] font-semibold text-red-600 hover:underline shrink-0"
                              >
                                Odebrat
                              </button>
                            </li>
                          );
                        }
                        const isMerch = String(p.type || '').toLowerCase() === 'merch';
                        const extraSel = productExtraGalleryUrls(p);
                        return (
                          <li
                            key={id}
                            className="flex items-center gap-2 rounded-lg border border-white bg-white p-2 shadow-sm"
                          >
                            <span className="text-[11px] font-bold text-gray-400 w-5 text-center shrink-0">{idx + 1}</span>
                            <BookCoverThumb imageUrl={getProductImage(p)} alt={String(p.name || '')} size="sm" />
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-[#001161] text-[13px] leading-snug block">{p.name || p.title}</span>
                              <span className="text-[10px] text-gray-400 leading-snug">
                                {p.category || '—'}
                                {isMerch ? ' · Další produkt' : ''}
                              </span>
                              {extraSel.length > 0 ? (
                                <div className="mt-1.5 space-y-0.5">
                                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Další náhledy</span>
                                  <BundleGalleryStrip urls={extraSel} compact />
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveProductInBundle(idx, -1)}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-40"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={idx === formProductIds.length - 1}
                                onClick={() => moveProductInBundle(idx, 1)}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-40"
                              >
                                {'\u2193'}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProductFromBundle(id)}
                              className="text-[11px] font-semibold text-red-600 hover:underline px-1 shrink-0"
                            >
                              Odebrat
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {subjectFilterOptions.length > 0 && (
                  <div className="rounded-lg border border-gray-100 bg-[#fafbfc] px-3 py-2.5 space-y-2">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Filtr předmětu
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSubjectFilters([])}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                          subjectFilters.length === 0
                            ? 'border-[#001161] bg-[#001161]/10 text-[#001161] font-semibold'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        Všechny
                      </button>
                      {subjectFilterOptions.map((subj) => {
                        const on = subjectFilters.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => toggleSubjectFilter(subj)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer max-w-full truncate ${
                              on
                                ? 'border-[#001161] bg-[#001161]/10 text-[#001161] font-semibold'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {subj}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-snug">
                      Více štítků = zobrazí se sjednocení (produkt stačí z jednoho z nich).
                    </p>
                  </div>
                )}
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Hledat v katalogu…"
                  className="mb-2"
                />
                <div className="max-h-[440px] overflow-y-auto rounded-lg border border-gray-100 divide-y">
                  {filteredProducts.length === 0 ? (
                    <p className="px-3 py-6 text-[13px] text-gray-500 text-center leading-relaxed">
                      Žádné produkty neodpovídají filtru ani hledání. Zkuste vymazat text v poli výše, přepnout předmět,
                      nebo hledat bez diakritiky. Do hledání spadají i skupina/podskupina merchu, poznámka a ISBN.
                    </p>
                  ) : (
                    filteredProducts.slice(0, 120).map((p) => {
                    const id = String(p.id);
                    const checked = formProductIds.includes(id);
                    const isMerch = String(p.type || '').toLowerCase() === 'merch';
                    const extraGallery = productExtraGalleryUrls(p);
                    return (
                      <label
                        key={id}
                        className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-[13px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProduct(id)}
                          className="mt-1 shrink-0"
                        />
                        <BookCoverThumb imageUrl={getProductImage(p)} alt={String(p.name || '')} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-[#001161] block leading-snug">
                            {p.name || p.title}
                            {isMerch ? (
                              <span className="ml-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-md">
                                Další produkt
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[11px] text-gray-400">{p.category || id}</span>
                          {extraGallery.length > 0 ? (
                            <div className="mt-1.5 space-y-0.5">
                              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Další náhledy</span>
                              <BundleGalleryStrip urls={extraGallery} compact />
                            </div>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                  )}
                </div>
                {filteredProducts.length > 120 && (
                  <p className="text-[10px] text-gray-400">
                    Zobrazeno prvních 120 z {filteredProducts.length} — zpřesněte hledání.
                  </p>
                )}
                {formProductIds.length > 0 && (
                  <p className="text-[11px] text-gray-500">
                    Textový přehled pořadí: {formProductIds.map((id) => products.find((p) => String(p.id) === id)?.name || id).join(' → ')}
                  </p>
                )}
              </div>
              ) : (
                <p className="text-[13px] text-gray-600 rounded-lg border border-dashed border-gray-200 bg-[#fafbfc] px-3 py-3">
                  Tituly se nevybírají v administraci — zákazník je zvolí na veřejné stránce balíčku z produktů odpovídajících zvoleným předmětům.
                </p>
              )}

              {previewSum.alloc.length > 0 && previewSum.alloc.length === nxSlices.paidIds.length && (
                <div className="rounded-lg bg-[#f8f9fc] p-3 text-[11px] text-gray-600 space-y-1">
                  <p className="font-semibold text-[#001161]">Náhled cen v košíku (1 ks každý titul)</p>
                  {previewSum.alloc.map((row) => (
                    <div key={row.productId} className="flex justify-between gap-2">
                      <span className="truncate">{row.productName}</span>
                      <span>{formatKcFromHaler(row.unitPrice)} Kč</span>
                    </div>
                  ))}
                  <p className="pt-1 border-t border-gray-200 font-semibold text-[#001161]">
                    Součet {formatKcFromHaler(previewSum.alloc.reduce((s, r) => s + r.unitPrice, 0))} Kč
                  </p>
                </div>
              )}

              {formBundleKind !== 'nx_plus_one_subject'
                && formProductIds.length > 0
                && previewSum.alloc.length !== nxSlices.paidIds.length && (
                <p className="text-[12px] text-red-600">
                  Některé řádky nemají identifikátor pro košík (Shopify variantId, Shoptet SKU u merchu ani shoptetId u produktu) — ty v balíčku nejdou rozúčtovat.
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-2 items-start">
                <Button type="button" onClick={handleSave} disabled={saveDisabled} className="bg-[#001161] hover:bg-[#000a3d]">
                  {editingId ? 'Uložit' : 'Vytvořit'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Zrušit
                </Button>
              </div>
              {saveDisabled && saveBlockReason && (
                <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  {saveBlockReason}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
