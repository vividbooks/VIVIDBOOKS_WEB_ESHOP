import React, { useEffect, useState, useRef } from 'react';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}` };

// Exact tabText names to display, in order
const DESIRED_TAB_NAMES = [
  'Pracovní sešity',
  'Učební text',
  'Lekce s animacemi a diskuzí',
  'Pracovní a badatelské listy',
  'Procvičování',
  'Testy a písemky',
  'Tvorba vlastních materiálů',
];

// Grade 1 specific tab names
const DESIRED_TAB_NAMES_GRADE1 = [
  'Pracovní učebnice – Aktivita do hodiny',
  'Interaktivní pracovní list',
  'Procvičování',
  'Bonusy a přílohy',
  'Matematická tabule',
];

// Grade 2 specific tab names
const DESIRED_TAB_NAMES_GRADE2 = [
  'Pracovní sešity',
  'Učební text',
  'Pracovní a badatelské listy',
  'Lekce s animacemi a diskuzí',
  'Procvičování',
  'Testy a písemky',
  'Tvorba vlastních materiálů',
  '3D modely',
];

// All subjects to search across
const ALL_SUBJECTS = [
  'Matematika 2',
  'Matematika-1',
  'Fyzika',
  'Chemie',
  'Přírodopis',
  'Český jazyk',
  'Prvouka',
];

// Subjects per grade
const SUBJECTS_GRADE1 = ['Matematika-1', 'Český jazyk', 'Prvouka'];
const SUBJECTS_GRADE2 = ['Matematika 2', 'Fyzika', 'Chemie', 'Přírodopis'];

async function fetchTabsForSubject(subject: string): Promise<any[]> {
  try {
    const r = await fetch(`${SERVER}/public/tabs?subject=${encodeURIComponent(subject)}`, { headers: AUTH_H });
    const d = await r.json();
    return d.items || [];
  } catch {
    return [];
  }
}

/** Normalize for fuzzy matching */
function norm(s: string) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

interface VividbooksFeaturesSectionProps {
  className?: string;
  grade?: 1 | 2;
}

export function VividbooksFeatures({ className = '', grade }: VividbooksFeaturesSectionProps) {
  const [tabs, setTabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const gradeLabel = grade === 1 ? '1. stupeň' : grade === 2 ? '2. stupeň' : null;
  const subtitle = grade === 2
    ? 'Digitální učebnice, interaktivní lekce, badatelské listy a minihry pro 6.–9. ročník.'
    : grade === 1
    ? 'Pracovní sešity, interaktivní aktivity a metodika pro 1.–5. ročník.'
    : 'Vše, co potřebujete pro moderní výuku.';

  useEffect(() => {
    setLoading(true);
    const subjects = grade === 1 ? SUBJECTS_GRADE1 : ALL_SUBJECTS;

    const fetchAll = subjects.map(fetchTabsForSubject);
    // Pro 2. stupeň vždy fetchnem Fyziku zvlášť abychom měli jistotu
    const fyzika$ = grade === 2 ? fetchTabsForSubject('Fyzika') : Promise.resolve([]);

    Promise.all([Promise.all(fetchAll), fyzika$]).then(([results, fyzikaItems]) => {
      const allTabs: any[] = results.flat();

      // Přidáme Fyziku do allTabs pokud tam ještě není
      for (const ft of fyzikaItems) {
        if (!allTabs.find(t => t.id === ft.id)) allTabs.push(ft);
      }

      console.log('[VividbooksFeatures] allTabs count:', allTabs.length, 'fyzika count:', fyzikaItems.length);
      console.log('[VividbooksFeatures] fyzika tabTexts:', fyzikaItems.map((t: any) => t.tabText));

      const desiredNames = grade === 1 ? DESIRED_TAB_NAMES_GRADE1 : grade === 2 ? DESIRED_TAB_NAMES_GRADE2 : DESIRED_TAB_NAMES;

      const picked: any[] = [];
      for (const desired of desiredNames) {
        // 1. Exact match
        let match = allTabs.find(t => norm(t.tabText) === norm(desired));
        // 2. Partial match
        if (!match) {
          match = allTabs.find(t =>
            norm(t.tabText).includes(norm(desired)) ||
            norm(desired).includes(norm(t.tabText))
          );
        }
        // 3. Keyword fallback — pro "Lekce s animacemi" hledej přímo ve Fyzice
        if (!match && (norm(desired).includes('animac') || norm(desired).includes('lekce'))) {
          match = fyzikaItems.find((t: any) =>
            norm(t.tabText).includes('animac') ||
            norm(t.tabText).includes('lekce')
          ) || allTabs.find(t =>
            norm(t.tabText).includes('animac') ||
            norm(t.tabText).includes('lekce')
          );
        }
        // 4. Keyword fallback pro "3D modely"
        if (!match && norm(desired).includes('3d')) {
          match = allTabs.find(t =>
            norm(t.tabText).includes('3d') || norm(t.tabText).includes('model')
          );
        }
        // 5. Pro "Tvorba vlastních materiálů" preferuj Přírodopis
        if (!match && norm(desired).includes('tvorba')) {
          const prirodopis = allTabs.filter(t => t.subject === 'Přírodopis');
          match = prirodopis.find(t => norm(t.tabText).includes('tvorba'))
            || allTabs.find(t => norm(t.tabText).includes('tvorba'));
        }
        if (match) {
          console.log(`[VividbooksFeatures] matched "${desired}" → tabText="${match.tabText}"`);
          picked.push(match);
        } else {
          console.log(`[VividbooksFeatures] NO MATCH for "${desired}"`);
        }
      }

      setTabs(picked);
      setLoading(false);
    });
  }, [grade]);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    setTimeout(checkScroll, 100);
  }, [tabs]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  return (
    <div className={`mt-6 mb-2 -mx-4 md:-mx-8 ${className}`}>
      <div className="bg-[#f0f2f8] px-4 md:px-8 py-7">
        {/* Heading */}
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[22px] md:text-[26px] leading-tight whitespace-nowrap">
            {`Co umí Vividbooks`}
            {gradeLabel && (
              <span className="ml-2 font-['Fenomen_Sans',sans-serif] text-[16px] font-bold text-[#FF6B1A]">
                {`na ${gradeLabel}`}
              </span>
            )}
          </h2>
          <div className="h-px flex-1 bg-[#001161]/10" />
          {/* Šipky — stejná pozice jako u předmětů */}
          <div className="flex items-center gap-2 shrink-0">
            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className="flex items-center justify-center size-9 rounded-full border-2 border-[#001161]/25 text-[#001161] hover:bg-[#001161] hover:text-white hover:border-[#001161] transition-all cursor-pointer active:scale-90"
                aria-label="Posunout doleva"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <button
              onClick={() => scroll('right')}
              className="flex items-center justify-center size-9 rounded-full border-2 border-[#001161]/25 text-[#001161] hover:bg-[#001161] hover:text-white hover:border-[#001161] transition-all cursor-pointer active:scale-90"
              aria-label="Posunout doprava"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/50 text-[13px] mb-5 px-0.5">
          {subtitle}
        </p>

        {/* Scroll container */}
        <div className="relative">
          {/* Left arrow - REMOVED, now in header */}
          {/* Right arrow - REMOVED, now in header */}

          {/* Horizontal scroll row */}
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-4 overflow-x-auto -mx-4 md:-mx-8 px-4 md:px-8 pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[20px] md:rounded-[24px] shrink-0 bg-[#e4e8f0] animate-pulse"
                  style={{ width: 185, height: 275 }}
                />
              ))
            ) : tabs.length > 0 ? (
              tabs.map((tab, i) => {
                const bgColor = tab.bgColor || '#f1f3f8';
                // Use the desired label (to keep exact wording), fallback to tabText
                const desiredNames = grade === 1 ? DESIRED_TAB_NAMES_GRADE1 : grade === 2 ? DESIRED_TAB_NAMES_GRADE2 : DESIRED_TAB_NAMES;
                const label = desiredNames.find(n =>
                  norm(n) === norm(tab.tabText) ||
                  norm(n).includes(norm(tab.tabText)) ||
                  norm(tab.tabText).includes(norm(n))
                ) || tab.tabText;

                return (
                  <div
                    key={tab.id || i}
                    className="rounded-[20px] md:rounded-[24px] flex flex-col overflow-hidden shrink-0"
                    style={{ background: bgColor, width: 185, height: 275 }}
                  >
                    {/* Visual — top 72% */}
                    <div
                      className="flex items-center justify-center overflow-hidden"
                      style={{ height: '72%', padding: '8px 8px 4px' }}
                    >
                      {tab.contentImage ? (
                        <img
                          src={tab.contentImage}
                          alt={label}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                        />
                      ) : (
                        <BookOpen className="w-10 h-10 text-[#001161]/20" />
                      )}
                    </div>

                    {/* Text — bottom 28% */}
                    <div
                      className="px-4 pb-3 pt-1 flex flex-col gap-1 text-[#001161] items-center justify-end"
                      style={{ height: '28%' }}
                    >
                      <p
                        className="text-[13px] leading-tight text-center"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif", fontWeight: 700 }}
                      >
                        {label}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p
                className="text-[#001161]/30 text-[13px] py-8"
                style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              >
                Naítání obsahu…
              </p>
            )}
            <div className="w-4 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}