/**
 * DVPP zdarma — registrace HTTP rout do hlavní Hono aplikace (index.tsx).
 *
 * Každá routa se registruje pod `/make-server-93a20b6f/dvpp/...` i `/dvpp/...` (interní mount).
 * Veřejné routy stačí s anon klíčem; přihlášený učitel posílá `X-Dvpp-Session`;
 * `/admin/dvpp/*` chrání JWT guard v index.tsx (isMailingAdminPath); cron má MAILING_CRON_SECRET.
 *
 * Přehled: docs/dvpp/API.md
 */
import type { Context, Hono } from 'npm:hono';
import { attributionFrom, getSubscriberById, icoDigits, normEmail, readJson, sbService, type SubscriberRow } from './shared.ts';
import { getSessionSubscriber, requestMagicLink, revokeSession, verifyMagicLink, type MagicLinkDeps } from './auth.ts';
import { funnelSummary, recordFunnelEvent, requestContext } from './events.ts';
import {
  backfillSchoolsByDomain, coverageSummary, findSchoolByIco, findSchoolByRedIzo, importRegistry, linkSubscriberToSchool,
  refreshSchoolStatus, resolveSchoolForContact, searchSchools, type RegistryRecord,
} from './schools.ts';
import {
  confirmReferralForEmail, directorConfirm, directorUnlock, ensureStaffroom, getStaffroom, getStaffroomByCode, isDirectorVerified, joinByCode, recountAll, recountOne, sendColleagueMessage, staffroomView, type ColleagueMessageDeps,
} from './staffroom.ts';
import { buildCatalog, getSeries, resolveAccess, saveProgress, saveSeries, type CatalogVideo, type Series } from './catalog.ts';
import { issueCertificate, listCertificates, schoolCertificateReport } from './certificates.ts';
import { listTopics, toggleVote, upsertTopic } from './votes.ts';
import { isDirectorPosition, teacherTypeFromAnswers } from './milestones.ts';
import { activateMember } from './staffroom.ts';
import { DVPP_AUTOMATION_FLOWS, enrollDvpp } from './automations.ts';
import { buildDirectorConfirmEmailHtml } from './emails.ts';
import { importSizes } from './schools.ts';
import { buildDigestDraft, saveDigestDraft } from './digest.ts';
import { parseChapters } from './content.ts';
import * as kv from '../kv_store.tsx';

export type DvppRouteDeps = {
  sendEmail: MagicLinkDeps['sendEmail'];
  buildLoginEmailHtml: MagicLinkDeps['buildLoginEmailHtml'];
  buildColleagueEmailHtml: ColleagueMessageDeps['buildColleagueEmailHtml'];
  publicOrigin: () => string;
  functionBase: () => string;
  /** Existující CSV cache rejstříku (index.tsx `loadSchoolsCache`). */
  loadRegistryRecords: () => Promise<RegistryRecord[]>;
  /** Existující sloučený katalog (index.tsx GET /dvpp-videos). */
  loadVideos: () => Promise<{ topics: Array<{ id: string; name: string; slug: string; order?: number }>; videos: CatalogVideo[] }>;
  cronSecretOk: (c: Context) => boolean;
  /** Webináře z KV (admin kolekce) — pro „naživo tento týden“ v digestu. */
  loadWebinars: () => Promise<Array<Record<string, unknown>>>;
  /** Šablona e-mailu EmailBuilderu (index.tsx vividbooksEmailTemplate) pro fullHtml draftu. */
  buildEmailTemplate: (d: { headline: string; body: string; ctaText: string; ctaUrl: string; preheader: string }) => string;
};

const DVPP_VIDEOS_KV_KEY = 'vividbooks_dvpp_videos_v2';
/** Pole metadat záznamu, která admin spravuje v /marketing/dvpp (ostatní přichází z Webflow / webináře). */
const VIDEO_META_FIELDS = ['durationMinutes', 'lecturer', 'trailerUrl', 'chapters', 'subjects', 'addedAt', 'description', 'name', 'thumbnail', 'topicIds'] as const;

const PREFIX = '/make-server-93a20b6f';

/**
 * První spuštění po nasazení: naplní `schools` z rejstříku a založí DVPP sekvence (vypnuté),
 * aby web fungoval bez ručního klikání v adminu. Volá se z denního cronu, opakovaně je to no-op.
 */
async function ensureProvisioned(
  sb: ReturnType<typeof sbService>,
  deps: { loadRegistryRecords: () => Promise<RegistryRecord[]> },
): Promise<{ schoolsImported?: number; flowsSeeded?: number }> {
  const out: { schoolsImported?: number; flowsSeeded?: number } = {};
  try {
    const { count } = await sb.from('schools').select('red_izo', { count: 'exact', head: true });
    if (!count) {
      const records = await deps.loadRegistryRecords();
      const r = await importRegistry(sb, records);
      out.schoolsImported = r.upserted;
    }
  } catch (e) {
    console.warn('[dvpp] provisioning schools failed', e);
  }
  try {
    const { data } = await sb.from('automation_flows').select('slug');
    const have = new Set(((data || []) as Array<{ slug: string }>).map((f) => f.slug));
    const missing = DVPP_AUTOMATION_FLOWS.filter((f) => !have.has(f.slug));
    if (missing.length) {
      await sb.from('automation_flows').insert(missing.map((f) => ({ name: f.name, slug: f.slug, definition: f.definition, is_active: false })));
      out.flowsSeeded = missing.length;
    }
  } catch (e) {
    console.warn('[dvpp] provisioning flows failed', e);
  }
  return out;
}

export function registerDvppRoutes(app: Hono, deps: DvppRouteDeps): void {
  const both = (method: 'get' | 'post' | 'put' | 'delete', path: string, handler: (c: Context) => Promise<Response> | Response) => {
    app[method](`${PREFIX}${path}`, handler);
    app[method](path, handler);
  };

  const auth = async (c: Context): Promise<SubscriberRow | null> => getSessionSubscriber(sbService(), c.req.raw);
  const needAuth = async (c: Context): Promise<SubscriberRow | Response> => {
    const s = await auth(c);
    return s ?? c.json({ error: 'Přihlaste se prosím (odkaz z e-mailu).', code: 'unauthenticated' }, 401);
  };
  const isResponse = (x: unknown): x is Response => x instanceof Response;

  /* ── Auth ────────────────────────────────────────────────────────────── */
  both('post', '/dvpp/auth/magic-link', async (c) => {
    const body = await readJson(c.req.raw);
    const sb = sbService();
    const attribution = attributionFrom(body);
    const r = await requestMagicLink(sb, {
      sendEmail: deps.sendEmail,
      buildLoginEmailHtml: deps.buildLoginEmailHtml,
      publicOrigin: deps.publicOrigin(),
      functionBase: deps.functionBase(),
    }, {
      email: String(body.email || ''),
      name: String(body.name || ''),
      next: String(body.next || ''),
      newsletter: body.newsletter === true,
      staffroomCode: body.staffroomCode ? String(body.staffroomCode) : null,
      attribution,
    });
    if (!r.ok) return c.json({ error: r.error }, r.status as 400);
    await recordFunnelEvent(sb, {
      event: 'lead', subscriberId: r.subscriberId, email: String(body.email || ''), attribution,
      request: requestContext(c.req.raw), meta: { created: r.created, via: 'magic-link' },
    });
    return c.json({ ok: true, created: r.created });
  });

  both('get', '/dvpp/auth/verify', async (c) => {
    const token = c.req.query('token') || '';
    const sb = sbService();
    const r = await verifyMagicLink(sb, token, c.req.header('user-agent') || null);
    if (!r.ok) return c.json({ error: r.error }, r.status as 400);
    const sub = r.subscriber;
    const events: Array<Promise<unknown>> = [];
    if (r.firstLogin || r.intent) {
      events.push(recordFunnelEvent(sb, {
        event: 'confirmed', subscriberId: sub.id, email: sub.email, redIzo: sub.school_red_izo,
        attribution: r.intent?.attribution || null, request: requestContext(c.req.raw), meta: { firstLogin: r.firstLogin },
      }));
    }
    /* Škola z domény / IČO, pokud ještě chybí. */
    if (!sub.school_red_izo) {
      const found = await resolveSchoolForContact(sb, { ico: sub.ico, email: sub.email });
      if (found) {
        await linkSubscriberToSchool(sb, sub.id, found.school.red_izo);
        events.push(recordFunnelEvent(sb, { event: 'school_linked', subscriberId: sub.id, email: sub.email, redIzo: found.school.red_izo, meta: { via: found.via } }));
      }
    }
    /* Vzkaz kolegovi / kód ze sdíleného odkazu. */
    const ref = await confirmReferralForEmail(sb, sub.email, sub.id);
    const code = r.intent?.staffroomCode || ref.code;
    let joined: { code: string; schoolName: string } | null = null;
    if (code) {
      const fresh = (await getSubscriberById(sb, sub.id)) ?? sub;
      const j = await joinByCode(sb, fresh, code, ref.inviterId);
      if (j.ok) joined = { code: j.staffroom.code, schoolName: j.school.name };
    }
    await Promise.allSettled(events);
    if (r.firstLogin) await enrollDvpp(sb, 'dvpp_confirmed', sub.id);
    const fresh = (await getSubscriberById(sb, sub.id)) ?? sub;
    return c.json({
      ok: true,
      sessionToken: r.sessionToken,
      next: r.next,
      firstLogin: r.firstLogin,
      joined,
      me: await meView(fresh),
    });
  });

  both('post', '/dvpp/auth/logout', async (c) => {
    await revokeSession(sbService(), c.req.raw);
    return c.json({ ok: true });
  });

  /* ── Profil ──────────────────────────────────────────────────────────── */
  const meView = async (s: SubscriberRow) => {
    const sb = sbService();
    const [school, access] = await Promise.all([
      s.school_red_izo ? findSchoolByRedIzo(sb, s.school_red_izo) : Promise.resolve(null),
      resolveAccess(sb, s),
    ]);
    return {
      id: s.id,
      email: s.email,
      firstName: s.first_name,
      lastName: s.last_name,
      position: s.position_label,
      isDirector: isDirectorPosition(s.position_label),
      directorVerified: await isDirectorVerified(s, school),
      teacherType: s.teacher_type,
      profile: s.dvpp_profile || {},
      profileDone: !!(s.dvpp_profile && (s.dvpp_profile as Record<string, unknown>).completed_at),
      school: school ? { redIzo: school.red_izo, name: school.name, city: school.city, teachersCount: school.teachers_count } : null,
      access,
      status: s.status,
    };
  };

  both('get', '/dvpp/me', async (c) => {
    const s = await auth(c);
    if (!s) return c.json({ me: null, access: await resolveAccess(sbService(), null) });
    return c.json({ me: await meView(s) });
  });

  both('put', '/dvpp/me', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const body = await readJson(c.req.raw);
    const sb = sbService();
    const patch: Record<string, unknown> = {};
    if (typeof body.firstName === 'string') patch.first_name = body.firstName.trim().slice(0, 80) || null;
    if (typeof body.lastName === 'string') patch.last_name = body.lastName.trim().slice(0, 80) || null;
    if (typeof body.position === 'string') patch.position_label = body.position.trim().slice(0, 80) || null;
    if (typeof body.schoolName === 'string' && !patch.school_name) patch.school_name = body.schoolName.trim().slice(0, 200) || null;

    let linkedRedIzo: string | null = null;
    if (typeof body.redIzo === 'string' && body.redIzo) {
      const school = await findSchoolByRedIzo(sb, body.redIzo);
      if (school) linkedRedIzo = school.red_izo;
    } else if (typeof body.ico === 'string' && icoDigits(body.ico)) {
      const school = await findSchoolByIco(sb, body.ico);
      if (school) linkedRedIzo = school.red_izo;
      patch.ico = icoDigits(body.ico);
    }

    if (body.profile && typeof body.profile === 'object') {
      const answers = body.profile as Record<string, string | string[] | undefined>;
      const merged = { ...(s.dvpp_profile || {}), ...answers, completed_at: answers.completed_at || (s.dvpp_profile?.completed_at as string | undefined) || new Date().toISOString() };
      patch.dvpp_profile = merged;
      patch.teacher_type = teacherTypeFromAnswers(merged as Record<string, string | string[] | undefined>);
    }
    if (Object.keys(patch).length) await sb.from('subscribers').update(patch).eq('id', s.id);
    if (linkedRedIzo) {
      await linkSubscriberToSchool(sb, s.id, linkedRedIzo, { force: true });
      await recordFunnelEvent(sb, { event: 'school_linked', subscriberId: s.id, email: s.email, redIzo: linkedRedIzo, meta: { via: 'profile' } });
      await refreshSchoolStatus(sb, linkedRedIzo);
    }
    if (body.profile) {
      await recordFunnelEvent(sb, { event: 'profile_done', subscriberId: s.id, email: s.email, redIzo: linkedRedIzo || s.school_red_izo, meta: { teacherType: patch.teacher_type } });
    }
    const fresh = (await getSubscriberById(sb, s.id)) ?? s;
    return c.json({ ok: true, me: await meView(fresh) });
  });

  /* ── Školy ───────────────────────────────────────────────────────────── */
  both('get', '/dvpp/schools/search', async (c) => {
    const q = c.req.query('q') || '';
    const rows = await searchSchools(sbService(), q, 12);
    return c.json({ results: rows.map((r) => ({ redIzo: r.red_izo, ico: r.ico, name: r.name, city: r.city, type: r.type, isPrimary: r.is_primary, teachersCount: r.teachers_count })) });
  });

  /* ── Katalog ─────────────────────────────────────────────────────────── */
  both('get', '/dvpp/catalog', async (c) => {
    const sb = sbService();
    const s = await auth(c);
    const [{ topics, videos }, access] = await Promise.all([deps.loadVideos(), resolveAccess(sb, s)]);
    const cat = await buildCatalog(sb, { videos, topics, subscriber: s, access });
    return c.json({ rows: cat.rows, series: cat.series, topics: cat.topics, access: cat.access, me: s ? await meView(s) : null });
  });

  both('post', '/dvpp/progress', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const body = await readJson(c.req.raw);
    const videoId = String(body.videoId || '').trim();
    if (!videoId) return c.json({ error: 'Chybí videoId.' }, 400);
    const sb = sbService();
    const access = await resolveAccess(sb, s);
    if (access.level === 'starter') {
      const { data: started } = await sb.from('dvpp_progress').select('video_id').eq('subscriber_id', s.id);
      const ids = new Set(((started || []) as Array<{ video_id: string }>).map((r) => r.video_id));
      if (!ids.has(videoId) && ids.size >= access.starterLimit) {
        return c.json({ error: 'Tři záznamy zdarma jste už otevřeli. Pozvěte kolegu, nebo požádejte ředitele o školní kód.', code: 'starter_limit' }, 403);
      }
    }
    const r = await saveProgress(sb, s.id, {
      videoId, position: Number(body.position) || 0, duration: body.duration ? Number(body.duration) : null, completed: body.completed === true,
    });
    if (access.level === 'starter') {
      /* Souběžné otevření více záznamů: po zápisu platí jen prvních N podle času začátku, ostatní se vrátí. */
      const { data: rows } = await sb.from('dvpp_progress').select('video_id, started_at').eq('subscriber_id', s.id)
        .order('started_at', { ascending: true }).order('video_id', { ascending: true });
      const allowed = new Set(((rows || []) as Array<{ video_id: string }>).slice(0, access.starterLimit).map((x) => x.video_id));
      if (!allowed.has(videoId)) {
        await sb.from('dvpp_progress').delete().eq('subscriber_id', s.id).eq('video_id', videoId);
        return c.json({ error: 'Tři záznamy zdarma jste už otevřeli. Pozvěte kolegu, nebo požádejte ředitele o školní kód.', code: 'starter_limit' }, 403);
      }
    }
    if (r.firstPlay) {
      await recordFunnelEvent(sb, { event: 'play', subscriberId: s.id, email: s.email, redIzo: s.school_red_izo, meta: { videoId } });
    }
    if (r.activated) await activateMember(sb, s.id);
    return c.json({ ok: true, activated: r.activated });
  });

  /* ── Certifikáty ─────────────────────────────────────────────────────── */
  both('get', '/dvpp/certificates', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    return c.json({ certificates: await listCertificates(sbService(), s.id) });
  });

  both('post', '/dvpp/certificate', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const body = await readJson(c.req.raw);
    const r = await issueCertificate(sbService(), s, {
      kind: (body.kind as 'dvpp' | 'feedback' | undefined) || 'dvpp',
      webinarId: body.webinarId ? String(body.webinarId) : null,
      videoId: body.videoId ? String(body.videoId) : null,
      title: String(body.title || ''),
      hours: Number(body.hours) || 2,
      lecturer: body.lecturer ? String(body.lecturer) : null,
      holderName: body.holderName ? String(body.holderName) : null,
    });
    if (!r.ok) return c.json({ error: r.error }, r.status as 400);
    return c.json({ ok: true, certificate: r.certificate, created: r.created });
  });

  /* ── Sborovna ────────────────────────────────────────────────────────── */
  both('get', '/dvpp/staffroom', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const v = await staffroomView(sbService(), s);
    return c.json({
      ...v,
      staffroom: v.staffroom ? { code: v.staffroom.code, status: v.staffroom.status, target: v.staffroom.milestone_target, confirmed: v.staffroom.confirmed_count, graceUntil: v.staffroom.grace_until, unlockedBy: v.staffroom.unlocked_by, unlockedAt: v.staffroom.unlocked_at } : null,
      school: v.school ? { redIzo: v.school.red_izo, name: v.school.name, city: v.school.city, teachersCount: v.school.teachers_count, teachersEstimated: v.school.teachers_estimated } : null,
    });
  });

  both('post', '/dvpp/staffroom', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    if (!s.school_red_izo) return c.json({ error: 'Nejdřív vyberte školu v profilu.' }, 400);
    const sb = sbService();
    const school = await findSchoolByRedIzo(sb, s.school_red_izo);
    if (!school) return c.json({ error: 'Škola chybí v rejstříku.' }, 404);
    const { staffroom, created } = await ensureStaffroom(sb, school, s, 'founder');
    await recountOne(sb, staffroom.red_izo);
    return c.json({ ok: true, created, code: staffroom.code, shareUrl: `${deps.publicOrigin()}/s/${staffroom.code}` });
  });

  both('post', '/dvpp/staffroom/share', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const body = await readJson(c.req.raw);
    await recordFunnelEvent(sbService(), { event: 'invite_shared', subscriberId: s.id, email: s.email, redIzo: s.school_red_izo, meta: { channel: String(body.channel || 'link').slice(0, 40) } });
    return c.json({ ok: true });
  });

  both('get', '/dvpp/staffroom/preview', async (c) => {
    const code = c.req.query('code') || '';
    const sb = sbService();
    const sr = await getStaffroomByCode(sb, code);
    if (!sr) return c.json({ error: 'Kód neznáme.' }, 404);
    const school = await findSchoolByRedIzo(sb, sr.red_izo);
    const founder = sr.founder_id ? await getSubscriberById(sb, sr.founder_id) : null;
    return c.json({
      code: sr.code, status: sr.status, confirmed: sr.confirmed_count, target: sr.milestone_target,
      school: school ? { name: school.name, city: school.city } : null,
      founderFirstName: founder?.first_name || null,
    });
  });

  both('post', '/dvpp/staffroom/join', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const body = await readJson(c.req.raw);
    const r = await joinByCode(sbService(), s, String(body.code || ''), null);
    if (!r.ok) return c.json({ error: r.error }, r.status as 404);
    return c.json({ ok: true, added: r.added, alreadyMember: r.alreadyMember, school: { name: r.school.name }, status: r.staffroom.status, confirmed: r.staffroom.confirmed_count, target: r.staffroom.milestone_target });
  });

  both('post', '/dvpp/staffroom/message', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const body = await readJson(c.req.raw);
    const r = await sendColleagueMessage(sbService(), {
      sendEmail: deps.sendEmail, buildColleagueEmailHtml: deps.buildColleagueEmailHtml, publicOrigin: deps.publicOrigin(),
    }, { inviter: s, email: String(body.email || ''), message: String(body.message || ''), clientIp: requestContext(c.req.raw).ip });
    if (!r.ok) return c.json({ error: r.error }, r.status as 400);
    return c.json({ ok: true });
  });

  both('post', '/dvpp/staffroom/director-unlock', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const r = await directorUnlock(sbService(), s, { sendEmail: deps.sendEmail, buildDirectorConfirmEmailHtml, functionBase: deps.functionBase() });
    if (!r.ok) return c.json({ error: r.error }, r.status as 403);
    if (r.pending) return c.json({ ok: true, pending: true, sentTo: r.sentTo });
    return c.json({ ok: true, pending: false, code: r.staffroom.code, status: r.staffroom.status });
  });

  /* Odkaz z potvrzovacího e-mailu školy → odemkne a vrátí ředitele na /pro-reditele. */
  both('get', '/dvpp/staffroom/director-confirm', async (c) => {
    const r = await directorConfirm(sbService(), c.req.query('token') || '');
    const origin = deps.publicOrigin();
    if (!r.ok) return c.redirect(`${origin}/pro-reditele?unlock=error&reason=${encodeURIComponent(r.error)}`, 302);
    return c.redirect(`${origin}/pro-reditele?unlock=confirmed`, 302);
  });

  both('get', '/dvpp/staffroom/report', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    if (!s.school_red_izo) return c.json({ error: 'Nejdřív vyberte školu v profilu.' }, 400);
    if (!isDirectorPosition(s.position_label)) return c.json({ error: 'Výkaz DVPP sboru je pro vedení školy.' }, 403);
    if (!(await isDirectorVerified(s, await findSchoolByRedIzo(sbService(), s.school_red_izo)))) {
      return c.json({ error: 'Výkaz uvidíte po ověření vedení školy (školní e-mail, nebo potvrzení z oficiálního e-mailu školy).', code: 'director_unverified' }, 403);
    }
    const since = c.req.query('since') || `${new Date().getFullYear()}-01-01T00:00:00.000Z`;
    return c.json(await schoolCertificateReport(sbService(), s.school_red_izo, since));
  });

  /* ── Hlasování ───────────────────────────────────────────────────────── */
  both('get', '/dvpp/topics', async (c) => {
    const s = await auth(c);
    return c.json({ topics: await listTopics(sbService(), s?.id || null) });
  });

  both('post', '/dvpp/vote', async (c) => {
    const s = await needAuth(c);
    if (isResponse(s)) return s;
    const body = await readJson(c.req.raw);
    const r = await toggleVote(sbService(), s, String(body.topicId || ''));
    if (!r.ok) return c.json({ error: r.error }, r.status as 404);
    return c.json(r);
  });

  /* ── Události z prohlížeče (visit, klik na upoutávku…) ───────────────── */
  both('post', '/dvpp/events', async (c) => {
    const body = await readJson(c.req.raw);
    const event = String(body.event || '').replace(/[^a-z_]/g, '').slice(0, 40);
    if (!event) return c.json({ error: 'Chybí event.' }, 400);
    const s = await auth(c);
    await recordFunnelEvent(sbService(), {
      event, subscriberId: s?.id || null, email: s?.email || (body.email ? normEmail(body.email) : null),
      redIzo: s?.school_red_izo || null, attribution: attributionFrom(body), request: requestContext(c.req.raw),
      meta: body.meta && typeof body.meta === 'object' ? (body.meta as Record<string, unknown>) : {},
      eventId: body.eventId ? String(body.eventId) : null,
    });
    return c.json({ ok: true });
  });

  /* ── Cron ────────────────────────────────────────────────────────────── */
  both('post', '/cron/dvpp-recount', async (c) => {
    if (!deps.cronSecretOk(c)) return c.json({ error: 'Unauthorized' }, 401);
    const sb = sbService();
    const provisioned = await ensureProvisioned(sb, deps);
    const r = await recountAll(sb);
    const bf = await backfillSchoolsByDomain(sb, { limit: 300 });
    return c.json({ ok: true, ...r, backfill: bf, provisioned });
  });

  /* ── Admin ───────────────────────────────────────────────────────────── */
  both('post', '/admin/dvpp/schools/import', async (c) => {
    const sb = sbService();
    const records = await deps.loadRegistryRecords();
    const r = await importRegistry(sb, records);
    return c.json({ ok: true, ...r, total: records.length });
  });

  /** CSV s velikostí sboru: sloupce red_izo|redizo|ico, zaci|pupils, ucitele|teachers (oddělovač ; , nebo tab). */
  both('post', '/admin/dvpp/schools/import-sizes', async (c) => {
    const text = await c.req.text();
    if (!text || text.length < 10) return c.json({ error: 'Pošlete CSV v těle požadavku.' }, 400);
    return c.json({ ok: true, ...(await importSizes(sbService(), text)) });
  });

  both('post', '/admin/dvpp/schools/backfill', async (c) => {
    const body = await readJson(c.req.raw);
    return c.json({ ok: true, ...(await backfillSchoolsByDomain(sbService(), { limit: Number(body.limit) || 500 })) });
  });

  both('get', '/admin/dvpp/dashboard', async (c) => {
    const sb = sbService();
    const days = Number(c.req.query('days')) || 30;
    const [funnel, coverage, { count: withSchool }, { count: active }, { count: certs }] = await Promise.all([
      funnelSummary(sb, days),
      coverageSummary(sb),
      sb.from('subscribers').select('id', { count: 'exact', head: true }).eq('status', 'subscribed').not('school_red_izo', 'is', null),
      sb.from('subscribers').select('id', { count: 'exact', head: true }).eq('status', 'subscribed'),
      sb.from('certificates').select('id', { count: 'exact', head: true }),
    ]);
    return c.json({ days, funnel, coverage, subscribers: { active: active || 0, withSchool: withSchool || 0 }, certificates: certs || 0 });
  });

  both('get', '/admin/dvpp/staffrooms', async (c) => {
    const sb = sbService();
    const status = c.req.query('status');
    let q = sb.from('staffrooms').select('red_izo, code, status, milestone_target, confirmed_count, unlocked_by, unlocked_at, grace_until, created_at, schools!inner(name, city, teachers_count)').order('created_at', { ascending: false }).limit(500);
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return c.json({ staffrooms: data || [] });
  });

  both('post', '/admin/dvpp/staffrooms/:redIzo/unlock', async (c) => {
    const redIzo = String(c.req.param('redIzo') || '');
    const sb = sbService();
    const school = await findSchoolByRedIzo(sb, redIzo);
    if (!school) return c.json({ error: 'Škola nenalezena.' }, 404);
    const { staffroom } = await ensureStaffroom(sb, school, null, 'manual');
    await sb.from('staffrooms').update({ status: 'unlocked', unlocked_by: 'manual', unlocked_at: new Date().toISOString(), grace_until: null }).eq('red_izo', staffroom.red_izo);
    await refreshSchoolStatus(sb, redIzo);
    return c.json({ ok: true, staffroom: await getStaffroom(sb, redIzo) });
  });

  both('post', '/admin/dvpp/staffrooms/:redIzo/recount', async (c) => {
    return c.json({ ok: true, staffroom: await recountOne(sbService(), String(c.req.param('redIzo') || '')) });
  });

  /* ── Záznamy: metadata (kapitoly, upoutávka, délka, lektor) ─────────── */
  both('get', '/admin/dvpp/videos', async (c) => {
    const { topics, videos } = await deps.loadVideos();
    return c.json({ topics, videos: videos.map((v) => ({ ...v })) });
  });

  both('put', '/admin/dvpp/videos/:id', async (c) => {
    const id = String(c.req.param('id') || '');
    if (!id) return c.json({ error: 'Chybí id.' }, 400);
    const body = await readJson(c.req.raw);
    const patch: Record<string, unknown> = {};
    for (const k of VIDEO_META_FIELDS) if (k in body) patch[k] = body[k];
    if (typeof body.chaptersText === 'string') patch.chapters = parseChapters(body.chaptersText);
    if ('durationMinutes' in patch) patch.durationMinutes = Number(patch.durationMinutes) > 0 ? Math.round(Number(patch.durationMinutes)) : null;
    if (Array.isArray(patch.subjects)) patch.subjects = (patch.subjects as unknown[]).map(String).filter(Boolean);
    const data = ((await kv.get(DVPP_VIDEOS_KV_KEY)) as { topics?: unknown[]; videos?: Array<Record<string, unknown>> } | null) ?? { topics: [], videos: [] };
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const idx = videos.findIndex((v) => String(v.id) === id);
    if (idx === -1) {
      /* Záznam z minulého webináře (není v KV seznamu) — založí se ručně spravovaná položka s daty z katalogu. */
      const { videos: merged } = await deps.loadVideos();
      const base = merged.find((v) => v.id === id);
      if (!base) return c.json({ error: 'Záznam nenalezen.' }, 404);
      videos.push({ ...(base as unknown as Record<string, unknown>), ...patch, _manual: true, updatedAt: new Date().toISOString() });
    } else {
      videos[idx] = { ...videos[idx], ...patch, updatedAt: new Date().toISOString() };
    }
    await kv.set(DVPP_VIDEOS_KV_KEY, { ...data, videos, updatedAt: new Date().toISOString() });
    return c.json({ ok: true, video: videos[idx === -1 ? videos.length - 1 : idx] });
  });

  /* ── Digest „Nové v knihovně“ → draft do EmailBuilderu ────────────────── */
  both('post', '/admin/dvpp/digest/draft', async (c) => {
    const body = await readJson(c.req.raw);
    const [{ videos }, webinars] = await Promise.all([deps.loadVideos(), deps.loadWebinars()]);
    const draft = await buildDigestDraft(sbService(), {
      videos: videos as unknown as Parameters<typeof buildDigestDraft>[1]['videos'],
      webinars,
      sinceDays: Number(body.sinceDays) || 7,
    });
    const fullHtml = deps.buildEmailTemplate({ headline: draft.headline, body: draft.bodyHtml, ctaText: draft.ctaText, ctaUrl: draft.ctaUrl, preheader: draft.previewText });
    await saveDigestDraft(draft as unknown as Record<string, unknown>, fullHtml);
    return c.json({ ok: true, draftId: draft.id, subject: draft.subject, editUrl: `/mailing/emaily?draft=${encodeURIComponent(draft.id)}` });
  });

  both('get', '/admin/dvpp/series', async (c) => c.json({ series: await getSeries() }));
  both('put', '/admin/dvpp/series', async (c) => {
    const body = await readJson(c.req.raw);
    const series = Array.isArray(body.series) ? (body.series as Series[]) : [];
    await saveSeries(series.filter((s) => s && s.id && s.title));
    return c.json({ ok: true, count: series.length });
  });

  both('put', '/admin/dvpp/topics', async (c) => {
    const body = await readJson(c.req.raw);
    if (!body.id || !body.title) return c.json({ error: 'Chybí id nebo title.' }, 400);
    await upsertTopic(sbService(), body as { id: string; title: string });
    return c.json({ ok: true });
  });

  both('get', '/admin/dvpp/schools', async (c) => {
    const sb = sbService();
    const status = c.req.query('status');
    const q = (c.req.query('q') || '').trim();
    let query = sb.from('schools').select('red_izo, ico, name, city, region, type, is_primary, teachers_count, teachers_estimated, status, status_reason, domain, director_name, email').eq('is_primary', true).order('teachers_count', { ascending: false, nullsFirst: false }).limit(300);
    if (status) query = query.eq('status', status);
    if (q) query = query.or(`name.ilike.%${q.replace(/[%,]/g, '')}%,city.ilike.%${q.replace(/[%,]/g, '')}%`);
    const { data } = await query;
    return c.json({ schools: data || [] });
  });

  both('put', '/admin/dvpp/schools/:redIzo', async (c) => {
    const body = await readJson(c.req.raw);
    const patch: Record<string, unknown> = {};
    for (const k of ['status_reason', 'status_note', 'teachers_count', 'domain', 'email', 'director_name'] as const) {
      if (k in body) patch[k] = body[k];
    }
    if ('teachers_count' in patch) patch.teachers_estimated = false;
    const { error } = await sbService().from('schools').update(patch).eq('red_izo', String(c.req.param('redIzo') || ''));
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  });
}
