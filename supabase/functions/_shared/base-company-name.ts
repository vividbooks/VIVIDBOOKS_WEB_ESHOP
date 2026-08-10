/**
 * Název společnosti pro Base.com export.
 *
 * Pole `delivery_company` je v Base.com API `addOrder` definované jako **varchar(156)**
 * (https://api.base.com/index.php?method=addOrder). Z `orders.school_name` se plní
 * `delivery_company` i `invoice_company` (varchar(500)), takže platí přísnější limit
 * 156 znaků; přes Base jde název i do fulfillmentu.
 */
export const BASE_COMPANY_MAX_LENGTH = 156;

/**
 * Znormalizuje mezery v názvu společnosti a ořízne ho na `BASE_COMPANY_MAX_LENGTH` znaků.
 * Prázdný / whitespace-only vstup vrací `null`.
 */
export function trimCompanyNameForBase(name: string | null | undefined): string | null {
  if (name == null) return null;
  const normalized = name.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, BASE_COMPANY_MAX_LENGTH);
}
