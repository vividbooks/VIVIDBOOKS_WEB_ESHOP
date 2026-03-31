import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Link2, Crop, Loader2, Upload, Layers, ImageIcon } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { uploadCollageToStorage } from './collageUtils';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H_NO_CT = { Authorization: `Bearer ${publicAnonKey}` } as const;
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

type Tab = 'link' | 'crop';

function CropSubpanel({
  src,
  onBack,
  onDone,
}: {
  src: string;
  onBack: () => void;
  onDone: (publicUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const onImgLoad = () => {
    const im = imgRef.current;
    if (!im) return;
    setNat({ w: im.naturalWidth, h: im.naturalHeight });
    setRect(null);
  };

  useEffect(() => {
    setNat({ w: 0, h: 0 });
    setRect(null);
  }, [src]);

  const onMouseDown = (e: React.MouseEvent) => {
    const im = imgRef.current;
    if (!im || nat.w === 0) return;
    e.preventDefault();
    const r = im.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * nat.w;
    const ny = ((e.clientY - r.top) / r.height) * nat.h;
    dragRef.current = { x: nx, y: ny };

    const onMove = (ev: MouseEvent) => {
      const s = dragRef.current;
      if (!s) return;
      const x2 = ((ev.clientX - r.left) / r.width) * nat.w;
      const y2 = ((ev.clientY - r.top) / r.height) * nat.h;
      const lx = Math.max(0, Math.min(nat.w, Math.min(s.x, x2)));
      const ly = Math.max(0, Math.min(nat.h, Math.min(s.y, y2)));
      const rx = Math.max(0, Math.min(nat.w, Math.max(s.x, x2)));
      const ry = Math.max(0, Math.min(nat.h, Math.max(s.y, y2)));
      const w = Math.max(2, rx - lx);
      const h = Math.max(2, ry - ly);
      setRect({ x: lx, y: ly, w, h });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const applyCrop = async () => {
    const im = imgRef.current;
    if (!im || !rect || rect.w < 4 || rect.h < 4) {
      toast.error('Vyberte větší oblast tažením myši.');
      return;
    }
    setBusy(true);
    try {
      const c = document.createElement('canvas');
      c.width = Math.round(rect.w);
      c.height = Math.round(rect.h);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas');
      ctx.drawImage(im, rect.x, rect.y, rect.w, rect.h, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/png');
      const url = await uploadCollageToStorage(dataUrl);
      if (!url) throw new Error('Upload');
      onDone(url);
    } catch {
      toast.error(
        'Ořez se nepovedl (často kvůli CORS u cizího obrázku). Zkuste „Nová URL“ nebo obrázek nahrát do galerie a vybrat ho odtud.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p style={F} className="text-[11px] text-[#001161]/55 leading-snug">
        Tažením myši vyberte obdélník. U obrázků z jiné domény bez CORS může být export z bezpečnostních důvodů blokovaný.
      </p>
      <div className="relative inline-block max-w-full rounded-xl border border-gray-200 bg-[#f4f5f9] overflow-hidden select-none">
        <img
          ref={imgRef}
          src={src}
          alt=""
          crossOrigin="anonymous"
          className="max-h-[min(52vh,420px)] w-auto max-w-full block"
          draggable={false}
          onLoad={onImgLoad}
          onMouseDown={onMouseDown}
          style={{ cursor: 'crosshair' }}
        />
        {rect && nat.w > 0 && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-[#7C3AED] bg-[#7C3AED]/15"
            style={{
              left: `${(rect.x / nat.w) * 100}%`,
              top: `${(rect.y / nat.h) * 100}%`,
              width: `${(rect.w / nat.w) * 100}%`,
              height: `${(rect.h / nat.h) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl border border-gray-200 text-[12px] font-bold text-[#001161]/70 hover:bg-gray-50 cursor-pointer"
          style={F}
        >
          Zpět
        </button>
        <button
          type="button"
          disabled={busy || !rect}
          onClick={() => void applyCrop()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-45 cursor-pointer"
          style={F}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crop className="w-4 h-4" />}
          Použít ořez
        </button>
      </div>
    </div>
  );
}

export function EmailImageEditModal({
  open,
  src,
  onClose,
  onApplyUrl,
  onOpenGallery,
  onOpenCollage,
}: {
  open: boolean;
  src: string | null;
  onClose: () => void;
  onApplyUrl: (newUrl: string) => void;
  onOpenGallery: () => void;
  onOpenCollage: () => void;
}) {
  const [tab, setTab] = useState<Tab>('link');
  const [urlDraft, setUrlDraft] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && src) {
      setUrlDraft(src);
      setTab('link');
    }
  }, [open, src]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [open, close]);

  const applyUrl = () => {
    const u = urlDraft.trim();
    if (!u || !/^https?:\/\//i.test(u)) {
      toast.error('Zadejte platnou URL (https://…)');
      return;
    }
    onApplyUrl(u);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
      const data = await res.json();
      if (!data.url) {
        toast.error(data.error || 'Nahrání selhalo');
        return;
      }
      onApplyUrl(data.url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Nahrání selhalo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[14500] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={close}
    >
      <div
        className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-gray-100"
        style={F}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-[15px] font-bold text-[#001161]">Obrázek v e-mailu</h2>
          </div>
          <button type="button" onClick={close} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer" aria-label="Zavřít">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-1 border-b border-gray-50">
          <button
            type="button"
            onClick={() => setTab('link')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[12px] font-bold cursor-pointer transition-colors ${
              tab === 'link' ? 'bg-[#7C3AED]/12 text-[#7C3AED]' : 'text-[#001161]/45 hover:bg-gray-50'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Odkaz / soubor
          </button>
          <button
            type="button"
            onClick={() => setTab('crop')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[12px] font-bold cursor-pointer transition-colors ${
              tab === 'crop' ? 'bg-[#7C3AED]/12 text-[#7C3AED]' : 'text-[#001161]/45 hover:bg-gray-50'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            Oříznout
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-2 flex justify-center max-h-[180px] overflow-hidden">
            <img src={src} alt="" className="max-h-[160px] max-w-full object-contain rounded-lg" />
          </div>

          {tab === 'link' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">Nová adresa obrázku (URL)</label>
                <input
                  type="url"
                  value={urlDraft}
                  onChange={e => setUrlDraft(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25"
                  placeholder="https://…"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyUrl}
                  className="px-4 py-2.5 rounded-xl bg-[#001161] text-white text-[12px] font-bold hover:opacity-90 cursor-pointer"
                >
                  Použít URL
                </button>
                <button
                  type="button"
                  onClick={onOpenGallery}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-[12px] font-bold text-[#001161] hover:bg-gray-50 cursor-pointer"
                >
                  Z galerie…
                </button>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#7C3AED]/30 text-[#7C3AED] text-[12px] font-bold cursor-pointer hover:bg-[#7C3AED]/6">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? '…' : 'Nahrát soubor'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => void onFile(e)} disabled={uploading} />
                </label>
                <button
                  type="button"
                  onClick={() => onOpenCollage()}
                  className="px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[12px] font-bold hover:bg-amber-100/80 cursor-pointer flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Nahradit koláží
                </button>
              </div>
            </>
          )}

          {tab === 'crop' && (
            <CropSubpanel
              src={src}
              onBack={() => setTab('link')}
              onDone={url => {
                onApplyUrl(url);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
