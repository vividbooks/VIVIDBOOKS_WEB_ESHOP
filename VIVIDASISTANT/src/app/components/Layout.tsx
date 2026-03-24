import React from 'react';
import { Mic, CheckSquare, Settings, Bot, Send, Search, MapPin } from 'lucide-react';
import clsx from 'clsx';

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
  currentTab: 'dictation' | 'tasks' | 'agent' | 'outreach' | 'scraping' | 'map' | 'settings';
  onTabChange: (tab: 'dictation' | 'tasks' | 'agent' | 'outreach' | 'scraping' | 'map' | 'settings') => void;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({ 
  children, 
  currentTab, 
  onTabChange
}) => {
  return (
    <div className="flex h-screen bg-black text-white overflow-hidden selection:bg-[#0A84FF]/30">
      {/* Desktop Sidebar - Mini Version */}
      <aside className="hidden md:flex flex-col w-[88px] bg-[#1C1C1E] border-r border-white/5 items-center py-6 shrink-0 z-50">
        {/* Logo Icon Removed */}


        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center gap-4 w-full px-2">
          <NavItem 
            active={currentTab === 'dictation'} 
            onClick={() => onTabChange('dictation')}
            icon={<Mic size={22} />}
            label="Diktování"
          />
          <NavItem 
            active={currentTab === 'agent'} 
            onClick={() => onTabChange('agent')}
            icon={<Bot size={22} />}
            label="Agent"
          />
          <NavItem 
            active={currentTab === 'tasks'} 
            onClick={() => onTabChange('tasks')}
            icon={<CheckSquare size={22} />}
            label="Úkoly"
          />
          <NavItem 
            active={currentTab === 'outreach'} 
            onClick={() => onTabChange('outreach')}
            icon={<Send size={22} />}
            label="Outreach"
          />
          <NavItem 
            active={currentTab === 'scraping'} 
            onClick={() => onTabChange('scraping')}
            icon={<Search size={22} />}
            label="Scraping"
          />
          <NavItem 
            active={currentTab === 'map'} 
            onClick={() => onTabChange('map')}
            icon={<MapPin size={22} />}
            label="Mapa škol"
          />
        </nav>

        {/* Settings at Bottom */}
        <div className="mt-auto pt-4 w-full flex justify-center pb-2">
          <NavItem 
            active={currentTab === 'settings'} 
            onClick={() => onTabChange('settings')}
            icon={<Settings size={22} />}
            label="Nastavení"
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Mobile Header with Tabs - ALWAYS VISIBLE */}
        <div className="md:hidden pt-[calc(env(safe-area-inset-top)+12px)] px-3 pb-3 bg-[#121212] border-b border-white/5 sticky top-0 z-50 shadow-lg shadow-black/40">
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
                    onClick={() => onTabChange('agent')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'agent' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <Bot size={16} />
                    <span>Agent</span>
                </button>
                <button
                    onClick={() => onTabChange('tasks')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'tasks' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <CheckSquare size={16} />
                    <span>Úkoly</span>
                </button>
                <button
                    onClick={() => onTabChange('outreach')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'outreach' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <Send size={16} />
                    <span>Outreach</span>
                </button>
                <button
                    onClick={() => onTabChange('scraping')}
                    className={clsx(
                        "shrink-0 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-2",
                        currentTab === 'scraping' ? "bg-[#0A84FF] text-white shadow-lg shadow-blue-500/30" : "bg-[#252525] text-[#8E8E93] active:bg-[#353535]"
                    )}
                >
                    <Search size={16} />
                    <span>Scraping</span>
                </button>
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
          (currentTab === 'dictation' || currentTab === 'agent' || currentTab === 'tasks' || currentTab === 'outreach' || currentTab === 'scraping' || currentTab === 'map') ? "overflow-hidden" : "overflow-y-auto scrollbar-hide"
        )}>
          <div className={clsx(
            "w-full flex-1 flex flex-col",
            (currentTab === 'tasks' || currentTab === 'agent' || currentTab === 'outreach' || currentTab === 'scraping' || currentTab === 'map') ? "h-full" : "",
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
