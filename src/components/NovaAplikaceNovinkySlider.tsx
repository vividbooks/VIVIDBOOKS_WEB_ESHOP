import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { NOVA_APLIKACE_NOVINKY } from '../data/novaAplikaceNovinky';

const ff = "'Fenomen Sans', sans-serif";
const AUTOPLAY_MS = 7000;

/**
 * Slider novinek nové aplikace — stejná podoba jako na úvodu knihovny v nové
 * aplikaci. Odkazy míří do nového tabu, protože stránka běží v iframu staré
 * aplikace.
 */
export function NovaAplikaceNovinkySlider({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = NOVA_APLIKACE_NOVINKY.length;
  const slide = NOVA_APLIKACE_NOVINKY[index];

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [count, index, paused]);

  if (!slide) return null;

  const go = (step: number) => setIndex((i) => (i + step + count) % count);
  const href = `/novinky/${slide.slug}`;
  const arrowClass = 'absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center '
    + 'rounded-full bg-white text-[#001161] shadow-md ring-1 ring-[#001161]/10 transition-colors hover:bg-[#f4f6fb]';

  return (
    <div
      className={`mx-auto w-full max-w-[610px] ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Karta a odkaz pod ní jsou dva samostatné odkazy na týž článek, aby šipky
          nemusely být vnořené v odkazu. */}
      <div className="relative">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-[24px] shadow-sm transition-shadow hover:shadow-lg no-underline"
          style={{ backgroundColor: slide.color }}
        >
          <p
            className="px-14 pt-5 text-center text-[17px] font-bold leading-snug text-[#001161] md:text-[19px]"
            style={{ fontFamily: ff }}
          >
            {slide.title}
          </p>
          {/* `key` přinutí obrázek k remountu, aby se prolnutí přehrálo při každé změně slidu. */}
          <img
            key={slide.id}
            src={slide.image}
            alt=""
            width={1612}
            height={820}
            className="mt-4 block w-full"
          />
        </a>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Předchozí novinka"
              onClick={() => go(-1)}
              className={`${arrowClass} left-3`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Další novinka"
              onClick={() => go(1)}
              className={`${arrowClass} right-3`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 text-[14px] font-bold text-[#001161] hover:underline"
        style={{ fontFamily: ff }}
      >
        Dozvědět se více
        <ArrowRight className="h-4 w-4" />
      </a>

      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {NOVA_APLIKACE_NOVINKY.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.title}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-[#001161]' : 'w-2 bg-[#001161]/25 hover:bg-[#001161]/45'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
