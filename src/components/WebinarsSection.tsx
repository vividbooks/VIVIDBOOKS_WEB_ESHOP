import React from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarCard } from './WebinarCard';

export function WebinarsSection() {
  const navigate = useNavigate();
  const { upcoming, past, loading } = useWebinars();

  // Zobraz max 3 — nejprve nadchazejici, jinak posledni minule
  const displayed = upcoming.length > 0
    ? upcoming.slice(0, 3)
    : past.slice(0, 3);

  return (
    <section className="px-4 md:px-8 py-10 border-t border-[#001161]/6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF9900] shrink-0 shadow-[0_1px_4px_rgba(255,153,0,0.5)]" />
        <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[36px] xl:text-[41px] leading-tight">
          {'Nadch\u00e1zej\u00edc\u00ed webin\u00e1\u0159e'}
        </h2>
        <div className="flex-1 h-px bg-[#001161]/8 hidden md:block" />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-[#001161]/40">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-['Fenomen_Sans',sans-serif] text-[14px]">{'Na\u010d\u00edt\u00e1m...'}</span>
        </div>
      )}

      {/* Cards grid */}
      {!loading && displayed.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-7">
          {displayed.map(w => (
            <WebinarCard key={w.id} webinar={w} />
          ))}
        </div>
      )}

      {/* All webinars button */}
      {!loading && (
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/webinare')}
            className="font-['Fenomen_Sans',sans-serif] font-bold text-[15px] text-white bg-[#5B4FD8] hover:bg-[#4a3ec7] px-8 py-3 rounded-full transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer shadow-[0_4px_18px_rgba(91,79,216,0.30)]"
          >
            {'V\u0161echny webin\u00e1\u0159e'}
          </button>
        </div>
      )}
    </section>
  );
}