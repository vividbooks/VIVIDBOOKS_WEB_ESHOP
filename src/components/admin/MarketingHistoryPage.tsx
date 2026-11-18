import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, History, RefreshCw } from 'lucide-react';
import { projectId } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/admin`;

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const CARD = 'rounded-2xl border border-gray-100 bg-white p-5';
const LABEL = 'text-[11px] font-bold uppercase tracking-wide text-gray-400';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_SECONDARY = `${BTN} border border-gray-200 bg-white text-[#001161] hover:border-[#001161]/40`;

type AuditEntry = {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  entity: string | null;
  result: any;
  error: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  pause_keyword: 'Pauznout klíčové slovo',
  add_negative: 'Přidat negativní klíčové slovo',
  flag_low_ctr: 'Nízké CTR — zkontrolovat',
  budget_reallocation: 'Přesun budgetu',
};

async function call(path: string) {
  const { getRequiredEdgeFunctionHeaders } = await import('../../lib/edgeFunctionHeaders');
  const res = await fetch(`${BASE}${path}`, { headers: await getRequiredEdgeFunctionHeaders(true) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Chyba ${res.status}`);
  return json;
}

const num = (n: unknown) => (Number(n) || 0).toLocaleString('cs-CZ');
const czk = (n: unknown) => `${num(Math.round(Number(n) || 0))} Kč`;
const time = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('cs-CZ');
};

export default function MarketingHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [alerts, setAlerts] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [audit, alertsRes, snap] = await Promise.all([
        call('/growth-audit-log').catch(() => ({ entries: [] })),
        call('/marketing/alerts').catch(() => ({ last: null })),
        call('/marketing/snapshot').catch(() => ({ latest: null })),
      ]);
      setEntries(audit.entries || []);
      setAlerts(alertsRes);
      setSnapshot(snap?.latest || null);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingAlerts: string[] = Array.isArray(alerts?.last?.list) ? alerts.last.list : [];
  const totals = snapshot?.totals || null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold text-[#001161]" style={FF}>Historie a stav</h2>
            <p className="mt-1 text-[13px] text-[#001161]/50" style={FF}>
              Co agent provedl, jaká upozornění vydal a co vidí z aplikace.
            </p>
          </div>
          <button className={BTN_SECONDARY} onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Obnovit
          </button>
        </div>

        {message ? <div className={`${CARD} text-[13px] text-[#001161]`} style={FF}>{message}</div> : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={CARD}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${pendingAlerts.length ? 'text-amber-600' : 'text-[#001161]'}`} />
              <div className="text-[13px] font-bold text-[#001161]" style={FF}>Upozornění</div>
            </div>
            <div className="mt-1 text-[11px] text-[#001161]/40" style={FF}>
              Poslední kontrola {time(alerts?.last?.at)}
              {alerts?.slackConfigured ? ' · Slack nastaven' : ' · Slack nenastaven'}
            </div>
            {pendingAlerts.length === 0 ? (
              <p className="mt-4 text-[13px] text-[#001161]/50" style={FF}>Žádná upozornění.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {pendingAlerts.map((a, i) => (
                  <li key={i} className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900" style={FF}>
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={CARD}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#001161]" />
              <div className="text-[13px] font-bold text-[#001161]" style={FF}>Data z aplikace (B2B)</div>
            </div>
            {!totals ? (
              <p className="mt-4 text-[13px] text-[#001161]/50" style={FF}>Snapshot zatím nedorazil.</p>
            ) : (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]" style={FF}>
                <dt className="text-[#001161]/50">Školy</dt>
                <dd className="text-right font-bold text-[#001161]">{num(totals.organizations)}</dd>
                <dt className="text-[#001161]/50">Aktivní licence</dt>
                <dd className="text-right font-bold text-[#001161]">{num(totals.active_licenses)}</dd>
                <dt className="text-[#001161]/50">Placené školy</dt>
                <dd className="text-right font-bold text-[#001161]">{num(totals.paid_organizations)}</dd>
                <dt className="text-[#001161]/50">Trial školy</dt>
                <dd className="text-right font-bold text-[#001161]">{num(totals.trial_organizations)}</dd>
                <dt className="text-[#001161]/50">Sešity (12 měsíců)</dt>
                <dd className="text-right font-bold text-[#001161]">
                  {num(totals.workbook_orders_12m_units)} ks
                </dd>
                <dt className="text-[#001161]/50">Obrat sešitů</dt>
                <dd className="text-right font-bold text-[#001161]">
                  {czk(totals.workbook_orders_12m_revenue_czk)}
                </dd>
                <dt className="text-[#001161]/50">S atribucí</dt>
                <dd className="text-right font-bold text-[#001161]">{num(totals.attributed_organizations)}</dd>
              </dl>
            )}
            {snapshot?.generated_at ? (
              <div className="mt-3 text-[11px] text-[#001161]/40" style={FF}>
                Staženo {time(snapshot.generated_at)}
                {snapshot.attribution_available === false ? ' · atribuční sloupce nejsou v DB' : ''}
              </div>
            ) : null}
          </div>
        </div>

        <div className={CARD}>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#001161]" />
            <div className="text-[13px] font-bold text-[#001161]" style={FF}>Co agent provedl</div>
          </div>
          {entries.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#001161]/50" style={FF}>Zatím žádný zásah.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[12px]" style={FF}>
                <thead>
                  <tr className={LABEL}>
                    <th className="pb-2 pr-4 font-bold">Kdy</th>
                    <th className="pb-2 pr-4 font-bold">Akce</th>
                    <th className="pb-2 pr-4 font-bold">Entita</th>
                    <th className="pb-2 pr-4 font-bold">Kdo</th>
                    <th className="pb-2 font-bold">Výsledek</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-gray-50">
                      <td className="py-2 pr-4 whitespace-nowrap text-[#001161]/50">{time(e.at)}</td>
                      <td className="py-2 pr-4 font-semibold text-[#001161]">
                        {ACTION_LABEL[e.action] || e.action}
                      </td>
                      <td className="py-2 pr-4 text-[#001161]/70">{e.entity || '—'}</td>
                      <td className="py-2 pr-4 text-[#001161]/50">{e.actor || '—'}</td>
                      <td className="py-2">
                        {e.error ? (
                          <span className="text-red-700">{e.error}</span>
                        ) : e.result?.mock ? (
                          <span className="text-[#001161]/50">ukázkový režim</span>
                        ) : (
                          <span className="text-green-700">provedeno</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
