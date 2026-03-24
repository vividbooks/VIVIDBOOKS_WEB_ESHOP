import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, Plus, Trash2, Save, Send, Loader2,
  Copy, Check, ExternalLink, FileText, X,
  Sparkles, Users, Link2, Brain,
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen,
  ArrowUp, Settings2, Eye, MousePointerClick, TextCursor,
  ZoomIn, Download, Layers, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import CollageModal from './CollageModal';
import { autoGenerateCollage } from './collageUtils';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

/* ── Types ───────────────────────────────────────────── */
interface EmailDraft {
  id: string;
  subject: string;
  previewText: string;
  headline: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  audience: 'newsletter' | 'no-newsletter';
  fullHtml?: string;
  status: 'draft' | 'pushed' | 'sent';
  mailchimpCampaignId?: string;
  mailchimpUrl?: string;
  createdAt: string;
  updatedAt: string;
  chatHistory?: ChatMsg[];
}

interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  content: string;
  ragDebug?: RagDebug | null;
  timestamp: string;
}

interface RagDebug {
  indexSize: number;
  chunksUsed: number;
  topScore: number;
  sources: string[];
  productCount?: number;
  webinarCount?: number;
  productImagesCount?: number;
}

const EMPTY_DRAFT: Omit<EmailDraft, 'id' | 'createdAt' | 'updatedAt'> = {
  subject: '', previewText: '', headline: '', bodyHtml: '',
  ctaText: 'Vyzkoušejte zdarma', ctaUrl: 'https://www.vividbooks.com/vyzkousejte',
  audience: 'newsletter', status: 'draft',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ── Markdown image → HTML img preprocessor ──────────── */
function preprocessHtml(html: string): string {
  if (!html) return html;
  let result = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, url) => `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`
  );
  result = result.replace(/!\[([^\]]*)\](?!\()/g, '');
  return result;
}

/* ── Copy button ──────────────────────────────────────── */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-gray-200 text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 transition-all cursor-pointer" style={F}>
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Zkopírováno' : 'Kopírovat'}
    </button>
  );
}

/* ── RAG Badge ───────────────────────────────────────── */
function RagBadges({ info }: { info: RagDebug }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
        (info.productCount ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'
      }`} style={F}>
        {(info.productCount ?? 0) > 0 ? '✓' : '✗'} Produkty: {info.productCount ?? 0}
      </span>
      {(info.webinarCount ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700" style={F}>
          Webináře: {info.webinarCount}
        </span>
      )}
      {(info.productImagesCount ?? 0) > 0 && (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700`} style={F}>
          Obrázky: {info.productImagesCount}
        </span>
      )}
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
        info.chunksUsed > 0 ? 'bg-emerald-50 text-emerald-700'
          : info.indexSize > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-500'
      }`} style={F}>
        {info.chunksUsed > 0 ? '⚡' : '○'} RAG: {info.chunksUsed > 0
          ? `${info.chunksUsed} chunků (${info.topScore}%)`
          : info.indexSize > 0 ? `0/${info.indexSize}` : 'prázdný'}
      </span>
      {info.sources.map(s => (
        <span key={s} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#7C3AED]/8 text-[#7C3AED]" style={F}>{s}</span>
      ))}
    </div>
  );
}

/* ── Editable inline field ───────────────────────────── */
function EditableField({ value, onChange, placeholder, className, multiline, tag }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  className?: string; multiline?: boolean; tag?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => { setTmp(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    const shared = `w-full bg-white border border-[#7C3AED]/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 ${className || ''}`;
    const save = () => { onChange(tmp); setEditing(false); };
    const cancel = () => { setTmp(value); setEditing(false); };
    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !multiline) { e.preventDefault(); save(); }
      if (e.key === 'Escape') cancel();
    };
    return multiline ? (
      <div className="relative">
        <textarea ref={ref as any} value={tmp} onChange={e => setTmp(e.target.value)}
          onKeyDown={onKey} onBlur={save} className={shared} rows={6} style={F} />
      </div>
    ) : (
      <input ref={ref as any} value={tmp} onChange={e => setTmp(e.target.value)}
        onKeyDown={onKey} onBlur={save} className={shared} style={F} />
    );
  }

  return (
    <div onClick={() => setEditing(true)}
      className={`group cursor-text rounded-lg px-1 -mx-1 transition-all hover:bg-[#7C3AED]/5 hover:ring-1 hover:ring-[#7C3AED]/20 relative ${className || ''}`}>
      {tag && (
        <span className="absolute -top-2.5 left-2 text-[8px] font-bold uppercase tracking-wider text-[#7C3AED]/0 group-hover:text-[#7C3AED]/50 transition-all px-1 bg-white rounded" style={F}>
          {tag}
        </span>
      )}
      {value ? (
        multiline ? (
          <div style={F} dangerouslySetInnerHTML={{ __html: preprocessHtml(value) }}
            className="text-[14px] text-[#333] leading-relaxed [&_p]:mb-2.5 [&_strong]:font-bold [&_ul]:ml-4 [&_ul]:list-disc [&_li]:mb-1 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-[#001161] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-[14px] [&_h3]:font-bold [&_h3]:text-[#001161] [&_h3]:mt-2 [&_h3]:mb-1 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3" />
        ) : null
      ) : (
        <span className="text-[#001161]/20 italic" style={F}>{placeholder}</span>
      )}
      {!multiline && value && <span style={F}>{value}</span>}
      <MousePointerClick className="w-3 h-3 text-[#7C3AED]/0 group-hover:text-[#7C3AED]/40 absolute top-1 right-1 transition-all" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════ */
export default function EmailBuilder() {
  /* Drafts */
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [selected, setSelected] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* Chat */
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  /* Canvas */
  const [showSettings, setShowSettings] = useState(false);
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  /* Image lightbox */
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  /* Collage modal */
  const [collageOpen, setCollageOpen] = useState(false);
  const [editingImgSrc, setEditingImgSrc] = useState<string | null>(null);

  /* Canvas text selection */
  const [selectedCanvasText, setSelectedCanvasText] = useState<string>('');
  const [selectionTooltipPos, setSelectionTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [capturedSelection, setCapturedSelection] = useState<string | null>(null);

  /* Load */
  useEffect(() => { loadDrafts(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  /* ── Canvas text selection detection ─────────────── */
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
        if (!canvasRef.current) return;
        try {
          const range = sel.getRangeAt(0);
          if (canvasRef.current.contains(range.commonAncestorContainer)) {
            const text = sel.toString().trim();
            setSelectedCanvasText(text);
            const rect = range.getBoundingClientRect();
            setSelectionTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
          }
        } catch { /* ignore edge cases */ }
      }, 20);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxSrc) { setLightboxSrc(null); return; }
        setSelectedCanvasText('');
        setSelectionTooltipPos(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxSrc]);

  /* ── Data functions ──────────────────────────────── */
  const loadDrafts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${SERVER}/admin/email-drafts`, { headers: AUTH_H });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      const loaded = (data.drafts || []).sort((a: EmailDraft, b: EmailDraft) =>
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
      setDrafts(loaded);
      if (!selected && loaded.length > 0) {
        selectDraft(loaded[0]);
      }
    } catch (e: any) {
      console.error('Load drafts error:', e);
      toast.error(`Chyba při načítání: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectDraft = (d: EmailDraft) => {
    setSelected(d);
    setChatMsgs(d.chatHistory || []);
    setShowSettings(false);
    setShowHtmlSource(false);
  };

  const saveDraft = async (draft?: EmailDraft) => {
    const d = draft || selected;
    if (!d) return;
    setSaving(true);
    try {
      const toSave = { ...d, chatHistory: chatMsgs, updatedAt: new Date().toISOString() };
      const r = await fetch(`${SERVER}/admin/email-drafts`, {
        method: 'POST', headers: AUTH_H, body: JSON.stringify(toSave),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setDrafts(prev => {
        const idx = prev.findIndex(x => x.id === d.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = toSave; return n; }
        return [toSave, ...prev];
      });
      setSelected(toSave);
      toast.success('Uloženo');
    } catch (e: any) {
      console.error('Save draft error:', e);
      toast.error(`Chyba při ukládání: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async (id: string) => {
    if (!confirm('Smazat tento draft?')) return;
    try {
      await fetch(`${SERVER}/admin/email-drafts/${id}`, { method: 'DELETE', headers: AUTH_H });
      setDrafts(prev => prev.filter(d => d.id !== id));
      if (selected?.id === id) {
        const remaining = drafts.filter(d => d.id !== id);
        setSelected(remaining[0] || null);
        setChatMsgs(remaining[0]?.chatHistory || []);
      }
      toast.success('Smazáno');
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    }
  };

  const createNewDraft = () => {
    const now = new Date().toISOString();
    const d: EmailDraft = {
      ...EMPTY_DRAFT, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    };
    setDrafts(prev => [d, ...prev]);
    selectDraft(d);
    toast.success('Nový draft vytvořen');
  };

  const updateField = (field: keyof EmailDraft, value: any) => {
    if (!selected) return;
    const updated = { ...selected, [field]: value, updatedAt: new Date().toISOString() };
    setSelected(updated);
    setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const clearCanvasSelection = () => {
    setSelectedCanvasText('');
    setSelectionTooltipPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const focusChatWithSelection = () => {
    setCapturedSelection(selectedCanvasText);
    clearCanvasSelection();
    const prefix = `[Vybraný text: "${selectedCanvasText.substring(0, 100)}${selectedCanvasText.length > 100 ? '…' : ''}"]\n`;
    setChatInput(prev => prefix + prev);
    chatInputRef.current?.focus();
  };

  /* ── Collage insert handler ─────────────────────── */
  const handleCollageInsert = (url: string) => {
    if (!selected) return;
    const imgTag = `<img src="${url}" alt="Koláž" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`;
    if (editingImgSrc && selected.bodyHtml) {
      // Replace existing image with new collage
      const escaped = editingImgSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*/?>`, 'gi');
      const newBody = selected.bodyHtml.replace(regex, imgTag);
      updateField('bodyHtml', newBody);
    } else {
      // Append collage at end of body
      updateField('bodyHtml', (selected.bodyHtml || '') + '\n' + imgTag);
    }
    setEditingImgSrc(null);
  };

  /* ── AI Chat ─────────────────────────────────────── */
  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || generating) return;

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', content: msg, timestamp: new Date().toISOString() };
    const historyWithUser = [...chatMsgs, userMsg];
    setChatMsgs(historyWithUser);
    setChatInput('');
    setGenerating(true);

    try {
      const convCtx = historyWithUser.map(m => `${m.role === 'user' ? 'Uživatel' : 'AI'}: ${m.content}`).join('\n');

      let currentEmailCtx = '';
      if (selected && (selected.subject || selected.bodyHtml)) {
        currentEmailCtx = `\n\nAktuální email:\nPředmět: ${selected.subject}\nPreview: ${selected.previewText}\nNadpis: ${selected.headline}\nBody: ${selected.bodyHtml}\nCTA: ${selected.ctaText} → ${selected.ctaUrl}\nAudience: ${selected.audience}`;
      }

      // Append selection context for AI
      let selectionCtx = '';
      if (capturedSelection) {
        selectionCtx = `\n\n[Uživatel vybral text v emailu: "${capturedSelection}"]`;
        setCapturedSelection(null);
      }

      const r = await fetch(`${SERVER}/admin/mailchimp/generate-email`, {
        method: 'POST', headers: AUTH_H,
        body: JSON.stringify({
          prompt: msg,
          conversationContext: convCtx + currentEmailCtx + selectionCtx,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.raw ? `${data.error}\n\nRaw: ${data.raw}` : data.error);

      const e = data.email || {};
      const now = new Date().toISOString();

      // Build AI response text (just confirmation, no raw JSON)
      let aiText = '';
      if (e.subject) aiText += `**Předmět:** ${e.subject}\n`;
      if (e.headline) aiText += `**Nadpis:** ${e.headline}\n`;
      if (e.previewText) aiText += `**Preview:** ${e.previewText}\n`;
      aiText += '\nEmail byl aktualizován v náhledu.';

      const aiMsg: ChatMsg = {
        id: crypto.randomUUID(), role: 'ai', content: aiText,
        ragDebug: data.ragDebug || null, timestamp: now,
      };

      const updatedHistory = [...historyWithUser, aiMsg];
      setChatMsgs(updatedHistory);

      const updatedDraft: EmailDraft = {
        ...(selected || { ...EMPTY_DRAFT, id: crypto.randomUUID(), createdAt: now }),
        subject: e.subject || selected?.subject || '',
        previewText: e.previewText || selected?.previewText || '',
        headline: e.headline || selected?.headline || '',
        bodyHtml: e.bodyHtml || selected?.bodyHtml || '',
        ctaText: e.ctaText || selected?.ctaText || 'Vyzkoušejte zdarma',
        ctaUrl: e.ctaUrl || selected?.ctaUrl || 'https://www.vividbooks.com/vyzkousejte',
        audience: e.audience || selected?.audience || 'newsletter',
        fullHtml: e.fullHtml || '',
        status: 'draft' as const,
        updatedAt: now,
        chatHistory: updatedHistory,
      };

      setSelected(updatedDraft);
      setDrafts(prev => {
        const idx = prev.findIndex(x => x.id === updatedDraft.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = updatedDraft; return n; }
        return [updatedDraft, ...prev];
      });

      // ── Auto-generate collage from productImages ──
      const productImages: string[] = e.productImages || data.email?.productImages || [];
      if (productImages.length >= 2 && updatedDraft.bodyHtml) {
        // Show generating status in chat
        const collageNote: ChatMsg = {
          id: crypto.randomUUID(), role: 'ai',
          content: `🎨 Generuji koláž z ${productImages.length} produktových obrázků...`,
          timestamp: new Date().toISOString(),
        };
        setChatMsgs(prev => [...prev, collageNote]);

        try {
          const { collageUrl } = await autoGenerateCollage(productImages, 'scattered');
          if (collageUrl) {
            // Replace data-product-collage placeholder or append
            const collageImgTag = `<img src="${collageUrl}" alt="Produktová koláž" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`;
            let newBody = updatedDraft.bodyHtml;
            if (newBody.includes('data-product-collage')) {
              newBody = newBody.replace(/<div[^>]*data-product-collage[^>]*>[\s\S]*?<\/div>/gi, collageImgTag);
            } else {
              // Insert before CTA or at end
              newBody = newBody + '\n' + collageImgTag;
            }

            updatedDraft.bodyHtml = newBody;
            updatedDraft.updatedAt = new Date().toISOString();
            setSelected({ ...updatedDraft });
            setDrafts(prev => prev.map(d => d.id === updatedDraft.id ? { ...updatedDraft } : d));

            // Update chat with success
            const successNote: ChatMsg = {
              id: crypto.randomUUID(), role: 'ai',
              content: `✅ Koláž vytvořena a vložena (${productImages.length} obálek). Kliknutím na ni ji můžete upravit.`,
              timestamp: new Date().toISOString(),
            };
            setChatMsgs(prev => [...prev.filter(m => m.id !== collageNote.id), successNote]);
            updatedDraft.chatHistory = [...(updatedDraft.chatHistory || []), successNote];
          }
        } catch (collageErr: any) {
          console.warn('[Collage] Auto-gen failed:', collageErr);
          const failNote: ChatMsg = {
            id: crypto.randomUUID(), role: 'ai',
            content: `⚠️ Koláž se nepodařilo automaticky vytvořit (${collageErr.message}). Můžete ji vytvořit ručně tlačítkem „Vložit koláž".`,
            timestamp: new Date().toISOString(),
          };
          setChatMsgs(prev => [...prev.filter(m => m.id !== collageNote.id), failNote]);
        }
      } else if (productImages.length === 1 && updatedDraft.bodyHtml) {
        // Single product image — insert directly if placeholder exists
        const singleImgTag = `<img src="${productImages[0]}" alt="Produkt" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`;
        if (updatedDraft.bodyHtml.includes('data-product-collage')) {
          updatedDraft.bodyHtml = updatedDraft.bodyHtml.replace(/<div[^>]*data-product-collage[^>]*>[\s\S]*?<\/div>/gi, singleImgTag);
          setSelected({ ...updatedDraft });
          setDrafts(prev => prev.map(d => d.id === updatedDraft.id ? { ...updatedDraft } : d));
        }
      }

      // Auto-save
      await saveDraft(updatedDraft);
    } catch (e: any) {
      console.error('Send chat error:', e);
      const errMsg: ChatMsg = {
        id: crypto.randomUUID(), role: 'ai',
        content: `Chyba: ${e.message}`, timestamp: new Date().toISOString(),
      };
      setChatMsgs(prev => [...prev, errMsg]);
      toast.error(`AI chyba: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  /* ── Push to Mailchimp ───────────────────────────── */
  const pushToMailchimp = async () => {
    if (!selected) return;
    setPushing(true);
    try {
      const r = await fetch(`${SERVER}/admin/mailchimp/create-draft`, {
        method: 'POST', headers: AUTH_H,
        body: JSON.stringify({
          subject: selected.subject, previewText: selected.previewText,
          headline: selected.headline, bodyContent: selected.bodyHtml,
          ctaText: selected.ctaText, ctaUrl: selected.ctaUrl,
          audience: selected.audience, htmlBody: selected.fullHtml || undefined,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);

      const updated = {
        ...selected,
        status: 'pushed' as const,
        mailchimpCampaignId: data.campaignId,
        mailchimpUrl: data.archiveUrl || data.webUrl,
        updatedAt: new Date().toISOString(),
      };
      setSelected(updated);
      setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
      await saveDraft(updated);
      toast.success('Pushnutno do Mailchimpu!');
    } catch (e: any) {
      console.error('Push to Mailchimp error:', e);
      toast.error(`Mailchimp chyba: ${e.message}`);
    } finally {
      setPushing(false);
    }
  };

  /* ── Render ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white text-[#001161] overflow-hidden" style={{ minWidth: 1300 }}>

      {/* ── Canvas text selection tooltip ─────────────── */}
      {selectedCanvasText && selectionTooltipPos && (
        <div
          className="fixed z-[9999]"
          style={{
            left: selectionTooltipPos.x,
            top: selectionTooltipPos.y - 48,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center gap-1.5 bg-[#001161] text-white rounded-full px-3 py-1.5 shadow-2xl border border-white/10">
            <TextCursor className="w-3 h-3 text-white/50 shrink-0" />
            <span style={F} className="text-[10px] font-bold text-white/80 truncate max-w-[140px]">
              {selectedCanvasText.substring(0, 35)}{selectedCanvasText.length > 35 ? '…' : ''}
            </span>
            <button
              onClick={focusChatWithSelection}
              className="flex items-center gap-1 text-[9px] font-bold bg-[#7C3AED] rounded-full px-2.5 py-1 hover:bg-[#6D28D9] transition-all cursor-pointer whitespace-nowrap"
              style={F}
            >
              <Sparkles className="w-2.5 h-2.5" />
              Zeptat se AI
            </button>
            <button
              onClick={clearCanvasSelection}
              className="p-0.5 rounded-full hover:bg-white/20 transition-all cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Image Lightbox ─────────────────────────────── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-8 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxSrc}
              alt="Zvětšený obrázek"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingImgSrc(lightboxSrc);
                  setLightboxSrc(null);
                  setCollageOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-lg transition-all cursor-pointer"
                title="Nahradit koláží"
                style={F}
              >
                <Layers className="w-4 h-4" />
                <span className="text-[11px] font-bold">Nahradit koláží</span>
              </button>
              <a
                href={lightboxSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/90 hover:bg-white text-[#001161] shadow-lg transition-all cursor-pointer"
                onClick={e => e.stopPropagation()}
                title="Otevřít v novém okně"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => setLightboxSrc(null)}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-[#001161] shadow-lg transition-all cursor-pointer"
                title="Zavřít (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-white/80 text-[10px] font-bold" style={F}>
              Klikněte kamkoliv pro zavření · Esc
            </div>
          </div>
        </div>
      )}

      {/* ═══ SIDEBAR ═══════════════════════════════════ */}
      <div className={`${sidebarOpen ? 'w-[280px]' : 'w-0'} transition-all duration-200 border-r border-gray-100 bg-[#fafbfd] flex flex-col overflow-hidden shrink-0`}>
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#7C3AED]" />
          <span style={F} className="text-[13px] font-bold text-[#001161] flex-1">Emaily</span>
          <button
            onClick={createNewDraft}
            className="p-1.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all cursor-pointer"
            title="Nový email"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {drafts.map(d => (
            <div
              key={d.id}
              onClick={() => selectDraft(d)}
              className={`group p-2.5 rounded-lg cursor-pointer transition-all ${
                selected?.id === d.id
                  ? 'bg-[#7C3AED]/10 border border-[#7C3AED]/20'
                  : 'hover:bg-gray-100 border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p style={F} className="text-[12px] font-bold text-[#001161] truncate">
                    {d.subject || 'Bez předmětu'}
                  </p>
                  <p style={F} className="text-[10px] text-[#001161]/40 mt-0.5">
                    {fmtDate(d.updatedAt || d.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {d.status === 'pushed' && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600" style={F}>MC</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deleteDraft(d.id); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {drafts.length === 0 && (
            <div className="text-center py-8">
              <Mail className="w-8 h-8 text-[#001161]/10 mx-auto mb-2" />
              <p style={F} className="text-[11px] text-[#001161]/30">Zatím žádné emaily</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAIN CANVAS ═══════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-12 border-b border-gray-100 flex items-center px-4 gap-2 shrink-0 bg-white">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-all cursor-pointer" title={sidebarOpen ? 'Skrýt sidebar' : 'Zobrazit sidebar'}>
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4 text-[#001161]/40" /> : <PanelLeftOpen className="w-4 h-4 text-[#001161]/40" />}
          </button>

          {selected && (
            <>
              <div className="flex-1" />

              {/* View toggles */}
              <button
                onClick={() => { setShowHtmlSource(false); setShowSettings(false); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${!showHtmlSource && !showSettings ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#001161]/40 hover:text-[#001161]/60 hover:bg-gray-50'}`}
                style={F}
              >
                <Eye className="w-3 h-3" /> Náhled
              </button>
              <button
                onClick={() => { setShowHtmlSource(true); setShowSettings(false); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${showHtmlSource ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#001161]/40 hover:text-[#001161]/60 hover:bg-gray-50'}`}
                style={F}
              >
                <FileText className="w-3 h-3" /> HTML
              </button>
              <button
                onClick={() => { setShowSettings(true); setShowHtmlSource(false); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${showSettings ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#001161]/40 hover:text-[#001161]/60 hover:bg-gray-50'}`}
                style={F}
              >
                <Settings2 className="w-3 h-3" /> Nastavení
              </button>

              <div className="w-px h-6 bg-gray-200 mx-1" />

              {/* Insert collage */}
              <button
                onClick={() => { setEditingImgSrc(null); setCollageOpen(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:bg-[#7C3AED]/5 transition-all cursor-pointer border border-gray-200 hover:border-[#7C3AED]/30"
                style={F}
              >
                <Layers className="w-3 h-3" />
                Vložit koláž
              </button>

              {/* Save */}
              <button
                onClick={() => saveDraft()}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#001161] text-white hover:bg-[#001161]/90 disabled:opacity-50 transition-all cursor-pointer"
                style={F}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Uložit
              </button>

              {/* Push to MC */}
              <button
                onClick={pushToMailchimp}
                disabled={pushing || !selected.subject}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-50 transition-all cursor-pointer"
                style={F}
              >
                {pushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Do Mailchimpu
              </button>

              {selected.mailchimpUrl && (
                <a href={selected.mailchimpUrl} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                  title="Otevřít v Mailchimpu"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#7C3AED]" />
                </a>
              )}
            </>
          )}
        </div>

        {/* Canvas content */}
        <div className="flex-1 overflow-y-auto bg-[#f5f6fa]" ref={canvasRef}>
          {!selected ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Mail className="w-12 h-12 text-[#001161]/10 mx-auto mb-3" />
                <p style={F} className="text-[14px] text-[#001161]/30 mb-4">Vyberte email nebo vytvořte nový</p>
                <button onClick={createNewDraft} className="flex items-center gap-2 px-4 py-2 rounded-[999px] bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all cursor-pointer mx-auto" style={F}>
                  <Plus className="w-4 h-4" /> Nový email
                </button>
              </div>
            </div>
          ) : showHtmlSource ? (
            /* ── HTML Source View ──────────────────────── */
            <div className="p-8 flex justify-center">
              <div className="w-full max-w-[600px]">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                    <span style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider">HTML Source</span>
                    <div className="flex-1" />
                    <CopyBtn text={selected.fullHtml || selected.bodyHtml || ''} />
                  </div>
                  <pre className="p-4 text-[11px] text-[#001161]/70 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[70vh]">
                    {selected.fullHtml || selected.bodyHtml || '(prázdný)'}
                  </pre>
                </div>
              </div>
            </div>
          ) : showSettings ? (
            /* ── Settings View ────────────────────────── */
            <div className="p-8 max-w-[600px] mx-auto space-y-5">
              <h3 style={F} className="text-[14px] font-bold text-[#001161]">Nastavení emailu</h3>

              <div>
                <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Mail className="w-3 h-3" /> Předmět
                </label>
                <input
                  value={selected.subject}
                  onChange={e => updateField('subject', e.target.value)}
                  className="w-full bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10"
                  placeholder="Předmět emailu"
                  style={F}
                />
              </div>

              <div>
                <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  Preview text
                </label>
                <input
                  value={selected.previewText}
                  onChange={e => updateField('previewText', e.target.value)}
                  className="w-full bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10"
                  placeholder="Preview text pro inbox"
                  style={F}
                />
              </div>

              <div>
                <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  Nadpis
                </label>
                <input
                  value={selected.headline}
                  onChange={e => updateField('headline', e.target.value)}
                  className="w-full bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10"
                  placeholder="Hlavní nadpis v emailu"
                  style={F}
                />
              </div>

              <div>
                <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <FileText className="w-3 h-3" /> Obsah emailu (HTML)
                </label>
                <textarea
                  value={selected.bodyHtml}
                  onChange={e => updateField('bodyHtml', e.target.value)}
                  rows={12}
                  className="w-full bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-[#001161]/70 font-mono focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10 resize-y"
                  placeholder="<p>Obsah emailu...</p>"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Link2 className="w-3 h-3" /> CTA text
                  </label>
                  <input
                    value={selected.ctaText}
                    onChange={e => updateField('ctaText', e.target.value)}
                    className="w-full bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10"
                    style={F}
                  />
                </div>
                <div>
                  <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    CTA URL
                  </label>
                  <input
                    value={selected.ctaUrl}
                    onChange={e => updateField('ctaUrl', e.target.value)}
                    className="w-full bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-[#001161]/70 font-mono focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10"
                  />
                </div>
              </div>

              <div>
                <label style={F} className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Users className="w-3 h-3" /> Audience
                </label>
                <div className="flex gap-2">
                  {(['newsletter', 'no-newsletter'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => updateField('audience', a)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        selected.audience === a ? 'bg-[#7C3AED] text-white' : 'bg-gray-100 text-[#001161]/50 hover:bg-gray-200'
                      }`}
                      style={F}
                    >
                      {a === 'newsletter' ? 'Newsletter' : 'No-Newsletter'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Visual Preview ───────────────────────── */
            <div className="p-8 flex justify-center">
              <div className="w-full max-w-[600px]">
                {/* Email chrome */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Subject preview bar */}
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={F} className="text-[10px] font-bold text-[#001161]/30 uppercase tracking-wider">Předmět</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        selected.audience === 'newsletter' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`} style={F}>
                        {selected.audience === 'newsletter' ? 'Newsletter' : 'No-Newsletter'}
                      </span>
                      {selected.status === 'pushed' && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600" style={F}>
                          Mailchimp ✓
                        </span>
                      )}
                    </div>
                    <EditableField
                      value={selected.subject}
                      onChange={v => updateField('subject', v)}
                      placeholder="Zadejte předmět emailu..."
                      className="text-[15px] font-bold text-[#001161]"
                      tag="Předmět"
                    />
                    {selected.previewText && (
                      <p style={F} className="text-[11px] text-[#001161]/30 mt-1 truncate">{selected.previewText}</p>
                    )}
                  </div>

                  {/* Email body */}
                  <div className="px-8 py-6">
                    {/* Headline — only show if body doesn't have hero section */}
                    {!selected.bodyHtml?.includes('linear-gradient') && (
                    <div className="mb-4">
                      <EditableField
                        value={selected.headline}
                        onChange={v => updateField('headline', v)}
                        placeholder="Hlavní nadpis..."
                        className="text-[22px] font-bold text-[#001161] leading-tight"
                        tag="Nadpis"
                      />
                    </div>
                    )}

                    {/* Body — rendered preview with clickable images */}
                    <div className="mb-6 relative group/body">
                      {selected.bodyHtml ? (
                        <div
                          style={F}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'IMG') {
                              e.preventDefault();
                              e.stopPropagation();
                              setLightboxSrc((target as HTMLImageElement).src);
                            }
                          }}
                          dangerouslySetInnerHTML={{ __html: preprocessHtml(selected.bodyHtml) }}
                          className="text-[14px] text-[#333] leading-relaxed [&_p]:mb-2.5 [&_strong]:font-bold [&_ul]:ml-4 [&_ul]:list-disc [&_li]:mb-1 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-[#001161] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-[14px] [&_h3]:font-bold [&_h3]:text-[#001161] [&_h3]:mt-2 [&_h3]:mb-1 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3 [&_img]:cursor-pointer [&_img]:transition-all [&_img]:hover:shadow-lg [&_img]:hover:ring-2 [&_img]:hover:ring-[#7C3AED]/30 [&_a]:text-[#7C3AED] [&_a]:no-underline [&_table]:w-full select-text"
                        />
                      ) : (
                        <div
                          onClick={() => setShowSettings(true)}
                          className="text-[14px] text-[#001161]/20 italic py-8 text-center border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-all"
                          style={F}
                        >
                          Klikněte pro editaci obsahu nebo použijte AI chat
                        </div>
                      )}
                      {selected.bodyHtml && (
                        <button
                          onClick={() => setShowSettings(true)}
                          className="opacity-0 group-hover/body:opacity-100 absolute top-0 right-0 flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-all cursor-pointer shadow-sm"
                          style={F}
                        >
                          <Settings2 className="w-2.5 h-2.5" />
                          Upravit
                        </button>
                      )}
                    </div>

                    {/* CTA — only show if body doesn't already contain CTA buttons */}
                    {!selected.bodyHtml?.includes('background-color:#7C3AED') && (
                    <div className="text-center py-2">
                      <div className="inline-block group relative">
                        <EditableField
                          value={selected.ctaText}
                          onChange={v => updateField('ctaText', v)}
                          placeholder="CTA text"
                          className="inline-block px-8 py-3 rounded-[14px] bg-[#7C3AED] text-white text-[15px] font-bold"
                          tag="CTA"
                        />
                      </div>
                      {selected.ctaUrl && (
                        <p style={F} className="text-[9px] text-[#001161]/20 mt-2">{selected.ctaUrl}</p>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CHAT PANEL ════════════════════════════════ */}
      <div className="w-[360px] border-l border-gray-100 flex flex-col bg-white shrink-0">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#7C3AED]" />
          <span style={F} className="text-[12px] font-bold text-[#001161]">AI Email Agent</span>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600" style={F}>RAG</span>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {chatMsgs.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="w-8 h-8 text-[#7C3AED]/20 mx-auto mb-3" />
              <p style={F} className="text-[12px] text-[#001161]/30 mb-1">Popište email, který chcete vytvořit</p>
              <p style={F} className="text-[10px] text-[#001161]/20">AI vytvoří email s daty z RAG</p>
            </div>
          )}

          {chatMsgs.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                m.role === 'user'
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#f5f6fa] text-[#001161]'
              }`}>
                <div
                  style={F}
                  className={`text-[12px] leading-relaxed whitespace-pre-wrap [&_strong]:font-bold ${
                    m.role === 'user' ? '' : '[&_strong]:text-[#7C3AED]'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: m.content
                      .replace(/```json[\s\S]*?```/g, '')
                      .replace(/```[\s\S]*?```/g, '')
                      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      .trim()
                  }}
                />
                {m.ragDebug && <RagBadges info={m.ragDebug} />}
                <p style={F} className={`text-[8px] mt-1.5 ${m.role === 'user' ? 'text-white/40' : 'text-[#001161]/20'}`}>
                  {fmtDate(m.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {generating && (
            <div className="flex justify-start">
              <div className="bg-[#f5f6fa] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[#7C3AED] animate-spin" />
                  <span style={F} className="text-[11px] text-[#001161]/40">Generuji...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-gray-100">
          {capturedSelection && (
            <div className="mb-2 px-2 py-1.5 rounded-lg bg-[#7C3AED]/5 border border-[#7C3AED]/10 flex items-center gap-2">
              <TextCursor className="w-3 h-3 text-[#7C3AED] shrink-0" />
              <span style={F} className="text-[9px] text-[#7C3AED] truncate flex-1">
                Výběr: „{capturedSelection.substring(0, 40)}{capturedSelection.length > 40 ? '…' : ''}"
              </span>
              <button onClick={() => setCapturedSelection(null)} className="p-0.5 rounded hover:bg-[#7C3AED]/10 cursor-pointer">
                <X className="w-3 h-3 text-[#7C3AED]/50" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
              }}
              placeholder="Popište email nebo úpravu..."
              rows={2}
              className="flex-1 bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[12px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10 resize-none"
              style={F}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || generating}
              className="self-end p-2.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-30 transition-all cursor-pointer shrink-0"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ COLLAGE MODAL ════════════════════════════ */}
      <CollageModal
        open={collageOpen}
        onClose={() => { setCollageOpen(false); setEditingImgSrc(null); }}
        onInsert={handleCollageInsert}
        editingImageUrls={editingImgSrc ? [editingImgSrc] : undefined}
      />
    </div>
  );
}