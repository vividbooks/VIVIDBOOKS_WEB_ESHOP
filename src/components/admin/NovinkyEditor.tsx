import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import {
  Plus, Search, Save, X, Globe, Lock, Loader2, ExternalLink,
  RefreshCw, FileText, Image, Video, Bold, Italic, List,
  Undo2, Redo2, Quote, Trash2, Calendar, User, Check,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useNovinky } from '../../contexts/NovinkyContext';
import type { NovinkaPost, NovinkaBlock } from '../../data/novinkaPosts';
import { ImagePicker } from './ImagePicker';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

/* ─ Helpers ─────────────────────────────────────────────────────── */
function slugify(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function todayCs() {
  return new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}
function extractYoutubeId(url: string): string | null {
  const pats = [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/, /youtu\.be\/([a-zA-Z0-9_-]+)/, /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/];
  for (const p of pats) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
function emptyPost(): Partial<NovinkaPost> {
  return { title: '', slug: '', category: '', author: '', date: todayCs(), excerpt: '', coverImage: '', content: [], published: false };
}

/* blocks → HTML */
function blocksToHtml(blocks: NovinkaBlock[]): string {
  if (!blocks?.length) return '<p></p>';
  return blocks.map(b => {
    if (b.type === 'paragraph') return `<p>${b.text || ''}</p>`;
    if (b.type === 'heading')   return `<h2>${b.text || ''}</h2>`;
    if (b.type === 'quote')     return `<blockquote><p>${b.text || ''}</p>${b.author ? `<p>\u2014 ${b.author}</p>` : ''}</blockquote>`;
    if (b.type === 'image')     return b.src ? `<img src="${b.src}" alt="${b.alt || ''}" title="${b.caption || ''}">` : '';
    return '';
  }).join('');
}

/* TipTap JSON → blocks */
function nodeText(n: any): string {
  if (n.type === 'text') return n.text || '';
  if (n.content) return n.content.map(nodeText).join('');
  return '';
}
function jsonToBlocks(doc: any): NovinkaBlock[] {
  const out: NovinkaBlock[] = [];
  function walk(node: any) {
    if (node.type === 'paragraph') {
      const t = nodeText(node).trim();
      if (t) out.push({ type: 'paragraph', text: t });
    } else if (node.type === 'heading') {
      const t = nodeText(node).trim();
      if (t) out.push({ type: 'heading', text: t });
    } else if (node.type === 'blockquote') {
      const kids = node.content || [];
      const t = kids[0] ? nodeText(kids[0]).trim() : '';
      const a = kids[1] ? nodeText(kids[1]).trim().replace(/^\u2014\s*/, '') : '';
      if (t) out.push({ type: 'quote', text: t, author: a });
    } else if (node.type === 'image') {
      const { src, alt, title } = node.attrs || {};
      if (src) out.push({ type: 'image', src, alt: alt || '', caption: title || '' });
    } else if (node.type === 'youtubeEmbed') {
      // novinky nemá video blok ale přidáme jako paragraph placeholder
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      (node.content || []).forEach((item: any) => {
        const t = nodeText(item).trim();
        if (t) out.push({ type: 'paragraph', text: `• ${t}` });
      });
    } else if (node.content) {
      node.content.forEach(walk);
    }
  }
  (doc.content || []).forEach(walk);
  return out;
}

/* ─ YouTube extension ────────────────────────────────────────────── */
function YoutubeNodeView({ node, deleteNode }: any) {
  const { videoId, title } = node.attrs;
  return (
    <NodeViewWrapper>
      <div className="relative group my-5" contentEditable={false}>
        <div className="relative w-full rounded-xl overflow-hidden shadow-md bg-black" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title || 'Video'}
            className="absolute inset-0 w-full h-full pointer-events-none"
            frameBorder="0"
            allowFullScreen
          />
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
  addAttributes() {
    return { videoId: { default: '' }, title: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-youtube-id]', getAttrs: (el: HTMLElement) => ({
      videoId: el.getAttribute('data-youtube-id') || '',
      title: el.getAttribute('data-youtube-title') || '',
    }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-youtube-id': HTMLAttributes.videoId, 'data-youtube-title': HTMLAttributes.title })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeNodeView);
  },
});

/* ─ Toolbar ──────────────────────────────────────────────────────── */
function ToolbarBtn({ active, title, onClick, children }: {
  active?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-md transition-colors text-[13px] font-bold ${
        active ? 'bg-[#001161] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-[#001161]'
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onImage, onVideo }: { editor: any; onImage: () => void; onVideo: () => void }) {
  if (!editor) return null;
  const sep = <div className="w-px h-5 bg-gray-200 mx-0.5" />;
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-[#fafafa] flex-wrap sticky top-0 z-10">
      <ToolbarBtn active={editor.isActive('bold')} title="Tučné (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} title="Kurzíva (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={editor.isActive('heading', { level: 2 })} title="Nadpis H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span className="text-[11px] font-black">H2</span>
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('heading', { level: 3 })} title="Nadpis H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <span className="text-[11px] font-black">H3</span>
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={editor.isActive('blockquote')} title="Citát" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('bulletList')} title="Odrážky" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={false} title="Vložit obrázek" onClick={onImage}>
        <Image className="w-3.5 h-3.5 text-green-600" />
      </ToolbarBtn>
      <ToolbarBtn active={false} title="Vložit YouTube video" onClick={onVideo}>
        <Video className="w-3.5 h-3.5 text-red-500" />
      </ToolbarBtn>
      {sep}
      <ToolbarBtn active={false} title="Zpět (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn active={false} title="Vpřed (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
    </div>
  );
}

/* ─ Status badge ─────────────────────────────────────────────────── */
function StatusBadge({ published }: { published?: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
      <Globe className="w-2.5 h-2.5" /> Pub.
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
      <Lock className="w-2.5 h-2.5" /> Konc.
    </span>
  );
}

/* ─ Main editor ─────────────────────────────────────────────────── */
export default function NovinkyEditor() {
  const { refresh: refreshContext } = useNovinky();

  const [items, setItems] = useState<NovinkaPost[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pub' | 'draft'>('all');

  const [selected, setSelected] = useState<Partial<NovinkaPost> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [activeTab, setActiveTab] = useState<'meta' | 'content' | 'preview'>('content');

  const [imgDialog, setImgDialog] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [imgCaption, setImgCaption] = useState('');

  const [vidDialog, setVidDialog] = useState(false);
  const [vidUrl, setVidUrl] = useState('');
  const [vidTitle, setVidTitle] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapImage.configure({ inline: false, HTMLAttributes: { class: 'editor-img' } }),
      YoutubeEmbed,
    ],
    content: '<p></p>',
    editorProps: { attributes: { class: 'vvb-prose-editor' } },
  });

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${SERVER}/admin/novinky`, {
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
    if (!editor || !selected) return;
    const html = blocksToHtml((selected.content as NovinkaBlock[]) || []);
    editor.commands.setContent(html, false);
    editor.commands.focus('start');
  }, [selected?.id, editor]);

  const filtered = items.filter(p => {
    const ms = !search || (p.title || '').toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'all'
      || (statusFilter === 'pub' && (p as any).published === true)
      || (statusFilter === 'draft' && (p as any).published !== true);
    return ms && mf;
  });

  function handleSelect(item: NovinkaPost) {
    setSelected({ ...item });
    setIsNew(false);
    setSlugManual(true);
    setActiveTab('content');
  }

  function handleNew() {
    setSelected(emptyPost());
    setIsNew(true);
    setSlugManual(false);
    setActiveTab('content');
    editor?.commands.setContent('<p></p>', false);
  }

  function handleClose() {
    setSelected(null);
    editor?.commands.setContent('<p></p>', false);
  }

  function updateField(key: string, value: any) {
    setSelected(prev => {
      if (!prev) return prev;
      const next: any = { ...prev, [key]: value };
      if (key === 'title' && !slugManual) next.slug = slugify(String(value));
      return next;
    });
  }

  async function handleSave() {
    if (!selected || !editor) return;
    if (!selected.title?.trim()) { toast.error('Titulek je povinný.'); return; }
    if (!selected.slug?.trim()) { toast.error('Slug je povinný.'); return; }
    setSaving(true);
    try {
      const blocks = jsonToBlocks(editor.getJSON());
      const payload = { ...selected, content: blocks, contentHtml: editor.getHTML(), updatedAt: new Date().toISOString() };
      const url = isNew ? `${SERVER}/admin/novinky` : `${SERVER}/admin/novinky/${selected.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
      toast.success(isNew ? 'Novinka uložena!' : 'Uloženo!');
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
    if (!confirm('Opravdu smazat tuto novinku?')) return;
    setSaving(true);
    try {
      await fetch(`${SERVER}/admin/novinky/${selected.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      toast.success('Smazáno!');
      setSelected(null);
      editor?.commands.setContent('<p></p>', false);
      await loadList();
      refreshContext();
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function insertImage() {
    if (!editor || !imgUrl.trim()) return;
    editor.chain().focus().setImage({ src: imgUrl.trim(), alt: imgAlt.trim(), title: imgCaption.trim() }).run();
    setImgDialog(false); setImgUrl(''); setImgAlt(''); setImgCaption('');
  }

  function insertVideo() {
    if (!editor) return;
    const id = extractYoutubeId(vidUrl.trim());
    if (!id) { toast.error('Neplatn\u00e1 YouTube URL'); return; }
    editor.chain().focus().insertContent({ type: 'youtubeEmbed', attrs: { videoId: id, title: vidTitle.trim() } }).run();
    setVidDialog(false); setVidUrl(''); setVidTitle('');
  }

  async function handlePublishAll() {
    if (!confirm(`Publikovat v\u0161ech ${items.length} novinek najednou?`)) return;
    try {
      const updated = items.map(i => ({ ...i, published: true }));
      // save all in parallel (batch)
      await Promise.all(updated.map(i =>
        fetch(`${SERVER}/admin/novinky/${i.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ ...i, published: true }),
        })
      ));
      toast.success(`Hotovo! ${updated.length} novinek publikov\u00e1no.`);
      await loadList();
      refreshContext();
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    }
  }

  const pubCount   = items.filter(p => (p as any).published === true).length;
  const draftCount = items.filter(p => (p as any).published !== true).length;
  const previewBlocks = editor ? jsonToBlocks(editor.getJSON()) : ((selected?.content as NovinkaBlock[]) || []);

  return (
    <>
      <style>{`
        .vvb-prose-editor { outline: none; min-height: 400px; padding: 1.5rem 2rem 3rem; font-family: 'Fenomen Sans', sans-serif; color: #001161; font-size: 15px; line-height: 1.85; }
        .vvb-prose-editor p { margin-bottom: 0.9rem; }
        .vvb-prose-editor h2 { font-size: 1.2rem; font-weight: 800; margin: 2.2rem 0 0.7rem; color: #001161; }
        .vvb-prose-editor h3 { font-size: 1.05rem; font-weight: 700; margin: 1.6rem 0 0.5rem; color: #001161; }
        .vvb-prose-editor blockquote { border-left: 4px solid #ff6a35; padding: 0.75rem 1.25rem; background: #f0f2f8; border-radius: 10px; margin: 1.5rem 0; }
        .vvb-prose-editor ul { padding-left: 1.5rem; margin-bottom: 1rem; list-style: disc; }
        .vvb-prose-editor ol { padding-left: 1.5rem; margin-bottom: 1rem; list-style: decimal; }
        .vvb-prose-editor li { margin-bottom: 0.3rem; }
        .vvb-prose-editor strong { font-weight: 700; }
        .vvb-prose-editor em { font-style: italic; }
        .vvb-prose-editor .editor-img, .vvb-prose-editor img { max-width: 100%; border-radius: 12px; margin: 1rem 0; display: block; }
        .vvb-prose-editor p.is-editor-empty:first-child::before { content: 'Za\u010dn\u011bte ps\u00e1t novinku\u2026'; color: #c0c4d0; pointer-events: none; float: left; height: 0; }
        .vvb-prose-editor .ProseMirror-selectednode { outline: 2px solid #001161; border-radius: 4px; }
      `}</style>

      <div className="h-full flex overflow-hidden bg-[#f7f8fc]">

        {/* ── LEFT LIST ──────────────────────────────────────────── */}
        <div className="w-[270px] bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">
                {'Novinky'} <span className="text-gray-400 font-normal">({items.length})</span>
              </span>
              <button onClick={handleNew} className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-[11px] font-bold transition-colors">
                <Plus className="w-3.5 h-3.5" /> {'Nov\u00e1'}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat\u2026"
                className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all" />
            </div>
            <div className="flex gap-1">
              {([
                { key: 'all',   label: `V\u0161e (${items.length})` },
                { key: 'pub',   label: `Pub. (${pubCount})` },
                { key: 'draft', label: `Konc. (${draftCount})` },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setStatusFilter(t.key)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${statusFilter === t.key ? 'bg-[#001161] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {t.label}
                </button>
              ))}
              <button onClick={loadList} className="ml-auto p-1 text-gray-400 hover:text-[#001161]" title="Obnovit">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {draftCount > 0 && (
              <button onClick={handlePublishAll}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors">
                <Globe className="w-3 h-3" />
                {`Publikovat v\u0161e (${draftCount} koncept\u016f)`}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-[12px]">{'Ž\u00e1dn\u00e9 novinky'}</div>
            ) : filtered.map(item => {
              const isSel = selected?.id === item.id && !isNew;
              return (
                <button key={item.id} onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 flex items-start gap-2.5 transition-all ${isSel ? 'bg-[#001161]' : 'hover:bg-gray-50'}`}>
                  {item.coverImage ? (
                    <img src={item.coverImage} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-100" alt="" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-teal-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-semibold leading-snug line-clamp-2 ${isSel ? 'text-white' : 'text-[#001161]'}`}>
                      {item.title || 'Bez n\u00e1zvu'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <StatusBadge published={(item as any).published} />
                      {item.date && <span className={`text-[10px] ${isSel ? 'text-teal-200' : 'text-gray-400'}`}>{item.date}</span>}
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
                {selected.title || (isNew ? 'Nov\u00e1 novinka' : 'Bez n\u00e1zvu')}
              </span>
              <button onClick={() => updateField('published', !(selected as any).published)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all shrink-0 ${
                  (selected as any).published
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}>
                {(selected as any).published ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {(selected as any).published ? 'Publikov\u00e1no' : 'Koncept'}
              </button>
              {!isNew && selected.slug && (selected as any).published && (
                <a href={`/novinky/${selected.slug}`} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-gray-400 hover:text-[#001161] hover:bg-gray-100 rounded-lg transition-colors" title="Zobrazit na webu">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
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
                className="flex items-center gap-1.5 bg-[#001161] hover:bg-[#0d1f7a] text-white px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Ukl\u00e1d\u00e1m\u2026' : 'Ulo\u017eit'}
              </button>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 flex gap-0 shrink-0">
              {([
                { key: 'content', label: 'Obsah' },
                { key: 'meta',    label: 'Metadata' },
                { key: 'preview', label: 'N\u00e1hled' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${
                    activeTab === tab.key ? 'border-[#001161] text-[#001161]' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── CONTENT ──────────────────────────────────────────── */}
            {activeTab === 'content' && (
              <div className="flex-1 flex flex-col overflow-hidden relative">
                <Toolbar editor={editor} onImage={() => setImgDialog(true)} onVideo={() => setVidDialog(true)} />
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-[820px] mx-auto px-8 pt-8">
                    <input
                      type="text"
                      value={selected.title || ''}
                      onChange={e => updateField('title', e.target.value)}
                      placeholder="N\u00e1zev novinky\u2026"
                      className="w-full text-[26px] font-black text-[#001161] border-none outline-none bg-transparent placeholder-gray-200 leading-tight mb-2 font-['Fenomen_Sans',sans-serif]"
                    />
                    <div className="h-px bg-gray-100 mb-0" />
                  </div>
                  <div className="max-w-[820px] mx-auto">
                    <EditorContent editor={editor} />
                  </div>
                </div>

                {/* Image dialog */}
                {imgDialog && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setImgDialog(false)}>
                    <div className="bg-white rounded-2xl p-6 w-[460px] shadow-2xl" onClick={e => e.stopPropagation()}>
                      <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vlo\u017eit obr\u00e1zek</h3>
                      <div className="space-y-3">
                        <ImagePicker
                          label="Obr\u00e1zek *"
                          value={imgUrl}
                          onChange={setImgUrl}
                          previewHeight={140}
                        />
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Alt text</label>
                          <input type="text" value={imgAlt} onChange={e => setImgAlt(e.target.value)}
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Popisek</label>
                          <input type="text" value={imgCaption} onChange={e => setImgCaption(e.target.value)}
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-5">
                        <button onClick={() => setImgDialog(false)} className="flex-1 py-2 text-[13px] font-bold border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Zru\u0161it</button>
                        <button onClick={insertImage} disabled={!imgUrl.trim()} className="flex-1 py-2 text-[13px] font-bold bg-[#001161] text-white rounded-xl hover:bg-[#0d1f7a] disabled:opacity-40">Vlo\u017eit</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Video dialog */}
                {vidDialog && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setVidDialog(false)}>
                    <div className="bg-white rounded-2xl p-6 w-[400px] shadow-2xl" onClick={e => e.stopPropagation()}>
                      <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vlo\u017eit YouTube video</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">YouTube URL *</label>
                          <input autoFocus type="url" value={vidUrl} onChange={e => setVidUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && insertVideo()}
                            placeholder="https://youtube.com/watch?v=\u2026"
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">N\u00e1zev videa</label>
                          <input type="text" value={vidTitle} onChange={e => setVidTitle(e.target.value)}
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
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
            )}

            {/* ── META ─────────────────────────────────────────────── */}
            {activeTab === 'meta' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-[620px] space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Titulek *</label>
                      <input type="text" value={selected.title || ''} onChange={e => updateField('title', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Slug *</label>
                      <input type="text" value={selected.slug || ''} onChange={e => { setSlugManual(true); updateField('slug', e.target.value); }}
                        className="w-full px-3 py-2 text-[13px] font-mono border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Perex / excerpt</label>
                    <textarea rows={3} value={selected.excerpt || ''} onChange={e => updateField('excerpt', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> Autor
                      </label>
                      <input type="text" value={selected.author || ''} onChange={e => updateField('author', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Datum
                      </label>
                      <input type="text" value={selected.date || ''} onChange={e => updateField('date', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Kategorie</label>
                      <input type="text" value={selected.category || ''} onChange={e => updateField('category', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Barva pozad\u00ed dlaždice</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={selected.bgColor || '#FFF4C8'} onChange={e => updateField('bgColor', e.target.value)}
                          className="w-10 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                        <input type="text" value={selected.bgColor || '#FFF4C8'} onChange={e => updateField('bgColor', e.target.value)}
                          className="flex-1 px-3 py-2 text-[13px] font-mono border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <ImagePicker
                      label="Cover obr\u00e1zek"
                      value={selected.coverImage || ''}
                      onChange={url => updateField('coverImage', url)}
                      previewHeight={160}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Velk\u00fd text na dlaždici (nap\u0159. 10%)</label>
                    <input type="text" value={selected.tileText || ''} onChange={e => updateField('tileText', e.target.value)}
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* ── PREVIEW ──────────────────────────────────────────── */}
            {activeTab === 'preview' && (
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-[720px] mx-auto px-8 py-10">
                  {selected.coverImage && (
                    <img src={selected.coverImage} className="w-full h-[320px] object-cover rounded-2xl mb-8" alt="" />
                  )}
                  <div className="flex items-center gap-2 text-[12px] text-gray-400 mb-3">
                    {selected.date && <span>{selected.date}</span>}
                    {selected.category && <><span>·</span><span className="text-teal-600 font-semibold">{selected.category}</span></>}
                    {selected.author && <><span>·</span><span>{selected.author}</span></>}
                  </div>
                  <h1 className="text-[32px] font-black text-[#001161] leading-tight mb-4 font-['Fenomen_Sans',sans-serif]">
                    {selected.title || 'Bez n\u00e1zvu'}
                  </h1>
                  {selected.excerpt && (
                    <p className="text-[16px] text-[#001161]/70 leading-relaxed mb-6 border-l-4 border-teal-400 pl-4">{selected.excerpt}</p>
                  )}
                  <div className="space-y-4">
                    {previewBlocks.map((b, i) => {
                      if (b.type === 'paragraph') return <p key={i} className="text-[15px] text-[#001161] leading-[1.8]">{b.text}</p>;
                      if (b.type === 'heading')   return <h2 key={i} className="text-[20px] font-black text-[#001161] mt-6">{b.text}</h2>;
                      if (b.type === 'quote')     return (
                        <blockquote key={i} className="border-l-4 border-[#ff6a35] bg-[#f0f2f8] rounded-xl pl-5 pr-4 py-4">
                          <p className="text-[15px] italic text-[#001161]">{b.text}</p>
                          {b.author && <p className="text-[12px] text-gray-500 mt-1">&mdash; {b.author}</p>}
                        </blockquote>
                      );
                      if (b.type === 'image')     return <img key={i} src={b.src} alt={b.alt} className="w-full rounded-2xl" />;
                      return null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f7f8fc]">
            <div className="text-center">
              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-teal-400" />
              </div>
              <p className="text-[14px] font-semibold text-gray-500">Vyberte novinku ze seznamu</p>
              <p className="text-[12px] text-gray-400 mt-1">nebo vytvo\u0159te novou</p>
              <button onClick={handleNew}
                className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-[13px] font-bold transition-colors">
                <Plus className="w-4 h-4" /> Nov\u00e1 novinka
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}