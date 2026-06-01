import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router';
import { TopNav } from './TopNav';
import { UnifiedBookCard } from './UnifiedBookCard';
import { ImageWithFallback } from './figma/ImageWithFallback';
import digitalSeriesImg from 'figma:asset/cf223de1d9c5d972540d939e1fb808679daac389.png';
import { SUBJECT_CONFIGS, type SubjectConfig } from './subjectConfigs';
import { SEOHead, breadcrumbJsonLd, faqJsonLd } from './SEOHead';
import { buildOgImageAlt, resolveShareImageUrl } from '../utils/ogImage';
import { marketingUrl } from '../config/marketingSite';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { subjectToSlug } from '../utils/slugify';
import { DigitalAccessComparison, COMPARISON_SUBJECTS } from './DigitalAccessComparison';
import {
  FyzikaAccessJourney,
  DIGITAL_ACCESS_TYPES_INTRO_TITLE,
  DIGITAL_ACCESS_TYPES_INTRO_BODY,
  COOPER_ACCESS_INTRO_HEADING_STYLE,
  COOPER_ACCESS_INTRO_MUTED_STYLE,
} from './FyzikaAccessJourney';
import { SubjectTabsSection } from './SubjectTabsSection';
import { ProductComplianceBadge, subjectShowsMsmtDolozkaBadge } from './ProductComplianceBadge';
import { SubjectWebinarsSlider } from './SubjectWebinarsSlider';
import { SubjectMethodPrinciplesSection } from './SubjectMethodPrinciplesSection';
import type { SubjectMethodPrinciple } from '../data/subjectMethodPrinciples';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

const MATH_SERIES_DIFF_YOUTUBE_ID = '3QfBy-xJ4Os';

/** Hodnoty `typ` v URL — odpovídají filtru řad (Matematika 2. stupeň). */
type SeriesFilterId = 'all' | 'krok' | 'pro-vsechny' | 'digital';
const SERIES_TYP_PARAMS = new Set(['krok', 'pro-vsechny', 'digital']);

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const formatTypography = (text: string) => {
  if (!text) return '';
  return text
    .replace(/(\b[vszkuoia])\s+/gi, '$1\u00A0')
    .replace(/(\d+\.?)\s+/g, '$1\u00A0');
};

/** Ročník z pole produktu nebo z názvu (stejná logika jako u souvisejících titulů na PDP). */
function subjectPageExtractRocnik(p: { name?: string; rocnik?: string | number }): string | null {
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

/** Díl z názvu (1. díl, 2. díl …). */
function subjectPageExtractPart(p: { name?: string }): number {
  const m = (p?.name || '').match(/(\d+)\.\s*d[ií]l/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Ročník pro řazení — preferuje „pro X. ročník“ v názvu, nepoužívá `poradi` (bývá pořadí v DB, ne ročník). */
function subjectPageSortGrade(p: { name?: string; rocnik?: string | number }): number {
  const name = p?.name || '';
  const fromName =
    name.match(/pro\s+(\d+)\.\s*ro/i)?.[1]
    ?? name.match(/(\d+)\.\s*ro[cč]n[ií]k/i)?.[1]
    ?? name.match(/matematika\s+(\d+)\./i)?.[1]
    ?? subjectPageExtractRocnik(p);
  const parsed = parseInt(String(fromName ?? ''), 10);
  return Number.isNaN(parsed) ? 99 : parsed;
}

function subjectPageSortByRocnik(a: { name?: string; rocnik?: string | number }, b: { name?: string; rocnik?: string | number }): number {
  const ga = subjectPageSortGrade(a);
  const gb = subjectPageSortGrade(b);
  if (ga !== gb) return ga - gb;
  const pa = subjectPageExtractPart(a);
  const pb = subjectPageExtractPart(b);
  if (pa !== pb) return pa - pb;
  return String(a.name || '').localeCompare(String(b.name || ''), 'cs');
}

/** Text vedle odznaků RVP/MŠMT — ročníky / stupeň (Matematika podle URL). */
function subjectHeroRocnikLabel(
  baseSubject: string,
  subjectGradeNum: string | null,
  cfg: SubjectConfig,
): string | null {
  if (baseSubject === 'Matematika') {
    if (subjectGradeNum === '1') {
      return 'pro 1.\u20132. ro\u010dn\u00edk, dal\u0161\u00ed ve v\u00fdrob\u011b';
    }
    if (subjectGradeNum === '2') {
      return 'pro 6. \u2013 9. ro\u010dn\u00edk';
    }
  }
  if (cfg.heroRocnikLine) return cfg.heroRocnikLine;
  if (cfg.grades.length === 0) return null;
  if (cfg.grades.length === 1) return `Pro ${cfg.grades[0]}`;
  return `Pro ${cfg.grades[0]} \u2013 ${cfg.grades[cfg.grades.length - 1]}`;
}

// Maps subject page subject string → tab subject name in Supabase
const getTabSubjectName = (subject: string): string => {
  const s = subject.toLowerCase();
  if (s.includes('matematika') && (s.includes('1') || s.includes('první'))) return 'Matematika 1';
  if (s.includes('matematika') && (s.includes('2') || s.includes('druhý'))) return 'Matematika 2';
  if (s.includes('matematika')) return 'Matematika 1';
  return subject.replace(/\s+\d+\.\s*stupe.*$/i, '').trim();
};

/* hook pro šířku okna */
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

/* ─────────────────────────────────────────────
   Book card
───────────────────────────────────────────── */
function BookCard({ book, onClick }: { book: any; onClick?: () => void }) {
  return <UnifiedBookCard book={book} onClick={onClick} variant="catalog" />;
}

/* ──────────────────────────────────────────
   Tab Content Section
───────────────────────────────────────────── */
function TabsSection({ subject, displayName, bg }: { subject: string; displayName: string; bg: string }) {
  const [tabs, setTabs] = useState<any[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const windowWidth = useWindowWidth();
  const wide = windowWidth >= 1300;
  const mobile = windowWidth < 768;

  useEffect(() => {
    const tabSubject = getTabSubjectName(subject);
    setLoading(true);
    fetch(`${SERVER}/public/tabs?subject=${encodeURIComponent(tabSubject)}`, { headers: AUTH })
      .then(r => r.json())
      .then(d => {
        const items = d.items || [];
        setTabs(items);
        if (items.length > 0) setActiveTabId(items[0].id);
      })
      .catch(() => setTabs([]))
      .finally(() => setLoading(false));
  }, [subject]);

  // Reset expanded when switching tab on mobile
  useEffect(() => { setMobileExpanded(false); }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId);

  if (loading) {
    return (
      <div style={{ background: bg }} className="w-full py-16 px-6 md:px-12 flex items-center justify-center min-h-[240px]">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-[#001161]/20 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (tabs.length === 0) return null;

  const cardBg = activeTab?.bgColor || '#ffffff';

  /* ─── MOBILNÍ LAYOUT ─── */
  if (mobile) {
    return (
      <div style={{ background: bg }} className="w-full py-10 px-6">
        <h2
          className="text-[#001161] leading-tight mb-6 text-[24px]"
          style={{ fontFamily: "'Cooper Light', serif" }}
        >
          Co vše obsahuje naše {displayName}?
        </h2>

        {/* Horizontální slider chipů */}
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className="shrink-0 px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-all cursor-pointer"
              style={{
                fontFamily: "'Fenomen Sans', sans-serif",
                fontWeight: activeTabId === tab.id ? 700 : 400,
                background: activeTabId === tab.id ? '#F9E000' : 'rgba(0,17,97,0.07)',
                color: activeTabId === tab.id ? '#001161' : 'rgba(0,17,97,0.55)',
                borderRadius: '999px',
                border: 'none',
              }}
            >
              {tab.tabText}
            </button>
          ))}
        </div>

        {/* Karta aktivního tabu */}
        {activeTab && (
          <motion.div
            key={activeTab.id}
            className="mt-4 rounded-[24px] overflow-hidden"
            style={{ background: cardBg }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Obrázek nahoře — plná šířka */}
            {activeTab.contentImage && (
              <div className="w-full" style={{ maxHeight: '240px', overflow: 'hidden' }}>
                <img
                  src={activeTab.contentImage}
                  alt={activeTab.contentHeadline || activeTab.tabText}
                  className="w-full object-cover object-top"
                  style={{ maxHeight: '240px' }}
                />
              </div>
            )}

            {/* Spodní část — nadpis + tlačítko */}
            <div className="p-5">
              {activeTab.contentHeadline && (
                <h3
                  className="text-[#001161] text-[22px] leading-tight mb-3"
                  style={{ fontFamily: "'Cooper Light', serif" }}
                >
                  {activeTab.contentHeadline}
                </h3>
              )}

              {activeTab.contentRichText && (
                <>
                  <motion.div
                    className="overflow-hidden"
                    initial={false}
                    animate={{ height: mobileExpanded ? 'auto' : 0, opacity: mobileExpanded ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div
                      className="text-[#001161]/70 text-[14px] leading-relaxed whitespace-pre-line pb-3"
                      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    >
                      {activeTab.contentRichText}
                    </div>
                  </motion.div>

                  <button
                    onClick={() => setMobileExpanded(p => !p)}
                    className="inline-flex items-center gap-1.5 text-[#001161] text-[13px] font-bold cursor-pointer transition-opacity hover:opacity-70"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    {mobileExpanded ? 'Méně info' : 'Více info'}
                    <svg
                      className="w-3.5 h-3.5 transition-transform"
                      style={{ transform: mobileExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  /* ─── DESKTOP / TABLET LAYOUT ─── */
  return (
    <div style={{ background: bg }} className="w-full py-14 px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto" style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', gap: wide ? '56px' : '28px', alignItems: 'flex-start' }}>

        {/* Left menu */}
        <div style={{ width: wide ? '240px' : '100%', flexShrink: 0 }}>
          <h2
            className="text-[#001161] leading-tight mb-8"
            style={{ fontFamily: "'Cooper Light', serif", fontSize: wide ? '30px' : '26px' }}
          >
            Co vše obsahuje naše {displayName}?
          </h2>
          <nav style={{ display: 'flex', flexDirection: wide ? 'column' : 'row', flexWrap: 'wrap', gap: wide ? '2px' : '6px' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className="text-left px-4 py-2.5 transition-all cursor-pointer"
                style={{
                  fontFamily: "'Fenomen Sans', sans-serif",
                  fontSize: '15px',
                  fontWeight: activeTabId === tab.id ? 700 : 400,
                  background: activeTabId === tab.id ? '#F9E000' : 'transparent',
                  color: activeTabId === tab.id ? '#001161' : 'rgba(0,17,97,0.5)',
                  borderRadius: '999px',
                }}
              >
                {tab.tabText}
              </button>
            ))}
          </nav>
        </div>

        {/* Right content card */}
        {activeTab && (
          <motion.div
            key={activeTab.id}
            className="flex-1 rounded-[32px] flex flex-row overflow-hidden"
            style={{ background: cardBg, minHeight: '450px' }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Text — levá polovina */}
            <div
              className="p-8 md:p-10 overflow-y-auto"
              style={{ width: '50%', flexShrink: 0, minWidth: 0 }}
            >
              {activeTab.contentHeadline && (
                <h3
                  className="text-[#001161] text-[26px] md:text-[32px] leading-tight mb-5"
                  style={{ fontFamily: "'Cooper Light', serif" }}
                >
                  {activeTab.contentHeadline}
                </h3>
              )}
              {activeTab.contentRichText && (
                <div
                  className="text-[#001161]/70 text-[15px] leading-relaxed whitespace-pre-line"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                >
                  {activeTab.contentRichText}
                </div>
              )}
            </div>

            {/* Obrázek — pravá polovina, zarovnáno nahoru vlevo */}
            {activeTab.contentImage && (
              <div
                className="overflow-hidden self-stretch"
                style={{ width: '50%', flexShrink: 0 }}
              >
                <img
                  src={activeTab.contentImage}
                  alt={activeTab.contentHeadline || activeTab.tabText}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left', display: 'block' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export type SubjectHeroMeta = {
  /** Jeden blok z adminu (Předměty → Hero text); má přednost před nadpis/text zvlášť. */
  heroText?: string;
  authorIntroHeading?: string;
  authorIntroBody?: string;
  /** FAQ z /public/predmet (admin → Předměty). */
  faqs?: { question: string; answer: string }[];
  /** Metodické principy z CMS; neprázdné pole má přednost před statickou šablonou. */
  methodPrinciplesItems?: SubjectMethodPrinciple[];
} | null;

interface SubjectPageProps {
  subject: string;
  products: any[];
  /** Z /public/predmet – úvod autora; undefined = načítá se / nepředáno, null = v API záznam není */
  subjectHeroMeta?: SubjectHeroMeta | undefined;
  onBack: () => void;
  onOrder?: () => void;
  onProductClick?: (product: any) => void;
  hideTopNav?: boolean;
}

export function SubjectPage({
  subject,
  products,
  subjectHeroMeta,
  onBack,
  onOrder,
  onProductClick,
  hideTopNav = false,
}: SubjectPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseSubject = subject.replace(/\s+\d+\.\s*stupe.*$/i, '').trim();
  const gradeNumMatch = subject.match(/(\d+)\.\s*stupe/i);
  const subjectGradeNum = gradeNumMatch ? gradeNumMatch[1] : null;

  const cfg = SUBJECT_CONFIGS[baseSubject] || SUBJECT_CONFIGS['Matematika'];

  /* Hero: primárně jedno pole heroText (operátor), jinak pár nadpis + text z API/configu. */
  const fromApi = subjectHeroMeta && typeof subjectHeroMeta === 'object';
  const apiHeroText = fromApi ? String(subjectHeroMeta.heroText ?? '').trim() : '';
  const apiIntroB = fromApi ? String(subjectHeroMeta.authorIntroBody ?? '').trim() : '';
  const cfgHeroText = String(cfg.heroText ?? '').trim();
  const cfgIntroB = String(cfg.authorIntroBody ?? '').trim();

  const combinedHeroRaw = apiHeroText || cfgHeroText;
  let heroBody = '';
  if (combinedHeroRaw) {
    // Hero text from admin is treated as one full expandable block.
    heroBody = combinedHeroRaw;
  } else {
    heroBody = apiIntroB || cfgIntroB;
  }

  /** Rozklikávací řádek v hero — vždy stejná šablona podle předmětu. */
  const heroIntroLabel = `\u010c\u00edm je ${cfg.heroTeaserOurWord} ${cfg.displayName} unik\u00e1tn\u00ed? \u00davodn\u00ed slovo autora:`;
  const hasRealHeroBody = !!String(heroBody || '').trim();
  const heroIntroExpandedText = heroBody;
  const showAuthorIntro = hasRealHeroBody;

  const subjectProducts = products.filter(p => {
    const cat = (p.category || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const baseKey = baseSubject.toLowerCase().split(' ')[0];
    // 'krok za krokem' fallback only for Matematika where category may differ
    const krokFallback = baseKey === 'matematika' && name.includes('krok za krokem');
    const nameMatch = cat.includes(baseKey) || name.includes(baseKey) || krokFallback;
    if (!nameMatch) return false;
    if (subjectGradeNum) {
      const gn = subjectGradeNum;
      // handles: "Matematika 2. stupeň", "Matematika 2", "Matematika-2", bare numeric suffix
      return (
        cat.includes(gn + '. stupe') ||
        cat.includes(gn + '.stupe') ||
        cat.endsWith(' ' + gn) ||
        cat.endsWith('-' + gn) ||
        cat === baseKey + ' ' + gn ||
        cat === baseKey + '-' + gn
      );
    }
    return true;
  });

  /* Přepínání řad jen pro Matematiku 2. stupeň — musí být před odvozením filtrů z URL. */
  const showSeriesPanels = baseSubject === 'Matematika' && subjectGradeNum === '2';

  const [mathDiffVideoOpen, setMathDiffVideoOpen] = useState(false);
  const [heroIntroOpen, setHeroIntroOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const rocnikParam = searchParams.get('rocnik');
  const typParam = searchParams.get('typ');

  const subjectRocnikOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of subjectProducts) {
      const r = subjectPageExtractRocnik(p);
      if (r) s.add(r);
    }
    return Array.from(s).sort((a, b) => Number(a) - Number(b));
  }, [subjectProducts]);

  const subjectRocnikFilter = useMemo(() => {
    if (!rocnikParam) return null;
    if (subjectRocnikOptions.length === 0) return null;
    return subjectRocnikOptions.includes(rocnikParam) ? rocnikParam : null;
  }, [rocnikParam, subjectRocnikOptions]);

  const activeSeries: SeriesFilterId = useMemo(() => {
    if (!showSeriesPanels) return 'all';
    if (typParam && SERIES_TYP_PARAMS.has(typParam)) {
      return typParam as Exclude<SeriesFilterId, 'all'>;
    }
    return 'all';
  }, [typParam, showSeriesPanels]);

  const prevSubjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSubjectRef.current !== null && prevSubjectRef.current !== subject) {
      setSearchParams({}, { replace: true });
    }
    prevSubjectRef.current = subject;
  }, [subject, setSearchParams]);

  useEffect(() => {
    const r = searchParams.get('rocnik');
    if (!r || subjectRocnikOptions.length === 0) return;
    if (!subjectRocnikOptions.includes(r)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('rocnik');
        return next;
      }, { replace: true });
    }
  }, [subjectRocnikOptions, searchParams, setSearchParams]);

  useEffect(() => {
    if (showSeriesPanels || !searchParams.get('typ')) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('typ');
      return next;
    }, { replace: true });
  }, [showSeriesPanels, searchParams, setSearchParams]);

  const toggleRocnik = (r: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const cur = prev.get('rocnik');
      if (cur === r) next.delete('rocnik');
      else next.set('rocnik', r);
      return next;
    }, { replace: true });
  };

  const clearRocnikFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('rocnik');
      return next;
    }, { replace: true });
  };

  const toggleSeries = (id: 'krok' | 'pro-vsechny' | 'digital') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const cur = prev.get('typ');
      if (cur === id) next.delete('typ');
      else next.set('typ', id);
      return next;
    }, { replace: true });
  };

  const clearSeriesFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('typ');
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (!mathDiffVideoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMathDiffVideoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mathDiffVideoOpen]);

  const matchesSeries = (p: any) => {
    if (activeSeries === 'all') return true;
    const n = (p.name || '').toLowerCase();
    if (activeSeries === 'krok') return n.includes('krok za krokem');
    if (activeSeries === 'digital') return p.type === 'online';
    if (activeSeries === 'pro-vsechny') return p.type !== 'online' && !n.includes('krok za krokem');
    return true;
  };

  const matchesGrade = (p: any, grade: string) => {
    const cat = (p.category || '').toLowerCase();
    const gradeNum = grade.match(/(\d+)/)?.[1];
    if (!gradeNum) return true;
    return (
      cat.includes(gradeNum + '. stupe') ||
      cat.includes(gradeNum + '.stupe') ||
      cat.endsWith(' ' + gradeNum) ||
      cat.endsWith('-' + gradeNum)
    );
  };

  const matchesSubjectRocnik = (p: any) =>
    subjectRocnikFilter == null || subjectPageExtractRocnik(p) === subjectRocnikFilter;

  const afterRocnikPool = subjectProducts.filter(matchesSubjectRocnik);

  const filteredBooks = afterRocnikPool
    .filter(p => showSeriesPanels ? matchesSeries(p) : true)
    .sort(subjectPageSortByRocnik);

  /** Matematika 2. st.: při „Vše“ zobrazit řady jako samostatné bloky (nadpis + mřížka), ne jednu smíšenou mřížku. */
  const mathSeriesBlocks =
    showSeriesPanels && activeSeries === 'all'
      ? (() => {
          const pool = afterRocnikPool;
          const digital = pool.filter((p: any) => p.type === 'online').sort(subjectPageSortByRocnik);
          const offline = pool.filter((p: any) => p.type !== 'online');
          const nameLo = (p: any) => (p.name || '').toLowerCase();
          const krok = offline
            .filter((p: any) => nameLo(p).includes('krok za krokem'))
            .sort(subjectPageSortByRocnik);
          const proVsechny = offline
            .filter((p: any) => !nameLo(p).includes('krok za krokem'))
            .sort(subjectPageSortByRocnik);
          return [
            { key: 'pro-vsechny' as const, title: 'Pro v\u0161echny', books: proVsechny },
            { key: 'krok' as const, title: 'Krok za krokem', books: krok },
            { key: 'digital' as const, title: 'Digit\u00e1ln\u00ed p\u0159\u00edstup', books: digital },
          ].filter((b) => b.books.length > 0);
        })()
      : null;

  const isMultiGrade = cfg.grades.length > 1 && !subjectGradeNum;
  const gradeOrder = ['2. stupe\u0148', '1. stupe\u0148'];
  const booksByGrade = isMultiGrade && activeSeries === 'all'
    ? gradeOrder.map(g => ({
        grade: g,
        books: afterRocnikPool.filter(p => matchesGrade(p, g)).sort(subjectPageSortByRocnik),
      })).filter(g => g.books.length > 0)
    : null;

  const krokBooks = subjectProducts.filter(p => (p.name || '').toLowerCase().includes('krok za krokem') && p.image).slice(0, 3);
  const proVsechnyBooks = subjectProducts.filter(p => p.type !== 'online' && !(p.name || '').toLowerCase().includes('krok za krokem') && p.image).slice(0, 3);
  const digitalBooks = subjectProducts.filter(p => p.type === 'online' && p.image).slice(0, 3);

  const showComparison = ['Fyzika', 'Chemie', 'P\u0159\u00edrodopis'].includes(subject);
  /** ČJ — metodické principy zatím nezobrazujeme (požadavek obsahu). */
  const showMethodPrinciples = baseSubject !== '\u010cesk\u00fd jazyk';
  const showMsmtSubjectBadge = subjectShowsMsmtDolozkaBadge(baseSubject);

  const heroRocnikLabel = subjectHeroRocnikLabel(baseSubject, subjectGradeNum, cfg);
  const seoTitle =
    baseSubject === 'Matematika' && subjectGradeNum
      ? `${cfg.displayName} ${subjectGradeNum}. stupe\u0148`
      : cfg.displayName;
  const workbooks = subjectProducts.filter(p => p.type === 'workbook' && p.image).slice(0, 4);

  const subjectFaqs: { question: string; answer: string }[] =
    subjectHeroMeta && typeof subjectHeroMeta === 'object' && Array.isArray(subjectHeroMeta.faqs)
      ? subjectHeroMeta.faqs.filter(f => f.question?.trim() && f.answer?.trim())
      : [];

  const cmsMethodPrinciples: SubjectMethodPrinciple[] | undefined =
    subjectHeroMeta &&
    typeof subjectHeroMeta === 'object' &&
    Array.isArray(subjectHeroMeta.methodPrinciplesItems) &&
    subjectHeroMeta.methodPrinciplesItems.length > 0
      ? subjectHeroMeta.methodPrinciplesItems.filter(
          (p) => String(p?.title ?? '').trim() && String(p?.body ?? '').trim(),
        )
      : undefined;

  /* ── Dynamické statistiky ── */
  const physicalCount = subjectProducts.filter(p => p.type !== 'online').length;
  const rocnikSet = new Set<string>();
  subjectProducts.forEach(p => {
    // zkus rocnik field, pak číslo z názvu
    const r = p.rocnik != null
      ? String(p.rocnik)
      : ((p.name || '').match(/(\d+)/)?.[1] ?? null);
    if (r) rocnikSet.add(r);
  });
  const rocnikCount = rocnikSet.size;

  const dynamicStats = [
    {
      value: physicalCount > 0 ? String(physicalCount) : cfg.stats[0]?.value ?? '—',
      label: 'sešitů a učebnic',
    },
    {
      value: rocnikCount > 0 ? String(rocnikCount) : cfg.stats[1]?.value ?? '—',
      label: 'ročníků',
    },
    // zachováme zbytek z configu (aktivity, MŠMT…)
    ...cfg.stats.slice(2),
  ];

  /* stacked book covers helper */
  const StackedCovers = ({ books, bg }: { books: any[]; bg: string }) => {
    const offsets = ['-38px', '0px', '38px'];
    const rotations = ['-8deg', '0deg', '8deg'];
    const zIdxs = [1, 3, 2];
    return (
      <div className="relative flex items-end justify-center w-full" style={{ height: '170px' }}>
        {books.length > 0 ? books.map((book: any, i: number) => (
          <div
            key={book.id}
            className="absolute bottom-0"
            style={{
              transform: `translateX(${offsets[i] ?? '0px'}) rotate(${rotations[i] ?? '0deg'})`,
              zIndex: zIdxs[i] ?? i,
              width: '100px',
              height: '140px',
            }}
          >
            <ImageWithFallback
              src={book.image}
              alt={book.name}
              className="w-full h-full object-contain max-md:drop-shadow-[0_4px_12px_rgba(0,0,0,0.14)] md:drop-shadow-[0_8px_22px_rgba(0,0,0,0.22)]"
            />
          </div>
        )) : (
          <div className="w-[100px] h-[140px] rounded-xl flex items-center justify-center" style={{ background: bg }}>
            <span className="text-4xl opacity-30">{'📚'}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      {!hideTopNav && <TopNav onOrder={onOrder} />}
      <SEOHead
        title={seoTitle}
        path={`/predmet/${subjectToSlug(subject)}`}
        description={`${seoTitle} \u2014 ${cfg.tagline}`}
        image={resolveShareImageUrl({ category: seoTitle })}
        imageAlt={buildOgImageAlt({ title: seoTitle, categoryLabel: seoTitle })}
        imageWidth={1200}
        imageHeight={630}
        jsonLd={[
          breadcrumbJsonLd([
            { name: 'Katalog', url: marketingUrl('/') },
            { name: seoTitle, url: marketingUrl(`/predmet/${subjectToSlug(subject)}`) },
          ]),
          ...(subjectFaqs.length > 0 ? [faqJsonLd(subjectFaqs)] : []),
        ]}
      />

      {/* ── HEADER — barevná karta s bílými okraji a zakulacením ── */}
      <div className="w-full bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 pt-5 pb-2">
          <div
            className="rounded-[15px] sm:rounded-[20px] md:rounded-[22px] overflow-hidden"
            style={{ background: cfg.heroColor }}
          >
            <div className="px-5 sm:px-8 md:px-12 pt-6 pb-8">
              {/* Horní řádek: Zpět + RVP + doložka (+ „Pro …“ jen kde dává smysl) */}
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-[#001161]/50 hover:text-[#001161] text-[13px] transition-colors cursor-pointer group shrink-0"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                >
                  <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  {'Zp\u011bt'}
                </button>
                <div className="w-px h-4 bg-[#001161]/20 shrink-0" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <ProductComplianceBadge>{'Podle RVP'}</ProductComplianceBadge>
                  {showMsmtSubjectBadge ? (
                    <ProductComplianceBadge>{'Dolo\u017eka M\u0160MT'}</ProductComplianceBadge>
                  ) : null}
                  {heroRocnikLabel ? (
                    <span
                      className="text-[11px] sm:text-[12px] font-normal leading-tight ml-0.5 max-w-[min(100%,280px)] sm:max-w-none"
                      style={{
                        fontFamily: "'Fenomen Sans', sans-serif",
                        color: 'rgba(75, 72, 204, 0.88)',
                      }}
                    >
                      {heroRocnikLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Nadpis předmětu + úvod autora: klik na podtržený řádek rozbalí text (bez vzhledu tlačítka) */}
              <h1
                className={`text-[#001161] text-[34px] sm:text-[42px] md:text-[52px] leading-[1.05] tracking-tight ${showAuthorIntro ? 'mb-2' : 'mb-0'}`}
                style={{ fontFamily: "'Cooper Light', serif" }}
              >
                {cfg.displayName}
              </h1>
              {showAuthorIntro ? (
                <div className="max-w-[640px] mt-0">
                  <button
                    type="button"
                    onClick={() => setHeroIntroOpen((o) => !o)}
                    aria-expanded={heroIntroOpen}
                    className="inline-flex items-center gap-1.5 max-w-full text-left bg-transparent border-0 p-0 m-0 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#001161]/25 focus-visible:ring-offset-2 rounded-sm"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    <span className="text-[#001161]/88 text-[14px] sm:text-[15px] font-semibold underline decoration-[#001161]/35 underline-offset-[5px] decoration-1">
                      {heroIntroLabel}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 shrink-0 text-[#001161]/40 transition-transform duration-200 ${heroIntroOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {heroIntroOpen ? (
                      <motion.div
                        key="hero-intro"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                      >
                        <p
                          className="text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-line mt-2.5 text-[#001161]/62"
                          style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        >
                          {heroIntroExpandedText}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOOKS ── */}
      <div className="py-12 px-6 md:px-12 max-w-[1200px] mx-auto">

        <div className="flex items-center gap-4 mb-0">
          <h2
            className="text-[#001161] text-[26px] md:text-[32px] leading-[1.08] shrink-0"
            style={{ fontFamily: "'Cooper Light', serif" }}
          >
            {'Dostupn\u00e9 tituly'}
          </h2>
          <div className="h-px flex-1 bg-[#001161]/10 self-center min-w-0" />
        </div>

        {subjectRocnikOptions.length > 1 && (
          <div className="mt-3 mb-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-2.5">
              <span className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40 shrink-0 pt-0.5">
                {'Ro\u010dn\u00edky'}
              </span>
              <div className="flex flex-wrap gap-2.5">
                {subjectRocnikOptions.map((r) => {
                  const on = subjectRocnikFilter === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRocnik(r)}
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
            {subjectRocnikFilter != null && (
              <button
                type="button"
                onClick={clearRocnikFilter}
                className="font-['Fenomen_Sans',sans-serif] text-[14.4px] text-[#001161]/45 hover:text-[#001161] underline underline-offset-2 self-start cursor-pointer bg-transparent border-0 p-0"
              >
                Zrušit filtry
              </button>
            )}
          </div>
        )}

        {/* Series panels */}
        {showSeriesPanels && (() => {
          const SERIES_INFO = [
            {
              id: 'krok' as const,
              label: 'Krok za krokem',
              desc: 'Vede žáky k vlastnímu objevování a procvičení učiva.',
            },
            {
              id: 'pro-vsechny' as const,
              label: 'Pro všechny',
              desc: 'Díky pestrým úlohám různé obtížnosti vede k důkladnému pochopení.',
            },
            {
              id: 'digital' as const,
              label: 'Digitální přístup',
              desc: 'Tisíce příkladů v různých obtížnostech, soutěže a interaktivní pracovní listy. Zdarma od 15 ks sešitů. Lze zakoupit i samostatně bez sešitů.',
            },
          ];
          const activeInfo = SERIES_INFO.find(s => s.id === activeSeries);
          const showSeriesExplainBox = !!(activeInfo || baseSubject === 'Matematika');
          return (
            <div className="mt-3 mb-5">
              <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-2.5 mb-2">
                <span className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40 shrink-0 pt-0.5">
                  {'Typ matematiky:'}
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {SERIES_INFO.map(s => {
                    const active = activeSeries === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSeries(s.id)}
                        className={`px-[14px] py-[7px] rounded-full font-['Fenomen_Sans',sans-serif] text-[15.6px] font-normal leading-tight transition-colors cursor-pointer border-0 whitespace-nowrap ${
                          active
                            ? 'bg-[#001161] text-white'
                            : 'bg-[#eef2fb] text-[#001161]/75 hover:bg-[#e2e8f4] hover:text-[#001161]'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                  {activeSeries !== 'all' && (
                    <button
                      type="button"
                      onClick={clearSeriesFilter}
                      className="px-[14px] py-[7px] rounded-full font-['Fenomen_Sans',sans-serif] text-[14px] leading-tight text-[#001161]/55 hover:text-[#001161] bg-[#eef2fb] hover:bg-[#e2e8f4] border-0 transition-colors cursor-pointer self-center"
                    >
                      × Vše
                    </button>
                  )}
                </div>
              </div>
              {/* Popisek aktivní řady + u matematiky odkaz na srovnávací video */}
              {showSeriesExplainBox && (
                <div className="font-['Fenomen_Sans',sans-serif] pt-1">
                  {activeInfo && (
                    <div>
                      <span className="text-[13px] font-bold text-[#001161]">{activeInfo.label}: </span>
                      <span className="text-[13px] text-[#001161]/65">{activeInfo.desc}</span>
                    </div>
                  )}
                  {baseSubject === 'Matematika' && (
                    <div className={activeInfo ? 'mt-3 pt-3 border-t border-[#001161]/10' : ''}>
                      <p className="text-[13px] text-[#001161]/75 leading-relaxed">
                        {'Jak\u00fd je rozd\u00edl mezi matikou '}
                        <span className="font-semibold text-[#001161]">{'Pro v\u0161echny'}</span>
                        {' a '}
                        <span className="font-semibold text-[#001161]">{'Krok za krokem'}</span>
                        {'? '}
                        <button
                          type="button"
                          onClick={() => setMathDiffVideoOpen(true)}
                          className="text-[#4B48CC] font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer bg-transparent border-0 p-0 text-[13px] font-['Fenomen_Sans',sans-serif]"
                        >
                          {'Pus\u0165te si video'}
                        </button>
                        {':'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Book grids */}
        {booksByGrade != null && booksByGrade.length > 0 ? (
          <div className="space-y-12 mt-2">
            {booksByGrade.map(({ grade, books }) => (
              <div key={grade}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[#001161] text-[18px] font-bold shrink-0" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>{grade}</span>
                  <div className="h-px flex-1 bg-[#001161]/8" />
                </div>
                {books.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-1 sm:gap-x-5 gap-y-0 items-stretch">
                    {books.map((book: any) => (
                      <BookCard key={book.id} book={book} onClick={() => onProductClick?.(book)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[#001161]/30 text-[14px] py-4" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                    {'Pro tento stupeň nejsou nalezeny žádné tituly.'}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : mathSeriesBlocks != null && mathSeriesBlocks.length > 0 ? (
          <div className="space-y-12 mt-2">
            {mathSeriesBlocks.map(({ key, title, books }) => (
              <div key={key}>
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-[#001161] text-[18px] font-bold shrink-0"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    {title}
                  </span>
                  <div className="h-px flex-1 bg-[#001161]/8" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-1 sm:gap-x-5 gap-y-0 items-stretch">
                  {books.map((book: any) => (
                    <BookCard key={book.id} book={book} onClick={() => onProductClick?.(book)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredBooks.length > 0 ? (
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-1 sm:gap-x-5 gap-y-0 items-stretch ${showSeriesPanels ? '' : 'mt-2'}`}
          >
            {filteredBooks.map(book => (
              <BookCard key={book.id} book={book} onClick={() => onProductClick?.(book)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-[#001161]/40 text-[16px]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
              {subjectProducts.length === 0
                ? 'Pro tento p\u0159edm\u011bt zat\u00edm nejsou na\u010dteny \u017e\u00e1dn\u00e9 tituly.'
                : subjectRocnikFilter != null && afterRocnikPool.length === 0
                  ? '\u017d\u00e1dn\u00fd titul neodpov\u00edd\u00e1 zvolen\u00e9mu ro\u010dn\u00edku.'
                  : '\u017d\u00e1dn\u00e9 tituly neodpov\u00eddaj\u00ed vybran\u00e9 \u0159ad\u011b.'}
            </p>
          </div>
        )}
      </div>

      {/* ── TABS (Co vše obsahuje) — only for non-comparison subjects ── */}
      {!showComparison && (
        <SubjectTabsSection
          subject={subject}
          displayName={cfg.displayName}
          light={true}
          ecosystemHeading={true}
        />
      )}

      {/* ── COMPARISON (for science subjects) ── */}
      {showComparison && (
        <>
          {/* Slider — full width, light bg */}
          <SubjectTabsSection
            subject={subject}
            displayName={cfg.displayName}
            light={true}
            ecosystemHeading={true}
          />

          {/* Základní vs. rozšířený — stejný úvodní text jako u bloku na PDP (FyzikaAccessJourney) */}
          <div className="px-6 md:px-12 max-w-[1200px] mx-auto py-14">
            {['Fyzika', 'Chemie', 'Přírodopis'].includes(subject) ? (
              <FyzikaAccessJourney onOrder={onOrder} subject={subject} showIntro={true} />
            ) : (
              <>
                <h2 className="leading-tight max-w-[820px] mb-8" style={COOPER_ACCESS_INTRO_HEADING_STYLE}>
                  {DIGITAL_ACCESS_TYPES_INTRO_TITLE}
                  <span style={COOPER_ACCESS_INTRO_MUTED_STYLE}>{DIGITAL_ACCESS_TYPES_INTRO_BODY}</span>
                </h2>
                <DigitalAccessComparison subject={subject} workbooks={workbooks} onOrder={onOrder} />
              </>
            )}
          </div>
        </>
      )}

      {showMethodPrinciples && (
        <SubjectMethodPrinciplesSection
          baseSubject={baseSubject}
          displayNameGenitive={cfg.displayNameGenitive}
          itemsFromCms={cmsMethodPrinciples}
          matematikaFirstStage={baseSubject === 'Matematika' && subjectGradeNum === '1'}
          matematikaSecondStage={baseSubject === 'Matematika' && subjectGradeNum === '2'}
        />
      )}

      <SubjectWebinarsSlider
        subject={subject}
        displayName={cfg.displayName}
        displayNameGenitive={cfg.displayNameGenitive}
      />

      {/* ── FAQ (z adminu / seed) ── */}
      {subjectFaqs.length > 0 && (
        <div className="px-6 md:px-12 max-w-[920px] mx-auto py-14 md:py-16 border-t border-[#001161]/10">
          <div className="flex items-center gap-4 mb-8">
            <h2
              className="text-[#001161] text-[24px] md:text-[30px] leading-tight shrink-0"
              style={{ fontFamily: "'Cooper Light', serif" }}
            >
              {'\u010casto kladen\u00e9 dotazy'}
            </h2>
            <div className="h-px flex-1 bg-[#001161]/10" aria-hidden />
          </div>
          <div className="space-y-2">
            {subjectFaqs.map((f, i) => {
              const open = openFaqIndex === i;
              return (
                <div
                  key={i}
                  className="rounded-[18px] border border-[#001161]/10 bg-[#f8f9fc]/80 overflow-hidden transition-shadow"
                  style={{ boxShadow: open ? '0 8px 28px rgba(0,17,97,0.08)' : undefined }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(open ? null : i)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/60 transition-colors"
                    aria-expanded={open}
                  >
                    <span
                      className="text-[15px] md:text-[16px] font-bold text-[#001161] leading-snug"
                      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    >
                      {f.question}
                    </span>
                    <span className={`shrink-0 text-[#001161]/40 text-lg transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
                      {'\u25BE'}
                    </span>
                  </button>
                  {open && (
                    <div
                      className="px-5 pb-5 pt-0 text-[14px] md:text-[15px] text-[#001161]/75 leading-relaxed border-t border-[#001161]/6"
                      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    >
                      {f.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div className="py-16 px-6 md:px-12 text-center" style={{ background: `linear-gradient(135deg, ${cfg.heroColor} 0%, ${cfg.heroColorDark} 100%)` }}>
        <h2
          className="text-[#001161] text-[36px] md:text-[52px] leading-tight mb-4"
          style={{ fontFamily: "'Cooper Light', serif" }}
        >
          {'Za\u010dn\u011bte dnes'}
        </h2>
        <p className="text-[#001161]/60 text-[16px] mb-8 max-w-[460px] mx-auto" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
          {'Registrace je zdarma. P\u0159\u00edstup ke v\u0161em uk\u00e1zkov\u00fdm materi\u00e1l\u016fm ihned po p\u0159ihl\u00e1\u0161en\u00ed.'}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a
            href="/vyzkousejte"
            onClick={(e) => { e.preventDefault(); navigate('/vyzkousejte'); }}
            className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[15px] font-bold px-7 py-3.5 rounded-xl transition-all hover:scale-[1.03] shadow-lg"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {'Vyzkou\u0161et zdarma'}
          </a>
          <button
            onClick={onOrder}
            className="inline-flex items-center gap-2 bg-[#001161] hover:bg-[#001161]/80 text-white text-[15px] font-bold px-7 py-3.5 rounded-xl transition-all hover:scale-[1.03] cursor-pointer"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {'Popt\u00e1vka pro \u0161kolu'}
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {mathDiffVideoOpen && (
              <motion.div
                key="math-diff-yt"
                role="dialog"
                aria-modal="true"
                aria-label="Video: rozdíl mezi řadami"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
                onClick={() => setMathDiffVideoOpen(false)}
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
                    <span className="text-[13px] sm:text-[14px] font-semibold" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                      {'Rozd\u00edl: Pro v\u0161echny vs. Krok za krokem'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMathDiffVideoOpen(false)}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      aria-label="Zavřít"
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
                      title="Rozdíl mezi Pro všechny a Krok za krokem"
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
    </div>
  );
}