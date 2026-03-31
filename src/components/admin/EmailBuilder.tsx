import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  Mail, Plus, Trash2, Save, Send, Loader2,
  Copy, Check, ExternalLink, FileText, X,
  Sparkles, Brain,
  PanelLeftClose, PanelLeftOpen,
  ArrowUp, Settings2, MousePointerClick, TextCursor,
  Layers, Code, ImageIcon, Video, Undo2, Redo2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import CollageModal from './CollageModal';
import { EmailImageEditModal } from './EmailImageEditModal';
import { EmailAssetPickerModal } from './EmailAssetPickerModal';
import { buildEmailProductImagesTableHtml } from './collageUtils';
import {
  EMAIL_BUILDER_AI_TIER_KEY,
  type EmailAiTier,
  fetchGenerateEmailWithRetry,
  getStoredEmailAiTier,
} from '../../utils/emailAiTier';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
/** Zapnutí RAG (vyhledávání v knihovně chunků) u `generate-email`. */
const EMAIL_BUILDER_RAG_KEY = 'vb-email-rag-enabled';

/* ── Types ───────────────────────────────────────────── */
interface EmailDraft {
  id: string;
  subject: string;
  previewText: string;
  headline: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  /** Pozadí rolovací plochy náhledu „za“ 600px sloupcem (jako šedá schránka). */
  previewOuterBg?: string;
  /** Pozadí 600px sloupce v náhledu + pozadí dokumentu uvnitř iframe. */
  previewColumnBg?: string;
  audience: 'newsletter' | 'no-newsletter';
  fullHtml?: string;
  status: 'draft' | 'pushed' | 'sent';
  mailchimpCampaignId?: string;
  mailchimpUrl?: string;
  createdAt: string;
  updatedAt: string;
  chatHistory?: ChatMsg[];
}

interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  content: string;
  ragDebug?: RagDebug | null;
  timestamp: string;
}

interface RagDebug {
  indexSize: number;
  chunksUsed: number;
  topScore: number;
  sources: string[];
  productCount?: number;
  webinarCount?: number;
  productImagesCount?: number;
  /** Počet úryvků do Agent 1 (brief) — může být vyšší než chunksUsed u HTML fáze. */
  chunksBriefUsed?: number;
  ragBriefTopScore?: number;
  contentBriefChars?: number;
  contentBriefUsed?: boolean;
}

const DEFAULT_PREVIEW_OUTER_BG = '#f3f4f6';
const DEFAULT_PREVIEW_COLUMN_BG = '#ffffff';

const EMPTY_DRAFT: Omit<EmailDraft, 'id' | 'createdAt' | 'updatedAt'> = {
  subject: '', previewText: '', headline: '', bodyHtml: '',
  ctaText: 'Vyzkoušejte zdarma', ctaUrl: 'https://www.vividbooks.com/vyzkousejte',
  previewOuterBg: DEFAULT_PREVIEW_OUTER_BG,
  previewColumnBg: DEFAULT_PREVIEW_COLUMN_BG,
  audience: 'newsletter', status: 'draft',
};

const MAX_UNDO_STEPS = 45;

/** Hluboká kopie draftu pro undo zásobník (chat + případný ragDebug). */
function cloneDraftForHistory(d: EmailDraft): EmailDraft {
  return {
    ...d,
    chatHistory: d.chatHistory?.map(m => ({
      ...m,
      ragDebug: m.ragDebug
        ? { ...m.ragDebug, sources: [...(m.ragDebug.sources || [])] }
        : null,
    })),
  };
}

function normalizeHexColor(input: string | undefined, fallback: string): string {
  const s = (input || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return fallback;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getPlainTextBeforeInsertAnchor(doc: Document | null | undefined, anchorId: string | null): string {
  if (!doc?.body || !anchorId) return '';
  const anchor = doc.querySelector(`[data-vb-insert="${anchorId}"]`);
  if (!anchor || !doc.body.contains(anchor)) {
    const t = doc.body.innerText || '';
    return t.replace(/\s+/g, ' ').trim().slice(-6000);
  }
  try {
    const r = doc.createRange();
    r.selectNodeContents(doc.body);
    r.setEndBefore(anchor);
    const wrap = doc.createElement('div');
    wrap.appendChild(r.cloneContents());
    const text = (wrap.innerText || '').replace(/\s+/g, ' ').trim();
    return text.slice(-6000);
  } catch {
    return (doc.body.innerText || '').replace(/\s+/g, ' ').trim().slice(-6000);
  }
}

/** HTML bloku za který má AI něco vložit — bez data-vb-insert, omezená délka. */
function getAnchorBlockOuterHtmlForAi(doc: Document | null | undefined, anchorId: string | null): string {
  if (!doc?.body || !anchorId) return '';
  const anchor = doc.querySelector(`[data-vb-insert="${anchorId}"]`);
  if (!anchor || !doc.body.contains(anchor)) return '';
  const clone = anchor.cloneNode(true) as HTMLElement;
  clone.removeAttribute('data-vb-insert');
  let html = clone.outerHTML;
  if (html.length > 3500) html = `${html.slice(0, 3500)}…`;
  return html;
}

function stripDataVbInsertFromHtml(html: string): string {
  return html.replace(/\s+data-vb-insert="[^"]*"/g, '');
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Nahradí `src` u všech <img>, které mají přesně dané URL (např. po kliknutí v editoru). */
function replaceImgSrcInHtml(html: string, oldSrc: string, newSrc: string): string {
  if (!html || !oldSrc || !newSrc) return html;
  const esc = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(<img[^>]*\\bsrc=["'])${esc}(["'])`, 'gi');
  const safe = escapeHtmlAttr(newSrc);
  return html.replace(re, (_m, a, q) => `${a}${safe}${q}`);
}

function escapeHtmlTextContent(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildInlineCtaHtml(buttonText: string, href: string): string {
  const text = escapeHtmlTextContent((buttonText || '').trim() || 'Další informace');
  let url = (href || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://www.vividbooks.com${url.startsWith('/') ? url : `/${url}`}`;
  }
  const safeHref = escapeHtmlAttr(url);
  return (
    `<div style="text-align:center;padding:20px 0;">` +
    `<a class="vb-preview-cta" href="${safeHref}" style="display:inline-block;background-color:#7C3AED;color:#ffffff;` +
    `font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;` +
    `border-radius:999px;text-decoration:none;">${text}</a></div>`
  );
}

function preprocessHtml(html: string): string {
  if (!html) return html;
  let result = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, url) =>
      `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`,
  );
  result = result.replace(/!\[([^\]]*)\](?!\()/g, '');
  return result;
}

/**
 * Plné „emailové“ HTML v iframe — stejná izolace jako u skutečného klienta (žádné styly z adminu).
 */
function buildEmailSrcDoc(bodyInnerHtml: string, bodyBackground = '#ffffff', imageEditMode = false): string {
  const inner = bodyInnerHtml || '<p style="margin:0;color:#999;">Klikněte a pište…</p>';
  const bg = (bodyBackground || '#ffffff').replace(/[<>"']+/g, '').slice(0, 32) || '#ffffff';
  const imgEditCss = imageEditMode
    ? `body.vb-img-edit img{cursor:grab;transition:outline .12s ease}body.vb-img-edit img:hover{outline:2px solid rgba(124,58,237,0.45);outline-offset:2px}
body.vb-img-edit .vb-email-root>*:not(style):not(script){cursor:grab}
body.vb-img-edit .vb-email-root>*:not(style):not(script):hover{outline:1px dashed rgba(124,58,237,0.35);outline-offset:2px}
body.vb-img-edit .vb-dnd-dragging{opacity:0.55!important;outline:2px solid #7C3AED!important}`
    : '';
  const bodyClass = imageEditMode ? ' class="vb-img-edit"' : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>
html,body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
html{font-family:Arial,Helvetica,sans-serif;background:${bg};color-scheme:light;}
body{font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333;background:${bg};color-scheme:light;-webkit-forced-color-adjust:none;forced-color-adjust:none;}
/* Náhled: jednotný Arial i proti inline fontům z AI / Mailchimp */
body *{font-family:Arial,Helvetica,sans-serif !important;}
pre,code,kbd,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace !important;}
a{color:#7C3AED;}
img{max-width:100%;height:auto;}
${imgEditCss}
@media only screen and (max-width:600px){
  body{font-size:17px!important;line-height:1.65!important;}
  body p,body li{font-size:17px!important;line-height:1.65!important;}
  body h1{font-size:26px!important;line-height:1.2!important;}
  body h2{font-size:22px!important;line-height:1.25!important;}
  body h3{font-size:19px!important;}
  a.vb-preview-cta{font-size:17px!important;padding:16px 28px!important;line-height:1.2!important;}
}
</style></head><body${bodyClass}>${inner}</body></html>`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-gray-200 text-[#001161]/50 hover:text-[#7C3AED] hover:border-[#7C3AED]/30 transition-all cursor-pointer"
      style={F}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Zkopírováno' : 'Kopírovat'}
    </button>
  );
}

function RagBadges({ info }: { info: RagDebug }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
          (info.productCount ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'
        }`}
        style={F}
      >
        {(info.productCount ?? 0) > 0 ? '✓' : '✗'} Produkty: {info.productCount ?? 0}
      </span>
      {(info.webinarCount ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700" style={F}>
          Webináře: {info.webinarCount}
        </span>
      )}
      {(info.productImagesCount ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700" style={F}>
          Obrázky: {info.productImagesCount}
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
          info.chunksUsed > 0 ? 'bg-emerald-50 text-emerald-700'
            : info.indexSize > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-500'
        }`}
        style={F}
      >
        {info.chunksUsed > 0 ? '⚡' : '○'} RAG → HTML:{' '}
        {info.chunksUsed > 0
          ? `${info.chunksUsed} chunků (${info.topScore}%)`
          : info.indexSize > 0
            ? `0/${info.indexSize}`
            : 'prázdný'}
      </span>
      {(info.chunksBriefUsed ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-800" style={F}>
          RAG → brief: {info.chunksBriefUsed} úryvků
          {info.ragBriefTopScore != null ? ` (${info.ragBriefTopScore}%)` : ''}
          {info.contentBriefChars != null && info.contentBriefChars > 0
            ? ` · brief ${Math.round(info.contentBriefChars / 1000)}k znaků`
            : ''}
        </span>
      )}
      {info.sources.map(s => (
        <span key={s} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#7C3AED]/8 text-[#7C3AED]" style={F}>
          {s}
        </span>
      ))}
    </div>
  );
}

function EditableField({ value, onChange, placeholder, className, multiline, tag }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  multiline?: boolean;
  tag?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => { setTmp(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    const shared =
      `w-full bg-white border border-[#7C3AED]/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 ${className || ''}`;
    const save = () => { onChange(tmp); setEditing(false); };
    const cancel = () => { setTmp(value); setEditing(false); };
    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !multiline) { e.preventDefault(); save(); }
      if (e.key === 'Escape') cancel();
    };
    return multiline ? (
      <div className="relative">
        <textarea
          ref={ref as unknown as React.RefObject<HTMLTextAreaElement>}
          value={tmp}
          onChange={e => setTmp(e.target.value)}
          onKeyDown={onKey}
          onBlur={save}
          className={shared}
          rows={3}
          style={F}
        />
      </div>
    ) : (
      <input
        ref={ref as unknown as React.RefObject<HTMLInputElement>}
        value={tmp}
        onChange={e => setTmp(e.target.value)}
        onKeyDown={onKey}
        onBlur={save}
        className={shared}
        style={F}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); } }}
      className={`group cursor-text rounded-lg px-1 -mx-1 transition-all hover:bg-[#7C3AED]/5 hover:ring-1 hover:ring-[#7C3AED]/20 relative ${className || ''}`}
    >
      {tag && (
        <span
          className="absolute -top-2.5 left-2 text-[8px] font-bold uppercase tracking-wider text-[#7C3AED]/0 group-hover:text-[#7C3AED]/50 transition-all px-1 bg-white rounded"
          style={F}
        >
          {tag}
        </span>
      )}
      {!value ? (
        <span className="text-[#001161]/35 italic" style={F}>{placeholder}</span>
      ) : (
        <span style={F}>{value}</span>
      )}
      <MousePointerClick className="w-3 h-3 text-[#7C3AED]/0 group-hover:text-[#7C3AED]/40 absolute top-1 right-1 transition-all" />
    </div>
  );
}

/**
 * Úpravy (readOnlyBody false): designMode, řádek +, výběr pro AI.
 * Náhled mailu (readOnlyBody true): jen čtení těla, klikatelné odkazy; předmět nahoře zůstává v editoru.
 * Při změně draftId / bodyEditEpoch / readOnlyBody se znovu načte obsah z props.
 */
/** Kořen obsahu e-mailu pro přeskupování bloků (AI vkládá `.vb-email-root`). */
function getEmailDndRoot(doc: Document): HTMLElement {
  return (doc.querySelector('.vb-email-root') as HTMLElement) || doc.body;
}

/** Blok pro vložení „+“: odstavec, nadpis, buňka tabulky, sekční DIV (běžné u HTML mailů). */
function findEditableBlock(start: Element | null, body: HTMLElement): HTMLElement | null {
  if (!start) return null;
  if (start.nodeType === Node.ELEMENT_NODE && start === body) return null;
  let n: Element | null = start.nodeType === Node.TEXT_NODE ? start.parentElement : (start as Element);
  if (!n) return null;
  while (n && n !== body) {
    const t = n.tagName;
    if (/^P$|^H[1-6]$|^LI$|^BLOCKQUOTE$|^TD$|^TH$|^DT$|^DD$|^FIGCAPTION$|^ADDRESS$|^PRE$/i.test(t)) {
      return n as HTMLElement;
    }
    if (/^TABLE$/i.test(t)) {
      n = n.parentElement;
      continue;
    }
    if (/^DIV$/i.test(t)) {
      const st = (n as HTMLElement).getAttribute('style') || '';
      const looksLikeSection =
        /background|padding|margin|border-radius|linear-gradient|gradient/i.test(st) ||
        n.parentElement === body ||
        Boolean(n.closest('td'));
      const hasText = ((n as HTMLElement).innerText || '').trim().length > 0;
      if (looksLikeSection && hasText) return n as HTMLElement;
    }
    n = n.parentElement;
  }
  return null;
}

function EmailIframeEditor({
  draftId,
  bodyEditEpoch,
  bodyHtml,
  columnBackground,
  onBodyChange,
  onImageClick,
  /** Nad iframe je panel předmět/preview (pak spodní rohy iframe zaoblené jinak). */
  hasMailboxStackAbove,
  readOnlyBody,
  iframeRef: parentIframeRef,
  onTextSelect,
  hoverBlockRef,
  onHoverInsertLine,
  onIframeLeave,
  onIframeEnter,
}: {
  draftId: string;
  bodyEditEpoch: number;
  bodyHtml: string;
  /** Pozadí dokumentu uvnitř náhledového iframe (sloupec). */
  columnBackground: string;
  /** Vždy zapisuj pod `draftId` vlastníka iframe — při přepnutí draftu cleanup nesmí použít už nový `selected`. */
  onBodyChange: (draftId: string, html: string) => void;
  onImageClick: (src: string) => void;
  hasMailboxStackAbove: boolean;
  /** true = režim „Náhled mailu“ — tělo nejde přepisovat, odkazy jdou klikat. */
  readOnlyBody: boolean;
  iframeRef?: React.MutableRefObject<HTMLIFrameElement | null>;
  onTextSelect?: (text: string | null) => void;
  hoverBlockRef?: React.MutableRefObject<HTMLElement | null>;
  onHoverInsertLine?: (rect: { top: number; left: number; width: number } | null) => void;
  /** Myš opustila iframe — rodič může lištu schovat se zpožděním (aby šlo kliknout na +). */
  onIframeLeave?: () => void;
  onIframeEnter?: () => void;
}) {
  const innerRef = useRef<HTMLIFrameElement | null>(null);
  const assignIframeRef = (el: HTMLIFrameElement | null) => {
    innerRef.current = el;
    if (parentIframeRef) parentIframeRef.current = el;
  };
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyPropRef = useRef(bodyHtml);
  bodyPropRef.current = bodyHtml;

  const onBodyChangeRef = useRef(onBodyChange);
  onBodyChangeRef.current = onBodyChange;
  const onImageClickRef = useRef(onImageClick);
  onImageClickRef.current = onImageClick;
  const onTextSelectRef = useRef(onTextSelect);
  onTextSelectRef.current = onTextSelect;
  const onHoverInsertLineRef = useRef(onHoverInsertLine);
  onHoverInsertLineRef.current = onHoverInsertLine;
  const onIframeLeaveRef = useRef(onIframeLeave);
  onIframeLeaveRef.current = onIframeLeave;
  const onIframeEnterRef = useRef(onIframeEnter);
  onIframeEnterRef.current = onIframeEnter;

  const columnBgRef = useRef(columnBackground);
  columnBgRef.current = columnBackground;

  useEffect(() => {
    const ownedDraftId = draftId;
    const fr = innerRef.current;
    if (!fr) return;
    const doc = fr.contentDocument;
    if (!doc) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const processed = preprocessHtml(bodyPropRef.current);
    doc.open();
    doc.write(buildEmailSrcDoc(processed, columnBgRef.current, !readOnlyBody));
    doc.close();

    const d = fr.contentDocument;
    if (!d) return;
    d.designMode = readOnlyBody ? 'off' : 'on';

    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    const onMove = (e: MouseEvent) => {
      if (moveTimer) return;
      moveTimer = setTimeout(() => {
        moveTimer = null;
        const t = e.target as Node;
        const el =
          t.nodeType === Node.TEXT_NODE ? (t.parentElement as Element | null) : (t as Element);
        const block = el ? findEditableBlock(el, d.body) : null;
        if (hoverBlockRef) hoverBlockRef.current = block;
        const cb = onHoverInsertLineRef.current;
        if (!cb) return;
        if (!block) {
          cb(null);
          return;
        }
        const r = block.getBoundingClientRect();
        const ir = fr.getBoundingClientRect();
        cb({
          top: ir.top + r.top,
          left: ir.left + r.left,
          width: r.width,
        });
      }, 45);
    };

    const onLeave = () => {
      onIframeLeaveRef.current?.();
    };

    const onEnter = () => {
      onIframeEnterRef.current?.();
    };

    /** V náhledu otevřít odkazy v novém panelu (iframe by se jinak přepsal). */
    const onPreviewLinkClick = (e: MouseEvent) => {
      if (!readOnlyBody) return;
      const raw = e.target;
      const el = raw instanceof Element ? raw : (raw as Node).parentElement;
      const a = el?.closest?.('a') as HTMLAnchorElement | null;
      if (!a) return;
      const hrefAttr = a.getAttribute('href');
      if (!hrefAttr || hrefAttr.startsWith('#') || /^javascript:/i.test(hrefAttr.trim())) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const url = new URL(a.href, d.location.href);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          window.open(url.href, '_blank', 'noopener,noreferrer');
          return;
        }
        window.location.assign(url.href);
      } catch {
        window.open(a.href, '_blank', 'noopener,noreferrer');
      }
    };

    if (!readOnlyBody) {
      d.body.addEventListener('mousemove', onMove);
    }
    fr.addEventListener('mouseleave', onLeave);
    fr.addEventListener('mouseenter', onEnter);
    if (readOnlyBody) {
      d.addEventListener('click', onPreviewLinkClick, true);
    }

    const MIN_H = 280;
    const syncHeight = () => {
      const doc = fr.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, MIN_H);
      fr.style.height = `${h}px`;
    };

    const commit = () => {
      if (!d.body || readOnlyBody) return;
      onBodyChangeRef.current(ownedDraftId, d.body.innerHTML);
    };
    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(commit, 320);
    };

    let suppressImgClickAfterDnD = false;
    let draggedBlock: HTMLElement | null = null;

    const rootDnd = getEmailDndRoot(d);

    const dndRootChildren = (): HTMLElement[] =>
      [...rootDnd.children].filter(
        (n): n is HTMLElement =>
          n.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test(n.tagName),
      );

    const applyDraggableAttrs = () => {
      for (const el of dndRootChildren()) {
        el.setAttribute('draggable', 'true');
      }
      rootDnd.querySelectorAll('img').forEach(img => {
        (img as HTMLElement).setAttribute('draggable', 'true');
      });
    };

    const findDraggedNode = (target: EventTarget | null): HTMLElement | null => {
      if (!target || typeof (target as Node).nodeType !== 'number') return null;
      const raw = target as Node;
      const el =
        raw.nodeType === Node.TEXT_NODE ? (raw as Text).parentElement : (raw as HTMLElement);
      if (!el || !rootDnd.contains(el)) return null;
      const asImg = el.closest('img');
      if (asImg && rootDnd.contains(asImg) && (el === asImg || asImg.contains(el))) {
        return asImg as HTMLImageElement;
      }
      let n: Node | null = el;
      while (n && n.parentNode !== rootDnd) {
        n = n.parentNode;
      }
      if (!n || n.nodeType !== 1) return null;
      const top = n as HTMLElement;
      if (/^(STYLE|SCRIPT)$/i.test(top.tagName)) return null;
      return top;
    };

    const findDropInsertBefore = (clientY: number): Element | null => {
      for (const child of dndRootChildren()) {
        if (child === draggedBlock) continue;
        const r = child.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) return child;
      }
      return null;
    };

    const onDragStartDnd = (e: DragEvent) => {
      const node = findDraggedNode(e.target);
      if (!node) {
        e.preventDefault();
        return;
      }
      draggedBlock = node;
      try {
        d.designMode = 'off';
      } catch { /* ignore */ }
      node.classList.add('vb-dnd-dragging');
      e.dataTransfer?.setData('text/plain', 'vb-move');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    };

    const onDragEndDnd = () => {
      if (draggedBlock) draggedBlock.classList.remove('vb-dnd-dragging');
      draggedBlock = null;
      suppressImgClickAfterDnD = true;
      window.setTimeout(() => {
        suppressImgClickAfterDnD = false;
      }, 160);
      if (!readOnlyBody) {
        try {
          d.designMode = 'on';
        } catch { /* ignore */ }
      }
    };

    const onDragOverDnd = (e: DragEvent) => {
      if (!draggedBlock || !rootDnd.contains(draggedBlock)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };

    const onDropDnd = (e: DragEvent) => {
      e.preventDefault();
      if (!draggedBlock || !rootDnd.contains(draggedBlock)) return;
      const y = e.clientY;
      const insertBefore = findDropInsertBefore(y);
      if (insertBefore === draggedBlock) {
        onDragEndDnd();
        return;
      }
      if (insertBefore && draggedBlock.contains(insertBefore)) {
        onDragEndDnd();
        return;
      }
      try {
        if (insertBefore) rootDnd.insertBefore(draggedBlock, insertBefore);
        else rootDnd.appendChild(draggedBlock);
      } catch {
        /* ignore */
      }
      applyDraggableAttrs();
      schedule();
      requestAnimationFrame(syncHeight);
      onDragEndDnd();
    };

    const onInput = () => {
      applyDraggableAttrs();
      schedule();
      requestAnimationFrame(syncHeight);
    };
    const onImgClick = (e: Event) => {
      if (suppressImgClickAfterDnD) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG') {
        e.preventDefault();
        onImageClickRef.current((t as HTMLImageElement).src);
      }
    };

    if (!readOnlyBody) {
      applyDraggableAttrs();
      d.body.addEventListener('input', onInput);
      d.addEventListener('click', onImgClick, true);
      rootDnd.addEventListener('dragstart', onDragStartDnd, true);
      rootDnd.addEventListener('dragend', onDragEndDnd, true);
      d.addEventListener('dragover', onDragOverDnd, true);
      d.addEventListener('drop', onDropDnd, true);
    }

    let selDebounce: ReturnType<typeof setTimeout> | null = null;
    const reportSelection = () => {
      const cb = onTextSelectRef.current;
      if (!cb) return;
      const docSel = d.getSelection();
      if (!docSel || docSel.rangeCount === 0 || docSel.isCollapsed) {
        cb(null);
        return;
      }
      const raw = docSel.toString();
      const text = raw.replace(/\u00a0/g, ' ').trim();
      if (!text) {
        cb(null);
        return;
      }
      cb(text);
    };
    const scheduleReportSelection = () => {
      if (selDebounce) clearTimeout(selDebounce);
      selDebounce = setTimeout(() => {
        selDebounce = null;
        reportSelection();
      }, 60);
    };

    d.addEventListener('selectionchange', scheduleReportSelection);
    d.addEventListener('mouseup', scheduleReportSelection);
    d.addEventListener('keyup', scheduleReportSelection);

    requestAnimationFrame(() => {
      syncHeight();
      requestAnimationFrame(syncHeight);
      reportSelection();
    });

    const ro = new ResizeObserver(() => syncHeight());
    ro.observe(d.body);

    const imgLoads: Array<{ el: Element; fn: () => void }> = [];
    d.body.querySelectorAll('img').forEach(el => {
      const fn = () => syncHeight();
      el.addEventListener('load', fn);
      imgLoads.push({ el, fn });
    });

    return () => {
      if (moveTimer) {
        clearTimeout(moveTimer);
        moveTimer = null;
      }
      if (!readOnlyBody) {
        d.body.removeEventListener('mousemove', onMove);
      }
      fr.removeEventListener('mouseleave', onLeave);
      fr.removeEventListener('mouseenter', onEnter);
      if (readOnlyBody) {
        d.removeEventListener('click', onPreviewLinkClick, true);
      }
      if (hoverBlockRef) hoverBlockRef.current = null;
      onHoverInsertLineRef.current?.(null);
      if (selDebounce) clearTimeout(selDebounce);
      onTextSelectRef.current?.(null);
      d.removeEventListener('selectionchange', scheduleReportSelection);
      d.removeEventListener('mouseup', scheduleReportSelection);
      d.removeEventListener('keyup', scheduleReportSelection);
      ro.disconnect();
      imgLoads.forEach(({ el, fn }) => el.removeEventListener('load', fn));
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      commit();
      if (!readOnlyBody) {
        d.body.removeEventListener('input', onInput);
        d.removeEventListener('click', onImgClick, true);
        rootDnd.removeEventListener('dragstart', onDragStartDnd, true);
        rootDnd.removeEventListener('dragend', onDragEndDnd, true);
        d.removeEventListener('dragover', onDragOverDnd, true);
        d.removeEventListener('drop', onDropDnd, true);
      }
    };
  }, [draftId, bodyEditEpoch, readOnlyBody]);

  useEffect(() => {
    const d = innerRef.current?.contentDocument;
    if (!d?.body) return;
    const bg = normalizeHexColor(columnBackground, DEFAULT_PREVIEW_COLUMN_BG);
    d.documentElement.style.background = bg;
    d.body.style.background = bg;
    d.documentElement.style.colorScheme = 'light';
    d.body.style.colorScheme = 'light';
  }, [columnBackground]);

  return (
    <iframe
      ref={assignIframeRef}
      title={
        readOnlyBody
          ? 'Náhled těla — odkazy lze otevřít, text nelze měnit'
          : 'Úprava těla emailu'
      }
      className={`w-full min-h-[280px] border-0 block ${hasMailboxStackAbove ? 'rounded-b-xl' : 'rounded-xl'} [color-scheme:light]`}
      style={{
        backgroundColor: normalizeHexColor(columnBackground, DEFAULT_PREVIEW_COLUMN_BG),
        colorScheme: 'light',
      }}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    />
  );
}

export default function EmailBuilder() {
  const [searchParams] = useSearchParams();
  const draftParam = searchParams.get('draft');

  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [selected, setSelected] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [generating, setGenerating] = useState(false);
  /** Stejné tierové modely jako u Web operátora (`generate-email`). */
  const [emailGenTier, setEmailGenTier] = useState<EmailAiTier>(() => getStoredEmailAiTier());
  const [emailGenRagEnabled, setEmailGenRagEnabled] = useState(() => {
    try {
      if (typeof window === 'undefined') return true;
      return window.localStorage.getItem(EMAIL_BUILDER_RAG_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  /** Zvýšit po AI / koláži — znovu naplní iframe z props (ne při každém keystroke). */
  const [bodyEditEpoch, setBodyEditEpoch] = useState(0);
  const bumpBodyEpoch = useCallback(() => setBodyEditEpoch(e => e + 1), []);

  const canvasRef = useRef<HTMLDivElement>(null);
  /** Aktuální draft — aby dokončený async `loadDrafts` nepřepsal výběr uživatele (stale `selected` v closure). */
  const selectedIdRef = useRef<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeHoverBlockRef = useRef<HTMLElement | null>(null);
  const pendingInsertAnchorRef = useRef<string | null>(null);
  const insertLineHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [insertLineRect, setInsertLineRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [insertBlockMenuOpen, setInsertBlockMenuOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  /** Kliknutý <img> v těle — úprava URL / ořez / galerie. */
  const [imageToolSrc, setImageToolSrc] = useState<string | null>(null);
  const [collageOpen, setCollageOpen] = useState(false);
  const [ctaInsertModalOpen, setCtaInsertModalOpen] = useState(false);
  const [ctaFormText, setCtaFormText] = useState('');
  const [ctaFormUrl, setCtaFormUrl] = useState('');
  const [ctaAiHint, setCtaAiHint] = useState('');
  const [ctaAiLoading, setCtaAiLoading] = useState(false);
  const [editingImgSrc, setEditingImgSrc] = useState<string | null>(null);
  const [htmlDrawerOpen, setHtmlDrawerOpen] = useState(false);
  const [metaExpanded, setMetaExpanded] = useState(false);
  /** true = panel „jako ve schránce“ (předmět, preview, metadata); false = jen hezké okno s tělem (úpravy bez horního bloku). */
  const [showInboxChrome, setShowInboxChrome] = useState(false);
  /** ID kotvy u + — další AI odpověď má vložit obsah hned za tento blok v těle. */
  const [aiInsertAfterAnchorId, setAiInsertAfterAnchorId] = useState<string | null>(null);

  const [selectedCanvasText, setSelectedCanvasText] = useState('');
  const [capturedSelection, setCapturedSelection] = useState<string | null>(null);

  /** Lokální historie úprav aktuálního draftu (undo / redo). */
  const [historyPast, setHistoryPast] = useState<EmailDraft[]>([]);
  const [historyFuture, setHistoryFuture] = useState<EmailDraft[]>([]);
  const isApplyingHistoryRef = useRef(false);
  const selectedRef = useRef<EmailDraft | null>(null);
  const iframeHistoryBurstRef = useRef(false);
  const iframeHistoryBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Debounce historie při úpravě bodyHtml přes `updateField` (např. textarea Zdroj HTML). */
  const bodyFieldHistoryBurstRef = useRef(false);
  const bodyFieldHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    return () => {
      if (iframeHistoryBurstTimerRef.current) clearTimeout(iframeHistoryBurstTimerRef.current);
      if (bodyFieldHistoryTimerRef.current) clearTimeout(bodyFieldHistoryTimerRef.current);
    };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EMAIL_BUILDER_AI_TIER_KEY, emailGenTier);
    } catch { /* ignore */ }
  }, [emailGenTier]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EMAIL_BUILDER_RAG_KEY, emailGenRagEnabled ? '1' : '0');
    } catch { /* ignore */ }
  }, [emailGenRagEnabled]);

  useEffect(() => {
    setBodyEditEpoch(e => e + 1);
  }, [selected?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (imageToolSrc) {
          setImageToolSrc(null);
          return;
        }
        setHtmlDrawerOpen(false);
        setSelectedCanvasText('');
        try {
          previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
        } catch { /* ignore */ }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageToolSrc]);

  const selectDraft = useCallback((d: EmailDraft) => {
    selectedIdRef.current = d.id;
    if (iframeHistoryBurstTimerRef.current) {
      clearTimeout(iframeHistoryBurstTimerRef.current);
      iframeHistoryBurstTimerRef.current = null;
    }
    iframeHistoryBurstRef.current = false;
    if (bodyFieldHistoryTimerRef.current) {
      clearTimeout(bodyFieldHistoryTimerRef.current);
      bodyFieldHistoryTimerRef.current = null;
    }
    bodyFieldHistoryBurstRef.current = false;
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelected(d);
    setChatMsgs(d.chatHistory || []);
    setChatInput('');
    setCapturedSelection(null);
    setSelectedCanvasText('');
    try {
      previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    const run = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${SERVER}/admin/email-drafts`, { headers: AUTH_H, signal });
        const data = await r.json();
        if (signal.aborted) return;
        if (data.error) throw new Error(data.error);
        const loaded = (data.drafts || []).sort((a: EmailDraft, b: EmailDraft) =>
          new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
        );
        setDrafts(loaded);
        const want = draftParam;
        if (want) {
          const pick = loaded.find((d: EmailDraft) => d.id === want);
          if (pick) selectDraft(pick);
          else if (loaded.length > 0) {
            toast.error('Draft z odkazu nebyl nalezen');
            selectDraft(loaded[0]);
          }
          return;
        }
        const sid = selectedIdRef.current;
        if (sid) {
          const match = loaded.find((d: EmailDraft) => d.id === sid);
          if (match) {
            selectDraft(match);
            return;
          }
        }
        if (loaded.length > 0) selectDraft(loaded[0]);
      } catch (e: unknown) {
        if (signal.aborted) return;
        console.error('Load drafts error:', e);
        toast.error(`Chyba při načítání: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => ac.abort();
  }, [draftParam, selectDraft]);

  const saveDraft = async (draft?: EmailDraft) => {
    const d = draft || selected;
    if (!d) return;
    setSaving(true);
    try {
      /** Po AI odpovědi se volá `saveDraft(updatedDraft)` dřív, než React stihne `setChatMsgs` — musíme uložit `draft.chatHistory`. */
      const historyToSave =
        draft !== undefined && draft.chatHistory !== undefined ? draft.chatHistory : chatMsgs;
      const toSave = { ...d, chatHistory: historyToSave, updatedAt: new Date().toISOString() };
      const r = await fetch(`${SERVER}/admin/email-drafts`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify(toSave),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setDrafts(prev => {
        const idx = prev.findIndex(x => x.id === d.id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = toSave;
          return n;
        }
        return [toSave, ...prev];
      });
      setSelected(toSave);
      toast.success('Uloženo');
    } catch (e: unknown) {
      console.error('Save draft error:', e);
      toast.error(`Chyba při ukládání: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async (id: string) => {
    if (!confirm('Smazat tento draft?')) return;
    try {
      await fetch(`${SERVER}/admin/email-drafts/${id}`, { method: 'DELETE', headers: AUTH_H });
      setDrafts(prev => prev.filter(d => d.id !== id));
      if (selected?.id === id) {
        const remaining = drafts.filter(d => d.id !== id);
        const next = remaining[0] || null;
        selectedIdRef.current = next?.id ?? null;
        setHistoryPast([]);
        setHistoryFuture([]);
        if (iframeHistoryBurstTimerRef.current) {
          clearTimeout(iframeHistoryBurstTimerRef.current);
          iframeHistoryBurstTimerRef.current = null;
        }
        iframeHistoryBurstRef.current = false;
        if (bodyFieldHistoryTimerRef.current) {
          clearTimeout(bodyFieldHistoryTimerRef.current);
          bodyFieldHistoryTimerRef.current = null;
        }
        bodyFieldHistoryBurstRef.current = false;
        setSelected(next);
        setChatMsgs(next?.chatHistory || []);
      }
      toast.success('Smazáno');
    } catch (e: unknown) {
      toast.error(`Chyba: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const createNewDraft = () => {
    const now = new Date().toISOString();
    const d: EmailDraft = {
      ...EMPTY_DRAFT, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    };
    setDrafts(prev => [d, ...prev]);
    selectDraft(d);
    toast.success('Nový draft vytvořen');
  };

  const applyHistorySnapshot = useCallback(
    (d: EmailDraft) => {
      isApplyingHistoryRef.current = true;
      const snap = cloneDraftForHistory(d);
      setSelected(snap);
      setDrafts(prev => prev.map(x => (x.id === snap.id ? snap : x)));
      setChatMsgs(snap.chatHistory || []);
      bumpBodyEpoch();
      setSelectedCanvasText('');
      setCapturedSelection(null);
      try {
        previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
      } catch { /* ignore */ }
      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [bumpBodyEpoch],
  );

  const commitHistoryBeforeMutation = useCallback(() => {
    if (isApplyingHistoryRef.current) return;
    const s = selectedRef.current;
    if (!s) return;
    setHistoryFuture([]);
    setHistoryPast(p => [...p.slice(-(MAX_UNDO_STEPS - 1)), cloneDraftForHistory(s)]);
  }, []);

  const undoEmailHistory = useCallback(() => {
    if (generating) return;
    const cur = selectedRef.current;
    if (!cur) return;
    setHistoryPast(p => {
      if (p.length === 0) return p;
      const prevSnap = p[p.length - 1];
      setHistoryFuture(f => [cloneDraftForHistory(cur), ...f]);
      applyHistorySnapshot(prevSnap);
      return p.slice(0, -1);
    });
  }, [generating, applyHistorySnapshot]);

  const redoEmailHistory = useCallback(() => {
    if (generating) return;
    const cur = selectedRef.current;
    if (!cur) return;
    setHistoryFuture(f => {
      if (f.length === 0) return f;
      const nextSnap = f[0];
      setHistoryPast(p => [...p.slice(-(MAX_UNDO_STEPS - 1)), cloneDraftForHistory(cur)]);
      applyHistorySnapshot(nextSnap);
      return f.slice(1);
    });
  }, [generating, applyHistorySnapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('iframe')) return;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) redoEmailHistory();
        else undoEmailHistory();
        return;
      }
      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        e.stopPropagation();
        redoEmailHistory();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [undoEmailHistory, redoEmailHistory]);

  const updateField = (field: keyof EmailDraft, value: unknown) => {
    if (!selected || isApplyingHistoryRef.current) return;
    if (Object.is(selected[field as keyof EmailDraft], value)) return;
    if (field === 'bodyHtml') {
      if (!bodyFieldHistoryBurstRef.current) {
        commitHistoryBeforeMutation();
        bodyFieldHistoryBurstRef.current = true;
      }
      if (bodyFieldHistoryTimerRef.current) clearTimeout(bodyFieldHistoryTimerRef.current);
      bodyFieldHistoryTimerRef.current = setTimeout(() => {
        bodyFieldHistoryTimerRef.current = null;
        bodyFieldHistoryBurstRef.current = false;
      }, 750);
    } else {
      commitHistoryBeforeMutation();
    }
    const updated = { ...selected, [field]: value, updatedAt: new Date().toISOString() };
    setSelected(updated);
    setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  /** Zapis HTML z iframe — cílový draft podle ID, ne podle `selected` (při přepnutí v záloze jinak přepíšeš špatný mail). */
  const applyIframeBodyHtml = useCallback(
    (id: string, html: string) => {
      if (!isApplyingHistoryRef.current && selectedRef.current?.id === id) {
        if (!iframeHistoryBurstRef.current) {
          commitHistoryBeforeMutation();
          iframeHistoryBurstRef.current = true;
        }
        if (iframeHistoryBurstTimerRef.current) clearTimeout(iframeHistoryBurstTimerRef.current);
        iframeHistoryBurstTimerRef.current = setTimeout(() => {
          iframeHistoryBurstTimerRef.current = null;
          iframeHistoryBurstRef.current = false;
        }, 850);
      }
      const now = new Date().toISOString();
      setDrafts(prev => prev.map(d => (d.id === id ? { ...d, bodyHtml: html, updatedAt: now } : d)));
      setSelected(prev => (prev?.id === id ? { ...prev, bodyHtml: html, updatedAt: now } : prev));
    },
    [commitHistoryBeforeMutation],
  );

  const clearCanvasSelection = () => {
    setSelectedCanvasText('');
    window.getSelection()?.removeAllRanges();
    try {
      previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
    } catch { /* ignore */ }
  };

  const handleIframeTextSelect = useCallback((text: string | null) => {
    if (text?.trim()) setSelectedCanvasText(text.trim());
    else setSelectedCanvasText('');
  }, []);

  const clearPendingInsertAnchor = useCallback(() => {
    const id = pendingInsertAnchorRef.current;
    if (!id) return;
    try {
      previewIframeRef.current?.contentDocument
        ?.querySelector(`[data-vb-insert="${id}"]`)
        ?.removeAttribute('data-vb-insert');
    } catch { /* ignore */ }
    pendingInsertAnchorRef.current = null;
    setAiInsertAfterAnchorId(prev => (prev === id ? null : prev));
  }, []);

  const clearAiInsertIntent = useCallback(() => {
    clearPendingInsertAnchor();
    setAiInsertAfterAnchorId(null);
  }, [clearPendingInsertAnchor]);

  /** Označí blok pod kurzorem pro vložení nového prvku za něj (data-vb-insert). */
  const prepareInsertAnchor = useCallback((): boolean => {
    clearPendingInsertAnchor();
    const el = iframeHoverBlockRef.current;
    const doc = previewIframeRef.current?.contentDocument;
    if (!el || !doc?.body.contains(el)) {
      toast.error('Najeďte myší na odstavec nebo nadpis v náhledu.');
      return false;
    }
    const id = crypto.randomUUID();
    el.setAttribute('data-vb-insert', id);
    pendingInsertAnchorRef.current = id;
    return true;
  }, [clearPendingInsertAnchor]);

  const insertHtmlAfterAnchorOrAppend = useCallback(
    (html: string) => {
      if (!selected) return;
      const id = pendingInsertAnchorRef.current;
      pendingInsertAnchorRef.current = null;
      setAiInsertAfterAnchorId(null);
      const doc = previewIframeRef.current?.contentDocument;
      if (id && doc) {
        try {
          const anchor = doc.querySelector(`[data-vb-insert="${id}"]`);
          if (anchor) {
            anchor.removeAttribute('data-vb-insert');
            anchor.insertAdjacentHTML('afterend', html);
            updateField('bodyHtml', doc.body.innerHTML);
            bumpBodyEpoch();
            return;
          }
        } catch { /* fall through */ }
      }
      updateField('bodyHtml', (selected.bodyHtml || '') + '\n' + html);
      bumpBodyEpoch();
    },
    [selected, updateField, bumpBodyEpoch],
  );

  const cancelInsertLineHide = useCallback(() => {
    if (insertLineHideTimerRef.current) {
      clearTimeout(insertLineHideTimerRef.current);
      insertLineHideTimerRef.current = null;
    }
  }, []);

  const scheduleInsertLineHide = useCallback(() => {
    cancelInsertLineHide();
    insertLineHideTimerRef.current = window.setTimeout(() => {
      insertLineHideTimerRef.current = null;
      setInsertLineRect(null);
      iframeHoverBlockRef.current = null;
      setInsertBlockMenuOpen(false);
    }, 380);
  }, [cancelInsertLineHide]);

  const handleHoverInsertLine = useCallback(
    (rect: { top: number; left: number; width: number } | null) => {
      if (rect) {
        cancelInsertLineHide();
        setInsertLineRect(rect);
      } else {
        iframeHoverBlockRef.current = null;
        setInsertLineRect(null);
        setInsertBlockMenuOpen(false);
      }
    },
    [cancelInsertLineHide],
  );

  useEffect(() => {
    cancelInsertLineHide();
    setInsertLineRect(null);
    iframeHoverBlockRef.current = null;
    setInsertBlockMenuOpen(false);
    clearAiInsertIntent();
  }, [selected?.id, cancelInsertLineHide, clearAiInsertIntent]);

  useEffect(() => {
    if (!showInboxChrome) return;
    cancelInsertLineHide();
    setInsertLineRect(null);
    iframeHoverBlockRef.current = null;
    setInsertBlockMenuOpen(false);
    clearAiInsertIntent();
  }, [showInboxChrome, cancelInsertLineHide, clearAiInsertIntent]);

  useEffect(() => {
    if (!insertBlockMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('[data-email-insert-toolbar]')) return;
      setInsertBlockMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    return () => document.removeEventListener('mousedown', onDoc, true);
  }, [insertBlockMenuOpen]);

  const handleCollageInsert = (url: string) => {
    if (!selected) return;
    const imgTag =
      `<img src="${url}" alt="Koláž" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`;
    if (editingImgSrc && selected.bodyHtml) {
      clearPendingInsertAnchor();
      const escaped = editingImgSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*/?>`, 'gi');
      updateField('bodyHtml', selected.bodyHtml.replace(regex, imgTag));
      setEditingImgSrc(null);
      bumpBodyEpoch();
      return;
    }
    insertHtmlAfterAnchorOrAppend(imgTag);
    setEditingImgSrc(null);
  };

  const handleCollageInsertHtml = useCallback(
    (html: string) => {
      if (!selected) return;
      if (editingImgSrc && selected.bodyHtml) {
        clearPendingInsertAnchor();
        const escaped = editingImgSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*/?>`, 'gi');
        updateField('bodyHtml', selected.bodyHtml.replace(regex, html));
        setEditingImgSrc(null);
        bumpBodyEpoch();
      } else {
        insertHtmlAfterAnchorOrAppend(html);
      }
      setCollageOpen(false);
      setEditingImgSrc(null);
    },
    [selected, editingImgSrc, clearPendingInsertAnchor, updateField, bumpBodyEpoch, insertHtmlAfterAnchorOrAppend],
  );

  const closeCtaInsertModal = useCallback(() => {
    setCtaInsertModalOpen(false);
    setCtaAiHint('');
    clearPendingInsertAnchor();
  }, [clearPendingInsertAnchor]);

  useEffect(() => {
    if (!ctaInsertModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeCtaInsertModal();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [ctaInsertModalOpen, closeCtaInsertModal]);

  const openCtaInsertFlow = useCallback(async () => {
    if (!selected) return;
    if (!prepareInsertAnchor()) return;
    setInsertBlockMenuOpen(false);
    const id = pendingInsertAnchorRef.current;
    const doc = previewIframeRef.current?.contentDocument;
    const contextText = getPlainTextBeforeInsertAnchor(doc, id);
    setCtaFormText(selected.ctaText || 'Vyzkoušejte zdarma');
    setCtaFormUrl(selected.ctaUrl || 'https://www.vividbooks.com/vyzkousejte');
    setCtaAiHint('');
    setCtaInsertModalOpen(true);
    setCtaAiLoading(true);
    try {
      const r = await fetch(`${SERVER}/admin/mailchimp/generate-inline-cta`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({
          contextText,
          subject: selected.subject,
          headline: selected.headline,
          defaultCtaUrl: selected.ctaUrl || 'https://www.vividbooks.com/vyzkousejte',
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      const c = data.cta;
      if (c?.buttonText) setCtaFormText(c.buttonText);
      if (c?.url) setCtaFormUrl(c.url);
      if (c?.hint) setCtaAiHint(c.hint);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'CTA návrh selhal');
    } finally {
      setCtaAiLoading(false);
    }
  }, [selected, prepareInsertAnchor]);

  const startChatInsertFromPlus = useCallback(() => {
    if (!prepareInsertAnchor()) return;
    setInsertBlockMenuOpen(false);
    setCapturedSelection(null);
    setSelectedCanvasText('');
    try {
      previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
    } catch { /* ignore */ }
    window.getSelection()?.removeAllRanges();
    const id = pendingInsertAnchorRef.current;
    if (id) setAiInsertAfterAnchorId(id);
    window.setTimeout(() => chatInputRef.current?.focus(), 50);
  }, [prepareInsertAnchor]);

  const regenerateCtaSuggestion = useCallback(async () => {
    if (!selected) return;
    const id = pendingInsertAnchorRef.current;
    const doc = previewIframeRef.current?.contentDocument;
    const anchorEl = id ? doc.querySelector(`[data-vb-insert="${id}"]`) : null;
    if (!id || !anchorEl || !doc.body.contains(anchorEl)) {
      toast.error('Zavřete okno a znovu zvolte CTA u znaku + v náhledu.');
      return;
    }
    const contextText = getPlainTextBeforeInsertAnchor(doc, id);
    setCtaAiLoading(true);
    try {
      const r = await fetch(`${SERVER}/admin/mailchimp/generate-inline-cta`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({
          contextText,
          subject: selected.subject,
          headline: selected.headline,
          defaultCtaUrl: selected.ctaUrl || 'https://www.vividbooks.com/vyzkousejte',
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      const c = data.cta;
      if (c?.buttonText) setCtaFormText(c.buttonText);
      if (c?.url) setCtaFormUrl(c.url);
      if (c?.hint) setCtaAiHint(c.hint);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'CTA návrh selhal');
    } finally {
      setCtaAiLoading(false);
    }
  }, [selected]);

  const applyCtaInsert = useCallback(() => {
    const html = buildInlineCtaHtml(ctaFormText, ctaFormUrl);
    insertHtmlAfterAnchorOrAppend(html);
    setCtaInsertModalOpen(false);
    setCtaAiHint('');
    toast.success('CTA vloženo');
  }, [ctaFormText, ctaFormUrl, insertHtmlAfterAnchorOrAppend]);

  /** Odeslání zprávy do generate-email; `prompt` jde do API, `chatLabel` volitelně zkrácený text do bubliny. */
  const sendChatMessage = async (prompt: string, options?: { chatLabel?: string }) => {
    const msg = prompt.trim();
    if (!msg || generating) return;

    commitHistoryBeforeMutation();

    const insertAnchorId = aiInsertAfterAnchorId;
    const selectionSlice =
      (!insertAnchorId &&
        (capturedSelection?.trim() || selectedCanvasText.trim() || '')) ||
      null;

    const bubbleText = (options?.chatLabel ?? msg).trim();
    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: bubbleText,
      timestamp: new Date().toISOString(),
    };
    const historyWithUser = [...chatMsgs, userMsg];
    setChatMsgs(historyWithUser);
    setGenerating(true);

    if (selectionSlice) {
      setCapturedSelection(null);
      clearCanvasSelection();
    }

    try {
      const convCtx = historyWithUser.map(m => `${m.role === 'user' ? 'Uživatel' : 'AI'}: ${m.content}`).join('\n');

      const docLive = previewIframeRef.current?.contentDocument;
      const anchorStill =
        !!(insertAnchorId && docLive?.body?.querySelector(`[data-vb-insert="${insertAnchorId}"]`));

      let currentEmailCtx = '';
      if (selected && (selected.subject || selected.bodyHtml)) {
        let bodyForCtx = selected.bodyHtml;
        if (insertAnchorId && anchorStill && docLive?.body) {
          bodyForCtx = stripDataVbInsertFromHtml(docLive.body.innerHTML);
        }
        currentEmailCtx =
          `\n\nAktuální email:\nPředmět: ${selected.subject}\nPreview: ${selected.previewText}\nNadpis: ${selected.headline}\nBody: ${bodyForCtx}\nCTA: ${selected.ctaText} → ${selected.ctaUrl}\nAudience: ${selected.audience}`;
      }

      let selectionCtx = '';
      if (selectionSlice) {
        selectionCtx =
          '\n\n[DŮLEŽITÉ — režim výběru v náhledu: Uživatel v těle emailu označil přesně následující text. ' +
          'Splň jeho pokyn tak, že ve výstupním poli bodyHtml vrátíš CELÉ HTML tělo zprávy, ' +
          'ale pouze tento označený úsek nahradíš upraveným zněním; zbytek obsahu, tagy a struktura musí zůstat stejné. ' +
          `Označený text:\n"""${selectionSlice}"""`;
      }

      let insertCtx = '';
      if (insertAnchorId) {
        if (!anchorStill) {
          toast.warning('Kotva u znaku + už neplatí — upravte znovu z náhledu nebo pokračujte bez vložení.');
          clearAiInsertIntent();
        } else {
          const anchorHtml = getAnchorBlockOuterHtmlForAi(docLive, insertAnchorId);
          const beforeTxt = getPlainTextBeforeInsertAnchor(docLive, insertAnchorId);
          if (anchorHtml) {
            insertCtx =
              '\n\n[DŮLEŽITÉ — režim vložení u znaku + v náhledu: Uživatel zvolil, že se má nový obsah vložit IHNED ZA následující HTML blok, a to podle jeho pokynu v poslední zprávě. ' +
              'V poli bodyHtml vrať CELÉ HTML těla zprávy: tento blok musí zůstat v kódu beze změny a BEZ PROSTŘIHÁNÍ hned za uzavírací tag tohoto bloku vložíš nový obsah jako HTML (stylově sladěný s mailem). Nic jinde v mailu neměň ani neodstraňuj. ' +
              `Blok, za který vložit (najdi přesně tuto strukturu v aktuálním body):\n"""${anchorHtml}"""\n` +
              `Čistý text těla před tímto blokem (orientace):\n"""${beforeTxt.slice(-2000)}"""`;
          } else {
            toast.warning('Nepodařilo se přečíst blok u + — zkuste znovu.');
            clearAiInsertIntent();
          }
        }
      }

      const genBody = {
        prompt: msg,
        conversationContext: convCtx + currentEmailCtx + selectionCtx + insertCtx,
        model: emailGenTier,
        rag: emailGenRagEnabled,
      };
      const { data } = await fetchGenerateEmailWithRetry(
        `${SERVER}/admin/mailchimp/generate-email`,
        AUTH_H,
        genBody,
        () =>
          toast.info('Gemini je dočasně přetížená — zkouším znovu za pár sekund…', { duration: 5000 }),
      );
      if (data.error) throw new Error(data.raw ? `${data.error}\n\nRaw: ${data.raw}` : String(data.error));

      const e = data.email || {};
      const now = new Date().toISOString();

      let aiText = '';
      if (e.subject) aiText += `**Předmět:** ${e.subject}\n`;
      if (e.headline) aiText += `**Nadpis:** ${e.headline}\n`;
      if (e.previewText) aiText += `**Preview:** ${e.previewText}\n`;
      aiText += '\nEmail byl aktualizován v náhledu.';

      const aiMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: aiText,
        ragDebug: data.ragDebug || null,
        timestamp: now,
      };

      const updatedHistory = [...historyWithUser, aiMsg];
      setChatMsgs(updatedHistory);

      const updatedDraft: EmailDraft = {
        ...(selected || { ...EMPTY_DRAFT, id: crypto.randomUUID(), createdAt: now }),
        subject: e.subject || selected?.subject || '',
        previewText: e.previewText || selected?.previewText || '',
        headline: e.headline || selected?.headline || '',
        bodyHtml: e.bodyHtml || selected?.bodyHtml || '',
        ctaText: e.ctaText || selected?.ctaText || 'Vyzkoušejte zdarma',
        ctaUrl: e.ctaUrl || selected?.ctaUrl || 'https://www.vividbooks.com/vyzkousejte',
        audience: e.audience || selected?.audience || 'newsletter',
        fullHtml: e.fullHtml || '',
        status: 'draft' as const,
        updatedAt: now,
        chatHistory: updatedHistory,
      };

      setSelected(updatedDraft);
      setDrafts(prev => {
        const idx = prev.findIndex(x => x.id === updatedDraft.id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = updatedDraft;
          return n;
        }
        return [updatedDraft, ...prev];
      });
      bumpBodyEpoch();

      const productImages: string[] = e.productImages || data.email?.productImages || [];
      if (productImages.length >= 2 && updatedDraft.bodyHtml && updatedDraft.bodyHtml.includes('data-product-collage')) {
        const tableHtml = buildEmailProductImagesTableHtml(
          productImages.map((url: string) => ({ url, title: 'Produkt' })),
          3,
        );
        const newBody = updatedDraft.bodyHtml.replace(
          /<div[^>]*data-product-collage[^>]*>[\s\S]*?<\/div>/gi,
          tableHtml,
        );
        updatedDraft.bodyHtml = newBody;
        updatedDraft.updatedAt = new Date().toISOString();
        setSelected({ ...updatedDraft });
        setDrafts(prev => prev.map(d => (d.id === updatedDraft.id ? { ...updatedDraft } : d)));
        bumpBodyEpoch();

        const successNote: ChatMsg = {
          id: crypto.randomUUID(),
          role: 'ai',
          content: `✅ Koláž v HTML nahrazena tabulkou (${productImages.length} obálek). Bez placeholderu se na konec mailu už nic automaticky nepřidává.`,
          timestamp: new Date().toISOString(),
        };
        setChatMsgs(prev => [...prev, successNote]);
        updatedDraft.chatHistory = [...(updatedDraft.chatHistory || []), successNote];
      } else if (productImages.length === 1 && updatedDraft.bodyHtml) {
        const singleImgTag =
          `<img src="${productImages[0]}" alt="Produkt" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`;
        if (updatedDraft.bodyHtml.includes('data-product-collage')) {
          updatedDraft.bodyHtml = updatedDraft.bodyHtml.replace(
            /<div[^>]*data-product-collage[^>]*>[\s\S]*?<\/div>/gi,
            singleImgTag,
          );
          setSelected({ ...updatedDraft });
          setDrafts(prev => prev.map(d => (d.id === updatedDraft.id ? { ...updatedDraft } : d)));
          bumpBodyEpoch();
        }
      }

      await saveDraft(updatedDraft);
      if (insertAnchorId) clearAiInsertIntent();
    } catch (e: unknown) {
      console.error('Send chat error:', e);
      const errMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: `Chyba: ${e instanceof Error ? e.message : String(e)}`,
        timestamp: new Date().toISOString(),
      };
      setChatMsgs(prev => [...prev, errMsg]);
      toast.error(`AI chyba: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || generating) return;
    setChatInput('');
    await sendChatMessage(msg);
  };

  /** Rychlá přeměna označeného úseku podle typologie bloků (stejná jako v system promptu generate-email). */
  const sendSelectionBlockTransform = async (kind: 'text' | 'block' | 'infographic') => {
    if (generating) return;
    if (aiInsertAfterAnchorId) {
      toast.info('Zrušte nejdřív vkládání u znaku + (režim +).');
      return;
    }
    const sel = (capturedSelection?.trim() || selectedCanvasText.trim());
    if (!sel) {
      toast.error('V náhledu vpravo označte úsek, který chcete přeměnit.');
      return;
    }

    const instructions: Record<'text' | 'block' | 'infographic', { label: string; prompt: string }> = {
      text: {
        label: 'Přeměnit na text',
        prompt:
          'Přeměň výhradně úsek označený v kontextu [DŮLEŽITÉ — režim výběru] na blok typu TEXT (typologie e-mailu — položka 2): souvislé odstavce, případně h2 nebo h3, volitelně odrážky. Bez velkého barevného rámečku, bez třísloupcové infografiky, bez tabulky produktu. Zachovej význam a fakta, tón může být volnější a souvislejší. V poli bodyHtml vrať CELOU aktuální HTML tělo zprávy; změň jen ten úsek.',
      },
      block: {
        label: 'Přeměnit na blok',
        prompt:
          'Přeměň výhradně úsek označený v kontextu na blok typu STRUKTUROVANÝ RÁMEČEK (typologie — položka 3): zaoblený barevný box (#F3F0FF nebo #FFF7ED / #ECFDF5 podle tématu), jemný border, nadpis bloku s emoji, uvnitř řádky s emoji nebo ikonou, tučný podnadpis položky a krátký popisek. Rozděl obsah výběru na 2–4 strukturované položky, pokud to dává smysl. V bodyHtml vrať CELÉ tělo; změň jen označený úsek.',
      },
      infographic: {
        label: 'Přeměnit na infografiku',
        prompt:
          'Přeměň výhradně úsek označený v kontextu na INFOGRAFIKU (typologie — položka 5): přesně 3 sloupce v tabulce, každý <td> s třídou vb-inf-col, v každém: výrazné číslo nebo hodnota, krátký tučný nadpis, jedna věta vysvětlení. Fakta odvoď z obsahu výběru, nic nevymýšlej. V bodyHtml vrať CELÉ tělo; změň jen označený úsek.',
      },
    };

    const { label, prompt } = instructions[kind];
    await sendChatMessage(prompt, { chatLabel: label });
  };

  const pushToMailchimp = async () => {
    if (!selected) return;
    setPushing(true);
    try {
      const r = await fetch(`${SERVER}/admin/mailchimp/create-draft`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({
          subject: selected.subject,
          previewText: selected.previewText,
          headline: selected.headline,
          bodyContent: selected.bodyHtml,
          ctaText: selected.ctaText,
          ctaUrl: selected.ctaUrl,
          audience: selected.audience,
          htmlBody: selected.fullHtml || undefined,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);

      const updated = {
        ...selected,
        status: 'pushed' as const,
        mailchimpCampaignId: data.campaignId,
        mailchimpUrl: data.archiveUrl || data.webUrl,
        updatedAt: new Date().toISOString(),
      };
      setSelected(updated);
      setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      await saveDraft(updated);
      toast.success('Pushnutno do Mailchimpu!');
    } catch (e: unknown) {
      console.error('Push to Mailchimp error:', e);
      toast.error(`Mailchimp chyba: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 h-full bg-white text-[#001161] overflow-hidden [color-scheme:light]"
      style={{ minWidth: 1100 }}
    >

      {selected && !showInboxChrome && insertLineRect && !assetPickerOpen && !collageOpen && !imageToolSrc && !ctaInsertModalOpen && (
        <div
          data-email-insert-toolbar
          className="fixed z-[20000]"
          style={{
            top: insertLineRect.top - 16,
            left: insertLineRect.left,
            width: Math.max(insertLineRect.width, 120),
          }}
          onMouseEnter={cancelInsertLineHide}
          onMouseLeave={scheduleInsertLineHide}
        >
          <div className="relative flex min-h-9 items-center justify-center py-1">
            <div
              className="pointer-events-none absolute left-1 right-1 top-1/2 h-px -translate-y-1/2 bg-[#7C3AED]/40"
              aria-hidden
            />
            <button
              type="button"
              title="Přidat obsah nebo nechat AI doplnit blok přes chat"
              onClick={e => {
                e.stopPropagation();
                cancelInsertLineHide();
                setInsertBlockMenuOpen(v => !v);
              }}
              className="relative z-10 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#7C3AED] text-xl font-light leading-none text-white shadow-md transition-colors hover:bg-[#6D28D9]"
              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            >
              +
            </button>
            {insertBlockMenuOpen && (
              <div
                className="absolute top-full left-1/2 z-20 mt-2 min-w-[220px] -translate-x-1/2 rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161] hover:bg-[#7C3AED]/8 transition-colors cursor-pointer"
                  onClick={() => {
                    if (!prepareInsertAnchor()) return;
                    setInsertBlockMenuOpen(false);
                    setAssetPickerOpen(true);
                  }}
                >
                  <ImageIcon className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  Obrázek z galerie
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161] hover:bg-[#7C3AED]/8 transition-colors cursor-pointer"
                  onClick={() => {
                    if (!prepareInsertAnchor()) return;
                    setInsertBlockMenuOpen(false);
                    setCollageOpen(true);
                  }}
                >
                  <Layers className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  Koláž
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161] hover:bg-[#7C3AED]/8 transition-colors cursor-pointer"
                  onClick={() => {
                    void openCtaInsertFlow();
                  }}
                >
                  <MousePointerClick className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  CTA (tlačítko)
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161] hover:bg-[#7C3AED]/8 transition-colors cursor-pointer"
                  onClick={() => {
                    startChatInsertFromPlus();
                  }}
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  Napsat přes AI (chat)
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161]/50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setInsertBlockMenuOpen(false);
                    toast.info('Vkládání videa přidáme v další verzi.');
                  }}
                >
                  <Video className="h-4 w-4 shrink-0 text-[#001161]/35" />
                  Video (již brzy)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && ctaInsertModalOpen && (
        <div
          className="fixed inset-0 z-[21000] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => closeCtaInsertModal()}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-[#001161]">Vložit CTA tlačítko</h2>
              <p className="text-[11px] text-[#001161]/45 mt-1 leading-snug">
                Text a odkaz navrhl AI z obsahu nad řádkem +. Upravte cílovou URL a text podle potřeby.
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {ctaAiLoading && (
                <div className="flex items-center gap-2 text-[12px] text-[#001161]/55">
                  <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />
                  Navrhuji tlačítko podle předchozího textu…
                </div>
              )}
              {!!ctaAiHint && !ctaAiLoading && (
                <p className="text-[11px] text-[#001161]/60 bg-[#7C3AED]/6 rounded-xl px-3 py-2 leading-relaxed">
                  {ctaAiHint}
                </p>
              )}
              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">Text na tlačítku</label>
                <input
                  type="text"
                  value={ctaFormText}
                  onChange={e => setCtaFormText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25"
                  placeholder="např. Vyzkoušejte zdarma"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">Kam odkaz směřuje (URL)</label>
                <input
                  type="url"
                  value={ctaFormUrl}
                  onChange={e => setCtaFormUrl(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/25 font-mono"
                  placeholder="https://…"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setCtaFormUrl(selected.ctaUrl || 'https://www.vividbooks.com/vyzkousejte')}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-[#001161]/70 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED] transition-colors cursor-pointer"
                  >
                    Hlavní CTA draftu
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaFormUrl('https://www.vividbooks.com/vyzkousejte')}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-[#001161]/70 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED] transition-colors cursor-pointer"
                  >
                    Vyzkoušet
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaFormUrl('https://www.vividbooks.com/produkty')}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-[#001161]/70 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED] transition-colors cursor-pointer"
                  >
                    Katalog
                  </button>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-[#fafbfd]">
              <button
                type="button"
                onClick={() => void regenerateCtaSuggestion()}
                disabled={ctaAiLoading}
                className="text-[11px] font-bold text-[#7C3AED] hover:underline disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Jiný návrh AI
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => closeCtaInsertModal()}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-[#001161]/55 hover:bg-gray-100 cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  onClick={() => applyCtaInsert()}
                  disabled={!ctaFormUrl.trim()}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                >
                  Vložit do emailu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`${sidebarOpen ? 'w-[280px]' : 'w-0'} transition-all duration-200 border-r border-gray-100 bg-[#fafbfd] flex flex-col min-h-0 overflow-hidden shrink-0`}
      >
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-200/80 text-[#001161]/50 transition-all cursor-pointer shrink-0"
            title={sidebarOpen ? 'Sbalit seznam' : 'Seznam emailů'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <Mail className="w-4 h-4 text-[#7C3AED] shrink-0" />
          <span style={F} className="text-[13px] font-bold text-[#001161] flex-1 truncate">Emaily</span>
          <button
            type="button"
            onClick={createNewDraft}
            className="p-1.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all cursor-pointer shrink-0"
            title="Nový email"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {drafts.map(d => (
            <div
              key={d.id}
              onClick={() => selectDraft(d)}
              className={`group p-2.5 rounded-lg cursor-pointer transition-all ${
                selected?.id === d.id
                  ? 'bg-[#7C3AED]/10 border border-[#7C3AED]/20'
                  : 'hover:bg-gray-100 border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p style={F} className="text-[12px] font-bold text-[#001161] truncate">
                    {d.subject || 'Bez předmětu'}
                  </p>
                  <p style={F} className="text-[10px] text-[#001161]/40 mt-0.5">
                    {fmtDate(d.updatedAt || d.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {d.status === 'pushed' && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600" style={F}>MC</span>
                  )}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); deleteDraft(d.id); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {drafts.length === 0 && (
            <div className="text-center py-8">
              <Mail className="w-8 h-8 text-[#001161]/10 mx-auto mb-2" />
              <p style={F} className="text-[11px] text-[#001161]/30">Zatím žádné emaily</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-[360px] border-r border-gray-100 flex flex-col min-h-0 overflow-hidden bg-white shrink-0">
        <div className="px-3 py-2.5 border-b border-gray-100 flex flex-col gap-1.5 shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Brain className="w-4 h-4 shrink-0 text-[#7C3AED]" aria-hidden />
            <span
              style={F}
              className="text-[11px] font-bold text-[#001161] truncate min-w-0 shrink"
              title="AI Email Agent"
            >
              AI Email Agent
            </span>
            <span className="text-[#001161]/22 shrink-0 select-none" aria-hidden>
              ·
            </span>
            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setEmailGenTier('lite')}
                title="Model Lite (Flash)"
                style={{
                  ...F,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: emailGenTier === 'lite' ? '#10b981' : 'rgba(0,17,97,0.07)',
                  color: emailGenTier === 'lite' ? '#fff' : 'rgba(0,17,97,0.35)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  lineHeight: '14px',
                }}
              >
                LITE
              </button>
              <button
                type="button"
                onClick={() => setEmailGenTier('pro')}
                title="Model Pro"
                style={{
                  ...F,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: emailGenTier === 'pro' ? '#FF6B1A' : 'rgba(0,17,97,0.07)',
                  color: emailGenTier === 'pro' ? '#fff' : 'rgba(0,17,97,0.35)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  lineHeight: '14px',
                }}
              >
                PRO
              </button>
              <span className="text-[#001161]/22 px-0.5 select-none" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => setEmailGenRagEnabled(true)}
                title="RAG zapnuto — knihovna znalostí v promptu"
                style={{
                  ...F,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '2px 5px',
                  borderRadius: 999,
                  background: emailGenRagEnabled ? '#7C3AED' : 'rgba(0,17,97,0.07)',
                  color: emailGenRagEnabled ? '#fff' : 'rgba(0,17,97,0.35)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  lineHeight: '14px',
                }}
              >
                RAG+
              </button>
              <button
                type="button"
                onClick={() => setEmailGenRagEnabled(false)}
                title="RAG vypnuto — rychlejší příprava"
                style={{
                  ...F,
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '2px 5px',
                  borderRadius: 999,
                  background: !emailGenRagEnabled ? '#94a3b8' : 'rgba(0,17,97,0.07)',
                  color: !emailGenRagEnabled ? '#fff' : 'rgba(0,17,97,0.35)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  lineHeight: '14px',
                }}
              >
                RAG−
              </button>
            </div>
          </div>
          <p style={F} className="text-[9px] text-[#001161]/38 leading-snug">
            RAG− přeskočí knihovnu (rychleji). Lite = užší podklady. Při 503 Google až 3 opakování.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3">
          {chatMsgs.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="w-8 h-8 text-[#7C3AED]/20 mx-auto mb-3" />
              <p style={F} className="text-[12px] text-[#001161]/30 mb-1">Popište email nebo označte text v náhledu</p>
              <p style={F} className="text-[10px] text-[#001161]/20">
                Úpravy: u znaku + lze zvolit „Napsat přes AI“ a v chatu popsat, co se má vložit na dané místo
              </p>
            </div>
          )}

          {chatMsgs.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  m.role === 'user' ? 'bg-[#7C3AED] text-white' : 'bg-[#f5f6fa] text-[#001161]'
                }`}
              >
                <div
                  style={F}
                  className={`text-[12px] leading-relaxed whitespace-pre-wrap [&_strong]:font-bold ${
                    m.role === 'user' ? '' : '[&_strong]:text-[#7C3AED]'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: m.content
                      .replace(/```json[\s\S]*?```/g, '')
                      .replace(/```[\s\S]*?```/g, '')
                      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      .trim(),
                  }}
                />
                {m.ragDebug && <RagBadges info={m.ragDebug} />}
                <p style={F} className={`text-[8px] mt-1.5 ${m.role === 'user' ? 'text-white/40' : 'text-[#001161]/20'}`}>
                  {fmtDate(m.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {generating && (
            <div className="flex justify-start">
              <div className="bg-[#f5f6fa] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[#7C3AED] animate-spin" />
                  <span style={F} className="text-[11px] text-[#001161]/40">Generuji…</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="shrink-0 p-3 border-t border-gray-100 bg-white">
          {aiInsertAfterAnchorId && (
            <div className="mb-2 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100/80 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-700 shrink-0" />
              <span style={F} className="text-[9px] text-amber-950/90 leading-snug flex-1">
                Místo u + je uložené — napište níže, jaký obsah se má vložit za tento blok.
              </span>
              <button
                type="button"
                onClick={clearAiInsertIntent}
                className="p-0.5 rounded hover:bg-amber-100 cursor-pointer"
                title="Zrušit vložení z +"
              >
                <X className="w-3 h-3 text-amber-800/60" />
              </button>
            </div>
          )}
          {(capturedSelection?.trim() || selectedCanvasText.trim()) && !aiInsertAfterAnchorId && (
            <div className="mb-2 space-y-2">
              <div className="px-2 py-1.5 rounded-lg bg-[#7C3AED]/5 border border-[#7C3AED]/10 flex items-center gap-2">
                <TextCursor className="w-3 h-3 text-[#7C3AED] shrink-0" />
                <span style={F} className="text-[9px] text-[#7C3AED] truncate flex-1">
                  Úprava výběru: „{(capturedSelection?.trim() || selectedCanvasText).substring(0, 40)}
                  {(capturedSelection?.trim() || selectedCanvasText).length > 40 ? '…' : ''}"
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCapturedSelection(null);
                    clearCanvasSelection();
                  }}
                  className="p-0.5 rounded hover:bg-[#7C3AED]/10 cursor-pointer"
                >
                  <X className="w-3 h-3 text-[#7C3AED]/50" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span style={F} className="w-full text-[8px] font-bold text-[#001161]/40 uppercase tracking-wide">
                  Rychlé přeměny typu bloku
                </span>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void sendSelectionBlockTransform('text')}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[10px] font-bold text-[#001161] hover:border-[#7C3AED]/35 hover:bg-[#7C3AED]/5 disabled:opacity-40 cursor-pointer transition-colors"
                  style={F}
                  title="Souvislý text, odstavce, bez rámečku"
                >
                  Přeměnit na text
                </button>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void sendSelectionBlockTransform('block')}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[10px] font-bold text-[#001161] hover:border-[#7C3AED]/35 hover:bg-[#7C3AED]/5 disabled:opacity-40 cursor-pointer transition-colors"
                  style={F}
                  title="Barevný zaoblený rámeček, strukturované položky"
                >
                  Přeměnit na blok
                </button>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void sendSelectionBlockTransform('infographic')}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[10px] font-bold text-[#001161] hover:border-[#7C3AED]/35 hover:bg-[#7C3AED]/5 disabled:opacity-40 cursor-pointer transition-colors"
                  style={F}
                  title="Tři sloupce s čísly a fakty (vb-inf-col)"
                >
                  Přeměnit na infografiku
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
              }}
              placeholder={
                aiInsertAfterAnchorId
                  ? 'Popište, co se má vložit za zvýrazněné místo (odstavec, CTA, odrážky…)…'
                  : 'Označte text v náhledu vpravo, napište úpravu…'
              }
              rows={2}
              className="flex-1 bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[12px] text-[#001161] focus:outline-none focus:border-[#7C3AED]/30 focus:ring-2 focus:ring-[#7C3AED]/10 resize-none"
              style={F}
            />
            <button
              type="button"
              onClick={sendChat}
              disabled={!chatInput.trim() || generating}
              className="self-end p-2.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-30 transition-all cursor-pointer shrink-0"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-12 border-b border-gray-100 flex items-center px-4 gap-2 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
            title={sidebarOpen ? 'Skrýt sidebar' : 'Zobrazit sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4 text-[#001161]/40" /> : <PanelLeftOpen className="w-4 h-4 text-[#001161]/40" />}
          </button>

          {selected && (
            <>
              <div
                className="flex items-center gap-0.5 rounded-lg border border-gray-200 p-0.5 bg-[#fafbfd] shrink-0"
                role="group"
                aria-label="Historie úprav"
              >
                <button
                  type="button"
                  onClick={undoEmailHistory}
                  disabled={historyPast.length === 0 || generating}
                  title="Zpět (⌘Z / Ctrl+Z)"
                  className="p-1.5 rounded-md text-[#001161]/55 hover:text-[#001161] hover:bg-gray-100 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={redoEmailHistory}
                  disabled={historyFuture.length === 0 || generating}
                  title="Vpřed (⇧⌘Z / Ctrl+Y)"
                  className="p-1.5 rounded-md text-[#001161]/55 hover:text-[#001161] hover:bg-gray-100 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <Redo2 className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>

              <span style={F} className="hidden md:inline text-[10px] font-bold text-[#001161]/35 uppercase tracking-wider shrink-0">
                Finální náhled
              </span>

              <div
                className="flex rounded-lg border border-gray-200 p-0.5 bg-[#fafbfd] shrink-0"
                role="group"
                aria-label="Režim náhledu emailu"
              >
                <button
                  type="button"
                  onClick={() => setShowInboxChrome(false)}
                  className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    !showInboxChrome
                      ? 'bg-[#7C3AED] text-white shadow-sm'
                      : 'text-[#001161]/45 hover:text-[#001161]/70 hover:bg-gray-100'
                  }`}
                  style={F}
                  title="Jen tělo v pěkném okně — bez předmětu a řádků pod ním (úpravy v náhledu níže)"
                >
                  Úpravy
                </button>
                <button
                  type="button"
                  onClick={() => setShowInboxChrome(true)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    showInboxChrome
                      ? 'bg-[#7C3AED] text-white shadow-sm'
                      : 'text-[#001161]/45 hover:text-[#001161]/70 hover:bg-gray-100'
                  }`}
                  style={F}
                  title="Předmět, preview, audience, CTA a úpravy jako nahoře ve schránce"
                >
                  <Mail className="w-3 h-3 shrink-0 opacity-90" aria-hidden />
                  Náhled mailu
                </button>
              </div>

              <div className="flex-1 min-w-0" />

              <button
                type="button"
                onClick={() => { setEditingImgSrc(null); setCollageOpen(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#001161]/50 hover:text-[#7C3AED] hover:bg-[#7C3AED]/5 transition-all cursor-pointer border border-gray-200 hover:border-[#7C3AED]/30 shrink-0"
                style={F}
              >
                <Layers className="w-3 h-3" />
                Koláž
              </button>

              <button
                type="button"
                onClick={() => setHtmlDrawerOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#001161]/45 hover:bg-gray-50 border border-transparent hover:border-gray-200 shrink-0"
                style={F}
                title="HTML / metadata"
              >
                <Code className="w-3 h-3" />
                Zdroj
              </button>

              <button
                type="button"
                onClick={() => saveDraft()}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#001161] text-white hover:bg-[#001161]/90 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                style={F}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Uložit
              </button>

              <button
                type="button"
                onClick={pushToMailchimp}
                disabled={pushing || !selected.subject}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-50 transition-all cursor-pointer shrink-0"
                style={F}
              >
                {pushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Do Mailchimpu
              </button>

              {selected.mailchimpUrl && (
                <a
                  href={selected.mailchimpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-all shrink-0"
                  title="Otevřít v Mailchimpu"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#7C3AED]" />
                </a>
              )}
            </>
          )}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          ref={canvasRef}
          style={{
            backgroundColor: selected
              ? normalizeHexColor(selected.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG)
              : '#ffffff',
          }}
        >
          {!selected ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <Mail className="w-12 h-12 text-[#001161]/10 mx-auto mb-3" />
                <p style={F} className="text-[14px] text-[#001161]/30 mb-4">Vyberte email nebo vytvořte nový</p>
                <button
                  type="button"
                  onClick={createNewDraft}
                  className="flex items-center gap-2 px-4 py-2 rounded-[999px] bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all cursor-pointer mx-auto"
                  style={F}
                >
                  <Plus className="w-4 h-4" /> Nový email
                </button>
              </div>
            </div>
          ) : (
            <div
              data-email-preview-root
              className="flex flex-col w-full min-w-0 min-h-full p-3 md:p-5"
            >
              <div className="w-[600px] max-w-full mx-auto flex flex-col flex-1 min-h-0">
                <div
                  className="w-full overflow-hidden flex flex-col flex-1 min-h-0 shadow-[0_2px_12px_rgba(0,0,0,0.08)] rounded-xl border border-black/[0.06]"
                  style={{
                    backgroundColor: normalizeHexColor(selected.previewColumnBg, DEFAULT_PREVIEW_COLUMN_BG),
                  }}
                >
                {showInboxChrome && (
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p style={F} className="text-[10px] font-bold text-[#001161]/35 uppercase tracking-wider mb-2">
                      Jako ve schránce — klikněte do řádků a upravujte
                    </p>
                    <div className="space-y-2">
                      <EditableField
                        value={selected.subject}
                        onChange={v => updateField('subject', v)}
                        placeholder="Předmět zprávy…"
                        className="text-[17px] font-bold text-[#101010] leading-snug"
                        tag="Předmět"
                      />
                      <EditableField
                        value={selected.previewText}
                        onChange={v => updateField('previewText', v)}
                        placeholder="Preview text (řádek pod předmětem u příjemce)…"
                        className="text-[13px] text-[#5f6368]"
                        tag="Preview"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMetaExpanded(e => !e)}
                      className="mt-3 flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] hover:underline"
                      style={F}
                    >
                      <Settings2 className="w-3 h-3" />
                      {metaExpanded ? 'Skrýt' : 'Další'} — audience, CTA, nadpis
                    </button>
                    {metaExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">Nadpis (když není v HTML těle)</label>
                          <EditableField
                            value={selected.headline}
                            onChange={v => updateField('headline', v)}
                            placeholder="Volitelný nadpis…"
                            className="text-[14px] font-bold text-[#001161]"
                            tag="Nadpis"
                          />
                        </div>
                        <div>
                          <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">CTA text</label>
                          <EditableField
                            value={selected.ctaText}
                            onChange={v => updateField('ctaText', v)}
                            placeholder="Tlačítko…"
                            className="text-[13px]"
                            tag="CTA"
                          />
                        </div>
                        <div>
                          <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">CTA URL</label>
                          <EditableField
                            value={selected.ctaUrl}
                            onChange={v => updateField('ctaUrl', v)}
                            placeholder="https://…"
                            className="text-[12px] font-mono text-[#001161]/80"
                            tag="URL"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">Audience</label>
                          <div className="flex gap-2">
                            {(['newsletter', 'no-newsletter'] as const).map(a => (
                              <button
                                key={a}
                                type="button"
                                onClick={() => updateField('audience', a)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                  selected.audience === a ? 'bg-[#7C3AED] text-white' : 'bg-gray-100 text-[#001161]/50 hover:bg-gray-200'
                                }`}
                                style={F}
                              >
                                {a === 'newsletter' ? 'Newsletter' : 'No-Newsletter'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="sm:col-span-2 pt-2 border-t border-gray-100">
                          <p style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase tracking-wide mb-2">
                            Pozadí náhledu (jen editor)
                          </p>
                          <p style={F} className="text-[10px] text-[#001161]/45 mb-3 leading-snug">
                            Nastaví šedivou plochu kolem mailu a barvu 600px sloupce včetně těla zprávy v náhledu. Ovlivní to neposílané HTML do Mailchimpu, dokud barvy nevložíte do obsahu.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">Plocha za sloupcem</label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  aria-label="Barva pozadí okolo mailu"
                                  className="h-9 w-11 shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-0"
                                  value={normalizeHexColor(selected.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG)}
                                  onChange={e => updateField('previewOuterBg', e.target.value)}
                                />
                                <input
                                  type="text"
                                  spellCheck={false}
                                  className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-2 text-[11px] font-mono text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                                  value={selected.previewOuterBg ?? DEFAULT_PREVIEW_OUTER_BG}
                                  onChange={e => updateField('previewOuterBg', e.target.value)}
                                  placeholder="#f3f4f6"
                                />
                              </div>
                            </div>
                            <div>
                              <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">600px sloupec + tělo</label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  aria-label="Barva sloupce a iframe"
                                  className="h-9 w-11 shrink-0 cursor-pointer rounded border border-gray-200 bg-white p-0"
                                  value={normalizeHexColor(selected.previewColumnBg, DEFAULT_PREVIEW_COLUMN_BG)}
                                  onChange={e => updateField('previewColumnBg', e.target.value)}
                                />
                                <input
                                  type="text"
                                  spellCheck={false}
                                  className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-2 text-[11px] font-mono text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                                  value={selected.previewColumnBg ?? DEFAULT_PREVIEW_COLUMN_BG}
                                  onChange={e => updateField('previewColumnBg', e.target.value)}
                                  placeholder="#ffffff"
                                />
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!selected) return;
                              const updated = {
                                ...selected,
                                previewOuterBg: DEFAULT_PREVIEW_OUTER_BG,
                                previewColumnBg: DEFAULT_PREVIEW_COLUMN_BG,
                                updatedAt: new Date().toISOString(),
                              };
                              setSelected(updated);
                              setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
                            }}
                            className="mt-2 text-[10px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
                            style={F}
                          >
                            Obnovit výchozí barvy náhledu
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`flex flex-col flex-1 min-h-0 px-3 py-4 md:px-6 ${showInboxChrome ? 'rounded-b-xl' : 'rounded-xl'}`}
                >
                  <EmailIframeEditor
                    draftId={selected.id}
                    bodyEditEpoch={bodyEditEpoch}
                    bodyHtml={selected.bodyHtml}
                    columnBackground={normalizeHexColor(selected.previewColumnBg, DEFAULT_PREVIEW_COLUMN_BG)}
                    onBodyChange={applyIframeBodyHtml}
                    onImageClick={setImageToolSrc}
                    hasMailboxStackAbove={showInboxChrome}
                    readOnlyBody={showInboxChrome}
                    iframeRef={previewIframeRef}
                    onTextSelect={handleIframeTextSelect}
                    hoverBlockRef={iframeHoverBlockRef}
                    onHoverInsertLine={handleHoverInsertLine}
                    onIframeLeave={scheduleInsertLineHide}
                    onIframeEnter={cancelInsertLineHide}
                  />
                </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {htmlDrawerOpen && selected && (
        <div
          className="fixed inset-0 z-[12000] bg-black/40 flex justify-end"
          onClick={() => setHtmlDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
              <FileText className="w-4 h-4 text-[#7C3AED]" />
              <span style={F} className="text-[13px] font-bold text-[#001161]">Zdroj HTML</span>
              <div className="flex-1" />
              <CopyBtn text={selected.fullHtml || selected.bodyHtml || ''} />
              <button type="button" onClick={() => setHtmlDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p style={F} className="text-[10px] text-[#001161]/40 mb-2">
                Úprava zde obnoví náhled po uložení změny (nebo zavřete a použijte AI).
              </p>
              <textarea
                value={selected.bodyHtml}
                onChange={e => {
                  updateField('bodyHtml', e.target.value);
                }}
                onBlur={() => bumpBodyEpoch()}
                className="w-full min-h-[60vh] bg-[#f7f8fc] border border-gray-200 rounded-lg px-3 py-2 text-[11px] font-mono text-[#001161]/80 focus:outline-none focus:border-[#7C3AED]/30 resize-y"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      <EmailImageEditModal
        open={!!imageToolSrc}
        src={imageToolSrc}
        onClose={() => setImageToolSrc(null)}
        onApplyUrl={newUrl => {
          if (!selected || !imageToolSrc) return;
          updateField('bodyHtml', replaceImgSrcInHtml(selected.bodyHtml, imageToolSrc, newUrl));
          setImageToolSrc(null);
          bumpBodyEpoch();
          toast.success('Obrázek v mailu byl aktualizován');
        }}
        onOpenGallery={() => setAssetPickerOpen(true)}
        onOpenCollage={() => {
          if (!imageToolSrc) return;
          setEditingImgSrc(imageToolSrc);
          setImageToolSrc(null);
          setCollageOpen(true);
        }}
      />

      <EmailAssetPickerModal
        open={assetPickerOpen}
        onClose={() => {
          clearPendingInsertAnchor();
          setAssetPickerOpen(false);
        }}
        onPick={url => {
          if (imageToolSrc && selected) {
            updateField('bodyHtml', replaceImgSrcInHtml(selected.bodyHtml, imageToolSrc, url));
            setImageToolSrc(null);
            bumpBodyEpoch();
            setAssetPickerOpen(false);
            toast.success('Obrázek nahrazen z galerie');
            return;
          }
          const imgTag = `<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`;
          insertHtmlAfterAnchorOrAppend(imgTag);
          setAssetPickerOpen(false);
        }}
      />

      <CollageModal
        open={collageOpen}
        onClose={() => {
          clearPendingInsertAnchor();
          setCollageOpen(false);
          setEditingImgSrc(null);
        }}
        onInsert={handleCollageInsert}
        onInsertHtml={handleCollageInsertHtml}
        editingImageUrls={editingImgSrc ? [editingImgSrc] : undefined}
        uiContext="email"
      />
    </div>
  );
}
