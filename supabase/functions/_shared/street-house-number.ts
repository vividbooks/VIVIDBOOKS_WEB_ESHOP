/** Stejné pravidlo jako ve frontendu — ulice včetně čísla domu. */

export function hasStreetWithHouseNumber(street: string): boolean {
  const s = street.trim();
  if (s.length < 2) return false;
  return /\d/.test(s);
}
