import { loadStripe, type StripeConstructorOptions } from '@stripe/stripe-js';

/** Vypne plovoucí dev „bobánek“ Stripe (assistant) u testovacích klíčů. */
const stripeInitOptions = {
  developerTools: {
    assistant: {
      enabled: false,
    },
  },
} satisfies StripeConstructorOptions;

export function loadStripeForApp(publishableKey: string) {
  return loadStripe(publishableKey, stripeInitOptions);
}
