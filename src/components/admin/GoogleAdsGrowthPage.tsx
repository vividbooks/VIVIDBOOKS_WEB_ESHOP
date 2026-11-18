import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Play, Rocket, Send, Settings2 } from 'lucide-react';
import { projectId } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/admin/growth-gads`;

type Keyword = { text: string; match: 'PHRASE' | 'EXACT'; source: 'seed' | 'idea' };
type Draft = {
  id: string;
  adGroupName: string;
  finalUrl: string;
  priceFromKc: number | null;
  keywords: Keyword[];
  headlines: string[];
  descriptions: string[];
  status: 'draft' | 'approved' | 'rejected' | 'pushed' | 'failed';
  problems: string[];
  error?: string;
};
type Metric = { volume: number | null; competition: string | null; lowCpcKc: number | null; highCpcKc: number | null };
type State = {
  apiConfigured: boolean;
  hardMaxDailyCzk: number;
  settings: { dailyBudgetCzk: number; maxCpcCzk: number; campaign?: { resource: string; enabledAt?: string } };
  drafts: Draft[];
  metrics: Record<string, Metric>;
  runs: Array<{ at: string; mode: string; drafts?: number; error?: string; note?: string }>;
};

const STATUS_LABEL: Record<Draft['status'], string> = {
  draft: 'Návrh', approved: 'Schváleno', rejected: 'Zamítnuto', pushed: 'V Google Ads (pozastaveno)', failed: 'Chyba odeslání',
};

const STATUS_STYLE: Record<Draft['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-50 text-blue-700',
  rejected: 'bg-gray-100 text-gray-500',
  pushed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const CARD = 'rounded-2xl border border-gray-100 bg-white p-5';
const LABEL = 'text-[11px] font-bold uppercase tracking-wide text-gray-400';
const INPUT = 'mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[14px] text-[#001161] outline-none focus:border-[#001161]/50 disabled:bg-gray-50 disabled:text-gray-400';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_PRIMARY = `${BTN} bg-[#001161] text-white hover:bg-[#001161]/90`;
const BTN_SECONDARY = `${BTN} border border-gray-200 bg-white text-[#001161] hover:border-[#001161]/40`;
const BTN_DANGER = `${BTN} border border-red-200 bg-white text-red-700 hover:bg-red-50`;

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

export default function GoogleAdsGrowthPage() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [cpc, setCpc] = useState('');

  const load = useCallback(async () => {
    try {
      const s: State = await call('/state');
      setState(s);
      setBudget(s.settings.dailyBudgetCzk > 0 ? String(s.settings.dailyBudgetCzk) : '');
      setCpc(s.settings.maxCpcCzk > 0 ? String(s.settings.maxCpcCzk) : '');
    } catch (e: any) {
      setMessage(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setMessage(null);
    try {
      const r: any = await fn();
      setMessage(r?.note || r?.error || 'Hotovo.');
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-[13px] text-[#001161]/60" style={FF}>
        {message || 'Načítám…'}
      </div>
    );
  }

  const { settings, drafts, metrics } = state;
  const approved = drafts.filter((d) => d.status === 'approved').length;
  const volume = (d: Draft) => d.keywords.filter((k) => k.match === 'PHRASE')
    .reduce((s, k) => s + (metrics[k.text]?.volume ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto p-8" style={FF}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#001161]">Google Ads – automatizace</h1>
        <p className="mt-1 max-w-[820px] text-[14px] leading-relaxed text-gray-500">
          Tahle karta připravuje texty inzerátů a kampaň. Měření a optimalizaci najdete v kartách Výkon a Návrhy.
        </p>
        <p className="mt-1 max-w-[820px] text-[14px] leading-relaxed text-gray-500">
          Každý den se zjistí hledanost a připraví návrhy reklam. Do Google Ads se nic nepošle bez vašeho schválení
          a kampaň vzniká pozastavená.
        </p>
      </div>

      {!state.apiConfigured && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-bold">Ukázkový režim.</span> Google Ads API není připojeno. Denní běh a příprava
            návrhů fungují offline (bez hledanosti), odeslání do Google Ads a spuštění kampaně jsou vypnuté, dokud
            se API nepřipojí.
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={CARD}>
          <div className={LABEL}>Google Ads API</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${state.apiConfigured ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="text-[16px] font-bold text-[#001161]">
              {state.apiConfigured ? 'Připojeno' : 'Nepřipojeno – ukázkový režim'}
            </span>
          </div>
        </div>
        <div className={CARD}>
          <div className={LABEL}>Kampaň</div>
          <div className="mt-1 text-[16px] font-bold text-[#001161]">
            {!settings.campaign ? 'Ještě nezaložena' : settings.campaign.enabledAt ? 'Spuštěna' : 'Založena, pozastavená'}
          </div>
        </div>
        <div className={CARD}>
          <div className={LABEL}>Poslední běh</div>
          <div className="mt-1 text-[16px] font-bold text-[#001161]">
            {state.runs[0] ? new Date(state.runs[0].at).toLocaleString('cs-CZ') : 'zatím neběžel'}
          </div>
          {state.runs[0]?.error && (
            <div className="mt-1 text-[12px] text-red-600">chyba: {state.runs[0].error}</div>
          )}
        </div>
      </div>

      <div className={`${CARD} mb-6`}>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#001161]/60" />
          <div className="text-[16px] font-bold text-[#001161]">Nastavení</div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block w-[190px]">
            <span className={LABEL}>Denní rozpočet (Kč, strop {state.hardMaxDailyCzk})</span>
            <input className={INPUT} value={budget} placeholder="např. 500" onChange={(e) => setBudget(e.target.value)} />
          </label>
          <label className="block w-[190px]">
            <span className={LABEL}>Nejvyšší cena za klik (Kč)</span>
            <input className={INPUT} value={cpc} placeholder="např. 12" onChange={(e) => setCpc(e.target.value)} />
          </label>
          <button className={BTN_SECONDARY} disabled={!!busy}
            onClick={() => act('settings', () => call('/settings', 'PUT', { dailyBudgetCzk: Number(budget), maxCpcCzk: Number(cpc) }))}>
            Uložit
          </button>
        </div>
        {settings.campaign && state.apiConfigured && (
          <p className="mt-3 text-[12px] text-gray-500">Kampaň už existuje, rozpočet se mění přímo ve Google Ads.</p>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button className={BTN_SECONDARY} disabled={!!busy} onClick={() => act('run', () => call('/run', 'POST'))}>
          <Play className="h-4 w-4" />
          {busy === 'run' ? 'Běží…' : 'Spustit denní běh teď'}
        </button>
        <button className={BTN_PRIMARY} disabled={!!busy || approved === 0 || !state.apiConfigured}
          title={!state.apiConfigured ? 'Bez připojeného Google Ads API nelze odeslat.' : approved === 0 ? 'Nejdřív schvalte alespoň jeden návrh.' : undefined}
          onClick={() => act('push', () => call('/push', 'POST'))}>
          <Send className="h-4 w-4" />
          Odeslat schválené do Google Ads ({approved}) – pozastavené
        </button>
        <button className={BTN_DANGER}
          disabled={!!busy || !settings.campaign || !!settings.campaign.enabledAt}
          onClick={() => {
            if (window.confirm(`Opravdu spustit kampaň? Začne utrácet až ${settings.dailyBudgetCzk} Kč denně.`)) {
              act('enable', () => call('/campaign/enable', 'POST', { confirm: true }));
            }
          }}>
          <Rocket className="h-4 w-4" />
          {settings.dailyBudgetCzk > 0
            ? `Spustit kampaň (${settings.dailyBudgetCzk} Kč/den)`
            : 'Spustit kampaň (nastavte rozpočet)'}
        </button>
        <button className={BTN_SECONDARY}
          disabled={!!busy || !settings.campaign || !!settings.campaign.pausedAt}
          onClick={() => {
            if (window.confirm('Opravdu pozastavit kampaň? Kampaně se nemažou, jde ji zase spustit.')) {
              act('pause', () => call('/campaign/pause', 'POST', { confirm: true }));
            }
          }}>
          Pozastavit kampaň
        </button>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 px-4 py-3 text-[13px] text-[#001161]">{message}</div>
      )}

      {drafts.length === 0 ? (
        <div className={`${CARD} text-center`}>
          <div className="text-[16px] font-bold text-[#001161]">Zatím žádné návrhy reklam</div>
          <p className="mx-auto mt-1 max-w-[440px] text-[13px] text-gray-500">
            Spusťte denní běh a připraví se texty inzerátů a klíčová slova k schválení.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <details key={d.id} className="rounded-2xl border border-gray-100 bg-white p-5">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="text-[15px] font-bold text-[#001161]">{d.adGroupName}</span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[d.status]}`}>
                  {STATUS_LABEL[d.status]}
                </span>
                <span className="text-[12px] text-gray-500">
                  {d.keywords.length} slov{state.apiConfigured ? `, hledanost ${volume(d)}/měs.` : ''}
                </span>
                {d.problems.length > 0 && (
                  <span className="text-[12px] font-semibold text-amber-700">{d.problems[0]}</span>
                )}
              </summary>
              <div className="mt-4 grid gap-6 text-[13px] md:grid-cols-2">
                <div>
                  <div className={LABEL}>Klíčová slova</div>
                  <ul className="mt-2 space-y-1 text-[#001161]">
                    {d.keywords.map((k) => (
                      <li key={k.match + k.text}>
                        {k.match === 'EXACT' ? `[${k.text}]` : `"${k.text}"`}
                        {k.source === 'idea' && <span className="text-[11px] font-semibold text-blue-600"> nově nalezené</span>}
                        {metrics[k.text]?.volume != null && <span className="text-gray-500"> – {metrics[k.text].volume}/měs.</span>}
                        {metrics[k.text]?.highCpcKc != null && <span className="text-gray-500">, klik až {metrics[k.text].highCpcKc} Kč</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className={LABEL}>Reklama</div>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[#001161]">{d.headlines.map((h) => <li key={h}>{h}</li>)}</ul>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[#001161]">{d.descriptions.map((h) => <li key={h}>{h}</li>)}</ul>
                  <div className="mt-3 break-all text-[11px] text-gray-400">{d.finalUrl}</div>
                  {d.error && <div className="mt-2 text-[12px] text-red-700">{d.error}</div>}
                </div>
              </div>
              {d.status !== 'pushed' && (
                <div className="mt-4 flex gap-2">
                  <button className={`${BTN_SECONDARY} !px-3 !py-1.5`} disabled={!!busy || d.status === 'approved'}
                    onClick={() => act('approve', () => call(`/drafts/${d.id}/approve`, 'POST'))}>Schválit</button>
                  <button className={`${BTN_SECONDARY} !px-3 !py-1.5`} disabled={!!busy || d.status === 'rejected'}
                    onClick={() => act('reject', () => call(`/drafts/${d.id}/reject`, 'POST'))}>Zamítnout</button>
                </div>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
