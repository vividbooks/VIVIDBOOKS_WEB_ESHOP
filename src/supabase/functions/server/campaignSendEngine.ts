/**
 * Send engine vlastního mailingu (náhrada Mailchimp kampaní).
 *
 * Tok: campaigns (status draft → scheduled/sending → sent) + campaign_recipients (fronta per příjemce).
 * - prepareCampaignRecipients: vyhodnotí audience_filter a naplní frontu (jen `subscribed`).
 * - runCampaignSendBatches: bere dávky pending, renderuje HTML (merge fieldy, unsubscribe,
 *   tracking pixel + click redirecty) a posílá přes Resend. Idempotentní — pokračuje, kde skončil.
 *
 * Personalizace: {{first_name}}, {{last_name}}, {{school_name}}, {{email}} + fallback {{first_name|učiteli}}.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from './resendClient.ts';
import { createMailingToken, createTrackingToken } from './mailingTokens.ts';
import { resolveAudienceSubscriberIds, type AudienceFilter } from './audienceFilter.ts';

export type { AudienceFilter };

function edgeFunctionBase(): string {
  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  return `${url}/functions/v1/make-server-93a20b6f`;
}

export async function prepareCampaignRecipients(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<{ ok: true; total: number; added: number } | { ok: false; error: string }> {
  try {
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('id, audience_filter, status')
      .eq('id', campaignId)
      .maybeSingle();
    if (cErr) return { ok: false, error: cErr.message };
    if (!campaign) return { ok: false, error: 'Kampaň neexistuje.' };

    /* Před startem odesílání lze frontu přepočítat (změna filtru v dialogu) — smaž a naplň znovu. */
    if (['draft', 'scheduled'].includes(String(campaign.status))) {
      const { error: delErr } = await supabase.from('campaign_recipients').delete().eq('campaign_id', campaignId);
      if (delErr) return { ok: false, error: delErr.message };
    }

    /* Jen subscribed — unsubscribed/cleaned/pending nikdy nedostanou kampaň. */
    const targetIds = await resolveAudienceSubscriberIds(supabase, {
      ...(campaign.audience_filter as AudienceFilter),
      subscribedOnly: true,
    });

    /* Naplň frontu (ignoruj už existující řádky — prepare lze volat opakovaně). */
    let added = 0;
    const CHUNK = 500;
    for (let i = 0; i < targetIds.length; i += CHUNK) {
      const rows = targetIds.slice(i, i + CHUNK).map((subscriber_id) => ({
        campaign_id: campaignId,
        subscriber_id,
        status: 'pending',
      }));
      const { data: inserted, error: insErr } = await supabase
        .from('campaign_recipients')
        .upsert(rows, { onConflict: 'campaign_id,subscriber_id', ignoreDuplicates: true })
        .select('id');
      if (insErr) return { ok: false, error: insErr.message };
      added += (inserted || []).length;
    }

    return { ok: true, total: targetIds.length, added };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type SubscriberMergeRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  school_name: string | null;
  status: string;
};

/** Merge fieldy s fallbackem: {{first_name|učiteli}}. Neznámé placeholdery nechává být. */
export function applyMergeFields(html: string, sub: SubscriberMergeRow): string {
  return html.replace(
    /\{\{\s*(first_name|last_name|school_name|email)\s*(?:\|([^}]*))?\}\}/g,
    (_m, field: string, fallback?: string) => {
      const val =
        field === 'first_name' ? sub.first_name
        : field === 'last_name' ? sub.last_name
        : field === 'school_name' ? sub.school_name
        : sub.email;
      return (val || '').trim() || (fallback || '').trim();
    },
  );
}

/** Přepíše http(s) odkazy na click-tracking redirect; přeskočí unsubscribe/mailto/kotvy. */
export function rewriteLinksForTracking(html: string, trackToken: string): string {
  const base = edgeFunctionBase();
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (m, url: string) => {
    if (url.includes('/unsubscribe') || url.includes('/newsletter/confirm')) return m;
    return `href="${base}/t/c/${trackToken}?u=${encodeURIComponent(url)}"`;
  });
}

/** Open pixel + patička s odhlášením před </body> (nebo na konec). */
export function appendTrackingAndFooter(html: string, trackToken: string, unsubUrl: string): string {
  const base = edgeFunctionBase();
  /* Šablona už může unsubscribe odkaz obsahovat (nahrazený *|UNSUB|*) — pak stačí pixel. */
  const hasUnsub = html.includes('/unsubscribe?token=');
  const footer = hasUnsub
    ? ''
    : `<div style="max-width:560px;margin:16px auto 0;padding:0 12px 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;">` +
      `<p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">` +
      `Dostáváte novinky Vividbooks. <a href="${unsubUrl}" style="color:#6b7280;">Odhlásit se z odběru</a>` +
      `</p></div>`;
  const suffix =
    footer +
    `<img src="${base}/t/o/${trackToken}.gif" width="1" height="1" alt="" style="display:none;"/>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${suffix}</body>`);
  }
  return html + suffix;
}

export type SendBatchResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  error?: string;
};

/**
 * Zpracuje dávky pending příjemců kampaně, dokud nedojde fronta nebo časový limit.
 * Volá se opakovaně (admin send → self-invoke → cron) — idempotentní.
 */
export async function runCampaignSendBatches(
  supabase: SupabaseClient,
  campaignId: string,
  opts?: { batchSize?: number; timeBudgetMs?: number },
): Promise<SendBatchResult> {
  const batchSize = opts?.batchSize ?? 50;
  const timeBudgetMs = opts?.timeBudgetMs ?? 45_000;
  const startedAt = Date.now();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('id, subject_line, preview_text, html_body, status, name')
      .eq('id', campaignId)
      .maybeSingle();
    if (cErr) return { ok: false, sent, failed, skipped, remaining: -1, error: cErr.message };
    if (!campaign) return { ok: false, sent, failed, skipped, remaining: -1, error: 'Kampaň neexistuje.' };
    if (campaign.status === 'cancelled') {
      return { ok: true, sent, failed, skipped, remaining: 0 };
    }
    const subject = String(campaign.subject_line || campaign.name || 'Vividbooks');
    const htmlBody = String(campaign.html_body || '');
    if (!htmlBody) return { ok: false, sent, failed, skipped, remaining: -1, error: 'Kampaň nemá html_body.' };

    for (;;) {
      if (Date.now() - startedAt > timeBudgetMs) break;

      /* Vyzvedni dávku pending. (Jeden worker běží naráz — cron/self-invoke serializuje admin endpoint.) */
      const { data: batch, error: bErr } = await supabase
        .from('campaign_recipients')
        .select('id, subscriber_id')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(batchSize);
      if (bErr) return { ok: false, sent, failed, skipped, remaining: -1, error: bErr.message };
      if (!batch || batch.length === 0) break;

      const ids = batch.map((r) => r.id as string);
      await supabase.from('campaign_recipients').update({ status: 'sending' }).in('id', ids);

      const subIds = batch.map((r) => r.subscriber_id as string);
      const { data: subs, error: sErr } = await supabase
        .from('subscribers')
        .select('id, email, first_name, last_name, school_name, status')
        .in('id', subIds);
      if (sErr) return { ok: false, sent, failed, skipped, remaining: -1, error: sErr.message };
      const subById = new Map((subs || []).map((s) => [s.id as string, s as SubscriberMergeRow]));

      const eventRows: Record<string, unknown>[] = [];

      for (const row of batch) {
        const recId = row.id as string;
        const sub = subById.get(row.subscriber_id as string);

        /* Poslední pojistka: mezitím odhlášený kontakt přeskočit. */
        if (!sub || sub.status !== 'subscribed') {
          await supabase
            .from('campaign_recipients')
            .update({ status: 'skipped', error: sub ? `status=${sub.status}` : 'subscriber neexistuje' })
            .eq('id', recId);
          skipped += 1;
          continue;
        }

        try {
          const trackToken = await createTrackingToken(campaignId, sub.id);
          const unsubToken = await createMailingToken('unsub', sub.email);
          const unsubUrl = `${edgeFunctionBase()}/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

          let html = applyMergeFields(htmlBody, sub);
          /* Mailchimp merge tag v šabloně editoru → náš podepsaný unsubscribe odkaz. */
          html = html.split('*|UNSUB|*').join(unsubUrl);
          html = rewriteLinksForTracking(html, trackToken);
          html = appendTrackingAndFooter(html, trackToken, unsubUrl);

          const result = await sendResendEmail({
            to: sub.email,
            subject: applyMergeFields(subject, sub),
            html,
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            tags: [{ name: 'campaign_id', value: campaignId }],
          });

          if (result.ok) {
            await supabase
              .from('campaign_recipients')
              .update({ status: 'sent', provider_message_id: result.id, sent_at: new Date().toISOString(), error: null })
              .eq('id', recId);
            eventRows.push({
              event_type: 'send',
              source: 'resend',
              occurred_at: new Date().toISOString(),
              campaign_id: campaignId,
              subscriber_id: sub.id,
              provider_event_id: result.id,
              dedupe_key: `resend:send:${campaignId}:${sub.id}`,
            });
            sent += 1;
          } else {
            await supabase
              .from('campaign_recipients')
              .update({ status: 'failed', error: `Resend ${result.status}: ${result.error}`.slice(0, 500) })
              .eq('id', recId);
            failed += 1;
          }
        } catch (e) {
          await supabase
            .from('campaign_recipients')
            .update({ status: 'failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
            .eq('id', recId);
          failed += 1;
        }
      }

      if (eventRows.length > 0) {
        const { error: evErr } = await supabase
          .from('email_events')
          .upsert(eventRows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
        if (evErr) console.warn('[sendEngine] email_events insert:', evErr.message);
      }
    }

    const { count } = await supabase
      .from('campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');
    const remaining = typeof count === 'number' ? count : -1;

    if (remaining === 0) {
      /* Hotovo — kampaň uzavřít (jen pokud nebyla mezitím zrušena). */
      const { data: cur } = await supabase.from('campaigns').select('status').eq('id', campaignId).maybeSingle();
      if (cur?.status === 'sending') {
        await supabase
          .from('campaigns')
          .update({ status: 'sent', finished_at: new Date().toISOString(), send_time: new Date().toISOString() })
          .eq('id', campaignId);
      }
    }

    return { ok: true, sent, failed, skipped, remaining };
  } catch (e) {
    return { ok: false, sent, failed, skipped, remaining: -1, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Self-invoke: pošli požadavek na cron endpoint, aby worker pokračoval (fire-and-forget). */
export function scheduleSendContinuation(): void {
  const secret = Deno.env.get('MAILING_CRON_SECRET')?.trim();
  if (!secret) return;
  const url = `${edgeFunctionBase()}/cron/mailing-send`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
    body: '{}',
  }).catch(() => {});
}
