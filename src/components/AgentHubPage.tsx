import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Megaphone,
  ChevronRight,
  Bot,
  Search,
  Image as ImageIcon,
  Home,
  Layers,
  X,
  Wand2,
} from 'lucide-react';
import { AdminAgentPage } from './admin/AdminAgentPage';
import MarketingAgent from './admin/MarketingAgent';
import SeoAgent from './admin/SeoAgent';
import ImageAgentPage from './admin/ImageAgentPage';
import { SEOHead } from './SEOHead';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

type AgentId = 'web' | 'marketing' | 'seo' | 'image';

interface AgentDef {
  id: AgentId;
  label: string;
  sublabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  dotColor: string;
}

const AGENTS: AgentDef[] = [
  {
    id: 'web',
    label: 'Web operátor',
    sublabel: 'CMS · Operace · Delegace',
    description: 'Hlavní chat pro řízení webu a delegaci specialistům.',
    icon: Zap,
    color: '#001161',
    dotColor: '#60a5fa',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    sublabel: 'Texty · Kampaně · RAG',
    description: 'Píše kampaně, mailingy a webové texty v brand voice.',
    icon: Megaphone,
    color: '#7C3AED',
    dotColor: '#a78bfa',
  },
  {
    id: 'seo',
    label: 'SEO stratég',
    sublabel: 'Briefy · Metadata · Struktura',
    description: 'Připraví SEO brief, metadata a strukturu stránky.',
    icon: Search,
    color: '#D97706',
    dotColor: '#fbbf24',
  },
  {
    id: 'image',
    label: 'Image agent',
    sublabel: 'Koláže · Galerie · Vizuály',
    description: 'Tvoří vizuály, koláže a image workflow.',
    icon: ImageIcon,
    color: '#DB2777',
    dotColor: '#f472b6',
  },
];

const SECONDARY_AGENTS = AGENTS.filter(agent => agent.id !== 'web');

export function AgentHubPage() {
  const [active, setActive] = useState<AgentId>('web');
  const [isDesktop, setIsDesktop] = useState(false);
  const [specialistsOpen, setSpecialistsOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    let theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    theme.content =
      active === 'web' ? '#f5f6fa'
      : active === 'marketing' ? '#f5f6fa'
      : active === 'seo' ? '#f5f6fa'
      : '#f5f6fa';
  }, [active]);

  const currentAgent = AGENTS.find(a => a.id === active)!;

  const renderDesktopView = (agentId: AgentId) => {
    if (agentId === 'web') return <AdminAgentPage />;
    if (agentId === 'marketing') return <MarketingAgent />;
    if (agentId === 'seo') return <SeoAgent />;
    return <ImageAgentPage />;
  };

  const renderMobileView = (agentId: AgentId) => {
    if (agentId === 'web') return <AdminAgentPage hubMode onOpenAgentSheet={() => setSpecialistsOpen(true)} />;
    if (agentId === 'marketing') return <MarketingAgent />;
    if (agentId === 'seo') return <SeoAgent />;
    return <ImageAgentPage />;
  };

  if (!isDesktop) {
    return (
      <>
        <SEOHead title="Agent Hub" path="/hub" description="Interní nástroj Vividbooks." noIndex />
      <div
        className="fixed inset-0 overflow-hidden"
        style={{
          background: '#f5f6fa',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <div className="relative h-full min-h-0 w-full overflow-hidden flex flex-col">
          {AGENTS.map(agent => (
            <div
              key={agent.id}
              className={`${active === agent.id ? 'block' : 'hidden'} absolute inset-0`}
            >
              {renderMobileView(agent.id)}
            </div>
          ))}

          {active !== 'web' && (
            <div className="pointer-events-none absolute inset-x-0 top-2 z-[45] flex justify-center px-4">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/70 bg-white/88 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
                <button
                  onClick={() => setActive('web')}
                  className="flex items-center gap-1.5 rounded-full bg-[#001161] px-3 py-2 text-white text-[11px] font-bold cursor-pointer"
                  style={FF}
                >
                  <Home className="w-3.5 h-3.5" />
                  Operátor
                </button>
                <button
                  onClick={() => setSpecialistsOpen(true)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold text-[#001161]/60 hover:text-[#001161] cursor-pointer"
                  style={FF}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {currentAgent.label}
                </button>
              </div>
            </div>
          )}

          <AnimatePresence>
            {specialistsOpen && (
              <motion.div
                className="absolute inset-0 z-[70] flex flex-col justify-end"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-[#001161]/18 backdrop-blur-[2px]" onClick={() => setSpecialistsOpen(false)} />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="relative rounded-t-[28px] bg-[#fbfbfd] px-4 pt-3 pb-[max(18px,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(15,23,42,0.16)]"
                >
                  <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#001161]/10" />
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p style={{ ...FF, fontSize: 10, fontWeight: 800, color: 'rgba(0,17,97,0.35)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                        Specialisti
                      </p>
                      <h2 style={{ ...FF, fontSize: 20, fontWeight: 900, color: '#001161', letterSpacing: '-0.03em' }}>
                        Vyberte pracovní mód
                      </h2>
                    </div>
                    <button
                      onClick={() => setSpecialistsOpen(false)}
                      className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#001161]/40 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setActive('web');
                      setSpecialistsOpen(false);
                    }}
                    className="w-full mb-2 rounded-[22px] border border-[#001161]/10 bg-white px-4 py-4 text-left cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-[16px] bg-[#001161] flex items-center justify-center shrink-0">
                        <Zap className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div style={{ ...FF, fontSize: 14, fontWeight: 900, color: '#001161' }}>Web operátor</div>
                        <div style={{ ...FF, fontSize: 11, color: 'rgba(0,17,97,0.45)', marginTop: 2, lineHeight: 1.4 }}>
                          Hlavní chat pro řízení webu a delegaci úkolů
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#001161]/25 shrink-0" />
                    </div>
                  </button>

                  <div className="mt-2 space-y-2">
                    {SECONDARY_AGENTS.map(agent => {
                      const Icon = agent.id === 'image' ? Wand2 : agent.icon;
                      return (
                        <button
                          key={agent.id}
                          onClick={() => {
                            setActive(agent.id);
                            setSpecialistsOpen(false);
                          }}
                          className="w-full rounded-[22px] border px-4 py-4 text-left cursor-pointer"
                          style={{ borderColor: `${agent.color}18`, background: 'white' }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0" style={{ background: `${agent.color}` }}>
                              <Icon className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div style={{ ...FF, fontSize: 14, fontWeight: 900, color: '#001161' }}>{agent.label}</div>
                              <div style={{ ...FF, fontSize: 11, color: 'rgba(0,17,97,0.45)', marginTop: 2, lineHeight: 1.4 }}>
                                {agent.description}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#001161]/25 shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title="Agent Hub" path="/hub" description="Interní nástroj Vividbooks." noIndex />
    <div className="fixed inset-0 flex min-h-0 max-h-dvh overflow-hidden" style={{ background: '#f5f6fa' }}>
      <aside
        className="flex flex-col shrink-0"
        style={{ width: 248, background: '#0a0e2e' }}
      >
        <div className="px-5 flex items-center justify-between" style={{ paddingTop: 36, paddingBottom: 20 }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.35)' }} />
              <span style={{ ...FF, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Agent Hub
              </span>
            </div>
            <span style={{ ...FF, fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              Vividbooks
            </span>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginInline: 20, marginBottom: 14 }} />

        <span style={{ ...FF, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', paddingInline: 20, marginBottom: 6 }}>
          Agenti
        </span>

        <div className="flex flex-col gap-1.5 px-3">
          {AGENTS.map((ag) => {
            const Icon = ag.icon;
            const isActive = active === ag.id;
            return (
              <button
                key={ag.id}
                onClick={() => setActive(ag.id)}
                className="w-full text-left flex items-center gap-3 cursor-pointer transition-all rounded-[13px]"
                style={{
                  padding: '10px 12px',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0 rounded-[9px]"
                  style={{
                    width: 36, height: 36,
                    background: isActive ? ag.color : 'rgba(255,255,255,0.07)',
                    transition: 'background 0.2s',
                  }}
                >
                  <Icon style={{ width: 17, height: 17, color: '#fff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ ...FF, fontSize: 13.5, fontWeight: 700, color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', lineHeight: 1.25 }}>
                    {ag.label}
                  </div>
                  <div style={{ ...FF, fontSize: 10.5, color: isActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                    {ag.sublabel}
                  </div>
                </div>
                {isActive && (
                  <ChevronRight style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <div style={{ padding: '16px 20px 28px' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />
          <div className="flex items-center gap-2">
            <div
              className="rounded-full animate-pulse"
              style={{ width: 7, height: 7, background: currentAgent.dotColor }}
            />
            <span style={{ ...FF, fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
              {currentAgent.label} · online
            </span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.15 }}
              className="h-full min-h-0 w-full overflow-hidden"
              style={{ width: '100%', height: '100%' }}
            >
              {renderDesktopView(active)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
    </>
  );
}