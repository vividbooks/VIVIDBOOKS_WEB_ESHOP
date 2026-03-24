import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Images, X, Trash2, Check, Loader2, ImageIcon, Search } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const H = { Authorization: `Bearer ${publicAnonKey}` };

interface GalleryImage {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  /** height of the preview thumbnail, default 160 */
  previewHeight?: number;
  /** if true, component is compact (no label, tiny preview) */
  compact?: boolean;
}

export function ImagePicker({ value, onChange, label, previewHeight = 160, compact = false }: ImagePickerProps) {
  const [uploading, setUploading]   = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: H, body: fd });
      const data = await res.json();
      if (data.url) { onChange(data.url); }
      else { alert(`Upload selhal: ${data.error ?? 'Neznama chyba'}`); }
    } catch (err: any) {
      alert(`Upload selhal: ${err.message}`);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-uploaded
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [onChange]);

  return (
    <>
      <div className="space-y-2">
        {label && (
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
        )}

        {/* Preview */}
        {value ? (
          <div className="relative group rounded-xl overflow-hidden border border-gray-100" style={{ height: compact ? 72 : previewHeight }}>
            <img
              src={value}
              alt="preview"
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
            />
            {/* Overlay actions */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="bg-white text-[#001161] text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-gray-50 shadow"
              >
                <Upload className="w-3.5 h-3.5" /> Nahradit
              </button>
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="bg-white text-[#001161] text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-gray-50 shadow"
              >
                <Images className="w-3.5 h-3.5" /> Galerie
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="bg-red-500 text-white text-[11px] font-bold p-1.5 rounded-lg hover:bg-red-600 shadow"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#001161]/40 hover:bg-gray-50/50 transition-all"
            style={{ height: compact ? 64 : 120 }}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 text-[#001161] animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-6 h-6 text-gray-300" />
                <span className="text-[11px] text-gray-400 font-['Fenomen_Sans',sans-serif]">Klikni nebo přetáhni obrázek</span>
              </>
            )}
          </div>
        )}

        {/* Action buttons (when no image or compact) */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-[#001161] text-[11px] font-bold py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Nahrávám…</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Nahrát soubor</>
            )}
          </button>
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-[#001161] text-[11px] font-bold py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Images className="w-3.5 h-3.5" /> Galerie
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Gallery modal */}
      {galleryOpen && (
        <GalleryModal
          currentUrl={value}
          onSelect={url => { onChange(url); setGalleryOpen(false); }}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  );
}

/* ── Gallery modal ─────────────────────────────────────────────── */
function GalleryModal({ currentUrl, onSelect, onClose }: {
  currentUrl: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [images, setImages]       = useState<GalleryImage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected]   = useState<string>(currentUrl);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${SERVER}/images`, { headers: H });
      const data = await res.json();
      setImages(data.images ?? []);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: H, body: fd });
      const data = await res.json();
      if (data.url) { await load(); setSelected(data.url); }
      else { alert(`Upload selhal: ${data.error}`); }
    } catch (err: any) {
      alert(`Upload selhal: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (img: GalleryImage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Smazat obrázek "${img.name}"?`)) return;
    setDeleting(img.name);
    try {
      await fetch(`${SERVER}/images/${encodeURIComponent(img.name)}`, { method: 'DELETE', headers: H });
      if (selected === img.url) setSelected('');
      await load();
    } finally {
      setDeleting(null);
    }
  };

  const filtered = images.filter(img =>
    !search || img.name.toLowerCase().includes(search.toLowerCase())
  );

  function fmt(bytes: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 780, maxWidth: '100%', height: 580, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-[#001161]">Galerie obrázků</h2>
            <p className="text-[11px] text-gray-400 font-['Fenomen_Sans',sans-serif] mt-0.5">{images.length} souboru v knihovně</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 bg-[#001161] text-white text-[12px] font-bold px-4 py-2 rounded-xl hover:opacity-85 disabled:opacity-50 transition-opacity"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Nahrávám…' : 'Nahrát nový'}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-2.5 border-b border-gray-50">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat obrázek…"
              className="flex-1 bg-transparent text-[12px] text-[#001161] outline-none placeholder-gray-300 font-['Fenomen_Sans',sans-serif]"
            />
            {search && <button onClick={() => setSearch('')}><X className="w-3 h-3 text-gray-400" /></button>}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-7 h-7 text-[#001161] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <ImageIcon className="w-12 h-12 text-gray-200" />
              <p className="text-[13px] text-gray-400 font-['Fenomen_Sans',sans-serif]">
                {search ? 'Žádný obrázek neodpovídá hledání' : 'Zatím žádné obrázky. Nahrajte první!'}
              </p>
              {!search && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 bg-[#001161] text-white text-[12px] font-bold px-4 py-2 rounded-xl hover:opacity-85"
                >
                  <Upload className="w-3.5 h-3.5" /> Nahrát obrázek
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {filtered.map(img => {
                const isSel = selected === img.url || currentUrl === img.url;
                return (
                  <div
                    key={img.name}
                    onClick={() => setSelected(img.url)}
                    className={`relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      isSel ? 'border-[#001161] ring-2 ring-[#001161]/20' : 'border-transparent hover:border-gray-200'
                    }`}
                    style={{ aspectRatio: '4/3' }}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Selection checkmark */}
                    {isSel && (
                      <div className="absolute top-1.5 right-1.5 bg-[#001161] text-white rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all" />
                    {/* File info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                      <p className="text-white text-[9px] truncate font-['Fenomen_Sans',sans-serif]">{img.name}</p>
                      {img.size > 0 && <p className="text-white/60 text-[9px]">{fmt(img.size)}</p>}
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={e => handleDelete(img, e)}
                      disabled={deleting === img.name}
                      className="absolute top-1.5 left-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                      title="Smazat obrázek"
                    >
                      {deleting === img.name
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        : <Trash2 className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-[11px] text-gray-400 font-['Fenomen_Sans',sans-serif]">
            {selected
              ? <span className="text-[#001161] font-bold">Vybrán 1 obrázek</span>
              : 'Klikni na obrázek pro výběr'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[12px] font-bold border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
              Zrušit
            </button>
            <button
              onClick={() => { if (selected) onSelect(selected); }}
              disabled={!selected}
              className="px-4 py-2 text-[12px] font-bold bg-[#001161] text-white rounded-xl hover:opacity-85 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Použít obrázek
            </button>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}
