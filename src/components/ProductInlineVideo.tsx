import React, { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { VideoControlBar, openVideoFullscreen } from './MathInteractiveIncluded';

/** Video na stránce produktu (pod listováním) — stejný vlastní přehrávač jako videa z aplikace u matematiky. */
export function ProductInlineVideo({ src, poster, title }: { src: string; poster?: string; title?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const play = () => { const el = ref.current; if (el) void el.play().catch(() => {}); };
  const toggle = () => { const el = ref.current; if (!el) return; if (el.paused) play(); else el.pause(); };

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-12" aria-label={title || 'Video'}>
      {title && (
        <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] md:text-[38px] leading-tight mb-6">
          {title}
        </h2>
      )}
      <div className="relative overflow-hidden rounded-[20px] bg-[#eef0f6]">
        <div className="relative">
          <video
            ref={ref}
            src={src}
            poster={poster || undefined}
            className="block aspect-video w-full cursor-pointer"
            playsInline
            preload="metadata"
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          />
          {!playing && (
            <button
              type="button"
              onClick={play}
              aria-label={title ? `Přehrát video: ${title}` : 'Přehrát video'}
              className="absolute inset-0 grid place-items-center cursor-pointer"
            >
              <span className="grid size-16 place-items-center rounded-full bg-[#5b4fd8] text-white shadow-[0_8px_24px_rgba(91,79,216,0.45)] transition-transform hover:scale-105 sm:size-20">
                <Play className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8" />
              </span>
            </button>
          )}
        </div>
        <VideoControlBar
          playing={playing}
          time={time}
          duration={duration}
          onToggle={toggle}
          onSeek={(t) => { const el = ref.current; if (el) { el.currentTime = t; setTime(t); } }}
          onFullscreen={() => openVideoFullscreen(ref.current)}
        />
      </div>
    </section>
  );
}
