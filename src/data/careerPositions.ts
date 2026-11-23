/**
 * Otevřené pozice pro sekci Kariéra na stránce Kontakt a pro samostatné stránky pozic.
 *
 * Texty inzerátů jsou v careerPositions.json (čte je i scripts/prerender-seo.mjs kvůli náhledu
 * odkazu při sdílení). Plat se v inzerátech neuvádí. Pozici skryjete nastavením `published: false`.
 * `id` je zároveň konec adresy stránky pozice, proto ho u zveřejněné pozice neměňte.
 */
import positions from './careerPositions.json';

export type CareerPosition = {
  id: string;
  title: string;
  /** Kde se pracuje (město, region, na dálku). */
  place: string;
  /** Krátké uvedení: proč pozice vzniká a koho hledáme. */
  intro: string;
  sections: { heading: string; items: string[] }[];
  published: boolean;
};

/** Odstavec o firmě nahoře v Kariéře i na stránce každé pozice (zadal Vítek 23. 11.). */
export const CAREER_ABOUT =
  'Vividbooks mění české školy. Chceme, aby se děti učily aktivně: samy zkoumají, počítají a řeší úlohy, místo aby jen poslouchaly výklad, a učitel je při tom provází. Dělat to pomáhají naše interaktivní učebnice a pracovní sešity pro základní školy, se kterými dnes učí stovky škol.';

export const CAREER_CONTACT_EMAIL = 'vitek@vividbooks.com';

export const CAREER_POSITIONS: CareerPosition[] = positions;

export function findCareerPosition(id: string | undefined): CareerPosition | undefined {
  return CAREER_POSITIONS.find((p) => p.published && p.id === id);
}
