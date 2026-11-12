/**
 * Povinná doručovací adresa distributorské objednávky (`/distributor`).
 *
 * Sdílí formulář `DistributorOrderPage` i Edge handler `POST …/distributor/orders`, aby validace
 * na stránce a na serveru nemohla rozejít. Adresa jde do existujících sloupců `orders.delivery_*`
 * (stejné jako „Doručit na jinou adresu“ v pokladně) a z ní se pak tiskne štítek zásilky.
 *
 * Předvyplnění poslední adresy je jen v prohlížeči (localStorage podle IČO) — odkaz na formulář
 * chrání jeden sdílený klíč, takže server adresy jiných partnerů podle IČO vracet nesmí.
 */
import { checkFullName } from '../../supabase/functions/_shared/person-name.ts';
import { parseFreeFormAddress } from '../../supabase/functions/_shared/czech-address-enrichment.ts';

export type DistributorDelivery = {
  recipientName: string;
  company: string;
  street: string;
  city: string;
  zip: string;
  /** Distributoři jsou jen z ČR — země je pevná. */
  country: 'CZ';
};

export type DistributorDeliveryField = 'recipientName' | 'company' | 'street' | 'city' | 'zip';

export type DistributorDeliveryCheck =
  | { ok: true; delivery: DistributorDelivery }
  | { ok: false; error: string; field: DistributorDeliveryField };

export const DISTRIBUTOR_DELIVERY_MISSING = 'Vyplňte doručovací adresu — bez ní objednávku nemůžeme odeslat.';

const MAX = { recipientName: 100, company: 200, street: 200, city: 100 } as const;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function emptyDistributorDelivery(company = ''): DistributorDelivery {
  return { recipientName: '', company, street: '', city: '', zip: '', country: 'CZ' };
}

/**
 * Kontrola doručovací adresy (formulář i server). Vrací první chybu česky + pole, kterého se týká.
 * PSČ přijímá „602 00“ i „60200“, ukládá se bez mezery.
 */
export function checkDistributorDelivery(raw: unknown): DistributorDeliveryCheck {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: DISTRIBUTOR_DELIVERY_MISSING, field: 'recipientName' };
  }
  const r = raw as Record<string, unknown>;
  const recipientName = clean(r.recipientName);
  const company = clean(r.company);
  const street = clean(r.street);
  const city = clean(r.city);
  const zipRaw = clean(r.zip).replace(/\s/g, '');

  if (!recipientName) {
    return { ok: false, error: 'Vyplňte jméno a příjmení příjemce zásilky.', field: 'recipientName' };
  }
  const name = checkFullName(recipientName);
  if (!name.ok) return { ok: false, error: `Příjemce zásilky: ${name.error}`, field: 'recipientName' };

  if (!company) return { ok: false, error: 'Vyplňte firmu příjemce zásilky.', field: 'company' };
  if (company.length > MAX.company) {
    return { ok: false, error: `Firma může mít nejvýš ${MAX.company} znaků.`, field: 'company' };
  }

  if (!street) return { ok: false, error: 'Vyplňte ulici a číslo popisné doručovací adresy.', field: 'street' };
  if (!/\d/.test(street) || !/\p{L}/u.test(street)) {
    return { ok: false, error: 'Ulice musí obsahovat i číslo popisné (např. Komunardů 1584/42).', field: 'street' };
  }
  if (street.length > MAX.street) {
    return { ok: false, error: `Ulice může mít nejvýš ${MAX.street} znaků.`, field: 'street' };
  }

  if (!city) return { ok: false, error: 'Vyplňte město doručovací adresy.', field: 'city' };
  if (!/\p{L}/u.test(city) || city.length > MAX.city) {
    return { ok: false, error: 'Zadejte platný název města.', field: 'city' };
  }

  if (!/^\d{5}$/.test(zipRaw)) {
    return { ok: false, error: 'Zadejte PSČ doručovací adresy (5 číslic).', field: 'zip' };
  }

  return {
    ok: true,
    delivery: { recipientName: name.name, company, street, city, zip: zipRaw, country: 'CZ' },
  };
}

/** Hodnoty pro existující sloupce `orders.delivery_*` (firma a země sloupec nemají). */
export function distributorDeliveryOrderColumns(delivery: DistributorDelivery) {
  return {
    delivery_recipient_name: delivery.recipientName,
    delivery_street: delivery.street,
    delivery_city: delivery.city,
    delivery_zip: delivery.zip,
  };
}

/** „Použít adresu sídla“ — rozloží adresu z rejstříku (CSV škol / ARES); jméno příjemce nechá. */
export function deliveryFromSeatAddress(
  current: DistributorDelivery,
  seat: { name?: string; address?: string },
): DistributorDelivery {
  const parts = parseFreeFormAddress(seat.address);
  return {
    ...current,
    company: clean(seat.name) || current.company,
    street: parts.street || current.street,
    city: parts.city || current.city,
    zip: parts.zip || current.zip,
    country: 'CZ',
  };
}

/* ---------- poslední použitá adresa (jen v prohlížeči, podle IČO) ---------- */

export const DISTRIBUTOR_DELIVERY_STORAGE_PREFIX = 'vividbooks_distributor_delivery:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storageKey(ico: string): string {
  return `${DISTRIBUTOR_DELIVERY_STORAGE_PREFIX}${String(ico || '').replace(/\D/g, '').replace(/^0+/, '')}`;
}

/** Poslední adresa použitá pro toto IČO v tomto prohlížeči, nebo `null`. Vadná data ignoruje. */
export function readLastDistributorDelivery(storage: StorageLike | null | undefined, ico: string): DistributorDelivery | null {
  if (!storage || !/^\d{6,10}$/.test(String(ico || '').replace(/\s/g, ''))) return null;
  try {
    const raw = storage.getItem(storageKey(ico));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      recipientName: clean(parsed.recipientName),
      company: clean(parsed.company),
      street: clean(parsed.street),
      city: clean(parsed.city),
      zip: clean(parsed.zip),
      country: 'CZ',
    };
  } catch {
    return null;
  }
}

/** Uloží adresu po úspěšném odeslání (soukromý režim / plné úložiště tiše ignoruje). */
export function rememberDistributorDelivery(
  storage: StorageLike | null | undefined,
  ico: string,
  delivery: DistributorDelivery,
): void {
  if (!storage || !/^\d{6,10}$/.test(String(ico || '').replace(/\s/g, ''))) return;
  try {
    storage.setItem(storageKey(ico), JSON.stringify(delivery));
  } catch {
    /* zablokované úložiště — příště se adresa jen nepředvyplní */
  }
}

/* ---------- přepínač Pipedrive (kv_store_33b2092f `distributor_pipedrive_sync`) ---------- */

export const DISTRIBUTOR_PIPEDRIVE_SYNC_KV_KEY = 'distributor_pipedrive_sync';

/**
 * Má objednávka distributora založit deal v Pipedrive (a propsat ho do Kabinetu)?
 * Chybějící / nečitelný klíč = `true` (tok jako dřív). Vypnout jde jen výslovným `false`
 * (také `"false"`, `0`, `{ enabled: false }`) — až obchod převezme automat v novém CRM.
 */
export function distributorPipedriveSyncEnabled(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (typeof value === 'string') return !['false', '0', 'off', 'ne'].includes(value.trim().toLowerCase());
  if (value && typeof value === 'object' && 'enabled' in (value as Record<string, unknown>)) {
    return distributorPipedriveSyncEnabled((value as Record<string, unknown>).enabled);
  }
  return true;
}
