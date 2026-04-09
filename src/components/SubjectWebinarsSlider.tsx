import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Award, ChevronRight, Loader2, Radio } from 'lucide-react';
import { useWebinars } from '../contexts/WebinarsContext';
import { useDvppVideos } from '../contexts/DvppVideosContext';
import type { Webinar } from '../data/webinars';
import { WebinarCard } from './WebinarCard';
import { DvppVideoCard } from './DvppVideoCard';

const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COOPER = "'Cooper Light', serif";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Veřejné — použitelné i v adminu / testech */
export function webinarMatchesSubject(w: Webinar, subject: string): boolean {
  const base = subject.replace(/\s+\d+\.\s*stupe.*$/i, '').trim();
  const related = w.relatedSubjects;
  if (related && related.length > 0) {
    return related.some((r) => {
      const rt = r.trim();
      if (!rt) return false;
      if (subject === rt) return true;
      if (base === rt) return true;
      return false;
    });
  }
  return webinarKeywordFallback(w, base);
}

function webinarKeywordFallback(w: Webinar, base: string): boolean {
  const hay = stripHtml(`${w.title} ${w.subtitle} ${w.description} ${w.targetAudience}`).toLowerCase();
  const ascii = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const map: Record<string, string[]> = {
    Matematika: ['matematik'],
    Fyzika: ['fyzik'],
    Chemie: ['chemi'],
    Přírodopis: ['prirodopis', 'biolog'],
    Prvouka: ['prvouka'],
    'Anglický jazyk': ['anglict', 'angličt'],
    'Český jazyk': ['cesky jazyk', 'cestina', 'češtin'],
  };
  const needles = map[base] || [ascii(base)];
  return needles.some((n) => hay.includes(n));
}

function webinarDateTs(w: Webinar): number {
  return new Date(w.year, (w.monthNum || 1) - 1, w.day || 1).getTime();
}

function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** DVPP téma odpovídající stránce předmětu (např. Matematika / Matematika 1. stupeň → téma Matematika). */
function defaultDvppTopicId(
  topics: { id: string; name: string }[],
  subject: string,
  displayName: string,
): string | null {
  if (!topics.length) return null;
  const base = subject.replace(/\s+\d+\.\s*stupe.*$/i, '').trim();
  const nb = normName(base);
  const nd = normName(displayName);
  const ns = normName(subject);
  const hit = topics.find((t) => {
    const tn = normName(t.name);
    return tn === nb || tn === nd || tn === ns;
  });
  return hit?.id ?? null;
}

function sortUpcoming(list: Webinar[]): Webinar[] {
  return [...list].sort((a, b) => webinarDateTs(a) - webinarDateTs(b));
}

const SCROLL_ROW =
  'flex gap-5 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory md:snap-none';
/** Stejná šířka dlaždice jako rozumný sloupec v gridu na /webinare (viz WebinarsSection). */
const TILE_W = 'snap-center shrink-0 w-[min(100%,320px)]';

interface SubjectWebinarsSliderProps {
  subject: string;
  displayName: string;
  /** 2. pád názvu předmětu (např. „Webináře Fyziky“). */
  displayNameGenitive: string;
}

export function SubjectWebinarsSlider({
  subject,
  displayName,
  displayNameGenitive,
}: SubjectWebinarsSliderProps) {
  const navigate = useNavigate();
  const { webinars, loading: webinarsLoading } = useWebinars();
  const { topics, videos, loading: dvppLoading, error: dvppError } = useDvppVideos();
  const [activeDvppTopic, setActiveDvppTopic] = useState<string | null>(null);

  const upcoming = useMemo(() => {
    const matched = webinars.filter((w) => webinarMatchesSubject(w, subject));
    return sortUpcoming(matched.filter((w) => !w.isPast));
  }, [webinars, subject]);

  const defaultTopic = useMemo(
    () => defaultDvppTopicId(topics, subject, displayName),
    [topics, subject, displayName],
  );

  useEffect(() => {
    setActiveDvppTopic(defaultTopic);
  }, [subject, displayName, defaultTopic]);

  const groupedVideos = useMemo(() => {
    if (activeDvppTopic) {
      const vids = videos.filter((v) => v.topicIds.includes(activeDvppTopic));
      const topic = topics.find((t) => t.id === activeDvppTopic);
      return topic ? [{ topic, videos: vids }] : [];
    }
    return topics
      .map((topic) => ({
        topic,
        videos: videos.filter((v) => v.topicIds.includes(topic.id)),
      }))
      .filter((g) => g.videos.length > 0);
  }, [topics, videos, activeDvppTopic]);

  const hasDvppContent = videos.length > 0;
  const showRecordingsBlock = dvppLoading || dvppError || hasDvppContent;

  if (!webinarsLoading && upcoming.length === 0 && !showRecordingsBlock) return null;

  const pillStyle = (active: boolean) => ({
    fontFamily: F.fontFamily,
    background: active ? '#001161' : 'transparent',
    color: active ? '#fff' : '#001161',
    border: `2px solid ${active ? '#001161' : 'rgba(0,17,97,0.18)'}`,
  });

  return (
    <section className="w-full bg-[#f4f6fb] py-14 md:py-16 border-t border-[#001161]/8">
      <div className="px-6 md:px-12 max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-[#FF8C00] shrink-0" aria-hidden />
              <span style={F} className="text-[11px] font-black uppercase tracking-wider text-[#001161]/45">
                Webináře k předmětu
              </span>
            </div>
            <h2
              className="text-[#001161] text-[24px] md:text-[30px] leading-tight"
              style={{ fontFamily: COOPER }}
            >
              {`DVPP zdarma – Webináře ${displayNameGenitive}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/webinare')}
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#7C3AED] hover:text-[#5B21B6] cursor-pointer transition-colors"
            style={F}
          >
            Všechny webináře
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {webinarsLoading ? (
          <div className="flex justify-center py-8 mb-4">
            <Loader2 className="w-7 h-7 text-[#7C3AED]/40 animate-spin" aria-hidden />
          </div>
        ) : null}

        {!webinarsLoading && upcoming.length > 0 ? (
          <div className="bg-white rounded-[24px] border border-[#001161]/8 shadow-sm md:shadow-[0_4px_24px_rgba(0,17,97,0.06)] px-5 py-6 md:px-8 md:py-8 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E8942A] shrink-0 md:shadow-[0_1px_4px_rgba(232,148,42,0.35)]" />
                <h3
                  className="text-[#001161] text-[22px] md:text-[28px] leading-tight"
                  style={{ fontFamily: COOPER }}
                >
                  Plánované webináře
                </h3>
              </div>
              <span style={F} className="text-[12px] text-[#001158]/45 font-semibold shrink-0">
                Živý přenos · registrace
              </span>
            </div>
            <div className={SCROLL_ROW} style={{ scrollbarWidth: 'thin' }}>
              {upcoming.map((w) => (
                <div key={w.id} className={TILE_W}>
                  <WebinarCard webinar={w} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showRecordingsBlock ? (
          <div
            className={`rounded-[24px] border border-[#001161]/10 px-5 py-6 md:px-8 md:py-8 bg-[#F5F6FB] ${
              upcoming.length > 0 ? 'mt-2' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#001161] shrink-0" />
              <h3
                className="text-[#001161] text-[22px] md:text-[28px] leading-tight"
                style={{ fontFamily: COOPER }}
              >
                Záznamy webinářů
              </h3>
            </div>
            <p className="text-[#001161]/50 text-[14px] ml-5 mb-0" style={F}>
              Záznamy seřazené podle témat — sledujte, kdy vám to vyhovuje.
            </p>

            {!dvppLoading && topics.length > 0 && (
              <div className="mt-6">
                <p className="text-[#001161]/40 text-[11px] uppercase tracking-widest font-bold mb-3" style={F}>
                  Témata:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveDvppTopic(null)}
                    className="px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer"
                    style={pillStyle(activeDvppTopic === null)}
                  >
                    Vše
                  </button>
                  {topics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() =>
                        setActiveDvppTopic(activeDvppTopic === topic.id ? null : topic.id)
                      }
                      className="px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer"
                      style={pillStyle(activeDvppTopic === topic.id)}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dvppLoading && (
              <div className="flex items-center justify-center gap-3 py-16 text-[#001161]/40">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[14px]" style={F}>
                  Načítám videa…
                </span>
              </div>
            )}

            {!dvppLoading && dvppError && (
              <p className="text-red-500 text-[14px] py-10 text-center" style={F}>
                {dvppError}
              </p>
            )}

            {!dvppLoading && !dvppError && videos.length === 0 && (
              <p className="text-[#001161]/50 text-[14px] py-10 text-center" style={F}>
                Záznamy se načítají z Webflow…
              </p>
            )}

            {!dvppLoading && !dvppError && videos.length > 0 && groupedVideos.length === 0 && (
              <p className="text-[#001161]/50 text-[14px] py-10 text-center" style={F}>
                Pro vybrané téma zatím nejsou žádné záznamy.
              </p>
            )}

            {!dvppLoading &&
              !dvppError &&
              groupedVideos.map(({ topic, videos: topicVideos }) => (
                <div key={topic.id} className="mt-8 first:mt-6">
                  <div className="flex items-center gap-3 mb-6">
                    <h4
                      className="font-['Cooper_Light',serif] text-[#001161] text-[20px] md:text-[26px] leading-tight"
                    >
                      {topic.name}
                    </h4>
                    <div className="flex-1 h-px bg-[#001161]/8 hidden md:block" />
                    <span className="text-[#001161]/35 text-[12px] shrink-0" style={F}>
                      {topicVideos.length}{' '}
                      {topicVideos.length === 1
                        ? 'video'
                        : topicVideos.length < 5
                          ? 'videa'
                          : 'videí'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 md:gap-6">
                    {topicVideos.map((video) => (
                      <DvppVideoCard
                        key={video.id}
                        video={video}
                        onClick={() => navigate(`/webinare/zaznam/${video.id}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : null}

        {!webinarsLoading && !upcoming.length && hasDvppContent ? (
          <p style={F} className="text-[13px] text-[#001161]/40 mt-6 flex items-center gap-2">
            <Radio className="w-4 h-4 shrink-0" aria-hidden />
            K tomuto předmětu zatím nejsou naplánované žádné další živé webináře.
          </p>
        ) : null}
      </div>
    </section>
  );
}
