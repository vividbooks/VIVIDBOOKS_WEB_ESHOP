import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crop, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { uploadCollageToStorage } from './collageUtils';

const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

type CropRect = { x: number; y: number; w: number; h: number };
type Handle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'move';

const MIN_CROP = 16;

/** Načte obrázek jako blob URL (same-origin) → canvas/toDataURL nespadne na CORS. */
async function loadCropSource(src: string): Promise<{ objectUrl: string; width: number; height: number }> {
  const res = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'reload' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/') && blob.type !== 'application/octet-stream' && blob.type !== '') {
    throw new Error(`Neplatný typ: ${blob.type || 'unknown'}`);
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve({ width: im.naturalWidth, height: im.naturalHeight });
      im.onerror = () => reject(new Error('decode'));
      im.src = objectUrl;
    });
    if (dims.width < 2 || dims.height < 2) throw new Error('Prázdný obrázek');
    return { objectUrl, ...dims };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function clampCropRect(rect: CropRect, natW: number, natH: number): CropRect {
  let { x, y, w, h } = rect;
  w = Math.max(MIN_CROP, Math.min(natW, Math.round(w)));
  h = Math.max(MIN_CROP, Math.min(natH, Math.round(h)));
  x = Math.max(0, Math.min(natW - w, Math.round(x)));
  y = Math.max(0, Math.min(natH - h, Math.round(y)));
  return { x, y, w, h };
}

function defaultCrop(natW: number, natH: number): CropRect {
  // Výchozí ≈ celý obrázek s malým okrajem, ať jsou handly hned vidět.
  const inset = Math.max(8, Math.round(Math.min(natW, natH) * 0.04));
  return clampCropRect(
    { x: inset, y: inset, w: natW - inset * 2, h: natH - inset * 2 },
    natW,
    natH,
  );
}

function clientToNatural(
  clientX: number,
  clientY: number,
  box: DOMRect,
  natW: number,
  natH: number,
): { x: number; y: number } {
  const x = ((clientX - box.left) / Math.max(1, box.width)) * natW;
  const y = ((clientY - box.top) / Math.max(1, box.height)) * natH;
  return {
    x: Math.max(0, Math.min(natW, x)),
    y: Math.max(0, Math.min(natH, y)),
  };
}

function resizeFromHandle(
  handle: Handle,
  start: CropRect,
  dx: number,
  dy: number,
  natW: number,
  natH: number,
): CropRect {
  let { x, y, w, h } = start;
  const right = x + w;
  const bottom = y + h;

  if (handle === 'move') {
    return clampCropRect({ x: x + dx, y: y + dy, w, h }, natW, natH);
  }

  if (handle.includes('w')) {
    const nx = Math.max(0, Math.min(right - MIN_CROP, x + dx));
    w = right - nx;
    x = nx;
  }
  if (handle.includes('e')) {
    w = Math.max(MIN_CROP, Math.min(natW - x, w + dx));
  }
  if (handle.includes('n')) {
    const ny = Math.max(0, Math.min(bottom - MIN_CROP, y + dy));
    h = bottom - ny;
    y = ny;
  }
  if (handle.includes('s')) {
    h = Math.max(MIN_CROP, Math.min(natH - y, h + dy));
  }

  return clampCropRect({ x, y, w, h }, natW, natH);
}

const HANDLE_CURSORS: Record<Exclude<Handle, 'move'>, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  se: 'nwse-resize',
};

/**
 * Ořez obrázku přímo v postranním panelu Email Builderu —
 * náhled + obrys výřezu + handly na stranách/rozích.
 */
export function EmailImageCropPanel({
  src,
  onApply,
}: {
  src: string;
  onApply: (publicUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{
    handle: Handle;
    startRect: CropRect;
    startX: number;
    startY: number;
    box: DOMRect;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setLoadError(null);
    setNat({ w: 0, h: 0 });
    setRect(null);
    setDisplaySrc(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    void (async () => {
      try {
        const loaded = await loadCropSource(src);
        if (cancelled) {
          URL.revokeObjectURL(loaded.objectUrl);
          return;
        }
        objectUrlRef.current = loaded.objectUrl;
        setNat({ w: loaded.width, h: loaded.height });
        setRect(defaultCrop(loaded.width, loaded.height));
        setDisplaySrc(loaded.objectUrl);
        setLoadState('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[EmailImageCropPanel] load failed', err);
        setLoadState('error');
        setLoadError(
          'Obrázek nejde načíst pro ořez (CORS / síť). Nahrajte ho znovu z disku nebo z galerie.',
        );
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  const beginDrag = useCallback(
    (handle: Handle, e: React.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage || !rect || nat.w === 0 || loadState !== 'ready') return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const box = stage.getBoundingClientRect();
      const p = clientToNatural(e.clientX, e.clientY, box, nat.w, nat.h);
      dragRef.current = {
        handle,
        startRect: { ...rect },
        startX: p.x,
        startY: p.y,
        box,
      };
    },
    [rect, nat.w, nat.h, loadState],
  );

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = clientToNatural(ev.clientX, ev.clientY, d.box, nat.w, nat.h);
      const dx = p.x - d.startX;
      const dy = p.y - d.startY;
      setRect(resizeFromHandle(d.handle, d.startRect, dx, dy, nat.w, nat.h));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [nat.w, nat.h]);

  const applyCrop = async () => {
    const im = imgRef.current;
    if (!im || !rect || loadState !== 'ready') {
      toast.error('Nejdřív upravte výřez.');
      return;
    }
    setBusy(true);
    try {
      const crop = clampCropRect(rect, nat.w, nat.h);
      if (crop.w < 4 || crop.h < 4) {
        toast.error('Výřez je příliš malý.');
        return;
      }
      const maxSide = 2400;
      const scale = Math.min(1, maxSide / Math.max(crop.w, crop.h));
      const outW = Math.max(1, Math.round(crop.w * scale));
      const outH = Math.max(1, Math.round(crop.h * scale));
      const c = document.createElement('canvas');
      c.width = outW;
      c.height = outH;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas');
      ctx.drawImage(im, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);
      const dataUrl = c.toDataURL('image/jpeg', 0.92);
      const url = await uploadCollageToStorage(dataUrl);
      if (!url) throw new Error('Upload');
      onApply(url);
      toast.success('Ořez použit');
    } catch (err) {
      console.error('[EmailImageCropPanel] applyCrop failed', err);
      toast.error('Ořez se nepovedl. Zkuste obrázek nejdřív nahrát z disku / galerie.');
    } finally {
      setBusy(false);
    }
  };

  const resetCrop = () => {
    if (nat.w > 0 && nat.h > 0) setRect(defaultCrop(nat.w, nat.h));
  };

  const handles: Exclude<Handle, 'move'>[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
          Ořez
        </label>
        {loadState === 'ready' && (
          <button
            type="button"
            onClick={resetCrop}
            className="text-[10px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
            style={F}
          >
            Reset
          </button>
        )}
      </div>
      <p style={F} className="text-[11px] text-[#001161]/50 leading-snug">
        Táhněte okraje nebo rohy výřezu. Uvnitř výřezu posunete celý rámeček.
      </p>

      {loadState === 'loading' && (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#f4f5f9] px-3 py-8 text-[12px] text-[#001161]/55">
          <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" />
          Načítám…
        </div>
      )}
      {loadState === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-[12px] text-red-700" style={F}>
          {loadError}
        </div>
      )}

      {loadState === 'ready' && displaySrc && rect && nat.w > 0 && (
        <div className="flex justify-center rounded-xl border border-gray-200 bg-[#111827] p-1 select-none touch-none overflow-hidden">
          <div ref={stageRef} className="relative inline-block max-w-full leading-[0]">
          <img
            ref={imgRef}
            src={displaySrc}
            alt=""
            className="block max-w-full max-h-[280px] h-auto w-auto"
            draggable={false}
          />
          {/* Dim overlay = 4 panely kolem výřezu */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
          >
            <div
              className="absolute left-0 right-0 top-0 bg-black/50"
              style={{ height: `${(rect.y / nat.h) * 100}%` }}
            />
            <div
              className="absolute left-0 right-0 bottom-0 bg-black/50"
              style={{ height: `${((nat.h - rect.y - rect.h) / nat.h) * 100}%` }}
            />
            <div
              className="absolute bg-black/50"
              style={{
                top: `${(rect.y / nat.h) * 100}%`,
                height: `${(rect.h / nat.h) * 100}%`,
                left: 0,
                width: `${(rect.x / nat.w) * 100}%`,
              }}
            />
            <div
              className="absolute bg-black/50"
              style={{
                top: `${(rect.y / nat.h) * 100}%`,
                height: `${(rect.h / nat.h) * 100}%`,
                left: `${((rect.x + rect.w) / nat.w) * 100}%`,
                right: 0,
              }}
            />
          </div>

          {/* Crop frame + move */}
          <div
            className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(124,58,237,0.9)]"
            style={{
              left: `${(rect.x / nat.w) * 100}%`,
              top: `${(rect.y / nat.h) * 100}%`,
              width: `${(rect.w / nat.w) * 100}%`,
              height: `${(rect.h / nat.h) * 100}%`,
              cursor: 'move',
            }}
            onPointerDown={(e) => beginDrag('move', e)}
          >
            {/* Rule-of-thirds guide */}
            <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/70" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/70" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/70" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/70" />
            </div>

            {handles.map((h) => {
              const isCorner = h.length === 2;
              const size = isCorner ? 12 : 10;
              const edgeThick = 4;
              const style: React.CSSProperties = {
                position: 'absolute',
                width: isCorner || h === 'n' || h === 's' ? size : edgeThick,
                height: isCorner || h === 'e' || h === 'w' ? size : edgeThick,
                background: '#fff',
                border: '2px solid #7C3AED',
                borderRadius: isCorner ? 3 : 2,
                boxSizing: 'border-box',
                cursor: HANDLE_CURSORS[h],
                zIndex: 2,
                touchAction: 'none',
              };
              if (h.includes('n')) style.top = -size / 2;
              if (h.includes('s')) style.bottom = -size / 2;
              if (h.includes('w')) style.left = -size / 2;
              if (h.includes('e')) style.right = -size / 2;
              if (h === 'n' || h === 's') {
                style.left = '50%';
                style.marginLeft = -size / 2;
                style.width = Math.max(size, 28);
                style.height = edgeThick + 2;
                if (h === 'n') style.top = -(edgeThick + 1);
                if (h === 's') style.bottom = -(edgeThick + 1);
              }
              if (h === 'e' || h === 'w') {
                style.top = '50%';
                style.marginTop = -size / 2;
                style.height = Math.max(size, 28);
                style.width = edgeThick + 2;
                if (h === 'e') style.right = -(edgeThick + 1);
                if (h === 'w') style.left = -(edgeThick + 1);
              }
              return (
                <div
                  key={h}
                  role="presentation"
                  style={style}
                  onPointerDown={(e) => beginDrag(h, e)}
                />
              );
            })}
          </div>
          </div>
        </div>
      )}

      {loadState === 'ready' && (
        <button
          type="button"
          disabled={busy || !rect}
          onClick={() => void applyCrop()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-3 py-2.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-45 cursor-pointer"
          style={F}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
          Použít ořez
        </button>
      )}
    </div>
  );
}
