/**
 * Karta záznamu na landing dvppzdarma.cz — stejný vzhled jako karty webinářů na homepage
 * (`SubjectHowToWebinarsSection`): obrázek webináře na podkladu v jeho barvě, lišta s datem a tlačítkem.
 */
import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import type { DvppVideo } from '../contexts/DvppVideosContext';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { extractYoutubeId } from '../utils/youtube';
export { extractYoutubeId };

const ff = "'Fenomen Sans', sans-serif";

export function getYoutubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

const WASH_BY_TOPIC: Array<[RegExp, string]> = [
  [/matematika 1|1\. stup/i, '#5386FF'], [/matemat/i, '#CEDCFF'], [/fyzik/i, '#F8F3E2'], [/přírodopis|prirodopis/i, '#98FFDE'],
  [/prvouk/i, '#177E5D'], [/chemi/i, '#FFEC99'], [/česk|cesk|písmo/i, '#FFE4E6'], [/\bai\b|umělá|umela/i, '#EFE3FF'],
  [/vividboard/i, '#DCEBFF'], [/vedení|vedeni|ředitel/i, '#D8F3E6'], [/švp|svp|rvp/i, '#E8ECF7'],
];
const WASH_FALLBACK = ['#CEDCFF', '#F8F3E2', '#98FFDE', '#FFEC99', '#EFE3FF', '#FFE4E6'];

export function dvppCardWash(video: Pick<DvppVideo, 'id' | 'name' | 'coverBg'>): string {
  if (video.coverBg && /^#[0-9a-f]{6}$/i.test(video.coverBg)) return video.coverBg;
  for (const [re, c] of WASH_BY_TOPIC) if (re.test(video.name)) return c;
  let h = 0;
  for (const ch of video.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return WASH_FALLBACK[h % WASH_FALLBACK.length];
}

function washIsDark(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 150;
}

function airedLabel(airedAt?: string): string | null {
  const m = airedAt ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(airedAt) : null;
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : null;
}

export function DvppVideoCard({ video, onClick }: { video: DvppVideo; onClick: () => void }) {
  const ytId = extractYoutubeId(video.youtubeUrl);
  const thumbSrc = video.thumbnail || (ytId ? getYoutubeThumbnail(ytId) : '');
  const wash = dvppCardWash(video);
  const onDark = washIsDark(wash);
  const meta = [airedLabel(video.airedAt) || 'Záznam', video.durationMinutes ? `${video.durationMinutes} min` : null].filter(Boolean).join(' · ');

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-[20px] text-left shadow-[0_2px_12px_rgba(0,17,97,0.10)]"
      style={{ background: wash, fontFamily: ff }}
      onClick={onClick}
      aria-label={video.name}
    >
      <div className="relative aspect-video overflow-hidden" style={{ background: wash }}>
        {thumbSrc ? (
          <ImageWithFallback src={thumbSrc} alt={video.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-end px-4 py-3.5">
            <span className={`text-[20px] font-bold leading-tight ${onDark ? 'text-white' : 'text-[#001161]'}`}>{video.name}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <span className={`truncate text-[12px] font-bold ${onDark ? 'text-white/90' : 'text-[#001161]/65'}`}>{meta}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#001161] px-3 py-1.5 text-[12px] font-bold text-white transition-colors group-hover:bg-[#5B4FD8]">
          <Play className="h-3 w-3" fill="currentColor" /> Záznam
        </span>
      </div>
    </motion.button>
  );
}
