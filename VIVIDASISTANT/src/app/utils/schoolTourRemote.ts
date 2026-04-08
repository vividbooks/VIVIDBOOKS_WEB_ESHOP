import { projectId } from '/utils/supabase/info';
import { getEdgeFunctionHeaders } from '@/lib/edgeFunctionHeaders';
import {
  emptySchoolTourFlags,
  parseRemoteFlagsRecord,
  type SchoolTourFlags,
} from './schoolTourState';

const SCHOOL_TOUR_FLAGS_URL = `https://${projectId}.supabase.co/functions/v1/make-server-954b19ad/crm/school-tour-flags`;

export async function fetchSchoolTourFlagsRemote(): Promise<{
  flags: Record<number, SchoolTourFlags>;
  updatedAt: string | null;
}> {
  const headers = await getEdgeFunctionHeaders(true);
  const res = await fetch(SCHOOL_TOUR_FLAGS_URL, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'school-tour-flags');
  return {
    flags: parseRemoteFlagsRecord(data.flags || {}),
    updatedAt: data.updatedAt ?? null,
  };
}

export async function persistSchoolTourOrgRemote(orgId: number, flags: SchoolTourFlags): Promise<void> {
  const headers = await getEdgeFunctionHeaders(true);
  const res = await fetch(SCHOOL_TOUR_FLAGS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orgId, flags }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'save school-tour-flags');
}

/** Sloučení více org najednou (migrace z localStorage). */
export async function mergeSchoolTourFlagsRemote(flags: Record<number, SchoolTourFlags>): Promise<void> {
  const headers = await getEdgeFunctionHeaders(true);
  const serial: Record<string, SchoolTourFlags> = {};
  for (const [k, v] of Object.entries(flags)) {
    serial[String(k)] = { ...emptySchoolTourFlags(), ...v };
  }
  const res = await fetch(SCHOOL_TOUR_FLAGS_URL, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ flags: serial }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'merge school-tour-flags');
}
