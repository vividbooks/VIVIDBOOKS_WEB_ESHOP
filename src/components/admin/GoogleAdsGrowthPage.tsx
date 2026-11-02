import { useCallback, useEffect, useState } from 'react';
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
      setBudget(String(s.settings.dailyBudgetCzk));
      setCpc(String(s.settings.maxCpcCzk));
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

  if (!state) return <div className="p-6 text-sm text-gray-600">{message || 'Načítám…'}</div>;

  const { settings, drafts, metrics } = state;
  const approved = drafts.filter((d) => d.status === 'approved').length;
  const volume = (d: Draft) => d.keywords.filter((k) => k.match === 'PHRASE')
    .reduce((s, k) => s + (metrics[k.text]?.volume ?? 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Google Ads – automatizace</h1>
        <p className="text-sm text-gray-600 mt-1">
          Každý den se zjistí hledanost a připraví návrhy reklam. Do Google Ads se nic nepošle bez vašeho schválení
          a kampaň vzniká pozastavená.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border p-3">
          <div className="text-gray-500">Google Ads API</div>
          <div className="font-medium">{state.apiConfigured ? 'Připojeno' : 'Nepřipojeno (jen návrhy bez hledanosti)'}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-gray-500">Kampaň</div>
          <div className="font-medium">
            {!settings.campaign ? 'Ještě nezaložena' : settings.campaign.enabledAt ? 'Spuštěna' : 'Založena, pozastavená'}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-gray-500">Poslední běh</div>
          <div className="font-medium">
            {state.runs[0] ? new Date(state.runs[0].at).toLocaleString('cs-CZ') : 'zatím neběžel'}
            {state.runs[0]?.error ? ` – chyba: ${state.runs[0].error}` : ''}
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="font-medium">Nastavení</div>
        <div className="flex flex-wrap gap-4 items-end text-sm">
          <label className="block">
            Denní rozpočet (Kč, strop {state.hardMaxDailyCzk})
            <input className="block mt-1 border rounded px-2 py-1 w-32" value={budget} onChange={(e) => setBudget(e.target.value)}
              disabled={!!settings.campaign} />
          </label>
          <label className="block">
            Nejvyšší cena za klik (Kč)
            <input className="block mt-1 border rounded px-2 py-1 w-32" value={cpc} onChange={(e) => setCpc(e.target.value)}
              disabled={!!settings.campaign} />
          </label>
          <button className="border rounded px-3 py-1.5" disabled={!!busy || !!settings.campaign}
            onClick={() => act('settings', () => call('/settings', 'PUT', { dailyBudgetCzk: Number(budget), maxCpcCzk: Number(cpc) }))}>
            Uložit
          </button>
        </div>
        {settings.campaign && <p className="text-xs text-gray-500">Kampaň už existuje, rozpočet se mění přímo ve Google Ads.</p>}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <button className="border rounded px-3 py-1.5" disabled={!!busy} onClick={() => act('run', () => call('/run', 'POST'))}>
          {busy === 'run' ? 'Běží…' : 'Spustit denní běh teď'}
        </button>
        <button className="border rounded px-3 py-1.5 bg-gray-900 text-white" disabled={!!busy || approved === 0 || !state.apiConfigured}
          onClick={() => act('push', () => call('/push', 'POST'))}>
          Odeslat schválené do Google Ads ({approved}) – pozastavené
        </button>
        <button className="border rounded px-3 py-1.5 border-red-500 text-red-700"
          disabled={!!busy || !settings.campaign || !!settings.campaign.enabledAt}
          onClick={() => {
            if (window.confirm(`Opravdu spustit kampaň? Začne utrácet až ${settings.dailyBudgetCzk} Kč denně.`)) {
              act('enable', () => call('/campaign/enable', 'POST', { confirm: true }));
            }
          }}>
          Spustit kampaň ({settings.dailyBudgetCzk} Kč/den)
        </button>
      </div>
      {message && <div className="text-sm rounded bg-gray-100 px-3 py-2">{message}</div>}

      <div className="space-y-3">
        {drafts.map((d) => (
          <details key={d.id} className="rounded-lg border p-3">
            <summary className="cursor-pointer flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{d.adGroupName}</span>
              <span className="text-gray-500">{STATUS_LABEL[d.status]}</span>
              <span className="text-gray-500">{d.keywords.length} slov{state.apiConfigured ? `, hledanost ${volume(d)}/měs.` : ''}</span>
              {d.problems.length > 0 && <span className="text-amber-700">{d.problems[0]}</span>}
            </summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <div className="font-medium mb-1">Klíčová slova</div>
                <ul className="space-y-0.5">
                  {d.keywords.map((k) => (
                    <li key={k.match + k.text}>
                      {k.match === 'EXACT' ? `[${k.text}]` : `"${k.text}"`}
                      {k.source === 'idea' && <span className="text-xs text-blue-600"> nově nalezené</span>}
                      {metrics[k.text]?.volume != null && <span className="text-gray-500"> – {metrics[k.text].volume}/měs.</span>}
                      {metrics[k.text]?.highCpcKc != null && <span className="text-gray-500">, klik až {metrics[k.text].highCpcKc} Kč</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Reklama</div>
                <ul className="list-disc pl-4">{d.headlines.map((h) => <li key={h}>{h}</li>)}</ul>
                <ul className="list-disc pl-4 mt-2">{d.descriptions.map((h) => <li key={h}>{h}</li>)}</ul>
                <div className="mt-2 text-xs text-gray-500 break-all">{d.finalUrl}</div>
                {d.error && <div className="mt-2 text-red-700">{d.error}</div>}
              </div>
            </div>
            {d.status !== 'pushed' && (
              <div className="mt-3 flex gap-2 text-sm">
                <button className="border rounded px-3 py-1" disabled={!!busy || d.status === 'approved'}
                  onClick={() => act('approve', () => call(`/drafts/${d.id}/approve`, 'POST'))}>Schválit</button>
                <button className="border rounded px-3 py-1" disabled={!!busy || d.status === 'rejected'}
                  onClick={() => act('reject', () => call(`/drafts/${d.id}/reject`, 'POST'))}>Zamítnout</button>
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
