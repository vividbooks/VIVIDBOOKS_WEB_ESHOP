/**
 * Dvouagentní skládání e-mailu: copywriter píše označený text,
 * layout agent ho roztřídí, kód složí HTML bloky editoru.
 * Žádné obří bodyHtml v JSON — proto se to neosekává.
 */

import { EMAIL_BUILDER_HEADING_STYLES } from './emailBuilderAiHydrate.ts';

export type OutlineBlockType =
  | 'section'
  | 'heading'
  | 'paragraph'
  | 'highlight'
  | 'webinar'
  | 'button'
  | 'image'
  | 'products'
  | 'divider'
  | 'hero'
  | 'gap';

export type OutlineBlock = {
  type: OutlineBlockType;
  id?: string;
  text?: string;
  heading?: string;
  level?: 1 | 2 | 3;
  color?: string;
  fill?: 'card' | 'plain';
  slug?: string;
  layout?: 'hero' | 'compact' | 'pill';
  href?: string;
  src?: string;
  alt?: string;
  productIds?: string[];
  items?: OutlineBlock[];
};

const COLOR_MAP: Record<string, string> = {
  žlut: '#FEF3C7',
  zlut: '#FEF3C7',
  yellow: '#FEF3C7',
  fial: '#F3F0FF',
  purple: '#F3F0FF',
  orange: '#FFF7ED',
  oranž: '#FFF7ED',
  oranz: '#FFF7ED',
  modr: '#EFF6FF',
  blue: '#EFF6FF',
  zelen: '#ECFDF5',
  green: '#ECFDF5',
  bílá: '#ffffff',
  bila: '#ffffff',
  white: '#ffffff',
  tmav: '#001161',
  dark: '#001161',
};

export function mapOutlineColor(raw: string): string {
  const s = String(raw || '').toLowerCase();
  const hex = s.match(/#([0-9a-f]{3,8})/i);
  if (hex) return `#${hex[1]}`;
  for (const [k, v] of Object.entries(COLOR_MAP)) {
    if (s.includes(k)) return v;
  }
  return '';
}

function randomBlockId(): string {
  return `vb-block-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const OUTLINE_LABEL_SPLIT =
  /(?=(?:NADPIS(?:\s+h[1-3])?|ODSTAVEC|ZVYRAZN[ĚE]N[ÍI](?:\s+[^\s:]{1,20})?|WEBIN[ÁA][ŘR]|TLA[ČC][ÍI]TKO|OBR[ÁA]ZEK|PRODUKTY|HERO|ODD[ĚE]LOVA[ČC])(?:\s+id\s*=\s*vb-block-[\w-]+)?\s*:)/i;

/** Model často napíše doslovné `\\n` místo zalomení. */
export function unescapeOutlineEscapes(raw: string): string {
  return String(raw || '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"');
}

/** Vyhodí značky outline z čtenářského textu (když je model napíše dovnitř věty). */
export function stripOutlineMarkersFromText(raw: string): string {
  return unescapeOutlineEscapes(raw)
    .replace(
      /\b(?:NADPIS(?:\s+h[1-3])?|ODSTAVEC|ZVYRAZN[ĚE]N[ÍI]|WEBIN[ÁA][ŘR]|TLA[ČC][ÍI]TKO|OBR[ÁA]ZEK|PRODUKTY|ODD[ĚE]LOVA[ČC]|HERO|SKUPINA)\s*:/gi,
      ' ',
    )
    .replace(/\bid\s*=\s*vb-block-[\w-]+/gi, ' ')
    .replace(/[ \t]*\|[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

function takeId(raw: string): { id?: string; rest: string } {
  let rest = String(raw || '');
  let id: string | undefined;
  rest = rest.replace(/\bid\s*=\s*(vb-block-[\w-]+)/gi, (_, found: string) => {
    if (!id) id = found;
    return ' ';
  });
  rest = rest.replace(/\s{2,}/g, ' ').trim();
  return id ? { id, rest } : { rest };
}

function expandOutlineLine(line: string): string[] {
  const trimmed = String(line || '').trim();
  if (!trimmed || /^={2,}/.test(trimmed)) return [trimmed];
  const parts = trimmed
    .split(OUTLINE_LABEL_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [trimmed];
}

function takeMeta(raw: string): { rest: string; slug?: string; layout?: OutlineBlock['layout']; href?: string } {
  let rest = String(raw || '');
  const slug = rest.match(/\bslug\s*=\s*([^\s|]+)/i)?.[1];
  const layoutRaw = rest.match(/\blayout\s*=\s*(hero|compact|pill)/i)?.[1];
  const href = rest.match(/\b(?:href|url)\s*=\s*(\S+)/i)?.[1];
  rest = rest
    .replace(/\b(?:slug|layout|href|url)\s*=\s*\S+/gi, '')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const layout = layoutRaw === 'hero' || layoutRaw === 'pill' || layoutRaw === 'compact' ? layoutRaw : undefined;
  return { rest, slug, layout, href };
}

export function classifyOutlineLabel(label: string): OutlineBlockType | 'section' | null {
  const l = String(label || '').toLowerCase().trim();
  if (!l) return null;
  if (/skupin|sekc|karta|section/.test(l)) return 'section';
  if (/webin|dvpp/.test(l)) return 'webinar';
  if (/tlačít|tlacit|button|cta|pill/.test(l)) return 'button';
  if (/obráz|obraz|img|foto|image/.test(l)) return 'image';
  if (/produk|koláž|kolaz|collage/.test(l)) return 'products';
  if (/odděl|oddel|divider|čára|cara/.test(l)) return 'divider';
  if (/mezera|gap|flow/.test(l)) return 'gap';
  if (/hero|banner|úvodní|uvodni/.test(l)) return 'hero';
  if (/zvýraz|zvraz|box|rámeč|ramec|žlut|zlut|highlight/.test(l) && !/nadpis/.test(l)) return 'highlight';
  if (/nadpis|heading|titul|h[1-3]\b/.test(l)) return 'heading';
  if (/odstav|text|odst\.|paragraph|sdělen|sdelen/.test(l)) return 'paragraph';
  if (/blok/.test(l) && /nadpis/.test(l)) return 'heading';
  if (/blok/.test(l)) return 'highlight';
  return 'paragraph';
}

function splitLabelValue(line: string): { label: string; value: string } | null {
  const m = line.match(/^([^:]{1,80}):\s*([\s\S]*)$/);
  if (!m) return null;
  return { label: m[1].trim(), value: m[2].trim() };
}

/** Volný / přísný text bloků → strom. */
export function parseOutlineText(raw: string): OutlineBlock[] {
  const text = unescapeOutlineEscapes(String(raw || '')).replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const roots: OutlineBlock[] = [];
  let currentSection: OutlineBlock | null = null;

  const push = (block: OutlineBlock) => {
    if (currentSection) {
      currentSection.items = currentSection.items || [];
      currentSection.items.push(block);
    } else {
      roots.push(block);
    }
  };

  const lines = text.split('\n').flatMap(expandOutlineLine);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || /^meta\b/i.test(line)) continue;
    if (/^(předmět|predmet|náhled|nahled|preview|headline|nadpis hero|cta)\s*:/i.test(line)) continue;

    const sectionBar = line.match(/^={2,}\s*(.+?)\s*={2,}$/);
    if (sectionBar || /^(===|---)\s*(skupin|sekc|karta)/i.test(line)) {
      const inner = (sectionBar?.[1] || line.replace(/[=-]/g, ' ')).trim();
      const { id, rest } = takeId(inner);
      currentSection = {
        type: 'section',
        id,
        fill: /plain|bez|průhled/i.test(rest) ? 'plain' : 'card',
        color: mapOutlineColor(rest) || undefined,
      };
      roots.push(currentSection);
      continue;
    }

    const pair = splitLabelValue(line);
    if (!pair) {
      const loose = stripOutlineMarkersFromText(line);
      if (loose.length >= 8) push({ type: 'paragraph', text: loose });
      continue;
    }

    const fromLabel = takeId(pair.label);
    const kind = classifyOutlineLabel(fromLabel.rest || pair.label);
    if (!kind) continue;
    const fromValue = takeId(pair.value);
    const id = fromValue.id || fromLabel.id;
    const meta = takeMeta(fromValue.rest);

    if (kind === 'section') {
      currentSection = {
        type: 'section',
        id,
        fill: /plain|bez/i.test(pair.label + meta.rest) ? 'plain' : 'card',
        color: mapOutlineColor(pair.label + ' ' + meta.rest) || undefined,
      };
      roots.push(currentSection);
      continue;
    }

    if (kind === 'heading') {
      const level: 1 | 2 | 3 = /h1|nadpis\s*1/i.test(pair.label) ? 1 : /h3|nadpis\s*3/i.test(pair.label) ? 3 : 2;
      push({
        type: 'heading',
        id,
        text: stripOutlineMarkersFromText(meta.rest),
        level,
        color: mapOutlineColor(pair.label) || undefined,
      });
      continue;
    }
    if (kind === 'highlight') {
      push({
        type: 'highlight',
        id,
        text: stripOutlineMarkersFromText(meta.rest),
        heading: /nadpis/i.test(pair.label) ? stripOutlineMarkersFromText(meta.rest) : undefined,
        color: mapOutlineColor(pair.label) || '#F3F0FF',
      });
      continue;
    }
    if (kind === 'webinar') {
      push({
        type: 'webinar',
        id,
        text: meta.rest,
        slug: meta.slug || meta.rest,
        layout: meta.layout || (/pozván|pozvan|hlavní|hlavni/i.test(pair.label + meta.rest) ? 'hero' : 'compact'),
      });
      continue;
    }
    if (kind === 'button') {
      const [label, url] = meta.rest.split(/\s*\|\s*/);
      push({
        type: 'button',
        id,
        text: (label || meta.rest).trim(),
        href: meta.href || url || '',
      });
      continue;
    }
    if (kind === 'image') {
      const [src, ...altParts] = meta.rest.split(/\s*\|\s*/);
      push({ type: 'image', id, src: src || meta.rest, alt: altParts.join(' | ') });
      continue;
    }
    if (kind === 'products') {
      const ids = meta.rest
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      push({ type: 'products', id, productIds: ids, text: meta.rest });
      continue;
    }
    if (kind === 'divider') {
      push({ type: 'divider', id });
      continue;
    }
    if (kind === 'gap') {
      push({ type: 'gap', id, text: meta.rest });
      continue;
    }
    if (kind === 'hero') {
      push({ type: 'hero', id, text: meta.rest });
      continue;
    }
    push({
      type: 'paragraph',
      id,
      text: stripOutlineMarkersFromText(meta.rest || pair.value),
    });
  }

  return roots;
}

export function outlineParseQuality(blocks: OutlineBlock[], raw: string): number {
  const lines = String(raw || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(předmět|predmet|náhled|cta|===)/i.test(l));
  const count = countOutlineBlocks(blocks);
  if (!count) return 0;
  if (!lines.length) return 1;
  return Math.min(1, count / Math.max(1, lines.length));
}

export function countOutlineBlocks(blocks: OutlineBlock[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    if (b.items?.length) n += countOutlineBlocks(b.items);
  }
  return n;
}

function pStyle(): string {
  return 'margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.75;color:#333;';
}

function headingHtml(level: 1 | 2 | 3, text: string): string {
  const tag = `h${level}` as const;
  return `<${tag} style="${EMAIL_BUILDER_HEADING_STYLES[tag]}">${escapeHtml(text)}</${tag}>`;
}

function shell(type: string, inner: string, style: string, extra = '', id?: string): string {
  const bid = id || randomBlockId();
  return `<div data-vb-block="${type}" data-vb-block-id="${escapeHtml(bid)}"${extra} style="${style}">${inner}</div>`;
}

function compileOne(block: OutlineBlock): string {
  const id = block.id;
  switch (block.type) {
    case 'section': {
      const fill = block.fill === 'plain' ? 'plain' : 'card';
      const bg = block.color || (fill === 'card' ? '#ffffff' : 'transparent');
      const kids = (block.items || []).map(compileOne).join('');
      const inner = kids || shell('text', `<p style="${pStyle()}">${escapeHtml(block.text || '')}</p>`, 'padding:10px 24px;background:transparent;');
      if (fill === 'plain') {
        return `<div data-vb-block="section" data-vb-section-fill="plain" data-vb-chrome-border="0" data-vb-chrome-shadow="0" data-vb-chrome-radius="16" data-vb-block-id="${escapeHtml(id || randomBlockId())}" style="padding:0;background:transparent;border:none;box-shadow:none;border-radius:0;margin-bottom:32px;">${inner}</div>`;
      }
      return `<div data-vb-block="section" data-vb-section-fill="card" data-vb-chrome-border="0" data-vb-chrome-shadow="0" data-vb-chrome-radius="16" data-vb-block-id="${escapeHtml(id || randomBlockId())}" style="padding:0 0 28px 0;background:${escapeHtml(bg)};border:none;box-shadow:none;border-radius:16px;overflow:visible;box-sizing:border-box;margin-bottom:32px;">${inner}</div>`;
    }
    case 'heading':
      return shell(
        'text',
        headingHtml(block.level || 2, stripOutlineMarkersFromText(block.text || block.heading || '')),
        'padding:10px 24px;background:transparent;',
        '',
        id,
      );
    case 'paragraph': {
      const paras = String(block.text || '')
        .split(/\n+/)
        .map((p) => stripOutlineMarkersFromText(p))
        .filter(Boolean)
        .map((p) => `<p style="${pStyle()}">${escapeHtml(p)}</p>`)
        .join('');
      return shell('text', paras || `<p style="${pStyle()}"></p>`, 'padding:10px 24px;background:transparent;', '', id);
    }
    case 'highlight': {
      const bg = block.color || '#F3F0FF';
      const title = block.heading
        ? headingHtml(3, block.heading)
        : '';
      const body = block.text && block.text !== block.heading
        ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.65;color:#334155;">${escapeHtml(stripOutlineMarkersFromText(block.text))}</p>`
        : '';
      return shell(
        'highlight',
        `<div data-vb-highlight-box="1" style="background:${escapeHtml(bg)};border:1px solid rgba(0,17,97,0.10);border-radius:18px;padding:18px 22px 16px 22px;width:100%;box-sizing:border-box;">${title}${body}</div>`,
        'padding:0;background:transparent;',
        ` data-vb-chrome-bg="${escapeHtml(bg)}" data-vb-chrome-border="1" data-vb-chrome-shadow="0" data-vb-chrome-radius="18" data-vb-highlight-bleed="1"`,
        id,
      );
    }
    case 'webinar': {
      const slug = String(block.slug || block.text || '').trim();
      const layout = block.layout || 'compact';
      return `<div data-vb-block="webinar" data-vb-block-id="${escapeHtml(id || randomBlockId())}" data-ai-webinar-slug="${escapeHtml(slug)}" data-ai-webinar-layout="${layout}" style="padding:0;background:transparent;"></div>`;
    }
    case 'button': {
      const href = block.href || '#';
      const label = block.text || 'Více';
      return shell(
        'button',
        `<div style="text-align:center;"><a class="vb-preview-cta" href="${escapeHtml(href)}" style="display:inline-block;background-color:#F06632;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:999px;text-decoration:none;">${escapeHtml(label)}</a></div>`,
        'padding:16px 24px 28px 24px;background:transparent;',
        '',
        id,
      );
    }
    case 'image':
      return shell(
        'image',
        `<img src="${escapeHtml(block.src || '')}" alt="${escapeHtml(block.alt || '')}" style="display:block;width:100%;max-width:100%;height:auto;border-radius:16px;" />`,
        'padding:18px 22px;background:transparent;',
        '',
        id,
      );
    case 'products': {
      const ids = (block.productIds || []).join(',');
      return `<div data-vb-block="product-collage" data-vb-block-id="${escapeHtml(id || randomBlockId())}" data-ai-product-ids="${escapeHtml(ids)}" data-ai-pc-layout="grid" data-product-collage="true" style="padding:0;background:transparent;"></div>`;
    }
    case 'divider':
      return shell(
        'divider',
        '<div style="height:1px;background:#dbe2ea;width:100%;font-size:0;line-height:0;">&nbsp;</div>',
        'padding:10px 22px;background:transparent;',
        '',
        id,
      );
    case 'gap':
      return shell(
        'gap-content',
        `<p style="margin:0;text-align:center;font-size:14px;line-height:1.55;color:rgba(0,17,97,0.78);">${escapeHtml(block.text || '')}</p>`,
        'padding:12px 22px;background:transparent;',
        '',
        id,
      );
    case 'hero':
      return shell(
        'hero',
        `<div style="background:#001161;border-radius:22px;padding:28px 22px;text-align:center;"><h2 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-weight:800;">${escapeHtml(block.text || '')}</h2></div>`,
        'padding:18px 22px;background:transparent;',
        '',
        id,
      );
    default:
      return '';
  }
}

const MOBILE_STYLE =
  '<style type="text/css">@media only screen and (max-width:600px){.vb-email-root p,.vb-email-root li{font-size:15px!important;line-height:1.65!important}.vb-email-root h1{font-size:26px!important}.vb-email-root h2{font-size:22px!important}.vb-email-root h3{font-size:19px!important}.vb-email-root a[style*="background-color:#F06632"],.vb-email-root a[style*="background-color:#7C3AED"]{font-size:15px!important;padding:16px 28px!important;display:inline-block!important}.vb-prod-img,.vb-prod-txt,.vb-web-split-img,.vb-web-split-txt,.vb-inf-col{display:block!important;width:100%!important}}</style>';

/** Složí HTML bloky editoru. Loose top-level text zabalí do karty. */
export function compileOutlineToHtml(blocks: OutlineBlock[], opts?: { fragment?: boolean }): string {
  const list = blocks.length ? blocks : [];
  const wrapped: OutlineBlock[] = [];
  let pending: OutlineBlock[] = [];
  const flushPending = () => {
    if (!pending.length) return;
    wrapped.push({ type: 'section', fill: 'card', items: pending });
    pending = [];
  };
  for (const b of list) {
    if (b.type === 'section') {
      flushPending();
      wrapped.push(b);
    } else {
      pending.push(b);
    }
  }
  flushPending();

  const inner = wrapped.map(compileOne).join('');
  if (opts?.fragment) return inner;
  return `${MOBILE_STYLE}<div class="vb-email-root" style="width:600px;max-width:100%;margin-left:auto;margin-right:auto;">${inner}</div>`;
}

function flattenOutlineBlocks(blocks: OutlineBlock[]): OutlineBlock[] {
  const out: OutlineBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'section' && b.items?.length) out.push(...flattenOutlineBlocks(b.items));
    else if (b.type !== 'section') out.push(b);
  }
  return out;
}

/**
 * Úprava jednoho bloku v editoru: jeden [data-vb-block] se stejným id,
 * odstavce zůstanou <p> uvnitř — ne nová karta a ne štítky outline.
 */
export function compileOutlineToEditedBlockHtml(blocks: OutlineBlock[]): string {
  const flat = flattenOutlineBlocks(blocks);
  const textish = flat.filter((b) =>
    b.type === 'paragraph' || b.type === 'heading' || b.type === 'highlight' || b.type === 'gap',
  );
  if (textish.length && textish.length === flat.length) {
    const id = textish.find((b) => b.id)?.id;
    if (textish.length === 1 && textish[0].type === 'highlight') {
      return compileOne({ ...textish[0], id: id || textish[0].id });
    }
    const inner = textish
      .map((b) => {
        const t = stripOutlineMarkersFromText(b.text || b.heading || '');
        if (b.type === 'heading') return headingHtml(b.level || 2, t);
        return t
          .split(/\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => `<p style="${pStyle()}">${escapeHtml(p)}</p>`)
          .join('');
      })
      .join('');
    return shell('text', inner || `<p style="${pStyle()}"></p>`, 'padding:10px 24px;background:transparent;', '', id);
  }
  return compileOutlineToHtml(blocks, { fragment: true });
}

export const OUTLINE_FORMAT_SPEC = `Formát (jeden řádek = jeden kus, ŽÁDNÉ HTML):
=== SKUPINA karta ===
NADPIS: text nadpisu
ODSTAVEC: souvislý text
ZVYRAZNĚNÍ žlutá: důležité sdělení
WEBINÁŘ: název | slug=presny-slug | layout=hero
TLAČÍTKO: text tlačítka | https://vividbooks.com/...
OBRÁZEK: https://... | alt
PRODUKTY: id1, id2
ODDĚLOVAČ

Barvy skupiny/boxu: žlutá, fialová, oranžová, modrá, zelená.
id piš JEN vlevo u značky, NIKDY do věty: ODSTAVEC id=vb-block-xxxx: text
Do textu po dvojtečce NEPATŘÍ slova ODSTAVEC / NADPIS / id=.`;

export type OutlineComposeMeta = {
  subject: string;
  previewText: string;
  headline: string;
  ctaText: string;
  ctaUrl: string;
  outline: string;
};

function looksLikeOutlineText(s: string): boolean {
  return /(?:NADPIS|ODSTAVEC|ZVYRAZN|WEBIN[ÁA][ŘR]|TLA[ČC][ÍI]TKO|=== SKUPINA)\s*:/i.test(s);
}

function parseLooseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = String(text || '').replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const v = JSON.parse(cleaned);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* truncated / fence */
  }
  const m = cleaned.match(/"outline"\s*:\s*"((?:\\.|[^"\\])*)"?/);
  if (m) {
    try {
      return { outline: JSON.parse(`"${m[1]}"`) };
    } catch {
      return { outline: unescapeOutlineEscapes(m[1]) };
    }
  }
  return null;
}

/** Vytáhne outline i z useknutého JSON nebo z omylem vráceného bodyHtml. */
export function salvageOutlineText(raw: string, parsed?: Record<string, unknown> | null): string {
  const obj = parsed || parseLooseJsonObject(raw);
  if (obj) {
    const direct = unescapeOutlineEscapes(String(obj.outline || obj.contentBrief || '').trim());
    if (direct && looksLikeOutlineText(direct)) return direct;
    if (direct && !/<div[\s>]/i.test(direct) && direct.length > 8) return direct;
    const bh = unescapeOutlineEscapes(String(obj.bodyHtml || '').trim());
    if (bh && looksLikeOutlineText(bh) && !/<div[\s>]/i.test(bh)) return bh;
  }
  const un = unescapeOutlineEscapes(String(raw || ''));
  const idx = un.search(/(?:=== SKUPINA|NADPIS(?:\s+h[1-3])?|ODSTAVEC)\s*:/i);
  if (idx >= 0) {
    return un
      .slice(idx)
      .replace(/"\s*,\s*"[a-zA-Z]+"\s*:[\s\S]*$/, '')
      .replace(/"\s*\}\s*$/, '')
      .trim();
  }
  return '';
}

export function extractOutlineMeta(value: Record<string, unknown>): OutlineComposeMeta {
  return {
    subject: String(value.subject || '').trim(),
    previewText: String(value.previewText || '').trim(),
    headline: String(value.headline || '').trim(),
    ctaText: String(value.ctaText || '').trim(),
    ctaUrl: String(value.ctaUrl || '').trim(),
    outline: salvageOutlineText('', value),
  };
}

type GeminiJsonFn = (opts: {
  system: string;
  user: string;
  maxTokens: number;
  schema?: Record<string, unknown>;
}) => Promise<{ text: string; ok: boolean }>;

const COPYWRITER_SYS = `Jsi copywriter Vividbooks (pracovní sešity, tiskoviny, online podpora pro učitele ZŠ).
Nepiš HTML ani CSS. Vrať POUZE JSON s poli:
subject, previewText, headline, ctaText, ctaUrl, outline.
NIKDY nevracej pole bodyHtml — HTML skládá kód, ne ty.
V outline používej skutečné zalomení řádku, ne znaky \\n.

outline je prostý označený text bloků e-mailu — to, co čtenář uvidí, plus typ bloku.
${OUTLINE_FORMAT_SPEC}

Pravidla:
- Čeština, konkrétní fakta jen z přiložených dat (názvy, slugy, URL).
- headline = krátký titulek do tmavého hero šablony (neopakuj ho jako NADPIS v outline).
- Úvod = 2–4 ODSTAVEC řádky, pak další sekce.
- Webinář jen se slugem z dat. Produkty jen s id z katalogu.
- Při „Aktuální email jako textové bloky“ UPRAV ten text, nepřepisuj ho od nuly, pokud uživatel nechce nový mail.
- Režim jednoho bloku: vrať jen řádky toho bloku. id= jen u značky (ODSTAVEC id=vb-block-xxx:), nikdy uvnitř věty.`;

const LAYOUT_SYS = `Jsi layoutista e-mailu. Dostaneš volný popis bloků. Roztřiď ho do PŘESNÉHO formátu, nic si nevymýšlej.
Vrať JSON { "outline": "..." } kde outline používá JEN tyto značky:
=== SKUPINA karta === / === SKUPINA plain ===
NADPIS: / NADPIS h3:
ODSTAVEC:
ZVYRAZNĚNÍ žlutá: (nebo fialová/oranžová/modrá)
WEBINÁŘ: text | slug=xxx | layout=hero|compact|pill
TLAČÍTKO: text | url
OBRÁZEK: url | alt
PRODUKTY: id1, id2
ODDĚLOVAČ
HERO:

Zachovej id=vb-block-… JEN u značky vlevo. Žádné HTML. Žádné volné věty mimo značky.
NIKDY nepiš ODSTAVEC: ani id= do čtenářského textu za dvojtečkou.`;

export async function composeEmailViaOutlineAgents(opts: {
  callGeminiJson: GeminiJsonFn;
  prompt: string;
  conversationContext: string;
  currentOutline: string;
  contentBrief: string;
  dataCtx: string;
  fragmentOnly: boolean;
  editBlockOnly: boolean;
}): Promise<
  | {
      ok: true;
      meta: OutlineComposeMeta;
      bodyHtml: string;
      blocks: number;
      debug: Record<string, unknown>;
    }
  | { ok: false; error: string; raw?: string }
> {
  const debug: Record<string, unknown> = { path: 'outline-agents' };
  const user1 =
    (opts.contentBrief ? `OBSAHOVÝ BRIEF:\n${opts.contentBrief}\n\n` : '') +
    (opts.currentOutline
      ? `Aktuální email jako textové bloky:\n${opts.currentOutline}\n\n`
      : '') +
    (opts.conversationContext ? `Kontext:\n${opts.conversationContext.slice(0, 12_000)}\n\n` : '') +
    `Požadavek:\n${opts.prompt}\n` +
    (opts.editBlockOnly ? '\n[JEDEN BLOK] V outline vrať jen ten jeden blok, zachovej id=.\n' : '') +
    (opts.fragmentOnly ? '\n[FRAGMENT] V outline vrať jen nové bloky k vložení, bez existujících.\n' : '') +
    `\n---\nDATA (fakta, slugy, URL):\n${opts.dataCtx.slice(0, 40_000)}`;

  const copySchema = {
    type: 'OBJECT',
    properties: {
      subject: { type: 'STRING' },
      previewText: { type: 'STRING' },
      headline: { type: 'STRING' },
      ctaText: { type: 'STRING' },
      ctaUrl: { type: 'STRING' },
      outline: { type: 'STRING' },
    },
    required: ['subject', 'headline', 'outline'],
  };

  const copyRes = await opts.callGeminiJson({
    system: COPYWRITER_SYS,
    user: user1,
    maxTokens: 16_384,
    schema: copySchema,
  });
  if (!copyRes.ok || !copyRes.text.trim()) {
    return { ok: false, error: 'Copywriter agent nevrátil výstup' };
  }

  let meta = extractOutlineMeta({});
  const copyParsed = parseLooseJsonObject(copyRes.text);
  if (copyParsed) meta = extractOutlineMeta(copyParsed);
  if (!meta.outline.trim()) {
    meta.outline = salvageOutlineText(copyRes.text, copyParsed);
  }
  debug.copyOutlineChars = meta.outline.length;
  if (!meta.outline.trim()) {
    return { ok: false, error: 'Copywriter agent nevrátil outline', raw: copyRes.text.slice(0, 400) };
  }

  const skipLayout = opts.editBlockOnly || opts.fragmentOnly;
  if (skipLayout) debug.skippedLayout = true;

  const layoutRes = skipLayout
    ? { ok: false, text: '' }
    : await opts.callGeminiJson({
    system: LAYOUT_SYS,
    user: `Roztřiď tento popis do přesného formátu značek:\n\n${meta.outline}`,
    maxTokens: 12_288,
    schema: {
      type: 'OBJECT',
      properties: { outline: { type: 'STRING' } },
      required: ['outline'],
    },
  });

  let layoutOutline = meta.outline;
  if (layoutRes.ok && layoutRes.text.trim()) {
    try {
      const parsed = JSON.parse(layoutRes.text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim());
      if (typeof parsed?.outline === 'string' && parsed.outline.trim()) {
        layoutOutline = parsed.outline.trim();
        debug.layoutNormalized = true;
      }
    } catch {
      if (/NADPIS:|ODSTAVEC:|=== SKUPINA/i.test(layoutRes.text)) {
        layoutOutline = layoutRes.text.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
        debug.layoutNormalized = true;
      }
    }
  }

  let blocks = parseOutlineText(layoutOutline);
  let quality = outlineParseQuality(blocks, layoutOutline);
  if (quality < 0.35) {
    const fallback = parseOutlineText(meta.outline);
    if (outlineParseQuality(fallback, meta.outline) > quality) {
      blocks = fallback;
      layoutOutline = meta.outline;
      quality = outlineParseQuality(blocks, layoutOutline);
      debug.usedCopywriterOutline = true;
    }
  }
  debug.layoutQuality = Math.round(quality * 100);
  debug.blockCount = countOutlineBlocks(blocks);

  if (countOutlineBlocks(blocks) < 1) {
    return { ok: false, error: 'Layout agent neroztřídil žádné bloky', raw: layoutOutline.slice(0, 400) };
  }

  const bodyHtml = opts.editBlockOnly
    ? compileOutlineToEditedBlockHtml(blocks)
    : compileOutlineToHtml(blocks, { fragment: opts.fragmentOnly });
  meta.outline = layoutOutline;
  return { ok: true, meta, bodyHtml, blocks: countOutlineBlocks(blocks), debug };
}
