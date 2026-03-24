import React, { useLayoutEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSubjectMethodPrinciples, type SubjectMethodPrinciple } from '../data/subjectMethodPrinciples';

const FF = "'Fenomen Sans', sans-serif";
const COOPER = "'Cooper Light', serif";
const SECTION_BG = '#f5f7fd';

/** Jednoduché ilustrace ve stylu metodického PDF — geometrické, barevné. */
function PrincipleVisual({ id }: { id: number }) {
  const v = id % 9;
  const cls = 'w-full max-w-[130px] h-[104px] mx-auto text-[#001161]';
  switch (v) {
    case 0:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <rect x="52" y="48" width="38" height="28" rx="4" fill="#DEE4F1" stroke="#001161" strokeWidth="1.5" />
          <circle cx="62" cy="58" r="6" fill="#E74C3C" />
          <circle cx="78" cy="62" r="5" fill="#E74C3C" />
          <circle cx="70" cy="68" r="5" fill="#E74C3C" />
          <ellipse cx="32" cy="58" rx="14" ry="22" fill="#F0F2F8" stroke="#001161" strokeWidth="1.5" />
          <circle cx="28" cy="52" r="8" fill="#F9C97C" stroke="#001161" strokeWidth="1.2" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <rect x="38" y="62" width="24" height="16" rx="3" fill="#5B7FD1" stroke="#001161" strokeWidth="1.2" />
          <path d="M50 62 V48" stroke="#001161" strokeWidth="1.5" />
          <path d="M44 48 H56" stroke="#001161" strokeWidth="1.5" />
          <ellipse cx="36" cy="38" rx="12" ry="16" fill="#F9C97C" stroke="#001161" strokeWidth="1.2" />
          <ellipse cx="64" cy="40" rx="12" ry="16" fill="#E8E8E8" stroke="#001161" strokeWidth="1.2" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <rect x="22" y="28" width="56" height="52" rx="6" fill="#E8F4FC" stroke="#001161" strokeWidth="1.5" opacity="0.9" />
          <rect x="32" y="40" width="14" height="14" rx="2" fill="#E74C3C" transform="rotate(12 39 47)" />
          <polygon points="58,44 68,52 54,58" fill="#2ECC71" />
          <circle cx="48" cy="62" r="8" fill="#9B59B6" />
          <line x1="40" y1="72" x2="70" y2="68" stroke="#F39C12" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <circle cx="68" cy="38" r="22" fill="none" stroke="#001161" strokeWidth="1.5" />
          <polygon points="68,22 72,38 68,34 64,38" fill="#E74C3C" />
          <path d="M62 42 L66 42 L66 46 L62 46 Z M68 42 L74 42 L74 46 L68 46 Z" fill="#001161" />
          <ellipse cx="34" cy="58" rx="12" ry="18" fill="#F0F2F8" stroke="#001161" strokeWidth="1.3" />
          <rect x="30" y="48" width="16" height="12" rx="2" fill="#E74C3C" stroke="#001161" strokeWidth="1" />
        </svg>
      );
    case 4:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <ellipse cx="38" cy="70" rx="22" ry="10" fill="#F0F2F8" stroke="#001161" strokeWidth="1.2" />
          <path
            d="M52 32 C58 28 66 30 70 38 C74 46 70 56 58 58 C48 60 40 52 42 42"
            fill="#F9C97C"
            stroke="#001161"
            strokeWidth="1.3"
          />
          <line x1="48" y1="48" x2="62" y2="62" stroke="#001161" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 5:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <circle cx="34" cy="48" r="18" fill="#F9C97C" stroke="#001161" strokeWidth="1.3" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const r = (deg * Math.PI) / 180;
            const x1 = 34 + Math.cos(r) * 12;
            const y1 = 48 + Math.sin(r) * 12;
            const x2 = 34 + Math.cos(r) * 16;
            const y2 = 48 + Math.sin(r) * 16;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#001161" strokeWidth="1.5" />;
          })}
          <ellipse cx="72" cy="50" rx="14" ry="20" fill="#FCE4D6" stroke="#001161" strokeWidth="1.3" />
          <path d="M62 50 Q72 42 82 50 Q72 58 62 50" fill="#FFB89A" stroke="#001161" strokeWidth="1" />
        </svg>
      );
    case 6:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <rect x="34" y="36" width="32" height="44" rx="4" fill="#D6EAF8" stroke="#001161" strokeWidth="1.5" />
          <rect x="38" y="52" width="24" height="24" rx="2" fill="#5DADE2" opacity="0.85" />
          <line x1="54" y1="28" x2="54" y2="40" stroke="#001161" strokeWidth="1.5" />
          <circle cx="54" cy="26" r="3" fill="#E74C3C" />
          <path d="M72 30 L66 44" stroke="#BDC3C7" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 7:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <ellipse cx="44" cy="52" rx="20" ry="24" fill="#F9C97C" stroke="#001161" strokeWidth="1.3" />
          <circle cx="40" cy="48" r="3" fill="#001161" />
          <circle cx="50" cy="48" r="3" fill="#001161" />
          <path d="M38 58 Q44 62 50 58" fill="none" stroke="#001161" strokeWidth="1.2" />
          <path
            d="M58 38 Q78 32 82 48 Q78 58 62 56 Q58 48 58 38"
            fill="#fff"
            stroke="#001161"
            strokeWidth="1.3"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className={cls} aria-hidden>
          <ellipse cx="48" cy="58" rx="22" ry="16" fill="#2ECC71" opacity="0.35" stroke="#001161" strokeWidth="1.3" />
          <circle cx="44" cy="54" r="4" fill="#001161" />
          <line x1="62" y1="40" x2="72" y2="62" stroke="#95A5A6" strokeWidth="2" strokeLinecap="round" />
          <path d="M58 64 L74 68 L70 72 Z" fill="#BDC3C7" stroke="#001161" strokeWidth="1" />
        </svg>
      );
  }
}

interface SubjectMethodPrinciplesSectionProps {
  baseSubject: string;
  displayNameGenitive: string;
  /** Z administrace (Předměty); neprázdné pole má přednost před výchozími daty v repu. */
  itemsFromCms?: SubjectMethodPrinciple[] | undefined;
  /** Stránka /predmet/… — Matematika 1. / 2. stupeň mají vlastní sady principů. */
  matematikaFirstStage?: boolean;
  matematikaSecondStage?: boolean;
}

export function SubjectMethodPrinciplesSection({
  baseSubject,
  displayNameGenitive,
  itemsFromCms,
  matematikaFirstStage = false,
  matematikaSecondStage = false,
}: SubjectMethodPrinciplesSectionProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const principles =
    itemsFromCms && itemsFromCms.length > 0
      ? itemsFromCms
      : getSubjectMethodPrinciples(baseSubject, { matematikaFirstStage, matematikaSecondStage });

  /* Snap / prohlížeč občas nastaví scrollLeft > 0 → ořez vlevo; reset před vykreslením. */
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el && principles.length > 0) el.scrollLeft = 0;
  }, [principles.length, baseSubject, matematikaFirstStage, matematikaSecondStage, itemsFromCms?.length]);

  if (!principles || principles.length === 0) return null;

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-principle-card]');
    const w = card ? card.offsetWidth + 20 : 380;
    el.scrollBy({ left: dir * w * 1.05, behavior: 'smooth' });
  };

  return (
    <section className="border-t border-[#001161]/8 py-14 md:py-16" style={{ backgroundColor: SECTION_BG }}>
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        <h2
          className="text-[#001161] text-[24px] md:text-[30px] leading-tight mb-3"
          style={{ fontFamily: COOPER }}
        >
          Metodické principy
        </h2>
        <p className="text-[14px] md:text-[15px] text-[#001161]/65 leading-relaxed max-w-[720px]" style={{ fontFamily: FF }}>
          Náš přístup k výuce {displayNameGenitive} staví na těchto východiscích — použijte šipky nebo posuňte
          pruhem níže.
        </p>

        {/* Šipky nahoře vlevo (stejná logika jako mini-taby na stránce produktu) */}
        <div className="flex items-center gap-2 mt-5 mb-4">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm shrink-0"
            style={{ background: '#001161', color: '#fff' }}
            aria-label="Posunout principy doleva"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm shrink-0"
            style={{ background: '#001161', color: '#fff' }}
            aria-label="Posunout principy doprava"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={scrollerRef}
          className="flex touch-pan-x gap-5 overflow-x-auto overflow-y-visible overscroll-x-contain py-3 pb-5 pl-4 pr-4 sm:pl-5 sm:pr-5 md:pl-4 md:pr-4"
          style={{
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
            WebkitFontSmoothing: 'antialiased',
          }}
        >
          {principles.map((p, i) => (
            <article
              key={`${p.title}-${i}`}
              data-principle-card
              className="shrink-0 w-[272px] sm:w-[300px] lg:w-auto lg:flex-[0_0_calc((100%-2.5rem)/3)] lg:max-w-none rounded-[22px] border border-[#001161]/10 bg-[#E8EBF3]/90 shadow-sm lg:shadow-[0_4px_20px_rgba(0,17,97,0.06)] flex flex-col overflow-hidden"
            >
              <div className="px-4 pt-5 pb-2">
                <h3
                  className="text-[#001161] text-[15px] md:text-[16px] font-bold leading-snug text-center min-h-[2.75rem] flex items-center justify-center"
                  style={{ fontFamily: COOPER }}
                >
                  {p.title}
                </h3>
              </div>
              <div className="px-4 py-2 flex-1 flex items-center justify-center bg-[#f4f6fb]/50 min-h-[104px]">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="max-h-[120px] w-full max-w-[200px] object-contain"
                  />
                ) : (
                  <PrincipleVisual id={p.visualId} />
                )}
              </div>
              <div className="px-4 pb-5 pt-2 flex-1">
                <p
                  className="text-[13px] md:text-[14px] text-[#001161]/72 leading-relaxed text-center"
                  style={{ fontFamily: FF }}
                >
                  {p.body}
                </p>
              </div>
            </article>
          ))}
          {/* Odsazení vpravo — stín/zaoblení + poslední karta u konce scrollu */}
          <div className="shrink-0 w-4 sm:w-6" aria-hidden />
        </div>
      </div>
    </section>
  );
}
