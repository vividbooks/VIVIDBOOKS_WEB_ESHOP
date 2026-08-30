import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { edgeFunctionBase } from '../utils/edgeFunctionBase';
import { publicAnonKey } from '../utils/supabase/info';
import { classifyIdentifiedWebPath } from '../lib/identityWebPath';
import { readVividbooksPresence } from '../lib/vividbooksPresence';

const DEDUPE_MS = 30 * 60 * 1000;
const recent = new Map<string, number>();

function alreadySent(email: string, path: string): boolean {
  const key = `${email}|${path}`;
  const now = Date.now();
  const previous = recent.get(key);
  if (previous && now - previous < DEDUPE_MS) return true;
  try {
    const stored = sessionStorage.getItem(`vb_web_event:${key}`);
    if (stored && now - Number(stored) < DEDUPE_MS) {
      recent.set(key, Number(stored));
      return true;
    }
  } catch {
    // private mode
  }
  recent.set(key, now);
  try {
    sessionStorage.setItem(`vb_web_event:${key}`, String(now));
  } catch {
    // ignore
  }
  return false;
}

/**
 * Když cookie vb_id nese e-mail, zapíše identifikovaný pageview.
 * Nehlásí se k newsletteru.
 */
export function IdentifiedWebEventTracker() {
  const { pathname } = useLocation();
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const classified = classifyIdentifiedWebPath(pathname);
    if (!classified) return;

    const presence = readVividbooksPresence();
    const email = presence?.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) return;

    const key = `${email}|${classified.path}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    if (alreadySent(email, classified.path)) return;

    const ctrl = new AbortController();
    void fetch(`${edgeFunctionBase()}/identity/web-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
        apikey: publicAnonKey,
      },
      body: JSON.stringify({
        email,
        name: presence?.name || '',
        path: classified.path,
      }),
      signal: ctrl.signal,
      keepalive: true,
    }).catch(() => {
      /* fire-and-forget */
    });

    return () => ctrl.abort();
  }, [pathname]);

  return null;
}
