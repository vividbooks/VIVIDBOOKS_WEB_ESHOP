import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Toaster } from 'sonner@2.0.3';
import {
  Home, ChevronRight, Settings, Sparkles, Eye, LogOut,
  Database, FileText, Newspaper, Radio, Package, LayoutGrid,
  BookOpen, Layers, Bot, Brain, Trash2, Upload, Image, GraduationCap, Bell, Megaphone, Users, School,
  Monitor, BarChart3, Mail, Contact, Plus,
  Calendar, Menu, X, ChevronDown, Palette, Loader2,
} from 'lucide-react';
import { useApp } from '@/app/contexts/AppContext';
import { AssistantLoginScreen } from '@/app/components/AssistantLoginScreen';
import { isAdminEmailAllowed } from '@/config/adminAllowlist';
import { fetchAdminAlertSummary, fetchAdminOrders, type AdminAlertSummary } from '../../utils/adminApi';
import { AdminSidebarChatHistory } from './AdminSidebarChatHistory';

const ADMIN_ACCESS_DENIED_MSG = 'Tento účet nemá přístup k administraci.';

// Pipedrive → obchod: Edge funkce pipedrive-inbound-deal (webhook na won deal + token v query).
// Admin přehled zatím v běžném /admin/objednávky — volitelně /admin/pipedrive-objednavky + ruční expedice.

/* ── Sidebar config per mode ──────────────────────────────────────────── */

const WEB_SIDEBAR = [
  {
    section: 'Collections',
    items: [
      { label: 'Produkty', icon: Package, path: '/admin/kolekce/produkty' },
      { label: 'Blog', icon: FileText, path: '/admin/blog' },
      { label: 'Novinky', icon: Newspaper, path: '/admin/novinky' },
      { label: 'Hero slidy', icon: Image, path: '/admin/kolekce/hero-slidy' },
      { label: 'Vizuální editor slideru', icon: Palette, path: '/admin/visual-editor' },
      { label: 'Předměty', icon: GraduationCap, path: '/admin/kolekce/predmety' },
      { label: 'Notifikace', icon: Bell, path: '/admin/kolekce/notifikace' },
    ],
  },
  {
    section: 'Fixní stránky',
    items: [
      { label: 'Stránky webu', icon: LayoutGrid, path: '/admin/stranky' },
    ],
  },
  {
    section: 'Nástroje',
    items: [
      { label: 'Migrace obsahu', icon: Upload, path: '/admin/migrace' },
    ],
  },
];

const ESHOP_SIDEBAR = [
  {
    section: 'E-shop',
    items: [
      { label: 'Objednávky', icon: Package, path: '/admin/objednavky' },
      { label: 'Analytika', icon: BarChart3, path: '/admin/analytika' },
      { label: 'Školy', icon: School, path: '/admin/skoly' },
      { label: 'Skladové zásoby', icon: Package, path: '/admin/sklad' },
      { label: 'Alerty', icon: Bell, path: '/admin/alerty' },
      { label: 'Balíčky', icon: Layers, path: '/admin/balicky' },
      { label: 'Objednávky plakátů', icon: Image, path: '/admin/plakaty' },
    ],
  },
];

const ASSISTANT_SIDEBAR = [
  {
    section: 'Assistant',
    items: [
      { label: 'Web operator assistant', icon: Bot, path: '/admin/agent', badge: 'AI', badgeColor: 'purple' },
    ],
  },
];

type AdminModeId = 'web' | 'marketing' | 'mailing' | 'eshop' | 'assistant';

const ESHOP_PATHS = [
  '/admin/objednavky',
  '/admin/analytika',
  '/admin/skoly',
  '/admin/sklad',
  '/admin/alerty',
  '/admin/balicky',
  '/admin/plakaty',
];
const ASSISTANT_PATHS = ['/admin/agent'];
const MAILING_PATHS = ['/mailing'];

const MARKETING_SIDEBAR = [
  {
    section: 'Kampaně',
    items: [
      { label: 'Kalendář', icon: Calendar, path: '/marketing/kalendar' },
      { label: 'Webináře', icon: Radio, path: '/marketing/webinare' },
      { label: 'Popup Manager', icon: Megaphone, path: '/marketing/popupy' },
    ],
  },
  {
    section: 'Obsah',
    items: [
      { label: 'Galerie obrázků', icon: Image, path: '/marketing/galerie' },
      { label: 'Image Agent', icon: Image, path: '/marketing/image-agent', badge: 'AI', badgeColor: 'purple' },
    ],
  },
  {
    section: 'Audience',
    items: [
      { label: 'Registrace', icon: Users, path: '/marketing/registrace' },
      { label: 'Kontakty', icon: Contact, path: '/marketing/kontakty' },
      { label: 'Rejstřík škol', icon: School, path: '/marketing/skoly' },
    ],
  },
  {
    section: 'AI',
    items: [
      { label: 'Growth Agent', icon: Sparkles, path: '/marketing/growth-agent', badge: 'AI', badgeColor: 'purple' },
      { label: 'Marketing Agent', icon: Sparkles, path: '/marketing/marketing-agent', badge: 'AI', badgeColor: 'purple' },
      { label: 'SEO Agent', icon: Brain, path: '/marketing/seo-agent', badge: 'AI', badgeColor: 'amber' },
    ],
  },
];

const MAILING_SIDEBAR = [
  {
    section: 'Mailing',
    items: [
      { label: 'Nový email', icon: Plus, path: '/mailing/novy-email' },
      { label: 'Emaily', icon: Mail, path: '/mailing/emaily' },
      { label: 'Audience', icon: Users, path: '/mailing/audience' },
      { label: 'Automatizace', icon: Sparkles, path: '/mailing/automatizace' },
    ],
  },
];

const MODE_CONFIG: Record<AdminModeId, {
  label: string;
  icon: any;
  homePath: string;
  sidebar: typeof WEB_SIDEBAR;
  accent: string;
  title: string;
}> = {
  web: {
    label: 'Web',
    icon: Monitor,
    homePath: '/admin',
    sidebar: WEB_SIDEBAR,
    accent: 'text-[#001161]',
    title: 'Web Admin',
  },
  marketing: {
    label: 'Marketing',
    icon: BarChart3,
    homePath: '/marketing',
    sidebar: MARKETING_SIDEBAR,
    accent: 'text-[#7C3AED]',
    title: 'Marketing Admin',
  },
  mailing: {
    label: 'E-maily',
    icon: Mail,
    homePath: '/mailing/emaily',
    sidebar: MAILING_SIDEBAR,
    accent: 'text-fuchsia-700',
    title: 'Email Admin',
  },
  eshop: {
    label: 'Eshop',
    icon: Package,
    homePath: '/admin/analytika',
    sidebar: ESHOP_SIDEBAR,
    accent: 'text-emerald-700',
    title: 'Eshop Admin',
  },
  assistant: {
    label: 'Web operator assistant',
    icon: Bot,
    homePath: '/admin/agent',
    sidebar: ASSISTANT_SIDEBAR,
    accent: 'text-sky-700',
    title: 'Web operator assistant',
  },
};

const SETTINGS_ITEMS_BASE: Array<{
  label: string; icon: any; disabled?: boolean; highlight?: boolean;
  future?: boolean; path?: string; danger?: boolean; action?: 'signOut';
}> = [
  { label: 'Správa licencí', icon: BookOpen, disabled: true },
  { label: 'Aktivita škol', icon: Layers, disabled: true },
  { label: 'Migrace obsahu', icon: Upload, path: '/admin/migrace' },
  { label: 'Referenční styly', icon: Palette, path: '/marketing/image-agent/referencni-styly', highlight: true },
  { label: 'AI Agent', icon: Bot, disabled: true, highlight: true, future: true },
  { label: 'Zobrazit Vividbooks', icon: Eye, path: '/' },
  { label: 'Vyčistit kategorie', icon: Trash2, disabled: true },
  { label: 'Odhlásit se', icon: LogOut, danger: true, action: 'signOut' },
];

/* ── Layout ────────────────────────────────────────────────────────────── */

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authReady, signOut } = useApp();
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [alertSummary, setAlertSummary] = useState<AdminAlertSummary | null>(null);
  /** Počet plakátových objednávek se stavem nehotovo (pro výrazný odkaz v menu). */
  const [posterPendingCount, setPosterPendingCount] = useState(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user?.email) {
      setAccessDeniedMessage(null);
      return;
    }
    if (isAdminEmailAllowed(user.email)) {
      setAccessDeniedMessage(null);
      return;
    }
    setAccessDeniedMessage(ADMIN_ACCESS_DENIED_MSG);
    void signOut();
  }, [authReady, user, signOut]);

  const mode: AdminModeId = MAILING_PATHS.some((path) => location.pathname.startsWith(path))
    ? 'mailing'
    : location.pathname.startsWith('/marketing')
    ? 'marketing'
    : ASSISTANT_PATHS.some((path) => location.pathname.startsWith(path))
      ? 'assistant'
      : ESHOP_PATHS.some((path) => location.pathname.startsWith(path))
        ? 'eshop'
        : 'web';
  const activeMode = MODE_CONFIG[mode];
  const sidebarItems = activeMode.sidebar;
  const basePath = mode === 'marketing' ? '/marketing' : mode === 'mailing' ? '/mailing' : '/admin';
  const hideSidebar = false;
  /** Plátno bez postranního admin panelu — vlastní UI editoru. */
  const isVisualEditor = location.pathname === '/admin/visual-editor';
  const isEmailBuilder =
    location.pathname.startsWith('/marketing/emaily') ||
    location.pathname.startsWith('/mailing/novy-email') ||
    location.pathname.startsWith('/mailing/emaily');
  const showAgentChatHistory = mode === 'assistant' && location.pathname === '/admin/agent';

  const isAgentWorkspace =
    location.pathname.startsWith('/admin/agent') ||
    location.pathname.startsWith('/marketing/growth-agent') ||
    location.pathname.startsWith('/marketing/marketing-agent') ||
    location.pathname.startsWith('/marketing/seo-agent');

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    }
    if (settingsOpen || modeMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen, modeMenuOpen]);

  useEffect(() => {
    if (mode !== 'web' && mode !== 'eshop' && mode !== 'assistant') return;

    let cancelled = false;
    let intervalId: number | undefined;

    const loadSummary = async () => {
      try {
        const data = await fetchAdminAlertSummary();
        if (!cancelled) setAlertSummary(data.summary);
      } catch {
        if (!cancelled) {
          setAlertSummary(null);
        }
      }
    };

    void loadSummary();
    intervalId = window.setInterval(loadSummary, 60000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'eshop') {
      setPosterPendingCount(0);
      return;
    }

    let cancelled = false;
    let intervalId: number | undefined;

    const loadPosterPending = async () => {
      try {
        const data = await fetchAdminOrders({
          filter: 'all',
          posterOnly: true,
          page: 1,
          pageSize: 500,
          search: '',
        });
        if (cancelled) return;
        const n = (data.items || []).filter((row) => (row.poster_fulfillment_status || 'pending') !== 'done').length;
        setPosterPendingCount(n);
      } catch {
        if (!cancelled) setPosterPendingCount(0);
      }
    };

    void loadPosterPending();
    intervalId = window.setInterval(loadPosterPending, 60000);
    const onFocus = () => {
      void loadPosterPending();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [mode, location.pathname]);

  const pathParts = location.pathname.replace(basePath, '').split('/').filter(Boolean);
  const breadcrumbLabels: Record<string, string> = {
    kolekce: 'Kolekce', produkty: 'Produkty', blog: 'Blog editor',
    novinky: 'Novinky', webinare: 'Webináře', stranky: 'Stránky',
    migrace: 'Migrace', 'hero-slidy': 'Hero slidy', predmety: 'Předměty',
    notifikace: 'Notifikace', popupy: 'Popup Manager', registrace: 'Registrace',
    tabs: 'Taby', 'marketing-agent': 'Marketing Agent',
    'seo-agent': 'SEO Agent', 'image-agent': 'Image Agent', 'referencni-styly': 'Referenční styly',
    skoly: 'Rejstřík škol', shopify: 'Shopify',
    objednavky: 'Objednávky',
    analytika: 'Analytika',
    sklad: 'Skladové zásoby',
    alerty: 'Alerty',
    balicky: 'Balíčky',
    plakaty: 'Objednávky plakátů',
    emaily: 'E-maily',
    'novy-email': 'Nový email',
    audience: 'Audience',
    automatizace: 'Automatizace',
    galerie: 'Galerie obrázků',
    kalendar: 'Kalendář',
    'growth-agent': 'Growth Agent',
    agent: 'Web operator assistant',
    'visual-editor': 'Vizuální editor',
  };

  if (!authReady) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#f7f8fc] gap-3">
        <Loader2 className="w-10 h-10 text-[#001161]/35 animate-spin" aria-label="Načítání" />
        <p className="text-[13px] text-[#001161]/50 font-medium">Ověřuji přihlášení…</p>
      </div>
    );
  }

  if (!user) {
    return <AssistantLoginScreen accessDeniedMessage={accessDeniedMessage} subtitle="Administrace" />;
  }

  if (!isAdminEmailAllowed(user.email)) {
    return (
      <AssistantLoginScreen
        accessDeniedMessage={accessDeniedMessage ?? ADMIN_ACCESS_DENIED_MSG}
        subtitle="Administrace"
      />
    );
  }

  if (isVisualEditor) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <Outlet />
      </>
    );
  }

  const asideNode = !hideSidebar ? (
    <aside
      className={`
          fixed md:static top-0 left-0 bottom-0 z-[70]
          w-[220px] bg-white border-r border-gray-200 shrink-0 flex flex-col min-h-0
          ${showAgentChatHistory ? 'overflow-hidden' : 'overflow-y-auto'}
          transition-transform duration-300 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:h-full
        `}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <span className="text-[13px] font-bold text-[#001161]">{activeMode.title}</span>
        <button type="button" onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div
        className={`flex-1 min-h-0 ${showAgentChatHistory ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}
      >
        <div className={showAgentChatHistory ? 'shrink-0' : ''}>
          {sidebarItems.map((section) => (
            <div key={section.section} className="py-3">
              <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {section.section}
              </div>
              {section.items.map((item: any) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                const isAlertsItem = item.path === '/admin/alerty';
                const isPosterOrdersItem = item.path === '/admin/plakaty';
                const showPosterAttention = isPosterOrdersItem && posterPendingCount > 0;
                const dynamicBadge = isAlertsItem && alertSummary && alertSummary.critical_open > 0
                  ? String(alertSummary.critical_open)
                  : item.badge;
                const dynamicBadgeColor = isAlertsItem && alertSummary && alertSummary.critical_open > 0
                  ? 'amber'
                  : item.badgeColor;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      const target = item.path === '/mailing/novy-email'
                        ? `${item.path}?new=${Date.now()}`
                        : item.path;
                      navigate(target);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 transition-all ${
                      isActive
                        ? 'bg-[#001161] text-white font-bold'
                        : showPosterAttention
                          ? 'text-red-700 font-semibold bg-red-50/90 hover:bg-red-100/90 hover:text-red-800 animate-[poster-sidebar-wink_1.1s_ease-in-out_infinite]'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-[#001161]'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 ${showPosterAttention && !isActive ? 'text-red-600' : ''}`} />
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    {showPosterAttention && (
                      <span
                        className="shrink-0 flex items-center gap-1"
                        title={`Nevyřízené plakáty: ${posterPendingCount}`}
                        aria-label={`${posterPendingCount} nevyřízených objednávek plakátů`}
                      >
                        <span className="relative flex h-2.5 w-2.5">
                          <span
                            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                              isActive ? 'bg-red-200' : 'bg-red-500'
                            }`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                              isActive ? 'bg-red-100 ring-2 ring-white/90' : 'bg-red-600'
                            }`}
                          />
                        </span>
                        <span
                          className={`text-[10px] font-bold tabular-nums leading-none ${
                            isActive ? 'text-red-100' : 'text-red-600'
                          }`}
                        >
                          {posterPendingCount}
                        </span>
                      </span>
                    )}
                    {dynamicBadge && (
                      <span className={`${showPosterAttention ? '' : 'ml-auto'} text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        dynamicBadgeColor === 'purple'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {dynamicBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {showAgentChatHistory && (
          <AdminSidebarChatHistory onAfterSelect={() => setMobileSidebarOpen(false)} />
        )}
      </div>
    </aside>
  ) : null;

  const mainColumnClass = isEmailBuilder
    ? /* Sidebar + panel ≥ viewport → scroll na shellu; na širokém monitoru main doroste (flex-1). */
      'min-h-0 h-full min-w-[1100px] flex-1 shrink-0 flex flex-col overflow-y-hidden'
    : isAgentWorkspace
      ? 'min-h-0 min-w-0 flex-1 h-full overflow-y-hidden overflow-x-hidden flex flex-col'
      : 'min-h-0 min-w-0 flex-1 overflow-y-auto';

  const mainColumn = (
    <main className={mainColumnClass}>
      <Outlet />
    </main>
  );

  return (
    <div className="h-dvh max-h-dvh min-h-0 flex flex-col overflow-hidden bg-[#f7f8fc] font-['Fenomen_Sans',sans-serif]">
      <Toaster position="top-right" richColors />

      {/* TOP BAR */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 overflow-visible z-[120]">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileSidebarOpen(v => !v)}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
        >
          {mobileSidebarOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
        </button>

        {/* Mode Switcher */}
        <div ref={modeMenuRef} className="relative">
          <button
            onClick={() => setModeMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-bold text-[#001161] hover:border-gray-300 transition-all"
          >
            <activeMode.icon className={`w-3.5 h-3.5 ${activeMode.accent}`} />
            <span className={`${activeMode.accent}`}>{activeMode.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${modeMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {modeMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-[240px] rounded-2xl border border-gray-100 bg-white shadow-xl py-2 z-[90]">
              {(Object.entries(MODE_CONFIG) as Array<[AdminModeId, typeof activeMode]>).map(([modeId, config]) => (
                <button
                  key={modeId}
                  onClick={() => {
                    setModeMenuOpen(false);
                    navigate(config.homePath);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-3 transition-colors ${
                    mode === modeId
                      ? 'bg-gray-50 text-[#001161] font-bold'
                      : 'text-gray-600 hover:bg-orange-50 hover:text-[#001161]'
                  }`}
                >
                  <config.icon className={`w-4 h-4 shrink-0 ${config.accent}`} />
                  <span>{config.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        <div className="hidden md:flex items-center gap-1 text-[13px] text-gray-400">
          <button onClick={() => navigate(activeMode.homePath)} className="hover:text-[#001161] transition-colors">
            <Home className="w-3.5 h-3.5" />
          </button>
          {pathParts.map((part, i) => (
            <span key={part + i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-600 font-medium">{breadcrumbLabels[part] || part}</span>
            </span>
          ))}
        </div>
        {/* Mobile: show current page name */}
        <span className="md:hidden text-[13px] font-bold text-[#001161] truncate max-w-[140px]">
          {pathParts.length > 0 ? (breadcrumbLabels[pathParts[pathParts.length - 1]] || pathParts[pathParts.length - 1]) : activeMode.label}
        </span>

        <div className="flex-1" />

        {mode === 'marketing' && (
          <button
            className="hidden md:flex items-center gap-2 bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] hover:opacity-90 text-white px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all shadow-[0_2px_8px_rgba(124,58,237,0.3)]"
            onClick={() => navigate('/marketing/marketing-agent')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {'Marketing Agent'}
          </button>
        )}

        <div ref={settingsRef} className="relative">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </button>

          {settingsOpen && (
            <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[100] w-[240px]">
              {SETTINGS_ITEMS_BASE.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setSettingsOpen(false);
                    if (item.action === 'signOut') {
                      void signOut();
                      return;
                    }
                    if (item.path) navigate(item.path);
                  }}
                  disabled={item.disabled}
                  className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-3 transition-colors ${
                    item.danger
                      ? 'text-red-500 hover:bg-red-50'
                      : item.highlight
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : item.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-[#001161] hover:bg-orange-50 hover:text-[#ff6a35]'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                  {item.future && (
                    <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                      {'Brzy'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div
        data-admin-horizontal-shell={isAgentWorkspace ? 'true' : 'false'}
        className={`flex-1 flex relative min-h-0 min-w-0 ${(isEmailBuilder || isAgentWorkspace) ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}`}
      >

        {/* MOBILE SIDEBAR BACKDROP */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-[60] md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* E-maily: jeden široký řádek (w-max min-w-full) → shell scrolluje celý panel včetně navigace */}
        {isEmailBuilder ? (
          <div
            className="flex min-h-0 h-full shrink-0"
            style={{ minWidth: hideSidebar ? 'max(100%, 1100px)' : 'max(100%, calc(220px + 1100px))' }}
          >
            {asideNode}
            {mainColumn}
          </div>
        ) : (
          <>
            {asideNode}
            {mainColumn}
          </>
        )}
      </div>
    </div>
  );
}