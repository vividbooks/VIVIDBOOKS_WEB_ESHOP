import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { SEOHead } from '../SEOHead';
import { useCart } from '../../contexts/CartContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface OrderSummary {
  order_number: string;
  total: number;
  shipping_method: string;
  pickup_point_name?: string | null;
  customer_email: string;
  status: string;
  items?: OrderSummaryItem[];
}

interface OrderSummaryItem {
  product_name: string;
  variant?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

function formatPrice(amountInHaler: number): string {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

export function OrderConfirmationPage() {
  const [searchParams] = useSearchParams();
  const paymentIntent = searchParams.get('payment_intent');
  const { clearCart } = useCart();
  const clearedRef = useRef(false);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const endpoint = useMemo(
    () => `https://${projectId}.supabase.co/functions/v1/get-order-by-payment-intent?payment_intent_id=${encodeURIComponent(paymentIntent ?? '')}`,
    [paymentIntent],
  );

  useEffect(() => {
    if (!paymentIntent) {
      setLoading(false);
      setError('Chybí payment_intent v URL.');
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;

    const fetchOrder = async () => {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (cancelled) return;

      if (response.status === 404) {
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(data.error || 'Nepodařilo se načíst objednávku.');
        setLoading(false);
        return;
      }

      if (data.order_number) {
        setOrder(data);
        setLoading(false);
        if (!clearedRef.current) {
          clearCart();
          clearedRef.current = true;
        }
        if (intervalId) window.clearInterval(intervalId);
        return;
      }

      setLoading(false);
    };

    void fetchOrder();
    intervalId = window.setInterval(fetchOrder, 3000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [paymentIntent, endpoint, clearCart]);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <SEOHead
        title="Potvrzení objednávky"
        path="/objednavka/dekujeme"
        description="Potvrzení objednávky Vividbooks."
        noIndex
      />
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-10 md:py-16">
        <div className="rounded-[28px] border border-[#001161]/10 bg-white p-8 md:p-10 text-center">
          {order ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#ecfdf5] flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-[#16a34a]" />
              </div>
              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-2">
                {'Potvrzení objednávky'}
              </p>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[38px] md:text-[52px] leading-none mb-4">
                {'Děkujeme'}
              </h1>
              <div className="space-y-3 max-w-[420px] mx-auto text-left mt-8">
                <div className="flex items-center justify-between gap-4 font-['Fenomen_Sans',sans-serif] text-[14px]">
                  <span className="text-[#001161]/55">{'Číslo objednávky'}</span>
                  <span className="font-bold text-[#001161]">{order.order_number}</span>
                </div>
                <div className="flex items-center justify-between gap-4 font-['Fenomen_Sans',sans-serif] text-[14px]">
                  <span className="text-[#001161]/55">{'Celková částka'}</span>
                  <span className="font-bold text-[#001161]">{formatPrice(order.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 font-['Fenomen_Sans',sans-serif] text-[14px]">
                  <span className="text-[#001161]/55">{'Doprava'}</span>
                  <span className="font-bold text-[#001161]">
                    {order.pickup_point_name
                      ? `${order.shipping_method} - ${order.pickup_point_name}`
                      : order.shipping_method}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 font-['Fenomen_Sans',sans-serif] text-[14px]">
                  <span className="text-[#001161]/55">{'Potvrzení přijde na'}</span>
                  <span className="font-bold text-[#001161]">{order.customer_email}</span>
                </div>
              </div>
              {order.items && order.items.length > 0 && (
                <div className="max-w-[560px] mx-auto mt-8 text-left">
                  <h2 className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-3">
                    {'Rekapitulace objednávky'}
                  </h2>
                  <div className="rounded-[20px] border border-[#001161]/10 overflow-hidden">
                    {order.items.map((item, index) => (
                      <div
                        key={`${item.product_name}-${index}`}
                        className={`px-4 md:px-5 py-4 ${
                          index < order.items!.length - 1 ? 'border-b border-[#001161]/8' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                              {item.product_name}
                            </p>
                            {item.variant && (
                              <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55 mt-1">
                                {item.variant}
                              </p>
                            )}
                            <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55 mt-1">
                              {`${item.quantity} ks x ${formatPrice(item.unit_price)}`}
                            </p>
                          </div>
                          <div className="shrink-0 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                            {formatPrice(item.total_price)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-[#f1f3f8] flex items-center justify-center mx-auto mb-5">
                <Loader2 className="w-8 h-8 text-[#001161]/50 animate-spin" />
              </div>
              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-2">
                {'Potvrzení objednávky'}
              </p>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[38px] md:text-[52px] leading-none mb-4">
                {'Zpracováváme vaši platbu...'}
              </h1>
              <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60 leading-relaxed">
                {error || 'Objednávka se ještě zapisuje do systému. Stránka se automaticky obnovuje každé 3 sekundy.'}
              </p>
            </>
          )}

          {paymentIntent && (
            <div className="mt-6 inline-flex items-center rounded-full bg-[#f1f3f8] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65">
              {loading && !order ? 'čekáme na webhook' : `payment_intent: ${paymentIntent}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
