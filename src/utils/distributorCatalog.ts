/**
 * Sortiment pro distributorské objednávky (neveřejná stránka `/distributor/objednavka`).
 *
 * Sdílí frontend i Edge handler `POST …/distributor/orders`, aby nabídka na stránce
 * a validace na serveru nemohly rozejít.
 */

/** Digitální přístupy a licence se prodávají jen předplatným — distributor je neobjednává. */
export function isDistributorOrderableProduct(product: any): boolean {
  const type = String(product?.type || '').trim().toLowerCase();
  return type !== 'online' && type !== 'license';
}
