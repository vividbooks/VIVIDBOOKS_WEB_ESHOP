/** Shared TipTap ↔ HTML helpers for blog / novinky CMS editors. */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function nodePlainText(n: { type?: string; text?: string; content?: unknown[] }): string {
  if (n.type === 'text') return n.text || '';
  if (n.content) return (n.content as typeof n[]).map(nodePlainText).join('');
  return '';
}

/** Inline marks (link, bold, italic) → HTML fragment. */
export function nodeToHtml(n: {
  type?: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: unknown[];
}): string {
  if (n.type === 'text') {
    let t = escapeHtml(n.text || '');
    for (const m of n.marks || []) {
      if (m.type === 'bold') t = `<strong>${t}</strong>`;
      else if (m.type === 'italic') t = `<em>${t}</em>`;
      else if (m.type === 'link' && m.attrs?.href) {
        const href = escapeHtml(String(m.attrs.href));
        const target = m.attrs.target ? ` target="${escapeHtml(String(m.attrs.target))}"` : '';
        t = `<a href="${href}"${target} rel="noopener noreferrer">${t}</a>`;
      }
    }
    return t;
  }
  if (n.content) return (n.content as typeof n[]).map(nodeToHtml).join('');
  if (n.type === 'hardBreak') return '<br>';
  return '';
}

export type CmsContentBlock = {
  type: string;
  text?: string;
  html?: string;
  author?: string;
  src?: string;
  alt?: string;
  caption?: string;
};

export function blocksToEditorHtml(blocks: CmsContentBlock[] | null | undefined): string {
  if (!Array.isArray(blocks) || !blocks.length) return '<p></p>';
  return blocks
    .map(b => {
      if (b.type === 'paragraph') {
        if (b.html) return `<p>${b.html}</p>`;
        return `<p>${escapeHtml(b.text || '')}</p>`;
      }
      if (b.type === 'heading') {
        if (b.html) return `<h2>${b.html}</h2>`;
        return `<h2>${escapeHtml(b.text || '')}</h2>`;
      }
      if (b.type === 'quote') {
        const body = b.html || escapeHtml(b.text || '');
        const author = b.author ? `<p>— ${escapeHtml(b.author)}</p>` : '';
        return `<blockquote><p>${body}</p>${author}</blockquote>`;
      }
      if (b.type === 'image' && b.src) {
        return `<img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt || '')}" title="${escapeHtml(b.caption || '')}">`;
      }
      return '';
    })
    .join('');
}

export function resolvePostEditorHtml(post: {
  content?: CmsContentBlock[] | null;
  contentHtml?: string | null;
}): string {
  const stored = (post.contentHtml || '').trim();
  if (stored.length > 0) return stored;
  return blocksToEditorHtml(post.content || []);
}

export function jsonDocToBlocks(doc: { content?: unknown[] }): CmsContentBlock[] {
  const out: CmsContentBlock[] = [];
  function walk(node: {
    type?: string;
    content?: unknown[];
    attrs?: Record<string, unknown>;
  }) {
    if (node.type === 'paragraph') {
      const html = nodeToHtml(node as Parameters<typeof nodeToHtml>[0]).trim();
      const text = nodePlainText(node).trim();
      if (html || text) out.push({ type: 'paragraph', text, html: html || undefined });
    } else if (node.type === 'heading') {
      const level = (node.attrs?.level as number) || 2;
      const html = nodeToHtml(node as Parameters<typeof nodeToHtml>[0]).trim();
      const text = nodePlainText(node).trim();
      if (html || text) {
        if (level === 3) {
          out.push({
            type: 'paragraph',
            text,
            html: html ? `<h3>${html}</h3>` : `<h3>${escapeHtml(text)}</h3>`,
          });
        } else {
          out.push({ type: 'heading', text, html: html || undefined });
        }
      }
    } else if (node.type === 'blockquote') {
      const kids = (node.content || []) as { type?: string; content?: unknown[] }[];
      const first = kids[0];
      const second = kids[1];
      const html = first ? nodeToHtml(first as Parameters<typeof nodeToHtml>[0]).trim() : '';
      const text = first ? nodePlainText(first).trim() : '';
      const author = second ? nodePlainText(second).trim().replace(/^—\s*/, '') : '';
      if (text || html) out.push({ type: 'quote', text, html: html || undefined, author });
    } else if (node.type === 'image') {
      const { src, alt, title } = (node.attrs || {}) as Record<string, string>;
      if (src) out.push({ type: 'image', src, alt: alt || '', caption: title || '' });
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      const tag = node.type === 'orderedList' ? 'ol' : 'ul';
      const items = (node.content || [])
        .map((item: unknown) => {
          const liKids = ((item as { content?: unknown[] }).content || []) as { type?: string; content?: unknown[] }[];
          const p = liKids.find(k => k.type === 'paragraph') || liKids[0];
          return p ? `<li>${nodeToHtml(p as Parameters<typeof nodeToHtml>[0])}</li>` : '';
        })
        .join('');
      if (items) out.push({ type: 'paragraph', text: '', html: `<${tag}>${items}</${tag}>` });
    } else if (node.content) {
      (node.content as typeof node[]).forEach(walk);
    }
  }
  (doc.content || []).forEach(n => walk(n as Parameters<typeof walk>[0]));
  return out;
}
