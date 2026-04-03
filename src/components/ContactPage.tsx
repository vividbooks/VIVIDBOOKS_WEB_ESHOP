import React, { useState, useRef, useEffect } from 'react';
import { SEOHead } from './SEOHead';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Send, Bot, User, Loader2, Sparkles, ShoppingCart, Calendar, FileText, Rss, ExternalLink, Mail } from 'lucide-react';
import imgVitekSkop from '../assets/team/vitek-skop.png';
import imgFrantisekCab from '../assets/team/frantisek-cab.png';
import { CONTACT_REPRESENTATIVES } from '../data/contactRepresentatives';
import { openCookieSettings } from '@/lib/cookieConsentStorage';

/* ─── Obchodní zástupci ─────────────────────────────────────────── */
const REPRESENTATIVES = CONTACT_REPRESENTATIVES;

/* ─── Chyby v materiálech (redakce / obsah) ───────────────────────── */
/** cropScale = přiblížení ve kruhovém výřezu (1 = bez zoomu; +100 % → 2, +40 % → 1,4) */
const EDITORIAL_CONTACTS = [
  {
    id: 'vitek',
    name: 'Vítek Škop',
    email: 'vitek@vividbooks.com',
    phone: '+420\u00a0728\u00a0417\u00a0279',
    photo: imgVitekSkop,
    cropScale: 2,
    /** nižší % = víc horní části snímku (celá hlava); translateY posune bitmapu dolů v kruhu */
    /** kompromis mezi „moc dole“ (22px) a „moc nahoře“ (−18px) */
    objectPositionY: '36%',
    nudgeY: '8px',
  },
  {
    id: 'frantisek',
    name: 'František Cáb',
    email: 'frantisek@vividbooks.com',
    photo: imgFrantisekCab,
    cropScale: 1.4,
    objectPositionY: '34%',
    nudgeY: '16px',
  },
] as const;

/* ─── Distributoři ─────────────────────────────────────────────── */
const DISTRIBUTORS = [
  {
    id: 1,
    name: 'Baar Group s.r.o.',
    address: 'Hradská 506',
    city: '747 64  Velká Polom',
    phone: '+420 596 615 290',
    email: 'kancelar@baargroup.cz',
    logoColor: '#1A73E8',
    logoText: 'Baar\nGroup',
  },
  {
    id: 2,
    name: 'ABC učebnice',
    address: 'Menšíkova 1154',
    city: '383 01 Prachatice',
    phone: '+420 388 314 136',
    email: 'info@abcucebnice.cz',
    logoColor: '#2E7D32',
    logoText: 'ABC\nučebnice',
  },
  {
    id: 3,
    name: 'Učebnice Vaníček',
    address: 'Bohunická 52',
    city: '619 00 Brno - Horní Heršpice',
    phone: '+420 547 232 504',
    email: 'info@ucebnicevanicek.cz',
    logoColor: '#E53935',
    logoText: 'Vaníček',
  },
  {
    id: 4,
    name: 'ALBRA',
    address: 'Havlíčkova 197',
    city: '250 82 Úvaly',
    phone: '+420 281 980 201',
    email: 'uvaly@albra.cz',
    logoColor: '#FF6F00',
    logoText: 'ALBRA',
  },
  {
    id: 5,
    name: 'ANSA knihy',
    address: 'Pod Šternberkem 306',
    city: '763 02 Zlín 4',
    phone: '+420 577 018 073',
    email: 'ucebnice@ansa.cz',
    logoColor: '#1565C0',
    logoText: 'ANSA\nknihy',
  },
  {
    id: 6,
    name: 'Poprokan',
    address: 'Menšíkova 1154',
    city: '383 01 Prachatice',
    phone: '+420 388 314 136',
    email: 'kinstova@poprokan.cz',
    logoColor: '#E65100',
    logoText: 'POPROKAN',
  },
  {
    id: 7,
    name: 'Sevt',
    address: 'Pekařová 4',
    city: '181 06 Praha 8 - Bohnice',
    phone: '+420 283 090 354',
    email: 'objednavky@sevt.cz',
    logoColor: '#1976D2',
    logoText: 'SEVT',
  },
  {
    id: 8,
    name: 'Učebnice Vitoul',
    address: 'Nová Ves 5',
    city: '783 21 Litovel',
    phone: '+420 604 704 922',
    email: 'vitoul@javidis.cz',
    logoColor: '#6A1B9A',
    logoText: 'VITOUL',
  },
];

/* ─── Rep karta ─────────────────────────────────────────────────── */
function RepCard({ rep }: { rep: typeof REPRESENTATIVES[0] }) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div
        className="w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-white mb-1 flex-shrink-0"
        style={{ boxShadow: '0 8px 24px rgba(0,17,97,0.13)' }}
      >
        <ImageWithFallback
          src={rep.photo}
          alt={rep.name}
          className="w-full h-full object-cover object-top"
        />
      </div>

      <h3
        className="text-[#001161] text-[17px] font-bold leading-tight"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.name}
      </h3>

      <a
        href={`mailto:${rep.email}`}
        className="text-[#4B48CC] text-[13px] underline hover:text-[#7C3AED] transition-colors"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.email}
      </a>

      <p
        className="text-[#001161] text-[13px]"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.phone}
      </p>

      <p
        className="text-[#001161]/55 text-[12px] leading-[1.5] max-w-[190px]"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {rep.regions}
      </p>
    </div>
  );
}

function EditorialContactCard({ contact }: { contact: (typeof EDITORIAL_CONTACTS)[number] }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 w-[220px]">
      <div
        className="w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-white mb-1 flex-shrink-0"
        style={{ boxShadow: '0 8px 24px rgba(0,17,97,0.13)' }}
      >
        <ImageWithFallback
          src={contact.photo}
          alt={contact.name}
          className="w-full h-full max-w-none max-h-none object-cover"
          style={{
            objectPosition: `center ${contact.objectPositionY}`,
            transform: `scale(${contact.cropScale}) translateY(${contact.nudgeY})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
      <h3
        className="text-[#001161] text-[17px] font-bold leading-tight"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {contact.name}
      </h3>
      <a
        href={`mailto:${contact.email}`}
        className="text-[#4B48CC] text-[13px] underline hover:text-[#7C3AED] transition-colors break-all"
        style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
      >
        {contact.email}
      </a>
      {'phone' in contact && contact.phone ? (
        <p className="text-[#001161] text-[13px]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
          {contact.phone}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Distributor karta ─────────────────────────────────────────── */
function DistributorCard({ dist }: { dist: typeof DISTRIBUTORS[0] }) {
  const ff = "'Fenomen Sans', sans-serif";
  return (
    <div className="flex flex-col gap-1.5">
      <p
        className="text-[#001161] text-[15px] font-bold"
        style={{ fontFamily: ff }}
      >
        {dist.name}
      </p>
      <p
        className="text-[#001161]/70 text-[13px]"
        style={{ fontFamily: ff }}
      >
        {dist.address}
      </p>
      <p
        className="text-[#001161]/70 text-[13px]"
        style={{ fontFamily: ff }}
      >
        {dist.city}
      </p>
      <p
        className="text-[#001161]/70 text-[13px]"
        style={{ fontFamily: ff }}
      >
        {dist.phone}
      </p>
      <a
        href={`mailto:${dist.email}`}
        className="text-[#4B48CC] text-[13px] underline hover:text-[#7C3AED] transition-colors"
        style={{ fontFamily: ff }}
      >
        {dist.email}
      </a>
    </div>
  );
}

/* ─── AI Chat ───────────────────────────────────────────────────── */
const ff = "'Fenomen Sans', sans-serif";

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: { source?: string; sourceId?: string; title?: string; category?: string; score: number }[];
}

const SUGGESTIONS = [
  'Jaké předměty Vividbooks pokrývá?',
  'Jak funguje zkušební přístup?',
  'Kolik stojí licence pro školu?',
  'Jak probíhá objednávka pro školu?',
];

// ── Source link helper for RAG responses ─────────────────────────────────
const SOURCE_LINK_CONFIG: Record<string, { label: string; icon: any; color: string; urlFn: (id: string) => string }> = {
  produkty: { label: 'Koupit / zobrazit', icon: ShoppingCart, color: '#7C3AED', urlFn: id => `/produkt/${id}` },
  webinare: { label: 'Detail webináře',    icon: Calendar,     color: '#0ea5e9', urlFn: id => `/webinar/${id}` },
  blog:     { label: 'Přečíst článek',     icon: FileText,     color: '#001161', urlFn: id => `/blog/${id}`    },
  novinky:  { label: 'Číst novinku',       icon: Rss,          color: '#ff6a35', urlFn: id => `/novinky/${id}` },
};

function ChatSourceLinks({ sources }: { sources?: any[] }) {
  if (!sources?.length) return null;
  const actions = sources
    .map(s => {
      const cfg = SOURCE_LINK_CONFIG[s.source ?? ''];
      if (!cfg || !s.sourceId) return null;
      return { ...cfg, url: cfg.urlFn(s.sourceId), title: s.title || cfg.label, score: s.score };
    })
    .filter(Boolean) as Array<{ url: string; label: string; icon: any; color: string; title: string; score: number }>;

  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
      {actions.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-[11px] font-bold transition-opacity hover:opacity-80"
          style={{ background: a.color, fontFamily: "'Fenomen Sans', sans-serif" }}
        >
          <a.icon className="w-3 h-3" />
          {a.title}
          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
        </a>
      ))}
    </div>
  );
}

// Avatary členů týmu — zobrazujeme střídavě
const TEAM_AVATARS = [
  { name: 'Gabriela', photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/68499506e61fe43631528e42_gabriela-vividbooks.avif' },
  { name: 'Iveta',    photo: 'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0f591597464fe410a0_obchodni-zastupce-vividbooks-iveta-fiserova.webp' },
];

function TeamAvatar({ idx = 0 }: { idx?: number }) {
  const member = TEAM_AVATARS[idx % TEAM_AVATARS.length];
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white flex-shrink-0" style={{ boxShadow: '0 2px 8px rgba(0,17,97,0.15)' }}>
      <img src={member.photo} alt={member.name} className="w-full h-full object-cover object-top" />
    </div>
  );
}

function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarIdx, setAvatarIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/rag/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ question: q, topK: 5 }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chyba serveru');
      setAvatarIdx(prev => (prev + 1) % TEAM_AVATARS.length);
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer, sources: data.sources }]);
    } catch (e: any) {
      console.error('[AiChat] error:', e);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Omlouváme se, teď nevíme. Napište nám na hello@vividbooks.com nebo zavolejte na +420 602 227 674.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="bg-white rounded-[24px] overflow-hidden" style={{ boxShadow: '0 4px 32px rgba(0,17,97,0.10)', border: '1px solid rgba(0,17,97,0.07)' }}>

      {/* Header — vypadá jako messenger záhlaví */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#001161]/7 bg-white">
        {/* Skupinový avatar — vrstvené fotky */}
        <div className="relative w-11 h-8 flex-shrink-0">
          <div className="absolute left-0 top-0 w-8 h-8 rounded-full overflow-hidden border-2 border-white" style={{ boxShadow: '0 1px 4px rgba(0,17,97,0.15)' }}>
            <img src={TEAM_AVATARS[0].photo} alt="Gabriela" className="w-full h-full object-cover object-top" />
          </div>
          <div className="absolute left-4 top-0 w-8 h-8 rounded-full overflow-hidden border-2 border-white" style={{ boxShadow: '0 1px 4px rgba(0,17,97,0.15)' }}>
            <img src={TEAM_AVATARS[1].photo} alt="Iveta" className="w-full h-full object-cover object-top" />
          </div>
        </div>

        <div className="ml-2">
          <p className="text-[#001161] text-[15px] font-bold leading-tight" style={{ fontFamily: ff }}>
            {'Tým Vividbooks'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
            <span className="text-[#001161]/45 text-[12px]" style={{ fontFamily: ff }}>
              {'Obvykle odpovídáme do pár minut'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="min-h-[260px] max-h-[400px] overflow-y-auto px-5 py-5 flex flex-col gap-3 bg-[#F7F8FC]">

        {/* Uvítací zpráva od týmu */}
        <div className="flex gap-2.5 items-end">
          <TeamAvatar idx={0} />
          <div className="flex flex-col gap-1 max-w-[75%]">
            <span className="text-[11px] text-[#001161]/40 ml-1" style={{ fontFamily: ff }}>Gabriela</span>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm text-[14px] text-[#001161] leading-relaxed" style={{ fontFamily: ff, boxShadow: '0 1px 4px rgba(0,17,97,0.07)' }}>
              {'Ahoj! 👋 Napište nám, rádi odpovíme na jakýkoliv dotaz o Vividbooks.'}
            </div>
          </div>
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-1 ml-11">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="px-3.5 py-1.5 bg-white border border-[#001161]/12 rounded-full text-[13px] text-[#001161]/65 hover:border-[#4B48CC] hover:text-[#4B48CC] transition-colors cursor-pointer"
                style={{ fontFamily: ff, boxShadow: '0 1px 3px rgba(0,17,97,0.06)' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 items-end ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role === 'assistant' && <TeamAvatar idx={avatarIdx} />}
            <div className={`flex flex-col gap-1 max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'assistant' && (
                <span className="text-[11px] text-[#001161]/40 ml-1" style={{ fontFamily: ff }}>
                  {TEAM_AVATARS[avatarIdx % TEAM_AVATARS.length].name}
                </span>
              )}
              <div
                className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#4B48CC] text-white rounded-br-sm'
                    : 'bg-white text-[#001161] rounded-bl-sm'
                }`}
                style={{ fontFamily: ff, boxShadow: '0 1px 4px rgba(0,17,97,0.07)' }}
              >
                {msg.text}
              </div>
              {msg.role === 'assistant' && <ChatSourceLinks sources={msg.sources} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-end">
            <TeamAvatar idx={avatarIdx} />
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5" style={{ boxShadow: '0 1px 4px rgba(0,17,97,0.07)' }}>
              <span className="w-2 h-2 rounded-full bg-[#001161]/25 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#001161]/25 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#001161]/25 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 px-4 py-3 border-t border-[#001161]/7 bg-white"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={'Napi\u0161te zprávu\u2026'}
          disabled={loading}
          className="flex-1 bg-[#F7F8FC] rounded-full px-4 py-2.5 text-[14px] text-[#001161] placeholder:text-[#001161]/30 border border-[#001161]/8 focus:border-[#4B48CC] focus:outline-none transition-colors disabled:opacity-50"
          style={{ fontFamily: ff }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-full bg-[#4B48CC] hover:bg-[#3d3ab5] disabled:opacity-35 flex items-center justify-center transition-all cursor-pointer active:scale-95 flex-shrink-0"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </form>
    </div>
  );
}

/* ─── Hlavní stránka ─────────────────────────────────────────────── */
export function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Kontakt"
        path="/kontakt"
        description="Kontaktujte Vividbooks: telefon +420 602 227 674, e-mail hello@vividbooks.com. Obchodní zástupci po krajích, redakce a distribuce."
      />

      {/* ══ SEKCE 0: AI Chat ══ */}
      <section className="max-w-3xl mx-auto px-6 pt-14 pb-2">
        <div className="text-center mb-8">
          <p
            className="text-[#001161] text-[26px] font-normal mb-1"
            style={{ fontFamily: ff }}
          >
            {'Máte dotazy? Jsme tu pro vás.'}
          </p>
          <a
            href="mailto:hello@vividbooks.com"
            className="inline-flex items-center justify-center gap-2.5 text-[#001161] text-[26px] sm:text-[30px] font-black mb-3 hover:text-[#4B48CC] transition-colors break-all sm:break-normal"
            style={{ fontFamily: ff }}
          >
            <Mail className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" aria-hidden />
            <span>hello@vividbooks.com</span>
          </a>
          <h1
            className="text-[#001161] text-[28px] sm:text-[32px] font-black"
            style={{ fontFamily: ff }}
          >
            {'Zavolejte: +420\u00a0602\u00a0227\u00a0674'}
          </h1>
        </div>

        {/* Štítek "Jsme online" těsně nad chatem */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="w-2 h-2 rounded-full bg-[#4ade80] flex-shrink-0" />
          <span
            className="text-[#001161]/50 text-[13px] font-semibold tracking-widest uppercase"
            style={{ fontFamily: ff }}
          >
            {'Jsme online'}
          </span>
        </div>

        <AiChat />
      </section>

      {/* Oddělovač */}
      <div className="border-t border-[#001161]/8 mx-6 mt-14" />

      {/* ══ SEKCE 1: Hero + Obchodní zástupci ══ */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-20">

        {/* Nadpis sekce */}
        <p
          className="text-[#001161] text-[15px] font-semibold text-center mb-10 tracking-wide"
          style={{ fontFamily: ff }}
        >
          Naši obchodní zástupci
        </p>

        {/* Grid — 4 nahoře */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-12 mb-12">
          {REPRESENTATIVES.slice(0, 4).map(rep => (
            <RepCard key={rep.id} rep={rep} />
          ))}
        </div>

        {/* 2 dole — centrovaně */}
        <div className="flex justify-center gap-12 flex-wrap">
          {REPRESENTATIVES.slice(4).map(rep => (
            <div key={rep.id} className="w-[220px]">
              <RepCard rep={rep} />
            </div>
          ))}
        </div>

        <div className="border-t border-[#001161]/10 pt-14 mt-14">
          <p
            className="text-[#001161] text-[15px] font-semibold text-center mb-3 tracking-wide max-w-[520px] mx-auto leading-snug"
            style={{ fontFamily: ff }}
          >
            {'Na\u0161li jste chybu v na\u0161ich materi\xe1lech? Napi\u0161te n\xe1m:'}
          </p>
          <p
            className="text-[#001161]/70 text-[14px] text-center max-w-[560px] mx-auto leading-relaxed mb-10 px-1"
            style={{ fontFamily: ff }}
          >
            {'Chyby v online materi\xe1lech opravujeme ihned \u2014 je to na\u0161e priorita.'}
          </p>
          <div className="flex justify-center gap-12 md:gap-20 flex-wrap">
            {EDITORIAL_CONTACTS.map((c) => (
              <EditorialContactCard key={c.id} contact={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Oddělovač */}
      <div className="border-t border-[#001161]/8 mx-6" />

      {/* ══ SEKCE 2: Distribuce tištěných materiálů ══ */}
      <section className="max-w-5xl mx-auto px-6 py-16 pb-24">
        <p
          className="text-[#001161] text-[15px] font-semibold text-center mb-12 tracking-wide"
          style={{ fontFamily: ff }}
        >
          Distribuce tište{'n'}ých materiálů
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-12">
          {DISTRIBUTORS.map(dist => (
            <DistributorCard key={dist.id} dist={dist} />
          ))}
        </div>

        <p className="mt-14 text-center">
          <button
            type="button"
            onClick={() => openCookieSettings()}
            className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/60 underline underline-offset-2 hover:text-[#001161]"
          >
            {'Nastavení cookies'}
          </button>
        </p>
      </section>
    </div>
  );
}