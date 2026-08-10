/**
 * Skládání adresy z Pipedrive entit (Person / Organization) na strukturované části.
 *
 * Pipedrive ukládá adresu jednak jako `formatted_address` (text z Google Places), jednak jako
 * strukturovaná podpole (`route`, `street_number`, `locality`, `postal_code`, …). U českých adres,
 * které mají jen číslo popisné (bez čísla orientačního), Google to číslo vrací jako komponentu
 * `premise` — tu Pipedrive v podpolích nevede, takže `route` + `street_number` dá ulici **bez čísla**
 * („Pod Šternberkem" místo „Pod Šternberkem 306"). Proto se číslo dobírá z `formatted_address`.
 */
import {
  type AddressParts,
  normalizeCzechZip,
  parseFreeFormAddress,
  preferStreetWithHouseNumber,
  streetHasHouseNumber,
} from './czech-address-enrichment.ts';

export function structuredFieldsFromObject(
  obj: Record<string, unknown> | null | undefined,
  prefix = '',
): AddressParts {
  if (!obj || typeof obj !== 'object') return { street: '', city: '', zip: '' };
  const o = obj as Record<string, unknown>;
  const pick = (key: string) => String(o[prefix ? `${prefix}${key}` : key] ?? '').trim();
  const route = pick('route');
  const streetNumber = pick('street_number');
  const subpremise = pick('subpremise');
  const locality = pick('locality');
  const sublocality = pick('sublocality');
  const postalCode = pick('postal_code');
  const composedStreet = [route, streetNumber, subpremise].filter(Boolean).join(' ').trim();
  return {
    street: composedStreet,
    city: locality || sublocality,
    zip: normalizeCzechZip(postalCode),
  };
}

/**
 * Adresa Person z PD. Priorita:
 *   1) strukturovaná podpole z `postal_address` (route, street_number, locality, postal_code, …)
 *   2) parse `postal_address.formatted_address` (resp. `value`) pro chybějící části včetně
 *      čísla popisného, které v podpolích chybí
 */
export function personPostalLine(person: Record<string, unknown>): AddressParts {
  const a = person?.postal_address;
  if (!a || typeof a !== 'object') return { street: '', city: '', zip: '' };
  const o = a as Record<string, unknown>;
  const structured = structuredFieldsFromObject(o);
  if (structured.street && structured.city && structured.zip && streetHasHouseNumber(structured.street)) {
    return structured;
  }
  const raw = String(o.formatted_address || o.value || '').trim();
  const parsed = parseFreeFormAddress(raw);
  return {
    street: preferStreetWithHouseNumber(structured.street, parsed.street),
    city: structured.city || parsed.city,
    zip: structured.zip || parsed.zip,
  };
}

/**
 * Adresa Org z PD. PD v1 zploští adresu do polí `address_route`, `address_street_number`,
 * `address_locality`, `address_postal_code` … (každé sub‑pole s prefixem `address_`).
 * Hodnota `org.address` je `formatted_address`. PD v2 / starší vrátí `address` jako objekt.
 */
export function orgAddressLine(org: Record<string, unknown>): AddressParts {
  /** v1 — flat `address_*` pole. */
  const flat = structuredFieldsFromObject(org, 'address_');
  /** v2 / jiný layout — `address` jako objekt. */
  const nested = org.address && typeof org.address === 'object' && !Array.isArray(org.address)
    ? structuredFieldsFromObject(org.address as Record<string, unknown>)
    : { street: '', city: '', zip: '' };
  /** Plain string `org.address`. */
  const stringAddr = typeof org.address === 'string' ? org.address.trim() : '';
  const parsedString = stringAddr ? parseFreeFormAddress(stringAddr) : { street: '', city: '', zip: '' };
  const structuredStreet = flat.street || nested.street;
  return {
    street: preferStreetWithHouseNumber(structuredStreet, parsedString.street),
    city: flat.city || nested.city || parsedString.city,
    zip: flat.zip || nested.zip || parsedString.zip,
  };
}
