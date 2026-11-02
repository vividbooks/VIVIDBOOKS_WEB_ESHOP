/**
 * Kontakt příjemce pro Base.com `addOrder` — poslední pojistka před přenosem do fulfilmentu.
 *
 * Fulfilment odmítne zásilku (Base stav Error FF), když `delivery_fullname` není celé jméno
 * a příjmení nebo chybí platný telefon pro kurýra. Formuláře na webu to už hlídají, sem ale
 * chodí i objednávky z Pipedrivu (telefon `tel:583…`, dvě čísla v poli, číslo slepené se jménem)
 * a starší rozpracované objednávky. Export proto nezastavujeme (admin nemá editaci údajů,
 * opravuje se v BaseLinkeru) — telefon zkusíme vytáhnout z textu a problémy vrátíme ke zobrazení.
 */

import { checkFullName } from './person-name.ts';
import { extractCzechPhone } from './phone-cz.ts';

export type BasecomContact = {
  deliveryFullname: string;
  phone: string;
  issues: string[];
};

export function prepareBasecomContact(input: {
  deliveryFullname: string | null | undefined;
  phone: string | null | undefined;
}): BasecomContact {
  const issues: string[] = [];

  const rawName = String(input.deliveryFullname ?? '').trim();
  const nameCheck = checkFullName(rawName);
  const deliveryFullname = nameCheck.ok ? nameCheck.name : rawName;
  if (!nameCheck.ok) {
    issues.push(rawName ? `Jméno příjemce „${rawName}“ není celé jméno a příjmení.` : 'Chybí jméno příjemce.');
  }

  const rawPhone = String(input.phone ?? '').trim();
  const phone = extractCzechPhone(rawPhone);
  if (!phone) {
    issues.push(rawPhone ? `Telefon „${rawPhone}“ není platné české číslo.` : 'Chybí telefon.');
  }

  return { deliveryFullname, phone: phone ?? rawPhone, issues };
}
