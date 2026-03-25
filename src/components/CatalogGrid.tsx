import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import svgPaths from '../imports/svg-3hoiegevxq';
import { VividbooksFeatures } from './VividbooksFeatures';
import { UnifiedBookCard } from './UnifiedBookCard';
import { useProducts } from '../contexts/ProductsContext';
import { useCatalog } from '../contexts/CatalogContext';
import { subjectToSlug } from '../utils/slugify';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { fetchJsonWithRetry } from '../utils/fetchWithRetry';
import { parseHeroPhoneDiff } from '../utils/heroPhoneOverrides';
import { useMatchMedia } from '../hooks/useMatchMedia';
import { WebinarsSection } from './WebinarsSection';
import { BlogSection } from './BlogSection';
import { SEOHead } from './SEOHead';
import { useWebinars } from '../contexts/WebinarsContext';
import { NewsletterBanner } from './NewsletterBanner';
import { NovinkySection } from './NovinkySection';
import {
  clampHeroBlockGapPx,
  clampHeroTitleLineHeightPct,
  clampHeroTitleSizePct,
  clampHeroBooksFanColumnPercent,
  clampHeroImageColumnPercent,
  clampHeroImagePosPct,
  clampHeroImageScalePct,
  heroHeadingFontSizeClamp,
  heroLeftImageImgStyle,
  heroSlideShouldShowCta,
  mergeHeroUnderlineRanges,
  normalizeHeroBlockOrder,
  normalizeHeroBlockVisibility,
  normalizeHeroSlideTitleFont,
  normalizeHeroTitleTiltMode,
  normalizeTitlePlayfulSeed,
  heroBookCoverShadowFilter,
  heroSurfaceHexFromSlide,
  parseHeroBookProductIds,
  parseHeroTitleUnderlines,
  resolveHeroFanBooks,
  resolveHeroSlideCtaHref,
  heroMainHeadingClassName,
  clampHeroBooksFanBelowLiftPx,
  clampHeroBooksFanBelowShelfPercent,
  clampHeroBooksFanCollageOffsetXPx,
  clampHeroBooksFanCollageOffsetYPx,
  clampHeroBooksFanGapPx,
  clampHeroBooksFanScalePct,
  clampHeroFullImageCardBlurPx,
  clampHeroFullImageCardOpacityPct,
  HERO_CENTER_BELOW_TITLE_SCALE,
  HERO_SLIDER_HEIGHT_PX,
  normalizeHeroBooksFanArrangement,
  normalizeHeroFullImageCardBgHex,
  normalizeHeroBooksFanZOrder,
  heroBooksFanBelowShelfMinPx,
  heroBooksFanBelowCollageTopBleedPx,
  heroFullImageCardSurfaceStyle,
  type HeroContentBlockId,
  type HeroHeadingPreset,
  type HeroTitleTiltMode,
} from '../data/heroSlides';
import { HeroSlideTitleText } from './HeroSlideTitleText';
import { HeroBooksFanCovers } from './HeroBooksFanCovers';

function cmsHeroTitleTiltDeg(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n === 0) return undefined;
  return Math.max(-25, Math.min(25, Math.round(n * 10) / 10));
}

function cmsHeroTextColor(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.startsWith('#') && raw.length >= 4 ? raw : undefined;
}

/** URL hlavního obrázku slidu + obálek (pro předběžné načtení prvních dvou sliderů). */
function collectHeroSlideImageUrls(slide: unknown, maxBookCovers: number): string[] {
  const urls: string[] = [];
  if (!slide || typeof slide !== 'object') return urls;
  const s = slide as Record<string, unknown>;
  const im = s.image;
  if (typeof im === 'string' && /^https?:\/\//i.test(im)) urls.push(im);
  const books = s.books;
  if (Array.isArray(books)) {
    books.slice(0, maxBookCovers).forEach((b) => {
      const u =
        b && typeof b === 'object' && 'image' in b
          ? (b as { image?: string }).image
          : undefined;
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.push(u);
    });
  }
  return urls;
}

/** Nadpis hero slidu — pill zvýraznění, náklon uniform / playful (CMS / vizuální editor). */
function HeroSlideHeading({
  slide,
  preset,
  className,
  accentHex,
  headingFontScale,
}: {
  slide: {
    title?: string;
    titleFont?: unknown;
    titleUnderlineRanges?: [number, number][];
    titleTiltDeg?: number;
    titleTiltMode?: HeroTitleTiltMode;
    titlePlayfulSeed?: number;
    heroTitleLineHeightPct?: number;
    heroTitleSizePct?: number;
    titlePillHighlightColor?: string;
    titlePillHighlightTextColor?: string;
  };
  preset: HeroHeadingPreset;
  className: string;
  accentHex?: string;
  headingFontScale?: number;
}) {
  const pillHex =
    typeof slide.titlePillHighlightColor === 'string' && slide.titlePillHighlightColor.startsWith('#')
      ? slide.titlePillHighlightColor.trim()
      : undefined;
  const pillTextHex =
    typeof slide.titlePillHighlightTextColor === 'string' && slide.titlePillHighlightTextColor.startsWith('#')
      ? slide.titlePillHighlightTextColor.trim()
      : undefined;
  return (
    <HeroSlideTitleText
      title={slide.title}
      titleUnderlineRanges={slide.titleUnderlineRanges}
      titleTiltMode={slide.titleTiltMode ?? 'none'}
      titleTiltDeg={slide.titleTiltDeg}
      titlePlayfulSeed={slide.titlePlayfulSeed}
      titleLineHeightPct={slide.heroTitleLineHeightPct}
      slide={slide}
      preset={preset}
      className={className}
      accentHex={accentHex}
      pillHighlightHex={pillHex}
      pillHighlightTextHex={pillTextHex}
      headingFontScale={headingFontScale}
    />
  );
}

/** Fade + lehký posun obsahu slidu při příjezdu / odjezdu (rychlejší než posun pásu). */
const HERO_CONTENT_FADE_MS = 520;

/** Volitelné CTA tlačítko u CMS / notifikačních slidů (center, left-image). */
function HeroSlideCtaButton({
  slide,
  navigate,
  align,
  isLight,
  accentHex,
}: {
  slide: { ctaLabel?: string; ctaLink?: string; link?: string };
  navigate: ReturnType<typeof useNavigate>;
  align: 'left' | 'center';
  isLight?: boolean;
  /** Barva ohraničení a textu CTA u tmavého textu (např. vlastní `heroTextColor`). */
  accentHex?: string;
}) {
  if (!heroSlideShouldShowCta(slide)) return null;
  const href = resolveHeroSlideCtaHref(slide);
  const label = String(slide.ctaLabel).trim();
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (href.startsWith('mailto:') || href.startsWith('tel:')) {
      window.location.href = href;
      return;
    }
    navigate(href);
  };
  const wrap = align === 'center' ? 'mt-3 flex w-full max-w-4xl justify-center' : 'mt-3';
  const btn = isLight
    ? "inline-flex items-center justify-center rounded-lg border-2 border-white px-[18px] py-[9px] text-[12.5px] font-bold text-white bg-transparent transition hover:bg-white/15 active:scale-[0.98] md:text-[13.5px] font-['Fenomen_Sans',sans-serif]"
    : "inline-flex items-center justify-center rounded-lg border-2 border-[#001161] px-[18px] py-[9px] text-[12.5px] font-bold text-[#001161] bg-transparent transition hover:bg-[#001161]/[0.07] active:scale-[0.98] md:text-[13.5px] font-['Fenomen_Sans',sans-serif]";
  const accentStyle =
    !isLight && accentHex
      ? ({ borderColor: accentHex, color: accentHex } as React.CSSProperties)
      : undefined;
  return (
    <div className={wrap}>
      <button type="button" onClick={onClick} className={btn} style={accentStyle}>
        {label}
      </button>
    </div>
  );
}

function CheckBadge({ label, light, accentHex }: { label: string; light?: boolean; accentHex?: string }) {
  const fill = light ? 'white' : accentHex || '#001161';
  return (
    <div
      className={`flex min-h-[37px] items-center gap-2 rounded-[7px] border px-3 py-1.5 ${light ? 'border-white/40 bg-white/10' : accentHex ? '' : 'border-[#001161]'}`}
      style={!light && accentHex ? { borderColor: accentHex } : undefined}
    >
      <div className="size-[17px]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
          <path d={svgPaths.p298d1300} fill={fill} />
        </svg>
      </div>
      <span
        className={`min-w-0 max-w-full font-['Fenomen_Sans',sans-serif] text-[13px] leading-tight @[380px]:text-[15px] ${light ? 'text-white' : accentHex ? '' : 'text-[#001161]'}`}
        style={!light && accentHex ? { color: accentHex } : undefined}
      >
        {label}
      </span>
    </div>
  );
}

/** Obal textu přes fullscreen fotku — šířka podle obsahu, podbarvení z CMS. */
function HeroFullImageTextCard({
  slide,
  children,
  className = '',
}: {
  slide: {
    heroFullImageCardBgHex?: unknown;
    heroFullImageCardOpacityPct?: unknown;
    heroFullImageCardBlurPx?: unknown;
  };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-fit max-w-full rounded-2xl px-3.5 py-2.5 [&_.mt-3]:mt-0 ${className}`.trim()}
      style={heroFullImageCardSurfaceStyle(
        slide.heroFullImageCardBgHex,
        slide.heroFullImageCardOpacityPct,
        slide.heroFullImageCardBlurPx,
      )}
    >
      {children}
    </div>
  );
}

/** CMS hero: pořadí a viditelnost bloků (editor). */
function CmsHeroOrderedBlocks({
  slide,
  variant,
  heroAlignStart,
  leftImageTextCenter,
  isLight,
  accentForUi,
  navigate,
}: {
  slide: any;
  variant: 'center' | 'centerBelow' | 'leftImage' | 'booksFan' | 'fullImage';
  heroAlignStart: boolean;
  /** U `leftImage` a `booksFan`: text vodorovně uprostřed sloupce (`heroImageColumnAlign` center). */
  leftImageTextCenter?: boolean;
  isLight: boolean;
  accentForUi?: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const liCenter =
    (variant === 'leftImage' || variant === 'booksFan') && Boolean(leftImageTextCenter);
  const fiCenter = variant === 'fullImage' && Boolean(slide.heroImageColumnAlign === 'center');
  const order = normalizeHeroBlockOrder(slide.heroBlockOrder);
  const vis = normalizeHeroBlockVisibility(slide.heroBlockVisibility);
  const blockGapPx = clampHeroBlockGapPx(slide.heroBlockGapPx);

  const renderBlock = (id: HeroContentBlockId): React.ReactNode => {
    switch (id) {
      case 'title':
        if (variant === 'fullImage') {
          return (
            <HeroFullImageTextCard slide={slide}>
              <HeroSlideHeading
                slide={slide}
                preset="fullImage"
                className={`max-w-full w-max break-words ${fiCenter ? 'text-center' : ''}`}
                accentHex={accentForUi}
              />
            </HeroFullImageTextCard>
          );
        }
        if (variant === 'leftImage' || variant === 'booksFan') {
          const preset = variant === 'booksFan' ? 'booksFan' : 'leftImage';
          return (
            <HeroSlideHeading
              slide={slide}
              preset={preset}
              className={`break-words ${liCenter ? 'text-center' : ''}`}
              accentHex={accentForUi}
            />
          );
        }
        if (variant === 'centerBelow') {
          return (
            <HeroSlideHeading
              slide={slide}
              preset="center"
              headingFontScale={HERO_CENTER_BELOW_TITLE_SCALE}
              className={`max-w-full break-words ${heroAlignStart ? 'text-left' : 'text-center'}`}
              accentHex={accentForUi}
            />
          );
        }
        return (
          <HeroSlideHeading
            slide={slide}
            preset="center"
            className={`max-w-full break-words ${heroAlignStart ? 'text-left' : 'text-center'}`}
            accentHex={accentForUi}
          />
        );
      case 'subtitle':
        if (variant === 'fullImage') {
          return (
            <HeroFullImageTextCard slide={slide}>
              <p
                className={`max-w-full w-max font-['Fenomen_Sans',sans-serif] text-[13px] md:text-[15px] xl:text-[17px] opacity-80 break-words whitespace-pre-line leading-snug ${fiCenter ? 'text-center' : ''}`}
                title={slide.subtitle}
              >
                {slide.subtitle}
              </p>
            </HeroFullImageTextCard>
          );
        }
        if (variant === 'leftImage') {
          return (
            <p
              className={`font-['Fenomen_Sans',sans-serif] text-[13px] md:text-[15px] xl:text-[17px] opacity-70 break-words whitespace-pre-line leading-snug ${liCenter ? 'text-center' : ''}`}
              title={slide.subtitle}
            >
              {slide.subtitle}
            </p>
          );
        }
        if (variant === 'booksFan') {
          return (
            <p
              className={`font-['Fenomen_Sans',sans-serif] text-[13px] md:text-[15px] xl:text-[17px] opacity-65 leading-snug break-words ${liCenter ? 'text-center' : ''}`}
              title={slide.subtitle}
            >
              {slide.subtitle}
            </p>
          );
        }
        return (
          <p
            className={`font-['Fenomen_Sans',sans-serif] text-[14px] md:text-[16px] xl:text-[18px] max-w-4xl opacity-70 break-words whitespace-pre-line leading-snug ${heroAlignStart ? 'text-left' : 'text-center'}`}
            title={slide.subtitle}
          >
            {slide.subtitle}
          </p>
        );
      case 'badges': {
        if (variant === 'fullImage') {
          const wrap = `flex w-max max-w-full flex-wrap gap-2 md:gap-3 ${fiCenter ? 'justify-center' : 'justify-start'}`;
          return (
            <HeroFullImageTextCard slide={slide}>
              <div className={wrap}>
                {slide.badges.map((b: string) => (
                  <CheckBadge key={b} label={b} light={isLight} accentHex={accentForUi} />
                ))}
              </div>
            </HeroFullImageTextCard>
          );
        }
        const wrap =
          variant === 'center' || variant === 'centerBelow'
            ? `flex flex-wrap gap-2 md:gap-3 ${heroAlignStart ? 'justify-start' : 'justify-center'}`
            : variant === 'leftImage' || variant === 'booksFan'
              ? `flex flex-wrap gap-2 md:gap-3 ${liCenter ? 'justify-center' : ''}`
              : 'flex flex-wrap gap-2';
        return (
          <div className={wrap}>
            {slide.badges.map((b: string) => (
              <CheckBadge key={b} label={b} light={isLight} accentHex={accentForUi} />
            ))}
          </div>
        );
      }
      case 'bottom':
        if (variant === 'fullImage') {
          return (
            <HeroFullImageTextCard slide={slide}>
              <p
                className={`max-w-full w-max font-['Fenomen_Sans',sans-serif] text-[15px] md:text-[18px] xl:text-[21px] break-words whitespace-pre-line leading-snug ${fiCenter ? 'text-center' : ''}`}
                title={slide.bottom}
              >
                {slide.bottom}
              </p>
            </HeroFullImageTextCard>
          );
        }
        if (variant === 'leftImage') {
          return (
            <p
              className={`font-['Fenomen_Sans',sans-serif] text-[15px] md:text-[18px] xl:text-[21px] break-words whitespace-pre-line leading-snug ${liCenter ? 'text-center' : ''}`}
              title={slide.bottom}
            >
              {slide.bottom}
            </p>
          );
        }
        if (variant === 'booksFan') {
          return (
            <p
              className={`font-['Fenomen_Sans',sans-serif] text-[14px] md:text-[17px] xl:text-[19px] opacity-80 break-words whitespace-pre-line leading-snug ${liCenter ? 'text-center' : ''}`}
              title={slide.bottom}
            >
              {slide.bottom}
            </p>
          );
        }
        return (
          <p
            className={`font-['Fenomen_Sans',sans-serif] text-[16px] md:text-[19px] xl:text-[22px] max-w-4xl break-words whitespace-pre-line leading-snug ${heroAlignStart ? 'text-left' : 'text-center'}`}
            title={slide.bottom}
          >
            {slide.bottom}
          </p>
        );
      case 'cta':
        if (variant === 'fullImage') {
          if (!heroSlideShouldShowCta(slide)) return null;
          return (
            <HeroFullImageTextCard slide={slide} className={fiCenter ? 'flex justify-center' : ''}>
              <HeroSlideCtaButton
                slide={slide}
                navigate={navigate}
                align={fiCenter ? 'center' : 'left'}
                isLight={isLight}
                accentHex={accentForUi}
              />
            </HeroFullImageTextCard>
          );
        }
        return (
          <HeroSlideCtaButton
            slide={slide}
            navigate={navigate}
            align={
              ((variant === 'center' || variant === 'centerBelow') && !heroAlignStart) || liCenter
                ? 'center'
                : 'left'
            }
            isLight={isLight}
            accentHex={accentForUi}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col" style={{ gap: blockGapPx }}>
      {order.map((id) => (
        <React.Fragment key={id}>{vis[id] ? renderBlock(id) : null}</React.Fragment>
      ))}
    </div>
  );
}

const stripStupen = (text: string) => text.replace(/\s+\d+\.\s*stupe.*$/i, '');
const secondGradeSubjects = ['Matematika 2. stupe\u0148', 'Fyzika', 'P\u0159\u00edrodopis', 'Chemie'];
const firstGradeSubjects  = ['Matematika 1. stupe\u0148', '\u010cesk\u00fd jazyk', 'Prvouka'];

/* ── helpers ──────────────────────────────────────────────────── */
const getCategoryLink = (category: string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('matematika 1') || cat.includes('matematika 1. stupe')) return 'https://www.vividbooks.com/cs/matematika-1-stupen';
  if (cat.includes('prvouka'))   return 'https://www.vividbooks.com/cs/prvouka';
  if (cat.includes('matematika')) return 'https://www.vividbooks.com/cs/matematika';
  if (cat.includes('fyzika'))     return 'https://www.vividbooks.com/cs/fyzika';
  if (cat.includes('chemie'))     return 'https://www.vividbooks.com/cs/chemie';
  if (cat.includes('p\u0159\u00edrodopis')) return 'https://www.vividbooks.com/cs/prirodopis';
  return 'https://eshop.vividbooks.com';
};

const getDefaultDescription = (product: any) => {
  if (product.description?.trim()) return product.description;
  const cat  = (product.category || '').toLowerCase();
  const type = (product.type || '').toLowerCase();
  const isInteractive = ['online', 'vividboard', 'interactive', 'license'].includes(type);
  if ((cat.includes('fyzika') || cat.includes('chemie')) && isInteractive) {
    return 'Digit\u00e1ln\u00ed u\u010debnice — rozs\u00e1hl\u00fd digit\u00e1ln\u00ed p\u0159\u00edstup s interaktivn\u00edmi lekcemi, badatelsk\u00fdmi listy, testy a procvi\u010dov\u00e1n\u00edm.';
  }
  if (cat.includes('p\u0159\u00edrodopis') && isInteractive) {
    return 'Digit\u00e1ln\u00ed u\u010debnice P\u0159\u00edrodopisu s 3D modely, interaktivn\u00edmi lekcemi a badatelsk\u00fdmi listy.';
  }
  return '';
};

export default function CatalogGrid() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { products } = useProducts();
  const { groupingMode, setActiveSection, isDistributorMode } = useCatalog();
  const { webinars } = useWebinars();

  /* ── hero slider ─────────────────────────────────────────── */
  const [heroSlide,   setHeroSlide]   = useState(1);
  const [heroAnimate, setHeroAnimate] = useState(true);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHoveredRef = useRef(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );

  /* ── notifications ───────────────────────────────────────── */
  const [notifBobanak, setNotifBobanak] = useState<any>(null);
  const [notifSliders, setNotifSliders] = useState<any[]>([]);
  /** Hero slidery uložené v CMS (KV) — doplnění za pevné slidery */
  const [cmsHeroSlides, setCmsHeroSlides] = useState<any[]>([]);

  /* ── webinar slide countdown ─────────────────────────────── */
  const [webinarCountdown, setWebinarCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  /* ── upcoming / live webinar slide ───────────────────────── */
  const upcomingWebinarSlide = useMemo(() => {
    if (!webinars.length) return null;
    const now = Date.now();
    // Dev mode: simulace "začíná za chvíli"
    const devImminentId = typeof localStorage !== 'undefined'
      ? localStorage.getItem('vvb_dev_imminent')
      : null;

    // Find next upcoming webinar (soonest in future)
    const upcoming = webinars
      .filter(w => !w.isPast)
      .map(w => {
        const start = new Date(
          w.year, (w.monthNum || 1) - 1, w.day || 1,
          ...((w.time || '18:00').split(':').map(Number) as [number, number])
        );
        // Dev override: treat as if starting in 5 min
        const effectiveDiffMin = devImminentId === w.id
          ? -5
          : (now - start.getTime()) / 60000;
        return { w, start, diffMin: effectiveDiffMin, isDevPreview: devImminentId === w.id };
      })
      .filter(({ diffMin }) => diffMin < 150)
      .sort((a, b) => {
        if (a.isDevPreview) return -1;
        if (b.isDevPreview) return 1;
        return a.start.getTime() - b.start.getTime();
      });

    if (!upcoming.length) return null;
    const { w, diffMin, isDevPreview } = upcoming[0];
    const isLive = diffMin >= 0 && diffMin < 150;
    const showInSlider = isDevPreview || (diffMin > -30 && diffMin < 150);
    return { webinar: w, diffMin, isLive, showInSlider, isDevPreview };
  }, [webinars]);

  const webinarSlideStart = useMemo(() => {
    if (!upcomingWebinarSlide?.showInSlider) return null;
    const w = upcomingWebinarSlide.webinar;
    if (upcomingWebinarSlide.isDevPreview) {
      return new Date(Date.now() + 25 * 60 * 1000); // dev: 25 min odpočet pro vizuál
    }
    return new Date(w.year, (w.monthNum || 1) - 1, w.day || 1,
      ...((w.time || '18:00').split(':').map(Number) as [number, number]));
  }, [upcomingWebinarSlide]);

  useEffect(() => {
    if (!webinarSlideStart) return;
    const calc = () => {
      const diff = Math.max(0, webinarSlideStart.getTime() - Date.now());
      setWebinarCountdown({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [webinarSlideStart]);

  // Nejbližší nadcházející webinář pro bobánek (bez omezení na čas)
  const nextWebinarForBobanak = useMemo(() => {
    if (!webinars.length) return null;
    const now = Date.now();
    return webinars
      .filter(w => !w.isPast)
      .map(w => {
        const start = new Date(
          w.year, (w.monthNum || 1) - 1, w.day || 1,
          ...((w.time || '18:00').split(':').map(Number) as [number, number])
        );
        return { w, start, diffMin: (now - start.getTime()) / 60000 };
      })
      .filter(({ diffMin }) => diffMin < 150)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] || null;
  }, [webinars]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/public/notifikace`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setNotifBobanak(data.bobanak);
          setNotifSliders(data.sliders || []);
        }
      } catch (e) {
        console.error('[Notif] Fetch failed:', e);
      }
    };
    fetchNotifications();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/public/hero-slidy`;

    (async () => {
      const result = await fetchJsonWithRetry<{ items?: unknown }>(
        url,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        { maxAttempts: 4, baseDelayMs: 350 },
      );
      if (cancelled) return;
      if (!result.ok) {
        setCmsHeroSlides([]);
        return;
      }
      const raw = Array.isArray(result.data.items) ? result.data.items : [];
      const sorted = [...raw]
        .filter((s: any) => s.isActive !== false && s.active !== false)
        .sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0));
      setCmsHeroSlides(sorted);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── scroll-to on initial nav from sidebar ───────────────── */
  useEffect(() => {
    const scrollTo = (location.state as any)?.scrollTo;
    if (scrollTo) {
      setTimeout(() => {
        const el = document.getElementById(scrollTo);
        if (el) {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
          setActiveSection(scrollTo);
        }
      }, 100);
    }
  }, []);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** Úzké okno — hero může použít mobilní variantu z CMS (`phoneOverrides`). */
  const heroNarrowViewport = useMatchMedia('(max-width: 767px)', false);

  const isPeekMode = windowWidth > 1200;
  /** Peek slide ≈ o 5 % užší než dříve (83 % → 78,85 %). */
  const SLIDE_W     = Number((83 * 0.95).toFixed(2));
  const GAP_W       = 2.5;
  const SLOT_W      = SLIDE_W + GAP_W;
  const INIT_OFFSET = (100 - SLIDE_W) / 2;

  const heroSlides = useMemo(() => {
    /** Režim „distributor“ — varianty z CMS / seedu (`distributorTitle` …), ne hardcoded duplicitní slidery. */
    const withDistributorVariant = (raw: any, mapped: Record<string, unknown>) => {
      if (!isDistributorMode) return mapped;
      const patch: Record<string, unknown> = {};
      if (typeof raw.distributorBg === 'string' && raw.distributorBg.startsWith('#')) {
        patch.bg = `bg-[${raw.distributorBg}]`;
        patch.bgStyle = raw.distributorBg;
      }
      if (typeof raw.distributorTitle === 'string' && raw.distributorTitle.trim()) {
        patch.title = raw.distributorTitle.trim();
      }
      if (typeof raw.distributorBottom === 'string' && raw.distributorBottom.trim()) {
        patch.bottom = raw.distributorBottom.trim();
      }
      return Object.keys(patch).length ? { ...mapped, ...patch } : mapped;
    };

    const mapCmsSlideInner = (s: any) => {
      let badges: string[] = [];
      if (Array.isArray(s.badges)) badges = s.badges.map(String);
      else if (typeof s.badges === 'string') {
        try {
          const j = JSON.parse(s.badges);
          if (Array.isArray(j)) badges = j.map(String);
        } catch { /* ignore */ }
      }
      const bgHex = typeof s.bg === 'string' && s.bg.startsWith('#') ? s.bg : '#e8d5f2';
      const titleStr = s.title || '';
      const titleUnderlineRanges = mergeHeroUnderlineRanges(
        titleStr.length,
        parseHeroTitleUnderlines(s.titleUnderlines),
      );
      const heroTextColor = cmsHeroTextColor(s.heroTextColor);
      const heroTextAlign = s.heroTextAlign === 'start' ? ('start' as const) : ('center' as const);
      const titleTiltMode = normalizeHeroTitleTiltMode(s.titleTiltMode, s.titleTiltDeg);
      const titleTiltDeg =
        titleTiltMode === 'uniform' ? cmsHeroTitleTiltDeg(s.titleTiltDeg) : undefined;
      const pillCol =
        typeof s.titlePillHighlightColor === 'string' && s.titlePillHighlightColor.startsWith('#')
          ? s.titlePillHighlightColor.trim()
          : '';
      const pillTextCol =
        typeof s.titlePillHighlightTextColor === 'string' && s.titlePillHighlightTextColor.startsWith('#')
          ? s.titlePillHighlightTextColor.trim()
          : '';
      const cmsVisual = {
        titleUnderlineRanges,
        titleTiltMode,
        heroBlockOrder: normalizeHeroBlockOrder(s.heroBlockOrder),
        heroBlockVisibility: normalizeHeroBlockVisibility(s.heroBlockVisibility),
        ...(heroTextColor ? { heroTextColor } : {}),
        ...(heroTextAlign === 'start' ? { heroTextAlign: 'start' as const } : {}),
        ...(titleTiltDeg != null ? { titleTiltDeg } : {}),
        ...(pillCol ? { titlePillHighlightColor: pillCol } : {}),
        ...(pillTextCol ? { titlePillHighlightTextColor: pillTextCol } : {}),
        heroBlockGapPx: clampHeroBlockGapPx(s.heroBlockGapPx),
        titlePlayfulSeed: normalizeTitlePlayfulSeed(s.titlePlayfulSeed),
        heroTitleLineHeightPct: clampHeroTitleLineHeightPct(s.heroTitleLineHeightPct),
        heroTitleSizePct: clampHeroTitleSizePct(s.heroTitleSizePct),
      };
      const base = {
        bg: `bg-[${bgHex}]`,
        bgStyle: bgHex,
        title: titleStr,
        subtitle: s.subtitle || '',
        badges,
        bottom: s.bottom || '',
        link: s.link || '',
        titleFont: normalizeHeroSlideTitleFont(s.titleFont),
        ctaLabel: typeof s.ctaLabel === 'string' ? s.ctaLabel : '',
        ctaLink: typeof s.ctaLink === 'string' ? s.ctaLink : '',
        ...cmsVisual,
      };
      if (s.layout === 'books-fan' || s.layout === 'books-fan-below' || s.layout === 'books-fan-above') {
        const ids = parseHeroBookProductIds(s.bookProductIds);
        const books = resolveHeroFanBooks(products, ids);
        const collageY = clampHeroBooksFanCollageOffsetYPx(
          s.booksFanCollageOffsetYPx ?? s.booksFanBelowLiftPx,
        );
        const booksFanShared = {
          books,
          booksFanShowEmptyHint: true,
          booksFanArrangement: normalizeHeroBooksFanArrangement(s.booksFanArrangement),
          booksFanGapPx: clampHeroBooksFanGapPx(s.booksFanGapPx),
          booksFanScalePct: clampHeroBooksFanScalePct(s.booksFanScalePct),
          booksFanColumnPercent: clampHeroBooksFanColumnPercent(s.booksFanColumnPercent),
          booksFanZOrder: normalizeHeroBooksFanZOrder(s.booksFanZOrder),
          booksFanCollageOffsetXPx: clampHeroBooksFanCollageOffsetXPx(s.booksFanCollageOffsetXPx),
          booksFanCollageOffsetYPx: collageY,
          booksFanBelowLiftPx: clampHeroBooksFanBelowLiftPx(collageY),
          booksFanBelowShelfPercent: clampHeroBooksFanBelowShelfPercent(s.booksFanBelowShelfPercent),
          image: '',
          imageEdgeToEdge: false,
          imageColumnPercent: 38,
        };
        const stackedLayout =
          s.layout === 'books-fan-below'
            ? ('books-fan-below' as const)
            : s.layout === 'books-fan-above'
              ? ('books-fan-above' as const)
              : ('books-fan' as const);
        return withDistributorVariant(s, {
          ...base,
          layout: stackedLayout,
          heroImageColumnAlign: s.heroImageColumnAlign === 'center' ? ('center' as const) : ('start' as const),
          ...booksFanShared,
        });
      }
      const simpleLayout =
        s.layout === 'hero-full-image'
          ? ('hero-full-image' as const)
          : s.layout === 'left-image'
            ? ('left-image' as const)
            : ('center' as const);
      return withDistributorVariant(s, {
        ...base,
        layout: simpleLayout,
        image: s.image || '',
        imageEdgeToEdge: Boolean(s.imageEdgeToEdge),
        imageColumnPercent: clampHeroImageColumnPercent(s.imageColumnPercent),
        heroImageColumnAlign: s.heroImageColumnAlign === 'center' ? ('center' as const) : ('start' as const),
        heroImageScalePct: clampHeroImageScalePct(s.heroImageScalePct),
        heroImagePosXPct: clampHeroImagePosPct(s.heroImagePosXPct),
        heroImagePosYPct: clampHeroImagePosPct(s.heroImagePosYPct),
        heroFullImageCardBgHex: normalizeHeroFullImageCardBgHex(s.heroFullImageCardBgHex),
        heroFullImageCardOpacityPct: clampHeroFullImageCardOpacityPct(s.heroFullImageCardOpacityPct),
        heroFullImageCardBlurPx: clampHeroFullImageCardBlurPx(s.heroFullImageCardBlurPx),
      });
    };

    const mapCmsSlide = (s: any) => {
      const mapped = mapCmsSlideInner(s);
      const diff = parseHeroPhoneDiff(s.phoneOverrides);
      if (s.phoneOverrideEnabled && Object.keys(diff).length > 0) {
        const mergedRaw = { ...s, ...diff };
        delete mergedRaw.phoneOverrides;
        delete mergedRaw.phoneOverrideEnabled;
        (mapped as { _phoneMapped?: unknown })._phoneMapped = mapCmsSlideInner(mergedRaw);
      }
      return mapped;
    };

    return [
      // ── Webinář slide — VŽDY PRVNÍ, když je aktivní ───────────
      ...(upcomingWebinarSlide?.showInSlider ? [{
        bg: upcomingWebinarSlide.isLive ? 'bg-[#dc2626]' : 'bg-[#1e3a8a]',
        bgStyle: upcomingWebinarSlide.isLive ? '#dc2626' : '#1e3a8a',
        title: upcomingWebinarSlide.isLive ? 'Live webinář' : 'Webinář brzy',
        subtitle: upcomingWebinarSlide.webinar.title,
        badges: upcomingWebinarSlide.isLive
          ? ['\uD83D\uDD34 Právě probíhá', upcomingWebinarSlide.webinar.lecturer]
          : [`${upcomingWebinarSlide.webinar.day}. ${upcomingWebinarSlide.webinar.monthName} v ${upcomingWebinarSlide.webinar.time}`],
        bottom: upcomingWebinarSlide.isLive ? 'Vstupte na živé vysílání →' : 'Připojte se — vysílání brzy začíná →',
        layout: 'webinar' as const,
        image: upcomingWebinarSlide.webinar.coverImage || 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        link: `/webinar/${upcomingWebinarSlide.webinar.id}/live`,
        _isLive: upcomingWebinarSlide.isLive,
        _webinar: upcomingWebinarSlide.webinar,
        textLight: true,
      }] : []),
      ...cmsHeroSlides.map(mapCmsSlide),
      // Inject slider-type notifications
      ...notifSliders.map((n: any) => ({
        bg: `bg-[${n.sliderBg || '#FFE4D6'}]`,
        bgStyle: n.sliderBg || '#FFE4D6',
        title: n.title || '',
        subtitle: n.subtitle || '',
        badges: (typeof n.sliderBadges === 'string' ? (() => { try { return JSON.parse(n.sliderBadges); } catch { return []; } })() : n.sliderBadges) || [],
        bottom: n.sliderBottom || '',
        layout: (n.sliderLayout || 'center') as 'center' | 'left-image',
        image: n.sliderImage || '',
        link: n.link || '',
        ctaLabel: typeof n.ctaLabel === 'string' ? n.ctaLabel : '',
        ctaLink: typeof n.ctaLink === 'string' ? n.ctaLink : '',
      })),
    ];
  }, [upcomingWebinarSlide, isDistributorMode, cmsHeroSlides, notifSliders, products]);
  const REAL_N = heroSlides.length;
  const extSlides =
    REAL_N > 0 ? [heroSlides[heroSlides.length - 1], ...heroSlides, heroSlides[0]] : [];

  /* Přednostně stáhnout vizuály prvních dvou reálných slidů (indexy 1 a 2 v extSlides). */
  useEffect(() => {
    if (heroSlides.length === 0) return;
    const urls = [
      ...collectHeroSlideImageUrls(heroSlides[0], 5),
      ...(heroSlides.length > 1 ? collectHeroSlideImageUrls(heroSlides[1], 5) : []),
    ];
    const seen = new Set<string>();
    for (const u of urls) {
      if (seen.has(u)) continue;
      seen.add(u);
      const img = new Image();
      img.fetchPriority = 'high';
      img.src = u;
    }
  }, [heroSlides]);

  /** Délka posunu karuselu — sjednoceno s odkladem skrytí obsahu odjíždějícího slidu. */
  const HERO_TRANSFORM_MS = 800;

  const startHeroTimer = () => {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    if (REAL_N <= 0) return;
    if (isHoveredRef.current) return;
    heroTimerRef.current = setInterval(() => {
      setHeroAnimate(true);
      setHeroSlide(s => s + 1);
    }, 4500);
  };

  useEffect(() => {
    if (heroTimerRef.current) {
      clearInterval(heroTimerRef.current);
      heroTimerRef.current = null;
    }
    startHeroTimer();
    return () => {
      if (heroTimerRef.current) {
        clearInterval(heroTimerRef.current);
        heroTimerRef.current = null;
      }
    };
  }, [REAL_N]);

  // Reset pozice slideru na 1 pokaždé, když se změní počet slidů (asynchronní načítání dat)
  const prevRealN = useRef(0);
  useEffect(() => {
    if (prevRealN.current !== 0 && prevRealN.current !== REAL_N) {
      setHeroAnimate(false);
      setHeroSlide(1);
      startHeroTimer();
    }
    prevRealN.current = REAL_N;
  }, [REAL_N]);

  // Boundary reset — infinite loop (opravený stale closure přidáním extSlides.length a REAL_N do deps)
  useEffect(() => {
    if (heroSlide === 0 || heroSlide === extSlides.length - 1) {
      const t = setTimeout(() => {
        setHeroAnimate(false);
        setHeroSlide(heroSlide === 0 ? REAL_N : 1);
      }, HERO_TRANSFORM_MS + 24);
      return () => clearTimeout(t);
    }
  }, [heroSlide, extSlides.length, REAL_N]);

  const goToSlide = (idx: number) => { setHeroAnimate(true); setHeroSlide(idx); startHeroTimer(); };

  /* ── expanded groups ─────────────────────────────────────── */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (name: string) =>
    setExpandedGroups(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  /* ── scroll positions per group ──────────────────────────── */
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const CARD_SCROLL = 3 * (207 + 20); // 3 karty × (šířka + gap)

  const handleGroupScroll = (group: string) => {
    const el = scrollRefs.current[group];
    if (!el) return;
    setScrollPositions(prev => ({ ...prev, [group]: el.scrollLeft }));
  };

  /* ── intersection observer for active section ────────────── */
  useEffect(() => {
    const opts: IntersectionObserverInit = { rootMargin: '-30% 0px -60% 0px', threshold: 0 };
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
    }, opts);
    document.querySelectorAll('.catalog-section').forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [groupingMode, products]);

  /* ── grouping ────────────────────────────────────────────── */
  const workbooks = useMemo(() => products.filter(p => p.type === 'workbook'), [products]);

  const getDigitalLicenseForGroup = (mainGroup: string) => {
    const isSpecial = ['Matematika', 'Prvouka', '\u010cesk\u00fd jazyk']
      .some(s => mainGroup.includes(s)) || mainGroup.includes('1. stupe\u0148');
    const onlineProduct = products.find(p => {
      if (p.type !== 'online') return false;
      const cat  = (p.category || '').toLowerCase();
      const main = mainGroup.toLowerCase();
      if (cat === main || main.includes(cat) || cat.includes(main)) return true;
      if (main.includes('matematika') && cat.includes('matematika')) {
        if (main.includes('1') && (cat.includes('1') || !cat.includes('2'))) return true;
        if (main.includes('2') && cat.includes('2')) return true;
      }
      return false;
    });
    return {
      id: onlineProduct?.id || `license-${mainGroup}`,
      name: onlineProduct?.name || 'Digit\u00e1ln\u00ed u\u010debnice',
      type: 'license',
      category: mainGroup,
      price: onlineProduct?.price || 'Cena podle po\u010dtu \u017e\u00e1k\u016f',
      specialText: onlineProduct?.note || onlineProduct?.poznamka || (isSpecial ? 'ZDARMA OD 15 KS SE\u0160IT\u016e' : null),
      image: onlineProduct?.image || 'https://images.unsplash.com/photo-1649929640997-cce847b8d098?auto=format&fit=crop&q=80&w=400',
      description: getDefaultDescription(onlineProduct || { category: mainGroup, type: 'online' }),
      flipbookLink: onlineProduct?.flipbookLink || '',
    };
  };

  const groupedWorkbooks = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    workbooks.forEach(p => {
      const lowerName = p.name.toLowerCase();
      const gradeMatch = p.name.match(/(\d+)/);
      const gradeNum   = gradeMatch ? parseInt(gradeMatch[0]) : 0;
      let mainGroup = '', subGroup = '', rocnik = '';
      const cat = p.category;
      if (cat === '\u010cesk\u00fd jazyk')  rocnik = '1. ro\u010dn\u00edk';
      else if (cat === 'Chemie') {
        if (lowerName.includes('1. d\u00edl')) rocnik = '8. ro\u010dn\u00edk';
        else if (lowerName.includes('2. d\u00edl')) rocnik = '9. ro\u010dn\u00edk';
        else rocnik = gradeNum > 0 ? `${gradeNum}. ro\u010dn\u00edk` : 'Dopl\u0148kov\u00e9 materi\u00e1ly';
      } else {
        rocnik = gradeNum > 0 ? `${gradeNum}. ro\u010dn\u00edk` : 'Dopl\u0148kov\u00e9 materi\u00e1ly';
      }
      if (groupingMode === 'grade') {
        mainGroup = (cat.includes('2. stupe\u0148') || secondGradeSubjects.includes(cat)) ? '2. stupe\u0148' : '1. stupe\u0148';
        subGroup  = rocnik;
      } else {
        mainGroup = cat;
        if (mainGroup === 'Matematika 2. stupe\u0148') {
          if (lowerName.includes('pro v\u0161echny')) subGroup = 'Pracovn\u00ed se\u0161ity pro v\u0161echny';
          else if (lowerName.includes('krok za krokem')) subGroup = 'Krok za krokem';
          else subGroup = '_all';
        } else { subGroup = '_all'; }
      }
      if (!groups[mainGroup]) groups[mainGroup] = {};
      if (!groups[mainGroup][subGroup]) groups[mainGroup][subGroup] = [];
      groups[mainGroup][subGroup].push(p);
    });
    Object.values(groups).forEach(mg =>
      Object.values(mg).forEach(arr =>
        arr.sort((a, b) => {
          if ((a.category || '').includes('\u010cesk\u00fd jazyk') || (a.category || '').includes('Matematika')) {
            const pa = a.poradi ?? 999, pb = b.poradi ?? 999;
            if (pa !== pb) return pa - pb;
          }
          const getGrade = (n: string) => { const m = n.match(/(\d+)\.?\s*(ro\u010dn\u00edk|t\u0159\u00edda)/i); return m ? parseInt(m[1]) : 0; };
          const getPart  = (n: string) => { const m = n.match(/(\d+)\.?\s*d\u00edl/i); return m ? parseInt(m[1]) : 0; };
          const gA = getGrade(a.name), gB = getGrade(b.name);
          if (gA !== gB) return gA - gB;
          return getPart(a.name) - getPart(b.name);
        }),
      ),
    );
    return groups;
  }, [workbooks, groupingMode]);

  const sortedGroups = useMemo(() => {
    const order = ['Matematika 2. stupe\u0148', 'Fyzika', 'P\u0159\u00edrodopis', 'Chemie', 'Matematika 1. stupe\u0148', '\u010cesk\u00fd jazyk', 'Prvouka', 'Ostatn\u00ed'];
    return Object.entries(groupedWorkbooks).sort(([a], [b]) => {
      if (groupingMode === 'grade') return a.localeCompare(b);
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [groupedWorkbooks, groupingMode]);

  /* ── distributor download ────────────────────────────────── */
  const handleDownloadSingle = (e: React.MouseEvent, book: any) => {
    e.stopPropagation();
    const slug = book.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
    const info = `N\u00e1zev: ${book.name}\nDolo\u017eka M\u0160MT: ${book.dolozka || 'Ne'}\nCena: ${book.price}\nPozn\u00e1mka: ${book.note || book.poznamka || 'N/A'}\nForm\u00e1t: ${book.format || 'N/A'}\nPo\u010det stran: ${book.pocetStranek || 'N/A'}\nRok vyd\u00e1n\u00ed: ${book.rokVydani || 'N/A'}\nAuto\u0159i: ${book.autori || 'N/A'}`;
    const url = URL.createObjectURL(new Blob([info], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${slug}_info.txt` });
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url);
    if (book.image) {
      const b = Object.assign(document.createElement('a'), { href: book.image, download: `${slug}_foto.jpg`, target: '_blank' });
      b.click();
    }
  };

  /* ── visible card count for collapsed rows ───────────────── */
  const visibleCardCount = useMemo(() => {
    const sidebarW = 245;
    const paddingX = 64; // md:px-8 = 32px each side
    const cardW = 207;
    const gapW = 20;
    const contentW = Math.max(windowWidth - sidebarW - paddingX, 300);
    // how many cards fit + 1 partial for the "more" hint
    return Math.max(2, Math.floor((contentW + gapW) / (cardW + gapW)));
  }, [windowWidth]);

  /* ── scroll refs per group ───────────────────────────────── */
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ── render card ─────────────────────────────────────────── */
  const renderCard = (book: any, compact = false) => (
    <UnifiedBookCard
      key={book.id}
      book={book}
      onClick={() => navigate(`/produkt/${encodeURIComponent(book.id)}`)}
      variant={compact ? 'related' : 'catalog'}
      isDistributorMode={isDistributorMode}
      onDownload={handleDownloadSingle}
      hideSubjectBadgeOnMobile={compact}
    />
  );

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <>
      {/* SEO */}
      <SEOHead
        path="/"
        description="Kompletn\u00ed katalog interaktivn\u00edch digit\u00e1ln\u00edch u\u010debnic a pracovn\u00edch se\u0161it\u016f Vividbooks pro \u010desk\u00e9 z\u00e1kladn\u00ed \u0161koly. Matematika, fyzika, chemie, p\u0159\u00edrodopis a dal\u0161\u00ed."
      />
      {/* Hero Slider — šipky přes okrajové peek slidery (bez mezery); bez teček; jen pokud jsou slidery (CMS / webinář / notifikace) */}
      {REAL_N > 0 ? (
      <div className={isPeekMode ? 'pt-4 md:pt-8' : 'p-4 md:p-8'}>
        <div
          className={`relative w-full min-h-0 overflow-hidden select-none ${isPeekMode ? '' : 'rounded-[35px]'}`}
          style={{ height: HERO_SLIDER_HEIGHT_PX }}
          onMouseEnter={() => {
            isHoveredRef.current = true;
            if (heroTimerRef.current) { clearInterval(heroTimerRef.current); heroTimerRef.current = null; }
          }}
          onMouseLeave={() => {
            isHoveredRef.current = false;
            startHeroTimer();
          }}
        >
          <div
            className="flex h-full min-h-0"
            style={{
              transform: isPeekMode
                ? `translateX(calc(${INIT_OFFSET}% - ${heroSlide * SLOT_W}%))`
                : `translateX(-${heroSlide * 100}%)`,
              transition: heroAnimate
                ? `transform ${HERO_TRANSFORM_MS}ms cubic-bezier(0.45, 0, 0.2, 1)`
                : 'none',
            }}
          >
            {extSlides.map((baseSlide, idx) => {
              const slideView =
                heroNarrowViewport && (baseSlide as any)._phoneMapped
                  ? (baseSlide as any)._phoneMapped
                  : baseSlide;
              const isLight = !!(slideView as any).textLight;
              const heroFullImageLayout =
                slideView.layout === 'hero-full-image' && Boolean((slideView as any).image);
              const leftImageBleed =
                slideView.layout === 'left-image' &&
                !!(slideView as any).image &&
                !!(slideView as any).imageEdgeToEdge;
              const leftImageWithPhoto =
                slideView.layout === 'left-image' && Boolean((slideView as any).image);
              const leftImageColPct = clampHeroImageColumnPercent((slideView as any).imageColumnPercent);
              const heroAccent = (slideView as any).heroTextColor as string | undefined;
              const heroAlignStart = (slideView as any).heroTextAlign === 'start';
              const accentForUi = !isLight && heroAccent ? heroAccent : undefined;
              const textWrapStyle: React.CSSProperties | undefined = accentForUi ? { color: accentForUi } : undefined;
              const booksFanZOrderNorm = normalizeHeroBooksFanZOrder((slideView as any).booksFanZOrder);
              const booksGridRotationSeed = normalizeTitlePlayfulSeed((slideView as any).titlePlayfulSeed);
              const slideIsBooksFan = (slideView as any).layout === 'books-fan';
              const slideIsBooksFanBelow = (slideView as any).layout === 'books-fan-below';
              const slideIsBooksFanAbove = (slideView as any).layout === 'books-fan-above';
              const slideIsBooksFanStacked = slideIsBooksFanBelow || slideIsBooksFanAbove;
              const booksFanTextColCenter =
                (slideIsBooksFan || slideIsBooksFanStacked) &&
                (slideView as any).heroImageColumnAlign === 'center';
              const collageOx = clampHeroBooksFanCollageOffsetXPx((slideView as any).booksFanCollageOffsetXPx);
              const collageOy = clampHeroBooksFanCollageOffsetYPx(
                (slideView as any).booksFanCollageOffsetYPx ?? (slideView as any).booksFanBelowLiftPx,
              );
              const collageTransformBelow = `translate(${collageOx}px, ${-collageOy}px)`;
              const collageTransformAbove = `translate(${collageOx}px, ${collageOy}px)`;
              /** extSlides[0] = klon posledního; [1],[2] = první dva viditelné slidery nahoře. */
              const heroSlideImagePriority = idx === 1 || idx === 2;
              const heroCoverHex = heroSurfaceHexFromSlide(slideView as any);
              const heroCoverShadowFull = heroBookCoverShadowFilter(heroCoverHex);
              return (
              <div
                key={idx}
                className={`@container ${slideView.bg} relative flex h-full min-h-0 max-h-full flex-shrink-0 flex-col ${
                  slideIsBooksFan || slideIsBooksFanStacked ? 'overflow-visible' : 'overflow-hidden'
                } cursor-pointer ${isLight ? 'text-white' : 'text-[#001161]'} ${
                  heroFullImageLayout
                    ? 'p-0'
                    : leftImageBleed
                      ? 'py-0 pl-8 pr-0'
                      : slideIsBooksFan
                        ? 'py-0 pl-8 pr-0'
                        : slideIsBooksFanBelow
                          ? 'px-0 pb-0 pt-3 md:px-0 md:pb-0 md:pt-4'
                          : slideIsBooksFanAbove
                            ? 'px-0 pt-0 pb-3 md:px-0 md:pt-0 md:pb-4'
                            : leftImageWithPhoto && !leftImageBleed
                              ? '@max-[519px]:px-0 @max-[519px]:pb-0 @max-[519px]:pt-6 @min-[520px]:px-6 @min-[520px]:py-6 md:px-8 md:py-7'
                              : 'px-6 py-6 md:px-8 md:py-7'
                }`}
                style={{
                  ...(isPeekMode
                    ? { width: `${SLIDE_W}%`, marginRight: `${GAP_W}%`, borderRadius: '35px' }
                    : { width: '100%' }),
                  ...((slideView as any).bgStyle ? { backgroundColor: (slideView as any).bgStyle } : {}),
                }}
                onClick={() => {
                  const href = String((slideView as any).link || '').trim();
                  if (!href) return;
                  if (/^https?:\/\//i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
                  else if (href.startsWith('mailto:') || href.startsWith('tel:')) window.location.href = href;
                  else navigate(href);
                }}
              >
                <motion.div
                  className={`flex min-h-0 min-w-0 flex-1 flex-col ${
                    slideIsBooksFan || slideIsBooksFanStacked ? 'overflow-visible' : ''
                  }`}
                  initial={false}
                  animate={
                    heroNarrowViewport
                      ? idx === heroSlide
                        ? { opacity: 1 }
                        : heroAnimate
                          ? { opacity: 0 }
                          : { opacity: 1 }
                      : idx === heroSlide
                        ? { opacity: 1, y: 0 }
                        : heroAnimate
                          ? { opacity: 0, y: 12 }
                          : { opacity: 1, y: 0 }
                  }
                  transition={{ duration: HERO_CONTENT_FADE_MS / 1000, ease: [0.45, 0, 0.2, 1] }}
                >
                {slideView.layout === 'webinar' ? (
                  /* ── Webinář layout: pulsující kolečko + countdown + thumbnail ── */
                  <div className="flex min-h-0 min-w-0 flex-1 items-center gap-4 z-10">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start overflow-y-auto overscroll-y-contain pl-8 pr-8 md:pl-14 md:pr-10">
                      {/* Pulsující kolečko + label */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="relative flex h-3.5 w-3.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-400"></span>
                        </span>
                        <span className="text-white/70 text-[11px] uppercase tracking-widest font-bold leading-none" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                          {(slideView as any)._isLive ? 'Právě probíhá' : 'Začíná za chvíli'}
                        </span>
                      </div>
                      {/* Nadpis (menší) */}
                      <h1
                        className="font-['Cooper_Light',serif] leading-[1.05] mb-1 tracking-tight break-words whitespace-pre-line"
                        style={{
                          fontSize: heroHeadingFontSizeClamp(slideView.title, 'webinar'),
                          WebkitFontSmoothing: 'antialiased',
                          transform: 'translateZ(0.02px)',
                        }}
                        title={slideView.title}
                      >
                        {slideView.title}
                      </h1>
                      {/* Název webináře */}
                      <p
                        className="text-white/65 text-[13px] md:text-[15px] mb-3 whitespace-pre-line leading-snug break-words"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        title={slideView.subtitle}
                      >
                        {slideView.subtitle}
                      </p>
                      {/* Odpočítávání */}
                      {!(slideView as any)._isLive && (
                        <div className="flex items-end gap-1.5 mb-5">
                          {[
                            { v: webinarCountdown.hours,   l: 'h'   },
                            { v: webinarCountdown.minutes, l: 'min' },
                          ].map(({ v, l }, i) => (
                            <React.Fragment key={l}>
                              {i > 0 && <span className="text-white/25 text-[20px] font-thin pb-3">:</span>}
                              <div className="flex flex-col items-center">
                                <div className="bg-white/15 backdrop-blur-sm rounded-xl w-[48px] md:w-[56px] h-[44px] md:h-[52px] flex items-center justify-center">
                                  <span className="text-white font-black text-[20px] md:text-[24px] leading-none tabular-nums" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                                    {String(v).padStart(2, '0')}
                                  </span>
                                </div>
                                <span className="text-white/40 text-[9px] uppercase tracking-wide mt-1 font-bold" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>{l}</span>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                      {/* Badges */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        {slideView.badges.map(b => <CheckBadge key={b} label={b} light />)}
                      </div>
                      {/* CTA */}
                      <p
                        className="text-[15px] md:text-[18px] xl:text-[20px] break-words whitespace-pre-line leading-snug"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        title={slideView.bottom}
                      >
                        {slideView.bottom}
                      </p>
                    </div>
                    {/* Thumbnail vpravo — jako WebinarCard dlaždice */}
                    <div className="hidden w-[40%] shrink-0 items-center justify-end py-4 pr-6 md:flex lg:pr-10">
                      <div
                        className="flex w-full max-w-[320px] flex-col overflow-hidden rounded-[20px] bg-[#F0F2F8] shadow-[0_8px_40px_rgba(0,0,0,0.4)] lg:max-w-[380px] xl:max-w-[440px] 2xl:max-w-[500px]"
                        onClick={e => { e.stopPropagation(); navigate(`/webinar/${(slideView as any)._webinar?.id}`); }}
                      >
                        {/* Cover image — omezená výška, aby neroztahovala celý hero */}
                        <div className="relative aspect-video max-h-[100px] w-full shrink-0 overflow-hidden rounded-t-[20px] sm:max-h-[110px] md:max-h-[125px] lg:max-h-[140px]">
                          <img
                            src={(slideView as any).image}
                            alt={slideView.title}
                            className="absolute inset-0 size-full object-cover"
                            loading={heroSlideImagePriority ? 'eager' : 'lazy'}
                            fetchPriority={heroSlideImagePriority ? 'high' : 'low'}
                          />
                        </div>
                        {/* Bottom info bar */}
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white/0">
                          {/* Date badge */}
                          <div className="shrink-0 flex flex-col items-center bg-white rounded-[10px] px-2 py-1.5 min-w-[40px]">
                            <span className="font-['Fenomen_Sans',sans-serif] font-black text-[#001158] text-[16px] leading-none">
                              {(slideView as any)._webinar?.day}
                            </span>
                            <span className="font-['Fenomen_Sans',sans-serif] text-[9px] text-[#001158]/60 leading-tight">
                              {(slideView as any)._webinar?.monthName}
                            </span>
                            <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[10px] leading-none mt-0.5" style={{ color: '#FF8C00' }}>
                              {(slideView as any)._webinar?.time}
                            </span>
                          </div>
                          {/* Title */}
                          <p className="font-['Fenomen_Sans',sans-serif] text-[#001158] text-[12px] font-semibold leading-snug flex-1 line-clamp-2">
                            {(slideView as any)._webinar?.title}
                          </p>
                          {/* CTA */}
                          <button
                            className="shrink-0 bg-[#FF8C00] hover:bg-[#e67d00] text-white font-['Fenomen_Sans',sans-serif] font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
                            onClick={e => { e.stopPropagation(); navigate(`/webinar/${(slideView as any)._webinar?.id}`); }}
                          >
                            {(slideView as any)._isLive ? 'Vstoupit' : 'P\u0159ihl\u00e1sit se'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (slideView as any).layout === 'books-fan-above' ? (
                  /* ── Obálky nahoře + text pod: na úzkém slidu pod sebou bez překryvu; na širokém původní překryv. */
                  <div className="relative z-10 h-full min-h-0 w-full flex-1 overflow-visible">
                    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 pt-2 @min-[680px]:hidden">
                      <div
                        className="relative z-10 flex shrink-0 justify-center px-0 pt-1"
                        style={{ transform: collageTransformAbove }}
                      >
                        <HeroBooksFanCovers
                          books={((slideView as any).books as { id: string; name: string; image: string }[]) || []}
                          arrangement={(slideView as any).booksFanArrangement}
                          gapPx={(slideView as any).booksFanGapPx}
                          scalePct={(slideView as any).booksFanScalePct}
                          coverShadow={heroCoverShadowFull}
                          variant="catalog"
                          navigate={navigate}
                          priorityImageLoading={heroSlideImagePriority}
                          fanZOrder={booksFanZOrderNorm}
                          gridRotationSeed={booksGridRotationSeed}
                          maxItems={5}
                          showEmptyHint={Boolean((slideView as any).booksFanShowEmptyHint)}
                          emptyHint={
                            <>
                              Vyberte produkty ve vizuálním editoru nebo doplňte ID v kolekci Hero slidy (max. 6 titulů;
                              bez obálky se zobrazí placeholder).
                            </>
                          }
                        />
                      </div>
                      <div
                        className={`relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-2 pb-3 ${
                          booksFanTextColCenter ? 'items-center text-center' : 'items-start text-left'
                        }`}
                        style={textWrapStyle}
                      >
                        <CmsHeroOrderedBlocks
                          slide={slideView as any}
                          variant="centerBelow"
                          heroAlignStart={!booksFanTextColCenter}
                          isLight={isLight}
                          accentForUi={accentForUi}
                          navigate={navigate}
                        />
                      </div>
                    </div>
                    <div className="relative hidden h-full min-h-0 w-full flex-1 flex-col overflow-visible @min-[680px]:flex">
                      <div
                        className="absolute inset-x-0 top-0 z-20 flex min-w-0 items-start justify-center overflow-x-auto overflow-y-visible px-0 pt-2 md:pt-3"
                        style={{
                          minHeight: heroBooksFanBelowShelfMinPx((slideView as any).booksFanBelowShelfPercent),
                          paddingBottom: heroBooksFanBelowCollageTopBleedPx(collageOy),
                        }}
                      >
                        <div
                          className="flex w-full max-w-none justify-center"
                          style={{ transform: collageTransformAbove }}
                        >
                          <HeroBooksFanCovers
                            books={((slideView as any).books as { id: string; name: string; image: string }[]) || []}
                            arrangement={(slideView as any).booksFanArrangement}
                            gapPx={(slideView as any).booksFanGapPx}
                            scalePct={(slideView as any).booksFanScalePct}
                            coverShadow={heroCoverShadowFull}
                            variant="catalog"
                            navigate={navigate}
                            priorityImageLoading={heroSlideImagePriority}
                            fanZOrder={booksFanZOrderNorm}
                            gridRotationSeed={booksGridRotationSeed}
                            showEmptyHint={Boolean((slideView as any).booksFanShowEmptyHint)}
                            emptyHint={
                              <>
                                Vyberte produkty ve vizuálním editoru nebo doplňte ID v kolekci Hero slidy (max. 6 titulů;
                                bez obálky se zobrazí placeholder).
                              </>
                            }
                          />
                        </div>
                      </div>
                      <div
                        className={`relative z-0 mt-auto flex flex-col overflow-visible px-6 pb-3 pt-1 md:px-8 md:pb-4 ${
                          booksFanTextColCenter ? 'items-center text-center' : 'items-start text-left'
                        }`}
                        style={textWrapStyle}
                      >
                        <CmsHeroOrderedBlocks
                          slide={slideView as any}
                          variant="centerBelow"
                          heroAlignStart={!booksFanTextColCenter}
                          isLight={isLight}
                          accentForUi={accentForUi}
                          navigate={navigate}
                        />
                      </div>
                    </div>
                  </div>
                ) : (slideView as any).layout === 'books-fan-below' ? (
                  /* ── Text + obálky pod: úzký slide = sloupec bez překryvu; široký = překryv jako dřív. */
                  <div className="relative z-10 h-full min-h-0 w-full flex-1 overflow-visible">
                    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-3 pt-2 @min-[680px]:hidden">
                      <div
                        className={`relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-2 pb-1 ${
                          booksFanTextColCenter ? 'items-center text-center' : 'items-start text-left'
                        }`}
                        style={textWrapStyle}
                      >
                        <CmsHeroOrderedBlocks
                          slide={slideView as any}
                          variant="centerBelow"
                          heroAlignStart={!booksFanTextColCenter}
                          isLight={isLight}
                          accentForUi={accentForUi}
                          navigate={navigate}
                        />
                      </div>
                      <div
                        className="relative z-10 flex shrink-0 justify-center px-1 pb-2"
                        style={{ transform: collageTransformBelow }}
                      >
                        <HeroBooksFanCovers
                          books={((slideView as any).books as { id: string; name: string; image: string }[]) || []}
                          arrangement={(slideView as any).booksFanArrangement}
                          gapPx={(slideView as any).booksFanGapPx}
                          scalePct={(slideView as any).booksFanScalePct}
                          coverShadow={heroCoverShadowFull}
                          variant="catalog"
                          navigate={navigate}
                          priorityImageLoading={heroSlideImagePriority}
                          fanZOrder={booksFanZOrderNorm}
                          gridRotationSeed={booksGridRotationSeed}
                          maxItems={5}
                          showEmptyHint={Boolean((slideView as any).booksFanShowEmptyHint)}
                          emptyHint={
                            <>
                              Vyberte produkty ve vizuálním editoru nebo doplňte ID v kolekci Hero slidy (max. 6 titulů;
                              bez obálky se zobrazí placeholder).
                            </>
                          }
                        />
                      </div>
                    </div>
                    <div className="relative hidden h-full min-h-0 w-full flex-1 overflow-visible @min-[680px]:block">
                      <div
                        className={`relative z-0 flex flex-col overflow-visible px-6 pb-1 pt-3 md:px-8 md:pt-4 ${
                          booksFanTextColCenter ? 'items-center text-center' : 'items-start text-left'
                        }`}
                        style={textWrapStyle}
                      >
                        <CmsHeroOrderedBlocks
                          slide={slideView as any}
                          variant="centerBelow"
                          heroAlignStart={!booksFanTextColCenter}
                          isLight={isLight}
                          accentForUi={accentForUi}
                          navigate={navigate}
                        />
                      </div>
                      <div
                        className="absolute inset-x-0 bottom-0 z-20 flex min-w-0 items-end justify-center overflow-x-auto overflow-y-visible px-0 pb-2 md:pb-3"
                        style={{
                          minHeight: heroBooksFanBelowShelfMinPx((slideView as any).booksFanBelowShelfPercent),
                          paddingTop: heroBooksFanBelowCollageTopBleedPx(collageOy),
                        }}
                      >
                        <div
                          className="flex w-full max-w-none justify-center"
                          style={{ transform: collageTransformBelow }}
                        >
                          <HeroBooksFanCovers
                            books={((slideView as any).books as { id: string; name: string; image: string }[]) || []}
                            arrangement={(slideView as any).booksFanArrangement}
                            gapPx={(slideView as any).booksFanGapPx}
                            scalePct={(slideView as any).booksFanScalePct}
                            coverShadow={heroCoverShadowFull}
                            variant="catalog"
                            navigate={navigate}
                            priorityImageLoading={heroSlideImagePriority}
                            fanZOrder={booksFanZOrderNorm}
                            gridRotationSeed={booksGridRotationSeed}
                            showEmptyHint={Boolean((slideView as any).booksFanShowEmptyHint)}
                            emptyHint={
                              <>
                                Vyberte produkty ve vizuálním editoru nebo doplňte ID v kolekci Hero slidy (max. 6 titulů;
                                bez obálky se zobrazí placeholder).
                              </>
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (slideView as any).layout === 'books-fan' ? (
                  /* ── Text + obálky: úzký slide = celá šířka textu pak koláž; od ~720px dva sloupce. */
                  <div
                    className="z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-visible px-3 py-4 @min-[720px]:grid @min-[720px]:h-full @min-[720px]:grid-rows-1 @min-[720px]:gap-0 @min-[720px]:overflow-visible @min-[720px]:px-0 @min-[720px]:py-0"
                    style={{
                      gridTemplateColumns: `minmax(0, 1fr) ${clampHeroBooksFanColumnPercent((slideView as any).booksFanColumnPercent)}%`,
                    }}
                  >
                    <div
                      className={`relative z-0 flex min-h-0 min-w-0 flex-1 flex-col justify-start overflow-y-auto overscroll-y-contain @min-[720px]:justify-center @min-[720px]:py-8 @min-[720px]:pb-3 @min-[720px]:pl-0 @min-[720px]:pr-5 ${
                        booksFanTextColCenter ? 'items-center' : 'items-start'
                      }`}
                      style={textWrapStyle}
                    >
                      <CmsHeroOrderedBlocks
                        slide={slideView as any}
                        variant="booksFan"
                        heroAlignStart={false}
                        leftImageTextCenter={booksFanTextColCenter}
                        isLight={isLight}
                        accentForUi={accentForUi}
                        navigate={navigate}
                      />
                    </div>
                    <div className="relative z-10 flex w-full shrink-0 justify-center overflow-x-auto overflow-y-visible px-1 pb-1 @min-[720px]:h-full @min-[720px]:min-h-0 @min-[720px]:min-w-0 @min-[720px]:items-center @min-[720px]:justify-center @min-[720px]:px-0 @min-[720px]:py-0">
                      <div style={{ transform: collageTransformBelow }}>
                        <HeroBooksFanCovers
                          books={((slideView as any).books as { id: string; name: string; image: string }[]) || []}
                          arrangement={(slideView as any).booksFanArrangement}
                          gapPx={(slideView as any).booksFanGapPx}
                          scalePct={(slideView as any).booksFanScalePct}
                          coverShadow={heroCoverShadowFull}
                          variant="catalog"
                          navigate={navigate}
                          priorityImageLoading={heroSlideImagePriority}
                          fanZOrder={booksFanZOrderNorm}
                          gridRotationSeed={booksGridRotationSeed}
                          maxItems={5}
                          showEmptyHint={Boolean((slideView as any).booksFanShowEmptyHint)}
                          emptyHint={
                            <>
                              Vyberte produkty ve vizuálním editoru nebo doplňte ID v kolekci Hero slidy (max. 6 titulů;
                              bez obálky se zobrazí placeholder).
                            </>
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : heroFullImageLayout ? (
                  /* ── Fullscreen fotka + text v zaoblených kartách (sklo). */
                  <div className="relative z-10 h-full min-h-0 w-full flex-1 overflow-hidden">
                    <img
                      src={(slideView as any).image}
                      alt={slideView.title}
                      className="pointer-events-none absolute inset-0 z-0 size-full object-cover"
                      loading={heroSlideImagePriority ? 'eager' : 'lazy'}
                      fetchPriority={heroSlideImagePriority ? 'high' : 'low'}
                      style={heroLeftImageImgStyle(
                        (slideView as any).heroImageScalePct,
                        (slideView as any).heroImagePosXPct,
                        (slideView as any).heroImagePosYPct,
                      )}
                    />
                    <div
                      className={`relative z-10 flex h-full min-h-0 w-full flex-col justify-center overflow-y-auto overscroll-y-contain px-4 py-3 md:px-7 md:py-5 ${
                        (slideView as any).heroImageColumnAlign === 'center' ? 'items-center' : 'items-start'
                      }`}
                      style={textWrapStyle}
                    >
                      <CmsHeroOrderedBlocks
                        slide={slideView as any}
                        variant="fullImage"
                        heroAlignStart={heroAlignStart}
                        isLight={isLight}
                        accentForUi={accentForUi}
                        navigate={navigate}
                      />
                    </div>
                  </div>
                ) : slideView.layout === 'left-image' && (slideView as any).image ? (
                  /* ── Text + obrázek: úzký kontejner = text nahoře + fotka dole; od šířky kontejneru slidu (viz HERO_LEFT_IMAGE_SIDE_BY_SIDE_MIN_CONTAINER_PX) text vlevo | obrázek vpravo. */
                  <div
                    className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col gap-2 overflow-x-visible overflow-y-visible @min-[520px]:grid @min-[520px]:grid-rows-1 @min-[520px]:gap-0 @min-[520px]:overflow-hidden"
                    style={{ gridTemplateColumns: `minmax(0, 1fr) ${leftImageColPct}%` }}
                  >
                    <div
                      className={`flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center overflow-y-auto overscroll-y-contain px-5 pt-3 pb-1 @min-[520px]:basis-auto @min-[520px]:px-6 @min-[520px]:pl-4 @min-[520px]:pr-6 ${leftImageBleed ? '@min-[520px]:py-8' : '@min-[520px]:pb-3'}`}
                      style={textWrapStyle}
                    >
                      <CmsHeroOrderedBlocks
                        slide={slideView as any}
                        variant="leftImage"
                        heroAlignStart={false}
                        leftImageTextCenter={(slideView as any).heroImageColumnAlign === 'center'}
                        isLight={isLight}
                        accentForUi={accentForUi}
                        navigate={navigate}
                      />
                    </div>
                    <div
                      className={`relative min-h-0 w-full min-w-0 flex-1 basis-0 shrink-0 self-stretch overflow-hidden @max-[519px]:rounded-none @min-[520px]:flex-none @min-[520px]:h-full @min-[520px]:min-h-0 @min-[520px]:min-w-0 @min-[520px]:w-full @min-[520px]:self-stretch @min-[520px]:rounded-2xl @min-[520px]:m-0 ${
                        leftImageBleed ? '@min-[520px]:rounded-none' : ''
                      }`}
                    >
                      <img
                        src={slideView.image}
                        alt={slideView.title}
                        className="absolute inset-0 size-full"
                        loading={heroSlideImagePriority ? 'eager' : 'lazy'}
                        fetchPriority={heroSlideImagePriority ? 'high' : 'low'}
                        style={heroLeftImageImgStyle(
                          (slideView as any).heroImageScalePct,
                          (slideView as any).heroImagePosXPct,
                          (slideView as any).heroImagePosYPct,
                        )}
                      />
                    </div>
                  </div>
                ) : (
                  /* ─ Centered text layout (default) ──
                     Vnější řádek centruje blok svisle; uvnitř max-h-full + scroll pro dlouhé texty.
                     `heroTextAlign === 'start'` = text vlevo bez obrázku (vizuální editor). */
                  <div
                    className={`z-10 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden px-2 py-1 ${
                      heroAlignStart ? 'items-start justify-center md:pl-4' : 'items-center justify-center'
                    }`}
                  >
                    <div
                      className={`flex max-h-full min-h-0 w-full flex-col overflow-y-auto overscroll-y-contain py-1 ${
                        heroAlignStart ? 'max-w-4xl items-start text-left' : 'items-center text-center'
                      }`}
                      style={textWrapStyle}
                    >
                      <CmsHeroOrderedBlocks
                        slide={slideView as any}
                        variant="center"
                        heroAlignStart={heroAlignStart}
                        isLight={isLight}
                        accentForUi={accentForUi}
                        navigate={navigate}
                      />
                    </div>
                  </div>
                )}
                </motion.div>
              </div>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Předchozí slide"
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(heroSlide - 1);
            }}
            className="absolute left-2 top-1/2 z-30 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#001161]/10 bg-white/90 shadow-md transition-all hover:bg-white active:scale-90 md:left-3"
          >
            <svg className="size-5 text-[#001161]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Následující slide"
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(heroSlide + 1);
            }}
            className="absolute right-2 top-1/2 z-30 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#001161]/10 bg-white/90 shadow-md transition-all hover:bg-white active:scale-90 md:right-3"
          >
            <svg className="size-5 text-[#001161]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      ) : null}

      {/* Webinar bobánek — vždy zobrazí nejbližší webinář */}
      {(nextWebinarForBobanak || notifBobanak) && (
      <div className="flex justify-center px-4 mt-5 mb-1">
        <div
          className="inline-flex items-center gap-3 bg-[#FEF0E4] border border-[#F4C49E] text-[#001161] rounded-2xl px-5 py-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          style={{ transform: 'rotate(-1.5deg)' }}
          onClick={() => {
            if (notifBobanak?.link) navigate(notifBobanak.link);
            else if (nextWebinarForBobanak) navigate(`/webinar/${nextWebinarForBobanak.w.id}`);
            else navigate('/webinare');
          }}
        >
          <span className="text-lg leading-none">
            {notifBobanak?.emoji || '\uD83D\uDD14'}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-['Fenomen_Sans',sans-serif] text-[10px] uppercase tracking-widest opacity-55 leading-none font-bold">
              {notifBobanak?.type === 'custom' ? 'Upozorn\u011bn\u00ed' : 'Bl\u00ed\u017e\u00ed se webinář'}
            </span>
            <span className="font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug opacity-85 font-bold">
              {notifBobanak
                ? `${notifBobanak.title}${notifBobanak.subtitle ? '\u00a0\u2014 ' + notifBobanak.subtitle : ''}`
                : nextWebinarForBobanak
                  ? `${nextWebinarForBobanak.w.title}\u00a0\u2014 ${nextWebinarForBobanak.w.day}. ${nextWebinarForBobanak.w.monthName} v\u00a0${nextWebinarForBobanak.w.time}`
                  : ''}
            </span>
          </div>
          <span className="text-[#001161]/40 text-base leading-none ml-1">{'\u203A'}</span>
        </div>
      </div>
      )}

      {/* Product groups */}
      <div className="px-4 md:px-8 mt-8">
        {sortedGroups.map(([mainGroup, subGroups], idx) => {
          const isExpanded  = expandedGroups.has(mainGroup);
          const isSecondGrd = secondGradeSubjects.includes(mainGroup) || mainGroup === '2. stupe\u0148';
          const nextEntry   = sortedGroups[idx + 1];
          const isLastSecond = isSecondGrd && nextEntry && !secondGradeSubjects.includes(nextEntry[0]) && nextEntry[0] !== '2. stupe\u0148';
          const isFirstGrd  = firstGradeSubjects.includes(mainGroup) || mainGroup === '1. stupe\u0148';
          const isLastFirst  = isFirstGrd && (!nextEntry || (!firstGradeSubjects.includes(nextEntry[0]) && nextEntry[0] !== '1. stupe\u0148'));

          const sortedSubEntries = Object.entries(subGroups).sort(([a], [b]) => {
            if (a === 'Krok za krokem') return -1;
            if (b === 'Krok za krokem') return 1;
            return a.localeCompare(b);
          });
          const allRowBooks: any[] = [
            getDigitalLicenseForGroup(mainGroup),
            ...sortedSubEntries.flatMap(([, books]) => books),
          ];

          return [
            <div
              key={mainGroup}
              id={groupingMode === 'subject' ? mainGroup.replace(/\s+/g, '-').toLowerCase() : undefined}
              className={`mb-4 ${groupingMode === 'subject' ? 'catalog-section scroll-mt-24' : ''}`}
            >
              <div className="relative z-10 mb-1 flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                <h2
                  className="text-[#001161] font-['Cooper_Light',serif] text-[24px] md:text-[34px] xl:text-[41px] leading-tight shrink-0 cursor-pointer hover:opacity-75 transition-opacity whitespace-nowrap"
                  onClick={() => navigate(`/predmet/${subjectToSlug(mainGroup)}`)}
                >
                  {mainGroup}
                </h2>
                <div className="flex w-full items-center justify-between gap-3 md:ml-auto md:w-auto md:justify-start">
                  <button
                    onClick={() => navigate(`/predmet/${subjectToSlug(mainGroup)}`)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#001161] text-[#001161] hover:bg-[#001161] hover:text-white font-['Fenomen_Sans',sans-serif] text-[13px] font-bold whitespace-nowrap transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer group/openbtn"
                  >
                    {'Otev\u0159\u00edt cel\u00fd p\u0159edm\u011bt'}
                    <svg className="w-3.5 h-3.5 shrink-0 transition-transform group-hover/openbtn:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                  {!isExpanded && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Šipka zpět — zobrazí se až po odscrollování */}
                      {(scrollPositions[mainGroup] ?? 0) > 10 && (
                        <button
                          onClick={() => scrollRefs.current[mainGroup]?.scrollBy({ left: -CARD_SCROLL, behavior: 'smooth' })}
                          className="flex items-center justify-center size-9 rounded-full border-2 border-[#001161]/25 text-[#001161] hover:bg-[#001161] hover:text-white hover:border-[#001161] transition-all cursor-pointer active:scale-90"
                          aria-label="Posunout doleva"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      )}
                      {/* Šipka doprava */}
                      <button
                        onClick={() => scrollRefs.current[mainGroup]?.scrollBy({ left: CARD_SCROLL, behavior: 'smooth' })}
                        className="flex items-center justify-center size-9 rounded-full border-2 border-[#001161]/25 text-[#001161] hover:bg-[#001161] hover:text-white hover:border-[#001161] transition-all cursor-pointer active:scale-90"
                        aria-label="Posunout doprava"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isExpanded ? (
                <div className="mb-8 -mt-[50px]">
                  {sortedSubEntries.map(([subGroup, books], index) => (
                    <div
                      key={subGroup}
                      id={groupingMode === 'grade' ? subGroup.replace(/\s+/g, '-').toLowerCase() : undefined}
                      className={`mb-5 ${groupingMode === 'grade' ? 'catalog-section scroll-mt-24' : ''}`}
                    >
                      {subGroup !== '_all' && (
                        <p className="text-[#001161] font-['Fenomen_Sans',sans-serif] text-[22px] xl:text-[26px] text-center mb-1.5">{subGroup}</p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-[0.5rem] justify-items-center">
                        {[...(index === 0 ? [getDigitalLicenseForGroup(mainGroup)] : []), ...(books as any[])].map(b => renderCard(b, false))}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => toggleGroup(mainGroup)}
                    className="flex items-center gap-1.5 mx-auto mb-4 text-[#001161]/40 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] transition-colors duration-200 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    {'Zav\u0159\u00edt'}
                  </button>
                </div>
              ) : (
                <div
                  ref={el => { scrollRefs.current[mainGroup] = el; }}
                  onScroll={() => handleGroupScroll(mainGroup)}
                  className="flex gap-2.5 items-start pb-5 overflow-x-hidden -mt-[50px] -mx-4 md:-mx-8 px-4 md:px-8"
                  style={{ scrollbarWidth: 'none', touchAction: 'pan-y' }}
                >
                  {allRowBooks.map(b => renderCard(b, true))}
                </div>
              )}
              <div className="border-t border-[#001161]/8 mt-1 mb-1" />
            </div>,
            isLastSecond ? <VividbooksFeatures key={`vvf-${mainGroup}`} grade={2} /> : null,
            isLastFirst  ? <VividbooksFeatures key={`vvf1-${mainGroup}`} grade={1} /> : null,
          ];
        })}
      </div>
      {/* Webinars section */}
      <WebinarsSection />
      {/* Newsletter banner — hned pod webináři */}
      <NewsletterBanner />
      {/* Blog section */}
      <BlogSection />
      {/* Novinky section */}
      <NovinkySection />
    </>
  );
}