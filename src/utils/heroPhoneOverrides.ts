/** Rozdíl polí hero položky (CMS) mezi desktop a mobilní variantou — bez `id` / `order`. */
export function diffHeroPayloads(
  base: Record<string, unknown>,
  merged: Record<string, unknown>,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(merged)]);
  for (const k of keys) {
    if (k === 'id' || k === 'order') continue;
    if (JSON.stringify(base[k]) !== JSON.stringify(merged[k])) diff[k] = merged[k];
  }
  return diff;
}

export function parseHeroPhoneDiff(raw: unknown): Record<string, unknown> {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  try {
    const j = JSON.parse(String(raw));
    return typeof j === 'object' && j != null && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
