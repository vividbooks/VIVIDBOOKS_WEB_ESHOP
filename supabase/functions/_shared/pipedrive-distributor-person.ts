/**
 * Jméno kontaktní osoby u distributorského dealu v Pipedrive.
 *
 * Formulář distributora nemá pole „jméno osoby“ — `customer_name` je název firmy z IČO.
 * Když jde o právnickou osobu, nepoužijeme ho jako jméno kontaktu (vznikla by osoba
 * „Baar Group s.r.o.“). Místo toho vezmeme lokální část e‑mailu.
 * U OSVČ (jméno bez právní formy) zůstane název z IČO.
 */

const LEGAL_ENTITY_RE =
  /\b(s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|spol\.|akciov|veřejn[aá]\s+obchodn|komanditn|z\.?\s*s\.?|o\.?\s*p\.?\s*s\.?|k\.?\s*s\.?|v\.?\s*o\.?\s*s\.?|ltd\.?|gmbh|inc\.?|llc)\b/i;

export function looksLikeLegalEntityName(name: string): boolean {
  return LEGAL_ENTITY_RE.test(String(name || '').trim());
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function distributorContactPersonName(companyName: string, email: string): string {
  const name = String(companyName || '').trim();
  if (name && !looksLikeLegalEntityName(name)) return name.slice(0, 200);

  const local = String(email || '').split('@')[0] || '';
  const pretty = titleCaseWords(local.replace(/[._+]+/g, ' ').replace(/\s+/g, ' ').trim());
  if (pretty) return pretty.slice(0, 200);
  const fallback = String(email || '').trim();
  return (fallback || 'Kontakt').slice(0, 200);
}
