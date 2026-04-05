import postgres from 'npm:postgres';

export type SiteIncidentSeverity = 'info' | 'warning' | 'critical';

export type SiteIncidentUpsertInput = {
  source: string;
  incidentType: string;
  severity: SiteIncidentSeverity;
  dedupeKey: string;
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
  orderId?: string | null;
  webinarId?: string | null;
  webinarTitle?: string | null;
  contactEmail?: string | null;
};

/**
 * Zapíše / aktualizuje incident (stejná logika jako order_alerts).
 * Při chybě DB pouze zaloguje — nesmí rozbít hlavní request.
 */
export async function upsertSiteIncident(input: SiteIncidentUpsertInput): Promise<void> {
  const databaseUrl = (Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '').trim();
  if (!databaseUrl) {
    console.log('[app_incidents] DATABASE_URL missing, skip');
    return;
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  const payloadJson = input.payload ? JSON.stringify(input.payload) : null;

  try {
    await sql`
      insert into public.app_incidents (
        source,
        incident_type,
        severity,
        state,
        dedupe_key,
        title,
        message,
        first_seen_at,
        last_seen_at,
        payload,
        order_id,
        webinar_id,
        webinar_title,
        contact_email,
        updated_at
      ) values (
        ${input.source},
        ${input.incidentType},
        ${input.severity},
        'open',
        ${input.dedupeKey},
        ${input.title},
        ${input.message},
        now(),
        now(),
        ${payloadJson}::jsonb,
        ${input.orderId ?? null}::uuid,
        ${input.webinarId ?? null},
        ${input.webinarTitle ?? null},
        ${input.contactEmail ?? null},
        now()
      )
      on conflict (dedupe_key) do update
      set
        severity = excluded.severity,
        title = excluded.title,
        message = excluded.message,
        payload = coalesce(excluded.payload, public.app_incidents.payload),
        last_seen_at = now(),
        state = case
          when public.app_incidents.state = 'suppressed' then 'suppressed'
          when public.app_incidents.state = 'acknowledged' then 'acknowledged'
          else 'open'
        end,
        resolved_at = case
          when public.app_incidents.state = 'resolved' then null
          else public.app_incidents.resolved_at
        end,
        updated_at = now()
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[app_incidents] upsert failed: ${msg}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
