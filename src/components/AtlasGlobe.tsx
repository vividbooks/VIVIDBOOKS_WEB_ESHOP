/**
 * Točící se glóbus do hero kampaně Atlas zeměpisu zdarma — vypadá jako aplikace Vivid Atlas.
 *
 * Canvas + vlastní ortografická projekce (bez knihoven). Data `public/kampane/atlas/globus.json`
 * staví `scripts/atlas-globus-data.py` z aplikace Atlas. Barvy jsou převzaté z Atlasu
 * (`atlas-choropleth-topics.ts`: palety po pěti třídách, moře #151a26, bílé hranice, bez dat #93c5fd),
 * jen samotný glóbus, ploše jako v aplikaci (Vítek 20. 11. 2026: bez okna a bez přechodů).
 * Glóbus se sám točí a střídá témata; jde chytit a otočit, po najetí ukáže stát a hodnotu.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

const FF = "'Fenomen Sans', sans-serif";
const DATA_URL = '/kampane/atlas/globus.json';
const THEME_MS = 4500;
const FADE_MS = 700;
const DEG = Math.PI / 180;

const WATER = '#151a26';
const NO_DATA = '#93c5fd';

type Theme = { key: string; label: string; unit: string; log: boolean; year: number | null };
type Country = { iso: string; name: string; c: number; r: [number, number][][]; v: Record<string, number> };
type GlobeData = { themes: Theme[]; countries: Country[] };

/** Palety z Atlasu (atlas-choropleth-topics.ts), pět tříd od světlé po tmavou. */
const RAMPS: Record<string, string[]> = {
  hustota: ['#eef7ff', '#bae6fd', '#38bdf8', '#0284c7', '#075985'],
  porodnost: ['#fff1f2', '#fecdd3', '#fb7185', '#e11d48', '#881337'],
  zivot: ['#f0fdfa', '#99f6e4', '#2dd4bf', '#0f766e', '#134e4a'],
  hdp: ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#7c2d12'],
  lesy: ['#f7fee7', '#d9f99d', '#84cc16', '#4d7c0f', '#365314'],
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);
const rgb = (c: number[]) => `rgb(${c.map((x) => Math.round(x)).join(',')})`;

/** Hranice tříd jako v Atlasu: kvantily zaokrouhlené na dvě platné číslice. */
function niceRound(v: number) {
  if (v === 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1);
  return Math.round(v / p) * p;
}
function breaksFor(data: GlobeData, key: string): number[] {
  const vals = data.countries
    .map((c) => c.v[key])
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => a - b);
  if (!vals.length) return [];
  const q = (p: number) => vals[Math.round(p * (vals.length - 1))];
  return [0.2, 0.4, 0.6, 0.8].map((p) => niceRound(q(p)));
}
function classOf(breaks: number[], v: number) {
  let i = 0;
  while (i < breaks.length && v >= breaks[i]) i++;
  return i;
}
const fmt = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('cs-CZ');

/**
 * `bare` = jen točící se glóbus bez ovládání (hero slide na homepage): vyplní rodiče, nejde chytit,
 * `placeholder` se ukáže, než se načtou data.
 */
export function AtlasGlobe({ className = '', bare = false, placeholder }: { className?: string; bare?: boolean; placeholder?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GlobeData | null>(null);
  const [themeIdx, setThemeIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState<{ name: string; value: string; x: number; y: number } | null>(null);

  const themes = data?.themes ?? [];
  const theme = themes[themeIdx];
  const breaks = useMemo(() => (data && theme ? breaksFor(data, theme.key) : []), [data, theme]);

  const st = useRef({
    lambda: -10,
    phi: 28,
    drag: null as null | { x: number; y: number; lambda: number; phi: number },
    lastInteract: 0,
    from: [] as number[][],
    to: [] as number[][],
    fadeStart: 0,
    paths: [] as (Path2D | null)[],
    hoverIdx: -1,
  });

  useEffect(() => {
    let alive = true;
    fetch(DATA_URL)
      .then((r) => r.json())
      .then((d: GlobeData) => alive && setData(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!data || !theme) return;
    const s = st.current;
    const ramp = RAMPS[theme.key].map(hex);
    const next = data.countries.map((c) => {
      const v = c.v[theme.key];
      return typeof v === 'number' ? ramp[classOf(breaks, v)] : hex(NO_DATA);
    });
    const now = performance.now();
    const k = s.to.length ? Math.min(1, (now - s.fadeStart) / FADE_MS) : 1;
    s.from = s.to.length ? s.to.map((c, i) => mix(s.from[i] ?? c, c, k)) : next;
    s.to = next;
    s.fadeStart = now;
  }, [data, theme, breaks]);

  useEffect(() => {
    if (!auto || !themes.length) return undefined;
    // ve slidu na homepage je slide vidět jen pár sekund → témata přepínat rychleji
    const t = window.setInterval(() => setThemeIdx((i) => (i + 1) % themes.length), bare ? 2200 : THEME_MS);
    return () => window.clearInterval(t);
  }, [auto, themes.length, bare]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let raf = 0;
    let last = performance.now();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const draw = (now: number) => {
      const s = st.current;
      const dt = Math.min(64, now - last);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (!s.drag && !reduce && now - s.lastInteract > 2500) s.lambda += dt * 0.006;

      const R = Math.min(w, h) * 0.48;
      const cx = w / 2;
      const cy = h / 2;
      const l0 = s.lambda * DEG;
      const p0 = s.phi * DEG;
      const sinP0 = Math.sin(p0);
      const cosP0 = Math.cos(p0);
      const project = (lon: number, lat: number): [number, number, boolean] => {
        const l = lon * DEG - l0;
        const p = lat * DEG;
        const cosP = Math.cos(p);
        const x = cosP * Math.sin(l);
        const y = cosP0 * Math.sin(p) - sinP0 * cosP * Math.cos(l);
        const z = sinP0 * Math.sin(p) + cosP0 * cosP * Math.cos(l);
        if (z >= 0) return [cx + R * x, cy - R * y, true];
        const n = Math.hypot(x, y) || 1;
        return [cx + (R * x) / n, cy - (R * y) / n, false];
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // moře jako v Atlasu (tematická mapa: tmavá voda), ploše bez přechodů
      ctx.fillStyle = WATER;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const line = (pts: [number, number][]) => {
        ctx.beginPath();
        let pen = false;
        for (const [lon, lat] of pts) {
          const [x, y, vis] = project(lon, lat);
          if (vis && pen) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          pen = vis;
        }
        ctx.stroke();
      };
      for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 37 }, (_, i) => [lon, -90 + i * 5] as [number, number]));
      for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat] as [number, number]));

      const k = Math.min(1, (now - s.fadeStart) / FADE_MS);
      const ease = k * k * (3 - 2 * k);
      s.paths = data.countries.map((country, i) => {
        const path = new Path2D();
        let any = false;
        for (const ring of country.r) {
          let visible = false;
          const pts = ring.map(([lon, lat]) => {
            const p = project(lon, lat);
            if (p[2]) visible = true;
            return p;
          });
          if (!visible) continue;
          any = true;
          pts.forEach(([x, y], j) => (j ? path.lineTo(x, y) : path.moveTo(x, y)));
          path.closePath();
        }
        if (!any) return null;
        const c = mix(s.from[i] ?? s.to[i] ?? hex(NO_DATA), s.to[i] ?? hex(NO_DATA), ease);
        ctx.fillStyle = i === s.hoverIdx ? rgb(mix(c, [255, 255, 255], 0.45)) : rgb(c);
        ctx.fill(path);
        return path;
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.8;
      s.paths.forEach((p) => p && ctx.stroke(p));
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  const hitTest = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return -1;
    const rect = canvas.getBoundingClientRect();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return st.current.paths.findIndex((p) => !!p && ctx.isPointInPath(p, x, y));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const s = st.current;
    s.drag = { x: e.clientX, y: e.clientY, lambda: s.lambda, phi: s.phi };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (s.drag) {
      const k = 180 / (canvasRef.current?.clientWidth || 500);
      s.lambda = s.drag.lambda - (e.clientX - s.drag.x) * k;
      s.phi = Math.max(-60, Math.min(70, s.drag.phi + (e.clientY - s.drag.y) * k));
      s.lastInteract = performance.now();
      return;
    }
    if (e.pointerType !== 'mouse' || !data || !theme) return;
    const i = hitTest(e.clientX, e.clientY);
    s.hoverIdx = i;
    if (i < 0) return setHover(null);
    const c = data.countries[i];
    const v = typeof c.v[theme.key] === 'number' ? `${fmt(c.v[theme.key])} ${theme.unit}` : 'bez dat';
    const rect = wrapRef.current!.getBoundingClientRect();
    setHover({ name: c.name, value: v, x: e.clientX - rect.left, y: e.clientY - rect.top });
    s.lastInteract = performance.now();
  };
  const onPointerUp = () => {
    st.current.drag = null;
    st.current.lastInteract = performance.now();
  };

  const pick = (i: number) => {
    setAuto(false);
    setThemeIdx(i);
  };

  if (bare) {
    return (
      <div ref={wrapRef} className={`pointer-events-none relative size-full select-none ${className}`} aria-hidden>
        {!data && placeholder ? <img src={placeholder} alt="" className="absolute inset-0 size-full object-contain" /> : null}
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`relative mx-auto w-full max-w-[560px] select-none ${className}`} style={{ fontFamily: FF }}>
      <canvas
        ref={canvasRef}
        className="block aspect-square w-full cursor-grab touch-pan-y active:cursor-grabbing"
        aria-label="Interaktivní glóbus z Vivid Atlasu: chyťte ho a otočte"
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          st.current.hoverIdx = -1;
          setHover(null);
        }}
      />
      {!data ? <div className="absolute inset-[2%] rounded-full" style={{ background: WATER }} /> : null}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {themes.map((t, i) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(i)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${i === themeIdx ? 'bg-white text-[#1e2533]' : 'bg-white/10 text-white/70 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-[10px] bg-white px-3 py-2 text-[12px] text-[#1e2533] shadow-lg"
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>{hover.name}</strong>
          <span className="ml-2 text-[#1e2533]/60">{hover.value}</span>
        </div>
      ) : null}
    </div>
  );
}
