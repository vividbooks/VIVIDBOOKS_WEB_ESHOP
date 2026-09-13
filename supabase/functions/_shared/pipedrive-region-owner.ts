/**
 * Kraj → obchodník (Pipedrive `user_id`) pro dealy zakládané e-shopem.
 *
 * Proč to tu vůbec je: dokud webové trialy zakládal scénář Make, řešil vlastníka
 * kaskádou `distributor → kraj z adresy organizace → vlastník posledního
 * prohraného dealu → Dan`. Prostřední krok e-shop neměl, protože vlastník byl
 * dřív jen otázka „komu to spadne do fronty". Teď rozhoduje o víc: automatizace
 * „Trial CTA 01" **není jedna centrální** — každý obchodník má v Pipedrive svou
 * vlastní kopii nastavenou na sebe, takže první e-mail zákazníkovi odchází ze
 * schránky vlastníka dealu. Špatný vlastník = e-mail od cizího člověka, žádný
 * vlastník = žádný e-mail.
 *
 * Zdroj dat: Make datastore 17499 („Regions", 40 řádků), staženo 12. 9. 2026.
 * **Autoritativní je ID, ne jméno.** Datastore u Středočeského, Královéhradeckého
 * a Pardubického kraje uvádí jméno „Iveta Fišerová", ale ID 18026774 patří
 * Gabriele Švédové — jména v něm zůstala po starším rozdělení. Přebírám proto
 * čísla a jména píšu podle skutečnosti.
 *
 * Čistý modul bez závislostí — importuje ho edge funkce i unit testy.
 */

/** Pipedrive user_id obchodníků, na které kraje míří. */
export const PIPEDRIVE_SALES_USER_IDS = {
  danielOndrasek: 11629944,
  gabrielaSvedova: 18026774,
  ivetaFiserova: 12795779,
  evaBukolska: 14063023,
  jiriPabian: 12116814,
  eduardMalachovsky: 12797715,
  felicitasDominguez: 15386499,
} as const;

const {
  danielOndrasek,
  gabrielaSvedova,
  ivetaFiserova,
  evaBukolska,
  jiriPabian,
  eduardMalachovsky,
  felicitasDominguez,
} = PIPEDRIVE_SALES_USER_IDS;

/**
 * Klíč je název kraje **před normalizací** — čitelný, ať je vidět, co se mapuje.
 * Vyhledává se přes `normalizeRegionKey()`, takže „Praha", „Hlavní město Praha"
 * i „hlavni mesto praha" trefí stejný řádek.
 */
const REGION_OWNERS: Array<[string, number]> = [
  // ── Česko ──────────────────────────────────────────────────────────────
  ['Hlavní město Praha', ivetaFiserova],
  ['Středočeský kraj', gabrielaSvedova],
  ['Ústecký kraj', ivetaFiserova],
  ['Královéhradecký kraj', gabrielaSvedova],
  ['Pardubický kraj', gabrielaSvedova],
  ['Jihočeský kraj', jiriPabian],
  ['Plzeňský kraj', gabrielaSvedova],
  ['Karlovarský kraj', gabrielaSvedova],
  ['Liberecký kraj', gabrielaSvedova],
  ['Kraj Vysočina', jiriPabian],
  ['Jihomoravský kraj', evaBukolska],
  ['Olomoucký kraj', evaBukolska],
  ['Zlínský kraj', evaBukolska],
  ['Moravskoslezský kraj', evaBukolska],
  // ── Slovensko ──────────────────────────────────────────────────────────
  ['Bratislavský kraj', eduardMalachovsky],
  ['Trnavský kraj', eduardMalachovsky],
  ['Nitrianský kraj', eduardMalachovsky],
  ['Trenčianský kraj', eduardMalachovsky],
  ['Žilinský kraj', eduardMalachovsky],
  ['Banskobystrický kraj', eduardMalachovsky],
  ['Košický kraj', eduardMalachovsky],
  ['Prešovský kraj', eduardMalachovsky],
  /** Neurčené Slovensko je v datastore na Danielovi — tedy „zatím nepřiděleno".
   *  Přesměrování vlastníků (`PIPEDRIVE_OWNER_REDIRECTS`) ho pošle dál. */
  ['Slovensko', danielOndrasek],
  // ── Španělsko ──────────────────────────────────────────────────────────
  ['Andalucía', felicitasDominguez],
  ['Aragón', felicitasDominguez],
  ['Principado de Asturias', felicitasDominguez],
  ['Baleares', felicitasDominguez],
  ['Canarias', felicitasDominguez],
  ['Cantabria', felicitasDominguez],
  ['Castilla y León', felicitasDominguez],
  ['Castilla-La Mancha', felicitasDominguez],
  ['Cataluña', felicitasDominguez],
  ['Extremadura', felicitasDominguez],
  ['Galicia', felicitasDominguez],
  ['La Rioja', felicitasDominguez],
  ['Comunidad de Madrid', felicitasDominguez],
  ['Región de Murcia', felicitasDominguez],
  ['Navarra', felicitasDominguez],
  ['País Vasco', felicitasDominguez],
  ['Comunidad Valenciana', felicitasDominguez],
];

/**
 * Srovná zápis kraje na společný tvar. Zdroje se liší: `skoly.csv` má
 * „Jihomoravský kraj", Pipedrive adresa vrací `admin_area_level_1` jako
 * „Jihomoravský kraj" i „Praha", ARES „Hlavní město Praha", ruční zadání
 * cokoli mezi tím.
 *
 * Odstraňuje diakritiku, sjednocuje mezery a **zahazuje slova, která nic
 * nerozlišují** — „kraj" a „hlavní město". Zbytek je nositel významu:
 * „Kraj Vysočina" i „Vysočina" končí jako `vysocina`.
 */
export function normalizeRegionKey(region: unknown): string {
  return String(region ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(kraj|hlavni|mesto|region|regionu|provincia|comunidad|principado)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const REGION_OWNER_BY_KEY: Map<string, number> = new Map(
  REGION_OWNERS.map(([name, userId]) => [normalizeRegionKey(name), userId]),
);

/**
 * Vrátí `user_id` obchodníka pro daný kraj, nebo `null`, když kraj neznáme
 * (prázdná hodnota, cizí země, překlep). `null` znamená „rozhodni jinak" —
 * volající pokračuje dalším krokem kaskády, nikdy nepadá na náhodného člověka.
 */
export function resolveRegionOwnerUserId(region: unknown): number | null {
  const key = normalizeRegionKey(region);
  if (!key) return null;
  return REGION_OWNER_BY_KEY.get(key) ?? null;
}

/** Kolik krajů mapa zná — hlídá v testech, že se řádek nevytratil. */
export const PIPEDRIVE_REGION_COUNT = REGION_OWNER_BY_KEY.size;
