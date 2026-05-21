/**
 * Normalizace HTML „shrnutí webináře“ po Gemini / JSON —
 * dekóduje literální \\n zápisy a dopočítá strukturu blogového článku (<p>, nadpisy).
 */

function decodeWebinarLearningsEscapeLiterals(html: string): string {
  let s = html;
  for (let iter = 0; iter < 5; iter++) {
    const before = s;
    s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
    if (s === before) break;
  }
  return s;
}

function normalizeWebinarLearningsBlogStructure(html: string): string {
  let s = html.replace(/(>)\s*\n+\s*(?=<)/g, '$1');

  const wrapBareChunk = (chunk: string): string => {
    const t = chunk.trim();
    if (!t) return '';
    if (/^<p\b/i.test(t)) return t;
    if (/(<ul\b|<ol\b|<\/ul>|<\/ol>|<li\b|<\/li>)/i.test(t)) return t;
    const paras = t
      .split(/\n\n+/)
      .map((x) => x.trim().replace(/\n/g, ' ').trim())
      .filter(Boolean)
      .map((x) => `<p>${x}</p>`)
      .join('');
    return paras || `<p>${t}</p>`;
  };

  s = s.replace(
    /(<\/(?:h2|h3)>)(\s*)((?:(?!<(?:h2|h3|ul|ol)\b)[\s\S])*?)(?=\s*<(?:h2|h3|ul|ol)\b|\s*$)/gi,
    (_, close: string, _ws: string, chunk: string) => close + wrapBareChunk(chunk),
  );

  return s;
}

export function sanitizeWebinarLearningsHtml(raw: string): string {
  let s = decodeWebinarLearningsEscapeLiterals(String(raw || '').trim());
  if (!s) return '';
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  s = s.replace(/javascript:/gi, '');
  s = normalizeWebinarLearningsBlogStructure(s);
  return s.slice(0, 120_000);
}
