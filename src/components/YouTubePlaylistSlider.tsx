import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, ExternalLink, Loader2, Play, X } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { getYoutubeThumbnail } from './DvppVideoCard';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COOPER = "'Cooper Light', serif";
const SCROLL_ROW =
  'flex gap-5 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory md:snap-none';
const TILE_W = 'snap-center shrink-0 w-[min(100%,300px)]';

export interface YoutubePlaylistVideo {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  published: string;
}

interface YouTubePlaylistSliderProps {
  /** Statický seznam — bez volání API */
  videos?: YoutubePlaylistVideo[];
  playlistId?: string;
  playlistUrl?: string;
  /** Volitelný nadpis — jinak název z YouTube */
  heading?: string;
  subheading?: string;
  eyebrow?: string;
  className?: string;
  /** Záložní seznam videí při nedostupnosti API */
  fallbackVideos?: YoutubePlaylistVideo[];
  linkLabel?: string;
}

export function YouTubePlaylistSlider({
  videos: staticVideos,
  playlistId,
  playlistUrl,
  heading,
  subheading,
  eyebrow = 'Více o metodice a výuce',
  className = '',
  fallbackVideos,
  linkLabel = 'Celý playlist',
}: YouTubePlaylistSliderProps) {
  const isStatic = Boolean(staticVideos?.length);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [videos, setVideos] = useState<YoutubePlaylistVideo[]>(staticVideos ?? []);
  const [loading, setLoading] = useState(!isStatic);
  const [error, setError] = useState('');
  const [activeVideo, setActiveVideo] = useState<YoutubePlaylistVideo | null>(null);

  useEffect(() => {
    if (isStatic) {
      setVideos(staticVideos ?? []);
      setLoading(false);
      setError('');
      return;
    }
    if (!playlistId) {
      setVideos(fallbackVideos ?? []);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${SERVER}/public/youtube-playlist?playlistId=${encodeURIComponent(playlistId)}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          title?: string;
          videos?: YoutubePlaylistVideo[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Nepodařilo se načíst playlist');
        if (cancelled) return;
        setPlaylistTitle(typeof data.title === 'string' ? data.title : '');
        setVideos(Array.isArray(data.videos) ? data.videos : []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (fallbackVideos?.length) {
          setPlaylistTitle('');
          setVideos(fallbackVideos);
          setError('');
        } else {
          setError(err instanceof Error ? err.message : 'Nepodařilo se načíst videa');
          setVideos([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playlistId, isStatic, staticVideos, fallbackVideos]);

  const displayHeading = heading || playlistTitle || 'Metodická videa';

  return (
    <>
      <div className={`rounded-[22px] border border-[#001161]/10 bg-white p-5 md:p-6 ${className}`}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#001161]/38" style={FF}>
              {eyebrow}
            </p>
            <h3 className="mt-1 text-[20px] font-bold leading-snug text-[#001161] md:text-[22px]" style={{ fontFamily: COOPER }}>
              {displayHeading}
            </h3>
            {subheading ? (
              <p className="mt-1 text-[14px] text-[#001161]/60" style={FF}>
                {subheading}
              </p>
            ) : null}
            {!loading && videos.length > 0 ? (
              <p className="mt-2 text-[12px] font-semibold text-[#001161]/45" style={FF}>
                {videos.length} {videos.length === 1 ? 'video' : videos.length < 5 ? 'videa' : 'videí'} — posuňte do strany pro další
              </p>
            ) : null}
          </div>
          {playlistUrl ? (
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-[#7C3AED] transition hover:text-[#5B21B6]"
              style={FF}
            >
              {linkLabel}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[#001161]/40">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-[14px]" style={FF}>
              Načítám videa…
            </span>
          </div>
        ) : null}

        {!loading && error && playlistUrl ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
            <p className="text-[14px] text-red-700" style={FF}>
              {error}
            </p>
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#7C3AED]"
              style={FF}
            >
              Otevřít playlist na YouTube
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        ) : null}

        {!loading && !error && videos.length > 0 ? (
          <div className={SCROLL_ROW} style={{ scrollbarWidth: 'thin' }}>
            {videos.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => setActiveVideo(video)}
                className={`group ${TILE_W} cursor-pointer text-left`}
              >
                <div className="relative mb-3 aspect-video overflow-hidden rounded-[16px] bg-[#DEE4F1] shadow-[0_2px_12px_rgba(0,17,97,0.08)]">
                  <ImageWithFallback
                    src={video.thumbnail || getYoutubeThumbnail(video.id)}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-[#001161]/0 transition-colors group-hover:bg-[#001161]/20">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white opacity-90 shadow-lg transition group-hover:scale-105">
                      <Play className="h-5 w-5 fill-current" aria-hidden />
                    </span>
                  </div>
                </div>
                <p className="line-clamp-2 px-0.5 text-[14px] font-bold leading-snug text-[#001161]" style={FF}>
                  {video.title}
                </p>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {activeVideo ? (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={activeVideo.title}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveVideo(null)}
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
                    <span className="line-clamp-2 text-[14px] font-bold" style={FF}>
                      {activeVideo.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveVideo(null)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                      aria-label="Zavřít video"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="relative aspect-video w-full bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${activeVideo.id}?rel=0&modestbranding=1&autoplay=1`}
                      className="absolute inset-0 h-full w-full border-0"
                      title={activeVideo.title}
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
    </>
  );
}
