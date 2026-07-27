import React, { useCallback, useEffect, useRef, useState } from 'react';

export const HERO_APLIKACE_VIDEO = '/aplikace/hero.webm';
export const HERO_APLIKACE_POSTER = '/aplikace/hero-cards.png';
export const HERO_APLIKACE_PLAYBACK_RATE = 0.6;
/** Mírné přiblížení — ve videu/posteri jsou bílé okraje, v širokém slideru by jinak vidět. */
export const HERO_APLIKACE_CATALOG_COVER_SCALE = 1;

const coverMediaClass =
  'absolute inset-0 size-full object-cover object-center will-change-transform';

export function HeroAplikaceVideoBackground({
  video = HERO_APLIKACE_VIDEO,
  poster = HERO_APLIKACE_POSTER,
  playbackRate = HERO_APLIKACE_PLAYBACK_RATE,
  priority = false,
  coverScale = 1,
}: {
  video?: string;
  poster?: string;
  playbackRate?: number;
  priority?: boolean;
  /** >1 ořízne bílé okraje exportu (homepage slider). */
  coverScale?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const applyPlaybackRate = useCallback(() => {
    const el = videoRef.current;
    if (el) el.playbackRate = playbackRate;
  }, [playbackRate]);

  const coverStyle =
    coverScale > 1 ? ({ transform: `scale(${coverScale})` } satisfies React.CSSProperties) : undefined;

  if (reduceMotion) {
    return (
      <img
        src={poster}
        alt=""
        aria-hidden
        className={`${coverMediaClass} [image-rendering:-webkit-optimize-contrast]`}
        style={coverStyle}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      poster={poster}
      aria-hidden
      onLoadedMetadata={applyPlaybackRate}
      onPlay={applyPlaybackRate}
      className={coverMediaClass}
      style={coverStyle}
    >
      <source src={video} type="video/webm" />
    </video>
  );
}

/** Dvouřádkový nadpis jako na /aplikace — bílý text + pill s tmavým textem. */
export function HeroAplikaceVideoTitle({
  line1,
  line2,
  compact = false,
}: {
  line1: string;
  line2: string;
  compact?: boolean;
}) {
  const ff = "'Fenomen Sans', sans-serif";

  return (
    <h1 className="flex flex-col items-center gap-2.5 md:gap-4 text-center" style={{ fontFamily: ff }}>
      <span
        className={
          compact
            ? 'text-white text-[37px] sm:text-[46px] md:text-[58px] font-bold leading-[1.08] tracking-tight'
            : 'text-white text-[38px] sm:text-[52px] md:text-[68px] font-bold leading-[1.08] tracking-tight'
        }
      >
        {line1}
      </span>
      <span
        className={
          compact
            ? 'inline-block rounded-[17px] md:rounded-[20px] bg-white px-6 py-0.5 md:px-7 text-[#001161] text-[37px] sm:text-[46px] md:text-[58px] font-bold leading-[1.08] tracking-tight'
            : 'inline-block rounded-[14px] md:rounded-[18px] bg-white px-5 py-1 md:px-7 md:py-1.5 text-[#001161] text-[38px] sm:text-[52px] md:text-[68px] font-bold leading-[1.08] tracking-tight'
        }
      >
        {line2}
      </span>
    </h1>
  );
}
