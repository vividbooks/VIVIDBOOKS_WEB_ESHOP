import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Radio, Play, Save, Loader2, X,
  Brain, CheckCircle2, AlertCircle, ChevronRight, Clock,
  FileText, Video, Trash2, ExternalLink, Info,
  BookOpen, Plus, Award, Zap, Link2,
  ChevronDown, ChevronUp, Link, Unlink,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useWebinars } from '../../contexts/WebinarsContext';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

function extractYoutubeId(url: string): string | null {
  const pats = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of pats) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function matchDvppVideo(webinar: any, dvppVideos: any[]): any | null {
  if (!dvppVideos?.length) return null;
  const wSlug  = norm(webinar.slug || webinar.id || '');
  const wTitle = norm(webinar.title || '');
  const bySlug = dvppVideos.find(v => norm(v.slug || v.id || '') === wSlug);
  if (bySlug) return bySlug;
  const byTitle = dvppVideos.find(v => {
    const vt = norm(v.name || v.title || '');
    return wTitle.length > 5 && (
      vt.includes(wTitle.slice(0, Math.floor(wTitle.length * 0.7))) ||
      wTitle.includes(vt.slice(0, Math.floor(vt.length * 0.7)))
    );
  });
  return byTitle ?? null;
}

const MONTH_NAMES = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];

type RagStatus = { count: number; loading: boolean; lastIndexed?: string };

interface FormState {
  title: string; subtitle: string;
  day: number; monthNum: number; year: number; time: string;
  lecturer: string; description: string; perks: string; targetAudience: string;
  coverImage: string; recordingUrl: string;
  certificateUrl: string; greyButtonText: string;
  orangeButtonText: string; orangeButtonLink: string;
  prepis: string;
}

const EMPTY_FORM: FormState = {
  title: '', subtitle: '',
  day: new Date().getDate(), monthNum: new Date().getMonth() + 1, year: new Date().getFullYear(),
  time: '18:00', lecturer: '', description: '', perks: '', targetAudience: 'Pro učitele',
  coverImage: '', recordingUrl: '',
  certificateUrl: '', greyButtonText: 'Certifikát DVPP',
  orangeButtonText: 'Vyzkoušejte zdarma', orangeButtonLink: '/vyzkousejte',
  prepis: '',
};

function itemToForm(webinar: any, dvpp: any | null): FormState {
  return {
    title:            webinar.title            ?? '',
    subtitle:         webinar.subtitle         ?? '',
    day:              webinar.day              ?? new Date().getDate(),
    monthNum:         webinar.monthNum         ?? (new Date().getMonth() + 1),
    year:             webinar.year             ?? new Date().getFullYear(),
    time:             webinar.time             ?? '18:00',
    lecturer:         webinar.lecturer         ?? '',
    description:      webinar.description      ?? dvpp?.description ?? '',
    perks:            webinar.perks            ?? '',
    targetAudience:   webinar.targetAudience   ?? '',
    coverImage:       webinar.coverImage       ?? dvpp?.thumbnail   ?? '',
    recordingUrl:     webinar.recordingUrl || webinar.youtubeUrl || dvpp?.youtubeUrl       || '',
    certificateUrl:   webinar.certificateUrl   || dvpp?.certificateUrl   || '',
    greyButtonText:   webinar.greyButtonText   || dvpp?.greyButtonText   || 'Certifikát DVPP',
    orangeButtonText: webinar.orangeButtonText || dvpp?.orangeButtonText || 'Vyzkoušejte zdarma',
    orangeButtonLink: webinar.orangeButtonLink || dvpp?.orangeButtonLink || '/vyzkousejte',
    prepis:           webinar.prepis           ?? '',
  };
}

// ── Collapsible section ──────────────────────────────────────────────────
function Section({
  icon, title, subtitle, color = '#001161', bgColor = '#EEF0FA',
  defaultOpen = true, badge, children,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  color?: string; bgColor?: string; defaultOpen?: boolean;
  badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: bgColor }}>
            <span style={{ color }}>{icon}</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">{title}</span>
              {badge}
            </div>
            {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls    = "w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none transition-colors bg-white";
const textareaCls = "w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none transition-colors resize-none leading-relaxed bg-white";

// ── Main component ───────────────────────────────────────────────────────
export default function WebinaryPastPanel() {
  const { refresh: refreshContext } = useWebinars();
  const [items, setItems]           = useState<any[]>([]);
  const [dvppVideos, setDvppVideos] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<any | null>(null);
  const [matchedDvpp, setMatchedDvpp] = useState<any | null>(null);
  const [isNew, setIsNew]           = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const upd = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const [saving, setSaving]       = useState(false);
  const [ragStatus, setRagStatus] = useState<Record<string, RagStatus>>({});
  const [indexing, setIndexing]   = useState<string | null>(null);

  const loadList = useCallback(async (): Promise<{ past: any[]; dvpp: any[] }> => {
    setLoadingList(true);
    try {
      const [webinarRes, dvppRes] = await Promise.all([
        fetch(`${SERVER}/admin/webinare`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${SERVER}/dvpp-videos`,    { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
      ]);
      const webinarData = await webinarRes.json();
      const dvppData    = await dvppRes.json();
      const past = (webinarData.items || []).filter((w: any) => !!w.isPast);
      const dvpp = dvppData.videos ?? [];
      setItems(past);
      setDvppVideos(dvpp);
      return { past, dvpp };
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
      return { past: [], dvpp: [] };
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const loadRagStatus = useCallback(async (webinarId: string) => {
    setRagStatus(prev => ({ ...prev, [webinarId]: { ...prev[webinarId], loading: true, count: prev[webinarId]?.count ?? 0 } }));
    try {
      const res  = await fetch(`${SERVER}/rag/webinar-prepis-status/${webinarId}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      setRagStatus(prev => ({ ...prev, [webinarId]: { count: data.count ?? 0, loading: false } }));
    } catch {
      setRagStatus(prev => ({ ...prev, [webinarId]: { count: 0, loading: false } }));
    }
  }, []);

  function handleSelect(item: any) {
    setIsNew(false);
    setSelected(item);
    const dvpp = matchDvppVideo(item, dvppVideos);
    setMatchedDvpp(dvpp);
    setForm(itemToForm(item, dvpp));
    loadRagStatus(item.id);
  }

  function handleNewRecord() {
    setIsNew(true);
    setSelected(null);
    setMatchedDvpp(null);
    setForm({ ...EMPTY_FORM });
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Vyplň název webináře.'); return; }
    setSaving(true);
    try {
      const monthNum = Number(form.monthNum);
      const webinarPayload: any = {
        ...form,
        monthName:   MONTH_NAMES[monthNum - 1] ?? '',
        monthNum,
        day:         Number(form.day),
        year:        Number(form.year),
        isPast:      true,
        youtubeUrl:  form.recordingUrl || undefined,
        updatedAt:   new Date().toISOString(),
      };

      const dvppPayload = {
        name:             form.title,
        slug:             selected?.slug || selected?.id || `webinar-${Date.now()}`,
        thumbnail:        form.coverImage || '',
        youtubeUrl:       form.recordingUrl,
        certificateUrl:   form.certificateUrl,
        greyButtonText:   form.greyButtonText,
        orangeButtonText: form.orangeButtonText,
        orangeButtonLink: form.orangeButtonLink,
        description:      form.description,
        topicIds:         matchedDvpp?.topicIds ?? [],
      };

      if (isNew) {
        webinarPayload.id = `webinar-${Date.now()}`;
        webinarPayload.thumbnailVariant = 1;
        const res = await fetch(`${SERVER}/admin/webinare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify(webinarPayload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
        const data = await res.json();
        const newWebinar = data.item ?? webinarPayload;
        if (form.recordingUrl || form.certificateUrl) {
          const dvppId = matchedDvpp?.id || newWebinar.id;
          await fetch(`${SERVER}/dvpp-videos/${dvppId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
            body: JSON.stringify({ ...dvppPayload, slug: newWebinar.slug || newWebinar.id }),
          });
        }
        toast.success('Webinář vytvořen!');
        await loadList();
        setIsNew(false);
        setSelected(newWebinar);
        setForm(itemToForm(newWebinar, null));
        if (newWebinar.id) loadRagStatus(newWebinar.id);
      } else {
        const res = await fetch(`${SERVER}/admin/webinare/${selected.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify(webinarPayload),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
        const dvppId = matchedDvpp?.id || selected.id;
        const dvppRes = await fetch(`${SERVER}/dvpp-videos/${dvppId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ ...dvppPayload, slug: selected.slug || selected.id }),
        });
        if (dvppRes.ok) {
          const d = await dvppRes.json();
          toast.success(d.created ? 'Uloženo + vytvořen nový DVPP záznam' : 'Uloženo + aktualizováno DVPP video');
          await loadList();
          setSelected((prev: any) => ({ ...prev, ...webinarPayload }));
          setItems(prev => prev.map((w: any) => w.id === selected.id ? { ...w, ...webinarPayload } : w));
        } else {
          toast.success('Uloženo!');
          setSelected((prev: any) => ({ ...prev, ...webinarPayload }));
          setItems(prev => prev.map((w: any) => w.id === selected.id ? { ...w, ...webinarPayload } : w));
        }
      }
      refreshContext();
    } catch (e: any) { toast.error(`Chyba: ${e.message}`); }
    finally { setSaving(false); }
  }

  async function handleIndexRag() {
    const webinarId = selected?.id;
    if (!webinarId) return;
    if (!form.prepis.trim()) {
      toast.error('Nejdříve vyplň přepis výše (tlačítkem „Uložit“ ho zapíšeš do záznamu webináře v úložišti).');
      return;
    }
    setIndexing(webinarId);
    try {
      // Send prepis directly in body — server will use it even if not saved yet
      const res = await fetch(`${SERVER}/rag/ingest-webinar-prepis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ webinarId, prepis: form.prepis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const n = data.ingested ?? 0;
      if (n === 0) {
        toast.warning('Indexace skončila s 0 chunky — zkontroluj přepis (délka, jen mezery?) nebo log edge funkce (embedding / DB).');
      } else {
        toast.success(`RAG: ${n} chunků indexováno`);
      }
      await loadRagStatus(webinarId);
      setRagStatus(prev => ({
        ...prev,
        [webinarId]: { ...(prev[webinarId] || { count: 0, loading: false }), lastIndexed: new Date().toLocaleTimeString('cs-CZ') },
      }));
    } catch (e: any) { toast.error(`RAG chyba: ${e.message}`); }
    finally { setIndexing(null); }
  }

  const filtered = items.filter(w => !search || (w.title || '').toLowerCase().includes(search.toLowerCase()));
  const videoId  = form.recordingUrl ? extractYoutubeId(form.recordingUrl) : null;
  const status   = selected ? ragStatus[selected.id] : null;

  return (
    <div className="h-full flex overflow-hidden bg-[#f7f8fc]" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>

      {/* ── LEFT LIST ─────────────────────────────────────── */}
      <div className="w-[270px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">
              {'Minulé webináře'}
              <span className="text-gray-400 font-normal ml-1">({items.length})</span>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={loadList} className="p-1 text-gray-400 hover:text-[#001161]" title="Obnovit">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleNewRecord}
                className="p-1 text-[#7C3AED] hover:bg-purple-50 rounded-lg transition-colors"
                title={'Nový záznam'}>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={'Hledat…'}
              className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all" />
          </div>
        </div>

        <button onClick={handleNewRecord}
          className={`mx-3 mt-2 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-[12px] font-bold transition-colors ${isNew ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50'}`}>
          <Plus className="w-3.5 h-3.5" />
          {'Nový záznam webináře'}
        </button>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <div className="text-[12px] text-gray-400">{'Žádné minulé webináře'}</div>
            </div>
          ) : filtered.map(item => {
            const isSel     = !isNew && selected?.id === item.id;
            const dvpp      = matchDvppVideo(item, dvppVideos);
            const hasVideo  = !!(item.recordingUrl || item.youtubeUrl || dvpp?.youtubeUrl);
            const hasCert   = !!(item.certificateUrl || dvpp?.certificateUrl);
            const hasPrepis = !!item.prepis;
            const st        = ragStatus[item.id];
            return (
              <button key={item.id} onClick={() => handleSelect(item)}
                className={`w-full text-left px-3 py-3 border-b border-gray-50 flex items-start gap-2.5 transition-all ${isSel ? 'bg-[#001161]' : 'hover:bg-gray-50'}`}>
                {item.coverImage || dvpp?.thumbnail ? (
                  <img src={item.coverImage || dvpp?.thumbnail} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-100" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Radio className="w-4 h-4 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-semibold leading-snug line-clamp-2 ${isSel ? 'text-white' : 'text-[#001161]'}`}>
                    {item.title || 'Bez názvu'}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${isSel ? 'text-blue-200' : 'text-gray-400'}`}>
                    {item.day}. {item.monthName} {item.year}
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {dvpp && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Link className="w-2 h-2" /> DVPP
                      </span>
                    )}
                    {hasVideo && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-red-800 text-red-200' : 'bg-red-50 text-red-500'}`}>
                        <Play className="w-2 h-2" /> {'Záznam'}
                      </span>
                    )}
                    {hasCert && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-blue-800 text-blue-200' : 'bg-blue-50 text-blue-500'}`}>
                        <Award className="w-2 h-2" /> Cert.
                      </span>
                    )}
                    {hasPrepis && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-purple-800 text-purple-200' : 'bg-purple-50 text-purple-500'}`}>
                        <FileText className="w-2 h-2" /> {'Přepis'}
                      </span>
                    )}
                    {st && st.count > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${isSel ? 'bg-amber-800 text-amber-200' : 'bg-amber-50 text-amber-600'}`}>
                        <Brain className="w-2 h-2" /> RAG {st.count}
                      </span>
                    )}
                  </div>
                </div>
                {isSel && <ChevronRight className="w-3.5 h-3.5 text-blue-300 shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────── */}
      {(selected || isNew) ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[860px] mx-auto p-6 space-y-4">

            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {form.coverImage && (
                    <img src={form.coverImage} className="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0" alt="" />
                  )}
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                      {isNew ? '✦ Nový záznam webináře' : 'Editace záznamu'}
                    </div>
                    <h2 className="font-bold text-[18px] text-[#001161] leading-tight">
                      {form.title || (isNew ? 'Nový webinář' : 'Bez názvu')}
                    </h2>
                    {!isNew && selected && (
                      <div className="text-[12px] text-gray-500 mt-1">
                        {selected.day}. {selected.monthName} {selected.year}
                        {selected.lecturer && ` · ${selected.lecturer}`}
                      </div>
                    )}
                    {!isNew && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {matchedDvpp ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Link className="w-2.5 h-2.5" />
                            {'DVPP video napárováno: '}{(matchedDvpp.name || '').slice(0, 28)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                            <Unlink className="w-2.5 h-2.5" />
                            {'Bez DVPP záznamu — uložením vytvoříte nový'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isNew && (
                    <button onClick={() => setIsNew(false)}
                      className="flex items-center gap-1.5 border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-[12px] font-bold hover:bg-gray-50 transition-colors">
                      <X className="w-3.5 h-3.5" /> {'Zrušit'}
                    </button>
                  )}
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-colors">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Ukládám…' : isNew ? 'Vytvořit' : 'Uložit'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── ZÁZNAM (YouTube) ── */}
            <Section
              icon={<Play className="w-4 h-4" />}
              title={'Záznam webináře'}
              subtitle={'YouTube URL videa'}
              color="#ef4444" bgColor="#FEF2F2"
              badge={form.recordingUrl
                ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Nastaven</span>
                : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Prázdný</span>
              }
            >
              <Field
                label={'YouTube URL záznamu'}
                hint={'Video se zobrazí na veřejné stránce webináře jako záznam.'}
              >
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.recordingUrl}
                    onChange={e => upd({ recordingUrl: e.target.value })}
                    placeholder={'https://www.youtube.com/watch?v=…'}
                    className={inputCls + ' flex-1 font-mono text-[12px]'}
                  />
                  {form.recordingUrl && videoId && (
                    <a href={form.recordingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl hover:bg-red-100 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {form.recordingUrl && (
                    <button onClick={() => upd({ recordingUrl: '' })}
                      className="flex items-center px-2 py-2 border border-gray-200 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Field>

              {videoId ? (
                <div className="rounded-xl overflow-hidden border border-gray-100 bg-black" style={{ aspectRatio: '16/9' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={'Náhled záznamu'}
                    className="w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                  />
                </div>
              ) : form.recordingUrl && !videoId ? (
                <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-4 flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-[12px] text-red-600">{'Neplatná YouTube URL — zkontroluj odkaz'}</span>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 flex flex-col items-center justify-center gap-2">
                  <Video className="w-8 h-8 text-gray-300" />
                  <span className="text-[12px] text-gray-400">{'Vlož YouTube URL záznamu výše'}</span>
                </div>
              )}
            </Section>

            {/* ── TLAČÍTKA ── */}
            <Section
              icon={<Link2 className="w-4 h-4" />}
              title={'Tlačítka a odkazy'}
              subtitle={'Certifikát DVPP · CTA tlačítko'}
              color="#0ea5e9" bgColor="#F0F9FF"
              badge={
                (form.certificateUrl || form.orangeButtonLink)
                  ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Nastavena</span>
                  : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Prázdná</span>
              }
            >
              {/* Certifikát DVPP */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-gray-600" />
                  <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">{'Certifikát DVPP (šedé tlačítko)'}</span>
                </div>
                <Field
                  label={'URL certifikátu'}
                  hint={'Odkaz na formulář pro vyžádání certifikátu (Google Form, Typeform…)'}
                >
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={form.certificateUrl}
                      onChange={e => upd({ certificateUrl: e.target.value })}
                      placeholder={'https://forms.google.com/…'}
                      className={inputCls + ' flex-1 font-mono text-[12px]'}
                    />
                    {form.certificateUrl && (
                      <>
                        <a href={form.certificateUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => upd({ certificateUrl: '' })}
                          className="flex items-center px-2 py-2 border border-gray-200 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-400 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </Field>
                <Field label={'Text tlačítka'}>
                  <input
                    value={form.greyButtonText}
                    onChange={e => upd({ greyButtonText: e.target.value })}
                    placeholder={'Certifikát DVPP'}
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* CTA button */}
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span className="text-[12px] font-bold text-purple-700 uppercase tracking-wide">{'CTA tlačítko (fialové) — Vyzkoušejte'}</span>
                </div>
                <Field label={'Text tlačítka'}>
                  <input
                    value={form.orangeButtonText}
                    onChange={e => upd({ orangeButtonText: e.target.value })}
                    placeholder={'Vyzkoušejte zdarma'}
                    className={inputCls}
                  />
                </Field>
                <Field label={'Odkaz'}>
                  <input
                    value={form.orangeButtonLink}
                    onChange={e => upd({ orangeButtonLink: e.target.value })}
                    placeholder={'/vyzkousejte'}
                    className={inputCls + ' font-mono text-[12px]'}
                  />
                </Field>
              </div>
            </Section>

            {/* ── ZÁKLADNÍ INFORMACE ── */}
            <Section
              icon={<FileText className="w-4 h-4" />}
              title={'Základní informace'}
              subtitle={'Název, datum, přednášející'}
              defaultOpen={false}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label={'Název webináře *'}>
                    <input value={form.title} onChange={e => upd({ title: e.target.value })}
                      placeholder={'Jak na zlomky ve Vividbooks Matematice'} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Podtitulek'}>
                    <input value={form.subtitle} onChange={e => upd({ subtitle: e.target.value })}
                      placeholder={'ve Vividbooks Matematice.'} className={inputCls} />
                  </Field>
                </div>
                <Field label={'Den'}>
                  <input type="number" min={1} max={31} value={form.day}
                    onChange={e => upd({ day: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label={'Měsíc'}>
                  <select value={form.monthNum} onChange={e => upd({ monthNum: Number(e.target.value) })} className={inputCls}>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </Field>
                <Field label={'Rok'}>
                  <input type="number" min={2020} max={2099} value={form.year}
                    onChange={e => upd({ year: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label={'Čas'}>
                  <input value={form.time} onChange={e => upd({ time: e.target.value })}
                    placeholder={'18:00'} className={inputCls} />
                </Field>
                <div className="col-span-2">
                  <Field label={'Přednášející'}>
                    <input value={form.lecturer} onChange={e => upd({ lecturer: e.target.value })}
                      placeholder={'František Cáb'} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Cílová skupina'}>
                    <input value={form.targetAudience} onChange={e => upd({ targetAudience: e.target.value })}
                      placeholder={'Pro učitele matematiky'} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'URL obrázku (cover)'}>
                    <div className="flex gap-2">
                      <input value={form.coverImage} onChange={e => upd({ coverImage: e.target.value })}
                        placeholder={'https://…'} className={inputCls + ' flex-1'} />
                      {form.coverImage && (
                        <img src={form.coverImage} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                      )}
                    </div>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Popis webináře'}>
                    <textarea value={form.description} onChange={e => upd({ description: e.target.value })} rows={3}
                      placeholder={'Popiš, co se účastníci dozví…'} className={textareaCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={'Perky / co získá účastník'}>
                    <textarea value={form.perks} onChange={e => upd({ perks: e.target.value })} rows={2}
                      placeholder={'Účastníci webináře získají…'} className={textareaCls} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* ── PŘEPIS ── */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">{'Přepis webináře'}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">{'Textový přepis — pro RAG indexaci'}</p>
                  </div>
                </div>
                {form.prepis && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 font-mono">
                      {form.prepis.length.toLocaleString('cs-CZ')} zn.
                    </span>
                    <button onClick={() => upd({ prepis: '' })}
                      className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <textarea
                value={form.prepis}
                onChange={e => upd({ prepis: e.target.value })}
                placeholder={'Vložte sem přepis webináře…\n\nTip: YouTube → Titulky → Zobrazit přepis'}
                rows={12}
                className="w-full px-5 py-4 text-[13px] text-[#001161] leading-relaxed resize-none outline-none border-0 focus:ring-0"
                style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              />
              {form.prepis && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between text-[11px] text-gray-400">
                  <span>{'~'}{Math.ceil(form.prepis.length / 1600)}{' chunků po indexaci'}</span>
                  <span>gemini-embedding-001 · 3072 dim.</span>
                </div>
              )}
            </div>

            {/* ── RAG INDEXACE ── */}
            {!isNew && selected && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-gray-700 uppercase tracking-wide">RAG Indexace</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">{'Přepis se embeduje do znalostní báze'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Chunků v RAG',       val: status?.loading ? null : (status?.count ?? 0) },
                    { label: 'Chunků po indexaci',  val: form.prepis ? Math.ceil(form.prepis.length / 1600) : 0 },
                    { label: 'Znaků přepisu',       val: form.prepis ? form.prepis.length.toLocaleString('cs-CZ') : '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-[18px] font-bold text-[#001161]" style={{ fontFamily: "'Cooper Light', serif" }}>
                        {s.val === null ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /> : s.val}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {status && status.count > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-[12px] text-emerald-700 font-bold">
                      {`Indexováno — ${status.count} chunků v RAG`}
                      {status.lastIndexed && ` · naposledy ${status.lastIndexed}`}
                    </span>
                  </div>
                )}

                {!form.prepis && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <Info className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[12px] text-amber-700">{'Nejdříve vyplň přepis výše (nemusíš nejdříve ukládat).'}</span>
                  </div>
                )}

                <button
                  onClick={handleIndexRag}
                  disabled={!form.prepis.trim() || !!indexing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-[14px] font-bold transition-colors"
                >
                  {indexing === selected?.id
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{'Indexuji přepis do RAG…'}</>
                    : <><Brain className="w-4 h-4" />{'Indexovat přepis do RAG'}</>
                  }
                </button>

                <p className="mt-3 text-[11px] text-gray-400 text-center leading-relaxed">
                  {'Přepis je v záznamu webináře (úložiště CMS). Po „Indexovat“ se uloží do RAG tabulek v Supabase ('}
                  <code className="text-[10px] bg-gray-100 px-1 rounded">rag_chunks</code>
                  {').'}
                </p>
              </div>
            )}

          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#f7f8fc]">
          <div className="text-center">
            <div className="w-20 h-20 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Clock className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-[15px] font-semibold text-gray-500">{'Vyberte minulý webinář'}</p>
            <p className="text-[12px] text-gray-400 mt-1 mb-5">{'Přidejte záznam, certifikát a přepis pro RAG indexaci'}</p>
            <button onClick={handleNewRecord}
              className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors">
              <Plus className="w-4 h-4" />
              {'Nový záznam webináře'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
