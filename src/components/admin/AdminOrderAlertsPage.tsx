import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Filter, ShieldAlert } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner@2.0.3';
import {
  fetchAdminOrderAlerts,
  runAdminOrderAlertAction,
  type AdminOrderAlert,
} from '../../utils/adminApi';
import { orderAlertTypeLabelCs } from '../../utils/orderAlertLabels';
import { incidentResolutionStateLabelCs, incidentSeverityLabelCs } from '../../utils/incidentLabels';

/** Workflow řešení incidentu (DB: open / acknowledged / resolved) — nezaměňovat se stavem objednávky. */
const RESOLUTION_STATE_FILTERS = [
  { id: 'open', label: 'Čeká na vyřízení', hint: 'Nikdo z týmu ještě nepotvrdil převzetí.' },
  { id: 'acknowledged', label: 'V řešení', hint: 'Někdo incident převzal a řeší ho.' },
  { id: 'resolved', label: 'Uzavřené', hint: 'Incident vyřešen nebo neaktuální.' },
  { id: 'all', label: 'Všechny stavy', hint: 'Všechny kroky workflow.' },
] as const;

const SEVERITY_FILTERS = [
  { id: '', label: 'Všechny úrovně' },
  { id: 'critical', label: 'Kritická' },
  { id: 'warning', label: 'Varování' },
  { id: 'info', label: 'Info' },
] as const;

const SCOPE_FILTERS = [
  { id: 'all' as const, label: 'Vše (e-shop + web)' },
  { id: 'orders' as const, label: 'Jen objednávky' },
  { id: 'site' as const, label: 'Jen web (webináře, …)' },
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityClass(severity: string) {
  if (severity === 'critical') return 'bg-red-100 text-red-700';
  if (severity === 'warning') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

function stateClass(state: string) {
  if (state === 'open') return 'bg-red-100 text-red-700';
  if (state === 'acknowledged') return 'bg-indigo-100 text-indigo-700';
  if (state === 'resolved') return 'bg-emerald-100 text-emerald-700';
  return 'bg-gray-100 text-gray-700';
}

export function AdminOrderAlertsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<AdminOrderAlert[]>([]);
  const [alertTypes, setAlertTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [state, setState] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('open');
  const [severity, setSeverity] = useState<'' | 'info' | 'warning' | 'critical'>('');
  /** Kód typu z `order_alerts.alert_type` — synchronizace s `?typ=` v URL */
  const [alertType, setAlertType] = useState(() => (searchParams.get('typ') || '').trim());
  const [scope, setScope] = useState<'all' | 'orders' | 'site'>(() => {
    const s = (searchParams.get('scope') || 'all').trim();
    if (s === 'orders' || s === 'site') return s;
    return 'all';
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pageSize = 20;

  const loadAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOrderAlerts({ state, severity, alertType, scope, page, pageSize });
      setAlerts(data.items || []);
      setTotal(data.total || 0);
      setAlertTypes(Array.isArray(data.alertTypes) ? data.alertTypes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst alerty.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, [state, severity, alertType, scope, page]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (alertType) next.set('typ', alertType);
      else next.delete('typ');
      if (scope && scope !== 'all') next.set('scope', scope);
      else next.delete('scope');
      return next;
    }, { replace: true });
  }, [alertType, scope, setSearchParams]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    try {
      setActionLoading(alertId);
      await runAdminOrderAlertAction({ alertId, action });
      toast.success(
        action === 'acknowledge'
          ? 'Incident převzat do řešení.'
          : 'Incident uzavřen.',
      );
      await loadAlerts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Akci se nepodařilo provést.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[#001161] font-['Fenomen_Sans']">
            {'Centrála alertů'}
          </h1>
          <p className="text-gray-500 mt-1 text-[14px] max-w-[920px] leading-relaxed">
            {
              'Jedna fronta pro provozní incidenty: z e-shopu (monitoring objednávek) i z webu (např. neodeslaný e-mail, Mailchimp). Filtr „stav řešení“ popisuje jen to, zda někdo z týmu incident převzal a uzavřel — '
            }
            <span className="font-semibold text-[#001161]/80">
              {'není to stav objednávky ani fáze platby.'}
            </span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex flex-col gap-4">
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{'Zdroj'}</div>
          <div className="flex flex-wrap gap-2">
            {SCOPE_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setScope(item.id);
                }}
                className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${
                  scope === item.id
                    ? 'bg-[#001161] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-[12px] font-bold text-gray-500 uppercase tracking-wide shrink-0">
            <Filter className="w-4 h-4" />
            {'Typ'}
          </div>
          <select
            value={alertType}
            onChange={(e) => {
              setPage(1);
              setAlertType(e.target.value);
            }}
            className="w-full sm:max-w-md px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#001161]/20 focus:border-[#001161]"
          >
            <option value="">{'Všechny typy'}</option>
            {alertType && !alertTypes.includes(alertType) ? (
              <option value={alertType}>{`${alertType} (${orderAlertTypeLabelCs(alertType)})`}</option>
            ) : null}
            {alertTypes.map((t) => (
              <option key={t} value={t}>
                {orderAlertTypeLabelCs(t)}
                {` (${t})`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
              {'Stav řešení incidentu'}
            </div>
            <p className="text-[10px] text-gray-500 leading-snug -mt-0.5 mb-1">
              {
                'Čeká → někdo převezme („V řešení“) → uzavře. Stejné sloupce v DB jako u objednávkových alertů, ale význam je vždy „kdo to řeší“, ne stav zakázky.'
              }
            </p>
            <div className="flex flex-wrap gap-2">
              {RESOLUTION_STATE_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  onClick={() => {
                    setPage(1);
                    setState(item.id);
                  }}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${
                    state === item.id
                      ? 'bg-[#001161] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{'Závažnost incidentu'}</div>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_FILTERS.map((item) => (
                <button
                  key={item.id || 'all'}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSeverity(item.id);
                  }}
                  className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${
                    severity === item.id
                      ? 'bg-[#001161] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.id === '' ? item.label : incidentSeverityLabelCs(item.id)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))
        ) : error ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-red-600">
            {error}
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <ShieldAlert className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <div className="text-[16px] font-bold text-[#001161]">{'Žádné incidenty'}</div>
            <div className="text-[13px] text-gray-500 mt-1 max-w-md mx-auto">
              {
                'Pro zvolené filtry není žádný záznam. Zkuste „Všechny stavy řešení“, jiný zdroj (E-shop / Web) nebo typ.'
              }
            </div>
          </div>
        ) : (
          alerts.map((alert) => {
            const origin = alert.origin ?? 'order';
            return (
            <div key={alert.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        origin === 'site' ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-800'
                      }`}
                      title={origin === 'site' ? 'Incident z webu (app_incidents)' : 'Alert z objednávek (order_alerts)'}
                    >
                      {origin === 'site' ? 'Web' : 'E-shop'}
                    </span>
                    <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-700">
                      {orderAlertTypeLabelCs(alert.alert_type)}
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${severityClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${stateClass(alert.state)}`}>
                      {alert.state}
                    </span>
                    {alert.order_number && (
                      <span className="inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold bg-gray-100 text-gray-700">
                        {alert.order_number}
                      </span>
                    )}
                  </div>
                  {origin === 'site' && (alert.webinar_id || alert.contact_email) ? (
                    <p className="mt-2 text-[12px] text-gray-500">
                      {alert.webinar_title ? (
                        <span className="font-semibold text-[#001161]/80">{alert.webinar_title}</span>
                      ) : null}
                      {alert.webinar_id ? (
                        <span className="font-mono text-[11px] text-gray-400 ml-1">{`id: ${alert.webinar_id}`}</span>
                      ) : null}
                      {alert.contact_email ? (
                        <span className="block sm:inline sm:ml-2">{`E-mail: ${alert.contact_email}`}</span>
                      ) : null}
                    </p>
                  ) : null}
                  <h2 className="mt-3 text-[16px] font-bold text-[#001161]">{alert.title}</h2>
                  <p className="mt-2 text-[14px] text-gray-600 leading-relaxed">{alert.message}</p>
                  <div className="mt-3 flex items-center gap-4 text-[12px] text-gray-400 flex-wrap">
                    <span>{`Poprvé: ${formatDate(alert.first_seen_at)}`}</span>
                    <span>{`Naposledy: ${formatDate(alert.last_seen_at)}`}</span>
                    {alert.acknowledged_at && (
                      <span>{`Převzato do řešení: ${formatDate(alert.acknowledged_at)}`}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {alert.order_id && (
                    <button
                      onClick={() => navigate(`/admin/objednavky/${alert.order_id}`)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EEF1FA] text-[#001161] text-[13px] font-bold"
                    >
                      {'Otevřít objednávku'}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {alert.state === 'open' && (
                    <button
                      onClick={() => handleAction(alert.id, 'acknowledge')}
                      disabled={actionLoading === alert.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 text-amber-800 text-[13px] font-bold disabled:opacity-40"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      {'Převzít do řešení'}
                    </button>
                  )}
                  {alert.state !== 'resolved' && (
                    <button
                      onClick={() => handleAction(alert.id, 'resolve')}
                      disabled={actionLoading === alert.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-[13px] font-bold disabled:opacity-40"
                    >
                      {'Uzavřít incident'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[13px] text-gray-500">
          {`${Math.min((page - 1) * pageSize + 1, total || 0)}-${Math.min(page * pageSize, total || 0)} z ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#001161] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {'Předchozí'}
          </button>
          <div className="text-[13px] font-bold text-[#001161]">{`${page} / ${totalPages}`}</div>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-[13px] font-bold text-[#001161] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {'Další'}
          </button>
        </div>
      </div>
    </div>
  );
}
