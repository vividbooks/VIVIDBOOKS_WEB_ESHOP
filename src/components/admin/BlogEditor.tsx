import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import {
  Plus, Search, Save, X, Globe, Lock, Loader2, ExternalLink,
  RefreshCw, FileText, Image, Video, Bold, Italic, List,
  Undo2, Redo2, Quote, Trash2, Calendar, Clock, User, Check,
  Minus
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useBlogPosts } from '../../contexts/BlogContext';
import type { BlogPost, BlogBlock } from '../../data/blogPosts';
import { ImagePicker } from './ImagePicker';
import { sortBlogPosts } from '../../utils/sortBlogPosts';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
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
function emptyPost(): Partial<BlogPost> {
  return { title: '', slug: '', category: '', author: '', date: todayCs(), readTime: 5, excerpt: '', coverImage: '', content: [], published: false };
}

/* Convert BlogBlock[] → HTML for TipTap initial load */
function blocksToHtml(blocks: BlogBlock[] | string | null | undefined): string {
  // If blocks is a raw HTML string (legacy posts), use directly
  if (typeof blocks === 'string') return blocks || '<p></p>';
  if (!Array.isArray(blocks) || !blocks.length) return '<p></p>';
  return blocks.map(b => {
    if (b.type === 'paragraph') return `<p>${b.text || ''}</p>`;
    if (b.type === 'heading')   return `<h2>${b.text || ''}</h2>`;
    if (b.type === 'quote')     return `<blockquote><p>${b.text || ''}</p>${b.author ? `<p>\u2014 ${b.author}</p>` : ''}</blockquote>`;
    if (b.type === 'image')     return b.src ? `<img src="${b.src}" alt="${b.alt || ''}" title="${b.caption || ''}">` : '';
    if (b.type === 'video') {
      const id = extractYoutubeId(b.url);
      return id ? `<div data-youtube-id="${id}" data-youtube-title="${b.title || ''}"></div>` : '';
    }
    return '';
  }).join('');
}

/* Convert TipTap JSON doc → BlogBlock[] */
function nodeText(n: any): string {
  if (n.type === 'text') return n.text || '';
  if (n.content) return n.content.map(nodeText).join('');
  return '';
}
function jsonToBlocks(doc: any): BlogBlock[] {
  const out: BlogBlock[] = [];
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
      const { videoId, title } = node.attrs || {};
      if (videoId) out.push({ type: 'video', url: `https://www.youtube.com/watch?v=${videoId}`, title: title || '' });
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      (node.content || []).forEach((item: any) => {
        const t = nodeText(item).trim();
        if (t) out.push({ type: 'paragraph', text: t });
      });
    } else if (node.content) {
      node.content.forEach(walk);
    }
  }
  (doc.content || []).forEach(walk);
  return out;
}

/* ─────────────────────────────────────────────────────────────────
   YouTube TipTap extension
───────────────────────────────────────────────────────────────── */
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
        <button
          onClick={deleteNode}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        >
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

/* ─────────────────────────────────────────────────────────────────
   Toolbar
───────────────────────────────────────────────────────────────── */
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
      <div className="ml-auto text-[10px] text-gray-400 hidden md:block">
        {editor.storage?.characterCount?.words?.() ?? ''} slov
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Status badge
───────────────────────────────────────────────────────────────── */
function StatusBadge({ published }: { published?: boolean }) {
  return published === true ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
      <Globe className="w-2.5 h-2.5" /> Pub.
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
      <Lock className="w-2.5 h-2.5" /> Konc.
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Main BlogEditor
───────────────────────────────────────────────────────────────── */
export default function BlogEditor() {
  const { refresh: refreshContext } = useBlogPosts();

  // List
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pub' | 'draft'>('all');

  // Editor
  const [selected, setSelected] = useState<Partial<BlogPost> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [activeTab, setActiveTab] = useState<'meta' | 'content' | 'preview'>('content');

  // Dialogs
  const [imgDialog, setImgDialog] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [imgCaption, setImgCaption] = useState('');

  const [vidDialog, setVidDialog] = useState(false);
  const [vidUrl, setVidUrl] = useState('');
  const [vidTitle, setVidTitle] = useState('');

  /* TipTap editor */
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TiptapImage.configure({ inline: false, HTMLAttributes: { class: 'editor-img' } }),
      YoutubeEmbed,
    ],
    content: '<p></p>',
    editorProps: {
      attributes: { class: 'vvb-prose-editor' },
    },
  });

  /* Load list */
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${SERVER}/admin/blog`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      setItems(sortBlogPosts(data.items || []));
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  /* Update editor content when post changes */
  useEffect(() => {
    if (!editor || !selected) return;
    const html = blocksToHtml((selected.content as BlogBlock[]) || []);
    editor.commands.setContent(html, false);
    // scroll to top
    editor.commands.focus('start');
  }, [selected?.id, editor]);

  /* Filtered list */
  const filtered = items.filter(p => {
    const ms = !search || (p.title || '').toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'all'
      || (statusFilter === 'pub' && p.published === true)
      || (statusFilter === 'draft' && p.published !== true);
    return ms && mf;
  });

  /* Handlers */
  function handleSelect(item: BlogPost) {
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

  function updateField(key: keyof BlogPost, value: any) {
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
    if (!selected.slug?.trim())  { toast.error('Slug je povinný.'); return; }
    setSaving(true);
    try {
      const blocks = jsonToBlocks(editor.getJSON());
      const payload = { ...selected, content: blocks, contentHtml: editor.getHTML(), updatedAt: new Date().toISOString() };
      const url = isNew ? `${SERVER}/admin/blog` : `${SERVER}/admin/blog/${selected.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
      toast.success(isNew ? 'Článek uložen!' : 'Uloženo!');
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
    if (!confirm('Opravdu smazat tento článek?')) return;
    setSaving(true);
    try {
      await fetch(`${SERVER}/admin/blog/${selected.id}`, {
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

  /* Insert image */
  function insertImage() {
    if (!editor || !imgUrl.trim()) return;
    editor.chain().focus().setImage({ src: imgUrl.trim(), alt: imgAlt.trim(), title: imgCaption.trim() }).run();
    setImgDialog(false); setImgUrl(''); setImgAlt(''); setImgCaption('');
  }

  /* Insert YouTube */
  function insertVideo() {
    if (!editor) return;
    const id = extractYoutubeId(vidUrl.trim());
    if (!id) { toast.error('Neplatná YouTube URL'); return; }
    editor.chain().focus().insertContent({ type: 'youtubeEmbed', attrs: { videoId: id, title: vidTitle.trim() } }).run();
    setVidDialog(false); setVidUrl(''); setVidTitle('');
  }

  const pubCount   = items.filter(p => p.published === true).length;
  const draftCount = items.filter(p => p.published !== true).length;

  /* Publish all */
  async function handlePublishAll() {
    if (!confirm(`Publikovat všech ${items.length} článků najednou?`)) return;
    try {
      const res = await fetch(`${SERVER}/admin/blog/publish-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Hotovo! ${data.count} článků nastaveno jako publikováno.`);
      await loadList();
      refreshContext();
    } catch (e: any) {
      toast.error(`Chyba: ${e.message}`);
    }
  }

  /* Preview blocks from current editor state */
  const previewBlocks = editor ? jsonToBlocks(editor.getJSON()) : ((selected?.content as BlogBlock[]) || []);

  return (
    <>
      {/* Editor CSS injected globally (scoped to .vvb-prose-editor) */}
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
        .vvb-prose-editor p.is-editor-empty:first-child::before { content: 'Začněte psát váš článek…'; color: #c0c4d0; pointer-events: none; float: left; height: 0; }
        .vvb-prose-editor .ProseMirror-selectednode { outline: 2px solid #001161; border-radius: 4px; }
      `}</style>

      <div className="h-full flex overflow-hidden bg-[#f7f8fc]">

        {/* ── LEFT LIST PANEL ────────────────────────────────────── */}
        <div className="w-[270px] bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#001161] uppercase tracking-wide">
                Blog <span className="text-gray-400 font-normal">({items.length})</span>
              </span>
              <button onClick={handleNew} className="flex items-center gap-1 px-2.5 py-1.5 bg-[#ff8c66] hover:bg-[#ff7a4d] text-white rounded-lg text-[11px] font-bold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nový
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat…"
                className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-[#001161] outline-none transition-all" />
            </div>
            <div className="flex gap-1">
              {([
                { key: 'all',   label: `Vše (${items.length})` },
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
              <button
                onClick={handlePublishAll}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
              >
                <Globe className="w-3 h-3" />
                {`Publikovat vše (${draftCount} konceptů)`}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-[12px]">Žádné články</div>
            ) : filtered.map(item => {
              const isSel = selected?.id === item.id && !isNew;
              return (
                <button key={item.id} onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 flex items-start gap-2.5 transition-all ${isSel ? 'bg-[#001161]' : 'hover:bg-gray-50'}`}>
                  {item.coverImage ? (
                    <img src={item.coverImage} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-100" alt="" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-semibold leading-snug line-clamp-2 ${isSel ? 'text-white' : 'text-[#001161]'}`}>
                      {item.title || 'Bez názvu'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <StatusBadge published={item.published} />
                      {item.category && <span className={`text-[10px] truncate ${isSel ? 'text-blue-200' : 'text-gray-400'}`}>{item.category}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT EDITOR PANEL ─────────────────────────────────── */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* Top bar */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0">
              <span className="text-[13px] font-semibold text-[#001161] truncate flex-1 min-w-0">
                {selected.title || (isNew ? 'Nový článek' : 'Bez názvu')}
              </span>

              {/* Status toggle */}
              <button onClick={() => updateField('published', !selected.published)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-all shrink-0 ${
                  selected.published
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}>
                {selected.published ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {selected.published ? 'Publikováno' : 'Koncept'}
              </button>

              {!isNew && selected.slug && selected.published && (
                <a href={`/blog/${selected.slug}`} target="_blank" rel="noopener noreferrer"
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
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 flex gap-0 shrink-0">
              {([
                { key: 'content', label: 'Obsah' },
                { key: 'meta',    label: 'Metadata' },
                { key: 'preview', label: 'Náhled' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${
                    activeTab === tab.key ? 'border-[#001161] text-[#001161]' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── CONTENT TAB ──────────────────────────────────── */}
            {activeTab === 'content' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <Toolbar editor={editor} onImage={() => setImgDialog(true)} onVideo={() => setVidDialog(true)} />
                <div className="flex-1 overflow-y-auto">
                  {/* Title field above editor */}
                  <div className="max-w-[820px] mx-auto px-8 pt-8">
                    <input
                      type="text"
                      value={selected.title || ''}
                      onChange={e => updateField('title', e.target.value)}
                      placeholder="Název článku…"
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
                      <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vložit obrázek</h3>
                      <div className="space-y-3">
                        <ImagePicker
                          label="Obrázek *"
                          value={imgUrl}
                          onChange={setImgUrl}
                          previewHeight={140}
                        />
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Alt text</label>
                          <input type="text" value={imgAlt} onChange={e => setImgAlt(e.target.value)}
                            placeholder="Popis obrázku pro SEO…"
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Popisek (nepovinné)</label>
                          <input type="text" value={imgCaption} onChange={e => setImgCaption(e.target.value)}
                            placeholder="Text pod obrázkem…"
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={insertImage} className="flex-1 flex items-center justify-center gap-1.5 bg-[#001161] text-white py-2 rounded-xl text-[13px] font-bold hover:bg-[#0d1f7a] transition-colors">
                          <Check className="w-4 h-4" /> Vložit
                        </button>
                        <button onClick={() => setImgDialog(false)} className="px-4 py-2 text-[13px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                          Zrušit
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Video dialog */}
                {vidDialog && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setVidDialog(false)}>
                    <div className="bg-white rounded-2xl p-6 w-[400px] shadow-2xl" onClick={e => e.stopPropagation()}>
                      <h3 className="text-[15px] font-bold text-[#001161] mb-4">Vložit YouTube video</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">YouTube URL *</label>
                          <input autoFocus type="url" value={vidUrl} onChange={e => setVidUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && insertVideo()}
                            placeholder="https://www.youtube.com/watch?v=…"
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Titulek videa</label>
                          <input type="text" value={vidTitle} onChange={e => setVidTitle(e.target.value)}
                            placeholder="Nepovinný popis…"
                            className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:border-[#001161] outline-none" />
                        </div>
                        {vidUrl && extractYoutubeId(vidUrl) && (
                          <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                            <iframe src={`https://www.youtube.com/embed/${extractYoutubeId(vidUrl)}`} title="náhled"
                              className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={insertVideo} className="flex-1 flex items-center justify-center gap-1.5 bg-[#001161] text-white py-2 rounded-xl text-[13px] font-bold hover:bg-[#0d1f7a] transition-colors">
                          <Check className="w-4 h-4" /> Vložit
                        </button>
                        <button onClick={() => setVidDialog(false)} className="px-4 py-2 text-[13px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                          Zrušit
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── METADATA TAB ─────────────────────────────────── */}
            {activeTab === 'meta' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl space-y-5">

                  {/* Status card */}
                  <div className={`rounded-xl p-4 border flex items-center gap-3 ${selected.published ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    {selected.published ? <Globe className="w-5 h-5 text-emerald-600 shrink-0" /> : <Lock className="w-5 h-5 text-amber-600 shrink-0" />}
                    <div className="flex-1">
                      <p className={`text-[13px] font-bold ${selected.published ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {selected.published ? 'Článek je živý — zobrazuje se na blogu' : 'Článek je koncept — není viditelný na webu'}
                      </p>
                    </div>
                    <button onClick={() => updateField('published', !selected.published)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${selected.published ? 'bg-emerald-200 hover:bg-emerald-300 text-emerald-800' : 'bg-amber-200 hover:bg-amber-300 text-amber-800'}`}>
                      {selected.published ? 'Skrýt' : 'Zveřejnit'}
                    </button>
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Slug (URL) *</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-gray-400 shrink-0">/blog/</span>
                      <input type="text" value={selected.slug || ''} onChange={e => { setSlugManual(true); updateField('slug', e.target.value); }}
                        placeholder="url-clanku"
                        className="flex-1 px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none font-mono" />
                      {selected.title && (
                        <button onClick={() => { setSlugManual(false); updateField('slug', slugify(selected.title || '')); }}
                          className="px-2 py-1.5 text-[10px] text-gray-400 hover:text-[#001161] border border-gray-200 rounded-lg transition-colors shrink-0">Auto</button>
                      )}
                    </div>
                  </div>

                  {/* Category + Author */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Kategorie</label>
                      <input type="text" value={selected.category || ''} onChange={e => updateField('category', e.target.value)}
                        placeholder="Inspirace, Rozhovor…" list="blog-cats"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none" />
                      <datalist id="blog-cats">
                        {Array.from(new Set(items.map(i => i.category).filter(Boolean))).map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Autor</label>
                      <input type="text" value={selected.author || ''} onChange={e => updateField('author', e.target.value)}
                        placeholder="Jméno autora…"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none" />
                    </div>
                  </div>

                  {/* Date + ReadTime */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Datum</label>
                      <input type="text" value={selected.date || ''} onChange={e => updateField('date', e.target.value)}
                        placeholder="7. března 2026"
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Doba čtení (min)</label>
                      <input type="number" value={selected.readTime || 5} onChange={e => updateField('readTime', parseInt(e.target.value) || 5)}
                        min={1} max={60}
                        className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none" />
                    </div>
                  </div>

                  {/* Cover image */}
                  <div>
                    <ImagePicker
                      label="Obalka"
                      value={selected.coverImage || ''}
                      onChange={url => updateField('coverImage', url)}
                      previewHeight={200}
                    />
                  </div>

                  {/* Excerpt */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Perex</label>
                    <textarea value={selected.excerpt || ''} onChange={e => updateField('excerpt', e.target.value)} rows={3}
                      placeholder="Krátký popis článku zobrazený v kartičce…"
                      className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl bg-white focus:border-[#001161] outline-none resize-y" />
                  </div>
                </div>
              </div>
            )}

            {/* ── PREVIEW TAB ──────────────────────────────────── */}
            {activeTab === 'preview' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {selected.coverImage && (
                    <img src={selected.coverImage} alt={selected.title} className="w-full object-cover" style={{ maxHeight: 280 }} />
                  )}
                  <div className="p-8">
                    {!selected.published && (
                      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[12px] text-amber-700 font-medium">NÁHLED — Koncept (není zveřejněn)</span>
                      </div>
                    )}
                    {selected.category && <span className="text-[11px] font-bold text-[#ff6a35] uppercase tracking-widest">{selected.category}</span>}
                    <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[26px] leading-tight mt-2 mb-4">{selected.title || 'Bez názvu'}</h1>
                    <div className="flex flex-wrap gap-4 text-[12px] text-[#001161]/50 mb-6 pb-6 border-b border-gray-100">
                      {selected.author && <span className="flex items-center gap-1"><User className="w-3 h-3" />{selected.author}</span>}
                      {selected.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{selected.date}</span>}
                      {selected.readTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selected.readTime} min</span>}
                    </div>
                    {selected.excerpt && <p className="text-[14px] text-[#001161]/60 leading-relaxed mb-6 italic">{selected.excerpt}</p>}
                    {previewBlocks.map((block, i) => {
                      if (block.type === 'paragraph') return <p key={i} className="text-[15px] leading-[1.8] text-[#001161] mb-4">{block.text}</p>;
                      if (block.type === 'heading') return <h2 key={i} className="font-bold text-[#001161] text-[18px] mt-8 mb-3">{block.text}</h2>;
                      if (block.type === 'quote') return (
                        <blockquote key={i} className="my-5 bg-[#F0F2F8] rounded-xl px-5 py-4 border-l-4 border-[#ff6a35]">
                          <p className="italic text-[#001161] text-[16px] mb-1">&bdquo;{block.text}&ldquo;</p>
                          {block.author && <p className="text-[#001161]/50 text-[12px]">&mdash; {block.author}</p>}
                        </blockquote>
                      );
                      if (block.type === 'image' && block.src) return (
                        <figure key={i} className="my-5">
                          <img src={block.src} alt={block.alt} className="w-full rounded-xl object-cover" style={{ maxHeight: 220 }} />
                          {block.caption && <figcaption className="text-center text-[11px] text-[#001161]/40 mt-1">{block.caption}</figcaption>}
                        </figure>
                      );
                      if (block.type === 'video') {
                        const vid = extractYoutubeId(block.url);
                        return vid ? (
                          <figure key={i} className="my-5">
                            <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                              <iframe src={`https://www.youtube.com/embed/${vid}`} title={block.title || 'Video'} className="absolute inset-0 w-full h-full" frameBorder="0" allowFullScreen />
                            </div>
                          </figure>
                        ) : null;
                      }
                      return null;
                    })}
                    {previewBlocks.length === 0 && <p className="text-gray-300 text-[13px] text-center py-8">Obsah zatím prázdný…</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3">
            <FileText className="w-12 h-12 opacity-20" />
            <p className="text-[14px]">Vyberte článek nebo vytvořte nový</p>
            <button onClick={handleNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#001161] text-white rounded-xl text-[13px] font-bold hover:bg-[#0d1f7a] transition-colors">
              <Plus className="w-4 h-4" /> Nový článek
            </button>
          </div>
        )}
      </div>
    </>
  );
}