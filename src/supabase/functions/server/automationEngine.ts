/**
 * Automatizační engine vlastního mailingu (Fáze 3 náhrady Mailchimp journeys).
 *
 * Datový model (migrace 20260415140000): automation_flows.definition JSONB
 * + automation_enrollments (unikát flow+subscriber, status active/completed/exited/paused).
 *
 * Definice flow:
 * {
 *   trigger: { type: 'subscriber_created'|'tag_added'|'trial_activated'|'webinar_registered'|'order_paid',
 *              filter?: { source?: string, tag?: string } },
 *   steps: [
 *     { key, type: 'send_email', draftId?, subject?, html? },
 *     { key, type: 'wait', days?, hours?, untilField?: 'trial_expires_at', offsetDays? },
 *     { key, type: 'add_tag'|'remove_tag', tag },
 *     { key, type: 'condition', if: { hasTag?, isCustomer? }, thenKey?, elseKey? },
 *     { key, type: 'exit' },
 *   ]
 * }
 *
 * Enrollment: current_step_key = krok, který se má vykonat; context.next_run_at = kdy.
 * Runner (cron á 5 min) vykonává splatné kroky; wait posune next_run_at, send jde přes Resend.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from './resendClient.ts';
import { createMailingToken } from './mailingTokens.ts';
import { applyMergeFields } from './campaignSendEngine.ts';
import * as kv from './kv_store.tsx';

export type AutomationTriggerType =
  | 'subscriber_created'
  | 'tag_added'
  | 'trial_activated'
  | 'webinar_registered'
  | 'order_paid';

export type AutomationEvent = {
  type: AutomationTriggerType;
  /** source subscriberu (pro filter.source u subscriber_created). */
  source?: string;
  /** název/slug tagu (pro tag_added). */
  tag?: string;
};

type FlowTrigger = { type?: string; filter?: { source?: string; tag?: string } };
type FlowStep = {
  key: string;
  type: 'send_email' | 'wait' | 'add_tag' | 'remove_tag' | 'condition' | 'exit';
  draftId?: string;
  subject?: string;
  html?: string;
  days?: number;
  hours?: number;
  untilField?: 'trial_expires_at';
  offsetDays?: number;
  tag?: string;
  if?: { hasTag?: string; isCustomer?: boolean };
  thenKey?: string;
  elseKey?: string;
};
type FlowDefinition = { trigger?: FlowTrigger; steps?: FlowStep[] };

function edgeFunctionBase(): string {
  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  return `${url}/functions/v1/make-server-93a20b6f`;
}

function triggerMatches(trigger: FlowTrigger | undefined, event: AutomationEvent): boolean {
  if (!trigger || trigger.type !== event.type) return false;
  const f = trigger.filter || {};
  if (f.source && f.source !== (event.source || '')) return false;
  if (f.tag && f.tag !== (event.tag || '')) return false;
  return true;
}

/**
 * Založí enrollmenty pro všechny aktivní flows s odpovídajícím triggerem.
 * Idempotentní (unikát flow+subscriber, ignoreDuplicates). Neblokující — chyby jen loguje.
 */
export async function enrollInFlows(
  supabase: SupabaseClient,
  event: AutomationEvent,
  subscriberId: string,
): Promise<{ enrolled: number }> {
  try {
    const { data: flows, error } = await supabase
      .from('automation_flows')
      .select('id, definition')
      .eq('is_active', true);
    if (error) throw new Error(error.message);

    const matching = (flows || []).filter((f) =>
      triggerMatches((f.definition as FlowDefinition | null)?.trigger, event),
    );
    if (matching.length === 0) return { enrolled: 0 };

    const nowIso = new Date().toISOString();
    const rows = matching.map((f) => {
      const steps = ((f.definition as FlowDefinition | null)?.steps || []) as FlowStep[];
      return {
        flow_id: f.id as string,
        subscriber_id: subscriberId,
        status: 'active',
        current_step_key: steps[0]?.key || null,
        context: { next_run_at: nowIso, trigger_event: event },
      };
    });
    const { data: inserted, error: insErr } = await supabase
      .from('automation_enrollments')
      .upsert(rows, { onConflict: 'flow_id,subscriber_id', ignoreDuplicates: true })
      .select('id');
    if (insErr) throw new Error(insErr.message);
    return { enrolled: (inserted || []).length };
  } catch (e) {
    console.warn('[automation] enrollInFlows:', e instanceof Error ? e.message : String(e));
    return { enrolled: 0 };
  }
}

type SubscriberRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  school_name: string | null;
  status: string;
  is_customer: boolean | null;
  trial_expires_at: string | null;
};

/** Vypočítá next_run_at pro wait krok. */
function waitTarget(step: FlowStep, sub: SubscriberRow): string {
  if (step.untilField === 'trial_expires_at' && sub.trial_expires_at) {
    const base = Date.parse(sub.trial_expires_at);
    const offsetMs = (step.offsetDays || 0) * 24 * 3600 * 1000;
    return new Date(Math.max(base + offsetMs, Date.now())).toISOString();
  }
  const ms = ((step.days || 0) * 24 + (step.hours || 0)) * 3600 * 1000;
  return new Date(Date.now() + Math.max(ms, 0)).toISOString();
}

async function subscriberHasTag(supabase: SupabaseClient, subscriberId: string, tagName: string): Promise<boolean> {
  const { data: tag } = await supabase.from('tags').select('id').or(`name.eq.${tagName},slug.eq.${tagName}`).maybeSingle();
  if (!tag?.id) return false;
  const { data } = await supabase
    .from('subscriber_tags')
    .select('subscriber_id')
    .eq('subscriber_id', subscriberId)
    .eq('tag_id', tag.id)
    .maybeSingle();
  return Boolean(data);
}

async function addOrRemoveTag(
  supabase: SupabaseClient,
  subscriberId: string,
  tagName: string,
  remove: boolean,
): Promise<void> {
  const slug = tagName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const { data: tag } = await supabase.from('tags').upsert({ name: tagName, slug }, { onConflict: 'slug' }).select('id').single();
  if (!tag?.id) return;
  if (remove) {
    await supabase.from('subscriber_tags').delete().eq('subscriber_id', subscriberId).eq('tag_id', tag.id);
  } else {
    await supabase
      .from('subscriber_tags')
      .upsert({ subscriber_id: subscriberId, tag_id: tag.id, source: 'system' }, { onConflict: 'subscriber_id,tag_id', ignoreDuplicates: true });
  }
}

/** Fallback obal, když draft nemá fullHtml — jednoduché bílé tělo. */
function minimalEmailWrap(body: string): string {
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"/></head><body style="margin:0;padding:24px;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;font-size:16px;line-height:1.6;color:#333333;">${body}</div></body></html>`;
}

/** Pošle e-mail kroku automatizace (draft z KV nebo inline HTML) přes Resend. */
async function sendAutomationEmail(
  supabase: SupabaseClient,
  flowId: string,
  step: FlowStep,
  sub: SubscriberRow,
): Promise<{ ok: boolean; error?: string }> {
  let subject = String(step.subject || '');
  let html = String(step.html || '');
  if (step.draftId) {
    try {
      const draft = await kv.get(`vb:email-draft:${step.draftId}`);
      if (draft) {
        if (!subject) subject = String(draft.subject || '');
        if (!html) html = String(draft.fullHtml || '') || minimalEmailWrap(String(draft.bodyHtml || ''));
      }
    } catch (e) {
      console.warn('[automation] draft load:', e instanceof Error ? e.message : String(e));
    }
  }
  if (!subject || !html) return { ok: false, error: `Krok ${step.key}: chybí subject nebo html.` };

  const unsubToken = await createMailingToken('unsub', sub.email);
  const unsubUrl = `${edgeFunctionBase()}/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

  let rendered = applyMergeFields(html, sub);
  rendered = rendered.split('*|UNSUB|*').join(unsubUrl);
  if (!rendered.includes('/unsubscribe?token=')) {
    const footer =
      `<div style="max-width:560px;margin:16px auto 0;padding:0 12px 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;">` +
      `<p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">` +
      `Dostáváte novinky Vividbooks. <a href="${unsubUrl}" style="color:#6b7280;">Odhlásit se z odběru</a>` +
      `</p></div>`;
    rendered = /<\/body>/i.test(rendered) ? rendered.replace(/<\/body>/i, `${footer}</body>`) : rendered + footer;
  }

  const result = await sendResendEmail({
    to: sub.email,
    subject: applyMergeFields(subject, sub),
    html: rendered,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'flow_id', value: flowId },
      { name: 'step_key', value: step.key },
    ],
  });
  if (!result.ok) return { ok: false, error: `Resend ${result.status}: ${result.error}` };

  await supabase.from('email_events').upsert(
    {
      event_type: 'send',
      source: 'resend',
      occurred_at: new Date().toISOString(),
      subscriber_id: sub.id,
      provider_event_id: result.id,
      dedupe_key: `flow:send:${flowId}:${step.key}:${sub.id}`,
      metadata: { flow_id: flowId, step_key: step.key },
    },
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  );
  return { ok: true };
}

export type AutomationRunResult = {
  ok: boolean;
  processed: number;
  sent: number;
  completed: number;
  exited: number;
  errors: string[];
};

/**
 * Vykoná splatné kroky aktivních enrollmentů (context.next_run_at <= now).
 * Idempotentní: send kroky mají dedupe v email_events; enrollment se posouvá po každém kroku.
 */
export async function runAutomationSteps(
  supabase: SupabaseClient,
  opts?: { limit?: number; timeBudgetMs?: number },
): Promise<AutomationRunResult> {
  const limit = opts?.limit ?? 100;
  const timeBudgetMs = opts?.timeBudgetMs ?? 45_000;
  const startedAt = Date.now();
  const out: AutomationRunResult = { ok: true, processed: 0, sent: 0, completed: 0, exited: 0, errors: [] };

  try {
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabase
      .from('automation_enrollments')
      .select('id, flow_id, subscriber_id, status, current_step_key, context')
      .eq('status', 'active')
      .lte('context->>next_run_at', nowIso)
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (error) {
      return { ...out, ok: false, errors: [error.message] };
    }
    if (!due || due.length === 0) return out;

    /* Cache flows (typicky jednotky). */
    const flowIds = [...new Set(due.map((e) => e.flow_id as string))];
    const { data: flows, error: fErr } = await supabase
      .from('automation_flows')
      .select('id, is_active, definition')
      .in('id', flowIds);
    if (fErr) return { ...out, ok: false, errors: [fErr.message] };
    const flowById = new Map((flows || []).map((f) => [f.id as string, f]));

    for (const enr of due) {
      if (Date.now() - startedAt > timeBudgetMs) break;
      out.processed += 1;
      const enrId = enr.id as string;
      const flow = flowById.get(enr.flow_id as string);
      const definition = (flow?.definition || {}) as FlowDefinition;
      const steps = (definition.steps || []) as FlowStep[];

      /* Pauznuté / smazané flow — enrollment nechat být (pauza flow zastaví odesílání). */
      if (!flow || !flow.is_active || steps.length === 0) continue;

      const { data: sub } = await supabase
        .from('subscribers')
        .select('id, email, first_name, last_name, school_name, status, is_customer, trial_expires_at')
        .eq('id', enr.subscriber_id as string)
        .maybeSingle();

      /* Odhlášený / neexistující kontakt → exited. */
      if (!sub || ['unsubscribed', 'cleaned'].includes(String(sub.status))) {
        await supabase
          .from('automation_enrollments')
          .update({ status: 'exited', exited_at: new Date().toISOString() })
          .eq('id', enrId);
        out.exited += 1;
        continue;
      }
      const subscriber = sub as SubscriberRow;

      let stepIdx = steps.findIndex((s) => s.key === enr.current_step_key);
      if (stepIdx < 0) stepIdx = 0;
      const ctx = (enr.context && typeof enr.context === 'object' ? enr.context : {}) as Record<string, unknown>;

      /* Vykonávej po sobě jdoucí okamžité kroky; wait ukončí průchod. Pojistka proti cyklům. */
      let guard = 0;
      let finished = false;
      let failedStep = false;
      while (stepIdx < steps.length && guard < 25) {
        guard += 1;
        const step = steps[stepIdx];
        if (step.type === 'exit') {
          finished = true;
          break;
        }
        if (step.type === 'wait') {
          const target = waitTarget(step, subscriber);
          const nextKey = steps[stepIdx + 1]?.key;
          if (!nextKey) {
            finished = true;
            break;
          }
          if (Date.parse(target) > Date.now()) {
            await supabase
              .from('automation_enrollments')
              .update({ current_step_key: nextKey, context: { ...ctx, next_run_at: target } })
              .eq('id', enrId);
            failedStep = true; /* ne chyba — jen konec průchodu (čekáme) */
            break;
          }
          stepIdx += 1;
          continue;
        }
        if (step.type === 'send_email') {
          const res = await sendAutomationEmail(supabase, enr.flow_id as string, step, subscriber);
          if (!res.ok) {
            out.errors.push(`enrollment ${enrId}: ${res.error}`);
            /* Chybu zkusíme příště znovu — posuň next_run_at o hodinu, krok nech. */
            await supabase
              .from('automation_enrollments')
              .update({
                current_step_key: step.key,
                context: { ...ctx, next_run_at: new Date(Date.now() + 3600_000).toISOString(), last_error: res.error },
              })
              .eq('id', enrId);
            failedStep = true;
            break;
          }
          out.sent += 1;
          stepIdx += 1;
          continue;
        }
        if (step.type === 'add_tag' || step.type === 'remove_tag') {
          if (step.tag) await addOrRemoveTag(supabase, subscriber.id, step.tag, step.type === 'remove_tag');
          stepIdx += 1;
          continue;
        }
        if (step.type === 'condition') {
          let pass = true;
          if (step.if?.hasTag) pass = await subscriberHasTag(supabase, subscriber.id, step.if.hasTag);
          if (pass && typeof step.if?.isCustomer === 'boolean') pass = Boolean(subscriber.is_customer) === step.if.isCustomer;
          const targetKey = pass ? step.thenKey : step.elseKey;
          if (targetKey) {
            const t = steps.findIndex((s) => s.key === targetKey);
            if (t >= 0) {
              stepIdx = t;
              continue;
            }
          }
          if (!pass && !step.elseKey) {
            finished = true; /* nesplněná podmínka bez větve = exit */
            break;
          }
          stepIdx += 1;
          continue;
        }
        stepIdx += 1;
      }

      if (finished || (!failedStep && stepIdx >= steps.length)) {
        await supabase
          .from('automation_enrollments')
          .update({ status: 'completed', exited_at: new Date().toISOString(), current_step_key: null })
          .eq('id', enrId);
        out.completed += 1;
      } else if (!failedStep && guard >= 25) {
        out.errors.push(`enrollment ${enrId}: překročen limit kroků (možný cyklus v definici)`);
        await supabase
          .from('automation_enrollments')
          .update({ status: 'exited', exited_at: new Date().toISOString() })
          .eq('id', enrId);
        out.exited += 1;
      }
    }

    return out;
  } catch (e) {
    return { ...out, ok: false, errors: [...out.errors, e instanceof Error ? e.message : String(e)] };
  }
}
