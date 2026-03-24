import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { fetchProducts } from '../../utils/adminApi';
import { getProductVariantId, getProductUnitPriceInHaler, parseSubject } from '../cartUpsellUtils';
import { allocateBundleUnitPrices, type ProductBundleRecord } from '../../utils/bundlePricing';
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

function productSubjectLabel(p: any): string {
  const hay = `${p.name || ''} ${p.category || ''}`;
  return parseSubject(hay) ?? OTHER_SUBJECT_LABEL;
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
      set.add(productSubjectLabel(p));
    }
    return [...set].sort((a, b) => {
      if (a === OTHER_SUBJECT_LABEL) return 1;
      if (b === OTHER_SUBJECT_LABEL) return -1;
      return a.localeCompare(b, 'cs');
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!getProductVariantId(p)) return false;
      if (subjectFilters.length > 0 && !subjectFilters.includes(productSubjectLabel(p))) return false;
      if (!q) return true;
      const name = String(p.name || p.title || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const id = String(p.id || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || id.includes(q);
    });
  }, [products, search, subjectFilters]);

  const toggleSubjectFilter = (label: string) => {
    setSubjectFilters((prev) => (
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
    setFormPriceKc(formatKcFromHaler(b.bundlePriceHaler || 0));
    setFormProductIds([...(b.productIds || [])]);
    setFormActive(b.isActive !== false);
    setFormValidFrom(b.validFrom ? b.validFrom.slice(0, 10) : '');
    setFormValidTo(b.validTo ? b.validTo.slice(0, 10) : '');
  };

  const previewSum = useMemo(() => {
    const h = parseKcInputToHaler(formPriceKc);
    const alloc = allocateBundleUnitPrices(products, formProductIds, h);
    const listSum = formProductIds.reduce((s, id) => {
      const p = products.find((x) => String(x.id) === String(id));
      return s + (p ? getProductUnitPriceInHaler(p) : 0);
    }, 0);
    return { alloc, listSum, targetHaler: h };
  }, [formProductIds, formPriceKc, products]);

  const saveDisabled =
    !formTitle.trim()
    || formProductIds.length === 0
    || previewSum.targetHaler <= 0
    || previewSum.alloc.length !== formProductIds.length;

  const saveBlockReason = useMemo(() => {
    if (!formTitle.trim()) return 'Vyplňte název balíčku.';
    if (formProductIds.length === 0) return 'Vyberte alespoň jeden produkt.';
    if (previewSum.targetHaler <= 0) return 'Zadejte kladnou cenu balíčku.';
    if (previewSum.alloc.length !== formProductIds.length) {
      return `Nelze uložit: ${previewSum.alloc.length} z ${formProductIds.length} produktů je v aktuálním katalogu s variantou pro e-shop. Ostatní vyřaďte z výběru.`;
    }
    return null;
  }, [formTitle, formProductIds.length, previewSum.targetHaler, previewSum.alloc.length]);

  const handleSave = async () => {
    if (saveDisabled) {
      if (saveBlockReason) toast.warning(saveBlockReason);
      return;
    }
    /** null se v JSON pošle a server přepíše / vymaže pole; undefined by se vůbec neposlalo. */
    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() ? formDescription.trim() : null,
      productIds: formProductIds,
      bundlePriceHaler: previewSum.targetHaler,
      isActive: formActive,
      validFrom: formValidFrom ? `${formValidFrom}T00:00:00.000Z` : null,
      validTo: formValidTo ? `${formValidTo}T23:59:59.999Z` : null,
    };

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
                      {`${formatKcFromHaler(b.bundlePriceHaler || 0)} Kč · ${(b.productIds || []).length} produktů`}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cena balíčku (Kč)</Label>
                  <Input value={formPriceKc} onChange={(e) => setFormPriceKc(e.target.value)} placeholder="999,00" />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <p className="text-[12px] text-gray-500">
                    Katalogový součet:{' '}
                    <span className="font-semibold text-[#001161]">
                      {formatKcFromHaler(previewSum.listSum)} Kč
                    </span>
                  </p>
                  {previewSum.listSum > 0 && previewSum.targetHaler > previewSum.listSum && (
                    <p className="text-[11px] text-amber-700 mt-1">Cena balíčku je vyšší než součet katalogu.</p>
                  )}
                </div>
              </div>

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

              <div className="space-y-2">
                <Label>Produkty v balíčku (pořadí = pořadí v košíku)</Label>
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
                  {filteredProducts.slice(0, 80).map((p) => {
                    const id = String(p.id);
                    const checked = formProductIds.includes(id);
                    return (
                      <label
                        key={id}
                        className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-[13px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProduct(id)}
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-[#001161] block leading-snug">{p.name || p.title}</span>
                          <span className="text-[11px] text-gray-400">{p.category || id}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {formProductIds.length > 0 && (
                  <p className="text-[11px] text-gray-500">
                    Pořadí: {formProductIds.map((id) => products.find((p) => String(p.id) === id)?.name || id).join(' → ')}
                  </p>
                )}
              </div>

              {previewSum.alloc.length > 0 && previewSum.alloc.length === formProductIds.length && (
                <div className="rounded-lg bg-[#f8f9fc] p-3 text-[11px] text-gray-600 space-y-1">
                  <p className="font-semibold text-[#001161]">Náhled cen v košíku (1 ks)</p>
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

              {formProductIds.length > 0 && previewSum.alloc.length !== formProductIds.length && (
                <p className="text-[12px] text-red-600">
                  Některé produkty nemají variantu pro e-shop (shopifyVariantId) — ty nelze do balíčku přidat.
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
