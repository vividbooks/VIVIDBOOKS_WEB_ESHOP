import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Copy, Check, Trash2, RefreshCw, Plus, MessageSquare, Clock, ChevronRight, ChevronLeft, X, Mail, ExternalLink, Eye, Loader2, Zap, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import ContentCanvas, { isCanvasWorthy, detectCanvasType, CanvasDataSource } from './ContentCanvas';
import {
  EMAIL_BUILDER_AI_TIER_KEY,
  type EmailAiTier,
  fetchGenerateEmailWithRetry,
  getStoredEmailAiTier,
} from '../../utils/emailAiTier';
import { AnimatePresence } from 'motion/react';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: { in: number; out: number };
  ragChunks?: number;
  ragDebug?: { indexSize: number; topScore: number; reason: string };
}

interface ChatIndexEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

const INTRO_MSG: Message = {
  id: 'intro',
  role: 'assistant',
  content: 'Ahoj! Jsem váš marketingový agent pro Vividbooks. 🎯\n\nVím o vašich produktech, předmětech, webinářích i brand voice. Pomůžu vám s:\n- **Newslettery a e-maily** pro učitele a školy\n- **Posty na sociální sítě** (LinkedIn, Facebook, Instagram)\n- **Web texty** — hero sekce, popisy produktů, CTA\n- **Kampaně** — Google Ads, slogany, promo texty\n\n📧 **Novinka**: Můžu vám vygenerovat email a jedním klikem ho vložit do Mailchimpu jako draft!\n\nNapište mi, co potřebujete napsat.',
  timestamp: new Date(),
};

function generateTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().slice(0, 55);
  return trimmed.length < firstUserMessage.trim().length ? trimmed + '…' : trimmed;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 2) return 'Právě teď';
  if (diffMins < 60) return `Před ${diffMins} min`;
  if (diffHours < 24) return `Před ${diffHours} h`;
  if (diffDays === 1) return 'Včera';
  if (diffDays < 7) return `Před ${diffDays} dny`;
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      result.push(
        <h2 key={i} style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          className="text-[#001161] text-[16px] font-bold mt-4 mb-1.5">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      result.push(
        <h3 key={i} style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          className="text-[#001161] text-[14px] font-bold mt-3 mb-1">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('**') && line.includes('**:')) {
      const formatted = line.replace(/\*\*(.+?)\*\*/g, (_, b) => `<strong>${b}</strong>`);
      result.push(
        <p key={i} style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          className="text-[14px] text-[#001161] leading-relaxed mb-1"
          dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      result.push(
        <div key={i} className="flex gap-2 mb-0.5 ml-2">
          <span className="text-[#FF6B1A] mt-1.5 shrink-0 text-[8px]">●</span>
          <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
            className="text-[14px] text-[#001161]/80 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] || '';
      const content = line.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      result.push(
        <div key={i} className="flex gap-2 mb-0.5 ml-2">
          <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
            className="text-[#FF6B1A] font-bold text-[13px] shrink-0 w-5">{num}.</span>
          <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
            className="text-[14px] text-[#001161]/80 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    } else if (line === '---' || line === '***') {
      result.push(<hr key={i} className="border-[#001161]/10 my-3" />);
    } else if (line.trim() === '') {
      result.push(<div key={i} className="h-1.5" />);
    } else {
      const formatted = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:#f1f3f8;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');
      result.push(
        <p key={i} style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          className="text-[14px] text-[#001161]/85 leading-relaxed mb-0.5"
          dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    }
    i++;
  }
  return <>{result}</>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handle}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-[#001161]/40 hover:text-[#001161] hover:bg-[#001161]/5"
      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Zkopírováno' : 'Kopírovat'}
    </button>
  );
}

const MKT_MODEL_OPTIONS = [
  { id: 'gemini-3.1-pro-preview',        label: 'Pro',  color: '#FF6B1A' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Lite', color: '#10b981' },
] as const;
type MktModelId = typeof MKT_MODEL_OPTIONS[number]['id'];

export default function MarketingAgent({ model: _ignored }: { model?: string }) {
  const [model, setModel] = useState<MktModelId>('gemini-3.1-pro-preview');
  const [messages, setMessages] = useState<Message[]>([INTRO_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const [chatTitle, setChatTitle] = useState<string>('');
  const [chatIndex, setChatIndex] = useState<ChatIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile state
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Mailchimp state
  const [mcPanel, setMcPanel] = useState(false);
  const [mcGenerating, setMcGenerating] = useState(false);
  const [mcPushing, setMcPushing] = useState(false);
  const [mcSyncing, setMcSyncing] = useState(false);
  const [mcEmail, setMcEmail] = useState<any>(null);
  const [mcPrompt, setMcPrompt] = useState('');
  const [mcPreview, setMcPreview] = useState(false);
  /** Model pro endpoint `generate-email` (sdíleno s Email Builderem přes localStorage). */
  const [mcEmailModelTier, setMcEmailModelTierState] = useState<EmailAiTier>(() => getStoredEmailAiTier());
  const setMcEmailModelTier = useCallback((tier: EmailAiTier) => {
    try {
      window.localStorage.setItem(EMAIL_BUILDER_AI_TIER_KEY, tier);
    } catch { /* ignore */ }
    setMcEmailModelTierState(tier);
  }, []);

  // Canvas state
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [canvasTitle, setCanvasTitle] = useState('');
  const [canvasDataSource, setCanvasDataSource] = useState<CanvasDataSource | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToCanvas = () => {
    setTimeout(() => {
      scrollAreaRef.current?.scrollTo({ left: scrollAreaRef.current.scrollWidth, behavior: 'smooth' });
    }, 80);
  };
  const openCanvas = (msg: Message) => {
    setCanvasDataSource(null);
    setCanvasContent(msg.content);
    const firstLine = msg.content.split('\n').find(l => l.trim()) || 'Canvas';
    setCanvasTitle(firstLine.replace(/^#+\s*/, '').slice(0, 60));
    scrollToCanvas();
  };
  const openStructuredCanvas = (source: CanvasDataSource) => {
    setCanvasContent(null);
    setCanvasDataSource(source);
    scrollToCanvas();
  };
  const closeCanvas = () => { setCanvasContent(null); setCanvasDataSource(null); };

  const generateEmail = async () => {
    if (!mcPrompt.trim() && !messages.some(m => m.role === 'user')) return;
    setMcGenerating(true);
    try {
      const conversationCtx = messages
        .filter(m => m.id !== 'intro')
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content.slice(0, 300)}`)
        .join('\n');
      const { response: genRes, data } = await fetchGenerateEmailWithRetry(
        `${SERVER}/admin/mailchimp/generate-email`,
        AUTH_H,
        {
          prompt: mcPrompt.trim() || 'Vytvoř newsletter email na základě naší konverzace',
          conversationContext: conversationCtx,
          model: mcEmailModelTier,
        },
        () => toast.info('Gemini přetížená — zkouším znovu…', { duration: 4500 }),
      );
      if (!genRes.ok || data.error) throw new Error(String(data.error || 'Generování selhalo'));
      setMcEmail(data.email);
      toast.success('Email vygenerován!');
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
      console.error('[MC Generate]', e);
    } finally {
      setMcGenerating(false);
    }
  };

  const pushToMailchimp = async () => {
    if (!mcEmail) return;
    setMcPushing(true);
    try {
      const res = await fetch(`${SERVER}/admin/mailchimp/create-draft`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({
          subject: mcEmail.subject,
          previewText: mcEmail.previewText,
          headline: mcEmail.headline,
          bodyContent: mcEmail.bodyHtml,
          ctaText: mcEmail.ctaText,
          ctaUrl: mcEmail.ctaUrl,
          audience: mcEmail.audience || 'newsletter',
          htmlBody: mcEmail.fullHtml,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Vytvoření draftu selhalo');
      toast.success(
        <div>
          <strong>Draft vytvořen v Mailchimpu!</strong>
          <br />
          <a href={data.mailchimpUrl} target="_blank" rel="noopener noreferrer" className="underline text-[#7C3AED]">
            Otevřít v Mailchimpu →
          </a>
        </div>,
        { duration: 10000 }
      );
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
      console.error('[MC Push]', e);
    } finally {
      setMcPushing(false);
    }
  };

  const syncMailchimp = async () => {
    setMcSyncing(true);
    try {
      const res = await fetch(`${SERVER}/admin/mailchimp/sync?skipRag=1`, { method: 'POST', headers: AUTH_H });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Sync selhal');
      if ((data.campaigns ?? 0) === 0) {
        toast.error('Mailchimp sync proběhl, ale nebyly nalezeny žádné kampaně k indexaci.');
        return;
      }
      const ingestRes = await fetch(`${SERVER}/rag/ingest-source`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({ source: 'mailchimp' }),
      });
      const ingestData = await ingestRes.json();
      if (!ingestRes.ok || ingestData.error) throw new Error(ingestData.error || 'RAG ingest selhal');
      toast.success(`Synced ${data.campaigns} kampaní, ${ingestData.ingested} zaindexováno do RAG`);
    } catch (e: any) {
      toast.error(`Sync chyba: ${e.message}`);
    } finally {
      setMcSyncing(false);
    }
  };

  // Fetch products + chat index on mount
  useEffect(() => {
    fetch(`${SERVER}/public/products`, { headers: AUTH_H })
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});

    loadChatIndex();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const loadChatIndex = async () => {
    setIndexLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/marketing-chats`, { headers: AUTH_H });
      const data = await res.json();
      setChatIndex(data.chats || []);
    } catch (e) {
      console.error('[MarketingAgent] Chyba načítání indexu chatů:', e);
    } finally {
      setIndexLoading(false);
    }
  };

  // Auto-save debounced (only when there are real messages)
  const autoSave = useCallback((id: string, title: string, msgs: Message[]) => {
    const realMsgs = msgs.filter(m => m.id !== 'intro');
    if (realMsgs.length === 0) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const serializable = msgs.map(m => ({
          ...m,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
        }));
        await fetch(`${SERVER}/admin/marketing-chats`, {
          method: 'POST',
          headers: AUTH_H,
          body: JSON.stringify({ id, title, messages: serializable }),
        });
        // Refresh index
        const res = await fetch(`${SERVER}/admin/marketing-chats`, { headers: AUTH_H });
        const data = await res.json();
        setChatIndex(data.chats || []);
      } catch (e) {
        console.error('[MarketingAgent] Chyba auto-save:', e);
      }
    }, 1500);
  }, []);

  const loadChat = async (entry: ChatIndexEntry) => {
    setSavingId(entry.id);
    try {
      const res = await fetch(`${SERVER}/admin/marketing-chats/${entry.id}`, { headers: AUTH_H });
      const data = await res.json();
      if (data.chat) {
        const msgs: Message[] = data.chat.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(msgs);
        setChatId(entry.id);
        setChatTitle(entry.title);
        setInput('');
        setMobileDrawer(false);
      }
    } catch (e) {
      console.error('[MarketingAgent] Chyba načítání chatu:', e);
    } finally {
      setSavingId(null);
    }
  };

  const deleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`${SERVER}/admin/marketing-chats/${id}`, {
        method: 'DELETE',
        headers: AUTH_H,
      });
      setChatIndex(prev => prev.filter(ch => ch.id !== id));
      // If we deleted the active chat, start new
      if (id === chatId) {
        startNewChat();
      }
    } catch (e) {
      console.error('[MarketingAgent] Chyba mazání chatu:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const startNewChat = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const newId = crypto.randomUUID();
    setChatId(newId);
    setChatTitle('');
    setMessages([{ ...INTRO_MSG, timestamp: new Date() }]);
    setInput('');
  };

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Auto-generate title from first user message
    const realMsgs = newMessages.filter(m => m.id !== 'intro' && m.role === 'user');
    const currentTitle = chatTitle || (realMsgs.length === 1 ? generateTitle(content) : chatTitle);
    if (!chatTitle && realMsgs.length === 1) setChatTitle(currentTitle);

    try {
      const apiMessages = newMessages
        .filter(m => m.id !== 'intro')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${SERVER}/admin/marketing-agent`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({ messages: apiMessages, productContext: products, model }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Neznámá chyba');

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
        tokens: { in: data.tokensIn || 0, out: data.tokensOut || 0 },
        ragChunks: data.ragChunks || 0,
        ragDebug: data.ragDebug,
      };

      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      // Auto-save after response
      autoSave(chatId, currentTitle, finalMessages);
    } catch (e: any) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Chyba: ${e.message}`,
        timestamp: new Date(),
      };
      const finalMessages = [...newMessages, errMsg];
      setMessages(finalMessages);
    } finally {
      setLoading(false);
    }
  };

  const isActiveChat = (id: string) => id === chatId;

  return (
    <div ref={scrollAreaRef} className="h-full flex overflow-x-auto overflow-y-hidden bg-[#f7f8fc] relative">

      {/* ── Mobile sidebar overlay ── */}
      {isMobile && mobileDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileDrawer(false)} />
          <div className="relative w-[85vw] max-w-[320px] bg-white flex flex-col h-full shadow-2xl animate-[slideIn_0.2s_ease-out]">
            <style>{`@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
            <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between">
              <button
                onClick={() => { startNewChat(); setMobileDrawer(false); }}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white text-[13px] font-bold hover:opacity-90 transition-all cursor-pointer shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
                style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              >
                <Plus className="w-4 h-4" />
                Nový chat
              </button>
              <button onClick={() => setMobileDrawer(false)} className="ml-2 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {chatIndex.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 gap-2">
                  <MessageSquare className="w-6 h-6 text-[#001161]/15" />
                  <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }} className="text-[11px] text-[#001161]/30 text-center">Zatím žádné uložené chaty</p>
                </div>
              ) : chatIndex.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => loadChat(entry)}
                  className={`w-full text-left px-3 py-2.5 transition-all cursor-pointer group relative border-l-2 ${isActiveChat(entry.id) ? 'bg-[#7C3AED]/6 border-[#7C3AED]' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <div className="flex items-start gap-2 pr-5">
                    <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActiveChat(entry.id) ? 'text-[#7C3AED]' : 'text-[#001161]/25'}`} />
                    <div className="min-w-0 flex-1">
                      <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }} className={`text-[12px] font-bold leading-tight truncate ${isActiveChat(entry.id) ? 'text-[#7C3AED]' : 'text-[#001161]/80'}`}>
                        {entry.title || 'Nový chat'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5 text-[#001161]/20" />
                        <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }} className="text-[10px] text-[#001161]/30">{formatDate(entry.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LEFT SIDEBAR: Chat History (desktop only) ── */}
      <aside className="hidden md:flex w-[300px] shrink-0 border-r border-gray-200 bg-white flex-col overflow-hidden">
        {/* New chat button */}
        <div className="px-3 py-3 border-b border-gray-100">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white text-[13px] font-bold hover:opacity-90 transition-all cursor-pointer shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            <Plus className="w-4 h-4" />
            Nový chat
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto py-1">
          {indexLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#001161]/30 animate-spin" />
              <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                className="text-[11px] text-[#001161]/30">Načítám...</span>
            </div>
          ) : chatIndex.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 gap-2">
              <MessageSquare className="w-6 h-6 text-[#001161]/15" />
              <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                className="text-[11px] text-[#001161]/30 text-center">
                Zatím žádné uložené chaty
              </p>
            </div>
          ) : (
            chatIndex.map(entry => (
              <button
                key={entry.id}
                onClick={() => loadChat(entry)}
                disabled={savingId === entry.id}
                className={`w-full text-left px-3 py-2.5 transition-all cursor-pointer group relative border-l-2 ${
                  isActiveChat(entry.id)
                    ? 'bg-[#7C3AED]/6 border-[#7C3AED]'
                    : 'border-transparent hover:bg-gray-50 hover:border-[#001161]/10'
                }`}
              >
                <div className="flex items-start gap-2 pr-5">
                  <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActiveChat(entry.id) ? 'text-[#7C3AED]' : 'text-[#001161]/25'}`} />
                  <div className="min-w-0 flex-1">
                    <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                      className={`text-[12px] font-bold leading-tight truncate ${isActiveChat(entry.id) ? 'text-[#7C3AED]' : 'text-[#001161]/80'}`}>
                      {entry.title || 'Nový chat'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-[#001161]/20" />
                      <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        className="text-[10px] text-[#001161]/30">
                        {formatDate(entry.updatedAt)}
                      </span>
                      <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        className="text-[10px] text-[#001161]/20">
                        · {Math.floor(entry.messageCount / 2)} zpráv
                      </span>
                    </div>
                  </div>
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => deleteChat(e, entry.id)}
                  disabled={deletingId === entry.id}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[#001161]/30 hover:text-red-500 transition-all cursor-pointer"
                >
                  {deletingId === entry.id
                    ? <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    : <X className="w-2.5 h-2.5" />
                  }
                </button>
              </button>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${products.length > 0 ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
            <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              className="text-[10px] text-[#001161]/40">
              {products.length > 0 ? `${products.length} produktů v kontextu` : 'Načítám produkty...'}
            </p>
          </div>
        </div>
      </aside>

      {/* ── CHAT COLUMN — responsive ── */}
      <div className="w-full md:w-[700px] shrink-0 flex flex-col h-full md:border-r border-gray-200">

        {/* Header */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-3 md:px-5 gap-2 md:gap-3 shrink-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileDrawer(true)}
            className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-[#001161]/50" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              className="text-[13px] font-bold text-[#001161] truncate">
              {chatTitle || 'Nový chat'}
            </p>
            {/* Model switcher — inline PRO / LITE pills */}
            <div className="flex items-center gap-1 mt-0.5">
              {MKT_MODEL_OPTIONS.map(m => {
                const active = model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    title={m.id}
                    style={{
                      fontFamily: "'Fenomen Sans', sans-serif",
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: active ? m.color : 'rgba(0,17,97,0.07)',
                      color: active ? '#fff' : 'rgba(0,17,97,0.35)',
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
              <span style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: 9, color: 'rgba(0,17,97,0.28)', marginLeft: 2 }}>· brand voice</span>
            </div>
          </div>
          <button
            onClick={() => setMcPanel(!mcPanel)}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
              mcPanel ? 'text-white bg-[#7C3AED]' : 'text-[#7C3AED] hover:bg-[#7C3AED]/10'
            }`}
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            <Mail className="w-3.5 h-3.5" />
            Mailchimp
          </button>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#001161]/40 hover:text-[#7C3AED] hover:bg-[#7C3AED]/5 transition-all cursor-pointer"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nový</span>
          </button>
          {/* Quick Canvas shortcuts */}
          {([
            { label: 'Blog', ds: { type: 'blog' } as CanvasDataSource, color: 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200' },
            { label: 'Novinky', ds: { type: 'novinka' } as CanvasDataSource, color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
            { label: 'Webináře', ds: { type: 'webinar' } as CanvasDataSource, color: 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border-cyan-200' },
          ] as const).map(item => (
            <button
              key={item.label}
              onClick={() => openStructuredCanvas(item.ds)}
              style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '3px 9px', cursor: 'pointer' }}
              className={`hidden lg:flex items-center gap-1 border font-bold transition-colors ${item.color} ${canvasDataSource?.type === item.ds.type ? 'ring-1 ring-offset-1 ring-current' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 md:py-5 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-[78%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div
                  className={`rounded-[18px] px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[#001161] text-white rounded-tr-[6px] ml-auto'
                      : 'bg-white border border-gray-100 shadow-sm rounded-tl-[6px]'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                      className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="min-w-0">
                      {renderMarkdown(msg.content)}
                    </div>
                  )}
                </div>
                <div className={`flex items-center gap-2 mt-1 px-1 flex-wrap ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    className="text-[10px] text-[#001161]/25">
                    {msg.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.role === 'assistant' && msg.id !== 'intro' && (
                    <CopyButton text={msg.content} />
                  )}
                  {/* Canvas button — appears on canvas-worthy assistant messages */}
                  {msg.role === 'assistant' && msg.id !== 'intro' && isCanvasWorthy(msg.content) && (
                    <button
                      onClick={() => openCanvas(msg)}
                      style={{ fontFamily: "'Fenomen Sans', sans-serif", fontSize: 10, fontWeight: 800 }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        canvasContent === msg.content
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20'
                      }`}
                    >
                      <LayoutTemplate className="w-2.5 h-2.5" />
                      Canvas
                    </button>
                  )}
                  {msg.tokens && (
                    <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                      className="text-[10px] text-[#001161]/20">
                      {msg.tokens.out} tokenů
                    </span>
                  )}
                  {msg.ragDebug && (
                    <span
                      title={`Index: ${msg.ragDebug.indexSize} chunků | Top skóre: ${msg.ragDebug.topScore}% | ${msg.ragDebug.reason}`}
                      style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                      className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md cursor-help ${
                        msg.ragChunks && msg.ragChunks > 0
                          ? 'text-emerald-600/70 bg-emerald-50'
                          : 'text-orange-500/60 bg-orange-50'
                      }`}
                    >
                      {msg.ragChunks && msg.ragChunks > 0
                        ? <><span className="text-[9px]">⚡</span> RAG {msg.ragChunks}</>
                        : <><span className="text-[9px]">○</span> RAG ✗ {msg.ragDebug.indexSize > 0 ? `${msg.ragDebug.topScore}%` : 'prázdný'}</>
                      }
                    </span>
                  )}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-[#001161] flex items-center justify-center shrink-0 mt-0.5">
                  <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    className="text-white text-[10px] font-bold">VY</span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-[18px] rounded-tl-[6px] px-4 py-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-[#7C3AED] animate-spin" />
                  <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    className="text-[13px] text-[#001161]/50">
                    Píšu text...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Mailchimp Panel */}
        {mcPanel && (
          <div className="border-t border-[#7C3AED]/20 bg-gradient-to-b from-[#7C3AED]/[0.03] to-white px-5 py-4 shrink-0 space-y-3 max-h-[55vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#FFE01B] flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5 text-[#241C15]" />
                </div>
                <h3 style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  className="text-[14px] font-bold text-[#001161]">
                  Mailchimp Email Builder
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={syncMailchimp}
                  disabled={mcSyncing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#001161]/50 hover:text-[#001161] hover:bg-[#001161]/5 transition-all cursor-pointer disabled:opacity-40"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                >
                  {mcSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {mcSyncing ? 'Syncuji...' : 'Sync kampaní'}
                </button>
                <button onClick={() => setMcPanel(false)} className="text-[#001161]/30 hover:text-[#001161] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Prompt input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  className="text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide"
                >
                  Model emailu
                </span>
                <div className="flex p-0.5 rounded-lg bg-gray-100 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setMcEmailModelTier('lite')}
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      mcEmailModelTier === 'lite' ? 'bg-white text-[#001161] shadow-sm' : 'text-[#001161]/35'
                    }`}
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    Lite
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcEmailModelTier('pro')}
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      mcEmailModelTier === 'pro' ? 'bg-white text-[#001161] shadow-sm' : 'text-[#001161]/35'
                    }`}
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    Pro
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={mcPrompt}
                  onChange={e => setMcPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') generateEmail(); }}
                  placeholder="Napiš téma emailu... (např. 'Newsletter o novém webináři Fyzika')"
                  className="flex-1 rounded-[12px] border border-gray-200 bg-white px-3 py-2 text-[13px] text-[#001161] placeholder-[#001161]/30 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/10"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                />
                <button
                  onClick={generateEmail}
                  disabled={mcGenerating || (!mcPrompt.trim() && !messages.some(m => m.role === 'user'))}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-[#7C3AED] text-white text-[12px] font-bold hover:bg-[#6D28D9] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                >
                  {mcGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {mcGenerating ? 'Generuji...' : 'Generovat email'}
                </button>
              </div>
            </div>

            {/* Generated email preview */}
            {mcEmail && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Email header */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        className="text-[11px] text-[#001161]/40 uppercase tracking-wide font-bold mb-0.5">
                        Předmět zprávy
                      </p>
                      <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        className="text-[14px] font-bold text-[#001161] leading-tight">
                        {mcEmail.subject}
                      </p>
                      {mcEmail.previewText && (
                        <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                          className="text-[12px] text-[#001161]/50 mt-0.5">
                          {mcEmail.previewText}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        className="text-[10px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-0.5 rounded-md">
                        {mcEmail.audience || 'newsletter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Email body preview */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                      className="text-[11px] text-[#001161]/40 uppercase tracking-wide font-bold">
                      Nadpis
                    </p>
                  </div>
                  <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    className="text-[15px] font-bold text-[#001161] mb-2">
                    {mcEmail.headline}
                  </p>
                  <div
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                    className="text-[13px] text-[#001161]/80 leading-relaxed [&_strong]:font-bold [&_p]:mb-2 [&_ul]:ml-4 [&_ul]:list-disc [&_li]:mb-1"
                    dangerouslySetInnerHTML={{ __html: mcEmail.bodyHtml || '' }}
                  />
                  {mcEmail.ctaText && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="inline-block bg-[#7C3AED] text-white text-[12px] font-bold px-4 py-1.5 rounded-[999px]"
                        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                        {mcEmail.ctaText}
                      </span>
                      <span style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        className="text-[10px] text-[#001161]/30">
                        → {mcEmail.ctaUrl}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={pushToMailchimp}
                    disabled={mcPushing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white text-[12px] font-bold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    {mcPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    {mcPushing ? 'Vytvářím draft...' : 'Vložit do Mailchimpu'}
                  </button>
                  <button
                    onClick={() => setMcPreview(!mcPreview)}
                    className="flex items-center gap-1 px-3 py-2 rounded-[12px] border border-gray-200 text-[12px] font-bold text-[#001161]/60 hover:text-[#001161] hover:border-[#001161]/20 transition-all cursor-pointer"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {mcPreview ? 'Skrýt HTML' : 'Náhled HTML'}
                  </button>
                  <CopyButton text={mcEmail.fullHtml || ''} />
                  <button
                    onClick={generateEmail}
                    disabled={mcGenerating}
                    className="flex items-center gap-1 px-3 py-2 rounded-[12px] border border-gray-200 text-[12px] font-bold text-[#001161]/60 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 transition-all cursor-pointer"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    <RefreshCw className={`w-3 h-3 ${mcGenerating ? 'animate-spin' : ''}`} />
                    Přegenerovat
                  </button>
                </div>

                {/* HTML Preview */}
                {mcPreview && mcEmail.fullHtml && (
                  <div className="border-t border-gray-100">
                    <div className="p-2 bg-gray-50">
                      <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                        className="text-[10px] text-[#001161]/40 font-bold uppercase mb-1">
                        HTML Preview
                      </p>
                      <iframe
                        srcDoc={mcEmail.fullHtml}
                        className="w-full h-[400px] rounded-lg border border-gray-200 bg-white"
                        sandbox="allow-same-origin"
                        title="Email preview"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="bg-white border-t border-gray-200 px-3 md:px-5 py-3 md:py-4 shrink-0" style={{ paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : undefined }}>
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Popište co potřebujete napsat... (Enter = odeslat, Shift+Enter = nový řádek)"
                rows={1}
                disabled={loading}
                className="w-full resize-none rounded-[14px] border border-gray-200 bg-[#f7f8fc] px-4 py-3 text-[14px] text-[#001161] placeholder-[#001161]/30 focus:outline-none focus:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/10 transition-all disabled:opacity-60"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", minHeight: '48px', maxHeight: '160px' }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#7C3AED] to-[#9F67F5] flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shadow-[0_4px_12px_rgba(124,58,237,0.35)]"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
            className="hidden md:block text-[10px] text-[#001161]/25 mt-2 text-center">
            Chaty se automaticky ukládají · Agent zná všechny produkty a brand voice Vividbooks
          </p>
        </div>
      </div>{/* end chat column */}

      {/* ── CANVAS PANELS (appear to the right of chat) ── */}
      <AnimatePresence>
        {(canvasContent || canvasDataSource) && (
          <ContentCanvas
            key={canvasDataSource ? `ds-${canvasDataSource.type}` : canvasContent?.slice(0, 40)}
            content={canvasContent || ''}
            title={canvasTitle}
            type={canvasContent ? detectCanvasType(canvasContent) : undefined}
            dataSource={canvasDataSource || undefined}
            onClose={closeCanvas}
            onSendToAgent={(prompt) => {
              setInput(prompt);
              setTimeout(() => textareaRef.current?.focus(), 80);
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}