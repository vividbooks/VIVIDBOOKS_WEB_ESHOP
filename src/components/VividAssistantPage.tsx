import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  User,
  Send,
  Loader2,
  PanelLeft,
  Plus,
  Layers,
  Paperclip,
  Sparkles,
  ChevronRight,
  Copy,
  Check,
  X,
  FileText,
  Mail,
  Image as ImageIcon,
  Brain,
  Search,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import ContentCanvas, { CanvasDataSource, detectCanvasType } from './admin/ContentCanvas';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH = { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

type Role = 'user' | 'assistant';
type AgentModelId = 'gemini-3.1-flash-lite-preview' | 'gemini-3.1-pro-preview';

type ChatIndex = { id: string; title: string; updatedAt: string; messageCount: number };

type BlogDraft = {
  title: string;
  slug: string;
  author: string;
  category: string;
  tags: string;
  excerpt: string;
  readTime: number;
  coverImage: string;
  content: any[];
  contentHtml: string;
  date: string;
};

type Action = {
  type: string;
  id?: string;
  title?: string;
  name?: string;
  subject?: string;
  text?: string;
  draft?: BlogDraft;
  style?: string;
  imageUrls?: string[];
};

type Msg = {
  id: string;
  role: Role;
  content: string;
  actions?: Action[];
  loading?: boolean;
  ts: number;
  images?: string[];
};

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:5px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/^#{1,3} (.+)$/gm, '<strong style="font-size:15px">$1</strong>')
    .replace(/^[-*] (.+)$/gm, '• $1')
    .replace(/\n/g, '<br/>');
}

const ACTION_LABEL: Record<string, string> = {
  create_product: 'Produkt vytvořen',
  update_product: 'Produkt upraven',
  duplicate_product: 'Produkt zduplikován',
  create_subject_tab: 'Tab vytvořen',
  update_subject_tab: 'Tab upraven',
  create_hero_slide: 'Hero slider vytvořen',
  update_hero_slide: 'Hero slider upraven',
  create_email_campaign_draft: 'Email draft připraven',
  create_novinka: 'Novinka vytvořena',
  update_novinka: 'Novinka upravena',
  blog_draft_preview: 'Návrh blogu ke schválení',
  delegate_marketing_specialist: 'Marketing specialista',
  delegate_seo_specialist: 'SEO specialista',
  delegate_image_specialist: 'Image specialista',
  open_collage_builder: 'Koláž builder',
};

function getCanvasSourceFromAction(action: Action): CanvasDataSource | null {
  if (action.type === 'create_email_campaign_draft' && action.id) return { type: 'email', id: action.id };
  if ((action.type === 'create_subject_tab' || action.type === 'update_subject_tab') && action.subject) return { type: 'subject-tabs', subject: action.subject };
  if (action.type === 'create_hero_slide' || action.type === 'update_hero_slide') return { type: 'slider' };
  if ((action.type === 'create_product' || action.type === 'update_product' || action.type === 'duplicate_product') && action.id) return { type: 'product', id: action.id };
  if ((action.type === 'create_novinka' || action.type === 'update_novinka') && action.id) return { type: 'novinka', id: action.id };
  return null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-white/45 hover:text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
      style={FF}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Zkopírováno' : 'Kopírovat'}
    </button>
  );
}

function ActionBadge({ action, onOpenCanvas }: { action: Action; onOpenCanvas: (source: CanvasDataSource) => void }) {
  const source = getCanvasSourceFromAction(action);
  const label = ACTION_LABEL[action.type] || action.type;
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 w-7 h-7 rounded-full bg-white/6 flex items-center justify-center shrink-0">
          {action.type.includes('email') ? <Mail className="w-3.5 h-3.5 text-violet-300" /> :
            action.type.includes('product') ? <ImageIcon className="w-3.5 h-3.5 text-blue-300" /> :
            action.type.includes('subject_tab') ? <Layers className="w-3.5 h-3.5 text-teal-300" /> :
            action.type.includes('hero') ? <ImageIcon className="w-3.5 h-3.5 text-orange-300" /> :
            action.type.includes('novinka') ? <FileText className="w-3.5 h-3.5 text-emerald-300" /> :
            action.type.includes('seo') ? <Search className="w-3.5 h-3.5 text-amber-300" /> :
            action.type.includes('marketing') ? <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" /> :
            <Brain className="w-3.5 h-3.5 text-white/55" />}
        </div>
        <div className="min-w-0 flex-1">
          <p style={FF} className="text-[13px] font-bold text-white">{label}</p>
          {(action.title || action.name || action.subject || action.text) && (
            <p style={FF} className="text-[11px] text-white/45 mt-1 leading-relaxed">
              {action.title || action.name || action.subject || action.text}
            </p>
          )}
        </div>
        {source && (
          <button
            onClick={() => onOpenCanvas(source)}
            className="shrink-0 rounded-full bg-white text-[#111827] px-3 py-1.5 text-[11px] font-bold cursor-pointer"
            style={FF}
          >
            Canvas
          </button>
        )}
      </div>
    </div>
  );
}

function BlogDraftCard({
  action,
  onOpenCanvas,
  onApproved,
  onRejected,
}: {
  action: Action;
  onOpenCanvas: (content: string, title?: string) => void;
  onApproved: (message: string) => void;
  onRejected: () => void;
}) {
  const draft = action.draft;
  const [saving, setSaving] = useState(false);
  if (!draft) return null;

  return (
    <div className="rounded-3xl border border-violet-400/20 bg-violet-500/10 overflow-hidden">
      {draft.coverImage && (
        <div className="h-32 w-full overflow-hidden">
          <img src={draft.coverImage} alt={draft.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <p style={FF} className="text-[15px] font-bold text-white">{draft.title}</p>
        {draft.excerpt && <p style={FF} className="text-[12px] text-white/55 mt-2 leading-relaxed">{draft.excerpt}</p>}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onOpenCanvas(draftToCanvasContent(draft), draft.title)}
            className="rounded-full border border-white/15 px-3 py-2 text-[12px] text-white/80 cursor-pointer"
            style={FF}
          >
            Canvas
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                const res = await fetch(`${SERVER}/admin/commit-blog-draft`, {
                  method: 'POST',
                  headers: AUTH,
                  body: JSON.stringify({ draft }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                onApproved(`✅ Článek "${draft.title}" byl uložen jako draft.`);
              } catch (err: any) {
                toast.error('Uložení draftu selhalo', { description: err.message });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="rounded-full bg-white text-[#111827] px-3 py-2 text-[12px] font-bold cursor-pointer disabled:opacity-40"
            style={FF}
          >
            {saving ? 'Ukládám…' : 'Schválit'}
          </button>
          <button
            onClick={onRejected}
            className="rounded-full px-3 py-2 text-[12px] text-red-300 cursor-pointer"
            style={FF}
          >
            Zamítnout
          </button>
        </div>
      </div>
    </div>
  );
}

type VividAssistantPageProps = {
  embedded?: boolean;
  initialMessage?: string;
};

export default function VividAssistantPage({ embedded = false, initialMessage }: VividAssistantPageProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<AgentModelId>('gemini-3.1-flash-lite-preview');
  const [loading, setLoading] = useState(false);
  const [chatIndex, setChatIndex] = useState<ChatIndex[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(genId());
  const [chatLoading, setChatLoading] = useState(false);
  const [indexLoading, setIndexLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [canvasTitle, setCanvasTitle] = useState('');
  const [canvasDataSource, setCanvasDataSource] = useState<CanvasDataSource | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAutoCanvasKeyRef = useRef<string | null>(null);
  const lastInjectedMessageRef = useRef<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    let theme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    theme.content = '#0b0b0f';
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: genId(),
        role: 'assistant',
        content: embedded
          ? 'Ahoj! Jsem **asistent pro texty** v této aplikaci: odpovím na dotazy z **RAG** (nabídka, webináře…) a pomůžu **formulovat e-maily** v chatu. **Neměním web, CMS ani Mailchimp** — na to je plný Web operátor v administraci. Co potřebuješ?'
          : 'Ahoj! Jsem **Vivid Assistant**. Řekněte mi, co chcete změnit na webu, a já to zařídím přes Web operátora.',
        ts: Date.now(),
      }]);
      loadChatIndex();
    }
  }, [embedded]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [messages, canvasContent, canvasDataSource]);

  useEffect(() => {
    if (!initialMessage?.trim()) return;
    if (loading) return;
    if (lastInjectedMessageRef.current === initialMessage) return;
    if (messages.length === 0) return;
    lastInjectedMessageRef.current = initialMessage;
    send(initialMessage);
  }, [initialMessage, loading, messages.length]);

  useEffect(() => {
    const lastMsg = [...messages].reverse().find(m => m.role === 'assistant' && !m.loading && (m.actions?.length || 0));
    if (!lastMsg?.actions?.length) return;
    const lastAction = [...lastMsg.actions].reverse().find(action =>
      ['create_email_campaign_draft', 'create_subject_tab', 'update_subject_tab', 'create_hero_slide', 'update_hero_slide', 'create_product', 'update_product', 'duplicate_product', 'create_novinka', 'update_novinka'].includes(action.type)
    );
    if (!lastAction) return;
    const ds = getCanvasSourceFromAction(lastAction);
    if (!ds) return;
    const key = `${lastAction.type}:${lastAction.id || lastAction.subject || 'default'}`;
    if (lastAutoCanvasKeyRef.current === key) return;
    lastAutoCanvasKeyRef.current = key;
    setCanvasContent(null);
    setCanvasDataSource(ds);
  }, [messages]);

  useEffect(() => {
    const lastMsg = [...messages].reverse().find(m => m.role === 'assistant' && !m.loading && (m.actions?.length || 0));
    const draftAction = lastMsg?.actions?.find(action => action.type === 'blog_draft_preview' && action.draft);
    if (!draftAction?.draft) return;
    const key = `blog_draft_preview:${draftAction.draft.title}:${draftAction.draft.coverImage || ''}`;
    if (lastAutoCanvasKeyRef.current === key) return;
    lastAutoCanvasKeyRef.current = key;
    setCanvasDataSource(null);
    setCanvasContent(draftToCanvasContent(draftAction.draft));
    setCanvasTitle(draftAction.draft.title);
  }, [messages]);

  const suggestions = useMemo(() => embedded
    ? [
        'Vylepši tento koncept e-mailu o webináře (krátký odstavec + předmět)',
        'Jaké jsou aktuální termíny webinářů?',
        'Shrň v jedné větě nabídku matematiky pro ředitele školy',
        'Přepiš tento text zdvořileji, zachovej význam',
      ]
    : [
        'Připrav mailing pro nové produkty',
        'Uprav cenu pracovních sešitů o 10 %',
        'Připrav SEO brief pro matematiku',
        'Vytvoř hero slider pro jarní kampaň',
      ], [embedded]);

  async function loadChatIndex() {
    setIndexLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/admin-agent-chats`, { headers: AUTH });
      const data = await res.json();
      setChatIndex(data.chats || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIndexLoading(false);
    }
  }

  async function saveChat(nextMessages: Msg[], id: string) {
    const title = nextMessages.find(m => m.role === 'user')?.content?.slice(0, 60) || 'Nový úkol';
    const actions = nextMessages.flatMap(m => m.actions || []);
    await fetch(`${SERVER}/admin/admin-agent-chats`, {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ id, title, messages: nextMessages.filter(m => !m.loading), actions }),
    }).catch(() => {});
    loadChatIndex();
  }

  async function loadChat(id: string) {
    if (chatLoading) return;
    setChatLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/admin-agent-chats/${id}`, { headers: AUTH });
      const data = await res.json();
      setCurrentChatId(id);
      setMessages(data.chat?.messages || []);
      setCanvasContent(null);
      setCanvasDataSource(null);
      lastAutoCanvasKeyRef.current = null;
      setHistoryOpen(false);
    } catch (err) {
      toast.error('Nepodařilo se načíst chat');
    } finally {
      setChatLoading(false);
    }
  }

  async function newChat() {
    setCurrentChatId(genId());
    setCanvasContent(null);
    setCanvasDataSource(null);
    lastAutoCanvasKeyRef.current = null;
    setMessages([{
      id: genId(),
      role: 'assistant',
      content: embedded
        ? 'Nový chat. Napiš koncept e-mailu nebo se zeptej na informace — změny na webu patří do administrace (plný Web operátor).'
        : 'Nový úkol. Co chcete změnit na webu?',
      ts: Date.now(),
    }]);
    setHistoryOpen(false);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setUploading(true);
    const uploaded: { url: string; name: string }[] = [];
    for (const file of files) {
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
      } catch (err: any) {
        toast.error(`Upload selhal`, { description: err.message });
      }
    }
    if (uploaded.length) setPendingImages(prev => [...prev, ...uploaded]);
    setUploading(false);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    const imageUrls = pendingImages.map(item => item.url);
    if (!content && imageUrls.length === 0) return;
    if (loading) return;
    setInput('');
    setPendingImages([]);

    const userMsg: Msg = { id: genId(), role: 'user', content: content || '(obrázky)', ts: Date.now(), images: imageUrls.length ? imageUrls : undefined };
    const loadingMsg: Msg = { id: genId(), role: 'assistant', content: '', loading: true, ts: Date.now() };
    const nextMessages = [...messages, userMsg, loadingMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const history = nextMessages
        .filter(m => !m.loading && (m.content || m.images?.length))
        .map(m => ({ role: m.role, content: m.content, images: m.images }));

      const res = await fetch(`${SERVER}/admin/admin-agent`, {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ messages: history, model, embeddedAssistant: embedded }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const assistantMsg: Msg = {
        id: genId(),
        role: 'assistant',
        content: data.reply || '(prázdná odpověď)',
        actions: data.actions || [],
        ts: Date.now(),
      };
      const finalMsgs = [...messages, userMsg, assistantMsg];
      setMessages(finalMsgs);
      await saveChat(finalMsgs, currentChatId);
    } catch (err: any) {
      setMessages(prev => [...prev.filter(m => !m.loading), {
        id: genId(),
        role: 'assistant',
        content: `Chyba: ${err.message}`,
        ts: Date.now(),
      }]);
      toast.error('Agent selhal', { description: err.message });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className={embedded ? 'w-full h-full min-h-0 flex flex-col bg-black text-white overflow-hidden' : 'fixed inset-0 h-dvh max-h-dvh min-h-0 flex flex-col bg-black text-white overflow-hidden'}>
      <div className={`flex flex-col lg:flex-row min-h-0 overflow-hidden relative ${embedded ? 'flex-1' : 'flex-1 h-full'}`}>
        <div className={`flex flex-col h-full min-h-0 flex-1 ${(canvasContent || canvasDataSource) && !isMobile ? 'lg:min-w-0' : 'w-full lg:max-w-4xl lg:mx-auto'}`}>
          <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 pt-[max(16px,calc(env(safe-area-inset-top)+10px))]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHistoryOpen(true)}
                className="p-2 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Historie chatů"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 style={FF} className="text-white font-semibold text-[18px]">
                  {embedded ? 'Textový asistent' : 'Web operátor'}
                </h1>
                <p style={FF} className="text-[#8E8E93] text-xs">
                  {embedded ? 'Formulace e-mailů (bez změn na webu)' : 'Web operátor, Canvas'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={newChat}
                className="p-2 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Nový chat"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 md:p-6 space-y-4">
            {messages.length === 1 && (
              <div className="flex flex-col items-center justify-center text-center py-16 px-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-purple-400" />
                </div>
                <h2 style={FF} className="text-white font-semibold text-lg mb-2">
                  {embedded ? 'Ahoj! Jsem textový asistent.' : 'Ahoj! Jsem váš Web operátor.'}
                </h2>
                <p style={FF} className="text-[#8E8E93] max-w-md text-sm mb-4 leading-relaxed">
                  {embedded
                    ? 'Odpovím z RAG, pomůžu napsat nebo upravit e-mail v chatu. Nasazení na web nebo Mailchimp řeší plný Web operátor v administraci.'
                    : 'Mohu pracovat s obsahem webu, použít RAG, otevřít canvas a delegovat specialisty na pozadí.'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => send(suggestion)}
                      className="px-3 py-2 bg-[#1C1C1E] text-[#8E8E93] rounded-lg text-sm hover:bg-[#2C2C2E] hover:text-white transition-colors cursor-pointer"
                      style={FF}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 w-full min-w-0 max-w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`min-w-0 w-fit max-w-[min(100%,42rem)] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`rounded-2xl px-4 py-3 min-w-0 max-w-full overflow-hidden ${message.role === 'user' ? 'bg-[#0A84FF] text-white' : 'bg-[#1C1C1E] text-white'}`}>
                    {message.loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span style={FF} className="text-[#8E8E93] text-sm">Pracuji na tom...</span>
                      </div>
                    ) : (
                      <div
                        style={{ ...FF, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                        className="whitespace-pre-wrap text-sm leading-relaxed max-w-full [&_code]:break-all"
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
                      />
                    )}
                  </div>

                  {!message.loading && (
                    <div className={`flex items-center gap-2 mt-1 px-1 flex-wrap ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span style={FF} className="text-[10px] text-[#8E8E93]">
                        {new Date(message.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {message.role === 'assistant' && <CopyButton text={message.content} />}
                    </div>
                  )}

                  {message.actions?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.actions.map((action, idx) => (
                        action.type === 'blog_draft_preview' && action.draft ? (
                          <BlogDraftCard
                            key={`${message.id}-${idx}`}
                            action={action}
                            onOpenCanvas={(content, title) => {
                              setCanvasDataSource(null);
                              setCanvasContent(content);
                              setCanvasTitle(title || 'Canvas');
                            }}
                            onApproved={(content) => {
                              setMessages(prev => [...prev, { id: genId(), role: 'assistant', content, ts: Date.now() }]);
                            }}
                            onRejected={() => {
                              setMessages(prev => [...prev, { id: genId(), role: 'assistant', content: 'Návrh zamítnut. Napište mi, co chcete změnit.', ts: Date.now() }]);
                            }}
                          />
                        ) : (
                          <ActionBadge
                            key={`${message.id}-${idx}`}
                            action={action}
                            onOpenCanvas={(source) => {
                              setCanvasContent(null);
                              setCanvasDataSource(source);
                            }}
                          />
                        )
                      ))}
                    </div>
                  ) : null}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#3C3C3E] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="shrink-0 p-4 border-t border-white/10">
            {pendingImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {pendingImages.map((img, i) => (
                  <div key={img.url} className="relative">
                    <img src={img.url} alt={img.name} className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                    <button
                      onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[#111827] flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 bg-[#1C1C1E] text-[#0A84FF] hover:bg-[#2C2C2E] cursor-pointer"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />

              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Např: Připrav mailing pro nové produkty"
                  rows={1}
                  className="w-full bg-[#1C1C1E] text-white rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50 placeholder-[#8E8E93] text-sm"
                  style={{ ...FF, minHeight: '48px', maxHeight: '120px' }}
                />
              </div>

              <button
                onClick={() => send()}
                disabled={loading || (!input.trim() && pendingImages.length === 0)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  input.trim() || pendingImages.length > 0
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg cursor-pointer'
                    : 'bg-[#2C2C2E] text-[#8E8E93]'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {!isMobile && (canvasContent || canvasDataSource) && (
          <div className="w-[700px] h-full min-h-0 border-l border-white/10 shrink-0 bg-[#1C1C1E]">
            <ContentCanvas
              content={canvasContent || ''}
              title={canvasTitle}
              type={canvasContent ? detectCanvasType(canvasContent) : undefined}
              dataSource={canvasDataSource || undefined}
              onClose={() => { setCanvasContent(null); setCanvasDataSource(null); }}
              onSendToAgent={(prompt) => {
                setInput(prompt);
                setCanvasContent(null);
                setCanvasDataSource(null);
                setTimeout(() => inputRef.current?.focus(), 60);
              }}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {historyOpen && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setHistoryOpen(false)} />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 w-[84vw] max-w-[320px] lg:w-[320px] bg-[#121216] border-r border-white/6"
            >
              <div className="px-4 pt-[max(12px,env(safe-area-inset-top))] pb-4 border-b border-white/6 flex items-center justify-between">
                <div>
                  <p style={FF} className="text-[14px] font-bold text-white">Historie chatů</p>
                  <p style={FF} className="text-[11px] text-white/35">Web operátor</p>
                </div>
                <button onClick={() => setHistoryOpen(false)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto h-[calc(100%-74px)] p-3">
                {chatIndex.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => loadChat(chat.id)}
                    className={`w-full text-left rounded-2xl px-4 py-3 mb-2 transition-colors cursor-pointer ${chat.id === currentChatId ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}
                  >
                    <p style={FF} className="text-[13px] font-bold text-white truncate">{chat.title}</p>
                    <p style={FF} className="text-[11px] text-white/35 mt-1">{new Date(chat.updatedAt).toLocaleDateString('cs-CZ')}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMobile && (canvasContent || canvasDataSource) && (
          <motion.div className="fixed inset-0 z-[60] bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ContentCanvas
              content={canvasContent || ''}
              title={canvasTitle}
              type={canvasContent ? detectCanvasType(canvasContent) : undefined}
              dataSource={canvasDataSource || undefined}
              mobileFullscreen
              onClose={() => { setCanvasContent(null); setCanvasDataSource(null); }}
              onSendToAgent={(prompt) => {
                setInput(prompt);
                setCanvasContent(null);
                setCanvasDataSource(null);
                setTimeout(() => inputRef.current?.focus(), 60);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
