import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { Check, X } from 'lucide-react';
import { SEOHead, faqJsonLd } from './SEOHead';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { ProductComplianceBadge } from './ProductComplianceBadge';
import { UnifiedBookCard } from './UnifiedBookCard';
import { SubjectTabsSection, type SubjectExtraTab } from './SubjectTabsSection';
import { TrialRegistrationForm } from './TrialPage';
import { YouTubePlaylistSlider } from './YouTubePlaylistSlider';
import { getProductImage } from './cartUpsellUtils';
import { useProducts } from '../contexts/ProductsContext';
import { productDetailPath } from '../utils/slugify';
import { SUBJECT_CONFIGS } from './subjectConfigs';
import { MATEMATIKA_2_STUPEN_PRINCIPLES } from '../data/subjectMethodPrinciples';
import {
  MATH_METHODOLOGY_PLAYLIST_URL,
  MATH_METHODOLOGY_PLAYLIST_VIDEOS,
} from '../data/mathMethodologyYoutubePlaylist';
import { MATH_CAMPAIGN_WEBINAR_VIDEOS } from '../data/mathCampaignWebinarVideos';
import logoPaths from '../imports/svg-fupfguvmdt';

const FF = "'Fenomen Sans', sans-serif";
const COOPER = "'Cooper Light', serif";
/** Jemný stín jen na obálce — bez velkého rozmazaného „koberce“ pod řadou. */
const HERO_BOOK_COVER_SHADOW = 'drop-shadow(0 2px 5px rgba(0, 17, 97, 0.1))';
const HERO_COVER_SIZE = { w: 146, h: 221 } as const;
const HERO_COVER_GAP = 6;
const HERO_CAROUSEL_HEIGHT = 'h-[325px] md:h-[348px]';
/** Jemné pastelové pozadí hero bloku podle ročníku obálky (Pro všechny). */
const HERO_BG_BY_GRADE: Record<number, string> = {
  6: '#EDE4F7',
  7: '#DDEEFF',
  8: '#FFF0E3',
  9: '#E8F6EE',
};
const MATH_SERIES_DIFF_YOUTUBE_ID = '3QfBy-xJ4Os';
const YOUTUBE_PLAYLIST = MATH_METHODOLOGY_PLAYLIST_URL;

/** Vynechané záložky ekosystému na kampani (obsah sešitů je níže v #sesity). */
const MATH2_ECOSYSTEM_EXCLUDED_TABS = ['Pracovní sešity'];

const MATH2_ECOSYSTEM_HEADING = {
  title: 'Učebnice jako ekosystém.',
  body: 'K pracovním sešitům máte zdarma komplexní digitální přístup pro celou školu, vše co učitelé a žáci potřebují v jedné aplikaci.',
};

const SYPO_ALGEBRA_TILES_LECTURE_URL =
  'https://www.projektsypo.cz/webinare/kabinet-matematika-a-jeji-aplikace.html';

const MATH2_ECOSYSTEM_EXTRA_TABS: SubjectExtraTab[] = [
  {
    id: 'campaign-app-3d-objekty',
    tabText: 'Aplikace 3D objekty',
    contentHeadline: 'Aplikace 3D objekty',
    contentRichText:
      'Nová aplikace 3D objekty umožňuje žákům interaktivně prohlížet, otáčet a přibližovat trojrozměrné modely včetně jejich rozvinutých sítí. Nástroj výrazně usnadňuje pochopení prostorových vztahů a umí automaticky generovat cvičení na výpočty povrchů a objemů. Vše je intuitivní a plně optimalizované pro interaktivní tabule i tablety.',
    bgColor: '#ffffff',
    order: 8,
  },
  {
    id: 'campaign-app-algebraicke-dlazdice',
    tabText: 'Aplikace Algebraické dlaždice',
    contentHeadline: 'Aplikace Algebraické dlaždice',
    contentRichText:
      'Digitální aplikace Algebraické dlaždice převádí abstraktní matematické výrazy a rovnice do názorné geometrické podoby. Žáci mohou na obrazovce skládat a eliminovat kladné i záporné tvary, což jim pomáhá přirozeně pochopit zjednodušování výrazů, rozklady na součin nebo řešení rovnic. Nástroj nahrazuje memorování pravidel smysluplnou manipulativní hrou.\n\nDoporučujeme přednášku profesorky Naďy Vondrové z projektu SYPO: Algebraické dlaždice jako cesta k pochopení úprav algebraických výrazů.',
    contentLinkUrl: SYPO_ALGEBRA_TILES_LECTURE_URL,
    contentLinkLabel: 'Pustit přednášku →',
    bgColor: '#ffffff',
    order: 9,
  },
  {
    id: 'campaign-app-zlomky',
    tabText: 'Aplikace Zlomky',
    contentHeadline: 'Aplikace Zlomky',
    contentRichText:
      'Digitální aplikace Zlomky pomáhá žákům budovat skutečné porozumění matematice pomocí interaktivních vizualizací. Nástroj umožňuje zlomky názorně zobrazovat, porovnávat, rozšiřovat a procvičovat formou jednoduchých aktivit. Je ideální pro vizuální podporu výuky a pomáhá žákům bezpečně zvládnout jinak abstraktní koncepty.',
    bgColor: '#ffffff',
    order: 10,
  },
];

const RVP_BLOCKS = [
  {
    title: 'Algebra a pravidelnosti',
    items: [
      'Pravidelnosti v číselných řadách a jejich algebraický zápis',
      'Nerovnice se znázorněním na číselné ose',
      'Grafické řešení rovnic průsečíkem dvou funkcí',
      'Nepřímá úměrnost a kvadratická funkce y = ax²',
      'Hyperbola a parabola: rozpoznání grafu a předpisu',
    ],
  },
  {
    title: 'Geometrie',
    items: [
      'Posunutí a otočení v kartézské soustavě souřadnic',
      'Otočení o 90° a 180°',
      'Půdorys, nárys a bokorys mnohostěnů',
      'Řezy těles a prostorová představivost',
      'Objem nekolmého hranolu a převody jednotek času',
    ],
  },
  {
    title: 'Statistika a pravděpodobnost',
    badge: 'největší nárůst v RVP',
    items: [
      'Intuitivní kombinatorika a pravděpodobnost',
      'Zápis pravděpodobnosti zlomkem a skládání jevů',
      'Aritmetický průměr, modus a medián',
      'Reálné percentilové grafy',
      'Stromové a Vennovy diagramy',
    ],
  },
  {
    title: 'Zavedená témata',
    items: [
      'Zlomky, desetinná čísla, procenta a poměry',
      'Lineární rovnice a soustavy rovnic',
      'Rovinná geometrie, trojúhelníky, kruh a rovnoběžníky',
      'Hranoly, válce, jehlany a kužele',
      'Pythagorova a Thaletova věta',
    ],
  },
];

type SeriesEntry = {
  id: string;
  title: string;
  body: string;
  points: string[];
  kind: 'print' | 'digital';
  price: string;
  priceDetail: string;
  priceNote?: string;
};

type SeriesFilterId = 'pro-vsechny' | 'krok' | 'digital';

const SERIES: SeriesEntry[] = [
  {
    id: 'pro-vsechny',
    kind: 'print',
    title: 'Pro všechny',
    price: '125 Kč',
    priceDetail: 'za sešit',
    body:
      'Hutnější řada pro běžnou třídu, procvičování a automatizaci výpočtů. Každá kapitola pracuje s více úrovněmi obtížnosti.',
    points: ['Tři úrovně obtížnosti', 'Drilové série', 'Příprava na SŠ', 'V doložkovém řízení MŠMT'],
  },
  {
    id: 'krok',
    kind: 'print',
    title: 'Krok za krokem',
    price: '125 Kč',
    priceDetail: 'za sešit',
    body:
      'Řada pro vyvozování nové látky a budování matematické představivosti. Úlohy vedou žáky po malých krocích k principu.',
    points: ['Konstruktivistický přístup', 'Otevřené otázky', 'Skupinová diskuze', 'Soulad s RVP 2025/26'],
  },
  {
    id: 'digital',
    kind: 'digital',
    title: 'Digitální podpora',
    price: 'Zdarma',
    priceDetail: 'od 15 ks sešitů pro žáky',
    priceNote: 'Pro rodiče od 290 Kč / měsíc nebo 2 900 Kč / rok',
    body:
      'Interaktivní učebnice ke každému sešitu — tisíce příkladů, soutěže, pracovní listy a metodické komentáře. Lze i samostatně.',
    points: [
      'Rýsování a 3D geometrie na tabuli',
      'Animované postupy a okamžitá zpětná vazba',
      'Statistika, testy a metodické komentáře',
    ],
  },
];

const SERIES_PREVIEW_H = 200;

const SERIES_CARD_THEME: Record<
  SeriesFilterId,
  {
    card: string;
    border: string;
    borderActive: string;
    check: string;
  }
> = {
  'pro-vsechny': {
    card: 'bg-[#fff7ed]',
    border: 'border-[#f5a623]/30',
    borderActive: 'border-[#e8942a] shadow-[0_10px_32px_rgba(232,148,42,0.18)] ring-2 ring-[#f5a623]/25',
    check: 'bg-white/90 text-[#e8942a] ring-[#f5a623]/25',
  },
  krok: {
    card: 'bg-[#ecfdf5]',
    border: 'border-[#059669]/28',
    borderActive: 'border-[#059669] shadow-[0_10px_32px_rgba(5,150,105,0.16)] ring-2 ring-[#059669]/20',
    check: 'bg-white/90 text-[#059669] ring-[#059669]/25',
  },
  digital: {
    card: 'bg-[#f3eeff]',
    border: 'border-[#7C3AED]/28',
    borderActive: 'border-[#7C3AED] shadow-[0_10px_32px_rgba(124,58,237,0.18)] ring-2 ring-[#7C3AED]/22',
    check: 'bg-white/90 text-[#7C3AED] ring-[#7C3AED]/25',
  },
};

type Book = {
  id?: string;
  name?: string;
  category?: string;
  type?: string;
  image?: string;
  rocnik?: string | number;
  poradi?: string | number;
};

function normalize(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function extractGrade(book: Book): number {
  const fromField = Number.parseInt(String(book.rocnik ?? ''), 10);
  if (Number.isFinite(fromField)) return fromField;
  const name = String(book.name ?? '');
  const match =
    name.match(/pro\s+(\d+)\.\s*ro/i) ??
    name.match(/(\d+)\.\s*ro[cč]n/i) ??
    name.match(/matematika\s+(\d+)\./i);
  const n = Number.parseInt(match?.[1] ?? '', 10);
  return Number.isFinite(n) ? n : 99;
}

function heroBackgroundForBook(book: Book, fallback: string) {
  const grade = extractGrade(book);
  return HERO_BG_BY_GRADE[grade] ?? fallback;
}

function extractPart(book: Book): number {
  const name = String(book.name ?? '');
  const match = name.match(/(\d+)\.\s*d[ií]l/i);
  const fromName = Number.parseInt(match?.[1] ?? '', 10);
  if (Number.isFinite(fromName)) return fromName;
  const fromField = Number.parseInt(String(book.poradi ?? ''), 10);
  return Number.isFinite(fromField) ? fromField : 1;
}

function sortByGradeSequence(a: Book, b: Book) {
  const gradeDiff = extractGrade(a) - extractGrade(b);
  if (gradeDiff !== 0) return gradeDiff;
  const partDiff = extractPart(a) - extractPart(b);
  if (partDiff !== 0) return partDiff;
  const seriesDiff = (isKrok(a) ? 1 : 0) - (isKrok(b) ? 1 : 0);
  if (seriesDiff !== 0) return seriesDiff;
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'cs');
}

function pickHeroCarouselBooks(books: Book[]) {
  return books
    .filter((book) => {
      const grade = extractGrade(book);
      return grade >= 6 && grade <= 9;
    })
    .sort(sortByGradeSequence);
}

function sortBooks(a: Book, b: Book) {
  const pa = Number.parseInt(String(a.poradi ?? ''), 10);
  const pb = Number.parseInt(String(b.poradi ?? ''), 10);
  if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
  const gradeDiff = extractGrade(a) - extractGrade(b);
  if (gradeDiff !== 0) return gradeDiff;
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'cs');
}

function isMath2Book(book: Book) {
  const cat = normalize(book.category);
  const name = normalize(book.name);
  if (!cat.includes('matematika') && !name.includes('matematika') && !name.includes('krok za krokem')) {
    return false;
  }
  if (cat.includes('1.') || cat.includes('1 stupen') || cat.includes('matematika 1')) return false;
  return cat.includes('2') || cat.includes('druh') || name.includes('krok za krokem') || name.includes('pro vsechny');
}

function isKrok(book: Book) {
  return normalize(book.name).includes('krok za krokem');
}

function isProVsechny(book: Book) {
  const name = normalize(book.name);
  return name.includes('pro vsechny') || (!isKrok(book) && book.type !== 'online' && book.type !== 'license');
}

function isDigital(book: Book) {
  return book.type === 'online' || book.type === 'license';
}

function pickMathBooks(products: Book[], predicate: (book: Book) => boolean, limit = 48) {
  return products
    .filter((book) => isMath2Book(book) && predicate(book) && !!getProductImage(book))
    .sort(sortBooks)
    .slice(0, limit);
}

function SeriesCoverRow({
  books,
  layout = 'stack',
}: {
  books: Book[];
  layout?: 'stack' | 'single';
}) {
  const isSingle = layout === 'single';
  const visible = isSingle ? books.slice(0, 1) : books.slice(0, 3);

  if (visible.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center text-[13px] font-bold text-[#001161]/35"
        style={{ height: SERIES_PREVIEW_H, fontFamily: FF }}
      >
        Načítám obálky…
      </div>
    );
  }

  if (isSingle) {
    const book = visible[0]!;
    const src = getProductImage(book);
    return (
      <div
        className="relative flex w-full items-end justify-center px-4 pb-3"
        style={{ height: SERIES_PREVIEW_H }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative block origin-bottom"
          style={{ transform: 'rotate(-3deg)' }}
        >
          {src ? (
            <ImageWithFallback
              src={src}
              alt={book.name ?? 'Digitální podpora'}
              className="object-contain"
              style={{ width: 120, height: 168, filter: HERO_BOOK_COVER_SHADOW }}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex w-full items-end justify-center px-2"
      style={{ height: SERIES_PREVIEW_H }}
      onClick={(event) => event.stopPropagation()}
    >
      {visible.map((book, index) => {
        const src = getProductImage(book);
        const rotate = index === 0 ? -8 : index === visible.length - 1 ? 8 : 0;
        const lift = index === 1 ? 22 : index === 0 ? 4 : 0;
        return (
          <div
            key={book.id ?? book.name}
            className="relative block origin-bottom"
            style={{
              marginLeft: index > 0 ? -18 : 0,
              marginBottom: lift,
              zIndex: 10 + index,
              transform: `rotate(${rotate}deg)`,
            }}
          >
            {src ? (
              <ImageWithFallback
                src={src}
                alt={book.name ?? 'Matematika 2. stupeň'}
                className="object-contain"
                style={{ width: 88, height: 128, filter: HERO_BOOK_COVER_SHADOW }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const VIVIDBOOKS_LOGO_VIEWBOX = '0 0 1786.62 869.93';

function VividLogo() {
  const W = 88;
  const fill = '#001161';

  return (
    <Link to="/" className="inline-flex shrink-0 items-center" aria-label="Vividbooks">
      <svg viewBox={VIVIDBOOKS_LOGO_VIEWBOX} fill="none" style={{ width: `${W}px`, height: 'auto', display: 'block' }}>
        <path d={logoPaths.p299c6b00} fill={fill} />
        <path d={logoPaths.p3cc4870} fill={fill} />
        <path d={logoPaths.p98d9300} fill={fill} />
        <path d={logoPaths.pf524b00} fill={fill} />
        <path d={logoPaths.p26e2d80} fill={fill} />
        <path d={logoPaths.p15998cf0} fill={fill} />
        <path d={logoPaths.p1bd3b900} fill={fill} />
        <path d={logoPaths.p19a24c00} fill={fill} />
        <path d={logoPaths.p34d64300} fill={fill} />
        <path d={logoPaths.p396dedf0} fill={fill} />
      </svg>
    </Link>
  );
}

type HeroStreamItem = {
  book: Book;
  bottom: number;
  rotate: number;
  z: number;
};

function heroStreamRand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function heroCarouselSegmentWidth(count: number) {
  if (count <= 0) return 0;
  return count * HERO_COVER_SIZE.w + Math.max(0, count - 1) * HERO_COVER_GAP;
}

function heroCarouselCenterIndex(translateX: number, containerWidth: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  const centerX = containerWidth / 2;
  const coverStep = HERO_COVER_SIZE.w + HERO_COVER_GAP;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < itemCount; i++) {
    const itemCenter = translateX + i * coverStep + HERO_COVER_SIZE.w / 2;
    const dist = Math.abs(itemCenter - centerX);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function buildHeroStreamLayout(pool: Book[]): HeroStreamItem[] {
  return pool.map((book, i) => {
    const seedBase = i * 5 + String(book.id ?? book.name ?? i).length * 13;
    const r1 = heroStreamRand(seedBase + 1);
    const r2 = heroStreamRand(seedBase + 2);
    const r4 = heroStreamRand(seedBase + 4);
    const wave = Math.sin(i * 0.72) * 16;
    return {
      book,
      bottom: Math.max(0, Math.round(2 + r1 * 56 + wave)),
      rotate: -20 + Math.round(r2 * 40),
      z: 10 + Math.floor(r4 * 14),
    };
  });
}

function HeroCoverCarousel({
  books,
  fallbackBackground,
  onBackgroundColorChange,
}: {
  books: Book[];
  fallbackBackground: string;
  onBackgroundColorChange?: (color: string) => void;
}) {
  const pool = useMemo(
    () => pickHeroCarouselBooks(books.filter((book) => !!getProductImage(book))),
    [books],
  );
  const segment = useMemo(() => buildHeroStreamLayout(pool), [pool]);
  const segmentColors = useMemo(
    () => segment.map((item) => heroBackgroundForBook(item.book, fallbackBackground)),
    [segment, fallbackBackground],
  );
  const loopItems = useMemo(() => [...segment, ...segment], [segment]);
  const segmentWidth = useMemo(() => heroCarouselSegmentWidth(segment.length), [segment.length]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const autoIndexRef = useRef(0);
  const pausedRef = useRef(false);

  const setBackgroundForBook = useCallback(
    (book: Book) => {
      onBackgroundColorChange?.(heroBackgroundForBook(book, fallbackBackground));
    },
    [fallbackBackground, onBackgroundColorChange],
  );

  const syncBackgroundToCenter = useCallback(
    (translateX: number) => {
      if (pausedRef.current || !onBackgroundColorChange || segment.length === 0) return;
      const containerW = containerRef.current?.offsetWidth ?? 0;
      const bestIdx = heroCarouselCenterIndex(translateX, containerW, loopItems.length);
      const segmentIdx = bestIdx % segment.length;
      if (segmentIdx === autoIndexRef.current) return;
      autoIndexRef.current = segmentIdx;
      onBackgroundColorChange(segmentColors[segmentIdx] ?? fallbackBackground);
    },
    [fallbackBackground, loopItems.length, onBackgroundColorChange, segment.length, segmentColors],
  );

  const handleCoverHover = useCallback(
    (book: Book) => {
      pausedRef.current = true;
      setBackgroundForBook(book);
    },
    [setBackgroundForBook],
  );

  const handleCoverLeave = useCallback(() => {
    pausedRef.current = false;
    syncBackgroundToCenter(x.get());
  }, [syncBackgroundToCenter, x]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const scrollDuration = Math.max(28, segment.length * 3.4);

  useEffect(() => {
    if (segmentColors.length === 0) return;
    autoIndexRef.current = -1;
  }, [segmentColors]);

  useEffect(() => {
    if (!reduceMotion || segment.length === 0) return;
    syncBackgroundToCenter(0);
  }, [reduceMotion, segment.length, syncBackgroundToCenter]);

  useEffect(() => {
    const unsubscribe = x.on('change', syncBackgroundToCenter);
    return unsubscribe;
  }, [syncBackgroundToCenter, x]);

  useEffect(() => {
    if (reduceMotion || segmentWidth <= 0) return;
    x.set(0);
    syncBackgroundToCenter(0);
    const controls = animate(x, [0, -segmentWidth], {
      duration: scrollDuration,
      repeat: Infinity,
      ease: 'linear',
    });
    return () => controls.stop();
  }, [reduceMotion, scrollDuration, segmentWidth, syncBackgroundToCenter, x]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      syncBackgroundToCenter(x.get());
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [syncBackgroundToCenter, x]);

  if (pool.length === 0) {
    return (
      <motion.div
        className={`flex w-full items-center justify-center rounded-[24px] bg-white/55 text-[#001161]/35 ${HERO_CAROUSEL_HEIGHT}`}
      >
        <span className="text-[15px] font-bold" style={{ fontFamily: FF }}>
          Načítám obálky…
        </span>
      </motion.div>
    );
  }

  const renderCover = (item: HeroStreamItem, key: string, index: number) => {
    const src = getProductImage(item.book);
    const overlap = HERO_COVER_GAP;
    return (
      <motion.div
        key={key}
        className="relative shrink-0"
        style={{
          marginLeft: index > 0 ? overlap : 0,
          marginBottom: item.bottom,
          transform: `rotate(${item.rotate}deg)`,
          zIndex: item.z,
        }}
      >
        <div
          className="block origin-bottom"
          onMouseEnter={() => handleCoverHover(item.book)}
          onMouseLeave={handleCoverLeave}
        >
          {src ? (
            <ImageWithFallback
              src={src}
              alt={item.book.name ?? 'Matematika 2. stupeň'}
              className="object-contain"
              style={{
                width: HERO_COVER_SIZE.w,
                height: HERO_COVER_SIZE.h,
                filter: HERO_BOOK_COVER_SHADOW,
              }}
            />
          ) : null}
        </div>
      </motion.div>
    );
  };

  if (reduceMotion) {
    return (
      <motion.div ref={containerRef} className={`relative w-full overflow-hidden ${HERO_CAROUSEL_HEIGHT}`}>
        <motion.div className="flex h-full items-end overflow-hidden pb-2">
          {segment.map((item, i) => renderCover(item, `static-${item.book.id}-${i}`, i))}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div ref={containerRef} className={`relative w-full overflow-hidden ${HERO_CAROUSEL_HEIGHT}`}>
      <motion.div
        className="relative flex h-full w-max items-end will-change-transform"
        style={{ x }}
      >
        {loopItems.map((item, i) => renderCover(item, `stream-${item.book.id}-${i}`, i))}
      </motion.div>
    </motion.div>
  );
}


function SectionTitle({
  eyebrow,
  title,
  body,
  align = 'left',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`mb-8 ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow ? (
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/40" style={{ fontFamily: FF }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-[#001161] text-[28px] leading-[1.08] md:text-[36px]" style={{ fontFamily: COOPER }}>
        {title}
      </h2>
      {body ? (
        <p className={`mt-3 max-w-[720px] text-[15px] leading-relaxed text-[#001161]/65 md:text-[16px] ${align === 'center' ? 'mx-auto' : ''}`} style={{ fontFamily: FF }}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

function SeriesOverviewCard({
  series,
  books,
  active,
  onSelect,
}: {
  series: SeriesEntry;
  books: Book[];
  active: boolean;
  onSelect: () => void;
}) {
  const isDigital = series.kind === 'digital';
  const theme = SERIES_CARD_THEME[series.id as SeriesFilterId];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group flex h-full cursor-pointer flex-col overflow-hidden rounded-[22px] border text-left transition duration-200 ${theme.card} ${
        active ? theme.borderActive : `${theme.border} hover:shadow-md`
      }`}
    >
      <div className="px-6 pt-6 md:px-7 md:pt-7">
        <h3 className="text-[#001161] text-[22px] leading-[1.08] lg:text-[24px]" style={{ fontFamily: COOPER }}>
          {series.title}
        </h3>
      </div>

      <div className="shrink-0 pt-3">
        <SeriesCoverRow
          books={books}
          layout={isDigital ? 'single' : 'stack'}
        />
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-5 md:px-7 md:pb-7 md:pt-6">
        <div>
          <p className="text-[28px] font-bold leading-none text-[#001161] lg:text-[30px]" style={{ fontFamily: FF }}>
            {series.price}
          </p>
          <p className="mt-1 text-[13px] font-bold text-[#001161]/58" style={{ fontFamily: FF }}>
            {series.priceDetail}
          </p>
          {series.priceNote ? (
            <p className="mt-1.5 text-[12px] leading-snug text-[#001161]/45" style={{ fontFamily: FF }}>
              {series.priceNote}
            </p>
          ) : null}
        </div>
        <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-[#001161]/68 md:text-[15px]" style={{ fontFamily: FF }}>
          {series.body}
        </p>

        <ul className="mt-5 space-y-2.5">
          {series.points.slice(0, 3).map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-[13px] leading-snug text-[#001161]/75" style={{ fontFamily: FF }}>
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ${theme.check}`}>
                <Check className="h-3 w-3" />
              </span>
              <span className="line-clamp-1">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function SeriesTitlesGrid({
  title,
  books,
  onProductClick,
}: {
  title: string;
  books: Book[];
  onProductClick: (book: Book) => void;
}) {
  const sorted = useMemo(() => [...books].sort(sortBooks), [books]);
  if (sorted.length === 0) return null;

  return (
    <div className="mt-10">
      <h4 className="text-center text-[#001161] text-[18px] leading-tight md:text-[20px]" style={{ fontFamily: FF }}>
        {title}
      </h4>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {sorted.map((book) => (
          <UnifiedBookCard
            key={String(book.id ?? book.name)}
            book={book}
            variant="catalog"
            onClick={() => onProductClick(book)}
          />
        ))}
      </div>
    </div>
  );
}

function CampaignSeriesExplorer({
  proBooks,
  krokBooks,
  digitalBooks,
  onProductClick,
  onOpenSeriesVideo,
}: {
  proBooks: Book[];
  krokBooks: Book[];
  digitalBooks: Book[];
  onProductClick: (book: Book) => void;
  onOpenSeriesVideo: () => void;
}) {
  const booksBySeries = useMemo<Record<SeriesFilterId, Book[]>>(
    () => ({
      'pro-vsechny': proBooks,
      krok: krokBooks,
      digital: digitalBooks,
    }),
    [proBooks, krokBooks, digitalBooks],
  );

  const availableSeries = useMemo(
    () => SERIES.filter((series) => booksBySeries[series.id as SeriesFilterId]?.length > 0),
    [booksBySeries],
  );

  const [activeSeries, setActiveSeries] = useState<SeriesFilterId>(
    (availableSeries[0]?.id as SeriesFilterId) ?? 'pro-vsechny',
  );

  useEffect(() => {
    if (!availableSeries.some((series) => series.id === activeSeries)) {
      setActiveSeries((availableSeries[0]?.id as SeriesFilterId) ?? 'pro-vsechny');
    }
  }, [activeSeries, availableSeries]);

  if (availableSeries.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6 items-stretch">
        {availableSeries.map((series) => (
          <SeriesOverviewCard
            key={series.id}
            series={series}
            books={booksBySeries[series.id as SeriesFilterId] ?? []}
            active={activeSeries === series.id}
            onSelect={() => setActiveSeries(series.id as SeriesFilterId)}
          />
        ))}
      </div>

      <p className="mt-5 text-center text-[13px] leading-relaxed text-[#001161]/60" style={{ fontFamily: FF }}>
        Jaký je rozdíl mezi matikou <strong className="text-[#001161]">Pro všechny</strong> a{' '}
        <strong className="text-[#001161]">Krok za krokem</strong>?{' '}
        <button
          type="button"
          onClick={onOpenSeriesVideo}
          className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-[#4B48CC] underline underline-offset-2 hover:opacity-80"
          style={{ fontFamily: FF }}
        >
          Pusťte si video
        </button>
      </p>

      <div id="tituly" className="mt-10 scroll-mt-24">
        <div className="text-center">
          <h3 className="text-[#001161] text-[22px] leading-tight md:text-[24px]" style={{ fontFamily: FF }}>
            Tituly pro 6.–9. ročník
          </h3>
        </div>

        <SeriesTitlesGrid title="Pro všechny" books={proBooks} onProductClick={onProductClick} />
        <SeriesTitlesGrid title="Krok za krokem" books={krokBooks} onProductClick={onProductClick} />
      </div>
    </div>
  );
}

function RvpStrip({ embedded = false }: { embedded?: boolean }) {
  return (
    <div
      className={
        embedded
          ? 'px-5 pt-3 pb-7 sm:px-8 md:px-10 md:pb-8'
          : 'border-y border-[#001161]/8 bg-[#f5f7fd] px-6 py-3 md:px-12'
      }
    >
      <div className={`mx-auto flex max-w-[1200px] flex-wrap items-center gap-2 ${embedded ? 'justify-center' : 'justify-center'}`}>
        <ProductComplianceBadge>Doložka MŠMT</ProductComplianceBadge>
        <span className="text-[12px] text-[#001161]/55" style={{ fontFamily: FF }}>
          pro 6.–9. ročník
        </span>
        <span
          className="rounded-lg bg-[#DC2626] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white"
          style={{ fontFamily: FF }}
        >
          Podle revize RVP
        </span>
        <a
          href="#rvp"
          className="text-[13px] font-bold text-[#001161]/65 transition hover:text-[#001161]"
          style={{ fontFamily: FF }}
        >
          – více
        </a>
      </div>
    </div>
  );
}

function CampaignTrialSection() {
  return (
    <section id="trial" className="scroll-mt-24 bg-white px-6 py-14 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle
          align="center"
          eyebrow="Zkušební přístup"
          title="Vyzkoušejte učební materiály Vividbooks zdarma na 14 dní"
          body={
            <>
              Vyplňte formulář nebo nám zavolejte na{' '}
              <Link to="/kontakt" className="font-bold text-[#E8942A] hover:underline">
                +420 602 227 674
              </Link>
              .
            </>
          }
        />
        <div className="mx-auto max-w-[520px]">
          <TrialRegistrationForm embedded defaultSubjects2nd={['Mathematics-2']} />
        </div>
      </div>
    </section>
  );
}

function PillarsSection() {
  return (
    <section id="metodika" className="scroll-mt-24 bg-[#f5f7fd] px-6 py-14 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle
          align="center"
          eyebrow="Metodika v praxi"
          title={<>Nejen sešit, ale způsob výuky</>}
          body="Metodika drží pohromadě pracovní sešity, digitální učebnici i přípravu učitele. Principy ukazují, jak s materiály vést hodinu od objevení pravidla až po procvičení."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: '01',
              title: 'Principy pro hodinu',
              body: 'Devět opěrných bodů pomáhá rozhodnout, kdy objevovat, kdy diskutovat a kdy automatizovat.',
            },
            {
              label: '02',
              title: 'Metodická videa',
              body: 'Krátké komentáře a ukázky vysvětlují, jak přemýšlet nad kapitolami i typickými chybami žáků.',
            },
            {
              label: '03',
              title: 'RVP a webináře',
              body: 'Nová témata jsou doplněná o záznamy webinářů, takže učitel ví, kde začít a co nepřeskočit.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-[24px] border border-[#001161]/10 bg-white p-5 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#4B48CC]/55" style={{ fontFamily: FF }}>
                {item.label}
              </p>
              <h3 className="mt-2 text-[20px] leading-tight text-[#001161]" style={{ fontFamily: COOPER }}>
                {item.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#001161]/64" style={{ fontFamily: FF }}>
                {item.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-[28px] border border-[#001161]/10 bg-white p-5 shadow-sm md:p-7">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/38" style={{ fontFamily: FF }}>
                9 principů
              </p>
              <h3 className="mt-1 text-[24px] leading-tight text-[#001161] md:text-[30px]" style={{ fontFamily: COOPER }}>
                Jak Vividbooks vede matematiku
              </h3>
            </div>
            <p className="max-w-[420px] text-[14px] leading-relaxed text-[#001161]/58 md:text-right" style={{ fontFamily: FF }}>
              Principy jsou záměrně krátké: mají pomoct při přípravě hodiny, ne přidat další metodický manuál.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
          {MATEMATIKA_2_STUPEN_PRINCIPLES.map((principle, index) => (
            <article key={principle.title} className="rounded-[18px] bg-[#f8f9fc] p-4 ring-1 ring-[#001161]/6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#4B48CC] ring-1 ring-[#001161]/8" style={{ fontFamily: FF }}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h4 className="text-[15px] font-bold leading-snug text-[#001161]" style={{ fontFamily: FF }}>
                    {principle.title}
                  </h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#001161]/62" style={{ fontFamily: FF }}>
                    {principle.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MethodologyVideosSection() {
  return (
    <section className="bg-[#f5f7fd] px-6 pb-14 md:px-12 md:pb-16">
      <div className="mx-auto max-w-[1200px]">
        <YouTubePlaylistSlider
          videos={MATH_CAMPAIGN_WEBINAR_VIDEOS}
          eyebrow="Záznamy webinářů"
          heading="DVPP zdarma – záznamy k matematickým tématům"
          subheading="Webináře navazují na RVP část a jsou určené pro učitele; k DVPP webinářům získáte certifikát."
        />

        <YouTubePlaylistSlider
          className="mt-8"
          videos={MATH_METHODOLOGY_PLAYLIST_VIDEOS}
          playlistUrl={MATH_METHODOLOGY_PLAYLIST_URL}
          eyebrow="Videometodika"
          heading="Jak s materiály opravdu učit"
          subheading="Ukázky výuky a metodické komentáře Františka Cába k tomu, jak nad matematikou s žáky přemýšlet."
        />
      </div>
    </section>
  );
}

function RvpTopicsSection() {
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const activeTopic = RVP_BLOCKS[activeTopicIndex] ?? RVP_BLOCKS[0];

  return (
    <section id="rvp" className="scroll-mt-24 px-6 py-14 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <SectionTitle
          align="center"
          eyebrow="RVP 2025/26"
          title={<>Nová témata bez hledání materiálů navíc</>}
          body="RVP část je oddělená od obecné metodiky: tady učitel rychle vidí, co je v materiálech pokryté a kde najde webináře k novým tématům."
        />

        <div className="mx-auto max-w-[920px]">
          <div className="rounded-[28px] border border-[#001161]/10 bg-[#f8f9fc] p-4 md:p-5">
            <div className="flex flex-wrap justify-center gap-2">
              {RVP_BLOCKS.map((block, index) => {
                const active = index === activeTopicIndex;
                return (
                  <button
                    key={block.title}
                    type="button"
                    onClick={() => setActiveTopicIndex(index)}
                    className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
                      active
                        ? 'bg-[#001161] text-white shadow-[0_8px_18px_rgba(0,17,97,0.18)]'
                        : 'bg-white text-[#001161]/62 ring-1 ring-[#001161]/10 hover:text-[#001161]'
                    }`}
                    style={{ fontFamily: FF }}
                    aria-pressed={active}
                  >
                    {block.title}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.article
                key={activeTopic.title}
                className="mt-5 rounded-[22px] bg-white p-6 shadow-sm ring-1 ring-[#001161]/8 md:p-7"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="h-1 w-20 rounded-full bg-[#4B48CC]/70" />
                <h3 className="mt-4 text-[26px] leading-tight text-[#001161] md:text-[30px]" style={{ fontFamily: COOPER }}>
                  {activeTopic.title}
                  {activeTopic.badge ? (
                    <span className="ml-2 align-middle rounded-full bg-[#f5f7fd] px-2.5 py-1 text-[11px] font-bold text-[#4B48CC] ring-1 ring-[#001161]/10" style={{ fontFamily: FF }}>
                      {activeTopic.badge}
                    </span>
                  ) : null}
                </h3>
                <ul className="mt-5 grid gap-3">
                  {activeTopic.items.map((item) => (
                    <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-[#001161]/70" style={{ fontFamily: FF }}>
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4B48CC]/70" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

const SCHOOL_ORDER_PATH = '/objednat?predmet=Matematika%202.%20stupe%C5%88';

function CampaignActionButtons({
  variant = 'hero',
  className = '',
}: {
  variant?: 'hero' | 'header';
  className?: string;
}) {
  const navigate = useNavigate();
  const isHeader = variant === 'header';

  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      <Link
        to="/vyzkousejte"
        className={`inline-flex items-center justify-center rounded-xl bg-[#7C3AED] font-bold text-white transition hover:scale-[1.03] hover:bg-[#6D28D9] ${
          isHeader ? 'whitespace-nowrap px-3.5 py-2 text-[13px]' : 'px-5 py-3 text-[15px] shadow-sm'
        }`}
        style={{ fontFamily: FF }}
      >
        Vyzkoušet zdarma
      </Link>
      <button
        type="button"
        onClick={() => navigate(SCHOOL_ORDER_PATH)}
        className={`inline-flex items-center justify-center rounded-xl bg-[#001161] font-bold text-white transition hover:scale-[1.03] hover:bg-[#001161]/85 active:scale-[0.97] ${
          isHeader ? 'whitespace-nowrap px-3.5 py-2 text-[13px]' : 'px-5 py-3 text-[15px]'
        }`}
        style={{ fontFamily: FF }}
      >
        Objednat pro školu
      </button>
    </div>
  );
}

export function MathCampaignLandingPage() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const [videoOpen, setVideoOpen] = useState(false);
  const [headerActionsVisible, setHeaderActionsVisible] = useState(false);
  const [heroBackground, setHeroBackground] = useState(SUBJECT_CONFIGS.Matematika.heroColor);
  const heroActionsRef = useRef<HTMLDivElement>(null);
  const cfg = SUBJECT_CONFIGS.Matematika;

  useEffect(() => {
    const el = heroActionsRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setHeaderActionsVisible(!entry.isIntersecting),
      { root: null, rootMargin: '-72px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleHeroBackgroundChange = useCallback((color: string) => {
    setHeroBackground(color);
  }, []);

  const handleProductClick = useCallback(
    (book: Book) => {
      navigate(productDetailPath(book, products));
    },
    [navigate, products],
  );

  const { krokBooks, proBooks, digitalBooks } = useMemo(() => {
    const all = products as Book[];
    const krok = pickMathBooks(all, (book) => !isDigital(book) && isKrok(book), 48);
    const pro = pickMathBooks(all, (book) => !isDigital(book) && isProVsechny(book), 48);
    const digital = pickMathBooks(all, isDigital, 48);
    return {
      krokBooks: krok,
      proBooks: pro,
      digitalBooks: digital,
    };
  }, [products]);

  const heroCarouselBooks = useMemo(
    () => pickHeroCarouselBooks([...proBooks, ...krokBooks]),
    [proBooks, krokBooks],
  );

  return (
    <div className="min-h-screen bg-white text-[#001161]" style={{ fontFamily: FF }}>
      <SEOHead
        title="Matematika 2. stupeň ZŠ"
        path="/kampane/matematika-2-stupen"
        description="Pracovní sešity a digitální učebnice Vividbooks pro matematiku na 2. stupni ZŠ, 6.-9. ročník."
        jsonLd={faqJsonLd([
          {
            question: 'Je tahle stránka určená pro matematiku na 2. stupni?',
            answer: 'Ano. Stránka se týká výhradně matematiky pro 6.-9. ročník základní školy.',
          },
          {
            question: 'Jaký je rozdíl mezi řadami Pro všechny a Krok za krokem?',
            answer:
              'Pro všechny je hutnější procvičovací řada pro běžnou třídu. Krok za krokem vede žáky k objevování principů po menších krocích.',
          },
          {
            question: 'Jsou materiály v souladu s RVP 2025/26?',
            answer:
              'Ano. Krok za krokem má doložku MŠMT a nová RVP témata jsou dostupná v digitální učebnici. Pro všechny je zahrnuje přímo a je v doložkovém řízení.',
          },
        ])}
      />

      <header className="sticky top-0 z-[60] bg-white/94 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
          <VividLogo />
          <nav className="hidden items-center gap-5 md:flex" aria-label="Navigace kampaně">
            {[
              ['#digital', 'Digitální prostředí'],
              ['#sesity', 'Sešity'],
              ['#metodika', 'Metodika'],
              ['#rvp', 'RVP 2025'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-[14px] font-bold text-[#001161]/58 transition hover:text-[#001161]">
                {label}
              </a>
            ))}
          </nav>
          {headerActionsVisible ? (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <CampaignActionButtons variant="header" />
            </motion.div>
          ) : null}
        </div>
      </header>

      <main>
        <section className="w-full overflow-hidden">
          <motion.div
            className="w-full pb-16 pt-5 md:pb-20 md:pt-8"
            animate={{ backgroundColor: heroBackground }}
            initial={{ backgroundColor: cfg.heroColor }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex flex-col items-center gap-8 px-4 sm:px-6 md:px-10">
              <div className="w-full max-w-[680px] text-center">
                <h1 className="mb-6 text-[#001161] text-[32px] leading-[1.05] tracking-tight sm:text-[40px] md:text-[44px]" style={{ fontFamily: COOPER }}>
                  Matematika, o které přemýšlíte
                </h1>
                <p className="mx-auto max-w-[560px] text-[16px] leading-relaxed text-[#001161]/66 md:text-[17px]" style={{ fontFamily: FF }}>
                  Dvě řady pracovních sešitů a digitální podpora pro 6.-9. ročník. Učitel má po ruce vyvozování, procvičování, interaktivní tabuli i metodickou oporu v jednom prostředí.
                </p>
                <div ref={heroActionsRef} className="mt-5 flex justify-center">
                  <CampaignActionButtons variant="hero" />
                </div>
              </div>
            </div>
            <HeroCoverCarousel
              books={heroCarouselBooks}
              fallbackBackground={cfg.heroColor}
              onBackgroundColorChange={handleHeroBackgroundChange}
            />
            <RvpStrip embedded />
          </motion.div>
        </section>

        <section id="digital" className="scroll-mt-24">
          <SubjectTabsSection
            subject="Matematika 2. stupeň"
            displayName="Matematika"
            ecosystemHeading
            ecosystemHeadingCenter
            ecosystemHeadingStacked
            ecosystemHeadingTitle={MATH2_ECOSYSTEM_HEADING.title}
            ecosystemHeadingBody={MATH2_ECOSYSTEM_HEADING.body}
            hideSectionHeading
            excludeTabTexts={MATH2_ECOSYSTEM_EXCLUDED_TABS}
            extraTabs={MATH2_ECOSYSTEM_EXTRA_TABS}
          />
        </section>

        <section id="sesity" className="scroll-mt-24 px-6 py-12 md:px-12">
          <div className="mx-auto max-w-[1200px]">
            <SectionTitle
              align="center"
              eyebrow="Materiály pro výuku"
              title="Materiály, které sedí každému učiteli"
              body="Dvě řady pracovních sešitů a digitální podpora, která výuku doplní na tabuli i doma. Vyberte kombinaci podle toho, co vaše třída právě potřebuje."
            />
            <CampaignSeriesExplorer
              proBooks={proBooks}
              krokBooks={krokBooks}
              digitalBooks={digitalBooks}
              onProductClick={handleProductClick}
              onOpenSeriesVideo={() => setVideoOpen(true)}
            />
          </div>
        </section>

        <CampaignTrialSection />

        <PillarsSection />

        <MethodologyVideosSection />

        <RvpTopicsSection />


        <section id="kontakt" className="px-6 py-14 text-center md:px-12" style={{ background: `linear-gradient(135deg, ${cfg.heroColor} 0%, ${cfg.heroColorDark} 100%)` }}>
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-[#001161] text-[34px] leading-tight md:text-[52px]" style={{ fontFamily: COOPER }}>
              Chcete matematiku pro 2. stupeň vyzkoušet?
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-[#001161]/65" style={{ fontFamily: FF }}>
              Ozvěte se nám. Pošleme ukázkové materiály, vysvětlíme rozdíl mezi řadami a připravíme nabídku pro vaši školu.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a
                href="mailto:skoly@vividbooks.cz?subject=Matematika%202.%20stupe%C5%88%20-%20uk%C3%A1zka"
                className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-3.5 text-[15px] font-bold text-white transition hover:scale-[1.03] hover:bg-[#6D28D9]"
              >
                Napsat si o ukázku
              </a>
              <button
                type="button"
                onClick={() => navigate('/objednat?predmet=Matematika%202.%20stupe%C5%88')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#001161] px-6 py-3.5 text-[15px] font-bold text-white transition hover:scale-[1.03] hover:bg-[#001161]/85"
              >
                Objednat pro školu
              </button>
              <a
                href={YOUTUBE_PLAYLIST}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#001161]/15 bg-white/70 px-6 py-3.5 text-[15px] font-bold text-[#001161] transition hover:bg-white"
              >
                Metodická videa
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#06124F] px-6 py-8 text-white md:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
          <Link to="/" className="text-[18px] leading-none text-white/70" style={{ fontFamily: COOPER }}>
            Vividbooks
          </Link>
          <p className="text-[13px] text-white/35" style={{ fontFamily: FF }}>
            © 2026 Vividbooks s.r.o. · <a href="https://vividbooks.cz" className="hover:text-white/70">vividbooks.cz</a>
          </p>
        </div>
      </footer>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {videoOpen ? (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Video: rozdíl mezi řadami"
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setVideoOpen(false)}
              >
                <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" />
                <motion.div
                  className="relative z-10 w-full max-w-[960px] overflow-hidden rounded-[18px] bg-[#0a0a0a] shadow-2xl"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 bg-[#001161] px-4 py-3 text-white">
                    <span className="text-[14px] font-bold" style={{ fontFamily: FF }}>
                      Rozdíl: Pro všechny vs. Krok za krokem
                    </span>
                    <button
                      type="button"
                      onClick={() => setVideoOpen(false)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                      aria-label="Zavřít video"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="relative aspect-video w-full bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${MATH_SERIES_DIFF_YOUTUBE_ID}?rel=0&modestbranding=1&autoplay=1`}
                      className="absolute inset-0 h-full w-full border-0"
                      title="Rozdíl mezi Pro všechny a Krok za krokem"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

export default MathCampaignLandingPage;
