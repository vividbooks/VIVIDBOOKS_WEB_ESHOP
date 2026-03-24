import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Sparkles, ChevronLeft, ChevronRight, RefreshCw,
  Edit2, Send, FileText, Mail, Radio, Newspaper, Layers, LayoutTemplate,
  AlertCircle, Save, Check, Eye, EyeOff, Copy,
  RotateCcw, Pencil, Image, Wand2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import CollageModal from './CollageModal';
import {
  HERO_SLIDER_HEIGHT_PX,
  heroSlideShouldShowCta,
  heroTitleFontCss,
  heroTitleFontUseTightTracking,
  normalizeHeroSlideTitleFont,
} from '../../data/heroSlides';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

/* ── Types ─────────────────────────────────────────────────── */
export type CanvasType = 'blog' | 'email' | 'social' | 'webinar' | 'novinka' | 'slider' | 'tabs' | 'generic';

export interface CanvasDataSource {
  type: 'subject-tabs' | 'blog' | 'slider' | 'webinar' | 'novinka' | 'email' | 'product';
  subject?: string;
  id?: string;
}

interface ContentCanvasProps {
  content: string;
  title?: string;
  type?: CanvasType;
  dataSource?: CanvasDataSource;
  mobileFullscreen?: boolean;
  onClose: () => void;
  onSendToAgent: (prompt: string) => void;
}

/* ── Detect & worthy ─────────────────────────────────────── */
export function detectCanvasType(text: string): CanvasType {
  const t = text.toLowerCase();
  if (/(předmět:|subject:|preview text:|cta:|mailchimp)/i.test(text)) return 'email';
  if (/(# .{3,})\n/.test(text) && /(## .{3,})\n/.test(text) && text.length > 600) return 'blog';
  if (/webinář|webinar/i.test(t)) return 'webinar';
  if (/novink|aktualit/i.test(t)) return 'novinka';
  if (/slide[r]?|banner|hero/i.test(t)) return 'slider';
  if (/tab[ys]?|záložk/i.test(t)) return 'tabs';
  if (/linkedin|instagram|facebook|social|post\b/i.test(t)) return 'social';
  return 'generic';
}

export function isCanvasWorthy(content: string): boolean {
  if (content.length < 350) return false;
  if (/(předmět:|subject:|preview text:)/i.test(content)) return true;
  if (/^#\s.{3,}/m.test(content) && /^##\s.{3,}/m.test(content)) return true;
  if (content.length > 700 && (content.match(/^##?\s/gm) || []).length >= 2) return true;
  return false;
}

const DS_META: Record<CanvasDataSource['type'], { label: string; color: string; bg: string; icon: any; apiPath: string }> = {
  'subject-tabs': { label: 'Taby předmětu', color: '#0d9488', bg: '#ccfbf1', icon: Layers, apiPath: 'tabs' },
  'blog':         { label: 'Blog', color: '#001161', bg: '#e8eaf8', icon: FileText, apiPath: 'blog' },
  'slider':       { label: 'Hero Slidery', color: '#ea580c', bg: '#ffedd5', icon: LayoutTemplate, apiPath: 'hero-slidy' },
  'webinar':      { label: 'Webináře', color: '#0891b2', bg: '#e0f7fa', icon: Radio, apiPath: 'webinare' },
  'novinka':      { label: 'Novinky', color: '#059669', bg: '#d1fae5', icon: Newspaper, apiPath: 'novinky' },
  'email':        { label: 'Email', color: '#7C3AED', bg: '#ede9fe', icon: Mail, apiPath: 'email-drafts' },
  'product':      { label: 'Produkt', color: '#2563eb', bg: '#dbeafe', icon: FileText, apiPath: 'products' },
};

const SUBJECTS = ['Matematika 1', 'Matematika 2', 'Fyzika', 'Chemie', 'Přírodopis', 'Český jazyk', 'Prvouka'];

/* ══════════════════════════════════════════════════════════
   VISUAL PREVIEW COMPONENTS
   ══════════════════════════════════════════════════════════ */

/* ── Subject Tabs Preview (full UI) ── */
function SubjectTabsPreview({ items, onEditRequest, onOpenCollage }: {
  items: any[];
  onEditRequest: (item: any) => void;
  onOpenCollage: (item: any, field: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = items[activeIdx];

  if (!items.length) return (
    <div className="flex flex-col items-center py-16 text-white/25" style={{ background: '#243653' }}>
      <Layers className="w-8 h-8 mb-2" />
      <span style={FF} className="text-[13px]">Žádné taby pro tento předmět</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Náhled label */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ background: 'rgba(36,54,83,0.07)', borderBottom: '1px solid rgba(36,54,83,0.1)' }}>
        <Eye className="w-3 h-3" style={{ color: 'rgba(36,54,83,0.4)' }} />
        <span style={{ ...FF, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(36,54,83,0.4)', textTransform: 'uppercase' as const }}>
          Náhled webu — přesná kopie frontendu
        </span>
        <div className="flex-1" />
        <button
          onClick={() => onEditRequest(active)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-colors cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-2.5 h-2.5" /> Upravit tab
        </button>
      </div>

      {/* Celý frontend blok — tmavé pozadí jako na webu */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#243653' }}>
        <div className="py-10 px-6">
          <h2
            className="leading-tight mb-7 text-white"
            style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: '22px', fontWeight: 700 }}
          >
            Co vše obsahuje naše učebnice?
          </h2>

          <div className="flex gap-8" style={{ minHeight: 280 }}>
            {/* Left: vertikální nav — přesně jako na webu */}
            <nav className="flex flex-col gap-0.5 shrink-0" style={{ width: 170 }}>
              {items.map((tab, i) => (
                <button
                  key={tab.id || i}
                  onClick={() => setActiveIdx(i)}
                  className="text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer"
                  style={{
                    fontFamily: "'Fenomen Sans', sans-serif",
                    fontSize: '14px',
                    fontWeight: activeIdx === i ? 700 : 400,
                    background: activeIdx === i ? '#F9E000' : 'transparent',
                    color: activeIdx === i ? '#001161' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {tab.tabText || `Tab ${i + 1}`}
                </button>
              ))}
            </nav>

            {/* Right: content card — přesně jako na webu */}
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={active.id || activeIdx}
                  className="flex-1 overflow-hidden"
                  style={{ borderRadius: 28, background: active.bgColor || '#ffffff', minHeight: 260, display: 'flex', flexDirection: 'row' }}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Text — levá polovina */}
                  <div className="overflow-y-auto" style={{ width: '50%', flexShrink: 0, padding: '28px 28px 28px 28px' }}>
                    {active.contentHeadline ? (
                      <h3
                        className="text-[#001161] leading-tight mb-4"
                        style={{ fontFamily: "'Cooper Light', serif", fontSize: '20px' }}
                      >
                        {active.contentHeadline}
                      </h3>
                    ) : (
                      <p style={FF} className="text-[13px] text-[#001161]/25 italic">Nadpis není vyplněn</p>
                    )}
                    {active.contentRichText && (
                      <p
                        className="leading-relaxed"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: '13px', color: 'rgba(0,17,97,0.7)', whiteSpace: 'pre-line' }}
                      >
                        {active.contentRichText}
                      </p>
                    )}
                  </div>

                  {/* Obrázek — pravá polovina (klikací) */}
                  <div
                    className="relative overflow-hidden group cursor-pointer"
                    style={{ width: '50%', flexShrink: 0, background: active.contentImage ? undefined : 'rgba(0,17,97,0.05)' }}
                    onClick={() => onOpenCollage(active, 'contentImage')}
                  >
                    {active.contentImage ? (
                      <img
                        src={active.contentImage}
                        alt={active.contentHeadline || active.tabText || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left', display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 min-h-[120px]">
                        <Image className="w-6 h-6" style={{ color: 'rgba(0,17,97,0.2)' }} />
                        <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.25)', textAlign: 'center', padding: '0 12px' }}>
                          Klikni pro výběr<br />nebo generování obrázku
                        </span>
                      </div>
                    )}
                    {/* Hover overlay — vždy zobrazí tlačítko */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 shadow-lg" style={FF}>
                          <Wand2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED' }}>Obrázek / Koláž</span>
                        </div>
                        {active.contentImage && (
                          <span style={{ ...FF, fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>klikni pro změnu</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-[#001161]/8 px-4 py-2 flex items-center gap-2 bg-white shrink-0">
        <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.3)' }}>
          Tab {activeIdx + 1} / {items.length}{active?.tabText ? ` · ${active.tabText}` : ''}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setActiveIdx(v => Math.max(0, v - 1))}
          disabled={activeIdx === 0}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-[#001161]/50" />
        </button>
        <button
          onClick={() => setActiveIdx(v => Math.min(items.length - 1, v + 1))}
          disabled={activeIdx === items.length - 1}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition-all"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[#001161]/50" />
        </button>
        <button
          onClick={() => onOpenCollage(active, 'contentImage')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#7C3AED]/25 text-[11px] font-bold text-[#7C3AED]/70 hover:text-[#7C3AED] hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
          title="Vybrat nebo generovat obrázek pro tento tab"
        >
          <Wand2 className="w-3 h-3" /> Obrázek
        </button>
        <button
          onClick={() => onEditRequest(active)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#001161]/12 text-[11px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-3 h-3" /> Upravit
        </button>
      </div>
    </div>
  );
}

/* ── Blog Article Preview ── */
function BlogPreview({ item, onEditRequest, onOpenCollage }: { item: any; onEditRequest: (item: any) => void; onOpenCollage: (item: any, field: string) => void }) {
  const [showFull, setShowFull] = useState(false);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {(item.coverImage || item.imageUrl) && (
          <div className="relative w-full group cursor-pointer" style={{ aspectRatio: '16/7' }} onClick={() => onOpenCollage(item, item.coverImage ? 'coverImage' : 'imageUrl')}>
            <img
              src={item.coverImage || item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={e => (e.target as HTMLImageElement).style.display = 'none'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            {item.category && (
              <span
                style={{ ...FF, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 10px', background: '#7C3AED', color: '#fff', position: 'absolute', bottom: 12, left: 16 }}
              >
                {item.category}
              </span>
            )}
            <span
              style={{ ...FF, fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', position: 'absolute', top: 10, right: 10, background: item.published ? '#dcfce7' : '#f3f4f6', color: item.published ? '#059669' : '#9ca3af' }}
            >
              {item.published ? '● Publikováno' : '○ Draft'}
            </span>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 shadow-lg" style={FF}>
                <Wand2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED' }}>Změnit cover</span>
              </div>
            </div>
          </div>
        )}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {item.tags && <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.4)' }}>{item.tags}</span>}
          </div>
          <h2 style={FF} className="text-[22px] font-black text-[#001161] leading-tight">
            {item.title || 'Bez názvu'}
          </h2>
          {item.excerpt && (
            <p style={FF} className="text-[14px] text-[#001161]/60 leading-relaxed border-l-2 border-[#7C3AED]/30 pl-3 italic">
              {item.excerpt}
            </p>
          )}
          {item.content && (
            <div>
              <button
                onClick={() => setShowFull(v => !v)}
                style={FF}
                className="flex items-center gap-1 text-[11px] font-bold text-[#7C3AED]/60 hover:text-[#7C3AED] cursor-pointer transition-colors mb-2"
              >
                {showFull ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showFull ? 'Skrýt obsah' : 'Zobrazit obsah článku'}
              </button>
              {showFull && (
                <div
                  className="prose prose-sm max-w-none text-[13px] text-[#001161]/70 leading-relaxed border border-[#001161]/6 rounded-xl p-4 bg-[#fafbff]"
                  style={FF}
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-[#001161]/6 px-4 py-2 flex items-center gap-2 bg-white">
        <div className="flex-1" />
        <button
          onClick={() => onEditRequest(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#001161]/12 text-[11px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-3 h-3" /> Upravit
        </button>
      </div>
    </div>
  );
}

/* ── Hero Slide Preview — přesná kopie frontendu (rounded-[35px], Cooper Light, dots) ── */
function SliderPreview({ items, activeIdx, onChangeIdx, onEditRequest, onOpenCollage }: {
  items: any[];
  activeIdx: number;
  onChangeIdx: (i: number) => void;
  onEditRequest: (item: any) => void;
  onOpenCollage: (item: any, field: string) => void;
}) {
  const item = items[activeIdx];
  if (!item) return null;

  const bgColor = item.bgColor || item.bgStyle || '#f5f0e8';
  const isLight = item.textLight;
  const textColor = isLight ? '#fff' : '#001161';
  const textMuted = isLight ? 'rgba(255,255,255,0.65)' : 'rgba(0,17,97,0.6)';
  const titleFontId = normalizeHeroSlideTitleFont(item.titleFont);
  const titleFontStyles = heroTitleFontCss(titleFontId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Náhled label */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ background: 'rgba(0,17,97,0.04)', borderBottom: '1px solid rgba(0,17,97,0.07)' }}>
        <Eye className="w-3 h-3 text-[#001161]/30" />
        <span style={{ ...FF, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(0,17,97,0.35)', textTransform: 'uppercase' as const }}>
          Náhled webu — hero slider
        </span>
        <div className="flex-1" />
        <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.3)' }}>
          {activeIdx + 1} / {items.length}
        </span>
        <span
          style={{ ...FF, fontSize: 9, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: item.active !== false ? '#dcfce7' : '#f3f4f6', color: item.active !== false ? '#059669' : '#9ca3af' }}
        >
          {item.active !== false ? '● Aktivní' : '○ Neaktivní'}
        </span>
      </div>

      {/* Slider wrapper — p-4 jako na webu */}
      <div className="flex-1 overflow-y-auto bg-[#f7f8fc] p-4">
        {/* Hero card — rounded-[35px] jako na webu */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIdx}
            className="relative flex flex-col overflow-hidden select-none"
            style={{ borderRadius: 35, background: bgColor, height: HERO_SLIDER_HEIGHT_PX }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            {/* Background image overlay */}
            {(item.bgImage || item.image) && (
              <img
                src={item.bgImage || item.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20"
                onError={e => (e.target as HTMLImageElement).style.display = 'none'}
              />
            )}

            {/* Slide content — left text + optional right image */}
            <div
              className={`relative z-10 flex min-h-0 w-full flex-1 ${item.layout === 'left-image' ? 'flex-row items-stretch' : 'flex-col items-center justify-center'}`}
              style={{ padding: item.layout === 'left-image' ? '40px 28px' : '48px 28px', gap: 16 }}
            >
              {/* Text block */}
              <div className={`flex flex-col gap-3 ${item.layout === 'left-image' ? 'flex-1' : 'items-center text-center max-w-[90%]'}`}>
                {item.badge && (
                  <span style={{
                    ...FF, fontSize: 10, fontWeight: 800, borderRadius: 999,
                    padding: '3px 12px', background: 'rgba(124,58,237,0.9)', color: '#fff',
                    alignSelf: item.layout === 'left-image' ? 'flex-start' : 'center',
                    display: 'inline-block',
                  }}>
                    {item.badge}
                  </span>
                )}
                <h1
                  style={{
                    ...titleFontStyles,
                    fontSize: 34, lineHeight: 1.05, color: textColor,
                    letterSpacing: heroTitleFontUseTightTracking(titleFontId) ? '-0.01em' : '0',
                  }}
                >
                  {item.title || 'Hero nadpis'}
                </h1>
                {item.subtitle && (
                  <p style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: 14, color: textMuted, lineHeight: 1.5 }}>
                    {item.subtitle}
                  </p>
                )}
                {heroSlideShouldShowCta(item) ? (
                  <div style={{ alignSelf: item.layout === 'left-image' ? 'flex-start' : 'center' }}>
                    <span
                      style={{
                        ...FF, display: 'inline-block',
                        fontSize: 13, fontWeight: 800, borderRadius: 12,
                        padding: '10px 22px', background: '#7C3AED', color: '#fff',
                      }}
                    >
                      {String(item.ctaLabel).trim()}
                    </span>
                  </div>
                ) : item.ctaText ? (
                  <div style={{ alignSelf: item.layout === 'left-image' ? 'flex-start' : 'center' }}>
                    <span
                      style={{
                        ...FF, display: 'inline-block',
                        fontSize: 13, fontWeight: 800, borderRadius: 999,
                        padding: '10px 22px', background: '#FF6B1A', color: '#fff',
                      }}
                    >
                      {item.ctaText}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Right image for left-image layout — klikací */}
              {item.layout === 'left-image' && (
                <div
                  className="relative min-h-[120px] shrink-0 overflow-hidden rounded-[16px] group cursor-pointer"
                  style={{
                    width: '35%',
                    height: '100%',
                    maxHeight: HERO_SLIDER_HEIGHT_PX - 80,
                    background: item.image ? undefined : 'rgba(255,255,255,0.1)',
                  }}
                  onClick={() => onOpenCollage(item, 'image')}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title || ''}
                      className="w-full h-full object-cover"
                      onError={e => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                      <Image className="w-5 h-5 text-white/40" />
                      <span style={{ ...FF, fontSize: 9, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>obrázek vpravo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 shadow">
                      <Wand2 className="w-3 h-3 text-[#7C3AED]" />
                      <span style={{ ...FF, fontSize: 10, fontWeight: 800, color: '#7C3AED' }}>Obrázek</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 📷 Tlačítko pro pozadí slideru */}
            <button
              onClick={() => onOpenCollage(item, 'bgImage')}
              className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all cursor-pointer shadow-md"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            >
              <Wand2 className="w-3 h-3 text-white/80" />
              <span style={{ ...FF, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em' }}>
                {(item.bgImage || item.image) ? 'Změnit pozadí' : 'Přidat pozadí'}
              </span>
            </button>

            {/* Prev / Next arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={() => onChangeIdx(Math.max(0, activeIdx - 1))}
                  disabled={activeIdx === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 size-9 flex items-center justify-center bg-white/70 hover:bg-white rounded-full shadow-md transition-all cursor-pointer disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4 text-[#001161]" />
                </button>
                <button
                  onClick={() => onChangeIdx(Math.min(items.length - 1, activeIdx + 1))}
                  disabled={activeIdx === items.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 size-9 flex items-center justify-center bg-white/70 hover:bg-white rounded-full shadow-md transition-all cursor-pointer disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 text-[#001161]" />
                </button>
              </>
            )}

            {/* Dots — přesně jako na webu */}
            {items.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {items.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => onChangeIdx(idx)}
                    className="rounded-full transition-all duration-300 cursor-pointer"
                    style={{
                      width: idx === activeIdx ? 22 : 9,
                      height: 9,
                      background: idx === activeIdx ? '#001161' : 'rgba(0,17,97,0.25)',
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* CTA URL + metadata */}
        <div className="mt-3 px-1 flex flex-wrap gap-3 items-center">
          {item.ctaUrl && (
            <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.35)' }}>
              🔗 CTA → {item.ctaUrl}
            </span>
          )}
          {item.order != null && (
            <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.25)' }}>Pořadí: {item.order}</span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-[#001161]/8 px-4 py-2 flex items-center gap-2 bg-white shrink-0">
        <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.3)' }}>
          Slide {activeIdx + 1} / {items.length}{item.title ? ` · ${item.title.slice(0, 30)}${item.title.length > 30 ? '…' : ''}` : ''}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => onOpenCollage(item, 'bgImage')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#ea580c]/25 text-[11px] font-bold text-[#ea580c]/70 hover:text-[#ea580c] hover:border-[#ea580c]/40 hover:bg-[#ea580c]/5 transition-all cursor-pointer"
          style={FF}
          title="Vybrat nebo generovat obrázek pozadí slideru"
        >
          <Wand2 className="w-3 h-3" /> Pozadí
        </button>
        <button
          onClick={() => onOpenCollage(item, 'image')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#7C3AED]/25 text-[11px] font-bold text-[#7C3AED]/70 hover:text-[#7C3AED] hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
          title="Vybrat nebo generovat obrázek vpravo (pro left-image layout)"
        >
          <Image className="w-3 h-3" /> Obrázek
        </button>
        <button
          onClick={() => onEditRequest(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#001161]/12 text-[11px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-3 h-3" /> Upravit
        </button>
      </div>
    </div>
  );
}

/* ── Webinar Preview ── */
function WebinarPreview({ item, onEditRequest }: { item: any; onEditRequest: (item: any) => void }) {
  const formatDate = (d: string) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Date block */}
        <div className="px-5 pt-6 pb-4 flex items-start gap-4">
          <div className="flex flex-col items-center justify-center bg-[#0891b2] text-white rounded-[14px] p-3 shrink-0 min-w-[56px]">
            {item.date ? (
              <>
                <span style={{ ...FF, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
                  {new Date(item.date).getDate()}
                </span>
                <span style={{ ...FF, fontSize: 10, fontWeight: 700, opacity: 0.8 }}>
                  {new Date(item.date).toLocaleDateString('cs-CZ', { month: 'short' })}
                </span>
              </>
            ) : (
              <span style={{ ...FF, fontSize: 11, fontWeight: 700 }}>—</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {item.date && (
              <span style={{ ...FF, fontSize: 12, color: '#0891b2', fontWeight: 700 }}>
                {formatDate(item.date)} {item.time ? `· ${item.time}` : ''}
              </span>
            )}
            {item.location && (
              <span style={{ ...FF, fontSize: 12, color: 'rgba(0,17,97,0.5)' }}>
                📍 {item.location}
              </span>
            )}
            {item.lecturer && (
              <span style={{ ...FF, fontSize: 12, color: 'rgba(0,17,97,0.5)' }}>
                👤 {item.lecturer}
              </span>
            )}
          </div>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <h2 style={FF} className="text-[20px] font-black text-[#001161] leading-tight">
            {item.title || 'Bez názvu'}
          </h2>
          {item.description && (
            <p style={FF} className="text-[14px] text-[#001161]/60 leading-relaxed">
              {item.description}
            </p>
          )}
          {item.zoomUrl && (
            <div className="flex items-center gap-2 bg-[#e0f7fa] rounded-[10px] px-3 py-2">
              <Radio className="w-3.5 h-3.5 text-[#0891b2]" />
              <span style={{ ...FF, fontSize: 11, color: '#0891b2' }} className="truncate">{item.zoomUrl}</span>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-[#001161]/6 px-4 py-2 flex items-center gap-2 bg-white">
        <div className="flex-1" />
        <button
          onClick={() => onEditRequest(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#001161]/12 text-[11px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-3 h-3" /> Upravit
        </button>
      </div>
    </div>
  );
}

/* ── Novinka Preview ── */
function NovinkaPreview({ item, onEditRequest, onOpenCollage }: { item: any; onEditRequest: (item: any) => void; onOpenCollage: (item: any, field: string) => void }) {
  const [showFull, setShowFull] = useState(false);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {(item.coverImage || item.imageUrl) && (
          <div className="group relative cursor-pointer" style={{ aspectRatio: '16/7', overflow: 'hidden' }} onClick={() => onOpenCollage(item, item.coverImage ? 'coverImage' : 'imageUrl')}>
            <img
              src={item.coverImage || item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={e => (e.target as HTMLImageElement).style.display = 'none'}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 shadow-lg" style={FF}>
                <Wand2 className="w-3.5 h-3.5 text-[#059669]" />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>Změnit obrázek</span>
              </div>
            </div>
          </div>
        )}
        <div className="px-5 py-4 space-y-2.5">
          <div className="flex items-center gap-2">
            {item.category && (
              <span style={{ ...FF, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 9px', background: '#d1fae5', color: '#059669' }}>
                {item.category}
              </span>
            )}
            {item.date && (
              <span style={{ ...FF, fontSize: 11, color: 'rgba(0,17,97,0.35)' }}>
                {new Date(item.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
          <h2 style={FF} className="text-[20px] font-black text-[#001161] leading-tight">
            {item.title || 'Bez názvu'}
          </h2>
          {item.excerpt && (
            <p style={FF} className="text-[14px] text-[#001161]/60 leading-relaxed">
              {item.excerpt}
            </p>
          )}
          {item.content && (
            <div>
              <button
                onClick={() => setShowFull(v => !v)}
                style={FF}
                className="flex items-center gap-1 text-[11px] font-bold text-[#059669]/60 hover:text-[#059669] cursor-pointer transition-colors mb-2"
              >
                {showFull ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showFull ? 'Skrýt obsah' : 'Celý obsah'}
              </button>
              {showFull && (
                <div
                  className="text-[13px] text-[#001161]/65 leading-relaxed border border-[#001161]/6 rounded-xl p-4 bg-[#fafbff]"
                  style={FF}
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-[#001161]/6 px-4 py-2 flex items-center gap-2 bg-white">
        <div className="flex-1" />
        <button
          onClick={() => onEditRequest(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#001161]/12 text-[11px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-3 h-3" /> Upravit
        </button>
      </div>
    </div>
  );
}

function ProductPreview({ item, onEditRequest }: { item: any; onEditRequest: (item: any) => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {item.image && (
          <div style={{ aspectRatio: '16/7', overflow: 'hidden', background: '#eff6ff' }}>
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={e => (e.target as HTMLImageElement).style.display = 'none'}
            />
          </div>
        )}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {item.category && (
              <span style={{ ...FF, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 9px', background: '#dbeafe', color: '#2563eb' }}>
                {item.category}
              </span>
            )}
            {item.type && (
              <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.4)' }}>
                {item.type}
              </span>
            )}
            {item.rocnik && (
              <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.4)' }}>
                {item.rocnik}
              </span>
            )}
          </div>
          <h2 style={FF} className="text-[22px] font-black text-[#001161] leading-tight">
            {item.name || 'Bez názvu produktu'}
          </h2>
          {(item.price || item.priceAmount) && (
            <p style={FF} className="text-[18px] font-bold text-[#2563eb]">
              {item.price || `${item.priceAmount}`}
            </p>
          )}
          {item.description && (
            <p style={FF} className="text-[14px] text-[#001161]/65 leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {item.previewLink && <div className="rounded-lg bg-[#fafbff] border border-[#001161]/8 px-3 py-2"><span style={FF} className="text-[10px] text-[#001161]/35 uppercase">Preview</span><p style={FF} className="text-[12px] text-[#001161]/70 truncate">{item.previewLink}</p></div>}
            {item.appLink && <div className="rounded-lg bg-[#fafbff] border border-[#001161]/8 px-3 py-2"><span style={FF} className="text-[10px] text-[#001161]/35 uppercase">App</span><p style={FF} className="text-[12px] text-[#001161]/70 truncate">{item.appLink}</p></div>}
          </div>
        </div>
      </div>
      <div className="border-t border-[#001161]/6 px-4 py-2 flex items-center gap-2 bg-white">
        <div className="flex-1" />
        <button
          onClick={() => onEditRequest(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#001161]/12 text-[11px] font-bold text-[#001161]/50 hover:text-[#2563eb] hover:border-[#2563eb]/30 hover:bg-[#2563eb]/5 transition-all cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-3 h-3" /> Upravit
        </button>
      </div>
    </div>
  );
}

/* ── Email Preview (text canvas special case) ── */
function EmailPreview({ blocks, onEditRequest }: { blocks: any[]; onEditRequest: () => void }) {
  const subject = blocks.find(b => b.fieldLabel?.toLowerCase().includes('předmět') || b.fieldLabel?.toLowerCase().includes('subject'))?.content || '';
  const preview = blocks.find(b => b.fieldLabel?.toLowerCase().includes('preview'))?.content || '';
  const cta = blocks.find(b => b.fieldLabel?.toLowerCase().includes('cta text'))?.content || '';
  const ctaUrl = blocks.find(b => b.fieldLabel?.toLowerCase().includes('cta url'))?.content || '';
  const bodyBlocks = blocks.filter(b => !b.fieldLabel && b.type !== 'spacer' && b.type !== 'divider');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Email client header */}
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span style={{ ...FF, fontSize: 10, fontWeight: 700, color: 'rgba(0,17,97,0.35)', minWidth: 52 }}>OD</span>
            <span style={{ ...FF, fontSize: 12, color: '#001161' }}>Vividbooks &lt;hello@vividbooks.com&gt;</span>
          </div>
          {subject && (
            <div className="flex items-start gap-2">
              <span style={{ ...FF, fontSize: 10, fontWeight: 700, color: 'rgba(0,17,97,0.35)', minWidth: 52 }}>PŘEDMĚT</span>
              <span style={{ ...FF, fontSize: 13, fontWeight: 800, color: '#001161' }}>{subject}</span>
            </div>
          )}
          {preview && (
            <div className="flex items-start gap-2">
              <span style={{ ...FF, fontSize: 10, fontWeight: 700, color: 'rgba(0,17,97,0.35)', minWidth: 52 }}>PREVIEW</span>
              <span style={{ ...FF, fontSize: 11, color: 'rgba(0,17,97,0.45)', fontStyle: 'italic' }}>{preview}</span>
            </div>
          )}
        </div>
        {/* Email body */}
        <div className="px-6 py-5 bg-white space-y-3">
          {/* Logo placeholder */}
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <div className="w-6 h-6 rounded-md bg-[#001161] flex items-center justify-center">
              <span style={{ ...FF, fontSize: 8, fontWeight: 900, color: '#fff' }}>VB</span>
            </div>
            <span style={{ ...FF, fontSize: 13, fontWeight: 900, color: '#001161' }}>Vividbooks</span>
          </div>
          {bodyBlocks.map((block, i) => {
            if (block.type === 'h1') return <h1 key={i} style={{ ...FF, fontSize: 22, fontWeight: 900, color: '#001161', lineHeight: 1.2 }}>{block.content}</h1>;
            if (block.type === 'h2') return <h2 key={i} style={{ ...FF, fontSize: 17, fontWeight: 800, color: '#001161' }}>{block.content}</h2>;
            if (block.type === 'h3') return <h3 key={i} style={{ ...FF, fontSize: 14, fontWeight: 700, color: '#001161' }}>{block.content}</h3>;
            if (block.type === 'list-item') return <div key={i} className="flex gap-2"><span className="text-[#FF6B1A] mt-0.5">•</span><span style={{ ...FF, fontSize: 13, color: 'rgba(0,17,97,0.7)', lineHeight: 1.6 }}>{block.content}</span></div>;
            return <p key={i} style={{ ...FF, fontSize: 13, color: 'rgba(0,17,97,0.7)', lineHeight: 1.65 }}>{block.content}</p>;
          })}
          {cta && (
            <div className="pt-2">
              <button
                style={{ ...FF, fontSize: 13, fontWeight: 800, borderRadius: 999, padding: '11px 28px', background: '#7C3AED', color: '#fff', border: 'none', cursor: 'default' }}
              >
                {cta}
              </button>
              {ctaUrl && <p style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.3)', marginTop: 4 }}>{ctaUrl}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-[#001161]/6 px-4 py-2 flex items-center gap-2 bg-white">
        <div className="flex-1" />
        <button
          onClick={onEditRequest}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#001161]/12 text-[11px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
          style={FF}
        >
          <Edit2 className="w-3 h-3" /> Upravit
        </button>
      </div>
    </div>
  );
}

/* ── Inline Edit Overlay ── */
function EditOverlay({ item, fields, onSave, onClose }: {
  item: any;
  fields: { key: string; label: string; multiline?: boolean; type?: string }[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [data, setData] = useState({ ...item });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(data); onClose(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <Pencil className="w-3.5 h-3.5 text-[#7C3AED]" />
        <span style={FF} className="text-[13px] font-bold text-[#001161] flex-1">Upravit</span>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
          <X className="w-3.5 h-3.5 text-[#001161]/40" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {fields.map(f => (
          <div key={f.key} className="flex flex-col gap-1">
            <label style={{ ...FF, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,17,97,0.35)' }}>
              {f.label}
            </label>
            {f.multiline ? (
              <textarea
                value={String(data[f.key] || '')}
                onChange={e => upd(f.key, e.target.value)}
                rows={4}
                className="w-full resize-none rounded-[8px] border border-[#001161]/12 px-2.5 py-2 text-[12px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40 bg-[#fafbff]"
                style={FF}
              />
            ) : (
              <input
                type={f.type || 'text'}
                value={String(data[f.key] || '')}
                onChange={e => upd(f.key, e.target.value)}
                className="w-full rounded-[8px] border border-[#001161]/12 px-2.5 py-2 text-[12px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/40 bg-[#fafbff]"
                style={FF}
              />
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#001161] text-white text-[12px] font-bold cursor-pointer hover:opacity-90 disabled:opacity-40 transition-all"
          style={FF}
        >
          {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? 'Ukládám...' : 'Uložit'}
        </button>
        <button onClick={onClose} className="px-3 py-2 text-[12px] font-bold text-[#001161]/40 hover:text-[#001161] cursor-pointer" style={FF}>
          Zrušit
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   STRUCTURED CANVAS — fetches live data, shows visual preview
   ══════════════════════════════════════════════════════════ */
function StructuredCanvas({ dataSource, onClose, onSendToAgent, mobileFullscreen = false }: {
  dataSource: CanvasDataSource;
  onClose: () => void;
  onSendToAgent: (prompt: string) => void;
  mobileFullscreen?: boolean;
}) {
  const meta = DS_META[dataSource.type];
  const MetaIcon = meta.icon;
  const shellStyle = mobileFullscreen ? { width: '100%', height: '100%' } : { width: 700, height: '100%' };

  const [activeSubject, setActiveSubject] = useState<string>(dataSource.subject || SUBJECTS[0]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedSnippet, setSelectedSnippet] = useState('');
  const promptRef = useRef<HTMLInputElement>(null);

  /* ── Collage / image picker ── */
  const [collageOpen, setCollageOpen] = useState(false);
  const [collageTarget, setCollageTarget] = useState<{ item: any; field: string } | null>(null);

  const openCollageFor = (item: any, field: string) => {
    setCollageTarget({ item, field });
    setCollageOpen(true);
  };

  const handleCollageInsert = async (url: string) => {
    if (!collageTarget) return;
    const updated = { ...collageTarget.item, [collageTarget.field]: url };
    try {
      await saveItem(updated);
      // Also update items array locally
      setItems(prev => prev.map(it => it.id === updated.id ? updated : it));
      toast.success('Obrázek uložen!');
    } catch (e: any) {
      toast.error(e.message);
    }
    setCollageOpen(false);
    setCollageTarget(null);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '';
      if (dataSource.type === 'subject-tabs') url = `${SERVER}/admin/tabs`;
      else if (dataSource.type === 'blog') url = `${SERVER}/admin/blog`;
      else if (dataSource.type === 'slider') url = `${SERVER}/admin/hero-slidy`;
      else if (dataSource.type === 'webinar') url = `${SERVER}/admin/webinare`;
      else if (dataSource.type === 'novinka') url = `${SERVER}/admin/novinky`;
      else if (dataSource.type === 'email') url = dataSource.id ? `${SERVER}/admin/email-drafts/${dataSource.id}` : `${SERVER}/admin/email-drafts`;
      else if (dataSource.type === 'product') url = `${SERVER}/products`;
      if (!url) { setLoading(false); return; }
      const res = await fetch(url, { headers: AUTH });
      const d = await res.json();
      let all = d.items || d.slides || d.posts || d.novinky || d.webinare || d.drafts || d.products || [];
      if (dataSource.type === 'email') {
        all = d.draft ? [d.draft] : (d.drafts || []);
      }
      if (dataSource.type === 'product') {
        all = d.products || [];
        if (dataSource.id) all = all.filter((p: any) => p.id === dataSource.id);
      }
      if (dataSource.type === 'subject-tabs') {
        const norm = (s: string) => (s || '').trim().toLowerCase();
        all = all.filter((t: any) => norm(t.subject) === norm(activeSubject));
        all = all.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      }
      setItems(all);
      setActiveIdx(0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataSource, activeSubject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveItem = async (data: any) => {
    const id = data.id;
    let url = '';
    if (dataSource.type === 'subject-tabs') url = `${SERVER}/admin/tabs/${id}`;
    else if (dataSource.type === 'blog') url = `${SERVER}/admin/blog/${id}`;
    else if (dataSource.type === 'slider') url = `${SERVER}/admin/hero-slidy/${id}`;
    else if (dataSource.type === 'webinar') url = `${SERVER}/admin/webinare/${id}`;
    else if (dataSource.type === 'novinka') url = `${SERVER}/admin/novinky/${id}`;
    else if (dataSource.type === 'email') url = `${SERVER}/admin/email-drafts`;
    else if (dataSource.type === 'product') url = `${SERVER}/products/${id}`;
    const method = dataSource.type === 'email' ? 'POST' : 'PUT';
    const res = await fetch(url, { method, headers: AUTH, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(await res.text());
    setItems(prev => prev.map(i => i.id === id ? data : i));
    toast.success('Uloženo!');
  };

  const sendPrompt = () => {
    if (!prompt.trim()) return;
    const ctx = dataSource.type === 'subject-tabs'
      ? `${meta.label}: ${activeSubject} (${items.length} tabů)`
      : `${meta.label} (${items.length} položek)${items[activeIdx] ? ` · "${items[activeIdx].title || items[activeIdx].tabText || ''}"` : ''}`;
    const selectionPart = selectedSnippet ? `\n\nZaměř se pouze na tuto označenou část a přepiš jen ji:\n"""${selectedSnippet}"""` : '';
    onSendToAgent(`${prompt.trim()}\n\nKontext: ${ctx}${selectionPart}`);
    setPrompt('');
    setSelectedSnippet('');
    promptRef.current?.blur();
  };

  const captureSelection = () => {
    const sel = window.getSelection?.();
    const text = sel?.toString().trim() || '';
    setSelectedSnippet(text.length >= 3 ? text.slice(0, 600) : '');
  };

  const activeItem = items[activeIdx];

  // Edit fields per type
  const getEditFields = (type: CanvasDataSource['type']) => {
    if (type === 'subject-tabs') return [
      { key: 'tabText', label: 'Název záložky' },
      { key: 'contentHeadline', label: 'Nadpis obsahu' },
      { key: 'contentRichText', label: 'Text / popis', multiline: true },
      { key: 'contentImage', label: 'URL obrázku' },
      { key: 'bgColor', label: 'Barva pozadí' },
      { key: 'order', label: 'Pořadí', type: 'number' },
    ];
    if (type === 'blog') return [
      { key: 'title', label: 'Titulek' },
      { key: 'excerpt', label: 'Perex', multiline: true },
      { key: 'category', label: 'Kategorie' },
      { key: 'tags', label: 'Tagy' },
      { key: 'coverImage', label: 'Cover URL' },
      { key: 'content', label: 'Obsah článku (HTML)', multiline: true },
    ];
    if (type === 'slider') return [
      { key: 'title', label: 'Titulek' },
      { key: 'subtitle', label: 'Podtitulek', multiline: true },
      { key: 'ctaText', label: 'CTA text' },
      { key: 'ctaUrl', label: 'CTA URL' },
      { key: 'badge', label: 'Odznak (badge)' },
      { key: 'bgColor', label: 'Barva pozadí' },
    ];
    if (type === 'webinar') return [
      { key: 'title', label: 'Titulek' },
      { key: 'lecturer', label: 'Lektor' },
      { key: 'date', label: 'Datum', type: 'date' },
      { key: 'time', label: 'Čas' },
      { key: 'location', label: 'Místo / platforma' },
      { key: 'description', label: 'Popis', multiline: true },
      { key: 'zoomUrl', label: 'Zoom URL' },
    ];
    if (type === 'novinka') return [
      { key: 'title', label: 'Titulek' },
      { key: 'category', label: 'Kategorie' },
      { key: 'date', label: 'Datum', type: 'date' },
      { key: 'excerpt', label: 'Perex', multiline: true },
      { key: 'coverImage', label: 'Cover URL' },
      { key: 'content', label: 'Obsah novinky (HTML)', multiline: true },
    ];
    if (type === 'email') return [
      { key: 'subject', label: 'Předmět' },
      { key: 'previewText', label: 'Preview text' },
      { key: 'headline', label: 'Headline' },
      { key: 'bodyHtml', label: 'HTML tělo', multiline: true },
      { key: 'ctaText', label: 'CTA text' },
      { key: 'ctaUrl', label: 'CTA URL' },
    ];
    if (type === 'product') return [
      { key: 'name', label: 'Název produktu' },
      { key: 'category', label: 'Kategorie' },
      { key: 'price', label: 'Cena' },
      { key: 'description', label: 'Popis', multiline: true },
      { key: 'image', label: 'URL obrázku' },
      { key: 'previewLink', label: 'Preview link' },
      { key: 'appLink', label: 'App link' },
    ];
    return [];
  };

  return (
    <div
      className={`flex flex-col bg-white relative ${mobileFullscreen ? 'w-full h-full' : 'border-l border-gray-200 shrink-0'}`}
      style={shellStyle}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 ${mobileFullscreen ? 'px-3' : 'px-4'} border-b border-gray-200 shrink-0 bg-white`} style={{ height: 48 }}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: meta.bg }}>
          <MetaIcon className="w-3 h-3" style={{ color: meta.color }} />
          <span style={{ ...FF, fontSize: 10, fontWeight: 800, color: meta.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {meta.label}
          </span>
        </div>
        {/* Item navigation (non-tabs, non-slider — slider has its own arrows) */}
        {dataSource.type !== 'subject-tabs' && dataSource.type !== 'slider' && items.length > 1 && (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => setActiveIdx(v => Math.max(0, v - 1))}
              disabled={activeIdx === 0}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#001161]/50" />
            </button>
            <span style={{ ...FF, fontSize: 10, color: 'rgba(0,17,97,0.4)', minWidth: 32, textAlign: 'center' }}>
              {activeIdx + 1}/{items.length}
            </span>
            <button
              onClick={() => setActiveIdx(v => Math.min(items.length - 1, v + 1))}
              disabled={activeIdx === items.length - 1}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-30 cursor-pointer transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#001161]/50" />
            </button>
          </div>
        )}
        <div className="flex-1" />
        <button onClick={fetchData} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 hover:text-[#001161] cursor-pointer transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 hover:text-[#001161] cursor-pointer transition-all">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subject selector — only for subject-tabs */}
      {dataSource.type === 'subject-tabs' && (
        <div className={`${mobileFullscreen ? 'px-2.5' : 'px-3'} py-2 border-b border-gray-100 bg-[#fafbff] flex gap-1.5 flex-wrap shrink-0`}>
          {SUBJECTS.map(s => (
            <button
              key={s}
              onClick={() => { setActiveSubject(s); setItems([]); setActiveIdx(0); }}
              style={{
                ...FF, fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 9px',
                transition: 'all .15s', cursor: 'pointer',
                background: activeSubject === s ? '#0d9488' : '#f0fdf4',
                color: activeSubject === s ? '#fff' : '#0d9488',
                border: `1px solid ${activeSubject === s ? '#0d9488' : '#99f6e4'}`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative" onMouseUp={captureSelection} onKeyUp={captureSelection}>
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-[#001161]/30">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span style={FF} className="text-[12px]">Načítám data...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 m-4 p-3 bg-red-50 rounded-[12px] border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span style={FF} className="text-[12px] text-red-700">{error}</span>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-[#001161]/25">
            <Layers className="w-8 h-8" />
            <span style={FF} className="text-[13px]">Žádné položky</span>
          </div>
        )}

        {/* Visual preview */}
        {!loading && !error && items.length > 0 && (
          <>
            {dataSource.type === 'subject-tabs' && (
              <SubjectTabsPreview items={items} onEditRequest={item => setEditingItem(item)} onOpenCollage={openCollageFor} />
            )}
            {dataSource.type === 'blog' && activeItem && (
              <BlogPreview item={activeItem} onEditRequest={item => setEditingItem(item)} onOpenCollage={openCollageFor} />
            )}
            {dataSource.type === 'slider' && items.length > 0 && (
              <SliderPreview items={items} activeIdx={activeIdx} onChangeIdx={setActiveIdx} onEditRequest={item => setEditingItem(item)} onOpenCollage={openCollageFor} />
            )}
            {dataSource.type === 'webinar' && activeItem && (
              <WebinarPreview item={activeItem} onEditRequest={item => setEditingItem(item)} />
            )}
            {dataSource.type === 'novinka' && activeItem && (
              <NovinkaPreview item={activeItem} onEditRequest={item => setEditingItem(item)} onOpenCollage={openCollageFor} />
            )}
            {dataSource.type === 'product' && activeItem && (
              <ProductPreview item={activeItem} onEditRequest={item => setEditingItem(item)} />
            )}
            {dataSource.type === 'email' && activeItem && (
              <EmailPreview
                blocks={parseBlocks([
                  activeItem.subject ? `Předmět: ${activeItem.subject}` : '',
                  activeItem.previewText ? `Preview text: ${activeItem.previewText}` : '',
                  activeItem.headline ? `# ${activeItem.headline}` : '',
                  activeItem.bodyHtml ? String(activeItem.bodyHtml).replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n') : '',
                  activeItem.ctaText ? `CTA text: ${activeItem.ctaText}` : '',
                  activeItem.ctaUrl ? `CTA URL: ${activeItem.ctaUrl}` : '',
                ].filter(Boolean).join('\n\n'))}
                onEditRequest={() => setEditingItem(activeItem)}
              />
            )}
          </>
        )}

        {/* Edit overlay */}
        <AnimatePresence>
          {editingItem && (
            <EditOverlay
              item={editingItem}
              fields={getEditFields(dataSource.type)}
              onSave={async (data) => {
                await saveItem(data);
                setEditingItem(null);
              }}
              onClose={() => setEditingItem(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Collage / image picker modal */}
      <CollageModal
        open={collageOpen}
        onClose={() => { setCollageOpen(false); setCollageTarget(null); }}
        onInsert={handleCollageInsert}
      />

      {/* Prompt bar */}
      <div
        className={`border-t border-gray-200 ${mobileFullscreen ? 'px-2.5' : 'px-3'} py-2.5 shrink-0 bg-[#fafbff]`}
        style={mobileFullscreen ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } : undefined}
      >
        {selectedSnippet && (
          <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-[#7C3AED]/20 bg-white px-3 py-2">
            <span style={{ ...FF, fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>Výběr</span>
            <span style={{ ...FF, fontSize: 11, color: '#001161', lineHeight: 1.4 }} className="truncate flex-1">
              {selectedSnippet}
            </span>
            <button
              onClick={() => {
                setPrompt('Přepiš označenou část.');
                promptRef.current?.focus();
              }}
              className="px-2 py-1 rounded-md bg-[#7C3AED] text-white text-[10px] font-bold cursor-pointer"
              style={FF}
            >
              Přepsat
            </button>
            <button onClick={() => setSelectedSnippet('')} className="text-[#001161]/30 hover:text-[#001161] cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
          <input
            ref={promptRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendPrompt(); }}
            placeholder={`Prompt k ${meta.label.toLowerCase()}...`}
            className="flex-1 bg-white rounded-[10px] border border-[#001161]/10 px-3 py-1.5 text-[12px] text-[#001161] placeholder-[#001161]/25 focus:outline-none focus:border-[#7C3AED]/40 transition-colors"
            style={FF}
          />
          <button
            onClick={sendPrompt}
            disabled={!prompt.trim()}
            className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-30 transition-all cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TEXT CANVAS — renders AI markdown as visual preview
   ══════════════════════════════════════════════════════════ */

function parseBlocks(text: string): any[] {
  const lines = text.split('\n');
  const blocks: any[] = [];
  let id = 0;
  const mk = (type: string, content: string, extra?: any) => ({ id: String(++id), type, content, ...extra });
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { blocks.push(mk('spacer', '')); continue; }
    if (trimmed === '---') { blocks.push(mk('divider', '')); continue; }
    if (trimmed.startsWith('# ')) { blocks.push(mk('h1', trimmed.slice(2))); continue; }
    if (trimmed.startsWith('## ')) { blocks.push(mk('h2', trimmed.slice(3))); continue; }
    if (trimmed.startsWith('### ')) { blocks.push(mk('h3', trimmed.slice(4))); continue; }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) { blocks.push(mk('list-item', trimmed.slice(2))); continue; }
    const fieldMatch = trimmed.match(/^(Předmět|Subject|Preview text|CTA text|CTA URL|Headline|Nadpis|Perex):\s*(.*)$/i);
    if (fieldMatch) { blocks.push(mk('email-field', fieldMatch[2], { fieldLabel: fieldMatch[1] })); continue; }
    blocks.push(mk('paragraph', trimmed));
  }
  while (blocks.length && blocks[0].type === 'spacer') blocks.shift();
  while (blocks.length && blocks[blocks.length - 1].type === 'spacer') blocks.pop();
  return blocks;
}

function blocksToText(blocks: any[]): string {
  return blocks.map(b => {
    if (b.type === 'h1') return `# ${b.content}`;
    if (b.type === 'h2') return `## ${b.content}`;
    if (b.type === 'h3') return `### ${b.content}`;
    if (b.type === 'list-item') return `- ${b.content}`;
    if (b.type === 'divider') return '---';
    if (b.type === 'email-field') return `${b.fieldLabel}: ${b.content}`;
    if (b.type === 'spacer') return '';
    return b.content;
  }).join('\n');
}

function TextCanvas({ content, title, type: typeProp, onClose, onSendToAgent, mobileFullscreen = false }: Omit<ContentCanvasProps, 'dataSource'>) {
  const type = typeProp || detectCanvasType(content);
  const isEmail = type === 'email';
  const [blocks, setBlocks] = useState<any[]>(() => parseBlocks(content));
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedSnippet, setSelectedSnippet] = useState('');
  const promptRef = useRef<HTMLInputElement>(null);
  const shellStyle = mobileFullscreen ? { width: '100%', height: '100%' } : { width: 700, height: '100%' };

  const copy = () => {
    navigator.clipboard.writeText(blocksToText(blocks));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const sendPrompt = () => {
    if (!prompt.trim()) return;
    const selectionPart = selectedSnippet ? `\n\nZaměř se pouze na tuto označenou část a přepiš jen ji:\n"""${selectedSnippet}"""` : '';
    onSendToAgent(`${prompt.trim()}\n\nAktuální obsah canvas:\n\n${blocksToText(blocks)}${selectionPart}`);
    setPrompt('');
    setSelectedSnippet('');
  };

  const captureSelection = () => {
    const sel = window.getSelection?.();
    const text = sel?.toString().trim() || '';
    setSelectedSnippet(text.length >= 3 ? text.slice(0, 600) : '');
  };

  // For email type — show email preview
  if (isEmail) {
    return (
      <div className={`flex flex-col bg-white ${mobileFullscreen ? 'w-full h-full' : 'border-l border-gray-200 shrink-0'}`} style={shellStyle}>
        <div className={`flex items-center gap-2 ${mobileFullscreen ? 'px-3' : 'px-4'} border-b border-gray-200 shrink-0`} style={{ height: 48 }}>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#ede9fe]">
            <Mail className="w-3 h-3 text-[#7C3AED]" />
            <span style={{ ...FF, fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</span>
          </div>
          <span style={FF} className="text-[12px] font-bold text-[#001161] truncate flex-1">{title || 'Email náhled'}</span>
          <button onClick={copy} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 cursor-pointer">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setBlocks(parseBlocks(content))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden" onMouseUp={captureSelection} onKeyUp={captureSelection}>
          <EmailPreview blocks={blocks} onEditRequest={() => {}} />
        </div>
        <div
          className={`border-t border-gray-200 ${mobileFullscreen ? 'px-2.5' : 'px-3'} py-2.5 shrink-0 bg-[#fafbff]`}
          style={mobileFullscreen ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } : undefined}
        >
          {selectedSnippet && (
            <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-[#7C3AED]/20 bg-white px-3 py-2">
              <span style={{ ...FF, fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>Výběr</span>
              <span style={{ ...FF, fontSize: 11, color: '#001161' }} className="truncate flex-1">{selectedSnippet}</span>
              <button onClick={() => { setPrompt('Přepiš označenou část.'); promptRef.current?.focus(); }} className="px-2 py-1 rounded-md bg-[#7C3AED] text-white text-[10px] font-bold cursor-pointer" style={FF}>Přepsat</button>
              <button onClick={() => setSelectedSnippet('')} className="text-[#001161]/30 hover:text-[#001161] cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <input
              ref={promptRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendPrompt(); }}
              placeholder="Uprav email... (změň tón, délku, CTA...)"
              className="flex-1 bg-white rounded-[10px] border border-[#001161]/10 px-3 py-1.5 text-[12px] text-[#001161] placeholder-[#001161]/25 focus:outline-none focus:border-[#7C3AED]/40"
              style={FF}
            />
            <button
              onClick={sendPrompt}
              disabled={!prompt.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-30 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Generic text canvas — rendered markdown
  const typeColors: Record<string, { bg: string; color: string; icon: any }> = {
    blog:    { bg: '#e8eaf8', color: '#001161', icon: FileText },
    social:  { bg: '#ede9fe', color: '#7C3AED', icon: Layers },
    webinar: { bg: '#e0f7fa', color: '#0891b2', icon: Radio },
    novinka: { bg: '#d1fae5', color: '#059669', icon: Newspaper },
    slider:  { bg: '#ffedd5', color: '#ea580c', icon: LayoutTemplate },
    generic: { bg: '#f3f4f6', color: '#374151', icon: FileText },
  };
  const tm = typeColors[type] || typeColors.generic;
  const TIcon = tm.icon;

  return (
    <div className={`flex flex-col bg-white ${mobileFullscreen ? 'w-full h-full' : 'border-l border-gray-200 shrink-0'}`} style={shellStyle}>
      {/* Header */}
      <div className={`flex items-center gap-2 ${mobileFullscreen ? 'px-3' : 'px-4'} border-b border-gray-100 shrink-0`} style={{ height: 48 }}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: tm.bg }}>
          <TIcon className="w-3 h-3" style={{ color: tm.color }} />
          <span style={{ ...FF, fontSize: 10, fontWeight: 800, color: tm.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{type}</span>
        </div>
        <span style={FF} className="text-[12px] font-bold text-[#001161] truncate flex-1">{title || 'Canvas'}</span>
        <button onClick={copy} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 cursor-pointer">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setBlocks(parseBlocks(content))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#001161]/30 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Rendered content */}
      <div className={`flex-1 overflow-y-auto ${mobileFullscreen ? 'px-4 py-4' : 'px-6 py-5'} space-y-2.5`} onMouseUp={captureSelection} onKeyUp={captureSelection}>
        {blocks.map(block => {
          if (block.type === 'spacer') return <div key={block.id} className="h-2" />;
          if (block.type === 'divider') return <hr key={block.id} className="border-[#001161]/8 my-2" />;
          if (block.type === 'h1') return (
            <h1 key={block.id} style={{ ...FF, fontSize: 26, fontWeight: 900, color: '#001161', lineHeight: 1.2, borderLeft: '3px solid #FF6B1A', paddingLeft: 12 }}>
              {block.content}
            </h1>
          );
          if (block.type === 'h2') return (
            <h2 key={block.id} style={{ ...FF, fontSize: 18, fontWeight: 800, color: '#001161', lineHeight: 1.3, borderLeft: '2px solid #7C3AED', paddingLeft: 10 }}>
              {block.content}
            </h2>
          );
          if (block.type === 'h3') return (
            <h3 key={block.id} style={{ ...FF, fontSize: 15, fontWeight: 700, color: 'rgba(0,17,97,0.8)', lineHeight: 1.4 }}>
              {block.content}
            </h3>
          );
          if (block.type === 'list-item') return (
            <div key={block.id} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A] mt-2 shrink-0" />
              <p style={{ ...FF, fontSize: 14, color: 'rgba(0,17,97,0.7)', lineHeight: 1.65 }}>{block.content}</p>
            </div>
          );
          if (block.type === 'email-field') return (
            <div key={block.id} className="flex items-start gap-2 bg-[#fafbff] rounded-lg px-3 py-2 border border-[#001161]/6">
              <span style={{ ...FF, fontSize: 9, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: 72, paddingTop: 2 }}>
                {block.fieldLabel}
              </span>
              <span style={{ ...FF, fontSize: 13, fontWeight: 600, color: '#001161' }}>{block.content}</span>
            </div>
          );
          return (
            <p key={block.id} style={{ ...FF, fontSize: 14, color: 'rgba(0,17,97,0.7)', lineHeight: 1.7 }}>{block.content}</p>
          );
        })}
      </div>

      {/* Prompt bar */}
      <div
        className={`border-t border-gray-200 ${mobileFullscreen ? 'px-2.5' : 'px-3'} py-2.5 shrink-0 bg-[#fafbff]`}
        style={mobileFullscreen ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } : undefined}
      >
        {selectedSnippet && (
          <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-[#7C3AED]/20 bg-white px-3 py-2">
            <span style={{ ...FF, fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>Výběr</span>
            <span style={{ ...FF, fontSize: 11, color: '#001161' }} className="truncate flex-1">{selectedSnippet}</span>
            <button onClick={() => { setPrompt('Přepiš označenou část.'); promptRef.current?.focus(); }} className="px-2 py-1 rounded-md bg-[#7C3AED] text-white text-[10px] font-bold cursor-pointer" style={FF}>Přepsat</button>
            <button onClick={() => setSelectedSnippet('')} className="text-[#001161]/30 hover:text-[#001161] cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
          <input
            ref={promptRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendPrompt(); }}
            placeholder="Uprav obsah... (zkrať, přepiš, změň styl...)"
            className="flex-1 bg-white rounded-[10px] border border-[#001161]/10 px-3 py-1.5 text-[12px] text-[#001161] placeholder-[#001161]/25 focus:outline-none focus:border-[#7C3AED]/40"
            style={FF}
          />
          <button
            onClick={sendPrompt}
            disabled={!prompt.trim()}
            className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-30 transition-all cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Default export ────────────────────────────────────── */
export default function ContentCanvas({ content, title, type, dataSource, mobileFullscreen = false, onClose, onSendToAgent }: ContentCanvasProps) {
  if (dataSource) {
    return <StructuredCanvas dataSource={dataSource} mobileFullscreen={mobileFullscreen} onClose={onClose} onSendToAgent={onSendToAgent} />;
  }
  return <TextCanvas content={content} title={title} type={type} mobileFullscreen={mobileFullscreen} onClose={onClose} onSendToAgent={onSendToAgent} />;
}