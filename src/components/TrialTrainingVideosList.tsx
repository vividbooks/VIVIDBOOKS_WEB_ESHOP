import React from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { TRIAL_TRAINING_VIDEOS, youtubeTrainingThumbnailUrl } from '../data/trialTrainingVideos';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

interface TrialTrainingVideosListProps {
  /** Např. TrialPage: `mt-6 border-t border-green-200/70 pt-6` */
  sectionClassName?: string;
  /** Menší typografie (např. pod webinářem) */
  compact?: boolean;
}

export function TrialTrainingVideosList({ sectionClassName, compact }: TrialTrainingVideosListProps) {
  return (
    <div className={sectionClassName ?? 'mt-6 border-t border-green-200/70 pt-6 text-left'}>
      <p
        style={FF}
        className={`mb-3 text-center font-bold uppercase tracking-wide text-[#001161]/45 ${compact ? 'text-[11px]' : 'text-[12px]'}`}
      >
        {'Mini\u0161kolen\u00ed'}
      </p>
      <ul className="space-y-3">
        {TRIAL_TRAINING_VIDEOS.map((video) => (
          <li key={video.videoId}>
            <a
              href={video.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3 rounded-xl border border-[#001161]/10 bg-white/90 p-3 shadow-sm transition-colors hover:border-[#7C3AED]/35 hover:bg-white sm:flex-row sm:items-stretch sm:gap-4 sm:p-4"
              style={FF}
            >
              <div
                className={`relative shrink-0 overflow-hidden rounded-xl bg-[#001161]/8 ${compact ? 'aspect-video w-full sm:w-[140px]' : 'aspect-video w-full sm:w-[168px]'}`}
              >
                <ImageWithFallback
                  src={youtubeTrainingThumbnailUrl(video.videoId)}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#001161]/25 opacity-90 transition-opacity group-hover:bg-[#001161]/35"
                  aria-hidden
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
                    <Play className="h-5 w-5 fill-current" />
                  </span>
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p
                  className={`font-bold leading-snug text-[#001161] ${compact ? 'text-[14px]' : 'text-[15px]'}`}
                >
                  {video.title}
                </p>
                <p
                  className={`mt-1.5 leading-relaxed text-[#001161]/70 ${compact ? 'text-[12px]' : 'text-[13px]'}`}
                >
                  {video.description}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#7C3AED]">
                  {'P\u0159ehr\u00e1t na YouTube'}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
