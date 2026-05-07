/**
 * Mapování legacy Webflow URL → konkrétní novinky / blog / Shoptet.
 * Po migraci obsahu v administraci lze hodnoty upřesnit.
 */

export const ESHOP_PUBLIC_ORIGIN = 'https://eshop.vividbooks.com';

/** Příklady tištěných produktů ([eshop](https://eshop.vividbooks.com/)) — krátké /links/ na konkrétní stránky. */
const ESHOP = ESHOP_PUBLIC_ORIGIN.replace(/\/$/, '');

export type LegacyLinkResolution =
  | { kind: 'internal'; path: string }
  | { kind: 'external'; url: string };

/** Konkrétní cíle pro staré zkrácené odkazy vividbooks.com/links/… */
export const LEGACY_SHORT_LINK_TARGETS: Record<string, LegacyLinkResolution> = {
  '/links/nechte-nam-kontakt': { kind: 'internal', path: '/kontakt' },
  '/links/hledame-partnera': { kind: 'internal', path: '/kontakt' },
  '/links/skoleni-matematika': { kind: 'internal', path: '/webinare' },
  '/links/letni-vzdelavani-reditelu-zs-balicek': { kind: 'internal', path: '/webinare' },

  '/links/katalog-2025': { kind: 'external', url: `${ESHOP}/` },
  '/links/katalog-2026': { kind: 'external', url: `${ESHOP}/` },
  '/links/katalog-plakaty': { kind: 'external', url: `${ESHOP}/` },
  '/links/katalog-pro-distributory': { kind: 'external', url: `${ESHOP}/` },
  '/links/prolistovat': { kind: 'external', url: `${ESHOP}/` },
  '/links/predobjednavka': { kind: 'external', url: `${ESHOP}/` },
  '/links/objednat-pracovni-sesity': { kind: 'external', url: `${ESHOP}/` },
  '/links/objednatsk': { kind: 'external', url: `${ESHOP}/` },
  '/links/bleskovy-souboj-trid': { kind: 'external', url: `${ESHOP}/` },
  '/links/vanocni-souboj-trid': { kind: 'external', url: `${ESHOP}/` },
  '/links/modernizujte-s-nami-ceske-skoly': { kind: 'external', url: `${ESHOP}/` },
  '/links/pf2026': { kind: 'external', url: `${ESHOP}/` },
  '/links/portfolio-vitekskop': { kind: 'external', url: `${ESHOP}/` },
  '/links/prehled-minuleho-roku-v-cislech': { kind: 'external', url: `${ESHOP}/` },
  '/links/ucebnice-umeni': { kind: 'external', url: `${ESHOP}/` },
  '/links/zprava-pro-rodice': { kind: 'external', url: `${ESHOP}/` },
  '/links/navod': { kind: 'external', url: `${ESHOP}/` },

  '/links/prvoukalekce4': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce5': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce7': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce11': { kind: 'external', url: `${ESHOP}/pracovni-ucebnice-prvouky-pro-1-rocnik-1-dil/` },
  '/links/prvoukalekce14': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce15': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce17': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce21': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce23': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce24': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce25': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce26': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce27': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce30': { kind: 'external', url: `${ESHOP}/prvouka/` },
  '/links/prvoukalekce32': { kind: 'external', url: `${ESHOP}/prvouka/` },
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
