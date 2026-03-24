import { projectId, publicAnonKey } from './supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

export const REFERENCE_STYLES_KV_KEY = 'vb:reference-image-styles';

/** Určuje rozšířené UI a prompt v Image Agent → AI Image */
export type ReferenceStyleAiTemplate = 'default' | 'studio_kids';

export interface ReferenceImageStyle {
  id: string;
  name: string;
  prompt: string;
  /** Volitelné: výchozí barva scény (text nebo #hex) — předvyplní se při generování v AI Image */
  defaultSceneColor?: string;
  /**
   * `studio_kids` = v agentovi se zobrazí panel „děti ve studiu“ a do promptu se přidá strukturovaný blok.
   * Nezadáno nebo `default` = jen obecný prompt + referenční obrázky.
   */
  aiTemplate?: ReferenceStyleAiTemplate;
  imageUrls: string[];
  updatedAt: string;
}

export async function fetchReferenceStyles(): Promise<ReferenceImageStyle[]> {
  const r = await fetch(`${SERVER}/kv/${encodeURIComponent(REFERENCE_STYLES_KV_KEY)}`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  if (d.value == null) return [];
  try {
    const parsed = typeof d.value === 'string' ? JSON.parse(d.value) : d.value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveReferenceStyles(styles: ReferenceImageStyle[]): Promise<void> {
  const res = await fetch(`${SERVER}/kv`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key: REFERENCE_STYLES_KV_KEY, value: JSON.stringify(styles) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
}
