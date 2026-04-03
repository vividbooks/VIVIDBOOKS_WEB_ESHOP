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
import type { Webinar } from '../../data/webinars';
import { ImagePicker } from './ImagePicker';
import { compareWebinarsBySchedule } from '../../utils/webinarEventTimestamp';

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
    relatedSubjects: [], tags: [], highlightQuote: '',
    mailchimpTagName: '',
    thumbnailVariant: 1, isPast: false,
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

/* ─ Main component ───────────────────────────────────────────────── */
export default function WebinareEditor() {
  const { refresh: refreshContext } = useWebinars();

  const [items, setItems] = useState<Webinar[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const [selected, setSelected] = useState<Partial<Webinar> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [activeSection, setActiveSection] = useState<'description' | 'perks'>('description');
  const [copiedLive, setCopiedLive] = useState(false);
  const [devImminent, setDevImminent] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('vvb_dev_imminent') : null
  );

  function handleCopyLive() {
    const url = `https://www.vividbooks.com/webinar/${selected?.slug || selected?.id}/live`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLive(true);
      setTimeout(() => setCopiedLive(false), 2000);
    });
  }

  function toggleDevImminent() {
    const id = selected?.id;
    if (!id) return;
    if (devImminent === id) {
      localStorage.removeItem('vvb_dev_imminent');
      setDevImminent(null);
    } else {
      localStorage.setItem('vvb_dev_imminent', id);
      setDevImminent(id);
    }
  }

  // Separate TipTap editors for description and perks
  const descEditor = useEditor({
    extensions: [
      StarterKit,
      TiptapImage.configure({ inline: false }),
      YoutubeEmbed,
    ],
    content: '<p></p>',
    editorProps: { attributes: { class: 'vvb-webinar-editor' } },
  });

  const perksEditor = useEditor({
    extensions: [StarterKit],
    content: '<p></p>',
    editorProps: { attributes: { class: 'vvb-webinar-editor vvb-perks-editor' } },
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

  // Load content into editors when selection changes
  useEffect(() => {
    if (!descEditor || !perksEditor || !selected) return;
    // description — may be HTML or plain text
    const descHtml = selected.description
      ? (selected.description.includes('<') ? selected.description : `<p>${selected.description}</p>`)
      : '<p></p>';
    const perksHtml = selected.perks
      ? (selected.perks.includes('<') ? selected.perks : `<p>${selected.perks}</p>`)
      : '<p></p>';
    descEditor.commands.setContent(descHtml, false);
    perksEditor.commands.setContent(perksHtml, false);
  }, [selected?.id, descEditor, perksEditor]);

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
    setActiveSection('description');
  }

  function handleNew() {
    setSelected(emptyWebinar());
    setIsNew(true);
    setSlugManual(false);
    setActiveSection('description');
    descEditor?.commands.setContent('<p></p>', false);
    perksEditor?.commands.setContent('<p></p>', false);
  }

  function handleClose() {
    setSelected(null);
    descEditor?.commands.setContent('<p></p>', false);
    perksEditor?.commands.setContent('<p></p>', false);
  }

  function updateField(key: string, value: any) {
    setSelected(prev => {
      if (!prev) return prev;
      const next: any = { ...prev, [key]: value };
      // auto-update monthName when monthNum changes
      if (key === 'monthNum') {
        next.monthName = MONTHS_CS[Number(value) - 1] || 'Leden';
      }
      // auto-compute isPast from date
      if (key === 'day' || key === 'monthNum' || key === 'year') {
        const d = new Date(
          key === 'year' ? Number(value) : (prev.year || now.getFullYear()),
          (key === 'monthNum' ? Number(value) : (prev.monthNum || 1)) - 1,
          key === 'day' ? Number(value) : (prev.day || 1)
        );
        next.isPast = d < now;
      }
      if (key === 'title' && !slugManual) next.slug = slugify(String(value));
      return next;
    });
  }

  async function handleSave() {
    if (!selected || !descEditor || !perksEditor) return;
    if (!selected.title?.trim()) { toast.error('Titulek je povinn\u00fd.'); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...selected,
        description: descEditor.getHTML(),
        perks: perksEditor.getHTML(),
        id: selected.id || `webinar-${Date.now()}`,
        slug: selected.slug || slugify(selected.title || ''),
        updatedAt: new Date().toISOString(),
      };
      const url = isNew ? `${SERVER}/admin/webinare` : `${SERVER}/admin/webinare/${selected.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
      toast.success(isNew ? 'Webin\u00e1\u0159 ulo\u017een!' : 'Ulo\u017eeno!');
      await loadList();
      refreshContext();
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
      await fetch(`${SERVER}/admin/webinare/${selected.id}`, {
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
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Z\u00e1kladn\u00ed informace</h3>
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
                          {`https://www.vividbooks.com/webinar/${selected.slug}/live`}
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
                          devImminent === selected.id
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={toggleDevImminent}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{'🧪'}</span>
                          <div>
                            <span className="text-[11px] font-bold text-gray-600 block leading-tight">
                              {'V\u00fdvoj: Za\u010d\u00edn\u00e1 za chv\u00edli'}
                            </span>
                            <span className="text-[10px] text-gray-400 leading-tight">
                              {devImminent === selected.id
                                ? 'Aktivn\u00ed \u2014 webinář se zobrazuje ve slideru'
                                : 'Simuluje webinář do 30 min \u2014 ukáže slide v katalogu'}
                            </span>
                          </div>
                        </div>
                        {/* Toggle pill */}
                        <div className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${devImminent === selected.id ? 'bg-amber-400' : 'bg-gray-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${devImminent === selected.id ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Datum a čas ────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Datum a \u010das
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Den</label>
                      <input type="number" min={1} max={31} value={selected.day || 1} onChange={e => updateField('day', Number(e.target.value))}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">M\u011bs\u00edc</label>
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
                        <Clock className="w-3 h-3" /> \u010cas
                      </label>
                      <input type="text" value={selected.time || '18:00'} onChange={e => updateField('time', e.target.value)}
                        placeholder="18:00"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-[12px] text-gray-500">
                    <span>Datum webin\u00e1\u0159e:</span>
                    <span className="font-bold text-[#001161]">
                      {selected.day}. {MONTHS_CS[(selected.monthNum || 1) - 1]} {selected.year} od {selected.time}
                    </span>
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selected.isPast ? 'bg-gray-200 text-gray-500' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {selected.isPast ? 'MINUL\u00dd' : 'PL\u00c1NOVAN\u00dd'}
                    </span>
                  </div>
                </div>

                {/* ── Lektor ─────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Lektor
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Jm\u00e9no lektora</label>
                      <input type="text" value={selected.lecturer || ''} onChange={e => updateField('lecturer', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">C\u00edlov\u00e1 skupina</label>
                      <input type="text" value={selected.targetAudience || ''} onChange={e => updateField('targetAudience', e.target.value)}
                        placeholder="nap\u0159. u\u010ditel\u00e9 2. stupn\u011b"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Avatar lektora</label>
                      <ImagePicker
                        value={selected.lecturerAvatar || ''}
                        onChange={url => updateField('lecturerAvatar', url)}
                        previewHeight={120}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">Cover obrázek webináre</label>
                      <ImagePicker
                        value={selected.coverImage || ''}
                        onChange={url => updateField('coverImage', url)}
                        previewHeight={120}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Stránka předmětu (slider) ─────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">
                    Str\u00e1nka p\u0159edm\u011btu (slider)
                  </h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Pod srovn\u00e1n\u00edm digit\u00e1ln\u00edch p\u0159\u00edstup\u016f na str\u00e1nk\u00e1ch /predmet/\u2026 se zobraz\u00ed
                    horizont\u00e1ln\u00ed slider webin\u00e1\u0159\u016f. N\u00e1zvy p\u0159edm\u011bt\u016f pi\u0161te stejn\u011b jako v katalogu
                    (nap\u0159. <span className="font-mono text-gray-600">Matematika</span>,{' '}
                    <span className="font-mono text-gray-600">Matematika 1. stupe\u0148</span>,{' '}
                    <span className="font-mono text-gray-600">Fyzika</span>).
                  </p>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">
                      Propojen\u00e9 p\u0159edm\u011bty (\u010d\u00e1rkou odd\u011blen\u00e9)
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
                      placeholder="Matematika, Matematika 2. stupe\u0148"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">
                      Tagy (\u010d\u00e1rkou, nap\u0159. matematika)
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
                      Voliteln\u00e9 \u0161t\u00edtky pro intern\u00ed orientaci (nap\u0159. t\u00e9mata, kan\u00e1l).
                    </p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">
                      Citace do slideru (voliteln\u00e9)
                    </label>
                    <textarea
                      value={selected.highlightQuote || ''}
                      onChange={(e) => updateField('highlightQuote', e.target.value)}
                      rows={2}
                      placeholder="Kr\u00e1tk\u00e1 v\u011bta z obsahu webin\u00e1\u0159e\u2026"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none resize-y"
                    />
                  </div>
                </div>

                {/* ── Zoom link ──────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <Link2 className="w-3.5 h-3.5" /> Zoom / odkaz na registraci
                  </h3>
                  <input type="url" value={selected.zoomLink || ''} onChange={e => updateField('zoomLink', e.target.value)}
                    placeholder="https://zoom.us/j/\u2026"
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                  <label className="text-[11px] font-bold text-gray-500 block mt-4 mb-1">YouTube URL (live stream / záznam)</label>
                  <input type="url" value={(selected as any).youtubeUrl || ''} onChange={e => updateField('youtubeUrl', e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=\u2026"
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                  <p className="text-[11px] text-gray-400 mt-1">{'Zobraz\u00ed se na live str\u00e1nce /webinar/[id]/live'}</p>
                </div>

                {/* ── Popis (description) WYSIWYG ────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Section switcher */}
                  <div className="flex border-b border-gray-200">
                    {([
                      { key: 'description', label: 'Popis webin\u00e1\u0159e' },
                      { key: 'perks',       label: 'V\u00fdhody / Benefity' },
                    ] as const).map(s => (
                      <button key={s.key} onClick={() => setActiveSection(s.key)}
                        className={`px-5 py-3 text-[12px] font-bold border-b-2 transition-all ${
                          activeSection === s.key ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {activeSection === 'description' && (
                    <div className="relative">
                      <Toolbar editor={descEditor} onImage={() => setImgDialog(true)} onVideo={() => setVidDialog(true)} />
                      <EditorContent editor={descEditor} />
                    </div>
                  )}

                  {activeSection === 'perks' && (
                    <div>
                      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-[#fafafa] flex-wrap">
                        <ToolbarBtn active={perksEditor?.isActive('bold')} title="Tu\u010dn\u00e9" onClick={() => perksEditor?.chain().focus().toggleBold().run()}>
                          <Bold className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn active={perksEditor?.isActive('bulletList')} title="Odr\u00e1\u017eky" onClick={() => perksEditor?.chain().focus().toggleBulletList().run()}>
                          <List className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn active={false} title="Zp\u011bt" onClick={() => perksEditor?.chain().focus().undo().run()}>
                          <Undo2 className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                      </div>
                      <EditorContent editor={perksEditor} />
                    </div>
                  )}
                </div>

                {/* ── Thumbnail varianta ────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-3">Varianta thumb (fallback bez obr\u00e1zku)</h3>
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map(v => (
                      <button key={v} onClick={() => updateField('thumbnailVariant', v)}
                        className={`px-4 py-2 rounded-xl text-[13px] font-bold border transition-all ${
                          selected.thumbnailVariant === v
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}>
                        {`Varianta ${v}`}
                      </button>
                    ))}
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
              <p className="text-[14px] font-semibold text-gray-500">Vyberte webin\u00e1\u0159 ze seznamu</p>
              <p className="text-[12px] text-gray-400 mt-1">nebo vytvo\u0159te nov\u00fd</p>
              <button onClick={handleNew}
                className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[13px] font-bold transition-colors">
                <Plus className="w-4 h-4" /> Nov\u00fd webin\u00e1\u0159
              </button>
            </div>
          </div>
        )}

        {/* ── Dialogs ─────────────────────────────────────────────── */}
        {imgDialog && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setImgDialog(false)}>
            <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vlo\u017eit obr\u00e1zek</h3>
              <div className="space-y-3">
                <ImagePicker
                  label="Obr\u00e1zek *"
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
                <button onClick={() => setImgDialog(false)} className="flex-1 py-2 text-[13px] font-bold border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Zru\u0161it</button>
                <button onClick={insertImage} disabled={!imgUrl.trim()} className="flex-1 py-2 text-[13px] font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40">Vlo\u017eit</button>
              </div>
            </div>
          </div>
        )}

        {vidDialog && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setVidDialog(false)}>
            <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vlo\u017eit YouTube video</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">YouTube URL *</label>
                  <input autoFocus type="url" value={vidUrl} onChange={e => setVidUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && insertVideo()}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">N\u00e1zev</label>
                  <input type="text" value={vidTitle} onChange={e => setVidTitle(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-purple-400 outline-none" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setVidDialog(false)} className="flex-1 py-2 text-[13px] font-bold border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Zru\u0161it</button>
                <button onClick={insertVideo} disabled={!vidUrl.trim()} className="flex-1 py-2 text-[13px] font-bold bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-40">Vlo\u017eit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}