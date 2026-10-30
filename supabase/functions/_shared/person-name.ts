/**
 * Jméno a příjmení zákazníka / příjemce zásilky — jedno místo pro pokladnu, školní
 * a distributorskou objednávku, Edge funkce pokladny i kontrolu před exportem do Base.com.
 *
 * Fulfilment (a přes něj dopravce) odmítne zásilku, když `delivery_fullname` není celé jméno
 * a příjmení osoby („Jana“, „kabinet fyziky“, název školy). Objednávka pak skončí v Base ve stavu
 * Error FF a musí se opravovat ručně — proto to kontrolujeme už ve formuláři.
 */

export const FULL_NAME_MAX_LENGTH = 100;

export const FULL_NAME_HINT =
  'Uveďte celé jméno a příjmení (např. Jana Nováková). Dopravce ho potřebuje na štítek zásilky.';

export const FULL_NAME_INSTITUTION_HINT =
  'Uveďte jméno a příjmení konkrétní osoby, ne název školy nebo kabinetu. Kabinet nebo místnost napište do poznámky.';

export type FullNameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Tituly psané bez tečky („Mgr Jana“) — tokeny s tečkou na konci se zahazují obecně. */
const ACADEMIC_TITLES = new Set([
  'bc', 'mgr', 'ing', 'ingarch', 'mudr', 'mddr', 'mvdr', 'judr', 'phdr', 'paeddr', 'rndr', 'thdr',
  'pharmdr', 'phmr', 'doc', 'prof', 'dr', 'phd', 'csc', 'drsc', 'dis', 'mba', 'msc', 'bsc',
]);

/** Slova, která patří do názvu instituce, ne do jména osoby (porovnává se bez teček, malými písmeny). */
const INSTITUTION_WORDS = new Set([
  'škola', 'skola', 'školy', 'skoly', 'zš', 'mš', 'sš', 'spš', 'zuš', 'gymnázium', 'gymnazium',
  'kabinet', 'kabinetu', 'sborovna', 'sborovny', 'ředitelna', 'reditelna', 'ředitelství', 'reditelstvi',
  'sekretariát', 'sekretariat', 'kancelář', 'kancelar', 'učebna', 'ucebna', 'knihovna', 'oddělení',
  'oddeleni', 'sro', 'spol',
]);

export function normalizePersonName(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

export function checkFullName(raw: unknown, options: { emptyError?: string } = {}): FullNameCheck {
  const name = normalizePersonName(raw);
  if (!name) return { ok: false, error: options.emptyError ?? 'Vyplňte jméno a příjmení.' };
  if (name.length > FULL_NAME_MAX_LENGTH) {
    return { ok: false, error: `Jméno a příjmení může mít nejvýš ${FULL_NAME_MAX_LENGTH} znaků.` };
  }

  const tokens = name.split(/[\s,]+/).filter(Boolean);
  if (tokens.some((token) => INSTITUTION_WORDS.has(token.toLowerCase().replace(/\./g, '')))) {
    return { ok: false, error: FULL_NAME_INSTITUTION_HINT };
  }
  if (!/^[\p{L}\p{M}\s.,'’-]+$/u.test(name)) return { ok: false, error: FULL_NAME_HINT };

  const nameParts = tokens
    .filter((token) => !token.endsWith('.') && !ACADEMIC_TITLES.has(token.toLowerCase().replace(/\./g, '')))
    .filter((token) => (token.match(/\p{L}/gu) ?? []).length >= 2)
    .map((token) => token.toLowerCase());
  if (new Set(nameParts).size < 2) return { ok: false, error: FULL_NAME_HINT };

  return { ok: true, name };
}

export function isValidFullName(raw: unknown): boolean {
  return checkFullName(raw).ok;
}
