import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, Package, Truck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SEOHead } from '../SEOHead';
import { InternalCartUpsellSection } from './InternalCartUpsellSection';
import { CartItem } from '../../contexts/CartContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getPaymentIntentTrackingFromStorage } from '../../utils/checkoutThankYouRedirect';

const GET_ORDER_FN = `https://${projectId}.supabase.co/functions/v1/get-order-by-payment-intent`;
const INVOICE_FN = `https://${projectId}.supabase.co/functions/v1/idoklad-invoice-pdf`;

interface FulfillmentPhase {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
}

interface OrderSummaryItem {
  product_id: string;
  product_name: string;
  variant?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderTrackingSummary {
  order_number: string;
  total: number;
  subtotal: number;
  shipping_price: number;
  shipping_method: string;
  shipping_method_label: string;
  pickup_point_name?: string | null;
  customer_email: string;
  status: string;
  payment_method?: string;
  transfer_flow?: boolean;
  stripe_receipt_url?: string | null;
  stripe_payment_intent_id?: string | null;
  tracking_number?: string | null;
  invoice_ready?: boolean;
  tracking_token?: string | null;
  fulfillment?: {
    phases: FulfillmentPhase[];
    courier_label: string;
  };
  items?: OrderSummaryItem[];
}

function formatPrice(amountInHaler: number): string {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function TrackingProgress({ phases }: { phases: FulfillmentPhase[] }) {
  return (
    <div className="mt-8 text-left max-w-[560px] mx-auto">
      <h2 className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-4">
        {'Stav objednávky'}
      </h2>
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[#001161]/12" aria-hidden />
        <ol className="space-y-0">
          {phases.map((phase, index) => {
            const done = phase.done;
            return (
              <li key={phase.key} className="relative flex gap-4 pb-6 last:pb-0">
                <div
                  className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    done ? 'border-[#16a34a] bg-[#ecfdf5]' : 'border-[#001161]/15 bg-white'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  ) : phase.key === 'transit' ? (
                    <Truck className="w-4 h-4 text-[#001161]/35" />
                  ) : phase.key === 'packed' || phase.key === 'printing' ? (
                    <Package className="w-4 h-4 text-[#001161]/35" />
                  ) : (
                    <span className="text-[11px] font-bold text-[#001161]/30">{index + 1}</span>
                  )}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={`font-['Fenomen_Sans',sans-serif] text-[14px] font-bold ${
                      done ? 'text-[#001161]' : 'text-[#001161]/55'
                    }`}
                  >
                    {phase.label}
                  </p>
                  {phase.detail && (done || phase.key === 'transit' || phase.key === 'printing') && (
                    <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/50 mt-1">
                      {phase.detail}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function OrderTrackingPage() {
  const [searchParams] = useSearchParams();
  const paymentIntent = searchParams.get('payment_intent');
  const orderFromUrl = searchParams.get('order');
  const tokenFromUrl = searchParams.get('t');

  const [order, setOrder] = useState<OrderTrackingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** E-mail z objednávky — po potvrzení formuláře, když v URL chybí parametr `t`. */
  const [emailForLookup, setEmailForLookup] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState('');

  const paymentIntentTrimmed = paymentIntent?.trim() ?? '';
  const orderTrimmed = orderFromUrl?.trim() ?? '';
  const tokenTrimmed = tokenFromUrl?.trim() ?? '';
  const needsEmailGate = Boolean(orderTrimmed && !tokenTrimmed && !paymentIntentTrimmed);
  const emailQueryNorm = emailSubmitted.trim().toLowerCase();

  const lookupUrl = useMemo(() => {
    if (paymentIntentTrimmed) {
      const u = new URL(GET_ORDER_FN);
      u.searchParams.set('payment_intent_id', paymentIntentTrimmed);
      const t = tokenTrimmed || getPaymentIntentTrackingFromStorage(paymentIntentTrimmed);
      if (t) u.searchParams.set('t', t);
      return u.toString();
    }
    if (orderTrimmed && tokenTrimmed) {
      const u = new URL(GET_ORDER_FN);
      u.searchParams.set('order', orderTrimmed);
      u.searchParams.set('t', tokenTrimmed);
      return u.toString();
    }
    if (orderTrimmed && emailQueryNorm.includes('@')) {
      const u = new URL(GET_ORDER_FN);
      u.searchParams.set('order', orderTrimmed);
      u.searchParams.set('email', emailQueryNorm);
      return u.toString();
    }
    return null;
  }, [paymentIntentTrimmed, orderTrimmed, tokenTrimmed, emailQueryNorm]);

  const applyOrderSuccess = useCallback((data: OrderTrackingSummary) => {
    setOrder(data);
    setLoading(false);
    setError('');
  }, []);

  useEffect(() => {
    setOrder(null);
    setError('');

    if (!lookupUrl) {
      setLoading(false);
      if (needsEmailGate && !emailQueryNorm.includes('@')) {
        setError('');
        return;
      }
      if (!paymentIntentTrimmed && !orderTrimmed && !tokenTrimmed) {
        setError(
          'Pro zobrazení sledování použijte odkaz z e-mailu (číslo objednávky a ověřovací kód), nebo se vraťte z potvrzení platby.',
        );
        return;
      }
      setError(
        'Pro zobrazení sledování použijte odkaz z e-mailu (číslo objednávky a ověřovací kód), nebo se vraťte z potvrzení platby.',
      );
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const response = await fetch(lookupUrl, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancelled) return;
        if (response.ok && typeof data.order_number === 'string') {
          applyOrderSuccess(data as unknown as OrderTrackingSummary);
          return;
        }
        setError(typeof data.error === 'string' ? data.error : 'Nepodařilo se načíst objednávku.');
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Nepodařilo se načíst objednávku.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lookupUrl, applyOrderSuccess, needsEmailGate, emailQueryNorm, paymentIntentTrimmed, orderTrimmed, tokenTrimmed]);

  const upsellCartItems: CartItem[] = useMemo(() => {
    if (!order?.items?.length) return [];
    return order.items.map((item) => ({
      productId: item.product_id,
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

  const showEmailGate =
    needsEmailGate && !emailQueryNorm.includes('@') && !order && !error && !loading;

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <SEOHead
        title="Sledování objednávky"
        path="/objednavka/sledovani"
        description="Stav objednávky a zásilky Vividbooks."
        noIndex
      />
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-10 md:py-16">
        <div className="rounded-[28px] border border-[#001161]/10 bg-white p-8 md:p-10 text-center overflow-hidden">
          {showEmailGate ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#eff6ff] flex items-center justify-center mx-auto mb-5">
                <Mail className="w-8 h-8 text-[#001161]" />
              </div>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] md:text-[40px] leading-tight mb-3">
                {'Sledování objednávky'}
              </h1>
              <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/60 leading-relaxed max-w-[480px] mx-auto mb-6">
                {
                  'V odkazu chybí ověřovací kód z e-mailu. Zadejte prosím stejný e-mail, který jste uvedli u objednávky (objednávka '
                }
                <span className="font-bold text-[#001161]/80">{orderTrimmed}</span>
                {').'}
              </p>
              <form
                className="max-w-[400px] mx-auto text-left space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = emailForLookup.trim().toLowerCase();
                  if (!v.includes('@')) return;
                  setEmailSubmitted(v);
                }}
              >
                <label className="block font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-wide text-[#001161]/45">
                  {'E-mail z objednávky'}
                  <input
                    type="email"
                    autoComplete="email"
                    value={emailForLookup}
                    onChange={(e) => setEmailForLookup(e.target.value)}
                    className="mt-1.5 w-full rounded-[14px] border border-[#001161]/15 px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:ring-2 focus:ring-[#001161]/20"
                    placeholder="vas@email.cz"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold py-3 hover:bg-[#001161]/90 transition-colors"
                >
                  {'Zobrazit stav objednávky'}
                </button>
              </form>
              <p className="mt-6 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
                <Link to="/" className="underline hover:text-[#001161]/60">
                  {'Zpět do obchodu'}
                </Link>
              </p>
            </>
          ) : order ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#eff6ff] flex items-center justify-center mx-auto mb-5">
                <Truck className="w-8 h-8 text-[#001161]" />
              </div>
              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-2">
                {'Sledování zásilky'}
              </p>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[34px] md:text-[46px] leading-none mb-2">
                {'Objednávka '}
                {order.order_number}
              </h1>
              <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/55">
                {'Potvrzení také na '}
                <span className="font-bold text-[#001161]/80">{order.customer_email}</span>
              </p>

              {order.fulfillment?.phases && (
                <TrackingProgress phases={order.fulfillment.phases} />
              )}

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
                              {`${item.quantity} ks × ${formatPrice(item.unit_price)}`}
                            </p>
                          </div>
                          <div className="shrink-0 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161]">
                            {formatPrice(item.total_price)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="px-4 md:px-5 py-3 border-t border-[#001161]/8 bg-[#fafbfd]">
                      <div className="flex justify-between gap-4 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70">
                        <span>{'Doprava'}</span>
                        <span className="font-bold text-[#001161]">
                          {`${order.shipping_method_label} — ${formatPrice(order.shipping_price)}`}
                        </span>
                      </div>
                      {order.pickup_point_name && (
                        <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 mt-2">
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

              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 mt-10">
                {invoiceHref && (
                  <a
                    href={invoiceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold hover:bg-[#001161]/90 transition-colors"
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

              <p className="mt-8 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
                <Link to="/" className="underline hover:text-[#001161]/60">
                  {'Zpět do obchodu'}
                </Link>
              </p>
            </>
          ) : error ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-8 h-8 text-[#dc2626]" />
              </div>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[44px] leading-tight mb-4">
                {'Nelze zobrazit sledování'}
              </h1>
              <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60 leading-relaxed max-w-[440px] mx-auto">
                {error}
              </p>
              {needsEmailGate && emailQueryNorm.includes('@') ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setEmailSubmitted('');
                    setEmailForLookup('');
                  }}
                  className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-[14px] border border-[#001161]/15 bg-white text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold hover:bg-[#f8f9fc] transition-colors"
                >
                  {'Znovu zadat e-mail'}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-[#f1f3f8] flex items-center justify-center mx-auto mb-5">
                <Loader2 className="w-8 h-8 text-[#001161]/50 animate-spin" />
              </div>
              <p className="font-['Fenomen_Sans',sans-serif] text-[12px] uppercase tracking-[0.15em] text-[#001161]/40 mb-2">
                {'Načítáme objednávku'}
              </p>
              <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[38px] md:text-[52px] leading-none mb-4">
                {'Chvilku strpení…'}
              </h1>
            </>
          )}

        </div>

        {order && upsellCartItems.length > 0 && (
          <div className="mt-6 rounded-[28px] border border-[#001161]/10 bg-white overflow-hidden">
            <InternalCartUpsellSection cartItems={upsellCartItems} openCartAfterAdd />
          </div>
        )}
      </div>
    </div>
  );
}
