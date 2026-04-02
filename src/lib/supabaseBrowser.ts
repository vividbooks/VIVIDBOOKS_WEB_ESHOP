import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/auth-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { prepareWebStorageForAuth } from '@/lib/prepareWebStorageForAuth';

let client: SupabaseClient | null = null;

/** Musí odpovídat výchozímu klíči z @supabase/supabase-js (sb-<ref>-auth-token). */
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${projectId}-auth-token`;

/**
 * V prohlížeči vždy implicit OAuth (tokeny v hash) — PKCE zapisuje code-verifier a při plné kvótě
 * spadne na QuotaExceededError dřív, než vůbec nastartuje redirect.
 */
export const AUTH_USE_IMPLICIT = true;

/** @deprecated — PKCE v této aplikaci nepoužíváme (kvóta / spolehlivost). */
export const AUTH_USE_PKCE = false;

export function clearStaleSupabasePkceKeys(): void {
  if (typeof window === 'undefined') return;
  const purge = (store: Storage) => {
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith('sb-') && k.includes('code-verifier')) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => {
      try {
        store.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  };
  try {
    purge(window.localStorage);
  } catch {
    /* ignore */
  }
  try {
    purge(window.sessionStorage);
  } catch {
    /* ignore */
  }
}

export function resetSupabaseBrowserClient(): void {
  client = null;
}

function createClientImplicit(): SupabaseClient {
  const storage = getBrowserAuthStorage();
  return createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
    auth: {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  });
}

function probeWritableStorage(store: Storage | null): boolean {
  if (!store || typeof store.setItem !== 'function') return false;
  const key = `__vividauth_probe_${Date.now()}`;
  try {
    store.setItem(key, '1');
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function createMemoryStorage(): SupportedStorage {
  const mem: Record<string, string> = {};
  return {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null),
    setItem: (key: string, value: string) => {
      mem[key] = value;
    },
    removeItem: (key: string) => {
      delete mem[key];
    },
  };
}

export function getBrowserAuthStorage(): SupportedStorage {
  if (typeof window === 'undefined') {
    return createMemoryStorage();
  }
  if (probeWritableStorage(window.localStorage)) {
    return window.localStorage;
  }
  if (probeWritableStorage(window.sessionStorage)) {
    if (import.meta.env.DEV) {
      console.warn(
        '[auth] localStorage nelze zapisovat — používám sessionStorage.',
      );
    }
    return window.sessionStorage;
  }
  console.error('[auth] Žádné použitelné webové úložiště.');
  return createMemoryStorage();
}

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClientImplicit();
  }
  return client;
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || (e as DOMException).code === 22)
  );
}

export type GoogleOAuthExtra = {
  scopes?: string;
  queryParams?: Record<string, string>;
};

function buildGoogleOAuthRequest(redirectTo: string, extra?: GoogleOAuthExtra) {
  return {
    provider: 'google' as const,
    options: {
      redirectTo,
      ...(extra?.scopes ? { scopes: extra.scopes } : {}),
      queryParams: extra?.queryParams ?? { prompt: 'select_account' },
    },
  };
}

/**
 * Před OAuth uvolní úložiště (kvóta), znovu vytvoří klienta a spustí Google login (implicit).
 */
export async function signInWithGoogleOAuth(
  redirectTo: string,
  extra?: GoogleOAuthExtra,
): Promise<{ error: Error | null }> {
  if (typeof window !== 'undefined') {
    const prep = await prepareWebStorageForAuth('beforeLoginRedirect');
    if (import.meta.env.DEV) {
      console.info('[auth] prepareWebStorageForAuth', prep);
    }
    if (!prep.canWriteSession) {
      return {
        error: new Error(
          'Úložiště prohlížeče je stále plné i po úklidu. Zavři ostatní záložky s localhostem, pak Chrome → DevTools → Application → Clear site data u http://localhost:3000.',
        ),
      };
    }
  }

  resetSupabaseBrowserClient();
  clearStaleSupabasePkceKeys();

  const options = buildGoogleOAuthRequest(redirectTo, extra);

  try {
    const { error } = await getSupabaseBrowser().auth.signInWithOAuth(options);
    return { error: error ? new Error(error.message) : null };
  } catch (e) {
    if (!isQuotaError(e)) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
    await prepareWebStorageForAuth('beforeLoginRedirect');
    resetSupabaseBrowserClient();
    clearStaleSupabasePkceKeys();
    try {
      const { error } = await getSupabaseBrowser().auth.signInWithOAuth(options);
      return { error: error ? new Error(error.message) : null };
    } catch (e2) {
      return {
        error: new Error(
          e2 instanceof DOMException && e2.name === 'QuotaExceededError'
            ? 'Úložiště je plné. Vymaž data stránky: DevTools → Application → Clear site data (localhost:3000).'
            : e2 instanceof Error
              ? e2.message
              : String(e2),
        ),
      };
    }
  }
}
