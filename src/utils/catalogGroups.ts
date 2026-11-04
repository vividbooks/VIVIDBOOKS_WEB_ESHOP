/**
 * Skupiny katalogu pracovních sešitů — jen pro zobrazení (data produktů a jejich `category` se nemění).
 *
 * Prvouka, Vlastivěda a Přírodověda se v katalogu i v objednávce ukazují pod jedním nadpisem
 * „Člověk a jeho svět“ (vzdělávací oblast RVP). Uvnitř skupiny pořadí Prvouka → Vlastivěda → Přírodověda.
 */

export const CLOVEK_A_JEHO_SVET = 'Člověk a jeho svět';

/** Předměty skupiny v pořadí zobrazení; první je „hlavní“ (stránka předmětu, digitální licence). */
export const CLOVEK_A_JEHO_SVET_SUBJECTS = ['Prvouka', 'Vlastivěda', 'Přírodověda'] as const;

const norm = (s: string) => String(s || '').trim().normalize('NFC');

/** Název skupiny katalogu pro kategorii produktu (ostatní kategorie zůstávají samy sebou). */
export function catalogGroupOf(category: string): string {
  const c = norm(category);
  return (CLOVEK_A_JEHO_SVET_SUBJECTS as readonly string[]).includes(c) ? CLOVEK_A_JEHO_SVET : c;
}

/** Kategorie produktů, které do skupiny patří. */
export function catalogGroupMembers(group: string): string[] {
  const g = norm(group);
  return g === CLOVEK_A_JEHO_SVET ? [...CLOVEK_A_JEHO_SVET_SUBJECTS] : [g];
}

/** Hlavní předmět skupiny — kam vede „Otevřít celý předmět“ a čí online produkt je digitální licence skupiny. */
export function catalogGroupPrimarySubject(group: string): string {
  return catalogGroupMembers(group)[0];
}

/** Pořadí předmětu uvnitř skupiny (Prvouka 0, Vlastivěda 1, Přírodověda 2; jinde 0). */
export function catalogSubjectRank(category: string): number {
  const i = (CLOVEK_A_JEHO_SVET_SUBJECTS as readonly string[]).indexOf(norm(category));
  return i === -1 ? 0 : i;
}
