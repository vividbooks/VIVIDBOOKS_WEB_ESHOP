import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { SEOHead } from '../SEOHead';
import { useCart } from '../../contexts/CartContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const GET_ORDER_FN = `https://${projectId}.supabase.co/functions/v1/get-order-by-payment-intent`;
const PAYMENT_INTENT_MAX_POLLS = 10;
const PAYMENT_INTENT_POLL_MS = 3000;

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
  const orderFromUrl = searchParams.get('order');
  const { clearCart } = useCart();
  const clearedRef = useRef(false);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollExhausted, setPollExhausted] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const paymentIntentTrimmed = paymentIntent?.trim() ?? '';
  const orderTrimmed = orderFromUrl?.trim() ?? '';

  const lookupUrl = useMemo(() => {
    if (paymentIntentTrimmed) {
      return `${GET_ORDER_FN}?payment_intent_id=${encodeURIComponent(paymentIntentTrimmed)}`;
    }
    if (orderTrimmed) {
      return `${GET_ORDER_FN}?order=${encodeURIComponent(orderTrimmed)}`;
    }
    return null;
  }, [paymentIntentTrimmed, orderTrimmed]);

  const isPaymentIntentMode = Boolean(paymentIntentTrimmed);

  const applyOrderSuccess = useCallback(
    (data: OrderSummary) => {
      setOrder(data);
      setLoading(false);
      setPollExhausted(false);
      setError('');
      if (!clearedRef.current) {
        clearCart();
        clearedRef.current = true;
      }
    },
    [clearCart],
  );

  useEffect(() => {
    clearedRef.current = false;
    setOrder(null);
    setPollExhausted(false);
    setError('');

    if (!lookupUrl) {
      setLoading(false);
      setError('Chybí platební údaj nebo číslo objednávky v URL.');
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;
    let attempt = 0;

    const stopPolling = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const fetchOnce = async (): Promise<'done' | 'continue' | 'fatal'> => {
      const response = await fetch(lookupUrl, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (cancelled) return 'done';

      if (response.ok) {
        if (typeof data.order_number === 'string') {
          applyOrderSuccess(data as unknown as OrderSummary);
          stopPolling();
          return 'done';
        }
        setError('Neplatná odpověď serveru.');
        setLoading(false);
        stopPolling();
        return 'fatal';
      }

      if (response.status === 404) {
        attempt += 1;
        if (isPaymentIntentMode) {
          if (attempt >= PAYMENT_INTENT_MAX_POLLS) {
            setPollExhausted(true);
            setLoading(false);
            stopPolling();
            return 'done';
          }
          return 'continue';
        }
        setPollExhausted(true);
        setLoading(false);
        stopPolling();
        return 'done';
      }

      setError(typeof data.error === 'string' ? data.error : 'Nepodařilo se načíst objednávku.');
      setLoading(false);
      stopPolling();
      return 'fatal';
    };

    setLoading(true);

    void (async () => {
      const first = await fetchOnce();
      if (cancelled || first !== 'continue' || !isPaymentIntentMode) return;

      intervalId = window.setInterval(() => {
        void (async () => {
          const r = await fetchOnce();
          if (r !== 'continue' || cancelled) stopPolling();
        })();
      }, PAYMENT_INTENT_POLL_MS);
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [lookupUrl, isPaymentIntentMode, applyOrderSuccess, retryNonce]);

  const handleRetry = () => {
    setPollExhausted(false);
    setError('');
    setOrder(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  };

  const showLoader = loading && !order && !pollExhausted && !error;

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
          ) : pollExhausted ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-8 h-8 text-[#dc2626]" />
              </div>
              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-2">
                {'Potvrzení objednávky'}
              </p>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[44px] leading-tight mb-4">
                {'Objednávku se nepodařilo načíst'}
              </h1>
              <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60 leading-relaxed max-w-[440px] mx-auto mb-6">
                {isPaymentIntentMode
                  ? 'Platba možná ještě nedorazila do systému, nebo došlo k chybě. Zkuste načtení znovu.'
                  : 'Zkontrolujte prosím odkaz nebo nás kontaktujte s číslem objednávky.'}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center justify-center px-6 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold hover:bg-[#001161]/90 transition-colors cursor-pointer"
              >
                {'Zkusit znovu'}
              </button>
            </>
          ) : error ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#f1f3f8] flex items-center justify-center mx-auto mb-5">
                <Loader2 className="w-8 h-8 text-[#001161]/30" />
              </div>
              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-2">
                {'Potvrzení objednávky'}
              </p>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[38px] md:text-[52px] leading-none mb-4">
                {'Nelze zobrazit objednávku'}
              </h1>
              <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60 leading-relaxed">
                {error}
              </p>
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
                {'Objednávka se ještě zapisuje do systému. Stránka se automaticky obnovuje každé 3 sekundy.'}
              </p>
            </>
          )}

          {paymentIntentTrimmed && (
            <div className="mt-6 inline-flex items-center rounded-full bg-[#f1f3f8] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65">
              {showLoader ? 'čekáme na webhook' : `payment_intent: ${paymentIntentTrimmed}`}
            </div>
          )}
          {orderTrimmed && !paymentIntentTrimmed && order && (
            <div className="mt-6 inline-flex items-center rounded-full bg-[#f1f3f8] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65">
              {`objednávka: ${orderTrimmed}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
