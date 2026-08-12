/**
 * Po AI generování nahradí „placeholder“ bloky skutečným HTML editoru
 * (webinář / produktová koláž), aby šly hned upravovat v panely.
 */
import {
  buildProductCollageBlockHtml,
  snapshotFromProduct,
  type EmailProductCollageLayout,
} from './emailProductCollage';
import {
  buildWebinarBlockHtml,
  snapshotFromWebinar,
  type EmailWebinarLayout,
} from './emailWebinarBlock';
import type { Webinar } from '../../data/webinars';

function randomBlockId(): string {
  return `vb-block-${Math.random().toString(36).slice(2, 10)}`;
}

function parseLayout(raw: string | null): EmailWebinarLayout {
  if (raw === 'compact' || raw === 'pill') return raw;
  return 'hero';
}

function parsePcLayout(raw: string | null): EmailProductCollageLayout {
  if (raw === 'list' || raw === 'compact') return raw;
  return 'grid';
}

function matchWebinar(list: Webinar[], slugOrId: string): Webinar | null {
  const key = slugOrId.trim().toLowerCase();
  if (!key) return null;
  return (
    list.find(w => String(w.slug || '').toLowerCase() === key) ||
    list.find(w => String(w.id || '').toLowerCase() === key) ||
    list.find(w => String(w.title || '').toLowerCase().includes(key)) ||
    null
  );
}

export type EmailAiHydrateResult = {
  html: string;
  notes: string[];
};

/**
 * Najde `data-ai-webinar-slug` / `data-ai-product-ids` placeholdery a nahradí je
 * plnými bloky editoru (stejné jako z knihovny bloků).
 */
function stripDuplicateHeroClient(root: HTMLElement, headline?: string) {
  for (const el of [...root.querySelectorAll('[data-vb-block="hero"]')]) {
    el.remove();
  }
  const hl = (headline || '').trim().toLowerCase();
  for (const el of [...root.querySelectorAll('[data-vb-block-id], div')]) {
    const h = el as HTMLElement;
    const style = (h.getAttribute('style') || '').toLowerCase();
    if (!/#00116[18]/.test(style)) continue;
    const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text.length < 90 && (!hl || text.toLowerCase().includes(hl.slice(0, 20)))) {
      // krátký tmavý box = typicky divný duplicitní hero
      if (h.children.length <= 3) h.remove();
    }
  }
}

export function hydrateEmailAiEditorBlocks(
  bodyHtml: string,
  webinars: Webinar[],
  products: any[],
  opts?: { headline?: string; forceInjectWebinars?: boolean },
): EmailAiHydrateResult {
  if (!bodyHtml || typeof document === 'undefined') {
    return { html: bodyHtml, notes: [] };
  }

  const notes: string[] = [];
  const doc = new DOMParser().parseFromString(
    `<div id="vb-ai-hydrate-root">${bodyHtml}</div>`,
    'text/html',
  );
  const root = doc.getElementById('vb-ai-hydrate-root');
  if (!root) return { html: bodyHtml, notes: [] };

  const htmlBeforeHero = root.innerHTML;
  stripDuplicateHeroClient(root, opts?.headline);
  if (root.innerHTML !== htmlBeforeHero) {
    notes.push('Odstraněn duplicitní hero (titulek je v šabloně).');
  }

  const productsById = new Map<string, any>();
  for (const p of products) {
    if (p?.id != null) productsById.set(String(p.id), p);
  }

  // Webináře
  const webinarPlaceholders = [
    ...root.querySelectorAll<HTMLElement>(
      '[data-ai-webinar-slug], [data-vb-block="webinar"][data-ai-webinar-id]',
    ),
  ];
  for (const el of webinarPlaceholders) {
    const slug =
      el.getAttribute('data-ai-webinar-slug') ||
      el.getAttribute('data-ai-webinar-id') ||
      '';
    const layout = parseLayout(el.getAttribute('data-ai-webinar-layout'));
    const blockId = el.getAttribute('data-vb-block-id') || randomBlockId();
    const found = matchWebinar(webinars, slug);
    if (!found) {
      notes.push(`Webinář „${slug}“ se v CMS nenašel — placeholder ponechán.`);
      continue;
    }
    const html = buildWebinarBlockHtml(layout, snapshotFromWebinar(found), blockId);
    const tmp = doc.createElement('div');
    tmp.innerHTML = html.trim();
    const next = tmp.firstElementChild;
    if (next) {
      el.replaceWith(next);
      notes.push(`Webinář „${found.title}“ napojený jako editovatelný blok (${layout}).`);
    }
  }

  // Produktové koláže z AI markerů
  const collagePlaceholders = [
    ...root.querySelectorAll<HTMLElement>('[data-ai-product-ids]'),
  ];
  for (const el of collagePlaceholders) {
    const ids = (el.getAttribute('data-ai-product-ids') || '')
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const layout = parsePcLayout(el.getAttribute('data-ai-pc-layout'));
    const blockId = el.getAttribute('data-vb-block-id') || randomBlockId();
    const items = ids
      .map(id => productsById.get(id))
      .filter(Boolean)
      .map(p => snapshotFromProduct(p));
    if (items.length === 0) {
      notes.push(`Koláž: produkty [${ids.join(', ')}] se nenašly — placeholder ponechán.`);
      continue;
    }
    const html = buildProductCollageBlockHtml(layout, items, blockId);
    const tmp = doc.createElement('div');
    tmp.innerHTML = html.trim();
    const next = tmp.firstElementChild;
    if (next) {
      el.replaceWith(next);
      notes.push(`Produktová koláž (${items.length} položek, ${layout}) napojená jako editovatelný blok.`);
    }
  }

  // Když AI dala jen textový seznam webinářů — nahraď skutečnými bloky s odkazy
  const hasRealWebinar = !!root.querySelector('[data-email-webinar="true"]');
  const plain = (root.textContent || '').replace(/\s+/g, ' ').toLowerCase();
  const upcoming = webinars.filter(w => !w.isPast);
  const pool = upcoming.length ? upcoming : webinars;
  const matched = pool.filter(w => {
    const title = String(w.title || '').trim();
    if (title.length < 6) return false;
    return plain.includes(title.toLowerCase().slice(0, Math.min(48, title.length)));
  }).slice(0, 6);

  const shouldInject =
    !hasRealWebinar &&
    matched.length > 0 &&
    (opts?.forceInjectWebinars || /webin[aá]?[rř]|dvpp|naživo|přihlásit/i.test(plain));

  if (shouldInject) {
    const section = doc.createElement('div');
    section.setAttribute('data-vb-block', 'section');
    section.setAttribute('data-vb-section-fill', 'plain');
    section.setAttribute('data-vb-block-id', randomBlockId());
    section.setAttribute('style', 'padding:0;background:transparent;');

    const heading = doc.createElement('div');
    heading.setAttribute('data-vb-block', 'text');
    heading.setAttribute('data-vb-block-id', randomBlockId());
    heading.setAttribute('style', 'padding:12px 22px 6px 22px;background:transparent;');
    heading.innerHTML =
      '<h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#F06632;">Ukážeme vám všechno naživo</h2>';
    section.appendChild(heading);

    for (const w of matched) {
      const html = buildWebinarBlockHtml('compact', snapshotFromWebinar(w), randomBlockId());
      const tmp = doc.createElement('div');
      tmp.innerHTML = html.trim();
      if (tmp.firstElementChild) section.appendChild(tmp.firstElementChild);
    }

    // Nahraď textový blok s více daty, jinak připoj na konec
    const textBlocks = [...root.querySelectorAll('[data-vb-block="text"]')] as HTMLElement[];
    const listHost = textBlocks.find(el => {
      const t = el.textContent || '';
      const dates = t.match(/\d{1,2}\.\s*\d{1,2}\./g) || [];
      return dates.length >= 2;
    });
    if (listHost) {
      listHost.replaceWith(section);
    } else {
      const emailRoot = root.querySelector('.vb-email-root') || root;
      emailRoot.appendChild(section);
    }
    notes.push(`Textový seznam nahrazen ${matched.length} bloky webinářů s odkazy.`);
  }

  return { html: root.innerHTML, notes };
}
