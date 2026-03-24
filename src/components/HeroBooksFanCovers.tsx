import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  heroBooksFanZIndexForFan,
  heroBooksGridCoverRotationDeg,
  heroFanCoverBobanekLabel,
  type HeroBooksFanArrangement,
  type HeroBooksFanZOrder,
} from '../data/heroSlides';

export type HeroBooksFanCover = { id: string; name: string; image: string };

type Props = {
  books: HeroBooksFanCover[];
  arrangement: HeroBooksFanArrangement;
  gapPx: number;
  scalePct: number;
  coverShadow: string;
  /** Úzký layout katalogu (hero) — jeden levnější drop-shadow místo tří vrstev. */
  coverShadowLite?: string;
  variant: 'catalog' | 'preview';
  navigate: (path: string) => void;
  showEmptyHint?: boolean;
  emptyHint?: React.ReactNode;
  /** Výchozí 6; např. náhled na mobilu jen 4. */
  maxItems?: number;
  /** První hero slidery na homepage — eager + vyšší priorita prohlížeče pro obálky. */
  priorityImageLoading?: boolean;
  /** Jen u vějíře: která část má být navrchu. */
  fanZOrder?: HeroBooksFanZOrder;
  /**
   * Jen u mřížky: „náhodné“ lehké natočení obálek (deterministické).
   * Předejte např. `titlePlayfulSeed` slidu — změna seedu = jiné úhly.
   */
  gridRotationSeed?: number;
};

const BASE: Record<'catalog' | 'preview', { w: number; h: number }> = {
  catalog: { w: 82, h: 116 },
  preview: { w: 51, h: 72 },
};

function CoverTile({
  book,
  bi,
  w,
  h,
  coverShadow,
  arrangement,
  gapPx,
  total,
  navigate,
  variant,
  gridUseCssGap,
  fanZOrder,
  gridRotationSeed,
  fanSpreadPx,
  priorityImageLoading,
}: {
  book: HeroBooksFanCover;
  bi: number;
  w: number;
  h: number;
  coverShadow: string;
  arrangement: HeroBooksFanArrangement;
  gapPx: number;
  total: number;
  navigate: (path: string) => void;
  variant: 'catalog' | 'preview';
  gridUseCssGap: boolean;
  fanZOrder: HeroBooksFanZOrder;
  gridRotationSeed: number;
  /** Horizontální rozestup ve vějíři (px na krok od středu). */
  fanSpreadPx: number;
  priorityImageLoading?: boolean;
}) {
  const mid = (total - 1) / 2;
  const d = bi - mid;

  /** Úhel natočení obálky — bobánek protínáčíme, aby zůstal vodorovný jako bublina. */
  let coverTiltDeg = 0;
  const outerStyle: React.CSSProperties = { position: 'relative' };
  const tiltStyle: React.CSSProperties = {};

  if (arrangement === 'row') {
    outerStyle.marginLeft = bi === 0 ? 0 : gapPx;
  } else if (arrangement === 'grid') {
    if (!gridUseCssGap) {
      const cols = 3;
      outerStyle.marginLeft = bi % cols === 0 ? 0 : gapPx;
      outerStyle.marginTop = bi < cols ? 0 : gapPx;
    }
    coverTiltDeg = heroBooksGridCoverRotationDeg(book.id, bi, gridRotationSeed);
    tiltStyle.transform = `rotate(${coverTiltDeg}deg)`;
    tiltStyle.transformOrigin = 'center center';
  } else {
    outerStyle.marginLeft = bi === 0 ? 0 : gapPx;
    coverTiltDeg = d * 10;
    tiltStyle.transform = `rotate(${coverTiltDeg}deg) translateX(${d * fanSpreadPx}px)`;
    tiltStyle.transformOrigin = 'bottom center';
    outerStyle.zIndex = heroBooksFanZIndexForFan(bi, total, fanZOrder);
    outerStyle.alignSelf = 'flex-end';
  }

  /** Hover = přednostně vyšší vrstva (z-index), bez posunu po obrazovce nahoru — ten usekával stín v hero. */
  const outerHoverZ =
    variant === 'catalog'
      ? 'hover:z-[75] focus-visible:z-[75]'
      : 'hover:z-30 focus-visible:z-30';
  const liftOriginClass = arrangement === 'grid' ? 'origin-center' : 'origin-bottom';
  /** Lehké zvětšení při hoveru — z-index zůstává hlavní „pop“; bez translate, aby stín v hero zůstal celý. */
  const liftLayerClass = `inline-block ${liftOriginClass} transition-transform duration-200 ease-out will-change-transform group-hover:scale-[1.07] group-focus-within:scale-[1.07] motion-reduce:group-hover:scale-100 motion-reduce:group-focus-within:scale-100`;

  const tiltLayerStyle: React.CSSProperties =
    tiltStyle.transform != null
      ? { transform: tiltStyle.transform, transformOrigin: tiltStyle.transformOrigin }
      : {};

  const rw = Math.round(w);
  const rh = Math.round(h);
  const bobanekLabel = variant === 'catalog' ? heroFanCoverBobanekLabel(book.name) : null;
  const imgFilter =
    useLiteCoverShadow && coverShadowLite ? coverShadowLite : coverShadow;

  return (
    <div
      role="link"
      tabIndex={0}
      style={outerStyle}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/produkt/${encodeURIComponent(book.id)}`);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          navigate(`/produkt/${encodeURIComponent(book.id)}`);
        }
      }}
      className={`group cursor-pointer outline-none transition-[z-index] duration-150 ease-out ${arrangement === 'fan' || arrangement === 'grid' ? 'shrink-0' : ''} ${outerHoverZ}`}
    >
      <div className={liftLayerClass}>
        <div className={`relative ${liftOriginClass}`} style={tiltLayerStyle}>
        <div
          className="flex items-center justify-center overflow-visible bg-transparent"
          style={{ width: rw, height: rh }}
        >
          <img
            src={book.image}
            alt={book.name}
            className="max-h-full max-w-full object-contain"
            style={{ filter: imgFilter }}
            loading={priorityImageLoading ? (bi < 4 ? 'eager' : 'lazy') : 'lazy'}
            fetchPriority={priorityImageLoading ? (bi < 4 ? 'high' : 'low') : 'low'}
          />
        </div>
        {bobanekLabel != null && bobanekLabel !== '' && (
          <div
            className="pointer-events-none absolute left-1/2 z-[45] whitespace-nowrap rounded-full border border-white/95 bg-white px-2.5 py-1.5 shadow-md transition-opacity duration-200 md:px-3 md:py-2 md:shadow-[0_6px_20px_rgba(0,17,97,0.14)] [@media(hover:none)]:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100"
            style={{
              bottom: '100%',
              marginBottom: Math.max(6, Math.round(rh * 0.04)),
              transform: `translateX(-50%) rotate(${-coverTiltDeg}deg)`,
              transformOrigin: '50% 100%',
            }}
            aria-hidden
          >
            <span className="font-['Fenomen_Sans',sans-serif] text-[11px] font-extrabold leading-none tracking-tight text-[#001161] md:text-[12px]">
              {bobanekLabel}
            </span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export function HeroBooksFanCovers({
  books,
  arrangement,
  gapPx,
  scalePct,
  coverShadow,
  coverShadowLite,
  variant,
  navigate,
  showEmptyHint,
  emptyHint,
  maxItems = 6,
  fanZOrder = 'middle',
  gridRotationSeed = 0,
  priorityImageLoading = false,
}: Props) {
  const slice = books.slice(0, maxItems);
  const containerRef = useRef<HTMLDivElement>(null);
  const [narrowBand, setNarrowBand] = useState<'wide' | 'mid' | 'sm'>('wide');

  useLayoutEffect(() => {
    if (variant !== 'catalog') return;
    const el = containerRef.current;
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      setNarrowBand(w < 400 ? 'sm' : w < 560 ? 'mid' : 'wide');
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, slice.length, arrangement, maxItems]);

  const responsive =
    variant === 'catalog'
      ? narrowBand === 'sm'
        ? { scale: 0.68, gap: 0.48 }
        : narrowBand === 'mid'
          ? { scale: 0.82, gap: 0.72 }
          : { scale: 1, gap: 1 }
      : { scale: 1, gap: 1 };

  const { w: bw, h: bh } = BASE[variant];
  const w = ((bw * scalePct) / 100) * responsive.scale;
  const h = ((bh * scalePct) / 100) * responsive.scale;
  const effGap = Math.round(gapPx * responsive.gap);
  const fanSpreadPx = 8 * responsive.scale;

  const catalogWrap = (inner: React.ReactElement) =>
    variant === 'catalog' ? (
      <div ref={containerRef} className="min-w-0 w-full">
        {inner}
      </div>
    ) : (
      inner
    );

  if (slice.length === 0) {
    if (!showEmptyHint || emptyHint == null) return null;
    return (
      <div
        className={
          variant === 'catalog'
            ? 'max-w-[220px] text-center text-[11px] leading-snug text-[#001161]/40'
            : 'max-w-[200px] text-center text-[10px] leading-snug text-[#001161]/45'
        }
      >
        {emptyHint}
      </div>
    );
  }

  const gridUseCssGap = arrangement === 'grid' && gapPx >= 0;
  const useLiteCoverShadow =
    variant === 'catalog' && narrowBand !== 'wide' && Boolean(coverShadowLite);

  const tiles = slice.map((book, bi) => (
    <CoverTile
      key={`${book.id}-${bi}`}
      book={book}
      bi={bi}
      w={w}
      h={h}
      coverShadow={coverShadow}
      coverShadowLite={coverShadowLite}
      useLiteCoverShadow={useLiteCoverShadow}
      arrangement={arrangement}
      gapPx={effGap}
      total={slice.length}
      navigate={navigate}
      variant={variant}
      gridUseCssGap={gridUseCssGap}
      fanZOrder={fanZOrder}
      gridRotationSeed={gridRotationSeed}
      fanSpreadPx={fanSpreadPx}
      priorityImageLoading={priorityImageLoading}
    />
  ));

  /* Rezerva nad řadou pro bobánky (absolute); jen uvnitř bloku obálek — ne posun celého slidu. */
  const padTopGrid = variant === 'catalog' ? 'pt-12 pb-0.5 md:pt-14' : 'pt-7 pb-0.5 md:pt-8';
  const padTopFan = variant === 'catalog' ? 'pt-14 pb-1 md:pt-16 md:pb-1' : 'pt-9 pb-1 md:pt-10';
  const padTopRow = variant === 'catalog' ? 'pt-12 pb-1 md:pt-14' : 'pt-8 pb-1 md:pt-9';

  if (arrangement === 'grid' && gapPx >= 0) {
    return catalogWrap(
      <div
        className={`mx-auto grid w-max max-w-full grid-cols-3 justify-items-center overflow-visible px-0.5 ${padTopGrid}`}
        style={{ gap: `${effGap}px` }}
      >
        {tiles}
      </div>,
    );
  }

  if (arrangement === 'grid') {
    return catalogWrap(
      <div className={`mx-auto grid w-max max-w-full grid-cols-3 justify-items-center overflow-visible px-0.5 ${padTopGrid}`}>
        {tiles}
      </div>,
    );
  }

  if (arrangement === 'fan') {
    return catalogWrap(
      <div className={`mx-auto flex min-h-[48px] w-max min-w-0 max-w-full flex-nowrap flex-row items-end justify-center overflow-visible px-1 ${padTopFan}`}>
        {tiles}
      </div>,
    );
  }

  return catalogWrap(
    <div className={`mx-auto flex max-w-full flex-row flex-wrap items-center justify-center overflow-visible px-1 ${padTopRow}`}>
      {tiles}
    </div>,
  );
}
