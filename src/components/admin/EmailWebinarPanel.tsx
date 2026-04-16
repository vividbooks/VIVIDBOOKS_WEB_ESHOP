import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Video, LayoutGrid, PanelRight, Search } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type { Webinar } from '../../data/webinars';
import {
  type EmailWebinarLayout,
  type EmailWebinarSnapshot,
  EMPTY_EMAIL_WEBINAR_SNAPSHOT,
  snapshotFromWebinar,
} from './emailWebinarBlock';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

const LIVE_DEBOUNCE_MS = 220;

export type EmailWebinarLivePayload = {
  blockId: string;
  layout: EmailWebinarLayout;
  snapshot: EmailWebinarSnapshot;
};

export type EmailWebinarPanelProps = {
  blockId: string;
  getSnapshot: () => { layout: EmailWebinarLayout; snapshot: EmailWebinarSnapshot };
  onLiveUpdate: (payload: EmailWebinarLivePayload) => void;
};

function searchFold(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function EmailWebinarPanel({ blockId, getSnapshot, onLiveUpdate }: EmailWebinarPanelProps) {
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;
  const onLiveUpdateRef = useRef(onLiveUpdate);
  onLiveUpdateRef.current = onLiveUpdate;

  const [loading, setLoading] = useState(true);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<EmailWebinarLayout>('hero');
  const [snapshot, setSnapshot] = useState<EmailWebinarSnapshot>(EMPTY_EMAIL_WEBINAR_SNAPSHOT);

  useEffect(() => {
    const snap = getSnapshotRef.current();
    setLayout(snap.layout);
    setSnapshot({ ...snap.snapshot });
    setSearch('');
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${SERVER}/webinare`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          cache: 'no-store',
        });
        if (!r.ok) throw new Error('Webináře se nepodařilo načíst.');
        const data = await r.json();
        if (cancelled) return;
        setWebinars(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error(e instanceof Error ? e.message : 'Chyba načítání');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blockId]);

  const snapshotSig = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      onLiveUpdateRef.current({
        blockId,
        layout,
        snapshot,
      });
    }, LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [blockId, layout, snapshotSig, snapshot]);

  const sortedWebinars = useMemo(() => {
    const now = new Date();
    return [...webinars].sort((a, b) => {
      const da = new Date(a.year, (a.monthNum || 1) - 1, a.day);
      const db = new Date(b.year, (b.monthNum || 1) - 1, b.day);
      const aFuture = da >= now && !a.isPast;
      const bFuture = db >= now && !b.isPast;
      if (aFuture && bFuture) return da.getTime() - db.getTime();
      if (!aFuture && !bFuture) return db.getTime() - da.getTime();
      return aFuture ? -1 : 1;
    });
  }, [webinars]);

  const filtered = useMemo(() => {
    const q = searchFold(search.trim());
    if (!q) return sortedWebinars;
    return sortedWebinars.filter((w) => {
      const hay = searchFold(
        [w.title, w.subtitle, w.lecturer, w.targetAudience, w.id, w.slug].filter(Boolean).join(' '),
      );
      return hay.includes(q);
    });
  }, [sortedWebinars, search]);

  const pickWebinar = useCallback((w: Webinar) => {
    setSnapshot(snapshotFromWebinar(w));
  }, []);

  return (
    <div className="rounded-xl border border-[#7C3AED]/25 bg-[#fafbfd]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100/80 bg-white/80">
        <Video className="w-4 h-4 text-[#7C3AED] shrink-0" />
        <h3 className="text-[12px] font-bold text-[#001161] truncate" style={F}>
          Webinář v mailu
        </h3>
      </div>

      <div className="shrink-0 px-3 py-2.5 border-b border-gray-100/90 bg-white/70 space-y-2">
        <p style={F} className="text-[9px] font-bold uppercase tracking-wide text-[#001161]/40">
          Rozložení · živý náhled
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setLayout('hero')}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-bold cursor-pointer ${
              layout === 'hero'
                ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                : 'border-gray-200 bg-white text-[#001161]/70'
            }`}
            style={F}
            title="Velký náhled jako na webu — obrázek / žlutý panel a spodní lišta s datem a CTA"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0 opacity-90" />
            Velký náhled
          </button>
          <button
            type="button"
            onClick={() => setLayout('compact')}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-bold cursor-pointer ${
              layout === 'compact'
                ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                : 'border-gray-200 bg-white text-[#001161]/70'
            }`}
            style={F}
            title="Kompaktní — menší náhled vlevo, text a CTA vpravo"
          >
            <PanelRight className="w-3.5 h-3.5 shrink-0 opacity-90" />
            Malý + bok
          </button>
        </div>
        {layout === 'compact' && Boolean(snapshot.coverImage) && (
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <span style={F} className="text-[10px] font-bold text-[#001161]/50 shrink-0">
              Pozadí u náhledu
            </span>
            <input
              type="color"
              value={
                /^#[0-9A-Fa-f]{6}$/i.test(snapshot.coverImageBgColor)
                  ? snapshot.coverImageBgColor
                  : '#ffffff'
              }
              onChange={(e) =>
                setSnapshot((prev) => ({ ...prev, coverImageBgColor: e.target.value }))
              }
              className="h-7 w-12 rounded border border-gray-200 cursor-pointer bg-white shrink-0"
              title="Barva plochy kolem obrázku v kompaktním mailu (dle náhledu webináře)"
            />
            <span style={F} className="text-[10px] text-[#001161]/40 truncate">
              Volitelné — z API pole coverImageBgColor, nebo ručně
            </span>
          </label>
        )}
      </div>

      <div className="px-3 py-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#001161]/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat webinář…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2 text-[12px] text-[#001161] placeholder:text-[#001161]/35 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
            style={F}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[#001161]/45">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span style={F} className="text-[12px]">
              Načítám webináře…
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <p style={F} className="text-[12px] text-[#001161]/40 py-4 text-center">
            Žádný webinář nenalezen.
          </p>
        ) : (
          <ul className="max-h-[280px] overflow-y-auto space-y-1.5 pr-0.5">
            {filtered.map((w) => {
              const snap = snapshotFromWebinar(w);
              const active = snapshot.id === snap.id;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => pickWebinar(w)}
                    className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-[#7C3AED] bg-[#7C3AED]/8'
                        : 'border-gray-200 bg-white hover:border-[#7C3AED]/25'
                    }`}
                  >
                    <p style={F} className="text-[12px] font-bold text-[#001161] line-clamp-2">
                      {w.title}
                    </p>
                    <p style={F} className="text-[10px] text-[#001161]/50 mt-0.5">
                      {w.day}. {w.monthName} {w.year} · {w.time}
                      {w.lecturer ? ` · ${w.lecturer}` : ''}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
