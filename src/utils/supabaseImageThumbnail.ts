/**
 * Supabase Storage — image transformations (Pro+).
 * Nahradí /object/public/ za /render/image/public/ a přidá úzký náhled pro rychlé první vykreslení.
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */
import { projectId } from './supabase/info';

const OBJECT_PUBLIC = '/storage/v1/object/public/';
const RENDER_PUBLIC = '/storage/v1/render/image/public/';

/** Opraví URL na absolutní kvůli transformaci (relativní `/storage/...` → projekt Supabase). */
export function normalizeSupabaseImageSrc(src: string): string {
  let s = src.trim();
  if (s.startsWith('//')) {
    s = `https:${s}`;
  }
  if (s.startsWith('/storage/v1/object/public/')) {
    return `https://${projectId}.supabase.co${s}`;
  }
  return s;
}

export function supabasePublicUrlToTinyRenderUrl(
  src: string,
  opts?: { width?: number; quality?: number },
): string | null {
  if (!src || typeof src !== 'string') return null;
  try {
    const abs = normalizeSupabaseImageSrc(src);
    const u = new URL(abs);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const path = u.pathname;
    const i = path.indexOf(OBJECT_PUBLIC);
    if (i === -1) return null;
    const tail = path.slice(i + OBJECT_PUBLIC.length);
    if (!tail) return null;
    const newPath = path.slice(0, i) + RENDER_PUBLIC + tail;
    const out = new URL(u.href);
    out.pathname = newPath;
    const w = opts?.width ?? 72;
    const q = opts?.quality ?? 42;
    out.search = `width=${w}&quality=${q}&resize=contain`;
    return out.toString();
  } catch {
    return null;
  }
}
