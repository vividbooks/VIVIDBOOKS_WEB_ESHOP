import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Package,
  Truck,
  CreditCard,
  RefreshCw,
  Repeat,
  Ban,
  Send,
  Download,
  CheckCircle2,
  Circle,
  GraduationCap,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner@2.0.3';
import {
  fetchAdminOrderDetail,
  downloadIdokladInvoicePdf,
  runAdminOrderAction,
  type AdminOrderAlert,
  type AdminOrderDetail,
  type AdminOrderEvent,
  type AdminOrderItem,
  type AdminOrderStockMeta,
  type AdminOrderWorkflowStep,
  type AdminBasecomFulfillment,
} from '../../utils/adminApi';
import { orderAlertTypeLabelCs } from '../../utils/orderAlertLabels';
import { incidentResolutionStateLabelCs, incidentSeverityLabelCs } from '../../utils/incidentLabels';

function formatPrice(amountInHaler: number) {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

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

function badgeClass(status: string) {
  if (['paid', 'exported', 'shipped', 'delivered', 'done'].includes(status)) {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (['pending', 'pending_payment', 'processing'].includes(status)) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-red-100 text-red-700';
}

function workflowLabel(stepKey: string) {
  switch (stepKey) {
    case 'payment_received':
      return 'Platba přijata';
    case 'order_persisted':
      return 'Objednávka uložena';
    case 'customer_email_sent':
      return 'Potvrzovací email';
    case 'basecom_exported':
      return 'Export do Base.com';
    case 'idoklad_exported':
      return 'Export do iDokladu';
    case 'shipment_created':
      return 'Zásilka vytvořena';
    default:
      return stepKey;
  }
}

function alertSeverityClass(severity: string) {
  if (severity === 'critical') return 'bg-red-100 text-red-700';
  if (severity === 'warning') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

function alertStateClass(state: string) {
  if (state === 'open') return 'bg-red-100 text-red-700';
  if (state === 'acknowledged') return 'bg-indigo-100 text-indigo-700';
  if (state === 'resolved') return 'bg-emerald-100 text-emerald-700';
  return 'bg-gray-100 text-gray-700';
}

function stripeUrl(id?: string | null) {
  return id ? `https://dashboard.stripe.com/payments/${id}` : null;
}

function basecomUrl(id?: string | null) {
  return id ? `https://panel.baselinker.com/orders.php?id=${id}` : null;
}

function pipedriveDealUrl(id?: string | number | null) {
  if (id == null || id === '') return null;
  const s = String(id).trim();
  return s ? `https://app.pipedrive.com/deal/${s}` : null;
}

function shippingLabel(method: string) {
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
      return method;
  }
}

function stockSourceLabel(source?: string | null) {
  switch (source) {
    case 'basecom_api':
      return 'Base.com API';
    case 'feed':
      return 'Feed';
    default:
      return 'Nenalezeno';
  }
}

function stockQuantityLabel(item: AdminOrderItem) {
  if (typeof item.stock_quantity === 'number') return `${item.stock_quantity} ks`;
  if (item.stock_source === 'feed') return 'Bez množství';
  return '—';
}

/** API může vrátit snake_case nebo camelCase. */
function workflowStepKey(step: AdminOrderWorkflowStep): string {
  const row = step as unknown as Record<string, unknown>;
  const k = row.step_key ?? row.stepKey;
  return typeof k === 'string' ? k : '';
}

function truncateText(text: string, maxLen: number) {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function basecomStepSourceHint(source: string): string {
  switch (source) {
    case 'tag':
      return 'štítek';
    case 'api_field':
      return 'pole v Base.com';
    case 'history':
      return 'pick/pack historie';
    case 'inferred':
      return 'odvozeno';
    default:
      return source;
  }
}

export function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [items, setItems] = useState<AdminOrderItem[]>([]);
  const [events, setEvents] = useState<AdminOrderEvent[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<AdminOrderWorkflowStep[]>([]);
  const [alerts, setAlerts] = useState<AdminOrderAlert[]>([]);
  const [stockMeta, setStockMeta] = useState<AdminOrderStockMeta | null>(null);
  const [basecomFulfillment, setBasecomFulfillment] = useState<AdminBasecomFulfillment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canRetryExport = order?.basecom_status === 'failed';
  const idokladWorkflowStep = useMemo(
    () => workflowSteps.find((s) => workflowStepKey(s) === 'idoklad_exported'),
    [workflowSteps],
  );
  const canRetryIdoklad = useMemo(() => {
    if (order?.invoice_status === 'done') return false;
    if (order?.invoice_status === 'failed') return true;
    const step = workflowSteps.find((s) => workflowStepKey(s) === 'idoklad_exported');
    if (step?.status === 'failed') return true;
    if (step?.last_error && String(step.last_error).trim()) return true;
    return false;
  }, [order?.invoice_status, workflowSteps]);

  /** Faktura pending u zaplacené objednávky — stav z DB může zaostávat; obnovit bez celostránkového loaderu. */
  const showInvoiceStatusRefresh = useMemo(
    () => order?.payment_status === 'paid' && order.invoice_status === 'pending',
    [order?.payment_status, order?.invoice_status],
  );
  const canCancel = !!order && ['paid', 'processing', 'exported'].includes(order.status);
  const canMarkShipped = order?.status === 'exported';

  const stripeHref = useMemo(() => stripeUrl(order?.stripe_payment_intent_id), [order?.stripe_payment_intent_id]);
  const basecomHref = useMemo(() => basecomUrl(order?.basecom_order_id), [order?.basecom_order_id]);
  const pipedriveDealHref = useMemo(() => pipedriveDealUrl(order?.pipedrive_deal_id), [order?.pipedrive_deal_id]);

  const schoolAdminHref = useMemo(() => {
    if (!order) return null;
    const ico = order.ico?.trim();
    const name = order.school_name?.trim();
    if (!ico && !name) return null;
    const q = new URLSearchParams();
    if (ico) q.set('ico', ico);
    if (name) q.set('name', name);
    return `../skoly?${q.toString()}`;
  }, [order]);

  const loadOrder = async (opts?: { silent?: boolean }) => {
    if (!id) return;
    if (!opts?.silent) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await fetchAdminOrderDetail(id);
      setOrder(data.order);
      setItems(data.items || []);
      setEvents(data.events || []);
      setWorkflowSteps(data.workflowSteps || []);
      setAlerts(data.alerts || []);
      setStockMeta(data.stockMeta || null);
      setBasecomFulfillment(
        data.basecomFulfillment ?? { ok: false, reason: 'not_in_response' },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst detail objednávky.');
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [id]);

  const handleAction = async (
    action: 'retry_export' | 'retry_idoklad_export' | 'cancel_order' | 'mark_shipped' | 'sync_pipedrive',
    opts?: { pipedriveRefresh?: boolean },
  ) => {
    if (!order) return;

    const loadingKey =
      action === 'sync_pipedrive' && opts?.pipedriveRefresh ? 'sync_pipedrive_refresh' : action;

    try {
      setActionLoading(loadingKey);

      if (action === 'retry_export') {
        await runAdminOrderAction({ action, orderId: order.id });
        toast.success('Export byl vrácen do fronty.');
      }

      if (action === 'retry_idoklad_export') {
        await runAdminOrderAction({ action, orderId: order.id });
        toast.success('Export do iDokladu byl vrácen do fronty.');
      }

      if (action === 'sync_pipedrive') {
        const res = await runAdminOrderAction({
          action,
          orderId: order.id,
          refreshPipedrive: opts?.pipedriveRefresh === true,
        }) as {
          success?: boolean;
          skipped?: boolean;
          reason?: string;
          result?: { dealId?: string | number; refreshed?: boolean };
        };
        if (res?.skipped) {
          const r = String(res.reason || '');
          if (opts?.pipedriveRefresh && r === 'nothing_to_update') {
            toast.warning('V Pipedrive není co aktualizovat (zkontrolujte štítky a pole PRINT).');
          } else {
            toast.warning(res.reason ? `Pipedrive: ${res.reason}` : 'Sync byl přeskočen.');
          }
        } else {
          toast.success(
            opts?.pipedriveRefresh
              ? 'Štítky a pole v Pipedrive byly aktualizovány.'
              : 'Deal v Pipedrive byl vytvořen.',
          );
          const raw = (res?.result as { dealId?: string | number } | undefined)?.dealId;
          const dealId = raw != null && String(raw).trim() !== '' ? String(raw).trim() : '';
          if (dealId) {
            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    pipedrive_deal_id: dealId,
                    pipedrive_sync_status: 'done',
                    pipedrive_sync_error: null,
                    pipedrive_synced_at: new Date().toISOString(),
                  }
                : prev,
            );
          } else if (opts?.pipedriveRefresh) {
            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    pipedrive_sync_status: 'done',
                    pipedrive_sync_error: null,
                    pipedrive_synced_at: new Date().toISOString(),
                  }
                : prev,
            );
          }
        }
      }

      if (action === 'cancel_order') {
        const reason = window.prompt('Důvod zrušení objednávky:', order.cancelled_reason || '');
        if (reason === null) return;
        await runAdminOrderAction({ action, orderId: order.id, cancelledReason: reason });
        toast.success('Objednávka byla zrušena.');
      }

      if (action === 'mark_shipped') {
        const tracking = window.prompt('Zadejte tracking číslo:', order.tracking_number || '');
        if (tracking === null) return;
        await runAdminOrderAction({ action, orderId: order.id, trackingNumber: tracking });
        toast.success('Objednávka byla označena jako odeslaná.');
      }

      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Akci se nepodařilo provést.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshInvoiceState = async () => {
    try {
      setActionLoading('refresh_order');
      await loadOrder({ silent: true });
      toast.success('Stav objednávky byl načten znovu.');
    } catch {
      toast.error('Obnovení se nepodařilo.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadIdokladPdf = async () => {
    if (!order?.id) return;
    try {
      setActionLoading('idoklad_pdf');
      await downloadIdokladInvoicePdf(order.id, order.invoice_number?.trim() || order.order_number);
      toast.success('PDF faktury staženo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stažení PDF selhalo.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="space-y-4">
          <div className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          <div className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-red-600">
          {error || 'Objednávka nebyla nalezena.'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-gray-400 mb-2">{'Detail objednávky'}</p>
            <h1 className="text-[28px] font-bold text-[#001161] font-['Fenomen_Sans']">{order.order_number}</h1>
            <p className="text-[13px] text-gray-500 mt-1">{formatDate(order.created_at)}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${badgeClass(order.status)}`}>
            {order.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canRetryExport && (
            <button
              onClick={() => handleAction('retry_export')}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-100 text-amber-800 font-bold text-[12px] disabled:opacity-40"
            >
              <RefreshCw className="w-4 h-4" />
              {'Retry export'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => handleAction('cancel_order')}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-100 text-red-700 font-bold text-[12px] disabled:opacity-40"
            >
              <Ban className="w-4 h-4" />
              {'Zrušit objednávku'}
            </button>
          )}
          {canMarkShipped && (
            <button
              onClick={() => handleAction('mark_shipped')}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-[12px] disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {'Označit jako odesláno'}
            </button>
          )}
        </div>
      </div>

      {order.admin_note ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <p className="font-bold text-[12px] uppercase tracking-[0.08em] text-amber-800 mb-1">
            {'Poznámka administrátora'}
          </p>
          <p className="whitespace-pre-wrap">{order.admin_note}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-[15px] font-bold text-[#001161] mb-3">{'Zákazník'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <div><span className="text-gray-400">{'Jméno: '}</span><span className="font-semibold text-[#001161]">{order.customer_name}</span></div>
              <div><span className="text-gray-400">{'E-mail: '}</span><span className="font-semibold text-[#001161]">{order.customer_email}</span></div>
              <div><span className="text-gray-400">{'Telefon: '}</span><span className="font-semibold text-[#001161]">{order.customer_phone || '—'}</span></div>
              <div><span className="text-gray-400">{'Škola: '}</span><span className="font-semibold text-[#001161]">{order.school_name || '—'}</span></div>
              <div><span className="text-gray-400">{'IČO: '}</span><span className="font-semibold text-[#001161]">{order.ico || '—'}</span></div>
            </div>
            {schoolAdminHref ? (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <Link
                  to={schoolAdminHref}
                  relative="path"
                  className="inline-flex items-center gap-2 text-[13px] font-bold text-[#001161] hover:text-[#ff8c66] transition-colors"
                >
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  {'Detail školy v databázi a historie objednávek'}
                </Link>
              </div>
            ) : null}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-[15px] font-bold text-[#001161] mb-3">{'Doručovací adresa'}</h2>
            <p className="text-[13px] text-[#001161] font-medium">
              {[order.street, order.city, order.zip].filter(Boolean).join(', ') || '—'}
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-gray-400" />
              <h2 className="text-[15px] font-bold text-[#001161]">{'Položky'}</h2>
            </div>
            {stockMeta && (
              <div className="mb-3 rounded-2xl border border-gray-100 bg-[#f7f8fc] p-3 text-[12px] text-gray-600">
                <div className="font-semibold text-[#001161]">
                  {stockMeta.inventoryName || stockMeta.inventoryId
                    ? `Sklad: ${stockMeta.inventoryName || 'Bez názvu'}${stockMeta.inventoryId ? ` (#${stockMeta.inventoryId})` : ''}`
                    : 'Sklad: nepřipojeno'}
                </div>
                {!stockMeta.apiTokenWorks && (
                  <div className="mt-1 text-amber-700">
                    {stockMeta.apiError || 'Base.com API momentálně nevrací skladové zásoby.'}
                  </div>
                )}
                {!stockMeta.feedUrlWorks && stockMeta.feedError && (
                  <div className="mt-1 text-red-600">{stockMeta.feedError}</div>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-gray-100 text-[11px] uppercase tracking-[0.08em] text-gray-500">
                  <tr>
                    <th className="py-2.5 pr-3">{'Produkt'}</th>
                    <th className="py-2.5 pr-3">{'Sklad'}</th>
                    <th className="py-2.5 pr-3">{'Zásoba'}</th>
                    <th className="py-2.5 pr-3">{'Množství'}</th>
                    <th className="py-2.5 pr-3">{'Cena/ks'}</th>
                    <th className="py-2.5">{'Celkem'}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-none">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-[13px] text-[#001161] leading-snug">{item.product_name}</div>
                        {item.variant && <div className="text-[11px] text-gray-400">{item.variant}</div>}
                        {item.bundle_title && (
                          <div className="text-[11px] text-indigo-600 mt-0.5">{`Balíček: ${item.bundle_title}`}</div>
                        )}
                        <div className="text-[11px] text-gray-400 mt-0.5">{`SKU: ${item.stock_sku || item.product_id}`}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] text-gray-600">
                        <div>{stockSourceLabel(item.stock_source)}</div>
                        {item.stock_match && (
                          <div className="text-[11px] text-gray-400">{`match: ${item.stock_match}`}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-[12px]">
                        <span className={`font-semibold ${
                          typeof item.stock_quantity === 'number'
                            ? item.stock_quantity >= item.quantity
                              ? 'text-emerald-700'
                              : 'text-red-600'
                            : 'text-gray-500'
                        }`}>
                          {stockQuantityLabel(item)}
                        </span>
                        {typeof item.stock_quantity === 'number' && item.stock_quantity < item.quantity && (
                          <div className="text-[11px] text-red-500 mt-0.5">{'Nestačí pro tuto objednávku'}</div>
                        )}
                        {!item.stock_source && item.stock_error && (
                          <div className="text-[11px] text-amber-700 mt-0.5">{item.stock_error}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] text-gray-600">{item.quantity}</td>
                      <td className="py-2.5 pr-3 text-[12px] text-gray-600 whitespace-nowrap">{formatPrice(item.unit_price)}</td>
                      <td className="py-2.5 text-[12px] font-bold text-[#001161] whitespace-nowrap">{formatPrice(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-[15px] font-bold text-[#001161] mb-3">{'Workflow stav'}</h2>
            <div className="space-y-2.5">
              {workflowSteps.length === 0 ? (
                <div className="text-[13px] text-gray-500">{'Workflow kroky zatím nejsou k dispozici.'}</div>
              ) : workflowSteps.map((step) => (
                <div key={step.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[12px] font-bold text-[#001161]">{workflowLabel(workflowStepKey(step))}</div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(step.status)}`}>
                      {step.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                    <span>{`Start: ${formatDate(step.started_at)}`}</span>
                    <span>{`Dokončeno: ${formatDate(step.completed_at)}`}</span>
                    <span>{`Kontrola: ${formatDate(step.last_checked_at)}`}</span>
                    <span>{`Pokusy: ${step.attempt_count}`}</span>
                  </div>
                  {step.last_error && (
                    <div className="mt-2 text-[12px] text-red-600">{step.last_error}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-[15px] font-bold text-[#001161] mb-3">
              {'Alerty u objednávky (stav řešení incidentu)'}
            </h2>
            <div className="space-y-2.5">
              {alerts.length === 0 ? (
                <div className="text-[13px] text-gray-500">{'K této objednávce zatím nejsou evidované alerty.'}</div>
              ) : alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {orderAlertTypeLabelCs(alert.alert_type)}
                      </div>
                      <div className="text-[12px] font-bold text-[#001161]">{alert.title}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${alertSeverityClass(alert.severity)}`}>
                        {incidentSeverityLabelCs(alert.severity)}
                      </span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${alertStateClass(alert.state)}`}>
                        {incidentResolutionStateLabelCs(alert.state)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[12px] text-gray-600">{alert.message}</div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                    <span>{`Poprvé: ${formatDate(alert.first_seen_at)}`}</span>
                    <span>{`Naposledy: ${formatDate(alert.last_seen_at)}`}</span>
                    {alert.resolved_at && <span>{`Vyřešeno: ${formatDate(alert.resolved_at)}`}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-[15px] font-bold text-[#001161] mb-3">{'Audit log'}</h2>
            <div className="space-y-2.5">
              {events.map((event) => (
                <div key={event.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[12px] font-bold text-[#001161]">{event.event_type}</div>
                    <div className="text-[11px] text-gray-400">{formatDate(event.created_at)}</div>
                  </div>
                  <div className="mt-1.5 text-[12px] text-gray-600">
                    {`${event.actor || 'system'}${event.from_status || event.to_status ? ` | ${event.from_status || '—'} → ${event.to_status || '—'}` : ''}`}
                  </div>
                  {event.details && (
                    <pre className="mt-2 text-[11px] text-gray-500 bg-gray-50 rounded-xl p-2.5 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-gray-400" />
              <h2 className="text-[15px] font-bold text-[#001161]">{'Doprava'}</h2>
            </div>
            <div className="space-y-2 text-[13px]">
              <div><span className="text-gray-400">{'Metoda: '}</span><span className="font-semibold text-[#001161]">{shippingLabel(order.shipping_method)}</span></div>
              <div><span className="text-gray-400">{'Cena: '}</span><span className="font-semibold text-[#001161]">{formatPrice(order.shipping_price)}</span></div>
              <div><span className="text-gray-400">{'Pickup point: '}</span><span className="font-semibold text-[#001161]">{order.pickup_point_name || '—'}</span></div>
              <div><span className="text-gray-400">{'Tracking: '}</span><span className="font-semibold text-[#001161]">{order.tracking_number || '—'}</span></div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-gray-400" />
              <h2 className="text-[15px] font-bold text-[#001161]">{'Plnění (Base.com)'}</h2>
            </div>
            <p className="text-[11px] text-gray-500 mb-3 leading-snug">
              {
                'Kroky podle štítků (nastavte BASECOM_FULFILLMENT_TAG_* v secrets) nebo podle API / historie pick–pack a čísla zásilky.'
              }
            </p>
            {!basecomFulfillment ? (
              <div className="text-[12px] text-gray-500">{'Načítání…'}</div>
            ) : !basecomFulfillment.ok ? (
              <div className="text-[12px] text-amber-800 bg-amber-50/80 rounded-xl px-3 py-2 border border-amber-100">
                {basecomFulfillment.reason === 'missing_token' && 'Chybí BASECOM_API_TOKEN u funkce admin-orders.'}
                {basecomFulfillment.reason === 'no_basecom_order' && 'Objednávka ještě nemá Base.com ID.'}
                {basecomFulfillment.reason === 'invalid_basecom_order_id' && 'Neplatné Base.com ID.'}
                {basecomFulfillment.reason === 'not_in_response' &&
                  'Nasadte novou verzi Edge funkce admin-orders (chybí pole basecomFulfillment).'}
                {basecomFulfillment.reason === 'get_orders_failed' && (
                  <>
                    {'Dotaz na Base.com selhal.'}
                    {basecomFulfillment.error ? (
                      <span className="block mt-1 text-[11px] text-amber-900/90 font-mono break-all">
                        {truncateText(basecomFulfillment.error, 280)}
                      </span>
                    ) : null}
                  </>
                )}
                {!['missing_token', 'no_basecom_order', 'invalid_basecom_order_id', 'get_orders_failed', 'not_in_response'].includes(
                  basecomFulfillment.reason,
                ) && `(${basecomFulfillment.reason})`}
              </div>
            ) : !basecomFulfillment.orderFound ? (
              <div className="text-[12px] text-gray-600">{'Objednávka v Base.com pod tímto ID nebyla nalezena.'}</div>
            ) : (
              <div className="space-y-2">
                <ol className="space-y-2">
                  {basecomFulfillment.steps.map((step) => (
                    <li key={step.key} className="flex items-start gap-2.5 text-[13px]">
                      {step.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={`font-semibold ${step.done ? 'text-[#001161]' : 'text-gray-500'}`}>
                          {step.label}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {basecomStepSourceHint(step.source)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                {basecomFulfillment.tagNames.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-600">
                    <span className="text-gray-400">{'Štítky: '}</span>
                    <span className="font-medium text-[#001161]">{basecomFulfillment.tagNames.join(', ')}</span>
                  </div>
                )}
                {basecomFulfillment.signals.pickPackHistoryEvents > 0 && (
                  <div className="text-[10px] text-gray-400">
                    {`Pick/pack událostí: ${basecomFulfillment.signals.pickPackHistoryEvents}`}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <h2 className="text-[15px] font-bold text-[#001161]">{'Platba a export'}</h2>
            </div>
            <div className="space-y-2 text-[13px]">
              <div><span className="text-gray-400">{'Metoda: '}</span><span className="font-semibold text-[#001161]">{order.payment_method}</span></div>
              <div><span className="text-gray-400">{'Status platby: '}</span><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.payment_status || 'pending')}`}>{order.payment_status || 'pending'}</span></div>
              <div><span className="text-gray-400">{'Base.com: '}</span><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.basecom_status || 'pending')}`}>{order.basecom_status || 'pending'}</span></div>
              <div><span className="text-gray-400">{'Zásilkovna: '}</span><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.zasilkovna_status || 'pending')}`}>{order.zasilkovna_status || 'pending'}</span></div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-gray-400">{'Faktura: '}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.invoice_status || 'pending')}`}>{order.invoice_status || 'pending'}</span>
                {showInvoiceStatusRefresh && (
                  <button
                    type="button"
                    title="Načíst znovu stav z databáze (faktura může mezitím spadnout)"
                    disabled={actionLoading !== null}
                    onClick={() => void handleRefreshInvoiceState()}
                    className="inline-flex items-center justify-center rounded-lg border border-[#001161]/15 bg-white p-1.5 text-[#001161] hover:bg-[#001161]/5 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${actionLoading === 'refresh_order' ? 'animate-spin' : ''}`}
                    />
                  </button>
                )}
                {canRetryIdoklad && (
                  <button
                    type="button"
                    title="Znovu zařadit export do iDokladu (fronta failed / pending s chybou)"
                    disabled={actionLoading !== null}
                    onClick={() => void handleAction('retry_idoklad_export')}
                    className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Repeat
                      className={`w-3.5 h-3.5 ${actionLoading === 'retry_idoklad_export' ? 'animate-spin' : ''}`}
                    />
                  </button>
                )}
              </div>
              {order.invoice_status === 'done' && order.invoice_number?.trim() && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 space-y-2">
                  <div className="text-[12px] text-[#001161]">
                    <span className="text-gray-500">{'Číslo faktury: '}</span>
                    <span className="font-semibold">{order.invoice_number.trim()}</span>
                  </div>
                  {order.idoklad_invoice_id?.trim() ? (
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => void handleDownloadIdokladPdf()}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#001161]/20 bg-white px-3 py-2 text-[12px] font-bold text-[#001161] hover:bg-[#001161]/5 disabled:opacity-50"
                    >
                      <Download className={`w-4 h-4 ${actionLoading === 'idoklad_pdf' ? 'animate-pulse' : ''}`} />
                      {'Stáhnout PDF faktury'}
                    </button>
                  ) : (
                    <p className="text-[11px] text-amber-800">
                      {'PDF z iDokladu není u této objednávky uložené ID — jde o starší export. Nové faktury mají tlačítko stažení.'}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-600 leading-snug">
                    {'Odeslání faktury e-mailem zákazníkovi zajišťuje iDoklad (automatizace / odeslání dokladu). Obvykle na '}
                    <span className="font-semibold text-[#001161]">{order.customer_email}</span>
                    {'. Příjem v poště nevidíme z webu — zkontrolujte v iDokladu, zda je akce zapnutá.'}
                  </p>
                </div>
              )}
              {(order.invoice_status === 'failed' || idokladWorkflowStep?.status === 'failed') && (
                <div className="rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-[11px] text-red-800 leading-snug">
                  <p className="font-bold text-red-900 mb-1">{'iDoklad se nepovedl'}</p>
                  <p className="text-red-800/95">
                    {idokladWorkflowStep?.last_error
                      ? truncateText(String(idokladWorkflowStep.last_error), 420)
                      : 'Chybí detail chyby — viz sekce Workflow níže.'}
                  </p>
                  {canRetryIdoklad && (
                    <p className="mt-2 text-[11px] text-red-900/80">
                      {'Po nasazení opravy na serveru klikněte na ikonu obnovení vedle stavu faktury.'}
                    </p>
                  )}
                </div>
              )}
              {order.invoice_status === 'pending' && order.payment_status === 'paid' && (
                <p className="text-[11px] text-amber-700 bg-amber-50/90 rounded-xl px-3 py-2 border border-amber-100">
                  {'Faktura se vytváří ve frontě (iDoklad). Obnovte stránku za chvíli.'}
                </p>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-gray-400">{'Pipedrive:'}</span>
                  {pipedriveDealHref ? (
                    <>
                      <a
                        href={pipedriveDealHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-[#001161] hover:text-[#ff6a35]"
                      >
                        {`Deal ${String(order.pipedrive_deal_id ?? '').trim()}`}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        title="Aktualizovat štítky a pole v Pipedrive"
                        disabled={actionLoading !== null}
                        onClick={() => void handleAction('sync_pipedrive', { pipedriveRefresh: true })}
                        className="inline-flex items-center justify-center rounded-lg border border-[#001161]/15 bg-white p-1.5 text-[#001161] hover:bg-[#001161]/5 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${actionLoading === 'sync_pipedrive_refresh' ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </>
                  ) : (
                    <span
                      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(
                        order.pipedrive_sync_status === 'failed'
                          ? 'failed'
                          : order.pipedrive_sync_status === 'pending'
                            ? 'processing'
                            : 'pending',
                      )}`}
                    >
                      {order.pipedrive_sync_status === 'failed'
                        ? 'chyba'
                        : order.pipedrive_sync_status === 'pending'
                          ? 'probíhá'
                          : 'nevyřízeno'}
                    </span>
                  )}
                </div>
                {order.pipedrive_sync_error && !pipedriveDealHref && (
                  <p className="text-[11px] text-red-600 leading-snug">{order.pipedrive_sync_error}</p>
                )}
                {order.pipedrive_synced_at && pipedriveDealHref && (
                  <p className="text-[11px] text-gray-500">
                    {`Sync: ${formatDate(order.pipedrive_synced_at)}`}
                  </p>
                )}
              </div>
              <div><span className="text-gray-400">{'Retry count: '}</span><span className="font-semibold text-[#001161]">{order.retry_count ?? 0}</span></div>
              {stripeHref && (
                <a href={stripeHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#001161] hover:text-[#ff6a35]">
                  {'Stripe PaymentIntent'}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {order.stripe_receipt_url && (
                <a
                  href={order.stripe_receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-[#001161] hover:text-[#ff6a35]"
                >
                  {'Stripe účtenka (receipt)'}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {basecomHref && (
                <a href={basecomHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#001161] hover:text-[#ff6a35]">
                  {`Base.com order ${order.basecom_order_id}`}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {!pipedriveDealHref && (
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => void handleAction('sync_pipedrive')}
                  className="mt-1 inline-flex items-center gap-2 rounded-xl border border-[#001161]/15 bg-[#f8f9fc] px-3 py-2 text-[12px] font-bold text-[#001161] hover:bg-[#001161]/5 disabled:opacity-50"
                >
                  {actionLoading === 'sync_pipedrive' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {'Vytvořit deal v Pipedrive'}
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
