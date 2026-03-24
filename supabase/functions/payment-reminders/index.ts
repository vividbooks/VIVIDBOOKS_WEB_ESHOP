import postgres from 'npm:postgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getDatabaseUrl() {
  return (
    Deno.env.get('SUPABASE_DB_URL')
    || Deno.env.get('DATABASE_URL')
    || ''
  );
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getFunctionBaseUrl(fallbackRequestUrl?: string) {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  if (supabaseUrl) return supabaseUrl;

  if (fallbackRequestUrl) {
    try {
      return new URL(fallbackRequestUrl).origin;
    } catch {
      return '';
    }
  }

  return '';
}

function getSendOrderEmailUrl(fallbackRequestUrl?: string) {
  const baseUrl = getFunctionBaseUrl(fallbackRequestUrl);
  return baseUrl ? `${baseUrl}/functions/v1/send-order-email` : '';
}

function getFunctionAuthHeaders() {
  const functionKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  return functionKey
    ? {
        Authorization: `Bearer ${functionKey}`,
        apikey: functionKey,
      }
    : {};
}

function verifyServiceAuth(req: Request): boolean {
  const expected = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!expected) return false;

  const auth = req.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';
  return token === expected;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  if (!verifyServiceAuth(req)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return jsonResponse({ error: 'Missing DATABASE_URL.' }, 500);
  }

  const emailUrl = getSendOrderEmailUrl(req.url);
  if (!emailUrl) {
    return jsonResponse({ error: 'Missing SUPABASE_URL for send-order-email.' }, 500);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...getFunctionAuthHeaders(),
  };

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  try {
    const due = await sql<{ id: string }[]>`
      select id
      from public.orders
      where status = 'pending_payment'
        and payment_status = 'pending'
        and abandon_reminder_count < 4
        and payment_resume_token is not null
        and (
          (
            abandon_reminder_count = 0
            and created_at < now() - interval '1 hour'
          )
          or (
            abandon_reminder_count >= 1
            and last_abandon_reminder_at is not null
            and last_abandon_reminder_at < now() - interval '24 hours'
          )
        )
      order by created_at asc
      limit 50
    `;

    let sent = 0;
    let failed = 0;

    for (const row of due) {
      try {
        const response = await fetch(emailUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            orderId: row.id,
            emailType: 'payment_reminder',
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error('[payment-reminders] send-order-email failed:', row.id, data);
          failed += 1;
          continue;
        }

        await sql`
          update public.orders
          set
            abandon_reminder_count = abandon_reminder_count + 1,
            last_abandon_reminder_at = now(),
            updated_at = now()
          where id = ${row.id}::uuid
            and status = 'pending_payment'
            and payment_status = 'pending'
        `;

        sent += 1;
      } catch (e) {
        console.error('[payment-reminders] row error:', row.id, e);
        failed += 1;
      }
    }

    return jsonResponse({
      success: true,
      candidates: due.length,
      sent,
      failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'payment-reminders failed.';
    console.error('[payment-reminders]', message);
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
