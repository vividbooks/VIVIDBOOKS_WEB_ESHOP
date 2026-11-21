/** deno test --node-modules-dir=none --allow-read src/supabase/functions/server/pipedrivePersonContacts_test.ts */
import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  buildPipedriveContactPatch,
  mergePipedriveContactValue,
  normalizePipedriveContactValue,
  readPipedriveContactEntries,
} from './pipedrivePersonContacts.ts';

/* ---------- normalizace ---------- */

Deno.test('telefon: +420 / 00420 / mezery = stejné číslo', () => {
  const a = normalizePipedriveContactValue('phone', '+420728161630');
  assertEquals(a, '728161630');
  assertEquals(normalizePipedriveContactValue('phone', '00420 728 161 630'), a);
  assertEquals(normalizePipedriveContactValue('phone', '728 161 630'), a);
});

Deno.test('e-mail: porovnání bez ohledu na velikost písmen', () => {
  assertEquals(normalizePipedriveContactValue('email', ' Drazkova.J@Gmail.com '), 'drazkova.j@gmail.com');
});

/* ---------- čtení obou tvarů odpovědi Pipedrive ---------- */

Deno.test('čtení: plný záznam s objekty je complete', () => {
  const r = readPipedriveContactEntries({ phone: [{ value: '+420111222333', primary: true, label: 'mobile' }] }, 'phone');
  assertEquals(r.complete, true);
  assertEquals(r.entries, [{ value: '+420111222333', primary: true, label: 'mobile' }]);
});

Deno.test('čtení: prázdný telefon z výpisu osob ({value:""}) = žádná hodnota', () => {
  const r = readPipedriveContactEntries({ phone: [{ value: '', primary: true }] }, 'phone');
  assertEquals(r.entries, []);
  assertEquals(r.complete, true);
});

Deno.test('čtení: odpověď search (phones: [string]) není complete', () => {
  const r = readPipedriveContactEntries({ phones: ['+420111222333'] }, 'phone');
  assertEquals(r.complete, false);
  assertEquals(r.entries.length, 1);
});

/* ---------- slučování ---------- */

Deno.test('merge: osoba bez telefonu → nový telefon je primární', () => {
  assertEquals(mergePipedriveContactValue([], 'phone', '+420728161630'), [
    { value: '+420728161630', primary: true, label: 'work' },
  ]);
});

Deno.test('merge: stávající číslo zůstane, nové se přidá (nepřepisuje)', () => {
  const merged = mergePipedriveContactValue(
    [{ value: '+420111222333', primary: true, label: 'mobile' }],
    'phone',
    '+420728161630',
  );
  assertEquals(merged, [
    { value: '+420111222333', primary: true, label: 'mobile' },
    { value: '+420728161630', primary: false, label: 'work' },
  ]);
});

Deno.test('merge: stejné číslo v jiném formátu → nic neposílat', () => {
  assertEquals(
    mergePipedriveContactValue([{ value: '728 161 630', primary: true, label: 'work' }], 'phone', '+420728161630'),
    null,
  );
});

/* ---------- patch pro existující osobu ---------- */

Deno.test('VB-2026-0634: osoba z organizace s jiným e-mailem a bez telefonu dostane telefon i e-mail', async () => {
  const existing = {
    id: 34714,
    name: 'Jana Drazkova',
    email: [{ value: 'jana.hrabosh@gmail.com', primary: true, label: 'work' }],
    phone: [{ value: '', primary: true }],
  };
  let loaded = 0;
  const patch = await buildPipedriveContactPatch(
    existing,
    { phone: '+420728161630', email: 'drazkova.j@gmail.com' },
    async () => {
      loaded++;
      return null;
    },
  );
  assertEquals(loaded, 0);
  assertEquals(patch.phone, [{ value: '+420728161630', primary: true, label: 'work' }]);
  assertEquals(patch.email, [
    { value: 'jana.hrabosh@gmail.com', primary: true, label: 'work' },
    { value: 'drazkova.j@gmail.com', primary: false, label: 'work' },
  ]);
});

Deno.test('osoba už telefon i e-mail má → prázdný patch', async () => {
  const patch = await buildPipedriveContactPatch(
    { phones: ['728161630'], emails: ['drazkova.j@gmail.com'] },
    { phone: '+420728161630', email: 'drazkova.j@gmail.com' },
    async () => {
      throw new Error('nemá se načítat');
    },
  );
  assertEquals(patch, {});
});

Deno.test('search hit s jiným číslem → načte plný záznam a zachová štítky', async () => {
  const patch = await buildPipedriveContactPatch(
    { phones: ['+420111222333'], emails: ['a@b.cz'] },
    { phone: '+420728161630', email: 'a@b.cz' },
    async () => ({ phone: [{ value: '+420111222333', primary: true, label: 'mobile' }], email: [{ value: 'a@b.cz', primary: true, label: 'work' }] }),
  );
  assertEquals(patch, {
    phone: [
      { value: '+420111222333', primary: true, label: 'mobile' },
      { value: '+420728161630', primary: false, label: 'work' },
    ],
  });
});

Deno.test('search hit a plný záznam nejde načíst → nic nepřepisovat', async () => {
  const patch = await buildPipedriveContactPatch({ phones: ['+420111222333'] }, { phone: '+420728161630' }, async () => null);
  assertEquals(patch, {});
});

/* ---------- zapojení ve findOrCreatePipedrivePerson (index.tsx) ---------- */

Deno.test('index.tsx: osoba dohledaná v organizaci dostane link patch, telefon jde přes buildPipedriveContactPatch', async () => {
  const src = await Deno.readTextFile(new URL('./index.tsx', import.meta.url));
  const start = src.indexOf('async function findOrCreatePipedrivePerson(');
  assert(start > 0, 'findOrCreatePipedrivePerson nenalezena');
  const end = src.indexOf('\nasync function ', start + 10);
  const body = src.slice(start, end > 0 ? end : undefined);

  assert(
    !body.includes('updateExistingPerson(personId, existing, {})'),
    'fallback v osobách organizace posílá prázdný patch – telefon se nezapíše',
  );
  assert(body.includes('updateExistingPerson(personId, existing, computeLinkPatch(existing))'));
  assert(body.includes('buildPipedriveContactPatch('), 'updateExistingPerson musí doplňovat kontakty');
  const link = body.slice(body.indexOf('const computeLinkPatch'), body.indexOf('const computeLinkPatch') + 600);
  assert(!/extraPatch\.phone\s*=/.test(link), 'computeLinkPatch nesmí přepisovat telefon');
});
