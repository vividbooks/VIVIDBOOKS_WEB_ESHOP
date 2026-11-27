/**
 * Náhled v pravém panelu Asistenta Vividbooks (T-234): stránka webu se tam ukazuje bez horní lišty,
 * bočního menu, lišty s cookies a vyskakovacích oken — jen samotný obsah (blog, novinka, produkt, webinář).
 * Pozná se podle `?nahled=1` nebo podle jména okna (rám v Asistentu se jmenuje „vb-nahled-webu“, jméno
 * zůstává i po kliknutí na jinou stránku uvnitř rámu, parametr v adrese ne).
 */
export function jeNahledAsistenta(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.name === 'vb-nahled-webu' || new URLSearchParams(window.location.search).get('nahled') === '1';
  } catch {
    return false;
  }
}
