import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Layers, Loader2, X, Plus, Package, Radio, FileText,
  Newspaper, Wand2, Upload, FolderOpen, ChevronRight, CheckSquare,
  LayoutGrid, Check, Sparkles, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { buildEmailProductImagesTableHtml, generateCollageDataUrl } from './collageUtils';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const AUTH_H_NO_CT = { 'Authorization': `Bearer ${publicAnonKey}` };
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

interface ImageItem {
  url: string;
  title: string;
  source: 'product' | 'webinar' | 'blog' | 'novinky' | 'upload';
  category?: string;
  predmet?: string;
}

interface CollageModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
  /** E-mail: vložení tabulky obrázků bez skládání do PNG / bez AI. */
  onInsertHtml?: (html: string) => void;
  editingImageUrls?: string[];
  preSelectUrls?: string[];
  preSelectStyle?: CollageStyle;
  /** `email`: primárně HTML vedle sebe; PNG/AI jen po rozkliknutí „Pokročilé“. */
  uiContext?: 'email';
}

const SOURCE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  product: { label: 'Produkty', icon: Package, color: '#7C3AED', bg: '#f5f3ff' },
  webinar: { label: 'Webináře', icon: Radio, color: '#10b981', bg: '#ecfdf5' },
  blog:    { label: 'Blog', icon: FileText, color: '#3b82f6', bg: '#eff6ff' },
  novinky: { label: 'Novinky', icon: Newspaper, color: '#f59e0b', bg: '#fffbeb' },
  upload:  { label: 'Nahrané', icon: Upload, color: '#6b7280', bg: '#f9fafb' },
};

const FOLDER_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Český jazyk':   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  'Matematika':    { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'Matematika 2. stupeň': { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' },
  'Chemie':        { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  'Fyzika':        { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' },
  'Přírodopis':    { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  'Dějepis':       { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
  'Zeměpis':       { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  'Webináře':      { bg: '#ecfdf5', color: '#10b981', border: '#a7f3d0' },
  'Blog':          { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
  'Novinky':       { bg: '#fffbeb', color: '#f59e0b', border: '#fde68a' },
  'Nahrané soubory': { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
};
const defaultFolderColor = { bg: '#f5f3ff', color: '#7C3AED', border: '#ddd6fe' };

type CollageStyle = 'scattered' | 'grid' | 'fan' | 'ai-table' | 'ai-knapsack' | 'ai-custom';

const AI_PROMPTS: Record<string, string> = {
  'ai-table': `Create a beautiful, realistic overhead photograph of these {N} educational workbook covers (Czech school notebooks / sešity) arranged naturally and casually on a clean light wooden desk surface, as if a student just placed them there. The arrangement should be organic — slightly overlapping each other, with varied gentle rotations, all covers clearly visible. Use warm soft natural daylight. The mood is inviting and study-friendly. Show the actual cover artwork of each book faithfully. Do not add any extra objects or text.`,
  'ai-knapsack': `Create a realistic photograph of an open school backpack / knapsack with these {N} educational workbook covers (Czech school notebooks / sešity) spilling out naturally from it onto a wooden floor or desk. Some books are inside the bag, some are partially out. Warm natural lighting, cozy school atmosphere. Show the actual cover artwork of each book faithfully. Do not add extra text.`,
};

export default function CollageModal({ open, onClose, onInsert, onInsertHtml, editingImageUrls, preSelectUrls, preSelectStyle, uiContext }: CollageModalProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const [selection, setSelection] = useState<ImageItem[]>([]);
  /** Načítání / přepočet canvas koláže (živý náhled). */
  const [canvasPreviewLoading, setCanvasPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cols, setCols] = useState(3);
  const [padding, setPadding] = useState(12);
  const [bg, setBg] = useState('#F8F7FF');
  const [rounded, setRounded] = useState(12);
  /** Stejné jako „Velikost prvků“ v ImageGallery / Koláže. */
  const [bookScale, setBookScale] = useState(100);
  const [style, setStyle] = useState<CollageStyle>('ai-table');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewIsUrl, setPreviewIsUrl] = useState(false); // true = already uploaded URL

  /** Stabilní rozptyl u „Rozsyp“ + nový layout po „Přegenerovat“. */
  const [scatterSeed, setScatterSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [canvasManualRefresh, setCanvasManualRefresh] = useState(0);

  const selectionKey = useMemo(() => selection.map(s => s.url).join('\0'), [selection]);

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  /** V email builderu: skrýt PNG/AI, dokud uživatel nepožádá. */
  const [emailAdvancedCollage, setEmailAdvancedCollage] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (uiContext === 'email') setEmailAdvancedCollage(false);
    loadAllImages();
    const replacingImage = Boolean(editingImageUrls?.length);
    if (!replacingImage) {
      setSelection([]);
      setPreview(null);
      setPreviewIsUrl(false);
      setStep('select');
    }
    if (preSelectStyle) {
      setStyle(preSelectStyle);
    } else if (!replacingImage) {
      // Email builder: mřížka = obálky vedle sebe; jinde výchozí AI scéna (stejný modal jako Hero slider).
      setStyle(uiContext === 'email' ? 'grid' : 'ai-table');
    }
  }, [open, preSelectStyle, uiContext, editingImageUrls?.length]);

  useEffect(() => {
    setScatterSeed(Math.floor(Math.random() * 0x7fffffff));
  }, [selectionKey]);

  const loadAllImages = async () => {
    setLoading(true);
    const all: ImageItem[] = [];
    try {
      const pRes = await fetch(`${SERVER}/products`, { headers: AUTH_H_NO_CT });
      if (pRes.ok) {
        const pData = await pRes.json();
        (pData.products || []).forEach((p: any) => {
          if (p.image) all.push({ url: p.image, title: p.name || '?', source: 'product', category: p.category, predmet: p.predmet });
          if (p.coverImage && p.coverImage !== p.image) all.push({ url: p.coverImage, title: (p.name || '?') + ' (cover)', source: 'product', category: p.category, predmet: p.predmet });
        });
      }
    } catch {}
    try {
      const wRes = await fetch(`${SERVER}/webinare`, { headers: AUTH_H_NO_CT });
      if (wRes.ok) { const wData = await wRes.json(); (wData.items || []).forEach((w: any) => { if (w.coverImage) all.push({ url: w.coverImage, title: w.title || '?', source: 'webinar' }); }); }
    } catch {}
    try {
      const bRes = await fetch(`${SERVER}/admin/blog`, { headers: AUTH_H_NO_CT });
      if (bRes.ok) { const bData = await bRes.json(); (bData.items || []).forEach((b: any) => { if (b.coverImage) all.push({ url: b.coverImage, title: b.title || '?', source: 'blog', category: b.category }); }); }
    } catch {}
    try {
      const nRes = await fetch(`${SERVER}/admin/novinky`, { headers: AUTH_H_NO_CT });
      if (nRes.ok) { const nData = await nRes.json(); (nData.items || []).forEach((n: any) => { if (n.coverImage) all.push({ url: n.coverImage, title: n.title || '?', source: 'novinky' }); }); }
    } catch {}
    try {
      const uRes = await fetch(`${SERVER}/images`, { headers: AUTH_H_NO_CT });
      if (uRes.ok) { const uData = await uRes.json(); (uData.images || []).forEach((img: any) => all.push({ url: img.url, title: img.name || '?', source: 'upload' as const })); }
    } catch {}
    setImages(all);
    setLoading(false);
    setOpenFolders(new Set(all.map(getFolderKey)));
    // Pre-select URLs from agent recommendation
    if (preSelectUrls && preSelectUrls.length > 0) {
      const matched = all.filter(img => preSelectUrls.includes(img.url));
      if (matched.length > 0) {
        setSelection(matched);
        toast.success(`✅ ${matched.length} obrázků předvybráno agentem`);
      }
    }
  };

  const getFolderKey = (img: ImageItem): string => {
    if (img.source === 'product') return img.predmet || img.category || 'Bez předmětu';
    if (img.source === 'webinar') return 'Webináře';
    if (img.source === 'blog') return 'Blog';
    if (img.source === 'novinky') return 'Novinky';
    if (img.source === 'upload') return 'Nahrané soubory';
    return 'Ostatní';
  };

  const filtered = images.filter(img => {
    if (sourceFilter !== 'all' && img.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (img.title?.toLowerCase().includes(q) || img.category?.toLowerCase().includes(q) || img.predmet?.toLowerCase().includes(q));
    }
    return true;
  });

  const sources = ['all', ...new Set(images.map(i => i.source))];

  const folders = React.useMemo(() => {
    const map = new Map<string, ImageItem[]>();
    for (const img of filtered) {
      const key = getFolderKey(img);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(img);
    }
    const sourceOrder = ['Webináře', 'Blog', 'Novinky', 'Nahrané soubory'];
    return [...map.entries()].sort(([a], [b]) => {
      const aIdx = sourceOrder.indexOf(a); const bIdx = sourceOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b, 'cs');
      if (aIdx === -1) return -1; if (bIdx === -1) return 1;
      return aIdx - bIdx;
    });
  }, [filtered]);

  const toggleItem = (img: ImageItem) => {
    setSelection(prev => { const exists = prev.find(p => p.url === img.url); if (exists) return prev.filter(p => p.url !== img.url); return [...prev, img]; });
    setPreview(null); setPreviewIsUrl(false);
  };
  const isSelected = (url: string) => selection.some(s => s.url === url);
  const toggleFolder = (key: string) => { setOpenFolders(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); };
  const selectAllFromFolder = (fi: ImageItem[]) => { setSelection(prev => { const ex = new Set(prev.map(p => p.url)); return [...prev, ...fi.filter(i => !ex.has(i.url))]; }); setPreview(null); setPreviewIsUrl(false); };
  const deselectAllFromFolder = (fi: ImageItem[]) => { const urls = new Set(fi.map(i => i.url)); setSelection(prev => prev.filter(p => !urls.has(p.url))); setPreview(null); setPreviewIsUrl(false); };
  const isFolderFullySelected = (fi: ImageItem[]) => fi.length > 0 && fi.every(i => isSelected(i.url));

  const isAiStyle = (s: CollageStyle) => s.startsWith('ai-');

  /* ── AI Collage Generation ─────────────────────────── */
  const generateAICollage = useCallback(async () => {
    if (selection.length < 1) { toast.error('Vyberte alespoň 1 obrázek'); return; }
    setAiGenerating(true);
    setPreview(null); setPreviewIsUrl(false);

    const msgs = [
      '🎨 Posílám obrázky Gemini AI…',
      '🖼️ AI komponuje scénu…',
      '✨ Generuji fotografii…',
      '📸 Skoro hotovo…',
    ];
    let mi = 0;
    setAiStatusMsg(msgs[0]);
    const ticker = setInterval(() => { mi = Math.min(mi + 1, msgs.length - 1); setAiStatusMsg(msgs[mi]); }, 6000);

    try {
      const promptTemplate = style === 'ai-custom'
        ? aiCustomPrompt || AI_PROMPTS['ai-table']
        : (AI_PROMPTS[style] || AI_PROMPTS['ai-table']);
      const stylePrompt = promptTemplate.replace('{N}', String(selection.length));

      const res = await fetch(`${SERVER}/generate-collage-ai`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({ imageUrls: selection.map(s => s.url), stylePrompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(`AI chyba: ${data.error || 'Neznámá chyba'}`);
        return;
      }
      setPreview(data.url);
      setPreviewIsUrl(true);
      setStep('configure');
      toast.success('AI koláž vygenerována!');
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    } finally {
      clearInterval(ticker);
      setAiGenerating(false);
      setAiStatusMsg('');
    }
  }, [selection, style, aiCustomPrompt]);

  /* ── Canvas koláž: živý náhled jako v editoru sliderů (debounce) ── */
  useEffect(() => {
    if (step !== 'configure' || isAiStyle(style)) return;
    if (selection.length < 2) {
      setCanvasPreviewLoading(false);
      setPreview(null);
      setPreviewIsUrl(false);
      return;
    }

    let cancelled = false;
    setCanvasPreviewLoading(true);
    const canvasStyle = style === 'scattered' || style === 'fan' || style === 'grid' ? style : 'grid';
    const urls = selection.map(s => s.url);
    const tid = window.setTimeout(async () => {
      try {
        const dataUrl = await generateCollageDataUrl(urls, {
          cols,
          padding,
          bg,
          rounded,
          style: canvasStyle,
          bookScale,
          scatterSeed: style === 'scattered' ? scatterSeed : undefined,
        });
        if (cancelled) return;
        if (!dataUrl) {
          toast.error('Žádný obrázek se nepodařilo načíst');
          setPreview(null);
          return;
        }
        setPreview(dataUrl);
        setPreviewIsUrl(false);
      } catch (e: unknown) {
        if (!cancelled) toast.error(`Chyba: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (!cancelled) setCanvasPreviewLoading(false);
      }
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(tid);
      setCanvasPreviewLoading(false);
    };
  }, [
    step,
    style,
    selectionKey,
    cols,
    padding,
    bg,
    rounded,
    bookScale,
    scatterSeed,
    canvasManualRefresh,
  ]);

  /* ── Generate dispatcher (krok 1 / AI) ───────────── */
  const handleGenerate = () => {
    if (isAiStyle(style)) {
      generateAICollage();
      return;
    }
    if (selection.length < 2) {
      toast.error('Vyberte alespoň 2 obrázky pro canvas koláž');
      return;
    }
    setStep('configure');
  };

  const handleRegeneratePreview = () => {
    if (aiGenerating || canvasPreviewLoading || uploading) return;
    if (isAiStyle(style)) {
      generateAICollage();
      return;
    }
    if (style === 'scattered') setScatterSeed(s => s + 1);
    else setCanvasManualRefresh(n => n + 1);
  };

  /* ── Insert (AI = URL already uploaded; Canvas = upload first) */
  const insertPreview = async () => {
    if (!preview) return;
    const savedToast =
      uiContext === 'email'
        ? 'Uloženo — koláž je v mailu jako obrázek.'
        : 'Koláž vložena do emailu!';
    if (previewIsUrl) {
      onInsert(preview);
      toast.success(savedToast);
      onClose();
      return;
    }
    // Canvas: upload base64 first
    setUploading(true);
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      const file = new File([blob], `collage-${Date.now()}.png`, { type: 'image/png' });
      const fd = new FormData(); fd.append('file', file);
      const uRes = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
      const uData = await uRes.json();
      if (uData.url) { toast.success(savedToast); onInsert(uData.url); onClose(); }
      else toast.error(`Upload selhal: ${uData.error}`);
    } catch (e: any) { toast.error(`Upload: ${e.message}`); }
    finally { setUploading(false); }
  };

  if (!open) return null;

  const isAI = isAiStyle(style);
  const busyAny = canvasPreviewLoading || aiGenerating || uploading;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1200px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center">
            <Layers className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1">
            <h2 style={F} className="text-[16px] font-extrabold text-[#001161]">
              {step === 'select' ? 'Vyberte obrázky pro koláž' : 'Náhled koláže'}
            </h2>
            <p style={F} className="text-[11px] text-[#001161]/40">
              {step === 'select'
                ? `Kliknutím vyberte · ${selection.length} vybráno`
                : isAI
                  ? 'AI vygenerovala fotografii sešitů'
                  : 'Canvas koláž — živý náhled při úpravách (jako u slideru), uložením vložíte jeden obrázek'}
            </p>
          </div>
          <div className="flex items-center gap-2 mr-4">
            <button onClick={() => setStep('select')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${step === 'select' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#001161]/30 hover:text-[#001161]/50'}`} style={F}>
              <span className="w-5 h-5 rounded-full bg-[#7C3AED] text-white text-[10px] flex items-center justify-center font-bold">1</span>
              Výběr
            </button>
            <ChevronRight className="w-3 h-3 text-[#001161]/15" />
            <button
              onClick={() => {
                if (selection.length < 1) return;
                if (!isAiStyle(style) && selection.length < 2) {
                  toast.error('Pro canvas koláž vyberte alespoň 2 obrázky');
                  return;
                }
                setStep('configure');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${step === 'configure' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#001161]/30 hover:text-[#001161]/50'}`} style={F}>
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${step === 'configure' ? 'bg-[#7C3AED] text-white' : 'bg-gray-200 text-[#001161]/30'}`}>2</span>
              Koláž
            </button>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer transition-all">
            <X className="w-4 h-4 text-[#001161]/50" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Canvas always in DOM */}

          {step === 'select' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search + filters */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
                <div className="relative flex-1 max-w-[350px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#001161]/25" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Hledat obrázky..."
                    className="w-full pl-9 pr-3 py-2 bg-[#f7f8fc] border border-gray-200 rounded-xl text-[12px] text-[#001161] placeholder-[#001161]/25 focus:outline-none focus:border-[#7C3AED]/40"
                    style={F} />
                </div>
                <div className="flex items-center gap-1">
                  {sources.map(s => {
                    const meta = s === 'all' ? { label: 'Vše', icon: LayoutGrid, color: '#001161', bg: '#f3f4f6' } : SOURCE_META[s];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <button key={s} onClick={() => setSourceFilter(s)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${sourceFilter === s ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'}`}
                        style={{ ...F, backgroundColor: meta.bg, color: meta.color }}>
                        <Icon className="w-3 h-3" />{meta.label}
                      </button>
                    );
                  })}
                </div>
                <span style={F} className="text-[10px] text-[#001161]/30 ml-auto">{filtered.length} obrázků</span>
              </div>

              {uiContext === 'email' && (
                <div
                  className="shrink-0 mx-5 mt-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px] text-[#001161]/85 leading-snug"
                  style={F}
                >
                  <span className="font-bold text-emerald-900">Do mailu bez „generování“:</span>{' '}
                  vyberte obálky a použijte zelené tlačítko <strong className="text-[#001161]">Vložit do mailu</strong> — vloží se
                  běžná tabulka obrázků (žádný PNG, žádné AI). Složený obrázek nebo AI scéna je jen v sekci „Pokročilé“ (jako u Hero slideru).
                </div>
              )}

              {/* Image grid */}
              <div className="flex-1 overflow-y-auto p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-16 gap-2">
                    <Loader2 className="w-5 h-5 text-[#7C3AED] animate-spin" />
                    <span style={F} className="text-[12px] text-[#001161]/40">Načítám obrázky...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {folders.map(([folderName, folderImages]) => {
                      const isOpen = openFolders.has(folderName);
                      const fc = FOLDER_COLORS[folderName] || defaultFolderColor;
                      const allSel = isFolderFullySelected(folderImages);
                      const someSel = folderImages.some(img => isSelected(img.url));
                      return (
                        <div key={folderName} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                          <button onClick={() => toggleFolder(folderName)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50/50 transition-all cursor-pointer">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: fc.bg, border: `1px solid ${fc.border}` }}>
                              <FolderOpen className="w-3.5 h-3.5" style={{ color: fc.color }} />
                            </div>
                            <p style={{ ...F, color: fc.color }} className="text-[12px] font-bold flex-1 text-left">{folderName}</p>
                            <span style={F} className="text-[9px] text-[#001161]/25">{folderImages.length}</span>
                            <button onClick={e => { e.stopPropagation(); allSel ? deselectAllFromFolder(folderImages) : selectAllFromFolder(folderImages); }}
                              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${allSel ? 'bg-[#7C3AED] text-white' : someSel ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'bg-gray-100 text-[#001161]/30 hover:bg-[#7C3AED]/5'}`} style={F}>
                              <CheckSquare className="w-2.5 h-2.5" />{allSel ? 'Odebrat' : 'Vše'}
                            </button>
                            <ChevronRight className={`w-3.5 h-3.5 text-[#001161]/20 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-3 pt-1">
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                {folderImages.map((img, idx) => {
                                  const sel = isSelected(img.url);
                                  return (
                                    <div key={`${img.url}-${idx}`} onClick={() => toggleItem(img)}
                                      className={`relative group aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${sel ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-transparent hover:border-gray-200'}`}>
                                      <img src={img.url} alt={img.title} className="w-full h-full object-cover" loading="lazy" />
                                      {sel && (
                                        <div className="absolute inset-0 bg-[#7C3AED]/20 flex items-center justify-center">
                                          <div className="w-6 h-6 rounded-full bg-[#7C3AED] text-white flex items-center justify-center">
                                            <Check className="w-3.5 h-3.5" />
                                          </div>
                                        </div>
                                      )}
                                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                                        <p className="text-[8px] text-white font-bold truncate" style={F}>{img.title}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div className="px-5 py-3 border-t border-gray-100 shrink-0 bg-white flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Layers className="w-4 h-4 text-[#7C3AED] shrink-0" />
                    <span style={F} className="text-[12px] font-bold text-[#001161]">
                      {selection.length} {selection.length === 1 ? 'obrázek' : selection.length < 5 ? 'obrázky' : 'obrázků'} vybráno
                    </span>
                    {selection.length > 0 && (
                      <div className="flex -space-x-2 ml-2">
                        {selection.slice(0, 6).map(s => (
                          <img key={s.url} src={s.url} alt="" className="w-7 h-9 rounded-md object-cover border-2 border-white shadow-sm" />
                        ))}
                        {selection.length > 6 && (
                          <div className="w-7 h-9 rounded-md bg-gray-100 border-2 border-white flex items-center justify-center">
                            <span style={F} className="text-[8px] font-bold text-[#001161]/40">+{selection.length - 6}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {selection.length > 0 && (
                    <button onClick={() => { setSelection([]); setPreview(null); setPreviewIsUrl(false); }}
                      className="text-[10px] text-red-400 hover:text-red-600 cursor-pointer px-2 py-1" style={F}>
                      Vymazat výběr
                    </button>
                  )}
                </div>

                {uiContext === 'email' && selection.length >= 1 && onInsertHtml && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={F} className="text-[10px] font-bold text-[#001161]/40">
                        Sloupce v mailu
                      </span>
                      {[2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCols(n)}
                          className={`min-w-[2rem] px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                            cols === n ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-[#001161]/50 hover:bg-gray-200'
                          }`}
                          style={F}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onInsertHtml(buildEmailProductImagesTableHtml(
                          selection.map(s => ({ url: s.url, title: s.title })),
                          cols,
                        ));
                        toast.success('Obálky vloženy do mailu');
                        onClose();
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 shadow-md cursor-pointer"
                      style={F}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Vložit do mailu
                    </button>
                  </div>
                )}

                {uiContext === 'email' && (
                  <button
                    type="button"
                    onClick={() => setEmailAdvancedCollage(v => !v)}
                    className="text-[11px] font-bold text-[#7C3AED] hover:underline cursor-pointer text-left w-fit"
                    style={F}
                  >
                    {emailAdvancedCollage
                      ? 'Skrýt: složit do jednoho obrázku (canvas / AI)'
                      : 'Pokročilé: složit do jednoho obrázku (canvas nebo AI)…'}
                  </button>
                )}

                {(uiContext !== 'email' || emailAdvancedCollage) && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                    <div className="flex items-center gap-1 border border-gray-200 rounded-xl p-1 flex-wrap">
                      {([
                        { id: 'ai-table', label: '🪵 Na stole', ai: true },
                        { id: 'ai-knapsack', label: '🎒 Batoh', ai: true },
                        { id: 'scattered', label: '🎴 Rozsyp', ai: false },
                        { id: 'fan', label: '🃏 Vějíř', ai: false },
                        { id: 'grid', label: '⊞ Mřížka', ai: false },
                        { id: 'ai-custom', label: '✏️ Vlastní', ai: true },
                      ] as { id: CollageStyle; label: string; ai: boolean }[]).map(s => (
                        <button key={s.id} onClick={() => setStyle(s.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${style === s.id
                            ? s.ai ? 'bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white shadow-sm' : 'bg-[#001161] text-white'
                            : 'text-[#001161]/40 hover:text-[#001161]/70 hover:bg-gray-50'}`}
                          style={F}>{s.label}</button>
                      ))}
                    </div>

                    <button
                      onClick={handleGenerate}
                      disabled={selection.length < (isAiStyle(style) ? 1 : 2) || busyAny}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-30 cursor-pointer transition-all shadow-lg shrink-0 ${isAiStyle(style) ? 'bg-gradient-to-r from-[#7C3AED] to-[#9F67F5]' : 'bg-[#001161]'}`}
                      style={F}>
                      {busyAny
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {aiStatusMsg || 'Generuji...'}</>
                        : isAiStyle(style)
                          ? <><Sparkles className="w-3.5 h-3.5" /> AI koláž ({selection.length})</>
                          : <><Wand2 className="w-3.5 h-3.5" /> Náhled koláže ({selection.length})</>}
                    </button>
                  </div>
                )}
              </div>
            </div>

          ) : (
            /* STEP 2 */
            <div className="flex-1 flex overflow-hidden">
              {/* Left panel */}
              <div className="w-[280px] min-w-[280px] border-r border-gray-100 overflow-y-auto p-5 space-y-5">

                {/* ── AI styles ── */}
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#7C3AED] to-[#9F67F5] flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <label style={F} className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider">AI generátor</label>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {([
                      { id: 'ai-table', label: '🪵 Sešity na stole', desc: 'Realistická foto, přirozené uspořádání' },
                      { id: 'ai-knapsack', label: '🎒 Sešity z batohu', desc: 'Batoh se sešity vysypanými ven' },
                      { id: 'ai-custom', label: '✏️ Vlastní popis', desc: 'Napište vlastní prompt pro Gemini' },
                    ] as const).map(s => (
                      <button key={s.id} onClick={() => { setStyle(s.id); setPreview(null); setPreviewIsUrl(false); }}
                        className={`flex items-start gap-2 p-3 rounded-xl text-left cursor-pointer transition-all border ${style === s.id
                          ? 'bg-gradient-to-r from-[#7C3AED]/8 to-[#9F67F5]/8 border-[#7C3AED]/30 ring-1 ring-[#7C3AED]/20'
                          : 'border-gray-100 hover:bg-gray-50 hover:border-gray-200'}`} style={F}>
                        <div>
                          <p className={`text-[11px] font-bold ${style === s.id ? 'text-[#7C3AED]' : 'text-[#001161]/70'}`}>{s.label}</p>
                          <p className="text-[9px] text-[#001161]/35 mt-0.5">{s.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {style === 'ai-custom' && (
                    <textarea
                      value={aiCustomPrompt}
                      onChange={e => setAiCustomPrompt(e.target.value)}
                      placeholder="Popište scénu v angličtině... např. 'Create a flat lay photo of these workbooks on a marble surface with coffee and autumn leaves around them'"
                      rows={4}
                      className="mt-2 w-full px-3 py-2 bg-[#f7f8fc] border border-[#7C3AED]/20 rounded-xl text-[11px] text-[#001161] placeholder-[#001161]/25 focus:outline-none focus:border-[#7C3AED]/40 resize-none"
                      style={F}
                    />
                  )}
                </div>

                {/* ── Canvas styles ── */}
                <div className="border-t border-gray-100 pt-4">
                  <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider block mb-2">Canvas (vektorový)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: 'scattered', label: 'Rozsyp', emoji: '🎴' },
                      { id: 'fan', label: 'Vějíř', emoji: '🃏' },
                      { id: 'grid', label: 'Mřížka', emoji: '⊞' },
                    ] as const).map(s => (
                      <button key={s.id} onClick={() => { setStyle(s.id); setPreview(null); setPreviewIsUrl(false); }}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${style === s.id ? 'bg-[#001161]/8 text-[#001161] ring-1 ring-[#001161]/20' : 'bg-gray-50 text-[#001161]/40 hover:bg-gray-100'}`} style={F}>
                        <span className="text-[16px]">{s.emoji}</span>{s.label}
                      </button>
                    ))}
                  </div>
                  {!isAiStyle(style) && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label style={F} className="text-[10px] text-[#001161]/40 block mb-1">Sloupce</label>
                        <div className="flex gap-1">
                          {[2, 3, 4, 5].map(n => (
                            <button key={n} onClick={() => setCols(n)}
                              className={`flex-1 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-all ${cols === n ? 'bg-[#001161] text-white' : 'bg-gray-100 text-[#001161]/40 hover:bg-gray-200'}`} style={F}>{n}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={F} className="text-[10px] text-[#001161]/40 block mb-1">Mezera: {padding}px</label>
                        <input type="range" min={0} max={40} step={4} value={padding} onChange={e => setPadding(+e.target.value)} className="w-full accent-[#7C3AED]" />
                      </div>
                      <div>
                        <label style={F} className="text-[10px] text-[#001161]/40 block mb-1">Zaoblení: {rounded}px</label>
                        <input type="range" min={0} max={32} step={4} value={rounded} onChange={e => setRounded(+e.target.value)} className="w-full accent-[#7C3AED]" />
                      </div>
                      <div>
                        <label style={F} className="text-[10px] text-[#001161]/40 block mb-1">Velikost obálek: {bookScale}%</label>
                        <input type="range" min={40} max={200} step={10} value={bookScale} onChange={e => setBookScale(+e.target.value)} className="w-full accent-[#7C3AED]" />
                      </div>
                      <div>
                        <label style={F} className="text-[10px] text-[#001161]/40 block mb-1">Pozadí</label>
                        <div className="flex gap-1 flex-wrap">
                          {['#F8F7FF', '#FFFFFF', '#001161', '#FFF7ED', '#ECFDF5', '#FEF2F2'].map(c => (
                            <button key={c} onClick={() => setBg(c)}
                              className={`w-6 h-6 rounded-md border-2 cursor-pointer transition-all ${bg === c ? 'border-[#7C3AED] scale-110' : 'border-gray-200'}`} style={{ backgroundColor: c }} />
                          ))}
                          <input type="color" value={bg} onChange={e => setBg(e.target.value)} className="w-6 h-6 rounded-md border-2 border-gray-200 cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected images */}
                <div className="border-t border-gray-100 pt-4">
                  <p style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider mb-2">{selection.length} vybraných</p>
                  <div className="flex flex-wrap gap-1">
                    {selection.map(s => (
                      <div key={s.url} className="relative group">
                        <img src={s.url} alt="" className="w-8 h-11 rounded-md object-cover" />
                        <button onClick={() => toggleItem(s)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setStep('select')} className="mt-2 text-[10px] text-[#7C3AED] hover:underline cursor-pointer" style={F}>
                    + Přidat/odebrat obrázky
                  </button>
                </div>
              </div>

              {/* Right: preview */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#f7f8fc] flex flex-col items-center gap-4">
                {aiGenerating ? (
                  /* AI loading state */
                  <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#7C3AED]/20 to-[#FF6B1A]/20 animate-pulse" />
                      <div className="absolute inset-2 rounded-2xl bg-gradient-to-br from-[#7C3AED]/30 to-[#9F67F5]/30 animate-pulse" style={{ animationDelay: '0.3s' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-[#7C3AED] animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                    </div>
                    <div className="text-center">
                      <p style={F} className="text-[15px] font-extrabold text-[#001161] mb-1">Gemini AI generuje…</p>
                      <p style={F} className="text-[12px] text-[#001161]/40">{aiStatusMsg}</p>
                      <p style={F} className="text-[10px] text-[#001161]/25 mt-2">Může trvat 15–30 vteřin</p>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {selection.slice(0, 5).map(s => (
                        <img key={s.url} src={s.url} alt="" className="w-10 h-14 rounded-lg object-cover shadow-md animate-pulse" style={{ animationDelay: `${Math.random() * 0.5}s` }} />
                      ))}
                      {selection.length > 5 && <div className="w-10 h-14 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center"><span style={F} className="text-[9px] font-bold text-[#7C3AED]">+{selection.length - 5}</span></div>}
                    </div>
                  </div>
                ) : preview ? (
                  <>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden p-4 w-full max-w-[700px] relative">
                      {previewIsUrl
                        ? <img src={preview} alt="AI Koláž" className="max-w-full max-h-[52vh] object-contain mx-auto rounded-xl" />
                        : <img src={preview} alt="Koláž" className="max-w-full max-h-[52vh] object-contain mx-auto rounded-xl" />}
                      {canvasPreviewLoading && !previewIsUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 backdrop-blur-[2px] rounded-xl">
                          <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
                          <span style={F} className="text-[11px] font-bold text-[#001161]/60">Aktualizuji náhled…</span>
                        </div>
                      )}
                    </div>
                    {previewIsUrl && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7C3AED]/8 border border-[#7C3AED]/20">
                        <Sparkles className="w-3 h-3 text-[#7C3AED]" />
                        <span style={F} className="text-[10px] font-bold text-[#7C3AED]">Vygenerováno Gemini AI · uloženo v Storage</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap justify-center">
                      <button type="button" onClick={handleRegeneratePreview} disabled={busyAny}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-[#001161]/60 text-[12px] font-bold hover:bg-gray-50 disabled:opacity-40 cursor-pointer transition-all" style={F}>
                        <RefreshCw className={`w-3.5 h-3.5 ${canvasPreviewLoading && !previewIsUrl ? 'animate-spin' : ''}`} /> Přegenerovat
                      </button>
                      <button type="button" onClick={insertPreview} disabled={busyAny || !preview || (canvasPreviewLoading && !previewIsUrl)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer transition-all shadow-lg" style={F}>
                        {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Nahrávám...</> : <><Plus className="w-3.5 h-3.5" />{uiContext === 'email' ? 'Uložit a vložit jako obrázek' : 'Vložit do emailu'}</>}
                      </button>
                    </div>
                  </>
                ) : !isAiStyle(style) && selection.length < 2 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16 px-6 text-center">
                    <Wand2 className="w-10 h-10 text-[#001161]/20" />
                    <p style={F} className="text-[14px] font-bold text-[#001161]/50">Pro canvas koláž jsou potřeba alespoň 2 obrázky</p>
                    <button type="button" onClick={() => setStep('select')} className="text-[12px] font-bold text-[#7C3AED] hover:underline" style={F}>
                      Zpět k výběru
                    </button>
                  </div>
                ) : !isAiStyle(style) ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16">
                    <Loader2 className="w-10 h-10 text-[#7C3AED] animate-spin" />
                    <p style={F} className="text-[13px] font-bold text-[#001161]/55">Skládám náhled…</p>
                    <p style={F} className="text-[11px] text-[#001161]/35">Úpravy vlevo se promítají automaticky</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 gap-5 py-16">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#7C3AED]/10 to-[#FF6B1A]/10 flex items-center justify-center">
                      <Sparkles className="w-9 h-9 text-[#7C3AED]/30" />
                    </div>
                    <div className="text-center">
                      <p style={F} className="text-[14px] font-bold text-[#001161]/50 mb-1">Připraveno na AI generování</p>
                      <p style={F} className="text-[11px] text-[#001161]/30">
                        {selection.length} obrázků · Gemini {style === 'ai-table' ? '🪵 Na stole' : style === 'ai-knapsack' ? '🎒 Z batohu' : '✏️ Vlastní'}
                      </p>
                    </div>
                    <button type="button" onClick={handleGenerate} disabled={busyAny || selection.length < 1}
                      className="flex items-center gap-2 px-8 py-3 rounded-2xl text-white text-[13px] font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer transition-all shadow-xl bg-gradient-to-r from-[#7C3AED] to-[#9F67F5]" style={F}>
                      <Sparkles className="w-4 h-4" /> Generovat AI fotografii
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}