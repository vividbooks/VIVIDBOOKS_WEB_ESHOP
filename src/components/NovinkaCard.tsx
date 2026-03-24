import React from 'react';
import { useNavigate } from 'react-router';
import type { NovinkaPost } from '../data/novinkaPosts';

interface NovinkaCardProps {
  post: NovinkaPost;
}

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length !== 6) return 200;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

export function NovinkaCard({ post }: NovinkaCardProps) {
  const navigate = useNavigate();

  const hasCoverImage = !!post.coverImage;
  const tileBg = post.bgColor ?? '#F0F2F8';

  const lum = luminance(tileBg);
  const isDark = lum < 140;
  const titleColor = isDark ? '#ffffff' : '#001161';
  // Slightly darker/lighter strip for the bottom section
  const stripBg = tileBg; // same colour as the card bg — as the user requested

  return (
    <article
      className="cursor-pointer group"
      onClick={() => navigate(`/novinky/${post.slug}`)}
    >
      {/* ── Single card wrapper — all rounded ─────────────────────── */}
      <div
        className="overflow-hidden rounded-[22px] shadow-sm transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-lg"
      >
        {/* ── Visual area (4:3) ──────────────────────────────────── */}
        <div
          className="relative"
          style={{ aspectRatio: '4 / 3', background: tileBg }}
        >
          {/* Cover image */}
          {hasCoverImage && (
            <img
              src={post.coverImage}
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Large accent text (e.g. "10 %") — only when no cover image */}
          {post.tileText && !hasCoverImage && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <span
                className="font-['Cooper_Light',serif] leading-none text-center whitespace-pre-line"
                style={{
                  color: titleColor,
                  fontSize: 'clamp(38px, 8vw, 84px)',
                  opacity: 0.95,
                }}
              >
                {post.tileText}
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-300" />
        </div>

        {/* ── Title strip — bgColor from JSON ───────────────────── */}
        <div
          className="px-5 py-4"
          style={{ background: stripBg }}
        >
          <p
            className="font-['Fenomen_Sans',sans-serif] font-bold text-[14px] md:text-[15px] leading-snug line-clamp-2"
            style={{ color: titleColor }}
          >
            {post.title}
          </p>
        </div>
      </div>
    </article>
  );
}
