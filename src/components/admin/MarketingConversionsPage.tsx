import { useCallback, useEffect, useState } from 'react';
import { ArrowDownUp, RefreshCw, ShieldCheck } from 'lucide-react';
import { projectId } from '../../utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/admin`;

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const CARD = 'rounded-2xl border border-gray-100 bg-white p-5';
const LABEL = 'text-[11px] font-bold uppercase tracking-wide text-gray-400';
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_PRIMARY = `${BTN} bg-[#001161] text-white hover:bg-[#001161]/90`;
const BTN_SECONDARY = `${BTN} border border-gray-200 bg-white text-[#001161] hover:border-[#001161]/40`;

type Health = {
  purchases: {
    total: number;
    withGclid: number;
    withAnon: number;
    consentMarketing: number;
    consentAnalytics: number;
    revenueCzk: number;
  };
  offline: {
    byStatus: Record<string, number>;
    blockedByConsent: number;
    withGclid: number;
    withEmail: number;
    valueCzk: number;
  };
  uploadConfigured: boolean;
  runs: {
    conversions: any;
    offline: any;
    snapshot: any;
  };
};

async function call(path: string, method = 'GET') {
  const { getRequiredEdgeFunctionHeaders } = await import('../../lib/edgeFunctionHeaders');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: await getRequiredEdgeFunctionHeaders(true),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Chyba ${res.status}`);
  return json;
}

const num = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('cs-CZ');
const czk = (n: number | null | undefined) => `${num(Math.round(Number(n) || 0))} Kč`;
const time = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('cs-CZ');
};

function Tile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={CARD}>
      <div className={LABEL}>{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent ? 'text-amber-600' : 'text-[#001161]'}`} style={FF}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-[#001161]/40" style={FF}>{hint}</div> : null}
    </div>
  );
}

export default function MarketingConversionsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: Health = await call('/marketing/conversion-health');
      setHealth(data);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (kind: 'purchases' | 'offline') => {
    setBusy(kind);
    setMessage(null);
    try {
      const path = kind === 'purchases' ? '/marketing/conversions/sync' : '/marketing/offline-conversions/sync';
      const res: any = await call(path, 'POST');
      const r = res?.run || {};
      const text = kind === 'purchases'
        ? `Nových nákupů: ${r.inserted ?? 0}, GA4 odesláno: ${r.ga4Sent ?? 0}.`
        : `Staženo ${r.pulled ?? 0}, k odeslání ${r.newPending ?? 0}, blokováno souhlasem ${r.blockedByConsent ?? 0}.`;
      setMessage(text);
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading && !health) {
    return <div className="p-6 text-[13px] text-[#001161]/60" style={FF}>Načítám konverze…</div>;
  }

  const p = health?.purchases;
  const o = health?.offline;
  const pending = o?.byStatus?.pending ?? 0;
  const blocked = o?.blockedByConsent ?? 0;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h2 className="text-[17px] font-bold text-[#001161]" style={FF}>Konverze a jejich přenos</h2>
          <p className="mt-1 text-[13px] text-[#001161]/50" style={FF}>
            Co se z e-shopu a z aplikace pošle do Google Ads, co má atribuci a co čeká na souhlas.
          </p>
        </div>

        {message ? (
          <div className={`${CARD} text-[13px] text-[#001161]`} style={FF}>{message}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Nákupy (server)"
            value={num(p?.total)}
            hint={`obrat ${czk(p?.revenueCzk)}`}
          />
          <Tile
            label="S click ID"
            value={num(p?.withGclid)}
            hint={p?.total ? `pokrytí ${Math.round((p.withGclid / p.total) * 100)} %` : '—'}
          />
          <Tile
            label="Souhlas s marketingem"
            value={num(p?.consentMarketing)}
            hint={p?.total ? `z ${num(p.total)} nákupů` : '—'}
          />
          <Tile
            label="Offline fronta"
            value={num(pending)}
            hint={`${num(o?.byStatus?.uploaded ?? 0)} odesláno`}
            accent={blocked > 0}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={CARD}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#001161]" />
              <div className="text-[13px] font-bold text-[#001161]" style={FF}>Souhlasy a identifikátory</div>
            </div>
            <dl className="mt-4 space-y-2 text-[13px]" style={FF}>
              <div className="flex justify-between">
                <dt className="text-[#001161]/50">Offline konverze blokované souhlasem</dt>
                <dd className={`font-bold ${blocked > 0 ? 'text-amber-600' : 'text-[#001161]'}`}>{num(blocked)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#001161]/50">Offline konverze s click ID</dt>
                <dd className="font-bold text-[#001161]">{num(o?.withGclid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#001161]/50">Offline konverze s e-mailem</dt>
                <dd className="font-bold text-[#001161]">{num(o?.withEmail)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#001161]/50">Hodnota offline konverzí</dt>
                <dd className="font-bold text-[#001161]">{czk(o?.valueCzk)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#001161]/50">Odesílání do Google Ads</dt>
                <dd className={`font-bold ${health?.uploadConfigured ? 'text-green-700' : 'text-amber-600'}`}>
                  {health?.uploadConfigured ? 'nastaveno' : 'není nastaveno'}
                </dd>
              </div>
            </dl>
            {!health?.uploadConfigured ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-800" style={FF}>
                Chybí <code>GOOGLE_ADS_CONVERSION_ACTION</code>. Konverze se ukládají do fronty, ale do Google Ads se nic neposílá.
              </p>
            ) : null}
          </div>

          <div className={CARD}>
            <div className="flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4 text-[#001161]" />
              <div className="text-[13px] font-bold text-[#001161]" style={FF}>Poslední běhy</div>
            </div>
            <dl className="mt-4 space-y-2 text-[13px]" style={FF}>
              <div className="flex justify-between gap-4">
                <dt className="text-[#001161]/50">Nákupy</dt>
                <dd className="text-right font-semibold text-[#001161]">{time(health?.runs?.conversions?.at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#001161]/50">Offline konverze</dt>
                <dd className="text-right font-semibold text-[#001161]">{time(health?.runs?.offline?.at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#001161]/50">Snapshot z aplikace</dt>
                <dd className="text-right font-semibold text-[#001161]">{time(health?.runs?.snapshot?.at)}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className={BTN_PRIMARY} disabled={!!busy} onClick={() => run('purchases')}>
                <RefreshCw className={`h-4 w-4 ${busy === 'purchases' ? 'animate-spin' : ''}`} />
                Synchronizovat nákupy
              </button>
              <button className={BTN_SECONDARY} disabled={!!busy} onClick={() => run('offline')}>
                <RefreshCw className={`h-4 w-4 ${busy === 'offline' ? 'animate-spin' : ''}`} />
                Synchronizovat offline konverze
              </button>
            </div>
          </div>
        </div>

        <div className={`${CARD} text-[12px] leading-relaxed text-[#001161]/60`} style={FF}>
          Nákupy z e-shopu se párují přes anonymní ID z pokladny nebo přes e-mail. Offline konverze (placené licence)
          se do Google Ads pošle jen tehdy, když má škola nebo učitel výslovný souhlas s marketingem. Bez souhlasu
          zůstane konverze ve frontě a čeká — nic se nezahazuje.
        </div>
      </div>
    </div>
  );
}
