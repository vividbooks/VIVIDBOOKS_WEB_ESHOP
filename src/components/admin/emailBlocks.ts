import { buildProductCollageBlockHtml } from './emailProductCollage';
import { buildWebinarBlockHtml, EMPTY_EMAIL_WEBINAR_SNAPSHOT } from './emailWebinarBlock';
import { previewCtaUrl } from '../../utils/publicSiteUrl';

export type EmailBuilderMode = 'block' | 'html';

/** Výplň skupiny: karta (má chrome) vs. obsah přímo na pozadí sloupce. */
export type EmailSectionFill = 'card' | 'plain';

/**
 * Vizuální chrome skupiny (barva / stín / ohraničení / radius).
 * Platí jen na `data-vb-block="section"` — vnitřní bloky ho nemají.
 */
export type EmailSectionChrome = {
  fill: EmailSectionFill;
  /** Prázdné = výchozí bílá karta (`--vb-preview-card` / #ffffff). */
  background: string;
  border: boolean;
  shadow: boolean;
  radius: number;
};

export const EMAIL_SECTION_DEFAULT_RADIUS = 16;
export const EMAIL_SECTION_BORDER = '1px solid rgba(0,17,97,0.08)';

/** Chrome zvýrazněného boxu (barva vyplní i ohraničení). */
export type EmailHighlightChrome = {
  background: string;
  border: boolean;
  shadow: boolean;
  radius: number;
};

export const EMAIL_HIGHLIGHT_DEFAULT_BG = '#F3F0FF';
export const EMAIL_HIGHLIGHT_DEFAULT_RADIUS = 18;

export type EmailHeroChrome = {
  background: string;
  radius: number;
};

export const EMAIL_HERO_DEFAULT_BG = '#001161';
export const EMAIL_HERO_DEFAULT_RADIUS = 22;
export const EMAIL_HERO_PRESET_COLORS = [
  '#001161',
  '#FEF3C7',
  '#FFF7ED',
  '#F3F0FF',
  '#EFF6FF',
  '#F06632',
  '#ffffff',
] as const;

/** Styly toolbaru Nadpis 1–4 (Email Builder). */
export const EMAIL_BUILDER_HEADING_STYLES: Record<'h1' | 'h2' | 'h3' | 'h4', string> = {
  h1: 'margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;line-height:1.2;color:#001161;',
  h2: 'margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;line-height:1.25;color:#F06632;',
  h3: 'margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;line-height:1.35;color:#001161;',
  h4: 'margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1.4;color:#001161;',
};

const EMAIL_BUILDER_HEADING_STYLES_ON_DARK: Record<'h1' | 'h2' | 'h3' | 'h4', string> = {
  h1: 'margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;line-height:1.2;color:#ffffff;',
  h2: 'margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;line-height:1.25;color:#ffffff;',
  h3: 'margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;line-height:1.35;color:#ffffff;',
  h4: 'margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1.4;color:#ffffff;',
};

function headingColorIsLight(color: string): boolean {
  const c = (color || '').trim().toLowerCase();
  return c === '#fff' || c === '#ffffff' || c === 'white' || /^rgba?\(\s*255/.test(c);
}

/** Sjednotí H1–H4 na styly editoru (webinář nechá být). */
export function applyEmailBuilderHeadingStyles(root: ParentNode): void {
  root.querySelectorAll('h1,h2,h3,h4').forEach((node) => {
    const el = node as HTMLElement;
    if (el.closest('[data-email-webinar="true"]')) return;
    const tag = el.tagName.toLowerCase() as 'h1' | 'h2' | 'h3' | 'h4';
    const prev = (el.getAttribute('style') || '').toLowerCase();
    const light =
      headingColorIsLight(el.style.color || '') ||
      /color\s*:\s*(#fff(?:fff)?|white|rgba?\(\s*255)/i.test(prev);
    el.setAttribute(
      'style',
      light ? EMAIL_BUILDER_HEADING_STYLES_ON_DARK[tag] : EMAIL_BUILDER_HEADING_STYLES[tag],
    );
  });
}

/** Padding webináře ve skupině s dalšími bloky (nahoře + po stranách). */
export const EMAIL_WEBINAR_GROUP_PADDING = '18px 22px 12px 22px';

function parseCssColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const c = (color || '').trim();
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((ch) => `${ch}${ch}`).join('');
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    };
  }
  const rgba = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) };
  }
  return null;
}

/**
 * Ohraničení ve stejné barvě jako box.
 * Pastel (= barva + bílá) → vytáhne pigment a udělá sytější okraj (světle modrá → modrá).
 */
export function highlightBorderFromBackground(bg: string): string {
  const rgb = parseCssColorToRgb(bg) || { r: 64, g: 162, b: 255 };
  const white = Math.min(rgb.r, rgb.g, rgb.b);
  const tr = Math.max(0, rgb.r - white);
  const tg = Math.max(0, rgb.g - white);
  const tb = Math.max(0, rgb.b - white);
  const peak = Math.max(tr, tg, tb);
  if (peak < 4) {
    // skoro šedá/bílá — ztmav celý tón
    const d = (n: number) => Math.max(0, Math.min(255, Math.round(n * 0.55)));
    return `1px solid rgb(${d(rgb.r)},${d(rgb.g)},${d(rgb.b)})`;
  }
  // Škála pigmentu na sytý okraj (~160–190)
  const scale = 175 / peak;
  const br = Math.max(0, Math.min(255, Math.round(tr * scale)));
  const bgC = Math.max(0, Math.min(255, Math.round(tg * scale)));
  const bb = Math.max(0, Math.min(255, Math.round(tb * scale)));
  return `1px solid rgb(${br},${bgC},${bb})`;
}

export type EmailBlockType =
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'flow-break'
  | 'section'
  | 'gap-content'
  | 'highlight'
  | 'columns-2'
  | 'columns-3'
  | 'hero'
  | 'product-collage'
  | 'webinar'
  | 'html';

export interface EmailBlockPreset {
  type: EmailBlockType;
  label: string;
  description: string;
  category: 'Content' | 'Media' | 'Layout' | 'Commerce' | 'Brand';
}

export const EMAIL_BLOCK_PRESETS: EmailBlockPreset[] = [
  { type: 'text', label: 'Text', description: 'Odstavce nebo krátká sekce', category: 'Content' },
  { type: 'highlight', label: 'Zvýrazněný box', description: 'Barevný box pro důležité sdělení', category: 'Content' },
  { type: 'image', label: 'Obrázek', description: 'Samostatný obrázek na šířku mailu', category: 'Media' },
  { type: 'button', label: 'Tlačítko', description: 'Výrazné CTA tlačítko', category: 'Content' },
  { type: 'divider', label: 'Oddělovač', description: 'Tenká linka mezi bloky', category: 'Brand' },
  {
    type: 'flow-break',
    label: 'Mezera',
    description: 'Větší svislá mezera uvnitř skupiny (bez čáry)',
    category: 'Layout',
  },
  {
    type: 'section',
    label: 'Nová skupina',
    description: 'Sekce s bloky uvnitř — v panelu zvolíte kartu nebo bez pozadí',
    category: 'Layout',
  },
  { type: 'columns-2', label: '2 sloupce', description: 'Dva vedle sebe na desktopu', category: 'Layout' },
  { type: 'columns-3', label: '3 sloupce', description: 'Tři menší informační sloupce', category: 'Layout' },
  { type: 'hero', label: 'Hero', description: 'Úvodní banner s nadpisem', category: 'Brand' },
  { type: 'product-collage', label: 'Produktová koláž', description: 'Výběr produktů a balíčků, mřížka / seznam / malé náhledy', category: 'Commerce' },
  {
    type: 'webinar',
    label: 'Webinář',
    description: 'Karta webináře jako na webu — velký náhled nebo kompaktní s CTA',
    category: 'Content',
  },
];

export function randomBlockId() {
  return `vb-block-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBlockShell(
  type: EmailBlockType,
  innerHtml: string,
  style?: string,
  attrs?: Record<string, string>,
): string {
  const inline = style ? ` style="${style}"` : '';
  const extra = attrs
    ? Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
        .join('')
    : '';
  return `<div data-vb-block="${type}" data-vb-block-id="${randomBlockId()}"${extra}${inline}>${innerHtml}</div>`;
}

export type EmailColumnContentKind = 'text' | 'image' | 'button';

/** Obsah po výběru typu ve sloupci — kompaktní verze knihovních bloků. */
export function buildEmailColumnContentHtml(kind: EmailColumnContentKind): string {
  switch (kind) {
    case 'image':
      return '<img src="https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=800&q=80" alt="Obrázek" style="display:block;width:100%;max-width:100%;height:auto;border-radius:16px;" />';
    case 'button':
      return `<div style="text-align:center;"><a class="vb-preview-cta" href="${previewCtaUrl()}" style="display:inline-block;background-color:#7C3AED;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;">Vyzkoušet zdarma</a></div>`;
    case 'text':
    default:
      return '<p style="margin:0;font-size:13px;line-height:1.65;color:#334155;">Sem napište text sloupce.</p>';
  }
}

/** Jednotka uvnitř buňky sloupců — jde vybrat a upravit samostatně. */
export function isEmailColumnUnit(el: HTMLElement | null | undefined): boolean {
  return !!el?.hasAttribute('data-vb-col-unit');
}

export function getColumnsHostForBlock(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  const type = el.getAttribute('data-vb-block');
  if (type === 'columns-2' || type === 'columns-3') return el;
  return el.closest(
    '[data-vb-block="columns-2"], [data-vb-block="columns-3"]',
  ) as HTMLElement | null;
}

function createColumnUnitEl(
  doc: Document,
  kind: EmailBlockType,
  innerHtml: string,
): HTMLElement {
  const unit = doc.createElement('div');
  unit.setAttribute('data-vb-block', kind);
  unit.setAttribute('data-vb-block-id', randomBlockId());
  unit.setAttribute('data-vb-col-unit', '1');
  unit.setAttribute('style', 'padding:0;background-color:transparent;');
  unit.innerHTML = innerHtml;
  return unit;
}

/** Sbalí volný obsah buňky do jednotky se vlastním id (kvůli individuálnímu výběru). */
function wrapAsColumnUnit(nodes: Element[], doc: Document, fallbackKind: EmailBlockType = 'text'): HTMLElement {
  if (nodes.length === 1) {
    const only = nodes[0] as HTMLElement;
    if (isEmailColumnUnit(only)) return only;
    if (only.hasAttribute('data-vb-block-id') && only.getAttribute('data-vb-block') !== 'section') {
      only.setAttribute('data-vb-col-unit', '1');
      return only;
    }
  }
  const tmp = doc.createElement('div');
  for (const n of nodes) tmp.appendChild(n);
  const kind = (nodes.length === 1 ? inferEmailBlockType(nodes[0]) : fallbackKind) || fallbackKind;
  const unit = createColumnUnitEl(doc, kind === 'columns-2' || kind === 'columns-3' ? 'text' : kind, '');
  while (tmp.firstChild) unit.appendChild(tmp.firstChild);
  return unit;
}

/**
 * Nahradí výběr typu ve sloupci zvoleným obsahem.
 * Vrací novou jednotku sloupce (pro výběr), ne celý layout.
 */
export function fillEmailColumnChooser(
  target: HTMLElement,
  kind: EmailColumnContentKind,
): HTMLElement | null {
  const chooser = target.hasAttribute('data-vb-col-chooser')
    ? target
    : (target.closest('[data-vb-col-chooser]') as HTMLElement | null);
  if (!chooser) return null;
  const ownerDoc = chooser.ownerDocument;
  if (!ownerDoc) return null;

  const unit = createColumnUnitEl(ownerDoc, kind, buildEmailColumnContentHtml(kind).trim());
  chooser.replaceWith(unit);
  return unit;
}

/** Prázdný sloupec: tři ikony (text / obrázek / tlačítko) — jen v editoru. */
export function buildColumnChooserHtml(): string {
  return buildColumnPlaceholderHtml(0, 2);
}

function buildColumnPlaceholderHtml(_index: number, _count: 2 | 3): string {
  const btn = (kind: EmailColumnContentKind, label: string, svg: string) =>
    `<button type="button" data-vb-col-choose="${kind}" title="${label}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;flex:1;min-width:0;margin:0;padding:12px 6px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;color:#001161;cursor:pointer;font:inherit;">` +
    `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#F3F0FF;color:#7C3AED;">${svg}</span>` +
    `<span style="font-size:11px;font-weight:700;letter-spacing:0.02em;">${label}</span></button>`;

  const iconText =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>';
  const iconImage =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 20"/></svg>';
  const iconButton =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 12h.01"/></svg>';

  return (
    `<div data-vb-col-placeholder="1" data-vb-col-chooser="1" contenteditable="false" style="background:#fafbfd;border:1px dashed #c7cdd8;border-radius:16px;padding:16px 12px;text-align:center;">` +
    `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(0,17,97,0.4);margin:0 0 12px 0;">Co sem vložit?</div>` +
    `<div style="display:flex;gap:8px;align-items:stretch;">` +
    btn('text', 'Text', iconText) +
    btn('image', 'Obrázek', iconImage) +
    btn('button', 'Tlačítko', iconButton) +
    `</div></div>`
  );
}

export function wrapRootBlockInSection(innerBlockHtml: string, fill: EmailSectionFill = 'card'): string {
  const id = randomBlockId();
  if (fill === 'plain') {
    return `<div data-vb-block="section" data-vb-section-fill="plain" data-vb-chrome-border="0" data-vb-chrome-shadow="0" data-vb-chrome-radius="${EMAIL_SECTION_DEFAULT_RADIUS}" data-vb-block-id="${id}" style="padding:0;background:transparent;border:none;box-shadow:none;border-radius:0;margin-bottom:32px;">${innerBlockHtml}</div>`;
  }
  return `<div data-vb-block="section" data-vb-section-fill="card" data-vb-chrome-border="0" data-vb-chrome-shadow="0" data-vb-chrome-radius="${EMAIL_SECTION_DEFAULT_RADIUS}" data-vb-block-id="${id}" style="padding:0 0 28px 0;background:#ffffff;border:none;box-shadow:none;border-radius:${EMAIL_SECTION_DEFAULT_RADIUS}px;overflow:visible;box-sizing:border-box;margin-bottom:32px;">${innerBlockHtml}</div>`;
}

export function buildEmailSectionHtml(fill: EmailSectionFill = 'card'): string {
  return wrapRootBlockInSection(buildEmailBlockHtml('text'), fill);
}

export function buildEmailBlockHtml(type: EmailBlockType): string {
  switch (type) {
    case 'text':
      return buildBlockShell(
        'text',
        '<p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#334155;">Sem vložte hlavní sdělení e-mailu. Pište stručně a srozumitelně.</p><p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">Druhý odstavec můžete použít pro detail, benefit nebo přirozené navázání.</p>',
        'padding:10px 24px;background-color:transparent;',
      );
    case 'image':
      return buildBlockShell(
        'image',
        '<img src="https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=80" alt="Obrázek v e-mailu" style="display:block;width:100%;max-width:100%;height:auto;border-radius:16px;" />',
        'padding:18px 22px;background-color:transparent;',
      );
    case 'button':
      return buildBlockShell(
        'button',
        `<div style="text-align:center;"><a class="vb-preview-cta" href="${previewCtaUrl()}" style="display:inline-block;background-color:#7C3AED;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:999px;text-decoration:none;">Vyzkoušet zdarma</a></div>`,
        'padding:16px 24px 28px 24px;background-color:transparent;',
      );
    case 'divider':
      return buildBlockShell(
        'divider',
        '<div style="height:1px;background:#dbe2ea;width:100%;font-size:0;line-height:0;">&nbsp;</div>',
        'padding:10px 22px;background-color:transparent;',
      );
    case 'flow-break':
      return buildBlockShell(
        'flow-break',
        '<div style="height:1px;width:100%;font-size:0;line-height:0;opacity:0;" aria-hidden="true">&nbsp;</div>',
        'padding:0;margin:0;background-color:transparent;',
      );
    case 'section':
      return buildEmailSectionHtml('card');
    case 'gap-content':
      return buildBlockShell(
        'gap-content',
        '<p style="margin:0;text-align:center;font-size:14px;line-height:1.55;color:rgba(0,17,97,0.78);">Krátký text přímo v mezeře mezi kartami (bez bílé karty).</p>',
        'padding:12px 22px;background-color:transparent;',
      );
    case 'highlight': {
      const hlBorder = highlightBorderFromBackground(EMAIL_HIGHLIGHT_DEFAULT_BG);
      return buildBlockShell(
        'highlight',
        `<div data-vb-highlight-box="1" style="background:${EMAIL_HIGHLIGHT_DEFAULT_BG};border:${hlBorder};border-radius:${EMAIL_HIGHLIGHT_DEFAULT_RADIUS}px;padding:18px 22px 16px 22px;width:100%;box-shadow:none;box-sizing:border-box;"><h3 style="${EMAIL_BUILDER_HEADING_STYLES.h3}">Co je dobré vědět</h3><p style="margin:0;font-size:13px;line-height:1.65;color:#334155;">Tento blok se hodí na shrnutí, tip nebo stručné vysvětlení.</p></div>`,
        // Full-bleed výchozí — boční mezery jen ve skupině s dalšími bloky (viz applyHighlightChrome).
        `padding:0;background-color:transparent;`,
        {
          'data-vb-chrome-bg': EMAIL_HIGHLIGHT_DEFAULT_BG,
          'data-vb-chrome-border': '1',
          'data-vb-chrome-shadow': '0',
          'data-vb-chrome-radius': String(EMAIL_HIGHLIGHT_DEFAULT_RADIUS),
          'data-vb-highlight-bleed': '1',
        },
      );
    }
    case 'columns-2':
      return buildBlockShell(
        'columns-2',
        `<table class="vb-email-cols" data-vb-columns="2" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;"><tr><td class="vb-email-col" valign="top" width="50%" style="width:50%;vertical-align:top;padding:0 8px 0 0;">${buildColumnPlaceholderHtml(0, 2)}</td><td class="vb-email-col" valign="top" width="50%" style="width:50%;vertical-align:top;padding:0 0 0 8px;">${buildColumnPlaceholderHtml(1, 2)}</td></tr></table>`,
        'padding:18px 22px;background-color:transparent;',
      );
    case 'columns-3':
      return buildBlockShell(
        'columns-3',
        `<table class="vb-email-cols" data-vb-columns="3" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;"><tr><td class="vb-email-col" valign="top" width="33.33%" style="width:33.33%;vertical-align:top;padding:0 8px 0 0;">${buildColumnPlaceholderHtml(0, 3)}</td><td class="vb-email-col" valign="top" width="33.33%" style="width:33.33%;vertical-align:top;padding:0 4px;">${buildColumnPlaceholderHtml(1, 3)}</td><td class="vb-email-col" valign="top" width="33.33%" style="width:33.33%;vertical-align:top;padding:0 0 0 8px;">${buildColumnPlaceholderHtml(2, 3)}</td></tr></table>`,
        'padding:18px 22px;background-color:transparent;',
      );
    case 'hero':
      return buildBlockShell(
        'hero',
        `<div data-vb-hero-box="1" style="background:${EMAIL_HERO_DEFAULT_BG};border-radius:${EMAIL_HERO_DEFAULT_RADIUS}px;padding:28px 22px;text-align:center;"><div style="display:inline-block;margin:0 0 10px 0;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:11px;font-weight:700;letter-spacing:0.06em;color:#ffffff;text-transform:uppercase;">Vividbooks</div><h2 style="margin:0 0 10px 0;font-size:28px;line-height:1.2;color:#ffffff;">Sem napište hlavní claim</h2><p style="margin:0;font-size:13px;line-height:1.65;color:rgba(255,255,255,0.82);">Krátké vysvětlení, proč má čtenář pokračovat dál.</p></div>`,
        'padding:18px 22px;background-color:transparent;',
        {
          'data-vb-chrome-bg': EMAIL_HERO_DEFAULT_BG,
          'data-vb-chrome-radius': String(EMAIL_HERO_DEFAULT_RADIUS),
        },
      );
    case 'product-collage':
      return buildProductCollageBlockHtml('grid', [], randomBlockId());
    case 'webinar':
      return buildWebinarBlockHtml('hero', EMPTY_EMAIL_WEBINAR_SNAPSHOT, randomBlockId());
    case 'html':
    default:
      return buildBlockShell(
        'html',
        '<div style="font-size:14px;line-height:1.6;color:#475569;">Vlastní HTML blok</div>',
        'padding:18px 22px;background-color:transparent;',
      );
  }
}

const KNOWN_BLOCK_ATTR = new Set<string>([
  'text',
  'image',
  'button',
  'divider',
  'flow-break',
  'section',
  'card-group',
  'gap-content',
  'highlight',
  'columns-2',
  'columns-3',
  'hero',
  'product-collage',
  'webinar',
  'html',
]);

export function inferEmailBlockType(el: Element): EmailBlockType {
  const explicit = el.getAttribute('data-vb-block');
  if (explicit === 'section' || explicit === 'card-group') return 'section';
  if (explicit && KNOWN_BLOCK_ATTR.has(explicit)) {
    return explicit as EmailBlockType;
  }
  if (el.hasAttribute('data-product-collage')) return 'product-collage';
  if (el.querySelector('[data-product-collage]')) return 'product-collage';
  if (el.hasAttribute('data-email-webinar')) return 'webinar';
  if (el.querySelector('[data-email-webinar]')) return 'webinar';
  if (el.tagName === 'HR') return 'divider';
  if (el.tagName === 'IMG' || (el.querySelector('img') && !el.querySelector('table'))) return 'image';
  if (el.tagName === 'A' && el.classList.contains('vb-preview-cta')) return 'button';
  if (el.querySelector('a.vb-preview-cta')) return 'button';
  if (el.querySelector('table')) {
    const cols = el.querySelectorAll('td').length;
    if (cols >= 3) return 'columns-3';
    if (cols >= 2) return 'columns-2';
  }
  const style = (el.getAttribute('style') || '').toLowerCase();
  if (style.includes('background') && (el.querySelector('h1,h2') || el.querySelector('h3'))) {
    return style.includes('#001161') ? 'hero' : 'highlight';
  }
  if (el.querySelector('h1,h2')) return 'hero';
  if (el.querySelector('h3,h4')) return 'highlight';
  if (el.querySelector('p,ul,ol')) return 'text';
  return 'html';
}

/** Přímé elementové děti textového bloku (bez style/script) — stejná mřížka jako u výpočtu splitu. */
export function getTextBlockElementChildren(host: HTMLElement): HTMLElement[] {
  return [...host.children].filter(
    (c): c is HTMLElement => c.nodeType === Node.ELEMENT_NODE && !/^(STYLE|SCRIPT)$/i.test(c.tagName),
  );
}

/**
 * Textový blok vložený přímo pod kořen DnD nebo do sekce — lze ho při dropu z knihovny rozdělit.
 */
export function findTopLevelTextBlockHostForDrop(
  start: Element | null,
  rootDnd: HTMLElement,
): HTMLElement | null {
  if (!start || !rootDnd.contains(start)) return null;
  const t = start.closest('[data-vb-block="text"]') as HTMLElement | null;
  if (!t || !rootDnd.contains(t)) return null;
  const p = t.parentElement;
  if (p !== rootDnd && p?.getAttribute('data-vb-block') !== 'section') return null;
  return t;
}

/**
 * Kam rozdělit textový blok při dropu z knihovny: index prvního odstavce v pravé části (1..n-1).
 * Vyžaduje alespoň dva elementové potomky (typicky dva <p>).
 */
export function findTextBlockLibraryDropSplitIndex(host: HTMLElement, clientY: number): number | null {
  const children = getTextBlockElementChildren(host);
  const n = children.length;
  if (n < 2) return null;

  const rects = children.map((c) => c.getBoundingClientRect());

  const gapSlackPx = 8;
  for (let i = 1; i < n; i++) {
    const a = rects[i - 1].bottom;
    const b = rects[i].top;
    const lo = Math.min(a, b) - gapSlackPx;
    const hi = Math.max(a, b) + gapSlackPx;
    if (clientY >= lo && clientY <= hi) {
      return i;
    }
  }

  for (let i = 0; i < n; i++) {
    if (clientY >= rects[i].top && clientY <= rects[i].bottom) {
      const mid = rects[i].top + rects[i].height / 2;
      if (clientY < mid) {
        if (i >= 1) return i;
        return null;
      }
      if (i < n - 1) return i + 1;
      return null;
    }
  }

  if (clientY < rects[0].top) return null;
  if (clientY > rects[n - 1].bottom) return null;

  return null;
}

/**
 * Uzel vhodný k přeuspořádání DnD: top-level `section` jen pod kořenem; ostatní bloky s id uvnitř
 * sekce tak, že na cestě k `section` není jiný `data-vb-block-id` (řeší obalové divy z importu).
 */
export function isDndReorderableEmailBlock(el: HTMLElement, rootDnd: HTMLElement): boolean {
  if (!el.hasAttribute('data-vb-block-id') || !rootDnd.contains(el)) return false;
  if (el.getAttribute('data-vb-block') === 'section') {
    return el.parentElement === rootDnd;
  }
  const sec = el.closest('[data-vb-block="section"]');
  if (!sec || !rootDnd.contains(sec)) {
    return el.parentElement === rootDnd;
  }
  let x: HTMLElement | null = el.parentElement;
  while (x && x !== sec) {
    if (x.hasAttribute('data-vb-block-id')) return false;
    x = x.parentElement;
  }
  return x === sec;
}

/** Nejvnitřnější přetahovatelný blok z místa kliknutí (ne celá sekce kvůli obalům). */
export function findDndBlockFromDragTarget(target: EventTarget | null, rootDnd: HTMLElement): HTMLElement | null {
  if (!target || typeof (target as Node).nodeType !== 'number') return null;
  const raw = target as Node;
  const el =
    raw.nodeType === Node.TEXT_NODE ? (raw as Text).parentElement : (raw as HTMLElement);
  if (!el || !rootDnd.contains(el)) return null;

  let n: HTMLElement | null = el.closest('[data-vb-block-id]');
  while (n) {
    if (isDndReorderableEmailBlock(n, rootDnd)) return n;
    const par = n.parentElement;
    if (!par || !rootDnd.contains(par)) return null;
    n = par.closest('[data-vb-block-id]');
  }
  return null;
}

/**
 * Starší maily nemají v buňkách `data-vb-col-unit` — bez toho jde vybrat jen celý layout.
 * Zabalí volný obsah každé buňky do jednotky (chooser nechá být).
 */
export function ensureEmailColumnUnits(rootOrBlock: HTMLElement): boolean {
  const hosts = rootOrBlock.matches?.('[data-vb-block="columns-2"], [data-vb-block="columns-3"]')
    ? [rootOrBlock]
    : ([
        ...rootOrBlock.querySelectorAll('[data-vb-block="columns-2"], [data-vb-block="columns-3"]'),
      ] as HTMLElement[]);
  const doc = rootOrBlock.ownerDocument;
  if (!doc || hosts.length === 0) return false;
  let changed = false;
  for (const host of hosts) {
    const table = columnsTableOf(host);
    if (!table) continue;
    if (!table.hasAttribute('data-vb-columns')) {
      table.setAttribute(
        'data-vb-columns',
        host.getAttribute('data-vb-block') === 'columns-3' ? '3' : '2',
      );
      changed = true;
    }
    for (const td of columnCellsOf(table)) {
      if (td.querySelector('[data-vb-col-unit]')) continue;
      if (td.querySelector('[data-vb-col-chooser]')) continue;
      const kids = [...td.children].filter(
        (c) => c.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName),
      );
      if (kids.length === 0) continue;
      // Přímý potomek s id, ale bez data-vb-col-unit (starší fill).
      if (
        kids.length === 1 &&
        (kids[0] as HTMLElement).hasAttribute('data-vb-block-id') &&
        (kids[0] as HTMLElement).getAttribute('data-vb-block') !== 'section'
      ) {
        (kids[0] as HTMLElement).setAttribute('data-vb-col-unit', '1');
        changed = true;
        continue;
      }
      td.appendChild(wrapAsColumnUnit(kids, doc, 'text'));
      changed = true;
    }
  }
  return changed;
}

/**
 * Jednotka buňky pod kurzorem — případně ji nejdřív vytvoří ze starého obsahu bez wrapperu.
 */
export function ensureColumnUnitAtTarget(
  target: EventTarget | null,
  rootDnd: HTMLElement,
): HTMLElement | null {
  if (!target || typeof (target as Node).nodeType !== 'number') return null;
  const raw = target as Node;
  const el =
    raw.nodeType === Node.TEXT_NODE ? (raw as Text).parentElement : (raw as HTMLElement);
  if (!el || !rootDnd.contains(el)) return null;

  const existing = el.closest('[data-vb-col-unit]') as HTMLElement | null;
  if (existing && rootDnd.contains(existing)) return existing;

  // Starší layouty nemají `data-vb-columns` na tabulce — bereme buňku uvnitř columns-2/3.
  const host = el.closest(
    '[data-vb-block="columns-2"], [data-vb-block="columns-3"]',
  ) as HTMLElement | null;
  const td = el.closest('td, th') as HTMLElement | null;
  if (!host || !td || !rootDnd.contains(host) || !host.contains(td)) return null;
  if (td.querySelector(':scope > [data-vb-col-chooser]')) return null;

  const unit = td.querySelector(':scope > [data-vb-col-unit]') as HTMLElement | null;
  if (unit) return unit;

  const doc = td.ownerDocument;
  if (!doc) return null;
  const kids = [...td.children].filter(
    (c) => c.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName),
  );
  if (kids.length === 0) return null;
  const created = wrapAsColumnUnit(kids, doc, 'text');
  td.appendChild(created);
  return created;
}

/**
 * Blok pro výběr / hover / inspector: uvnitř sloupců preferuje jednotku buňky,
 * jinak stejný cíl jako DnD (celý layout sloupců se nepřepíše výběrem jedné buňky).
 */
export function findSelectableEmailBlock(
  target: EventTarget | null,
  rootDnd: HTMLElement,
): HTMLElement | null {
  if (!target || typeof (target as Node).nodeType !== 'number') return null;
  const raw = target as Node;
  const el =
    raw.nodeType === Node.TEXT_NODE ? (raw as Text).parentElement : (raw as HTMLElement);
  if (!el || !rootDnd.contains(el)) return null;

  // Nejdřív buňka sloupců (včetně migrace starého obsahu bez wrapperu).
  const colUnit = ensureColumnUnitAtTarget(target, rootDnd);
  if (colUnit) return colUnit;

  let n: HTMLElement | null = el.closest('[data-vb-block-id]');
  while (n && rootDnd.contains(n)) {
    const type = n.getAttribute('data-vb-block');
    if (
      type &&
      type !== 'section' &&
      type !== 'columns-2' &&
      type !== 'columns-3' &&
      n.closest('[data-vb-columns]') &&
      rootDnd.contains(n.closest('[data-vb-columns]') as Node)
    ) {
      n.setAttribute('data-vb-col-unit', '1');
      return n;
    }
    if (isDndReorderableEmailBlock(n, rootDnd)) return n;
    const par = n.parentElement;
    if (!par || !rootDnd.contains(par)) break;
    n = par.closest('[data-vb-block-id]');
  }
  return findDndBlockFromDragTarget(target, rootDnd);
}

function migrateCardGroupToSection(root: HTMLElement) {
  root.querySelectorAll('[data-vb-block="card-group"]').forEach((raw) => {
    const h = raw as HTMLElement;
    h.setAttribute('data-vb-block', 'section');
    if (!h.getAttribute('data-vb-section-fill')) h.setAttribute('data-vb-section-fill', 'card');
  });
}

/** Zajistí, že přímo pod kořenem jsou jen skupiny (`section`). Volné bloky zabalí do jedné skupiny. */
function ensureRootOnlySections(root: HTMLElement) {
  migrateCardGroupToSection(root);
  const doc = root.ownerDocument!;
  let again = true;
  while (again) {
    again = false;
    for (const node of [...root.children]) {
      if (!isConcreteBlockEl(node)) continue;
      if (node.getAttribute('data-vb-block') === 'section') continue;
      const wrap = createSectionEl(doc, 'card');
      root.insertBefore(wrap, node);
      let cur: Element | null = node;
      while (cur && cur.parentElement === root && (cur as HTMLElement).getAttribute('data-vb-block') !== 'section') {
        const nxt = cur.nextElementSibling;
        wrap.appendChild(cur);
        cur = nxt;
      }
      again = true;
      break;
    }
  }
}

function repairEmptySections(root: HTMLElement) {
  root.querySelectorAll('[data-vb-block="section"]').forEach((raw) => {
    const g = raw as HTMLElement;
    const kids = [...g.children].filter(
      (c) => c.nodeType === Node.ELEMENT_NODE && !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName),
    );
    if (kids.length === 0) {
      g.innerHTML = buildEmailBlockHtml('text');
      normalizeEmailBlockContainer(g);
    }
  });
}

/**
 * Unikátní `data-vb-block-id` v celém stromě. Bez toho `querySelector` vždy trefí jen první blok
 * a nahrazení obrázku / inspektor působí „nahradil se jiný blok“ (časté po copy/paste nebo AI).
 * První výskyt daného id v pořadí dokumentu zůstane; další dostanou nové ID.
 */
function dedupeDataVbBlockIds(root: HTMLElement) {
  const seen = new Set<string>();
  for (const el of root.querySelectorAll('[data-vb-block-id]')) {
    let id = el.getAttribute('data-vb-block-id');
    if (!id) continue;
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }
    let newId: string;
    do {
      newId = randomBlockId();
    } while (seen.has(newId));
    el.setAttribute('data-vb-block-id', newId);
    seen.add(newId);
  }
}

export function normalizeEmailBodyHtml(html: string): string {
  const normalized = (html || '').trim();
  if (!normalized) return `<div class="vb-email-root">${buildEmailSectionHtml('card')}</div>`;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return normalized;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${normalized}</body>`, 'text/html');
  const body = doc.body;

  let root = body.querySelector(':scope > .vb-email-root') as HTMLElement | null;
  if (!root) {
    root = doc.createElement('div');
    root.className = 'vb-email-root';
    while (body.firstChild) root.appendChild(body.firstChild);
    body.appendChild(root);
  }

  const children = [...root.children];
  if (children.length === 0) {
    root.innerHTML = buildEmailSectionHtml('card');
  } else {
    ensureRootOnlySections(root);
    normalizeEmailBlockContainer(root);
  }
  repairEmptySections(root);
  dedupeDataVbBlockIds(root);
  stripCardChromeInsideSections(root);
  applyEmailBuilderHeadingStyles(root);
  return root.outerHTML;
}

/** Přiřadí id a typ uzlům; u `section` rekurzivně zpracuje vnitřní bloky. */
function normalizeEmailBlockContainer(container: HTMLElement) {
  for (const child of [...container.children]) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (/^(STYLE|SCRIPT)$/i.test((child as HTMLElement).tagName)) continue;
    const el = child as HTMLElement;
    if (!el.getAttribute('data-vb-block-id')) {
      el.setAttribute('data-vb-block-id', randomBlockId());
    }
    const explicit = el.getAttribute('data-vb-block') as string | null;
    const t = explicit === 'card-group' ? 'section' : explicit || inferEmailBlockType(el);
    el.setAttribute('data-vb-block', t);
    if (t === 'section') {
      if (!el.getAttribute('data-vb-section-fill')) {
        el.setAttribute('data-vb-section-fill', 'card');
      }
      // Chrome jen na skupině — doplň attrs + inline style, vnitřek vyčisti.
      if (!el.hasAttribute('data-vb-chrome-border')) el.setAttribute('data-vb-chrome-border', '0');
      if (!el.hasAttribute('data-vb-chrome-shadow')) el.setAttribute('data-vb-chrome-shadow', '0');
      if (!el.hasAttribute('data-vb-chrome-radius')) {
        el.setAttribute('data-vb-chrome-radius', String(EMAIL_SECTION_DEFAULT_RADIUS));
      }
      applySectionChrome(el);
      normalizeEmailBlockContainer(el);
    } else if (t === 'highlight') {
      applyHighlightChrome(el);
    } else if (t === 'webinar') {
      applyWebinarGroupInset(el);
    } else if (t === 'columns-2' || t === 'columns-3') {
      // Označ tabulku a zabal buňky — jinak jde vybrat jen celý layout.
      const table = columnsTableOf(el);
      if (table && !table.hasAttribute('data-vb-columns')) {
        table.setAttribute('data-vb-columns', t === 'columns-2' ? '2' : '3');
      }
      ensureEmailColumnUnits(el);
    }
  }
}

export function getEmailBlockLabel(type: EmailBlockType): string {
  return EMAIL_BLOCK_PRESETS.find((block) => block.type === type)?.label || 'HTML blok';
}

export function extractFirstLink(el: Element): HTMLAnchorElement | null {
  return (el.querySelector('a.vb-preview-cta') || el.querySelector('a')) as HTMLAnchorElement | null;
}

export function extractFirstImage(el: Element): HTMLImageElement | null {
  return el.querySelector('img');
}

export function readElementBackground(el: Element): string {
  const style = el.getAttribute('style') || '';
  const match = style.match(/background(?:-color)?:\s*([^;]+)/i);
  return (match?.[1] || '').trim();
}

export function readElementPadding(el: Element): string {
  const style = el.getAttribute('style') || '';
  const match = style.match(/padding:\s*([^;]+)/i);
  return (match?.[1] || '').trim();
}

/** Padding bloku rozpadlý na svislý/vodorovný — panel s ním jede na dvou sliderech. */
export function parseBlockPadding(padding: string): { vertical: number; horizontal: number } {
  const nums = (padding || '')
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return { vertical: 0, horizontal: 0 };
  if (nums.length === 1) return { vertical: nums[0], horizontal: nums[0] };
  return { vertical: nums[0], horizontal: nums[1] };
}

export function formatBlockPadding(vertical: number, horizontal: number): string {
  return `${Math.max(0, Math.round(vertical))}px ${Math.max(0, Math.round(horizontal))}px`;
}

/** Stín, který zapíná přepínač v panelu. Emailoví klienti box-shadow ignorují, v náhledu ho ale chceme. */
export const EMAIL_BLOCK_SHADOW = '0 6px 18px rgba(0,17,97,0.10)';

export function readElementHasShadow(el: Element): boolean {
  const style = el.getAttribute('style') || '';
  const match = style.match(/box-shadow:\s*([^;]+)/i);
  const value = (match?.[1] || '').trim().toLowerCase();
  return !!value && value !== 'none';
}

export function setInlineStyleValue(styleText: string, property: string, value: string): string {
  const safeValue = value.trim();
  const parts = styleText
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.toLowerCase().startsWith(`${property.toLowerCase()}:`));
  if (safeValue) parts.push(`${property}:${escapeHtml(safeValue)}`);
  return parts.join(';');
}

function isConcreteBlockEl(el: Element | null): el is HTMLElement {
  // Pozor: `instanceof HTMLElement` tu nefunguje — náhled běží v iframu s vlastním realmem.
  return !!el && el.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test(el.tagName);
}

function isSectionLike(el: HTMLElement): boolean {
  const t = el.getAttribute('data-vb-block');
  return t === 'section' || t === 'card-group';
}

/** Skupina (`section`) okolo bloku — nejbližší ancestor v rámci root. */
export function getHostSectionForBlock(block: HTMLElement, root: HTMLElement): HTMLElement | null {
  if (!root.contains(block)) return null;
  if (isSectionLike(block)) return block;
  const sec = block.closest('[data-vb-block="section"], [data-vb-block="card-group"]') as HTMLElement | null;
  if (sec && root.contains(sec)) return sec;
  return null;
}

/**
 * Najde uzel podle `data-vb-block-id`. Při duplicitách preferuje přeuspořadatelný obsah,
 * pak top-level sekci — `querySelector` jinak často trefí špatný první uzel.
 */
export function findEmailBlockById(root: HTMLElement, blockId: string): HTMLElement | null {
  const id = (blockId || '').trim();
  if (!id || !root) return null;
  let nodes: HTMLElement[];
  try {
    nodes = [...root.querySelectorAll(`[data-vb-block-id="${CSS.escape(id)}"]`)] as HTMLElement[];
  } catch {
    nodes = [...root.querySelectorAll('[data-vb-block-id]')].filter(
      (el) => el.getAttribute('data-vb-block-id') === id,
    ) as HTMLElement[];
  }
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  const content = nodes.find((n) => !isSectionLike(n) && isDndReorderableEmailBlock(n, root));
  if (content) return content;
  const topSec = nodes.find((n) => isSectionLike(n) && n.parentElement === root);
  if (topSec) return topSec;
  const anyReorderable = nodes.find((n) => isDndReorderableEmailBlock(n, root));
  return anyReorderable || nodes[0];
}

export function readSectionChrome(sec: HTMLElement): EmailSectionChrome {
  const fill = sec.getAttribute('data-vb-section-fill') === 'plain' ? 'plain' : 'card';
  const bgAttr = (sec.getAttribute('data-vb-chrome-bg') || '').trim();
  const radiusRaw = Number.parseInt(sec.getAttribute('data-vb-chrome-radius') || '', 10);
  return {
    fill,
    background: bgAttr,
    // Výchozí BEZ ohraničení — uživatel ho zapne v panelu. Starý CSS border byl nežádoucí.
    border: sec.getAttribute('data-vb-chrome-border') === '1',
    shadow: sec.getAttribute('data-vb-chrome-shadow') === '1',
    radius: Number.isFinite(radiusRaw)
      ? Math.max(0, Math.min(48, radiusRaw))
      : EMAIL_SECTION_DEFAULT_RADIUS,
  };
}

/** Zapíše chrome attrs + inline style na skupinu (náhled i export). */
export function applySectionChrome(sec: HTMLElement, patch?: Partial<EmailSectionChrome>) {
  const cur = readSectionChrome(sec);
  const next: EmailSectionChrome = {
    fill: patch?.fill ?? cur.fill,
    background: patch?.background !== undefined ? patch.background : cur.background,
    border: patch?.border ?? cur.border,
    shadow: patch?.shadow ?? cur.shadow,
    radius: patch?.radius ?? cur.radius,
  };

  sec.setAttribute('data-vb-block', 'section');
  sec.setAttribute('data-vb-section-fill', next.fill);
  sec.setAttribute('data-vb-chrome-border', next.border ? '1' : '0');
  sec.setAttribute('data-vb-chrome-shadow', next.shadow ? '1' : '0');
  sec.setAttribute('data-vb-chrome-radius', String(next.radius));
  if (next.background) sec.setAttribute('data-vb-chrome-bg', next.background);
  else sec.removeAttribute('data-vb-chrome-bg');

  if (next.fill === 'plain') {
    sec.setAttribute(
      'style',
      'padding:0;background:transparent;border:none;box-shadow:none;border-radius:0;margin-bottom:32px;',
    );
    return next;
  }

  const bg = next.background || '#ffffff';
  const parts = [
    // Spodní padding drží CTA uvnitř border-radius (klienti často ořezávají i při overflow:visible).
    'padding:0 0 28px 0',
    `background:${bg}`,
    `border-radius:${next.radius}px`,
    // visible — fixed height / overflow:hidden na sekci ořezával CTA u webinářů
    'overflow:visible',
    'box-sizing:border-box',
    'margin-bottom:32px',
    next.border ? `border:${EMAIL_SECTION_BORDER}` : 'border:none',
    next.shadow ? `box-shadow:${EMAIL_BLOCK_SHADOW}` : 'box-shadow:none',
  ];
  sec.setAttribute('style', `${parts.join(';')};`);
  return next;
}

function createSectionEl(doc: Document, fill: EmailSectionFill): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.setAttribute('data-vb-block-id', randomBlockId());
  applySectionChrome(wrap, {
    fill,
    background: '',
    border: false,
    shadow: false,
    radius: EMAIL_SECTION_DEFAULT_RADIUS,
  });
  return wrap;
}

/** Vnitřní plocha zvýrazněného boxu — chrome sem, shell bloku zůstane transparentní ve skupině. */
export function ensureHighlightBox(block: HTMLElement, doc?: Document): HTMLElement {
  const owner = doc || block.ownerDocument;
  const existing = block.querySelector(':scope > [data-vb-highlight-box]') as HTMLElement | null;
  if (existing) return existing;

  const kids = [...block.children].filter(
    (c) => c.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName),
  ) as HTMLElement[];
  if (kids.length === 1 && !kids[0].hasAttribute('data-vb-block-id')) {
    kids[0].setAttribute('data-vb-highlight-box', '1');
    return kids[0];
  }

  const box = owner.createElement('div');
  box.setAttribute('data-vb-highlight-box', '1');
  while (block.firstChild) box.appendChild(block.firstChild);
  block.appendChild(box);
  return box;
}

export function readHighlightChrome(block: HTMLElement): EmailHighlightChrome {
  const box = block.querySelector(':scope > [data-vb-highlight-box]') as HTMLElement | null;
  const bgAttr = (block.getAttribute('data-vb-chrome-bg') || '').trim();
  const fromBox = box ? readElementBackground(box) : '';
  const radiusRaw = Number.parseInt(block.getAttribute('data-vb-chrome-radius') || '', 10);
  const borderAttr = block.getAttribute('data-vb-chrome-border');
  const shadowAttr = block.getAttribute('data-vb-chrome-shadow');
  // Bez attrs: odvoď z aktuálního boxu (staré drafty).
  let border = borderAttr === '1';
  if (borderAttr == null && box) {
    const st = box.getAttribute('style') || '';
    border = /border\s*:\s*[^;]*solid/i.test(st) && !/border\s*:\s*none/i.test(st);
  }
  let shadow = shadowAttr === '1';
  if (shadowAttr == null && box) {
    shadow = readElementHasShadow(box);
  }
  return {
    background: bgAttr || fromBox || EMAIL_HIGHLIGHT_DEFAULT_BG,
    border: borderAttr == null ? border || true : border,
    shadow,
    radius: Number.isFinite(radiusRaw)
      ? Math.max(0, Math.min(48, radiusRaw))
      : EMAIL_HIGHLIGHT_DEFAULT_RADIUS,
  };
}

/**
 * Webinář ve skupině s dalšími bloky → inset nahoře + po stranách.
 * Sám ve vlastní sekci → full-bleed (padding 0).
 */
export function applyWebinarGroupInset(block: HTMLElement) {
  if (block.getAttribute('data-vb-block') !== 'webinar') return;
  const host = block.parentElement;
  let inMultiGroup = false;
  if (host?.getAttribute('data-vb-block') === 'section') {
    const units = [...host.children].filter(
      (c) =>
        c.nodeType === 1 &&
        !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName) &&
        (c as HTMLElement).hasAttribute('data-vb-block-id'),
    );
    inMultiGroup = units.length > 1;
  }
  let style = block.getAttribute('style') || '';
  style = setInlineStyleValue(style, 'background', 'transparent');
  style = setInlineStyleValue(style, 'background-color', 'transparent');
  style = setInlineStyleValue(style, 'padding', inMultiGroup ? EMAIL_WEBINAR_GROUP_PADDING : '0');
  const cleaned = style.replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
  block.setAttribute('style', cleaned ? (cleaned.endsWith(';') ? cleaned : `${cleaned};`) : 'padding:0;background:transparent;');
  if (inMultiGroup) block.setAttribute('data-vb-webinar-inset', '1');
  else block.removeAttribute('data-vb-webinar-inset');
}

/**
 * Highlight je sám ve skupině (= je tím blokem) → full-bleed, bez bočních mezer.
 * Ve skupině s dalšími bloky → boční padding, ať sedí mezi sousedy.
 */
function highlightShellPadding(block: HTMLElement): string {
  const host = block.parentElement;
  if (host?.getAttribute('data-vb-block') === 'section') {
    const units = [...host.children].filter(
      (c) =>
        c.nodeType === 1 &&
        !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName) &&
        (c as HTMLElement).hasAttribute('data-vb-block-id'),
    );
    if (units.length > 1) return '16px 22px';
  }
  return '0';
}

/** Zapíše chrome na zvýrazněný box — barva řídí i ohraničení. Full-bleed, když je sám ve skupině. */
export function applyHighlightChrome(block: HTMLElement, patch?: Partial<EmailHighlightChrome>) {
  const cur = readHighlightChrome(block);
  const next: EmailHighlightChrome = {
    background: patch?.background !== undefined ? patch.background : cur.background,
    border: patch?.border ?? cur.border,
    shadow: patch?.shadow ?? cur.shadow,
    radius: patch?.radius ?? cur.radius,
  };
  const bg = (next.background || EMAIL_HIGHLIGHT_DEFAULT_BG).trim() || EMAIL_HIGHLIGHT_DEFAULT_BG;
  const shellPad = highlightShellPadding(block);
  const fullBleed = shellPad === '0';

  block.setAttribute('data-vb-block', 'highlight');
  block.setAttribute('data-vb-chrome-bg', bg);
  block.setAttribute('data-vb-chrome-border', next.border ? '1' : '0');
  block.setAttribute('data-vb-chrome-shadow', next.shadow ? '1' : '0');
  block.setAttribute('data-vb-chrome-radius', String(next.radius));
  if (fullBleed) block.setAttribute('data-vb-highlight-bleed', '1');
  else block.removeAttribute('data-vb-highlight-bleed');

  // Shell: žádný vlastní chrome; padding jen ve skupině s dalšími bloky.
  // border-radius na shellu = stejně jako box — ať výběr (outline) nelícuje jinak než ohraničení.
  let shell = block.getAttribute('style') || '';
  shell = setInlineStyleValue(shell, 'background', 'transparent');
  shell = setInlineStyleValue(shell, 'background-color', 'transparent');
  shell = setInlineStyleValue(shell, 'box-shadow', '');
  shell = setInlineStyleValue(shell, 'border', '');
  shell = setInlineStyleValue(shell, 'padding', shellPad);
  shell = setInlineStyleValue(shell, 'border-radius', `${next.radius}px`);
  block.setAttribute('style', shell.endsWith(';') ? shell : `${shell};`);

  const box = ensureHighlightBox(block);
  const host = block.parentElement;
  // Full-bleed: highlight vlastní jediné viditelné ohraničení; radius skupiny jen sjednoť (clip).
  if (fullBleed && host?.getAttribute('data-vb-block') === 'section') {
    host.setAttribute('data-vb-chrome-radius', String(next.radius));
    let hostStyle = host.getAttribute('style') || '';
    hostStyle = setInlineStyleValue(hostStyle, 'border-radius', `${next.radius}px`);
    // Skupinový border vypni ve full-bleed — jinak dvě ohraničení přes sebe.
    host.setAttribute('data-vb-chrome-border', '0');
    hostStyle = setInlineStyleValue(hostStyle, 'border', 'none');
    host.setAttribute('style', hostStyle.endsWith(';') ? hostStyle : `${hostStyle};`);
  }
  const parts = [
    `background:${bg}`,
    `border-radius:${next.radius}px`,
    'padding:18px 22px 16px 22px',
    'width:100%',
    'box-sizing:border-box',
    next.border ? `border:${highlightBorderFromBackground(bg)}` : 'border:none',
    next.shadow ? `box-shadow:${EMAIL_BLOCK_SHADOW}` : 'box-shadow:none',
  ];
  box.setAttribute('style', `${parts.join(';')};`);
  return next;
}

function isDarkHeroBackground(color: string): boolean {
  const rgb = parseCssColorToRgb(color);
  if (!rgb) return /#00116|#03036|#1d1d/i.test(color);
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255 < 0.58;
}

export function ensureHeroBox(block: HTMLElement): HTMLElement {
  const existing = block.querySelector(':scope > [data-vb-hero-box]') as HTMLElement | null;
  if (existing) return existing;
  const kids = [...block.children].filter(
    (c) => c.nodeType === 1 && !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName),
  ) as HTMLElement[];
  if (kids.length === 1 && !kids[0].hasAttribute('data-vb-block') && !kids[0].hasAttribute('data-vb-block-id')) {
    kids[0].setAttribute('data-vb-hero-box', '1');
    return kids[0];
  }
  const box = (block.ownerDocument || document).createElement('div');
  box.setAttribute('data-vb-hero-box', '1');
  while (block.firstChild) box.appendChild(block.firstChild);
  block.appendChild(box);
  return box;
}

export function readHeroChrome(block: HTMLElement): EmailHeroChrome {
  const box = block.querySelector(':scope > [data-vb-hero-box]') as HTMLElement | null;
  const bgAttr = (block.getAttribute('data-vb-chrome-bg') || '').trim();
  const fromBox = box ? readElementBackground(box) : '';
  const nested = !fromBox
    ? readElementBackground(
        (block.querySelector(':scope > div') as HTMLElement | null) || block,
      )
    : '';
  const radiusRaw = Number.parseInt(block.getAttribute('data-vb-chrome-radius') || '', 10);
  return {
    background: bgAttr || fromBox || nested || EMAIL_HERO_DEFAULT_BG,
    radius: Number.isFinite(radiusRaw)
      ? Math.max(0, Math.min(48, radiusRaw))
      : EMAIL_HERO_DEFAULT_RADIUS,
  };
}

/** Barva vnitřního hero boxu (ne skupiny). Tmavá → bílý text, světlá → navy. */
export function applyHeroChrome(block: HTMLElement, patch?: Partial<EmailHeroChrome>) {
  const cur = readHeroChrome(block);
  const next: EmailHeroChrome = {
    background: (patch?.background !== undefined ? patch.background : cur.background).trim() || EMAIL_HERO_DEFAULT_BG,
    radius: patch?.radius ?? cur.radius,
  };
  const dark = isDarkHeroBackground(next.background);
  block.setAttribute('data-vb-block', 'hero');
  block.setAttribute('data-vb-chrome-bg', next.background);
  block.setAttribute('data-vb-chrome-radius', String(next.radius));

  let shell = block.getAttribute('style') || '';
  shell = setInlineStyleValue(shell, 'background', 'transparent');
  shell = setInlineStyleValue(shell, 'background-color', 'transparent');
  block.setAttribute('style', shell.endsWith(';') ? shell : `${shell};`);

  const box = ensureHeroBox(block);
  let boxStyle = box.getAttribute('style') || '';
  boxStyle = setInlineStyleValue(boxStyle, 'background', next.background);
  boxStyle = setInlineStyleValue(boxStyle, 'background-color', next.background);
  boxStyle = setInlineStyleValue(boxStyle, 'border-radius', `${next.radius}px`);
  if (!/padding\s*:/i.test(boxStyle)) {
    boxStyle = setInlineStyleValue(boxStyle, 'padding', '28px 22px');
  }
  if (!/text-align\s*:/i.test(boxStyle)) {
    boxStyle = setInlineStyleValue(boxStyle, 'text-align', 'center');
  }
  box.setAttribute('style', boxStyle.endsWith(';') ? boxStyle : `${boxStyle};`);

  const title = dark ? '#ffffff' : '#001161';
  const body = dark ? 'rgba(255,255,255,0.82)' : 'rgba(0,17,97,0.72)';
  const pillBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,17,97,0.08)';
  const pillFg = dark ? '#ffffff' : '#001161';
  box.querySelectorAll('h1,h2,h3,h4').forEach((node) => {
    const el = node as HTMLElement;
    let st = el.getAttribute('style') || '';
    st = setInlineStyleValue(st, 'color', title);
    el.setAttribute('style', st.endsWith(';') ? st : `${st};`);
  });
  box.querySelectorAll('p,li,span,div').forEach((node) => {
    const el = node as HTMLElement;
    if (el === box || el.hasAttribute('data-vb-hero-box')) return;
    if (/^(H1|H2|H3|H4)$/i.test(el.tagName)) return;
    let st = el.getAttribute('style') || '';
    const isPill = /border-radius\s*:\s*999px/i.test(st) || /text-transform\s*:\s*uppercase/i.test(st);
    st = setInlineStyleValue(st, 'color', isPill ? pillFg : body);
    if (isPill) st = setInlineStyleValue(st, 'background', pillBg);
    el.setAttribute('style', st.endsWith(';') ? st : `${st};`);
  });
  return next;
}

export type StripCardChromeOptions = {
  /** true = sundej i border/radius/bílé pozadí (po sloučení). false = jen stín/filter (při normalizaci). */
  full?: boolean;
};

/**
 * Po sloučení do karty sundá „kartový chrome“ z bloku (AI často nechá box-shadow + border),
 * jinak vypadá jako karta v kartě. Panel stín jde zapnout znovu (`data-vb-has-shadow`).
 */
export function stripSectionCardChromeFromBlock(el: HTMLElement, opts?: StripCardChromeOptions) {
  const full = opts?.full !== false;
  const scrub = (node: HTMLElement) => {
    // Manuálně zapnutý stín z panelu — nesahej na box-shadow.
    if (node.getAttribute('data-vb-has-shadow') === '1') {
      if (!full) return;
      let style = node.getAttribute('style') || '';
      if (!style.trim()) return;
      style = setInlineStyleValue(style, 'border', '');
      style = setInlineStyleValue(style, 'border-width', '');
      style = setInlineStyleValue(style, 'border-style', '');
      style = setInlineStyleValue(style, 'border-color', '');
      style = setInlineStyleValue(style, 'border-top', '');
      style = setInlineStyleValue(style, 'border-right', '');
      style = setInlineStyleValue(style, 'border-bottom', '');
      style = setInlineStyleValue(style, 'border-left', '');
      const cleaned = style.replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
      if (cleaned) node.setAttribute('style', cleaned.endsWith(';') ? cleaned : `${cleaned};`);
      else node.removeAttribute('style');
      return;
    }
    let style = node.getAttribute('style') || '';
    if (!style.trim()) {
      node.removeAttribute('data-vb-has-shadow');
      return;
    }
    const hadShadow = /box-shadow\s*:|filter\s*:/i.test(style);
    const hadBorder = /border(?:-(?:radius|width|style|color|top|right|bottom|left))?\s*:/i.test(style);
    const hadBg = /background(?:-color)?\s*:/i.test(style);
    if (!hadShadow && !(full && (hadBorder || hadBg))) return;

    style = setInlineStyleValue(style, 'box-shadow', '');
    style = setInlineStyleValue(style, 'filter', '');
    if (full) {
      style = setInlineStyleValue(style, 'border', '');
      style = setInlineStyleValue(style, 'border-width', '');
      style = setInlineStyleValue(style, 'border-style', '');
      style = setInlineStyleValue(style, 'border-color', '');
      style = setInlineStyleValue(style, 'border-top', '');
      style = setInlineStyleValue(style, 'border-right', '');
      style = setInlineStyleValue(style, 'border-bottom', '');
      style = setInlineStyleValue(style, 'border-left', '');
      style = setInlineStyleValue(style, 'border-radius', '');
      const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
      const bg = (bgMatch?.[1] || '').trim().toLowerCase().replace(/\s+/g, '');
      if (
        !bg ||
        bg === 'transparent' ||
        bg === 'rgba(0,0,0,0)' ||
        bg === '#fff' ||
        bg === '#ffffff' ||
        bg === 'white' ||
        bg === '#f8fafc' ||
        bg === '#f4f8fc' ||
        bg === '#fffbf7'
      ) {
        style = setInlineStyleValue(style, 'background', 'transparent');
        style = setInlineStyleValue(style, 'background-color', 'transparent');
      }
    }
    const cleaned = style.replace(/;+/g, ';').replace(/^;|;$/g, '').trim();
    if (cleaned) node.setAttribute('style', cleaned.endsWith(';') ? cleaned : `${cleaned};`);
    else node.removeAttribute('style');
    node.removeAttribute('data-vb-has-shadow');
  };

  scrub(el);
  // Highlight / webinář / collage mají vlastní vnitřní obsah — nesahej na něj.
  const blockType = el.getAttribute('data-vb-block') || '';
  if (blockType === 'webinar') {
    applyWebinarGroupInset(el);
    return;
  }
  if (blockType === 'highlight' || blockType === 'product-collage') {
    return;
  }
  // AI často balí stín/border do vnořených wrapperů — jen typické „karty“, ne CTA / img radius.
  el.querySelectorAll<HTMLElement>('[style]').forEach((node) => {
    if (node === el) return;
    if (node.closest('[data-email-webinar="true"], .vb-preview-cta, a.vb-webinar-cta, [data-vb-col-chooser]')) {
      return;
    }
    if (/^(IMG|SVG|BUTTON|A)$/i.test(node.tagName)) return;
    const cs = node.getAttribute('style') || '';
    const shadowLike = /box-shadow\s*:|filter\s*:/i.test(cs);
    const aiCardLike =
      /border\s*:/i.test(cs) &&
      /border-radius\s*:/i.test(cs) &&
      /background/i.test(cs) &&
      /#(?:fff|ffffff|f8fafc|f4f8fc|fffbf7)\b|white|rgba\(\s*255/i.test(cs);
    if (shadowLike || (full && aiCardLike)) scrub(node);
  });
}

/**
 * Chrome patří jen skupině. Vnitřní bloky vyčisti; attrs + inline style na section sjednoť.
 * Pokud měl vnitřní blok stín/border z AI/panelu, přenes na skupinu (jednou).
 */
export function stripCardChromeInsideSections(root: HTMLElement) {
  root.querySelectorAll('[data-vb-block="section"]').forEach((raw) => {
    const sec = raw as HTMLElement;
    let promoteShadow = false;
    let promoteBg = '';

    for (const unit of sectionUnits(sec)) {
      const style = unit.getAttribute('style') || '';
      // Jen explicitní panelový stín — AI card border/shadow na skupinu nepřenášej (výchozí je bez ohraničení).
      if (
        unit.getAttribute('data-vb-has-shadow') === '1' ||
        /box-shadow\s*:\s*0\s+6px\s+18px/i.test(style)
      ) {
        promoteShadow = true;
      }
      const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
      const bg = (bgMatch?.[1] || '').trim();
      const bgNorm = bg.toLowerCase().replace(/\s+/g, '');
      if (
        bg &&
        bgNorm !== 'transparent' &&
        bgNorm !== 'rgba(0,0,0,0)' &&
        bgNorm !== '#fff' &&
        bgNorm !== '#ffffff' &&
        bgNorm !== 'white' &&
        !promoteBg
      ) {
        promoteBg = bg;
      }
      stripSectionCardChromeFromBlock(unit, { full: true });
      unit.removeAttribute('data-vb-has-shadow');
      if (unit.getAttribute('data-vb-block') === 'highlight') {
        applyHighlightChrome(unit);
      }
      if (unit.getAttribute('data-vb-block') === 'webinar') {
        applyWebinarGroupInset(unit);
      }
    }

    if (!sec.hasAttribute('data-vb-chrome-border')) {
      sec.setAttribute('data-vb-chrome-border', '0');
    }
    if (!sec.hasAttribute('data-vb-chrome-shadow')) {
      sec.setAttribute('data-vb-chrome-shadow', promoteShadow ? '1' : '0');
    } else if (promoteShadow && sec.getAttribute('data-vb-chrome-shadow') !== '1') {
      sec.setAttribute('data-vb-chrome-shadow', '1');
    }
    if (promoteBg && !sec.getAttribute('data-vb-chrome-bg')) {
      sec.setAttribute('data-vb-chrome-bg', promoteBg);
    }
    applySectionChrome(sec);
  });
}

function sectionFillOf(sec: HTMLElement): EmailSectionFill {
  return sec.getAttribute('data-vb-section-fill') === 'plain' ? 'plain' : 'card';
}

/** Bloky přímo ve skupině — jen tyto tvoří „řádky“ jedné karty. */
function sectionUnits(sec: HTMLElement): HTMLElement[] {
  return [...sec.children].filter(isConcreteBlockEl);
}

function removeSectionIfEmpty(sec: HTMLElement | null) {
  if (!sec || !sec.isConnected) return;
  if (sectionUnits(sec).length === 0) sec.remove();
}

/**
 * Skupina = přímý potomek kořene. Jen ta se v náhledu vykresluje jako karta,
 * takže „spojení“ je vždy otázka řádků kořene — nezáleží na tom, co je uvnitř.
 * Pro jakýkoli uzel v kořeni tohle nikdy nevrátí null.
 */
export function getEmailGroupRow(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  if (!el || el === root || !root.contains(el)) return null;
  let n: HTMLElement | null = el;
  while (n && n.parentElement && n.parentElement !== root) n = n.parentElement;
  if (!n || n.parentElement !== root) return null;
  return isConcreteBlockEl(n) ? n : null;
}

/** Položka skupiny = přímý potomek skupiny obsahující vybraný uzel (řeší obaly z importu / AI). */
export function getEmailGroupItem(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  const row = getEmailGroupRow(el, root);
  if (!row || el === row) return null;
  let n: HTMLElement | null = el;
  while (n && n.parentElement && n.parentElement !== row) n = n.parentElement;
  if (!n || n.parentElement !== row) return null;
  return isConcreteBlockEl(n) ? n : null;
}

/** Ze řádku udělá skupinu (`section`), pokud jí ještě není — jinak by se nevykreslila jako karta. */
export function ensureRowIsSection(row: HTMLElement, doc: Document): HTMLElement {
  if (isSectionLike(row)) {
    row.setAttribute('data-vb-block', 'section');
    if (!row.getAttribute('data-vb-section-fill')) {
      row.setAttribute('data-vb-section-fill', 'card');
    }
    return row;
  }
  const wrap = createSectionEl(doc, 'card');
  row.insertAdjacentElement('beforebegin', wrap);
  wrap.appendChild(row);
  return wrap;
}

export interface EmailBlockGroupState {
  /** V kartě je víc bloků — jde z ní blok vyjmout. */
  canIsolate: boolean;
  fill: EmailSectionFill | null;
  /** Vybraná je celá skupina, ne blok v ní. */
  isWholeGroup: boolean;
  /** Chrome hostující skupiny (null = žádná skupina). */
  chrome: EmailSectionChrome | null;
}

export type EmailGroupMutationResult =
  | { ok: true; keepBlockId: string | null; noop?: boolean }
  | { ok: false; reason: string };

const EMPTY_EMAIL_GROUP_STATE: EmailBlockGroupState = {
  canIsolate: false,
  fill: null,
  isWholeGroup: false,
  chrome: null,
};

/** Stav skupiny okolo vybraného bloku pro panel: jaké má pozadí a jde-li z ní blok vyjmout. */
export function readEmailBlockGroupState(
  block: HTMLElement | null,
  root: HTMLElement | null,
): EmailBlockGroupState {
  if (!block || !root || !root.contains(block)) return EMPTY_EMAIL_GROUP_STATE;

  const host = getHostSectionForBlock(block, root);
  const card = host || getEmailGroupRow(block, root);
  const unitsInCard = host ? sectionUnits(host) : [];
  const ownUnit = host ? unitsInCard.find((u) => u === block || u.contains(block)) || null : null;
  const chromeHost = host || (card && isSectionLike(card) ? card : null);

  return {
    canIsolate: !!ownUnit && unitsInCard.length > 1,
    fill: card ? sectionFillOf(card) : null,
    isWholeGroup: !!host && host === block,
    chrome: chromeHost ? readSectionChrome(chromeHost) : null,
  };
}

export type EmailBlockColumnCount = 1 | 2 | 3;

/** Sloupcová tabulka bloku — buď z panelu (`data-vb-columns`), nebo z presetu columns-2/3. */
function columnsTableOf(block: HTMLElement): HTMLElement | null {
  const marked = [...block.children].find(
    (c) => c.nodeType === 1 && (c as HTMLElement).hasAttribute('data-vb-columns'),
  );
  if (marked) return marked as HTMLElement;
  const type = block.getAttribute('data-vb-block');
  if (type === 'columns-2' || type === 'columns-3') {
    const direct = [...block.children].find(
      (c) => c.nodeType === 1 && (c as HTMLElement).tagName === 'TABLE',
    );
    if (direct) return direct as HTMLElement;
    // Obaly z importu / AI — první tabulka uvnitř layoutu.
    return (block.querySelector('table') as HTMLElement | null) || null;
  }
  return null;
}

function columnCellsOf(table: HTMLElement): HTMLElement[] {
  const direct = [
    ...table.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td'),
  ] as HTMLElement[];
  if (direct.length > 0) return direct;
  return [...table.querySelectorAll('td')] as HTMLElement[];
}

function isColumnPlaceholder(el: Element): boolean {
  return el.hasAttribute('data-vb-col-placeholder') || el.hasAttribute('data-vb-col-chooser');
}

function cellPadStyle(index: number, count: 2 | 3): string {
  if (count === 2) return index === 0 ? 'padding:0 8px 0 0;' : 'padding:0 0 0 8px;';
  if (index === 0) return 'padding:0 8px 0 0;';
  if (index === count - 1) return 'padding:0 0 0 8px;';
  return 'padding:0 4px;';
}

export function readEmailBlockColumns(block: HTMLElement | null): EmailBlockColumnCount {
  if (!block) return 1;
  const type = block.getAttribute('data-vb-block');
  if (type === 'columns-2') return 2;
  if (type === 'columns-3') return 3;
  const table = columnsTableOf(block);
  if (!table) return 1;
  const raw = Number.parseInt(table.getAttribute('data-vb-columns') || '0', 10);
  if (raw === 2 || raw === 3) return raw;
  const cols = table.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td').length;
  return cols >= 3 ? 3 : cols >= 2 ? 2 : 1;
}

/**
 * Přepne blok na layout 1/2/3 sloupců — stejně jako knihovní „2 sloupce“ / „3 sloupce“.
 * Stávající obsah zůstane v prvním sloupci; do dalších se vloží prázdné karty k doplnění.
 */
export function setEmailBlockColumns(
  block: HTMLElement,
  count: EmailBlockColumnCount,
  doc?: Document,
): EmailGroupMutationResult {
  const ownerDoc = doc || block.ownerDocument;
  if (!ownerDoc) return { ok: false, reason: 'Náhled není připravený.' };
  const keepId = block.getAttribute('data-vb-block-id') || null;

  if (readEmailBlockColumns(block) === count) return { ok: true, keepBlockId: keepId, noop: true };

  const existing = columnsTableOf(block);
  // Obsah po sloupcích — při přepínání 2↔3 se buňky zachovají; výplně filtrujeme jen při sloučení na 1.
  const columnsContent: Element[][] = existing
    ? [...existing.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td')].map((cell) => [
        ...cell.children,
      ])
    : [[...block.children].filter(isConcreteBlockEl)];

  existing?.remove();
  for (const col of columnsContent) for (const node of col) node.remove();
  while (block.firstChild) block.removeChild(block.firstChild);

  if (count === 1) {
    // Pod sebe jen skutečný obsah — jednotky sloupců rozbalíme, výplně zahodíme.
    for (const col of columnsContent) {
      for (const node of col) {
        if (isColumnPlaceholder(node)) continue;
        if (isEmailColumnUnit(node as HTMLElement)) {
          while (node.firstChild) block.appendChild(node.firstChild);
        } else {
          block.appendChild(node);
        }
      }
    }
    if (!block.firstElementChild) {
      block.innerHTML =
        '<p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">Sem vložte hlavní sdělení e-mailu.</p>';
    }
    block.setAttribute('data-vb-block', 'text');
    return { ok: true, keepBlockId: keepId };
  }

  const table = ownerDoc.createElement('table');
  table.setAttribute('data-vb-columns', String(count));
  table.setAttribute('role', 'presentation');
  table.setAttribute('width', '100%');
  table.setAttribute('cellpadding', '0');
  table.setAttribute('cellspacing', '0');
  table.setAttribute('border', '0');
  table.setAttribute('style', 'border-collapse:collapse;width:100%;');
  const row = ownerDoc.createElement('tr');
  table.appendChild(row);

  const width = count === 2 ? '50%' : '33.33%';
  for (let i = 0; i < count; i++) {
    const cell = ownerDoc.createElement('td');
    cell.setAttribute('width', width);
    cell.setAttribute('valign', 'top');
    cell.setAttribute('style', `width:${width};vertical-align:top;${cellPadStyle(i, count)}`);

    // 1. sloupec = stávající obsah (jako jednotka); další = výběr typu.
    const kept = (columnsContent[i] || []).filter((n) => !isColumnPlaceholder(n));
    if (kept.length > 0) {
      cell.appendChild(wrapAsColumnUnit(kept, ownerDoc, 'text'));
    } else {
      cell.innerHTML = buildColumnPlaceholderHtml(i, count);
    }
    row.appendChild(cell);
  }

  // Obsah z případných zrušených sloupců (3→2) přesuneme do posledního ponechaného.
  if (columnsContent.length > count) {
    const lastCell = row.lastElementChild as HTMLElement | null;
    const extras: Element[] = [];
    for (let i = count; i < columnsContent.length; i++) {
      for (const node of columnsContent[i]) {
        if (!isColumnPlaceholder(node)) extras.push(node);
      }
    }
    if (extras.length && lastCell) {
      const existingUnit = lastCell.querySelector(':scope > [data-vb-col-unit]') as HTMLElement | null;
      if (existingUnit) {
        for (const node of extras) {
          if (isEmailColumnUnit(node as HTMLElement)) {
            while (node.firstChild) existingUnit.appendChild(node.firstChild);
          } else {
            existingUnit.appendChild(node);
          }
        }
      } else {
        lastCell.appendChild(wrapAsColumnUnit(extras, ownerDoc, 'text'));
      }
    }
  }

  block.appendChild(table);
  block.setAttribute('data-vb-block', count === 2 ? 'columns-2' : 'columns-3');
  return { ok: true, keepBlockId: keepId };
}

/**
 * Posune blok o jeden krok nahoru/dolů.
 * Uvnitř karty se prohodí se sousedem; na kraji karty z ní vystoupí (a `ensureRootOnlySections`
 * mu pak dá vlastní kartu), takže tlačítko nikdy „mlčky nic neudělá“.
 */
export function moveEmailBlockNode(
  block: HTMLElement,
  root: HTMLElement,
  direction: 'up' | 'down',
): EmailGroupMutationResult {
  if (!block || !root?.contains(block)) return { ok: false, reason: 'Blok v náhledu nebyl nalezen.' };

  const unit = resolveMovableUnit(block, root);
  if (!unit) return { ok: false, reason: 'Tenhle blok se přesouvat nedá.' };
  const keepId =
    unit.getAttribute('data-vb-block-id') || block.getAttribute('data-vb-block-id') || null;

  const parent = unit.parentElement as HTMLElement | null;
  if (!parent) return { ok: false, reason: 'Blok v náhledu nebyl nalezen.' };

  const sibs = [...parent.children].filter(isConcreteBlockEl);
  const idx = sibs.indexOf(unit);
  const neighbor = idx < 0 ? null : sibs[direction === 'up' ? idx - 1 : idx + 1];

  if (neighbor) {
    if (direction === 'up') parent.insertBefore(unit, neighbor);
    else parent.insertBefore(neighbor, unit);
    return { ok: true, keepBlockId: keepId };
  }

  // Kraj karty → blok z karty vystoupí a stane se samostatným.
  if (isSectionLike(parent) && root.contains(parent) && parent !== root) {
    unit.remove();
    if (direction === 'up') parent.insertAdjacentElement('beforebegin', unit);
    else parent.insertAdjacentElement('afterend', unit);
    removeSectionIfEmpty(parent);
    return { ok: true, keepBlockId: keepId };
  }

  return {
    ok: false,
    reason:
      direction === 'up'
        ? 'Blok už je v mailu první.'
        : 'Blok už je v mailu poslední.',
  };
}

/**
 * Přesune blok těsně nad zvolený cílový blok.
 * Při přesunu mezi skupinami přejde do cílové skupiny a prázdný původní obal se uklidí.
 */
export function moveEmailBlockBeforeTarget(
  block: HTMLElement,
  target: HTMLElement,
  root: HTMLElement,
): EmailGroupMutationResult {
  if (!block || !target || !root?.contains(block) || !root.contains(target)) {
    return { ok: false, reason: 'Blok v náhledu nebyl nalezen.' };
  }

  const unit = resolveMovableUnit(block, root);
  const targetUnit = resolveMovableUnit(target, root);
  if (!unit || !targetUnit) return { ok: false, reason: 'Tenhle blok se přesouvat nedá.' };
  if (unit === targetUnit || unit.contains(targetUnit)) {
    return {
      ok: true,
      keepBlockId: block.getAttribute('data-vb-block-id') || unit.getAttribute('data-vb-block-id'),
      noop: true,
    };
  }

  const oldParent = unit.parentElement as HTMLElement | null;
  const keepBlockId =
    block.getAttribute('data-vb-block-id') || unit.getAttribute('data-vb-block-id') || null;

  try {
    if (isSectionLike(unit) && !isSectionLike(targetUnit)) {
      const targetSection = getHostSectionForBlock(targetUnit, root);
      if (!targetSection || targetSection.parentElement !== root) {
        return { ok: false, reason: 'Cílovou pozici se nepodařilo najít.' };
      }
      root.insertBefore(unit, targetSection);
    } else if (isSectionLike(targetUnit)) {
      if (isSectionLike(unit)) {
        root.insertBefore(unit, targetUnit);
      } else {
        const first = sectionUnits(targetUnit)[0] || null;
        targetUnit.insertBefore(unit, first);
      }
    } else {
      const targetParent = targetUnit.parentElement as HTMLElement | null;
      if (!targetParent) return { ok: false, reason: 'Cílovou pozici se nepodařilo najít.' };
      targetParent.insertBefore(unit, targetUnit);
    }
  } catch {
    return { ok: false, reason: 'Blok se nepodařilo přesunout.' };
  }

  if (oldParent && oldParent !== unit.parentElement && isSectionLike(oldParent)) {
    removeSectionIfEmpty(oldParent);
  }
  return { ok: true, keepBlockId };
}

/** Přesouvá se buď celá karta, nebo přímý potomek karty — ne obaly mezi nimi. */
function resolveMovableUnit(block: HTMLElement, root: HTMLElement): HTMLElement | null {
  if (isSectionLike(block) && block.parentElement === root) return block;
  const host = getHostSectionForBlock(block, root);
  if (host && host !== block) {
    return sectionUnits(host).find((u) => u === block || u.contains(block)) || null;
  }
  const row = getEmailGroupRow(block, root);
  return row || (block.parentElement ? block : null);
}

/**
 * Jednotka ke sloučení: přímý potomek hostující `section`, jinak samotný obsahový blok.
 * Sekce a holé layoutové obaly se nepřesouvají — laso/výběr cílí na obsahové bloky.
 */
function resolveGroupableUnit(block: HTMLElement, root: HTMLElement): HTMLElement | null {
  if (!block || !root.contains(block)) return null;
  if (isSectionLike(block)) return null;
  const host = getHostSectionForBlock(block, root);
  if (host) {
    return sectionUnits(host).find((u) => u === block || u.contains(block)) || null;
  }
  if (block.hasAttribute('data-vb-block-id')) return block;
  const row = getEmailGroupRow(block, root);
  if (row && !isSectionLike(row) && row.hasAttribute('data-vb-block-id')) return row;
  return null;
}

/**
 * Sloučí vybrané bloky do jedné karty (`section` + card fill) v pořadí dokumentu.
 * Nezávisí na tom, jestli byly sousední — přesune jejich jednotky do nové skupiny.
 */
export function groupEmailBlocksIntoSection(
  blockIds: string[],
  root: HTMLElement,
  doc?: Document,
): EmailGroupMutationResult {
  const ownerDoc = doc || root.ownerDocument;
  if (!ownerDoc) return { ok: false, reason: 'Náhled není připravený.' };
  if (!root) return { ok: false, reason: 'Kořen mailu nebyl nalezen.' };

  const seen = new Set<HTMLElement>();
  const units: HTMLElement[] = [];
  for (const id of blockIds) {
    const el = findEmailBlockById(root, id);
    if (!el) continue;
    const unit = resolveGroupableUnit(el, root);
    if (!unit || seen.has(unit)) continue;
    seen.add(unit);
    units.push(unit);
  }

  const order = [...root.querySelectorAll('[data-vb-block-id]')] as HTMLElement[];
  units.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  if (units.length < 2) {
    return { ok: false, reason: 'Vyber aspoň dva bloky ke sloučení do skupiny.' };
  }

  const keepId = units[0].getAttribute('data-vb-block-id');
  const hosts = units.map((u) => getHostSectionForBlock(u, root));
  const sameHost = hosts[0] && hosts.every((h) => h === hosts[0]);
  if (sameHost && hosts[0] && sectionUnits(hosts[0]).length === units.length) {
    // Už jedna skupina — chrome na skupinu, vnitřek čistý.
    stripCardChromeInsideSections(root);
    applySectionChrome(hosts[0], { fill: 'card' });
    return { ok: true, keepBlockId: keepId, noop: true };
  }

  const firstHost = getHostSectionForBlock(units[0], root);
  const anchor = firstHost || units[0];
  const wrap = createSectionEl(ownerDoc, 'card');
  anchor.insertAdjacentElement('beforebegin', wrap);

  for (const unit of units) {
    const oldHost = getHostSectionForBlock(unit, root);
    stripSectionCardChromeFromBlock(unit, { full: true });
    wrap.appendChild(unit);
    if (oldHost && oldHost !== wrap) removeSectionIfEmpty(oldHost);
  }
  for (const unit of sectionUnits(wrap)) {
    stripSectionCardChromeFromBlock(unit, { full: true });
    if (unit.getAttribute('data-vb-block') === 'webinar') applyWebinarGroupInset(unit);
    if (unit.getAttribute('data-vb-block') === 'highlight') applyHighlightChrome(unit);
  }
  applySectionChrome(wrap, { fill: 'card', border: false, shadow: false });

  return { ok: true, keepBlockId: keepId };
}

/** Blok dostane vlastní kartu. Když je vybraná celá karta, rozpadne se na samostatné karty. */
export function isolateEmailBlockGroup(
  block: HTMLElement,
  root: HTMLElement,
  doc?: Document,
): EmailGroupMutationResult {
  const ownerDoc = doc || block.ownerDocument;
  if (!ownerDoc) return { ok: false, reason: 'Náhled není připravený.' };
  if (!root.contains(block)) return { ok: false, reason: 'Blok v náhledu nebyl nalezen.' };

  const keepId =
    block.getAttribute('data-vb-block-id') ||
    (block.closest('[data-vb-block-id]') as HTMLElement | null)?.getAttribute('data-vb-block-id') ||
    null;

  const host = getHostSectionForBlock(block, root);
  if (!host) return { ok: true, keepBlockId: keepId, noop: true };
  const units = sectionUnits(host);
  if (units.length <= 1) return { ok: true, keepBlockId: keepId, noop: true };
  const fill = sectionFillOf(host);

  // Vybraná je celá karta → každý blok v ní dostane vlastní.
  if (host === block) {
    let anchor: HTMLElement = host;
    units.slice(1).forEach((unit) => {
      const own = createSectionEl(ownerDoc, fill);
      anchor.insertAdjacentElement('afterend', own);
      own.appendChild(unit);
      anchor = own;
    });
    return { ok: true, keepBlockId: keepId };
  }

  const item = units.find((u) => u === block || u.contains(block)) || null;
  if (!item) return { ok: true, keepBlockId: keepId, noop: true };

  const after = units.slice(units.indexOf(item) + 1);
  const own = createSectionEl(ownerDoc, fill);
  host.insertAdjacentElement('afterend', own);
  own.appendChild(item);
  if (after.length > 0) {
    const tail = createSectionEl(ownerDoc, fill);
    own.insertAdjacentElement('afterend', tail);
    after.forEach((u) => tail.appendChild(u));
  }
  removeSectionIfEmpty(host);
  return { ok: true, keepBlockId: keepId };
}
