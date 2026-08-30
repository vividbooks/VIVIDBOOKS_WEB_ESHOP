/**
 * Novinky nové aplikace pro slider na `/app-uvod` (embed ve staré aplikaci).
 *
 * Náhledy jsou browser okno na barevném podkladu, zespoda odříznuté. Karta pod
 * obrázkem proto musí mít stejnou barvu jako `color` — jinak by se na spodní
 * hraně objevil zlom místo okna vylézajícího z barvy.
 *
 * Stejná data drží i aplikace v `vividbooks-ultra`
 * (`frontend/src/app/components/library/library-news-slides.ts`) — když se tady
 * něco mění, patří to i tam.
 */

export type NovaAplikaceNovinka = {
  id: string;
  title: string;
  image: string;
  /** Musí odpovídat podkladu v `image`. */
  color: string;
  slug: string;
};

export const NOVA_APLIKACE_NOVINKY: NovaAplikaceNovinka[] = [
  {
    id: 'nova-aplikace',
    title: 'Nová aplikace a knihovna',
    image: '/app-uvod/novinky-nova-aplikace.webp',
    color: '#dee4f1',
    slug: 'nova-aplikace-vividbooks-jeden-ucet-a-nova-knihovna',
  },
  {
    id: 'vividbooks-ai',
    title: 'Vividbooks AI napříč aplikací',
    image: '/app-uvod/novinky-vividbooks-ai.webp',
    color: '#89f2ce',
    slug: 'vividbooks-ai-asistent-ktery-zna-nase-ucebnice',
  },
  {
    id: 'pracovni-listy',
    title: 'Nový editor pracovních listů',
    image: '/app-uvod/novinky-pracovni-listy.webp',
    color: '#ffbe7a',
    slug: 'novy-editor-pracovnich-listu',
  },
  {
    id: 'vividboard',
    title: 'Nový Vividboard a soutěžní režimy',
    image: '/app-uvod/novinky-vividboard.webp',
    color: '#fee0ad',
    slug: 'novy-vividboard-aktivity-a-soutezni-rezimy',
  },
  {
    id: 'pocetnik',
    title: 'Početník: adaptivní procvičování',
    image: '/app-uvod/novinky-pocetnik.webp',
    color: '#ffc5b6',
    slug: 'pocetnik-adaptivni-procvicovani-matematiky',
  },
];
