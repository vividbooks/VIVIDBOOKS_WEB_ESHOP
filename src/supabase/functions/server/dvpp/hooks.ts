/**
 * DVPP zdarma — napojení na existující registrační endpointy v index.tsx.
 * Po zápisu kontaktu do `subscribers` spáruje školu (IČO / doména) a zapíše událost funnelu.
 * Nikdy neblokuje registraci — volající obaluje try/catch.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { linkSubscriberToSchool, refreshSchoolStatus, resolveSchoolForContact } from './schools.ts';
import { addMember, getStaffroom } from './staffroom.ts';
import { recordFunnelEvent, type FunnelEventName } from './events.ts';
import type { Attribution } from './shared.ts';

export async function afterRegistration(
  sb: SupabaseClient,
  input: {
    subscriberId: string;
    email: string;
    ico?: string | null;
    event: FunnelEventName;
    attribution?: Attribution | null;
    meta?: Record<string, unknown>;
    request?: { url?: string; ip?: string | null; userAgent?: string | null } | null;
  },
): Promise<{ redIzo: string | null }> {
  let redIzo: string | null = null;
  try {
    const found = await resolveSchoolForContact(sb, { ico: input.ico, email: input.email });
    if (found) {
      const r = await linkSubscriberToSchool(sb, input.subscriberId, found.school.red_izo);
      redIzo = found.school.red_izo;
      if (r.changed) {
        await recordFunnelEvent(sb, { event: 'school_linked', subscriberId: input.subscriberId, email: input.email, redIzo, meta: { via: found.via } });
        /* Škola už má sborovnu → kontakt do ní rovnou patří (počítá se po aktivaci). */
        const sr = await getStaffroom(sb, redIzo);
        if (sr) await addMember(sb, redIzo, input.subscriberId, 'registration', null, false);
        await refreshSchoolStatus(sb, redIzo);
      }
    }
  } catch (e) {
    console.warn('[dvpp/hooks] school link', e instanceof Error ? e.message : e);
  }
  await recordFunnelEvent(sb, {
    event: input.event, subscriberId: input.subscriberId, email: input.email, redIzo,
    attribution: input.attribution || null, meta: input.meta || {}, request: input.request || null,
  });
  return { redIzo };
}
