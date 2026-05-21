/**
 * Validace e-mailu pro Edge funkce (objednávky / trial). Bez závislostí.
 * Server ověřuje doménu přes DNS MX (`domainAcceptsMailForForms` v `_shared/email-mx.ts`).
 *
 * NB: Obsah je zrcadlo `src/utils/emailValidation.ts` (frontend). Pokud měníš jednu stranu,
 * udrž obě synchronní — Supabase Edge bundler nemůže importovat soubory mimo
 * `supabase/functions/`, proto držíme druhou kopii zde.
 */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidDomainLabel(label: string): boolean {
  if (label.length === 0 || label.length > 63) return false;
  if (label.startsWith('xn--')) {
    return /^xn--[a-z0-9-]+$/.test(label) && label.length >= 4;
  }
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label);
}

function isValidLocalPart(local: string): boolean {
  if (local.length === 0 || local.length > 64) return false;
  return /^(?:[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?)$/.test(local);
}

export function isValidEmailFormat(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (email.length < 6 || email.length > 254) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!isValidLocalPart(local)) return false;
  if (domain.length > 253 || !domain.includes('.')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!isValidDomainLabel(label)) return false;
  }
  const tld = labels[labels.length - 1];
  return tld.length >= 2;
}

export const EMAIL_FORMAT_HINT_CS =
  'Zadejte platný e-mail (např. jmeno@skola.cz).';

export const EMAIL_MX_REJECT_CS =
  'Doména e-mailu nemá nastavený příjem pošty (chybí MX) nebo neexistuje. Zkontrolujte překlep.';
