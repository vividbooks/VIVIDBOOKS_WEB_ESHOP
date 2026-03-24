/**
 * Načte JSON s několika pokusy při síťových chybách a přechodných chybách serveru (5xx, 429).
 */

export type FetchJsonRetryOk<T> = { ok: true; data: T; status: number };
export type FetchJsonRetryFail = { ok: false; error: string; status?: number };
export type FetchJsonRetryResult<T> = FetchJsonRetryOk<T> | FetchJsonRetryFail;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function fetchJsonWithRetry<T = unknown>(
  url: string,
  init: RequestInit,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    /** Navíc k 5xx */
    retryOnStatus?: number[];
  },
): Promise<FetchJsonRetryResult<T>> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 4);
  const baseDelayMs = options?.baseDelayMs ?? 400;
  const extraRetry = options?.retryOnStatus ?? [429, 408];

  let lastError = 'Neznámá chyba';
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      lastStatus = res.status;
      const text = await res.text();
      let data: T = {} as T;
      if (text.trim()) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          lastError = 'Server vrátil neplatný JSON';
          if (attempt < maxAttempts - 1) {
            await sleep(baseDelayMs * 2 ** attempt);
            continue;
          }
          return { ok: false, error: lastError, status: res.status };
        }
      }

      if (res.ok) {
        return { ok: true, data, status: res.status };
      }

      const errBody = data as { error?: string };
      lastError = typeof errBody?.error === 'string' ? errBody.error : `HTTP ${res.status}`;

      const retryable =
        attempt < maxAttempts - 1 &&
        (res.status >= 500 || extraRetry.includes(res.status));

      if (retryable) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }

      return { ok: false, error: lastError, status: res.status };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Síťová chyba';
      lastError = msg;
      lastStatus = undefined;
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      return { ok: false, error: lastError };
    }
  }

  return { ok: false, error: lastError, status: lastStatus };
}
