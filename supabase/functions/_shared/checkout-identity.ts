/**
 * Fire-and-forget identity upsert after a paid / transfer checkout.
 * Does not subscribe the email to mailing.
 */

function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  return { first: parts[0], last: parts.slice(1).join(' ') || null };
}

export function scheduleCheckoutIdentityUpsert(customer: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  schoolName?: string | null;
  ico?: string | null;
}): void {
  const email = String(customer.email || '').trim();
  if (!email || !email.includes('@')) return;

  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const secret = (Deno.env.get('IDENTITY_UPSERT_SECRET') || serviceKey).trim();
  if (!url || !secret) return;

  const name = splitName(customer.name);
  void fetch(`${url}/functions/v1/make-server-93a20b6f/identity/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey || secret,
      'X-Identity-Secret': secret,
    },
    body: JSON.stringify({
      email,
      first_name: name.first,
      last_name: name.last,
      phone: customer.phone || null,
      school_name: customer.schoolName || null,
      ico: customer.ico || null,
      email_source: 'checkout',
      membership_source: 'checkout',
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[identity] checkout upsert:', res.status, text.slice(0, 180));
    }
  }).catch((err) => {
    console.warn('[identity] checkout upsert:', err instanceof Error ? err.message : err);
  });
}
