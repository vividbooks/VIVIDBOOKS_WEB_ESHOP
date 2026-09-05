import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { WEBINARS } from '../data/webinars';
import type { Webinar } from '../data/webinars';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

/**
 * Poslední úspěšně načtený seznam držíme v localStorage.
 *
 * 1. 9. 2026 selhal Edge endpoint /webinare uprostřed živého webináře. Kontext
 * spadl na statická data v src/data/webinars.ts, ta ale obsahují jen několik
 * starých akcí — probíhající webinář v nich nebyl, takže routy divákům zavřely
 * stream. Cache tomu brání: při výpadku pracujeme s reálnými daty z minule.
 */
const CACHE_KEY = 'vvb_webinars_last_good_v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const RETRIES = 2;

type Source = 'supabase' | 'cache' | 'static' | null;

function readCache(): Webinar[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    if (Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null;
    return parsed.items as Webinar[];
  } catch {
    return null;
  }
}

function writeCache(items: Webinar[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* plná nebo zakázaná storage — cache je jen pojistka, nesmí shodit render */
  }
}

const startMsOf = (w: Webinar) => {
  const [h, m] = String(w.time || '18:00').split(':').map(Number);
  return new Date(w.year, (w.monthNum || 1) - 1, w.day || 1, h || 0, m || 0).getTime();
};

/** Nejbližší nadcházející první, pak minulé sestupně. */
function sortWebinars(items: Webinar[], nowMs: number): Webinar[] {
  const stillOn = (w: Webinar) => startMsOf(w) + 150 * 60 * 1000 > nowMs;
  return [...items].sort((a, b) => {
    const da = startMsOf(a);
    const db = startMsOf(b);
    const aFuture = stillOn(a);
    const bFuture = stillOn(b);
    if (aFuture && bFuture) return da - db;
    if (!aFuture && !bFuture) return db - da;
    return aFuture ? -1 : 1;
  });
}

interface WebinarsContextType {
  webinars: Webinar[];
  upcoming: Webinar[];
  past: Webinar[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  source: Source;
}

const WebinarsContext = createContext<WebinarsContextType>({
  webinars: [],
  upcoming: [],
  past: [],
  loading: true,
  error: null,
  refresh: () => {},
  source: null,
});

export function WebinarsProvider({ children }: { children: ReactNode }) {
  // Cache načteme hned při prvním renderu, ať stránka nikdy nestartuje naprázdno.
  const [initialCache] = useState<Webinar[] | null>(() => readCache());
  const [webinars, setWebinars] = useState<Webinar[]>(() =>
    initialCache ? sortWebinars(initialCache, Date.now()) : [],
  );
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>(initialCache ? 'cache' : null);

  async function fetchOnce(): Promise<Webinar[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${SERVER}/webinare`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      return (data.items || []) as Webinar[];
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchWebinars() {
    // Dokud máme cache, nepřepínáme do loading stavu — jinak by komponenty
    // zobrazily spinner a live stránka by se zbytečně přemountovala.
    if (webinars.length === 0) setLoading(true);
    setError(null);

    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const items = await fetchOnce();
        if (items.length > 0) {
          setWebinars(sortWebinars(items, Date.now()));
          setSource('supabase');
          setError(null);
          writeCache(items);
          setLoading(false);
          return;
        }
        lastErr = new Error('Server vratil prazdny seznam.');
      } catch (e) {
        lastErr = e;
      }
      if (attempt < RETRIES) {
        await new Promise(r => setTimeout(r, 600 * 2 ** attempt));
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    console.error('[WebinarsContext] Nepodarilo se nacist webinare:', msg);
    setError(msg);

    const cached = readCache();
    if (cached) {
      setWebinars(sortWebinars(cached, Date.now()));
      setSource('cache');
      console.warn('[WebinarsContext] Pouzivam posledni ulozeny seznam webinaru.');
    } else if (webinars.length === 0) {
      setWebinars(WEBINARS);
      setSource('static');
      console.warn('[WebinarsContext] Zadna cache, pouzivam staticka data.');
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchWebinars();
  }, []);

  const nowMs = Date.now();
  const stillOn = (w: Webinar) => startMsOf(w) + 150 * 60 * 1000 > nowMs;
  const upcoming = webinars.filter(w => !w.isPast && stillOn(w));
  const past = webinars.filter(w => w.isPast || !stillOn(w));

  return (
    <WebinarsContext.Provider value={{ webinars, upcoming, past, loading, error, refresh: fetchWebinars, source }}>
      {children}
    </WebinarsContext.Provider>
  );
}

export function useWebinars() {
  return useContext(WebinarsContext);
}
