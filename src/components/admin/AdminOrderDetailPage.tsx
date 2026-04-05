import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Package, Truck, CreditCard, RefreshCw, Ban, Send } from 'lucide-react';
import { useParams } from 'react-router';
import { toast } from 'sonner@2.0.3';
import {
  fetchAdminOrderDetail,
  runAdminOrderAction,
  type AdminOrderAlert,
  type AdminOrderDetail,
  type AdminOrderEvent,
  type AdminOrderItem,
  type AdminOrderStockMeta,
  type AdminOrderWorkflowStep,
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

function pipedriveDealUrl(id?: string | null) {
  return id ? `https://app.pipedrive.com/deal/${id}` : null;
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

export function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [items, setItems] = useState<AdminOrderItem[]>([]);
  const [events, setEvents] = useState<AdminOrderEvent[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<AdminOrderWorkflowStep[]>([]);
  const [alerts, setAlerts] = useState<AdminOrderAlert[]>([]);
  const [stockMeta, setStockMeta] = useState<AdminOrderStockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canRetryExport = order?.basecom_status === 'failed';
  const canCancel = !!order && ['paid', 'processing', 'exported'].includes(order.status);
  const canMarkShipped = order?.status === 'exported';

  const stripeHref = useMemo(() => stripeUrl(order?.stripe_payment_intent_id), [order?.stripe_payment_intent_id]);
  const basecomHref = useMemo(() => basecomUrl(order?.basecom_order_id), [order?.basecom_order_id]);
  const pipedriveDealHref = useMemo(() => pipedriveDealUrl(order?.pipedrive_deal_id), [order?.pipedrive_deal_id]);

  const loadOrder = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOrderDetail(id);
      setOrder(data.order);
      setItems(data.items || []);
      setEvents(data.events || []);
      setWorkflowSteps(data.workflowSteps || []);
      setAlerts(data.alerts || []);
      setStockMeta(data.stockMeta || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst detail objednávky.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [id]);

  const handleAction = async (action: 'retry_export' | 'cancel_order' | 'mark_shipped') => {
    if (!order) return;

    try {
      setActionLoading(action);

      if (action === 'retry_export') {
        await runAdminOrderAction({ action, orderId: order.id });
        toast.success('Export byl vrácen do fronty.');
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
                    <div className="text-[12px] font-bold text-[#001161]">{workflowLabel(step.step_key)}</div>
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
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <h2 className="text-[15px] font-bold text-[#001161]">{'Platba a export'}</h2>
            </div>
            <div className="space-y-2 text-[13px]">
              <div><span className="text-gray-400">{'Metoda: '}</span><span className="font-semibold text-[#001161]">{order.payment_method}</span></div>
              <div><span className="text-gray-400">{'Status platby: '}</span><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.payment_status || 'pending')}`}>{order.payment_status || 'pending'}</span></div>
              <div><span className="text-gray-400">{'Base.com: '}</span><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.basecom_status || 'pending')}`}>{order.basecom_status || 'pending'}</span></div>
              <div><span className="text-gray-400">{'Zásilkovna: '}</span><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.zasilkovna_status || 'pending')}`}>{order.zasilkovna_status || 'pending'}</span></div>
              <div><span className="text-gray-400">{'Faktura: '}</span><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.invoice_status || 'pending')}`}>{order.invoice_status || 'pending'}</span></div>
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
              {pipedriveDealHref && (
                <a href={pipedriveDealHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#001161] hover:text-[#ff6a35]">
                  {`Pipedrive deal ${order.pipedrive_deal_id}`}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
