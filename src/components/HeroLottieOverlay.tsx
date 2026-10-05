import { useEffect, useRef, useState } from 'react';

/**
 * Lottie animace přes obrázek hero slidu (layout „left-image“, pole `heroLottie`).
 *
 * Obrázek slidu pod animací zůstává jako poster: ukáže se při načítání, bez JS
 * a u `prefers-reduced-motion`. Knihovna lottie-web se stahuje až tady (dynamický import),
 * takže hlavní balík webu nezvětšuje. Animace běží jen ve chvíli, kdy je slide vidět.
 */
export function HeroLottieOverlay({
  src,
  posXPct,
  posYPct,
}: {
  src: string;
  posXPct?: unknown;
  posYPct?: unknown;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !src) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let anim: { play: () => void; pause: () => void; destroy: () => void } | null = null;
    let visible = false;
    let io: IntersectionObserver | null = null;

    const sync = () => {
      if (!anim) return;
      if (visible && document.visibilityState === 'visible') anim.play();
      else anim.pause();
    };

    (async () => {
      try {
        const [{ default: lottie }, res] = await Promise.all([
          import('lottie-web/build/player/lottie_light'),
          fetch(src),
        ]);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !boxRef.current) return;
        anim = lottie.loadAnimation({
          container: boxRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: false,
          animationData: data,
          rendererSettings: { preserveAspectRatio: lottieAspect(posXPct, posYPct), progressiveLoad: false },
        });
        (anim as any).addEventListener?.('DOMLoaded', () => {
          if (cancelled) return;
          setReady(true);
          sync();
        });
        io = new IntersectionObserver(
          (entries) => {
            visible = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.2);
            sync();
          },
          { threshold: [0, 0.2, 0.6] },
        );
        io.observe(boxRef.current);
        document.addEventListener('visibilitychange', sync);
      } catch {
        /* animace je jen bonus — při chybě zůstane obrázek */
      }
    })();

    return () => {
      cancelled = true;
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      anim?.destroy();
    };
  }, [src, posXPct, posYPct]);

  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full transition-opacity duration-300"
      style={{ opacity: ready ? 1 : 0 }}
    />
  );
}

/** Ekvivalent `object-fit: cover` + `object-position` pro SVG Lottie (zarovnání po třetinách). */
function lottieAspect(posXRaw: unknown, posYRaw: unknown): string {
  const pick = (raw: unknown, axis: 'x' | 'y') => {
    const n = typeof raw === 'number' ? raw : Number(raw);
    const v = Number.isFinite(n) ? n : 50;
    const part = v < 34 ? 'Min' : v > 66 ? 'Max' : 'Mid';
    return `${axis}${part}`;
  };
  return `${pick(posXRaw, 'x')}${pick(posYRaw, 'y').replace('y', 'Y')} slice`;
}
