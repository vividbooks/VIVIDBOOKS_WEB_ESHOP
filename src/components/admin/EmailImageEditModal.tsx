import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Upload, Layers, ImageIcon } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H_NO_CT = { Authorization: `Bearer ${publicAnonKey}` } as const;
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/**
 * Modal pro nahrazení obrázku (URL / upload / galerie / koláž).
 * Ořez je přímo v levém panelu editoru (`EmailImageCropPanel`).
 */
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
  const [urlDraft, setUrlDraft] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && src) setUrlDraft(src);
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
            <h2 className="text-[15px] font-bold text-[#001161]">Nahradit obrázek</h2>
          </div>
          <button type="button" onClick={close} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer" aria-label="Zavřít">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl border border-gray-100 bg-[#f8f9fc] p-2 flex justify-center max-h-[180px] overflow-hidden">
            <img src={src} alt="" className="max-h-[160px] max-w-full object-contain rounded-lg" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">
              Nová adresa obrázku (URL)
            </label>
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
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Nahrát soubor'}
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
          <p className="text-[11px] text-[#001161]/40 leading-snug" style={F}>
            Ořez najdete přímo v levém panelu u vybraného obrázku.
          </p>
        </div>
      </div>
    </div>
  );
}
