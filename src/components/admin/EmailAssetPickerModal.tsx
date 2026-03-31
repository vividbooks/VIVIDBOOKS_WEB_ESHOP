import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Loader2, X, Upload, Check, Image as ImageIcon, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getGalleryFolderColor } from '../../utils/galleryFolderTheme';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H_NO_CT = { Authorization: `Bearer ${publicAnonKey}` } as const;
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

interface ImageItem {
  url: string;
  title: string;
  source: 'product' | 'webinar' | 'blog' | 'novinky' | 'upload';
  category?: string;
  predmet?: string;
}

const GALLERY_CACHE_TTL_MS = 2 * 60 * 1000;
let emailAssetGalleryCache: {
  images: ImageItem[];
  galleryFolders: Record<string, string>;
  fetchedAt: number;
} | null = null;

export function EmailAssetPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [galleryFolders, setGalleryFolders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadAll = useCallback(async (opts?: { skipCache?: boolean }) => {
    if (
      !opts?.skipCache &&
      emailAssetGalleryCache &&
      Date.now() - emailAssetGalleryCache.fetchedAt < GALLERY_CACHE_TTL_MS
    ) {
      setImages(emailAssetGalleryCache.images);
      setGalleryFolders(emailAssetGalleryCache.galleryFolders);
      setLoading(false);
      return;
    }

    setLoading(true);
    const all: ImageItem[] = [];
    let gf: Record<string, string> = {};

    try {
      const urls = [
        `${SERVER}/products`,
        `${SERVER}/webinare`,
        `${SERVER}/admin/blog`,
        `${SERVER}/admin/novinky`,
        `${SERVER}/images`,
        `${SERVER}/image-tags`,
      ];
      const responses = await Promise.all(
        urls.map(u => fetch(u, { headers: AUTH_H_NO_CT }).catch(() => null as Response | null)),
      );
      const jsons = await Promise.all(
        responses.map(r => (r && r.ok ? r.json().catch(() => ({})) : Promise.resolve({}))),
      );

      const dP = jsons[0] as { products?: Record<string, unknown>[] };
      const dW = jsons[1] as { items?: Record<string, unknown>[] };
      const dB = jsons[2] as { items?: Record<string, unknown>[] };
      const dN = jsons[3] as { items?: Record<string, unknown>[] };
      const dI = jsons[4] as { images?: { url: string; name?: string }[] };
      const dT = jsons[5] as { galleryFolders?: Record<string, string> };

      (dP.products || []).forEach((p: Record<string, unknown>) => {
        if (p.image) {
          all.push({
            url: String(p.image),
            title: String(p.name || '?'),
            source: 'product',
            category: p.category as string | undefined,
            predmet: p.predmet as string | undefined,
          });
        }
        if (p.coverImage && p.coverImage !== p.image) {
          all.push({
            url: String(p.coverImage),
            title: `${p.name || '?'} (cover)`,
            source: 'product',
            category: p.category as string | undefined,
            predmet: p.predmet as string | undefined,
          });
        }
      });
      (dW.items || []).forEach((w: Record<string, unknown>) => {
        if (w.coverImage) {
          all.push({ url: String(w.coverImage), title: String(w.title || '?'), source: 'webinar' });
        }
      });
      (dB.items || []).forEach((b: Record<string, unknown>) => {
        if (b.coverImage) {
          all.push({
            url: String(b.coverImage),
            title: String(b.title || '?'),
            source: 'blog',
            category: b.category as string | undefined,
          });
        }
      });
      (dN.items || []).forEach((n: Record<string, unknown>) => {
        if (n.coverImage) {
          all.push({ url: String(n.coverImage), title: String(n.title || '?'), source: 'novinky' });
        }
      });
      all.push(
        ...(dI.images || []).map((img: { url: string; name?: string }) => ({
          url: img.url,
          title: img.name || '?',
          source: 'upload' as const,
        })),
      );
      if (dT.galleryFolders && typeof dT.galleryFolders === 'object') {
        gf = dT.galleryFolders;
      }

      emailAssetGalleryCache = { images: all, galleryFolders: gf, fetchedAt: Date.now() };
      setImages(all);
      setGalleryFolders(gf);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadAll();
  }, [open, loadAll]);

  const getFolderKey = useCallback(
    (img: ImageItem): string => {
      if (img.source === 'product') return img.predmet || img.category || 'Bez předmětu';
      if (img.source === 'webinar') return 'Webináře';
      if (img.source === 'blog') return 'Blog';
      if (img.source === 'novinky') return 'Novinky';
      if (img.source === 'upload') {
        const gf = galleryFolders[img.url]?.trim();
        if (gf) return gf;
        return 'Nahrané soubory';
      }
      return 'Ostatní';
    },
    [galleryFolders],
  );

  const filteredBySearch = useMemo(() => {
    if (!search.trim()) return images;
    const q = search.toLowerCase();
    return images.filter(
      i =>
        i.title?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.predmet?.toLowerCase().includes(q),
    );
  }, [images, search]);

  const folders = useMemo(() => {
    const map = new Map<string, ImageItem[]>();
    for (const img of filteredBySearch) {
      const key = getFolderKey(img);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(img);
    }
    const sourceOrder = ['Webináře', 'Blog', 'Novinky', 'Nahrané soubory'];
    return [...map.entries()].sort(([a], [b]) => {
      const ai = sourceOrder.indexOf(a);
      const bi = sourceOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'cs');
      if (ai === -1) return -1;
      if (bi === -1) return 1;
      return ai - bi;
    });
  }, [filteredBySearch, getFolderKey]);

  const visibleImages = useMemo(() => {
    if (!selectedFolder) return filteredBySearch;
    return filteredBySearch.filter(i => getFolderKey(i) === selectedFolder);
  }, [filteredBySearch, selectedFolder, getFolderKey]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedFolder(null);
      setHighlightUrl(null);
    }
  }, [open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
      const data = await res.json();
      if (data.url) {
        toast.success('Nahráno');
        await loadAll({ skipCache: true });
        setHighlightUrl(data.url);
        setSelectedFolder('Nahrané soubory');
      } else {
        toast.error(data.error || 'Upload selhal');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload selhal');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[15000] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex overflow-hidden w-full max-w-[960px] h-[min(640px,90vh)]"
        onClick={e => e.stopPropagation()}
        style={F}
      >
        <div className="w-[220px] shrink-0 border-r border-gray-100 flex flex-col bg-[#fafbfd]">
          <div className="p-3 border-b border-gray-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-[12px] font-bold text-[#001161]">Složky</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <button
              type="button"
              onClick={() => setSelectedFolder(null)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                selectedFolder === null ? 'bg-[#7C3AED]/15 text-[#7C3AED]' : 'text-[#001161]/70 hover:bg-gray-100'
              }`}
            >
              Vše ({filteredBySearch.length})
            </button>
            {folders.map(([name, list]) => {
              const col = getGalleryFolderColor(name);
              const active = selectedFolder === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedFolder(name)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-bold transition-colors border ${
                    active ? 'ring-2 ring-[#7C3AED]/25' : 'border-transparent'
                  }`}
                  style={{
                    backgroundColor: active ? col.bg : 'transparent',
                    color: col.color,
                    borderColor: active ? col.border : 'transparent',
                  }}
                >
                  {name}
                  <span className="ml-1 opacity-60 font-normal">({list.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-[#001161]">Galerie — vložit obrázek</h2>
              <p className="text-[11px] text-[#001161]/40 mt-0.5">Produkty, webináře, blog, novinky, nahrané soubory</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#001161] text-white text-[11px] font-bold cursor-pointer hover:opacity-90">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? '…' : 'Nahrát'}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="px-5 py-2 border-b border-gray-50">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Hledat podle názvu / předmětu…"
                className="flex-1 bg-transparent text-[12px] text-[#001161] outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
              </div>
            ) : visibleImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-[#001161]/40">
                <ImageIcon className="w-12 h-12 opacity-30" />
                <p className="text-[13px]">Žádné obrázky v této nabídce</p>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {visibleImages.map(img => {
                  const sel = highlightUrl === img.url;
                  return (
                    <button
                      type="button"
                      key={`${img.url}-${img.title}`}
                      onClick={() => {
                        setHighlightUrl(img.url);
                        onPick(img.url);
                      }}
                      className={`relative group rounded-xl overflow-hidden border-2 text-left transition-all aspect-[4/3] ${
                        sel ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-transparent hover:border-gray-200'
                      }`}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      {sel && (
                        <div className="absolute top-1.5 right-1.5 bg-[#7C3AED] text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-1.5">
                        <p className="text-white text-[9px] truncate font-bold">{img.title}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
