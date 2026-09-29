/**
 * Ecomail — rozesílání newsletterů (náhrada Mailchimp kampaní).
 * Transakční e-maily sem nepatří (Ecomail je u transakčního API zakazuje posílat s marketingovým obsahem),
 * ty jdou přes Resend — viz supabase/functions/_shared/transactional-mail.ts.
 *
 * Secrets:
 * - ECOMAIL_KEY                (povinný)
 * - ECOMAIL_LIST_NEWSLETTER    ID seznamu odběratelů newsletteru; když chybí a účet má jediný seznam, použije se ten
 * - ECOMAIL_FROM_EMAIL         (default `vitek@vividbooks.com`)
 * - ECOMAIL_FROM_NAME          (default `Vítek Škop z Vividbooks`)
 * - ECOMAIL_REPLY_TO           (default `vitek@vividbooks.com`)
 */

const ECOMAIL_API = 'https://api2.ecomailapp.cz';

export type EcomailList = { id: number; name: string; subscribers?: number };

export function getEcomailKey(): string | null {
  return Deno.env.get('ECOMAIL_KEY')?.trim() || null;
}

export function getEcomailSender(): { fromName: string; fromEmail: string; replyTo: string } {
  return {
    fromName: Deno.env.get('ECOMAIL_FROM_NAME')?.trim() || 'Vítek Škop z Vividbooks',
    fromEmail: Deno.env.get('ECOMAIL_FROM_EMAIL')?.trim() || 'vitek@vividbooks.com',
    replyTo: Deno.env.get('ECOMAIL_REPLY_TO')?.trim() || 'vitek@vividbooks.com',
  };
}

/** Webové rozhraní účtu (subdoména z Ecomailu), pro odkaz z EmailBuilderu. */
export function getEcomailAppBase(): string {
  return (Deno.env.get('ECOMAIL_APP_URL')?.trim() || 'https://vividbooks.ecomailapp.cz').replace(/\/$/, '');
}

async function ecomailFetch(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const key = getEcomailKey();
  if (!key) return { ok: false, status: 0, data: { error: 'ECOMAIL_KEY není nastaven' } };
  const res = await fetch(`${ECOMAIL_API}${path}`, {
    method: init.method || 'GET',
    headers: { key, 'Content-Type': 'application/json' },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch { /* necháme text */ }
  return { ok: res.ok, status: res.status, data };
}

function errorDetail(r: { status: number; data: any }): string {
  const d = r.data;
  const msg = typeof d === 'string' ? d : JSON.stringify(d?.errors ?? d?.message ?? d);
  return `Ecomail ${r.status}: ${String(msg).slice(0, 300)}`;
}

export async function ecomailListLists(): Promise<EcomailList[]> {
  const r = await ecomailFetch('/lists');
  if (!r.ok) throw new Error(errorDetail(r));
  const rows: any[] = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.data) ? r.data.data : [];
  return rows.map((l) => ({ id: Number(l.id), name: String(l.name || ''), subscribers: l.active_subscribers ?? l.subscribers }));
}

/** ID seznamu newsletteru: secret, jinak jediný seznam v účtu. */
export async function resolveNewsletterListId(): Promise<number> {
  const fromEnv = Number(Deno.env.get('ECOMAIL_LIST_NEWSLETTER')?.trim() || '');
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const lists = await ecomailListLists();
  if (lists.length === 1) return lists[0].id;
  const names = lists.map((l) => `${l.id} = ${l.name}`).join(', ') || 'žádné';
  throw new Error(`Nastavte secret ECOMAIL_LIST_NEWSLETTER (ID seznamu). Seznamy v účtu: ${names}`);
}

export type EcomailCampaignInput = {
  title: string;
  subject: string;
  html: string;
  listId: number;
};

/**
 * Založí draft kampaně, nebo aktualizuje existující (pokud ještě neodešla).
 * Odeslání kampaně se dělá v Ecomailu — z webu se nerozesílá.
 */
export async function ecomailUpsertCampaignDraft(
  input: EcomailCampaignInput,
  existingId?: string | number | null,
): Promise<{ id: number; updated: boolean; url: string }> {
  const sender = getEcomailSender();
  const payload = {
    title: input.title.slice(0, 190),
    from_name: sender.fromName,
    from_email: sender.fromEmail,
    reply_to: sender.replyTo,
    subject: input.subject,
    html_text: input.html,
    recepient_lists: [input.listId],
  };
  const url = (id: number) => `${getEcomailAppBase()}/campaigns/edit/${id}`;

  const prevId = Number(existingId);
  if (Number.isFinite(prevId) && prevId > 0) {
    const put = await ecomailFetch(`/campaigns/${prevId}`, { method: 'PUT', body: payload });
    if (put.ok) return { id: prevId, updated: true, url: url(prevId) };
    /* Odeslaná nebo smazaná kampaň → založíme novou. */
    console.log(`[Ecomail] Update kampaně ${prevId} selhal (${errorDetail(put)}) — zakládám novou`);
  }
  const created = await ecomailFetch('/campaigns', { method: 'POST', body: payload });
  if (!created.ok || !created.data?.id) throw new Error(errorDetail(created));
  const id = Number(created.data.id);
  return { id, updated: false, url: url(id) };
}

export async function ecomailSendCampaignTest(campaignId: number, emails: string[]): Promise<void> {
  const r = await ecomailFetch(`/campaigns/${campaignId}/send-test`, { method: 'POST', body: { emails: emails.slice(0, 5) } });
  if (!r.ok) throw new Error(errorDetail(r));
}

/**
 * Přidá odběratele do seznamu newsletteru. Souhlas dal na webu, proto bez double opt-in.
 * Dřív odhlášené kontakty znovu nepřihlašuje (`resubscribe: false`). Tagy neposílá — Ecomail je při
 * `update_existing` přepisuje celé, takže by smazal štítky z dřívějších registrací.
 * Nikdy nevyhazuje — zápis do Ecomailu nesmí shodit registraci.
 */
export async function ecomailSubscribeNewsletter(opts: {
  email: string;
  name?: string;
  source?: string;
}): Promise<{ ok: boolean; skipped?: boolean; detail?: string }> {
  if (!getEcomailKey()) return { ok: false, skipped: true, detail: 'ECOMAIL_KEY není nastaven' };
  try {
    const listId = await resolveNewsletterListId();
    const parts = String(opts.name || '').trim().split(/\s+/).filter(Boolean);
    const r = await ecomailFetch(`/lists/${listId}/subscribe`, {
      method: 'POST',
      body: {
        subscriber_data: {
          email: opts.email,
          ...(parts[0] ? { name: parts[0] } : {}),
          ...(parts.length > 1 ? { surname: parts.slice(1).join(' ') } : {}),
          ...(opts.source ? { source: opts.source.slice(0, 100) } : {}),
        },
        update_existing: true,
        skip_confirmation: true,
        resubscribe: false,
        trigger_autoresponders: true,
      },
    });
    if (!r.ok) {
      console.log(`[Ecomail] subscribe ${opts.email}: ${errorDetail(r)}`);
      return { ok: false, detail: errorDetail(r) };
    }
    return { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.log(`[Ecomail] subscribe ${opts.email}: ${detail}`);
    return { ok: false, detail };
  }
}

export type EcomailBulkSubscriber = {
  email: string;
  status: 1 | 2 | 4;
  name?: string;
  surname?: string;
  tags?: string[];
  source?: string;
};

/** Hromadný zápis (max 3000 na volání, bez double opt-in). Dřív odhlášené neobnovuje. */
export async function ecomailSubscribeBulk(listId: number, rows: EcomailBulkSubscriber[]): Promise<{ inserts: number }> {
  const r = await ecomailFetch(`/lists/${listId}/subscribe-bulk`, {
    method: 'POST',
    body: { subscriber_data: rows.slice(0, 3000), update_existing: true, resubscribe: false, trigger_autoresponders: false },
  });
  if (!r.ok) throw new Error(errorDetail(r));
  return { inserts: Number(r.data?.inserts ?? 0) };
}

/** Statistiky kampaně: doručení, otevření, prokliky, bounce, odhlášení, spam. */
export async function ecomailCampaignStats(campaignId: number): Promise<Record<string, number>> {
  const r = await ecomailFetch(`/campaigns/${campaignId}/stats`);
  if (!r.ok) throw new Error(errorDetail(r));
  return r.data?.stats ?? r.data ?? {};
}
