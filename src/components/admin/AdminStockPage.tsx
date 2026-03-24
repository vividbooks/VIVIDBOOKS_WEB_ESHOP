import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock3, Package, RefreshCcw, Search } from 'lucide-react';
import { fetchAllProductStocks, type ProductStockItem } from '../../utils/productStock';

function statusClasses(code: ProductStockItem['stockStatus']['code']) {
  switch (code) {
    case 'in_stock':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'low':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'waiting':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

function formatMatchType(value?: string | null) {
  switch (value) {
    case 'basecom_product_id':
      return 'Base ID';
    case 'basecom_sku':
      return 'Base SKU';
    case 'lookup_id':
      return 'Lookup ID';
    case 'ean_or_isbn':
      return 'EAN / ISBN';
    case 'name':
      return 'Název';
    default:
      return 'Bez párování';
  }
}

export function AdminStockPage() {
  const [items, setItems] = useState<ProductStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventoryLabel, setInventoryLabel] = useState<string>('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'category' | 'quantity'>('quantity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllProductStocks({ physicalOnly: true });
      setItems(data.items);
      setInventoryLabel(
        data.inventory.inventoryName
          ? `${data.inventory.inventoryName}${data.inventory.warehouseId ? ` / sklad ${data.inventory.warehouseId}` : ''}`
          : 'Base.com sklad',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst skladové zásoby.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => (
    Array.from(new Set(items.map((item) => item.category || 'Bez kategorie'))).sort((a, b) => a.localeCompare(b, 'cs'))
  ), [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const normalized = items
      .filter((item) => {
        if (!query) return true;
        return [
          item.name,
          item.category || '',
          item.isbn || '',
          item.ean || '',
          item.shoptetId || '',
          item.basecomSku || '',
        ].some((value) => value.toLowerCase().includes(query));
      })
      .filter((item) => {
        if (categoryFilter === 'all') return true;
        return (item.category || 'Bez kategorie') === categoryFilter;
      })
      .filter((item) => {
        if (statusFilter === 'all') return true;
        return item.stockStatus.code === statusFilter;
      })
      .sort((a, b) => {
        const directionFactor = sortDirection === 'asc' ? 1 : -1;

        if (sortKey === 'category') {
          const categoryDiff = (a.category || 'Bez kategorie').localeCompare(b.category || 'Bez kategorie', 'cs');
          if (categoryDiff !== 0) return categoryDiff * directionFactor;
        }

        if (sortKey === 'quantity') {
          const aQty = typeof a.quantity === 'number' ? a.quantity : -1;
          const bQty = typeof b.quantity === 'number' ? b.quantity : -1;
          if (aQty !== bQty) return (aQty - bQty) * directionFactor;
        }

        const priority = { waiting: 0, unknown: 1, low: 2, in_stock: 3 } as const;
        const statusDiff = priority[a.stockStatus.code] - priority[b.stockStatus.code];
        if (statusDiff !== 0) return statusDiff;
        return a.name.localeCompare(b.name, 'cs');
      });

    return normalized;
  }, [items, search, categoryFilter, statusFilter, sortKey, sortDirection]);

  const summary = useMemo(() => ({
    inStock: items.filter((item) => item.stockStatus.code === 'in_stock').length,
    low: items.filter((item) => item.stockStatus.code === 'low').length,
    waiting: items.filter((item) => item.stockStatus.code === 'waiting' || item.stockStatus.code === 'unknown').length,
  }), [items]);

  const toggleSort = (key: 'category' | 'quantity') => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'quantity' ? 'asc' : 'asc');
  };

  const SortIndicator = ({ column }: { column: 'category' | 'quantity' }) => {
    if (sortKey !== column) {
      return <ChevronDown className="w-3.5 h-3.5 text-gray-300" />;
    }

    return sortDirection === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-[#001161]" />
      : <ChevronDown className="w-3.5 h-3.5 text-[#001161]" />;
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-[#001161] font-['Fenomen_Sans']">
            {'Skladové zásoby'}
          </h1>
          <p className="text-gray-500 mt-1 text-[13px]">
            {inventoryLabel || 'Přehled fyzických produktů a jejich aktuální skladovosti v Base.com.'}
          </p>
        </div>

        <button
          onClick={() => void load()}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-[#001161] text-[12px] font-bold hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {'Obnovit'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-emerald-100 p-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#001161]">{summary.inStock}</div>
          <div className="text-[12px] text-gray-500 mt-0.5">{'Skladem'}</div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 p-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
            <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-[#001161]">{summary.low}</div>
          <div className="text-[12px] text-gray-500 mt-0.5">{'Posledních 10 ks'}</div>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 p-4">
          <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center mb-2">
            <Clock3 className="w-4.5 h-4.5 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-[#001161]">{summary.waiting}</div>
          <div className="text-[12px] text-gray-500 mt-0.5">{'Čeká na naskladnění'}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-[#001161]">{'Produkty na skladě'}</h2>
            <p className="text-[12px] text-gray-500 mt-1">{`${filteredItems.length} položek`}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_180px] gap-3">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat podle názvu, ISBN, EAN..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] focus:border-[#001161] focus:ring-1 focus:ring-[#001161]/10 outline-none"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] outline-none focus:border-[#001161] focus:ring-1 focus:ring-[#001161]/10"
            >
              <option value="all">{'Všechny kategorie'}</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-[#001161] outline-none focus:border-[#001161] focus:ring-1 focus:ring-[#001161]/10"
            >
              <option value="all">{'Všechny stavy'}</option>
              <option value="in_stock">{'Skladem'}</option>
              <option value="low">{'Posledních 10 ks'}</option>
              <option value="waiting">{'Čeká na naskladnění'}</option>
              <option value="unknown">{'Neznámý stav'}</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {error}
            </div>
          </div>
        ) : loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-16 rounded-2xl bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-[14px] text-gray-500">{'Žádné produkty neodpovídají filtru.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="px-4 py-2.5 font-bold">{'Produkt'}</th>
                  <th className="px-4 py-2.5 font-bold">
                    <button onClick={() => toggleSort('category')} className="inline-flex items-center gap-1.5 hover:text-[#001161] transition-colors">
                      {'Kategorie'}
                      <SortIndicator column="category" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 font-bold">{'Stav'}</th>
                  <th className="px-4 py-2.5 font-bold">
                    <button onClick={() => toggleSort('quantity')} className="inline-flex items-center gap-1.5 hover:text-[#001161] transition-colors">
                      {'Počet kusů'}
                      <SortIndicator column="quantity" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 font-bold">{'Párování'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[280px]">
                        <div className="w-10 h-10 rounded-xl bg-[#f5f7fb] border border-[#001161]/8 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-[#001161]/30" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[13px] text-[#001161] leading-snug">{item.name}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {[item.isbn && `ISBN ${item.isbn}`, item.ean && `EAN ${item.ean}`].filter(Boolean).join(' · ') || 'Bez ISBN / EAN'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 whitespace-nowrap">{item.category || 'Bez kategorie'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(item.stockStatus.code)}`}>
                        {item.stockStatus.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#001161] whitespace-nowrap">
                      {typeof item.quantity === 'number' ? `${item.quantity} ks` : 'Neuvedeno'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] text-gray-700">{formatMatchType(item.matchType)}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {item.matched
                          ? [item.matchedProductId && `#${item.matchedProductId}`, item.matchedSku && `SKU ${item.matchedSku}`].filter(Boolean).join(' · ')
                          : 'Produkt zatím není napárovaný na Base.com'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminStockPage;
