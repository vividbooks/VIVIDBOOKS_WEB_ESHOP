/**
 * Export kontaktů pro registr škol (aplikace Ultra, `/api/registr/*`).
 *
 * `GET /identity/registr-export?since=<ISO>&offset=<n>&limit=<n>`, chráněno stejným
 * tajemstvím jako `/identity/upsert` (identityUpsertAuthorized). Vrací osoby z grafu
 * identit s adresami a stavem odběru, jejich vazby na školy (IČO / kód), e-mailové
 * události (otevření, kliknutí, odhlášení …) a registrace/účast na webinářích.
 * Registr z toho staví jednotný proud aktivity u kontaktu; web zůstává vlastníkem
 * mailingu i souhlasů.
 */
import type { Context } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { identityUpsertAuthorized } from './identityUpsert.ts';

type WebinarIdxEntry = {
  webinarId: string;
  webinarTitle: string;
  webinarSlug: string;
  attended: boolean;
  attendedAt?: string;
  registeredAt: string;
};

type Deps = {
  getWebinarEmailIndexRows: (email: string) => Promise<WebinarIdxEntry[]>;
};

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const WEBINAR_CACHE_TTL_MS = 10 * 60_000;
const EVENT_WINDOW_DAYS = 400;

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

type WebinarReg = { webinarId: string; title: string; registeredAt: string | null; attended: boolean; attendedAt: string | null };
let webinarCache: { at: number; byEmail: Map<string, WebinarReg[]> } | null = null;

/**
 * Klíče `webinar_reg_<webinarId>_<email>` (bez `webinar_reg_email_idx_*`). Starší
 * registrace nemají `webinarId` ani `registeredAt` v hodnotě, proto se ID bere
 * z klíče a datum z čehokoli, co vypadá jako čas.
 */
async function loadWebinarRegistrations(sb: ReturnType<typeof createClient>): Promise<Map<string, WebinarReg[]>> {
  if (webinarCache && Date.now() - webinarCache.at < WEBINAR_CACHE_TTL_MS) return webinarCache.byEmail;
  const byEmail = new Map<string, WebinarReg[]>();
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('kv_store_33b2092f')
      .select('key, value')
      .like('key', 'webinar_reg_%')
      .not('key', 'like', 'webinar_reg_email_idx_%')
      .order('key')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data || []) as Array<{ key: string; value: Record<string, unknown> | null }>;
    for (const { key, value } of rows) {
      const reg = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const rest = key.slice('webinar_reg_'.length);
      let email = String(reg.email || '').toLowerCase().trim();
      let webinarId = String(reg.webinarId || reg.webinar_id || '').trim();
      if (!email) {
        const at = rest.indexOf('@');
        if (at > 0) {
          const underscore = rest.lastIndexOf('_', at);
          if (underscore > 0) email = rest.slice(underscore + 1).toLowerCase().trim();
        }
      }
      if (!webinarId && email && rest.toLowerCase().endsWith('_' + email)) {
        webinarId = rest.slice(0, rest.length - email.length - 1);
      }
      if (!email || !webinarId || !email.includes('@')) continue;
      const list = byEmail.get(email) || [];
      if (list.some((w) => w.webinarId === webinarId)) continue;
      const registeredAt = [reg.registeredAt, reg.createdAt, reg.created_at, reg.timestamp, reg.date]
        .map((v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null))
        .find(Boolean) ?? null;
      list.push({
        webinarId,
        title: String(reg.webinarTitle || reg.title || webinarId),
        registeredAt,
        attended: Boolean(reg.attended),
        attendedAt: typeof reg.attendedAt === 'string' ? reg.attendedAt : null,
      });
      byEmail.set(email, list);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  webinarCache = { at: Date.now(), byEmail };
  return byEmail;
}

export async function handleRegistrExportGet(c: Context, deps: Deps) {
  if (!identityUpsertAuthorized(c.req.raw)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const sb = serviceClient();
  if (!sb) return c.json({ error: 'Supabase service role není nakonfigurován.' }, 503);

  const since = (c.req.query('since') || '').trim() || null;
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(c.req.query('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  try {
    // 1) osoby (přírůstkově podle updated_at)
    let peopleQuery = sb
      .from('identity_people')
      .select(
        'id, first_name, last_name, phone, role, subjects, school_stages, pd_person_id, app_user_id, updated_at, last_seen_at, ' +
          'identity_emails(email, is_primary, source, subscriber_id), ' +
          'identity_memberships(role, source, identity_orgs(ico, organization_code, school_name))',
      )
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);
    if (since) peopleQuery = peopleQuery.gt('updated_at', since);
    const { data: peopleRows, error: peopleError } = await peopleQuery;
    if (peopleError) return c.json({ error: peopleError.message }, 500);
    const people = (peopleRows || []) as Array<Record<string, any>>;

    const emails = [...new Set(people.flatMap((p) => (p.identity_emails || []).map((e: any) => String(e.email || '').toLowerCase())).filter(Boolean))];

    // 2) odběratelé (stav souhlasu, engagement)
    const subscribersByEmail = new Map<string, Record<string, any>>();
    for (let i = 0; i < emails.length; i += 200) {
      const chunk = emails.slice(i, i + 200);
      const { data } = await sb
        .from('subscribers')
        .select('id, email, status, engagement_score, last_opened_at, last_clicked_at, subscribed_at, unsubscribed_at, contact_type, school_name, ico')
        .in('email', chunk);
      for (const row of data || []) subscribersByEmail.set(String(row.email).toLowerCase(), row);
    }
    const subscriberIds = [...subscribersByEmail.values()].map((s) => String(s.id));
    const emailBySubscriber = new Map([...subscribersByEmail.values()].map((s) => [String(s.id), String(s.email).toLowerCase()]));

    // 3) e-mailové události (jen za poslední ~rok, ať odpověď nebobtná)
    const windowStart = new Date(Date.now() - EVENT_WINDOW_DAYS * 86_400_000).toISOString();
    const eventSince = since && since > windowStart ? since : windowStart;
    const events: Array<Record<string, unknown>> = [];
    const campaignIds = new Set<string>();
    const linkIds = new Set<string>();
    const rawEvents: Array<Record<string, any>> = [];
    for (let i = 0; i < subscriberIds.length; i += 100) {
      const chunk = subscriberIds.slice(i, i + 100);
      const { data } = await sb
        .from('email_events')
        .select('id, event_type, source, occurred_at, campaign_id, subscriber_id, link_id, dedupe_key, metadata')
        .in('subscriber_id', chunk)
        .gt('occurred_at', eventSince)
        .order('occurred_at', { ascending: false })
        .limit(4000);
      for (const row of data || []) {
        rawEvents.push(row);
        if (row.campaign_id) campaignIds.add(String(row.campaign_id));
        if (row.link_id) linkIds.add(String(row.link_id));
      }
    }
    const campaignNames = new Map<string, string>();
    if (campaignIds.size) {
      const { data } = await sb.from('campaigns').select('id, name, subject_line').in('id', [...campaignIds]);
      for (const row of data || []) campaignNames.set(String(row.id), String(row.name || row.subject_line || ''));
    }
    const linkUrls = new Map<string, string>();
    if (linkIds.size) {
      const { data } = await sb.from('email_links').select('id, url').in('id', [...linkIds]);
      for (const row of data || []) linkUrls.set(String(row.id), String(row.url || ''));
    }
    for (const row of rawEvents) {
      const email = emailBySubscriber.get(String(row.subscriber_id));
      if (!email) continue;
      const kindMap: Record<string, string> = {
        send: 'mail_sent',
        delivered: 'mail_delivered',
        open: 'mail_opened',
        click: 'mail_clicked',
        bounce: 'mail_bounced',
        complaint: 'mail_bounced',
        unsubscribe: 'mail_unsubscribed',
      };
      const kind = kindMap[String(row.event_type)];
      if (!kind) continue;
      const campaign = row.campaign_id ? campaignNames.get(String(row.campaign_id)) || null : null;
      events.push({
        email,
        kind,
        occurred_at: row.occurred_at,
        title: campaign,
        ref_id: row.campaign_id || null,
        dedupe_key: `web:email_event:${row.dedupe_key || row.id}`,
        payload: {
          source: row.source,
          url: row.link_id ? linkUrls.get(String(row.link_id)) || null : null,
        },
      });
    }

    // 4) identifikované návštěvy webu
    const personIds = people.map((p) => String(p.id));
    for (let i = 0; i < personIds.length; i += 100) {
      const chunk = personIds.slice(i, i + 100);
      const { data } = await sb
        .from('identity_web_events')
        .select('id, person_id, occurred_at, kind, path, entity_id')
        .in('person_id', chunk)
        .gt('occurred_at', eventSince)
        .order('occurred_at', { ascending: false })
        .limit(2000);
      for (const row of data || []) {
        const person = people.find((p) => String(p.id) === String(row.person_id));
        const primary = (person?.identity_emails || []).find((e: any) => e.is_primary) || (person?.identity_emails || [])[0];
        if (!primary?.email) continue;
        const kind = row.kind === 'trial' ? 'trial_requested' : row.kind === 'webinar' ? 'webinar_registered' : 'web_visit';
        events.push({
          email: String(primary.email).toLowerCase(),
          kind,
          occurred_at: row.occurred_at,
          title: row.path || row.entity_id || null,
          ref_id: row.entity_id || null,
          dedupe_key: `web:web_event:${row.id}`,
          payload: { path: row.path, kind: row.kind },
        });
      }
    }

    // 5) webináře — jedním dotazem všechny registrace z KV (cache 10 min), ne po e-mailech
    const webinars: Array<Record<string, unknown>> = [];
    try {
      const byEmail = await loadWebinarRegistrations(sb);
      for (const email of emails) {
        for (const w of byEmail.get(email) || []) webinars.push({ email, ...w });
      }
    } catch (err) {
      console.log(`[registr-export] webinar registrations: ${(err as Error).message}`);
    }

    const outPeople = people.map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone,
      role: p.role,
      subjects: p.subjects || [],
      school_stages: p.school_stages || [],
      pd_person_id: p.pd_person_id,
      app_user_id: p.app_user_id,
      updated_at: p.updated_at,
      last_seen_at: p.last_seen_at,
      emails: (p.identity_emails || []).map((e: any) => {
        const email = String(e.email || '').toLowerCase();
        const sub = subscribersByEmail.get(email) || null;
        return {
          email,
          is_primary: Boolean(e.is_primary),
          source: e.source,
          subscriber: sub
            ? {
                id: sub.id,
                status: sub.status,
                engagement_score: sub.engagement_score,
                last_opened_at: sub.last_opened_at,
                last_clicked_at: sub.last_clicked_at,
                subscribed_at: sub.subscribed_at,
                unsubscribed_at: sub.unsubscribed_at,
                contact_type: sub.contact_type,
                school_name: sub.school_name,
                ico: sub.ico,
              }
            : null,
        };
      }),
      memberships: (p.identity_memberships || []).map((m: any) => ({
        role: m.role,
        source: m.source,
        ico: m.identity_orgs?.ico || null,
        organization_code: m.identity_orgs?.organization_code || null,
        school_name: m.identity_orgs?.school_name || null,
      })),
    }));

    const newestUpdatedAt = people.reduce<string | null>((acc, p) => (p.updated_at && (!acc || p.updated_at > acc) ? p.updated_at : acc), null);
    return c.json({
      people: outPeople,
      events,
      webinars,
      nextOffset: people.length === limit ? offset + limit : null,
      newestUpdatedAt,
    });
  } catch (err: any) {
    console.log(`[registr-export] ${err?.message || err}`);
    return c.json({ error: err?.message || String(err) }, 500);
  }
}

/* ── Webináře: registrace s odpověďmi a dotazníky po webináři ─────────────── */

type SurveyQuestion = { id: string; label: string; type?: string; options?: string[] };

const DEFAULT_PRE_QUESTIONS: SurveyQuestion[] = [
  { id: 'motivation', label: 'S jakou motivací přicházíte na tento webinář?' },
  { id: 'topic_interest', label: 'Co by vás u tématu nejvíce zajímalo?' },
  { id: 'uses_vividbooks', label: 'Používám Vividbooks' },
];

const DEFAULT_POST_QUESTIONS: SurveyQuestion[] = [
  { id: 'post-part2-liked', label: 'Jak se vám webinář líbil?' },
  { id: 'post-part2-improve', label: 'Jak bychom mohli Vividbooks nebo naše webináře ještě vylepšit?' },
  { id: 'post-part2-trial', label: 'Přejete si vyzkoušet Vividbooks nebo zaškolit Vaše kolegy?' },
  { id: 'post-part2-why-not', label: 'Pokud si nepřejete vyzkoušet Vividbooks, napište nám prosím proč ne.' },
];

type WebinarMeta = { id: string; slug: string; title: string; date: string | null; questions: Map<string, SurveyQuestion> };

function questionList(raw: unknown): SurveyQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q) => q && typeof q === 'object' && typeof (q as any).id === 'string' && typeof (q as any).label === 'string')
    .map((q) => ({ id: String((q as any).id), label: String((q as any).label), type: (q as any).type, options: Array.isArray((q as any).options) ? (q as any).options.map(String) : undefined }));
}

async function loadWebinarMeta(sb: ReturnType<typeof createClient>): Promise<Map<string, WebinarMeta>> {
  const { data } = await sb.from('kv_store_33b2092f').select('value').eq('key', 'vividbooks_webinars_v1').maybeSingle();
  const items = ((data?.value as { items?: unknown[] } | null)?.items || []) as Array<Record<string, unknown>>;
  const out = new Map<string, WebinarMeta>();
  for (const w of items) {
    const id = String(w.id || '').trim();
    if (!id) continue;
    const questions = new Map<string, SurveyQuestion>();
    for (const q of [...DEFAULT_PRE_QUESTIONS, ...DEFAULT_POST_QUESTIONS, ...questionList(w.surveyQuestions), ...questionList(w.postWebinarPart2), ...questionList(w.postWebinarQuizQuestions)]) {
      questions.set(q.id, q);
    }
    const date = w.year && w.monthNum && w.day ? `${w.year}-${String(w.monthNum).padStart(2, '0')}-${String(w.day).padStart(2, '0')}` : null;
    const meta: WebinarMeta = { id, slug: String(w.slug || id), title: String(w.title || id), date, questions };
    out.set(id, meta);
    if (meta.slug) out.set(meta.slug, meta);
  }
  return out;
}

function humanizeQuestionId(id: string): string {
  return id.replace(/^dvpp-q-.*-(\d+)$/, 'DVPP otázka $1').replace(/^post-part2-/, '').replace(/[-_]/g, ' ');
}

function answersToList(meta: WebinarMeta | undefined, answers: Record<string, unknown>): Array<{ id: string; question: string; answer: string }> {
  const out: Array<{ id: string; question: string; answer: string }> = [];
  for (const [id, value] of Object.entries(answers || {})) {
    const text = typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
    if (!text) continue;
    const q = meta?.questions.get(id) ?? DEFAULT_PRE_QUESTIONS.find((d) => d.id === id) ?? DEFAULT_POST_QUESTIONS.find((d) => d.id === id);
    out.push({ id, question: q?.label ?? humanizeQuestionId(id), answer: text === 'yes' ? 'ano' : text === 'no' ? 'ne' : text });
  }
  return out;
}

/**
 * `GET /identity/registr-webinars?offset=&limit=` — registrace na webináře
 * (včetně odpovědí z registračního formuláře) a dotazníky po webináři, po
 * stránkách klíčů z KV. Stejné tajemství jako `identity/upsert`.
 */
export async function handleRegistrWebinarsGet(c: Context) {
  if (!identityUpsertAuthorized(c.req.raw)) return c.json({ error: 'unauthorized' }, 401);
  const sb = serviceClient();
  if (!sb) return c.json({ error: 'Supabase service role není nakonfigurován.' }, 503);
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query('limit') || '500', 10) || 500));
  try {
    const meta = await loadWebinarMeta(sb);
    const { data, error } = await sb
      .from('kv_store_33b2092f')
      .select('key, value')
      .or('key.like.webinar_reg_%,key.like.webinar_survey_%')
      .not('key', 'like', 'webinar_reg_email_idx_%')
      .not('key', 'like', 'webinar_survey_light_%')
      .not('key', 'like', 'webinar_survey_partial_%')
      .not('key', 'like', 'webinar_survey_public%')
      .order('key')
      .range(offset, offset + limit - 1);
    if (error) return c.json({ error: error.message }, 500);
    const registrations: Array<Record<string, unknown>> = [];
    const surveys: Array<Record<string, unknown>> = [];
    for (const { key, value } of (data || []) as Array<{ key: string; value: Record<string, unknown> | null }>) {
      const reg = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      if (key.startsWith('webinar_reg_')) {
        const rest = key.slice('webinar_reg_'.length);
        let email = String(reg.email || '').toLowerCase().trim();
        let webinarId = String(reg.webinarId || '').trim();
        if (!email) {
          const at = rest.indexOf('@');
          const underscore = at > 0 ? rest.lastIndexOf('_', at) : -1;
          if (underscore > 0) email = rest.slice(underscore + 1).toLowerCase().trim();
        }
        if (!webinarId && email && rest.toLowerCase().endsWith('_' + email)) webinarId = rest.slice(0, rest.length - email.length - 1);
        if (!email || !webinarId) continue;
        const m = meta.get(webinarId);
        const answers: Record<string, unknown> = {};
        if (reg.webinarMotivation) answers.motivation = reg.webinarMotivation;
        if (reg.webinarTopicInterest) answers.topic_interest = reg.webinarTopicInterest;
        if (reg.usesVividbooks) answers.uses_vividbooks = reg.usesVividbooks;
        registrations.push({
          email,
          webinarId,
          title: String(reg.webinarTitle || m?.title || webinarId),
          date: m?.date ?? null,
          registeredAt: typeof reg.registeredAt === 'string' ? reg.registeredAt : null,
          attended: Boolean(reg.attended),
          attendedAt: typeof reg.attendedAt === 'string' ? reg.attendedAt : null,
          answers: answersToList(m, answers),
          profile: {
            name: reg.name ?? null,
            position: reg.position ?? null,
            schoolName: reg.schoolName ?? null,
            ico: reg.ico ?? null,
            teacherSubjects: reg.teacherSubjects ?? null,
            schoolStages: reg.schoolStages ?? null,
            newsletter: reg.newsletter ?? null,
            notTeacher: reg.notTeacher ?? null,
          },
        });
      } else {
        const email = String(reg.email || '').toLowerCase().trim();
        const webinarId = String(reg.webinarId || '').trim();
        if (!email || !webinarId) continue;
        const m = meta.get(webinarId);
        surveys.push({
          email,
          webinarId,
          title: m?.title ?? webinarId,
          date: m?.date ?? null,
          submittedAt: typeof reg.submittedAt === 'string' ? reg.submittedAt : null,
          answers: answersToList(m, (reg.answers as Record<string, unknown>) || {}),
        });
      }
    }
    return c.json({ registrations, surveys, nextOffset: (data || []).length === limit ? offset + limit : null });
  } catch (err: any) {
    return c.json({ error: err?.message || String(err) }, 500);
  }
}
