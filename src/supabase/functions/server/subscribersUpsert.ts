/**
 * Sdílený upsert kontaktu do public.subscribers (zdroj pravdy vlastního mailingu).
 *
 * Pravidla:
 * - klíč = lower(trim(email)); jméno/telefon/škola se doplní jen pokud v DB chybí
 * - `source` a `contact_type` se nastaví jen při insertu (historie prvního kontaktu)
 * - status: nikdy nepřepisovat `unsubscribed`/`cleaned` zpět na `subscribed`
 *   bez explicitního `resubscribe: true`
 * - tagy: vytvoří chybějící v `tags` (slug z názvu) a přidá vazby se `source: 'system'`
 *
 * Volá se z registračních endpointů neblokujícím způsobem (try/catch u volajícího).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { slugTag } from './mailchimpContactsMigrate.ts';

export type SubscriberUpsertInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  schoolName?: string | null;
  ico?: string | null;
  /** Pozice / role (sloupec position_label — hodnota z formulářů, dřív Mailchimp SELECT). */
  positionLabel?: string | null;
  /** Jen při insertu. */
  source?: 'newsletter' | 'trial' | 'webinar' | 'checkout' | 'mailchimp_import' | 'manual' | 'other' | 'dvpp';
  /** Jen při insertu. */
  contactType?: 'teacher' | 'school_admin' | 'parent' | 'homeschool' | 'unknown';
  /** Výchozí `subscribed`; `pending` pro double opt-in (newsletter). Nikdy nedowngraduje existující `subscribed`. */
  status?: 'subscribed' | 'pending';
  /** true = explicitní resubscribe (napr. potvrzený opt-in) — smí vrátit unsubscribed → subscribed. */
  resubscribe?: boolean;
  /** Názvy tagů (vytvoří se, pokud chybí). */
  tags?: string[];
  /** Extra pole — merge do subscribers.merge_fields (mělké). */
  mergeFields?: Record<string, unknown>;
  /** Trial pole — nastaví se, pokud jsou zadaná. */
  trialStatus?: string;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  /** Objednávka: is_customer=true, total_orders+1, first_purchase_at pokud chybí. */
  recordPurchase?: boolean;
};

export type SubscriberUpsertResult =
  | { ok: true; subscriberId: string; created: boolean; status: string }
  | { ok: false; error: string };

export async function upsertSubscriber(
  supabase: SupabaseClient,
  input: SubscriberUpsertInput,
): Promise<SubscriberUpsertResult> {
  try {
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { ok: false, error: `Neplatný e-mail: ${input.email}` };
    }

    const { data: existing, error: selErr } = await supabase
      .from('subscribers')
      .select('id, status, first_name, last_name, phone, school_name, ico, position_label, merge_fields, is_customer, total_orders, first_purchase_at, subscribed_at')
      .eq('email', email)
      .maybeSingle();
    if (selErr) return { ok: false, error: selErr.message };

    const nowIso = new Date().toISOString();
    let subscriberId: string;
    let created = false;
    let finalStatus: string;

    if (!existing) {
      const status = input.status === 'pending' ? 'pending' : 'subscribed';
      const insertRow: Record<string, unknown> = {
        email,
        first_name: input.firstName?.trim() || null,
        last_name: input.lastName?.trim() || null,
        phone: input.phone?.trim() || null,
        school_name: input.schoolName?.trim() || null,
        ico: input.ico?.trim() || null,
        position_label: input.positionLabel?.trim() || null,
        source: input.source || 'other',
        contact_type: input.contactType || 'unknown',
        status,
        subscribed_at: status === 'subscribed' ? nowIso : null,
        merge_fields: input.mergeFields && typeof input.mergeFields === 'object' ? input.mergeFields : {},
        ...(input.trialStatus ? { trial_status: input.trialStatus } : {}),
        ...(input.trialStartedAt ? { trial_started_at: input.trialStartedAt } : {}),
        ...(input.trialExpiresAt ? { trial_expires_at: input.trialExpiresAt } : {}),
        ...(input.recordPurchase
          ? { is_customer: true, total_orders: 1, first_purchase_at: nowIso }
          : {}),
      };
      const { data: ins, error: insErr } = await supabase
        .from('subscribers')
        .insert(insertRow)
        .select('id, status')
        .single();
      if (insErr) {
        /* Souběh (unikát email) — zkusíme načíst a pokračovat updatem. */
        const { data: retry } = await supabase
          .from('subscribers')
          .select('id, status')
          .eq('email', email)
          .maybeSingle();
        if (!retry?.id) return { ok: false, error: insErr.message };
        subscriberId = retry.id as string;
        finalStatus = retry.status as string;
      } else {
        subscriberId = ins.id as string;
        finalStatus = ins.status as string;
        created = true;
      }
    } else {
      subscriberId = existing.id as string;
      finalStatus = existing.status as string;

      const patch: Record<string, unknown> = {};
      if (!existing.first_name && input.firstName?.trim()) patch.first_name = input.firstName.trim();
      if (!existing.last_name && input.lastName?.trim()) patch.last_name = input.lastName.trim();
      if (!existing.phone && input.phone?.trim()) patch.phone = input.phone.trim();
      if (!existing.school_name && input.schoolName?.trim()) patch.school_name = input.schoolName.trim();
      if (!existing.ico && input.ico?.trim()) patch.ico = input.ico.trim();
      if (!existing.position_label && input.positionLabel?.trim()) patch.position_label = input.positionLabel.trim();

      if (input.mergeFields && typeof input.mergeFields === 'object' && Object.keys(input.mergeFields).length) {
        patch.merge_fields = {
          ...(existing.merge_fields && typeof existing.merge_fields === 'object' ? existing.merge_fields : {}),
          ...input.mergeFields,
        };
      }

      if (input.trialStatus) patch.trial_status = input.trialStatus;
      if (input.trialStartedAt) patch.trial_started_at = input.trialStartedAt;
      if (input.trialExpiresAt) patch.trial_expires_at = input.trialExpiresAt;

      if (input.recordPurchase) {
        patch.is_customer = true;
        patch.total_orders = (Number(existing.total_orders) || 0) + 1;
        if (!existing.first_purchase_at) patch.first_purchase_at = nowIso;
      }

      /* Status přechody: unsubscribed/cleaned drží, pokud není explicitní resubscribe. */
      const cur = existing.status as string;
      if (input.resubscribe && cur !== 'subscribed') {
        patch.status = 'subscribed';
        patch.subscribed_at = nowIso;
        patch.unsubscribed_at = null;
        finalStatus = 'subscribed';
      } else if (cur === 'pending' && (input.status ?? 'subscribed') === 'subscribed') {
        /* Byl pending (čeká na opt-in) a přišel single opt-in zdroj (webinar/trial/checkout) → subscribed. */
        patch.status = 'subscribed';
        patch.subscribed_at = existing.subscribed_at || nowIso;
        finalStatus = 'subscribed';
      }

      if (Object.keys(patch).length > 0) {
        const { error: updErr } = await supabase.from('subscribers').update(patch).eq('id', subscriberId);
        if (updErr) return { ok: false, error: updErr.message };
      }
    }

    /* Tagy — vytvoř chybějící, přidej vazby (ignoruj existující). */
    const tagNames = (input.tags || []).map((t) => String(t).trim()).filter(Boolean);
    if (tagNames.length > 0) {
      const tagIds: string[] = [];
      for (const name of tagNames) {
        const slug = slugTag(name);
        const { data: tag, error: tagErr } = await supabase
          .from('tags')
          .upsert({ name, slug }, { onConflict: 'slug' })
          .select('id')
          .single();
        if (tagErr) {
          console.warn('[subscribersUpsert] tag upsert', name, tagErr.message);
          continue;
        }
        if (tag?.id) tagIds.push(tag.id as string);
      }
      if (tagIds.length > 0) {
        const rows = tagIds.map((tag_id) => ({
          subscriber_id: subscriberId,
          tag_id,
          source: 'system' as const,
        }));
        const { error: stErr } = await supabase
          .from('subscriber_tags')
          .upsert(rows, { onConflict: 'subscriber_id,tag_id', ignoreDuplicates: true });
        if (stErr) console.warn('[subscribersUpsert] subscriber_tags', stErr.message);
      }
    }

    return { ok: true, subscriberId, created, status: finalStatus };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Service-role klient pro upsert — sdílený helper pro volající v index.tsx. */
export function getServiceRoleEnv(): { url: string; serviceKey: string } | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}
