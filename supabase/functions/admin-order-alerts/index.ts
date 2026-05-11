import { resolveAllowedOrigin } from '../_shared/cors.ts';
import postgres from 'npm:postgres';
import { requireAdminJwt } from '../_shared/admin-auth.ts';

type AlertSummaryRow = {
  total_open: number;
  critical_open: number;
  warning_open: number;
  acknowledged_open: number;
};

/** Sjednocený řádek: objednávkové alerty + app_incidents (webináře, …). */
type UnifiedAlertRow = {
  id: string;
  origin: 'order' | 'site';
  alert_type: string;
  severity: string;
  state: string;
  title: string;
  message: string;
  dedupe_key: string;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  payload: unknown;
  order_id: string | null;
  order_number: string | null;
  webinar_id: string | null;
  webinar_title: string | null;
  contact_email: string | null;
};

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-user-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
});

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
    },
  });
}

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  const adminGate = await requireAdminJwt(req);
  if (adminGate instanceof Response) {
    return adminGate;
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse(req, { error: 'Missing DATABASE_URL.' }, 500);
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('mode') || 'list';

      if (mode === 'summary') {
        const rows = await sql<AlertSummaryRow[]>`
          with u as (
            select state, severity from public.order_alerts
            union all
            select state, severity from public.app_incidents
          )
          select
            count(*) filter (where state = 'open')::int as total_open,
            count(*) filter (where state = 'open' and severity = 'critical')::int as critical_open,
            count(*) filter (where state = 'open' and severity = 'warning')::int as warning_open,
            count(*) filter (where state = 'acknowledged')::int as acknowledged_open
          from u
        `;

        return jsonResponse(req, { summary: rows[0] || {
          total_open: 0,
          critical_open: 0,
          warning_open: 0,
          acknowledged_open: 0,
        } });
      }

      const state = (url.searchParams.get('state') || 'open').trim();
      const severity = (url.searchParams.get('severity') || '').trim();
      const alertType = (url.searchParams.get('alertType') || '').trim();
      const scope = (url.searchParams.get('scope') || 'all').trim() as 'all' | 'orders' | 'site';
      const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1);
      const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('pageSize') || '20', 10), 1), 100);
      const offset = (page - 1) * pageSize;

      const stateClause = state === 'all'
        ? sql``
        : sql`and c.state = ${state}`;
      const severityClause = severity
        ? sql`and c.severity = ${severity}`
        : sql``;
      const alertTypeClause = alertType
        ? sql`and c.alert_type = ${alertType}`
        : sql``;

      const combinedFragment = scope === 'orders'
        ? sql`
          select
            a.id,
            'order'::text as origin,
            a.alert_type,
            a.severity,
            a.state,
            a.title,
            a.message,
            a.dedupe_key,
            a.first_seen_at,
            a.last_seen_at,
            a.acknowledged_at,
            a.acknowledged_by,
            a.resolved_at,
            a.payload,
            a.order_id,
            o.order_number,
            null::text as webinar_id,
            null::text as webinar_title,
            null::text as contact_email
          from public.order_alerts a
          left join public.orders o on o.id = a.order_id
        `
        : scope === 'site'
        ? sql`
          select
            i.id,
            'site'::text as origin,
            i.incident_type as alert_type,
            i.severity,
            i.state,
            i.title,
            i.message,
            i.dedupe_key,
            i.first_seen_at,
            i.last_seen_at,
            i.acknowledged_at,
            i.acknowledged_by,
            i.resolved_at,
            i.payload,
            i.order_id,
            o2.order_number,
            i.webinar_id,
            i.webinar_title,
            i.contact_email
          from public.app_incidents i
          left join public.orders o2 on o2.id = i.order_id
        `
        : sql`
          select
            a.id,
            'order'::text as origin,
            a.alert_type,
            a.severity,
            a.state,
            a.title,
            a.message,
            a.dedupe_key,
            a.first_seen_at,
            a.last_seen_at,
            a.acknowledged_at,
            a.acknowledged_by,
            a.resolved_at,
            a.payload,
            a.order_id,
            o.order_number,
            null::text as webinar_id,
            null::text as webinar_title,
            null::text as contact_email
          from public.order_alerts a
          left join public.orders o on o.id = a.order_id
          union all
          select
            i.id,
            'site'::text as origin,
            i.incident_type as alert_type,
            i.severity,
            i.state,
            i.title,
            i.message,
            i.dedupe_key,
            i.first_seen_at,
            i.last_seen_at,
            i.acknowledged_at,
            i.acknowledged_by,
            i.resolved_at,
            i.payload,
            i.order_id,
            o2.order_number,
            i.webinar_id,
            i.webinar_title,
            i.contact_email
          from public.app_incidents i
          left join public.orders o2 on o2.id = i.order_id
        `;

      const [countRows, alerts, typeRows] = await Promise.all([
        sql<{ count: number }[]>`
          with combined as (${combinedFragment})
          select count(*)::int as count
          from combined c
          where true
          ${stateClause}
          ${severityClause}
          ${alertTypeClause}
        `,
        sql<UnifiedAlertRow[]>`
          with combined as (${combinedFragment})
          select
            c.id,
            c.origin::text,
            c.alert_type,
            c.severity,
            c.state,
            c.title,
            c.message,
            c.dedupe_key,
            c.first_seen_at,
            c.last_seen_at,
            c.acknowledged_at,
            c.acknowledged_by,
            c.resolved_at,
            c.payload,
            c.order_id,
            c.order_number,
            c.webinar_id,
            c.webinar_title,
            c.contact_email
          from combined c
          where true
          ${stateClause}
          ${severityClause}
          ${alertTypeClause}
          order by
            case c.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
            c.last_seen_at desc
          limit ${pageSize}
          offset ${offset}
        `,
        sql<{ alert_type: string }[]>`
          select distinct alert_type from (
            select alert_type from public.order_alerts
            union
            select incident_type as alert_type from public.app_incidents
          ) t
          order by alert_type
        `,
      ]);

      const alertTypes = typeRows.map((r) => r.alert_type).filter(Boolean);

      return jsonResponse(req, {
        items: alerts,
        total: countRows[0]?.count ?? 0,
        page,
        pageSize,
        alertTypes,
        scope: scope === 'all' ? 'all' : scope,
      });
    }

    if (req.method === 'POST') {
      const payload = await req.json().catch(() => null) as {
        action?: 'acknowledge' | 'resolve';
        alertId?: string;
      } | null;

      if (!payload?.action || !payload.alertId) {
        return jsonResponse(req, { error: 'Missing action or alertId.' }, 400);
      }

      if (!['acknowledge', 'resolve'].includes(payload.action)) {
        return jsonResponse(req, { error: 'Unsupported action.' }, 400);
      }

      const id = payload.alertId;

      if (payload.action === 'acknowledge') {
        const o = await sql<{ id: string }[]>`
          update public.order_alerts
          set
            state = 'acknowledged',
            acknowledged_at = now(),
            acknowledged_by = 'admin',
            updated_at = now()
          where id = ${id}::uuid
          returning id
        `;
        if (o.length) {
          return jsonResponse(req, { success: true });
        }
        const s = await sql<{ id: string }[]>`
          update public.app_incidents
          set
            state = 'acknowledged',
            acknowledged_at = now(),
            acknowledged_by = 'admin',
            updated_at = now()
          where id = ${id}::uuid
          returning id
        `;
        if (s.length) {
          return jsonResponse(req, { success: true });
        }
        return jsonResponse(req, { error: 'Alert nenalezen.' }, 404);
      }

      if (payload.action === 'resolve') {
        const o = await sql<{ id: string }[]>`
          update public.order_alerts
          set
            state = 'resolved',
            resolved_at = now(),
            updated_at = now()
          where id = ${id}::uuid
          returning id
        `;
        if (o.length) {
          return jsonResponse(req, { success: true });
        }
        const s = await sql<{ id: string }[]>`
          update public.app_incidents
          set
            state = 'resolved',
            resolved_at = now(),
            updated_at = now()
          where id = ${id}::uuid
          returning id
        `;
        if (s.length) {
          return jsonResponse(req, { success: true });
        }
        return jsonResponse(req, { error: 'Alert nenalezen.' }, 404);
      }

      return jsonResponse(req, { error: 'Unsupported action.' }, 400);
    }

    return jsonResponse(req, { error: 'Method not allowed.' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin order alerts failed.';
    return jsonResponse(req, { error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
