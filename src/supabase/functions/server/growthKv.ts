/**
 * DB-backed KV (growth_store) — drop-in náhrada za kv_store.tsx pro growth moduly.
 * Umožňuje joinovat data v Postgres a zálohovat je.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

let cached: ReturnType<typeof createClient> | null = null;
function sb() {
  if (cached) return cached;
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !key) throw new Error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export async function get(key: string): Promise<any> {
  const { data, error } = await sb().from('growth_store').select('value').eq('key', key).maybeSingle();
  if (error) throw new Error(`growthKv.get ${key}: ${error.message}`);
  return (data as { value: any } | null)?.value ?? null;
}

export async function set(key: string, value: any): Promise<void> {
  const { error } = await sb().from('growth_store').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`growthKv.set ${key}: ${error.message}`);
}

export async function del(key: string): Promise<void> {
  const { error } = await sb().from('growth_store').delete().eq('key', key);
  if (error) throw new Error(`growthKv.del ${key}: ${error.message}`);
}
