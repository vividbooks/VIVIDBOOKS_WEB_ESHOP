import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, Sparkles, Send, Loader2,
  Rocket, Video, Mail, Newspaper, Megaphone, Share2, MonitorPlay, Trash2,
  Clock, Tag, X, Check, AlertTriangle, Zap, GripVertical, Eye, FileText,
  LayoutGrid, List, GanttChart, Copy, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const F: React.CSSProperties = { fontFamily: "'Fenomen Sans', sans-serif" };

/* ── Types ─────────────────────────────────────────────────────────── */
interface CalEvent {
  id: string;
  type: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  status?: string;
  description?: string;
  tags?: string[];
  sequenceId?: string;
  sequenceOffset?: number;
  linkedResources?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

interface CalSequence {
  id: string;
  title: string;
  anchorDate: string;
  steps: { offset: number; type: string; title: string; description?: string }[];
  createdAt?: string;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/* ── Event type config ────────────────────────────────────────────── */
const EVENT_TYPES: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  product_launch: { label: 'Launch', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: Rocket },
  webinar: { label: 'Webinář', color: 'text-blue-700', bg: 'bg-blue-100', icon: Video },
  email: { label: 'Email', color: 'text-purple-700', bg: 'bg-purple-100', icon: Mail },
  newsletter: { label: 'Newsletter', color: 'text-orange-700', bg: 'bg-orange-100', icon: Newspaper },
  campaign: { label: 'Kampaň', color: 'text-pink-700', bg: 'bg-pink-100', icon: Megaphone },
  social: { label: 'Sociální sítě', color: 'text-cyan-700', bg: 'bg-cyan-100', icon: Share2 },
  ad: { label: 'Reklama', color: 'text-gray-500', bg: 'bg-gray-100', icon: MonitorPlay },
};

const getET = (t: string) => EVENT_TYPES[t] || { label: t, color: 'text-gray-700', bg: 'bg-gray-100', icon: CalIcon };

/* ── Helpers ─────────────────────────────────────────────────────── */
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function startDow(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; } // Mon=0
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}
function dateToCZ(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
}
const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
const DAYS_CZ = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

/* ── Markdown renderer (simple) ──────────────────────────────────── */
function renderMd(text: string): React.ReactNode {
  // Strip out JSON blocks (they get parsed separately into action cards)
  const cleaned = text
    .replace(/`{1,3}json:(?:sequence|event)\s*\n[\s\S]*?\n\s*`{1,3}/g, '')
    .trim();

  const lines = cleaned.split('\n');
  const result: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      result.push(<h4 key={key++} style={F} className="text-[13px] font-bold text-[#001161] mt-3 mb-1">{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      result.push(<h3 key={key++} style={F} className="text-[14px] font-bold text-[#001161] mt-3 mb-1">{line.slice(3)}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      result.push(
        <div key={key++} className="flex gap-1.5 ml-2 text-[12px] text-[#001161]/80 leading-relaxed">
          <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[#7C3AED]" />
          <span dangerouslySetInnerHTML={{ __html: inlineMd(line.slice(2)) }} />
        </div>
      );
    } else if (line.trim() === '') {
      result.push(<div key={key++} className="h-1.5" />);
    } else {
      result.push(<p key={key++} className="text-[12px] text-[#001161]/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />);
    }
  }
  return result;
}

function inlineMd(t: string) {
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-[#001161]">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-purple-50 text-purple-700 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/⚠️/g, '<span class="text-amber-500">⚠️</span>');
}

/* ═══════════════════════════��══════════════════════════════════════════ */
export default function MarketingCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [sequences, setSequences] = useState<CalSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [view, setView] = useState<'month' | 'list'>('month');

  // AI Chat
  const [messages, setMessages] = useState<ChatMsg[]>([{
    id: 'intro', role: 'assistant', timestamp: new Date(),
    content: 'Ahoj! Jsem váš plánovací agent. Pomohu vám naplánovat marketingové aktivity, kampaně a sekvence.\n\n**Co umím:**\n- Navrhnout kompletní launch sekvenci pro nový předmět\n- Naplánovat webinář včetně promo emailů\n- Upozornit na sezónní příležitosti a kolize\n- Vytvořit události přímo do kalendáře\n\nNapište mi, co potřebujete naplánovat.',
  }]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Load data (calendar events + webinars + blog + novinky) ──── */
  const loadData = useCallback(async () => {
    try {
      const [evRes, seqRes, webRes, blogRes, novinkyRes] = await Promise.all([
        fetch(`${SERVER}/admin/calendar/events`, { headers: AUTH }),
        fetch(`${SERVER}/admin/calendar/sequences`, { headers: AUTH }),
        fetch(`${SERVER}/admin/webinare`, { headers: AUTH }),
        fetch(`${SERVER}/admin/blog`, { headers: AUTH }),
        fetch(`${SERVER}/admin/novinky`, { headers: AUTH }),
      ]);

      let calEvents: CalEvent[] = [];
      if (evRes.ok) { const d = await evRes.json(); calEvents = d.events || []; }
      if (seqRes.ok) { const d = await seqRes.json(); setSequences(d.sequences || []); }

      // Merge webinars as calendar events
      if (webRes.ok) {
        const wd = await webRes.json();
        const webinars = wd.items || [];
        const webinarEvents: CalEvent[] = webinars.map((w: any) => {
          const dateStr = w.year && w.monthNum && w.day
            ? `${w.year}-${String(w.monthNum).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`
            : '';
          return {
            id: `wb-${w.id}`,
            type: 'webinar',
            title: w.title || 'Webinář',
            date: dateStr,
            time: w.time || '',
            status: w.isPast ? 'done' : 'planned',
            description: w.subtitle || '',
            tags: ['webinář', w.lecturer || ''].filter(Boolean),
            _source: 'webinar',
            _sourceId: w.id,
          } as CalEvent & { _source: string; _sourceId: string };
        }).filter((e: any) => e.date);
        // Don't duplicate
        const existingIds = new Set(calEvents.map(e => e.id));
        calEvents = [...calEvents, ...webinarEvents.filter((e: any) => !existingIds.has(e.id))];
      }

      // Merge blog posts (published ones with dates)
      if (blogRes.ok) {
        const bd = await blogRes.json();
        const posts = bd.items || [];
        const blogEvents: CalEvent[] = posts
          .filter((p: any) => p.publishedAt || p.createdAt)
          .map((p: any) => {
            const dateStr = (p.publishedAt || p.createdAt || '').slice(0, 10);
            return {
              id: `blog-${p.id}`,
              type: 'newsletter',
              title: `📝 ${p.title || 'Blog post'}`,
              date: dateStr,
              status: p.published ? 'done' : 'planned',
              description: 'Blog článek',
              tags: ['blog'],
              _source: 'blog',
            } as CalEvent & { _source: string };
          })
          .filter((e: any) => e.date && e.date.length === 10);
        const existingIds = new Set(calEvents.map(e => e.id));
        calEvents = [...calEvents, ...blogEvents.filter(e => !existingIds.has(e.id))];
      }

      // Merge novinky
      if (novinkyRes.ok) {
        const nd = await novinkyRes.json();
        const novinky = nd.items || [];
        const novinkyEvents: CalEvent[] = novinky
          .filter((n: any) => n.publishedAt || n.createdAt)
          .map((n: any) => {
            const dateStr = (n.publishedAt || n.createdAt || '').slice(0, 10);
            return {
              id: `novinka-${n.id}`,
              type: 'campaign',
              title: `📰 ${n.title || 'Novinka'}`,
              date: dateStr,
              status: 'done',
              description: 'Novinka',
              tags: ['novinka'],
              _source: 'novinka',
            } as CalEvent & { _source: string };
          })
          .filter((e: any) => e.date && e.date.length === 10);
        const existingIds = new Set(calEvents.map(e => e.id));
        calEvents = [...calEvents, ...novinkyEvents.filter(e => !existingIds.has(e.id))];
      }

      setEvents(calEvents);
    } catch (e: any) {
      console.error('Calendar load error:', e);
      toast.error('Chyba načítání kalendáře');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── CRUD ────────────────────────────────────────────────────────── */
  const createEvent = async (ev: Partial<CalEvent>) => {
    try {
      const res = await fetch(`${SERVER}/admin/calendar/events`, {
        method: 'POST', headers: AUTH, body: JSON.stringify(ev),
      });
      const d = await res.json();
      if (d.success) {
        setEvents(prev => [...prev, d.event]);
        toast.success(`Událost "${d.event.title}" vytvořena`);
        return d.event;
      } else { toast.error(d.error); }
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
  };

  const deleteEvent = async (id: string) => {
    try {
      await fetch(`${SERVER}/admin/calendar/events/${id}`, { method: 'DELETE', headers: AUTH });
      setEvents(prev => prev.filter(e => e.id !== id));
      if (selectedEvent?.id === id) setSelectedEvent(null);
      toast.success('Událost smazána');
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
  };

  const updateEvent = async (id: string, updates: Partial<CalEvent>) => {
    try {
      await fetch(`${SERVER}/admin/calendar/events/${id}`, {
        method: 'PUT', headers: AUTH, body: JSON.stringify(updates),
      });
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      if (selectedEvent?.id === id) setSelectedEvent({ ...selectedEvent, ...updates } as CalEvent);
      toast.success('Aktualizováno');
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
  };

  const bulkCreateEvents = async (newEvents: Partial<CalEvent>[]) => {
    try {
      const res = await fetch(`${SERVER}/admin/calendar/events/bulk`, {
        method: 'POST', headers: AUTH, body: JSON.stringify({ events: newEvents }),
      });
      const d = await res.json();
      if (d.success) {
        setEvents(prev => [...prev, ...d.events]);
        toast.success(`${d.events.length} událostí vytvořeno`);
        return d.events;
      } else { toast.error(d.error); }
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
  };

  const createSequence = async (seq: Partial<CalSequence>, alsoCreateEvents = true) => {
    try {
      const res = await fetch(`${SERVER}/admin/calendar/sequences`, {
        method: 'POST', headers: AUTH, body: JSON.stringify(seq),
      });
      const d = await res.json();
      if (d.success) {
        setSequences(prev => [...prev, d.sequence]);
        if (alsoCreateEvents && seq.steps && seq.anchorDate) {
          const evts = seq.steps.map(step => ({
            type: step.type,
            title: step.title,
            description: step.description || '',
            date: addDays(seq.anchorDate!, step.offset),
            sequenceId: d.sequence.id,
            sequenceOffset: step.offset,
            status: 'planned',
            tags: [seq.title || ''],
          }));
          await bulkCreateEvents(evts);
        }
        toast.success(`Sekvence "${d.sequence.title}" vytvořena`);
        return d.sequence;
      }
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
  };

  /* ── AI Chat ────────────────────────────────────────────────────── */
  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    setChatInput('');
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const apiMessages = [...messages.filter(m => m.id !== 'intro'), userMsg].map(m => ({
        role: m.role, content: m.content,
      }));

      const res = await fetch(`${SERVER}/admin/calendar/agent`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply || 'Bez odpovědi.';
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: 'assistant', content: reply, timestamp: new Date(),
      }]);

      // Parse JSON blocks from reply and offer to create
      parseAndOfferActions(reply);
    } catch (e: any) {
      console.error('Agent error:', e);
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`, role: 'assistant', content: `Chyba: ${e.message}`, timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const [pendingSequence, setPendingSequence] = useState<any>(null);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);

  const parseAndOfferActions = (reply: string) => {
    // Normalize: AI sometimes uses single backtick `json:... instead of triple ```json:...
    // Also handle varying whitespace and newlines around JSON
    const normalized = reply
      .replace(/(?<!`)(`)(json:(?:sequence|event))\s*\n/g, '```$2\n')
      .replace(/\n`(?!``)/g, '\n```');

    // Parse ```json:sequence blocks — support both tight and loose JSON
    const seqMatch = normalized.match(/```json:sequence\s*\n([\s\S]*?)\n\s*```/);
    if (seqMatch) {
      try {
        // Clean up the JSON: remove extra whitespace/newlines that Gemini adds
        const cleanJson = seqMatch[1].replace(/\n\s*\n/g, '\n').trim();
        const seq = JSON.parse(cleanJson);
        setPendingSequence(seq);
      } catch (e) { console.warn('Sequence JSON parse error:', e); }
    }
    // Parse ```json:event blocks
    const eventMatches = [...normalized.matchAll(/```json:event\s*\n([\s\S]*?)\n\s*```/g)];
    if (eventMatches.length > 0) {
      const parsed = eventMatches.map(m => {
        try {
          const cleanJson = m[1].replace(/\n\s*\n/g, '\n').trim();
          return JSON.parse(cleanJson);
        } catch { return null; }
      }).filter(Boolean);
      if (parsed.length > 0) setPendingEvents(parsed);
    }
  };

  const applySequence = async () => {
    if (!pendingSequence) return;
    await createSequence(pendingSequence, true);
    setPendingSequence(null);
  };

  const applyEvents = async () => {
    if (pendingEvents.length === 0) return;
    for (const ev of pendingEvents) { await createEvent({ ...ev, status: 'planned' }); }
    setPendingEvents([]);
  };

  /* ── Month grid data ────────────────────────────────────────────── */
  const todayStr = fmtDate(today);
  const dim = daysInMonth(year, month);
  const sd = startDow(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < sd; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsForDay = (day: number) => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === ds);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  /* ── List view data ─────────────────────────────────────────────── */
  const upcomingEvents = [...events]
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 50);

  /* ══════════════════ RENDER ═══════════════════════════════════════ */
  return (
    <div className="h-full flex bg-[#f7f8fc]">
      {/* ═══ LEFT: Calendar ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-14 px-5 flex items-center gap-3 bg-white border-b border-gray-200 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center">
            <CalIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 style={F} className="text-[15px] font-bold text-[#001161]">Marketing Kalendář</h1>
            <p style={F} className="text-[10px] text-[#001161]/30">{events.length} událostí</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setView('month')}
                className={`p-1.5 rounded-md transition-all ${view === 'month' ? 'bg-white shadow-sm text-[#001161]' : 'text-gray-400'}`}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setView('list')}
                className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-[#001161]' : 'text-gray-400'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <button onClick={() => { setSelectedDate(todayStr); setShowNewModal(true); }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#7C3AED] to-[#9F67F5] text-white text-[12px] font-bold px-3 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
              style={F}>
              <Plus className="w-3.5 h-3.5" />
              Nová událost
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#7C3AED] animate-spin" />
          </div>
        ) : view === 'month' ? (
          /* ── Month View ──────────────────────────────────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                <ChevronLeft className="w-4 h-4 text-[#001161]" />
              </button>
              <h2 style={F} className="text-[16px] font-bold text-[#001161] min-w-[160px] text-center">
                {MONTHS_CZ[month]} {year}
              </h2>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                <ChevronRight className="w-4 h-4 text-[#001161]" />
              </button>
              <button onClick={goToday}
                className="text-[11px] font-bold text-[#7C3AED] hover:bg-purple-50 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                style={F}>
                Dnes
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {DAYS_CZ.map(d => (
                <div key={d} style={F} className="text-center text-[10px] font-bold text-[#001161]/40 py-2 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
              {cells.map((day, i) => {
                if (day === null) return <div key={i} className="border-b border-r border-gray-100 bg-gray-50/50" />;
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = eventsForDay(day);
                const isToday = ds === todayStr;
                const isSelected = ds === selectedDate;
                const isWeekend = (sd + day - 1) % 7 >= 5;

                return (
                  <div key={i}
                    onClick={() => { setSelectedDate(ds); setSelectedEvent(null); }}
                    className={`border-b border-r border-gray-100 p-1 cursor-pointer transition-all hover:bg-purple-50/30 ${
                      isSelected ? 'bg-purple-50 ring-1 ring-[#7C3AED]/30 ring-inset' : ''
                    } ${isWeekend ? 'bg-gray-50/30' : 'bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span style={F} className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-[#7C3AED] text-white' : 'text-[#001161]/60'
                      }`}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span style={F} className="text-[8px] font-bold text-[#001161]/25">{dayEvents.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map(ev => {
                        const et = getET(ev.type);
                        return (
                          <button key={ev.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); setSelectedDate(ev.date); }}
                            className={`w-full text-left text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate ${et.bg} ${et.color} hover:opacity-80 transition-all cursor-pointer`}
                            style={F}
                          >
                            {ev.title}
                          </button>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span style={F} className="text-[8px] text-[#001161]/30 pl-1">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── List View ───────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto p-5">
            <h3 style={F} className="text-[14px] font-bold text-[#001161] mb-3">Nadcházející události</h3>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-12">
                <CalIcon className="w-8 h-8 text-[#001161]/10 mx-auto mb-2" />
                <p style={F} className="text-[12px] text-[#001161]/30">Žádné nadcházející události</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingEvents.map(ev => {
                  const et = getET(ev.type);
                  const Icon = et.icon;
                  return (
                    <button key={ev.id}
                      onClick={() => { setSelectedEvent(ev); setSelectedDate(ev.date); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-[#7C3AED]/20 hover:shadow-sm transition-all cursor-pointer ${
                        selectedEvent?.id === ev.id ? 'ring-2 ring-[#7C3AED]/30' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${et.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${et.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p style={F} className="text-[12px] font-bold text-[#001161] truncate">{ev.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span style={F} className="text-[10px] text-[#001161]/40">{dateToCZ(ev.date)}</span>
                          {ev.time && <span style={F} className="text-[10px] text-[#001161]/30">{ev.time}</span>}
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${et.bg} ${et.color}`}>{et.label}</span>
                          {ev.sequenceId && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-600">Sekvence</span>}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#001161]/20 hover:text-red-500 transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sequences */}
            {sequences.length > 0 && (
              <>
                <h3 style={F} className="text-[14px] font-bold text-[#001161] mt-6 mb-3">Aktivní sekvence</h3>
                <div className="space-y-2">
                  {sequences.map(seq => (
                    <div key={seq.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[#7C3AED]" />
                          <span style={F} className="text-[13px] font-bold text-[#001161]">{seq.title}</span>
                        </div>
                        <span style={F} className="text-[10px] text-[#001161]/30">{seq.steps?.length} kroků</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {seq.steps?.map((step, i) => {
                          const et = getET(step.type);
                          return (
                            <span key={i} className={`text-[9px] font-bold px-2 py-1 rounded-lg ${et.bg} ${et.color}`} style={F}>
                              T{step.offset >= 0 ? '+' : ''}{step.offset}: {step.title}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Event Detail Bar (bottom) ──────────────────────────── */}
        {selectedEvent && (
          <div className="border-t border-gray-200 bg-white p-4 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {(() => {
                  const et = getET(selectedEvent.type);
                  const Icon = et.icon;
                  return (
                    <div className={`w-10 h-10 rounded-xl ${et.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${et.color}`} />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <h3 style={F} className="text-[14px] font-bold text-[#001161]">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span style={F} className="text-[11px] text-[#001161]/50">{dateToCZ(selectedEvent.date)}</span>
                    {selectedEvent.time && <span style={F} className="text-[11px] text-[#001161]/40">{selectedEvent.time}</span>}
                    {(() => { const et = getET(selectedEvent.type); return <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${et.bg} ${et.color}`}>{et.label}</span>; })()}
                    {selectedEvent.status && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                        selectedEvent.status === 'done' ? 'bg-green-100 text-green-700' :
                        selectedEvent.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{selectedEvent.status}</span>
                    )}
                    {/* Source badge for synced items */}
                    {(selectedEvent as any)._source === 'webinar' && (
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-500 border border-blue-200">Sync: Webináře</span>
                    )}
                    {(selectedEvent as any)._source === 'blog' && (
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-500 border border-orange-200">Sync: Blog</span>
                    )}
                    {(selectedEvent as any)._source === 'novinka' && (
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-md bg-pink-50 text-pink-500 border border-pink-200">Sync: Novinky</span>
                    )}
                  </div>
                  {selectedEvent.description && (
                    <p style={F} className="text-[11px] text-[#001161]/50 mt-1">{selectedEvent.description}</p>
                  )}
                  {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {selectedEvent.tags.map(t => (
                        <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-[#001161]/40">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!(selectedEvent as any)._source && (
                  <>
                    <button onClick={() => updateEvent(selectedEvent.id, { status: selectedEvent.status === 'done' ? 'planned' : 'done' })}
                      className="p-1.5 rounded-lg hover:bg-green-50 text-[#001161]/30 hover:text-green-600 transition-all cursor-pointer">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteEvent(selectedEvent.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#001161]/30 hover:text-red-500 transition-all cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedEvent(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-[#001161]/30 hover:text-[#001161] transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT: AI Planning Agent ═══ */}
      <div className="w-[340px] shrink-0 border-l border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-gray-200 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#FF6B1A] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span style={F} className="text-[13px] font-bold text-[#001161]">Plánovací Agent</span>
            <p style={F} className="text-[9px] text-[#001161]/30">AI + RAG + Kalendář</p>
          </div>
          <button onClick={() => setMessages([messages[0]])}
            className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-[#001161]/30 hover:text-[#001161] transition-all cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-[#7C3AED] text-white rounded-br-md'
                  : 'bg-[#f7f8fc] text-[#001161] rounded-bl-md border border-gray-100'
              }`}>
                {msg.role === 'user' ? (
                  <p style={F} className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div style={F}>{renderMd(msg.content)}</div>
                )}
              </div>
            </div>
          ))}

          {/* Pending actions */}
          {pendingSequence && (
            <div className="bg-gradient-to-r from-purple-50 to-orange-50 rounded-xl p-3 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#7C3AED]" />
                <span style={F} className="text-[12px] font-bold text-[#001161]">Navrhovaná sekvence</span>
              </div>
              <p style={F} className="text-[11px] font-bold text-[#7C3AED] mb-1">{pendingSequence.title}</p>
              <p style={F} className="text-[10px] text-[#001161]/40 mb-2">Anchor: {pendingSequence.anchorDate} | {pendingSequence.steps?.length} kroků</p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {pendingSequence.steps?.slice(0, 6).map((s: any, i: number) => {
                  const et = getET(s.type);
                  return (
                    <span key={i} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${et.bg} ${et.color}`} style={F}>
                      T{s.offset >= 0 ? '+' : ''}{s.offset}
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={applySequence}
                  className="flex items-center gap-1 text-[11px] font-bold bg-[#7C3AED] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-all cursor-pointer"
                  style={F}>
                  <Check className="w-3 h-3" /> Přidat do kalendáře
                </button>
                <button onClick={() => setPendingSequence(null)}
                  className="text-[11px] font-bold text-[#001161]/40 hover:text-[#001161] px-2 py-1.5 cursor-pointer transition-all"
                  style={F}>
                  Zrušit
                </button>
              </div>
            </div>
          )}

          {pendingEvents.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <CalIcon className="w-4 h-4 text-blue-600" />
                <span style={F} className="text-[12px] font-bold text-[#001161]">{pendingEvents.length} navrhovaných událostí</span>
              </div>
              {pendingEvents.map((ev, i) => {
                const et = getET(ev.type);
                return (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-[#001161]/70 mb-0.5" style={F}>
                    <span className={`font-bold px-1.5 py-0.5 rounded ${et.bg} ${et.color} text-[8px]`}>{et.label}</span>
                    <span className="font-bold">{ev.title}</span>
                    <span className="text-[#001161]/30">{ev.date}</span>
                  </div>
                );
              })}
              <div className="flex gap-2 mt-2">
                <button onClick={applyEvents}
                  className="flex items-center gap-1 text-[11px] font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-all cursor-pointer"
                  style={F}>
                  <Check className="w-3 h-3" /> Přidat vše
                </button>
                <button onClick={() => setPendingEvents([])}
                  className="text-[11px] font-bold text-[#001161]/40 hover:text-[#001161] px-2 py-1.5 cursor-pointer transition-all"
                  style={F}>
                  Zrušit
                </button>
              </div>
            </div>
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-[#f7f8fc] rounded-2xl rounded-bl-md px-4 py-3 border border-gray-100">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[#7C3AED] animate-spin" />
                  <span style={F} className="text-[11px] text-[#001161]/40">Agent přemýšlí...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Naplánuj launch Češtiny na 10. dubna..."
              rows={2}
              className="flex-1 text-[12px] text-[#001161] bg-[#f7f8fc] border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]/50 placeholder:text-[#001161]/25"
              style={F}
            />
            <button onClick={sendMessage} disabled={sending || !chatInput.trim()}
              className="w-9 h-9 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center hover:opacity-90 transition-all cursor-pointer disabled:opacity-30 shrink-0 shadow-[0_2px_8px_rgba(124,58,237,0.3)]">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ New Event Modal ═══ */}
      {showNewModal && (
        <NewEventModal
          defaultDate={selectedDate || todayStr}
          onClose={() => setShowNewModal(false)}
          onCreate={async (ev) => { await createEvent(ev); setShowNewModal(false); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ██  New Event Modal
   ═══════════════════════════════════════════════════════════════════════ */
function NewEventModal({ defaultDate, onClose, onCreate }: {
  defaultDate: string;
  onClose: () => void;
  onCreate: (ev: Partial<CalEvent>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('email');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const F: React.CSSProperties = { fontFamily: "'Fenomen Sans', sans-serif" };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Vyplňte název'); return; }
    setSaving(true);
    await onCreate({
      title: title.trim(),
      type,
      date,
      time: time || undefined,
      description: description || undefined,
      status: 'planned',
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 style={F} className="text-[16px] font-bold text-[#001161]">Nová událost</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer transition-all">
            <X className="w-4 h-4 text-[#001161]/40" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label style={F} className="block text-[11px] font-bold text-[#001161]/50 mb-1">Název</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-[13px] text-[#001161] bg-[#f7f8fc] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
              style={F} placeholder="Launch Čeština 6. třída" autoFocus />
          </div>

          {/* Type */}
          <div>
            <label style={F} className="block text-[11px] font-bold text-[#001161]/50 mb-1.5">Typ</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(EVENT_TYPES).filter(([k]) => k !== 'ad').map(([key, val]) => {
                const Icon = val.icon;
                return (
                  <button key={key} onClick={() => setType(key)}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      type === key
                        ? `${val.bg} ${val.color} ring-2 ring-current/20`
                        : 'bg-gray-50 text-[#001161]/40 hover:bg-gray-100'
                    }`} style={F}>
                    <Icon className="w-3 h-3" />
                    {val.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={F} className="block text-[11px] font-bold text-[#001161]/50 mb-1">Datum</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full text-[13px] text-[#001161] bg-[#f7f8fc] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                style={F} />
            </div>
            <div className="w-[120px]">
              <label style={F} className="block text-[11px] font-bold text-[#001161]/50 mb-1">Čas</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full text-[13px] text-[#001161] bg-[#f7f8fc] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                style={F} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={F} className="block text-[11px] font-bold text-[#001161]/50 mb-1">Popis</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full text-[12px] text-[#001161] bg-[#f7f8fc] border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
              style={F} placeholder="Volitelný popis..." />
          </div>

          {/* Tags */}
          <div>
            <label style={F} className="block text-[11px] font-bold text-[#001161]/50 mb-1">Štítky (oddělené čárkou)</label>
            <input value={tags} onChange={e => setTags(e.target.value)}
              className="w-full text-[12px] text-[#001161] bg-[#f7f8fc] border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
              style={F} placeholder="čeština, launch, 6. třída" />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="text-[12px] font-bold text-[#001161]/50 hover:text-[#001161] px-4 py-2 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
            style={F}>
            Zrušit
          </button>
          <button onClick={handleCreate} disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 text-[12px] font-bold bg-[#7C3AED] text-white px-4 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer disabled:opacity-30 shadow-[0_2px_8px_rgba(124,58,237,0.25)]"
            style={F}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Vytvořit
          </button>
        </div>
      </div>
    </div>
  );
}