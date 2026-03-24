import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import type { DvppVideo } from '../contexts/DvppVideosContext';
import { ImageWithFallback } from './figma/ImageWithFallback';

const ff = "'Fenomen Sans', sans-serif";

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export function getYoutubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function DvppVideoCard({ video, onClick }: { video: DvppVideo; onClick: () => void }) {
  const ytId = extractYoutubeId(video.youtubeUrl);
  const thumbSrc = video.thumbnail || (ytId ? getYoutubeThumbnail(ytId) : '');

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative rounded-[18px] overflow-hidden mb-3 bg-[#DEE4F1] aspect-video shadow-[0_2px_12px_rgba(0,17,97,0.10)]">
        {thumbSrc ? (
          <ImageWithFallback
            src={thumbSrc}
            alt={video.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#DEE4F1] to-[#c5cfe6]">
            <Play className="w-10 h-10 text-[#001161]/30" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors duration-300">
          <div className="w-14 h-14 rounded-full bg-white/90 shadow-lg flex items-center justify-center scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
            <Play className="w-6 h-6 text-[#001161] ml-0.5" fill="#001161" />
          </div>
        </div>
      </div>
      <p
        className="text-[#001161] text-[14px] md:text-[15px] font-bold leading-snug line-clamp-2 px-1"
        style={{ fontFamily: ff }}
      >
        {video.name}
      </p>
    </motion.div>
  );
}
