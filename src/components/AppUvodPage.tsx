import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { SEOHead } from './SEOHead';
import { useNovinky } from '../contexts/NovinkyContext';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarCard } from './WebinarCard';
import { useDvppVideos } from '../contexts/DvppVideosContext';
import type { Webinar } from '../data/webinars';
import { useBlogPosts } from '../contexts/BlogContext';

const ff = "'Fenomen Sans', sans-serif";
const cooper = "font-['Cooper_Light',serif]";

function ArrowToSidebar() {
  return (
    <svg
      viewBox="0 0 260 96"
      className="pointer-events-none absolute left-[-150px] top-[-12px] hidden h-[78px] w-[220px] text-[#001161]/70 lg:block xl:left-[-190px] xl:h-[88px] xl:w-[250px]"
      aria-hidden
    >
      <path
        d="M252 28C190 58 103 64 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M16 18 41 14M16 18l16 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length !== 6) return 200;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function isTodayWebinar(day: number, monthNum: number, year: number) {
  const today = new Date();
  return (
    day === today.getDate()
    && monthNum === today.getMonth() + 1
    && year === today.getFullYear()
  );
}

function normalizeFilterText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function webinarMatchesTopic(webinar: Webinar, topic: { id: string; name: string; slug: string }) {
  const haystack = normalizeFilterText([
    webinar.title,
    webinar.subtitle,
    webinar.description,
    ...(webinar.tags ?? []),
    ...(webinar.relatedSubjects ?? []),
  ].filter(Boolean).join(' '));
  const topicTerms = [topic.id, topic.name, topic.slug].map(normalizeFilterText);
  return topicTerms.some((term) => term && haystack.includes(term));
}

/** Samostatná úvodní stránka pro embed v app.vividbooks.com (/app-uvod). */
export function AppUvodPage() {
  const { posts, loading, source } = useNovinky();
  const { webinars, upcoming, loading: webinarsLoading } = useWebinars();
  const { topics, loading: topicsLoading } = useDvppVideos();
  const { posts: blogPosts, loading: blogLoading } = useBlogPosts();
  const [activeWebinarTopic, setActiveWebinarTopic] = React.useState<string | null>(null);

  const newsTiles = useMemo(() => {
    const visible = posts.filter((p) => source === 'static' || (p as { published?: boolean }).published !== false);
    return visible.slice(0, 3);
  }, [posts, source]);

  const todayWebinar = useMemo(() => (
    webinars.find((webinar) => isTodayWebinar(webinar.day, webinar.monthNum, webinar.year)) ?? null
  ), [webinars]);

  const displayedWebinars = useMemo(() => {
    if (!activeWebinarTopic) return upcoming;
    const topic = topics.find((item) => item.id === activeWebinarTopic);
    if (!topic) return webinars;
    return webinars.filter((webinar) => webinarMatchesTopic(webinar, topic));
  }, [activeWebinarTopic, topics, upcoming, webinars]);

  const firstBlogPosts = useMemo(() => blogPosts.slice(0, 3), [blogPosts]);

  return (
    <div className="min-h-[100dvh] bg-white px-4 pb-14 pt-36 md:px-8 md:pt-60">
      <SEOHead
        title="Vítejte ve Vividbooks"
        description="Úvod do aplikace Vividbooks — vyberte předmět nebo prozkoumejte novinky."
        noIndex
      />

      <div className="mx-auto max-w-[920px] text-center">
        <h1
          className={`${cooper} text-[#001161] text-[28px] leading-tight md:text-[40px] mb-8 md:mb-12`}
        >
          <span className="rounded-[10px] bg-[#FFEE84] px-2.5 py-0.5 md:px-3 md:py-1 inline-block">
            Vítejte
          </span>{' '}
          ve Vividbooks!
        </h1>

        <div className="relative mx-auto max-w-[520px]">
          <ArrowToSidebar />
          <p
            className="font-['Fenomen_Sans',sans-serif] text-[#001161]/75 text-[20px] md:text-[30px] max-w-[520px] mx-auto leading-[1.15] mb-5 font-bold"
            style={{ fontFamily: ff }}
          >
            Vyberte si Váš předmět
            <br className="hidden md:block" />
            {' '}v levé liště.
          </p>
          <p
            className="font-['Fenomen_Sans',sans-serif] text-[#001161]/55 text-[14px] md:text-[15px] mb-8 md:mb-10 font-bold"
            style={{ fontFamily: ff }}
          >
            Nebo si otevřete:
          </p>
        </div>

        {/* Rozcestník */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 mb-12 md:mb-14 text-left">
          <a
            href="https://sesit.vividbooks.com/sheet-selector"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col overflow-hidden rounded-[22px] bg-[#FFF7D6] p-5 shadow-sm transition-all hover:scale-[1.01] hover:shadow-md md:p-6 no-underline"
          >
            <p
              className="text-[#001161] text-[17px] md:text-[19px] leading-snug mb-4 font-bold"
              style={{ fontFamily: ff }}
            >
              Pracovní sešit s online rozšířením
            </p>
            <div className="mt-auto flex justify-center">
              <img
                src="/app-uvod/workbooks.png"
                alt=""
                className="h-[150px] w-auto max-w-full object-contain md:h-[190px]"
                loading="lazy"
              />
            </div>
          </a>

          <a
            href="https://app.vividboard.cz"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col overflow-hidden rounded-[22px] bg-[#E4FAF0] p-5 shadow-sm transition-all hover:scale-[1.01] hover:shadow-md md:p-6 no-underline"
          >
            <p
              className="text-[#001161] text-[17px] md:text-[19px] leading-snug mb-4 font-bold"
              style={{ fontFamily: ff }}
            >
              Vytvořte si vlastní interaktivní materiál
            </p>
            <div className="mt-auto flex justify-center">
              <img
                src="/app-uvod/interactive-material.png"
                alt=""
                className="h-[150px] w-auto max-w-full object-contain md:h-[190px]"
                loading="lazy"
              />
            </div>
          </a>
        </div>

        {!webinarsLoading && todayWebinar && (
          <section className="mx-auto mb-12 max-w-[620px] text-left md:mb-14">
            <h2
              className="mb-4 text-center text-[18px] font-bold text-[#001161]/75 md:text-[20px]"
              style={{ fontFamily: ff }}
            >
              Dnešní webinář:
            </h2>
            <WebinarCard webinar={todayWebinar} openInNewTab />
          </section>
        )}
      </div>

      {/* Novinky pod rozcestníkem */}
      <div className="mx-auto max-w-[920px]">
        <h2
          className={`${cooper} text-[#001161] text-[22px] md:text-[26px] text-center mb-6 md:mb-7`}
        >
          Co je nového v aplikaci:
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-[#001161]/30" aria-label="Načítání" />
          </div>
        ) : newsTiles.length === 0 ? (
          <p className="text-center text-[#001161]/50 text-[14px]" style={{ fontFamily: ff }}>
            Zatím tu nejsou žádné novinky.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
            {newsTiles.map((post) => {
              const hasCoverImage = !!post.coverImage;
              const tileBg = post.bgColor ?? '#F0F2F8';
              const lum = luminance(tileBg);
              const isDark = lum < 140;
              const titleColor = isDark ? '#ffffff' : '#001161';

              return (
                <a
                  key={post.id}
                  href={`/novinky/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block no-underline"
                >
                  <article className="overflow-hidden rounded-[22px] shadow-sm transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-lg">
                    <div
                      className="relative"
                      style={{ aspectRatio: '4 / 3', background: tileBg }}
                    >
                      {hasCoverImage && (
                        <img
                          src={post.coverImage}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      {post.tileText && !hasCoverImage && (
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                          <span
                            className={`${cooper} text-center whitespace-pre-line leading-none`}
                            style={{
                              color: titleColor,
                              fontSize: 'clamp(28px, 7vw, 52px)',
                              opacity: 0.95,
                            }}
                          >
                            {post.tileText}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/[0.06]" />
                    </div>
                    <div className="px-4 py-3.5" style={{ background: tileBg }}>
                      <p
                        className="line-clamp-2 text-[13px] font-bold leading-snug md:text-[14px]"
                        style={{ fontFamily: ff, color: titleColor }}
                      >
                        {post.title}
                      </p>
                    </div>
                  </article>
                </a>
              );
            })}
          </div>
        )}
      </div>

      <section className="mx-auto mt-16 max-w-[920px] rounded-[28px] bg-white px-0 pb-4 text-center md:mt-20">
        <h2 className={`${cooper} text-[32px] leading-[1.02] text-[#5B4FD8] md:text-[44px]`}>
          DVPP webináře zdarma
        </h2>

        <div className="mt-8">
          <p className="mb-3 text-[13px] font-bold text-[#5B4FD8]/75" style={{ fontFamily: ff }}>
            Témata:
          </p>
          {!topicsLoading && topics.length > 0 ? (
            <div className="mx-auto flex max-w-[760px] flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setActiveWebinarTopic(null)}
                className={`min-w-[104px] rounded-[6px] px-5 py-3 text-[13px] font-bold transition ${
                  activeWebinarTopic === null
                    ? 'bg-[#5B4FD8] text-white shadow-[0_8px_18px_rgba(91,79,216,0.18)]'
                    : 'bg-[#E6EAF4] text-[#001161]/70 hover:bg-[#DDE3F2] hover:text-[#001161]'
                }`}
                style={{ fontFamily: ff }}
              >
                Vše
              </button>
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setActiveWebinarTopic(topic.id)}
                  className={`min-w-[104px] rounded-[6px] px-5 py-3 text-[13px] font-bold transition ${
                    activeWebinarTopic === topic.id
                      ? 'bg-[#5B4FD8] text-white shadow-[0_8px_18px_rgba(91,79,216,0.18)]'
                      : 'bg-[#E6EAF4] text-[#001161]/70 hover:bg-[#DDE3F2] hover:text-[#001161]'
                  }`}
                  style={{ fontFamily: ff }}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex max-w-[760px] flex-wrap justify-center gap-2">
              {['Fyzika', 'Matematika', 'Chemie', 'Přírodopis', 'Prvouka', 'Český jazyk', 'Vividboard', 'Umělá inteligence', 'Profesní rozvoj', 'Vedení školy', 'Tvorba ŠVP'].map((topic) => (
                <span key={topic} className="min-w-[104px] rounded-[6px] bg-[#E6EAF4] px-5 py-3 text-[13px] font-bold text-[#001161]/70" style={{ fontFamily: ff }}>
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 text-left">
          <h3 className={`${cooper} mb-8 text-center text-[28px] leading-none text-black md:text-[36px]`}>
            {activeWebinarTopic ? 'Všechny webináře' : 'Blížící se webináře'}
          </h3>

          {webinarsLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-[24px] bg-[#F5F6FB] py-16 text-[#001161]/45">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-[14px] font-bold" style={{ fontFamily: ff }}>Načítám webináře…</span>
            </div>
          ) : displayedWebinars.length === 0 ? (
            <p className="rounded-[24px] bg-[#F5F6FB] px-6 py-12 text-center text-[14px] font-bold text-[#001161]/45" style={{ fontFamily: ff }}>
              {activeWebinarTopic
                ? 'Pro vybrané téma tu zatím nejsou žádné webináře.'
                : 'Teď nejsou vypsané žádné blížící se webináře.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
              {displayedWebinars.slice(0, 6).map((webinar) => (
                <WebinarCard key={webinar.id} webinar={webinar} openInNewTab />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-[920px] md:mt-20">
        <h2 className={`${cooper} mb-8 text-center text-[28px] leading-none text-[#001161] md:text-[36px]`}>
          Blog
        </h2>

        {blogLoading ? (
          <div className="flex items-center justify-center gap-3 rounded-[24px] bg-[#F5F6FB] py-16 text-[#001161]/45">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[14px] font-bold" style={{ fontFamily: ff }}>Načítám články…</span>
          </div>
        ) : firstBlogPosts.length === 0 ? (
          <p className="rounded-[24px] bg-[#F5F6FB] px-6 py-12 text-center text-[14px] font-bold text-[#001161]/45" style={{ fontFamily: ff }}>
            Zatím tu nejsou žádné články.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
            {firstBlogPosts.map((post) => (
              <a
                key={post.id}
                href={`/blog/${post.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-[22px] bg-white p-0 no-underline transition-all hover:scale-[1.01]"
              >
                <div className="mb-4 overflow-hidden rounded-[16px] bg-[#E6EAF4]">
                  <img
                    src={post.coverImage}
                    alt=""
                    className="block w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ aspectRatio: '16 / 10' }}
                    loading="lazy"
                  />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#5B4FD8]" style={{ fontFamily: ff }}>
                    {post.category}
                  </span>
                  <span className="text-[#001161]/20">·</span>
                  <span className="text-[12px] text-[#001161]/40" style={{ fontFamily: ff }}>
                    {post.readTime}{' min čtení'}
                  </span>
                </div>
                <h3 className="mb-2 text-[15px] font-bold leading-snug text-[#001161] transition-opacity group-hover:opacity-70 md:text-[17px]" style={{ fontFamily: ff }}>
                  {post.title}
                </h3>
                <p className="line-clamp-3 text-[13px] leading-relaxed text-[#001161]/60" style={{ fontFamily: ff }}>
                  {post.excerpt}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
