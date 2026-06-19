import { projectId } from './supabase/info';

export const EDGE_FUNCTION_SLUG = 'make-server-93a20b6f';

const DIRECT_EDGE_BASE = `https://${projectId}.supabase.co/functions/v1/${EDGE_FUNCTION_SLUG}`;

/** V dev jde přes Vite proxy; na Vercel přes rewrite `/api/edge` (stejný origin). */
function useSameOriginEdgeProxy(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host.endsWith('.vercel.app')) return true;
  if (import.meta.env.VITE_EDGE_SAME_ORIGIN === '1') return true;
  return false;
}

export function edgeFunctionBase(): string {
  if (useSameOriginEdgeProxy()) {
    return `/api/edge/${EDGE_FUNCTION_SLUG}`;
  }
  return DIRECT_EDGE_BASE;
}
