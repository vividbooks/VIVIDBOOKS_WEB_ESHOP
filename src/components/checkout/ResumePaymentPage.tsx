import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Elements } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { buildThankYouUrlAfterPayment } from '../../utils/checkoutThankYouRedirect';
import { useStripePublishableKey } from '../../utils/stripe/useStripePublishableKey';
import { SEOHead } from '../SEOHead';
import { StripePaymentSubmitForm } from './StripePaymentSubmitForm';
import { formatPrice } from './formatPrice';

const RESUME_CHECKOUT_URL = `https://${projectId}.supabase.co/functions/v1/resume-checkout`;

/**
 * Minimální stránka jen pro dokončení platby z QR / e-mailu (?resume=…).
 * Bez krokové pokladny a bočního shrnutí — vhodné pro telefon po naskenování kódu.
 */
export function ResumePaymentPage() {
  const { publishableKey, stripePromise, stripePkLoading } = useStripePublishableKey();
  const [resumeLoading, setResumeLoading] = useState(true);
  const [resumeError, setResumeError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [totalHalers, setTotalHalers] = useState(0);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('resume')?.trim();
    if (!token) {
      setResumeError('Chybí platný odkaz k platbě.');
      setResumeLoading(false);
      return;
    }

    let cancelled = false;
    setResumeLoading(true);
    setResumeError('');

    fetch(RESUME_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Odkaz nelze použít.');
        }
        if (data.status === 'already_paid') {
          const num = typeof data.orderNumber === 'string' ? data.orderNumber : '';
          const pi = typeof data.paymentIntentId === 'string' ? data.paymentIntentId : '';
          window.location.replace(buildThankYouUrlAfterPayment(num || undefined, pi || undefined));
          return;
        }
        if (data.status === 'payment_cancelled') {
          throw new Error(
            typeof data.message === 'string'
              ? data.message
              : 'Platba byla zrušena. Vytvořte prosím novou objednávku.',
          );
        }
        if (data.status !== 'requires_payment' || typeof data.clientSecret !== 'string') {
          throw new Error('Nepodařilo se obnovit platbu.');
        }
        setClientSecret(data.clientSecret);
        setOrderNumber(typeof data.orderNumber === 'string' ? data.orderNumber : null);
        setTotalHalers(Number(data.total) || 0);
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResumeError(error instanceof Error ? error.message : 'Chyba při otevření odkazu.');
        }
      })
      .finally(() => {
        if (!cancelled) setResumeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const showElement = Boolean(clientSecret && stripePromise);

  return (
    <div className="min-h-dvh bg-[#f8f9fc] px-4 py-8 pb-12">
      <SEOHead
        title="Dokončit platbu"
        path="/platit"
        description="Bezpečné dokončení platby objednávky Vividbooks."
        noIndex
      />
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/"
            className="font-['Fenomen_Sans',sans-serif] text-[14px] font-bold text-[#001161] hover:text-[#ff6a35] transition-colors w-fit"
          >
            {'← Vividbooks'}
          </Link>
        </div>

        <div className="rounded-[24px] border border-[#001161]/10 bg-white p-6 md:p-8 shadow-sm">
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[34px] leading-tight mb-2">
            {'Dokončit platbu'}
          </h1>
          {orderNumber && (
            <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/70 mb-1">
              {`Objednávka ${orderNumber}`}
            </p>
          )}
          {totalHalers > 0 && (
            <p className="font-['Fenomen_Sans',sans-serif] text-[16px] font-bold text-[#001161] mb-6">
              {`K úhradě: ${formatPrice(totalHalers)}`}
            </p>
          )}

          {resumeError && (
            <div className="mb-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[13px] text-red-800">
              {resumeError}
            </div>
          )}

          {!publishableKey && !stripePkLoading && !resumeError && (
            <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#dc2626] mb-4">
              {
                'Chybí platný Stripe publishable key. Platbu z tohoto odkazu nelze načíst — zkuste hlavní web nebo kontaktujte podporu.'
              }
            </p>
          )}

          {stripePkLoading && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f9fc] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              {'Načítám platební klíč…'}
            </div>
          )}

          {resumeLoading && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[#f8f9fc] px-4 py-2 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/65 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              {'Načítám platbu…'}
            </div>
          )}

          {paymentError && (
            <p className="mb-4 font-['Fenomen_Sans',sans-serif] text-[13px] text-[#dc2626]">
              {paymentError}
            </p>
          )}

          {showElement && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                loader: 'auto',
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#001161',
                    borderRadius: '14px',
                  },
                },
              }}
            >
              <StripePaymentSubmitForm total={totalHalers} onError={setPaymentError} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
