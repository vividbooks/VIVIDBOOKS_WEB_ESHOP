/**
 * Veřejné assety stránky /aplikace (slider novinek) — sdílené pro web i email AI.
 * Absolutní URL skládá volající přes marketingSitePath / PUBLIC_SITE_URL.
 */

export type AplikaceNewsAsset = {
  kicker: string;
  title: string;
  text: string;
  /** Relativní cesta pod public/ BEZ úvodního lomítka (Deno bundler bere `/…` jako filesystem). */
  imagePath: string;
};

/** Bez leading `/` — bundler Edge Functions jinak hledá soubor na disku. */
export const APLIKACE_PAGE_PATH = 'aplikace';

/** Hero / poster na /aplikace (ne produktové obálky). */
export const APLIKACE_HERO_IMAGE_PATH = 'aplikace/hero-cards.png';

function sitePath(rel: string): string {
  return rel.startsWith('/') ? rel : `/${rel}`;
}

/** Slider „novinky“ na /aplikace — pořadí = pořadí karet na webu. */
export const APLIKACE_NEWS_ASSETS: AplikaceNewsAsset[] = [
  {
    kicker: 'Účet a přihlášení',
    title: 'Jeden účet, jedno přihlášení',
    text:
      'Konec přepínání a dvojího přihlašování. Knihovna, vaše materiály i vividboardy jsou nově pod jedním účtem Vividbooks.',
    imagePath: 'aplikace/news-01-knihovna.png',
  },
  {
    kicker: 'Vividbooks AI',
    title: 'Umělá inteligence napříč celou aplikací',
    text: 'Asistent pomůže s přípravou přímo u lekce — test, zjednodušení textu, návrh aktivity.',
    imagePath: 'aplikace/news-02-ai.png',
  },
  {
    kicker: 'Dokumenty',
    title: 'Nové jednotné zobrazení materiálů',
    text: 'Lekce, učební texty i metodiky přehledněji — čtenářský mód, kopie, sdílení, tisk.',
    imagePath: 'aplikace/news-03-dokumenty.png',
  },
  {
    kicker: 'Pracovní listy',
    title: 'Nový editor pracovních listů',
    text: 'Sestavte list z bloků — texty, obrázky, tabulky, otázky; upravit a vytisknout i se řešením.',
    imagePath: 'aplikace/news-04-pracovni-listy.png',
  },
  {
    kicker: 'Nekonečná nástěnka',
    title: 'Nekonečná nástěnka — plátno bez hranic',
    text: 'Volná plocha: text, kresby, obrázky i matematické pomůcky pro společný výklad.',
    imagePath: 'aplikace/news-05-nastenka.png',
  },
  {
    kicker: 'Vividboard',
    title: 'Promítání bez studentů a soutěžní módy',
    text: 'Promítání bez telefonů žáků, soutěžní režimy a intuitivnější editor vividboardu.',
    imagePath: 'aplikace/news-06-vividboard.png',
  },
  {
    kicker: 'Početník',
    title: 'Početník — chytré procvičování matematiky',
    text: 'Procvičování, které se přizpůsobí žákovi — do třídy, domů i do pracovního listu.',
    imagePath: 'aplikace/news-07-pocetnik.png',
  },
  {
    kicker: 'Moje třídy',
    title: 'Chystá se: Moje třídy',
    text: 'Správa tříd na jednom místě — přehled výsledků už teď, zbytek na podzim.',
    imagePath: 'aplikace/news-08-moje-tridy.png',
  },
];

/** Detekce, že uživatel chce obsah/obrázky ze stránky /aplikace (slider). */
export function promptWantsAplikaceWebAssets(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.trim()) return false;
  if (/vividbooks\.com\/aplikace|\/aplikace\b/.test(t)) return true;
  if (/(slider|slide[ru]?|novink)/i.test(t) && /aplikac/i.test(t)) return true;
  if (/obr[aá]zk.*(slider|aplikac|webu)|slider.*(obr[aá]zk|webu)/i.test(t)) return true;
  return false;
}

/**
 * Kontext pro generate-email / brief — absolutní URL obrázků ze slideru /aplikace.
 * `toAbsolute` např. (p) => marketingSitePath(p)
 */
export function buildAplikaceMarketingCtx(toAbsolute: (path: string) => string): string {
  const pageUrl = toAbsolute(sitePath(APLIKACE_PAGE_PATH));
  const heroUrl = toAbsolute(sitePath(APLIKACE_HERO_IMAGE_PATH));
  const lines = APLIKACE_NEWS_ASSETS.map(
    (a, i) =>
      `${i + 1}. **${a.kicker}** — ${a.title} | img: ${toAbsolute(sitePath(a.imagePath))} | stránka: ${pageUrl}\n   ${a.text}`,
  );
  return (
    `\n\n## Oficiální obrázky ze stránky /aplikace (slider novinek na webu)\n` +
    `Stránka: ${pageUrl}\n` +
    `Hero / karty (poster): img: ${heroUrl}\n` +
    `Když uživatel chce „obrázky ze slideru“, „z /aplikace“ nebo z URL této stránky, POUŽIJ výhradně tyto img URL ` +
    `(vlož do bodyHtml jako <img src="…"> v samostatných sekcích / kartách). ` +
    `NEPOUŽÍVEJ produktové obálky z katalogu jako náhradu za tyto screenshoty.\n` +
    lines.join('\n')
  );
}
