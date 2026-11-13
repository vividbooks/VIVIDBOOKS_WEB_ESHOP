/**
 * Certifikáty ze školení pro školy (ne z webinářů).
 *
 * Obchodník po školení založí v adminu záznam (název, datum, délka, lektor, typ dokladu)
 * a škole pošle odkaz `/skoleni/certifikat/:token`. Učitel tam zadá jméno, e-mail a
 * u DVPP datum narození a certifikát si stáhne. Certifikát se sází v prohlížeči stejně
 * jako u webinářů; server drží jen definici školení a evidenci, komu byl vydán.
 *
 * KV:
 *   skoleni_certdef_{token}            definice školení
 *   skoleni_certissue_{token}_{email}  vydaný certifikát
 */
import type { Hono } from 'npm:hono';

const ROOT = '/make-server-93a20b6f/skoleni-certifikaty';
const DEF_PREFIX = 'skoleni_certdef_';
const ISSUE_PREFIX = 'skoleni_certissue_';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

export type SkoleniCertKind = 'dvpp' | 'ucast';
export type SkoleniCertForm = 'online' | 'prezencni';

export interface SkoleniCertDef {
  token: string;
  title: string;
  schoolName: string;
  dateIso: string;
  time: string;
  durationMinutes: number;
  lecturer: string;
  form: SkoleniCertForm;
  kind: SkoleniCertKind;
  /** Prázdné = certifikát si vystaví kdokoli s odkazem. */
  allowedEmails: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface SkoleniCertIssue {
  token: string;
  email: string;
  name: string;
  birthDateIso: string;
  firstIssuedAt: string;
  issuedAt: string;
}

type AdminGate = (req: Request) => Promise<Response | { email?: string | null } | unknown>;

/** Část KV úložiště, kterou routy potřebují (v testu se nahrazuje pamětí). */
export interface SkoleniCertStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  getByPrefix(prefix: string): Promise<unknown[]>;
}

export function parseEmailList(raw: unknown): string[] {
  const text = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '');
  const out: string[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const e = part.trim().toLowerCase();
    if (EMAIL_RE.test(e) && !out.includes(e)) out.push(e);
  }
  return out;
}

/** Ověří a znormalizuje vstup z adminu. Vrací chybu jako text, jinak hotová pole. */
export function normalizeSkoleniCertInput(
  body: Record<string, unknown>,
): { error: string } | Omit<SkoleniCertDef, 'token' | 'createdAt' | 'createdBy' | 'updatedAt'> {
  const title = String(body.title ?? '').trim().slice(0, 200);
  const schoolName = String(body.schoolName ?? '').trim().slice(0, 200);
  const dateIso = String(body.dateIso ?? '').trim();
  const time = String(body.time ?? '').trim();
  const lecturer = String(body.lecturer ?? '').trim().slice(0, 200);
  const durationMinutes = Math.round(Number(body.durationMinutes));
  const form = body.form === 'prezencni' ? 'prezencni' : body.form === 'online' ? 'online' : '';
  const kind = body.kind === 'dvpp' ? 'dvpp' : body.kind === 'ucast' ? 'ucast' : '';

  if (!title) return { error: 'Chybí název školení.' };
  if (!DATE_RE.test(dateIso)) return { error: 'Chybí datum školení.' };
  if (time && !TIME_RE.test(time)) return { error: 'Čas zadejte jako 16:00.' };
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 600) {
    return { error: 'Délka školení musí být 15 až 600 minut.' };
  }
  if (!form) return { error: 'Vyberte, jestli školení proběhlo online, nebo ve škole.' };
  if (!kind) return { error: 'Vyberte typ dokladu: certifikát DVPP, nebo potvrzení o účasti.' };

  return {
    title,
    schoolName,
    dateIso,
    time,
    durationMinutes,
    lecturer,
    form,
    kind,
    allowedEmails: parseEmailList(body.allowedEmails),
  };
}

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

function publicDef(def: SkoleniCertDef) {
  return {
    token: def.token,
    title: def.title,
    schoolName: def.schoolName,
    dateIso: def.dateIso,
    time: def.time,
    durationMinutes: def.durationMinutes,
    lecturer: def.lecturer,
    form: def.form,
    kind: def.kind,
    restricted: def.allowedEmails.length > 0,
  };
}

export function registerSkoleniCertRoutes(
  app: Hono,
  deps: { requireAdmin: AdminGate; store: SkoleniCertStore },
): void {
  const kv = deps.store;
  /* ---------- admin ---------- */

  app.get(ROOT, async (c) => {
    const gate = await deps.requireAdmin(c.req.raw);
    if (gate instanceof Response) return gate;
    const defs = ((await kv.getByPrefix(DEF_PREFIX)) as SkoleniCertDef[]).filter((d) => d && d.token);
    const issues = ((await kv.getByPrefix(ISSUE_PREFIX)) as SkoleniCertIssue[]).filter((i) => i && i.token);
    const byToken = new Map<string, SkoleniCertIssue[]>();
    for (const i of issues) {
      const list = byToken.get(i.token) || [];
      list.push(i);
      byToken.set(i.token, list);
    }
    const items = defs
      .sort((a, b) => (a.dateIso < b.dateIso ? 1 : a.dateIso > b.dateIso ? -1 : 0))
      .map((d) => ({
        ...d,
        issued: (byToken.get(d.token) || []).sort((a, b) => a.name.localeCompare(b.name, 'cs')),
      }));
    return c.json({ items });
  });

  app.post(ROOT, async (c) => {
    const gate = await deps.requireAdmin(c.req.raw);
    if (gate instanceof Response) return gate;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = normalizeSkoleniCertInput(body);
    if ('error' in parsed) return c.json({ error: parsed.error }, 400);

    const now = new Date().toISOString();
    const existingToken = String(body.token ?? '').trim();
    const prev = existingToken ? ((await kv.get(`${DEF_PREFIX}${existingToken}`)) as SkoleniCertDef | null) : null;
    if (existingToken && !prev) return c.json({ error: 'Školení nebylo nalezeno.' }, 404);

    const def: SkoleniCertDef = {
      ...parsed,
      token: prev?.token || newToken(),
      createdAt: prev?.createdAt || now,
      createdBy: prev?.createdBy || String((gate as { email?: string | null })?.email || ''),
      updatedAt: now,
    };
    await kv.set(`${DEF_PREFIX}${def.token}`, def);
    return c.json({ item: def });
  });

  app.delete(`${ROOT}/:token`, async (c) => {
    const gate = await deps.requireAdmin(c.req.raw);
    if (gate instanceof Response) return gate;
    const token = c.req.param('token');
    await kv.del(`${DEF_PREFIX}${token}`);
    return c.json({ ok: true });
  });

  /* ---------- veřejné (učitel s odkazem) ---------- */

  app.get(`${ROOT}/verejne/:token`, async (c) => {
    const def = (await kv.get(`${DEF_PREFIX}${c.req.param('token')}`)) as SkoleniCertDef | null;
    if (!def) return c.json({ error: 'Odkaz na certifikát neplatí.' }, 404);
    return c.json({ skoleni: publicDef(def) });
  });

  app.post(`${ROOT}/verejne/:token/vydat`, async (c) => {
    const def = (await kv.get(`${DEF_PREFIX}${c.req.param('token')}`)) as SkoleniCertDef | null;
    if (!def) return c.json({ error: 'Odkaz na certifikát neplatí.' }, 404);

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim().slice(0, 120);
    const birthDateIso = String(body.birthDateIso ?? '').trim();

    if (!name) return c.json({ error: 'Vyplňte jméno a příjmení.' }, 400);
    if (!EMAIL_RE.test(email)) return c.json({ error: 'Zadejte platný e-mail.' }, 400);
    if (def.kind === 'dvpp' && !DATE_RE.test(birthDateIso)) {
      return c.json({ error: 'Vyplňte datum narození.' }, 400);
    }
    if (def.allowedEmails.length > 0 && !def.allowedEmails.includes(email)) {
      return c.json(
        {
          error:
            'Tento e-mail není na seznamu účastníků školení. Zkuste školní e-mail, nebo napište tomu, kdo vám odkaz poslal.',
        },
        403,
      );
    }

    const key = `${ISSUE_PREFIX}${def.token}_${email}`;
    const prev = (await kv.get(key)) as SkoleniCertIssue | null;
    const now = new Date().toISOString();
    const issue: SkoleniCertIssue = {
      token: def.token,
      email,
      name,
      birthDateIso: def.kind === 'dvpp' ? birthDateIso : '',
      firstIssuedAt: prev?.firstIssuedAt || now,
      issuedAt: now,
    };
    await kv.set(key, issue);
    return c.json({ ok: true, skoleni: publicDef(def) });
  });
}
