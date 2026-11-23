/**
 * Sekce Kariéra na stránce Kontakt a samostatné stránky pozic.
 *
 * Dokud je CAREER_PUBLIC false, na veřejné stránce /kontakt se sekce nezobrazuje a inzeráty se
 * do ní ani nenačítají. Vidět je jen na neveřejné adrese CAREER_PREVIEW_PATH (noindex, nikde
 * neodkázaná, schválně těžko uhodnutelná). Každá pozice má navíc vlastní stránku
 * CAREER_PREVIEW_PATH/<id pozice>, kterou jde poslat jako odkaz. Při změně adresy upravit
 * i hlavičky X-Robots-Tag ve vercel.json (adresu čte také scripts/prerender-seo.mjs).
 *
 * Zveřejnění = přepnout CAREER_PUBLIC na true (jen na výslovný pokyn). Pozice pak dostanou
 * i veřejné adresy CAREER_PUBLIC_PATH/<id pozice>; neveřejné odkazy fungují dál.
 */
export const CAREER_PUBLIC = false;

export const CAREER_PREVIEW_PATH = '/kontakt-kariera-k7p3wd';

export const CAREER_PUBLIC_PATH = '/kariera';

/** Adresa samostatné stránky pozice (bez domény). */
export function careerPositionPath(id: string): string {
  return `${CAREER_PUBLIC ? CAREER_PUBLIC_PATH : CAREER_PREVIEW_PATH}/${id}`;
}

/** Adresa přehledu všech pozic (sekce Kariéra na Kontaktu). */
export function careerListPath(): string {
  return `${CAREER_PUBLIC ? '/kontakt' : CAREER_PREVIEW_PATH}#kariera`;
}
