import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { formatPrice } from './formatPrice';

export function StripePaymentSubmitForm({
  total,
  onError,
  returnPath = '/objednavka/dekujeme',
}: {
  total: number;
  onError: (message: string) => void;
  /** Path only, např. /objednavka/dekujeme */
  returnPath?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);
    onError('');

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${returnPath.startsWith('/') ? returnPath : `/${returnPath}`}`,
      },
    });

    if (result.error) {
      onError(result.error.message || 'Platbu se nepodařilo dokončit. Zkuste to prosím znovu.');
      setIsSubmitting(false);
      return;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || !elements || isSubmitting}
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
