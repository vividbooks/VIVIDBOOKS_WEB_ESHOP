/**
 * Česká typografie: jednopísmenné předložky/spojky (a, v, s, z, k, u, o, i) + číslo
 * nesmí viset na konci řádku — za ně dáme pevnou mezeru k následujícímu slovu.
 */
export function formatTypography(text: string): string {
  if (!text) return '';
  return text
    .replace(/(\b[vszkuoia])\s+/gi, '$1\u00A0')
    .replace(/(\d+\.?)\s+/g, '$1\u00A0');
}
