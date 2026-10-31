import React from 'react';
import { subjectToSlug } from '../utils/slugify';

/**
 * Homepage (zatím jen /homepage-test): místo pásu sešitů Matematiky 2. stupně tři velké karty řad.
 * Obálky bere z reálných produktů dané řady; řada bez produktů v katalogu se nezobrazí.
 */

type SeriesDef = {
  key: string;
  title: string;
  label: string;
  description: string;
  /** Hodnota `?typ=` na stránce předmětu (SERIES_TYP_PARAMS v SubjectPage); bez ní vede karta na celý předmět. */
  typ?: string;
  match: (lowerName: string) => boolean;
};

const SERIES: SeriesDef[] = [
  {
    key: 'krok',
    title: 'Krok za krokem',
    label: 'Pracovní sešity',
    description: 'Žáci objevují matematické jevy',
    typ: 'krok',
    match: (n) => n.includes('krok za krokem'),
  },
  {
    key: 'pro-vsechny',
    title: 'Pro všechny',
    label: 'Pracovní sešity',
    description: 'Spousta úloh v různých úrovních',
    typ: 'pro-vsechny',
    match: (n) => n.includes('pro všechny'),
  },
  {
    key: 'moje-matematika',
    title: 'Moje Matematika',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    match: (n) => n.includes('moje matematik'),
  },
];

const byOrder = (a: any, b: any) => (a.poradi ?? 999) - (b.poradi ?? 999);

export function MathSeriesCards({
  mainGroup,
  books,
  navigate,
}: {
  mainGroup: string;
  books: any[];
  navigate: (path: string) => void;
}) {
  const subjectPath = `/predmet/${subjectToSlug(mainGroup)}`;
  const cards = SERIES.map((s) => ({
    ...s,
    covers: books
      .filter((b) => b.image && s.match(String(b.name || '').toLowerCase()))
      .sort(byOrder)
      .slice(0, 2),
  })).filter((s) => s.covers.length > 0);

  return (
    <div className="mt-3 mb-5 -mx-4 md:mx-0 px-4 md:p-5 md:rounded-[28px] md:bg-[#F0F2F8]">
      <div
        className={`flex gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory pb-2 md:pb-0 md:grid md:overflow-visible ${
          cards.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
        }`}
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map((s) => {
          const [front, back] = s.covers;
          const href = s.typ ? `${subjectPath}?typ=${s.typ}` : subjectPath;
          return (
            <a
              key={s.key}
              href={href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                navigate(href);
              }}
              className="group/series snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto flex items-stretch gap-4 rounded-[28px] bg-white p-4 lg:p-5 min-h-[190px] lg:min-h-[220px] border border-[#001161]/8 md:border-transparent transition-all duration-200 hover:shadow-[0_12px_32px_-12px_rgba(0,17,97,0.25)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#001161]/30 focus-visible:ring-offset-2"
            >
              <div className="relative w-[42%] shrink-0 self-center aspect-[3/4]">
                {back && (
                  <img
                    src={back.image}
                    alt=""
                    loading="lazy"
                    className="absolute left-[14%] top-[2%] w-[78%] rounded-[6px] shadow-md transition-transform duration-300 rotate-[8deg] group-hover/series:rotate-[11deg]"
                  />
                )}
                <img
                  src={front.image}
                  alt={front.name}
                  loading="lazy"
                  className="absolute left-0 bottom-[2%] w-[78%] rounded-[6px] shadow-lg transition-transform duration-300 group-hover/series:-translate-y-1"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="self-end rounded-full bg-[#F0F2F8] px-2.5 py-1 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[11px] lg:text-[12px] font-bold whitespace-nowrap">
                  {s.label}
                </span>
                <h3 className="my-auto py-3 text-[#001161] font-['Fenomen_Sans',sans-serif] font-bold text-[24px] lg:text-[30px] leading-[1.05]">
                  {s.title}
                </h3>
                <p className="text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[14px] lg:text-[15px] leading-snug">
                  {s.description}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
