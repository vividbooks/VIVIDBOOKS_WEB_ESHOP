import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router';
import {
  Mail, Plus, Trash2, Save, Send, Loader2,
  CopyPlus, ClipboardCopy, ClipboardPaste, ExternalLink, X,
  Sparkles, Brain,
  PanelLeftClose, PanelLeftOpen,
  ArrowUp, ChevronUp, ChevronDown, Settings2, MousePointerClick, TextCursor,
  Layers, Code, ImageIcon, Video, Undo2, Redo2, LayoutTemplate,
  AlignLeft, AlignCenter, AlignRight, Minus, RectangleHorizontal, Columns2, Columns3, PanelTop, ShoppingBag,
  ArrowDown, SquareDashed,
  SquareStack,
  BetweenVerticalStart,
  Bold, Italic, Underline, Strikethrough, Link2, List, ListOrdered,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import CollageModal from './CollageModal';
import { EmailProductCollagePanel, type EmailProductCollageLivePayload } from './EmailProductCollagePanel';
import { EmailWebinarPanel, type EmailWebinarLivePayload } from './EmailWebinarPanel';
import {
  buildProductCollageBlockHtml,
  encodeProductCollagePayload,
  readProductCollageStateFromElement,
} from './emailProductCollage';
import {
  buildWebinarBlockHtml,
  encodeWebinarPayload,
  readWebinarStateFromElement,
} from './emailWebinarBlock';
import { EmailImageEditModal } from './EmailImageEditModal';
import { EmailAssetPickerModal } from './EmailAssetPickerModal';
import { buildEmailProductImagesTableHtml } from './collageUtils';
import {
  EMAIL_BUILDER_AI_TIER_KEY,
  type EmailAiTier,
  fetchGenerateEmailWithRetry,
  getStoredEmailAiTier,
} from '../../utils/emailAiTier';
import {
  EMAIL_BLOCK_PRESETS,
  type EmailBlockPreset,
  type EmailBlockType,
  type EmailBuilderMode,
  type EmailSectionFill,
  buildEmailBlockHtml,
  buildEmailSectionHtml,
  extractFirstImage,
  extractFirstLink,
  getEmailBlockLabel,
  inferEmailBlockType,
  normalizeEmailBodyHtml,
  readElementBackground,
  readElementPadding,
  setInlineStyleValue,
  wrapRootBlockInSection,
} from './emailBlocks';

/** Přetahování typu bloku z knihovny do iframe náhledu (HTML5 DnD). */
const VB_EMAIL_LIBRARY_DRAG_TYPE = 'application/x-vb-email-block-type';
const EMAIL_PRESET_TYPE_SET = new Set<EmailBlockType>(EMAIL_BLOCK_PRESETS.map((p) => p.type));

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const AUTH_H = { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
const F = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
/** HTML jednoho bloku (bez `data-vb-block-id`) pro vložení v jiném mailu přes + v postranní liště. */
const EMAIL_BLOCK_CLIPBOARD_STORAGE_KEY = 'vb-email-block-clipboard-html';
/** Zapnutí RAG (vyhledávání v knihovně chunků) u `generate-email`. */
const EMAIL_BUILDER_RAG_KEY = 'vb-email-rag-enabled';
const EMAIL_TEST_TO_STORAGE_KEY = 'vb-email-test-recipient';
const EMAIL_TEST_RECIPIENTS = [
  'vitekskop@gmail.com',
  'frantisek@vividbooks.com',
  'gabriela@vividbooks.com',
  'dan@vividbooks.com',
] as const;

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
  /** ISO čas plánovaného odeslání (uloží se s draftem; Mailchimp push zatím neplánuje). */
  scheduledSendAt?: string | null;
  createdAt: string;
  updatedAt: string;
  chatHistory?: ChatMsg[];
  builderMode?: EmailBuilderMode;
  editorVersion?: number;
  lastSelectedBlockType?: EmailBlockType | null;
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
  subject: '', previewText: '', headline: '', bodyHtml: normalizeEmailBodyHtml(''),
  ctaText: 'Vyzkoušejte zdarma', ctaUrl: 'https://www.vividbooks.com/vyzkousejte',
  previewOuterBg: DEFAULT_PREVIEW_OUTER_BG,
  previewColumnBg: DEFAULT_PREVIEW_COLUMN_BG,
  audience: 'newsletter', status: 'draft',
  builderMode: 'block',
  editorVersion: 2,
  lastSelectedBlockType: null,
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

interface BlockInspectorState {
  id: string;
  type: EmailBlockType;
  label: string;
  background: string;
  padding: string;
  textAlign: string;
  ctaText: string;
  ctaUrl: string;
  imageSrc: string;
}

function normalizeDraftForBuilder(draft: EmailDraft): EmailDraft {
  const legacy = draft as EmailDraft & { previewIslandLayout?: boolean };
  const { previewIslandLayout: _legacyIsland, ...rest } = legacy;
  return {
    ...rest,
    bodyHtml: normalizeEmailBodyHtml(draft.bodyHtml || ''),
    builderMode: 'block',
    editorVersion: 2,
    lastSelectedBlockType: draft.lastSelectedBlockType ?? null,
  };
}

/** Snapshot bez časových razítek / Mailchimp metadat — porovnání „co je uloženo“ vs. rozpracovaný stav. */
function emailDraftContentFingerprint(d: EmailDraft, chatHistory: ChatMsg[]): string {
  const base = normalizeDraftForBuilder({ ...d, chatHistory });
  return JSON.stringify({
    id: base.id,
    subject: base.subject,
    previewText: base.previewText,
    headline: base.headline,
    bodyHtml: base.bodyHtml,
    ctaText: base.ctaText,
    ctaUrl: base.ctaUrl,
    previewOuterBg: base.previewOuterBg,
    previewColumnBg: base.previewColumnBg,
    audience: base.audience,
    scheduledSendAt: base.scheduledSendAt ?? null,
    status: base.status,
    chatHistory: base.chatHistory,
    builderMode: base.builderMode,
    editorVersion: base.editorVersion,
    lastSelectedBlockType: base.lastSelectedBlockType,
  });
}

function normalizeBodyForBuilder(html: string): string {
  return normalizeEmailBodyHtml(html || '');
}

function createBlockInspectorState(el: HTMLElement): BlockInspectorState {
  const link = extractFirstLink(el);
  const image = extractFirstImage(el);
  const type = inferEmailBlockType(el);
  const skipLinkImageInspector = type === 'product-collage' || type === 'webinar';
  return {
    id: el.getAttribute('data-vb-block-id') || '',
    type,
    label: getEmailBlockLabel(type),
    background: readElementBackground(el),
    padding: readElementPadding(el),
    textAlign: el.style.textAlign || '',
    ctaText: skipLinkImageInspector ? '' : (link?.textContent || '').trim(),
    ctaUrl: skipLinkImageInspector ? '' : (link?.getAttribute('href') || ''),
    imageSrc: skipLinkImageInspector ? '' : (image?.getAttribute('src') || ''),
  };
}

function readSectionFillForSelectedBlock(
  doc: Document | null | undefined,
  blockId: string | null,
): EmailSectionFill | null {
  if (!doc?.body || !blockId) return null;
  const root = getEmailDndRoot(doc);
  const el = doc.querySelector(`[data-vb-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null;
  if (!el || !root.contains(el)) return null;
  const sec =
    el.getAttribute('data-vb-block') === 'section'
      ? el
      : (el.closest('[data-vb-block="section"]') as HTMLElement | null);
  if (!sec || !root.contains(sec)) return null;
  return sec.getAttribute('data-vb-section-fill') === 'plain' ? 'plain' : 'card';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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

/** Čistý text všech bloků před daným top-level blokem (pro CTA / AI vložení „nad“ blok). */
function getPlainTextBeforeBlockId(doc: Document | null | undefined, blockId: string | null): string {
  if (!doc?.body || !blockId) return '';
  const el = doc.querySelector(`[data-vb-block-id="${CSS.escape(blockId)}"]`);
  if (!el || !doc.body.contains(el)) {
    const t = doc.body.innerText || '';
    return t.replace(/\s+/g, ' ').trim().slice(-6000);
  }
  try {
    const r = doc.createRange();
    r.selectNodeContents(doc.body);
    r.setEndBefore(el);
    const wrap = doc.createElement('div');
    wrap.appendChild(r.cloneContents());
    const text = (wrap.innerText || '').replace(/\s+/g, ' ').trim();
    return text.slice(-6000);
  } catch {
    return (doc.body.innerText || '').replace(/\s+/g, ' ').trim().slice(-6000);
  }
}

function getBlockOuterHtmlForAiByBlockId(doc: Document | null | undefined, blockId: string | null): string {
  if (!doc?.body || !blockId) return '';
  const el = doc.querySelector(`[data-vb-block-id="${CSS.escape(blockId)}"]`);
  if (!el || !doc.body.contains(el)) return '';
  let html = (el as HTMLElement).outerHTML;
  if (html.length > 3500) html = `${html.slice(0, 3500)}…`;
  return html;
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
 * Barvy: `outerBackground` = plátno kolem sloupce; `cardBackground` = výplň karet uvnitř skupin s režimem „karta“.
 */
function buildEmailSrcDoc(
  bodyInnerHtml: string,
  cardBackground = '#ffffff',
  imageEditMode = false,
  options?: { outerBackground?: string },
): string {
  const inner = bodyInnerHtml || '<p style="margin:0;color:#999;">Klikněte a pište…</p>';
  const card =
    normalizeHexColor(cardBackground, DEFAULT_PREVIEW_COLUMN_BG).replace(/[<>"']+/g, '').slice(0, 32) ||
    '#ffffff';
  const outer =
    normalizeHexColor(options?.outerBackground, DEFAULT_PREVIEW_OUTER_BG).replace(/[<>"']+/g, '').slice(0, 32) ||
    '#f3f4f6';
  const htmlClass = ' class="vb-island-layout"';
  const fontLinks = imageEditMode
    ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">'
    : '';
  /** V režimu úprav necháme změny písma z lišty (Mailchimp styl); v náhledu jen ke čtení držíme jednotný Arial. */
  const fontLockCss = imageEditMode
    ? ''
    : 'body *{font-family:Arial,Helvetica,sans-serif !important;}';
  const imgEditCss = imageEditMode
    ? `body.vb-img-edit img{cursor:grab;transition:outline .12s ease}body.vb-img-edit img:hover{outline:2px solid rgba(124,58,237,0.45);outline-offset:2px}
body.vb-img-edit .vb-email-root [data-vb-block="section"]>[data-vb-block-id]{cursor:grab}
body.vb-img-edit .vb-email-root [data-vb-block="section"]>[data-vb-block-id]:hover{outline:1px dashed rgba(124,58,237,0.35);outline-offset:2px}
body.vb-img-edit .vb-email-root>[data-vb-block="section"]{cursor:grab}
body.vb-img-edit .vb-email-root>[data-vb-block="section"]:hover{outline:1px dashed rgba(124,58,237,0.25);outline-offset:2px}
body.vb-img-edit .vb-dnd-dragging{opacity:0.55!important;outline:2px solid #7C3AED!important}
body .vb-email-root [data-vb-block-id]{position:relative}
body .vb-email-root [data-vb-block-id].vb-block-selected{outline:1px solid rgba(0,17,97,0.14)!important;outline-offset:2px}`
    : '';
  const bodyClass = imageEditMode ? ' class="vb-img-edit"' : '';
  const previewLayoutCss = `
:root{--vb-preview-outer:${outer};--vb-preview-card:${card};}
html,body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
html{font-family:Arial,Helvetica,sans-serif;background:var(--vb-preview-outer);color-scheme:light;}
body{font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333;background:var(--vb-preview-outer);color-scheme:light;-webkit-forced-color-adjust:none;forced-color-adjust:none;}
html.vb-island-layout .vb-email-root{background:transparent!important;min-height:100%;}
/* Bloky uvnitř skupiny — sjednocený vnitřní padding (užší okraje = širší text) */
.vb-email-root [data-vb-block="section"]>[data-vb-block-id]:not([data-vb-block="divider"]):not([data-vb-block="flow-break"]){
  box-sizing:border-box;
  padding:18px 14px!important;
}
.vb-email-root [data-vb-block="section"]>[data-vb-block="divider"]{
  box-sizing:border-box;
  padding:10px 14px!important;
}
.vb-email-root [data-vb-block="section"]>[data-vb-block="flow-break"]{
  box-sizing:border-box;
  padding:0!important;
  margin:0!important;
}
.vb-email-root [data-vb-block="section"]>[data-vb-block="gap-content"]{
  box-sizing:border-box;
  padding:12px 14px!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]{
  background:var(--vb-preview-card)!important;
  border-radius:16px;
  box-shadow:0 2px 12px rgba(0,0,0,0.06);
  border:1px solid rgba(0,17,97,0.06);
  margin-bottom:32px!important;
  overflow:hidden;
  box-sizing:border-box;
  padding-left:12px!important;
  padding-right:12px!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block-id]{
  background:transparent!important;
  box-shadow:none!important;
  border:none!important;
  border-radius:0!important;
  margin-bottom:0!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block-id]:not(:last-child){
  border-bottom:1px solid rgba(0,17,97,0.06);
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="plain"]{
  background:transparent!important;
  box-shadow:none!important;
  border:none!important;
  border-radius:0!important;
  margin-bottom:32px!important;
  padding:0!important;
  overflow:visible;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="plain"]>[data-vb-block-id]{
  background:transparent!important;
  box-shadow:none!important;
  border:none!important;
  border-radius:0!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"]:last-child{margin-bottom:0!important;}
html.vb-island-layout .vb-email-root [data-vb-block="section"]>[data-vb-block="flow-break"]{
  background:transparent!important;
  box-shadow:none!important;
  border:none!important;
  border-radius:0!important;
  height:28px!important;
  min-height:28px!important;
  max-height:28px!important;
  padding:0!important;
  margin:0!important;
  overflow:hidden;
}
`;
  return `<!DOCTYPE html><html${htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">${fontLinks}<style>
${previewLayoutCss}
${fontLockCss}
pre,code,kbd,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace !important;}
a{color:#7C3AED;}
img{max-width:100%;height:auto;}
${imgEditCss}
@media only screen and (max-width:600px){
  body{font-size:17px!important;line-height:1.65!important;}
  body p:not(:is([data-email-webinar="true"] *)),
  body li:not(:is([data-email-webinar="true"] *)){font-size:17px!important;line-height:1.65!important;}
  body h1:not(:is([data-email-webinar="true"] *)){font-size:26px!important;line-height:1.2!important;}
  body h2:not(:is([data-email-webinar="true"] *)){font-size:22px!important;line-height:1.25!important;}
  body h3:not(:is([data-email-webinar="true"] *)){font-size:19px!important;}
  a.vb-preview-cta{font-size:17px!important;padding:16px 28px!important;line-height:1.2!important;}
}
</style></head><body${bodyClass}>${inner}</body></html>`;
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

function findTopLevelEmailBlock(start: Element | null, doc: Document): HTMLElement | null {
  if (!start) return null;
  const root = getEmailDndRoot(doc);
  const hit = start.nodeType === Node.TEXT_NODE ? start.parentElement : (start as Element);
  if (!hit || !root.contains(hit)) return null;
  const el = hit.closest?.('[data-vb-block-id]') as HTMLElement | null;
  if (!el || !root.contains(el)) return null;
  return el;
}

const BLOCK_PRESET_ICON: Record<EmailBlockType, React.ComponentType<{ className?: string }>> = {
  text: AlignLeft,
  highlight: Sparkles,
  image: ImageIcon,
  button: RectangleHorizontal,
  divider: Minus,
  'flow-break': BetweenVerticalStart,
  section: SquareStack,
  'gap-content': AlignCenter,
  'columns-2': Columns2,
  'columns-3': Columns3,
  hero: PanelTop,
  'product-collage': ShoppingBag,
  webinar: Video,
  html: Code,
};

function BlockPresetIcon({ type, className }: { type: EmailBlockType; className?: string }) {
  const I = BLOCK_PRESET_ICON[type] ?? LayoutTemplate;
  return <I className={className} />;
}

const RICH_TEXT_FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Tahoma', 'DM Sans'] as const;
const RICH_TEXT_SIZES = ['12', '14', '16', '18', '20', '24'] as const;

function wrapSelectionInStyledSpan(doc: Document, styleKey: string, styleValue: string) {
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;
  const span = doc.createElement('span');
  span.setAttribute('style', `${styleKey}: ${styleValue}`);
  try {
    range.surroundContents(span);
  } catch {
    try {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    } catch { /* ignore */ }
  }
  sel.removeAllRanges();
  const nr = doc.createRange();
  nr.selectNodeContents(span);
  nr.collapse(false);
  sel.addRange(nr);
}

/** Horní lišta formátování (Mailchimp styl) — příkazy vůči `designMode` dokumentu v iframe. */
function EmailRichTextToolbar({
  iframeRef,
  refreshEpoch,
  bumpToolbar,
  embeddedInHeader,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Zvýšit po změně výběru v iframe, aby se přepočet stavu tlačítek. */
  refreshEpoch: number;
  bumpToolbar: () => void;
  /** Kompaktní jednořádková lišta v horním panelu (scroll v rodiči). */
  embeddedInHeader?: boolean;
}) {
  void refreshEpoch;
  const doc = iframeRef.current?.contentDocument;
  const compact = !!embeddedInHeader;
  const run = (cmd: string, val?: string) => {
    const fr = iframeRef.current;
    const d = fr?.contentDocument;
    const w = fr?.contentWindow;
    if (!fr || !d || !w || d.designMode !== 'on') return;
    w.focus();
    try {
      d.execCommand('styleWithCSS', false, 'true');
    } catch { /* ignore */ }
    try {
      if (val !== undefined) d.execCommand(cmd, false, val);
      else d.execCommand(cmd, false);
    } catch { /* ignore */ }
    try {
      d.body.dispatchEvent(new InputEvent('input', { bubbles: true }));
    } catch {
      d.body.dispatchEvent(new Event('input', { bubbles: true }));
    }
    bumpToolbar();
  };

  let blockValue = 'p';
  try {
    const raw = (doc?.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '');
    if (['p', 'h1', 'h2', 'h3', 'h4'].includes(raw)) blockValue = raw;
  } catch { /* ignore */ }

  let fontValue = 'Arial';
  try {
    const fnRaw = (doc?.queryCommandValue('fontName') || 'Arial').replace(/^["']|["']$/g, '');
    const match = RICH_TEXT_FONTS.find(f => f.toLowerCase() === fnRaw.toLowerCase());
    fontValue = match ?? 'Arial';
  } catch { /* ignore */ }

  const cmdState = (name: string): boolean => {
    try {
      return !!doc?.queryCommandState(name);
    } catch {
      return false;
    }
  };

  /** Kompaktní lišta: základ +10 %, pak ještě +5 % kvůli čitelnosti a klikání. */
  const btnSz = compact ? 'h-[33px] w-[33px] min-h-[33px] min-w-[33px]' : 'h-8 w-8';
  const iconSz = compact ? 'h-[14px] w-[14px]' : 'h-3.5 w-3.5';
  const tbBtn = (active: boolean) =>
    `flex ${btnSz} shrink-0 items-center justify-center rounded-md border text-[#001161]/70 transition-colors cursor-pointer ${
      active ? 'border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#7C3AED]' : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
    }`;

  const selCls = compact
    ? 'h-[33px] min-h-[33px] rounded-md border border-gray-200 bg-white px-2.5 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 shrink-0 max-w-[124px]'
    : 'h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 shrink-0 max-w-[140px]';

  return (
    <div
      className={
        compact
          ? 'flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-gray-200/80 bg-[#f3f4f6] px-2 py-1.5'
          : 'mb-2 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-[#f3f4f6] px-2 py-1.5 shadow-sm'
      }
      style={F}
      onMouseDown={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest('select') || el.closest('input[type="color"]')) return;
        e.preventDefault();
      }}
    >
      <select
        className={selCls}
        value={blockValue}
        title="Formát odstavce"
        aria-label="Formát odstavce"
        onChange={e => run('formatBlock', e.target.value)}
      >
        <option value="p">Odstavec</option>
        <option value="h1">Nadpis 1</option>
        <option value="h2">Nadpis 2</option>
        <option value="h3">Nadpis 3</option>
        <option value="h4">Nadpis 4</option>
      </select>
      <select
        className={selCls}
        value={fontValue}
        title="Písmo"
        aria-label="Písmo"
        onChange={e => run('fontName', e.target.value)}
      >
        {RICH_TEXT_FONTS.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <select
        className={`${selCls} ${compact ? 'max-w-[61px]' : 'max-w-[72px]'}`}
        title="Velikost (px)"
        aria-label="Velikost textu"
        defaultValue=""
        onChange={e => {
          const px = e.target.value;
          if (!px || !doc) return;
          const fr = iframeRef.current;
          const d = fr?.contentDocument;
          const w = fr?.contentWindow;
          if (!d || !w || d.designMode !== 'on') return;
          w.focus();
          wrapSelectionInStyledSpan(d, 'font-size', `${px}px`);
          try {
            d.body.dispatchEvent(new InputEvent('input', { bubbles: true }));
          } catch {
            d.body.dispatchEvent(new Event('input', { bubbles: true }));
          }
          bumpToolbar();
          e.target.selectedIndex = 0;
        }}
      >
        <option value="" disabled>
          px
        </option>
        {RICH_TEXT_SIZES.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <label
        className={`relative flex ${btnSz} cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50`}
        title="Barva textu"
      >
        <span className={`${compact ? 'text-[11px]' : 'text-[10px]'} font-bold underline decoration-2 underline-offset-2 text-[#001161]`}>A</span>
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Barva textu"
          onChange={e => run('foreColor', e.target.value)}
        />
      </label>
      <label
        className={`relative flex ${btnSz} cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50`}
        title="Zvýraznění pozadím"
      >
        <span className={`rounded-sm border border-gray-300 bg-amber-100 px-0.5 ${compact ? 'text-[10px]' : 'text-[9px]'} font-bold text-[#001161]`}>A</span>
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Barva zvýraznění"
          defaultValue="#fff9c4"
          onChange={e => {
            try {
              run('hiliteColor', e.target.value);
            } catch {
              run('backColor', e.target.value);
            }
          }}
        />
      </label>
      <div className={`mx-0.5 ${compact ? 'h-[19px]' : 'h-5'} w-px shrink-0 bg-gray-300`} aria-hidden />
      <button type="button" className={tbBtn(cmdState('bold'))} title="Tučné" onClick={() => run('bold')}>
        <Bold className={iconSz} strokeWidth={2.2} />
      </button>
      <button type="button" className={tbBtn(cmdState('italic'))} title="Kurzíva" onClick={() => run('italic')}>
        <Italic className={iconSz} strokeWidth={2.2} />
      </button>
      <button type="button" className={tbBtn(cmdState('underline'))} title="Podtržení" onClick={() => run('underline')}>
        <Underline className={iconSz} strokeWidth={2.2} />
      </button>
      <button type="button" className={tbBtn(cmdState('strikeThrough'))} title="Přeškrtnutí" onClick={() => run('strikeThrough')}>
        <Strikethrough className={iconSz} strokeWidth={2.2} />
      </button>
      <div className={`mx-0.5 ${compact ? 'h-[19px]' : 'h-5'} w-px shrink-0 bg-gray-300`} aria-hidden />
      <button
        type="button"
        className={tbBtn(cmdState('justifyLeft'))}
        title="Zarovnání vlevo"
        onClick={() => run('justifyLeft')}
      >
        <AlignLeft className={iconSz} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className={tbBtn(cmdState('justifyCenter'))}
        title="Na střed"
        onClick={() => run('justifyCenter')}
      >
        <AlignCenter className={iconSz} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className={tbBtn(cmdState('justifyRight'))}
        title="Vpravo"
        onClick={() => run('justifyRight')}
      >
        <AlignRight className={iconSz} strokeWidth={2.2} />
      </button>
      <div className={`mx-0.5 ${compact ? 'h-[19px]' : 'h-5'} w-px shrink-0 bg-gray-300`} aria-hidden />
      <button type="button" className={tbBtn(cmdState('insertUnorderedList'))} title="Odrážky" onClick={() => run('insertUnorderedList')}>
        <List className={iconSz} strokeWidth={2.2} />
      </button>
      <button type="button" className={tbBtn(cmdState('insertOrderedList'))} title="Číslování" onClick={() => run('insertOrderedList')}>
        <ListOrdered className={iconSz} strokeWidth={2.2} />
      </button>
      <div className={`mx-0.5 ${compact ? 'h-[19px]' : 'h-5'} w-px shrink-0 bg-gray-300`} aria-hidden />
      <button
        type="button"
        className={tbBtn(false)}
        title="Odkaz"
        onClick={() => {
          const fr = iframeRef.current;
          const d = fr?.contentDocument;
          const w = fr?.contentWindow;
          if (!d || !w || d.designMode !== 'on') return;
          const url = window.prompt('URL odkazu', 'https://');
          if (!url?.trim()) return;
          w.focus();
          try {
            d.execCommand('createLink', false, url.trim());
          } catch { /* ignore */ }
          try {
            d.body.dispatchEvent(new InputEvent('input', { bubbles: true }));
          } catch {
            d.body.dispatchEvent(new Event('input', { bubbles: true }));
          }
          bumpToolbar();
        }}
      >
        <Link2 className={iconSz} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function EmailIframeEditor({
  draftId,
  bodyEditEpoch,
  bodyHtml,
  columnBackground,
  outerBackground,
  builderMode,
  selectedBlockId,
  onBodyChange,
  onImageClick,
  onBlockSelect,
  /** Nad iframe je panel předmět/preview (pak spodní rohy iframe zaoblené jinak). */
  hasMailboxStackAbove,
  readOnlyBody,
  iframeRef: parentIframeRef,
  onTextSelect,
  hoverBlockRef,
  onHoverBlockChrome,
  onIframeLeave,
  onIframeEnter,
  onRichTextActivity,
}: {
  draftId: string;
  bodyEditEpoch: number;
  bodyHtml: string;
  /** Pozadí dokumentu uvnitř náhledového iframe (sloupec / výplň karet). */
  columnBackground: string;
  /** Šedé (nebo jiné) plátno kolem sloupce v náhledu. */
  outerBackground: string;
  builderMode: EmailBuilderMode;
  selectedBlockId: string | null;
  /** Vždy zapisuj pod `draftId` vlastníka iframe — při přepnutí draftu cleanup nesmí použít už nový `selected`. */
  onBodyChange: (draftId: string, html: string) => void;
  onImageClick: (src: string) => void;
  onBlockSelect?: (block: BlockInspectorState | null) => void;
  hasMailboxStackAbove: boolean;
  /** true = režim „Náhled mailu“ — tělo nejde přepisovat, odkazy jdou klikat. */
  readOnlyBody: boolean;
  iframeRef?: React.MutableRefObject<HTMLIFrameElement | null>;
  onTextSelect?: (text: string | null) => void;
  hoverBlockRef?: React.MutableRefObject<HTMLElement | null>;
  /** Obdélník bloku ve viewportu pro plovoucí akční lištu (Mailchimp styl). */
  onHoverBlockChrome?: (
    payload: { top: number; left: number; width: number; height: number; blockId: string } | null,
  ) => void;
  /** Myš opustila iframe — rodič může lištu schovat se zpožděním (aby šlo kliknout na +). */
  onIframeLeave?: () => void;
  onIframeEnter?: () => void;
  /** Změna výběru / vstupu v těle — pro přepočet horní formátovací lišty. */
  onRichTextActivity?: () => void;
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
  const onBlockSelectRef = useRef(onBlockSelect);
  onBlockSelectRef.current = onBlockSelect;
  const onTextSelectRef = useRef(onTextSelect);
  onTextSelectRef.current = onTextSelect;
  const onHoverBlockChromeRef = useRef(onHoverBlockChrome);
  onHoverBlockChromeRef.current = onHoverBlockChrome;
  const onIframeLeaveRef = useRef(onIframeLeave);
  onIframeLeaveRef.current = onIframeLeave;
  const onIframeEnterRef = useRef(onIframeEnter);
  onIframeEnterRef.current = onIframeEnter;
  const onRichTextActivityRef = useRef(onRichTextActivity);
  onRichTextActivityRef.current = onRichTextActivity;

  const columnBgRef = useRef(columnBackground);
  columnBgRef.current = columnBackground;
  const outerBgRef = useRef(outerBackground);
  outerBgRef.current = outerBackground;

  const selectedBlockIdRef = useRef(selectedBlockId);
  selectedBlockIdRef.current = selectedBlockId;

  const builderModeRef = useRef(builderMode);
  builderModeRef.current = builderMode;

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
    doc.write(
      buildEmailSrcDoc(processed, columnBgRef.current, !readOnlyBody, {
        outerBackground: outerBgRef.current,
      }),
    );
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
        const block = !el
          ? null
          : builderModeRef.current === 'block'
            ? findTopLevelEmailBlock(el, d)
            : findEditableBlock(el, d.body);
        if (hoverBlockRef) hoverBlockRef.current = block;
        const chromeCb = onHoverBlockChromeRef.current;
        if (!block) {
          chromeCb?.(null);
          return;
        }
        const r = block.getBoundingClientRect();
        const ir = fr.getBoundingClientRect();
        if (chromeCb) {
          if (builderModeRef.current === 'block') {
            const bid = block.getAttribute('data-vb-block-id');
            if (bid) {
              chromeCb({
                top: ir.top + r.top,
                left: ir.left + r.left,
                width: r.width,
                height: r.height,
                blockId: bid,
              });
            } else chromeCb(null);
          } else chromeCb(null);
        }
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

    const dndSiblings = (parent: HTMLElement): HTMLElement[] =>
      [...parent.children].filter(
        (n): n is HTMLElement =>
          n.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test(n.tagName),
      );

    const syncSelectedBlockUi = () => {
      rootDnd.querySelectorAll('.vb-block-selected').forEach((n) => n.classList.remove('vb-block-selected'));
      const id = selectedBlockIdRef.current;
      if (builderModeRef.current !== 'block' || !id) return;
      const mark = rootDnd.querySelector(`[data-vb-block-id="${CSS.escape(id)}"]`);
      mark?.classList.add('vb-block-selected');
    };

    const applyDraggableAttrs = () => {
      rootDnd.querySelectorAll('[data-vb-block-id]').forEach((raw) => {
        const el = raw as HTMLElement;
        const p = el.parentElement;
        if (p === rootDnd || p?.getAttribute('data-vb-block') === 'section') {
          el.setAttribute('draggable', 'true');
        } else {
          el.removeAttribute('draggable');
        }
      });
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
      let n: HTMLElement | null = el.closest('[data-vb-block-id]');
      while (n && rootDnd.contains(n)) {
        const p = n.parentElement;
        if (!p) return null;
        if (p === rootDnd) return n;
        if (p.getAttribute('data-vb-block') === 'section') return n;
        n = p.closest('[data-vb-block-id]');
      }
      return null;
    };

    const findTopLevelBlock = (target: EventTarget | null): HTMLElement | null => {
      if (!target || typeof (target as Node).nodeType !== 'number') return null;
      const raw = target as Node;
      const el = raw.nodeType === Node.TEXT_NODE ? (raw as Text).parentElement : (raw as HTMLElement);
      if (!el || !rootDnd.contains(el)) return null;
      return el.closest('[data-vb-block-id]') as HTMLElement | null;
    };

    const findDropInsertBeforeAtYIn = (clientY: number, skipNode: HTMLElement | null, parent: HTMLElement): Element | null => {
      for (const child of dndSiblings(parent)) {
        if (skipNode && child === skipNode) continue;
        const r = child.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) return child;
      }
      return null;
    };

    const findDropInsertBefore = (clientY: number, parent: HTMLElement): Element | null =>
      findDropInsertBeforeAtYIn(clientY, draggedBlock, parent);

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
      const dt = e.dataTransfer;
      if (dt && [...dt.types].includes(VB_EMAIL_LIBRARY_DRAG_TYPE)) {
        e.preventDefault();
        dt.dropEffect = 'copy';
        return;
      }
      if (!draggedBlock || !rootDnd.contains(draggedBlock)) return;
      e.preventDefault();
      if (dt) dt.dropEffect = 'move';
    };

    const onDropDnd = (e: DragEvent) => {
      e.preventDefault();
      let libRaw = e.dataTransfer?.getData(VB_EMAIL_LIBRARY_DRAG_TYPE) || '';
      if (!libRaw) {
        const plain = e.dataTransfer?.getData('text/plain') || '';
        const m = plain.match(/^vb-email-block:(.+)$/);
        if (m) libRaw = m[1].trim();
      }
      if (libRaw && EMAIL_PRESET_TYPE_SET.has(libRaw as EmailBlockType)) {
        const presetType = libRaw as EmailBlockType;
        const html = buildEmailBlockHtml(presetType).trim();
        const tmp = d.createElement('div');
        tmp.innerHTML = html;
        let newEl = tmp.firstElementChild as HTMLElement | null;
        if (newEl) {
          if (presetType === 'section') {
            const insertBeforeRoot = findDropInsertBeforeAtYIn(e.clientY, null, rootDnd);
            try {
              if (insertBeforeRoot) rootDnd.insertBefore(newEl, insertBeforeRoot);
              else rootDnd.appendChild(newEl);
            } catch {
              /* ignore */
            }
          } else {
            const hit = d.elementFromPoint(e.clientX, e.clientY);
            const sec = hit?.closest?.('[data-vb-block="section"]') as HTMLElement | null;
            if (sec && rootDnd.contains(sec)) {
              const insertBeforeInner = findDropInsertBeforeAtYIn(e.clientY, null, sec);
              try {
                if (insertBeforeInner) sec.insertBefore(newEl, insertBeforeInner);
                else sec.appendChild(newEl);
              } catch {
                /* ignore */
              }
            } else {
              const wrapHtml = wrapRootBlockInSection(tmp.innerHTML);
              const w = d.createElement('div');
              w.innerHTML = wrapHtml;
              newEl = w.firstElementChild as HTMLElement | null;
              if (newEl) {
                const insertBeforeRoot = findDropInsertBeforeAtYIn(e.clientY, null, rootDnd);
                try {
                  if (insertBeforeRoot) rootDnd.insertBefore(newEl, insertBeforeRoot);
                  else rootDnd.appendChild(newEl);
                } catch {
                  /* ignore */
                }
              }
            }
          }
          if (newEl) {
            const st = createBlockInspectorState(newEl);
            selectedBlockIdRef.current = st.id;
            onBlockSelectRef.current?.(st);
            syncSelectedBlockUi();
          }
        }
        applyDraggableAttrs();
        schedule();
        requestAnimationFrame(syncHeight);
        return;
      }
      if (!draggedBlock || !rootDnd.contains(draggedBlock)) return;
      const y = e.clientY;
      const hitMove = d.elementFromPoint(e.clientX, e.clientY);
      const targetSectionUnder = hitMove?.closest?.('[data-vb-block="section"]') as HTMLElement | null;
      const dragParent = draggedBlock.parentElement;
      let destParent: HTMLElement = rootDnd;
      if (dragParent === rootDnd) {
        destParent = rootDnd;
      } else if (dragParent?.getAttribute('data-vb-block') === 'section') {
        destParent =
          targetSectionUnder && rootDnd.contains(targetSectionUnder) && targetSectionUnder !== draggedBlock
            ? targetSectionUnder
            : dragParent;
      }
      const insertBefore = findDropInsertBefore(y, destParent);
      if (insertBefore === draggedBlock) {
        onDragEndDnd();
        return;
      }
      if (insertBefore && draggedBlock.contains(insertBefore)) {
        onDragEndDnd();
        return;
      }
      try {
        if (insertBefore) destParent.insertBefore(draggedBlock, insertBefore);
        else destParent.appendChild(draggedBlock);
      } catch {
        /* ignore */
      }
      applyDraggableAttrs();
      schedule();
      requestAnimationFrame(syncHeight);
      onDragEndDnd();
    };

    const onInput = () => {
      onRichTextActivityRef.current?.();
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

    const onBlockClick = (e: Event) => {
      if (builderModeRef.current !== 'block' || readOnlyBody) return;
      const block = findTopLevelBlock(e.target);
      if (!block) return;
      const next = createBlockInspectorState(block);
      selectedBlockIdRef.current = next.id;
      onBlockSelectRef.current?.(next);
      syncSelectedBlockUi();
    };

    if (!readOnlyBody) {
      applyDraggableAttrs();
      syncSelectedBlockUi();
      d.body.addEventListener('input', onInput);
      d.addEventListener('click', onImgClick, true);
      d.addEventListener('click', onBlockClick, true);
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
        onRichTextActivityRef.current?.();
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
      onHoverBlockChromeRef.current?.(null);
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
        d.removeEventListener('click', onBlockClick, true);
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
    const root = getEmailDndRoot(d);
    root.querySelectorAll('.vb-block-selected').forEach((n) => n.classList.remove('vb-block-selected'));
    if (builderMode === 'block' && selectedBlockId) {
      root.querySelector(`[data-vb-block-id="${CSS.escape(selectedBlockId)}"]`)?.classList.add('vb-block-selected');
    }
  }, [selectedBlockId, builderMode, bodyEditEpoch]);

  useEffect(() => {
    const d = innerRef.current?.contentDocument;
    if (!d?.documentElement || !d.body) return;
    const outer = normalizeHexColor(outerBackground, DEFAULT_PREVIEW_OUTER_BG);
    const column = normalizeHexColor(columnBackground, DEFAULT_PREVIEW_COLUMN_BG);
    d.documentElement.classList.add('vb-island-layout');
    d.documentElement.style.setProperty('--vb-preview-outer', outer);
    d.documentElement.style.setProperty('--vb-preview-card', column);
    d.documentElement.style.colorScheme = 'light';
    d.body.style.colorScheme = 'light';
  }, [columnBackground, outerBackground]);

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
        backgroundColor: 'transparent',
        colorScheme: 'light',
      }}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    />
  );
}

export default function EmailBuilder() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const draftParam = searchParams.get('draft');
  const createNewFromRoute = location.pathname.startsWith('/mailing/novy-email');

  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [selected, setSelected] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Krátká nápověda po tichém autosave (bez toastu). */
  const [autoSaveHint, setAutoSaveHint] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [sendingTestMail, setSendingTestMail] = useState(false);
  const [testMailRecipient, setTestMailRecipient] = useState<string>(EMAIL_TEST_RECIPIENTS[0]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolPanelMode, setToolPanelMode] = useState<'ai' | 'block' | 'settings'>('ai');

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
  const [richToolbarEpoch, setRichToolbarEpoch] = useState(0);
  const bumpRichToolbar = useCallback(() => setRichToolbarEpoch(e => e + 1), []);

  const canvasRef = useRef<HTMLDivElement>(null);
  /** Aktuální draft — aby dokončený async `loadDrafts` nepřepsal výběr uživatele (stale `selected` v closure). */
  const selectedIdRef = useRef<string | null>(null);
  const autoCreateDraftRouteRef = useRef<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeHoverBlockRef = useRef<HTMLElement | null>(null);
  /** Blok pod kurzorem (`data-vb-block-id`) — pro vložení z postranní lišty / kotvy za blok. */
  const insertHoverBlockIdRef = useRef<string | null>(null);
  const pendingInsertAnchorRef = useRef<string | null>(null);
  const insertLineHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Otevřená nabídka „+“ u postranní lišty bloku. */
  const [blockChromeAddMenuOpen, setBlockChromeAddMenuOpen] = useState(false);
  /** Po zkopírování bloku — invalidace náhledu + menu (schránka v `sessionStorage`). */
  const [emailBlockClipboardTick, setEmailBlockClipboardTick] = useState(0);
  const pendingInsertBeforeBlockIdRef = useRef<string | null>(null);
  const ctaInsertBeforeBlockIdRef = useRef<string | null>(null);
  /** Postranní knihovna: první řádky jako v Mailchimpu, zbytek po „Zobrazit vše“. */
  const [blockLibraryExpanded, setBlockLibraryExpanded] = useState(false);
  /** Plovoucí akce u bloku (viewport souřadnice). */
  const [blockActionChrome, setBlockActionChrome] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    blockId: string;
  } | null>(null);
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
  const [metaExpanded, setMetaExpanded] = useState(false);
  /** true = panel „jako ve schránce“ (předmět, preview, metadata); false = jen hezké okno s tělem (úpravy bez horního bloku). */
  const [showInboxChrome, setShowInboxChrome] = useState(false);
  /** ID kotvy u + — další AI odpověď má vložit obsah hned za tento blok v těle. */
  const [aiInsertAfterAnchorId, setAiInsertAfterAnchorId] = useState<string | null>(null);
  /** Blok (`data-vb-block-id`), před který má AI vložit nový obsah (tlačítko + u lišty). */
  const [aiInsertBeforeBlockId, setAiInsertBeforeBlockId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockInspectorState | null>(null);

  const [selectedCanvasText, setSelectedCanvasText] = useState('');
  const [capturedSelection, setCapturedSelection] = useState<string | null>(null);

  /** Lokální historie úprav aktuálního draftu (undo / redo). */
  const [historyPast, setHistoryPast] = useState<EmailDraft[]>([]);
  const [historyFuture, setHistoryFuture] = useState<EmailDraft[]>([]);
  const isApplyingHistoryRef = useRef(false);
  const selectedRef = useRef<EmailDraft | null>(null);
  const chatMsgsRef = useRef<ChatMsg[]>([]);
  const savingRef = useRef(false);
  const loadingRef = useRef(true);
  const generatingRef = useRef(false);
  /** Poslední úspěšně persistovaný obsah (nebo baseline po `selectDraft`). */
  const lastPersistedFingerprintRef = useRef('');
  const iframeHistoryBurstRef = useRef(false);
  const iframeHistoryBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Debounce historie při úpravě bodyHtml přes `updateField` (např. textarea Zdroj HTML). */
  const bodyFieldHistoryBurstRef = useRef(false);
  const bodyFieldHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBuilderMode: EmailBuilderMode = selected?.builderMode === 'html' ? 'html' : 'block';

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    chatMsgsRef.current = chatMsgs;
  }, [chatMsgs]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    generatingRef.current = generating;
  }, [generating]);

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
    try {
      const s = window.localStorage.getItem(EMAIL_TEST_TO_STORAGE_KEY);
      if (s && (EMAIL_TEST_RECIPIENTS as readonly string[]).includes(s)) {
        setTestMailRecipient(s);
      }
    } catch { /* ignore */ }
  }, []);

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
    const normalized = normalizeDraftForBuilder(d);
    selectedIdRef.current = normalized.id;
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
    setSelected(normalized);
    setSelectedBlock(null);
    setChatMsgs(normalized.chatHistory || []);
    setChatInput('');
    setCapturedSelection(null);
    setSelectedCanvasText('');
    try {
      previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
    } catch { /* ignore */ }
    lastPersistedFingerprintRef.current = emailDraftContentFingerprint(
      normalized,
      normalized.chatHistory || [],
    );
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
        const loaded = (data.drafts || []).map((draft: EmailDraft) => normalizeDraftForBuilder(draft)).sort((a: EmailDraft, b: EmailDraft) =>
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

  const saveDraft = async (draft?: EmailDraft, options?: { quiet?: boolean }): Promise<EmailDraft | null> => {
    const d = draft || selected;
    if (!d) return null;
    setSaving(true);
    try {
      /** Po AI odpovědi se volá `saveDraft(updatedDraft)` dřív, než React stihne `setChatMsgs` — musíme uložit `draft.chatHistory`. */
      const historyToSave =
        draft !== undefined && draft.chatHistory !== undefined ? draft.chatHistory : chatMsgs;
      const toSave = normalizeDraftForBuilder({ ...d, chatHistory: historyToSave, updatedAt: new Date().toISOString() });
      const r = await fetch(`${SERVER}/admin/email-drafts`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify(toSave),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      const savedDraft = normalizeDraftForBuilder(data.draft || toSave);
      setDrafts(prev => {
        const idx = prev.findIndex(x => x.id === d.id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = savedDraft;
          return n;
        }
        return [savedDraft, ...prev];
      });
      setSelected(savedDraft);
      lastPersistedFingerprintRef.current = emailDraftContentFingerprint(
        savedDraft,
        savedDraft.chatHistory || [],
      );
      if (!options?.quiet) toast.success('Uloženo');
      return savedDraft;
    } catch (e: unknown) {
      console.error('Save draft error:', e);
      toast.error(`Chyba při ukládání: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  const autoSaveHintHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoSaveHintHideTimerRef.current) clearTimeout(autoSaveHintHideTimerRef.current);
    };
  }, []);

  /** Debounced autosave — tiché uložení; při AI generování neukládáme mezistav. */
  useEffect(() => {
    if (loading || !selected || generating) return;
    const fp = emailDraftContentFingerprint(selected, chatMsgs);
    if (fp === lastPersistedFingerprintRef.current) return;

    const tid = setTimeout(() => {
      void (async () => {
        if (generatingRef.current) return;
        const cur = selectedRef.current;
        const msgs = chatMsgsRef.current;
        if (!cur || loadingRef.current) return;
        const fpNow = emailDraftContentFingerprint(cur, msgs);
        if (fpNow === lastPersistedFingerprintRef.current) return;

        for (let i = 0; i < 40; i++) {
          if (!savingRef.current) break;
          await new Promise<void>(r => {
            setTimeout(r, 150);
          });
        }
        if (savingRef.current) return;

        const saved = await saveDraftRef.current({ ...cur, chatHistory: msgs }, { quiet: true });
        if (saved) {
          if (autoSaveHintHideTimerRef.current) clearTimeout(autoSaveHintHideTimerRef.current);
          setAutoSaveHint(true);
          autoSaveHintHideTimerRef.current = setTimeout(() => {
            autoSaveHintHideTimerRef.current = null;
            setAutoSaveHint(false);
          }, 2200);
        }
      })();
    }, 1600);

    return () => clearTimeout(tid);
  }, [selected, chatMsgs, loading, generating]);

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
        setSelected(next ? normalizeDraftForBuilder(next) : null);
        setSelectedBlock(null);
        setChatMsgs(next?.chatHistory || []);
      }
      toast.success('Smazáno');
    } catch (e: unknown) {
      toast.error(`Chyba: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const createNewDraft = useCallback(() => {
    const now = new Date().toISOString();
    const d: EmailDraft = normalizeDraftForBuilder({
      ...EMPTY_DRAFT, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    });
    setDrafts(prev => [d, ...prev]);
    selectDraft(d);
    toast.success('Nový draft vytvořen');
  }, [selectDraft]);

  useEffect(() => {
    if (!createNewFromRoute || loading || !!draftParam) return;
    const routeKey = `${location.pathname}?${location.search}`;
    if (autoCreateDraftRouteRef.current === routeKey) return;
    autoCreateDraftRouteRef.current = routeKey;
    createNewDraft();
  }, [createNewFromRoute, loading, draftParam, location.pathname, location.search, createNewDraft]);

  const applyHistorySnapshot = useCallback(
    (d: EmailDraft) => {
      isApplyingHistoryRef.current = true;
      const snap = normalizeDraftForBuilder(cloneDraftForHistory(d));
      setSelected(snap);
      setDrafts(prev => prev.map(x => (x.id === snap.id ? snap : x)));
      setSelectedBlock(null);
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
    const nextValue =
      field === 'bodyHtml' && typeof value === 'string'
        ? normalizeBodyForBuilder(value)
        : value;
    if (Object.is(selected[field as keyof EmailDraft], nextValue)) return;
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
    const updated = normalizeDraftForBuilder({ ...selected, [field]: nextValue, updatedAt: new Date().toISOString() });
    setSelected(updated);
    setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
    if (field === 'bodyHtml') {
      setSelectedBlock(null);
    }
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
      const normalizedHtml = normalizeBodyForBuilder(html);
      setDrafts(prev => prev.map(d => (d.id === id ? normalizeDraftForBuilder({ ...d, bodyHtml: normalizedHtml, updatedAt: now }) : d)));
      setSelected(prev => (prev?.id === id ? normalizeDraftForBuilder({ ...prev, bodyHtml: normalizedHtml, updatedAt: now }) : prev));
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
    setAiInsertBeforeBlockId(null);
    ctaInsertBeforeBlockIdRef.current = null;
    pendingInsertBeforeBlockIdRef.current = null;
  }, [clearPendingInsertAnchor]);

  /** Označí blok pod kurzorem pro vložení nového prvku za něj (data-vb-insert). */
  const prepareInsertAnchor = useCallback((): boolean => {
    clearPendingInsertAnchor();
    const doc = previewIframeRef.current?.contentDocument;
    let el = iframeHoverBlockRef.current;
    if ((!el || !doc?.body.contains(el)) && insertHoverBlockIdRef.current && doc?.body) {
      const bid = insertHoverBlockIdRef.current;
      el = doc.querySelector(`[data-vb-block-id="${CSS.escape(bid)}"]`) as HTMLElement | null;
    }
    if (!el || !doc?.body.contains(el)) {
      toast.error(activeBuilderMode === 'block'
        ? 'Najeďte myší na existující blok v náhledu.'
        : 'Najeďte myší na odstavec nebo nadpis v náhledu.');
      return false;
    }
    const id = crypto.randomUUID();
    el.setAttribute('data-vb-insert', id);
    pendingInsertAnchorRef.current = id;
    return true;
  }, [clearPendingInsertAnchor, activeBuilderMode]);

  const insertHtmlAfterAnchorOrAppend = useCallback(
    (html: string) => {
      if (!selected) return;
      const doc = previewIframeRef.current?.contentDocument;
      if (!pendingInsertAnchorRef.current && doc?.body && insertHoverBlockIdRef.current) {
        const bid = insertHoverBlockIdRef.current;
        const blk = doc.querySelector(`[data-vb-block-id="${CSS.escape(bid)}"]`) as HTMLElement | null;
        if (blk && doc.body.contains(blk)) {
          const newId = crypto.randomUUID();
          blk.setAttribute('data-vb-insert', newId);
          pendingInsertAnchorRef.current = newId;
        }
      }
      const id = pendingInsertAnchorRef.current;
      pendingInsertAnchorRef.current = null;
      setAiInsertAfterAnchorId(null);
      const isBlockInsert = /data-vb-block-id=/.test(html) || activeBuilderMode === 'block';
      if (doc?.body) {
        try {
          const root = getEmailDndRoot(doc);
          let insertedEl: HTMLElement | null = null;
          if (id) {
            const anchor = doc.querySelector(`[data-vb-insert="${id}"]`) as HTMLElement | null;
            if (anchor) {
              anchor.removeAttribute('data-vb-insert');
              const tmpAnchor = doc.createElement('div');
              tmpAnchor.innerHTML = html;
              const anchorFrag = tmpAnchor.firstElementChild as HTMLElement | null;
              if (anchorFrag?.getAttribute('data-vb-block') === 'section') {
                const hostSec = anchor.closest('[data-vb-block="section"]') as HTMLElement | null;
                if (hostSec && hostSec.parentElement === root) {
                  hostSec.insertAdjacentElement('afterend', anchorFrag);
                } else {
                  root.appendChild(anchorFrag);
                }
                insertedEl = anchorFrag;
              } else {
                anchor.insertAdjacentHTML('afterend', html);
                insertedEl = anchor.nextElementSibling as HTMLElement | null;
              }
            }
          }
          if (!insertedEl) {
            const tmp = doc.createElement('div');
            tmp.innerHTML = html;
            const maybe = tmp.firstElementChild as HTMLElement | null;
            if (maybe) {
              if (maybe.getAttribute('data-vb-block') === 'section') {
                root.appendChild(maybe);
                insertedEl = maybe;
              } else {
                const sections = [...root.querySelectorAll(':scope > [data-vb-block="section"]')] as HTMLElement[];
                const lastSec = sections[sections.length - 1];
                if (lastSec) {
                  lastSec.appendChild(maybe);
                  insertedEl = maybe;
                } else {
                  root.insertAdjacentHTML('beforeend', wrapRootBlockInSection(html));
                  const sec = root.lastElementChild as HTMLElement | null;
                  insertedEl =
                    (sec?.lastElementChild as HTMLElement | null) || (sec as HTMLElement | null);
                }
              }
            }
          }

          if (insertedEl && isBlockInsert) {
            const topLevel = insertedEl.closest('[data-vb-block-id]') as HTMLElement | null;
            if (topLevel) {
              const next = createBlockInspectorState(topLevel);
              setSelectedBlock(next);
            }
          }

          updateField('bodyHtml', normalizeBodyForBuilder(doc.body.innerHTML));
          bumpBodyEpoch();
          return;
        } catch {
          /* fall through */
        }
      }
      updateField('bodyHtml', (selected.bodyHtml || '') + '\n' + html);
      bumpBodyEpoch();
    },
    [selected, updateField, bumpBodyEpoch, activeBuilderMode],
  );

  const insertHtmlBeforeBlockById = useCallback(
    (blockId: string, html: string) => {
      const currentSelected = selectedRef.current;
      const doc = previewIframeRef.current?.contentDocument;
      if (!currentSelected || !doc?.body) return;
      const escaped = CSS.escape(blockId);
      const block = doc.querySelector(`[data-vb-block-id="${escaped}"]`) as HTMLElement | null;
      const root = getEmailDndRoot(doc);
      if (!block || !root.contains(block)) {
        toast.error('Blok v náhledu už není.');
        return;
      }
      commitHistoryBeforeMutation();
      const tmpBefore = doc.createElement('div');
      tmpBefore.innerHTML = html;
      const beforeFrag = tmpBefore.firstElementChild as HTMLElement | null;
      let insertedEl: HTMLElement | null = null;
      if (beforeFrag?.getAttribute('data-vb-block') === 'section') {
        const hostSec = block.closest('[data-vb-block="section"]') as HTMLElement | null;
        if (hostSec && hostSec.parentElement === root) {
          hostSec.insertAdjacentElement('beforebegin', beforeFrag);
        } else {
          root.appendChild(beforeFrag);
        }
        insertedEl = beforeFrag;
      } else {
        block.insertAdjacentHTML('beforebegin', html);
        insertedEl = block.previousElementSibling as HTMLElement | null;
      }
      const normalizedBody = normalizeBodyForBuilder(doc.body.innerHTML);
      const isBlockInsert = /data-vb-block-id=/.test(html) || activeBuilderMode === 'block';
      let nextInspector: BlockInspectorState | null = null;
      if (insertedEl && isBlockInsert) {
        const topLevel = insertedEl.closest('[data-vb-block-id]') as HTMLElement | null;
        if (topLevel) nextInspector = createBlockInspectorState(topLevel);
      }
      const updated = normalizeDraftForBuilder({
        ...currentSelected,
        bodyHtml: normalizedBody,
        updatedAt: new Date().toISOString(),
        lastSelectedBlockType: nextInspector?.type ?? currentSelected.lastSelectedBlockType ?? null,
      });
      setSelected(updated);
      setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      setSelectedBlock(nextInspector);
      bumpBodyEpoch();
    },
    [commitHistoryBeforeMutation, bumpBodyEpoch, activeBuilderMode],
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
      clearPendingInsertAnchor();
      iframeHoverBlockRef.current = null;
      insertHoverBlockIdRef.current = null;
      setBlockChromeAddMenuOpen(false);
      setBlockActionChrome(null);
    }, 380);
  }, [cancelInsertLineHide, clearPendingInsertAnchor]);

  const handleHoverBlockChrome = useCallback(
    (payload: { top: number; left: number; width: number; height: number; blockId: string } | null) => {
      if (activeBuilderMode !== 'block') {
        insertHoverBlockIdRef.current = null;
        setBlockActionChrome(null);
        return;
      }
      if (payload) {
        cancelInsertLineHide();
        insertHoverBlockIdRef.current = payload.blockId;
      } else {
        insertHoverBlockIdRef.current = null;
      }
      setBlockActionChrome(payload);
    },
    [activeBuilderMode, cancelInsertLineHide],
  );

  useEffect(() => {
    if (activeBuilderMode !== 'block') setBlockActionChrome(null);
  }, [activeBuilderMode]);

  useEffect(() => {
    cancelInsertLineHide();
    iframeHoverBlockRef.current = null;
    insertHoverBlockIdRef.current = null;
    setBlockChromeAddMenuOpen(false);
    setBlockLibraryExpanded(false);
    setBlockActionChrome(null);
    clearAiInsertIntent();
  }, [selected?.id, cancelInsertLineHide, clearAiInsertIntent]);

  useEffect(() => {
    if (!showInboxChrome) return;
    cancelInsertLineHide();
    iframeHoverBlockRef.current = null;
    insertHoverBlockIdRef.current = null;
    setBlockChromeAddMenuOpen(false);
    setBlockActionChrome(null);
    clearAiInsertIntent();
  }, [showInboxChrome, cancelInsertLineHide, clearAiInsertIntent]);

  useEffect(() => {
    if (!blockChromeAddMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('[data-email-chrome-add-menu]')) return;
      setBlockChromeAddMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    return () => document.removeEventListener('mousedown', onDoc, true);
  }, [blockChromeAddMenuOpen]);

  useEffect(() => {
    if (toolPanelMode === 'block' && activeBuilderMode !== 'block') {
      setToolPanelMode('ai');
    }
  }, [toolPanelMode, activeBuilderMode]);

  const handleBlockSelect = useCallback((block: BlockInspectorState | null) => {
    if (block && activeBuilderMode === 'block') {
      setToolPanelMode('block');
    }
    setSelectedBlock(block);
    setSelected(prev => {
      if (!prev) return prev;
      const updated = normalizeDraftForBuilder({
        ...prev,
        lastSelectedBlockType: block?.type ?? null,
        updatedAt: new Date().toISOString(),
      });
      setDrafts((draftsPrev) => draftsPrev.map(d => (d.id === updated.id ? updated : d)));
      return updated;
    });
  }, [activeBuilderMode]);

  const applyStructuredBodyMutation = useCallback((mutate: (block: HTMLElement, root: HTMLElement, doc: Document) => string | null | void) => {
    const currentSelected = selectedRef.current;
    const blockInfo = selectedBlock;
    const doc = previewIframeRef.current?.contentDocument;
    if (!currentSelected || !blockInfo?.id || !doc?.body) return false;
    const root = getEmailDndRoot(doc);
    const block = doc.querySelector(`[data-vb-block-id="${blockInfo.id}"]`) as HTMLElement | null;
    if (!block || !root.contains(block)) {
      toast.error('Vybraný blok už v náhledu není.');
      return false;
    }

    commitHistoryBeforeMutation();
    const preferredNextId = mutate(block, root, doc);

    const normalizedBody = normalizeBodyForBuilder(doc.body.innerHTML);
    const nextBlockId = preferredNextId === undefined ? blockInfo.id : preferredNextId;
    const nextBlock =
      nextBlockId
        ? (doc.querySelector(`[data-vb-block-id="${nextBlockId}"]`) as HTMLElement | null)
        : null;
    const nextInspector = nextBlock ? createBlockInspectorState(nextBlock) : null;
    const updated = normalizeDraftForBuilder({
      ...currentSelected,
      bodyHtml: normalizedBody,
      updatedAt: new Date().toISOString(),
      lastSelectedBlockType: nextInspector?.type ?? null,
    });

    setSelected(updated);
    setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    setSelectedBlock(nextInspector);
    bumpBodyEpoch();
    return true;
  }, [selectedBlock, commitHistoryBeforeMutation, bumpBodyEpoch]);

  const applyStructuredBodyMutationByBlockId = useCallback((
    blockId: string,
    mutate: (block: HTMLElement, root: HTMLElement, doc: Document) => string | null | void,
  ) => {
    const currentSelected = selectedRef.current;
    const doc = previewIframeRef.current?.contentDocument;
    if (!currentSelected || !blockId || !doc?.body) return false;
    const root = getEmailDndRoot(doc);
    const escaped = CSS.escape(blockId);
    const block = doc.querySelector(`[data-vb-block-id="${escaped}"]`) as HTMLElement | null;
    if (!block || !root.contains(block)) {
      toast.error('Blok v náhledu už není.');
      return false;
    }

    commitHistoryBeforeMutation();
    const preferredNextId = mutate(block, root, doc);

    const normalizedBody = normalizeBodyForBuilder(doc.body.innerHTML);
    const nextBlockId = preferredNextId === undefined ? blockId : preferredNextId;
    const nextBlock =
      nextBlockId
        ? (doc.querySelector(`[data-vb-block-id="${CSS.escape(nextBlockId)}"]`) as HTMLElement | null)
        : null;
    const nextInspector = nextBlock ? createBlockInspectorState(nextBlock) : null;
    const updated = normalizeDraftForBuilder({
      ...currentSelected,
      bodyHtml: normalizedBody,
      updatedAt: new Date().toISOString(),
      lastSelectedBlockType: nextInspector?.type ?? null,
    });

    setSelected(updated);
    setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    setSelectedBlock(nextInspector);
    bumpBodyEpoch();
    return true;
  }, [commitHistoryBeforeMutation, bumpBodyEpoch]);

  const handleProductCollageLive = useCallback(
    (payload: EmailProductCollageLivePayload) => {
      const currentSelected = selectedRef.current;
      const doc = previewIframeRef.current?.contentDocument;
      if (!currentSelected || !doc?.body) return;
      const root = getEmailDndRoot(doc);
      const escaped = CSS.escape(payload.blockId);
      const block = doc.querySelector(`[data-vb-block-id="${escaped}"]`) as HTMLElement | null;
      if (!block || !root.contains(block)) return;

      const newEnc = encodeProductCollagePayload(payload.layout, payload.items, payload.display);
      if (block.getAttribute('data-vb-pc-encoded') === newEnc) return;

      commitHistoryBeforeMutation();
      const html = buildProductCollageBlockHtml(
        payload.layout,
        payload.items,
        payload.blockId,
        payload.display,
      );
      const tmp = doc.createElement('div');
      tmp.innerHTML = html.trim();
      const next = tmp.firstElementChild as HTMLElement | null;
      if (!next) return;
      block.replaceWith(next);

      const normalizedBody = normalizeBodyForBuilder(doc.body.innerHTML);
      const nextBlock = doc.querySelector(`[data-vb-block-id="${escaped}"]`) as HTMLElement | null;
      const nextInspector = nextBlock ? createBlockInspectorState(nextBlock) : null;
      const updated = normalizeDraftForBuilder({
        ...currentSelected,
        bodyHtml: normalizedBody,
        updatedAt: new Date().toISOString(),
        lastSelectedBlockType: nextInspector?.type ?? null,
      });
      setSelected(updated);
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelectedBlock(nextInspector);
      bumpBodyEpoch();
    },
    [commitHistoryBeforeMutation, bumpBodyEpoch],
  );

  const handleWebinarLive = useCallback(
    (payload: EmailWebinarLivePayload) => {
      const currentSelected = selectedRef.current;
      const doc = previewIframeRef.current?.contentDocument;
      if (!currentSelected || !doc?.body) return;
      const root = getEmailDndRoot(doc);
      const escaped = CSS.escape(payload.blockId);
      const block = doc.querySelector(`[data-vb-block-id="${escaped}"]`) as HTMLElement | null;
      if (!block || !root.contains(block)) return;

      const newEnc = encodeWebinarPayload(payload.layout, payload.snapshot);
      if (block.getAttribute('data-vb-wb-encoded') === newEnc) return;

      commitHistoryBeforeMutation();
      const html = buildWebinarBlockHtml(payload.layout, payload.snapshot, payload.blockId);
      const tmp = doc.createElement('div');
      tmp.innerHTML = html.trim();
      const next = tmp.firstElementChild as HTMLElement | null;
      if (!next) return;
      block.replaceWith(next);

      const normalizedBody = normalizeBodyForBuilder(doc.body.innerHTML);
      const nextBlock = doc.querySelector(`[data-vb-block-id="${escaped}"]`) as HTMLElement | null;
      const nextInspector = nextBlock ? createBlockInspectorState(nextBlock) : null;
      const updated = normalizeDraftForBuilder({
        ...currentSelected,
        bodyHtml: normalizedBody,
        updatedAt: new Date().toISOString(),
        lastSelectedBlockType: nextInspector?.type ?? null,
      });
      setSelected(updated);
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelectedBlock(nextInspector);
      bumpBodyEpoch();
    },
    [commitHistoryBeforeMutation, bumpBodyEpoch],
  );

  const moveBlockById = useCallback((blockId: string, direction: 'up' | 'down') => {
    applyStructuredBodyMutationByBlockId(blockId, (block) => {
      const parent = block.parentElement as HTMLElement | null;
      if (!parent) return;
      if (direction === 'up') {
        const sibling = block.previousElementSibling as HTMLElement | null;
        if (!sibling || /^(STYLE|SCRIPT)$/i.test(sibling.tagName)) return;
        parent.insertBefore(block, sibling);
      } else {
        const sibling = block.nextElementSibling as HTMLElement | null;
        if (!sibling || /^(STYLE|SCRIPT)$/i.test(sibling.tagName)) return;
        parent.insertBefore(sibling, block);
      }
    });
  }, [applyStructuredBodyMutationByBlockId]);

  const duplicateBlockById = useCallback((blockId: string) => {
    applyStructuredBodyMutationByBlockId(blockId, (block) => {
      const clone = block.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-vb-block-id');
      clone.removeAttribute('data-vb-block');
      clone.querySelectorAll('[data-vb-block-id]').forEach((el) => {
        el.removeAttribute('data-vb-block-id');
      });
      block.insertAdjacentElement('afterend', clone);
      const inserted = clone;
      const type = inferEmailBlockType(inserted);
      inserted.setAttribute('data-vb-block', type);
      return block.getAttribute('data-vb-block-id');
    });
  }, [applyStructuredBodyMutationByBlockId]);

  const deleteBlockById = useCallback((blockId: string) => {
    applyStructuredBodyMutationByBlockId(blockId, (block, root) => {
      const nextSibling = block.nextElementSibling as HTMLElement | null;
      const prevSibling = block.previousElementSibling as HTMLElement | null;
      block.remove();
      if ([...root.children].filter((el) => !/^(STYLE|SCRIPT)$/i.test((el as HTMLElement).tagName)).length === 0) {
        root.insertAdjacentHTML('beforeend', buildEmailSectionHtml('card'));
      }
      const next = nextSibling || prevSibling || (root.querySelector('[data-vb-block-id]') as HTMLElement | null);
      return next?.getAttribute('data-vb-block-id') || null;
    });
  }, [applyStructuredBodyMutationByBlockId]);

  const moveSelectedBlock = useCallback((direction: 'up' | 'down') => {
    applyStructuredBodyMutation((block) => {
      const parent = block.parentElement as HTMLElement | null;
      if (!parent) return;
      const sibling = direction === 'up'
        ? block.previousElementSibling
        : block.nextElementSibling;
      if (!sibling) return;
      if (direction === 'up') parent.insertBefore(block, sibling);
      else parent.insertBefore(sibling, block);
    });
  }, [applyStructuredBodyMutation]);

  const duplicateSelectedBlock = useCallback(() => {
    applyStructuredBodyMutation((block) => {
      const clone = block.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-vb-block-id');
      clone.removeAttribute('data-vb-block');
      clone.querySelectorAll('[data-vb-block-id]').forEach((el) => {
        el.removeAttribute('data-vb-block-id');
      });
      block.insertAdjacentElement('afterend', clone);
      const inserted = clone;
      const type = inferEmailBlockType(inserted);
      inserted.setAttribute('data-vb-block', type);
      return block.getAttribute('data-vb-block-id');
    });
  }, [applyStructuredBodyMutation]);

  const deleteSelectedBlock = useCallback(() => {
    applyStructuredBodyMutation((block, root) => {
      const nextSibling = block.nextElementSibling as HTMLElement | null;
      const prevSibling = block.previousElementSibling as HTMLElement | null;
      block.remove();
      if ([...root.children].filter((el) => !/^(STYLE|SCRIPT)$/i.test((el as HTMLElement).tagName)).length === 0) {
        root.insertAdjacentHTML('beforeend', buildEmailSectionHtml('card'));
      }
      const next = nextSibling || prevSibling || (root.querySelector('[data-vb-block-id]') as HTMLElement | null);
      return next?.getAttribute('data-vb-block-id') || null;
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedSectionFill = useCallback((fill: EmailSectionFill) => {
    applyStructuredBodyMutation((block) => {
      const sec =
        block.getAttribute('data-vb-block') === 'section'
          ? block
          : (block.closest('[data-vb-block="section"]') as HTMLElement | null);
      if (!sec) {
        toast.info('Skupinu se nepodařilo najít.');
        return;
      }
      sec.setAttribute('data-vb-section-fill', fill);
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedBlockStyle = useCallback((property: string, value: string) => {
    applyStructuredBodyMutation((block) => {
      block.setAttribute('style', setInlineStyleValue(block.getAttribute('style') || '', property, value));
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedBlockLink = useCallback((field: 'text' | 'href', value: string) => {
    applyStructuredBodyMutation((block) => {
      const link = extractFirstLink(block);
      if (!link) return;
      if (field === 'text') link.textContent = value || 'Vyzkoušet zdarma';
      else link.setAttribute('href', value || 'https://www.vividbooks.com/vyzkousejte');
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedBlockImage = useCallback((value: string) => {
    applyStructuredBodyMutation((block) => {
      const image = extractFirstImage(block);
      if (!image) return;
      image.setAttribute('src', value);
    });
  }, [applyStructuredBodyMutation]);

  const insertPresetBlock = useCallback((type: EmailBlockType) => {
    if (activeBuilderMode === 'block') {
      setToolPanelMode('block');
    }
    const html = buildEmailBlockHtml(type);
    insertHtmlAfterAnchorOrAppend(html);
    setBlockChromeAddMenuOpen(false);
  }, [insertHtmlAfterAnchorOrAppend, activeBuilderMode]);

  const insertPresetBlockBeforeById = useCallback(
    (blockId: string, type: EmailBlockType) => {
      if (activeBuilderMode === 'block') setToolPanelMode('block');
      const html = buildEmailBlockHtml(type);
      insertHtmlBeforeBlockById(blockId, html);
      setBlockChromeAddMenuOpen(false);
    },
    [insertHtmlBeforeBlockById, activeBuilderMode],
  );

  const copyBlockHtmlToClipboard = useCallback((blockId: string) => {
    const doc = previewIframeRef.current?.contentDocument;
    if (!doc?.body) return;
    const escaped = CSS.escape(blockId);
    const block = doc.querySelector(`[data-vb-block-id="${escaped}"]`) as HTMLElement | null;
    const root = getEmailDndRoot(doc);
    if (!block || !root.contains(block)) {
      toast.error('Blok v náhledu už není.');
      return;
    }
    const clone = block.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-vb-block-id');
    clone.removeAttribute('data-vb-block');
    const html = clone.outerHTML.trim();
    if (!html) {
      toast.error('Blok je prázdný.');
      return;
    }
    try {
      sessionStorage.setItem(EMAIL_BLOCK_CLIPBOARD_STORAGE_KEY, html);
      setEmailBlockClipboardTick((t) => t + 1);
      toast.success('Blok zkopírován. U jiného bloku otevřete + a zvolte vložení.');
    } catch {
      toast.error('Kopii se nepodařilo uložit (např. režim soukromí v prohlížeči).');
    }
  }, []);

  const pasteCopiedBlockBeforeById = useCallback(
    (blockId: string) => {
      let html = '';
      try {
        html = (sessionStorage.getItem(EMAIL_BLOCK_CLIPBOARD_STORAGE_KEY) || '').trim();
      } catch {
        /* ignore */
      }
      if (!html) {
        toast.error('Nemáte zkopírovaný blok — použijte ikonu schránky u bloku.');
        return;
      }
      if (activeBuilderMode === 'block') setToolPanelMode('block');
      insertHtmlBeforeBlockById(blockId, html);
      setBlockChromeAddMenuOpen(false);
    },
    [insertHtmlBeforeBlockById, activeBuilderMode],
  );

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
    const beforeId = pendingInsertBeforeBlockIdRef.current;
    if (beforeId) {
      pendingInsertBeforeBlockIdRef.current = null;
      insertHtmlBeforeBlockById(beforeId, imgTag);
    } else {
      insertHtmlAfterAnchorOrAppend(imgTag);
    }
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
        const beforeId = pendingInsertBeforeBlockIdRef.current;
        if (beforeId) {
          pendingInsertBeforeBlockIdRef.current = null;
          insertHtmlBeforeBlockById(beforeId, html);
        } else {
          insertHtmlAfterAnchorOrAppend(html);
        }
      }
      setCollageOpen(false);
      setEditingImgSrc(null);
    },
    [selected, editingImgSrc, clearPendingInsertAnchor, updateField, bumpBodyEpoch, insertHtmlAfterAnchorOrAppend, insertHtmlBeforeBlockById],
  );

  const closeCtaInsertModal = useCallback(() => {
    setCtaInsertModalOpen(false);
    setCtaAiHint('');
    ctaInsertBeforeBlockIdRef.current = null;
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

  const openCtaInsertFlow = useCallback(async (opts?: { insertBeforeBlockId?: string }) => {
    if (!selected) return;
    setBlockChromeAddMenuOpen(false);
    let contextText = '';
    if (opts?.insertBeforeBlockId) {
      clearPendingInsertAnchor();
      ctaInsertBeforeBlockIdRef.current = opts.insertBeforeBlockId;
      const doc = previewIframeRef.current?.contentDocument;
      contextText = getPlainTextBeforeBlockId(doc, opts.insertBeforeBlockId);
    } else {
      ctaInsertBeforeBlockIdRef.current = null;
      if (!prepareInsertAnchor()) return;
      const id = pendingInsertAnchorRef.current;
      const doc = previewIframeRef.current?.contentDocument;
      contextText = getPlainTextBeforeInsertAnchor(doc, id);
    }
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
  }, [selected, prepareInsertAnchor, clearPendingInsertAnchor]);

  const startChatInsertFromPlusBeforeBlock = useCallback((blockId: string) => {
    clearPendingInsertAnchor();
    setAiInsertAfterAnchorId(null);
    setAiInsertBeforeBlockId(blockId);
    setBlockChromeAddMenuOpen(false);
    setToolPanelMode('ai');
    setCapturedSelection(null);
    setSelectedCanvasText('');
    try {
      previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
    } catch { /* ignore */ }
    window.getSelection()?.removeAllRanges();
    window.setTimeout(() => chatInputRef.current?.focus(), 50);
  }, [clearPendingInsertAnchor]);

  const regenerateCtaSuggestion = useCallback(async () => {
    if (!selected) return;
    const doc = previewIframeRef.current?.contentDocument;
    const beforeId = ctaInsertBeforeBlockIdRef.current;
    let contextText = '';
    if (beforeId) {
      const el = doc?.querySelector(`[data-vb-block-id="${CSS.escape(beforeId)}"]`);
      if (!el || !doc?.body.contains(el)) {
        toast.error('Cílový blok v náhledu už není — zavřete okno a zvolte CTA znovu.');
        return;
      }
      contextText = getPlainTextBeforeBlockId(doc, beforeId);
    } else {
      const id = pendingInsertAnchorRef.current;
      const anchorEl = id ? doc?.querySelector(`[data-vb-insert="${id}"]`) : null;
      if (!id || !anchorEl || !doc?.body.contains(anchorEl)) {
        toast.error('Zavřete okno a znovu zvolte CTA z náhledu.');
        return;
      }
      contextText = getPlainTextBeforeInsertAnchor(doc, id);
    }
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
    const beforeId = ctaInsertBeforeBlockIdRef.current;
    ctaInsertBeforeBlockIdRef.current = null;
    if (beforeId) insertHtmlBeforeBlockById(beforeId, html);
    else insertHtmlAfterAnchorOrAppend(html);
    setCtaInsertModalOpen(false);
    setCtaAiHint('');
    toast.success('CTA vloženo');
  }, [ctaFormText, ctaFormUrl, insertHtmlAfterAnchorOrAppend, insertHtmlBeforeBlockById]);

  /** Odeslání zprávy do generate-email; `prompt` jde do API, `chatLabel` volitelně zkrácený text do bubliny. */
  const sendChatMessage = async (prompt: string, options?: { chatLabel?: string }) => {
    const msg = prompt.trim();
    if (!msg || generating) return;

    commitHistoryBeforeMutation();

    const insertAnchorId = aiInsertAfterAnchorId;
    const insertBeforeBlockId = aiInsertBeforeBlockId;
    const selectionSlice =
      (!insertAnchorId &&
        !insertBeforeBlockId &&
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
      const beforeTargetStill =
        !!(
          insertBeforeBlockId &&
          docLive?.body?.querySelector(`[data-vb-block-id="${CSS.escape(insertBeforeBlockId)}"]`)
        );

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
      if (insertBeforeBlockId) {
        if (!beforeTargetStill) {
          toast.warning('Cílový blok v náhledu už není — zrušte režim vložení nebo zvolte blok znovu.');
          clearAiInsertIntent();
        } else {
          const targetHtml = getBlockOuterHtmlForAiByBlockId(docLive, insertBeforeBlockId);
          const beforeTxt = getPlainTextBeforeBlockId(docLive, insertBeforeBlockId);
          if (targetHtml) {
            insertCtx =
              '\n\n[DŮLEŽITÉ — režim vložení v náhledu (nad blok): Uživatel zvolil, že se má nový obsah vložit IHNED PŘED následující HTML blok, podle pokynu v poslední zprávě. ' +
              'V poli bodyHtml vrať CELÉ HTML těla zprávy: tento blok musí zůstat v kódu beze změny a BEZ PROSTŘIHÁNÍ těsně před jeho otevírací tag vložíš nový obsah jako HTML (stylově sladěný s mailem). Nic jinde v mailu neměň ani neodstraňuj. ' +
              `Blok, před který vložit:\n"""${targetHtml}"""\n` +
              `Čistý text těla před tímto blokem (orientace):\n"""${beforeTxt.slice(-2000)}"""`;
          } else {
            toast.warning('Nepodařilo se přečíst cílový blok — zkuste znovu.');
            clearAiInsertIntent();
          }
        }
      } else if (insertAnchorId) {
        if (!anchorStill) {
          toast.warning('Kotva vložení už neplatí — upravte znovu z náhledu nebo pokračujte bez vložení.');
          clearAiInsertIntent();
        } else {
          const anchorHtml = getAnchorBlockOuterHtmlForAi(docLive, insertAnchorId);
          const beforeTxt = getPlainTextBeforeInsertAnchor(docLive, insertAnchorId);
          if (anchorHtml) {
            insertCtx =
              '\n\n[DŮLEŽITÉ — režim vložení v náhledu (za blok): Uživatel zvolil, že se má nový obsah vložit IHNED ZA následující HTML blok, a to podle jeho pokynu v poslední zprávě. ' +
              'V poli bodyHtml vrať CELÉ HTML těla zprávy: tento blok musí zůstat v kódu beze změny a BEZ PROSTŘIHÁNÍ hned za uzavírací tag tohoto bloku vložíš nový obsah jako HTML (stylově sladěný s mailem). Nic jinde v mailu neměň ani neodstraňuj. ' +
              `Blok, za který vložit (najdi přesně tuto strukturu v aktuálním body):\n"""${anchorHtml}"""\n` +
              `Čistý text těla před tímto blokem (orientace):\n"""${beforeTxt.slice(-2000)}"""`;
          } else {
            toast.warning('Nepodařilo se přečíst blok pro vložení — zkuste znovu.');
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
      if (insertAnchorId || insertBeforeBlockId) clearAiInsertIntent();
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
    if (aiInsertAfterAnchorId || aiInsertBeforeBlockId) {
      toast.info('Zrušte nejdřív režim vložení z náhledu (+ / uložené místo v chatu).');
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
    const snap = selectedRef.current;
    if (!snap) return;
    setPushing(true);
    try {
      const saved = await saveDraft(snap, { quiet: true });
      if (!saved) return;

      const r = await fetch(`${SERVER}/admin/mailchimp/create-draft`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({
          subject: saved.subject,
          previewText: saved.previewText,
          headline: saved.headline,
          bodyContent: saved.bodyHtml,
          ctaText: saved.ctaText,
          ctaUrl: saved.ctaUrl,
          audience: saved.audience,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);

      const updated = normalizeDraftForBuilder({
        ...saved,
        status: 'pushed' as const,
        mailchimpCampaignId: data.campaignId,
        mailchimpUrl: data.archiveUrl || data.webUrl,
        updatedAt: new Date().toISOString(),
      });
      setSelected(updated);
      setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      await saveDraft(updated, { quiet: true });
      toast.success('Pushnutno do Mailchimpu!');
    } catch (e: unknown) {
      console.error('Push to Mailchimp error:', e);
      toast.error(`Mailchimp chyba: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPushing(false);
    }
  };

  const sendTestMail = async () => {
    const snap = selectedRef.current;
    if (!snap || !testMailRecipient) return;
    if (!snap.subject.trim()) {
      toast.error('Nejdřív vyplňte předmět.');
      return;
    }
    setSendingTestMail(true);
    try {
      const saved = await saveDraft(snap, { quiet: true });
      if (!saved) return;

      const r = await fetch(`${SERVER}/admin/mailchimp/send-test-email`, {
        method: 'POST',
        headers: AUTH_H,
        body: JSON.stringify({
          to: testMailRecipient,
          subject: saved.subject,
          previewText: saved.previewText,
          headline: saved.headline,
          bodyContent: saved.bodyHtml,
          ctaText: saved.ctaText,
          ctaUrl: saved.ctaUrl,
          audience: saved.audience,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      toast.success(typeof data.message === 'string' ? data.message : `Test odeslán na ${testMailRecipient}`);
    } catch (e: unknown) {
      console.error('Test mail error:', e);
      toast.error(`Test mail: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSendingTestMail(false);
    }
  };

  const blockPresetGroups = (['Content', 'Media', 'Layout', 'Commerce', 'Brand'] as EmailBlockPreset['category'][])
    .map((category) => ({
      category,
      blocks: EMAIL_BLOCK_PRESETS.filter((preset) => preset.category === category),
    }))
    .filter((group) => group.blocks.length > 0);

  const blockPresetsOrdered = blockPresetGroups.flatMap((g) => g.blocks);
  const selectedSectionFill = useMemo(
    () =>
      readSectionFillForSelectedBlock(
        previewIframeRef.current?.contentDocument ?? null,
        selectedBlock?.id ?? null,
      ),
    [selectedBlock?.id, bodyEditEpoch, selected?.id, selected?.bodyHtml],
  );
  const BLOCK_LIB_PREVIEW = 6;
  const visibleBlockPresets = blockLibraryExpanded
    ? blockPresetsOrdered
    : blockPresetsOrdered.slice(0, BLOCK_LIB_PREVIEW);
  const blockLibraryHasMore = blockPresetsOrdered.length > BLOCK_LIB_PREVIEW;

  const blockChromePortal =
    selected &&
    activeBuilderMode === 'block' &&
    !showInboxChrome &&
    blockActionChrome &&
    !assetPickerOpen &&
    !collageOpen &&
    !imageToolSrc &&
    !ctaInsertModalOpen
      ? (() => {
          const barW = 40;
          const gap = 8;
          const c = blockActionChrome;
          let left = c.left + c.width + gap;
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          if (left + barW > vw - 10) left = c.left - barW - gap;
          if (left < 8) left = 8;
          const chromeOnRight = left >= c.left + c.width;
          const top = c.top + c.height / 2;
          const bid = c.blockId;
          void emailBlockClipboardTick;
          let hasCopiedBlock = false;
          try {
            hasCopiedBlock = !!(
              typeof window !== 'undefined' &&
              (sessionStorage.getItem(EMAIL_BLOCK_CLIPBOARD_STORAGE_KEY) || '').trim()
            );
          } catch {
            hasCopiedBlock = false;
          }
          const btnClass =
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#001161]/65 hover:bg-[#7C3AED]/12 hover:text-[#7C3AED] cursor-pointer transition-colors';
          return createPortal(
            <div
              data-email-block-chrome
              className="flex flex-col gap-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
              style={{
                position: 'fixed',
                zIndex: 19950,
                left,
                top,
                transform: 'translateY(-50%)',
              }}
              onMouseEnter={cancelInsertLineHide}
              onMouseLeave={scheduleInsertLineHide}
            >
              <div
                className={`relative ${blockChromeAddMenuOpen ? 'z-[1]' : ''}`}
                data-email-chrome-add-menu
              >
                <button
                  type="button"
                  className={`${btnClass} ${blockChromeAddMenuOpen ? 'bg-[#7C3AED]/12 text-[#7C3AED]' : ''}`}
                  title="Přidat nad tento blok"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelInsertLineHide();
                    setBlockChromeAddMenuOpen(v => !v);
                  }}
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
                {blockChromeAddMenuOpen && (
                  <div
                    className={`absolute z-20 top-0 w-[min(100vw-24px,320px)] min-w-[280px] rounded-xl border border-gray-200 bg-white px-3 pb-3 pt-2 shadow-xl ${
                      chromeOnRight ? 'right-full mr-2' : 'left-full ml-2'
                    }`}
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                  >
                    <div className="mb-2 px-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#001161]/35">Knihovna bloků</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-[#001161]/40">Vložení nad blok, u kterého je lišta</p>
                    </div>
                    {hasCopiedBlock && (
                      <button
                        type="button"
                        className="mb-2 flex w-full items-center gap-2 rounded-xl border border-[#7C3AED]/25 bg-[#7C3AED]/6 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161] hover:bg-[#7C3AED]/10 transition-colors cursor-pointer"
                        onClick={() => pasteCopiedBlockBeforeById(bid)}
                      >
                        <ClipboardPaste className="h-4 w-4 shrink-0 text-[#7C3AED]" aria-hidden />
                        Vložit zkopírovaný blok
                      </button>
                    )}
                    <div className="grid grid-cols-3 gap-1.5">
                      {blockPresetsOrdered.map((block) => (
                        <button
                          key={block.type}
                          type="button"
                          title={`${block.description} — přetáhněte do náhledu`}
                          draggable
                          onDragStart={(ev) => {
                            ev.dataTransfer?.setData(VB_EMAIL_LIBRARY_DRAG_TYPE, block.type);
                            ev.dataTransfer?.setData('text/plain', `vb-email-block:${block.type}`);
                            if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => insertPresetBlockBeforeById(bid, block.type)}
                          className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-1.5 py-2.5 text-center shadow-sm transition-all hover:border-[#7C3AED]/35 hover:bg-[#7C3AED]/6 hover:shadow cursor-grab active:cursor-grabbing"
                        >
                          <BlockPresetIcon type={block.type} className="h-6 w-6 shrink-0 text-[#001161]/50" />
                          <span className="text-[9px] font-bold leading-tight text-[#001161] line-clamp-2">{block.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mx-0 my-3 h-px bg-gray-100" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161] hover:bg-[#7C3AED]/8 transition-colors cursor-pointer"
                      onClick={() => {
                        pendingInsertBeforeBlockIdRef.current = bid;
                        setBlockChromeAddMenuOpen(false);
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
                        pendingInsertBeforeBlockIdRef.current = bid;
                        setBlockChromeAddMenuOpen(false);
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
                        void openCtaInsertFlow({ insertBeforeBlockId: bid });
                      }}
                    >
                      <MousePointerClick className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                      CTA přes AI
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-[#001161] hover:bg-[#7C3AED]/8 transition-colors cursor-pointer"
                      onClick={() => {
                        startChatInsertFromPlusBeforeBlock(bid);
                      }}
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                      Napsat přes AI (chat)
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={btnClass}
                title="Přesunout nahoru"
                onClick={(e) => {
                  e.stopPropagation();
                  moveBlockById(bid, 'up');
                }}
              >
                <ChevronUp className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={btnClass}
                title="Přesunout dolů"
                onClick={(e) => {
                  e.stopPropagation();
                  moveBlockById(bid, 'down');
                }}
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={btnClass}
                title="Kopírovat blok (vložení přes + zde nebo v jiném mailu)"
                onClick={(e) => {
                  e.stopPropagation();
                  copyBlockHtmlToClipboard(bid);
                }}
              >
                <ClipboardCopy className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className={btnClass}
                title="Duplikovat"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateBlockById(bid);
                }}
              >
                <CopyPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className={`${btnClass} hover:!bg-red-50 hover:!text-red-600`}
                title="Vymazat"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBlockById(bid);
                }}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>,
            document.body,
          );
        })()
      : null;

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

      {blockChromePortal}

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
                Text a odkaz navrhl AI z obsahu před místem vložení. Upravte cílovou URL a text podle potřeby.
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
          <div className="flex items-center min-w-0">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 p-0.5 bg-[#fafbfd]">
              <button
                type="button"
                onClick={() => setToolPanelMode('ai')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  toolPanelMode === 'ai'
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : 'text-[#001161]/45 hover:text-[#001161]/70 hover:bg-gray-100'
                }`}
                style={F}
              >
                <Brain className="w-3 h-3 shrink-0" aria-hidden />
                AI agent
              </button>
              <button
                type="button"
                onClick={() => setToolPanelMode('block')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  toolPanelMode === 'block'
                    ? 'bg-[#001161] text-white shadow-sm'
                    : 'text-[#001161]/45 hover:text-[#001161]/70 hover:bg-gray-100'
                }`}
                style={F}
              >
                <LayoutTemplate className="w-3 h-3 shrink-0" aria-hidden />
                Block editor
              </button>
              <button
                type="button"
                onClick={() => setToolPanelMode('settings')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  toolPanelMode === 'settings'
                    ? 'bg-[#0f766e] text-white shadow-sm'
                    : 'text-[#001161]/45 hover:text-[#001161]/70 hover:bg-gray-100'
                }`}
                style={F}
                title="Předmět, audience, čas odeslání a push do Mailchimpu"
              >
                <Settings2 className="w-3 h-3 shrink-0" aria-hidden />
                Nastavení
              </button>
            </div>
          </div>
          {toolPanelMode === 'ai' && (
            <div
              className="flex flex-wrap items-center gap-x-1 gap-y-1"
              role="group"
              aria-label="Model a RAG"
            >
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
          )}
          <p style={F} className="text-[9px] text-[#001161]/38 leading-snug">
            {toolPanelMode === 'ai'
              ? 'RAG− přeskočí knihovnu (rychleji). Lite = užší podklady. Při 503 Google až 3 opakování.'
              : toolPanelMode === 'settings'
                ? 'Předmět, audience a plán uložíme s draftem. Čas odeslání v Mailchimpu zatím po pushi doplňte v kampani.'
                : 'Knihovna bloků a nastavení vybraného bloku. Bloky přetáhněte do náhledu nebo vložte kliknutím / řádkem + u bloku.'}
          </p>
        </div>

        {toolPanelMode === 'ai' ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3">
              {chatMsgs.length === 0 && (
                <div className="text-center py-12">
                  <Sparkles className="w-8 h-8 text-[#7C3AED]/20 mx-auto mb-3" />
                  <p style={F} className="text-[12px] text-[#001161]/30 mb-1">Popište email nebo označte text v náhledu</p>
                  <p style={F} className="text-[10px] text-[#001161]/20">
                    Úpravy: u lišty u bloku (+) lze zvolit „Napsat přes AI“ a v chatu popsat, co se má vložit nad blok
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
                    Místo vložení je uložené — obsah se doplní za zvolený blok v náhledu.
                  </span>
                  <button
                    type="button"
                    onClick={clearAiInsertIntent}
                    className="p-0.5 rounded hover:bg-amber-100 cursor-pointer"
                    title="Zrušit režim vložení"
                  >
                    <X className="w-3 h-3 text-amber-800/60" />
                  </button>
                </div>
              )}
              {aiInsertBeforeBlockId && (
                <div className="mb-2 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100/80 flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-amber-700 shrink-0" />
                  <span style={F} className="text-[9px] text-amber-950/90 leading-snug flex-1">
                    Místo vložení je uložené — obsah se doplní před zvolený blok v náhledu (tlačítko + u lišty).
                  </span>
                  <button
                    type="button"
                    onClick={clearAiInsertIntent}
                    className="p-0.5 rounded hover:bg-amber-100 cursor-pointer"
                    title="Zrušit režim vložení"
                  >
                    <X className="w-3 h-3 text-amber-800/60" />
                  </button>
                </div>
              )}
              {(capturedSelection?.trim() || selectedCanvasText.trim()) && !aiInsertAfterAnchorId && !aiInsertBeforeBlockId && (
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
                    aiInsertBeforeBlockId
                      ? 'Popište, co se má vložit nad zvolený blok v náhledu…'
                      : aiInsertAfterAnchorId
                        ? 'Popište, co se má vložit za zvolené místo v náhledu…'
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
          </>
        ) : toolPanelMode === 'settings' ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 bg-[#fcfcfe]">
            {!selected ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fafbfd] px-4 py-10 text-center">
                <Settings2 className="w-8 h-8 text-[#001161]/15 mx-auto mb-2" aria-hidden />
                <p style={F} className="text-[12px] text-[#001161]/40">
                  Vyberte e-mail v seznamu vlevo nebo vytvořte nový draft.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[#7C3AED]" aria-hidden />
                  <p style={F} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#001161]">
                    Nastavení mailu
                  </p>
                </div>

                <div>
                  <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">
                    Předmět
                  </label>
                  <input
                    type="text"
                    value={selected.subject}
                    onChange={e => updateField('subject', e.target.value)}
                    placeholder="Předmět zprávy…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                    style={F}
                  />
                </div>

                <div>
                  <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">
                    Náhledový text
                  </label>
                  <input
                    type="text"
                    value={selected.previewText}
                    onChange={e => updateField('previewText', e.target.value)}
                    placeholder="Řádek pod předmětem u příjemce…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                    style={F}
                  />
                </div>

                <div>
                  <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">
                    Audience
                  </label>
                  <div className="flex flex-wrap gap-2">
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

                <div>
                  <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">
                    Plánované odeslání
                  </label>
                  <input
                    type="datetime-local"
                    value={isoToDatetimeLocal(selected.scheduledSendAt)}
                    onChange={e => updateField('scheduledSendAt', datetimeLocalToIso(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-[#001161] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                    style={F}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void pushToMailchimp()}
                  disabled={pushing || !selected.subject.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-45 disabled:pointer-events-none transition-all cursor-pointer"
                  style={F}
                >
                  {pushing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
                  Poslat do Mailchimpu
                </button>

                <div className="mt-4 rounded-xl border border-gray-200 bg-[#fafbfd] p-4 space-y-3">
                  <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#7C3AED]/80 mb-0">
                    Testovací odeslání (Mailchimp)
                  </label>
                  <select
                    value={testMailRecipient}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTestMailRecipient(v);
                      try {
                        window.localStorage.setItem(EMAIL_TEST_TO_STORAGE_KEY, v);
                      } catch { /* ignore */ }
                    }}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-[#001161] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                    style={F}
                  >
                    {EMAIL_TEST_RECIPIENTS.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void sendTestMail()}
                    disabled={sendingTestMail || pushing || !selected.subject.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[12px] font-bold text-[#7C3AED] hover:border-[#7C3AED]/35 hover:bg-[#7C3AED]/5 disabled:opacity-45 disabled:pointer-events-none transition-all cursor-pointer"
                    style={F}
                  >
                    {sendingTestMail ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" aria-hidden />
                    ) : (
                      <Mail className="w-4 h-4 text-[#7C3AED]" aria-hidden />
                    )}
                    Poslat test mail
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 bg-[#fcfcfe]">
            {selected && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                <div>
                  <p style={F} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#001161]">
                    Pozadí náhledu
                  </p>
                  <p style={F} className="mt-1 text-[10px] leading-snug text-[#001161]/45">
                    Šedá plocha kolem náhledu a barva „karet“ uvnitř skupin s režimem Karta. Skupiny s volbou Bez pozadí leží přímo na barvě sloupce.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">
                      Plocha za sloupcem
                    </label>
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
                    <label style={F} className="text-[9px] font-bold text-[#001161]/40 uppercase block mb-1">
                      Sloupec / karty
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        aria-label="Barva sloupce a výplně karet"
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
                    const updated = normalizeDraftForBuilder({
                      ...selected,
                      previewOuterBg: DEFAULT_PREVIEW_OUTER_BG,
                      previewColumnBg: DEFAULT_PREVIEW_COLUMN_BG,
                      updatedAt: new Date().toISOString(),
                    });
                    setSelected(updated);
                    setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
                  }}
                  className="text-[10px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
                  style={F}
                >
                  Obnovit výchozí barvy náhledu
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-[#7C3AED]" />
                  <p style={F} className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#001161]">
                    Knihovna bloků
                  </p>
                </div>
                <p style={F} className="mt-1.5 text-[11px] leading-snug text-[#001161]/45">
                  Kliknutím nebo přetažením do náhledu přidáte blok. Přesné místo u kliknutí zvolíte řádkem + u bloku v náhledu.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {visibleBlockPresets.map((block) => (
                  <button
                    key={block.type}
                    type="button"
                    title={`${block.description} — přetáhněte do náhledu`}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer?.setData(VB_EMAIL_LIBRARY_DRAG_TYPE, block.type);
                      ev.dataTransfer?.setData('text/plain', `vb-email-block:${block.type}`);
                      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => insertPresetBlock(block.type)}
                    className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-3 text-center shadow-sm transition-all hover:border-[#7C3AED]/35 hover:bg-[#7C3AED]/6 hover:shadow-md cursor-grab active:cursor-grabbing"
                  >
                    <BlockPresetIcon type={block.type} className="h-7 w-7 shrink-0 text-[#001161]/50" />
                    <span style={F} className="text-[10px] font-bold leading-tight text-[#001161] line-clamp-2">
                      {block.label}
                    </span>
                  </button>
                ))}
              </div>
              {blockLibraryHasMore && (
                <button
                  type="button"
                  onClick={() => setBlockLibraryExpanded((v) => !v)}
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-[#fafbfd] py-2.5 text-[11px] font-bold text-[#001161] transition-colors hover:border-[#7C3AED]/25 hover:bg-[#7C3AED]/5 cursor-pointer"
                  style={F}
                >
                  {blockLibraryExpanded ? 'Zobrazit méně' : 'Zobrazit vše'}
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p style={F} className="text-[12px] font-bold text-[#001161]">
                    {selectedBlock ? selectedBlock.label : 'Vybraný blok'}
                  </p>
                  <p style={F} className="text-[11px] text-[#001161]/45">
                    {selectedBlock
                      ? `Typ: ${selectedBlock.type}`
                      : 'Klikněte v náhledu na některý blok a zobrazí se jeho nastavení.'}
                  </p>
                </div>
              </div>

              {selectedBlock ? (
                <div key={selectedBlock.id} className="space-y-4">
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveSelectedBlock('up')}
                      title="Posunout nahoru"
                      aria-label="Posunout nahoru"
                      className="rounded-xl border border-gray-200 px-2 py-2 text-[#001161] hover:bg-gray-50 cursor-pointer flex items-center justify-center min-w-0"
                    >
                      <ArrowUp className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelectedBlock('down')}
                      title="Posunout dolů"
                      aria-label="Posunout dolů"
                      className="rounded-xl border border-gray-200 px-2 py-2 text-[#001161] hover:bg-gray-50 cursor-pointer flex items-center justify-center min-w-0"
                    >
                      <ArrowDown className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={duplicateSelectedBlock}
                      title="Duplikovat"
                      aria-label="Duplikovat"
                      className="rounded-xl border border-gray-200 px-2 py-2 text-[#001161] hover:bg-gray-50 cursor-pointer flex items-center justify-center min-w-0"
                    >
                      <CopyPlus className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedBlock}
                      title="Smazat"
                      aria-label="Smazat"
                      className="rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-red-600 hover:bg-red-100 cursor-pointer flex items-center justify-center min-w-0"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                    </button>
                  </div>

                  {selectedSectionFill != null && (
                    <div className="rounded-xl border border-gray-200 bg-[#fafbfd] px-3 py-2.5 min-w-0">
                      <div className="flex flex-nowrap items-center gap-2 min-w-0">
                        <p style={F} className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/45 shrink-0">
                          Skupina (náhled)
                        </p>
                        <p
                          style={F}
                          className="text-[10px] leading-snug text-[#001161]/45 min-w-0 flex-1 truncate"
                          title="Platí pro celou skupinu okolo vybraného bloku. Karta = bílý panel, bez pozadí = obsah přímo na barvě sloupce."
                        >
                          Platí pro celou skupinu okolo vybraného bloku. Karta = bílý panel, bez pozadí = obsah přímo na barvě sloupce.
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateSelectedSectionFill('card')}
                            title="Karta — bílý panel ve skupině"
                            aria-label="Skupina jako karta"
                            className={`rounded-xl border px-2.5 py-2 cursor-pointer transition-colors flex items-center justify-center ${
                              selectedSectionFill === 'card'
                                ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                                : 'border-gray-200 bg-white text-[#001161] hover:bg-gray-50'
                            }`}
                          >
                            <SquareStack className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedSectionFill('plain')}
                            title="Bez pozadí — obsah přímo na barvě sloupce"
                            aria-label="Skupina bez pozadí karty"
                            className={`rounded-xl border px-2.5 py-2 cursor-pointer transition-colors flex items-center justify-center ${
                              selectedSectionFill === 'plain'
                                ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                                : 'border-gray-200 bg-white text-[#001161] hover:bg-gray-50'
                            }`}
                          >
                            <SquareDashed className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'product-collage' && (
                    <EmailProductCollagePanel
                      key={selectedBlock.id}
                      blockId={selectedBlock.id}
                      getSnapshot={() => {
                        const doc = previewIframeRef.current?.contentDocument;
                        const el = doc?.querySelector(
                          `[data-vb-block-id="${CSS.escape(selectedBlock.id)}"]`,
                        );
                        return readProductCollageStateFromElement(el);
                      }}
                      onLiveUpdate={handleProductCollageLive}
                    />
                  )}

                  {selectedBlock.type === 'webinar' && (
                    <EmailWebinarPanel
                      key={selectedBlock.id}
                      blockId={selectedBlock.id}
                      getSnapshot={() => {
                        const doc = previewIframeRef.current?.contentDocument;
                        const el = doc?.querySelector(
                          `[data-vb-block-id="${CSS.escape(selectedBlock.id)}"]`,
                        );
                        return readWebinarStateFromElement(el);
                      }}
                      onLiveUpdate={handleWebinarLive}
                    />
                  )}

                  {selectedBlock.type !== 'section' &&
                    selectedBlock.type !== 'product-collage' &&
                    selectedBlock.type !== 'webinar' && (
                    <>
                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">Background</label>
                        <input
                          type="color"
                          defaultValue={selectedBlock.background && selectedBlock.background.startsWith('#') ? selectedBlock.background : '#ffffff'}
                          onChange={e => updateSelectedBlockStyle('background-color', e.target.value)}
                          className="h-10 w-full rounded-lg border border-gray-200 bg-white cursor-pointer"
                        />
                      </div>

                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">Padding</label>
                        <input
                          type="text"
                          defaultValue={selectedBlock.padding}
                          onBlur={e => updateSelectedBlockStyle('padding', e.target.value)}
                          placeholder="např. 18px 0"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                          style={F}
                        />
                      </div>

                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">Zarovnání</label>
                        <select
                          defaultValue={selectedBlock.textAlign || ''}
                          onChange={e => updateSelectedBlockStyle('text-align', e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-[#001161] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                          style={F}
                        >
                          <option value="">Výchozí</option>
                          <option value="left">Doleva</option>
                          <option value="center">Na střed</option>
                          <option value="right">Doprava</option>
                        </select>
                      </div>
                    </>
                  )}

                  {selectedBlock.ctaUrl && (
                    <>
                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">Text tlačítka</label>
                        <input
                          type="text"
                          defaultValue={selectedBlock.ctaText}
                          onBlur={e => updateSelectedBlockLink('text', e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                          style={F}
                        />
                      </div>
                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">URL tlačítka</label>
                        <input
                          type="text"
                          defaultValue={selectedBlock.ctaUrl}
                          onBlur={e => updateSelectedBlockLink('href', e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] font-mono text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                        />
                      </div>
                    </>
                  )}

                  {selectedBlock.imageSrc && (
                    <>
                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">URL obrázku</label>
                        <input
                          type="text"
                          defaultValue={selectedBlock.imageSrc}
                          onBlur={e => updateSelectedBlockImage(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] font-mono text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setImageToolSrc(selectedBlock.imageSrc)}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-bold text-[#001161] hover:bg-gray-50 cursor-pointer"
                          style={F}
                        >
                          Upravit obrázek
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingImgSrc(selectedBlock.imageSrc);
                            setCollageOpen(true);
                          }}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-bold text-[#001161] hover:bg-gray-50 cursor-pointer"
                          style={F}
                        >
                          Nahradit koláží
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-[#fafbfd] px-3 py-4">
                  <p style={F} className="text-[12px] text-[#001161]/50 leading-5">
                    Klikněte v náhledu do některého bloku. Potom tady půjde měnit pozadí, padding, CTA nebo obrázek.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="shrink-0 border-b border-gray-100 bg-white flex flex-col">
          <div className="h-12 flex items-center px-4 gap-2">
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

                {autoSaveHint && (
                  <span className="text-[10px] text-[#001161]/45 shrink-0 hidden sm:inline" style={F}>
                    Uloženo automaticky
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => saveDraft()}
                  disabled={saving}
                  title="Ruční uložení — změny se ukládají i automaticky po chvíli nečinnosti"
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

          {selected && activeBuilderMode === 'block' && !showInboxChrome && (
            <div
              className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-4 py-3 border-t border-gray-100 bg-[#fafbfd]/80 overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300"
              title="Formátování textu v náhledu"
            >
              <EmailRichTextToolbar
                embeddedInHeader
                iframeRef={previewIframeRef}
                refreshEpoch={richToolbarEpoch}
                bumpToolbar={bumpRichToolbar}
              />
            </div>
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
                    className="w-full overflow-hidden flex flex-col flex-1 min-h-0"
                    style={{
                      backgroundColor: 'transparent',
                    }}
                  >
                    {showInboxChrome && (
                      <div
                        className="px-5 py-4 border-b border-gray-100 bg-white rounded-t-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                      >
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
                                  const updated = normalizeDraftForBuilder({
                                    ...selected,
                                    previewOuterBg: DEFAULT_PREVIEW_OUTER_BG,
                                    previewColumnBg: DEFAULT_PREVIEW_COLUMN_BG,
                                    updatedAt: new Date().toISOString(),
                                  });
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
                        outerBackground={normalizeHexColor(selected.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG)}
                        builderMode={activeBuilderMode}
                        selectedBlockId={selectedBlock?.id || null}
                        onBodyChange={applyIframeBodyHtml}
                        onImageClick={setImageToolSrc}
                        onBlockSelect={handleBlockSelect}
                        hasMailboxStackAbove={showInboxChrome}
                        readOnlyBody={showInboxChrome}
                        iframeRef={previewIframeRef}
                        onTextSelect={handleIframeTextSelect}
                        hoverBlockRef={iframeHoverBlockRef}
                        onHoverBlockChrome={handleHoverBlockChrome}
                        onIframeLeave={scheduleInsertLineHide}
                        onIframeEnter={cancelInsertLineHide}
                        onRichTextActivity={bumpRichToolbar}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

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
          pendingInsertBeforeBlockIdRef.current = null;
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
          const beforeId = pendingInsertBeforeBlockIdRef.current;
          if (beforeId) {
            pendingInsertBeforeBlockIdRef.current = null;
            insertHtmlBeforeBlockById(beforeId, imgTag);
          } else {
            insertHtmlAfterAnchorOrAppend(imgTag);
          }
          setAssetPickerOpen(false);
        }}
      />

      <CollageModal
        open={collageOpen}
        onClose={() => {
          clearPendingInsertAnchor();
          pendingInsertBeforeBlockIdRef.current = null;
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
