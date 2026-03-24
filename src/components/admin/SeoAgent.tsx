import { useEffect, useRef, useState } from 'react';
import { Search, Send, Plus, MessageSquare, RefreshCw, Copy, Check, Menu, X } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ragChunks?: number;
};

type ChatIndexEntry = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

const MODEL_OPTIONS = [
  { id: 'gemini-3.1-pro-preview', label: 'Pro', color: '#F59E0B' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Lite', color: '#10b981' },
] as const;
type SeoModelId = typeof MODEL_OPTIONS[number]['id'];

const INTRO: Msg = {
  id: 'intro',
  role: 'assistant',
  content: 'Ahoj! Jsem **SEO a obsahový stratég** pro Vividbooks.\n\nPomohu s:\n- SEO briefy a strukturováním landing pages\n- meta title a meta description\n- návrhem H1/H2 osnovy článků\n- search intent a interním prolinkováním\n- zadáním pro marketingového textaře\n\nNapište například: `Připrav SEO brief pro landing page matematiky 2. stupně`.',
  timestamp: new Date(),
};

function genTitle(text: string) {
  const trimmed = text.trim().slice(0, 60);
  return trimmed.length < text.trim().length ? `${trimmed}…` : trimmed;
}

function formatMessage(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/^[-*] (.+)$/gm, '• $1')
    .replace(/\n/g, '<br/>');
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-[#001161]/40 hover:text-[#001161] hover:bg-[#001161]/5"
      style={FF}
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Zkopírováno' : 'Kopírovat'}
    </button>
  );
}

export default function SeoAgent() {
  const [model, setModel] = useState<SeoModelId>('gemini-3.1-pro-preview');
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const [chatTitle, setChatTitle] = useState('');
  const [chatIndex, setChatIndex] = useState<ChatIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  async function loadChatIndex() {
    setIndexLoading(true);
    try {
      const res = await fetch(`${SERVER}/admin/seo-chats`, { headers: AUTH_H });
      const data = await res.json();
      setChatIndex(data.chats || []);
    } catch (e) {
      console.error('[SeoAgent] index error', e);
    } finally {
      setIndexLoading(false);
    }
  }

  async function saveChat(nextMessages: Msg[], nextTitle: string) {
    const realMessages = nextMessages.filter(m => m.id !== 'intro');
    if (realMessages.length === 0) return;
    const serializable = nextMessages.map(m => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    }));
    await fetch(`${SERVER}/admin/seo-chats`, {
      method: 'POST',
      headers: AUTH_H,
      body: JSON.stringify({ id: chatId, title: nextTitle, messages: serializable }),
    });
    await loadChatIndex();
  }

  async function loadChat(entry: ChatIndexEntry) {
    try {
      const res = await fetch(`${SERVER}/admin/seo-chats/${entry.id}`, { headers: AUTH_H });
      const data = await res.json();
      if (!data.chat) return;
      const loaded = (data.chat.messages || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      setMessages(loaded);
      setChatId(entry.id);
      setChatTitle(entry.title);
      setMobileSidebarOpen(false);
    } catch (e) {
      console.error('[SeoAgent] load error', e);
    }
  }

  async function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`${SERVER}/admin/seo-chats/${id}`, { method: 'DELETE', headers: AUTH_H });
    setChatIndex(prev => prev.filter(ch => ch.id !== id));
    if (id === chatId) newChat();
  }

  function newChat() {
    setChatId(crypto.randomUUID());
    setChatTitle('');
    setMessages([{ ...INTRO, timestamp: new Date() }]);
    setInput('');
    setMobileSidebarOpen(false);
  }

  async function sendMessage(text?: string) {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() };
    const nextMessages = [...messages, userMsg];
    const nextTitle = chatTitle || genTitle(content);
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    if (!chatTitle) setChatTitle(nextTitle);

    try {
      const apiMessages = nextMessages
        .filter(m => m.id !== 'intro')
        .map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${SERVER}/admin/seo-agent`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({ messages: apiMessages, productContext: products, model }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Neznámá chyba');
      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
        ragChunks: data.ragChunks || 0,
      };
      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      await saveChat(finalMessages, nextTitle);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Chyba: ${e.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  return (
    <div className="h-full flex bg-[#f7f8fc] overflow-hidden">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative w-[82vw] max-w-[320px] bg-white h-full shadow-2xl flex flex-col">
            <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between">
              <button onClick={newChat} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white text-[13px] font-bold" style={FF}>
                <Plus className="w-4 h-4" /> Nový chat
              </button>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {chatIndex.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => loadChat(entry)}
                  className={`w-full text-left px-3 py-2.5 transition-all cursor-pointer group border-l-2 ${entry.id === chatId ? 'bg-amber-50 border-amber-500' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <div className="flex items-start gap-2 pr-5">
                    <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${entry.id === chatId ? 'text-amber-600' : 'text-[#001161]/25'}`} />
                    <div className="min-w-0 flex-1">
                      <p style={FF} className="text-[12px] font-bold text-[#001161] truncate">{entry.title || 'Nový SEO chat'}</p>
                      <p style={FF} className="text-[10px] text-[#001161]/30 mt-0.5">{new Date(entry.updatedAt).toLocaleDateString('cs-CZ')}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-[300px] shrink-0 border-r border-gray-200 bg-white flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-gray-100">
          <button onClick={newChat} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500 text-white text-[13px] font-bold" style={FF}>
            <Plus className="w-4 h-4" /> Nový SEO chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {indexLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#001161]/30 animate-spin" />
              <span style={FF} className="text-[11px] text-[#001161]/30">Načítám...</span>
            </div>
          ) : chatIndex.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 gap-2">
              <MessageSquare className="w-6 h-6 text-[#001161]/15" />
              <p style={FF} className="text-[11px] text-[#001161]/30 text-center">Zatím žádné uložené SEO chaty</p>
            </div>
          ) : (
            chatIndex.map(entry => (
              <button
                key={entry.id}
                onClick={() => loadChat(entry)}
                className={`w-full text-left px-3 py-2.5 transition-all cursor-pointer group border-l-2 ${entry.id === chatId ? 'bg-amber-50 border-amber-500' : 'border-transparent hover:bg-gray-50'}`}
              >
                <div className="flex items-start gap-2 pr-5">
                  <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${entry.id === chatId ? 'text-amber-600' : 'text-[#001161]/25'}`} />
                  <div className="min-w-0 flex-1">
                    <p style={FF} className={`text-[12px] font-bold truncate ${entry.id === chatId ? 'text-amber-700' : 'text-[#001161]/80'}`}>{entry.title || 'Nový SEO chat'}</p>
                    <p style={FF} className="text-[10px] text-[#001161]/30 mt-0.5">{new Date(entry.updatedAt).toLocaleDateString('cs-CZ')} · {Math.floor(entry.messageCount / 2)} zpráv</p>
                  </div>
                  <button onClick={(e) => deleteChat(entry.id, e)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-[#001161]/20 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-3 md:px-5 gap-2 md:gap-3 shrink-0">
          <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <Menu className="w-4 h-4 text-[#001161]/50" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shrink-0">
            <Search className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={FF} className="text-[13px] font-bold text-[#001161] truncate">{chatTitle || 'SEO Agent'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {MODEL_OPTIONS.map(m => {
                const active = model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    title={m.id}
                    style={{ ...FF, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '1px 6px', borderRadius: 999, background: active ? m.color : 'rgba(0,17,97,0.07)', color: active ? '#fff' : 'rgba(0,17,97,0.35)' }}
                  >
                    {m.label}
                  </button>
                );
              })}
              <span style={{ ...FF, fontSize: 9, color: 'rgba(0,17,97,0.28)', marginLeft: 2 }}>· SEO briefy</span>
            </div>
          </div>
          <button onClick={newChat} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#001161]/40 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer" style={FF}>
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nový</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 md:py-5 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Search className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-[78%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div className={`rounded-[18px] px-4 py-3 ${msg.role === 'user' ? 'bg-[#001161] text-white rounded-tr-[6px] ml-auto' : 'bg-white border border-gray-100 shadow-sm rounded-tl-[6px]'}`}>
                  {msg.role === 'user' ? (
                    <p style={FF} className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div style={FF} className="text-[14px] text-[#001161]/85 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  )}
                </div>
                <div className={`flex items-center gap-2 mt-1 px-1 flex-wrap ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <span style={FF} className="text-[10px] text-[#001161]/25">{msg.timestamp.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.role === 'assistant' && msg.id !== 'intro' && <CopyButton text={msg.content} />}
                  {msg.ragChunks ? <span style={FF} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">RAG {msg.ragChunks}</span> : null}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-[#001161] flex items-center justify-center shrink-0 mt-0.5">
                  <span style={FF} className="text-white text-[10px] font-bold">VY</span>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shrink-0 mt-0.5">
                <Search className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-[18px] rounded-tl-[6px] px-4 py-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                  <span style={FF} className="text-[13px] text-[#001161]/50">Připravuji brief...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t border-gray-200 px-3 md:px-5 py-3 md:py-4 shrink-0">
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
                placeholder="Popište SEO nebo obsahový úkol..."
                rows={1}
                disabled={loading}
                className="w-full resize-none rounded-[14px] border border-gray-200 bg-[#f7f8fc] px-4 py-3 text-[14px] text-[#001161] placeholder-[#001161]/30 focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all disabled:opacity-60"
                style={{ ...FF, minHeight: '48px', maxHeight: '160px' }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shadow-[0_4px_12px_rgba(245,158,11,0.35)]"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p style={FF} className="hidden md:block text-[10px] text-[#001161]/25 mt-2 text-center">
            SEO agent připravuje briefy, metadata a strukturu obsahu. Finální copy může převzít marketing specialista.
          </p>
        </div>
      </div>
    </div>
  );
}
