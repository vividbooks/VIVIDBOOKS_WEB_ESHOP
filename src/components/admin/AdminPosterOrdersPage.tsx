import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  fetchAdminOrderDetail,
  fetchAdminOrders,
  runAdminOrderAction,
  type AdminOrderDetail,
  type AdminOrderItem,
  type AdminOrderListItem,
} from '../../utils/adminApi';

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

function csvCell(value: string): string {
  const s = value.replace(/\r?\n/g, ' ').trim();
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildPosterOrderCsv(order: AdminOrderDetail, items: AdminOrderItem[]): string {
  const rows: string[] = [];
  const pushPair = (k: string, v: string) => rows.push(`${csvCell(k)};${csvCell(v)}`);

  pushPair('Číslo objednávky', order.order_number);
  pushPair('Vytvořeno', order.created_at);
  pushPair('Stav platby', order.payment_status || '');
  pushPair('Stav objednávky', order.status);
  pushPair('Plakát — vyřízeno', order.poster_fulfillment_status === 'done' ? 'DONE' : 'Nehotovo');
  pushPair('Jméno', order.customer_name);
  pushPair('E-mail', order.customer_email);
  pushPair('Telefon', order.customer_phone || '');
  pushPair('Škola', order.school_name || '');
  pushPair('IČO', order.ico || '');
  pushPair('Ulice', order.street || '');
  pushPair('Město', order.city || '');
  pushPair('PSČ', order.zip || '');
  pushPair('Doprava', order.shipping_method);
  pushPair('Cena dopravy (haléře)', String(order.shipping_price ?? 0));
  pushPair('Výdejní místo', order.pickup_point_name || '');
  pushPair('Mezisoučet (haléře)', String(order.subtotal));
  pushPair('Celkem (haléře)', String(order.total));
  rows.push('');
  rows.push(
    [
      csvCell('Produkt'),
      csvCell('Varianta'),
      csvCell('Ks'),
      csvCell('Jedn. cena (hal)'),
      csvCell('Radek celkem (hal)'),
    ].join(';'),
  );
  for (const it of items) {
    rows.push(
      [
        csvCell(it.product_name),
        csvCell(it.variant || ''),
        csvCell(String(it.quantity)),
        csvCell(String(it.unit_price)),
        csvCell(String(it.total_price)),
      ].join(';'),
    );
  }
  return `\uFEFF${rows.join('\r\n')}`;
}

export function AdminPosterOrdersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const pageSize = 100;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOrders({
        filter: 'all',
        posterOnly: true,
        page: 1,
        pageSize,
        search: '',
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst objednávky plakátů.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (orderId: string, posterFulfillmentStatus: 'pending' | 'done') => {
    setBusyId(orderId);
    try {
      await runAdminOrderAction({
        action: 'set_poster_fulfillment',
        orderId,
        posterFulfillmentStatus,
      });
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Uložení stavu selhalo.');
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async (orderId: string, orderNumber: string) => {
    setExportingId(orderId);
    try {
      const data = await fetchAdminOrderDetail(orderId);
      const csv = buildPosterOrderCsv(data.order, data.items || []);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plakaty-${orderNumber.replace(/[^\w.-]+/g, '_')}.csv`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Export selhal.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] leading-tight">
            {'Objednávky plakátů'}
          </h1>
          <p className="mt-1 text-[13px] text-gray-600 max-w-xl">
            {
              'Objednávky vytvořené jen z položek označených jako plakáty v košíku nejdou do Base.com. Označte ručně stav vyřízení a případně stáhněte CSV.'
            }
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl border border-[#001161]/15 bg-white px-4 py-2 text-[13px] font-semibold text-[#001161] hover:bg-gray-50 disabled:opacity-50"
        >
          {'Obnovit'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {'Načítám…'}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[14px] text-gray-500">{'Zatím žádné objednávky plakátů.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#001161]/10 bg-white shadow-sm">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#f8f9fc] text-[11px] font-bold uppercase tracking-wide text-[#001161]/55">
              <tr>
                <th className="px-3 py-2.5">{'Číslo'}</th>
                <th className="px-3 py-2.5">{'Datum'}</th>
                <th className="px-3 py-2.5">{'Zákazník'}</th>
                <th className="px-3 py-2.5">{'E-mail'}</th>
                <th className="px-3 py-2.5">{'Položky'}</th>
                <th className="px-3 py-2.5">{'Částka'}</th>
                <th className="px-3 py-2.5">{'Stav'}</th>
                <th className="px-3 py-2.5">{'CSV'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#001161]/8">
              {items.map((row) => {
                const st = row.poster_fulfillment_status || 'pending';
                return (
                  <tr key={row.id} className="hover:bg-[#fafbff]">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/objednavky/${row.id}`)}
                        className="font-semibold text-[#5b4fd8] hover:underline"
                      >
                        {row.order_number}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2.5">{row.customer_name}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.customer_email}</td>
                    <td className="px-3 py-2.5 max-w-[220px] truncate text-gray-700" title={row.items_summary || ''}>
                      {row.items_summary || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[#001161]">{formatPrice(row.total)}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={st === 'done' ? 'done' : 'pending'}
                        disabled={busyId === row.id}
                        onChange={(e) => {
                          const v = e.target.value as 'pending' | 'done';
                          void setStatus(row.id, v);
                        }}
                        className="rounded-lg border border-[#001161]/15 bg-white px-2 py-1.5 text-[12px] font-semibold text-[#001161] cursor-pointer disabled:opacity-50"
                      >
                        <option value="pending">{'Nehotovo'}</option>
                        <option value="done">{'DONE'}</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => void exportCsv(row.id, row.order_number)}
                        disabled={exportingId === row.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#001161]/15 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#001161] hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exportingId === row.id ? '…' : 'CSV'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
