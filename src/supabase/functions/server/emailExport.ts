/**
 * Server-side export hygiene for Email Builder body HTML.
 * (Client má DOM verzi v `src/components/admin/emailExport.ts`.)
 */

/** Mobilní CSS pro tělo — vkládá se do odesílací šablony. */
export const EMAIL_BODY_MOBILE_CSS = `
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
  .vb-email-root [data-vb-block="section"],
  .vb-email-root .vb-email-section { margin-bottom: 24px !important; }
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
  .vb-email-webinar > table { height: auto !important; }
  [data-product-collage] .vb-email-cols > tbody > tr > td,
  [data-product-collage] .vb-email-cols > tr > td,
  .vb-email-collage .vb-email-cols > tbody > tr > td,
  .vb-email-collage .vb-email-cols > tr > td {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    text-align: center !important;
  }
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

const ATTRS_TO_STRIP = [
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
];

/** String-based compile (bez DOM) — bezpečná síť pro cesty mimo EmailBuilder. */
/** localhost z lokálního Email Builderu → produkční marketingový web. */
function rewriteLocalDevUrlsInEmailHtml(html: string): string {
  if (!html) return html;
  const prod = 'https://www.vividbooks.com';
  return html
    .replace(/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/gi, prod)
    .replace(/https?:\/\/\[::1\](:\d+)?/gi, prod);
}

export function compileEmailBodyForSend(html: string): string {
  let out = rewriteLocalDevUrlsInEmailHtml(String(html || ''));
  if (!out.trim()) return out;

  // Nejdřív UI editoru (ještě před strip attrs, jinak ztratíme selektory)
  out = out.replace(/<div[^>]*data-vb-col-chooser[^>]*>[\s\S]*?<\/div>/gi, '&nbsp;');
  out = out.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '');

  for (const attr of ATTRS_TO_STRIP) {
    out = out.replace(new RegExp(`\\s${attr}\\s*=\\s*"[^"]*"`, 'gi'), '');
    out = out.replace(new RegExp(`\\s${attr}\\s*=\\s*'[^']*'`, 'gi'), '');
    out = out.replace(new RegExp(`\\s${attr}(?=[\\s>])`, 'gi'), '');
  }
  out = out.replace(/\sdata-ai-[a-z0-9_-]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\sdata-ai-[a-z0-9_-]+\s*=\s*'[^']*'/gi, '');

  out = out.replace(/\sclass="([^"]*)"/gi, (_m, cls: string) => {
    const next = cls
      .split(/\s+/)
      .filter((c) => c && !['vb-block-selected', 'vb-block-hover', 'vb-dnd-dragging'].includes(c));
    return next.length ? ` class="${next.join(' ')}"` : '';
  });

  out = out.replace(
    /<table(?![^>]*\bvb-email-cols\b)([^>]*\bdata-vb-columns=)/gi,
    '<table class="vb-email-cols"$1',
  );
  out = out.replace(
    /<div(?![^>]*\bvb-email-webinar\b)([^>]*\bdata-email-webinar=)/gi,
    '<div class="vb-email-webinar"$1',
  );
  out = out.replace(
    /<div(?![^>]*\bvb-email-collage\b)([^>]*\bdata-product-collage=)/gi,
    '<div class="vb-email-collage"$1',
  );

  // Section mezery + vnitřní spodní padding (border-radius v klientech ořezává spodní CTA).
  // Pozor: karty mají typicky padding:0 — musíme ho přepsat, ne jen doplnit když chybí.
  out = out.replace(
    /(<div[^>]*data-vb-block="section"[^>]*style=")([^"]*)(")/gi,
    (_m, a: string, style: string, c: string) => {
      let s = style;
      if (!/margin-bottom\s*:/i.test(s)) s += (s.endsWith(';') || !s ? '' : ';') + 'margin-bottom:32px;';
      s = s.replace(/overflow\s*:\s*hidden/gi, 'overflow:visible');
      if (!/overflow\s*:/i.test(s)) s += (s.endsWith(';') || !s ? '' : ';') + 'overflow:visible;';
      const isPlain =
        /background\s*:\s*transparent/i.test(s) && /border-radius\s*:\s*0(?:px)?/i.test(s);
      if (!isPlain) {
        if (/padding\s*:\s*0(?:px)?(?!\s*\d)/i.test(s)) {
          s = s.replace(/padding\s*:\s*0(?:px)?(?!\s*\d)/i, 'padding:0 0 28px 0');
        } else if (/padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i.test(s)) {
          s = s.replace(
            /padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i,
            (_mm, t, r, b, l) =>
              `padding:${t}px ${r}px ${Math.max(Number(b), 28)}px ${l}px`,
          );
        } else if (/padding\s*:\s*(\d+)px\s+(\d+)px(?:\s*;|$)/i.test(s)) {
          s = s.replace(
            /padding\s*:\s*(\d+)px\s+(\d+)px(?:\s*;|$)/i,
            (_mm, v, h) =>
              `padding:${v}px ${h}px ${Math.max(Number(v), 28)}px ${h}px;`,
          );
        } else if (!/padding\s*:/i.test(s) && !/padding-bottom\s*:/i.test(s)) {
          s += (s.endsWith(';') || !s ? '' : ';') + 'padding:0 0 28px 0;';
        }
      }
      return `${a}${s}${c}`;
    },
  );

  // Button / CTA bloky — min. spodní padding, ať nejsou nalepené na hranu karty
  out = out.replace(
    /(<div[^>]*data-vb-block="button"[^>]*style=")([^"]*)(")/gi,
    (_m, a: string, style: string, c: string) => {
      let s = style;
      if (/padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i.test(s)) {
        s = s.replace(
          /padding\s*:\s*(\d+)px\s+(\d+)px\s+(\d+)px\s+(\d+)px/i,
          (_mm, t, r, b, l) =>
            `padding:${Math.max(Number(t), 14)}px ${Math.max(Number(r), 24)}px ${Math.max(Number(b), 28)}px ${Math.max(Number(l), 24)}px`,
        );
      } else if (/padding\s*:\s*(\d+)px\s+(\d+)px/i.test(s)) {
        s = s.replace(
          /padding\s*:\s*(\d+)px\s+(\d+)px/i,
          (_mm, v, h) =>
            `padding:${Math.max(Number(v), 14)}px ${Math.max(Number(h), 24)}px ${Math.max(Number(v), 28)}px ${Math.max(Number(h), 24)}px`,
        );
      } else if (!/padding\s*:/i.test(s)) {
        s += (s.endsWith(';') || !s ? '' : ';') + 'padding:16px 24px 28px 24px;';
      }
      return `${a}${s}${c}`;
    },
  );

  // Webinář tabulky: height → min-height (CTA se neořízne)
  out = out.replace(
    /(<table[^>]*(?:data-email-webinar|vb-email-webinar|vb-webinar)[^>]*style=")([^"]*)(")/gi,
    (_m, a: string, style: string, c: string) => {
      let s = style.replace(/(?<!min-)height\s*:\s*(\d+)px/gi, 'min-height:$1px');
      return `${a}${s}${c}`;
    },
  );
  // Obecně u tabulek uvnitř webinář bloku (encoded už je pryč, zůstal data-email-webinar na wrapperu)
  out = out.replace(
    /(data-email-webinar="true"[^>]*>[\s\S]*?<table[^>]*style=")([^"]*height:\s*\d+px[^"]*)(")/gi,
    (_m, a: string, style: string, c: string) => {
      const s = style.replace(/(?<!min-)height\s*:\s*(\d+)px/gi, 'min-height:$1px');
      return `${a}${s}${c}`;
    },
  );

  return out;
}
