import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import {
  COOPER_ACCESS_INTRO_HEADING_STYLE,
  COOPER_ACCESS_INTRO_MUTED_STYLE,
} from './FyzikaAccessJourney';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

export type SubjectTabContentOverride = {
  contentHeadline?: string;
  contentRichText?: string;
  contentLinkUrl?: string;
  contentLinkLabel?: string;
};

export type SubjectExtraTab = {
  id: string;
  tabText: string;
  contentHeadline: string;
  contentRichText: string;
  contentImage?: string;
  /** Výchozí cover — u screenshotů aplikací použij contain. */
  contentImageFit?: 'cover' | 'contain';
  bgColor?: string;
  order?: number;
  contentLinkUrl?: string;
  contentLinkLabel?: string;
};

function applyTabOverrides(items: any[], overrides?: Record<string, SubjectTabContentOverride>) {
  if (!overrides || Object.keys(overrides).length === 0) return items;
  return items.map((tab) => {
    const key = String(tab.tabText ?? '').trim();
    const patch = overrides[key];
    return patch ? { ...tab, ...patch } : tab;
  });
}

function mergeExtraTabs(items: any[], extraTabs?: SubjectExtraTab[]) {
  if (!extraTabs?.length) return items;
  const merged = [
    ...items,
    ...extraTabs.map((tab, index) => ({
      ...tab,
      order: tab.order ?? 900 + index,
    })),
  ];
  return merged.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function filterExcludedTabs(items: any[], excludeTabTexts?: string[]) {
  if (!excludeTabTexts?.length) return items;
  const excluded = new Set(excludeTabTexts.map((text) => text.trim()));
  return items.filter((tab) => !excluded.has(String(tab.tabText ?? '').trim()));
}

function tabImageMaxHeight(tab: { contentImageFit?: 'cover' | 'contain' }) {
  return tab.contentImageFit === 'contain' ? '320px' : '240px';
}

function tabImageObjectFit(tab: { contentImageFit?: 'cover' | 'contain' }): 'cover' | 'contain' {
  return tab.contentImageFit === 'contain' ? 'contain' : 'cover';
}

const ECOSYSTEM_HEADING_TITLE_DEFAULT = 'U\u010debnice jako ekosyst\u00e9m: ';
const ECOSYSTEM_HEADING_BODY_DEFAULT =
  'Nab\u00edz\u00edme komplexn\u00ed digit\u00e1ln\u00ed p\u0159\u00edstup pro celou \u0161kolu, v\u0161e co u\u010ditel\u00e9 a \u017e\u00e1ci pot\u0159ebuj\u00ed v jedn\u00e9 aplikaci.';

function EcosystemHeadingBlock({
  center,
  title,
  body,
  stacked = false,
  light = false,
}: {
  center: boolean;
  title: string;
  body: string;
  stacked?: boolean;
  light?: boolean;
}) {
  const wrapClass = center ? 'mx-auto max-w-[820px] text-center' : '';
  const headingStyle: React.CSSProperties = {
    ...COOPER_ACCESS_INTRO_HEADING_STYLE,
    color: light ? '#001161' : '#fff',
  };
  const mutedStyle: React.CSSProperties = {
    ...COOPER_ACCESS_INTRO_MUTED_STYLE,
    color: light ? 'rgba(0,17,97,0.45)' : 'rgba(255,255,255,0.55)',
  };
  return (
    <h2 className={`leading-tight ${wrapClass}`} style={headingStyle}>
      {stacked ? (
        <>
          <span className="block">{title}</span>
          <span className="mt-2 block" style={mutedStyle}>
            {body}
          </span>
        </>
      ) : (
        <>
          {title}
          <span style={mutedStyle}>{body}</span>
        </>
      )}
    </h2>
  );
}

function TabContentLink({ tab, light }: { tab: any; light: boolean }) {
  if (!tab.contentLinkUrl || !tab.contentLinkLabel) return null;
  const isExternal = /^https?:\/\//i.test(tab.contentLinkUrl);
  return (
    <a
      href={tab.contentLinkUrl}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className={`mt-4 inline-flex items-center gap-1.5 text-[14px] font-bold transition hover:opacity-75 ${
        light ? 'text-[#4B48CC]' : 'text-[#F9E000]'
      }`}
      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
    >
      {tab.contentLinkLabel}
    </a>
  );
}

interface SubjectTabsSectionProps {
  subject: string;
  displayName: string;
  light?: boolean;
  ecosystemHeading?: boolean;
  /** Vycentruje nadpis ekosystému (kampaňová LP). */
  ecosystemHeadingCenter?: boolean;
  /** Skryje nadpis „Co vše obsahuje naše …?“ v levém sloupci / na mobilu. */
  hideSectionHeading?: boolean;
  /** Přepis obsahu konkrétních záložek (klíč = tabText), např. kampaňová LP. */
  tabOverrides?: Record<string, SubjectTabContentOverride>;
  /** Další záložky doplněné navíc k CMS (např. kampaň). */
  extraTabs?: SubjectExtraTab[];
  /** Vynechá vybrané záložky podle tabText (např. kampaň bez Pracovní sešity). */
  excludeTabTexts?: string[];
  ecosystemHeadingTitle?: string;
  ecosystemHeadingBody?: string;
  /** Nadpis a popis ekosystému na dvou řádcích (kampaňová LP). */
  ecosystemHeadingStacked?: boolean;
}

export function SubjectTabsSection({
  subject,
  displayName,
  light = false,
  ecosystemHeading = false,
  ecosystemHeadingCenter = false,
  hideSectionHeading = false,
  tabOverrides,
  extraTabs,
  excludeTabTexts,
  ecosystemHeadingTitle = ECOSYSTEM_HEADING_TITLE_DEFAULT,
  ecosystemHeadingBody = ECOSYSTEM_HEADING_BODY_DEFAULT,
  ecosystemHeadingStacked = false,
}: SubjectTabsSectionProps) {
  const [tabs, setTabs] = useState<any[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const swipeStartX = useRef<number | null>(null);
  const windowWidth = useWindowWidth();
  const mobile = windowWidth < 768;

  useEffect(() => {
    // Normalize subject name to match DB keys
    const normalizeSubject = (s: string): string => {
      const lower = s.toLowerCase();
      if (lower.includes('matematika') && (lower.includes('1') || lower.includes('první') || lower.includes('prvn'))) return 'Matematika 1';
      if (lower.includes('matematika') && (lower.includes('2') || lower.includes('druhý') || lower.includes('druh'))) return 'Matematika 2';
      if (lower.includes('matematika')) return 'Matematika 1';
      return s.replace(/[\s\-]+\d+\.?\s*stupe.*$/i, '').trim();
    };
    const fetchSubject = normalizeSubject(subject);
    setLoading(true);
    fetch(`${SERVER}/public/tabs?subject=${encodeURIComponent(fetchSubject)}`, { headers: AUTH })
      .then(r => r.json())
      .then(d => {
        const items = filterExcludedTabs(
          mergeExtraTabs(applyTabOverrides(d.items || [], tabOverrides), extraTabs),
          excludeTabTexts,
        );
        setTabs(items);
        if (items.length > 0) setActiveTabId(items[0].id);
      })
      .catch(() => setTabs([]))
      .finally(() => setLoading(false));
  }, [subject, tabOverrides, extraTabs, excludeTabTexts]);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTabId);

  const selectTabByIndex = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    setActiveTabId(tab.id);
  };

  const goToPreviousTab = () => selectTabByIndex(Math.max(0, activeTabIndex - 1));
  const goToNextTab = () => selectTabByIndex(Math.min(tabs.length - 1, activeTabIndex + 1));

  const handleSwipeStart = (clientX: number) => {
    swipeStartX.current = clientX;
  };

  const handleSwipeEnd = (clientX: number) => {
    const start = swipeStartX.current;
    swipeStartX.current = null;
    if (start == null) return;
    const delta = clientX - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goToNextTab();
    else goToPreviousTab();
  };

  if (loading) {
    return (
      <div style={{ background: light ? '#f5f7fd' : '#243653' }} className="py-16 px-6 md:px-12 flex items-center justify-center min-h-[240px]">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full animate-pulse ${light ? 'bg-[#001161]/20' : 'bg-white/40'}`} style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (tabs.length === 0) return null;

  const cardBg = activeTab?.bgColor || '#ffffff';

  /* ─── MOBILNÍ LAYOUT ─── */
  if (mobile) {
    return (
      <div style={{ background: light ? '#f5f7fd' : '#243653' }} className="py-10 px-4">
        {ecosystemHeading ? (
          <div className={`mb-6 ${ecosystemHeadingCenter ? 'text-center' : ''}`}>
            <EcosystemHeadingBlock
              center={ecosystemHeadingCenter}
              title={ecosystemHeadingTitle}
              body={ecosystemHeadingBody}
              stacked={ecosystemHeadingStacked}
              light={light}
            />
          </div>
        ) : null}

        {!hideSectionHeading ? (
          <h2
            className="leading-tight mb-6"
            style={{
              fontFamily: "'Cooper Light', serif",
              fontSize: 'clamp(24px, 5vw, 28px)',
              fontWeight: 400,
              lineHeight: 1.15,
              color: light ? '#001161' : '#fff',
            }}
          >
            Co vše obsahuje naše {displayName}?
          </h2>
        ) : null}

        <div className="mb-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={goToPreviousTab}
            disabled={activeTabIndex <= 0}
            aria-label="Předchozí slide"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 ${
              light
                ? 'bg-white text-[#001161] shadow-[0_4px_16px_rgba(0,17,97,0.12)] ring-2 ring-[#001161]/10'
                : 'bg-[#F9E000] text-[#001161] shadow-[0_4px_18px_rgba(0,0,0,0.22)]'
            }`}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </button>

          <p
            className="text-[12px] font-bold uppercase tracking-[0.12em]"
            style={{
              fontFamily: "'Fenomen Sans', sans-serif",
              color: light ? 'rgba(0,17,97,0.38)' : 'rgba(255,255,255,0.45)',
            }}
          >
            {activeTabIndex + 1} / {tabs.length}
          </p>

          <button
            type="button"
            onClick={goToNextTab}
            disabled={activeTabIndex < 0 || activeTabIndex >= tabs.length - 1}
            aria-label="Další slide"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 ${
              light
                ? 'bg-white text-[#001161] shadow-[0_4px_16px_rgba(0,17,97,0.12)] ring-2 ring-[#001161]/10'
                : 'bg-[#F9E000] text-[#001161] shadow-[0_4px_18px_rgba(0,0,0,0.22)]'
            }`}
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {activeTab && (
          <motion.div
            key={activeTab.id}
            className="rounded-[24px] overflow-hidden touch-pan-y"
            style={{ background: cardBg }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            onTouchStart={(event) => handleSwipeStart(event.touches[0]?.clientX ?? 0)}
            onTouchEnd={(event) => handleSwipeEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
            {activeTab.contentImage && (
              <div
                className={`w-full overflow-hidden ${tabImageObjectFit(activeTab) === 'contain' ? 'bg-white' : ''}`}
                style={{ maxHeight: tabImageMaxHeight(activeTab) }}
              >
                <img
                  src={activeTab.contentImage}
                  alt={activeTab.contentHeadline || activeTab.tabText}
                  className={`w-full ${tabImageObjectFit(activeTab) === 'contain' ? 'object-contain object-center' : 'object-cover object-top'}`}
                  style={{ maxHeight: tabImageMaxHeight(activeTab) }}
                />
              </div>
            )}

            <div className="p-5">
              {activeTab.contentHeadline && (
                <h3
                  className="text-[#001161] text-[22px] leading-tight mb-3"
                  style={{ fontFamily: "'Cooper Light', serif" }}
                >
                  {activeTab.contentHeadline}
                </h3>
              )}

              {activeTab.contentRichText && (
                <>
                  <div
                    className="text-[#001161]/70 text-[14px] leading-relaxed whitespace-pre-line pb-3"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    {activeTab.contentRichText}
                  </div>
                  <TabContentLink tab={activeTab} light={light} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  /* ─── DESKTOP / TABLET LAYOUT ─── */
  return (
    <div style={{ background: light ? '#f5f7fd' : '#243653' }} className="py-14 px-6 md:px-12">
      {/* Ecosystem heading — zobrazí se jen když je prop true */}
      {ecosystemHeading && (
        <div className={`mx-auto max-w-[1200px] pb-10 ${ecosystemHeadingCenter ? 'text-center' : ''}`}>
          <EcosystemHeadingBlock
            center={ecosystemHeadingCenter}
            title={ecosystemHeadingTitle}
            body={ecosystemHeadingBody}
            stacked={ecosystemHeadingStacked}
            light={light}
          />
        </div>
      )}
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-7 lg:flex-row lg:gap-14">
        {/* Left menu — od lg vedle obsahu jako na webu */}
        <div className="w-full shrink-0 lg:w-[240px]">
          {!hideSectionHeading ? (
            <h2
              className="mb-6 leading-tight lg:mb-8"
              style={{
                fontFamily: "'Cooper Light', serif",
                fontSize: 'clamp(26px, 2.75vw, 32px)',
                fontWeight: 400,
                lineHeight: 1.15,
                color: light ? '#001161' : '#fff',
              }}
            >
              Co vše obsahuje naše {displayName}?
            </h2>
          ) : null}
          <nav className="flex flex-row flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className="text-left rounded-xl px-4 py-2.5 transition-all cursor-pointer lg:w-full"
                style={{
                  fontFamily: "'Fenomen Sans', sans-serif",
                  fontSize: '15px',
                  fontWeight: activeTabId === tab.id ? 700 : 400,
                  background: activeTabId === tab.id ? (light ? '#001161' : '#F9E000') : 'transparent',
                  color: activeTabId === tab.id ? (light ? '#fff' : '#001161') : (light ? 'rgba(0,17,97,0.5)' : 'rgba(255,255,255,0.65)'),
                }}
              >
                {tab.tabText}
              </button>
            ))}
          </nav>
        </div>

        {/* Right content card */}
        {activeTab && (
          <motion.div
            key={activeTab.id}
            className="w-full min-w-0 flex-1 rounded-[32px] flex flex-col overflow-hidden md:flex-row"
            style={{ background: cardBg, minHeight: '450px' }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Text — levá polovina */}
            <div className="w-full shrink-0 overflow-y-auto p-8 md:w-1/2 md:min-w-0 md:p-10">
              {activeTab.contentHeadline && (
                <h3
                  className="text-[#001161] text-[26px] md:text-[32px] leading-tight mb-5"
                  style={{ fontFamily: "'Cooper Light', serif" }}
                >
                  {activeTab.contentHeadline}
                </h3>
              )}
              {activeTab.contentRichText && (
                <div
                  className="text-[#001161]/70 text-[15px] leading-relaxed whitespace-pre-line"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                >
                  {activeTab.contentRichText}
                </div>
              )}
              <TabContentLink tab={activeTab} light={light} />
            </div>

            {/* Obrázek — pravá polovina */}
            {activeTab.contentImage && (
              <motion.div
                className={`w-full shrink-0 self-stretch overflow-hidden md:w-1/2 ${tabImageObjectFit(activeTab) === 'contain' ? 'bg-white' : ''}`}
              >
                <img
                  src={activeTab.contentImage}
                  alt={activeTab.contentHeadline || activeTab.tabText}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: tabImageObjectFit(activeTab),
                    objectPosition: tabImageObjectFit(activeTab) === 'contain' ? 'center' : 'top left',
                    display: 'block',
                  }}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}