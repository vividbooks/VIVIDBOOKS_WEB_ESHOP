import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Truck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { fetchAdminOrders, runAdminOrderAction, type AdminOrderListItem } from '../../utils/adminApi';
import { DeleteOrderDialog } from './DeleteOrderDialog';

const FILTERS = [
  { id: 'all', label: 'Všechny' },
  { id: 'incomplete', label: 'Nedokončené' },
  { id: 'pending_payment', label: 'Čekají na platbu' },
  { id: 'new', label: 'Nové' },
  { id: 'shipped', label: 'Odesláno' },
  { id: 'problem', label: 'Problémové' },
] as const;

const SOURCE_FILTERS = [
  { id: 'all', label: 'Všechny zdroje' },
  { id: 'eshop', label: 'E-shop' },
  { id: 'pipedrive', label: 'Pipedrive' },
] as const;

function sourceBadge(source: AdminOrderListItem['source']) {
  if (source === 'pipedrive') {
    return { label: 'Pipedrive', cls: 'bg-purple-100 text-purple-700' };
  }
  return { label: 'E-shop', cls: 'bg-sky-100 text-sky-700' };
}

function formatPrice(amountInHaler: number) {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function formatDate(value: string) {
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

  /** `incomplete` = zákazník checkout opustil — nenařeničné, jen šedý badge (není to chyba). */
  if (status === 'incomplete') {
    return 'bg-gray-100 text-gray-600';
  }

  return 'bg-red-100 text-red-700';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'incomplete': return 'Nedokončená';
    case 'pending_payment': return 'Čeká na platbu';
    case 'paid': return 'Zaplaceno';
    case 'processing': return 'Zpracovává se';
    case 'exported': return 'Exportováno';
    case 'shipped': return 'Odesláno';
    case 'delivered': return 'Doručeno';
    case 'cancelled': return 'Storno';
    case 'refunded': return 'Refundováno';
    case 'failed': return 'Selhalo';
    case 'draft': return 'Návrh';
    default: return status;
  }
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

/** Lidsky čitelný popisek způsobu platby pro admin přehled.
 *  Stripe Payment Element ukládá kartové platby jako `card` / `apple_pay` / `google_pay`
 *  (viz `create-payment-intent` a `stripe-webhook`), převod jako `transfer`,
 *  fakturu (školní objednávky) jako `invoice`. */
function paymentMethodLabel(method?: string | null) {
  switch ((method || '').toLowerCase()) {
    case 'transfer':
      return 'Převodem';
    case 'card':
    case 'apple_pay':
    case 'google_pay':
      return 'Kartou';
    case 'invoice':
      return 'Faktura';
    case '':
      return '—';
    default:
      return method || '—';
  }
}

export function AdminOrdersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'shipped' | 'problem' | 'incomplete' | 'pending_payment'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'eshop' | 'pipedrive'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  /** Otevřený dialog pro mazání — `null` = zavřeno. Klik na ikonu řádku otevře dialog pro tu objednávku. */
  const [deleteTarget, setDeleteTarget] = useState<AdminOrderListItem | null>(null);
  const [deleteRequiresForce, setDeleteRequiresForce] = useState(false);
  /** Bumpne se po úspěšném smazání — useEffect refetchne seznam s aktuálními filtry. */
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAdminOrders({ filter, search, page, pageSize, source: sourceFilter });
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Nepodařilo se načíst objednávky.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [filter, search, page, sourceFilter, refreshTick]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total],
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#001161] font-['Fenomen_Sans']">
            {'Objednávky'}
          </h1>
          <p className="text-gray-500 mt-1 text-[13px]">
            {'Přehled všech e-shop objednávek a jejich exportu do skladu'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-3.5 mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setPage(1);
                setFilter(item.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors ${
                filter === item.id
                  ? 'bg-[#001161] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-3">
          <div className="flex flex-wrap gap-2">
            {SOURCE_FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setPage(1);
                  setSourceFilter(item.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors ${
                  sourceFilter === item.id
                    ? 'bg-[#001161] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-[320px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Hledat číslo objednávky nebo e-mail"
              className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-[13px] text-[#001161] outline-none focus:border-[#001161]/30"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-[#f7f8fc] border-b border-gray-100">
              <tr className="text-[11px] uppercase tracking-[0.08em] text-gray-500">
                <th className="px-3 py-2.5">{'Objednávka'}</th>
                <th className="px-3 py-2.5">{'Datum'}</th>
                <th className="px-3 py-2.5">{'Zákazník'}</th>
                <th className="px-3 py-2.5">{'Položky'}</th>
                <th className="px-3 py-2.5">{'Celkem'}</th>
                <th className="px-3 py-2.5">{'Stav'}</th>
                <th className="px-3 py-2.5">{'Base.com'}</th>
                <th className="px-3 py-2.5">{'Platba'}</th>
                <th className="px-3 py-2.5">{'Způsob platby'}</th>
                <th className="px-3 py-2.5">{'Doprava'}</th>
                <th className="px-3 py-2.5 text-right">{'Akce'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="px-3 py-3" colSpan={11}>
                      <div className="h-8 rounded-xl bg-gray-50 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td className="px-4 py-8 text-red-600 text-[14px]" colSpan={11}>
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-gray-500 text-[14px]" colSpan={11}>
                    {'Žádné objednávky neodpovídají filtru.'}
                  </td>
                </tr>
              ) : (
                items.map((order) => {
                  const sb = sourceBadge(order.source);
                  return (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/admin/objednavky/${order.id}`)}
                    className="border-b border-gray-100 hover:bg-[#f9fafc] cursor-pointer align-top"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#001161] text-[12px]">{order.order_number}</span>
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ${sb.cls}`}>
                          {sb.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">{order.customer_email}</div>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-gray-600 whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-[12px] font-semibold text-[#001161] leading-snug">{order.customer_name}</div>
                      {order.school_name && (
                        <div className="text-[11px] text-gray-500 line-clamp-1">{order.school_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 max-w-[240px] text-[12px] text-gray-600">
                      <span className="line-clamp-2 leading-snug">{order.items_summary || '—'}</span>
                    </td>
                    <td className="px-3 py-3 text-[12px] font-bold text-[#001161] whitespace-nowrap">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.basecom_status || 'pending')}`}>
                        {order.basecom_status || 'pending'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(order.payment_status || 'pending')}`}>
                        {order.payment_status || 'pending'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-gray-600 whitespace-nowrap">
                      {paymentMethodLabel(order.payment_method)}
                    </td>
                    <td className="px-3 py-3 text-[12px] text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-gray-400" />
                        <span>{shippingLabel(order.shipping_method)}</span>
                      </div>
                      {order.tracking_number && (
                        <div className="text-[11px] text-gray-400 mt-0.5">{order.tracking_number}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteRequiresForce(false);
                          setDeleteTarget(order);
                        }}
                        title="Smazat objednávku z databáze"
                        aria-label={`Smazat objednávku ${order.order_number}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <DeleteOrderDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          orderNumber={deleteTarget.order_number}
          status={deleteTarget.status}
          paymentStatus={deleteTarget.payment_status}
          initialRequiresForce={deleteRequiresForce}
          onConfirm={async ({ force }) => {
            try {
              await runAdminOrderAction({
                action: 'delete_order',
                orderId: deleteTarget.id,
                confirmOrderNumber: deleteTarget.order_number,
                force,
              });
              toast.success(`Objednávka ${deleteTarget.order_number} byla smazána.`);
              setRefreshTick((n) => n + 1);
            } catch (err) {
              const e = err as Error & { requiresForce?: boolean };
              if (e?.requiresForce) setDeleteRequiresForce(true);
              throw err;
            }
          }}
        />
      )}

      <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[13px] text-gray-500">
          {`${Math.min((page - 1) * pageSize + 1, total)}-${Math.min(page * pageSize, total)} z ${total}`}
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
