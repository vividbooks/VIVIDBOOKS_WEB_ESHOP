/**
 * Uvolní místo pro Supabase session / OAuth. Při plné kvótě Chrome hází QuotaExceededError
 * na jakýkoli setItem — pak v Local Storage „nic není“ (zápis selže).
 *
 * Důležité: při návratu z OAuth (hash s tokeny) nesmíme mazat `sb-*-auth-token` před `initialize()`,
 * jinak React Strict Mode (dvojí mount) druhým během smaže session, kterou právě uložil první běh.
 */

export type PrepareWebStorageMode = 'beforeLoginRedirect' | 'oauthReturn';

export type PrepareWebStorageResult = {
  removedKeys: number;
  clearedLocalStorage: boolean;
  clearedIndexedDb: boolean;
  canWriteSession: boolean;
};

function allKeys(store: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k) out.push(k);
  }
  return out;
}

function tryWriteLocalStorage(bytes: number): boolean {
  const key = '__vivid_quota_probe__';
  try {
    window.localStorage.removeItem(key);
    window.localStorage.setItem(key, 'x'.repeat(bytes));
    window.localStorage.removeItem(key);
    return true;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return false;
  }
}

async function clearAllIndexedDatabases(): Promise<boolean> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') {
    return false;
  }
  let any = false;
  const dbs = await indexedDB.databases();
  for (const db of dbs) {
    if (!db.name) continue;
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(db.name!);
      req.onsuccess = () => {
        any = true;
        resolve();
      };
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  return any;
}

/**
 * @param mode
 *   `beforeLoginRedirect` — před kliknutím na „Přihlásit“ (může smazat i `sb-*`, session stejně není).
 *   `oauthReturn` — jen návrat z Google s tokeny v URL; **nemazat** `sb-…-auth-token`, jen uvolnit místo
 *   (vividbooks, dictation, PKCE verifier).
 */
export async function prepareWebStorageForAuth(
  mode: PrepareWebStorageMode = 'beforeLoginRedirect',
): Promise<PrepareWebStorageResult> {
  const result: PrepareWebStorageResult = {
    removedKeys: 0,
    clearedLocalStorage: false,
    clearedIndexedDb: false,
    canWriteSession: false,
  };

  if (typeof window === 'undefined') {
    result.canWriteSession = true;
    return result;
  }

  const bump = () => {
    result.removedKeys++;
  };

  const removeIf = (store: Storage, pred: (k: string) => boolean) => {
    for (const k of allKeys(store)) {
      if (!pred(k)) continue;
      try {
        store.removeItem(k);
        bump();
      } catch {
        /* ignore */
      }
    }
  };

  // 1) Cache katalogu — megabajty
  removeIf(window.localStorage, (k) => k.startsWith('vividbooks_'));

  // 2) Asistent (obnoví se z cloudu)
  removeIf(window.localStorage, (k) => k.startsWith('dictation_app_'));
  removeIf(window.localStorage, (k) => k === 'google_provider_token');

  // 3) Supabase: podle režimu
  if (mode === 'beforeLoginRedirect') {
    removeIf(window.localStorage, (k) => k.startsWith('sb-'));
    removeIf(window.sessionStorage, (k) => k.startsWith('sb-'));
  } else {
    removeIf(window.localStorage, (k) => k.startsWith('sb-') && k.includes('code-verifier'));
    removeIf(window.sessionStorage, (k) => k.startsWith('sb-') && k.includes('code-verifier'));
  }

  if (tryWriteLocalStorage(150_000)) {
    result.canWriteSession = true;
    return result;
  }

  try {
    window.localStorage.clear();
    result.clearedLocalStorage = true;
  } catch {
    /* ignore */
  }

  if (tryWriteLocalStorage(150_000)) {
    result.canWriteSession = true;
    return result;
  }

  try {
    result.clearedIndexedDb = await clearAllIndexedDatabases();
  } catch {
    /* ignore */
  }

  result.canWriteSession = tryWriteLocalStorage(50_000);
  return result;
}
