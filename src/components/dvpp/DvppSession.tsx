/**
 * DVPP zdarma — session přihlášeného učitele (magic link) pro stránky knihovny.
 * Token žije v localStorage (dvppApi), tady je jen stav `me` + obnovení.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { captureAttribution, dvppApi, getDvppSession, type DvppAccess, type DvppMe } from '../../utils/dvppApi';

type Ctx = {
  me: DvppMe | null;
  access: DvppAccess;
  loading: boolean;
  refresh: () => Promise<DvppMe | null>;
  logout: () => Promise<void>;
  setMe: (me: DvppMe | null) => void;
};

const GUEST_ACCESS: DvppAccess = { level: 'guest', starterUsed: 0, starterLimit: 3, reason: 'guest', staffroomStatus: null };

const DvppSessionContext = createContext<Ctx>({
  me: null, access: GUEST_ACCESS, loading: true,
  refresh: async () => null, logout: async () => {}, setMe: () => {},
});

export function DvppSessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<DvppMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getDvppSession()) { setMe(null); setLoading(false); return null; }
    try {
      const r = await dvppApi.me();
      setMe(r.me);
      return r.me;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { captureAttribution(); void refresh(); }, [refresh]);

  const logout = useCallback(async () => { await dvppApi.logout(); setMe(null); }, []);

  const value = useMemo<Ctx>(() => ({
    me, access: me?.access ?? GUEST_ACCESS, loading, refresh, logout, setMe,
  }), [me, loading, refresh, logout]);

  return <DvppSessionContext.Provider value={value}>{children}</DvppSessionContext.Provider>;
}

export function useDvppSession(): Ctx {
  return useContext(DvppSessionContext);
}
