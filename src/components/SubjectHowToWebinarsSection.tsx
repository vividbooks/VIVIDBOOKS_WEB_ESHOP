import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useWebinars } from '../contexts/WebinarsContext';
import type { Webinar } from '../data/webinars';

const FF = "'Fenomen Sans', sans-serif";
const SERIF = "'Cooper Light', serif";
const CARD_W = 319;
const CARD_GAP = 10;
const CARD_SCROLL = 3 * (CARD_W + CARD_GAP);

type HowToCard = {
  subject: string;
  subjectFor: string;
  slug: string;
  day: number;
  monthNum: number;
  monthName: string;
  year: number;
  time: string;
  accent: string;
  wash: string;
  featuredToday?: boolean;
};

function isSameLocalDay(w: Pick<HowToCard, 'day' | 'monthNum' | 'year'>, now = new Date()): boolean {
  return w.day === now.getDate() && (w.monthNum || 0) === now.getMonth() + 1 && w.year === now.getFullYear();
}

const HOW_TO_CARDS: HowToCard[] = [
  {
    subject: 'Matematika',
    subjectFor: 'matematiku',
    slug: 'jak-nadchnout-zaky-pro-matematiku-na-2-stupni',
    day: 1,
    monthNum: 9,
    monthName: 'Září',
    year: 2026,
    time: '18:00',
    accent: '#2F6BFF',
    wash: '#CEDCFF',
  },
  {
    subject: 'Matematika 1. st.',
    subjectFor: 'matematiku na 1. stupni',
    slug: 'jak-nadchnout-zaky-pro-matematiku-na-1-stupni',
    day: 3,
    monthNum: 9,
    monthName: 'Září',
    year: 2026,
    time: '18:00',
    accent: '#4F7CFF',
    wash: '#5386FF',
  },
  {
    subject: 'Fyzika',
    subjectFor: 'fyziku',
    slug: 'jak-nadchnout-zaky-pro-fyziku',
    day: 8,
    monthNum: 9,
    monthName: 'Září',
    year: 2026,
    time: '18:00',
    accent: '#E8942A',
    wash: '#F8F3E2',
  },
  {
    subject: 'Přírodopis',
    subjectFor: 'přírodopis',
    slug: 'jak-na-aktivizaci-zaku-v-prirodopise',
    day: 10,
    monthNum: 9,
    monthName: 'Září',
    year: 2026,
    time: '18:00',
    accent: '#2E9B6A',
    wash: '#98FFDE',
  },
  {
    subject: 'Prvouka',
    subjectFor: 'prvouku',
    slug: 'jak-nadchnout-zaky-pro-prvouku',
    day: 15,
    monthNum: 9,
    monthName: 'Září',
    year: 2026,
    time: '18:00',
    accent: '#E11D48',
    wash: '#177E5D',
  },
  {
    subject: 'Chemie',
    subjectFor: 'chemii',
    slug: 'jak-nadchnout-zaky-pro-chemii',
    day: 17,
    monthNum: 9,
    monthName: 'Září',
    year: 2026,
    time: '18:00',
    accent: '#7C3AED',
    wash: '#FFEC99',
  },
];

function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function washTextClass(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 150 ? 'text-white/90' : 'text-[#001161]/65';
}

function matchHowToWebinar(card: HowToCard, webinars: Webinar[]): Webinar | undefined {
  const slugHit = webinars.find((w) => (w.slug || w.id) === card.slug);
  if (slugHit) return slugHit;

  const subject = norm(card.subject);
  return webinars.find((w) => {
    const hay = norm(`${w.slug || ''} ${w.title} ${w.subtitle || ''}`);
    return hay.includes('nadchnout') && hay.includes(subject);
  });
}

export function SubjectHowToWebinarsSection() {
  const navigate = useNavigate();
  const { webinars } = useWebinars();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(0);

  const cards = useMemo(() => {
    const series = HOW_TO_CARDS.map((card) => {
      const live = matchHowToWebinar(card, webinars);
      return {
        ...card,
        live,
        href: live ? `/webinar/${live.slug || live.id}` : '/webinare',
      };
    });

    const now = new Date();
    const today = webinars
      .filter((w) => !w.isPast && isSameLocalDay(w, now))
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))[0];

    if (!today) return series;
    const todaySlug = today.slug || today.id;
    if (series.some((card) => card.slug === todaySlug || (card.live && (card.live.slug || card.live.id) === todaySlug))) {
      return series.map((card) =>
        card.slug === todaySlug || (card.live && (card.live.slug || card.live.id) === todaySlug)
          ? { ...card, featuredToday: true }
          : card,
      );
    }

    return [
      {
        subject: today.title,
        subjectFor: today.title,
        slug: todaySlug,
        day: today.day,
        monthNum: today.monthNum,
        monthName: today.monthName,
        year: today.year,
        time: today.time,
        accent: '#DC2626',
        wash: today.coverImageBgColor || '#FFE4E6',
        featuredToday: true,
        live: today,
        href: `/webinar/${todaySlug}`,
      },
      ...series,
    ];
  }, [webinars]);

  const scrollByDir = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * CARD_SCROLL, behavior: 'smooth' });
  };

  return (
    <section className="mt-8">
      <div className="relative z-10 mb-4 flex flex-col gap-2.5 px-4 md:flex-row md:items-end md:justify-between md:gap-6 md:px-8">
        <div className="min-w-0 max-w-[44rem]">
          <h2
            className="text-[#001161] text-[22px] md:text-[28px] xl:text-[32px] leading-[1.15]"
            style={{ fontFamily: SERIF }}
          >
            {'Učíte s Vividbooks nebo hledáte inspiraci'}
            <br className="hidden sm:block" />
            {' pro vaše předměty?'}
          </h2>
          <p
            className="mt-1.5 text-[#001161]/70 text-[13px] md:text-[15px] leading-snug whitespace-nowrap max-sm:whitespace-normal"
            style={{ fontFamily: FF }}
          >
            {'Na září jsme pro vás připravili sérii odborných webinářů s DVPP certifikátem zdarma.'}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 md:ml-auto md:w-auto md:justify-start">
          <button
            type="button"
            onClick={() => navigate('/webinare')}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border border-[#001161] text-[#001161] hover:bg-[#001161] hover:text-white font-['Fenomen_Sans',sans-serif] text-[13px] font-bold whitespace-nowrap transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer group/openbtn"
          >
            {'Další termíny'}
            <svg className="w-3.5 h-3.5 shrink-0 transition-transform group-hover/openbtn:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {scrolled > 10 && (
              <button
                type="button"
                onClick={() => scrollByDir(-1)}
                className="flex items-center justify-center size-9 rounded-full border-2 border-[#001161]/25 text-[#001161] hover:bg-[#001161] hover:text-white hover:border-[#001161] transition-all cursor-pointer active:scale-90"
                aria-label="Posunout doleva"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              className="flex items-center justify-center size-9 rounded-full border-2 border-[#001161]/25 text-[#001161] hover:bg-[#001161] hover:text-white hover:border-[#001161] transition-all cursor-pointer active:scale-90"
              aria-label="Posunout doprava"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft)}
        className="flex items-stretch gap-2.5 overflow-x-auto overflow-y-visible pb-2 -mx-0 px-4 md:px-8"
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map((card) => {
          const day = card.live?.day ?? card.day;
          const monthName = card.live?.monthName ?? card.monthName;
          const time = card.live?.time ?? card.time;
          const cover = card.live?.coverImage;
          const title = card.live?.title || `Jak nadchnout žáky pro ${card.subjectFor}`;
          const isPast = Boolean(card.live?.isPast);
          const barColor = card.wash;

          return (
            <button
              key={card.slug}
              type="button"
              onClick={() => navigate(card.href)}
              aria-label={`${title} — ${day}. ${monthName} ${time}`}
              className={`group shrink-0 text-left rounded-[20px] overflow-hidden cursor-pointer flex flex-col ${
                card.featuredToday ? 'border-[3px] border-[#DC2626]' : ''
              }`}
              style={{ width: CARD_W, background: barColor }}
            >
              <div
                className="relative aspect-[16/9] overflow-hidden"
                style={{ background: barColor }}
              >
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-end px-4 py-3.5"
                    style={{ background: card.accent }}
                  >
                    <span
                      className="text-white text-[22px] font-bold leading-none"
                      style={{ fontFamily: FF }}
                    >
                      {card.subject}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <span
                  className={`${washTextClass(barColor)} text-[12px] font-bold`}
                  style={{ fontFamily: FF }}
                >
                  {card.featuredToday ? `Dnes · ${time}` : `${day}. ${monthName} · ${time}`}
                </span>
                <span
                  className="shrink-0 bg-[#001161] group-hover:bg-[#5B4FD8] text-white text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
                  style={{ fontFamily: FF }}
                >
                  {isPast ? 'Záznam' : 'Přihlásit se'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
