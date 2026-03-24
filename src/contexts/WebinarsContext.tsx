import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { WEBINARS } from '../data/webinars';
import type { Webinar } from '../data/webinars';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

interface WebinarsContextType {
  webinars: Webinar[];
  upcoming: Webinar[];
  past: Webinar[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  source: 'supabase' | 'static' | null;
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
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'supabase' | 'static' | null>(null);

  async function fetchWebinars() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER}/webinare`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      const items: Webinar[] = data.items || [];
      if (items.length > 0) {
        // Seřadit podle data — nejbližší nadcházející první, pak minulé sestupně
        const now = new Date();
        const sorted = [...items].sort((a, b) => {
          const da = new Date(a.year, (a.monthNum || 1) - 1, a.day);
          const db = new Date(b.year, (b.monthNum || 1) - 1, b.day);
          const aFuture = da >= now;
          const bFuture = db >= now;
          if (aFuture && bFuture) return da.getTime() - db.getTime();
          if (!aFuture && !bFuture) return db.getTime() - da.getTime();
          return aFuture ? -1 : 1;
        });
        setWebinars(sorted);
        setSource('supabase');
        console.log(`[WebinarsContext] Nacten ${items.length} webinaru ze Supabase.`);
      } else {
        console.log('[WebinarsContext] Supabase je prazdne, pouzivam staticka data.');
        setWebinars(WEBINARS);
        setSource('static');
      }
    } catch (e: any) {
      console.error('[WebinarsContext] Chyba pri nacitani webinaru:', e.message);
      setError(e.message);
      setWebinars(WEBINARS);
      setSource('static');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWebinars();
  }, []);

  const now = new Date();
  const upcoming = webinars.filter(w => {
    if (w.isPast) return false;
    const d = new Date(w.year, (w.monthNum || 1) - 1, w.day);
    return d >= now;
  });
  const past = webinars.filter(w => {
    if (w.isPast) return true;
    const d = new Date(w.year, (w.monthNum || 1) - 1, w.day);
    return d < now;
  });

  return (
    <WebinarsContext.Provider value={{ webinars, upcoming, past, loading, error, refresh: fetchWebinars, source }}>
      {children}
    </WebinarsContext.Provider>
  );
}

export function useWebinars() {
  return useContext(WebinarsContext);
}
