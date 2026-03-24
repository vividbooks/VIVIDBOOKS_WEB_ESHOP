import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router';
import {
  Radio, CheckCircle, AlertCircle, Clock,
  Play, Mail, Lock, Send, MessageCircle, HelpCircle, Smile,
} from 'lucide-react';
import logoPaths from '../imports/svg-fupfguvmdt';
import type { Webinar } from '../data/webinars';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = "'Fenomen Sans', sans-serif";
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🙌'];

/* ─── Types ─────────────────────────────────────────────────────── */
interface ChatMsg {
  id: string; name: string; text: string;
  type: 'chat' | 'qa'; isAdmin?: boolean;
  ts: string; reactions: Record<string, number>;
}
interface FloatingEmoji { id: string; emoji: string; x: number; y: number; }
type LiveStatus = 'upcoming' | 'live' | 'ended';
type ChatTab = 'chat' | 'qa';

/* ─── Helpers ───────────────────────────────────────────────────── */
function getWebinarDate(w: Webinar): Date {
  const [h, m] = (w.time || '18:00').split(':').map(Number);
  return new Date(w.year, (w.monthNum || 1) - 1, w.day || 1, h || 18, m || 0);
}
function getLiveStatus(w: Webinar): LiveStatus {
  const diff = (Date.now() - getWebinarDate(w).getTime()) / 60000;
  if (diff < -30) return 'upcoming';
  if (diff < 150) return 'live';
  return 'ended';
}
function extractYoutubeId(url: string): string | null {
  const pats = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of pats) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
function tsLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}
function avatarColor(name: string) {
  const colors = ['#7C3AED', '#DB2777', '#059669', '#D97706', '#2563EB', '#DC2626', '#0891B2'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

/* ─── Logo ──────────────────────────────────────────────────────── */
function VividbooksLogo() {
  const W = 72;
  const byW = Math.round(1027.31 * (W / 1786.62) * 1.1);
  return (
    <div className="flex flex-col items-start">
      <svg viewBox="0 0 1786.62 869.93" fill="none" style={{ width: W, height: 'auto' }}>
        {['p299c6b00','p3cc4870','p98d9300','pf524b00','p26e2d80','p15998cf0','p1bd3b900','p19a24c00','p34d64300','p396dedf0'].map(k => (
          <path key={k} d={(logoPaths as any)[k]} fill="#001161" />
        ))}
      </svg>
      <svg viewBox="0 0 1027.31 180.529" fill="none" style={{ width: byW, height: 'auto', marginTop: 2 }}>
        {['p26ef8900','p30e25000','p3a0e6400','p203e8600','p3250b400','p27a1eb00','p3f809700','p1c9b900','p3b78df00'].map(k => (
          <path key={k} d={(logoPaths as any)[k]} fill="#001161" />
        ))}
      </svg>
    </div>
  );
}

/* ─── Floating emoji overlay (fixed — viditelné přes celou obrazovku) ── */
function FloatingEmojiOverlay({ items }: { items: FloatingEmoji[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      <AnimatePresence>
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 1, scale: 0.7, x: item.x, y: item.y }}
            animate={{ opacity: 0, scale: 1.6, x: item.x + (Math.random() - 0.5) * 30, y: item.y - 320 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ position: 'absolute', top: 0, left: 0, fontSize: 36, lineHeight: 1, userSelect: 'none' }}
          >
            {item.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Countdown ─────────────────────────────────────────────────── */
function Countdown({ target }: { target: Date }) {
  const calc = () => {
    const d = Math.max(0, target.getTime() - Date.now());
    return { h: Math.floor(d / 3600000), m: Math.floor((d % 3600000) / 60000), s: Math.floor((d % 60000) / 1000) };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex items-end justify-center gap-5">
      {[{ v: t.h, l: 'hodin' }, { v: t.m, l: 'minut' }, { v: t.s, l: 'sekund' }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center">
          <div className="text-[52px] font-black tabular-nums text-[#001161]" style={{ fontFamily: FF }}>{pad(v)}</div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#001161]/45" style={{ fontFamily: FF }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Check-in form ─────────────────────────────────────────────── */
function CheckInForm({ webinar, onSuccess }: { webinar: Webinar; onSuccess: (name: string, email: string) => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try { const s = localStorage.getItem('vvb_identity'); if (s) { const p = JSON.parse(s); if (p.email) setEmail(p.email); } } catch {}
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!email.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${SERVER}/webinar-checkin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ webinarId: webinar.id, email: email.trim(), webinarSlug: webinar.slug || webinar.id }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'E-mail nebyl nalezen.');
      else {
        let name = '';
        try { const s = localStorage.getItem('vvb_identity'); if (s) name = JSON.parse(s).name || ''; } catch {}
        onSuccess(name, email.trim());
        localStorage.setItem('vvb_checkin', JSON.stringify({ email: email.trim(), webinarId: webinar.id }));
      }
    } catch { setError('Nepoda\u0159ilo se ov\u011b\u0159it registraci.'); }
    finally { setLoading(false); }
  };
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px]">
        <div className="bg-white rounded-[28px] border border-[#001161]/8 shadow-xl p-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#001161]/8 mx-auto mb-5">
            <Lock className="w-6 h-6 text-[#001161]" />
          </div>
          <h2 className="text-center text-[22px] font-bold text-[#001161] mb-2" style={{ fontFamily: FF }}>{'Ov\u011b\u0159te registraci'}</h2>
          <p className="text-center text-[14px] text-[#001161]/55 mb-7" style={{ fontFamily: FF }}>{'Zadejte e-mail, se kter\u00fdm jste se registrovali.'}</p>
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#001161]/30" />
              <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder={'Registra\u010dn\u00ed e-mail'}
                className="w-full pl-11 pr-4 py-3.5 bg-[#F0F2F8] rounded-[14px] text-[15px] text-[#001161] outline-none border border-transparent focus:border-[#001161]/20 focus:bg-white transition-all"
                style={{ fontFamily: FF }} />
            </div>
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-[13px] text-red-600" style={{ fontFamily: FF }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <button type="submit" disabled={loading || !email.trim()}
              className="w-full py-4 rounded-[14px] font-bold text-[15px] text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] transition-all"
              style={{ fontFamily: FF, background: '#001161' }}>
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{'Ov\u011b\u0159uji\u2026'}</> : <><Play className="w-4 h-4" />{'Vstoupit na stream'}</>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── YouTube player ────────────────────────────────────────────── */
function YoutubePlayer({ videoId }: { videoId: string }) {
  return (
    <div className="relative w-full h-full rounded-[16px] overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
        className="absolute inset-0 w-full h-full" frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
      />
    </div>
  );
}

/* ─── No-video placeholder ──────────────────────────────────────── */
function NoVideoPlaceholder({ webinar }: { webinar: Webinar }) {
  return (
    <div className="w-full h-full rounded-[16px] bg-[#001161] flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
        <Radio className="w-8 h-8 text-white animate-pulse" />
      </div>
      <div>
        <p className="text-white font-bold text-[20px] mb-2" style={{ fontFamily: FF }}>{'Webinář právě probíhá'}</p>
        <p className="text-white/55 text-[14px]" style={{ fontFamily: FF }}>
          {'\u017div\u00e9 video nen\u00ed na str\u00e1nce vlo\u017een\u00e9 \u2014 pou\u017eijte odkaz k p\u0159ipojen\u00ed n\u00ed\u017ee.'}
        </p>
        {webinar.zoomLink && (
          <a href={webinar.zoomLink} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 bg-[#FF8C00] hover:bg-[#e67d00] text-white font-bold text-[15px] px-7 py-3.5 rounded-full transition-all hover:scale-105 no-underline"
            style={{ fontFamily: FF }}>{'P\u0159ipojit se p\u0159es Zoom'}</a>
        )}
      </div>
    </div>
  );
}

/* ─── Chat panel ────────────────────────────────────────────────── */
function ChatPanel({ webinarId, myName: initName, isPreview }: { webinarId: string; myName: string; isPreview: boolean }) {
  const [tab, setTab] = useState<ChatTab>('chat');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [myName, setMyName] = useState(initName || '');
  const [nameInput, setNameInput] = useState(initName || '');
  const [nameLocked, setNameLocked] = useState(!!initName);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMsgs = messages.filter(m => m.type === 'chat');
  const qaMsgs = messages.filter(m => m.type === 'qa');
  const visible = tab === 'chat' ? chatMsgs : qaMsgs;
  const unanswered = qaMsgs.filter(m => !m.answered).length;

  const INLINE_EMOJIS = ['👍', '❤️', '😂', '🙌', '🎉', '🤔', '💡', '🔥'];

  useEffect(() => {
    if (!isPreview || messages.length > 0) return;
    setMessages([
      { id: 'd1', name: 'Lucie Nov\u00e1\u010dkov\u00e1', text: 'Dobr\u00fd den, t\u011b\u0161\u00edm se! 😊', type: 'chat', ts: new Date(Date.now() - 300000).toISOString(), reactions: { '👍': 3 } },
      { id: 'd2', name: 'Vividbooks', text: 'V\u00edtejte! Za\u010d\u00edn\u00e1me za p\u00e1r minut.', type: 'chat', isAdmin: true, ts: new Date(Date.now() - 240000).toISOString(), reactions: {} },
      { id: 'd3', name: 'Petra Hor\u00e1\u010dkov\u00e1', text: 'Skv\u011bl\u00fd obsah, d\u00edky!', type: 'chat', ts: new Date(Date.now() - 180000).toISOString(), reactions: { '❤️': 4 } },
      { id: 'd4', name: 'Vividbooks', text: 'Z\u00e1znam bude do 48 hodin na va\u0161em profilu. 📹', type: 'chat', isAdmin: true, ts: new Date(Date.now() - 60000).toISOString(), reactions: {} },
      { id: 'd5', name: 'Tom\u00e1\u0161 Kr\u00e1l', text: 'Bude z\u00e1znam k dispozici i pozd\u011bji?', type: 'qa', ts: new Date(Date.now() - 120000).toISOString(), reactions: { '👍': 5 } },
    ]);
  }, [isPreview]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER}/webinar-chat/${webinarId}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); }
    } catch {}
  }, [webinarId]);

  useEffect(() => {
    if (!isPreview) fetchMessages();
    const id = setInterval(() => { if (!isPreview) fetchMessages(); }, 3000);
    return () => clearInterval(id);
  }, [fetchMessages, isPreview]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, tab]);

  const lockName = () => {
    if (!nameInput.trim()) return;
    setMyName(nameInput.trim()); setNameLocked(true);
    try { localStorage.setItem('vvb_chat_name', nameInput.trim()); } catch {}
  };
  const sendMsg = async () => {
    if (!text.trim() || !myName) return;
    const msgText = text.trim(); const msgType = tab === 'qa' ? 'qa' : 'chat';
    setText(''); setSending(true);
    setMessages(prev => [...prev, { id: `opt-${Date.now()}`, name: myName, text: msgText, type: msgType, ts: new Date().toISOString(), reactions: {} }]);
    if (!isPreview) {
      try {
        await fetch(`${SERVER}/webinar-chat/${webinarId}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ name: myName, text: msgText, type: msgType }),
        });
        await fetchMessages();
      } catch {}
    }
    setSending(false); inputRef.current?.focus();
  };
  const addReaction = async (msgId: string, emoji: string) => {
    setShowEmojiFor(null);
    setMessages(prev => prev.map(m => m.id !== msgId ? m : { ...m, reactions: { ...m.reactions, [emoji]: (m.reactions[emoji] || 0) + 1 } }));
    if (!isPreview) {
      try {
        await fetch(`${SERVER}/webinar-chat/${webinarId}/react`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ msgId, emoji }),
        });
      } catch {}
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="shrink-0 flex border-b border-[#001161]/8">
        <button onClick={() => setTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-bold border-b-2 transition-all ${tab === 'chat' ? 'border-[#001161] text-[#001161]' : 'border-transparent text-[#001161]/40 hover:text-[#001161]/70'}`}
          style={{ fontFamily: FF }}>
          <MessageCircle className="w-3.5 h-3.5" />{'Chat'}
          {chatMsgs.length > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'chat' ? 'bg-[#001161] text-white' : 'bg-[#001161]/10 text-[#001161]/50'}`}>{chatMsgs.length}</span>}
        </button>
        <button onClick={() => setTab('qa')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-bold border-b-2 transition-all ${tab === 'qa' ? 'border-[#FF8C00] text-[#FF8C00]' : 'border-transparent text-[#001161]/40 hover:text-[#001161]/70'}`}
          style={{ fontFamily: FF }}>
          <HelpCircle className="w-3.5 h-3.5" />{'Q&A'}
          {unanswered > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#FF8C00] text-white">{unanswered}</span>}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-[#001161]/25">
            {tab === 'chat' ? <><MessageCircle className="w-7 h-7" /><p className="text-[12px]" style={{ fontFamily: FF }}>{'Buďte první!'}</p></> : <><HelpCircle className="w-7 h-7" /><p className="text-[12px]" style={{ fontFamily: FF }}>{'Ptejte se!'}</p></>}
          </div>
        )}
        {visible.map(msg => {
          const isMe = msg.name === myName && !msg.isAdmin;
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                style={{ background: msg.isAdmin ? '#001161' : avatarColor(msg.name) }}>
                {msg.isAdmin ? '⭐' : initials(msg.name)}
              </div>
              <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-[10px] font-bold ${msg.isAdmin ? 'text-[#001161]' : 'text-[#001161]/50'}`} style={{ fontFamily: FF }}>{msg.isAdmin ? `⭐ ${msg.name}` : msg.name}</span>
                  <span className="text-[9px] text-[#001161]/30" style={{ fontFamily: FF }}>{tsLabel(msg.ts)}</span>
                </div>
                <div
                  className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words cursor-pointer
                    ${msg.isAdmin ? 'bg-[#001161] text-white rounded-tl-sm' : isMe ? 'bg-[#7C3AED] text-white rounded-tr-sm' : tab === 'qa' ? 'bg-amber-50 border border-amber-200 text-[#001161] rounded-tl-sm' : 'bg-[#F0F2F8] text-[#001161] rounded-tl-sm'}`}
                  style={{ fontFamily: FF }}
                  onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}>
                  {msg.text}
                </div>
                {Object.keys(msg.reactions).length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {Object.entries(msg.reactions).map(([e, c]) => (
                      <button key={e} onClick={() => addReaction(msg.id, e)} className="flex items-center gap-0.5 bg-white border border-[#001161]/10 rounded-full px-1.5 py-0.5 text-[11px] hover:border-[#001161]/30 transition-all">
                        <span>{e}</span><span className="text-[#001161]/60 font-bold" style={{ fontFamily: FF }}>{c}</span>
                      </button>
                    ))}
                  </div>
                )}
                <AnimatePresence>
                  {showEmojiFor === msg.id && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      className={`flex gap-1 mt-1 bg-white border border-[#001161]/10 rounded-full px-2 py-1 shadow-lg ${isMe ? 'self-end' : 'self-start'}`}>
                      {INLINE_EMOJIS.map(e => (
                        <button key={e} onClick={() => addReaction(msg.id, e)} className="text-[15px] hover:scale-125 transition-transform p-0.5">{e}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Name prompt */}
      {!nameLocked && (
        <div className="shrink-0 border-t border-[#001161]/8 px-3 py-2.5 bg-[#F8F9FC]">
          <p className="text-[11px] font-bold text-[#001161]/50 mb-1.5" style={{ fontFamily: FF }}>{'Vaše jméno v chatu:'}</p>
          <div className="flex gap-2">
            <input value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && lockName()}
              placeholder={'Jméno a příjmení'} autoFocus
              className="flex-1 px-3 py-2 bg-white rounded-xl border border-[#001161]/15 text-[13px] text-[#001161] outline-none focus:border-[#001161]/40"
              style={{ fontFamily: FF }} />
            <button onClick={lockName} disabled={!nameInput.trim()} className="px-3 py-2 bg-[#001161] text-white rounded-xl text-[12px] font-bold disabled:opacity-40 hover:bg-[#001161]/80" style={{ fontFamily: FF }}>{'OK'}</button>
          </div>
        </div>
      )}

      {/* Input */}
      {nameLocked && (
        <div className="shrink-0 border-t border-[#001161]/8 p-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 transition-all ${tab === 'qa' ? 'border-amber-300 bg-amber-50' : 'border-[#001161]/10 bg-[#F0F2F8]'}`}>
            <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              placeholder={tab === 'qa' ? 'Napište dotaz…' : 'Napište zprávu…'}
              className="flex-1 bg-transparent text-[13px] text-[#001161] outline-none placeholder-[#001161]/35"
              style={{ fontFamily: FF }} />
            <button onClick={() => setEmojiOpen(p => !p)} className="p-1.5 text-[#001161]/35 hover:text-[#001161] transition-colors"><Smile className="w-4 h-4" /></button>
            <button onClick={sendMsg} disabled={!text.trim() || sending}
              className={`p-2 rounded-xl transition-all hover:scale-105 disabled:opacity-40 ${tab === 'qa' ? 'bg-[#FF8C00]' : 'bg-[#001161]'} text-white`}>
              <Send className="w-4 h-4" />
            </button>
          </div>
          <AnimatePresence>
            {emojiOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 mt-2 px-1 overflow-hidden">
                {INLINE_EMOJIS.map(e => (
                  <button key={e} onClick={() => { setText(t => t + e); setEmojiOpen(false); inputRef.current?.focus(); }}
                    className="text-[20px] hover:scale-125 transition-transform">{e}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setNameLocked(false)}
            className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[#001161]/30 hover:text-[#001161]/60 transition-colors"
            style={{ fontFamily: FF }}>
            <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: avatarColor(myName) }}>{initials(myName)}</span>
            {myName}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────── */
export function WebinarLivePage({ webinar }: { webinar: Webinar }) {
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';

  const isDevImminent = (() => {
    try {
      const v = localStorage.getItem('vvb_dev_imminent');
      return v === webinar.id || v === webinar.slug;
    } catch { return false; }
  })();

  const [status, setStatus] = useState<LiveStatus>(() =>
    (isPreview || isDevImminent) ? 'live' : getLiveStatus(webinar)
  );
  const [checkedIn, setCheckedIn] = useState(isPreview || isDevImminent);
  const [attendeeName, setAttendeeName] = useState(
    isPreview ? 'Demo (Admin)' : isDevImminent ? 'Dev Admin' : ''
  );
  const [floaters, setFloaters] = useState<FloatingEmoji[]>([]);
  const lastReactionTs = useRef<number>(0);
  const sentReactionIds = useRef<Set<string>>(new Set());

  const youtubeId = extractYoutubeId(webinar.liveUrl || webinar.youtubeUrl || webinar.recordingUrl || '');

  useEffect(() => {
    if (isPreview) return;
    try {
      const s = localStorage.getItem('vvb_checkin');
      if (s) { const d = JSON.parse(s); if (d.webinarId === webinar.id && d.email) setCheckedIn(true); }
      const id = localStorage.getItem('vvb_identity');
      if (id) { const p = JSON.parse(id); if (p.name) setAttendeeName(p.name); }
      // Dev switch: bypass check-in pokud je aktivní
      const devId = localStorage.getItem('vvb_dev_imminent');
      if (devId === webinar.id) { setCheckedIn(true); setAttendeeName('Dev Admin'); }
    } catch {}
  }, [webinar.id, isPreview]);

  useEffect(() => {
    if (isPreview) return;
    const id = setInterval(() => setStatus(getLiveStatus(webinar)), 30000);
    return () => clearInterval(id);
  }, [webinar, isPreview]);

  /* Polling reakcí od serveru každé 2s */
  useEffect(() => {
    if (isPreview || status !== 'live') return;
    const poll = async () => {
      try {
        const res = await fetch(
          `${SERVER}/webinar-reactions/${webinar.id}?since=${lastReactionTs.current}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        if (!res.ok) return;
        const { reactions } = await res.json() as { reactions: { id: string; emoji: string; ts: number }[] };
        if (!reactions?.length) return;
        // Aktualizuj timestamp
        const maxTs = Math.max(...reactions.map(r => r.ts));
        lastReactionTs.current = maxTs;
        // Animuj jen reakce od ostatních (ne vlastní)
        const incoming = reactions.filter(r => !sentReactionIds.current.has(r.id));
        if (!incoming.length) return;
        // Rozmísti je náhodně po celé šířce panelu reakcí (pravý panel = 340px, ale reakce jsou fixed)
        const rightEdge = window.innerWidth;
        const leftEdge = rightEdge - 340;
        incoming.forEach(r => {
          const x = leftEdge + 20 + Math.random() * 300;
          const y = window.innerHeight - 120;
          const id = `fe-poll-${r.id}`;
          setFloaters(prev => [...prev, { id, emoji: r.emoji, x, y }]);
          setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 2600);
        });
      } catch {}
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [webinar.id, isPreview, status]);

  const handleCheckIn = useCallback((name: string, email: string) => {
    setCheckedIn(true); setAttendeeName(name);
  }, []);

  const fireReaction = async (emoji: string, e: React.MouseEvent<HTMLButtonElement>) => {
    // Lokální animace okamžitě
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - 18;
    const cy = rect.top - 10;
    const localId = `fe-local-${Date.now()}-${Math.random()}`;
    setFloaters(prev => [...prev, { id: localId, emoji, x: cx + (Math.random() - 0.5) * 20, y: cy }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== localId)), 2600);

    // Odeslat na server (pokud nejde o preview)
    if (!isPreview) {
      try {
        const res = await fetch(`${SERVER}/webinar-reactions/${webinar.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ emoji }),
        });
        if (res.ok) {
          const { id: serverId } = await res.json();
          // Zapamatuj si ID — polling tuto reakci přeskočí (abychom ji neanimovali 2×)
          if (serverId) {
            sentReactionIds.current.add(serverId);
            setTimeout(() => sentReactionIds.current.delete(serverId), 10000);
          }
        }
      } catch {}
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F6FB' }}>

      {/* Floating emoji overlay — fixed, viditelné přes vše */}
      <FloatingEmojiOverlay items={floaters} />

      {/* ══ UPCOMING / GATE ═══════════════════════════════════════ */}
      {status === 'upcoming' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="bg-white rounded-[28px] border border-[#001161]/8 p-10 text-center w-full max-w-[520px]">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#001161]/40 mb-6" style={{ fontFamily: FF }}>{'Webinář začíná za'}</p>
            <Countdown target={getWebinarDate(webinar)} />
            <p className="text-[14px] text-[#001161]/50 mt-7" style={{ fontFamily: FF }}>{`${webinar.day}. ${webinar.monthName} ${webinar.year} v ${webinar.time}`}</p>
          </div>
          {!checkedIn && <CheckInForm webinar={webinar} onSuccess={handleCheckIn} />}
        </div>
      )}

      {status === 'live' && !checkedIn && (
        <CheckInForm webinar={webinar} onSuccess={handleCheckIn} />
      )}

      {/* ══ LIVE ══════════════════════════════════════════════════ */}
      {status === 'live' && checkedIn && (
        <>
          {/* Video — zabírá vše vlevo */}
          <div className="flex-1 p-4 min-w-0 min-h-0">
            {youtubeId ? <YoutubePlayer videoId={youtubeId} /> : <NoVideoPlaceholder webinar={webinar} />}
          </div>

          {/* Pravý panel */}
          <div className="w-[340px] shrink-0 flex flex-col bg-white border-l border-[#001161]/8 h-full">

            {/* Logo + název webináře */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#001161]/8">
              <VividbooksLogo />
              <div className="mt-4">
                <p className="text-[15px] font-bold text-[#001161] leading-snug" style={{ fontFamily: FF }}>{webinar.title}</p>
                <p className="text-[12px] text-[#001161]/45 mt-1" style={{ fontFamily: FF }}>
                  {`${webinar.day}. ${webinar.monthName} ${webinar.year}`}
                  {webinar.time ? ` · ${webinar.time}` : ''}
                  {webinar.lecturer ? ` · ${webinar.lecturer}` : ''}
                </p>
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel webinarId={webinar.id} myName={attendeeName} isPreview={isPreview} />
            </div>

            {/* Reakce — 4 velká kolečka */}
            <div className="shrink-0 border-t border-[#001161]/8 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#001161]/30 mb-3 text-center" style={{ fontFamily: FF }}>{'Reagujte živě'}</p>
              <div className="flex justify-around items-center">
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={e => fireReaction(emoji, e)}
                    className="flex items-center justify-center w-16 h-16 rounded-full bg-[#F0F2F8] hover:bg-[#E0E4F5] active:scale-90 hover:scale-110 transition-all text-[30px] shadow-sm border-2 border-transparent hover:border-[#001161]/15 select-none"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

      {/* ══ ENDED ═════════════════════════════════════════════════ */}
      {status === 'ended' && (
        <div className="flex-1 flex flex-col gap-4 p-6 overflow-auto">
          <div className="bg-white rounded-[24px] border border-[#001161]/8 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-[#001161] text-[15px]" style={{ fontFamily: FF }}>{'Webinář proběhl úspěšně'}</p>
              <p className="text-[13px] text-[#001161]/50" style={{ fontFamily: FF }}>{youtubeId ? 'Níže najdete záznam.' : 'Záznam bude brzy k dispozici.'}</p>
            </div>
          </div>
          {youtubeId && (
            <div className="relative rounded-[20px] overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
              <iframe src={`https://www.youtube.com/embed/${youtubeId}?rel=0`} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen />
            </div>
          )}
          <div className="text-center pt-2">
            <a href="/webinare" className="inline-flex items-center gap-2 text-[#001161] font-bold text-[14px] hover:underline" style={{ fontFamily: FF }}>{'← Zobrazit další webináře'}</a>
          </div>
        </div>
      )}

    </div>
  );
}