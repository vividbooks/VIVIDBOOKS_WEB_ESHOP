import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router';
import {
  Mail, Plus, Trash2, Save, Send, Loader2,
  CopyPlus, ClipboardCopy, ClipboardPaste, ExternalLink, X,
  Sparkles, Brain,
  PanelLeftClose, PanelLeftOpen,
  ArrowUp, ArrowLeft, ChevronUp, ChevronDown, Settings2, MousePointerClick, TextCursor,
  Layers, Code, ImageIcon, Video, Undo2, Redo2, LayoutTemplate,
  AlignLeft, AlignCenter, AlignRight, Minus, RectangleHorizontal, Columns2, Columns3, PanelTop, ShoppingBag,
  ArrowDown, SquareDashed,
  SquareStack,
  Upload,
  GripVertical,
  BetweenVerticalStart,
  Bold, Italic, Underline, Strikethrough, Link2, Unlink, List, ListOrdered,
  SpellCheck,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../utils/supabase/info';
import { fetchWithAdminAuth, getRequiredEdgeFunctionHeaders } from '../../lib/edgeFunctionHeaders';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
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
import { EmailImageCropPanel } from './EmailImageCropPanel';
import { EmailAssetPickerModal } from './EmailAssetPickerModal';
import { buildEmailProductImagesTableHtml } from './collageUtils';
import { EmailPreviewBgColorField, VividbooksColorButton } from './VividbooksColorButton';
import { hydrateEmailAiEditorBlocks } from './emailAiBlockHydrate';
import {
  EMAIL_BUILDER_AI_TIER_KEY,
  type EmailAiTier,
  fetchGenerateEmailWithRetry,
  geminiErrorLooksOverloaded,
  getStoredEmailAiTier,
} from '../../utils/emailAiTier';
import { previewCtaUrl, productsUrl, publicSiteUrl } from '../../utils/publicSiteUrl';
import {
  EMAIL_BLOCK_PRESETS,
  type EmailBlockPreset,
  type EmailBlockType,
  type EmailBuilderMode,
  type EmailSectionFill,
  buildEmailBlockHtml,
  buildEmailSectionHtml,
  type EmailBlockGroupState,
  ensureRowIsSection,
  extractFirstImage,
  extractFirstLink,
  findDndBlockFromDragTarget,
  findSelectableEmailBlock,
  ensureEmailColumnUnits,
  ensureColumnUnitAtTarget,
  findEmailBlockById,
  getColumnsHostForBlock,
  isEmailColumnUnit,
  getEmailGroupRow,
  getHostSectionForBlock,
  findTextBlockLibraryDropSplitIndex,
  findTopLevelTextBlockHostForDrop,
  getEmailBlockLabel,
  getTextBlockElementChildren,
  inferEmailBlockType,
  isDndReorderableEmailBlock,
  groupEmailBlocksIntoSection,
  isolateEmailBlockGroup,
  moveEmailBlockNode,
  moveEmailBlockBeforeTarget,
  setEmailBlockColumns,
  readEmailBlockColumns,
  readElementHasShadow,
  parseBlockPadding,
  formatBlockPadding,
  EMAIL_BLOCK_SHADOW,
  fillEmailColumnChooser,
  buildColumnChooserHtml,
  type EmailBlockColumnCount,
  type EmailColumnContentKind,
  type EmailSectionChrome,
  type EmailHighlightChrome,
  normalizeEmailBodyHtml,
  randomBlockId,
  readElementBackground,
  readElementPadding,
  readEmailBlockGroupState,
  readHighlightChrome,
  applySectionChrome,
  applyHighlightChrome,
  setInlineStyleValue,
  wrapRootBlockInSection,
} from './emailBlocks';
import { compileEmailBodyForSend } from './emailExport';
import { serializeEmailBodyToOutline } from './emailOutlineSerialize';
import {
  applyProofreadCorrections,
  chunkProofreadSegments,
  collectProofreadSegments,
  promptLooksLikeWholeEmailProofread,
  type ProofreadSegment,
} from './emailProofread';
import {
  isFirstGradeTagName,
  isWebinarTagName,
  MAILING_SOURCE_OPTIONS,
  MAILING_SUBJECT_OPTIONS,
  summarizeAudienceFilter,
  toggleId,
  type MailingAudienceFilter,
} from '../../lib/mailingAudienceFilter';
import { WEBINAR_AUDIENCE_DEFS } from '../../lib/webinarAudienceClassify';

/** Přetahování typu bloku z knihovny do iframe náhledu (HTML5 DnD). */
const VB_EMAIL_LIBRARY_DRAG_TYPE = 'application/x-vb-email-block-type';
/** Přesun existujícího bloku z úchytu v postranní liště (parent → iframe). */
const VB_EMAIL_BLOCK_MOVE_DRAG_TYPE = 'application/x-vb-email-block-move-id';
/** Některé prohlížeče neukážou vlastní MIME v dragover uvnitř iframe — držíme id během gesta. */
let vbEmailActiveBlockMoveId: string | null = null;
/** Rozšířená „magnetická“ zóna kolem bloku pro plovoucí lištu (iframe + most k panelu v parent okně). */
const EMAIL_BLOCK_CHROME_HIT_PADDING_PX = 100;
const EMAIL_PRESET_TYPE_SET = new Set<EmailBlockType>(EMAIL_BLOCK_PRESETS.map((p) => p.type));

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
/** Admin mailing endpointy vyžadují user JWT (X-User-Access-Token) — viz admin-auth.ts na serveru. */
const authHeaders = () => getRequiredEdgeFunctionHeaders(true);
const authHeadersNoCt = () => getRequiredEdgeFunctionHeaders(false);
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
  /** ID kampaně ve vlastním mailingu (Postgres `campaigns`) — vazba draft ↔ kampaň. */
  mailingCampaignId?: string;
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
  ctaText: 'Vyzkoušejte zdarma', ctaUrl: previewCtaUrl(),
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
  /** Šířka <img> v % rodiče (10–100). */
  imageWidthPct: number;
}

function normalizeDraftForBuilder(draft: EmailDraft): EmailDraft {
  const legacy = draft as EmailDraft & { previewIslandLayout?: boolean };
  const { previewIslandLayout: _legacyIsland, ...rest } = legacy;
  const bodyHtml = normalizeEmailBodyHtml(draft.bodyHtml || '');
  const ctaUrl = draft.ctaUrl || previewCtaUrl();
  return {
    ...rest,
    bodyHtml,
    ctaUrl,
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


function readImageWidthPct(img: HTMLImageElement | null | undefined): number {
  if (!img) return 100;
  const styleW = (img.style.width || '').trim();
  const pct = styleW.match(/^(\d+(?:\.\d+)?)%$/);
  if (pct) {
    const n = Math.round(Number(pct[1]));
    if (Number.isFinite(n)) return Math.max(10, Math.min(100, n));
  }
  const attrW = (img.getAttribute('width') || '').trim();
  if (attrW.endsWith('%')) {
    const n = Math.round(Number(attrW.slice(0, -1)));
    if (Number.isFinite(n)) return Math.max(10, Math.min(100, n));
  }
  return 100;
}

function applyImageWidthPct(img: HTMLImageElement, pct: number) {
  const safe = Math.max(10, Math.min(100, Math.round(pct)));
  img.style.width = `${safe}%`;
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.removeAttribute('width');
  img.removeAttribute('height');
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
    imageWidthPct: skipLinkImageInspector ? 100 : readImageWidthPct(image),
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

function getBlockOuterHtmlForAiByBlockId(
  doc: Document | null | undefined,
  blockId: string | null,
  opts?: { maxLen?: number },
): string {
  if (!doc?.body || !blockId) return '';
  const el = doc.querySelector(`[data-vb-block-id="${CSS.escape(blockId)}"]`);
  if (!el || !doc.body.contains(el)) return '';
  let html = (el as HTMLElement).outerHTML;
  const maxLen = opts?.maxLen ?? 12000;
  if (html.length > maxLen) html = `${html.slice(0, maxLen)}…`;
  return html;
}

/** Fragment bodyHtml → Document (pro chirurgickou výměnu jednoho bloku). */
function parseEmailBodyHtmlDoc(html: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html || ''}</body></html>`,
    'text/html',
  );
}

/** Najde outerHTML bloku podle data-vb-block-id v libovolném HTML (odpověď AI / draft). */
function extractBlockOuterHtmlFromBodyHtml(html: string, blockId: string): string | null {
  if (!html || !blockId) return null;
  try {
    const doc = parseEmailBodyHtmlDoc(html);
    const el = doc.querySelector(`[data-vb-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null;
    return el?.outerHTML || null;
  } catch {
    return null;
  }
}

function listImgSrcsInHtml(html: string): string[] {
  try {
    const doc = parseEmailBodyHtmlDoc(html || '');
    return [...doc.querySelectorAll('img[src]')]
      .map((img) => (img.getAttribute('src') || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function imgSrcPresentInHtml(html: string, src: string): boolean {
  const needles = listImgSrcsInHtml(html);
  return needles.some((n) => imgAttributeSrcMatchesRef(n, src));
}

/** Uživatel výslovně chce smazat / přegenerovat včetně rizik ztráty fotek. */
function promptAllowsDestructiveAssetChange(msg: string): boolean {
  return /smaž|odstra[nň]|odeber|vymaž|bez\s+(foto|obr[aá]zk)|remove\s+(the\s+)?(image|photo|foto)|delete\s+(the\s+)?(image|photo)|p[rř]egeneruj\s+cel|cel[ýy]\s+mail\s+znovu|od\s+za[cč][aá]tku|kompletně\s+nov/i.test(
    msg || '',
  );
}

function promptWantsFullEmailRewrite(msg: string): boolean {
  return /p[rř]egeneruj|cel[ýy]\s+(mail|e-?mail|newsletter)|od\s+za[cč][aá]tku|kompletně\s+nov|nov[ýy]\s+(cel[ýy]\s+)?(mail|e-?mail)|rewrite\s+(the\s+)?(whole|entire)/i.test(
    msg || '',
  );
}

/** Uživatel chce přidat/vložit obsah — ne přepsat celý mail (guardrail nesmí hard-rejectnout). */
function promptWantsAdditiveBlockInsert(msg: string): boolean {
  const m = msg || '';
  // „a ještě … dej blok“, „přidej“, „vlož za …“, „doplň sekci“…
  return (
    /\b(p[rř]idej|vlo[zž]|dopl[nň])\b/i.test(m) ||
    /\bdej\s+(tam\s+)?(blok|sekci|odstavec|kartu|obsah)\b/i.test(m) ||
    /\b(nov[ýy]\s+blok|novou\s+sekci|na konec|na za[cč][aá]tek)\b/i.test(m) ||
    /\bza\s+.+\s+(dej|p[rř]idej|vlo[zž])\b/i.test(m)
  );
}

function promptLooksLikeScopedBlockEdit(msg: string): boolean {
  if (promptWantsFullEmailRewrite(msg)) return false;
  if (promptWantsAdditiveBlockInsert(msg)) return false;
  // Krátké úpravy / stylizace — typicky na zvolený blok
  return (
    (msg || '').trim().length <= 280 ||
    /uprav|zm[eě][nň]|p[rř]epi[sš]|zkra[tť]|roz[sš]i[rř]|oprav|ud[eě]lej|leh[cč]|form[aá]ln|neform|vtipn|jinak|p[rř]elo[zž]/i.test(
      msg || '',
    )
  );
}

/** Shrnutí top-level sekcí pro AI (aby je nevracela znovu). */
function listEmailSectionSummariesForAi(html: string, max = 12): string {
  try {
    const doc = parseEmailBodyHtmlDoc(html || '');
    const root = (doc.querySelector('.vb-email-root') as HTMLElement | null) || doc.body;
    const sections = [
      ...root.querySelectorAll(
        ':scope > [data-vb-block="section"], :scope > [data-vb-block-id], :scope > [data-vb-block]',
      ),
    ] as HTMLElement[];
    return sections
      .slice(0, max)
      .map((el, i) => {
        const id = el.getAttribute('data-vb-block-id') || '';
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90);
        return `${i + 1}. id=${id || '?'} „${t}${t.length >= 90 ? '…' : ''}“`;
      })
      .join('\n');
  } catch {
    return '';
  }
}

function reassignAllBlockIds(root: ParentNode): void {
  for (const el of root.querySelectorAll('[data-vb-block-id]')) {
    el.setAttribute('data-vb-block-id', randomBlockId());
  }
}

function findInsertAnchorInRoot(origRoot: HTMLElement, userMsg: string): HTMLElement | null {
  const afterMatch = userMsg.match(
    /za\s+(?:novou?\s+|t[ií]mto?\s+|tímto?\s+|blok(?:em)?\s+)?(.{2,80}?)(?:\s*[-–—:,]|\s+dej\b|\s+blok\b|\s+kde\b|$)/i,
  );
  const hintRaw = (afterMatch?.[1] || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const hints = [hintRaw, 'novou aplikaci', 'nová aplikace', 'aplikace', 'vividbooks']
    .map((h) => h.replace(/[„“"']/g, '').trim())
    .filter((h) => h.length >= 4);

  const sections = [
    ...origRoot.querySelectorAll(
      ':scope > [data-vb-block="section"], :scope > [data-vb-block-id], :scope > [data-vb-block]',
    ),
  ] as HTMLElement[];

  for (const h of hints) {
    const found = [...sections].reverse().find((sec) =>
      (sec.textContent || '').toLowerCase().includes(h),
    );
    if (found) return found;
  }
  return sections.length ? sections[sections.length - 1] : null;
}

/**
 * Přidání bloku: základ = originalHtml (fotky beze změny).
 * Z AI vezmeme fragment (ne celý mail) a vložíme za kotvu z pokynu.
 */
function mergeAdditiveAiBlocksIntoOriginal(
  originalHtml: string,
  aiBodyHtml: string,
  userMsg: string,
): { html: string; ok: true; inserted: number } | { html: string; ok: false; reason: string } {
  try {
    const origDoc = parseEmailBodyHtmlDoc(originalHtml || '');
    const aiDoc = parseEmailBodyHtmlDoc(aiBodyHtml || '');
    const origRoot =
      (origDoc.querySelector('.vb-email-root') as HTMLElement | null) || origDoc.body;
    const aiRoot = (aiDoc.querySelector('.vb-email-root') as HTMLElement | null) || aiDoc.body;

    const origIds = new Set(
      [...origRoot.querySelectorAll('[data-vb-block-id]')]
        .map((el) => el.getAttribute('data-vb-block-id') || '')
        .filter(Boolean),
    );
    const origTextNorm = (origRoot.textContent || '').replace(/\s+/g, ' ').toLowerCase();
    const origTopCount = origRoot.querySelectorAll(
      ':scope > [data-vb-block="section"], :scope > [data-vb-block-id], :scope > [data-vb-block]',
    ).length;

    let topCandidates = [
      ...aiRoot.querySelectorAll(
        ':scope > [data-vb-block="section"], :scope > [data-vb-block-id], :scope > [data-vb-block]',
      ),
    ] as HTMLElement[];

    // AI vrátila holé HTML bez builder bloků → zabal do sekce.
    if (topCandidates.length === 0) {
      const raw = (aiRoot.innerHTML || '').trim();
      if (raw.length < 20) return { html: originalHtml, ok: false, reason: 'empty-ai' };
      const wrapped = wrapRootBlockInSection(
        `<div data-vb-block="text" data-vb-block-id="${randomBlockId()}" style="padding:10px 24px;background-color:transparent;">${raw}</div>`,
        'card',
      );
      const tmp = origDoc.createElement('div');
      tmp.innerHTML = wrapped;
      topCandidates = [...tmp.children] as HTMLElement[];
    }

    const aiTopCount = topCandidates.length;
    const aiLen = (aiRoot.textContent || '').replace(/\s+/g, ' ').trim().length;
    const origLen = Math.max(1, origTextNorm.length);
    /** Krátká odpověď / málo sekcí = fragment, ne celý mail. */
    const looksLikeFragment = aiTopCount <= 3 || aiLen < origLen * 0.55 || aiTopCount < origTopCount;

    const topicBits = (userMsg.match(
      /katalog|sešit|učebnic|školní\s+rok|příští|objedn|produk|písank|matemat|aplikac/gi,
    ) || []).map((s) => s.toLowerCase());

    let toInsert = topCandidates.filter((el) => {
      const id = el.getAttribute('data-vb-block-id') || '';
      if (id && origIds.has(id) && !looksLikeFragment) return false;
      const innerIds = [...el.querySelectorAll('[data-vb-block-id]')]
        .map((n) => n.getAttribute('data-vb-block-id') || '')
        .filter(Boolean);
      if (!looksLikeFragment && innerIds.length > 0 && innerIds.every((i) => origIds.has(i))) {
        return false;
      }
      const sample = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (sample.length < 12) return true;
      const needle = sample.slice(0, Math.min(96, sample.length)).toLowerCase();
      const already = origTextNorm.includes(needle);
      if (!already) return true;
      // Stejný začátek textu, ale téma z pokynu (katalog…) — pořád vložit jako nový blok.
      if (topicBits.some((t) => sample.toLowerCase().includes(t))) return true;
      return false;
    });

    // Fragment: když filtr nic nenechal, vezmi celou AI odpověď jako nové sekce.
    if (toInsert.length === 0 && looksLikeFragment) {
      toInsert = topCandidates;
    }

    // Poslední fallback: najdi v AI jakýkoli uzel s tématem z pokynu a zabal.
    if (toInsert.length === 0 && topicBits.length > 0) {
      const hit = [...aiRoot.querySelectorAll('[data-vb-block="section"], [data-vb-block-id], p, div')].find(
        (el) => {
          const t = (el.textContent || '').toLowerCase();
          return topicBits.some((b) => t.includes(b)) && t.replace(/\s+/g, ' ').trim().length > 40;
        },
      ) as HTMLElement | undefined;
      if (hit) {
        const outer =
          (hit.closest('[data-vb-block="section"]') as HTMLElement | null) || hit;
        const clone = outer.cloneNode(true) as HTMLElement;
        if (clone.getAttribute('data-vb-block') !== 'section') {
          const wrap = origDoc.createElement('div');
          wrap.innerHTML = wrapRootBlockInSection(clone.outerHTML, 'card');
          toInsert = [...wrap.children] as HTMLElement[];
        } else {
          toInsert = [clone];
        }
      }
    }

    if (toInsert.length === 0) {
      return { html: originalHtml, ok: false, reason: 'no-new-blocks' };
    }

    const anchor = findInsertAnchorInRoot(origRoot, userMsg);
    const imports = toInsert.map((n) => {
      const node = origDoc.importNode(n, true) as HTMLElement;
      reassignAllBlockIds(node);
      if (!node.getAttribute('data-vb-block-id')) {
        node.setAttribute('data-vb-block-id', randomBlockId());
      }
      return node;
    });

    if (anchor?.parentNode) {
      let ref: ChildNode | null = anchor.nextSibling;
      for (const node of imports) {
        anchor.parentNode.insertBefore(node, ref);
        ref = node.nextSibling;
      }
    } else {
      for (const node of imports) origRoot.appendChild(node);
    }

    return { html: origDoc.body.innerHTML, ok: true, inserted: imports.length };
  } catch {
    return { html: originalHtml, ok: false, reason: 'merge-failed' };
  }
}

/**
 * V původním bodyHtml nahradí právě jeden blok (podle id) HTML z AI.
 * Ostatní bloky / subject / struktura zůstávají z originalHtml — model často přepíše celý mail.
 */
function mergeAiEditedBlockIntoBodyHtml(
  originalHtml: string,
  blockId: string,
  aiBodyHtml: string,
  opts?: { userMsg?: string },
): { html: string; ok: true } | { html: string; ok: false; reason: string } {
  if (!blockId) return { html: originalHtml, ok: false, reason: 'missing-block-id' };
  let replacementRaw = extractBlockOuterHtmlFromBodyHtml(aiBodyHtml || '', blockId);
  if (!replacementRaw) {
    const trimmed = String(aiBodyHtml || '').trim();
    const looksLikeWholeMail = /class=["'][^"']*vb-email-root|data-vb-block=["']hero["']/i.test(trimmed);
    if (trimmed && !looksLikeWholeMail && trimmed.length < 40_000) {
      replacementRaw = trimmed;
    }
  }
  if (!replacementRaw) {
    return { html: originalHtml, ok: false, reason: 'block-missing-in-ai-response' };
  }
  try {
    const doc = parseEmailBodyHtmlDoc(originalHtml || '');
    const target = doc.querySelector(`[data-vb-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null;
    if (!target) return { html: originalHtml, ok: false, reason: 'block-missing-in-original' };

    const tmp = doc.createElement('div');
    tmp.innerHTML = replacementRaw;
    let next =
      (tmp.querySelector(`[data-vb-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null) ||
      (tmp.firstElementChild as HTMLElement | null);
    if (!next) return { html: originalHtml, ok: false, reason: 'invalid-replacement' };

    const origImgs = [...target.querySelectorAll('img[src]')];
    const nextImgs = [...next.querySelectorAll('img[src]')];
    if (
      origImgs.length > 0 &&
      nextImgs.length < origImgs.length &&
      !promptAllowsDestructiveAssetChange(opts?.userMsg || '')
    ) {
      return { html: originalHtml, ok: false, reason: 'would-drop-block-images' };
    }

    // Vždy zachovej původní id — AI ho občas přepíše.
    next.setAttribute('data-vb-block-id', blockId);
    if (!next.getAttribute('data-vb-block')) {
      const prevType = target.getAttribute('data-vb-block');
      if (prevType) next.setAttribute('data-vb-block', prevType);
    }
    target.replaceWith(next);
    return { html: doc.body.innerHTML, ok: true };
  } catch {
    return { html: originalHtml, ok: false, reason: 'merge-failed' };
  }
}

/** Vloží AI fragment před/za kotvu — model nesmí vracet celý mail. */
function insertAiFragmentRelativeToBlock(
  originalHtml: string,
  aiBodyHtml: string,
  opts: { beforeBlockId?: string | null; afterInsertAttr?: string | null },
): { html: string; ok: true; inserted: number } | { html: string; ok: false; reason: string } {
  try {
    const origDoc = parseEmailBodyHtmlDoc(originalHtml || '');
    const origRoot =
      (origDoc.querySelector('.vb-email-root') as HTMLElement | null) || origDoc.body;
    const origTopCount = origRoot.querySelectorAll(
      ':scope > [data-vb-block="section"], :scope > [data-vb-block-id], :scope > [data-vb-block]',
    ).length;

    const aiDoc = parseEmailBodyHtmlDoc(aiBodyHtml || '');
    const aiRoot = (aiDoc.querySelector('.vb-email-root') as HTMLElement | null) || aiDoc.body;
    let topCandidates = [
      ...aiRoot.querySelectorAll(
        ':scope > [data-vb-block="section"], :scope > [data-vb-block-id], :scope > [data-vb-block]',
      ),
    ] as HTMLElement[];
    if (topCandidates.length === 0) {
      const raw = (aiRoot.innerHTML || '').trim();
      if (raw.length < 20) return { html: originalHtml, ok: false, reason: 'empty-ai' };
      const wrapped = wrapRootBlockInSection(
        `<div data-vb-block="text" data-vb-block-id="${randomBlockId()}" style="padding:10px 24px;background-color:transparent;">${raw}</div>`,
        'card',
      );
      const tmp = origDoc.createElement('div');
      tmp.innerHTML = wrapped;
      topCandidates = [...tmp.children] as HTMLElement[];
    }
    if (topCandidates.length >= Math.max(4, origTopCount)) {
      return { html: originalHtml, ok: false, reason: 'looks-like-full-email' };
    }

    let anchor: Element | null = null;
    if (opts.beforeBlockId) {
      anchor = origDoc.querySelector(`[data-vb-block-id="${CSS.escape(opts.beforeBlockId)}"]`);
    } else if (opts.afterInsertAttr) {
      anchor = origDoc.querySelector(`[data-vb-insert="${CSS.escape(opts.afterInsertAttr)}"]`);
    }
    if (!anchor?.parentNode) return { html: originalHtml, ok: false, reason: 'anchor-missing' };

    const imports = topCandidates.map((n) => {
      const node = origDoc.importNode(n, true) as HTMLElement;
      reassignAllBlockIds(node);
      if (!node.getAttribute('data-vb-block-id')) {
        node.setAttribute('data-vb-block-id', randomBlockId());
      }
      return node;
    });

    if (opts.beforeBlockId) {
      for (const node of imports) anchor.parentNode.insertBefore(node, anchor);
    } else {
      let ref: ChildNode | null = anchor.nextSibling;
      for (const node of imports) {
        anchor.parentNode.insertBefore(node, ref);
        ref = node.nextSibling;
      }
    }
    (anchor as HTMLElement).removeAttribute('data-vb-insert');
    return { html: origDoc.body.innerHTML, ok: true, inserted: imports.length };
  } catch {
    return { html: originalHtml, ok: false, reason: 'insert-failed' };
  }
}

/**
 * Když AI v plném přepisu zahodí obrázky / image bloky, vrať chybějící asset-bloky z originálu.
 * Bez výslovného „smaž fotky“ / „přegeneruj celý mail“.
 */
function restoreMissingAssetBlocksFromOriginal(
  originalHtml: string,
  newHtml: string,
  userMsg: string,
): { html: string; restored: number; lostSrcs: string[] } {
  if (promptAllowsDestructiveAssetChange(userMsg)) {
    return { html: newHtml, restored: 0, lostSrcs: [] };
  }
  try {
    const origDoc = parseEmailBodyHtmlDoc(originalHtml || '');
    const newDoc = parseEmailBodyHtmlDoc(newHtml || '');
    const lostSrcs = listImgSrcsInHtml(originalHtml).filter((src) => !imgSrcPresentInHtml(newHtml, src));
    if (lostSrcs.length === 0) return { html: newHtml, restored: 0, lostSrcs: [] };

    const lostSet = new Set(lostSrcs.map((s) => canonicalImageHrefForReplace(s)));
    const candidates = [...origDoc.querySelectorAll('[data-vb-block-id]')].filter((el) => {
      const imgs = [...el.querySelectorAll('img[src]')];
      if (!imgs.length) return false;
      return imgs.some((img) => {
        const src = canonicalImageHrefForReplace(img.getAttribute('src') || '');
        return src && [...lostSet].some((l) => l === src || imgAttributeSrcMatchesRef(l, src));
      });
    }) as HTMLElement[];

    const outermost = candidates.filter(
      (el) => !candidates.some((other) => other !== el && other.contains(el)),
    );

    const root =
      (newDoc.querySelector('.vb-email-root') as HTMLElement | null) || newDoc.body;
    let restored = 0;
    for (const el of outermost) {
      const id = el.getAttribute('data-vb-block-id') || '';
      if (id && newDoc.querySelector(`[data-vb-block-id="${CSS.escape(id)}"]`)) continue;
      // Ještě nějaký img z tohoto bloku v novém HTML? (částečný overlap) — stejně obnov celý blok.
      root.appendChild(newDoc.importNode(el, true));
      restored++;
    }
    return { html: newDoc.body.innerHTML, restored, lostSrcs };
  } catch {
    return { html: newHtml, restored: 0, lostSrcs: [] };
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

/** Kanonická URL pro porovnání (řeší & vs &amp; v serializovaném HTML vs DOM .src). */
function canonicalImageHrefForReplace(u: string): string {
  const s = (u || '').trim();
  if (!s) return '';
  try {
    return new URL(s).href;
  } catch {
    return s;
  }
}

function imgAttributeSrcMatchesRef(htmlSrcAttr: string, oldRef: string): boolean {
  if (!htmlSrcAttr || !oldRef) return false;
  if (htmlSrcAttr === oldRef) return true;
  if (canonicalImageHrefForReplace(htmlSrcAttr) === canonicalImageHrefForReplace(oldRef)) return true;
  const decAmp = (x: string) => x.replace(/&amp;/gi, '&');
  if (decAmp(htmlSrcAttr) === decAmp(oldRef)) return true;
  return false;
}

/** Regex: první <img> s danou `src` — varianty & v URL (uložené HTML vs prohlížeč). */
function replaceFirstImgSrcInHtmlRegex(html: string, oldSrc: string, newSrc: string): string {
  if (!html || !oldSrc || !newSrc) return html;
  const safe = escapeHtmlAttr(newSrc);
  const variants = new Set<string>();
  const add = (s: string) => {
    const t = (s || '').trim();
    if (!t) return;
    variants.add(t);
    variants.add(t.replace(/&/g, '&amp;'));
    variants.add(t.replace(/&amp;/g, '&'));
  };
  add(oldSrc);
  let out = html;
  for (const v of variants) {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(<img[^>]*\\bsrc=["'])${esc}(["'])`, 'i');
    const next = out.replace(re, (_m, a, q) => `${a}${safe}${q}`);
    if (next !== out) return next;
  }
  return out;
}

/**
 * Nahradí `src` jen u prvního <img>, které sedí na `oldRef` (pořadí v HTML).
 * Pro blokový editor preferuj `replaceFirstImgSrcInVbImageBlockById`, pokud znáš `data-vb-block-id`.
 */
function replaceFirstImgSrcInHtml(html: string, oldSrc: string, newSrc: string): string {
  if (!html || !oldSrc || !newSrc) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return replaceFirstImgSrcInHtmlRegex(html, oldSrc, newSrc);
  }
  try {
    const doc = new DOMParser().parseFromString(`<div id="vb-img-repl-first">${html}</div>`, 'text/html');
    const root = doc.querySelector('#vb-img-repl-first');
    if (!root) return replaceFirstImgSrcInHtmlRegex(html, oldSrc, newSrc);
    for (const img of root.querySelectorAll('img')) {
      const attr = img.getAttribute('src') || '';
      if (!attr) continue;
      let hit = imgAttributeSrcMatchesRef(attr, oldSrc);
      if (!hit) {
        try {
          hit = imgAttributeSrcMatchesRef(img.src || '', oldSrc);
        } catch {
          hit = false;
        }
      }
      if (hit) {
        img.setAttribute('src', newSrc);
        return root.innerHTML;
      }
    }
  } catch {
    /* regex fallback */
  }
  return replaceFirstImgSrcInHtmlRegex(html, oldSrc, newSrc);
}

/**
 * Spolehlivá náhrada při dropu — pod ID bloku (preferuj `data-vb-block="image"`, jinak jakýkoli blok s id a `<img>`).
 */
function replaceFirstImgSrcInVbImageBlockById(html: string, imageBlockId: string, newSrc: string): string {
  if (!html || !imageBlockId || !newSrc) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;
  try {
    const doc = new DOMParser().parseFromString(`<div id="vb-img-block-repl">${html}</div>`, 'text/html');
    const wrap = doc.getElementById('vb-img-block-repl');
    if (!wrap) return html;
    const esc = CSS.escape(imageBlockId);
    let block = wrap.querySelector(
      `[data-vb-block="image"][data-vb-block-id="${esc}"]`,
    ) as HTMLElement | null;
    if (!block) {
      const byId = wrap.querySelector(`[data-vb-block-id="${esc}"]`) as HTMLElement | null;
      if (byId?.querySelector('img')) block = byId;
    }
    if (!block) return html;
    const img = block.querySelector('img');
    if (!img) return html;
    img.setAttribute('src', newSrc);
    return wrap.innerHTML;
  } catch {
    return html;
  }
}

function escapeHtmlTextContent(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildInlineCtaHtml(buttonText: string, href: string): string {
  const text = escapeHtmlTextContent((buttonText || '').trim() || 'Další informace');
  let url = (href || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    url = publicSiteUrl(url.startsWith('/') ? url : `/${url}`);
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
  /** Zvýraznění bloků řeší jen `.vb-block-hover` / `.vb-block-selected` — žádné CSS `:hover`, ať se outliny nekříží. */
  const imgEditCss = imageEditMode
    ? `body.vb-img-edit img{cursor:grab}
body.vb-img-edit .vb-email-root [data-vb-block="section"]>[data-vb-block-id],
body.vb-img-edit .vb-email-root>[data-vb-block="section"]{cursor:grab}`
    : '';
  const bodyClass = imageEditMode ? ' class="vb-img-edit"' : '';
  const previewLayoutCss = `
:root{--vb-preview-outer:${outer};--vb-preview-card:${card};}
.vb-email-root .vb-dnd-dragging{opacity:0.45!important;outline:2px dashed #7C3AED!important;outline-offset:-2px!important;}
html,body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
/* Desktop typografie nadpisů (barva zůstává z inline stylů AI/editoru) */
.vb-email-root h1:not(:is([data-email-webinar="true"] *)){margin:0 0 14px 0!important;font-size:26px!important;font-weight:800!important;line-height:1.2!important;}
.vb-email-root h2:not(:is([data-email-webinar="true"] *)){margin:0 0 12px 0!important;font-size:22px!important;font-weight:800!important;line-height:1.25!important;}
.vb-email-root h3:not(:is([data-email-webinar="true"] *)){margin:0 0 10px 0!important;font-size:19px!important;font-weight:700!important;line-height:1.35!important;}
.vb-email-root h4:not(:is([data-email-webinar="true"] *)){margin:0 0 8px 0!important;font-size:16px!important;font-weight:700!important;line-height:1.4!important;}
/*
 * Iframe je vždy vysoký přesně jako obsah (viz syncHeight) a uvnitř se nikdy neroluje —
 * jinak by dokument v iframu sebral kolečko a plátno editoru by se nehýbalo.
 */
html{
  font-family:Arial,Helvetica,sans-serif;background:var(--vb-preview-outer);color-scheme:light;
  height:auto;overflow:hidden;
}
/* Šedé plátno přes celý iframe; padding = aktivní boky pro laso (Mailchimp styl). */
body{
  font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333;
  background:var(--vb-preview-outer);color-scheme:light;-webkit-forced-color-adjust:none;forced-color-adjust:none;
  height:auto;min-height:0;box-sizing:border-box;cursor:crosshair;
  padding:28px 56px 48px;
}
/* Pevný 600px sloupec — nikdy neroztahovat přes plátno. */
html.vb-island-layout .vb-email-root{
  background:transparent!important;
  width:600px!important;
  max-width:100%!important;
  margin-left:auto!important;
  margin-right:auto!important;
  box-sizing:border-box;
  padding:0!important;
  cursor:auto;
}
@media only screen and (max-width:720px){
  body{padding:16px 12px 32px;}
}
/* Bloky uvnitř skupiny — výchozí okraje. Bez !important, aby je nastavení bloku (inline style) přebilo. */
.vb-email-root [data-vb-block="section"]>[data-vb-block-id]:not([data-vb-block="divider"]):not([data-vb-block="flow-break"]){
  box-sizing:border-box;
  padding:16px 8px;
}
/* Text: 24 px boky, 10 px vertikálně */
.vb-email-root [data-vb-block="section"]>[data-vb-block="text"],
.vb-email-root [data-vb-block="text"]{
  padding:10px 24px;
}
.vb-email-root [data-vb-block="section"]>[data-vb-block="divider"]{
  box-sizing:border-box;
  padding:10px 8px;
}
.vb-email-root [data-vb-block="section"]>[data-vb-block="flow-break"]{
  box-sizing:border-box;
  padding:0!important;
  margin:0!important;
}
.vb-email-root [data-vb-block="section"]>[data-vb-block="gap-content"]{
  box-sizing:border-box;
  padding:12px 8px;
}
/* Chrome skupiny = inline style + data-vb-chrome-* na section (ne na vnitřních blocích). */
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]{
  margin-bottom:32px!important;
  overflow:visible;
  box-sizing:border-box;
  padding-left:0!important;
  padding-right:0!important;
  padding-bottom:28px!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]:not([data-vb-chrome-bg]){
  background:var(--vb-preview-card)!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"][data-vb-chrome-border="1"]{
  border:1px solid rgba(0,17,97,0.08)!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"][data-vb-chrome-border="0"],
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]:not([data-vb-chrome-border]){
  border:none!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"][data-vb-chrome-shadow="1"]{
  box-shadow:0 6px 18px rgba(0,17,97,0.10)!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"][data-vb-chrome-shadow="0"],
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]:not([data-vb-chrome-shadow]){
  box-shadow:none!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"],
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"] *{
  text-shadow:none!important;
}
/* Vnitřní bloky NIKDY nemají vlastní kartu — chrome jen skupina (highlight má vnitřní data-vb-highlight-box). */
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block-id]{
  background:transparent!important;
  border:none!important;
  box-shadow:none!important;
  filter:none!important;
  margin-bottom:0!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block-id]:not([data-vb-highlight-bleed="1"]){
  border-radius:0!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block-id]:not(:last-child){
  border-bottom:1px solid rgba(0,17,97,0.06)!important;
}
/* Highlight sám ve skupině = full-bleed (je tím blokem). Boční mezery jen s dalšími bloky. */
html.vb-island-layout .vb-email-root>[data-vb-block="section"]>[data-vb-block="highlight"][data-vb-highlight-bleed="1"],
html.vb-island-layout .vb-email-root>[data-vb-block="section"]>[data-vb-block="highlight"]:only-child{
  padding:0!important;
}
/* Webinář ve skupině s dalšími bloky — odsazení nahoře + po stranách. */
html.vb-island-layout .vb-email-root>[data-vb-block="section"]>[data-vb-block="webinar"][data-vb-webinar-inset="1"],
html.vb-island-layout .vb-email-root>[data-vb-block="section"]>[data-vb-block="webinar"]:not(:only-child){
  padding:18px 22px 12px 22px!important;
  box-sizing:border-box!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"]>[data-vb-block="webinar"]:only-child{
  padding:0!important;
}
html.vb-island-layout .vb-email-root>[data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block="highlight"]:only-child{
  border-bottom:none!important;
}
/* Full-bleed highlight: skupina bez vlastního borderu/stínu — jedno ohraničení na boxu. */
html.vb-island-layout .vb-email-root>[data-vb-block="section"]:has(>[data-vb-highlight-bleed="1"]:only-child){
  border:none!important;
  box-shadow:none!important;
  background:transparent!important;
}
.vb-email-root [data-vb-highlight-box]{
  width:100%;
  max-width:100%;
  box-sizing:border-box;
}
/* Kompaktní webinář: cover vždy vyplní levou půlku (i při změně výšky). */
.vb-email-root [data-vb-block="webinar"][data-vb-wb-layout="compact"] [data-vb-wb-thumb]{
  background-size:cover!important;
  background-position:center center!important;
  background-repeat:no-repeat!important;
  overflow:hidden!important;
  padding:0!important;
  line-height:0!important;
  font-size:0!important;
}
.vb-email-root [data-vb-block="webinar"][data-vb-wb-layout="compact"] [data-vb-wb-thumb] a{
  display:block!important;
  width:100%!important;
  height:100%!important;
  overflow:hidden!important;
}
.vb-email-root [data-vb-block="webinar"][data-vb-wb-layout="compact"] [data-vb-wb-thumb] img{
  display:block!important;
  width:100%!important;
  height:100%!important;
  min-width:100%!important;
  min-height:100%!important;
  object-fit:cover!important;
  object-position:center center!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
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
/* Sloupce z panelu — tabulka se nikdy nesmí roztáhnout přes 600px sloupec. */
.vb-email-root [data-vb-columns]{width:100%!important;table-layout:fixed;border-collapse:collapse;}
.vb-email-root [data-vb-columns] img{max-width:100%;height:auto;}
.vb-email-root [data-vb-col-chooser]{user-select:none;-webkit-user-select:none;}
.vb-email-root [data-vb-col-chooser] button[data-vb-col-choose]:hover{
  border-color:#7C3AED!important;background:#F3F0FF!important;
}
.vb-email-root [data-vb-col-chooser] button[data-vb-col-choose]:hover>span:first-child{
  background:#7C3AED!important;color:#ffffff!important;
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
/* Zvýraznění bloku — jedno pravidlo, vždy uvnitř boxu (venkovní outline ořízne overflow karty). */
.vb-email-root [data-vb-block-id]{position:relative}
.vb-email-root [data-vb-block-id].vb-block-hover:not(.vb-block-selected){
  outline:1px dashed rgba(124,58,237,0.45)!important;
  outline-offset:-2px!important;
  box-shadow:none!important;
}
.vb-email-root [data-vb-block-id].vb-block-selected{
  outline:2px solid #7C3AED!important;
  outline-offset:-2px!important;
  box-shadow:none!important;
}
/* Krajní blok v kartě: rámeček kopíruje zaoblení karty. Full-bleed highlight má vlastní radius z panelu. */
.vb-email-root [data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block-id]:not([data-vb-highlight-bleed="1"]):is(.vb-block-hover,.vb-block-selected):first-child{
  border-top-left-radius:14px!important;
  border-top-right-radius:14px!important;
}
.vb-email-root [data-vb-block="section"][data-vb-section-fill="card"]>[data-vb-block-id]:not([data-vb-highlight-bleed="1"]):is(.vb-block-hover,.vb-block-selected):last-child{
  border-bottom-left-radius:14px!important;
  border-bottom-right-radius:14px!important;
}
`;
  return `<!DOCTYPE html><html${htmlClass} style="color-scheme:light only;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">${fontLinks}<style>
${previewLayoutCss}
${fontLockCss}
pre,code,kbd,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace !important;}
a{color:#7C3AED;}
img{max-width:100%;height:auto;}
${imgEditCss}
@media only screen and (max-width:600px){
  body{font-size:15px!important;line-height:1.65!important;}
  body p:not(:is([data-email-webinar="true"] *)),
  body li:not(:is([data-email-webinar="true"] *)){font-size:15px!important;line-height:1.65!important;}
  body h1:not(:is([data-email-webinar="true"] *)){font-size:26px!important;line-height:1.2!important;}
  body h2:not(:is([data-email-webinar="true"] *)){font-size:22px!important;line-height:1.25!important;}
  body h3:not(:is([data-email-webinar="true"] *)){font-size:19px!important;}
  a.vb-preview-cta{font-size:15px!important;padding:16px 28px!important;line-height:1.2!important;}
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

/** Potomci kromě style/script (stejná logika jako při kontrole prázdné sekce). */
function emailStructuralChildElements(host: HTMLElement): HTMLElement[] {
  return [...host.children].filter(
    (c): c is HTMLElement =>
      c.nodeType === Node.ELEMENT_NODE && !/^(STYLE|SCRIPT)$/i.test(c.tagName),
  );
}

/**
 * Smaže blok v náhledu. Když to byl poslední blok ve `data-vb-block="section"`, smaže i prázdnou sekci —
 * jinak `repairEmptySections` v normalize okamžitě doplní výchozí text a mazání vypadá jako neúspěch.
 * Vrací `data-vb-block-id` pro nový výběr, nebo null.
 */
const VB_AI_REPLACE_ATTR = 'data-vb-ai-replace';

/** Obalí aktuální výběr ve spanu s id — po odpovědi AI se nahradí čistým textem a obal odstraní. */
function tryWrapIframeSelectionForPlainAiReplace(doc: Document): string | null {
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const raw = sel.toString().replace(/\u00a0/g, ' ').trim();
  if (!raw) return null;
  const id = `vb-sel-${crypto.randomUUID().slice(0, 10)}`;
  try {
    const span = doc.createElement('span');
    span.setAttribute(VB_AI_REPLACE_ATTR, id);
    range.surroundContents(span);
    return id;
  } catch {
    return null;
  }
}

/** Odstraní dočasné obaly bez změny textu (při chybě API). */
function unwrapVbAiReplaceMarkers(doc: Document) {
  doc.querySelectorAll(`[${VB_AI_REPLACE_ATTR}]`).forEach((el) => {
    const span = el as HTMLElement;
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  });
}

/** Vloží nahradní čistý text a odstraní span. */
function applyPlainTextInVbAiReplaceMarker(doc: Document, markerId: string, plain: string): boolean {
  const span = doc.querySelector(
    `[${VB_AI_REPLACE_ATTR}="${CSS.escape(markerId)}"]`,
  ) as HTMLElement | null;
  if (!span) return false;
  span.textContent = plain;
  const parent = span.parentNode;
  if (!parent) return false;
  while (span.firstChild) parent.insertBefore(span.firstChild, span);
  parent.removeChild(span);
  return true;
}

function deleteEmailBlockNode(block: HTMLElement, root: HTMLElement): string | null {
  const parent = block.parentElement as HTMLElement | null;
  const nextSibling = block.nextElementSibling as HTMLElement | null;
  const prevSibling = block.previousElementSibling as HTMLElement | null;
  block.remove();

  const rootNonMetaKids = () =>
    [...root.children].filter((el) => !/^(STYLE|SCRIPT)$/i.test((el as HTMLElement).tagName));

  if (parent?.getAttribute('data-vb-block') === 'section' && root.contains(parent)) {
    if (emailStructuralChildElements(parent).length === 0) {
      const secNext = parent.nextElementSibling as HTMLElement | null;
      const secPrev = parent.previousElementSibling as HTMLElement | null;
      parent.remove();
      if (rootNonMetaKids().length === 0) {
        root.insertAdjacentHTML('beforeend', buildEmailSectionHtml('card'));
      }
      const next =
        (secNext?.querySelector('[data-vb-block-id]') as HTMLElement | null) ||
        (() => {
          const nodes = secPrev?.querySelectorAll('[data-vb-block-id]');
          return nodes?.length ? (nodes[nodes.length - 1] as HTMLElement) : null;
        })() ||
        (root.querySelector('[data-vb-block-id]') as HTMLElement | null);
      return next?.getAttribute('data-vb-block-id') || null;
    }
  }

  if (rootNonMetaKids().length === 0) {
    root.insertAdjacentHTML('beforeend', buildEmailSectionHtml('card'));
  }
  const next =
    nextSibling ||
    prevSibling ||
    (root.querySelector('[data-vb-block-id]') as HTMLElement | null);
  return next?.getAttribute('data-vb-block-id') || null;
}

/** Safari/Firefox někdy v dragover nehlásí přesně řetězec `Files` — kontrola items a moz typu. */
function dataTransferMayContainFiles(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false;
  try {
    for (let i = 0; i < dt.types.length; i++) {
      const t = dt.types[i];
      if (t === 'Files' || t === 'application/x-moz-file') return true;
    }
  } catch {
    /* ignore */
  }
  try {
    const { items } = dt;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Soubor z OS vypadá jako obrázek (MIME nebo přípona). */
function fileDropLooksLikeImage(f: File): boolean {
  return (
    (!!f.type && /^image\//i.test(f.type)) ||
    /\.(png|jpe?g|gif|webp|svg|avif|heic|heif|bmp|tif|tiff)(\?[#]?.+)?$/i.test(f.name || '')
  );
}

/**
 * Stejná logika jako uvnitř iframe — použije se při dropu na rodičovském obalu (kvůli konfliktu designMode / iframe).
 * `clientX`/`clientY` = souřadnice vůči viewportu dokumentu iframe (jako `elementFromPoint` uvnitř iframe).
 */
function resolveEmailImageFileDropTargetInDoc(
  doc: Document,
  clientX: number,
  clientY: number,
): { img: HTMLImageElement; imageBlockId: string | null } | null {
  const rootDnd = getEmailDndRoot(doc);
  const hit = doc.elementFromPoint(clientX, clientY);
  if (!hit || !rootDnd.contains(hit)) return null;
  const block = hit.closest?.('[data-vb-block="image"]') as HTMLElement | null;
  if (block && rootDnd.contains(block) && isDndReorderableEmailBlock(block, rootDnd)) {
    const img = block.querySelector('img') as HTMLImageElement | null;
    if (img && block.contains(img)) {
      return { img, imageBlockId: block.getAttribute('data-vb-block-id') };
    }
  }
  const imgLoose = hit.closest?.('img') as HTMLImageElement | null;
  if (imgLoose && rootDnd.contains(imgLoose)) {
    const host = imgLoose.closest('[data-vb-block="image"]') as HTMLElement | null;
    if (host && rootDnd.contains(host) && isDndReorderableEmailBlock(host, rootDnd)) {
      return { img: imgLoose, imageBlockId: host.getAttribute('data-vb-block-id') };
    }
    return { img: imgLoose, imageBlockId: null };
  }
  return null;
}

/**
 * Najdi nejbližší image blok pod kurzorem podle bounding rectů (ne `elementFromPoint`,
 * který může vracet vnitřní `<p>`/text mimo `<img>` a tichá selhání jsou horší než přesné error).
 *
 * `clientX`/`clientY` jsou souřadnice ve viewport iframu (jako kdyby `elementFromPoint` v iframu).
 */
function resolveEmailImageBlockByPoint(
  doc: Document,
  clientX: number,
  clientY: number,
): { img: HTMLImageElement; imageBlockId: string } | null {
  const rootDnd = getEmailDndRoot(doc);
  const blocks = [...rootDnd.querySelectorAll('[data-vb-block="image"]')] as HTMLElement[];
  for (const block of blocks) {
    if (!isDndReorderableEmailBlock(block, rootDnd)) continue;
    const id = block.getAttribute('data-vb-block-id');
    if (!id) continue;
    const img = block.querySelector('img') as HTMLImageElement | null;
    if (!img || !block.contains(img)) continue;
    const r = block.getBoundingClientRect();
    if (
      clientX >= r.left &&
      clientX <= r.right &&
      clientY >= r.top &&
      clientY <= r.bottom
    ) {
      return { img, imageBlockId: id };
    }
  }
  return null;
}

/** Najdi konkrétní image blok podle ID (kontroluje, že je v DnD kořeni a má `<img>`). */
function resolveEmailImageBlockById(
  doc: Document,
  imageBlockId: string,
): { img: HTMLImageElement; imageBlockId: string } | null {
  const rootDnd = getEmailDndRoot(doc);
  const block = doc.querySelector(
    `[data-vb-block="image"][data-vb-block-id="${CSS.escape(imageBlockId)}"]`,
  ) as HTMLElement | null;
  if (!block || !rootDnd.contains(block)) return null;
  if (!isDndReorderableEmailBlock(block, rootDnd)) return null;
  const img = block.querySelector('img') as HTMLImageElement | null;
  if (!img || !block.contains(img)) return null;
  return { img, imageBlockId };
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
  return findSelectableEmailBlock(start, root);
}

function getEmailBlockRectInParentViewport(block: HTMLElement, iframeEl: HTMLIFrameElement) {
  const r = block.getBoundingClientRect();
  const ir = iframeEl.getBoundingClientRect();
  return {
    left: ir.left + r.left,
    top: ir.top + r.top,
    width: r.width,
    height: r.height,
  };
}

/** Blok, který se opravdu přesouvá (u sloupců celý layout, ne jedna buňka). */
function resolveReorderableBlock(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  const host = getColumnsHostForBlock(el) || el;
  if (isDndReorderableEmailBlock(host, root)) return host;
  return findDndBlockFromDragTarget(host, root);
}

function dndSiblingBlocks(parent: HTMLElement): HTMLElement[] {
  return [...parent.children].filter(
    (n): n is HTMLElement => n.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test(n.tagName),
  );
}

/**
 * Kam vložit přetahovaný blok podle Y v iframu.
 * Vrací i linku indikátoru ve viewportu parent okna.
 */
function computeEmailBlockDropTarget(
  iframeEl: HTMLIFrameElement,
  moving: HTMLElement,
  clientX: number,
  clientY: number,
): {
  destParent: HTMLElement;
  insertBefore: HTMLElement | null;
  indicator: { top: number; left: number; width: number };
} | null {
  const doc = iframeEl.contentDocument;
  if (!doc?.body) return null;
  const root = getEmailDndRoot(doc);
  if (!root.contains(moving)) return null;

  const ir = iframeEl.getBoundingClientRect();
  const iframeX = clientX - ir.left;
  const iframeY = clientY - ir.top;
  const hit = doc.elementFromPoint(iframeX, iframeY);
  const targetSectionUnder = hit?.closest?.('[data-vb-block="section"]') as HTMLElement | null;
  const dragParent = moving.parentElement;
  const owningSection = moving.closest('[data-vb-block="section"]') as HTMLElement | null;

  let destParent: HTMLElement = root;
  if (dragParent === root) {
    destParent = root;
  } else if (dragParent?.getAttribute('data-vb-block') === 'section') {
    destParent =
      targetSectionUnder && root.contains(targetSectionUnder) && targetSectionUnder !== moving
        ? targetSectionUnder
        : dragParent;
  } else if (owningSection && root.contains(owningSection)) {
    destParent =
      targetSectionUnder && root.contains(targetSectionUnder) && targetSectionUnder !== moving
        ? targetSectionUnder
        : owningSection;
  }

  let insertBefore: HTMLElement | null = null;
  for (const child of dndSiblingBlocks(destParent)) {
    if (child === moving) continue;
    const r = child.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (iframeY < mid) {
      insertBefore = child;
      break;
    }
  }

  if (insertBefore === moving) return null;
  if (insertBefore && moving.contains(insertBefore)) return null;

  const lineY = insertBefore
    ? insertBefore.getBoundingClientRect().top
    : (() => {
        const kids = dndSiblingBlocks(destParent).filter((c) => c !== moving);
        if (kids.length === 0) return destParent.getBoundingClientRect().top + 8;
        const last = kids[kids.length - 1];
        return last.getBoundingClientRect().bottom;
      })();

  const col = root.getBoundingClientRect();
  return {
    destParent,
    insertBefore,
    indicator: {
      top: ir.top + lineY,
      left: ir.left + col.left,
      width: Math.max(120, col.width),
    },
  };
}

function applyEmailBlockDrop(
  moving: HTMLElement,
  destParent: HTMLElement,
  insertBefore: HTMLElement | null,
): boolean {
  if (insertBefore === moving) return false;
  if (insertBefore && moving.contains(insertBefore)) return false;
  const prevParent = moving.parentElement;
  const prevNext = moving.nextElementSibling;
  try {
    if (insertBefore) destParent.insertBefore(moving, insertBefore);
    else destParent.appendChild(moving);
  } catch {
    return false;
  }
  return prevParent !== moving.parentElement || prevNext !== moving.nextElementSibling;
}

/**
 * Blok pro plovoucí lištu.
 * `clientX/Y` jsou z mouse eventu uvnitř iframe (= viewport iframe), ne parent okna.
 */
function findEmailBlockForChromeAtPoint(
  doc: Document,
  _iframeEl: HTMLIFrameElement,
  clientX: number,
  clientY: number,
  targetEl: Element | null,
  pad: number,
): HTMLElement | null {
  const root = getEmailDndRoot(doc);
  ensureEmailColumnUnits(root);
  // 1) Přímý zásah pod kurzorem — vždy spolehlivější než pad kolem.
  const fromTarget = targetEl ? findTopLevelEmailBlock(targetEl, doc) : null;
  if (fromTarget) return fromTarget;

  // 2) Rozšířený hit-test jen mimo blok (okraj / mezera) — recty v iframe viewportu.
  let best: HTMLElement | null = null;
  let bestArea = Infinity;
  let bestDist = Infinity;
  for (const raw of root.querySelectorAll('[data-vb-block-id]')) {
    const h = raw as HTMLElement;
    const t = h.getAttribute('data-vb-block');
    if (t === 'section') continue;
    if ((t === 'columns-2' || t === 'columns-3') && h.querySelector('[data-vb-col-unit]')) continue;
    const b = h.getBoundingClientRect();
    const left = b.left - pad;
    const right = b.right + pad;
    const top = b.top - pad;
    const bottom = b.bottom + pad;
    if (clientX < left || clientX > right || clientY < top || clientY > bottom) continue;
    const dx = clientX < b.left ? b.left - clientX : clientX > b.right ? clientX - b.right : 0;
    const dy = clientY < b.top ? b.top - clientY : clientY > b.bottom ? clientY - b.bottom : 0;
    const dist = dx * dx + dy * dy;
    const area = Math.max(1, b.width * b.height);
    if (dist < bestDist || (dist === bestDist && area < bestArea)) {
      bestDist = dist;
      bestArea = area;
      best = h;
    }
  }
  return best;
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
  sel.addRange(nr);
}

const HIGHLIGHT_STYLE_KEYS = ['background-color', 'background', 'background-image'] as const;

function stripHighlightStylesFromElement(el: HTMLElement) {
  for (const key of HIGHLIGHT_STYLE_KEYS) {
    el.style.removeProperty(key);
  }
  const styleAttr = el.getAttribute('style');
  if (styleAttr != null && !styleAttr.replace(/;+/g, '').trim()) {
    el.removeAttribute('style');
  }
}

/** Sundá podbarvení textu — ne jen „transparent“ span přes existující highlight. */
function clearTextHighlightInRange(doc: Document, root: HTMLElement, range: Range) {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const hits: HTMLElement[] = [];
  let node = walker.nextNode();
  while (node) {
    const el = node as HTMLElement;
    if (range.intersectsNode(el)) {
      const bg = (el.style.backgroundColor || el.style.background || '').trim();
      const styleAttr = el.getAttribute('style') || '';
      if (
        bg ||
        /background(-color)?\s*:/i.test(styleAttr)
      ) {
        hits.push(el);
      }
    }
    node = walker.nextNode();
  }

  // Speciálně: highlight často sedí na spanu, který celý leží ve výběru
  for (const el of hits) {
    stripHighlightStylesFromElement(el);
  }

  // Fallback přes execCommand (Chrome)
  try {
    doc.execCommand('styleWithCSS', false, 'true');
  } catch { /* ignore */ }
  try {
    const applied = doc.execCommand('hiliteColor', false, 'transparent');
    if (!applied) doc.execCommand('backColor', false, 'transparent');
  } catch { /* ignore */ }

  // Ještě jednou projít výběr — execCommand občas nechá inline background
  const again: HTMLElement[] = [];
  const w2 = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let n2 = w2.nextNode();
  while (n2) {
    const el = n2 as HTMLElement;
    if (range.intersectsNode(el)) {
      const bg = (el.style.backgroundColor || el.style.background || '').trim().toLowerCase();
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        again.push(el);
      }
    }
    n2 = w2.nextNode();
  }
  for (const el of again) stripHighlightStylesFromElement(el);
}

function clearTextHighlightInBlock(block: HTMLElement) {
  const els = [
    block,
    ...block.querySelectorAll<HTMLElement>('[style*="background"]'),
  ];
  for (const el of els) stripHighlightStylesFromElement(el);
}

function rangeBelongsToBlock(range: Range, block: HTMLElement): boolean {
  const start =
    range.startContainer.nodeType === 1
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const end =
    range.endContainer.nodeType === 1
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;
  return !!start && !!end && block.contains(start) && block.contains(end);
}

function applyFontSizeToWholeBlock(block: HTMLElement, px: string) {
  const textHosts = [
    ...block.querySelectorAll(
      'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,dt,dd,address,pre,a,button',
    ),
  ] as HTMLElement[];
  if (textHosts.length === 0) {
    block.style.fontSize = `${px}px`;
    return;
  }
  for (const el of textHosts) el.style.fontSize = `${px}px`;
}

/** Horní lišta formátování (Mailchimp styl) — příkazy vůči `designMode` dokumentu v iframe. */
function EmailRichTextToolbar({
  iframeRef,
  selectedBlockId,
  refreshEpoch,
  bumpToolbar,
  embeddedInHeader,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  selectedBlockId: string | null;
  /** Zvýšit po změně výběru v iframe, aby se přepočet stavu tlačítek. */
  refreshEpoch: number;
  bumpToolbar: () => void;
  /** Kompaktní jednořádková lišta v horním panelu (scroll v rodiči). */
  embeddedInHeader?: boolean;
}) {
  void refreshEpoch;
  const doc = iframeRef.current?.contentDocument;
  const compact = !!embeddedInHeader;
  const savedTextRangeRef = useRef<Range | null>(null);

  const rememberTextSelection = () => {
    const d = iframeRef.current?.contentDocument;
    const root = d ? getEmailDndRoot(d) : null;
    const block = root && selectedBlockId ? findEmailBlockById(root, selectedBlockId) : null;
    const sel = d?.getSelection();
    if (!block || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
      savedTextRangeRef.current = null;
      return;
    }
    const range = sel.getRangeAt(0);
    savedTextRangeRef.current = rangeBelongsToBlock(range, block) ? range.cloneRange() : null;
  };

  /**
   * Nezkolabovaný výběr v označeném bloku = jen vybraný text.
   * Jinak označíme celý aktuální blok, takže lišta mění celý jeho text.
   */
  const prepareToolbarTarget = (): {
    doc: Document;
    win: Window;
    block: HTMLElement;
    textSelection: boolean;
  } | null => {
    const fr = iframeRef.current;
    const d = fr?.contentDocument;
    const w = fr?.contentWindow;
    if (!fr || !d || !w || d.designMode !== 'on' || !selectedBlockId) return null;
    const root = getEmailDndRoot(d);
    const block = findEmailBlockById(root, selectedBlockId);
    if (!block) return null;

    const sel = d.getSelection();
    const current =
      sel && sel.rangeCount > 0 && !sel.isCollapsed && rangeBelongsToBlock(sel.getRangeAt(0), block)
        ? sel.getRangeAt(0).cloneRange()
        : savedTextRangeRef.current &&
            !savedTextRangeRef.current.collapsed &&
            rangeBelongsToBlock(savedTextRangeRef.current, block)
          ? savedTextRangeRef.current.cloneRange()
          : null;

    w.focus();
    const nextSel = d.getSelection();
    nextSel?.removeAllRanges();
    if (current) {
      nextSel?.addRange(current);
      return { doc: d, win: w, block, textSelection: true };
    }

    const whole = d.createRange();
    whole.selectNodeContents(block);
    nextSel?.addRange(whole);
    return { doc: d, win: w, block, textSelection: false };
  };

  const emitToolbarInput = (d: Document, preserveTextSelection: boolean) => {
    try {
      d.body.dispatchEvent(new InputEvent('input', { bubbles: true }));
    } catch {
      d.body.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const sel = d.getSelection();
    if (preserveTextSelection && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedTextRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      if (sel && sel.rangeCount > 0) {
        const end = sel.getRangeAt(0).cloneRange();
        end.collapse(false);
        sel.removeAllRanges();
        sel.addRange(end);
      }
      savedTextRangeRef.current = null;
    }
    bumpToolbar();
  };

  const run = (cmd: string, val?: string) => {
    const target = prepareToolbarTarget();
    if (!target) return;
    const { doc: d } = target;
    try {
      d.execCommand('styleWithCSS', false, 'true');
    } catch { /* ignore */ }
    try {
      const applied =
        val !== undefined ? d.execCommand(cmd, false, val) : d.execCommand(cmd, false);
      if (cmd === 'hiliteColor' && val !== undefined && !applied) {
        d.execCommand('backColor', false, val);
      }
    } catch { /* ignore */ }
    emitToolbarInput(d, target.textSelection);
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
        rememberTextSelection();
        const el = e.target as HTMLElement;
        if (el.closest('select') || el.closest('[aria-haspopup="dialog"]')) return;
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
          if (!px) return;
          const target = prepareToolbarTarget();
          if (!target) return;
          if (target.textSelection) wrapSelectionInStyledSpan(target.doc, 'font-size', `${px}px`);
          else applyFontSizeToWholeBlock(target.block, px);
          emitToolbarInput(target.doc, target.textSelection);
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
      <VividbooksColorButton
        title="Barva textu"
        buttonClassName={`relative flex ${btnSz} cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50`}
        onSelect={color => {
          if (color === 'transparent') {
            const target = prepareToolbarTarget();
            if (!target) return;
            wrapSelectionInStyledSpan(target.doc, 'color', 'inherit');
            emitToolbarInput(target.doc, target.textSelection);
            return;
          }
          run('foreColor', color);
        }}
      >
        <span className={`${compact ? 'text-[11px]' : 'text-[10px]'} font-bold underline decoration-2 underline-offset-2 text-[#001161]`}>A</span>
      </VividbooksColorButton>
      <VividbooksColorButton
        title="Zvýraznění pozadím"
        palette="pastelSolid"
        buttonClassName={`relative flex ${btnSz} cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50`}
        onSelect={color => {
          const target = prepareToolbarTarget();
          if (!target) return;
          if (color === 'transparent') {
            if (target.textSelection) {
              const sel = target.doc.getSelection();
              const range =
                sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
              if (range && !range.collapsed) {
                clearTextHighlightInRange(target.doc, target.block, range);
              } else {
                clearTextHighlightInBlock(target.block);
              }
            } else {
              clearTextHighlightInBlock(target.block);
            }
            emitToolbarInput(target.doc, target.textSelection);
            return;
          }
          // pastelSolid → hex (vč. 0 % průhlednosti = plná barva)
          if (target.textSelection) {
            wrapSelectionInStyledSpan(target.doc, 'background-color', color);
            emitToolbarInput(target.doc, target.textSelection);
            return;
          }
          run('hiliteColor', color);
        }}
      >
        <span className={`rounded-sm border border-gray-300 bg-amber-100 px-0.5 ${compact ? 'text-[10px]' : 'text-[9px]'} font-bold text-[#001161]`}>A</span>
      </VividbooksColorButton>
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
          const url = window.prompt('URL odkazu', 'https://');
          if (!url?.trim()) return;
          const target = prepareToolbarTarget();
          if (!target) return;
          try {
            target.doc.execCommand('createLink', false, url.trim());
          } catch { /* ignore */ }
          emitToolbarInput(target.doc, target.textSelection);
        }}
      >
        <Link2 className={iconSz} strokeWidth={2.2} />
      </button>
    </div>
  );
}

/**
 * Vzhled bloku: padding na sliderech, stín a rozdělení do sloupců.
 * Slidery píšou přes `onPreviewStyle` přímo do náhledu (uložení řeší debounce v iframu) —
 * přestavba dokumentu při každém pixelu tažení by byla nepoužitelná. `onCommitStyle`
 * je pro jednorázová přepnutí, kde na přestavbě nezáleží.
 */
type BlockCornerRadii = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

function readBlockCornerRadii(el: HTMLElement): BlockCornerRadii {
  const shorthand = Number.parseFloat(el.style.borderRadius || '') || 0;
  const read = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(80, parsed)) : shorthand;
  };
  return {
    topLeft: read(el.style.borderTopLeftRadius),
    topRight: read(el.style.borderTopRightRadius),
    bottomRight: read(el.style.borderBottomRightRadius),
    bottomLeft: read(el.style.borderBottomLeftRadius),
  };
}


function EmailImageSizeSlider({
  blockId,
  widthPct,
  onPreview,
  onMarkHistory,
  onCommit,
}: {
  blockId: string;
  widthPct: number;
  onPreview: (pct: number) => void;
  onMarkHistory: () => void;
  onCommit: (pct: number) => void;
}) {
  const [pct, setPct] = useState(() => Math.max(10, Math.min(100, Math.round(widthPct || 100))));
  const draggingRef = useRef(false);

  useEffect(() => {
    setPct(Math.max(10, Math.min(100, Math.round(widthPct || 100))));
  }, [blockId, widthPct]);

  const sliderCls =
    'w-full accent-[#7C3AED] cursor-pointer h-1.5 rounded-full bg-gray-200 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#7C3AED] [&::-webkit-slider-thumb]:cursor-grab';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
          Velikost obrázku
        </label>
        <span style={F} className="text-[10px] font-bold text-[#001161]/50 tabular-nums">
          {pct} %
        </span>
      </div>
      <input
        type="range"
        min={10}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => {
          const next = Number(e.target.value);
          setPct(next);
          if (!draggingRef.current) {
            draggingRef.current = true;
            onMarkHistory();
          }
          onPreview(next);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          onCommit(Number((e.currentTarget as HTMLInputElement).value));
        }}
        onKeyUp={(e) => {
          draggingRef.current = false;
          onCommit(Number((e.currentTarget as HTMLInputElement).value));
        }}
        onBlur={(e) => {
          draggingRef.current = false;
          onCommit(Number((e.currentTarget as HTMLInputElement).value));
        }}
        className={sliderCls}
        aria-label="Šířka obrázku v procentech"
      />
      <p style={F} className="mt-1 text-[10px] text-[#001161]/40 leading-snug">
        Šířka v rámci bloku (10–100 %).
      </p>
    </div>
  );
}

function EmailBlockAppearancePanel({
  blockId,
  padding,
  hasShadow,
  columns,
  cornerRadii,
  onPreviewStyle,
  onCommitStyle,
  onMarkHistory,
  onColumnsChange,
  hideChrome = false,
}: {
  blockId: string;
  padding: string;
  hasShadow: boolean;
  columns: EmailBlockColumnCount;
  cornerRadii: BlockCornerRadii;
  onPreviewStyle: (property: string, value: string) => void;
  onCommitStyle: (property: string, value: string) => void;
  onMarkHistory: () => void;
  onColumnsChange: (count: EmailBlockColumnCount) => void;
  /** Chrome (stín / radius) je na skupině — v panelu bloku schovat. */
  hideChrome?: boolean;
}) {
  const initial = parseBlockPadding(padding);
  const [vertical, setVertical] = useState(initial.vertical);
  const [horizontal, setHorizontal] = useState(initial.horizontal);
  const [radii, setRadii] = useState<BlockCornerRadii>(cornerRadii);
  const [cornersLinked, setCornersLinked] = useState(
    new Set(Object.values(cornerRadii).map(Math.round)).size === 1,
  );
  const [activeCorner, setActiveCorner] = useState<keyof BlockCornerRadii>('topLeft');
  const draggingRef = useRef(false);

  useEffect(() => {
    const next = parseBlockPadding(padding);
    setVertical(next.vertical);
    setHorizontal(next.horizontal);
    setRadii(cornerRadii);
    setCornersLinked(new Set(Object.values(cornerRadii).map(Math.round)).size === 1);
    setActiveCorner('topLeft');
  }, [
    blockId,
    padding,
    cornerRadii.topLeft,
    cornerRadii.topRight,
    cornerRadii.bottomRight,
    cornerRadii.bottomLeft,
  ]);

  /** Do historie se tažení zapíše jen jednou, na začátku — uložení řeší debounce v náhledu. */
  const previewPadding = (v: number, h: number) => {
    if (!draggingRef.current) {
      draggingRef.current = true;
      onMarkHistory();
    }
    onPreviewStyle('padding', formatBlockPadding(v, h));
  };
  const endDrag = () => {
    draggingRef.current = false;
  };

  const cornerProperties: Record<keyof BlockCornerRadii, string> = {
    topLeft: 'border-top-left-radius',
    topRight: 'border-top-right-radius',
    bottomRight: 'border-bottom-right-radius',
    bottomLeft: 'border-bottom-left-radius',
  };
  const previewRadii = (next: BlockCornerRadii) => {
    if (!draggingRef.current) {
      draggingRef.current = true;
      onMarkHistory();
    }
    for (const key of Object.keys(cornerProperties) as Array<keyof BlockCornerRadii>) {
      onPreviewStyle(cornerProperties[key], `${next[key]}px`);
    }
  };
  const setCornerValue = (value: number) => {
    const safe = Math.max(0, Math.min(80, value));
    const next = cornersLinked
      ? { topLeft: safe, topRight: safe, bottomRight: safe, bottomLeft: safe }
      : { ...radii, [activeCorner]: safe };
    setRadii(next);
    previewRadii(next);
  };

  const sliderCls =
    'w-full accent-[#7C3AED] cursor-pointer h-1.5 rounded-full bg-gray-200 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#7C3AED] [&::-webkit-slider-thumb]:cursor-grab';
  const segBtn = (active: boolean) =>
    `flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
      active
        ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
        : 'border-gray-200 bg-white text-[#001161]/70 hover:bg-gray-50'
    }`;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
            Padding
          </label>
          <span style={F} className="text-[10px] font-bold text-[#001161]/50 tabular-nums">
            {Math.round(vertical)} / {Math.round(horizontal)} px
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span style={F} className="w-[52px] shrink-0 text-[10px] text-[#001161]/45">
              svisle
            </span>
            <input
              type="range"
              min={0}
              max={80}
              step={2}
              value={vertical}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVertical(v);
                previewPadding(v, horizontal);
              }}
              onPointerUp={endDrag}
              onKeyUp={endDrag}
              onBlur={endDrag}
              className={sliderCls}
              aria-label="Svislý padding bloku"
            />
          </div>
          <div className="flex items-center gap-2">
            <span style={F} className="w-[52px] shrink-0 text-[10px] text-[#001161]/45">
              po bocích
            </span>
            <input
              type="range"
              min={0}
              max={80}
              step={2}
              value={horizontal}
              onChange={(e) => {
                const h = Number(e.target.value);
                setHorizontal(h);
                previewPadding(vertical, h);
              }}
              onPointerUp={endDrag}
              onKeyUp={endDrag}
              onBlur={endDrag}
              className={sliderCls}
              aria-label="Vodorovný padding bloku"
            />
          </div>
        </div>
      </div>

      {!hideChrome && (
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
            Zakulacení rohů
          </label>
          <span style={F} className="text-[10px] font-bold tabular-nums text-[#001161]/50">
            {Math.round(cornersLinked ? radii.topLeft : radii[activeCorner])} px
          </span>
        </div>
        <div className="mb-2 flex rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
              cornersLinked ? 'bg-white text-[#5139ED] shadow-sm' : 'text-[#001161]/50 hover:text-[#001161]'
            }`}
            onClick={() => {
              if (cornersLinked) return;
              const value = radii[activeCorner];
              const next = { topLeft: value, topRight: value, bottomRight: value, bottomLeft: value };
              setCornersLinked(true);
              setRadii(next);
              onMarkHistory();
              for (const key of Object.keys(cornerProperties) as Array<keyof BlockCornerRadii>) {
                onPreviewStyle(cornerProperties[key], `${value}px`);
              }
            }}
          >
            Všechny rohy
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
              !cornersLinked ? 'bg-white text-[#5139ED] shadow-sm' : 'text-[#001161]/50 hover:text-[#001161]'
            }`}
            onClick={() => setCornersLinked(false)}
          >
            Jednotlivě
          </button>
        </div>
        {!cornersLinked && (
          <div className="mb-2 grid grid-cols-2 gap-1.5 rounded-xl border border-gray-200 bg-gray-50 p-2">
            {([
              ['topLeft', '↖', 'Levý horní roh'],
              ['topRight', '↗', 'Pravý horní roh'],
              ['bottomLeft', '↙', 'Levý dolní roh'],
              ['bottomRight', '↘', 'Pravý dolní roh'],
            ] as const).map(([key, glyph, label]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setActiveCorner(key)}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px] font-bold transition-colors ${
                  activeCorner === key
                    ? 'border-[#5139ED] bg-white text-[#5139ED] shadow-sm'
                    : 'border-transparent bg-white/70 text-[#001161]/50 hover:border-gray-200'
                }`}
              >
                <span className="text-base leading-none">{glyph}</span>
                <span className="tabular-nums">{Math.round(radii[key])} px</span>
              </button>
            ))}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={48}
          step={1}
          value={cornersLinked ? radii.topLeft : radii[activeCorner]}
          onChange={event => setCornerValue(Number(event.target.value))}
          onPointerUp={endDrag}
          onKeyUp={endDrag}
          onBlur={endDrag}
          className={sliderCls}
          aria-label={cornersLinked ? 'Zakulacení všech rohů' : 'Zakulacení vybraného rohu'}
        />
      </div>
      )}

      {!hideChrome && (
      <div className="flex items-center justify-between gap-2">
        <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
          Stín bloku
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={hasShadow}
          onClick={() => onCommitStyle('box-shadow', hasShadow ? '' : EMAIL_BLOCK_SHADOW)}
          title={hasShadow ? 'Vypnout stín bloku' : 'Zapnout stín bloku'}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
            hasShadow ? 'bg-[#7C3AED]' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
              hasShadow ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      )}

      <div>
        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">
          Sloupce
        </label>
        <div className="flex items-center gap-1.5">
          {([1, 2, 3] as EmailBlockColumnCount[]).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onColumnsChange(count)}
              className={segBtn(columns === count)}
              style={F}
              title={
                count === 1
                  ? 'Jeden sloupec'
                  : `Stejný layout jako blok „${count} sloupce“ — obsah zůstane vlevo, další sloupec doplníte`
              }
            >
              {count === 1 ? '1 sloupec' : `${count} sloupce`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type EmailLassoRect = { left: number; top: number; width: number; height: number };

function EmailIframeEditor({
  draftId,
  bodyEditEpoch,
  bodyHtml,
  columnBackground,
  outerBackground,
  builderMode,
  selectedBlockId,
  selectedBlockIds,
  onBodyChange,
  onImageClick,
  onBlockSelect,
  onBlocksSelect,
  onLassoRect,
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
  onImageFileDrop,
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
  selectedBlockIds: string[];
  /** Vždy zapisuj pod `draftId` vlastníka iframe — při přepnutí draftu cleanup nesmí použít už nový `selected`. */
  onBodyChange: (draftId: string, html: string) => void;
  onImageClick: (src: string) => void;
  onBlockSelect?: (block: BlockInspectorState | null, opts?: { additive?: boolean }) => void;
  /** Multi-výběr z lasa (obsahové bloky). */
  onBlocksSelect?: (blocks: BlockInspectorState[]) => void;
  /** Obdélník lasa ve viewportu parent okna (null = skryt). */
  onLassoRect?: (rect: EmailLassoRect | null) => void;
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
  /** Přetažení souboru na blok obrázku — nahrazení přes server (stejně jako galerie). */
  onImageFileDrop?: (file: File, attrSrc: string, resolvedSrc: string, imageBlockId: string | null) => void;
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
  const onBlocksSelectRef = useRef(onBlocksSelect);
  onBlocksSelectRef.current = onBlocksSelect;
  const onLassoRectRef = useRef(onLassoRect);
  onLassoRectRef.current = onLassoRect;
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
  const onImageFileDropRef = useRef(onImageFileDrop);
  onImageFileDropRef.current = onImageFileDrop;

  const columnBgRef = useRef(columnBackground);
  columnBgRef.current = columnBackground;
  const outerBgRef = useRef(outerBackground);
  outerBgRef.current = outerBackground;

  const selectedBlockIdRef = useRef(selectedBlockId);
  selectedBlockIdRef.current = selectedBlockId;
  const selectedBlockIdsRef = useRef(selectedBlockIds);
  selectedBlockIdsRef.current = selectedBlockIds;

  const builderModeRef = useRef(builderMode);
  builderModeRef.current = builderMode;

  /** Aby šlo po změně výběru bloku znovu přepnout draggable bez přerenderu iframe. */
  const applyDraggableAttrsRef = useRef<(() => void) | null>(null);

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

    const rootDndEarly = getEmailDndRoot(d);
    /** Hover značí stejný uzel, jaký by vybral klik — jinak by svítily dva rámečky nad sebou. */
    const setHoverBlockUi = (block: HTMLElement | null) => {
      rootDndEarly.querySelectorAll('.vb-block-hover').forEach((n) => n.classList.remove('vb-block-hover'));
      if (!block || builderModeRef.current !== 'block') return;
      // Uvnitř sloupců hover na jednotku buňky, ne na celý layout.
      const target = findSelectableEmailBlock(block, rootDndEarly) || block;
      target.classList.add('vb-block-hover');
    };

    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingMove: MouseEvent | null = null;
    const flushMove = () => {
      moveTimer = null;
      const e = pendingMove;
      pendingMove = null;
      if (!e) return;
      const t = e.target as Node;
      const el =
        t.nodeType === Node.TEXT_NODE ? (t.parentElement as Element | null) : (t as Element);
      const block = !el
        ? null
        : builderModeRef.current === 'block'
          ? findEmailBlockForChromeAtPoint(
              d,
              fr,
              e.clientX,
              e.clientY,
              el,
              EMAIL_BLOCK_CHROME_HIT_PADDING_PX,
            )
          : findEditableBlock(el, d.body);
      if (hoverBlockRef) hoverBlockRef.current = block;
      setHoverBlockUi(builderModeRef.current === 'block' ? block : null);
      const chromeCb = onHoverBlockChromeRef.current;
      if (!block) {
        chromeCb?.(null);
        return;
      }
      if (chromeCb && builderModeRef.current === 'block') {
        const bid = block.getAttribute('data-vb-block-id');
        if (bid) chromeCb({ ...getEmailBlockRectInParentViewport(block, fr), blockId: bid });
        else chromeCb(null);
      } else {
        chromeCb?.(null);
      }
    };
    const onMove = (e: MouseEvent) => {
      pendingMove = e;
      if (moveTimer) return;
      moveTimer = setTimeout(flushMove, 32);
    };

    const onLeave = () => {
      setHoverBlockUi(null);
      onIframeLeaveRef.current?.();
    };

    const onEnter = () => {
      onIframeEnterRef.current?.();
    };

    /** V náhledu otevřít odkazy v novém panelu (iframe by se jinak přepsal). */
    const onPreviewLinkClick = (e: MouseEvent) => {
      if (!readOnlyBody) return;
      const raw = e.target;
      // Cíl je z iframu — `instanceof Element` z hlavního okna tu neplatí.
      const node = raw as Node | null;
      const el = (node?.nodeType === 1 ? (node as Element) : node?.parentElement) ?? null;
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
    let lastSyncedH = 0;
    /**
     * Iframe drží přesnou výšku obsahu — plátno editoru je pak jediný scroller.
     * Měříme až po layoutu a zapisujeme jen při reálné změně, ať se ResizeObserver nezacyklí.
     */
    const syncHeight = () => {
      const doc = fr.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(
        Math.ceil(doc.documentElement.scrollHeight),
        Math.ceil(doc.body.scrollHeight),
        MIN_H,
      );
      if (Math.abs(h - lastSyncedH) < 2) return;
      lastSyncedH = h;
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

    const rootDnd = rootDndEarly;

    const dndSiblings = (parent: HTMLElement): HTMLElement[] =>
      [...parent.children].filter(
        (n): n is HTMLElement =>
          n.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test(n.tagName),
      );

    const syncSelectedBlockUi = () => {
      rootDnd.querySelectorAll('.vb-block-selected').forEach((n) => n.classList.remove('vb-block-selected'));
      if (builderModeRef.current !== 'block') return;
      const ids = selectedBlockIdsRef.current.length
        ? selectedBlockIdsRef.current
        : selectedBlockIdRef.current
          ? [selectedBlockIdRef.current]
          : [];
      for (const id of ids) {
        if (!id) continue;
        try {
          rootDnd
            .querySelector(`[data-vb-block-id="${CSS.escape(id)}"]`)
            ?.classList.add('vb-block-selected');
        } catch {
          /* ignore invalid id */
        }
      }
    };

    /** Laso nezačíná jen v textu (tam má jít výběr/editace). Všude jinde tah = laso. */
    const isTextEditTarget = (target: EventTarget | null): boolean => {
      if (!target || typeof (target as Node).nodeType !== 'number') return false;
      const node = target as Node;
      if (node.nodeType === Node.TEXT_NODE) return true;
      const el = node.nodeType === 1 ? (node as Element) : null;
      if (!el) return false;
      if (/^(P|SPAN|A|LI|H[1-6]|STRONG|EM|B|I|U|FONT|LABEL|TD|TH)$/i.test(el.tagName)) return true;
      return !!el.closest?.('p, span, a, li, h1, h2, h3, h4, h5, h6, td, th, strong, em, b, i, u');
    };

    const listLassoSelectableBlocks = (): HTMLElement[] =>
      ([...rootDnd.querySelectorAll('[data-vb-block-id]')] as HTMLElement[]).filter((el) => {
        if (el.getAttribute('data-vb-block') === 'section') return false;
        if (isEmailColumnUnit(el)) return true;
        const t = el.getAttribute('data-vb-block');
        // Layout sloupců s jednotkami — laso bere buňky, ne celý řádek.
        if ((t === 'columns-2' || t === 'columns-3') && el.querySelector('[data-vb-col-unit]')) {
          return false;
        }
        // Preferuj přeuspořadatelný obsah; fallback na jakýkoli obsahový blok s id.
        if (isDndReorderableEmailBlock(el, rootDnd)) return true;
        return el.parentElement === rootDnd || !!el.closest('[data-vb-block="section"]');
      });

    const rectsIntersect = (
      a: { left: number; top: number; right: number; bottom: number },
      b: { left: number; top: number; right: number; bottom: number },
    ) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

    /** Bloky se nepřetahují z těla mailu (konflikt s výběrem textu) — jen z úchytu v liště. */
    const applyDraggableAttrs = () => {
      // Migrace: staré 2/3 sloupce bez jednotek buněk → jde je vybrat jednotlivě.
      if (ensureEmailColumnUnits(rootDnd)) {
        schedule();
      }
      rootDnd.querySelectorAll('[data-vb-block-id]').forEach((raw) => {
        (raw as HTMLElement).removeAttribute('draggable');
      });
      rootDnd.querySelectorAll('img').forEach((img) => {
        (img as HTMLElement).setAttribute('draggable', 'false');
      });
    };

    applyDraggableAttrsRef.current = applyDraggableAttrs;

    const findDraggedNode = (target: EventTarget | null): HTMLElement | null => {
      if (!target || typeof (target as Node).nodeType !== 'number') return null;
      const raw = target as Node;
      const el =
        raw.nodeType === Node.TEXT_NODE ? (raw as Text).parentElement : (raw as HTMLElement);
      if (!el || !rootDnd.contains(el)) return null;
      const asImg = el.closest('img');
      if (asImg && rootDnd.contains(asImg) && (el === asImg || asImg.contains(el))) {
        const imgBlock = findDndBlockFromDragTarget(asImg, rootDnd);
        if (imgBlock?.getAttribute('data-vb-block') === 'image') return imgBlock;
        return asImg as HTMLImageElement;
      }
      return findDndBlockFromDragTarget(target, rootDnd);
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

    const onDragEnterDnd = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (vbEmailActiveBlockMoveId) {
        e.preventDefault();
        return;
      }
      if (dt && [...dt.types].includes(VB_EMAIL_LIBRARY_DRAG_TYPE)) {
        e.preventDefault();
        return;
      }
      if (dt && [...dt.types].includes(VB_EMAIL_BLOCK_MOVE_DRAG_TYPE)) {
        e.preventDefault();
      }
      if (dataTransferMayContainFiles(dt) && onImageFileDropRef.current) {
        e.preventDefault();
        if (!readOnlyBody) {
          try {
            d.designMode = 'off';
          } catch {
            /* ignore */
          }
        }
      }
    };

    const onDragLeaveFileFromDoc = (e: DragEvent) => {
      if (!dataTransferMayContainFiles(e.dataTransfer) || !onImageFileDropRef.current) return;
      const rel = e.relatedTarget as Node | null;
      if (rel && d.contains(rel)) return;
      if (!readOnlyBody) {
        try {
          d.designMode = 'on';
        } catch {
          /* ignore */
        }
      }
    };

    const onDragOverDnd = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (vbEmailActiveBlockMoveId) {
        e.preventDefault();
        if (dt) dt.dropEffect = 'move';
        return;
      }
      if (dt && [...dt.types].includes(VB_EMAIL_LIBRARY_DRAG_TYPE)) {
        e.preventDefault();
        dt.dropEffect = 'copy';
        return;
      }
      if (dt && [...dt.types].includes(VB_EMAIL_BLOCK_MOVE_DRAG_TYPE)) {
        e.preventDefault();
        dt.dropEffect = 'move';
        return;
      }
      /* Soubor z disku: bez průběžného preventDefault na dragover prohlížeč drop vůbec nespustí (designMode to často blokuje). */
      if (dataTransferMayContainFiles(dt) && onImageFileDropRef.current) {
        if (!readOnlyBody) {
          try {
            d.designMode = 'off';
          } catch {
            /* ignore */
          }
        }
        e.preventDefault();
        if (dt) dt.dropEffect = 'copy';
        return;
      }
      if (!draggedBlock || !rootDnd.contains(draggedBlock)) return;
      e.preventDefault();
      if (dt) dt.dropEffect = 'move';
    };

    const onDropDnd = (e: DragEvent) => {
      e.preventDefault();
      const blockMoveFromHandle = vbEmailActiveBlockMoveId;
      vbEmailActiveBlockMoveId = null;
      try {
      const fileDropCb = onImageFileDropRef.current;
      if (fileDropCb) {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const f = files[0];
          if (fileDropLooksLikeImage(f)) {
            const resolved =
              resolveEmailImageBlockByPoint(d, e.clientX, e.clientY) ||
              resolveEmailImageFileDropTargetInDoc(d, e.clientX, e.clientY);
            if (resolved) {
              const { img: imgEl, imageBlockId } = resolved;
              const attrSrc = imgEl.getAttribute('src') || '';
              const resolvedSrc = imgEl.currentSrc || imgEl.src || attrSrc;
              fileDropCb(f, attrSrc, resolvedSrc, imageBlockId);
              requestAnimationFrame(syncHeight);
              onDragEndDnd();
              return;
            }
          }
        }
      }

      let libRaw = e.dataTransfer?.getData(VB_EMAIL_LIBRARY_DRAG_TYPE) || '';
      if (!libRaw) {
        const plain = e.dataTransfer?.getData('text/plain') || '';
        const m = plain.match(/^vb-email-block:(.+)$/);
        if (m) libRaw = m[1].trim();
      }
      if (libRaw && EMAIL_PRESET_TYPE_SET.has(libRaw as EmailBlockType)) {
        const presetType = libRaw as EmailBlockType;

        // Drop z knihovny dovnitř dlouhého textu: rozdělit na dva textové bloky a mezi ně vložit preset.
        if (presetType !== 'section' && presetType !== 'text') {
          const hitSplit = d.elementFromPoint(e.clientX, e.clientY);
          const textHost = findTopLevelTextBlockHostForDrop(hitSplit, rootDnd);
          if (textHost) {
            const splitIdx = findTextBlockLibraryDropSplitIndex(textHost, e.clientY);
            const kids = getTextBlockElementChildren(textHost);
            if (
              splitIdx != null &&
              splitIdx >= 1 &&
              splitIdx < kids.length &&
              textHost.parentElement
            ) {
              const parent = textHost.parentElement;
              const ref = textHost.nextSibling;
              const styleAttr = textHost.getAttribute('style');
              const leftBlock = d.createElement('div');
              leftBlock.setAttribute('data-vb-block', 'text');
              leftBlock.setAttribute('data-vb-block-id', randomBlockId());
              if (styleAttr) leftBlock.setAttribute('style', styleAttr);
              const rightBlock = d.createElement('div');
              rightBlock.setAttribute('data-vb-block', 'text');
              rightBlock.setAttribute('data-vb-block-id', randomBlockId());
              if (styleAttr) rightBlock.setAttribute('style', styleAttr);
              const presetHtml = buildEmailBlockHtml(presetType).trim();
              const tmpSplit = d.createElement('div');
              tmpSplit.innerHTML = presetHtml;
              const inserted = tmpSplit.firstElementChild as HTMLElement | null;
              if (inserted) {
                for (let i = 0; i < splitIdx; i++) {
                  leftBlock.appendChild(kids[i]);
                }
                for (let i = splitIdx; i < kids.length; i++) {
                  rightBlock.appendChild(kids[i]);
                }
                parent.removeChild(textHost);
                parent.insertBefore(leftBlock, ref);
                parent.insertBefore(inserted, ref);
                parent.insertBefore(rightBlock, ref);
                const st = createBlockInspectorState(inserted);
                selectedBlockIdRef.current = st.id;
                onBlockSelectRef.current?.(st);
                syncSelectedBlockUi();
                applyDraggableAttrs();
                schedule();
                requestAnimationFrame(syncHeight);
                return;
              }
            }
          }
        }

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
      if (!draggedBlock || !rootDnd.contains(draggedBlock)) {
        let moveId = e.dataTransfer?.getData(VB_EMAIL_BLOCK_MOVE_DRAG_TYPE) || '';
        if (!moveId) {
          const plainMove = e.dataTransfer?.getData('text/plain') || '';
          const mm = plainMove.match(/^vb-move-block:(.+)$/);
          if (mm) moveId = mm[1].trim();
        }
        if (!moveId && blockMoveFromHandle) moveId = blockMoveFromHandle;
        if (moveId) {
          const el = d.querySelector(`[data-vb-block-id="${CSS.escape(moveId)}"]`) as HTMLElement | null;
          if (el && rootDnd.contains(el) && isDndReorderableEmailBlock(el, rootDnd)) {
            draggedBlock = el;
            draggedBlock.classList.add('vb-dnd-dragging');
          }
        }
      }
      if (!draggedBlock || !rootDnd.contains(draggedBlock)) return;
      const y = e.clientY;
      const hitMove = d.elementFromPoint(e.clientX, e.clientY);
      const targetSectionUnder = hitMove?.closest?.('[data-vb-block="section"]') as HTMLElement | null;
      const dragParent = draggedBlock.parentElement;
      const owningSection = draggedBlock.closest('[data-vb-block="section"]') as HTMLElement | null;
      let destParent: HTMLElement = rootDnd;
      if (dragParent === rootDnd) {
        destParent = rootDnd;
      } else if (dragParent?.getAttribute('data-vb-block') === 'section') {
        destParent =
          targetSectionUnder && rootDnd.contains(targetSectionUnder) && targetSectionUnder !== draggedBlock
            ? targetSectionUnder
            : dragParent;
      } else if (owningSection && rootDnd.contains(owningSection)) {
        destParent =
          targetSectionUnder && rootDnd.contains(targetSectionUnder) && targetSectionUnder !== draggedBlock
            ? targetSectionUnder
            : owningSection;
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
      } finally {
        if (!readOnlyBody) {
          try {
            d.designMode = 'on';
          } catch {
            /* ignore */
          }
        }
      }
    };

    const onInput = (e?: Event) => {
      // Úprava výchozí karty sloupce → už to není výplň, při sloučení na 1 sloupec se nesmí zahodit.
      const t = (e?.target as Node | null) || null;
      const el = t?.nodeType === Node.TEXT_NODE ? (t as Text).parentElement : (t as HTMLElement | null);
      el?.closest?.('[data-vb-col-placeholder]')?.removeAttribute('data-vb-col-placeholder');
      onRichTextActivityRef.current?.();
      applyDraggableAttrs();
      schedule();
      requestAnimationFrame(syncHeight);
    };
    const onImgClick = (e: Event) => {
      // Klik na obrázek jen vybere blok — popup výměny otevírá levé menu („Nahradit obrázek“).
      if (suppressImgClickAfterDnD && (e.target as HTMLElement | null)?.tagName === 'IMG') {
        e.preventDefault();
      }
    };

    let lassoActive = false;
    let lassoMoved = false;
    let lassoStartX = 0;
    let lassoStartY = 0;
    let suppressNextBlockClick = false;

    const publishLassoRect = (x0: number, y0: number, x1: number, y1: number) => {
      const ir = fr.getBoundingClientRect();
      const left = ir.left + Math.min(x0, x1);
      const top = ir.top + Math.min(y0, y1);
      const width = Math.abs(x1 - x0);
      const height = Math.abs(y1 - y0);
      onLassoRectRef.current?.({ left, top, width, height });
    };

    const endLasso = (clientX: number, clientY: number) => {
      if (!lassoActive) return;
      lassoActive = false;
      onLassoRectRef.current?.(null);
      const dx = clientX - lassoStartX;
      const dy = clientY - lassoStartY;
      if (Math.hypot(dx, dy) < 4) {
        lassoMoved = false;
        return;
      }
      suppressNextBlockClick = true;
      lassoMoved = true;
      const sel = {
        left: Math.min(lassoStartX, clientX),
        top: Math.min(lassoStartY, clientY),
        right: Math.max(lassoStartX, clientX),
        bottom: Math.max(lassoStartY, clientY),
      };
      const hit: BlockInspectorState[] = [];
      for (const el of listLassoSelectableBlocks()) {
        const r = el.getBoundingClientRect();
        if (
          rectsIntersect(sel, {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
          })
        ) {
          hit.push(createBlockInspectorState(el));
        }
      }
      if (hit.length > 0) {
        selectedBlockIdRef.current = hit[hit.length - 1]?.id ?? null;
        selectedBlockIdsRef.current = hit.map((b) => b.id);
        onBlocksSelectRef.current?.(hit);
        syncSelectedBlockUi();
      }
    };

    const onLassoMouseDown = (e: MouseEvent) => {
      if (builderModeRef.current !== 'block' || readOnlyBody) return;
      if (e.button !== 0) return;
      // Výběr typu sloupce / text — nespouštět laso.
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-vb-col-chooser],[data-vb-col-choose]')) return;
      if (isTextEditTarget(e.target) && !e.altKey) return;
      lassoActive = true;
      lassoMoved = false;
      lassoStartX = e.clientX;
      lassoStartY = e.clientY;
      // Overlay až po pohybu — krátký klik zůstane výběrem bloku.
    };

    const onLassoMouseMove = (e: MouseEvent) => {
      if (!lassoActive) return;
      const dist = Math.hypot(e.clientX - lassoStartX, e.clientY - lassoStartY);
      if (dist < 4) return;
      if (!lassoMoved) {
        lassoMoved = true;
        try {
          d.getSelection()?.removeAllRanges();
        } catch {
          /* ignore */
        }
      }
      publishLassoRect(lassoStartX, lassoStartY, e.clientX, e.clientY);
    };

    const onLassoMouseUp = (e: MouseEvent) => {
      endLasso(e.clientX, e.clientY);
    };

    /** mouseup mimo iframe (parent window) — jinak laso zůstane viset. */
    const onParentLassoMouseUp = (e: MouseEvent) => {
      if (!lassoActive) return;
      const ir = fr.getBoundingClientRect();
      endLasso(e.clientX - ir.left, e.clientY - ir.top);
    };
    const onParentLassoMouseMove = (e: MouseEvent) => {
      if (!lassoActive) return;
      const ir = fr.getBoundingClientRect();
      const x = e.clientX - ir.left;
      const y = e.clientY - ir.top;
      const dist = Math.hypot(x - lassoStartX, y - lassoStartY);
      if (dist < 4) return;
      if (!lassoMoved) {
        lassoMoved = true;
        try {
          d.getSelection()?.removeAllRanges();
        } catch {
          /* ignore */
        }
      }
      publishLassoRect(lassoStartX, lassoStartY, x, y);
    };

    const onColumnChooseClick = (e: Event) => {
      if (readOnlyBody) return;
      const raw = e.target as HTMLElement | null;
      const btn = raw?.closest?.('[data-vb-col-choose]') as HTMLElement | null;
      if (!btn || !d.body.contains(btn)) return;
      const kind = btn.getAttribute('data-vb-col-choose') as EmailColumnContentKind | null;
      if (kind !== 'text' && kind !== 'image' && kind !== 'button') return;
      e.preventDefault();
      e.stopPropagation();
      const unit = fillEmailColumnChooser(btn, kind);
      if (!unit) return;
      // Stejná cesta jako psaní v náhledu — historie + uložení přes debounced commit.
      commit();
      requestAnimationFrame(syncHeight);
      const next = createBlockInspectorState(unit);
      selectedBlockIdRef.current = next.id;
      selectedBlockIdsRef.current = [next.id];
      onBlockSelectRef.current?.(next, { additive: false });
      syncSelectedBlockUi();
    };

    const onBlockClick = (e: Event) => {
      if (builderModeRef.current !== 'block' || readOnlyBody) return;
      // Klik na výběr typu sloupce řeší `onColumnChooseClick`.
      if ((e.target as HTMLElement | null)?.closest?.('[data-vb-col-choose],[data-vb-col-chooser]')) return;
      if (suppressNextBlockClick || lassoMoved) {
        suppressNextBlockClick = false;
        lassoMoved = false;
        return;
      }
      const me = e as MouseEvent;
      const beforeUnits = rootDnd.querySelectorAll('[data-vb-col-unit]').length;
      // Migrace při kliknutí — staré 2/3 sloupce bez wrapperů jinak vždy vyberou celý layout.
      ensureEmailColumnUnits(rootDnd);
      let block = findSelectableEmailBlock(e.target, rootDnd);
      if (!block) return;
      const hostType = block.getAttribute('data-vb-block');
      if (hostType === 'columns-2' || hostType === 'columns-3') {
        const td = (e.target as Element | null)?.closest?.('td, th') as HTMLElement | null;
        if (td && block.contains(td)) {
          const unit =
            (td.querySelector(':scope > [data-vb-col-unit], [data-vb-col-unit]') as HTMLElement | null) ||
            ensureColumnUnitAtTarget(td.firstElementChild || td, rootDnd);
          if (unit) block = unit;
        }
      }
      if (rootDnd.querySelectorAll('[data-vb-col-unit]').length !== beforeUnits) {
        schedule();
      }
      const next = createBlockInspectorState(block);
      const additive = !!(me.shiftKey || me.metaKey || me.ctrlKey);
      selectedBlockIdRef.current = next.id;
      if (additive) {
        const prev = selectedBlockIdsRef.current;
        selectedBlockIdsRef.current = prev.includes(next.id)
          ? prev.filter((id) => id !== next.id)
          : [...prev, next.id];
      } else {
        selectedBlockIdsRef.current = [next.id];
      }
      onBlockSelectRef.current?.(next, { additive });
      syncSelectedBlockUi();
    };

    /** Souborový DnD u designMode spolehlivěji na `defaultView` než jen na `document`. */
    const dragEvtRoot: Document | Window = d.defaultView ?? d;
    if (!readOnlyBody) {
      applyDraggableAttrs();
      syncSelectedBlockUi();
      d.body.addEventListener('input', onInput);
      d.addEventListener('click', onColumnChooseClick, true);
      d.addEventListener('click', onImgClick, true);
      d.addEventListener('click', onBlockClick, true);
      d.addEventListener('mousedown', onLassoMouseDown, true);
      d.addEventListener('mousemove', onLassoMouseMove, true);
      d.addEventListener('mouseup', onLassoMouseUp, true);
      window.addEventListener('mousemove', onParentLassoMouseMove, true);
      window.addEventListener('mouseup', onParentLassoMouseUp, true);
      rootDnd.addEventListener('dragstart', onDragStartDnd, true);
      rootDnd.addEventListener('dragend', onDragEndDnd, true);
      dragEvtRoot.addEventListener('dragenter', onDragEnterDnd, true);
      dragEvtRoot.addEventListener('dragleave', onDragLeaveFileFromDoc, true);
      dragEvtRoot.addEventListener('dragover', onDragOverDnd, true);
      dragEvtRoot.addEventListener('drop', onDropDnd, true);
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

    /**
     * Kolečko nad náhledem musí rolovat plátno editoru. Iframe uvnitř neroluje (overflow:hidden),
     * ale prohlížeče přebublání wheelu z iframu do rodiče řeší různě — tak ho předáme ručně.
     */
    const findCanvasScroller = (): HTMLElement | null => {
      let n: HTMLElement | null = fr.parentElement;
      while (n) {
        const style = n.ownerDocument.defaultView?.getComputedStyle(n);
        const canScroll =
          !!style &&
          /(auto|scroll|overlay)/.test(style.overflowY) &&
          n.scrollHeight > n.clientHeight + 1;
        if (canScroll) return n;
        n = n.parentElement;
      }
      return null;
    };
    const wheelDeltaPx = (e: WheelEvent, viewportH: number): number => {
      if (e.deltaMode === 1) return e.deltaY * 16;
      if (e.deltaMode === 2) return e.deltaY * viewportH;
      return e.deltaY;
    };
    const onWheelInsidePreview = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const scroller = findCanvasScroller();
      if (!scroller) return;
      const before = scroller.scrollTop;
      scroller.scrollTop = before + wheelDeltaPx(e, scroller.clientHeight);
      if (scroller.scrollTop !== before) e.preventDefault();
    };
    d.addEventListener('wheel', onWheelInsidePreview, { passive: false });

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
    ro.observe(d.documentElement);

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
      d.removeEventListener('wheel', onWheelInsidePreview);
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
        d.removeEventListener('click', onColumnChooseClick, true);
        d.removeEventListener('click', onBlockClick, true);
        d.removeEventListener('mousedown', onLassoMouseDown, true);
        d.removeEventListener('mousemove', onLassoMouseMove, true);
        d.removeEventListener('mouseup', onLassoMouseUp, true);
        window.removeEventListener('mousemove', onParentLassoMouseMove, true);
        window.removeEventListener('mouseup', onParentLassoMouseUp, true);
        onLassoRectRef.current?.(null);
        rootDnd.removeEventListener('dragstart', onDragStartDnd, true);
        rootDnd.removeEventListener('dragend', onDragEndDnd, true);
        const dragEvtRootCleanup: Document | Window = d.defaultView ?? d;
        dragEvtRootCleanup.removeEventListener('dragenter', onDragEnterDnd, true);
        dragEvtRootCleanup.removeEventListener('dragleave', onDragLeaveFileFromDoc, true);
        dragEvtRootCleanup.removeEventListener('dragover', onDragOverDnd, true);
        dragEvtRootCleanup.removeEventListener('drop', onDropDnd, true);
      }
      applyDraggableAttrsRef.current = null;
    };
  }, [draftId, bodyEditEpoch, readOnlyBody]);

  useEffect(() => {
    if (readOnlyBody) return;
    applyDraggableAttrsRef.current?.();
  }, [selectedBlockId, selectedBlockIds, builderMode, bodyEditEpoch, readOnlyBody]);

  useEffect(() => {
    const d = innerRef.current?.contentDocument;
    if (!d?.body) return;
    const root = getEmailDndRoot(d);
    root.querySelectorAll('.vb-block-selected').forEach((n) => n.classList.remove('vb-block-selected'));
    if (builderMode !== 'block') return;
    const ids = selectedBlockIds.length
      ? selectedBlockIds
      : selectedBlockId
        ? [selectedBlockId]
        : [];
    for (const id of ids) {
      try {
        root.querySelector(`[data-vb-block-id="${CSS.escape(id)}"]`)?.classList.add('vb-block-selected');
      } catch {
        /* ignore */
      }
    }
  }, [selectedBlockId, selectedBlockIds, builderMode, bodyEditEpoch]);

  useEffect(() => {
    const d = innerRef.current?.contentDocument;
    if (!d?.documentElement || !d.body) return;
    const outer = normalizeHexColor(outerBackground, DEFAULT_PREVIEW_OUTER_BG);
    const column = normalizeHexColor(columnBackground, DEFAULT_PREVIEW_COLUMN_BG);
    d.documentElement.classList.add('vb-island-layout');
    d.documentElement.style.setProperty('--vb-preview-outer', outer);
    d.documentElement.style.setProperty('--vb-preview-card', column);
    d.documentElement.style.colorScheme = 'light';
    // Uvnitř iframu se nikdy neroluje — scrolluje plátno editoru (viz syncHeight).
    d.documentElement.style.height = 'auto';
    d.documentElement.style.overflow = 'hidden';
    d.body.style.colorScheme = 'light';
    d.body.style.background = outer;
    d.body.style.padding = '28px 56px 48px';
    d.body.style.height = 'auto';
    d.body.style.minHeight = '0px';
    const root = d.querySelector('.vb-email-root') as HTMLElement | null;
    if (root) {
      root.style.width = '600px';
      root.style.minHeight = '';
      root.style.maxWidth = '100%';
      root.style.marginLeft = 'auto';
      root.style.marginRight = 'auto';
    }
    // Sjednoť chrome attrs → inline (export + náhled); boky bez paddingu.
    root?.querySelectorAll('[data-vb-block="section"]').forEach((raw) => {
      applySectionChrome(raw as HTMLElement);
    });
  }, [columnBackground, outerBackground, bodyEditEpoch]);

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
      sandbox="allow-same-origin allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
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
  /** Nahrání obrázku do těla mailu (upload-image + vložení URL). */
  const [emailImageUploading, setEmailImageUploading] = useState(false);
  /** Krátká nápověda po tichém autosave (bez toastu). */
  const [autoSaveHint, setAutoSaveHint] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [sendingTestMail, setSendingTestMail] = useState(false);
  const [testMailRecipient, setTestMailRecipient] = useState<string>(EMAIL_TEST_RECIPIENTS[0]);
  /* Vlastní mailing (Resend) — dialog odeslání kampaně na Postgres audienci. */
  const [mailingDialogOpen, setMailingDialogOpen] = useState(false);
  const [mailingTags, setMailingTags] = useState<{ id: string; name: string; slug?: string }[]>([]);
  const [mailingIncludeTagIds, setMailingIncludeTagIds] = useState<string[]>([]);
  const [mailingExcludeTagIds, setMailingExcludeTagIds] = useState<string[]>([]);
  const [mailingSources, setMailingSources] = useState<string[]>([]);
  const [mailingSubjects, setMailingSubjects] = useState<string[]>([]);
  const [mailingTagSearch, setMailingTagSearch] = useState('');
  const [mailingShowAllTags, setMailingShowAllTags] = useState(false);
  /** Počet příjemců z posledního prepare — null = filtr se změnil, je potřeba přepočítat. */
  const [mailingRecipientCount, setMailingRecipientCount] = useState<number | null>(null);
  const [mailingPreparing, setMailingPreparing] = useState(false);
  const [mailingSending, setMailingSending] = useState(false);
  const [sendingResendTest, setSendingResendTest] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolPanelMode, setToolPanelMode] = useState<'ai' | 'block' | 'settings'>('ai');
  /** Mailchimp-styl: při otevřeném draftu schovat seznam a nechat workspace editor. */
  const editorWorkspaceOpen = !!selected;

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
  /** Obal náhledu — drop souboru z OS se zpracuje zde (iframe má s designMode často konflikt). */
  const emailPreviewDropShellRef = useRef<HTMLDivElement | null>(null);
  /** Plná „drop vrstva“ nad iframe během přetahování souboru z OS. */
  const [previewImageFileDragActive, setPreviewImageFileDragActive] = useState(false);
  /** Bounding rect cílového image bloku během drag (v shell souřadnicích) — pro vizuální highlight. */
  const [previewImageDropTarget, setPreviewImageDropTarget] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    blockId: string;
  } | null>(null);
  const emailImageBlockFileInputRef = useRef<HTMLInputElement | null>(null);
  const iframeHoverBlockRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearBlockMove = () => {
      vbEmailActiveBlockMoveId = null;
    };
    window.addEventListener('dragend', clearBlockMove, true);
    return () => window.removeEventListener('dragend', clearBlockMove, true);
  }, []);
  /** Blok pod kurzorem (`data-vb-block-id`) — pro vložení z postranní lišty / kotvy za blok. */
  const insertHoverBlockIdRef = useRef<string | null>(null);
  const pendingInsertAnchorRef = useRef<string | null>(null);
  const insertLineHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Kurzor je nad plovoucí lištou / bobánkem v parent okně (mimo iframe). */
  const chromePointerInsideRef = useRef(false);
  /** Otevřená nabídka „+“ u postranní lišty bloku. */
  const [blockChromeAddMenuOpen, setBlockChromeAddMenuOpen] = useState(false);
  const blockChromeAddMenuOpenRef = useRef(false);
  blockChromeAddMenuOpenRef.current = blockChromeAddMenuOpen;
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
  /**
   * Přesun bloku tažením za „bobánek“ nahoře — pointer events v parent okně
   * (HTML5 DnD přes iframe je nespolehlivý).
   */
  const [blockPointerDrag, setBlockPointerDrag] = useState<{
    blockId: string;
    indicator: { top: number; left: number; width: number } | null;
  } | null>(null);
  const blockPointerDragRef = useRef(blockPointerDrag);
  blockPointerDragRef.current = blockPointerDrag;
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
  /** Blok (`data-vb-block-id`), který má AI upravit (žluté kolečko AI u lišty bloku). */
  const [aiEditBlockId, setAiEditBlockId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockInspectorState | null>(null);
  const selectedBlockRef = useRef(selectedBlock);
  selectedBlockRef.current = selectedBlock;
  /** Multi-výběr (klik / Shift+klik / laso) — inspector zůstává u primárního bloku. */
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  /** Laso obdélník ve viewportu (parent) během tažení. */
  const [lassoRect, setLassoRect] = useState<EmailLassoRect | null>(null);

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
    setSelectedBlockIds([]);
    setSidebarOpen(false); // workspace editor — seznam emailů schovat
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

  /** Z workspace editoru zpět na seznam emailů (Mailchimp „exit“). */
  const exitEditorWorkspace = useCallback(() => {
    selectedIdRef.current = null;
    setSelected(null);
    setSelectedBlock(null);
    setSelectedBlockIds([]);
    setLassoRect(null);
    setSidebarOpen(true);
    setChatMsgs([]);
    setChatInput('');
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    const run = async () => {
      setLoading(true);
      try {
        const r = await fetchWithAdminAuth(`${SERVER}/admin/email-drafts`, { signal, json: true });
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
      const r = await fetchWithAdminAuth(`${SERVER}/admin/email-drafts`, {
        method: 'POST',
        json: true,
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
      await fetchWithAdminAuth(`${SERVER}/admin/email-drafts/${id}`, { method: 'DELETE', json: true });
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

  const handleImageFileDrop = useCallback(
    async (file: File, attrSrc: string, resolvedSrc: string, imageBlockId: string | null) => {
      const draftId = selectedIdRef.current;
      const snap = selectedRef.current;
      if (!draftId || !snap || snap.id !== draftId) return;
      commitHistoryBeforeMutation();
      setEmailImageUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${SERVER}/upload-image`, { method: 'POST', headers: await authHeadersNoCt(), body: fd });
        const data = await res.json();
        const newUrl = (data && (data.url as string)) || '';
        if (!newUrl) {
          toast.error(data.error || 'Nahrání obrázku selhalo');
          return;
        }
        if (selectedIdRef.current !== draftId) {
          toast.message('Draft se mezitím změnil.');
          return;
        }
        /** Po await může být iframe novější než `snap.bodyHtml` (debounced commit z designMode). */
        const liveInner =
          previewIframeRef.current?.contentDocument?.body?.innerHTML?.trim() ?? '';
        const htmlBefore =
          liveInner && previewIframeRef.current
            ? normalizeBodyForBuilder(liveInner)
            : snap.bodyHtml;
        let next = htmlBefore;
        if (imageBlockId) {
          next = replaceFirstImgSrcInVbImageBlockById(htmlBefore, imageBlockId, newUrl);
          if (next === htmlBefore) {
            toast.error('Nepodařilo se v HTML najít blok obrázku k nahrazení.');
            return;
          }
        } else {
          next = replaceFirstImgSrcInHtml(htmlBefore, attrSrc, newUrl);
          if (next === htmlBefore && resolvedSrc && resolvedSrc !== attrSrc) {
            next = replaceFirstImgSrcInHtml(htmlBefore, resolvedSrc, newUrl);
          }
          if (next === htmlBefore) {
            toast.error('Nepodařilo se najít tento obrázek v HTML.');
            return;
          }
        }
        const normalized = normalizeBodyForBuilder(next);
        const now = new Date().toISOString();
        setDrafts(prev =>
          prev.map(d => (d.id === draftId ? normalizeDraftForBuilder({ ...d, bodyHtml: normalized, updatedAt: now }) : d)),
        );
        setSelected(prev =>
          prev?.id === draftId
            ? normalizeDraftForBuilder({ ...prev, bodyHtml: normalized, updatedAt: now })
            : prev,
        );
        setSelectedBlock(null);
        bumpBodyEpoch();
        toast.success('Obrázek nahrazen');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Nahrání obrázku selhalo');
      } finally {
        setEmailImageUploading(false);
      }
    },
    [commitHistoryBeforeMutation, bumpBodyEpoch],
  );

  const handleImageFileDropRef = useRef(handleImageFileDrop);
  handleImageFileDropRef.current = handleImageFileDrop;

  const restoreEmailPreviewIframePointer = useCallback(() => {
    previewIframeRef.current?.style.removeProperty('pointer-events');
  }, []);

  /**
   * Najdi image blok pod kurzorem (souřadnice v parent okně) a vrať jeho rect převedený
   * do souřadnic shellu (kde je `previewImageDropTarget` zobrazen).
   */
  const computeEmailPreviewDropTargetForCursor = useCallback(
    (clientX: number, clientY: number): typeof previewImageDropTarget => {
      const fr = previewIframeRef.current;
      const sh = emailPreviewDropShellRef.current;
      const d = fr?.contentDocument;
      if (!fr || !sh || !d?.body) return null;
      const fRect = fr.getBoundingClientRect();
      const x = clientX - fRect.left;
      const y = clientY - fRect.top;
      const hit =
        resolveEmailImageBlockByPoint(d, x, y) ||
        resolveEmailImageFileDropTargetInDoc(d, x, y);
      if (!hit || !hit.imageBlockId) return null;
      const block = d.querySelector(
        `[data-vb-block="image"][data-vb-block-id="${CSS.escape(hit.imageBlockId)}"]`,
      ) as HTMLElement | null;
      if (!block) return null;
      const bRect = block.getBoundingClientRect();
      const sRect = sh.getBoundingClientRect();
      return {
        top: fRect.top + bRect.top - sRect.top,
        left: fRect.left + bRect.left - sRect.left,
        width: bRect.width,
        height: bRect.height,
        blockId: hit.imageBlockId,
      };
    },
    [],
  );

  /**
   * Drop z obalu náhledu / překryvu — souřadnice z okna přepočtené do dokumentu iframe.
   * Bez tichých fallbacků: soubor musí padnout do konkrétního image bloku, jinak nic.
   */
  const runEmailPreviewShellImageDrop = useCallback(
    (file: File, clientX: number, clientY: number) => {
      const fr = previewIframeRef.current;
      const d = fr?.contentDocument;
      if (!fr || !d?.body || !handleImageFileDropRef.current) return;
      const rect = fr.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const resolved =
        resolveEmailImageBlockByPoint(d, x, y) ||
        resolveEmailImageFileDropTargetInDoc(d, x, y);
      if (!resolved || !resolved.imageBlockId) {
        toast.error('Pusťte soubor přímo na blok obrázku v náhledu.');
        return;
      }
      const { img, imageBlockId } = resolved;
      void handleImageFileDropRef.current(
        file,
        img.getAttribute('src') || '',
        img.currentSrc || img.src || '',
        imageBlockId,
      );
    },
    [],
  );

  const onEmailImageBlockFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      restoreEmailPreviewIframePointer();
      setPreviewImageFileDragActive(false);
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!fileDropLooksLikeImage(file)) {
        toast.error('Vyberte obrázek (PNG, JPG, GIF, …)');
        return;
      }
      if (selectedBlock?.type !== 'image' || !selectedBlock.id) {
        toast.error('Vyberte v náhledu blok obrázku.');
        return;
      }
      const doc = previewIframeRef.current?.contentDocument;
      if (!doc?.body) {
        toast.error('Náhled není připravený.');
        return;
      }
      const resolved = resolveEmailImageBlockById(doc, selectedBlock.id);
      if (!resolved) {
        toast.error('Blok obrázku v náhledu nešlo najít.');
        return;
      }
      const { img, imageBlockId } = resolved;
      void handleImageFileDrop(
        file,
        img.getAttribute('src') || '',
        img.currentSrc || img.src || '',
        imageBlockId,
      );
    },
    [handleImageFileDrop, restoreEmailPreviewIframePointer, selectedBlock?.id, selectedBlock?.type],
  );

  /**
   * Nad oblastí náhledu dočasně vypnout pointer-events na iframe, ať OS file drop dopadne na rodiče
   * a nepřichytí se na designMode dokument uvnitř iframe (Safari/Chrome).
   */
  useEffect(() => {
    if (showInboxChrome) return;
    const onDragOverWindow = (e: DragEvent) => {
      if (!dataTransferMayContainFiles(e.dataTransfer)) return;
      if (!handleImageFileDropRef.current) return;
      const sh = emailPreviewDropShellRef.current;
      const fr = previewIframeRef.current;
      if (!sh || !fr) return;
      const r = sh.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      fr.style.pointerEvents = inside ? 'none' : '';
    };
    const restore = () => {
      restoreEmailPreviewIframePointer();
      setPreviewImageFileDragActive(false);
      setPreviewImageDropTarget(null);
    };
    window.addEventListener('dragover', onDragOverWindow, true);
    window.addEventListener('drop', restore, true);
    window.addEventListener('dragend', restore, true);
    return () => {
      window.removeEventListener('dragover', onDragOverWindow, true);
      window.removeEventListener('drop', restore, true);
      window.removeEventListener('dragend', restore, true);
      restore();
    };
  }, [showInboxChrome, restoreEmailPreviewIframePointer]);

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
    setAiEditBlockId(null);
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

  const syncChromeToBlockId = useCallback((blockId: string | null) => {
    const fr = previewIframeRef.current;
    const doc = fr?.contentDocument;
    if (!fr || !doc?.body || !blockId) {
      setBlockActionChrome(null);
      return;
    }
    const root = getEmailDndRoot(doc);
    const el = findEmailBlockById(root, blockId);
    if (!el || !root.contains(el)) {
      setBlockActionChrome(null);
      return;
    }
    const r = getEmailBlockRectInParentViewport(el, fr);
    setBlockActionChrome({ ...r, blockId });
    insertHoverBlockIdRef.current = blockId;
  }, []);

  const scheduleInsertLineHide = useCallback(() => {
    cancelInsertLineHide();
    insertLineHideTimerRef.current = window.setTimeout(() => {
      insertLineHideTimerRef.current = null;
      if (blockPointerDragRef.current) return;
      // Kurzor mezitím dojel na lištu v parent okně — neschovávej.
      if (chromePointerInsideRef.current || blockChromeAddMenuOpenRef.current) return;
      // Stále hover nad blokem v iframe — lišta zůstane u něj, ne u starého výběru.
      const hoverEl = iframeHoverBlockRef.current;
      const hoverId = hoverEl?.getAttribute('data-vb-block-id') || null;
      if (hoverId && hoverEl?.isConnected) {
        syncChromeToBlockId(hoverId);
        return;
      }
      const selectedId = selectedBlockRef.current?.id ?? null;
      if (selectedId) {
        syncChromeToBlockId(selectedId);
        return;
      }
      clearPendingInsertAnchor();
      iframeHoverBlockRef.current = null;
      insertHoverBlockIdRef.current = null;
      setBlockChromeAddMenuOpen(false);
      setBlockActionChrome(null);
    }, 500);
  }, [cancelInsertLineHide, clearPendingInsertAnchor, syncChromeToBlockId]);

  const keepChromePointerAlive = useCallback(() => {
    chromePointerInsideRef.current = true;
    cancelInsertLineHide();
  }, [cancelInsertLineHide]);

  const releaseChromePointer = useCallback(() => {
    chromePointerInsideRef.current = false;
    if (!blockPointerDragRef.current) scheduleInsertLineHide();
  }, [scheduleInsertLineHide]);

  const handleHoverBlockChrome = useCallback(
    (payload: { top: number; left: number; width: number; height: number; blockId: string } | null) => {
      if (activeBuilderMode !== 'block') {
        insertHoverBlockIdRef.current = null;
        setBlockActionChrome(null);
        return;
      }
      if (blockPointerDragRef.current) return;
      if (payload) {
        cancelInsertLineHide();
        insertHoverBlockIdRef.current = payload.blockId;
        setBlockActionChrome(payload);
        return;
      }
      // Kurzor v iframe mimo blok — neschovávej hned, ať stihne dojít na boční lištu.
      if (chromePointerInsideRef.current || blockChromeAddMenuOpenRef.current) return;
      scheduleInsertLineHide();
    },
    [activeBuilderMode, cancelInsertLineHide, scheduleInsertLineHide],
  );

  useEffect(() => {
    if (activeBuilderMode !== 'block') setBlockActionChrome(null);
  }, [activeBuilderMode]);

  /** Vybraný blok drží bobánek a lištu, pokud zrovna nehoveruju jiný blok. */
  useEffect(() => {
    if (activeBuilderMode !== 'block' || showInboxChrome) return;
    if (!selectedBlock?.id) return;
    if (blockPointerDragRef.current) return;
    if (chromePointerInsideRef.current || blockChromeAddMenuOpenRef.current) return;
    const hoverId = iframeHoverBlockRef.current?.getAttribute('data-vb-block-id') || null;
    if (hoverId && hoverId !== selectedBlock.id) return;
    syncChromeToBlockId(selectedBlock.id);
  }, [selectedBlock?.id, bodyEditEpoch, activeBuilderMode, showInboxChrome, syncChromeToBlockId]);

  const endBlockPointerDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = blockPointerDragRef.current;
      if (!drag) return;
      const fr = previewIframeRef.current;
      const doc = fr?.contentDocument;
      const root = doc ? getEmailDndRoot(doc) : null;
      const moving = root ? findEmailBlockById(root, drag.blockId) : null;
      moving?.classList.remove('vb-dnd-dragging');

      if (fr && moving && root) {
        const target = computeEmailBlockDropTarget(fr, moving, clientX, clientY);
        if (target && applyEmailBlockDrop(moving, target.destParent, target.insertBefore)) {
          const html = normalizeBodyForBuilder(doc!.body.innerHTML);
          const now = new Date().toISOString();
          const id = selectedRef.current?.id;
          if (id) {
            setDrafts((prev) =>
              prev.map((d) =>
                d.id === id ? normalizeDraftForBuilder({ ...d, bodyHtml: html, updatedAt: now }) : d,
              ),
            );
            setSelected((prev) =>
              prev?.id === id
                ? normalizeDraftForBuilder({ ...prev, bodyHtml: html, updatedAt: now })
                : prev,
            );
          }
          bumpBodyEpoch();
        }
      }
      setBlockPointerDrag(null);
      const keepId = selectedBlockRef.current?.id || drag.blockId;
      requestAnimationFrame(() => syncChromeToBlockId(keepId));
    },
    [bumpBodyEpoch, syncChromeToBlockId],
  );

  const beginBlockPointerDrag = useCallback(
    (blockId: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (blockPointerDragRef.current) return;
      const fr = previewIframeRef.current;
      const doc = fr?.contentDocument;
      if (!fr || !doc?.body) return;
      const root = getEmailDndRoot(doc);
      const el = findEmailBlockById(root, blockId);
      if (!el) return;
      const moving = resolveReorderableBlock(el, root);
      const moveId = moving?.getAttribute('data-vb-block-id');
      if (!moving || !moveId) {
        toast.info('Tenhle blok se přetahovat nedá.');
        return;
      }
      cancelInsertLineHide();
      commitHistoryBeforeMutation();
      moving.classList.add('vb-dnd-dragging');
      setBlockPointerDrag({ blockId: moveId, indicator: null });

      // Listener na window — re-render bobánku nesmí přerušit gesto (capture na elementu by spadl).
      const onMove = (ev: PointerEvent) => {
        const cur = blockPointerDragRef.current;
        if (!cur) return;
        const frame = previewIframeRef.current;
        const d = frame?.contentDocument;
        if (!frame || !d?.body) return;
        const r = getEmailDndRoot(d);
        const node = findEmailBlockById(r, cur.blockId);
        if (!node) return;
        const target = computeEmailBlockDropTarget(frame, node, ev.clientX, ev.clientY);
        setBlockPointerDrag({
          blockId: cur.blockId,
          indicator: target?.indicator ?? null,
        });
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onUp, true);
        endBlockPointerDrag(ev.clientX, ev.clientY);
      };
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    },
    [cancelInsertLineHide, commitHistoryBeforeMutation, endBlockPointerDrag],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setLassoRect(null);
      if (selectedBlockIds.length > 1) {
        if (selectedBlock) setSelectedBlockIds([selectedBlock.id]);
        else setSelectedBlockIds([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBlockIds.length, selectedBlock]);

  // Jen při změně draftu — NE při každém překreslení callbacků (jinak se žluté AI „ztratí“).
  useEffect(() => {
    cancelInsertLineHide();
    chromePointerInsideRef.current = false;
    iframeHoverBlockRef.current = null;
    insertHoverBlockIdRef.current = null;
    setBlockChromeAddMenuOpen(false);
    setBlockLibraryExpanded(false);
    setBlockActionChrome(null);
    setSelectedBlockIds([]);
    setLassoRect(null);
    clearAiInsertIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- záměrně jen selected?.id
  }, [selected?.id]);

  useEffect(() => {
    if (!showInboxChrome) return;
    cancelInsertLineHide();
    chromePointerInsideRef.current = false;
    iframeHoverBlockRef.current = null;
    insertHoverBlockIdRef.current = null;
    setBlockChromeAddMenuOpen(false);
    setBlockActionChrome(null);
    // Náhled mailu — schovej chrome, ale NEzruš žluté AI (uživatel se často vrátí k úpravám).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- záměrně jen showInboxChrome
  }, [showInboxChrome]);

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

  const handleBlockSelect = useCallback((
    block: BlockInspectorState | null,
    opts?: { additive?: boolean },
  ) => {
    // Na záložce AI nechat panel u chatu — výběr bloku slouží jen jako kontext (přepsat přes AI atd.).
    if (block && activeBuilderMode === 'block' && toolPanelMode !== 'ai') {
      setToolPanelMode('block');
    }
    setSelectedBlock(block);
    if (!block) {
      setSelectedBlockIds([]);
    } else if (opts?.additive) {
      setSelectedBlockIds((prev) =>
        prev.includes(block.id) ? prev.filter((id) => id !== block.id) : [...prev, block.id],
      );
    } else {
      setSelectedBlockIds([block.id]);
    }
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
  }, [activeBuilderMode, toolPanelMode]);

  const handleBlocksSelect = useCallback((blocks: BlockInspectorState[]) => {
    if (blocks.length === 0) {
      setSelectedBlock(null);
      setSelectedBlockIds([]);
      return;
    }
    if (activeBuilderMode === 'block' && toolPanelMode !== 'ai') {
      setToolPanelMode('block');
    }
    const primary = blocks[blocks.length - 1];
    setSelectedBlock(primary);
    setSelectedBlockIds(blocks.map((b) => b.id));
    setSelected((prev) => {
      if (!prev) return prev;
      const updated = normalizeDraftForBuilder({
        ...prev,
        lastSelectedBlockType: primary.type ?? null,
        updatedAt: new Date().toISOString(),
      });
      setDrafts((draftsPrev) => draftsPrev.map((d) => (d.id === updated.id ? updated : d)));
      return updated;
    });
  }, [activeBuilderMode, toolPanelMode]);

  const applyStructuredBodyMutation = useCallback((mutate: (block: HTMLElement, root: HTMLElement, doc: Document) => string | null | void) => {
    const currentSelected = selectedRef.current;
    const blockInfo = selectedBlock;
    const doc = previewIframeRef.current?.contentDocument;
    if (!currentSelected || !blockInfo?.id || !doc?.body) return false;
    const root = getEmailDndRoot(doc);
    const block = findEmailBlockById(root, blockInfo.id);
    if (!block || !root.contains(block)) {
      toast.error('Vybraný blok už v náhledu není.');
      return false;
    }

    commitHistoryBeforeMutation();
    const preferredNextId = mutate(block, root, doc);

    const normalizedBody = normalizeBodyForBuilder(doc.body.innerHTML);
    const nextBlockId = preferredNextId === undefined ? blockInfo.id : preferredNextId;
    const nextBlock = nextBlockId ? findEmailBlockById(root, nextBlockId) : null;
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
    setSelectedBlockIds(nextInspector?.id ? [nextInspector.id] : []);
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
    setSelectedBlockIds(nextInspector?.id ? [nextInspector.id] : []);
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

      const newEnc = encodeWebinarPayload(payload.layout, payload.snapshot, payload.layoutHeight);
      if (
        block.getAttribute('data-vb-wb-encoded') === newEnc &&
        (block.getAttribute('data-vb-wb-height') || '') ===
          (payload.layout === 'hero' ? '' : String(payload.layoutHeight))
      ) {
        return;
      }

      commitHistoryBeforeMutation();
      const html = buildWebinarBlockHtml(
        payload.layout,
        payload.snapshot,
        payload.blockId,
        payload.layoutHeight,
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

  const moveBlockById = useCallback((blockId: string, direction: 'up' | 'down') => {
    applyStructuredBodyMutationByBlockId(blockId, (block, root) => {
      const result = moveEmailBlockNode(block, root, direction);
      if (!result.ok) {
        toast.info(result.reason);
        return;
      }
      return result.keepBlockId;
    });
  }, [applyStructuredBodyMutationByBlockId]);

  const duplicateBlockById = useCallback((blockId: string) => {
    applyStructuredBodyMutationByBlockId(blockId, (block) => {
      // Duplikovat layout sloupců, ne jen jednu buňku.
      const target = getColumnsHostForBlock(block) || block;
      const clone = target.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-vb-block-id');
      clone.querySelectorAll('[data-vb-block-id]').forEach((el) => {
        el.removeAttribute('data-vb-block-id');
      });
      target.insertAdjacentElement('afterend', clone);
      const type = inferEmailBlockType(clone);
      clone.setAttribute('data-vb-block', type);
      return target.getAttribute('data-vb-block-id');
    });
  }, [applyStructuredBodyMutationByBlockId]);

  const deleteBlockById = useCallback((blockId: string) => {
    applyStructuredBodyMutationByBlockId(blockId, (block, root) => {
      if (isEmailColumnUnit(block)) {
        const host = getColumnsHostForBlock(block);
        const cell = block.parentElement;
        block.remove();
        if (cell && cell.tagName === 'TD' && cell.children.length === 0) {
          cell.innerHTML = buildColumnChooserHtml();
        }
        return host?.getAttribute('data-vb-block-id') || null;
      }
      return deleteEmailBlockNode(block, root);
    });
  }, [applyStructuredBodyMutationByBlockId]);

  const moveSelectedBlock = useCallback((direction: 'up' | 'down') => {
    applyStructuredBodyMutation((block, root) => {
      const result = moveEmailBlockNode(block, root, direction);
      if (!result.ok) {
        toast.info(result.reason);
        return;
      }
      return result.keepBlockId;
    });
  }, [applyStructuredBodyMutation]);

  const moveSelectedBlockBefore = useCallback((targetBlockId: string) => {
    if (!targetBlockId) return;
    applyStructuredBodyMutation((block, root) => {
      const target = findEmailBlockById(root, targetBlockId);
      if (!target) {
        toast.info('Cílový blok už v náhledu není.');
        return;
      }
      const result = moveEmailBlockBeforeTarget(block, target, root);
      if (!result.ok) {
        toast.info(result.reason);
        return;
      }
      if (result.noop) toast.info('Blok už je na této pozici.');
      else toast.success('Blok přesunut.');
      return result.keepBlockId;
    });
  }, [applyStructuredBodyMutation]);

  const duplicateSelectedBlock = useCallback(() => {
    applyStructuredBodyMutation((block) => {
      // U sloupců duplikovat celý layout, ne jen jednu buňku.
      const target = getColumnsHostForBlock(block) || block;
      const clone = target.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-vb-block-id');
      clone.querySelectorAll('[data-vb-block-id]').forEach((el) => {
        el.removeAttribute('data-vb-block-id');
      });
      target.insertAdjacentElement('afterend', clone);
      const type = inferEmailBlockType(clone);
      clone.setAttribute('data-vb-block', type);
      return target.getAttribute('data-vb-block-id');
    });
  }, [applyStructuredBodyMutation]);

  const deleteSelectedBlock = useCallback(() => {
    applyStructuredBodyMutation((block, root) => {
      // Jednotka ve sloupci → místo smazání celého layoutu vrátíme výběr typu.
      if (isEmailColumnUnit(block)) {
        const host = getColumnsHostForBlock(block);
        const cell = block.parentElement;
        block.remove();
        if (cell && cell.tagName === 'TD' && cell.children.length === 0) {
          cell.innerHTML = buildColumnChooserHtml();
        }
        return host?.getAttribute('data-vb-block-id') || null;
      }
      return deleteEmailBlockNode(block, root);
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedSectionChrome = useCallback((patch: Partial<EmailSectionChrome>) => {
    applyStructuredBodyMutation((block, root, doc) => {
      const host = getHostSectionForBlock(block, root);
      const target = host || (getEmailGroupRow(block, root)
        ? ensureRowIsSection(getEmailGroupRow(block, root)!, doc)
        : null);
      if (!target) {
        toast.info('Skupinu se nepodařilo najít.');
        return;
      }
      applySectionChrome(target, patch);
      // Jediný highlight ve skupině — zakulacení jen na boxu (ne dvě různá ohraničení).
      const only = [...target.children].filter(
        (c) =>
          c.nodeType === 1 &&
          !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName) &&
          (c as HTMLElement).hasAttribute('data-vb-block-id'),
      ) as HTMLElement[];
      if (
        only.length === 1 &&
        only[0].getAttribute('data-vb-block') === 'highlight' &&
        patch.radius !== undefined
      ) {
        applyHighlightChrome(only[0], { radius: patch.radius });
      }
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedSectionFill = useCallback((fill: EmailSectionFill) => {
    updateSelectedSectionChrome({ fill });
  }, [updateSelectedSectionChrome]);

  const updateSelectedHighlightChrome = useCallback((patch: Partial<EmailHighlightChrome>) => {
    applyStructuredBodyMutation((block) => {
      if (block.getAttribute('data-vb-block') !== 'highlight') {
        toast.info('Chrome boxu platí jen u zvýrazněného boxu.');
        return;
      }
      applyHighlightChrome(block, patch);
    });
  }, [applyStructuredBodyMutation]);

  const groupSelectedBlocksIntoSection = useCallback(() => {
    const ids = selectedBlockIds.length >= 2
      ? selectedBlockIds
      : selectedBlock?.id
        ? [selectedBlock.id]
        : [];
    if (ids.length < 2) {
      toast.info('Označ lasem nebo Shift+klikem aspoň dva bloky.');
      return;
    }
    const currentSelected = selectedRef.current;
    const doc = previewIframeRef.current?.contentDocument;
    if (!currentSelected || !doc?.body) return;
    const root = getEmailDndRoot(doc);
    commitHistoryBeforeMutation();
    const result = groupEmailBlocksIntoSection(ids, root, doc);
    if (!result.ok) {
      toast.info(result.reason);
      return;
    }
    const normalizedBody = normalizeBodyForBuilder(doc.body.innerHTML);
    const nextBlockId = result.keepBlockId;
    const nextBlock = nextBlockId ? findEmailBlockById(root, nextBlockId) : null;
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
    setSelectedBlockIds(nextInspector?.id ? [nextInspector.id] : []);
    bumpBodyEpoch();
    if (result.noop) toast.info('Bloky už tvoří jednu skupinu.');
    else toast.success('Sloučeno do jedné skupiny.');
  }, [selectedBlockIds, selectedBlock?.id, commitHistoryBeforeMutation, bumpBodyEpoch]);

  const isolateSelectedBlockGroup = useCallback(() => {
    applyStructuredBodyMutation((block, root, doc) => {
      const result = isolateEmailBlockGroup(block, root, doc);
      if (!result.ok) {
        toast.info(result.reason);
        return;
      }
      if (result.noop) toast.info('Blok už má vlastní kartu.');
      else toast.success('Vyňato ze skupiny.');
      return result.keepBlockId;
    });
  }, [applyStructuredBodyMutation]);

  const nextBlockStyle = (block: HTMLElement, property: string, value: string): string => {
    let style = block.getAttribute('style') || '';
    // Zkratka `background:` by novou barvu překryla — u pozadí ji nejdřív zahodíme.
    if (property === 'background-color') style = setInlineStyleValue(style, 'background', '');
    return setInlineStyleValue(style, property, value);
  };

  const updateSelectedBlockStyle = useCallback((property: string, value: string) => {
    applyStructuredBodyMutation((block) => {
      block.setAttribute('style', nextBlockStyle(block, property, value));
      if (property === 'box-shadow') {
        const on = !!value.trim() && value.trim().toLowerCase() !== 'none';
        if (on) block.setAttribute('data-vb-has-shadow', '1');
        else block.removeAttribute('data-vb-has-shadow');
      }
    });
  }, [applyStructuredBodyMutation]);

  /**
   * Průběžná změna stylu při tažení slideru: zapíše se přímo do bloku v náhledu.
   * Vědomě NEbumpuje `bodyEditEpoch` (ten přepisuje celý dokument v iframu) — uložení
   * zajistí debounced commit, který se pověsí na `input` v náhledu.
   */
  const previewBlockStyleLive = useCallback((property: string, value: string) => {
    const doc = previewIframeRef.current?.contentDocument;
    const blockId = selectedBlock?.id;
    if (!doc?.body || !blockId) return;
    const block = findEmailBlockById(getEmailDndRoot(doc), blockId);
    if (!block) return;
    block.setAttribute('style', nextBlockStyle(block, property, value));
    try {
      doc.body.dispatchEvent(new InputEvent('input', { bubbles: true }));
    } catch {
      doc.body.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, [selectedBlock?.id]);

  /**
   * Začátek tažení slideru: uložíme stav před změnou a označíme „dávku“, aby ho
   * debounced commit z náhledu nezapsal do historie ještě jednou.
   */
  const beginPreviewStyleHistory = useCallback(() => {
    commitHistoryBeforeMutation();
    iframeHistoryBurstRef.current = true;
  }, [commitHistoryBeforeMutation]);

  const setSelectedBlockColumns = useCallback((count: EmailBlockColumnCount) => {
    applyStructuredBodyMutation((block, _root, doc) => {
      const host = getColumnsHostForBlock(block) || block;
      const result = setEmailBlockColumns(host, count, doc);
      if (!result.ok) {
        toast.info(result.reason);
        return;
      }
      if (!result.noop) {
        toast.success(
          count === 1
            ? 'Zpět na jeden sloupec.'
            : `Layout ${count} sloupců — obsah zůstal vlevo, doplňte další.`,
        );
      }
      return result.keepBlockId;
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedBlockLink = useCallback((field: 'text' | 'href', value: string) => {
    applyStructuredBodyMutation((block) => {
      const link = extractFirstLink(block);
      if (!link) return;
      if (field === 'text') link.textContent = value || 'Vyzkoušet zdarma';
      else link.setAttribute('href', value || previewCtaUrl());
    });
  }, [applyStructuredBodyMutation]);

  const updateSelectedBlockImage = useCallback((value: string) => {
    applyStructuredBodyMutation((block) => {
      const image = extractFirstImage(block);
      if (!image) return;
      image.setAttribute('src', value);
    });
  }, [applyStructuredBodyMutation]);

  const previewSelectedImageWidthLive = useCallback((pct: number) => {
    const doc = previewIframeRef.current?.contentDocument;
    const blockId = selectedBlock?.id;
    if (!doc?.body || !blockId) return;
    const block = findEmailBlockById(getEmailDndRoot(doc), blockId);
    if (!block) return;
    const image = extractFirstImage(block);
    if (!image) return;
    applyImageWidthPct(image, pct);
    try {
      doc.body.dispatchEvent(new InputEvent('input', { bubbles: true }));
    } catch {
      doc.body.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, [selectedBlock?.id]);

  const commitSelectedImageWidth = useCallback((pct: number) => {
    applyStructuredBodyMutation((block) => {
      const image = extractFirstImage(block);
      if (!image) return;
      applyImageWidthPct(image, pct);
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
    setCtaFormUrl(selected.ctaUrl || previewCtaUrl());
    setCtaAiHint('');
    setCtaInsertModalOpen(true);
    setCtaAiLoading(true);
    try {
      const r = await fetch(`${SERVER}/admin/mailchimp/generate-inline-cta`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          contextText,
          subject: selected.subject,
          headline: selected.headline,
          defaultCtaUrl: selected.ctaUrl || previewCtaUrl(),
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
    setAiEditBlockId(null);
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

  /** Žluté AI u lišty bloku → upravit právě tento blok v AI agentovi. */
  const startAiEditBlock = useCallback((blockId: string) => {
    clearPendingInsertAnchor();
    setAiInsertAfterAnchorId(null);
    setAiInsertBeforeBlockId(null);
    setAiEditBlockId(blockId);
    setBlockChromeAddMenuOpen(false);
    setToolPanelMode('ai');
    setCapturedSelection(null);
    setSelectedCanvasText('');
    try {
      previewIframeRef.current?.contentDocument?.getSelection()?.removeAllRanges();
    } catch { /* ignore */ }
    window.getSelection()?.removeAllRanges();
    window.setTimeout(() => chatInputRef.current?.focus(), 50);
    toast.message('AI upraví zvolený blok — napište změnu do chatu.', { duration: 2800 });
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
        headers: await authHeaders(),
        body: JSON.stringify({
          contextText,
          subject: selected.subject,
          headline: selected.headline,
          defaultCtaUrl: selected.ctaUrl || previewCtaUrl(),
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
  const sendChatMessage = async (
    prompt: string,
    options?: { chatLabel?: string; fullBodyHtmlReplace?: boolean },
  ) => {
    const msg = prompt.trim();
    if (!msg || generating) return;

    commitHistoryBeforeMutation();

    const insertAnchorId = aiInsertAfterAnchorId;
    const insertBeforeBlockId = aiInsertBeforeBlockId;
    // Žluté AI, nebo auto-scope na vybraný blok u krátké úpravy (ať se nepřepíše celý mail „omylem“).
    let editBlockId = aiEditBlockId;
    if (
      !editBlockId &&
      !insertAnchorId &&
      !insertBeforeBlockId &&
      selected?.bodyHtml &&
      promptLooksLikeScopedBlockEdit(msg)
    ) {
      const selId = selectedBlock?.id || selectedBlockIds[0] || null;
      if (selId) {
        editBlockId = selId;
        setAiEditBlockId(selId);
        toast.message('Úprava jen vybraného bloku (zbytek mailu nechám).', { duration: 2200 });
      }
    }
    const selectionSlice =
      (!insertAnchorId &&
        !insertBeforeBlockId &&
        !editBlockId &&
        (capturedSelection?.trim() || selectedCanvasText.trim() || '')) ||
      null;

    const usePlainSelectionPath =
      Boolean(selectionSlice) &&
      !insertAnchorId &&
      !insertBeforeBlockId &&
      !editBlockId &&
      !options?.fullBodyHtmlReplace;

    let selectionMarkerId: string | null = null;
    if (usePlainSelectionPath) {
      const docMark = previewIframeRef.current?.contentDocument;
      if (docMark?.body) {
        selectionMarkerId = tryWrapIframeSelectionForPlainAiReplace(docMark);
      }
      if (!selectionMarkerId) {
        toast.error(
          'Označení nelze nahradit jako čistý text — zkuste označit souvislý text uvnitř jednoho odstavce.',
        );
        return;
      }
    }

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
      // Pravopis v celém mailu — jen textové uzly (fotky / bloky / HTML struktura beze změny)
      if (
        selected?.bodyHtml &&
        !usePlainSelectionPath &&
        !insertAnchorId &&
        !insertBeforeBlockId &&
        !editBlockId &&
        promptLooksLikeWholeEmailProofread(msg)
      ) {
        const docLive = previewIframeRef.current?.contentDocument;
        const root =
          (docLive?.body?.querySelector('.vb-email-root') as HTMLElement | null) ||
          (docLive?.body as HTMLElement | null);
        if (!docLive?.body || !root) {
          throw new Error('Náhled není k dispozici — otevřete Design a zkuste znovu.');
        }

        const beforeHtml = docLive.body.innerHTML;
        const beforeImgs = listImgSrcsInHtml(beforeHtml);
        const beforeBlockIds = [...docLive.querySelectorAll('[data-vb-block-id]')]
          .map((el) => el.getAttribute('data-vb-block-id') || '')
          .filter(Boolean)
          .sort();

        const { segments, nodes } = collectProofreadSegments(root);
        const metaSegs: ProofreadSegment[] = [];
        if (selected.subject?.trim()) metaSegs.push({ id: 'm-subject', text: selected.subject });
        if (selected.previewText?.trim()) metaSegs.push({ id: 'm-preview', text: selected.previewText });
        if (selected.headline?.trim()) metaSegs.push({ id: 'm-headline', text: selected.headline });

        const allSegs = [...segments, ...metaSegs];
        if (!allSegs.length) {
          const emptyMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: 'ai',
            content: 'V mailu jsem nenašel text k opravě.',
            timestamp: new Date().toISOString(),
          };
          setChatMsgs([...historyWithUser, emptyMsg]);
          return;
        }

        const batches = chunkProofreadSegments(allSegs, 36);
        const corrections: ProofreadSegment[] = [];
        for (const batch of batches) {
          const runBatch = async () => {
            const response = await fetch(`${SERVER}/admin/mailchimp/proofread-email-segments`, {
              method: 'POST',
              headers: await authHeaders(),
              body: JSON.stringify({ segments: batch, model: emailGenTier }),
            });
            const data = (await response.json()) as Record<string, unknown>;
            return { response, data };
          };
          let { response, data } = await runBatch();
          let errStr = typeof data.error === 'string' ? data.error : '';
          if (
            (!response.ok || data.error) &&
            (geminiErrorLooksOverloaded(errStr) || response.status === 503 || response.status === 429)
          ) {
            toast.info('Gemini je dočasně přetížená — zkouším znovu…', { duration: 4000 });
            await new Promise((r) => setTimeout(r, 6000));
            ({ response, data } = await runBatch());
            errStr = typeof data.error === 'string' ? data.error : '';
          }
          if (!response.ok || data.error) {
            throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
          }
          const got = Array.isArray(data.segments) ? (data.segments as ProofreadSegment[]) : [];
          corrections.push(...got);
        }

        const bodyCorr = corrections.filter((c) => !String(c.id).startsWith('m-'));
        const { changed: bodyChanged, skipped } = applyProofreadCorrections(nodes, segments, bodyCorr);

        const metaById = new Map(corrections.map((c) => [c.id, c.text]));
        let nextSubject = selected.subject || '';
        let nextPreview = selected.previewText || '';
        let nextHeadline = selected.headline || '';
        let metaChanged = 0;
        const takeMeta = (id: string, prev: string): string => {
          const n = metaById.get(id);
          if (n == null || n === prev) return prev;
          if (n.length > Math.max(40, Math.ceil(prev.length * 1.35) + 12)) return prev;
          metaChanged++;
          return n;
        };
        nextSubject = takeMeta('m-subject', nextSubject);
        nextPreview = takeMeta('m-preview', nextPreview);
        nextHeadline = takeMeta('m-headline', nextHeadline);

        const afterHtmlRaw = docLive.body.innerHTML;
        const afterImgs = listImgSrcsInHtml(afterHtmlRaw);
        const afterBlockIds = [...docLive.querySelectorAll('[data-vb-block-id]')]
          .map((el) => el.getAttribute('data-vb-block-id') || '')
          .filter(Boolean)
          .sort();
        const imgsOk =
          beforeImgs.length === afterImgs.length &&
          beforeImgs.every((src) => imgSrcPresentInHtml(afterHtmlRaw, src));
        const blocksOk =
          beforeBlockIds.length === afterBlockIds.length &&
          beforeBlockIds.every((id, i) => id === afterBlockIds[i]);

        if (!imgsOk || !blocksOk) {
          docLive.body.innerHTML = beforeHtml;
          throw new Error(
            'Ověření selhalo (struktura/fotky by se mohly změnit) — mail jsem nechal beze změny.',
          );
        }

        const now = new Date().toISOString();
        const totalChanged = bodyChanged + metaChanged;
        const aiMsg: ChatMsg = {
          id: crypto.randomUUID(),
          role: 'ai',
          content:
            totalChanged === 0
              ? 'Prošel jsem celý mail — žádné pravopisné/gramatické chyby jsem nenašel. Fotky a struktura beze změny.'
              : `✅ Opraveno ${totalChanged} textových úsek${totalChanged === 1 ? '' : totalChanged < 5 ? 'y' : 'ů'} (jen pravopis/gramatika). Fotky, bloky a HTML struktura zůstaly stejné.${skipped ? ` (${skipped} úseků jsem přeskočil jako rizikové.)` : ''}`,
          timestamp: now,
        };
        const updatedHistory = [...historyWithUser, aiMsg];
        setChatMsgs(updatedHistory);

        if (totalChanged > 0) {
          const normalizedBody = normalizeBodyForBuilder(docLive.body.innerHTML);
          const updatedDraft = normalizeDraftForBuilder({
            ...selected,
            subject: nextSubject,
            previewText: nextPreview,
            headline: nextHeadline,
            bodyHtml: normalizedBody,
            updatedAt: now,
            chatHistory: updatedHistory,
          });
          setSelected(updatedDraft);
          setDrafts((prev) => prev.map((d) => (d.id === updatedDraft.id ? updatedDraft : d)));
          bumpBodyEpoch();
          await saveDraft(updatedDraft);
          toast.success(`Pravopis: ${totalChanged} oprav`);
        } else {
          const updatedDraft = normalizeDraftForBuilder({
            ...selected,
            chatHistory: updatedHistory,
            updatedAt: now,
          });
          setSelected(updatedDraft);
          setDrafts((prev) => prev.map((d) => (d.id === updatedDraft.id ? updatedDraft : d)));
          await saveDraft(updatedDraft);
        }
        return;
      }

      // Rychlá oprava bez Gemini: „bloky webinářů“ / odstranění divného hero na aktuálním HTML
      const localFix =
        activeBuilderMode === 'block' &&
        !!selected?.bodyHtml &&
        !usePlainSelectionPath &&
        !insertAnchorId &&
        !insertBeforeBlockId &&
        !editBlockId &&
        /(?:blok(y)?\s+webin|webin[aá]?[rř].*blok|převeď.*webin|webin.*odkaz|oprav\s+hero|bez\s+hero|odstraň\s+hero)/i.test(
          msg,
        );
      if (localFix && selected) {
        const headers = await authHeaders();
        const [webRes, prodRes] = await Promise.all([
          fetch(`${SERVER}/webinare`, { headers }),
          fetch(`${SERVER}/products`, { headers }),
        ]);
        const webJson = webRes.ok ? await webRes.json().catch(() => null) : null;
        const prodJson = prodRes.ok ? await prodRes.json().catch(() => null) : null;
        const webinars = Array.isArray(webJson?.items)
          ? webJson.items
          : Array.isArray(webJson)
            ? webJson
            : [];
        const products = Array.isArray(prodJson?.products)
          ? prodJson.products
          : Array.isArray(prodJson)
            ? prodJson
            : [];
        const hydrated = hydrateEmailAiEditorBlocks(selected.bodyHtml, webinars, products, {
          headline: selected.headline,
          forceInjectWebinars: /webin/i.test(msg),
        });
        const now = new Date().toISOString();
        const aiMsg: ChatMsg = {
          id: crypto.randomUUID(),
          role: 'ai',
          content:
            hydrated.notes.length > 0
              ? `✅ Hotovo bez nového generování: ${hydrated.notes.join(' ')}`
              : 'V mailu jsem nenašel co napojit — zkontroluj, že názvy webinářů sedí s CMS, nebo nech AI mail přegenerovat.',
          timestamp: now,
        };
        const updatedHistory = [...historyWithUser, aiMsg];
        setChatMsgs(updatedHistory);
        if (hydrated.html !== selected.bodyHtml) {
          const updatedDraft: EmailDraft = {
            ...selected,
            bodyHtml: hydrated.html,
            updatedAt: now,
            chatHistory: updatedHistory,
          };
          setSelected(updatedDraft);
          setDrafts(prev => prev.map(d => (d.id === updatedDraft.id ? updatedDraft : d)));
          bumpBodyEpoch();
          await saveDraft(updatedDraft);
        }
        return;
      }

      if (usePlainSelectionPath && selectionMarkerId && selectionSlice) {
        const runPlain = async () => {
          const response = await fetch(`${SERVER}/admin/mailchimp/rewrite-email-selection-plain`, {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({
              instruction: msg,
              selectedPlainText: selectionSlice,
              model: emailGenTier,
            }),
          });
          const data = (await response.json()) as Record<string, unknown>;
          return { response, data };
        };
        let { response, data } = await runPlain();
        let errStr = typeof data.error === 'string' ? data.error : '';
        const badFirst = !response.ok || Boolean(data.error);
        if (
          badFirst &&
          (geminiErrorLooksOverloaded(errStr) || response.status === 503 || response.status === 429)
        ) {
          toast.info('Gemini je dočasně přetížená — zkouším znovu za pár sekund…', { duration: 5000 });
          await new Promise((r) => setTimeout(r, 7000));
          ({ response, data } = await runPlain());
          errStr = typeof data.error === 'string' ? data.error : '';
        }
        if (!response.ok || data.error) {
          throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
        }
        const replacement = String(data.replacementText || '').trim();
        if (!replacement) throw new Error('Prázdná odpověď AI');

        const docApply = previewIframeRef.current?.contentDocument;
        if (!docApply?.body) throw new Error('Náhled není k dispozici');
        if (!applyPlainTextInVbAiReplaceMarker(docApply, selectionMarkerId, replacement)) {
          unwrapVbAiReplaceMarkers(docApply);
          throw new Error('Označené místo v náhledu už neplatí — zkuste znovu označit text.');
        }

        const normalizedBody = normalizeBodyForBuilder(docApply.body.innerHTML);
        const now = new Date().toISOString();

        const aiMsg: ChatMsg = {
          id: crypto.randomUUID(),
          role: 'ai',
          content:
            'Hotovo — označený úsek je nahrazen čistým textem; styly a HTML struktura v okolí zůstaly zachované.',
          timestamp: now,
        };
        const updatedHistory = [...historyWithUser, aiMsg];
        setChatMsgs(updatedHistory);

        const base = selected || { ...EMPTY_DRAFT, id: crypto.randomUUID(), createdAt: now };
        const updatedDraft = normalizeDraftForBuilder({
          ...base,
          bodyHtml: normalizedBody,
          updatedAt: now,
          chatHistory: updatedHistory,
        });

        setSelected(updatedDraft);
        setDrafts((prev) => {
          const idx = prev.findIndex((x) => x.id === updatedDraft.id);
          if (idx >= 0) {
            const n = [...prev];
            n[idx] = updatedDraft;
            return n;
          }
          return [updatedDraft, ...prev];
        });
        bumpBodyEpoch();
        await saveDraft(updatedDraft);
        return;
      }

      const convCtx = historyWithUser.map(m => `${m.role === 'user' ? 'Uživatel' : 'AI'}: ${m.content}`).join('\n');

      const docLive = previewIframeRef.current?.contentDocument;
      const anchorStill =
        !!(insertAnchorId && docLive?.body?.querySelector(`[data-vb-insert="${insertAnchorId}"]`));
      const beforeTargetStill =
        !!(
          insertBeforeBlockId &&
          docLive?.body?.querySelector(`[data-vb-block-id="${CSS.escape(insertBeforeBlockId)}"]`)
        );
      const editTargetStill =
        !!(
          editBlockId &&
          docLive?.body?.querySelector(`[data-vb-block-id="${CSS.escape(editBlockId)}"]`)
        );

      let currentEmailCtx = '';
      let currentOutline = '';
      if (selected && (selected.subject || selected.bodyHtml)) {
        const outlineSrc =
          editBlockId && docLive
            ? getBlockOuterHtmlForAiByBlockId(docLive, editBlockId, { maxLen: 40_000 })
            : selected.bodyHtml || '';
        currentOutline = serializeEmailBodyToOutline(outlineSrc);
        currentEmailCtx =
          `\n\nAktuální email (jen textové bloky, NE HTML):\nPředmět: ${selected.subject}\nPreview: ${selected.previewText}\nNadpis: ${selected.headline}\nCTA: ${selected.ctaText} → ${selected.ctaUrl}\nAudience: ${selected.audience}` +
          (currentOutline ? `\n\nAktuální email jako textové bloky:\n${currentOutline}` : '');
      }

      let selectionCtx = '';
      if (selectionSlice) {
        selectionCtx =
          '\n\n[DŮLEŽITÉ — režim výběru: Uživatel označil tento text. Uprav ho v outline (ODSTAVEC/NADPIS), zbytek bloků nech. ' +
          `Označený text:\n"""${selectionSlice}"""`;
      }

      let insertCtx = '';
      if (editBlockId) {
        if (!editTargetStill) {
          toast.warning('Blok pro AI úpravu už v náhledu není — zvolte ho znovu žlutým AI u lišty.');
          clearAiInsertIntent();
          setGenerating(false);
          return;
        }
        const targetHtml = getBlockOuterHtmlForAiByBlockId(docLive, editBlockId, { maxLen: 20000 });
        if (!targetHtml) {
          toast.warning('Nepodařilo se přečíst blok pro AI úpravu — zkuste znovu.');
          clearAiInsertIntent();
          setGenerating(false);
          return;
        }
        insertCtx =
          '\n\n[DŮLEŽITÉ — režim úpravy JEDNOHO bloku · POVINNÉ]: Uživatel zvolil konkrétní blok (žluté AI u lišty). ' +
          `id=${editBlockId} — toto id NIKDY neměň. ` +
          'V outline vrať POUZE text tohoto jednoho bloku (NADPIS/ODSTAVEC/…). Žádné HTML. ' +
          'subject / headline / previewText / cta NECH beze změny. ' +
          `Blok k úpravě jako text:\n"""${serializeEmailBodyToOutline(targetHtml) || targetHtml}"""`;
      } else if (insertBeforeBlockId) {
        if (!beforeTargetStill) {
          toast.warning('Cílový blok v náhledu už není — zrušte režim vložení nebo zvolte blok znovu.');
          clearAiInsertIntent();
        } else {
          const targetHtml = getBlockOuterHtmlForAiByBlockId(docLive, insertBeforeBlockId);
          const beforeTxt = getPlainTextBeforeBlockId(docLive, insertBeforeBlockId);
          if (targetHtml) {
            insertCtx =
              '\n\n[DŮLEŽITÉ — režim vložení v náhledu (nad blok): nový obsah IHNED PŘED tento blok. ' +
              'V outline vrať POUZE nové bloky (NADPIS/ODSTAVEC/…), žádné HTML, žádný existující mail. ' +
              `Blok, před který vložit:\n"""${serializeEmailBodyToOutline(targetHtml) || targetHtml}"""\n` +
              `Text před tímto blokem:\n"""${beforeTxt.slice(-2000)}"""`;
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
              '\n\n[DŮLEŽITÉ — režim vložení v náhledu (za blok): nový obsah IHNED ZA tento blok. ' +
              'V outline vrať POUZE nové bloky (NADPIS/ODSTAVEC/…), žádné HTML. ' +
              `Blok, za který vložit:\n"""${serializeEmailBodyToOutline(anchorHtml) || anchorHtml}"""\n` +
              `Text před tímto blokem:\n"""${beforeTxt.slice(-2000)}"""`;
          } else {
            toast.warning('Nepodařilo se přečíst blok pro vložení — zkuste znovu.');
            clearAiInsertIntent();
          }
        }
      }

      const wantsAdditiveInsert =
        !editBlockId &&
        !insertAnchorId &&
        !insertBeforeBlockId &&
        !!selected?.bodyHtml &&
        promptWantsAdditiveBlockInsert(msg);

      let additiveConversationCtx = '';
      if (wantsAdditiveInsert && selected?.bodyHtml) {
        const summaries = listEmailSectionSummariesForAi(selected.bodyHtml);
        insertCtx =
          '\n\n[DŮLEŽITÉ — režim VLOŽENÍ JEDNOHO/VÍCE NOVÝCH BLOKŮ (fragment)]\n' +
          'Uživatel chce PŘIDAT obsah. V outline vrať POUZE nové bloky (NADPIS/ODSTAVEC/WEBINÁŘ/…), NIKDY celý mail.\n' +
          'subject/previewText/headline nech beze změny.\n' +
          (summaries
            ? `\nExistující sekce (tyto NEVRACEJ):\n${summaries}\n`
            : '') +
          'Pokyn uživatele k novému obsahu je v poslední zprávě.';
        // Bez plného bodyHtml — jinak model zkopíruje celý mail a graft selže.
        additiveConversationCtx =
          `\n\nAktuální email (jen meta, NE celé HTML):\nPředmět: ${selected.subject}\nNadpis: ${selected.headline}\n` +
          insertCtx;
        insertCtx = '';
      }

      const genBody = {
        prompt: msg,
        conversationContext: wantsAdditiveInsert
          ? convCtx + additiveConversationCtx + selectionCtx
          : convCtx + currentEmailCtx + selectionCtx + insertCtx,
        model: emailGenTier,
        rag: emailGenRagEnabled,
        preferEmailBuilderBlocks: activeBuilderMode === 'block',
        /** Server nesmí force-injectovat webináře / mazat hero při úpravě jednoho bloku / fragment insert. */
        scopedBlockEdit:
          Boolean(editBlockId) ||
          wantsAdditiveInsert ||
          Boolean(insertAnchorId) ||
          Boolean(insertBeforeBlockId),
        skipBriefPhase:
          wantsAdditiveInsert ||
          Boolean(editBlockId) ||
          Boolean(insertAnchorId) ||
          Boolean(insertBeforeBlockId),
        insertFragmentOnly:
          wantsAdditiveInsert || Boolean(insertAnchorId) || Boolean(insertBeforeBlockId),
        returnEditedBlockOnly: Boolean(editBlockId),
        outlineMode: true,
        currentOutline,
      };
      let { data } = await fetchGenerateEmailWithRetry(
        `${SERVER}/admin/mailchimp/generate-email`,
        await authHeaders(),
        genBody,
        () =>
          toast.info('Gemini je dočasně přetížená — zkouším znovu za pár sekund…', { duration: 5000 }),
      );
      const jsonCutOff =
        typeof data.error === 'string' &&
        /validni JSON|Neúplný JSON|nezavřená závorka/i.test(data.error);
      if (
        jsonCutOff &&
        selected?.bodyHtml &&
        !editBlockId &&
        !insertAnchorId &&
        !insertBeforeBlockId &&
        !wantsAdditiveInsert
      ) {
        toast.info('Odpověď AI byla useknutá — zkouším kratší výstup…', { duration: 4000 });
        const compactBody = {
          ...genBody,
          skipBriefPhase: true,
          conversationContext:
            convCtx +
            `\n\nAktuální email (jen meta + osnova, NE celé HTML — předchozí pokus usekl JSON):\n` +
            `Předmět: ${selected.subject}\nNadpis: ${selected.headline}\n` +
            `Sekce:\n${listEmailSectionSummariesForAi(selected.bodyHtml, 16)}\n` +
            selectionCtx,
          prompt:
            `${msg}\n\n[DŮLEŽITÉ] Předchozí odpověď byla useknutá uprostřed JSON. ` +
            'Vrať platný kompletní JSON. bodyHtml drž kompaktní (žádné zbytečné opakování inline stylů).',
        };
        const retry = await fetchGenerateEmailWithRetry(
          `${SERVER}/admin/mailchimp/generate-email`,
          await authHeaders(),
          compactBody,
          () =>
            toast.info('Gemini je dočasně přetížená — zkouším znovu za pár sekund…', { duration: 5000 }),
        );
        data = retry.data;
      }
      if (data.error) throw new Error(data.raw ? `${data.error}\n\nRaw: ${data.raw}` : String(data.error));

      const e = data.email || {};
      const now = new Date().toISOString();

      // Žluté AI u bloku: model často přepíše celý mail — do draftu sloučíme JEN ten blok.
      let mergedBodyHtml = e.bodyHtml || selected?.bodyHtml || '';
      let singleBlockEditApplied = false;
      let additiveInsertApplied = false;
      if (editBlockId) {
        const originalBody =
          (docLive?.body ? stripDataVbInsertFromHtml(docLive.body.innerHTML) : '') ||
          selected?.bodyHtml ||
          '';
        const merged = mergeAiEditedBlockIntoBodyHtml(
          originalBody,
          editBlockId,
          String(e.bodyHtml || ''),
          { userMsg: msg },
        );
        if (!merged.ok) {
          const why =
            merged.reason === 'would-drop-block-images'
              ? 'AI by z bloku odstranila obrázky — nepřepsal jsem nic. Napište výslovně „smaž fotky“, pokud to opravdu chcete.'
              : 'AI nevrátila upravený blok se stejným id — mail jsem nepřepsal. Zkuste kratší pokyn nebo znovu žluté AI.';
          toast.error(why);
          const failMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: 'ai',
            content: why,
            ragDebug: data.ragDebug || null,
            timestamp: now,
          };
          setChatMsgs([...historyWithUser, failMsg]);
          clearAiInsertIntent();
          setGenerating(false);
          return;
        }
        mergedBodyHtml = merged.html;
        singleBlockEditApplied = true;
      } else if (selected?.bodyHtml && e.bodyHtml && (insertBeforeBlockId || insertAnchorId)) {
        const originalBody =
          (docLive?.body ? stripDataVbInsertFromHtml(docLive.body.innerHTML) : '') ||
          selected.bodyHtml;
        const placed = insertAiFragmentRelativeToBlock(originalBody, String(e.bodyHtml || ''), {
          beforeBlockId: insertBeforeBlockId,
          afterInsertAttr: insertAnchorId,
        });
        if (placed.ok) {
          mergedBodyHtml = placed.html;
          additiveInsertApplied = true;
          toast.success(
            `Vloženo ${placed.inserted} blok(ů) — ostatní obsah a fotky beze změny.`,
            { duration: 4000 },
          );
        } else {
          const additive = mergeAdditiveAiBlocksIntoOriginal(
            originalBody,
            String(e.bodyHtml),
            msg,
          );
          if (additive.ok) {
            mergedBodyHtml = additive.html;
            additiveInsertApplied = true;
            toast.success(
              `Vloženo ${additive.inserted} blok(ů) — ostatní obsah a fotky beze změny.`,
              { duration: 4000 },
            );
          } else {
            const why =
              'Nepodařilo se vložit nový blok z odpovědi AI. Zkus kratší pokyn, nebo zvolte místo vložení znovu.';
            toast.error(why);
            const failMsg: ChatMsg = {
              id: crypto.randomUUID(),
              role: 'ai',
              content: why,
              ragDebug: data.ragDebug || null,
              timestamp: now,
            };
            setChatMsgs([...historyWithUser, failMsg]);
            clearAiInsertIntent();
            setGenerating(false);
            return;
          }
        }
      } else if (selected?.bodyHtml && e.bodyHtml && promptWantsAdditiveBlockInsert(msg)) {
        // „Přidej blok…“ — výhradně graft do původního HTML (fotky nikdy nepřepisujeme).
        let additive = mergeAdditiveAiBlocksIntoOriginal(
          selected.bodyHtml,
          String(e.bodyHtml),
          msg,
        );
        if (!additive.ok) {
          // Vynucený fragment: celá AI odpověď jako jedna nová karta (nová id).
          const inner = String(e.bodyHtml || '')
            .replace(/^[\s\S]*?<div[^>]*class="[^"]*vb-email-root[^"]*"[^>]*>/i, '')
            .replace(/<\/div>\s*$/i, '')
            .trim();
          const forced = wrapRootBlockInSection(
            `<div data-vb-block="text" data-vb-block-id="${randomBlockId()}" style="padding:10px 24px;background-color:transparent;">${
              inner || String(e.bodyHtml)
            }</div>`,
            'card',
          );
          additive = mergeAdditiveAiBlocksIntoOriginal(selected.bodyHtml, forced, msg);
        }
        if (additive.ok) {
          mergedBodyHtml = additive.html;
          additiveInsertApplied = true;
          toast.success(
            `Vloženo ${additive.inserted} blok(ů) — ostatní obsah a fotky beze změny.`,
            { duration: 4000 },
          );
        } else {
          const why =
            'Nepodařilo se připravit nový blok z odpovědi AI. Zkus kratší pokyn, např. „přidej za aplikaci blok o katalogu sešitů“.';
          toast.error(why);
          const failMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: 'ai',
            content: why,
            ragDebug: data.ragDebug || null,
            timestamp: now,
          };
          setChatMsgs([...historyWithUser, failMsg]);
          setGenerating(false);
          return;
        }
      } else if (selected?.bodyHtml && e.bodyHtml) {
        // Plný přepis: když AI „ztratí“ fotky, vrať asset-bloky z originálu.
        const rescued = restoreMissingAssetBlocksFromOriginal(
          selected.bodyHtml,
          String(e.bodyHtml),
          msg,
        );
        mergedBodyHtml = rescued.html;
        if (rescued.restored > 0) {
          toast.warning(
            `AI vyhodila ${rescued.lostSrcs.length} obrázků — vrátil jsem ${rescued.restored} blok(y) s fotkami zpět.`,
            { duration: 5000 },
          );
        } else if (
          rescued.lostSrcs.length > 0 &&
          !promptAllowsDestructiveAssetChange(msg) &&
          !promptWantsFullEmailRewrite(msg)
        ) {
          // Poslední pojistka: i když detekce „přidej“ selhala, zkus graft nových bloků
          // místo hard-rejectu (typicky „… dej blok …“ / vložení za sekci).
          const additiveFallback = mergeAdditiveAiBlocksIntoOriginal(
            selected.bodyHtml,
            String(e.bodyHtml),
            msg,
          );
          if (additiveFallback.ok) {
            mergedBodyHtml = additiveFallback.html;
            additiveInsertApplied = true;
            toast.success(
              `Vloženo ${additiveFallback.inserted} blok(ů) — existující fotky zůstaly.`,
              { duration: 4000 },
            );
          } else {
            toast.error(
              'AI by odstranila obrázky z mailu — nepřepsal jsem náhled. Pro úpravu jednoho bloku použijte žluté AI; pro kompletní přegenerování napište „přegeneruj celý mail“.',
            );
            const failMsg: ChatMsg = {
              id: crypto.randomUUID(),
              role: 'ai',
              content:
                'Odmítnuto: odpověď AI by zahodila existující fotky. Mail nechávám beze změny. Žluté AI u bloku = úprava jen toho bloku.',
              ragDebug: data.ragDebug || null,
              timestamp: now,
            };
            setChatMsgs([...historyWithUser, failMsg]);
            setGenerating(false);
            return;
          }
        }
      }

      let aiText = '';
      if (singleBlockEditApplied) {
        aiText = 'Upraven jen zvolený blok — zbytek mailu beze změny.';
      } else if (additiveInsertApplied) {
        aiText = 'Přidaný blok vložen do mailu — existující obsah a fotky beze změny.';
      } else {
        if (e.subject) aiText += `**Předmět:** ${e.subject}\n`;
        if (e.headline) aiText += `**Nadpis:** ${e.headline}\n`;
        if (e.previewText) aiText += `**Preview:** ${e.previewText}\n`;
        aiText += '\nEmail byl aktualizován v náhledu.';
      }

      const aiMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: aiText,
        ragDebug: data.ragDebug || null,
        timestamp: now,
      };

      const updatedHistory = [...historyWithUser, aiMsg];
      setChatMsgs(updatedHistory);

      const preserveMeta = singleBlockEditApplied || additiveInsertApplied;
      const updatedDraft: EmailDraft = {
        ...(selected || { ...EMPTY_DRAFT, id: crypto.randomUUID(), createdAt: now }),
        subject: preserveMeta ? selected?.subject || '' : e.subject || selected?.subject || '',
        previewText: preserveMeta
          ? selected?.previewText || ''
          : e.previewText || selected?.previewText || '',
        headline: preserveMeta
          ? selected?.headline || ''
          : e.headline || selected?.headline || '',
        bodyHtml: mergedBodyHtml,
        ctaText: preserveMeta
          ? selected?.ctaText || 'Vyzkoušejte zdarma'
          : e.ctaText || selected?.ctaText || 'Vyzkoušejte zdarma',
        ctaUrl: preserveMeta
          ? selected?.ctaUrl || previewCtaUrl()
          : e.ctaUrl || selected?.ctaUrl || previewCtaUrl(),
        audience: preserveMeta
          ? selected?.audience || 'newsletter'
          : e.audience || selected?.audience || 'newsletter',
        fullHtml: preserveMeta ? selected?.fullHtml || '' : e.fullHtml || '',
        status: 'draft' as const,
        updatedAt: now,
        chatHistory: updatedHistory,
      };

      // Napoj webináře/koláž — u scoped edit jen když AI vrátila placeholdery (žádný forceInject / strip hero).
      if (activeBuilderMode === 'block' && updatedDraft.bodyHtml) {
        const hydrateScopeHtml = singleBlockEditApplied
          ? extractBlockOuterHtmlFromBodyHtml(updatedDraft.bodyHtml, editBlockId!) || ''
          : updatedDraft.bodyHtml;
        const wantsWebinarBlocks =
          !singleBlockEditApplied &&
          !additiveInsertApplied &&
          /webin[aá]?[rř]|blok(y)?\s+webin|data-ai-webinar|dvpp|naživo/i.test(
            `${msg}\n${updatedDraft.bodyHtml}`,
          );
        const needsHydrate = singleBlockEditApplied
          ? /data-ai-webinar-slug|data-ai-product-ids/i.test(hydrateScopeHtml)
          : additiveInsertApplied
            ? /data-ai-webinar-slug|data-ai-product-ids/i.test(hydrateScopeHtml)
            : /data-ai-webinar-slug|data-ai-product-ids|data-vb-block=["']hero["']|#00116[18]/i.test(
                hydrateScopeHtml,
              ) || wantsWebinarBlocks;
        if (needsHydrate) {
          try {
            const headers = await authHeaders();
            const [webRes, prodRes] = await Promise.all([
              fetch(`${SERVER}/webinare`, { headers }),
              fetch(`${SERVER}/products`, { headers }),
            ]);
            const webJson = webRes.ok ? await webRes.json().catch(() => null) : null;
            const prodJson = prodRes.ok ? await prodRes.json().catch(() => null) : null;
            const webinars = Array.isArray(webJson?.items)
              ? webJson.items
              : Array.isArray(webJson?.webinars)
                ? webJson.webinars
                : Array.isArray(webJson)
                  ? webJson
                  : [];
            const products = Array.isArray(prodJson?.products)
              ? prodJson.products
              : Array.isArray(prodJson?.items)
                ? prodJson.items
                : Array.isArray(prodJson)
                  ? prodJson
                  : [];
            const hydrateInput =
              singleBlockEditApplied && hydrateScopeHtml
                ? hydrateScopeHtml
                : updatedDraft.bodyHtml;
            const hydrated = hydrateEmailAiEditorBlocks(hydrateInput, webinars, products, {
              headline: updatedDraft.headline,
              // Nikdy neinjectovat webináře při scoped edit — jinak mizí okolní obsah/fotky.
              forceInjectWebinars: wantsWebinarBlocks && !singleBlockEditApplied,
            });
            if (hydrated.html !== hydrateInput) {
              if (singleBlockEditApplied && editBlockId) {
                const rem = mergeAiEditedBlockIntoBodyHtml(
                  updatedDraft.bodyHtml,
                  editBlockId,
                  // Obal, ať extract najde stejné id i když hydrate vrátil jen vnitřek.
                  /data-vb-block-id=/.test(hydrated.html)
                    ? hydrated.html
                    : `<div data-vb-block-id="${editBlockId}">${hydrated.html}</div>`,
                  { userMsg: msg },
                );
                if (rem.ok) updatedDraft.bodyHtml = rem.html;
              } else {
                const rescued = restoreMissingAssetBlocksFromOriginal(
                  selected?.bodyHtml || updatedDraft.bodyHtml,
                  hydrated.html,
                  msg,
                );
                updatedDraft.bodyHtml = rescued.html;
                if (rescued.restored > 0) {
                  toast.warning(`Po napojení bloků jsem vrátil ${rescued.restored} blok(y) s obrázky.`);
                }
              }
              updatedDraft.updatedAt = new Date().toISOString();
              if (hydrated.notes.length) {
                const note: ChatMsg = {
                  id: crypto.randomUUID(),
                  role: 'ai',
                  content: `✅ Bloky editoru: ${hydrated.notes.join(' ')}`,
                  timestamp: new Date().toISOString(),
                };
                updatedHistory.push(note);
                updatedDraft.chatHistory = updatedHistory;
                setChatMsgs(updatedHistory);
              }
            }
          } catch (hydrateErr) {
            console.warn('[EmailBuilder] AI block hydrate failed', hydrateErr);
          }
        }
      }

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

      const productImages: string[] = singleBlockEditApplied
        ? []
        : e.productImages || data.email?.productImages || [];
      const hasEncodedCollage = /data-vb-pc-encoded=/i.test(updatedDraft.bodyHtml || '');
      const hasAiCollageIds = /data-ai-product-ids=/i.test(updatedDraft.bodyHtml || '');
      // Legacy fallback: prázdný data-product-collage bez encoded payloadu
      if (
        !singleBlockEditApplied &&
        !hasEncodedCollage &&
        !hasAiCollageIds &&
        productImages.length >= 2 &&
        updatedDraft.bodyHtml &&
        updatedDraft.bodyHtml.includes('data-product-collage')
      ) {
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
      } else if (
        !hasEncodedCollage &&
        !hasAiCollageIds &&
        productImages.length === 1 &&
        updatedDraft.bodyHtml
      ) {
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
      if (insertAnchorId || insertBeforeBlockId || editBlockId) clearAiInsertIntent();
    } catch (e: unknown) {
      if (selectionMarkerId) {
        try {
          const d = previewIframeRef.current?.contentDocument;
          if (d?.body) unwrapVbAiReplaceMarkers(d);
        } catch {
          /* ignore */
        }
      }
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
    if (aiInsertAfterAnchorId || aiInsertBeforeBlockId || aiEditBlockId) {
      toast.info('Zrušte nejdřív režim vložení / úpravy bloku v chatu (křížek u žlutého / jantarového pruhu).');
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
    await sendChatMessage(prompt, { chatLabel: label, fullBodyHtmlReplace: true });
  };

  /**
   * Aktuální HTML z iframe náhledu (obrázky můžou být novější než React state).
   * Nikdy nepřepisuj draft placeholderem / prázdným / ořezaným HTML po remountu iframe.
   */
  const flushLivePreviewBodyHtml = useCallback((draft: EmailDraft): EmailDraft => {
    const doc = previewIframeRef.current?.contentDocument;
    if (!doc?.body) return draft;
    const root =
      (doc.body.querySelector(':scope > .vb-email-root') as HTMLElement | null) ||
      (doc.body.querySelector('.vb-email-root') as HTMLElement | null);
    const liveRaw = (root?.outerHTML || doc.body.innerHTML || '').trim();
    if (!liveRaw) return draft;
    // Placeholder / prázdný editor — nebrat
    if (/Klikněte a pište/i.test(liveRaw) && liveRaw.length < 200) return draft;
    if (!/data-vb-block|vb-email-root/i.test(liveRaw)) return draft;
    const prevLen = (draft.bodyHtml || '').trim().length;
    // Po remountu iframe občas chvíli drží ořezaný obsah — nesahej na draft, když je výrazně kratší
    if (prevLen > 400 && liveRaw.length < prevLen * 0.55) return draft;
    const normalized = normalizeBodyForBuilder(liveRaw);
    if (!normalized || normalized === draft.bodyHtml) return draft;
    if (prevLen > 400 && normalized.length < prevLen * 0.55) return draft;
    return normalizeDraftForBuilder({
      ...draft,
      bodyHtml: normalized,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const pushToMailchimp = async () => {
    const snap0 = selectedRef.current;
    if (!snap0) return;
    if (!String(snap0.subject || '').trim()) {
      toast.error('Nejdřív vyplňte předmět.');
      return;
    }
    setPushing(true);
    try {
      /* Nejdřív propsat náhled (výměna fotky) do draftu, jinak jde do MC stará verze. */
      const snap = flushLivePreviewBodyHtml(snap0);
      if (snap.bodyHtml !== snap0.bodyHtml) {
        setSelected(snap);
        setDrafts((prev) => prev.map((d) => (d.id === snap.id ? snap : d)));
        selectedRef.current = snap;
      }
      const saved = await saveDraft(snap, { quiet: true });
      if (!saved) throw new Error('Draft se nepodařilo uložit před exportem.');

      const bodyContent = compileEmailBodyForSend(saved.bodyHtml);
      if (!bodyContent || bodyContent.length < 40) {
        throw new Error('Tělo mailu je prázdné — zkontrolujte náhled a uložte draft.');
      }

      const r = await fetchWithAdminAuth(`${SERVER}/admin/mailchimp/create-draft`, {
        method: 'POST',
        json: true,
        body: JSON.stringify({
          subject: saved.subject,
          previewText: saved.previewText,
          headline: saved.headline,
          bodyContent,
          outerBackground: normalizeHexColor(saved.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG),
          ctaText: saved.ctaText,
          ctaUrl: saved.ctaUrl || previewCtaUrl(),
          audience: saved.audience || 'newsletter',
          /** Aktualizuj tutéž MC kampaň místo zakládání nové (starý odkaz = starý obrázek). */
          campaignId: saved.mailchimpCampaignId || undefined,
        }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = (await r.json()) as Record<string, unknown>;
      } catch {
        throw new Error(`Mailchimp API vrátilo neplatnou odpověď (HTTP ${r.status}).`);
      }
      if (!r.ok || data.error) {
        throw new Error(String(data.error || `HTTP ${r.status}`));
      }

      const mcUrl = String(data.mailchimpUrl || data.archiveUrl || data.webUrl || '').trim();
      const updated = normalizeDraftForBuilder({
        ...saved,
        status: 'pushed' as const,
        mailchimpCampaignId: String(data.campaignId || saved.mailchimpCampaignId || ''),
        mailchimpUrl: mcUrl || saved.mailchimpUrl,
        updatedAt: new Date().toISOString(),
      });
      setSelected(updated);
      setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      await saveDraft(updated, { quiet: true });
      toast.success(
        data.updated
          ? 'Mailchimp draft aktualizován (stejná kampaň).'
          : 'Pushnutno do Mailchimpu (nový draft).',
      );
      if (mcUrl) {
        try {
          window.open(mcUrl, '_blank', 'noopener,noreferrer');
        } catch {
          toast.message(`Mailchimp: ${mcUrl}`);
        }
      }
    } catch (e: unknown) {
      console.error('Push to Mailchimp error:', e);
      toast.error(`Mailchimp chyba: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPushing(false);
    }
  };

  /* ── Vlastní mailing (Resend + Postgres audience) ── */

  /** Uloží mailingCampaignId do draftu (state + KV), aby další odeslání aktualizovalo tutéž kampaň. */
  const persistMailingCampaignId = async (draft: EmailDraft, campaignId: string) => {
    if (draft.mailingCampaignId === campaignId) return;
    const updated = normalizeDraftForBuilder({ ...draft, mailingCampaignId: campaignId, updatedAt: new Date().toISOString() });
    setSelected(updated);
    setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    await saveDraft(updated, { quiet: true });
  };

  const mailingAudienceFilter = useMemo((): MailingAudienceFilter => ({
    includeTagIds: mailingIncludeTagIds,
    excludeTagIds: mailingExcludeTagIds,
    sources: mailingSources,
    subjectInterestSlugs: mailingSubjects,
  }), [mailingIncludeTagIds, mailingExcludeTagIds, mailingSources, mailingSubjects]);

  const mailingTagNameById = useMemo(
    () => new Map(mailingTags.map((t) => [t.id, t.name])),
    [mailingTags],
  );

  const mailingWebTypeTags = useMemo(
    () => mailingTags.filter((t) => (t.slug || '').startsWith('wb-') || t.name.trim().startsWith('Web ·')),
    [mailingTags],
  );

  const mailingWebinarTags = useMemo(
    () => mailingTags.filter((t) => isWebinarTagName(t.name) && !(t.slug || '').startsWith('wb-')),
    [mailingTags],
  );

  const mailingOtherTags = useMemo(() => {
    const q = mailingTagSearch.trim().toLowerCase();
    return mailingTags
      .filter((t) => !(t.slug || '').startsWith('wb-') && !t.name.trim().startsWith('Web ·') && !isWebinarTagName(t.name))
      .filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [mailingTags, mailingTagSearch]);

  const bumpMailingFilter = useCallback(() => setMailingRecipientCount(null), []);

  const applyWebTypePreset = useCallback((slug: string) => {
    bumpMailingFilter();
    const tag = mailingTags.find((t) => t.slug === slug || t.name === WEBINAR_AUDIENCE_DEFS.find((d) => d.slug === slug)?.name);
    setMailingSources([]);
    setMailingSubjects([]);
    setMailingIncludeTagIds(tag ? [tag.id] : []);
    if (!tag) {
      toast.message('Nejdřív v Audience spusť „Rozřadit podle webinářů“ — tag Web · … ještě není.');
    }
  }, [bumpMailingFilter, mailingTags]);

  const applyMailingPreset = useCallback((kind: 'all' | 'webinars' | 'first-grade' | 'newsletter' | 'eng-hot' | 'eng-warm') => {
    bumpMailingFilter();
    if (kind === 'all') {
      setMailingIncludeTagIds([]);
      setMailingExcludeTagIds([]);
      setMailingSources([]);
      setMailingSubjects([]);
      return;
    }
    if (kind === 'eng-hot' || kind === 'eng-warm') {
      const slug = kind;
      const tag = mailingTags.find((t) => {
        const n = t.name.trim().toLowerCase();
        return n.includes(slug === 'eng-hot' ? 'aktivní' : 'teplý') || n.includes(slug);
      });
      setMailingSources([]);
      setMailingSubjects([]);
      setMailingIncludeTagIds(tag ? [tag.id] : []);
      if (!tag) {
        toast.message('Nejdřív v Audience spusť „Rozřadit podle aktivity“ — tag Eng · … ještě neexistuje.');
      }
      return;
    }
    if (kind === 'webinars') {
      applyWebTypePreset('wb-webinar');
      return;
    }
    if (kind === 'newsletter') {
      setMailingSources(['newsletter']);
      setMailingSubjects([]);
      setMailingIncludeTagIds([]);
      return;
    }
    const wbGrade = mailingTags.find((t) => t.slug === 'wb-1stupen');
    if (wbGrade) {
      setMailingSources([]);
      setMailingSubjects([]);
      setMailingIncludeTagIds([wbGrade.id]);
      return;
    }
    const gradeIds = mailingTags.filter((t) => isFirstGradeTagName(t.name)).map((t) => t.id);
    setMailingSources([]);
    if (gradeIds.length > 0) {
      setMailingSubjects([]);
      setMailingIncludeTagIds(gradeIds);
    } else {
      setMailingSubjects(['prvouka']);
      setMailingIncludeTagIds([]);
    }
  }, [applyWebTypePreset, bumpMailingFilter, mailingTags]);

  const openMailingSendDialog = async () => {
    const snap = selectedRef.current;
    if (!snap) return;
    if (!snap.subject.trim()) {
      toast.error('Nejdřív vyplňte předmět.');
      return;
    }
    setMailingRecipientCount(null);
    setMailingTagSearch('');
    setMailingShowAllTags(false);
    setMailingDialogOpen(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.from('tags').select('id, name, slug').order('name');
      if (error) throw new Error(error.message);
      setMailingTags((data || []) as { id: string; name: string; slug?: string }[]);
    } catch (e) {
      console.error('Mailing tags load error:', e);
      toast.error('Nepodařilo se načíst tagy pro filtr příjemců.');
    }
  };

  /** Uloží draft, vytvoří/aktualizuje kampaň v Postgresu a spočítá příjemce (prepare). */
  const prepareMailingCampaign = async (): Promise<{ campaignId: string; total: number } | null> => {
    const snap = selectedRef.current;
    if (!snap) return null;
    setMailingPreparing(true);
    try {
      const saved = await saveDraft(snap, { quiet: true });
      if (!saved) return null;

      const createRes = await fetchWithAdminAuth(`${SERVER}/admin/mailing/campaigns`, {
        method: 'POST',
        json: true,
        body: JSON.stringify({
          id: saved.mailingCampaignId || undefined,
          name: saved.subject,
          subjectLine: saved.subject,
          previewText: saved.previewText,
          bodyContent: compileEmailBodyForSend(saved.bodyHtml),
          outerBackground: normalizeHexColor(saved.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG),
          draftId: saved.id,
          audienceFilter: mailingAudienceFilter,
          scheduledAt: saved.scheduledSendAt || undefined,
        }),
      });
      const created = await createRes.json();
      if (!created.ok) throw new Error(created.error || `HTTP ${createRes.status}`);
      const campaignId = String(created.campaign?.id || '');
      if (!campaignId) throw new Error('Server nevrátil id kampaně.');
      await persistMailingCampaignId(saved, campaignId);

      const prepRes = await fetchWithAdminAuth(`${SERVER}/admin/mailing/campaigns/${campaignId}/prepare`, {
        method: 'POST',
        json: true,
      });
      const prep = await prepRes.json();
      if (!prep.ok) throw new Error(prep.error || `HTTP ${prepRes.status}`);
      setMailingRecipientCount(prep.total);
      return { campaignId, total: prep.total };
    } catch (e) {
      console.error('Mailing prepare error:', e);
      toast.error(`Příprava kampaně: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    } finally {
      setMailingPreparing(false);
    }
  };

  const confirmMailingSend = async () => {
    const snap = selectedRef.current;
    if (!snap?.mailingCampaignId || mailingRecipientCount === null) return;
    const campaignId = snap.mailingCampaignId;
    const scheduled = snap.scheduledSendAt && Date.parse(snap.scheduledSendAt) > Date.now();
    setMailingSending(true);
    try {
      if (scheduled) {
        /* Kampaň už je uložená se scheduled_at — odešle ji cron. */
        toast.success(`Kampaň naplánována na ${new Date(snap.scheduledSendAt!).toLocaleString('cs-CZ')} pro ${mailingRecipientCount} příjemců.`);
        setMailingDialogOpen(false);
        return;
      }
      const r = await fetchWithAdminAuth(`${SERVER}/admin/mailing/campaigns/${campaignId}/send`, {
        method: 'POST',
        json: true,
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const updated = normalizeDraftForBuilder({ ...snap, status: 'sent' as const, updatedAt: new Date().toISOString() });
      setSelected(updated);
      setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      await saveDraft(updated, { quiet: true });
      setMailingDialogOpen(false);
      toast.success(
        data.remaining > 0
          ? `Odesílání běží — ${data.sent} odesláno, ${data.remaining} ve frontě (dokončí se automaticky).`
          : `Kampaň odeslána ${data.sent} příjemcům.`,
      );
    } catch (e) {
      console.error('Mailing send error:', e);
      toast.error(`Odeslání kampaně: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMailingSending(false);
    }
  };

  /** Test e-mail přes vlastní mailing (Resend) — stejná šablona jako ostrá kampaň. */
  const sendResendTestMail = async () => {
    const snap = selectedRef.current;
    if (!snap || !testMailRecipient) return;
    if (!snap.subject.trim()) {
      toast.error('Nejdřív vyplňte předmět.');
      return;
    }
    setSendingResendTest(true);
    try {
      const saved = await saveDraft(snap, { quiet: true });
      if (!saved) return;
      const r = await fetchWithAdminAuth(`${SERVER}/admin/mailing/send-test`, {
        method: 'POST',
        json: true,
        body: JSON.stringify({
          to: testMailRecipient,
          subject: saved.subject,
          previewText: saved.previewText,
          bodyContent: compileEmailBodyForSend(saved.bodyHtml),
          outerBackground: normalizeHexColor(saved.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG),
        }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      toast.success(`Test (Resend) odeslán na ${testMailRecipient}`);
    } catch (e) {
      console.error('Resend test error:', e);
      toast.error(`Test přes Resend: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSendingResendTest(false);
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
      const flushed = flushLivePreviewBodyHtml(snap);
      if (flushed.bodyHtml !== snap.bodyHtml) {
        setSelected(flushed);
        setDrafts((prev) => prev.map((d) => (d.id === flushed.id ? flushed : d)));
        selectedRef.current = flushed;
      }
      const saved = await saveDraft(flushed, { quiet: true });
      if (!saved) return;

      const r = await fetchWithAdminAuth(`${SERVER}/admin/mailchimp/send-test-email`, {
        method: 'POST',
        json: true,
        body: JSON.stringify({
          to: testMailRecipient,
          subject: saved.subject,
          previewText: saved.previewText,
          headline: saved.headline,
          bodyContent: compileEmailBodyForSend(saved.bodyHtml),
          outerBackground: normalizeHexColor(saved.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG),
          ctaText: saved.ctaText,
          ctaUrl: saved.ctaUrl || previewCtaUrl(),
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
  /** Stav se čte ze stejného dokumentu, na kterém běží mutace — jinak by se stav a akce rozešly. */
  const selectedGroupState = useMemo<EmailBlockGroupState | null>(() => {
    const id = selectedBlock?.id;
    const doc = previewIframeRef.current?.contentDocument;
    if (!id || !doc?.body) return null;
    const root = getEmailDndRoot(doc);
    const el = findEmailBlockById(root, id);
    if (!el || !root.contains(el)) return null;
    return readEmailBlockGroupState(el, root);
  }, [selectedBlock?.id, bodyEditEpoch, selected?.id, selected?.bodyHtml]);

  /** Stín z vybrané jednotky; počet sloupců z hostitelského layoutu (i když je vybraná buňka). */
  const selectedBlockAppearance = useMemo(() => {
    const id = selectedBlock?.id;
    const doc = previewIframeRef.current?.contentDocument;
    const noRadii = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
    if (!id || !doc?.body) {
      return { hasShadow: false, columns: 1 as EmailBlockColumnCount, cornerRadii: noRadii };
    }
    const el = findEmailBlockById(getEmailDndRoot(doc), id);
    if (!el) return { hasShadow: false, columns: 1 as EmailBlockColumnCount, cornerRadii: noRadii };
    const columnsHost = getColumnsHostForBlock(el) || el;
    return {
      hasShadow: readElementHasShadow(el),
      columns: readEmailBlockColumns(columnsHost),
      cornerRadii: readBlockCornerRadii(el),
    };
  }, [selectedBlock?.id, bodyEditEpoch, selected?.bodyHtml]);
  const selectedBlockHasShadow = selectedBlockAppearance.hasShadow;
  const selectedBlockColumns = selectedBlockAppearance.columns;
  const selectedBlockCornerRadii = selectedBlockAppearance.cornerRadii;

  const selectedHighlightChrome = useMemo<EmailHighlightChrome | null>(() => {
    if (selectedBlock?.type !== 'highlight') return null;
    const doc = previewIframeRef.current?.contentDocument;
    if (!doc?.body) return null;
    const el = findEmailBlockById(getEmailDndRoot(doc), selectedBlock.id);
    if (!el) return null;
    return readHighlightChrome(el);
  }, [selectedBlock?.id, selectedBlock?.type, bodyEditEpoch, selected?.bodyHtml]);

  const blockPositionOptions = useMemo(() => {
    const id = selectedBlock?.id;
    const doc = previewIframeRef.current?.contentDocument;
    if (!id || !doc?.body) return [] as Array<{ id: string; label: string }>;
    const root = getEmailDndRoot(doc);
    const selectedEl = findEmailBlockById(root, id);
    if (!selectedEl) return [];
    const selectedUnit = resolveReorderableBlock(selectedEl, root);
    const selectedUnitId = selectedUnit?.getAttribute('data-vb-block-id') || '';
    const seen = new Set<string>();
    const options: Array<{ id: string; label: string }> = [];

    for (const raw of root.querySelectorAll('[data-vb-block-id]')) {
      const el = raw as HTMLElement;
      const unit = resolveReorderableBlock(el, root);
      if (!unit || unit.getAttribute('data-vb-block') === 'section') continue;
      const unitId = unit.getAttribute('data-vb-block-id') || '';
      if (!unitId || unitId === selectedUnitId || seen.has(unitId)) continue;
      seen.add(unitId);
      const type = inferEmailBlockType(unit);
      const text = (unit.innerText || unit.textContent || '').replace(/\s+/g, ' ').trim();
      const excerpt = text ? ` — ${text.slice(0, 42)}${text.length > 42 ? '…' : ''}` : '';
      options.push({
        id: unitId,
        label: `${options.length + 1}. ${getEmailBlockLabel(type)}${excerpt}`,
      });
    }
    return options;
  }, [selectedBlock?.id, bodyEditEpoch, selected?.bodyHtml]);

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
          const vertPad = EMAIL_BLOCK_CHROME_HIT_PADDING_PX;
          const vertTop = c.top - vertPad;
          const vertH = c.height + 2 * vertPad;
          const bridgeW = chromeOnRight
            ? Math.max(0, left - (c.left + c.width))
            : Math.max(0, c.left - (left + barW));
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
          const pillW = 44;
          const pillH = 22;
          const pillLeft = c.left + c.width / 2 - pillW / 2;
          const pillTop = Math.max(8, c.top - pillH / 2);
          const dragging = blockPointerDrag?.blockId === bid || !!blockPointerDrag;
          return createPortal(
            <>
            {blockPointerDrag && (
              <div
                data-email-block-drag-shield
                aria-hidden
                className="fixed inset-0 z-[19955] cursor-grabbing touch-none select-none"
                style={{
                  background: 'transparent',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                }}
              />
            )}
            {/* Bobánek na horní hraně — jediný spolehlivý úchyt pro přesun. */}
            <div
              data-email-block-drag-handle
              className={`pointer-events-auto flex items-center justify-center rounded-full border shadow-md select-none touch-none ${
                blockPointerDrag
                  ? 'border-[#7C3AED] bg-[#7C3AED] text-white cursor-grabbing'
                  : 'border-gray-200 bg-white text-[#001161]/55 hover:border-[#7C3AED] hover:text-[#7C3AED] cursor-grab'
              }`}
              style={{
                position: 'fixed',
                zIndex: 19960,
                left: pillLeft,
                top: pillTop,
                width: pillW,
                height: pillH,
              }}
              title="Chytni a přetáhni blok na jiné místo"
              onMouseEnter={keepChromePointerAlive}
              onMouseLeave={releaseChromePointer}
              onPointerDown={(ev) => beginBlockPointerDrag(bid, ev)}
            >
              <GripVertical className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
            </div>
            {blockPointerDrag?.indicator && (
              <div
                aria-hidden
                className="pointer-events-none fixed z-[19970]"
                style={{
                  left: blockPointerDrag.indicator.left,
                  top: blockPointerDrag.indicator.top - 1,
                  width: blockPointerDrag.indicator.width,
                  height: 3,
                  borderRadius: 2,
                  background: '#7C3AED',
                  boxShadow: '0 0 0 2px rgba(124,58,237,0.25)',
                }}
              />
            )}
            <div
              data-email-block-chrome
              className="pointer-events-auto flex flex-row items-center"
              style={{
                position: 'fixed',
                zIndex: 19950,
                left: chromeOnRight ? c.left + c.width : left,
                top: vertTop,
                height: vertH,
                opacity: dragging && blockPointerDrag ? 0.35 : 1,
              }}
              onMouseEnter={keepChromePointerAlive}
              onMouseLeave={releaseChromePointer}
            >
              {chromeOnRight && (
                <div className="shrink-0" style={{ width: Math.max(bridgeW, 12), height: '100%' }} aria-hidden />
              )}
              <div
                className="flex shrink-0 flex-col gap-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
                style={{ width: barW, alignSelf: 'center' }}
              >
              <button
                type="button"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full cursor-pointer transition-all ${
                  aiEditBlockId === bid
                    ? 'bg-[#FFDD00] text-[#001161] ring-2 ring-[#001161]/25 shadow-sm'
                    : 'bg-[#FFDD00] text-[#001161] hover:brightness-95 hover:shadow-sm'
                }`}
                title="Upravit tento blok přes AI agenta"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelInsertLineHide();
                  startAiEditBlock(bid);
                }}
              >
                <span className="text-[9px] font-black leading-none tracking-tight" style={F}>
                  AI
                </span>
              </button>
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
              </div>
              {!chromeOnRight && (
                <div className="shrink-0" style={{ width: Math.max(bridgeW, 12), height: '100%' }} aria-hidden />
              )}
            </div>
            </>,
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
      {emailImageUploading && (
        <div
          className="pointer-events-none fixed top-0 left-0 right-0 z-[20500] h-[3px] overflow-hidden bg-[#7C3AED]/12"
          role="progressbar"
          aria-valuetext="Nahrávám obrázek"
          aria-busy="true"
        >
          <div className="vb-email-image-upload-bar-fill h-full rounded-none bg-[#7C3AED]" />
        </div>
      )}

      {blockChromePortal}

      {selected && mailingDialogOpen && (
        <div
          className="fixed inset-0 z-[21000] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => !mailingSending && setMailingDialogOpen(false)}
        >
          <div
            className="w-full max-w-[640px] rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
            style={F}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-[#001161]">Odeslat kampaň — vlastní mailing</h2>
              <p className="text-[11px] text-[#001161]/45 mt-1 leading-snug">
                Jen status „přihlášen“. Rychlé volby + zdroj / předmět / webinář / tagy (vrstvy se sčítají — AND).
              </p>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[62vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">
                  Rychlé volby
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['all', 'Všichni přihlášení'],
                    ['eng-hot', 'Aktivní (30 dní)'],
                    ['eng-warm', 'Teplí (90 dní)'],
                    ['webinars', 'Byli na webináři'],
                    ['first-grade', '1. stupeň'],
                    ['newsletter', 'Newsletter'],
                  ] as const).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => applyMailingPreset(kind)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">
                  Zdroj kontaktu
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MAILING_SOURCE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        setMailingSources((prev) => toggleId(prev, o.value));
                        bumpMailingFilter();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                        mailingSources.includes(o.value)
                          ? 'bg-[#001161] text-white'
                          : 'bg-gray-100 text-[#001161]/60 hover:bg-[#001161]/10'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">
                  Zájem o předmět (heuristika)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MAILING_SUBJECT_OPTIONS.map((o) => (
                    <button
                      key={o.slug}
                      type="button"
                      onClick={() => {
                        setMailingSubjects((prev) => toggleId(prev, o.slug));
                        bumpMailingFilter();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                        mailingSubjects.includes(o.slug)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-[#001161]/60 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">
                  Typ z webináře
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEBINAR_AUDIENCE_DEFS.filter((d) => d.slug !== 'wb-webinar').map((d) => {
                    const tag = mailingWebTypeTags.find((t) => t.slug === d.slug || t.name === d.name);
                    const selected = tag ? mailingIncludeTagIds.includes(tag.id) : false;
                    return (
                      <button
                        key={d.slug}
                        type="button"
                        onClick={() => applyWebTypePreset(d.slug)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#7C3AED] text-white'
                            : 'bg-gray-100 text-[#001161]/60 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED]'
                        }`}
                      >
                        {d.name.replace(/^Web · /, '')}
                      </button>
                    );
                  })}
                </div>
                {mailingWebTypeTags.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-[#001161]/40">
                    Zatím bez tagů Web · … — v Audience spusť „Rozřadit podle webinářů“.
                  </p>
                )}
              </div>

              {mailingWebinarTags.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">
                    Konkrétní akce (tag) — OR
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {mailingWebinarTags.map((t) => (
                      <button
                        key={`web-${t.id}`}
                        type="button"
                        onClick={() => {
                          setMailingIncludeTagIds((prev) => toggleId(prev, t.id));
                          bumpMailingFilter();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                          mailingIncludeTagIds.includes(t.id)
                            ? 'bg-[#7C3AED] text-white'
                            : 'bg-gray-100 text-[#001161]/60 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED]'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide">
                    Další tagy (OR)
                  </label>
                  <button
                    type="button"
                    onClick={() => setMailingShowAllTags((v) => !v)}
                    className="text-[10px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
                  >
                    {mailingShowAllTags ? 'Skrýt' : 'Zobrazit / hledat'}
                  </button>
                </div>
                {mailingShowAllTags && (
                  <>
                    <input
                      type="search"
                      value={mailingTagSearch}
                      onChange={(e) => setMailingTagSearch(e.target.value)}
                      placeholder="Hledat tag…"
                      className="mb-2 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-[#7C3AED]/45"
                    />
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {mailingTags.length === 0 && (
                        <span className="text-[11px] text-[#001161]/40">Načítám tagy…</span>
                      )}
                      {mailingOtherTags.map((t) => (
                        <button
                          key={`inc-${t.id}`}
                          type="button"
                          onClick={() => {
                            setMailingIncludeTagIds((prev) => toggleId(prev, t.id));
                            bumpMailingFilter();
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                            mailingIncludeTagIds.includes(t.id)
                              ? 'bg-[#7C3AED] text-white'
                              : 'bg-gray-100 text-[#001161]/60 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED]'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {mailingIncludeTagIds.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-[#001161]/50">
                    Vybrané: {mailingIncludeTagIds.map((id) => mailingTagNameById.get(id) || id).join(', ')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#001161]/40 uppercase tracking-wide mb-1.5">
                  Vyloučit tagy
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {(mailingShowAllTags ? mailingTags : mailingTags.filter((t) => mailingExcludeTagIds.includes(t.id) || isWebinarTagName(t.name))).slice(0, mailingShowAllTags ? 999 : 24).map((t) => (
                    <button
                      key={`exc-${t.id}`}
                      type="button"
                      onClick={() => {
                        setMailingExcludeTagIds((prev) => toggleId(prev, t.id));
                        bumpMailingFilter();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                        mailingExcludeTagIds.includes(t.id)
                          ? 'bg-[#F06632] text-white'
                          : 'bg-gray-100 text-[#001161]/60 hover:bg-[#F06632]/15 hover:text-[#F06632]'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[#001161]/45 leading-snug rounded-xl bg-[#fafbfd] border border-gray-100 px-3 py-2">
                Filtr: {summarizeAudienceFilter(mailingAudienceFilter, mailingTagNameById)}
              </p>

              {selected.scheduledSendAt && Date.parse(selected.scheduledSendAt) > Date.now() && (
                <p className="text-[11px] text-[#001161]/60 bg-[#7C3AED]/6 rounded-xl px-3 py-2 leading-relaxed">
                  Kampaň se naplánuje na {new Date(selected.scheduledSendAt).toLocaleString('cs-CZ')} — odešle ji automaticky cron.
                </p>
              )}
              <div className="rounded-xl border border-gray-200 bg-[#fafbfd] px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[12px] text-[#001161]/60">
                  {mailingPreparing
                    ? 'Počítám příjemce…'
                    : mailingRecipientCount === null
                      ? 'Počet příjemců zatím nespočítán.'
                      : `Příjemců podle filtru: ${mailingRecipientCount}`}
                </span>
                <button
                  type="button"
                  onClick={() => void prepareMailingCampaign()}
                  disabled={mailingPreparing || mailingSending}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-gray-200 text-[#7C3AED] hover:border-[#7C3AED]/35 disabled:opacity-45 cursor-pointer"
                >
                  {mailingPreparing ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" aria-hidden /> : 'Spočítat'}
                </button>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-[#fafbfd]">
              <button
                type="button"
                onClick={() => setMailingDialogOpen(false)}
                disabled={mailingSending}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-[#001161]/55 hover:bg-gray-100 cursor-pointer disabled:opacity-45"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => void confirmMailingSend()}
                disabled={mailingSending || mailingPreparing || mailingRecipientCount === null || mailingRecipientCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
              >
                {mailingSending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
                {selected.scheduledSendAt && Date.parse(selected.scheduledSendAt) > Date.now()
                  ? 'Naplánovat'
                  : mailingRecipientCount !== null
                    ? `Odeslat ${mailingRecipientCount} příjemcům`
                    : 'Odeslat'}
              </button>
            </div>
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
                    onClick={() => setCtaFormUrl(selected.ctaUrl || previewCtaUrl())}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-[#001161]/70 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED] transition-colors cursor-pointer"
                  >
                    Hlavní CTA draftu
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaFormUrl(previewCtaUrl())}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-[#001161]/70 hover:bg-[#7C3AED]/15 hover:text-[#7C3AED] transition-colors cursor-pointer"
                  >
                    Vyzkoušet
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaFormUrl(productsUrl())}
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
        className={`${sidebarOpen && !editorWorkspaceOpen ? 'w-[280px]' : 'w-0'} transition-all duration-200 border-r border-gray-100 bg-[#fafbfd] flex flex-col min-h-0 overflow-hidden shrink-0`}
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

      <div
        className={`${
          editorWorkspaceOpen ? 'w-[300px]' : 'w-[360px]'
        } border-r border-gray-100 flex flex-col min-h-0 overflow-hidden bg-white shrink-0 transition-[width] duration-200`}
      >
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
              {aiEditBlockId && (
                <div className="mb-2 px-2 py-1.5 rounded-lg bg-[#FFDD00]/25 border border-[#FFDD00]/70 flex items-center gap-2">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FFDD00] text-[7px] font-black text-[#001161]"
                    style={F}
                  >
                    AI
                  </span>
                  <span style={F} className="text-[9px] text-[#001161]/90 leading-snug flex-1">
                    Úprava zvoleného bloku — AI změní jen tento blok v náhledu, zbytek mailu nechá.
                  </span>
                  <button
                    type="button"
                    onClick={clearAiInsertIntent}
                    className="p-0.5 rounded hover:bg-[#FFDD00]/40 cursor-pointer"
                    title="Zrušit úpravu bloku"
                  >
                    <X className="w-3 h-3 text-[#001161]/50" />
                  </button>
                </div>
              )}
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
              {(capturedSelection?.trim() || selectedCanvasText.trim()) && !aiInsertAfterAnchorId && !aiInsertBeforeBlockId && !aiEditBlockId && (
                <div className="mb-2 space-y-2">
                  <div className="px-2 py-1.5 rounded-lg bg-[#7C3AED]/5 border border-[#7C3AED]/10 flex items-center gap-2">
                    <TextCursor className="w-3 h-3 text-[#7C3AED] shrink-0" />
                    <span style={F} className="text-[9px] text-[#7C3AED] truncate flex-1">
                      Úprava výběru (AI vloží jen čistý text, styly v okolí zůstanou): „
                      {(capturedSelection?.trim() || selectedCanvasText).substring(0, 32)}
                      {(capturedSelection?.trim() || selectedCanvasText).length > 32 ? '…' : ''}"
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
              {selected?.bodyHtml && !aiEditBlockId && !aiInsertAfterAnchorId && !aiInsertBeforeBlockId && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => {
                      void sendChatMessage(
                        'Oprav pravopis a gramatiku v celém mailu. Hledej jen chyby, nic jiného nepřepisuj — zachovej formulace, strukturu i fotky.',
                        { chatLabel: 'Opravit pravopis v celém mailu' },
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 text-[10px] font-bold text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer transition-colors"
                    style={F}
                    title="Jen překlepy a gramatika — HTML, bloky a fotky zůstanou"
                  >
                    <SpellCheck className="w-3 h-3 shrink-0" strokeWidth={2.25} />
                    Opravit pravopis
                  </button>
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
                    aiEditBlockId
                      ? 'Popište, jak upravit zvolený blok…'
                      : aiInsertBeforeBlockId
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
                  onClick={() => void openMailingSendDialog()}
                  disabled={mailingSending || !selected.subject.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-45 disabled:pointer-events-none transition-all cursor-pointer"
                  style={F}
                >
                  {mailingSending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
                  Odeslat kampaň
                </button>

                <button
                  type="button"
                  onClick={() => void pushToMailchimp()}
                  disabled={pushing || !selected.subject.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[12px] font-bold text-[#001161]/60 hover:border-[#7C3AED]/35 hover:text-[#7C3AED] disabled:opacity-45 disabled:pointer-events-none transition-all cursor-pointer"
                  style={F}
                >
                  {pushing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
                  Poslat do Mailchimpu (legacy)
                </button>

                <div className="mt-4 rounded-xl border border-gray-200 bg-[#fafbfd] p-4 space-y-3">
                  <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#7C3AED]/80 mb-0">
                    Testovací odeslání
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
                    onClick={() => void sendResendTestMail()}
                    disabled={sendingResendTest || sendingTestMail || pushing || !selected.subject.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[12px] font-bold text-[#7C3AED] hover:border-[#7C3AED]/35 hover:bg-[#7C3AED]/5 disabled:opacity-45 disabled:pointer-events-none transition-all cursor-pointer"
                    style={F}
                  >
                    {sendingResendTest ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" aria-hidden />
                    ) : (
                      <Mail className="w-4 h-4 text-[#7C3AED]" aria-hidden />
                    )}
                    Poslat test (Resend)
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendTestMail()}
                    disabled={sendingTestMail || sendingResendTest || pushing || !selected.subject.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[12px] font-bold text-[#001161]/55 hover:border-[#7C3AED]/35 hover:text-[#7C3AED] disabled:opacity-45 disabled:pointer-events-none transition-all cursor-pointer"
                    style={F}
                  >
                    {sendingTestMail ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    ) : (
                      <Mail className="w-4 h-4" aria-hidden />
                    )}
                    Poslat test (Mailchimp, legacy)
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
                  <EmailPreviewBgColorField
                    label="Plocha za sloupcem"
                    value={selected.previewOuterBg ?? DEFAULT_PREVIEW_OUTER_BG}
                    fallback={DEFAULT_PREVIEW_OUTER_BG}
                    onChange={color => updateField('previewOuterBg', color)}
                  />
                  <EmailPreviewBgColorField
                    label="Sloupec / karty"
                    value={selected.previewColumnBg ?? DEFAULT_PREVIEW_COLUMN_BG}
                    fallback={DEFAULT_PREVIEW_COLUMN_BG}
                    onChange={color => updateField('previewColumnBg', color)}
                  />
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

                  <div>
                    <label
                      style={F}
                      className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35"
                    >
                      Přesunout na pozici
                    </label>
                    <select
                      key={`move-position:${selectedBlock.id}:${bodyEditEpoch}`}
                      defaultValue=""
                      disabled={blockPositionOptions.length === 0}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        if (targetId) moveSelectedBlockBefore(targetId);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] text-[#001161] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/15 disabled:cursor-not-allowed disabled:opacity-45"
                      style={F}
                    >
                      <option value="">
                        {blockPositionOptions.length > 0
                          ? 'Vyber blok, nad který přesunout…'
                          : 'Žádný další blok'}
                      </option>
                      {blockPositionOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedGroupState && (
                    <div className="rounded-xl border border-gray-200 bg-[#fafbfd] px-3 py-2.5 min-w-0 space-y-2.5">
                      <div className="flex flex-nowrap items-center gap-2 min-w-0">
                        <p style={F} className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/45 shrink-0">
                          Skupina
                        </p>
                        <p
                          style={F}
                          className="text-[10px] leading-snug text-[#001161]/45 min-w-0 flex-1 truncate"
                          title="Barva, stín a ohraničení platí pro celou skupinu — ne pro jednotlivé bloky uvnitř."
                        >
                          Chrome (barva / stín / ohraničení) patří celé skupině.
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateSelectedSectionFill('card')}
                            title="Karta — skupina má vlastní pozadí"
                            aria-label="Skupina jako karta"
                            className={`rounded-xl border px-2.5 py-2 cursor-pointer transition-colors flex items-center justify-center ${
                              (selectedGroupState.chrome?.fill ?? selectedGroupState.fill ?? selectedSectionFill) === 'card'
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
                              (selectedGroupState.chrome?.fill ?? selectedGroupState.fill ?? selectedSectionFill) === 'plain'
                                ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#001161]'
                                : 'border-gray-200 bg-white text-[#001161] hover:bg-gray-50'
                            }`}
                          >
                            <SquareDashed className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                          </button>
                        </div>
                      </div>

                      {(selectedGroupState.chrome?.fill ?? selectedGroupState.fill ?? selectedSectionFill) === 'card' &&
                        selectedGroupState.chrome && (
                        <div className="space-y-2.5 pt-1 border-t border-gray-200/80">
                          <div>
                            <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">
                              Pozadí skupiny
                            </label>
                            <VividbooksColorButton
                              key={`sec-bg:${selectedBlock?.id}:${selectedGroupState.chrome.background || ''}`}
                              title="Barva pozadí celé skupiny"
                              palette="pastel"
                              onSelect={(color) => updateSelectedSectionChrome({ background: color === 'transparent' ? '' : color })}
                              buttonClassName="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-[11px] font-medium text-[#001161]/65 hover:border-[#5139ED]/35 hover:bg-gray-50"
                            >
                              <span
                                className="h-5 w-5 shrink-0 rounded-md border border-black/10 shadow-sm"
                                style={{ backgroundColor: selectedGroupState.chrome.background || '#ffffff' }}
                              />
                              Vybrat barvu
                              <ChevronDown className="ml-auto h-3.5 w-3.5 text-[#001161]/35" />
                            </VividbooksColorButton>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
                              Ohraničení
                            </label>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={selectedGroupState.chrome.border}
                              onClick={() =>
                                updateSelectedSectionChrome({ border: !selectedGroupState.chrome!.border })
                              }
                              title={selectedGroupState.chrome.border ? 'Vypnout ohraničení' : 'Zapnout ohraničení'}
                              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                                selectedGroupState.chrome.border ? 'bg-[#7C3AED]' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                                  selectedGroupState.chrome.border ? 'left-[22px]' : 'left-0.5'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
                              Stín
                            </label>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={selectedGroupState.chrome.shadow}
                              onClick={() =>
                                updateSelectedSectionChrome({ shadow: !selectedGroupState.chrome!.shadow })
                              }
                              title={selectedGroupState.chrome.shadow ? 'Vypnout stín' : 'Zapnout stín'}
                              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                                selectedGroupState.chrome.shadow ? 'bg-[#7C3AED]' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                                  selectedGroupState.chrome.shadow ? 'left-[22px]' : 'left-0.5'
                                }`}
                              />
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
                                Zakulacení
                              </label>
                              <span style={F} className="text-[11px] tabular-nums text-[#001161]/55">
                                {selectedGroupState.chrome.radius} px
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={32}
                              step={1}
                              value={selectedGroupState.chrome.radius}
                              onChange={(e) =>
                                updateSelectedSectionChrome({
                                  radius: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full accent-[#7C3AED]"
                              aria-label="Zakulacení rohů skupiny"
                            />
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-200/80 space-y-1.5">
                          <p style={F} className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/45">
                            Výběr a skupina
                          </p>
                          <p style={F} className="text-[10px] leading-snug text-[#001161]/45">
                            {selectedBlockIds.length >= 2
                              ? `Vybráno ${selectedBlockIds.length} bloků — sloučením dostanou společný chrome.`
                              : 'Táhni myší přes náhled (mimo text) = laso. Shift+klik přidá blok. Pak Sloučit do skupiny.'}
                          </p>
                          <button
                            type="button"
                            disabled={selectedBlockIds.length < 2}
                            onClick={groupSelectedBlocksIntoSection}
                            title="Sloučit vybrané bloky do jedné skupiny"
                            className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-bold text-[#001161] hover:bg-gray-50 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:pointer-events-none"
                            style={F}
                          >
                            <SquareStack className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                            Sloučit do skupiny
                            {selectedBlockIds.length >= 2 ? ` (${selectedBlockIds.length})` : ''}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedGroupState.canIsolate}
                            onClick={isolateSelectedBlockGroup}
                            title="Vyjmout blok ze skupiny — dostane vlastní kartu"
                            className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-bold text-[#001161] hover:bg-gray-50 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:pointer-events-none"
                            style={F}
                          >
                            <Unlink className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                            Vyjmout ze skupiny
                          </button>
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

                  {selectedBlock.type === 'highlight' && selectedHighlightChrome && (
                    <div className="rounded-xl border border-gray-200 bg-[#fafbfd] px-3 py-2.5 space-y-2.5">
                      <p style={F} className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#001161]/45">
                        Zvýrazněný box
                      </p>
                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">
                          Barva boxu
                        </label>
                        <VividbooksColorButton
                          key={`hl-bg:${selectedBlock.id}:${selectedHighlightChrome.background}`}
                          title="Barva boxu — ovlivní i ohraničení"
                          palette="pastelSolid"
                          onSelect={(color) => {
                            if (color === 'transparent') return;
                            updateSelectedHighlightChrome({ background: color });
                          }}
                          buttonClassName="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-[11px] font-medium text-[#001161]/65 hover:border-[#5139ED]/35 hover:bg-gray-50"
                        >
                          <span
                            className="h-5 w-5 shrink-0 rounded-md border border-black/10 shadow-sm"
                            style={{ backgroundColor: selectedHighlightChrome.background }}
                          />
                          Vybrat barvu
                          <ChevronDown className="ml-auto h-3.5 w-3.5 text-[#001161]/35" />
                        </VividbooksColorButton>
                        <p style={F} className="mt-1 text-[10px] leading-snug text-[#001161]/40">
                          Barva nastaví výplň i modré/barevné ohraničení. Sám ve skupině jde přes celou šířku; mezery po stranách jen když jsou ve skupině další bloky.
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
                          Ohraničení
                        </label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selectedHighlightChrome.border}
                          onClick={() =>
                            updateSelectedHighlightChrome({ border: !selectedHighlightChrome.border })
                          }
                          title={selectedHighlightChrome.border ? 'Vypnout ohraničení' : 'Zapnout ohraničení'}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                            selectedHighlightChrome.border ? 'bg-[#7C3AED]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                              selectedHighlightChrome.border ? 'left-[22px]' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
                          Stín
                        </label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={selectedHighlightChrome.shadow}
                          onClick={() =>
                            updateSelectedHighlightChrome({ shadow: !selectedHighlightChrome.shadow })
                          }
                          title={selectedHighlightChrome.shadow ? 'Vypnout stín' : 'Zapnout stín'}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                            selectedHighlightChrome.shadow ? 'bg-[#7C3AED]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                              selectedHighlightChrome.shadow ? 'left-[22px]' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label style={F} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35">
                            Zakulacení
                          </label>
                          <span style={F} className="text-[11px] tabular-nums text-[#001161]/55">
                            {selectedHighlightChrome.radius} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={32}
                          step={1}
                          value={selectedHighlightChrome.radius}
                          onChange={(e) =>
                            updateSelectedHighlightChrome({
                              radius: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full accent-[#7C3AED]"
                          aria-label="Zakulacení rohů boxu"
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type !== 'section' &&
                    selectedBlock.type !== 'product-collage' &&
                    selectedBlock.type !== 'webinar' && (
                    <>
                      <EmailBlockAppearancePanel
                        blockId={selectedBlock.id}
                        padding={selectedBlock.padding}
                        hasShadow={selectedBlockHasShadow}
                        columns={selectedBlockColumns}
                        cornerRadii={selectedBlockCornerRadii}
                        onPreviewStyle={previewBlockStyleLive}
                        onCommitStyle={updateSelectedBlockStyle}
                        onMarkHistory={beginPreviewStyleHistory}
                        onColumnsChange={setSelectedBlockColumns}
                        hideChrome
                      />

                      <div>
                        <label style={F} className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#001161]/35 mb-1">Zarovnání</label>
                        <select
                          key={`align:${selectedBlock.id}:${selectedBlock.textAlign || ''}`}
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
                          Nahradit obrázek
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
                      <EmailImageSizeSlider
                        key={`size-${selectedBlock.id}-${selectedBlock.imageSrc}`}
                        blockId={selectedBlock.id}
                        widthPct={selectedBlock.imageWidthPct}
                        onPreview={(pct) => previewSelectedImageWidthLive(pct)}
                        onMarkHistory={beginPreviewStyleHistory}
                        onCommit={(pct) => commitSelectedImageWidth(pct)}
                      />
                      <EmailImageCropPanel
                        key={selectedBlock.imageSrc}
                        src={selectedBlock.imageSrc}
                        onApply={(newUrl) => {
                          updateSelectedBlockImage(newUrl);
                        }}
                      />
                    </>
                  )}
                  {selectedBlock.type === 'image' && (
                    <>
                      <input
                        ref={emailImageBlockFileInputRef}
                        type="file"
                        accept="image/*,.heic,.heif,.avif"
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden
                        onChange={onEmailImageBlockFileInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => emailImageBlockFileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#7C3AED]/35 bg-[#7C3AED]/6 px-3 py-2.5 text-[11px] font-bold text-[#001161] hover:bg-[#7C3AED]/12 cursor-pointer"
                        style={F}
                      >
                        <Upload className="h-4 w-4 shrink-0 text-[#7C3AED]" strokeWidth={2.25} aria-hidden />
                        Nahrát z disku (nahradí tento obrázek)
                      </button>
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
            {editorWorkspaceOpen ? (
              <button
                type="button"
                onClick={exitEditorWorkspace}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-[#001161] hover:bg-gray-50 transition-all cursor-pointer shrink-0"
                style={F}
                title="Zpět na seznam emailů"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                Emaily
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarOpen(v => !v)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                title={sidebarOpen ? 'Skrýt sidebar' : 'Zobrazit sidebar'}
              >
                {sidebarOpen ? <PanelLeftClose className="w-4 h-4 text-[#001161]/40" /> : <PanelLeftOpen className="w-4 h-4 text-[#001161]/40" />}
              </button>
            )}

            {selected && (
              <>
                <div className="min-w-0 max-w-[220px] shrink-0 hidden sm:block">
                  <p style={F} className="text-[12px] font-bold text-[#001161] truncate leading-tight">
                    {selected.subject || 'Bez předmětu'}
                  </p>
                  <p style={F} className="text-[10px] text-[#001161]/40 truncate leading-tight">
                    Editor · 600px
                  </p>
                </div>
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
                selectedBlockId={selectedBlock?.id ?? null}
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
                className="flex flex-col w-full min-w-0 min-h-full"
              >
                    {showInboxChrome && (
                      <div
                        className="w-[600px] max-w-full mx-auto mt-3 md:mt-5 px-5 py-4 border-b border-gray-100 bg-white rounded-t-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
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
                                <EmailPreviewBgColorField
                                  label="Plocha za sloupcem"
                                  value={selected.previewOuterBg ?? DEFAULT_PREVIEW_OUTER_BG}
                                  fallback={DEFAULT_PREVIEW_OUTER_BG}
                                  onChange={color => updateField('previewOuterBg', color)}
                                />
                                <EmailPreviewBgColorField
                                  label="600px sloupec + tělo"
                                  value={selected.previewColumnBg ?? DEFAULT_PREVIEW_COLUMN_BG}
                                  fallback={DEFAULT_PREVIEW_COLUMN_BG}
                                  onChange={color => updateField('previewColumnBg', color)}
                                />
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
                      ref={emailPreviewDropShellRef}
                      className={`relative flex flex-col flex-1 min-h-0 w-full ${showInboxChrome ? 'rounded-b-xl' : ''}`}
                      onDragEnter={(e) => {
                        if (showInboxChrome || !handleImageFileDropRef.current) return;
                        if (!dataTransferMayContainFiles(e.dataTransfer)) return;
                        e.preventDefault();
                        setPreviewImageFileDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        if (!dataTransferMayContainFiles(e.dataTransfer)) return;
                        const next = e.relatedTarget as Node | null;
                        if (next && emailPreviewDropShellRef.current?.contains(next)) return;
                        setPreviewImageFileDragActive(false);
                        setPreviewImageDropTarget(null);
                      }}
                      onDragOver={(e) => {
                        if (showInboxChrome || !handleImageFileDropRef.current) return;
                        if (!dataTransferMayContainFiles(e.dataTransfer)) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        const tgt = computeEmailPreviewDropTargetForCursor(e.clientX, e.clientY);
                        setPreviewImageDropTarget((prev) => {
                          if (!prev && !tgt) return prev;
                          if (prev && tgt && prev.blockId === tgt.blockId) return prev;
                          return tgt;
                        });
                      }}
                      onDrop={(e) => {
                        restoreEmailPreviewIframePointer();
                        setPreviewImageFileDragActive(false);
                        setPreviewImageDropTarget(null);
                        if (showInboxChrome || !handleImageFileDropRef.current) return;
                        if (!dataTransferMayContainFiles(e.dataTransfer)) return;
                        const files = e.dataTransfer.files;
                        if (!files?.length) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const f = files[0];
                        if (!fileDropLooksLikeImage(f)) {
                          toast.error('Soubor nevypadá jako obrázek.');
                          return;
                        }
                        runEmailPreviewShellImageDrop(f, e.clientX, e.clientY);
                      }}
                    >
                      {previewImageFileDragActive && !showInboxChrome && (
                        <div
                          className="absolute inset-0 z-[25] flex items-center justify-center rounded-xl bg-[#7C3AED]/10 px-4 pointer-events-auto"
                          onDragOver={(ev) => {
                            ev.preventDefault();
                            ev.dataTransfer.dropEffect = 'copy';
                            const tgt = computeEmailPreviewDropTargetForCursor(ev.clientX, ev.clientY);
                            setPreviewImageDropTarget((prev) => {
                              if (!prev && !tgt) return prev;
                              if (prev && tgt && prev.blockId === tgt.blockId) return prev;
                              return tgt;
                            });
                          }}
                          onDrop={(ev) => {
                            restoreEmailPreviewIframePointer();
                            setPreviewImageFileDragActive(false);
                            setPreviewImageDropTarget(null);
                            if (showInboxChrome || !handleImageFileDropRef.current) return;
                            if (!dataTransferMayContainFiles(ev.dataTransfer)) return;
                            const files = ev.dataTransfer.files;
                            if (!files?.length) return;
                            ev.preventDefault();
                            ev.stopPropagation();
                            const f = files[0];
                            if (!fileDropLooksLikeImage(f)) {
                              toast.error('Soubor nevypadá jako obrázek.');
                              return;
                            }
                            runEmailPreviewShellImageDrop(f, ev.clientX, ev.clientY);
                          }}
                        >
                          {!previewImageDropTarget && (
                            <div
                              className="max-w-md rounded-2xl border-2 border-dashed border-[#7C3AED] bg-white px-6 py-7 shadow-lg text-center"
                              style={F}
                            >
                              <Upload className="mx-auto h-10 w-10 text-[#7C3AED] mb-3" strokeWidth={1.75} aria-hidden />
                              <p className="text-[14px] font-bold text-[#001161]">Pusťte na blok obrázku</p>
                              <p className="text-[11px] text-[#001161]/60 mt-2 leading-snug">
                                Najeďte přímo na konkrétní obrázek v mailu — zvýrazní se obrysem, kam bude nahrazen.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      {previewImageFileDragActive && previewImageDropTarget && !showInboxChrome && (
                        <div
                          className="absolute z-[26] pointer-events-none rounded-xl"
                          style={{
                            top: previewImageDropTarget.top,
                            left: previewImageDropTarget.left,
                            width: previewImageDropTarget.width,
                            height: previewImageDropTarget.height,
                            outline: '3px solid #7C3AED',
                            outlineOffset: 2,
                            background: 'rgba(124,58,237,0.18)',
                            boxShadow: '0 0 0 3px rgba(124,58,237,0.18)',
                          }}
                        >
                          <div
                            className="absolute -top-7 left-0 inline-flex items-center gap-1 rounded-full bg-[#7C3AED] px-2.5 py-0.5 text-[10px] font-bold text-white"
                            style={F}
                          >
                            <Upload className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                            Sem padne soubor
                          </div>
                        </div>
                      )}
                      {lassoRect &&
                        createPortal(
                          <div
                            className="pointer-events-none rounded-sm border-2 border-[#7C3AED] bg-[#7C3AED]/20"
                            style={{
                              position: 'fixed',
                              left: lassoRect.left,
                              top: lassoRect.top,
                              width: Math.max(lassoRect.width, 2),
                              height: Math.max(lassoRect.height, 2),
                              zIndex: 2147483000,
                            }}
                            aria-hidden
                          />,
                          document.body,
                        )}
                      <EmailIframeEditor
                        draftId={selected.id}
                        bodyEditEpoch={bodyEditEpoch}
                        bodyHtml={selected.bodyHtml}
                        columnBackground={normalizeHexColor(selected.previewColumnBg, DEFAULT_PREVIEW_COLUMN_BG)}
                        outerBackground={normalizeHexColor(selected.previewOuterBg, DEFAULT_PREVIEW_OUTER_BG)}
                        builderMode={activeBuilderMode}
                        selectedBlockId={selectedBlock?.id || null}
                        selectedBlockIds={selectedBlockIds}
                        onBodyChange={applyIframeBodyHtml}
                        onImageClick={setImageToolSrc}
                        onBlockSelect={handleBlockSelect}
                        onBlocksSelect={handleBlocksSelect}
                        onLassoRect={setLassoRect}
                        hasMailboxStackAbove={showInboxChrome}
                        readOnlyBody={showInboxChrome}
                        iframeRef={previewIframeRef}
                        onTextSelect={handleIframeTextSelect}
                        hoverBlockRef={iframeHoverBlockRef}
                        onHoverBlockChrome={handleHoverBlockChrome}
                        onIframeLeave={scheduleInsertLineHide}
                        onIframeEnter={cancelInsertLineHide}
                        onRichTextActivity={bumpRichToolbar}
                        onImageFileDrop={showInboxChrome ? undefined : handleImageFileDrop}
                      />
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
          let next = selected.bodyHtml;
          if (selectedBlock?.type === 'image' && selectedBlock.id) {
            next = replaceFirstImgSrcInVbImageBlockById(selected.bodyHtml, selectedBlock.id, newUrl);
          }
          if (next === selected.bodyHtml) {
            next = replaceFirstImgSrcInHtml(selected.bodyHtml, imageToolSrc, newUrl);
          }
          if (next === selected.bodyHtml) {
            toast.error('V HTML se nepodařilo najít tento obrázek — zkuste „Zdroj HTML“ nebo jiný způsob vložení.');
            return;
          }
          updateField('bodyHtml', next);
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
            let next = selected.bodyHtml;
            if (selectedBlock?.type === 'image' && selectedBlock.id) {
              next = replaceFirstImgSrcInVbImageBlockById(selected.bodyHtml, selectedBlock.id, url);
            }
            if (next === selected.bodyHtml) {
              next = replaceFirstImgSrcInHtml(selected.bodyHtml, imageToolSrc, url);
            }
            if (next === selected.bodyHtml) {
              toast.error('V HTML se nepodařilo najít tento obrázek.');
              return;
            }
            updateField('bodyHtml', next);
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
