import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { formatPrice } from './formatPrice';
import { absoluteAppUrl } from '../../utils/appBaseUrl';

export function StripePaymentSubmitForm({
  total,
  onError,
  returnPath = '/objednavka/dekujeme',
  thankYouTrackingToken,
  submitDisabled = false,
}: {
  total: number;
  onError: (message: string) => void;
  /** Path only, např. /objednavka/dekujeme */
  returnPath?: string;
  /** HMAC `t` z create-payment-intent — Stripe přidá vlastní query; bez `t` by návrat bez sessionStorage selhal u get-order-by-payment-intent. */
  thankYouTrackingToken?: string | null;
  /** Např. při vytváření PaymentIntent na pozadí — zablokuje dvojí odeslání. */
  submitDisabled?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Synchronní blok — dvojklik před setState stihne poslat confirmPayment dvakrát. */
  const submitGuardRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;

    setIsSubmitting(true);
    onError('');

    const pathOnly = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
    const returnUrl = new URL(absoluteAppUrl(pathOnly));
    const tt = (thankYouTrackingToken ?? '').trim();
    if (tt) returnUrl.searchParams.set('t', tt);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl.toString(),
      },
    });

    if (result.error) {
      onError(result.error.message || 'Platbu se nepodařilo dokončit. Zkuste to prosím znovu.');
      submitGuardRef.current = false;
      setIsSubmitting(false);
      return;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* min-height + tabs: někdy se accordion/stack nevykreslí viditelně; iframe i chyby blokování jsou v Console / Network */}
      <div className="min-h-[140px]" data-stripe-payment-element-mount>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
          onLoadError={(e) => {
            const msg =
              e.error?.message ||
              'Platební pole se nepodařilo načíst (zkuste jiný prohlížeč, vypněte blokování skriptů nebo zkontrolujte publishable klíč vůči PaymentIntent).';
            onError(msg);
          }}
        />
      </div>
      <button
        type="submit"
        disabled={!stripe || !elements || isSubmitting || submitDisabled}
        className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-[14px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {'Zpracovávám platbu...'}
          </>
        ) : (
          `Zaplatit ${formatPrice(total)}`
        )}
      </button>
    </form>
  );
}
