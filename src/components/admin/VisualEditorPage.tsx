import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ChevronDown,
  GripVertical,
  Loader2,
  Monitor,
  RefreshCw,
  Save,
  Smartphone,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { fetchJsonWithRetry } from '../../utils/fetchWithRetry';
import { diffHeroPayloads, parseHeroPhoneDiff } from '../../utils/heroPhoneOverrides';
import svgPaths from '../../imports/svg-3hoiegevxq';
import { HeroProductLayoutPicker, HeroSimpleTextLayoutControls } from './HeroLayoutVisualPicker';
import { HeroBooksFanCovers } from '../HeroBooksFanCovers';
import { HeroSlideTitleText } from '../HeroSlideTitleText';
import { useProducts } from '../../contexts/ProductsContext';
import {
  clampHeroBlockGapPx,
  clampHeroBooksFanColumnPercent,
  clampHeroBooksFanBelowLiftPx,
  clampHeroBooksFanBelowShelfPercent,
  clampHeroBooksFanCollageOffsetXPx,
  clampHeroBooksFanCollageOffsetYPx,
  heroBooksFanBelowShelfMinPx,
  heroBooksFanBelowCollageTopBleedPx,
  clampHeroBooksFanGapPx,
  clampHeroBooksFanScalePct,
  clampHeroImageColumnPercent,
  clampHeroImagePosPct,
  clampHeroImageScalePct,
  clampHeroFullImageCardBlurPx,
  clampHeroFullImageCardOpacityPct,
  clampHeroTitleLineHeightPct,
  clampHeroTitleSizePct,
  heroFullImageCardSurfaceStyle,
  HERO_CENTER_BELOW_TITLE_SCALE,
  HERO_SLIDER_HEIGHT_PX,
  HERO_TITLE_FONT_OPTIONS,
  heroBookCoverShadowFilter,
  heroBookCoverShadowFilterLite,
  heroLeftImageImgStyle,
  heroSlideShouldShowCta,
  mergeHeroUnderlineRanges,
  normalizeHeroBlockOrder,
  normalizeHeroBlockVisibility,
  normalizeHeroBooksFanArrangement,
  normalizeHeroBooksFanZOrder,
  normalizeHeroFullImageCardBgHex,
  normalizeHeroSlideTitleFont,
  normalizeHeroTitleTiltMode,
  normalizeTitlePlayfulSeed,
  parseHeroBookProductIds,
  parseHeroTitleUnderlines,
  resolveHeroFanBooks,
  type HeroBooksFanArrangement,
  type HeroBooksFanZOrder,
  type HeroContentBlockId,
  type HeroSlideTitleFontId,
  type HeroTitleTiltMode,
} from '../../data/heroSlides';

type ProductLite = { id: string; name?: string; image?: string };

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' } as const;
const AUTH_H_NO_CT = { Authorization: `Bearer ${publicAnonKey}` } as const;

const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

const BLOCK_LABELS: Record<HeroContentBlockId, string> = {
  title: 'Nadpis',
  subtitle: 'Podnadpis',
  badges: 'Bobánky',
  bottom: 'Spodní text',
  cta: 'CTA tlačítko',
};

/** Stejná logika složek jako Marketing → Image Agent / Galerie */
type GalleryPickItem = {
  url: string;
  name: string;
  source: 'product' | 'webinar' | 'blog' | 'novinky' | 'upload';
  category?: string;
  predmet?: string;
};

function galleryPickFolder(item: GalleryPickItem, galleryFoldersByUrl: Record<string, string>): string {
  if (item.source === 'product') return item.predmet || item.category || 'Bez předmětu';
  if (item.source === 'webinar') return 'Webináře';
  if (item.source === 'blog') return 'Blog';
  if (item.source === 'novinky') return 'Novinky';
  if (item.source === 'upload') {
    const gf = galleryFoldersByUrl[item.url]?.trim();
    if (gf) return gf;
    return 'Nahrané soubory';
  }
  return 'Ostatní';
}

type LayoutVisual =
  | 'center'
  | 'left-text'
  | 'left-image'
  | 'full-image'
  | 'text-products'
  | 'text-products-below'
  | 'products-text-below';

type EditorDoc = {
  title: string;
  titleUnderlines: [number, number][];
  subtitle: string;
  bottom: string;
  badges: string[];
  ctaLabel: string;
  /** Jediný odkaz: klik na celý slide i na CTA (v CMS držíme synchronně s ctaLink). */
  link: string;
  titleFont: HeroSlideTitleFontId;
  bg: string;
  heroTextColor: string;
  /** Volitelná barva pozadí pill u zvýraznění v nadpisu (HEX). Prázdná = odvodit z barvy textu. */
  titlePillHighlightColor: string;
  /** Barva textu uvnitř pill (HEX). Prázdná = stejná jako barva nadpisu. */
  titlePillHighlightTextColor: string;
  titleTiltMode: HeroTitleTiltMode;
  titleTiltDeg: number;
  /** Seed pro hravý náklon / vějíř (tlačítko Znovu). */
  titlePlayfulSeed: number;
  layoutVisual: LayoutVisual;
  image: string;
  imageEdgeToEdge: boolean;
  imageColumnPercent: number;
  /** U left-image / full-image / slidů s produkty: text v textové zóně vlevo vs na střed. */
  heroImageColumnAlign: 'start' | 'center';
  /** Přiblížení fotky 100–200 %. */
  heroImageScalePct: number;
  /** Ořez / pozice X 0–100. */
  heroImagePosXPct: number;
  /** Ořez / pozice Y 0–100. */
  heroImagePosYPct: number;
  isActive: boolean;
  heroBlockOrder: HeroContentBlockId[];
  heroBlockVisibility: Record<HeroContentBlockId, boolean>;
  /** Svislá mezera mezi bloky (nadpis, podnadpis, …) v px. */
  heroBlockGapPx: number;
  /** Řádkový proklad nadpisu (92–155 → line-height 0.92–1.55), výchozí 108. */
  heroTitleLineHeightPct: number;
  /** Velikost nadpisu v % základu (65–135) — násobí responzivní clamp; 100 = výchozí. */
  heroTitleSizePct: number;
  /** Layout „text + produkty“ — ukládá se jako `books-fan` v CMS. */
  bookProductIds: string;
  booksFanArrangement: HeroBooksFanArrangement;
  /** Mezery mezi obálkami (px), záporné = překryv. */
  booksFanGapPx: number;
  /** Velikost obálek v % základního rozměru (55–300). */
  booksFanScalePct: number;
  /** Šířka sloupce s obálkami (28–55 %), jako podíl fotky u layoutu vlevo. */
  booksFanColumnPercent: number;
  /** U vějíře: která část je navrchu (z-index). */
  booksFanZOrder: HeroBooksFanZOrder;
  /** Posun koláže obálek v ose X (px, −200…200). */
  booksFanCollageOffsetXPx: number;
  /** Posun koláže v ose Y (px); kladné = nahoru. */
  booksFanCollageOffsetYPx: number;
  /** Jen „text + produkty pod“: výška pásu se sešity v % výšky hero (28–55). */
  booksFanBelowShelfPercent: number;
  /** Layout full-image: barva podbarvení karet (#RRGGBB). */
  heroFullImageCardBgHex: string;
  /** Neprůhlednost podbarvení karet 0–100 %. */
  heroFullImageCardOpacityPct: number;
  /** Rozmazání pozadí za kartami (px), 0 = vypnuto. */
  heroFullImageCardBlurPx: number;
};

type EditorPhoneOverrides = Partial<EditorDoc>;

const defaultDoc = (): EditorDoc => ({
  title: '',
  titleUnderlines: [],
  subtitle: '',
  bottom: '',
  badges: [],
  ctaLabel: '',
  link: '',
  titleFont: 'cooper',
  bg: '#e8d5f2',
  heroTextColor: '#001161',
  titlePillHighlightColor: '',
  titlePillHighlightTextColor: '',
  titleTiltMode: 'none',
  titleTiltDeg: 0,
  titlePlayfulSeed: 0,
  layoutVisual: 'center',
  image: '',
  imageEdgeToEdge: false,
  imageColumnPercent: 38,
  heroImageColumnAlign: 'start',
  heroImageScalePct: 100,
  heroImagePosXPct: 50,
  heroImagePosYPct: 50,
  isActive: true,
  heroBlockOrder: normalizeHeroBlockOrder(undefined),
  heroBlockVisibility: normalizeHeroBlockVisibility(undefined),
  heroBlockGapPx: 12,
  heroTitleLineHeightPct: 108,
  heroTitleSizePct: 100,
  bookProductIds: '',
  booksFanArrangement: 'grid',
  booksFanGapPx: 10,
  booksFanScalePct: 100,
  booksFanColumnPercent: 48,
  booksFanZOrder: 'middle',
  booksFanCollageOffsetXPx: 0,
  booksFanCollageOffsetYPx: 0,
  booksFanBelowShelfPercent: 48,
  heroFullImageCardBgHex: '#ffffff',
  heroFullImageCardOpacityPct: 88,
  heroFullImageCardBlurPx: 12,
});

function PreviewCheckBadge({ label, accentHex }: { label: string; accentHex?: string }) {
  const fill = accentHex || '#001161';
  return (
    <div
      className={`flex h-[37px] items-center gap-2 rounded-[7px] border px-3 py-1.5 ${accentHex ? '' : 'border-[#001161]'}`}
      style={accentHex ? { borderColor: accentHex } : undefined}
    >
      <div className="size-[17px] shrink-0">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
          <path d={svgPaths.p298d1300} fill={fill} />
        </svg>
      </div>
      <span
        className={`whitespace-nowrap font-['Fenomen_Sans',sans-serif] text-[15px] ${accentHex ? '' : 'text-[#001161]'}`}
        style={accentHex ? { color: accentHex } : undefined}
      >
        {label}
      </span>
    </div>
  );
}

function PreviewCta({
  slide,
  align,
  accentHex,
}: {
  slide: { ctaLabel?: string; ctaLink?: string; link?: string };
  align: 'left' | 'center';
  accentHex?: string;
}) {
  if (!heroSlideShouldShowCta(slide)) return null;
  const label = String(slide.ctaLabel).trim();
  const wrap = align === 'center' ? 'mt-3 flex w-full max-w-4xl justify-center' : 'mt-3';
  const style: React.CSSProperties | undefined =
    accentHex ? { borderColor: accentHex, color: accentHex } : undefined;
  return (
    <div className={wrap}>
      <span
        className="pointer-events-none inline-flex items-center justify-center rounded-lg border-2 border-[#001161] px-[18px] py-[9px] text-[12.5px] font-bold text-[#001161] bg-transparent md:text-[13.5px] font-['Fenomen_Sans',sans-serif]"
        style={style}
        aria-hidden
      >
        {label}
      </span>
    </div>
  );
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/** Barva: nativní výběr + HEX pole + kapátko (EyeDropper API), aby fungovalo i když systémový picker selže. */
function VisualEditorColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const colorValue = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
  const [hexDraft, setHexDraft] = React.useState(colorValue);
  React.useEffect(() => setHexDraft(colorValue), [colorValue]);
  const eyeOk =
    typeof window !== 'undefined' && typeof (window as Window & { EyeDropper?: EyeDropperCtor }).EyeDropper === 'function';

  const commitHex = (raw: string) => {
    const t = raw.trim();
    if (/^#[0-9A-Fa-f]{6}$/i.test(t)) onChange(t.toLowerCase());
  };

  return (
    <div className="min-w-0 w-full">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-[3.25rem] shrink-0 cursor-pointer overflow-hidden rounded border border-white/15 bg-[#0f1117] p-0 [color-scheme:dark]"
        />
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => commitHex(hexDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitHex(hexDraft);
            }
          }}
          spellCheck={false}
          className="min-w-[6.5rem] flex-1 rounded border border-white/15 bg-[#0f1117] px-2 py-1.5 font-mono text-[11px] text-white"
          placeholder={fallback}
        />
        {eyeOk ? (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/20 bg-white/[0.06] px-2 py-1.5 text-[10px] font-bold text-white/80 hover:bg-white/10"
            onClick={async () => {
              try {
                const Ed = (window as Window & { EyeDropper: EyeDropperCtor }).EyeDropper;
                const r = await new Ed().open();
                if (r?.sRGBHex) onChange(r.sRGBHex);
              } catch {
                /* uživatel zrušil */
              }
            }}
          >
            Kapátko
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Titulek v CMS / kolekci — když je nadpis vypnutý a prázdný, použijeme zálohu (seznam v adminu). */
function persistedHeroTitle(doc: EditorDoc): string {
  const t = doc.title.trim();
  if (t) return t;
  const sub = doc.subtitle.trim();
  if (sub) return sub.length > 120 ? `${sub.slice(0, 117)}…` : sub;
  const bt = doc.bottom.trim();
  if (bt) return bt.length > 120 ? `${bt.slice(0, 117)}…` : bt;
  if ((doc.layoutVisual === 'left-image' || doc.layoutVisual === 'full-image') && doc.image.trim())
    return 'Obrázkový slide';
  return 'Hero slide';
}

function docFromApiItem(it: any): EditorDoc {
  const isBooksFanBelow = it.layout === 'books-fan-below';
  const isBooksFanAbove = it.layout === 'books-fan-above';
  const isBooksFanSide = it.layout === 'books-fan';
  const isBooksFan = isBooksFanSide || isBooksFanBelow || isBooksFanAbove;
  const layoutVisual: LayoutVisual = isBooksFanBelow
    ? 'text-products-below'
    : isBooksFanAbove
      ? 'products-text-below'
        : isBooksFanSide
        ? 'text-products'
        : it.layout === 'hero-full-image'
          ? 'full-image'
          : it.layout === 'left-image'
            ? 'left-image'
            : it.heroTextAlign === 'start'
              ? 'left-text'
              : 'center';
  const title = it.title || '';
  const under = mergeHeroUnderlineRanges(title.length, parseHeroTitleUnderlines(it.titleUnderlines));
  let badges: string[] = [];
  if (Array.isArray(it.badges)) badges = it.badges.map(String);
  else if (typeof it.badges === 'string') {
    try {
      const j = JSON.parse(it.badges);
      if (Array.isArray(j)) badges = j.map(String);
    } catch {
      /* ignore */
    }
  }
  const tiltRaw = typeof it.titleTiltDeg === 'number' ? it.titleTiltDeg : Number(it.titleTiltDeg);
  const titleTiltDeg = Number.isFinite(tiltRaw) ? tiltRaw : 0;
  const titleTiltMode = normalizeHeroTitleTiltMode(it.titleTiltMode, it.titleTiltDeg);
  return {
    title,
    titleUnderlines: under,
    subtitle: it.subtitle || '',
    bottom: it.bottom || '',
    badges,
    ctaLabel: typeof it.ctaLabel === 'string' ? it.ctaLabel : '',
    link: (() => {
      const L = typeof it.link === 'string' ? it.link.trim() : '';
      const C = typeof it.ctaLink === 'string' ? it.ctaLink.trim() : '';
      return L || C;
    })(),
    titleFont: normalizeHeroSlideTitleFont(it.titleFont),
    bg: typeof it.bg === 'string' && it.bg.startsWith('#') ? it.bg : '#e8d5f2',
    heroTextColor:
      typeof it.heroTextColor === 'string' && it.heroTextColor.startsWith('#')
        ? it.heroTextColor
        : '#001161',
    titlePillHighlightColor:
      typeof it.titlePillHighlightColor === 'string' && it.titlePillHighlightColor.startsWith('#')
        ? it.titlePillHighlightColor.trim()
        : '',
    titlePillHighlightTextColor:
      typeof it.titlePillHighlightTextColor === 'string' && it.titlePillHighlightTextColor.startsWith('#')
        ? it.titlePillHighlightTextColor.trim()
        : '',
    titleTiltMode,
    titleTiltDeg,
    layoutVisual,
    image: typeof it.image === 'string' ? it.image : '',
    imageEdgeToEdge: Boolean(it.imageEdgeToEdge),
    imageColumnPercent: clampHeroImageColumnPercent(it.imageColumnPercent),
    heroImageColumnAlign: it.heroImageColumnAlign === 'center' ? 'center' : 'start',
    heroImageScalePct: clampHeroImageScalePct(it.heroImageScalePct),
    heroImagePosXPct: clampHeroImagePosPct(it.heroImagePosXPct),
    heroImagePosYPct: clampHeroImagePosPct(it.heroImagePosYPct),
    heroFullImageCardBgHex: normalizeHeroFullImageCardBgHex(it.heroFullImageCardBgHex),
    heroFullImageCardOpacityPct: clampHeroFullImageCardOpacityPct(it.heroFullImageCardOpacityPct),
    heroFullImageCardBlurPx: clampHeroFullImageCardBlurPx(it.heroFullImageCardBlurPx),
    isActive: it.isActive !== false,
    bookProductIds:
      typeof it.bookProductIds === 'string'
        ? it.bookProductIds
        : Array.isArray(it.bookProductIds)
          ? JSON.stringify(it.bookProductIds)
          : '',
    booksFanArrangement: normalizeHeroBooksFanArrangement(it.booksFanArrangement),
    booksFanGapPx: clampHeroBooksFanGapPx(it.booksFanGapPx),
    booksFanScalePct: clampHeroBooksFanScalePct(it.booksFanScalePct),
    booksFanColumnPercent: clampHeroBooksFanColumnPercent(it.booksFanColumnPercent),
    booksFanZOrder: normalizeHeroBooksFanZOrder(it.booksFanZOrder),
    booksFanCollageOffsetXPx: clampHeroBooksFanCollageOffsetXPx(it.booksFanCollageOffsetXPx),
    booksFanCollageOffsetYPx: clampHeroBooksFanCollageOffsetYPx(
      it.booksFanCollageOffsetYPx != null && it.booksFanCollageOffsetYPx !== ''
        ? it.booksFanCollageOffsetYPx
        : it.booksFanBelowLiftPx,
    ),
    booksFanBelowShelfPercent: clampHeroBooksFanBelowShelfPercent(it.booksFanBelowShelfPercent),
    heroBlockOrder: normalizeHeroBlockOrder(it.heroBlockOrder),
    heroBlockVisibility: normalizeHeroBlockVisibility(it.heroBlockVisibility),
    heroBlockGapPx: clampHeroBlockGapPx(it.heroBlockGapPx),
    heroTitleLineHeightPct: clampHeroTitleLineHeightPct(it.heroTitleLineHeightPct),
    heroTitleSizePct: clampHeroTitleSizePct(it.heroTitleSizePct),
    titlePlayfulSeed: normalizeTitlePlayfulSeed(it.titlePlayfulSeed),
  };
}

function editorFieldEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function extractOverridesFromBase(base: EditorDoc, next: EditorDoc): EditorPhoneOverrides {
  const o: EditorPhoneOverrides = {};
  (Object.keys(next) as (keyof EditorDoc)[]).forEach((k) => {
    if (!editorFieldEqual(next[k], base[k])) (o as any)[k] = next[k];
  });
  return o;
}

function applyEditorPhoneOverrides(base: EditorDoc, ov: EditorPhoneOverrides): EditorDoc {
  if (!ov || Object.keys(ov).length === 0) return base;
  return {
    ...base,
    ...ov,
    heroBlockOrder: ov.heroBlockOrder ?? base.heroBlockOrder,
    heroBlockVisibility: ov.heroBlockVisibility
      ? { ...base.heroBlockVisibility, ...ov.heroBlockVisibility }
      : base.heroBlockVisibility,
    titleUnderlines: ov.titleUnderlines ?? base.titleUnderlines,
    badges: ov.badges ?? base.badges,
  };
}

function phoneDiffToEditorOverrides(item: any, diff: Record<string, unknown>): EditorPhoneOverrides {
  if (!diff || Object.keys(diff).length === 0) return {};
  const base = docFromApiItem(item);
  const merged = docFromApiItem({ ...item, ...diff });
  return extractOverridesFromBase(base, merged);
}

function buildPayload(payloadDoc: EditorDoc, order: number, id: string): Record<string, unknown> {
  if (
    payloadDoc.layoutVisual === 'text-products' ||
    payloadDoc.layoutVisual === 'text-products-below' ||
    payloadDoc.layoutVisual === 'products-text-below'
  ) {
    const item: Record<string, unknown> = {
      id,
      title: persistedHeroTitle(payloadDoc),
      subtitle: payloadDoc.subtitle.trim(),
      layout:
        payloadDoc.layoutVisual === 'text-products-below'
          ? 'books-fan-below'
          : payloadDoc.layoutVisual === 'products-text-below'
            ? 'books-fan-above'
            : 'books-fan',
      bg: payloadDoc.bg,
      badges: payloadDoc.badges.filter((b) => b.trim()),
      bottom: payloadDoc.bottom.trim(),
      order,
      isActive: payloadDoc.isActive,
      titleFont: payloadDoc.titleFont,
      image: '',
      imageEdgeToEdge: false,
      bookProductIds: payloadDoc.bookProductIds ?? '',
      booksFanArrangement: payloadDoc.booksFanArrangement,
      booksFanGapPx: clampHeroBooksFanGapPx(payloadDoc.booksFanGapPx),
      booksFanScalePct: clampHeroBooksFanScalePct(payloadDoc.booksFanScalePct),
      booksFanColumnPercent: clampHeroBooksFanColumnPercent(payloadDoc.booksFanColumnPercent),
      booksFanZOrder: normalizeHeroBooksFanZOrder(payloadDoc.booksFanZOrder),
      booksFanCollageOffsetXPx: clampHeroBooksFanCollageOffsetXPx(payloadDoc.booksFanCollageOffsetXPx),
      booksFanCollageOffsetYPx: clampHeroBooksFanCollageOffsetYPx(payloadDoc.booksFanCollageOffsetYPx),
    };
    item.heroImageColumnAlign = payloadDoc.heroImageColumnAlign === 'center' ? 'center' : '';
    if (
      payloadDoc.layoutVisual === 'text-products-below' ||
      payloadDoc.layoutVisual === 'products-text-below'
    ) {
      item.booksFanBelowLiftPx = clampHeroBooksFanBelowLiftPx(payloadDoc.booksFanCollageOffsetYPx);
      item.booksFanBelowShelfPercent = clampHeroBooksFanBelowShelfPercent(payloadDoc.booksFanBelowShelfPercent);
    }
    const href = payloadDoc.link.trim();
    item.link = href;
    item.ctaLink = href;
    if (payloadDoc.ctaLabel.trim()) item.ctaLabel = payloadDoc.ctaLabel.trim();
    if (payloadDoc.heroTextColor?.startsWith('#')) item.heroTextColor = payloadDoc.heroTextColor;
    item.titlePillHighlightColor =
      payloadDoc.titlePillHighlightColor?.startsWith('#') ? payloadDoc.titlePillHighlightColor.trim() : '';
    item.titlePillHighlightTextColor =
      payloadDoc.titlePillHighlightTextColor?.startsWith('#')
        ? payloadDoc.titlePillHighlightTextColor.trim()
        : '';
    item.titleTiltMode = payloadDoc.titleTiltMode === 'none' ? '' : payloadDoc.titleTiltMode;
    item.titleTiltDeg =
      payloadDoc.titleTiltMode === 'uniform' && payloadDoc.titleTiltDeg && payloadDoc.titleTiltDeg !== 0
        ? payloadDoc.titleTiltDeg
        : '';
    item.titleUnderlines = payloadDoc.titleUnderlines.length ? JSON.stringify(payloadDoc.titleUnderlines) : '';
    item.heroTextAlign = '';
    item.heroBlockOrder = JSON.stringify(payloadDoc.heroBlockOrder);
    item.heroBlockVisibility = JSON.stringify(payloadDoc.heroBlockVisibility);
    item.heroBlockGapPx = clampHeroBlockGapPx(payloadDoc.heroBlockGapPx);
    item.heroTitleLineHeightPct = clampHeroTitleLineHeightPct(payloadDoc.heroTitleLineHeightPct);
    item.heroTitleSizePct = clampHeroTitleSizePct(payloadDoc.heroTitleSizePct);
    item.titlePlayfulSeed = normalizeTitlePlayfulSeed(payloadDoc.titlePlayfulSeed);
    return item;
  }

  const layout =
    payloadDoc.layoutVisual === 'left-image'
      ? 'left-image'
      : payloadDoc.layoutVisual === 'full-image'
        ? 'hero-full-image'
        : 'center';
  const item: Record<string, unknown> = {
    id,
    title: persistedHeroTitle(payloadDoc),
    subtitle: payloadDoc.subtitle.trim(),
    layout,
    bg: payloadDoc.bg,
    badges: payloadDoc.badges.filter((b) => b.trim()),
    bottom: payloadDoc.bottom.trim(),
    order,
    isActive: payloadDoc.isActive,
    titleFont: payloadDoc.titleFont,
    image: '',
    imageEdgeToEdge: false,
  };
  {
    const href = payloadDoc.link.trim();
    item.link = href;
    item.ctaLink = href;
  }
  if (payloadDoc.ctaLabel.trim()) item.ctaLabel = payloadDoc.ctaLabel.trim();
  if (payloadDoc.heroTextColor?.startsWith('#')) item.heroTextColor = payloadDoc.heroTextColor;
  item.titlePillHighlightColor =
    payloadDoc.titlePillHighlightColor?.startsWith('#') ? payloadDoc.titlePillHighlightColor.trim() : '';
  item.titlePillHighlightTextColor =
    payloadDoc.titlePillHighlightTextColor?.startsWith('#')
      ? payloadDoc.titlePillHighlightTextColor.trim()
      : '';
  if (payloadDoc.layoutVisual === 'left-text') item.heroTextAlign = 'start';
  else item.heroTextAlign = '';
  item.titleTiltMode = payloadDoc.titleTiltMode === 'none' ? '' : payloadDoc.titleTiltMode;
  item.titleTiltDeg =
    payloadDoc.titleTiltMode === 'uniform' && payloadDoc.titleTiltDeg && payloadDoc.titleTiltDeg !== 0
      ? payloadDoc.titleTiltDeg
      : '';
  item.titleUnderlines = payloadDoc.titleUnderlines.length ? JSON.stringify(payloadDoc.titleUnderlines) : '';

  if (layout === 'left-image' || layout === 'hero-full-image') {
    item.image = payloadDoc.image.trim();
    item.heroImageScalePct = clampHeroImageScalePct(payloadDoc.heroImageScalePct);
    item.heroImagePosXPct = clampHeroImagePosPct(payloadDoc.heroImagePosXPct);
    item.heroImagePosYPct = clampHeroImagePosPct(payloadDoc.heroImagePosYPct);
    if (payloadDoc.heroImageColumnAlign === 'center') item.heroImageColumnAlign = 'center';
    if (layout === 'left-image') {
      if (payloadDoc.image.trim() && payloadDoc.imageEdgeToEdge) item.imageEdgeToEdge = true;
      item.imageColumnPercent = clampHeroImageColumnPercent(payloadDoc.imageColumnPercent);
    } else {
      item.imageEdgeToEdge = false;
      item.heroFullImageCardBgHex = normalizeHeroFullImageCardBgHex(payloadDoc.heroFullImageCardBgHex);
      item.heroFullImageCardOpacityPct = clampHeroFullImageCardOpacityPct(
        payloadDoc.heroFullImageCardOpacityPct,
      );
      item.heroFullImageCardBlurPx = clampHeroFullImageCardBlurPx(payloadDoc.heroFullImageCardBlurPx);
    }
  }
  item.heroBlockOrder = JSON.stringify(payloadDoc.heroBlockOrder);
  item.heroBlockVisibility = JSON.stringify(payloadDoc.heroBlockVisibility);
  item.heroBlockGapPx = clampHeroBlockGapPx(payloadDoc.heroBlockGapPx);
  item.heroTitleLineHeightPct = clampHeroTitleLineHeightPct(payloadDoc.heroTitleLineHeightPct);
  item.heroTitleSizePct = clampHeroTitleSizePct(payloadDoc.heroTitleSizePct);
  item.titlePlayfulSeed = normalizeTitlePlayfulSeed(payloadDoc.titlePlayfulSeed);
  return item;
}

/** Přesune `from` v pořadí tak, aby skončil před/po `toId` (po vyjmutí `from`). */
function reorderHeroBlockOrder(
  order: HeroContentBlockId[],
  from: HeroContentBlockId,
  toId: HeroContentBlockId,
  edge: 'before' | 'after',
): HeroContentBlockId[] {
  if (from === toId) return order;
  const o = [...order];
  const fi = o.indexOf(from);
  const ti = o.indexOf(toId);
  if (fi < 0 || ti < 0) return order;
  o.splice(fi, 1);
  let ti2 = o.indexOf(toId);
  if (ti2 < 0) return order;
  const insertAt = edge === 'before' ? ti2 : ti2 + 1;
  o.splice(insertAt, 0, from);
  return o;
}

function PreviewHeroFullImageCard({
  doc,
  className = '',
  children,
}: {
  doc: EditorDoc;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-fit max-w-full rounded-2xl px-3.5 py-2.5 [&_.mt-3]:mt-0 ${className}`.trim()}
      style={heroFullImageCardSurfaceStyle(
        doc.heroFullImageCardBgHex,
        doc.heroFullImageCardOpacityPct,
        doc.heroFullImageCardBlurPx,
      )}
    >
      {children}
    </div>
  );
}

function PreviewOrderedBlocks({
  doc,
  variant,
  heroAlignStart,
  leftImageTextCenter,
  accent,
  highlightBlockId,
}: {
  doc: EditorDoc;
  variant: 'leftImage' | 'center' | 'centerBelow' | 'booksFan' | 'fullImage';
  heroAlignStart: boolean;
  leftImageTextCenter?: boolean;
  accent: string;
  /** Zvýraznění bloku při hoveru v levém panelu */
  highlightBlockId?: HeroContentBlockId | null;
}) {
  const liCenter =
    (variant === 'leftImage' || variant === 'booksFan') && Boolean(leftImageTextCenter);
  const fiCenter = variant === 'fullImage' && Boolean(leftImageTextCenter);
  const order = normalizeHeroBlockOrder(doc.heroBlockOrder);
  const vis = normalizeHeroBlockVisibility(doc.heroBlockVisibility);
  const blockGapPx = clampHeroBlockGapPx(doc.heroBlockGapPx);
  const slideStub = {
    title: doc.title || 'Nadpis',
    subtitle: doc.subtitle || 'Podnadpis',
    bottom: doc.bottom || 'Spodní text',
    badges: doc.badges.length ? doc.badges : ['Bobánek'],
    titleFont: doc.titleFont,
    titleUnderlineRanges: mergeHeroUnderlineRanges(
      (doc.title || 'Nadpis').length,
      doc.titleUnderlines,
    ),
    titleTiltMode: doc.titleTiltMode,
    titleTiltDeg: doc.titleTiltDeg,
    titlePlayfulSeed: doc.titlePlayfulSeed,
    heroTitleLineHeightPct: doc.heroTitleLineHeightPct,
    heroTitleSizePct: doc.heroTitleSizePct,
    titlePillHighlightColor: doc.titlePillHighlightColor,
    titlePillHighlightTextColor: doc.titlePillHighlightTextColor,
    ctaLabel: doc.ctaLabel,
    link: doc.link,
  };

  const renderBlock = (id: HeroContentBlockId): React.ReactNode => {
    switch (id) {
      case 'title':
        if (variant === 'fullImage') {
          return (
            <PreviewHeroFullImageCard doc={doc}>
              <HeroSlideTitleText
                title={slideStub.title}
                titleUnderlineRanges={slideStub.titleUnderlineRanges}
                titleTiltMode={slideStub.titleTiltMode}
                titleTiltDeg={slideStub.titleTiltDeg}
                titlePlayfulSeed={slideStub.titlePlayfulSeed}
                titleLineHeightPct={slideStub.heroTitleLineHeightPct}
                slide={slideStub}
                preset="fullImage"
                className={`max-w-full w-max break-words ${fiCenter ? 'text-center' : ''}`}
                accentHex={accent.startsWith('#') ? accent : undefined}
                pillHighlightHex={
                  slideStub.titlePillHighlightColor?.startsWith('#')
                    ? slideStub.titlePillHighlightColor
                    : undefined
                }
                pillHighlightTextHex={
                  slideStub.titlePillHighlightTextColor?.startsWith('#')
                    ? slideStub.titlePillHighlightTextColor
                    : undefined
                }
              />
            </PreviewHeroFullImageCard>
          );
        }
        if (variant === 'leftImage' || variant === 'booksFan') {
          const preset = variant === 'booksFan' ? 'booksFan' : 'leftImage';
          return (
            <HeroSlideTitleText
              title={slideStub.title}
              titleUnderlineRanges={slideStub.titleUnderlineRanges}
              titleTiltMode={slideStub.titleTiltMode}
              titleTiltDeg={slideStub.titleTiltDeg}
              titlePlayfulSeed={slideStub.titlePlayfulSeed}
              titleLineHeightPct={slideStub.heroTitleLineHeightPct}
              slide={slideStub}
              preset={preset}
              className={`break-words ${liCenter ? 'text-center' : ''}`}
              accentHex={accent.startsWith('#') ? accent : undefined}
              pillHighlightHex={
                slideStub.titlePillHighlightColor?.startsWith('#')
                  ? slideStub.titlePillHighlightColor
                  : undefined
              }
              pillHighlightTextHex={
                slideStub.titlePillHighlightTextColor?.startsWith('#')
                  ? slideStub.titlePillHighlightTextColor
                  : undefined
              }
            />
          );
        }
        return (
          <HeroSlideTitleText
            title={slideStub.title}
            titleUnderlineRanges={slideStub.titleUnderlineRanges}
            titleTiltMode={slideStub.titleTiltMode}
            titleTiltDeg={slideStub.titleTiltDeg}
            titlePlayfulSeed={slideStub.titlePlayfulSeed}
            titleLineHeightPct={slideStub.heroTitleLineHeightPct}
            slide={slideStub}
            preset="center"
            headingFontScale={variant === 'centerBelow' ? HERO_CENTER_BELOW_TITLE_SCALE : 1}
            className={`max-w-full break-words ${heroAlignStart ? 'text-left' : 'text-center'}`}
            accentHex={accent.startsWith('#') ? accent : undefined}
            pillHighlightHex={
              slideStub.titlePillHighlightColor?.startsWith('#')
                ? slideStub.titlePillHighlightColor
                : undefined
            }
            pillHighlightTextHex={
              slideStub.titlePillHighlightTextColor?.startsWith('#')
                ? slideStub.titlePillHighlightTextColor
                : undefined
            }
          />
        );
      case 'subtitle':
        if (variant === 'fullImage') {
          return (
            <PreviewHeroFullImageCard doc={doc}>
              <p
                className={`max-w-full w-max break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[12px] leading-snug opacity-80 md:text-[14px] ${fiCenter ? 'text-center' : ''}`}
                title={slideStub.subtitle}
              >
                {slideStub.subtitle}
              </p>
            </PreviewHeroFullImageCard>
          );
        }
        if (variant === 'leftImage') {
          return (
            <p
              className={`break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[12px] leading-snug opacity-70 md:text-[14px] ${liCenter ? 'text-center' : ''}`}
              title={slideStub.subtitle}
            >
              {slideStub.subtitle}
            </p>
          );
        }
        if (variant === 'booksFan') {
          return (
            <p
              className={`break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug opacity-80 md:text-[15px] xl:text-[17px] ${liCenter ? 'text-center' : ''}`}
              title={slideStub.subtitle}
            >
              {slideStub.subtitle}
            </p>
          );
        }
        return (
          <p
            className={`max-w-4xl break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[12px] leading-snug opacity-70 md:text-[14px] ${heroAlignStart ? 'text-left' : 'text-center'}`}
            title={slideStub.subtitle}
          >
            {slideStub.subtitle}
          </p>
        );
      case 'badges': {
        if (variant === 'fullImage') {
          const wrap = `flex w-max max-w-full flex-wrap gap-2 ${fiCenter ? 'justify-center' : 'justify-start'}`;
          return (
            <PreviewHeroFullImageCard doc={doc}>
              <div className={wrap}>
                {slideStub.badges.map((b) => (
                  <PreviewCheckBadge key={b} label={b} accentHex={accent} />
                ))}
              </div>
            </PreviewHeroFullImageCard>
          );
        }
        const wrap =
          variant === 'center' || variant === 'centerBelow'
            ? `flex flex-wrap gap-2 ${heroAlignStart ? 'justify-start' : 'justify-center'}`
            : variant === 'leftImage' || variant === 'booksFan'
              ? `flex flex-wrap gap-2 md:gap-3 ${liCenter ? 'justify-center' : ''}`
              : 'flex flex-wrap gap-2';
        return (
          <div className={wrap}>
            {slideStub.badges.map((b) => (
              <PreviewCheckBadge key={b} label={b} accentHex={accent} />
            ))}
          </div>
        );
      }
      case 'bottom':
        if (variant === 'fullImage') {
          return (
            <PreviewHeroFullImageCard doc={doc}>
              <p
                className={`max-w-full w-max break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug md:text-[16px] ${fiCenter ? 'text-center' : ''}`}
                title={slideStub.bottom}
              >
                {slideStub.bottom}
              </p>
            </PreviewHeroFullImageCard>
          );
        }
        if (variant === 'leftImage') {
          return (
            <p
              className={`break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug md:text-[16px] ${liCenter ? 'text-center' : ''}`}
              title={slideStub.bottom}
            >
              {slideStub.bottom}
            </p>
          );
        }
        if (variant === 'booksFan') {
          return (
            <p
              className={`break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[14px] leading-snug opacity-80 md:text-[17px] xl:text-[19px] ${liCenter ? 'text-center' : ''}`}
              title={slideStub.bottom}
            >
              {slideStub.bottom}
            </p>
          );
        }
        return (
          <p
            className={`max-w-4xl break-words whitespace-pre-line font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug md:text-[16px] ${heroAlignStart ? 'text-left' : 'text-center'}`}
            title={slideStub.bottom}
          >
            {slideStub.bottom}
          </p>
        );
      case 'cta':
        if (variant === 'fullImage') {
          if (!heroSlideShouldShowCta(slideStub)) return null;
          return (
            <PreviewHeroFullImageCard doc={doc} className={fiCenter ? 'flex justify-center' : ''}>
              <PreviewCta slide={slideStub} align={fiCenter ? 'center' : 'left'} accentHex={accent} />
            </PreviewHeroFullImageCard>
          );
        }
        return (
          <PreviewCta
            slide={slideStub}
            align={
              ((variant === 'center' || variant === 'centerBelow') && !heroAlignStart) || liCenter
                ? 'center'
                : 'left'
            }
            accentHex={accent}
          />
        );
      default:
        return null;
    }
  };

  const wrap = (id: HeroContentBlockId, node: React.ReactNode) => {
    const hi = highlightBlockId === id;
    return (
      <div
        key={id}
        className={`rounded-md transition-[box-shadow,background-color] duration-150 ${hi ? '-mx-1 px-1 py-0.5' : ''}`}
        style={
          hi
            ? {
                boxShadow: '0 0 0 2px #7C3AED, 0 0 16px rgba(124, 58, 237, 0.35)',
                backgroundColor: 'rgba(124, 58, 237, 0.08)',
              }
            : undefined
        }
      >
        {node}
      </div>
    );
  };

  return (
    <div className="flex flex-col" style={{ gap: blockGapPx }}>
      {order.map((id) => {
        if (!vis[id]) return null;
        return wrap(id, renderBlock(id));
      })}
    </div>
  );
}

const MAX_FAN_BOOKS = 6;

function HeroFanProductChecklist({
  bookProductIdsJson,
  onChangeIds,
}: {
  bookProductIdsJson: string;
  onChangeIds: (ids: string[]) => void;
}) {
  const { products, isLoading, fetchProducts } = useProducts();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedIds = parseHeroBookProductIds(bookProductIdsJson);

  const sortedAll = useMemo(() => {
    const arr = (products || []) as ProductLite[];
    return [...arr].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'cs'));
  }, [products]);

  const byId = useMemo(() => new Map(sortedAll.map((p) => [p.id, p])), [sortedAll]);

  const buttonSummary = useMemo(() => {
    if (selectedIds.length === 0) return 'Vyberte tituly z rozbalovacího seznamu…';
    const names = selectedIds
      .map((id) => byId.get(id)?.name?.trim() || id)
      .filter(Boolean);
    const head = names.slice(0, 2).join(', ');
    if (names.length <= 2) return `${selectedIds.length}× — ${head}`;
    return `${selectedIds.length}× — ${head}…`;
  }, [byId, selectedIds]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openPanel = () => {
    setOpen(true);
    if (sortedAll.length === 0 && !isLoading) void fetchProducts();
  };

  const toggle = (id: string) => {
    const i = selectedIds.indexOf(id);
    if (i >= 0) {
      onChangeIds(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= MAX_FAN_BOOKS) {
      toast.error(`Maximálně ${MAX_FAN_BOOKS} titulů.`);
      return;
    }
    onChangeIds([...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-left text-[12px] text-white transition-colors hover:border-white/25"
        >
          <span className="min-w-0 flex-1 truncate text-white/90">{buttonSummary}</span>
          <ChevronDown
            className={`size-4 shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open && (
          <div
            className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-[min(320px,55vh)] overflow-y-auto rounded-lg border border-white/15 bg-[#141821] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            role="listbox"
            aria-multiselectable
          >
            {isLoading && sortedAll.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-[11px] text-white/50">
                <Loader2 className="size-4 animate-spin" />
                Načítám katalog…
              </div>
            ) : sortedAll.length === 0 ? (
              <div className="space-y-2 px-3 py-4 text-center">
                <p className="text-[10px] leading-snug text-white/45">
                  Katalog produktů se nepodařilo načíst nebo je prázdný.
                </p>
                <button
                  type="button"
                  onClick={() => void fetchProducts()}
                  className="rounded-lg border border-white/20 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10"
                >
                  Zkusit znovu načíst
                </button>
              </div>
            ) : (
              sortedAll.map((p) => {
                const checked = selectedIds.includes(p.id);
                const disabled = !checked && selectedIds.length >= MAX_FAN_BOOKS;
                const cover = String(p.image || '').trim();
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-white/[0.06] ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(p.id)}
                      className="size-3.5 shrink-0 accent-[#7C3AED]"
                    />
                    {cover ? (
                      <img src={cover} alt="" className="h-10 w-[28px] shrink-0 object-cover shadow-sm" />
                    ) : (
                      <div
                        className="flex h-10 w-[28px] shrink-0 items-center justify-center rounded-sm border border-dashed border-white/20 bg-white/[0.06] text-[9px] font-bold text-white/40"
                        title="Bez nahrané obálky — na slidu bude šedá náhradní dlaždice"
                      >
                        —
                      </div>
                    )}
                    <span className="min-w-0 flex-1 truncate text-white/90">{p.name?.trim() || p.id}</span>
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>
      <p className="text-[9px] text-white/45">
        Vybráno <span className="font-bold text-[#c4b5fd]">{selectedIds.length}</span> / {MAX_FAN_BOOKS} — pořadí v
        mřížce odpovídá pořadí zaškrtnutí (klikněte v tomto pořadí).
      </p>
    </div>
  );
}

function SliderPreviewCanvas({
  doc,
  device,
  highlightBlockId,
  products,
}: {
  doc: EditorDoc;
  device: 'desktop' | 'phone';
  highlightBlockId?: HeroContentBlockId | null;
  products: { id: string; name?: string; image?: string }[];
}) {
  const navigate = useNavigate();
  const showTextProductsSide = doc.layoutVisual === 'text-products';
  const showTextProductsBelow = doc.layoutVisual === 'text-products-below';
  const showProductsAboveText = doc.layoutVisual === 'products-text-below';
  const showStackedBooks = showTextProductsBelow || showProductsAboveText;
  const showTextProducts = showTextProductsSide || showStackedBooks;
  const booksFanTextColCenter = showTextProducts && doc.heroImageColumnAlign === 'center';
  const previewBooks = showTextProducts
    ? resolveHeroFanBooks(products, parseHeroBookProductIds(doc.bookProductIds))
    : [];
  const coverBgHex = doc.bg.startsWith('#') ? doc.bg : '#e8d5f2';
  const showFullImage = doc.layoutVisual === 'full-image' && Boolean(doc.image.trim());
  const showLeftImage = doc.layoutVisual === 'left-image' && Boolean(doc.image.trim());
  const heroAlignStart = doc.layoutVisual === 'left-text';
  const leftBleed = showLeftImage && doc.imageEdgeToEdge;
  const imgColPct = clampHeroImageColumnPercent(doc.imageColumnPercent);
  const booksFanColPct = clampHeroBooksFanColumnPercent(doc.booksFanColumnPercent);
  const accent = doc.heroTextColor?.startsWith('#') ? doc.heroTextColor : '#001161';
  const textWrapStyle: React.CSSProperties = { color: accent };

  const widthClass = device === 'phone' ? 'w-[390px] max-w-full' : 'w-full max-w-4xl';
  const flushBooksStacked = showStackedBooks;
  const flushBooksSide = doc.layoutVisual === 'text-products';
  const collageOx = clampHeroBooksFanCollageOffsetXPx(doc.booksFanCollageOffsetXPx);
  const collageOy = clampHeroBooksFanCollageOffsetYPx(doc.booksFanCollageOffsetYPx);
  const collageTransformBelow: React.CSSProperties = {
    transform: `translate(${collageOx}px, ${-collageOy}px)`,
  };
  const collageTransformAbove: React.CSSProperties = {
    transform: `translate(${collageOx}px, ${collageOy}px)`,
  };

  /** Stacked text+nahoře / fotka+dole: bez horizontálního paddingu na hero — fotka jinak uřízne overflow:hidden nebo „nevyjede“ z padding boxu. */
  const phoneLeftImageStack = showLeftImage && device === 'phone';
  const heroSlidePaddingClass = showFullImage
    ? 'px-0 py-0'
    : phoneLeftImageStack
    ? leftBleed
      ? 'px-0 py-0'
      : 'px-0 pt-5 pb-0'
    : leftBleed
      ? 'py-0 pl-6 pr-0'
      : showTextProductsBelow
        ? 'px-0 pb-0 pt-2 md:px-0 md:pb-0 md:pt-3'
        : showProductsAboveText
          ? 'px-0 pt-0 pb-2 md:px-0 md:pt-0 md:pb-3'
          : flushBooksSide
            ? 'py-0 pl-5 pr-0 pb-0 pt-5 md:py-0 md:pl-7 md:pr-0 md:pt-6'
            : 'px-5 py-5 md:px-7 md:py-6';
  const heroSlideOverflowClass = showFullImage
    ? 'overflow-hidden'
    : phoneLeftImageStack && !flushBooksStacked && !flushBooksSide
      ? 'overflow-x-visible overflow-y-hidden'
      : flushBooksSide || flushBooksStacked
        ? 'overflow-visible'
        : 'overflow-hidden';

  return (
    <div
      className={`mx-auto rounded-[24px] border border-gray-200 bg-white shadow-lg ${
        flushBooksSide || flushBooksStacked ? 'overflow-visible' : 'overflow-hidden'
      } ${widthClass}`}
    >
      <div
        className={`${
          flushBooksStacked ? 'flex flex-col' : 'flex min-h-0 flex-col'
        } @container text-[#001161] ${heroSlideOverflowClass} ${heroSlidePaddingClass}`}
        style={{ backgroundColor: doc.bg, height: HERO_SLIDER_HEIGHT_PX }}
      >
        {showStackedBooks ? (
          showProductsAboveText ? (
            <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-visible">
              <div
                className="absolute inset-x-0 top-0 z-20 flex min-w-0 items-start justify-center overflow-x-auto overflow-y-visible px-0 pt-2 md:pt-3"
                style={{
                  minHeight: heroBooksFanBelowShelfMinPx(doc.booksFanBelowShelfPercent),
                  paddingBottom: heroBooksFanBelowCollageTopBleedPx(doc.booksFanCollageOffsetYPx),
                }}
              >
                <div className="flex w-full justify-center" style={collageTransformAbove}>
                  <HeroBooksFanCovers
                    books={previewBooks}
                    arrangement={doc.booksFanArrangement}
                    gapPx={doc.booksFanGapPx}
                    scalePct={doc.booksFanScalePct}
                    coverShadow={heroBookCoverShadowFilter(coverBgHex)}
                    coverShadowLite={heroBookCoverShadowFilterLite(coverBgHex)}
                    variant="catalog"
                    navigate={navigate}
                    fanZOrder={doc.booksFanZOrder}
                    gridRotationSeed={normalizeTitlePlayfulSeed(doc.titlePlayfulSeed)}
                    showEmptyHint
                    emptyHint="Vyberte produkty v panelu — zobrazí se až 6 obálek."
                  />
                </div>
              </div>
              <div
                className={`relative z-0 mt-auto flex w-full flex-col overflow-visible px-5 pb-3 pt-1 md:px-7 md:pb-4 ${
                  booksFanTextColCenter ? 'items-center text-center' : 'items-start text-left'
                }`}
                style={textWrapStyle}
              >
                <PreviewOrderedBlocks
                  doc={doc}
                  variant="centerBelow"
                  heroAlignStart={!booksFanTextColCenter}
                  accent={accent}
                  highlightBlockId={highlightBlockId}
                />
              </div>
            </div>
          ) : (
            <div className="relative z-10 h-full min-h-0 w-full overflow-visible">
              <div
                className={`relative z-0 flex w-full flex-col overflow-visible px-5 pb-1 pt-3 md:px-7 md:pt-4 ${
                  booksFanTextColCenter ? 'items-center text-center' : 'items-start text-left'
                }`}
                style={textWrapStyle}
              >
                <PreviewOrderedBlocks
                  doc={doc}
                  variant="centerBelow"
                  heroAlignStart={!booksFanTextColCenter}
                  accent={accent}
                  highlightBlockId={highlightBlockId}
                />
              </div>
              <div
                className="absolute inset-x-0 bottom-0 z-20 flex min-w-0 items-end justify-center overflow-x-auto overflow-y-visible px-0 pb-2 md:pb-3"
                style={{
                  minHeight: heroBooksFanBelowShelfMinPx(doc.booksFanBelowShelfPercent),
                  paddingTop: heroBooksFanBelowCollageTopBleedPx(doc.booksFanCollageOffsetYPx),
                }}
              >
                <div className="flex w-full justify-center" style={collageTransformBelow}>
                  <HeroBooksFanCovers
                    books={previewBooks}
                    arrangement={doc.booksFanArrangement}
                    gapPx={doc.booksFanGapPx}
                    scalePct={doc.booksFanScalePct}
                    coverShadow={heroBookCoverShadowFilter(coverBgHex)}
                    coverShadowLite={heroBookCoverShadowFilterLite(coverBgHex)}
                    variant="catalog"
                    navigate={navigate}
                    fanZOrder={doc.booksFanZOrder}
                    gridRotationSeed={normalizeTitlePlayfulSeed(doc.titlePlayfulSeed)}
                    showEmptyHint
                    emptyHint="Vyberte produkty v panelu — zobrazí se až 6 obálek."
                  />
                </div>
              </div>
            </div>
          )
        ) : showTextProductsSide ? (
          <div
            className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col gap-2 overflow-x-hidden overflow-y-visible md:grid md:h-full md:items-stretch md:gap-0 md:overflow-visible"
            style={{ gridTemplateColumns: `minmax(0, 1fr) ${booksFanColPct}%` }}
          >
            <div
              className={`relative z-0 flex min-h-0 min-w-0 flex-1 flex-col justify-start overflow-y-auto overscroll-y-contain py-5 pb-2 pl-0 pr-3 md:justify-center md:py-6 md:pb-3 md:pr-4 ${
                booksFanTextColCenter ? 'items-center' : 'items-start'
              }`}
              style={textWrapStyle}
            >
              <PreviewOrderedBlocks
                doc={doc}
                variant="booksFan"
                heroAlignStart={false}
                leftImageTextCenter={booksFanTextColCenter}
                accent={accent}
                highlightBlockId={highlightBlockId}
              />
            </div>
            <div className="relative z-10 hidden h-full min-h-0 min-w-0 items-center justify-center overflow-x-auto overflow-y-visible py-0 pr-0 md:flex">
              <div style={collageTransformBelow}>
                <HeroBooksFanCovers
                  books={previewBooks}
                  arrangement={doc.booksFanArrangement}
                  gapPx={doc.booksFanGapPx}
                  scalePct={doc.booksFanScalePct}
                  coverShadow={heroBookCoverShadowFilter(coverBgHex)}
                  coverShadowLite={heroBookCoverShadowFilterLite(coverBgHex)}
                  variant="catalog"
                  navigate={navigate}
                  fanZOrder={doc.booksFanZOrder}
                  gridRotationSeed={normalizeTitlePlayfulSeed(doc.titlePlayfulSeed)}
                  showEmptyHint
                  emptyHint="Vyberte produkty v panelu vlevo — zobrazí se až 6 obálek."
                />
              </div>
            </div>
            {device === 'phone' && (
              <div className="relative z-10 mt-2 flex w-full shrink-0 justify-center overflow-visible pb-0 md:hidden">
                <div style={collageTransformBelow}>
                  <HeroBooksFanCovers
                    books={previewBooks}
                    arrangement={doc.booksFanArrangement}
                    gapPx={doc.booksFanGapPx}
                    scalePct={doc.booksFanScalePct}
                    coverShadow={heroBookCoverShadowFilter(coverBgHex)}
                    coverShadowLite={heroBookCoverShadowFilterLite(coverBgHex)}
                    variant="catalog"
                    navigate={navigate}
                    fanZOrder={doc.booksFanZOrder}
                    gridRotationSeed={normalizeTitlePlayfulSeed(doc.titlePlayfulSeed)}
                    maxItems={4}
                  />
                </div>
              </div>
            )}
          </div>
        ) : showFullImage ? (
          <div className="relative z-10 h-full min-h-0 w-full flex-1 overflow-hidden">
            <img
              src={doc.image}
              alt=""
              className="pointer-events-none absolute inset-0 z-0 size-full object-cover"
              style={heroLeftImageImgStyle(doc.heroImageScalePct, doc.heroImagePosXPct, doc.heroImagePosYPct)}
            />
            <div
              className={`relative z-10 flex h-full min-h-0 w-full flex-col justify-center overflow-y-auto overscroll-y-contain px-4 py-3 md:px-6 md:py-5 ${
                doc.heroImageColumnAlign === 'center' ? 'items-center' : 'items-start'
              }`}
              style={textWrapStyle}
            >
              <PreviewOrderedBlocks
                doc={doc}
                variant="fullImage"
                heroAlignStart={false}
                leftImageTextCenter={doc.heroImageColumnAlign === 'center'}
                accent={accent}
                highlightBlockId={highlightBlockId}
              />
            </div>
          </div>
        ) : showLeftImage ? (
          /* Telefon vs desktop řídíme podle `device`, ne `md:` — jinak na širokém monitoru „Telefon“ 390px stejně matchne md: a rozložení/rodič absolutního obrázku je rozbité. */
          device === 'phone' ? (
            <div className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col gap-2 overflow-x-visible overflow-y-hidden">
              <div
                className={`flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center overflow-y-auto overscroll-y-contain py-2 pb-1 ${
                  leftBleed ? 'pl-6 pr-4' : 'px-5'
                }`}
                style={textWrapStyle}
              >
                <PreviewOrderedBlocks
                  doc={doc}
                  variant="leftImage"
                  heroAlignStart={false}
                  leftImageTextCenter={doc.heroImageColumnAlign === 'center'}
                  accent={accent}
                  highlightBlockId={highlightBlockId}
                />
              </div>
              <div className="relative min-h-0 w-full min-w-0 flex-1 basis-0 shrink-0 self-stretch overflow-hidden rounded-none">
                <img
                  src={doc.image}
                  alt=""
                  className="absolute inset-0 size-full"
                  style={heroLeftImageImgStyle(doc.heroImageScalePct, doc.heroImagePosXPct, doc.heroImagePosYPct)}
                />
              </div>
            </div>
          ) : (
            <div
              className="z-10 grid h-full min-h-0 min-w-0 w-full flex-1 grid-rows-1 gap-0 overflow-hidden"
              style={{ gridTemplateColumns: `minmax(0, 1fr) ${imgColPct}%` }}
            >
              <div
                className={`flex min-h-0 min-w-0 flex-col justify-center overflow-y-auto overscroll-y-contain py-5 pb-2 pl-1 pr-5 ${leftBleed ? 'py-7' : ''}`}
                style={textWrapStyle}
              >
                <PreviewOrderedBlocks
                  doc={doc}
                  variant="leftImage"
                  heroAlignStart={false}
                  leftImageTextCenter={doc.heroImageColumnAlign === 'center'}
                  accent={accent}
                  highlightBlockId={highlightBlockId}
                />
              </div>
              <div
                className={`relative min-h-0 h-full min-w-0 overflow-hidden ${leftBleed ? '' : 'rounded-2xl'}`}
              >
                <img
                  src={doc.image}
                  alt=""
                  className="absolute inset-0 size-full"
                  style={heroLeftImageImgStyle(doc.heroImageScalePct, doc.heroImagePosXPct, doc.heroImagePosYPct)}
                />
              </div>
            </div>
          )
        ) : (
          <div
            className={`z-10 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden py-1 ${
              heroAlignStart ? 'items-start justify-center' : 'items-center justify-center'
            }`}
          >
            <div
              className={`flex max-h-full min-h-0 w-full flex-col overflow-y-auto overscroll-y-contain py-1 ${
                heroAlignStart ? 'max-w-xl items-start text-left' : 'items-center text-center'
              }`}
              style={textWrapStyle}
            >
              <PreviewOrderedBlocks
                doc={doc}
                variant="center"
                heroAlignStart={heroAlignStart}
                accent={accent}
                highlightBlockId={highlightBlockId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VisualEditorPage() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const [searchParams] = useSearchParams();
  const [doc, setDoc] = useState<EditorDoc>(defaultDoc);
  const [phoneOverrideEnabled, setPhoneOverrideEnabled] = useState(false);
  const [phoneOverrides, setPhoneOverrides] = useState<EditorPhoneOverrides>({});
  const docRef = useRef(doc);
  docRef.current = doc;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [order, setOrder] = useState(0);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [saving, setSaving] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GalleryPickItem[]>([]);
  /** URL nahraného obrázku → složka (KV, stejné jako Image Agent) */
  const [galleryFoldersByUrl, setGalleryFoldersByUrl] = useState<Record<string, string>>({});
  const [slidesList, setSlidesList] = useState<any[]>([]);
  const [slidesLoadState, setSlidesLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slidesLoadError, setSlidesLoadError] = useState<string | null>(null);
  const missingSlideToastRef = useRef(false);
  /** `null` = všechny obrázky; jinak název složky (předmět, Nahrané soubory, …) */
  const [galleryFolderFilter, setGalleryFolderFilter] = useState<string | null>(null);
  const galleryUploadInputRef = useRef<HTMLInputElement>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  /** Zvýraznění odpovídajícího bloku v náhledu při hoveru v panelu */
  const [canvasHoverBlock, setCanvasHoverBlock] = useState<HeroContentBlockId | null>(null);
  /** Kam se vloží blok při DnD (čára mezi řádky) */
  const [blockDropHint, setBlockDropHint] = useState<{
    overId: HeroContentBlockId;
    edge: 'before' | 'after';
  } | null>(null);
  const draggingBlockRef = useRef<HeroContentBlockId | null>(null);

  const loadSlides = useCallback(async () => {
    setSlidesLoadState('loading');
    setSlidesLoadError(null);
    const result = await fetchJsonWithRetry<{ items?: unknown }>(
      `${SERVER}/admin/hero-slidy`,
      { headers: AUTH_H_NO_CT },
      { maxAttempts: 4, baseDelayMs: 350 },
    );
    if (!result.ok) {
      setSlidesLoadState('error');
      setSlidesLoadError(result.error);
      toast.error(`Nelze načíst hero slidy: ${result.error}`, { id: 'hero-slides-load-err' });
      return;
    }
    const raw = result.data?.items;
    setSlidesList(Array.isArray(raw) ? raw : []);
    setSlidesLoadState('ready');
  }, []);

  useEffect(() => {
    void loadSlides();
  }, [loadSlides]);

  useEffect(() => {
    const endDrag = () => {
      draggingBlockRef.current = null;
      setBlockDropHint(null);
    };
    window.addEventListener('dragend', endDrag);
    return () => window.removeEventListener('dragend', endDrag);
  }, []);

  const loadGalleryItems = useCallback(async () => {
    const all: GalleryPickItem[] = [];
    try {
      const r = await fetch(`${SERVER}/products`, { headers: AUTH_H_NO_CT });
      if (r.ok) {
        const d = await r.json();
        (d.products || []).forEach((p: any) => {
          if (p.image)
            all.push({
              url: p.image,
              name: p.name || '?',
              source: 'product',
              category: p.category,
              predmet: p.predmet,
            });
          if (p.coverImage && p.coverImage !== p.image)
            all.push({
              url: p.coverImage,
              name: `${p.name || '?'} (cover)`,
              source: 'product',
              category: p.category,
              predmet: p.predmet,
            });
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch(`${SERVER}/webinare`, { headers: AUTH_H_NO_CT });
      if (r.ok) {
        const d = await r.json();
        (d.items || []).forEach((w: any) => {
          if (w.coverImage)
            all.push({ url: w.coverImage, name: w.title || '?', source: 'webinar' });
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch(`${SERVER}/admin/blog`, { headers: AUTH_H_NO_CT });
      if (r.ok) {
        const d = await r.json();
        (d.items || []).forEach((b: any) => {
          if (b.coverImage)
            all.push({
              url: b.coverImage,
              name: b.title || '?',
              source: 'blog',
              category: b.category,
            });
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch(`${SERVER}/admin/novinky`, { headers: AUTH_H_NO_CT });
      if (r.ok) {
        const d = await r.json();
        (d.items || []).forEach((n: any) => {
          if (n.coverImage) all.push({ url: n.coverImage, name: n.title || '?', source: 'novinky' });
        });
      }
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch(`${SERVER}/images`, { headers: AUTH_H_NO_CT });
      if (r.ok) {
        const d = await r.json();
        all.push(
          ...(Array.isArray(d.images) ? d.images : []).map((img: any) => ({
            url: img.url,
            name: img.name || '?',
            source: 'upload' as const,
          })),
        );
      }
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch(`${SERVER}/image-tags`, { headers: AUTH_H_NO_CT });
      if (r.ok) {
        const d = await r.json();
        setGalleryFoldersByUrl(d.galleryFolders && typeof d.galleryFolders === 'object' ? d.galleryFolders : {});
      }
    } catch {
      setGalleryFoldersByUrl({});
    }
    setGalleryItems(all);
  }, []);

  useEffect(() => {
    void loadGalleryItems();
  }, [loadGalleryItems]);

  const patchDoc = useCallback((fn: (prev: EditorDoc) => EditorDoc) => {
    if (phoneOverrideEnabled && device === 'phone') {
      setPhoneOverrides((o) => {
        const base = docRef.current;
        const mergedPrev = applyEditorPhoneOverrides(base, o);
        return extractOverridesFromBase(base, fn(mergedPrev));
      });
    } else {
      setDoc(fn);
    }
  }, [phoneOverrideEnabled, device]);

  const handleGalleryImageUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setGalleryUploading(true);
      let uploaded = 0;
      let lastUrl: string | null = null;
      for (const file of Array.from(files)) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: AUTH_H_NO_CT, body: fd });
          const d = await res.json();
          if (d.url) {
            uploaded++;
            lastUrl = d.url;
          } else {
            toast.error(`${file.name}: ${d.error || 'Upload selhal'}`);
          }
        } catch (e: any) {
          toast.error(`${file.name}: ${e.message}`);
        }
      }
      if (uploaded > 0) {
        toast.success(
          `Nahráno ${uploaded} soubor${uploaded === 1 ? '' : uploaded < 5 ? 'y' : 'ů'} — zobrazí se mezi nahranými.`,
        );
        await loadGalleryItems();
        setGalleryFolderFilter('Nahrané soubory');
        if (uploaded === 1 && lastUrl) {
          patchDoc((d) => ({
            ...d,
            image: lastUrl,
            layoutVisual: d.layoutVisual === 'full-image' ? 'full-image' : 'left-image',
          }));
          toast.success('Obrázek nastaven jako fotka slidu');
        }
      }
      setGalleryUploading(false);
      if (galleryUploadInputRef.current) galleryUploadInputRef.current.value = '';
    },
    [loadGalleryItems, patchDoc],
  );

  const panelDoc = useMemo(() => {
    if (phoneOverrideEnabled && device === 'phone') return applyEditorPhoneOverrides(doc, phoneOverrides);
    return doc;
  }, [doc, phoneOverrides, phoneOverrideEnabled, device]);

  const previewDoc = useMemo(() => {
    if (device === 'phone' && phoneOverrideEnabled) return applyEditorPhoneOverrides(doc, phoneOverrides);
    return doc;
  }, [doc, phoneOverrides, device, phoneOverrideEnabled]);

  const idFromUrl = searchParams.get('id');
  useEffect(() => {
    if (!idFromUrl) {
      missingSlideToastRef.current = false;
      return;
    }
    if (slidesLoadState === 'loading') return;
    if (slidesLoadState === 'error') return;

    const it = slidesList.find((x) => String(x.id) === String(idFromUrl));
    if (it) {
      missingSlideToastRef.current = false;
      setEditingId(it.id);
      setOrder(Number(it.order) || 0);
      setDoc(docFromApiItem(it));
      setPhoneOverrideEnabled(Boolean(it.phoneOverrideEnabled));
      setPhoneOverrides(phoneDiffToEditorOverrides(it, parseHeroPhoneDiff(it.phoneOverrides)));
      return;
    }

    setEditingId(null);
    setDoc(defaultDoc());
    setPhoneOverrideEnabled(false);
    setPhoneOverrides({});
    if (!missingSlideToastRef.current) {
      missingSlideToastRef.current = true;
      toast.error('Slide pod tímto odkazem není v načtených datech — zkuste „Obnovit“ v hlavičce.', {
        id: 'hero-editor-slide-missing',
      });
    }
  }, [idFromUrl, slidesList, slidesLoadState]);

  const folderEntries = useMemo(() => {
    const m = new Map<string, number>();
    galleryItems.forEach((g) => {
      const k = galleryPickFolder(g, galleryFoldersByUrl);
      m.set(k, (m.get(k) || 0) + 1);
    });
    const sourceOrder = ['Webináře', 'Blog', 'Novinky', 'Nahrané soubory'];
    return [...m.entries()].sort(([a], [b]) => {
      const ai = sourceOrder.indexOf(a);
      const bi = sourceOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'cs');
      if (ai === -1) return -1;
      if (bi === -1) return 1;
      return ai - bi;
    });
  }, [galleryItems, galleryFoldersByUrl]);

  const filteredGalleryItems = useMemo(() => {
    if (galleryFolderFilter === null) return galleryItems;
    return galleryItems.filter((g) => galleryPickFolder(g, galleryFoldersByUrl) === galleryFolderFilter);
  }, [galleryItems, galleryFolderFilter, galleryFoldersByUrl]);

  const badgesText = panelDoc.badges.join('\n');
  const setBadgesFromText = (t: string) =>
    patchDoc((d) => ({ ...d, badges: t.split(/\n/).map((s) => s.trim()).filter(Boolean) }));

  const addUnderline = () => {
    const el = titleRef.current;
    if (!el) return;
    const a = el.selectionStart ?? 0;
    const b = el.selectionEnd ?? 0;
    if (a === b) {
      toast.message('V nadpisu označte text, který chcete zvýraznit (pill).');
      return;
    }
    const [x, y] = a < b ? [a, b] : [b, a];
    patchDoc((d) => ({
      ...d,
      titleUnderlines: mergeHeroUnderlineRanges(d.title.length, [...d.titleUnderlines, [x, y]]),
    }));
    toast.success('Zvýraznění (pill) přidáno');
  };

  const save = async () => {
    if (panelDoc.heroBlockVisibility.title && !panelDoc.title.trim()) {
      toast.error('Nadpis je zapnutý — vyplňte text, nebo blok vypněte nahoře.');
      return;
    }
    setSaving(true);
    try {
      let nextOrder = order;
      let id = editingId || `slide-${Date.now()}`;
      if (!editingId) {
        const listRes = await fetch(`${SERVER}/admin/hero-slidy`, { headers: AUTH_H_NO_CT });
        const listData = await listRes.json();
        const items: any[] = listData.items || [];
        nextOrder = items.reduce((m, it) => Math.max(m, Number(it.order) || 0), 0) + 1;
        setOrder(nextOrder);
      }
      const payload = buildPayload(doc, nextOrder, id) as Record<string, unknown>;
      if (phoneOverrideEnabled) {
        const merged = applyEditorPhoneOverrides(doc, phoneOverrides);
        const mergedPayload = buildPayload(merged, nextOrder, id) as Record<string, unknown>;
        payload.phoneOverrideEnabled = true;
        payload.phoneOverrides = JSON.stringify(diffHeroPayloads(payload, mergedPayload));
      } else {
        payload.phoneOverrideEnabled = false;
        payload.phoneOverrides = '{}';
      }
      const url = editingId ? `${SERVER}/admin/hero-slidy/${encodeURIComponent(editingId)}` : `${SERVER}/admin/hero-slidy`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: AUTH_H,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Uložení selhalo');
        return;
      }
      toast.success(editingId ? 'Slide aktualizován.' : 'Slide uložen do Hero slidů.');
      if (!editingId) {
        setEditingId(id);
        navigate(`/admin/visual-editor?id=${encodeURIComponent(id)}`, { replace: true });
      }
      void loadSlides();
    } catch (e: any) {
      toast.error(e?.message || 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  const newSlide = () => {
    setEditingId(null);
    setOrder(0);
    setDoc(defaultDoc());
    setPhoneOverrideEnabled(false);
    setPhoneOverrides({});
    navigate('/admin/visual-editor', { replace: true });
  };

  /** Skládané layouty (obálky pod nebo nahoře) — stránka smí přerůst viewport; scrolluje celé okno. */
  const previewBelowStacked =
    previewDoc.layoutVisual === 'text-products-below' ||
    previewDoc.layoutVisual === 'products-text-below';

  const blockPreviewForUrlSlide =
    Boolean(idFromUrl) &&
    (slidesLoadState === 'loading' ||
      slidesLoadState === 'error' ||
      (slidesLoadState === 'ready' &&
        !slidesList.some((s) => String(s.id) === String(idFromUrl))));

  return (
    <div
      className={`flex flex-col bg-[#0f1117] text-white ${
        previewBelowStacked ? 'min-h-screen' : 'h-screen min-h-0'
      }`}
      style={F}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-bold text-white/90 hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Zpět do adminu
          </button>
          <span className="hidden text-[13px] text-white/40 sm:inline">Vizuální editor — hero slider</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={newSlide}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/10"
          >
            Nový slide
          </button>
          <Link
            to="/admin/kolekce/hero-slidy"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/10"
          >
            Kolekce Hero slidy
          </Link>
          <button
            type="button"
            onClick={() => void loadSlides()}
            disabled={slidesLoadState === 'loading'}
            title="Znovu načíst data slidů ze serveru (pro odkaz ?id=…)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${slidesLoadState === 'loading' ? 'animate-spin' : ''}`} aria-hidden />
            Obnovit
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-[#6d28d9] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {editingId ? 'Uložit' : 'Uložit jako nový'}
          </button>
        </div>
      </header>

      <div className={`flex flex-1 ${previewBelowStacked ? 'w-full' : 'min-h-0'}`}>
        <aside
          className={`flex w-[min(100vw-2rem,380px)] max-w-[380px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#161922] sm:w-[380px] ${
            previewBelowStacked ? 'sticky top-12 z-10 max-h-[calc(100vh-3rem)] self-start' : ''
          }`}
          style={F}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border border-white/10 bg-[#1a1e28] p-2.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-white/45">Bloky na slidu</p>
              <div
                className="max-h-[200px] space-y-0 overflow-y-auto rounded-lg border border-white/5"
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setBlockDropHint(null);
                  }
                }}
              >
                {panelDoc.heroBlockOrder.map((bid) => {
                  const from = draggingBlockRef.current;
                  const hint =
                    blockDropHint && blockDropHint.overId === bid ? blockDropHint.edge : null;
                  const showLineBefore = hint === 'before';
                  const showLineAfter = hint === 'after';
                  return (
                    <div key={bid} role="listitem" className="relative">
                      {showLineBefore && (
                        <div
                          className="pointer-events-none absolute top-0 right-2 left-2 z-10 h-0.5 -translate-y-px rounded-full bg-[#7C3AED] shadow-[0_0_10px_rgba(124,58,237,0.9)]"
                          aria-hidden
                        />
                      )}
                      <div
                        onMouseEnter={() => setCanvasHoverBlock(bid)}
                        onMouseLeave={() => setCanvasHoverBlock((h) => (h === bid ? null : h))}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          const dragId = draggingBlockRef.current;
                          if (!dragId || dragId === bid) {
                            setBlockDropHint(null);
                            return;
                          }
                          const row = e.currentTarget.getBoundingClientRect();
                          const mid = row.top + row.height / 2;
                          const edge = e.clientY < mid ? 'before' : 'after';
                          setBlockDropHint({ overId: bid, edge });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragFrom = e.dataTransfer.getData('heroBlock') as HeroContentBlockId;
                          draggingBlockRef.current = null;
                          setBlockDropHint(null);
                          if (!dragFrom || dragFrom === bid) return;
                          const row = e.currentTarget.getBoundingClientRect();
                          const mid = row.top + row.height / 2;
                          const edge = e.clientY < mid ? 'before' : 'after';
                          patchDoc((d) => ({
                            ...d,
                            heroBlockOrder: reorderHeroBlockOrder(d.heroBlockOrder, dragFrom, bid, edge),
                          }));
                        }}
                        className={`flex items-center gap-2 border-b border-white/5 px-2 py-2 last:border-b-0 ${
                          from === bid ? 'bg-white/[0.06]' : ''
                        }`}
                      >
                        <span
                          draggable
                          title="Přetáhnout"
                          onDragStart={(e) => {
                            draggingBlockRef.current = bid;
                            e.dataTransfer.setData('heroBlock', bid);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className="inline-flex cursor-grab touch-none items-center rounded p-0.5 text-white/25 active:cursor-grabbing hover:text-white/45"
                          aria-label="Pořadí — přetáhnout"
                        >
                          <GripVertical className="size-4 shrink-0" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 select-none text-[12px] font-bold text-white/90">
                          {BLOCK_LABELS[bid]}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={panelDoc.heroBlockVisibility[bid]}
                          title={panelDoc.heroBlockVisibility[bid] ? 'Zapnuto' : 'Vypnuto'}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          onClick={() =>
                            patchDoc((d) => ({
                              ...d,
                              heroBlockVisibility: {
                                ...d.heroBlockVisibility,
                                [bid]: !d.heroBlockVisibility[bid],
                              },
                            }))
                          }
                          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${panelDoc.heroBlockVisibility[bid] ? 'bg-[#7C3AED]' : 'bg-white/20'}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${panelDoc.heroBlockVisibility[bid] ? 'translate-x-4' : ''}`}
                          />
                        </button>
                      </div>
                      {showLineAfter && (
                        <div
                          className="pointer-events-none absolute right-2 bottom-0 left-2 z-10 h-0.5 translate-y-px rounded-full bg-[#7C3AED] shadow-[0_0_10px_rgba(124,58,237,0.9)]"
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {panelDoc.heroBlockVisibility.title && (
              <div
                onMouseEnter={() => setCanvasHoverBlock('title')}
                onMouseLeave={() => setCanvasHoverBlock((h) => (h === 'title' ? null : h))}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                    {BLOCK_LABELS.title}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400/90">Zapnuto</span>
                </div>
                <div className="mb-3 space-y-3 rounded-lg border border-white/10 bg-[#141821]/80 p-2.5">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                      Font nadpisu
                    </label>
                    <select
                      value={panelDoc.titleFont}
                      onChange={(e) =>
                        patchDoc((d) => ({ ...d, titleFont: e.target.value as HeroSlideTitleFontId }))
                      }
                      className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-2 py-2 text-[12px] text-white"
                    >
                      {HERO_TITLE_FONT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                      Náklon nadpisu
                    </label>
                    <select
                      value={panelDoc.titleTiltMode}
                      onChange={(e) =>
                        patchDoc((d) => ({
                          ...d,
                          titleTiltMode: e.target.value as HeroTitleTiltMode,
                        }))
                      }
                      className="mb-2 w-full rounded-lg border border-white/15 bg-[#0f1117] px-2 py-2 text-[12px] text-white"
                    >
                      <option value="none">Žádný náklon</option>
                      <option value="uniform">Nahnutý celý nadpis</option>
                      <option value="playful">Hravý (každé slovo jinak)</option>
                      <option value="fan">Vějíř (oblouk nahoru)</option>
                    </select>
                    {panelDoc.titleTiltMode === 'uniform' && (
                      <>
                        <label className="mb-1 block text-[10px] text-white/40">
                          Úhel: {panelDoc.titleTiltDeg}°
                        </label>
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={0.5}
                          value={panelDoc.titleTiltDeg}
                          onChange={(e) => patchDoc((d) => ({ ...d, titleTiltDeg: Number(e.target.value) }))}
                          className="h-2 w-full accent-[#7C3AED]"
                        />
                      </>
                    )}
                    {(panelDoc.titleTiltMode === 'playful' || panelDoc.titleTiltMode === 'fan') && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] leading-snug text-white/35">
                          {panelDoc.titleTiltMode === 'playful'
                            ? 'Každé slovo má jiný úhel — vhodné pro kratší nadpisy.'
                            : 'Slova sledují horní oblouk (střed výš).'}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            patchDoc((d) => ({
                              ...d,
                              titlePlayfulSeed: (Math.random() * 0xffffffff) >>> 0,
                            }))
                          }
                          className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-[#7C3AED]/50 bg-[#7C3AED]/20 px-2.5 py-1.5 text-[10px] font-bold text-[#c4b5fd] hover:bg-[#7C3AED]/30"
                        >
                          <RefreshCw className="size-3.5 shrink-0" aria-hidden />
                          Znovu (jiné rozložení)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  ref={titleRef}
                  value={panelDoc.title}
                  onChange={(e) =>
                    patchDoc((d) => ({
                      ...d,
                      title: e.target.value,
                      titleUnderlines: mergeHeroUnderlineRanges(e.target.value.length, d.titleUnderlines),
                    }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-[13px] text-white placeholder:text-white/30"
                  placeholder="Hlavní nadpis slidu"
                />
                <p className="mt-1 text-[9px] text-white/30">Enter = nový řádek i na webu (u zvýraznění počítají znaky včetně konců řádků).</p>
                <button
                  type="button"
                  onClick={addUnderline}
                  className="mt-1.5 w-full rounded-lg border border-[#7C3AED]/40 bg-[#7C3AED]/15 py-1.5 text-[11px] font-bold text-[#c4b5fd]"
                >
                  Zvýraznit označený text (pill)
                </button>
                {panelDoc.titleUnderlines.length > 0 && (
                  <>
                    <div className="mt-2 space-y-2">
                      <VisualEditorColorField
                        label="Barva pozadí pill"
                        value={panelDoc.titlePillHighlightColor}
                        fallback="#a78bfa"
                        onChange={(hex) => patchDoc((d) => ({ ...d, titlePillHighlightColor: hex }))}
                      />
                      <VisualEditorColorField
                        label="Barva textu ve zvýraznění"
                        value={panelDoc.titlePillHighlightTextColor}
                        fallback={panelDoc.heroTextColor?.startsWith('#') ? panelDoc.heroTextColor : '#001161'}
                        onChange={(hex) => patchDoc((d) => ({ ...d, titlePillHighlightTextColor: hex }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => patchDoc((d) => ({ ...d, titlePillHighlightColor: '' }))}
                          className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-bold text-white/65 hover:bg-white/10"
                        >
                          Auto pozadí pill
                        </button>
                        <button
                          type="button"
                          onClick={() => patchDoc((d) => ({ ...d, titlePillHighlightTextColor: '' }))}
                          className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-bold text-white/65 hover:bg-white/10"
                        >
                          Auto text ve pill
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[9px] leading-snug text-white/30">
                      Auto pozadí = podle barvy textu slidu (níže), směs s bílou. Auto text = stejná barva jako zbytek
                      nadpisu. Vlastní barva pozadí pill je plně krycí.
                    </p>
                    <ul className="mt-2 space-y-1 text-[10px] text-white/50">
                      {panelDoc.titleUnderlines.map(([a, b], i) => (
                        <li key={`${a}-${b}-${i}`} className="flex items-center justify-between gap-2">
                          <span>
                            [{a}–{b}]: „{panelDoc.title.slice(a, b)}“
                          </span>
                          <button
                            type="button"
                            className="text-red-300 hover:underline"
                            onClick={() =>
                              patchDoc((d) => ({
                                ...d,
                                titleUnderlines: d.titleUnderlines.filter((_, j) => j !== i),
                              }))
                            }
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {panelDoc.heroBlockVisibility.subtitle && (
              <div
                onMouseEnter={() => setCanvasHoverBlock('subtitle')}
                onMouseLeave={() => setCanvasHoverBlock((h) => (h === 'subtitle' ? null : h))}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                    {BLOCK_LABELS.subtitle}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400/90">Zapnuto</span>
                </div>
                <textarea
                  value={panelDoc.subtitle}
                  onChange={(e) => patchDoc((d) => ({ ...d, subtitle: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-[13px] text-white"
                />
                <p className="mt-1 text-[9px] text-white/30">Enter = nový řádek i na webu.</p>
              </div>
            )}

            {panelDoc.heroBlockVisibility.bottom && (
              <div
                onMouseEnter={() => setCanvasHoverBlock('bottom')}
                onMouseLeave={() => setCanvasHoverBlock((h) => (h === 'bottom' ? null : h))}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                    {BLOCK_LABELS.bottom}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400/90">Zapnuto</span>
                </div>
                <textarea
                  value={panelDoc.bottom}
                  onChange={(e) => patchDoc((d) => ({ ...d, bottom: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-[13px] text-white"
                />
                <p className="mt-1 text-[9px] text-white/30">Enter = nový řádek i na webu.</p>
              </div>
            )}

            {panelDoc.heroBlockVisibility.badges && (
              <div
                onMouseEnter={() => setCanvasHoverBlock('badges')}
                onMouseLeave={() => setCanvasHoverBlock((h) => (h === 'badges' ? null : h))}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                    {BLOCK_LABELS.badges} <span className="font-normal text-white/35">(1 řádek = 1)</span>
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400/90">Zapnuto</span>
                </div>
                <textarea
                  value={badgesText}
                  onChange={(e) => setBadgesFromText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-[13px] text-white"
                  placeholder="Doložky MŠMT&#10;Podle RVP"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3">
              {panelDoc.heroBlockVisibility.cta && (
                <div
                  onMouseEnter={() => setCanvasHoverBlock('cta')}
                  onMouseLeave={() => setCanvasHoverBlock((h) => (h === 'cta' ? null : h))}
                  className="space-y-3"
                >
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                        {BLOCK_LABELS.cta} — text
                      </span>
                      <span className="text-[9px] font-bold text-emerald-400/90">Zapnuto</span>
                    </div>
                    <input
                      value={panelDoc.ctaLabel}
                      onChange={(e) => patchDoc((d) => ({ ...d, ctaLabel: e.target.value }))}
                      className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-[13px] text-white"
                      placeholder="Volitelné tlačítko"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Odkaz při kliknutí
                </label>
                <input
                  value={panelDoc.link}
                  onChange={(e) => patchDoc((d) => ({ ...d, link: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-[#0f1117] px-3 py-2 text-[13px] text-white"
                  placeholder="/predmet/… nebo https://"
                />
                <p className="mt-1 text-[10px] leading-snug text-white/35">
                  Platí pro klik na celý slide i na tlačítko CTA (jedna adresa).
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                      Mezery mezi bloky
                    </label>
                    <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                      {panelDoc.heroBlockGapPx}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={56}
                    step={1}
                    value={panelDoc.heroBlockGapPx}
                    onChange={(e) =>
                      patchDoc((d) => ({
                        ...d,
                        heroBlockGapPx: clampHeroBlockGapPx(Number(e.target.value)),
                      }))
                    }
                    className="h-2 w-full accent-[#7C3AED]"
                  />
                  <p className="mt-1 text-[9px] leading-snug text-white/35">
                    0–56 px mezi nadpisem, podnadpisem, bobánky, spodním textem a CTA.
                  </p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                      Proklad nadpisu
                    </label>
                    <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                      {(clampHeroTitleLineHeightPct(panelDoc.heroTitleLineHeightPct) / 100).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={92}
                    max={155}
                    step={1}
                    value={clampHeroTitleLineHeightPct(panelDoc.heroTitleLineHeightPct)}
                    onChange={(e) =>
                      patchDoc((d) => ({
                        ...d,
                        heroTitleLineHeightPct: clampHeroTitleLineHeightPct(Number(e.target.value)),
                      }))
                    }
                    className="h-2 w-full accent-[#7C3AED]"
                  />
                  <p className="mt-1 text-[9px] leading-snug text-white/35">
                    Řádkování víceřádkového nadpisu (92–155 %, výchozí 108 % ≈ 1,08).
                  </p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                      Velikost nadpisu (%)
                    </label>
                    <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                      {clampHeroTitleSizePct(panelDoc.heroTitleSizePct)} %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={65}
                    max={135}
                    step={1}
                    value={clampHeroTitleSizePct(panelDoc.heroTitleSizePct)}
                    onChange={(e) =>
                      patchDoc((d) => ({
                        ...d,
                        heroTitleSizePct: clampHeroTitleSizePct(Number(e.target.value)),
                      }))
                    }
                    className="h-2 w-full accent-[#7C3AED]"
                  />
                  <p className="mt-1 text-[9px] leading-snug text-white/35">
                    Násobí automatickou velikost podle délky textu a layoutu (clamp + vw); 100 % je výchozí, menší /
                    větší je jen posun celé stupnice.
                  </p>
                </div>
              </div>
              <p className="text-[9px] leading-snug text-white/30">
                Obojí platí na slidu i v náhledu; mezery mezi bloky najdete i v kolekci Hero slidy.
              </p>
              <div className="space-y-3 rounded-lg border border-white/10 bg-[#141821]/40 p-2.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <VisualEditorColorField
                    label="Pozadí"
                    value={panelDoc.bg}
                    fallback="#e8d5f2"
                    onChange={(hex) => patchDoc((d) => ({ ...d, bg: hex }))}
                  />
                  <VisualEditorColorField
                    label="Barva textu"
                    value={panelDoc.heroTextColor}
                    fallback="#001161"
                    onChange={(hex) => patchDoc((d) => ({ ...d, heroTextColor: hex }))}
                  />
                </div>
                <HeroSimpleTextLayoutControls
                  layoutVisual={panelDoc.layoutVisual}
                  heroImageColumnAlign={panelDoc.heroImageColumnAlign}
                  onLayoutConfig={({ textZone, withPhoto, photoPlacement }) => {
                    patchDoc((d) => {
                      if (!withPhoto || photoPlacement === 'none') {
                        return {
                          ...d,
                          layoutVisual: textZone === 'center' ? 'center' : 'left-text',
                        };
                      }
                      const align = textZone === 'center' ? 'center' : 'start';
                      if (photoPlacement === 'fullscreen') {
                        return { ...d, layoutVisual: 'full-image', heroImageColumnAlign: align };
                      }
                      return { ...d, layoutVisual: 'left-image', heroImageColumnAlign: align };
                    });
                  }}
                  onExitProductLayout={() => patchDoc((d) => ({ ...d, layoutVisual: 'center' }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Slide s produkty (obálky)
                </label>
                <HeroProductLayoutPicker
                  value={panelDoc.layoutVisual}
                  onChange={(layoutVisual) => patchDoc((d) => ({ ...d, layoutVisual }))}
                />
                <p className="mt-1 text-[9px] leading-snug text-white/35">
                  U „text + produkty vpravo“ jsou obálky v pravém sloupci až k pravému a spodnímu okraji (jako fotka „až
                  ke kraji“); náhled používá stejné měřítko jako katalog. U skládaných variant je text uprostřed a buď
                  sešity dole, nebo nahoře („produkty nahoře + text pod“). Až 6 titulů, klik → produkt. Obálky se neřežou,
                  stín podle pozadí.
                </p>
              </div>
              {(panelDoc.layoutVisual === 'text-products' ||
                panelDoc.layoutVisual === 'text-products-below' ||
                panelDoc.layoutVisual === 'products-text-below') && (
                <div className="space-y-2 rounded-lg border border-white/10 bg-[#141821]/50 p-2.5">
                  <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                    Text — zarovnání
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => patchDoc((d) => ({ ...d, heroImageColumnAlign: 'start' }))}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                        panelDoc.heroImageColumnAlign !== 'center'
                          ? 'border-[#7C3AED] bg-[#7C3AED]/20 text-white'
                          : 'border-white/15 bg-[#0f1117] text-white/75 hover:border-white/25'
                      }`}
                    >
                      Vlevo (bok)
                    </button>
                    <button
                      type="button"
                      onClick={() => patchDoc((d) => ({ ...d, heroImageColumnAlign: 'center' }))}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                        panelDoc.heroImageColumnAlign === 'center'
                          ? 'border-[#7C3AED] bg-[#7C3AED]/20 text-white'
                          : 'border-white/15 bg-[#0f1117] text-white/75 hover:border-white/25'
                      }`}
                    >
                      Na střed
                    </button>
                  </div>
                  <p className="text-[9px] leading-snug text-white/35">
                    Stejně jako u slidu „fotka na celý slide“ — text v textové části vlevo nebo vycentrovaný (včetně
                    varianty text + obálky vedle sebe).
                  </p>
                </div>
              )}
              {(panelDoc.layoutVisual === 'text-products' ||
                panelDoc.layoutVisual === 'text-products-below' ||
                panelDoc.layoutVisual === 'products-text-below') && (
                <div className="space-y-3 rounded-lg border border-white/10 bg-[#141821]/60 p-2.5">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                      Produkty na slidu (obálky)
                    </label>
                    <HeroFanProductChecklist
                      bookProductIdsJson={panelDoc.bookProductIds}
                      onChangeIds={(ids) =>
                        patchDoc((d) => ({ ...d, bookProductIds: JSON.stringify(ids) }))
                      }
                    />
                    <p className="mt-1 text-[9px] leading-snug text-white/35">
                      Rozbalte seznam a zaškrtněte až 6 titulů. Chybí-li obálka u produktu, zobrazí se na slidu šedá náhradní dlaždice — obálku nahrajte u produktu.
                    </p>
                  </div>
                  <div className="space-y-3 border-t border-white/10 pt-3">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                      Poskládání titulů
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { v: 'grid' as const, label: 'Mřížka' },
                          { v: 'row' as const, label: 'Řada' },
                          { v: 'fan' as const, label: 'Vějíř' },
                        ] as const
                      ).map(({ v, label }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => patchDoc((d) => ({ ...d, booksFanArrangement: v }))}
                          className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                            panelDoc.booksFanArrangement === v
                              ? 'border-[#7C3AED] bg-[#7C3AED]/20 text-white'
                              : 'border-white/15 bg-[#0f1117] text-white/75 hover:border-white/25'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {panelDoc.booksFanArrangement === 'fan' && (
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                          Vrstvení vějíře (co je nahoře)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              { v: 'middle' as const, label: 'Střed' },
                              { v: 'right' as const, label: 'Pravá strana' },
                              { v: 'left' as const, label: 'Levá strana' },
                            ] as const
                          ).map(({ v, label }) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => patchDoc((d) => ({ ...d, booksFanZOrder: v }))}
                              className={`rounded-lg border px-1.5 py-2 text-[10px] font-semibold leading-tight transition-colors ${
                                panelDoc.booksFanZOrder === v
                                  ? 'border-[#7C3AED] bg-[#7C3AED]/20 text-white'
                                  : 'border-white/15 bg-[#0f1117] text-white/75 hover:border-white/25'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1 text-[9px] leading-snug text-white/35">
                          Která obálka překrývá ostatní — střed (jako klasický vějíř), nebo zvýraznění vpravo / vlevo.
                        </p>
                      </div>
                    )}
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                          Velikost obálek
                        </label>
                        <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                          {clampHeroBooksFanScalePct(panelDoc.booksFanScalePct)} %
                        </span>
                      </div>
                      <input
                        type="range"
                        min={55}
                        max={300}
                        step={1}
                        value={clampHeroBooksFanScalePct(panelDoc.booksFanScalePct)}
                        onChange={(e) =>
                          patchDoc((d) => ({
                            ...d,
                            booksFanScalePct: clampHeroBooksFanScalePct(Number(e.target.value)),
                          }))
                        }
                        className="h-2 w-full accent-[#7C3AED]"
                      />
                      <p className="mt-1 text-[9px] leading-snug text-white/35">
                        55–300 % základního rámečku; obrázek obálky je celý vidět (bez ořezu).
                      </p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                          Mezery mezi obálkami
                        </label>
                        <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                          {clampHeroBooksFanGapPx(panelDoc.booksFanGapPx)} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-48}
                        max={48}
                        step={1}
                        value={clampHeroBooksFanGapPx(panelDoc.booksFanGapPx)}
                        onChange={(e) =>
                          patchDoc((d) => ({
                            ...d,
                            booksFanGapPx: clampHeroBooksFanGapPx(Number(e.target.value)),
                          }))
                        }
                        className="h-2 w-full accent-[#7C3AED]"
                      />
                      <p className="mt-1 text-[9px] leading-snug text-white/35">
                        Záporné hodnoty tituly přibližují a překrývají. U mřížky při hodnotě ≥ 0 se použije klasický
                        rozestup (gap).
                      </p>
                    </div>
                    {(panelDoc.layoutVisual === 'text-products-below' ||
                      panelDoc.layoutVisual === 'products-text-below') && (
                      <>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                              Výška prostoru pro sešity
                            </label>
                            <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                              {clampHeroBooksFanBelowShelfPercent(panelDoc.booksFanBelowShelfPercent)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={28}
                            max={70}
                            step={1}
                            value={clampHeroBooksFanBelowShelfPercent(panelDoc.booksFanBelowShelfPercent)}
                            onChange={(e) =>
                              patchDoc((d) => ({
                                ...d,
                                booksFanBelowShelfPercent: clampHeroBooksFanBelowShelfPercent(
                                  Number(e.target.value),
                                ),
                              }))
                            }
                            className="h-2 w-full accent-[#7C3AED]"
                          />
                          <div className="mt-1 flex justify-between text-[9px] text-white/30">
                            <span>28%</span>
                            <span>70%</span>
                          </div>
                          <p className="mt-1 text-[9px] leading-snug text-white/35">
                            {panelDoc.layoutVisual === 'text-products-below'
                              ? 'Min. výška pásu přichyceného ke spodku hero (v % výšky slideru). Koláž může přes text (text je nahoře); posunem Y ji můžete zvednout k textu.'
                              : 'Min. výška pásu přichyceného k hornímu okraji hero. Koláž může přes text (text je dole); posunem Y ji můžete posunout k textu dolů.'}
                          </p>
                        </div>
                      </>
                    )}
                    {(panelDoc.layoutVisual === 'text-products' ||
                      panelDoc.layoutVisual === 'text-products-below' ||
                      panelDoc.layoutVisual === 'products-text-below') && (
                      <>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                              Koláž obálek — posun X
                            </label>
                            <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                              {clampHeroBooksFanCollageOffsetXPx(panelDoc.booksFanCollageOffsetXPx)} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-200}
                            max={200}
                            step={1}
                            value={clampHeroBooksFanCollageOffsetXPx(panelDoc.booksFanCollageOffsetXPx)}
                            onChange={(e) =>
                              patchDoc((d) => ({
                                ...d,
                                booksFanCollageOffsetXPx: clampHeroBooksFanCollageOffsetXPx(
                                  Number(e.target.value),
                                ),
                              }))
                            }
                            className="h-2 w-full accent-[#7C3AED]"
                          />
                          <div className="mt-1 flex justify-between text-[9px] text-white/30">
                            <span>−200 (vlevo)</span>
                            <span>+200 (vpravo)</span>
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                              Koláž obálek — posun Y
                            </label>
                            <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                              {clampHeroBooksFanCollageOffsetYPx(panelDoc.booksFanCollageOffsetYPx)} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-200}
                            max={200}
                            step={1}
                            value={clampHeroBooksFanCollageOffsetYPx(panelDoc.booksFanCollageOffsetYPx)}
                            onChange={(e) =>
                              patchDoc((d) => ({
                                ...d,
                                booksFanCollageOffsetYPx: clampHeroBooksFanCollageOffsetYPx(
                                  Number(e.target.value),
                                ),
                              }))
                            }
                            className="h-2 w-full accent-[#7C3AED]"
                          />
                          <div className="mt-1 flex justify-between text-[9px] text-white/30">
                            <span>−200 (od textu)</span>
                            <span>+200 (k textu)</span>
                          </div>
                          <p className="mt-1 text-[9px] leading-snug text-white/35">
                            Posun koláže v px: X vlevo/vpravo; kladné Y = k textu (překryv) — u „produkty pod“ je to
                            nahoru, u „produkty nahoře“ dolů. Při najetí na obálku jde tiskovina výš ve vrstvách
                            (z-index). Pevná výška hero; při velkém |Y| se přidá rezerva proti ořezu stínu (nahoře nebo
                            dole podle layoutu).
                          </p>
                        </div>
                      </>
                    )}
                    {panelDoc.layoutVisual === 'text-products' && (
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                            Šířka prostoru pro sešity
                          </label>
                          <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                            {clampHeroBooksFanColumnPercent(panelDoc.booksFanColumnPercent)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={28}
                          max={55}
                          step={1}
                          value={clampHeroBooksFanColumnPercent(panelDoc.booksFanColumnPercent)}
                          onChange={(e) =>
                            patchDoc((d) => ({
                              ...d,
                              booksFanColumnPercent: clampHeroBooksFanColumnPercent(Number(e.target.value)),
                            }))
                          }
                          className="h-2 w-full accent-[#7C3AED]"
                        />
                        <div className="mt-1 flex justify-between text-[9px] text-white/30">
                          <span>28%</span>
                          <span>55%</span>
                        </div>
                        <p className="mt-1 text-[9px] leading-snug text-white/35">
                          Podíl šířky hero pro sloupec s obálkami — stejně jako „šířka sloupce fotky“ u layoutu s obrázkem.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {panelDoc.layoutVisual === 'left-image' && (
                <>
                  <label className="flex items-center gap-2 text-[12px] text-white/80">
                    <input
                      type="checkbox"
                      checked={panelDoc.imageEdgeToEdge}
                      onChange={(e) => patchDoc((d) => ({ ...d, imageEdgeToEdge: e.target.checked }))}
                    />
                    Fotka až ke kraji
                  </label>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-white/45">
                        Šířka sloupce fotky
                      </label>
                      <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                        {panelDoc.imageColumnPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={28}
                      max={55}
                      step={1}
                      value={panelDoc.imageColumnPercent}
                      onChange={(e) =>
                        patchDoc((d) => ({
                          ...d,
                          imageColumnPercent: clampHeroImageColumnPercent(Number(e.target.value)),
                        }))
                      }
                      className="h-2 w-full accent-[#7C3AED]"
                    />
                    <div className="mt-1 flex justify-between text-[9px] text-white/30">
                      <span>28%</span>
                      <span>55%</span>
                    </div>
                  </div>
                </>
              )}
              {(panelDoc.layoutVisual === 'left-image' || panelDoc.layoutVisual === 'full-image') && (
                <div className="space-y-3 border-t border-white/10 pt-3">
                  {panelDoc.layoutVisual === 'full-image' && (
                    <p className="text-[10px] leading-snug text-white/55">
                      U layoutu „Celý slide“ sahá fotka přes celou plochu; sloupce s texty neřeší šířku sloupce fotky ani
                      okraj až ke kraji. Každý blok (nadpis, podnadpis, …) má vlastní šířku podle textu — bez stínu a
                      ohraničení.
                    </p>
                  )}
                  {panelDoc.layoutVisual === 'full-image' && (
                    <div className="space-y-3 border-b border-white/10 pb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                        Podbarvení textových polí
                      </p>
                      <VisualEditorColorField
                        label="Barva pozadí karet"
                        value={panelDoc.heroFullImageCardBgHex}
                        fallback="#ffffff"
                        onChange={(hex) => patchDoc((d) => ({ ...d, heroFullImageCardBgHex: hex }))}
                      />
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                            Neprůhlednost podbarvení
                          </label>
                          <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                            {clampHeroFullImageCardOpacityPct(panelDoc.heroFullImageCardOpacityPct)} %
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={clampHeroFullImageCardOpacityPct(panelDoc.heroFullImageCardOpacityPct)}
                          onChange={(e) =>
                            patchDoc((d) => ({
                              ...d,
                              heroFullImageCardOpacityPct: clampHeroFullImageCardOpacityPct(
                                Number(e.target.value),
                              ),
                            }))
                          }
                          className="h-2 w-full accent-[#7C3AED]"
                        />
                        <p className="mt-1 text-[9px] leading-snug text-white/35">
                          0 % = zcela průhledné (vidět jen rozostření fotky, pokud je zapnuté níže).
                        </p>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                            Rozostření fotky za kartami
                          </label>
                          <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                            {clampHeroFullImageCardBlurPx(panelDoc.heroFullImageCardBlurPx)} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={24}
                          step={1}
                          value={clampHeroFullImageCardBlurPx(panelDoc.heroFullImageCardBlurPx)}
                          onChange={(e) =>
                            patchDoc((d) => ({
                              ...d,
                              heroFullImageCardBlurPx: clampHeroFullImageCardBlurPx(Number(e.target.value)),
                            }))
                          }
                          className="h-2 w-full accent-[#7C3AED]"
                        />
                        <p className="mt-1 text-[9px] leading-snug text-white/35">
                          0 = žádný efekt „skla“; vyšší hodnota = silnější rozostření pozadí za polem.
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">Obrázek — ořez a posun</p>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                          Přiblížení (výřez)
                        </label>
                        <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                          {clampHeroImageScalePct(panelDoc.heroImageScalePct)} %
                        </span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={200}
                        step={1}
                        value={clampHeroImageScalePct(panelDoc.heroImageScalePct)}
                        onChange={(e) =>
                          patchDoc((d) => ({
                            ...d,
                            heroImageScalePct: clampHeroImageScalePct(Number(e.target.value)),
                          }))
                        }
                        className="h-2 w-full accent-[#7C3AED]"
                      />
                      <p className="mt-1 text-[9px] text-white/35">100 % = výchozí; víc = větší výřez (jako zoom do fotky).</p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                          Posun ořezu — vodorovně
                        </label>
                        <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                          {clampHeroImagePosPct(panelDoc.heroImagePosXPct)} %
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={clampHeroImagePosPct(panelDoc.heroImagePosXPct)}
                        onChange={(e) =>
                          patchDoc((d) => ({
                            ...d,
                            heroImagePosXPct: clampHeroImagePosPct(Number(e.target.value)),
                          }))
                        }
                        className="h-2 w-full accent-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                          Posun ořezu — svisle
                        </label>
                        <span className="text-[11px] font-bold tabular-nums text-[#c4b5fd]">
                          {clampHeroImagePosPct(panelDoc.heroImagePosYPct)} %
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={clampHeroImagePosPct(panelDoc.heroImagePosYPct)}
                        onChange={(e) =>
                          patchDoc((d) => ({
                            ...d,
                            heroImagePosYPct: clampHeroImagePosPct(Number(e.target.value)),
                          }))
                        }
                        className="h-2 w-full accent-[#7C3AED]"
                      />
                    </div>
                </div>
              )}
            </div>

            {(panelDoc.layoutVisual === 'left-image' || panelDoc.layoutVisual === 'full-image') && (
              <div className="border-t border-white/10 pt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-white/45">Galerie</p>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">
                  Složka nebo zdroj
                </label>
                <select
                  className="mb-2 w-full rounded-lg border border-white/15 bg-[#0f1117] px-2 py-2 text-[12px] text-white"
                  value={galleryFolderFilter === null ? '' : galleryFolderFilter}
                  onChange={(e) => setGalleryFolderFilter(e.target.value === '' ? null : e.target.value)}
                >
                  <option value="">Všechny obrázky ({galleryItems.length})</option>
                  {folderEntries.map(([name, count]) => (
                    <option key={name} value={name}>
                      {name} ({count})
                    </option>
                  ))}
                </select>
                <p className="mb-2 text-[10px] leading-snug text-white/35">
                  Stejné členění jako v Image Agentu: předměty z produktů, webináře, blog, novinky a nahrané soubory
                  (včetně složek z KV u uploadů).
                </p>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    ref={galleryUploadInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleGalleryImageUpload(e.target.files)}
                  />
                  <button
                    type="button"
                    disabled={galleryUploading}
                    onClick={() => galleryUploadInputRef.current?.click()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-400/50 bg-violet-500/15 px-2 py-2 text-[11px] font-bold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {galleryUploading ? (
                      <>
                        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                        Nahrávám…
                      </>
                    ) : (
                      <>
                        <Upload className="size-3.5 shrink-0" aria-hidden />
                        Nahrát obrázek
                      </>
                    )}
                  </button>
                </div>
                <p className="mb-1.5 text-[10px] text-white/40">Náhledy — klik = obrázek slidu</p>
                <div className="grid max-h-[220px] grid-cols-3 gap-1.5 overflow-y-auto">
                  {filteredGalleryItems.map((img, idx) => (
                    <button
                      key={`${img.url}-${idx}`}
                      type="button"
                      onClick={() => {
                        patchDoc((d) => ({
                          ...d,
                          image: img.url,
                          layoutVisual: d.layoutVisual === 'full-image' ? 'full-image' : 'left-image',
                        }));
                        toast.success(
                          panelDoc.layoutVisual === 'full-image'
                            ? 'Obrázek nastaven (fullscreen slide)'
                            : 'Obrázek nastaven — layout přepnut na text + fotka',
                        );
                      }}
                      className={`aspect-square overflow-hidden rounded-lg border-2 ${panelDoc.image === img.url ? 'border-[#7C3AED]' : 'border-transparent ring-1 ring-white/10 hover:ring-white/25'}`}
                    >
                      <img src={img.url} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-visible bg-[#e8eaef] p-6" style={F}>
          <div className="mb-4 flex shrink-0 items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold ${
                device === 'desktop' ? 'bg-[#001161] text-white' : 'bg-white text-[#001161] shadow'
              }`}
            >
              <Monitor className="size-4" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setDevice('phone')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold ${
                device === 'phone' ? 'bg-[#001161] text-white' : 'bg-white text-[#001161] shadow'
              }`}
            >
              <Smartphone className="size-4" />
              Telefon
            </button>
            {device === 'phone' && (
              <label className="ml-1 flex max-w-[220px] cursor-pointer items-start gap-2 rounded-xl border border-[#001161]/15 bg-white px-3 py-2 text-left shadow-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[#001161]"
                  checked={phoneOverrideEnabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setPhoneOverrideEnabled(on);
                    if (on) {
                      toast.message(
                        'Mobilní vrstva: úpravy v levém panelu platí jen pro úzké obrazovky (katalog podle šířky okna). Desktop zůstává beze změny.',
                        { duration: 5200 },
                      );
                    }
                  }}
                />
                <span className="text-[11px] font-semibold leading-snug text-[#001161]/90">
                  Jiné nastavení pro telefon
                </span>
              </label>
            )}
          </div>
          <div
            className={`relative w-full min-w-0 ${
              previewBelowStacked
                ? 'flex shrink-0 flex-col items-stretch overflow-visible pt-2 pb-2'
                : 'flex min-h-0 flex-1 flex-col items-stretch overflow-auto pt-2'
            }`}
          >
            {blockPreviewForUrlSlide ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-[24px] bg-[#e8eaef]/92 p-6 text-center shadow-inner backdrop-blur-[2px]">
                {slidesLoadState === 'loading' ? (
                  <>
                    <Loader2 className="size-10 shrink-0 animate-spin text-[#001161]" aria-hidden />
                    <p className="text-[13px] font-bold text-[#001161]">Načítám slide ze serveru…</p>
                    <p className="max-w-sm text-[11px] leading-snug text-[#001161]/55">
                      Při chybě spojení to zkusí několikrát automaticky. Náhled se zobrazí až bude data jistota.
                    </p>
                  </>
                ) : slidesLoadState === 'error' ? (
                  <>
                    <p className="text-[13px] font-bold text-red-700">Seznam slidů se nepodařilo načíst</p>
                    <p className="max-w-sm text-[11px] leading-snug text-[#001161]/65">{slidesLoadError}</p>
                    <button
                      type="button"
                      onClick={() => void loadSlides()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#001161] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#000a4d]"
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      Zkusit znovu
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-bold text-[#001161]">Slide pod tímto ID v seznamu není</p>
                    <p className="max-w-sm text-[11px] leading-snug text-[#001161]/55">
                      Odkaz může být starý, nebo zatím neproběhlo načtení. Zkuste obnovit seznam vlevo.
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadSlides()}
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-[#001161] bg-white px-4 py-2 text-[12px] font-bold text-[#001161] hover:bg-[#001161]/5"
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      Načíst seznam znovu
                    </button>
                  </>
                )}
              </div>
            ) : null}
            <div
              className={`flex w-full min-w-0 justify-center ${blockPreviewForUrlSlide ? 'pointer-events-none opacity-[0.22]' : ''}`}
            >
              <SliderPreviewCanvas
                doc={previewDoc}
                device={device}
                highlightBlockId={canvasHoverBlock}
                products={products}
              />
            </div>
          </div>
          <p className="mt-4 shrink-0 pb-6 text-center text-[11px] text-[#001161]/45">
            Náhled odpovídá výšce hero {HERO_SLIDER_HEIGHT_PX}px na webu (včetně layoutu „text + produkty pod“). CTA v
            náhledu je neklikací — na katalogu funguje normálně.
          </p>
        </main>
      </div>
    </div>
  );
}
