import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import {
  Plus, Search, Save, X, Globe, Lock, Loader2, ExternalLink,
  RefreshCw, Radio, Image, Video, Bold, Italic, List,
  Undo2, Redo2, Quote, Trash2, Calendar, Clock, User, Link2,
  CheckCircle, Circle, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useWebinars } from '../../contexts/WebinarsContext';
import type { Webinar, WebinarSurveyQuestion, WebinarSurveyQuestionType } from '../../data/webinars';
import { DEFAULT_WEBINAR_SURVEY_QUESTIONS } from '../../utils/webinarSurveyDefaults';
import { ImagePicker } from './ImagePicker';
import { compareWebinarsBySchedule, computeWebinarIsPastFromSchedule, DEFAULT_WEBINAR_DURATION_MIN } from '../../utils/webinarEventTimestamp';
import { publicSiteUrl } from '../../utils/publicSiteUrl';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

const MONTHS_CS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

function slugify(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function emptyWebinar(): Partial<Webinar> {
  const now = new Date();
  return {
    title: '', subtitle: '', slug: '',
    day: now.getDate(), monthNum: now.getMonth() + 1,
    monthName: MONTHS_CS[now.getMonth()], year: now.getFullYear(),
    time: '18:00', lecturer: '', lecturerAvatar: '', coverImage: '',
    description: '', perks: '', targetAudience: '', zoomLink: '',
    liveDeliveryMode: 'live_stream',
    relatedSubjects: [], tags: [], highlightQuote: '',
    mailchimpTagName: '',
    thumbnailVariant: 1, isPast: false,
    durationMinutes: DEFAULT_WEBINAR_DURATION_MIN,
    surveyEnabled: true,
    surveyQuestions: [],
  };
}

/* ─ HTML ↔ TipTap ───────────────────────────────────────────────── */
function extractYoutubeId(url: string): string | null {
  const pats = [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/, /youtu\.be\/([a-zA-Z0-9_-]+)/];
  for (const p of pats) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

/* ─ YouTube TipTap extension ─────────────────────────────────────── */
function YoutubeNodeView({ node, deleteNode }: any) {
  const { videoId, title } = node.attrs;
  return (
    <NodeViewWrapper>
      <div className="relative group my-4" contentEditable={false}>
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
          <iframe src={`https://www.youtube.com/embed/${videoId}`} title={title || 'Video'}
            className="absolute inset-0 w-full h-full pointer-events-none" frameBorder="0" allowFullScreen />
        </div>
        {title && <p className="text-center text-[11px] text-gray-400 mt-1">{title}</p>}
        <button onClick={deleteNode}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
          <X className="w-3 h-3" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

const YoutubeEmbed = TiptapNode.create({
  name: 'youtubeEmbed',
  group: 'block',
  atom: true,
  addAttributes() { return { videoId: { default: '' }, title: { default: '' } }; },
  parseHTML() {
    return [{ tag: 'div[data-youtube-id]', getAttrs: (el: HTMLElement) => ({
      videoId: el.getAttribute('data-youtube-id') || '',
      title: el.getAttribute('data-youtube-title') || '',
    }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-youtube-id': HTMLAttributes.videoId, 'data-youtube-title': HTMLAttributes.title })];
  },
  addNodeView() { return ReactNodeViewRenderer(YoutubeNodeView); },
});

/* ─ Toolbar ──────────────────────────────────────────────────────── */
function ToolbarBtn({ active, title, onClick, children }: {
  active?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onMouseDown={e => { e.preventDefault(); onClick(); }} title={title}
      className={`p-1.5 rounded-md transition-colors text-[13px] font-bold ${
        active ? 'bg-[#001161] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-[#001161]'
      }`}>
      {children}
    </button>
  );
}

function Toolbar({ editor, onImage, onVideo }: { editor: any; onImage: () => void; onVideo: () => void }) {
  if (!editor) return null;
  const sep = <div className="w-px h-5 bg-gray-200 mx-0.5" />;
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-[#fafafa] flex-wrap">
      <ToolbarBtn active={editor.isActive('bold')} title="Tu\u010dn\u00e9" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} title="Kurz\u00edva" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={editor.isActive('heading', { level: 2 })} title="Nadpis H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span className="text-[11px] font-black">H2</span>
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={editor.isActive('blockquote')} title="Cit\u00e1t" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('bulletList')} title="Odr\u00e1\u017eky" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={false} title="Vlo\u017eit obr\u00e1zek" onClick={onImage}>
        <Image className="w-3.5 h-3.5 text-green-600" />
      </ToolbarBtn>
      <ToolbarBtn active={false} title="Vlo\u017eit YouTube" onClick={onVideo}>
        <Video className="w-3.5 h-3.5 text-red-500" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={false} title="Zp\u011bt" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn active={false} title="Vp\u0159ed" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
    </div>
  );
}

export type WebinareEditorProps = {
  /** Po uložení webináře s `isPast: true` — např. přepnutí na záložku Uplynulé webináře. */
  onMarkedPast?: (webinarId: string) => void;
};

/* ─ Main component ───────────────────────────────────────────────── */
export default function WebinareEditor({ onMarkedPast }: WebinareEditorProps = {}) {
  const { refresh: refreshContext } = useWebinars();

  const [items, setItems] = useState<Webinar[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const [selected, setSelected] = useState<Partial<Webinar> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [copiedLive, setCopiedLive] = useState(false);
  const [devImminent, setDevImminent] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('vvb_dev_imminent') : null
  );
  const [reminderTestBusy, setReminderTestBusy] = useState(false);

  function handleCopyLive() {
    const url = publicSiteUrl(`/webinar/${selected?.slug || selected?.id}/live`);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLive(true);
      setTimeout(() => setCopiedLive(false), 2000);
    });
  }

  async function persistDevReminderFlags(body: {
    devSimulateReminderT30?: boolean;
    devSimulateReminderMorning?: boolean;
  }) {
    const id = selected?.id;
    if (!id || isNew) return;
    try {
      const res = await fetch(`${SERVER}/admin/webinare/${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || res.statusText);
      }
      await loadList();
      refreshContext();
    } catch (e: any) {
      toast.error(e.message || 'Uložení vývojových přepínačů selhalo.');
    }
  }

  async function toggleDevImminent() {
    const id = selected?.id;
    if (!id || isNew) return;
    if (devImminent === id) {
      localStorage.removeItem('vvb_dev_imminent');
      setDevImminent(null);
      await persistDevReminderFlags({ devSimulateReminderT30: false });
      setSelected(prev => (prev ? { ...prev, devSimulateReminderT30: false } : prev));
    } else {
      localStorage.setItem('vvb_dev_imminent', id);
      setDevImminent(id);
      await persistDevReminderFlags({ devSimulateReminderT30: true, devSimulateReminderMorning: false });
      setSelected(prev =>
        prev ? { ...prev, devSimulateReminderT30: true, devSimulateReminderMorning: false } : prev,
      );
    }
  }

  async function toggleDevToday() {
    const id = selected?.id;
    if (!id || isNew) return;
    const next = !selected.devSimulateReminderMorning;
    if (next) {
      localStorage.removeItem('vvb_dev_imminent');
      setDevImminent(null);
      await persistDevReminderFlags({ devSimulateReminderMorning: true, devSimulateReminderT30: false });
      setSelected(prev =>
        prev ? { ...prev, devSimulateReminderMorning: true, devSimulateReminderT30: false } : prev,
      );
    } else {
      await persistDevReminderFlags({ devSimulateReminderMorning: false });
      setSelected(prev => (prev ? { ...prev, devSimulateReminderMorning: false } : prev));
    }
  }

  async function sendReminderTest(kind: 'morning' | 't30') {
    const id = selected?.id;
    if (!id || isNew) return;
    setReminderTestBusy(true);
    try {
      const res = await fetch(`${SERVER}/admin/webinar-reminder-test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ webinarId: id, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
        return;
      }
      if (data.ok) {
        toast.success(
          `Odesláno na ${data.to} (${kind === 't30' ? 'Za chvíli' : 'Dnes'}).`,
        );
      } else {
        toast.error(data.detail || 'Mandrill neodeslal — zkontrolujte Centrálu alertů.');
      }
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setReminderTestBusy(false);
    }
  }

  async function sendRegistrationConfirmationTest() {
    const id = selected?.id;
    if (!id || isNew) return;
    setReminderTestBusy(true);
    try {
      const res = await fetch(`${SERVER}/admin/webinar-registration-test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ webinarId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
        return;
      }
      if (data.ok) {
        toast.success(`Potvrzovací mail odeslán na ${data.to}.`);
      } else {
        toast.error(data.detail || 'Mandrill neodeslal — zkontrolujte Centrálu alertů.');
      }
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setReminderTestBusy(false);
    }
  }

  const descEditor = useEditor({
    extensions: [
      StarterKit,
      TiptapImage.configure({ inline: false }),
      YoutubeEmbed,
    ],
    content: '<p></p>',
    editorProps: { attributes: { class: 'vvb-webinar-editor' } },
  });

  // Dialog states
  const [imgDialog, setImgDialog] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [vidDialog, setVidDialog] = useState(false);
  const [vidUrl, setVidUrl] = useState('');
  const [vidTitle, setVidTitle] = useState('');

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${SERVER}/admin/webinare`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!descEditor || !selected) return;
    const descHtml = selected.description
      ? (selected.description.includes('<') ? selected.description : `<p>${selected.description}</p>`)
      : '<p></p>';
    descEditor.commands.setContent(descHtml, false);
  }, [selected?.id, descEditor]);

  const filtered = useMemo(() => {
    const rows = items.filter((w) => {
      const ms = !search || (w.title || '').toLowerCase().includes(search.toLowerCase());
      const mf =
        timeFilter === 'all' ||
        (timeFilter === 'upcoming' && !w.isPast) ||
        (timeFilter === 'past' && !!w.isPast);
      return ms && mf;
    });
    return [...rows].sort(compareWebinarsBySchedule);
  }, [items, search, timeFilter]);

  function handleSelect(item: Webinar) {
    setSelected({ ...item });
    setIsNew(false);
    setSlugManual(true);
    if (item.devSimulateReminderT30) {
      try {
        localStorage.setItem('vvb_dev_imminent', item.id);
        setDevImminent(item.id);
      } catch {
        /* ignore */
      }
    } else {
      try {
        const stored = localStorage.getItem('vvb_dev_imminent');
        if (stored === item.id) {
          localStorage.removeItem('vvb_dev_imminent');
          setDevImminent(null);
        }
      } catch {
        /* ignore */
      }
    }
  }

  function handleNew() {
    setSelected(emptyWebinar());
    setIsNew(true);
    setSlugManual(false);
    descEditor?.commands.setContent('<p></p>', false);
  }

  function handleClose() {
    setSelected(null);
    descEditor?.commands.setContent('<p></p>', false);
  }

  function updateField(key: string, value: any) {
    setSelected(prev => {
      if (!prev) return prev;
      const next: any = { ...prev, [key]: value };
      // auto-update monthName when monthNum changes
      if (key === 'monthNum') {
        next.monthName = MONTHS_CS[Number(value) - 1] || 'Leden';
      }
      /* Minulý = po skončení (datum + čas + odhad délky), ne jen po půlnoci dne akce. */
      if (key === 'day' || key === 'monthNum' || key === 'year' || key === 'time' || key === 'durationMinutes') {
        const clock = new Date();
        next.isPast = computeWebinarIsPastFromSchedule({
          year: next.year ?? clock.getFullYear(),
          monthNum: next.monthNum ?? 1,
          day: next.day ?? 1,
          time: next.time ?? '18:00',
          durationMinutes:
            typeof next.durationMinutes === 'number' && next.durationMinutes > 0 ? next.durationMinutes : undefined,
        });
      }
      if (key === 'title' && !slugManual) next.slug = slugify(String(value));
      return next;
    });
  }

  async function handleSave() {
    if (!selected || !descEditor) return;
    if (!selected.title?.trim()) { toast.error('Titulek je povinný.'); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...selected,
        description: descEditor.getHTML(),
        id: selected.id || `webinar-${Date.now()}`,
        slug: selected.slug || slugify(selected.title || ''),
        updatedAt: new Date().toISOString(),
        /** Explicitně — některé klienty / serializace mohly vynechat příznak. */
        isPast: !!selected.isPast,
      };
      const url = isNew ? `${SERVER}/admin/webinare` : `${SERVER}/admin/webinare/${encodeURIComponent(String(selected.id))}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(typeof e.error === 'string' ? e.error : res.statusText || `HTTP ${res.status}`);
      }
      toast.success(isNew ? 'Webin\u00e1\u0159 ulo\u017een!' : 'Ulo\u017eeno!');
      await loadList();
      refreshContext();
      if (payload.isPast) {
        onMarkedPast?.(String(payload.id));
      }
      setIsNew(false);
      setSlugManual(true);
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected?.id || isNew) return;
    if (!confirm('Opravdu smazat tento webin\u00e1\u0159?')) return;
    setSaving(true);
    try {
      await fetch(`${SERVER}/admin/webinare/${encodeURIComponent(String(selected.id))}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      toast.success('Smaz\u00e1no!');
      setSelected(null);
      await loadList();
      refreshContext();
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function insertImage() {
    if (!descEditor || !imgUrl.trim()) return;
    descEditor.chain().focus().setImage({ src: imgUrl.trim(), alt: imgAlt.trim() }).run();
    setImgDialog(false); setImgUrl(''); setImgAlt('');
  }

  function insertVideo() {
    if (!descEditor) return;
    const id = extractYoutubeId(vidUrl.trim());
    if (!id) { toast.error('Neplatn\u00e1 YouTube URL'); return; }
    descEditor.chain().focus().insertContent({ type: 'youtubeEmbed', attrs: { videoId: id, title: vidTitle.trim() } }).run();
    setVidDialog(false); setVidUrl(''); setVidTitle('');
  }

  const upcomingCount = items.filter(w => !w.isPast).length;
  const pastCount     = items.filter(w => !!w.isPast).length;

  return (
    <>
      <style>{`
        .vvb-webinar-editor { outline: none; min-height: 180px; padding: 1rem 1.25rem 2rem; font-family: 'Fenomen Sans', sans-serif; color: #001161; font-size: 14px; line-height: 1.8; }
        .vvb-perks-editor { min-height: 120px; }
        .vvb-webinar-editor p { margin-bottom: 0.75rem; }
        .vvb-webinar-editor h2 { font-size: 1.15rem; font-weight: 800; margin: 1.8rem 0 0.5rem; }
        .vvb-webinar-editor blockquote { border-left: 4px solid #7C3AED; padding: 0.6rem 1rem; background: #f5f3ff; border-radius: 8px; margin: 1rem 0; }
        .vvb-webinar-editor ul { padding-left: 1.4rem; margin-bottom: 0.8rem; list-style: disc; }
        .vvb-webinar-editor li { margin-bottom: 0.25rem; }
        .vvb-webinar-editor strong { font-weight: 700; }
        .vvb-webinar-editor img { max-width: 100%; border-radius: 10px; margin: 0.8rem 0; display: block; }
        .vvb-webinar-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #c0c4d0; pointer-events: none; float: left; height: 0; }
        .vvb-webinar-editor .ProseMirror-selectednode { outline: 2px solid #7C3AED; border-radius: 4px; }
      `}</style>

      <div className="h-full flex overflow-hidden bg-[#f7f8fc]">

        {/* ── LEFT LIST ──────────────────────────────────────────── */}
        <div className="w-[270px] bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">
                {'Webin\u00e1\u0159e'} <span className="text-gray-400 font-normal">({items.length})</span>
              </span>
              <button onClick={handleNew}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-colors">
                <Plus className="w-3.5 h-3.5" /> {'Nov\u00fd'}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat\u2026"
                className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all" />
            </div>
            <div className="flex gap-1">
              {([
                { key: 'all',      label: `V\u0161e (${items.length})` },
                { key: 'upcoming', label: `Plán. (${upcomingCount})` },
                { key: 'past',     label: `Min. (${pastCount})` },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTimeFilter(t.key)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${timeFilter === t.key ? 'bg-[#001161] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {t.label}
                </button>
              ))}
              <button onClick={loadList} className="ml-auto p-1 text-gray-400 hover:text-[#001161]" title="Obnovit">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-[12px]">{'Ž\u00e1dn\u00e9 webin\u00e1\u0159e'}</div>
            ) : filtered.map(item => {
              const isSel = selected?.id === item.id && !isNew;
              return (
                <button key={item.id} onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 flex items-start gap-2.5 transition-all ${isSel ? 'bg-[#001161]' : 'hover:bg-gray-50'}`}>
                  {item.coverImage ? (
                    <img src={item.coverImage} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-100" alt="" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4 text-purple-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-semibold leading-snug line-clamp-2 ${isSel ? 'text-white' : 'text-[#001161]'}`}>
                      {item.title || 'Bez n\u00e1zvu'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-mono ${isSel ? 'text-purple-200' : 'text-gray-400'}`}>
                        {item.day}. {item.monthName} {item.year} · {item.time}
                      </span>
                      {item.isPast && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSel ? 'bg-purple-800 text-purple-200' : 'bg-gray-100 text-gray-400'}`}>
                          MIN
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT EDITOR ────────────────────────────────────────── */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* Top bar */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0">
              <span className="text-[13px] font-semibold text-[#001161] truncate flex-1 min-w-0">
                {selected.title || (isNew ? 'Nov\u00fd webin\u00e1\u0159' : 'Bez n\u00e1zvu')}
              </span>
              {/* isPast toggle */}
              <button onClick={() => updateField('isPast', !selected.isPast)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all shrink-0 ${
                  selected.isPast
                    ? 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                    : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                }`}>
                {selected.isPast ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                {selected.isPast ? 'Minul\u00fd' : 'Pl\u00e1novan\u00fd'}
              </button>
              {!isNew && (
                <button onClick={handleDelete} disabled={saving}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Smazat">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={handleClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Ukl\u00e1d\u00e1m\u2026' : 'Ulo\u017eit'}
              </button>
            </div>

            {/* Scrollable form + editors */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-[860px] mx-auto p-6 space-y-6">

                {/* ── Základní pole ──────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Základní informace</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Titulek *</label>
                      <input type="text" value={selected.title || ''} onChange={e => updateField('title', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Podtitulek</label>
                      <input type="text" value={selected.subtitle || ''} onChange={e => updateField('subtitle', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">Slug (URL)</label>
                    <input type="text" value={selected.slug || ''} onChange={e => { setSlugManual(true); updateField('slug', e.target.value); }}
                      className="w-full px-3 py-2 text-[13px] font-mono border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">
                      {'Mailchimp tag (voliteln\u00e9)'}
                    </label>
                    <input
                      type="text"
                      value={selected.mailchimpTagName ?? ''}
                      onChange={e => updateField('mailchimpTagName', e.target.value)}
                      placeholder={'P\u0159esn\u011b jako tag v Audience, pokud nen\u00ed webinar-{slug}'}
                      className="w-full px-3 py-2 text-[13px] font-mono border border-gray-200 rounded-xl focus:border-purple-400 outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      {'Pokud v Mailchimp pou\u017e\u00edv\u00e1te dlouh\u00fd n\u00e1zev s datem, zkop\u00edrujte ho sem. Jinak se hled\u00e1 tag webinar-{slug} a tagy podle titulku.'}
                    </p>
                  </div>

                  {/* Live link */}
                  {!isNew && selected.slug && (
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1 flex items-center gap-1">
                        <Radio className="w-3 h-3 text-red-500" /> {'Odkaz na live vys\u00edl\u00e1n\u00ed'}
                      </label>
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <span className="flex-1 text-[12px] font-mono text-red-700 truncate select-all">
                          {publicSiteUrl(`/webinar/${selected.slug}/live`)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyLive}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white border border-red-200 hover:border-red-400 text-red-600 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                        >
                          {copiedLive ? <><Check className="w-3 h-3 text-green-600" /><span className="text-green-600">{'Zkopirov\u00e1no'}</span></> : <><Copy className="w-3 h-3" />{'Kop\u00edrovat'}</>}
                        </button>
                        <a
                          href={`/webinar/${selected.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-all no-underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {'Otev\u0159\u00edt'}
                        </a>
                        <a
                          href={`/webinar/${selected.slug}/live?preview=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-[#FF8C00] hover:bg-[#e67d00] text-white rounded-lg text-[11px] font-bold transition-all no-underline"
                        >
                          <Radio className="w-3 h-3" />
                          {'N\u00e1hled'}
                        </a>
                      </div>

                      {/* Dev switch: simulace "začíná za chvíli" pro slider */}
                      <div
                        className={`mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          devImminent === selected.id || selected.devSimulateReminderT30
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => void toggleDevImminent()}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{'🧪'}</span>
                          <div>
                            <span className="text-[11px] font-bold text-gray-600 block leading-tight">
                              {'V\u00fdvoj: Za\u010d\u00edn\u00e1 za chv\u00edli'}
                            </span>
                            <span className="text-[10px] text-gray-400 leading-tight">
                              {devImminent === selected.id || selected.devSimulateReminderT30
                                ? 'Slider v katalogu + cron ode\u0161le mail \u201eZa chv\xedli\u201c (p\u0159i b\u011bhu cronu)'
                                : 'Simuluje webinář do 30 min \u2014 ukáže slide v katalogu; pro test e-mailu zapnout'}
                            </span>
                          </div>
                        </div>
                        <div className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${devImminent === selected.id || selected.devSimulateReminderT30 ? 'bg-amber-400' : 'bg-gray-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${devImminent === selected.id || selected.devSimulateReminderT30 ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                      </div>
                      <div
                        className={`mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          selected.devSimulateReminderMorning
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => void toggleDevToday()}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base leading-none shrink-0">{'🧪'}</span>
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-gray-600 block leading-tight">
                              {'V\u00fdvoj: Za\u010d\u00edn\u00e1 dnes'}
                            </span>
                            <span className="text-[10px] text-gray-400 leading-tight block">
                              {selected.devSimulateReminderMorning
                                ? 'Cron ode\u0161le rann\xed p\u0159ipom\xednku \u201eDnes v\xe1s \u010dek\xe1 webin\xe1\u0159\u201c (p\u0159i b\u011bhu cronu)'
                                : 'Vynut\xed odesl\xe1n\xed mailu \u201eDnes\u201c m\xedsto \u010dasu 7\u201310 h'}
                            </span>
                          </div>
                        </div>
                        <div className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${selected.devSimulateReminderMorning ? 'bg-emerald-400' : 'bg-gray-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${selected.devSimulateReminderMorning ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        <p className="text-[10px] text-gray-500 leading-snug px-0.5">
                          {'Nejrychlej\u0161\xed test: ode\u0161lete si zku\u0161ebn\xed mail na e-mail prvn\xed registrace (bez cronu). P\u0159ep\xedna\u010de v\xfdvoje jen \u0159\xedd\xed automatick\xfd b\u011bh p\u0159ipom\xednek.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={reminderTestBusy}
                            onClick={() => void sendReminderTest('morning')}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
                          >
                            {reminderTestBusy ? '\u2026' : 'Test mail \u201eDnes\u201c'}
                          </button>
                          <button
                            type="button"
                            disabled={reminderTestBusy}
                            onClick={() => void sendReminderTest('t30')}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors"
                          >
                            {reminderTestBusy ? '\u2026' : 'Test mail \u201eZa chv\xedli\u201c'}
                          </button>
                          <button
                            type="button"
                            disabled={reminderTestBusy}
                            onClick={() => void sendRegistrationConfirmationTest()}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white transition-colors"
                          >
                            {reminderTestBusy ? '\u2026' : 'Test mail po registraci'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-snug px-0.5">
                          {'Cron v produkci: '}
                          <code className="text-[9px] bg-gray-100 px-1 rounded">POST \u2026/cron/webinar-reminders</code>
                          {' + '}
                          <code className="text-[9px] bg-gray-100 px-1 rounded">WEBINAR_REMINDER_CRON_SECRET</code>
                          {'. Po otestov\xe1n\xed v\xfdvoj vypn\u011bte \u2014 m\u016f\u017ee pos\xedlat opakovan\u011b.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Datum a čas ────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Datum a čas
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Den</label>
                      <input type="number" min={1} max={31} value={selected.day || 1} onChange={e => updateField('day', Number(e.target.value))}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Měsíc</label>
                      <select value={selected.monthNum || 1} onChange={e => updateField('monthNum', Number(e.target.value))}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none bg-white">
                        {MONTHS_CS.map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Rok</label>
                      <input type="number" min={2024} max={2030} value={selected.year || new Date().getFullYear()} onChange={e => updateField('year', Number(e.target.value))}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Čas
                      </label>
                      <input type="text" value={selected.time || '18:00'} onChange={e => updateField('time', e.target.value)}
                        placeholder="18:00"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1" title="Od začátku do odhadovaného konce — pak se webinář sám označí jako minulý">
                        Délka (min)
                      </label>
                      <input
                        type="number"
                        min={30}
                        max={600}
                        value={selected.durationMinutes ?? DEFAULT_WEBINAR_DURATION_MIN}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            updateField('durationMinutes', undefined);
                            return;
                          }
                          const n = Number(raw);
                          updateField('durationMinutes', Number.isFinite(n) && n > 0 ? n : undefined);
                        }}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    Po skončení (čas začátku + délka) se webinář v úložišti označí jako minulý — objeví se v záložce Uplynulé (cron nebo uložení v editoru). Výchozí délku lze změnit env{' '}
                    <code className="text-[9px] bg-gray-100 px-1 rounded">WEBINAR_DEFAULT_DURATION_MIN</code>
                    {' '}na serveru.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-[12px] text-gray-500">
                    <span>Datum webináře:</span>
                    <span className="font-bold text-[#001161]">
                      {selected.day}. {MONTHS_CS[(selected.monthNum || 1) - 1]} {selected.year} od {selected.time}
                      {' '}(cca {selected.durationMinutes ?? DEFAULT_WEBINAR_DURATION_MIN} min)
                    </span>
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selected.isPast ? 'bg-gray-200 text-gray-500' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {selected.isPast ? 'MINULÝ' : 'PLÁNOVANÝ'}
                    </span>
                  </div>
                </div>

                {/* ── Dotazník po registraci ─────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">
                    Dotazník po registraci
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.surveyEnabled !== false}
                      onChange={(e) => updateField('surveyEnabled', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-[13px] text-[#001161] font-semibold">{'Zobrazit kr\u00e1tk\u00fd dotazn\u00edk po odesl\u00e1n\u00ed registrace'}</span>
                  </label>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {
                      'Zobraz\u00ed se p\u0159ed blokem se zku\u0161ebn\u00edm p\u0159\u00edstupem. Pr\u00e1zdn\u00fd seznam = t\u0159i v\u00fdchoz\u00ed ot\u00e1zky (motivace, z\u00e1jem, Vividbooks ano/ne).'
                    }
                  </p>
                  {selected.surveyEnabled !== false && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateField('surveyQuestions', DEFAULT_WEBINAR_SURVEY_QUESTIONS.map((q) => ({ ...q })))
                        }
                        className="text-[12px] font-bold text-purple-600 hover:underline"
                      >
                        {'Obnovit v\u00fdchoz\u00ed t\u0159i ot\u00e1zky'}
                      </button>
                      {(selected.surveyQuestions || []).map((q, qi) => (
                        <div key={q.id || qi} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono text-gray-400 truncate">{q.id}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...(selected.surveyQuestions || [])];
                                next.splice(qi, 1);
                                updateField('surveyQuestions', next);
                              }}
                              className="text-[11px] text-red-500 hover:underline shrink-0"
                            >
                              {'Odebrat'}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={q.label}
                            onChange={(e) => {
                              const next = [...(selected.surveyQuestions || [])];
                              next[qi] = { ...next[qi], label: e.target.value };
                              updateField('surveyQuestions', next);
                            }}
                            placeholder="Text ot\u00e1zky"
                            className="w-full px-2 py-1.5 text-[13px] border border-gray-200 rounded-lg bg-white"
                          />
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const next = [...(selected.surveyQuestions || [])];
                              const t = e.target.value as WebinarSurveyQuestionType;
                              next[qi] = {
                                ...next[qi],
                                type: t,
                                options: t === 'abc' ? next[qi].options?.length ? next[qi].options : ['Mo\u017enost A', 'Mo\u017enost B'] : undefined,
                              };
                              updateField('surveyQuestions', next);
                            }}
                            className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white"
                          >
                            <option value="open">{'Otev\u0159en\u00e1 odpov\u011b\u010f'}</option>
                            <option value="abc">{'V\u00fdb\u011br z mo\u017enost\u00ed (ABC)'}</option>
                            <option value="yes_no">{'Ano / Ne'}</option>
                          </select>
                          {q.type === 'abc' && (
                            <textarea
                              value={(q.options || []).join('\n')}
                              onChange={(e) => {
                                const opts = e.target.value
                                  .split('\n')
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                const next = [...(selected.surveyQuestions || [])];
                                next[qi] = { ...next[qi], options: opts };
                                updateField('surveyQuestions', next);
                              }}
                              placeholder={'Mo\u017enost na \u0159\u00e1dek'}
                              rows={3}
                              className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white font-mono"
                            />
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const id = `q_${Date.now()}`;
                          const row: WebinarSurveyQuestion = {
                            id,
                            type: 'open',
                            label: 'Nov\u00e1 ot\u00e1zka',
                          };
                          updateField('surveyQuestions', [...(selected.surveyQuestions || []), row]);
                        }}
                        className="text-[12px] font-bold text-[#001161] border border-dashed border-gray-300 rounded-lg px-3 py-2 w-full hover:bg-gray-50"
                      >
                        + {'P\u0159idat ot\u00e1zku'}
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Lektor ─────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Lektor
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Jméno lektora</label>
                      <input type="text" value={selected.lecturer || ''} onChange={e => updateField('lecturer', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Cílová skupina</label>
                      <input type="text" value={selected.targetAudience || ''} onChange={e => updateField('targetAudience', e.target.value)}
                        placeholder="např. učitelé 2. stupně"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">Cover obrázek webináře</label>
                    <ImagePicker
                      value={selected.coverImage || ''}
                      onChange={url => updateField('coverImage', url)}
                      previewHeight={120}
                    />
                  </div>
                </div>

                {/* ── Stránka předmětu (slider) ─────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">
                    Stránka předmětu (slider)
                  </h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Pod srovnáním digitálních přístupů na stránkách /predmet/… se zobrazí
                    horizontální slider webinářů. Názvy předmětů pište stejně jako v katalogu
                    (např. <span className="font-mono text-gray-600">Matematika</span>,{' '}
                    <span className="font-mono text-gray-600">Matematika 1. stupeň</span>,{' '}
                    <span className="font-mono text-gray-600">Fyzika</span>).
                  </p>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">
                      Propojené předměty (čárkou oddělené)
                    </label>
                    <input
                      type="text"
                      value={(selected.relatedSubjects || []).join(', ')}
                      onChange={(e) =>
                        updateField(
                          'relatedSubjects',
                          e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="Matematika, Matematika 2. stupeň"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">
                      Tagy (čárkou, např. matematika)
                    </label>
                    <input
                      type="text"
                      value={(selected.tags || []).join(', ')}
                      onChange={(e) =>
                        updateField(
                          'tags',
                          e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="matematika"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                      Volitelné štítky pro interní orientaci (např. témata, kanál).
                    </p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">
                      Citace do slideru (volitelné)
                    </label>
                    <textarea
                      value={selected.highlightQuote || ''}
                      onChange={(e) => updateField('highlightQuote', e.target.value)}
                      rows={2}
                      placeholder="Krátká věta z obsahu webináře…"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none resize-y"
                    />
                  </div>
                </div>

                {/* ── Živý přenos: Meet vs stream ───────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <Link2 className="w-3.5 h-3.5" /> Živý přenos (/live)
                  </h3>
                  <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
                    Zvolte, zda účastníci půjdou přímo do Meetu, nebo sledují stream na webu s chatem.
                  </p>
                  <div className="flex flex-col gap-2 mb-4">
                    <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-gray-200 p-3 hover:bg-gray-50/80 has-[:checked]:border-purple-400 has-[:checked]:bg-purple-50/50">
                      <input
                        type="radio"
                        name="liveDeliveryMode"
                        className="mt-0.5"
                        checked={(selected.liveDeliveryMode ?? 'live_stream') === 'live_stream'}
                        onChange={() => updateField('liveDeliveryMode', 'live_stream')}
                      />
                      <span>
                        <span className="text-[13px] font-bold text-[#001161] block">Živý stream na webu</span>
                        <span className="text-[11px] text-gray-500">YouTube embed vlevo, chat a reakce vpravo (doporučeno pro veřejný odkaz z webu).</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-gray-200 p-3 hover:bg-gray-50/80 has-[:checked]:border-purple-400 has-[:checked]:bg-purple-50/50">
                      <input
                        type="radio"
                        name="liveDeliveryMode"
                        className="mt-0.5"
                        checked={(selected.liveDeliveryMode ?? 'live_stream') === 'google_meet'}
                        onChange={() => updateField('liveDeliveryMode', 'google_meet')}
                      />
                      <span>
                        <span className="text-[13px] font-bold text-[#001161] block">Google Meet</span>
                        <span className="text-[11px] text-gray-500">Na stránce jen tlačítko „Otevřít webinář na Google Meet“ — bez chatu na webu.</span>
                      </span>
                    </label>
                  </div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">
                    {(selected.liveDeliveryMode ?? 'live_stream') === 'google_meet'
                      ? 'Odkaz na Google Meet (povinné pro tento režim)'
                      : 'Odkaz na setkání (Zoom / Meet) — záloha'}
                  </label>
                  <input
                    type="url"
                    value={selected.zoomLink || ''}
                    onChange={(e) => updateField('zoomLink', e.target.value)}
                    placeholder="https://meet.google.com/… nebo https://zoom.us/j/…"
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none"
                  />
                  {(selected.liveDeliveryMode ?? 'live_stream') === 'live_stream' ? (
                    <>
                      <label className="text-[11px] font-bold text-gray-500 block mt-4 mb-1">
                        YouTube URL (živý stream / záznam)
                      </label>
                      <input
                        type="url"
                        value={(selected as any).youtubeUrl || ''}
                        onChange={(e) => updateField('youtubeUrl', e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=…"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Vloží se na live stránku /webinar/[id]/live; bez URL se zobrazí text o začátku streamu.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-amber-700/90 mt-2 leading-relaxed">
                      YouTube na této stránce nepoužijeme — účastníci po přihlášení uvidí jen odkaz do Meetu.
                    </p>
                  )}
                </div>

                {/* ── Popis (description) WYSIWYG ────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide px-5 py-3 border-b border-gray-200">
                    Popis webináře
                  </h3>
                  <div className="relative">
                    <Toolbar editor={descEditor} onImage={() => setImgDialog(true)} onVideo={() => setVidDialog(true)} />
                    <EditorContent editor={descEditor} />
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f7f8fc]">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Radio className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-[14px] font-semibold text-gray-500">Vyberte webinář ze seznamu</p>
              <p className="text-[12px] text-gray-400 mt-1">nebo vytvořte nový</p>
              <button onClick={handleNew}
                className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[13px] font-bold transition-colors">
                <Plus className="w-4 h-4" /> Nový webinář
              </button>
            </div>
          </div>
        )}

        {/* ── Dialogs ─────────────────────────────────────────────── */}
        {imgDialog && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setImgDialog(false)}>
            <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vložit obrázek</h3>
              <div className="space-y-3">
                <ImagePicker
                  label="Obrázek *"
                  value={imgUrl}
                  onChange={setImgUrl}
                  previewHeight={140}
                />
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">Alt text</label>
                  <input type="text" value={imgAlt} onChange={e => setImgAlt(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setImgDialog(false)} className="flex-1 py-2 text-[13px] font-bold border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Zrušit</button>
                <button onClick={insertImage} disabled={!imgUrl.trim()} className="flex-1 py-2 text-[13px] font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40">Vložit</button>
              </div>
            </div>
          </div>
        )}

        {vidDialog && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setVidDialog(false)}>
            <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vložit YouTube video</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">YouTube URL *</label>
                  <input autoFocus type="url" value={vidUrl} onChange={e => setVidUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && insertVideo()}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">Název</label>
                  <input type="text" value={vidTitle} onChange={e => setVidTitle(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setVidDialog(false)} className="flex-1 py-2 text-[13px] font-bold border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Zrušit</button>
                <button onClick={insertVideo} disabled={!vidUrl.trim()} className="flex-1 py-2 text-[13px] font-bold bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-40">Vložit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}