import { assertEquals } from 'jsr:@std/assert';
import { Hono } from 'npm:hono';
import {
  normalizeSkoleniCertInput,
  parseEmailList,
  registerSkoleniCertRoutes,
  type SkoleniCertStore,
} from './skoleniCertifikaty.ts';

const ROOT = 'http://x/make-server-93a20b6f/skoleni-certifikaty';

function memoryStore(): SkoleniCertStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: (k) => Promise.resolve(data.get(k) ?? null),
    set: (k, v) => Promise.resolve(void data.set(k, v)),
    del: (k) => Promise.resolve(void data.delete(k)),
    getByPrefix: (p) => Promise.resolve([...data].filter(([k]) => k.startsWith(p)).map(([, v]) => v)),
  };
}

function setup(admin = true) {
  const app = new Hono();
  const store = memoryStore();
  registerSkoleniCertRoutes(app, {
    store,
    requireAdmin: () =>
      Promise.resolve(admin ? { email: 'iveta@vividbooks.com' } : new Response('no', { status: 401 })),
  });
  const post = (url: string, body: unknown) =>
    app.fetch(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { app, store, post };
}

const VALID = {
  title: 'Školení Vividbooks',
  schoolName: 'ZŠ Testovací',
  dateIso: '2026-11-02',
  time: '16:00',
  durationMinutes: 60,
  lecturer: 'Iveta Fišerová',
  form: 'online',
  kind: 'dvpp',
  allowedEmails: 'A@skola.cz, b@skola.cz\nnesmysl',
};

Deno.test('parseEmailList čistí, sjednotí velikost a zahodí neplatné', () => {
  assertEquals(parseEmailList('A@x.cz; a@x.cz\n b@y.cz, blbost'), ['a@x.cz', 'b@y.cz']);
});

Deno.test('typ dokladu a forma se musí vybrat výslovně', () => {
  assertEquals('error' in normalizeSkoleniCertInput({ ...VALID, kind: '' }), true);
  assertEquals('error' in normalizeSkoleniCertInput({ ...VALID, form: '' }), true);
  assertEquals('error' in normalizeSkoleniCertInput({ ...VALID, durationMinutes: 5 }), true);
  assertEquals('error' in normalizeSkoleniCertInput(VALID), false);
});

Deno.test('admin routy bez přihlášení vrací 401', async () => {
  const { app, post } = setup(false);
  assertEquals((await app.fetch(new Request(ROOT))).status, 401);
  assertEquals((await post(ROOT, VALID)).status, 401);
});

Deno.test('založení, veřejné čtení, vydání a evidence', async () => {
  const { app, post } = setup();
  const created = await (await post(ROOT, VALID)).json();
  const token = created.item.token as string;
  assertEquals(token.length, 20);
  assertEquals(created.item.createdBy, 'iveta@vividbooks.com');

  const pub = await (await app.fetch(new Request(`${ROOT}/verejne/${token}`))).json();
  assertEquals(pub.skoleni.restricted, true);
  assertEquals('allowedEmails' in pub.skoleni, false);

  // cizí e-mail neprojde, u DVPP je nutné datum narození
  assertEquals((await post(`${ROOT}/verejne/${token}/vydat`, { name: 'X Y', email: 'cizi@jinde.cz', birthDateIso: '1980-01-01' })).status, 403);
  assertEquals((await post(`${ROOT}/verejne/${token}/vydat`, { name: 'Jana Nová', email: 'a@skola.cz' })).status, 400);
  assertEquals((await post(`${ROOT}/verejne/${token}/vydat`, { name: 'Jana Nová', email: 'A@skola.cz', birthDateIso: '1980-01-01' })).status, 200);
  // opakované stažení nezaloží druhý záznam
  assertEquals((await post(`${ROOT}/verejne/${token}/vydat`, { name: 'Mgr. Jana Nová', email: 'a@skola.cz', birthDateIso: '1980-01-01' })).status, 200);

  const list = await (await app.fetch(new Request(ROOT))).json();
  assertEquals(list.items.length, 1);
  assertEquals(list.items[0].issued.length, 1);
  assertEquals(list.items[0].issued[0].name, 'Mgr. Jana Nová');

  // úprava zachová token
  const edited = await (await post(ROOT, { ...VALID, token, kind: 'ucast', allowedEmails: '' })).json();
  assertEquals(edited.item.token, token);
  assertEquals((await post(`${ROOT}/verejne/${token}/vydat`, { name: 'Kdo Koli', email: 'kdo@koli.cz' })).status, 200);

  assertEquals((await app.fetch(new Request(`${ROOT}/${token}`, { method: 'DELETE' }))).status, 200);
  assertEquals((await app.fetch(new Request(`${ROOT}/verejne/${token}`))).status, 404);
});

Deno.test('neplatný odkaz vrací 404', async () => {
  const { app } = setup();
  assertEquals((await app.fetch(new Request(`${ROOT}/verejne/neexistuje`))).status, 404);
});
