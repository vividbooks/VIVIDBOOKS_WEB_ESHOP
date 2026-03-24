/**
 * Parsování adresy z ARES / CSV do polí ulice, město, PSČ.
 * PSČ vždy jen 5 číslic; text za PSČ (např. „19600 Praha 9“) přejde do města.
 */

function looksLikeIcoOnly(value: string): boolean {
  const compact = value.replace(/\s/g, '');
  return /^\d{6,10}$/.test(compact);
}

/** Z pole PSČ vyndá číselný kód; zbytek přidá k městu (bez duplicit). */
function normalizeCzechPostalAndCity(city: string, zipRaw: string): { city: string; zip: string } {
  let cityOut = (city || '').trim();
  const zin = (zipRaw || '').trim();
  if (!zin) {
    return { city: cityOut, zip: '' };
  }

  // „19600 Praha 9“, „196 00 Praha 9“
  const withSuffix = zin.match(/^(\d{3}\s?\d{2})(\s+(.+))?$/);
  if (withSuffix) {
    const zipDigits = withSuffix[1].replace(/\s/g, '');
    const rest = (withSuffix[3] || '').trim();
    if (rest) {
      if (!cityOut) {
        cityOut = rest;
      } else if (!cityOut.includes(rest)) {
        cityOut = `${cityOut}, ${rest}`;
      }
    }
    return { city: cityOut, zip: zipDigits };
  }

  // Čisté PSČ bez textu
  if (/^\d{3}\s?\d{2}$/.test(zin)) {
    return { city: cityOut, zip: zin.replace(/\s/g, '') };
  }

  return { city: cityOut, zip: zin };
}

function finishSchoolAddress(street: string, city: string, zip: string): {
  street: string;
  city: string;
  zip: string;
} {
  const n = normalizeCzechPostalAndCity(city, zip);
  return {
    street: street.trim(),
    city: n.city,
    zip: n.zip,
  };
}

export function parseSchoolAddress(
  address?: string,
  icoHint?: string,
): { street: string; city: string; zip: string } {
  const normalized = (address ?? '').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return { street: '', city: '', zip: '' };
  }

  const compactAddr = normalized.replace(/\s/g, '');
  if (looksLikeIcoOnly(normalized)) {
    return { street: '', city: '', zip: '' };
  }

  const icoDigits = (icoHint ?? '').replace(/\D/g, '');
  if (icoDigits.length >= 6 && compactAddr === icoDigits) {
    return { street: '', city: '', zip: '' };
  }

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  const ZIP_RE = /^\d{3}\s?\d{2}$/;
  const zipPartIndex = parts.findIndex((part) => ZIP_RE.test(part));

  if (zipPartIndex >= 1) {
    return finishSchoolAddress(
      parts.slice(0, Math.max(1, zipPartIndex - 1)).join(', '),
      parts[zipPartIndex - 1] || '',
      parts[zipPartIndex],
    );
  }

  if (parts.length >= 3) {
    return finishSchoolAddress(
      parts.slice(0, -2).join(', '),
      parts[parts.length - 2] || '',
      parts[parts.length - 1] || '',
    );
  }

  const street = parts.length > 1 ? parts[0]! : normalized;
  const lastPart = parts.length > 1 ? parts[parts.length - 1]! : normalized;
  let city = lastPart;
  let zip = '';

  const zipAtStart = lastPart.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  const zipAtEnd = lastPart.match(/^(.+?)\s+(\d{3}\s?\d{2})$/);

  if (zipAtStart) {
    zip = zipAtStart[1]!;
    city = zipAtStart[2]!;
  } else if (zipAtEnd) {
    city = zipAtEnd[1]!;
    zip = zipAtEnd[2]!;
  }

  if (
    parts.length === 1 &&
    !ZIP_RE.test(parts[0]!) &&
    looksLikeIcoOnly(parts[0]!)
  ) {
    return { street: '', city: '', zip: '' };
  }

  if (
    street === city &&
    street.trim().length > 0 &&
    looksLikeIcoOnly(street)
  ) {
    return finishSchoolAddress('', '', zip || '');
  }

  return finishSchoolAddress(street, city, zip);
}
