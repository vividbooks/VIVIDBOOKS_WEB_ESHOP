import React, { useEffect } from 'react';
import { Mic, Settings, Bot, MapPin, Menu, ListChecks, Send, Globe, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'motion/react';
import { useApp } from '@/app/contexts/AppContext';
import { AgentOrbAvatar } from './ui/AgentOrbAvatar';

export type AssistantTabId =
  | 'dictation'
  | 'tasks'
  | 'agent'
  | 'webOperator'
  | 'outreach'
  | 'scraping'
  | 'map'
  | 'settings';

type TabId = AssistantTabId;

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    title={label}
    className={clsx(
      "flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 group relative",
      active 
        ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" 
        : "text-[#8E8E93] hover:bg-white/10 hover:text-white"
    )}
  >
    <div className={clsx("transition-transform duration-200", active && "scale-100")}>
      {icon}
    </div>
  </button>
);

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  currentTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** Záložky Outreach + Scraping (jen vybrané účty). */
  extendedUi?: boolean;
  /** Plný Web operátor (admin chat + canvas) — stejné účty jako záložka Web v diktování. */
  webOperatorNav?: boolean;
}

function SidebarNav({
  currentTab,
  go,
  agentProcessing,
  extendedUi,
  webOperatorNav,
}: {
  currentTab: TabId;
  go: (t: TabId) => void;
  agentProcessing: boolean;
  extendedUi: boolean;
  webOperatorNav: boolean;
}) {
  return (
    <>
      <nav className="flex-1 flex flex-col items-center gap-4 w-full px-2">
        <NavItem
          active={currentTab === 'dictation'}
          onClick={() => go('dictation')}
          icon={<Mic size={22} />}
          label="Diktování"
        />
        <NavItem
          active={currentTab === 'tasks'}
          onClick={() => go('tasks')}
          icon={<ListChecks size={22} />}
          label="Úkoly"
        />
        {agentProcessing && currentTab === 'agent' ? (
          <AgentOrbAvatar size="sidebar" onClick={() => go('agent')} title="Obchodník pomocník — pracuje…" />
        ) : (
          <NavItem
            active={currentTab === 'agent'}
            onClick={() => go('agent')}
            icon={<Bot size={22} />}
            label="Obchodník pomocník"
          />
        )}
        {webOperatorNav ? (
          <NavItem
            active={currentTab === 'webOperator'}
            onClick={() => go('webOperator')}
            icon={<Sparkles size={22} />}
            label="Web operátor"
          />
        ) : null}
        {extendedUi ? (
          <>
            <NavItem
              active={currentTab === 'outreach'}
              onClick={() => go('outreach')}
              icon={<Send size={22} />}
              label="Outreach"
            />
            <NavItem
              active={currentTab === 'scraping'}
              onClick={() => go('scraping')}
              icon={<Globe size={22} />}
              label="Scraping"
            />
          </>
        ) : null}
        <NavItem
          active={currentTab === 'map'}
          onClick={() => go('map')}
          icon={<MapPin size={22} />}
          label="Mapa škol"
        />
      </nav>
      <div className="mt-auto pt-4 w-full flex justify-center pb-2">
        <NavItem
          active={currentTab === 'settings'}
          onClick={() => go('settings')}
          icon={<Settings size={22} />}
          label="Nastavení"
        />
      </div>
    </>
  );
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  currentTab,
  onTabChange,
  extendedUi = false,
  webOperatorNav = false,
}) => {
  const { agentProcessing, sidebarCollapsed, navDrawerOpen, setNavDrawerOpen, toggleLeftNav } = useApp();

  useEffect(() => {
    setNavDrawerOpen(false);
  }, [currentTab, setNavDrawerOpen]);

  const goDesktop = (t: TabId) => onTabChange(t);
  const goMobileDrawer = (t: TabId) => {
    onTabChange(t);
    setNavDrawerOpen(false);
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden selection:bg-[#0A84FF]/30">
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'hidden md:flex flex-col w-[88px] bg-[#1C1C1E] border-r border-white/5 items-center py-6 shrink-0 z-50 transition-[margin,opacity] duration-200',
          sidebarCollapsed && 'md:hidden',
        )}
      >
        <SidebarNav
          currentTab={currentTab}
          go={goDesktop}
          agentProcessing={agentProcessing}
          extendedUi={extendedUi}
          webOperatorNav={webOperatorNav}
        />
      </aside>

      {/* Mobilní výsuvný levý panel (stejné položky jako desktop) */}
      <>
        <div
          role="presentation"
          className={clsx(
            'md:hidden fixed inset-0 z-[90] bg-black/65 transition-opacity duration-200',
            navDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
          onClick={() => setNavDrawerOpen(false)}
        />
        <aside
          className={clsx(
            'md:hidden fixed left-0 top-0 bottom-0 z-[100] flex w-[88px] flex-col bg-[#1C1C1E] border-r border-white/5 py-6 shadow-2xl transition-transform duration-300 ease-out',
            navDrawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-hidden={!navDrawerOpen}
        >
          <SidebarNav
            currentTab={currentTab}
            go={goMobileDrawer}
            agentProcessing={agentProcessing}
            extendedUi={extendedUi}
            webOperatorNav={webOperatorNav}
          />
        </aside>
      </>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Desktop: když je levý panel sbalený, záložky bez vlastního menu (≠ diktování) potřebují odkud otevřít navigaci */}
        {sidebarCollapsed && currentTab !== 'dictation' && (
          <button
            type="button"
            onClick={toggleLeftNav}
            title="Zobrazit menu"
            className="hidden md:flex fixed left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-[60] h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#2C2C2E] text-white shadow-lg hover:bg-[#3C3C3E] active:scale-[0.98]"
          >
            <Menu size={22} strokeWidth={2} />
          </button>
        )}

        {/* Mobile Header with Tabs - ALWAYS VISIBLE */}
        <div
          className={clsx(
            'md:hidden pt-[calc(env(safe-area-inset-top)+12px)] px-3 pb-3 bg-[#121212] border-b border-white/5 sticky top-0 z-50 shadow-lg shadow-black/40',
            currentTab === 'dictation' && 'hidden',
          )}
        >
             {/* Scrollable Tab Bar for mobile */}
             <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
                <button
                    onClick={() => onTabChange('dictation')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'dictation' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <Mic size={16} />
                    <span>Diktování</span>
                </button>
                <button
                    onClick={() => onTabChange('tasks')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'tasks' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <ListChecks size={16} />
                    <span>Úkoly</span>
                </button>
                <motion.button
                    onClick={() => onTabChange('agent')}
                    animate={
                      agentProcessing && currentTab === 'agent'
                        ? { boxShadow: ['0 10px 25px -5px rgba(34,197,94,0.45)', '0 10px 35px -5px rgba(34,197,94,0.65)', '0 10px 25px -5px rgba(34,197,94,0.45)'] }
                        : {}
                    }
                    transition={agentProcessing && currentTab === 'agent' ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' } : {}}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'agent' && agentProcessing
                          ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/40"
                          : currentTab === 'agent'
                            ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30"
                            : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      {agentProcessing && currentTab === 'agent' ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" />
                      ) : null}
                      <Bot size={16} className="relative z-10" />
                    </span>
                    <span>Obchodník</span>
                </motion.button>
                {webOperatorNav ? (
                  <button
                    type="button"
                    onClick={() => onTabChange('webOperator')}
                    className={clsx(
                      'shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2',
                      currentTab === 'webOperator'
                        ? 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30'
                        : 'bg-[#252525] text-[#8E8E93] active:bg-[#353535]',
                    )}
                  >
                    <Sparkles size={16} />
                    <span>Web</span>
                  </button>
                ) : null}
                {extendedUi ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onTabChange('outreach')}
                      className={clsx(
                        'shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2',
                        currentTab === 'outreach'
                          ? 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30'
                          : 'bg-[#252525] text-[#8E8E93] active:bg-[#353535]',
                      )}
                    >
                      <Send size={16} />
                      <span>Outreach</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTabChange('scraping')}
                      className={clsx(
                        'shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2',
                        currentTab === 'scraping'
                          ? 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30'
                          : 'bg-[#252525] text-[#8E8E93] active:bg-[#353535]',
                      )}
                    >
                      <Globe size={16} />
                      <span>Scraping</span>
                    </button>
                  </>
                ) : null}
                <button
                    onClick={() => onTabChange('map')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'map' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <MapPin size={16} />
                    <span>Mapa</span>
                </button>
                <button
                    onClick={() => onTabChange('settings')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'settings' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <Settings size={16} />
                    <span>Nastavení</span>
                </button>
             </div>
        </div>

        {/* Scrollable Content */}
        <div className={clsx(
          "flex-1 flex flex-col",
          (currentTab === 'dictation' || currentTab === 'agent' || currentTab === 'webOperator' || currentTab === 'tasks' || currentTab === 'outreach' || currentTab === 'scraping' || currentTab === 'map') ? "overflow-hidden" : "overflow-y-auto scrollbar-hide"
        )}>
          <div className={clsx(
            "w-full flex min-h-0 flex-1 flex-col",
            (currentTab === 'tasks' || currentTab === 'agent' || currentTab === 'webOperator' || currentTab === 'outreach' || currentTab === 'scraping' || currentTab === 'map') ? "h-full min-h-0" : "",
            currentTab === 'dictation' ? "h-full max-w-5xl mx-auto" : "",
            currentTab === 'settings' ? "max-w-5xl mx-auto p-5 md:p-10 pb-[100px] md:pb-10" : ""
          )}>
            {children}
          </div>
        </div>

        {/* Mobile Bottom Nav REMOVED */}
      </main>
    </div>
  );
};
