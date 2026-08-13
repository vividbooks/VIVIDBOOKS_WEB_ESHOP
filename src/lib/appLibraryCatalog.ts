import { useEffect, useState } from 'react';

/** Production app API (vividbooks-ultra). Anon JWT is the public gateway key. */
const APP_API_BASE = 'https://qypiuvqglsmxdsnyazih.supabase.co/functions/v1/api';
const APP_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cGl1dnFnbHNteGRzbnlhemloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjU3NDAsImV4cCI6MjA4NjQwMTc0MH0.lVO7a-wuM2vkqsJcgqvLkthTmrt5g0R3U_Tu0jU7bfY';

export type AppWorkbookCatalogEntry = {
  id: string;
  name: string;
  slug: string;
  path: string;
  url: string;
  eshopProductId?: string;
  author?: string;
};

type CatalogPayload = {
  workbooks?: AppWorkbookCatalogEntry[];
};

let inflight: Promise<Map<string, AppWorkbookCatalogEntry>> | null = null;

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

export async function loadAppWorkbooksByEshopProductId(): Promise<Map<string, AppWorkbookCatalogEntry>> {
  if (inflight) return inflight;
  inflight = (async () => {
    const byProductId = new Map<string, AppWorkbookCatalogEntry>();
    try {
      const response = await fetch(`${APP_API_BASE}/public/catalog/workbooks`, {
        headers: {
          Authorization: `Bearer ${APP_ANON_KEY}`,
          apikey: APP_ANON_KEY,
        },
      });
      if (!response.ok) return byProductId;
      const payload = (await response.json()) as CatalogPayload;
      for (const workbook of payload.workbooks || []) {
        const productId = asTrimmed(workbook.eshopProductId);
        const url = asTrimmed(workbook.url);
        if (!productId || !url) continue;
        byProductId.set(productId, workbook);
      }
    } catch {
      return byProductId;
    }
    return byProductId;
  })();
  return inflight;
}

export function useAppWorkbookForProduct(productId: string | null | undefined) {
  const [entry, setEntry] = useState<AppWorkbookCatalogEntry | null>(null);

  useEffect(() => {
    const id = asTrimmed(productId);
    if (!id) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    void loadAppWorkbooksByEshopProductId().then((map) => {
      if (!cancelled) setEntry(map.get(id) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return entry;
}
