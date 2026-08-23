/**
 * HTML e-mailu → jednoduchý označený text pro copywriter agenta.
 */

function cleanText(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function emitId(el: Element | null): string {
  const id = el?.getAttribute('data-vb-block-id') || '';
  return id ? ` id=${id}` : '';
}

function serializeNode(el: HTMLElement, lines: string[]): void {
  const type = (el.getAttribute('data-vb-block') || '').toLowerCase();
  const idSuf = emitId(el);

  if (type === 'section') {
    const fill = el.getAttribute('data-vb-section-fill') === 'plain' ? 'plain' : 'karta';
    const bg = el.getAttribute('data-vb-chrome-bg') || '';
    lines.push(`=== SKUPINA ${fill}${bg ? ` ${bg}` : ''}${idSuf} ===`);
    for (const child of [...el.children] as HTMLElement[]) {
      if (child.getAttribute('data-vb-block')) serializeNode(child, lines);
    }
    return;
  }

  if (type === 'webinar') {
    const slug = el.getAttribute('data-ai-webinar-slug') || el.getAttribute('data-vb-wb-slug') || '';
    const layout = el.getAttribute('data-ai-webinar-layout') || el.getAttribute('data-vb-wb-layout') || 'compact';
    const title = cleanText(el.textContent || '').slice(0, 80);
    lines.push(`WEBINÁŘ: ${title || 'webinář'} | slug=${slug} | layout=${layout}${idSuf}`);
    return;
  }

  if (type === 'product-collage') {
    const ids = el.getAttribute('data-ai-product-ids') || '';
    lines.push(`PRODUKTY: ${ids}${idSuf}`);
    return;
  }

  if (type === 'button') {
    const a = el.querySelector('a');
    const label = cleanText(a?.textContent || el.textContent || '');
    const href = a?.getAttribute('href') || '';
    lines.push(`TLAČÍTKO: ${label}${href ? ` | ${href}` : ''}${idSuf}`);
    return;
  }

  if (type === 'image') {
    const img = el.querySelector('img');
    lines.push(`OBRÁZEK: ${img?.getAttribute('src') || ''}${img?.getAttribute('alt') ? ` | ${img.getAttribute('alt')}` : ''}${idSuf}`);
    return;
  }

  if (type === 'divider') {
    lines.push(`ODDĚLOVAČ${idSuf}`);
    return;
  }

  if (type === 'hero') {
    lines.push(`HERO: ${cleanText(el.textContent || '').slice(0, 160)}${idSuf}`);
    return;
  }

  if (type === 'highlight') {
    const h = el.querySelector('h1,h2,h3,h4');
    const color = el.getAttribute('data-vb-chrome-bg') || '';
    const rest = cleanText(el.textContent || '');
    const head = h ? cleanText(h.textContent || '') : '';
    const body = head && rest.startsWith(head) ? rest.slice(head.length).trim() : rest;
    if (head) lines.push(`NADPIS: ${head}${idSuf}`);
    lines.push(`ZVYRAZNĚNÍ${color ? ` ${color}` : ''}: ${body || rest}${idSuf}`);
    return;
  }

  if (type === 'text' || type === 'html' || type === 'gap-content' || !type) {
    const heads = [...el.querySelectorAll('h1,h2,h3,h4')] as HTMLElement[];
    const paras = [...el.querySelectorAll('p,li')] as HTMLElement[];
    if (heads.length === 0 && paras.length === 0) {
      const t = cleanText(el.textContent || '');
      if (t) lines.push(`ODSTAVEC: ${t}${idSuf}`);
      return;
    }
    for (const h of heads) {
      const tag = h.tagName.toLowerCase();
      const label = tag === 'h3' ? 'NADPIS h3' : tag === 'h1' ? 'NADPIS h1' : 'NADPIS';
      lines.push(`${label}: ${cleanText(h.textContent || '')}${idSuf}`);
    }
    for (const p of paras) {
      const t = cleanText(p.textContent || '');
      if (t) lines.push(`ODSTAVEC: ${t}${idSuf}`);
    }
  }
}

export function serializeEmailBodyToOutline(html: string): string {
  if (!html || typeof document === 'undefined') return '';
  try {
    const doc = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>${html}</body></html>`,
      'text/html',
    );
    const root =
      (doc.querySelector('.vb-email-root') as HTMLElement | null) || (doc.body as HTMLElement);
    const lines: string[] = [];
    const top = [...root.children] as HTMLElement[];
    const walk = top.length ? top : [root];
    for (const el of walk) {
      if (el.getAttribute?.('data-vb-block')) serializeNode(el, lines);
      else {
        const nested = [...el.querySelectorAll(':scope > [data-vb-block]')] as HTMLElement[];
        if (nested.length) nested.forEach((n) => serializeNode(n, lines));
        else {
          const t = cleanText(el.textContent || '');
          if (t) lines.push(`ODSTAVEC: ${t}`);
        }
      }
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}
