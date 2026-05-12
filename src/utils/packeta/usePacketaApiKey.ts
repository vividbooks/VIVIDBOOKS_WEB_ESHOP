import { useCallback, useEffect, useState } from 'react';
import { projectId, publicAnonKey } from '../supabase/info';

const PACKETA_API_KEY_URL =
  `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/packeta-api-key`;

async function fetchRemotePacketaApiKey(signal?: AbortSignal): Promise<string> {
  const r = await fetch(PACKETA_API_KEY_URL, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    signal,
  });
  const d = (await r.json().catch(() => ({}))) as { apiKey?: string | null };
  return typeof d.apiKey === 'string' ? d.apiKey.trim() : '';
}

/**
 * Packeta widget key: nejdřív `VITE_PACKETA_API_KEY` (build), jinak GET z make-server
 * (Supabase Edge Secrets `PACKETA_API_KEY` nebo `VITE_PACKETA_API_KEY`).
 */
export function usePacketaApiKey(): {
  packetaApiKey: string;
  packetaKeyLoading: boolean;
  ensurePacketaApiKey: () => Promise<string>;
} {
  const viteKey = (import.meta.env.VITE_PACKETA_API_KEY ?? '').trim();
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
        const apiKey = await fetchRemotePacketaApiKey(ac.signal);
        if (!cancelled && apiKey) {
          setRemoteKey(apiKey);
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

  const ensurePacketaApiKey = useCallback(async () => {
    if (viteKey) return viteKey;
    if (remoteKey) return remoteKey;
    const apiKey = await fetchRemotePacketaApiKey();
    if (apiKey) {
      setRemoteKey(apiKey);
      setRemoteReady(true);
    }
    return apiKey;
  }, [remoteKey, viteKey]);

  return {
    packetaApiKey: viteKey || remoteKey || '',
    packetaKeyLoading: !viteKey && !remoteReady,
    ensurePacketaApiKey,
  };
}
