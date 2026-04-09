import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Download, ChevronRight, ChevronDown, Menu, X, Phone, ShoppingCart } from 'lucide-react';
import svgPaths from '../imports/svg-3hoiegevxq';
import logoPaths from '../imports/svg-fupfguvmdt';
import { TopNav } from './TopNav';
import { CartIcon } from './checkout/CartIcon';
import { CatalogContext } from '../contexts/CatalogContext';
import { useCart } from '../contexts/CartContext';
import { useProducts } from '../contexts/ProductsContext';
import { useOrderNav } from '../contexts/OrderNavContext';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useSchoolOrderDraftMeta } from '../utils/schoolOrderDraft';
import { subjectToSlug } from '../utils/slugify';

/* ── Logo: viewBox musí pokrýt celý řádek BOOKS (y≈866); 655 ořezával půlku písmen ── */
const VIVIDBOOKS_LOGO_VIEWBOX = '0 0 1786.62 869.93';

function VividbooksLogo() {
  const W = 110;
  return (
    <div className="flex flex-col items-center mb-4">
      {/* VIVIDBOOKS */}
      <svg viewBox={VIVIDBOOKS_LOGO_VIEWBOX} fill="none" style={{ width: `${W}px`, height: 'auto', display: 'block' }}>
        <path d={logoPaths.p299c6b00} fill="#001161" />
        <path d={logoPaths.p3cc4870}  fill="#001161" />
        <path d={logoPaths.p98d9300}  fill="#001161" />
        <path d={logoPaths.pf524b00}  fill="#001161" />
        <path d={logoPaths.p26e2d80}  fill="#001161" />
        <path d={logoPaths.p15998cf0} fill="#001161" />
        <path d={logoPaths.p1bd3b900} fill="#001161" />
        <path d={logoPaths.p19a24c00} fill="#001161" />
        <path d={logoPaths.p34d64300} fill="#001161" />
        <path d={logoPaths.p396dedf0} fill="#001161" />
      </svg>
    </div>
  );
}

/* ── CheckBadge ────────────────────────────────────────────────── */
function CheckBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border border-[#001161] rounded-[7px] px-3 py-1.5 h-[37px]">
      <div className="size-[17px]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 17">
          <path d={svgPaths.p298d1300} fill="#001161" />
        </svg>
      </div>
      <span className="text-[#001161] font-['Fenomen_Sans',sans-serif] text-[15px] whitespace-nowrap">{label}</span>
    </div>
  );
}

/* ── Sidebar accordion ─────────────────────────────────────────── */
interface SidebarAccordionItem {
  label: string;
  href?: string;
  internal?: string;
}
interface SidebarAccordionSection {
  title: string;
  items: SidebarAccordionItem[];
  /** Červená blikající tečka před názvem (např. novinka / upozornění) */
  attentionDot?: boolean;
}

function MenuAttentionDot() {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.85)] motion-safe:animate-pulse"
      aria-hidden
    />
  );
}

const SIDEBAR_SECTIONS: SidebarAccordionSection[] = [
  {
    title: 'Akce',
    items: [{ label: 'Akční balíčky', internal: '/akce' }],
  },
  {
    title: 'Vividboard',
    items: [
      { label: 'Vividboard', internal: '/vividboard' },
    ],
  },
  {
    title: 'DVPP webin\u00e1\u0159e',
    attentionDot: true,
    items: [
      { label: 'DVPP webin\u00e1\u0159e', internal: '/webinare' },
    ],
  },
  {
    title: 'Novinky a blog',
    items: [
      { label: 'Novinky', internal: '/novinky' },
      { label: 'Blog',    internal: '/blog' },
    ],
  },
  {
    title: 'Kontakt',
    items: [
      { label: 'Kontakt', internal: '/kontakt' },
    ],
  },
];

function SidebarAccordion() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggle = (title: string) =>
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));

  const handleItem = (item: SidebarAccordionItem) => {
    if (item.internal) {
      navigate(item.internal);
    } else if (item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="mt-5 pt-4 border-t border-gray-200 flex flex-col">
      {SIDEBAR_SECTIONS.map(section => {
        // Sekce s jedinou položkou → přímý odkaz bez akordeonu
        if (section.items.length === 1) {
          const item = section.items[0];
          const isActive = !!(item.internal && location.pathname === item.internal);
          return (
            <button
              key={section.title}
              onClick={() => handleItem(item)}
              className={`w-full text-left px-3 py-1.5 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] transition-all cursor-pointer flex items-center gap-2 border ${
                isActive
                  ? 'bg-[#c8d7f7] text-[#001161] border-[#001161]/10'
                  : 'text-[#001161] hover:bg-white border-transparent hover:border-gray-200'
              }`}
            >
              {section.attentionDot ? <MenuAttentionDot /> : null}
              {section.title}
            </button>
          );
        }

        return (
        <div key={section.title}>
          <button
            onClick={() => toggle(section.title)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all cursor-pointer"
          >
            <span>{section.title}</span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform duration-200 ${openSections[section.title] ? 'rotate-180' : ''}`}
              strokeWidth={2.5}
            />
          </button>

          <AnimatePresence initial={false}>
            {openSections[section.title] && (
              <motion.div
                key="content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="flex flex-col pl-3 pr-1 pb-1">
                  {section.items.map(item => (
                    !item.href && !item.internal ? (
                      <span
                        key={item.label}
                        className="px-3 pt-1.5 pb-0.5 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold uppercase tracking-wider text-[#001161]/50"
                      >
                        {item.label}
                      </span>
                    ) : (
                    <button
                      key={item.label}
                      onClick={() => handleItem(item)}
                      className="w-full text-left px-3 py-1.5 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all cursor-pointer"
                    >
                      {item.label}
                    </button>
                    )
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        );
      })}
    </div>
  );
}

/* ── Subject lists ─────────────────────────────────────────────── */
const stripStupen = (text: string) => text.replace(/\s+\d+\.\s*stupe.*$/i, '');

const secondGradeSubjects = ['Matematika 2. stupe\u0148', 'Fyzika', 'P\u0159\u00edrodopis', 'Chemie'];
const firstGradeSubjects  = ['Matematika 1. stupe\u0148', '\u010cesk\u00fd jazyk', 'Prvouka'];
const secondGradeLevels   = ['6. ro\u010dn\u00edk', '7. ro\u010dn\u00edk', '8. ro\u010dn\u00edk', '9. ro\u010dn\u00edk'];
const firstGradeLevels    = ['1. ro\u010dn\u00edk', '2. ro\u010dn\u00edk'];

/* ── CatalogLayout ─────────────────────────────────────────────── */
export default function CatalogLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { products } = useProducts();
  const { itemCount, openCart } = useCart();
  const { extraCount } = useSchoolOrderDraftMeta();

  const [groupingMode,      setGroupingMode]      = useState<'grade' | 'subject'>('subject');
  const [activeSection,     setActiveSection]      = useState<string | null>(null);
  const [isDownloadingPack, setIsDownloadingPack] = useState(false);
  const [canScrollRight,    setCanScrollRight]     = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen]  = useState(false);

  const navRef = useRef<HTMLDivElement | null>(null);

  const isSchoolOrderView = location.pathname === '/objednat';
  const isCheckoutView = location.pathname === '/pokladna';
  const isCheckoutLikeSidebar = isCheckoutView || isSchoolOrderView;
  const { step: orderStep } = useOrderNav();
  /** Krok „Počty“ — více místa vlevo: bez loga, odkaz nahoře */
  const isSchoolCountsStep = isSchoolOrderView && orderStep === 2;
  const schoolOrderCount = itemCount + extraCount;

  const searchParams = new URLSearchParams(location.search);

  /* ── distributor mode ──────────────────────────────────────── */
  const isDistributorMode = searchParams.get('mode') === 'distributor';

  /* ── scroll to catalog section ─────────────────────────────── */
  const scrollToSection = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: id } });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
    const offset = typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 80;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  /* ── download distributor pack ────────────────────────────── */
  const handleDownloadPack = async () => {
    setIsDownloadingPack(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/export-distributor-pack`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      if (!res.ok) throw new Error('Export selhal');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'vividbooks_podklady_distributori.zip';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Chyba p\u0159i generov\u00e1n\u00ed bal\u00ed\u010dku. Zkuste to pros\u00edm znovu.');
    } finally {
      setIsDownloadingPack(false);
    }
  };

  /* ── mobile nav scroll check ───────────────────────────────── */
  useEffect(() => {
    const el = navRef.current;
    if (!el || isSchoolOrderView || isCheckoutView) return;
    const check = () => {
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    };
    el.addEventListener('scroll', check);
    setTimeout(check, 100);
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [groupingMode, isSchoolOrderView, isCheckoutView, location.pathname]);

  const scrollMobileNext = () => {
    const el = navRef.current;
    if (!el) return;
    const buttons     = Array.from(el.querySelectorAll('button'));
    const containerRight = el.scrollLeft + el.clientWidth;
    const next = buttons.find(btn => btn.offsetLeft + btn.offsetWidth > containerRight + 5);
    el.scrollTo({ left: next ? next.offsetLeft - 16 : el.scrollLeft + 150, behavior: 'smooth' });
  };

  const onOrder = () => navigate(schoolOrderCount > 0 ? '/objednat?step=2' : '/objednat');

  /** Po webináři: `?dvppDotaznik=1` — jen DVPP/dotazník, bez katalogové navigace. */
  const isWebinarSurveyFullscreen =
    /^\/webinar\/[^/]+$/.test(location.pathname) && searchParams.get('dvppDotaznik') === '1';

  /** Odkaz ze záznamu v e-mailu (`?email=…&from=email`) — jen obsah, bez bočního menu a horní lišty. */
  const isZaznamFromEmailFullscreen =
    /^\/webinare\/zaznam\/[^/]+$/.test(location.pathname) &&
    String(searchParams.get('from') || '').toLowerCase() === 'email';

  /** Stránka trial — bez katalogového chrome (stejně jako e-mailové vstupy). */
  const isTrialPageFullscreen = location.pathname === '/vyzkousejte';

  const isMinimalCatalogChrome =
    isWebinarSurveyFullscreen || isZaznamFromEmailFullscreen || isTrialPageFullscreen;

  const catalogContextValue = {
    groupingMode, setGroupingMode,
    activeSection, setActiveSection,
    scrollToSection,
    isDistributorMode,
    handleDownloadPack,
    isDownloadingPack,
  };

  if (isMinimalCatalogChrome) {
    return (
      <CatalogContext.Provider value={catalogContextValue}>
        <div
          className={
            isWebinarSurveyFullscreen
              ? 'flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden bg-[#E8EBF4]'
              : 'min-h-dvh w-full bg-[#E8EBF4]'
          }
        >
          <main
            className={
              isWebinarSurveyFullscreen
                ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden'
                : 'min-h-dvh w-full'
            }
          >
            <Outlet />
          </main>
        </div>
      </CatalogContext.Provider>
    );
  }

  return (
    <CatalogContext.Provider value={catalogContextValue}>
      <div className="bg-white min-h-screen">
        {/* Fixed top navbar — desktop only (checkout je bez horní lišty) */}
        {!isCheckoutLikeSidebar && <TopNav onOrder={onOrder} />}

        <div className="flex flex-col md:flex-row">
          {/* ── Mobile sidebar backdrop ───────────────────────── */}
          {mobileSidebarOpen && (
            <div
              className="md:hidden fixed inset-0 bg-black/40 z-[55]"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* ── Mobile full sidebar drawer ────────────────────── */}
          <AnimatePresence>
            {mobileSidebarOpen && (
              <motion.div
                key="mobile-drawer"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="md:hidden fixed top-0 left-0 bottom-0 w-[280px] bg-[#f8f9fc] z-[60] flex flex-col overflow-y-auto shadow-2xl"
              >
                {/* Drawer header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-white shrink-0">
                  <div className="scale-90 origin-left" onClick={() => { navigate('/'); setMobileSidebarOpen(false); }}>
                    <VividbooksLogo />
                  </div>
                  <button onClick={() => setMobileSidebarOpen(false)} className="p-2 rounded-xl bg-gray-100">
                    <X className="size-5 text-[#001161]" />
                  </button>
                </div>

                {/* CTA buttons */}
                <div className="px-4 pt-4 pb-2 flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => { navigate('/vyzkousejte'); setMobileSidebarOpen(false); }}
                    className="w-full py-3 rounded-[999px] bg-[#7C3AED] text-white font-['Fenomen_Sans',sans-serif] text-[15px] font-bold"
                  >
                    Vyzkoušet zdarma
                  </button>
                  <button
                    onClick={() => { onOrder(); setMobileSidebarOpen(false); }}
                    className="w-full py-3 rounded-[999px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[15px] font-bold flex items-center justify-center gap-2"
                  >
                    <span>Objednat pro školu</span>
                    {schoolOrderCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-white text-[#001161] text-[11px] font-bold flex items-center justify-center">
                        {schoolOrderCount}
                      </span>
                    )}
                  </button>
                  {itemCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { openCart(); setMobileSidebarOpen(false); }}
                      className="w-full py-3 rounded-[999px] border-2 border-[#001161] text-[#001161] font-['Fenomen_Sans',sans-serif] text-[15px] font-bold flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="size-5 shrink-0" />
                      <span>Košík</span>
                      <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-[#ff6a35] text-white text-[11px] font-bold flex items-center justify-center leading-none">
                        {itemCount > 99 ? '99+' : itemCount}
                      </span>
                    </button>
                  )}
                  {isDistributorMode && (
                    <button
                      type="button"
                      onClick={() => { handleDownloadPack(); setMobileSidebarOpen(false); }}
                      disabled={isDownloadingPack}
                      className="w-full py-3 rounded-[999px] bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isDownloadingPack ? (
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                      ) : (
                        <Download className="size-5 shrink-0" />
                      )}
                      Stáhnout podklady (ZIP)
                    </button>
                  )}
                </div>

                {/* Subject nav */}
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#001161]/40 mb-2">2. stupeň</p>
                  <div className="flex flex-col gap-0.5">
                    {secondGradeSubjects.map(item => {
                      const slug = subjectToSlug(item);
                      const label = item.replace(/\s+\d+\.\s*stupe\S*/g, '');
                      return (
                        <button key={item} onClick={() => { navigate(`/predmet/${slug}`); setMobileSidebarOpen(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#001161]/40 mb-2 mt-3">1. stupeň</p>
                  <div className="flex flex-col gap-0.5">
                    {firstGradeSubjects.map(item => {
                      const slug = subjectToSlug(item);
                      const label = item.replace(/\s+\d+\.\s*stupe\S*/g, '');
                      return (
                        <button key={item} onClick={() => { navigate(`/predmet/${slug}`); setMobileSidebarOpen(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Other nav */}
                <div className="px-4 pt-2 pb-4 border-t border-gray-200 mt-2 flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => { navigate('/akce'); setMobileSidebarOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all mt-1"
                  >
                    {'Akce'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { navigate('/vividboard'); setMobileSidebarOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                  >
                    {'Vividboard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { navigate('/webinare'); setMobileSidebarOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all mt-1 flex items-center gap-2"
                  >
                    <MenuAttentionDot />
                    {'DVPP webin\u00e1\u0159e'}
                  </button>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#001161]/40 mb-2 px-3 pt-2">
                    {'Novinky a blog'}
                  </p>
                  <button
                    type="button"
                    onClick={() => { navigate('/novinky'); setMobileSidebarOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                  >
                    Novinky
                  </button>
                  <button
                    type="button"
                    onClick={() => { navigate('/blog'); setMobileSidebarOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                  >
                    Blog
                  </button>
                  <button
                    type="button"
                    onClick={() => { navigate('/kontakt'); setMobileSidebarOpen(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] text-[#001161] hover:bg-white border border-transparent hover:border-gray-200 transition-all mt-1"
                  >
                    Kontakt
                  </button>
                </div>

                {/* Phone */}
                <div className="px-4 py-3 border-t border-gray-200 mt-auto shrink-0">
                  <Link
                    to="/kontakt"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="flex items-center gap-2 text-[#001161]/60 font-['Fenomen_Sans',sans-serif] text-[14px]"
                  >
                    <Phone className="size-4" />
                    +420 602 227 674
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Mobile top nav (checkout / objednávka / katalog) — u katalogu bez sticky ── */}
          {isCheckoutView ? (
            <div className="md:hidden relative z-40 bg-white border-b border-gray-100 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
              <div className="cursor-pointer w-fit" onClick={() => navigate('/')}>
                <VividbooksLogo />
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-8 text-left w-full text-[#001161] font-['Fenomen_Sans',sans-serif] text-[15px] font-semibold hover:text-[#ff6a35] transition-colors py-1"
              >
                {'\u2190 Zp\u011bt k n\xe1kupu'}
              </button>
              <div
                id="checkout-summary-slot-mobile"
                className="mt-[calc(1.25rem_-_30px)] pt-4 border-t border-gray-200 max-h-[min(42vh,280px)] overflow-y-auto"
              />
            </div>
          ) : isSchoolOrderView ? (
            <div
              className={`md:hidden relative z-40 bg-white border-b border-gray-100 px-4 ${
                isSchoolCountsStep ? 'pt-3 pb-3' : 'pt-[max(1.5rem,env(safe-area-inset-top))] pb-4'
              }`}
            >
              {!isSchoolCountsStep && (
                <div className="cursor-pointer w-fit" onClick={() => navigate('/')}>
                  <VividbooksLogo />
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`text-left w-full text-[#001161] font-['Fenomen_Sans',sans-serif] text-[15px] font-semibold hover:text-[#ff6a35] transition-colors py-1 ${
                  isSchoolCountsStep ? 'mt-0' : 'mt-8'
                }`}
              >
                {'\u2190 Zp\u011bt k n\xe1kupu'}
              </button>
              <div
                id="order-summary-slot-mobile"
                className={`border-t border-gray-200 max-h-[min(42vh,280px)] overflow-y-auto ${
                  isSchoolCountsStep ? 'mt-3 pt-3' : 'mt-[calc(1.25rem_-_30px)] pt-4'
                }`}
              />
            </div>
          ) : (
            /* Mobilní horní lišta — v toku dokumentu (ne sticky/fixed), logo + CTA + menu */
            <div className="md:hidden relative z-40 shrink-0 bg-white border-b border-gray-100 px-4 py-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-2">
                {location.pathname === '/' ? (
                  <div className="scale-75 origin-left -my-1 cursor-pointer" onClick={() => navigate('/')}>
                    <VividbooksLogo />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="text-[#001161] font-['Fenomen_Sans',sans-serif] text-[14px] flex items-center gap-1 shrink-0 py-1 text-left"
                  >
                    {'\u2190 Zp\u011bt'}
                  </button>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  {isDistributorMode ? (
                    <button
                      type="button"
                      onClick={handleDownloadPack}
                      disabled={isDownloadingPack}
                      className="bg-[#001161] text-white px-3 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[13px] font-bold flex items-center gap-1.5"
                    >
                      {isDownloadingPack ? (
                        <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      ZIP
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onOrder}
                      className="bg-[#001161] text-white px-3 py-2 rounded-[999px] font-['Fenomen_Sans',sans-serif] text-[12px] sm:text-[13px] font-bold flex items-center gap-2 max-[380px]:px-2.5"
                    >
                      <span className="whitespace-nowrap">{'Objednat pro školu'}</span>
                      {schoolOrderCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-white text-[#001161] text-[11px] font-bold flex items-center justify-center shrink-0">
                          {schoolOrderCount}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen((v) => !v)}
                    className="p-2 rounded-xl bg-gray-100 text-[#001161] shrink-0"
                    aria-label="Otevřít menu"
                  >
                    <Menu className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Desktop sidebar ────────────────────────────────── */}
          <aside
            className={`hidden md:flex w-[245px] md:fixed md:top-0 md:bottom-0 bg-[#f8f9fc] border-r border-[#001161]/8 flex-col z-40 ${
              isCheckoutLikeSidebar
                ? isSchoolCountsStep
                  ? 'overflow-hidden justify-start px-5 pb-5 pt-5'
                  : 'overflow-hidden justify-start px-5 pb-5 pt-12'
                : 'overflow-y-auto justify-between p-5'
            }`}
          >
            <div className={isCheckoutLikeSidebar ? 'flex flex-col flex-1 min-h-0 w-full' : ''}>
              {!(isSchoolCountsStep) && (
                <div
                  className={`pt-2 cursor-pointer ${isCheckoutLikeSidebar ? 'mb-0' : 'mb-5'}`}
                  onClick={() => navigate('/')}
                >
                  <VividbooksLogo />
                </div>
              )}

              {isCheckoutLikeSidebar ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className={`w-full text-left px-2 py-2 rounded-lg font-['Fenomen_Sans',sans-serif] text-[15px] font-semibold text-[#001161] hover:text-[#ff6a35] hover:bg-orange-50/80 transition-colors ${
                      isSchoolCountsStep ? 'mt-0 shrink-0' : 'mt-10'
                    }`}
                  >
                    {'\u2190 Zp\u011bt k n\xe1kupu'}
                  </button>
                  {isCheckoutView ? (
                    <div
                      id="checkout-summary-slot-desktop"
                      className="mt-[calc(4.5rem_-_30px)] flex-1 min-h-0 overflow-y-auto pb-2"
                    />
                  ) : isSchoolOrderView ? (
                    <div
                      id="order-sidebar-slot"
                      className={`flex-1 min-h-0 overflow-y-auto pb-2 ${
                        isSchoolCountsStep ? 'mt-3' : 'mt-[calc(4.5rem_-_30px)]'
                      }`}
                    />
                  ) : (
                    <div className="mt-[calc(4.5rem_-_30px)] flex-1 min-h-0" />
                  )}
                </>
              ) : (
                <>
                  <div className="mb-6 px-2">
                    <p className="font-['Cooper_Light',serif] text-[#001161] text-[23px] leading-snug">
                      {'U\u010den\u00ed, kter\u00e9'}<br />{'inspiruje a bav\u00ed.'}
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* 2. stupeň */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#001161]/50 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold uppercase tracking-wider px-2 mb-0.5">
                        {'2. stupe\u0148'}
                      </span>
                      <div className="flex flex-col">
                        {(groupingMode === 'subject' ? secondGradeSubjects : secondGradeLevels).map(item => {
                          const id    = item.replace(/\s+/g, '-').toLowerCase();
                          const label = item.replace(/\s+\d+\.\s*stupe\S*/g, '');
                          const slug  = subjectToSlug(item);
                          const isActive = location.pathname === `/predmet/${slug}` || (activeSection === id && location.pathname === '/');
                          return (
                            <button
                              key={item}
                              onClick={() => navigate(`/predmet/${slug}`)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] transition-all cursor-pointer ${
                                isActive ? 'bg-[#c8d7f7] text-[#001161]' : 'text-[#001161] hover:bg-white border border-transparent hover:border-gray-200'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 1. stupeň */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#001161]/50 font-['Fenomen_Sans',sans-serif] text-[14px] font-bold uppercase tracking-wider px-2 mb-0.5">
                        {'1. stupe\u0148'}
                      </span>
                      <div className="flex flex-col">
                        {(groupingMode === 'subject' ? firstGradeSubjects : firstGradeLevels).map(item => {
                          const id    = item.replace(/\s+/g, '-').toLowerCase();
                          const label = item.replace(/\s+\d+\.\s*stupe\S*/g, '');
                          const slug  = subjectToSlug(item);
                          const isActive = location.pathname === `/predmet/${slug}` || (activeSection === id && location.pathname === '/');
                          return (
                            <button
                              key={item}
                              onClick={() => navigate(`/predmet/${slug}`)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg font-['Fenomen_Sans',sans-serif] text-[16px] transition-all cursor-pointer ${
                                isActive ? 'bg-[#c8d7f7] text-[#001161]' : 'text-[#001161] hover:bg-white border border-transparent hover:border-gray-200'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Accordion nav sections */}
                  <SidebarAccordion />
                </>
              )}
            </div>

            {isDistributorMode && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={handleDownloadPack}
                  disabled={isDownloadingPack}
                  className="w-full py-4 px-4 rounded-2xl font-['Fenomen_Sans',sans-serif] text-[18px] font-bold shadow-lg transition-all cursor-pointer bg-[#001161] text-white hover:bg-[#6b58ff] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {isDownloadingPack ? (
                    <>
                      <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{'P\u0159ipravuji...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="size-5" />
                      <span>{'St\u00e1hnout podklady'}</span>
                    </>
                  )}
                </button>
              </div>
            )}

          </aside>

          {/* ── Main content area ───────────────────────────────── */}
          <main
            className={`md:ml-[245px] md:w-[calc(100vw-245px)] min-h-screen pb-20 ${
              isCheckoutLikeSidebar ? 'md:pt-0 md:relative md:z-[41]' : 'md:pt-14'
            }`}
          >
            {location.pathname === '/' && !isCheckoutLikeSidebar && (
              <div className="md:hidden px-4 pt-2 pb-2 border-b border-gray-100/90 bg-white">
                <div className="relative group/nav">
                  <div
                    ref={navRef}
                    className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth px-1"
                  >
                    {(groupingMode === 'subject'
                      ? [...secondGradeSubjects, ...firstGradeSubjects]
                      : [...secondGradeLevels, ...firstGradeLevels]
                    ).map((item) => {
                      const id = item.replace(/\s+/g, '-').toLowerCase();
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => scrollToSection(id)}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-xl font-['Fenomen_Sans',sans-serif] text-[15px] transition-all shrink-0 ${
                            activeSection === id ? 'bg-[#c8d7f7] text-[#001161] font-bold shadow-sm' : 'bg-gray-50 text-[#001161]'
                          }`}
                        >
                          {stripStupen(item)}
                        </button>
                      );
                    })}
                    <div className="w-12 shrink-0 h-1" />
                  </div>
                  <AnimatePresence>
                    {canScrollRight && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-0 right-0 bottom-2 w-16 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10 flex items-center justify-end"
                      >
                        <button
                          type="button"
                          onClick={scrollMobileNext}
                          className="size-[37px] flex items-center justify-center bg-[#001161] rounded-full shadow-lg mr-1 pointer-events-auto cursor-pointer active:scale-90 transition-transform"
                        >
                          <ChevronRight className="w-5 h-5 text-white" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </CatalogContext.Provider>
  );
}