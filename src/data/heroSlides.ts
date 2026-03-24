import type { CSSProperties } from 'react';

/** Pevná výška hero slideru na homepage (px) — stejně v náhledech adminu. */
export const HERO_SLIDER_HEIGHT_PX = 400;

/**
 * Layout „text + fotka vpravo“ používá `@container` na slidu. Pod touto šířkou *kontejneru* je text nahoře a fotka dole.
 * 768 px by při úzkém obsahu vedle sidebaru přepínalo příliš brzy; 520 px drží dva sloupce pro běžný desktop s postranní lištou.
 * V `CatalogGrid` se mapuje na třídy `@min-[520px]` / `@max-[519px]`.
 */
export const HERO_LEFT_IMAGE_SIDE_BY_SIDE_MIN_CONTAINER_PX = 520;

/** Který hero layout — každý má vlastní stupnici clampů. */
export type HeroHeadingPreset = 'webinar' | 'booksFan' | 'leftImage' | 'center' | 'fullImage';

/**
 * 0 = nejmenší (dlouhý nadpis), 4 = největší (krátké / jedno slovo).
 * Řídí se počtem znaků i počtem slov.
 */
export function heroHeadingLengthBucket(title: string): 0 | 1 | 2 | 3 | 4 {
  const t = (title || '').trim();
  if (!t) return 2;
  const words = t.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const len = t.length;
  if (wc <= 1 && len <= 22) return 4;
  if (wc <= 2 && len <= 36) return 3;
  if (len <= 52 && wc <= 6) return 2;
  if (len <= 92 && wc <= 14) return 1;
  return 0;
}

/** Pro `font-size` v hero nadpisu — kratší text = větší max v clamp(). */
export function heroHeadingFontSizeClamp(title: string, preset: HeroHeadingPreset): string {
  const b = heroHeadingLengthBucket(title);
  /* Bucket 2 = „default“ střed; 0–1 menší pro dlouhé titulky; 3–4 výrazně větší pro krátké. */
  const CLAMPS: Record<HeroHeadingPreset, [string, string, string, string, string]> = {
    webinar: [
      'clamp(1.58rem, 2.1vw + 0.58rem, 2.62rem)',
      'clamp(1.66rem, 2.28vw + 0.62rem, 3rem)',
      'clamp(1.78rem, 2.48vw + 0.65rem, 3.35rem)',
      'clamp(2.02rem, 2.95vw + 0.72rem, 4.15rem)',
      'clamp(2.18rem, 3.35vw + 0.8rem, 4.95rem)',
    ],
    booksFan: [
      'clamp(1.38rem, 4vw + 0.45rem, 2.62rem)',
      'clamp(1.48rem, 4.25vw + 0.5rem, 2.98rem)',
      'clamp(1.58rem, 4.4vw + 0.52rem, 3.22rem)',
      'clamp(1.78rem, 4.9vw + 0.58rem, 3.95rem)',
      'clamp(1.92rem, 5.35vw + 0.62rem, 4.65rem)',
    ],
    leftImage: [
      'clamp(1.38rem, 4.2vw + 0.42rem, 2.55rem)',
      'clamp(1.48rem, 4.5vw + 0.5rem, 2.85rem)',
      'clamp(1.55rem, 4.8vw + 0.55rem, 3.12rem)',
      'clamp(1.72rem, 5.2vw + 0.62rem, 3.88rem)',
      'clamp(1.88rem, 5.6vw + 0.68rem, 4.65rem)',
    ],
    center: [
      'clamp(1.45rem, 4.5vw + 0.55rem, 3.12rem)',
      'clamp(1.55rem, 4.85vw + 0.58rem, 3.5rem)',
      'clamp(1.65rem, 5.2vw + 0.62rem, 3.92rem)',
      'clamp(1.85rem, 5.85vw + 0.68rem, 5.15rem)',
      'clamp(2rem, 6.5vw + 0.72rem, 6.15rem)',
    ],
    /* Stejné stupnice jako center — text v „skle“ přes fullscreen fotku. */
    fullImage: [
      'clamp(1.45rem, 4.5vw + 0.55rem, 3.12rem)',
      'clamp(1.55rem, 4.85vw + 0.58rem, 3.5rem)',
      'clamp(1.65rem, 5.2vw + 0.62rem, 3.92rem)',
      'clamp(1.85rem, 5.85vw + 0.68rem, 5.15rem)',
      'clamp(2rem, 6.5vw + 0.72rem, 6.15rem)',
    ],
  };
  return CLAMPS[preset][b];
}

/** Font nadpisu CMS hero slidů (pevné slidery zůstávají u Cooper Light). */
export type HeroSlideTitleFontId = 'cooper' | 'fenomenSemiBold' | 'visbyRound' | 'vividbooksScript';

export const HERO_TITLE_FONT_OPTIONS: { value: HeroSlideTitleFontId; label: string }[] = [
  { value: 'cooper', label: 'Cooper Light (výchozí)' },
  { value: 'fenomenSemiBold', label: 'Fenomen Sans Semi Bold' },
  { value: 'visbyRound', label: 'Visby Round CF Demi Bold' },
  { value: 'vividbooksScript', label: 'Vividbooks Script One (navazující znaky)' },
];

export function normalizeHeroSlideTitleFont(raw: unknown): HeroSlideTitleFontId {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === 'fenomenSemiBold' || s === 'fenomen-semi-bold') return 'fenomenSemiBold';
  if (s === 'visbyRound' || s === 'visby-round') return 'visbyRound';
  if (s === 'vividbooksScript' || s === 'vividbooks-script') return 'vividbooksScript';
  return 'cooper';
}

/** CSS vlastnosti pro `<h1>` hero nadpisu (bez font-size — ten řeší adaptive clamp). */
export function heroTitleFontCss(id: HeroSlideTitleFontId): {
  fontFamily: string;
  fontWeight?: number;
  fontFeatureSettings?: string;
  fontVariantLigatures?: string;
} {
  switch (id) {
    case 'fenomenSemiBold':
      return { fontFamily: "'Fenomen Sans', sans-serif", fontWeight: 600 };
    case 'visbyRound':
      /* Když Visby není v bucketu ani v /fonts/, alespoň Fenomen Semi Bold (licenční náhrada). */
      return { fontFamily: "'Visby Round CF', 'Fenomen Sans', sans-serif", fontWeight: 600 };
    case 'vividbooksScript':
      return {
        fontFamily: "'Vividbooks Script One', 'Cooper Light', cursive",
        fontWeight: 400,
        /* Kontextové alternativy + ligatury = „alternativní navazování“ u skriptu */
        fontFeatureSettings: '"calt" 1, "liga" 1, "clig" 1',
        fontVariantLigatures: 'common-ligatures contextual',
      };
    default:
      return { fontFamily: "'Cooper Light', serif", fontWeight: 300 };
  }
}

/** U skriptu nechat větší mezery mezi glyfy — jinak „usekává“ navazování. */
export function heroTitleFontUseTightTracking(id: HeroSlideTitleFontId): boolean {
  return id !== 'vividbooksScript';
}

/** Tailwind třídy pro hlavní `<h1>` hero slidu (tracking podle fontu). */
export function heroMainHeadingClassName(slide: { titleFont?: unknown }, base: string): string {
  const tf = normalizeHeroSlideTitleFont(slide.titleFont);
  const track = heroTitleFontUseTightTracking(tf) ? 'tracking-tight' : 'tracking-normal';
  return `${base} ${track}`;
}

/** `fontSize` (clamp) + rodina fontu pro hero nadpis. */
/** Nadpis u layoutu „text na střed + produkty pod“ — 30 % menší než běžný center. */
export const HERO_CENTER_BELOW_TITLE_SCALE = 0.7;

export function heroMainHeadingStyle(
  slide: { title?: string; titleFont?: unknown },
  preset: HeroHeadingPreset,
  /** Násobek clamp() velikosti (např. 0.7 pro menší nadpis u produktů pod). */
  fontScale = 1,
): CSSProperties {
  const tf = normalizeHeroSlideTitleFont(slide.titleFont);
  const clampStr = heroHeadingFontSizeClamp(slide.title || '', preset);
  const fontSize =
    fontScale !== 1 && Number.isFinite(fontScale) && fontScale > 0
      ? `calc(${fontScale} * (${clampStr}))`
      : clampStr;
  return {
    fontSize,
    ...heroTitleFontCss(tf),
  };
}

/** Odkaz pro CTA: vlastní `ctaLink`, jinak záložně `link` slidu. */
export function resolveHeroSlideCtaHref(slide: { ctaLink?: unknown; link?: unknown }): string {
  const a = typeof slide.ctaLink === 'string' ? slide.ctaLink.trim() : '';
  if (a) return a;
  const b = typeof slide.link === 'string' ? slide.link.trim() : '';
  return b;
}

/** Zobrazit CTA jen když je text tlačítka a cílová URL. */
export function heroSlideShouldShowCta(slide: { ctaLabel?: unknown; ctaLink?: unknown; link?: unknown }): boolean {
  const label = typeof slide.ctaLabel === 'string' ? slide.ctaLabel.trim() : '';
  if (!label) return false;
  return Boolean(resolveHeroSlideCtaHref(slide));
}

/** ID produktů pro layout „obálky“ — JSON pole, nebo řetězec oddělený čárkou / mezerou / středníkem. */
export function parseHeroBookProductIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j)) return j.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      /* fall through */
    }
    return t.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Šedý placeholder pro hero mřížku, když produkt nemá nahranou obálku (data URL = žádný HTTP request).
 */
export const HERO_FAN_BOOK_PLACEHOLDER_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="232" viewBox="0 0 164 232"><rect fill="#E2E5ED" width="164" height="232" rx="6"/><rect x="52" y="58" width="60" height="78" rx="3" fill="#C5CAD8"/><path fill="#A8B0C2" d="M52 58h60v78H52z" opacity=".35"/><text x="82" y="168" text-anchor="middle" fill="#8B92A8" font-size="10" font-family="system-ui,sans-serif">bez obálky</text></svg>`,
  );

/**
 * Text bílé bubliny nad obálkou ve fan layoutu — jen z názvu produktu.
 * Dříve se brala první číslice v názvu a vždy se dopisovalo „ročník“, což u „1. díl“ / „3. díl“ dávalo špatně „3. ročník“.
 */
export function heroFanCoverBobanekLabel(productName: string): string | null {
  const n = (productName || '').trim();
  if (!n) return null;
  const rocnik =
    n.match(/(\d+)\s*\.\s*ro[cč](?:n[ií]k)?/i) ||
    n.match(/\bro[cč]n[ií]k\s*[:\s]?\s*(\d+)/i) ||
    n.match(/(\d+)\s*\.\s*rocnik/i);
  if (rocnik) {
    const num = rocnik[1];
    return `${num}. ro\u010dn\u00edk`;
  }
  const dil = n.match(/(\d+)\s*\.\s*d[ií]l/i);
  if (dil) return `${dil[1]}. d\u00edl`;
  return null;
}

/** Obálky v pořadí podle `ids`; chybějící obrázek = placeholder (titul se na slidu zobrazí). */
export function resolveHeroFanBooks(
  products: { id: string; name?: string; image?: string }[],
  ids: string[],
): { id: string; name: string; image: string }[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: { id: string; name: string; image: string }[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    const img = p.image?.trim();
    out.push({
      id: p.id,
      name: p.name || '',
      image: img || HERO_FAN_BOOK_PLACEHOLDER_IMAGE,
    });
  }
  return out;
}

/** Náklon nadpisu: celý řádek / každé slovo jinak / oblouk (vějíř) / vypnuto. */
export type HeroTitleTiltMode = 'none' | 'uniform' | 'playful' | 'fan';

/** Z pole CMS + zpětná kompatibilita (jen `titleTiltDeg` ≠ 0 → uniform). */
export function normalizeHeroTitleTiltMode(raw: unknown, titleTiltDeg?: unknown): HeroTitleTiltMode {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'playful') return 'playful';
  if (s === 'fan' || s === 'vejir' || s === 'vějíř') return 'fan';
  if (s === 'uniform') return 'uniform';
  if (s === 'none') return 'none';
  const n = typeof titleTiltDeg === 'number' ? titleTiltDeg : Number(String(titleTiltDeg ?? '').replace(',', '.'));
  if (Number.isFinite(n) && n !== 0) return 'uniform';
  return 'none';
}

/** Seed pro „hravý“ náklon / vějíř — změna = jiné náhodné úhly (tlačítko Znovu). */
export function normalizeTitlePlayfulSeed(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw) >>> 0;
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.trim().replace(/\s/g, ''));
    if (Number.isFinite(n)) return Math.floor(n) >>> 0;
  }
  return 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lehké natočení obálky v mřížce hero (−maxDeg…maxDeg °).
 * Deterministické: stejné ID + pořadí + seed = stejný úhel po reloadu.
 * `seed` typicky `titlePlayfulSeed` slidu — tlačítko „Znovu“ v editoru mění rozložení.
 */
export function heroBooksGridCoverRotationDeg(
  bookId: string,
  tileIndex: number,
  seed: number,
  maxDeg = 8,
): number {
  let h = normalizeTitlePlayfulSeed(seed);
  for (let i = 0; i < bookId.length; i++) {
    h = (Math.imul(h ^ bookId.charCodeAt(i), 0x7feb352d) + 0x682f0161) >>> 0;
  }
  h = (h ^ (tileIndex + 1) * 0x9e3779b9) >>> 0;
  const rnd = mulberry32(h || 1);
  const u = rnd();
  return Math.round((u * 2 - 1) * maxDeg * 10) / 10;
}

const PLAYFUL_WORD_ROTATIONS_BASE = [-3.5, 3.2, -4.2, 2.6, -2.9, 4, -3.3, 2.2];

/** Fisher–Yates podle seedu — pro „hravý“ režim. */
export function heroShuffledPlayfulRotations(seed: number): number[] {
  const arr = [...PLAYFUL_WORD_ROTATIONS_BASE];
  const rnd = mulberry32(normalizeTitlePlayfulSeed(seed) || 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Úhel jednoho slova v „hravém“ režimu (seed + index). */
export function heroPlayfulWordDeg(seed: number, wordIndex: number): number {
  const shuffled = heroShuffledPlayfulRotations(seed);
  const base = shuffled[wordIndex % shuffled.length];
  const rnd = mulberry32((normalizeTitlePlayfulSeed(seed) ^ 0x9e3779b9) + wordIndex * 0x517cc1b7);
  const jitter = (rnd() - 0.5) * 3.8;
  return Math.max(-8, Math.min(8, base + jitter));
}

/** Počet „slov“ v nadpisu (včetně zalomení řádků jako oddělovače). */
export function heroTitleWordCount(title: string): number {
  const t = (title || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Transformace slova ve vějíři (horní oblouk). */
export function heroFanWordStyle(wordIndex: number, totalWords: number, seed: number): CSSProperties {
  const n = Math.max(1, totalWords);
  const t = n <= 1 ? 0.5 : wordIndex / (n - 1);
  const s = normalizeTitlePlayfulSeed(seed);
  const riseAmpEm = 0.3 + (s % 11) * 0.014 - 0.07;
  const maxRot = 10 + (s % 7);
  const yEm = -riseAmpEm * Math.sin(Math.PI * t);
  const rotDeg = (t - 0.5) * 2 * maxRot;
  const r = mulberry32(((s >>> 0) + wordIndex * 9973) >>> 0);
  const micro = (r() - 0.5) * 0.6;
  return {
    transform: `translateY(${yEm.toFixed(3)}em) rotate(${(rotDeg + micro).toFixed(2)}deg)`,
    transformOrigin: '50% 100%',
  };
}

/** HEX pozadí slidu z `bgStyle` nebo z třídy `bg-[#rrggbb]`. */
export function heroSurfaceHexFromSlide(slide: { bg?: string; bgStyle?: string }): string {
  const s = typeof slide.bgStyle === 'string' ? slide.bgStyle.trim() : '';
  if (s.startsWith('#') && s.length >= 4) return s.slice(0, 7);
  const m = typeof slide.bg === 'string' ? slide.bg.match(/#[0-9a-fA-F]{6}/i) : null;
  return m ? m[0] : '#e8d5f2';
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3 && /^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Drop-shadow vrstvy pro obálky v hero (bez zaoblení) — tón stínu se míchá s barvou pozadí slidu,
 * podobně jako digitální tituly na homepage (UnifiedBookCard).
 */
function heroCoverShadowRgb(bgHex: string) {
  const rgb = parseHexRgb(bgHex) ?? parseHexRgb('#e8d5f2')!;
  return {
    r: Math.round(rgb.r * 0.38 + 0 * 0.62),
    g: Math.round(rgb.g * 0.38 + 17 * 0.62),
    b: Math.round(rgb.b * 0.38 + 97 * 0.62),
  };
}

export function heroBookCoverShadowFilter(bgHex: string): string {
  const { r, g, b } = heroCoverShadowRgb(bgHex);
  return [
    `drop-shadow(1px 2px 3px rgba(${r},${g},${b},0.38))`,
    `drop-shadow(3px 9px 14px rgba(${r},${g},${b},0.28))`,
    `drop-shadow(5px 20px 32px rgba(${r},${g},${b},0.17))`,
  ].join(' ');
}

/** Pozadí pill v nadpisu (stejné na webu i v náhledu editoru). Bez alfa / transparent — plně krycí výplň. */
export function heroPillHighlightStyle(
  pillHex?: string,
  textAccentHex?: string,
  /** Barva textu uvnitř pill; prázdná = dědí z nadpisu (barva textu slidu). */
  pillTextHex?: string,
): CSSProperties {
  const base: CSSProperties = {
    borderRadius: '0.42em',
    padding: '0.14em 0.38em',
    margin: '0 0.04em',
    display: 'inline-block',
    lineHeight: 1.28,
    overflow: 'visible',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
  let withBg: CSSProperties;
  if (pillHex?.startsWith('#')) {
    withBg = { ...base, backgroundColor: pillHex };
  } else if (textAccentHex?.startsWith('#')) {
    withBg = {
      ...base,
      backgroundColor: `color-mix(in srgb, ${textAccentHex} 32%, white)`,
    };
  } else {
    withBg = {
      ...base,
      backgroundColor: 'color-mix(in srgb, currentColor 22%, white)',
    };
  }
  if (pillTextHex?.startsWith('#')) {
    return { ...withBg, color: pillTextHex };
  }
  return withBg;
}

/** Šířka sloupce s obrázkem u hero layoutu „vlevo text + vpravo obrázek“ (procenta řádku). */
export function clampHeroImageColumnPercent(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 38;
  return Math.min(55, Math.max(28, Math.round(x)));
}

/** Přiblížení fotky v hero „text + obrázek“ (100–200 % = větší výřez / ořez). */
export function clampHeroImageScalePct(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 100;
  return Math.min(200, Math.max(100, Math.round(x)));
}

/** Horizontální / vertikální zaostření ořezu (0–100 % → object-position). */
export function clampHeroImagePosPct(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 50;
  return Math.min(100, Math.max(0, Math.round(x)));
}

/**
 * Styl `<img>` u layoutu left-image: cover + posuv + volitelné přiblížení (scale od středu výřezu).
 */
export function heroLeftImageImgStyle(
  scalePctRaw: unknown,
  posXRaw: unknown,
  posYRaw: unknown,
): CSSProperties {
  const scalePct = clampHeroImageScalePct(scalePctRaw);
  const px = clampHeroImagePosPct(posXRaw);
  const py = clampHeroImagePosPct(posYRaw);
  const s = scalePct / 100;
  return {
    objectFit: 'cover',
    objectPosition: `${px}% ${py}%`,
    ...(s > 1.001
      ? {
          transform: `scale(${s})`,
          transformOrigin: `${px}% ${py}%`,
        }
      : {}),
  };
}

/** Sloupec s obálkami u layoutu books-fan — stejné meze jako u fotky (28–55 %), výchozí 48 %. */
export function clampHeroBooksFanColumnPercent(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 48;
  return Math.min(55, Math.max(28, Math.round(x)));
}

/** Svislá mezera mezi bloky hero (nadpis, podnadpis, …) v px. */
export function clampHeroBlockGapPx(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 12;
  return Math.min(56, Math.max(0, Math.round(x)));
}

/**
 * Řádkový proklad hlavního nadpisu hero — hodnota v % oproti 1.0 (např. 108 → line-height 1.08).
 * Odpovídá dřívějšímu `leading-[1.08]` na webu.
 */
export function clampHeroTitleLineHeightPct(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 108;
  return Math.min(155, Math.max(92, Math.round(x)));
}

/**
 * Relativní měřítko velikosti nadpisu v % — násobí stávající responzivní clamp() (délka textu / preset).
 * 100 % = výchozí; menší = jemně menší nadpis, větší = větší. Jen orientační posuv celé stupnice.
 */
export function clampHeroTitleSizePct(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 100;
  return Math.min(135, Math.max(65, Math.round(x)));
}

/** HEX podbarvení karet u layoutu `hero-full-image` (#RRGGBB). */
export function normalizeHeroFullImageCardBgHex(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  return '#ffffff';
}

/** Neprůhlednost podbarvení karet (0–100 %). */
export function clampHeroFullImageCardOpacityPct(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 88;
  return Math.min(100, Math.max(0, Math.round(x)));
}

/** Rozmazání pozadí za kartami (0 = vypnuto, max 24 px). */
export function clampHeroFullImageCardBlurPx(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 12;
  return Math.min(24, Math.max(0, Math.round(x)));
}

/** Pozadí + volitelný backdrop-blur pro karty přes fullscreen fotku (bez okraje a stínu). */
export function heroFullImageCardSurfaceStyle(
  bgHexRaw: unknown,
  opacityPctRaw: unknown,
  blurPxRaw: unknown,
): CSSProperties {
  const hex = normalizeHeroFullImageCardBgHex(bgHexRaw);
  const opacity = clampHeroFullImageCardOpacityPct(opacityPctRaw) / 100;
  const blur = clampHeroFullImageCardBlurPx(blurPxRaw);
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const style: CSSProperties = {
    backgroundColor: `rgba(${r},${g},${b},${opacity})`,
  };
  if (blur > 0) {
    const f = `blur(${blur}px)`;
    style.backdropFilter = f;
    (style as Record<string, string>)['WebkitBackdropFilter'] = f;
  }
  return style;
}

/** Rozložení obálek u layoutu „text + produkty“ (books-fan). */
export type HeroBooksFanArrangement = 'grid' | 'row' | 'fan';

export function normalizeHeroBooksFanArrangement(raw: unknown): HeroBooksFanArrangement {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'row' || s === 'rada' || s === 'řada') return 'row';
  if (s === 'fan' || s === 'vejir' || s === 'vějíř' || s === 'vejír') return 'fan';
  if (s === 'grid' || s === 'mrizka' || s === 'mřížka') return 'grid';
  return 'grid';
}

/** Mezery mezi obálkami (px); záporné = překryv. */
export function clampHeroBooksFanGapPx(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 10;
  return Math.min(48, Math.max(-48, Math.round(x)));
}

/** Velikost obálek v % základního rozměru (55–300). */
export function clampHeroBooksFanScalePct(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 100;
  return Math.min(300, Math.max(55, Math.round(x)));
}

/**
 * Layout „text + obálky pod“: zrcadlí osu Y koláže (`booksFanCollageOffsetYPx`) kvůli zpětné kompatibilitě v CMS.
 * Kladné = nahoru k textu. Rozsah −200…200 (dříve −100…120).
 */
export function clampHeroBooksFanBelowLiftPx(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 0;
  return Math.min(200, Math.max(-200, Math.round(x)));
}

/** Posun koláže obálek v ose X (px), layouty books-fan / books-fan-below / books-fan-above. */
export function clampHeroBooksFanCollageOffsetXPx(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 0;
  return Math.min(200, Math.max(-200, Math.round(x)));
}

/**
 * Posun koláže v ose Y (px). Kladné = nahoru (translateY záporně).
 * U „obálky pod“ se ukládá i do `booksFanBelowLiftPx` pro starší záznamy.
 */
export function clampHeroBooksFanCollageOffsetYPx(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 0;
  return Math.min(200, Math.max(-200, Math.round(x)));
}

/**
 * Layout „text + obálky pod“: minimální podíl výšky hero pro řadu obálek (28–70 %), stejné meze jako šířka sloupce u fotky.
 */
export function clampHeroBooksFanBelowShelfPercent(raw: unknown): number {
  const x = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(x)) return 48;
  return Math.min(70, Math.max(28, Math.round(x)));
}

/**
 * `grid-template-rows` pro layout „text + obálky pod“ (editor i katalog).
 * `firstRow: 'auto'` = text bez vnitřního stlačení (náhled editoru — celý obsah bez scrollu v buňce).
 */
export function heroBooksFanBelowGridTemplateRows(
  shelfPercent: unknown,
  opts?: { firstRow?: 'fr' | 'auto' },
): string {
  const pct = clampHeroBooksFanBelowShelfPercent(shelfPercent);
  const usableH = HERO_SLIDER_HEIGHT_PX - 24;
  const minPx = Math.max(72, Math.round((usableH * pct) / 100));
  const first = opts?.firstRow === 'auto' ? 'auto' : 'minmax(0, 1fr)';
  return `${first} minmax(${minPx}px, max-content)`;
}

/**
 * Min. výška pásu s obálkami u layoutu „text + obálky pod“ (px) — odvozeno od % výšky hero.
 * Používá se u překryvného layoutu (koláž `absolute` od spodku), ekvivalent dřívějšího druhého řádku gridu.
 */
export function heroBooksFanBelowShelfMinPx(shelfPercent: unknown): number {
  const pct = clampHeroBooksFanBelowShelfPercent(shelfPercent);
  const usableH = HERO_SLIDER_HEIGHT_PX - 24;
  return Math.max(72, Math.round((usableH * pct) / 100));
}

/**
 * Horní „vzduch“ uvnitř stacku layoutu „obálky pod“ — při kladném posunu Y a drop-stínu z `filter` na img
 * jinak rodič s `overflow:hidden` stín usekne.
 */
export function heroBooksFanBelowCollageTopBleedPx(offsetYPx: unknown): number {
  const oy = Math.max(0, clampHeroBooksFanCollageOffsetYPx(offsetYPx));
  /* Větší základní rezerva kvůli drop-shadow z `filter` na img; horní strop kvůli výšce hero. */
  return Math.min(120, 22 + Math.round(oy * 0.55));
}

/** Která obálka ve vějíři je „nahoře“ (vyšší z-index). */
export type HeroBooksFanZOrder = 'middle' | 'left' | 'right';

export function normalizeHeroBooksFanZOrder(raw: unknown): HeroBooksFanZOrder {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'right' || s === 'prave' || s === 'pravé' || s === 'pravy') return 'right';
  if (s === 'left' || s === 'leve' || s === 'levé' || s === 'levy') return 'left';
  if (
    s === 'middle' ||
    s === 'center' ||
    s === 'stred' ||
    s === 'střed' ||
    s === 'horni' ||
    s === 'horní' ||
    s === 'prostredni' ||
    s === 'prostřední'
  ) {
    return 'middle';
  }
  return 'middle';
}

/** z-index pro dlaždici vějíře (bi = 0…total-1). */
export function heroBooksFanZIndexForFan(bi: number, total: number, order: HeroBooksFanZOrder): number {
  const mid = (total - 1) / 2;
  const d = bi - mid;
  switch (order) {
    case 'right':
      return 10 + bi;
    case 'left':
      return 10 + (total - 1 - bi);
    case 'middle':
    default:
      return 30 - Math.abs(Math.round(d));
  }
}

/** Sloučení a ořez intervalů podtržení v nadpisu (0…len). */
export function mergeHeroUnderlineRanges(titleLen: number, ranges: [number, number][] | undefined): [number, number][] {
  if (!titleLen || !ranges?.length) return [];
  const sorted = [...ranges]
    .map(([a, b]) => {
      const x = Math.max(0, Math.min(Number(a), Number(b)));
      const y = Math.min(titleLen, Math.max(Number(a), Number(b)));
      return [x, y] as [number, number];
    })
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    if (!out.length || a > out[out.length - 1][1]) out.push([a, b]);
    else out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
  }
  return out;
}

/** Parsování `titleUnderlines` z CMS / editoru. */
export function parseHeroTitleUnderlines(raw: unknown): [number, number][] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const pairs: [number, number][] = [];
    for (const row of raw) {
      if (Array.isArray(row) && row.length >= 2) {
        const a = Number(row[0]);
        const b = Number(row[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
      }
    }
    return pairs;
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t) as unknown;
      return parseHeroTitleUnderlines(j);
    } catch {
      return [];
    }
  }
  return [];
}

/** Bloky textového sloupce hero (CMS / vizuální editor). */
export const HERO_CONTENT_BLOCK_IDS = ['title', 'subtitle', 'badges', 'bottom', 'cta'] as const;
export type HeroContentBlockId = (typeof HERO_CONTENT_BLOCK_IDS)[number];

export const DEFAULT_HERO_BLOCK_ORDER: HeroContentBlockId[] = [...HERO_CONTENT_BLOCK_IDS];

export const DEFAULT_HERO_BLOCK_VISIBILITY: Record<HeroContentBlockId, boolean> = {
  title: true,
  subtitle: true,
  badges: true,
  bottom: true,
  cta: true,
};

const BLOCK_SET = new Set<string>(HERO_CONTENT_BLOCK_IDS);

/** Normalizace pořadí bloků z CMS (pole nebo JSON řetězec). */
export function normalizeHeroBlockOrder(raw: unknown): HeroContentBlockId[] {
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw.map(String);
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) arr = j.map(String);
    } catch {
      /* ignore */
    }
  }
  const picked = arr.filter((id): id is HeroContentBlockId => BLOCK_SET.has(id));
  const seen = new Set<string>();
  const out = picked.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  for (const id of HERO_CONTENT_BLOCK_IDS) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}

/** Viditelnost jednotlivých bloků. */
export function normalizeHeroBlockVisibility(raw: unknown): Record<HeroContentBlockId, boolean> {
  const v: Record<HeroContentBlockId, boolean> = { ...DEFAULT_HERO_BLOCK_VISIBILITY };
  let obj: Record<string, unknown> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) obj = raw as Record<string, unknown>;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (j && typeof j === 'object' && !Array.isArray(j)) obj = j as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  for (const id of HERO_CONTENT_BLOCK_IDS) {
    if (id in obj) v[id] = Boolean(obj[id]);
  }
  return v;
}

export interface HeroSlide {
  id: string;
  bg: string;
  title: string;
  subtitle: string;
  badges: string[];
  bottom: string;
  order: number;
  isActive: boolean;
  /** Font hlavního nadpisu (CMS). */
  titleFont?: HeroSlideTitleFontId;
  layout?: 'center' | 'left-image' | 'hero-full-image' | 'books-fan' | 'books-fan-below' | 'books-fan-above';
  /** Jen layout `books-fan`: ID produktů (pole nebo JSON v textarea z CMS). */
  bookProductIds?: string | string[];
  /** Rozložení obálek: mřížka / řada / vějíř. */
  booksFanArrangement?: string;
  /** Mezery mezi obálkami (px), může být záporné (překryv). */
  booksFanGapPx?: number;
  /** Velikost obálek v % základu (55–300). */
  booksFanScalePct?: number;
  /** Šířka pravého sloupce s obálkami (28–55 % řádku, výchozí 48), jako podíl fotky u layoutu vlevo. */
  booksFanColumnPercent?: number;
  /** U vějíře: která strana / střed má být navrchu. */
  booksFanZOrder?: string;
  /** Jen `books-fan-below` / `books-fan-above`: posun řady obálek v ose Y (px), zrcadlí `booksFanCollageOffsetYPx`. */
  booksFanBelowLiftPx?: number;
  /** Posun koláže obálek v ose X (px). */
  booksFanCollageOffsetXPx?: number;
  /** Posun koláže obálek v ose Y (px); kladné = nahoru. */
  booksFanCollageOffsetYPx?: number;
  /** Jen `books-fan-below` / `books-fan-above`: min. výška pásu s obálkami v % výšky hero (28–70). */
  booksFanBelowShelfPercent?: number;
  image?: string;
  /** Obrázek u layoutu vlevo sahá k pravému a svislému okraji barevné plochy slidu (bez vnitřního odsazení). */
  imageEdgeToEdge?: boolean;
  /** Šířka sloupce s obrázkem u layoutu vlevo (28–55 % řádku, výchozí 38). */
  imageColumnPercent?: number;
  /** U `left-image` / `hero-full-image` / layoutů s obálkami (`books-fan*`): text vlevo vs na střed v textové zóně. */
  heroImageColumnAlign?: 'start' | 'center';
  /** Přiblížení fotky 100–200 % (object-cover + scale). */
  heroImageScalePct?: number;
  /** Pozice ořezu fotky 0–100 % (osa X). */
  heroImagePosXPct?: number;
  /** Pozice ořezu fotky 0–100 % (osa Y). */
  heroImagePosYPct?: number;
  /** Text tlačítka CTA pod spodním textem (volitelné). */
  ctaLabel?: string;
  /** URL tlačítka CTA; pokud prázdné, použije se `link` slidu. */
  ctaLink?: string;
  /** Kliknutí na celý slide (interní cesta nebo URL). */
  link?: string;
  distributorTitle?: string;
  distributorBg?: string;
  distributorBottom?: string;
  /** Barva textu slidu (HEX), volitelně z vizuálního editoru. */
  heroTextColor?: string;
  /** U layoutu „center“: `start` = text vlevo (bez fotky). */
  heroTextAlign?: 'center' | 'start';
  /** Režim náklonu nadpisu (CMS / vizuální editor). */
  titleTiltMode?: string;
  /** Natočení celého nadpisu ve stupních — jen při `titleTiltMode` = uniform nebo bez módu a nenulový úhel. */
  titleTiltDeg?: number;
  /** JSON nebo pole intervalů [začátek, konec] pro podtržení části nadpisu. */
  titleUnderlines?: string | [number, number][];
  /** Volitelná barva pozadí „pill“ zvýraznění v nadpisu (HEX). Prázdné = odvodit z barvy textu. */
  titlePillHighlightColor?: string;
  /** Volitelná barva textu uvnitř pill (HEX). Prázdné = stejná jako barva nadpisu / textu slidu. */
  titlePillHighlightTextColor?: string;
  /** Seed pro náhodné úhly u „hravého“ náklonu / jemnou variaci vějíře (vizuální editor „Znovu“). */
  titlePlayfulSeed?: number;
  /** JSON pole pořadí bloků: title | subtitle | badges | bottom | cta */
  heroBlockOrder?: string | HeroContentBlockId[];
  /** JSON objekt viditelnosti bloků na slidu. */
  heroBlockVisibility?: string | Partial<Record<HeroContentBlockId, boolean>>;
  /** Mezera mezi textovými bloky hero (px), výchozí 12. */
  heroBlockGapPx?: number;
  /** Řádkový proklad nadpisu (92–155 → line-height 0.92–1.55), výchozí 108. */
  heroTitleLineHeightPct?: number;
  /** Velikost nadpisu v % základu (65–135, výchozí 100) — násobí responzivní clamp, zachová chování podle šířky. */
  heroTitleSizePct?: number;
  /** Layout `hero-full-image`: barva podbarvení karet (#RRGGBB). */
  heroFullImageCardBgHex?: string;
  /** Neprůhlednost podbarvení karet 0–100 % (výchozí 88). */
  heroFullImageCardOpacityPct?: number;
  /** Rozmazání pozadí za kartami v px, 0 = vypnuto (výchozí 12). */
  heroFullImageCardBlurPx?: number;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-1',
    bg: '#feb08a',
    title: 'Katalog',
    subtitle: 'Pracovn\u00edch se\u0161it\u016f a u\u010debnic pro \u0161koln\u00ed rok 2026/2027',
    badges: ['Dolo\u017eky M\u0160MT', 'Podle RVP'],
    bottom: 'D\u011bkujeme \u017ee s n\u00e1mi u\u010d\u00edte!',
    order: 1,
    isActive: true,
    layout: 'center',
    distributorTitle: 'Katalog pro distributory',
    distributorBg: '#dee4f1',
    distributorBottom: 'D\u011bkujeme za spolupr\u00e1ci!',
  },
  {
    id: 'slide-2',
    bg: '#f9c97c',
    title: 'Digit\u00e1ln\u00ed u\u010debnice',
    subtitle: 'Interaktivn\u00ed tabule, tablety a online procvi\u010dov\u00e1n\u00ed pro ka\u017ed\u00fd p\u0159edm\u011bt',
    badges: ['1. i 2. stupe\u0148', 'Vividboard'],
    bottom: 'V\u00fduka, kter\u00e1 bav\u00ed!',
    order: 2,
    isActive: true,
    layout: 'left-image',
    image: 'https://images.unsplash.com/photo-1771054244019-96f9db9720b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnRlcmFjdGl2ZSUyMGRpZ2l0YWwlMjB0ZXh0Ym9vayUyMGNsYXNzcm9vbSUyMHRhYmxldHxlbnwxfHx8fDE3NzIzNzk0Mzh8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    id: 'slide-3',
    bg: '#b8d4f5',
    title: 'Pracovn\u00ed se\u0161ity',
    subtitle: 'P\u0159ehledn\u00e9, modern\u00ed a schv\u00e1len\u00e9 M\u0160MT \u2014 pro 1. i 2. stupe\u0148 Z\u0160',
    badges: ['ISBN certifikace', 'Ov\u011b\u0159eno u\u010diteli'],
    bottom: 'Modern\u00ed vzd\u011bl\u00e1v\u00e1n\u00ed s Vividbooks.',
    order: 3,
    isActive: true,
  },
  {
    id: 'slide-4',
    bg: '#c9e6c8',
    title: '\u0160koln\u00ed rok 2026/27',
    subtitle: 'Nov\u00e9 tituly, roz\u0161\u00ed\u0159en\u00e1 \u0159ada Matematika 2. stup\u0148e a P\u0159\u00edrodopis',
    badges: ['Novinky', 'Aktu\u00e1ln\u00ed RVP'],
    bottom: 'Objednejte v\u010das!',
    order: 4,
    isActive: true,
  },
];