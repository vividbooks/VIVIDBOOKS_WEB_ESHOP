import React from 'react';
import type { CSSProperties } from 'react';
import {
  clampHeroTitleLineHeightPct,
  clampHeroTitleSizePct,
  heroFanWordStyle,
  heroMainHeadingClassName,
  heroMainHeadingStyle,
  heroPillHighlightStyle,
  heroPlayfulWordDeg,
  heroTitleWordCount,
  mergeHeroUnderlineRanges,
  normalizeTitlePlayfulSeed,
  type HeroHeadingPreset,
  type HeroTitleTiltMode,
} from '../data/heroSlides';

type Segment = { text: string; highlighted: boolean };

function titleSegments(title: string, mergedRanges: [number, number][]): Segment[] {
  if (!mergedRanges.length) return [{ text: title, highlighted: false }];
  const segs: Segment[] = [];
  let c = 0;
  for (const [a, b] of mergedRanges) {
    if (a > c) segs.push({ text: title.slice(c, a), highlighted: false });
    segs.push({ text: title.slice(a, b), highlighted: true });
    c = b;
  }
  if (c < title.length) segs.push({ text: title.slice(c), highlighted: false });
  return segs;
}

function renderWordPerWordSegment(
  mode: 'playful' | 'fan',
  text: string,
  highlighted: boolean,
  wordIndex: { i: number },
  totalWords: number,
  playfulSeed: number,
  pillHex: string | undefined,
  textAccentHex: string | undefined,
  pillTextHex: string | undefined,
  keyBase: string,
): React.ReactNode[] {
  const parts = text.split(/(\s+)/);
  const out: React.ReactNode[] = [];
  parts.forEach((part, j) => {
    if (/^\s+$/.test(part)) {
      out.push(part);
      return;
    }
    const wi = wordIndex.i;
    wordIndex.i += 1;
    const style: CSSProperties =
      mode === 'fan'
        ? {
            display: 'inline-block',
            ...heroFanWordStyle(wi, totalWords, playfulSeed),
            padding: '0.12em 0.1em',
            margin: '0 0.02em',
            overflow: 'visible',
            verticalAlign: 'baseline',
          }
        : {
            display: 'inline-block',
            transform: `rotate(${heroPlayfulWordDeg(playfulSeed, wi)}deg)`,
            transformOrigin: '50% 50%',
            padding: '0.2em 0.12em',
            margin: '0 0.02em',
            overflow: 'visible',
            verticalAlign: 'baseline',
          };
    const inner = highlighted ? (
      <span style={heroPillHighlightStyle(pillHex, textAccentHex, pillTextHex)}>{part}</span>
    ) : (
      part
    );
    out.push(
      <span key={`${keyBase}-${j}`} style={style}>
        {inner}
      </span>,
    );
  });
  return out;
}

function renderLinearSegment(
  text: string,
  highlighted: boolean,
  pillHex: string | undefined,
  textAccentHex: string | undefined,
  pillTextHex: string | undefined,
): React.ReactNode {
  if (!highlighted) return text;
  return <span style={heroPillHighlightStyle(pillHex, textAccentHex, pillTextHex)}>{text}</span>;
}

export function HeroSlideTitleText({
  title,
  titleUnderlineRanges,
  titleTiltMode = 'none',
  titleTiltDeg,
  titlePlayfulSeed = 0,
  titleLineHeightPct,
  slide,
  preset,
  className,
  accentHex,
  pillHighlightHex,
  pillHighlightTextHex,
  /** Násobek velikosti z clamp() nadpisu (např. 0.7 u „produkty pod“). */
  headingFontScale = 1,
}: {
  title?: string;
  titleUnderlineRanges?: [number, number][];
  titleTiltMode?: HeroTitleTiltMode;
  titleTiltDeg?: number;
  /** Seed pro hravý náklon / vějíř (0 = deterministická výchozí varianta). */
  titlePlayfulSeed?: number;
  /** Řádkový proklad nadpisu (92–155 % → line-height 0.92–1.55), výchozí 108. */
  titleLineHeightPct?: number;
  slide: { title?: string; titleFont?: unknown; heroTitleSizePct?: unknown };
  preset: HeroHeadingPreset;
  className: string;
  /** Barva textu slidu — záloha pro pill, když není vlastní barva pill. */
  accentHex?: string;
  /** Vlastní barva pozadí pill (HEX). Prázdné = podle barvy textu. */
  pillHighlightHex?: string;
  /** Barva textu uvnitř pill (HEX). Prázdné = dědí z nadpisu. */
  pillHighlightTextHex?: string;
  headingFontScale?: number;
}) {
  const t = title || '';
  const merged = mergeHeroUnderlineRanges(t.length, titleUnderlineRanges);
  const mode = titleTiltMode;
  const tiltN = typeof titleTiltDeg === 'number' ? titleTiltDeg : undefined;
  const uniformTilt =
    mode === 'uniform' && tiltN != null && tiltN !== 0
      ? ({
          transform: `rotate(${tiltN}deg)`,
          transformOrigin: '0.15em 50%',
          paddingTop: '0.14em',
          paddingBottom: '0.14em',
        } as CSSProperties)
      : {};
  const lh = clampHeroTitleLineHeightPct(titleLineHeightPct) / 100;
  const titleSizePct = clampHeroTitleSizePct(slide.heroTitleSizePct);
  const layoutScale = headingFontScale ?? 1;
  const combinedFontScale = layoutScale * (titleSizePct / 100);
  /** Mobilní WebKit: vlastní fonty uvnitř rodičů s `transform` (slider) — vlastní vrstva + antialiasing. */
  const fontLayerFix: CSSProperties = {
    WebkitFontSmoothing: 'antialiased',
    transform: uniformTilt.transform
      ? `${uniformTilt.transform} translateZ(0.02px)`
      : 'translateZ(0.02px)',
    WebkitTransform: uniformTilt.transform
      ? `${uniformTilt.transform} translateZ(0.02px)`
      : 'translateZ(0.02px)',
  };
  const style: CSSProperties = {
    ...heroMainHeadingStyle(slide, preset, combinedFontScale),
    lineHeight: lh,
    ...uniformTilt,
    ...fontLayerFix,
  };

  const seed = normalizeTitlePlayfulSeed(titlePlayfulSeed);
  const totalWords = heroTitleWordCount(t);

  let children: React.ReactNode;
  if (mode === 'playful' || mode === 'fan') {
    const segs = titleSegments(t, merged);
    const wordIndex = { i: 0 };
    const nodes: React.ReactNode[] = [];
    segs.forEach((seg, si) => {
      nodes.push(
        ...renderWordPerWordSegment(
          mode,
          seg.text,
          seg.highlighted,
          wordIndex,
          totalWords,
          seed,
          pillHighlightHex,
          accentHex,
          pillHighlightTextHex,
          `s${si}`,
        ),
      );
    });
    children = nodes;
  } else if (!merged.length) {
    children = t;
  } else {
    const segs = titleSegments(t, merged);
    children = segs.map((seg, si) => (
      <React.Fragment key={si}>
        {renderLinearSegment(seg.text, seg.highlighted, pillHighlightHex, accentHex, pillHighlightTextHex)}
      </React.Fragment>
    ));
  }

  const extraVerticalRoom = mode === 'playful' || mode === 'fan' ? ' py-[0.35em]' : '';
  return (
    <h1
      className={`${heroMainHeadingClassName(slide, className)} max-w-full whitespace-pre-line break-words [overflow-wrap:anywhere] hyphens-auto overflow-visible${extraVerticalRoom}`}
      style={{ ...style, overflow: 'visible' }}
      title={t}
      lang="cs"
    >
      {children}
    </h1>
  );
}
