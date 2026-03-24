import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Eye, X,
  Mail, Megaphone, MousePointerClick, Radio, BarChart2,
  ChevronDown, Save, Copy, Loader2, CheckCircle2, Users, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const ff = "'Fenomen Sans', sans-serif";

/* ── Types ─────────────────────────────────────────────────────── */
export type PopupType = 'newsletter' | 'cta' | 'announcement' | 'webinar';
export type TriggerType = 'immediate' | 'time_5s' | 'time_10s' | 'time_20s' | 'scroll_30' | 'scroll_50' | 'exit_intent';

export interface PopupData {
  id: string;
  name: string;
  active: boolean;
  type: PopupType;
  trigger: TriggerType;
  pages: string[];        // ['*'] = všude, ['/blog/*'] = jen blog
  cooldownDays: number;
  maxPerSession: number;
  content: {
    headline: string;
    body: string;
    ctaLabel: string;
    ctaUrl?: string;
    badge?: string;
    emoji?: string;
    webinarId?: string;
    webinarTitle?: string;
    webinarDate?: string;
    webinarUrl?: string;
  };
  stats: { shown: number; converted: number };
  createdAt: string;
  updatedAt: string;
}

/* ── Constants ─────────────────────────────────────────────────── */
const TYPE_META: Record<PopupType, { label: string; icon: any; color: string; bg: string; desc: string }> = {
  newsletter: { label: 'Newsletter',    icon: Mail,              color: '#E8942A', bg: '#FFF7ED', desc: 'Email formulář pro přihlášení k odběru' },
  cta:        { label: 'CTA výzva',     icon: MousePointerClick, color: '#7C3AED', bg: '#F5F3FF', desc: 'Tlačítko vedoucí na konkrétní URL' },
  announcement: { label: 'Oznámení',   icon: Megaphone,         color: '#0EA5E9', bg: '#F0F9FF', desc: 'Informační zpráva s volitelným tlačítkem' },
  webinar:    { label: 'Webinář',       icon: Radio,             color: '#10B981', bg: '#ECFDF5', desc: 'Propagace blížícího se webináře' },
};

const TRIGGER_META: Record<TriggerType, { label: string; desc: string }> = {
  immediate:   { label: 'Ihned',          desc: 'Zobrazí se okamžitě při načtení stránky' },
  time_5s:     { label: 'Po 5 s',         desc: 'Zobrazí se po 5 sekundách na stránce' },
  time_10s:    { label: 'Po 10 s',        desc: 'Zobrazí se po 10 sekundách na stránce' },
  time_20s:    { label: 'Po 20 s',        desc: 'Zobrazí se po 20 sekundách na stránce' },
  scroll_30:   { label: 'Scroll 30 %',    desc: 'Zobrazí se po scrollu na 30 % stránky' },
  scroll_50:   { label: 'Scroll 50 %',    desc: 'Zobrazí se po scrollu na 50 % stránky' },
  exit_intent: { label: 'Exit intent',    desc: 'Zobrazí se při pohybu myši k zavření záložky' },
};

const PAGE_OPTIONS = [
  { value: '*',           label: 'Všechny stránky' },
  { value: '/',           label: 'Hlavní stránka (katalog)' },
  { value: '/blog*',      label: 'Blog (přehled + články)' },
  { value: '/novinky*',   label: 'Novinky (přehled + detaily)' },
  { value: '/webinare*',  label: 'Webináře (přehled + detaily)' },
  { value: '/vyzkousejte', label: 'Vyzkoušet zdarma' },
  { value: '/predmet*',   label: 'Landing pages předmětů' },
  { value: '/produkt*',   label: 'Detail produktu' },
  { value: '/kontakt',    label: 'Kontakt' },
];

const BLANK_POPUP: Omit<PopupData, 'id' | 'stats' | 'createdAt' | 'updatedAt'> = {
  name: '',
  active: false,
  type: 'newsletter',
  trigger: 'scroll_50',
  pages: ['*'],
  cooldownDays: 14,
  maxPerSession: 1,
  content: {
    headline: '',
    body: '',
    ctaLabel: 'Zjistit více',
    ctaUrl: '',
    badge: '',
    emoji: '',
    webinarId: '',
    webinarTitle: '',
    webinarDate: '',
    webinarUrl: '',
  },
};

/* ── Helper ──────────────────────────────────────────────────────*/
function apiHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };
}

function convRate(p: PopupData) {
  if (!p.stats.shown) return 0;
  return Math.round((p.stats.converted / p.stats.shown) * 100);
}

/* ── Live Preview ─────────────────────────────────────────────── */
function PopupPreview({ popup }: { popup: Partial<PopupData> }) {
  const type = popup.type ?? 'newsletter';
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const c = popup.content ?? {};

  return (
    <div className="relative flex items-center justify-center min-h-[320px] bg-[#f0f2f8] rounded-2xl p-6 overflow-hidden">
      {/* backdrop blur simulation */}
      <div className="absolute inset-0 opacity-30"
        style={{ background: 'radial-gradient(circle at 30% 50%, #E8942A33, transparent 60%), radial-gradient(circle at 70% 80%, #7C3AED22, transparent 50%)' }} />

      <div className="relative w-full max-w-[340px] bg-white rounded-[24px] shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 20px 60px rgba(0,17,97,0.18)' }}>
        {/* top accent */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}99)` }} />

        <div className="px-6 pt-5 pb-6">
          {/* badge */}
          {c.badge && (
            <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
              style={{ background: meta.bg, color: meta.color, fontFamily: ff }}>
              {c.badge}
            </span>
          )}

          {/* icon + type indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: meta.bg }}>
              <Icon className="w-4 h-4" style={{ color: meta.color }} />
            </div>
            {c.emoji && <span className="text-[20px]">{c.emoji}</span>}
          </div>

          <h3 className="text-[#001161] font-black text-[17px] leading-snug mb-2" style={{ fontFamily: ff }}>
            {c.headline || 'Nadpis popupu'}
          </h3>
          <p className="text-[#001161]/60 text-[13px] leading-relaxed mb-4" style={{ fontFamily: ff }}>
            {c.body || 'Text popupu se zobrazí zde...'}
          </p>

          {type === 'newsletter' && (
            <div className="space-y-2">
              <div className="bg-[#F7F8FC] rounded-xl px-4 py-3 text-[13px] text-[#001161]/30 border border-[#001161]/8" style={{ fontFamily: ff }}>
                Váš e-mail
              </div>
              <div className="w-full py-3 rounded-xl text-white text-[13px] font-bold text-center"
                style={{ background: meta.color, fontFamily: ff }}>
                {c.ctaLabel || 'Přihlásit se'}
              </div>
            </div>
          )}

          {(type === 'cta' || type === 'announcement') && c.ctaLabel && (
            <div className="w-full py-3 rounded-xl text-white text-[13px] font-bold text-center"
              style={{ background: type === 'cta' ? '#7C3AED' : meta.color, fontFamily: ff }}>
              {c.ctaLabel}
            </div>
          )}

          {type === 'webinar' && (
            <div className="bg-[#ECFDF5] rounded-xl p-3 mb-3 border border-[#10B981]/20">
              <p className="text-[#10B981] font-bold text-[12px] mb-1" style={{ fontFamily: ff }}>📅 {c.webinarDate || 'Datum webináře'}</p>
              <p className="text-[#001161] font-bold text-[14px]" style={{ fontFamily: ff }}>{c.webinarTitle || 'Název webináře'}</p>
              <div className="mt-3 py-2.5 rounded-xl text-white text-[13px] font-bold text-center"
                style={{ background: '#10B981', fontFamily: ff }}>
                {c.ctaLabel || 'Přihlásit se zdarma'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-[#001161]/40 text-[12px] font-bold">
        ✕
      </div>
    </div>
  );
}

/* ── Editor Panel ─────────────────────────────────────────────── */
function PopupEditor({
  initial,
  webinars,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<PopupData>;
  webinars: any[];
  onSave: (data: Partial<PopupData>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<PopupData>>(initial);

  const set = (path: string, value: any) => {
    setForm(prev => {
      const next = { ...prev };
      if (path.startsWith('content.')) {
        const key = path.replace('content.', '');
        next.content = { ...(prev.content ?? {}), [key]: value } as any;
      } else {
        (next as any)[path] = value;
      }
      return next;
    });
  };

  const togglePage = (val: string) => {
    const pages = form.pages ?? ['*'];
    if (val === '*') { set('pages', ['*']); return; }
    const without = pages.filter(p => p !== '*' && p !== val);
    set('pages', without.includes(val) ? without : [...without.filter(p => p !== '*'), val]);
  };

  // Auto-fill webinar content
  useEffect(() => {
    if (form.type === 'webinar' && form.content?.webinarId) {
      const w = webinars.find((w: any) => w.id === form.content?.webinarId);
      if (w) {
        setForm(prev => ({
          ...prev,
          content: {
            ...prev.content,
            webinarTitle: w.title,
            webinarDate: w.date ? new Date(w.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
            webinarUrl: `/webinar/${w.id}`,
            headline: prev.content?.headline || `Blíží se webinář: ${w.title}`,
            body: prev.content?.body || (w.description ?? ''),
            ctaLabel: prev.content?.ctaLabel || 'Přihlásit se zdarma',
          },
        }));
      }
    }
  }, [form.content?.webinarId, form.type]);

  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5";
  const inputClass = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-[13px] text-[#001161] focus:border-[#001161] focus:outline-none transition-colors bg-white";

  return (
    <div className="flex gap-6 h-full overflow-hidden">
      {/* Form */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-5">

        {/* Interní název */}
        <div>
          <label className={labelClass}>Interní název</label>
          <input className={inputClass} value={form.name ?? ''} onChange={e => set('name', e.target.value)}
            placeholder="Např. Newsletter — blog čtenáři" style={{ fontFamily: ff }} />
        </div>

        {/* Typ */}
        <div>
          <label className={labelClass}>Typ popupu</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TYPE_META) as PopupType[]).map(t => {
              const m = TYPE_META[t];
              const Icon = m.icon;
              const active = form.type === t;
              return (
                <button key={t} onClick={() => set('type', t)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all ${active ? 'border-[#001161] bg-[#001161] text-white' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: active ? 'rgba(255,255,255,0.15)' : m.bg }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: active ? 'white' : m.color }} />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold leading-none mb-0.5" style={{ fontFamily: ff }}>{m.label}</p>
                    <p className={`text-[10px] leading-tight ${active ? 'text-white/60' : 'text-gray-400'}`} style={{ fontFamily: ff }}>{m.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Trigger */}
        <div>
          <label className={labelClass}>Trigger zobrazení</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(TRIGGER_META) as TriggerType[]).map(t => {
              const m = TRIGGER_META[t];
              const active = form.trigger === t;
              return (
                <button key={t} onClick={() => set('trigger', t)}
                  className={`px-3 py-2 rounded-xl border text-left transition-all ${active ? 'border-[#001161] bg-[#001161]/5 text-[#001161]' : 'border-gray-200 hover:border-gray-300 text-gray-500'}`}>
                  <p className="text-[12px] font-bold" style={{ fontFamily: ff }}>{m.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5" style={{ fontFamily: ff }}>{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stránky */}
        <div>
          <label className={labelClass}>Zobrazovat na stránkách</label>
          <div className="space-y-1">
            {PAGE_OPTIONS.map(opt => {
              const pages = form.pages ?? ['*'];
              const checked = pages.includes(opt.value) || (opt.value !== '*' && pages.includes('*'));
              return (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-xl hover:bg-gray-50">
                  <input type="checkbox" checked={checked} onChange={() => togglePage(opt.value)}
                    className="w-4 h-4 accent-[#001161]" />
                  <span className="text-[13px] text-[#001161]" style={{ fontFamily: ff }}>{opt.label}</span>
                  <code className="ml-auto text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{opt.value}</code>
                </label>
              );
            })}
          </div>
        </div>

        {/* Webinář výběr */}
        {form.type === 'webinar' && (
          <div>
            <label className={labelClass}>Vybrat webinář</label>
            <select className={inputClass} value={form.content?.webinarId ?? ''}
              onChange={e => set('content.webinarId', e.target.value)} style={{ fontFamily: ff }}>
              <option value="">— vyberte webinář —</option>
              {webinars.map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.title} {w.date ? `(${new Date(w.date).toLocaleDateString('cs-CZ')})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1" style={{ fontFamily: ff }}>
              Po výběru se automaticky doplní název a datum. Vše lze přepsat.
            </p>
          </div>
        )}

        {/* Obsah */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: ff }}>Obsah popupu</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Badge (volitelné)</label>
              <input className={inputClass} value={form.content?.badge ?? ''} onChange={e => set('content.badge', e.target.value)}
                placeholder="Nové" style={{ fontFamily: ff }} />
            </div>
            <div>
              <label className={labelClass}>Emoji (volitelné)</label>
              <input className={inputClass} value={form.content?.emoji ?? ''} onChange={e => set('content.emoji', e.target.value)}
                placeholder="📚" style={{ fontFamily: ff }} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Nadpis *</label>
            <input className={inputClass} value={form.content?.headline ?? ''} onChange={e => set('content.headline', e.target.value)}
              placeholder="Tipy pro výuku každý měsíc" style={{ fontFamily: ff }} />
          </div>

          <div>
            <label className={labelClass}>Text *</label>
            <textarea className={inputClass + ' resize-none'} rows={3}
              value={form.content?.body ?? ''} onChange={e => set('content.body', e.target.value)}
              placeholder="Jednou měsíčně vám pošleme..." style={{ fontFamily: ff }} />
          </div>

          <div>
            <label className={labelClass}>Text tlačítka *</label>
            <input className={inputClass} value={form.content?.ctaLabel ?? ''} onChange={e => set('content.ctaLabel', e.target.value)}
              placeholder="Přihlásit se" style={{ fontFamily: ff }} />
          </div>

          {(form.type === 'cta' || form.type === 'announcement') && (
            <div>
              <label className={labelClass}>URL tlačítka</label>
              <input className={inputClass} value={form.content?.ctaUrl ?? ''} onChange={e => set('content.ctaUrl', e.target.value)}
                placeholder="/vyzkousejte nebo https://..." style={{ fontFamily: ff }} />
            </div>
          )}
        </div>

        {/* Chování */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: ff }}>Chování</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Cooldown (dny)</label>
              <input type="number" min={0} max={365} className={inputClass}
                value={form.cooldownDays ?? 14} onChange={e => set('cooldownDays', Number(e.target.value))}
                style={{ fontFamily: ff }} />
              <p className="text-[10px] text-gray-400 mt-1" style={{ fontFamily: ff }}>Po zavření nezobrazovat X dní</p>
            </div>
            <div>
              <label className={labelClass}>Max za session</label>
              <input type="number" min={1} max={10} className={inputClass}
                value={form.maxPerSession ?? 1} onChange={e => set('maxPerSession', Number(e.target.value))}
                style={{ fontFamily: ff }} />
              <p className="text-[10px] text-gray-400 mt-1" style={{ fontFamily: ff }}>Kolikrát ukázat za návštěvu</p>
            </div>
          </div>
        </div>

        {/* Akce */}
        <div className="flex gap-2 pt-2 pb-6">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[13px] font-bold hover:bg-gray-50 transition-colors cursor-pointer"
            style={{ fontFamily: ff }}>
            Zrušit
          </button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name || !form.content?.headline}
            className="flex-1 py-2.5 rounded-xl bg-[#001161] text-white text-[13px] font-bold hover:bg-[#001161]/90 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-2"
            style={{ fontFamily: ff }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Uložit popup
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="w-[360px] flex-shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3" style={{ fontFamily: ff }}>
          Živý náhled
        </p>
        <PopupPreview popup={form} />
        <div className="mt-3 bg-[#F7F8FC] rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-[12px] text-gray-500" style={{ fontFamily: ff }}>
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            {TRIGGER_META[form.trigger ?? 'immediate']?.label}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-gray-500" style={{ fontFamily: ff }}>
            <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
            {(form.pages ?? ['*']).join(', ')}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-gray-500" style={{ fontFamily: ff }}>
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            Cooldown: {form.cooldownDays ?? 14} dní
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export default function PopupManager() {
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [webinars, setWebinars] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null); // null = list, 'new' = new, else id
  const [editData, setEditData] = useState<Partial<PopupData>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [popRes, webRes, subRes] = await Promise.all([
        fetch(`${SERVER}/popups`, { headers: apiHeaders() }),
        fetch(`${SERVER}/webinare`, { headers: apiHeaders() }),
        fetch(`${SERVER}/newsletter/subscribers`, { headers: apiHeaders() }),
      ]);
      const { popups: p } = await popRes.json();
      setPopups(p ?? []);
      const webData = await webRes.json();
      setWebinars(Array.isArray(webData) ? webData : Array.isArray(webData?.webinars) ? webData.webinars : []);
      const subData = await subRes.json();
      setSubscribers(subData.subscribers ?? []);
    } catch (e) {
      console.error('[PopupManager] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (popup: PopupData) => {
    const updated = { ...popup, active: !popup.active };
    setPopups(prev => prev.map(p => p.id === popup.id ? updated : p));
    await fetch(`${SERVER}/popups/${popup.id}`, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({ active: !popup.active }),
    });
    toast.success(updated.active ? 'Popup aktivován' : 'Popup deaktivován');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Smazat tento popup?')) return;
    setPopups(prev => prev.filter(p => p.id !== id));
    await fetch(`${SERVER}/popups/${id}`, { method: 'DELETE', headers: apiHeaders() });
    toast.success('Popup smazán');
  };

  const handleSave = async (data: Partial<PopupData>) => {
    setSaving(true);
    try {
      if (editingId === 'new') {
        const res = await fetch(`${SERVER}/popups`, {
          method: 'POST', headers: apiHeaders(), body: JSON.stringify(data),
        });
        const { popup } = await res.json();
        setPopups(prev => [...prev, popup]);
        toast.success('Popup vytvořen');
      } else {
        await fetch(`${SERVER}/popups/${editingId}`, {
          method: 'PUT', headers: apiHeaders(), body: JSON.stringify(data),
        });
        setPopups(prev => prev.map(p => p.id === editingId ? { ...p, ...data } as PopupData : p));
        toast.success('Popup uložen');
      }
      setEditingId(null);
    } catch (e) {
      toast.error('Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setEditData({ ...BLANK_POPUP });
    setEditingId('new');
  };

  const handleEdit = (popup: PopupData) => {
    setEditData({ ...popup });
    setEditingId(popup.id);
  };

  const handleDuplicate = async (popup: PopupData) => {
    const newData = { ...popup, name: `${popup.name} (kopie)`, active: false };
    delete (newData as any).id;
    delete (newData as any).stats;
    delete (newData as any).createdAt;
    delete (newData as any).updatedAt;
    const res = await fetch(`${SERVER}/popups`, {
      method: 'POST', headers: apiHeaders(), body: JSON.stringify(newData),
    });
    const { popup: created } = await res.json();
    setPopups(prev => [...prev, created]);
    toast.success('Popup duplikován');
  };

  // Upcoming webinars for the top banner
  const upcomingWebinars = webinars.filter((w: any) => {
    if (!w.date) return false;
    return new Date(w.date) >= new Date();
  }).slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span style={{ fontFamily: ff }}>Načítám...</span>
      </div>
    );
  }

  /* ── EDITOR MODE ──────────────────────────────────────────────*/
  if (editingId !== null) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="px-7 py-4 border-b border-gray-200 bg-white flex items-center gap-3 shrink-0">
          <button onClick={() => setEditingId(null)}
            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-[#001161] transition-colors cursor-pointer"
            style={{ fontFamily: ff }}>
            <X className="w-4 h-4" /> Zpět na seznam
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-[13px] font-bold text-[#001161]" style={{ fontFamily: ff }}>
            {editingId === 'new' ? 'Nový popup' : `Editace: ${editData.name}`}
          </span>
        </div>
        <div className="flex-1 overflow-hidden px-7 pt-6">
          <PopupEditor
            initial={editData}
            webinars={webinars}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  /* ── LIST MODE ────────────────────────────────────────────────*/
  const activeCount = popups.filter(p => p.active).length;
  const totalShown = popups.reduce((s, p) => s + (p.stats?.shown ?? 0), 0);
  const totalConverted = popups.reduce((s, p) => s + (p.stats?.converted ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-7 py-6 max-w-[1100px]">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-black text-[#001161]" style={{ fontFamily: ff }}>
              Popup Manager
            </h1>
            <p className="text-[13px] text-gray-400 mt-0.5" style={{ fontFamily: ff }}>
              Spravujte newslettery, CTA výzvy, oznámení a propagaci webinářů
            </p>
          </div>
          <button onClick={handleNew}
            className="flex items-center gap-2 bg-[#001161] hover:bg-[#001161]/90 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer"
            style={{ fontFamily: ff }}>
            <Plus className="w-4 h-4" /> Nový popup
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Celkem popupů',     value: popups.length,   icon: Megaphone,   color: '#6366F1' },
            { label: 'Aktivní',           value: activeCount,     icon: ToggleRight, color: '#10B981' },
            { label: 'Celkem zobrazení',  value: totalShown,      icon: Eye,         color: '#F59E0B' },
            { label: 'Přihlášení k NL',   value: subscribers.length, icon: Users,   color: '#E8942A' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl px-4 py-3.5 border border-gray-100">
              <div className="flex items-center gap-2 mb-1.5">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <span className="text-[11px] text-gray-400 uppercase tracking-wider font-bold" style={{ fontFamily: ff }}>{s.label}</span>
              </div>
              <p className="text-[26px] font-black text-[#001161]" style={{ fontFamily: ff }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Upcoming webinars hint */}
        {upcomingWebinars.length > 0 && (
          <div className="bg-[#ECFDF5] border border-[#10B981]/20 rounded-2xl px-5 py-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-[#10B981]" />
              <p className="text-[13px] font-bold text-[#065F46]" style={{ fontFamily: ff }}>
                {`Blíží se ${upcomingWebinars.length} webinář${upcomingWebinars.length > 1 ? 'e' : ''} — chcete je propagovat?`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {upcomingWebinars.map((w: any) => (
                <div key={w.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                  <span className="text-[12px] font-bold text-[#001161]" style={{ fontFamily: ff }}>{w.title}</span>
                  {w.date && (
                    <span className="text-[11px] text-[#10B981] font-bold" style={{ fontFamily: ff }}>
                      {new Date(w.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditData({
                        ...BLANK_POPUP,
                        name: `Webinář: ${w.title}`,
                        type: 'webinar',
                        trigger: 'time_10s',
                        content: {
                          headline: `Blíží se webinář: ${w.title}`,
                          body: w.description ?? 'Přidejte se k nám na bezplatný online webinář.',
                          ctaLabel: 'Přihlásit se zdarma',
                          ctaUrl: `/webinar/${w.id}`,
                          webinarId: w.id,
                          webinarTitle: w.title,
                          webinarDate: w.date ? new Date(w.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' }) : '',
                          webinarUrl: `/webinar/${w.id}`,
                          badge: 'Webinář zdarma',
                          emoji: '📡',
                        },
                      });
                      setEditingId('new');
                    }}
                    className="ml-1 text-[11px] font-bold text-[#10B981] hover:text-[#065F46] transition-colors cursor-pointer underline"
                    style={{ fontFamily: ff }}>
                    Vytvořit popup →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popup list */}
        {popups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-[15px] font-bold text-gray-400 mb-1" style={{ fontFamily: ff }}>Žádné popupy</p>
            <p className="text-[13px] text-gray-300 mb-4" style={{ fontFamily: ff }}>Vytvořte svůj první popup a začněte sbírat odběratele.</p>
            <button onClick={handleNew}
              className="inline-flex items-center gap-2 bg-[#001161] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer"
              style={{ fontFamily: ff }}>
              <Plus className="w-4 h-4" /> Vytvořit popup
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {popups.map(popup => {
              const meta = TYPE_META[popup.type];
              const Icon = meta.icon;
              const rate = convRate(popup);
              return (
                <motion.div
                  key={popup.id}
                  layout
                  className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4"
                  style={{ boxShadow: '0 1px 4px rgba(0,17,97,0.04)' }}
                >
                  {/* type icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.bg }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[14px] text-[#001161] truncate" style={{ fontFamily: ff }}>{popup.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color, fontFamily: ff }}>{meta.label}</span>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full" style={{ fontFamily: ff }}>{TRIGGER_META[popup.trigger]?.label}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[12px] text-gray-400" style={{ fontFamily: ff }}>
                        {(popup.pages ?? ['*']).join(', ')}
                      </span>
                    </div>
                    {/* stats bar */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] text-gray-400" style={{ fontFamily: ff }}>
                        Zobrazeno: <strong className="text-[#001161]">{popup.stats?.shown ?? 0}×</strong>
                      </span>
                      <span className="text-[11px] text-gray-400" style={{ fontFamily: ff }}>
                        Konverze: <strong style={{ color: rate >= 5 ? '#10B981' : rate >= 2 ? '#F59E0B' : '#EF4444' }}>{rate} %</strong>
                      </span>
                      {popup.stats?.shown > 0 && (
                        <div className="flex-1 max-w-[80px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(rate * 5, 100)}%`, background: rate >= 5 ? '#10B981' : '#F59E0B' }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleDuplicate(popup)} title="Duplikovat"
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEdit(popup)} title="Editovat"
                      className="p-2 rounded-xl hover:bg-[#001161]/5 text-gray-400 hover:text-[#001161] transition-colors cursor-pointer">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(popup.id)} title="Smazat"
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleToggleActive(popup)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${popup.active ? 'bg-[#ECFDF5] text-[#10B981]' : 'bg-gray-100 text-gray-400'}`}
                      style={{ fontFamily: ff }}>
                      {popup.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {popup.active ? 'Aktivní' : 'Neaktivní'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Newsletter subscribers table */}
        {subscribers.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-[#E8942A]" />
              <h2 className="text-[14px] font-bold text-[#001161]" style={{ fontFamily: ff }}>
                {`Odběratelé newsletteru (${subscribers.length})`}
              </h2>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-3 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400" style={{ fontFamily: ff }}>
                <span>E-mail</span>
                <span>Zdroj</span>
                <span>Datum</span>
              </div>
              {subscribers.slice().reverse().map((s: any) => (
                <div key={s.id} className="grid grid-cols-3 px-5 py-2.5 border-b border-gray-50 text-[13px] hover:bg-gray-50 transition-colors">
                  <span className="text-[#001161] font-medium" style={{ fontFamily: ff }}>{s.email}</span>
                  <span className="text-gray-400 text-[12px]" style={{ fontFamily: ff }}>{s.source}</span>
                  <span className="text-gray-400 text-[12px]" style={{ fontFamily: ff }}>
                    {new Date(s.subscribedAt).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}