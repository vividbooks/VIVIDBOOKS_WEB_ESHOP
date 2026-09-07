/**
 * Trvalý rejstřík IČO → Pipedrive orgId nad KV tabulkou `kv_store_33b2092f`.
 *
 * Proč: `GET /organizations/search` čte z vyhledávacího indexu, který se po
 * `POST /organizations` plní se zpožděním (sekundy až minuty). Druhá objednávka
 * téže školy v tomhle okně organizaci nenajde a založí druhou. V produkci se to
 * stalo prokazatelně — `#39822` a `#39823` „KRPŠ při ZŠ Hustopeče nad Bečvou",
 * identický název i CIN `01228251`, obojí 24. 6. 2026.
 *
 * Rejstřík je zapsaný v Postgresu, takže platí **napříč instancemi edge funkce**
 * (na rozdíl od in‑memory `pipedriveSchoolLookupCache`) a je okamžitě konzistentní.
 *
 * Zámek: `insert` (ne `upsert`) na primární klíč `key` selže při konfliktu —
 * tím se atomicky rozhodne, který souběžný request smí organizaci založit.
 * Ostatní počkají na výsledek. Selhání KV nikdy neshodí synchronizaci —
 * vrátí se `{ mode: 'create' }` a chování je stejné jako před zavedením rejstříku.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { pipedriveOrgIcoRegistryKey } from '../../../../supabase/functions/_shared/pipedrive-org-ico.ts';

const KV_TABLE = 'kv_store_33b2092f';

/** Po téhle době se rozdělaný claim považuje za mrtvý (spadlý request) a přebírá se. */
const CLAIM_STALE_MS = 60_000;
/** Kolikrát a jak dlouho čekat, než souběžný request svůj claim dokončí. */
const CLAIM_WAIT_DELAYS_MS = [700, 1200, 2000, 3000];

type RegistryValue = { orgId?: number | null; pendingAt?: string | null; name?: string | null };

export type OrgRegistryDecision =
  /** Organizace je známá — použij `orgId`, nic nezakládej. */
  | { mode: 'reuse'; orgId: number; key: string }
  /** Claim držíme my (nebo rejstřík není dostupný) — smíš organizaci založit. */
  | { mode: 'create'; key: string | null };

let cachedClient: SupabaseClient | null = null;

function registryClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !serviceRoleKey) return null;
  cachedClient = createClient(url, serviceRoleKey);
  return cachedClient;
}

function parseOrgId(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

async function readValue(client: SupabaseClient, key: string): Promise<RegistryValue | null> {
  const { data, error } = await client.from(KV_TABLE).select('value').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.value ?? null) as RegistryValue | null;
}

/** Vyhledá organizaci v rejstříku bez zakládání claimu (rychlá cesta před search API). */
export async function lookupOrgIdByIco(ico: unknown): Promise<number | null> {
  const key = pipedriveOrgIcoRegistryKey(ico);
  const client = registryClient();
  if (!key || !client) return null;
  try {
    return parseOrgId((await readValue(client, key))?.orgId);
  } catch (error) {
    console.log(`[Pipedrive org registry] čtení selhalo (${key}): ${(error as Error).message}`);
    return null;
  }
}

/**
 * Rozhodne, jestli smíme organizaci pro tohle IČO založit.
 *
 * `reuse` = někdo ji už (právě) založil, převezmi jeho `orgId`.
 * `create` = claim je náš; po `POST /organizations` zavolej `resolveOrgClaim`,
 *            při chybě `releaseOrgClaim`, ať klíč nezůstane viset.
 */
export async function claimOrgCreationByIco(
  ico: unknown,
  params?: { name?: string },
): Promise<OrgRegistryDecision> {
  const key = pipedriveOrgIcoRegistryKey(ico);
  const client = registryClient();
  if (!key || !client) return { mode: 'create', key: null };

  const pending: RegistryValue = { orgId: null, pendingAt: new Date().toISOString(), name: params?.name || null };
  try {
    const { error } = await client.from(KV_TABLE).insert({ key, value: pending });
    /** Insert prošel → claim je náš, nikdo jiný organizaci nezakládá. */
    if (!error) return { mode: 'create', key };

    for (const delay of CLAIM_WAIT_DELAYS_MS) {
      const existing = await readValue(client, key);
      const orgId = parseOrgId(existing?.orgId);
      if (orgId) return { mode: 'reuse', orgId, key };

      const pendingAtMs = Date.parse(String(existing?.pendingAt || ''));
      const isStale = !Number.isFinite(pendingAtMs) || Date.now() - pendingAtMs > CLAIM_STALE_MS;
      if (isStale) {
        /** Předchozí request spadl mezi claimem a zápisem ID — claim přebíráme. */
        await client.from(KV_TABLE).upsert({ key, value: pending });
        return { mode: 'create', key };
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    /** Souběžný request se do ~7 s neozval — nečekáme dál a jdeme zakládat. */
    const last = parseOrgId((await readValue(client, key))?.orgId);
    if (last) return { mode: 'reuse', orgId: last, key };
    return { mode: 'create', key };
  } catch (error) {
    console.log(`[Pipedrive org registry] claim selhal (${key}): ${(error as Error).message}`);
    return { mode: 'create', key: null };
  }
}

/** Zapíše do rejstříku výsledné `orgId` (po založení i po nalezení existující organizace). */
export async function resolveOrgClaim(key: string | null | undefined, orgId: unknown, name?: string): Promise<void> {
  const client = registryClient();
  const id = parseOrgId(orgId);
  if (!key || !client || !id) return;
  try {
    await client.from(KV_TABLE).upsert({ key, value: { orgId: id, pendingAt: null, name: name || null } });
  } catch (error) {
    console.log(`[Pipedrive org registry] zápis selhal (${key}): ${(error as Error).message}`);
  }
}

/** Uvolní claim, když se organizaci založit nepodařilo — jinak by klíč blokoval další pokus. */
export async function releaseOrgClaim(key: string | null | undefined): Promise<void> {
  const client = registryClient();
  if (!key || !client) return;
  try {
    await client.from(KV_TABLE).delete().eq('key', key);
  } catch (error) {
    console.log(`[Pipedrive org registry] uvolnění selhalo (${key}): ${(error as Error).message}`);
  }
}

/** Naplní rejstřík z nalezené organizace, aby další request nemusel čekat na search index. */
export async function rememberOrgIdForIco(ico: unknown, orgId: unknown, name?: string): Promise<void> {
  const key = pipedriveOrgIcoRegistryKey(ico);
  if (!key) return;
  await resolveOrgClaim(key, orgId, name);
}
