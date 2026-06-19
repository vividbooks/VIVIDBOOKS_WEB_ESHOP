import { publicAnonKey } from './supabase/info';
import { edgeFunctionBase } from './edgeFunctionBase';

export type SchoolSearchResult = {
  ico: string;
  name: string;
  address?: string;
  kraj?: string;
  source?: string;
};

/** Vyhledání školy v CSV cache / ARES — s krátkým retry při síťovém výpadku. */
export async function fetchSchoolSearchResults(
  params: { q?: string; ico?: string },
  opts?: { signal?: AbortSignal },
): Promise<SchoolSearchResult[]> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (params.ico?.trim()) sp.set('ico', params.ico.trim());
  const url = `${edgeFunctionBase()}/school-search?${sp}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: opts?.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results?: SchoolSearchResult[] };
      return Array.isArray(data.results) ? data.results : [];
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => window.setTimeout(r, 450));
    }
  }
  throw lastErr;
}
