/**
 * DVPP zdarma — databáze škol.
 *
 * Tabulka `schools` (jeden řádek na školu z rejstříku) nahrazuje CSV v paměti jako zdroj
 * pro párování kontaktů. Import bere záznamy z existujícího CSV parseru v index.tsx
 * (`loadSchoolsCache`) a doplňuje velikost sboru z volitelného druhého souboru (statistika MŠMT).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { domainFromWebOrEmail, estimateTeachersFromPupils, schoolDomainFromEmail, schoolStatusFrom } from './milestones.ts';
import { icoDigits, nowIso } from './shared.ts';

/** Záznam z CSV parseru v index.tsx (SchoolRecord) — jen pole, která potřebujeme. */
export type RegistryRecord = {
  name: string;
  ico: string;
  address?: string;
  kraj?: string;
  typ?: string;
  reditel?: string;
  email?: string;
  redIzo?: string;
  web?: string;
  izo?: string;
  pupils?: number | string;
  teachers?: number | string;
  city?: string;
  zip?: string;
  street?: string;
  district?: string;
  founder?: string;
};

export type SchoolRow = {
  red_izo: string;
  izo: string | null;
  ico: string | null;
  name: string;
  type: string | null;
  is_primary: boolean;
  city: string | null;
  region: string | null;
  director_name: string | null;
  email: string | null;
  web: string | null;
  pupils_count: number | null;
  teachers_count: number | null;
  teachers_estimated: boolean;
  domain: string | null;
  status: string;
  status_reason: string | null;
};

export const SCHOOL_COLUMNS =
  'red_izo, izo, ico, name, type, is_primary, city, region, director_name, email, web, pupils_count, teachers_count, teachers_estimated, domain, status, status_reason';

/** RED_IZO z rejstříku, nebo náhradní klíč „9“+IČO, když rejstříkový export RED_IZO nenese. */
export function resolveRedIzo(rec: { redIzo?: string; ico?: string }): string | null {
  const r = String(rec.redIzo || '').replace(/\D/g, '');
  if (/^\d{9}$/.test(r)) return r;
  const ico = icoDigits(rec.ico);
  if (ico) return `9${ico}`;
  return null;
}

function parseAddress(address: string | undefined): { street: string | null; city: string | null; zip: string | null } {
  const a = String(address || '').trim();
  if (!a) return { street: null, city: null, zip: null };
  const parts = a.split(',').map((s) => s.trim()).filter(Boolean);
  const zipMatch = a.match(/\b(\d{3}\s?\d{2})\b/);
  const zip = zipMatch ? zipMatch[1].replace(/\s/g, '') : null;
  const street = parts[0] || null;
  const cityRaw = parts[1] || null;
  const city = cityRaw ? cityRaw.replace(/\b\d{3}\s?\d{2}\b/, '').trim() || null : null;
  return { street, city, zip };
}

function isPrimaryType(typ: string | undefined, name: string): boolean {
  const t = `${typ || ''} ${name}`.toLowerCase();
  return t.includes('základní škola') || t.includes('zakladni skola') || /\bzš\b/.test(t) || t.startsWith('zš');
}

function toInt(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(/\s/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Import / aktualizace rejstříku. Vrací počty. Bezpečné opakovat (upsert podle red_izo). */
export async function importRegistry(
  sb: SupabaseClient,
  records: RegistryRecord[],
): Promise<{ upserted: number; skipped: number; withTeachers: number }> {
  let upserted = 0, skipped = 0, withTeachers = 0;
  const batch: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const flush = async () => {
    if (!batch.length) return;
    const { error } = await sb.from('schools').upsert(batch, { onConflict: 'red_izo', ignoreDuplicates: false });
    if (error) console.warn('[dvpp/schools] upsert batch', error.message);
    else upserted += batch.length;
    batch.length = 0;
  };

  for (const rec of records) {
    const redIzo = resolveRedIzo(rec);
    if (!redIzo || !rec.name || seen.has(redIzo)) { skipped++; continue; }
    seen.add(redIzo);
    const addr = parseAddress(rec.address);
    const pupils = toInt(rec.pupils);
    const teachersKnown = toInt(rec.teachers);
    const teachers = teachersKnown ?? estimateTeachersFromPupils(pupils);
    if (teachersKnown) withTeachers++;
    const domain = domainFromWebOrEmail(rec.web || '') || domainFromWebOrEmail(rec.email || '') || null;
    batch.push({
      red_izo: redIzo,
      izo: rec.izo ? String(rec.izo).replace(/\D/g, '') || null : null,
      ico: icoDigits(rec.ico),
      name: String(rec.name).trim(),
      type: rec.typ?.trim() || null,
      is_primary: isPrimaryType(rec.typ, rec.name),
      street: rec.street?.trim() || addr.street,
      city: rec.city?.trim() || addr.city,
      zip: rec.zip?.replace(/\s/g, '') || addr.zip,
      region: rec.kraj?.trim() || null,
      district: rec.district?.trim() || null,
      director_name: rec.reditel?.trim() || null,
      email: rec.email?.trim().toLowerCase() || null,
      web: rec.web?.trim() || null,
      founder_type: rec.founder?.trim() || null,
      pupils_count: pupils,
      teachers_count: teachers,
      teachers_estimated: !teachersKnown,
      domain,
      source: /^9\d{8}$/.test(redIzo) && !rec.redIzo ? 'registry-ico' : 'registry',
      updated_at: nowIso(),
    });
    if (batch.length >= 400) await flush();
  }
  await flush();
  return { upserted, skipped, withTeachers };
}

export async function findSchoolByRedIzo(sb: SupabaseClient, redIzo: string): Promise<SchoolRow | null> {
  const { data } = await sb.from('schools').select(SCHOOL_COLUMNS).eq('red_izo', redIzo).maybeSingle();
  return (data as SchoolRow | null) ?? null;
}

export async function findSchoolByIco(sb: SupabaseClient, ico: string): Promise<SchoolRow | null> {
  const d = icoDigits(ico);
  if (!d) return null;
  const { data } = await sb
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .eq('ico', d)
    .order('is_primary', { ascending: false })
    .limit(1);
  return ((data || [])[0] as SchoolRow | undefined) ?? null;
}

export async function findSchoolByDomain(sb: SupabaseClient, domain: string): Promise<SchoolRow | null> {
  const d = String(domain || '').toLowerCase();
  if (!d) return null;
  const { data } = await sb.from('schools').select(SCHOOL_COLUMNS).eq('domain', d).limit(2);
  const rows = (data || []) as SchoolRow[];
  /* Doména sdílená víc školami (zřizovatel) — nepárovat automaticky. */
  return rows.length === 1 ? rows[0] : null;
}

export async function searchSchools(sb: SupabaseClient, q: string, limit = 12): Promise<SchoolRow[]> {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const { data } = await sb
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .or(`name.ilike.%${term.replace(/[%,]/g, '')}%,city.ilike.%${term.replace(/[%,]/g, '')}%`)
    .order('is_primary', { ascending: false })
    .order('name')
    .limit(limit);
  return (data || []) as SchoolRow[];
}

/**
 * Najde školu pro kontakt: 1) IČO z formuláře, 2) doména školního e-mailu (jen jednoznačná).
 */
export async function resolveSchoolForContact(
  sb: SupabaseClient,
  input: { ico?: string | null; email?: string | null; redIzo?: string | null },
): Promise<{ school: SchoolRow; via: 'red_izo' | 'ico' | 'domain' } | null> {
  if (input.redIzo) {
    const s = await findSchoolByRedIzo(sb, input.redIzo);
    if (s) return { school: s, via: 'red_izo' };
  }
  if (input.ico) {
    const s = await findSchoolByIco(sb, input.ico);
    if (s) return { school: s, via: 'ico' };
  }
  const domain = schoolDomainFromEmail(input.email || '');
  if (domain) {
    const s = await findSchoolByDomain(sb, domain);
    if (s) return { school: s, via: 'domain' };
  }
  return null;
}

/** Nastaví školu kontaktu (jen když ještě žádnou nemá, nebo `force`). */
export async function linkSubscriberToSchool(
  sb: SupabaseClient,
  subscriberId: string,
  redIzo: string,
  opts: { force?: boolean } = {},
): Promise<{ linked: boolean; changed: boolean }> {
  const { data: cur } = await sb.from('subscribers').select('school_red_izo').eq('id', subscriberId).maybeSingle();
  const existing = (cur as { school_red_izo?: string | null } | null)?.school_red_izo || null;
  if (existing && !opts.force) return { linked: true, changed: false };
  if (existing === redIzo) return { linked: true, changed: false };
  const { error } = await sb.from('subscribers').update({ school_red_izo: redIzo }).eq('id', subscriberId);
  if (error) { console.warn('[dvpp/schools] link', error.message); return { linked: false, changed: false }; }
  await sb.from('schools').update({ first_contact_at: nowIso() }).eq('red_izo', redIzo).is('first_contact_at', null);
  return { linked: true, changed: true };
}

/** Přepočet stavu jedné školy (customer / staffroom / active / trace / blank / lost). */
export async function refreshSchoolStatus(sb: SupabaseClient, redIzo: string): Promise<string | null> {
  const [{ count: active }, { count: any }, { data: sr }, { data: cust }] = await Promise.all([
    sb.from('subscribers').select('id', { count: 'exact', head: true }).eq('school_red_izo', redIzo).eq('status', 'subscribed'),
    sb.from('subscribers').select('id', { count: 'exact', head: true }).eq('school_red_izo', redIzo),
    sb.from('staffrooms').select('status').eq('red_izo', redIzo).maybeSingle(),
    sb.from('subscribers').select('id', { count: 'exact', head: true }).eq('school_red_izo', redIzo).eq('is_customer', true),
  ]);
  const status = schoolStatusFrom({
    isCustomer: (cust as unknown as { count?: number } | null)?.count ? true : false,
    staffroomStatus: ((sr as { status?: string } | null)?.status as 'building' | 'unlocked' | 'grace' | 'expired' | undefined) ?? null,
    activeContacts: active || 0,
    everHadContacts: (any || 0) > 0,
  });
  await sb.from('schools').update({ status }).eq('red_izo', redIzo);
  return status;
}

/**
 * Zpětné dopárování báze podle domény školního e-mailu. Běží po dávkách (cron / admin),
 * jen pro kontakty bez školy a jen tam, kde doména patří právě jedné škole.
 */
export async function backfillSchoolsByDomain(
  sb: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<{ scanned: number; linked: number }> {
  const limit = opts.limit ?? 500;
  const { data } = await sb
    .from('subscribers')
    .select('id, email')
    .is('school_red_izo', null)
    .eq('status', 'subscribed')
    .order('created_at', { ascending: false })
    .limit(limit);
  let linked = 0;
  const cache = new Map<string, SchoolRow | null>();
  for (const row of (data || []) as Array<{ id: string; email: string }>) {
    const domain = schoolDomainFromEmail(row.email);
    if (!domain) continue;
    let school = cache.get(domain);
    if (school === undefined) { school = await findSchoolByDomain(sb, domain); cache.set(domain, school); }
    if (!school) continue;
    const r = await linkSubscriberToSchool(sb, row.id, school.red_izo);
    if (r.changed) linked++;
  }
  return { scanned: (data || []).length, linked };
}

/** Přehled pokrytí pro dashboard: školy podle stavu + top školy bez sborovny. */
export async function coverageSummary(sb: SupabaseClient): Promise<{
  byStatus: Record<string, number>;
  primarySchools: number;
  schoolsWithContacts: number;
  staffrooms: Record<string, number>;
}> {
  const [{ data: st }, { count: primary }, { data: sr }] = await Promise.all([
    sb.from('schools').select('status').eq('is_primary', true).limit(10000),
    sb.from('schools').select('red_izo', { count: 'exact', head: true }).eq('is_primary', true),
    sb.from('staffrooms').select('status').limit(10000),
  ]);
  const byStatus: Record<string, number> = {};
  for (const r of (st || []) as Array<{ status: string }>) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const staffrooms: Record<string, number> = {};
  for (const r of (sr || []) as Array<{ status: string }>) staffrooms[r.status] = (staffrooms[r.status] || 0) + 1;
  const schoolsWithContacts = Object.entries(byStatus)
    .filter(([k]) => k !== 'blank' && k !== 'lost')
    .reduce((a, [, v]) => a + v, 0);
  return { byStatus, primarySchools: primary || 0, schoolsWithContacts, staffrooms };
}
