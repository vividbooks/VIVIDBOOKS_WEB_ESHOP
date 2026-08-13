/**
 * Oprava pravopisu/gramatiky v celém mailu — jen textové uzly, HTML struktura a fotky beze změny.
 */

export type ProofreadSegment = { id: string; text: string };

const SKIP_CLOSEST = 'script,style,noscript,[data-vb-col-chooser],[data-vb-col-placeholder]';

/** Uživatel chce projít celý mail jen kvůli chybám (ne přepsat obsah). */
export function promptLooksLikeWholeEmailProofread(msg: string): boolean {
  const m = String(msg || '').trim();
  if (!m) return false;
  if (/přegeneruj|pregeneruj|přepiš\s+cel[ýy]|prepis\s+cel|smaž\s+fot|smaz\s+fot|nový\s+mail|novy\s+mail/i.test(m)) {
    return false;
  }
  return (
    /pravopis|gramatik|pře?klep|preklep/i.test(m) ||
    /oprav(it)?\s+(jen\s+)?(chyby|pravopis|gramatik)/i.test(m) ||
    /hledej\s+(jen\s+)?chyby/i.test(m) ||
    /projdi.*(mail|email|tělo|telo).*(chyby|pravopis|gramatik)/i.test(m) ||
    /.*(chyby|pravopis|gramatik).*(mail|email)/i.test(m)
  );
}

function acceptProofreadTextNode(node: Node): number {
  if (node.nodeType !== Node.TEXT_NODE) return NodeFilter.FILTER_REJECT;
  const text = node.textContent || '';
  if (!text.trim()) return NodeFilter.FILTER_REJECT;
  const parent = node.parentElement;
  if (!parent) return NodeFilter.FILTER_REJECT;
  if (parent.closest(SKIP_CLOSEST)) return NodeFilter.FILTER_REJECT;
  // Neopravuj samotné URL / e-maily bez mezer (často src okolí nebo čistý odkaz)
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed) && !/\s/.test(trimmed)) return NodeFilter.FILTER_REJECT;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_ACCEPT;
}

/**
 * Sesbírá textové uzly z těla mailu. Vrací i živé `Text` uzly pro pozdější zápis.
 */
export function collectProofreadSegments(root: HTMLElement): {
  segments: ProofreadSegment[];
  nodes: Text[];
} {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: acceptProofreadTextNode,
  });
  const segments: ProofreadSegment[] = [];
  const nodes: Text[] = [];
  let n = walker.nextNode();
  let i = 0;
  while (n) {
    const text = n.textContent || '';
    if (text.trim()) {
      const id = `t${i++}`;
      segments.push({ id, text });
      nodes.push(n as Text);
    }
    n = walker.nextNode();
  }
  return { segments, nodes };
}

function stripAccidentalHtml(s: string): string {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]{0,200}>/g, '')
    .replace(/\u0000/g, '');
}

/** Příliš agresivní přepis → radši nechat originál. */
function correctionLooksSafe(original: string, next: string): boolean {
  const a = original.trim();
  const b = next.trim();
  if (!b && a) return false;
  if (b === a) return true;
  // Nesmí být o řád delší (přepis stylu)
  if (b.length > Math.max(40, Math.ceil(a.length * 1.35) + 12)) return false;
  if (b.length < Math.max(1, Math.floor(a.length * 0.45) - 8) && a.length > 24) return false;
  // Nesmí obsahovat HTML
  if (/<[a-z][\s\S]*>/i.test(b)) return false;
  return true;
}

/**
 * Aplikuje opravy na živé textové uzly. Vrací počet skutečně změněných úseků.
 */
export function applyProofreadCorrections(
  nodes: Text[],
  segments: ProofreadSegment[],
  corrections: ProofreadSegment[],
): { changed: number; skipped: number } {
  const byId = new Map(corrections.map((c) => [c.id, stripAccidentalHtml(c.text)]));
  let changed = 0;
  let skipped = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const node = nodes[i];
    if (!node || !seg) continue;
    const next = byId.get(seg.id);
    if (next == null) {
      skipped++;
      continue;
    }
    if (next === seg.text) continue;
    if (!correctionLooksSafe(seg.text, next)) {
      skipped++;
      continue;
    }
    // Zachovej případné okrajové mezery z originálu, pokud AI trimnula
    let out = next;
    if (/^\s/.test(seg.text) && !/^\s/.test(out)) out = seg.text.match(/^\s*/)?.[0] + out;
    if (/\s$/.test(seg.text) && !/\s$/.test(out)) out = out + (seg.text.match(/\s*$/)?.[0] || '');
    if (out !== node.textContent) {
      node.textContent = out;
      changed++;
    }
  }
  return { changed, skipped };
}

export function chunkProofreadSegments<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 28);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
