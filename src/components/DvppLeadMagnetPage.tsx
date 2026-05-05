import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  Award,
  ChevronRight,
  Loader2,
  Mail,
  Radio,
} from 'lucide-react';
import { SEOHead, faqJsonLd } from './SEOHead';
import { useDvppVideos } from '../contexts/DvppVideosContext';
import { useWebinars } from '../contexts/WebinarsContext';
import { DvppVideoCard } from './DvppVideoCard';
import { WebinarCard } from './WebinarCard';
import { NewsletterBanner } from './NewsletterBanner';
import { BlogSection } from './BlogSection';
import logoPaths from '../imports/svg-fupfguvmdt';

const ff = "'Fenomen Sans', sans-serif";
const VIVIDBOOKS_LOGO_VIEWBOX = '0 0 1786.62 869.93';
const FEATURED_RECORDING_TITLES = [
  'Nové psací písmo pro 21. století',
  'Bádáme na prvním stupni',
  'Petra Bakajsová – Vedení školy',
  'Jak tvořit ŠVP tak, aby byl užitečný pro každého ve škole? Z pohledu ředitele',
  'Jak tvořit ŠVP tak, aby byl užitečný pro každého ve škole? Z pohledu učitele',
  'Jak rozmluvit žáky v matematice',
];

function isDvppStandaloneHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.replace(/^www\./, '').toLowerCase();
  return host === 'dvppzdarma.cz';
}

function scrollToRecordings() {
  document.getElementById('zaznamy')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mainSiteHref(path: string, standaloneHost: boolean) {
  return standaloneHost ? `https://new.vividbooks.com${path}` : path;
}

function normalizeRecordingTitle(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function VividbooksWordmark() {
  return (
    <svg
      viewBox={VIVIDBOOKS_LOGO_VIEWBOX}
      fill="none"
      className="block h-auto w-[84px] md:w-[96px]"
      aria-hidden
      focusable="false"
    >
      <path d={logoPaths.p299c6b00} fill="#001161" />
      <path d={logoPaths.p3cc4870} fill="#001161" />
      <path d={logoPaths.p98d9300} fill="#001161" />
      <path d={logoPaths.pf524b00} fill="#001161" />
      <path d={logoPaths.p26e2d80} fill="#001161" />
      <path d={logoPaths.p15998cf0} fill="#001161" />
      <path d={logoPaths.p1bd3b900} fill="#001161" />
      <path d={logoPaths.p19a24c00} fill="#001161" />
      <path d={logoPaths.p34d64300} fill="#001161" />
      <path d={logoPaths.p396dedf0} fill="#001161" />
    </svg>
  );
}

export function DvppLeadMagnetPage() {
  const navigate = useNavigate();
  const { topics, videos, loading, error } = useDvppVideos();
  const { upcoming, loading: webinarsLoading } = useWebinars();
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [showAllRecordings, setShowAllRecordings] = useState(false);

  const visibleVideos = useMemo(() => {
    if (!activeTopic) return videos;
    return videos.filter((video) => Array.isArray(video.topicIds) && video.topicIds.includes(activeTopic));
  }, [activeTopic, videos]);

  const homepageFeaturedVideos = useMemo(() => {
    const usedIds = new Set<string>();
    const preferred = FEATURED_RECORDING_TITLES
      .map((title) => {
        const target = normalizeRecordingTitle(title);
        const match = videos.find((video) => {
          const id = String(video.id ?? '');
          return !usedIds.has(id) && normalizeRecordingTitle(video.name || '') === target;
        });
        if (match) usedIds.add(String(match.id ?? ''));
        return match;
      })
      .filter((video): video is NonNullable<typeof video> => Boolean(video));

    if (preferred.length >= 6) return preferred.slice(0, 6);

    return [
      ...preferred,
      ...videos.filter((video) => !usedIds.has(String(video.id ?? ''))),
    ].slice(0, 6);
  }, [videos]);
  const displayedVideos = activeTopic || showAllRecordings ? visibleVideos : homepageFeaturedVideos;
  const standaloneHost = isDvppStandaloneHost();

  return (
    <main className="min-h-screen bg-[#F5F6FB] text-[#001161]" style={{ fontFamily: ff }}>
      <SEOHead
        title="DVPP webináře zdarma pro pedagogy ZŠ"
        path={standaloneHost ? '' : '/dvpp-webinare'}
        description="Záznamy DVPP webinářů zdarma pro pedagogy základních škol. Sledujte je kdykoliv a získejte certifikát po splnění krátkého dotazníku."
        jsonLd={[
          faqJsonLd([
            {
              question: 'Jsou DVPP webináře zdarma?',
              answer: 'Ano, záznamy DVPP webinářů Vividbooks jsou pro učitele zdarma.',
            },
            {
              question: 'Mohu získat certifikát?',
              answer: 'U vybraných záznamů lze po zhlédnutí a vyplnění krátkého dotazníku získat DVPP certifikát.',
            },
          ]),
        ]}
      />

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 pb-9 pt-5 text-center md:px-8 md:pb-12">
          <div className="mb-10 flex flex-col items-center justify-between gap-5 border-b border-[#001161]/10 pb-5 md:flex-row">
            <a
              href={mainSiteHref('/', standaloneHost)}
              className="flex items-center gap-5 text-[#001161]"
              aria-label="Přejít na hlavní web Vividbooks"
            >
              <VividbooksWordmark />
              <span className="hidden border-l border-[#001161]/12 pl-5 font-['Cooper_Light',serif] text-[22px] leading-tight text-[#001161] md:block">
                Učení, které inspiruje a baví.
              </span>
            </a>

            <a
              href={mainSiteHref('/vyzkousejte', standaloneHost)}
              className="rounded-[10px] bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-[0_10px_26px_rgba(0,17,97,0.16)] transition hover:bg-[#5B4FD8]"
            >
              Vyzkoušet učebnice Vividbooks
            </a>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
            <h1 className="mx-auto max-w-[600px] font-['Cooper_Light',serif] text-[36px] leading-[0.98] tracking-tight text-[#5B4FD8] md:text-[48px]">
              DVPP webináře
              <br />
              zdarma pro pedagogy ZŠ
            </h1>
            <p className="mx-auto mt-8 max-w-[560px] text-[13px] font-bold leading-relaxed text-[#5B4FD8]/80 md:text-[14px]">
              Rádi se učíte nové věci a zlepšujete svou práci ve výuce? Na našem portálu najdete kvalitní DVPP webináře, ke kterým lze získat certifikát jako doklad o dalším vzdělávání.
            </p>

            <div className="mt-8">
              <p className="mb-3 text-[13px] font-bold text-[#5B4FD8]/75">Témata:</p>
              {!loading && topics.length > 0 ? (
                <div className="mx-auto flex max-w-[760px] flex-wrap justify-center gap-2">
                  {topics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        setActiveTopic(topic.id);
                        setShowAllRecordings(false);
                        scrollToRecordings();
                      }}
                      className={`min-w-[104px] rounded-[6px] px-5 py-3 text-[13px] font-bold transition ${
                        activeTopic === topic.id
                          ? 'bg-[#5B4FD8] text-white shadow-[0_8px_18px_rgba(91,79,216,0.18)]'
                          : 'bg-[#E6EAF4] text-[#001161]/70 hover:bg-[#DDE3F2] hover:text-[#001161]'
                      }`}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mx-auto flex max-w-[760px] flex-wrap justify-center gap-2">
                  {['Fyzika', 'Matematika', 'Chemie', 'Přírodopis', 'Prvouka', 'Český jazyk', 'Vividboard', 'Umělá inteligence', 'Profesní rozvoj', 'Vedení školy', 'Tvorba ŠVP'].map((topic) => (
                    <span key={topic} className="min-w-[104px] rounded-[6px] bg-[#E6EAF4] px-5 py-3 text-[13px] font-bold text-[#001161]/70">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="zaznamy" className="mx-auto max-w-7xl scroll-mt-10 bg-white px-5 pb-14 pt-6 md:px-8">
        <div className="mb-8 text-center">
          <h2 className="font-['Cooper_Light',serif] text-[28px] leading-none text-black md:text-[36px]">
            Vybrané záznamy webinářů
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-[28px] bg-white py-20 text-[#001161]/45">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[14px] font-bold">Načítám záznamy…</span>
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-red-100 bg-white p-8 text-red-500">{error}</div>
        ) : displayedVideos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[28px] bg-white py-16 text-center text-[#001161]/45">
            <Radio className="h-8 w-8 opacity-50" />
            <p className="text-[14px] font-bold">Pro vybrané téma zatím nejsou dostupné záznamy.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-7">
              {displayedVideos.map((video) => (
                <DvppVideoCard
                  key={video.id}
                  video={video}
                  onClick={() => navigate(`/webinare/zaznam/${video.id}`)}
                />
              ))}
            </div>
            {visibleVideos.length > displayedVideos.length ? (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTopic(null);
                    setShowAllRecordings(true);
                    scrollToRecordings();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#001161]/15 bg-white px-6 py-3 text-[14px] font-black text-[#001161] transition hover:border-[#001161]/35"
                >
                  Zobrazit všechny záznamy
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section id="certifikat" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-[#E8942A]">
              <Award className="h-4 w-4" />
              DVPP certifikát
            </p>
            <h2 className="font-['Cooper_Light',serif] text-[36px] leading-none md:text-[52px]">
              Certifikát snadno a rychle.
            </h2>
          </div>
          <div className="grid gap-3">
            {[
              'Vyberete si záznam webináře a zanecháte kontaktní údaje.',
              'Zhlédnete video a u záznamu otevřete krátký DVPP dotazník.',
              'Po splnění dotazníku získáte certifikát k dalšímu vzdělávání.',
            ].map((step, index) => (
              <div key={step} className="flex gap-4 rounded-2xl border border-[#001161]/10 bg-[#F5F6FB] p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#001161] text-[14px] font-black text-white">
                  {index + 1}
                </div>
                <p className="pt-1 text-[16px] font-bold leading-relaxed text-[#001161]/70">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="terminy" className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-[#E8942A]">
              <Mail className="h-4 w-4" />
              Živé webináře
            </p>
            <h2 className="font-['Cooper_Light',serif] text-[34px] leading-none md:text-[46px]">
              Chcete být příště u toho živě?
            </h2>
          </div>
        </div>

        {webinarsLoading ? (
          <div className="flex items-center gap-3 rounded-[28px] bg-white p-8 text-[#001161]/45">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[14px] font-bold">Načítám termíny…</span>
          </div>
        ) : upcoming.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-3">
            {upcoming.slice(0, 3).map((webinar) => (
              <WebinarCard key={webinar.id} webinar={webinar} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white p-8 text-[15px] font-bold text-[#001161]/50">
            Aktuálně nejsou vypsané žádné živé termíny. Záznamy výše jsou dostupné kdykoliv.
          </div>
        )}
      </section>

      <NewsletterBanner source="dvpp-webinare" />

      <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <img
          src="https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/67c5e9b0cd73bd54aa82a416_Group%2011126.avif"
          alt="Učitelé a žáci s materiály Vividbooks"
          className="block w-full rounded-[28px] object-cover shadow-[0_14px_40px_rgba(0,17,97,0.10)]"
        />
      </section>

      <BlogSection />

      <footer className="bg-[#001161] px-5 py-10 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="text-[20px] font-black">DVPP zdarma</div>
            <p className="mt-1 text-[13px] text-white/55">Záznamy webinářů pro pedagogy od Vividbooks.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-[13px] font-bold text-white/70">
            <Link to="/webinare" className="hover:text-white">Všechny webináře</Link>
            <Link to="/kontakt" className="hover:text-white">Kontakt</Link>
            <a href="https://www.vividbooks.com" className="hover:text-white">Vividbooks.com</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default DvppLeadMagnetPage;
