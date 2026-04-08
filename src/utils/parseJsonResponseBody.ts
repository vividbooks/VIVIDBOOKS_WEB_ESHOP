/**
 * Parsování těla odpovědi z Edge funkcí — některé proxy občas připojí `true`/`false`/`null` před JSON,
 * nebo jiný text před prvním `{` / `[`. Nikdy nevyhazuje — při neúspěchu vrátí `null`.
 */
export function parseJsonResponseBody(text: string): unknown {
  const strippedBom = text.replace(/\uFEFF/g, '').trim();
  if (!strippedBom) return null;
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  const direct = tryParse(strippedBom);
  if (direct !== undefined) return direct;

  let candidate = strippedBom;
  for (let s = 0; s < 8; s++) {
    const m = candidate.match(/^(true|false|null)\b\s*(?:,\s*)?/i);
    if (!m) break;
    candidate = candidate.slice(m[0].length).trim();
    const after = tryParse(candidate);
    if (after !== undefined) return after;
  }

  const objStart = candidate.indexOf('{');
  const arrStart = candidate.indexOf('[');
  let start = -1;
  if (objStart >= 0 && arrStart >= 0) start = Math.min(objStart, arrStart);
  else if (objStart >= 0) start = objStart;
  else if (arrStart >= 0) start = arrStart;

  if (start > 0) {
    const slice = candidate.slice(start);
    const fromBrace = tryParse(slice);
    if (fromBrace !== undefined) return fromBrace;
  }
  return null;
}
