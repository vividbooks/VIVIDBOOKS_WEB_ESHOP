/**
 * Export / odeslání e-mailu z builderu — čisté HTML bez editor attrs,
 * s mobilními třídami pro stackování sloupců.
 */
import { normalizeEmailBodyHtml, stripCardChromeInsideSections } from './emailBlocks';

/** Attrs jen pro editor — do odeslaného mailu nepatří. */
const EDITOR_ATTRS_TO_STRIP = [
  'data-vb-block-id',
  'data-vb-insert',
  'data-vb-ai-replace',
  'data-vb-col-chooser',
  'data-vb-col-placeholder',
  'data-vb-col-unit',
  'data-vb-col-choose',
  'data-vb-wb-encoded',
  'data-vb-pc-encoded',
  'data-vb-wb-height',
  'data-vb-chrome-bg',
  'data-vb-chrome-border',
  'data-vb-chrome-shadow',
  'data-vb-chrome-radius',
  'contenteditable',
] as const;

const EDITOR_CLASSES_TO_STRIP = ['vb-block-selected', 'vb-block-hover', 'vb-dnd-dragging'] as const;

/**
 * Mobilní CSS pro tělo mailu (sloupce, webinář, koláž, typografie).
 * Stejná sada patří i do šablony na serveru (`vividbooksEmailTemplate`).
 */
export const EMAIL_BODY_MOBILE_CSS = `
/* Velikosti H1–H4 (barvu necháváme na inline — bílá na tmavém hero vs. brand barvy). */
.vb-email-root h1:not(:is([data-email-webinar="true"] *)) {
  margin: 0 0 14px 0 !important;
  font-size: 26px !important;
  font-weight: 800 !important;
  line-height: 1.2 !important;
}
.vb-email-root h2:not(:is([data-email-webinar="true"] *)) {
  margin: 0 0 12px 0 !important;
  font-size: 22px !important;
  font-weight: 800 !important;
  line-height: 1.25 !important;
}
.vb-email-root h3:not(:is([data-email-webinar="true"] *)) {
  margin: 0 0 10px 0 !important;
  font-size: 19px !important;
  font-weight: 700 !important;
  line-height: 1.35 !important;
}
.vb-email-root h4:not(:is([data-email-webinar="true"] *)) {
  margin: 0 0 8px 0 !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  line-height: 1.4 !important;
}
@media only screen and (max-width: 600px) {
  .vb-email-root p,
  .vb-email-root li { font-size: 15px !important; line-height: 1.65 !important; }
  .vb-email-root h1 { font-size: 26px !important; line-height: 1.25 !important; }
  .vb-email-root h2 { font-size: 22px !important; line-height: 1.3 !important; }
  .vb-email-root h3 { font-size: 19px !important; line-height: 1.35 !important; }
  .vb-email-root img { max-width: 100% !important; height: auto !important; }
  .vb-email-root a.vb-preview-cta,
  .vb-email-root a.vb-webinar-cta,
  .vb-email-root a[style*="background-color:#F06632"],
  .vb-email-root a[style*="background-color: #F06632"],
  .vb-email-root a[style*="background-color:#7C3AED"],
  .vb-email-root a[style*="background-color: #7C3AED"],
  .vb-email-root a[style*="background-color:#FF8C00"],
  .vb-email-root a[style*="background-color: #FF8C00"] {
    font-size: 15px !important;
    padding: 14px 24px !important;
    display: inline-block !important;
    white-space: normal !important;
  }
  .vb-email-root [data-vb-block="section"] { margin-bottom: 24px !important; }
  /* Builder sloupce 2/3 */
  .vb-email-cols > tbody > tr > td,
  .vb-email-cols > tr > td,
  [data-vb-columns] > tbody > tr > td,
  [data-vb-columns] > tr > td,
  td.vb-email-col {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    padding-bottom: 14px !important;
  }
  /* Webinář — vnější layout buňky (+ .vb-wb-stack na spodní liště hero) */
  [data-email-webinar] > table > tbody > tr > td,
  [data-email-webinar] > table > tr > td,
  .vb-email-webinar > table > tbody > tr > td,
  .vb-email-webinar > table > tr > td,
  td.vb-wb-stack {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    box-sizing: border-box !important;
    white-space: normal !important;
  }
  [data-vb-wb-thumb] {
    padding: 0 !important;
  }
  [data-email-webinar] > table > tbody > tr > td img,
  .vb-email-webinar > table > tbody > tr > td img,
  td.vb-wb-stack img {
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
  }
  [data-email-webinar] > table,
  .vb-email-webinar > table {
    height: auto !important;
  }
  /* Produktová koláž grid/compact */
  [data-product-collage] .vb-email-cols > tbody > tr > td,
  [data-product-collage] .vb-email-cols > tr > td,
  .vb-email-collage .vb-email-cols > tbody > tr > td,
  .vb-email-collage .vb-email-cols > tr > td {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    text-align: center !important;
  }
  /* Legacy AI layout classes */
  .vb-prod-img,
  .vb-prod-txt { display: block !important; width: 100% !important; }
  .vb-prod-img { padding: 0 0 14px 0 !important; text-align: center !important; padding-right: 0 !important; }
  .vb-prod-img img { width: 100% !important; max-width: 280px !important; height: auto !important; }
  .vb-prod-txt { padding-left: 0 !important; }
  .vb-web-split-img,
  .vb-web-split-txt { display: block !important; width: 100% !important; }
  .vb-web-split-img { padding: 0 0 16px 0 !important; padding-right: 0 !important; text-align: center !important; }
  .vb-web-split-img img { max-width: 280px !important; width: 100% !important; margin: 0 auto !important; }
  .vb-web-split-txt { padding-left: 0 !important; }
  .vb-inf-col { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
}
`.trim();

function addClass(el: Element, className: string) {
  const cur = (el.getAttribute('class') || '').trim();
  const parts = cur ? cur.split(/\s+/) : [];
  if (!parts.includes(className)) parts.push(className);
  el.setAttribute('class', parts.join(' '));
}

/** Zvedne padding bloku na minimum (top/right/bottom/left), zachová větší hodnoty. */
function ensureBlockMinPadding(
  el: HTMLElement,
  min: { top: number; right: number; bottom: number; left: number },
) {
  const style = (el.getAttribute('style') || '').trim();
  const m4 = style.match(/padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i);
  const m2 = style.match(/padding\s*:\s*(\d+)px\s+(\d+)px(?:\s*;|$)/i);
  const m1 = style.match(/padding\s*:\s*(\d+)px(?:\s*;|$)/i);
  let t = 0;
  let r = 0;
  let b = 0;
  let l = 0;
  if (m4) {
    t = Number(m4[1]);
    r = Number(m4[2]);
    b = Number(m4[3]);
    l = Number(m4[4]);
  } else if (m2) {
    t = b = Number(m2[1]);
    r = l = Number(m2[2]);
  } else if (m1) {
    t = r = b = l = Number(m1[1]);
  } else {
    t = min.top;
    r = min.right;
    b = min.bottom;
    l = min.left;
  }
  t = Math.max(t, min.top);
  r = Math.max(r, min.right);
  b = Math.max(b, min.bottom);
  l = Math.max(l, min.left);
  const nextPad = `padding:${t}px ${r}px ${b}px ${l}px`;
  if (/padding\s*:/i.test(style)) {
    el.setAttribute('style', style.replace(/padding\s*:\s*[^;]+;?/i, `${nextPad};`));
  } else {
    el.setAttribute('style', `${style}${style && !style.endsWith(';') ? ';' : ''}${nextPad};`);
  }
}

function stripEditorClasses(el: Element) {
  const cur = (el.getAttribute('class') || '').trim();
  if (!cur) return;
  const next = cur
    .split(/\s+/)
    .filter((c) => c && !(EDITOR_CLASSES_TO_STRIP as readonly string[]).includes(c));
  if (next.length) el.setAttribute('class', next.join(' '));
  else el.removeAttribute('class');
}

function stripEditorAttrs(el: Element) {
  for (const attr of EDITOR_ATTRS_TO_STRIP) {
    if (el.hasAttribute(attr)) el.removeAttribute(attr);
  }
  // data-ai-* a podobné
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('data-ai-')) el.removeAttribute(attr.name);
  }
  stripEditorClasses(el);
}

/** Nedokončený sloupec (chooser s buttony) → prázdná buňka. */
function scrubColumnChoosers(root: HTMLElement) {
  for (const chooser of [...root.querySelectorAll('[data-vb-col-chooser]')]) {
    const td = chooser.closest('td');
    chooser.remove();
    if (td && !td.querySelector('[data-vb-col-unit], [data-vb-block], img, a, p, h1, h2, h3, table')) {
      td.innerHTML = '&nbsp;';
    }
  }
}

/** Placeholder stavy (prázdný webinář / koláž) — nechat krátký text, nebo vyčistit. */
function scrubEmptyPlaceholders(root: HTMLElement) {
  for (const el of [...root.querySelectorAll('[data-vb-block="webinar"]')]) {
    const text = (el.textContent || '').trim();
    if (text.includes('Vyberte webinář') && !el.querySelector('a.vb-webinar-cta, img')) {
      el.remove();
    }
  }
  for (const el of [...root.querySelectorAll('[data-vb-block="product-collage"]')]) {
    const text = (el.textContent || '').trim();
    if (text.includes('Upravte koláž') && !el.querySelector('img, a[href]')) {
      el.remove();
    }
  }
}

/** Přidá stackovací třídy pro mobilní CSS (bez závislosti na data-attrs po stripu). */
function ensureExportLayoutClasses(root: HTMLElement) {
  for (const table of [...root.querySelectorAll('[data-vb-columns]')]) {
    addClass(table, 'vb-email-cols');
    for (const td of [...table.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td')]) {
      addClass(td, 'vb-email-col');
    }
  }

  for (const wb of [...root.querySelectorAll('[data-email-webinar], [data-vb-block="webinar"]')]) {
    addClass(wb, 'vb-email-webinar');
    // Compact / pill: přímé TD v první tabulce
    const outer = wb.querySelector(':scope > table');
    if (outer) {
      for (const td of [...outer.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td')]) {
        addClass(td, 'vb-wb-stack');
      }
      // Hero: spodní lišta (druhý řádek / vnořená tabulka s CTA)
      for (const cta of [...wb.querySelectorAll('a.vb-webinar-cta')]) {
        const bar = cta.closest('table');
        if (bar && bar !== outer) {
          for (const td of [...bar.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td')]) {
            addClass(td, 'vb-wb-stack');
          }
        }
      }
    }
  }

  for (const pc of [...root.querySelectorAll('[data-product-collage], [data-vb-block="product-collage"]')]) {
    addClass(pc, 'vb-email-collage');
    for (const table of [...pc.querySelectorAll('table')]) {
      addClass(table, 'vb-email-cols');
      for (const td of [...table.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td')]) {
        addClass(td, 'vb-email-col');
      }
    }
  }

  for (const sec of [...root.querySelectorAll('[data-vb-block="section"]')]) {
    addClass(sec, 'vb-email-section');
    const isCard = sec.getAttribute('data-vb-section-fill') !== 'plain';
    // Mezera mezi kartami + vnitřní padding (border-radius v klientech jinak ořízne spodní CTA).
    let style = (sec.getAttribute('style') || '').trim();
    if (!/margin-bottom\s*:/i.test(style)) {
      style = `${style}${style && !style.endsWith(';') ? ';' : ''}margin-bottom:32px;`;
    }
    if (/overflow\s*:\s*hidden/i.test(style)) {
      style = style.replace(/overflow\s*:\s*hidden/gi, 'overflow:visible');
    } else if (!/overflow\s*:/i.test(style)) {
      style = `${style}${style && !style.endsWith(';') ? ';' : ''}overflow:visible;`;
    }
    // Karty mají často padding:0 — musíme ho přepsat (ne jen doplnit když chybí).
    if (isCard) {
      const bottomPad = 28;
      if (/padding\s*:\s*0(?:px)?(?!\s*\d)/i.test(style)) {
        style = style.replace(/padding\s*:\s*0(?:px)?(?!\s*\d)/i, `padding:0 0 ${bottomPad}px 0`);
      } else if (/padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i.test(style)) {
        style = style.replace(
          /padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i,
          (_m, t, r, b, l) =>
            `padding:${t}px ${r}px ${Math.max(Number(b), bottomPad)}px ${l}px`,
        );
      } else if (/padding\s*:\s*(\d+)px\s+(\d+)px(?:\s*;|$)/i.test(style)) {
        style = style.replace(
          /padding\s*:\s*(\d+)px\s+(\d+)px(?:\s*;|$)/i,
          (_m, v, h) =>
            `padding:${v}px ${h}px ${Math.max(Number(v), bottomPad)}px ${h}px;`,
        );
      } else if (/padding-bottom\s*:/i.test(style)) {
        style = style.replace(
          /padding-bottom\s*:\s*(\d+)px/i,
          (_m, b) => `padding-bottom:${Math.max(Number(b), bottomPad)}px`,
        );
      } else if (!/padding\s*:/i.test(style)) {
        style = `${style}${style && !style.endsWith(';') ? ';' : ''}padding:0 0 ${bottomPad}px 0;`;
      }
    }
    sec.setAttribute('style', style);

    const kids = [...sec.children].filter(
      (c) =>
        c.nodeType === 1 &&
        (c as HTMLElement).hasAttribute('data-vb-block') &&
        !/^(STYLE|SCRIPT)$/i.test((c as HTMLElement).tagName),
    ) as HTMLElement[];
    if (kids.length > 0) {
      ensureBlockMinPadding(kids[kids.length - 1], { top: 10, right: 24, bottom: 28, left: 24 });
    }

    // Extra spacer — některé klienty ignorují padding na divu s border-radius.
    if (isCard && !sec.querySelector(':scope > [data-vb-email-pad]')) {
      const pad = sec.ownerDocument!.createElement('div');
      pad.setAttribute('data-vb-email-pad', '1');
      pad.setAttribute('aria-hidden', 'true');
      pad.setAttribute(
        'style',
        'display:block;height:4px;line-height:4px;font-size:0;mso-line-height-rule:exactly;',
      );
      pad.innerHTML = '&nbsp;';
      sec.appendChild(pad);
    }
  }

  // Samostatné CTA / button bloky (i mimo section) — ať nejsou nalepené na hranu karty.
  for (const btn of [...root.querySelectorAll('[data-vb-block="button"]')] as HTMLElement[]) {
    ensureBlockMinPadding(btn, { top: 14, right: 24, bottom: 28, left: 24 });
  }

  // Starší compact/pill webináře: pevná height ořezávala CTA — při exportu uvolnit.
  for (const wb of [...root.querySelectorAll('[data-email-webinar], [data-vb-block="webinar"], .vb-email-webinar')]) {
    for (const table of [...wb.querySelectorAll('table')] as HTMLElement[]) {
      let st = (table.getAttribute('style') || '').trim();
      if (/height\s*:\s*\d+px/i.test(st)) {
        st = st.replace(/(^|;)\s*height\s*:\s*(\d+)px/gi, '$1min-height:$2px');
        table.setAttribute('style', st);
      }
      table.removeAttribute('height');
    }
    for (const td of [...wb.querySelectorAll('td')] as HTMLElement[]) {
      if (td.hasAttribute('data-vb-wb-thumb')) continue;
      if (!td.querySelector('a.vb-webinar-cta')) continue;
      let st = (td.getAttribute('style') || '').trim();
      st = st.replace(/(^|;)\s*height\s*:\s*\d+px/gi, '$1');
      if (/padding\s*:/i.test(st)) {
        st = st.replace(
          /padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i,
          (_m, t, r, b, l) => `padding:${t}px ${r}px ${Math.max(Number(b), 18)}px ${l}px`,
        );
      } else {
        st = `${st}${st && !st.endsWith(';') ? ';' : ''}padding:16px 14px 18px 14px;`;
      }
      td.setAttribute('style', st.replace(/;;+/g, ';'));
      td.removeAttribute('height');
    }
  }
}

/** localhost / 127.0.0.1 → kanonický marketingový web (uložené drafty z lokálního builderu). */
function rewriteLocalDevUrlsInEmailHtml(html: string): string {
  if (!html) return html;
  const prod = 'https://www.vividbooks.com';
  return html
    .replace(/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/gi, prod)
    .replace(/https?:\/\/\[::1\](:\d+)?/gi, prod);
}

/**
 * Připraví tělo mailu k odeslání / Mailchimpu:
 * normalizace → scrub editor UI → layout classes → strip editor attrs.
 * Mobilní CSS je v odesílací šabloně (`vividbooksEmailTemplate`), ne v těle.
 */
export function compileEmailBodyForSend(html: string): string {
  const normalized = rewriteLocalDevUrlsInEmailHtml(normalizeEmailBodyHtml(html || ''));
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return normalized;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${normalized}</body>`, 'text/html');
  const root =
    (doc.body.querySelector(':scope > .vb-email-root') as HTMLElement | null) ||
    (doc.body.firstElementChild as HTMLElement | null);
  if (!root) return normalized;

  stripCardChromeInsideSections(root);
  scrubColumnChoosers(root);
  scrubEmptyPlaceholders(root);
  ensureExportLayoutClasses(root);

  for (const el of [root, ...root.querySelectorAll('*')]) {
    stripEditorAttrs(el);
  }

  return rewriteLocalDevUrlsInEmailHtml(root.outerHTML);
}
