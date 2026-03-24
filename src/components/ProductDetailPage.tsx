import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, BookOpen, ShoppingCart, Download, ExternalLink, Star, Award, FileText, Calendar, Layers, Hash, User2, BookMarked, CheckCircle2, Maximize2, Repeat2, School, CreditCard, List, Sparkles, Play, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { UnifiedBookCard } from './UnifiedBookCard';
import { SUBJECT_CONFIGS } from './subjectConfigs';
import { SEOHead, productJsonLd, breadcrumbJsonLd } from './SEOHead';
import { useCart } from '../contexts/CartContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { fetchProductStockItem, type ProductStockItem } from '../utils/productStock';
import { subjectToSlug } from '../utils/slugify';
import { DigitalAccessComparison, COMPARISON_SUBJECTS } from './DigitalAccessComparison';
import { FyzikaAccessJourney } from './FyzikaAccessJourney';
import { SubjectTabsSection } from './SubjectTabsSection';
import { ProductComplianceBadge, subjectShowsMsmtDolozkaBadge } from './ProductComplianceBadge';
import { getProductImage, getProductUnitPriceInHaler, isPrintProduct, parseSubject } from './cartUpsellUtils';
import { buildBundleCartLines, type ProductBundleRecord } from '../utils/bundlePricing';
import { mergeSchoolOrderDraft } from '../utils/schoolOrderDraft';
import { useMatchMedia } from '../hooks/useMatchMedia';
import { BookCoverFloorShadow } from './BookCoverFloorShadow';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

/* maps category → tab subject name */
const getTabSubjectName = (category: string): string => {
  const s = (category || '').toLowerCase();
  if (s.includes('matematika') && (s.includes('1') || s.includes('prvn'))) return 'Matematika-1';
  if (s.includes('matematika') && (s.includes('2') || s.includes('druh'))) return 'Matematika-2';
  if (s.includes('matematika')) return 'Matematika-1';
  return (category || '').replace(/\s+\d+\.\s*stupe.*$/i, '').trim();
};

/** Shodná logika jako u přepínačů řad na SubjectPage — jen Matematika 2. stupeň. */
function isMatematika2StupenCategory(category: string | undefined): boolean {
  const c = (category || '').toLowerCase();
  if (!c.includes('matematik')) return false;
  return c.includes('2') || c.includes('druh');
}

/** Stejné ID jako SubjectPage — video „Rozdíl: Pro všechny vs. Krok za krokem“. */
const MATH_SERIES_DIFF_YOUTUBE_ID = '3QfBy-xJ4Os';

const MATH2_COVER_PREVIEW_H = 100;
const MATH2_COVER_PREVIEW_W = 70;

const BUNDLE_FAN_COVER_W = 64;
const BUNDLE_FAN_COVER_H = 92;

/** Rotace obálek ve vějíři podle počtu (společný střed dole — jako srovnání řad matik). */
function bundleFanRotationDeg(index: number, total: number): number {
  if (total <= 1) return 0;
  if (total === 2) return index === 0 ? -12 : 12;
  if (total === 3) return index === 0 ? -14 : index === 1 ? 0 : 14;
  return ([-16, -6, 6, 16] as const)[Math.min(index, 3)] ?? 0;
}

function BundleFanCoverThumb({
  book,
  onClick,
  index,
  total,
  className = '',
}: {
  book: any;
  onClick: () => void;
  index: number;
  total: number;
  className?: string;
}) {
  const src = getProductImage(book);
  const rotation = bundleFanRotationDeg(index, total);
  const zIndex = index + 1;
  const wrapStyle: React.CSSProperties =
    rotation !== 0
      ? {
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'bottom center',
          zIndex,
        }
      : { zIndex };

  return (
    <div className={`shrink-0 ${className}`} style={wrapStyle}>
      <button
        type="button"
        onClick={onClick}
        title={book?.name || 'Zobrazit produkt'}
        className="block rounded-none overflow-hidden bg-white shadow-md border border-[#92400e]/22 hover:border-[#b45309]/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff8e8] transition-colors cursor-pointer p-0"
        style={{ width: BUNDLE_FAN_COVER_W, height: BUNDLE_FAN_COVER_H }}
      >
        {src ? (
          <ImageWithFallback
            src={src}
            alt={book?.name || ''}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[#92400e]/35 text-center px-1 font-['Fenomen_Sans',sans-serif] leading-tight"
            style={{ background: 'linear-gradient(145deg, #fffbeb, #fef3c7)' }}
          >
            Sešit
          </div>
        )}
      </button>
    </div>
  );
}

function isMathWorkbookKrokName(name: string | undefined): boolean {
  return /krok\s+za\s+krokem/i.test(name || '');
}

function isMathWorkbookProVsechnyName(name: string | undefined): boolean {
  return /pro\s*v[šs]echny/i.test((name || '').toLowerCase());
}

type Math2WorkbookLine = 'krok' | 'pro-vsechny';

function detectMath2WorkbookLine(name: string | undefined): Math2WorkbookLine | null {
  if (isMathWorkbookKrokName(name)) return 'krok';
  if (isMathWorkbookProVsechnyName(name)) return 'pro-vsechny';
  return null;
}

function titulSkloneni(n: number): string {
  if (n === 1) return 'titul';
  if (n >= 2 && n <= 4) return 'tituly';
  return 'titul\u016f';
}

type RelatedRadaKey = 'krok' | 'pro-vsechny' | 'other';

const RELATED_RADA_LABELS: Record<RelatedRadaKey, string> = {
  krok: 'Krok za krokem',
  'pro-vsechny': 'Pro v\u0161echny',
  other: 'Ostatn\u00ed',
};

/** Ročník z pole produktu nebo z názvu (např. „pro 6. ročník“, „Matematika 1. ročník“). */
function relatedExtractRocnik(p: { name?: string; rocnik?: string | number }): string | null {
  const raw = p?.rocnik;
  if (raw != null && String(raw).trim() !== '') {
    const n = parseInt(String(raw), 10);
    if (!Number.isNaN(n)) return String(n);
  }
  const name = p?.name || '';
  let m = name.match(/pro\s+(\d+)\.\s*ro/i);
  if (m) return m[1];
  m = name.match(/(\d+)\.\s*ro\u010dn[ií]k/i);
  if (m) return m[1];
  m = name.match(/(\d+)\.\s*ro\u010d\./i);
  if (m) return m[1];
  m = name.match(/matematika\s+(\d+)\.\s*ro/i);
  if (m) return m[1];
  m = name.match(/(?:^|[\s–\-])(\d+)\.\s*ro\u010d\.?(?:\s|$|[–\-])/i);
  if (m) return m[1];
  return null;
}

function relatedExtractRadaKey(p: { name?: string }): RelatedRadaKey {
  if (isMathWorkbookKrokName(p.name)) return 'krok';
  if (isMathWorkbookProVsechnyName(p.name)) return 'pro-vsechny';
  return 'other';
}

/** Deterministický „náhodný“ výběr až 4 položek (stejné pořadí při stejném seedu). */
function pickUpToFourSeeded<T>(items: T[], seed: string): T[] {
  if (items.length <= 4) return items;
  const copy = [...items];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs(h + i * 7919) % (i + 1);
    const t = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = t;
  }
  return copy.slice(0, 4);
}

const FAN_OTHER_SUBJECT = 'Ostatn\u00ed';

function fanCoverSubjectKey(p: any): string {
  return parseSubject(`${p.name || ''} ${p.category || ''}`) ?? FAN_OTHER_SUBJECT;
}

/** Až 4 obálky: z každého předmětu nejvýše jedna; při více než 4 předmětech seedovaný výběr. */
function pickBundleFanCoversOnePerSubject(candidates: any[], seed: string): any[] {
  if (candidates.length === 0) return [];
  const bySubj = new Map<string, any[]>();
  for (const p of candidates) {
    const k = fanCoverSubjectKey(p);
    if (!bySubj.has(k)) bySubj.set(k, []);
    bySubj.get(k)!.push(p);
  }
  const onePerSubject: any[] = [];
  for (const [subj, pool] of bySubj) {
    const pick = pickUpToFourSeeded(pool, `${seed}|s:${subj}`)[0];
    if (pick) onePerSubject.push(pick);
  }
  return pickUpToFourSeeded(onePerSubject, `${seed}|fan`);
}

function bundleCatalogListSumHaler(bundle: ProductBundleRecord, catalog: any[]): number {
  return (bundle.productIds || []).reduce((sum, rawId) => {
    const p = catalog.find((x) => String(x.id) === String(rawId));
    return sum + (p ? getProductUnitPriceInHaler(p) : 0);
  }, 0);
}

function parseRocnikDilFromProduct(p: any): { rocnik: number | null; dil: number | null } {
  let rocnik: number | null = p?.rocnik != null && p.rocnik !== '' ? Number(p.rocnik) : null;
  if (rocnik != null && Number.isNaN(rocnik)) rocnik = null;
  const name = String(p?.name || '');
  const dilM = name.match(/(\d+)\.\s*d[ií]l/i);
  const dil = dilM ? parseInt(dilM[1], 10) : null;
  if (rocnik == null) {
    const rm = name.match(/(\d+)\.\s*ro[cč]n[ií]k/i);
    if (rm) rocnik = parseInt(rm[1], 10);
  }
  return { rocnik, dil };
}

/** Druhá řada stejného titulu (ročník + díl) — Mat 2. stupeň, jen tištěné sešity. */
function findMatematika2StupenCounterpartWorkbook(current: any, allProducts: any[]): any | null {
  if (!current || !isMatematika2StupenCategory(current.category)) return null;
  if (current.type === 'online' || current.type === 'license') return null;
  const line = detectMath2WorkbookLine(current.name);
  if (!line) return null;
  const want: Math2WorkbookLine = line === 'krok' ? 'pro-vsechny' : 'krok';
  const { rocnik, dil } = parseRocnikDilFromProduct(current);

  const candidates = allProducts.filter((p: any) => {
    if (p.id === current.id) return false;
    if (!isMatematika2StupenCategory(p.category)) return false;
    if (p.type === 'online' || p.type === 'license') return false;
    const pline = detectMath2WorkbookLine(p.name);
    if (pline !== want) return false;
    const pd = parseRocnikDilFromProduct(p);
    if (rocnik != null && pd.rocnik != null && rocnik !== pd.rocnik) return false;
    if (dil != null && pd.dil != null && dil !== pd.dil) return false;
    return true;
  });

  return candidates.find((p: any) => p.image) || candidates[0] || null;
}

function Math2ComparisonCoverThumb({
  book,
  onClick,
  rotatedDeg,
  className = '',
  zIndex = 1,
}: {
  book: any;
  onClick: () => void;
  rotatedDeg?: number;
  className?: string;
  zIndex?: number;
}) {
  const src = book?.image;
  const wrapStyle: React.CSSProperties = rotatedDeg
    ? {
        transform: `rotate(${rotatedDeg}deg)`,
        transformOrigin: 'bottom left',
        zIndex,
      }
    : { zIndex };

  return (
    <div className={`shrink-0 ${className}`} style={wrapStyle}>
      <button
        type="button"
        onClick={onClick}
        title={book?.name || 'Zobrazit produkt'}
        className="block rounded-none overflow-hidden bg-white shadow-md border border-[#001161]/12 hover:border-[#4B48CC]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4B48CC]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef1f7] transition-colors cursor-pointer p-0"
        style={{ width: MATH2_COVER_PREVIEW_W, height: MATH2_COVER_PREVIEW_H }}
      >
        {src ? (
          <ImageWithFallback
            src={src}
            alt={book?.name || ''}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[#001161]/30 text-center px-1 font-['Fenomen_Sans',sans-serif] leading-tight"
            style={{ background: 'linear-gradient(145deg, #f0f2f8, #e4e8f2)' }}
          >
            Sešit
          </div>
        )}
      </button>
    </div>
  );
}

/* ── Mini tab cards for ProductDetailPage ── */
function SubjectTabsGrid({ category }: { category: string }) {
  const [tabs, setTabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const subjectSlug = subjectToSlug(category);
  const subjectPath = `/predmet/${subjectSlug}`;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -440 : 440, behavior: 'smooth' });
  };

  useEffect(() => {
    const subjectName = getTabSubjectName(category);
    setLoading(true);
    fetch(`${SERVER}/public/tabs?subject=${encodeURIComponent(subjectName)}`, { headers: AUTH_H })
      .then(r => r.json())
      .then(d => setTabs(d.items || []))
      .catch(() => setTabs([]))
      .finally(() => setLoading(false));
  }, [category]);

  if (loading) return (
    <div className="flex gap-1.5 py-8 justify-center">
      {[0,1,2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-[#001161]/20 animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />
      ))}
    </div>
  );

  if (tabs.length === 0) return null;

  return (
    <div>
      {/* Šipky */}
      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            style={{ background: '#001161', color: '#fff' }}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            style={{ background: '#001161', color: '#fff' }}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scroll kontejner — stejný styl jako VividbooksFeatures */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab, i) => {
          const bgColor = tab.bgColor || '#f1f3f8';
          return (
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.05 }}
              transition={{ delay: i * 0.04, duration: 0.22, ease: 'easeOut' }}
              className="rounded-[20px] md:rounded-[24px] flex flex-col overflow-hidden shrink-0"
              style={{ background: bgColor, width: 185, height: 275 }}
            >
              {/* Visual — top 72% */}
              <div
                className="flex items-center justify-center overflow-hidden"
                style={{ height: '72%', padding: '8px 8px 4px' }}
              >
                {tab.contentImage ? (
                  <img
                    src={tab.contentImage}
                    alt={tab.tabText}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <BookOpen className="w-10 h-10 text-[#001161]/20" />
                )}
              </div>

              {/* Text — bottom 28% */}
              <div
                className="px-4 pb-3 pt-1 flex flex-col gap-1 text-[#001161] items-center justify-end"
                style={{ height: '28%' }}
              >
                <p
                  className="text-[14px] leading-tight text-center"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif", fontWeight: 700 }}
                >
                  {tab.contentHeadline || tab.tabText}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div className="w-4 shrink-0" />
      </div>

      {/* Více o předmětu — pod dlaždicemi */}
      <div className="flex justify-center mt-3">
        <button
          onClick={() => navigate(subjectPath)}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-[#001161] hover:opacity-60 transition-opacity cursor-pointer"
          style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
        >
          Více o předmětu
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Czech locative helper ────────────────────────────── */
const subjectLocative: Record<string, string> = {
  'Matematika':     'v\u00a0Matematice',
  'Fyzika':         've\u00a0Fyzice',
  'Chemie':         'v\u00a0Chemii',
  'Přírodopis':     'v\u00a0Přírodopise',
  'Biologie':       'v\u00a0Biologii',
  'Zeměpis':        'v\u00a0Zeměpisu',
  'Dějepis':        'v\u00a0Dějepisu',
  'Prvouka':        'v\u00a0Prvouci',
  'Český jazyk':    'v\u00a0Českém jazyce',
  'Anglický jazyk': 'v\u00a0Anglickém jazyce',
};
const getLocative = (name: string) => subjectLocative[name] || `v\u00a0${name}`;

/* ─── helpers ─────────────────────────────────────────── */
const formatTypography = (text: string) => {
  if (!text) return '';
  return text
    .replace(/(\b[vszkuoia])\s+/gi, '$1\u00A0')
    .replace(/(\d+\.?)\s+/g, '$1\u00A0');
};

const formatPrice = (product: any): string => {
  const raw = product.price?.toString() ?? '';
  if (!raw) return '';
  if (product.type === 'license' && ['Fyzika', 'Chemie', 'P\u0159\u00edrodopis'].includes(product.category))
    return 'Cena podle po\u010dtu \u017e\u00e1k\u016f';
  // Odstraníme trailing ",-" nebo ",–" (i s mezerou) ať je kdekoliv
  const p = raw.replace(/,[\u2013\-]\s*$/, '').replace(/,\s*$/, '').trim();
  if (p.includes('Cena') || isNaN(parseInt(p))) return p;
  if (p.includes('K\u010d')) return p;
  return `${p.replace(/[,\s\.].*$/, '').trim()}\u00a0K\u010d`;
};

const getUnitPriceInHaler = (product: any): number => {
  if (typeof product.priceAmount === 'number' && Number.isFinite(product.priceAmount)) {
    return Math.max(0, Math.round(product.priceAmount * 100));
  }

  const normalized = String(product.price || '')
    .replace(/\s/g, '')
    .replace('Kč', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
};

const getNote = (p: any): string =>
  p.note || p.poznamka || p.metadata?.poznamka || p.metadata?.pozn\u00e1mka || p.metadata?.note || '';

const getDescription = (p: any): string => {
  if (p.description) return p.description;
  const descMap: Record<string, string> = {
    'Matematika': 'Pracovn\u00ed se\u0161it pln\u00fd p\u0159\u00edklad\u016f, kter\u00e9 vedou \u017e\u00e1ky k systematick\u00e9mu pochopen\u00ed matematiky krok za krokem.',
    'Anglick\u00fd jazyk': 'Modern\u00ed pracovn\u00ed se\u0161it pro v\u00fduku angli\u010dtiny, kter\u00fd kombinuje gramatiku, slovn\u00ed z\u00e1sobu a komunika\u010dn\u00ed dovednosti.',
    'Fyzika': 'Se\u0161it propojuje teorii s praxemi pokusy a \u00falohami z b\u011b\u017en\u00e9ho \u017eivota.',
    'Chemie': 'Pracovn\u00ed se\u0161it pokr\u00fdv\u00e1 cel\u00e9 spektrum gymn\u00e1zi\u00e1ln\u00ed i z\u00e1kladn\u00ed chemie s d\u016erazem na pochopen\u00ed.',
    'P\u0159\u00edrodopis': 'Komplexn\u00ed pr\u016fvodce p\u0159\u00edrodop\u00edsem s kresleny\u0304mi ilustracemi a interaktivn\u00edmi \u00falohami.',
  };
  const cat = p.category || '';
  return descMap[cat] || '';
};

const getCategoryLink = (cat: string): string => {
  const links: Record<string, string> = {
    'Matematika': 'https://www.vividbooks.cz/matematika',
    'Anglick\u00fd jazyk': 'https://www.vividbooks.cz/anglicky-jazyk',
    'Fyzika': 'https://www.vividbooks.cz/fyzika',
    'Chemie': 'https://www.vividbooks.cz/chemie',
    'P\u0159\u00edrodopis': 'https://www.vividbooks.cz/prirodopis',
  };
  return links[cat] || 'https://www.vividbooks.cz';
};

const CATEGORY_COLORS: Record<string, { bg: string; accent: string }> = {
  'Matematika': { bg: '#eef2fb', accent: '#6b58ff' },
  'Anglick\u00fd jazyk': { bg: '#fdf0e6', accent: '#FF6B1A' },
  'Fyzika': { bg: '#eafaf1', accent: '#27ae60' },
  'Chemie': { bg: '#fef9e7', accent: '#f39c12' },
  'P\u0159\u00edrodopis': { bg: '#e8f8f5', accent: '#1abc9c' },
  'default': { bg: '#f1f3f8', accent: '#001161' },
};

/* ─── spec row ───────────────────────────────────────── */
function SpecRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#001161]/6 last:border-none">
      <div className={`flex-shrink-0 ${highlight ? 'text-[#27ae60]' : 'text-[#001161]/30'}`}>{icon}</div>
      <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 uppercase tracking-[0.12em] w-[120px] flex-shrink-0 font-bold">{label}</span>
      <span className={`font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold leading-snug ${highlight ? 'text-[#27ae60]' : 'text-[#001161]'}`}>{value}</span>
    </div>
  );
}

function stockBadgeClass(code?: ProductStockItem['stockStatus']['code']) {
  switch (code) {
    case 'in_stock':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'low':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'waiting':
    case 'unknown':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-[#001161]/10 bg-[#f5f7fb] text-[#001161]/60';
  }
}

/* ─── obsah parser ────────────────────────────────────────── */
function parseObsah(text: string): { number: string; title: string; note?: string }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map((line, idx) => {
      // "Kapitola 3: Zlomky  nějaký dovětek"
      const chapMatch = line.match(/^(?:kapitola|lekce|část|unit|chapter|téma|cvičení)\s*(\d+[\.\d]*)\s*[:\-–]\s*(.+)/i);
      if (chapMatch) {
        const [,, rest] = chapMatch;
        const [title, ...noteParts] = rest.split(/\s*[—\-–]\s*/);
        return { number: chapMatch[1], title: title.trim(), note: noteParts.join(' — ').trim() || undefined };
      }
      // "3. Zlomky" or "3) Zlomky"
      const numMatch = line.match(/^(\d+[\.\d]*)[\.\)]\s+(.+)/);
      if (numMatch) {
        const [,, rest] = numMatch;
        const [title, ...noteParts] = rest.split(/\s*[—\-–]\s*/);
        return { number: numMatch[1], title: title.trim(), note: noteParts.join(' — ').trim() || undefined };
      }
      // plain line → use index
      const [title, ...noteParts] = line.split(/\s*[—\-–]\s*/);
      return { number: String(idx + 1), title: title.trim(), note: noteParts.join(' — ').trim() || undefined };
    });
}

/* ── main component ──────────────────────────────────── */
interface ProductDetailPageProps {
  product: any;
  products: any[];
  onBack: () => void;
  onOrder?: () => void;
  isDistributorMode?: boolean;
  onProductSelect?: (product: any) => void;
}

export function ProductDetailPage({
  product,
  products,
  onBack,
  onOrder,
  isDistributorMode = false,
  onProductSelect,
}: ProductDetailPageProps) {
  const [flipbookOpen, setFlipbookOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  /** Jednovýběrové bobánky (jako přepínač); znovu kliknutí na aktivní = zrušit. */
  const [relatedRocnikFilter, setRelatedRocnikFilter] = useState<string | null>(null);
  const [relatedRadaFilter, setRelatedRadaFilter] = useState<RelatedRadaKey | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [internalBundleAdding, setInternalBundleAdding] = useState(false);
  const [internalBundleAdded, setInternalBundleAdded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [stockItem, setStockItem] = useState<ProductStockItem | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [mathSeriesDiffVideoOpen, setMathSeriesDiffVideoOpen] = useState(false);
  const [publicProductBundles, setPublicProductBundles] = useState<ProductBundleRecord[]>([]);
  const [kvBundleAddingId, setKvBundleAddingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { addItem, openCart: openInternalCart } = useCart();

  const note = getNote(product);
  const desc = getDescription(product);
  const price = formatPrice(product);
  const hasFlipbook = !!(product.flipbookLink || product.previewLink);
  const hasCustomAppLink = !!(product.appLink && String(product.appLink).trim());
  /** Ukázka v dlaždici + odkaz do aplikace; odkaz zobrazit i bez flipbooku (např. předobjednávky s poznámkou o dostupnosti). */
  const showImagePanelActions = hasFlipbook || hasCustomAppLink;
  const flipbookUrl = product.flipbookLink || product.previewLink;
  const isHeyzine = flipbookUrl?.includes('heyzine');
  const catColors = CATEGORY_COLORS[product.category] || CATEGORY_COLORS['default'];
  const categoryBaseForMsmt = (product.category || '').replace(/\s+\d+\.\s*stupe.*$/i, '').trim();
  const showMsmtComplianceBadge =
    !!product.dolozka && subjectShowsMsmtDolozkaBadge(categoryBaseForMsmt);
  /** Náhled v levé „dlaždici“: tiskoviny −30 %, digitální licence +10 % (vůči původním max-height) */
  const isDigitalHero = product.type === 'online' || product.type === 'license';
  const mdUp = useMatchMedia('(min-width: 768px)', false);
  /** Jen digitály — tiskoviny mají inline SVG stín + drop-shadow na obálce. */
  const heroDigitalImageFilter = useMemo(() => {
    if (product.type === 'workbook') return undefined as string | undefined;
    return mdUp
      ? 'drop-shadow(0 30px 50px rgba(0,17,97,0.22))'
      : 'drop-shadow(0 12px 24px rgba(0,17,97,0.16))';
  }, [mdUp, product.type]);

  useEffect(() => {
    let cancelled = false;

    if (product.type === 'online' || product.type === 'license' || !product.id) {
      setStockItem(null);
      setStockLoading(false);
      return;
    }

    setStockLoading(true);
    fetchProductStockItem(product.id)
      .then((data) => {
        if (!cancelled) {
          setStockItem(data.item);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStockItem(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStockLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [product.id, product.type]);

  useEffect(() => {
    if (!mathSeriesDiffVideoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMathSeriesDiffVideoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mathSeriesDiffVideoOpen]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${SERVER}/product-bundles`, { headers: AUTH_H })
      .then((r) => (r.ok ? r.json() : { bundles: [] }))
      .then((j) => {
        if (!cancelled) setPublicProductBundles(Array.isArray(j.bundles) ? j.bundles : []);
      })
      .catch(() => {
        if (!cancelled) setPublicProductBundles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bundlesContainingThisProduct = useMemo(() => {
    const pid = String(product.id);
    return publicProductBundles.filter((b) => (b.productIds || []).some((id) => String(id) === pid));
  }, [publicProductBundles, product.id]);

  const handleAddKvBundleToSchoolOrder = (bundle: ProductBundleRecord) => {
    if (kvBundleAddingId) return;
    setKvBundleAddingId(bundle.id);
    try {
      const subjects = new Set<string>();
      for (const rawId of bundle.productIds || []) {
        const p = products.find((x) => String(x.id) === String(rawId));
        const cat = p?.category;
        if (cat && String(cat).trim()) subjects.add(String(cat).trim());
      }
      if (subjects.size === 0 && product.category) {
        subjects.add(String(product.category).trim());
      }
      mergeSchoolOrderDraft({
        selTypes: ['workbook'],
        ...(subjects.size > 0 ? { selSubjects: Array.from(subjects) } : {}),
      });
      navigate('/objednat?step=2', { state: { addSchoolBundle: { id: bundle.id } } });
    } finally {
      setKvBundleAddingId(null);
    }
  };

  const isMath = (product.category || '').toLowerCase().includes('matematik')
    || (product.name || '').toLowerCase().includes('matematik')
    || (product.name || '').toLowerCase().includes('krok za krokem');

  // ── Detekce série (X. díl) ──────────────────────────────────────────────
  const dilMatch = (product.name || '').match(/[–\-\/]\s*(\d+)\.\s*d[ií]l\s*$/i);
  const dilNumber = dilMatch ? parseInt(dilMatch[1]) : null;
  const seriesBase = dilNumber !== null
    ? (product.name || '').replace(/\s*[–\-\/]\s*\d+\.\s*d[ií]l\s*$/i, '').trim()
    : null;
  const siblingDils = seriesBase
    ? products
        .filter(p =>
          p.id !== product.id &&
          p.shopifyVariantId &&
          (p.name || '').replace(/\s*[–\-\/]\s*\d+\.\s*d[ií]l\s*$/i, '').trim() === seriesBase
        )
        .sort((a: any, b: any) => {
          const aNum = (a.name || '').match(/(\d+)\.\s*d[ií]l/i);
          const bNum = (b.name || '').match(/(\d+)\.\s*d[ií]l/i);
          return (parseInt(aNum?.[1] || '0')) - (parseInt(bNum?.[1] || '0'));
        })
    : [];

  const handleAddToNewCart = () => {
    addItem({
      productId: String(product.id),
      productName: product.name || 'Produkt',
      variantId: product.shopifyVariantId || undefined,
      quantity: 1,
      unitPrice: getUnitPriceInHaler(product),
      imageUrl: product.image || undefined,
    });
    openInternalCart();
  };

  const handleAddBundleToNewCart = () => {
    if (internalBundleAdding) return;

    setInternalBundleAdding(true);
    try {
      addItem({
        productId: String(product.id),
        productName: product.name || 'Produkt',
        variantId: product.shopifyVariantId || undefined,
        quantity: 1,
        unitPrice: getUnitPriceInHaler(product),
        imageUrl: product.image || undefined,
      });

      for (const sibling of siblingDils) {
        addItem({
          productId: String(sibling.id),
          productName: sibling.name || 'Produkt',
          variantId: sibling.shopifyVariantId || sibling.variantId || undefined,
          quantity: 1,
          unitPrice: getUnitPriceInHaler(sibling),
          imageUrl: sibling.image || sibling.imageUrl || sibling.coverImage || undefined,
        });
      }

      setInternalBundleAdded(true);
      openInternalCart();
      setTimeout(() => setInternalBundleAdded(false), 3000);
    } finally {
      setInternalBundleAdding(false);
    }
  };

  // For Matematika: show all Math products across both grades; otherwise same category
  const allRelated = useMemo(
    () =>
      isMath
        ? products.filter((p) => {
            if (p.id === product.id) return false;
            const cat = (p.category || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            return cat.includes('matematik') || name.includes('matematik') || name.includes('krok za krokem');
          })
        : products
            .filter((p) => {
              if (p.id === product.id) return false;
              const pCat = (p.category || '').toLowerCase();
              const thisCat = (product.category || '').toLowerCase();
              const pBase = pCat.split(/[\s\-]/)[0];
              const thisBase = thisCat.split(/[\s\-]/)[0];
              return pCat === thisCat || (pBase.length > 3 && thisBase.length > 3 && pBase === thisBase);
            })
            .slice(0, 12),
    [products, product.id, product.category, isMath],
  );

  const relatedBaseList = useMemo(
    () => allRelated.slice().sort((a, b) => (Number(a.rocnik) || 99) - (Number(b.rocnik) || 99)),
    [allRelated],
  );

  const relatedRocnikOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of relatedBaseList) {
      const r = relatedExtractRocnik(p);
      if (r) s.add(r);
    }
    return Array.from(s).sort((a, b) => Number(a) - Number(b));
  }, [relatedBaseList]);

  /** U matematiky vždy dvě řady v bobánkách; jinde jen podle dat. */
  const relatedRadaOptions = useMemo((): RelatedRadaKey[] => {
    if (isMath) return ['krok', 'pro-vsechny'];
    const s = new Set<RelatedRadaKey>();
    for (const p of relatedBaseList) {
      s.add(relatedExtractRadaKey(p));
    }
    const order: RelatedRadaKey[] = ['krok', 'pro-vsechny', 'other'];
    return order.filter((k) => s.has(k));
  }, [isMath, relatedBaseList]);

  const showRelatedFilterPills =
    isMath || relatedRocnikOptions.length > 1 || relatedRadaOptions.length > 1;

  const relatedFinal = useMemo(() => {
    let list = relatedBaseList;
    if (relatedRocnikFilter != null) {
      list = list.filter((p) => relatedExtractRocnik(p) === relatedRocnikFilter);
    }
    if (relatedRadaFilter != null) {
      list = list.filter((p) => relatedExtractRadaKey(p) === relatedRadaFilter);
    }
    return list;
  }, [relatedBaseList, relatedRocnikFilter, relatedRadaFilter]);

  useEffect(() => {
    setRelatedRocnikFilter(null);
    setRelatedRadaFilter(null);
  }, [product.id]);

  const mat2BannerCounterpart = useMemo(
    () => findMatematika2StupenCounterpartWorkbook(product, products),
    [product.id, product.name, product.rocnik, product.category, product.type, products],
  );

  const showMat2BannerWorkbookCovers =
    isMatematika2StupenCategory(product.category) &&
    product.type !== 'online' &&
    product.type !== 'license' &&
    detectMath2WorkbookLine(product.name) != null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="min-h-screen bg-white"
      style={{ willChange: 'opacity, transform' }}
    >
      <SEOHead
        title={product.name}
        path={`/produkt/${encodeURIComponent(product.id)}`}
        description={desc || `${product.name} \u2014 ${product.category}. Interaktivn\u00ed u\u010debn\u00ed materi\u00e1l od Vividbooks.`}
        image={product.image}
        type="product"
        jsonLd={[
          productJsonLd({
            name: product.name,
            description: desc,
            image: product.image,
            price: product.priceAmount || 0,
            category: product.category,
          }),
          breadcrumbJsonLd([
            { name: 'Katalog', url: 'https://www.vividbooks.com/' },
            { name: product.category, url: `https://www.vividbooks.com/predmet/${(product.category || '').toLowerCase().replace(/\s+/g, '-')}` },
            { name: product.name, url: `https://www.vividbooks.com/produkt/${encodeURIComponent(product.id)}` },
          ]),
        ]}
      />
      {/* ── Hero section ── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-16 items-start">

          {/* LEFT — image panel */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-[80px] self-start">
            <div
              className="relative rounded-[32px] flex flex-col overflow-hidden"
              style={{ background: catColors.bg, minHeight: 'clamp(320px, 58vw, 540px)' }}
            >
              {/* RVP + doložka (nad výřezem produktu) */}
              <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 px-5 pt-5 pb-1 shrink-0">
                <ProductComplianceBadge>{'Podle RVP'}</ProductComplianceBadge>
                {showMsmtComplianceBadge ? (
                  <ProductComplianceBadge>{'Dolo\u017eka M\u0160MT'}</ProductComplianceBadge>
                ) : null}
              </div>

              {/* Bobánek */}
              {note && (
                <div className="absolute top-[4.5rem] sm:top-24 left-6 z-20 transform -rotate-12">
                  <div className="bg-[#FF9900] text-white px-5 py-2.5 rounded-xl font-['Fenomen_Sans',sans-serif] text-[14px] font-bold uppercase tracking-wider shadow-[0_6px_18px_rgba(255,153,0,0.45)] border-2 border-white/60">
                    {note}
                  </div>
                </div>
              )}

              {/* Book image — tlačítka v toku pod obálkou (ne absolute), ať obálka nepřekrývá CTA */}
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div
                  className={`flex w-full flex-1 items-center justify-center px-6 pt-2 sm:px-10 lg:px-12 lg:pt-4 ${
                    showImagePanelActions ? 'pb-3 sm:pb-4' : 'pb-6 sm:pb-10 lg:pb-12'
                  }`}
                  style={{ minHeight: 'min(52vw, 260px)' }}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="relative flex max-h-full w-full items-center justify-center"
                    style={product.type === 'workbook' ? undefined : { filter: heroDigitalImageFilter }}
                  >
                    {product.image && product.type === 'workbook' ? (
                      <BookCoverFloorShadow className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[36px] w-[min(42%,200px)] max-w-[200px] -translate-x-1/2 translate-y-[35%] select-none sm:h-[40px] sm:w-[min(38%,220px)] md:h-[44px]" />
                    ) : null}
                    {product.image ? (
                      <ImageWithFallback
                        src={product.image}
                        alt={product.name}
                        className={`relative z-10 w-auto max-h-full object-contain ${
                          isLandscape
                            ? isDigitalHero
                              ? 'max-h-[143px] sm:max-h-[176px] lg:max-h-[220px]'
                              : 'max-h-[100px] sm:max-h-[124px] lg:max-h-[156px]'
                            : isDigitalHero
                              ? 'max-h-[220px] sm:max-h-[286px] lg:max-h-[374px]'
                              : 'max-h-[128px] sm:max-h-[168px] lg:max-h-[220px]'
                        } ${product.type === 'workbook' ? 'drop-shadow-[0_14px_28px_rgba(0,17,97,0.3)] max-md:drop-shadow-[0_10px_22px_rgba(0,17,97,0.26)]' : ''}`}
                        onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          setImageLoaded(true);
                          const img = e.currentTarget;
                          setIsLandscape(img.naturalWidth >= img.naturalHeight);
                        }}
                      />
                    ) : (
                      <div
                        className="flex h-[220px] w-[160px] items-center justify-center rounded-2xl sm:h-[280px] sm:w-[200px]"
                        style={{ background: catColors.bg }}
                      >
                        <BookOpen className="h-16 w-16 text-[#001161]/20 sm:h-20 sm:w-20" />
                      </div>
                    )}
                  </motion.div>
                </div>

                {showImagePanelActions && (
                  <div className="relative z-30 mt-auto flex shrink-0 gap-2 border-t border-[#001161]/10 bg-white/45 px-5 pb-5 pt-3 backdrop-blur-[2px] sm:pt-4">
                    {hasFlipbook && (
                      <button
                        type="button"
                        onClick={() => setFlipbookOpen(true)}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-white/60 bg-white/85 px-3 py-2.5 font-['Fenomen_Sans',sans-serif] text-[12px] font-semibold text-[#001161]/70 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-[#001161] active:scale-[0.98]"
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        {'Prolistovat uk\u00e1zku'}
                      </button>
                    )}
                    <a
                      href={product.appLink || 'https://app.vividbooks.cz'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 rounded-[12px] border border-white/60 bg-white/85 px-3 py-2.5 font-['Fenomen_Sans',sans-serif] text-[12px] font-semibold text-[#001161]/70 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-[#001161] active:scale-[0.98] no-underline ${hasFlipbook ? 'flex-1' : 'w-full'}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      {'Otev\u0159\u00edt v aplikaci'}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ISBN + rok — REMOVED */}
          </div>

          {/* RIGHT — product info */}
          <div className="flex flex-col pt-2 lg:pt-6">

            {/* Breadcrumb — above title */}
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-[#001161]/50 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[12px] transition-colors cursor-pointer group"
              >
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                {'Zp\u011bt'}
              </button>
              <span className="text-[#001161]/20 text-[12px]">/</span>
              <span className="text-[#001161]/40 font-['Fenomen_Sans',sans-serif] text-[12px]">{product.category}</span>
            </div>

            {/* Category + type label */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span
                className="inline-block px-3 py-1 rounded-xl font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-[0.15em]"
                style={{ background: catColors.bg, color: catColors.accent }}
              >
                {product.category}
              </span>
              {product.rocnik && (
                <span className="inline-block px-3 py-1 rounded-xl bg-[#f1f3f8] text-[#001161]/50 font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-[0.15em]">
                  {product.rocnik}{'.\u00a0ro\u010dn\u00edk'}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[24px] md:text-[29px] leading-[1.08] mb-5">
              {formatTypography(product.name)}
            </h1>

            {/* Authors */}
            {product.autori && (
              <div className="flex items-center gap-2 mb-6">
                <User2 className="w-4 h-4 text-[#001161]/30 flex-shrink-0" />
                <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/60">{product.autori}</p>
              </div>
            )}

            {/* Description */}
            {desc && (
              <p className="font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161]/70 leading-[1.65] mb-8 whitespace-pre-wrap">
                {desc}
              </p>
            )}

            {/* Price block + sklad vedle ceny */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mb-8 pb-8 border-b border-[#001161]/8">
              <div>
                <p className="font-['Fenomen_Sans',sans-serif] text-[11px] uppercase tracking-[0.15em] text-[#001161]/40 mb-1">{'Cena'}</p>
                <p className="font-['Cooper_Light',serif] text-[#001161] text-[40px] leading-none">
                  {product.type === 'online'
                    ? (billingCycle === 'monthly'
                        ? (product.priceMonthly || price)
                        : (product.priceYearly || price))
                    : price}
                </p>
              </div>
              {product.type === 'workbook' && (
                <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 pb-1">{'v\u010d. DPH'}</p>
              )}
              {product.type !== 'online' && product.type !== 'license' && (
                <>
                  {stockLoading ? (
                    <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 pb-1 max-w-[200px]">
                      {'Ověřujeme skladovost…'}
                    </p>
                  ) : stockItem?.stockStatus ? (
                    stockItem.stockStatus.code === 'in_stock' ? (
                      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] font-medium text-emerald-700 pb-1">
                        {stockItem.stockStatus.label}
                      </p>
                    ) : (
                      <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold font-['Fenomen_Sans',sans-serif] ${stockBadgeClass(stockItem.stockStatus.code)}`}>
                        {stockItem.stockStatus.label}
                      </div>
                    )
                  ) : null}
                </>
              )}
            </div>

            {/* CTA buttons — only for non-digital products */}
            {product.type !== 'online' && (
            <div className="flex flex-col gap-2 mb-10">
              <div className="flex gap-2">
                {product.shopifyVariantId && (() => {
                  const note = getNote(product);
                  // Přesné názvy měsíců + "dostupn" — zabrání omylnému shodě (list→listy, led→sledovat, dost→dostanete…)
                  const isAvailabilityNote = /\b(leden|únor|b[rř]ezen|duben|kv[eě]ten|[cč]ervenec|[cč]erven|srpen|z[aá][rř][ií]|[rř][ií]jen|listopad|prosinec|dostupn)/i.test(note);
                  return !isAvailabilityNote;
                })() && (
                  <button
                    onClick={handleAddToNewCart}
                    className="flex items-center justify-center gap-2 flex-1 py-3 px-4 bg-[#5b4fd8] hover:bg-[#4c40c7] text-white rounded-[14px] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_4px_14px_rgba(91,79,216,0.35)]"
                  >
                    <ShoppingCart className="w-4 h-4 shrink-0" />
                    {'Přidat do košíku'}
                  </button>
                )}

                {/* Primary action */}
                {isDistributorMode && product.type === 'workbook' ? (
                  <button
                    className="flex items-center justify-center gap-2 flex-1 py-3 px-4 bg-[#001161] hover:bg-[#000a3d] text-white rounded-[14px] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    {'St\u00e1hnout podklady'}
                  </button>
                ) : !product.shopifyVariantId ? (
                  <a
                    href={product.link || getCategoryLink(product.category)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 flex-[1.3] py-3 px-4 bg-[#001161] hover:bg-[#000a3d] text-white rounded-[14px] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] no-underline"
                  >
                    <ShoppingCart className="w-4 h-4 shrink-0" />
                    {'Objednat pro školu'}
                  </a>
                ) : null}

                {/* Secondary — same row */}
                {onOrder && (
                  <button
                    onClick={onOrder}
                    className="flex items-center justify-center gap-1.5 flex-1 py-3 px-3 rounded-[14px] font-['Fenomen_Sans',sans-serif] text-[12px] font-semibold text-white bg-[#3d3d3d] hover:bg-[#555] transition-all cursor-pointer border border-[#3d3d3d] text-center leading-snug"
                  >
                    {'P\u0159idat do objedn\u00e1vky pro \u0161kolu'}
                  </button>
                )}
              </div>

              {/* Bundle button — přidat včetně ostatních dílů */}
              {siblingDils.length > 0 && product.shopifyVariantId && (() => {
                const note = getNote(product);
                const isAvailabilityNote = /\b(leden|únor|b[rř]ezen|duben|kv[eě]ten|[cč]ervenec|[cč]erven|srpen|z[aá][rř][ií]|[rř][íi]jen|listopad|prosinec|dostupn)/i.test(note);
                if (isAvailabilityNote) return null;

                // Sestavit popis: "včetně 2. dílu" nebo "včetně 1. a 2. dílu"
                const sibLabels = siblingDils.map((s: any) => {
                  const m = (s.name || '').match(/(\d+)\.\s*d[ií]l/i);
                  return m ? `${m[1]}.\u00a0d\u00edlu` : s.name;
                });
                const sibText = sibLabels.length === 1
                  ? sibLabels[0]
                  : sibLabels.slice(0, -1).join(', ') + '\u00a0a\u00a0' + sibLabels[sibLabels.length - 1];

                const totalPrice = [product, ...siblingDils]
                  .reduce((acc: number, p: any) => {
                    const raw = String(p.priceAmount || p.price || '').replace(/[^\d]/g, '');
                    return acc + (parseInt(raw) || 0);
                  }, 0);

                return (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={handleAddBundleToNewCart}
                      disabled={internalBundleAdding}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[12px] border-2 border-dashed border-[#5b4fd8]/30 bg-[#f5f3ff] hover:bg-[#ede9fe] hover:border-[#5b4fd8]/50 text-[#5b4fd8] font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
                    >
                      {internalBundleAdded ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5b4fd8]" />
                          {'Přidáno do nového košíku!'}
                        </>
                      ) : internalBundleAdding ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-[#5b4fd8]/40 border-t-[#5b4fd8] rounded-full animate-spin shrink-0" />
                          {'Přidávám…'}
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
                          {'Přidat včetně ' + sibText}
                          {totalPrice > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-lg bg-[#5b4fd8]/10 text-[#5b4fd8] text-[11px] font-bold">
                              {totalPrice + ' Kč'}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
            )}

            {/* ── Subscription block — only for digital licences ── */}
            {product.type === 'online' && (product.stripeMonthlyUrl || product.stripeYearlyUrl || onOrder) && (
              <div className="mb-10 rounded-[22px] border border-[#001161]/8 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3.5 bg-[#f5f7fb] border-b border-[#001161]/8 flex items-center gap-2">
                  <Repeat2 className="w-4 h-4 text-[#001161]/40" />
                  <p className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-[0.14em] text-[#001161]/50">
                    {'P\u0159edplatn\u00e9 digit\u00e1ln\u00ed licence'}
                  </p>
                </div>

                {/* Rodič / Žák row */}
                {(product.stripeMonthlyUrl || product.stripeYearlyUrl) && (
                  <div className="px-5 py-5 border-b border-[#001161]/6">
                    <div className="flex items-center gap-2 mb-4">
                      <User2 className="w-3.5 h-3.5 text-[#001161]/40" />
                      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]/70">
                        {'P\u0159edplatit jako rodi\u010d\u00a0/\u00a0\u017e\u00e1k'}
                      </p>
                    </div>

                    {/* Billing cycle radios */}
                    <div className="flex flex-col gap-2.5 mb-4">
                      {product.stripeMonthlyUrl && (
                        <button
                          onClick={() => setBillingCycle('monthly')}
                          className={`flex items-center justify-between w-full px-4 py-3 rounded-[14px] border-2 transition-all cursor-pointer
                            ${billingCycle === 'monthly'
                              ? 'border-[#635BFF] bg-[#635BFF]/5'
                              : 'border-[#001161]/10 bg-white hover:border-[#635BFF]/40'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                              ${billingCycle === 'monthly' ? 'border-[#635BFF]' : 'border-[#001161]/25'}`}>
                              {billingCycle === 'monthly' && (
                                <div className="w-2 h-2 rounded-full bg-[#635BFF]" />
                              )}
                            </div>
                            <span className={`font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold transition-colors
                              ${billingCycle === 'monthly' ? 'text-[#635BFF]' : 'text-[#001161]/70'}`}>
                              {'M\u011bs\u00ed\u010dn\u011b'}
                            </span>
                          </div>
                          {product.priceMonthly && (
                            <span className={`font-['Fenomen_Sans',sans-serif] text-[13px] font-bold transition-colors
                              ${billingCycle === 'monthly' ? 'text-[#635BFF]' : 'text-[#001161]/50'}`}>
                              {product.priceMonthly}
                            </span>
                          )}
                        </button>
                      )}

                      {product.stripeYearlyUrl && (
                        <button
                          onClick={() => setBillingCycle('yearly')}
                          className={`flex items-center justify-between w-full px-4 py-3 rounded-[14px] border-2 transition-all cursor-pointer
                            ${billingCycle === 'yearly'
                              ? 'border-[#635BFF] bg-[#635BFF]/5'
                              : 'border-[#001161]/10 bg-white hover:border-[#635BFF]/40'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                              ${billingCycle === 'yearly' ? 'border-[#635BFF]' : 'border-[#001161]/25'}`}>
                              {billingCycle === 'yearly' && (
                                <div className="w-2 h-2 rounded-full bg-[#635BFF]" />
                              )}
                            </div>
                            <span className={`font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold transition-colors
                              ${billingCycle === 'yearly' ? 'text-[#635BFF]' : 'text-[#001161]/70'}`}>
                              {'Ro\u010dn\u011b'}
                            </span>
                          </div>
                          {product.priceYearly && (
                            <span className={`font-['Fenomen_Sans',sans-serif] text-[13px] font-bold transition-colors
                              ${billingCycle === 'yearly' ? 'text-[#635BFF]' : 'text-[#001161]/50'}`}>
                              {product.priceYearly}
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Single CTA */}
                    <a
                      href={billingCycle === 'monthly'
                        ? (product.stripeMonthlyUrl || product.stripeYearlyUrl)
                        : (product.stripeYearlyUrl || product.stripeMonthlyUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-[16px] bg-[#635BFF] hover:bg-[#5248e8] text-white no-underline font-['Fenomen_Sans',sans-serif] text-[15px] font-bold transition-all hover:scale-[1.01] active:scale-[0.98] shadow-[0_6px_20px_rgba(99,91,255,0.32)]"
                    >
                      <CreditCard className="w-4 h-4 shrink-0" />
                      {'P\u0159edplatit jako rodi\u010d\u00a0/\u00a0\u017e\u00e1k pro\u00a01\u00a0za\u0159\u00edzen\u00ed'}
                    </a>
                  </div>
                )}

                {/* Škola row */}
                {onOrder && (
                  <div className="px-5 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <School className="w-3.5 h-3.5 text-[#001161]/40" />
                      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]/70">
                        {'P\u0159edplatit \u0161kola'}
                      </p>
                    </div>
                    <button
                      onClick={onOrder}
                      className="w-full py-3.5 px-4 rounded-[16px] bg-[#3d3d3d] hover:bg-[#555] text-white font-['Fenomen_Sans',sans-serif] text-[15px] font-bold transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <School className="w-4 h-4" />
                      {'P\u0159idat do objedn\u00e1vky pro \u0161kolu'}
                    </button>
                    <p className="font-['Fenomen_Sans',sans-serif] text-[11px] text-[#001161]/35 text-center mt-2.5">
                      {'Vyplnte formul\u00e1\u0159 \u2014 nab\u00eddku zpracujeme na m\u00edru'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Specs */}
            {(product.vazba || product.pocetStranek || product.format || product.dolozka || product.isbn || product.rokVydani || product.autori) && (
              <div className="rounded-[24px] bg-[#f8f9fc] p-5">
                <p className="font-['Fenomen_Sans',sans-serif] text-[11px] uppercase tracking-[0.15em] text-[#001161]/35 mb-1 font-bold">{'Specifikace'}</p>

                {/* Basic specs grid */}
                <div>
                  {product.pocetStranek > 0 && (
                    <SpecRow icon={<FileText className="w-4 h-4" />} label={'Po\u010det stran'} value={product.pocetStranek} />
                  )}
                  {product.format && (
                    <SpecRow icon={<Maximize2 className="w-4 h-4" />} label={'Form\u00e1t'} value={product.format} />
                  )}
                  {product.vazba && (
                    <SpecRow icon={<BookMarked className="w-4 h-4" />} label={'Vazba'} value={product.vazba} />
                  )}
                  {product.rokVydani && (
                    <SpecRow icon={<Calendar className="w-4 h-4" />} label={'Rok vyd\u00e1n\u00ed'} value={product.rokVydani} />
                  )}
                  {product.isbn && (
                    <SpecRow icon={<Hash className="w-4 h-4" />} label={'ISBN'} value={product.isbn} />
                  )}
                  {product.autori && (
                    <SpecRow icon={<User2 className="w-4 h-4" />} label={'Auto\u0159i'} value={product.autori} />
                  )}
                </div>

                {/* Doložka — highlighted block */}
                {product.dolozka && (
                  <div className="mt-3 pt-3 border-t border-[#001161]/8">
                    <div className="flex items-start gap-3 bg-[#edfaf3] rounded-[14px] px-4 py-3">
                      <CheckCircle2 className="w-4 h-4 text-[#27ae60] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-['Fenomen_Sans',sans-serif] text-[10px] uppercase tracking-[0.14em] text-[#27ae60]/70 mb-0.5 font-bold">
                          {'Dolo\u017eka M\u0160MT'}
                        </p>
                        <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/75 leading-relaxed">
                          {product.dolozka}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback badge if no doložka */}
                {!product.dolozka && (
                  <div className="mt-3 pt-3 border-t border-[#001161]/8">
                    <div className="flex items-center gap-2 text-[#001161]/30">
                      <Award className="w-3.5 h-3.5" />
                      <span className="font-['Fenomen_Sans',sans-serif] text-[11px] italic">
                        {'Dolo\u017eka M\u0160MT \u2014 informace brzy'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Matematika 2. stupeň — srovnání řad pod specifikací */}
            {isMatematika2StupenCategory(product.category) && (
              <div
                className="rounded-[20px] bg-[#eef1f7] border border-[#001161]/8 px-4 py-3.5 sm:px-5 sm:py-4 mt-4"
                role="note"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10 md:gap-12">
                  {showMat2BannerWorkbookCovers && (
                    <div
                      className="flex items-end shrink-0 mx-auto sm:mx-0"
                      style={{ minHeight: MATH2_COVER_PREVIEW_H }}
                    >
                      <Math2ComparisonCoverThumb
                        book={product}
                        onClick={() => navigate(`/produkt/${encodeURIComponent(product.id)}`)}
                        zIndex={3}
                      />
                      {mat2BannerCounterpart && (
                        <Math2ComparisonCoverThumb
                          book={mat2BannerCounterpart}
                          onClick={() =>
                            navigate(`/produkt/${encodeURIComponent(mat2BannerCounterpart.id)}`)
                          }
                          rotatedDeg={15}
                          className="-ml-7 sm:-ml-8"
                          zIndex={1}
                        />
                      )}
                    </div>
                  )}
                  <p className="font-['Fenomen_Sans',sans-serif] text-[13px] sm:text-[14px] text-[#001161] leading-relaxed m-0 flex-1 min-w-0 text-center sm:text-left">
                    Jaký je rozdíl mezi matikou <strong className="font-bold">Pro všechny</strong> a{' '}
                    <strong className="font-bold">Krok za krokem</strong>?{' '}
                    <button
                      type="button"
                      onClick={() => setMathSeriesDiffVideoOpen(true)}
                      className="text-[#4B48CC] font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer bg-transparent border-0 p-0 text-[13px] sm:text-[14px] font-['Fenomen_Sans',sans-serif]"
                    >
                      Pusťte si video
                    </button>
                    :
                  </p>
                </div>
              </div>
            )}

            {/* Balíček (KV) — jen tiskoviny v e-shopu */}
            {isPrintProduct(product) && !isDistributorMode && bundlesContainingThisProduct.length > 0 && (
              <div className="space-y-4 mt-4">
                {bundlesContainingThisProduct.map((bundle) => {
                  const ids = bundle.productIds || [];
                  const nTit = ids.length;
                  const listHaler = bundleCatalogListSumHaler(bundle, products);
                  const packHaler = Math.max(0, Math.round(bundle.bundlePriceHaler || 0));
                  const instanceProbe = 'pdp-bundle-probe';
                  const linesOk = buildBundleCartLines(products, bundle, instanceProbe).length === nTit && nTit > 0;
                  let coverCandidates: any[] = ids
                    .filter((id) => String(id) !== String(product.id))
                    .map((id) => products.find((p) => String(p.id) === String(id)))
                    .filter((p): p is any => !!p && isPrintProduct(p) && !!getProductImage(p));
                  if (coverCandidates.length === 0 && getProductImage(product)) {
                    coverCandidates = [product];
                  }
                  const coverPick = pickUpToFourSeeded(coverCandidates, `${bundle.id}:${product.id}`);
                  const fmtKc = (h: number) => `${(h / 100).toLocaleString('cs-CZ', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}\u00a0K\u010d`;

                  return (
                    <div
                      key={bundle.id}
                      className="rounded-[20px] bg-[#fff8e8] border border-[#f5d08c] px-3 py-2.5 sm:px-4 sm:py-3 shadow-[0_1px_0_rgba(180,130,40,0.06)]"
                      role="region"
                      aria-label="Zvýhodněný balíček"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                        {coverPick.length > 0 && (
                          <div className="flex items-center justify-center sm:justify-start shrink-0 mx-auto sm:mx-0 self-center sm:-translate-x-5">
                            {coverPick.map((bp, idx) => (
                              <BundleFanCoverThumb
                                key={String(bp.id)}
                                book={bp}
                                index={idx}
                                total={coverPick.length}
                                onClick={() => navigate(`/produkt/${encodeURIComponent(String(bp.id))}`)}
                                className={idx > 0 ? '-ml-[30px] sm:-ml-[34px]' : ''}
                              />
                            ))}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 text-center sm:text-left">
                          <p
                            className="font-['Fenomen_Sans',sans-serif] text-[13px] sm:text-[14px] text-[#001161] font-normal leading-snug m-0"
                          >
                            {'Tento titul si m\u016f\u017eete po\u0159\u00eddit ve zv\u00fdhodn\u011bn\u00e9m bal\u00ed\u010dku:\u00a0'}
                            <strong className="font-semibold">{bundle.title}</strong>
                            {`\u00a0: ${nTit}\u00a0${titulSkloneni(nTit)}`}
                          </p>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 sm:gap-x-2.5 gap-y-1.5 w-full min-w-0">
                            {listHaler > 0 && listHaler > packHaler && (
                              <span
                                className="font-['Fenomen_Sans',sans-serif] text-[13px] sm:text-[14px] text-[#78350f]/55 line-through"
                              >
                                {fmtKc(listHaler)}
                              </span>
                            )}
                            <span className="font-['Fenomen_Sans',sans-serif] text-[17px] sm:text-[19px] font-bold text-[#001161]">
                              {fmtKc(packHaler)}
                            </span>
                            <span className="font-['Fenomen_Sans',sans-serif] text-[10px] sm:text-[11px] uppercase tracking-wide text-[#92400e] font-normal">
                              {'cena bal\u00ed\u010dku'}
                            </span>
                            <button
                              type="button"
                              disabled={!linesOk || kvBundleAddingId === bundle.id}
                              onClick={() => handleAddKvBundleToSchoolOrder(bundle)}
                              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[12px] sm:text-[13px] font-bold text-white bg-[#001161] hover:bg-[#000a3d] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer border-0 min-w-0 text-center"
                            >
                              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                              {'P\u0159idat do objedn\u00e1vky'}
                            </button>
                            <Link
                              to={`/balicek/${encodeURIComponent(bundle.id)}`}
                              className="inline-flex items-center justify-center py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[12px] sm:text-[13px] font-normal text-[#92400e] underline underline-offset-2 hover:opacity-90 border border-[#d97706]/35 bg-white/90 whitespace-nowrap"
                            >
                              {'V\u00edce o akci'}
                            </Link>
                          </div>
                          {!linesOk && (
                            <p className="text-[11px] text-[#9a3412] m-0">
                              {'Bal\u00ed\u010dek te\u010d nejde p\u0159idat do ko\u0161\u00edku \u2014 chyb\u00ed produkt v katalogu nebo varianta.'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Obsah sešitu — same style as Specifikace */}
            {product.obsah?.trim() && (() => {
              const items = parseObsah(product.obsah);
              return (
                <div className="rounded-[24px] bg-[#f8f9fc] p-5 mt-4">
                  <p className="font-['Fenomen_Sans',sans-serif] text-[11px] uppercase tracking-[0.15em] text-[#001161]/35 mb-1 font-bold">
                    {'Obsah se\u0161itu'}
                  </p>
                  <div>
                    {items.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 py-3 border-b border-[#001161]/6">
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded-[5px] flex items-center justify-center text-white text-[10px] font-bold mt-0.5"
                          style={{ background: '#FF9900', fontFamily: "'Fenomen Sans', sans-serif" }}
                        >
                          {item.number}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold text-[#001161] leading-snug">
                            {item.title}
                          </span>
                          {item.note && (
                            <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 ml-2 leading-snug">
                              {item.note}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA footer — uvnitř obsah bloku */}
                  <div className="mt-3 pt-3 border-t border-[#001161]/6 flex flex-col gap-2.5">
                    <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }} className="text-[12px] text-[#001161]/45 leading-relaxed">
                      {'Cel\u00fd se\u0161it m\u016f\u017eete prolistovat v\u00a0PDF i vyzkou\u0161et interaktivn\u00ed cvi\u010den\u00ed v\u00a0na\u0161\u00ed aplikaci.'}
                    </p>
                    <div className="flex gap-2">
                      {/* Mám přístup */}
                      <a
                        href={product.appLink || 'https://app.vividbooks.cz'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] font-semibold text-[#001161] no-underline transition-all hover:bg-[#001161]/8 active:scale-[0.98] text-center border border-[#001161]/15 bg-white"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: '12px' }}
                      >
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                        {'M\u00e1m p\u0159\u00edstup'}
                      </a>
                      {/* Vyzkoušet zdarma */}
                      <button
                        onClick={() => navigate('/vyzkousejte')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] font-semibold text-[#7C3AED] transition-all hover:bg-[#7C3AED]/8 active:scale-[0.98] cursor-pointer text-center border border-[#7C3AED]/20 bg-[#7C3AED]/5"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: '12px' }}
                      >
                        <Sparkles className="w-3 h-3 shrink-0 opacity-70" />
                        {'Vyzkouse\u0301t zdarma'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      {/* ── Flipbook section (always visible if no modal) ── */}
      {hasFlipbook && !isHeyzine && (
        <div className="max-w-[1200px] mx-auto px-6 mt-16">
          <div className="rounded-[32px] overflow-hidden border border-[#001161]/8" style={{ height: '600px' }}>
            <iframe
              src={flipbookUrl}
              className="w-full h-full border-none"
              title="Uk\u00e1zka"
              allow="fullscreen; clipboard-read; clipboard-write"
            />
          </div>
        </div>
      )}

      {/* ── Related products ── */}
      {allRelated.length > 0 && (
        <div className="mt-20 pb-24">
          {/* Section header */}
          <div className="max-w-[1200px] mx-auto px-6 mb-6 flex items-start justify-between gap-4 flex-wrap">
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[38px]">
              Další tituly z{'\u00a0'}předmětu
            </h2>
            <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/40 shrink-0 mt-3">
              {relatedFinal.length} titulů
            </span>
          </div>

          {showRelatedFilterPills && (
            <div className="max-w-[1200px] mx-auto px-6 mb-5 flex flex-col gap-3">
              {(isMath || relatedRocnikOptions.length > 1) && (
                <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-2.5">
                  <span className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40 shrink-0 pt-0.5">
                    {'Ro\u010dn\u00edky'}
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {relatedRocnikOptions.map((r) => {
                      const on = relatedRocnikFilter === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            if (relatedRocnikFilter === r) {
                              setRelatedRocnikFilter(null);
                            } else {
                              setRelatedRocnikFilter(r);
                              setRelatedRadaFilter(null);
                            }
                          }}
                          className={`px-[14px] py-[7px] rounded-full font-['Fenomen_Sans',sans-serif] text-[15.6px] font-normal leading-tight transition-colors cursor-pointer border-0 ${
                            on
                              ? 'bg-[#001161] text-white'
                              : 'bg-[#eef2fb] text-[#001161]/75 hover:bg-[#e2e8f4] hover:text-[#001161]'
                          }`}
                        >
                          {r}
                          {'. ro\u010dn\u00edk'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(isMath || relatedRadaOptions.length > 1) && (
                <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-2.5">
                  <span className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40 shrink-0 pt-0.5">
                    {'\u0158ada'}
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {relatedRadaOptions.map((k) => {
                      const on = relatedRadaFilter === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            if (relatedRadaFilter === k) {
                              setRelatedRadaFilter(null);
                            } else {
                              setRelatedRadaFilter(k);
                              setRelatedRocnikFilter(null);
                            }
                          }}
                          className={`px-[14px] py-[7px] rounded-full font-['Fenomen_Sans',sans-serif] text-[15.6px] font-normal leading-tight transition-colors cursor-pointer border-0 ${
                            on
                              ? 'bg-[#001161] text-white'
                              : 'bg-[#eef2fb] text-[#001161]/75 hover:bg-[#e2e8f4] hover:text-[#001161]'
                          }`}
                        >
                          {RELATED_RADA_LABELS[k]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(relatedRocnikFilter != null || relatedRadaFilter != null) && (
                <button
                  type="button"
                  onClick={() => {
                    setRelatedRocnikFilter(null);
                    setRelatedRadaFilter(null);
                  }}
                  className="font-['Fenomen_Sans',sans-serif] text-[14.4px] text-[#001161]/45 hover:text-[#001161] underline underline-offset-2 self-start cursor-pointer bg-transparent border-0 p-0"
                >
                  Zrušit filtry
                </button>
              )}
            </div>
          )}

          {/* Mřížka titulů (jako katalog) */}
          <div className="max-w-[1200px] mx-auto px-6 pb-6">
            {relatedFinal.length === 0 ? (
              <div className="w-full py-10 px-4 text-center">
                <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/55 mb-3">
                  Žádný titul neodpovídá zvoleným filtrům.
                </p>
                {(relatedRocnikFilter != null || relatedRadaFilter != null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRelatedRocnikFilter(null);
                      setRelatedRadaFilter(null);
                    }}
                    className="font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161] underline underline-offset-2 cursor-pointer bg-transparent border-0"
                  >
                    Zrušit filtry
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10 justify-items-stretch">
                {relatedFinal.map((p) => (
                  <UnifiedBookCard
                    key={p.id}
                    book={p}
                    onClick={() => onProductSelect?.(p)}
                    variant="catalog"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Nadpis + Tabs slider (pro Fyziku, Chemii, Přírodopis, Matematiku, Prvouku) ── */}
      {(() => {
        const baseSubject = (product.category || '').replace(/[\s\-]+\d+\.?\s*stupe.*$/i, '').trim();
        const isAllowedSubject = isMath || ['Fyzika', 'Chemie', 'Přírodopis', 'Prvouka'].includes(baseSubject);
        if (!isAllowedSubject) return null;
        return (
          <>
            <div className="px-6 md:px-12 pt-14 pb-6 bg-[#fafbfe]">
              <div className="max-w-[1200px] mx-auto flex flex-col gap-2">
                <h2
                  className="leading-tight max-w-[720px]"
                  style={{ fontFamily: "'Cooper Light', serif", fontSize: 'clamp(28px, 4vw, 38px)', color: '#001161' }}
                >
                  {'Učebnice jako ekosystém: '}
                  <span style={{ color: 'rgba(0,17,97,0.45)' }}>
                    {'Nabízíme komplexní digitální přístup pro celou školu, vše co učitelé a žáci potřebují v jedné aplikaci.'}
                  </span>
                </h2>
              </div>
            </div>
            <SubjectTabsSection subject={getTabSubjectName(product.category)} displayName={baseSubject} light={true} />
            {(() => {
              const cat = (product.category || '').toLowerCase();
              const isMat2 = baseSubject === 'Matematika' && (cat.includes('2') || cat.includes('druh'));
              const isMat1OrPrvouka = baseSubject === 'Prvouka' || (baseSubject === 'Matematika' && !isMat2);

              if (isMat2) {
                const mat2OnlineProduct = products.find(
                  p => p.type === 'online' && (p.category || '').toLowerCase().includes('matematika') && (p.category || '').includes('2')
                );
                const handleMat2Digital = () => {
                  if (mat2OnlineProduct) {
                    navigate(`/produkt/${encodeURIComponent(mat2OnlineProduct.id)}`);
                  } else {
                    navigate('/predmet/matematika-2-stupen');
                  }
                };
                return (
                  <div className="px-6 md:px-12 py-6 bg-[#fafbfe]">
                    <div className="max-w-[1200px] mx-auto">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-3 bg-[#fff8ec] border border-[#f5a623]/30 rounded-2xl px-5 py-4 flex-1">
                          <span className="text-[22px]">🏫</span>
                          <div style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}>
                            <p className="text-[13px] font-black uppercase tracking-wide opacity-50 mb-0.5">Pro školy</p>
                            <p className="text-[14px] md:text-[15px] leading-snug">
                              Digitální přístup pro celou třídu — <strong>zdarma od&nbsp;15&nbsp;ks</strong>.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 bg-[#f0edff] border border-[#7C3AED]/20 rounded-2xl px-5 py-4 flex-1">
                          <span className="text-[22px] mt-0.5">👨‍👩‍👧</span>
                          <div className="flex flex-col gap-3" style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}>
                            <div>
                              <p className="text-[13px] font-black uppercase tracking-wide opacity-50 mb-0.5">Pro rodiče</p>
                              <p className="text-[14px] md:text-[15px] leading-snug">
                                Předplaťte digitální přístup svému dítěti za&nbsp;<strong>299&nbsp;Kč&nbsp;/&nbsp;měsíc</strong>.
                              </p>
                            </div>
                            <button
                              onClick={handleMat2Digital}
                              className="self-start px-4 py-2 text-[13px] font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.97] transition-all cursor-pointer"
                              style={{ fontFamily: "'Fenomen Sans', sans-serif", borderRadius: '14px' }}
                            >
                              Získat digitální přístup
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isMat1OrPrvouka) return (
                <div className="px-6 md:px-12 py-6 bg-[#fafbfe]">
                  <div className="max-w-[1200px] mx-auto">
                    <div className="flex items-center gap-3 bg-[#fff8ec] border border-[#f5a623]/30 rounded-2xl px-5 py-4 w-fit">
                      <span className="text-[22px]">🏫</span>
                      <p
                        className="text-[14px] md:text-[15px] leading-snug"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif", color: '#001161' }}
                      >
                        Digitální přístup je určen pro <strong>školy</strong> — dostupný od objednávky <strong>15&nbsp;ks</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              );

              return null;
            })()}
          </>
        );
      })()}

      {/* ── Digitální přístup porovnání ── */}
      {COMPARISON_SUBJECTS.includes((product.category || '').replace(/\s+\d+\.\s*stupe.*$/i, '').trim()) && (() => {
        const baseSubject = (product.category || '').replace(/\s+\d+\.\s*stupe.*$/i, '').trim();
        const subjectWorkbooks = products
          .filter(p => (p.category || '').replace(/\s+\d+\.\s*stupe.*$/i, '').trim() === baseSubject && p.type === 'workbook' && p.image)
          .slice(0, 4);
        return (
          <div className="pt-10 pb-0 px-6 md:px-12 bg-[#fafbfe]">
            <div className="max-w-[1200px] mx-auto">
              {['Fyzika', 'Chemie', 'Přírodopis'].includes(baseSubject) ? (
                <FyzikaAccessJourney onOrder={onOrder} compact={true} subject={baseSubject} />
              ) : (
                <DigitalAccessComparison
                  subject={baseSubject}
                  workbooks={subjectWorkbooks}
                  onOrder={onOrder}
                  compact={true}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CTA tlačítka (pro Fyziku, Chemii, Přírodopis) ── */}
      {(() => {
        const baseSubject = (product.category || '').replace(/[\s\-]+\d+\.?\s*stupe.*$/i, '').trim();
        const isAllowedSubject2 = isMath || ['Fyzika', 'Chemie', 'Přírodopis', 'Prvouka'].includes(baseSubject);
        if (!isAllowedSubject2) return null;
        const subjectSlug = subjectToSlug(product.category);
        return (
          <div className="bg-[#fafbfe] px-6 md:px-12 py-12">
            <div className="max-w-[1200px] mx-auto flex justify-center flex-wrap gap-4">
              <button
                onClick={() => navigate(`/predmet/${subjectSlug}`)}
                className="px-10 py-3.5 text-[16px] font-bold border-2 border-[#001161] text-[#001161] hover:bg-[#001161] hover:text-white transition-all cursor-pointer"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", borderRadius: '14px' }}
              >
                Více o předmětu
              </button>
              <button
                onClick={() => navigate('/vyzkousejte')}
                className="px-10 py-3.5 text-[16px] font-bold text-white hover:opacity-90 transition-all cursor-pointer"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", background: '#7C3AED', borderRadius: '14px' }}
              >
                Vyzkoušet zdarma
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Flipbook modal — rendered via portal to escape transform contexts ── */}
      {createPortal(
        <AnimatePresence>
          {flipbookOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
              onClick={() => setFlipbookOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

              {/* Lightbox container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                className="relative z-10 flex flex-col bg-white rounded-[24px] overflow-hidden shadow-2xl w-full max-w-5xl"
                style={{ height: 'min(82vh, 780px)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#001161]/5 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-[#001161]" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-[#001161] font-['Fenomen_Sans',sans-serif] leading-tight">{product.name}</p>
                      <p className="text-[11px] text-gray-400">{'Uk\u00e1zka publikace'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={flipbookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-500 hover:text-[#001161] hover:bg-gray-50 rounded-lg transition-colors font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {'Otev\u0159\u00edt v okn\u011b'}
                    </a>
                    <button
                      onClick={() => setFlipbookOpen(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* iframe */}
                <div className="flex-1 overflow-hidden bg-gray-50">
                  <iframe
                    src={flipbookUrl}
                    className="w-full h-full border-none"
                    title="Flipbook"
                    allow="fullscreen; clipboard-read; clipboard-write; gyroscope; encrypted-media; picture-in-picture"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {mathSeriesDiffVideoOpen && (
              <motion.div
                key="pdp-math-diff-yt"
                role="dialog"
                aria-modal="true"
                aria-label="Video: rozd\u00edl mezi \u0159adami"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-8"
                onClick={() => setMathSeriesDiffVideoOpen(false)}
              >
                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 16 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="relative z-10 w-full max-w-[min(100%,960px)] rounded-2xl overflow-hidden bg-[#0a0a0a] shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#001161] text-white">
                    <span className="text-[13px] sm:text-[14px] font-semibold font-['Fenomen_Sans',sans-serif]">
                      {'Rozd\u00edl: Pro v\u0161echny vs. Krok za krokem'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMathSeriesDiffVideoOpen(false)}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      aria-label="Zav\u0159\u00edt"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="relative w-full aspect-video bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${MATH_SERIES_DIFF_YOUTUBE_ID}?rel=0&modestbranding=1&autoplay=1`}
                      className="absolute inset-0 w-full h-full border-0"
                      title="Rozd\u00edl mezi Pro v\u0161echny a Krok za krokem"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </motion.div>
  );
}