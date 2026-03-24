import postgres from 'npm:postgres';

type AlertSummaryRow = {
  total_open: number;
  critical_open: number;
  warning_open: number;
  acknowledged_open: number;
};

type AlertListRow = {
  id: string;
  order_id: string | null;
  order_number: string | null;
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
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getDatabaseUrl() {
  return Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
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
          select
            count(*) filter (where state = 'open')::int as total_open,
            count(*) filter (where state = 'open' and severity = 'critical')::int as critical_open,
            count(*) filter (where state = 'open' and severity = 'warning')::int as warning_open,
            count(*) filter (where state = 'acknowledged')::int as acknowledged_open
          from public.order_alerts
        `;

        return jsonResponse({ summary: rows[0] || {
          total_open: 0,
          critical_open: 0,
          warning_open: 0,
          acknowledged_open: 0,
        } });
      }

      const state = (url.searchParams.get('state') || 'open').trim();
      const severity = (url.searchParams.get('severity') || '').trim();
      const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1);
      const pageSize = Math.min(Math.max(Number.parseInt(url.searchParams.get('pageSize') || '20', 10), 1), 100);
      const offset = (page - 1) * pageSize;

      const stateClause = state === 'all'
        ? sql``
        : sql`and a.state = ${state}`;
      const severityClause = severity
        ? sql`and a.severity = ${severity}`
        : sql``;

      const [countRows, alerts] = await Promise.all([
        sql<{ count: number }[]>`
          select count(*)::int as count
          from public.order_alerts a
          where true
          ${stateClause}
          ${severityClause}
        `,
        sql<AlertListRow[]>`
          select
            a.id,
            a.order_id,
            o.order_number,
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
            a.payload
          from public.order_alerts a
          left join public.orders o on o.id = a.order_id
          where true
          ${stateClause}
          ${severityClause}
          order by
            case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
            a.last_seen_at desc
          limit ${pageSize}
          offset ${offset}
        `,
      ]);

      return jsonResponse({
        items: alerts,
        total: countRows[0]?.count ?? 0,
        page,
        pageSize,
      });
    }

    if (req.method === 'POST') {
      const payload = await req.json().catch(() => null) as {
        action?: 'acknowledge' | 'resolve';
        alertId?: string;
      } | null;

      if (!payload?.action || !payload.alertId) {
        return jsonResponse({ error: 'Missing action or alertId.' }, 400);
      }

      if (!['acknowledge', 'resolve'].includes(payload.action)) {
        return jsonResponse({ error: 'Unsupported action.' }, 400);
      }

      if (payload.action === 'acknowledge') {
        await sql`
          update public.order_alerts
          set
            state = 'acknowledged',
            acknowledged_at = now(),
            acknowledged_by = 'admin',
            updated_at = now()
          where id = ${payload.alertId}::uuid
        `;
      }

      if (payload.action === 'resolve') {
        await sql`
          update public.order_alerts
          set
            state = 'resolved',
            resolved_at = now(),
            updated_at = now()
          where id = ${payload.alertId}::uuid
        `;
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Method not allowed.' }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin order alerts failed.';
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
