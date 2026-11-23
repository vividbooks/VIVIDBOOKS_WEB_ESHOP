/**
 * Sekce Kariéra na stránce Kontakt.
 *
 * Dokud je CAREER_PUBLIC false, na veřejné stránce /kontakt se sekce nezobrazuje a inzeráty se
 * do ní ani nenačítají. Vidět je jen na neveřejné adrese CAREER_PREVIEW_PATH (noindex, nikde
 * neodkázaná, schválně těžko uhodnutelná). Při změně adresy upravit i hlavičku X-Robots-Tag
 * ve vercel.json.
 *
 * Zveřejnění = přepnout CAREER_PUBLIC na true (jen na výslovný pokyn).
 */
export const CAREER_PUBLIC = false;

export const CAREER_PREVIEW_PATH = '/kontakt-kariera-k7p3wd';
