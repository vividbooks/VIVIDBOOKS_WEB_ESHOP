import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { projectId } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/admin`;

async function call(path: string, method = 'GET', body?: unknown) {
  const { getRequiredEdgeFunctionHeaders } = await import('../../lib/edgeFunctionHeaders');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: await getRequiredEdgeFunctionHeaders(true),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Chyba ${res.status}`);
  return json;
}

const czk = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('cs-CZ')} Kč`;
const num = (n: number) => (Number(n) || 0).toLocaleString('cs-CZ');
const oneDecimal = (n: number) => (Number(n) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 1 });

const PROPOSAL_LABEL: Record<string, string> = {
  draft: 'čeká',
  approved: 'schváleno',
  applied: 'aplikováno',
  rejected: 'zamítnuto',
  failed: 'chyba',
};

function proposalSummary(counts: Record<string, number> | undefined): string {
  if (!counts) return '0';
  const parts = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${PROPOSAL_LABEL[k] || k}`);
  return parts.length ? parts.join(' · ') : '0';
}

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const CARD = 'rounded-2xl border border-gray-100 bg-white p-5';
const LABEL = 'text-[11px] font-bold uppercase tracking-wide text-gray-400';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_SECONDARY = `${BTN} border border-gray-200 bg-white text-[#001161] hover:border-[#001161]/40`;
const SELECT = 'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-[#001161] outline-none focus:border-[#001161]/50';

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={CARD}>
      <div className={LABEL}>{label}</div>
      <div className="mt-1 text-[20px] font-bold leading-tight text-[#001161]">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
    </div>
  );
}

export default function MarketingPerformancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await call(`/marketing/performance?days=${days}`);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const pullMetrics = async () => {
    setPulling(true);
    setPullMsg(null);
    try {
      const r: any = await call('/growth-metrics/pull', 'POST');
      const run = r?.run || {};
      const daysInfo = run.mockDays ? ` za ${run.mockDays} dní` : '';
      setPullMsg(
        `${run.mock ? 'Ukázková data' : 'Staženo'}${daysInfo}: ` +
        `${run.campaignRows ?? 0} denních záznamů kampaní, ${run.keywordRows ?? 0} klíčových slov, ${run.searchTermRows ?? 0} vyhledávaných výrazů.`
      );
      await load();
    } catch (e: any) {
      setPullMsg(e.message);
    } finally {
      setPulling(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8 text-[13px] text-[#001161]/60" style={FF}>Načítám…</div>;
  }
  if (error) {
    return <div className="p-8 text-[13px] text-red-600" style={FF}>{error}</div>;
  }
  if (!data) return null;

  const { totals, daily, topSearchTerms } = data;
  const isMock = !!data.mock || data.apiConfigured === false;
  const hasDaily = Array.isArray(daily) && daily.length > 0;
  const hasTerms = Array.isArray(topSearchTerms) && topSearchTerms.length > 0;

  const cpa = totals.purchases > 0 ? totals.spend_czk / totals.purchases : 0;
  const roas = totals.spend_czk > 0 ? totals.revenue_czk / totals.spend_czk : 0;

  return (
    <div className="h-full overflow-y-auto p-8" style={FF}>
      {isMock && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          <span className="font-bold">Ukázkový režim.</span> Google Ads API zatím není připojeno. Data jsou smyšlená
          a slouží k ověření toku — po připojení se přepnou na reálná.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#001161]">Výkon marketingu</h1>
          <p className="mt-1 max-w-[820px] text-[14px] leading-relaxed text-gray-500">
            Kolik reklamy stojí, co přinášejí a jak si vedou jednotlivé kampaně a vyhledávané výrazy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={SELECT} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 dní</option>
            <option value={30}>30 dní</option>
            <option value={90}>90 dní</option>
          </select>
          <button className={BTN_SECONDARY} disabled={pulling} onClick={pullMetrics}>
            <RefreshCw className={`h-4 w-4 ${pulling ? 'animate-spin' : ''}`} />
            {pulling ? 'Stahuji…' : isMock ? 'Obnovit ukázková data' : 'Stáhnout metriky'}
          </button>
        </div>
      </div>

      {pullMsg && (
        <div className="mb-6 rounded-xl bg-gray-100 px-4 py-3 text-[13px] text-[#001161]">{pullMsg}</div>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Útrata" value={czk(totals.spend_czk)} />
        <Kpi label="Kliky" value={num(totals.clicks)} />
        <Kpi label="Nákupy (server)" value={num(totals.purchases)} />
        <Kpi label="Tržby" value={czk(totals.revenue_czk)} />
      </div>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Zobrazení" value={num(totals.impressions)} />
        <Kpi label="GA konverze" value={oneDecimal(totals.ga_conversions)} />
        <Kpi label="Cena za nákup" value={totals.purchases > 0 ? czk(cpa) : '—'} />
        <Kpi
          label="ROAS"
          value={totals.spend_czk > 0 ? roas.toFixed(2) : '—'}
          hint={totals.spend_czk > 0 ? 'tržby / útrata' : undefined}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-gray-500">
        <span>
          Kontaktní body: <span className="font-bold text-[#001161]">{num(totals.touchpoints)}</span>
        </span>
        <span>
          Návrhy: <span className="font-bold text-[#001161]">{proposalSummary(totals.proposalCounts)}</span>
        </span>
      </div>

      <div className={`${CARD} mb-6`}>
        <div className="mb-3 text-[16px] font-bold text-[#001161]">Denní trend</div>
        {!hasDaily ? (
          <div className="py-10 text-center text-[13px] text-gray-500">
            <div>Zatím žádná data.</div>
            <button className={`${BTN_SECONDARY} mt-3`} disabled={pulling} onClick={pullMetrics}>
              {pulling ? 'Stahuji…' : isMock ? 'Naplnit ukázková data' : 'Stáhnout metriky'}
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8a90a6' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#8a90a6' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#8a90a6' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eef0f6', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="spend_czk" stroke="#ff6a35" strokeWidth={2} dot={false} name="Útrata (Kč)" />
              <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="#001161" strokeWidth={2} dot={false} name="Kliky" />
              <Line yAxisId="right" type="monotone" dataKey="purchases" stroke="#10b981" strokeWidth={2} dot={false} name="Nákupy" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className={CARD}>
        <div className="mb-3 text-[16px] font-bold text-[#001161]">Top vyhledávané výrazy podle útraty</div>
        {!hasTerms ? (
          <div className="py-10 text-center text-[13px] text-gray-500">Zatím žádné vyhledávané výrazy.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topSearchTerms} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8a90a6' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="term" tick={{ fontSize: 11, fill: '#001161' }} width={180} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eef0f6', fontSize: 12 }} />
              <Bar dataKey="cost_czk" fill="#ff6a35" radius={[0, 6, 6, 0]} name="Útrata (Kč)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
