import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/* ─── Per-subject configuration ─────────────────────────────── */
const SUBJECT_DATA: Record<string, {
  workbookCardBg: string;
  extendedFeatures: string[];
  basicFeatures: string[];
  digitalTag: string;
  pracovniSubtitle?: string;
}> = {
  'Fyzika': {
    workbookCardBg: '#6e6520',
    extendedFeatures: [
      'Učební text',
      'Pracovní listy',
      'Lekce s animacemi',
      'Metodická inspirace',
      'Testy, písemky a procvičování',
      'Soutěžní kvízy',
      'Experimenty a úlohy',
      'Tvorba vlastních interaktivních materiálů',
    ],
    basicFeatures: [
      'Učební text',
      'Pracovní listy',
      'Metodická inspirace',
      'Volné listy pro zápis',
    ],
    digitalTag: 'Vše s možností editace a tisku',
  },
  'Přírodopis': {
    workbookCardBg: '#1a6b4a',
    extendedFeatures: [
      'Učební text',
      'Pracovní listy a badatelské listy',
      'Lekce s vizuáliemi a aktivitami',
      'Metodická inspirace',
      'Testy, písemky a procvičování',
      'Soutěžní kvízy',
      '3D modely',
      'Tvorba vlastních interaktivních materiálů',
    ],
    basicFeatures: [
      'Učební text',
      'Pracovní listy a badatelské listy',
      'Metodická inspirace',
      'Volné listy pro zápis',
    ],
    digitalTag: 'Vše na jednom místě',
  },
  'Chemie': {
    workbookCardBg: '#3d4f65',
    extendedFeatures: [
      'Učební text',
      'Pracovní a badatelské listy',
      'Lekce s animacemi a aktivitami',
      'Metodická inspirace',
      'Testy, písemky a procvičování',
      'Soutěžní kvízy',
      'Tvorba vlastních interaktivních materiálů',
    ],
    basicFeatures: [
      'Učební text',
      'Pracovní a badatelské listy',
      'Metodická inspirace',
      'Volné listy pro zápis',
    ],
    digitalTag: 'Vše pro Chemii na jednom místě',
  },
};

interface DigitalAccessComparisonProps {
  subject: string;
  workbooks: any[];     // array of { id, image, name }
  onOrder?: () => void;
  compact?: boolean;    // true = smaller padding, used in ProductDetailPage
}

export function DigitalAccessComparison({ subject, workbooks, onOrder, compact = false }: DigitalAccessComparisonProps) {
  const cfg = SUBJECT_DATA[subject];
  if (!cfg) return null;

  const pad = compact ? 'px-5 py-6' : 'p-7';
  const titleSize = compact ? 'text-[22px]' : 'text-[26px]';
  const subtitleSize = compact ? 'text-[13px]' : 'text-[14px]';
  const featureSize = compact ? 'text-[13px]' : 'text-[14px]';
  const coverH = compact ? '120px' : '150px';
  const coverW = compact ? '68px' : '84px';

  /* stacked book covers */
  const maxBooks = compact ? 4 : 4;
  const books = workbooks.slice(0, maxBooks);
  const offsets = [-52, -18, 16, 50];
  const rotations = [-8, -3, 3, 8];
  const zIndexes = [1, 3, 4, 2];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${compact ? '' : ''}`}>

      {/* ── LEFT: Digitální učebnice (Rozšířený přístup) ── */}
      <div className={`bg-white border border-gray-100 rounded-[28px] ${pad} flex flex-col shadow-sm`}>
        {/* Header */}
        <h3
          className={`text-[#001161] ${titleSize} leading-tight text-center mb-1`}
          style={{ fontFamily: "'Cooper Light', serif" }}
        >
          {'Digitální učebnice'}
        </h3>
        <p
          className={`text-[#001161]/55 ${subtitleSize} text-center mb-5`}
          style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
        >
          {'Rozšířený digitální přístup'}
        </p>

        {/* App preview illustration */}
        <div
          className="relative mx-auto mb-4 rounded-[14px] overflow-hidden border border-[#001161]/8 bg-gradient-to-br from-[#f5f7ff] to-[#eef1fb] flex flex-col items-center justify-center"
          style={{ width: '100%', height: compact ? '110px' : '140px' }}
        >
          {/* Fake screen */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <svg viewBox="0 0 200 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="10" width="180" height="80" rx="8" stroke="#001161" strokeWidth="1.5"/>
              <rect x="20" y="20" width="100" height="8" rx="4" fill="#001161"/>
              <rect x="20" y="35" width="140" height="6" rx="3" fill="#001161" opacity="0.5"/>
              <rect x="20" y="47" width="120" height="6" rx="3" fill="#001161" opacity="0.35"/>
              <rect x="20" y="59" width="130" height="6" rx="3" fill="#001161" opacity="0.25"/>
              <circle cx="155" cy="55" r="18" stroke="#7C3AED" strokeWidth="1.5" opacity="0.7"/>
              <polygon points="150,47 150,63 166,55" fill="#7C3AED" opacity="0.7"/>
            </svg>
          </div>
          {/* Play badge */}
          <div className="relative flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/25 flex items-center justify-center">
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                <polygon points="5,3 5,13 13,8" fill="#7C3AED"/>
              </svg>
            </div>
          </div>
          {/* Tag */}
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#f5e6ff] border border-[#7C3AED]/20 text-[#7C3AED] text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {cfg.digitalTag}
          </div>
        </div>

        {/* Features */}
        <ul className="flex flex-col gap-1.5 mb-6 flex-1">
          {cfg.extendedFeatures.map((item, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 text-[#001161] ${featureSize}`}
              style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
            >
              <span className="text-[#22c55e] mt-0.5 shrink-0 text-[15px]">✅</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <a
            href="https://app.vividbooks.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#001161] text-[13px] underline underline-offset-2 hover:text-[#FF6B1A] transition-colors"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {'Více'}
          </a>
          {onOrder && (
            <button
              onClick={onOrder}
              className="text-[#001161] text-[13px] underline underline-offset-2 hover:text-[#FF6B1A] transition-colors cursor-pointer"
              style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
            >
              {'Zjistit cenu pro vaši školu'}
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT: Pracovní sešity (Základní přístup) ── */}
      <div
        className={`rounded-[28px] ${pad} flex flex-col`}
        style={{ backgroundColor: cfg.workbookCardBg }}
      >
        {/* Header */}
        <h3
          className={`text-white ${titleSize} leading-tight text-center mb-1`}
          style={{ fontFamily: "'Cooper Light', serif" }}
        >
          {'Pracovní sešity'}
        </h3>
        <p
          className={`text-white/65 ${subtitleSize} text-center mb-5`}
          style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
        >
          {'Základní digitální přístup (od\u00a015\u00a0ks)'}
        </p>

        {/* Book covers */}
        <div
          className="relative flex items-end justify-center mb-5 w-full"
          style={{ height: coverH }}
        >
          {books.length > 0 ? (
            books.map((book: any, i: number) => (
              <div
                key={book.id}
                className="absolute bottom-0"
                style={{
                  transform: `translateX(${offsets[i] ?? 0}px) rotate(${rotations[i] ?? 0}deg)`,
                  zIndex: zIndexes[i] ?? i,
                  width: coverW,
                  height: compact ? '100px' : '130px',
                }}
              >
                <img
                  src={book.image}
                  alt={book.name}
                  className="w-full h-full object-contain max-md:drop-shadow-[0_4px_12px_rgba(0,0,0,0.22)] md:drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                />
              </div>
            ))
          ) : (
            <span className="text-5xl opacity-25">📚</span>
          )}
        </div>

        {/* Features */}
        <ul className="flex flex-col gap-1.5 mb-6 flex-1">
          {cfg.basicFeatures.map((item, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 text-white ${featureSize}`}
              style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
            >
              <span className="text-[#a3e635] mt-0.5 shrink-0 text-[15px]">✅</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/20">
          <a
            href="https://app.vividbooks.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/80 text-[13px] underline underline-offset-2 hover:text-white transition-colors"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {'Více'}
          </a>
          <span
            className="text-white text-[13px] font-bold"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {'125,–\u00a0/\u00a0pracovní sešit'}
          </span>
        </div>
      </div>
    </div>
  );
}

export const COMPARISON_SUBJECTS = ['Fyzika', 'Chemie', 'Přírodopis'];
