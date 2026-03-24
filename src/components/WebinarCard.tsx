import React from 'react';
import { useNavigate } from 'react-router';
import type { Webinar } from '../data/webinars';
import { WebinarThumbnail } from './WebinarThumbnail';

interface WebinarCardProps {
  webinar: Webinar;
}

export function WebinarCard({ webinar }: WebinarCardProps) {
  const navigate = useNavigate();

  const goToDetail = () => navigate(`/webinar/${webinar.slug || webinar.id}`);

  return (
    <div
      className="bg-[#F0F2F8] rounded-[20px] overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex flex-col"
      style={{ minWidth: 0 }}
    >
      {/* Thumbnail */}
      <div className="overflow-hidden" onClick={goToDetail}>
        <WebinarThumbnail
          title={webinar.title}
          subtitle={webinar.subtitle}
          day={webinar.day}
          monthName={webinar.monthName}
          time={webinar.time}
          lecturer={webinar.lecturer}
          lecturerAvatar={webinar.lecturerAvatar}
          variant={webinar.thumbnailVariant}
          coverImage={webinar.coverImage}
        />
      </div>

      {/* Bottom info bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/0">
        {/* Date badge */}
        <div className="shrink-0 flex flex-col items-center bg-white rounded-[10px] px-2.5 py-1.5 min-w-[46px]">
          <span
            className="font-['Fenomen_Sans',sans-serif] font-black text-[#001158] text-[18px] leading-none"
          >
            {webinar.day}
          </span>
          <span className="font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001158]/60 leading-tight">
            {webinar.monthName}
          </span>
          <span
            className="font-['Fenomen_Sans',sans-serif] font-bold text-[11px] leading-none mt-0.5"
            style={{ color: '#FF8C00' }}
          >
            {webinar.time}
          </span>
        </div>

        {/* Title */}
        <p
          className="font-['Fenomen_Sans',sans-serif] text-[#001158] text-[13px] font-semibold leading-snug flex-1 line-clamp-2 cursor-pointer hover:opacity-75 transition-opacity"
          onClick={goToDetail}
        >
          {webinar.title}
        </p>

        {/* CTA button */}
        <button
          onClick={goToDetail}
          className="shrink-0 bg-[#FF8C00] hover:bg-[#e67d00] text-white font-['Fenomen_Sans',sans-serif] font-bold text-[12px] px-3.5 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
        >
          {webinar.isPast ? 'Z\u00e1znam' : 'P\u0159ihl\u00e1sit se'}
        </button>
      </div>
    </div>
  );
}