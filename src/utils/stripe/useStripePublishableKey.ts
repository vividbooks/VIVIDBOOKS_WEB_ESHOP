import { useEffect, useMemo, useState } from 'react';
import { projectId, publicAnonKey } from '../supabase/info';
import { loadStripeForApp } from './loadStripeApp';

const STRIPE_PUBLISHABLE_KEY_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/stripe-publishable-key`;

function isStripePublishableKey(value: string): boolean {
  return value.startsWith('pk_test_') || value.startsWith('pk_live_');
}

/**
 * Publishable key: nejdřív `VITE_STRIPE_PUBLISHABLE_KEY` (build), jinak GET z make-server
 * (Supabase Edge Secrets `STRIPE_PUBLISHABLE_KEY` nebo `VITE_STRIPE_PUBLISHABLE_KEY` — hodnota pk_ ze Stripe).
 */
export function useStripePublishableKey(): {
  publishableKey: string;
  stripePromise: ReturnType<typeof loadStripeForApp> | null;
  stripePkLoading: boolean;
} {
  const viteKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim();
  const [remoteKey, setRemoteKey] = useState<string | null>(null);
  const [remoteReady, setRemoteReady] = useState(() => Boolean(viteKey));

  useEffect(() => {
    if (viteKey) return;
    let cancelled = false;
    const ac = new AbortController();
    const maxWaitMs = 12_000;
    const maxWaitId = window.setTimeout(() => ac.abort(), maxWaitMs);
    void (async () => {
      try {
        const r = await fetch(STRIPE_PUBLISHABLE_KEY_URL, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          signal: ac.signal,
        });
        const d = (await r.json().catch(() => ({}))) as { publishableKey?: string | null };
        const pk = typeof d.publishableKey === 'string' ? d.publishableKey.trim() : '';
        if (!cancelled && isStripePublishableKey(pk)) {
          setRemoteKey(pk);
        }
      } catch {
        /* timeout / síť — pokračujeme bez vzdáleného klíče */
      } finally {
        clearTimeout(maxWaitId);
        if (!cancelled) setRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
      clearTimeout(maxWaitId);
    };
  }, [viteKey]);

  const publishableKey = viteKey || remoteKey || '';
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripeForApp(publishableKey) : null),
    [publishableKey],
  );
  const stripePkLoading = !viteKey && !remoteReady;

  return { publishableKey, stripePromise, stripePkLoading };
}
