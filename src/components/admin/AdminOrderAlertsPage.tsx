import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import {
  fetchAdminOrderAlerts,
  runAdminOrderAlertAction,
  type AdminOrderAlert,
} from '../../utils/adminApi';

const STATE_FILTERS = [
  { id: 'open', label: 'Otevřené' },
  { id: 'acknowledged', label: 'Potvrzené' },
  { id: 'resolved', label: 'Vyřešené' },
  { id: 'all', label: 'Vše' },
] as const;

const SEVERITY_FILTERS = [
  { id: '', label: 'Všechny severity' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Info' },
] as const;

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
  const [alerts, setAlerts] = useState<AdminOrderAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [state, setState] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('open');
  const [severity, setSeverity] = useState<'' | 'info' | 'warning' | 'critical'>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pageSize = 20;

  const loadAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOrderAlerts({ state, severity, page, pageSize });
      setAlerts(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst alerty.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, [state, severity, page]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );

  const handleAction = async (alertId: string, action: 'acknowledge' | 'resolve') => {
    try {
      setActionLoading(alertId);
      await runAdminOrderAlertAction({ alertId, action });
      toast.success(action === 'acknowledge' ? 'Alert potvrzen.' : 'Alert vyřešen.');
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
            {'Alerty objednávek'}
          </h1>
          <p className="text-gray-500 mt-1 text-[14px]">
            {'Monitoring zaseknutých kroků, failů a self-heal stavu objednávek'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATE_FILTERS.map((item) => (
            <button
              key={item.id}
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

        <div className="flex flex-wrap gap-2">
          {SEVERITY_FILTERS.map((item) => (
            <button
              key={item.id || 'all'}
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
              {item.label}
            </button>
          ))}
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
            <div className="text-[16px] font-bold text-[#001161]">{'Žádné alerty'}</div>
            <div className="text-[13px] text-gray-500 mt-1">{'Aktuální filtr nevrátil žádné provozní incidenty.'}</div>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  <h2 className="mt-3 text-[16px] font-bold text-[#001161]">{alert.title}</h2>
                  <p className="mt-2 text-[14px] text-gray-600 leading-relaxed">{alert.message}</p>
                  <div className="mt-3 flex items-center gap-4 text-[12px] text-gray-400 flex-wrap">
                    <span>{`Poprvé: ${formatDate(alert.first_seen_at)}`}</span>
                    <span>{`Naposledy: ${formatDate(alert.last_seen_at)}`}</span>
                    {alert.acknowledged_at && <span>{`Potvrzeno: ${formatDate(alert.acknowledged_at)}`}</span>}
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
                      {'Potvrdit'}
                    </button>
                  )}
                  {alert.state !== 'resolved' && (
                    <button
                      onClick={() => handleAction(alert.id, 'resolve')}
                      disabled={actionLoading === alert.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-[13px] font-bold disabled:opacity-40"
                    >
                      {'Označit jako vyřešené'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
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
