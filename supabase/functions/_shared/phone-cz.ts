/**
 * České telefonní číslo — jedno místo pro pokladnu (frontend přes `src/utils/phoneCZ.ts`),
 * Edge funkce pokladny, export do Base.com i import z Pipedrivu.
 *
 * Dopravce (PPL, DPD, GLS, Zásilkovna) číslo potřebuje, aby kurýr mohl zákazníka kontaktovat
 * a poslat SMS o doručení. Proto nestačí kontrola formátu (9 číslic): ověřujeme i číslovací plán
 * ČTÚ (předvolba musí v ČR existovat) a odmítáme zjevně vymyšlená čísla (777 777 777, 739 123 456).
 * Zda číslo opravdu někomu patří, offline poznat nejde (to by umělo až HLR ověření v síti).
 */

export const PHONE_CZ_HINT =
  'Zadejte platný český telefon (např. 739 056 178 nebo +420 739 056 178).';

export const PHONE_CZ_NOT_EXISTING_HINT =
  'Toto číslo v české síti neexistuje. Zadejte prosím skutečné číslo, na kterém vás kurýr zastihne.';

export const PHONE_CZ_MOBILE_HINT =
  'Zadejte mobilní číslo (začíná 6 nebo 7, např. 739 056 178). Kurýr vám na něj pošle SMS o doručení.';

/** Trvalá poznámka pod polem Telefon — jednotlivci (vyžadujeme mobil). */
export const PHONE_CZ_COURIER_NOTE =
  'Uveďte prosím skutečné mobilní číslo. Vyžaduje ho přepravní společnost – kurýr vás na něm bude kontaktovat a pošle SMS o doručení. S neplatným číslem nelze zásilku odeslat.';

/** Trvalá poznámka pod polem Telefon — školy a firmy (povolena i pevná linka). */
export const PHONE_CZ_COURIER_NOTE_SCHOOL =
  'Uveďte prosím skutečné číslo, na kterém vás kurýr zastihne – vyžaduje ho přepravní společnost. Ideálně mobil: na pevnou linku nepřijde SMS o doručení. S neplatným číslem nelze zásilku odeslat.';

export type CzechPhoneKind = 'mobile' | 'landline';

export type CzechPhoneCheck =
  | { ok: true; phone: string; kind: CzechPhoneKind }
  | { ok: false; error: string };

/** Mobilní sítě: 601–608 a 702–799. */
const MOBILE_NATIONAL = /^(60[1-8]|70[2-9]|7[1-9]\d)\d{6}$/;
/** Pevné linky 2xx–5xx, VoIP 910 a neveřejné sítě 95x–97x (na číslo se dá zavolat, SMS nepřijde). */
const LANDLINE_NATIONAL = /^([2-5]\d{2}|910|9[5-7]\d)\d{6}$/;

const ASCENDING_DIGITS = '0123456789';
const DESCENDING_DIGITS = '9876543210';

/** Normalizuje formát na `+420XXXXXXXXX`; neřeší, jestli předvolba existuje. */
export function normalizeCzechPhone(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const compact = value.replace(/[\s().-]+/g, '');
  if (/^\+420\d{9}$/.test(compact)) return compact;
  if (/^00420\d{9}$/.test(compact)) return `+420${compact.slice(5)}`;
  if (/^420\d{9}$/.test(compact)) return `+420${compact.slice(3)}`;
  if (/^\d{9}$/.test(compact)) return `+420${compact}`;

  return null;
}

function looksMadeUp(national: string): boolean {
  if (/^(\d)\1{8}$/.test(national)) return true;
  const subscriber = national.slice(3);
  return ASCENDING_DIGITS.includes(subscriber) || DESCENDING_DIGITS.includes(subscriber);
}

/** Druh čísla podle číslovacího plánu; `null` = v ČR neexistuje nebo je zjevně vymyšlené. */
export function czechPhoneKind(raw: unknown): CzechPhoneKind | null {
  const normalized = normalizeCzechPhone(raw);
  if (!normalized) return null;
  const national = normalized.slice(4);
  if (looksMadeUp(national)) return null;
  if (MOBILE_NATIONAL.test(national)) return 'mobile';
  if (LANDLINE_NATIONAL.test(national)) return 'landline';
  return null;
}

/**
 * Kontrola telefonu pro objednávku. Jednotlivci musí zadat mobil (SMS od dopravce),
 * školy a firmy (`allowLandline`) mohou zadat i pevnou linku.
 */
export function checkCzechPhone(raw: unknown, options: { allowLandline: boolean }): CzechPhoneCheck {
  const value = String(raw ?? '').trim();
  if (!value) return { ok: false, error: 'Vyplňte telefon.' };
  const phone = normalizeCzechPhone(value);
  if (!phone) return { ok: false, error: PHONE_CZ_HINT };
  const kind = czechPhoneKind(phone);
  if (!kind) return { ok: false, error: PHONE_CZ_NOT_EXISTING_HINT };
  if (kind === 'landline' && !options.allowLandline) return { ok: false, error: PHONE_CZ_MOBILE_HINT };
  return { ok: true, phone, kind };
}

export function isValidCzechPhone(raw: unknown, options: { allowLandline: boolean } = { allowLandline: true }): boolean {
  return checkCzechPhone(raw, options).ok;
}

/**
 * Najde platné české číslo ve volném textu — z Pipedrivu chodí `tel:583213910`,
 * dvě čísla v jednom poli nebo číslo slepené se jménem. Přednost má mobil.
 */
export function extractCzechPhone(raw: unknown): string | null {
  const text = String(raw ?? '');
  /** Bez lookbehind — modul se balí i do frontendu a starší Safari by na něm spadl. */
  const candidates = text.matchAll(/(?:^|\D)((?:(?:\+|00)\s*420|420)?[\s().\-/]*\d{3}[\s.\-/]*\d{3}[\s.\-/]*\d{3})(?!\d)/g);
  let landline: string | null = null;
  for (const [, candidate] of candidates) {
    const phone = normalizeCzechPhone(candidate.replace(/\//g, ''));
    const kind = phone ? czechPhoneKind(phone) : null;
    if (kind === 'mobile') return phone;
    if (kind === 'landline' && !landline) landline = phone;
  }
  return landline;
}
