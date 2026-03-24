import React from 'react';
import { Mic, CheckSquare, Settings, Bot, Send, Search, MapPin, Briefcase } from 'lucide-react';
import clsx from 'clsx';

export type AssistantTabId =
  | 'dictation'
  | 'tasks'
  | 'agent'
  | 'web-operator'
  | 'outreach'
  | 'scraping'
  | 'map'
  | 'settings';

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
      'flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 group relative',
      active ? 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30' : 'text-[#8E8E93] hover:bg-white/10 hover:text-white'
    )}
  >
    <div className={clsx('transition-transform duration-200', active && 'scale-100')}>{icon}</div>
  </button>
);

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  currentTab: AssistantTabId;
  onTabChange: (tab: AssistantTabId) => void;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({ children, currentTab, onTabChange }) => {
  const mainTabs: Array<{ id: AssistantTabId; label: string; icon: React.ReactNode }> = [
    { id: 'dictation', label: 'Diktování', icon: <Mic size={22} /> },
    { id: 'web-operator', label: 'Web operátor', icon: <Briefcase size={22} /> },
    { id: 'agent', label: 'Obchodník pomocník', icon: <Bot size={22} /> },
    { id: 'tasks', label: 'Úkoly', icon: <CheckSquare size={22} /> },
    { id: 'outreach', label: 'Outreach', icon: <Send size={22} /> },
    { id: 'scraping', label: 'Scraping', icon: <Search size={22} /> },
    { id: 'map', label: 'Mapa škol', icon: <MapPin size={22} /> },
  ];

  const fullHeightTabs = new Set<AssistantTabId>(['tasks', 'agent', 'web-operator', 'outreach', 'scraping', 'map']);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 bg-black text-white overflow-hidden selection:bg-[#0A84FF]/30">
      <aside className="hidden md:flex flex-col w-[88px] bg-[#1C1C1E] border-r border-white/5 items-center py-6 shrink-0 z-50">
        <nav className="flex-1 flex flex-col items-center gap-4 w-full px-2">
          {mainTabs.map((tab) => (
            <NavItem
              key={tab.id}
              active={currentTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </nav>

        <div className="mt-auto pt-4 w-full flex justify-center pb-2">
          <NavItem
            active={currentTab === 'settings'}
            onClick={() => onTabChange('settings')}
            icon={<Settings size={22} />}
            label="Nastavení"
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 min-h-0 overflow-hidden">
        <div className="md:hidden pt-[calc(env(safe-area-inset-top)+12px)] px-3 pb-3 bg-[#121212] border-b border-white/5 sticky top-0 z-50 shadow-lg shadow-black/40">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={clsx(
                  'shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2',
                  currentTab === tab.id ? 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30' : 'bg-[#252525] text-[#8E8E93] active:bg-[#353535]'
                )}
              >
                {React.isValidElement(tab.icon) ? React.cloneElement(tab.icon as React.ReactElement<any>, { size: 16 }) : tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
            <button
              onClick={() => onTabChange('settings')}
              className={clsx(
                'shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2',
                currentTab === 'settings' ? 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30' : 'bg-[#252525] text-[#8E8E93] active:bg-[#353535]'
              )}
            >
              <Settings size={16} />
              <span>Nastavení</span>
            </button>
          </div>
        </div>

        <div className={clsx('flex-1 flex flex-col min-h-0', currentTab === 'settings' ? 'overflow-y-auto scrollbar-hide' : 'overflow-hidden')}>
          <div
            className={clsx(
              'w-full flex-1 flex flex-col min-h-0',
              fullHeightTabs.has(currentTab) ? 'h-full min-h-0' : '',
              currentTab === 'dictation' ? 'h-full min-h-0 max-w-5xl mx-auto' : '',
              currentTab === 'settings' ? 'max-w-5xl mx-auto p-5 md:p-10 pb-[100px] md:pb-10' : ''
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
