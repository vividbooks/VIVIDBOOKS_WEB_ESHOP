import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SEOHead } from '../SEOHead';
import { CartItem, useCart } from '../../contexts/CartContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getPaymentIntentTrackingFromStorage } from '../../utils/checkoutThankYouRedirect';
import { clearCheckoutDraftId } from '../../utils/checkoutDraftId';
import { InternalCartUpsellSection } from './InternalCartUpsellSection';
import { pushPurchase } from '../../utils/dataLayerEcommerce';

const GET_ORDER_FN = `https://${projectId}.supabase.co/functions/v1/get-order-by-payment-intent`;
const INVOICE_FN = `https://${projectId}.supabase.co/functions/v1/idoklad-invoice-pdf`;
const PAYMENT_INTENT_MAX_POLLS = 10;
const PAYMENT_INTENT_POLL_MS = 3000;
const PURCHASE_EVENT_STORAGE_PREFIX = 'vividbooks_purchase_event_sent:';

interface OrderSummary {
  order_number: string;
  total: number;
  subtotal?: number;
  shipping_price?: number;
  shipping_method: string;
  shipping_method_label?: string;
  pickup_point_name?: string | null;
  customer_email: string;
  status: string;
  payment_method?: string;
  transfer_flow?: boolean;
  stripe_receipt_url?: string | null;
  invoice_ready?: boolean;
  tracking_token?: string | null;
  items?: OrderSummaryItem[];
}

interface OrderSummaryItem {
  product_id?: string;
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
  const trackingFromUrl = searchParams.get('t');
  const orderFromUrl = searchParams.get('order');
  const transferThankYou = searchParams.get('transfer') === '1';
  const { clearCart } = useCart();
  const clearedRef = useRef(false);
  const purchasePushedRef = useRef<string | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollExhausted, setPollExhausted] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const paymentIntentTrimmed = paymentIntent?.trim() ?? '';
  const orderTrimmed = orderFromUrl?.trim() ?? '';

  const lookupUrl = useMemo(() => {
    if (paymentIntentTrimmed) {
      const u = new URL(GET_ORDER_FN);
      u.searchParams.set('payment_intent_id', paymentIntentTrimmed);
      u.searchParams.set('pending_status', '202');
      const t =
        (trackingFromUrl?.trim() || getPaymentIntentTrackingFromStorage(paymentIntentTrimmed)) || '';
      if (t) u.searchParams.set('t', t);
      return u.toString();
    }
    if (orderTrimmed) {
      const u = new URL(GET_ORDER_FN);
      u.searchParams.set('order', orderTrimmed);
      if (transferThankYou) u.searchParams.set('transfer', '1');
      return u.toString();
    }
    return null;
  }, [paymentIntentTrimmed, orderTrimmed, transferThankYou, trackingFromUrl]);

  const isPaymentIntentMode = Boolean(paymentIntentTrimmed);

  const applyOrderSuccess = useCallback(
    (data: OrderSummary) => {
      const purchaseStorageKey = `${PURCHASE_EVENT_STORAGE_PREFIX}${data.order_number}`;
      const purchaseAlreadyStored =
        typeof window !== 'undefined' &&
        window.sessionStorage.getItem(purchaseStorageKey) === '1';
      if (purchasePushedRef.current !== data.order_number && !purchaseAlreadyStored) {
        purchasePushedRef.current = data.order_number;
        pushPurchase({
          transactionId: data.order_number,
          valueHaler: data.total,
          shippingHaler: data.shipping_price ?? 0,
          items: (data.items ?? []).map((item) => ({
            item_id: item.product_id || item.product_name,
            item_name: item.product_name,
            currency: 'CZK',
            item_group: item.variant || item.product_id || 'product',
            price: Number((item.unit_price / 100).toFixed(2)),
            quantity: item.quantity,
            ...(item.variant ? { item_variant: item.variant } : {}),
          })),
        });
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(purchaseStorageKey, '1');
        }
      }
      setOrder(data);
      setLoading(false);
      setPollExhausted(false);
      setError('');
      if (!clearedRef.current) {
        clearCart();
        clearCheckoutDraftId();
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
        if (response.status === 202 && data.pending === true && isPaymentIntentMode) {
          attempt += 1;
          if (attempt >= PAYMENT_INTENT_MAX_POLLS) {
            setPollExhausted(true);
            setLoading(false);
            stopPolling();
            return 'done';
          }
          return 'continue';
        }

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

  const loadingTitle = isPaymentIntentMode
    ? 'Zpracováváme vaši platbu...'
    : 'Načítáme vaši objednávku...';
  const loadingDescription = isPaymentIntentMode
    ? 'Objednávka se ještě zapisuje do systému. Stránka se automaticky obnovuje každé 3 sekundy.'
    : 'Chvilku strpení, načítáme potvrzení objednávky.';

  const upsellCartItems: CartItem[] = useMemo(() => {
    if (!order?.items?.length) return [];
    return order.items.map((item) => ({
      productId: item.product_id ?? item.product_name,
      productName: item.product_name,
      variantId: item.product_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    }));
  }, [order]);

  const invoiceHref =
    order?.invoice_ready && order.tracking_token
      ? `${INVOICE_FN}?orderNumber=${encodeURIComponent(order.order_number)}&t=${encodeURIComponent(order.tracking_token)}`
      : null;

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
              {order.transfer_flow && (
                <p className="font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161]/80 leading-relaxed max-w-[480px] mx-auto mb-6">
                  {'Děkujeme za objednávku. Ozve se vám náš obchodník, který s vámi objednávku dokončí.'}
                </p>
              )}
              <div className="space-y-3 max-w-[420px] mx-auto text-left mt-8">
                <div className="flex items-center justify-between gap-4 font-['Fenomen_Sans',sans-serif] text-[14px]">
                  <span className="text-[#001161]/55">{'Číslo objednávky'}</span>
                  <span className="font-bold text-[#001161]">{order.order_number}</span>
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
                        className={`px-4 md:px-5 py-4 border-b border-[#001161]/8`}
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
                    <div className="px-4 md:px-5 py-3 bg-[#fafbfd]">
                      <div className="flex justify-between gap-4 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70">
                        <span>{'Doprava'}</span>
                        <span className="font-bold text-[#001161] text-right">
                          {`${order.shipping_method_label ?? order.shipping_method} — ${formatPrice(
                            order.shipping_price ?? 0,
                          )}`}
                        </span>
                      </div>
                      {order.pickup_point_name && (
                        <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 mt-2 text-right">
                          {order.pickup_point_name}
                        </p>
                      )}
                    </div>
                    <div className="px-4 md:px-5 py-4 flex justify-between items-baseline gap-4 border-t border-[#001161]/8">
                      <span className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                        {'Celkem'}
                      </span>
                      <span className="font-['Fenomen_Sans',sans-serif] text-[18px] font-bold text-[#001161]">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {order && (
                <div className="max-w-[560px] mx-auto mt-8 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
                  {order.tracking_token && (
                  <Link
                      to={`/objednavka/sledovani?order=${encodeURIComponent(order.order_number)}&t=${encodeURIComponent(order.tracking_token)}${order.transfer_flow ? '&transfer=1' : ''}`}
                      className="inline-flex items-center justify-center px-6 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold hover:bg-[#001161]/90 transition-colors"
                    >
                      {'Sledovat objednávku'}
                    </Link>
                  )}
                  {invoiceHref && (
                    <a
                      href={invoiceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-6 py-3 rounded-[14px] border border-[#001161]/15 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold hover:bg-[#f8f9fc] transition-colors"
                    >
                      {'Stáhnout fakturu'}
                    </a>
                  )}
                  <a
                    href="mailto:hello@vividbooks.com"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[14px] border border-[#001161]/15 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold hover:bg-[#f8f9fc] transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {'Kontaktujte nás'}
                  </a>
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
                {loadingTitle}
              </h1>
              <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60 leading-relaxed">
                {loadingDescription}
              </p>
            </>
          )}

          {orderTrimmed && !paymentIntentTrimmed && order && (
            <div className="mt-6 inline-flex items-center rounded-full bg-[#f1f3f8] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65">
              {`objednávka: ${orderTrimmed}`}
            </div>
          )}
        </div>
      </div>
      {order && upsellCartItems.length > 0 && (
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 pb-10 md:pb-16">
          <div className="rounded-[28px] border border-[#001161]/10 bg-white overflow-hidden">
            <InternalCartUpsellSection cartItems={upsellCartItems} openCartAfterAdd />
          </div>
        </div>
      )}
    </div>
  );
}
