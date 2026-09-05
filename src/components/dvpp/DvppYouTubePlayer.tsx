/**
 * Přehrávač záznamu přes YouTube IFrame API: přesná pozice, obnovení pozice, volitelný limit (upoutávka
 * pro nepřihlášené: prvních N sekund) a callback po dokončení.
 */
import React, { useEffect, useRef } from 'react';

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  pauseVideo: () => void;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};

declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function DvppYouTubePlayer({
  videoId,
  startSeconds = 0,
  limitSeconds,
  onProgress,
  onLimitReached,
  onEnded,
  autoplay = true,
}: {
  videoId: string;
  startSeconds?: number;
  /** Upoutávka: po tolika sekundách přehrávání zastavit a zavolat onLimitReached. */
  limitSeconds?: number | null;
  /** Každých ~5 s během přehrávání: aktuální pozice a délka. */
  onProgress?: (position: number, duration: number) => void;
  onLimitReached?: () => void;
  onEnded?: () => void;
  autoplay?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const timerRef = useRef<number | null>(null);
  const limitHit = useRef(false);
  const cbs = useRef({ onProgress, onLimitReached, onEnded });
  cbs.current = { onProgress, onLimitReached, onEnded };

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement('div');
    host.appendChild(mount);
    limitHit.current = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, autoplay: autoplay ? 1 : 0, start: Math.max(0, Math.floor(startSeconds)), playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) {
              if (timerRef.current) window.clearInterval(timerRef.current);
              timerRef.current = window.setInterval(() => {
                const p = playerRef.current;
                if (!p) return;
                const pos = p.getCurrentTime();
                const dur = p.getDuration();
                cbs.current.onProgress?.(pos, dur);
                if (limitSeconds && pos >= limitSeconds && !limitHit.current) {
                  limitHit.current = true;
                  p.pauseVideo();
                  cbs.current.onLimitReached?.();
                }
              }, 5000);
            } else {
              if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
              if (e.data === YT.PlayerState.ENDED) cbs.current.onEnded?.();
            }
          },
        },
      });
    }).catch(() => { /* API se nenačetlo — fallback níže */ });

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      host.innerHTML = '';
    };
  }, [videoId]);

  return (
    <div ref={hostRef} className="absolute inset-0 [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full">
      <noscript>
        <iframe title="Záznam" src={`https://www.youtube.com/embed/${videoId}?rel=0&start=${Math.floor(startSeconds)}`} className="h-full w-full" allowFullScreen />
      </noscript>
    </div>
  );
}
