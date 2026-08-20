/**
 * Doplnění chybějících částí české adresy (ulice / město / PSČ) pro server-side importy
 * (Pipedrive inbound, …). Pořadí fallbacků volající skládá sám — tady jsou stavební bloky.
 */

export type AddressParts = { street: string; city: string; zip: string };

export function normalizeCzechZip(value: string | undefined | null): string {
  const digitsOnly = String(value ?? '').replace(/\D/g, '');
  return digitsOnly.length === 5 ? digitsOnly : '';
}

/**
 * Ulice s číslem popisným / orientačním („Hradská 506", „Tlumačovská 1237/32", „Sokolská 1a").
 * Bez čísla nelze zásilku doručit — Base / PPL to odmítne nebo doručí na špatnou adresu.
 */
export function streetHasHouseNumber(street: string | undefined | null): boolean {
  return /\d/.test(String(street ?? ''));
}

/** Diakritika + velikost písmen stranou — pro porovnání názvů ulic z různých zdrojů. */
function normalizeForCompare(value: string | undefined | null): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * „Zlín 4-Louky" je pořád Zlín — ARES vrací obec bez městské části. „Znojmo" vs. „Suchohrdly"
 * (stejné PSČ 66902) jsou různá místa.
 */
export function citiesLikelySame(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb || na === nb) return true;
  const prefix = (x: string, y: string) =>
    x.startsWith(`${y} `) || x.startsWith(`${y}-`);
  return prefix(na, nb) || prefix(nb, na);
}

/**
 * PD (a Google) plní `street_number` jen u adres s číslem orientačním. České adresy, které mají
 * pouze číslo popisné, mají číslo v komponentě `premise`, kterou Pipedrive ve strukturovaných
 * podpolích nevede — `route` + `street_number` pak dá „Pod Šternberkem" místo „Pod Šternberkem 306“,
 * přestože `formatted_address` číslo obsahuje. Když je strukturovaná ulice jen prefixem té volně
 * parsované a chybí jí číslo, vezmeme variantu s číslem.
 */
export function preferStreetWithHouseNumber(
  structuredStreet: string | undefined | null,
  parsedStreet: string | undefined | null,
): string {
  const structured = String(structuredStreet ?? '').replace(/\s+/g, ' ').trim();
  const parsed = String(parsedStreet ?? '').replace(/\s+/g, ' ').trim();
  if (!structured) return parsed;
  if (!parsed || streetHasHouseNumber(structured) || !streetHasHouseNumber(parsed)) return structured;

  const structuredNorm = normalizeForCompare(structured);
  const parsedNorm = normalizeForCompare(parsed);
  /** Jen doplnění čísla ke stejné ulici — jiná ulice ve `formatted_address` znamená jiný zdroj dat. */
  return parsedNorm.startsWith(`${structuredNorm} `) ? parsed : structured;
}

/**
 * „Jihomoravský kraj", „Středočeský kraj" — Google to vrací jako `administrative_area_level_1`
 * a jako první segment `formatted_address` u adres bez ulice. Jako ulice je to nepoužitelné.
 */
export function looksLikeRegionName(value: string | undefined | null): boolean {
  return /\bkraj\b/i.test(String(value ?? ''));
}

/** Sloučí `source` do `target` — doplňuje jen prázdná pole v `target`. */
export function mergeAddressPartsFillMissing(
  target: AddressParts,
  source: Partial<AddressParts> | null | undefined,
): AddressParts {
  if (!source) return target;
  return {
    street: target.street.trim() || String(source.street || '').trim(),
    city: target.city.trim() || String(source.city || '').trim(),
    zip: target.zip.trim() || normalizeCzechZip(source.zip),
  };
}

/**
 * Parsuje plain‑text adresu na strukturované části. Funguje pro běžné české formáty:
 *   - „Karlova 5, 120 00 Praha"
 *   - „5. května 68, Libčice nad Vltavou"
 */
export function parseFreeFormAddress(rawInput: string | undefined | null): AddressParts {
  const raw = String(rawInput ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return { street: '', city: '', zip: '' };

  const noCountry = raw
    .replace(
      /,?\s*(czech\s*republic|czechia|česk[áo]\s*republika|česko|čr|slovakia|slovensk[áo]\s*republika|slovensko|cz|sk)\s*\.?\s*$/i,
      '',
    )
    .trim();
  const zipMatch = noCountry.match(/\b(\d{3})\s?(\d{2})\b/);
  const zip = zipMatch ? `${zipMatch[1]}${zipMatch[2]}` : '';

  const withoutZip = zipMatch
    ? (noCountry.slice(0, zipMatch.index) + ' ' + noCountry.slice((zipMatch.index || 0) + zipMatch[0].length))
      .replace(/\s+/g, ' ')
      .trim()
    : noCountry;
  const parts = withoutZip.split(/,/).map((p) => p.trim()).filter(Boolean);

  let street = '';
  let city = '';
  if (parts.length === 1) {
    if (zipMatch) {
      const before = noCountry.slice(0, zipMatch.index || 0).replace(/[,\s]+$/, '').trim();
      const after = noCountry.slice((zipMatch.index || 0) + zipMatch[0].length).replace(/^[,\s]+/, '').trim();
      street = before;
      city = after;
    } else {
      street = parts[0];
    }
  } else {
    street = parts[0];
    const cityPart = parts.slice(1).find((p) => /[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(p)) || '';
    city = cityPart;
  }

  street = street.replace(/[,;]+$/, '').trim();
  city = city.replace(/[,;]+$/, '').trim();
  return { street, city, zip: normalizeCzechZip(zip) };
}

/**
 * V názvu PD organizace bývá adresa za pomlčkou:
 * „Základní škola Karla Hašlera – 5. května 68, Libčice nad Vltavou"
 */
export function parseAddressFromOrgName(orgName: string | undefined | null): AddressParts {
  const raw = String(orgName ?? '').trim();
  if (!raw) return { street: '', city: '', zip: '' };

  const dashMatch = raw.match(/(?:\s[–—-]\s|\s-\s)(.+)$/);
  const tail = dashMatch?.[1]?.trim() || '';
  if (!tail || !/,/.test(tail)) return { street: '', city: '', zip: '' };

  const parsed = parseFreeFormAddress(tail);
  if (!parsed.street && !parsed.city && !parsed.zip) return { street: '', city: '', zip: '' };
  return parsed;
}

function formatAresStreetNumber(domovni: unknown, orientacni: unknown): string {
  const d = domovni != null && domovni !== '' ? String(domovni).trim() : '';
  const o = orientacni != null && orientacni !== '' ? String(orientacni).trim() : '';
  if (d && o) return `${d}/${o}`;
  return d || o;
}

type AresSidlo = {
  textovaAdresa?: string;
  adresaText?: string;
  nazevUlice?: string;
  cisloDomovni?: number | string;
  cisloOrientacni?: number | string;
  cisloOrientacniPismeno?: string;
  nazevObce?: string;
  nazevCastiObce?: string;
  psc?: number | string;
};

function addressPartsFromAresSidlo(sidlo: AresSidlo | null | undefined): AddressParts | null {
  if (!sidlo || typeof sidlo !== 'object') return null;

  const textAddress = String(sidlo.textovaAdresa || sidlo.adresaText || '').trim();
  if (textAddress) {
    const parsed = parseFreeFormAddress(textAddress);
    if (parsed.street || parsed.city || parsed.zip) return parsed;
  }

  const streetName = String(sidlo.nazevUlice || '').trim();
  const streetNumber = formatAresStreetNumber(sidlo.cisloDomovni, sidlo.cisloOrientacni);
  const street = [streetName, streetNumber].filter(Boolean).join(' ').trim();
  const city = String(sidlo.nazevObce || sidlo.nazevCastiObce || '').trim();
  const zip = normalizeCzechZip(String(sidlo.psc ?? ''));

  if (!street && !city && !zip) return null;
  return { street, city, zip };
}

/** Oficiální sídlo subjektu z ARES — spolehlivý zdroj PSČ u škol s platným IČO. */
export async function fetchAresAddressPartsByIco(icoRaw: string): Promise<AddressParts | null> {
  const ico = String(icoRaw ?? '').replace(/\D/g, '');
  if (ico.length < 6 || ico.length > 10) return null;

  try {
    const res = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${encodeURIComponent(ico)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { sidlo?: AresSidlo };
    return addressPartsFromAresSidlo(data?.sidlo);
  } catch {
    return null;
  }
}

export type GeocodeAddressOptions = {
  log?: (event: string, data?: Record<string, unknown>) => void;
};

/** Google Geocoding API — doplnění PSČ / ulice / města z volné věty. */
export async function geocodeFreeFormAddressViaGoogle(
  rawAddress: string,
  options?: GeocodeAddressOptions,
): Promise<AddressParts | null> {
  const key = (Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('GOOGLE_PLACES_API_KEY') || '').trim();
  if (!key) {
    options?.log?.('geocode_skipped_no_api_key', {});
    return null;
  }

  let cleanedInput = String(rawAddress || '').replace(/\s+/g, ' ').trim();
  if (!cleanedInput) return null;
  if (!/\b(czech|česk|cz|slovak|sk)\b/i.test(cleanedInput)) {
    cleanedInput = `${cleanedInput}, Česká republika`;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', cleanedInput);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'cs');
  url.searchParams.set('region', 'cz');
  url.searchParams.set('components', 'country:CZ|country:SK');

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        address_components?: Array<{ long_name: string; types: string[] }>;
        formatted_address?: string;
      }>;
      error_message?: string;
    };
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      options?.log?.('geocode_failed', { status: data.status, error: data.error_message || '' });
      return null;
    }

    const components = data.results[0].address_components || [];
    let streetNumber = '';
    let premise = '';
    let route = '';
    let city = '';
    let zip = '';
    for (const c of components) {
      const t = c.types || [];
      if (t.includes('street_number')) streetNumber = c.long_name;
      /** České adresy jen s číslem popisným vrací Google jako `premise`, ne `street_number`. */
      if (t.includes('premise')) premise = c.long_name;
      if (t.includes('route')) route = c.long_name;
      if (t.includes('locality')) city = c.long_name;
      if (!city && t.includes('postal_town')) city = c.long_name;
      if (t.includes('postal_code')) zip = String(c.long_name || '').replace(/\s/g, '');
    }
    if (!city) {
      for (const c of components) {
        if ((c.types || []).includes('administrative_area_level_2')) {
          city = c.long_name;
          break;
        }
      }
    }
    let street = [route, streetNumber || premise].filter(Boolean).join(' ').trim();
    const formattedFirstSegment = String(data.results[0].formatted_address || '').split(',')[0]?.trim() || '';
    /** `formatted_address` u adres bez ulice začíná názvem kraje / obce — jako ulice nepoužitelné. */
    const usableFormattedStreet = looksLikeRegionName(formattedFirstSegment) ? '' : formattedFirstSegment;
    if (!street) {
      street = usableFormattedStreet;
    } else if (!streetHasHouseNumber(street)) {
      street = preferStreetWithHouseNumber(street, usableFormattedStreet);
    }
    return { street, city, zip: normalizeCzechZip(zip) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    options?.log?.('geocode_error', { error: msg });
    return null;
  }
}

export type EnrichCzechAddressOptions = {
  ico?: string | null;
  orgName?: string | null;
  geocodeDisabled?: boolean;
  log?: (event: string, data?: Record<string, unknown>) => void;
};

/**
 * Vyčistí zjevně nepoužitelné hodnoty, aby je následné doplňování mohlo nahradit:
 *   - ulice = název kraje (Google `administrative_area_level_1` u adres bez ulice),
 *   - město obsahující celý řádek ulice včetně čísla („Osvobození 535" u ulice „Osvobození") —
 *     v takovém případě je číslo popisné jediná použitelná informace, přesune se do ulice.
 */
function dropDegenerateAddressParts(parts: AddressParts): AddressParts {
  const street = looksLikeRegionName(parts.street) ? '' : parts.street;
  const cityIsStreetLine =
    Boolean(street) &&
    !streetHasHouseNumber(street) &&
    streetHasHouseNumber(parts.city) &&
    normalizeForCompare(parts.city).startsWith(`${normalizeForCompare(street)} `);
  return {
    street: cityIsStreetLine ? parts.city.replace(/\s+/g, ' ').trim() : street,
    city: cityIsStreetLine ? '' : parts.city,
    zip: parts.zip,
  };
}

/**
 * Mezikrok: po načtení adresy z PD Person/Org doplní chybějící PSČ (a případně ulici/město):
 *   1) adresa v názvu organizace (za pomlčkou),
 *   2) Google Geocoding (ulice + město),
 *   3) ARES podle IČO (oficiální sídlo včetně PSČ).
 *
 * Doplňování se spouští i tehdy, když je ulice sice vyplněná, ale **chybí jí číslo popisné** —
 * bez něj Base ani dopravce zásilku nedoručí.
 */
export async function enrichCzechAddressParts(
  initial: AddressParts,
  options: EnrichCzechAddressOptions = {},
): Promise<AddressParts> {
  let parts = { ...initial };

  const fromOrgName = parseAddressFromOrgName(options.orgName);
  parts = mergeAddressPartsFillMissing(parts, fromOrgName);
  parts.street = preferStreetWithHouseNumber(parts.street, fromOrgName.street);

  const normalized = {
    street: parts.street.trim(),
    city: parts.city.trim(),
    zip: normalizeCzechZip(parts.zip),
  };
  parts = dropDegenerateAddressParts(normalized);
  if (parts.street !== normalized.street || parts.city !== normalized.city) {
    options?.log?.('address_degenerate_parts_dropped', { before: normalized, after: parts });
  }

  const needsMoreDetail = () => !parts.street || !parts.city || !parts.zip || !streetHasHouseNumber(parts.street);

  if (!options.geocodeDisabled && needsMoreDetail()) {
    const geocodeQueryParts = [
      parts.street,
      [parts.zip, parts.city].filter(Boolean).join(' ').trim(),
    ].filter(Boolean);
    const geocodeQuery = geocodeQueryParts.join(', ').trim();
    if (geocodeQuery) {
      const geocoded = await geocodeFreeFormAddressViaGoogle(geocodeQuery, { log: options.log });
      if (geocoded) {
        const before = { ...parts };
        parts = mergeAddressPartsFillMissing(parts, geocoded);
        parts.street = preferStreetWithHouseNumber(parts.street, geocoded.street);
        parts.zip = normalizeCzechZip(parts.zip);
        if (
          parts.street !== before.street ||
          parts.city !== before.city ||
          parts.zip !== before.zip
        ) {
          options?.log?.('address_geocoded', {
            before,
            after: parts,
            query: geocodeQuery,
          });
        }
      }
    }
  }

  if (needsMoreDetail() && options.ico) {
    const fromAres = await fetchAresAddressPartsByIco(options.ico);
    if (fromAres) {
      const before = { ...parts };
      /**
       * Sídlo z ARES je adresa **objednatele**, ne nutně doručovací adresa z dealu (u dealů přes
       * distributora se liší). Použijeme ho jen tam, kde si s už známou lokalitou neodporuje —
       * jinak bychom zásilku pro školu poslali na adresu zprostředkovatele.
       *
       * Stejné PSČ nestačí — 66902 je Znojmo i Suchohrdly. Když známe město a ARES má jiné,
       * sídlo z rejstříku není doručovací adresa (deal 26680: Znojmo vs. Pod Skalou / Suchohrdly).
       */
      const zipOk = !parts.zip || !fromAres.zip || parts.zip === fromAres.zip;
      const cityOk = citiesLikelySame(parts.city, fromAres.city);
      const sameLocation = zipOk && cityOk;

      if (!sameLocation) {
        options?.log?.('address_ares_location_mismatch', {
          ico: String(options.ico).replace(/\D/g, ''),
          order: before,
          ares: fromAres,
        });
      } else {
        parts = mergeAddressPartsFillMissing(parts, fromAres);
        parts.street = preferStreetWithHouseNumber(parts.street, fromAres.street);
        parts.zip = normalizeCzechZip(parts.zip);
        if (
          parts.street !== before.street ||
          parts.city !== before.city ||
          parts.zip !== before.zip
        ) {
          options?.log?.('address_from_ares', {
            ico: String(options.ico).replace(/\D/g, ''),
            before,
            after: parts,
          });
        }
      }
    }
  }

  if (!streetHasHouseNumber(parts.street)) {
    options?.log?.('address_street_without_house_number', { street: parts.street, city: parts.city, zip: parts.zip });
  }

  return {
    street: looksLikeRegionName(parts.street) ? '' : parts.street.trim(),
    city: parts.city.trim(),
    zip: normalizeCzechZip(parts.zip),
  };
}
