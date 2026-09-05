/**
 * Párování webináře na záznam v katalogu `dvpp-videos` — jedno místo pro Edge funkci,
 * admin (`WebinaryPastPanel`), veřejnou stránku webináře i automatiku záznamů.
 *
 * Historie: dřív existovaly čtyři kopie stejné heuristiky „shoda na prvních 70 % názvu“.
 * Ta 4. 9. 2026 poslala účastníkům webináře „Jak nadchnout žáky pro matematiku na 1. stupni?“
 * odkaz na záznam 2. stupně — jediná odlišná číslice leží až za porovnávaným prefixem.
 * Proto tu fuzzy větev drží dvě pojistky: čísla v názvu musí sedět a při víc kandidátech
 * vyhrává ten nejpodobnější (při remíze se nepáruje nic).
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

/** Původní heuristika: názvy si sednou na prvních ~70 % délky toho druhého. */
function prefixOverlaps(wTitle: string, vTitle: string): boolean {
  if (wTitle.length <= 5 || vTitle.length === 0) return false;
  return (
    vTitle.includes(wTitle.slice(0, Math.floor(wTitle.length * 0.7))) ||
    wTitle.includes(vTitle.slice(0, Math.floor(vTitle.length * 0.7)))
  );
}

/**
 * Který záznam patří k webináři. `null` = „záznam ještě neexistuje“, což je platný stav —
 * volající si buď postaví položku katalogu z webináře (`mergePastWebinarsIntoDvppVideos`),
 * nebo použije `webinar.id` jako id stránky záznamu.
 *
 * Pořadí: přesná shoda slugu/id, pak fuzzy podle názvu. Fuzzy nikdy nespáruje záznamy,
 * které se liší čísly v názvu, a při víc rovnocenných kandidátech radši nevrátí nic —
 * špatný odkaz v rozeslaném e-mailu je horší než žádné párování.
 */
export function matchDvppVideoForWebinar<T extends DvppVideoLike>(
  webinar: WebinarLike,
  dvppVideos: T[] | null | undefined,
): T | null {
  const videos = Array.isArray(dvppVideos) ? dvppVideos : [];
  if (videos.length === 0) return null;

  const wSlug = normDvppMatchText(webinar?.slug ?? webinar?.id ?? '');
  const bySlug = videos.find((v) => normDvppMatchText(v?.slug ?? v?.id ?? '') === wSlug);
  if (bySlug) return bySlug;

  const wTitleRaw = String(webinar?.title ?? '');
  const wTitle = normDvppMatchText(wTitleRaw);
  const wNumbers = numericFingerprint(wTitleRaw);

  let best: T | null = null;
  let bestScore = -1;
  let bestAmbiguous = false;

  for (const v of videos) {
    const vTitleRaw = String(v?.name ?? v?.title ?? '');
    if (numericFingerprint(vTitleRaw) !== wNumbers) continue;
    const vTitle = normDvppMatchText(vTitleRaw);
    if (!prefixOverlaps(wTitle, vTitle)) continue;

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
