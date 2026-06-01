import { projectId } from './supabase/info';

export const EDGE_FUNCTION_SLUG = 'make-server-93a20b6f';

/** V dev jde přes Vite proxy (stejný origin → bez CORS). V produkci přímo na Supabase. */
export function edgeFunctionBase(): string {
  if (import.meta.env.DEV) {
    return `/api/edge/${EDGE_FUNCTION_SLUG}`;
  }
  return `https://${projectId}.supabase.co/functions/v1/${EDGE_FUNCTION_SLUG}`;
}
