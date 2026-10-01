/**
 * Párování webináře na záznam v katalogu `dvpp-videos` — jedno místo pro Edge funkci,
 * admin (`WebinaryPastPanel`), veřejnou stránku webináře i automatiku záznamů.
 *
 * Historie: dřív existovaly čtyři kopie stejné heuristiky „shoda na prvních 70 % názvu“.
 * Ta 4. 9. 2026 poslala účastníkům webináře „Jak nadchnout žáky pro matematiku na 1. stupni?“
 * odkaz na záznam 2. stupně — jediná odlišná číslice leží až za porovnávaným prefixem.
 * Proto tu fuzzy větev drží dvě pojistky: čísla v názvu musí sedět a při víc kandidátech
 * vyhrává ten nejpodobnější (při remíze se nepáruje nic).
 *
 * 16.–18. 9. 2026 to samé bez číslice: „Jak nadchnout žáky pro prvouku?“ a „…pro chemii?“
 * se spárovaly na záznam fyziky, protože jediné odlišné slovo je až za 70% hranicí.
 * Uložení v adminu pak záznam fyziky dvakrát přepsalo a tři rozesílky ukazovaly na jedno id.
 * Fuzzy proto už neporovnává prefix, ale slova: po odstranění výplně („webinář“, „záznam“,
 * „DVPP“) a koncovek musí být slova jednoho názvu podmnožinou druhého. Slovo nahrazené jiným
 * párování zablokuje — chybějící záznam je platný stav, špatný odkaz v rozeslaném mailu ne.
 */

export interface DvppVideoLike {
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  title?: unknown;
}

export interface WebinarLike {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
}

/** Diakritika, mezery a interpunkce pryč — porovnává se holý řetězec písmen a číslic. */
export function normDvppMatchText(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Čísla z názvu jako otisk — „1. stupeň“ vs „2. stupeň“, „7. ročník“ vs „8. ročník“.
 * Právě tahle informace se ztrácela v prefixové shodě, protože číslice bývá až na konci názvu.
 */
function numericFingerprint(raw: unknown): string {
  const digits = String(raw ?? '').match(/\d+/g) ?? [];
  return digits.map((d) => String(Number(d))).sort().join(',');
}

/** Dice koeficient nad bigramy — 1 = shodné, 0 = nic společného. */
function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const aa = bigrams(a);
  const bb = bigrams(b);
  let shared = 0;
  for (const [g, count] of aa) {
    const other = bb.get(g);
    if (other) shared += Math.min(count, other);
  }
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

/**
 * Slova, která název záznamu mívá navíc oproti názvu webináře („Webinář: …“, „… – záznam“).
 * Nic z toho nenese význam, který by odlišil dva webináře.
 */
const DVPP_MATCH_FILLER_WORDS = new Set(['webinar', 'webinare', 'webinaru', 'zaznam', 'zaznamu', 'dvpp']);

/**
 * Koncovky, kterými se liší tvary téhož slova v názvech („Vividboardem“ / „Vividboard“,
 * „matematiky“ / „matematika“, „ročník“ / „ročníku“). Odřezávají se jen tehdy, když zbude
 * aspoň tříznakový kmen. Různé předměty se tím nesplynou: prvouk ≠ chemi ≠ fyzik.
 */
const DVPP_MATCH_WORD_ENDINGS = ['ami', 'emi', 'ech', 'ich', 'ych', 'ovi', 'ove', 'em', 'um', 'ou', 'ym', 'im', 'am', 'a', 'e', 'i', 'o', 'u', 'y'];

function dvppMatchWordStem(word: string): string {
  for (const ending of DVPP_MATCH_WORD_ENDINGS) {
    if (word.length - ending.length >= 3 && word.endsWith(ending)) return word.slice(0, -ending.length);
  }
  return word;
}

/** Kmeny slov názvu bez diakritiky a bez výplně — množina, kterou jde porovnat na podmnožinu. */
export function dvppMatchWordStems(raw: unknown): Set<string> {
  const stems = new Set<string>();
  for (const word of String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)) {
    if (!word || DVPP_MATCH_FILLER_WORDS.has(word)) continue;
    stems.add(dvppMatchWordStem(word));
  }
  return stems;
}

/**
 * Názvy si odpovídají, když slova jednoho jsou podmnožinou slov druhého. Delší název smí mít
 * slova navíc („Úvod do Vividbooks v listopadu“ → „Úvod do Vividbooks“, „Tomáš Kováč: Jak se
 * stát…“ → „Jak se stát…“), ale žádné slovo nesmí být nahrazeno jiným — „pro prvouku“ a
 * „pro chemii“ mají každé své slovo, které tomu druhému chybí.
 */
export function dvppMatchWordsNested(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const stem of small) if (!large.has(stem)) return false;
  return true;
}

/**
 * Který záznam patří k webináři. `null` = „záznam ještě neexistuje“, což je platný stav —
 * volající si buď postaví položku katalogu z webináře (`mergePastWebinarsIntoDvppVideos`),
 * nebo použije `webinar.id` jako id stránky záznamu.
 *
 * Pořadí: přesná shoda id, přesná shoda slugu, pak podle názvu. Id má přednost před slugem,
 * protože slug záznamu se dá v adminu přepsat (přesně to se stalo 16. 9. 2026), kdežto id
 * záznamu vzniklého z webináře je webinar.id napořád. Podle názvu se páruje jen při stejných
 * číslech a vnořených množinách slov; při víc rovnocenných kandidátech se radši nevrátí nic —
 * špatný odkaz v rozeslaném e-mailu je horší než žádné párování.
 */
export function matchDvppVideoForWebinar<T extends DvppVideoLike>(
  webinar: WebinarLike,
  dvppVideos: T[] | null | undefined,
): T | null {
  const videos = Array.isArray(dvppVideos) ? dvppVideos : [];
  if (videos.length === 0) return null;

  const wId = String(webinar?.id ?? '').trim();
  if (wId) {
    const byId = videos.find((v) => String(v?.id ?? '').trim() === wId);
    if (byId) return byId;
  }

  const wSlug = normDvppMatchText(webinar?.slug ?? webinar?.id ?? '');
  if (wSlug) {
    const bySlug = videos.find((v) => normDvppMatchText(v?.slug ?? v?.id ?? '') === wSlug);
    if (bySlug) return bySlug;
  }

  const wTitleRaw = String(webinar?.title ?? '');
  const wTitle = normDvppMatchText(wTitleRaw);
  const wWords = dvppMatchWordStems(wTitleRaw);
  if (wWords.size === 0) return null;
  const wNumbers = numericFingerprint(wTitleRaw);

  let best: T | null = null;
  let bestScore = -1;
  let bestAmbiguous = false;

  for (const v of videos) {
    const vTitleRaw = String(v?.name ?? v?.title ?? '');
    if (numericFingerprint(vTitleRaw) !== wNumbers) continue;
    if (!dvppMatchWordsNested(wWords, dvppMatchWordStems(vTitleRaw))) continue;
    const vTitle = normDvppMatchText(vTitleRaw);

    const score = bigramSimilarity(wTitle, vTitle);
    if (score > bestScore) {
      best = v;
      bestScore = score;
      bestAmbiguous = false;
    } else if (score === bestScore && String(v?.id ?? '') !== String(best?.id ?? '')) {
      bestAmbiguous = true;
    }
  }

  if (bestAmbiguous) return null;
  return best;
}

/** Id spárovaného záznamu, nebo `null`. */
export function findExistingDvppVideoIdForWebinarInCatalog(
  webinar: WebinarLike,
  dvppVideos: DvppVideoLike[] | null | undefined,
): string | null {
  const matched = matchDvppVideoForWebinar(webinar, dvppVideos);
  const id = matched?.id != null ? String(matched.id).trim() : '';
  return id || null;
}
