import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3, Box, ChevronDown, ChevronUp, GraduationCap, Package, RefreshCcw, Search,
  School, ShoppingBag, Truck, TriangleAlert, Wallet,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  Pie, PieChart, XAxis, YAxis,
} from 'recharts@2.15.2';
import {
  fetchAdminAnalytics,
  type AdminAnalyticsResponse,
  type AdminAnalyticsSchoolItem,
} from '../../utils/adminApi';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '../ui/chart';

type TabId = 'overview' | 'products' | 'schools' | 'operations';
type RangeId = 30 | 90 | 365 | 'all';

const RANGE_OPTIONS: Array<{ value: RangeId; label: string }> = [
  { value: 30, label: '30 dní' },
  { value: 90, label: '90 dní' },
  { value: 365, label: '365 dní' },
  { value: 'all', label: 'Celé období' },
];

const TAB_OPTIONS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'overview', label: 'Přehled', icon: BarChart3 },
  { id: 'products', label: 'Produkty', icon: Package },
  { id: 'schools', label: 'Školy', icon: GraduationCap },
  { id: 'operations', label: 'Provoz', icon: Truck },
];

const PIE_COLORS = ['#1d4ed8', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

function formatPrice(amountInHaler: number) {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} Kč`;
}

function formatPricePrecise(amountInHaler: number) {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function formatNumber(value: number) {
  return value.toLocaleString('cs-CZ');
}

function formatHours(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('cs-CZ', {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  })} h`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function shippingLabel(method?: string) {
  switch (method) {
    case 'dpd':
      return 'DPD';
    case 'zasilkovna':
      return 'Zásilkovna';
    case 'gls':
      return 'GLS';
    case 'ppl':
      return 'PPL';
    default:
      return method || 'Neznámé';
  }
}

function paymentLabel(method?: string) {
  switch (method) {
    case 'card':
      return 'Karta';
    case 'apple_pay':
      return 'Apple Pay';
    case 'google_pay':
      return 'Google Pay';
    case 'transfer':
      return 'Převod';
    case 'invoice':
      return 'Faktura';
    default:
      return method || 'Neznámé';
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case 'paid':
      return 'Zaplaceno';
    case 'processing':
      return 'Zpracování';
    case 'exported':
      return 'Exportováno';
    case 'shipped':
      return 'Odesláno';
    case 'delivered':
      return 'Doručeno';
    case 'cancelled':
      return 'Storno';
    case 'refunded':
      return 'Refund';
    case 'failed':
      return 'Selhalo';
    case 'draft':
      return 'Draft';
    case 'pending_payment':
      return 'Čeká na platbu';
    default:
      return status || 'Neznámý';
  }
}

function workflowLabel(status?: string) {
  switch (status) {
    case 'done':
      return 'Hotovo';
    case 'pending':
      return 'Čeká';
    case 'running':
      return 'Běží';
    case 'failed':
      return 'Selhalo';
    case 'stuck':
      return 'Zaseknuto';
    case 'skipped':
      return 'Přeskočeno';
    default:
      return status || 'Neznámé';
  }
}

function HeatCell({
  value,
  maxValue,
}: {
  value: number;
  maxValue: number;
}) {
  const alpha = maxValue > 0 ? Math.max(0.08, value / maxValue) : 0;
  return (
    <div
      className="h-10 rounded-xl border border-white/70 flex items-center justify-center text-[11px] font-bold text-[#001161]"
      style={{ backgroundColor: `rgba(29, 78, 216, ${alpha})` }}
    >
      {value > 0 ? formatNumber(value) : '—'}
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  className = '',
}: {
  label: string;
  value: string;
  helper: string;
  icon: any;
  tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
  className?: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  } as const;

  return (
    <div className={`rounded-xl border p-3 ${tones[tone]} ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center mb-2">
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-[20px] leading-none font-bold text-[#001161]">{value}</div>
      <div className="text-[12px] font-semibold mt-1">{label}</div>
      <div className="text-[11px] text-gray-500 mt-1 leading-snug">{helper}</div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-[#001161]">{title}</h2>
          {subtitle ? <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-xl bg-white border border-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 h-[320px] rounded-xl bg-white border border-gray-100 animate-pulse" />
        <div className="h-[320px] rounded-xl bg-white border border-gray-100 animate-pulse" />
      </div>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeId>(90);
  const [tab, setTab] = useState<TabId>('overview');
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminAnalytics({ days: range });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst analytiku.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [range]);

  const shippingPieData = useMemo(() => (
    (data?.charts.shippingBreakdown || []).map((item) => ({
      name: shippingLabel(item.method),
      orders: item.orders || 0,
    }))
  ), [data]);

  const paymentPieData = useMemo(() => (
    (data?.charts.paymentBreakdown || []).map((item) => ({
      name: paymentLabel(item.method),
      orders: item.orders || 0,
    }))
  ), [data]);

  const categoryBarData = useMemo(() => (
    (data?.charts.categoryBreakdown || []).map((item) => ({
      category: item.category || 'Bez kategorie',
      revenue: item.revenue || 0,
      units: item.units || 0,
    }))
  ), [data]);

  const statusBarData = useMemo(() => (
    (data?.charts.statusBreakdown || []).map((item) => ({
      status: statusLabel(item.status),
      count: item.count || 0,
    }))
  ), [data]);

  const workflowBarData = useMemo(() => (
    (data?.operations.workflow || []).map((item) => ({
      status: workflowLabel(item.status),
      count: item.count,
    }))
  ), [data]);

  const heatmapLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const cell of data?.schools.heatmap.cells || []) {
      lookup.set(`${cell.ico}:${cell.productId}:${cell.productName}`, cell.revenue);
    }
    return lookup;
  }, [data]);

  const heatmapMax = useMemo(() => {
    let maxValue = 0;
    for (const value of heatmapLookup.values()) {
      if (value > maxValue) maxValue = value;
    }
    return maxValue;
  }, [heatmapLookup]);

  const renderOverview = () => {
    if (!data) return null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <Panel
            title="Tržby a objednávky v čase"
            subtitle="Denní vývoj tržeb, objednávek a odeslaných zásilek."
            className="xl:col-span-2"
          >
            <ChartContainer
              className="h-[260px] w-full"
              config={{
                revenue: { label: 'Tržby', color: '#1d4ed8' },
                orders: { label: 'Objednávky', color: '#16a34a' },
                shipments: { label: 'Zásilky', color: '#f59e0b' },
              }}
            >
              <ComposedChart data={data.charts.trend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis yAxisId="revenue" tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} width={44} />
                <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} width={30} />
                <ChartTooltip
                  content={(
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === 'Tržby') return <>{formatPricePrecise(Number(value))}</>;
                        return <>{formatNumber(Number(value))}</>;
                      }}
                    />
                  )}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="orders" dataKey="shipments" name="Zásilky" fill="var(--color-shipments)" radius={[6, 6, 0, 0]} barSize={18} />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Tržby" stroke="var(--color-revenue)" strokeWidth={3} dot={false} />
                <Line yAxisId="orders" type="monotone" dataKey="orders" name="Objednávky" stroke="var(--color-orders)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          </Panel>

          <Panel title="Top kategorie" subtitle="Kategorie s nejvyšší tržbou.">
            <ChartContainer
              className="h-[260px] w-full"
              config={{
                revenue: { label: 'Tržby', color: '#8b5cf6' },
              }}
            >
              <BarChart data={categoryBarData} layout="vertical" margin={{ left: 12, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={120} />
                <ChartTooltip
                  content={(
                    <ChartTooltipContent
                      formatter={(value) => <>{formatPricePrecise(Number(value))}</>}
                    />
                  )}
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={10} />
              </BarChart>
            </ChartContainer>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Doprava" subtitle="Kolik objednávek jde přes jednotlivé dopravce.">
            <ChartContainer
              className="h-[220px] w-full"
              config={Object.fromEntries(
                shippingPieData.map((item, index) => [item.name, { label: item.name, color: PIE_COLORS[index % PIE_COLORS.length] }]),
              )}
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => <>{formatNumber(Number(value))}</>} />} />
                <Pie data={shippingPieData} dataKey="orders" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={4}>
                  {shippingPieData.map((item, index) => (
                    <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </Panel>

          <Panel title="Platby" subtitle="Rozpad objednávek podle platební metody.">
            <ChartContainer
              className="h-[220px] w-full"
              config={Object.fromEntries(
                paymentPieData.map((item, index) => [item.name, { label: item.name, color: PIE_COLORS[index % PIE_COLORS.length] }]),
              )}
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => <>{formatNumber(Number(value))}</>} />} />
                <Pie data={paymentPieData} dataKey="orders" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={4}>
                  {paymentPieData.map((item, index) => (
                    <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </Panel>
        </div>
      </div>
    );
  };

  const renderProducts = () => {
    if (!data) return null;

    const productBarData = data.products.topByRevenue.map((item) => ({
      name: item.productName,
      revenue: item.revenue,
    }));
    const productQuery = productSearch.trim().toLowerCase();
    const allProductsSource = data.products.allProducts && data.products.allProducts.length > 0
      ? data.products.allProducts
      : Array.from(
          new Map(
            [...data.products.topByRevenue, ...data.products.topByUnits].map((item) => [
              `${item.productId}:${item.productName}`,
              item,
            ]),
          ).values(),
        );
    const allProducts = allProductsSource.filter((item) => {
      if (!productQuery) return true;
      return [item.productName, item.category, ...item.topSchools.map((school) => school.schoolName)]
        .some((value) => value.toLowerCase().includes(productQuery));
    });

    return (
      <div className="space-y-3">
        <Panel title="Nejprodávanější produkty podle tržeb" subtitle="Rychlý přehled nejsilnějších produktů.">
          <ChartContainer
            className="h-[250px] w-full"
            config={{
              revenue: { label: 'Tržby', color: '#1d4ed8' },
            }}
          >
            <BarChart data={productBarData} layout="vertical" margin={{ left: 12, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={190} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => <>{formatPricePrecise(Number(value))}</>} />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={10} />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel
          title="Všechny produkty"
          subtitle="Klikni na produkt a uvidíš, které školy ho koupily a v jakých počtech."
          action={<div className="text-[11px] text-gray-400">{`${allProducts.length} produktů`}</div>}
        >
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Hledat podle produktu, kategorie nebo školy..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-[12px] focus:border-[#001161] focus:ring-1 focus:ring-[#001161]/10 outline-none"
            />
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_70px_90px_32px] gap-2 bg-gray-50 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-gray-500 font-bold">
              <div>Produkt</div>
              <div className="text-right">Tržby</div>
              <div className="text-right">Kusy</div>
              <div className="text-right">Objednávky</div>
              <div />
            </div>

            {allProducts.length === 0 ? (
              <div className="px-3 py-6 text-[12px] text-gray-500">Žádný produkt neodpovídá filtru.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {allProducts.map((item) => {
                  const isOpen = expandedProductId === item.productId;
                  return (
                    <div key={`${item.productId}:${item.productName}`} className="bg-white">
                      <button
                        onClick={() => setExpandedProductId((prev) => prev === item.productId ? null : item.productId)}
                        className="w-full grid grid-cols-[minmax(0,1fr)_120px_70px_90px_32px] gap-2 items-center px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#001161] text-[12px] truncate">{item.productName}</div>
                          <div className="text-[11px] text-gray-500 truncate">{item.category}</div>
                        </div>
                        <div className="text-right text-[12px] font-semibold text-[#001161]">{formatPrice(item.revenue)}</div>
                        <div className="text-right text-[12px] text-gray-600">{formatNumber(item.units)}</div>
                        <div className="text-right text-[12px] text-gray-600">{formatNumber(item.orderCount)}</div>
                        <div className="flex justify-end text-gray-400">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3">
                          <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                            <div className="grid grid-cols-[minmax(0,1fr)_70px_80px_90px] gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-gray-500 font-bold border-b border-gray-100">
                              <div>Škola</div>
                              <div className="text-right">Kusy</div>
                              <div className="text-right">Objednávky</div>
                              <div className="text-right">Tržby</div>
                            </div>
                            {item.topSchools.length === 0 ? (
                              <div className="px-3 py-4 text-[11px] text-gray-500">Tento produkt zatím nemá školní objednávky.</div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {item.topSchools.map((school) => (
                                  <div key={`${item.productId}:${school.ico}`} className="grid grid-cols-[minmax(0,1fr)_70px_80px_90px] gap-2 items-center px-3 py-2 text-[11px]">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-[#001161] truncate">{school.schoolName}</div>
                                      <div className="text-gray-400 truncate">IČO {school.ico}</div>
                                    </div>
                                    <div className="text-right font-semibold text-[#001161]">{formatNumber(school.units)}</div>
                                    <div className="text-right text-gray-600">{formatNumber(school.orderCount)}</div>
                                    <div className="text-right text-gray-600">{formatPrice(school.revenue)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>
    );
  };

  const renderSchools = () => {
    if (!data) return null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Panel title="Top školy podle obratu" subtitle="Školy seskupené podle IČA.">
            <div className="space-y-2.5">
              {data.schools.topSchools.map((school, index) => (
                <SchoolListRow key={school.ico} school={school} index={index} />
              ))}
            </div>
          </Panel>

          <Panel title="Jaké školy koupily jaké produkty" subtitle="Nejčastější kombinace škola × produkt.">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-gray-500">
                    <th className="px-3 py-2.5 font-bold">Škola</th>
                    <th className="px-3 py-2.5 font-bold">IČO</th>
                    <th className="px-3 py-2.5 font-bold">Produkt</th>
                    <th className="px-3 py-2.5 font-bold">Kategorie</th>
                    <th className="px-3 py-2.5 font-bold text-right">Kusy</th>
                    <th className="px-3 py-2.5 font-bold text-right">Tržby</th>
                  </tr>
                </thead>
                <tbody>
                  {data.schools.topSchoolProducts.map((item, index) => (
                    <tr key={`${item.ico}:${item.productId}:${index}`} className="border-t border-gray-100 text-[12px]">
                      <td className="px-3 py-2.5 font-semibold text-[#001161]">{item.schoolName}</td>
                      <td className="px-3 py-2.5 text-gray-500">{item.ico}</td>
                      <td className="px-3 py-2.5 text-[#001161]">{item.productName}</td>
                      <td className="px-3 py-2.5 text-gray-500">{item.category}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#001161]">{formatNumber(item.units)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{formatPrice(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel title="Heatmapa škola × produkt" subtitle="Tmavší pole znamená vyšší obrat daného produktu u dané školy.">
          {!data.schools.heatmap.schools.length || !data.schools.heatmap.products.length ? (
            <div className="text-[13px] text-gray-500">Pro zvolené období zatím není dost školních dat.</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[780px]">
                <div className="grid gap-2" style={{ gridTemplateColumns: `220px repeat(${data.schools.heatmap.products.length}, minmax(120px, 1fr))` }}>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-gray-400 px-2 py-1">Škola</div>
                  {data.schools.heatmap.products.map((product) => (
                    <div key={`${product.productId}:${product.productName}`} className="px-2 py-1">
                      <div className="text-[12px] font-semibold text-[#001161] leading-snug">{product.productName}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{product.category}</div>
                    </div>
                  ))}

                  {data.schools.heatmap.schools.map((school) => (
                    <Fragment key={school.ico}>
                      <div key={`${school.ico}:label`} className="px-2 py-2 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="font-semibold text-[#001161] text-[13px] leading-snug">{school.schoolName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">IČO {school.ico}</div>
                      </div>
                      {data.schools.heatmap.products.map((product) => {
                        const value = heatmapLookup.get(`${school.ico}:${product.productId}:${product.productName}`) || 0;
                        return (
                          <HeatCell
                            key={`${school.ico}:${product.productId}:${product.productName}`}
                            value={value}
                            maxValue={heatmapMax}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    );
  };

  const renderOperations = () => {
    if (!data) return null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <Panel title="Stavy objednávek" subtitle="Kolik objednávek je aktuálně v jednotlivých stavech.">
            <ChartContainer
              className="h-[240px] w-full"
              config={{
                count: { label: 'Počet', color: '#1d4ed8' },
              }}
            >
              <BarChart data={statusBarData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} angle={-15} textAnchor="end" height={70} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => <>{formatNumber(Number(value))}</>} />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Panel>

          <Panel title="Workflow kroky" subtitle="Souhrn stavů monitorovaných workflow kroků.">
            <ChartContainer
              className="h-[240px] w-full"
              config={{
                count: { label: 'Počet', color: '#f59e0b' },
              }}
            >
              <BarChart data={workflowBarData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => <>{formatNumber(Number(value))}</>} />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Panel>
        </div>

        <Panel title="Operativní přehled" subtitle="Alerty a rychlost processingu objednávek.">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
              <div className="text-[12px] text-gray-500">Critical alerty</div>
              <div className="text-[22px] font-bold text-[#001161] mt-1">{formatNumber(data.operations.alerts.critical)}</div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <div className="text-[12px] text-gray-500">Warning alerty</div>
              <div className="text-[22px] font-bold text-[#001161] mt-1">{formatNumber(data.operations.alerts.warning)}</div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <div className="text-[12px] text-gray-500">Průměr do zaplacení</div>
              <div className="text-[22px] font-bold text-[#001161] mt-1">{formatHours(data.operations.averageHoursToPay)}</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="text-[12px] text-gray-500">Průměr do odeslání</div>
              <div className="text-[22px] font-bold text-[#001161] mt-1">{formatHours(data.operations.averageHoursToShip)}</div>
            </div>
          </div>
        </Panel>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between mb-4">
        <div>
          <h1 className="text-[24px] font-bold text-[#001161] font-['Fenomen_Sans']">
            {'Analytika'}
          </h1>
          <p className="text-gray-500 mt-0.5 text-[12px]">
            {data?.period.label || 'Přehled prodejů, zásilek, škol a provozních metrik.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                onClick={() => setRange(option.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  range === option.value
                    ? 'bg-[#001161] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#001161]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-[#001161] text-[11px] font-bold hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Obnovit
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {error}
        </div>
      ) : loading && !data ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1 mb-3">
            <KpiCard
              label="Tržby"
              value={formatPrice(data.overview.revenue)}
              helper={`Za ${data.period.label.toLowerCase()}`}
              icon={Wallet}
              tone="blue"
              className="min-w-[185px] flex-1"
            />
            <KpiCard
              label="Objednávky"
              value={formatNumber(data.overview.orderCount)}
              helper={`${formatNumber(data.overview.unitsSold)} prodaných kusů`}
              icon={ShoppingBag}
              tone="emerald"
              className="min-w-[185px] flex-1"
            />
            <KpiCard
              label="Zásilky"
              value={formatNumber(data.overview.shipmentCount)}
              helper="Odeslané nebo doručené objednávky"
              icon={Truck}
              tone="amber"
              className="min-w-[185px] flex-1"
            />
            <KpiCard
              label="Průměrná objednávka"
              value={formatPrice(data.overview.averageOrderValue)}
              helper={`${formatNumber(data.overview.schoolOrderCount)} školních objednávek`}
              icon={Box}
              tone="violet"
              className="min-w-[185px] flex-1"
            />
            <KpiCard
              label="Školy"
              value={formatNumber(data.overview.uniqueSchools)}
              helper={`${formatPrice(data.overview.schoolRevenue)} obrat škol`}
              icon={School}
              tone="slate"
              className="min-w-[185px] flex-1"
            />
            <KpiCard
              label="Open alerty"
              value={formatNumber(data.overview.openAlerts)}
              helper={`${formatNumber(data.operations.alerts.critical)} critical`}
              icon={TriangleAlert}
              tone="rose"
              className="min-w-[185px] flex-1"
            />
          </div>

          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-1 mb-3">
            {TAB_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setTab(option.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  tab === option.id
                    ? 'bg-[#001161] text-white shadow-sm'
                    : 'text-gray-500 hover:text-[#001161]'
                }`}
              >
                <option.icon className="w-4 h-4" />
                {option.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && renderOverview()}
          {tab === 'products' && renderProducts()}
          {tab === 'schools' && renderSchools()}
          {tab === 'operations' && renderOperations()}
        </>
      ) : null}
    </div>
  );
}

function SchoolListRow({
  school,
  index,
}: {
  school: AdminAnalyticsSchoolItem;
  index: number;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-blue-600 mb-1">#{index + 1}</div>
          <div className="font-bold text-[#001161] text-[13px] leading-snug">{school.schoolName}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">IČO {school.ico}</div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold text-[#001161]">{formatPrice(school.revenue)}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{formatNumber(school.orderCount)} objednávek</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
        <div>
          <div className="text-gray-400">Kusy</div>
          <div className="font-semibold text-[#001161] mt-0.5">{formatNumber(school.units)}</div>
        </div>
        <div>
          <div className="text-gray-400">Zásilky</div>
          <div className="font-semibold text-[#001161] mt-0.5">{formatNumber(school.shipmentCount)}</div>
        </div>
        <div>
          <div className="text-gray-400">Poslední nákup</div>
          <div className="font-semibold text-[#001161] mt-0.5">{formatDate(school.lastOrderedAt)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {school.topCategories.map((category) => (
          <span key={category} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
            {category}
          </span>
        ))}
        {school.topProducts.slice(0, 2).map((product) => (
          <span key={product} className="px-2.5 py-1 rounded-full bg-white text-gray-600 text-[11px] border border-gray-200">
            {product}
          </span>
        ))}
      </div>
    </div>
  );
}
