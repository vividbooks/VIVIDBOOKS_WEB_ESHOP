/**
 * Jeden blok textu z administrace (Předměty → Hero text).
 * Prázdný řádek odděluje podtržený nadpis od textu po rozkliknutí.
 * Bez dvojitého odřádkování: první řádek = nadpis, zbytek = tělo.
 */
export function parseHeroText(raw: string): { heading: string; body: string } {
  const t = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return { heading: '', body: '' };
  const double = t.indexOf('\n\n');
  if (double !== -1) {
    return {
      heading: t.slice(0, double).trim(),
      body: t.slice(double + 2).trim(),
    };
  }
  const firstNl = t.indexOf('\n');
  if (firstNl === -1) {
    return { heading: t, body: '' };
  }
  return {
    heading: t.slice(0, firstNl).trim(),
    body: t.slice(firstNl + 1).trim(),
  };
}
