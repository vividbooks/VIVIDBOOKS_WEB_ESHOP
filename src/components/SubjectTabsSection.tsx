import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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

interface SubjectTabsSectionProps {
  subject: string;
  displayName: string;
  light?: boolean;
  ecosystemHeading?: boolean;
}

export function SubjectTabsSection({ subject, displayName, light = false, ecosystemHeading = false }: SubjectTabsSectionProps) {
  const [tabs, setTabs] = useState<any[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const windowWidth = useWindowWidth();
  const wide = windowWidth >= 1300;
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
        const items = d.items || [];
        setTabs(items);
        if (items.length > 0) setActiveTabId(items[0].id);
      })
      .catch(() => setTabs([]))
      .finally(() => setLoading(false));
  }, [subject]);

  useEffect(() => { setMobileExpanded(false); }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId);

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

        <div
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className="shrink-0 px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all cursor-pointer"
              style={{
                fontFamily: "'Fenomen Sans', sans-serif",
                fontWeight: activeTabId === tab.id ? 700 : 400,
                background: activeTabId === tab.id ? (light ? '#001161' : '#F9E000') : (light ? 'rgba(0,17,97,0.07)' : 'rgba(255,255,255,0.1)'),
                color: activeTabId === tab.id ? (light ? '#fff' : '#001161') : (light ? 'rgba(0,17,97,0.55)' : 'rgba(255,255,255,0.75)'),
                border: activeTabId === tab.id ? 'none' : `1px solid ${light ? 'rgba(0,17,97,0.12)' : 'rgba(255,255,255,0.15)'}`,
              }}
            >
              {tab.tabText}
            </button>
          ))}
        </div>

        {activeTab && (
          <motion.div
            key={activeTab.id}
            className="mt-4 rounded-[24px] overflow-hidden"
            style={{ background: cardBg }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab.contentImage && (
              <div className="w-full" style={{ maxHeight: '240px', overflow: 'hidden' }}>
                <img
                  src={activeTab.contentImage}
                  alt={activeTab.contentHeadline || activeTab.tabText}
                  className="w-full object-cover object-top"
                  style={{ maxHeight: '240px' }}
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
                  <motion.div
                    className="overflow-hidden"
                    initial={false}
                    animate={{ height: mobileExpanded ? 'auto' : 0, opacity: mobileExpanded ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div
                      className="text-[#001161]/70 text-[14px] leading-relaxed whitespace-pre-line pb-3"
                      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    >
                      {activeTab.contentRichText}
                    </div>
                  </motion.div>

                  <button
                    onClick={() => setMobileExpanded(p => !p)}
                    className="inline-flex items-center gap-1.5 text-[#001161] text-[13px] font-bold cursor-pointer transition-opacity hover:opacity-70"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    {mobileExpanded ? 'Méně info' : 'Více info'}
                    <svg
                      className="w-3.5 h-3.5 transition-transform"
                      style={{ transform: mobileExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
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
        <div className="max-w-[1200px] mx-auto pb-10">
          <h2 className="leading-tight max-w-[720px]" style={COOPER_ACCESS_INTRO_HEADING_STYLE}>
            {'U\u010debnice jako ekosyst\u00e9m: '}
            <span style={COOPER_ACCESS_INTRO_MUTED_STYLE}>
              {'Nab\u00edz\u00edme komplexn\u00ed digit\u00e1ln\u00ed p\u0159\u00edstup pro celou \u0161kolu, v\u0161e co u\u010ditel\u00e9 a \u017e\u00e1ci pot\u0159ebuj\u00ed v jedn\u00e9 aplikaci.'}
            </span>
          </h2>
        </div>
      )}
      <div
        className="max-w-[1200px] mx-auto"
        style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', gap: wide ? '56px' : '28px', alignItems: 'flex-start' }}
      >
        {/* Left menu */}
        <div style={{ width: wide ? '240px' : '100%', flexShrink: 0 }}>
          <h2
            className="leading-tight mb-8"
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
          <nav style={{ display: 'flex', flexDirection: wide ? 'column' : 'row', flexWrap: 'wrap', gap: wide ? '2px' : '6px' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className="text-left px-4 py-2.5 rounded-xl transition-all cursor-pointer"
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
            className="flex-1 rounded-[32px] flex flex-row overflow-hidden"
            style={{ background: cardBg, minHeight: '450px' }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Text — levá polovina */}
            <div
              className="p-8 md:p-10 overflow-y-auto"
              style={{ width: '50%', flexShrink: 0, minWidth: 0 }}
            >
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
            </div>

            {/* Obrázek — pravá polovina */}
            {activeTab.contentImage && (
              <div
                className="overflow-hidden self-stretch"
                style={{ width: '50%', flexShrink: 0 }}
              >
                <img
                  src={activeTab.contentImage}
                  alt={activeTab.contentHeadline || activeTab.tabText}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left', display: 'block' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}