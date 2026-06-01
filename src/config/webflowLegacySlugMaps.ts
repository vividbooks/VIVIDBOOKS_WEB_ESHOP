/**
 * Mapování legacy Webflow URL → konkrétní novinky / blog / nový e-shop.
 * Po migraci obsahu v administraci lze hodnoty upřesnit.
 */

export type LegacyLinkResolution =
  | { kind: 'internal'; path: string }
  | { kind: 'external'; url: string };

/** Konkrétní cíle pro staré zkrácené odkazy vividbooks.com/links/… */
export const LEGACY_SHORT_LINK_TARGETS: Record<string, LegacyLinkResolution> = {
  '/links/nechte-nam-kontakt': { kind: 'internal', path: '/kontakt' },
  '/links/hledame-partnera': { kind: 'internal', path: '/kontakt' },
  '/links/skoleni-matematika': { kind: 'internal', path: '/webinare' },
  '/links/letni-vzdelavani-reditelu-zs-balicek': { kind: 'internal', path: '/webinare' },

  '/links/katalog-2025': { kind: 'internal', path: '/katalog' },
  '/links/katalog-2026': { kind: 'internal', path: '/katalog' },
  '/links/katalog-plakaty': { kind: 'internal', path: '/dalsi-produkty' },
  '/links/katalog-pro-distributory': { kind: 'internal', path: '/katalog' },
  '/links/prolistovat': { kind: 'internal', path: '/katalog' },
  '/links/predobjednavka': { kind: 'internal', path: '/objednat' },
  '/links/objednat-pracovni-sesity': { kind: 'internal', path: '/katalog' },
  '/links/objednatsk': { kind: 'external', url: 'https://old.vividbooks.com/links/objednatsk' },
  '/links/bleskovy-souboj-trid': { kind: 'internal', path: '/katalog' },
  '/links/vanocni-souboj-trid': { kind: 'internal', path: '/katalog' },
  '/links/modernizujte-s-nami-ceske-skoly': { kind: 'internal', path: '/katalog' },
  '/links/pf2026': { kind: 'internal', path: '/katalog' },
  '/links/portfolio-vitekskop': { kind: 'internal', path: '/katalog' },
  '/links/prehled-minuleho-roku-v-cislech': { kind: 'internal', path: '/novinky' },
  '/links/ucebnice-umeni': { kind: 'internal', path: '/dalsi-produkty' },
  '/links/zprava-pro-rodice': { kind: 'internal', path: '/katalog' },
  '/links/navod': { kind: 'internal', path: '/objednat' },

  '/links/prvoukalekce4': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce5': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce7': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce11': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce14': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce15': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce17': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce21': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce23': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce24': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce25': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce26': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce27': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce30': { kind: 'internal', path: '/predmet/prvouka' },
  '/links/prvoukalekce32': { kind: 'internal', path: '/predmet/prvouka' },
};

/** Starý slug z Webflow /app-news/{slug} → slug novinky na novém webu (`src/data/novinkaPosts.ts` / CMS). */
export const LEGACY_APP_NEWS_TO_NOVINKA_SLUG: Record<string, string> = {
  '10-sleva-na-dalsi-predmety-vividbooks': 'spoluprace-s-ministerstvem',
  'darek-na-cele-leto-vividboard-premiove-funkce-ai-2-0-a-neomezene-uloziste-zdarma':
    'vividboard-aktualizace-jaro-2026',
  'nova-aplikace-vividbooks': 'nova-ucebnice-matematiky-6-rocnik',
  'nove-funkce-ve-vividboardu': 'vividboard-aktualizace-jaro-2026',
  'novinka-3d-modely-v-prirodopise': 'nova-ucebnice-matematiky-6-rocnik',
  'predobjednejte-si-pracovni-sesity': 'nova-ucebnice-matematiky-6-rocnik',
  'prihlaste-svoji-tridu-do-celostatni-matematicke-20minutovky-a-vyhrajte-pracovni-sesity-matematiky-pro-celou-tridu':
    'dvpp-webinare-jaro-2026',
  'prohlednete-si-matematiku-a-prvouku-pro-1-rocnik': 'nova-ucebnice-matematiky-6-rocnik',
  'prolistujte-si-katalog-pracovnich-sesitu-pro-rok-2026-2026': 'nova-ucebnice-matematiky-6-rocnik',
  'velke-novinky-pro-1-stupen-dolozky-msmt-2-rocnik-a-nove-pisanky': 'spoluprace-s-ministerstvem',
};

/** Starý slug /cs/blog/{slug} → slug článku v aktuálním seedu (`src/data/blogPosts.ts`). Ostatní články → přehled /blog. */
export const LEGACY_CS_BLOG_SLUG_MAP: Record<string, string> = {
  'inspirace-do-vyuky-financni-gramotnost-pro-skoly-jednoduse-interaktivne-a-zdarma':
    'financni-gramotnost-pro-skoly',
  'rozhovor-s-josefem-holym-jak-algoritmy-a-ai-meni-deti-i-skolstvi-a-proc-nestaci-jen-zakazat-mobily':
    'algoritmy-a-ai-meni-deti',
  'pribeh-tridy-ktera-vyrustala-s-vividbooks': 'pribeh-tridy-ktera-vyrostla-s-vividbooks',
};
