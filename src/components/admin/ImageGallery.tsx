import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Image, Search, Grid3X3, Layers, Download, Copy, Check,
  Loader2, X, Plus, Trash2, Package, Radio, FileText,
  Newspaper, Wand2, Upload, ZoomIn,
  FolderOpen, ChevronRight, ChevronLeft, CheckSquare,
  Sparkles, RefreshCw, Tag, Tags, Smartphone,
} from 'lucide-react';
import { PhoneSvg } from '../../imports/phone-svg';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { fetchReferenceStyles, type ReferenceImageStyle } from '../../utils/referenceStylesApi';
import {
  buildStudioKidsPromptSection,
  DEFAULT_STUDIO_KIDS_OPTIONS,
  STUDIO_KIDS_BY_STYLE_STORAGE_KEY,
  STUDIO_KIDS_REFERENCE_STYLE_PROMPT,
  type StudioKidsOptions,
} from '../../utils/studioKidsPrompt';
import { StudioKidsStylePanel } from './StudioKidsStylePanel';
import { GALLERY_FOLDER_COLORS as FOLDER_COLORS, defaultGalleryFolderColor as defaultFolderColor } from '../../utils/galleryFolderTheme';

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

type Tab = 'browse' | 'collage' | 'ai-image';

interface AIHistoryEntry {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  sourceUrls: string[];
  sourceCount: number;
}

/** Řetěz verzí po sobě jdoucích generací / přegenerování (navigace Zpět / Vpřed) */
interface AiPreviewChain {
  versions: string[];
  index: number;
}

/* ── AI Image — pouze referenční styly (žádná vestavěná mint / flat-vector šablona) ── */
/** Tvrdá vazba / „cihla“ stránek — modely to často domýšlí u pohledu shora nebo ze tří čtvrtí. */
const SEWN_NOTE =
  `CRITICAL PRODUCT PHYSICS — Czech Vividbooks = soft school WORKBOOKS (sešit / exercise book), NEVER hardcover novels: ` +
  `NO rigid case boards, NO thick squared “brick” of white/ivory pages visible along the bottom or fore-edge. ` +
  `A closed workbook’s visible page edge (where paper meets table or air) must read as a NARROW soft strip only — think roughly 3–10 mm total thickness for the whole closed book, like a stitched school sešit, NOT 15–30+ mm like a hardback text block. ` +
  `SEWN binding (šitá vazba): when OPEN, fully lay-flat; flexible spine, not stiff hinge. ` +
  `Composition: favor angles where the PRINTED COVER faces the camera; if books lie on a surface, tilt them slightly so you mostly see cover art, not a deep cross-section of pages. ` +
  `FORBIDDEN LOOK: layered white page slab, coffee-table hardcover depth, library-book blockiness. ` +
  `Match cover graphics to supplied reference images. `;
const AI_GENERATE_GRAD = ['#7C3AED', '#9F67F5'] as const;

function buildStyleLedTechnicalPrompt(
  workbookCount: number,
  format: string,
  opts?: { studioKids?: boolean },
): string {
  const n = workbookCount;
  const studioKids = Boolean(opts?.studioKids);
  const studioKidsFraming = studioKids
    ? `Framing for this shot: professional studio photograph with children as primary subjects; Vividbooks workbook covers must remain large, legible heroes (titles and artwork readable). Prefer eye-level or slight high-angle editorial studio look; seamless cyclorama. ` +
      `When workbooks rest on a table or are held low, avoid compositions that emphasize a thick white page stack — keep each book visually “flat” and slim. ` +
      `If this conflicts with generic desk-only hero rules, follow THIS instruction. `
    : '';
  const deskHeroFraming =
    !studioKids && n > 0
      ? `Framing (unless the creative brief explicitly demands otherwise): medium close-up on the desk/table surface — the workbook cover(s) must be large hero subjects, cover titles and artwork clearly readable; avoid wide establishing shots where the sešity look small in the distance. If style-reference images show a wide room, reframe tighter so the notebooks stay dominant. `
      : '';
  return (
    `Create one cohesive marketing image. ` +
    (n > 0
      ? `Use the provided content image(s) as ${n} Czech Vividbooks educational workbook/sešit cover(s): integrate them naturally into the scene and keep printed cover artwork accurate. `
      : '') +
    studioKidsFraming +
    deskHeroFraming +
    SEWN_NOTE +
    `Follow the PRIMARY CREATIVE BRIEF at the top of this prompt (when present) and the attached style-reference images for camera, lighting, materials, environment, and palette. ` +
    `Generate in ${format} aspect ratio; compose natively for that frame.`
  );
}

const AI_REVISION_HEADER =
  '=== REVISION (refine the PREVIOUS output — it is the LAST attached image) ===\n';

const AI_FORMAT_OPTS:{id:string;label:string;w:number;h:number}[]=[
  {id:'1:1', label:'Čtverec',  w:1, h:1},{id:'3:4', label:'Portrét',  w:3, h:4},
  {id:'4:3', label:'Standard', w:4, h:3},{id:'16:9',label:'Krajina',  w:16,h:9},
];

/* kept for possible future reference but no longer rendered in UI */
const _AI_PRESETS_LEGACY: { label: string; category: string; prompt: string }[] = [
  // ── Marketing / produktové fotky ─────────────────────────────────────────────
  { label: '🪵 Na stole',   category: 'marketing', prompt: 'Create a beautiful realistic overhead photograph of these {N} Czech educational workbook covers arranged naturally on a clean light wooden desk, slightly overlapping with gentle rotations. Warm soft daylight, cozy study atmosphere. Show actual cover artwork faithfully.' },
  { label: '🎒 Z batohu',   category: 'marketing', prompt: 'Create a realistic photograph of an open school backpack with these {N} Czech educational workbook covers spilling out naturally onto a wooden floor. Some books inside, some partially out. Warm natural lighting.' },
  { label: '📚 Na poličce', category: 'marketing', prompt: 'Create a beautiful photograph of these {N} Czech educational workbooks standing upright on a wooden bookshelf, spines facing forward, neatly arranged. Warm ambient lighting, home library feel.' },
  { label: '☕ Flat lay',   category: 'marketing', prompt: 'Create a stylish flat lay photograph of these {N} Czech educational workbooks on a white marble surface with a coffee cup, autumn leaves, and pencils as props. Overhead shot, professional product photography.' },
  // ── Tab obsah — pro SubjectPage contentImage ──────────────────────────────────
  // Vizuální kontext: karta rounded-32px, navy pozadí #243653 za kartou, žlutý aktivní tab #F9E000,
  // obrázek vyplňuje pravou polovinu karty (objectFit:cover, ~500×450px), editorial styl
  { label: '📱 App na tabletu',        category: 'tab', prompt: 'Clean editorial photograph of a modern tablet on a minimal light desk showing a colorful interactive educational app. Bold navy UI headers, bright yellow accent buttons, animated exercise cards visible. Soft studio lighting, shallow depth of field. Full-bleed portrait crop filling the right half of a rounded feature card. No text overlays.' },
  { label: '🧑‍🏫 Učitel u tabule',     category: 'tab', prompt: 'Warm natural classroom photograph: teacher at a modern interactive whiteboard showing a colorful digital lesson, students aged 10-14 engaged at desks. Bright airy Czech school classroom, wide angle, high-quality editorial photography. Scene fills right half of a split feature card (portrait crop, no text).' },
  { label: '🧪 Věda a pokusy',         category: 'tab', prompt: 'Bright editorial photo of a teenage student doing a science experiment at a lab bench — test tubes, colorful liquids, safety goggles. Tablet nearby shows a Vividbooks lesson with 3D molecular model. Clean white lab, vivid saturated colors, professional educational photography. Portrait crop for feature card.' },
  { label: '✏️ Žák píše do sešitu',    category: 'tab', prompt: 'Warm overhead-angled photograph of a primary school child\'s desk: one of these {N} Vividbooks workbooks open with colorful exercises being filled in by hand, pencil, and a tablet showing the matching digital lesson. Cozy natural light, clean wooden desk surface. Joyful study atmosphere. Portrait crop for split feature card, no text.' },
  { label: '🏠 Domácí studium',        category: 'tab', prompt: 'Cozy lifestyle editorial photo of a 12-year-old studying at home at a desk in a stylish Scandinavian kids room, using a tablet with a Vividbooks app. These {N} workbooks visible nearby. Warm afternoon window light, natural soft colors. Portrait crop filling right half of a rounded split card. No text or logos.' },
  // ── Grafické / minimalistické scény (product mockup styl) ────────────────────
  // Inspirace: flat barevná pozadí (mint #3DCEA6, lavender #C5CDED), plovoucí bílé UI karty,
  // 3D grafické objekty, žádná fotografie — čistý grafický/ilustrační styl
  { label: '🟩 Telefon na zelené',     category: 'graphic', prompt: 'Flat graphic product illustration: two white smartphone mockups floating on a solid vivid mint-green background (#3DCEA6). The phones display clean educational app screens — one showing a bold math equation with an orange rounded calculator keyboard, the other a multiple-choice quiz with rounded pill answer options (A B C D). Small floating UI badge chips ("Úroveň 1", "Úroveň 3") with colored icons hover beside the phones. Thick rounded phone frames in a slightly lighter green. No photography, no real people. Pure graphic 2D illustration style.' },
  { label: '🟦 Tablet na levandulové', category: 'graphic', prompt: 'Flat graphic product illustration: a large iPad mockup tilted at 10 degrees floating on a soft lavender-blue background (#C5CDED). The tablet screen shows a clean educational app — white sidebar listing lesson chapters on the left, a lesson page with a bold 3D numeral in teal-green gradient on the right. Below the tablet a workbook page floats at a slight angle connected by a curved black arrow. Background has subtle light geometric rectangle stripe shapes. Rounded corners, clean white UI, no photography.' },
  { label: '🟧 Karty na oranžové',     category: 'graphic', prompt: 'Flat graphic illustration: three white rounded-rectangle UI cards floating at slight varied rotations on a warm coral-orange solid background (#FF6B4A). Each card shows a different educational exercise — one with a fraction diagram, one with a fill-in-the-blank input field, one with a colorful multiple-choice list. Small decorative geometric shapes (circles, dots) in white at low opacity scatter around. Bold typography on each card. No photos, pure graphic playful style. Square format.' },
  { label: '���� UI na fialové',         category: 'graphic', prompt: 'Flat graphic product illustration: clean white UI card panels overlapping dynamically on a deep purple background (#4C1D95). Each card shows an educational screen component — navigation breadcrumb, exercise prompt with bold heading, answer input field with yellow submit button. Small floating pill labels in yellow and teal. Thin geometric line accents in the background. No real photos, pure vector graphic illustration style. 4:3 landscape format.' },
  { label: '🔵 Desktop na modré',      category: 'graphic', prompt: 'Flat graphic illustration: a wide tablet or laptop mockup floating on a sky-blue background with subtle vertical and horizontal light-blue geometric rectangle stripes. Screen shows a clean solution panel UI: left sidebar with numbered exercise list, right panel with exercise page and rounded yellow and teal action buttons. Soft white-grey device frame with slight perspective tilt. One smaller card floating below. No photography, vector illustration style. 16:9 landscape format.' },
  { label: '🌈 Ikony předmětů',        category: 'graphic', prompt: 'Flat graphic illustration: a tidy grid of colorful subject icon cards on a pure white background. Each rounded white card with soft drop shadow contains a bold subject symbol (sigma for math, leaf for biology, flask for chemistry, open book for Czech language), a short label, a small progress bar, and a colored badge chip. Accent colors: orange, purple (#7C3AED), teal (#3DCEA6), yellow (#F9E000), navy (#001161). Clean 2D flat design, no photography, no real people. Square format, high visual density.' },
];

const SOURCE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  product: { label: 'Produkty', icon: Package,   color: '#7C3AED', bg: '#f5f3ff' },
  webinar: { label: 'Webináře', icon: Radio,      color: '#10b981', bg: '#ecfdf5' },
  blog:    { label: 'Blog',     icon: FileText,   color: '#3b82f6', bg: '#eff6ff' },
  novinky: { label: 'Novinky',  icon: Newspaper,  color: '#f59e0b', bg: '#fffbeb' },
  upload:  { label: 'Nahrané', icon: Upload,     color: '#6b7280', bg: '#f9fafb' },
};

/** Předvolby složek pro uložení AI / uploadů (stejné názvy jako stávající „předmětové“ složky + Nahrané) */
const GALLERY_FOLDER_PRESETS = [...Object.keys(FOLDER_COLORS)].sort((a, b) => a.localeCompare(b, 'cs'));

/* ──────────────────────────────────────── */
export default function ImageGallery() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('browse');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Upload
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Tags
  const [imageTags, setImageTags] = useState<Record<string, string[]>>({});
  /** Nahrané soubory: URL → název složky v levém panelu (KV, ne hashtag tagy) */
  const [imageGalleryFolders, setImageGalleryFolders] = useState<Record<string, string>>({});
  const [editingTagsFor, setEditingTagsFor] = useState<ImageItem | null>(null);

  // Collage
  const [collageSelection, setCollageSelection] = useState<ImageItem[]>([]);
  const [collageGenerating, setCollageGenerating] = useState(false);
  const [collageCols, setCollageCols] = useState(3);
  const [collagePadding, setCollagePadding] = useState(12);
  const [collageBg, setCollageBg] = useState('#F8F7FF');
  const [collageRounded, setCollageRounded] = useState(12);
  const [collageStyle, setCollageStyle] = useState<'scattered' | 'grid' | 'fan'>('scattered');
  const [collagePhoneOverlay, setCollagePhoneOverlay] = useState(false); // SVG phone overlay
  const [collageBookScale, setCollageBookScale] = useState(100); // 50–200%
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collagePreview, setCollagePreview] = useState<string | null>(null);
  const [collageUploading, setCollageUploading] = useState(false);

  // AI Image
  const [aiPrompt, setAiPrompt] = useState(''); // legacy / assembled
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreviewChain, setAiPreviewChain] = useState<AiPreviewChain>({ versions: [], index: 0 });
  const [aiStatusMsg, setAiStatusMsg] = useState('');
  const [aiHistory, setAiHistory] = useState<AIHistoryEntry[]>([]);
  const [aiHistoryOpen, setAiHistoryOpen] = useState(false);

  // AI Style system
  const [aiFormat, setAiFormat] = useState('1:1');

  const [referenceStyles, setReferenceStyles] = useState<ReferenceImageStyle[]>([]);
  const [selectedRefStyleId, setSelectedRefStyleId] = useState('');
  /** Barva scény pro aktuální generování (předvyplní se z referenčního stylu) */
  const [aiGenSceneColor, setAiGenSceneColor] = useState('');
  const [aiGenExtraPrompt, setAiGenExtraPrompt] = useState('');
  /** Volby „děti ve studiu“ per id referenčního stylu (šablonu zapíná aiTemplate u stylu v KV) */
  const [studioKidsByStyleId, setStudioKidsByStyleId] = useState<Record<string, StudioKidsOptions>>(() => {
    try {
      const raw = localStorage.getItem(STUDIO_KIDS_BY_STYLE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return {};
      const out: Record<string, StudioKidsOptions> = {};
      for (const id of Object.keys(parsed)) {
        const v = parsed[id];
        if (!v || typeof v !== 'object') continue;
        const o = v as Record<string, unknown>;
        const { enabled: _e, ...rest } = o;
        out[id] = { ...DEFAULT_STUDIO_KIDS_OPTIONS, ...rest } as StudioKidsOptions;
      }
      return out;
    } catch {
      return {};
    }
  });
  /** Poznámky k poslednímu výstupu — při Přegenerovat jdou do promptu + minulý obrázek na server */
  const [aiRegenerateFeedback, setAiRegenerateFeedback] = useState('');
  const [aiSaveToFolder, setAiSaveToFolder] = useState('Nahrané soubory');
  const [aiSaveToFolderCustom, setAiSaveToFolderCustom] = useState('');
  const [aiSavingToGallery, setAiSavingToGallery] = useState(false);
  const refStyleColorHydrated = useRef(false);

  const aiStyleReady = React.useMemo(() => {
    const st = referenceStyles.find((s) => s.id === selectedRefStyleId);
    if (!st) return false;
    return !!st.prompt?.trim() || (Array.isArray(st.imageUrls) && st.imageUrls.length > 0);
  }, [referenceStyles, selectedRefStyleId]);

  const selectedRefStyle = React.useMemo(
    () => referenceStyles.find((s) => s.id === selectedRefStyleId),
    [referenceStyles, selectedRefStyleId],
  );
  const studioKidsTemplateActive = selectedRefStyle?.aiTemplate === 'studio_kids';
  const studioKidsOptions = React.useMemo((): StudioKidsOptions => {
    if (!selectedRefStyleId) return DEFAULT_STUDIO_KIDS_OPTIONS;
    return { ...DEFAULT_STUDIO_KIDS_OPTIONS, ...studioKidsByStyleId[selectedRefStyleId] };
  }, [selectedRefStyleId, studioKidsByStyleId]);

  const aiPreviewEffectiveIndex = React.useMemo(() => {
    if (aiPreviewChain.versions.length === 0) return 0;
    return Math.min(aiPreviewChain.index, aiPreviewChain.versions.length - 1);
  }, [aiPreviewChain.index, aiPreviewChain.versions.length]);

  const aiPreviewUrl = React.useMemo((): string | null => {
    if (aiPreviewChain.versions.length === 0) return null;
    return aiPreviewChain.versions[aiPreviewEffectiveIndex];
  }, [aiPreviewChain.versions, aiPreviewEffectiveIndex]);

  const clearAiPreviewChain = useCallback(() => {
    setAiPreviewChain({ versions: [], index: 0 });
  }, []);

  const goAiVersionPrev = useCallback(() => {
    setAiPreviewChain((p) => (p.versions.length === 0 ? p : { ...p, index: Math.max(0, p.index - 1) }));
  }, []);

  const goAiVersionNext = useCallback(() => {
    setAiPreviewChain((p) => {
      if (p.versions.length === 0) return p;
      const max = p.versions.length - 1;
      return { ...p, index: Math.min(max, p.index + 1) };
    });
  }, []);

  const removeUrlFromAiPreviewChain = useCallback((url: string) => {
    setAiPreviewChain((prev) => {
      const idxInV = prev.versions.indexOf(url);
      if (idxInV === -1) {
        const cur = prev.versions[Math.min(prev.index, Math.max(0, prev.versions.length - 1))];
        if (cur === url) return { versions: [], index: 0 };
        return prev;
      }
      const nextV = prev.versions.filter((u) => u !== url);
      if (nextV.length === 0) return { versions: [], index: 0 };
      let newI = prev.index;
      if (idxInV < prev.index) newI = prev.index - 1;
      else if (idxInV === prev.index) newI = Math.min(prev.index, nextV.length - 1);
      newI = Math.max(0, Math.min(newI, nextV.length - 1));
      return { versions: nextV, index: newI };
    });
  }, []);

  // Drag & drop for Podklady
  const [droppingCollage, setDroppingCollage] = useState(false);
  const [droppingAi, setDroppingAi] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem('vb:ai-image-history'); if (raw) setAiHistory(JSON.parse(raw)); } catch {}
    try {
      const rid = localStorage.getItem('vb:ai-ref-style-id');
      if (rid) setSelectedRefStyleId(rid);
    } catch {}
    void fetchReferenceStyles().then(setReferenceStyles).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (selectedRefStyleId) localStorage.setItem('vb:ai-ref-style-id', selectedRefStyleId);
      else localStorage.removeItem('vb:ai-ref-style-id');
    } catch { /* ignore */ }
  }, [selectedRefStyleId]);

  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_KIDS_BY_STYLE_STORAGE_KEY, JSON.stringify(studioKidsByStyleId));
    } catch { /* ignore */ }
  }, [studioKidsByStyleId]);

  /** Po načtení stylů z API doplň výchozí barvu pro styl z localStorage (první mount). */
  useEffect(() => {
    if (refStyleColorHydrated.current) return;
    if (!referenceStyles.length || !selectedRefStyleId) return;
    const st = referenceStyles.find((s) => s.id === selectedRefStyleId);
    if (st) {
      setAiGenSceneColor(st.defaultSceneColor?.trim() || '');
      refStyleColorHydrated.current = true;
    }
  }, [referenceStyles, selectedRefStyleId]);

  const saveToHistory = (entry: AIHistoryEntry) => {
    setAiHistory(prev => {
      const next = [entry, ...prev.filter(e => e.id !== entry.id)].slice(0, 30);
      try { localStorage.setItem('vb:ai-image-history', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const deleteFromHistory = (id: string) => {
    setAiHistory(prev => {
      const next = prev.filter(e => e.id !== id);
      try { localStorage.setItem('vb:ai-image-history', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  /* ── Shared drag-and-drop handler for Podklady zones ── */
  const handlePodkladyDrop = useCallback(async (
    e: React.DragEvent,
    clearPreview: () => void,
  ) => {
    e.preventDefault();
    const dt = e.dataTransfer;

    // 1) Files dropped from OS
    if (dt.files && dt.files.length > 0) {
      const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) { toast.error('Přetáhněte obrázky (PNG, JPG, WebP…)'); return; }
      for (const file of files) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
          const d = await res.json();
          if (d.url) {
            const newImg: ImageItem = { url: d.url, title: file.name.replace(/\.[^.]+$/, ''), source: 'upload' };
            setCollageSelection(prev => prev.find(p => p.url === d.url) ? prev : [...prev, newImg]);
            setImages(prev => prev.find(p => p.url === d.url) ? prev : [...prev, newImg]);
            clearPreview();
            toast.success(`Nahráno: ${file.name}`);
          } else {
            toast.error(`${file.name}: ${d.error || 'Upload selhal'}`);
          }
        } catch (err: any) { toast.error(`${file.name}: ${err.message}`); }
      }
      return;
    }

    // 2) Image URL dragged from browser (from gallery grid)
    const urlData = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (urlData) {
      const urls = urlData.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
      for (const url of urls) {
        const existing = images.find(img => img.url === url);
        const item: ImageItem = existing ?? { url, title: url.split('/').pop()?.split('?')[0] || 'Obrázek', source: 'upload' };
        setCollageSelection(prev => prev.find(p => p.url === url) ? prev : [...prev, item]);
        clearPreview();
      }
      if (urls.length > 0) toast.success(`Přidáno ${urls.length} obrázk${urls.length === 1 ? '' : urls.length < 5 ? 'y' : 'ů'}`);
    }
  }, [images]);

  const assembleImageUrls = useCallback((): string[] => collageSelection.map((s) => s.url), [collageSelection]);

  const buildAiPromptForApi = useCallback((): string => {
    const st = referenceStyles.find((s) => s.id === selectedRefStyleId);
    const n = collageSelection.length;
    if (!selectedRefStyleId || !st) return '';
    const hasBrief = !!st.prompt?.trim();
    const hasRefImages = Array.isArray(st.imageUrls) && st.imageUrls.length > 0;
    if (!hasBrief && !hasRefImages) return '';

    let p = '';
    if (hasBrief) {
      p = `=== PRIMARY CREATIVE BRIEF ===\n${st.prompt.trim()}\n\n`;
    }
    const studioKidsOn = st.aiTemplate === 'studio_kids';
    const skMerged: StudioKidsOptions = {
      ...DEFAULT_STUDIO_KIDS_OPTIONS,
      ...(studioKidsByStyleId[selectedRefStyleId] || {}),
    };

    p += buildStyleLedTechnicalPrompt(n, aiFormat, { studioKids: studioKidsOn });

    if (aiGenSceneColor.trim()) {
      p = `${p}\n\n--- Scene color ---\nApply this as the primary unified scene color wherever the composition uses a single hue (walls, seamless backdrop, studio floor, and if a table is visible its top surface — all the same hue unless the creative brief says otherwise): ${aiGenSceneColor.trim()}`;
    }
    if (studioKidsOn) {
      p = `${p}\n\n${buildStudioKidsPromptSection(skMerged)}`;
    }
    if (aiGenExtraPrompt.trim()) {
      p = `${p}\n\n--- Additional instructions ---\n${aiGenExtraPrompt.trim()}`;
    }
    return p;
  }, [referenceStyles, selectedRefStyleId, collageSelection.length, aiFormat, aiGenSceneColor, aiGenExtraPrompt, studioKidsByStyleId]);

  const generateAIImage = useCallback(async (opts?: { regenerate?: boolean; imageModel?: 'flash' | 'pro' }) => {
    const regenerate = Boolean(opts?.regenerate && aiPreviewUrl);
    if (opts?.regenerate && !aiPreviewUrl) {
      toast.error('Nejdřív vygenerujte obrázek, pak můžete přegenerovat s feedbackem.');
      return;
    }
    const imageModel = opts?.imageModel === 'pro' ? 'pro' : 'flash';
    setAiGenerating(true);
    if (!regenerate) setAiPreviewChain({ versions: [], index: 0 });
    const msgs =
      imageModel === 'pro'
        ? ['🎨 Pro model — příprava…', '🖼️ Vyšší kvalita (déle)…', '✨ Generuji obrázek…', '📸 Skoro hotovo…']
        : ['🎨 Posílám Gemini AI…', '🖼️ AI komponuje scénu…', '✨ Generuji obrázek…', '📸 Skoro hotovo…'];
    let mi = 0; setAiStatusMsg(msgs[0]);
    const ticker = setInterval(() => { mi = Math.min(mi + 1, msgs.length - 1); setAiStatusMsg(msgs[mi]); }, 7000);
    try {
      let finalPrompt = buildAiPromptForApi();
      if (!finalPrompt.trim()) {
        toast.error('Vyberte referenční styl a doplňte u něj prompt nebo aspoň jeden referenční obrázek (Nastavení → Referenční styly).');
        return;
      }
      if (regenerate) {
        const fb = aiRegenerateFeedback.trim();
        const revisionBody = fb
          ? fb
          : 'Vylepši předchozí výsledek: silnější kompozice, čitelnější obálky sešitů, stejný styl a paleta jako výše.';
        finalPrompt = `${finalPrompt}\n\n${AI_REVISION_HEADER}${revisionBody}`;
      }
      const imageUrls = assembleImageUrls();
      const activeRef = referenceStyles.find(s => s.id === selectedRefStyleId);
      const styleReferenceUrls = (activeRef?.imageUrls || []).slice(0, 3).filter(Boolean);
      const revisionSourceUrl = regenerate && aiPreviewUrl ? aiPreviewUrl : null;
      const res = await fetch(`${SERVER}/generate-collage-ai`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({
          imageUrls,
          styleReferenceUrls: styleReferenceUrls.length ? styleReferenceUrls : undefined,
          stylePrompt: finalPrompt,
          aspectRatio: aiFormat,
          imageModel,
          ...(revisionSourceUrl ? { previousOutputUrl: revisionSourceUrl } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { toast.error(`AI chyba: ${data.error || 'Neznámá chyba'}`); return; }
      if (!regenerate) {
        setAiPreviewChain({ versions: [data.url], index: 0 });
      } else {
        setAiPreviewChain((prev) => {
          const idx = Math.min(prev.index, Math.max(0, prev.versions.length - 1));
          const nextV = [...prev.versions.slice(0, idx + 1), data.url];
          return { versions: nextV, index: nextV.length - 1 };
        });
      }
      saveToHistory({ id: `ai-${Date.now()}`, url: data.url, prompt: finalPrompt, timestamp: Date.now(), sourceUrls: imageUrls, sourceCount: collageSelection.length });
      toast.success(
        regenerate
          ? imageModel === 'pro'
            ? 'Přegenerováno (Gemini Pro Image).'
            : 'Obrázek přegenerován (Lite).'
          : imageModel === 'pro'
            ? 'AI obrázek vygenerován (Pro).'
            : 'AI obrázek vygenerován (Lite).',
      );
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { clearInterval(ticker); setAiGenerating(false); setAiStatusMsg(''); }
  }, [collageSelection, buildAiPromptForApi, assembleImageUrls, referenceStyles, selectedRefStyleId, aiFormat, aiPreviewUrl, aiRegenerateFeedback]);

  useEffect(() => { loadAllImages(); }, []);

  const loadAllImages = async () => {
    setLoading(true);
    const all: ImageItem[] = [];
    try { const r = await fetch(`${SERVER}/products`, { headers: AUTH_H_NO_CT }); if (r.ok) { const d = await r.json(); (d.products || []).forEach((p: any) => { if (p.image) all.push({ url: p.image, title: p.name || '?', source: 'product', category: p.category, predmet: p.predmet }); if (p.coverImage && p.coverImage !== p.image) all.push({ url: p.coverImage, title: (p.name || '?') + ' (cover)', source: 'product', category: p.category, predmet: p.predmet }); }); } } catch {}
    try { const r = await fetch(`${SERVER}/webinare`, { headers: AUTH_H_NO_CT }); if (r.ok) { const d = await r.json(); (d.items || []).forEach((w: any) => { if (w.coverImage) all.push({ url: w.coverImage, title: w.title || '?', source: 'webinar' }); }); } } catch {}
    try { const r = await fetch(`${SERVER}/admin/blog`, { headers: AUTH_H_NO_CT }); if (r.ok) { const d = await r.json(); (d.items || []).forEach((b: any) => { if (b.coverImage) all.push({ url: b.coverImage, title: b.title || '?', source: 'blog', category: b.category }); }); } } catch {}
    try { const r = await fetch(`${SERVER}/admin/novinky`, { headers: AUTH_H_NO_CT }); if (r.ok) { const d = await r.json(); (d.items || []).forEach((n: any) => { if (n.coverImage) all.push({ url: n.coverImage, title: n.title || '?', source: 'novinky' }); }); } } catch {}
    try { const r = await fetch(`${SERVER}/images`, { headers: AUTH_H_NO_CT }); if (r.ok) { const d = await r.json(); all.push(...(d.images || []).map((img: any) => ({ url: img.url, title: img.name || '?', source: 'upload' as const }))); } } catch {}
    // Load tags
    try {
      const r = await fetch(`${SERVER}/image-tags`, { headers: AUTH_H_NO_CT });
      if (r.ok) {
        const d = await r.json();
        setImageTags(d.tags || {});
        setImageGalleryFolders(d.galleryFolders && typeof d.galleryFolders === 'object' ? d.galleryFolders : {});
      }
    } catch {}
    setImages(all); setLoading(false);
  };

  /* ── Upload handler ── */
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let uploaded = 0;
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
        const d = await res.json();
        if (d.url) { uploaded++; }
        else { toast.error(`${file.name}: ${d.error || 'Upload selhal'}`); }
      } catch (e: any) { toast.error(`${file.name}: ${e.message}`); }
    }
    if (uploaded > 0) toast.success(`Nahráno ${uploaded} soubor${uploaded === 1 ? '' : uploaded < 5 ? 'y' : 'ů'}!`);
    setUploading(false);
    await loadAllImages();
    // Switch to Nahrané soubory folder
    setSelectedFolder('Nahrané soubory');
  };

  /* ── Tag save handler ── */
  const saveTagsForImage = async (url: string, tags: string[]) => {
    try {
      const res = await fetch(`${SERVER}/image-tags`, {
        method: 'POST', headers: AUTH_H,
        body: JSON.stringify({ url, tags }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Chyba'); }
      setImageTags(prev => {
        const next = { ...prev };
        if (tags.length === 0) delete next[url]; else next[url] = tags;
        return next;
      });
    } catch (e: any) { toast.error(`Tagy: ${e.message}`); }
  };

  const saveGalleryFolderForImage = useCallback(async (url: string, folder: string) => {
    const f = folder.trim();
    const res = await fetch(`${SERVER}/image-gallery-folder`, {
      method: 'POST',
      headers: AUTH_H,
      body: JSON.stringify({ url, folder: f }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Nepodařilo se uložit složku');
    }
    setImageGalleryFolders((prev) => {
      const next = { ...prev };
      if (!f) delete next[url];
      else next[url] = f;
      return next;
    });
  }, []);

  const saveAiOutputToGallery = useCallback(async () => {
    if (!aiPreviewUrl || aiSavingToGallery) return;
    const folder = (aiSaveToFolderCustom.trim() || aiSaveToFolder).trim();
    if (!folder) {
      toast.error('Zvolte nebo zadejte složku');
      return;
    }
    setAiSavingToGallery(true);
    try {
      const resImg = await fetch(aiPreviewUrl);
      if (!resImg.ok) throw new Error('Obrázek se nepodařilo načíst (CORS nebo URL). Zkuste znovu.');
      const blob = await resImg.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const mime = blob.type || 'image/jpeg';
      const file = new File([blob], `ai-galerie-${Date.now()}.${ext}`, { type: mime });
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
      const d = await up.json();
      if (!d.url) throw new Error(d.error || 'Upload do úložiště selhal');
      await saveGalleryFolderForImage(d.url, folder);
      await loadAllImages();
      setSelectedFolder(folder);
      setTab('browse');
      toast.success(`Uloženo do složky „${folder}“`);
    } catch (e: any) {
      toast.error(e.message || 'Uložení selhalo');
    } finally {
      setAiSavingToGallery(false);
    }
  }, [aiPreviewUrl, aiSavingToGallery, aiSaveToFolder, aiSaveToFolderCustom, saveGalleryFolderForImage]);

  /* ── Computed ── */
  const allUniqueTags = React.useMemo(() => {
    const set = new Set<string>();
    Object.values(imageTags).forEach(tags => tags.forEach(t => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b, 'cs'));
  }, [imageTags]);

  const filtered = images.filter(img => {
    if (sourceFilter !== 'all' && img.source !== sourceFilter) return false;
    if (tagFilter) {
      const tags = imageTags[img.url] || [];
      if (!tags.includes(tagFilter)) return false;
    }
    if (search) { const q = search.toLowerCase(); return (img.title?.toLowerCase().includes(q) || img.category?.toLowerCase().includes(q) || img.predmet?.toLowerCase().includes(q)); }
    return true;
  });
  const sources = ['all', ...new Set(images.map(i => i.source))];

  const toggleCollageItem = (img: ImageItem) => {
    setCollageSelection(prev => prev.find(p => p.url === img.url) ? prev.filter(p => p.url !== img.url) : [...prev, img]);
    setCollagePreview(null);
  };
  const isInCollage = (url: string) => collageSelection.some(s => s.url === url);

  const getFolderKey = (img: ImageItem): string => {
    if (img.source === 'product') return img.predmet || img.category || 'Bez předmětu';
    if (img.source === 'webinar') return 'Webináře';
    if (img.source === 'blog') return 'Blog';
    if (img.source === 'novinky') return 'Novinky';
    if (img.source === 'upload') {
      const gf = imageGalleryFolders[img.url]?.trim();
      if (gf) return gf;
      return 'Nahrané soubory';
    }
    return 'Ostatní';
  };

  const folders = React.useMemo(() => {
    const map = new Map<string, ImageItem[]>();
    for (const img of filtered) { const key = getFolderKey(img); if (!map.has(key)) map.set(key, []); map.get(key)!.push(img); }
    const sourceOrder = ['Webináře', 'Blog', 'Novinky', 'Nahrané soubory'];
    return [...map.entries()].sort(([a], [b]) => {
      const ai = sourceOrder.indexOf(a), bi = sourceOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'cs');
      if (ai === -1) return -1; if (bi === -1) return 1; return ai - bi;
    });
  }, [filtered, imageGalleryFolders]);

  const selectAllFromFolder = (fi: ImageItem[]) => { setCollageSelection(prev => { const ex = new Set(prev.map(p => p.url)); return [...prev, ...fi.filter(img => !ex.has(img.url))]; }); setCollagePreview(null); };
  const deselectAllFromFolder = (fi: ImageItem[]) => { const u = new Set(fi.map(img => img.url)); setCollageSelection(prev => prev.filter(p => !u.has(p.url))); setCollagePreview(null); };
  const isFolderFullySelected = (fi: ImageItem[]) => fi.length > 0 && fi.every(img => isInCollage(img.url));

  /* ── Render SVG phone frame onto canvas ── */
  const drawPhoneOverlay = useCallback(async (
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    targetW: number, targetH: number,
    rotation: number = 0
  ) => {
    const svgStr = `<svg width="286" height="468" viewBox="0 0 286 468" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#f0)"><rect x="40.1914" y="40.1875" width="204.881" height="387.507" rx="43.2456" fill="#10966F" fill-opacity="0.6"/></g>
<g filter="url(#f1)"><rect x="61.8125" y="32.4219" width="170.839" height="368.531" rx="21.0509" fill="#4D8C7A"/></g>
<rect x="59.7692" y="7.4176" width="200.665" height="405.997" rx="32.1207" fill="#19C795" stroke="#25A580" stroke-width="2.42895"/>
<rect x="69.5742" y="16.0781" width="181.006" height="387.876" rx="21.6228" fill="white"/>
<defs>
<filter id="f0" x="0" y="0" width="286" height="468" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="shape"/><feGaussianBlur stdDeviation="20" result="blur"/></filter>
<filter id="f1" x="43" y="14" width="208" height="406" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="bg"/><feBlend in="SourceGraphic" in2="bg" result="shape"/><feGaussianBlur stdDeviation="9" result="blur"/></filter>
</defs></svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    return new Promise<void>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const scaleX = targetW / 286;
        const scaleY = targetH / 468;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
        ctx.restore();
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  }, []);

  /* ── Canvas collage ── */
  const generateCollage = useCallback(async () => {
    if (collageSelection.length < 2) { toast.error('Vyberte alespoň 2 obrázky'); return; }
    setCollageGenerating(true);
    try {
      const loadImg = (url: string): Promise<HTMLImageElement> => new Promise((res, rej) => { const i = new window.Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error(url)); i.src = url; });
      const loaded: HTMLImageElement[] = [];
      for (const item of collageSelection) { try { loaded.push(await loadImg(item.url)); } catch {} }
      if (!loaded.length) { toast.error('Žádný obrázek se nepodařilo načíst'); return; }
      const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!; const r = collageRounded;

      const drawBookShadow = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) => {
        c.shadowColor='rgba(10,15,60,0.10)'; c.shadowBlur=55; c.shadowOffsetX=0; c.shadowOffsetY=30;
        c.fillStyle='rgba(0,0,0,0.001)'; roundRect(c,x,y,w,h,rad); c.fill();
        c.shadowColor='rgba(8,18,70,0.22)'; c.shadowBlur=20; c.shadowOffsetX=3; c.shadowOffsetY=14;
        c.fillStyle='rgba(0,0,0,0.001)'; roundRect(c,x,y,w,h,rad); c.fill();
        c.shadowColor='rgba(5,12,55,0.38)'; c.shadowBlur=5; c.shadowOffsetX=2; c.shadowOffsetY=5;
        c.fillStyle='rgba(0,0,0,0.001)'; roundRect(c,x,y,w,h,rad); c.fill();
        c.shadowColor='transparent'; c.shadowBlur=0; c.shadowOffsetX=0; c.shadowOffsetY=0;
      };
      const drawBookShadowC = (c: CanvasRenderingContext2D, w: number, h: number, rad: number) => drawBookShadow(c,-w/2,-h/2,w,h,rad);

      const _bScale = collageBookScale / 100;
      if (collageStyle === 'scattered') {
        const bW = Math.round(108 * _bScale), bH = Math.round(150 * _bScale), cols = Math.min(collageCols, loaded.length), rows = Math.ceil(loaded.length / cols);
        const spX = bW + collagePadding + 44, spY = bH + collagePadding + 55, mg = 72;
        canvas.width = cols * spX + mg * 2; canvas.height = rows * spY + mg * 2;
        ctx.fillStyle = collageBg; roundRect(ctx, 0, 0, canvas.width, canvas.height, 24); ctx.fill();
        const rots = loaded.map((_, i) => { const b = [-8,5,-4,6,-5,4,-7,3,-3,7,-4.5,5.5]; return b[i%b.length] + (Math.random()-.5)*2.5; });
        const offs = loaded.map(() => ({ dx: (Math.random()-.5)*18, dy: (Math.random()-.5)*14 }));
        for (let i = 0; i < loaded.length; i++) {
          const cx = mg+(i%cols)*spX+spX/2+offs[i].dx, cy = mg+Math.floor(i/cols)*spY+spY/2+offs[i].dy;
          ctx.save(); ctx.translate(cx,cy); ctx.rotate(rots[i]*Math.PI/180);
          drawBookShadowC(ctx,bW,bH,r);
          ctx.save(); roundRect(ctx,-bW/2,-bH/2,bW,bH,r); ctx.clip();
          const img=loaded[i]; const sc=Math.max(bW/img.width,bH/img.height); ctx.drawImage(img,-img.width*sc/2,-img.height*sc/2,img.width*sc,img.height*sc);
          ctx.restore(); ctx.restore();
        }
      } else if (collageStyle === 'fan') {
        const bW=Math.round(96*_bScale), bH=Math.round(132*_bScale), count=loaded.length, spread=Math.min(count*12,70);
        canvas.width=Math.max(680,count*88); canvas.height=400;
        ctx.fillStyle=collageBg; roundRect(ctx,0,0,canvas.width,canvas.height,24); ctx.fill();
        const cx=canvas.width/2, cy=canvas.height+88;
        for (let i=0;i<loaded.length;i++) {
          const t=count===1?0:(i/(count-1))-.5, a=(t*spread*Math.PI)/180;
          const x=cx+Math.sin(a)*330, y=cy-Math.cos(a)*330;
          ctx.save(); ctx.translate(x,y); ctx.rotate(a);
          drawBookShadowC(ctx,bW,bH,r);
          ctx.save(); roundRect(ctx,-bW/2,-bH/2,bW,bH,r); ctx.clip();
          const img=loaded[i]; const sc=Math.max(bW/img.width,bH/img.height); ctx.drawImage(img,-img.width*sc/2,-img.height*sc/2,img.width*sc,img.height*sc);
          ctx.restore(); ctx.restore();
        }
      } else {
        const cols=Math.min(collageCols,loaded.length), rows=Math.ceil(loaded.length/cols), cW=Math.round(144*_bScale), cH=Math.round(192*_bScale), pad=collagePadding;
        canvas.width=cols*(cW+pad)+pad; canvas.height=rows*(cH+pad)+pad;
        ctx.fillStyle=collageBg; roundRect(ctx,0,0,canvas.width,canvas.height,20); ctx.fill();
        for (let i=0;i<loaded.length;i++) {
          const x=pad+(i%cols)*(cW+pad), y=pad+Math.floor(i/cols)*(cH+pad);
          drawBookShadow(ctx,x,y,cW,cH,r);
          ctx.save(); roundRect(ctx,x,y,cW,cH,r); ctx.clip();
          const img=loaded[i]; const sc=Math.max(cW/img.width,cH/img.height); ctx.drawImage(img,x+(cW-img.width*sc)/2,y+(cH-img.height*sc)/2,img.width*sc,img.height*sc);
          ctx.restore();
        }
      }
      // Phone SVG overlay — draw on top right, portrait phone
      if (collagePhoneOverlay) {
        const phW = Math.round(canvas.width * 0.22);
        const phH = Math.round(phW * (468 / 286));
        const px = canvas.width - phW * 0.38;
        const py = canvas.height - phH * 0.62;
        await drawPhoneOverlay(ctx, px, py, phW, phH, -0.08);
      }

      setCollagePreview(canvas.toDataURL('image/png'));
      toast.success(`Koláž vytvořena (${loaded.length} obrázků)`);
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setCollageGenerating(false); }
  }, [collageSelection, collageCols, collagePadding, collageBg, collageRounded, collageStyle, collagePhoneOverlay, drawPhoneOverlay, collageBookScale]);

  const uploadCollage = async () => {
    if (!collagePreview) return;
    setCollageUploading(true);
    try {
      const blob = await (await fetch(collagePreview)).blob();
      const fd = new FormData(); fd.append('file', new File([blob], `collage-${Date.now()}.png`, { type: 'image/png' }));
      const d = await (await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd })).json();
      if (d.url) { toast.success('Koláž nahrána!'); await navigator.clipboard.writeText(d.url); toast.success('URL zkopírována'); await loadAllImages(); }
      else toast.error(`Upload selhal: ${d.error}`);
    } catch (e: any) { toast.error(`Upload: ${e.message}`); }
    finally { setCollageUploading(false); }
  };

  /* ════════════════════════════════════════════
     RENDER — Miller Columns, 300px each, white
  ════════════════════════════════════════════ */
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <div className="h-full flex" style={{ minWidth: tab === 'browse' ? '900px' : '1300px' }}>

        {/* ══════════════════════════════════════
            COL 1 — 300px, white
            Nav + settings for current tab
        ══════════════════════════════════════ */}
        <div className="w-[300px] min-w-[300px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          {/* Title + Nav */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#9F67F5] flex items-center justify-center shrink-0">
                <Image className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h2 style={F} className="text-[16px] font-extrabold text-[#001161] leading-tight">Obrázky</h2>
                <p style={F} className="text-[10px] text-[#001161]/35">Galerie & tvorba</p>
              </div>
            </div>
            {/* Nav items */}
            <div className="space-y-0.5">
              {([
                { id: 'browse'   as const, label: 'Galerie',  Icon: Grid3X3,  desc: `${images.length} obrázků` },
                { id: 'collage'  as const, label: 'Koláže',   Icon: Layers,   desc: 'Canvas editor' },
                { id: 'ai-image' as const, label: 'AI Image', Icon: Sparkles, desc: 'Gemini AI' },
              ]).map(item => (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${tab === item.id ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#001161]/50 hover:bg-gray-50 hover:text-[#001161]/80'}`}
                  style={F}>
                  <item.Icon className={`w-4 h-4 shrink-0 ${tab === item.id ? 'text-[#7C3AED]' : 'text-[#001161]/30'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-bold truncate ${tab === item.id ? 'text-[#7C3AED]' : ''}`}>{item.label}</p>
                    <p className="text-[9px] opacity-50 truncate">{item.desc}</p>
                  </div>
                  {(item.id === 'collage' || item.id === 'ai-image') && collageSelection.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-white text-[9px] font-bold shrink-0 ${item.id === 'collage' ? 'bg-[#FF6B1A]' : 'bg-[#7C3AED]'}`}>
                      {collageSelection.length}
                    </span>
                  )}
                  {tab === item.id && <ChevronRight className="w-3.5 h-3.5 text-[#7C3AED]/50 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* ── BROWSE: search + filters ── */}
          {tab === 'browse' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="px-4 pt-4 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#001161]/25" />
                  <input value={search} onChange={e => { setSearch(e.target.value); setSelectedFolder(null); }} placeholder="Hledat obrázky..."
                    className="w-full pl-9 pr-3 py-2 bg-[#f7f8fc] border border-gray-200 rounded-xl text-[12px] text-[#001161] placeholder-[#001161]/25 focus:outline-none focus:border-[#7C3AED]/40" style={F} />
                </div>
              </div>

              {/* Source filter */}
              <div className="px-4 pb-2 flex gap-1 flex-wrap shrink-0">
                {sources.map(s => {
                  const meta = s === 'all' ? { label: 'Vše', color: '#001161', bg: '#f3f4f6' } : SOURCE_META[s];
                  if (!meta) return null;
                  return (
                    <button key={s} onClick={() => { setSourceFilter(s); setSelectedFolder(null); }}
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-bold cursor-pointer transition-all border ${sourceFilter === s ? 'border-current opacity-100 ring-1 ring-current ring-offset-1' : 'border-transparent opacity-40 hover:opacity-70'}`}
                      style={{ ...F, backgroundColor: meta.bg, color: meta.color }}>{meta.label}</button>
                  );
                })}
              </div>

              {/* Tag filter */}
              {allUniqueTags.length > 0 && (
                <div className="px-4 pb-3 shrink-0">
                  <p style={F} className="text-[9px] font-bold text-[#001161]/30 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" /> Tagy
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {tagFilter && (
                      <button onClick={() => setTagFilter(null)}
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer transition-all border border-[#7C3AED] bg-[#7C3AED] text-white flex items-center gap-0.5"
                        style={F}><X className="w-2.5 h-2.5" /> {tagFilter}</button>
                    )}
                    {allUniqueTags.filter(t => t !== tagFilter).map(tag => (
                      <button key={tag} onClick={() => { setTagFilter(tag); setSelectedFolder(null); }}
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer transition-all border border-gray-200 bg-gray-50 text-[#001161]/50 hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:bg-[#7C3AED]/5"
                        style={F}>{tag}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selection summary */}
              {collageSelection.length > 0 && (
                <div className="mx-4 mb-3 p-3 rounded-xl bg-[#7C3AED]/5 border border-[#7C3AED]/15 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span style={F} className="text-[10px] font-bold text-[#7C3AED]">{collageSelection.length} vybraných</span>
                    <button onClick={() => { setCollageSelection([]); setCollagePreview(null); clearAiPreviewChain(); }} className="text-[9px] text-red-400 hover:text-red-600 cursor-pointer" style={F}>Smazat</button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {collageSelection.slice(0, 10).map(img => (
                      <img key={img.url} src={img.url} alt="" className="w-7 h-9 rounded-md object-cover" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── KOLÁŽE: podklady (vybrané + upload) ── */}
          {tab === 'collage' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="px-4 pt-4 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider">Podklady ({collageSelection.length})</span>
                  {collageSelection.length > 0 && (
                    <button onClick={() => { setCollageSelection([]); setCollagePreview(null); }} className="text-[9px] text-red-400 hover:text-red-600 cursor-pointer" style={F}>Vymazat vše</button>
                  )}
                </div>

                {/* Drop zone wrapper */}
                <div
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDroppingCollage(true); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDroppingCollage(false); }}
                  onDrop={async e => { setDroppingCollage(false); await handlePodkladyDrop(e, () => setCollagePreview(null)); }}
                  className={`rounded-2xl transition-all ${droppingCollage ? 'ring-2 ring-[#7C3AED] ring-offset-1 bg-[#7C3AED]/5' : ''}`}
                >
                  {collageSelection.length === 0 ? (
                    <div className={`flex flex-col items-center gap-2 py-6 rounded-2xl border-2 border-dashed transition-all ${droppingCollage ? 'border-[#7C3AED] bg-[#7C3AED]/5' : 'border-gray-200 bg-gray-50'}`}>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${droppingCollage ? 'bg-[#7C3AED]/15' : 'bg-gray-100'}`}>
                        {droppingCollage
                          ? <Download className="w-5 h-5 text-[#7C3AED] animate-bounce" />
                          : <Image className="w-5 h-5 text-[#001161]/15" />}
                      </div>
                      <p style={F} className={`text-[10px] text-center leading-relaxed transition-all ${droppingCollage ? 'text-[#7C3AED] font-bold' : 'text-[#001161]/30'}`}>
                        {droppingCollage ? 'Pusťte obrázek zde' : 'Přetáhněte sem obrázky\nnebo použijte tlačítka níže'}
                      </p>
                    </div>
                  ) : (
                    <div className={`space-y-1.5 max-h-[320px] overflow-y-auto rounded-2xl border-2 border-dashed transition-all p-1 ${droppingCollage ? 'border-[#7C3AED] bg-[#7C3AED]/5' : 'border-transparent'}`}>
                      {collageSelection.map((img, i) => (
                        <div key={img.url} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 group hover:bg-[#7C3AED]/5 transition-all">
                          <img src={img.url} alt={img.title} className="w-8 h-11 rounded-md object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p style={F} className="text-[10px] font-bold text-[#001161] truncate">{img.title}</p>
                            <span style={F} className="text-[8px] text-[#001161]/30">#{i + 1}</span>
                          </div>
                          <button onClick={() => toggleCollageItem(img)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 cursor-pointer transition-all"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      {droppingCollage && (
                        <div className="flex items-center justify-center py-2 rounded-xl border-2 border-dashed border-[#7C3AED]/40 bg-[#7C3AED]/5">
                          <p style={F} className="text-[10px] text-[#7C3AED] font-bold">Pusťte pro přidání</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => setTab('browse')}
                    className="flex-1 py-1.5 rounded-xl border border-dashed border-[#7C3AED]/30 text-[#7C3AED] text-[10px] font-bold cursor-pointer hover:bg-[#7C3AED]/5 transition-all flex items-center justify-center gap-1"
                    style={F}>
                    <Grid3X3 className="w-3 h-3" /> Z galerie
                  </button>
                  <label
                    className="flex-1 py-1.5 rounded-xl border border-dashed border-[#FF6B1A]/40 text-[#FF6B1A] text-[10px] font-bold cursor-pointer hover:bg-[#FF6B1A]/5 transition-all flex items-center justify-center gap-1"
                    style={F}>
                    <Upload className="w-3 h-3" /> Nahrát
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        for (const file of Array.from(files)) {
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
                            const d = await res.json();
                            if (d.url) {
                              const newImg: ImageItem = { url: d.url, title: file.name.replace(/\.[^.]+$/, ''), source: 'upload' };
                              setCollageSelection(prev => prev.find(p => p.url === d.url) ? prev : [...prev, newImg]);
                              setImages(prev => prev.find(p => p.url === d.url) ? prev : [...prev, newImg]);
                              toast.success(`Nahráno: ${file.name}`);
                            } else {
                              toast.error(`${file.name}: ${d.error}`);
                            }
                          } catch (err: any) { toast.error(`${file.name}: ${err.message}`); }
                        }
                        setCollagePreview(null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── AI IMAGE: source images + presets + prompt ── */}
          {tab === 'ai-image' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="px-4 pt-4 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider">Podklady ({collageSelection.length})</span>
                  {collageSelection.length > 0 && (
                    <button onClick={() => { setCollageSelection([]); clearAiPreviewChain(); }} className="text-[9px] text-red-400 hover:text-red-600 cursor-pointer" style={F}>Vymazat vše</button>
                  )}
                </div>
                {/* Drop zone wrapper */}
                <div
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDroppingAi(true); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDroppingAi(false); }}
                  onDrop={async e => { setDroppingAi(false); await handlePodkladyDrop(e, () => clearAiPreviewChain()); }}
                  className={`rounded-2xl transition-all ${droppingAi ? 'ring-2 ring-[#7C3AED] ring-offset-1 bg-[#7C3AED]/5' : ''}`}
                >
                  {collageSelection.length === 0 ? (
                    <div className={`flex flex-col items-center gap-2 py-6 rounded-2xl border-2 border-dashed transition-all ${droppingAi ? 'border-[#7C3AED] bg-[#7C3AED]/5' : 'border-gray-200 bg-gray-50'}`}>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${droppingAi ? 'bg-[#7C3AED]/15' : 'bg-[#7C3AED]/8'}`}>
                        {droppingAi
                          ? <Download className="w-5 h-5 text-[#7C3AED] animate-bounce" />
                          : <Sparkles className="w-5 h-5 text-[#7C3AED]/30" />}
                      </div>
                      <p style={F} className={`text-[10px] text-center leading-relaxed transition-all ${droppingAi ? 'text-[#7C3AED] font-bold' : 'text-[#001161]/30'}`}>
                        {droppingAi ? 'Pusťte obrázek zde' : 'Přetáhněte sem obrázky\nnebo použijte tlačítka níže'}
                      </p>
                    </div>
                  ) : (
                    <div className={`space-y-1.5 max-h-[200px] overflow-y-auto rounded-2xl border-2 border-dashed transition-all p-1 ${droppingAi ? 'border-[#7C3AED] bg-[#7C3AED]/5' : 'border-transparent'}`}>
                      {collageSelection.map((img, i) => (
                        <div key={img.url} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 group hover:bg-[#7C3AED]/5 transition-all">
                          <img src={img.url} alt={img.title} className="w-8 h-11 rounded-lg object-cover shrink-0 shadow-sm" />
                          <div className="flex-1 min-w-0">
                            <p style={F} className="text-[10px] font-bold text-[#001161] truncate">{img.title}</p>
                            <p style={F} className="text-[8px] text-[#001161]/30">#{i + 1}</p>
                          </div>
                          <button onClick={() => { toggleCollageItem(img); clearAiPreviewChain(); }} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-red-400 cursor-pointer transition-all"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      {droppingAi && (
                        <div className="flex items-center justify-center py-2 rounded-xl border-2 border-dashed border-[#7C3AED]/40 bg-[#7C3AED]/5">
                          <p style={F} className="text-[10px] text-[#7C3AED] font-bold">Pusťte pro přidání</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => setTab('browse')}
                    className="flex-1 py-1.5 rounded-xl border border-dashed border-[#7C3AED]/30 text-[#7C3AED] text-[10px] font-bold cursor-pointer hover:bg-[#7C3AED]/5 transition-all flex items-center justify-center gap-1"
                    style={F}>
                    <Grid3X3 className="w-3 h-3" /> Z galerie
                  </button>
                  <label
                    className="flex-1 py-1.5 rounded-xl border border-dashed border-[#FF6B1A]/40 text-[#FF6B1A] text-[10px] font-bold cursor-pointer hover:bg-[#FF6B1A]/5 transition-all flex items-center justify-center gap-1"
                    style={F}>
                    <Upload className="w-3 h-3" /> Nahrát
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        for (const file of Array.from(files)) {
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
                            const d = await res.json();
                            if (d.url) {
                              const newImg: ImageItem = { url: d.url, title: file.name.replace(/\.[^.]+$/, ''), source: 'upload' };
                              setCollageSelection(prev => prev.find(p => p.url === d.url) ? prev : [...prev, newImg]);
                              setImages(prev => prev.find(p => p.url === d.url) ? prev : [...prev, newImg]);
                              clearAiPreviewChain();
                              toast.success(`Nahráno: ${file.name}`);
                            } else {
                              toast.error(`${file.name}: ${d.error}`);
                            }
                          } catch (err: any) { toast.error(`${file.name}: ${err.message}`); }
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            COL 2 — 300px, white
            Folder list / collage preview / AI preview
        ══════════════════════════════════════ */}
        <div className="w-[300px] min-w-[300px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          {/* BROWSE: folder list */}
          {tab === 'browse' && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 sticky top-0 bg-white shrink-0">
                <FolderOpen className="w-4 h-4 text-[#001161]/30" />
                <span style={F} className="text-[12px] font-bold text-[#001161]">Složky</span>
                <span style={F} className="text-[10px] text-[#001161]/30 ml-auto">{folders.length} složek</span>
              </div>
              {/* All */}
              <button onClick={() => setSelectedFolder(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-all cursor-pointer ${selectedFolder === null ? 'bg-[#7C3AED]/8' : 'hover:bg-gray-50'}`}>
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Grid3X3 className="w-4 h-4 text-[#001161]/35" />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={F} className={`text-[12px] font-bold truncate ${selectedFolder === null ? 'text-[#7C3AED]' : 'text-[#001161]'}`}>Všechny obrázky</p>
                  <p style={F} className="text-[9px] text-[#001161]/30">{filtered.length} obrázků</p>
                </div>
                {selectedFolder === null && <ChevronRight className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />}
              </button>
              {/* Folders */}
              {loading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin" /></div>
              ) : folders.map(([folderName, folderImages]) => {
                const fc = FOLDER_COLORS[folderName] || defaultFolderColor;
                const isSelected = selectedFolder === folderName;
                const selectedCount = folderImages.filter(img => isInCollage(img.url)).length;
                return (
                  <button key={folderName} onClick={() => setSelectedFolder(folderName)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition-all cursor-pointer ${isSelected ? 'bg-[#7C3AED]/8' : 'hover:bg-gray-50'}`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: fc.bg, border: `1.5px solid ${fc.border}` }}>
                      <FolderOpen className="w-4 h-4" style={{ color: fc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ ...F, color: isSelected ? '#7C3AED' : '#001161' }} className="text-[12px] font-bold truncate">{folderName}</p>
                      <p style={F} className="text-[9px] text-[#001161]/30">{folderImages.length} obrázků</p>
                    </div>
                    {selectedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#7C3AED]/15 text-[#7C3AED] text-[9px] font-bold shrink-0">{selectedCount}</span>
                    )}
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* KOLÁŽE: settings panel */}
          {tab === 'collage' && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <canvas ref={canvasRef} className="hidden" />
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
                <Wand2 className="w-4 h-4 text-[#7C3AED]" />
                <span style={F} className="text-[12px] font-bold text-[#001161]">Nastavení koláže</span>
              </div>
              <div className="px-4 py-4 space-y-5">
                {/* Style */}
                <div>
                  <label style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">Styl</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([{ id: 'scattered', label: 'Rozsypaný', emoji: '🎴' }, { id: 'fan', label: 'Vějíř', emoji: '🃏' }, { id: 'grid', label: 'Mřížka', emoji: '⊞' }] as const).map(s => (
                      <button key={s.id} onClick={() => { setCollageStyle(s.id); setCollagePreview(null); }}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold cursor-pointer transition-all border ${collageStyle === s.id ? 'bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/25' : 'bg-gray-50 text-[#001161]/40 border-gray-100 hover:bg-gray-100'}`} style={F}>
                        <span className="text-[16px]">{s.emoji}</span>{s.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Cols */}
                <div>
                  <label style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">Sloupce</label>
                  <div className="flex gap-1.5">
                    {[2,3,4,5].map(n => (
                      <button key={n} onClick={() => { setCollageCols(n); setCollagePreview(null); }}
                        className={`flex-1 py-2 rounded-lg text-[13px] font-bold cursor-pointer transition-all ${collageCols === n ? 'bg-[#7C3AED] text-white' : 'bg-gray-100 text-[#001161]/40 hover:bg-gray-200'}`} style={F}>{n}</button>
                    ))}
                  </div>
                </div>
                {/* Padding */}
                <div>
                  <label style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">Mezera: {collagePadding}px</label>
                  <input type="range" min={0} max={40} step={4} value={collagePadding}
                    onChange={e => { setCollagePadding(+e.target.value); setCollagePreview(null); }}
                    className="w-full accent-[#7C3AED]" />
                </div>
                {/* Rounding */}
                <div>
                  <label style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">Zaoblení: {collageRounded}px</label>
                  <input type="range" min={0} max={32} step={4} value={collageRounded}
                    onChange={e => { setCollageRounded(+e.target.value); setCollagePreview(null); }}
                    className="w-full accent-[#7C3AED]" />
                </div>
                {/* Book size */}
                <div>
                  <label style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">
                    Velikost prvků: {collageBookScale}%
                  </label>
                  <input type="range" min={40} max={200} step={10} value={collageBookScale}
                    onChange={e => { setCollageBookScale(+e.target.value); setCollagePreview(null); }}
                    className="w-full accent-[#7C3AED]" />
                  <div className="flex justify-between mt-0.5">
                    <span style={F} className="text-[8px] text-[#001161]/25">40%</span>
                    <button style={F} className="text-[8px] text-[#7C3AED]/60 hover:text-[#7C3AED] cursor-pointer"
                      onClick={() => { setCollageBookScale(100); setCollagePreview(null); }}>Reset 100%</button>
                    <span style={F} className="text-[8px] text-[#001161]/25">200%</span>
                  </div>
                </div>
                {/* Background */}
                <div>
                  <label style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">Pozadí</label>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {['#F8F7FF','#FFFFFF','#001161','#FFF7ED','#ECFDF5','#FEF2F2'].map(c => (
                      <button key={c} onClick={() => { setCollageBg(c); setCollagePreview(null); }}
                        className={`w-7 h-7 rounded-lg border-2 cursor-pointer transition-all ${collageBg === c ? 'border-[#7C3AED] scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                    <input type="color" value={collageBg} onChange={e => { setCollageBg(e.target.value); setCollagePreview(null); }}
                      className="w-7 h-7 rounded-lg cursor-pointer border-2 border-gray-200" />
                  </div>
                </div>
                {/* Phone overlay toggle */}
                <div>
                  <label style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider block mb-1.5">Overlay prvky</label>
                  <button
                    onClick={() => { setCollagePhoneOverlay(v => !v); setCollagePreview(null); }}
                    className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${collagePhoneOverlay ? 'border-[#19C795] bg-[#19C795]/8 text-[#0f766e]' : 'border-gray-100 bg-gray-50 text-[#001161]/35 hover:border-[#19C795]/30'}`}
                    style={F}>
                    <PhoneSvg className="w-5 h-8 shrink-0" />
                    <div className="text-left">
                      <p className="text-[11px] font-bold">Telefon overlay</p>
                      <p className="text-[9px] opacity-60">SVG frame přes koláž</p>
                    </div>
                    {collagePhoneOverlay && <Check className="w-3.5 h-3.5 ml-auto text-[#0f766e]" />}
                  </button>
                </div>
                {/* Generate */}
                <button onClick={generateCollage} disabled={collageSelection.length < 2 || collageGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white text-[13px] font-bold hover:opacity-90 disabled:opacity-30 cursor-pointer transition-all shadow-md" style={F}>
                  {collageGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generuji...</> : <><Wand2 className="w-4 h-4" /> Vytvořit koláž</>}
                </button>
              </div>
            </div>
          )}

          {/* AI IMAGE: settings panel — new style system */}
          {tab === 'ai-image' && (() => {
            const previewPrompt = aiStyleReady ? buildAiPromptForApi() : '';
            return (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                  <span style={F} className="text-[12px] font-bold text-[#001161]">AI Nastavení</span>
                </div>
                <button onClick={() => setAiHistoryOpen(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer transition-all border border-gray-200 bg-white text-[#001161]/40 hover:border-[#7C3AED]/30 hover:text-[#7C3AED] relative" style={F}>
                  <Image className="w-2.5 h-2.5" /> Historie
                  {aiHistory.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#7C3AED] text-white text-[7px] font-bold flex items-center justify-center">
                      {aiHistory.length > 9 ? '9+' : aiHistory.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="px-4 py-4 space-y-5 flex-1 overflow-y-auto">

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider">
                      Styl (povinný)
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/marketing/image-agent/referencni-styly')}
                      className="text-[9px] font-bold text-[#7C3AED] hover:underline shrink-0 cursor-pointer"
                      style={F}
                    >
                      Upravit…
                    </button>
                  </div>
                  <select
                    value={selectedRefStyleId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedRefStyleId(id);
                      const next = referenceStyles.find((s) => s.id === id);
                      setAiGenSceneColor(next?.defaultSceneColor?.trim() || '');
                    }}
                    className="w-full text-[12px] font-medium text-[#001161] border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 cursor-pointer"
                    style={F}
                  >
                    <option value="">— Vyberte styl —</option>
                    {referenceStyles.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.aiTemplate === 'studio_kids' ? ' · děti ve studiu' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedRefStyleId && !aiStyleReady && (
                    <p style={F} className="text-[10px] text-amber-600 mt-1.5 leading-snug">
                      U tohoto stylu doplň v nastavení <strong>prompt</strong> nebo aspoň jeden <strong>referenční obrázek</strong> — bez toho nelze generovat.
                    </p>
                  )}
                  {selectedRefStyleId && selectedRefStyle && selectedRefStyle.aiTemplate !== 'studio_kids' && (
                    <p style={F} className="text-[10px] text-[#001161]/35 mt-1.5 leading-snug">
                      Pro panel „děti ve studiu“ nastav u tohoto stylu šablonu <strong className="text-[#001161]/50">Děti ve studiu</strong> v{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/marketing/image-agent/referencni-styly')}
                        className="text-[#7C3AED] font-bold hover:underline cursor-pointer"
                        style={F}
                      >
                        Referenční styly
                      </button>
                      .
                    </p>
                  )}
                </div>

                {studioKidsTemplateActive && selectedRefStyleId ? (
                  <StudioKidsStylePanel
                    value={studioKidsOptions}
                    onChange={(next) => {
                      setStudioKidsByStyleId((prev) => ({ ...prev, [selectedRefStyleId]: next }));
                    }}
                    onCopyReferencePrompt={() => {
                      void navigator.clipboard.writeText(STUDIO_KIDS_REFERENCE_STYLE_PROMPT);
                      toast.success('Výchozí prompt zkopírován do schránky.');
                    }}
                  />
                ) : null}

                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 space-y-3">
                  <p style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider">
                    Generování
                  </p>
                  <div>
                    <label style={F} className="text-[10px] font-bold text-[#001161]/50 block mb-1">
                      Barva scény
                    </label>
                    <p style={F} className="text-[9px] text-[#001161]/35 mb-1.5 leading-snug">
                      Jednotná barva prostředí (monochromatické scény). Vyplň ručně nebo se načte z referenčního stylu.
                      {studioKidsTemplateActive && (
                        <span className="block mt-1 text-violet-700/90 font-bold">
                          U šablony „děti ve studiu“ jde o barvu pozadí, podlahy a případně stolu (jeden tón).
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2 items-stretch">
                      <input
                        type="text"
                        value={aiGenSceneColor}
                        onChange={(e) => setAiGenSceneColor(e.target.value)}
                        className="flex-1 min-w-0 text-[12px] text-[#001161] border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                        placeholder="např. sytá žlutá, matná mint, #F9E000"
                        style={F}
                      />
                      <input
                        type="color"
                        aria-label="Barva scény (hex)"
                        title="Vloží hex"
                        value={
                          /^#[0-9A-Fa-f]{6}$/.test(aiGenSceneColor.trim())
                            ? aiGenSceneColor.trim()
                            : '#7C3AED'
                        }
                        onChange={(e) => setAiGenSceneColor(e.target.value)}
                        className="w-11 h-9 rounded-lg border border-gray-200 cursor-pointer shrink-0 p-0.5 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label style={F} className="text-[10px] font-bold text-[#001161]/50 block mb-1">
                      Dodatečný prompt
                    </label>
                    <textarea
                      value={aiGenExtraPrompt}
                      onChange={(e) => setAiGenExtraPrompt(e.target.value)}
                      rows={3}
                      className="w-full text-[12px] text-[#001161] border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 resize-y"
                      placeholder="Úpravy jen pro tuto generaci (úhel, detaily, co vynechat…)"
                      style={F}
                    />
                  </div>
                </div>

                {/* ── Formát (poměr stran) ── */}
                <div>
                  <p style={F} className="text-[9px] font-bold text-[#001161]/35 uppercase tracking-wider mb-2">Formát</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {AI_FORMAT_OPTS.map(fmt => {
                      const active = aiFormat === fmt.id;
                      const scaleW = Math.round(40 * Math.min(fmt.w / fmt.h, 1));
                      const scaleH = Math.round(40 * Math.min(fmt.h / fmt.w, 1));
                      return (
                        <button key={fmt.id} onClick={() => setAiFormat(fmt.id)}
                          className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 cursor-pointer transition-all ${active ? 'border-[#7C3AED] bg-[#7C3AED]/8' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                          style={F}>
                          <div className="flex items-center justify-center w-10 h-10">
                            <div
                              className={`rounded-sm ${active ? 'bg-[#7C3AED]' : 'bg-gray-300'} transition-all`}
                              style={{ width: scaleW, height: scaleH }}
                            />
                          </div>
                          <p className={`text-[9px] font-bold leading-tight text-center ${active ? 'text-[#7C3AED]' : 'text-[#001161]/35'}`}>{fmt.label}</p>
                          <p className={`text-[8px] font-medium ${active ? 'text-[#7C3AED]/70' : 'text-[#001161]/20'}`}>{fmt.id}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Prompt preview ── */}
                <details className="group">
                  <summary style={F} className="text-[9px] font-bold text-[#001161]/25 uppercase tracking-wider cursor-pointer select-none hover:text-[#001161]/40 transition-all list-none flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" /> Náhled promptu
                  </summary>
                  <div className="mt-2 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                    <p style={F} className="text-[9px] text-[#001161]/40 leading-relaxed">
                      {previewPrompt || 'Vyberte platný referenční styl (prompt nebo obrázky v nastavení).'}
                    </p>
                  </div>
                </details>

                {/* ── Generate: Lite (Flash) + Pro ── */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void generateAIImage({ imageModel: 'flash' })}
                    disabled={aiGenerating || !aiStyleReady}
                    title="Gemini 3.1 Flash Image — rychleji"
                    className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-white text-[11px] sm:text-[12px] font-bold hover:opacity-90 disabled:opacity-30 cursor-pointer transition-all shadow-md min-h-[3rem]"
                    style={{ background: `linear-gradient(135deg, ${AI_GENERATE_GRAD[0]}, ${AI_GENERATE_GRAD[1]})`, ...F }}
                  >
                    {aiGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> <span className="truncate">{aiStatusMsg || 'Generuji…'}</span></>
                    ) : (
                      <><Sparkles className="w-4 h-4 shrink-0" /> Generovat (lite)</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateAIImage({ imageModel: 'pro' })}
                    disabled={aiGenerating || !aiStyleReady}
                    title="Gemini 3 Pro Image — vyšší kvalita, déle"
                    className="flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#5B21B6] text-[11px] sm:text-[12px] font-bold hover:bg-[#7C3AED]/15 disabled:opacity-30 cursor-pointer transition-all shadow-sm min-h-[3rem]"
                    style={F}
                  >
                    {aiGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#5B21B6]" /> <span className="truncate">{aiStatusMsg || 'Generuji…'}</span></>
                    ) : (
                      <><Sparkles className="w-4 h-4 shrink-0" /> Generovat Pro</>
                    )}
                  </button>
                </div>

              </div>
            </div>
            );
          })()}
        </div>

        {/* ══════════════════════════════════════
            COL 3 — 700px, AI IMAGE preview
        ══════════════════════════════════════ */}
        {tab === 'ai-image' && (
          <div className="w-[700px] min-w-[700px] bg-[#f7f8fc] flex flex-col overflow-hidden relative">
            {/* Header */}
            <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0 flex-wrap">
              <Sparkles className="w-4 h-4 text-[#7C3AED]" />
              <span style={F} className="text-[13px] font-bold text-[#001161]">Výsledek — Gemini AI</span>
              {aiPreviewUrl && aiPreviewChain.versions.length > 1 && (
                <div
                  className="flex items-center gap-0.5 rounded-[999px] border border-gray-200 bg-gray-50/90 px-1 py-0.5"
                  title="Verze po přegenerování"
                >
                  <button
                    type="button"
                    onClick={goAiVersionPrev}
                    disabled={aiPreviewEffectiveIndex <= 0 || aiGenerating}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#001161]/50 hover:bg-white hover:text-[#7C3AED] disabled:opacity-25 disabled:pointer-events-none cursor-pointer transition-all"
                    aria-label="Předchozí verze"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span style={F} className="text-[10px] font-bold text-[#001161]/45 tabular-nums min-w-[3rem] text-center px-1">
                    {aiPreviewEffectiveIndex + 1} / {aiPreviewChain.versions.length}
                  </span>
                  <button
                    type="button"
                    onClick={goAiVersionNext}
                    disabled={aiPreviewEffectiveIndex >= aiPreviewChain.versions.length - 1 || aiGenerating}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#001161]/50 hover:bg-white hover:text-[#7C3AED] disabled:opacity-25 disabled:pointer-events-none cursor-pointer transition-all"
                    aria-label="Novější verze"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {aiPreviewUrl && (
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => void saveAiOutputToGallery()} disabled={aiGenerating || aiSavingToGallery}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100 disabled:opacity-40 cursor-pointer transition-all" style={F}>
                    {aiSavingToGallery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />} Do galerie
                  </button>
                  <button
                    type="button"
                    onClick={() => generateAIImage({ regenerate: true, imageModel: 'flash' })}
                    disabled={aiGenerating || !aiStyleReady}
                    title="Rychlejší model (Flash)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] border border-gray-200 bg-white text-[#001161]/60 text-[11px] font-bold hover:bg-gray-50 disabled:opacity-40 cursor-pointer transition-all"
                    style={F}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Přegenerovat
                  </button>
                  <button
                    type="button"
                    onClick={() => generateAIImage({ regenerate: true, imageModel: 'pro' })}
                    disabled={aiGenerating || !aiStyleReady}
                    title="Gemini 3 Pro Image — vyšší kvalita, obvykle pomalejší"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] border border-[#7C3AED]/35 bg-[#7C3AED]/8 text-[#5B21B6] text-[11px] font-bold hover:bg-[#7C3AED]/12 disabled:opacity-40 cursor-pointer transition-all"
                    style={F}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Pro
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(aiPreviewUrl!); toast.success('URL zkopírována!'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] border border-gray-200 bg-white text-[#001161]/60 text-[11px] font-bold hover:bg-gray-50 cursor-pointer transition-all" style={F}>
                    <Copy className="w-3.5 h-3.5" /> URL
                  </button>
                  <a href={aiPreviewUrl} download={`ai-${Date.now()}.jpg`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] cursor-pointer transition-all shadow-sm" style={F}>
                    <Download className="w-3.5 h-3.5" /> Stáhnout
                  </a>
                </div>
              )}
            </div>

            {/* Preview area */}
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
              {aiGenerating && !aiPreviewUrl ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative w-28 h-28">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#7C3AED]/20 to-[#FF6B1A]/20 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-[#7C3AED] animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <p style={F} className="text-[18px] font-extrabold text-[#001161]/50 mb-1">Gemini generuje…</p>
                    <p style={F} className="text-[13px] text-[#001161]/30">{aiStatusMsg}</p>
                    <p style={F} className="text-[11px] text-[#001161]/20 mt-1">Obvykle 15–40 vteřin</p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {collageSelection.slice(0, 6).map((s, i) => (
                      <img key={s.url} src={s.url} alt="" className="w-12 h-16 rounded-xl object-cover shadow-md animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              ) : aiPreviewUrl ? (
                <div className="w-full flex flex-col items-center gap-4 max-w-full px-2">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden p-4 w-full relative">
                    {aiPreviewChain.versions.length > 1 && (
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <button
                          type="button"
                          onClick={goAiVersionPrev}
                          disabled={aiPreviewEffectiveIndex <= 0 || aiGenerating}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-[#001161]/60 hover:border-[#7C3AED]/30 hover:text-[#7C3AED] disabled:opacity-30 cursor-pointer transition-all"
                          style={F}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Starší
                        </button>
                        <span style={F} className="text-[11px] font-bold text-[#001161]/35 tabular-nums">
                          Verze {aiPreviewEffectiveIndex + 1} z {aiPreviewChain.versions.length}
                        </span>
                        <button
                          type="button"
                          onClick={goAiVersionNext}
                          disabled={aiPreviewEffectiveIndex >= aiPreviewChain.versions.length - 1 || aiGenerating}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-[#001161]/60 hover:border-[#7C3AED]/30 hover:text-[#7C3AED] disabled:opacity-30 cursor-pointer transition-all"
                          style={F}
                        >
                          Novější <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <img src={aiPreviewUrl} alt="AI obrázek" className={`max-w-full max-h-[55vh] object-contain mx-auto rounded-xl ${aiGenerating ? 'opacity-40' : ''}`} />
                    {aiGenerating && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/60 backdrop-blur-[2px] p-4">
                        <Sparkles className="w-10 h-10 text-[#7C3AED] animate-spin" style={{ animationDuration: '3s' }} />
                        <p style={F} className="text-[14px] font-extrabold text-[#001161]/70 text-center">Upravuji podle feedbacku…</p>
                        <p style={F} className="text-[12px] text-[#001161]/45 text-center">{aiStatusMsg}</p>
                      </div>
                    )}
                  </div>
                  <div className="w-full max-w-[520px] space-y-2">
                    <label style={F} className="block text-[11px] font-bold text-[#001161]/55">
                      Zpětná vazba pro přegenerování
                    </label>
                    <textarea
                      value={aiRegenerateFeedback}
                      onChange={(e) => setAiRegenerateFeedback(e.target.value)}
                      rows={3}
                      placeholder="Např. víc close-up na lavici a sešity, méně bílé tabule v záběru, posuň sešity víc doprostřed… (můžeš psát česky i anglicky)"
                      disabled={aiGenerating}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-[#001161] placeholder:text-[#001161]/30 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25 focus:border-[#7C3AED]/40 resize-y min-h-[72px] disabled:opacity-50"
                      style={F}
                    />
                    <p style={F} className="text-[10px] text-[#001161]/35 leading-snug">
                      Přegenerovat použije jako výchozí <strong>aktuálně zobrazenou verzi</strong> (můžeš se „Starší / Novější“ vrátit k dřívějšímu výstupu a z něj znovu přegenerovat). Prázdné pole feedbacku = obecné vylepšení kompozice. Tlačítko <strong className="text-[#5B21B6]">Pro</strong> volá Gemini 3 Pro Image (kvalita, často delší čekání).
                    </p>
                  </div>

                  <div className="w-full max-w-[520px] space-y-2 pt-3 border-t border-gray-200/80">
                    <label style={F} className="block text-[11px] font-bold text-[#001161]/55">
                      Uložit do složky v galerii
                    </label>
                    <select
                      value={aiSaveToFolder}
                      onChange={(e) => setAiSaveToFolder(e.target.value)}
                      disabled={aiGenerating || aiSavingToGallery}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] text-[#001161] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25 disabled:opacity-50 cursor-pointer"
                      style={F}
                    >
                      {GALLERY_FOLDER_PRESETS.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={aiSaveToFolderCustom}
                      onChange={(e) => setAiSaveToFolderCustom(e.target.value)}
                      disabled={aiGenerating || aiSavingToGallery}
                      placeholder="Vlastní složka (nepovinné — přepíše výběr výše)"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] text-[#001161] placeholder:text-[#001161]/30 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25 disabled:opacity-50"
                      style={F}
                    />
                    <button
                      type="button"
                      onClick={() => void saveAiOutputToGallery()}
                      disabled={aiGenerating || aiSavingToGallery}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-[12px] font-bold hover:bg-emerald-100 disabled:opacity-40 cursor-pointer transition-all"
                      style={F}
                    >
                      {aiSavingToGallery ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                      Uložit kopii do galerie
                    </button>
                    <p style={F} className="text-[10px] text-[#001161]/35 leading-snug">
                      Nahraje se nový soubor do úložiště a v levém panelu Galerie se zobrazí ve zvolené složce (ostatní nahrané soubory bez přiřazení zůstávají v „Nahrané soubory“).
                    </p>
                  </div>

                  <p style={F} className="text-[10px] text-[#001161]/25">Horní lišta: stažení, kopírování URL nebo rychlé uložení do galerie</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5 text-center max-w-[400px]">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#7C3AED]/10 to-[#FF6B1A]/10 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-[#7C3AED]/20" />
                  </div>
                  <div>
                    <p style={F} className="text-[18px] font-extrabold text-[#001161]/25 mb-2">AI Image Generator</p>
                    <p style={F} className="text-[13px] text-[#001161]/20 leading-relaxed">
                      Vyberte podklady v Col 1, zvolte scénu nebo napište vlastní prompt, pak klikněte <strong>Generovat</strong>.
                    </p>
                  </div>
                  <button onClick={() => setTab('browse')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[999px] bg-[#7C3AED]/10 text-[#7C3AED] text-[13px] font-bold cursor-pointer hover:bg-[#7C3AED]/20 transition-all"
                    style={F}>
                    <Grid3X3 className="w-4 h-4" /> Přejít do Galerie
                  </button>
                </div>
              )}
            </div>

            {/* History drawer backdrop */}
            {aiHistoryOpen && <div className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]" onClick={() => setAiHistoryOpen(false)} />}
            {/* History drawer */}
            <div className="absolute top-0 right-0 bottom-0 z-30 w-[380px] bg-white shadow-2xl flex flex-col"
              style={{ transform: aiHistoryOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
                  <span style={F} className="text-[13px] font-extrabold text-[#001161]">Historie</span>
                  {aiHistory.length > 0 && <span style={F} className="px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] font-bold">{aiHistory.length}</span>}
                  <div className="ml-auto flex items-center gap-3">
                    {aiHistory.length > 0 && <button onClick={() => { if (confirm('Smazat celou historii?')) { setAiHistory([]); try { localStorage.removeItem('vb:ai-image-history'); } catch {} } }} className="text-[10px] text-red-400 hover:text-red-600 cursor-pointer" style={F}>Smazat vše</button>}
                    <button onClick={() => setAiHistoryOpen(false)} className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer transition-all"><X className="w-3.5 h-3.5 text-[#001161]/50" /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {aiHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-12"><Image className="w-7 h-7 text-[#001161]/10" /><p style={F} className="text-[12px] text-[#001161]/25 text-center">Vygenerované fotky se zobrazí zde</p></div>
                  ) : aiHistory.map(entry => (
                    <div key={entry.id}
                      className={`group relative rounded-2xl border overflow-hidden transition-all hover:shadow-md cursor-pointer ${aiPreviewUrl === entry.url ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-gray-100 hover:border-gray-200'}`}
                      onClick={() => { setAiPreviewChain({ versions: [entry.url], index: 0 }); setAiHistoryOpen(false); }}>
                      <div className="relative">
                        <img src={entry.url} alt="" className="w-full h-[140px] object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <button onClick={(e) => { e.stopPropagation(); setAiPreviewChain({ versions: [entry.url], index: 0 }); setAiHistoryOpen(false); }} className="p-2 rounded-full bg-white/90 shadow hover:bg-white cursor-pointer"><ZoomIn className="w-4 h-4 text-[#001161]" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setAiPrompt(entry.prompt); setAiHistoryOpen(false); toast.success('Prompt načten'); }} className="p-2 rounded-full bg-white/90 shadow hover:bg-white cursor-pointer"><RefreshCw className="w-4 h-4 text-[#7C3AED]" /></button>
                          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entry.url); toast.success('URL zkopírována!'); }} className="p-2 rounded-full bg-white/90 shadow hover:bg-white cursor-pointer"><Copy className="w-4 h-4 text-[#001161]" /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteFromHistory(entry.id); removeUrlFromAiPreviewChain(entry.url); }} className="p-2 rounded-full bg-white/90 shadow hover:bg-red-50 cursor-pointer"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm"><span style={F} className="text-[9px] text-white/80">{new Date(entry.timestamp).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm"><Image className="w-2.5 h-2.5 text-white/70" /><span style={F} className="text-[9px] text-white/80">{entry.sourceCount}</span></div>
                      </div>
                      <div className="px-3 py-2.5 bg-white">
                        <p style={F} className="text-[10px] text-[#001161]/50 line-clamp-2 leading-relaxed">{entry.prompt.length > 100 ? entry.prompt.slice(0,100) + '…' : entry.prompt}</p>
                        {entry.sourceUrls.length > 0 && (
                          <div className="flex gap-1 mt-2 items-center">
                            {entry.sourceUrls.slice(0,5).map((u,i) => <img key={i} src={u} alt="" className="w-6 h-8 rounded-md object-cover border border-gray-100" />)}
                            {entry.sourceUrls.length > 5 && <span style={F} className="text-[9px] text-[#001161]/30 ml-1">+{entry.sourceUrls.length-5}</span>}
                            <button onClick={(e) => { e.stopPropagation(); setAiPrompt(entry.prompt); setAiHistoryOpen(false); toast.success('Prompt načten'); }} className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7C3AED]/8 text-[#7C3AED] text-[9px] font-bold cursor-pointer hover:bg-[#7C3AED]/15 transition-all" style={F}><RefreshCw className="w-2.5 h-2.5" /> Prompt</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        {/* ══════════════════════════════════════
            COLLAGE: 700px preview column
        ══════════════════════════════════════ */}
        {tab === 'collage' && (
          <div className="w-[700px] min-w-[700px] bg-[#f7f8fc] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
              <Layers className="w-4 h-4 text-[#7C3AED]" />
              <span style={F} className="text-[13px] font-bold text-[#001161]">Náhled koláže</span>
              {collagePreview && (
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={uploadCollage} disabled={collageUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] disabled:opacity-40 cursor-pointer transition-all shadow-sm" style={F}>
                    {collageUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Nahrávám...</> : <><Upload className="w-3.5 h-3.5" /> Nahrát do Storage</>}
                  </button>
                  <button onClick={() => { const a = document.createElement('a'); a.href = collagePreview!; a.download = `collage-${Date.now()}.png`; a.click(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] border border-gray-200 bg-white text-[#001161]/60 text-[11px] font-bold hover:bg-gray-50 cursor-pointer transition-all" style={F}>
                    <Download className="w-3.5 h-3.5" /> PNG
                  </button>
                  <button onClick={generateCollage} disabled={collageGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] border border-gray-200 bg-white text-[#001161]/60 text-[11px] font-bold hover:bg-gray-50 disabled:opacity-40 cursor-pointer transition-all" style={F}>
                    <RefreshCw className="w-3.5 h-3.5" /> Znovu
                  </button>
                </div>
              )}
            </div>
            {/* Preview area */}
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
              {collageGenerating ? (
                <div className="flex flex-col items-center gap-5">
                  <div className="relative w-24 h-24">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#7C3AED]/15 to-[#FF6B1A]/15 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Wand2 className="w-10 h-10 text-[#7C3AED]/40 animate-spin" style={{ animationDuration: '2s' }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <p style={F} className="text-[16px] font-extrabold text-[#001161]/40">Generuji koláž…</p>
                    <p style={F} className="text-[12px] text-[#001161]/25 mt-1">Zpracovávám {collageSelection.length} obrázků</p>
                  </div>
                </div>
              ) : collagePreview ? (
                <div className="w-full flex flex-col items-center gap-4">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden p-4 w-full">
                    <img src={collagePreview} alt="Koláž" className="max-w-full max-h-[70vh] object-contain mx-auto rounded-xl" />
                  </div>
                  <p style={F} className="text-[10px] text-[#001161]/25">Klikněte na tlačítka v horní liště pro stažení nebo nahrání</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5 text-center max-w-[380px]">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#7C3AED]/10 to-[#FF6B1A]/10 flex items-center justify-center">
                    <Layers className="w-10 h-10 text-[#7C3AED]/20" />
                  </div>
                  <div>
                    <p style={F} className="text-[18px] font-extrabold text-[#001161]/25 mb-2">Tvůrce koláží</p>
                    <p style={F} className="text-[13px] text-[#001161]/20 leading-relaxed">
                      Vyberte obrázky v záložce Galerie, nastavte styl a počet sloupců, pak klikněte <strong>Vytvořit koláž</strong>.
                    </p>
                  </div>
                  <button onClick={() => setTab('browse')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[999px] bg-[#7C3AED]/10 text-[#7C3AED] text-[13px] font-bold cursor-pointer hover:bg-[#7C3AED]/20 transition-all"
                    style={F}>
                    <Grid3X3 className="w-4 h-4" /> Přejít do Galerie
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'browse' && (
          <div className="flex-1 flex flex-col overflow-hidden min-w-[400px]">
            {/* Header */}
            <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
              {selectedFolder ? (() => {
                const fc = FOLDER_COLORS[selectedFolder] || defaultFolderColor;
                const fi = folders.find(([k]) => k === selectedFolder)?.[1] || [];
                const allSel = isFolderFullySelected(fi);
                const someSel = fi.some(img => isInCollage(img.url));
                return (<>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: fc.bg, border: `1.5px solid ${fc.border}` }}>
                    <FolderOpen className="w-4 h-4" style={{ color: fc.color }} />
                  </div>
                  <h3 style={F} className="text-[14px] font-extrabold text-[#001161]">{selectedFolder}</h3>
                  <span style={F} className="text-[11px] text-[#001161]/30">{fi.length} obrázků</span>
                  <button onClick={() => allSel ? deselectAllFromFolder(fi) : selectAllFromFolder(fi)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${allSel ? 'bg-[#7C3AED] text-white' : someSel ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'bg-gray-100 text-[#001161]/40 hover:bg-[#7C3AED]/5 hover:text-[#7C3AED]'}`} style={F}>
                    <CheckSquare className="w-3 h-3" />{allSel ? 'Odebrat vše' : 'Vybrat vše'}
                  </button>
                </>);
              })() : (<>
                <Grid3X3 className="w-4 h-4 text-[#001161]/25" />
                <h3 style={F} className="text-[14px] font-extrabold text-[#001161]">Všechny obrázky</h3>
                <span style={F} className="text-[11px] text-[#001161]/30">{filtered.length} obrázků</span>
              </>)}

              {/* Upload button */}
              <div className="ml-auto flex items-center gap-2">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleUpload(e.target.files)}
                />
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] bg-[#7C3AED] text-white text-[11px] font-bold cursor-pointer hover:bg-[#6D28D9] disabled:opacity-50 transition-all shadow-sm"
                  style={F}
                >
                  {uploading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Nahrávám…</>
                    : <><Upload className="w-3.5 h-3.5" /> Nahrát obrázek</>
                  }
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center py-20 gap-2">
                  <Loader2 className="w-5 h-5 text-[#7C3AED] animate-spin" />
                  <span style={F} className="text-[13px] text-[#001161]/40">Načítám obrázky...</span>
                </div>
              ) : (() => {
                const di = selectedFolder ? (folders.find(([k]) => k === selectedFolder)?.[1] || []) : filtered;
                if (!di.length) return (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Image className="w-10 h-10 text-[#001161]/10" />
                    <p style={F} className="text-[13px] text-[#001161]/30">Žádné obrázky nenalezeny</p>
                    <button onClick={() => uploadInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-[999px] bg-[#7C3AED]/10 text-[#7C3AED] text-[12px] font-bold cursor-pointer hover:bg-[#7C3AED]/20 transition-all"
                      style={F}>
                      <Upload className="w-3.5 h-3.5" /> Nahrát první obrázek
                    </button>
                  </div>
                );
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                    {di.map((img, idx) => (
                      <ImageCard
                        key={`${img.url}-${idx}`}
                        img={img}
                        meta={SOURCE_META[img.source]}
                        tags={imageTags[img.url] || []}
                        selected={isInCollage(img.url)}
                        onLightbox={() => setLightbox(img.url)}
                        onToggle={() => toggleCollageItem(img)}
                        onEditTags={() => setEditingTagsFor(img)}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>



      {/* ══ Lightbox ══ */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer transition-all"><X className="w-5 h-5" /></button>
          <img src={lightbox} alt="Náhled" className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
        </div>
      )}

      {/* ══ Tag Editor Modal ══ */}
      {editingTagsFor && (
        <TagEditorModal
          img={editingTagsFor}
          currentTags={imageTags[editingTagsFor.url] || []}
          allTags={allUniqueTags}
          onSave={async (tags) => {
            await saveTagsForImage(editingTagsFor.url, tags);
            setEditingTagsFor(null);
            toast.success('Tagy uloženy');
          }}
          onClose={() => setEditingTagsFor(null)}
        />
      )}

    </div>
  );
}

/* ── Tag Editor Modal ── */
function TagEditorModal({ img, currentTags, allTags, onSave, onClose }: {
  img: ImageItem;
  currentTags: string[];
  allTags: string[];
  onSave: (tags: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [tags, setTags] = useState<string[]>(currentTags);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (clean && !tags.includes(clean)) setTags(prev => [...prev, clean]);
    setInput('');
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (input.trim()) addTag(input); }
    if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1]);
  };

  const suggestions = allTags.filter(t => !tags.includes(t) && t.includes(input.toLowerCase().trim()));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
            <Tags className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={F} className="text-[14px] font-extrabold text-[#001161] truncate">Tagy obrázku</p>
            <p style={F} className="text-[10px] text-[#001161]/40 truncate">{img.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer transition-all shrink-0"><X className="w-3.5 h-3.5 text-[#001161]/50" /></button>
        </div>

        {/* Preview + editor */}
        <div className="flex gap-4 p-5">
          {/* Thumbnail */}
          <img src={img.url} alt={img.title} className="w-20 h-28 rounded-xl object-cover shrink-0 shadow-sm border border-gray-100" />

          {/* Tag input */}
          <div className="flex-1 min-w-0">
            <p style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider mb-2">Přidat tagy</p>
            {/* Tag chips + input */}
            <div
              className="min-h-[44px] w-full px-2.5 py-2 bg-[#f7f8fc] border border-gray-200 rounded-xl flex flex-wrap gap-1.5 items-center cursor-text focus-within:border-[#7C3AED]/40 transition-colors"
              onClick={() => inputRef.current?.focus()}
            >
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] font-bold" style={F}>
                  # {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500 cursor-pointer transition-colors"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tags.length === 0 ? 'Zadejte tag a stiskněte Enter…' : 'Přidat…'}
                className="flex-1 min-w-[80px] bg-transparent text-[11px] text-[#001161] placeholder-[#001161]/25 focus:outline-none"
                style={F}
              />
            </div>
            <p style={F} className="text-[9px] text-[#001161]/30 mt-1">Enter nebo čárka = přidat tag, Backspace = smazat poslední</p>

            {/* Suggestions */}
            {suggestions.length > 0 && input && (
              <div className="mt-2">
                <p style={F} className="text-[9px] text-[#001161]/30 uppercase tracking-wider mb-1">Návrhy</p>
                <div className="flex gap-1 flex-wrap">
                  {suggestions.slice(0, 8).map(s => (
                    <button key={s} onClick={() => addTag(s)}
                      className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-[#001161]/50 text-[9px] font-bold cursor-pointer hover:border-[#7C3AED]/30 hover:text-[#7C3AED] hover:bg-[#7C3AED]/5 transition-all"
                      style={F}>+ {s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Existing tags (quick add) */}
            {allTags.filter(t => !tags.includes(t)).length > 0 && !input && (
              <div className="mt-3">
                <p style={F} className="text-[9px] text-[#001161]/30 uppercase tracking-wider mb-1.5">Existující tagy</p>
                <div className="flex gap-1 flex-wrap max-h-[80px] overflow-y-auto">
                  {allTags.filter(t => !tags.includes(t)).map(t => (
                    <button key={t} onClick={() => addTag(t)}
                      className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-[#001161]/40 text-[9px] font-bold cursor-pointer hover:border-[#7C3AED]/30 hover:text-[#7C3AED] hover:bg-[#7C3AED]/5 transition-all"
                      style={F}>+ {t}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[#001161]/50 text-[12px] font-bold cursor-pointer hover:bg-gray-50 transition-all" style={F}>Zrušit</button>
          <button
            onClick={async () => { setSaving(true); await onSave(tags); setSaving(false); }}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[12px] font-bold cursor-pointer hover:bg-[#6D28D9] disabled:opacity-50 transition-all shadow-sm"
            style={F}
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Ukládám…</> : <><Check className="w-3.5 h-3.5" /> Uložit tagy ({tags.length})</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ImageCard ── */
function ImageCard({ img, meta, tags, selected, onLightbox, onToggle, onEditTags }: {
  img: ImageItem; meta: { label: string; icon: any; color: string; bg: string };
  tags: string[]; selected: boolean;
  onLightbox: () => void; onToggle: () => void; onEditTags: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/uri-list', img.url);
        e.dataTransfer.setData('text/plain', img.url);
      }}
      className={`group relative bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg cursor-grab active:cursor-grabbing ${selected ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-gray-100 hover:border-gray-200'}`}>
      <div className="aspect-[3/4] overflow-hidden bg-gray-50" onClick={onLightbox}>
        <img src={img.url} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
      </div>

      {/* Top-right: copy + zoom */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <CopyUrlBtn url={img.url} />
        <button onClick={(e) => { e.stopPropagation(); onLightbox(); }} className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-all cursor-pointer"><ZoomIn className="w-3.5 h-3.5 text-[#001161]/60" /></button>
        <button onClick={(e) => { e.stopPropagation(); onEditTags(); }} className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-all cursor-pointer" title="Upravit tagy"><Tag className="w-3.5 h-3.5 text-[#7C3AED]/70" /></button>
      </div>

      {/* Top-left: select toggle */}
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${selected ? 'bg-[#7C3AED] text-white shadow-lg' : 'bg-white/80 backdrop-blur-sm text-[#001161]/30 opacity-0 group-hover:opacity-100 hover:bg-[#7C3AED]/10 hover:text-[#7C3AED]'}`}>
        {selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
      </button>

      {/* Bottom info */}
      <div className="px-2.5 py-2">
        <p style={F} className="text-[10px] font-bold text-[#001161] truncate">{img.title}</p>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0" style={{ backgroundColor: meta?.bg, color: meta?.color, ...F }}>{meta?.label}</span>
          {img.predmet && <span className="text-[8px] text-[#001161]/30 shrink-0" style={F}>{img.predmet}</span>}
        </div>
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-0.5 flex-wrap mt-1">
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] text-[7px] font-bold" style={F}>#{tag}</span>
            ))}
            {tags.length > 3 && <span className="text-[7px] text-[#001161]/30 font-bold" style={F}>+{tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function CopyUrlBtn({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-all cursor-pointer">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-[#001161]/60" />}
    </button>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
