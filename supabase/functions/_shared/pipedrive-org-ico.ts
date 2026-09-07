/**
 * Párování organizací v Pipedrive podle IČO (org pole „CIN", ID 4033).
 *
 * Cíl: **nikdy nezaložit druhou organizaci pro školu, kterou už v CRM máme.**
 * Audit produkčních dat (1 300 nejnovějších organizací, 10/2024–09/2026) ukázal
 * čtyři zdroje duplicit, které tenhle modul řeší:
 *
 *   1. **Formát IČO.** V CRM leží hodnoty jako `CZ45238782`, `0`, `9999`,
 *      `1981`, `Jana Krocova`. Vyhledávání `GET /organizations/search?term=45238782`
 *      takovou organizaci nenajde → vznikne duplicita. → `normalizePipedriveIco`.
 *   2. **Překlepy v IČO.** Dvojice `#39879 ZŠ U Červených domků Hodonín` (41498835)
 *      a `#39912` (49418835) — obě hodnoty mají **neplatný kontrolní součet**,
 *      jde o přehozené číslice. Stejně `#39845`/`#39848` (62990361 / 62390661).
 *      Když IČO neprojde mod‑11, nesmí být bráno jako autoritativní identifikátor.
 *      → `isValidCzechIco`.
 *   3. **Chybějící CIN u existující organizace.** Většina starší báze CIN nemá.
 *      Při `strictIcoMatch` se dřív hledalo jen podle IČO, a když se netrefilo,
 *      rovnou se zakládala nová organizace — i když stejnojmenná už existovala.
 *      → `canReuseOrgMatchedByName` (převezmi ji a CIN jí doplň).
 *   4. **Zpoždění vyhledávacího indexu.** `#39822` a `#39823` — identický název
 *      i identický CIN `01228251`, obojí založené 24. 6. 2026. Druhý request
 *      organizaci od prvního přes `/organizations/search` ještě neviděl.
 *      → řeší trvalý rejstřík IČO → orgId (`pipedriveOrgRegistry.ts`), tenhle
 *      modul k němu dodává klíč (`pipedriveOrgIcoRegistryKey`).
 *
 * Modul je čistý (bez síťových volání), aby šel pokrýt unit testy.
 */

/** Zjevně neidentifikující výplň, kterou uživatelé píší do pole IČO. */
const PLACEHOLDER_ICO_VALUES = new Set(['0', '00', '000', '0000', '00000', '000000', '0000000', '00000000', '9999', '999999999', '1234567890']);

/**
 * Sjednotí zápis IČO na porovnatelný tvar: odstraní diakritiku okolního textu,
 * mezery a interpunkci, shodí prefix DIČ (`CZ`/`SK`) a nechá jen číslice.
 *
 * Vrací `''` pro prázdný vstup, pro hodnoty bez číslic (`„Doplň IČO"`,
 * `„zanetasaldova@gmail.com"`) i pro zjevné výplně (`0`, `9999`) — volající
 * je pak zpracuje stejně jako „IČO nezadáno" a nezaloží podle nich organizaci.
 */
export function normalizePipedriveIco(raw: unknown): string {
  const text = String(raw ?? '').trim().toUpperCase();
  if (!text) return '';
  /** `CZ45238782` (DIČ v poli IČO) → `45238782`; jinak by se search nikdy netrefil. */
  const withoutVatPrefix = text.replace(/^(CZ|SK)\s*(?=\d)/, '');
  const digits = withoutVatPrefix.replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  if (PLACEHOLDER_ICO_VALUES.has(digits)) return '';
  if (/^0+$/.test(digits)) return '';
  return digits;
}

/**
 * Kontrolní součet českého/slovenského IČO (mod 11, váhy 8…2).
 *
 * Používá se jako **míra důvěry**, ne jako validace formuláře: IČO s platným
 * součtem smí rozhodnout „tohle je jiná škola, založ novou organizaci“,
 * IČO s neplatným (překlep) tuhle pravomoc nemá a musí ustoupit shodě podle názvu.
 */
export function isValidCzechIco(raw: unknown): boolean {
  const ico = normalizePipedriveIco(raw);
  if (!/^\d{8}$/.test(ico)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i += 1) sum += Number(ico[i]) * (8 - i);
  const rest = sum % 11;
  const check = rest === 0 ? 1 : rest === 1 ? 0 : 11 - rest;
  return check === Number(ico[7]);
}

/**
 * Termy, kterými se zkusí dohledat organizace podle IČO.
 *
 * Kromě normalizované hodnoty i varianta doplněná nulami na 8 číslic — IČO
 * s vedoucí nulou (`01228251`) lidé i importy běžně zapisují bez ní (`1228251`)
 * a Pipedrive search je porovnává jako různé řetězce.
 */
export function pipedriveIcoSearchTerms(raw: unknown): string[] {
  const ico = normalizePipedriveIco(raw);
  if (!ico) return [];
  const terms = [ico];
  if (ico.length < 8) terms.push(ico.padStart(8, '0'));
  else if (ico.length === 8 && ico.startsWith('0')) terms.push(ico.replace(/^0+/, ''));
  return [...new Set(terms.filter(Boolean))];
}

/** Shoda dvou IČO nezávisle na zápisu (`CZ45238782` == `45238782`, `1228251` == `01228251`). */
export function icoValuesMatch(a: unknown, b: unknown): boolean {
  const left = normalizePipedriveIco(a);
  const right = normalizePipedriveIco(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.padStart(8, '0') === right.padStart(8, '0');
}

/**
 * Z kandidátů vrácených `/organizations/search` vybere ten, jehož pole CIN
 * **opravdu** odpovídá hledanému IČO.
 *
 * Bez téhle kontroly stačilo, aby se číslo trefilo do jiného textového pole
 * organizace (RED IZO, poznámka, telefon), a objednávka se přilepila k cizí škole.
 * Kandidáti bez načteného CIN se nezahazují — vrátí se v `unverified`, aby si je
 * volající mohl ověřit přes `GET /organizations/{id}`.
 */
export function pickPipedriveOrgMatchedByIco(
  candidates: Array<{ id?: unknown; icoValue?: unknown }>,
  ico: unknown,
): { matched: { id?: unknown; icoValue?: unknown } | null; unverified: Array<{ id?: unknown; icoValue?: unknown }> } {
  const wanted = normalizePipedriveIco(ico);
  if (!wanted) return { matched: null, unverified: [] };
  const unverified: Array<{ id?: unknown; icoValue?: unknown }> = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (icoValuesMatch(candidate?.icoValue, wanted)) return { matched: candidate, unverified: [] };
    if (candidate?.icoValue === undefined || candidate?.icoValue === null || String(candidate.icoValue).trim() === '') {
      unverified.push(candidate);
    }
  }
  return { matched: null, unverified };
}

/**
 * Smí se organizace nalezená **podle názvu** použít pro objednávku s tímhle IČO?
 *
 * - CIN organizace prázdný → ano; je to tatáž škola, jen jí IČO v CRM chybí
 *   (většina starší báze) — volající ho do organizace doplní.
 * - CIN se shoduje → ano.
 * - CIN se liší, ale **naše** IČO má neplatný kontrolní součet → ano; překlep
 *   ve formuláři nesmí založit druhou organizaci stejné školy.
 * - CIN se liší a obě IČO jsou platná → ne; jsou to opravdu dvě různé
 *   organizace se shodným názvem (`Základní škola, Skuteč, Komenského 150`).
 */
export function canReuseOrgMatchedByName(orgIcoValue: unknown, ico: unknown): boolean {
  const wanted = normalizePipedriveIco(ico);
  const existing = normalizePipedriveIco(orgIcoValue);
  if (!wanted) return true;
  if (!existing) return true;
  if (icoValuesMatch(existing, wanted)) return true;
  return !isValidCzechIco(wanted);
}

/** Má se do organizace zapsat IČO z formuláře? Jen když tam žádné použitelné není. */
export function shouldWriteIcoToOrg(orgIcoValue: unknown, ico: unknown): boolean {
  const wanted = normalizePipedriveIco(ico);
  if (!wanted) return false;
  return !normalizePipedriveIco(orgIcoValue);
}

/** Klíč trvalého rejstříku IČO → orgId (KV), který přemostí zpoždění search indexu. */
export function pipedriveOrgIcoRegistryKey(ico: unknown): string | null {
  const normalized = normalizePipedriveIco(ico);
  if (!normalized) return null;
  return `pipedrive_org_by_ico_${normalized.padStart(8, '0')}`;
}
