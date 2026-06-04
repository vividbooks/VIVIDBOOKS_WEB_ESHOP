import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import {
  Send, Loader2, Bot, User, Sparkles, Plus, Trash2,
  ChevronRight, ExternalLink, CheckCircle, Package,
  Image, FileText, Radio, Bell, Newspaper, Copy,
  RotateCcw, ChevronDown, ChevronUp, Mail,
  Brain, DatabaseZap, Trash, RefreshCw, ChevronLeft,
  Activity, AlertCircle, Wand2, Layers, Eye, ThumbsUp, ThumbsDown, Clock, Tag, User as UserIcon,
  Paperclip, X, ImageIcon, ZoomIn, GalleryHorizontal, PanelTop, Pencil,
  History, PanelLeftClose,
} from 'lucide-react';
import { AgentOrbAvatar } from '@/components/ui/AgentOrbAvatar';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useWebOperatorChatsBridge } from '../../contexts/WebOperatorChatsBridgeContext';
import { previewCtaUrl } from '../../utils/publicSiteUrl';
import CollageModal from './CollageModal';
import { fetchGenerateEmailWithRetry, getStoredEmailAiTier } from '../../utils/emailAiTier';
import ContentCanvas, { isCanvasWorthy, detectCanvasType, CanvasDataSource } from './ContentCanvas';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
/** Marketing → E-maily (stejný editor jako záložka v adminu) */
const MARKETING_EMAILS_PATH = '/marketing/emaily';
const EMAIL_IMPORT_HISTORY_MAX = 15;

/** Konverzace Web operátora → chatHistory pro Email builder (AI Email Agent). */
function agentMessagesToImportedEmailChatHistory(msgs: Msg[]): Array<{ id: string; role: 'user' | 'ai'; content: string; timestamp: string }> {
  const out: Array<{ id: string; role: 'user' | 'ai'; content: string; timestamp: string }> = [];
  for (const m of msgs) {
    if (m.loading) continue;
    const role: 'user' | 'ai' = m.role === 'user' ? 'user' : 'ai';
    let content = (m.content || '').trim();
    if (m.images?.length) {
      content = content
        ? `${content}\n\n[Přiloženo ${m.images.length} obr.]`
        : `[Přiloženo ${m.images.length} obr.]`;
    }
    if (!content) continue;
    if (content.length > 18_000) content = `${content.slice(0, 18_000)}\n\n…(zkráceno)`;
    out.push({
      id: m.id,
      role,
      content,
      timestamp: new Date(m.ts).toISOString(),
    });
  }
  const tail = out.slice(-EMAIL_IMPORT_HISTORY_MAX);
  if (tail.length === 0) return [];
  return [
    ...tail,
    {
      id: `email-import-${Date.now()}`,
      role: 'ai',
      content:
        '📧 **Pokračování z Web operátora** — výše je kontext chatu, ze kterého byl vygenerován tento email.',
      timestamp: new Date().toISOString(),
    },
  ];
}

type Role = 'user' | 'assistant';
interface Msg { id: string; role: Role; content: string; actions?: Action[]; loading?: boolean; ts: number; images?: string[]; }
interface BlogDraft {
  title: string; slug: string; author: string; category: string; tags: string;
  excerpt: string; readTime: number; coverImage: string;
  content: any[]; contentHtml: string; date: string;
}

function draftToCanvasContent(draft: BlogDraft): string {
  const body = (draft.contentHtml || '').replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n').trim();
  return [
    draft.title ? `# ${draft.title}` : '',
    draft.category ? `Kategorie: ${draft.category}` : '',
    draft.author ? `Autor: ${draft.author}` : '',
    draft.excerpt ? `Perex: ${draft.excerpt}` : '',
    draft.tags ? `Tagy: ${draft.tags}` : '',
    draft.readTime ? `Doba čtení: ${draft.readTime} min` : '',
    draft.coverImage ? `Cover image: ${draft.coverImage}` : '',
    body,
  ].filter(Boolean).join('\n\n');
}
interface Action {
  type: string; id?: string; name?: string; title?: string; text?: string;
  fields?: Record<string, any>; count?: number; reviewPath?: string;
  preview?: string; chunks?: number; source?: string; ragNote?: string; ragEmbedded?: boolean | number;
  imageUrl?: string; style?: string; sourceCount?: number;
  draft?: BlogDraft;
  // Slider / Tabs / Collage Builder
  imageUrls?: string[];
  imageCount?: number;
  tabCount?: number;
  tabs?: string[];
  note?: string;
  // Subject Tabs
  subject?: string;
  tabText?: string;
}

async function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '-9999px';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (!successful) throw new Error('Fallback copy failed');
  } finally {
    document.body.removeChild(textArea);
  }
}

const SOURCE_LABELS: Record<string, string> = {
  produkty: 'Produkty', blog: 'Blog', novinky: 'Novinky',
  webinare: 'Webináře', tabs: 'Tabs', mailchimp: 'Mailchimp',
};
const SOURCE_ORDER = ['produkty', 'blog', 'novinky', 'webinare', 'tabs', 'mailchimp'];
interface ChatIndex { id: string; title: string; updatedAt: string; messageCount: number; }

const ACTION_ICON: Record<string, any> = {
  update_product: Package,
  create_product: Package,
  bulk_update_products: Package,
  bulk_update_prices_percentage: Package,
  delete_product: Package,
  duplicate_product: Package,
  create_hero_slide: Image,
  update_hero_slide: Image,
  create_blog_post: FileText,
  update_blog_post: FileText,
  publish_blog_post: FileText,
  create_webinar: Radio,
  update_webinar: Radio,
  delete_webinar: Radio,
  create_notification: Bell,
  create_novinka: Newspaper,
  update_novinka: Newspaper,
  create_subject_page: FileText,
  update_subject_page: FileText,
  delete_subject_page: FileText,
  create_email_campaign_draft: Mail,
  delegate_seo_specialist: Brain,
  delegate_image_specialist: ImageIcon,
  rag_index_item: Brain,
  rag_index_source: DatabaseZap,
  rag_remove_item: Trash,
  generate_blog_image: Wand2,
  assign_image_to_product: ImageIcon,
  add_image_to_blog_post: ImageIcon,
  add_slider_to_blog_post: GalleryHorizontal,
  add_tabs_to_blog_post: PanelTop,
  create_subject_tab: Layers,
  update_subject_tab: Layers,
  delete_subject_tab: Layers,
  open_collage_builder: Layers,
};


const ACTION_LABEL: Record<string, string> = {
  update_product: 'Produkt aktualizován',
  create_product: 'Produkt vytvořen',
  bulk_update_products: 'Hromadná aktualizace produktů',
  bulk_update_prices_percentage: 'Hromadná změna cen',
  delete_product: 'Produkt smazán',
  duplicate_product: 'Produkt zduplikován',
  create_hero_slide: 'Hero slide vytvořen',
  update_hero_slide: 'Hero slide aktualizován',
  create_blog_post: 'Blog článek vytvořen (draft)',
  update_blog_post: 'Blog článek upraven',
  publish_blog_post: 'Blog článek publikován',
  create_webinar: 'Webinář vytvořen',
  update_webinar: 'Webinář upraven',
  delete_webinar: 'Webinář smazán',
  create_notification: 'Notifikace vytvořena',
  create_novinka: 'Novinka vytvořena',
  update_novinka: 'Novinka upravena',
  create_subject_page: 'Předmět vytvořen',
  update_subject_page: 'Předmět aktualizován',
  delete_subject_page: 'Předmět smazán',
  create_email_campaign_draft: '📧 Email draft uložen do Email Builderu',
  delegate_seo_specialist: 'SEO specialista připravil brief',
  delegate_image_specialist: 'Image specialista připravil handoff',
  rag_index_item: '🧠 Zaindexováno do RAG',
  rag_index_source: '🧠 Celý zdroj přeindexován v RAG',
  rag_remove_item: 'Odstraněno z RAG',
  generate_blog_image: '🎨 AI koláž vygenerována',
  blog_draft_preview: '📝 Návrh článku ke schválení',
  assign_image_to_product: '🖼️ Obrázek přiřazen k produktu',
  add_image_to_blog_post: '🖼️ Obrázek přidán do článku',
  add_slider_to_blog_post: '🎠 Slider přidán do článku',
  add_tabs_to_blog_post: '📑 Záložky přidány do článku',
  create_subject_tab: '📑 Tab vytvořen pro předmět',
  update_subject_tab: '📑 Tab předmětu aktualizován',
  delete_subject_tab: '🗑️ Tab předmětu smazán',
  open_collage_builder: '🎨 Klasická koláž — otevřít Builder',
};

const ACTION_COLOR: Record<string, string> = {
  create_email_campaign_draft: 'border-violet-200 bg-violet-50',
  create_product: 'border-blue-200 bg-blue-50',
  create_subject_page: 'border-indigo-200 bg-indigo-50',
  update_subject_page: 'border-indigo-200 bg-indigo-50',
  delete_subject_page: 'border-red-200 bg-red-50',
  delegate_seo_specialist: 'border-amber-200 bg-amber-50',
  delegate_image_specialist: 'border-fuchsia-200 bg-fuchsia-50',
  delete_product: 'border-red-200 bg-red-50',
  delete_webinar: 'border-red-200 bg-red-50',
  bulk_update_prices_percentage: 'border-amber-200 bg-amber-50',
  rag_index_item: 'border-cyan-200 bg-cyan-50',
  rag_index_source: 'border-cyan-200 bg-cyan-50',
  rag_remove_item: 'border-red-200 bg-red-50',
  generate_blog_image: 'border-fuchsia-200 bg-fuchsia-50',
  assign_image_to_product: 'border-blue-200 bg-blue-50',
  add_image_to_blog_post: 'border-emerald-200 bg-emerald-50',
  add_slider_to_blog_post: 'border-indigo-200 bg-indigo-50',
  add_tabs_to_blog_post: 'border-sky-200 bg-sky-50',
  create_subject_tab: 'border-teal-200 bg-teal-50',
  update_subject_tab: 'border-teal-200 bg-teal-50',
  delete_subject_tab: 'border-red-200 bg-red-50',
  open_collage_builder: 'border-orange-200 bg-orange-50',
};
const ACTION_TEXT_COLOR: Record<string, string> = {
  create_email_campaign_draft: 'text-violet-800',
  create_product: 'text-blue-800',
  create_subject_page: 'text-indigo-800',
  update_subject_page: 'text-indigo-800',
  delete_subject_page: 'text-red-800',
  delegate_seo_specialist: 'text-amber-800',
  delegate_image_specialist: 'text-fuchsia-800',
  delete_product: 'text-red-800',
  delete_webinar: 'text-red-800',
  bulk_update_prices_percentage: 'text-amber-800',
  rag_index_item: 'text-cyan-800',
  rag_index_source: 'text-cyan-800',
  rag_remove_item: 'text-red-800',
  generate_blog_image: 'text-fuchsia-800',
  assign_image_to_product: 'text-blue-800',
  add_image_to_blog_post: 'text-emerald-800',
  add_slider_to_blog_post: 'text-indigo-800',
  add_tabs_to_blog_post: 'text-sky-800',
  create_subject_tab: 'text-teal-800',
  update_subject_tab: 'text-teal-800',
  delete_subject_tab: 'text-red-800',
  open_collage_builder: 'text-orange-800',
};
const ACTION_ICON_COLOR: Record<string, string> = {
  create_email_campaign_draft: 'bg-violet-100 text-violet-700',
  create_product: 'bg-blue-100 text-blue-700',
  create_subject_page: 'bg-indigo-100 text-indigo-700',
  update_subject_page: 'bg-indigo-100 text-indigo-700',
  delete_subject_page: 'bg-red-100 text-red-700',
  delegate_seo_specialist: 'bg-amber-100 text-amber-700',
  delegate_image_specialist: 'bg-fuchsia-100 text-fuchsia-700',
  delete_product: 'bg-red-100 text-red-700',
  delete_webinar: 'bg-red-100 text-red-700',
  bulk_update_prices_percentage: 'bg-amber-100 text-amber-700',
  rag_index_item: 'bg-cyan-100 text-cyan-700',
  rag_index_source: 'bg-cyan-100 text-cyan-700',
  rag_remove_item: 'bg-red-100 text-red-700',
  generate_blog_image: 'bg-fuchsia-100 text-fuchsia-700',
  assign_image_to_product: 'bg-blue-100 text-blue-700',
  add_image_to_blog_post: 'bg-emerald-100 text-emerald-700',
  add_slider_to_blog_post: 'bg-indigo-100 text-indigo-700',
  add_tabs_to_blog_post: 'bg-sky-100 text-sky-700',
  create_subject_tab: 'bg-teal-100 text-teal-700',
  update_subject_tab: 'bg-teal-100 text-teal-700',
  delete_subject_tab: 'bg-red-100 text-red-700',
  open_collage_builder: 'bg-orange-100 text-orange-700',
};
const ACTION_BTN_COLOR: Record<string, string> = {
  create_email_campaign_draft: 'bg-violet-700 hover:bg-violet-800',
  create_product: 'bg-blue-700 hover:bg-blue-800',
  create_subject_page: 'bg-indigo-700 hover:bg-indigo-800',
  update_subject_page: 'bg-indigo-700 hover:bg-indigo-800',
  delete_subject_page: 'bg-red-700 hover:bg-red-800',
  delegate_seo_specialist: 'bg-amber-600 hover:bg-amber-700',
  delegate_image_specialist: 'bg-fuchsia-700 hover:bg-fuchsia-800',
  delete_product: 'bg-red-700 hover:bg-red-800',
  delete_webinar: 'bg-red-700 hover:bg-red-800',
  bulk_update_prices_percentage: 'bg-amber-700 hover:bg-amber-800',
  rag_index_item: 'bg-cyan-700 hover:bg-cyan-800',
  rag_index_source: 'bg-cyan-700 hover:bg-cyan-800',
  rag_remove_item: 'bg-red-700 hover:bg-red-800',
  generate_blog_image: 'bg-fuchsia-700 hover:bg-fuchsia-800',
  assign_image_to_product: 'bg-blue-700 hover:bg-blue-800',
  add_image_to_blog_post: 'bg-emerald-700 hover:bg-emerald-800',
  add_slider_to_blog_post: 'bg-indigo-700 hover:bg-indigo-800',
  add_tabs_to_blog_post: 'bg-sky-700 hover:bg-sky-800',
  create_subject_tab: 'bg-teal-700 hover:bg-teal-800',
  update_subject_tab: 'bg-teal-700 hover:bg-teal-800',
  delete_subject_tab: 'bg-red-700 hover:bg-red-800',
  open_collage_builder: 'bg-orange-600 hover:bg-orange-700',
};

const SUGGESTIONS = [
  { label: '📊 Shrň mi stav celého webu', icon: Sparkles },
  { label: '🧭 Napiš marketingový článek o písankách', icon: FileText },
  { label: '🔎 Připrav SEO brief pro landing page matematiky', icon: Brain },
  { label: '🖼️ Předej image specialistovi cover vizuál pro blog o fyzice', icon: Wand2 },
  { label: '📧 Napiš email kampaň pro nové produkty', icon: Mail },
];

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Snapshot konverzace Web operátora v asistentovi (hub) — přežije přepnutí záložky. */
const WEB_OPERATOR_HUB_SNAPSHOT_KEY = 'vividbooks_web_operator_hub_messages_v1';

function normalizeLoadedMessages(msgs: unknown): Msg[] {
  if (!Array.isArray(msgs)) return [];
  return msgs.map((m: any) => {
    const roleStr = String(m?.role ?? '').toLowerCase();
    const role: Role = roleStr === 'assistant' ? 'assistant' : 'user';
    const content = typeof m?.content === 'string' ? m.content : m?.content != null ? String(m.content) : '';
    return {
      id: String(m?.id ?? genId()),
      role,
      content,
      actions: Array.isArray(m?.actions) ? m.actions : undefined,
      loading: !!m?.loading,
      ts: typeof m?.ts === 'number' ? m.ts : Date.now(),
      images: Array.isArray(m?.images) ? m.images : undefined,
    };
  });
}

/* ══════════════════════════════════════════════════
   BLOG DRAFT PREVIEW CARD — schválení před uložením
   ══════════════════════════════════════════════════ */
function BlogDraftPreviewCard({ draft, onApprove, onReject, onOpenCanvas }: {
  draft: BlogDraft;
  onApprove: (savedId: string) => void;
  onReject: () => void;
  onOpenCanvas?: (content: string, title?: string) => void;
}) {
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const navigate = useNavigate();

  const wordCount = draft.contentHtml
    ? draft.contentHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    : 0;

  const approve = async () => {
    setCommitting(true);
    try {
      const res = await fetch(`${SERVER}/admin/commit-blog-draft`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({ draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCommitted(data.id);
      onApprove(data.id);
      toast.success(`✅ Článek "${draft.title}" byl uložen jako draft!`);
    } catch (err: any) {
      toast.error('Uložení selhalo', { description: err.message });
    } finally {
      setCommitting(false);
    }
  };

  const reject = () => {
    setRejected(true);
    onReject();
    toast('Návrh zamítnut. Můžete zadat nové pokyny.');
  };

  if (rejected) {
    return (
      <div className="mt-2 border border-red-200 bg-red-50 rounded-[14px] px-4 py-3 flex items-center gap-2">
        <ThumbsDown className="w-4 h-4 text-red-400 shrink-0" />
        <span style={FF} className="text-[13px] text-red-600">Návrh zamítnut — zadejte nové pokyny</span>
      </div>
    );
  }

  if (committed) {
    return (
      <div className="mt-2 border border-green-200 bg-green-50 rounded-[14px] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span style={FF} className="text-[13px] text-green-700 font-bold">Článek uložen jako draft</span>
        </div>
        <button
          onClick={() => navigate('/admin/blog')}
          className="flex items-center gap-1 text-[12px] text-green-700 hover:text-green-900 font-bold transition-colors cursor-pointer"
          style={FF}
        >
          Otevřít editor <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 border-2 border-violet-200 bg-white rounded-[16px] overflow-hidden shadow-[0_4px_20px_rgba(124,58,237,0.08)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 flex items-center gap-2">
        <Eye className="w-4 h-4 text-white shrink-0" />
        <span style={FF} className="text-[13px] font-bold text-white flex-1">Náhled článku ke schválení</span>
        <span style={FF} className="text-[11px] text-violet-200">Článek zatím NENÍ uložen</span>
      </div>

      {/* Cover image */}
      {draft.coverImage && (
        <div className="relative w-full" style={{ aspectRatio: '16/5', maxHeight: '180px' }}>
          <img src={draft.coverImage} alt={draft.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {draft.category && (
            <span style={FF} className="absolute bottom-3 left-4 text-[11px] font-bold text-white bg-violet-600 px-2.5 py-0.5 rounded-full">
              {draft.category}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Title */}
        <h3 style={FF} className="text-[17px] font-black text-[#001161] leading-tight">{draft.title}</h3>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3">
          {draft.author && (
            <div className="flex items-center gap-1">
              <UserIcon className="w-3 h-3 text-[#001161]/40" />
              <span style={FF} className="text-[11px] text-[#001161]/50">{draft.author}</span>
            </div>
          )}
          {draft.readTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#001161]/40" />
              <span style={FF} className="text-[11px] text-[#001161]/50">{draft.readTime} min čtení</span>
            </div>
          )}
          {wordCount > 0 && (
            <span style={FF} className="text-[11px] text-[#001161]/40">{wordCount} slov</span>
          )}
          {draft.tags && (
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#001161]/40" />
              <span style={FF} className="text-[11px] text-[#001161]/50">{draft.tags}</span>
            </div>
          )}
        </div>

        {/* Excerpt */}
        {draft.excerpt && (
          <p style={FF} className="text-[13px] text-[#001161]/70 leading-relaxed italic border-l-2 border-violet-300 pl-3">
            {draft.excerpt}
          </p>
        )}

        {/* Content preview */}
        <div className="border border-gray-100 rounded-[10px] overflow-hidden">
          <button
            onClick={() => setShowFullContent(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            style={FF}
          >
            <span className="text-[11px] font-bold text-[#001161]/60 uppercase tracking-wide">
              Obsah článku ({draft.content?.length || 0} bloků)
            </span>
            {showFullContent
              ? <ChevronUp className="w-3.5 h-3.5 text-[#001161]/40" />
              : <ChevronDown className="w-3.5 h-3.5 text-[#001161]/40" />
            }
          </button>
          {showFullContent && draft.contentHtml && (
            <div
              className="px-4 py-3 text-[13px] text-[#001161] leading-relaxed max-h-[300px] overflow-y-auto"
              style={{ ...FF, fontFamily: "'Fenomen Sans', sans-serif" }}
              dangerouslySetInnerHTML={{ __html: draft.contentHtml }}
            />
          )}
          {!showFullContent && draft.excerpt && (
            <p style={FF} className="px-3 py-2 text-[12px] text-[#001161]/50 italic">
              Klikněte pro zobrazení celého obsahu…
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onOpenCanvas?.(draftToCanvasContent(draft), draft.title)}
            disabled={committing}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-violet-200 text-violet-600 hover:bg-violet-50 rounded-[999px] text-[13px] font-bold transition-colors cursor-pointer"
            style={FF}
          >
            <Layers className="w-4 h-4" /> Canvas
          </button>
          <button
            onClick={approve}
            disabled={committing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7C3AED] hover:bg-violet-800 disabled:bg-violet-300 text-white rounded-[999px] text-[13px] font-bold transition-colors cursor-pointer shadow-sm"
            style={FF}
          >
            {committing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Ukládám…</>
              : <><ThumbsUp className="w-4 h-4" /> Schválit a vytvořit</>
            }
          </button>
          <button
            onClick={reject}
            disabled={committing}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-[999px] text-[13px] font-bold transition-colors cursor-pointer"
            style={FF}
          >
            <ThumbsDown className="w-4 h-4" /> Zamítnout
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action, navigate, onOpenCollageBuilder, onOpenCanvas, onSendPrompt }: { action: Action; navigate: (p: string) => void; onOpenCollageBuilder?: (urls: string[], style: string) => void; onOpenCanvas?: (source: CanvasDataSource) => void; onSendPrompt?: (prompt: string) => void }) {
  const Icon = ACTION_ICON[action.type] || CheckCircle;
  const label = ACTION_LABEL[action.type] || action.type;
  const [open, setOpen] = useState(false);
  const hiddenActionFields = new Set([
    'specialista', 'routeReason', 'vystup', 'brief', 'handoff',
    'savePrompt', 'targetSubject', 'targetField', 'batchSave', 'batchCount', 'saveTargets',
  ]);
  const changedFields = action.fields
    ? Object.entries(action.fields).filter(([key]) => !hiddenActionFields.has(key))
    : [];
  const isInternalSpecialist = action.type === 'delegate_seo_specialist' || action.type === 'delegate_image_specialist';

  const borderBg = ACTION_COLOR[action.type] || 'border-green-200 bg-green-50';
  const textColor = ACTION_TEXT_COLOR[action.type] || 'text-green-800';
  const subColor = textColor.replace('800', '600');
  const iconColor = ACTION_ICON_COLOR[action.type] || 'bg-green-100 text-green-700';
  const btnColor = ACTION_BTN_COLOR[action.type] || 'bg-green-700 hover:bg-green-800';
  const chevronColor = textColor.replace('text-', 'text-').replace('800', '600');

  // Určení subtitlu podle typu akce
  let subtitle = '';
  if ((action as any).percentage != null) {
    subtitle = `${(action as any).percentage > 0 ? '+' : ''}${(action as any).percentage}% · ${action.count ?? ''} produktů`;
  } else if (action.type === 'rag_index_item') {
    subtitle = `${SOURCE_LABELS[action.source || ''] || action.source} · ${action.chunks ?? 0} chunků`;
  } else if (action.type === 'rag_index_source') {
    subtitle = `${SOURCE_LABELS[action.source || ''] || action.source} · ${(action as any).ingested ?? 0} chunků`;
  } else if (action.type === 'rag_remove_item') {
    subtitle = `${SOURCE_LABELS[action.source || ''] || action.source}`;
  } else if (action.type === 'generate_blog_image') {
    subtitle = `${(action as any).style || 'ai-table'} · ${(action as any).sourceCount ?? 0} zdrojových obr.`;
  } else if (action.type === 'add_image_to_blog_post') {
    subtitle = `${action.title || ''} · pozice: ${(action as any).position || 'end'}`;
  } else if (action.type === 'add_slider_to_blog_post') {
    subtitle = `${action.title || ''} · ${action.imageCount ?? 0} obrázků`;
  } else if (action.type === 'add_tabs_to_blog_post') {
    const tabLabels = action.tabs?.slice(0, 3).join(', ') || '';
    subtitle = `${action.title || ''} · ${action.tabCount ?? (action.tabs?.length ?? 0)} záložek${tabLabels ? ': ' + tabLabels : ''}`;
  } else if (action.type === 'create_subject_tab' || action.type === 'update_subject_tab' || action.type === 'delete_subject_tab') {
    const sub = (action as any).subject || '';
    const tabTxt = (action as any).tabText || action.name || '';
    subtitle = `${sub}${sub && tabTxt ? ' · ' : ''}${tabTxt}`;
  } else if (action.type === 'open_collage_builder') {
    subtitle = `${(action.imageUrls?.length ?? 0)} obrázků · styl: ${action.style || 'grid'}`;
  } else if (action.type === 'delegate_seo_specialist') {
    subtitle = 'seo specialista';
  } else if (action.type === 'delegate_image_specialist') {
    subtitle = 'image specialista';
  } else {
    subtitle = (action as any).subject || action.name || action.title || action.text || (action.count ? `${action.count} položek` : '');
  }
  const generatedImageUrl = (action.type === 'generate_blog_image' || action.type === 'assign_image_to_product' || action.type === 'add_image_to_blog_post') ? (action as any).imageUrl : null;

  const hasPreview = action.type === 'rag_index_item' && action.preview;
  const hasRagNote = action.ragNote;
  const borderColor = borderBg.includes('violet') ? 'border-violet-200' : borderBg.includes('red') ? 'border-red-200' : borderBg.includes('amber') ? 'border-amber-200' : borderBg.includes('cyan') ? 'border-cyan-200' : borderBg.includes('fuchsia') ? 'border-fuchsia-200' : borderBg.includes('emerald') ? 'border-emerald-200' : borderBg.includes('indigo') ? 'border-indigo-200' : borderBg.includes('sky') ? 'border-sky-200' : borderBg.includes('orange') ? 'border-orange-200' : 'border-green-200';

  return (
    <div className={`mt-2 border rounded-[14px] overflow-hidden ${borderBg}`}>
      {/* Náhled vygenerovaného / přidaného obrázku — hned nahoře */}
      {generatedImageUrl && (
        <div className="px-3 pt-3 pb-1">
          <img
            src={generatedImageUrl}
            alt={action.type === 'add_image_to_blog_post' ? 'Přidaný obrázek' : 'AI koláž'}
            className={`w-full rounded-[10px] object-cover border ${action.type === 'add_image_to_blog_post' ? 'border-emerald-200' : 'border-fuchsia-200'}`}
            style={{ maxHeight: '160px' }}
          />
        </div>
      )}
      {/* Collage builder: thumbnail preview */}
      {action.type === 'open_collage_builder' && action.imageUrls && action.imageUrls.length > 0 && (
        <div className="px-3 pt-3 pb-1 flex gap-1.5 overflow-x-auto">
          {action.imageUrls.slice(0, 6).map((url, i) => (
            <img key={i} src={url} alt="" className="flex-shrink-0 w-12 h-16 rounded-[8px] object-cover border border-orange-200" />
          ))}
          {action.imageUrls.length > 6 && (
            <div className="flex-shrink-0 w-12 h-16 rounded-[8px] bg-orange-100 border border-orange-200 flex items-center justify-center">
              <span style={FF} className="text-[9px] font-bold text-orange-700">+{action.imageUrls.length - 6}</span>
            </div>
          )}
        </div>
      )}
      {/* Agent note for collage builder */}
      {action.type === 'open_collage_builder' && action.note && (
        <div className="px-3 pb-1">
          <p style={FF} className="text-[11px] text-orange-700/70 italic">{action.note}</p>
        </div>
      )}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p style={FF} className={`text-[13px] font-bold leading-tight ${textColor}`}>{label}</p>
          <p style={FF} className={`text-[11px] leading-tight truncate ${subColor}`}>{subtitle}</p>
          {/* ragNote badge — pro bulk updates */}
          {hasRagNote && (
            <span style={FF} className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-md">
              <Brain className="w-2.5 h-2.5" /> {action.ragNote}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(changedFields.length > 0 || hasPreview) && (
            <button onClick={() => setOpen(v => !v)} className={`p-1 rounded-lg transition-colors cursor-pointer hover:opacity-70`}>
              {open ? <ChevronUp className={`w-3.5 h-3.5 ${chevronColor}`} /> : <ChevronDown className={`w-3.5 h-3.5 ${chevronColor}`} />}
            </button>
          )}
          {/* Collage Builder open button */}
          {action.type === 'open_collage_builder' && onOpenCollageBuilder && (
            <button
              onClick={() => onOpenCollageBuilder(action.imageUrls || [], action.style || 'grid')}
              className={`flex items-center gap-1 px-2.5 py-1 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${btnColor}`}
              style={FF}
            >
              <Layers className="w-3 h-3" /> Otevřít Builder
            </button>
          )}
          {/* Canvas button — subject tabs */}
          {(action.type === 'create_subject_tab' || action.type === 'update_subject_tab') && onOpenCanvas && action.subject && (
            <button
              onClick={() => onOpenCanvas({ type: 'subject-tabs', subject: action.subject })}
              className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              style={FF}
            >
              <Pencil className="w-2.5 h-2.5" /> Ladit
            </button>
          )}
          {isInternalSpecialist && (
            <span
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/70 text-[#001161]/70"
              style={FF}
            >
              Ve stejném chatu
            </span>
          )}
          {/* Email draft — otevřít Marketing / E-maily (ne boční canvas) */}
          {action.type === 'create_email_campaign_draft' && action.id && (
            <button
              onClick={() => navigate(`${MARKETING_EMAILS_PATH}?draft=${encodeURIComponent(action.id!)}`)}
              className="flex items-center gap-1 px-2.5 py-1 bg-violet-700 hover:bg-violet-800 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              style={FF}
            >
              <Pencil className="w-2.5 h-2.5" /> Ladit
            </button>
          )}
          {/* Canvas button — product */}
          {(action.type === 'create_product' || action.type === 'update_product' || action.type === 'duplicate_product') && onOpenCanvas && action.id && (
            <button
              onClick={() => onOpenCanvas({ type: 'product', id: action.id })}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              style={FF}
            >
              <Pencil className="w-2.5 h-2.5" /> Ladit
            </button>
          )}
          {/* Canvas button — blog */}
          {(action.type === 'create_blog_post' || action.type === 'update_blog_post' || action.type === 'blog_draft_preview') && onOpenCanvas && (
            <button
              onClick={() => onOpenCanvas({ type: 'blog', id: action.id })}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#001161] hover:bg-[#000d4a] text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              style={FF}
            >
              <Pencil className="w-2.5 h-2.5" /> Ladit
            </button>
          )}
          {/* Canvas button — slider */}
          {(action.type === 'create_hero_slide' || action.type === 'update_hero_slide') && onOpenCanvas && (
            <button
              onClick={() => onOpenCanvas({ type: 'slider' })}
              className="flex items-center gap-1 px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              style={FF}
            >
              <Pencil className="w-2.5 h-2.5" /> Ladit
            </button>
          )}
          {/* Canvas button — webinar */}
          {(action.type === 'create_webinar' || action.type === 'update_webinar') && onOpenCanvas && (
            <button
              onClick={() => onOpenCanvas({ type: 'webinar', id: action.id })}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              style={FF}
            >
              <Pencil className="w-2.5 h-2.5" /> Ladit
            </button>
          )}
          {/* Canvas button — novinka */}
          {(action.type === 'create_novinka' || action.type === 'update_novinka') && onOpenCanvas && (
            <button
              onClick={() => onOpenCanvas({ type: 'novinka', id: action.id })}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              style={FF}
            >
              <Pencil className="w-2.5 h-2.5" /> Ladit
            </button>
          )}
          {action.reviewPath && action.type !== 'open_collage_builder' && !isInternalSpecialist && (
            <button
              onClick={() => {
                let path = action.reviewPath!;
                if (action.type === 'create_email_campaign_draft' && action.id) {
                  path = `${MARKETING_EMAILS_PATH}?draft=${encodeURIComponent(action.id)}`;
                }
                navigate(path);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${btnColor}`}
              style={FF}
            >
              Otevřít <ExternalLink className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* RAG Preview snippet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`overflow-hidden border-t ${borderColor}`}
          >
            <div className="px-3 py-2 flex flex-col gap-1.5">
              {hasPreview && (
                <div>
                  <p style={FF} className="text-[9px] font-bold uppercase tracking-wider text-cyan-600/70 mb-1">Indexovaný text (náhled)</p>
                  <p style={FF} className="text-[11px] text-cyan-800 leading-relaxed italic">
                    „{action.preview!.slice(0, 200)}{action.preview!.length > 200 ? '…' : ''}"
                  </p>
                </div>
              )}
              {changedFields.map(([k, v]) => (
                <div key={k} className="flex items-start gap-2">
                  <span style={FF} className={`text-[10px] font-bold uppercase tracking-wider min-w-[80px] ${subColor} opacity-70`}>{k}</span>
                  <span style={FF} className={`text-[11px] leading-tight flex-1 ${textColor}`}>{String(v).slice(0, 150)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({ msg, navigate, onApproveAction, onRejectAction, onOpenCollageBuilder, onOpenCanvas, onOpenStructuredCanvas, onSendPrompt, onMailchimpFromText, mailchimpBusy, mailchimpAllowed = true, hubTheme = false }: {
  msg: Msg;
  navigate: (p: string) => void;
  onApproveAction?: (actionIdx: number, savedId: string) => void;
  onRejectAction?: (actionIdx: number) => void;
  onOpenCollageBuilder?: (urls: string[], style: string) => void;
  onOpenCanvas?: (content: string, title?: string) => void;
  onOpenStructuredCanvas?: (source: CanvasDataSource) => void;
  onSendPrompt?: (prompt: string) => void;
  /** Celý text bubliny → Mailchimp generate-email jako prompt */
  onMailchimpFromText?: (assistantPlainText: string) => void;
  mailchimpBusy?: boolean;
  /** Alespoň jedna zpráva uživatele v chatu — neslibuj Mailchimp u úvodního welcome */
  mailchimpAllowed?: boolean;
  /** Web operátor (/asistent) — tmavý chat, bílý canvas zůstává */
  hubTheme?: boolean;
}) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const visibleActions = (msg.actions || []).filter(action => action.type !== 'delegate_marketing_specialist');

  const copy = async () => {
    try {
      await writeTextToClipboard(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err: any) {
      toast.error('Kopírování selhalo', { description: err?.message || 'Zkuste to prosím znovu.' });
    }
  };

  const bubbleMax = 'max-w-[min(92%,42rem)]';

  /** Stejný layout jako AgentTab — tmavé bubliny, modrá uživatel, orb + Kopírovat */
  if (hubTheme) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full min-w-0 shrink-0"
      >
        <div className={clsx('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
          {!isUser && <AgentOrbAvatar size="sm" />}
          <div
            className={clsx(
              'flex flex-col gap-1.5 min-w-0 max-w-[85%]',
              isUser ? 'items-end' : 'items-start',
            )}
          >
            <div
              className={clsx(
                'w-full rounded-2xl px-4 py-3 text-left break-words [overflow-wrap:anywhere]',
                isUser ? 'bg-[#0A84FF] text-white' : 'bg-[#1C1C1E] text-white',
              )}
            >
              {msg.loading ? (
                <div className="flex items-center gap-2 py-0.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[#8E8E93]" />
                  <span style={FF} className="text-[14px] text-[#8E8E93]">Agent přemýšlí…</span>
                </div>
              ) : (
                <>
                  {!isUser && mailchimpAllowed && onMailchimpFromText && msg.content.trim().length >= 40 && !/^\s*❌/.test(msg.content) && (
                    <div className="mb-3 pb-2 flex flex-wrap items-center gap-2 border-b border-white/10">
                      <button
                        type="button"
                        onClick={() => onMailchimpFromText(msg.content.trim())}
                        disabled={!!mailchimpBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#7C3AED] text-white text-[12px] font-bold hover:bg-[#6D28D9] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(124,58,237,0.2)]"
                        style={FF}
                        title="Pošle tento text do Mailchimp generátoru a otevře šablonu v canvasu"
                      >
                        {mailchimpBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Mailchimp
                      </button>
                      <span style={FF} className="text-[10px] text-[#8E8E93]">z textu níže → e-mail šablona</span>
                    </div>
                  )}
                  {msg.content && (
                    <div
                      style={{ ...FF, lineHeight: '1.6', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                      className={`whitespace-pre-wrap text-sm [&_code]:break-all [&_strong]:break-words [&_em]:break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:break-words [&_p]:break-words ${
                        isUser ? '[&_code]:!bg-white/15 [&_code]:!text-white' : ''
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(isUser ? escapeHtml(msg.content) : msg.content, !isUser),
                      }}
                    />
                  )}
                  {isUser && msg.images && msg.images.length > 0 && (
                    <div className={`flex flex-wrap gap-2 ${msg.content ? 'mt-2' : ''}`}>
                      {msg.images.map((url, i) => (
                        <ChatImage key={i} src={url} />
                      ))}
                    </div>
                  )}
                  {!isUser && (() => {
                    const imgs = extractImagesFromText(msg.content);
                    if (imgs.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {imgs.map((url, i) => (
                          <ChatImage key={i} src={url} />
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {visibleActions.length > 0 && (
              <div className={clsx('w-full min-w-0 flex flex-col gap-1', bubbleMax)}>
                {visibleActions.map((action, i) => (
                  action.type === 'blog_draft_preview' && action.draft
                    ? <BlogDraftPreviewCard
                        key={i}
                        draft={action.draft}
                        onApprove={(savedId) => onApproveAction?.(i, savedId)}
                        onReject={() => onRejectAction?.(i)}
                        onOpenCanvas={onOpenCanvas}
                      />
                    : <ActionCard key={i} action={action} navigate={navigate} onOpenCollageBuilder={onOpenCollageBuilder} onOpenCanvas={onOpenStructuredCanvas} onSendPrompt={onSendPrompt} />
                ))}
              </div>
            )}

            {!msg.loading && msg.content.trim() && (
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center justify-center gap-2 rounded-xl min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-[#2C2C2E] border border-white/15 hover:bg-[#3A3A3C] active:scale-[0.99] transition-colors"
                title="Kopírovat text zprávy"
              >
                {copied ? <CheckCircle className="w-[18px] h-[18px] text-emerald-400 shrink-0" /> : <Copy className="w-[18px] h-[18px] shrink-0 text-emerald-400" />}
                Kopírovat
              </button>
            )}

            <div className={clsx('flex flex-wrap items-center gap-2 px-0.5', isUser ? 'justify-end' : 'justify-start')}>
              <span style={FF} className="text-[10px] text-[#8E8E93]">
                {new Date(msg.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {!isUser && onOpenCanvas && isCanvasWorthy(msg.content) && (
                <button
                  type="button"
                  onClick={() => onOpenCanvas(msg.content)}
                  style={{ ...FF, fontSize: 10, fontWeight: 800 }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-all cursor-pointer"
                >
                  <Layers className="w-2.5 h-2.5" />
                  Canvas
                </button>
              )}
            </div>
          </div>

          {isUser && (
            <div className="w-8 h-8 rounded-full bg-[#3C3C3E] flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="group w-full min-w-0 shrink-0 isolate"
    >
      <div className={`flex w-full min-w-0 gap-3 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[13px] font-bold ${
            isUser ? 'bg-[#001161]' : 'bg-gradient-to-br from-[#7C3AED] to-[#5B4FD8]'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        <div className={`min-w-0 flex-1 flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
          <div
            className={`relative rounded-[16px] px-4 py-3 text-left break-words [overflow-wrap:anywhere] ${bubbleMax} ${
              isUser
                ? 'bg-[#001161] text-white rounded-tr-[4px]'
                : 'w-full bg-white border border-[#001161]/8 text-[#001161] rounded-tl-[4px] shadow-[0_2px_8px_rgba(0,17,97,0.06)]'
            }`}
          >
            {msg.loading ? (
              <div className="flex items-center gap-2 py-0.5">
                <Loader2 className="w-4 h-4 animate-spin opacity-60" />
                <span style={FF} className="text-[14px] opacity-60">Agent přemýšlí…</span>
              </div>
            ) : (
              <>
                {!isUser && mailchimpAllowed && onMailchimpFromText && msg.content.trim().length >= 40 && !/^\s*❌/.test(msg.content) && (
                  <div className="mb-3 pb-2 border-b border-[#001161]/10 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onMailchimpFromText(msg.content.trim())}
                      disabled={!!mailchimpBusy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#7C3AED] text-white text-[12px] font-bold hover:bg-[#6D28D9] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(124,58,237,0.2)]"
                      style={FF}
                      title="Pošle tento text do Mailchimp generátoru a otevře šablonu v canvasu"
                    >
                      {mailchimpBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Mailchimp
                    </button>
                    <span style={FF} className="text-[10px] text-[#001161]/40">z textu níže → e-mail šablona</span>
                  </div>
                )}
                {msg.content && (
                  <div
                    style={{ ...FF, lineHeight: '1.6', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    className={`whitespace-pre-wrap text-[15px] md:text-[14px] [&_code]:break-all [&_strong]:break-words [&_em]:break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:break-words [&_p]:break-words ${
                      isUser ? '[&_code]:!bg-white/15 [&_code]:!text-white' : ''
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: formatMarkdown(isUser ? escapeHtml(msg.content) : msg.content),
                    }}
                  />
                )}
                {isUser && msg.images && msg.images.length > 0 && (
                  <div className={`flex flex-wrap gap-2 ${msg.content ? 'mt-2' : ''}`}>
                    {msg.images.map((url, i) => (
                      <ChatImage key={i} src={url} />
                    ))}
                  </div>
                )}
                {!isUser && (() => {
                  const imgs = extractImagesFromText(msg.content);
                  if (imgs.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {imgs.map((url, i) => (
                        <ChatImage key={i} src={url} />
                      ))}
                    </div>
                  );
                })()}
              </>
            )}

            {!msg.loading && !isUser && (
              <button
                type="button"
                onClick={copy}
                className="absolute top-2 right-2 z-10 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 rounded cursor-pointer"
              >
                {copied ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-[#001161]/30" />}
              </button>
            )}
          </div>

          {visibleActions.length > 0 && (
            <div className={`w-full min-w-0 ${bubbleMax} flex flex-col gap-1`}>
              {visibleActions.map((action, i) => (
                action.type === 'blog_draft_preview' && action.draft
                  ? <BlogDraftPreviewCard
                      key={i}
                      draft={action.draft}
                      onApprove={(savedId) => onApproveAction?.(i, savedId)}
                      onReject={() => onRejectAction?.(i)}
                      onOpenCanvas={onOpenCanvas}
                    />
                  : <ActionCard key={i} action={action} navigate={navigate} onOpenCollageBuilder={onOpenCollageBuilder} onOpenCanvas={onOpenStructuredCanvas} onSendPrompt={onSendPrompt} />
              ))}
            </div>
          )}

          <div className={`flex flex-wrap items-center gap-2 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span style={FF} className="text-[10px] text-[#001161]/30">
              {new Date(msg.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && onOpenCanvas && isCanvasWorthy(msg.content) && (
              <button
                type="button"
                onClick={() => onOpenCanvas(msg.content)}
                style={{ ...FF, fontSize: 10, fontWeight: 800 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20 transition-all cursor-pointer"
              >
                <Layers className="w-2.5 h-2.5" />
                Canvas
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatMarkdown(text: string, darkAssistant = false): string {
  const codeStyle = darkAssistant
    ? 'background:#27272a;color:#e4e4e7;padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace'
    : 'background:#f0f2f8;padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, `<code style="${codeStyle}">$1</code>`)
    .replace(/^#{1,3} (.+)$/gm, '<strong style="font-size:15px">$1</strong>')
    .replace(/^[-*] (.+)$/gm, '• $1')
    .replace(/\n/g, '<br/>');
}

// Detect image URLs in assistant text (Supabase storage or direct image links)
const IMG_URL_RE = /https?:\/\/[^\s<>"]+?(?:\.(?:jpg|jpeg|png|webp|gif)|\/object\/sign\/[^\s<>"]+|\/render\/image\/[^\s<>"]+)(?:\?[^\s<>"]*)?/gi;

function extractImagesFromText(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(IMG_URL_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) matches.push(m[0]);
  return [...new Set(matches)];
}

/* Chat image — kliknutelný náhled s lightboxem */
function ChatImage({ src, className = '' }: { src: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`relative group cursor-zoom-in ${className}`} onClick={() => setOpen(true)}>
        <img
          src={src}
          alt="Obrázek"
          className="rounded-[10px] max-w-full object-cover border border-black/8"
          style={{ maxHeight: '280px', maxWidth: '100%' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-[10px] flex items-center justify-center">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
      </div>
      {open && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
            onClick={() => setOpen(false)}
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img src={src} alt="Náhled" className="max-w-[90vw] max-h-[90vh] rounded-[12px] shadow-2xl object-contain" />
        </div>
      )}
    </>
  );
}

/** Historie Web operátora — stejný vzor jako AgentTab (asistent) */
function WebOperatorHistoryPanel({
  chatIndex,
  currentChatId,
  indexLoading,
  chatLoading,
  loadChat,
  deleteChat,
  newChat,
  onMailClick,
  onCollapse,
}: {
  chatIndex: ChatIndex[];
  currentChatId: string;
  indexLoading: boolean;
  chatLoading: boolean;
  loadChat: (id: string) => void;
  deleteChat: (id: string, e: React.MouseEvent) => void;
  newChat: () => void;
  onMailClick: () => void;
  onCollapse: () => void;
}) {
  return (
    <>
      <div className="shrink-0 flex items-center justify-between gap-1 px-2 py-2 border-b border-white/10 bg-[#1C1C1E]">
        <h2 style={FF} className="text-white font-semibold text-xs truncate pr-1">
          Historie
        </h2>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onMailClick}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-purple-400 hover:bg-white/5"
            title="Marketing → E-maily"
          >
            <Mail size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Začít nový chat? Neuložená konverzace zůstane v seznamu.')) newChat();
            }}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-red-400 hover:bg-white/5"
            title="Nový chat"
          >
            <Trash2 size={18} />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/10"
            title="Sbalit historii"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
      </div>
      <div className="shrink-0 p-3 border-b border-white/10 bg-[#1C1C1E]">
        <button
          type="button"
          onClick={() => newChat()}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
          style={FF}
        >
          <Plus size={18} />
          Nový chat
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1 bg-[#1C1C1E]">
        {indexLoading && chatIndex.length === 0 ? (
          <p style={FF} className="text-[13px] text-[#8E8E93] px-2">
            Načítám…
          </p>
        ) : chatIndex.length === 0 ? (
          <p style={FF} className="text-[13px] text-[#8E8E93] px-2 leading-relaxed">
            Zatím žádné uložené konverzace. Po první odpovědi agenta se chat uloží automaticky — pak ho najdeš tady.
          </p>
        ) : (
          chatIndex.map(chat => (
            <div
              key={chat.id}
              className={clsx(
                'flex items-stretch gap-1 rounded-xl border transition-colors',
                chat.id === currentChatId
                  ? 'border-emerald-500/60 bg-[#2C2C2E]'
                  : 'border-white/5 bg-[#252528] hover:bg-[#2C2C2E]',
              )}
            >
              <button
                type="button"
                onClick={() => void loadChat(chat.id)}
                disabled={chatLoading}
                className="flex-1 min-w-0 text-left py-3 px-3 cursor-pointer disabled:opacity-50"
              >
                <p style={FF} className="text-white text-sm font-medium truncate">
                  {chat.title}
                </p>
                <p style={FF} className="text-[#AEAEB2] text-[11px] mt-0.5">
                  {new Date(chat.updatedAt).toLocaleString('cs-CZ', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {typeof chat.messageCount === 'number' ? ` · ${chat.messageCount} zpráv` : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={e => deleteChat(chat.id, e)}
                className="shrink-0 px-3 text-[#8E8E93] hover:text-red-400 hover:bg-black/20 rounded-r-xl"
                title="Smazat konverzaci"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-pro-preview',        label: 'Pro',  color: '#FF6B1A' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Lite', color: '#10b981' },
] as const;
type AgentModelId = typeof MODEL_OPTIONS[number]['id'];

export function AdminAgentPage({
  model: _ignored,
  hubMode = false,
  onOpenAgentSheet,
  queuedFromDictation,
  onQueuedFromDictationConsumed,
}: {
  model?: string;
  hubMode?: boolean;
  onOpenAgentSheet?: () => void;
  /** Předání z diktování (/asistent) — odešle se jako první uživatelská zpráva do plného Web operátora. */
  queuedFromDictation?: { text: string; nonce: string } | null;
  onQueuedFromDictationConsumed?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const agentBridgeEnabled = location.pathname === '/admin/agent';
  const bridge = useWebOperatorChatsBridge();
  const [model, setModel] = useState<AgentModelId>('gemini-3.1-flash-lite-preview');
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === 'undefined' || !hubMode) return [];
    try {
      const raw = sessionStorage.getItem(WEB_OPERATOR_HUB_SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return normalizeLoadedMessages(parsed);
      }
    } catch {
      /* ignore */
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [chatIndex, setChatIndex] = useState<ChatIndex[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(genId());
  const [chatLoading, setChatLoading] = useState(false);
  const [indexLoading, setIndexLoading] = useState(true);
  const [pendingImages, setPendingImages] = useState<{ url: string; name: string }[]>([]);
  const [hasComposerText, setHasComposerText] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Msg[]>([]);
  const currentChatIdRef = useRef(currentChatId);
  /** Stejně jako AgentTab: na md+ otevřená historie, na mobilu zavřená (více místa pro chat) */
  const [showHubHistoryPanel, setShowHubHistoryPanel] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /** Mailchimp z bubliny asistenta — busy stav pro tlačítko (builder UI je v ContentCanvas) */
  const [mcGenerating, setMcGenerating] = useState(false);
  const canvasDsRef = useRef<CanvasDataSource | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);
  // Canvas state
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [canvasTitle, setCanvasTitle] = useState('');
  const [canvasDataSource, setCanvasDataSource] = useState<CanvasDataSource | null>(null);
  const lastAutoCanvasKeyRef = useRef<string | null>(null);

  useEffect(() => {
    canvasDsRef.current = canvasDataSource;
  }, [canvasDataSource]);

  const scrollToCanvas = () => {
    setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ left: scrollAreaRef.current.scrollWidth, behavior: 'smooth' });
    }, 80);
  };
  const syncAdminShellScroll = () => {
    if (!scrollAreaRef.current) return;
    const shell = scrollAreaRef.current.closest('[data-admin-horizontal-shell="true"]') as HTMLElement | null;
    if (!shell) return;
    shell.scrollLeft = scrollAreaRef.current.scrollLeft;
  };
  const syncComposerUi = useCallback((el?: HTMLTextAreaElement | null) => {
    const textarea = el || inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    const nextHasText = !!textarea.value.trim();
    setHasComposerText(prev => (prev === nextHasText ? prev : nextHasText));
  }, []);
  const setComposerValue = useCallback((text: string, focus = false) => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.value = text;
    syncComposerUi(textarea);
    if (focus) {
      textarea.focus();
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  }, [syncComposerUi]);
  const clearComposer = useCallback(() => {
    setComposerValue('');
  }, [setComposerValue]);
  const openCanvas = (content: string, explicitTitle?: string) => {
    setCanvasDataSource(null);
    setCanvasContent(content);
    const firstLine = explicitTitle || content.split('\n').find(l => l.trim()) || 'Canvas';
    setCanvasTitle(firstLine.replace(/^#+\s*/, '').slice(0, 60));
    scrollToCanvas();
  };
  const openStructuredCanvas = (source: CanvasDataSource) => {
    setCanvasContent(null);
    setCanvasDataSource(source);
    scrollToCanvas();
  };
  const closeCanvas = () => { setCanvasContent(null); setCanvasDataSource(null); };

  const mailchimpConversationContext = () =>
    messages
      .filter(m => !m.loading)
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content.slice(0, 400)}`)
      .join('\n');

  const persistMcEmailToDraft = async (email: any) => {
    const ds = canvasDsRef.current;
    const id = ds?.type === 'email' && ds.id ? ds.id : crypto.randomUUID();
    const chatHistory = agentMessagesToImportedEmailChatHistory(messagesRef.current);
    const res = await fetch(`${SERVER}/admin/email-drafts`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({
        id,
        subject: email.subject,
        previewText: email.previewText || '',
        headline: email.headline || email.subject,
        bodyHtml: email.bodyHtml || '',
        ctaText: email.ctaText || 'Vyzkoušejte zdarma',
        ctaUrl: email.ctaUrl || previewCtaUrl(),
        audience: email.audience || 'newsletter',
        fullHtml: email.fullHtml,
        ...(chatHistory.length > 0 ? { chatHistory } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Uložení draftu selhalo');
    navigate(`${MARKETING_EMAILS_PATH}?draft=${encodeURIComponent(id)}`);
  };

  /** Text z bubliny asistenta → generate-email + draft + canvas */
  const generateMcEmail = async (textFromAssistant: string) => {
    const bubble = textFromAssistant.trim();
    if (!bubble) return;
    setMcGenerating(true);
    try {
      const prompt = `Z následujícího textu nebo osnovy (odpověď Web operátora) vytvoř kompletní marketingový e-mail Vividbooks: více vizuálních sekcí, hero, CTA, produkty pokud sedí, inline HTML v body. Zachovej fakta, češtinu a tón.\n\n---\n${bubble.slice(0, 14_000)}\n---`;
      const { response: genRes, data } = await fetchGenerateEmailWithRetry(
        `${SERVER}/admin/mailchimp/generate-email`,
        AUTH,
        {
          prompt,
          conversationContext: mailchimpConversationContext(),
          model: getStoredEmailAiTier(),
        },
        () => toast.info('Gemini přetížená — zkouším znovu…', { duration: 4500 }),
      );
      if (!genRes.ok || data.error) throw new Error(String(data.error || 'Generování selhalo'));
      const email = data.email;
      await persistMcEmailToDraft(email);
      toast.success('Email vygenerován — otevřen v sekci Marketing → E-maily');
    } catch (e: any) {
      toast.error(e.message || 'Chyba generování');
    } finally {
      setMcGenerating(false);
    }
  };

  useEffect(() => {
    const lastMsg = [...messages].reverse().find(m => m.role === 'assistant' && !m.loading && (m.actions?.length || 0));
    if (!lastMsg?.actions?.length) return;
    const lastAction = [...lastMsg.actions].reverse().find(action =>
      ['create_email_campaign_draft', 'create_subject_tab', 'update_subject_tab', 'create_hero_slide', 'update_hero_slide', 'create_product', 'update_product', 'duplicate_product', 'create_novinka', 'update_novinka'].includes(action.type)
    );
    if (!lastAction) return;

    if (lastAction.type === 'create_email_campaign_draft' && lastAction.id) {
      const key = `${lastAction.type}:${lastAction.id}`;
      if (lastAutoCanvasKeyRef.current === key) return;
      lastAutoCanvasKeyRef.current = key;
      navigate(`${MARKETING_EMAILS_PATH}?draft=${encodeURIComponent(lastAction.id)}`);
      return;
    }

    let ds: CanvasDataSource | null = null;
    if ((lastAction.type === 'create_subject_tab' || lastAction.type === 'update_subject_tab') && lastAction.subject) ds = { type: 'subject-tabs', subject: lastAction.subject };
    else if (lastAction.type === 'create_hero_slide' || lastAction.type === 'update_hero_slide') ds = { type: 'slider' };
    else if ((lastAction.type === 'create_product' || lastAction.type === 'update_product' || lastAction.type === 'duplicate_product') && lastAction.id) ds = { type: 'product', id: lastAction.id };
    else if ((lastAction.type === 'create_novinka' || lastAction.type === 'update_novinka') && lastAction.id) ds = { type: 'novinka', id: lastAction.id };
    if (!ds) return;

    const key = `${lastAction.type}:${lastAction.id || lastAction.subject || 'default'}`;
    if (lastAutoCanvasKeyRef.current === key) return;
    lastAutoCanvasKeyRef.current = key;
    openStructuredCanvas(ds);
  }, [messages]);

  useEffect(() => {
    const lastMsg = [...messages].reverse().find(m => m.role === 'assistant' && !m.loading && (m.actions?.length || 0));
    const draftAction = lastMsg?.actions?.find(action => action.type === 'blog_draft_preview' && action.draft);
    if (!draftAction?.draft) return;
    const key = `blog_draft_preview:${draftAction.draft.title}:${draftAction.draft.coverImage || ''}`;
    if (lastAutoCanvasKeyRef.current === key) return;
    lastAutoCanvasKeyRef.current = key;
    openCanvas(draftToCanvasContent(draftAction.draft), draftAction.draft.title);
  }, [messages]);

  // Koláž Builder state
  const [collageOpen, setCollageOpen] = useState(false);
  const [collagePreSelectUrls, setCollagePreSelectUrls] = useState<string[]>([]);
  const [collagePreSelectStyle, setCollagePreSelectStyle] = useState<'scattered' | 'grid' | 'fan'>('grid');

  const handleOpenCollageBuilder = (urls: string[], style: string) => {
    const validStyles = ['scattered', 'grid', 'fan'];
    setCollagePreSelectUrls(urls);
    setCollagePreSelectStyle((validStyles.includes(style) ? style : 'grid') as 'scattered' | 'grid' | 'fan');
    setCollageOpen(true);
  };

  // Welcome message (v hubu obnov stav ze sessionStorage, aby nepřišel o konverzaci při přepnutí záložky)
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: genId(),
          role: 'assistant',
          content:
            'Ahoj! Jsem váš **Web operátor** pro Vividbooks.\n\n📋 **Moje role**:\n• Číst a zapisovat produkty, předměty, blog, novinky, webináře a další obsah v CMS\n• Spravovat publikaci, notifikace a taby předmětů\n• **Delegovat** texty marketing specialistovi, SEO briefy SEO specialistovi a vizuály image specialistovi\n\nZkus: *„Uprav hero text u Matematiky 2"* nebo *„Uprav cenu u písanek o 10 %"*.\n\nCo pro vás mohu udělat? 👇',
          ts: Date.now(),
        },
      ];
    });
    loadChatIndex();
  }, []);

  useEffect(() => {
    if (!hubMode) return;
    try {
      sessionStorage.setItem(WEB_OPERATOR_HUB_SNAPSHOT_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [hubMode, messages]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [messages]);

  const loadChatIndex = async () => {
    setIndexLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/admin-agent-chats`, { headers: AUTH });
      if (res.ok) {
        const d = await res.json();
        setChatIndex(d.chats || []);
      } else {
        console.error('[AdminAgent] Index fetch failed:', res.status, await res.text().catch(() => ''));
      }
    } catch (e) {
      console.error('[AdminAgent] Index fetch error:', e);
    } finally {
      setIndexLoading(false);
    }
  };

  const saveChat = async (msgs: Msg[], id: string, acts: Action[]) => {
    const userMsgs = msgs.filter(m => m.role === 'user');
    const title = userMsgs[0]?.content?.slice(0, 60) || 'Nový úkol';
    try {
      const res = await fetch(`${SERVER}/admin/admin-agent-chats`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({ id, title, messages: msgs.filter(m => !m.loading), actions: acts }),
      });
      if (!res.ok) console.error('[AdminAgent] Save chat failed:', res.status);
      loadChatIndex();
    } catch (e) {
      console.error('[AdminAgent] Save chat error:', e);
    }
  };

  const loadChat = async (id: string) => {
    if (chatLoading) return;
    setChatLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/admin-agent-chats/${id}`, { headers: AUTH });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('[AdminAgent] Load chat failed:', res.status, txt);
        toast.error('Nepodařilo se načíst chat');
        return;
      }
      const { chat } = await res.json();
      lastAutoCanvasKeyRef.current = null;
      closeCanvas();
      setCurrentChatId(id);
      setMessages(normalizeLoadedMessages(chat.messages));
      clearComposer();
      setPendingImages([]);
    } catch (e) {
      console.error('[AdminAgent] Load chat error:', e);
      toast.error('Nepodařilo se načíst chat');
    } finally {
      setChatLoading(false);
    }
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${SERVER}/admin/admin-agent-chats/${id}`, { method: 'DELETE', headers: AUTH });
      setChatIndex(prev => prev.filter(c => c.id !== id));
      if (id === currentChatId) newChat();
      toast.success('Chat smazán');
    } catch { toast.error('Chyba při mazání'); }
  };

  const newChat = () => {
    lastAutoCanvasKeyRef.current = null;
    closeCanvas();
    setCurrentChatId(genId());
    setMessages([{
      id: genId(),
      role: 'assistant',
      content: 'Nový úkol — co pro vás mohu udělat?',
      ts: Date.now(),
    }]);
    clearComposer();
    setPendingImages([]);
  };

  const agentFnsRef = useRef({
    loadChat: async (_id: string) => {},
    newChat: () => {},
    deleteChat: async (_id: string, _e: React.MouseEvent) => {},
  });
  agentFnsRef.current = { loadChat, newChat, deleteChat };

  useEffect(() => {
    if (!agentBridgeEnabled) return;
    bridge.registerPage({
      loadChat: (id) => agentFnsRef.current.loadChat(id),
      newChat: () => agentFnsRef.current.newChat(),
      deleteChat: (id, e) => agentFnsRef.current.deleteChat(id, e),
    });
    return () => bridge.unregisterPage();
  }, [agentBridgeEnabled, bridge]);

  useEffect(() => {
    if (!agentBridgeEnabled) return;
    bridge.syncFromPage(chatIndex, currentChatId, indexLoading);
  }, [agentBridgeEnabled, bridge, chatIndex, currentChatId, indexLoading]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setUploading(true);
    const uploaded: { url: string; name: string }[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name} není obrázek`); continue; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} je příliš velký (max 10 MB)`); continue; }
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${SERVER}/admin/upload-image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        uploaded.push({ url: data.url, name: file.name });
        console.log(`[Upload] ${file.name} → ${data.url?.slice(0, 80)}`);
      } catch (err: any) {
        console.error('[Upload] Error:', err);
        toast.error(`Chyba nahrávání ${file.name}`, { description: err.message });
      }
    }
    if (uploaded.length) {
      setPendingImages(prev => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} obrázek${uploaded.length > 1 ? 'y' : ''} připraven${uploaded.length > 1 ? 'y' : ''}`);
    }
    setUploading(false);
  };

  const removePendingImage = (idx: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== idx));
  };

  const send = async (text?: string) => {
    const content = (text ?? inputRef.current?.value ?? '').trim();
    const hasImages = pendingImages.length > 0;
    if (!content && !hasImages) return;
    if (loading) return;
    const requestChatId = currentChatIdRef.current;
    const baseMessages = messagesRef.current;
    if (text == null) clearComposer();
    const imageUrls = pendingImages.map(p => p.url);
    setPendingImages([]);

    const userMsg: Msg = { id: genId(), role: 'user', content: content || '(obrázky)', ts: Date.now(), images: imageUrls.length ? imageUrls : undefined };
    const loadingMsg: Msg = { id: genId(), role: 'assistant', content: '', loading: true, ts: Date.now() };

    const nextMsgs = [...baseMessages, userMsg, loadingMsg];
    setMessages(nextMsgs);
    setLoading(true);

    // Build history for API (exclude loading + welcome), include images
    const history = nextMsgs
      .filter(m => !m.loading && (m.content || m.images?.length))
      .map(m => ({ role: m.role, content: m.content, images: m.images }));

    try {
      const res = await fetch(`${SERVER}/admin/admin-agent`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({ messages: history, model }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error(`HTTP ${res.status} — server timeout, zkuste kratší dotaz`); }
      if (!res.ok) {
        if (res.status === 546) {
          throw new Error(
            'Služba na okraji (Supabase) překročila limit CPU/paměti (HTTP 546, WORKER_LIMIT). U hromadných úprav produktů zkus znovu s jedním krokem: „nastav doložku přes bulk_update_products“ bez načítání celých popisů, nebo úkol rozděl (např. po ročnících).'
          );
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const assistantMsg: Msg = {
        id: genId(),
        role: 'assistant',
        content: data.reply || '(prázdná odpověď)',
        actions: data.actions || [],
        ts: Date.now(),
      };

      const finalMsgs = [...baseMessages, userMsg, assistantMsg];
      if (currentChatIdRef.current === requestChatId) setMessages(finalMsgs);

      // Save after response
      const allActions = finalMsgs.flatMap(m => m.actions || []);
      await saveChat(finalMsgs, requestChatId, allActions);
    } catch (err: any) {
      console.error('[AdminAgent] Error:', err);
      const errorMsg: Msg = { id: genId(), role: 'assistant', content: `❌ Chyba: ${err.message}`, ts: Date.now() };
      if (currentChatIdRef.current === requestChatId) setMessages(prev => [...prev.filter(m => !m.loading), errorMsg]);
      toast.error('Agent selhal', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const sendRef = useRef(send);
  sendRef.current = send;
  const onDictationConsumedRef = useRef(onQueuedFromDictationConsumed);
  onDictationConsumedRef.current = onQueuedFromDictationConsumed;
  const dictationQueueHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!queuedFromDictation?.text?.trim()) return;
    if (messages.length === 0) return;
    const nonce = queuedFromDictation.nonce;
    if (dictationQueueHandledRef.current === nonce) return;
    dictationQueueHandledRef.current = nonce;
    const t = queuedFromDictation.text.trim();
    const id = window.setTimeout(() => {
      void sendRef.current(t).finally(() => {
        onDictationConsumedRef.current?.();
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [queuedFromDictation?.nonce, queuedFromDictation?.text, messages.length]);

  const canSend = (hasComposerText || pendingImages.length > 0) && !loading;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const desktopCanvasOpen = !isMobile && !!(canvasContent || canvasDataSource);

  return (
    <>
    <div
      ref={scrollAreaRef}
      onScroll={syncAdminShellScroll}
      className={`h-full min-h-0 flex-1 min-w-0 w-full overflow-y-hidden relative ${
        hubMode ? 'bg-black' : 'bg-[#f7f8fc]'
      } ${desktopCanvasOpen ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
    >
      <div
        className={`flex h-full min-h-0 flex-nowrap ${
          desktopCanvasOpen ? 'w-max min-w-full' : 'w-full min-w-0'
        }`}
      >
        {/* Hub: historie — stejný vzor jako AgentTab (asistent) */}
        {hubMode && showHubHistoryPanel && (
          <aside className="flex flex-col min-h-0 w-full max-h-[min(42vh,320px)] shrink-0 border-b border-white/5 bg-[#1C1C1E] md:h-full md:max-h-none md:w-[260px] md:min-w-[260px] md:shrink-0 md:border-b-0 md:border-r md:border-white/5">
            <WebOperatorHistoryPanel
              chatIndex={chatIndex}
              currentChatId={currentChatId}
              indexLoading={indexLoading}
              chatLoading={chatLoading}
              loadChat={loadChat}
              deleteChat={deleteChat}
              newChat={newChat}
              onMailClick={() => navigate(MARKETING_EMAILS_PATH)}
              onCollapse={() => setShowHubHistoryPanel(false)}
            />
          </aside>
        )}
        {hubMode && !showHubHistoryPanel && (
          <button
            type="button"
            onClick={() => setShowHubHistoryPanel(true)}
            className="flex shrink-0 w-11 min-h-[44px] md:min-h-0 md:w-10 flex-col items-center justify-center gap-1 border-r border-white/5 bg-[#1C1C1E] text-[#8E8E93] hover:text-emerald-400 hover:bg-white/[0.06] active:bg-white/10 transition-colors"
            title="Zobrazit historii chatů"
          >
            <History size={20} />
          </button>
        )}

      {/* ── CHAT COLUMN — flex-1 + min-w-0 zabrání horizontálnímu „nafukování“ od dlouhých zpráv; s canvasem fixní 760px ── */}
      <div
        className={`flex flex-col h-full min-h-0 transition-[width] duration-300 ${
          hubMode
            ? `md:border-r border-white/5 ${desktopCanvasOpen ? 'w-[760px] max-w-[760px] shrink-0' : 'w-full min-w-0 flex-1 max-w-full'} bg-black`
            : `md:border-r border-gray-200 ${desktopCanvasOpen ? 'w-[760px] max-w-[760px] shrink-0' : 'w-full min-w-0 flex-1 max-w-full'}`
        }`}
      >

        {/* Header */}
        <div
          className={`h-12 flex items-center px-3 md:px-4 gap-2 md:gap-3 shrink-0 min-w-0 ${
            hubMode
              ? 'bg-[#1C1C1E] border-b border-white/10'
              : 'bg-white border-b border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hubMode ? (
              <AgentOrbAvatar size="sm" className="shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#5B4FD8] flex items-center justify-center shadow-sm shrink-0 ring-1 ring-white/10">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <p
                style={FF}
                className={`${isMobile ? 'text-[15px]' : 'text-[13px]'} font-bold leading-none ${hubMode ? 'text-zinc-100' : 'text-[#001161]'}`}
              >
                Web operátor
              </p>
              {/* Model switcher — inline PRO / LITE pills */}
              <div className="flex items-center gap-1 mt-0.5">
                {MODEL_OPTIONS.map(m => {
                  const active = model === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      title={m.id}
                      style={{
                        ...FF,
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: active ? m.color : hubMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,17,97,0.07)',
                        color: active ? '#fff' : hubMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,17,97,0.35)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        lineHeight: '16px',
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
                <span
                  style={{
                    ...FF,
                    fontSize: 9,
                    color: hubMode ? 'rgba(255,255,255,0.28)' : 'rgba(0,17,97,0.28)',
                    marginLeft: 2,
                  }}
                >
                  · orchestrace CMS
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => navigate(MARKETING_EMAILS_PATH)}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer shrink-0 ${
              hubMode ? 'text-violet-300 hover:bg-violet-500/15' : 'text-[#7C3AED] hover:bg-[#7C3AED]/10'
            }`}
            style={FF}
            title="Marketing → E-maily (editor šablon)"
          >
            <Mail className="w-3.5 h-3.5" />
            Mailchimp
          </button>
          <button
            type="button"
            onClick={() => navigate(MARKETING_EMAILS_PATH)}
            className={`md:hidden flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${
              hubMode
                ? 'border-violet-500/30 text-violet-300 bg-violet-500/10'
                : 'border-[#7C3AED]/25 text-[#7C3AED] bg-[#7C3AED]/6'
            }`}
            title="Marketing → E-maily"
          >
            <Mail className="w-4 h-4" />
          </button>

          {hubMode && onOpenAgentSheet && (
            <button
              onClick={onOpenAgentSheet}
              className={`md:hidden flex items-center justify-center w-9 h-9 rounded-full transition-colors cursor-pointer ${
                hubMode ? 'bg-white/10 hover:bg-white/15 text-zinc-100' : 'bg-[#001161]/6 hover:bg-[#001161]/10 text-[#001161]'
              }`}
              title="Agenti"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={newChat}
            className={`flex items-center justify-center gap-1.5 ${isMobile ? 'w-9 h-9 rounded-full px-0 py-0' : 'px-3 py-1.5 rounded-lg'} ${
              hubMode
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/30'
                : 'bg-[#001161] hover:bg-[#001161]/85'
            } text-white text-[12px] font-bold transition-colors cursor-pointer`}
            style={FF}
            title="Nový chat"
          >
            <Plus className="w-3.5 h-3.5" /> {!isMobile && 'Nový'}
          </button>
        </div>

        {/* Messages */}
        <div
          ref={messagesScrollRef}
          className={`flex-1 min-h-0 min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-contain flex flex-col gap-4 ${
            hubMode ? 'bg-black p-4 md:p-6' : 'px-3 md:px-4 py-4 md:py-5'
          }`}
        >
          {messages.map((msg, msgIdx) => (
            <MessageBubble
              key={msg.id}
              hubTheme={hubMode}
              msg={msg}
              navigate={navigate}
              onOpenCollageBuilder={handleOpenCollageBuilder}
              onOpenCanvas={openCanvas}
              onOpenStructuredCanvas={openStructuredCanvas}
              onSendPrompt={send}
              onMailchimpFromText={(t) => void generateMcEmail(t)}
              mailchimpBusy={mcGenerating}
              mailchimpAllowed={messages.slice(0, msgIdx).some(m => m.role === 'user')}
              onApproveAction={(actionIdx, savedId) => {
                // Přidej potvrzovací zprávu do chatu
                const confirmMsg: Msg = {
                  id: genId(),
                  role: 'assistant',
                  content: `✅ Výborně! Článek byl uložen jako draft. Najdete ho v Blog editoru → /admin/blog.`,
                  ts: Date.now(),
                };
                setMessages(prev => [...prev, confirmMsg]);
              }}
              onRejectAction={(actionIdx) => {
                const rejectMsg: Msg = {
                  id: genId(),
                  role: 'assistant',
                  content: '↩️ Návrh zamítnut. Napište mi, co chcete změnit — upravím obsah, styl, délku nebo obrázek.',
                  ts: Date.now(),
                };
                setMessages(prev => [...prev, rejectMsg]);
              }}
            />
          ))}

          {/* Suggestions — show only when 1 message (welcome) */}
          {messages.length === 1 && (
            <div className="flex flex-col gap-2 mt-2 w-full min-w-0 max-w-full">
              <p
                style={FF}
                className={`${isMobile ? 'text-[12px]' : 'text-[11px]'} uppercase tracking-wider font-bold px-1 ${
                  hubMode ? 'text-[#8E8E93]' : 'text-[#001161]/40'
                }`}
              >
                Návrhy úkolů
              </p>
              <div
                className={
                  hubMode
                    ? 'flex flex-wrap gap-2 w-full min-w-0'
                    : 'grid grid-cols-1 sm:grid-cols-2 gap-2 w-full min-w-0 max-w-full'
                }
              >
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => send(s.label)}
                    className={
                      hubMode
                        ? 'px-3 py-2 bg-[#1C1C1E] text-[#8E8E93] rounded-lg text-sm hover:bg-[#2C2C2E] hover:text-white transition-colors text-left max-w-full'
                        : 'flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-left transition-all cursor-pointer group bg-white border border-[#001161]/10 hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/4'
                    }
                  >
                    {hubMode ? (
                      <span style={FF} className="break-words">
                        {s.label}
                      </span>
                    ) : (
                      <>
                        <s.icon className="w-4 h-4 shrink-0 text-[#7C3AED]/70" />
                        <span style={FF} className={`${isMobile ? 'text-[14px]' : 'text-[13px]'} leading-tight min-w-0 break-words text-[#001161]/70 group-hover:text-[#001161]`}>
                          {s.label}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 text-[#001161]/20" />
                      </>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Input bar */}
        <div
          className={`shrink-0 border-t ${
            hubMode ? 'border-white/10 bg-black p-4' : 'border-gray-200 bg-white p-3'
          }`}
          style={{ paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : undefined }}
        >
          {/* Pending images preview */}
          <AnimatePresence>
            {pendingImages.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-2"
              >
                <div className="flex flex-wrap gap-2 px-1 pb-1">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-16 h-16 object-cover rounded-[8px] border border-[#7C3AED]/30"
                      />
                      <button
                        onClick={() => removePendingImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-500 rounded-full flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-[8px] px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p style={FF} className="text-[8px] text-white truncate">{img.name}</p>
                      </div>
                    </div>
                  ))}
                  <div
                    style={FF}
                    className={`text-[10px] self-end pb-1 font-bold ${hubMode ? 'text-violet-400' : 'text-[#7C3AED]'}`}
                  >
                    {pendingImages.length} obrázek{pendingImages.length > 1 ? 'y' : ''} připraven{pendingImages.length > 1 ? 'y' : ''}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={hubMode ? 'flex items-end gap-3' : 'flex items-end gap-2 rounded-[16px] border border-[#001161]/10 bg-[#f7f8fc] focus-within:border-[#7C3AED]/40 transition-colors px-3 py-2'}>
            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploading}
              title="Nahrát obrázek"
              className={
                hubMode
                  ? clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0',
                      uploading
                        ? 'bg-[#2C2C2E] text-[#8E8E93] animate-pulse'
                        : 'bg-[#1C1C1E] text-[#0A84FF] hover:bg-[#2C2C2E]',
                    )
                  : 'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer mb-0.5 hover:bg-[#7C3AED]/10 text-[#001161]/40 hover:text-[#7C3AED]'
              }
            >
              {uploading ? (
                <Loader2 className={hubMode ? 'w-5 h-5 animate-spin text-[#0A84FF]' : 'w-4 h-4 animate-spin text-[#7C3AED]'} />
              ) : (
                <Paperclip className={hubMode ? 'w-5 h-5' : 'w-4 h-4'} />
              )}
            </button>

            <div className={hubMode ? 'flex-1 relative' : 'flex-1'}>
              <textarea
                ref={inputRef}
                onChange={e => syncComposerUi(e.currentTarget)}
                onKeyDown={handleKey}
                placeholder={
                  pendingImages.length
                    ? 'Co chcete s obrázkem/y udělat? (Enter = odeslat)'
                    : hubMode
                      ? 'Např: Jedu do Sedlčan, jaké školy jsou po cestě?'
                      : 'Zadejte úkol pro agenta… (Enter = odeslat, Shift+Enter = nový řádek)'
                }
                rows={1}
                style={{ ...FF, fontSize: isMobile ? '16px' : '14px', resize: 'none', minHeight: hubMode ? '48px' : isMobile ? '42px' : '36px', maxHeight: '120px' }}
                className={
                  hubMode
                    ? 'w-full bg-[#1C1C1E] text-white rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50 placeholder-[#8E8E93] text-sm'
                    : 'flex-1 bg-transparent outline-none text-[#001161] placeholder:text-[#001161]/35 leading-relaxed overflow-auto w-full'
                }
                onInput={e => syncComposerUi(e.currentTarget)}
                disabled={loading}
              />
            </div>

            <button
              onClick={() => send()}
              disabled={!canSend}
              className={
                hubMode
                  ? clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0',
                      canSend
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                        : 'bg-[#2C2C2E] text-[#8E8E93]',
                    )
                  : 'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ' +
                    (canSend
                      ? 'bg-gradient-to-br from-[#7C3AED] to-[#5B4FD8] hover:opacity-90 shadow-[0_2px_8px_rgba(124,58,237,0.3)]'
                      : 'bg-gray-200')
              }
            >
              {loading ? (
                <Loader2 className={hubMode ? 'w-5 h-5 text-white animate-spin' : 'w-4 h-4 text-white animate-spin'} />
              ) : (
                <Send className={hubMode ? 'w-5 h-5 text-white' : 'w-4 h-4 text-white'} />
              )}
            </button>
          </div>

          <p
            style={FF}
            className={`hidden md:block text-[10px] text-center mt-2 ${hubMode ? 'text-[#8E8E93]' : 'text-[#001161]/30'}`}
          >
            Agent může přímo zapisovat do CMS. Vždy zkontrolujte provedené změny. · 📎 nahraj obrázek a přidej ho k produktu nebo do AI koláže
          </p>
        </div>
      </div>{/* end chat column */}

      {/* ── CANVAS PANELS — desktop: inline right, mobile: full-screen overlay ── */}
      {isMobile ? (
        <AnimatePresence>
          {(canvasContent || canvasDataSource) && (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
              <ContentCanvas
                key={canvasDataSource ? `ds-${canvasDataSource.type}-${canvasDataSource.subject || ''}` : canvasContent?.slice(0, 40)}
                content={canvasContent || ''}
                title={canvasTitle}
                type={canvasContent ? detectCanvasType(canvasContent) : undefined}
                dataSource={canvasDataSource || undefined}
                mobileFullscreen
                onClose={closeCanvas}
                onSendToAgent={(prompt) => {
                  setComposerValue(prompt, true);
                  closeCanvas();
                }}
              />
            </div>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>
          {(canvasContent || canvasDataSource) && (
            <ContentCanvas
              key={canvasDataSource ? `ds-${canvasDataSource.type}-${canvasDataSource.subject || ''}` : canvasContent?.slice(0, 40)}
              content={canvasContent || ''}
              title={canvasTitle}
              type={canvasContent ? detectCanvasType(canvasContent) : undefined}
              dataSource={canvasDataSource || undefined}
              onClose={closeCanvas}
              onSendToAgent={(prompt) => {
                setComposerValue(prompt, true);
              }}
            />
          )}
        </AnimatePresence>
      )}

      </div>
    </div>{/* end scroll port + inner row */}

      {/* Koláž Builder Modal — outside scroll area, fixed overlay */}
      <CollageModal
        open={collageOpen}
        onClose={() => setCollageOpen(false)}
        onInsert={(url) => {
          setCollageOpen(false);
          const insertMsg: Msg = {
            id: genId(),
            role: 'assistant',
            content: `✅ **Koláž připravena!** URL obrázku:\n\`${url}\`\n\nChcete ji vložit jako cover článku, přidat do obsahu článku, nebo použít jinak?`,
            ts: Date.now(),
          };
          setMessages(prev => [...prev, insertMsg]);
          toast.success('✅ Koláž vygenerována a URL zkopírována do chatu!');
        }}
        preSelectUrls={collagePreSelectUrls}
        preSelectStyle={collagePreSelectStyle}
      />

    </>
  );
}