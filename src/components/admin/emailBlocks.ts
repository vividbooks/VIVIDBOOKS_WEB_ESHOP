import { buildProductCollageBlockHtml } from './emailProductCollage';
import { buildWebinarBlockHtml, EMPTY_EMAIL_WEBINAR_SNAPSHOT } from './emailWebinarBlock';
import { marketingUrl } from '../../config/marketingSite';

export type EmailBuilderMode = 'block' | 'html';

/** Výplň skupiny v náhledu: karta (bílá plocha) vs. obsah přímo na pozadí sloupce. */
export type EmailSectionFill = 'card' | 'plain';

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

const CTA_URL = marketingUrl('/vyzkousejte');

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

function buildBlockShell(type: EmailBlockType, innerHtml: string, style?: string): string {
  const inline = style ? ` style="${style}"` : '';
  return `<div data-vb-block="${type}" data-vb-block-id="${randomBlockId()}"${inline}>${innerHtml}</div>`;
}

export function wrapRootBlockInSection(innerBlockHtml: string, fill: EmailSectionFill = 'card'): string {
  const id = randomBlockId();
  return `<div data-vb-block="section" data-vb-section-fill="${fill}" data-vb-block-id="${id}" style="padding:0;background:transparent;">${innerBlockHtml}</div>`;
}

export function buildEmailSectionHtml(fill: EmailSectionFill = 'card'): string {
  return wrapRootBlockInSection(buildEmailBlockHtml('text'), fill);
}

export function buildEmailBlockHtml(type: EmailBlockType): string {
  switch (type) {
    case 'text':
      return buildBlockShell(
        'text',
        '<p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:#334155;">Sem vložte hlavní sdělení e-mailu. Pište stručně a srozumitelně.</p><p style="margin:0;font-size:16px;line-height:1.7;color:#334155;">Druhý odstavec můžete použít pro detail, benefit nebo přirozené navázání.</p>',
        'padding:18px 22px;background-color:transparent;',
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
        `<div style="text-align:center;"><a class="vb-preview-cta" href="${CTA_URL}" style="display:inline-block;background-color:#7C3AED;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:999px;text-decoration:none;">Vyzkoušet zdarma</a></div>`,
        'padding:18px 22px;background-color:transparent;',
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
    case 'highlight':
      return buildBlockShell(
        'highlight',
        '<div style="background:#F3F0FF;border:1px solid rgba(124,58,237,0.12);border-radius:18px;padding:18px 18px 16px 18px;"><h3 style="margin:0 0 10px 0;font-size:18px;line-height:1.35;color:#001161;">Co je dobré vědět</h3><p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">Tento blok se hodí na shrnutí, tip nebo stručné vysvětlení.</p></div>',
        'padding:18px 22px;background-color:transparent;',
      );
    case 'columns-2':
      return buildBlockShell(
        'columns-2',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td valign="top" width="50%" style="padding:0 8px 0 0;"><div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;"><h3 style="margin:0 0 8px 0;font-size:17px;color:#001161;">Levý sloupec</h3><p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Krátký obsah nebo benefit.</p></div></td><td valign="top" width="50%" style="padding:0 0 0 8px;"><div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;"><h3 style="margin:0 0 8px 0;font-size:17px;color:#001161;">Pravý sloupec</h3><p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Doplňující informace nebo CTA.</p></div></td></tr></table>',
        'padding:18px 22px;background-color:transparent;',
      );
    case 'columns-3':
      return buildBlockShell(
        'columns-3',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td valign="top" width="33.33%" style="padding:0 8px 0 0;"><div class="vb-inf-col" style="background:#FFF7ED;border-radius:16px;padding:16px;"><div style="font-size:24px;font-weight:800;color:#F06632;margin:0 0 6px 0;">1</div><div style="font-size:15px;font-weight:700;color:#001161;margin:0 0 6px 0;">První bod</div><p style="margin:0;font-size:13px;line-height:1.55;color:#475569;">Krátké vysvětlení.</p></div></td><td valign="top" width="33.33%" style="padding:0 4px;"><div class="vb-inf-col" style="background:#ECFDF5;border-radius:16px;padding:16px;"><div style="font-size:24px;font-weight:800;color:#059669;margin:0 0 6px 0;">2</div><div style="font-size:15px;font-weight:700;color:#001161;margin:0 0 6px 0;">Druhý bod</div><p style="margin:0;font-size:13px;line-height:1.55;color:#475569;">Krátké vysvětlení.</p></div></td><td valign="top" width="33.33%" style="padding:0 0 0 8px;"><div class="vb-inf-col" style="background:#F3F0FF;border-radius:16px;padding:16px;"><div style="font-size:24px;font-weight:800;color:#7C3AED;margin:0 0 6px 0;">3</div><div style="font-size:15px;font-weight:700;color:#001161;margin:0 0 6px 0;">Třetí bod</div><p style="margin:0;font-size:13px;line-height:1.55;color:#475569;">Krátké vysvětlení.</p></div></td></tr></table>',
        'padding:18px 22px;background-color:transparent;',
      );
    case 'hero':
      return buildBlockShell(
        'hero',
        '<div style="background:#001161;border-radius:22px;padding:28px 22px;text-align:center;"><div style="display:inline-block;margin:0 0 10px 0;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:11px;font-weight:700;letter-spacing:0.06em;color:#ffffff;text-transform:uppercase;">Vividbooks</div><h2 style="margin:0 0 10px 0;font-size:28px;line-height:1.2;color:#ffffff;">Sem napište hlavní claim</h2><p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.82);">Krátké vysvětlení, proč má čtenář pokračovat dál.</p></div>',
        'padding:18px 22px;background-color:transparent;',
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
  if (el.querySelector('img') && !el.querySelector('table')) return 'image';
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
      if (!(node instanceof HTMLElement)) continue;
      if (/^(STYLE|SCRIPT)$/i.test(node.tagName)) continue;
      if (node.getAttribute('data-vb-block') === 'section') continue;
      const wrap = doc.createElement('div');
      wrap.setAttribute('data-vb-block', 'section');
      wrap.setAttribute('data-vb-section-fill', 'card');
      wrap.setAttribute('data-vb-block-id', randomBlockId());
      wrap.setAttribute('style', 'padding:0;background:transparent;');
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
      normalizeEmailBlockContainer(el);
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
