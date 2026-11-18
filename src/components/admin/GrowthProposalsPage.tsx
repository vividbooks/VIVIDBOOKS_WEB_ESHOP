import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { projectId } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/admin`;

type Proposal = {
  id: string;
  type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  evidence: any;
  expected_impact: any;
  status: 'draft' | 'approved' | 'rejected' | 'applied' | 'failed';
  error?: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  pause_keyword: 'Pauznout klíčové slovo',
  add_negative: 'Přidat negativní klíčové slovo',
  flag_low_ctr: 'Nízké CTR — zkontrolovat',
  budget_reallocation: 'Přesun budgetu',
  other: 'Jiné',
};

const STATUS_LABEL: Record<Proposal['status'], string> = {
  draft: 'Návrh',
  approved: 'Schváleno',
  rejected: 'Zamítnuto',
  applied: 'Aplikováno',
  failed: 'Chyba',
};

const STATUS_STYLE: Record<Proposal['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-50 text-blue-700',
  rejected: 'bg-gray-100 text-gray-500',
  applied: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const CARD = 'rounded-2xl border border-gray-100 bg-white p-5';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_PRIMARY = `${BTN} bg-[#001161] text-white hover:bg-[#001161]/90`;
const BTN_SECONDARY = `${BTN} border border-gray-200 bg-white text-[#001161] hover:border-[#001161]/40`;
const BTN_SMALL = 'inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-bold text-[#001161] transition-colors hover:border-[#001161]/40 disabled:cursor-not-allowed disabled:opacity-40';
const SELECT = 'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-[#001161] outline-none focus:border-[#001161]/50';

function evidenceText(ev: any): string {
  if (!ev) return '—';
  const bits: string[] = [];
  if (ev.window_days) bits.push(`${ev.window_days} dní`);
  if (ev.cost_czk != null) bits.push(`${Math.round(Number(ev.cost_czk))} Kč`);
  if (ev.clicks != null) bits.push(`${ev.clicks} kliků`);
  if (ev.conversions != null) bits.push(`${ev.conversions} konverzí`);
  if (ev.impressions != null) bits.push(`${Number(ev.impressions).toLocaleString('cs-CZ')} zobrazení`);
  if (ev.ctr != null) bits.push(`CTR ${(Number(ev.ctr) * 100).toFixed(2)} %`);
  return bits.length ? bits.join(' · ') : '—';
}

function impactText(impact: any): string | null {
  if (!impact) return null;
  if (impact.save_czk_per_week != null) {
    return `Odhad úspory ~${Math.round(Number(impact.save_czk_per_week))} Kč / týden`;
  }
  if (impact.note) {
    const note = String(impact.note);
    // starší řádky mají anglickou poznámku
    if (note.startsWith('Low CTR')) {
      return 'Nízké CTR — zkontrolovat nadpisy inzerátů a klíčová slova (bez automatické změny).';
    }
    return note;
  }
  return null;
}

const STATUS_ORDER: Record<Proposal['status'], number> = {
  draft: 0, approved: 1, applied: 2, rejected: 3, failed: 4,
};

function sortProposals(list: Proposal[]): Proposal[] {
  return [...list].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

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

export default function GrowthProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [mock, setMock] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await call(`/growth-proposals${filter ? `?status=${filter}` : ''}`);
      setProposals(sortProposals(data.proposals || []));
      setMock(!!data.mock);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

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

  return (
    <div className="h-full overflow-y-auto p-8" style={FF}>
      {mock && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          <span className="font-bold">Ukázkový režim.</span> Návrhy vycházejí z ukázkových dat a „Aplikovat“
          návrh jen označí jako provedený — do Google Ads se nic neodešle.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#001161]">Návrhy optimalizace</h1>
          <p className="mt-1 max-w-[820px] text-[14px] leading-relaxed text-gray-500">
            Pravidlový engine navrhuje změny kampaní. Nic se neprovede bez vašeho schválení a ručního potvrzení.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={SELECT} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Vše</option>
            <option value="draft">Návrhy</option>
            <option value="approved">Schválené</option>
            <option value="applied">Aplikované</option>
            <option value="failed">Chyby</option>
          </select>
          <button className={BTN_PRIMARY} disabled={!!busy}
            onClick={() => act('gen', async () => {
              const r: any = await call('/growth-proposals/generate', 'POST');
              const run = r?.run || {};
              return {
                note: `Vytvořeno ${run.created ?? 0} nových návrhů, ${run.skipped ?? 0} už existovalo.`,
              };
            })}>
            <Sparkles className="h-4 w-4" />
            {busy === 'gen' ? 'Generuji…' : 'Vygenerovat návrhy'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl bg-gray-100 px-4 py-3 text-[13px] text-[#001161]">{message}</div>
      )}

      {loading ? (
        <div className={`${CARD} text-center text-[13px] text-gray-500`}>Načítám návrhy…</div>
      ) : proposals.length === 0 ? (
        <div className={`${CARD} text-center`}>
          <div className="text-[16px] font-bold text-[#001161]">Žádné návrhy</div>
          <p className="mx-auto mt-1 max-w-[460px] text-[13px] text-gray-500">
            Nejprve načtěte data na kartě Výkon, pak tu klikněte na „Vygenerovat návrhy“.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const impact = impactText(p.expected_impact);
            return (
              <div key={p.id} className={CARD}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-[#001161]">{TYPE_LABEL[p.type] || p.type}</span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">{new Date(p.created_at).toLocaleString('cs-CZ')}</span>
                </div>
                <div className="mt-2 text-[14px] font-semibold text-[#001161]">{p.entity_name || p.entity_id}</div>
                <div className="mt-1 text-[13px] text-gray-500">{evidenceText(p.evidence)}</div>
                {impact && <div className="mt-1 text-[12px] font-semibold text-amber-700">{impact}</div>}
                {p.error && <div className="mt-2 text-[12px] text-red-600">{p.error}</div>}
                <div className="mt-3 flex gap-2">
                  {p.status === 'draft' && (
                    <>
                      <button className={BTN_SMALL} disabled={!!busy}
                        onClick={() => act(p.id, () => call(`/growth-proposals/${p.id}/approve`, 'POST'))}>Schválit</button>
                      <button className={BTN_SMALL} disabled={!!busy}
                        onClick={() => act(p.id, () => call(`/growth-proposals/${p.id}/reject`, 'POST'))}>Zamítnout</button>
                    </>
                  )}
                  {p.status === 'approved' && (
                    <button className={`${BTN} !px-3 !py-1.5 !text-[12px] bg-[#001161] text-white hover:bg-[#001161]/90`} disabled={!!busy}
                      onClick={() => act(p.id, () => call(`/growth-proposals/${p.id}/apply`, 'POST'))}>
                      {busy === p.id ? 'Aplikuji…' : mock ? 'Aplikovat (ukázkově)' : 'Aplikovat (Google Ads)'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
