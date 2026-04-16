import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import * as kv from './kv_store.tsx';
import { createClient } from 'npm:@supabase/supabase-js@2';
import md5 from 'npm:md5';
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { upsertSiteIncident } from '../../../../supabase/functions/_shared/site-incidents.ts';
import {
  normalizeEmail,
  isValidEmailFormat,
  EMAIL_FORMAT_HINT_CS,
  EMAIL_MX_REJECT_CS,
} from '../../../utils/emailValidation.ts';
import { domainAcceptsMailForForms } from '../../../../supabase/functions/_shared/email-mx.ts';

const app = new Hono();

async function assertEmailDeliverable(emailRaw: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const e = normalizeEmail(emailRaw);
  if (!isValidEmailFormat(e)) {
    return { ok: false, message: EMAIL_FORMAT_HINT_CS };
  }
  const dom = e.split('@')[1];
  if (!dom) return { ok: false, message: EMAIL_FORMAT_HINT_CS };
  const mxOk = await domainAcceptsMailForForms(dom);
  if (!mxOk) return { ok: false, message: EMAIL_MX_REJECT_CS };
  return { ok: true };
}
const KV_KEY = 'vividbooks_master_products_v1';
const OFFERS_KEY = 'vividbooks_special_offers_v1';
const BUNDLES_KEY = 'vividbooks_product_bundles_v1';
const BLOG_KEY = 'vividbooks_blog_posts_v3'; // force-redeploy v3 trigger
const NOVINKY_KEY = 'vividbooks_novinky_posts_v1';
const WEBINARS_KEY = 'vividbooks_webinars_v1';
const FIXED_PAGES_KEY = 'vividbooks_fixed_pages_v1';
const HERO_SLIDES_KEY = 'vividbooks_hero_slides_v1';
const SUBJECT_PAGES_KEY = 'vividbooks_subject_pages_v1';
const NOTIFICATIONS_KEY = 'vividbooks_notifications_v1';
const TABS_KEY = 'vividbooks_tabs_v1';
const NEWSLETTER_KEY = 'vividbooks_newsletter_subscribers_v1';
const POPUPS_KEY = 'vividbooks_popups_v1';
const DVPP_VIDEOS_KEY = 'vividbooks_dvpp_videos_v2';
const DVPP_VIDEOS_COLLECTION_ID = '66b119eaa0271061207bdd18';
const DVPP_TOPICS_COLLECTION_ID = '67c5e17f4844f5f538279158';
const GROWTH_CHAT_INDEX_KEY = 'growth-agent:chats:index';
const GROWTH_CREATIVE_PREFIX = 'growth:creative:';
const GROWTH_CAMPAIGNS_KEY = 'growth:campaigns';
const GROWTH_INSIGHTS_KEY = 'growth:insights';
/** Storage pro admin uploady obrázků (sdílený bucket). */
const UPLOAD_BUCKET = 'make-93a20b6f-uploads';

/**
 * Meta + CSS pro čitelnost v dark mode na mobilu (iOS Mail, Apple Mail, část Android/Gmail).
 * Třídy dm-* přepisují inline barvy v @media (prefers-color-scheme: dark).
 */
const WEBINAR_EMAIL_DARK_HEAD = `<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting" content="">
<style type="text/css">
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  .dm-body, .dm-wrap { background-color: #0c0c0f !important; }
  .dm-card { background-color: #16161c !important; box-shadow: 0 4px 24px rgba(0,0,0,0.45) !important; }
  .dm-header { background-color: #050a18 !important; }
  .dm-content { background-color: #16161c !important; }
  .dm-h1 { color: #e8e8ed !important; }
  .dm-text { color: #c5c5d0 !important; }
  .dm-text .dm-strong, strong.dm-strong, .dm-strong { color: #93c5fd !important; }
  .dm-inner { border-color: #3d3d48 !important; }
  .dm-box-top { background-color: #1a1a22 !important; }
  .dm-box-pad { background-color: #1a1a22 !important; }
  .dm-label { color: #9898a8 !important; }
  .dm-title-lg { color: #e8e8ed !important; }
  .dm-muted { color: #a8a8b8 !important; }
  .dm-cta-navy { background-color: #2d4a6f !important; }
  a.dm-btn { background-color: #eef2ff !important; color: #172554 !important; }
  .dm-footer { background-color: #121218 !important; border-top-color: #2a2a32 !important; }
  .dm-footer-text { color: #888898 !important; }
  .dm-cal a, a.dm-cal-link { background-color: #2a2a32 !important; color: #e8e8ed !important; border: 1px solid #3d3d48 !important; }
  .dm-ics-note { color: #a0a0b0 !important; }
  .dm-cal-heading { color: rgba(200,200,220,0.55) !important; }
  .dm-rem-body, .dm-rem-wrap { background-color: #0c0c0f !important; }
  .dm-rem-card { background-color: #16161c !important; }
  .dm-rem-content { background-color: #16161c !important; }
  .dm-rem-muted { color: #a8a8b8 !important; }
  .dm-rem-link { color: #9ca3af !important; }
  a.dm-rem-btn { background-color: #001161 !important; color: #ffffff !important; }
  .dm-survey-box { background-color: #1a1a22 !important; border-color: #3d3d48 !important; }
  .dm-survey-box p { color: #c5c5d0 !important; }
  .dm-survey-box a { border-color: #93c5fd !important; color: #93c5fd !important; background-color: #16161c !important; }
  strong.dm-accent, .dm-text strong.dm-accent { color: #fdba74 !important; }
}
</style>`;

/** Předmět transakčních Mandrill mailů o webinářích — rychlá orientace v inboxu. */
const WEBINAR_EMAIL_SUBJECT_PREFIX = '🔴 ';

/**
 * Veřejná báze URL webu (odkazy v e-mailech a JSON po /webinar-registrace, připomínky).
 * Pro ostrý web na vlastní doméně: Supabase → Edge Functions → Secrets např.
 * PUBLIC_SITE_URL=https://www.vividbooks.com
 * Bez PUBLIC_SITE_URL: výchozí je GitHub Pages (stejný `base` jako ve vite.config.ts u GITHUB_ACTIONS).
 * Pro lokální test e-mailů: PUBLIC_SITE_URL=http://localhost:3000
 */
const DEFAULT_PUBLIC_SITE_ORIGIN_GITHUB_PAGES = 'https://vividbooks.github.io/VIVIDBOOKS_WEB_ESHOP';

function normalizePublicSiteOrigin(raw: string): string {
  let s = raw.replace(/\/$/, '');
  try {
    const url = new URL(s);
    if (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.port === '5173'
    ) {
      url.port = '3000';
      return url.origin;
    }
  } catch {
    /* ignore */
  }
  return s;
}

function getPublicSiteOrigin(): string {
  const u = Deno.env.get('PUBLIC_SITE_URL')?.trim();
  if (u) return normalizePublicSiteOrigin(u);
  return normalizePublicSiteOrigin(DEFAULT_PUBLIC_SITE_ORIGIN_GITHUB_PAGES);
}

app.use('*', cors());
app.use('*', logger(console.log));

/* ── Diagnostický endpoint — raw Webflow JSON ─────────────────── */
app.get('/make-server-93a20b6f/debug-webflow/:collectionId', async (c) => {
  const token = Deno.env.get('WEBFLOW_API_TOKEN');
  const collectionId = c.req.param('collectionId');
  if (!token) return c.json({ error: 'WEBFLOW_API_TOKEN not set' }, 500);

  // V2
  const v2Url = `https://api.webflow.com/v2/collections/${collectionId}/items`;
  console.log(`[debug-webflow] GET ${v2Url}`);
  try {
    const res = await fetch(v2Url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      }
    });
    const raw = await res.text();
    console.log(`[debug-webflow] V2 status=${res.status}, len=${raw.length}`);
    if (res.ok) {
      try {
        const parsed = JSON.parse(raw);
        return c.json({ api: 'v2', status: res.status, itemCount: parsed.items?.length, data: parsed });
      } catch {
        return c.json({ api: 'v2', status: res.status, raw: raw.slice(0, 5000) });
      }
    }
    // V2 failed, try V1
    const v1Url = `https://api.webflow.com/collections/${collectionId}/items`;
    console.log(`[debug-webflow] V2 failed (${res.status}), trying V1: ${v1Url}`);
    const resV1 = await fetch(v1Url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Accept-Version': '1.0.0',
      }
    });
    const rawV1 = await resV1.text();
    console.log(`[debug-webflow] V1 status=${resV1.status}, len=${rawV1.length}`);
    try {
      const parsed = JSON.parse(rawV1);
      const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
      return c.json({ api: 'v1', status: resV1.status, itemCount: items.length, data: parsed });
    } catch {
      return c.json({ api: 'v1', status: resV1.status, raw: rawV1.slice(0, 5000) });
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

async function getAllProducts() {
  const data = await kv.get(KV_KEY);
  return data?.products || [];
}

async function saveAllProducts(products: any[]) {
  const data = {
    products,
    updatedAt: new Date().toISOString()
  };
  await kv.set(KV_KEY, data);
  return data;
}

async function fetchFromWebflow(collectionId: string, token: string) {
  console.log(`[Webflow] Pokus o načtení kolekce: ${collectionId}`);
  
  // 1. Zkusíme V2 (Moderní API)
  const v2Url = `https://api.webflow.com/v2/collections/${collectionId}/items`;
  try {
    const resV2 = await fetch(v2Url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'VividbooksMigrationTool/1.0'
      }
    });

    if (resV2.ok) {
      const data = await resV2.json();
      console.log(`[Webflow] V2 OK: ${data.items?.length} položek`);
      return data.items || [];
    } else {
      const errText = await resV2.text();
      console.warn(`[Webflow] V2 selhalo (${resV2.status}): ${errText}`);
      
      const v1Url = `https://api.webflow.com/collections/${collectionId}/items`;
      console.log(`[Webflow] Zkouším V1 fallback pro: ${collectionId}`);
      
      const resV1 = await fetch(v1Url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Accept-Version': '1.0.0',
          'User-Agent': 'VividbooksMigrationTool/1.0'
        }
      });

      if (resV1.ok) {
        const data = await resV1.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        console.log(`[Webflow] V1 OK: ${items.length} položek`);
        return items;
      } else {
        const errTextV1 = await resV1.text();
        throw new Error(`Webflow API Error. V2: ${resV2.status} (${errText}), V1: ${resV1.status} (${errTextV1})`);
      }
    }
  } catch (e) {
    throw e;
  }
}

app.post('/make-server-93a20b6f/import-webflow', async (c) => {
  const token = Deno.env.get('WEBFLOW_API_TOKEN');
  
  // Parse body with extensive logging
  let body: any = {};
  try {
    body = await c.req.json();
    console.log(`[import-webflow] Received body keys: ${Object.keys(body).join(', ')}`);
    console.log(`[import-webflow] mode="${body.mode}", digitalId="${body.digitalId}", printId="${body.printId}", blogId="${body.blogId}"`);
  } catch (parseErr) {
    console.log(`[import-webflow] JSON parse error: ${parseErr}`);
    body = {};
  }
  
  const { digitalId, printId, blogId, mode } = body;

  if (!token) return c.json({ error: 'Chybí WEBFLOW_API_TOKEN v environment variables.' }, 500);

  // ── Blog preview mode ───────────────────────────────────────��─
  if (mode === 'preview-blog') {
    console.log(`[import-webflow] Entering preview-blog mode`);
    const collId = blogId || '651f03e0bca47206a22d436d';
    try {
      const items = await fetchFromWebflow(collId, token);
      const preview = items.slice(0, 3).map((i: any) => ({ id: i.id || i._id, fieldData: i.fieldData || i }));
      return c.json({ success: true, count: items.length, preview });
    } catch (e: any) {
      return c.json({ error: `Blog preview selhal: ${e.message}` }, 500);
    }
  }

  // ── Blog import mode ──────────────────────────────────────────
  if (mode === 'import-blog') {
    console.log(`[import-webflow] Entering import-blog mode`);
    const collId = blogId || '651f03e0bca47206a22d436d';
    try {
      const items = await fetchFromWebflow(collId, token);
      console.log(`[Blog] Staženo ${items.length} položek.`);
      const mapped = items.map((i: any) => {
        const f = i.fieldData || i;
        const rawDate = pickField(f, ['datum', 'date', 'datum-vydani', 'published-on', 'publishedOn']);
        let dateFormatted = rawDate;
        if (rawDate && !isNaN(Date.parse(rawDate))) {
          dateFormatted = new Date(rawDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        const contentHtml = pickField(f, ['obsah', 'content', 'post-body', 'clanek', 'body', 'blog-content', 'full-text']);
        const contentBlocks = contentHtml ? parseContentBlocks(contentHtml) : [];
        const excerpt = pickField(f, ['perex', 'excerpt', 'popis', 'uvodni-text', 'uvod', 'kratky-popis', 'summary'])
          || (contentBlocks.find((b: any) => b.type === 'paragraph')?.text || '').slice(0, 300);
        const readTimeRaw = f['doba-cteni'] || f['read-time'] || f['readTime'];
        const wordCount = stripHtml(contentHtml).split(/\s+/).length;
        const readTime = readTimeRaw ? (parseInt(String(readTimeRaw)) || 5) : Math.max(3, Math.ceil(wordCount / 200));
        return {
          id: i.id || i._id,
          slug: f.slug || f['url-slug'] || (i.id || i._id),
          title: pickField(f, ['name', 'nazev', 'titulek', 'title']),
          excerpt,
          author: pickField(f, ['autor', 'author', 'jmeno-autora', 'redaktor']),
          date: dateFormatted || '',
          readTime,
          category: pickField(f, ['kategorie', 'category', 'tag', 'tema', 'oblast']),
          coverImage: pickImage(f),
          content: contentBlocks,
          contentHtml,
          metadata: f,
          importedAt: new Date().toISOString(),
        };
      }).filter((p: any) => p.title);
      await saveCollection(BLOG_KEY, mapped);
      console.log(`[Blog] Uloženo ${mapped.length} příspěvků.`);
      return c.json({ success: true, count: mapped.length, sample: mapped.slice(0, 2).map((p: any) => ({ title: p.title, slug: p.slug, author: p.author, category: p.category, hasImage: !!p.coverImage })) });
    } catch (e: any) {
      console.log(`[Blog] Chyba: ${e.message}`);
      return c.json({ error: 'Import blogu selhal', details: e.message }, 500);
    }
  }

  // ── Novinky preview mode ───────────────────────────────────────
  if (mode === 'preview-novinky') {
    console.log(`[import-webflow] Entering preview-novinky mode`);
    const collId = body.novinkyId || '67c5f807aba1fc4614283bfe';
    try {
      const items = await fetchFromWebflow(collId, token);
      const preview = items.slice(0, 3).map((i: any) => ({ id: i.id || i._id, fieldData: i.fieldData || i }));
      return c.json({ success: true, count: items.length, preview });
    } catch (e: any) {
      return c.json({ error: `Novinky preview selhal: ${e.message}` }, 500);
    }
  }

  // ── Novinky import mode ────────────────────────────────────────
  if (mode === 'import-novinky') {
    console.log(`[import-webflow] Entering import-novinky mode`);
    const collId = body.novinkyId || '67c5f807aba1fc4614283bfe';
    try {
      const items = await fetchFromWebflow(collId, token);
      console.log(`[Novinky] Stazeno ${items.length} polozek.`);
      const mapped = items.map((i: any) => {
        const f = i.fieldData || i;
        const rawDate = pickField(f, ['datum', 'date', 'datum-vydani', 'published-on', 'publishedOn', 'created-on']);
        let dateFormatted = rawDate;
        if (rawDate && !isNaN(Date.parse(rawDate))) {
          dateFormatted = new Date(rawDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        const contentHtml = pickField(f, ['obsah', 'content', 'post-body', 'clanek', 'body', 'text', 'full-text']);
        const contentBlocks = contentHtml ? parseContentBlocks(contentHtml) : [];
        const excerpt = pickField(f, ['perex', 'excerpt', 'popis', 'uvodni-text', 'uvod', 'kratky-popis', 'summary'])
          || (contentBlocks.find((b: any) => b.type === 'paragraph')?.text || '').slice(0, 300);
        return {
          id: i.id || i._id,
          slug: f.slug || f['url-slug'] || (i.id || i._id),
          title: pickField(f, ['name', 'nazev', 'titulek', 'title']),
          excerpt,
          author: pickField(f, ['autor', 'author', 'jmeno-autora', 'redaktor']),
          date: dateFormatted || '',
          category: pickField(f, ['kategorie', 'category', 'tag', 'tema', 'oblast']),
          coverImage: pickImage(f),
          content: contentBlocks,
          contentHtml,
          published: true,
          metadata: f,
          importedAt: new Date().toISOString(),
        };
      }).filter((p: any) => p.title);
      await saveCollection(NOVINKY_KEY, mapped);
      console.log(`[Novinky] Ulozeno ${mapped.length} novinek.`);
      return c.json({ success: true, count: mapped.length, sample: mapped.slice(0, 3).map((p: any) => ({ title: p.title, slug: p.slug, date: p.date, hasImage: !!p.coverImage })) });
    } catch (e: any) {
      console.log(`[Novinky] Chyba: ${e.message}`);
      return c.json({ error: 'Import novinek selhal', details: e.message }, 500);
    }
  }

  // ─�� Webinář preview mode ─────��─────────────────────────────────
  if (mode === 'preview-webinare') {
    console.log(`[import-webflow] Entering preview-webinare mode`);
    const collId = body.webinarId || '64135780db7f1bdff5727631';
    try {
      const items = await fetchFromWebflow(collId, token);
      const preview = items.slice(0, 3).map((i: any) => ({ id: i.id || i._id, fieldData: i.fieldData || i }));
      return c.json({ success: true, count: items.length, preview });
    } catch (e: any) {
      return c.json({ error: `Webinář preview selhal: ${e.message}` }, 500);
    }
  }

  // ── Webinář import mode ────────────────────────────────────────
  if (mode === 'import-webinare') {
    console.log(`[import-webflow] Entering import-webinare mode`);
    const collId = body.webinarId || '64135780db7f1bdff5727631';
    const MONTHS_CS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
    const now = new Date();
    try {
      const items = await fetchFromWebflow(collId, token);
      console.log(`[Webinář] Staženo ${items.length} položek z Webflow.`);
      const mapped = items.map((i: any, idx: number) => {
        const f = i.fieldData || i;

        // Datum — `date-time-test` je ISO datetime, `date` je text "20. 5. 2026 od 18.00"
        const isoDateRaw: string = f['date-time-test'] || '';
        let day = 1, monthNum = 1, year = now.getFullYear(), monthName = 'Leden';
        let isPast = false;
        if (isoDateRaw && !isNaN(Date.parse(isoDateRaw))) {
          const d = new Date(isoDateRaw);
          day       = d.getUTCDate();
          monthNum  = d.getUTCMonth() + 1;
          year      = d.getUTCFullYear();
          monthName = MONTHS_CS[d.getUTCMonth()];
          isPast    = d < now;
        } else {
          // Fallback: parse z "20. 5. 2026 od 18.00"
          const dateText: string = f['date'] || '';
          const m = dateText.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
          if (m) {
            day       = parseInt(m[1]);
            monthNum  = parseInt(m[2]);
            year      = parseInt(m[3]);
            monthName = MONTHS_CS[monthNum - 1] || 'Leden';
            isPast    = new Date(year, monthNum - 1, day) < now;
          }
        }

        // Čas — parsuj "od 18.00" z textového pole date
        let time = '18:00';
        const dateText: string = f['date'] || '';
        const timeMatch = dateText.match(/od\s+(\d{1,2})[.:](\d{2})/i);
        if (timeMatch) {
          time = `${timeMatch[1]}:${timeMatch[2]}`;
        } else if (isoDateRaw && !isNaN(Date.parse(isoDateRaw))) {
          const d = new Date(isoDateRaw);
          const h = (d.getUTCHours() + 2) % 24;
          time = `${String(h).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
        }

        // Obrázek — cover-image.url > opengraph-image.url
        const coverImage: string = f['cover-image']?.url || f['opengraph-image']?.url || '';

        return {
          id:             i.id || i._id,
          slug:           f.slug || (i.id || i._id),
          title:          f['name'] || '',
          subtitle:       f['subtitle'] || f['podtitulek'] || '',
          day, monthName, monthNum, year, time,
          lecturer:       f['lecturers'] || f['lektor'] || '',
          lecturerAvatar: coverImage,
          coverImage,
          description:    f['popis'] || f['description'] || f['obsah'] || '',
          perks:          f['vyhody'] || f['perks'] || '',
          targetAudience: f['label'] || f['cilova-skupina'] || '',
          zoomLink:       f['link-zoom-link'] || '',
          thumbnailVariant: ((idx % 3) + 1) as 1 | 2 | 3,
          isPast,
          importedAt: new Date().toISOString(),
        };
      }).filter((w: any) => w.title);

      await saveCollection(WEBINARS_KEY, mapped);
      console.log(`[Webinář] Uloženo ${mapped.length} webinářů do Supabase.`);
      return c.json({
        success: true,
        count: mapped.length,
        sample: mapped.slice(0, 5).map((w: any) => ({
          title: w.title, day: w.day, monthName: w.monthName, year: w.year,
          time: w.time, lecturer: w.lecturer, isPast: w.isPast,
          targetAudience: w.targetAudience, zoomLink: w.zoomLink,
        })),
      });
    } catch (e: any) {
      console.log(`[Webinář] Chyba: ${e.message}`);
      return c.json({ error: 'Import webinářů selhal', details: e.message }, 500);
    }
  }

  // ── Taby preview mode ──────────────────────────────────────────
  if (mode === 'preview-tabs') {
    const collId = body.tabsId || '67efdf2e531b09c85dc3132e';
    try {
      const items = await fetchFromWebflow(collId, token);
      const preview = items.slice(0, 3).map((i: any) => ({ id: i.id || i._id, fieldData: i.fieldData || i }));
      return c.json({ success: true, count: items.length, preview });
    } catch (e: any) {
      return c.json({ error: `Taby preview selhal: ${e.message}` }, 500);
    }
  }

  // ── Taby import mode ───────────────────────────────────────────
  if (mode === 'import-tabs') {
    const collId = body.tabsId || '67efdf2e531b09c85dc3132e';
    const fieldMapping: Record<string,string> = body.fieldMapping || {};
    const forceSubject: string | undefined = body.forceSubject;
    try {
      const [items, predmety] = await Promise.all([
        fetchFromWebflow(collId, token),
        getCollection(SUBJECT_PAGES_KEY),
      ]);
      console.log(`[Tabs] Staženo ${items.length} tabů, ${predmety.length} předmětů v Supabase.`);

      const pickF = (f: any, keys: string[]) => { for (const k of keys) { if (f[k] !== undefined && f[k] !== null && f[k] !== '') return f[k]; } return ''; };

      // Extrahuje URL z Webflow image objektu {url, alt} nebo string
      const extractImg = (f: any): string => {
        for (const k of ['content-image', 'contentImage', 'image', 'obrazek', 'foto', 'thumbnail']) {
          const v = f[k]; if (!v) continue;
          if (v?.url && typeof v.url === 'string' && v.url.startsWith('http')) return v.url;
          if (typeof v === 'string' && v.startsWith('http')) return v;
        }
        for (const k of Object.keys(f)) {
          const v = f[k];
          if (typeof v === 'object' && v !== null && typeof v.url === 'string' && v.url.startsWith('http')) return v.url;
        }
        return '';
      };

      // Stripuje HTML tagy; <p> → newline; zachová emoji
      const stripHtml = (html: string): string => {
        if (!html || typeof html !== 'string') return '';
        return html
          .replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
          .replace(/\n{3,}/g, '\n\n').trim();
      };

      // Převede Webflow hsla(...) na #hex
      const normalizeColor = (val: any): string => {
        if (!val || typeof val !== 'string') return '';
        if (val.startsWith('#')) return val;
        const m = val.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*(?:,\s*[\d.]+)?\s*\)/i);
        if (m) {
          const h = parseFloat(m[1]) / 360, s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
          const h2r = (p: number, q: number, t: number) => { if (t<0) t+=1; if (t>1) t-=1; if (t<1/6) return p+(q-p)*6*t; if (t<1/2) return q; if (t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
          let r, g, b;
          if (s===0) { r=g=b=l; } else { const q2=l<0.5?l*(1+s):l+s-l*s, p2=2*l-q2; r=h2r(p2,q2,h+1/3); g=h2r(p2,q2,h); b=h2r(p2,q2,h-1/3); }
          const toH = (x: number) => Math.round(x*255).toString(16).padStart(2,'0');
          return `#${toH(r)}${toH(g)}${toH(b)}`;
        }
        return val;
      };

      // Hardcodovaná mapa: Webflow subpage Item ID → displayName předmětu v Supabase
      const WEBFLOW_SUBJECT_MAP: Record<string, string> = {
        '696fd3332356a1d9966c7764': 'Český jazyk',
        '68d5050a161002e62a666471': 'Chemie',
        '68d504f2dcf1ba67a9d76351': 'Přírodopis',
        '68d504b9f498f987d3ec5efc': 'Fyzika',
        '67efe04de5cf32249da1d70e': 'Prvouka',
        '67efe02bdb2baaefbc57c409': 'Matematika 2',
        '67efe003222ba83e9b706e96': 'Matematika-1',
      };

      // Přeloží Webflow reference ID → displayName (hardcodovaná mapa má prioritu)
      const resolveSubject = (wfRefId: string): string => {
        if (!wfRefId || typeof wfRefId !== 'string') return '';
        // 1) Hardcodovaná mapa — spolehlivá, nezávislá na Supabase datech
        if (WEBFLOW_SUBJECT_MAP[wfRefId]) return WEBFLOW_SUBJECT_MAP[wfRefId];
        // 2) Fallback: hledej v Supabase predmety dle webflowId / metadata._id
        const m = predmety.find((p: any) =>
          p.id === wfRefId || p.webflowId === wfRefId ||
          p.metadata?.id === wfRefId || p.metadata?._id === wfRefId
        );
        return m ? (m.displayName || m.name || '') : '';
      };

      const mapped = items.map((i: any, idx: number) => {
        const f = i.fieldData || i;
        const get = (ourKey: string, defaults: string[]) => {
          const wfKey = Object.entries(fieldMapping).find(([,v]) => v === ourKey)?.[0];
          if (wfKey) return f[wfKey] ?? '';
          return pickF(f, defaults);
        };
        // 1) Přímé subject pole
        const rawSubject = get('subject', ['subject', 'predmet', 'kategorie', 'category']);
        // 2) Subpage reference (v Webflow Tabs je předmět uložen ve 'subpage' jako ref ID)
        const rawSubpage = pickF(f, ['subpage', 'podstranka']);
        // 3) Rozlišení ref ID → displayName
        let resolvedSubject: string = forceSubject
          || resolveSubject(rawSubject)
          || resolveSubject(rawSubpage)
          || '';
        // 4) Fallback: parse z name — "PředmětNázev – Tab Text"
        if (!resolvedSubject) {
          const rawName = String(pickF(f, ['name', 'title', 'nazev']) || '');
          if (rawName) {
            const parts = rawName.split(/\s*[–\-\/]\s*/);
            if (parts.length > 1) {
              const candidate = parts[0].trim();
              const matchedP = predmety.find((p: any) =>
                (p.displayName || '').trim().toLowerCase() === candidate.toLowerCase() ||
                (p.name || '').trim().toLowerCase() === candidate.toLowerCase()
              );
              resolvedSubject = matchedP ? (matchedP.displayName || matchedP.name) : candidate;
            }
          }
        }
        console.log(`[Tab ${idx}] name="${pickF(f,['name'])}" subj="${rawSubject}" subpage="${rawSubpage}" → "${resolvedSubject}"`);
        return {
          id: `tab-wf-${i.id || i._id || idx}`,
          tabText: get('tabText', ['tab-text', 'tab', 'label', 'nazev', 'name', 'title']),
          contentHeadline: get('contentHeadline', ['content-headline', 'headline', 'nadpis', 'heading']),
          contentRichText: stripHtml(String(get('contentRichText', ['content-rich-text', 'rich-text', 'obsah', 'content', 'body', 'popis']) || '')),
          contentImage: extractImg(f),
          subject: resolvedSubject,
          subpage: typeof rawSubpage === 'string' && rawSubpage.length < 40 ? rawSubpage : '',
          order: Number(get('order', ['order', 'poradi', 'sort'])) || idx + 1,
          bgColor: normalizeColor(get('bgColor', ['bg-color', 'background-color', 'barva', 'color'])),
          metadata: f,
          importedAt: new Date().toISOString(),
        };
      });
      const existing = await getCollection(TABS_KEY);
      const existingById = new Map(existing.map((t: any) => [t.id, t]));
      for (const tab of mapped) { existingById.set(tab.id, tab); }
      const merged = Array.from(existingById.values());
      await saveCollection(TABS_KEY, merged);
      console.log(`[Tabs] Uloženo ${mapped.length} tabů (celkem ${merged.length} v DB).`);

      // RAG embedding for imported tabs
      let ragCount = 0;
      try {
        const ak = Deno.env.get('GEMINI_API_KEY_RAG');
        if (ak) {
          for (const tab of mapped) {
            const tabText = [tab.subject, tab.tabText, tab.contentHeadline, tab.contentRichText].filter(Boolean).join('\n');
            if (tabText.trim()) {
              try {
                const emb = await embedText(tabText);
                await saveChunk({
                  id: `tab_${tab.id}`,
                  text: tabText,
                  embedding: emb,
                  embeddingDims: emb.length,
                  metadata: {
                    source: 'tab',
                    sourceId: tab.id,
                    subject: tab.subject || '',
                    title: tab.contentHeadline || tab.tabText || 'Tab',
                    chunkIndex: 0,
                    totalChunks: 1,
                    uploadedAt: new Date().toISOString(),
                    tokens: Math.round(tabText.length / 4),
                    quality: qualityScore(tabText),
                  },
                });
                ragCount++;
              } catch (embErr: any) {
                console.log(`[Tabs RAG] Chyba embedu tab ${tab.id}: ${embErr.message}`);
              }
            }
          }
          console.log(`[Tabs RAG] Embeddováno ${ragCount}/${mapped.length} tabů.`);
        }
      } catch (ragErr: any) {
        console.log(`[Tabs RAG batch error] ${ragErr.message}`);
      }

      return c.json({ success: true, count: mapped.length, total: merged.length, ragEmbedded: ragCount, sample: mapped.slice(0, 3).map((t: any) => ({ tabText: t.tabText, contentHeadline: t.contentHeadline, subject: t.subject, order: t.order })) });
    } catch (e: any) {
      console.log(`[Tabs] Chyba: ${e.message}`);
      return c.json({ error: 'Import tabů selhal', details: e.message }, 500);
    }
  }

  // ── Generický JSON import ──────────────────────────────────────
  if (mode === 'import-json') {
    const { collection: targetCollection, items: jsonItems, fieldMapping: fm, appendMode } = body;
    if (!targetCollection || !Array.isArray(jsonItems)) {
      return c.json({ error: 'Chybí collection nebo items[]' }, 400);
    }
    const keyMap: Record<string,string> = {
      'blog': BLOG_KEY, 'novinky': NOVINKY_KEY, 'webinare': WEBINAR_KEY,
      'predmety': SUBJECT_PAGES_KEY, 'notifikace': NOTIFICATIONS_KEY, 'tabs': TABS_KEY,
    };
    const dbKey = keyMap[targetCollection];
    if (!dbKey) return c.json({ error: `Neznámá kolekce: ${targetCollection}` }, 400);
    try {
      const mapping: Record<string,string> = fm || {};
      const mapped = jsonItems.map((item: any, idx: number) => {
        const out: any = { id: item.id || `import-${Date.now()}-${idx}` };
        if (Object.keys(mapping).length > 0) {
          for (const [src, tgt] of Object.entries(mapping)) { if (src in item) out[tgt as string] = item[src]; }
          for (const k of Object.keys(item)) { if (!mapping[k] && !(k in out)) out[k] = item[k]; }
        } else {
          Object.assign(out, item);
        }
        out.importedAt = new Date().toISOString();
        return out;
      });
      if (appendMode) {
        const existing = await getCollection(dbKey);
        const existingById = new Map(existing.map((t: any) => [t.id, t]));
        for (const item of mapped) { existingById.set(item.id, item); }
        const final = Array.from(existingById.values());
        await saveCollection(dbKey, final);
        return c.json({ success: true, count: mapped.length, total: final.length, sample: mapped.slice(0, 3) });
      } else {
        await saveCollection(dbKey, mapped);
        return c.json({ success: true, count: mapped.length, total: mapped.length, sample: mapped.slice(0, 3) });
      }
    } catch (e: any) {
      console.log(`[JSON import] Chyba: ${e.message}`);
      return c.json({ error: `JSON import selhal: ${e.message}` }, 500);
    }
  }

  // ── Products import (původní logika) ─────────────────────────
  if (!digitalId || !printId) {
    console.log(`[import-webflow] No mode matched and missing IDs. mode="${mode}", digitalId="${digitalId}", printId="${printId}"`);
    return c.json({ error: `Chybí ID kolekcí (digitalId, printId). Přijatý mode="${mode || 'none'}"` }, 400);
  }

  try {
    const results = await Promise.allSettled([
      fetchFromWebflow(digitalId, token),
      fetchFromWebflow(printId, token)
    ]);

    const digiItems = results[0].status === 'fulfilled' ? results[0].value : [];
    const printItems = results[1].status === 'fulfilled' ? results[1].value : [];

    const findImage = (fields: any) => {
      const priority = ['nahledovy-obrazek', 'obalka', 'obrazek', 'nahled', 'image', 'thumbnail', 'main-image', 'cover-image', 'foto'];
      for (const p of priority) {
        const val = fields[p];
        if (val?.url) return val.url;
        if (typeof val === 'string' && val.startsWith('http')) return val;
      }
      for (const key in fields) {
        const val = fields[key];
        const url = val?.url || (typeof val === 'string' ? val : '');
        if (typeof url === 'string' && (url.includes('.png') || url.includes('.jpg') || url.includes('.webp') || url.includes('.jpeg'))) {
          return url;
        }
      }
      return '';
    };

    const cleanCategory = (item: any, isPrint: boolean) => {
      const f = item.fieldData || item;
      const name = f.name || '';
      const slug = f.slug || '';
      const lowerName = name.toLowerCase();
      const lowerSlug = slug.toLowerCase();
      
      const subjects = [
        { key: 'matematik', label: 'Matematika' },
        { key: 'fyzik', label: 'Fyzika' },
        { key: 'chemi', label: 'Chemie' },
        { key: 'přírodop', label: 'Přírodopis' },
        { key: 'česk', label: 'Český jazyk' },
        { key: 'písank', label: 'Česk jazyk' },
        { key: 'čárank', label: 'Český jazyk' },
        { key: 'čáry máry', label: 'Český jazyk' },
        { key: 'grafomotor', label: 'Český jazyk' },
        { key: 'prvouk', label: 'Prvouka' },
        { key: 'anglič', label: 'Angličtina' },
        { key: 'zeměp', label: 'Zeměpis' },
        { key: 'dějep', label: 'Dějepis' },
      ];

      // 1. Speciální pravidlo pro "Krok za krokem"
      if (lowerName.includes('krok za krokem')) {
        return isPrint ? 'Matematika 2. stupeň' : 'Matematika';
      }

      // 2. Hledání v názvu a slugu
      for (const s of subjects) {
        if (lowerName.includes(s.key) || lowerSlug.includes(s.key)) {
          if (s.label === 'Matematika' && isPrint) {
            return (lowerName.includes('6') || lowerName.includes('7') || lowerName.includes('8') || lowerName.includes('9')) 
              ? 'Matematika 2. stupeň' 
              : 'Matematika 1. stupeň';
          }
          return (isPrint && s.label === 'Matematika') ? 'Matematika 1. stupeň' : s.label;
        }
      }

      // 3. Prohledání VŠECH polí v itemu na výskyt klíčových slov
      // Tohle pomůže, pokud je předmět v nějakém skrytém poli nebo referenci
      for (const key in f) {
        const val = f[key];
        const str = (typeof val === 'object' ? JSON.stringify(val) : String(val || '')).toLowerCase();
        for (const s of subjects) {
          if (str.includes(s.key)) {
            if (s.label === 'Matematika' && isPrint) {
              return (lowerName.includes('6') || lowerName.includes('7') || lowerName.includes('8') || lowerName.includes('9')) 
                ? 'Matematika 2. stupeň' 
                : 'Matematika 1. stupeň';
            }
            return s.label;
          }
        }
      }

      return 'Ostatní';
    };

    const processed = [
      ...digiItems.map((i: any) => {
        const f = i.fieldData || i;
        const name = f.name || 'Bez názvu';
        return {
          id: i.id || i._id,
          name: name,
          category: cleanCategory(i, false),
          type: 'online',
          price: f['cena-mesicni'] ? `${f['cena-mesicni']},-` : 'Zdarma',
          priceAmount: f['cena-mesicni'] || 0,
          image: findImage(f),
          description: f['popis'] || '',
          note: f['poznamka'] || f['poznámka'] || f['akce'] || f['note'] || '',
          poznamka: f['poznamka'] || f['poznámka'] || f['akce'] || f['note'] || '',
          backgroundColor: '#FFF4C8',
          buttonType: 'subscribe',
          previewLink: f['ukazka-link'] || f['ukázka-link'] || f['link-na-prolistovani'] || f['prolistovat'] || f['ukazka'] || f['preview'] || '',
          flipbookLink: f['ukazka-link'] || f['ukázka-link'] || f['link-na-prolistovani'] || f['prolistovat'] || f['ukazka'] || f['preview'] || '',
          previewVideoLink: f['ukazka-video'] || f['ukázka-video'] || f['video-ukazka'] || ''
        };
      }),
      ...printItems.map((i: any) => {
        const f = i.fieldData || i;
        const name = f.name || 'Bez názvu';
        return {
          id: i.id || i._id,
          name: name,
          category: cleanCategory(i, true),
          type: 'workbook',
          price: f['cena'] ? `${f['cena']},-` : 'N/A',
          priceAmount: f['cena'] || 0,
          image: findImage(f),
          description: f['popis-produktu'] || f['popis'] || '',
          isbn: f['isbn'] || '',
          poradi: f['poradi'] || 999,
          format: f['format'] || '',
          pocetStranek: f['pocet-stranek'] || f['strany'] || 0,
          rokVydani: f['rok-vydani'] || '',
          autori: f['autori'] || '',
          dolozka: f['msmt-dolozka'] || f['dolozka'] || '',
          note: f['poznamka'] || f['poznámka'] || f['akce'] || f['note'] || '',
          poznamka: f['poznamka'] || f['poznámka'] || f['akce'] || f['note'] || '',
          previewLink: f['ukazka-link'] || f['ukázka-link'] || f['link-na-prolistovani'] || f['prolistovat'] || f['ukazka'] || f['preview'] || '',
          flipbookLink: f['ukazka-link'] || f['ukázka-link'] || f['link-na-prolistovani'] || f['prolistovat'] || f['ukazka'] || f['preview'] || '',
          previewVideoLink: f['ukazka-video'] || f['ukázka-video'] || f['video-ukazka'] || '',
          // Přidáme všechna ostatní pole do metadata, abychom nic neztratili
          metadata: f,
          backgroundColor: '#DEE4F1',
          buttonType: 'cart'
        };
      })
    ];

    await saveAllProducts(processed);
    return c.json({ success: true, count: processed.length });
  } catch (e) {
    return c.json({ error: 'Migrace selhala', details: e.message }, 500);
  }
});

/** Import z Webflow duplikuje text do `note`, `poznamka` a často i `metadata`. Při zápisu `note` musí být vše synchronní, jinak UI vymaže jen `note` a zobrazení dál bere `poznamka`. */
function applyProductNoteSync<T extends Record<string, unknown>>(product: T, noteFromRequest: unknown): T {
  const n = String(noteFromRequest ?? '');
  const next = { ...product, note: n, poznamka: n } as T;
  const meta = (next as any).metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    (next as any).metadata = { ...meta, poznamka: n, 'poznámka': n };
  }
  return next;
}

app.post('/make-server-93a20b6f/products', async (c) => {
  const newProduct = await c.req.json();
  if (!newProduct.id) newProduct.id = `sb-${Date.now()}`;
  if ('note' in newProduct) {
    Object.assign(newProduct, applyProductNoteSync(newProduct, newProduct.note));
  }
  const products = await getAllProducts();
  await saveAllProducts([...products, newProduct]);
  return c.json({ success: true, product: newProduct });
});

app.get('/make-server-93a20b6f/products', async (c) => {
  const products = await getAllProducts();
  // Normalize category variants: "Matematika 2" / "Matematika-2" → "Matematika 2. stupeň"
  const normalized = products.map((p: any) => {
    if (!p.category) return p;
    let cat: string = String(p.category).trim();
    if (/^[Mm]atematika[\s\-]+2$/.test(cat)) cat = 'Matematika 2. stupeň';
    if (/^[Mm]atematika[\s\-]+1$/.test(cat)) cat = 'Matematika 1. stupeň';
    return cat === p.category ? p : { ...p, category: cat };
  });
  const data = await kv.get(KV_KEY);
  return c.json({ products: normalized, updatedAt: data?.updatedAt });
});

app.put('/make-server-93a20b6f/products/:id', async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const products = await getAllProducts();
  const updated = products.map((p: any) => {
    if (p.id !== id) return p;
    let next: any = { ...p, ...updates };
    if ('note' in updates) {
      next = applyProductNoteSync(next, updates.note);
    }
    return next;
  });
  await saveAllProducts(updated);
  return c.json({ success: true });
});

app.delete('/make-server-93a20b6f/products/:id', async (c) => {
  const id = c.req.param('id');
  const products = await getAllProducts();
  await saveAllProducts(products.filter((p: any) => p.id !== id));
  return c.json({ success: true });
});

/** Proxy stažení Shoptet productsComplete.xml (prohlížeč jinak často blokuje CORS). Povoleno jen https://eshop.vividbooks.com/export/… */
app.post('/make-server-93a20b6f/admin/shoptet-products-xml-fetch', async (c) => {
  let body: { url?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Neplatné JSON tělo' }, 400);
  }
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return c.json({ error: 'Chybí url' }, 400);
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return c.json({ error: 'Neplatná URL' }, 400);
  }
  if (u.protocol !== 'https:') return c.json({ error: 'Povolené je jen HTTPS' }, 400);
  if (u.hostname !== 'eshop.vividbooks.com') {
    return c.json({ error: 'Povolený je jen host eshop.vividbooks.com' }, 403);
  }
  if (!u.pathname.startsWith('/export/')) {
    return c.json({ error: 'Povolena je jen cesta /export/…' }, 403);
  }
  const hash = u.searchParams.get('hash');
  if (!hash || !String(hash).trim()) {
    return c.json(
      {
        error:
          'V URL chybí parametr hash. Zkopíruj celý exportní odkaz z administrace Shoptetu (Export → productsComplete) — bez platného hashe Shoptet vrací 404.',
      },
      400,
    );
  }
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; VividbooksAdmin-ShoptetImport/1.0; +https://www.vividbooks.com)',
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'cs,en;q=0.8',
    },
  });
  if (!r.ok) {
    const hint =
      r.status === 404
        ? ' Odkaz byl nejspíš neúplný, nebo hash vypršel — vygeneruj nový export ve Shoptetu a znovu zkopíruj URL.'
        : '';
    const status = r.status >= 400 && r.status < 500 ? 400 : 502;
    return c.json({ error: `Shoptet vrátil HTTP ${r.status}.${hint}`, upstreamStatus: r.status }, status);
  }
  const xml = await r.text();
  if (xml.length > 25_000_000) return c.json({ error: 'Odpověď je příliš velká' }, 413);
  return c.json({ xml });
});

app.post('/make-server-93a20b6f/clear-products', async (c) => {
  await kv.set(KV_KEY, { products: [], updatedAt: new Date().toISOString() });
  return c.json({ success: true });
});

app.get('/make-server-93a20b6f/test-webflow', async (c) => {
  const token = Deno.env.get('WEBFLOW_API_TOKEN');
  return c.json({ tokenExists: !!token });
});

app.get('/make-server-93a20b6f/export-distributor-pack', async (c) => {
  const products = await getAllProducts();
  const headers = ['ID', 'Název', 'Kategorie', 'Typ', 'Cena', 'ISBN', 'Obrázek', 'Popis'];
  const rows = products.map((p: any) => [
    p.id, p.name, p.category, p.type, p.price, p.isbn || '', p.image || '', (p.description || '').replace(/\n/g, ' ')
  ]);
  const csvContent = "\ufeff" + [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="vividbooks_export.csv"');
  return c.body(csvContent);
});

app.get('/make-server-93a20b6f/special-offers', async (c) => {
  const data = await kv.get(OFFERS_KEY);
  return c.json(data?.offers || []);
});

app.post('/make-server-93a20b6f/special-offers', async (c) => {
  const offer = await c.req.json();
  if (!offer.id) offer.id = `offer-${Date.now()}`;
  const data = await kv.get(OFFERS_KEY) || { offers: [] };
  const updated = { ...data, offers: [...data.offers, offer] };
  await kv.set(OFFERS_KEY, updated);
  return c.json(offer);
});

app.put('/make-server-93a20b6f/special-offers/:id', async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  const data = await kv.get(OFFERS_KEY) || { offers: [] };
  const updatedOffers = data.offers.map((o: any) => o.id === id ? { ...o, ...updates } : o);
  await kv.set(OFFERS_KEY, { ...data, offers: updatedOffers });
  return c.json({ success: true });
});

app.delete('/make-server-93a20b6f/special-offers/:id', async (c) => {
  const id = c.req.param('id');
  const data = await kv.get(OFFERS_KEY) || { offers: [] };
  const updatedOffers = data.offers.filter((o: any) => o.id !== id);
  await kv.set(OFFERS_KEY, { ...data, offers: updatedOffers });
  return c.json({ success: true });
});

function isProductBundleActivePublic(b: any, now: Date) {
  if (!b || b.isActive === false) return false;
  if (b.validFrom) {
    const from = new Date(b.validFrom);
    if (Number.isFinite(from.getTime()) && now < from) return false;
  }
  if (b.validTo) {
    const to = new Date(b.validTo);
    if (Number.isFinite(to.getTime()) && now > to) return false;
  }
  return true;
}

app.get('/make-server-93a20b6f/product-bundles', async (c) => {
  const data = await kv.get(BUNDLES_KEY) || { bundles: [] };
  const now = new Date();
  const bundles = (data.bundles || []).filter((b: any) => isProductBundleActivePublic(b, now));
  return c.json({ bundles });
});

app.get('/make-server-93a20b6f/admin/product-bundles', async (c) => {
  const data = await kv.get(BUNDLES_KEY) || { bundles: [] };
  return c.json({ bundles: data.bundles || [] });
});

app.post('/make-server-93a20b6f/admin/product-bundles', async (c) => {
  const body = await c.req.json();
  const bundle = { ...body };
  if (!bundle.id) bundle.id = `bundle-${Date.now()}`;
  const data = await kv.get(BUNDLES_KEY) || { bundles: [] };
  const bundles = [...(data.bundles || []), bundle];
  await kv.set(BUNDLES_KEY, {
    ...data,
    bundles,
    updatedAt: new Date().toISOString(),
  });
  return c.json(bundle);
});

app.put('/make-server-93a20b6f/admin/product-bundles/:id', async (c) => {
  let id = c.req.param('id');
  try {
    id = decodeURIComponent(id);
  } catch {
    /* použij raw param */
  }
  const updates = await c.req.json();
  const { id: _ignoreBodyId, ...patch } = updates && typeof updates === 'object' ? updates : {};
  const data = await kv.get(BUNDLES_KEY) || { bundles: [] };
  const prev = data.bundles || [];
  let found = false;
  const bundles = prev.map((b: any) => {
    if (String(b.id) !== String(id)) return b;
    found = true;
    return { ...b, ...patch, id: b.id };
  });
  if (!found) {
    return c.json({ success: false, error: `Balíček s id „${id}“ neexistuje (nesedí s uloženými daty).` }, 404);
  }
  await kv.set(BUNDLES_KEY, {
    ...data,
    bundles,
    updatedAt: new Date().toISOString(),
  });
  return c.json({ success: true });
});

app.delete('/make-server-93a20b6f/admin/product-bundles/:id', async (c) => {
  const id = c.req.param('id');
  const data = await kv.get(BUNDLES_KEY) || { bundles: [] };
  const bundles = (data.bundles || []).filter((b: any) => b.id !== id);
  await kv.set(BUNDLES_KEY, {
    ...data,
    bundles,
    updatedAt: new Date().toISOString(),
  });
  return c.json({ success: true });
});

/* ── Generic CRUD helpers ──────────���─���─────────────────────────── */
async function getCollection(key: string) {
  const data = await kv.get(key);
  return data?.items || [];
}

async function saveCollection(key: string, items: any[]) {
  await kv.set(key, { items, updatedAt: new Date().toISOString() });
}

/* ── Blog CRUD ─────────────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/blog', async (c) => {
  try {
    const items = await getCollection(BLOG_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba blog GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/blog', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `blog-${Date.now()}`;
    if (!item.slug) item.slug = item.id;
    const items = await getCollection(BLOG_KEY);
    await saveCollection(BLOG_KEY, [...items, item]);
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba blog POST: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/blog/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const items = await getCollection(BLOG_KEY);
    const updated = items.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    await saveCollection(BLOG_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba blog PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/blog/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const items = await getCollection(BLOG_KEY);
    await saveCollection(BLOG_KEY, items.filter((i: any) => i.id !== id));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba blog DELETE: ${e.message}` }, 500);
  }
});

/* Publish all blog posts */
app.post('/make-server-93a20b6f/admin/blog/publish-all', async (c) => {
  try {
    const items = await getCollection(BLOG_KEY);
    const updated = items.map((i: any) => ({ ...i, published: true }));
    await saveCollection(BLOG_KEY, updated);
    console.log(`[Blog] publish-all: ${updated.length} článků nastaveno na published=true`);
    return c.json({ success: true, count: updated.length });
  } catch (e: any) {
    return c.json({ error: `Chyba publish-all: ${e.message}` }, 500);
  }
});

/* ── Novinky CRUD ──────────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/novinky', async (c) => {
  try {
    const items = await getCollection(NOVINKY_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba novinky GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/novinky', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `novinka-${Date.now()}`;
    if (!item.slug) item.slug = item.id;
    const items = await getCollection(NOVINKY_KEY);
    await saveCollection(NOVINKY_KEY, [...items, item]);
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba novinky POST: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/novinky/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const items = await getCollection(NOVINKY_KEY);
    const updated = items.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    await saveCollection(NOVINKY_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba novinky PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/novinky/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const items = await getCollection(NOVINKY_KEY);
    await saveCollection(NOVINKY_KEY, items.filter((i: any) => i.id !== id));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba novinky DELETE: ${e.message}` }, 500);
  }
});

/* ── Public: Get webinars ─────────────────────────────────────── */
app.get('/make-server-93a20b6f/webinare', async (c) => {
  try {
    const items = await getCollection(WEBINARS_KEY);
    /* Přepis je jen pro admin/RAG — neposílat na veřejný web (velikost + soukromí). */
    const itemsPublic = items.map((w: any) => {
      const { prepis: _p, devSimulateReminderMorning: _dm, devSimulateReminderT30: _dt, ...rest } = w;
      const pub = { ...rest } as any;
      /* Vždy explicitní boolean — výchozí `false` (dotazník bez registrace na webinář). */
      pub.surveyRequireFullRegistration = w.surveyRequireFullRegistration === true;
      if (Array.isArray(pub.postWebinarQuizQuestions)) {
        pub.postWebinarQuizQuestions = pub.postWebinarQuizQuestions.map((q: any) => {
          if (!q || typeof q !== 'object') return q;
          const { correctIndex: _c, ...qq } = q;
          return qq;
        });
      }
      return pub;
    });
    return c.json({ items: itemsPublic });
  } catch (e: any) {
    return c.json({ error: `Chyba webinare public GET: ${e.message}` }, 500);
  }
});

/* ── Webinars CRUD ────────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/webinare', async (c) => {
  try {
    const items = await getCollection(WEBINARS_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba webinare GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/webinare', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `webinar-${Date.now()}`;
    const items = await getCollection(WEBINARS_KEY);
    await saveCollection(WEBINARS_KEY, [...items, item]);
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba webinare POST: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/webinare/:id', async (c) => {
  try {
    const idParam = String(c.req.param('id'));
    const updates = await c.req.json();
    const items = await getCollection(WEBINARS_KEY);
    let found = false;
    const updated = items.map((i: any) => {
      if (String(i?.id) === idParam) {
        found = true;
        return { ...i, ...updates };
      }
      return i;
    });
    if (!found) {
      return c.json({ error: `Webinář id=${idParam} nebyl nalezen v úložišti (nesedí id?).` }, 404);
    }
    await saveCollection(WEBINARS_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba webinare PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/webinare/:id', async (c) => {
  try {
    const idParam = String(c.req.param('id'));
    const items = await getCollection(WEBINARS_KEY);
    const next = items.filter((i: any) => String(i?.id) !== idParam);
    if (next.length === items.length) {
      return c.json({ error: `Webinář id=${idParam} nebyl nalezen.` }, 404);
    }
    await saveCollection(WEBINARS_KEY, next);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba webinare DELETE: ${e.message}` }, 500);
  }
});

/* ── Fixed Pages CRUD ──────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/fixed-pages', async (c) => {
  try {
    const items = await getCollection(FIXED_PAGES_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba fixed-pages GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/fixed-pages', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `page-${Date.now()}`;
    const items = await getCollection(FIXED_PAGES_KEY);
    await saveCollection(FIXED_PAGES_KEY, [...items, item]);
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba fixed-pages POST: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/fixed-pages/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const items = await getCollection(FIXED_PAGES_KEY);
    const updated = items.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    await saveCollection(FIXED_PAGES_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba fixed-pages PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/fixed-pages/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const items = await getCollection(FIXED_PAGES_KEY);
    await saveCollection(FIXED_PAGES_KEY, items.filter((i: any) => i.id !== id));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba fixed-pages DELETE: ${e.message}` }, 500);
  }
});

/* ── Hero Slides CRUD ──────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/hero-slidy', async (c) => {
  try {
    const items = await getCollection(HERO_SLIDES_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba hero-slidy GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/hero-slidy', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `slide-${Date.now()}`;
    const items = await getCollection(HERO_SLIDES_KEY);
    await saveCollection(HERO_SLIDES_KEY, [...items, item]);
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba hero-slidy POST: ${e.message}` }, 500);
  }
});

/** Přeskupení slidů — musí být před `/:id`, aby „reorder“ nepadl do dynamické routy. POST i PATCH (některé proxy PATCH neumí). */
async function heroSlidyReorderHandler(c: Context) {
  try {
    const body = await c.req.json();
    const orderedIds: unknown = body?.orderedIds;
    if (!Array.isArray(orderedIds) || !orderedIds.every((x) => typeof x === 'string')) {
      return c.json({ error: 'orderedIds musí být pole stringů (id slidů)' }, 400);
    }
    const items = (await getCollection(HERO_SLIDES_KEY)) as any[];
    const byId = new Map(items.map((i) => [String(i.id), i]));
    const out: any[] = [];
    let ord = 1;
    const seen = new Set<string>();
    for (const raw of orderedIds) {
      const sid = String(raw);
      const row = byId.get(sid);
      if (row) {
        out.push({ ...row, order: ord++ });
        seen.add(sid);
      }
    }
    for (const row of items) {
      const sid = String(row.id);
      if (!seen.has(sid)) {
        out.push({ ...row, order: ord++ });
      }
    }
    await saveCollection(HERO_SLIDES_KEY, out);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba hero-slidy reorder: ${e.message}` }, 500);
  }
}

app.post('/make-server-93a20b6f/admin/hero-slidy/reorder', heroSlidyReorderHandler);
app.patch('/make-server-93a20b6f/admin/hero-slidy/reorder', heroSlidyReorderHandler);

app.put('/make-server-93a20b6f/admin/hero-slidy/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const items = await getCollection(HERO_SLIDES_KEY);
    const updated = items.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    await saveCollection(HERO_SLIDES_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba hero-slidy PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/hero-slidy/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const items = await getCollection(HERO_SLIDES_KEY);
    await saveCollection(HERO_SLIDES_KEY, items.filter((i: any) => i.id !== id));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba hero-slidy DELETE: ${e.message}` }, 500);
  }
});

/* GET /public/hero-slidy — aktivní slidery z CMS pro homepage (bez auth) */
app.get('/make-server-93a20b6f/public/hero-slidy', async (c) => {
  try {
    const items = (await getCollection(HERO_SLIDES_KEY)) as any[];
    return c.json({ items: Array.isArray(items) ? items : [] });
  } catch (e: any) {
    console.log(`[public/hero-slidy] ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

/** Z textu modelu vytáhne první kompletní JSON objekt (ignoruje markdown, text před/po). */
function extractFirstJsonObject(raw: string): { ok: true; value: unknown } | { ok: false; reason: string } {
  const strippedBom = raw.replace(/\uFEFF/g, '').trim();
  const fence = strippedBom.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (fence ? fence[1] : strippedBom).trim();

  // Gemini občas předřadí JSON primitiv (např. true, nebo null\n) před objekt — celý řetězec pak při parse hlásí
  // "Unexpected non-whitespace character after JSON at position 4" (hned za "true").
  for (let s = 0; s < 8; s++) {
    const m = candidate.match(/^(true|false|null)\b\s*(?:,\s*)?/i);
    if (!m) break;
    candidate = candidate.slice(m[0].length).trim();
  }

  try {
    const v = JSON.parse(candidate);
    if (v !== null && typeof v === 'object') {
      if (!Array.isArray(v)) return { ok: true, value: v };
      const firstObj = (v as unknown[]).find(
        (x) => x !== null && typeof x === 'object' && !Array.isArray(x),
      );
      if (firstObj !== undefined) return { ok: true, value: firstObj };
    }
  } catch {
    /* pokračuj skenem { … } */
  }

  const start = candidate.indexOf('{');
  if (start === -1) return { ok: false, reason: 'Žádný objekt { … } v odpovědi' };
  let depth = 0;
  let inStr = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (ch === '\\') {
        const next = i + 1;
        if (next >= candidate.length) break;
        const e = candidate[next];
        if (e === 'u') {
          const hex = candidate.slice(next + 1, next + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            i = next + 4;
            continue;
          }
        }
        i = next;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        continue;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try {
          return { ok: true, value: JSON.parse(slice) };
        } catch (e: any) {
          return { ok: false, reason: e?.message || 'JSON.parse selhal' };
        }
      }
    }
  }
  return { ok: false, reason: 'Neúplný JSON objekt (nezavřená závorka)' };
}

/* POST /admin/hero-slide-ai-draft — Gemini navrhne text slidů; neukládá do DB */
app.post('/make-server-93a20b6f/admin/hero-slide-ai-draft', async (c) => {
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!geminiKey) return c.json({ error: 'GEMINI_API_KEY_RAG není nastaven.' }, 500);

    const body = await c.req.json();
    const prompt = String(body.prompt || '').trim();
    const subjectFilter = String(body.subjectFilter || '').trim();
    if (!prompt) return c.json({ error: 'prompt je povinný' }, 400);

    let products = await getAllProducts();
    if (subjectFilter) {
      const sf = subjectFilter.toLowerCase();
      products = products.filter((p: any) =>
        String(p.category || p.predmet || '').toLowerCase().includes(sf) ||
        String(p.name || '').toLowerCase().includes(sf)
      );
    }
    const withImages = products.filter((p: any) => p.image || p.coverImage).slice(0, 14);
    const productImageUrls = withImages.map((p: any) => String(p.image || p.coverImage)).filter(Boolean);
    const productSummaries = withImages.map((p: any) => `- ${p.name} (${p.category || p.predmet || '—'})`).join('\n');

    const system = `Jsi copywriter Vividbooks (Česká republika, základní školy, pracovní sešity, MŠMT, RVP).
Navrhni JEDEN hero slide na úvodní stránku e-shopu. Odpověz POUZE platným JSON objektem (žádný markdown, žádný text okolo), přesně s klíči:
{
  "title": string,
  "subtitle": string,
  "layout": "center" | "left-image",
  "bg": string,
  "badges": string[],
  "bottom": string,
  "link": string | null
}
Pravidla:
- Čeština, stručný marketingový tón, bez přehnaných superlativů.
- "layout": "left-image" jen pokud má smysl vizuál s produktem (jinak "center").
- "bg": hex barva #RRGGBB (pastel nebo sytá, ale čitelná s tmavým textem #001161 na světlém pozadí — preferuj světlé pastelové pozadí).
- "badges": 2 až 4 krátké řetězce (např. předmět, RVP, typ produktu).
- "link": interní cesta začínající / (např. /predmet/matematika-2-stupen) nebo prázdný řetězec / null pokud nevhodné.
- title max ~60 znaků, subtitle max ~180 znaků.`;

    const userMsg = `Požadavek uživatele:\n${prompt}\n\nProdukty v katalogu (kontext, nekopíruj názvy bezhlavě):\n${productSummaries || '(žádné produkty po filtru — navrhni obecný slide podle zadání)'}`;

    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const gRes = await fetch(gUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userMsg}` }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!gRes.ok) {
      const errT = await gRes.text();
      console.log(`[hero-slide-ai-draft] Gemini ${gRes.status}: ${errT.slice(0, 200)}`);
      return c.json({ error: `Gemini chyba ${gRes.status}` }, 500);
    }
    const gData = await gRes.json();
    const parts = gData?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
    const extracted = extractFirstJsonObject(text);
    if (!extracted.ok) {
      console.log(`[hero-slide-ai-draft] parse: ${extracted.reason} | head=${text.slice(0, 120)}`);
      return c.json({ error: `AI odpověď nelze zpracovat: ${extracted.reason}`, raw: text.slice(0, 800) }, 500);
    }
    const parsed = extracted.value as any;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return c.json({ error: 'Očekáván JSON objekt s poli slide', raw: text.slice(0, 400) }, 500);
    }

    const hexOk = (s: string) => /^#[0-9A-Fa-f]{6}$/.test(s.trim());
    const draft: Record<string, unknown> = {
      title: String(parsed.title || 'Novinka').slice(0, 120),
      subtitle: String(parsed.subtitle || '').slice(0, 400),
      layout: parsed.layout === 'left-image' ? 'left-image' : 'center',
      bg: typeof parsed.bg === 'string' && hexOk(parsed.bg) ? parsed.bg.trim() : '#e8d5f2',
      badges: Array.isArray(parsed.badges)
        ? parsed.badges.map((x: unknown) => String(x).slice(0, 100)).slice(0, 5)
        : [],
      bottom: String(parsed.bottom || '').slice(0, 220),
      image: '',
      isActive: true,
    };
    const linkVal = parsed.link != null && String(parsed.link).trim() ? String(parsed.link).trim().slice(0, 400) : '';
    if (linkVal.startsWith('/')) (draft as any).link = linkVal;

    if (draft.layout === 'left-image' && productImageUrls.length > 0) {
      draft.image = productImageUrls[0];
    }

    return c.json({ draft, productImageUrls });
  } catch (e: any) {
    console.log(`[hero-slide-ai-draft] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
});

/** HTML z AI pro e-mail — odstraní nebezpečné části; povolené značky nechává (Gemini). */
function sanitizeWebinarLearningsHtml(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  s = s.replace(/javascript:/gi, '');
  return s.slice(0, 120_000);
}

/** Společné zadání pro dlouhý „blogový“ článek do e-mailu (struktura + rozsah jako metodický text). */
const WEBINAR_LEARNINGS_ARTICLE_SYSTEM = `Vytvoř shrnutí webináře pro e-mail učitelům — článek v češtině v HTML.
Rozsah a struktura (inspirace stylem odborného článku / newsletteru, ne jedna krátká odrážka):
- Úvod: první <h2> ve tvaru: „Co jsme se dozvěděli na webináři: [stručné téma podle názvu webináře]“.
- Pod ním krátký perex: 1–2 odstavce <p> (nastínění kontextu z přepisu).
- Dál několik logických sekcí <h2> podle témat z přepisu; kde to dává smysl, dílčí podnadpisy <h3>.
- Odstavce <p>, výčty <ul><li> nebo <ol><li>, zvýraznění <strong> pro klíčové pojmy.
- Cílová délka: podstatně víc než pár vět — řádově stovky až cca 1500–2500 slov podle toho, kolik má přepis látky; nevynechávej důležité bloky zmíněné v přepisu.
- Výhradně fakta a témata z přepisu — nic nevymýšlej.

Povolené tagy: h2, h3, p, ul, ol, li, strong, em, br. Bez odkazů <a> pokud v přepisu není konkrétní URL. Bez obrázků. Bez markdownu mimo JSON.
Odpověz POUZE platným JSON: {"learningsHtml":"..."} kde hodnota je jeden řetězec s HTML.`;

async function geminiCallJson(
  geminiKey: string,
  systemAndUser: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const gUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
  const gRes = await fetch(gUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemAndUser }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!gRes.ok) return '';
  const gData = await gRes.json();
  const parts = gData?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
}

/** Samostatné volání jen pro 4 ABC otázky — v kombinaci s dlouhým článkem se jinak JSON často usekne nebo chybí questions. */
async function geminiGenerateDvppQuizQuestionsOnly(
  geminiKey: string,
  title: string,
  lecturer: string,
  truncatedPrepis: string,
): Promise<unknown[] | null> {
  const system =
    `Jsi pedagogický asistent pro české učitele. Z přepisu webináře vygeneruj PŘESNĚ 4 otázky s výběrem odpovědí (ABC).
Každá položka v poli "questions" MUSÍ mít:
- "question": text otázky (řetězec)
- "options": pole přesně 4 řetězců (možnosti A–D)
- "correctIndex": číslo 0, 1, 2 nebo 3 (která možnost je správná)

Pravidla: čeština; obsah výhradně z přepisu; každá otázka testuje jiný aspekt tématu.
Odpověz POUZE JSON objektem ve tvaru:
{"questions":[{"question":"...","options":["","","",""],"correctIndex":0}, ... přesně 4 prvky ]}`;

  const userMsg = `Název webináře: ${title}\nLektor: ${lecturer}\n\nPřepis:\n${truncatedPrepis}`;
  const text = await geminiCallJson(geminiKey, `${system}\n\n${userMsg}`, 4096, 0.4);
  const extracted = extractFirstJsonObject(text);
  if (!extracted.ok) {
    console.log(`[dvpp-quiz-only] parse: ${extracted.reason} | head=${text.slice(0, 200)}`);
    return null;
  }
  const parsed = extracted.value as { questions?: unknown };
  return Array.isArray(parsed?.questions) ? parsed.questions : null;
}

async function geminiGenerateWebinarLearningsArticle(
  geminiKey: string,
  title: string,
  lecturer: string,
  truncatedPrepis: string,
): Promise<string> {
  const userMsg = `Název webináře: ${title}\nLektor: ${lecturer}\n\nPřepis:\n${truncatedPrepis}`;
  const text = await geminiCallJson(
    geminiKey,
    `${WEBINAR_LEARNINGS_ARTICLE_SYSTEM}\n\n${userMsg}`,
    8192,
    0.45,
  );
  const extracted = extractFirstJsonObject(text);
  if (!extracted.ok) {
    console.log(`[dvpp-learnings] parse: ${extracted.reason} | head=${text.slice(0, 200)}`);
    return '';
  }
  const v = extracted.value as { learningsHtml?: string };
  return sanitizeWebinarLearningsHtml(String(v?.learningsHtml || ''));
}

async function geminiGenerateWebinarLearningsFallback(
  geminiKey: string,
  title: string,
  lecturer: string,
  truncatedPrepis: string,
): Promise<string> {
  const userMsg = `Webinář: ${title}\nLektor: ${lecturer}\n\nPřepis:\n${truncatedPrepis}`;
  const text = await geminiCallJson(
    geminiKey,
    `${WEBINAR_LEARNINGS_ARTICLE_SYSTEM}\n\n${userMsg}`,
    8192,
    0.4,
  );
  const extracted = extractFirstJsonObject(text);
  if (!extracted.ok) return '';
  const v = extracted.value as { learningsHtml?: string };
  return sanitizeWebinarLearningsHtml(String(v?.learningsHtml || ''));
}

function dvppQuizQuestionLabel(q: Record<string, unknown>): string {
  const anyQ = q as Record<string, unknown>;
  return String(
    anyQ.question ?? anyQ.label ?? anyQ.stem ?? anyQ.text ?? anyQ.questionText ?? anyQ.title ?? '',
  ).trim();
}

function dvppQuizQuestionOptions(q: Record<string, unknown>): string[] {
  const anyQ = q as Record<string, unknown>;
  let options = Array.isArray(anyQ.options)
    ? (anyQ.options as unknown[]).map((x) => String(x).trim())
    : Array.isArray(anyQ.answers)
    ? (anyQ.answers as unknown[]).map((x) => String(x).trim())
    : Array.isArray(anyQ.choices)
    ? (anyQ.choices as unknown[]).map((x) => String(x).trim())
    : [];
  while (options.length < 4) options.push('');
  return options.slice(0, 4);
}

/** Body.part: `questions` = jen 4× ABC, `learnings` = jen HTML článek, `both` / vynecháno = obojí. */
function normalizeDvppGeneratePart(raw: unknown): 'both' | 'questions' | 'learnings' {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'both' || s === 'all') return 'both';
  if (s === 'questions' || s === 'quiz' || s === 'otazky' || s === 'otázky') return 'questions';
  if (s === 'learnings' || s === 'article' || s === 'clanek' || s === 'článek' || s === 'html') {
    return 'learnings';
  }
  return 'both';
}

/* POST /admin/webinar-generate-dvpp-quiz — 4 otázky a/nebo shrnutí „co jsme se dozvěděli“ (Gemini) */
async function adminWebinarGenerateDvppQuizHandler(c: Context) {
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!geminiKey) return c.json({ error: 'GEMINI_API_KEY_RAG není nastaven.' }, 500);

    const body = await c.req.json();
    const part = normalizeDvppGeneratePart(body?.part);
    const webinarId = String(body?.webinarId || '').trim();
    const prepisOverride = typeof body?.prepis === 'string' ? body.prepis : '';
    if (!webinarId) return c.json({ error: 'Chybí webinarId' }, 400);

    const items = await getCollection(WEBINARS_KEY);
    const webinar = items.find((w: any) => String(w.id) === webinarId) as Record<string, unknown> | undefined;
    if (!webinar) return c.json({ error: 'Webinář nenalezen' }, 404);

    const prepis = (prepisOverride.trim() || String(webinar.prepis || '').trim());
    if (!prepis) {
      return c.json(
        {
          error:
            'Chybí přepis webináře — vložte ho do pole Přepis (záložka Úprava záznamu) a uložte, nebo použijte text z úložiště.',
        },
        400,
      );
    }

    const truncated = prepis.length > 32000
      ? `${prepis.slice(0, 32000)}\n\n[… text zkrácen pro generování …]`
      : prepis;

    const titleStr = String(webinar.title || '');
    const lecturerStr = String(webinar.lecturer || '');

    if (part === 'learnings') {
      let learningsHtml = await geminiGenerateWebinarLearningsArticle(
        geminiKey,
        titleStr,
        lecturerStr,
        truncated,
      );
      if (learningsHtml.length < 80) {
        learningsHtml = await geminiGenerateWebinarLearningsFallback(
          geminiKey,
          titleStr,
          lecturerStr,
          truncated,
        );
      }
      return c.json({ learningsHtml, webinarId, part: 'learnings' as const });
    }

    let rawQs = await geminiGenerateDvppQuizQuestionsOnly(
      geminiKey,
      titleStr,
      lecturerStr,
      truncated,
    );
    if (!Array.isArray(rawQs) || rawQs.length < 4) {
      console.log(`[dvpp-quiz] první pokus: ${rawQs?.length ?? 'null'}, druhý pokus`);
      rawQs = await geminiGenerateDvppQuizQuestionsOnly(
        geminiKey,
        titleStr,
        lecturerStr,
        truncated,
      );
    }
    if (!Array.isArray(rawQs) || rawQs.length === 0) {
      return c.json(
        {
          error:
            'Nepodařilo se vygenerovat 4 otázky (Gemini). Zkuste generovat znovu; pokud přepis je extrémně dlouhý, zkuste ho zkrátit na jádro.',
        },
        500,
      );
    }

    const slug = String(webinarId).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
    const out: Array<{
      id: string;
      type: 'abc';
      label: string;
      options: string[];
      correctIndex: number;
    }> = [];

    for (let i = 0; i < Math.min(4, rawQs.length); i++) {
      const q = rawQs[i] as Record<string, unknown>;
      const label = dvppQuizQuestionLabel(q);
      let options = dvppQuizQuestionOptions(q);
      const anyQ = q as Record<string, unknown>;
      let ci = 0;
      const rawCi = anyQ.correctIndex ?? anyQ.correct;
      if (typeof rawCi === 'number' && Number.isFinite(rawCi)) ci = Math.floor(rawCi);
      else if (typeof rawCi === 'string' && /^[0-3]$/.test(rawCi.trim())) ci = parseInt(rawCi.trim(), 10);
      if (ci < 0 || ci > 3) ci = 0;
      if (!label || options.some((o) => !o)) {
        return c.json(
          { error: `Otázka ${i + 1}: chybí text nebo některá z 4 možností. Zkuste generovat znovu.` },
          400,
        );
      }
      out.push({
        id: `dvpp-q-${slug}-${i}`,
        type: 'abc',
        label,
        options,
        correctIndex: ci,
      });
    }

    if (out.length < 4) {
      return c.json({ error: 'Model vrátil méně než 4 platné otázky.' }, 400);
    }

    if (part === 'questions') {
      return c.json({ questions: out, webinarId, part: 'questions' as const });
    }

    let learningsHtml = await geminiGenerateWebinarLearningsArticle(
      geminiKey,
      titleStr,
      lecturerStr,
      truncated,
    );
    if (learningsHtml.length < 80) {
      learningsHtml = await geminiGenerateWebinarLearningsFallback(
        geminiKey,
        titleStr,
        lecturerStr,
        truncated,
      );
    }

    return c.json({ questions: out, learningsHtml, webinarId, part: 'both' as const });
  } catch (e: any) {
    console.log(`[dvpp-quiz] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
}

app.post('/make-server-93a20b6f/admin/webinar-generate-dvpp-quiz', adminWebinarGenerateDvppQuizHandler);
/** Alias — některé proxy doručí cestu už bez segmentu make-server-93a20b6f (po normalizaci v Deno.serve). */
app.post('/admin/webinar-generate-dvpp-quiz', adminWebinarGenerateDvppQuizHandler);
/** GET: ověření, že je nasazená verze s tímto endpointem (POST = skutečné generování). */
app.get('/make-server-93a20b6f/admin/webinar-generate-dvpp-quiz', (c) =>
  c.json({
    ok: true,
    postOnly: true,
    path: 'webinar-generate-dvpp-quiz',
    bodyHint: { webinarId: 'string', prepis: 'string', part: 'questions | learnings | both (optional)' },
  }));
app.get('/admin/webinar-generate-dvpp-quiz', (c) =>
  c.json({
    ok: true,
    postOnly: true,
    path: 'webinar-generate-dvpp-quiz',
    bodyHint: { webinarId: 'string', prepis: 'string', part: 'questions | learnings | both (optional)' },
  }));

/* ── Normalizace FAQ předmětu (sdíleno public API + RAG) ─────────── */
function normalizeSubjectFaqs(raw: any): { question: string; answer: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: any) => ({
      question: String(x?.question ?? x?.q ?? '').trim(),
      answer: String(x?.answer ?? x?.a ?? '').trim(),
    }))
    .filter((x) => x.question.length > 0 && x.answer.length > 0);
}

/** Metodické principy z CMS (Předměty) — stejný tvar jako statická data na webu. */
function normalizeMethodPrinciplesItems(raw: any): { title: string; body: string; visualId: number; imageUrl?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: any, i: number) => {
      const title = String(x?.title ?? '').trim();
      const body = String(x?.body ?? '').trim();
      let visualId = Number(x?.visualId);
      if (!Number.isFinite(visualId)) visualId = i % 9;
      visualId = Math.max(0, Math.min(8, Math.floor(visualId)));
      const imageUrlRaw = String(x?.imageUrl ?? x?.image ?? '').trim();
      const imageUrl = imageUrlRaw.length > 0 ? imageUrlRaw : undefined;
      return { title, body, visualId, imageUrl };
    })
    .filter((x) => x.title.length > 0 && x.body.length > 0);
}

async function ensureAgentUploadBucket(supabase: ReturnType<typeof createClient>): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b: any) => b.name === UPLOAD_BUCKET);
  if (!bucketExists) {
    await supabase.storage.createBucket(UPLOAD_BUCKET, { public: false });
    console.log(`[Storage] Bucket ${UPLOAD_BUCKET} vytvořen`);
  }
}

/* ── Subject Pages (Predmety) CRUD ─────────────────────────────── */
app.get('/make-server-93a20b6f/admin/predmety', async (c) => {
  try {
    const items = await getCollection(SUBJECT_PAGES_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba predmety GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/predmety', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `subj-${Date.now()}`;
    const items = await getCollection(SUBJECT_PAGES_KEY);
    await saveCollection(SUBJECT_PAGES_KEY, [...items, item]);
    await syncSubjectFaqRag(item);
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba predmety POST: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/predmety/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const items = await getCollection(SUBJECT_PAGES_KEY);
    const updated = items.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    await saveCollection(SUBJECT_PAGES_KEY, updated);
    const merged = updated.find((i: any) => i.id === id);
    if (merged) await syncSubjectFaqRag(merged);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba predmety PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/predmety/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const items = await getCollection(SUBJECT_PAGES_KEY);
    await saveCollection(SUBJECT_PAGES_KEY, items.filter((i: any) => i.id !== id));
    try {
      await removeChunk(`predmet_faq_${id}`);
    } catch (_) { /* ignore */ }
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba predmety DELETE: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/seed/:collection', async (c) => {
  try {
    const collection = c.req.param('collection');
    const body = await c.req.json();
    const keyMap: Record<string, string> = {
      blog: BLOG_KEY,
      novinky: NOVINKY_KEY,
      webinare: WEBINARS_KEY,
      'hero-slidy': HERO_SLIDES_KEY,
      'predmety': SUBJECT_PAGES_KEY,
      'notifikace': NOTIFICATIONS_KEY,
      'tabs': TABS_KEY,
    };
    const key = keyMap[collection];
    if (!key) return c.json({ error: `Neznámá kolekce: ${collection}` }, 400);
    await saveCollection(key, body.items || []);
    return c.json({ success: true, count: (body.items || []).length });
  } catch (e: any) {
    return c.json({ error: `Seed error: ${e.message}` }, 500);
  }
});

/* ── Notifications CRUD ───────────────────���────────────────────── */
app.get('/make-server-93a20b6f/admin/notifikace', async (c) => {
  try {
    const items = await getCollection(NOTIFICATIONS_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba notifikace GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/notifikace', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `notif-${Date.now()}`;
    const items = await getCollection(NOTIFICATIONS_KEY);
    await saveCollection(NOTIFICATIONS_KEY, [...items, item]);
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba notifikace POST: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/notifikace/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const items = await getCollection(NOTIFICATIONS_KEY);
    const updated = items.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    await saveCollection(NOTIFICATIONS_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba notifikace PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/notifikace/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const items = await getCollection(NOTIFICATIONS_KEY);
    await saveCollection(NOTIFICATIONS_KEY, items.filter((i: any) => i.id !== id));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba notifikace DELETE: ${e.message}` }, 500);
  }
});

/* ── Tabs CRUD ─────────────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/tabs', async (c) => {
  try {
    const items = await getCollection(TABS_KEY);
    return c.json({ items });
  } catch (e: any) {
    return c.json({ error: `Chyba tabs GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/tabs', async (c) => {
  try {
    const item = await c.req.json();
    if (!item.id) item.id = `tab-${Date.now()}`;
    const items = await getCollection(TABS_KEY);
    await saveCollection(TABS_KEY, [...items, item]);
    // RAG embedding for tab content
    try {
      const ak = Deno.env.get('GEMINI_API_KEY_RAG');
      if (ak) {
        const tabText = [item.subject, item.tabText, item.contentHeadline, item.contentRichText].filter(Boolean).join('\n');
        if (tabText.trim()) {
          const emb = await embedText(tabText);
          await saveChunk({ id: `tab_${item.id}`, text: tabText, embedding: emb, embeddingDims: emb.length, metadata: { source: 'tab', sourceId: item.id, subject: item.subject || '', title: item.contentHeadline || item.tabText || 'Tab', chunkIndex: 0, totalChunks: 1, uploadedAt: new Date().toISOString(), tokens: Math.round(tabText.length / 4), quality: qualityScore(tabText) } });
        }
      }
    } catch (ragErr: any) { console.log('[tabs RAG embed error]', ragErr.message); }
    return c.json({ success: true, item });
  } catch (e: any) {
    return c.json({ error: `Chyba tabs POST: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/tabs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const items = await getCollection(TABS_KEY);
    const updated = items.map((i: any) => i.id === id ? { ...i, ...updates } : i);
    await saveCollection(TABS_KEY, updated);
    // Re-embed updated tab
    try {
      const ak = Deno.env.get('GEMINI_API_KEY_RAG');
      if (ak) {
        const merged = { ...items.find((i: any) => i.id === id), ...updates };
        const tabText = [merged.subject, merged.tabText, merged.contentHeadline, merged.contentRichText].filter(Boolean).join('\n');
        if (tabText.trim()) {
          const emb = await embedText(tabText);
          await saveChunk({ id: `tab_${id}`, text: tabText, embedding: emb, embeddingDims: emb.length, metadata: { source: 'tab', sourceId: id, subject: merged.subject || '', title: merged.contentHeadline || merged.tabText || 'Tab', chunkIndex: 0, totalChunks: 1, uploadedAt: new Date().toISOString(), tokens: Math.round(tabText.length / 4), quality: qualityScore(tabText) } });
        }
      }
    } catch (ragErr: any) { console.log('[tabs RAG update error]', ragErr.message); }
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba tabs PUT: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/tabs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const items = await getCollection(TABS_KEY);
    await saveCollection(TABS_KEY, items.filter((i: any) => i.id !== id));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Chyba tabs DELETE: ${e.message}` }, 500);
  }
});

/* ── Admin: Rozdělit „Matematika" na „Matematika-1" a „Matematika 2" ─────── */
app.post('/make-server-93a20b6f/admin/predmety/split-matematika', async (c) => {
  try {
    const predmety = await getCollection(SUBJECT_PAGES_KEY);
    const original = predmety.find((p: any) =>
      ['matematika', 'matematika-1', 'matematika 1'].includes(String(p.displayName || '').trim().toLowerCase())
    );
    if (!original) return c.json({ error: 'Předmět "Matematika" nenalezen v Supabase.' }, 404);
    const alreadyHas2 = predmety.find((p: any) => String(p.displayName || '').trim() === 'Matematika 2');
    const alreadyHas1 = predmety.find((p: any) => String(p.displayName || '').trim() === 'Matematika-1');
    const mat1: any = {
      ...original,
      id: `predmet-matematika-1-${Date.now()}`,
      displayName: 'Matematika-1',
      slug: 'matematika-1-stupen',
      tagline: original.tagline || 'Matematika pro 1. stupeň ZŠ',
      order: typeof original.order === 'number' ? original.order : 5,
      updatedAt: new Date().toISOString(),
    };
    const mat2: any = {
      ...original,
      id: `predmet-matematika-2-${Date.now() + 1}`,
      displayName: 'Matematika 2',
      slug: 'matematika-2-stupen',
      tagline: original.tagline || 'Matematika pro 2. stupeň ZŠ',
      order: typeof original.order === 'number' ? original.order + 0.5 : 5.5,
      updatedAt: new Date().toISOString(),
    };
    const filtered = predmety.filter((p: any) => p.id !== original.id);
    if (!alreadyHas1) filtered.push(mat1);
    if (!alreadyHas2) filtered.push(mat2);
    filtered.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    await saveCollection(SUBJECT_PAGES_KEY, filtered);
    return c.json({
      success: true,
      created: [!alreadyHas1 ? 'Matematika-1' : null, !alreadyHas2 ? 'Matematika 2' : null].filter(Boolean),
      alreadyExisted: [alreadyHas1 ? 'Matematika-1' : null, alreadyHas2 ? 'Matematika 2' : null].filter(Boolean),
      removed: original.displayName,
      total: filtered.length,
    });
  } catch (e: any) {
    return c.json({ error: `Split selhal: ${e.message}` }, 500);
  }
});

/* ── Admin: Bulk re-assign tab subjects from subpage ref or metadata.name ── */
app.post('/make-server-93a20b6f/admin/tabs/reassign-subjects', async (c) => {
  try {
    const predmety = await getCollection(SUBJECT_PAGES_KEY);
    const items = await getCollection(TABS_KEY);
    const norm = (s: string) => (s || '').trim().toLowerCase();

    // Hardcodovaná mapa (stejná jako v import-tabs)
    const WF_MAP: Record<string, string> = {
      '696fd3332356a1d9966c7764': 'Český jazyk',
      '68d5050a161002e62a666471': 'Chemie',
      '68d504f2dcf1ba67a9d76351': 'Přírodopis',
      '68d504b9f498f987d3ec5efc': 'Fyzika',
      '67efe04de5cf32249da1d70e': 'Prvouka',
      '67efe02bdb2baaefbc57c409': 'Matematika 2',
      '67efe003222ba83e9b706e96': 'Matematika-1',
    };

    const resolveRef = (id: string) => {
      if (!id) return '';
      if (WF_MAP[id]) return WF_MAP[id];
      const m = predmety.find((p: any) => p.id === id || p.webflowId === id || p.metadata?.id === id);
      return m ? (m.displayName || m.name || '') : '';
    };

    let fixed = 0;
    const updated = items.map((t: any) => {
      const currentSubject = String(t.subject ?? '').trim();

      // Pokud subject je WF ID → přeložit na displayName (hlavní případ dle diagnostiky)
      if (currentSubject && WF_MAP[currentSubject]) {
        fixed++;
        return { ...t, subject: WF_MAP[currentSubject] };
      }

      // Pokud subject je neprázdný a není WF ID → ponechat
      if (currentSubject) return t;

      // Subject je prázdný → zkus subpage pole
      const subpageId = String(t.subpage ?? t.metadata?.subpage ?? '').trim();
      if (subpageId) {
        const subpageResolved = resolveRef(subpageId);
        if (subpageResolved) { fixed++; return { ...t, subject: subpageResolved }; }
      }

      // Zkus parsovat z metadata.name — "PředmětNázev – Tab Text"
      const rawName = String(t.metadata?.name ?? t.metadata?.title ?? '');
      if (rawName) {
        const parts = rawName.split(/\s*[–\-\/]\s*/);
        if (parts.length > 1) {
          const candidate = parts[0].trim();
          const matchedP = predmety.find((p: any) =>
            norm(p.displayName) === norm(candidate) || norm(p.name) === norm(candidate)
          );
          const resolved = matchedP ? (matchedP.displayName || matchedP.name) : candidate;
          if (resolved) { fixed++; return { ...t, subject: resolved }; }
        }
      }
      return t;
    });
    await saveCollection(TABS_KEY, updated);
    const bySubject: Record<string, number> = {};
    for (const t of updated) { const k = t.subject || '(prázdný)'; bySubject[k] = (bySubject[k] || 0) + 1; }
    return c.json({ success: true, fixed, total: updated.length, bySubject });
  } catch (e: any) {
    return c.json({ error: `Reassign selhal: ${e.message}` }, 500);
  }
});

/* ── Public: Get tabs by subject ─�����─────────────────────────���──── */
app.get('/make-server-93a20b6f/public/tabs', async (c) => {
  try {
    const subject = c.req.query('subject');
    const items = await getCollection(TABS_KEY);
    // Normalize: treat hyphen/space as equivalent, lowercase, strip diacritics
    // 'Matematika-2' === 'Matematika 2', 'Matematika-1' === 'Matematika 1'
    const normKey = (s: string) => (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\-]+/g, '-')
      .trim();
    const filtered = subject
      ? items.filter((t: any) => normKey(t.subject) === normKey(subject))
      : items;
    const sorted = filtered.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    console.log(`[public/tabs] subject="${subject}" normKey="${normKey(subject||'')}" → ${sorted.length} tabs`);
    return c.json({ items: sorted });
  } catch (e: any) {
    return c.json({ error: `Chyba public tabs: ${e.message}` }, 500);
  }
});

/* ── Public: Hero metadata předmětu (úvod autora) podle URL slugu ── */
app.get('/make-server-93a20b6f/public/predmet', async (c) => {
  try {
    const rawSlug = (c.req.query('slug') || '').trim();
    const subjectHint = (c.req.query('subject') || '').trim();
    if (!rawSlug) return c.json({ item: null });
    const items = await getCollection(SUBJECT_PAGES_KEY);
    const normKey = (s: string) => String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const strField = (v: any): string => {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return '';
    };
    const n = normKey(rawSlug);
    let item = items.find((p: any) => {
      const ps = String(p.slug || '').trim().toLowerCase();
      if (ps === rawSlug.toLowerCase()) return true;
      if (normKey(p.slug || '') === n) return true;
      if (normKey(p.displayName || '') === n) return true;
      return false;
    });
    /* Slug v adminu často neodpovídá URL (např. „matematika“ vs „matematika-2-stupen“) — doplníme shodu podle názvu předmětu ze stránky. */
    if (!item && subjectHint) {
      const low = subjectHint.toLowerCase();
      item = items.find((p: any) => String(p.displayName || '').trim().toLowerCase() === low) ?? undefined;
    }
    if (!item && subjectHint) {
      const nh = normKey(subjectHint);
      item = items.find((p: any) => normKey(p.displayName || '') === nh) ?? undefined;
    }
    if (!item) return c.json({ item: null });
    const faqs = normalizeSubjectFaqs(item.faqs);
    const methodPrinciplesItems = normalizeMethodPrinciplesItems(item.methodPrinciplesItems);
    return c.json({
      item: {
        heroText: strField(item.heroText),
        authorIntroHeading: strField(item.authorIntroHeading),
        authorIntroBody: strField(item.authorIntroBody),
        faqs,
        methodPrinciplesItems: methodPrinciplesItems.length > 0 ? methodPrinciplesItems : undefined,
      },
    });
  } catch (e: any) {
    return c.json({ error: `Chyba public predmet: ${e.message}` }, 500);
  }
});

/* ── Public: Get active notification + webinar fallback ───────── */
app.get('/make-server-93a20b6f/public/notifikace', async (c) => {
  try {
    const notifications = await getCollection(NOTIFICATIONS_KEY);
    const webinars = await getCollection(WEBINARS_KEY);
    
    const activeCustom = notifications
      .filter((n: any) => n.isActive && n.type === 'custom')
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    
    const activeSliders = notifications
      .filter((n: any) => n.isActive && n.type === 'slider')
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    
    // Auto-generate webinar bobánek from upcoming webinars
    const now = new Date();
    const upcomingWebinars = webinars
      .filter((w: any) => {
        if (w.isPast) return false;
        const wDate = new Date(w.year, (w.monthNum || 1) - 1, w.day || 1);
        return wDate >= now;
      })
      .sort((a: any, b: any) => {
        const dA = new Date(a.year, (a.monthNum || 1) - 1, a.day || 1);
        const dB = new Date(b.year, (b.monthNum || 1) - 1, b.day || 1);
        return dA.getTime() - dB.getTime();
      });
    
    const nextWebinar = upcomingWebinars[0] || null;
    
    // If there's a custom notification, use it; otherwise auto-generate from webinar
    let bobanak = null;
    if (activeCustom.length > 0) {
      bobanak = activeCustom[0];
    } else if (nextWebinar) {
      bobanak = {
        id: 'auto-webinar',
        type: 'webinar-auto',
        title: nextWebinar.title,
        subtitle: `${nextWebinar.day}. ${nextWebinar.monthName} ${nextWebinar.year} v ${nextWebinar.time}`,
        emoji: '\uD83D\uDD14',
        link: `/webinar/${nextWebinar.id}`,
        isActive: true,
        webinarId: nextWebinar.id,
      };
    }
    
    return c.json({ bobanak, sliders: activeSliders, nextWebinar });
  } catch (e: any) {
    return c.json({ error: `Chyba public notifikace: ${e.message}` }, 500);
  }
});

/* ── Webinar registrations ────────────────────────────���────────── */
app.post('/make-server-93a20b6f/webinar-registrace', async (c) => {
  try {
    const body = await c.req.json();
    const {
      webinarId,
      webinarTitle,
      webinarSlug,
      name,
      email,
      phone,
      position,
      gdpr,
      newsletter,
      /** Fallback termín z klienta (KV nemusí mít webinář nebo je zastaralý) */
      webinarDay: bodyDay,
      webinarMonthNum: bodyMonthNum,
      webinarYear: bodyYear,
      webinarTime: bodyTime,
      webinarMonthName: bodyMonthName,
      /** Přesný název tagu v Mailchimp (jako v adminu u webináře), jinak webinar-{slug} */
      mailchimpTagName: bodyMailchimpTag,
    } = body;

    if (!webinarId || !name || !email || !position) {
      return c.json({ error: 'Chybí povinná pole (webinarId, name, email, position).' }, 400);
    }
    if (!gdpr) {
      return c.json({ error: 'Souhlas se zpracováním osobních údajů je povinný.' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const key = `webinar_reg_${webinarId}_${cleanEmail}`;
    const existing = await kv.get(key);
    if (existing) {
      return c.json({ error: 'Na tento webinář jste již zaregistrováni s tímto e-mailem.' }, 409);
    }

    // Generate magic trial token
    const token = crypto.randomUUID();
    const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const slug = webinarSlug || webinarId;

    const registration = {
      webinarId,
      webinarTitle: webinarTitle || webinarId,
      webinarSlug: slug,
      name: name.trim(),
      email: cleanEmail,
      phone: phone?.trim() || '',
      position,
      gdpr: true,
      newsletter: !!newsletter,
      registeredAt: new Date().toISOString(),
      attended: false,
      trialToken: token,
    };

    await kv.set(key, registration);
    console.log(`[Webinar] Registrace ulozena: ${name} (${cleanEmail}) -> ${webinarId}`);

    await mergeWebinarEmailIndex(cleanEmail, {
      webinarId,
      webinarTitle: webinarTitle || webinarId,
      webinarSlug: slug,
      attended: false,
      registeredAt: registration.registeredAt,
    });

    /** Osobní odkaz do e-mailu (Mandrill) — po kliknutí ověření bez zadávání e-mailu + jméno do chatu. */
    const lobbyToken = crypto.randomUUID();
    const lobbyExpiresAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    await kv.set(`webinar_lobby_${lobbyToken}`, {
      webinarId,
      webinarSlug: slug,
      email: cleanEmail,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      expiresAt: lobbyExpiresAt,
    });

    // Save trial token
    await kv.set(`trial_token_${token}`, {
      token,
      email: cleanEmail,
      name: name.trim(),
      webinarId,
      webinarTitle: webinarTitle || webinarId,
      createdAt: new Date().toISOString(),
      expires: tokenExpires,
      trialActivated: false,
    });

    // ── Kalendář + stream URL (stejné jako e-mail; JSON odpověď i bez Mandrill) ─
    const siteBaseUrl = getPublicSiteOrigin();
    const liveUrl = `${siteBaseUrl}/webinar/${slug}/live`;
    const liveUrlPersonal = `${liveUrl}?lobby=${lobbyToken}`;

    const allWebinars = await getCollection(WEBINARS_KEY);
    const webinarFromKv = allWebinars.find((w: any) => w.id === webinarId) as Record<string, unknown> | undefined;
    const merged = mergeWebinarRegistrationMergedFromBodyAndKv(webinarFromKv, {
      webinarId,
      webinarTitle: webinarTitle || webinarId,
      webinarDay: bodyDay,
      webinarMonthNum: bodyMonthNum,
      webinarYear: bodyYear,
      webinarTime: bodyTime,
      webinarMonthName: bodyMonthName,
    });
    const cal = computeWebinarRegistrationCalendarAndIcs(webinarId, merged, liveUrl);
    const { humanDate, hasSchedule, icsContent, icsBase64, gcalStr, outlookUrl } = cal;

    const suppressLiveRegistrationEmail = isWebinarEventAlreadyPastForRegistration(webinarFromKv, merged);

    // ── Mandrill confirmation email ────────────────────────────────
    type MandrillSyncState = {
      ok: boolean;
      skipped?: boolean;
      detail?: string;
    };
    let mandrillSync: MandrillSyncState = {
      ok: false,
      skipped: true,
      detail: 'Chybí MANDRILL_API_KEY v Supabase (Edge Functions → Secrets). Bez něj se potvrzovací e-mail neodešle.',
    };

    const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
    if (suppressLiveRegistrationEmail) {
      mandrillSync = {
        ok: true,
        skipped: true,
        detail:
          'Webinář již proběhl — potvrzovací e-mail s termínem a odkazem na přenos se neodesílá (např. registrace kvůli dotazníku po akci).',
      };
      console.log(`[Mandrill] Preskoceno (webinar uz probehl): ${webinarId} -> ${cleanEmail}`);
    } else if (mandrillKey) {
      try {
        const payload = buildWebinarRegistrationConfirmationEmailPayload({
          webinarFromKv,
          merged,
          slug,
          webinarId,
          webinarTitleForSubject: webinarTitle || webinarId,
          liveUrl,
          liveUrlPersonal,
          recipientName: name.trim(),
          humanDate,
          hasSchedule,
          gcalStr,
          outlookUrl,
          icsContent,
          icsBase64,
        });
        const result = await sendMandrillWebinarRegistrationConfirmationResult({
          toEmail: cleanEmail,
          toName: name.trim(),
          subject: payload.subject,
          html: payload.html,
          attachments: payload.attachments,
        });
        if (result.ok) {
          mandrillSync = { ok: true };
          console.log(`[Mandrill] Email odeslan: ${cleanEmail} status=sent`);
        } else {
          mandrillSync = { ok: false, detail: result.detail };
          console.log(`[Mandrill] Odpoved: ${result.detail}`);
        }
      } catch (mailErr: any) {
        const msg = mailErr?.message || String(mailErr);
        mandrillSync = { ok: false, detail: msg };
        console.log(`[Mandrill] Chyba (neblokuje registraci): ${msg}`);
      }
    } else {
      console.log('[Mandrill] MANDRILL_API_KEY neni nastaven, email preskocen');
    }

    // Mailchimp integration — výsledek uložíme do KV pro admin (Registrace)
    const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
    const newsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NEWSLETTER');
    const noNewsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NO_NEWSLETTER');
    const audienceId = newsletter ? newsletterAudienceId : noNewsletterAudienceId;

    type McSync = {
      ok: boolean;
      skipped?: boolean;
      memberOk?: boolean;
      tagsOk?: boolean;
      detail?: string;
    };
    let mailchimpSync: McSync = { ok: false };

    if (mcApiKey && audienceId) {
      try {
        const subscriberHash = md5(cleanEmail);
        const dc = mcApiKey.split('-').pop() || 'us19';
        const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
        const mcAuth = btoa(`anystring:${mcApiKey}`);
        const nameParts = name.trim().split(' ');
        const fname = nameParts[0] || '';
        const lname = nameParts.slice(1).join(' ') || '';

        const detailParts: string[] = [];
        let memberOk = false;

        // 1. Check if contact already exists in this audience
        const checkRes = await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${mcAuth}` },
        });

        if (checkRes.status === 404) {
          const createRes = await fetch(`${mcBase}/lists/${audienceId}/members`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email_address: cleanEmail,
              status: 'subscribed',
              merge_fields: { FNAME: fname, LNAME: lname, PHONE: phone?.trim() || '' },
            }),
          });
          memberOk = createRes.ok;
          if (createRes.ok) {
            console.log(`[Mailchimp] Novy kontakt vytvoren: ${cleanEmail} -> audience ${audienceId}`);
          } else {
            const errText = await createRes.text();
            detailParts.push(`create ${createRes.status}: ${errText.slice(0, 160)}`);
            console.log(`[Mailchimp] Create selhal: ${createRes.status} ${errText.slice(0, 200)}`);
          }
        } else if (checkRes.ok) {
          console.log(`[Mailchimp] Existujici kontakt nalezen: ${cleanEmail} -> pouze pridavam tag`);
          const patchRes = await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              merge_fields: { FNAME: fname, LNAME: lname, PHONE: phone?.trim() || '' },
            }),
          });
          memberOk = patchRes.ok;
          if (!patchRes.ok) {
            const te = await patchRes.text();
            detailParts.push(`patch ${patchRes.status}: ${te.slice(0, 160)}`);
          }
        } else {
          const errText = await checkRes.text();
          detailParts.push(`check ${checkRes.status}: ${errText.slice(0, 160)}`);
          console.log(`[Mailchimp] Check selhal: ${checkRes.status} ${errText.slice(0, 200)}`);
        }

        const explicitMcTag = typeof bodyMailchimpTag === 'string' && bodyMailchimpTag.trim().length > 0
          ? bodyMailchimpTag.trim().slice(0, 100)
          : '';
        const webinarListTag = explicitMcTag || `webinar-${slug}`;
        const tags = [
          { name: webinarListTag, status: 'active' },
          { name: 'webinar-registrace', status: 'active' },
        ] as Array<{ name: string; status: string }>;
        if (newsletter) tags.push({ name: 'newsletter', status: 'active' });

        const tagRes = await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}/tags`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags }),
        });
        const tagsOk = tagRes.ok;
        if (tagRes.ok) {
          console.log(`[Mailchimp] Tagy pridany: ${webinarListTag} + webinar-registrace pro ${cleanEmail}`);
        } else {
          const te = await tagRes.text();
          detailParts.push(`tags ${tagRes.status}: ${te.slice(0, 160)}`);
          console.log(`[Mailchimp] Tagy selhaly: ${tagRes.status} ${te.slice(0, 200)}`);
        }

        mailchimpSync = {
          ok: memberOk && tagsOk,
          memberOk,
          tagsOk,
          detail: detailParts.length ? detailParts.join(' | ').slice(0, 400) : undefined,
        };
      } catch (mcErr: any) {
        const msg = mcErr?.message || String(mcErr);
        mailchimpSync = { ok: false, detail: msg };
        console.log(`[Mailchimp] Chyba (neblokuje registraci): ${msg}`);
      }
    } else {
      mailchimpSync = {
        ok: false,
        skipped: true,
        detail: 'Chybí MAILCHIMP_API_KEY nebo audience (NEWSLETTER / NO_NEWSLETTER).',
      };
      console.log(`[Mailchimp] Preskoceno - chybi API klic nebo audience ID`);
    }

    const integrationReportAt = new Date().toISOString();
    type IntegrationPipelineStep = {
      key: string;
      label: string;
      status: 'ok' | 'skipped' | 'failed';
      detail?: string;
      at: string;
    };
    const integrationPipeline: IntegrationPipelineStep[] = [
      {
        key: 'registration_kv',
        label: 'Záznam registrace (KV)',
        status: 'ok',
        at: registration.registeredAt,
      },
      {
        key: 'email_index',
        label: 'Index e-mailů pro admin',
        status: 'ok',
        at: integrationReportAt,
      },
      {
        key: 'lobby_kv',
        label: 'Odkaz do lobby (KV)',
        status: 'ok',
        at: integrationReportAt,
      },
      {
        key: 'trial_kv',
        label: 'Trial token (KV)',
        status: 'ok',
        at: integrationReportAt,
      },
      {
        key: 'mandrill',
        label: 'Potvrzovací e-mail (Mandrill)',
        status: mandrillSync.skipped ? 'skipped' : mandrillSync.ok ? 'ok' : 'failed',
        detail: mandrillSync.detail,
        at: integrationReportAt,
      },
      {
        key: 'mailchimp',
        label: 'Mailchimp (kontakt + tagy)',
        status: mailchimpSync.skipped ? 'skipped' : mailchimpSync.ok ? 'ok' : 'failed',
        detail: mailchimpSync.detail,
        at: integrationReportAt,
      },
    ];

    const mandrillFailed = !mandrillSync.skipped && !mandrillSync.ok;
    const mailchimpFailed = !mailchimpSync.skipped && !mailchimpSync.ok;
    const integrationSummary = {
      overall: (mandrillFailed || mailchimpFailed
        ? 'error'
        : (mandrillSync.skipped || mailchimpSync.skipped)
          ? 'partial'
          : 'ok') as 'ok' | 'partial' | 'error',
      headline: mandrillFailed || mailchimpFailed
        ? 'Alespoň jedna externí integrace selhala — viz krok níže a Supabase Edge Logs.'
        : (mandrillSync.skipped || mailchimpSync.skipped)
          ? 'Některý krok přeskočen (není nastaven klíč nebo audience).'
          : 'Všechny naplánované kroky proběhly v pořádku.',
    };

    if (mandrillFailed) {
      await upsertSiteIncident({
        source: 'webinar_registration',
        incidentType: 'mandrill_email_failed',
        severity: 'warning',
        dedupeKey: `webinar-mandrill-${webinarId}-${cleanEmail}`,
        title: 'Webinář: potvrzovací e-mail se neodeslal (Mandrill)',
        message: mandrillSync.detail || 'Mandrill nevrátil úspěšné odeslání.',
        payload: {
          webinarId,
          webinarSlug: slug,
          email: cleanEmail,
          name: name.trim(),
        },
        webinarId,
        webinarTitle: webinarTitle || webinarId,
        contactEmail: cleanEmail,
      });
    }
    if (mailchimpFailed) {
      await upsertSiteIncident({
        source: 'webinar_registration',
        incidentType: 'mailchimp_sync_failed',
        severity: 'warning',
        dedupeKey: `webinar-mc-${webinarId}-${cleanEmail}`,
        title: 'Webinář: synchronizace s Mailchimpem selhala',
        message: mailchimpSync.detail || 'Mailchimp API vrátilo chybu.',
        payload: {
          webinarId,
          webinarSlug: slug,
          email: cleanEmail,
          newsletter: !!newsletter,
        },
        webinarId,
        webinarTitle: webinarTitle || webinarId,
        contactEmail: cleanEmail,
      });
    }

    const regStored = await kv.get(key);
    if (regStored && typeof regStored === 'object') {
      const syncedAt = new Date().toISOString();
      await kv.set(key, {
        ...(regStored as Record<string, unknown>),
        mailchimpSync,
        mailchimpSyncedAt: syncedAt,
        mandrillSync,
        mandrillSyncedAt: syncedAt,
        integrationPipeline,
        integrationSummary,
        integrationReportAt: syncedAt,
      });
    }

    return c.json({
      success: true,
      message: 'Registrace proběhla úspěšně.',
      token,
      trialUrl: `/vyzkousejte?token=${token}`,
      streamUrl: liveUrlPersonal,
      streamUrlPublic: liveUrl,
      calendar: hasSchedule && gcalStr
        ? { googleUrl: gcalStr, outlookUrl, icsBase64: icsBase64 || null }
        : null,
      /** Diagnostika (klient může ignorovat) — zda odešel e-mail a zda proběhl Mailchimp */
      sync: {
        mandrill: mandrillSync,
        mailchimp: mailchimpSync,
      },
      integration: {
        summary: integrationSummary,
        pipeline: integrationPipeline,
        reportAt: integrationReportAt,
      },
    });
  } catch (err: any) {
    console.log(`[Webinar] Chyba pri registraci: ${err.message}`);
    return c.json({ error: `Chyba při zpracování registrace: ${err.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/webinar-registrace/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const prefix = `webinar_reg_${webinarId}_`;
    const registrations = await kv.getByPrefix(prefix);
    return c.json({ webinarId, count: registrations.length, registrations });
  } catch (err: any) {
    console.log(`[Webinar] Chyba pri nacitani registraci: ${err.message}`);
    return c.json({ error: `Chyba: ${err.message}` }, 500);
  }
});

/** Veřejné ověření: je e-mail registrovaný na webinář (dotazník, částečné uložení). */
async function handleWebinarRegistrationCheckGet(c: Context) {
  try {
    const webinarId = normalizeWebinarIdFromBody(c.req.query('webinarId'));
    const emailRaw = typeof c.req.query('email') === 'string' ? c.req.query('email') : '';
    const email = emailRaw.toLowerCase().trim();
    if (!webinarId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ registered: false, error: 'Chybí platné webinarId nebo email.' }, 400);
    }
    const reg = await kv.get(`webinar_reg_${webinarId}_${email}`);
    const light = await kv.get(`webinar_survey_light_${webinarId}_${email}`);
    return c.json({ registered: !!(reg || light) });
  } catch (err: any) {
    console.log(`[Webinar] registration-check: ${err.message}`);
    return c.json({ error: err.message || 'Chyba' }, 500);
  }
}
app.get('/make-server-93a20b6f/public/webinar-registration-check', handleWebinarRegistrationCheckGet);
app.get('/public/webinar-registration-check', handleWebinarRegistrationCheckGet);

/** Minimální kontakt před dotazníkem DVPP (bez plné registrace na webinář) — ukládá se do KV pro `public/webinar-registration-check`. */
app.post('/make-server-93a20b6f/webinar-survey-light-lead', async (c) => {
  try {
    const body = await c.req.json();
    const webinarId = String(body.webinarId || '').trim();
    const name = String(body.name || '').trim();
    const emailRaw = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const gdpr = !!body.gdpr;
    if (!webinarId || !name || !emailRaw || !phone) {
      return c.json({ error: 'Vyplňte jméno, e-mail a telefon.' }, 400);
    }
    if (!gdpr) {
      return c.json({ error: 'Souhlas se zpracováním osobních údajů je povinný.' }, 400);
    }
    const cleanEmail = emailRaw.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return c.json({ error: 'Neplatný e-mail.' }, 400);
    }
    const key = `webinar_survey_light_${webinarId}_${cleanEmail}`;
    const existing = await kv.get(key);
    if (existing) {
      return c.json({ success: true, alreadyRegistered: true });
    }
    await kv.set(key, {
      webinarId,
      name,
      email: cleanEmail,
      phone,
      gdpr: true,
      savedAt: new Date().toISOString(),
    });
    console.log(`[Webinar] survey light lead: ${cleanEmail} webinar=${webinarId}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`[Webinar] survey light lead: ${err.message}`);
    return c.json({ error: err?.message || 'Chyba' }, 500);
  }
});

/**
 * Údaje pro certifikát DVPP (jméno + datum narození). **Nezávislé na registraci na webinář** — uloží do KV
 * pod `webinar_reg_{webinarId}_{email}` (sloučení s existujícím záznamem nebo nový minimální z formuláře).
 * Mailchimp: pokus o PATCH jen pokud kontakt v audience už existuje.
 */
app.post('/make-server-93a20b6f/webinar-dvpp-certificate-profile', async (c) => {
  try {
    const body = await c.req.json();
    const webinarId = String(body.webinarId || '').trim();
    const emailRaw = String(body.email || '').trim();
    const participantName = String(body.participantName || '').trim();
    const birthDateIso = String(body.birthDateIso || '').trim();
    const schoolNameOpt = String(body.schoolName || '').trim();
    const schoolIcoOpt = String(body.schoolIco || '')
      .replace(/\D/g, '')
      .slice(0, 10);

    if (!webinarId || !emailRaw || !participantName) {
      return c.json({ error: 'Chybí webinarId, e-mail nebo jméno.' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateIso)) {
      return c.json({ error: 'Neplatné datum narození (očekává se YYYY-MM-DD).' }, 400);
    }
    const cleanEmail = emailRaw.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return c.json({ error: 'Neplatný e-mail.' }, 400);
    }

    const key = `webinar_reg_${webinarId}_${cleanEmail}`;
    const prev = (await kv.get(key)) as Record<string, unknown> | null | undefined;
    const base: Record<string, unknown> =
      prev && typeof prev === 'object'
        ? { ...prev }
        : {
            name: participantName,
            email: cleanEmail,
            gdpr: true,
            createdFromCertificateOnly: true,
            createdAt: new Date().toISOString(),
          };
    const merged = {
      ...base,
      certificateParticipantName: participantName,
      birthDateIso,
      ...(schoolNameOpt ? { certificateSchoolName: schoolNameOpt } : {}),
      ...(schoolIcoOpt.length >= 8 ? { certificateSchoolIco: schoolIcoOpt } : {}),
      certificateProfileSavedAt: new Date().toISOString(),
    };
    await kv.set(key, merged);
    console.log(`[Webinar] DVPP cert profil ulozen: ${cleanEmail} webinar=${webinarId}`);

    const reg = merged as Record<string, unknown>;

    const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
    const newsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NEWSLETTER');
    const noNewsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NO_NEWSLETTER');
    const newsletter = !!reg.newsletter;
    const audienceId = newsletter ? newsletterAudienceId : noNewsletterAudienceId;

    type McMini = { ok: boolean; skipped?: boolean; detail?: string };
    let mailchimp: McMini = { ok: false, skipped: true, detail: 'Mailchimp není nakonfigurován.' };

    if (mcApiKey && audienceId) {
      try {
        const subscriberHash = md5(cleanEmail);
        const dc = mcApiKey.split('-').pop() || 'us19';
        const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
        const mcAuth = btoa(`anystring:${mcApiKey}`);
        const nameParts = participantName.split(/\s+/).filter(Boolean);
        const fname = nameParts[0] || '';
        const lname = nameParts.slice(1).join(' ') || '';

        const y = parseInt(birthDateIso.slice(0, 4), 10);
        const m = parseInt(birthDateIso.slice(5, 7), 10);
        const d = parseInt(birthDateIso.slice(8, 10), 10);
        const ddmmyyyy = `${d}. ${m}. ${y}`;
        const mmdd = `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;

        const checkRes = await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${mcAuth}` },
        });

        if (checkRes.status === 404) {
          mailchimp = {
            ok: false,
            skipped: true,
            detail: 'Kontakt v této Mailchimp audience není — údaje jsou uložené jen u registrace.',
          };
        } else if (!checkRes.ok) {
          const te = await checkRes.text();
          mailchimp = { ok: false, detail: `Mailchimp GET: ${checkRes.status} ${te.slice(0, 200)}` };
        } else {
          const customTag = Deno.env.get('MAILCHIMP_MERGE_BIRTHDATE')?.trim();
          const useBirthdayField = Deno.env.get('MAILCHIMP_USE_BIRTHDAY_FIELD') !== '0';

          const mergeFields: Record<string, string> = { FNAME: fname, LNAME: lname };
          if (customTag) mergeFields[customTag] = ddmmyyyy;
          if (useBirthdayField) mergeFields['BIRTHDAY'] = mmdd;

          const patchMember = async (fields: Record<string, string>) => {
            return await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ merge_fields: fields }),
            });
          };

          let patchRes = await patchMember(mergeFields);
          if (!patchRes.ok && useBirthdayField && mergeFields['BIRTHDAY']) {
            const withoutBirth: Record<string, string> = { ...mergeFields };
            delete withoutBirth['BIRTHDAY'];
            patchRes = await patchMember(withoutBirth);
          }
          if (patchRes.ok) {
            mailchimp = { ok: true };
            console.log(`[Mailchimp] DVPP cert profil sync: ${cleanEmail}`);
          } else {
            const pe = await patchRes.text();
            mailchimp = { ok: false, detail: `PATCH ${patchRes.status}: ${pe.slice(0, 220)}` };
          }
        }
      } catch (mcErr: any) {
        const msg = mcErr?.message || String(mcErr);
        mailchimp = { ok: false, detail: msg };
        console.log(`[Mailchimp] DVPP cert profil chyba: ${msg}`);
      }
    }

    return c.json({ success: true, mailchimp });
  } catch (err: any) {
    console.log(`[Webinar] DVPP cert profil: ${err.message}`);
    return c.json({ error: err?.message || 'Chyba' }, 500);
  }
});

/* ── DVPP Video registrations ──────────────────────────────────── */
app.post('/make-server-93a20b6f/dvpp-video-registrace', async (c) => {
  try {
    const body = await c.req.json();
    const lightLead = body.lightLead === true;
    const { videoId, videoTitle, videoSlug, name, email, phone, position, gdpr, newsletter, youtubeUrl } = body;

    if (lightLead) {
      if (!videoId || !name || !email || !String(phone || '').trim()) {
        return c.json({ error: 'Chybí povinná pole (videoId, name, email, telefon).' }, 400);
      }
      if (!gdpr) {
        return c.json({ error: 'Souhlas se zpracováním osobních údajů je povinný.' }, 400);
      }
    } else if (!videoId || !name || !email || !position) {
      return c.json({ error: 'Chybí povinná pole (videoId, name, email, position).' }, 400);
    } else if (!gdpr) {
      return c.json({ error: 'Souhlas se zpracováním osobních údajů je povinný.' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const key = `dvpp_video_reg_${videoId}_${cleanEmail}`;
    const existing = await kv.get(key);
    if (existing) {
      // Already registered — just return success so they can watch
      return c.json({ success: true, message: 'Již jste registrováni.', alreadyRegistered: true });
    }

    const resolvedPosition = lightLead
      ? 'Kontakt (záznam bez plné registrace)'
      : position;

    const registration = {
      videoId,
      videoTitle: videoTitle || videoId,
      videoSlug: videoSlug || videoId,
      name: name.trim(),
      email: cleanEmail,
      phone: phone?.trim() || '',
      position: resolvedPosition,
      gdpr: true,
      newsletter: lightLead ? false : !!newsletter,
      lightLead: !!lightLead,
      registeredAt: new Date().toISOString(),
      youtubeUrl: youtubeUrl || '',
    };

    await kv.set(key, registration);
    console.log(`[DvppVideo] Registrace ulozena: ${name} (${cleanEmail}) -> ${videoId}`);

    // ── Mailchimp ──────────────────────────────────────────────────
    const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
    const newsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NEWSLETTER');
    const noNewsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NO_NEWSLETTER');
    const audienceId = newsletter ? newsletterAudienceId : noNewsletterAudienceId;

    if (mcApiKey && audienceId) {
      try {
        const subscriberHash = md5(cleanEmail);
        const dc = mcApiKey.split('-').pop() || 'us19';
        const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
        const mcAuth = btoa(`anystring:${mcApiKey}`);
        const nameParts = name.trim().split(' ');
        const fname = nameParts[0] || '';
        const lname = nameParts.slice(1).join(' ') || '';
        const slug = videoSlug || videoId;

        const checkRes = await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
          headers: { 'Authorization': `Basic ${mcAuth}` },
        });

        if (checkRes.status === 404) {
          await fetch(`${mcBase}/lists/${audienceId}/members`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email_address: cleanEmail,
              status: 'subscribed',
              merge_fields: { FNAME: fname, LNAME: lname, PHONE: phone?.trim() || '' },
            }),
          });
          console.log(`[Mailchimp] DVPP novy kontakt: ${cleanEmail}`);
        } else if (checkRes.ok) {
          await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ merge_fields: { FNAME: fname, LNAME: lname } }),
          });
        }

        const tags = [
          { name: 'dvpp-video', status: 'active' },
          { name: `dvpp-video-${slug}`, status: 'active' },
        ] as Array<{ name: string; status: string }>;
        if (newsletter) tags.push({ name: 'newsletter', status: 'active' });

        await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}/tags`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags }),
        });
        console.log(`[Mailchimp] DVPP tagy pridany pro ${cleanEmail}`);
      } catch (mcErr: any) {
        console.log(`[Mailchimp] DVPP chyba (neblokuje registraci): ${mcErr.message}`);
      }
    }

    // ── Mandrill confirmation email ────────────────────────────────
    const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
    if (mandrillKey) {
      try {
        const firstName = czechFirstNameVocative(name.trim().split(' ')[0] || name.trim());
        const videoUrl = `https://www.vividbooks.com/webinare/zaznam/${videoId}`;

        const emailHtml = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pristup k zaznamu</title></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,17,97,0.08);">
<tr><td style="background:#001161;padding:32px 40px 28px;">
<p style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Vividbooks</p>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Zaznam webinare DVPP</p>
</td></tr>
<tr><td style="padding:40px 40px 32px;">
<p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#001161;line-height:1.25;">Mas pristup k zaznamu!</p>
<p style="margin:0 0 6px;font-size:16px;color:#4a5568;">Ahoj <strong style="color:#001161;">${firstName}</strong>,</p>
<p style="margin:0 0 28px;font-size:16px;color:#4a5568;line-height:1.6;">
Dekujeme za registraci ke sledovani zaznamu <strong style="color:#001161;">${videoTitle || videoId}</strong>. Zaznam je pro tebe kdykoli dostupny na odkazu nize.
</p>
<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
<tr><td style="background:#001161;border-radius:16px;padding:24px 28px;">
<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.65);">Zaznam webinare</p>
<p style="margin:0 0 16px;font-size:17px;font-weight:800;color:#ffffff;">${videoTitle || 'DVPP Webinar'}</p>
<a href="${videoUrl}" style="display:inline-block;background:#E8942A;color:#ffffff;font-weight:800;font-size:15px;padding:12px 28px;border-radius:100px;text-decoration:none;">&#9654; Prehrat zaznam</a>
<p style="margin:14px 0 0;font-size:12px;color:rgba(255,255,255,0.55);word-break:break-all;">${videoUrl}</p>
</td></tr>
</table>
<p style="margin:0;font-size:14px;color:#718096;line-height:1.6;">
Zaznamy vsech webinaru najdes take na <a href="https://www.vividbooks.com/webinare" style="color:#001161;font-weight:700;">vividbooks.com/webinare</a>.
</p>
</td></tr>
<tr><td style="background:#f8f9fc;padding:20px 40px;border-top:1px solid #edf2f7;">
<p style="margin:0;font-size:12px;color:#a0aec0;line-height:1.6;">
Tento email byl odeslan automaticky po registraci ke sledovani zaznamu DVPP.<br>
&copy; ${new Date().getFullYear()} Vividbooks
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

        await fetch('https://mandrillapp.com/api/1.0/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: mandrillKey,
            message: {
              html: emailHtml,
              subject: `Pristup k zaznamu: ${videoTitle || videoId}`,
              from_email: 'hello@vividbooks.com',
              from_name: 'Vividbooks',
              to: [{ email: cleanEmail, name: name.trim(), type: 'to' }],
              headers: { 'Reply-To': 'hello@vividbooks.com' },
              track_opens: true,
              track_clicks: false,
            },
          }),
        });
        console.log(`[Mandrill] DVPP email odeslan: ${cleanEmail}`);
      } catch (mailErr: any) {
        console.log(`[Mandrill] DVPP chyba (neblokuje registraci): ${mailErr.message}`);
      }
    }

    return c.json({ success: true, message: 'Registrace proběhla úspěšně.' });
  } catch (err: any) {
    console.log(`[DvppVideo] Chyba pri registraci: ${err.message}`);
    return c.json({ error: `Chyba při zpracování registrace: ${err.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/dvpp-video-registrace/:videoId', async (c) => {
  try {
    const videoId = c.req.param('videoId');
    const prefix = `dvpp_video_reg_${videoId}_`;
    const registrations = await kv.getByPrefix(prefix);
    return c.json({ videoId, count: registrations.length, registrations });
  } catch (err: any) {
    return c.json({ error: `Chyba: ${err.message}` }, 500);
  }
});

/* ── Trial token verify ─────────────────────────────────────────── */
app.get('/make-server-93a20b6f/verify-token/:token', async (c) => {
  try {
    const token = c.req.param('token');
    const data = await kv.get(`trial_token_${token}`);
    if (!data) return c.json({ valid: false, error: 'Token nenalezen.' }, 404);
    if (new Date(data.expires) < new Date()) return c.json({ valid: false, error: 'Token vypršel.' }, 410);

    if (!data.trialActivated) {
      await kv.set(`trial_token_${token}`, { ...data, trialActivated: true, activatedAt: new Date().toISOString() });
      const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
      if (mcApiKey) {
        try {
          const subscriberHash = md5(data.email);
          const dc = mcApiKey.split('-').pop() || 'us19';
          const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
          const mcAuth = btoa(`anystring:${mcApiKey}`);
          for (const aud of [Deno.env.get('MAILCHIMP_AUDIENCE_NEWSLETTER'), Deno.env.get('MAILCHIMP_AUDIENCE_NO_NEWSLETTER')]) {
            if (!aud) continue;
            await fetch(`${mcBase}/lists/${aud}/members/${subscriberHash}/tags`, {
              method: 'POST',
              headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ tags: [{ name: 'trial-active', status: 'active' }] }),
            }).catch(() => {});
          }
          console.log(`[Mailchimp] trial-active tag pridan: ${data.email}`);
        } catch (mcErr: any) {
          console.log(`[Mailchimp] trial-active selhal: ${mcErr.message}`);
        }
      }
    }

    return c.json({
      valid: true,
      email: data.email,
      name: data.name,
      webinarId: data.webinarId,
      webinarTitle: data.webinarTitle,
      trialActivated: true,
      expires: data.expires,
    });
  } catch (err: any) {
    console.log(`[Token] Chyba verify: ${err.message}`);
    return c.json({ error: `Chyba ověření tokenu: ${err.message}` }, 500);
  }
});

/** Pro admin Kontakty: účast/registrace po jednotlivých webinářích (stejný e-mail může mít víc záznamů). */
type WebinarEmailIdxEntry = {
  webinarId: string;
  webinarTitle: string;
  webinarSlug: string;
  attended: boolean;
  attendedAt?: string;
  registeredAt: string;
};

function webinarEmailIndexKey(cleanEmail: string): string {
  return `webinar_reg_email_idx_${md5(cleanEmail)}`;
}

async function mergeWebinarEmailIndex(
  cleanEmail: string,
  patch: {
    webinarId: string;
    webinarTitle?: string;
    webinarSlug?: string;
    attended?: boolean;
    attendedAt?: string;
    registeredAt?: string;
  },
): Promise<void> {
  const idxKey = webinarEmailIndexKey(cleanEmail);
  const prev = ((await kv.get(idxKey)) as WebinarEmailIdxEntry[] | null) || [];
  const i = prev.findIndex((x) => x.webinarId === patch.webinarId);
  const base: WebinarEmailIdxEntry = i >= 0
    ? prev[i]!
    : {
      webinarId: patch.webinarId,
      webinarTitle: patch.webinarTitle || patch.webinarId,
      webinarSlug: patch.webinarSlug || patch.webinarId,
      attended: false,
      registeredAt: patch.registeredAt || new Date().toISOString(),
    };
  const next: WebinarEmailIdxEntry = {
    ...base,
    webinarTitle: patch.webinarTitle ?? base.webinarTitle,
    webinarSlug: patch.webinarSlug ?? base.webinarSlug,
    attended: patch.attended !== undefined ? patch.attended : base.attended,
    attendedAt: patch.attendedAt !== undefined ? patch.attendedAt : base.attendedAt,
    registeredAt: patch.registeredAt ?? base.registeredAt,
  };
  const arr = [...prev];
  if (i >= 0) arr[i] = next;
  else arr.push(next);
  await kv.set(idxKey, arr);
}

/** Načte index; když je prázdný, jednorázově doplní ze záznamů webinar_reg_* (starší data). */
async function getWebinarEmailIndexRows(cleanEmail: string): Promise<WebinarEmailIdxEntry[]> {
  const idxKey = webinarEmailIndexKey(cleanEmail);
  const cached = (await kv.get(idxKey)) as WebinarEmailIdxEntry[] | null;
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const webinars = await getCollection(WEBINARS_KEY) as Array<{ id: string; title?: string; slug?: string }>;
  const out: WebinarEmailIdxEntry[] = [];
  for (const w of webinars) {
    const reg = await kv.get(`webinar_reg_${w.id}_${cleanEmail}`) as Record<string, unknown> | null;
    if (!reg) continue;
    out.push({
      webinarId: w.id,
      webinarTitle: String(reg.webinarTitle || w.title || w.id),
      webinarSlug: String(reg.webinarSlug || w.slug || w.id),
      attended: !!reg.attended,
      attendedAt: typeof reg.attendedAt === 'string' ? reg.attendedAt : undefined,
      registeredAt: typeof reg.registeredAt === 'string' ? reg.registeredAt : new Date().toISOString(),
    });
  }
  if (out.length) await kv.set(idxKey, out);
  return out;
}

/** Označí účast v KV + index pro admin (bez Mailchimp tagu „attended“). */
async function runWebinarCheckInEffects(
  webinarId: string,
  cleanEmail: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  const key = `webinar_reg_${webinarId}_${cleanEmail}`;
  const reg = await kv.get(key) as Record<string, unknown> | null;
  if (!reg) return { ok: false, reason: 'not_found' };
  const attendedAt = new Date().toISOString();
  const updated = { ...reg, attended: true, attendedAt };
  await kv.set(key, updated);
  console.log(`[Webinar] Check-in: ${cleanEmail} na ${webinarId}`);

  await mergeWebinarEmailIndex(cleanEmail, {
    webinarId,
    webinarTitle: String(updated.webinarTitle || webinarId),
    webinarSlug: String(updated.webinarSlug || webinarId),
    attended: true,
    attendedAt,
    registeredAt: typeof updated.registeredAt === 'string' ? updated.registeredAt : attendedAt,
  });
  return { ok: true };
}

/* ── Webinar check-in ──────────────────────────────────────────── */
app.post('/make-server-93a20b6f/webinar-checkin', async (c) => {
  try {
    const { webinarId, email, webinarSlug } = await c.req.json();
    if (!webinarId || !email) return c.json({ error: 'Chybí webinarId nebo email.' }, 400);
    const cleanEmail = email.toLowerCase().trim();
    const r = await runWebinarCheckInEffects(webinarId, cleanEmail);
    if (!r.ok) return c.json({ error: 'Registrace nenalezena.' }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`[Checkin] Chyba: ${err.message}`);
    return c.json({ error: `Chyba check-in: ${err.message}` }, 500);
  }
});

/* ── Osobní odkaz z Mandrill e-mailu (?lobby=) ─────────────────── */
app.post('/make-server-93a20b6f/webinar-lobby-verify', async (c) => {
  try {
    const body = await c.req.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) return c.json({ error: 'Chybí token.' }, 400);

    const row = await kv.get(`webinar_lobby_${token}`) as {
      webinarId?: string;
      webinarSlug?: string;
      email?: string;
      name?: string;
      expiresAt?: string;
    } | null;
    if (!row?.webinarId || !row.email) {
      return c.json({ error: 'Odkaz je neplatný nebo vypršel.' }, 404);
    }
    if (row.expiresAt) {
      const exp = new Date(row.expiresAt).getTime();
      if (Number.isFinite(exp) && Date.now() > exp) {
        return c.json({ error: 'Odkaz vypršel.' }, 410);
      }
    }

    const cleanEmail = String(row.email).toLowerCase().trim();
    const applied = await runWebinarCheckInEffects(row.webinarId, cleanEmail);
    if (!applied.ok) return c.json({ error: 'Registrace nenalezena.' }, 404);

    return c.json({
      success: true,
      webinarId: row.webinarId,
      email: cleanEmail,
      name: String(row.name || '').trim(),
    });
  } catch (err: any) {
    console.log(`[Lobby] Chyba: ${err.message}`);
    return c.json({ error: `Chyba ověření odkazu: ${err.message}` }, 500);
  }
});

/* ── Dotazník po registraci na webinář ─────────────────────────── */
const DEFAULT_SURVEY_QUESTIONS_SERVER: Array<{
  id: string;
  type: 'open' | 'abc' | 'yes_no';
  label: string;
  options?: string[];
}> = [
  { id: 'motivation', type: 'open', label: 'S jakou motivací přicházíte na tento webinář?' },
  { id: 'topic_interest', type: 'open', label: 'Co by vás u tématu nejvíce zajímalo?' },
  { id: 'uses_vividbooks', type: 'yes_no', label: 'Používám Vividbooks' },
];

/** Druhá část po DVPP — musí odpovídat `DEFAULT_POST_WEBINAR_PART2_STEPS` na klientu (bez úvodního kroku). */
const DEFAULT_POST_WEBINAR_PART2_FOR_SERVER: typeof DEFAULT_SURVEY_QUESTIONS_SERVER = [
  { id: 'post-part2-liked', type: 'open', label: 'Jak se vám webinář líbil?' },
  {
    id: 'post-part2-improve',
    type: 'open',
    label: 'Jak bychom mohli Vividbooks nebo naše webináře ještě vylepšit?',
  },
  {
    id: 'post-part2-trial',
    type: 'abc',
    label:
      'Přejete si vyzkoušet Vividbooks nebo zaškolit Vaše kolegy? (DVPP školení zdarma pro celý tým)',
    options: [
      'Ano, chci vyzkoušet nebo zaškolit mé kolegy',
      'Ne, Vividbooks již testujeme',
      'Nemám zájem',
    ],
  },
  {
    id: 'post-part2-why-not',
    type: 'open',
    label: 'Pokud si nepřejete vyzkoušet Vividbooks, napište nám prosím proč ne.',
  },
];

function mapPostWebinarPart2FromItem(w: Record<string, unknown> | null): typeof DEFAULT_SURVEY_QUESTIONS_SERVER {
  if (!w) return DEFAULT_POST_WEBINAR_PART2_FOR_SERVER;
  if (w.surveyEnabled === false) return [];
  const raw = w.postWebinarPart2;
  if (raw !== undefined) {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return (raw as any[])
      .filter(
        (x) =>
          x &&
          (x.type === 'open' || x.type === 'abc') &&
          typeof x.id === 'string' &&
          typeof x.label === 'string',
      )
      .map((x) => {
        if (x.type === 'open') {
          return { id: String(x.id), type: 'open' as const, label: String(x.label) };
        }
        const opts = Array.isArray(x.options) ? x.options.map((o: unknown) => String(o)) : [];
        return { id: String(x.id), type: 'abc' as const, label: String(x.label), options: opts };
      });
  }
  return DEFAULT_POST_WEBINAR_PART2_FOR_SERVER;
}

function mapPostWebinarQuizQuestionsForSurvey(
  w: Record<string, unknown>,
): typeof DEFAULT_SURVEY_QUESTIONS_SERVER {
  const raw = w.postWebinarQuizQuestions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x: any) =>
        x &&
        x.type === 'abc' &&
        typeof x.label === 'string' &&
        String(x.label).trim() &&
        Array.isArray(x.options) &&
        x.options.length >= 2,
    )
    .map((x: any) => ({
      id: String(x.id),
      type: 'abc' as const,
      label: String(x.label),
      options: x.options.map((o: unknown) => String(o)),
    }));
}

/**
 * Text správné odpovědi u DVPP kvízu (`postWebinarQuizQuestions`), pokud je v CMS `correctIndex`.
 * `null` = tuto otázku nevyhodnocujeme (zpětná kompatibilita nebo chybí index).
 */
function getDvppQuizCorrectAnswerText(
  webinar: Record<string, unknown> | null | undefined,
  questionId: string,
): string | null {
  const raw = webinar?.postWebinarQuizQuestions;
  if (!Array.isArray(raw)) return null;
  const q = raw.find((x: any) => x && String(x.id) === String(questionId));
  const anyQ = q as Record<string, unknown> | undefined;
  if (!anyQ || String(anyQ.type) !== 'abc') return null;
  const options = Array.isArray(anyQ.options)
    ? (anyQ.options as unknown[]).map((o) => String(o).trim())
    : [];
  const rawCi = anyQ.correctIndex ?? anyQ.correct;
  let idx: number | null = null;
  if (typeof rawCi === 'number' && Number.isFinite(rawCi)) idx = Math.floor(rawCi);
  else if (typeof rawCi === 'string' && /^[0-3]$/.test(rawCi.trim())) idx = parseInt(rawCi.trim(), 10);
  if (idx == null || idx < 0 || idx > 3 || idx >= options.length) return null;
  const text = options[idx];
  return text ? text : null;
}

function resolveSurveyQuestionsFromWebinarItem(w: Record<string, unknown> | null): typeof DEFAULT_SURVEY_QUESTIONS_SERVER {
  /** Chybí záznam v CMS — jako na klientu: jen výchozí part 2 (bez před-webinářových otázek). */
  if (!w) {
    return [...DEFAULT_POST_WEBINAR_PART2_FOR_SERVER];
  }
  const dvpp = mapPostWebinarQuizQuestionsForSurvey(w);
  if (w.surveyEnabled === false) {
    return dvpp.length > 0 ? dvpp : [];
  }
  const part2 = mapPostWebinarPart2FromItem(w);
  const raw = w.surveyQuestions;
  if (Array.isArray(raw) && raw.length > 0) {
    const base = raw
      .filter((x: any) => x && x.id && x.label && x.type)
      .map((x: any) => ({
        id: String(x.id),
        type: x.type as 'open' | 'abc' | 'yes_no',
        label: String(x.label),
        options: Array.isArray(x.options) ? x.options.map((o: unknown) => String(o)) : undefined,
      }));
    return [...dvpp, ...part2, ...base];
  }
  /** Bez vlastních `surveyQuestions` v CMS nepřidáváme DEFAULT_SURVEY (motivace / téma / Vividbooks) — ty jsou pro před webinářem. */
  return [...dvpp, ...part2];
}

/** Jen otázky před webinářem (bez DVPP) — stejné jako `getPreWebinarSurveyQuestions` na klientu. */
function resolvePreWebinarSurveyQuestionsFromItem(w: Record<string, unknown> | null): typeof DEFAULT_SURVEY_QUESTIONS_SERVER {
  if (!w) return DEFAULT_SURVEY_QUESTIONS_SERVER;
  if (w.surveyEnabled === false) return [];
  const raw = w.surveyQuestions;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((x: any) => x && x.id && x.label && x.type)
      .map((x: any) => ({
        id: String(x.id),
        type: x.type as 'open' | 'abc' | 'yes_no',
        label: String(x.label),
        options: Array.isArray(x.options) ? x.options.map((o: unknown) => String(o)) : undefined,
      }));
  }
  return DEFAULT_SURVEY_QUESTIONS_SERVER;
}

function webinarSurveyAnswerKey(webinarId: string, cleanEmail: string): string {
  return `webinar_survey_${webinarId}_${md5(cleanEmail)}`;
}

function webinarSurveyPartialKey(webinarId: string, cleanEmail: string): string {
  return `webinar_survey_partial_${webinarId}_${md5(cleanEmail)}`;
}

/** Stejná konvence jako u POST /webinar-registrace (string | number z JSON). */
function normalizeWebinarIdFromBody(v: unknown): string {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t) return t;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function pragueWallClockFromMs(nowMs: number): { y: number; m: number; d: number; H: number; M: number } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = f.formatToParts(new Date(nowMs));
  const o: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') o[p.type] = p.value;
  }
  return { y: +o.year, m: +o.month, d: +o.day, H: +o.hour, M: +o.minute };
}

function webinarStartEpochMsPrague(w: {
  year: number;
  monthNum?: number;
  day?: number;
  time?: string;
}): number {
  const mo = w.monthNum || 1;
  const d = w.day || 1;
  const y = w.year;
  const tm = String(w.time || '18:00').match(/^(\d{1,2}):(\d{2})/);
  const hh = tm ? parseInt(tm[1], 10) : 18;
  const mi = tm ? parseInt(tm[2], 10) : 0;
  const T = (globalThis as any).Temporal;
  if (T?.PlainDateTime?.from && T?.ZonedDateTime) {
    try {
      const plain = T.PlainDateTime.from({ year: y, month: mo, day: d, hour: hh, minute: mi });
      const zdt = plain.toZonedDateTime('Europe/Prague');
      return zdt.epochMilliseconds;
    } catch {
      /* fall through */
    }
  }
  return Date.UTC(y, mo - 1, d, hh - 2, mi, 0, 0);
}

function webinarDefaultDurationMinutes(w: Record<string, unknown>): number {
  const v = (w as any).durationMinutes;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 24 * 60) return Math.floor(v);
  const env = Deno.env.get('WEBINAR_DEFAULT_DURATION_MIN')?.trim();
  const n = env ? parseInt(env, 10) : NaN;
  if (Number.isFinite(n) && n > 0 && n <= 24 * 60) return n;
  return 120;
}

/** Začátek + odhad délky — po tomto okamžiku se webinář označí jako minulý (cron / editor). */
function webinarEndEpochMsPrague(w: {
  year: number;
  monthNum?: number;
  day?: number;
  time?: string;
}): number {
  return webinarStartEpochMsPrague(w) + webinarDefaultDurationMinutes(w as any) * 60 * 1000;
}

/** Po skončení akce neposílat „potvrzení registrace“ s termínem a live odkazem (např. přístup k dotazníku ze záznamu). */
function isWebinarEventAlreadyPastForRegistration(
  webinarFromKv: Record<string, unknown> | undefined,
  merged: {
    day: number;
    monthNum: number;
    year: number;
    time: string;
    monthName: string;
    title: string;
  },
): boolean {
  if (webinarFromKv && webinarFromKv.isPast === true) return true;
  const hasSchedule =
    Number.isFinite(merged.day) &&
    Number.isFinite(merged.monthNum) &&
    Number.isFinite(merged.year);
  if (!hasSchedule) return false;
  const w = {
    ...(webinarFromKv || {}),
    year: merged.year,
    monthNum: merged.monthNum,
    day: merged.day,
    time: merged.time,
  } as Record<string, unknown>;
  return webinarEndEpochMsPrague(w as any) < Date.now();
}

async function markPastWebinarsInCollection(): Promise<{ updated: number }> {
  const items = (await getCollection(WEBINARS_KEY)) as any[];
  const nowMs = Date.now();
  let updated = 0;
  const next = items.map((w: any) => {
    if (!w?.id || w.isPast) return w;
    const endMs = webinarEndEpochMsPrague(w);
    if (endMs < nowMs) {
      updated++;
      return { ...w, isPast: true, updatedAt: new Date().toISOString() };
    }
    return w;
  });
  if (updated > 0) await saveCollection(WEBINARS_KEY, next);
  return { updated };
}

function webinarReminderMorningKey(webinarId: string, emailHash: string): string {
  return `webinar_rem_morning_${webinarId}_${emailHash}`;
}
function webinarReminderT30Key(webinarId: string, emailHash: string): string {
  return `webinar_rem_t30_${webinarId}_${emailHash}`;
}

function remEscHtmlReminder(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Logo v hlavičce všech Mandrill e-mailů (veřejný soubor v Supabase Storage).
 * Volitelně: secret EMAIL_HEADER_LOGO_URL (jiná absolutní URL).
 */
function webinarEmailHeaderLogoAbsoluteUrl(): string {
  const fromEnv = Deno.env.get('EMAIL_HEADER_LOGO_URL')?.trim();
  if (fromEnv) return fromEnv;
  return 'https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/logo_vividbooks.png';
}

/** Logo v hlavičce: původně 60px, +10 % = 66px. */
const WEBINAR_EMAIL_HEADER_LOGO_PX = 66;

/**
 * Banner dvppzdarma.cz v patičce webinářových e-mailů.
 * Veřejně: /email-dvppzdarma-banner.png na PUBLIC_SITE_URL, nebo secret EMAIL_WEBINAR_DVPP_BANNER_URL.
 */
function webinarEmailDvppPromoBannerAbsoluteUrl(): string {
  const fromEnv = Deno.env.get('EMAIL_WEBINAR_DVPP_BANNER_URL')?.trim();
  if (fromEnv) return fromEnv;
  return `${normalizePublicSiteOrigin(getPublicSiteOrigin())}/email-dvppzdarma-banner.png`;
}

/** Obrázek pod obsahem, nad šedým patičkovým blokem — odkaz na dvppzdarma.cz. */
function webinarEmailDvppPromoBannerRow(): string {
  const esc = remEscHtmlReminder;
  const imgUrl = esc(webinarEmailDvppPromoBannerAbsoluteUrl());
  const href = esc('https://dvppzdarma.cz');
  return `<tr><td style="padding:0;line-height:0;font-size:0;">
<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;border:0;">
<img src="${imgUrl}" alt="dvppzdarma.cz — záznamy DVPP webinářů s možností certifikátu" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;margin:0;" />
</a>
</td></tr>`;
}

/** Vycentrované logo + podnadpis (uppercase v CSS u příjemce). */
function webinarEmailBrandedHeaderRow(
  subtitlePlain: string,
  style?: { headerPadding?: string; headerRadius?: string },
): string {
  const esc = remEscHtmlReminder;
  const logoSrc = esc(webinarEmailHeaderLogoAbsoluteUrl());
  const site = esc(normalizePublicSiteOrigin(getPublicSiteOrigin()));
  const sub = esc(subtitlePlain);
  const padding = style?.headerPadding ?? '22px 24px 20px';
  const radius = style?.headerRadius ?? '12px 12px 0 0';
  const w = WEBINAR_EMAIL_HEADER_LOGO_PX;
  return `<tr><td class="dm-header" style="background:#001161;padding:${padding};border-radius:${radius};text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 12px;">
<a href="${site}" style="text-decoration:none;border:0;display:inline-block;">
<img src="${logoSrc}" alt="Vividbooks" width="${w}" style="display:block;margin:0 auto;width:${w}px;max-width:${w}px;height:auto;border:0;outline:none;" />
</a>
</td></tr><tr><td align="center" style="padding:0;">
<p style="margin:0;color:rgba(255,255,255,0.65);font-size:11px;text-transform:uppercase;letter-spacing:2px;">${sub}</p>
</td></tr></table>
</td></tr>`;
}

/** Častá křestní jména → vokativ (malými písmeny, NFC). Doplňuje se o suffixová pravidla níže. */
const CZECH_FIRST_NAME_VOCATIVE_MAP: Record<string, string> = {
  'petr': 'petře',
  'jan': 'jane',
  'honza': 'honzo',
  'pavel': 'pavle',
  'tomáš': 'tomáši',
  'lukáš': 'lukáši',
  'martin': 'martine',
  'jakub': 'jakube',
  'matěj': 'matěji',
  'ondřej': 'ondřeji',
  'michal': 'michale',
  'karel': 'karle',
  'david': 'davide',
  'adam': 'adame',
  'josef': 'josefe',
  'jiří': 'jiří',
  'vítek': 'vítku',
  'vitek': 'vítku',
  'zdeněk': 'zdeňku',
  'františek': 'františku',
  'radek': 'radku',
  'raděk': 'radku',
  'dominik': 'dominiku',
  'patrik': 'patriku',
  'daniel': 'danieli',
  'jindřich': 'jindřichu',
  'roman': 'romane',
  'marie': 'marie',
  'jana': 'jano',
  'petra': 'petro',
  'eva': 'evo',
  'anna': 'anno',
  'lenka': 'lenko',
  'michaela': 'michaelo',
  'klára': 'kláro',
  'václav': 'václave',
  'filip': 'filipe',
  'matyáš': 'matyáši',
  'štěpán': 'štěpáne',
  'vojtěch': 'vojtěchu',
  'dobrý den': 'dobrý den',
  'dobry den': 'dobrý den',
};

function czechFirstNameVocativeCapitalize(original: string, vocativeLower: string): string {
  if (!vocativeLower) return original;
  const t = original.trim();
  const first = t[0];
  if (first && first === first.toUpperCase() && first.toLowerCase() !== first.toUpperCase()) {
    return vocativeLower.charAt(0).toUpperCase() + vocativeLower.slice(1);
  }
  return vocativeLower;
}

/** 5. pád křestního jména pro „Ahoj …“ (e-maily). Heuristiky + mapa; neznámé jméno vrátí beze změny. */
function czechFirstNameVocative(firstName: string): string {
  const raw = String(firstName || '').trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase().normalize('NFC');
  if (lower === 'dobrý den' || lower === 'dobry den') return raw;

  const mapped = CZECH_FIRST_NAME_VOCATIVE_MAP[lower];
  if (mapped) return czechFirstNameVocativeCapitalize(raw, mapped);

  if (lower.endsWith('ěk')) {
    return czechFirstNameVocativeCapitalize(raw, lower.replace(/ěk$/, 'ňku'));
  }
  if (lower.endsWith('ek')) {
    return czechFirstNameVocativeCapitalize(raw, `${lower.slice(0, -2)}ku`);
  }
  if (lower.endsWith('nik')) {
    return czechFirstNameVocativeCapitalize(raw, `${lower.slice(0, -3)}niku`);
  }
  if (lower.endsWith('ík')) {
    return czechFirstNameVocativeCapitalize(raw, `${lower.slice(0, -2)}íku`);
  }
  if (lower.endsWith('ik') && !lower.endsWith('ník') && !lower.endsWith('ík')) {
    return czechFirstNameVocativeCapitalize(raw, `${lower.slice(0, -2)}iku`);
  }
  if (lower.endsWith('áš')) {
    return czechFirstNameVocativeCapitalize(raw, `${lower.slice(0, -1)}ši`);
  }
  if (lower.endsWith('artin')) {
    return czechFirstNameVocativeCapitalize(raw, `${lower.slice(0, -2)}ine`);
  }
  if (lower.endsWith('a') && lower.length >= 3 && !lower.endsWith('ia')) {
    return czechFirstNameVocativeCapitalize(raw, `${lower.slice(0, -1)}o`);
  }
  return raw;
}

/** 2. pád měsíce (9. dubna …) — používá monthNum z CMS, ne nominativ z monthName. */
function webinarMonthGenitiveCs(monthNum: number): string {
  const g = [
    '', 'ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
  ];
  return monthNum >= 1 && monthNum <= 12 ? g[monthNum] : '';
}

function formatWebinarReminderScheduleLine(w: any): string {
  const d = w.day || 1;
  const y = w.year;
  const mo = w.monthNum;
  const time = String(w.time || '18:00').trim() || '18:00';
  const monthGen = typeof mo === 'number' && mo >= 1 && mo <= 12 ? webinarMonthGenitiveCs(mo) : '';
  if (monthGen) return `${d}. ${monthGen} ${y} v ${time}`;
  const raw = String(w.monthName || '').trim();
  return `${d}. ${raw.toLowerCase()} ${y} v ${time}`;
}

/** Náhled + název + termín + lektor (stejná logika jako potvrzovací mail, bez kapitálkových labelů). */
function buildWebinarReminderVisualCard(w: any): string {
  const esc = remEscHtmlReminder;
  const lecturerResolved = String(w.lecturer || '').trim();
  const coverRaw = String(w.coverImage || '').trim();
  const coverImgUrl = /^https?:\/\//i.test(coverRaw) ? coverRaw : '';
  const titleEsc = esc(String(w.title || ''));
  const whenLine = esc(formatWebinarReminderScheduleLine(w));
  const lecturerBlock = lecturerResolved
    ? `<p style="margin:0;font-size:15px;color:#334155;line-height:1.5;">Lektor: ${esc(lecturerResolved)}</p>`
    : '';
  const coverBlock = coverImgUrl
    ? `<img src="${esc(coverImgUrl)}" alt="${titleEsc}" width="520" style="width:100%;max-width:520px;height:auto;border-radius:12px 12px 0 0;display:block;border:0;margin:0;" />`
    : '';
  const titleBlock = !coverImgUrl
    ? `<p style="margin:0 0 14px;font-size:20px;font-weight:800;color:#001161;line-height:1.35;">${titleEsc}</p>`
    : `<p style="margin:0 0 8px;font-size:18px;font-weight:800;color:#001161;line-height:1.35;">${titleEsc}</p>`;
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:#f8fafc;padding:0;">
${coverBlock}
<div style="padding:22px 24px 24px;">
${titleBlock}
<p style="margin:0 0 6px;font-size:16px;color:#334155;line-height:1.5;">${whenLine}</p>
${lecturerBlock}
</div>
</td></tr>
</table>`;
}

function buildSurveyEmailCtaBlock(surveyPageUrl: string | null | undefined): string {
  if (!surveyPageUrl) return '';
  const href = remEscHtmlReminder(surveyPageUrl);
  return `<table class="dm-survey-box" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;border-radius:14px;background:#eef2f8;border:1px solid #e2e8f0;">
<tr><td style="padding:20px 22px;">
<p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.55;">Co byste chtěli na webináři probrat? Vyplňte 3 krátké otázky a lektor na ně přímo naváže.</p>
<a href="${href}" style="display:inline-block;background:#ffffff;color:#001161;font-weight:700;font-size:14px;padding:10px 22px;border-radius:100px;text-decoration:none;border:2px solid #001161;">Chci ovlivnit obsah</a>
</td></tr>
</table>`;
}

/** Před webinářem: `?dotaznik=1` — ovlivnění obsahu (bez DVPP kvízu v URL). */
function buildWebinarSurveyInviteUrl(baseUrl: string, w: any, cleanEmail: string): string | null {
  if (resolvePreWebinarSurveyQuestionsFromItem(w).length === 0) return null;
  const slug = String(w.slug || w.id || '').trim() || String(w.id);
  const origin = String(baseUrl || '').replace(/\/$/, '');
  return `${origin}/webinar/${encodeURIComponent(slug)}?dotaznik=1&email=${encodeURIComponent(cleanEmail)}`;
}

/** Po webináři: `/webinar/.../dvpp-dotaznik` — DVPP + dotazník (stejné jako `?dvppDotaznik=1` na klientu). */
function buildWebinarDvppDotaznikUrl(baseUrl: string, w: any, cleanEmail: string): string | null {
  if (resolveSurveyQuestionsFromWebinarItem(w).length === 0) return null;
  const slug = String(w.slug || w.id || '').trim() || String(w.id);
  const origin = String(baseUrl || '').replace(/\/$/, '');
  return `${origin}/webinar/${encodeURIComponent(slug)}/dvpp-dotaznik?email=${encodeURIComponent(cleanEmail)}`;
}

/** Stejné jako `matchDvppVideo` ve WebinaryPastPanel — párování webináře k záznamu v KV `dvpp-videos`. */
function normWebinarDvppMatch(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matchDvppVideoForWebinar(webinar: any, dvppVideos: any[]): any | null {
  if (!dvppVideos?.length) return null;
  const wSlug = normWebinarDvppMatch(String(webinar.slug || webinar.id || ''));
  const wTitle = normWebinarDvppMatch(String(webinar.title || ''));
  const bySlug = dvppVideos.find((v: any) =>
    normWebinarDvppMatch(String(v.slug || v.id || '')) === wSlug,
  );
  if (bySlug) return bySlug;
  const byTitle = dvppVideos.find((v: any) => {
    const vt = normWebinarDvppMatch(String(v.name || v.title || ''));
    return wTitle.length > 5 && (
      vt.includes(wTitle.slice(0, Math.floor(wTitle.length * 0.7))) ||
      wTitle.includes(vt.slice(0, Math.floor(vt.length * 0.7)))
    );
  });
  return byTitle ?? null;
}

/** Který webinář patří k danému DVPP záznamu (pro ověření `webinar_reg_*`). */
function findWebinarIdForDvppVideoId(videoId: string, webinars: any[], dvppVideos: any[]): string | null {
  const vid = String(videoId).trim();
  if (!vid) return null;
  const direct = webinars.find((w: any) => String(w?.id) === vid);
  if (direct) return String(direct.id);
  for (const w of webinars) {
    const m = matchDvppVideoForWebinar(w, dvppVideos);
    if (m && String(m.id) === vid) return String(w.id);
  }
  return null;
}

/** Celý záznam webináře párovaného k DVPP záznamu (certifikát / dotazník na `/webinar/…/dvpp-dotaznik`). */
function findWebinarRecordForDvppVideo(video: any, webinars: any[], allDvppVideos: any[]): any | null {
  const vid = String(video?.id ?? '').trim();
  if (!vid) return null;
  const direct = webinars.find((w: any) => String(w?.id) === vid);
  if (direct) return direct;
  for (const w of webinars) {
    const m = matchDvppVideoForWebinar(w, allDvppVideos);
    if (m && String(m.id) === vid) return w;
  }
  return null;
}

/**
 * Sloučí z KV uložené DVPP video s údaji o certifikátu/dotazníku z párovaného webináře (admin).
 * Bez toho `certificateLinkMode: survey` z webináře na klientovi chybí a URL používá špatný slug.
 */
function certificateSurveyModeFromWebinarAndVideo(w: any, v: any): boolean {
  if (w?.certificateLinkMode === 'survey') return true;
  if (w?.certificateLinkMode === 'external') return false;
  return v?.certificateLinkMode === 'survey';
}

function enrichDvppVideosWithWebinarCertificateFields(videos: any[], webinars: any[]): any[] {
  if (!Array.isArray(videos) || videos.length === 0) return videos;
  const webinarsArr = Array.isArray(webinars) ? webinars : [];
  return videos.map((v) => {
    const w = findWebinarRecordForDvppVideo(v, webinarsArr, videos);
    if (!w) return v;
    const survey = certificateSurveyModeFromWebinarAndVideo(w, v);
    return {
      ...v,
      certificateLinkMode: survey ? 'survey' : 'external',
      certificateUrl: String(w.certificateUrl ?? v.certificateUrl ?? ''),
      greyButtonText: String(w.greyButtonText || v.greyButtonText || 'Certifikát DVPP'),
      webinarSlugForSurvey: String(w.slug || w.id),
      surveyRequireFullRegistration: w.surveyRequireFullRegistration === true,
    };
  });
}

/**
 * Veřejná stránka záznamu (přehrávač + info): `/webinare/zaznam/:id` — `DvppVideoDetailPage`.
 * ID bere z párovaného záznamu v `dvpp-videos`, jinak z `webinar.id` (admin často ukládá stejné id).
 * Volitelně `?email=&from=email` — e-mail pro kontext; `from=email` znamená odkaz z follow-up mailu (odemčení záznamu na klientu).
 */
async function resolveWebinarZaznamPageUrl(origin: string, w: any, opts?: { email?: string }): Promise<string> {
  const base = String(origin || '').replace(/\/$/, '');
  let dvppVideos: any[] = [];
  try {
    const data: any = await kv.get(DVPP_VIDEOS_KEY);
    dvppVideos = Array.isArray(data?.videos) ? data.videos : [];
  } catch {
    dvppVideos = [];
  }
  const matched = matchDvppVideoForWebinar(w, dvppVideos);
  const zaznamId = matched?.id != null && String(matched.id).trim()
    ? String(matched.id).trim()
    : String(w?.id ?? '').trim();
  if (!zaznamId) {
    const slug = String(w.slug || w.id || '').trim() || 'webinar';
    return `${base}/webinar/${encodeURIComponent(slug)}`;
  }
  let url = `${base}/webinare/zaznam/${encodeURIComponent(zaznamId)}`;
  const em = String(opts?.email || '').trim().toLowerCase();
  if (em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    const qs = new URLSearchParams();
    qs.set('email', em);
    qs.set('from', 'email');
    url += `?${qs.toString()}`;
  }
  return url;
}

/** Ověření přístupu ke záznamu podle e-mailu (registrace na živý webinář nebo u záznamu). */
async function handleDvppRecordingAccessGet(c: Context) {
  try {
    const videoId = String(c.req.query('videoId') || '').trim();
    const cleanEmail = String(c.req.query('email') || '').trim().toLowerCase();
    if (!videoId || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return c.json({ access: false, source: null }, 400);
    }
    const webinars = await getCollection(WEBINARS_KEY);
    let dvppVideos: any[] = [];
    try {
      const data: any = await kv.get(DVPP_VIDEOS_KEY);
      dvppVideos = Array.isArray(data?.videos) ? data.videos : [];
    } catch {
      dvppVideos = [];
    }
    const webinarId = findWebinarIdForDvppVideoId(videoId, webinars, dvppVideos);
    let source: 'webinar' | 'dvpp' | null = null;
    if (webinarId) {
      const reg = await kv.get(`webinar_reg_${webinarId}_${cleanEmail}`);
      if (reg) source = 'webinar';
    }
    if (!source) {
      const dvppReg = await kv.get(`dvpp_video_reg_${videoId}_${cleanEmail}`);
      if (dvppReg) source = 'dvpp';
    }
    return c.json({ access: !!source, source });
  } catch (e: any) {
    console.log(`[dvpp-recording-access] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
}
app.get('/make-server-93a20b6f/public/dvpp-recording-access', handleDvppRecordingAccessGet);
app.get('/public/dvpp-recording-access', handleDvppRecordingAccessGet);

/**
 * 4. pád pro „Děkujeme za Váš zájem o …“ — z předmětů v CMS, tagů, názvu a doprovodných polí.
 * Dříve: prázdné `relatedSubjects` → vždy „matematiku“ (vedlo k nesmyslu u ne-matematických webinářů).
 * Teď: heuristika z celého kontextu; neznámé → null → jen „Děkujeme za Váš zájem!“
 */
function followupThankYouInterestAccusative(w: any): string | null {
  const parts: string[] = [];
  if (Array.isArray(w?.relatedSubjects)) {
    for (const s of w.relatedSubjects) parts.push(String(s));
  }
  if (Array.isArray(w?.tags)) {
    for (const t of w.tags) parts.push(String(t));
  }
  if (w?.title) parts.push(String(w.title));
  if (w?.subtitle) parts.push(String(w.subtitle));
  if (w?.targetAudience) parts.push(String(w.targetAudience));

  const blob = parts.join(' ').trim();
  if (!blob) return null;

  const lower = blob.toLowerCase();

  /* Značky / produkty — před obecnými předměty (nadpis často obsahuje „Vividboardem“ apod.) */
  if (lower.includes('vividboard')) return 'Vividboard';
  if (lower.includes('vividbooks')) return 'Vividbooks';

  if (lower.includes('matematika')) return 'matematiku';
  if (lower.includes('fyzika')) return 'fyziku';
  if (lower.includes('chemie')) return 'chemii';
  if (lower.includes('biologie')) return 'biologii';
  if (lower.includes('informatika')) return 'informatiku';
  if (lower.includes('češt') || lower.includes('cestin')) return 'češtinu';
  if (lower.includes('angličt') || lower.includes('anglict')) return 'angličtinu';
  if (lower.includes('zeměpis') || lower.includes('zeme')) return 'zeměpis';
  if (lower.includes('dějepis') || lower.includes('dejepis')) return 'dějepis';
  if (lower.includes('přírodopis') || lower.includes('prirodopis')) return 'přírodopis';
  if (lower.includes('hudební') || lower.includes('hudebn')) return 'hudební výchovu';
  if (lower.includes('výtvarka') || lower.includes('výtvar')) return 'výtvarnou výchovu';
  if (lower.includes('tělesn')) return 'tělesnou výchovu';

  return null;
}

/**
 * Po webináři — pořadí: vizuál, poděkování (oranžový blok), záznam, trial, DVPP dotazník, shrnutí obsahu.
 * Používá se u testovacího odeslání z administrace.
 */
function buildWebinarPostFollowupEmailHtml(opts: {
  w: any;
  webinarTitle: string;
  learningsHtml: string;
  /** Primární CTA — stránka záznamu na webu (`/webinare/zaznam/...`). */
  recordingUrl: string;
  trialUrl: string;
  surveyQuizUrl: string | null;
  showCertificateCta: boolean;
  certificateLinkMode: 'external' | 'survey';
  certificateExternalUrl: string;
  certificateButtonLabel: string;
  /** `test` = náhled z administrace; `bulk` = hromadné odeslání registrovaným. */
  emailKind?: 'test' | 'bulk';
}): string {
  const esc = remEscHtmlReminder;
  const titleEsc = esc(opts.webinarTitle);
  const visualCard = buildWebinarReminderVisualCard(opts.w);
  const interestAcc = followupThankYouInterestAccusative(opts.w);
  const thanksLine = interestAcc
    ? `Děkujeme za Váš zájem o ${esc(interestAcc)}!`
    : 'Děkujeme za Váš zájem!';

  const orangeBlock = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-radius:14px;overflow:hidden;">
<tr><td style="background:#f97316;padding:24px 26px;">
<p style="margin:0;font-size:16px;color:#0f172a;line-height:1.65;text-align:center;">
Vážení učitelé,<br/>
včera proběhl webinář: <strong>${titleEsc}</strong>.<br/>
${thanksLine}
</p>
</td></tr></table>`;

  const recordingBlock = `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
<tr><td align="center" style="padding:0;">
<a href="${esc(opts.recordingUrl)}" style="display:inline-block;background:#facc15;color:#0f172a;font-weight:800;font-size:15px;padding:16px 28px;border-radius:100px;text-decoration:underline;">Otevřít záznam webináře</a>
</td></tr></table>`;

  const trialBlock = `<p style="margin:0 0 22px;font-size:15px;text-align:center;line-height:1.5;">
<a href="${esc(opts.trialUrl)}" style="color:#2563eb;font-weight:700;text-decoration:underline;">Vyzkoušet Vividbooks na 14 dní zdarma</a>
</p>`;

  const certBtnEsc = esc((opts.certificateButtonLabel || 'Certifikát DVPP').trim() || 'Certifikát DVPP');
  let certificateBlock = '';
  if (opts.showCertificateCta) {
    if (opts.certificateLinkMode === 'survey') {
      if (opts.surveyQuizUrl) {
        certificateBlock = `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;">
<tr><td align="center" style="padding:0;">
<a href="${esc(opts.surveyQuizUrl)}" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:800;font-size:14px;padding:12px 22px;border-radius:100px;text-decoration:none;">${certBtnEsc} (Dotazník)</a>
</td></tr></table>`;
      } else {
        certificateBlock = `<p style="margin:0 0 22px;font-size:13px;color:#64748b;text-align:center;">Odkaz na dotazník (certifikát DVPP) doplníte po uložení webináře a nastavení otázek v administraci.</p>`;
      }
    } else if (opts.certificateExternalUrl) {
      certificateBlock = `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;">
<tr><td align="center" style="padding:0;">
<a href="${esc(opts.certificateExternalUrl)}" style="display:inline-block;background:#374151;color:#ffffff;font-weight:800;font-size:14px;padding:12px 22px;border-radius:100px;text-decoration:none;">${certBtnEsc}</a>
</td></tr></table>`;
    }
  }

  const learningsBlock = opts.learningsHtml.trim()
    ? `<div style="margin:0 0 8px;padding:20px 22px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
<h2 style="margin:0 0 14px;font-size:17px;font-weight:800;color:#001161;">Co jsme se dozvěděli na webináři</h2>
<div style="font-size:15px;color:#334155;line-height:1.6;">${opts.learningsHtml}</div>
</div>`
    : `<p style="margin:0 0 8px;font-size:15px;color:#64748b;">(Blok „Co jsme se dozvěděli na webináři“ zatím není — vygenerujte a uložte v administraci.)</p>`;

  const kind = opts.emailKind === 'bulk' ? 'bulk' : 'test';
  const footerNote =
    kind === 'bulk'
      ? 'Tento e-mail vám posíláme, protože jste se registrovali na webinář Vividbooks. Odkazy na záznam a dotazník jsou přizpůsobené vaší registraci.'
      : 'Tento e-mail je testovací odeslaný z administrace.';

  return `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8">${WEBINAR_EMAIL_DARK_HEAD}</head>
<!-- vb-post-followup-email-template: v6 (logo ze Supabase Storage; deploy make-server-93a20b6f) -->
<body class="dm-rem-body" style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f6fa;padding:24px;">
<table class="dm-rem-wrap" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table class="dm-rem-card dm-card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,17,97,0.08);">
${webinarEmailBrandedHeaderRow('Záznam webináře')}
<tr><td class="dm-rem-content" style="padding:26px 26px 8px;">
${visualCard}
${orangeBlock}
${recordingBlock}
${trialBlock}
${certificateBlock}
${learningsBlock}
</td></tr>
${webinarEmailDvppPromoBannerRow()}
<tr><td style="background:#f8f9fc;padding:20px 28px;border-top:1px solid #edf2f7;">
<p style="margin:0;font-size:12px;color:#a0aec0;line-height:1.6;">${esc(footerNote)}<br>
&copy; ${new Date().getFullYear()} Vividbooks</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const FOLLOWUP_TRACK_KV_PREFIX = 'webinar_post_followup_track_v1_';

type FollowupRecipientTrack = {
  sentAt?: string;
  openedAt?: string;
  openCount?: number;
};

type FollowupCampaignState = {
  lastBulkAt: string | null;
  lastBulkSucceeded: number | null;
  recipients: Record<string, FollowupRecipientTrack>;
};

function normalizeFollowupState(raw: unknown): FollowupCampaignState {
  if (!raw || typeof raw !== 'object') {
    return { lastBulkAt: null, lastBulkSucceeded: null, recipients: {} };
  }
  const o = raw as Record<string, unknown>;
  const rec = o.recipients;
  const recipients: Record<string, FollowupRecipientTrack> = {};
  if (rec && typeof rec === 'object') {
    for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const t = v as Record<string, unknown>;
      const emailKey = String(k).toLowerCase().trim();
      if (!emailKey) continue;
      recipients[emailKey] = {
        sentAt: typeof t.sentAt === 'string' ? t.sentAt : undefined,
        openedAt: typeof t.openedAt === 'string' ? t.openedAt : undefined,
        openCount: typeof t.openCount === 'number' ? t.openCount : undefined,
      };
    }
  }
  return {
    lastBulkAt: typeof o.lastBulkAt === 'string' ? o.lastBulkAt : null,
    lastBulkSucceeded: typeof o.lastBulkSucceeded === 'number' ? o.lastBulkSucceeded : null,
    recipients,
  };
}

async function getFollowupTrackingState(webinarId: string): Promise<FollowupCampaignState> {
  const key = `${FOLLOWUP_TRACK_KV_PREFIX}${webinarId}`;
  const raw = await kv.get(key);
  return normalizeFollowupState(raw);
}

async function saveFollowupTrackingState(webinarId: string, state: FollowupCampaignState): Promise<void> {
  const key = `${FOLLOWUP_TRACK_KV_PREFIX}${webinarId}`;
  await kv.set(key, state);
}

async function mergeFollowupOpenInKv(webinarId: string, email: string): Promise<void> {
  const clean = email.toLowerCase().trim();
  if (!clean) return;
  const state = await getFollowupTrackingState(webinarId);
  const prev = state.recipients[clean] || {};
  const now = new Date().toISOString();
  state.recipients[clean] = {
    ...prev,
    openedAt: prev.openedAt || now,
    openCount: (prev.openCount || 0) + 1,
  };
  await saveFollowupTrackingState(webinarId, state);
}

function followupEarliestIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

/**
 * Doplní KV stav z Mandrill messages/search (odeslání / otevření).
 * Filtr: metadata webinar_id (+ vb_kind), případně předmět obsahuje „Záznam webináře“ a začátek názvu webináře (starší odeslání bez metadat).
 */
async function syncFollowupTrackingFromMandrillSearch(
  webinarId: string,
  w: Record<string, unknown>,
): Promise<{ matchedMessages: number; matchedRecipients: number }> {
  const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
  if (!mandrillKey) throw new Error('MANDRILL_API_KEY missing');

  const state = await getFollowupTrackingState(webinarId);
  const titleT = String((w as any).title || '').trim();
  const titleProbe = titleT.slice(0, 28);

  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - 120);
  const df = dateFrom.toISOString().slice(0, 10);
  const dt = dateTo.toISOString().slice(0, 10);

  const res = await fetch('https://mandrillapp.com/api/1.0/messages/search.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: mandrillKey,
      query: 'Záznam webináře',
      date_from: df,
      date_to: dt,
      limit: 1000,
    }),
  });
  const data = await res.json();
  if (!Array.isArray(data)) {
    const msg =
      typeof data === 'object' && data && (data as any).message
        ? String((data as any).message)
        : 'Mandrill search: neplatná odpověď';
    throw new Error(msg);
  }

  const aggregated = new Map<string, { sentAt?: string; openedAt?: string; openCount: number }>();
  let matchedMessages = 0;
  const widTarget = String(webinarId).trim();

  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const msg = row as Record<string, unknown>;
    const mraw = msg.metadata;
    const meta = mraw && typeof mraw === 'object' ? (mraw as Record<string, unknown>) : {};
    const wid = String(meta.webinar_id || '').trim();
    const kind = String(meta.vb_kind || '');
    const byMeta =
      wid === widTarget &&
      (kind === '' || kind === 'post_followup_bulk' || kind === 'post_followup_test');

    const subj = String(msg.subject || '');
    const bySubject =
      titleProbe.length >= 3 &&
      subj.includes('Záznam webináře') &&
      subj.includes(titleProbe);

    if (!byMeta && !bySubject) continue;

    matchedMessages++;

    const email = String(msg.email || '')
      .toLowerCase()
      .trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    const tsSec = typeof msg.ts === 'number' ? msg.ts : null;
    const sentAt = tsSec != null ? new Date(tsSec * 1000).toISOString() : undefined;

    let openedAt: string | undefined;
    let openCount = typeof msg.opens === 'number' ? msg.opens : 0;
    const details = Array.isArray(msg.opens_detail) ? msg.opens_detail : [];
    if (details.length > 0) {
      const tss: number[] = [];
      for (const d of details) {
        if (d && typeof d === 'object' && typeof (d as Record<string, unknown>).ts === 'number') {
          tss.push((d as Record<string, unknown>).ts as number);
        }
      }
      if (tss.length) {
        const minTs = Math.min(...tss);
        openedAt = new Date(minTs * 1000).toISOString();
        openCount = Math.max(openCount, details.length);
      }
    }

    const prevAgg = aggregated.get(email) || { openCount: 0 };
    aggregated.set(email, {
      sentAt: followupEarliestIso(prevAgg.sentAt, sentAt),
      openedAt: followupEarliestIso(prevAgg.openedAt, openedAt),
      openCount: Math.max(prevAgg.openCount, openCount),
    });
  }

  for (const [email, v] of aggregated) {
    const prev = state.recipients[email] || {};
    state.recipients[email] = {
      ...prev,
      sentAt: followupEarliestIso(prev.sentAt, v.sentAt),
      openedAt: followupEarliestIso(prev.openedAt, v.openedAt),
      openCount: Math.max(prev.openCount || 0, v.openCount),
    };
  }

  await saveFollowupTrackingState(webinarId, state);

  return {
    matchedMessages,
    matchedRecipients: aggregated.size,
  };
}

async function sendWebinarPostFollowupEmailToRecipient(opts: {
  webinarId: string;
  w: Record<string, unknown>;
  merged: Record<string, unknown>;
  learningsHtml: string;
  toEmail: string;
  toName: string;
  emailKind: 'test' | 'bulk';
}): Promise<{ ok: boolean; detail?: string }> {
  const { webinarId, w, merged, learningsHtml, toEmail, toName, emailKind } = opts;
  const slug = String((w as any).slug || (w as any).id || '').trim() || String(webinarId);
  const origin = getPublicSiteOrigin();
  const quizPreviewLabels = mapPostWebinarQuizQuestionsForSurvey(merged).map((q) => q.label);
  let surveyQuizUrl = buildWebinarDvppDotaznikUrl(origin, merged, toEmail);
  if (!surveyQuizUrl && quizPreviewLabels.length > 0) {
    surveyQuizUrl = `${origin}/webinar/${encodeURIComponent(slug)}/dvpp-dotaznik?email=${encodeURIComponent(toEmail)}`;
  }

  const certificateLinkMode = (merged as any).certificateLinkMode === 'survey' ? 'survey' : 'external';
  const certificateExternalUrl = String((merged as any).certificateUrl || '').trim();
  const certificateButtonLabel = String((merged as any).greyButtonText || 'Certifikát DVPP').trim();
  const showCertificateCta = certificateLinkMode === 'survey'
    ? !!(surveyQuizUrl || quizPreviewLabels.length > 0)
    : !!certificateExternalUrl;

  const recordingUrlDefault = await resolveWebinarZaznamPageUrl(origin, w, { email: toEmail });
  const base = String(origin || '').replace(/\/$/, '');
  const devRec = String((merged as any).devFollowupRecordingUrl ?? (w as any).devFollowupRecordingUrl ?? '').trim();
  const recordingUrl = devRec
    ? /^https?:\/\//i.test(devRec)
      ? devRec
      : `${base}${devRec.startsWith('/') ? devRec : `/${devRec}`}`
    : recordingUrlDefault;

  let trialPath = String((merged as any).orangeButtonLink || '/vyzkousejte').trim();
  const devTrial = String((merged as any).devFollowupTrialUrl ?? (w as any).devFollowupTrialUrl ?? '').trim();
  if (devTrial) trialPath = devTrial;
  const trialUrl = /^https?:\/\//i.test(trialPath)
    ? trialPath
    : `${base}${trialPath.startsWith('/') ? trialPath : `/${trialPath}`}`;

  const html = buildWebinarPostFollowupEmailHtml({
    w,
    webinarTitle: String((w as any).title || 'Webinář'),
    learningsHtml,
    recordingUrl,
    trialUrl,
    surveyQuizUrl,
    showCertificateCta,
    certificateLinkMode,
    certificateExternalUrl,
    certificateButtonLabel,
    emailKind,
  });

  const titleShort = String((w as any).title || 'Webinář').slice(0, 60);
  const result = await sendMandrillHtmlResult({
    toEmail,
    toName: toName.trim() || toEmail.split('@')[0],
    subject: `${WEBINAR_EMAIL_SUBJECT_PREFIX}Záznam webináře: ${titleShort}`,
    html,
    metadata: {
      webinar_id: String(webinarId),
      vb_kind: emailKind === 'bulk' ? 'post_followup_bulk' : 'post_followup_test',
    },
  });
  return result.ok ? { ok: true } : { ok: false, detail: result.detail };
}

async function adminWebinarPostFollowupTestSendHandler(c: Context) {
  try {
    const body = await c.req.json();
    const webinarId = String(body?.webinarId || '').trim();
    const toEmail = String(body?.toEmail || '').toLowerCase().trim();
    if (!webinarId || !toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return c.json({ error: 'Chybí webinarId nebo platný toEmail.' }, 400);
    }

    const items = await getCollection(WEBINARS_KEY);
    const w = items.find((x: any) => String(x.id) === webinarId) as Record<string, unknown> | undefined;
    if (!w) return c.json({ error: 'Webinář nenalezen' }, 404);

    const learningsRaw = typeof body?.learningsHtml === 'string' && body.learningsHtml.trim()
      ? body.learningsHtml
      : String(w.postWebinarLearningsHtml || '');
    const learningsHtml = sanitizeWebinarLearningsHtml(learningsRaw);

    const merged: Record<string, unknown> = { ...w };
    if (Array.isArray(body?.postWebinarQuizQuestions)) {
      merged.postWebinarQuizQuestions = body.postWebinarQuizQuestions;
    }
    if (typeof body?.devFollowupRecordingUrl === 'string') {
      merged.devFollowupRecordingUrl = body.devFollowupRecordingUrl;
    }
    if (typeof body?.devFollowupTrialUrl === 'string') {
      merged.devFollowupTrialUrl = body.devFollowupTrialUrl;
    }

    const out = await sendWebinarPostFollowupEmailToRecipient({
      webinarId,
      w,
      merged,
      learningsHtml,
      toEmail,
      toName: toEmail.split('@')[0],
      emailKind: 'test',
    });
    if (!out.ok) {
      return c.json({ error: out.detail || 'Odeslání selhalo' }, 500);
    }
    return c.json({ ok: true, template: 'post-followup-v6' });
  } catch (e: any) {
    console.log(`[webinar-post-followup-test] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
}

/** Hromadné odeslání e-mailu se záznamem + dotazníkem všem registrovaným (KV `webinar_reg_{id}_`). */
async function adminWebinarPostFollowupBulkSendHandler(c: Context) {
  try {
    const body = await c.req.json();
    const webinarId = String(body?.webinarId || '').trim();
    if (!webinarId) {
      return c.json({ error: 'Chybí webinarId.' }, 400);
    }

    const items = await getCollection(WEBINARS_KEY);
    const w = items.find((x: any) => String(x.id) === webinarId) as Record<string, unknown> | undefined;
    if (!w) return c.json({ error: 'Webinář nenalezen' }, 404);

    const learningsRaw = typeof body?.learningsHtml === 'string' && body.learningsHtml.trim()
      ? body.learningsHtml
      : String(w.postWebinarLearningsHtml || '');
    const learningsHtml = sanitizeWebinarLearningsHtml(learningsRaw);

    const merged: Record<string, unknown> = { ...w };
    if (Array.isArray(body?.postWebinarQuizQuestions)) {
      merged.postWebinarQuizQuestions = body.postWebinarQuizQuestions;
    }

    const mailchimpTagOverride =
      typeof (body as any)?.mailchimpTag === 'string' ? String((body as any).mailchimpTag).trim() : '';

    const prefix = `webinar_reg_${webinarId}_`;
    const registrations = (await kv.getByPrefix(prefix)) as any[];
    const list = Array.isArray(registrations) ? registrations : [];
    const kvRecipients = list
      .map((r) => ({
        email: String(r?.email || '')
          .toLowerCase()
          .trim(),
        name: String(r?.name || '').trim(),
      }))
      .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));

    const mcData = await mailchimpFetchFollowupRecipientsForWebinar(
      w,
      mailchimpTagOverride || undefined,
    );
    const recipients = mergeKvAndMailchimpFollowupRecipients(kvRecipients, mcData.rows);

    if (recipients.length === 0) {
      const hint =
        kvRecipients.length === 0 && mcData.error
          ? ` ${mcData.error}`
          : kvRecipients.length === 0 && mcData.rows.length === 0
            ? ' Zkontrolujte tag v Mailchimpu (výchozí = tag u registrace, nebo zvolený tag v adminu).'
            : '';
      return c.json(
        {
          error:
            `Žádní příjemci s platným e-mailem (KV registrace + Mailchimp tag).${hint}`,
        },
        400,
      );
    }

    if (mcData.error) {
      console.log(
        `[webinar-post-followup-bulk] Mailchimp merge warning: ${mcData.error} — odesílám jen KV (${kvRecipients.length}) + dostupné z MC (${mcData.rows.length}).`,
      );
    }

    let sent = 0;
    const failures: { email: string; detail?: string }[] = [];
    const track = await getFollowupTrackingState(webinarId);
    const nowIso = new Date().toISOString();
    for (const rec of recipients) {
      const out = await sendWebinarPostFollowupEmailToRecipient({
        webinarId,
        w,
        merged,
        learningsHtml,
        toEmail: rec.email,
        toName: rec.name || rec.email.split('@')[0],
        emailKind: 'bulk',
      });
      if (out.ok) {
        sent++;
        const prev = track.recipients[rec.email] || {};
        track.recipients[rec.email] = {
          ...prev,
          sentAt: prev.sentAt || nowIso,
        };
      } else {
        failures.push({ email: rec.email, detail: out.detail });
      }
    }
    if (sent > 0) {
      track.lastBulkAt = nowIso;
      track.lastBulkSucceeded = sent;
      await saveFollowupTrackingState(webinarId, track);
    }

    const overlap =
      kvRecipients.length + mcData.rows.length - recipients.length;
    console.log(
      `[webinar-post-followup-bulk] webinarId=${webinarId} kv=${kvRecipients.length} mc=${mcData.rows.length} unique=${recipients.length} overlap≈${overlap} sent=${sent} failed=${failures.length}`,
    );
    return c.json({
      ok: failures.length === 0,
      sent,
      total: recipients.length,
      failed: failures.length,
      failures: failures.slice(0, 20),
      breakdown: {
        kvRegistrations: kvRecipients.length,
        mailchimpTagged: mcData.rows.length,
        mailchimpTag: mcData.tag || null,
        uniqueRecipients: recipients.length,
        overlapKvAndMailchimp: overlap > 0 ? overlap : 0,
        mailchimpError: mcData.error || null,
      },
    });
  } catch (e: any) {
    console.log(`[webinar-post-followup-bulk] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
}

app.post('/make-server-93a20b6f/admin/webinar-post-followup-test-send', adminWebinarPostFollowupTestSendHandler);
app.post('/admin/webinar-post-followup-test-send', adminWebinarPostFollowupTestSendHandler);
app.post('/make-server-93a20b6f/admin/webinar-post-followup-bulk-send', adminWebinarPostFollowupBulkSendHandler);
app.post('/admin/webinar-post-followup-bulk-send', adminWebinarPostFollowupBulkSendHandler);

async function adminWebinarPostFollowupTrackingHandler(c: Context) {
  try {
    const webinarId = String(c.req.param('webinarId') || '').trim();
    if (!webinarId) return c.json({ error: 'Chybí webinarId.' }, 400);
    const state = await getFollowupTrackingState(webinarId);
    return c.json({
      lastBulkAt: state.lastBulkAt,
      lastBulkSucceeded: state.lastBulkSucceeded,
      recipients: state.recipients,
    });
  } catch (e: any) {
    console.log(`[webinar-post-followup-tracking] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
}

app.get(
  '/make-server-93a20b6f/admin/webinar-post-followup-tracking/:webinarId',
  adminWebinarPostFollowupTrackingHandler,
);
app.get('/admin/webinar-post-followup-tracking/:webinarId', adminWebinarPostFollowupTrackingHandler);

async function adminWebinarPostFollowupMandrillSyncHandler(c: Context) {
  try {
    const webinarId = String(c.req.param('webinarId') || '').trim();
    if (!webinarId) return c.json({ error: 'Chybí webinarId.' }, 400);
    const items = await getCollection(WEBINARS_KEY);
    const w = items.find((x: any) => String(x.id) === String(webinarId)) as Record<string, unknown> | undefined;
    if (!w) return c.json({ error: 'Webinář nenalezen.' }, 404);
    const { matchedMessages, matchedRecipients } = await syncFollowupTrackingFromMandrillSearch(webinarId, w);
    const state = await getFollowupTrackingState(webinarId);
    return c.json({
      ok: true,
      matchedMessages,
      matchedRecipients,
      lastBulkAt: state.lastBulkAt,
      lastBulkSucceeded: state.lastBulkSucceeded,
      recipients: state.recipients,
    });
  } catch (e: any) {
    console.log(`[webinar-post-followup-mandrill-sync] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
}

app.post(
  '/make-server-93a20b6f/admin/webinar-post-followup-mandrill-sync/:webinarId',
  adminWebinarPostFollowupMandrillSyncHandler,
);
app.post('/admin/webinar-post-followup-mandrill-sync/:webinarId', adminWebinarPostFollowupMandrillSyncHandler);

/** Mandrill webhook: události „open“ u follow-up e-mailů (metadata webinar_id). Volitelný query ?key= = MANDRILL_WEBHOOK_SECRET. */
async function mandrillFollowupWebhookHandler(c: Context) {
  const webhookSecret = Deno.env.get('MANDRILL_WEBHOOK_SECRET');
  if (webhookSecret) {
    const q = c.req.query('key') || '';
    if (q !== webhookSecret) return c.text('Forbidden', 403);
  } else {
    console.warn('[mandrill-followup-webhook] MANDRILL_WEBHOOK_SECRET missing — webhook URL is not authenticated');
  }
  let raw = '';
  try {
    const ct = (c.req.header('content-type') || '').toLowerCase();
    if (ct.includes('application/x-www-form-urlencoded')) {
      const body = await c.req.parseBody();
      const me = (body as Record<string, unknown>)['mandrill_events'];
      raw = typeof me === 'string' ? me : '';
    } else {
      const j = await c.req.json();
      if (typeof j === 'object' && j && 'mandrill_events' in j) {
        raw = String((j as any).mandrill_events || '');
      } else if (typeof j === 'string') {
        raw = j;
      }
    }
  } catch {
    return c.text('Bad Request', 400);
  }
  let events: unknown[] = [];
  try {
    events = JSON.parse(raw) as unknown[];
  } catch {
    return c.text('Bad Request', 400);
  }
  if (!Array.isArray(events)) return c.text('OK', 200);
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const e = ev as Record<string, unknown>;
    if (String(e.event || '') !== 'open') continue;
    const msg = (e.msg && typeof e.msg === 'object' ? e.msg : e) as Record<string, unknown>;
    const email = String(msg.email || '')
      .toLowerCase()
      .trim();
    const meta = (msg.metadata && typeof msg.metadata === 'object'
      ? msg.metadata
      : {}) as Record<string, unknown>;
    const webinarId = String(meta.webinar_id || '').trim();
    const kind = String(meta.vb_kind || '');
    if (!email || !webinarId) continue;
    if (kind !== 'post_followup_bulk' && kind !== 'post_followup_test') continue;
    await mergeFollowupOpenInKv(webinarId, email);
  }
  return c.text('OK', 200);
}

app.post('/make-server-93a20b6f/webhooks/mandrill-followup', mandrillFollowupWebhookHandler);
app.post('/webhooks/mandrill-followup', mandrillFollowupWebhookHandler);

/** Počty příjemců hromadného follow-upu: KV + Mailchimp (stejný tag jako registrace), unikátní e-maily. */
async function adminWebinarPostFollowupRecipientPreviewHandler(c: Context) {
  try {
    const webinarId = c.req.param('webinarId');
    const items = await getCollection(WEBINARS_KEY);
    const w = items.find((x: any) => String(x.id) === String(webinarId)) as Record<string, unknown> | undefined;
    if (!w) return c.json({ error: 'Webinář nenalezen.' }, 404);

    const tagOverride =
      c.req.query('mailchimpTag')?.trim() || c.req.query('tag')?.trim() || '';

    const prefix = `webinar_reg_${webinarId}_`;
    const registrations = (await kv.getByPrefix(prefix)) as any[];
    const list = Array.isArray(registrations) ? registrations : [];
    const kvRecipients = list
      .map((r) => ({
        email: String(r?.email || '')
          .toLowerCase()
          .trim(),
        name: String(r?.name || '').trim(),
      }))
      .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));

    const mcData = await mailchimpFetchFollowupRecipientsForWebinar(w, tagOverride || undefined);
    const merged = mergeKvAndMailchimpFollowupRecipients(kvRecipients, mcData.rows);
    const overlap = kvRecipients.length + mcData.rows.length - merged.length;
    return c.json({
      kvCount: kvRecipients.length,
      mailchimpCount: mcData.rows.length,
      uniqueTotal: merged.length,
      overlapKvAndMailchimp: overlap > 0 ? overlap : 0,
      mailchimpTag: mcData.tag || null,
      mailchimpError: mcData.error || null,
    });
  } catch (e: any) {
    console.log(`[webinar-post-followup-preview] ${e.message}`);
    return c.json({ error: e.message || 'Chyba' }, 500);
  }
}

app.get(
  '/make-server-93a20b6f/admin/webinar-post-followup-recipient-preview/:webinarId',
  adminWebinarPostFollowupRecipientPreviewHandler,
);
app.get(
  '/admin/webinar-post-followup-recipient-preview/:webinarId',
  adminWebinarPostFollowupRecipientPreviewHandler,
);

async function resolveSurveyInviteUrlForRegistrant(
  w: any,
  cleanEmail: string,
  baseUrl: string,
): Promise<string | null> {
  const invite = buildWebinarSurveyInviteUrl(baseUrl, w, cleanEmail);
  if (!invite) return null;
  const answered = await kv.get(webinarSurveyAnswerKey(String(w.id), cleanEmail));
  return answered ? null : invite;
}

function buildWebinarReminderEmailFooter(): string {
  return `${webinarEmailDvppPromoBannerRow()}<tr><td style="background:#f8f9fc;padding:20px 28px;border-top:1px solid #edf2f7;">
<p style="margin:0;font-size:12px;color:#a0aec0;line-height:1.6;">
Tento e-mail byl odeslán automaticky jako připomínka webináře.<br>
&copy; ${new Date().getFullYear()} Vividbooks
</p>
</td></tr>`;
}

function buildWebinarReminderT30Email(
  w: any,
  firstName: string,
  liveUrl: string,
  surveyPageUrl?: string | null,
) {
  const firstNameEsc = remEscHtmlReminder(czechFirstNameVocative(firstName));
  const visualCard = buildWebinarReminderVisualCard(w);
  const surveyCta = buildSurveyEmailCtaBlock(surveyPageUrl ?? null);
  const liveHref = liveUrl.replace(/"/g, '&quot;');
  const footer = buildWebinarReminderEmailFooter();
  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8">${WEBINAR_EMAIL_DARK_HEAD}</head>
<body class="dm-rem-body" style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f6fa;padding:24px;">
<table class="dm-rem-wrap" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table class="dm-rem-card dm-card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,17,97,0.08);">
${webinarEmailBrandedHeaderRow('Za chvíli začínáme')}
<tr><td class="dm-rem-content" style="padding:28px 28px 0;">
<p class="dm-h1" style="margin:0 0 12px;font-size:18px;font-weight:800;color:#001161;">Za chvíli začíná webinář</p>
<p class="dm-text" style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.55;">Ahoj <strong class="dm-strong" style="color:#001161;">${firstNameEsc}</strong>,</p>
${visualCard}
${surveyCta}
<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
<tr><td style="padding:0;">
<a class="dm-rem-btn" href="${liveHref}" style="display:inline-block;background:#001161;color:#ffffff;font-weight:800;font-size:15px;padding:14px 28px;border-radius:100px;text-decoration:none;">Otevřít webinář</a>
<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;line-height:1.45;">${remEscHtmlReminder(liveUrl)}</p>
</td></tr></table>
</td></tr>
${footer}
</table></td></tr></table></body></html>`;
  return { html, subject: `${WEBINAR_EMAIL_SUBJECT_PREFIX}Za chvíli: ${w.title || 'webinář'}` };
}

function buildWebinarReminderMorningEmail(
  w: any,
  firstName: string,
  liveUrl: string,
  surveyPageUrl?: string | null,
) {
  const firstNameEsc = remEscHtmlReminder(czechFirstNameVocative(firstName));
  const visualCard = buildWebinarReminderVisualCard(w);
  const surveyCta = buildSurveyEmailCtaBlock(surveyPageUrl ?? null);
  const liveHref = liveUrl.replace(/"/g, '&quot;');
  const footer = buildWebinarReminderEmailFooter();
  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8">${WEBINAR_EMAIL_DARK_HEAD}</head>
<body class="dm-rem-body" style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f6fa;padding:24px;">
<table class="dm-rem-wrap" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table class="dm-rem-card dm-card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,17,97,0.08);">
${webinarEmailBrandedHeaderRow('Připomínka webináře')}
<tr><td class="dm-rem-content" style="padding:28px 28px 0;">
<p class="dm-h1" style="margin:0 0 12px;font-size:18px;font-weight:800;color:#001161;">Dnes vás čeká webinář</p>
<p class="dm-text" style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.55;">Ahoj <strong class="dm-strong" style="color:#001161;">${firstNameEsc}</strong>,</p>
${visualCard}
${surveyCta}
<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
<tr><td style="padding:0;">
<a class="dm-rem-btn" href="${liveHref}" style="display:inline-block;background:#001161;color:#ffffff;font-weight:800;font-size:15px;padding:14px 28px;border-radius:100px;text-decoration:none;">Otevřít webinář</a>
<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;line-height:1.45;">${remEscHtmlReminder(liveUrl)}</p>
</td></tr></table>
</td></tr>
${footer}
</table></td></tr></table></body></html>`;
  return { html, subject: `${WEBINAR_EMAIL_SUBJECT_PREFIX}Dnes: ${w.title || 'webinář Vividbooks'}` };
}

function mergeWebinarRegistrationMergedFromBodyAndKv(
  webinarFromKv: Record<string, unknown> | undefined,
  body: {
    webinarId: string;
    webinarTitle?: string;
    webinarDay?: number;
    webinarMonthNum?: number;
    webinarYear?: number;
    webinarTime?: string;
    webinarMonthName?: string;
  },
) {
  const bd = Number(body.webinarDay);
  const bm = Number(body.webinarMonthNum);
  const by = Number(body.webinarYear);
  const kvD = webinarFromKv?.day;
  const kvMo = webinarFromKv?.monthNum;
  const kvY = webinarFromKv?.year;
  const dayResolved =
    typeof kvD === 'number' && kvD >= 1 && kvD <= 31 ? kvD
    : Number.isFinite(bd) && bd >= 1 && bd <= 31 ? bd
    : NaN;
  const monthResolved =
    typeof kvMo === 'number' && kvMo >= 1 && kvMo <= 12 ? kvMo
    : Number.isFinite(bm) && bm >= 1 && bm <= 12 ? bm
    : NaN;
  const yearResolved =
    typeof kvY === 'number' && kvY >= 2020 && kvY <= 2100 ? kvY
    : Number.isFinite(by) && by >= 2020 && by <= 2100 ? by
    : NaN;
  return {
    day: dayResolved,
    monthNum: monthResolved,
    year: yearResolved,
    time: String(webinarFromKv?.time || body.webinarTime || '18:00').trim() || '18:00',
    monthName: String(webinarFromKv?.monthName || body.webinarMonthName || ''),
    title: String(webinarFromKv?.title || body.webinarTitle || body.webinarId),
  };
}

function computeWebinarRegistrationCalendarAndIcs(
  webinarId: string,
  merged: {
    day: number;
    monthNum: number;
    year: number;
    time: string;
    monthName: string;
    title: string;
  },
  liveUrl: string,
): {
  humanDate: string;
  hasSchedule: boolean;
  icsContent: string;
  icsBase64: string;
  gcalStr: string;
  outlookUrl: string;
} {
  let gcalStr = '';
  let icsContent = '';
  let humanDate = '';
  let outlookUrl = '';
  let icsBase64 = '';

  const hasSchedule =
    Number.isFinite(merged.day) &&
    Number.isFinite(merged.monthNum) &&
    Number.isFinite(merged.year);

  if (hasSchedule) {
    const [hh, mm] = merged.time.split(':').map((x: string) => parseInt(x, 10));
    const hhSafe = Number.isFinite(hh) ? hh : 18;
    const mmSafe = Number.isFinite(mm) ? mm : 0;
    const d = merged.day;
    const mo = merged.monthNum;
    const yr = merged.year;
    const monthGenitive = [
      '', 'ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října',
      'listopadu', 'prosince',
    ];
    const monthGen = monthGenitive[mo] || String(merged.monthName || '').toLowerCase();
      humanDate = `${d}. ${monthGen} ${yr} v ${merged.time}`;
    const pad = (n: number) => String(n).padStart(2, '0');

    const dateStr = `${yr}${pad(mo)}${pad(d)}T${pad(hhSafe)}${pad(mmSafe)}00`;
    const rawEndMin = mmSafe + 30;
    const endHhFinal = hhSafe + 1 + Math.floor(rawEndMin / 60);
    const endMmFinal = rawEndMin % 60;
    const endDateStr = `${yr}${pad(mo)}${pad(d)}T${pad(endHhFinal)}${pad(endMmFinal)}00`;
    const dtstamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '').slice(0, 15) + 'Z';

    icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vividbooks//Webinar//CS',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Prague',
      'BEGIN:STANDARD',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:webinar-${webinarId}-${Date.now()}@vividbooks.cz`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Prague:${dateStr}`,
      `DTEND;TZID=Europe/Prague:${endDateStr}`,
      `SUMMARY:${merged.title.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Online webinář Vividbooks — odkaz na přenos: ${liveUrl}`,
      `URL:${liveUrl}`,
      `LOCATION:Online — ${liveUrl}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const gcalStart = `${yr}${pad(mo)}${pad(d)}T${pad(hhSafe)}${pad(mmSafe)}00`;
    const gcalEnd = `${yr}${pad(mo)}${pad(d)}T${pad(endHhFinal)}${pad(endMmFinal)}00`;
    gcalStr = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(merged.title)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent('Online webinář Vividbooks\n\nPřipojte se: ' + liveUrl)}&location=${encodeURIComponent('Online — ' + liveUrl)}`;

    outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(merged.title)}&startdt=${yr}-${pad(mo)}-${pad(d)}T${pad(hhSafe)}:${pad(mmSafe)}:00&enddt=${yr}-${pad(mo)}-${pad(d)}T${pad(endHhFinal)}:${pad(endMmFinal)}:00&body=${encodeURIComponent('Online webinář Vividbooks\nPřipojte se: ' + liveUrl)}&location=${encodeURIComponent('Online — ' + liveUrl)}`;
  }

  if (icsContent) {
    const icsBytes = new TextEncoder().encode(icsContent);
    let icsBin = '';
    icsBytes.forEach((b: number) => { icsBin += String.fromCharCode(b); });
    icsBase64 = btoa(icsBin);
  }

  return { humanDate, hasSchedule, icsContent, icsBase64, gcalStr, outlookUrl };
}

function buildWebinarRegistrationConfirmationEmailPayload(opts: {
  webinarFromKv: Record<string, unknown> | undefined;
  merged: {
    day: number;
    monthNum: number;
    year: number;
    time: string;
    monthName: string;
    title: string;
  };
  slug: string;
  webinarId: string;
  webinarTitleForSubject: string;
  liveUrl: string;
  liveUrlPersonal: string;
  recipientName: string;
  humanDate: string;
  hasSchedule: boolean;
  gcalStr: string;
  outlookUrl: string;
  icsContent: string;
  icsBase64: string;
}): {
  html: string;
  subject: string;
  attachments: Array<{ type: string; name: string; content: string }>;
} {
  const escHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const firstNameNom = opts.recipientName.trim().split(' ')[0] || opts.recipientName.trim();
  const firstName = czechFirstNameVocative(firstNameNom);
  const lecturerResolved = String(opts.webinarFromKv?.lecturer || '').trim();
  const coverRaw = String(opts.webinarFromKv?.coverImage || '').trim();
  const coverImgUrl = /^https?:\/\//i.test(coverRaw) ? coverRaw : '';
  const titleSafe = escHtml(opts.merged.title);
  const humanDateSafe = opts.humanDate ? escHtml(opts.humanDate) : '';
  const firstNameSafe = escHtml(firstName);
  const coverBlock = coverImgUrl
    ? `<img src="${escHtml(coverImgUrl)}" alt="${titleSafe}" width="520" style="width:100%;max-width:520px;height:auto;border-radius:12px 12px 0 0;display:block;border:0;margin:0;" />`
    : '';
  const titleIfNoCover = !coverImgUrl
    ? `<p style="margin:0 0 14px;font-size:20px;font-weight:800;color:#001161;line-height:1.35;">${titleSafe}</p>`
    : '';
  const dateAndLecturerBlock = humanDateSafe
    ? `<p style="margin:0 0 6px;font-size:16px;color:#334155;line-height:1.5;">${humanDateSafe}</p>${
      lecturerResolved
        ? `<p style="margin:0;font-size:15px;color:#334155;line-height:1.5;">Lektor: ${escHtml(lecturerResolved)}</p>`
        : ''
    }`
    : `<p class="dm-muted" style="margin:0;font-size:14px;color:#64748b;">${
      lecturerResolved
        ? `Přesný termín doplníme v dalším e-mailu nebo na stránce webináře.</p><p style="margin:10px 0 0;font-size:15px;color:#334155;line-height:1.5;">Lektor: ${escHtml(lecturerResolved)}</p>`
        : 'Přesný termín doplníme v dalším e-mailu nebo na stránce webináře.</p>'
    }`;

  const linkActiveText = opts.hasSchedule
    ? `Odkaz bude aktivní ${opts.merged.day}. ${opts.merged.monthNum}. ${opts.merged.year} od ${opts.merged.time}. Otevřete ho v naplánovaný čas.`
    : 'Otevřete odkaz v naplánovaný čas — jakmile bude k dispozici termín, upřesníme ho v další zprávě.';
  const linkActiveSafe = escHtml(linkActiveText);

  const emailHtml = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registrace potvrzená</title>${WEBINAR_EMAIL_DARK_HEAD}</head>
<body class="dm-body" style="margin:0;padding:0;background:#f5f6fa;font-family:Arial,Helvetica,sans-serif;">
<table class="dm-wrap" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:32px 16px;">
<tr><td align="center">
<table class="dm-card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,17,97,0.08);">
${webinarEmailBrandedHeaderRow('Potvrzení registrace', {
  headerPadding: '28px 32px 24px',
  headerRadius: '20px 20px 0 0',
})}
<tr><td class="dm-content" style="padding:40px 40px 28px;">
<p class="dm-h1" style="margin:0 0 8px;font-size:26px;font-weight:800;color:#001161;line-height:1.25;">Jste přihlášeni!</p>
<p class="dm-text" style="margin:0 0 6px;font-size:16px;color:#4a5568;">Ahoj <strong class="dm-strong" style="color:#001161;">${firstNameSafe}</strong>,</p>
<p class="dm-text" style="margin:0 0 22px;font-size:16px;color:#4a5568;line-height:1.6;">
Děkujeme za registraci. Tady je vše potřebné:
</p>
<table class="dm-inner" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td class="dm-box-top" style="background:#f8fafc;padding:0;">
${coverBlock}
<div class="dm-box-pad" style="padding:22px 24px 24px;">
${titleIfNoCover}${dateAndLecturerBlock}
</div>
</td></tr>
</table>
<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
<tr><td class="dm-cta-navy" style="background:#1e3a5f;border-radius:16px;padding:24px 28px;">
<p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,0.85);">Váš vstup na webinář</p>
<p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.9);line-height:1.5;">${linkActiveSafe}</p>
<a class="dm-btn" href="${opts.liveUrlPersonal.replace(/"/g, '&quot;')}" style="display:inline-block;background:#ffffff;color:#1e3a5f;font-weight:800;font-size:15px;padding:12px 28px;border-radius:100px;text-decoration:none;letter-spacing:-0.2px;">Otevřít přenos</a>
<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;line-height:1.45;">${escHtml(opts.liveUrlPersonal)}</p>
</td></tr>
</table>
<p class="dm-cal-heading" style="margin:0 0 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(0,17,97,0.4);">Přidat do kalendáře</p>
${opts.gcalStr ? `<table class="dm-cal" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;"><tr><td><a class="dm-cal-link" href="${opts.gcalStr}" style="display:block;background:#f0f2f8;border-radius:12px;padding:14px 18px;text-decoration:none;color:#001161;font-weight:700;font-size:14px;">&#128197;&nbsp; Google Kalendář</a></td></tr></table>` : ''}
${opts.outlookUrl ? `<table class="dm-cal" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;"><tr><td><a class="dm-cal-link" href="${opts.outlookUrl}" style="display:block;background:#f0f2f8;border-radius:12px;padding:14px 18px;text-decoration:none;color:#001161;font-weight:700;font-size:14px;">&#128197;&nbsp; Outlook / Office 365</a></td></tr></table>` : ''}
<p class="dm-ics-note" style="margin:12px 0 0;font-size:13px;color:#718096;">Příloha .ics funguje s Apple Calendar, Thunderbird a dalšími.</p>
</td></tr>
${webinarEmailDvppPromoBannerRow()}
<tr><td class="dm-footer" style="background:#f8f9fc;padding:20px 40px;border-top:1px solid #edf2f7;">
<p class="dm-footer-text" style="margin:0;font-size:12px;color:#a0aec0;line-height:1.6;">
Tento e-mail byl odeslán automaticky po registraci na webinář.<br>
&copy; ${new Date().getFullYear()} Vividbooks
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const attachments = opts.icsContent
    ? [{
      type: 'text/calendar; charset=utf-8; method=REQUEST',
      name: `webinar-${opts.slug}.ics`,
      content: opts.icsBase64,
    }]
    : [];

  return {
    html: emailHtml,
    subject: `${WEBINAR_EMAIL_SUBJECT_PREFIX}Registrace potvrzená: ${opts.webinarTitleForSubject}`,
    attachments,
  };
}

/** Mandrill vrací u příloh často `queued` (+ queued_reason) — zpráva je přijata, ne jde o chybu. */
function mandrillRecipientAccepted(rec: { status?: string } | undefined): boolean {
  const s = rec?.status;
  return s === 'sent' || s === 'queued' || s === 'scheduled';
}

async function sendMandrillWebinarRegistrationConfirmationResult(opts: {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
  attachments: Array<{ type: string; name: string; content: string }>;
}): Promise<{ ok: boolean; detail?: string }> {
  const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
  if (!mandrillKey) return { ok: false, detail: 'MANDRILL_API_KEY missing' };
  try {
    const mailRes = await fetch('https://mandrillapp.com/api/1.0/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: mandrillKey,
        message: {
          html: opts.html,
          subject: opts.subject,
          from_email: 'hello@vividbooks.com',
          from_name: 'Vividbooks',
          to: [{ email: opts.toEmail, name: opts.toName, type: 'to' }],
          attachments: opts.attachments,
          headers: { 'Reply-To': 'hello@vividbooks.com' },
          track_opens: true,
          track_clicks: false,
        },
      }),
    });
    const mailData = await mailRes.json();
    if (!mailRes.ok) {
      return { ok: false, detail: `HTTP ${mailRes.status}: ${JSON.stringify(mailData).slice(0, 400)}` };
    }
    const ok = Array.isArray(mailData) && mandrillRecipientAccepted(mailData[0]);
    if (!ok) return { ok: false, detail: JSON.stringify(mailData).slice(0, 500) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message || String(e) };
  }
}

async function sendMandrillHtmlResult(opts: {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
  /** Metadata (jen řetězce) — např. webinar_id pro webhook „open“ u follow-up e-mailů. */
  metadata?: Record<string, string>;
}): Promise<{ ok: boolean; detail?: string }> {
  const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
  if (!mandrillKey) return { ok: false, detail: 'MANDRILL_API_KEY missing' };
  try {
    const meta =
      opts.metadata && Object.keys(opts.metadata).length > 0
        ? Object.fromEntries(
            Object.entries(opts.metadata).map(([k, v]) => [k, String(v ?? '').slice(0, 500)]),
          )
        : undefined;
    const mailRes = await fetch('https://mandrillapp.com/api/1.0/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: mandrillKey,
        message: {
          html: opts.html,
          subject: opts.subject,
          from_email: 'hello@vividbooks.com',
          from_name: 'Vividbooks',
          to: [{ email: opts.toEmail, name: opts.toName, type: 'to' }],
          headers: { 'Reply-To': 'hello@vividbooks.com' },
          track_opens: true,
          track_clicks: false,
          ...(meta ? { metadata: meta } : {}),
        },
      }),
    });
    const mailData = await mailRes.json();
    if (!mailRes.ok) {
      return { ok: false, detail: `HTTP ${mailRes.status}: ${JSON.stringify(mailData).slice(0, 400)}` };
    }
    const ok = Array.isArray(mailData) && mandrillRecipientAccepted(mailData[0]);
    if (!ok) return { ok: false, detail: JSON.stringify(mailData).slice(0, 500) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message || String(e) };
  }
}

async function sendMandrillHtml(opts: {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const r = await sendMandrillHtmlResult(opts);
  return r.ok;
}

/**
 * Účastník pro zápis dotazníku: nejdřív `webinar_reg_*` / light / index (jméno z registrace),
 * jinak syntetický záznam jen z e-mailu — **nikdy** kvůli chybějící registraci na webinář neblokovat odeslání.
 * (`surveyRequireFullRegistration` v KV ovlivňuje jen UI v adminu / klientu, ne tuto kontrolu.)
 */
async function kvGetWebinarSurveyParticipantForEmail(
  webinarId: string,
  email: string,
  webinarItem?: Record<string, unknown> | null,
): Promise<unknown> {
  const tryReg = (wid: string) => kv.get(`webinar_reg_${wid}_${email}`);
  const tryLight = (wid: string) => kv.get(`webinar_survey_light_${wid}_${email}`);

  const slugRaw = webinarItem?.slug;
  const slug = typeof slugRaw === 'string' && slugRaw.trim() ? slugRaw.trim() : '';

  let reg: unknown = await tryReg(webinarId);
  if (reg) return reg;
  if (slug && slug !== webinarId) {
    reg = await tryReg(slug);
    if (reg) return reg;
  }

  let light: unknown = await tryLight(webinarId);
  if (light) return light;
  if (slug && slug !== webinarId) {
    light = await tryLight(slug);
    if (light) return light;
  }

  try {
    const rows = await getWebinarEmailIndexRows(email);
    const canonicalId = String(webinarItem?.id ?? webinarId);
    for (const r of rows) {
      const sameEvent =
        r.webinarId === canonicalId ||
        r.webinarId === webinarId ||
        (slug && (r.webinarSlug === slug || r.webinarId === slug));
      if (!sameEvent) continue;
      reg = await tryReg(r.webinarId);
      if (reg) return reg;
    }
  } catch {
    /* index není kritický */
  }

  return { name: '', email, surveyNoPriorKvContact: true };
}

/**
 * Jméno pro přehled odpovědí: nejdřív z klienta (úvodní formulář), pak KV registrace / certifikát,
 * nakonec rozpracovaný záznam v KV (partial).
 */
function resolveSurveyParticipantDisplayName(
  reg: unknown,
  opts: { clientName?: string; partialStoredName?: string },
): string {
  const c = String(opts.clientName || '').trim();
  if (c) return c;
  const r = reg as Record<string, unknown> | null | undefined;
  if (r && typeof r === 'object') {
    const n = String(r.name || '').trim();
    if (n) return n;
    const cp = String(r.certificateParticipantName || '').trim();
    if (cp) return cp;
  }
  const p = String(opts.partialStoredName || '').trim();
  if (p) return p;
  return '';
}

const webinarSurveyPartialHandler = async (c: Context) => {
  try {
    const body = await c.req.json();
    const webinarId = normalizeWebinarIdFromBody(body?.webinarId);
    const email =
      typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    const questionId = typeof body?.questionId === 'string' ? body.questionId.trim() : '';
    const valueRaw = body?.value;
    if (!webinarId || !email || !questionId) {
      return c.json({ error: 'Chybí webinarId, email nebo questionId.' }, 400);
    }
    const value = valueRaw === undefined || valueRaw === null ? '' : String(valueRaw).trim();
    if (!value) {
      return c.json({ error: 'Chybí odpověď.' }, 400);
    }

    const items = await getCollection(WEBINARS_KEY);
    const webinar = (items as any[]).find((x: any) => String(x.id) === String(webinarId)) as
      | Record<string, unknown>
      | undefined;
    const reg = await kvGetWebinarSurveyParticipantForEmail(webinarId, email, webinar);
    /** Žádné 409 — uživatel může vyplnit znovu (stejný odkaz / opakování bez „autentizace“). */

    const questions = resolveSurveyQuestionsFromWebinarItem(webinar || null);
    if (questions.length === 0) return c.json({ error: 'Dotazník není aktivní.' }, 400);

    const q = questions.find((x) => x.id === questionId);
    if (!q) return c.json({ error: 'Neznámá otázka.' }, 400);
    if (q.type === 'yes_no' && value !== 'yes' && value !== 'no') {
      return c.json({ error: `Neplatná odpověď u: ${q.label}` }, 400);
    }
    if (q.type === 'abc' && q.options && q.options.length > 0) {
      const ok = q.options.some((o) => o === value);
      if (!ok) return c.json({ error: `Neplatná volba u: ${q.label}` }, 400);
    }

    const dvppCorrect = getDvppQuizCorrectAnswerText(webinar, questionId);
    const wrongDvpp =
      dvppCorrect != null && value.trim() !== dvppCorrect.trim();

    const partialKey = webinarSurveyPartialKey(webinarId, email);
    const clientName =
      typeof body?.participantName === 'string'
        ? body.participantName
        : typeof body?.name === 'string'
          ? body.name
          : '';
    const initialPrev = (await kv.get(partialKey)) as { answers?: Record<string, string>; name?: string } | null;
    const nameForPartial = resolveSurveyParticipantDisplayName(reg, {
      clientName,
      partialStoredName: String(initialPrev?.name || ''),
    });
    /** Read–merge–write bez transakce: souběžné POSTy (dvojklik) si jinak přepisovaly `answers`. */
    let mergedOk = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const prev = (await kv.get(partialKey)) as {
        answers?: Record<string, string>;
      } | null;
      const base = { ...(prev?.answers || {}) };
      const nextAnswers = { ...base, [questionId]: value };
      await kv.set(partialKey, {
        webinarId,
        email,
        name: nameForPartial,
        answers: nextAnswers,
        updatedAt: new Date().toISOString(),
      });
      const verify = (await kv.get(partialKey)) as { answers?: Record<string, string> } | null;
      const va = verify?.answers || {};
      if (va[questionId] !== value) continue;
      let allMatch = true;
      for (const [k, val] of Object.entries(nextAnswers)) {
        if (va[k] !== val) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        mergedOk = true;
        break;
      }
    }
    if (!mergedOk) {
      return c.json(
        { error: 'Nepodařilo se bezpečně uložit odpověď (konflikt). Obnovte stránku a zkuste znovu.' },
        409,
      );
    }
    return c.json(wrongDvpp ? { success: true, wrongAnswer: true } : { success: true });
  } catch (err: any) {
    console.log(`[Survey partial] Chyba: ${err.message}`);
    return c.json({ error: err.message || String(err) }, 500);
  }
};

const webinarSurveySubmitHandler = async (c: Context) => {
  try {
    const body = await c.req.json();
    const webinarId = normalizeWebinarIdFromBody(body?.webinarId);
    const email =
      typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    const answers = body?.answers;
    if (!webinarId || !email || answers == null || typeof answers !== 'object') {
      return c.json({ error: 'Chybí webinarId, email nebo odpovědi.' }, 400);
    }

    const items = await getCollection(WEBINARS_KEY);
    const webinar = (items as any[]).find((x: any) => String(x.id) === String(webinarId)) as
      | Record<string, unknown>
      | undefined;
    const reg = await kvGetWebinarSurveyParticipantForEmail(webinarId, email, webinar);

    const questions = resolveSurveyQuestionsFromWebinarItem(webinar || null);
    if (questions.length === 0) return c.json({ error: 'Dotazník není aktivní.' }, 400);

    const partialKey = webinarSurveyPartialKey(webinarId, email);
    const partialDoc = (await kv.get(partialKey)) as { answers?: Record<string, string>; name?: string } | null;
    const mergedIncoming: Record<string, unknown> = {
      ...(partialDoc?.answers || {}),
      ...(answers as Record<string, unknown>),
    };

    const clientName =
      typeof body?.participantName === 'string'
        ? body.participantName
        : typeof body?.name === 'string'
          ? body.name
          : '';
    const storedName = resolveSurveyParticipantDisplayName(reg, {
      clientName,
      partialStoredName: String(partialDoc?.name || ''),
    });

    const out: Record<string, string> = {};
    for (const q of questions) {
      const v = mergedIncoming[q.id];
      const s = v === undefined || v === null ? '' : String(v).trim();
      if (!s) continue;
      if (q.type === 'yes_no' && s !== 'yes' && s !== 'no') {
        return c.json({ error: `Neplatná odpověď u: ${q.label}` }, 400);
      }
      if (q.type === 'abc' && q.options && q.options.length > 0) {
        const ok = q.options.some((o) => o === s);
        if (!ok) return c.json({ error: `Neplatná volba u: ${q.label}` }, 400);
      }
      out[q.id] = s;
    }

    /** Přepsat předchozí finální odeslání — opakované vyplnění je povolené. */

    await kv.set(webinarSurveyAnswerKey(webinarId, email), {
      webinarId,
      email,
      name: storedName,
      answers: out,
      submittedAt: new Date().toISOString(),
    });
    await kv.del(partialKey).catch(() => {});
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`[Survey] Chyba: ${err.message}`);
    return c.json({ error: err.message || String(err) }, 500);
  }
};

app.post('/make-server-93a20b6f/webinar-survey-submit', webinarSurveySubmitHandler);
/** Záloha: některé proxy posílají jen suffix cesty bez prefixu funkce. */
app.post('/webinar-survey-submit', webinarSurveySubmitHandler);

app.post('/make-server-93a20b6f/webinar-survey-partial', webinarSurveyPartialHandler);
app.post('/webinar-survey-partial', webinarSurveyPartialHandler);

function webinarSurveyPublicIdxKey(webinarId: string): string {
  return `webinar_survey_public_idx_${webinarId}`;
}

function webinarSurveyPublicTokenKey(token: string): string {
  return `webinar_survey_public_${token}`;
}

async function getWebinarSurveyQuestionsAndResponses(webinarId: string): Promise<{
  questions: ReturnType<typeof resolveSurveyQuestionsFromWebinarItem>;
  responses: Record<string, unknown>[];
}> {
  const items = await getCollection(WEBINARS_KEY);
  const webinar = (items as any[]).find((x: any) => x.id === webinarId) as Record<string, unknown> | undefined;
  const questions = resolveSurveyQuestionsFromWebinarItem(webinar || null);
  const prefixFinal = `webinar_survey_${webinarId}_`;
  const prefixPartial = `webinar_survey_partial_${webinarId}_`;
  const rowsFinal = await kv.getByPrefix(prefixFinal);
  const rowsPartial = await kv.getByPrefix(prefixPartial);
  let finalClean: unknown[] = [];
  let partialClean: unknown[] = [];
  try {
    finalClean = JSON.parse(JSON.stringify(rowsFinal ?? [])) as unknown[];
  } catch {
    finalClean = [];
  }
  try {
    partialClean = JSON.parse(JSON.stringify(rowsPartial ?? [])) as unknown[];
  } catch {
    partialClean = [];
  }
  const byEmail = new Map<string, Record<string, unknown>>();
  for (const p of partialClean as Array<Record<string, unknown>>) {
    const em = String(p?.email || '')
      .toLowerCase()
      .trim();
    if (!em) continue;
    const upd = p?.updatedAt as string | undefined;
    byEmail.set(em, {
      ...p,
      partial: true,
      submittedAt: upd || p?.submittedAt || '',
    });
  }
  for (const f of finalClean as Array<Record<string, unknown>>) {
    const em = String(f?.email || '')
      .toLowerCase()
      .trim();
    if (!em) continue;
    byEmail.set(em, { ...f, partial: false });
  }
  const responses = Array.from(byEmail.values()).sort((a, b) => {
    const ta = new Date(String(a?.submittedAt || 0)).getTime();
    const tb = new Date(String(b?.submittedAt || 0)).getTime();
    return tb - ta;
  });
  return { questions, responses };
}

function surveyResponsesStripEmailsForPublic(responses: Record<string, unknown>[]): Record<string, unknown>[] {
  return responses.map((r) => ({ ...r, email: '' }));
}

app.get('/make-server-93a20b6f/admin/webinar-survey/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const { questions, responses } = await getWebinarSurveyQuestionsAndResponses(webinarId);
    return c.json({ webinarId, questions, responses });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/** Aktuální veřejný odkaz na výsledky dotazníku (bez vytváření nového). */
async function adminWebinarSurveyPublicLinkGetHandler(c: Context) {
  try {
    const webinarId = c.req.param('webinarId');
    const idx = (await kv.get(webinarSurveyPublicIdxKey(webinarId))) as { token?: string } | null;
    const tok = typeof idx?.token === 'string' && idx.token.length > 0 ? idx.token : '';
    if (!tok) return c.json({ token: null, path: null, url: null });
    const origin = getPublicSiteOrigin();
    const path = `/webinar-dotaznik-vysledky/${tok}`;
    return c.json({ token: tok, path, url: `${origin}${path}` });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
}

/** Vytvoří nebo vrátí token; `rotate: true` zneplatní předchozí odkaz. */
async function adminWebinarSurveyPublicLinkPostHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const webinarId = String(body?.webinarId || '').trim();
    const rotate = !!body?.rotate;
    if (!webinarId) return c.json({ error: 'Chybí webinarId.' }, 400);
    const items = await getCollection(WEBINARS_KEY);
    const w = (items as any[]).find((x: any) => x.id === webinarId);
    if (!w) return c.json({ error: 'Webinář nenalezen.' }, 404);

    const idxKey = webinarSurveyPublicIdxKey(webinarId);
    const existing = (await kv.get(idxKey)) as { token?: string } | null;
    let token = existing?.token && !rotate ? existing.token : '';

    if (!token || rotate) {
      if (existing?.token) {
        await kv.del(webinarSurveyPublicTokenKey(existing.token)).catch(() => {});
      }
      token = crypto.randomUUID();
      const now = new Date().toISOString();
      await kv.set(idxKey, { token, webinarId, updatedAt: now });
      await kv.set(webinarSurveyPublicTokenKey(token), { webinarId, createdAt: now });
    }

    const origin = getPublicSiteOrigin();
    const path = `/webinar-dotaznik-vysledky/${token}`;
    return c.json({ token, path, url: `${origin}${path}` });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
}

app.get('/make-server-93a20b6f/admin/webinar-survey-public-link/:webinarId', adminWebinarSurveyPublicLinkGetHandler);
/** Alias — stejně jako u webinar-post-followup-bulk-send (cesta bez prefixu po normalizaci). */
app.get('/admin/webinar-survey-public-link/:webinarId', adminWebinarSurveyPublicLinkGetHandler);

app.post('/make-server-93a20b6f/admin/webinar-survey-public-link', adminWebinarSurveyPublicLinkPostHandler);
app.post('/admin/webinar-survey-public-link', adminWebinarSurveyPublicLinkPostHandler);

/** Veřejné přehledy odpovědí — pouze držitel tajného odkazu (e-maily skryté). */
app.get('/make-server-93a20b6f/public/webinar-survey-results/:token', async (c) => {
  try {
    const token = c.req.param('token')?.trim() || '';
    if (!token || token.length < 8) return c.json({ error: 'Neplatný odkaz.' }, 404);
    const rec = await kv.get(webinarSurveyPublicTokenKey(token));
    if (!rec || typeof rec !== 'object' || !(rec as any).webinarId) {
      return c.json({ error: 'Neplatný nebo zrušený odkaz.' }, 404);
    }
    const webinarId = String((rec as any).webinarId);
    const { questions, responses } = await getWebinarSurveyQuestionsAndResponses(webinarId);
    const items = await getCollection(WEBINARS_KEY);
    const w = (items as any[]).find((x: any) => x.id === webinarId);
    const webinarTitle = String(w?.title || webinarId);
    const publicResponses = surveyResponsesStripEmailsForPublic(responses);
    return c.json({ webinarId, webinarTitle, questions, responses: publicResponses });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

app.post('/make-server-93a20b6f/cron/webinar-reminders', async (c) => {
  try {
    const secret = Deno.env.get('WEBINAR_REMINDER_CRON_SECRET')?.trim();
    const auth = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    const hdr = c.req.header('X-Cron-Secret') || '';
    if (!secret || (auth !== secret && hdr !== secret)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const markPast = await markPastWebinarsInCollection();
    const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
    if (!mandrillKey) {
      return c.json({ ok: true, skipped: 'MANDRILL_API_KEY missing', sent: 0, markPastUpdated: markPast.updated });
    }

    const items = (await getCollection(WEBINARS_KEY)) as any[];
    const nowMs = Date.now();
    const baseUrl = getPublicSiteOrigin();
    let sent = 0;

    for (const w of items) {
      if (!w?.id || w.isPast) continue;
      const startMs = webinarStartEpochMsPrague(w);
      if (startMs <= nowMs) continue;

      const y = w.year;
      const m = w.monthNum || 1;
      const d = w.day || 1;
      const p = pragueWallClockFromMs(nowMs);
      const isEventDay = p.y === y && p.m === m && p.d === d;
      const liveUrl = `${baseUrl}/webinar/${w.slug || w.id}/live`;

      const regs = await kv.getByPrefix(`webinar_reg_${w.id}_`) as any[];
      if (!regs?.length) continue;

      for (const reg of regs) {
        const cleanEmail = String(reg.email || '').toLowerCase().trim();
        if (!cleanEmail) continue;
        const name = String(reg.name || '').trim();
        const firstName = name.split(/\s+/)[0] || name || 'dobrý den';
        const eh = md5(cleanEmail);
        const delta = startMs - nowMs;
        /** ~30 min před začátkem (cron každých 10–15 min — širší okno) */
        let inT30 = delta >= 15 * 60 * 1000 && delta <= 50 * 60 * 1000;
        let inMorning = isEventDay && p.H >= 7 && p.H <= 10;
        if (w.devSimulateReminderT30 === true) inT30 = true;
        if (w.devSimulateReminderMorning === true) inMorning = true;
        /** Jinak by „za chvíli“ (15–50 min před startem) přebilo vývoj „dnes“. */
        if (w.devSimulateReminderMorning === true) inT30 = false;
        if (w.devSimulateReminderT30 === true) inMorning = false;

        if (inT30) {
          const k2 = webinarReminderT30Key(w.id, eh);
          if (w.devSimulateReminderT30 !== true && (await kv.get(k2))) continue;
          const surveyPageUrl = await resolveSurveyInviteUrlForRegistrant(w, cleanEmail, baseUrl);
          const { html, subject } = buildWebinarReminderT30Email(w, firstName, liveUrl, surveyPageUrl);
          const ok2 = await sendMandrillHtml({
            toEmail: cleanEmail,
            toName: name || cleanEmail,
            subject,
            html,
          });
          if (ok2) {
            await kv.set(k2, { sentAt: new Date().toISOString() });
            sent++;
          }
        } else if (inMorning) {
          const k = webinarReminderMorningKey(w.id, eh);
          if (w.devSimulateReminderMorning !== true && (await kv.get(k))) continue;
          const surveyPageUrl = await resolveSurveyInviteUrlForRegistrant(w, cleanEmail, baseUrl);
          const { html, subject } = buildWebinarReminderMorningEmail(w, firstName, liveUrl, surveyPageUrl);
          const ok = await sendMandrillHtml({
            toEmail: cleanEmail,
            toName: name || cleanEmail,
            subject,
            html,
          });
          if (ok) {
            await kv.set(k, { sentAt: new Date().toISOString() });
            sent++;
          }
        }
      }
    }
    return c.json({ ok: true, sent, markPastUpdated: markPast.updated });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/** Označí webináře jako minulé po skončení (začátek + durationMinutes / výchozí 120 min). Lehké — lze volat často z cronu. */
app.post('/make-server-93a20b6f/cron/webinar-mark-past', async (c) => {
  try {
    const secret = Deno.env.get('WEBINAR_REMINDER_CRON_SECRET')?.trim();
    const auth = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    const hdr = c.req.header('X-Cron-Secret') || '';
    if (!secret || (auth !== secret && hdr !== secret)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const { updated } = await markPastWebinarsInCollection();
    return c.json({ ok: true, updated });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/** Okamžitý test připomínky (bez cronu) — první registrace v KV, stejná šablona jako produkce. */
app.post('/make-server-93a20b6f/admin/webinar-reminder-test-send', async (c) => {
  try {
    const body = await c.req.json();
    const webinarId = String(body?.webinarId || '').trim();
    const kind = body?.kind === 't30' ? 't30' : 'morning';
    if (!webinarId) return c.json({ error: 'Chybí webinarId.' }, 400);

    if (!Deno.env.get('MANDRILL_API_KEY')?.trim()) {
      return c.json({ error: 'MANDRILL_API_KEY není nastaven v Edge Functions secrets.' }, 503);
    }

    const items = (await getCollection(WEBINARS_KEY)) as any[];
    const w = items.find((x: any) => x.id === webinarId);
    if (!w) return c.json({ error: 'Webinář nenalezen.' }, 404);

    const startMs = webinarStartEpochMsPrague(w);
    if (startMs <= Date.now()) {
      return c.json({ error: 'Webinář už podle rozvrhu začal nebo skončil — připomínky se neposílají.' }, 400);
    }
    if (w.isPast) {
      return c.json({ error: 'Webinář je označen jako minulý (isPast). Upravte datum v administraci.' }, 400);
    }

    const regs = await kv.getByPrefix(`webinar_reg_${w.id}_`) as any[];
    if (!regs?.length) {
      return c.json({
        error:
          'Žádná registrace na tento webinář. Připomínky chodí jen registrovaným — nejdřív se zaregistrujte testovacím e-mailem.',
      }, 400);
    }

    const reg = regs[0];
    const cleanEmail = String(reg.email || '').toLowerCase().trim();
    if (!cleanEmail) return c.json({ error: 'První registrace nemá e-mail.' }, 400);
    const name = String(reg.name || '').trim();
    const firstName = name.split(/\s+/)[0] || name || 'dobrý den';
    const baseUrl = getPublicSiteOrigin();
    const liveUrl = `${baseUrl}/webinar/${w.slug || w.id}/live`;

    const surveyPageUrl = await resolveSurveyInviteUrlForRegistrant(w, cleanEmail, baseUrl);
    const { html, subject } = kind === 't30'
      ? buildWebinarReminderT30Email(w, firstName, liveUrl, surveyPageUrl)
      : buildWebinarReminderMorningEmail(w, firstName, liveUrl, surveyPageUrl);

    const result = await sendMandrillHtmlResult({
      toEmail: cleanEmail,
      toName: name || cleanEmail,
      subject,
      html,
    });

    if (!result.ok) {
      await upsertSiteIncident({
        source: 'webinar_reminder_test',
        incidentType: 'mandrill_webinar_reminder_test_failed',
        severity: 'warning',
        dedupeKey: `webinar-reminder-test-${webinarId}-mandrill`,
        title: 'Test připomínky webináře — Mandrill neodeslal',
        message: result.detail || 'Neznámá chyba',
        payload: { webinarId, kind, to: cleanEmail },
        webinarId,
        webinarTitle: String(w.title || ''),
        contactEmail: cleanEmail,
      });
      return c.json({ ok: false, detail: result.detail, to: cleanEmail, kind });
    }
    return c.json({ ok: true, to: cleanEmail, kind });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/** Okamžitý test potvrzovacího e-mailu po registraci — první registrace v KV, stejná šablona jako produkce. */
app.post('/make-server-93a20b6f/admin/webinar-registration-test-send', async (c) => {
  try {
    const body = await c.req.json();
    const webinarId = String(body?.webinarId || '').trim();
    if (!webinarId) return c.json({ error: 'Chybí webinarId.' }, 400);

    if (!Deno.env.get('MANDRILL_API_KEY')?.trim()) {
      return c.json({ error: 'MANDRILL_API_KEY není nastaven v Edge Functions secrets.' }, 503);
    }

    const items = (await getCollection(WEBINARS_KEY)) as any[];
    const w = items.find((x: any) => x.id === webinarId);
    if (!w) return c.json({ error: 'Webinář nenalezen.' }, 404);

    const regs = await kv.getByPrefix(`webinar_reg_${w.id}_`) as any[];
    if (!regs?.length) {
      return c.json({
        error:
          'Žádná registrace na tento webinář. Nejdřív se zaregistrujte testovacím e-mailem.',
      }, 400);
    }

    const reg = regs[0];
    const cleanEmail = String(reg.email || '').toLowerCase().trim();
    if (!cleanEmail) return c.json({ error: 'První registrace nemá e-mail.' }, 400);
    const name = String(reg.name || '').trim();
    const slug = String(w.slug || w.id);

    const lobbyToken = crypto.randomUUID();
    const lobbyExpiresAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    await kv.set(`webinar_lobby_${lobbyToken}`, {
      webinarId: w.id,
      webinarSlug: slug,
      email: cleanEmail,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      expiresAt: lobbyExpiresAt,
    });

    const baseUrl = getPublicSiteOrigin();
    const liveUrl = `${baseUrl}/webinar/${slug}/live`;
    const liveUrlPersonal = `${liveUrl}?lobby=${lobbyToken}`;

    const webinarFromKv = w as Record<string, unknown>;
    const merged = mergeWebinarRegistrationMergedFromBodyAndKv(webinarFromKv, {
      webinarId: w.id,
      webinarTitle: String(w.title || w.id),
      webinarDay: w.day,
      webinarMonthNum: w.monthNum,
      webinarYear: w.year,
      webinarTime: w.time,
      webinarMonthName: w.monthName,
    });

    const cal = computeWebinarRegistrationCalendarAndIcs(w.id, merged, liveUrl);
    const { humanDate, hasSchedule, icsContent, icsBase64, gcalStr, outlookUrl } = cal;

    const payload = buildWebinarRegistrationConfirmationEmailPayload({
      webinarFromKv,
      merged,
      slug,
      webinarId: w.id,
      webinarTitleForSubject: String(w.title || w.id),
      liveUrl,
      liveUrlPersonal,
      recipientName: name,
      humanDate,
      hasSchedule,
      gcalStr,
      outlookUrl,
      icsContent,
      icsBase64,
    });

    const result = await sendMandrillWebinarRegistrationConfirmationResult({
      toEmail: cleanEmail,
      toName: name || cleanEmail,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments,
    });

    if (!result.ok) {
      await upsertSiteIncident({
        source: 'webinar_registration_test',
        incidentType: 'mandrill_webinar_registration_test_failed',
        severity: 'warning',
        dedupeKey: `webinar-registration-test-${webinarId}-mandrill`,
        title: 'Test potvrzovacího e-mailu webináře — Mandrill neodeslal',
        message: result.detail || 'Neznámá chyba',
        payload: { webinarId, to: cleanEmail },
        webinarId,
        webinarTitle: String(w.title || ''),
        contactEmail: cleanEmail,
      });
      return c.json({ ok: false, detail: result.detail, to: cleanEmail });
    }
    return c.json({ ok: true, to: cleanEmail });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/**
 * Jedna audience pro admin (číslo jako v Mailchimp UI — nesčítat newsletter + bez newsletteru).
 * MAILCHIMP_AUDIENCE_PRIMARY = přesně ten list (např. Vividbooks - Czech & Slovak), jinak NEWSLETTER.
 */
function getMailchimpAdminListId(): string | null {
  const primary = Deno.env.get('MAILCHIMP_AUDIENCE_PRIMARY')?.trim();
  if (primary) return primary;
  const nl = Deno.env.get('MAILCHIMP_AUDIENCE_NEWSLETTER')?.trim();
  if (nl) return nl;
  return Deno.env.get('MAILCHIMP_AUDIENCE_NO_NEWSLETTER')?.trim() || null;
}

async function mailchimpFetchTagsByPrefix(
  listId: string,
  prefix: string,
  mcBase: string,
  mcAuth: string,
): Promise<Array<{ id: number; name: string }>> {
  const url = `${mcBase}/lists/${listId}/tag-search?name=${encodeURIComponent(prefix)}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${mcAuth}` } });
  if (!res.ok) {
    const errText = await res.text();
    console.log(`[Mailchimp] tag-search list=${listId} prefix="${prefix.slice(0, 48)}": ${res.status} ${errText.slice(0, 220)}`);
    return [];
  }
  const j = await res.json();
  return (j.tags || []) as Array<{ id: number; name: string }>;
}

/** Tag = statický segment — id z tag-search odpovídá segment_id. */
async function mailchimpResolveTagSegmentHit(
  listId: string,
  tagName: string,
  mcBase: string,
  mcAuth: string,
): Promise<{ id: number; name: string } | null> {
  let tags = await mailchimpFetchTagsByPrefix(listId, tagName, mcBase, mcAuth);
  let hit = tags.find((t) => t.name === tagName);
  if (!hit && tagName.length > 1) {
    tags = await mailchimpFetchTagsByPrefix(listId, tagName.slice(0, Math.min(60, tagName.length)), mcBase, mcAuth);
    hit = tags.find((t) => t.name === tagName);
  }
  if (!hit && tagName.startsWith('webinar-')) {
    tags = await mailchimpFetchTagsByPrefix(listId, 'webinar-', mcBase, mcAuth);
    hit = tags.find((t) => t.name === tagName);
  }
  if (!hit) {
    console.log(`[Mailchimp] žádný tag přesné jméno v listu ${listId}: "${tagName}"`);
    return null;
  }
  return hit;
}

/**
 * Počet kontaktů s tagem v jedné audience.
 * Tagy = statické segmenty: tag-search → GET /segments/{id} → member_count.
 */
async function mailchimpMemberCountForTag(listId: string, tagName: string, mcBase: string, mcAuth: string): Promise<number | null> {
  const headers = { Authorization: `Basic ${mcAuth}` };
  const hit = await mailchimpResolveTagSegmentHit(listId, tagName, mcBase, mcAuth);
  if (!hit) return null;
  const segRes = await fetch(`${mcBase}/lists/${listId}/segments/${hit.id}?fields=member_count`, { headers });
  if (!segRes.ok) {
    const t = await segRes.text();
    console.log(`[Mailchimp] GET segment ${hit.id} list ${listId}: ${segRes.status} ${t.slice(0, 220)}`);
    return null;
  }
  const seg = await segRes.json();
  return typeof seg.member_count === 'number' ? seg.member_count : null;
}

/** MD5 hash přihlášení — musí odpovídat Mailchimp subscriber_hash (lowercase e-mail). */
function mailchimpSubscriberHash(member: any): string {
  const e = String(member?.email_address ?? member?.email ?? '').trim().toLowerCase();
  return md5(e);
}

/** Tagy z těla člena (GET /members/{hash} vrací tags[] s { name }). */
function tagsFromMemberObject(member: any): string[] {
  const raw = member?.tags;
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
}

/** Popisky merge polí (MMERGEn → „Škola“) — jednou na audience. */
async function mailchimpFetchMergeFieldLabels(
  listId: string,
  mcBase: string,
  mcAuth: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let offset = 0;
  const count = 100;
  const headers = { Authorization: `Basic ${mcAuth}` };
  while (true) {
    const res = await fetch(
      `${mcBase}/lists/${listId}/merge-fields?count=${count}&offset=${offset}`,
      { headers },
    );
    if (!res.ok) break;
    const j = await res.json();
    const fields = j.merge_fields || [];
    for (const f of fields) {
      if (f.tag && f.name) out[String(f.tag)] = String(f.name);
    }
    if (fields.length < count) break;
    offset += count;
  }
  return out;
}

/** Škola / další merge pole (FNAME, LNAME, PHONE zobrazujeme zvlášť). */
function mergeFieldsSchoolAndExtra(
  mf: Record<string, unknown>,
  labelByTag?: Record<string, string>,
): { school: string; extra: string } {
  const skip = new Set(['FNAME', 'LNAME', 'PHONE']);
  const schoolBits: string[] = [];
  const extraBits: string[] = [];
  const schoolRe =
    /school|skol|škola|instit|company|zaměst|zamest|ico|ičo|i[čc]o|org|firma|instituce|organizace|pozice|funkce|titul|role|učitel|ucitel|gymn|zš|zs|střední|stredni|ss|mateřsk|matersk|mš|ms/i;

  for (const [k, v] of Object.entries(mf)) {
    if (skip.has(k)) continue;
    const s = String(v ?? '').trim();
    if (!s) continue;
    const label = (labelByTag && labelByTag[k]) ? String(labelByTag[k]) : '';
    const combined = `${label} ${k}`.toLowerCase();
    if (schoolRe.test(combined)) {
      schoolBits.push(label ? `${label}: ${s}` : s);
    } else {
      extraBits.push(label ? `${label}: ${s}` : `${k}: ${s}`);
    }
  }
  return {
    school: schoolBits.join(' · '),
    extra: extraBits.join(' · '),
  };
}

async function mailchimpMemberTagNames(
  listId: string,
  member: any,
  mcBase: string,
  mcAuth: string,
): Promise<string[]> {
  const fromObj = tagsFromMemberObject(member);
  if (fromObj.length > 0) return fromObj;
  const hash = mailchimpSubscriberHash(member);
  if (!hash) return [];
  const res = await fetch(`${mcBase}/lists/${listId}/members/${hash}/tags`, {
    headers: { Authorization: `Basic ${mcAuth}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status !== 404) {
      console.log(`[Mailchimp] member tags ${hash.slice(0, 8)}…: ${res.status} ${t.slice(0, 120)}`);
    }
    return [];
  }
  const j = await res.json();
  return (j.tags || []).map((x: any) => x.name).filter(Boolean);
}

async function mailchimpEnrichMembersForAdmin(
  listId: string,
  raw: any[],
  mcBase: string,
  mcAuth: string,
): Promise<any[]> {
  const labelByTag = await mailchimpFetchMergeFieldLabels(listId, mcBase, mcAuth);
  const batch = 8;
  const out: any[] = [];
  const headers = { Authorization: `Basic ${mcAuth}` };
  for (let i = 0; i < raw.length; i += batch) {
    const slice = raw.slice(i, i + batch);
    const part = await Promise.all(slice.map(async (m: any) => {
      const hash = mailchimpSubscriberHash(m);
      let full: any = m;
      try {
        const res = await fetch(`${mcBase}/lists/${listId}/members/${hash}`, { headers });
        if (res.ok) full = await res.json();
      } catch {
        /* segment data only */
      }
      const segMf = (m.merge_fields && typeof m.merge_fields === 'object')
        ? m.merge_fields as Record<string, unknown>
        : {};
      const fullMf = (full.merge_fields && typeof full.merge_fields === 'object')
        ? full.merge_fields as Record<string, unknown>
        : {};
      const mf = { ...segMf, ...fullMf };
      const { school, extra } = mergeFieldsSchoolAndExtra(mf, labelByTag);
      let tags = tagsFromMemberObject(full);
      if (tags.length === 0) {
        tags = await mailchimpMemberTagNames(listId, { ...full, email_address: full.email_address || m.email_address }, mcBase, mcAuth);
      }
      return {
        email: String(full.email_address || m.email_address || ''),
        firstName: String(mf.FNAME || ''),
        lastName: String(mf.LNAME || ''),
        phone: String(mf.PHONE || ''),
        status: String(full.status || m.status || ''),
        school,
        mergeExtra: extra,
        tags,
      };
    }));
    out.push(...part);
  }
  return out;
}

async function mailchimpFetchAllSegmentMembers(
  listId: string,
  segmentId: number,
  mcBase: string,
  mcAuth: string,
): Promise<any[]> {
  const headers = { Authorization: `Basic ${mcAuth}` };
  const all: any[] = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    /** Bez `fields` — omezené fields umí u některých účtů vracet prázdná merge_fields / chybu. */
    const url = `${mcBase}/lists/${listId}/segments/${segmentId}/members?count=${page}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const t = await res.text();
      console.log(`[Mailchimp] segment members ${segmentId}: ${res.status} ${t.slice(0, 220)}`);
      break;
    }
    const j = await res.json();
    const members = j.members || [];
    all.push(...members);
    if (members.length < page) break;
    offset += page;
  }
  return all;
}

function stripDiacriticsCs(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[’ʼ]/g, "'").replace(/[–—]/g, '-');
}

/**
 * Kandidátní názvy tagů v Mailchimp: explicitní z CMS, webinar-{slug},
 * a tagy nalezené podle prefixu titulku + roku (kampaně často používají
 * „Název – datum“ místo technického webinar-slug).
 */
async function mailchimpCollectCandidateTagNamesForWebinar(
  w: any,
  listId: string,
  mcBase: string,
  mcAuth: string,
): Promise<string[]> {
  const slug = String(w.slug || w.id || '').trim() || w.id;
  const set = new Set<string>();
  const explicit = w.mailchimpTagName && String(w.mailchimpTagName).trim();
  if (explicit) set.add(explicit);
  set.add(`webinar-${slug}`);

  const title = stripDiacriticsCs(String(w.title || '')).replace(/\s+/g, ' ').trim();
  if (title.length >= 4) {
    const prefix = title.slice(0, 48);
    const res = await fetch(
      `${mcBase}/lists/${listId}/tag-search?name=${encodeURIComponent(prefix)}`,
      { headers: { Authorization: `Basic ${mcAuth}` } },
    );
    if (res.ok) {
      const j = await res.json();
      const tags = (j.tags || []) as Array<{ name: string }>;
      const y = String(w.year);
      const frag = title.slice(0, 16).toLowerCase();
      for (const t of tags) {
        if (!t.name.includes(y)) continue;
        const tn = stripDiacriticsCs(t.name).toLowerCase();
        if (tn.startsWith(frag.slice(0, 8)) || tn.includes(frag.slice(0, 12))) {
          set.add(t.name);
        }
      }
    }
  }
  return [...set];
}

/** Vybere tag s nejvyšším počtem v **jedné** admin audience (shoda s MC UI). */
async function mailchimpBestTagForWebinar(w: any): Promise<{ count: number | null; tag: string }> {
  const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
  const adminListId = getMailchimpAdminListId();
  const slug = String(w.slug || w.id || '').trim() || w.id;
  const fallbackTag = `webinar-${slug}`;
  if (!mcApiKey || !adminListId) {
    return { count: null, tag: (w.mailchimpTagName && String(w.mailchimpTagName).trim()) || fallbackTag };
  }
  const dc = mcApiKey.split('-').pop() || 'us19';
  const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
  const mcAuth = btoa(`anystring:${mcApiKey}`);
  const names = await mailchimpCollectCandidateTagNamesForWebinar(w, adminListId, mcBase, mcAuth);
  let bestTag = (w.mailchimpTagName && String(w.mailchimpTagName).trim()) || fallbackTag;
  let bestCount = -1;
  for (const name of names) {
    const total = await mailchimpTagCountOnAdminList(name);
    if (total == null) continue;
    if (total > bestCount) {
      bestCount = total;
      bestTag = name;
    }
  }
  if (bestCount < 0) return { count: null, tag: bestTag };
  return { count: bestCount, tag: bestTag };
}

/** Počet kontaktů s tagem jen v admin audience (nesčítat dva listy). */
async function mailchimpTagCountOnAdminList(tagName: string): Promise<number | null> {
  const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
  const listId = getMailchimpAdminListId();
  if (!mcApiKey || !listId) return null;
  const dc = mcApiKey.split('-').pop() || 'us19';
  const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
  const mcAuth = btoa(`anystring:${mcApiKey}`);
  return mailchimpMemberCountForTag(listId, tagName, mcBase, mcAuth);
}

const MAILCHIMP_WEBINAR_TAG_CACHE_MS = 5 * 60 * 1000;

async function mailchimpWebinarTagCountCached(w: any): Promise<{ count: number | null; tag: string }> {
  const slug = String(w.slug || w.id || '').trim() || w.id;
  const cacheKey = `mailchimp_webinar_tag_best_v4_${slug}`;
  try {
    const cached = await kv.get(cacheKey) as { count?: number; tag?: string; expiresAt?: number } | null;
    if (
      cached && typeof cached.count === 'number' && typeof cached.tag === 'string' &&
      typeof cached.expiresAt === 'number' && cached.expiresAt > Date.now()
    ) {
      return { count: cached.count, tag: cached.tag };
    }
  } catch {
    /* ignore */
  }
  const { count, tag } = await mailchimpBestTagForWebinar(w);
  if (count != null) {
    try {
      await kv.set(cacheKey, { count, tag, expiresAt: Date.now() + MAILCHIMP_WEBINAR_TAG_CACHE_MS });
    } catch {
      /* ignore */
    }
  }
  return { count, tag };
}

/**
 * Více tagů v jednom parametru: `tagA|tagB` (admin UI přidává tagy jako čipy).
 * Nesmí být v názvu samotného tagu znak `|`.
 */
function parseMailchimpMultiTagOverride(raw: string | undefined | null): string[] | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  const parts = [...new Set(s.split('|').map((t) => t.trim()).filter(Boolean))];
  return parts.length ? parts : null;
}

/** Kontakty z Mailchimp — výchozí stejný tag jako u registrací; `overrideTag` = jeden tag nebo `a|b` pro sjednocení. */
async function mailchimpFetchFollowupRecipientsForWebinar(
  w: any,
  overrideTag?: string,
): Promise<{
  rows: { email: string; name: string }[];
  tag: string;
  error?: string;
}> {
  const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
  const adminListId = getMailchimpAdminListId();
  if (!mcApiKey || !adminListId) {
    return { rows: [], tag: '', error: 'Mailchimp není nakonfigurován (MAILCHIMP_API_KEY / audience).' };
  }
  try {
    const multi = parseMailchimpMultiTagOverride(overrideTag);
    const tagsToFetch = multi && multi.length
      ? multi
      : [(await mailchimpWebinarTagCountCached(w)).tag];
    const tagLabel = tagsToFetch.join(' + ');
    const dc = mcApiKey.split('-').pop() || 'us19';
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = btoa(`anystring:${mcApiKey}`);
    const rowMap = new Map<string, { email: string; name: string }>();
    const errors: string[] = [];
    for (const tag of tagsToFetch) {
      const hit = await mailchimpResolveTagSegmentHit(adminListId, tag, mcBase, mcAuth);
      if (!hit) {
        errors.push(`Tag v Mailchimp nenalezen v admin audience: ${tag}`);
        continue;
      }
      const raw = await mailchimpFetchAllSegmentMembers(adminListId, hit.id, mcBase, mcAuth);
      for (const m of raw) {
        const status = String(m?.status || '').toLowerCase();
        if (status === 'unsubscribed' || status === 'cleaned') continue;
        const email = String(m?.email_address || '').toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
        if (rowMap.has(email)) continue;
        const mf = m.merge_fields || {};
        const fn = String(mf.FNAME || '').trim();
        const ln = String(mf.LNAME || '').trim();
        const name = [fn, ln].filter(Boolean).join(' ') || email.split('@')[0];
        rowMap.set(email, { email, name });
      }
    }
    const rows = [...rowMap.values()];
    if (rows.length === 0 && errors.length) {
      return { rows: [], tag: tagLabel, error: errors.join('; ') };
    }
    return {
      rows,
      tag: tagLabel,
      error: errors.length ? errors.join('; ') : undefined,
    };
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.log(`[Mailchimp] followup recipients: ${msg}`);
    return { rows: [], tag: '', error: msg };
  }
}

function mergeKvAndMailchimpFollowupRecipients(
  kv: { email: string; name: string }[],
  mc: { email: string; name: string }[],
): { email: string; name: string }[] {
  const map = new Map<string, { email: string; name: string }>();
  for (const r of kv) {
    const e = r.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) continue;
    const name = (r.name || '').trim() || e.split('@')[0];
    map.set(e, { email: e, name });
  }
  for (const r of mc) {
    const e = r.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) continue;
    if (map.has(e)) continue;
    const name = (r.name || '').trim() || e.split('@')[0];
    map.set(e, { email: e, name });
  }
  return [...map.values()];
}

const CS_MONTH_NAMES_ADMIN = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

/** Jednotný čas začátku webináře pro řazení (den + měsíc + rok + volitelně čas). */
function webinarEventTimestampMs(w: {
  year: number;
  monthNum?: number;
  day: number;
  monthName?: string;
  time?: string;
}): number {
  let monthIdx = 0;
  if (typeof w.monthNum === 'number' && w.monthNum >= 1 && w.monthNum <= 12) {
    monthIdx = w.monthNum - 1;
  } else if (w.monthName) {
    const mn = String(w.monthName).trim().toLowerCase();
    const idx = CS_MONTH_NAMES_ADMIN.findIndex((m) => m.toLowerCase() === mn);
    if (idx >= 0) monthIdx = idx;
  }
  const d = new Date(w.year, monthIdx, Number(w.day) || 1);
  const t = w.time ? String(w.time).match(/^(\d{1,2}):(\d{2})/) : null;
  if (t) d.setHours(parseInt(t[1], 10), parseInt(t[2], 10), 0, 0);
  return d.getTime();
}

/* ── Admin: registrace prehled (zatím jen plánované — Mailchimp × N minulých = timeout) ─ */
app.get('/make-server-93a20b6f/admin/registrace', async (c) => {
  try {
    const webinarsAll = await getCollection(WEBINARS_KEY);
    const webinars = (webinarsAll as any[]).filter((w) => !w.isPast);
    const results: any[] = [];
    for (const w of webinars) {
      const prefix = `webinar_reg_${w.id}_`;
      const regs = await kv.getByPrefix(prefix);
      const attended = regs.filter((r: any) => r.attended).length;
      const withTrial = regs.filter((r: any) => r.trialToken).length;
      const slug = String(w.slug || w.id || '').trim() || w.id;
      let mailchimpTag = `webinar-${slug}`;
      let mailchimpTagCount: number | null = null;
      try {
        const mc = await mailchimpWebinarTagCountCached(w);
        mailchimpTagCount = mc.count;
        mailchimpTag = mc.tag;
      } catch (e: any) {
        console.log(`[Admin] Mailchimp tag count webinar ${slug}: ${e?.message || e}`);
      }
      results.push({
        webinarId: w.id,
        webinarTitle: w.title,
        day: w.day,
        monthName: w.monthName,
        monthNum: w.monthNum,
        year: w.year,
        time: w.time,
        isPast: w.isPast,
        total: regs.length,
        attended,
        withTrial,
        registrations: regs,
        mailchimpTag,
        mailchimpTagCount,
      });
    }
    results.sort((a: any, b: any) => webinarEventTimestampMs(a) - webinarEventTimestampMs(b));
    return c.json({ webinars: results, scope: 'upcoming_only' });
  } catch (err: any) {
    console.log(`[Admin] Registrace prehled chyba: ${err.message}`);
    return c.json({ error: `Chyba: ${err.message}` }, 500);
  }
});

/** CSV kontaktů z Mailchimp — stejný tag a **jedna** audience jako číslo (MAILCHIMP_AUDIENCE_PRIMARY nebo NEWSLETTER). */
app.get('/make-server-93a20b6f/admin/registrace/mailchimp-csv/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
    const adminListId = getMailchimpAdminListId();
    if (!mcApiKey || !adminListId) {
      return c.json({ error: 'Chybí Mailchimp API nebo audience (MAILCHIMP_AUDIENCE_PRIMARY / NEWSLETTER).' }, 503);
    }
    const webinarsAll = await getCollection(WEBINARS_KEY);
    const w = (webinarsAll as any[]).find((x) => String(x.id) === String(webinarId));
    if (!w) return c.json({ error: 'Webinář nenalezen.' }, 404);

    const dc = mcApiKey.split('-').pop() || 'us19';
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = btoa(`anystring:${mcApiKey}`);

    const qTag = c.req.query('mailchimpTag')?.trim() || c.req.query('tag')?.trim() || '';
    const multi = parseMailchimpMultiTagOverride(qTag);
    const defaultMc = await mailchimpWebinarTagCountCached(w);
    const tagsToUse = multi && multi.length ? multi : [defaultMc.tag];

    const memberByEmail = new Map<string, any>();
    const tagErrors: string[] = [];
    for (const tag of tagsToUse) {
      const hit = await mailchimpResolveTagSegmentHit(adminListId, tag, mcBase, mcAuth);
      if (!hit) {
        tagErrors.push(`Tag v Mailchimp nenalezen v admin audience: ${tag}`);
        continue;
      }
      const segMembers = await mailchimpFetchAllSegmentMembers(adminListId, hit.id, mcBase, mcAuth);
      for (const m of segMembers) {
        const em = String(m?.email_address || '').toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) continue;
        if (!memberByEmail.has(em)) memberByEmail.set(em, m);
      }
    }
    if (memberByEmail.size === 0 && tagErrors.length) {
      return c.json({ error: tagErrors.join('; ') }, 404);
    }
    const members = [...memberByEmail.values()];

    const rows: string[][] = [
      ['E-mail', 'Jméno', 'Příjmení', 'Telefon', 'Stav'],
      ...members.map((m: any) => {
        const mf = m.merge_fields || {};
        return [
          m.email_address || '',
          String(mf.FNAME || ''),
          String(mf.LNAME || ''),
          String(mf.PHONE || ''),
          String(m.status || ''),
        ];
      }),
    ];
    const csvContent = '\uFEFF' + rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const safeName = String(w.slug || w.id).replace(/[^a-z0-9]+/gi, '-').slice(0, 80) || 'webinar';
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="mailchimp-${safeName}.csv"`);
    return c.body(csvContent);
  } catch (err: any) {
    console.log(`[Admin] Mailchimp CSV chyba: ${err.message}`);
    return c.json({ error: `Chyba: ${err.message}` }, 500);
  }
});

/** JSON kontaktů v Mailchimp (stejný tag + audience jako číslo) — pro zobrazení v admin dlaždici. */
app.get('/make-server-93a20b6f/admin/registrace/mailchimp-members/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
    const adminListId = getMailchimpAdminListId();
    if (!mcApiKey || !adminListId) {
      return c.json({ error: 'Chybí Mailchimp API nebo audience (MAILCHIMP_AUDIENCE_PRIMARY / NEWSLETTER).' }, 503);
    }
    const webinarsAll = await getCollection(WEBINARS_KEY);
    const w = (webinarsAll as any[]).find((x) => String(x.id) === String(webinarId));
    if (!w) return c.json({ error: 'Webinář nenalezen.' }, 404);

    const dc = mcApiKey.split('-').pop() || 'us19';
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = btoa(`anystring:${mcApiKey}`);

    const qTag = c.req.query('mailchimpTag')?.trim() || c.req.query('tag')?.trim() || '';
    const multi = parseMailchimpMultiTagOverride(qTag);
    const defaultMc = await mailchimpWebinarTagCountCached(w);
    const tagsToUse = multi && multi.length ? multi : [defaultMc.tag];
    const tag = tagsToUse.join(' + ');

    const memberByEmail = new Map<string, any>();
    const tagErrors: string[] = [];
    for (const tname of tagsToUse) {
      const hit = await mailchimpResolveTagSegmentHit(adminListId, tname, mcBase, mcAuth);
      if (!hit) {
        tagErrors.push(`Tag v Mailchimp nenalezen v admin audience: ${tname}`);
        continue;
      }
      const segRaw = await mailchimpFetchAllSegmentMembers(adminListId, hit.id, mcBase, mcAuth);
      for (const m of segRaw) {
        const em = String(m?.email_address || '').toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) continue;
        if (!memberByEmail.has(em)) memberByEmail.set(em, m);
      }
    }
    if (memberByEmail.size === 0 && tagErrors.length) {
      return c.json({ error: tagErrors.join('; ') }, 404);
    }
    const raw = [...memberByEmail.values()];
    const lite =
      c.req.query('lite') === '1' ||
      c.req.query('lite') === 'true' ||
      c.req.query('fast') === '1';
    const members = lite
      ? raw.map((m: any) => {
        const mf = m.merge_fields || {};
        return {
          email: String(m.email_address || ''),
          firstName: String(mf.FNAME || ''),
          lastName: String(mf.LNAME || ''),
          phone: String(mf.PHONE || ''),
          status: String(m.status || ''),
          school: '',
          mergeExtra: '',
          tags: [] as string[],
        };
      })
      : await mailchimpEnrichMembersForAdmin(adminListId, raw, mcBase, mcAuth);
    return c.json({ tag, members, lite: !!lite });
  } catch (err: any) {
    console.log(`[Admin] Mailchimp members JSON chyba: ${err.message}`);
    return c.json({ error: err?.message ? String(err.message) : 'Neznámá chyba při načítání Mailchimp kontaktů.' }, 500);
  }
});

/** Našeptávač názvů tagů v admin audience (Mailchimp tag-search + member_count u každého). */
async function adminMailchimpTagSuggestHandler(c: Context) {
  try {
    const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
    const adminListId = getMailchimpAdminListId();
    if (!mcApiKey || !adminListId) {
      return c.json({ error: 'Chybí Mailchimp API nebo audience (MAILCHIMP_AUDIENCE_PRIMARY / NEWSLETTER).' }, 503);
    }
    const q = (c.req.query('q') || '').trim();
    if (q.length < 1) {
      return c.json({ tags: [] as { name: string; memberCount: number | null }[] });
    }
    const dc = mcApiKey.split('-').pop() || 'us19';
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = btoa(`anystring:${mcApiKey}`);
    const found = await mailchimpFetchTagsByPrefix(adminListId, q.slice(0, 80), mcBase, mcAuth);
    const seen = new Set<string>();
    const uniq: Array<{ id: number; name: string }> = [];
    for (const t of found) {
      if (!t?.name || seen.has(t.name)) continue;
      seen.add(t.name);
      uniq.push({ id: t.id, name: t.name });
      if (uniq.length >= 16) break;
    }
    const tags = await Promise.all(
      uniq.map(async (t) => ({
        name: t.name,
        memberCount: await mailchimpMemberCountForTag(adminListId, t.name, mcBase, mcAuth),
      })),
    );
    return c.json({ tags });
  } catch (err: any) {
    console.log(`[Admin] mailchimp-tag-suggest: ${err.message}`);
    return c.json({ error: err?.message ? String(err.message) : 'Chyba' }, 500);
  }
}

app.get('/make-server-93a20b6f/admin/mailchimp-tag-suggest', adminMailchimpTagSuggestHandler);
app.get('/admin/mailchimp-tag-suggest', adminMailchimpTagSuggestHandler);

const MARKETING_CONTACTS_TABLE = 'marketing_contacts_93a20b6f';
const MARKETING_CONTACTS_META_KEY = 'marketing_contacts_sync_meta_v1';
const MARKETING_CONTACTS_PROGRESS_KEY = 'marketing_contacts_sync_progress_v1';

/**
 * Import audience z Mailchimp po dávkách (max 5 stránek / volání ≈ 5k řádků),
 * aby Edge funkce neskončila 504. Klient nebo cron volá opakovaně, dokud `done: true`.
 */
async function marketingContactsSyncFromMailchimp(opts: { reset?: boolean }): Promise<{
  synced: number;
  syncedThisRun: number;
  listId: string;
  done: boolean;
  offset: number;
}> {
  if (opts.reset) {
    try {
      await kv.del(MARKETING_CONTACTS_PROGRESS_KEY);
    } catch {
      /* ignore */
    }
  }

  const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
  const listId = getMailchimpAdminListId();
  const sb = getServiceSupabaseClient();
  if (!mcApiKey || !listId) throw new Error('Mailchimp nebo audience není nastaveno.');
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY není nakonfigurován.');

  const dc = mcApiKey.split('-').pop() || 'us19';
  const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
  const mcAuth = btoa(`anystring:${mcApiKey}`);
  const labelByTag = await mailchimpFetchMergeFieldLabels(listId, mcBase, mcAuth);
  const headers = { Authorization: `Basic ${mcAuth}` };

  const page = 1000;
  const maxPagesPerInvocation = 5;

  const prev = (opts.reset ? null : (await kv.get(MARKETING_CONTACTS_PROGRESS_KEY)) as {
    offset: number;
    totalLoaded: number;
    listId: string;
  } | null);

  let offset = prev?.offset ?? 0;
  let totalLoaded = prev?.totalLoaded ?? 0;
  let syncedThisRun = 0;
  let pagesThisRun = 0;

  while (pagesThisRun < maxPagesPerInvocation) {
    const res = await fetch(
      `${mcBase}/lists/${listId}/members?count=${page}&offset=${offset}`,
      { headers },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Mailchimp members ${res.status}: ${t.slice(0, 400)}`);
    }
    const j = await res.json();
    const members = j.members || [];
    const rows = members.map((m: any) => {
      const mf = (m.merge_fields && typeof m.merge_fields === 'object')
        ? m.merge_fields as Record<string, unknown>
        : {};
      const { school, extra } = mergeFieldsSchoolAndExtra(mf, labelByTag);
      const tags = tagsFromMemberObject(m);
      const email = String(m.email_address || '').toLowerCase().trim();
      const schoolText = [school, extra].filter(Boolean).join(' · ').slice(0, 4000) || null;
      return {
        email_hash: md5(email),
        email,
        list_id: listId,
        status: String(m.status || ''),
        merge_fields: mf,
        tags,
        school: schoolText,
        synced_at: new Date().toISOString(),
      };
    });
    if (rows.length) {
      const chunk = 400;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await sb.from(MARKETING_CONTACTS_TABLE).upsert(slice, { onConflict: 'email_hash' });
        if (error) throw new Error(error.message);
      }
    }
    syncedThisRun += rows.length;
    totalLoaded += rows.length;

    if (members.length < page) {
      await kv.set(MARKETING_CONTACTS_META_KEY, {
        lastSyncedAt: new Date().toISOString(),
        totalRows: totalLoaded,
        listId,
      });
      try {
        await kv.del(MARKETING_CONTACTS_PROGRESS_KEY);
      } catch {
        /* ignore */
      }
      return {
        synced: totalLoaded,
        syncedThisRun,
        listId,
        done: true,
        offset: 0,
      };
    }

    offset += page;
    pagesThisRun++;
  }

  await kv.set(MARKETING_CONTACTS_PROGRESS_KEY, {
    offset,
    totalLoaded,
    listId,
  });
  return {
    synced: totalLoaded,
    syncedThisRun,
    listId,
    done: false,
    offset,
  };
}

/** Meta posledního syncu (KV). */
app.get('/make-server-93a20b6f/admin/marketing/contacts/meta', async (c) => {
  try {
    const meta = (await kv.get(MARKETING_CONTACTS_META_KEY)) as {
      lastSyncedAt?: string;
      totalRows?: number;
      listId?: string;
    } | null;
    return c.json(meta || { lastSyncedAt: null, totalRows: 0, listId: null });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/** Ruční / cron sync z Mailchimp — jedno volání = max ~5k řádků; opakujte, dokud `done: true`. Body: `{ "reset": true }` = začít znovu od offsetu 0. */
app.post('/make-server-93a20b6f/admin/marketing/contacts/sync', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const reset = !!(body as { reset?: boolean }).reset;
    const r = await marketingContactsSyncFromMailchimp({ reset });
    console.log(
      `[Marketing contacts] Sync batch: +${r.syncedThisRun} (celkem ${r.synced}), done=${r.done}, list ${r.listId}`,
    );
    return c.json({
      ok: true,
      synced: r.synced,
      syncedThisRun: r.syncedThisRun,
      listId: r.listId,
      done: r.done,
      offset: r.offset,
    });
  } catch (e: any) {
    console.log(`[Marketing contacts] Sync chyba: ${e.message}`);
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/** Filtrovaný výpis lokální kopie kontaktů. */
app.get('/make-server-93a20b6f/admin/marketing/contacts', async (c) => {
  try {
    const sb = getServiceSupabaseClient();
    if (!sb) return c.json({ error: 'Supabase service role není nakonfigurován.' }, 503);
    const q = (c.req.query('q') || '').trim();
    const school = (c.req.query('school') || '').trim();
    const tag = (c.req.query('tag') || '').trim();
    const status = (c.req.query('status') || '').trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') || '50', 10) || 50));
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10) || 0);

    let query = sb.from(MARKETING_CONTACTS_TABLE).select('*', { count: 'exact' });
    if (q) query = query.ilike('email', `%${q}%`);
    if (school) query = query.ilike('school', `%${school}%`);
    if (tag) query = query.contains('tags', [tag]);
    if (status === 'subscribed') {
      query = query.in('status', ['subscribed', 'SUBSCRIBED']);
    } else if (status === 'unsubscribed') {
      query = query.in('status', ['unsubscribed', 'UNSUBSCRIBED']);
    }
    query = query.order('email', { ascending: true }).range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ rows: data || [], total: count ?? 0, limit, offset });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/** Účast na webinářích z KV (po řádcích e-mail — více webinářů najednou). */
app.post('/make-server-93a20b6f/admin/marketing/contacts/webinar-attendance', async (c) => {
  try {
    const body = await c.req.json();
    const raw = body?.emails;
    if (!Array.isArray(raw)) return c.json({ error: 'Očekáváme pole emails.' }, 400);
    const emails = raw
      .map((e: unknown) => String(e).toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 80);
    const byEmail: Record<string, WebinarEmailIdxEntry[]> = {};
    for (const email of emails) {
      byEmail[email] = await getWebinarEmailIndexRows(email);
    }
    return c.json({ byEmail });
  } catch (e: any) {
    return c.json({ error: e.message || String(e) }, 500);
  }
});

/* ── Newsletter / Trial subscribe (from /vyzkousejte form) ─────── */
app.post('/make-server-93a20b6f/newsletter-subscribe', async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, phone, position, newsletter, gdpr, source } = body;
    if (!email || !name) return c.json({ error: 'Chybí jméno nebo e-mail.' }, 400);

    const cleanEmail = email.toLowerCase().trim();
    const emailGate = await assertEmailDeliverable(cleanEmail);
    if (!emailGate.ok) return c.json({ error: emailGate.message }, 400);

    const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
    const newsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NEWSLETTER');
    const noNewsletterAudienceId = Deno.env.get('MAILCHIMP_AUDIENCE_NO_NEWSLETTER');
    const audienceId = newsletter ? newsletterAudienceId : noNewsletterAudienceId;

    if (mcApiKey && audienceId) {
      try {
        const subscriberHash = md5(cleanEmail);
        const dc = mcApiKey.split('-').pop() || 'us19';
        const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
        const mcAuth = btoa(`anystring:${mcApiKey}`);
        const nameParts = name.trim().split(' ');
        const fname = nameParts[0] || '';
        const lname = nameParts.slice(1).join(' ') || '';

        // Check if contact already exists
        const checkRes = await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${mcAuth}` },
        });

        if (checkRes.status === 404) {
          // NEW contact — create as subscribed
          const createRes = await fetch(`${mcBase}/lists/${audienceId}/members`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email_address: cleanEmail,
              status: 'subscribed',
              merge_fields: { FNAME: fname, LNAME: lname, PHONE: phone?.trim() || '' },
            }),
          });
          if (createRes.ok) {
            console.log(`[Newsletter] Novy kontakt vytvoren: ${cleanEmail} -> ${audienceId}`);
          } else {
            const e = await createRes.text();
            console.log(`[Newsletter] Create selhal: ${createRes.status} ${e.slice(0, 200)}`);
          }
        } else if (checkRes.ok) {
          // EXISTING contact — only PATCH merge fields, status beze zmeny
          console.log(`[Newsletter] Existujici kontakt: ${cleanEmail} -> pouze tag`);
          await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              merge_fields: { FNAME: fname, LNAME: lname, PHONE: phone?.trim() || '' },
            }),
          });
        }

        // Add tags regardless (new or existing)
        await fetch(`${mcBase}/lists/${audienceId}/members/${subscriberHash}/tags`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tags: [
              { name: 'trial-zadost', status: 'active' },
              { name: source || 'web-form', status: 'active' },
              ...(newsletter ? [{ name: 'newsletter', status: 'active' }] : []),
            ],
          }),
        });

        console.log(`[Newsletter] Hotovo: ${cleanEmail} -> ${audienceId}`);
      } catch (mcErr: any) {
        console.log(`[Newsletter] Mailchimp chyba: ${mcErr.message}`);
      }
    }

    // Uložit záznam o trial žádosti (pro dedup check, 6měsíční cooldown)
    const trialKey = `trial_request_email_${cleanEmail}`;
    const existingTrial = await kv.get(trialKey);
    const now2 = new Date();
    const trialRecord = {
      email: cleanEmail,
      name,
      schoolName: body.schoolName || '',
      ico: body.ico || '',
      position,
      source: source || 'trial-form',
      requestedAt: now2.toISOString(),
      cooldownUntil: new Date(now2.getTime() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
      count: (existingTrial?.count || 0) + 1,
    };
    await kv.set(trialKey, trialRecord);
    console.log(`[Trial] Ulozen zaznam trial zadosti: ${cleanEmail}`);

    return c.json({ success: true });
  } catch (err: any) {
    console.log(`[Newsletter] Chyba: ${err.message}`);
    return c.json({ error: `Chyba: ${err.message}` }, 500);
  }
});

/* ── GET validate-email (formát + DNS MX/A) ─────────────────────── */
const validateEmailHandler = async (c: Context) => {
  const email = String(c.req.query('email') || '').trim();
  const r = await assertEmailDeliverable(email);
  if (!r.ok) return c.json({ ok: false, message: r.message });
  return c.json({ ok: true });
};
app.get('/make-server-93a20b6f/validate-email', validateEmailHandler);
app.get('/validate-email', validateEmailHandler);

/**
 * Veřejný publishable key pro Stripe.js.
 * Supabase Secrets: STRIPE_PUBLISHABLE_KEY nebo VITE_STRIPE_PUBLISHABLE_KEY (hodnota vždy pk_test_… / pk_live_…).
 */
const stripePublishableKeyHandler = async (c: Context) => {
  const pk =
    (Deno.env.get('STRIPE_PUBLISHABLE_KEY')?.trim() ||
      Deno.env.get('VITE_STRIPE_PUBLISHABLE_KEY')?.trim() ||
      '');
  if (!pk.startsWith('pk_test_') && !pk.startsWith('pk_live_')) {
    return c.json({ publishableKey: null as string | null });
  }
  return c.json({ publishableKey: pk });
};
app.get('/make-server-93a20b6f/stripe-publishable-key', stripePublishableKeyHandler);
app.get('/stripe-publishable-key', stripePublishableKeyHandler);

/* ── Check trial email (dedup, 6mesicni cooldown) ──────────────── */
app.get('/make-server-93a20b6f/check-trial-email', async (c) => {
  const email = c.req.query('email') || '';
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) {
    return c.json({ canRequest: true, alreadyRequested: false });
  }
  if (!isValidEmailFormat(cleanEmail)) {
    return c.json({
      canRequest: false,
      alreadyRequested: false,
      emailInvalid: true,
      message: EMAIL_FORMAT_HINT_CS,
    });
  }
  try {
    const trialKey = `trial_request_email_${cleanEmail}`;
    const record = await kv.get(trialKey);
    if (!record) {
      return c.json({ canRequest: true, alreadyRequested: false });
    }
    const cooldownUntil = record.cooldownUntil ? new Date(record.cooldownUntil) : null;
    const now = new Date();
    if (cooldownUntil && cooldownUntil > now) {
      const daysLeft = Math.ceil((cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const cooldownDateStr = cooldownUntil.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
      return c.json({
        canRequest: false,
        alreadyRequested: true,
        requestedAt: record.requestedAt,
        cooldownUntil: record.cooldownUntil,
        cooldownDateStr,
        daysLeft,
        count: record.count || 1,
      });
    }
    return c.json({ canRequest: true, alreadyRequested: true, requestedAt: record.requestedAt, cooldownExpired: true });
  } catch (err: any) {
    console.log(`[TrialEmailCheck] Chyba: ${err.message}`);
    return c.json({ canRequest: true, alreadyRequested: false });
  }
});

/* ── SEO: robots.txt ─────────────���─────────────────────────────── */
app.get('/make-server-93a20b6f/robots.txt', (c) => {
  const robotsTxt = `# Vividbooks robots.txt
# https://www.vividbooks.com

User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*

# AI crawlers — explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: FacebookBot
Allow: /

User-agent: Applebot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: cohere-ai
Allow: /

Sitemap: https://www.vividbooks.com/api/sitemap.xml
`;
  return c.body(robotsTxt, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

/* ── SEO: llms.txt ─────────────────────────────────────────────── */
app.get('/make-server-93a20b6f/llms.txt', (c) => {
  const llmsTxt = `# Vividbooks

> Vividbooks je česká platforma interaktivních digitálních učebnic pro základní školy (1. i 2. stupeň). Učebnice obsahují animace, interaktivní prvky, 3D modely, badatelské listy a testy. Všechny materiály jsou v souladu s RVP a mají doložky MŠMT.

## Předměty

### 2. stupeň
- [Matematika 2. stupeň](https://www.vividbooks.com/predmet/matematika-2-stupen): Interaktivní digitální učebnice a pracovní sešity matematiky pro 6.–9. ročník ZŠ
- [Fyzika](https://www.vividbooks.com/predmet/fyzika): Animované experimenty, simulace a interaktivní lekce fyziky
- [Přírodopis](https://www.vividbooks.com/predmet/prirodopis): 3D modely, interaktivní lekce a badatelské listy z přírodopisu
- [Chemie](https://www.vividbooks.com/predmet/chemie): Digitální učebnice chemie s animovanými reakcemi a pokusy

### 1. stupeň
- [Matematika 1. stupeň](https://www.vividbooks.com/predmet/matematika-1-stupen): Pracovní sešity a digitální materiály pro 1.–5. ročník ZŠ
- [Český jazyk](https://www.vividbooks.com/predmet/cesky-jazyk): Písanky a pracovní sešity českého jazyka
- [Prvouka](https://www.vividbooks.com/predmet/prvouka): Učební materiály prvouky pro 1. stupeň

## Produkty
- Digitální učebnice (online platforma s interaktivním obsahem)
- Pracovní sešity a tištěné učebnice (s ISBN a doložkami MŠMT)
- Vividboard (nástroj pro interaktivní tabule)

## Webináře
- [DVPP webináře](https://www.vividbooks.com/webinare): Pravidelné webináře pro učitele, akreditované DVPP, zdarma s certifikátem

## Blog a novinky
- [Blog](https://www.vividbooks.com/blog): Články o moderním vzdělávání, rozhovory s učiteli
- [Novinky](https://www.vividbooks.com/novinky): Aktuality o nových produktech a aktualizacích

## Vyzkoušení
- [14denní trial zdarma](https://www.vividbooks.com/vyzkousejte): Bezplatný zkušební přístup k digitálním učebnicím

## Kontakt
- Telefon: +420 602 227 674
- Web: https://www.vividbooks.com
`;
  return c.body(llmsTxt, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

/* ── SEO: sitemap.xml ───────────────────���──────────────────────── */
app.get('/make-server-93a20b6f/sitemap.xml', async (c) => {
  const BASE = 'https://www.vividbooks.com';
  const now = new Date().toISOString().split('T')[0];

  // Static pages
  const staticPages = [
    { url: '/',            changefreq: 'daily',   priority: '1.0' },
    { url: '/blog',        changefreq: 'weekly',  priority: '0.8' },
    { url: '/novinky',     changefreq: 'weekly',  priority: '0.8' },
    { url: '/webinare',    changefreq: 'weekly',  priority: '0.8' },
    { url: '/vyzkousejte', changefreq: 'monthly', priority: '0.9' },
    { url: '/objednat',    changefreq: 'monthly', priority: '0.7' },
  ];

  // Subject pages
  const subjects = [
    '/predmet/matematika-2-stupen',
    '/predmet/fyzika',
    '/predmet/prirodopis',
    '/predmet/chemie',
    '/predmet/matematika-1-stupen',
    '/predmet/cesky-jazyk',
    '/predmet/prvouka',
  ];

  function makeUrlEntry(loc: string, freq: string, prio: string) {
    return '  <url>\n    <loc>' + BASE + loc + '</loc>\n    <lastmod>' + now + '</lastmod>\n    <changefreq>' + freq + '</changefreq>\n    <priority>' + prio + '</priority>\n  </url>';
  }

  // Dynamic content from DB
  let blogUrls: string[] = [];
  let novinkyUrls: string[] = [];
  let webinarUrls: string[] = [];
  let productUrls: string[] = [];

  try {
    const blogItems = await getCollection(BLOG_KEY);
    blogUrls = blogItems.map((b: any) => '/blog/' + (b.slug || b.id));
  } catch {}

  try {
    const novinkyItems = await getCollection(NOVINKY_KEY);
    novinkyUrls = novinkyItems.map((n: any) => '/novinky/' + (n.slug || n.id));
  } catch {}

  try {
    const webinarItems = await getCollection(WEBINARS_KEY);
    webinarUrls = webinarItems.map((w: any) => '/webinar/' + w.id);
  } catch {}

  try {
    const products = await getAllProducts();
    productUrls = products.map((p: any) => '/produkt/' + encodeURIComponent(p.id));
  } catch {}

  const urls = [
    ...staticPages.map(p => makeUrlEntry(p.url, p.changefreq, p.priority)),
    ...subjects.map(s => makeUrlEntry(s, 'monthly', '0.8')),
    ...blogUrls.map(u => makeUrlEntry(u, 'monthly', '0.6')),
    ...novinkyUrls.map(u => makeUrlEntry(u, 'monthly', '0.6')),
    ...webinarUrls.map(u => makeUrlEntry(u, 'monthly', '0.5')),
    ...productUrls.map(u => makeUrlEntry(u, 'monthly', '0.7')),
  ];

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';

  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

/* ── Webflow Blog Import ────────────────────────────────────────── */

// Helper: strip HTML tags to plain text
function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Helper: parse Webflow rich-text HTML into BlogBlock array (no dotAll flag for Deno compat)
function parseContentBlocks(html: string): any[] {
  if (!html) return [];
  const found: { pos: number; block: any }[] = [];
  let m: RegExpExecArray | null;

  // Paragraphs
  const paraRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = paraRe.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text && text.length > 3) {
      found.push({ pos: m.index, block: { type: 'paragraph', text } });
    }
  }

  // Headings (h1–h6)
  const headRe = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  while ((m = headRe.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text) found.push({ pos: m.index, block: { type: 'heading', text } });
  }

  // Blockquotes
  const quoteRe = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
  while ((m = quoteRe.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text) found.push({ pos: m.index, block: { type: 'quote', text } });
  }

  // Images — skip Webflow reserved placeholders
  const imgRe = /<img[^>]+>/gi;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const srcM = tag.match(/src=["']([^"']+)["']/i);
    const altM = tag.match(/alt=["']([^"']*)["']/i);
    const alt = altM?.[1] || '';
    if (srcM?.[1] && !alt.includes('__wf_reserved') && !srcM[1].includes('data:')) {
      found.push({ pos: m.index, block: { type: 'image', src: srcM[1], alt } });
    }
  }

  // YouTube iframes (Webflow video embeds)
  const iframeRe = /<iframe[^>]+>/gi;
  while ((m = iframeRe.exec(html)) !== null) {
    const tag = m[0];
    const srcM = tag.match(/src=["']([^"']*youtube[^"']*)["']/i);
    const titleM = tag.match(/title=["']([^"']*)["']/i);
    if (srcM?.[1]) {
      const vidM = srcM[1].match(/embed\/([a-zA-Z0-9_-]+)/);
      if (vidM?.[1]) {
        found.push({
          pos: m.index,
          block: { type: 'video', url: `https://www.youtube.com/watch?v=${vidM[1]}`, title: titleM?.[1] || '' }
        });
      }
    }
  }

  found.sort((a, b) => a.pos - b.pos);
  const blocks = found.map(f => f.block);
  return blocks.length ? blocks : [{ type: 'paragraph', text: stripHtml(html) }];
}

// Helper: pick field from fieldData with multiple fallback keys
function pickField(f: any, keys: string[]): string {
  for (const k of keys) {
    const v = f[k];
    if (v && typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object' && v.url) return v.url;
  }
  return '';
}

// Helper: extract image URL
function pickImage(f: any): string {
  const imageKeys = [
    'nahledovy-obrazek', 'nahledový-obrazek', 'cover-image', 'coverImage',
    'thumbnail', 'main-image', 'obrazek', 'foto', 'fotografie', 'image',
    'titulni-foto', 'titulní-foto', 'obalka'
  ];
  for (const k of imageKeys) {
    const v = f[k];
    if (v?.url) return v.url;
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  // fallback: any field with image extension
  for (const key in f) {
    const v = f[key];
    const url = v?.url || (typeof v === 'string' ? v : '');
    if (url && /\.(jpg|jpeg|png|webp|gif)/i.test(url)) return url;
  }
  return '';
}

// Preview — vrátí surová data prvních 3 položek pro kontrolu polí
app.get('/make-server-93a20b6f/preview-webflow-blog', async (c) => {
  const token = Deno.env.get('WEBFLOW_API_TOKEN');
  if (!token) return c.json({ error: 'Chybí WEBFLOW_API_TOKEN.' }, 500);
  const collectionId = '651f03e0bca47206a22d436d';
  try {
    const items = await fetchFromWebflow(collectionId, token);
    const preview = items.slice(0, 3).map((i: any) => ({
      id: i.id || i._id,
      fieldData: i.fieldData || i,
    }));
    return c.json({ count: items.length, preview });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Import — stáhne blog z Webflow a uloží do Supabase
app.post('/make-server-93a20b6f/import-webflow-blog', async (c) => {
  const token = Deno.env.get('WEBFLOW_API_TOKEN');
  if (!token) return c.json({ error: 'Chybí WEBFLOW_API_TOKEN.' }, 500);
  const collectionId = '651f03e0bca47206a22d436d';
  try {
    const items = await fetchFromWebflow(collectionId, token);
    console.log(`[Blog] Staženo ${items.length} položek z Webflow.`);

    const mapped = items.map((i: any) => {
      const f = i.fieldData || i;
      const rawDate = pickField(f, ['datum', 'date', 'datum-vydani', 'published-on', 'publishedOn']);
      let dateFormatted = rawDate;
      if (rawDate && !isNaN(Date.parse(rawDate))) {
        dateFormatted = new Date(rawDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
      }

      const contentHtml = pickField(f, ['obsah', 'content', 'post-body', 'clanek', 'body', 'blog-content', 'full-text']);
      const contentBlocks = contentHtml ? parseContentBlocks(contentHtml) : [];

      const excerpt = pickField(f, ['perex', 'excerpt', 'popis', 'uvodni-text', 'uvod', 'kratky-popis', 'summary'])
        || (contentBlocks.find((b: any) => b.type === 'paragraph')?.text || '').slice(0, 300);

      const readTimeRaw = f['doba-cteni'] || f['read-time'] || f['readTime'];
      const wordCount = stripHtml(contentHtml).split(/\s+/).length;
      const readTime = readTimeRaw ? (parseInt(String(readTimeRaw)) || 5) : Math.max(3, Math.ceil(wordCount / 200));

      return {
        id: i.id || i._id,
        slug: f.slug || f['url-slug'] || (i.id || i._id),
        title: pickField(f, ['name', 'nazev', 'titulek', 'title']),
        excerpt,
        author: pickField(f, ['autor', 'author', 'jmeno-autora', 'redaktor']),
        date: dateFormatted || '',
        readTime,
        category: pickField(f, ['kategorie', 'category', 'tag', 'tema', 'oblast']),
        coverImage: pickImage(f),
        content: contentBlocks,
        contentHtml,
        metadata: f,
        importedAt: new Date().toISOString(),
      };
    }).filter((p: any) => p.title);

    await saveCollection(BLOG_KEY, mapped);
    console.log(`[Blog] Uloženo ${mapped.length} příspěvků do Supabase.`);
    return c.json({ success: true, count: mapped.length, sample: mapped.slice(0, 2).map((p: any) => ({ id: p.id, title: p.title, slug: p.slug, author: p.author, date: p.date, category: p.category, hasImage: !!p.coverImage, blocks: p.content.length })) });
  } catch (e: any) {
    console.log(`[Blog] Chyba: ${e.message}`);
    return c.json({ error: 'Import blogu selhal', details: e.message }, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════
   IMAGE MIGRATION — Webflow → Supabase Storage
   ═══════════════════════════════════════════════════════════════════ */

const IMAGE_BUCKET = 'make-93a20b6f-images';

async function ensureImageBucket(supabase: any) {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === IMAGE_BUCKET);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(IMAGE_BUCKET, { public: true });
      if (error) console.log(`[migrate-images] createBucket error: ${error.message}`);
      else console.log(`[migrate-images] Bucket "${IMAGE_BUCKET}" vytvofen.`);
    } else {
      console.log(`[migrate-images] Bucket "${IMAGE_BUCKET}" jiz existuje.`);
    }
  } catch (e: any) {
    console.log(`[migrate-images] ensureImageBucket error: ${e.message}`);
  }
}

async function downloadAndUploadImage(
  supabase: any,
  supabaseUrl: string,
  imageUrl: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'VividbooksMigrationTool/1.0' },
    });
    if (!res.ok) {
      console.log(`[migrate-images] Download failed ${res.status}: ${imageUrl.slice(0, 80)}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) {
      console.log(`[migrate-images] Upload error ${storagePath}: ${error.message}`);
      return null;
    }
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${storagePath}`;
    console.log(`[migrate-images] OK: ${storagePath}`);
    return publicUrl;
  } catch (e: any) {
    console.log(`[migrate-images] Exception for ${imageUrl.slice(0, 80)}: ${e.message}`);
    return null;
  }
}

function getImageExt(url: string): string {
  const clean = url.split('?')[0];
  const m = clean.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

function isExternalUrl(url: string, supabaseUrl: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  return !url.includes('supabase.co') && !url.includes(supabaseUrl);
}

app.post('/make-server-93a20b6f/migrate-images', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const collections: string[] = body.collections || ['products', 'blog', 'novinky', 'webinars'];

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    await ensureImageBucket(supabase);

    const results: Record<string, { total: number; migrated: number; skipped: number; errors: number }> = {};

    // ── Produkty ──────────────��───────────────────────────────────
    if (collections.includes('products')) {
      console.log('[migrate-images] Zpracovávám produkty...');
      const items = await getAllProducts();
      let migrated = 0, skipped = 0, errors = 0;

      const updated: any[] = [];
      for (const item of items) {
        if (!item.image || !isExternalUrl(item.image, supabaseUrl)) {
          skipped++;
          updated.push(item);
          continue;
        }
        const ext = getImageExt(item.image);
        const path = `products/${item.id}/cover.${ext}`;
        const newUrl = await downloadAndUploadImage(supabase, supabaseUrl, item.image, path);
        if (newUrl) { migrated++; updated.push({ ...item, image: newUrl }); }
        else { errors++; updated.push(item); }
      }

      await saveAllProducts(updated);
      results['products'] = { total: items.length, migrated, skipped, errors };
      console.log(`[migrate-images] Produkty: migrated=${migrated}, skipped=${skipped}, errors=${errors}`);
    }

    // ── Blog ────────────────────────────���─────────────────────────
    if (collections.includes('blog')) {
      console.log('[migrate-images] Zpracovávám blog...');
      const items = await getCollection(BLOG_KEY);
      let migrated = 0, skipped = 0, errors = 0;
      const updated: any[] = [];

      for (const item of items) {
        let cur = { ...item };

        // coverImage
        if (cur.coverImage && isExternalUrl(cur.coverImage, supabaseUrl)) {
          const ext = getImageExt(cur.coverImage);
          const path = `blog/${cur.id}/cover.${ext}`;
          const newUrl = await downloadAndUploadImage(supabase, supabaseUrl, cur.coverImage, path);
          if (newUrl) { cur = { ...cur, coverImage: newUrl }; migrated++; }
          else errors++;
        } else {
          skipped++;
        }

        // Obrázky uvnitř content bloků (type: 'image')
        if (Array.isArray(cur.content)) {
          const newBlocks = [];
          let imgIdx = 0;
          for (const block of cur.content) {
            if (block.type === 'image' && block.src && isExternalUrl(block.src, supabaseUrl)) {
              const ext = getImageExt(block.src);
              const path = `blog/${cur.id}/block-img-${imgIdx}.${ext}`;
              const newUrl = await downloadAndUploadImage(supabase, supabaseUrl, block.src, path);
              if (newUrl) { newBlocks.push({ ...block, src: newUrl }); migrated++; }
              else { newBlocks.push(block); errors++; }
              imgIdx++;
            } else {
              newBlocks.push(block);
            }
          }
          cur = { ...cur, content: newBlocks };
        }

        updated.push(cur);
      }

      await saveCollection(BLOG_KEY, updated);
      results['blog'] = { total: items.length, migrated, skipped, errors };
      console.log(`[migrate-images] Blog: migrated=${migrated}, skipped=${skipped}, errors=${errors}`);
    }

    // ── Novinky ───────────────────────────────────────────────────
    if (collections.includes('novinky')) {
      console.log('[migrate-images] Zpracovávám novinky...');
      const items = await getCollection(NOVINKY_KEY);
      let migrated = 0, skipped = 0, errors = 0;
      const updated: any[] = [];

      for (const item of items) {
        let cur = { ...item };

        if (cur.coverImage && isExternalUrl(cur.coverImage, supabaseUrl)) {
          const ext = getImageExt(cur.coverImage);
          const path = `novinky/${cur.id}/cover.${ext}`;
          const newUrl = await downloadAndUploadImage(supabase, supabaseUrl, cur.coverImage, path);
          if (newUrl) { cur = { ...cur, coverImage: newUrl }; migrated++; }
          else errors++;
        } else {
          skipped++;
        }

        if (Array.isArray(cur.content)) {
          const newBlocks = [];
          let imgIdx = 0;
          for (const block of cur.content) {
            if (block.type === 'image' && block.src && isExternalUrl(block.src, supabaseUrl)) {
              const ext = getImageExt(block.src);
              const path = `novinky/${cur.id}/block-img-${imgIdx}.${ext}`;
              const newUrl = await downloadAndUploadImage(supabase, supabaseUrl, block.src, path);
              if (newUrl) { newBlocks.push({ ...block, src: newUrl }); migrated++; }
              else { newBlocks.push(block); errors++; }
              imgIdx++;
            } else {
              newBlocks.push(block);
            }
          }
          cur = { ...cur, content: newBlocks };
        }

        updated.push(cur);
      }

      await saveCollection(NOVINKY_KEY, updated);
      results['novinky'] = { total: items.length, migrated, skipped, errors };
      console.log(`[migrate-images] Novinky: migrated=${migrated}, skipped=${skipped}, errors=${errors}`);
    }

    // ── Webináře ──────────────────────────────────────────────────
    if (collections.includes('webinars')) {
      console.log('[migrate-images] Zpracovávám webináře...');
      const items = await getCollection(WEBINARS_KEY);
      let migrated = 0, skipped = 0, errors = 0;
      const updated: any[] = [];

      for (const item of items) {
        let cur = { ...item };

        if (cur.coverImage && isExternalUrl(cur.coverImage, supabaseUrl)) {
          const ext = getImageExt(cur.coverImage);
          const path = `webinars/${cur.id}/cover.${ext}`;
          const newUrl = await downloadAndUploadImage(supabase, supabaseUrl, cur.coverImage, path);
          if (newUrl) { cur = { ...cur, coverImage: newUrl }; migrated++; }
          else errors++;
        } else {
          skipped++;
        }

        // lecturerAvatar — pouze pokud se liší od coverImage
        if (
          cur.lecturerAvatar &&
          cur.lecturerAvatar !== item.coverImage &&
          isExternalUrl(cur.lecturerAvatar, supabaseUrl)
        ) {
          const ext = getImageExt(cur.lecturerAvatar);
          const path = `webinars/${cur.id}/avatar.${ext}`;
          const newUrl = await downloadAndUploadImage(supabase, supabaseUrl, cur.lecturerAvatar, path);
          if (newUrl) { cur = { ...cur, lecturerAvatar: newUrl }; migrated++; }
          else errors++;
        }

        updated.push(cur);
      }

      await saveCollection(WEBINARS_KEY, updated);
      results['webinars'] = { total: items.length, migrated, skipped, errors };
      console.log(`[migrate-images] Webináře: migrated=${migrated}, skipped=${skipped}, errors=${errors}`);
    }

    const totalMigrated = Object.values(results).reduce((s, r) => s + r.migrated, 0);
    const totalErrors = Object.values(results).reduce((s, r) => s + r.errors, 0);
    console.log(`[migrate-images] Hotovo! Celkem migrováno: ${totalMigrated}, chyb: ${totalErrors}`);

    return c.json({ success: true, results, totalMigrated, totalErrors, bucket: IMAGE_BUCKET });
  } catch (e: any) {
    console.log(`[migrate-images] Fatal error: ${e.message}`);
    return c.json({ error: `Migrace obrázků selhala: ${e.message}` }, 500);
  }
});

/* ═══════════════════════════════════════════════════════════���═══════
   RAG — Retrieval-Augmented Generation
   ══════════════════════════���════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   MARKETING AGENT — Gemini 2.0 Flash
   ═════════════════════════════════════════════════════════════���═════ */

const MARKETING_AGENT_SYSTEM_PROMPT = `Jsi marketingový agent pro Vividbooks — českou platformu interaktivních digitálních učebnic pro základní školy. Pracuješ pro marketingový tým značky Vividbooks.

## O Vividbooks
- **Co to je**: Interaktivní digitální učebnice a pracovní sešity pro ZŠ (1. i 2. stupeň)
- **Předměty**: Matematika (1. i 2. stupeň), Fyzika, Chemie, Přírodopis, Český jazyk, Prvouka
- **Cílové skupiny**: Učitelé ZŠ, školy, ředitelé, rodiče, žáci
- **Klíčové USP**: Animace a interaktivní lekce, 3D modely, badatelské listy, okamžitá zpětná vazba, Vividboard (interaktivní tabule), soulad s RVP 2025, doložky MŠMT, bezplatný 14denní trial
- **Web**: www.vividbooks.com | **Trial**: vividbooks.com/vyzkousejte
- **Webináře**: Pravidelné DVPP webináře zdarma s certifikátem pro učitele

## Brand voice & tone
- **Jazyk**: Vždy česky
- **Tone**: Inspirující, pedagogicky zaměřený, přátelský ale profesionální, moderní, důvěryhodný
- **Klíčové zprávy**: Propojení teorie s praxí, digitální vzdělávání budoucnosti, učení které baví
- **Vyhýbej se**: Přehnanému chválení, zbytečným anglicismům, prázdným floskulím

## Mailchimp integrace
- Máš přístup k historii odeslaných Mailchimp kampaní (pokud jsou zaindexované v RAG) — víš jaké subject lines, formáty a obsahy fungovaly
- Pokud uživatel chce vytvořit email/newsletter, můžeš navrhnout obsah a on ho jedním klikem vloží do Mailchimpu jako draft
- Vividbooks má dvě audience: „newsletter" (odběratelé newsletteru) a „no-newsletter" (registrovaní bez newsletteru)

## DŮLEŽITÉ: Mailchimp data vs. aktuální data
- Mailchimp kampaně v RAG jsou HISTORICKÉ — mohou obsahovat zastaralé ceny, produkty, webináře nebo akce, které už neplatí!
- Pokud v RAG kontextu najdeš chunk ze zdroje "mailchimp", VŽDY ho porovnej s aktuálními daty z ostatních zdrojů (produkty, webináře, taby)
- Z Mailchimp kampaní čerpej POUZE: styl psaní, tón, osvědčené subject lines, strukturu emailů, call-to-action formulace
- NIKDY nepřebírej konkrétní fakta (ceny, data webinářů, názvy produktů, akce) z Mailchimp kampaní — vždy použij aktuální data z produktového katalogu a webinářů
- Pokud si nejsi jistý zda je info aktuální, raději uveď jen to, co máš potvrzené z ne-mailchimpových zdrojů

## Co umíš tvořit
- Newslettery a e-maily pro učitele, školy, rodiče (s možností přímého vložení do Mailchimpu)
- Posty na LinkedIn, Facebook, Instagram (včetně hashtagů)
- Popisy produkt�� a kategorií pro web
- Promo texty pro webináře a akce
- Hero texty a CTA tlačítka pro landing pages
- Tiskové zprávy a PR texty
- Slogany a kampaňové koncepty
- Google Ads a Meta Ads texty

## Formátování výstupů
- Nabídni vždy 2–3 varianty pokud to dává smysl
- U e-mailů uveď předmět zprávy zvlášť jako "📧 Předmět: ..."
- U sociálních sítí uveď doporučené hashtagy a přibližnou délku
- Buď konkrétní a actionable

## Práce s časem a datumy
- Dnešní datum ti bude poskytnuto na začátku každé konverzace v systémovém kontextu.
- Pokud se uživatel ptá na „plánované", „nadcházející", „příští" webináře/akce, odpovídej POUZE o těch, které mají datum v budoucnosti.
- Pokud se ptá na „proběhlé", „minulé", „archiv", odpovídej o těch s datem v minulosti.
- Chunky v RAG kontextu budou mít štítek [PROBĚHLÝ] nebo [PLÁNOVANÝ] — respektuj tyto štítky.
- Pokud v RAG kontextu nejsou žádné plánované webináře, řekni to upřímně — NEVYMÝŠLEJ žádné.`;

const SEO_AGENT_SYSTEM_PROMPT = `Jsi SEO a obsahový stratég pro Vividbooks.

## Tvoje role
- Nepíšeš finální kampaně jako copywriter.
- Připravuješ SEO briefy, content outlines, strukturu landing pages, metadata a doporučení pro interní prolinkování.
- Když dává smysl, připrav 2-3 varianty titulku nebo úhlu článku, ale hlavní výstup je strategie a zadání.

## Co máš vracet
- Search intent a cílovou skupinu
- Návrh titulku / H1
- Meta title a meta description
- Doporučenou strukturu sekcí
- Návrh interního prolinkování
- Doporučené CTA
- Poznámky pro marketingového textaře

## Brand a fakta
- Vždy česky.
- Vycházej z reálných dat Vividbooks a z RAG kontextu.
- Nevymýšlej si neexistující produkty, funkce ani webináře.
- Buď praktický, stručný a akční.`;

const IMAGE_AGENT_SYSTEM_PROMPT = `Jsi image specialista pro Vividbooks.

## Tvoje role
- Nepíšeš marketingové kampaně ani CMS obsah.
- Připravuješ přesné obrazové zadání, doporučení stylu a handoff pro generování vizuálů.
- Zaměřuješ se na cover obrázky, koláže, promo vizuály, hero vizuály a galerie.

## Co máš vracet
- Cíl vizuálu
- Doporučený styl
- Kompozici
- Doporučený formát / poměr stran
- Jaké podklady nebo obálky použít
- Stručný prompt nebo handoff pro image workflow

## Brand
- Respektuj vizuální styl Vividbooks: moderní, školní, přehledný, důvěryhodný.
- Když si nejsi jistý, doporuč raději bezpečný a čistý vizuální směr.`;

const GROWTH_AGENT_SYSTEM_PROMPT = `Jsi growth creative agent pro Vividbooks.

## Tvoje role
- Navrhuješ přímo použitelné reklamní kreativy pro Meta Ads a Google Ads.
- Nevracíš obecné marketingové úvahy, pokud si je uživatel výslovně nevyžádá.
- Když uživatel napíše "udělej mi kampaň", chápeš to jako požadavek na hotové koncepty kreativ, ne na teoretický rozbor.
- Neřešíš targeting engine ani bidding logiku.
- Pokud nemáš výkonová data, nevymýšlíš si je.

## Co máš vracet jako výchozí odpověď
- 3 až 4 konkrétní kreativy připravené k review
- u každé kreativy:
  - název / angle
  - platforma
  - formát
  - rozměr v pixelech
  - headline
  - primary text / overlay
  - CTA
  - jaký asset použít
  - stručný vizuální layout
- nakonec krátkou poznámku, co je nejlepší spustit jako první

## Povinný formát odpovědi
Používej přesně tuto strukturu:

### Kreativa 1: "Název"
- Platforma:
- Formát:
- Rozměr: 1080x1350 / 1080x1920 / 1200x628 apod.
- Asset:
- Headline:
- Primary text:
- CTA:
- Layout:

### Kreativa 2: "Název"
...

### Kreativa 3: "Název"
...

### Doporučení nasazení
- ...

## Důležitá pravidla
- Piš česky.
- Buď konkrétní a praktický.
- Nevracej sekce typu "co od tebe potřebuji", pokud uživatel výslovně nežádá workshop nebo discovery.
- Nevracej dlouhé strategické odstavce před samotnými kreativami.
- Nevymýšlej neexistující produkty, funkce ani výkonová data.
- Když neznáš přesný asset, napiš konkrétní typ assetu z dostupných produktových podkladů, screenshotu nebo coveru.
- Pokud uživatel nepožádá jinak, preferuj výstup, který lze rovnou převést do draftů v adminu.
- U rozměru vždy uváděj konkrétní pixelové hodnoty, ne jen poměr stran.

## Zakázané domněnky
- Nezmiňuj AR, rozšířenou realitu ani podobné feature, pokud to není výslovně v uživatelově zadání nebo v aktuálním product contextu.
- Neodkazuj na staré positioningy produktu, které nejsou doložené v aktuálním kontextu.

## Styl výstupu
- Minimum omáčky.
- Maximum použitelnosti pro creative review.
- Uživatel má po přečtení hned vidět, co se má vyrábět a v jakém rozměru.`;

const TEXT_SPECIALIST_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview'];

function buildTodayContextBlock() {
  const nowPrague = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  const todayISO = nowPrague.toISOString().slice(0, 10);
  const todayCZ = nowPrague.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return { todayISO, todayCZ };
}

async function collectRagContextForSpecialist(lastUserContent: string, logPrefix: string) {
  let ragContext = '';
  let ragChunksUsed = 0;
  let ragDebug = { indexSize: 0, topScore: 0, reason: 'not_attempted' };
  try {
    const allChunks = await loadAllChunks();
    ragDebug.indexSize = allChunks.length;
    console.log(`[${logPrefix}] RAG chunks=${allChunks.length}, query="${lastUserContent.slice(0, 80)}"`);
    if (allChunks.length === 0) {
      ragDebug.reason = 'empty_index';
      return { ragContext, ragChunksUsed, ragDebug };
    }
    const qEmbed = await embedText(lastUserContent);
    const scored = allChunks
      .filter((ch: any) => Array.isArray(ch.embedding) && ch.embedding.length > 0)
      .map((ch: any) => ({ ...ch, score: cosineSim(qEmbed, ch.embedding) }))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 8);
    ragDebug.topScore = Math.round((scored[0]?.score ?? 0) * 100);
    const THRESHOLD = 0.15;
    const relevant = scored.filter((ch: any) => ch.score >= THRESHOLD);
    console.log(`[${logPrefix}] topScore=${ragDebug.topScore}%, relevant=${relevant.length}`);
    if (relevant.length === 0) {
      ragDebug.reason = `below_threshold_${ragDebug.topScore}pct`;
      return { ragContext, ragChunksUsed, ragDebug };
    }
    ragContext = relevant.slice(0, 6).map((ch: any, i: number) => {
      let temporalTag = '';
      if (ch.metadata?.source === 'webinare' || ch.metadata?.source === 'webinar-prepis') {
        if (ch.metadata?.temporal === 'future') temporalTag = ' | ⏳ PLÁNOVANÝ (budoucí)';
        else if (ch.metadata?.temporal === 'past') temporalTag = ' | ✅ PROBĚHLÝ (minulý)';
        else if (ch.metadata?.eventDate) {
          const evD = new Date(ch.metadata.eventDate);
          const nowD = new Date(); nowD.setHours(0, 0, 0, 0);
          temporalTag = evD >= nowD ? ' | ⏳ PLÁNOVANÝ (budoucí)' : ' | ✅ PROBĚHLÝ (minulý)';
        } else {
          temporalTag = ' | ⚠️ DATUM NEZNÁMÉ — ověř zda je aktuální';
        }
      }
      const eventDateStr = ch.metadata?.eventDate ? ` | Datum: ${ch.metadata.eventDate}` : '';
      let mcFreshness = '';
      if (ch.metadata?.source === 'mailchimp') {
        const f = ch.metadata?.freshness || 'stale';
        const mo = ch.metadata?.monthsOld ?? '?';
        if (f === 'recent') mcFreshness = ' | 📧 NEDÁVNÝ EMAIL (< 2 měs.)';
        else if (f === 'aging') mcFreshness = ` | ⚠️ STARŠÍ EMAIL (${mo} měs.) — POUZE INSPIRACE STYLEM, ne fakty!`;
        else mcFreshness = ` | 🚫 STARÝ EMAIL (${mo} měs.) — POUZE INSPIRACE STYLEM A TONEM, konkrétní fakta IGNORUJ!`;
      }
      return `[${i+1}] Zdroj: ${ch.metadata?.source ?? 'Neznámý'} | ${ch.metadata?.title ?? ''} | Předmět: ${ch.metadata?.subject ?? ''}${eventDateStr}${temporalTag}${mcFreshness} | Skóre: ${Math.round(ch.score * 100)}%\n${ch.text}`;
    }).join('\n\n---\n\n');
    ragChunksUsed = relevant.length;
    ragDebug.reason = 'ok';
  } catch (ragErr: any) {
    ragDebug.reason = `error:${ragErr.message}`;
    console.log(`[${logPrefix}] RAG chyba: ${ragErr.message}`);
  }
  return { ragContext, ragChunksUsed, ragDebug };
}

async function runTextSpecialistAgent(opts: {
  logPrefix: string;
  systemPrompt: string;
  messages: any[];
  productContext?: any[];
  model?: string;
  useRag?: boolean;
}) {
  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  if (!apiKey) throw new Error('GEMINI_API_KEY_RAG není nastaven.');

  const selectedModel = (opts.model && TEXT_SPECIALIST_MODELS.includes(opts.model)) ? opts.model : 'gemini-3.1-pro-preview';
  const lastUserMsg = [...opts.messages].reverse().find((m: any) => m.role === 'user');

  let ragContext = '';
  let ragChunksUsed = 0;
  let ragDebug = { indexSize: 0, topScore: 0, reason: 'disabled' };
  if (opts.useRag !== false && lastUserMsg?.content) {
    const rag = await collectRagContextForSpecialist(lastUserMsg.content, opts.logPrefix);
    ragContext = rag.ragContext;
    ragChunksUsed = rag.ragChunksUsed;
    ragDebug = rag.ragDebug;
  }

  const geminiContents = opts.messages.map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  let systemText = opts.systemPrompt;
  const { todayISO, todayCZ } = buildTodayContextBlock();
  systemText += `\n\n## Aktuální datum a čas\n- **Dnešní datum**: ${todayCZ} (${todayISO})\n- Vše s datem PŘED tímto datem je v minulosti. Vše s datem PO tomto datu je v budoucnosti.`;

  if (opts.productContext && opts.productContext.length > 0) {
    systemText += '\n\n## Aktuální produkty v katalogu\n';
    systemText += opts.productContext.slice(0, 80).map((p: any) =>
      `- **${p.name}** (${p.category}${p.price ? ', ' + p.price : ''}${p.rocnik ? ', ' + p.rocnik + '. ročník' : ''})`
    ).join('\n');
  }

  if (ragContext) {
    systemText += `\n\n## Relevantní obsah z RAG databáze\nPoužij tyto úryvky jako fakta a kontext. Neopírej se o neověřené domněnky.\n\n${ragContext}`;
  }

  const geminiBody = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: geminiContents,
    generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 8192 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
  console.log(`[${opts.logPrefix}] Volám Gemini ${selectedModel}, messages=${opts.messages.length}, ragChunks=${ragChunksUsed}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: controller.signal,
    });
  } catch (fetchErr: any) {
    clearTimeout(timer);
    throw new Error(`Gemini API timeout: ${fetchErr.message}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API chyba (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    reply: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokensIn: data.usageMetadata?.promptTokenCount || 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount || 0,
    ragChunks: ragChunksUsed,
    ragDebug,
  };
}

app.post('/make-server-93a20b6f/admin/marketing-agent', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, productContext } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'Chybí pole messages.' }, 400);
    }
    const data = await runTextSpecialistAgent({
      logPrefix: 'MarketingAgent',
      systemPrompt: MARKETING_AGENT_SYSTEM_PROMPT,
      messages,
      productContext,
      model: body.model,
      useRag: true,
    });
    console.log(`[MarketingAgent] OK — in=${data.tokensIn} out=${data.tokensOut} chars=${data.reply.length} ragChunks=${data.ragChunks} ragDebug=${JSON.stringify(data.ragDebug)}`);
    return c.json(data);
  } catch (e: any) {
    console.log(`[MarketingAgent] Exception: ${e.message}`);
    return c.json({ error: `Chyba marketing agenta: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/seo-agent', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, productContext } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'Chybí pole messages.' }, 400);
    }
    const data = await runTextSpecialistAgent({
      logPrefix: 'SeoAgent',
      systemPrompt: SEO_AGENT_SYSTEM_PROMPT,
      messages,
      productContext,
      model: body.model,
      useRag: true,
    });
    console.log(`[SeoAgent] OK — in=${data.tokensIn} out=${data.tokensOut} chars=${data.reply.length} ragChunks=${data.ragChunks} ragDebug=${JSON.stringify(data.ragDebug)}`);
    return c.json(data);
  } catch (e: any) {
    console.log(`[SeoAgent] Exception: ${e.message}`);
    return c.json({ error: `Chyba SEO agenta: ${e.message}` }, 500);
  }
});

/* ── Marketing Chat History ─────────────────────────────────────── */
const CHAT_INDEX_KEY = 'marketing:chats:index';

function buildMarketingChatMessageRows(threadId: string, messages: any[]): any[] {
  return (messages || [])
    .filter(Boolean)
    .slice(-100)
    .map((message: any, index: number) => ({
      id: String(message.id || `${threadId}-msg-${index}`),
      thread_id: threadId,
      role: mapAdminRole(message.role),
      message_kind: 'message',
      content: String(message.content || ''),
      content_format: 'text',
      token_count: Number.isFinite(Number(message?.tokens?.in || message?.tokens?.out))
        ? Number(message?.tokens?.out || message?.tokens?.in || 0)
        : null,
      metadata: {
        raw: message,
        external_id: String(message.id || `${threadId}-msg-${index}`),
        timestamp: message.timestamp || null,
        ragChunks: message.ragChunks ?? null,
        ragDebug: message.ragDebug ?? null,
        tokens: message.tokens ?? null,
      },
    }));
}

async function getMarketingChatFromDb(id: string): Promise<any | null> {
  const sb = getDbClient();
  const { data: thread, error: threadError } = await sb
    .from('chat_threads')
    .select('id,title,created_at,updated_at,last_message_at,metadata')
    .eq('id', id)
    .eq('agent_key', 'marketing-agent')
    .maybeSingle();
  if (threadError) throw new Error(threadError.message);
  if (!thread) return null;

  const { data: messages, error: msgError } = await sb
    .from('chat_messages')
    .select('id,role,content,metadata,created_at')
    .eq('thread_id', id)
    .order('created_at', { ascending: true });
  if (msgError) throw new Error(msgError.message);

  return {
    id: thread.id,
    title: thread.title,
    messages: (messages || []).map((row: any) => row.metadata?.raw || {
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.metadata?.timestamp || row.created_at,
      tokens: row.metadata?.tokens || null,
      ragChunks: row.metadata?.ragChunks || 0,
      ragDebug: row.metadata?.ragDebug || null,
    }),
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  };
}

app.get('/make-server-93a20b6f/admin/marketing-chats', async (c) => {
  try {
    if (await hasAdminChatDb()) {
      try {
        const sb = getDbClient();
        const { data, error } = await sb
          .from('chat_threads')
          .select('id,title,created_at,updated_at,last_message_at,metadata')
          .eq('agent_key', 'marketing-agent')
          .order('updated_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        const chats = (data || []).map((row: any) => ({
          id: row.id,
          title: row.title || 'Nový chat',
          updatedAt: row.updated_at || row.last_message_at || row.created_at,
          createdAt: row.created_at,
          messageCount: Number(row.metadata?.messageCount || 0),
        }));
        if (chats.length > 0) return c.json({ chats });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[MarketingChat] List fallback to KV: ${dbErr.message}`);
      }
    }
    const index = await kv.get(CHAT_INDEX_KEY) as any[] | null;
    return c.json({ chats: index || [] });
  } catch (e: any) {
    return c.json({ error: `Chyba načítání chat history: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/marketing-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (await hasAdminChatDb()) {
      try {
        const chat = await getMarketingChatFromDb(id);
        if (chat) return c.json({ chat });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[MarketingChat] Get fallback to KV: ${dbErr.message}`);
      }
    }
    const chat = await kv.get(`marketing:chat:${id}`);
    if (!chat) return c.json({ error: 'Chat nenalezen' }, 404);
    return c.json({ chat });
  } catch (e: any) {
    return c.json({ error: `Chyba načítání chatu: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/marketing-chats', async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, messages } = body;
    if (!id || !messages) return c.json({ error: 'Chybí id nebo messages' }, 400);
    const now = new Date().toISOString();
    if (await hasAdminChatDb()) {
      try {
        const sb = getDbClient();
        const safeMessages = (messages || []).filter((m: any) => m && !m.loading);
        const lastMessage = safeMessages[safeMessages.length - 1];
        const lastMessageAt = lastMessage?.timestamp
          ? new Date(lastMessage.timestamp).toISOString()
          : now;
        const threadPayload = {
          id,
          agent_key: 'marketing-agent',
          title: title || 'Nový chat',
          status: 'active',
          metadata: { messageCount: safeMessages.length },
          last_message_at: lastMessageAt,
        };
        const { error: threadError } = await sb.from('chat_threads').upsert(threadPayload);
        if (threadError) throw new Error(threadError.message);
        const { error: deleteError } = await sb.from('chat_messages').delete().eq('thread_id', id);
        if (deleteError) throw new Error(deleteError.message);
        const rows = buildMarketingChatMessageRows(id, safeMessages);
        if (rows.length) {
          const { error: insertError } = await sb.from('chat_messages').insert(rows);
          if (insertError) throw new Error(insertError.message);
        }
        return c.json({ ok: true });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[MarketingChat] Save fallback to KV: ${dbErr.message}`);
      }
    }
    const chatData = { id, title: title || 'Nový chat', messages, updatedAt: now };
    await kv.set(`marketing:chat:${id}`, chatData);
    const index = (await kv.get(CHAT_INDEX_KEY) as any[] | null) || [];
    const existingIdx = index.findIndex((ch: any) => ch.id === id);
    const indexEntry = {
      id,
      title: title || 'Nový chat',
      updatedAt: now,
      createdAt: existingIdx >= 0 ? index[existingIdx].createdAt : now,
      messageCount: messages.length,
    };
    if (existingIdx >= 0) {
      index[existingIdx] = indexEntry;
    } else {
      index.unshift(indexEntry);
    }
    if (index.length > 50) index.splice(50);
    await kv.set(CHAT_INDEX_KEY, index);
    console.log(`[ChatHistory] Saved chat ${id}, total=${index.length}`);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Chyba ukládání chatu: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/marketing-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (await hasAdminChatDb()) {
      try {
        const { error } = await getDbClient().from('chat_threads').delete().eq('id', id).eq('agent_key', 'marketing-agent');
        if (error) throw error;
        await kv.del(`marketing:chat:${id}`).catch(() => {});
        const index = (await kv.get(CHAT_INDEX_KEY) as any[] | null) || [];
        await kv.set(CHAT_INDEX_KEY, index.filter((ch: any) => ch.id !== id)).catch(() => {});
        return c.json({ ok: true });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[MarketingChat] Delete fallback to KV: ${dbErr.message}`);
      }
    }
    await kv.del(`marketing:chat:${id}`);
    const index = (await kv.get(CHAT_INDEX_KEY) as any[] | null) || [];
    const newIndex = index.filter((ch: any) => ch.id !== id);
    await kv.set(CHAT_INDEX_KEY, newIndex);
    console.log(`[ChatHistory] Deleted chat ${id}`);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Chyba mazán�� chatu: ${e.message}` }, 500);
  }
});

/* ── SEO Chat History ───────────────────────────────────────────── */
const SEO_CHAT_INDEX_KEY = 'seo:chats:index';

app.get('/make-server-93a20b6f/admin/seo-chats', async (c) => {
  try {
    const index = await kv.get(SEO_CHAT_INDEX_KEY) as any[] | null;
    return c.json({ chats: index || [] });
  } catch (e: any) {
    return c.json({ error: `Chyba načítání SEO chat history: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/seo-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const chat = await kv.get(`seo:chat:${id}`);
    if (!chat) return c.json({ error: 'Chat nenalezen' }, 404);
    return c.json({ chat });
  } catch (e: any) {
    return c.json({ error: `Chyba načítání SEO chatu: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/seo-chats', async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, messages } = body;
    if (!id || !messages) return c.json({ error: 'Chybí id nebo messages' }, 400);
    const now = new Date().toISOString();
    const chatData = { id, title: title || 'Nový SEO chat', messages, updatedAt: now };
    await kv.set(`seo:chat:${id}`, chatData);
    const index = (await kv.get(SEO_CHAT_INDEX_KEY) as any[] | null) || [];
    const existingIdx = index.findIndex((ch: any) => ch.id === id);
    const indexEntry = {
      id,
      title: title || 'Nový SEO chat',
      updatedAt: now,
      createdAt: existingIdx >= 0 ? index[existingIdx].createdAt : now,
      messageCount: messages.length,
    };
    if (existingIdx >= 0) index[existingIdx] = indexEntry;
    else index.unshift(indexEntry);
    if (index.length > 50) index.splice(50);
    await kv.set(SEO_CHAT_INDEX_KEY, index);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Chyba ukládání SEO chatu: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/seo-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`seo:chat:${id}`);
    const index = (await kv.get(SEO_CHAT_INDEX_KEY) as any[] | null) || [];
    await kv.set(SEO_CHAT_INDEX_KEY, index.filter((ch: any) => ch.id !== id));
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Chyba mazání SEO chatu: ${e.message}` }, 500);
  }
});

/* ── Growth Agent + Creative Workspace ────────────────────────────── */

function slugifyGrowthText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function nowIso() {
  return new Date().toISOString();
}

function buildGrowthCreativeId(angle: string) {
  const stamp = Date.now();
  const tail = Math.random().toString(36).slice(2, 7);
  return `gc-${slugifyGrowthText(angle) || 'creative'}-${stamp}-${tail}`;
}

function parseJsonBlock(raw: string) {
  const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(clean);
}

async function listGrowthCreatives() {
  const rows = (await kv.getByPrefix(GROWTH_CREATIVE_PREFIX) as any[] | null) || [];
  return rows
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

async function getGrowthCreative(id: string) {
  return await kv.get(`${GROWTH_CREATIVE_PREFIX}${id}`);
}

async function saveGrowthCreative(creative: any) {
  const existing = creative?.id ? await getGrowthCreative(String(creative.id)) : null;
  const now = nowIso();
  const toSave = {
    id: creative?.id || buildGrowthCreativeId(creative?.angle || creative?.headline || 'creative'),
    productId: creative?.productId ? String(creative.productId) : null,
    angle: creative?.angle || '',
    audienceHint: creative?.audienceHint || 'teacher',
    platformTargets: Array.isArray(creative?.platformTargets) && creative.platformTargets.length
      ? [...new Set(creative.platformTargets.filter((x: any) => x === 'meta' || x === 'google'))]
      : ['meta', 'google'],
    format: creative?.format || 'image_single',
    headline: creative?.headline || '',
    primaryText: creative?.primaryText || '',
    cta: creative?.cta || 'Zjistit více',
    visualPrompt: creative?.visualPrompt || '',
    imageUrl: creative?.imageUrl || '',
    sourceChatId: creative?.sourceChatId || null,
    reviewStatus: creative?.reviewStatus || existing?.reviewStatus || 'draft',
    publishStatus: creative?.publishStatus || existing?.publishStatus || 'new',
    performance: {
      ...(existing?.performance || {}),
      ...(creative?.performance || {}),
    },
    metaRef: {
      ...(existing?.metaRef || {}),
      ...(creative?.metaRef || {}),
    },
    googleRef: {
      ...(existing?.googleRef || {}),
      ...(creative?.googleRef || {}),
    },
    createdAt: existing?.createdAt || creative?.createdAt || now,
    updatedAt: now,
  };
  await kv.set(`${GROWTH_CREATIVE_PREFIX}${toSave.id}`, toSave);
  return toSave;
}

async function listGrowthCampaigns() {
  const items = (await kv.get(GROWTH_CAMPAIGNS_KEY) as any[] | null) || [];
  return items.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

async function saveGrowthCampaign(campaign: any) {
  const now = nowIso();
  const items = await listGrowthCampaigns();
  const id = String(campaign?.id || `gcamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const existingIdx = items.findIndex((item: any) => item.id === id);
  const existing = existingIdx >= 0 ? items[existingIdx] : null;
  const toSave = {
    id,
    platform: campaign?.platform === 'google' ? 'google' : 'meta',
    name: campaign?.name || 'Nová growth kampaň',
    status: campaign?.status || existing?.status || 'draft',
    budget: Number(campaign?.budget || existing?.budget || 0),
    externalId: campaign?.externalId || existing?.externalId || '',
    createdAt: existing?.createdAt || campaign?.createdAt || now,
    updatedAt: now,
  };
  if (existingIdx >= 0) items[existingIdx] = toSave;
  else items.unshift(toSave);
  await kv.set(GROWTH_CAMPAIGNS_KEY, items);
  return toSave;
}

async function listGrowthInsights() {
  const items = (await kv.get(GROWTH_INSIGHTS_KEY) as any[] | null) || [];
  return items.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

async function saveGrowthInsights(insights: any[]) {
  await kv.set(GROWTH_INSIGHTS_KEY, insights);
  return insights;
}

function buildGrowthCreativeFallback(product: any, angle: string, idx: number, payload: any) {
  const platformLabel = (payload.platformTargets || ['meta', 'google']).includes('google') && (payload.platformTargets || ['meta', 'google']).includes('meta')
    ? 'Meta i Google'
    : (payload.platformTargets || ['meta', 'google'])[0] === 'google'
      ? 'Google'
      : 'Meta';
  return {
    angle,
    headline: `${product?.name || 'Produkt'}: ${angle}`.slice(0, 90),
    primaryText: `Ukazte konkrétní přínos produktu ${product?.name || ''} pro ${payload.audienceHint || 'učitele'}. Zdůrazněte jednoduchost použití a jasný výsledek ve výuce.`,
    cta: 'Zjistit více',
    visualPrompt: `${platformLabel} promo vizuál pro ${product?.name || 'produkt'}, angle "${angle}", čistý Vividbooks styl, důvěryhodný školní kontext, varianta ${idx + 1}.`,
  };
}

async function generateGrowthCreativeDrafts(payload: any) {
  const products = await getAllProducts();
  const product = products.find((item: any) => String(item.id) === String(payload.productId));
  if (!product) throw new Error('Vybraný produkt nebyl nalezen.');

  const angles = Array.isArray(payload.angles)
    ? payload.angles.map((item: any) => String(item || '').trim()).filter(Boolean)
    : [];
  if (angles.length === 0) throw new Error('Chybí pole angles.');

  const countPerAngle = Math.max(1, Math.min(4, Number(payload.countPerAngle) || 1));
  const audienceHint = ['teacher', 'parent', 'school', 'mixed'].includes(String(payload.audienceHint))
    ? String(payload.audienceHint)
    : 'teacher';
  const platformTargets = Array.isArray(payload.platformTargets) && payload.platformTargets.length
    ? [...new Set(payload.platformTargets.filter((x: any) => x === 'meta' || x === 'google'))]
    : ['meta', 'google'];
  const format = ['image_single', 'carousel', 'story', 'pmax_asset'].includes(String(payload.format))
    ? String(payload.format)
    : 'image_single';

  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  let aiRows: any[] = [];

  if (apiKey) {
    const prompt = {
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        note: product.note,
        price: product.price,
        image: product.image,
        previewLink: product.previewLink,
      },
      angles,
      countPerAngle,
      audienceHint,
      platformTargets,
      format,
    };

    const systemText = `Jsi creative strategist pro performance marketing Vividbooks.

Vrať POUZE validní JSON ve tvaru:
{"creatives":[{"angle":"...","headline":"...","primaryText":"...","cta":"...","visualPrompt":"..."}]}

Pravidla:
- generuj ${countPerAngle} variant pro každý angle
- headline musí být stručný, konkrétní a bez clickbaitu
- primaryText má mít 1-3 věty
- cta krátké, česky
- visualPrompt popisuje vizuální směr pro reklamní asset
- piš česky
- neuváděj žádné neověřené výkonové sliby
- mysli na Meta i Google; pokud se liší, drž text použitelný pro obě platformy`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(prompt) }] }],
          generationConfig: {
            temperature: 0.8,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    if (res.ok) {
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      try {
        aiRows = parseJsonBlock(raw)?.creatives || [];
      } catch (e: any) {
        console.log(`[GrowthCreative] JSON parse fallback: ${e.message}`);
      }
    } else {
      const errText = await res.text();
      console.log(`[GrowthCreative] Gemini fallback: ${errText.slice(0, 240)}`);
    }
  }

  const normalized: any[] = [];
  let aiIndex = 0;
  for (const angle of angles) {
    for (let i = 0; i < countPerAngle; i++) {
      const base = aiRows[aiIndex] || buildGrowthCreativeFallback(product, angle, i, { audienceHint, platformTargets });
      aiIndex += 1;
      normalized.push(await saveGrowthCreative({
        id: buildGrowthCreativeId(angle),
        productId: String(product.id),
        angle,
        audienceHint,
        platformTargets,
        format,
        headline: String(base?.headline || `${product.name}: ${angle}`).slice(0, 120),
        primaryText: String(base?.primaryText || '').slice(0, 600),
        cta: String(base?.cta || 'Zjistit více').slice(0, 40),
        visualPrompt: String(base?.visualPrompt || ''),
        imageUrl: product.image || '',
        sourceChatId: payload.sourceChatId || null,
        reviewStatus: 'draft',
        publishStatus: 'new',
      }));
    }
  }
  return normalized;
}

async function buildGrowthInsights() {
  const creatives = await listGrowthCreatives();
  const approved = creatives.filter((item: any) => item.reviewStatus === 'approved');
  const rejected = creatives.filter((item: any) => item.reviewStatus === 'rejected');
  const withCtr = creatives.filter((item: any) => Number(item?.performance?.ctr) > 0);

  const insights: any[] = [];
  const now = nowIso();

  if (approved.length > 0) {
    const byAngle: Record<string, number> = {};
    for (const item of approved) byAngle[item.angle] = (byAngle[item.angle] || 0) + 1;
    const winner = Object.entries(byAngle).sort((a, b) => b[1] - a[1])[0];
    if (winner) {
      insights.push({
        id: `gins-${Date.now()}-1`,
        type: 'pattern',
        content: `Nejčastěji schválený angle je "${winner[0]}". Má smysl z něj odvodit další varianty pro Meta i Google.`,
        confidence: 0.72,
        relatedCreativeIds: approved.filter((item: any) => item.angle === winner[0]).map((item: any) => item.id),
        createdAt: now,
      });
    }
  }

  if (rejected.length > 0) {
    insights.push({
      id: `gins-${Date.now()}-2`,
      type: 'recommendation',
      content: `${rejected.length} kreativ bylo zamítnuto. Doporučení: zpřesnit headline na konkrétní situaci z hodiny a zkrátit primary text.`,
      confidence: 0.66,
      relatedCreativeIds: rejected.slice(0, 6).map((item: any) => item.id),
      createdAt: now,
    });
  }

  if (withCtr.length > 0) {
    const sortedCtr = [...withCtr].sort((a: any, b: any) => Number(b.performance?.ctr || 0) - Number(a.performance?.ctr || 0));
    const top = sortedCtr[0];
    insights.push({
      id: `gins-${Date.now()}-3`,
      type: 'pattern',
      content: `Nejvyšší CTR má kreativa "${top.headline}" (${Number(top.performance?.ctr || 0).toFixed(2)} %). Vyplatí se duplikovat její styl a benefit framing.`,
      confidence: 0.81,
      relatedCreativeIds: [top.id],
      createdAt: now,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: `gins-${Date.now()}-fallback`,
      type: 'recommendation',
      content: 'Zatím chybí dost review nebo výkonových dat. Začni 6-10 drafty, schval 2-3 směry a teprve potom vyhodnocuj patterny.',
      confidence: 0.58,
      relatedCreativeIds: [],
      createdAt: now,
    });
  }

  return await saveGrowthInsights(insights);
}

app.post('/make-server-93a20b6f/admin/growth-agent', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, productContext } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'Chybí pole messages.' }, 400);
    }
    const data = await runTextSpecialistAgent({
      logPrefix: 'GrowthAgent',
      systemPrompt: GROWTH_AGENT_SYSTEM_PROMPT,
      messages,
      productContext,
      model: body.model,
      useRag: false,
    });
    return c.json(data);
  } catch (e: any) {
    return c.json({ error: `Chyba Growth Agenta: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/growth-agent-chats', async (c) => {
  try {
    const index = (await kv.get(GROWTH_CHAT_INDEX_KEY) as any[] | null) || [];
    return c.json({ chats: index });
  } catch (e: any) {
    return c.json({ error: `Chyba načítání Growth chat history: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/growth-agent-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const chat = await kv.get(`growth-agent:chat:${id}`);
    if (!chat) return c.json({ error: 'Chat nenalezen' }, 404);
    return c.json({ chat });
  } catch (e: any) {
    return c.json({ error: `Chyba načítání Growth chatu: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-agent-chats', async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, messages } = body;
    if (!id || !messages) return c.json({ error: 'Chybí id nebo messages' }, 400);
    const now = nowIso();
    const chatData = { id, title: title || 'Nový Growth chat', messages, updatedAt: now };
    await kv.set(`growth-agent:chat:${id}`, chatData);
    const index = (await kv.get(GROWTH_CHAT_INDEX_KEY) as any[] | null) || [];
    const existingIdx = index.findIndex((ch: any) => ch.id === id);
    const indexEntry = {
      id,
      title: title || 'Nový Growth chat',
      updatedAt: now,
      createdAt: existingIdx >= 0 ? index[existingIdx].createdAt : now,
      messageCount: messages.length,
    };
    if (existingIdx >= 0) index[existingIdx] = indexEntry;
    else index.unshift(indexEntry);
    if (index.length > 50) index.splice(50);
    await kv.set(GROWTH_CHAT_INDEX_KEY, index);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Chyba ukládání Growth chatu: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/growth-agent-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`growth-agent:chat:${id}`);
    const index = (await kv.get(GROWTH_CHAT_INDEX_KEY) as any[] | null) || [];
    await kv.set(GROWTH_CHAT_INDEX_KEY, index.filter((ch: any) => ch.id !== id));
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Chyba mazání Growth chatu: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/growth-creatives', async (c) => {
  try {
    return c.json({ creatives: await listGrowthCreatives() });
  } catch (e: any) {
    return c.json({ error: `Growth creatives GET: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/growth-creatives/:id', async (c) => {
  try {
    const creative = await getGrowthCreative(c.req.param('id'));
    if (!creative) return c.json({ error: 'Kreativa nenalezena' }, 404);
    return c.json({ creative });
  } catch (e: any) {
    return c.json({ error: `Growth creative GET by id: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-creatives', async (c) => {
  try {
    const creative = await saveGrowthCreative(await c.req.json());
    return c.json({ success: true, creative });
  } catch (e: any) {
    return c.json({ error: `Growth creative save: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/growth-creatives/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await getGrowthCreative(id);
    if (!existing) return c.json({ error: 'Kreativa nenalezena' }, 404);
    const updates = await c.req.json();
    const creative = await saveGrowthCreative({ ...existing, ...updates, id });
    return c.json({ success: true, creative });
  } catch (e: any) {
    return c.json({ error: `Growth creative update: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/growth-creatives/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`${GROWTH_CREATIVE_PREFIX}${id}`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Growth creative delete: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-creatives/generate', async (c) => {
  try {
    const creatives = await generateGrowthCreativeDrafts(await c.req.json());
    return c.json({ success: true, creatives });
  } catch (e: any) {
    return c.json({ error: `Growth creative generate: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-creatives/:id/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await getGrowthCreative(id);
    if (!existing) return c.json({ error: 'Kreativa nenalezena' }, 404);
    const creative = await saveGrowthCreative({ ...existing, reviewStatus: 'approved' });
    return c.json({ success: true, creative });
  } catch (e: any) {
    return c.json({ error: `Growth creative approve: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-creatives/:id/reject', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await getGrowthCreative(id);
    if (!existing) return c.json({ error: 'Kreativa nenalezena' }, 404);
    const creative = await saveGrowthCreative({ ...existing, reviewStatus: 'rejected' });
    return c.json({ success: true, creative });
  } catch (e: any) {
    return c.json({ error: `Growth creative reject: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/growth-campaigns', async (c) => {
  try {
    return c.json({ campaigns: await listGrowthCampaigns() });
  } catch (e: any) {
    return c.json({ error: `Growth campaigns GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-campaigns', async (c) => {
  try {
    const campaign = await saveGrowthCampaign(await c.req.json());
    return c.json({ success: true, campaign });
  } catch (e: any) {
    return c.json({ error: `Growth campaign save: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/growth-insights', async (c) => {
  try {
    return c.json({ insights: await listGrowthInsights() });
  } catch (e: any) {
    return c.json({ error: `Growth insights GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-insights/generate', async (c) => {
  try {
    return c.json({ success: true, insights: await buildGrowthInsights() });
  } catch (e: any) {
    return c.json({ error: `Growth insights generate: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/growth-performance', async (c) => {
  try {
    const creatives = await listGrowthCreatives();
    const withCtr = creatives.filter((item: any) => Number(item?.performance?.ctr) > 0);
    const avg = (field: 'ctr' | 'cpc' | 'roas') => {
      const values = creatives.map((item: any) => Number(item?.performance?.[field] || 0)).filter((n: number) => n > 0);
      if (values.length === 0) return null;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };
    return c.json({
      summary: {
        creativeCount: creatives.length,
        approvedCount: creatives.filter((item: any) => item.reviewStatus === 'approved').length,
        activeCount: creatives.filter((item: any) => item.publishStatus === 'active' || item.publishStatus === 'queued').length,
        avgCtr: avg('ctr'),
        avgCpc: avg('cpc'),
        avgRoas: avg('roas'),
        measuredCreatives: withCtr.length,
      },
    });
  } catch (e: any) {
    return c.json({ error: `Growth performance GET: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-optimize', async (c) => {
  try {
    const creatives = await listGrowthCreatives();
    let paused = 0;
    for (const creative of creatives) {
      const ctr = Number(creative?.performance?.ctr || 0);
      if (ctr > 0 && ctr < 1 && creative.publishStatus !== 'paused') {
        await saveGrowthCreative({ ...creative, publishStatus: 'paused' });
        paused += 1;
      }
    }
    const insights = await buildGrowthInsights();
    return c.json({ success: true, paused, insights });
  } catch (e: any) {
    return c.json({ error: `Growth optimize: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-upload/meta', async (c) => {
  try {
    const body = await c.req.json();
    const creativeIds = Array.isArray(body?.creativeIds) ? body.creativeIds.map((id: any) => String(id)) : [];
    if (creativeIds.length === 0) return c.json({ error: 'Chybí creativeIds.' }, 400);

    const results = [];
    for (const id of creativeIds) {
      const creative = await getGrowthCreative(id);
      if (!creative) {
        results.push({ id, status: 'missing' });
        continue;
      }
      if (creative.reviewStatus !== 'approved') {
        results.push({ id, status: 'needs_review' });
        continue;
      }
      const updated = await saveGrowthCreative({
        ...creative,
        publishStatus: 'queued',
        metaRef: {
          ...(creative.metaRef || {}),
          publishAttemptId: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          status: 'queued_placeholder',
        },
      });
      results.push({ id, status: updated.publishStatus });
    }
    return c.json({
      success: true,
      message: 'Schválené kreativy jsou ve frontě k publikování do Meta (napojení API se dokončuje).',
      results,
    });
  } catch (e: any) {
    return c.json({ error: `Growth upload Meta: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/growth-upload/google', async (c) => {
  try {
    const body = await c.req.json();
    const creativeIds = Array.isArray(body?.creativeIds) ? body.creativeIds.map((id: any) => String(id)) : [];
    if (creativeIds.length === 0) return c.json({ error: 'Chybí creativeIds.' }, 400);

    const results = [];
    for (const id of creativeIds) {
      const creative = await getGrowthCreative(id);
      if (!creative) {
        results.push({ id, status: 'missing' });
        continue;
      }
      if (creative.reviewStatus !== 'approved') {
        results.push({ id, status: 'needs_review' });
        continue;
      }
      const updated = await saveGrowthCreative({
        ...creative,
        publishStatus: 'queued',
        googleRef: {
          ...(creative.googleRef || {}),
          publishAttemptId: `google-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          status: 'queued_placeholder',
        },
      });
      results.push({ id, status: updated.publishStatus });
    }
    return c.json({
      success: true,
      message: 'Schválené kreativy jsou ve frontě k publikování do Google (napojení API se dokončuje).',
      results,
    });
  } catch (e: any) {
    return c.json({ error: `Growth upload Google: ${e.message}` }, 500);
  }
});

const RAG_INDEX_KEY = 'rag:index';
const RAG_TREE_KEY  = 'rag:tree';

async function embedText(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  if (!apiKey) throw new Error('GEMINI_API_KEY_RAG not set');

  // gemini-embedding-001 confirmed via ListModels — 3072 dims
  const ATTEMPTS = [
    { v: 'v1beta', m: 'gemini-embedding-001' },
    { v: 'v1',     m: 'gemini-embedding-001' },
  ];
  const errors: string[] = [];
  for (const { v, m } of ATTEMPTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/${v}/models/${m}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { parts: [{ text }] } }),
          signal: controller.signal,
        }
      );
    } catch (fetchErr: any) {
      clearTimeout(timer);
      errors.push(`${m}/${v}:fetch_error:${fetchErr.message}`);
      continue;
    }
    clearTimeout(timer);
    const errBody = res.ok ? '' : await res.text();
    if (!res.ok) {
      errors.push(`${m}/${v}:${res.status}[${errBody.slice(0, 200)}]`);
      if (res.status !== 404) throw new Error(`Gemini embed ${res.status} (${m}/${v}): ${errBody.slice(0, 300)}`);
      continue;
    }
    const vals = (await res.json()).embedding?.values ?? [];
    if (vals.length > 0) {
      console.log(`[embedText] OK model=${m} v=${v} dims=${vals.length}`);
      return vals;
    }
    errors.push(`${m}/${v}:empty`);
  }
  throw new Error(`Embedding API nedostupne. Detail: ${errors.join(' | ')}`);
}

async function geminiGenerate(prompt: string, model = 'gemini-3-flash-preview'): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  if (!apiKey) throw new Error('GEMINI_API_KEY_RAG not set');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2048 } }) }
  );
  if (!res.ok) throw new Error(`Gemini generate ${res.status}: ${(await res.text()).slice(0,200)}`);
  return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function cosineSim(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

async function getChunkIndex(): Promise<string[]> {
  return (await kv.get(RAG_INDEX_KEY) as string[]) ?? [];
}
async function addToIndex(id: string) {
  const idx = await getChunkIndex();
  if (!idx.includes(id)) await kv.set(RAG_INDEX_KEY, [...idx, id]);
}
async function removeFromIndex(id: string) {
  await kv.set(RAG_INDEX_KEY, (await getChunkIndex()).filter(i => i !== id));
}

function getDbClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function vectorToSql(values: number[] | null | undefined): string | null {
  if (!values?.length) return null;
  return `[${values.map((v) => Number.isFinite(v) ? String(v) : '0').join(',')}]`;
}

function parseStoredVector(value: any): number[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    } catch {
      const body = trimmed.replace(/^\[/, '').replace(/\]$/, '');
      if (!body) return [];
      return body.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));
    }
  }
  return [];
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeChunkMetadata(chunk: any) {
  const raw = chunk?.metadata && typeof chunk.metadata === 'object' ? { ...chunk.metadata } : {};
  if (!raw.source) raw.source = 'manual';
  if (!raw.sourceId) raw.sourceId = raw.slug || raw.docId || raw.title || chunk?.id || crypto.randomUUID();
  if (!raw.external_id && chunk?.id) raw.external_id = String(chunk.id);
  return raw;
}

function deriveSourceDocumentFields(chunk: any) {
  const metadata = normalizeChunkMetadata(chunk);
  const sourceType = String(metadata.source || 'manual');
  const sourceId = String(metadata.sourceId || metadata.external_id);
  const title = String(metadata.title || metadata.subject || sourceId);
  const language = String(metadata.language || 'cs');
  return { metadata, sourceType, sourceId, title, language };
}

function mapRagRow(row: any): any {
  const metadata = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
  const doc = row?.document || row?.source_documents || null;
  if (doc?.source_type && !metadata.source) metadata.source = doc.source_type;
  if (doc?.source_id && !metadata.sourceId) metadata.sourceId = doc.source_id;
  if (doc?.title && !metadata.title) metadata.title = doc.title;
  const embedding = parseStoredVector(row?.embedding);
  return {
    id: String(metadata.external_id || row.id),
    dbId: row.id,
    text: row.text || row.content || '',
    embedding,
    embeddingDims: embedding.length,
    metadata,
  };
}

async function ensureSourceDocument(chunk: any): Promise<{ documentId: string; metadata: any }> {
  const sb = getDbClient();
  const { metadata, sourceType, sourceId, title, language } = deriveSourceDocumentFields(chunk);
  const payload = {
    source_type: sourceType,
    source_id: sourceId,
    title,
    language,
    ingest_state: 'indexed',
    content_hash: md5(`${sourceType}:${sourceId}:${title}`),
    metadata,
    is_active: true,
    last_ingested_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from('source_documents')
    .upsert(payload, { onConflict: 'source_type,source_id' })
    .select('id')
    .single();
  if (error) throw new Error(`source_documents upsert failed: ${error.message}`);
  return { documentId: data.id, metadata };
}

async function loadSourceDocumentsByType(sourceType: string): Promise<any[]> {
  const sb = getDbClient();
  const { data, error } = await sb
    .from('source_documents')
    .select('id, source_id, title, metadata, updated_at, created_at')
    .eq('source_type', sourceType)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`source_documents load failed: ${error.message}`);
  return data || [];
}

async function loadMailchimpCampaigns(): Promise<any[]> {
  const rows = await loadSourceDocumentsByType('mailchimp');
  return rows.map((row: any) => ({
    id: row.source_id,
    ...(row.metadata || {}),
    title: row.metadata?.title || row.title || '',
    importedAt: row.metadata?.importedAt || row.updated_at || row.created_at,
  }));
}

async function syncMailchimpCampaignDocuments(campaigns: any[]): Promise<void> {
  const sb = getDbClient();
  const nowIso = new Date().toISOString();
  if (!campaigns.length) {
    const { error } = await sb
      .from('source_documents')
      .update({ is_active: false, updated_at: nowIso })
      .eq('source_type', 'mailchimp');
    if (error) throw new Error(`mailchimp deactivate failed: ${error.message}`);
    return;
  }
  const payload = campaigns.map((campaign: any) => ({
    source_type: 'mailchimp',
    source_id: String(campaign.id),
    title: String(campaign.subject || campaign.title || campaign.id),
    language: 'cs',
    ingest_state: 'indexed',
    content_hash: md5(JSON.stringify({
      subject: campaign.subject || '',
      title: campaign.title || '',
      plainText: campaign.plainText || '',
      sendTime: campaign.sendTime || '',
      clickRate: campaign.clickRate ?? null,
      openRate: campaign.openRate ?? null,
    })),
    metadata: {
      ...campaign,
      source: 'mailchimp',
      sourceId: String(campaign.id),
      title: String(campaign.subject || campaign.title || campaign.id),
    },
    is_active: true,
    last_ingested_at: nowIso,
  }));
  const { error: upsertError } = await sb
    .from('source_documents')
    .upsert(payload, { onConflict: 'source_type,source_id' });
  if (upsertError) throw new Error(`mailchimp source_documents sync failed: ${upsertError.message}`);

  const ids = campaigns.map((campaign: any) => String(campaign.id));
  const { error: deactivateError } = await sb
    .from('source_documents')
    .update({ is_active: false, updated_at: nowIso })
    .eq('source_type', 'mailchimp')
    .not('source_id', 'in', `(${ids.map((id) => `"${id.replace(/"/g, '""')}"`).join(',')})`);
  if (deactivateError) throw new Error(`mailchimp source_documents cleanup failed: ${deactivateError.message}`);
}

// POST /rag/chunk [DISABLED — System 2 handles this via /* POST /rag/chunk */]
app.post('/make-server-93a20b6f/rag/chunk-v1-disabled', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/chunk.' }, 410);
  try {
    const { text, metadata } = await c.req.json();
    if (!text || text.trim().length < 20) return c.json({ error: 'Text too short (min 20 chars)' }, 400);
    const id = `rag:chunk:${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const tokens = Math.ceil(text.split(/\s+/).length * 1.35);
    console.log(`[RAG] Embedding chunk: ${text.slice(0,60)}...`);
    const embedding = await embedText(text);
    await kv.set(id, { id, text: text.trim(), embedding, metadata: { ...metadata, tokens, quality: null, createdAt: new Date().toISOString() } });
    await addToIndex(id);
    console.log(`[RAG] Chunk ingested: ${id} (${tokens} tok, ${embedding.length} dims)`);
    return c.json({ success: true, id, tokens, dims: embedding.length });
  } catch (e: any) { console.log('[RAG] Ingest error:', e.message); return c.json({ error: `RAG ingest: ${e.message}` }, 500); }
});

// GET /rag/chunks [DISABLED — System 2 handles this]
app.get('/make-server-93a20b6f/rag/chunks-v1-disabled', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/chunks.' }, 410);
  try {
    const index = await getChunkIndex();
    const chunks = (await Promise.all(index.map(async id => {
      const ch = await kv.get(id) as any;
      if (!ch) return null;
      const { embedding, ...rest } = ch;
      return { ...rest, embeddingDims: embedding?.length ?? 0 };
    }))).filter(Boolean);
    return c.json({ chunks, total: chunks.length });
  } catch (e: any) { return c.json({ error: `RAG list: ${e.message}` }, 500); }
});

// GET /rag/chunk/:id [DISABLED]
app.get('/make-server-93a20b6f/rag/chunk-v1-disabled/:id', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/chunks.' }, 410);
  try {
    const rawId = c.req.param('id');
    const id = rawId.startsWith('rag:chunk:') ? rawId : `rag:chunk:${rawId}`;
    const ch = await kv.get(id) as any;
    if (!ch) return c.json({ error: 'Chunk not found' }, 404);
    const { embedding, ...rest } = ch;
    return c.json({ chunk: { ...rest, embeddingDims: embedding?.length ?? 0 } });
  } catch (e: any) { return c.json({ error: `RAG get: ${e.message}` }, 500); }
});

// PUT /rag/chunk/:id [DISABLED]
app.put('/make-server-93a20b6f/rag/chunk-v1-disabled/:id', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/chunk.' }, 410);
  try {
    const rawId = c.req.param('id');
    const id = rawId.startsWith('rag:chunk:') ? rawId : `rag:chunk:${rawId}`;
    const body = await c.req.json();
    const existing = await kv.get(id) as any;
    if (!existing) return c.json({ error: 'Chunk not found' }, 404);
    const updated = { ...existing, ...body };
    if (body.text && body.text !== existing.text) {
      console.log(`[RAG] Re-embedding updated chunk: ${id}`);
      updated.embedding = await embedText(body.text);
      updated.metadata = { ...updated.metadata, tokens: Math.ceil(body.text.split(/\s+/).length * 1.35), updatedAt: new Date().toISOString() };
    }
    await kv.set(id, updated);
    return c.json({ success: true, id });
  } catch (e: any) { return c.json({ error: `RAG update: ${e.message}` }, 500); }
});

// DELETE /rag/chunk/:id [DISABLED]
app.delete('/make-server-93a20b6f/rag/chunk-v1-disabled/:id', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/chunk/:id.' }, 410);
  try {
    const rawId = c.req.param('id');
    const id = rawId.startsWith('rag:chunk:') ? rawId : `rag:chunk:${rawId}`;
    await kv.del(id);
    await removeFromIndex(id);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: `RAG delete: ${e.message}` }, 500); }
});

// POST /rag/query [DISABLED — System 2 handles this]
app.post('/make-server-93a20b6f/rag/query-v1-disabled', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/query.' }, 410);
  try {
    const { question, topK = 5 } = await c.req.json();
    if (!question?.trim()) return c.json({ error: 'Missing question' }, 400);
    const index = await getChunkIndex();
    if (index.length === 0) return c.json({ answer: 'RAG datab\u00e1ze je pr\u00e1zdn\u00e1. Nejd\u0159\u00edve nahrajte obsah.', sources: [], chunksUsed: 0 });
    console.log(`[RAG] Query: "${question.slice(0,80)}" — ${index.length} chunks`);
    const qEmbed = await embedText(question);
    const chunks = (await Promise.all(index.map(id => kv.get(id)))).filter(Boolean) as any[];
    const scored = chunks.filter(ch => ch.embedding?.length > 0)
      .map(ch => ({ ...ch, score: cosineSim(qEmbed, ch.embedding) }))
      .sort((a, b) => b.score - a.score).slice(0, topK);
    const context = scored.map((ch, i) => `[${i+1}] Zdroj: ${ch.metadata?.source ?? 'Nezn\u00e1m\u00fd'} / ${ch.metadata?.category ?? ''}\n${ch.text}`).join('\n\n---\n\n');
    const prompt = `Jsi asistent Vividbooks — platformy digit\u00e1ln\u00edch u\u010debnic pro z\u00e1kladn\u00ed \u0161koly. Odpov\u00eddej v\u00fdlu\u010dn\u011b v \u010de\u0161tin\u011b.\n\nKONTEXT:\n${context}\n\nOT\u00c1ZKA: ${question}\n\nOdpov\u011bz na z\u00e1klad\u011b kontextu. Pokud informace nen\u00ed k dispozici, \u0159ekni to. Uv\u00e1d\u011bj [1][2] atd.`;
    const answer = await geminiGenerate(prompt, 'gemini-3-flash-preview');
    return c.json({ answer, sources: scored.map(ch => ({ id: ch.id, source: ch.metadata?.source, category: ch.metadata?.category, subject: ch.metadata?.subject, score: Math.round(ch.score*100)/100 })), chunksUsed: scored.length });
  } catch (e: any) { console.log('[RAG] Query error:', e.message); return c.json({ error: `RAG query: ${e.message}` }, 500); }
});

// GET /rag/tree
app.get('/make-server-93a20b6f/rag/tree', async (c) => {
  try { return c.json({ tree: await kv.get(RAG_TREE_KEY) ?? null }); }
  catch (e: any) { return c.json({ error: e.message }, 500); }
});

// PUT /rag/tree
app.put('/make-server-93a20b6f/rag/tree', async (c) => {
  try {
    const { tree } = await c.req.json();
    await kv.set(RAG_TREE_KEY, tree);
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// POST /rag/agent/run [DISABLED — System 2 handles this]
app.post('/make-server-93a20b6f/rag/agent/run-v1-disabled', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/agent/run.' }, 410);
  try {
    const index = await getChunkIndex();
    if (index.length === 0) return c.json({ success: true, stats: { total: 0, duplicatesRemoved: 0, qualityChecked: 0 }, actions: [] });
    const chunks = (await Promise.all(index.map(id => kv.get(id)))).filter(Boolean) as any[];
    const actions: any[] = [];

    // Deduplicate
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    for (const ch of chunks) {
      const key = ch.text.slice(0, 120).toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) { toDelete.push(ch.id); actions.push({ type: 'duplicate', id: ch.id, message: `Duplik\u00e1t odstra\u0148\u011bn: "${ch.text.slice(0,50)}..."` }); }
      else seen.set(key, ch.id);
    }
    for (const id of toDelete) { await kv.del(id); await removeFromIndex(id); }

    // Quality scoring (Gemini 2.5 Pro, max 8 chunks)
    const sample = chunks.filter(ch => !toDelete.includes(ch.id)).slice(0, 8);
    let qualityChecked = 0;
    if (sample.length > 0) {
      const qPrompt = `Jsi agent \u010distoty RAG datab\u00e1ze. Analyzuj chunky a p\u0159i\u0159a\u010f quality score (0.0\u20131.0). 1.0=perfektn\u00ed, 0.0=\u0161um/HTML artefakty.\nOdpov\u011bz POUZE JSON: [{"id":"...","quality":0.X,"issues":[]}]\n\n${sample.map(ch => `ID: ${ch.id}\nText: ${ch.text.slice(0,300)}`).join('\n---\n')}`;
      try {
        const result = await geminiGenerate(qPrompt, 'gemini-3-flash-preview');
        const m = result.match(/\[[\s\S]*?\]/);
        if (m) {
          const scores = JSON.parse(m[0]) as any[];
          for (const s of scores) {
            const ch = await kv.get(s.id) as any;
            if (ch) {
              ch.metadata = { ...ch.metadata, quality: s.quality, qualityIssues: s.issues, lastCleaned: new Date().toISOString() };
              await kv.set(s.id, ch);
              qualityChecked++;
              actions.push({ type: s.quality < 0.7 ? 'low-quality' : 'quality-ok', id: s.id, quality: s.quality, message: `Kvalita ${s.quality.toFixed(2)}: ${s.quality < 0.7 ? (s.issues?.join(', ') ?? 'Nízk\u00e1 relevanc') : 'OK'}` });
            }
          }
        }
      } catch (qe: any) { actions.push({ type: 'warning', message: `Quality scoring selhal: ${qe.message}` }); }
    }

    return c.json({ success: true, stats: { total: chunks.length, duplicatesRemoved: toDelete.length, qualityChecked }, actions });
  } catch (e: any) { console.log('[RAG Agent] Error:', e.message); return c.json({ error: `Agent error: ${e.message}` }, 500); }
});

// POST /rag/ingest-source [DISABLED — System 2 handles this]
app.post('/make-server-93a20b6f/rag/ingest-source-v1-disabled', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/ingest-source.' }, 410);
  try {
    const { source } = await c.req.json();
    const srcMap: Record<string, { kvKey: string; label: string; category: string }> = {
      produkty: { kvKey: KV_KEY,       label: 'Produkty',       category: 'P\u0159edm\u011bty'    },
      blog:     { kvKey: BLOG_KEY,     label: 'Blog',           category: 'Blog'              },
      novinky:  { kvKey: NOVINKY_KEY,  label: 'Novinky',        category: 'Novinky'           },
      webinare: { kvKey: WEBINARS_KEY, label: 'Webin\u00e1\u0159e', category: 'Webin\u00e1\u0159e' },
    };
    const src = srcMap[source];
    if (!src) return c.json({ error: `Nezn\u00e1m\u00fd zdroj: ${source}` }, 400);

    // Load items — blog/novinky/webinare use saveCollection (stores {items:[],updatedAt}), products use saveAllProducts ({products:[]})
    const raw = await kv.get(src.kvKey) as any;
    console.log(`[RAG ingest] source=${source} rawType=${typeof raw} isArr=${Array.isArray(raw)} keys=${raw ? Object.keys(raw).join(',') : 'null'}`);

    let items: any[] = [];
    if (source === 'produkty') {
      items = raw?.products ?? [];
    } else {
      items = raw?.items ?? raw?.posts ?? (Array.isArray(raw) ? raw : []);
    }
    console.log(`[RAG ingest] ${source}: ${items.length} items found`);

    if (items.length === 0) {
      return c.json({ error: `Zdroj "${source}" je pr\u00e1zdn\u00fd. Nejprve importujte data z Webflow (sekce Migrace). Debug: raw=${JSON.stringify(raw)?.slice(0,200)}` }, 400);
    }

    // Clear old chunks for this source
    const existingIdx = await getChunkIndex();
    const existingChunks = (await Promise.all(existingIdx.map(id => kv.get(id)))).filter(Boolean) as any[];
    const oldIds = existingChunks.filter(ch => ch.metadata?.source === src.label).map(ch => ch.id);
    for (const id of oldIds) await kv.del(id);
    if (oldIds.length > 0) await kv.set(RAG_INDEX_KEY, existingIdx.filter(id => !oldIds.includes(id)));
    console.log(`[RAG ingest] Cleared ${oldIds.length} old chunks for ${src.label}`);

    // Extract best text from item — handles blog (excerpt), webinar (description), novinky (excerpt/perex), products (description/anotace)
    function extractItemText(item: any): string {
      const title = String(item.title ?? item.name ?? '');
      const bodyRaw =
        item.excerpt ??
        item.description ??
        item.perex ??
        item.summary ??
        item.anotace ??
        (Array.isArray(item.content) ? item.content.filter((b: any) => b.type === 'paragraph').map((b: any) => b.text ?? '').slice(0, 3).join(' ') : '') ??
        item.contentHtml ??
        '';
      const body = stripHtml(String(bodyRaw ?? '')).slice(0, 1200);
      return `${title}\n\n${body}`.trim();
    }

    const ingested: string[] = [];
    const failed: string[] = [];
    const limit = Math.min(items.length, 50);

    for (let i = 0; i < limit; i++) {
      const item = items[i];
      const text = extractItemText(item).slice(0, 1500);
      if (text.length < 25) {
        console.log(`[RAG ingest] Item ${i} too short (${text.length} chars), skip`);
        continue;
      }
      const docId = String(item.id ?? item._id ?? i).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
      const id = `rag:chunk:${source}_${docId}_${Math.random().toString(36).slice(2, 5)}`;
      try {
        console.log(`[RAG ingest] Embedding ${i + 1}/${limit}: "${text.slice(0, 70)}..."`);
        const embedding = await embedText(text);
        if (!embedding || embedding.length === 0) {
          console.log(`[RAG ingest] Empty embedding for item ${i}`);
          failed.push(docId);
          continue;
        }
        await kv.set(id, {
          id, text, embedding,
          metadata: {
            source: src.label, category: src.category,
            docId, subject: item.subject ?? item.predmet ?? null,
            tokens: Math.ceil(text.split(/\s+/).length * 1.35),
            quality: null, createdAt: new Date().toISOString(),
          },
        });
        ingested.push(id);
        await new Promise(r => setTimeout(r, 250)); // 250ms gap — stay within Gemini rate limits
      } catch (embedErr: any) {
        console.log(`[RAG ingest] Item ${i} embed error: ${embedErr.message}`);
        failed.push(docId);
        // don't abort — continue with remaining items
      }
    }

    const newIdx = [...new Set([...(await getChunkIndex()), ...ingested])];
    await kv.set(RAG_INDEX_KEY, newIdx);
    console.log(`[RAG ingest] Finished: ${ingested.length} ok, ${failed.length} failed, total index=${newIdx.length}`);

    if (ingested.length === 0) {
      return c.json({ error: `V\u0161echny ${limit} polo\u017eek selhaly p\u0159i embeddingu. Ov\u011b\u0159te kl\u00ed\u010d p\u0159es GET /rag/debug. Prvn\u00ed chyba pravd\u011bpodobn\u011b: zkontrolujte GEMINI_API_KEY_RAG.` }, 500);
    }
    return c.json({ success: true, ingested: ingested.length, failed: failed.length, total: newIdx.length });
  } catch (e: any) {
    console.log('[RAG] Ingest-source fatal error:', e.message);
    return c.json({ error: `Ingest selh\u00e1l: ${e.message}` }, 500);
  }
});

// GET /rag/debug [DISABLED — System 2 handles this]
app.get('/make-server-93a20b6f/rag/debug-v1-disabled', async (c) => {
  return c.json({ error: 'Legacy RAG v1 endpoint is disabled. Use /rag/debug.' }, 410);
  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  const result: any = {
    geminiKeySet: !!apiKey,
    geminiKeyLength: apiKey?.length ?? 0,
    geminiKeyPrefix: apiKey ? `${apiKey.slice(0, 8)}...` : null,
    embeddingTest: null,
    embeddingError: null,
    sources: {},
    ragIndex: 0,
  };

  if (apiKey) {
    try {
      const emb = await embedText('Test Vividbooks embedding diagnostics.');
      result.embeddingTest = { dims: emb.length, sample: emb.slice(0, 3), ok: emb.length > 0 };
    } catch (e: any) {
      result.embeddingError = e.message;
    }
  }

  try { const r = await kv.get(BLOG_KEY) as any;     result.sources.blog     = { items: r?.items?.length ?? 0, keys: r ? Object.keys(r) : [] }; } catch (e: any) { result.sources.blog     = { error: e.message }; }
  try { const r = await kv.get(KV_KEY) as any;       result.sources.produkty = { items: r?.products?.length ?? 0, keys: r ? Object.keys(r) : [] }; } catch (e: any) { result.sources.produkty = { error: e.message }; }
  try { const r = await kv.get(NOVINKY_KEY) as any;  result.sources.novinky  = { items: r?.items?.length ?? 0, keys: r ? Object.keys(r) : [] }; } catch (e: any) { result.sources.novinky  = { error: e.message }; }
  try { const r = await kv.get(WEBINARS_KEY) as any; result.sources.webinare = { items: r?.items?.length ?? 0, keys: r ? Object.keys(r) : [] }; } catch (e: any) { result.sources.webinare = { error: e.message }; }
  try { result.ragIndex = (await getChunkIndex()).length; } catch { result.ragIndex = 0; }

  return c.json(result);
});

/* ── Supabase Storage — image bucket ──────────────────────────── */
async function getStorageClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb  = createClient(url, key);
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b: any) => b.name === IMAGE_BUCKET)) {
    await sb.storage.createBucket(IMAGE_BUCKET, { public: true });
    console.log(`[Storage] Bucket '${IMAGE_BUCKET}' vytvoren.`);
  }
  return sb;
}

/* POST /upload-image — multipart upload */
app.post('/make-server-93a20b6f/upload-image', async (c) => {
  try {
    const sb   = await getStorageClient();
    const body = await c.req.parseBody();
    const file = body['file'] as File;
    if (!file || !file.name) return c.json({ error: 'Chybi soubor (field: "file").' }, 400);

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buf  = await file.arrayBuffer();

    const { error } = await sb.storage.from(IMAGE_BUCKET).upload(safe, buf, { contentType: file.type, upsert: false });
    if (error) return c.json({ error: `Storage upload selhal: ${error.message}` }, 500);

    const { data } = sb.storage.from(IMAGE_BUCKET).getPublicUrl(safe);
    console.log(`[Storage] Nahrano: ${safe} (${file.size} B)`);
    return c.json({ success: true, url: data.publicUrl, name: safe });
  } catch (e: any) {
    console.log(`[upload-image] Chyba: ${e.message}`);
    return c.json({ error: `Upload selhal: ${e.message}` }, 500);
  }
});

/* GET /images ��� list all uploaded images */
app.get('/make-server-93a20b6f/images', async (c) => {
  try {
    const sb = await getStorageClient();
    const { data, error } = await sb.storage.from(IMAGE_BUCKET).list('', {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) return c.json({ error: `Galerie selhal: ${error.message}` }, 500);

    const images = (data ?? [])
      .filter((f: any) => f.name && !f.name.startsWith('.'))
      .map((f: any) => ({
        name: f.name,
        url:  sb.storage.from(IMAGE_BUCKET).getPublicUrl(f.name).data.publicUrl,
        size: (f.metadata as any)?.size ?? 0,
        createdAt: f.created_at,
      }));

    return c.json({ images });
  } catch (e: any) {
    console.log(`[images] Chyba: ${e.message}`);
    return c.json({ error: `Galerie selhal: ${e.message}` }, 500);
  }
});

/* DELETE /images/:name */
app.delete('/make-server-93a20b6f/images/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const sb   = await getStorageClient();
    const { error } = await sb.storage.from(IMAGE_BUCKET).remove([name]);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

const IMAGE_GALLERY_FOLDERS_KEY = 'vb:image-gallery-folder-map';

/* GET /image-tags — vrátí mapu URL → string[] a volitelně galleryFolders (URL → název složky pro nahrané soubory) */
app.get('/make-server-93a20b6f/image-tags', async (c) => {
  try {
    const tags = (await kv.get('vb:image-tags-map')) as Record<string, string[]> | null ?? {};
    const galleryFolders = (await kv.get(IMAGE_GALLERY_FOLDERS_KEY)) as Record<string, string> | null ?? {};
    return c.json({ tags, galleryFolders });
  } catch (e: any) {
    console.log(`[image-tags GET] Chyba: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

/* POST /image-gallery-folder — přiřadí nahranému obrázku složku v galerii (nezávislé na hashtag tagách) */
app.post('/make-server-93a20b6f/image-gallery-folder', async (c) => {
  try {
    const { url, folder } = await c.req.json();
    if (!url || typeof url !== 'string') return c.json({ error: 'url je povinné' }, 400);
    const map = (await kv.get(IMAGE_GALLERY_FOLDERS_KEY)) as Record<string, string> | null ?? {};
    const f = typeof folder === 'string' ? folder.trim().slice(0, 120) : '';
    if (!f) delete map[url];
    else map[url] = f;
    await kv.set(IMAGE_GALLERY_FOLDERS_KEY, map);
    return c.json({ success: true });
  } catch (e: any) {
    console.log(`[image-gallery-folder POST] Chyba: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

/* POST /image-tags — uloží tagy pro URL */
app.post('/make-server-93a20b6f/image-tags', async (c) => {
  try {
    const { url, tags } = await c.req.json();
    if (!url) return c.json({ error: 'url je povinné' }, 400);
    const existing = (await kv.get('vb:image-tags-map')) as Record<string, string[]> | null ?? {};
    if (!tags || (Array.isArray(tags) && tags.length === 0)) {
      delete existing[url];
    } else {
      existing[url] = tags;
    }
    await kv.set('vb:image-tags-map', existing);
    return c.json({ success: true });
  } catch (e: any) {
    console.log(`[image-tags POST] Chyba: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

/* ════════════════
   KONTAKT — POST /make-server-93a20b6f/kontakt
   Ukládá zprávu z kontaktního formuláře do KV store.
══════════════════════════════════════════════════════════════════ */
const CONTACT_MSGS_KEY = 'vividbooks_contact_messages_v1';

app.post('/make-server-93a20b6f/kontakt', async (c) => {
  try {
    const { email, message } = await c.req.json();
    if (!email || !message) return c.json({ error: 'email a message jsou povinne' }, 400);

    const existing = (await kv.get(CONTACT_MSGS_KEY)) as any[] | null ?? [];
    const entry = { id: Date.now(), email, message, createdAt: new Date().toISOString() };
    await kv.set(CONTACT_MSGS_KEY, [...existing, entry]);

    return c.json({ success: true });
  } catch (e: any) {
    console.log('[kontakt] error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

/* ── Popup CRUD ───────────────────────────────────────���────────── */
app.get('/make-server-93a20b6f/popups', async (c) => {
  const popups = (await kv.get(POPUPS_KEY)) ?? [];
  return c.json({ popups });
});

app.get('/make-server-93a20b6f/popups/active', async (c) => {
  const all: any[] = (await kv.get(POPUPS_KEY)) ?? [];
  const active = all.filter((p: any) => p.active);
  return c.json({ popups: active });
});

app.post('/make-server-93a20b6f/popups', async (c) => {
  try {
    const body = await c.req.json();
    const all: any[] = (await kv.get(POPUPS_KEY)) ?? [];
    const newPopup = {
      ...body,
      id: `popup_${Date.now()}`,
      stats: { shown: 0, converted: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(POPUPS_KEY, [...all, newPopup]);
    console.log('[popups] created:', newPopup.id);
    return c.json({ popup: newPopup });
  } catch (e: any) {
    console.log('[popups] create error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

app.put('/make-server-93a20b6f/popups/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const all: any[] = (await kv.get(POPUPS_KEY)) ?? [];
    const updated = all.map((p: any) =>
      p.id === id ? { ...p, ...body, id, updatedAt: new Date().toISOString() } : p
    );
    await kv.set(POPUPS_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    console.log('[popups] update error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

app.delete('/make-server-93a20b6f/popups/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const all: any[] = (await kv.get(POPUPS_KEY)) ?? [];
    await kv.set(POPUPS_KEY, all.filter((p: any) => p.id !== id));
    return c.json({ success: true });
  } catch (e: any) {
    console.log('[popups] delete error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

app.post('/make-server-93a20b6f/popups/:id/stat', async (c) => {
  try {
    const id = c.req.param('id');
    const { event } = await c.req.json(); // 'shown' | 'converted'
    const all: any[] = (await kv.get(POPUPS_KEY)) ?? [];
    const updated = all.map((p: any) => {
      if (p.id !== id) return p;
      const stats = { ...(p.stats ?? { shown: 0, converted: 0 }) };
      if (event === 'shown') stats.shown = (stats.shown ?? 0) + 1;
      if (event === 'converted') stats.converted = (stats.converted ?? 0) + 1;
      return { ...p, stats };
    });
    await kv.set(POPUPS_KEY, updated);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/* ── Newsletter subscribe ──────────────────────────────────────── */
/** Potvrzovací e-mail po novém odběru (Mandrill). Volitelně NEWSLETTER_PRIVACY_URL, jinak vividbooks.cz/gdpr. */
function buildNewsletterSubscribeConfirmationHtml(): string {
  const esc = remEscHtmlReminder;
  const site = esc(normalizePublicSiteOrigin(getPublicSiteOrigin()));
  const logoSrc = esc(webinarEmailHeaderLogoAbsoluteUrl());
  const year = new Date().getFullYear();
  const privacyUrl = esc(
    Deno.env.get('NEWSLETTER_PRIVACY_URL')?.trim() || 'https://www.vividbooks.cz/gdpr',
  );
  const unsubQuery =
    `subject=${encodeURIComponent('Odhlášení z newsletteru')}` +
    `&body=${encodeURIComponent('Prosím o odhlášení mého e-mailu z odběru novinek.')}`;
  const unsubHref = esc(`mailto:hello@vividbooks.com?${unsubQuery}`);
  return `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"/><meta name="color-scheme" content="light dark"/></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6fb;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,17,97,0.08);">
<tr><td style="background:#001161;padding:22px 24px 20px;text-align:center;border-radius:12px 12px 0 0;">
<a href="${site}" style="text-decoration:none;border:0;display:inline-block;">
<img src="${logoSrc}" alt="Vividbooks" width="${WEBINAR_EMAIL_HEADER_LOGO_PX}" style="display:block;margin:0 auto;width:${WEBINAR_EMAIL_HEADER_LOGO_PX}px;max-width:${WEBINAR_EMAIL_HEADER_LOGO_PX}px;height:auto;border:0;"/>
</a>
<p style="margin:12px 0 0;color:rgba(255,255,255,0.65);font-size:11px;text-transform:uppercase;letter-spacing:2px;">Newsletter pro učitele</p>
</td></tr>
<tr><td style="padding:28px 28px 8px;color:#1a1a22;font-size:16px;line-height:1.65;">
<p style="margin:0 0 1em;">Dobrý den,</p>
<p style="margin:0 0 1em;">děkujeme za váš zájem o náš newsletter. Moc si vážíme toho, že vám záleží na <strong style="color:#001161;">kvalitním vzdělávání</strong> — těší nás, že vám můžeme přinášet inspiraci do výuky.</p>
<p style="margin:0 0 1em;">Brzy vám budeme posílat vybrané novinky: metodické tipy, novinky o titulech a pozvánky. Žádný spam — jen to, co dává smysl ve škole.</p>
<p style="margin:0 0 1.25em;">Když budete chtít napsat zpětnou vazbu, stačí odpovědět na tento e-mail.</p>
<p style="margin:0 0 0.25em;color:#001161;font-weight:bold;font-size:15px;">Co můžete čekat</p>
<ul style="margin:0;padding:0 0 0 1.25em;color:#3d3d48;font-size:15px;line-height:1.55;">
<li style="margin:0 0 0.35em;">nové tituly a témata dřív než ostatní,</li>
<li style="margin:0 0 0.35em;">metodické tipy přímo do výuky,</li>
<li style="margin:0 0 0.35em;">exkluzivní slevy a pozvánky na webináře.</li>
</ul>
</td></tr>
<tr><td style="padding:8px 28px 8px;" align="center">
<a href="${site}" style="display:inline-block;padding:14px 28px;background:#E8942A;color:#ffffff !important;text-decoration:none;font-weight:bold;font-size:15px;border-radius:10px;">Přejít na Vividbooks</a>
</td></tr>
<tr><td style="padding:20px 28px 28px;color:#6b7280;font-size:12px;line-height:1.6;border-top:1px solid #edf2f7;">
<p style="margin:0 0 1em;">Tento e-mail vám posíláme, protože jste na <a href="${site}" style="color:#001161;">webu</a> vyjádřili zájem o odběr. Zpracování e-mailu probíhá v souladu s <a href="${privacyUrl}" style="color:#001161;">zásadami ochrany osobních údajů</a>. Odběr můžete kdykoli zrušit — napište nám na <a href="${unsubHref}" style="color:#001161;">hello@vividbooks.com</a> nebo odpovězte na tuto zprávu.</p>
<p style="margin:0;">© ${year} Vividbooks · <a href="mailto:hello@vividbooks.com" style="color:#6b7280;">hello@vividbooks.com</a></p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;max-width:560px;">Pokud jste odběr nevyžádali vy, dejte nám prosím vědět odpovědí — adresu vyřadíme.</p>
</td></tr></table>
</body></html>`;
}

app.post('/make-server-93a20b6f/newsletter/subscribe', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const rawEmail = String(body?.email || '').trim();
    const source = typeof body?.source === 'string' ? body.source : 'unknown';
    const email = rawEmail.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: 'Neplatný e-mail' }, 400);
    }

    const existing: any[] = (await kv.get(NEWSLETTER_KEY)) ?? [];
    const already = existing.find(
      (s: any) => String(s?.email || '').toLowerCase().trim() === email,
    );
    if (already) return c.json({ success: true, duplicate: true });

    const entry = {
      id: Date.now(),
      email,
      source,
      subscribedAt: new Date().toISOString(),
    };
    await kv.set(NEWSLETTER_KEY, [...existing, entry]);
    console.log(`[newsletter] subscribed: ${email} from ${source}`);

    let confirmationEmailSent = false;
    const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
    if (mandrillKey) {
      const html = buildNewsletterSubscribeConfirmationHtml();
      const toName = email.split('@')[0];
      const r = await sendMandrillHtmlResult({
        toEmail: email,
        toName,
        subject: 'Děkujeme za odběr newsletteru — Vividbooks',
        html,
      });
      confirmationEmailSent = r.ok;
      if (!r.ok) console.log(`[newsletter] Mandrill potvrzení neodesláno: ${r.detail || '?'}`);
    } else {
      console.log('[newsletter] MANDRILL_API_KEY chybí — potvrzovací e-mail přeskočen');
    }

    return c.json({ success: true, confirmationEmailSent });
  } catch (e: any) {
    console.log('[newsletter] error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

/* ── Newsletter list (admin) ───────────────────────────────────── */
app.get('/make-server-93a20b6f/newsletter/subscribers', async (c) => {
  const subscribers = (await kv.get(NEWSLETTER_KEY)) ?? [];
  return c.json({ subscribers });
});

/* ══════════════════════════════════════════���═══════════════════════
   DVPP VIDEOS — Webflow collections → KV cache
   Topics: 67c5e17f4844f5f538279158
   Videos: 66b119eaa0271061207bdd18
══════════════════════════════════════════════════════════════════ */

async function syncDvppVideos(): Promise<{ topics: any[]; videos: any[] }> {
  const token = Deno.env.get('WEBFLOW_API_TOKEN');
  if (!token) throw new Error('WEBFLOW_API_TOKEN not set');

  console.log('[dvpp-videos] Starting sync...');

  // 1. Fetch topics
  const topicRaw = await fetchFromWebflow(DVPP_TOPICS_COLLECTION_ID, token);
  console.log(`[dvpp-videos] Topics raw: ${topicRaw.length}`);
  const topics = topicRaw.map((item: any) => {
    const f = item.fieldData || item;
    return {
      id: item.id || item._id,
      name: f.name || f.nazev || f.title || f.jmeno || '',
      slug: f.slug || (item.id || item._id),
      order: Number(f.order ?? f.poradi ?? f['sort-order'] ?? 0),
    };
  }).filter((t: any) => t.name);

  const topicIdSet = new Set(topics.map((t: any) => t.id));
  console.log(`[dvpp-videos] Topics parsed: ${topics.length}, ids: ${[...topicIdSet].join(', ')}`);

  // 2. Fetch videos
  const videoRaw = await fetchFromWebflow(DVPP_VIDEOS_COLLECTION_ID, token);
  console.log(`[dvpp-videos] Videos raw: ${videoRaw.length}`);

  const videos: any[] = [];
  for (const item of videoRaw) {
    const f = item.fieldData || item;
    const id = item.id || item._id;

    // Find topic reference — new field: "DVPP Webinar Tema (DOPLNIT)" → dvpp-webinar-tema-doplnit
    const topicRef =
      f['dvpp-webinar-tema-doplnit'] ?? f['dvpp-webinar-tema-2'] ??
      f['dvpp-tema'] ?? f['dvpp-webinar-tema'] ?? f['webinar-tema'] ??
      f['tema'] ?? f['topic'] ?? f['kategorie'] ?? f['category'] ??
      f['topics'] ?? f['temata'] ?? f['tematic'] ?? null;

    // Could be string ID, array of IDs, or object with id
    let topicIds: string[] = [];
    if (Array.isArray(topicRef)) {
      topicIds = topicRef.map((r: any) => (typeof r === 'string' ? r : r?.id ?? r?._id ?? '')).filter(Boolean);
    } else if (typeof topicRef === 'string' && topicRef) {
      topicIds = [topicRef];
    } else if (topicRef && typeof topicRef === 'object') {
      topicIds = [topicRef.id ?? topicRef._id ?? ''].filter(Boolean);
    }

    // Only include videos that belong to at least one DVPP topic
    const matchedTopicIds = topicIds.filter(tid => topicIdSet.has(tid));
    if (matchedTopicIds.length === 0) {
      console.log(`[dvpp-videos] Skipping "${f['nadpis-videa'] ?? f.name ?? id}" — no match. topicRef=${JSON.stringify(topicRef)}, fields=[${Object.keys(f).join(',')}]`);
      continue;
    }

    const YT_PATTERN = /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

    // ── YouTube URL — Webflow field "Video Link" → slug: video-link ──
    let youtubeUrl: string = f['video-link'] ?? f['youtube-url'] ?? f['youtube'] ??
      f['video-url'] ?? f['video'] ?? f['yt-link'] ?? f['youtube-link'] ??
      f['zaznam'] ?? f['zaznam-url'] ?? f['recording'] ?? '';

    // Fallback: scan ALL fields for YouTube pattern
    if (!youtubeUrl || !YT_PATTERN.test(youtubeUrl)) {
      for (const [key, val] of Object.entries(f)) {
        if (key === 'slug' || key === 'name' || key === 'nadpis-videa') continue;
        const s = typeof val === 'string' ? val
          : (typeof val === 'object' && val !== null ? (val as any).url ?? '' : '');
        if (s && YT_PATTERN.test(String(s))) {
          console.log(`[dvpp-videos] YouTube found in field "${key}" for "${f['nadpis-videa'] ?? f.name ?? id}": ${s}`);
          youtubeUrl = String(s);
          break;
        }
      }
    }
    youtubeUrl = typeof youtubeUrl === 'string' ? youtubeUrl : '';

    // ── Certificate URL — Webflow field "Grey Button Link" → slug: grey-button-link ──
    const certificateUrl: string = String(
      f['grey-button-link'] ?? f['certifikat-url'] ?? f['certifikat'] ??
      f['certificate-url'] ?? f['cert-url'] ?? ''
    );

    // ── Button texts from Webflow ─────────────��────────────────────
    const orangeButtonText: string = String(f['orange-button-text'] ?? '');
    const orangeButtonLink: string = String(f['orange-button-link'] ?? '');
    const greyButtonText: string = String(f['grey-button-text'] ?? '');

    // ── Thumbnail — Webflow field "Image" → slug: image ──────────
    const thumb =
      f['image']?.url ?? f['thumbnail-image']?.url ?? f['thumbnail']?.url ??
      f['nahledovy-obrazek']?.url ?? f['cover-image']?.url ??
      (typeof f['image'] === 'string' ? f['image'] : '') ??
      (typeof f['thumbnail'] === 'string' ? f['thumbnail'] : '') ?? '';

    // ── Title — Webflow field "Nadpis Videa" → slug: nadpis-videa ─
    const name = f['nadpis-videa'] || f.name || f.nazev || f.title || f.titulek || '';

    console.log(`[dvpp-videos] OK "${name}": yt="${youtubeUrl}", cert="${certificateUrl}", orangeLink="${orangeButtonLink}"`);

    videos.push({
      id,
      name,
      slug: f.slug || id,
      thumbnail: typeof thumb === 'string' ? thumb : (thumb?.url ?? ''),
      youtubeUrl,
      certificateUrl,
      orangeButtonText,
      orangeButtonLink,
      greyButtonText,
      topicIds: matchedTopicIds,
      description: f.description || f.popis || f.perex || '',
      _raw: f,
    });
  }

  console.log(`[dvpp-videos] Matched videos: ${videos.length}`);
  const result = { topics, videos, updatedAt: new Date().toISOString() };
  await kv.set(DVPP_VIDEOS_KEY, result);
  return result;
}

/* GET /dvpp-videos — public, auto-syncs if empty */
app.get('/make-server-93a20b6f/dvpp-videos', async (c) => {
  try {
    let data: any = await kv.get(DVPP_VIDEOS_KEY);
    if (!data?.topics?.length && !data?.videos?.length) {
      console.log('[dvpp-videos] Cache empty, auto-syncing from Webflow...');
      try {
        data = await syncDvppVideos();
      } catch (syncErr: any) {
        console.error('[dvpp-videos] Auto-sync failed:', syncErr.message);
        data = { topics: [], videos: [] };
      }
    }
    const webinars = (await getCollection(WEBINARS_KEY)) as any[];
    const rawVideos = data.videos ?? [];
    const videos = enrichDvppVideosWithWebinarCertificateFields(rawVideos, webinars);
    return c.json({ topics: data.topics ?? [], videos, updatedAt: data.updatedAt });
  } catch (e: any) {
    console.error('[dvpp-videos] GET error:', e.message);
    return c.json({ error: e.message, topics: [], videos: [] }, 500);
  }
});

/* POST /dvpp-videos/sync — admin re-sync */
app.post('/make-server-93a20b6f/dvpp-videos/sync', async (c) => {
  try {
    const result = await syncDvppVideos();
    return c.json({ success: true, topicsCount: result.topics.length, videosCount: result.videos.length });
  } catch (e: any) {
    console.error('[dvpp-videos] sync error:', e.message);
    return c.json({ error: `Sync selhal: ${e.message}` }, 500);
  }
});

/* PUT /dvpp-videos/:id — update a single DVPP video (admin) */
app.put('/make-server-93a20b6f/dvpp-videos/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const data: any = await kv.get(DVPP_VIDEOS_KEY) ?? { topics: [], videos: [] };
    const videos: any[] = data.videos ?? [];
    const idx = videos.findIndex((v: any) => v.id === id);
    if (idx === -1) {
      const newVideo = { id, ...updates, _manual: true };
      data.videos = [...videos, newVideo];
      await kv.set(DVPP_VIDEOS_KEY, data);
      console.log(`[dvpp-videos] Created new manual video: ${id}`);
      return c.json({ success: true, created: true, video: newVideo });
    }
    data.videos[idx] = { ...videos[idx], ...updates, updatedAt: new Date().toISOString() };
    await kv.set(DVPP_VIDEOS_KEY, data);
    console.log(`[dvpp-videos] Updated video: ${id}`);
    return c.json({ success: true, video: data.videos[idx] });
  } catch (e: any) {
    console.log(`[dvpp-videos PUT] CHYBA: ${e.message}`);
    return c.json({ error: `dvpp-videos PUT: ${e.message}` }, 500);
  }
});

/* ── Webinar Live Chat ───────────────────────────���──��──────────────── */
// GET  /webinar-chat/:webinarId  — load messages
app.get('/make-server-93a20b6f/webinar-chat/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const data = await kv.get(`webinar_chat_${webinarId}`) ?? { messages: [] };
    return c.json(data);
  } catch (e: any) {
    console.log(`[chat] GET error: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

// POST /webinar-chat/:webinarId  — post a message
app.post('/make-server-93a20b6f/webinar-chat/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const { name, text, type, isAdmin } = await c.req.json();
    if (!name?.trim() || !text?.trim()) return c.json({ error: 'Chyb\u00ed jm\u00e9no nebo text.' }, 400);
    const key = `webinar_chat_${webinarId}`;
    const data = await kv.get(key) ?? { messages: [] };
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim().slice(0, 40),
      text: text.trim().slice(0, 500),
      type: type === 'qa' ? 'qa' : 'chat',
      isAdmin: !!isAdmin,
      ts: new Date().toISOString(),
      reactions: {} as Record<string, number>,
    };
    const messages = [...((data.messages as any[]) || []), msg].slice(-300);
    await kv.set(key, { messages });
    console.log(`[chat] ${webinarId} | ${msg.name}: ${msg.text.slice(0, 60)}`);
    return c.json({ success: true, msg });
  } catch (e: any) {
    console.log(`[chat] POST error: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

// POST /webinar-chat/:webinarId/react  — add emoji reaction to a message
app.post('/make-server-93a20b6f/webinar-chat/:webinarId/react', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const { msgId, emoji } = await c.req.json();
    const key = `webinar_chat_${webinarId}`;
    const data = await kv.get(key) ?? { messages: [] };
    const messages = ((data.messages as any[]) || []).map((m: any) => {
      if (m.id !== msgId) return m;
      const reactions = { ...m.reactions };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      return { ...m, reactions };
    });
    await kv.set(key, { ...data, messages });
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// DELETE /webinar-chat/:webinarId  — clear all messages (admin)
app.delete('/make-server-93a20b6f/webinar-chat/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    await kv.del(`webinar_chat_${webinarId}`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/* ── Webinar Live Reactions ────────────────────────────────────���─────── */
// POST /webinar-reactions/:webinarId �� odeslat emoji reakci (viditelnou pro všechny)
app.post('/make-server-93a20b6f/webinar-reactions/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const { emoji } = await c.req.json();
    if (!emoji) return c.json({ error: 'Chybí emoji.' }, 400);
    const key = `webinar_reactions_${webinarId}`;
    const data: any[] = (await kv.get(key)) ?? [];
    const entry = {
      id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      ts: Date.now(),
    };
    // Uchovávej pouze posledních 200 reakcí (~60s)
    const updated = [...data, entry].slice(-200);
    await kv.set(key, updated);
    return c.json({ success: true, id: entry.id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /webinar-reactions/:webinarId?since=<timestamp> — načíst nové reakce od timestamp
app.get('/make-server-93a20b6f/webinar-reactions/:webinarId', async (c) => {
  try {
    const webinarId = c.req.param('webinarId');
    const since = Number(c.req.query('since') ?? 0);
    const key = `webinar_reactions_${webinarId}`;
    const data: any[] = (await kv.get(key)) ?? [];
    const cutoff = Date.now() - 60000;
    const fresh = data.filter((r: any) => r.ts > Math.max(since, cutoff));
    return c.json({ reactions: fresh });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/* ── School Search — CSV cache first, ARES fallback ─────────────── */
app.get('/make-server-93a20b6f/school-search', async (c) => {
  const q = c.req.query('q') || '';
  const ico = c.req.query('ico') || '';

  try {
    // ── Try CSV cache first ───────────────────────────────────────
    const schools = await loadSchoolsCache();

    // Search by IČO
    if (ico && /^\d{6,10}$/.test(ico.trim())) {
      const icoTrim = ico.trim();
      const icoClean = icoTrim.replace(/^0+/, ''); // leading zeros stripped
      const hit = schools.find(s => s.ico.replace(/^0+/, '') === icoClean);

      const fetchAresEkonomickySubjektByIco = async () => {
        const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${icoTrim}`;
        const res = await fetch(aresUrl, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return null;
        return res.json();
      };

      if (hit) {
        const csvAddr = sanitizeSchoolAddressForApi(hit.address, hit.ico);
        if (csvAddr) {
          return c.json({
            results: [{
              ico: hit.ico,
              name: hit.name,
              address: csvAddr,
              kraj: hit.kraj,
              source: 'csv',
            }],
          });
        }
        // CSV často nemá adresu nebo mělo v poli omylem jen IČO — doplnit sídlo z ARES
        const data = await fetchAresEkonomickySubjektByIco();
        if (data) {
          const icoOut = String(data.ico || icoTrim);
          const addrOut = buildAresAddress(data.sidlo);
          const aresAddr = sanitizeSchoolAddressForApi(addrOut, icoOut);
          return c.json({
            results: [{
              ico: hit.ico,
              name: (hit.name && hit.name.trim()) ? hit.name : (data.obchodniJmeno || data.nazev || ''),
              address: aresAddr,
              kraj: hit.kraj,
              source: aresAddr ? 'csv+ares' : 'csv',
            }],
          });
        }
        return c.json({
          results: [{
            ico: hit.ico,
            name: hit.name,
            address: '',
            kraj: hit.kraj,
            source: 'csv',
          }],
        });
      }

      // IČO není v CSV — jen ARES
      const data = await fetchAresEkonomickySubjektByIco();
      if (data) {
        const icoOut = String(data.ico || icoTrim);
        const addrOut = buildAresAddress(data.sidlo);
        return c.json({
          results: [{
            ico: icoOut,
            name: data.obchodniJmeno || data.nazev || '',
            address: sanitizeSchoolAddressForApi(addrOut, icoOut),
            source: 'ares',
          }],
        });
      }
      return c.json({ results: [] });
    }

    // Search by name in CSV
    if (q && q.trim().length >= 2 && schools.length > 0) {
      const hits = searchSchools(schools, q.trim());
      if (hits.length > 0) {
        console.log(`[Schools] CSV search "${q}" → ${hits.length} výsledků`);
        return c.json({
          results: hits.map((s) => ({
            ico: s.ico,
            name: s.name,
            address: sanitizeSchoolAddressForApi(s.address, s.ico),
            kraj: s.kraj,
            source: 'csv',
          })),
        });
      }
    }

    // Striktní filtr názvem — povolí jen subjekty obsahující typická školní slova
    if (!q || q.trim().length < 2) return c.json({ results: [] });

    const aresUrl = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat';
    const SCHOOL_NACE = ['8510','8520','8531','8532','8541','8542','8551','8552','8553','8559','8560'];

    // Odstraní komerční entity které se vloudí do NACE výsledků
    // (s.r.o. / a.s. BEZ jakéhokoli školního slova v názvu)
    const SCHOOL_HINTS = ['\u0161kol', 'gymn', 'akademi', 'konzervat', 'u\u010dili\u0161', 'lyc', 'pedagog', 'vzd\u011bl', 'bilingv'];
    const COMMERCIAL_PATTERNS = [' s.r.o', ', s.r.o', ' a.s.', ', a.s.', ' k.s.', ' v.o.s.', ' spol. s r', ' s. r. o'];
    const isObviouslyCommercial = (name: string): boolean => {
      const n = name.toLowerCase();
      const hasCommercialForm = COMMERCIAL_PATTERNS.some(p => n.includes(p));
      if (!hasCommercialForm) return false;
      const hasSchoolHint = SCHOOL_HINTS.some(h => n.includes(h));
      return !hasSchoolHint; // komerční firma BEZ školního slova → vyhodit
    };

    // Broadší fallback filtr — neruší školy bez "škola" v názvu (gymnázia, akademie, konzervatoře...)
    const looksLikeSchool = (name: string): boolean => {
      const n = name.toLowerCase();
      return SCHOOL_HINTS.some(h => n.includes(h));
    };

    let subjekty: any[] = [];
    let naceHadResults = false;

    // 1) Primárně NACE filtr — výsledky jsou vzdělávací instituce
    //    Odstraníme jen jasně komerční entity (s.r.o. bez jakéhokoli školního slova)
    try {
      const r1 = await fetch(aresUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ obchodniJmeno: q.trim(), naceKody: SCHOOL_NACE, pocet: 30, start: 0 }),
      });
      if (r1.ok) {
        const d1 = await r1.json();
        const raw: any[] = d1.ekonomickeSubjekty || [];
        subjekty = raw.filter((s: any) => !isObviouslyCommercial(s.obchodniJmeno || ''));
        naceHadResults = raw.length > 0;
        console.log(`[ARES] NACE "${q}" → ${raw.length} hrubých, ${subjekty.length} po filtraci`);
      }
    } catch (e: any) {
      console.log(`[ARES] NACE search error: ${e.message}`);
    }

    // 2) Fallback POUZE pokud NACE nevrátil nic — broadší klíčová slova
    //    (nezavrhuje gymnázia, akademie, konzervatoře bez "škola" v názvu)
    if (!naceHadResults) {
      console.log(`[ARES] Fallback name-only search for "${q}"`);
      try {
        const r2 = await fetch(aresUrl, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ obchodniJmeno: q.trim(), pocet: 40, start: 0 }),
        });
        if (r2.ok) {
          const d2 = await r2.json();
          subjekty = (d2.ekonomickeSubjekty || []).filter((s: any) => looksLikeSchool(s.obchodniJmeno || ''));
          console.log(`[ARES] Fallback "${q}" → ${subjekty.length} institucí`);
        }
      } catch (e2: any) {
        console.log(`[ARES] Fallback error: ${e2.message}`);
      }
    }

    const results = subjekty.slice(0, 15).map((s: any) => {
      const icoOut = String(s.ico || '');
      const addrOut = buildAresAddress(s.sidlo);
      return {
        ico: icoOut,
        name: s.obchodniJmeno || '',
        address: sanitizeSchoolAddressForApi(addrOut, icoOut),
      };
    });

    return c.json({ results });
  } catch (e: any) {
    console.log(`[ARES] Chyba: ${e.message}`);
    return c.json({ error: `Chyba ARES: ${e.message}`, results: [] }, 500);
  }
});

/** Google Places (legacy) — server-side, klíč jen v Edge Secrets. */
function getGoogleMapsApiKeyForPlaces(): string {
  return (Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('GOOGLE_PLACES_API_KEY') || '').trim();
}

function parseGoogleAddressComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
): { street: string; city: string; zip: string } {
  let streetNumber = '';
  let route = '';
  let city = '';
  let zip = '';
  for (const c of components) {
    const t = c.types || [];
    if (t.includes('street_number')) streetNumber = c.long_name;
    if (t.includes('route')) route = c.long_name;
    if (t.includes('locality')) city = c.long_name;
    if (t.includes('postal_town') && !city) city = c.long_name;
    if (t.includes('postal_code')) zip = String(c.long_name || '').replace(/\s/g, '');
  }
  if (!city) {
    for (const c of components) {
      if ((c.types || []).includes('administrative_area_level_2')) {
        city = c.long_name;
        break;
      }
    }
  }
  const street = [route, streetNumber].filter(Boolean).join(' ').trim();
  return { street, city, zip };
}

const addressAutocompleteHandler = async (c: Context) => {
  const raw = String(c.req.query('input') || '').trim();
  if (raw.length < 2) {
    return c.json({ ok: true, enabled: false, predictions: [] as Array<{ description: string; placeId: string }> });
  }
  if (raw.length > 120) {
    return c.json({ ok: false, error: 'Dotaz je příliš dlouhý.' }, 400);
  }
  const key = getGoogleMapsApiKeyForPlaces();
  if (!key) {
    return c.json({ ok: true, enabled: false, predictions: [] as Array<{ description: string; placeId: string }> });
  }
  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', raw);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'cs');
  url.searchParams.set('types', 'address');
  url.searchParams.set('components', 'country:cz|country:sk');
  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      predictions?: Array<{ description: string; place_id: string }>;
      error_message?: string;
    };
    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      console.warn('[address-autocomplete]', data.status, data.error_message || '');
      return c.json({ ok: true, enabled: false, predictions: [] });
    }
    const predictions = (data.predictions || []).slice(0, 8).map((p) => ({
      description: p.description,
      placeId: p.place_id,
    }));
    return c.json({ ok: true, enabled: true, predictions });
  } catch (e: any) {
    console.warn('[address-autocomplete]', e?.message || e);
    return c.json({ ok: true, enabled: false, predictions: [] });
  }
};

const placeDetailsForAddressHandler = async (c: Context) => {
  const placeId = String(c.req.query('placeId') || '').trim();
  if (!placeId || placeId.length > 512) {
    return c.json({ ok: false, error: 'Chybí platné placeId.' }, 400);
  }
  const key = getGoogleMapsApiKeyForPlaces();
  if (!key) {
    return c.json({ ok: false, error: 'Adresní nápověda není nakonfigurovaná.' }, 503);
  }
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'cs');
  url.searchParams.set(
    'fields',
    'address_component,formatted_address',
  );
  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      result?: { address_components?: Array<{ long_name: string; short_name: string; types: string[] }> };
      error_message?: string;
    };
    if (data.status !== 'OK' || !data.result?.address_components) {
      console.warn('[place-details]', data.status, data.error_message || '');
      return c.json({ ok: false, error: 'Adresu se nepodařilo načíst.' }, 404);
    }
    const parsed = parseGoogleAddressComponents(data.result.address_components);
    let street = parsed.street;
    if (!street && data.result && (data.result as any).formatted_address) {
      const fa = String((data.result as any).formatted_address);
      const first = fa.split(',')[0]?.trim() || '';
      if (first) street = first;
    }
    return c.json({
      ok: true,
      street: street || '',
      city: parsed.city || '',
      zip: parsed.zip || '',
    });
  } catch (e: any) {
    console.warn('[place-details]', e?.message || e);
    return c.json({ ok: false, error: e?.message || 'Chyba' }, 500);
  }
};

app.get('/make-server-93a20b6f/address-autocomplete', addressAutocompleteHandler);
app.get('/address-autocomplete', addressAutocompleteHandler);
app.get('/make-server-93a20b6f/place-details', placeDetailsForAddressHandler);
app.get('/place-details', placeDetailsForAddressHandler);

type PipedriveOwnerSummary = {
  id: number | null;
  name: string;
  firstName: string;
  email: string;
  phone: string;
  photoUrl: string;
};

type PipedriveSchoolLookup = {
  status: string;
  message: string;
  orgId: number | null;
  orgName: string | null;
  owner: PipedriveOwnerSummary | null;
  colleagues: string[];
  products: string[];
  openDeals: number;
  wonDeals: number;
  totalDeals: number;
  matchedBy: 'ico' | 'name' | null;
  org?: any | null;
  deals?: any[];
  ownerUserId?: number | null;
  /** ISO — poslední trial deal (název trial / zkušební / zkusit) */
  lastTrialDealAt: string | null;
  /** true = od posledního trial dealu neuplynulo 6 „měsíců“ (30d) — formulář trial na webu má blokovat */
  trialCooldownActive: boolean;
  /** ISO — nejdřívější datum, kdy lze trial z formuláře znovu (lastTrial + cooldown) */
  trialNextEligibleAt: string | null;
  /**
   * Jen při `lookupSchoolInPipedrive(..., { includePipedriveRaw: true })` —
   * skutečná JSON těla z Pipedrive (dealy org., hit z search), ne náš souhrn.
   */
  pipedriveApi?: {
    deals: any[];
    organizationSearchItem: any | null;
    dealLabelIdToName: Record<string, string>;
  };
};

const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';
/** API v2 (products/search, …) — stejný host, jiný prefix než v1. */
const PIPEDRIVE_V2_BASE_URL = 'https://api.pipedrive.com/api/v2';
let pipedriveOrgIcoFieldKeyCache: string | null | undefined;
/** Cache: organization field id → { key, field_type } for school-order customer label detection */
let pipedriveOrgFieldsMetaByIdCache: Map<number, { key: string; fieldType: string }> | null = null;
/** Cache: deal field id → { key, field_type } (order form label) */
let pipedriveDealFieldMetaByIdCache: Map<number, { key: string; fieldType: string }> | null = null;
const PIPEDRIVE_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;

function pipedriveEnvInt(name: string, defaultVal: number): number {
  const raw = (Deno.env.get(name) || '').trim();
  if (!raw) return defaultVal;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultVal;
}
const pipedriveSchoolLookupCache = new Map<string, { expiresAt: number; value: PipedriveSchoolLookup }>();

function getPipedriveApiToken() {
  return Deno.env.get('PIPEDRIVE_API_TOKEN') || '';
}

function normalizePipedriveSearchText(value: string) {
  return removeDiacritics(String(value || '').trim()).replace(/\s+/g, ' ');
}

function parsePipedriveNumericId(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Minimální odstup mezi zkušebními žádostmi pro stejné IČO (6×30 dní, shodně s KV newsletter — přibližné měsíce). */
const PIPEDRIVE_TRIAL_REPEAT_COOLDOWN_MS = 6 * 30 * 24 * 60 * 60 * 1000;

let pipedriveDealLabelOptionsCache: { expiresAt: number; options: Record<string, string> } | null = null;

/** Mapování ID → název z pole Label u dealu (Pipedrive /dealFields, key label). */
async function getPipedriveDealLabelIdToName(apiToken: string): Promise<Record<string, string>> {
  if (pipedriveDealLabelOptionsCache && pipedriveDealLabelOptionsCache.expiresAt > Date.now()) {
    return pipedriveDealLabelOptionsCache.options;
  }
  try {
    const map = await getPipedriveFieldMap(apiToken, '/dealFields');
    const options = map['label']?.options || {};
    pipedriveDealLabelOptionsCache = { expiresAt: Date.now() + 15 * 60 * 1000, options };
    return options;
  } catch (e: any) {
    console.log(`[Pipedrive] deal label options: ${e.message}`);
    return {};
  }
}

/** Jména štítků přiřazených dealu (pole label = ID nebo CSV ID). */
function dealLabelNamesFromDeal(deal: any, idToName: Record<string, string>): string[] {
  const out: string[] = [];
  const raw = deal?.label ?? deal?.labels;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && (item as any).label != null) {
        out.push(String((item as any).label));
      } else if (item != null) {
        const name = idToName[String((item as any)?.id ?? item)];
        if (name) out.push(name);
      }
    }
    return out;
  }
  if (raw != null && raw !== '') {
    for (const id of String(raw).split(',').map((s) => s.trim()).filter(Boolean)) {
      const name = idToName[id];
      if (name) out.push(name);
    }
  }
  return out;
}

/**
 * Prospect + Interactive — v CRM často česky „Prospekt“, „Interaktivní“ (bez anglického „prospect“).
 * Štítky mohou být rozdělené na více položek; text spojíme.
 */
function dealHasProspectInteractiveLabel(deal: any, idToName: Record<string, string>): boolean {
  const names = dealLabelNamesFromDeal(deal, idToName);
  if (!names.length) return false;
  const blob = removeDiacritics(names.join(' '));
  const hasProspecty = blob.includes('prospect') || blob.includes('prospekt');
  const hasInteractive = blob.includes('interactive') || blob.includes('interaktiv');
  return hasProspecty && hasInteractive;
}

/**
 * Štítky „Trial web (interactive)“, „Trial upsell v app (interactive)“… — obsahují „trial“, ne „prospect“.
 * „Trial Web - parent…“ často nemá v textu „interactive“, ale má „trial web“.
 */
function dealHasTrialInteractiveFamilyLabel(deal: any, idToName: Record<string, string>): boolean {
  const names = dealLabelNamesFromDeal(deal, idToName);
  if (!names.length) return false;
  const blob = removeDiacritics(names.join(' '));
  const hasIx = blob.includes('interactive') || blob.includes('interaktiv');
  const hasTrialish =
    blob.includes('trial') ||
    blob.includes('zkuseb') ||
    blob.includes('zkusit') ||
    blob.includes('free trial');
  if (hasIx && hasTrialish) return true;
  if (blob.includes('trial web') || blob.includes('trialweb')) return true;
  return false;
}

/**
 * Trial / zkušební deal: hlavně štítek PROSPECT (INTERACTIVE) + stav open (aktivní) nebo lost (historie).
 * Doplňují heuristiky podle názvu (trial, deal - GŠ, …).
 */
function isPipedriveTrialDeal(deal: any, dealLabelIdToName?: Record<string, string> | null): boolean {
  const idToName = dealLabelIdToName || {};
  const st = String(deal?.status || '').toLowerCase();

  if (dealHasProspectInteractiveLabel(deal, idToName)) {
    if (st === 'lost' || st === 'open') return true;
  }

  if (dealHasTrialInteractiveFamilyLabel(deal, idToName)) {
    if (st === 'lost' || st === 'open') return true;
  }

  const title = removeDiacritics(String(deal?.title || ''));
  return (
    title.includes('trial') ||
    title.includes('zkusebn') ||
    title.includes('zkusit') ||
    title.includes('free trial') ||
    title.includes('deal - gš') ||
    title.includes('deal - gs') ||
    title.includes('deal-gs') ||
    title.includes('deal-gš')
  );
}

function parsePipedriveDealTimestampMs(value: unknown): number | null {
  const s = String(value || '').trim();
  if (!s) return null;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const t = new Date(normalized).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Řazení dealů podle poslední aktivity (owner, záložní výběr). */
function pipedriveDealRecencyScoreMs(deal: any): number {
  const candidates = [
    deal?.update_time,
    deal?.stage_change_time,
    deal?.add_time,
    deal?.lost_time,
    deal?.close_time,
  ];
  let best = 0;
  for (const c of candidates) {
    const ms = parsePipedriveDealTimestampMs(c);
    if (ms != null && ms > best) best = ms;
  }
  return best;
}

function pickMostRecentPipedriveDeal(deals: any[]): any | null {
  if (!Array.isArray(deals) || deals.length === 0) return null;
  return [...deals].sort((a, b) => pipedriveDealRecencyScoreMs(b) - pipedriveDealRecencyScoreMs(a))[0];
}

/** Nejnovější čas z trial dealu v CRM (podle won_time, add_time, update_time, stage_change_time). */
function getLatestPipedriveTrialDealInfo(
  deals: any[],
  dealLabelIdToName?: Record<string, string> | null,
): { lastMs: number; lastIso: string } | null {
  const trialDeals = (Array.isArray(deals) ? deals : []).filter((d) => isPipedriveTrialDeal(d, dealLabelIdToName));
  /* Od minulé žádosti: primárně uzavřené (lost) dealy; jinak jakýkoli trial (např. jen otevřený). */
  const lostTrials = trialDeals.filter((d: any) => String(d?.status || '').toLowerCase() === 'lost');
  const pool = lostTrials.length > 0 ? lostTrials : trialDeals;
  let bestMs = 0;
  for (const d of pool) {
    const candidates = [d?.won_time, d?.add_time, d?.update_time, d?.stage_change_time];
    for (const c of candidates) {
      const ms = parsePipedriveDealTimestampMs(c);
      if (ms != null && ms > bestMs) bestMs = ms;
    }
  }
  if (bestMs <= 0) return null;
  return { lastMs: bestMs, lastIso: new Date(bestMs).toISOString() };
}

/** Odhad data ukončení / vypršení přístupů z uzavřených trial dealů (ne open). */
function getLatestTrialAccessEndedMs(deals: any[], dealLabelIdToName?: Record<string, string> | null): number | null {
  const closedTrials = (Array.isArray(deals) ? deals : [])
    .filter((d) => isPipedriveTrialDeal(d, dealLabelIdToName))
    .filter((d: any) => d?.status !== 'open');
  let bestMs = 0;
  for (const d of closedTrials) {
    const ms = parsePipedriveDealTimestampMs(
      d.lost_time || d.won_time || d.close_time || d.update_time,
    );
    if (ms != null && ms > bestMs) bestMs = ms;
  }
  return bestMs > 0 ? bestMs : null;
}

function formatCsDateLongFromMs(ms: number): string {
  return new Date(ms).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPipedriveColleagueName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
  return parts[0] || '';
}

function buildPipedriveLookupCacheKey(params: { ico?: string; name?: string; includePipedriveRaw?: boolean }) {
  const raw = params.includePipedriveRaw ? 'raw1' : 'raw0';
  return `${String(params.ico || '').trim()}::${normalizePipedriveSearchText(String(params.name || ''))}::${raw}`;
}

function summarizePipedriveSchoolState(params: {
  orgId: number | null;
  orgName: string | null;
  matchedBy: 'ico' | 'name' | null;
  deals: any[];
  persons: any[];
  owner: PipedriveOwnerSummary | null;
  ownerUserId: number | null;
  products: string[];
  org?: any | null;
  /** ID → název z dealFields.label (PROSPECT INTERACTIVE apod.) */
  dealLabelIdToName?: Record<string, string> | null;
}): PipedriveSchoolLookup {
  const deals = Array.isArray(params.deals) ? params.deals : [];
  const labelMap = params.dealLabelIdToName || {};
  const subscriptionDeals = deals.filter((deal: any) => !isPipedriveTrialDeal(deal, labelMap));
  const wonSubs = subscriptionDeals.filter((deal: any) => deal?.status === 'won');
  const openSubs = subscriptionDeals.filter((deal: any) => deal?.status === 'open');
  const openTrials = deals.filter(
    (deal: any) => isPipedriveTrialDeal(deal, labelMap) && deal?.status === 'open',
  );
  const colleagues = (Array.isArray(params.persons) ? params.persons : [])
    .filter((person: any) => person?.name && person?.active_flag !== false)
    .map((person: any) => formatPipedriveColleagueName(person.name))
    .filter(Boolean)
    .slice(0, 6);

  let status = 'known';
  let message =
    'Vítejte, ještě vás neznáme\n\nVyplňte formulář níže a my vám obratem pošleme přístupové kódy ke všem učebnicím. Zdarma, bez závazků.';
  if (wonSubs.length > 0) {
    status = 'active_subscription';
    message = 'Vaše škola má aktivní přístup k Vividbooks.';
  } else if (openTrials.length > 0) {
    /* Otevřený trial — frontend rozliší od aktivního placeného přístupu (active_subscription). */
    status = 'active_trial';
    message = '\u0160kola pr\u00e1v\u011b testuje Vividbooks v r\u00e1mci zku\u0161ebn\u00edho p\u0159\u00edstupu.';
  } else if (openSubs.length > 0) {
    status = 'in_progress';
    message =
      'S touto školou právě řešíme další krok z naší strany. Brzy se ozve konkrétní kontakt z týmu Vividbooks.';
  } else if (deals.length > 0) {
    status = 'past_request';
    const trialDeals = deals.filter((d) => isPipedriveTrialDeal(d, labelMap));
    if (trialDeals.length > 0) {
      const endMs = getLatestTrialAccessEndedMs(deals, labelMap);
      message = endMs
        ? `Vaše přístupy vypršely ${formatCsDateLongFromMs(endMs)}. Vyplňte formulář níže a zaregistrujte se pro nové přístupy.`
        : 'Vaše zkušební přístupy už vypršely. Vyplňte formulář níže a zaregistrujte se pro nové přístupy.';
    } else {
      message =
        'S touto školou už jsme byli v kontaktu. Pokud potřebujete pomoct s přístupem k učebnicím, vyplňte prosím formulář níže.';
    }
  }

  const trialInfo = getLatestPipedriveTrialDealInfo(deals, labelMap);
  const nowMs = Date.now();
  const trialCooldownActive = Boolean(
    trialInfo && nowMs - trialInfo.lastMs < PIPEDRIVE_TRIAL_REPEAT_COOLDOWN_MS,
  );
  const trialNextEligibleAt = trialInfo
    ? new Date(trialInfo.lastMs + PIPEDRIVE_TRIAL_REPEAT_COOLDOWN_MS).toISOString()
    : null;

  return {
    status,
    message,
    orgId: params.orgId,
    orgName: params.orgName,
    owner: params.owner,
    colleagues,
    products: params.products.slice(0, 8),
    openDeals: openSubs.length,
    wonDeals: wonSubs.length,
    totalDeals: deals.length,
    matchedBy: params.matchedBy,
    org: params.org || null,
    deals,
    ownerUserId: params.ownerUserId,
    lastTrialDealAt: trialInfo?.lastIso ?? null,
    trialCooldownActive,
    trialNextEligibleAt,
  };
}

function escapePipedriveHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function pipedriveRequest<T = any>(
  apiToken: string,
  path: string,
  options: RequestInit = {},
  query: Record<string, string | number | boolean | null | undefined> = {},
): Promise<T> {
  const url = new URL(`${PIPEDRIVE_BASE_URL}${path}`);
  url.searchParams.set('api_token', apiToken);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(url.toString(), { ...options, headers });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok || json?.success === false) {
    throw new Error(`Pipedrive ${res.status} ${path}: ${String(json?.error || text || 'Unknown error').slice(0, 300)}`);
  }
  return json as T;
}

async function pipedriveV2Request<T = any>(
  apiToken: string,
  path: string,
  query: Record<string, string | number | boolean | null | undefined> = {},
): Promise<T> {
  const url = new URL(`${PIPEDRIVE_V2_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  url.searchParams.set('api_token', apiToken);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url.toString());
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok || json?.success === false) {
    throw new Error(
      `Pipedrive v2 ${res.status} ${path}: ${String(json?.error || json?.message || text || 'Unknown error').slice(0, 300)}`,
    );
  }
  return json as T;
}

function pickFirstNonEmptyTrimmedString(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return '';
}

/** Jednoduchá cesta v KV produktu, např. `shoptetId` nebo `metadata.pipedrive_product_code`. */
function getCatalogStringByKeyPath(obj: Record<string, unknown> | null | undefined, keyPath: string): string {
  const parts = keyPath
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[p];
  }
  return String(cur ?? '').trim();
}

/**
 * Kód produktu pro párování na Pipedrive pole `code`.
 * Volitelně `PIPEDRIVE_PRODUCT_CODE_FIELD` = klíč v KV (nebo tečková cesta).
 */
function getPipedriveProductCodeFromCatalog(catalogItem: Record<string, unknown> | null | undefined): string {
  if (!catalogItem) return '';
  const envField = (Deno.env.get('PIPEDRIVE_PRODUCT_CODE_FIELD') || '').trim();
  if (envField) {
    const fromEnv = getCatalogStringByKeyPath(catalogItem, envField);
    if (fromEnv) return fromEnv;
  }
  const md = (catalogItem.metadata && typeof catalogItem.metadata === 'object'
    ? (catalogItem.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return pickFirstNonEmptyTrimmedString(
    catalogItem.pipedriveProductCode,
    md.pipedrive_product_code,
    md.pipedriveProductCode,
    catalogItem.code,
    catalogItem.productCode,
    md.code,
    catalogItem.shoptetId,
    catalogItem.isbn,
    catalogItem.shopifyVariantId,
  );
}

function normalizePipedriveProductCodeForMatch(code: string): string {
  return String(code ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Vyhledá numerické product_id v Pipedrive podle přesné shody kódu (API v2 products/search).
 * Výsledky cachujeme v rámci jedné synchronizace dealu (včetně negativních).
 */
async function resolvePipedriveProductIdByCode(
  apiToken: string,
  code: string,
  cache: Map<string, number | null>,
): Promise<number | null> {
  const term = String(code ?? '').trim();
  if (!term) return null;
  const cacheKey = normalizePipedriveProductCodeForMatch(term);
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  try {
    const json = await pipedriveV2Request<any>(apiToken, '/products/search', {
      term,
      fields: 'code',
      exact_match: true,
      limit: 50,
    });
    const raw = json?.data;
    const rows: any[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : [];
    const want = normalizePipedriveProductCodeForMatch(term);

    const exactHits: number[] = [];
    for (const row of rows) {
      const item = row?.item && typeof row.item === 'object' ? row.item : row;
      const itemCode = item?.code != null ? String(item.code).trim() : '';
      const id = parsePipedriveNumericId(item?.id);
      if (id && itemCode && normalizePipedriveProductCodeForMatch(itemCode) === want) {
        exactHits.push(id);
      }
    }
    if (exactHits.length === 1) {
      cache.set(cacheKey, exactHits[0]);
      return exactHits[0];
    }
    if (exactHits.length > 1) {
      console.log(
        `[Pipedrive eshop] product code ambiguous: code=${term} ids=${exactHits.slice(0, 5).join(',')}${exactHits.length > 5 ? '…' : ''}`,
      );
      cache.set(cacheKey, null);
      return null;
    }
  } catch (e: any) {
    console.log(`[Pipedrive eshop] product code lookup failed code=${term}: ${e.message}`);
  }
  cache.set(cacheKey, null);
  return null;
}

async function getPipedriveOrganizationIcoFieldKey(apiToken: string) {
  if (pipedriveOrgIcoFieldKeyCache !== undefined) return pipedriveOrgIcoFieldKeyCache;
  try {
    const data = await pipedriveRequest<any>(apiToken, '/organizationFields', {}, { limit: 500 });
    const fields: any[] = data?.data || [];
    const field = fields.find((item: any) => {
      const label = normalizePipedriveSearchText(item?.name || item?.key || '');
      return label.includes('ico');
    });
    pipedriveOrgIcoFieldKeyCache = field?.key || null;
  } catch (error: any) {
    console.log(`[Pipedrive] Organization field lookup failed: ${error.message}`);
    pipedriveOrgIcoFieldKeyCache = null;
  }
  return pipedriveOrgIcoFieldKeyCache;
}

async function loadPipedriveOrganizationFieldsMetaById(apiToken: string): Promise<Map<number, { key: string; fieldType: string }>> {
  if (pipedriveOrgFieldsMetaByIdCache) return pipedriveOrgFieldsMetaByIdCache;
  const map = new Map<number, { key: string; fieldType: string }>();
  try {
    const data = await pipedriveRequest<any>(apiToken, '/organizationFields', {}, { limit: 500 });
    const fields: any[] = data?.data || [];
    for (const f of fields) {
      const id = parsePipedriveNumericId(f?.id);
      const key = String(f?.key || '').trim();
      if (!id || !key) continue;
      const rawFt = f?.field_type ?? f?.type;
      const fieldType = typeof rawFt === 'string' || typeof rawFt === 'number' ? String(rawFt) : '';
      map.set(id, { key, fieldType });
    }
  } catch (e: any) {
    console.log(`[Pipedrive] organizationFields meta: ${e.message}`);
  }
  pipedriveOrgFieldsMetaByIdCache = map;
  return map;
}

function orgRecordHasCustomerLabel(
  org: Record<string, unknown> | null | undefined,
  metaById: Map<number, { key: string; fieldType: string }>,
  labelEnumFieldId: number,
  labelSetFieldId: number,
  customerOptionId: number,
): boolean {
  if (!org) return false;
  const enumMeta = metaById.get(labelEnumFieldId);
  if (enumMeta?.key) {
    const v = (org as any)[enumMeta.key];
    const n = parsePipedriveNumericId(v);
    if (n === customerOptionId) return true;
  }
  const setMeta = metaById.get(labelSetFieldId);
  if (setMeta?.key) {
    const v = (org as any)[setMeta.key];
    const arr = Array.isArray(v) ? v : (v != null && v !== '' ? [v] : []);
    for (const item of arr) {
      const n = parsePipedriveNumericId(typeof item === 'object' && item && 'id' in item ? (item as any).id : item);
      if (n === customerOptionId) return true;
    }
  }
  return false;
}

async function organizationHasCustomerLabel(apiToken: string, orgId: number): Promise<boolean> {
  const labelEnumFieldId = pipedriveEnvInt('PIPEDRIVE_ORG_LABEL_FIELD_ID', 4003);
  const labelSetFieldId = pipedriveEnvInt('PIPEDRIVE_ORG_LABEL_IDS_FIELD_ID', 4101);
  const customerOptionId = pipedriveEnvInt('PIPEDRIVE_ORG_CUSTOMER_LABEL_OPTION_ID', 5);
  const metaById = await loadPipedriveOrganizationFieldsMetaById(apiToken);
  try {
    const data = await pipedriveRequest<any>(apiToken, `/organizations/${orgId}`);
    const org = data?.data;
    return orgRecordHasCustomerLabel(org, metaById, labelEnumFieldId, labelSetFieldId, customerOptionId);
  } catch (e: any) {
    console.log(`[Pipedrive] organizationHasCustomerLabel: ${e.message}`);
    return false;
  }
}

async function loadPipedriveDealFieldMetaById(apiToken: string, fieldId: number): Promise<{ key: string; fieldType: string } | null> {
  if (pipedriveDealFieldMetaByIdCache?.has(fieldId)) {
    return pipedriveDealFieldMetaByIdCache.get(fieldId) || null;
  }
  if (!pipedriveDealFieldMetaByIdCache) pipedriveDealFieldMetaByIdCache = new Map();
  try {
    const data = await pipedriveRequest<any>(apiToken, '/dealFields', {}, { limit: 500 });
    const fields: any[] = Array.isArray(data?.data) ? data.data : [];
    for (const f of fields) {
      const id = parsePipedriveNumericId(f?.id);
      const key = String(f?.key || '').trim();
      if (!id || !key) continue;
      const rawFt = f?.field_type ?? f?.type;
      const fieldType = typeof rawFt === 'string' || typeof rawFt === 'number' ? String(rawFt) : '';
      pipedriveDealFieldMetaByIdCache.set(id, { key, fieldType });
    }
  } catch (e: any) {
    console.log(`[Pipedrive] dealFields meta: ${e.message}`);
  }
  return pipedriveDealFieldMetaByIdCache.get(fieldId) || null;
}

async function resolveSchoolOrderDealFieldPayloadValue(
  apiToken: string,
  dealFieldId: number,
  optionIds: number[],
): Promise<Record<string, unknown> | null> {
  if (!optionIds.length) return null;
  const meta = await loadPipedriveDealFieldMetaById(apiToken, dealFieldId);
  if (!meta?.key) {
    console.log(`[Pipedrive school order] deal field id=${dealFieldId} not found in dealFields`);
    return null;
  }
  const key = meta.key;
  const ft = meta.fieldType.toLowerCase();
  if (ft === 'set') {
    return { [key]: optionIds };
  }
  if (ft === 'enum') {
    return { [key]: optionIds[0] };
  }
  const fallback = optionIds.length === 1 ? optionIds[0] : optionIds.map(String).join(',');
  return { [key]: fallback };
}

async function searchPipedrivePersonByEmailGlobal(apiToken: string, email: string): Promise<any | null> {
  const term = String(email || '').trim().toLowerCase();
  if (!term || !term.includes('@')) return null;
  try {
    const data = await pipedriveRequest<any>(apiToken, '/persons/search', {}, { term, fields: 'email', limit: 10 });
    const items: any[] = Array.isArray(data?.data?.items) ? data.data.items : [];
    for (const entry of items) {
      const person = entry?.item;
      if (!person?.id) continue;
      const emails = readPipedrivePersonEmails(person);
      if (emails.includes(term)) return person;
    }
  } catch (e: any) {
    console.log(`[Pipedrive] persons/search: ${e.message}`);
  }
  return null;
}

async function searchPipedriveOrganizations(
  apiToken: string,
  term: string,
  opts?: { fields?: string },
) {
  const cleanTerm = String(term || '').trim();
  if (!cleanTerm) return [];
  const query: Record<string, string | number> = { term: cleanTerm, limit: 10 };
  if (opts?.fields) query.fields = opts.fields;
  const data = await pipedriveRequest<any>(apiToken, '/organizations/search', {}, query);
  return Array.isArray(data?.data?.items) ? data.data.items : [];
}

async function getPipedriveUserSummary(apiToken: string, userRef: any): Promise<PipedriveOwnerSummary | null> {
  if (!userRef) return null;
  const fallbackName = String(userRef?.name || '');
  const fallbackEmail = String(userRef?.email || '');
  const fallbackId = parsePipedriveNumericId(userRef?.id);
  try {
    if (!fallbackId) {
      return fallbackName
        ? {
            id: null,
            name: fallbackName,
            firstName: fallbackName.split(' ')[0] || fallbackName,
            email: fallbackEmail,
            phone: '',
            photoUrl: '',
          }
        : null;
    }
    const data = await pipedriveRequest<any>(apiToken, `/users/${fallbackId}`);
    const user = data?.data || {};
    const ownerName = String(user?.name || fallbackName || '');
    const phoneArr: any[] = Array.isArray(user?.phone) ? user.phone : [];
    const primaryPhone = phoneArr.find((p: any) => p.primary) || phoneArr[0];
    const picHash = String(user?.pic_hash || '');
    return {
      id: fallbackId,
      name: ownerName,
      firstName: ownerName.split(' ')[0] || ownerName,
      email: String(user?.email || fallbackEmail || ''),
      phone: primaryPhone?.value ? String(primaryPhone.value).replace(/\s/g, '') : '',
      photoUrl: picHash ? `https://secure.gravatar.com/avatar/${picHash}?s=200&d=mp` : '',
    };
  } catch (error: any) {
    console.log(`[Pipedrive] Owner fetch error: ${error.message}`);
    return fallbackName
      ? {
          id: fallbackId,
          name: fallbackName,
          firstName: fallbackName.split(' ')[0] || fallbackName,
          email: fallbackEmail,
          phone: '',
          photoUrl: '',
        }
      : null;
  }
}

async function getPipedriveOrganizationDeals(apiToken: string, orgId: number) {
  const data = await pipedriveRequest<any>(apiToken, `/organizations/${orgId}/deals`, {}, { limit: 100, status: 'all_not_deleted' });
  return Array.isArray(data?.data) ? data.data : [];
}

async function getPipedriveOrganizationPersons(apiToken: string, orgId: number) {
  const data = await pipedriveRequest<any>(apiToken, `/organizations/${orgId}/persons`, {}, { limit: 100, status: 'all_not_deleted' });
  return Array.isArray(data?.data) ? data.data : [];
}

async function getPipedriveDealProducts(apiToken: string, dealId: number) {
  const data = await pipedriveRequest<any>(apiToken, `/deals/${dealId}/products`, {}, { limit: 20 });
  return Array.isArray(data?.data) ? data.data : [];
}

function pickBestPipedriveOrganizationMatch(items: any[], expectedName: string) {
  if (!items.length) return null;
  const expected = normalizePipedriveSearchText(expectedName);
  if (!expected) return items[0];
  const exact = items.find((entry: any) => normalizePipedriveSearchText(entry?.item?.name || '') === expected);
  if (exact) return exact;
  const includes = items.find((entry: any) => normalizePipedriveSearchText(entry?.item?.name || '').includes(expected));
  return includes || items[0];
}

async function lookupSchoolInPipedrive(
  apiToken: string,
  params: { ico?: string; name?: string; includePipedriveRaw?: boolean },
): Promise<PipedriveSchoolLookup> {
  const cacheKey = buildPipedriveLookupCacheKey(params);
  const cached = pipedriveSchoolLookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const includePipedriveRaw = !!params.includePipedriveRaw;
  const ico = String(params.ico || '').trim();
  const name = String(params.name || '').trim();
  let items: any[] = [];
  let matchedBy: 'ico' | 'name' | null = null;

  if (ico) {
    items = await searchPipedriveOrganizations(apiToken, ico, { fields: 'custom_fields' });
    if (items.length > 0) matchedBy = 'ico';
  }
  if (!items.length && name) {
    items = await searchPipedriveOrganizations(apiToken, name);
    if (items.length > 0) matchedBy = 'name';
  }

  const bestMatch = matchedBy === 'name' ? pickBestPipedriveOrganizationMatch(items, name) : items[0];
  const org = bestMatch?.item || null;
  const orgId = parsePipedriveNumericId(org?.id);
  const orgName = org?.name ? String(org.name) : null;

  if (!orgId) {
    const result = {
      status: 'new',
      message:
        'Vítejte, ještě vás neznáme\n\nVyplňte formulář níže a my vám obratem pošleme přístupové kódy ke všem učebnicím. Zdarma, bez závazků.',
      orgId: null,
      orgName: name || null,
      owner: null,
      colleagues: [],
      products: [],
      openDeals: 0,
      wonDeals: 0,
      totalDeals: 0,
      matchedBy,
      org: null,
      deals: [],
      ownerUserId: null,
      lastTrialDealAt: null,
      trialCooldownActive: false,
      trialNextEligibleAt: null,
    };
    if (includePipedriveRaw) {
      (result as PipedriveSchoolLookup).pipedriveApi = {
        deals: [],
        organizationSearchItem: org,
        dealLabelIdToName: {},
      };
    }
    pipedriveSchoolLookupCache.set(cacheKey, { expiresAt: Date.now() + PIPEDRIVE_LOOKUP_CACHE_TTL_MS, value: result });
    return result;
  }

  const dealLabelIdToName = await getPipedriveDealLabelIdToName(apiToken);
  const deals = await getPipedriveOrganizationDeals(apiToken, orgId);
  const subscriptionDeals = deals.filter((deal: any) => !isPipedriveTrialDeal(deal, dealLabelIdToName));
  const wonSubs = subscriptionDeals.filter((deal: any) => deal?.status === 'won');
  const openSubs = subscriptionDeals.filter((deal: any) => deal?.status === 'open');
  /* Stejná priorita jako summarizePipedriveSchoolState: vyhrané předplatné → otevřený trial → otevřený „ne-trial“ deal.
   * Dřív se bral openSubs před openTrials → špatný owner (např. Eduard místo vlastníka trial dealu Gabriela). */
  const openTrialsForOwner = deals.filter(
    (deal: any) => isPipedriveTrialDeal(deal, dealLabelIdToName) && String(deal?.status || '').toLowerCase() === 'open',
  );
  const ownerDeal =
    wonSubs[0] ||
    (openTrialsForOwner.length > 0 ? pickMostRecentPipedriveDeal(openTrialsForOwner) : null) ||
    openSubs[0] ||
    pickMostRecentPipedriveDeal(deals);
  const ownerUserId = parsePipedriveNumericId(ownerDeal?.user_id?.id || ownerDeal?.user_id?.value || ownerDeal?.owner_id?.id || ownerDeal?.owner_id);
  const owner = ownerDeal?.user_id ? await getPipedriveUserSummary(apiToken, ownerDeal.user_id) : null;

  const persons = await getPipedriveOrganizationPersons(apiToken, orgId).catch((error: any) => {
    console.log(`[Pipedrive] Persons fetch error: ${error.message}`);
    return [];
  });
  const colleagues = persons
    .filter((person: any) => person?.name && person?.active_flag !== false)
    .map((person: any) => formatPipedriveColleagueName(person.name))
    .filter(Boolean)
    .slice(0, 6);

  const productNames = new Set<string>();
  for (const deal of wonSubs.slice(0, 3)) {
    try {
      const products = await getPipedriveDealProducts(apiToken, parsePipedriveNumericId(deal?.id) || 0);
      for (const product of products) {
        if (product?.name) productNames.add(String(product.name));
      }
    } catch (error: any) {
      console.log(`[Pipedrive] Product fetch error for deal ${deal?.id}: ${error.message}`);
    }
  }

  const result = summarizePipedriveSchoolState({
    orgId,
    orgName,
    matchedBy,
    deals,
    persons,
    owner,
    ownerUserId,
    products: Array.from(productNames),
    org,
    dealLabelIdToName,
  });
  if (includePipedriveRaw) {
    result.pipedriveApi = {
      deals,
      organizationSearchItem: org,
      dealLabelIdToName,
    };
  }
  pipedriveSchoolLookupCache.set(cacheKey, { expiresAt: Date.now() + PIPEDRIVE_LOOKUP_CACHE_TTL_MS, value: result });
  return result;
}

async function upsertPipedriveSchoolOrganization(
  apiToken: string,
  params: { schoolName: string; ico?: string; address?: string },
) {
  const ico = String(params.ico || '').trim();
  const schoolName = String(params.schoolName || '').trim();
  const address = String(params.address || '').trim();
  const lookup = await lookupSchoolInPipedrive(apiToken, { ico, name: schoolName });
  if (lookup.orgId) {
    const icoFieldKey = ico ? await getPipedriveOrganizationIcoFieldKey(apiToken) : null;
    const updatePayload: Record<string, any> = {};
    if (address) updatePayload.address = address;
    if (icoFieldKey && lookup.matchedBy !== 'ico') updatePayload[icoFieldKey] = ico;
    if (Object.keys(updatePayload).length > 0) {
      try {
        await pipedriveRequest(apiToken, `/organizations/${lookup.orgId}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        });
      } catch (error: any) {
        console.log(`[Pipedrive] Org update skipped for ${lookup.orgId}: ${error.message}`);
      }
    }
    return lookup;
  }

  const icoFieldKey = ico ? await getPipedriveOrganizationIcoFieldKey(apiToken) : null;
  const payload: Record<string, any> = { name: schoolName };
  if (address) payload.address = address;
  if (icoFieldKey && ico) payload[icoFieldKey] = ico;
  await pipedriveRequest<any>(apiToken, '/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return lookupSchoolInPipedrive(apiToken, { ico, name: schoolName });
}

function readPipedrivePersonEmails(person: any) {
  const raw = Array.isArray(person?.email) ? person.email : [];
  return raw.map((entry: any) => String(entry?.value || entry || '').trim().toLowerCase()).filter(Boolean);
}

async function findOrCreatePipedrivePerson(
  apiToken: string,
  params: { orgId: number; name: string; email?: string; phone?: string },
) {
  const orgId = params.orgId;
  const name = String(params.name || '').trim();
  const email = String(params.email || '').trim().toLowerCase();
  const phone = String(params.phone || '').trim();

  if (email) {
    const globalHit = await searchPipedrivePersonByEmailGlobal(apiToken, email);
    if (globalHit?.id) {
      const existingOrgId = parsePipedriveNumericId(globalHit.org_id?.id ?? globalHit.org_id?.value ?? globalHit.org_id);
      const patch: Record<string, any> = {};
      if (existingOrgId !== orgId) patch.org_id = orgId;
      if (name && String(globalHit.name || '').trim() !== name) patch.name = name;
      if (phone) patch.phone = phone;
      if (Object.keys(patch).length > 0) {
        try {
          await pipedriveRequest(apiToken, `/persons/${parsePipedriveNumericId(globalHit.id)}`, {
            method: 'PUT',
            body: JSON.stringify(patch),
          });
          const refreshed = await pipedriveRequest<any>(apiToken, `/persons/${parsePipedriveNumericId(globalHit.id)}`);
          return refreshed?.data || globalHit;
        } catch (e: any) {
          console.log(`[Pipedrive] Person PUT (link org): ${e.message}`);
        }
      }
      return globalHit;
    }
  }

  const persons = await getPipedriveOrganizationPersons(apiToken, orgId).catch(() => []);

  const existing =
    persons.find((person: any) => email && readPipedrivePersonEmails(person).includes(email)) ||
    persons.find((person: any) => normalizePipedriveSearchText(person?.name || '') === normalizePipedriveSearchText(name));

  if (existing?.id) return existing;

  const payload: Record<string, any> = { name, org_id: orgId };
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  const created = await pipedriveRequest<any>(apiToken, '/persons', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return created?.data || null;
}

async function createPipedriveDeal(
  apiToken: string,
  params: { title: string; orgId: number; personId?: number | null; ownerId?: number | null; value?: number | null; currency?: string },
) {
  const payload: Record<string, any> = { title: params.title, org_id: params.orgId };
  if (params.personId) payload.person_id = params.personId;
  if (params.ownerId) payload.user_id = params.ownerId;
  if (params.value != null && Number.isFinite(params.value)) payload.value = params.value;
  if (params.currency) payload.currency = params.currency;

  const stageId = parsePipedriveNumericId(Deno.env.get('PIPEDRIVE_DEFAULT_STAGE_ID'));
  if (stageId) payload.stage_id = stageId;

  const data = await pipedriveRequest<any>(apiToken, '/deals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data?.data || null;
}

async function createPipedriveNote(
  apiToken: string,
  params: { content: string; dealId?: number | null; orgId?: number | null; personId?: number | null },
) {
  const payload: Record<string, any> = { content: params.content };
  if (params.dealId) payload.deal_id = params.dealId;
  if (params.orgId) payload.org_id = params.orgId;
  if (params.personId) payload.person_id = params.personId;
  const data = await pipedriveRequest<any>(apiToken, '/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data?.data || null;
}

async function createPipedriveActivity(
  apiToken: string,
  params: {
    subject: string;
    userId: number;
    dueDate: string;
    note?: string;
    dealId?: number | null;
    orgId?: number | null;
    personId?: number | null;
    type?: string;
  },
) {
  const payload: Record<string, any> = {
    subject: params.subject,
    user_id: params.userId,
    due_date: params.dueDate,
    type: params.type || 'task',
  };
  if (params.note) payload.note = params.note;
  if (params.dealId) payload.deal_id = params.dealId;
  if (params.orgId) payload.org_id = params.orgId;
  if (params.personId) payload.person_id = params.personId;
  const data = await pipedriveRequest<any>(apiToken, '/activities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data?.data || null;
}

type PipedriveFieldMap = Record<string, { name: string; options: Record<string, string> }>;

function getServiceSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getPipedriveOrganization(apiToken: string, orgId: number) {
  const data = await pipedriveRequest<any>(apiToken, `/organizations/${orgId}`);
  return data?.data || null;
}

async function getPipedriveOrganizationActivities(apiToken: string, orgId: number) {
  const data = await pipedriveRequest<any>(apiToken, `/organizations/${orgId}/activities`, {}, { limit: 50 });
  return Array.isArray(data?.data) ? data.data : [];
}

async function getPipedriveFieldMap(apiToken: string, path: '/dealFields' | '/personFields' | '/organizationFields') {
  const data = await pipedriveRequest<any>(apiToken, path, {}, { limit: 500 });
  const fields: any[] = Array.isArray(data?.data) ? data.data : [];
  const result: PipedriveFieldMap = {};

  for (const field of fields) {
    if (!field?.key || !field?.name) continue;
    const options: Record<string, string> = {};
    if (Array.isArray(field.options)) {
      for (const option of field.options) {
        if (option?.id !== undefined && option?.label) options[String(option.id)] = String(option.label);
      }
    }
    result[String(field.key)] = { name: String(field.name), options };
  }

  return result;
}

function resolvePipedriveFieldValue(fieldMap: PipedriveFieldMap, fieldKey: string, value: any): unknown {
  const field = fieldMap[fieldKey];
  if (!field) return value;
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((part) => part.trim()).filter(Boolean).map((part) => field.options[part] || part);
  }
  const normalized = String(value);
  return field.options[normalized] || value;
}

function mapPipedriveCustomFields(record: Record<string, unknown>, fieldMap: PipedriveFieldMap) {
  const customFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!/^[a-f0-9]{40}$/.test(key) || value == null || value === '') continue;
    const field = fieldMap[key];
    const fieldName = field?.name || key;
    customFields[fieldName] = resolvePipedriveFieldValue(fieldMap, key, value);
  }
  return customFields;
}

function pickCustomFieldValue(customFields: Record<string, unknown>, nameHints: string[]) {
  const normalizedHints = nameHints.map((hint) => removeDiacritics(hint));
  for (const [key, value] of Object.entries(customFields)) {
    const normalizedKey = removeDiacritics(key);
    if (normalizedHints.some((hint) => normalizedKey.includes(hint))) return value;
  }
  return undefined;
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (value == null || value === '') return [];
  return [String(value)];
}

function findSchoolRecordForAdmin(schools: SchoolRecord[], ico: string, name: string) {
  const icoDigits = String(ico || '').replace(/\D/g, '');
  if (icoDigits) {
    const byIco = schools.find((school) => school.ico.replace(/\D/g, '') === icoDigits);
    if (byIco) return byIco;
  }
  const normalizedName = removeDiacritics(String(name || '').trim());
  if (!normalizedName) return null;
  return schools.find((school) => school._n === normalizedName)
    || schools.find((school) => school._n.includes(normalizedName))
    || null;
}

function isUsableSchoolRecordForAdmin(school: SchoolRecord) {
  const name = String(school?.name || '').trim();
  const ico = String(school?.ico || '').replace(/\D/g, '');
  return Boolean(name) && !name.startsWith(';') && ico.length >= 6;
}

function buildSchoolOrderSummaryFromRows(orders: any[]) {
  const productMap = new Map<string, { name: string; quantity: number; orderIds: Set<string> }>();
  const digitalLicenses = new Set<string>();

  for (const order of orders) {
    const items: any[] = Array.isArray((order as any).order_items) ? (order as any).order_items : [];
    for (const item of items) {
      const name = String(item?.product_name || '').trim();
      if (!name) continue;
      const quantity = Number(item?.quantity) || 0;
      const existing = productMap.get(name) || { name, quantity: 0, orderIds: new Set<string>() };
      existing.quantity += quantity;
      if (order?.id) existing.orderIds.add(String(order.id));
      productMap.set(name, existing);
      if (/licenc|license|online|digital/i.test(name)) digitalLicenses.add(name);
    }
  }

  return {
    orderCount: orders.length,
    totalRevenue: orders.reduce((sum, order: any) => sum + (Number(order?.total) || 0), 0),
    purchasedProducts: Array.from(productMap.values())
      .map((item) => ({ name: item.name, quantity: item.quantity, orderCount: item.orderIds.size }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
    digitalLicenses: Array.from(digitalLicenses).slice(0, 8),
    recentOrders: orders.map((order: any) => ({
      id: String(order?.id || ''),
      orderNumber: String(order?.order_number || ''),
      createdAt: String(order?.created_at || ''),
      status: String(order?.status || ''),
      paymentStatus: order?.payment_status != null && order?.payment_status !== ''
        ? String(order.payment_status)
        : null,
      total: Number(order?.total) || 0,
      items: (Array.isArray(order?.order_items) ? order.order_items : []).map((item: any) => ({
        productName: String(item?.product_name || ''),
        quantity: Number(item?.quantity) || 0,
        totalPrice: Number(item?.total_price) || 0,
      })),
    })),
  };
}

async function fetchSchoolOrderSummary(params: { schoolName?: string; ico?: string }) {
  const supabase = getServiceSupabaseClient();
  const empty = {
    orderCount: 0,
    totalRevenue: 0,
    purchasedProducts: [] as Array<{ name: string; quantity: number; orderCount: number }>,
    digitalLicenses: [] as string[],
    recentOrders: [] as Array<{
      id: string;
      orderNumber: string;
      createdAt: string;
      status: string;
      paymentStatus: string | null;
      total: number;
      items: Array<{ productName: string; quantity: number; totalPrice: number }>;
    }>,
    allOrders: [] as Array<{
      id: string;
      orderNumber: string;
      createdAt: string;
      status: string;
      paymentStatus: string | null;
      total: number;
      items: Array<{ productName: string; quantity: number; totalPrice: number }>;
    }>,
  };

  if (!supabase) {
    return empty;
  }

  const ico = String(params.ico || '').trim();
  const schoolName = String(params.schoolName || '').trim();
  const selectCols =
    'id, order_number, created_at, status, payment_status, total, school_name, ico, order_items(product_name, quantity, total_price)';

  if (!ico && !schoolName) {
    return empty;
  }

  /** Stránkování — bez horního limitu 500 řádků (dřívý main); max ~12k řádků na dotaz. */
  const PAGE = 150;
  const MAX_PAGES = 80;
  const orders: any[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const to = from + PAGE - 1;
    let q = supabase
      .from('orders')
      .select(selectCols)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (ico) {
      q = q.eq('ico', ico);
    } else {
      q = q.ilike('school_name', `%${schoolName}%`);
    }
    const { data, error } = await q;
    if (error) {
      console.log(`[Schools] Order summary fetch error: ${error.message}`);
      return empty;
    }
    const batch = Array.isArray(data) ? data : [];
    orders.push(...batch);
    if (batch.length < PAGE) break;
  }

  const base = buildSchoolOrderSummaryFromRows(orders);
  return {
    ...base,
    orderCount: orders.length,
    recentOrders: base.recentOrders.slice(0, 20),
    allOrders: base.recentOrders,
  };
}

async function buildAdminSchoolDetail(apiToken: string, params: { orgId?: number | null; ico?: string; name?: string }) {
  const explicitOrgId = parsePipedriveNumericId(params.orgId);
  let lookup: PipedriveSchoolLookup | null = null;
  let orgId = explicitOrgId;
  if (!orgId) {
    lookup = await lookupSchoolInPipedrive(apiToken, { ico: params.ico, name: params.name });
    orgId = lookup.orgId;
  }

  const schools = await loadSchoolsCache();
  const fallbackSchool = findSchoolRecordForAdmin(schools, String(params.ico || ''), String(params.name || lookup?.orgName || ''));

  if (!orgId) {
    const orderSummary = await fetchSchoolOrderSummary({
      ico: String(params.ico || fallbackSchool?.ico || ''),
      schoolName: String(params.name || fallbackSchool?.name || ''),
    });
    return {
      school: {
        name: String(params.name || fallbackSchool?.name || ''),
        ico: String(params.ico || fallbackSchool?.ico || ''),
        address: sanitizeSchoolAddressForApi(
          String(fallbackSchool?.address || ''),
          String(params.ico || fallbackSchool?.ico || ''),
        ),
        kraj: String(fallbackSchool?.kraj || ''),
        typ: String(fallbackSchool?.typ || ''),
        redIzo: String(fallbackSchool?.redIzo || ''),
      },
      organization: null,
      owner: null,
      owner_name: null,
      persons: [],
      deals: [],
      activities: [],
      orderSummary,
      productsSummary: orderSummary.purchasedProducts.map((item) => item.name),
      teacherCode: null,
      studentCode: null,
      status: 'new',
    };
  }

  const [organization, personsRaw, dealsRaw, activitiesRaw, personFieldMap, dealFieldMap, organizationFieldMap, icoFieldKey] = await Promise.all([
    getPipedriveOrganization(apiToken, orgId),
    getPipedriveOrganizationPersons(apiToken, orgId).catch(() => []),
    getPipedriveOrganizationDeals(apiToken, orgId).catch(() => []),
    getPipedriveOrganizationActivities(apiToken, orgId).catch(() => []),
    getPipedriveFieldMap(apiToken, '/personFields').catch(() => ({} as PipedriveFieldMap)),
    getPipedriveFieldMap(apiToken, '/dealFields').catch(() => ({} as PipedriveFieldMap)),
    getPipedriveFieldMap(apiToken, '/organizationFields').catch(() => ({} as PipedriveFieldMap)),
    getPipedriveOrganizationIcoFieldKey(apiToken).catch(() => null),
  ]);

  const dealsWithProducts = await Promise.all(
    (Array.isArray(dealsRaw) ? dealsRaw : []).map(async (deal: any) => {
      const customFields = mapPipedriveCustomFields(deal, dealFieldMap);
      const dealId = parsePipedriveNumericId(deal?.id);
      const productsRaw = dealId ? await getPipedriveDealProducts(apiToken, dealId).catch(() => []) : [];
      return {
        ...deal,
        customFields,
        products: (Array.isArray(productsRaw) ? productsRaw : []).map((item: any) => ({
          id: parsePipedriveNumericId(item?.id),
          name: String(item?.name || ''),
          quantity: Number(item?.quantity) || null,
          item_price: Number(item?.item_price) || null,
          sum: Number(item?.sum) || null,
        })),
      };
    }),
  );

  const dealLabelIdToName = dealFieldMap['label']?.options || {};
  const ownerDeal = dealsWithProducts.find((deal: any) => !isPipedriveTrialDeal(deal, dealLabelIdToName) && deal?.status === 'open')
    || dealsWithProducts.find((deal: any) => !isPipedriveTrialDeal(deal, dealLabelIdToName) && deal?.status === 'won')
    || dealsWithProducts[0]
    || null;
  const owner = ownerDeal?.user_id ? await getPipedriveUserSummary(apiToken, ownerDeal.user_id) : lookup?.owner || null;
  const ownerUserId = parsePipedriveNumericId(ownerDeal?.user_id?.id || ownerDeal?.user_id?.value || ownerDeal?.owner_id?.id || ownerDeal?.owner_id);

  const persons = (Array.isArray(personsRaw) ? personsRaw : []).map((person: any) => {
    const customFields = mapPipedriveCustomFields(person, personFieldMap);
    return {
      ...person,
      customFields,
      position: String(pickCustomFieldValue(customFields, ['pozice', 'role']) || person?.position || '').trim() || undefined,
      subjects: toStringArray(pickCustomFieldValue(customFields, ['predmet', 'vyucuje'])).slice(0, 8),
      stupen: String(pickCustomFieldValue(customFields, ['stupen', 'ročník', 'rocnik']) || '').trim() || undefined,
    };
  });

  const organizationCustomFields = organization ? mapPipedriveCustomFields(organization, organizationFieldMap) : {};
  const organizationIco =
    String(params.ico || (icoFieldKey && organization ? (organization as any)[icoFieldKey] : '') || fallbackSchool?.ico || '').trim();
  const schoolName = String(params.name || organization?.name || fallbackSchool?.name || lookup?.orgName || '').trim();
  const pipedriveProductNames = Array.from(
    new Set(
      dealsWithProducts.flatMap((deal: any) =>
        Array.isArray(deal.products) ? deal.products.map((product: any) => String(product?.name || '').trim()).filter(Boolean) : [],
      ),
    ),
  );
  const resolvedLookup = summarizePipedriveSchoolState({
    orgId,
    orgName: String(organization?.name || schoolName || lookup?.orgName || ''),
    matchedBy: lookup?.matchedBy || null,
    deals: dealsWithProducts,
    persons: Array.isArray(personsRaw) ? personsRaw : [],
    owner,
    ownerUserId,
    products: pipedriveProductNames,
    org: organization,
    dealLabelIdToName,
  });
  const orderSummary = await fetchSchoolOrderSummary({ ico: organizationIco, schoolName });
  const productsSummary = Array.from(new Set([
    ...pipedriveProductNames,
    ...orderSummary.purchasedProducts.map((item) => item.name),
  ])).slice(0, 12);

  return {
    school: {
      name: schoolName,
      ico: organizationIco,
      address: sanitizeSchoolAddressForApi(
        String(fallbackSchool?.address || organization?.address || organization?.address_formatted || ''),
        organizationIco,
      ),
      kraj: String(fallbackSchool?.kraj || ''),
      typ: String(fallbackSchool?.typ || ''),
      redIzo: String(fallbackSchool?.redIzo || ''),
    },
    organization: organization
      ? {
          id: parsePipedriveNumericId(organization?.id) || orgId,
          name: String(organization?.name || schoolName),
          address: sanitizeSchoolAddressForApi(
            String(organization?.address || organization?.address_formatted || fallbackSchool?.address || ''),
            organizationIco,
          ),
        }
      : null,
    owner,
    owner_name: owner?.name || null,
    persons,
    deals: dealsWithProducts.sort((a: any, b: any) => String(b?.add_time || b?.won_time || '').localeCompare(String(a?.add_time || a?.won_time || ''))),
    activities: (Array.isArray(activitiesRaw) ? activitiesRaw : [])
      .sort((a: any, b: any) => String(b?.add_time || b?.due_date || '').localeCompare(String(a?.add_time || a?.due_date || ''))),
    orderSummary,
    productsSummary,
    teacherCode: String(pickCustomFieldValue(organizationCustomFields, ['kod ucitel', 'učitel']) || '').trim() || null,
    studentCode: String(pickCustomFieldValue(organizationCustomFields, ['kod zak', 'kod žák', 'student']) || '').trim() || null,
    status: resolvedLookup.status,
  };
}

/** Zvyšte při změně tvaru odpovědi school-pipedrive-check (ověření deploye přes ?includePipedriveRaw=1). */
const SCHOOL_PIPEDRIVE_CHECK_API_REVISION = 2;

/* ── Pipedrive: Check school by IČO / name ─────────────────────── */
app.get('/make-server-93a20b6f/school-pipedrive-check', async (c) => {
  const ico = String(c.req.query('ico') || '').trim();
  const name = String(c.req.query('name') || '').trim();
  if (!ico && !name) {
    return c.json({ status: 'invalid', message: 'Zadejte IČO nebo název školy.' }, 400);
  }
  if (ico && !/^\d{6,10}$/.test(ico)) {
    return c.json({ status: 'invalid', message: 'Neplatné IČO.' }, 400);
  }

  const apiToken = getPipedriveApiToken();
  if (!apiToken) {
    console.log('[Pipedrive] PIPEDRIVE_API_TOKEN not set');
    return c.json({ status: 'unknown', message: 'Pipedrive není nakonfigurován.' });
  }

  try {
    const includePipedriveRaw =
      c.req.query('includePipedriveRaw') === '1' || c.req.query('pipedriveRaw') === '1';
    const result = await lookupSchoolInPipedrive(apiToken, { ico, name, includePipedriveRaw });
    console.log(`[Pipedrive] School lookup ico=${ico || '-'} name="${name || '-'}" orgId=${result.orgId ?? 'null'} status=${result.status}`);
    return c.json({
      status: result.status,
      message: result.message,
      orgId: result.orgId,
      orgName: result.orgName,
      owner: result.owner,
      colleagues: result.colleagues,
      products: result.products,
      openDeals: result.openDeals,
      wonDeals: result.wonDeals,
      totalDeals: result.totalDeals,
      matchedBy: result.matchedBy,
      lastTrialDealAt: result.lastTrialDealAt,
      trialCooldownActive: result.trialCooldownActive,
      trialNextEligibleAt: result.trialNextEligibleAt,
      ...(includePipedriveRaw
        ? {
            pipedriveApi: result.pipedriveApi ?? null,
            _pipedriveCheckDebug: {
              apiRevision: SCHOOL_PIPEDRIVE_CHECK_API_REVISION,
              pipedriveApiDealCount: result.pipedriveApi?.deals?.length ?? null,
            },
          }
        : {}),
    });
  } catch (error: any) {
    console.log(`[Pipedrive] Chyba: ${error.message}`);
    return c.json({ status: 'unknown', message: 'Nepodařilo se ověřit v Pipedrive.' });
  }
});

app.post('/make-server-93a20b6f/admin/pipedrive/ensure-school', async (c) => {
  const apiToken = getPipedriveApiToken();
  if (!apiToken) return c.json({ error: 'Pipedrive není nakonfigurován.' }, 500);

  try {
    const body = (await c.req.json()) as Record<string, any>;
    const schoolName = String(body.schoolName || '').trim();
    const ico = String(body.ico || '').trim();
    const address = String(body.address || '').trim();
    if (!schoolName && !ico) return c.json({ error: 'Zadejte schoolName nebo ico.' }, 400);

    const result = await upsertPipedriveSchoolOrganization(apiToken, { schoolName, ico, address });
    return c.json({
      success: true,
      orgId: result.orgId,
      orgName: result.orgName,
      status: result.status,
      matchedBy: result.matchedBy,
      owner: result.owner,
      openDeals: result.openDeals,
      wonDeals: result.wonDeals,
      totalDeals: result.totalDeals,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/pipedrive/deals', async (c) => {
  const apiToken = getPipedriveApiToken();
  if (!apiToken) return c.json({ error: 'Pipedrive není nakonfigurován.' }, 500);

  try {
    const body = (await c.req.json()) as Record<string, any>;
    let orgId = parsePipedriveNumericId(body.orgId);
    let orgLookup: PipedriveSchoolLookup | null = null;

    if (!orgId) {
      const schoolName = String(body.schoolName || '').trim();
      const ico = String(body.ico || '').trim();
      const address = String(body.address || '').trim();
      if (!schoolName && !ico) return c.json({ error: 'Zadejte orgId nebo schoolName/ico.' }, 400);
      orgLookup = await upsertPipedriveSchoolOrganization(apiToken, { schoolName, ico, address });
      orgId = orgLookup.orgId;
    }
    if (!orgId) return c.json({ error: 'Nepodařilo se dohledat organizaci.' }, 400);

    const contactName = String(body.contactName || '').trim();
    const person = contactName
      ? await findOrCreatePipedrivePerson(apiToken, {
          orgId,
          name: contactName,
          email: String(body.email || '').trim(),
          phone: String(body.phone || '').trim(),
        }).catch(() => null)
      : null;

    const ownerId = parsePipedriveNumericId(body.ownerId) || orgLookup?.ownerUserId || null;

    const deal = await createPipedriveDeal(apiToken, {
      title: String(body.title || '').trim() || `Deal ${new Date().toISOString().slice(0, 10)}`,
      orgId,
      personId: parsePipedriveNumericId(person?.id),
      ownerId: ownerId ?? undefined,
      value: parsePriceNumber(body.value ?? body.totalPrice),
      currency: String(body.currency || 'CZK'),
    });

    return c.json({ success: true, deal });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/pipedrive/notes', async (c) => {
  const apiToken = getPipedriveApiToken();
  if (!apiToken) return c.json({ error: 'Pipedrive není nakonfigurován.' }, 500);

  try {
    const body = (await c.req.json()) as Record<string, any>;
    const content = String(body.content || '').trim();
    const dealId = parsePipedriveNumericId(body.dealId);
    const orgId = parsePipedriveNumericId(body.orgId);
    const personId = parsePipedriveNumericId(body.personId);
    if (!content) return c.json({ error: 'Chybí content.' }, 400);
    if (!dealId && !orgId && !personId) return c.json({ error: 'Doplňte dealId, orgId nebo personId.' }, 400);

    const note = await createPipedriveNote(apiToken, { content, dealId, orgId, personId });
    return c.json({ success: true, note });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/pipedrive/activities', async (c) => {
  const apiToken = getPipedriveApiToken();
  if (!apiToken) return c.json({ error: 'Pipedrive není nakonfigurován.' }, 500);

  try {
    const body = (await c.req.json()) as Record<string, any>;
    const subject = String(body.subject || '').trim();
    if (!subject) return c.json({ error: 'Chybí subject.' }, 400);

    const orgId = parsePipedriveNumericId(body.orgId);
    let orgLookup: PipedriveSchoolLookup | null = null;
    if (!parsePipedriveNumericId(body.userId) && (body.ico || body.schoolName)) {
      orgLookup = await lookupSchoolInPipedrive(apiToken, {
        ico: String(body.ico || '').trim(),
        name: String(body.schoolName || '').trim(),
      });
    }

    let inferredOwnerId: number | null = null;
    if (!parsePipedriveNumericId(body.userId) && orgId) {
      const dealLabelIdToName = await getPipedriveDealLabelIdToName(apiToken);
      const deals = await getPipedriveOrganizationDeals(apiToken, orgId).catch(() => []);
      const ownerDeal = deals.find((deal: any) => !isPipedriveTrialDeal(deal, dealLabelIdToName) && deal?.status === 'open')
        || deals.find((deal: any) => !isPipedriveTrialDeal(deal, dealLabelIdToName) && deal?.status === 'won')
        || deals[0];
      inferredOwnerId = parsePipedriveNumericId(ownerDeal?.user_id?.id || ownerDeal?.user_id?.value || ownerDeal?.owner_id?.id || ownerDeal?.owner_id);
    }

    const userId =
      parsePipedriveNumericId(body.userId) || inferredOwnerId || orgLookup?.ownerUserId || null;
    if (!userId) return c.json({ error: 'Nepodařilo se určit userId pro activity (zadejte userId nebo org s dealy).' }, 400);

    const dueDate = String(body.dueDate || '').trim() || buildTodayContextBlock().todayISO;
    const activity = await createPipedriveActivity(apiToken, {
      subject,
      userId,
      dueDate,
      note: String(body.note || '').trim(),
      dealId: parsePipedriveNumericId(body.dealId),
      orgId: orgId || orgLookup?.orgId || null,
      personId: parsePipedriveNumericId(body.personId),
      type: String(body.type || 'task'),
    });

    return c.json({ success: true, activity });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/schools', async (c) => {
  const q = String(c.req.query('q') || '').trim();
  const product = String(c.req.query('product') || '').trim();
  const subject = String(c.req.query('subject') || '').trim();
  const limit = Math.max(1, Math.min(50, Number(c.req.query('limit') || 24) || 24));

  try {
    const schools = (await loadSchoolsCache()).filter(isUsableSchoolRecordForAdmin);
    const apiToken = getPipedriveApiToken();
    const normalizedQuery = removeDiacritics(q);
    const normalizedProduct = removeDiacritics(product);
    const normalizedSubject = removeDiacritics(subject);
    const productCatalog = normalizedSubject ? await getAllProducts() : [];
    const subjectByProductName = new Map<string, string[]>();

    if (productCatalog.length) {
      for (const productItem of productCatalog) {
        const productName = removeDiacritics(String(productItem?.name || '').trim());
        const productSubject = removeDiacritics(
          normalizeSchoolSubjectLabel(String(productItem?.category || productItem?.predmet || '').trim()),
        );
        if (!productName || !productSubject) continue;
        const knownSubjects = subjectByProductName.get(productName) || [];
        if (!knownSubjects.includes(productSubject)) knownSubjects.push(productSubject);
        subjectByProductName.set(productName, knownSubjects);
      }
    }

    let candidates: SchoolRecord[] = [];
    if (normalizedQuery) {
      const queryDigits = q.replace(/\D/g, '');
      if (queryDigits.length >= 3) {
        candidates = schools.filter((school) => school.ico.replace(/\D/g, '').includes(queryDigits)).slice(0, 120);
      }
      if (!candidates.length) {
        candidates = searchSchools(schools, q, normalizedProduct ? Math.max(limit * 6, 80) : limit);
      }
    } else {
      candidates = [...schools]
        .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
        .slice(0, normalizedProduct ? Math.max(limit * 6, 120) : limit);
    }

    const resultItems: Array<{
      name: string;
      ico: string;
      address: string;
      kraj: string;
      typ: string;
      redIzo: string;
      orgId: number | null;
      orgName: string | null;
      status: string;
      matchedBy: 'ico' | 'name' | null;
      ownerName: string | null;
      products: string[];
      wonDeals: number;
      openDeals: number;
      totalDeals: number;
      source: 'csv';
    }> = [];

    const shouldEnrichWithPipedrive = Boolean(normalizedProduct || normalizedSubject);

    if (!apiToken || !shouldEnrichWithPipedrive) {
      return c.json({
        items: candidates.slice(0, limit).map((school) => ({
          name: school.name,
          ico: school.ico,
          address: sanitizeSchoolAddressForApi(school.address, school.ico),
          kraj: school.kraj,
          typ: school.typ,
          redIzo: school.redIzo,
          orgId: null,
          orgName: null,
          status: 'unknown',
          matchedBy: null,
          ownerName: null,
          products: [],
          wonDeals: 0,
          openDeals: 0,
          totalDeals: 0,
          source: 'csv' as const,
        })),
        total: Math.min(candidates.length, limit),
        q,
        product,
        subject,
      });
    }

    for (let index = 0; index < candidates.length && resultItems.length < limit; index += 5) {
      const batch = candidates.slice(index, index + 5);
      const batchResults = await Promise.all(
        batch.map(async (school) => {
          try {
            const lookup = await lookupSchoolInPipedrive(apiToken, { ico: school.ico, name: school.name });
            return {
              name: school.name,
              ico: school.ico,
              address: sanitizeSchoolAddressForApi(school.address, school.ico),
              kraj: school.kraj,
              typ: school.typ,
              redIzo: school.redIzo,
              orgId: lookup.orgId,
              orgName: lookup.orgName,
              status: lookup.status,
              matchedBy: lookup.matchedBy,
              ownerName: lookup.owner?.name || null,
              products: lookup.products,
              wonDeals: lookup.wonDeals,
              openDeals: lookup.openDeals,
              totalDeals: lookup.totalDeals,
              source: 'csv' as const,
            };
          } catch (error: any) {
            console.log(`[Schools] Admin list enrich failed for ${school.ico}: ${error.message}`);
            return {
              name: school.name,
              ico: school.ico,
              address: sanitizeSchoolAddressForApi(school.address, school.ico),
              kraj: school.kraj,
              typ: school.typ,
              redIzo: school.redIzo,
              orgId: null,
              orgName: null,
              status: 'unknown',
              matchedBy: null,
              ownerName: null,
              products: [],
              wonDeals: 0,
              openDeals: 0,
              totalDeals: 0,
              source: 'csv' as const,
            };
          }
        }),
      );

      for (const item of batchResults) {
        if (normalizedProduct) {
          const hasMatchingProduct = item.products.some((productName) => removeDiacritics(productName).includes(normalizedProduct));
          if (!hasMatchingProduct) continue;
        }
        if (normalizedSubject) {
          const hasMatchingSubject = item.products.some((productName) => {
            const normalizedProductName = removeDiacritics(productName);
            const productSubjects = subjectByProductName.get(normalizedProductName) || [];
            return normalizedProductName.includes(normalizedSubject)
              || productSubjects.some((productSubject) => productSubject.includes(normalizedSubject));
          });
          if (!hasMatchingSubject) continue;
        }
        resultItems.push(item);
        if (resultItems.length >= limit) break;
      }
    }

    return c.json({
      items: resultItems,
      total: resultItems.length,
      q,
      product,
      subject,
    });
  } catch (error: any) {
    console.log(`[Schools] Admin list error: ${error.message}`);
    return c.json({ error: error.message, items: [] }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/pipedrive/school-detail', async (c) => {
  const apiToken = getPipedriveApiToken();
  if (!apiToken) return c.json({ error: 'Pipedrive není nakonfigurován.' }, 500);

  try {
    const orgId = parsePipedriveNumericId(c.req.query('orgId'));
    const ico = String(c.req.query('ico') || '').trim();
    const name = String(c.req.query('name') || '').trim();
    if (!orgId && !ico && !name) {
      return c.json({ error: 'Zadejte orgId, ico nebo name.' }, 400);
    }

    const detail = await buildAdminSchoolDetail(apiToken, { orgId, ico, name });
    return c.json(detail);
  } catch (error: any) {
    console.log(`[Schools] Admin detail error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

/* ════���═════════════════════════════════════════════════════════════
   SCHOOLS CSV — in-memory cache + Storage upload
═════════════════════════════════════��════════════════════════════ */

interface SchoolRecord {
  name: string;
  ico: string;
  address: string;
  kraj: string;
  typ: string;
  reditel: string;
  email: string;
  redIzo: string;
  /** normalized name for fast search */
  _n: string;
}

let schoolsCache: SchoolRecord[] | null = null;
let schoolsCacheLoadedAt: Date | null = null;
const SCHOOLS_BUCKET = 'make-93a20b6f-schools';
const SCHOOLS_FILE   = 'skoly.csv';

function removeDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function joinAddressParts(parts: Array<string | null | undefined>) {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

function formatStreetNumber(descriptive?: string, orientation?: string) {
  const descriptiveClean = String(descriptive || '').trim();
  const orientationClean = String(orientation || '').trim();
  if (descriptiveClean && orientationClean) return `${descriptiveClean}/${orientationClean}`;
  return descriptiveClean || orientationClean || '';
}

/** Když CSV/ARES vrátí do „adresy“ jen IČO, neposílat to klientům jako ulici. */
function sanitizeSchoolAddressForApi(address: string, ico: string): string {
  const a = String(address || '').trim();
  if (!a) return '';
  const compact = a.replace(/\s/g, '');
  const icoDigits = String(ico || '').replace(/\D/g, '');
  if (icoDigits.length >= 6 && compact === icoDigits) return '';
  if (/^\d{6,10}$/.test(compact)) return '';
  return a;
}

function normalizeSchoolSubjectLabel(category: string): string {
  let normalized = String(category || '').trim();
  if (!normalized) return '';
  if (/^[Mm]atematika[\s\-]+2$/.test(normalized)) normalized = 'Matematika 2. stupeň';
  if (/^[Mm]atematika[\s\-]+1$/.test(normalized)) normalized = 'Matematika 1. stupeň';
  return normalized;
}

function buildAresAddress(sidlo: any) {
  const textAddress = String(sidlo?.textovaAdresa || sidlo?.adresaText || '').trim();
  if (textAddress) return textAddress;

  const street = String(sidlo?.nazevUlice || '').trim();
  const streetNumber = formatStreetNumber(
    sidlo?.cisloDomovni,
    sidlo?.cisloOrientacni ? `${sidlo.cisloOrientacni}${sidlo.cisloOrientacniPismeno || ''}` : sidlo?.cisloOrientacniPismeno,
  );
  const streetLine = [street, streetNumber].filter(Boolean).join(' ').trim();
  const city = String(sidlo?.nazevObce || sidlo?.nazevCastiObce || '').trim();
  const zip = String(sidlo?.psc || '').trim();

  return joinAddressParts([streetLine, city, zip]);
}

function parseSchoolsCsv(text: string): SchoolRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect delimiter: semicolon, comma, tab
  const firstLine = lines[0];
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === delim && !inQuote) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitLine(lines[0]).map(h => removeDiacritics(h));
  const idx = (candidates: string[]): number => {
    for (const c of candidates) {
      const i = headers.findIndex(h => h.includes(c));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iNazev   = idx(['nazev', 'nazov', 'name', 'skola']);
  const iIco     = idx(['ico', 'ic ']);
  const iAdresa  = idx(['adres']);
  const iStreet  = idx(['ulice', 'street']);
  const iStreetNo = idx(['cislo-popis', 'cp', 'c p', 'cislo-dom']);
  const iOrientNo = idx(['cislo-orient', 'co', 'c o', 'orientac']);
  const iCity    = idx(['obec', 'mesto', 'city']);
  const iZip     = idx(['psc', 'zip', 'post code', 'postcode']);
  const iKraj    = idx(['kraj']);
  const iTyp     = idx(['typ']);
  const iReditel = idx(['reditel', 'reditele', 'reditel/ka']);
  const iEmail   = idx(['email', 'mail']);
  const iRedIzo  = idx(['red-izo', 'redizo', 'red_izo']);

  const records: SchoolRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const name = iNazev >= 0 ? cols[iNazev] || '' : '';
    const ico  = iIco   >= 0 ? cols[iIco]?.replace(/\D/g, '') || '' : '';
    if (!name && !ico) continue;
    const street = iStreet >= 0 ? cols[iStreet] || '' : '';
    const streetNumber = formatStreetNumber(
      iStreetNo >= 0 ? cols[iStreetNo] || '' : '',
      iOrientNo >= 0 ? cols[iOrientNo] || '' : '',
    );
    const city = iCity >= 0 ? cols[iCity] || '' : '';
    const zip = iZip >= 0 ? cols[iZip] || '' : '';
    const structuredAddress = joinAddressParts([
      [street, streetNumber].filter(Boolean).join(' ').trim(),
      city,
      zip,
    ]);
    const rawAddress = iAdresa >= 0 ? cols[iAdresa] || '' : '';
    records.push({
      name,
      ico,
      address: structuredAddress || rawAddress,
      kraj:    iKraj    >= 0 ? cols[iKraj]    || '' : '',
      typ:     iTyp     >= 0 ? cols[iTyp]     || '' : '',
      reditel: iReditel >= 0 ? cols[iReditel] || '' : '',
      email:   iEmail   >= 0 ? cols[iEmail]   || '' : '',
      redIzo:  iRedIzo  >= 0 ? cols[iRedIzo]  || '' : '',
      _n: removeDiacritics(name),
    });
  }
  return records;
}

async function ensureSchoolsBucket(supabase: any) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: any) => b.name === SCHOOLS_BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(SCHOOLS_BUCKET, { public: false });
    console.log(`[Schools] Bucket ${SCHOOLS_BUCKET} created`);
  }
}

async function loadSchoolsCache(): Promise<SchoolRecord[]> {
  if (schoolsCache) return schoolsCache;
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await ensureSchoolsBucket(supabase);
    const { data, error } = await supabase.storage.from(SCHOOLS_BUCKET).download(SCHOOLS_FILE);
    if (error || !data) { console.log('[Schools] CSV not found in Storage:', error?.message); return []; }
    const text = await data.text();
    schoolsCache = parseSchoolsCsv(text);
    schoolsCacheLoadedAt = new Date();
    console.log(`[Schools] Cache loaded: ${schoolsCache.length} škol`);
  } catch (e: any) {
    console.log('[Schools] Cache load error:', e.message);
    return [];
  }
  return schoolsCache!;
}

function searchSchools(schools: SchoolRecord[], q: string, limit = 15): SchoolRecord[] {
  const nq = removeDiacritics(q);
  const scored = schools
    .map(s => {
      if (s._n.startsWith(nq))  return { s, score: 0 };
      if (s._n.includes(nq))    return { s, score: 1 };
      // word match
      const words = nq.split(/\s+/).filter(Boolean);
      if (words.length > 1 && words.every(w => s._n.includes(w))) return { s, score: 2 };
      return null;
    })
    .filter(Boolean) as { s: SchoolRecord; score: number }[];
  scored.sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name, 'cs'));
  return scored.slice(0, limit).map(x => x.s);
}

/* ── Upload endpoint ────────────────���────────────────────────────── */
app.post('/make-server-93a20b6f/admin/upload-schools-csv', async (c) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await ensureSchoolsBucket(supabase);

    const body = await c.req.parseBody();
    const file = body['file'] as File | undefined;
    if (!file) return c.json({ error: 'Soubor nebyl přiložen.' }, 400);

    const text = await file.text();
    const parsed = parseSchoolsCsv(text);
    if (parsed.length < 10) return c.json({ error: `Soubor obsahuje příliš málo řádků (${parsed.length}). Zkontroluj formát.` }, 400);

    // Upload raw CSV to Storage
    const { error: upErr } = await supabase.storage.from(SCHOOLS_BUCKET).upload(SCHOOLS_FILE, new Blob([text], { type: 'text/csv' }), { upsert: true });
    if (upErr) return c.json({ error: `Chyba při nahrávání: ${upErr.message}` }, 500);

    // Refresh in-memory cache
    schoolsCache = parsed;
    schoolsCacheLoadedAt = new Date();
    console.log(`[Schools] Uploaded & cached: ${parsed.length} škol`);

    return c.json({ ok: true, count: parsed.length, uploadedAt: schoolsCacheLoadedAt });
  } catch (e: any) {
    console.log('[Schools] Upload error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

/* ── Status endpoint ───��───────────���─────────────────────────────── */
app.get('/make-server-93a20b6f/admin/schools-status', async (c) => {
  const schools = (await loadSchoolsCache()).filter(isUsableSchoolRecordForAdmin);
  return c.json({
    loaded: schools.length > 0,
    count: schools.length,
    loadedAt: schoolsCacheLoadedAt,
  });
});

/* ── Modify school-search to use CSV cache first ────────────────── */
// (Wrapped version — the original ARES endpoint is extended above,
//  but we register a NEW interceptor that shadows the old path
//  by replacing it entirely via a re-registered endpoint.)

/* ── DELETED: duplicate RAG block removed ───────────────────────── */
async function _ragGenerate(prompt: string, apiKey: string, model = 'gemini-3-flash-preview'): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini generate ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/** Gemini Live API (WebSocket) — report agenta po čištění RAG (TEXT, ne AUDIO). */
const RAG_AGENT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

async function _ragGenerateGeminiLive(prompt: string, apiKey: string): Promise<string> {
  const { GoogleGenAI, Modality } = await import('npm:@google/genai@1.46.0');
  const ai = new GoogleGenAI({ apiKey });
  let accumulated = '';
  let turnDone = false;
  let wsErr: Error | null = null;

  const session = await ai.live.connect({
    model: RAG_AGENT_LIVE_MODEL,
    config: { responseModalities: [Modality.TEXT] },
    callbacks: {
      onmessage: (msg: any) => {
        const t = msg.text as string | undefined;
        if (t) accumulated += t;
        const sc = msg.serverContent;
        if (sc?.turnComplete === true || sc?.generationComplete === true) turnDone = true;
      },
      onerror: (e: any) => {
        wsErr = new Error(e?.message ?? String(e));
      },
      onclose: () => {
        if (accumulated.trim().length > 0) turnDone = true;
      },
    },
  });

  session.sendClientContent({
    turns: [{ role: 'user', parts: [{ text: prompt }] }],
    turnComplete: true,
  });

  const deadline = Date.now() + 45_000;
  while (!turnDone && !wsErr && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 40));
  }
  try {
    session.close();
  } catch {
    /* ignore */
  }
  if (wsErr) throw wsErr;
  if (!turnDone) throw new Error('Gemini Live: timeout 45s');
  const out = accumulated.trim();
  if (!out) throw new Error('Gemini Live: prázdná odpověď');
  return out;
}

// ── (cosineSim already defined above — using it directly) ─────────

// ── Quality scoring ───────────────────────────────────────────────
function qualityScore(text: string): number {
  if (!text?.trim()) return 0;
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const hasHtml  = /<[^>]+>/g.test(text);
  const wordCount = clean.split(/\s+/).length;
  const lengthScore = Math.min(1.0, clean.length / 400);
  const wordScore   = Math.min(0.25, wordCount / 80);
  return Math.max(0, Math.min(1,
    lengthScore * 0.55
    + wordScore
    + (hasHtml ? 0 : 0.2)
  ));
}

// ── Text chunker ──────────────────────────────────────────────────
function chunkText(text: string, chunkSize = 1800, overlap = 200): string[] {
  const clean = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  /* Krátký text = jeden chunk (dříve >40 znaků jinak [] → 0 chunků v RAG u krátkých přepisů). */
  if (clean.length <= chunkSize) return clean.length > 0 ? [clean] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const chunk = clean.slice(i, i + chunkSize);
    if (chunk.trim().length > 0) chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
}

// ── RAG persistence helpers ───────────────────────────────────────
const _RCHPFX = 'rag_chunk_v1_';
const _RIDXKEY = 'rag_index_v1';

const _RAG_CHUNK_PAGE = 500;

async function loadAllChunks(includeEmbeddings = true): Promise<any[]> {
  const sb = getDbClient();
  const selectClause = includeEmbeddings
    ? `
      id,
      text,
      embedding,
      metadata,
      token_count,
      document:source_documents (
        source_type,
        source_id,
        title
      )
    `
    : `
      id,
      text,
      metadata,
      token_count,
      document:source_documents (
        source_type,
        source_id,
        title
      )
    `;
  const out: any[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('rag_chunks')
      .select(selectClause)
      .order('created_at', { ascending: true })
      .range(offset, offset + _RAG_CHUNK_PAGE - 1);
    if (error) throw new Error(`rag_chunks load failed: ${error.message}`);
    const rows = data || [];
    for (const row of rows) {
      const m = mapRagRow(row);
      if (m) out.push(m);
    }
    if (rows.length < _RAG_CHUNK_PAGE) break;
    offset += _RAG_CHUNK_PAGE;
  }
  return out;
}

async function saveChunk(chunk: any): Promise<void> {
  const text = String(chunk?.text || '').trim();
  if (!text) throw new Error('Cannot save empty chunk');
  const sb = getDbClient();
  const { documentId, metadata } = await ensureSourceDocument(chunk);
  const chunkIndexRaw = metadata.chunkIndex ?? 0;
  const chunkIndex = Number.isFinite(Number(chunkIndexRaw)) ? Number(chunkIndexRaw) : 0;
  const tokenCount = Number.isFinite(Number(metadata.tokens))
    ? Number(metadata.tokens)
    : Math.max(1, Math.round(text.length / 4));
  const payload = {
    document_id: documentId,
    chunk_index: chunkIndex,
    text,
    token_count: tokenCount,
    content_hash: md5(`${text}\n${JSON.stringify(metadata)}`),
    metadata,
    embedding: vectorToSql(chunk?.embedding),
  };
  const { error } = await sb
    .from('rag_chunks')
    .upsert(payload, { onConflict: 'document_id,chunk_index' });
  if (error) throw new Error(`rag_chunks upsert failed: ${error.message}`);
}

async function removeChunk(id: string): Promise<void> {
  const sb = getDbClient();
  const idsToDelete = new Set<string>();
  if (looksLikeUuid(id)) idsToDelete.add(id);
  const { data: byExternal, error: findError } = await sb
    .from('rag_chunks')
    .select('id')
    .contains('metadata', { external_id: id });
  if (findError) throw new Error(`rag_chunks lookup failed: ${findError.message}`);
  for (const row of byExternal || []) idsToDelete.add(row.id);
  if (!idsToDelete.size) return;
  const { error } = await sb.from('rag_chunks').delete().in('id', [...idsToDelete]);
  if (error) throw new Error(`rag_chunks delete failed: ${error.message}`);
}

function subjectFaqsToRagText(subject: any, faqs: { question: string; answer: string }[]): string {
  const name = String(subject?.displayName || 'Předmět').trim();
  const slug = String(subject?.slug || '').trim();
  const baseUrl = 'https://www.vividbooks.com';
  const lines: string[] = [
    `Často kladené dotazy — předmět ${name} (Vividbooks).`,
    slug ? `Veřejná stránka předmětu: ${baseUrl}/predmet/${slug}` : '',
    '',
  ];
  for (const f of faqs) {
    lines.push(`Otázka: ${f.question}`);
    lines.push(`Odpověď: ${f.answer}`);
    lines.push('');
  }
  return lines.filter(Boolean).join('\n').trim();
}

/** Zaindexuje / smaže FAQ předmětu v RAG (deterministické id predmet_faq_<subjectId>). */
async function syncSubjectFaqRag(subject: any): Promise<void> {
  if (!subject?.id) return;
  const extId = `predmet_faq_${subject.id}`;
  const faqs = normalizeSubjectFaqs(subject.faqs);
  if (faqs.length === 0) {
    try {
      await removeChunk(extId);
    } catch (e) {
      console.log(`[syncSubjectFaqRag] remove empty: ${(e as Error).message}`);
    }
    return;
  }
  const text = subjectFaqsToRagText(subject, faqs);
  if (text.length < 40) {
    try {
      await removeChunk(extId);
    } catch (_) { /* ignore */ }
    return;
  }
  try {
    const embedding = await embedText(text);
    await saveChunk({
      id: extId,
      text,
      embedding,
      embeddingDims: embedding.length,
      metadata: {
        source: 'predmet-faq',
        sourceId: String(subject.id),
        subject: String(subject.displayName || ''),
        title: `FAQ: ${subject.displayName || subject.id}`,
        chunkIndex: 0,
        totalChunks: 1,
        uploadedAt: new Date().toISOString(),
        tokens: Math.round(text.length / 4),
        quality: qualityScore(text),
      },
    });
    console.log(`[syncSubjectFaqRag] indexed ${extId} (${faqs.length} FAQ)`);
  } catch (e) {
    console.error(`[syncSubjectFaqRag] failed ${extId}:`, (e as Error).message);
  }
}

// ── Build ingestable text for each source item ────────────────────
function productToText(p: any): string {
  const lines = [
    `Produkt: ${p.name || ''}`,
    `Kategorie: ${p.category || ''}`,
    `Typ: ${p.type || ''}`,
    `Cena: ${p.price || ''}`,
    `Popis: ${p.description || ''}`,
    `Dolozka MSMT: ${p.dolozka || 'Ne'}`,
    `Poznamka: ${p.note || p.poznamka || ''}`,
    `Rocnik: ${p.rocnik || ''}`,
    `Autori: ${p.autori || ''}`,
  ].filter(l => l.split(': ')[1]);

  if (p.obsah?.trim()) {
    lines.push('');
    lines.push('Obsah sesitu:');
    lines.push(p.obsah.trim());
  }

  return lines.join('\n');
}

function blogToText(b: any): string {
  const blocks = (b.contentBlocks || [])
    .map((bl: any) => bl.text || bl.content || '')
    .join(' ');
  return [
    `Blog: ${b.title || ''}`,
    `Kategorie: ${b.category || ''}`,
    `Autor: ${b.author || ''}`,
    `Perex: ${b.excerpt || b.perex || ''}`,
    blocks,
  ].filter(Boolean).join('\n');
}

function novinkaToText(n: any): string {
  const blocks = (n.contentBlocks || [])
    .map((bl: any) => bl.text || bl.content || '')
    .join(' ');
  return [
    `Novinka: ${n.title || ''}`,
    `Datum: ${n.publishedAt || n.date || ''}`,
    `Perex: ${n.excerpt || n.perex || ''}`,
    blocks,
  ].filter(Boolean).join('\n');
}

function webinarToText(w: any): string {
  // Vyhodnoť, zda je webinář v budoucnosti nebo minulosti
  let temporal = '';
  try {
    const monthNum = w.monthNum || (['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'].findIndex(m => (w.monthName || '').toLowerCase().startsWith(m.slice(0, 3))) + 1) || 0;
    if (monthNum > 0 && w.day && w.year) {
      const eventDate = new Date(w.year, monthNum - 1, w.day);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      temporal = eventDate >= now ? '[PLÁNOVANÝ - BUDOUCÍ]' : '[PROBĚHLÝ - MINULÝ]';
    }
  } catch {}
  return [
    `Webinar: ${w.title || ''} ${temporal}`,
    `Lektor: ${w.lecturer || ''}`,
    `Datum: ${w.day}. ${w.monthName} ${w.year}`,
    temporal ? `Stav: ${temporal}` : '',
    `Popis: ${w.description || ''}`,
    `Tema: ${w.topic || w.category || ''}`,
  ].filter(Boolean).join('\n');
}

// ���─ Tab to text ───────────────────────────────────────────────────
function tabToText(t: any): string {
  return [
    t.tabText    ? `Tab: ${t.tabText}` : '',
    t.subject    ? `Předmět: ${t.subject}` : '',
    t.contentHeadline ? `Nadpis: ${t.contentHeadline}` : '',
    t.contentRichText ? t.contentRichText : '',
    t.subpage    ? `Sekce: ${t.subpage}` : '',
  ].filter(Boolean).join('\n');
}

// ── Ingest one source ─────────────────────────────────────────────
async function ingestSource(
  source: 'produkty' | 'blog' | 'novinky' | 'webinare' | 'tabs' | 'mailchimp',
  apiKey: string,
): Promise<{ ingested: number; failed: number; skipped: number }> {
  let items: any[] = [];

  if (source === 'produkty') {
    items = await getAllProducts();
  } else if (source === 'blog') {
    items = await getCollection(BLOG_KEY);
  } else if (source === 'novinky') {
    items = await getCollection(NOVINKY_KEY);
  } else if (source === 'webinare') {
    items = await getCollection(WEBINARS_KEY);
  } else if (source === 'tabs') {
    items = await getCollection(TABS_KEY);
  } else if (source === 'mailchimp') {
    items = await loadMailchimpCampaigns();
  }

  if (!items.length) {
    if (source === 'mailchimp') throw new Error('Žádné Mailchimp kampaně v DB. Nejdřív spusť /admin/mailchimp/sync.');
    throw new Error(`Prazdny zdroj "${source}" — nejprve importujte data z Webflow`);
  }

  /* Smazat všechny dokumenty daného typu — rag_chunks maže CASCADE (nezávislé na limitu SELECT). */
  const sbDel = getDbClient();
  const { error: delSrcErr } = await sbDel.from('source_documents').delete().eq('source_type', source);
  if (delSrcErr) throw new Error(`RAG smazání zdroje ${source}: ${delSrcErr.message}`);
  console.log(`[RAG ingest] Smazány source_documents typu "${source}" (včetně chunků).`);

  let ingested = 0, failed = 0, skipped = 0;

  for (const item of items) {
    let rawText = '';
    if (source === 'produkty') rawText = productToText(item);
    else if (source === 'blog')    rawText = blogToText(item);
    else if (source === 'novinky') rawText = novinkaToText(item);
    else if (source === 'webinare') rawText = webinarToText(item);
    else if (source === 'tabs')    rawText = tabToText(item);
    else if (source === 'mailchimp') rawText = campaignToText(item);

    const chunks = source === 'mailchimp'
      ? chunkText(rawText, 3200, 150)
      : chunkText(rawText);
    if (!chunks.length) { skipped++; continue; }

    for (let ci = 0; ci < chunks.length; ci++) {
      const text = chunks[ci];
      try {
        const embedding = await embedText(text);
        if (!embedding.length) { failed++; continue; }
        const quality = qualityScore(text);
        const id = `${source}_${item.id || item.slug || Date.now()}_${ci}`;
        // Enriched metadata pro webináře — eventDate a temporal stav
        const extraMeta: Record<string, any> = {};
        if (source === 'webinare') {
          try {
            const _MONTHS = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
            const mn = item.monthNum || (_MONTHS.findIndex((m: string) => (item.monthName || '').toLowerCase().startsWith(m.slice(0, 3))) + 1) || 0;
            if (mn > 0 && item.day && item.year) {
              const ed = new Date(item.year, mn - 1, item.day);
              extraMeta.eventDate = ed.toISOString().slice(0, 10);
              const nowD = new Date(); nowD.setHours(0, 0, 0, 0);
              extraMeta.temporal = ed >= nowD ? 'future' : 'past';
            }
          } catch {}
        }
        await saveChunk({
          id,
          text,
          embedding,
          embeddingDims: embedding.length,
          metadata: {
            source,
            sourceId: item.id || item.slug || '',
            title: item.name || item.title || '',
            subject: item.subject || item.category || '',
            chunkIndex: ci,
            tokens: Math.round(text.length / 4),
            quality,
            createdAt: new Date().toISOString(),
            ...extraMeta,
          },
        });
        ingested++;
        // Rate-limit: ~20 req/s safe for Gemini free tier
        await new Promise(r => setTimeout(r, 60));
      } catch (e: any) {
        console.log(`[RAG ingest] chunk failed: ${e.message}`);
        failed++;
      }
    }
  }

  return { ingested, failed, skipped };
}

// ─────────────────────────────────────────────────────��───────────
// RAG ENDPOINTS
// ─────────────────────────────────────────────────────────────────

/* GET /rag/debug */
app.get('/make-server-93a20b6f/rag/debug', async (c) => {
  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  const geminiKeySet    = !!apiKey;
  const geminiKeyLength = apiKey?.length ?? 0;
  const geminiKeyPrefix = apiKey ? apiKey.slice(0, 8) + '...' : '';

  let embeddingTest: any  = null;
  let embeddingError: any = null;
  let generateTest: any   = null;
  let generateError: any  = null;
  if (apiKey) {
    // Test embedding
    try {
      const vec = await embedText('test vividbooks');
      embeddingTest = { dims: vec.length };
    } catch (e: any) {
      embeddingError = e.message;
    }
    // Test generation (to verify key works at all)
    try {
      const genRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }] }) }
      );
      const genBody = await genRes.text();
      if (genRes.ok) {
        generateTest = { status: genRes.status, ok: true };
      } else {
        generateError = `${genRes.status}: ${genBody.slice(0, 200)}`;
      }
    } catch (e: any) {
      generateError = e.message;
    }
    // List available models — find which embedding models exist for this key
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
        { method: 'GET' }
      );
      const listBody = await listRes.text();
      if (listRes.ok) {
        const parsed = JSON.parse(listBody);
        // Filter by supportedGenerationMethods — most accurate way to find embed models
        const embedModels = (parsed.models ?? [])
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('embedContent'))
          .map((m: any) => m.name);
        // Also grab all model names for debugging
        const allModelNames: string[] = (parsed.models ?? []).map((m: any) => m.name);
        if (!generateTest) generateTest = {};
        (generateTest as any).availableEmbedModels = embedModels;
        (generateTest as any).totalModels = allModelNames.length;
      } else {
        if (!generateTest) generateTest = {};
        (generateTest as any).listModelsError = `${listRes.status}: ${listBody.slice(0, 200)}`;
      }
    } catch (e: any) {
      if (!generateTest) generateTest = {};
      (generateTest as any).listModelsError = e.message;
    }
  }

  const sources: Record<string, any> = {};
  try { sources.produkty  = { items: (await getAllProducts()).length };      } catch (e: any) { sources.produkty  = { error: e.message }; }
  try { sources.blog      = { items: (await getCollection(BLOG_KEY)).length }; } catch (e: any) { sources.blog      = { error: e.message }; }
  try { sources.novinky   = { items: (await getCollection(NOVINKY_KEY)).length }; } catch (e: any) { sources.novinky   = { error: e.message }; }
  try { sources.webinare  = { items: (await getCollection(WEBINARS_KEY)).length }; } catch (e: any) { sources.webinare  = { error: e.message }; }
  try { sources.mailchimp = { items: (await loadMailchimpCampaigns()).length }; } catch (e: any) { sources.mailchimp = { error: e.message }; }

  const chunks = await loadAllChunks();
  const chunksPerSource: Record<string, number> = {};
  for (const ch of chunks) {
    const src = (ch as any).metadata?.source ?? 'unknown';
    chunksPerSource[src] = (chunksPerSource[src] ?? 0) + 1;
  }
  return c.json({ geminiKeySet, geminiKeyLength, geminiKeyPrefix, embeddingTest, embeddingError, generateTest, generateError, sources, ragIndex: chunks.length, chunksPerSource });
});

/* POST /rag/chunk — ingest a single text chunk */
app.post('/make-server-93a20b6f/rag/chunk', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);
    const { text, metadata } = await c.req.json();
    if (!text?.trim()) return c.json({ error: 'Chybi text' }, 400);
    const embedding = await embedText(text);
    const quality   = qualityScore(text);
    const id = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const chunk = {
      id, text, embedding,
      embeddingDims: embedding.length,
      metadata: { source: 'manual', tokens: Math.round(text.length / 4), quality, createdAt: new Date().toISOString(), ...(metadata || {}) },
    };
    await saveChunk(chunk);
    return c.json({ success: true, id, tokens: chunk.metadata.tokens, dims: embedding.length });
  } catch (e: any) {
    console.log(`[RAG chunk] ${e.message}`);
    return c.json({ error: `RAG chunk error: ${e.message}` }, 500);
  }
});

/* GET /rag/chunks — list all chunks (without embeddings for speed) */
app.get('/make-server-93a20b6f/rag/chunks', async (c) => {
  try {
    const all = await loadAllChunks(false);
    const chunks = all.map(({ embedding: _e, ...rest }: any) => rest); // strip heavy embedding vectors
    return c.json({ chunks, total: chunks.length });
  } catch (e: any) {
    console.log(`[RAG chunks] ${e.message}`);
    return c.json({ error: `RAG chunks error: ${e.message}` }, 500);
  }
});

/* GET /rag/export — full export with embeddings for re-import */
app.get('/make-server-93a20b6f/rag/export', async (c) => {
  try {
    const fmt = c.req.query('format') ?? 'json';
    const withEmbeddings = c.req.query('embeddings') !== '0';
    const all = await loadAllChunks();
    const exportedAt = new Date().toISOString();
    const meta = {
      exportedAt,
      totalChunks: all.length,
      embeddingModel: 'gemini-embedding-001',
      embeddingDims: 3072,
      sources: [...new Set(all.map((ch: any) => ch.metadata?.source).filter(Boolean))],
    };

    if (fmt === 'jsonl') {
      const lines = all.map((ch: any) => {
        const obj: any = { id: ch.id, text: ch.text, metadata: ch.metadata };
        if (withEmbeddings && ch.embedding) obj.values = ch.embedding;
        return JSON.stringify(obj);
      });
      return new Response(lines.join('\n'), {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Disposition': `attachment; filename="vividbooks-rag-${exportedAt.slice(0,10)}.jsonl"`,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (fmt === 'csv') {
      const header = 'id,source,title,chunkIndex,tokens,quality,createdAt,text';
      const rows = all.map((ch: any) => {
        const m = ch.metadata ?? {};
        const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        return [ch.id, m.source, m.title, m.chunkIndex, m.tokens, m.quality, m.createdAt, ch.text].map(esc).join(',');
      });
      return new Response([header, ...rows].join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vividbooks-rag-${exportedAt.slice(0,10)}.csv"`,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Default: full JSON
    const chunks = all.map((ch: any) => {
      const obj: any = { id: ch.id, text: ch.text, metadata: ch.metadata, embeddingDims: ch.embeddingDims };
      if (withEmbeddings && ch.embedding) obj.embedding = ch.embedding;
      return obj;
    });
    return new Response(JSON.stringify({ meta, chunks }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="vividbooks-rag-${exportedAt.slice(0,10)}.json"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    console.log(`[RAG export] CHYBA: ${e.message}`);
    return new Response(JSON.stringify({ error: `RAG export: ${e.message}` }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

/* DELETE /rag/chunk/:id */
app.delete('/make-server-93a20b6f/rag/chunk/:id', async (c) => {
  try {
    const id = decodeURIComponent(c.req.param('id'));
    await removeChunk(id);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `RAG delete error: ${e.message}` }, 500);
  }
});

/* POST /rag/ingest-source — ingest a whole data source */
app.post('/make-server-93a20b6f/rag/ingest-source', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);
    const { source } = await c.req.json();
    if (!['produkty', 'blog', 'novinky', 'webinare', 'tabs', 'mailchimp'].includes(source)) {
      return c.json({ error: 'Neznamy zdroj. Pouzij: produkty | blog | novinky | webinare | tabs | mailchimp' }, 400);
    }
    console.log(`[RAG ingest] Spoustim ingest pro zdroj: ${source}`);
    const result = await ingestSource(source, apiKey);
    console.log(`[RAG ingest] Hotovo: ${JSON.stringify(result)}`);
    return c.json({ success: true, ...result, total: result.ingested });
  } catch (e: any) {
    console.log(`[RAG ingest] CHYBA: ${e.message}`);
    return c.json({ error: `RAG ingest error: ${e.message}` }, 500);
  }
});

/* POST /rag/ingest-webinar-prepis — index transcript of a single past webinar */
app.post('/make-server-93a20b6f/rag/ingest-webinar-prepis', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);
    const body = await c.req.json();
    const { webinarId, prepis: prepisFromBody } = body;
    if (!webinarId) return c.json({ error: 'Chybi webinarId' }, 400);

    const items = await getCollection(WEBINARS_KEY);
    const webinar = items.find((w: any) => w.id === webinarId);
    if (!webinar) return c.json({ error: `Webinar ${webinarId} nenalezen` }, 404);

    const trimmedBody =
      typeof prepisFromBody === 'string' ? prepisFromBody.trim() : '';
    const prepisFromStore = String(webinar.prepis ?? '').trim();
    // Text pro index: z těla (nepředané uložené) nebo z KV
    const prepis: string = (trimmedBody || prepisFromStore);
    if (!prepis) return c.json({ error: 'Webinar nema vyplneny prepis' }, 400);

    /** Vždy uložit neprázdný přepis z klienta — dřív se ukládalo jen při změně, takže při chybě / starém deployi zůstal RAG bez KV. */
    if (trimmedBody.length > 0) {
      const ts = new Date().toISOString();
      const updated = items.map((w: any) =>
        w.id === webinarId ? { ...w, prepis: trimmedBody, updatedAt: ts } : w);
      await saveCollection(WEBINARS_KEY, updated);
      console.log(`[RAG prepis] Prepis ulozen do KV (${trimmedBody.length} zn.) webinar ${webinarId}`);
    }

    console.log(`[RAG prepis] Indexuji prepis webinare "${webinar.title}" (${prepis.length} znaku)`);

    // Remove existing prepis chunks for this webinar (stejná logika jako webinar-prepis-status)
    const existing = await loadAllChunks();
    const prepPrefix = `webinar-prepis_${webinarId}_`;
    const oldChunks = existing.filter((ch: any) => {
      const m = ch.metadata || {};
      if (m.source === 'webinar-prepis' && String(m.sourceId) === String(webinarId)) return true;
      const ext = m.external_id != null ? String(m.external_id) : String(ch.id || '');
      return ext.startsWith(prepPrefix);
    });
    for (const ch of oldChunks) {
      await removeChunk(ch.id);
      await new Promise(r => setTimeout(r, 20));
    }
    console.log(`[RAG prepis] Smazano ${oldChunks.length} starych chunku`);

    const rawText = `Prepis webinare: ${webinar.title}\nLektor: ${webinar.lecturer || ''}\nDatum: ${webinar.day}. ${webinar.monthName} ${webinar.year}\n\n${prepis}`;
    const chunks = chunkText(rawText);
    if (chunks.length === 0) {
      return c.json({
        error: 'Po vyčištění textu nezůstal žádný obsah k indexaci (zkontroluj přepis — nesmí být jen mezery/HTML).',
      }, 400);
    }
    let ingested = 0, failed = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      const text = chunks[ci];
      try {
        const embedding = await embedText(text);
        if (!embedding.length) { failed++; continue; }
        const quality = qualityScore(text);
        const id = `webinar-prepis_${webinarId}_${ci}`;
        await saveChunk({
          id, text, embedding,
          embeddingDims: embedding.length,
          metadata: {
            source: 'webinar-prepis',
            sourceId: webinarId,
            title: `Prepis: ${webinar.title}`,
            chunkIndex: ci,
            tokens: Math.round(text.length / 4),
            quality,
            createdAt: new Date().toISOString(),
          },
        });
        ingested++;
        await new Promise(r => setTimeout(r, 60));
      } catch (e: any) {
        console.log(`[RAG prepis] chunk ${ci} failed: ${e.message}`);
        failed++;
      }
    }

    console.log(`[RAG prepis] Hotovo: ${ingested} chunku ulozeno, ${failed} selhalo`);
    return c.json({ success: true, ingested, failed, webinarTitle: webinar.title });
  } catch (e: any) {
    console.log(`[RAG prepis] CHYBA: ${e.message}`);
    return c.json({ error: `RAG prepis ingest error: ${e.message}` }, 500);
  }
});

/* GET /rag/webinar-prepis-status/:id — how many chunks indexed for this webinar */
app.get('/make-server-93a20b6f/rag/webinar-prepis-status/:id', async (c) => {
  try {
    const webinarId = c.req.param('id');
    const all = await loadAllChunks(false);
    const prefix = `webinar-prepis_${webinarId}_`;
    const chunks = all.filter((ch: any) => {
      const m = ch.metadata || {};
      if (m.source === 'webinar-prepis' && String(m.sourceId) === String(webinarId)) return true;
      const ext = m.external_id != null ? String(m.external_id) : String(ch.id || '');
      return ext.startsWith(prefix);
    });
    return c.json({ count: chunks.length, webinarId });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/* POST /rag/ingest-text — nahraje libovolný text / soubor do RAG */
app.post('/make-server-93a20b6f/rag/ingest-text', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);

    const { text, title, sourceTag, description, replaceExisting = false } = await c.req.json();
    if (!text?.trim())  return c.json({ error: 'Chybi text' }, 400);
    if (!title?.trim()) return c.json({ error: 'Chybi title' }, 400);

    const source = `doc:${(sourceTag || title).replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}`;
    console.log(`[RAG ingest-text] Zdroj="${source}" title="${title}" znaku=${text.length} replace=${replaceExisting}`);

    if (replaceExisting) {
      const existing = await loadAllChunks();
      const old = existing.filter((ch: any) => ch.metadata?.source === source);
      for (const ch of old) {
        await removeChunk(ch.id);
        await new Promise(r => setTimeout(r, 15));
      }
      console.log(`[RAG ingest-text] Smazano ${old.length} starych chunku pro "${source}"`);
    }

    const header = `${title}${description ? '\n' + description : ''}\n\n`;
    const chunks = chunkText(header + text.trim());
    let ingested = 0, failed = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkTxt = chunks[ci];
      try {
        const embedding = await embedText(chunkTxt);
        const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${ci}`;
        await saveChunk({
          id,
          text: chunkTxt,
          embedding,
          embeddingDims: embedding.length,
          metadata: {
            source,
            title,
            description: description || '',
            chunkIndex: ci,
            totalChunks: chunks.length,
            uploadedAt: new Date().toISOString(),
            tokens: Math.round(chunkTxt.length / 4),
            quality: qualityScore(chunkTxt),
          },
        });
        ingested++;
        if (ci < chunks.length - 1) await new Promise(r => setTimeout(r, 100));
      } catch (e: any) {
        console.log(`[RAG ingest-text] chunk ${ci} selhal: ${e.message}`);
        failed++;
      }
    }

    console.log(`[RAG ingest-text] Hotovo: ${ingested} OK, ${failed} chyb`);
    return c.json({ success: true, source, ingested, failed, total: chunks.length });
  } catch (e: any) {
    console.log(`[RAG ingest-text] CHYBA: ${e.message}`);
    return c.json({ error: `RAG ingest-text error: ${e.message}` }, 500);
  }
});

/* DELETE /rag/delete-source — smaže všechny chunky daného source tagu */
app.delete('/make-server-93a20b6f/rag/delete-source', async (c) => {
  try {
    const { source } = await c.req.json();
    if (!source) return c.json({ error: 'Chybi source' }, 400);
    const all = await loadAllChunks();
    const toDelete = all.filter((ch: any) => ch.metadata?.source === source);
    for (const ch of toDelete) {
      await removeChunk(ch.id);
      await new Promise(r => setTimeout(r, 15));
    }
    console.log(`[RAG delete-source] Smazano ${toDelete.length} chunku pro source="${source}"`);
    return c.json({ success: true, deleted: toDelete.length });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/** Pouze pgvector retrieval + sestavení kontextu (bez druhé Gemini syntézy). Pro Obchodníka / orchestrátor. */
async function retrieveRagChunksForQuery(question: string, topK: number): Promise<{
  context: string;
  sources: any[];
  chunksUsed: number;
  ranked: any[];
} | null> {
  const queryVec = await embedText(question);
  const sb = getDbClient();
  const { data: rankedRows, error: matchError } = await sb.rpc('match_rag_chunks', {
    p_query_embedding: vectorToSql(queryVec),
    p_match_count: topK,
    p_source_types: null,
    p_document_ids: null,
    p_metadata_filter: {},
  });
  let ranked = (rankedRows || []).map((row: any) => ({
    id: row.metadata?.external_id || row.chunk_id,
    text: row.content,
    metadata: {
      ...(row.metadata || {}),
      source: row.metadata?.source || row.source_type,
      sourceId: row.metadata?.sourceId || row.source_id,
      title: row.metadata?.title || row.title,
    },
    score: Number(row.similarity || 0),
  }));
  if (matchError) {
    console.log(`[RAG retrieve] RPC unavailable, fallback to exact scan: ${matchError.message}`);
    const all = await loadAllChunks();
    ranked = all
      .filter((ch: any) => ch.embedding?.length)
      .map((ch: any) => ({ ...ch, score: cosineSim(queryVec, ch.embedding) }))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, topK);
  }
  if (!ranked.length) return null;

  const context = ranked
    .map((ch: any, i: number) =>
      `[${i + 1}] (zdroj: ${ch.metadata?.source ?? '?'}, titul: ${ch.metadata?.title ?? ''}, skore: ${ch.score.toFixed(3)})\n${ch.text}`
    )
    .join('\n\n---\n\n');

  const seenSid = new Map<string, any>();
  for (const ch of ranked) {
    const sid = `${ch.metadata?.source}__${ch.metadata?.sourceId || ch.id}`;
    const ex = seenSid.get(sid);
    if (!ex || ch.score > ex.score) seenSid.set(sid, ch);
  }

  const sources = [...seenSid.values()]
    .sort((a: any, b: any) => b.score - a.score)
    .map((ch: any) => ({
      id: ch.id,
      source: ch.metadata?.source ?? '',
      sourceId: ch.metadata?.sourceId ?? ch.metadata?.slug ?? '',
      title: ch.metadata?.title ?? '',
      score: ch.score,
      text: ch.text?.slice(0, 200),
    }));

  return { context, sources, chunksUsed: ranked.length, ranked };
}

/** Sdílená pipeline: pgvector retrieval + Gemini odpověď (stejná logika jako interní /rag/query). */
async function executeRagQueryPipeline(question: string, topK: number): Promise<{
  answer: string;
  sources: any[];
  chunksUsed: number;
}> {
  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  if (!apiKey) throw new Error('GEMINI_API_KEY_RAG neni nastaven');

  const retrieved = await retrieveRagChunksForQuery(question, topK);
  if (!retrieved) {
    return {
      answer: 'Znalostni baze je prazdna. Nejprve indexujte data v Admin → RAG.',
      sources: [],
      chunksUsed: 0,
    };
  }

  const { context, sources, chunksUsed } = retrieved;

  const prompt = `Jsi pomocny asistent Vividbooks — ceskych interaktivnich ucebnic a pracovnich sesitu.
Odpovez na otazku nize pouze na zaklade poskytnuteho kontextu. Pokud kontext neobsahuje odpoved, rici to uprimne.
Odpovez cesky, strucne a presne.

KONTEXT:
${context}

OTAZKA: ${question}

ODPOVED:`;

  const answer = await _ragGenerate(prompt, apiKey, 'gemini-3-flash-preview');

  return { answer, sources, chunksUsed };
}

/* POST /rag/retrieve — jen chunky (bez syntézy odpovědi). Pro Obchodníka / orchestrátor. */
app.post('/make-server-93a20b6f/rag/retrieve', async (c) => {
  try {
    const { question, topK = 10 } = await c.req.json();
    if (!question?.trim()) return c.json({ error: 'Chybi question' }, 400);
    const k = Math.min(16, Math.max(1, Number(topK) || 10));
    const retrieved = await retrieveRagChunksForQuery(String(question).trim(), k);
    if (!retrieved) {
      return c.json({ context: '', sources: [], chunksUsed: 0 });
    }
    return c.json({
      context: retrieved.context,
      sources: retrieved.sources,
      chunksUsed: retrieved.chunksUsed,
    });
  } catch (e: any) {
    console.log(`[RAG retrieve] ${e.message}`);
    return c.json({ error: `RAG retrieve error: ${e.message}` }, 500);
  }
});

/* POST /rag/query — RAG dotaz přes Gemini 2.0 Flash */
app.post('/make-server-93a20b6f/rag/query', async (c) => {
  try {
    const { question, topK = 5 } = await c.req.json();
    if (!question?.trim()) return c.json({ error: 'Chybi question' }, 400);
    const k = Math.min(16, Math.max(1, Number(topK) || 5));
    const { answer, sources, chunksUsed } = await executeRagQueryPipeline(String(question).trim(), k);
    return c.json({ answer, sources, chunksUsed });
  } catch (e: any) {
    console.log(`[RAG query] ${e.message}`);
    return c.json({ error: `RAG query error: ${e.message}` }, 500);
  }
});

/**
 * Externí partner (např. Ninjabot): POST JSON { "query": "..." }.
 * Hlavičky: (1) Supabase gateway — Authorization: Bearer <SUPABASE_ANON_KEY> a/nebo apikey: <stejné>
 *           (2) aplikace — X-API-Key: hodnota z NINJABOT_RAG_API_KEY (Edge secrets)
 * Odpověď: { "answer": "..." }. Vyžaduje secret NINJABOT_RAG_API_KEY nebo RAG_EXTERNAL_API_KEY.
 *
 * GET (stejná URL): veřejná dokumentace — JSON nebo HTML (?format=html nebo Accept: text/html).
 */
app.get('/make-server-93a20b6f/external/rag-query', async (c) => {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const postUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/make-server-93a20b6f/external/rag-query`
    : '';
  const accept = (c.req.header('Accept') || '').toLowerCase();
  const wantsHtml =
    c.req.query('format') !== 'json' && (c.req.query('format') === 'html' || accept.includes('text/html'));

  const doc = {
    title: 'Vividbooks - external RAG API (partner)',
    method: 'POST',
    url: postUrl,
    documentationGetUrl: postUrl,
    note:
      'Send POST with JSON body. Supabase Edge requires Authorization: Bearer <anon public key> from Dashboard -> Settings -> API. X-API-Key must match the secret shared with you (NINJABOT_RAG_API_KEY on our side).',
    headers: {
      Authorization:
        'Bearer <SUPABASE_ANON_PUBLIC_KEY> - Project Settings -> API -> Project API keys -> anon / public',
      apikey: '<optional - same value as anon public key>',
      'Content-Type': 'application/json',
      'X-API-Key': '<partner secret - provided out of band>',
    },
    body: {
      query: 'string (required) - user question in Czech or English',
      question: 'optional alias for query',
      topK: 'optional number 1-16, default 5',
    },
    response: { answer: 'string' },
    httpErrors: {
      '401': 'Missing/invalid X-API-Key or missing Supabase Authorization',
      '503': 'External RAG not configured on server',
      '500': 'RAG pipeline error (e.g. upstream)',
    },
  };

  if (wantsHtml) {
    const escAttr = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    /** Only & and < for text inside <pre> (keep " copy-paste friendly). */
    const escPre = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const curl = [
      `curl -sS '${postUrl}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \\`,
      `  -H "apikey: YOUR_SUPABASE_ANON_KEY" \\`,
      `  -H "X-API-Key: YOUR_PARTNER_KEY" \\`,
      `  -d '{"query":"What does Vividbooks offer?"}'`,
    ].join('\n');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escAttr(doc.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #111; }
    h1 { font-size: 1.25rem; }
    code, pre { background: #f4f4f5; padding: 0.15em 0.35em; border-radius: 4px; font-size: 0.9em; }
    pre { padding: 1rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
    .muted { color: #555; font-size: 0.95rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>${escAttr(doc.title)}</h1>
  <p class="muted">POST <code>${escAttr(postUrl)}</code></p>
  <p>${escAttr(doc.note)}</p>
  <p><strong>Headers:</strong> <code>Authorization</code> (Bearer anon from Supabase), optional <code>apikey</code>, <code>Content-Type: application/json</code>, <code>X-API-Key</code> (shared secret).</p>
  <p><strong>JSON body:</strong> <code>{"query":"..."}</code>, optional <code>topK</code> (1-16).</p>
  <p><strong>Response:</strong> <code>{"answer":"..."}</code></p>
  <h2>curl example</h2>
  <pre>${escPre(curl)}</pre>
  <p class="muted">JSON docs: <a href="?format=json">?format=json</a> or header <code>Accept: application/json</code></p>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return c.json(doc);
});

app.post('/make-server-93a20b6f/external/rag-query', async (c) => {
  const secret = (Deno.env.get('NINJABOT_RAG_API_KEY') || Deno.env.get('RAG_EXTERNAL_API_KEY') || '').trim();
  if (!secret) {
    return c.json({ error: 'External RAG API is not configured (missing NINJABOT_RAG_API_KEY).' }, 503);
  }
  const clientKey = c.req.header('X-API-Key') || c.req.header('x-api-key') || '';
  if (!clientKey) {
    return c.json(
      {
        error: 'Missing X-API-Key',
        hint:
          'Supabase Edge requires Authorization: Bearer <anon public key> (and optionally apikey). Also send X-API-Key matching NINJABOT_RAG_API_KEY in project secrets.',
      },
      401,
    );
  }
  if (clientKey !== secret) {
    return c.json({ error: 'Invalid X-API-Key' }, 401);
  }
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const rawQ = body.query ?? body.question;
  const q = typeof rawQ === 'string' ? rawQ.trim() : '';
  if (!q) {
    return c.json({ error: 'Missing or empty "query" field' }, 400);
  }
  const topK = Math.min(16, Math.max(1, Number(body.topK) || 5));
  try {
    const { answer } = await executeRagQueryPipeline(q, topK);
    return c.json({ answer });
  } catch (e: any) {
    console.log(`[external/rag-query] ${e.message}`);
    return c.json({ error: e.message || 'RAG query failed' }, 500);
  }
});

/* POST /rag/agent/run — Gemini 2.5 Pro cleaning agent */
app.post('/make-server-93a20b6f/rag/agent/run', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);

    const all = await loadAllChunks();
    if (!all.length) return c.json({ success: true, stats: { total: 0, deleted: 0, kept: 0 }, actions: [] });

    const actions: any[] = [];
    let deleted = 0;

    // ── 1. HTML cleaning — remove chunks with HTML artifacts
    for (const ch of all) {
      if (/<[a-z][^>]*>/i.test(ch.text || '')) {
        await removeChunk(ch.id);
        deleted++;
        actions.push({ action: 'delete', reason: 'HTML artefakty', id: ch.id, title: ch.metadata?.title });
      }
    }

    // ── 2. Quality threshold — remove low quality chunks
    const afterHtml = await loadAllChunks();
    for (const ch of afterHtml) {
      const q = ch.metadata?.quality ?? qualityScore(ch.text || '');
      if (q < 0.35) {
        await removeChunk(ch.id);
        deleted++;
        actions.push({ action: 'delete', reason: `Nizka kvalita (${q.toFixed(2)} < 0.35)`, id: ch.id });
      }
    }

    // ── 3. Deduplication — remove near-duplicate chunks (cosine > 0.95)
    const afterQuality = await loadAllChunks();
    const seenIds = new Set<string>();
    for (let i = 0; i < afterQuality.length; i++) {
      if (seenIds.has(afterQuality[i].id)) continue;
      for (let j = i + 1; j < afterQuality.length; j++) {
        if (seenIds.has(afterQuality[j].id)) continue;
        if (!afterQuality[i].embedding?.length || !afterQuality[j].embedding?.length) continue;
        const sim = cosineSim(afterQuality[i].embedding, afterQuality[j].embedding);
        if (sim > 0.95) {
          seenIds.add(afterQuality[j].id);
          await removeChunk(afterQuality[j].id);
          deleted++;
          actions.push({ action: 'deduplicate', reason: `Duplikat (sim=${sim.toFixed(3)})`, id: afterQuality[j].id, keptId: afterQuality[i].id });
        }
      }
    }

    // ── 4. Ask Gemini 2.5 Pro agent to summarize what it found
    const remaining = await loadAllChunks();
    const agentSummaryPrompt = `Jsi RAG cleaning agent pro Vividbooks znalostni bazi.
Provedl jsi cisteni:
- Celkem chunku pred cistenim: ${all.length}
- Smazano HTML artefaktu: ${actions.filter(a => a.reason?.includes('HTML')).length}
- Smazano pro nizkou kvalitu: ${actions.filter(a => a.reason?.includes('kvalita')).length}
- Smazano duplikatu: ${actions.filter(a => a.action === 'deduplicate').length}
- Zbyvajicich chunku: ${remaining.length}

Zdroje v databazi: ${[...new Set(remaining.map((c: any) => c.metadata?.source))].join(', ')}

Napis kratky report (3-4 vety cesky) o stavu znalostni baze.`;

    let agentReport = '';
    try {
      agentReport = await _ragGenerateGeminiLive(agentSummaryPrompt, apiKey);
    } catch (liveErr: any) {
      console.log(`[RAG agent] Gemini Live (${RAG_AGENT_LIVE_MODEL}) selhal, REST fallback: ${liveErr?.message ?? liveErr}`);
      try {
        agentReport = await _ragGenerate(agentSummaryPrompt, apiKey, 'gemini-3-flash-preview');
      } catch {
        agentReport = `Agent dokoncil cisteni. Zpracovano ${all.length} chunku, smazano ${deleted}, zbyvajicich ${remaining.length}.`;
      }
    }

    const stats = {
      total: all.length,
      deleted,
      kept: remaining.length,
      htmlCleaned: actions.filter(a => a.reason?.includes('HTML')).length,
      lowQualityRemoved: actions.filter(a => a.reason?.includes('kvalita')).length,
      duplicatesRemoved: actions.filter(a => a.action === 'deduplicate').length,
      agentReport,
    };

    console.log(`[RAG agent] Hotovo: ${JSON.stringify({ total: stats.total, deleted, kept: stats.kept })}`);
    return c.json({ success: true, stats, actions: actions.slice(0, 50) });
  } catch (e: any) {
    console.log(`[RAG agent] CHYBA: ${e.message}`);
    return c.json({ error: `RAG agent error: ${e.message}` }, 500);
  }
});

/* POST /rag/live-ephemeral-token + /admin/live-ephemeral-token — Gemini Live ephemeral token (v1alpha).
 * Bez liveConnectConstraints — session config nastavuje klient (@google/genai live.connect). */
async function handleLiveEphemeralToken(c: any) {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);

    const { GoogleGenAI } = await import('npm:@google/genai@1.46.0');
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });
    const now = Date.now();
    /** Minimální tělo — další pole (uses, newSessionExpireTime) umí u některých účtů vracet INVALID_ARGUMENT. */
    const token = await client.authTokens.create({
      config: {
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      },
    });
    const name = token.name;
    if (!name) return c.json({ error: 'Ephemeral token bez name' }, 500);
    return c.json({ token: name, expiresAt: new Date(now + 30 * 60 * 1000).toISOString() });
  } catch (e: any) {
    const raw = e?.message ?? String(e);
    console.log(`[live-ephemeral-token] ${raw}`);
    return c.json({ error: raw }, 500);
  }
}
app.post('/make-server-93a20b6f/rag/live-ephemeral-token', handleLiveEphemeralToken);
app.post('/make-server-93a20b6f/admin/live-ephemeral-token', handleLiveEphemeralToken);

function parsePriceNumber(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

async function searchPipedrivePersonByEmail(apiToken: string, email: string): Promise<any | null> {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return null;
  try {
    const data = await pipedriveRequest<any>(apiToken, '/persons/search', {}, {
      term: clean,
      fields: 'email',
    });
    const items: any[] = Array.isArray(data?.data?.items) ? data.data.items : [];
    for (const entry of items) {
      const person = entry?.item || entry;
      if (!person?.id) continue;
      const emails = readPipedrivePersonEmails(person);
      if (emails.includes(clean)) return person;
    }
  } catch (error: any) {
    console.log(`[Pipedrive] persons/search: ${error.message}`);
  }
  return null;
}

async function findOrCreatePipedrivePersonForEshopB2c(
  apiToken: string,
  params: { name: string; email: string; phone: string },
) {
  const existing = await searchPipedrivePersonByEmail(apiToken, params.email);
  if (existing?.id) return existing;
  const payload: Record<string, any> = {
    name: String(params.name || '').trim() || 'Zákazník',
    email: String(params.email || '').trim(),
  };
  if (params.phone?.trim()) payload.phone = params.phone.trim();
  const created = await pipedriveRequest<any>(apiToken, '/persons', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return created?.data || null;
}

/** E‑shop dealy (B2C/B2B): jedna pipeline a fáze — vlastníka dealu řeší automatizace v Pipedrive. */
const PIPEDRIVE_ESHOP_PIPELINE_ID = 20;
const PIPEDRIVE_ESHOP_STAGE_ID = 106;

/** Výchozí ID štítků dealu (pole Label) — přepíše PIPEDRIVE_ESHOP_LABEL_IDS_* / auto z API. */
const PIPEDRIVE_ESHOP_LABEL_ID_B2C_DEFAULT = 419;
const PIPEDRIVE_ESHOP_LABEL_ID_B2B_DEFAULT = 488;

/** Vlastní pole „product category“ / e-shop tiskoviny — hodnota `print` (obchodní spec). */
const PIPEDRIVE_ESHOP_PRODUCT_CATEGORY_FIELD_KEY_DEFAULT = '3f0c870ac132eec72589da1313e2388977c4a74f';

/** Won deal z zaplacené kartové objednávky e‑shopu — enum „Zaplaceno“ (field id 12585 v Pipedrive UI). */
const PIPEDRIVE_ESHOP_PAID_STATUS_FIELD_KEY_DEFAULT = '0e41017f4d0a3aa58177d7727844f98a6569d630';
const PIPEDRIVE_ESHOP_PAID_STATUS_OPTION_ID_DEFAULT = 489;

function getEshopProductCategoryPayload(): Record<string, unknown> {
  const key =
    (Deno.env.get('PIPEDRIVE_ESHOP_PRODUCT_CATEGORY_FIELD_KEY') || '').trim()
    || PIPEDRIVE_ESHOP_PRODUCT_CATEGORY_FIELD_KEY_DEFAULT;
  const value = (Deno.env.get('PIPEDRIVE_ESHOP_PRODUCT_CATEGORY_VALUE') || '').trim() || 'print';
  return { [key]: value };
}

/** Stav úhrady na dealu pro `b2c_card_won` / `b2b_card_won` (ne pro převod open). */
function getEshopCardPaidStatusPayload(): Record<string, unknown> {
  const key =
    (Deno.env.get('PIPEDRIVE_ESHOP_PAID_STATUS_FIELD_KEY') || '').trim()
    || PIPEDRIVE_ESHOP_PAID_STATUS_FIELD_KEY_DEFAULT;
  const optId =
    parsePipedriveNumericId(Deno.env.get('PIPEDRIVE_ESHOP_PAID_STATUS_OPTION_ID'))
    ?? PIPEDRIVE_ESHOP_PAID_STATUS_OPTION_ID_DEFAULT;
  return { [key]: optId };
}

function findPipedriveStatusOption(options: any[], wanted: 'open' | 'won'): any | null {
  const L = (s: unknown) => String(s || '').trim().toLowerCase();
  if (wanted === 'won') {
    return (
      options.find((o) => L(o.label) === 'won') ||
      options.find((o) => /^(won|vyhran|výhr)/.test(L(o.label))) ||
      options.find((o) => /\bwon\b/.test(L(o.label)))
    );
  }
  return (
    options.find((o) => L(o.label) === 'open') ||
    options.find((o) => /^(open|otevř)/.test(L(o.label))) ||
    options.find((o) => /\bopen\b/.test(L(o.label)))
  );
}

/**
 * Načte GET /dealFields a sestaví payload pro stav dealu: vlastní enum (OPEN/WON) nebo systémové `status`.
 */
async function resolveDealStatusPayloadFromFields(
  apiToken: string,
  wanted: 'open' | 'won',
): Promise<Record<string, unknown>> {
  try {
    const data = await pipedriveRequest<any>(apiToken, '/dealFields', {}, { limit: 500 });
    const fields: any[] = Array.isArray(data?.data) ? data.data : [];

    // 1) Systémové pole status (key === status) — GET /dealFields vrací field_id; POST /deals bere open|won
    const sys = fields.find((f) => String(f.key || '') === 'status');
    if (sys?.id != null) {
      console.log(`[Pipedrive eshop] systémové pole status field_id=${sys.id} key=status → ${wanted}`);
      if (sys.options?.length) {
        const opt = findPipedriveStatusOption(sys.options, wanted);
        if (opt) {
          console.log(`[Pipedrive eshop] status option v dealFields: id=${opt.id} label=${opt.label}`);
        }
      }
      return { status: wanted };
    }

    // 2) Vlastní enum s OPEN / WON (když účet nemá v metadatech systémové status)
    for (const f of fields) {
      const opts = f.options || [];
      if (opts.length < 2 || !f.key) continue;
      const hasOpen = opts.some((o: any) => /open|otevř/i.test(String(o.label || '')));
      const hasWon = opts.some((o: any) => /won|vyhran|výhr/i.test(String(o.label || '')));
      if (!hasOpen || !hasWon) continue;
      const opt = findPipedriveStatusOption(opts, wanted);
      if (opt?.id != null) {
        console.log(
          `[Pipedrive eshop] status z dealFields (vlastní pole): field_id=${f.id} key=${f.key} option_id=${opt.id} (${opt.label})`,
        );
        return { [String(f.key)]: opt.id };
      }
    }
  } catch (e: any) {
    console.log(`[Pipedrive eshop] resolveDealStatusPayloadFromFields: ${e.message}`);
  }
  return { status: wanted };
}

function parseCommaSeparatedPipedriveIds(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  const out: number[] = [];
  for (const part of raw.split(',')) {
    const id = parsePipedriveNumericId(part.trim());
    if (id) out.push(id);
  }
  return out;
}

/**
 * Štítky dealu (pole `label`): nejdřív env, pak heuristika z /dealFields, jinak výchozí 419 (B2C) / 488 (B2B).
 */
async function resolveEshopDealLabelIds(
  apiToken: string,
  mode: 'b2c_card_won' | 'b2b_card_won' | 'b2b_transfer_open',
): Promise<number[]> {
  const fromEnvB2c = parseCommaSeparatedPipedriveIds(Deno.env.get('PIPEDRIVE_ESHOP_LABEL_IDS_B2C'));
  const fromEnvB2b = parseCommaSeparatedPipedriveIds(Deno.env.get('PIPEDRIVE_ESHOP_LABEL_IDS_B2B'));
  if (mode === 'b2c_card_won' && fromEnvB2c.length) return fromEnvB2c;
  if (mode !== 'b2c_card_won' && fromEnvB2b.length) return fromEnvB2b;

  if (mode === 'b2c_card_won') {
    const single = parsePipedriveNumericId(Deno.env.get('PIPEDRIVE_ESHOP_LABEL_B2C_ID'));
    if (single) return [single];
  } else {
    const single = parsePipedriveNumericId(Deno.env.get('PIPEDRIVE_ESHOP_LABEL_B2B_ID'));
    if (single) return [single];
  }

  const idToName = await getPipedriveDealLabelIdToName(apiToken);
  const entries = Object.entries(idToName).map(([id, name]) => ({ id: Number(id), name: String(name) }));
  const n = (s: string) => normalizePipedriveSearchText(s).toLowerCase();

  if (mode === 'b2c_card_won') {
    const exact = entries.find((e) => n(e.name) === n('Eshop B2C') || n(e.name) === n('E-shop B2C'));
    if (exact) return [exact.id];
    const fuzzy = entries.find(
      (e) => n(e.name).includes('eshop') && n(e.name).includes('b2c') && !n(e.name).includes('b2b'),
    );
    if (fuzzy) {
      console.log(`[Pipedrive eshop] label B2C: „${fuzzy.name}“ → id=${fuzzy.id}`);
      return [fuzzy.id];
    }
  } else {
    const ids: number[] = [];
    const school = entries.find(
      (e) => (n(e.name).includes('skol') || n(e.name).includes('school')) && n(e.name).includes('b2b'),
    );
    const eshopB2b = entries.find(
      (e) => n(e.name).includes('eshop') && n(e.name).includes('b2b') && !n(e.name).includes('skol'),
    );
    if (school) {
      ids.push(school.id);
      console.log(`[Pipedrive eshop] label B2B škola: „${school.name}“ → id=${school.id}`);
    }
    if (eshopB2b) {
      ids.push(eshopB2b.id);
      console.log(`[Pipedrive eshop] label B2B eshop: „${eshopB2b.name}“ → id=${eshopB2b.id}`);
    }
    if (ids.length) return ids;
    const fuzzy = entries.find((e) => n(e.name).includes('b2b') && n(e.name).includes('eshop'));
    if (fuzzy) {
      console.log(`[Pipedrive eshop] label B2B (fallback): „${fuzzy.name}“ → id=${fuzzy.id}`);
      return [fuzzy.id];
    }
  }

  if (mode === 'b2c_card_won') {
    console.log(`[Pipedrive eshop] label B2C výchozí id=${PIPEDRIVE_ESHOP_LABEL_ID_B2C_DEFAULT}`);
    return [PIPEDRIVE_ESHOP_LABEL_ID_B2C_DEFAULT];
  }
  console.log(`[Pipedrive eshop] label B2B výchozí id=${PIPEDRIVE_ESHOP_LABEL_ID_B2B_DEFAULT}`);
  return [PIPEDRIVE_ESHOP_LABEL_ID_B2B_DEFAULT];
}

/** Custom pole (např. Source) = PRINT — option id z env nebo vyhledání volby PRINT v /dealFields. */
async function resolveEshopPrintFieldPayload(apiToken: string): Promise<Record<string, unknown>> {
  const key = (Deno.env.get('PIPEDRIVE_ESHOP_PRINT_FIELD_KEY') || '').trim();
  const optId = parsePipedriveNumericId(Deno.env.get('PIPEDRIVE_ESHOP_PRINT_OPTION_ID'));
  const textVal = (Deno.env.get('PIPEDRIVE_ESHOP_PRINT_VALUE') || '').trim();

  if (key) {
    if (optId != null) {
      console.log(`[Pipedrive eshop] PRINT ${key}=${optId} (PIPEDRIVE_ESHOP_PRINT_OPTION_ID)`);
      return { [key]: optId };
    }
    if (textVal) {
      console.log(`[Pipedrive eshop] PRINT ${key}="${textVal}" (PIPEDRIVE_ESHOP_PRINT_VALUE)`);
      return { [key]: textVal };
    }
    try {
      const data = await pipedriveRequest<any>(apiToken, '/dealFields', {}, { limit: 500 });
      const fields: any[] = Array.isArray(data?.data) ? data.data : [];
      const field = fields.find((f) => String(f.key) === key);
      const opts = field?.options || [];
      const hit = opts.find((o: any) => String(o.label || '').toUpperCase().includes('PRINT'));
      if (hit?.id != null) {
        console.log(`[Pipedrive eshop] PRINT ${key}=${hit.id} (${hit.label}) z dealFields`);
        return { [key]: hit.id };
      }
    } catch (e: any) {
      console.log(`[Pipedrive eshop] PRINT resolve: ${e.message}`);
    }
    console.log(`[Pipedrive eshop] PRINT ${key}=PRINT (text fallback)`);
    return { [key]: 'PRINT' };
  }

  try {
    const data = await pipedriveRequest<any>(apiToken, '/dealFields', {}, { limit: 500 });
    const fields: any[] = Array.isArray(data?.data) ? data.data : [];
    for (const f of fields) {
      const opts = f.options || [];
      if (opts.length < 2) continue;
      const hit = opts.find((o: any) => String(o.label || '').toUpperCase().includes('PRINT'));
      if (!hit?.id) continue;
      const fname = String(f.name || '').toLowerCase();
      if (fname.includes('source') || fname.includes('zdroj') || fname.includes('print')) {
        console.log(`[Pipedrive eshop] PRINT auto: ${f.key} (${f.name}) → ${hit.id}`);
        return { [String(f.key)]: hit.id };
      }
    }
  } catch (e: any) {
    console.log(`[Pipedrive eshop] PRINT auto: ${e.message}`);
  }
  return {};
}

/**
 * Hodnota pole štítků pro POST/PUT deal — systémové `label` = vždy řetězec ID (CSV);
 * vlastní `set` (multi) = pole čísel; `enum` = jedno ID (číslo).
 * Viz Pipedrive changelog: pole label jako string.
 */
async function resolvePipedriveDealLabelPayloadValue(
  apiToken: string,
  labelFieldKey: string,
  labelIds: number[],
): Promise<unknown> {
  if (!labelIds.length) return undefined;
  const key = (labelFieldKey || 'label').trim() || 'label';

  let fieldType: string | undefined;
  try {
    const data = await pipedriveRequest<any>(apiToken, '/dealFields', {}, { limit: 500 });
    const fields: any[] = Array.isArray(data?.data) ? data.data : [];
    const f = fields.find((x) => String(x?.key) === key);
    const rawFt = f?.field_type ?? f?.type;
    if (typeof rawFt === 'string' || typeof rawFt === 'number') {
      fieldType = String(rawFt);
    }
  } catch {
    /* ignore */
  }

  if (key === 'label') {
    const s = labelIds.map(String).join(',');
    console.log(`[Pipedrive eshop] pole label (string): "${s}"`);
    return s;
  }

  if (fieldType?.toLowerCase() === 'set') {
    console.log(`[Pipedrive eshop] pole ${key} (set): [${labelIds.join(',')}]`);
    return labelIds;
  }

  if (fieldType?.toLowerCase() === 'enum') {
    console.log(`[Pipedrive eshop] pole ${key} (enum): ${labelIds[0]}`);
    return labelIds[0];
  }

  const fallback = labelIds.length === 1 ? labelIds[0] : labelIds.map(String).join(',');
  console.log(`[Pipedrive eshop] pole ${key} (fallback field_type=${fieldType ?? '?'})`);
  return fallback;
}

async function createPipedriveEshopDealAdvanced(
  apiToken: string,
  params: {
    title: string;
    personId: number;
    orgId?: number | null;
    valueHaler: number;
    pipelineId: number;
    stageId: number;
    statusPayload: Record<string, unknown>;
    labelFieldKey?: string | null;
    labelIds?: number[];
    extraPayload?: Record<string, unknown>;
  },
) {
  const payload: Record<string, any> = {
    title: params.title,
    person_id: params.personId,
    pipeline_id: params.pipelineId,
    stage_id: params.stageId,
    ...params.statusPayload,
    value: Math.max(0, Math.round(params.valueHaler / 100)),
    currency: 'CZK',
  };
  if (params.orgId) payload.org_id = params.orgId;
  const labelKey = (params.labelFieldKey || 'label').trim() || 'label';
  if (params.labelIds?.length) {
    const v = await resolvePipedriveDealLabelPayloadValue(apiToken, labelKey, params.labelIds);
    if (v !== undefined) payload[labelKey] = v;
  }
  if (params.extraPayload && Object.keys(params.extraPayload).length) {
    Object.assign(payload, params.extraPayload);
  }
  const data = await pipedriveRequest<any>(apiToken, '/deals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data?.data || null;
}

async function addPipedriveDealLineItemsFromOrder(
  apiToken: string,
  dealId: number,
  orderItems: any[],
  catalogById: Map<string, any>,
) {
  /** Cache kódu → Pipedrive product id (nebo null po neúspěchu) v rámci jednoho dealu. */
  const codeToPdId = new Map<string, number | null>();
  let ord = 0;
  for (const oi of orderItems) {
    ord += 1;
    const pid = String(oi?.product_id ?? '').trim();
    if (!pid) {
      console.log('[Pipedrive eshop] skip line: empty product_id');
      continue;
    }
    if (pid.startsWith('bundle:')) {
      /* Balíčky: zatím nepřidáváme dílčí řádky — v Pipedrivu musí být produkty s kódem; rozvinutí bundle vyžaduje definici v KV. */
      console.log(`[Pipedrive eshop] skip line: bundle rows not expanded product_id=${pid}`);
      continue;
    }
    const catalog = catalogById.get(pid);
    const rawPd = catalog?.pipedriveProductId ?? catalog?.metadata?.pipedrive_product_id ?? catalog?.metadata?.pipedriveProductId;
    let pipedriveProductId = parsePipedriveNumericId(rawPd);
    if (!pipedriveProductId) {
      pipedriveProductId = parsePipedriveNumericId(pid);
    }
    const pdCode = getPipedriveProductCodeFromCatalog(catalog);
    if (!pipedriveProductId && pdCode) {
      pipedriveProductId = await resolvePipedriveProductIdByCode(apiToken, pdCode, codeToPdId);
    }
    if (!pipedriveProductId) {
      console.log(
        `[Pipedrive eshop] skip line: no product id for product_id=${pid} code=${pdCode || '(none)'}`,
      );
      continue;
    }
    const qty = Number(oi.quantity) || 1;
    const unitHaler = Number(oi.unit_price) || 0;
    const itemPrice = Math.max(0, Math.round(unitHaler / 100));
    try {
      await pipedriveRequest(apiToken, `/deals/${dealId}/products`, {
        method: 'POST',
        body: JSON.stringify({
          product_id: pipedriveProductId,
          quantity: qty,
          item_price: itemPrice,
          order: ord,
        }),
      });
    } catch (error: any) {
      console.log(`[Pipedrive eshop] deal product ${pipedriveProductId}: ${error.message}`);
    }
  }
}

async function persistPipedriveEshopOrderState(
  sb: NonNullable<ReturnType<typeof getServiceSupabaseClient>>,
  orderId: string,
  update: {
    pipedrive_sync_status: 'pending' | 'done' | 'failed' | null;
    pipedrive_deal_id?: string | null;
    pipedrive_sync_error?: string | null;
    pipedrive_synced_at?: string | null;
  },
) {
  const payload: Record<string, unknown> = {
    pipedrive_sync_status: update.pipedrive_sync_status,
    updated_at: new Date().toISOString(),
  };
  if (update.pipedrive_deal_id !== undefined) payload.pipedrive_deal_id = update.pipedrive_deal_id;
  if (update.pipedrive_sync_error !== undefined) payload.pipedrive_sync_error = update.pipedrive_sync_error;
  if (update.pipedrive_synced_at !== undefined) payload.pipedrive_synced_at = update.pipedrive_synced_at;
  const { error } = await sb.from('orders').update(payload).eq('id', orderId);
  if (error) console.log(`[Pipedrive eshop] orders update: ${error.message}`);
}

/** PUT /deals/:id — znovu propsat štítky + PRINT u už existujícího dealu (admin „obnovit“). */
async function refreshEshopPipedriveDealFromDb(
  orderId: string,
  mode: 'b2c_card_won' | 'b2b_card_won' | 'b2b_transfer_open',
): Promise<Record<string, unknown>> {
  const apiToken = getPipedriveApiToken();
  const sb = getServiceSupabaseClient();

  const fail = async (reason: string, detail?: string) => {
    const msg = detail ? `${reason}: ${detail}` : reason;
    if (sb) {
      await persistPipedriveEshopOrderState(sb, orderId, {
        pipedrive_sync_status: 'failed',
        pipedrive_sync_error: msg.slice(0, 2000),
        pipedrive_synced_at: null,
      });
    }
    return { skipped: true, reason, detail };
  };

  if (!apiToken) return await fail('missing_api_token');
  if (!sb) return { skipped: true, reason: 'missing_supabase' };

  const { data: row, error: rowErr } = await sb
    .from('orders')
    .select('pipedrive_deal_id')
    .eq('id', orderId)
    .single();

  if (rowErr || !row) {
    return { skipped: true, reason: 'order_not_found', detail: rowErr?.message };
  }

  const existing = String((row as any).pipedrive_deal_id || '').trim();
  if (!existing) {
    return { skipped: true, reason: 'no_deal', detail: 'Nejdřív vytvořte deal v Pipedrive.' };
  }

  const dealIdNum = parsePipedriveNumericId(existing);
  if (!dealIdNum) {
    return await fail('invalid_deal_id', existing);
  }

  const labelFieldKey = (Deno.env.get('PIPEDRIVE_ESHOP_LABEL_FIELD_KEY') || '').trim() || 'label';
  const labelIds = await resolveEshopDealLabelIds(apiToken, mode);
  const printPayload = await resolveEshopPrintFieldPayload(apiToken);

  const patchBody: Record<string, unknown> = {};
  if (labelIds.length) {
    const v = await resolvePipedriveDealLabelPayloadValue(apiToken, labelFieldKey, labelIds);
    if (v !== undefined) patchBody[labelFieldKey] = v;
  }
  Object.assign(patchBody, printPayload);
  Object.assign(patchBody, getEshopProductCategoryPayload());
  if (mode === 'b2c_card_won' || mode === 'b2b_card_won') {
    Object.assign(patchBody, getEshopCardPaidStatusPayload());
  }

  if (!Object.keys(patchBody).length) {
    console.log('[Pipedrive eshop] refresh: žádná pole k aktualizaci');
    return { skipped: true, reason: 'nothing_to_update', detail: 'Nastavte štítky nebo PRINT (env / dealFields).' };
  }

  try {
    await pipedriveRequest(apiToken, `/deals/${dealIdNum}`, {
      method: 'PUT',
      body: JSON.stringify(patchBody),
    });
  } catch (e: any) {
    return await fail('pipedrive_put_failed', e.message);
  }

  console.log(`[Pipedrive eshop] refresh deal ${dealIdNum} OK (${Object.keys(patchBody).join(',')})`);

  const nowIso = new Date().toISOString();
  await persistPipedriveEshopOrderState(sb, orderId, {
    pipedrive_sync_status: 'done',
    pipedrive_sync_error: null,
    pipedrive_synced_at: nowIso,
  });

  return { skipped: false, dealId: String(dealIdNum), refreshed: true };
}

async function syncEshopOrderToPipedriveFromDb(
  orderId: string,
  mode: 'b2c_card_won' | 'b2b_card_won' | 'b2b_transfer_open',
): Promise<Record<string, unknown>> {
  const apiToken = getPipedriveApiToken();
  const sb = getServiceSupabaseClient();

  const fail = async (reason: string, detail?: string) => {
    const msg = detail ? `${reason}: ${detail}` : reason;
    if (sb) {
      await persistPipedriveEshopOrderState(sb, orderId, {
        pipedrive_sync_status: 'failed',
        pipedrive_sync_error: msg.slice(0, 2000),
        pipedrive_synced_at: null,
      });
    }
    return { skipped: true, reason, detail };
  };

  if (!apiToken) return await fail('missing_api_token');
  if (!sb) return { skipped: true, reason: 'missing_supabase' };

  const { data: order, error: orderError } = await sb
    .from('orders')
    .select(
      'id, order_number, total, customer_name, customer_email, customer_phone, school_name, ico, street, city, zip, pipedrive_deal_id, order_items (product_id, product_name, quantity, unit_price, total_price)',
    )
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { skipped: true, reason: 'order_not_found', detail: orderError?.message };
  }

  const existingDeal = String((order as any).pipedrive_deal_id || '').trim();
  if (existingDeal) {
    return { skipped: true, reason: 'already_synced', dealId: existingDeal };
  }

  await persistPipedriveEshopOrderState(sb, orderId, {
    pipedrive_sync_status: 'pending',
    pipedrive_sync_error: null,
  });

  const pipelineId = PIPEDRIVE_ESHOP_PIPELINE_ID;
  const stageId = PIPEDRIVE_ESHOP_STAGE_ID;
  console.log(`[Pipedrive eshop] pipeline_id=${pipelineId} stage_id=${stageId} (Eshop)`);

  const labelFieldKey = (Deno.env.get('PIPEDRIVE_ESHOP_LABEL_FIELD_KEY') || '').trim() || 'label';

  const ico = String((order as any).ico || '').trim().replace(/\s/g, '');
  const isB2b = ico.length > 0;
  const personName = String((order as any).customer_name || '').trim() || 'Zákazník';
  const email = String((order as any).customer_email || '').trim();
  const phone = String((order as any).customer_phone || '').trim();
  if (!email) return await fail('missing_email');

  let orgId: number | null = null;
  let orgLookupForTitle: { orgName: string | null } | null = null;
  if (isB2b) {
    const schoolName = String((order as any).school_name || personName).trim();
    const orgLookup = await upsertPipedriveSchoolOrganization(apiToken, {
      schoolName,
      ico,
      address: [(order as any).street, (order as any).city, (order as any).zip].filter(Boolean).join(', '),
    });
    orgId = orgLookup.orgId;
    orgLookupForTitle = orgLookup;
    if (!orgId) return await fail('missing_org');
  }

  let person: any = null;
  if (mode === 'b2c_card_won' || !isB2b) {
    person = await findOrCreatePipedrivePersonForEshopB2c(apiToken, { name: personName, email, phone }).catch((e: any) => {
      console.log(`[Pipedrive eshop] person B2C: ${e.message}`);
      return null;
    });
  } else {
    person = await findOrCreatePipedrivePerson(apiToken, {
      orgId: orgId!,
      name: personName,
      email,
      phone,
    }).catch((e: any) => {
      console.log(`[Pipedrive eshop] person B2B: ${e.message}`);
      return null;
    });
  }

  const personId = parsePipedriveNumericId(person?.id);
  if (!personId) return await fail('missing_person');

  const status: 'open' | 'won' =
    mode === 'b2c_card_won' || mode === 'b2b_card_won' ? 'won' : 'open';

  const orderNumber = String((order as any).order_number || '');
  const schoolNameOnly = String((order as any).school_name || '').trim();
  const title =
    mode === 'b2c_card_won'
      ? `${personName} + e-shop B2C`
      : (() => {
          const fromOrg = String(orgLookupForTitle?.orgName || '').trim();
          const base = fromOrg || schoolNameOnly;
          return base ? `${base} + e-shop B2B` : `E-shop B2B — ${orderNumber}`;
        })();

  const statusPayload = await resolveDealStatusPayloadFromFields(apiToken, status);
  const labelIds = await resolveEshopDealLabelIds(apiToken, mode);
  const printPayload = await resolveEshopPrintFieldPayload(apiToken);
  const productCategoryPayload = getEshopProductCategoryPayload();
  const extraPayload: Record<string, unknown> = { ...printPayload, ...productCategoryPayload };
  if (mode === 'b2c_card_won' || mode === 'b2b_card_won') {
    Object.assign(extraPayload, getEshopCardPaidStatusPayload());
    console.log('[Pipedrive eshop] custom paid status (won card order) nastaveno na Zaplaceno');
  }
  if (labelIds.length) {
    console.log(`[Pipedrive eshop] deal labels (${mode}): ${labelIds.join(',')}`);
  }

  const deal = await createPipedriveEshopDealAdvanced(apiToken, {
    title,
    personId,
    orgId: isB2b ? orgId : null,
    valueHaler: Number((order as any).total) || 0,
    pipelineId,
    stageId,
    statusPayload,
    labelFieldKey,
    labelIds: labelIds.length ? labelIds : undefined,
    extraPayload: Object.keys(extraPayload).length ? extraPayload : undefined,
  });

  const dealId = parsePipedriveNumericId(deal?.id);
  if (!dealId) return await fail('missing_deal');

  const catalogProducts = await getAllProducts();
  const catalogMap = new Map(catalogProducts.map((p: any) => [String(p.id), p]));
  const lineItems = Array.isArray((order as any).order_items) ? (order as any).order_items : [];
  if (lineItems.length) {
    await addPipedriveDealLineItemsFromOrder(apiToken, dealId, lineItems, catalogMap);
  }

  const dealIdStr = String(dealId);
  const nowIso = new Date().toISOString();
  await persistPipedriveEshopOrderState(sb, orderId, {
    pipedrive_sync_status: 'done',
    pipedrive_deal_id: dealIdStr,
    pipedrive_sync_error: null,
    pipedrive_synced_at: nowIso,
  });

  return {
    skipped: false,
    dealId: dealIdStr,
    personId,
    orgId,
    mode,
  };
}

function buildSchoolOrderDealTitle(schoolName: string, orderId: string) {
  return `Školní objednávka ${schoolName} (${orderId.slice(-8)})`;
}

function normalizeSchoolInquiryStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
}

function schoolInquiryTypeLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    digital: 'Digitální licence',
    print: 'Tiskoviny',
    tisk: 'Tiskoviny',
    tiskoviny: 'Tiskoviny',
    interactive: 'Interaktivní licence',
    combined: 'Kombinace (tisk + digitál)',
    mixed: 'Kombinace',
    workbook: 'Pracovní sešity',
    workbooks: 'Pracovní sešity',
    bundle: 'Balíček',
    school: 'Školní licence',
    parent: 'Rodičovská licence',
  };
  return map[key] || raw;
}

function formatCzechLicenceYears(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n === 1) return '1 rok';
  if (n >= 2 && n <= 4) return `${n} roky`;
  return `${n} let`;
}

/**
 * Čitelné shrnutí z těla school_inquiry (subjects, types, digital, workbooks, …) pro poznámku v Pipedrivu.
 */
function formatSchoolInquiryMetadataHtml(body: Record<string, unknown> | null | undefined): string {
  if (!body || typeof body !== 'object') return '';

  const customer = body.customer && typeof body.customer === 'object'
    ? (body.customer as Record<string, unknown>)
    : null;
  const ico = String(body.ico ?? customer?.ico ?? customer?.vat ?? '').trim();
  const position = String(body.position ?? customer?.position ?? '').trim();

  const subjectsTop = normalizeSchoolInquiryStringArray(body.subjects);
  const typesRaw = normalizeSchoolInquiryStringArray(body.types);
  const typesHuman = typesRaw.map(schoolInquiryTypeLabel);

  const digital = body.digital && typeof body.digital === 'object' && body.digital !== null
    ? (body.digital as Record<string, unknown>)
    : null;
  const digitalSubjects = digital ? normalizeSchoolInquiryStringArray(digital.subjects) : [];
  const allSubjects = [...new Set([...subjectsTop, ...digitalSubjects])];

  const rows: Array<{ label: string; value: string }> = [];

  if (typesHuman.length) {
    rows.push({ label: 'Typ licence / objednávky', value: typesHuman.join(', ') });
  }
  if (allSubjects.length) {
    rows.push({ label: 'Předměty', value: allSubjects.join(', ') });
  }

  if (digital) {
    const s2 = Number(digital.students2);
    const s1 = Number(digital.students1);
    const pupilParts: string[] = [];
    if (Number.isFinite(s2) && s2 > 0) pupilParts.push(`2. stupeň: ${s2} žáků`);
    if (Number.isFinite(s1) && s1 > 0) pupilParts.push(`1. stupeň: ${s1} žáků`);
    if (pupilParts.length) {
      rows.push({ label: 'Počet žáků', value: pupilParts.join(' · ') });
    }
    const years = Number(digital.licYears);
    const yearsStr = formatCzechLicenceYears(years);
    if (yearsStr) {
      rows.push({ label: 'Délka licence', value: yearsStr });
    }
    const scopeNote = String(digital.scopeNote ?? '').trim();
    if (scopeNote) {
      rows.push({ label: 'Poznámka k rozsahu (digitál)', value: scopeNote });
    }
  }

  const wb = body.workbooks;
  if (wb && typeof wb === 'object' && wb !== null) {
    const w = wb as Record<string, unknown>;
    const items = Array.isArray(w.items) ? w.items : [];
    if (items.length) {
      const lines = items.map((it: unknown) => {
        const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
        const name = String(o.name ?? 'Položka').trim() || 'Položka';
        const qty = Number(o.quantity ?? o.qty) || 0;
        const price = o.price != null ? String(o.price).trim() : '';
        const bits = [`${qty} ks`];
        if (price) bits.push(price);
        return `• ${name} (${bits.join(', ')})`;
      });
      rows.push({ label: 'Pracovní sešity (workbooks)', value: lines.join('\n') });
    }
    const wbTotal = w.total != null ? String(w.total).trim() : '';
    if (wbTotal && !items.length) {
      rows.push({ label: 'Workbooks — celkem', value: wbTotal });
    }
  }

  const vb = body.vividboard;
  if (vb && typeof vb === 'object' && vb !== null) {
    const count = (vb as Record<string, unknown>).count;
    if (count != null && String(count).trim() !== '') {
      rows.push({ label: 'Vividboard', value: `${String(count).trim()} licencí` });
    }
  }

  if (ico) {
    rows.push({ label: 'IČO', value: ico });
  }
  if (position) {
    rows.push({ label: 'Pozice kontaktu', value: position });
  }

  if (!rows.length) return '';

  const summaryParts: string[] = [];
  if (typesHuman.length) summaryParts.push(typesHuman.join(', '));
  if (allSubjects.length) summaryParts.push(`předměty: ${allSubjects.join(', ')}`);
  if (digital) {
    const s2 = Number(digital.students2);
    const s1 = Number(digital.students1);
    const y = Number(digital.licYears);
    if (Number.isFinite(s2) && s2 > 0) summaryParts.push(`${s2} žáků (2. st.)`);
    if (Number.isFinite(s1) && s1 > 0) summaryParts.push(`${s1} žáků (1. st.)`);
    const ys = formatCzechLicenceYears(y);
    if (ys) summaryParts.push(ys);
  }

  const summaryLine = summaryParts.length
    ? `<p style="margin:0 0 12px;padding:10px 12px;background:#f1f5f9;border-radius:8px;font-size:14px;line-height:1.45;"><strong>Shrnutí:</strong> ${escapePipedriveHtml(summaryParts.join(' · '))}</p>`
    : '';

  const dl = rows
    .map(
      (r) =>
        `<div style="display:grid;grid-template-columns:minmax(120px,200px) 1fr;gap:6px 16px;margin:6px 0;align-items:start;"><dt style="margin:0;font-weight:700;color:#334155;">${escapePipedriveHtml(r.label)}</dt><dd style="margin:0;white-space:pre-wrap;color:#0f172a;">${escapePipedriveHtml(r.value)}</dd></div>`,
    )
    .join('');

  return [
    `<h4 style="margin:16px 0 8px;">Co si škola objednala</h4>`,
    summaryLine,
    `<dl style="margin:0;padding:0;">${dl}</dl>`,
  ].join('');
}

function buildSchoolOrderNoteContent(
  order: {
    id: string;
    schoolName: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    items: { name: string; qty: number; price: string }[];
    totalPrice: string | number;
    note: string;
  },
  inquiryBody?: Record<string, unknown> | null,
) {
  const itemLines = order.items.length
    ? `<ul>${order.items
        .filter((item) => item.qty > 0 || item.name)
        .map((item) => `<li><strong>${escapePipedriveHtml(String(item.name || '').trim() || 'Položka')}</strong>: ${item.qty} ks, ${escapePipedriveHtml(String(item.price || '').trim() || 'cena neuvedena')}</li>`)
        .join('')}</ul>`
    : '<p>Bez položek.</p>';

  const formattedMeta = formatSchoolInquiryMetadataHtml(inquiryBody ?? null);
  const rawMetaFallback =
    !formattedMeta && order.note
      ? `<h4>Metadata (raw)</h4><pre style="font-size:12px;white-space:pre-wrap;">${escapePipedriveHtml(String(order.note).slice(0, 12000))}</pre>`
      : '';

  return [
    `<h3>Školní objednávka z webu</h3>`,
    `<p><strong>ID objednávky:</strong> ${escapePipedriveHtml(order.id)}</p>`,
    `<p><strong>Škola:</strong> ${escapePipedriveHtml(order.schoolName)}</p>`,
    `<p><strong>Kontakt:</strong> ${escapePipedriveHtml(order.contactName)}</p>`,
    `<p><strong>Email:</strong> ${escapePipedriveHtml(order.email)}</p>`,
    `<p><strong>Telefon:</strong> ${escapePipedriveHtml(order.phone || 'neuveden')}</p>`,
    `<p><strong>Adresa:</strong> ${escapePipedriveHtml(order.address || 'neuvedena')}</p>`,
    formattedMeta || '',
    `<p><strong>Celkem:</strong> ${escapePipedriveHtml(String(order.totalPrice || 'neuvedeno'))}</p>`,
    `<h4>Položky</h4>`,
    itemLines,
    rawMetaFallback,
  ]
    .filter(Boolean)
    .join('');
}

async function createPipedriveSchoolOrderDeal(
  apiToken: string,
  params: {
    title: string;
    orgId: number;
    personId?: number | null;
    ownerUserId: number | null;
    value?: number | null;
    currency?: string;
    pipelineId: number;
    stageId: number;
    orderFormExtra: Record<string, unknown> | null;
  },
) {
  const payload: Record<string, any> = {
    title: params.title,
    org_id: params.orgId,
    pipeline_id: params.pipelineId,
    stage_id: params.stageId,
  };
  if (params.ownerUserId != null && params.ownerUserId > 0) {
    payload.user_id = params.ownerUserId;
  }
  if (params.personId) payload.person_id = params.personId;
  if (params.value != null && Number.isFinite(params.value)) payload.value = params.value;
  if (params.currency) payload.currency = params.currency;
  if (params.orderFormExtra && Object.keys(params.orderFormExtra).length) {
    Object.assign(payload, params.orderFormExtra);
  }
  const data = await pipedriveRequest<any>(apiToken, '/deals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data?.data || null;
}

async function syncSchoolOrderToPipedrive(
  order: {
    id: string;
    schoolName: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    items: { name: string; qty: number; price: string }[];
    note: string;
    totalPrice: string | number;
  },
  body: Record<string, any>,
) {
  const apiToken = getPipedriveApiToken();
  if (!apiToken) return { skipped: true, reason: 'missing_api_token' as const };

  const ico = String(body?.customer?.ico || body?.customer?.vat || '').trim();
  const orgLookup = await upsertPipedriveSchoolOrganization(apiToken, {
    schoolName: order.schoolName,
    ico,
    address: order.address,
  });
  if (!orgLookup.orgId) return { skipped: true, reason: 'missing_org' as const };

  const isCustomerOrg = await organizationHasCustomerLabel(apiToken, orgLookup.orgId);
  const pipelineUpsell = pipedriveEnvInt('PIPEDRIVE_SCHOOL_ORDER_PIPELINE_UPSELL_ID', 7);
  const stageUpsell = pipedriveEnvInt('PIPEDRIVE_SCHOOL_ORDER_STAGE_UPSELL_ID', 42);
  const pipelineAkvizice = pipedriveEnvInt('PIPEDRIVE_SCHOOL_ORDER_PIPELINE_AKVIZICE_ID', 6);
  const stageAkvizice = pipedriveEnvInt('PIPEDRIVE_SCHOOL_ORDER_STAGE_AKVIZICE_ID', 38);
  const pipelineId = isCustomerOrg ? pipelineUpsell : pipelineAkvizice;
  const stageId = isCustomerOrg ? stageUpsell : stageAkvizice;

  const fallbackOwnerId = pipedriveEnvInt('PIPEDRIVE_SCHOOL_ORDER_FALLBACK_OWNER_ID', 0);
  const ownerFromLookup = orgLookup.ownerUserId != null && orgLookup.ownerUserId > 0
    ? orgLookup.ownerUserId
    : null;
  const ownerUserId = ownerFromLookup ?? (fallbackOwnerId > 0 ? fallbackOwnerId : null);
  if (!ownerFromLookup && (!fallbackOwnerId || fallbackOwnerId <= 0)) {
    console.log('[Pipedrive school order] Žádný owner z CRM a PIPEDRIVE_SCHOOL_ORDER_FALLBACK_OWNER_ID není nastaveno — deal bez user_id.');
  }

  const orderFormFieldId = pipedriveEnvInt('PIPEDRIVE_SCHOOL_ORDER_FORM_LABEL_FIELD_ID', 12463);
  const orderFormOptionId = pipedriveEnvInt('PIPEDRIVE_SCHOOL_ORDER_FORM_LABEL_OPTION_ID', 48);
  const orderFormExtra = await resolveSchoolOrderDealFieldPayloadValue(apiToken, orderFormFieldId, [orderFormOptionId]);

  const person = await findOrCreatePipedrivePerson(apiToken, {
    orgId: orgLookup.orgId,
    name: order.contactName,
    email: order.email,
    phone: order.phone,
  }).catch((error: any) => {
    console.log(`[Pipedrive] Person sync error: ${error.message}`);
    return null;
  });

  const value = parsePriceNumber(order.totalPrice);
  const currency = body?.workbooks?.currency || 'CZK';

  const deal = await createPipedriveSchoolOrderDeal(apiToken, {
    title: buildSchoolOrderDealTitle(order.schoolName, order.id),
    orgId: orgLookup.orgId,
    personId: parsePipedriveNumericId(person?.id),
    ownerUserId,
    value,
    currency,
    pipelineId,
    stageId,
    orderFormExtra,
  });

  const dealId = parsePipedriveNumericId(deal?.id);
  const personId = parsePipedriveNumericId(person?.id);
  const note = await createPipedriveNote(apiToken, {
    content: buildSchoolOrderNoteContent(order, body),
    dealId,
    orgId: orgLookup.orgId,
    personId,
  });

  let activity: any = null;
  const activityAssigneeId = ownerUserId;
  if (activityAssigneeId) {
    const { todayISO } = buildTodayContextBlock();
    activity = await createPipedriveActivity(apiToken, {
      subject: `Kontaktovat školu: ${order.schoolName}`,
      userId: activityAssigneeId,
      dueDate: todayISO,
      note: `Navázat na školní objednávku ${order.id} od ${order.contactName} (${order.email}).`,
      dealId,
      orgId: orgLookup.orgId,
      personId,
      type: 'task',
    });
  }

  return {
    skipped: false,
    orgId: orgLookup.orgId,
    personId,
    dealId,
    noteId: parsePipedriveNumericId(note?.id),
    activityId: parsePipedriveNumericId(activity?.id),
    matchedBy: orgLookup.matchedBy,
    isCustomerOrg,
    pipelineId,
    stageId,
    ownerUserId,
  };
}

/* POST eshop → Pipedrive (B2C/B2B zaplaceno kartou, B2B převod OPEN) */
app.post('/make-server-93a20b6f/eshop/pipedrive-sync', async (c) => {
  try {
    const expected = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    const auth = c.req.header('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!expected || token !== expected) {
      return c.json({ error: 'Unauthorized.' }, 401);
    }
    const body = (await c.req.json()) as { orderId?: string; mode?: string; refreshOnly?: boolean };
    const orderId = String(body.orderId || '').trim();
    const mode = String(body.mode || '').trim();
    if (
      !orderId
      || !['b2c_card_won', 'b2b_card_won', 'b2b_transfer_open'].includes(mode)
    ) {
      return c.json({ error: 'Invalid orderId or mode.' }, 400);
    }
    const m = mode as 'b2c_card_won' | 'b2b_card_won' | 'b2b_transfer_open';
    const result = body.refreshOnly === true
      ? await refreshEshopPipedriveDealFromDb(orderId, m)
      : await syncEshopOrderToPipedriveFromDb(orderId, m);
    return c.json(result);
  } catch (err: any) {
    console.log(`[eshop/pipedrive-sync] ${err.message}`);
    return c.json({ error: err.message || 'sync failed' }, 500);
  }
});

/**
 * Diagnostika: seznam ID štítků dealu z GET /dealFields (jen service role).
 * GET …/admin/pipedrive-eshop-label-ids?fieldKey=label
 * Volitelně fieldKey = hash vlastního pole (set/enum).
 */
app.get('/make-server-93a20b6f/admin/pipedrive-eshop-label-ids', async (c) => {
  try {
    const expected = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    const auth = c.req.header('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!expected || token !== expected) {
      return c.json({ error: 'Unauthorized.' }, 401);
    }
    const apiToken = getPipedriveApiToken();
    if (!apiToken) {
      return c.json({ error: 'PIPEDRIVE_API_TOKEN not set in Edge secrets.' }, 500);
    }
    const fieldKey = (c.req.query('fieldKey') || 'label').trim() || 'label';
    const data = await pipedriveRequest<any>(apiToken, '/dealFields', {}, { limit: 500 });
    const fields: any[] = Array.isArray(data?.data) ? data.data : [];
    const f = fields.find((x) => String(x?.key) === fieldKey);
    if (!f) {
      return c.json(
        { error: `Pole s key="${fieldKey}" v /dealFields nenalezeno.`, knownKeys: fields.map((x) => x.key).slice(0, 80) },
        404,
      );
    }
    const opts = Array.isArray(f.options) ? f.options : [];
    const options = opts.map((o: any) => ({
      id: o.id,
      label: String(o.label ?? ''),
    }));
    const rawFt = f.field_type ?? f.type;
    const fieldType = typeof rawFt === 'string' || typeof rawFt === 'number' ? String(rawFt) : null;

    return c.json({
      fieldKey: String(f.key),
      fieldName: String(f.name ?? ''),
      fieldType,
      options,
      envExamples: {
        PIPEDRIVE_ESHOP_LABEL_IDS_B2C: 'jedno ID z options (např. Eshop B2C)',
        PIPEDRIVE_ESHOP_LABEL_IDS_B2B: 'více ID čárkou (např. škola + B2B)',
        PIPEDRIVE_ESHOP_LABEL_FIELD_KEY: fieldKey === 'label' ? '(výchozí label — můžeš vynechat)' : fieldKey,
      },
    });
  } catch (err: any) {
    console.log(`[pipedrive-eshop-label-ids] ${err.message}`);
    return c.json({ error: err.message || 'dealFields failed' }, 502);
  }
});

/* ── Orders endpoint (POST /orders) ─────────────────────────────── */
app.post('/make-server-93a20b6f/orders', async (c) => {
  const esc = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  try {
    const body = (await c.req.json()) as Record<string, any>;
    const paidViaStripe = body.paidViaStripe === true;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let schoolName: string;
    let contactName: string;
    let email: string;
    let phone: string;
    let address: string;
    let items: { name: string; qty: number; price: string }[] = [];
    let note = '';
    let totalPrice: string | number = '';
    let kind: 'school_inquiry' | 'legacy' = 'legacy';

    if (body.customer && typeof body.customer === 'object') {
      kind = 'school_inquiry';
      const cu = body.customer as Record<string, string>;
      schoolName = String(cu.schoolName || '').trim();
      contactName = String(cu.name || cu.fullName || '').trim();
      email = String(cu.email || '').trim();
      phone = String(cu.phone || '').trim();
      address = String(cu.address || '').trim();

      if (!email || !contactName || !schoolName) {
        return c.json({ error: 'Chybí povinné údaje školy nebo kontaktu.' }, 400);
      }

      const wb = body.workbooks;
      if (wb?.items?.length) {
        items = wb.items.map((it: any) => ({
          name: String(it.name || ''),
          qty: Number(it.quantity) || 0,
          price: String(it.price || ''),
        }));
        totalPrice = wb.total != null ? String(wb.total) : '';
      } else if (Array.isArray(body.items)) {
        items = body.items.map((it: any) => ({
          name: String(it.name || ''),
          qty: Number(it.quantity ?? it.qty) || 1,
          price: String(it.price || ''),
        }));
      }

      note = JSON.stringify(
        {
          subjects: body.subjects,
          types: body.types,
          digital: body.digital,
          vividboard: body.vividboard,
          workbooks: body.workbooks,
          ico: cu.ico || cu.vat,
          position: cu.position,
        },
        null,
        2,
      ).slice(0, 12000);
    } else {
      const {
        schoolName: sn,
        contactName: cn,
        email: em,
        phone: ph,
        address: ad,
        items: it,
        note: nt,
        totalPrice: tp,
      } = body;
      schoolName = String(sn || '').trim();
      contactName = String(cn || '').trim();
      email = String(em || '').trim();
      phone = String(ph || '').trim();
      address = String(ad || '').trim();
      note = String(nt || '');
      totalPrice = tp || '';

      if (!email || !contactName || !schoolName) {
        return c.json({ error: 'Chybi povinne pole: email, contactName nebo schoolName' }, 400);
      }

      items = Array.isArray(it)
        ? it.map((x: any) => ({
            name: String(x.name || ''),
            qty: Number(x.qty ?? x.quantity) || 1,
            price: String(x.price || ''),
          }))
        : [];
    }

    const emailDeliverable = await assertEmailDeliverable(email);
    if (!emailDeliverable.ok) {
      return c.json({ error: emailDeliverable.message }, 400);
    }

    const order = {
      id: orderId,
      kind,
      schoolName,
      contactName,
      email,
      phone,
      address,
      items,
      note,
      totalPrice,
      status: 'nova',
      createdAt: new Date().toISOString(),
      ...(kind === 'school_inquiry' ? { payload: body } : {}),
    };

    await kv.set(`order_${orderId}`, order);

    const ordersList = ((await kv.get('vividbooks_orders_list_v1')) as string[] | null) ?? [];
    await kv.set('vividbooks_orders_list_v1', [...ordersList, orderId]);

    console.log(`[Orders] Nova objednavka (${kind}): ${orderId} od ${email}`);

    let pipedriveResult: Record<string, any> | null = null;
    if (kind === 'school_inquiry') {
      try {
        pipedriveResult = await syncSchoolOrderToPipedrive(order, body);
        console.log(`[Orders] Pipedrive sync hotov pro ${orderId}: ${JSON.stringify(pipedriveResult)}`);
      } catch (pipedriveErr: any) {
        console.log(`[Orders] Pipedrive sync chyba (neblokuje): ${pipedriveErr.message}`);
      }
    }

    const mandrillKey = Deno.env.get('MANDRILL_API_KEY');
    if (mandrillKey && email && !paidViaStripe) {
      try {
        const itemsHtml = items
          .filter((it) => it.qty > 0 || it.name)
          .map(
            (it) =>
              `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${esc(it.name)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${it.qty} ks</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">${esc(String(it.price))}</td></tr>`,
          )
          .join('');

        const dig = body.digital;
        const digitalBlock =
          dig && typeof dig === 'object'
            ? `<p style="color:#92400e;font-size:14px;margin:0 0 12px;padding:12px;background:#fef9c3;border-radius:12px;"><strong>Digitální licence:</strong> 2. st. žáků: ${esc(String(dig.students2 ?? ''))}, 1. st.: ${esc(String(dig.students1 ?? ''))}, délka: ${esc(String(dig.licYears ?? ''))} r.<br/><span style="white-space:pre-wrap;">${esc(String(dig.scopeNote || ''))}</span></p>`
            : '';

        const vb = body.vividboard;
        const vividBlock =
          vb && typeof vb === 'object'
            ? `<p style="color:#991b1b;font-size:14px;margin:0 0 12px;"><strong>Vividboard:</strong> ${esc(String(vb.count ?? ''))} licence</p>`
            : '';

        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0f2f8;padding:32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">
<tr><td style="background:#001161;border-radius:16px 16px 0 0;padding:32px 40px;">
<span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Vividbooks</span>
<span style="color:rgba(255,255,255,0.45);font-size:13px;display:block;margin-top:4px;">Potvrzení poptávky</span>
</td></tr>
<tr><td style="background:#fff;padding:32px 40px;">
<h2 style="margin:0 0 8px;color:#001161;font-size:20px;">Děkujeme za poptávku!</h2>
<p style="color:#64748b;font-size:14px;margin:0 0 24px;">Vaše zpráva č. <strong>${esc(orderId.slice(-8))}</strong> byla přijata. Brzy vás kontaktujeme.</p>
<p style="color:#001161;font-size:14px;margin:0 0 4px;"><strong>Škola:</strong> ${esc(schoolName)}</p>
<p style="color:#001161;font-size:14px;margin:0 0 20px;"><strong>Kontakt:</strong> ${esc(contactName)}, ${esc(email)}</p>
${digitalBlock}
${vividBlock}
${items.length ? `<table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
<thead><tr style="background:#f8f9fc;">
<th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;">Produkt</th>
<th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;">Ks</th>
<th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;">Cena</th>
</tr></thead><tbody>${itemsHtml}</tbody></table>` : ''}
${totalPrice ? `<p style="font-size:15px;font-weight:800;color:#001161;text-align:right;">Celkem (orientačně): ${esc(String(totalPrice))}</p>` : ''}
</td></tr>
<tr><td style="background:#f8f9fc;padding:20px 40px;border-radius:0 0 16px 16px;">
<p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Vividbooks</p>
</td></tr>
</table></body></html>`;

        await fetch('https://mandrillapp.com/api/1.0/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: mandrillKey,
            message: {
              html: emailHtml,
              subject: `Potvrzení poptávky — Vividbooks`,
              from_email: 'webinare@vividbooks.com',
              from_name: 'Vividbooks',
              to: [{ email, name: contactName, type: 'to' }],
            },
          }),
        });
        console.log(`[Orders] Potvrzovaci email odeslan: ${email}`);
      } catch (mailErr: any) {
        console.log(`[Orders] Mandrill chyba (neblokuje): ${mailErr.message}`);
      }
    }

    return c.json({ success: true, orderId, pipedrive: pipedriveResult });
  } catch (err: any) {
    console.log(`[Orders] Chyba: ${err.message}`);
    return c.json({ error: `Chyba zpracovani objednavky: ${err.message}` }, 500);
  }
});

// ── Feedback & Learn & Slack endpoints ───────────────────────────────────

const FB_PFX  = 'rag_feedback_v1_';

/* POST /rag/feedback */
app.post('/make-server-93a20b6f/rag/feedback', async (c) => {
  try {
    const { text, author = 'admin', channel = 'chat', type = 'feedback' } = await c.req.json();
    if (!text?.trim()) return c.json({ error: 'Chybi text' }, 400);
    const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await kv.set(`${FB_PFX}${id}`, { id, text: text.trim(), author, channel, type, createdAt: new Date().toISOString() });
    console.log(`[RAG feedback] Ulozeno id=${id} od ${author}`);
    return c.json({ success: true, id });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

/* GET /rag/feedback-list */
app.get('/make-server-93a20b6f/rag/feedback-list', async (c) => {
  try {
    const items = await kv.getByPrefix(FB_PFX);
    const sorted = (items as any[]).filter(Boolean).sort((a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return c.json({ items: sorted, total: sorted.length });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

/* POST /rag/learn — rychlé zaindexování faktu */
app.post('/make-server-93a20b6f/rag/learn', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);
    const { text, title = 'Nauceny fakt', author = 'admin' } = await c.req.json();
    if (!text?.trim()) return c.json({ error: 'Chybi text' }, 400);
    const embedding = await embedText(text.trim());
    const id = `learn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await saveChunk({
      id, text: text.trim(), embedding, embeddingDims: embedding.length,
      metadata: { source: 'doc:nauces', sourceId: id, title, chunkIndex: 0, totalChunks: 1, uploadedAt: new Date().toISOString(), tokens: Math.round(text.length / 4), quality: qualityScore(text.trim()), learnedBy: author },
    });
    console.log(`[RAG learn] Zaindexovano id=${id} "${title}" od ${author}`);
    return c.json({ success: true, id, dims: embedding.length });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

/* POST /slack/rag — Slack slash command handler */
app.post('/make-server-93a20b6f/slack/rag', async (c) => {
  try {
    const raw = await c.req.text();
    const params = new URLSearchParams(raw);
    const slashText   = params.get('text') || '';
    const responseUrl = params.get('response_url') || '';
    const userName    = params.get('user_name') || 'unknown';
    const channelName = params.get('channel_name') || '';

    // Optional signature verification
    const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET');
    if (signingSecret) {
      const ts   = c.req.header('X-Slack-Request-Timestamp') || '';
      const sig  = c.req.header('X-Slack-Signature') || '';
      const base = `v0:${ts}:${raw}`;
      const key  = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const mac  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
      const comp = 'v0=' + Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (comp !== sig) return c.json({ response_type: 'ephemeral', text: '❌ Neplatný podpis požadavku.' });
    }

    if (!slashText.trim()) {
      return c.json({ response_type: 'ephemeral', text: '💡 Použití: `/vividbooks <otázka>` nebo `/vividbooks /feedback: zpětná vazba`' });
    }

    // /feedback: command
    if (/^\/feedback:/i.test(slashText.trim())) {
      const fbText = slashText.replace(/^\/feedback:/i, '').trim();
      if (fbText) {
        const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await kv.set(`${FB_PFX}${id}`, { id, text: fbText, author: userName, channel: `slack#${channelName}`, type: 'feedback', createdAt: new Date().toISOString() });
      }
      return c.json({ response_type: 'ephemeral', text: `✅ Feedback uložen. Díky, @${userName}!` });
    }

    // /nauč se: command
    if (/^\/nau[cč][^\w]*se:/i.test(slashText.trim())) {
      const factText = slashText.replace(/^\/nau[cč][^\w]*se:/i, '').trim();
      if (!factText) return c.json({ response_type: 'ephemeral', text: '⚠️ Zadej text po `/nauč se:`' });
      const ak2 = Deno.env.get('GEMINI_API_KEY_RAG');
      if (ak2) {
        const emb2 = await embedText(factText);
        const id2 = `learn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await saveChunk({ id: id2, text: factText, embedding: emb2, embeddingDims: emb2.length, metadata: { source: 'doc:nauces', sourceId: id2, title: `Slack: ${factText.slice(0, 40)}`, chunkIndex: 0, totalChunks: 1, uploadedAt: new Date().toISOString(), tokens: Math.round(factText.length / 4), quality: qualityScore(factText), learnedBy: userName } });
      }
      return c.json({ response_type: 'ephemeral', text: `🧠 Fakt zaindexován! Použiji v dalších odpovědích.` });
    }

    // RAG dotaz — async response_url
    const bgRag = async () => {
      try {
        const ak3 = Deno.env.get('GEMINI_API_KEY_RAG');
        if (!ak3 || !responseUrl) return;
        const qVec = await embedText(slashText);
        const allCh = await loadAllChunks();
        const top5 = allCh.filter((ch: any) => ch.embedding?.length).map((ch: any) => ({ ...ch, score: cosineSim(qVec, ch.embedding) })).sort((a: any, b: any) => b.score - a.score).slice(0, 5);
        const ctx = top5.map((ch: any, i: number) => `[${i+1}] (${ch.metadata?.source}, ${ch.metadata?.title})\n${ch.text}`).join('\n\n---\n\n');
        const prompt = `Jsi pomocny asistent Vividbooks. Odpovez cesky na zaklade kontextu.\n\nKONTEXT:\n${ctx}\n\nOTAZKA: ${slashText}\n\nODPOVED:`;
        const ans = await _ragGenerate(prompt, ak3, 'gemini-3-flash-preview');
        const srcs = [...new Set(top5.slice(0, 3).map((ch: any) => ch.metadata?.title || ch.metadata?.source).filter(Boolean))];
        const srcLine = srcs.length ? `\n📚 _${srcs.join(', ')}_` : '';
        await fetch(responseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response_type: 'in_channel', text: `*❓ @${userName}:* ${slashText}\n\n${ans}${srcLine}\n\n_— Vividbooks RAG_` }) });
      } catch (e2: any) {
        if (responseUrl) await fetch(responseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response_type: 'ephemeral', text: `❌ Chyba: ${e2.message}` }) });
      }
    };

    try { (globalThis as any).EdgeRuntime?.waitUntil(bgRag()); } catch { bgRag(); }
    return c.json({ response_type: 'in_channel', text: `⏳ *@${userName}:* ${slashText}\n_Zpracovávám…_` });
  } catch (e: any) {
    return c.json({ response_type: 'ephemeral', text: `❌ Chyba serveru: ${e.message}` });
  }
});

/* POST /slack/events — Slack Event Subscriptions handler */
app.post('/make-server-93a20b6f/slack/events', async (c) => {
  try {
    const raw = await c.req.text();
    const body = JSON.parse(raw);

    // 1) URL verification challenge (při prvním nastavení)
    if (body.type === 'url_verification') {
      return c.json({ challenge: body.challenge });
    }

    // 2) Ověření podpisu (volitelné)
    const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET');
    if (signingSecret) {
      const ts  = c.req.header('X-Slack-Request-Timestamp') || '';
      const sig = c.req.header('X-Slack-Signature') || '';
      const base = `v0:${ts}:${raw}`;
      const key  = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const mac  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
      const comp = 'v0=' + Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (comp !== sig) return c.text('Unauthorized', 401);
    }

    const event = body.event;

    // 3) Ignoruj boty a nechtěné eventy
    if (!event || event.type !== 'message' || event.bot_id || event.subtype) {
      return c.text('ok');
    }

    const text     = (event.text || '').trim();
    const channel  = event.channel || '';
    const userName = event.user || 'unknown';

    if (!text) return c.text('ok');

    const botToken = Deno.env.get('SLACK_BOT_TOKEN');
    if (!botToken) return c.text('ok');

    // Pomocná funkce pro odeslání zprávy do kanálu + logování odpovědi
    const postMessage = async (msg: string) => {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${botToken}` },
        body: JSON.stringify({ channel, text: msg })
      });
      const json = await res.json();
      if (!json.ok) console.log('[slack/events] postMessage error:', JSON.stringify(json));
      else console.log('[slack/events] postMessage ok, ts:', json.ts);
      return json;
    };

    console.log(`[slack/events] message from user=${userName} channel=${channel} text="${text}"`);

    // 4) /feedback: příkaz
    if (/^\/feedback:/i.test(text)) {
      const fbText = text.replace(/^\/feedback:/i, '').trim();
      if (fbText) {
        const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await kv.set(`${FB_PFX}${id}`, { id, text: fbText, author: userName, channel: `slack_event#${channel}`, type: 'feedback', createdAt: new Date().toISOString() });
      }
      await postMessage(`✅ Feedback uložen. Díky, <@${userName}>!`);
      return c.text('ok');
    }

    // 5) /nauč se: příkaz
    if (/^\/nau[cč][^\w]*se:/i.test(text)) {
      const factText = text.replace(/^\/nau[cč][^\w]*se:/i, '').trim();
      if (factText) {
        const ak2 = Deno.env.get('GEMINI_API_KEY_RAG');
        if (ak2) {
          const emb2 = await embedText(factText);
          const id2 = `learn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await saveChunk({ id: id2, text: factText, embedding: emb2, embeddingDims: emb2.length, metadata: { source: 'doc:nauces', sourceId: id2, title: `Slack: ${factText.slice(0, 40)}`, chunkIndex: 0, totalChunks: 1, uploadedAt: new Date().toISOString(), tokens: Math.round(factText.length / 4), quality: qualityScore(factText), learnedBy: userName } });
        }
      }
      await postMessage(`🧠 Fakt zaindexován! Použiji v dalších odpovědích.`);
      return c.text('ok');
    }

    // 6) RAG dotaz — zpracuj na pozadí, Slack dostane 200 okamžitě
    const bgRagEvent = async () => {
      try {
        const ak3 = Deno.env.get('GEMINI_API_KEY_RAG');
        if (!ak3) { console.log('[slack/events] GEMINI_API_KEY_RAG not set'); return; }
        console.log('[slack/events] starting RAG for:', text);
        await postMessage(`⏳ _Zpracovávám dotaz od <@${userName}>…_`);
        const qVec = await embedText(text);
        const allCh = await loadAllChunks();
        console.log(`[slack/events] loaded ${allCh.length} chunks`);
        const top5 = allCh
          .filter((ch: any) => ch.embedding?.length)
          .map((ch: any) => ({ ...ch, score: cosineSim(qVec, ch.embedding) }))
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 5);
        const ctx = top5.map((ch: any, i: number) => `[${i+1}] (${ch.metadata?.source}, ${ch.metadata?.title})\n${ch.text}`).join('\n\n---\n\n');
        const prompt = `Jsi pomocny asistent Vividbooks. Odpovez cesky na zaklade kontextu.\n\nKONTEXT:\n${ctx}\n\nOTAZKA: ${text}\n\nODPOVED:`;
        const ans = await _ragGenerate(prompt, ak3, 'gemini-2.0-flash');
        const srcs = [...new Set(top5.slice(0, 3).map((ch: any) => ch.metadata?.title || ch.metadata?.source).filter(Boolean))];
        const srcLine = srcs.length ? `\n📚 _${srcs.join(', ')}_` : '';
        await postMessage(`*💬 Odpověď na dotaz <@${userName}>:*\n${ans}${srcLine}\n\n_— Vividbooks RAG_`);
        console.log('[slack/events] RAG answer sent');
      } catch (e2: any) {
        console.log('[slack/events] RAG error:', e2.message);
        await postMessage(`❌ Chyba při zpracování: ${e2.message}`);
      }
    };

    // Použij waitUntil aby edge funkce počkala na dokončení
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) {
      er.waitUntil(bgRagEvent());
    } else {
      await bgRagEvent();
    }
    return c.text('ok');

  } catch (e: any) {
    console.log('Slack events error:', e.message);
    return c.text('ok');
  }
});

/* ═══════════════════════════════════════════════════════════════════
   MAILCHIMP INTEGRATION — Campaign Sync + Draft Creation
   ═══════════════════════════════════════════════════════════════════ */

const MC_CAMPAIGNS_KEY = 'vividbooks_mc_campaigns_v1';

function getMailchimpAuth() {
  const mcApiKey = Deno.env.get('MAILCHIMP_API_KEY');
  if (!mcApiKey) throw new Error('MAILCHIMP_API_KEY neni nastaven');
  const dc = mcApiKey.split('-').pop() || 'us19';
  const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
  const mcAuth = btoa(`anystring:${mcApiKey}`);
  return { mcBase, mcAuth, mcApiKey };
}

function stripHtmlForMc(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function campaignToText(campaign: any): string {
  // Compute freshness warning
  let freshnessTag = '[HISTORICKY EMAIL — POUZE PRO INSPIRACI STYLEM, NE FAKTY]';
  if (campaign.sendTime) {
    const sent = new Date(campaign.sendTime);
    const now = new Date();
    const monthsAgo = Math.round((now.getTime() - sent.getTime()) / (30 * 24 * 3600000));
    if (monthsAgo <= 2) freshnessTag = '[NEDAVNY EMAIL — relativne aktualni]';
    else if (monthsAgo <= 6) freshnessTag = '[EMAIL ${monthsAgo} mesicu stary — OVERIT aktualni data]';
    else freshnessTag = `[STARY EMAIL (${monthsAgo} mesicu) — POUZE PRO INSPIRACI STYLEM, NE FAKTY]`;
  }
  return [
    freshnessTag,
    `Email kampan: ${campaign.subject || campaign.title || ''}`,
    campaign.previewText ? `Preview: ${campaign.previewText}` : '',
    `Datum odeslani: ${campaign.sendTime || ''}`,
    `Audience: ${campaign.audienceName || ''}`,
    campaign.openRate != null ? `Open rate: ${(campaign.openRate * 100).toFixed(1)}%` : '',
    campaign.clickRate != null ? `Click rate: ${(campaign.clickRate * 100).toFixed(1)}%` : '',
    '',
    campaign.plainText || '',
  ].filter(Boolean).join('\n');
}

function vividbooksEmailTemplate(params: {
  headline: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  preheader?: string;
}): string {
  const { headline, body, ctaText, ctaUrl, preheader } = params;
  // Only add standalone CTA if the body doesn't already contain CTA buttons
  const bodyHasCta =
    body.includes('background-color:#7C3AED') ||
    body.includes('background-color: #7C3AED') ||
    body.includes('background-color:#F06632') ||
    body.includes('background-color: #F06632');
  const ctaBlock = (!bodyHasCta && ctaText && ctaUrl) ? `
    <tr><td class="vb-cta" style="padding:6px 24px 22px 24px;text-align:center;background-color:#ffffff;">
      <a href="${ctaUrl}" style="display:inline-block;background-color:#7C3AED;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:999px;text-decoration:none;">${ctaText}</a>
    </td></tr>` : '';
  const mcResponsiveStyle = `<style type="text/css">
@media only screen and (max-width: 600px) {
  .vb-shell-pad { padding: 12px 8px !important; }
  .vb-card-outer { width: 100% !important; max-width: 100% !important; }
  .vb-brand { padding: 20px 16px 10px 16px !important; }
  .vb-brand span { font-size: 22px !important; letter-spacing: 0.3px !important; }
  .vb-hero { padding: 26px 18px 24px 18px !important; }
  .vb-hero h1 { font-size: 22px !important; line-height: 1.28 !important; }
  .vb-bodycell { padding: 18px 18px 24px 18px !important; font-size: 17px !important; line-height: 1.65 !important; }
  .vb-cta { padding: 4px 16px 20px 16px !important; }
  .vb-cta a { font-size: 17px !important; padding: 16px 28px !important; line-height: 1.2 !important; }
  .vb-foot { padding: 22px 18px !important; }
  .vb-foot p { font-size: 13px !important; }
  .vb-foot a { font-size: 13px !important; }
}
</style>`;
  /* Původní náhled AI Email Agentu: světle šedé plátno + bílá zaoblená karta, tmavě modrý hero, fialové hlavní CTA. */
  const vbCanvas = '#E8EAED';
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="format-detection" content="telephone=no"/>${mcResponsiveStyle}<title>${headline}</title>${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>` : ''}</head><body style="margin:0;padding:0;background-color:${vbCanvas};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;"><table role="presentation" class="vb-shell" width="100%" cellpadding="0" cellspacing="0" style="background-color:${vbCanvas};"><tr><td align="center" class="vb-shell-pad" style="padding:20px 10px 28px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:transparent;"><tr><td class="vb-brand" style="background-color:${vbCanvas};padding:8px 20px 14px 20px;text-align:center;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;color:#001161;letter-spacing:0.5px;">Vividbooks</span></td></tr><tr><td align="center" style="padding:0;"><table role="presentation" class="vb-card-outer" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 22px rgba(0,17,97,0.1);border:1px solid rgba(0,17,97,0.06);"><tr><td class="vb-hero" style="background-color:#001161;padding:32px 26px;text-align:center;"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;color:#ffffff;line-height:1.3;">${headline}</h1></td></tr>${ctaBlock}<tr><td class="vb-bodycell" style="padding:22px 26px 28px 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;background-color:#ffffff;">${body}</td></tr></table></td></tr><tr><td class="vb-foot" style="background-color:${vbCanvas};padding:20px 20px 8px 20px;text-align:center;"><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4b5563;">Vividbooks</p><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;"><a href="https://www.vividbooks.com" style="color:#F06632;text-decoration:underline;">www.vividbooks.com</a> &middot; <a href="https://www.vividbooks.com/vyzkousejte" style="color:#F06632;text-decoration:underline;">Vyzkoušejte zdarma</a></p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;"><a href="*|UNSUB|*" style="color:#6b7280;text-decoration:underline;">Odhlasit se z odberu</a></p></td></tr></table></td></tr></table></body></html>`;
}

/* GET /admin/mailchimp/campaigns */
app.get('/make-server-93a20b6f/admin/mailchimp/campaigns', async (c) => {
  try {
    const campaigns = await loadMailchimpCampaigns();
    const syncedAt = campaigns.reduce((latest: string | null, camp: any) => {
      const ts = camp.importedAt || null;
      return !latest || (ts && ts > latest) ? ts : latest;
    }, null);
    return c.json({ campaigns, syncedAt, total: campaigns.length });
  } catch (e: any) {
    return c.json({ error: `Mailchimp campaigns GET: ${e.message}` }, 500);
  }
});

/* POST /admin/mailchimp/sync */
app.post('/make-server-93a20b6f/admin/mailchimp/sync', async (c) => {
  try {
    const { mcBase, mcAuth } = getMailchimpAuth();
    const ragApiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    const skipRag = ['1', 'true', 'yes'].includes((c.req.query('skipRag') || '').toLowerCase());

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const sinceDate = oneYearAgo.toISOString().slice(0, 10) + 'T00:00:00Z';
    console.log(`[MC Sync] Fetching campaigns since ${sinceDate} (1 rok zpet)`);

    let allCampaigns: any[] = [];
    let offset = 0;
    const count = 100;
    let hasMore = true;
    while (hasMore) {
      const url = `${mcBase}/campaigns?since_send_time=${sinceDate}&status=sent&count=${count}&offset=${offset}&sort_field=send_time&sort_dir=DESC`;
      const res = await fetch(url, { headers: { 'Authorization': `Basic ${mcAuth}`, 'Accept': 'application/json' } });
      if (!res.ok) { const t = await res.text(); throw new Error(`MC API ${res.status}: ${t.slice(0, 300)}`); }
      const d = await res.json();
      const camps = d.campaigns || [];
      allCampaigns = allCampaigns.concat(camps);
      console.log(`[MC Sync] offset=${offset} got=${camps.length}`);
      hasMore = camps.length === count;
      offset += count;
    }
    console.log(`[MC Sync] Total: ${allCampaigns.length}`);

    const processed: any[] = [];
    let contentFetched = 0;
    for (const camp of allCampaigns) {
      let plainText = '';
      try {
        const cr = await fetch(`${mcBase}/campaigns/${camp.id}/content`, { headers: { 'Authorization': `Basic ${mcAuth}` } });
        if (cr.ok) {
          const cd = await cr.json();
          plainText = cd.plain_text || '';
          if (!plainText && cd.html) plainText = stripHtmlForMc(cd.html);
          contentFetched++;
        }
        await new Promise(r => setTimeout(r, 100));
      } catch (e: any) { console.log(`[MC Sync] content err ${camp.id}: ${e.message}`); }

      processed.push({
        id: camp.id, webId: camp.web_id,
        title: camp.settings?.title || '', subject: camp.settings?.subject_line || '',
        previewText: camp.settings?.preview_text || '',
        fromName: camp.settings?.from_name || '', replyTo: camp.settings?.reply_to || '',
        sendTime: camp.send_time || '',
        audienceId: camp.recipients?.list_id || '', audienceName: camp.recipients?.list_name || '',
        openRate: camp.report_summary?.open_rate ?? null,
        clickRate: camp.report_summary?.click_rate ?? null,
        emailsSent: camp.emails_sent || 0,
        plainText: plainText.slice(0, 5000),
        importedAt: new Date().toISOString(),
      });
    }

    await syncMailchimpCampaignDocuments(processed);
    console.log(`[MC Sync] Saved ${processed.length} campaigns to source_documents`);

    let ragIngested = 0, ragFailed = 0;
    if (ragApiKey && !skipRag) {
      const existing = await loadAllChunks();
      for (const ch of existing.filter((c2: any) => c2.metadata?.source === 'mailchimp')) {
        await removeChunk(ch.id); await new Promise(r => setTimeout(r, 20));
      }
      for (const camp of processed) {
        const rawText = campaignToText(camp);
        const chs = chunkText(rawText);
        for (let ci = 0; ci < chs.length; ci++) {
          try {
            const emb = await embedText(chs[ci]);
            if (!emb.length) { ragFailed++; continue; }
            const monthsOld = camp.sendTime ? Math.round((Date.now() - new Date(camp.sendTime).getTime()) / (30*24*3600000)) : 99;
            const freshness = monthsOld <= 2 ? 'recent' : monthsOld <= 6 ? 'aging' : 'stale';
            await saveChunk({ id: `mailchimp_${camp.id}_${ci}`, text: chs[ci], embedding: emb, embeddingDims: emb.length, metadata: { source: 'mailchimp', sourceId: camp.id, title: camp.subject || camp.title, sendTime: camp.sendTime, openRate: camp.openRate, clickRate: camp.clickRate, audienceName: camp.audienceName, freshness, monthsOld, inspectionOnly: freshness !== 'recent', chunkIndex: ci, tokens: Math.round(chs[ci].length / 4), quality: qualityScore(chs[ci]), createdAt: new Date().toISOString() } });
            ragIngested++;
            await new Promise(r => setTimeout(r, 60));
          } catch (e: any) { console.log(`[MC RAG] err: ${e.message}`); ragFailed++; }
        }
      }
    }
    if (skipRag) {
      console.log('[MC Sync] RAG ingest preskocen (skipRag=1)');
    }
    return c.json({ success: true, campaigns: processed.length, contentFetched, ragIngested, ragFailed, ragSkipped: skipRag || !ragApiKey });
  } catch (e: any) {
    console.log(`[MC Sync] Error: ${e.message}`);
    return c.json({ error: `MC sync: ${e.message}` }, 500);
  }
});

/* POST /admin/mailchimp/create-draft */
app.post('/make-server-93a20b6f/admin/mailchimp/create-draft', async (c) => {
  try {
    const { mcBase, mcAuth } = getMailchimpAuth();
    const body = await c.req.json();
    const { subject, previewText, headline, htmlBody, bodyContent, ctaText, ctaUrl, audience, fromName } = body;
    if (!subject) return c.json({ error: 'Chybi subject' }, 400);

    const newsletterAud = Deno.env.get('MAILCHIMP_AUDIENCE_NEWSLETTER');
    const noNewsletterAud = Deno.env.get('MAILCHIMP_AUDIENCE_NO_NEWSLETTER');
    const listId = audience === 'no-newsletter' ? noNewsletterAud : newsletterAud;
    if (!listId) return c.json({ error: `Audience ID pro "${audience}" neni nastaven` }, 500);

    console.log(`[MC Draft] Creating: "${subject}" -> ${audience}`);
    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'regular', recipients: { list_id: listId }, settings: { subject_line: subject, preview_text: previewText || '', from_name: fromName || 'Vividbooks', reply_to: 'hello@vividbooks.com', title: `[Draft] ${subject}` } }),
    });
    if (!createRes.ok) { const t = await createRes.text(); throw new Error(`MC create ${createRes.status}: ${t.slice(0, 300)}`); }

    const campaign = await createRes.json();
    const campaignId = campaign.id;
    const webId = campaign.web_id;

    let finalHtml = htmlBody || vividbooksEmailTemplate({
      headline: headline || subject,
      body: bodyContent || '<p>Obsah emailu</p>',
      ctaText: ctaText || 'Vyzkoušejte zdarma',
      ctaUrl: ctaUrl || 'https://www.vividbooks.com/vyzkousejte',
      preheader: previewText,
    });

    await fetch(`${mcBase}/campaigns/${campaignId}/content`, {
      method: 'PUT',
      headers: { 'Authorization': `Basic ${mcAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: finalHtml }),
    });

    const dc = (Deno.env.get('MAILCHIMP_API_KEY') || '').split('-').pop() || 'us19';
    const mailchimpUrl = `https://${dc}.admin.mailchimp.com/campaigns/edit?id=${webId}`;
    console.log(`[MC Draft] OK: ${mailchimpUrl}`);
    return c.json({ success: true, campaignId, webId, mailchimpUrl, message: `Draft "${subject}" vytvoren!` });
  } catch (e: any) {
    console.log(`[MC Draft] Error: ${e.message}`);
    return c.json({ error: `MC draft: ${e.message}` }, 500);
  }
});

/* POST /admin/mailchimp/generate-email — AI generates structured email
 * Architektura: u nového zadání nejdřív model (lite) sestaví textový brief ze stejných dat (RAG, katalog…),
 * poté hlavní model složí JSON mail (HTML). Úpravy existujícího mailu / výběr v náhledu = jedna fáze jako dřív.
 * Volitelně: body.skipBriefPhase === true vynutí přeskočení 1. kroku. */
app.post('/make-server-93a20b6f/admin/mailchimp/generate-email', async (c) => {
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!geminiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);
    const body = await c.req.json();
    const { prompt, conversationContext } = body;
    if (!prompt) return c.json({ error: 'Chybi prompt' }, 400);

    const EMAIL_GEN_MODELS: Record<'lite' | 'pro', string> = {
      lite: 'gemini-3.1-flash-lite-preview',
      pro: 'gemini-3.1-pro-preview',
    };
    /** Fallback řetěz při 503 „high demand“ na preview modelech (rotuje se dřív než dlouhé čekání na jednom ID). */
    const EMAIL_GEN_FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash'] as const;
    const geminiStatusRetryable = (status: number) =>
      status === 429 || status === 503 || status === 500 || status === 502 || status === 504;
    const m = body.model;
    const tier: 'lite' | 'pro' =
      m === 'pro' || m === EMAIL_GEN_MODELS.pro ? 'pro' : 'lite';
    const geminiModelId = EMAIL_GEN_MODELS[tier];
    /** `rag: false` z klienta — nenačítat chunky, nevolat embed (rychlejší). Výchozí zapnuto. */
    const ragEnabled = body.rag !== false;
    /** Lite nebo `fast: true` — kratší podklady (kampaně/produkty/…), nezávislé na RAG. */
    const preferFast = tier === 'lite' || body.fast === true;

    let ragCtx = '';
    let ragDebug = { indexSize: 0, chunksUsed: 0, topScore: 0, sources: [] as string[] };

    const [
      chunksRes,
      campsRes,
      productsRes,
      webinarsRes,
      blogPackRes,
    ] = await Promise.all([
      ragEnabled
        ? loadAllChunks().catch((e: any) => {
          console.log(`[MC Gen] chunks load: ${e?.message}`);
          return [];
        })
        : Promise.resolve([]),
      loadMailchimpCampaigns().catch(() => []),
      getAllProducts().catch((e: any) => {
        console.log(`[MC Gen] Products error (non-fatal): ${e?.message}`);
        return [];
      }),
      getCollection(WEBINARS_KEY).catch(() => []),
      Promise.all([getCollection(BLOG_KEY), getCollection(NOVINKY_KEY)]).catch(() => [[], []]),
    ]);

    const allCh: any[] = Array.isArray(chunksRes) ? chunksRes : [];

    if (!ragEnabled) {
      console.log('[MC Gen] RAG: vypnuto klientem');
    }
    /** Hluboký RAG text jen pro Agent 1 (brief) — krátký RAG zůstává v system promptu u skládání HTML (tokenové limity). */
    let ragCtxDeep = '';
    if (ragEnabled && allCh.length > 0) {
      try {
        ragDebug.indexSize = allCh.length;
        const embedQuery = [String(prompt || ''), String(conversationContext || '').trim().slice(0, 4000)]
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 12_000);
        const qE = await embedText(embedQuery.trim() || String(prompt || ''));
        const ranked = allCh
          .filter((ch: any) => ch.embedding?.length)
          .map((ch: any) => ({ ...ch, score: cosineSim(qE, ch.embedding) }))
          .sort((a: any, b: any) => b.score - a.score);

        const compactCap = preferFast ? 8 : 14;
        const compactSlice = preferFast ? 900 : 1400;
        const compactMinScore = preferFast ? 0.15 : 0.11;
        const topCompact = ranked.filter((ch: any) => ch.score >= compactMinScore).slice(0, compactCap);
        ragDebug.chunksUsed = topCompact.length;
        ragDebug.topScore = topCompact.length > 0 ? Math.round(topCompact[0].score * 100) : 0;
        ragDebug.sources = [...new Set(topCompact.map((ch: any) => ch.metadata?.source || 'unknown'))];
        if (topCompact.length) {
          ragCtx =
            '\n\nRAG kontext (shrnutí pro skládání HTML):\n' +
            topCompact
              .map(
                (ch: any, i: number) =>
                  `[${i + 1}] ${ch.metadata?.source}: ${ch.metadata?.title} (${Math.round(ch.score * 100)}%)\n${String(ch.text || '').slice(0, compactSlice)}`,
              )
              .join('\n---\n');
        }

        const RAG_BRIEF_MIN_SCORE = 0.08;
        const RAG_BRIEF_MAX_CHUNKS = 38;
        const RAG_BRIEF_CHARS_PER_CHUNK = 4200;
        const RAG_BRIEF_TOTAL_CAP = 160_000;
        const topDeep = ranked.filter((ch: any) => ch.score >= RAG_BRIEF_MIN_SCORE).slice(0, RAG_BRIEF_MAX_CHUNKS);
        (ragDebug as any).chunksBriefUsed = topDeep.length;
        (ragDebug as any).ragBriefTopScore = topDeep.length > 0 ? Math.round(topDeep[0].score * 100) : 0;

        if (topDeep.length) {
          const lines: string[] = [
            '\n\n## RAG — plné textové úryvky (pro Agent 1 / obsahový brief)\n',
            'Níže jsou vytažené pasáže z interní znalostní báze, seřazené podle relevance k zadání. V briefu je musíš systematicky pročíst, sloučit a rozvinout do souvislého výkladu (ne jen zkopírovat nadpisy).\n',
          ];
          let acc = 0;
          for (let i = 0; i < topDeep.length; i++) {
            const ch = topDeep[i];
            const slice = String(ch.text || '').slice(0, RAG_BRIEF_CHARS_PER_CHUNK);
            const block = `### Úryvek ${i + 1} | ${ch.metadata?.source || '?'} | ${ch.metadata?.title || 'bez názvu'} | shoda ${(ch.score * 100).toFixed(0)}%\n${slice}`;
            if (acc + block.length > RAG_BRIEF_TOTAL_CAP) break;
            acc += block.length;
            lines.push(block);
          }
          ragCtxDeep = lines.join('\n\n---\n\n');
          console.log(
            `[MC Gen] RAG brief: ${topDeep.length} chunks, ~${ragCtxDeep.length} chars; HTML prompt: ${topCompact.length} chunks`,
          );
        }
        console.log(
          `[MC Gen] RAG: ${ragDebug.chunksUsed} compact chunks from ${ragDebug.indexSize}, top: ${ragDebug.topScore}%, sources: ${ragDebug.sources.join(', ')}`,
        );
      } catch (ragErr: any) {
        console.log(`[MC Gen] RAG error (non-fatal): ${ragErr.message}`);
      }
    } else if (ragEnabled && allCh.length === 0) {
      ragDebug.indexSize = 0;
    }

    let campStats = '';
    let campStructures = '';
    try {
      const campsRaw = Array.isArray(campsRes) ? campsRes : [];
      const camps = campsRaw.slice(0, 15);
      if (camps.length) {
        const sorted = [...camps].sort((a: any, b: any) => (b.clickRate || 0) - (a.clickRate || 0));
        campStats =
          '\n\nHistoricke kampane (serazeno dle click rate, POUZE pro inspiraci stylem a subject lines — NEPOUZIVEJ konkretni fakta, ceny, data!):\n' +
          sorted
            .map((cc: any) =>
              `- "${cc.subject}" | Open: ${cc.openRate != null ? (cc.openRate * 100).toFixed(0) + '%' : '?'} | Click: ${cc.clickRate != null ? (cc.clickRate * 100).toFixed(0) + '%' : '?'} | Datum: ${cc.sendTime?.slice(0, 10) || '?'}`,
            )
            .join('\n');
        if (!preferFast) {
          const top3 = sorted.filter((cc: any) => cc.plainText?.length > 100).slice(0, 3);
          if (top3.length) {
            campStructures =
              '\n\n## Obsahova struktura top kampani (pro inspiraci SEKCEMI a LAYOUTEM):\n' +
              top3
                .map(
                  (cc: any, i: number) =>
                    `### Kampan ${i + 1}: "${cc.subject}" (Click: ${cc.clickRate ? (cc.clickRate * 100).toFixed(0) + '%' : '?'})\n${cc.plainText?.slice(0, 1500)}`,
                )
                .join('\n---\n');
          }
        }
      }
    } catch { /* ignore */ }

    let productCtx = '';
    let productCount = 0;
    let allProducts: any[] = Array.isArray(productsRes) ? productsRes : [];
    productCount = allProducts.length;
    const productSlice = preferFast ? 40 : 80;
    try {
      if (allProducts.length > productSlice) allProducts = allProducts.slice(0, productSlice);
      if (allProducts.length > 0) {
        productCtx =
          '\n\n## Aktualni produkty v katalogu Vividbooks (POUZIJ KONKRETNI NAZVY!):\n' +
          allProducts
            .map((p: any) =>
              `- **${p.name}**${p.category ? ' (' + p.category + ')' : ''}${p.price ? ' — ' + p.price : ''}${p.rocnik ? ', ' + p.rocnik + '. rocnik' : ''}${p.predmet ? ', predmet: ' + p.predmet : ''}${p.image ? ' | img: ' + p.image : ''} | url: https://www.vividbooks.com/produkt/${p.id}`,
            )
            .join('\n');
      }
      console.log(`[MC Gen] Products: ${productCount} in DB, ${allProducts.length} in prompt`);
    } catch (prodErr: any) {
      console.log(`[MC Gen] Products ctx error (non-fatal): ${(prodErr as any).message}`);
    }
    (ragDebug as any).productCount = productCount;

    let webinarCtx = '';
    let webinarCount = 0;
    const webinars = Array.isArray(webinarsRes) ? webinarsRes : [];
    const webLimit = preferFast ? 10 : 20;
    try {
      webinarCount = webinars.length;
      if (webinars.length > 0) {
        webinarCtx =
          '\n\n## Webinare Vividbooks:\n' +
          webinars
            .slice(0, webLimit)
            .map((w: any) => {
              const slug = String(w.slug || w.id || '').trim();
              const pageUrl = slug ? `https://www.vividbooks.com/webinar/${slug}` : '';
              return (
                `- **${w.title}**${w.subtitle ? ' — ' + w.subtitle : ''} | ${w.day || ''}. ${w.monthName || ''} ${w.year || ''} ${w.time || ''} | Lektor: ${w.lecturer || '?'}${w.isPast ? ' (PROBEHLO)' : ' (NADCHAZEJICI)'}${pageUrl ? ' | url: ' + pageUrl : ''}${w.coverImage ? ' | img: ' + w.coverImage : ''}`
              );
            })
            .join('\n');
      }
      console.log(`[MC Gen] Webinars: ${webinarCount} loaded`);
    } catch (webErr: any) {
      console.log(`[MC Gen] Webinars error (non-fatal): ${webErr.message}`);
    }

    let blogCtx = '';
    let blogLoaded = 0;
    try {
      const pack = Array.isArray(blogPackRes) ? blogPackRes : [[], []];
      const blogs = Array.isArray(pack[0]) ? pack[0] : [];
      const novinky = Array.isArray(pack[1]) ? pack[1] : [];
      const contentLimit = preferFast ? 8 : 15;
      const allContent = [...blogs, ...novinky].slice(0, contentLimit);
      blogLoaded = allContent.length;
      if (allContent.length > 0) {
        blogCtx =
          '\n\n## Blog a novinky Vividbooks:\n' +
          allContent
            .map((b: any) =>
              `- **${b.title}**${b.category ? ' (' + b.category + ')' : ''}${b.author ? ' — ' + b.author : ''}${b.coverImage ? ' | img: ' + b.coverImage : ''}`,
            )
            .join('\n');
      }
      console.log(`[MC Gen] Blog/Novinky: ${blogLoaded} loaded`);
    } catch (blogErr: any) {
      console.log(`[MC Gen] Blog error (non-fatal): ${blogErr.message}`);
    }

    (ragDebug as any).webinarCount = webinarCount;

    const ragForBriefBundle = ragCtxDeep.trim() ? ragCtxDeep : ragCtx;
    const bundleCtx = `${productCtx}${webinarCtx}${blogCtx}${ragForBriefBundle}${campStats}${campStructures}`;
    const convStr = String(conversationContext || '');
    const promptStr = String(prompt || '');
    const combinedDetect = `${convStr}\n${promptStr}`;
    /** Druhá fáze (HTML) sama — stejně jako dřív u úprav existujícího mailu nebo výběru v náhledu. */
    const iterationLike =
      body.skipBriefPhase === true ||
      /Úprava EXISTUJÍCÍHO|Úprava EXISTUJICIHO|Aktuální email:|Aktualni email:|bodyHtml:/i.test(combinedDetect) ||
      /režim výběru v náhledu|režim vložení u znaku|DŮLEŽITÉ — režim výběru|DŮLEŽITÉ — režim vložení/i.test(
        combinedDetect,
      );

    let contentBrief = '';
    const briefModelCandidates = [EMAIL_GEN_MODELS.lite, ...EMAIL_GEN_FALLBACK_MODELS];

    if (!iterationLike) {
      const briefSys = `Jsi obsahový stratég a redaktor pro Vividbooks — českou platformu digitálních interaktivních učebnic.
Tvým úkolem je NIKOLI psát HTML e-mail, ale vytvořit JEDEN komplexní TEXTOVÝ BRIEF v češtině pro druhého agenta, který z něj poskládá e-mail v Mailchimpu.

Důraz: Pod sekcí „RAG — plné textové úryvky“ často dostaneš MNOHO dlouhých pasáží z interní báze. Projdi je systematicky (ne jen první dva). Zpracuj je do JEDNOHO uceleného výstupu: souvislé odstavce, vysvětlení kontextu, proč to pro čtenáře důležité, propojení mezi tématy. NESMÍš vrátit jen krátký seznam 4 bodů podle uživatelské zprávy — to je málo. Uživatelův seznam je pouze osnova; skutečný obsah musí vyrůst z RAG + katalogu + webinářů.

Rozsah: Pokud celkový text v RAG úryvcích přesahuje cca 2 000 znaků, pole "contentBrief" musí mít MINIMÁLNĚ přibližně 4 000–10 000 znaků (podle bohatosti zdrojů). Když je RAG skutečně bohatý, směřuj k horní hranici. Kratší výstup je přijatelný jen tehdy, když v datech opravdu nic víc není.

Druhý agent má v HTML držet styl opravdového školního newsletteru Vividbooks (jako odeslané kampaně učitelům): **dlouhý, hodnotný text** uvnitř mailu — klidný, redakční tón, srozumitelné vysvětlení; číslované sekce jen budou‑li dávat smysl. Předávej mu **bohatý podklad v odstavcích** (ne jen 4 odrážky z uživatelské zprávy), aby mohl vygenerovat **rozvinutý dopis**, ne billboard.

Výstup: JSON s jediným polem "contentBrief" (řetězec).

Struktura briefu (logické sekce s podnadpisy v čistém textu):
- Kontext a cílová skupina
- Hlavní témata rozepsaná v **souvislých odstavcích** (ne jednovětné blurby): „dopisová“ hloubka jako u kvalitních newsletterů — úvod s kontextem, proč to čtenáře zajímá, čas akce, výzva k akci v přirozené češtině
- **Rozvinuté pasáže** pro druhého agenta: např. benefity / dárek pro účastníky (výčet faktů z dat); doprovodné produkty (minihry, aplikace); **„co od nás (můžete) očekávat“** — spolupráce s **jmenovanými** odborníky **jen pokud jsou v RAG nebo veřejných podkladech**; **horizont vydání / ročníky** z katalogu nebo RAG; **online podpora** (co umí, odkaz na návod); **zpětná vazba** (skupiny, kontakt — bez vymýšlených odkazů); **objednávky / PDF ukázky** — pokud to téma vyžaduje. Tyto bloky nemusí být vždy všechny, ale plnohodnotný mail z bohatých dat má mít **6–10 obsazených tematických celků** v briefu rozepsaných slovně.
- Produkty / webináře / akce výslovně navázané na obsah (názvy a fakta jen z přiložených dat)
- Sekce „Navrhované HTML bloky“ (povinná): jasně napiš, které typy bloků má druhý agent použít — více sekcí **(2) Text** s vlastními h2, **Blok (rámeček)** pro výčty benefitů, Produkt (vyjmenuj 1–3 konkrétní tituly z katalogu), Infografika (jen pokud jsou 3 ověřitelné statistiky z dat), Webinář — hlavní 6a / vedlejší 6b / seznam 6c (vyjmenuj přesný název webináře a datum z dat). Bez této sekce není brief kompletní.
- Sekce „Pozadí sekcí“ (doporučená, 2–4 odrážky): které části mají jít jako **plný pás** (např. #001161 webinář, #F06632 poděkování, žlutý tip), které jako **bílá karta v šedém pásu** (#E8EDF4), a u typů **(1)(2)(4)(6b)(6c)** které **pastelové karty** z „BARVY KARET“ použít (úvod #FFFBF7, text #F4F8FC, produkt #EFF6FF, …). Bez HTML — jen plán.
- Tón a návrh úvodu vs. jádra zprávy
- Sekce „Konkrétní fakta z podkladů“: tabulka nebo podnadpisy s tím, CO přesně říkají RAG úryvky o MŠMT, ročnících, aplikaci, ukázkách, webinářích (citace nebo těsné parafráze, ne jedna obecná věta)

KONKRÉTNOST (anti-vágnost):
- V briefu musí být jmenovány KONKRÉTNÍ produkty učebnic / názvy webinářů z dat, data konání a časy pokud jsou v seznamu webinářů, přesná formulace „doložka MŠMT“ jen podle toho, co je v RAG (ne právní poučka v obecnosti).
- Zakázané výplňové řádky bez vazby na data: „transformovat výuku“, „moderní vzdělávání“, „jedinečná příležitost“, vymyšlené počty („500 učitelů“, „tisíce“) pokud v podkladech nejsou. **Sociální důkaz s číslem** do briefu napiš jen tehdy, když je číslo nebo formulace ověřitelná z RAG/historie kampaní; jinak poděkování bez čísel.
- Pokud údaj v RAG není, napiš: „V RAG podkladech není doplněno: …“ — ne ho domýslet.

Pravidla:
- Nevkládej HTML značky ani tabulky
- Nic si nevymýšlej — URL, produkty a čísla jen z přiložených dat
- Citace myšlenek z RAG můžeš přeformulovat, fakta a názvy drž věrně`;

      const briefUser =
        `UŽIVATELSKÉ ZADÁNÍ:\n${promptStr}\n` +
        (convStr.trim() ? `\nKONVERZACE / DODATEČNÝ KONTEXT:\n${convStr}\n` : '') +
        `\n---\nDATA (produkty, webináře, blog, RAG, historie kampaní — pro fakta vycházej výhradně z nich):\n${bundleCtx.trim() || '(žádná extra data)'}\n`;

      const briefSchema = {
        type: 'OBJECT',
        properties: {
          contentBrief: {
            type: 'STRING',
            description:
              'Velmi obsáhlý dopisový brief (4k–10k+ znaků): více tematických celků rozepsaných odstavci (úvod, benefity, odborníci, horizont, podpora, zpětná vazba…) + Navrhované HTML bloky + Pozadí sekcí; ne krátký bullet list',
          },
        },
        required: ['contentBrief'],
      };
      const briefPayloadBase = {
        contents: [{ role: 'user', parts: [{ text: briefUser }] }],
        system_instruction: { parts: [{ text: briefSys }] },
      };
      try {
        briefModelLoop: for (const briefModelTry of briefModelCandidates) {
          let briefGenCfg: Record<string, unknown> = {
            temperature: 0.45,
            topP: 0.9,
            maxOutputTokens: 24_576,
            responseMimeType: 'application/json',
            responseSchema: briefSchema,
          };
          for (let bAttempt = 0; bAttempt < 3; bAttempt++) {
            console.log(`[MC Gen] Brief phase (1/2): model=${briefModelTry} attempt=${bAttempt + 1}`);
            const briefUrl = `https://generativelanguage.googleapis.com/v1beta/models/${briefModelTry}:generateContent?key=${geminiKey}`;
            const briefRes = await fetch(briefUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...briefPayloadBase, generationConfig: briefGenCfg }),
            });
            const briefRawText = await briefRes.text();
            if (briefRes.ok) {
              try {
                const briefJson = JSON.parse(briefRawText);
                const bParts = briefJson?.candidates?.[0]?.content?.parts ?? [];
                let bText = bParts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
                bText = bText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
                const bExtract = extractFirstJsonObject(bText);
                if (bExtract.ok && bExtract.value && typeof (bExtract.value as any).contentBrief === 'string') {
                  contentBrief = String((bExtract.value as any).contentBrief).trim();
                  console.log(`[MC Gen] Brief phase OK (${briefModelTry}): ${contentBrief.length} chars`);
                  break briefModelLoop;
                } else {
                  console.log(
                    `[MC Gen] Brief phase: parse ${!bExtract.ok ? bExtract.reason : 'no contentBrief'} — možná další model`,
                  );
                }
              } catch (parseErr: any) {
                console.log(`[MC Gen] Brief phase JSON parse: ${parseErr?.message || parseErr}`);
              }
              break;
            }
            if (
              briefRes.status === 400 &&
              briefGenCfg.responseSchema &&
              /schema|responseSchema|unknown name|invalid.*generation/i.test(briefRawText)
            ) {
              console.log('[MC Gen] Brief: 400 schema — zkouším bez responseSchema');
              delete briefGenCfg.responseSchema;
              continue;
            }
            if (geminiStatusRetryable(briefRes.status) && bAttempt < 2) {
              const waitMs = Math.min(18_000, 2000 * Math.pow(2, bAttempt));
              console.log(
                `[MC Gen] Brief ${briefModelTry} HTTP ${briefRes.status} — čekám ${waitMs}ms před opakováním`,
              );
              await new Promise((r) => setTimeout(r, waitMs));
              continue;
            }
            console.log(
              `[MC Gen] Brief ${briefModelTry} selhal (${briefRes.status}): ${briefRawText.slice(0, 200)}`,
            );
            break;
          }
        }
      } catch (briefErr: any) {
        console.log(`[MC Gen] Brief phase error: ${briefErr?.message || briefErr}`);
      }
    }

    (ragDebug as any).contentBriefUsed = Boolean(contentBrief);
    (ragDebug as any).contentBriefIterationSkipped = iterationLike;
    (ragDebug as any).contentBriefChars = contentBrief.length;

    const sysPrompt = `Jsi SENIOR e-mail marketingovy specialista a designer pro Vividbooks — ceskou platformu interaktivnich digitalnich ucebnic.
Tvym ukolem je psat prompty do Mailchimpu EXPLICITNE a FAKTICKY — jako mail od cloveka z tymu pro ucitele, ne jako letak z tlacene reklamy. Kazdy usek musi nest KONKRETNI OBSAH z briefu nebo z kontextu nize (nazvy produktu, webinare s datumy, presne formulace z RAG). Vágní slogany bez faktu jsou chyba.

ODPOVEZ VYHRADNE JEDEN JSON OBJEKT (vystupni format vynucuje API — zadny Markdown, zadne \`\`\` obaly, zadny text pred ani po objektu).
Pole: subject, previewText, headline, bodyHtml, ctaText, ctaUrl a volitelne audience, productImages (stringy s URL obalu).

═══ VÝCHOZÍ STYL — PŮVODNÍ AI EMAIL AGENT (BÍLÁ KARTA + HERO + FIALOVÉ CTA) ═══
Šablona mimo pole \`bodyHtml\` už sama obsahuje:
- **Světle šedé plátno** ~**#E8EAED** a nahoře **logo Vividbooks** (tmavě modré na šedé).
- **Bílou zaoblenou kartu** se stínem; v horní části karty **tmavě modrý hero** **#001161** s **bílým textem** = JSON pole **\`headline\`** (krátký, výrazný titulek typu „Máme doložku MŠMT!“).
- **Primární tlačítko** hned pod hero z **\`ctaText\` / \`ctaUrl\`** — **fialové #7C3AED**, bílý text, zaoblená pilulka. Stejné hlavní tlačítko do \`bodyHtml\` znovu nepřidávej, pokud šablona už stačí.

**\`bodyHtml\`** = jen obsah **uvnitř bílé karty pod tímto tlačítkem**:
- **NIKDY** neopakuj ten stejný titulek jako **\`headline\`** (žádné duplicitní \`<h1>\`); **nezačínej** typem **(1)** jako druhým herem.
- **Úvod (2) TEXT:** **2–4 souvislé odstavce** (ne jedna věta) — pozdrav např. „Dobrý den, vážení učitelé…“, kontext, hlavní sdělení, čas/registrace v přirozené větě, odkazy podtržené. **Sociální důkaz s číslem** („už X učitelů“) **jen pokud X plyne z briefu/RAG/dat** — jinak poděkování bez vymyšlených čísel.
- **Tělo mailu:** několik tematických sekcí pod **\`<h2>\`** (oranžové) podle podkladů — např. dárek/benefity (**(3)** s ikonami nebo \`<ul>\` po krátkém odstavci); další nabídka; „co od nás můžete čekat“ / spolupráce s odborníky (**jména jen z podkladů**); výhled titulů a ročníků; návod na online podpora + kontakt; zpětná vazba (skupiny — odkazy jen pokud jsou v datech); objednávky/ukázky. **Typický plný newsletter = 6–10 logických částí**; vyhni se řetězu prázdných jednovětých odstavců.
- **Rozsah textu:** při bohatém briefu směřuj k **přibližně 800–1 500 slov** čistého textu v \`bodyHtml\` (HTML značky nepočítej). Krátký útlý mail jen když uživatel výslovně chce minimum **nebo** data jsou chudá.
- **\`<h2>\`** uvnitř **#F06632** tučně; **odkazy v textu** **#F06632** podtržené; **klíčová fakta** lze **#2563EB** tučně.
- Sekundární **pill** uvnitř mailu může být **#F06632** (webinář…) — celkem **max 1–2** výrazné knoflíky včetně fialového ze šablony.

**Delší / speciální kampaně:** můžeš použít **full-width pásy** z sekce POZADÍ (B), pastelové vnitřní boxy nebo **(1)** jen pokud to není duplicita k **\`headline\`**. Výchozí ale zůstává **jeden** hlavní proud na bílé kartě, ne „sousto“ oddělených karet na šedém plátně.

═══ VIZUÁLNÍ ŠABLONA ═══
- Hlavní vizuální identita = **hero #001161 + fialové CTA + bílý obsah**; \`bodyHtml\` je **dlouhý dopis** se strukturovanými sekcemi, tabulkami **(3)** a odrážkami tam, kde to nesou informaci.

═══ POZADÍ — GLOBÁL (canvas) × SEKCE × SLOUPEC (DŮLEŽITÉ) ═══
Tři úrovně — v HTML je vždy odděluj:

**(A) Globální canvas** — Mailchimp šablona má světle šedý podklad **#E8EAED** a **jednu bílou hlavní kartu** (hero + CTA + obsah). V \`bodyHtml\` proto **nepřidávej** druhý stejný „obálkový“ layout přes celou šířku; vnitřní boxy ano.

**(B) Sekce na celou šířku obsahu** — horizontální „pás“ s vlastní barvou (celá šířka 600px řádku). Použij **vždy obal** tabulkou width="100%", bez vodorovného marginu navíc, typicky margin-bottom 16–22px:

Plná šířka + tmavě modrá (webinář / hero):
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background-color:#001161;">
  <tr><td style="padding:28px 22px;text-align:center;">
    … obsah (bílý text) …
  </td></tr>
</table>

Plná šířka + oranžová (poděkování / krátká výzva):
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background-color:#F06632;">
  <tr><td style="padding:22px 20px;text-align:center;">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#001161;font-weight:700;">Krátký text na oranžovém pásu</p>
  </td></tr>
</table>

Plná šířka + žlutý „tip“ box (#F9E000 nebo #FFEB7A — jen jeden takový blok na mail): stejný vzor jako oranžová, barva pozadí podle řádku; uvnitř tmavý text, CTA pill může být #001161.

**(C) Sloupec / vnitřní karta uvnitř širší sekce** — když má sekce šedé / modrošedé pozadí po stranách a uprostřed „list“:
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background-color:#E8EDF4;">
  <tr><td align="center" style="padding:20px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background-color:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);">
      <tr><td style="padding:24px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#333;">
        … hlavní text …
      </td></tr>
    </table>
  </td></tr>
</table>

Pravidla:
- Výchozí vzhled řeší šablona (šedé plátno + bílá karta). Uvnitř \`bodyHtml\` stačí **jemný kontrast** např. **(3)** na #FFF7ED nebo #F8FAFC; plné pásy **(B)** hlavně u **(6a)** nebo záměrné promo sekce.
- **(6a) Webinář hlavní** a **(1-alt) tmavý banner** patří jako **sekce (B)** — celá šířka (šablona už má hero — druhý tmavý pás jen pokud to dává smysl).
- Běžný **(2) Text** přímo na bílé (transparentně splyne s kartou) nebo v lehkém vnitřním boxu; struktura **(C)** jen u dlouhé pasáže.
- Obrázky: max-width 100 %; mezi sekcemi dej svislý odstup (margin), nepřilepuj.

═══ POVINNÁ SKLÁDAČKA BLOKŮ (NEDÁVAT JEN „SÁM TEXT“) ═══
- „Newsletter jako dopis“ = **hodnotný dlouhý text** + bloky. **\`headline\` je už v hero** — \`bodyHtml\` MUSÍ obsahovat MINIMÁLNĚ: **úvod ve (2) TEXT** (**2–4 odstavce**, bez typu (1)) + **nejméně jeden (3) Blok** (benefity / novinky s ikonami nebo výčtem) + **nejméně dvě další sekce (2) TEXT** s vlastním \`<h2>\` (jiná témata z briefu) + **(4)(5)(6*)** podle dat. **(1) nepoužívej** jako standardní úvod. U jednoho \`<h2>\` nesmí viset jen jedna krátká věta — sekce má mít **obsah**.
- Pokud brief nebo zadání zmiňuje konkrétní učebnice / ročníky / katalog: **povinně** použij **(4) Produkt** pro 1–3 nejrelevantnější tituly (přesné názvy a URL z „## Aktualni produkty“) **nebo** při 4+ produktech **značku data-product-collage + pole productImages**.
- Pokud v „## Webinare Vividbooks“ existuje **alespoň jeden NADCHÁZEJÍCÍ** webinář související s tématem (nebo jde o obecný newsletter k DVPP): **povinně** použij jeden z **(6a) hlavní**, **(6b) vedlejší** (s cover obrázkem z řádku „img:“ v datech) **nebo (6c) seznam** (při 2+ nadcházejících). Datum, čas, název a odkaz „url:“ ber přesně z této sekce — žádné vymyšlené termíny.
- **(3) Blok** (rámeček): použij **minimálně jednou** — 4–8 bodů (benefity, „s žáky můžete“, kroky); před blokem krátký **(2)** odstavec „proč“; dlouhé souvislé líčení nech v **(2)**.

═══ TON A PRIORITA (POVINNE) ═══
- **70–85 % slov** patří do **(2) TEXT** — víceodstavcové sekce, \`<h2>\`, odrážky \`<ul>\` uvnitř tématu, podtržené odkazy. **(3)(4)(6)** doplňují strukturu; nesmí být celý mail jen karty bez souvislého vysvětlení.
- Infografika (5) a tmavý gradient (1-alt) **max 1×** každý na mail. Rámeček (3) typicky **1×**, maximálně **2×** jen na výslovnou žádost. **(1)** a **(1-alt)** vynech, pokud už stačí šablonový hero; **(1-alt)** jen výjimečně uvnitř \`bodyHtml\`.
- V bloku **(4) Produkt**: krátký marketingový popis **2–4 věty**, zbytek hlubšího výkladu dej do **(2) TEXT** pod nebo nad kartu.
- CTA: **primární fialové** dodá šablona (**#7C3AED**); v \`bodyHtml\` max **1** další výrazná **oranžová** pill; další výzvy jako podtržené odkazy v **(2)**.
- Oddělovače max 1–2.

═══ KONKRÉTNOST — ZAKAZ VÁGNÍ COPY (POVINNÉ) ═══
- Typ (2) TEXT: kazda vetsi sekce (pod \`<h2>\`) ma mit **vic odstavcu nebo smyslupiny <ul>**; **kazdy** takovy usek musi obsahovat MINIMALNE JEDNU konkretizaci (produkt, webinář, ročník, datum, jméno odborníka **jen z podkladů**, fakt z RAG). Obecne vety bez vazby na fakta = prepis.
- NIKDY nevymyslej statistiky, pocty prihlasenych, skol, procenta, „50k+“, „500 učitelů“ ani cisla do infografiky (5), pokud nejsou v briefu nebo v seznamu produktu/webinaru/RAG — **ani pro „důvěryhodný“ tón**.
- Předmět (subject) a previewText: konkretni co a pro koho (rocnik, typ akce), ne jen emoji a prazdna nadsenost.
- Úvod v **(2) TEXT**: **2–4 odstavce** s fakty z podkladu — **bez** opakování \`headline\`; tmavý banner jen (1-alt) výjimečně.
- Pokud dostanes OBSAHOVY BRIEF z 1. kroku: NEZKRACUJ ho na marketingove slogany — prenes konkretni formulace a fakta do odstavcu v bodyHtml.

═══ TYPOLOGIE BLOKU (stejné názvy jako v editoru — forma = obsah) ═══
Každý typ má jinou HTML strukturu **i** jiný styl psaní. Při úpravě z chatu („přehoď na text / na blok / přidej webinář“) měň **obojí** — viz sekce ITERACE.

**CO DO BLOKU PATŘÍ (ANO × NE):**
- **(1) Úvodní:** **VÝCHOZOVĚ NE** — hlavní titulek je pole \`headline\` v šabloně. **(1)** jen výjimečně jako samostatná vnitřní kartička s **jiným** obsahem než \`headline\` (např. speciální oznámení). NE \`<h1>\` duplicitní k hero.
- **(2) Text:** ANO **víceodstavcové** pasáže pod \`<h2>\`, h3, \`<ul>\` výčty v rámci tématu, ilustrační obrázky, podtržené odkazy. NE zhuštěný „jen ikony“ layout (to je **(3) Blok**). NE opakovat celou produktovou kartu (to je **(4)**).
- **(3) Blok (rámeček):** ANO 3–6 zhuštěných bodů, výčet kroků, „proč se zapojit“, struktura emoji+řádek. NE dlouhé souvislé eseje — přepiš je do **(2) Text** nebo zkrát na body.
- **(4) Produkt:** ANO konkrétní název z katalogu, obrázek z řádku „img:“ v katalogu, URL z řádku „url:“, krátký popis + CTA „Detail →“. NE vymyšlená cena ani produkt mimo seznam.
- **(5) Infografika:** ANO právě 3 srovnatelné faktické údaje z dat. NE vymyšlená %; NE plný souvětý text do sloupců.
- **(6) Webinář:** ANO datum/čas/název/URL z „## Webinare“. Varianta **6a** = jeden sloupec jako hero na webu; **6b** = obrázek vlevo, text vpravo (třídy vb-web-split-img / vb-web-split-txt); **6c** = tabulka/seznam 2+ akcí. NE jiný termín než v datech.

**BARVY KARET / BLOKŮ (podle odeslaných mailů — střídej, přidej stín):**
- **(1) Úvodní:** barvy jako dříve (#FFFBF7 + fialový pruh) **jen výjimečně**, když (1) vůbec použiješ — výchozí úvod je (2) kvůli šablonovému hero.
- **(2) Text:** **primárně #FFFFFF** + stín; druhá/čtvrtá textová karta může **#F4F8FC** (bez „jednobarevného“ mailu).
- **(3) Blok:** zůstaň u broskvové **#FFF7ED** / rumělkové (už ve vzoru).
- **(4) Produkt:** obal celé karty do kontejneru s pozadím **#EFF6FF** (ledově modrá) a zaoblením — produktový „stripe“.
- **(5) Infografika:** sloupce mohou mít **#F1F0FD** (lehounce fialová šedá) místo šedé; čísla zůstávají #F06632.
- **(6b) Vedlejší webinář:** lehký obal **#F1F5F9** (břidlicová), padding 18–22px, border-radius 16px.
- **(6c) Seznam:** celek na jemném **#F8FAFC** s vnitřním paddingem, řádky oddělené border-bottom.

(1) ÚVODNÍ BLOK — teplá karta, fialový pruh nahoře, stín; pozdrav + text + obrázek; volitelně žlutý tip dole (DNA).
<div style="background:#FFFBF7;border-radius:20px;padding:26px 24px 0 24px;margin:0 0 20px 0;max-width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,0.06);border-top:3px solid #C4B5FD;box-shadow:0 2px 10px rgba(0,17,97,0.08);">
  <p style="color:#333;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;margin:0 0 12px 0;"><strong>Vážení učitelé,</strong></p>
  <p style="color:#333;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;margin:0 0 12px 0;">Úvodní odstavec; klíčová fakta <strong style="color:#2563EB">modře tučně</strong>.</p>
  <div style="margin:16px 0 0 0;">
    <img src="URL_OBRAZKU" alt="" style="max-width:100%;height:auto;border-radius:12px;display:block;" />
  </div>
  <div style="margin-top:20px;background:#FFF9E6;padding:16px 18px 18px 18px;border-radius:0 0 18px 18px;border-top:1px solid #F5E6B3;">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#333;font-style:italic;">Krátký doplněk s <a href="URL" style="color:#F06632;font-weight:700;text-decoration:underline;">odkazem →</a></p>
  </div>
</div>

(1-alt) POUZE VYJIMEČNĚ — tmavý „banner“ (max jednou v mailu):
<div style="background:linear-gradient(135deg,#001161 0%,#1a237e 100%);padding:36px 28px;text-align:center;border-radius:16px;margin:0 0 18px 0;max-width:100%;box-sizing:border-box;">
  <h1 style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;margin:0 0 12px 0;">HLAVNI NADPIS</h1>
  <p style="color:rgba(255,255,255,0.9);font-family:Arial,Helvetica,sans-serif;font-size:15px;margin:0;line-height:1.55;">Krátký podnadpis</p>
</div>

(2) TEXT — **bílá karta #FFFFFF** + stín (nebo střídavě #F4F8FC); více nadpisů a obrázků; h2 oranžově, odkazy oranžově podtržené:
<div style="background:#ffffff;border-radius:20px;padding:28px 26px;margin:0 0 20px 0;max-width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,0.06);box-shadow:0 2px 10px rgba(0,17,97,0.08);">
  <h2 style="color:#F06632;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;margin:0 0 10px 0;">1) Nadpis sekce</h2>
  <h3 style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;margin:16px 0 8px 0;">Podnadpis</h3>
  <p style="color:#333;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;margin:0 0 12px 0;">Odstavec s <a href="URL" style="color:#F06632;text-decoration:underline;font-weight:700;">→ odkazem v textu</a> …</p>
  <img src="URL" alt="" style="max-width:100%;height:auto;border-radius:10px;margin:14px 0;display:block;" />
</div>

(3) BLOK — ohraničený barevný rámeček; **strukturovanější než (2)** — řádky s ikonou/emoji, tučný titulek řádku, 1–2 věty. Typicky jeden až dva takové bloky na mail. Dlouhé souvislé texty sem nepatří. Pozadí např. #FFF7ED, #FEF3C7, #EFF6FF (border 1px solid rgba(240,102,50,0.15)):
<div style="background-color:#FFF7ED;padding:32px 28px;border-radius:20px;margin:0 0 18px 0;max-width:100%;box-sizing:border-box;border:1px solid rgba(240,102,50,0.15);">
  <h2 style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;margin:0 0 20px 0;">✨ Nadpis celeho bloku</h2>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
    <tr>
      <td style="padding:14px 0;vertical-align:top;width:44px;font-size:22px;">💎</td>
      <td style="padding:14px 0;vertical-align:top;">
        <strong style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:15px;display:block;margin:0 0 4px 0;">Nadpis polozky</strong>
        <p style="color:#555;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;margin:0;">Strucny popisek …</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 0;vertical-align:top;width:44px;font-size:22px;">🚀</td>
      <td style="padding:14px 0;vertical-align:top;">
        <strong style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:15px;display:block;margin:0 0 4px 0;">Druha polozka</strong>
        <p style="color:#555;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;margin:0;">…</p>
      </td>
    </tr>
  </table>
</div>

(4) PRODUKT — **foto obálky + větší popisek + CTA**: celé obal do kontejneru **#EFF6FF**; uvnitř tabulka vb-prod-img / vb-prod-txt. Max 3 plné karty; **4+** produkty = data-product-collage + productImages + seznam v (2).
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background-color:#EFF6FF;border-radius:18px;border:1px solid rgba(37,99,235,0.12);">
  <tr><td style="padding:18px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
  <tr>
    <td class="vb-prod-img" width="130" style="vertical-align:top;padding-right:20px;">
      <img src="PRODUCT_IMG_URL" alt="Nazev" style="width:120px;max-width:100%;height:auto;border-radius:12px;" />
    </td>
    <td class="vb-prod-txt" style="vertical-align:top;">
      <h3 style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:800;margin:0 0 8px 0;"><a href="PRODUCT_URL" style="color:#001161;text-decoration:none;">Nazev produktu</a></h3>
      <p style="color:#666;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;margin:0 0 12px 0;">Kratky marketingovy popis</p>
      <a href="PRODUCT_URL" style="color:#F06632;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14px;text-decoration:underline;">Detail produktu →</a>
    </td>
  </tr>
</table>
  </td></tr>
</table>

(5) INFOGRAFIKA — tri sloupce; POUZE pokud 3 srovnatelna cisla opravdu prinesou hodnotu — max JEDNA infografika na mail, jinak stejne informace radsi do obycejneho textu nebo odrázek v (2). Stejna visualni vaha sloupcu; na mobilu @media (pridej tridy vb-inf-col na kazdy <td> se sloupcem).
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;border-collapse:separate;border-spacing:10px 0;">
  <tr>
    <td class="vb-inf-col" width="33%" style="vertical-align:top;background:#F1F0FD;border-radius:14px;padding:18px 14px;text-align:center;border:1px solid #e4e0f5;">
      <div style="color:#F06632;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;line-height:1.1;">96 %</div>
      <div style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;margin:8px 0 4px 0;">Krátký nadpis</div>
      <div style="color:#666;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;">Jedna veta faktu</div>
    </td>
    <td class="vb-inf-col" width="33%" style="vertical-align:top;background:#F1F0FD;border-radius:14px;padding:18px 14px;text-align:center;border:1px solid #e4e0f5;">
      <div style="color:#F06632;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;line-height:1.1;">42</div>
      <div style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;margin:8px 0 4px 0;">Druhý fakt</div>
      <div style="color:#666;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;">Popis</div>
    </td>
    <td class="vb-inf-col" width="33%" style="vertical-align:top;background:#F1F0FD;border-radius:14px;padding:18px 14px;text-align:center;border:1px solid #e4e0f5;">
      <div style="color:#F06632;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;line-height:1.1;">15+</div>
      <div style="color:#001161;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;margin:8px 0 4px 0;">Třetí fakt</div>
      <div style="color:#666;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;">Popis</div>
    </td>
  </tr>
</table>

(6a) WEBINÁŘ — HLAVNÍ: vždy jako **sekce plné šířky** (tabulka width 100%), uvnitř buď gradient nebo #001161 — viz vzor v „POZADÍ — GLOBÁL × SEKCE × SLOUPEC“. href přesně z „url:“ u webináře v datech.
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
  <tr>
    <td style="background:linear-gradient(135deg,#001161 0%,#1a237e 100%);padding:28px 22px;text-align:center;border-radius:16px;">
      <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:rgba(255,255,255,0.92);">DVPP Webinář zdarma — 27. 1. 2026 od 18:00</p>
      <h2 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;line-height:1.25;color:#ffffff;">Název webináře</h2>
      <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:rgba(255,255,255,0.9);line-height:1.5;">Krátký podtitul / téma</p>
      <a href="WEBINAR_URL" style="display:inline-block;background-color:#F06632;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;">Registrovat se</a>
    </td>
  </tr>
</table>

(6b) WEBINÁŘ — VEDLEJŠÍ (obal #F1F5F9): 1. sloupec obrázek z „img:“ v datech, 2. sloupec text — vb-web-split-img / vb-web-split-txt.
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background-color:#F1F5F9;border-radius:16px;border:1px solid #e2e8f0;">
  <tr><td style="padding:20px 18px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
  <tr>
    <td class="vb-web-split-img" width="46%" style="vertical-align:top;padding-right:18px;">
      <img src="WEBINAR_COVER_URL" alt="" style="width:100%;max-width:260px;height:auto;border-radius:14px;display:block;" />
    </td>
    <td class="vb-web-split-txt" style="vertical-align:top;">
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#F06632;font-weight:700;">Webinář</p>
      <h3 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#001161;line-height:1.25;">Název</h3>
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444;">Datum a čas z kontextu</p>
      <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555;line-height:1.6;">1–2 věty proč přijít</p>
      <a href="WEBINAR_URL" style="color:#F06632;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14px;text-decoration:underline;">Více a registrace →</a>
    </td>
  </tr>
</table>
  </td></tr>
</table>

(6c) WEBINÁŘ — SEZNAM (2+ nadcházející): celek na **#F8FAFC**, vnitřní padding; u každé položky datum, název, link z „url:“. Pouze z „## Webinare Vividbooks“.
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background-color:#F8FAFC;border-radius:18px;border:1px solid #e5e7eb;">
  <tr><td style="padding:18px 18px 8px 18px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
  <tr><td style="padding:14px 0;border-bottom:1px solid #e2e8f0;">
    <p style="margin:0 0 4px;font-size:12px;color:#F06632;font-weight:700;">12. 2. 2026 · 18:00</p>
    <p style="margin:0;font-size:15px;font-weight:800;color:#001161;">Název webináře</p>
    <a href="URL" style="font-size:13px;color:#F06632;font-weight:700;text-decoration:underline;">Registrace →</a>
  </td></tr>
</table>
  </td></tr>
</table>

DALSÍ SYSTEMOVE ELEMENTY:
CTA PILL — hlavni akci obstarava sablona (fialova #7C3AED). V \`bodyHtml\` pouzij maximalne 1 dalsi pill, typicky oranzovou #F06632 pro webinar / sekundarni akci; dalsi vyzvy = podtrzene odkazy v odstavcich.
<div style="text-align:center;padding:20px 0;">
  <a href="URL" style="display:inline-block;background-color:#F06632;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:999px;text-decoration:none;">Sekundarni CTA</a>
</div>

CITAT / SOCIAL PROOF (volitelne jen pokud to nenaklada dalsi „reklamni“ vrstvu — neni stejny jako BLOK ramecek):
<div style="background-color:#FFF7ED;border-left:4px solid #F06632;padding:24px 28px;border-radius:0 16px 16px 0;margin:0 0 18px 0;">
  <p style="color:#333;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-style:italic;line-height:1.7;margin:0 0 8px 0;">„Citace…“</p>
  <p style="color:#F06632;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13px;margin:0;">— Jméno</p>
</div>

KOLAZ PRODUKTU (4+ produkty — pouze misto holderu, URL v productImages):
<div data-product-collage="true"></div>

ODDELOVAC:
<div style="height:2px;background:linear-gradient(90deg,transparent,#e5e7eb,transparent);margin:28px 0;"></div>

═══ PRAVIDLA STRUKTURY ═══
1. MINIMÁLNĚ **6–10 logických segmentů** v HTML u běžného nového mailu (řádkové nadpisy \`<h2>\`, bloky (2)+(3), příp. (4)(6)); **4–5 segmentů** jen při krátkém zadání nebo chudých datech. Převažuje **(2) TEXT** + **minimálně jeden (3)**. **(4)** a **(6*)** dle POVINNÉ SKLÁDAČKY. Typ (1-alt) + (5) dohromady max 2 „silné“ dekorace na mail.
2. **Pozadí:** výchozí obal je **šablona** (#E8EAED + bílá karta). \`bodyHtml\` doplňuje **vnitřní** kontrast ((3) na #FFF7ED apod.); násobné „plovoucí“ karty na šedém canvasu nejsou výchozí.
3. Webinář (6a–c): vždy obal **(2) TEXT** (proč to dává smysl) před nebo po boxu. URL/datum výhradně z „## Webinare“.
4. CTA: **1× fialová** ze šablony + nanejvýš **1×** oranžová pill v \`bodyHtml\`; zbytek odkazy v (2).
5. Oddělovač střídmě.
6. 4+ produkty: značka data-product-collage + pole productImages v JSON; 1–3 produkty: jedna nebo více tabulek (4) — popis v kartě 2–4 věty, rozšíření v (2).
7. font-family Arial všude; obrázky max-width:100%.
8. **ITERACE Z CHATU (forma = obsah):**
   - „přehoď / předělej na text“ u označeného bloku = změň HTML na **(2) TEXT**: slouč body z rámečku/infografiky do souvislejších odstavců, **rozpiš** detaily které byly ve zhuštěných bodech; odstraň tabulku rámečku nebo 3 sloupce.
   - „přehoď na blok / zhuť“ = na **(3) Blok**: z dlouhého textu vyrob 3–6 krátkých řádků (emoji + titulek + 1 věta), **zahoď** opakování a souvětí navíc.
   - „přidej pozvánku na webinář [název]“ = doplň **(6a) nebo (6b)** s přesnými datumy a href z řádku „url:“ v datech; pokud jen „přidej webináře“, použij **(6c)**.
   - „přidej produkt [název]“ nebo produktová sekce = **(4)** nebo koláž podle počtu.
   - „předělej na infografiku“ = ověřitelná čísla z textu → **(5)** (jinak infografiku necpat).
   - „dej tomu oranžový / tmavý / šedý pás“ / „odděl sekce pozadím“ = obal daný blok tabulkou **sekce (B)** nebo dej text do **sloupce (C)** se šedým pozadím a bílou vnitřní kartou podle vzoru v POZADÍ.

═══ MOBIL — POUZE @media (max-width:600px), desktop se NEMENI ═══
- U kazdeho emailu na ZACATEK bodyHtml (pred prvni vizualni blok) vloz PRESNE tento jeden styl + obal:
<style type="text/css">@media only screen and (max-width:600px){.vb-email-root p,.vb-email-root li{font-size:17px!important;line-height:1.65!important}.vb-email-root h1{font-size:26px!important}.vb-email-root h2{font-size:22px!important}.vb-email-root h3{font-size:19px!important}.vb-email-root a[style*="background-color:#F06632"],.vb-email-root a[style*="background-color: #F06632"],.vb-email-root a[style*="background-color:#7C3AED"],.vb-email-root a[style*="background-color: #7C3AED"]{font-size:17px!important;padding:16px 28px!important;display:inline-block!important}.vb-prod-img,.vb-prod-txt{display:block!important;width:100%!important}.vb-prod-img{padding:0 0 14px 0!important;text-align:center!important;padding-right:0!important}.vb-prod-img img{width:100%!important;max-width:280px!important;height:auto!important}.vb-prod-txt{padding-left:0!important}.vb-web-split-img,.vb-web-split-txt{display:block!important;width:100%!important}.vb-web-split-img{padding:0 0 16px 0!important;padding-right:0!important;text-align:center!important}.vb-web-split-img img{max-width:280px!important;width:100%!important;margin:0 auto!important}.vb-web-split-txt{padding-left:0!important}.vb-inf-col{display:block!important;width:100%!important;margin-bottom:12px!important}}</style>
<div class="vb-email-root" style="max-width:100%"> ... cely obsah ... </div>
- Produktove karty MUSI pouzit tridy vb-prod-img a vb-prod-txt (desktop zustane side-by-side; na mobilu se zlomi podle CSS vyse).
- Na sirce nad 600px se nesmi menit velikosti fontu oproti klasickemu newsletteru — upravy jen uvnitr @media.

═══ ITERATIVNI UPRAVY ═══
- "Aktualni email:" v kontextu = UPRAVIT, NE prepsat
- "pridej/doplň/přidej sekci" → zachovej existujici, PRIDEJ novou sekci (spravny TYP bloku podle zadani)
- "zmen/prepis/uprav" / zmena TYPU bloku (text ↔ ramecek ↔ infografika ↔ produkt ↔ webinar) = UPRAV HTML strukturu podle nove typologie A tomu prizpusob text (viz PRAVIDLA bod 8); zmena pozadi sekce = uprav obalkove tabulky(B)/(C)
- "od znova/vytvor znovu" → novy email
- Subject/previewText/headline zachovej pokud neni zmena

═══ PRODUKTOVE ODKAZY ═══
- Kazdy produkt: <a href="PRODUCT_URL" style="color:#F06632;font-weight:bold;text-decoration:underline;">Nazev</a> (primární nadpis produktu může zůstat #001161)
- URL z pole "url:" v katalogu
- Do "productImages" VZDY obalkove obrazky (pole "img:")
- NIKDY nevymyslej URL! Pouze ze skutecnych dat!
- Pouzij KONKRETNI nazvy z katalogu!

═══ PŘÍKLADY ŘETĚZENÍ BLOKŮ ═══

Produktový newsletter: **(2)** úvod (bez (1)) → **(2)** hlavní téma → **(3)** rámeček s body → **(4)** 1–2 produkty **nebo** koláž → **(2)** doplnění → případně **(6b)** pokud sedí webinář (CTA už v šabloně)

Webinářový newsletter: **(2)** úvod → **(2)** proč přijít → **(6a) nebo (6b)** → **(2)** další info → **(6c)** pokud je více termínů

Obecný newsletter (novinky): **(2)** úvod (2–4 odst.) → **(3)** benefity / novinky → **(2)** „co od nás…“ / odborníci (jména jen z dat) → **(2)** horizont titulů → **(2)** podpora / kontakt → **(2)** zpětná vazba / objednávky (jak sedí tématu) → **(4) nebo koláž** → **(6*)**

═══ JAZYK ═══
VZDY cesky. Jen HTML (zadny Markdown). Inline styly.
${productCtx}${webinarCtx}${blogCtx}${ragCtx}${campStats}${campStructures}`;

    /** 2. krok: skládání HTML — u nového zadání často s textovým briefem z 1. kroku; u iterací beze změny jako dřív. */
    let fullPrompt: string;
    if (contentBrief) {
      const composeConcreteHint =
        '\n\n---\nPOVINNÉ PRO SKLÁDÁNÍ HTML: Šablona už má tmavý hero (\`headline\`) a fialové CTA. \`bodyHtml\` musí být **dlouhý dopis**: úvod 2–4 odstavce, více sekcí s vlastním \`<h2>\`, (3) na výčty — přeneste **celý obsah** z briefu v souvislých odstavcích (ca 800–1500 slov při bohatém briefu), ne zkrácený leták. Žádné vymyšlené počty. KONKRÉTNÍ názvy a URL z katalogu/webinářů.\n';
      fullPrompt = conversationContext
        ? `OBSAHOVÝ BRIEF (1. krok — primární zdroj faktů a formulací; strukturu bloků dodrž podle systémového promptu):\n\n${contentBrief}\n\n---\nKontext konverzace:\n${conversationContext}\n\n---\nPůvodní požadavek uživatele:\n${prompt}${composeConcreteHint}`
        : `OBSAHOVÝ BRIEF (1. krok):\n\n${contentBrief}\n\n---\nPožadavek uživatele:\n${prompt}${composeConcreteHint}`;
    } else {
      const iterHint =
        '\n\n[KONKRÉTNOST + DÉLKA] Rozviň obsah v souvislých odstavcích a více sekcích \`<h2>\` — nezkracuj na jednovětné bloky; sociální důkazy s čísly jen z podkladů. Drž šablonu (hero + fialové CTA). Žádné vymyšlené počty.\n';
      fullPrompt = conversationContext
        ? `Kontext konverzace:\n${conversationContext}\n\nPozadavek: ${prompt}${iterHint}`
        : `${promptStr}${iterHint}`;
    }
    const emailJsonSchema = {
      type: 'OBJECT',
      properties: {
        subject: { type: 'STRING', description: 'Predmet max 60 znaku: konkretni tema (rocnik, akce), ne jen emoji' },
        previewText: { type: 'STRING', description: 'Preheader s faktem z briefu, ne prazdna nadsenost' },
        headline: { type: 'STRING', description: 'Kratky titulek v tmave modrem hero v Mailchimp sablone — neopakovat v bodyHtml jako h1' },
        bodyHtml: {
          type: 'STRING',
          description:
            'Inline HTML: dlouhy dopis (vice sekci h2, 2–4 odstavce uvodu), konkretni fakta z briefu/RAG; pri bohatem briefu cca 800–1500 slov textu; vb-email-root + mobile CSS; zadne vymyslene pocty',
        },
        ctaText: { type: 'STRING' },
        ctaUrl: { type: 'STRING' },
        audience: { type: 'STRING' },
        productImages: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['subject', 'headline', 'bodyHtml', 'ctaText', 'ctaUrl'],
    };
    const geminiPayloadBase = {
      system_instruction: { parts: [{ text: sysPrompt }] },
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    };
    const composeModelCandidates = [
      geminiModelId,
      ...(tier === 'pro' ? [EMAIL_GEN_MODELS.lite] : []),
      ...EMAIL_GEN_FALLBACK_MODELS,
    ];
    const seenCompose = new Set<string>();
    const uniqueComposeModels = composeModelCandidates.filter((id) =>
      seenCompose.has(id) ? false : (seenCompose.add(id), true),
    );

    console.log(
      `[MC Gen] compose models=[${uniqueComposeModels.join(', ')}] tier=${tier}, rag=${ragEnabled}, compact=${preferFast}, briefLed=${Boolean(contentBrief)}`,
    );

    let geminiResponse: Response | null = null;
    let lastErrText = '';
    let composeModelUsed = geminiModelId;
    let composeOk = false;

    composeLoop: for (const modelTry of uniqueComposeModels) {
      let genCfg: Record<string, unknown> = {
        temperature: 0.52,
        topP: 0.88,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: emailJsonSchema,
      };
      const urlTry = `https://generativelanguage.googleapis.com/v1beta/models/${modelTry}:generateContent?key=${geminiKey}`;
      /** Krátké opakování na jednom modelu, pak rychlá rotace — při přetížení Google často pomůže jiné ID dřív než dlouhé čekání. */
      for (let attempt = 0; attempt < 3; attempt++) {
        geminiResponse = await fetch(urlTry, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...geminiPayloadBase, generationConfig: genCfg }),
        });
        if (geminiResponse.ok) {
          composeModelUsed = modelTry;
          composeOk = true;
          break composeLoop;
        }
        lastErrText = await geminiResponse.text();
        if (
          geminiResponse.status === 400 &&
          genCfg.responseSchema &&
          /schema|responseSchema|unknown name|invalid.*generation/i.test(lastErrText)
        ) {
          console.log(`[MC Gen] ${modelTry}: 400 u responseSchema — opakuji jen s responseMimeType`);
          delete genCfg.responseSchema;
          continue;
        }
        if (geminiStatusRetryable(geminiResponse.status) && geminiResponse.status !== 400 && attempt < 2) {
          const ms = Math.min(20_000, 2200 * Math.pow(2, attempt));
          console.log(
            `[MC Gen] ${modelTry} HTTP ${geminiResponse.status} — čekám ${ms}ms (pokus ${attempt + 1}/3)`,
          );
          await new Promise((r) => setTimeout(r, ms));
          continue;
        }
        console.log(
          `[MC Gen] model ${modelTry} končím s ${geminiResponse.status}, zkouším další v řadě…`,
        );
        break;
      }
    }

    if (!composeOk || !geminiResponse?.ok) {
      throw new Error(
        `Gemini dočasně nedostupná nebo přetížená (503). Zkuste znovu za 1–2 minuty — nebo v builderu přepněte na LITE. ` +
          `Technicky: ${lastErrText.slice(0, 500)}`,
      );
    }
    (ragDebug as any).composeModelUsed = composeModelUsed;

    const gJson = await geminiResponse.json();
    const cand0 = gJson?.candidates?.[0];
    if (!cand0) {
      const block = gJson?.promptFeedback?.blockReason || '';
      console.log(`[MC Gen] zadny candidate${block ? ` (block: ${block})` : ''}`);
      return c.json(
        {
          error: block ? `Gemini zablokoval pozadavek: ${block}` : 'Gemini nevratila zadny vystup',
          raw: JSON.stringify(gJson).slice(0, 600),
        },
        500,
      );
    }
    if (cand0?.finishReason && cand0.finishReason !== 'STOP') {
      console.log(`[MC Gen] finishReason=${cand0.finishReason}`);
    }
    const parts = cand0?.content?.parts ?? [];
    let rawText = parts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
    rawText = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const extracted = extractFirstJsonObject(rawText);
    if (!extracted.ok) {
      console.log(`[MC Gen] JSON parse: ${extracted.reason} | head=${rawText.slice(0, 200)}`);
      return c.json(
        { error: `Agent nevratil validni JSON (${extracted.reason})`, raw: rawText.slice(0, 800) },
        500,
      );
    }
    const emailData = extracted.value as any;
    if (!emailData || typeof emailData.bodyHtml !== 'string' || !emailData.bodyHtml.trim()) {
      return c.json(
        {
          error: 'Agent vratil JSON bez platneho pole bodyHtml',
          raw: rawText.slice(0, 600),
        },
        500,
      );
    }

    // ── Product images: keep placeholder in bodyHtml, frontend will generate canvas collage ──
    const productImages: string[] = emailData.productImages || [];
    console.log(`[MC Gen] Product images for collage: ${productImages.length}`);

    // For fullHtml (Mailchimp template), use HTML table grid as fallback
    let bodyForTemplate = emailData.bodyHtml || '';
    if (productImages.length > 0 && bodyForTemplate.includes('data-product-collage')) {
      const gridHtml = buildImageGridHtml(productImages);
      bodyForTemplate = bodyForTemplate.replace(/<div[^>]*data-product-collage[^>]*>[\s\S]*?<\/div>/gi, gridHtml);
    }

    (ragDebug as any).productImagesCount = productImages.length;

    const fullHtml = vividbooksEmailTemplate({ headline: emailData.headline || emailData.subject || '', body: bodyForTemplate, ctaText: emailData.ctaText || 'Vyzkoušejte zdarma', ctaUrl: emailData.ctaUrl || 'https://www.vividbooks.com/vyzkousejte', preheader: emailData.previewText || '' });
    return c.json({ success: true, email: { ...emailData, fullHtml, productImages }, ragDebug });
  } catch (e: any) {
    console.log(`[MC Gen] Error: ${e.message}`);
    return c.json({ error: `MC gen: ${e.message}` }, 500);
  }
});

/* POST /admin/mailchimp/generate-inline-cta — AI navrhne text + URL podle textu nad kurzorem */
app.post('/make-server-93a20b6f/admin/mailchimp/generate-inline-cta', async (c) => {
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!geminiKey) return c.json({ error: 'GEMINI_API_KEY_RAG neni nastaven' }, 500);
    const body = await c.req.json();
    const contextText = (body.contextText || '').toString().slice(0, 6000);
    const subject = (body.subject || '').toString().slice(0, 200);
    const headline = (body.headline || '').toString().slice(0, 200);
    const defaultCtaUrl = (body.defaultCtaUrl || 'https://www.vividbooks.com/vyzkousejte').toString().slice(0, 500);
    if (!contextText.trim() && !subject.trim()) {
      return c.json({ error: 'Chybi contextText nebo subject' }, 400);
    }

    let productLines = '';
    try {
      const allProducts = await getAllProducts();
      productLines = allProducts.slice(0, 60).map((p: any) =>
        `- ${p.name}${p.category ? ' | ' + p.category : ''} → https://www.vividbooks.com/produkt/${p.id}`,
      ).join('\n');
    } catch { /* ignore */ }

    let webinarLines = '';
    try {
      const webinars = await getCollection(WEBINARS_KEY);
      webinarLines = (webinars || [])
        .filter((w: any) => w?.slug || w?.id)
        .slice(0, 12)
        .map((w: any) =>
          `- ${w.title} → https://www.vividbooks.com/webinar/${w.slug || w.id}`,
        ).join('\n');
    } catch { /* ignore */ }

    const sys = `Jsi copywriter pro Vividbooks. Uzivatel vklada INLINE CTA tlacitko do rozdelaneho emailu.
Tvym ukolem je navrhnout KRATKY text na tlacitko (max 40 znaku, cesky, akcni) a URL kam ma tlacitko vest.

OSTRE PRAVIDLA:
- url MUSI byt budz "https://www.vividbooks.com/..." z tabulek nize NEBO presne defaultCtaUrl z pozadavku.
- NIKDY nevymyslej produktovou URL, ktera neni v seznamu produktu.
- Pokud kontext nesedi k konkretnimu produktu, pouzij defaultCtaUrl nebo https://www.vividbooks.com/vyzkousejte nebo https://www.vividbooks.com/produkty
- buttonText: bez uvozovek, bez HTML

ODPOVEZ POUZE JSON (zadny markdown):
{"buttonText":"...","url":"https://...","hint":"1 veta proc tento cil"}`;

    const userBlock =
      `Predmet emailu: ${subject || '(prazdne)'}\nHlavni nadpis sablony: ${headline || '(prazdne)'}\n` +
      `Vychozi hlavni CTA draftu (preferuj pokud sedi): ${defaultCtaUrl}\n\n` +
      `TEXT A OBSAH NAD MISTEM KDE BUDE TLACITKO (posledni cast je nejdulezitejsi):\n"""${contextText || '(prazdne)'}"""\n\n` +
      `PRODUKTY (pouze tato URL pro /produkt/...):\n${productLines || '(nacteni selhalo)'}\n\n` +
      `WEBINARE (slug muze byt nekompletni — pokud nejsi jisty, nepouzivej):\n${webinarLines || '(zadne)'}`;

    const urlGem = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`;
    const res = await fetch(urlGem, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: userBlock }] }],
        generationConfig: {
          temperature: 0.55,
          topP: 0.9,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return c.json({ error: `Gemini ${res.status}: ${t.slice(0, 200)}` }, 500);
    }

    const gInline = await res.json();
    const partsInline = gInline?.candidates?.[0]?.content?.parts ?? [];
    let raw = partsInline.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
    raw = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const extractedCta = extractFirstJsonObject(raw);
    if (!extractedCta.ok) {
      return c.json({ error: `AI nevratila validni JSON (${extractedCta.reason})`, raw: raw.slice(0, 400) }, 500);
    }
    const parsed = extractedCta.value as any;

    let btn = (parsed.buttonText || '').toString().trim().slice(0, 80);
    let href = (parsed.url || '').toString().trim();
    const hint = (parsed.hint || '').toString().trim().slice(0, 240);

    if (!btn) btn = 'Zjistit více';
    if (!href || !href.startsWith('http')) href = defaultCtaUrl;

    const allowed =
      href.startsWith('https://www.vividbooks.com') ||
      href.startsWith('https://vividbooks.com') ||
      href.startsWith('https://www.vividbooks.cz') ||
      href.startsWith('https://vividbooks.cz') ||
      href === defaultCtaUrl;
    if (!allowed) href = defaultCtaUrl;

    return c.json({ success: true, cta: { buttonText: btn, url: href, hint } });
  } catch (e: any) {
    console.log(`[Inline CTA] Error: ${e.message}`);
    return c.json({ error: `Inline CTA: ${e.message}` }, 500);
  }
});

/* ── Product Image Collage Composer ──────────────────────────── */

function buildImageGridHtml(imageUrls: string[]): string {
  // Fallback: HTML table grid for email clients (no canvas needed)
  const cols = imageUrls.length <= 2 ? 2 : imageUrls.length <= 4 ? 2 : 3;
  const cellWidth = Math.floor(100 / cols);
  let html = '<table width="100%" cellpadding="8" cellspacing="0" border="0" style="margin:16px 0;"><tr>';
  imageUrls.forEach((url, i) => {
    html += `<td width="${cellWidth}%" style="text-align:center;vertical-align:top;padding:4px;">`;
    html += `<img src="${url}" alt="Produkt ${i + 1}" style="max-width:100%;height:auto;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />`;
    html += '</td>';
    if ((i + 1) % cols === 0 && i < imageUrls.length - 1) html += '</tr><tr>';
  });
  html += '</tr></table>';
  return html;
}

/* POST /admin/compose-product-images — returns HTML grid (no base64, no storage upload) */
app.post('/make-server-93a20b6f/admin/compose-product-images', async (c) => {
  try {
    const { imageUrls, subject } = await c.req.json();
    let urls: string[] = imageUrls || [];

    // If subject is provided and no imageUrls, filter products by subject
    if (subject && urls.length === 0) {
      const products = await getAllProducts();
      const lowerSubj = subject.toLowerCase();
      urls = products
        .filter((p: any) => {
          const name = (p.name || '').toLowerCase();
          const cat = (p.category || '').toLowerCase();
          const pred = (p.predmet || '').toLowerCase();
          return name.includes(lowerSubj) || cat.includes(lowerSubj) || pred.includes(lowerSubj);
        })
        .filter((p: any) => p.image)
        .map((p: any) => p.image);
    }

    if (!urls?.length) return c.json({ error: 'Zadne obrazky nenalezeny' }, 404);

    const gridHtml = buildImageGridHtml(urls);
    return c.json({ success: true, gridHtml, imageCount: urls.length });
  } catch (e: any) {
    console.log(`[Compose] Error: ${e.message}`);
    return c.json({ error: `Compose: ${e.message}` }, 500);
  }
});

/* ── Email Drafts CRUD (individual KV keys per draft) ────────── */
const EMAIL_DRAFT_PREFIX = 'vb:email-draft:';

app.get('/make-server-93a20b6f/admin/email-drafts', async (c) => {
  try {
    const rows = await kv.getByPrefix(EMAIL_DRAFT_PREFIX);
    let drafts: any[] = [];

    if (rows && rows.length > 0) {
      // getByPrefix already returns values directly (not {key,value} wrappers)
      drafts = rows.filter(Boolean);
    } else {
      // Migration fallback: read old single-blob key if it exists
      try {
        const legacy = await kv.get('vb:email-drafts');
        if (legacy?.drafts?.length) {
          console.log(`[Email Drafts] Migrating ${legacy.drafts.length} drafts from legacy blob to individual keys`);
          for (const d of legacy.drafts) {
            if (d.id) await kv.set(`${EMAIL_DRAFT_PREFIX}${d.id}`, d);
          }
          drafts = legacy.drafts;
          await kv.del('vb:email-drafts');
          console.log(`[Email Drafts] Migration complete, legacy key deleted`);
        }
      } catch { /* no legacy data */ }
    }

    drafts.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return c.json({ drafts });
  } catch (e: any) {
    console.log(`[Email Drafts] GET error: ${e.message}`);
    return c.json({ error: `Email drafts GET: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/email-drafts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const draft = await kv.get(`${EMAIL_DRAFT_PREFIX}${id}`);
    if (!draft) return c.json({ error: 'Draft nenalezen' }, 404);
    return c.json({ draft });
  } catch (e: any) {
    return c.json({ error: `Email draft GET by id: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/email-drafts', async (c) => {
  try {
    const draft = await c.req.json();
    if (!draft.id) return c.json({ error: 'Chybi draft.id' }, 400);
    const now = new Date().toISOString();
    const existing = await kv.get(`${EMAIL_DRAFT_PREFIX}${draft.id}`);
    const toSave = existing
      ? { ...existing, ...draft, updatedAt: now }
      : { ...draft, createdAt: draft.createdAt || now, updatedAt: now };
    const mergedBody = String(toSave.bodyHtml || '').trim();
    if (mergedBody) {
      toSave.fullHtml = vividbooksEmailTemplate({
        headline: String(toSave.headline || toSave.subject || ''),
        body: mergedBody,
        ctaText: String(toSave.ctaText || 'Vyzkoušejte zdarma'),
        ctaUrl: String(toSave.ctaUrl || 'https://www.vividbooks.com/vyzkousejte'),
        preheader: String(toSave.previewText || ''),
      });
    }
    await kv.set(`${EMAIL_DRAFT_PREFIX}${draft.id}`, toSave);
    console.log(`[Email Drafts] Saved draft ${draft.id.slice(0, 8)} — subject: "${toSave.subject || '(empty)'}"`);
    return c.json({ success: true, draft: toSave });
  } catch (e: any) {
    console.log(`[Email Drafts] POST error: ${e.message}`);
    return c.json({ error: `Email draft save: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/email-drafts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`${EMAIL_DRAFT_PREFIX}${id}`);
    console.log(`[Email Drafts] Deleted draft ${id.slice(0, 8)}`);
    return c.json({ success: true });
  } catch (e: any) {
    console.log(`[Email Drafts] DELETE error: ${e.message}` );
    return c.json({ error: `Email draft delete: ${e.message}` }, 500);
  }
});

/* POST /admin/mailchimp/send-campaign — send a campaign immediately */
app.post('/make-server-93a20b6f/admin/mailchimp/send-campaign', async (c) => {
  try {
    const { mcBase, mcAuth } = getMailchimpAuth();
    const { campaignId } = await c.req.json();
    if (!campaignId) return c.json({ error: 'Chybi campaignId' }, 400);
    const sendRes = await fetch(`${mcBase}/campaigns/${campaignId}/actions/send`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${mcAuth}` },
    });
    if (!sendRes.ok) {
      const t = await sendRes.text();
      throw new Error(`MC send ${sendRes.status}: ${t.slice(0, 300)}`);
    }
    console.log(`[MC Send] Campaign ${campaignId} sent!`);
    return c.json({ success: true, message: 'Kampan odeslana!' });
  } catch (e: any) {
    console.log(`[MC Send] Error: ${e.message}`);
    return c.json({ error: `MC send: ${e.message}` }, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   ██  MARKETING CALENDAR — Events, Sequences, Planning Agent
   ═══════════════════════════════════════════════════════════════════════ */

const CAL_EVENTS_KEY = 'vb:cal:events';
const CAL_SEQUENCES_KEY = 'vb:cal:sequences';
const CAL_CHAT_INDEX_KEY = 'vb:cal:chat:index';

/* ── Calendar Events CRUD ─────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/calendar/events', async (c) => {
  try {
    const events = (await kv.get(CAL_EVENTS_KEY) as any[] | null) || [];
    return c.json({ events });
  } catch (e: any) {
    return c.json({ error: `Calendar GET events: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/calendar/events', async (c) => {
  try {
    const event = await c.req.json();
    if (!event.id) event.id = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    event.createdAt = event.createdAt || new Date().toISOString();
    event.updatedAt = new Date().toISOString();
    const events = (await kv.get(CAL_EVENTS_KEY) as any[] | null) || [];
    events.push(event);
    await kv.set(CAL_EVENTS_KEY, events);
    console.log(`[Calendar] Created event ${event.id}: ${event.title}`);
    return c.json({ success: true, event });
  } catch (e: any) {
    return c.json({ error: `Calendar POST event: ${e.message}` }, 500);
  }
});

app.put('/make-server-93a20b6f/admin/calendar/events/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const events = (await kv.get(CAL_EVENTS_KEY) as any[] | null) || [];
    const updated = events.map((e: any) => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e);
    await kv.set(CAL_EVENTS_KEY, updated);
    console.log(`[Calendar] Updated event ${id}`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Calendar PUT event: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/calendar/events/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const events = (await kv.get(CAL_EVENTS_KEY) as any[] | null) || [];
    await kv.set(CAL_EVENTS_KEY, events.filter((e: any) => e.id !== id));
    console.log(`[Calendar] Deleted event ${id}`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Calendar DELETE event: ${e.message}` }, 500);
  }
});

/* ── Bulk create (for sequences) ────────────��────────────────────── */
app.post('/make-server-93a20b6f/admin/calendar/events/bulk', async (c) => {
  try {
    const { events: newEvents } = await c.req.json();
    if (!Array.isArray(newEvents)) return c.json({ error: 'events must be array' }, 400);
    const now = new Date().toISOString();
    const withIds = newEvents.map((e: any) => ({
      ...e,
      id: e.id || `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    }));
    const existing = (await kv.get(CAL_EVENTS_KEY) as any[] | null) || [];
    await kv.set(CAL_EVENTS_KEY, [...existing, ...withIds]);
    console.log(`[Calendar] Bulk created ${withIds.length} events`);
    return c.json({ success: true, events: withIds });
  } catch (e: any) {
    return c.json({ error: `Calendar bulk POST: ${e.message}` }, 500);
  }
});

/* ── Sequences CRUD ──────────────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/calendar/sequences', async (c) => {
  try {
    const seqs = (await kv.get(CAL_SEQUENCES_KEY) as any[] | null) || [];
    return c.json({ sequences: seqs });
  } catch (e: any) {
    return c.json({ error: `Calendar GET sequences: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/calendar/sequences', async (c) => {
  try {
    const seq = await c.req.json();
    if (!seq.id) seq.id = `seq-${Date.now()}`;
    seq.createdAt = new Date().toISOString();
    const seqs = (await kv.get(CAL_SEQUENCES_KEY) as any[] | null) || [];
    seqs.push(seq);
    await kv.set(CAL_SEQUENCES_KEY, seqs);
    console.log(`[Calendar] Created sequence ${seq.id}: ${seq.title}`);
    return c.json({ success: true, sequence: seq });
  } catch (e: any) {
    return c.json({ error: `Calendar POST sequence: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/calendar/sequences/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const seqs = (await kv.get(CAL_SEQUENCES_KEY) as any[] | null) || [];
    await kv.set(CAL_SEQUENCES_KEY, seqs.filter((s: any) => s.id !== id));
    const events = (await kv.get(CAL_EVENTS_KEY) as any[] | null) || [];
    await kv.set(CAL_EVENTS_KEY, events.filter((e: any) => e.sequenceId !== id));
    console.log(`[Calendar] Deleted sequence ${id} and its events`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Calendar DELETE sequence: ${e.message}` }, 500);
  }
});

/* ── Calendar Planning Agent ─────────────────────────────────────── */
const CALENDAR_AGENT_SYSTEM_PROMPT = `Jsi stručný marketingový plánovač pro Vividbooks (edtech, interaktivní učebnice ZŠ/SŠ).

## PRAVIDLA KOMUNIKACE — KRITICKÉ
1. BUĎ MAXIMÁLNĚ STRUČNÝ. Žádné úvody, žádné "skvělý cíl!", žádné zbytečné vysvětlování.
2. Rovnou odpověz sekvencí nebo seznamem kroků. NIKDY nezačínej pochvalou ani rekapitulací.
3. Pokud uživatel chce naplánovat kampaň/webinář/launch, OKAMŽITĚ vrať JSON sekvenci.
4. Maximálně 1-2 KRÁTKÉ věty kontextu před JSON blokem. Žádné odstavce. Žádné nadpisy "Harmonogram kampaně".
5. Upozornění na svátky/kolize piš jako max 2-3 bullet points ZA JSON blokem — ne před ním.
6. NIKDY nepřeříkávej co už uživatel ví. Neptej se zbytečné otázky — rovnou navrhni.
7. Pokud chybí datum, navrhni nejbližší vhodné. Pokud chybí detail, doplň rozumný default.
8. Popisy v "description" v JSON musí být MAX 10 slov. Žádné dlouhé věty.
9. NEVYPISUJ příklady formátů, nevysvětluj strukturu — prostě ji použij.

## Sezóny (interní znalost, nevypisuj uživateli)
- Září: Back-to-school. Květen-Červen: uzávěrky. Prosinec: Vánoce. 28.3: Den učitelů.
- Emaily: Út-Čt, 9-11h. Vyhni se: víkendy, svátky (1.1, 1.5, 8.5, 5.7, 6.7, 28.9, 28.10, 17.11, 24-26.12).

## Šablona: webinář promo
T-14: FB/IG kampaň | T-7: Zvací email | T-3: Social reminder | T-1: Email reminder | T+0: Webinář | T+1: Nahrávka email | T+7: Prodejní follow-up

## Šablona: launch předmětu
T-30: Teaser newsletter | T-14: Email segment + FB | T-7: Ukázky social | T-1: Reminder | T+0: Launch | T+3: Follow-up | T+14: Prodejní push

## JSON formáty — MUSÍŠ použít PŘESNĚ TŘI BACKTICKY (ne jeden!)
KRITICKÉ: Vždy piš \`\`\` (tři zpětné apostrofy), nikdy jen jeden. Jinak se JSON nezparsuje.
JSON piš KOMPAKTNĚ na co nejméně řádků. NEFORMÁTUJ s prázdnými řádky mezi properties.

Sekvence (PŘESNÝ formát):
\`\`\`json:sequence
{"title":"...","anchorDate":"YYYY-MM-DD","steps":[{"offset":-14,"type":"email","title":"...","description":"Max 10 slov"},{"offset":0,"type":"webinar","title":"...","description":"Max 10 slov"}]}
\`\`\`

Událost (PŘESNÝ formát):
\`\`\`json:event
{"type":"webinar","title":"...","date":"YYYY-MM-DD","time":"16:00","description":"Max 10 slov","tags":["..."]}
\`\`\`

Typy: email, social, newsletter, webinar, product_launch, campaign, ad
NEGENERUJ samostatnou json:event událost pokud je webinář už součástí sekvence.`;

app.post('/make-server-93a20b6f/admin/calendar/agent', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG není nastaven.' }, 500);

    const body = await c.req.json();
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'Chybí pole messages.' }, 400);
    }

    const calEvents = (await kv.get(CAL_EVENTS_KEY) as any[] | null) || [];
    const calSeqs = (await kv.get(CAL_SEQUENCES_KEY) as any[] | null) || [];

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    let ragContext = '';
    let ragChunksUsed = 0;
    if (lastUserMsg?.content) {
      try {
        const allChunks = await loadAllChunks();
        if (allChunks.length > 0) {
          const qEmbed = await embedText(lastUserMsg.content);
          const scored = allChunks
            .filter((ch: any) => Array.isArray(ch.embedding) && ch.embedding.length > 0)
            .map((ch: any) => ({ ...ch, score: cosineSim(qEmbed, ch.embedding) }))
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 6);
          const relevant = scored.filter((ch: any) => ch.score >= 0.15);
          if (relevant.length > 0) {
            ragContext = relevant.map((ch: any, i: number) =>
              `[${i+1}] ${ch.metadata?.source ?? '?'}: ${ch.metadata?.title ?? ''}\n${ch.text}`
            ).join('\n---\n');
            ragChunksUsed = relevant.length;
          }
        }
      } catch (ragErr: any) {
        console.log(`[CalAgent] RAG error: ${ragErr.message}`);
      }
    }

    const nowPrague = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
    const todayISO = nowPrague.toISOString().slice(0, 10);
    const todayCZ = nowPrague.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let systemText = CALENDAR_AGENT_SYSTEM_PROMPT;
    systemText += `\n\n## Aktuální datum\n**${todayCZ}** (${todayISO})`;

    if (calEvents.length > 0) {
      const sorted = [...calEvents].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const upcoming = sorted.filter(e => e.date >= todayISO).slice(0, 30);
      const recent = sorted.filter(e => e.date < todayISO).slice(-10);
      systemText += '\n\n## Aktuální kalendář\n';
      if (upcoming.length > 0) {
        systemText += '### Nadcházející:\n' + upcoming.map(e =>
          `- ${e.date}${e.time ? ' ' + e.time : ''} | ${e.type} | **${e.title}**${e.sequenceId ? ' (sekvence)' : ''}`
        ).join('\n');
      }
      if (recent.length > 0) {
        systemText += '\n### Nedávné:\n' + recent.map(e => `- ${e.date} | ${e.type} | ${e.title}`).join('\n');
      }
    } else {
      systemText += '\n\n## Kalendář\nKalendář je prázdný.';
    }
    if (calSeqs.length > 0) {
      systemText += '\n\n## Aktivní sekvence\n' + calSeqs.map(s =>
        `- **${s.title}** (anchor: ${s.anchorDate}, ${s.steps?.length || 0} kroků)`
      ).join('\n');
    }
    if (ragContext) systemText += `\n\n## RAG kontext\n${ragContext}`;

    const products = await getAllProducts();
    if (products.length > 0) {
      systemText += '\n\n## Produkty\n' + products.slice(0, 40).map((p: any) =>
        `- ${p.name} (${p.category || '?'}${p.price ? ', ' + p.price : ''})`
      ).join('\n');
    }

    const geminiContents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents: geminiContents,
          generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.log(`[CalAgent] Gemini error ${res.status}: ${errText.slice(0, 400)}`);
      return c.json({ error: `Gemini ${res.status}: ${errText.slice(0, 200)}` }, 500);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[CalAgent] OK — in=${data.usageMetadata?.promptTokenCount} out=${data.usageMetadata?.candidatesTokenCount} rag=${ragChunksUsed}`);
    return c.json({ reply: text, tokensIn: data.usageMetadata?.promptTokenCount || 0, tokensOut: data.usageMetadata?.candidatesTokenCount || 0, ragChunks: ragChunksUsed });
  } catch (e: any) {
    console.log(`[CalAgent] Exception: ${e.message}`);
    return c.json({ error: `Calendar agent: ${e.message}` }, 500);
  }
});

/* ── Calendar Chat History ───────────────────────────────────────── */
app.get('/make-server-93a20b6f/admin/calendar/chats', async (c) => {
  try {
    const index = (await kv.get(CAL_CHAT_INDEX_KEY) as any[] | null) || [];
    return c.json({ chats: index });
  } catch (e: any) {
    return c.json({ error: `Cal chat index: ${e.message}` }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/calendar/chats', async (c) => {
  try {
    const { id, title, messages } = await c.req.json();
    if (!id || !messages) return c.json({ error: 'Chybí id nebo messages' }, 400);
    const now = new Date().toISOString();
    await kv.set(`vb:cal:chat:${id}`, { id, title, messages, updatedAt: now });
    const index = (await kv.get(CAL_CHAT_INDEX_KEY) as any[] | null) || [];
    const entry = { id, title: title || 'Nový chat', updatedAt: now, createdAt: index.find((x: any) => x.id === id)?.createdAt || now, messageCount: messages.length };
    const idx = index.findIndex((x: any) => x.id === id);
    if (idx >= 0) index[idx] = entry; else index.unshift(entry);
    if (index.length > 30) index.splice(30);
    await kv.set(CAL_CHAT_INDEX_KEY, index);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Cal chat save: ${e.message}` }, 500);
  }
});

app.get('/make-server-93a20b6f/admin/calendar/chats/:id', async (c) => {
  try {
    const chat = await kv.get(`vb:cal:chat:${c.req.param('id')}`);
    if (!chat) return c.json({ error: 'Chat nenalezen' }, 404);
    return c.json({ chat });
  } catch (e: any) {
    return c.json({ error: `Cal chat GET: ${e.message}` }, 500);
  }
});

app.delete('/make-server-93a20b6f/admin/calendar/chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`vb:cal:chat:${id}`);
    const index = (await kv.get(CAL_CHAT_INDEX_KEY) as any[] | null) || [];
    await kv.set(CAL_CHAT_INDEX_KEY, index.filter((x: any) => x.id !== id));
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: `Cal chat DELETE: ${e.message}` }, 500);
  }
});

// Suppress EPIPE / broken-pipe errors: these happen when the client (browser) disconnects
// before Deno finishes writing the response body (e.g. navigating away). Non-fatal.
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const err = event.reason as any;
  if (
    err?.name === 'Http' &&
    (err?.code === 'EPIPE' || (err?.message && err.message.includes('broken pipe')))
  ) {
    event.preventDefault(); // silently ignore — client just disconnected
    return;
  }
  // Log all other unhandled rejections
  console.log('[UnhandledRejection]', err?.message ?? err);
});

/* ══════════════════════════════════════════════════════════════════
   POST /generate-collage-ai
   Přijme pole URL obrázků + volitelný stylePrompt,
   zavolá Gemini Image Generation, výsledek uploadne do Storage
   a vrátí veřejnou URL.
══════════════════════════════════════════════════════════════════ */
app.post('/make-server-93a20b6f/generate-collage-ai', async (c) => {
  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!geminiKey) return c.json({ error: 'GEMINI_API_KEY_RAG není nastaven' }, 500);

    const body = await c.req.json();
    const { imageUrls, styleReferenceUrls, stylePrompt, aspectRatio, previousOutputUrl, imageModel } = body as {
      imageUrls: string[];
      styleReferenceUrls?: string[];
      stylePrompt?: string;
      aspectRatio?: string;
      /** Veřejná URL posledního AI výstupu — při přegenerování s feedbackem jako poslední obrázek před textem */
      previousOutputUrl?: string;
      /** `pro` = gemini-3-pro-image-preview (kvalita), výchozí = flash */
      imageModel?: string;
    };

    if (!imageUrls || imageUrls.length < 1) {
      return c.json({ error: 'imageUrls musí obsahovat alespoň 1 URL' }, 400);
    }

    const MAX_INLINE = 8;
    const styleRefs = Array.isArray(styleReferenceUrls)
      ? styleReferenceUrls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 3).map((u) => u.trim())
      : [];
    const mainUrls = imageUrls.filter((u) => typeof u === 'string' && u.trim());
    const prevOut =
      typeof previousOutputUrl === 'string' && previousOutputUrl.trim()
        ? previousOutputUrl.trim()
        : '';

    // ── Stáhni obrázky: nejdřív referenční styl, pak obsah ───────
    const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
    let styleRefLoaded = 0;
    let revisionLoaded = 0;

    async function pushUrl(url: string): Promise<void> {
      const res = await fetch(url, { headers: { 'User-Agent': 'VividBooks-AI/1.0' } });
      if (!res.ok) {
        console.log(`[generate-collage-ai] Přeskočen ${url}: status ${res.status}`);
        return;
      }
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const mimeType = contentType.split(';')[0].trim();
      const buf = await res.arrayBuffer();
      imageParts.push({ inlineData: { mimeType, data: encodeBase64(new Uint8Array(buf)) } });
      console.log(`[generate-collage-ai] Načten: ${url.slice(0, 60)}… (${buf.byteLength}B)`);
    }

    for (const url of styleRefs) {
      if (imageParts.length >= MAX_INLINE) break;
      try {
        await pushUrl(url);
        styleRefLoaded++;
      } catch (e: any) {
        console.log(`[generate-collage-ai] Chyba načítání ${url}: ${e.message}`);
      }
    }
    const reserveRevision = Boolean(prevOut);
    for (const url of mainUrls) {
      if (imageParts.length >= MAX_INLINE - (reserveRevision ? 1 : 0)) break;
      try {
        await pushUrl(url);
      } catch (e: any) {
        console.log(`[generate-collage-ai] Chyba načítání ${url}: ${e.message}`);
      }
    }

    if (reserveRevision && imageParts.length < MAX_INLINE) {
      try {
        await pushUrl(prevOut);
        revisionLoaded = 1;
      } catch (e: any) {
        console.log(`[generate-collage-ai] Chyba načítání previousOutputUrl: ${e.message}`);
      }
    }

    if (imageParts.length === 0) return c.json({ error: 'Nepodařilo se načíst žádný obrázek' }, 400);

    const contentCount = imageParts.length - styleRefLoaded - revisionLoaded;
    if (contentCount < 1) {
      return c.json({ error: 'Nepodařilo se načíst žádný obsahový obrázek (obálky / podklady)' }, 400);
    }

    // ── Sestav prompt ────────────────────────────────────────────
    const revisionNote =
      revisionLoaded > 0
        ? `The LAST attached image is your PREVIOUS generated output for this same task. The text prompt includes a REVISION section — change that render accordingly while keeping workbook cover artwork accurate and honoring style references and the creative brief. Do not ignore the revision instructions.\n\n`
        : '';
    const refNote =
      styleRefLoaded > 0
        ? `The first ${styleRefLoaded} attached image(s) are STYLE REFERENCES — match their composition, lighting, camera angle, and overall aesthetic. The next ${contentCount} image(s) are primary content (e.g. workbook covers) to incorporate faithfully.\n\n`
        : revisionLoaded > 0
          ? `The first ${contentCount} attached image(s) are primary content (e.g. workbook covers) to incorporate faithfully.\n\n`
          : '';
    const basePrompt =
      revisionNote +
      refNote +
      (stylePrompt ||
        `Create a beautiful, realistic overhead photograph of these ${contentCount} educational workbook covers (Czech school notebooks / sešity) arranged naturally and casually on a clean light wooden desk surface, as if a student just placed them there. The arrangement should be organic and natural — slightly overlapping each other, with varied gentle rotations (some tilted left, some right), all covers clearly visible. Use warm, soft natural daylight. The mood is inviting, cozy and study-friendly. Show the actual cover artwork of each book faithfully. Do not add any extra objects or text.`);

    console.log(
      `[generate-collage-ai] Volám Gemini s ${imageParts.length} obrázky (styleRefs=${styleRefLoaded} content=${contentCount} revision=${revisionLoaded})...`,
    );

    // ── Gemini API call ──────────────────────────────────────────
    // Map our aspect ratio IDs to Gemini format
    const ASPECT_MAP: Record<string, string> = {
      '1:1': '1:1', '3:4': '3:4', '4:3': '4:3', '16:9': '16:9',
    };
    const geminiAspect = aspectRatio && ASPECT_MAP[aspectRatio] ? ASPECT_MAP[aspectRatio] : '1:1';
    console.log(`[generate-collage-ai] Formát: ${geminiAspect}`);

    const IMAGE_GEN_MODELS: Record<string, string> = {
      flash: 'gemini-3.1-flash-image-preview',
      pro: 'gemini-3-pro-image-preview',
    };
    const modelKey = imageModel === 'pro' ? 'pro' : 'flash';
    const modelId = IMAGE_GEN_MODELS[modelKey];
    console.log(`[generate-collage-ai] Model: ${modelId}`);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`;
    // Aspect ratio jako silná instrukce na začátku promptu (API parametr neexistuje)
    const aspectInstruction = geminiAspect !== '1:1'
      ? `OUTPUT FORMAT REQUIREMENT: You MUST generate this image in ${geminiAspect} aspect ratio (width:height). Do not crop or pad — compose the scene natively in this ratio.\n\n`
      : `OUTPUT FORMAT REQUIREMENT: Generate as square 1:1 aspect ratio.\n\n`;

    // Obrázky před textem — lépe drží styl referencí a obálek (stejně jako generate_blog_image)
    const geminiBody = {
      contents: [{
        parts: [
          ...imageParts,
          { text: aspectInstruction + basePrompt },
        ],
      }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.log(`[generate-collage-ai] Gemini error ${geminiRes.status}: ${errText.slice(0, 500)}`);
      return c.json({ error: `Gemini API chyba ${geminiRes.status}: ${errText.slice(0, 200)}` }, 500);
    }

    const geminiData = await geminiRes.json();
    console.log(`[generate-collage-ai] Gemini odpověď přijata`);

    // ── Najdi vygenerovaný obrázek v odpovědi ─────────────────
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.data);
    if (!imgPart) {
      const textPart = parts.find((p: any) => p.text);
      console.log(`[generate-collage-ai] Žádný obrázek v odpovědi. Text: ${textPart?.text?.slice(0, 200)}`);
      return c.json({ error: `Gemini nevygeneroval obrázek. ${textPart?.text?.slice(0, 150) || 'Neznámá chyba'}` }, 500);
    }

    const { mimeType: outMime, data: outB64 } = imgPart.inlineData;
    const ext = outMime?.includes('png') ? 'png' : 'jpg';

    // ── Převeď base64 → Buffer a uploadni do Storage ──────────
    const binaryStr = atob(outB64);
    const outBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) outBytes[i] = binaryStr.charCodeAt(i);

    const sb = await getStorageClient();
    const filename = `ai-collage-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from(IMAGE_BUCKET).upload(filename, outBytes.buffer, {
      contentType: outMime,
      upsert: false,
    });
    if (upErr) return c.json({ error: `Storage upload selhal: ${upErr.message}` }, 500);

    const { data: pubData } = sb.storage.from(IMAGE_BUCKET).getPublicUrl(filename);
    console.log(`[generate-collage-ai] Hotovo → ${pubData.publicUrl}`);
    return c.json({ url: pubData.publicUrl });

  } catch (e: any) {
    console.log(`[generate-collage-ai] Neočekávaná chyba: ${e.message}`);
    return c.json({ error: `Neočekávaná chyba: ${e.message}` }, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════
   ADMIN AGENT — Gemini Function Calling / Action Loop
═══════════════════════════════════════════════════════════════════ */

function slimProductForAgent(p: any): any {
  const keys = ['id', 'name', 'type', 'category', 'price', 'priceAmount', 'autori', 'rocnik', 'dolozka', 'image', 'previewLink', 'flipbookLink', 'previewVideoLink', 'appLink', 'shopifyVariantId', 'shopifyProductId', 'shoptetId'];
  const o: any = {};
  for (const k of keys) {
    const v = p[k];
    if (v != null && v !== '') o[k] = v;
  }
  if (typeof p.note === 'string' && p.note.length) {
    o.note = p.note.length > 280 ? `${p.note.slice(0, 280)}…` : p.note;
  }
  return o;
}

const ADMIN_AGENT_TOOLS = [
  // ── Produkty ──────────────────────────────────────────────────────
  { name: 'get_products', description: 'Načte seznam produktů z katalogu. Výchozí (full_fields false): krátký přehled polí (id, name, type, category, ceny, ročník, doložka, odkazy, obrázek…) — šetří paměť edge workeru. full_fields true: všechna pole, ale max ~60 položek — použij jen když opravdu potřebuješ dlouhé description/obsah/metadata.', parameters: { type: 'OBJECT', properties: { filter_type: { type: 'STRING', description: 'workbook | online | vividboard | all', nullable: true }, filter_category: { type: 'STRING', nullable: true }, filter_name_contains: { type: 'STRING', description: 'Substring v názvu, diakritika OK', nullable: true }, full_fields: { type: 'BOOLEAN', description: 'true = celé záznamy (max ~60), false = lehké záznamy (max ~250)', nullable: true } } } },
   { name: 'create_product', description: 'Vytvoří nový produkt v katalogu. Vyplň všechna relevantní pole. type: workbook | online | vividboard. Vrátí ID nového produktu.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, type: { type: 'STRING', description: 'workbook | online | vividboard' }, category: { type: 'STRING', nullable: true }, price: { type: 'STRING', nullable: true }, priceAmount: { type: 'NUMBER', nullable: true }, description: { type: 'STRING', nullable: true }, autori: { type: 'STRING', nullable: true }, rocnik: { type: 'STRING', nullable: true }, dolozka: { type: 'STRING', nullable: true }, image: { type: 'STRING', description: 'URL obrázku produktu', nullable: true }, shopifyVariantId: { type: 'STRING', nullable: true }, shopifyProductId: { type: 'STRING', nullable: true }, shoptetId: { type: 'STRING', nullable: true }, flipbookLink: { type: 'STRING', nullable: true }, previewLink: { type: 'STRING', nullable: true }, previewVideoLink: { type: 'STRING', nullable: true }, appLink: { type: 'STRING', nullable: true }, note: { type: 'STRING', nullable: true } }, required: ['name', 'type'] } },
  { name: 'update_product', description: 'Aktualizuje libovolná pole u jednoho produktu. Do fields můžeš zapsat JAKÉKOLIV pole: name, type, category, price, priceAmount, description, autori, rocnik, dolozka, image, shopifyVariantId, shopifyProductId, shoptetId, flipbookLink, previewLink, previewVideoLink, appLink, note, obsah, metadata nebo jakékoli vlastní pole. Stávající pole, která neuvedeš, zůstanou nezměněna.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, fields: { type: 'OBJECT', description: 'Libovolný objekt s poli k přepsání. Např. { "price": "299 Kč", "shopifyVariantId": "123", "description": "..." }' } }, required: ['id', 'fields'] } },
  { name: 'bulk_update_products', description: 'Hromadně přepíše pole u skupiny produktů. Okamžitě uloží.', parameters: { type: 'OBJECT', properties: { filter_type: { type: 'STRING', nullable: true }, filter_category: { type: 'STRING', nullable: true }, filter_name_contains: { type: 'STRING', nullable: true }, fields: { type: 'OBJECT' } }, required: ['fields'] } },
  { name: 'bulk_update_prices_percentage', description: 'Změní ceny skupiny produktů o procento. Kladné = zdražení, záporné = zlevnění. Zaokrouhlení na desítky.', parameters: { type: 'OBJECT', properties: { percentage: { type: 'NUMBER', description: 'např. 10 = +10%, -5 = -5%' }, filter_type: { type: 'STRING', nullable: true }, filter_category: { type: 'STRING', nullable: true }, filter_name_contains: { type: 'STRING', nullable: true } }, required: ['percentage'] } },
  { name: 'delete_product', description: 'Smaže produkt z katalogu.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  { name: 'duplicate_product', description: 'Zduplikuje produkt jako základ pro nový.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, new_name: { type: 'STRING', nullable: true } }, required: ['id'] } },
  { name: 'get_broken_products', description: 'Najde produkty bez obrázku, ceny nebo popisu.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'get_price_overview', description: 'Přehled cen dle typů a kategorií.', parameters: { type: 'OBJECT', properties: {} } },
  // ── Dashboard & statistiky ────────────────────────────────────────
  { name: 'get_dashboard_summary', description: 'Přehled celého webu — počty produktů, blogů, novinek, webinářů, notifikací, newsletteru.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'get_newsletter_stats', description: 'Počet odběratelů newsletteru, zdroje přihlášení.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'search_all', description: 'Prohledá produkty, blog, novinky a webináře najednou.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  // ── Hero slidy ────────────────────────────────────────────────────
  { name: 'get_hero_slides', description: 'Načte hero slidy hlavní stránky.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'create_hero_slide', description: 'Vytvoří nový hero slide.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, subtitle: { type: 'STRING', nullable: true }, ctaText: { type: 'STRING', nullable: true }, ctaUrl: { type: 'STRING', nullable: true }, badge: { type: 'STRING', nullable: true }, bgColor: { type: 'STRING', nullable: true }, accentColor: { type: 'STRING', nullable: true }, active: { type: 'BOOLEAN', nullable: true } }, required: ['title'] } },
  { name: 'update_hero_slide', description: 'Aktualizuje hero slide.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, fields: { type: 'OBJECT' } }, required: ['id', 'fields'] } },
  // ── Předměty / landing pages ───────────────────────────────────────
  { name: 'get_subject_pages', description: 'Načte předměty (landing pages předmětů) z CMS. Vrací všechna uložená pole předmětu: displayName, slug, tagline, heroText, authorIntroHeading, authorIntroBody, faqs (pole {question, answer}), heroColor, heroColorDark, accentColor, grades, stats, features, topics, rvpNote, dolozka, isActive, order i další vlastní pole. Použij pro zjištění ID a aktuálního stavu před úpravou.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Volitelné hledání podle displayName, slug, tagline nebo id. Např. "Matematika 2", "fyzika", "matematika-2-stupen".', nullable: true }, active_only: { type: 'BOOLEAN', description: 'Pokud true, vrať jen aktivní předměty.', nullable: true } } } },
  { name: 'create_subject_page', description: 'Vytvoří nový předmět / landing page předmětu v CMS. Vyplň všechna relevantní pole; extraFields může obsahovat další vlastní pole. Pole faqs = často kladené dotazy: pole objektů { question, answer } — zobrazí se na webu a automaticky se zaindexuje do RAG.', parameters: { type: 'OBJECT', properties: { displayName: { type: 'STRING' }, slug: { type: 'STRING' }, tagline: { type: 'STRING', nullable: true }, heroText: { type: 'STRING', nullable: true }, authorIntroHeading: { type: 'STRING', nullable: true }, authorIntroBody: { type: 'STRING', nullable: true }, faqs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } } }, description: 'Často kladené dotazy pro stránku předmětu', nullable: true }, heroColor: { type: 'STRING', nullable: true }, heroColorDark: { type: 'STRING', nullable: true }, accentColor: { type: 'STRING', nullable: true }, grades: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true }, stats: { type: 'ARRAY', items: { type: 'OBJECT' }, nullable: true }, features: { type: 'ARRAY', items: { type: 'OBJECT' }, nullable: true }, topics: { type: 'ARRAY', items: { type: 'OBJECT' }, nullable: true }, rvpNote: { type: 'STRING', nullable: true }, dolozka: { type: 'STRING', nullable: true }, isActive: { type: 'BOOLEAN', nullable: true }, order: { type: 'NUMBER', nullable: true }, extraFields: { type: 'OBJECT', description: 'Libovolná další pole předmětu, např. přístupová nastavení nebo interní metadata.', nullable: true } }, required: ['displayName', 'slug'] } },
  { name: 'update_subject_page', description: 'Aktualizuje libovolná pole existujícího předmětu. Do fields můžeš zapsat JAKÉKOLIV pole předmětu včetně faqs (pole {question, answer} pro často kladené dotazy — po uložení se FAQ automaticky zaindexuje do RAG): heroText, authorIntroHeading, authorIntroBody, displayName, slug, tagline, heroColor, heroColorDark, accentColor, grades, stats, features, topics, rvpNote, dolozka, isActive, order i další vlastní pole.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID předmětu z get_subject_pages' }, fields: { type: 'OBJECT', description: 'Libovolný objekt s poli k přepsání.' } }, required: ['id', 'fields'] } },
  { name: 'delete_subject_page', description: 'Smaže předmět / landing page předmětu. Nejdřív zavolej get_subject_pages pro zjištění ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  // ── Blog ──────────────────────────────────────────────────────────
  { name: 'get_blog_posts', description: 'Načte blog články.', parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER', nullable: true } } } },
  { name: 'create_blog_post', description: 'Vytvoří nový blog článek jako draft. NAPIŠ CELÝ OBSAH SAM — title, plný content (HTML s odstavci, nadpisy, obrázky), excerpt, imageUrl pro cover.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, slug: { type: 'STRING', nullable: true }, excerpt: { type: 'STRING', description: '1-2 věty shrnutí', nullable: true }, author: { type: 'STRING', nullable: true }, category: { type: 'STRING', nullable: true }, content: { type: 'STRING', description: 'Plný HTML obsah: <h2>, <p>, <strong>, <ul><li>, <img src="URL" style="max-width:100%;border-radius:8px;margin:16px 0">. Min 400 slov.' }, imageUrl: { type: 'STRING', description: 'URL cover obrázku (použij reálné URL z webu nebo unsplash)', nullable: true }, tags: { type: 'STRING', description: 'Tagy oddělené čárkou', nullable: true }, readTime: { type: 'STRING', nullable: true } }, required: ['title', 'content'] } },
  { name: 'update_blog_post', description: 'Upraví existující blog článek.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, fields: { type: 'OBJECT' } }, required: ['id', 'fields'] } },
  { name: 'publish_blog_post', description: 'Publikuje nebo odpublikuje blog článek.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, published: { type: 'BOOLEAN' } }, required: ['id', 'published'] } },
  { name: 'delete_blog_post', description: 'Smaže blog článek trvale. Nejdřív zavolej get_blog_posts pro zjištění ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  // ── Webináře ──────────────────────────────────────────────────────
  { name: 'get_webinars', description: 'Načte webináře.', parameters: { type: 'OBJECT', properties: { upcoming_only: { type: 'BOOLEAN', nullable: true } } } },
  { name: 'create_webinar', description: 'Vytvoří nový webinář.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, subtitle: { type: 'STRING', nullable: true }, day: { type: 'NUMBER', nullable: true }, monthName: { type: 'STRING', nullable: true }, year: { type: 'NUMBER', nullable: true }, time: { type: 'STRING', nullable: true }, lecturer: { type: 'STRING', nullable: true }, zoomLink: { type: 'STRING', nullable: true }, targetAudience: { type: 'STRING', nullable: true } }, required: ['title'] } },
  { name: 'update_webinar', description: 'Upraví existující webinář.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, fields: { type: 'OBJECT' } }, required: ['id', 'fields'] } },
  { name: 'delete_webinar', description: 'Smaže webinář.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  // ── Notifikace ────────────────────────────────────────────────────
  { name: 'get_notifications', description: 'Načte notifikace (bannery webu).', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'create_notification', description: 'Vytvoří nový notifikační banner na webu.', parameters: { type: 'OBJECT', properties: { text: { type: 'STRING' }, link: { type: 'STRING', nullable: true }, linkText: { type: 'STRING', nullable: true }, color: { type: 'STRING', nullable: true }, active: { type: 'BOOLEAN', nullable: true } }, required: ['text'] } },
  { name: 'delete_notification', description: 'Smaže notifikační banner. Nejdřív zavolej get_notifications pro zjištění ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  { name: 'update_notification', description: 'Upraví existující notifikaci (text, link, barva, aktivní). Nejdřív zavolej get_notifications pro zjištění ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, fields: { type: 'OBJECT' } }, required: ['id', 'fields'] } },
  // ── Novinky ───────────────────────────────────────────────────────
  { name: 'get_novinky', description: 'Načte novinky.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'create_novinka', description: 'Vytvoří novinkový příspěvek.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, excerpt: { type: 'STRING', nullable: true }, content: { type: 'STRING', nullable: true }, author: { type: 'STRING', nullable: true }, category: { type: 'STRING', nullable: true } }, required: ['title'] } },
  { name: 'update_novinka', description: 'Upraví existující novinku.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, fields: { type: 'OBJECT' } }, required: ['id', 'fields'] } },
  { name: 'delete_novinka', description: 'Smaže novinku trvale. Nejdřív zavolej get_novinky pro zjištění ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
  // ── Email kampaně ─────────────────────────────────────────────────
  { name: 'create_email_campaign_draft', description: 'POVINNÉ při žádosti o mail do Mailchimpu / šablonu / canvas (Email Builder). Uloží draft v pravém panelu. Stejné jako generate-email (1)–(6): typ (2) převažuje slovně, plus (3)(4)(6); minimálně dvě různé barvy sekcí / karet (viz vrstvená pozadí v tool schema u bodyHtml). 1–2 CTA pill, Arial.', parameters: { type: 'OBJECT', properties: { subject: { type: 'STRING', description: 'Subject line, max 60 znaků' }, previewText: { type: 'STRING', description: 'Preheader', nullable: true }, headline: { type: 'STRING', description: 'Hlavní nadpis v šabloně' }, bodyHtml: { type: 'STRING', description: 'Jako generate-email: vb-email-root + mobile CSS, typy (1)–(6), vrstvená pozadí — full-width tabulky pro tmavý/oranžový/žlutý pás, šedý pás #E8EDF4 s bílou vnitřní kartou, produkt vb-prod-*, webinář vb-web-split-* a 6a jako width 100 % tabulka; CTA #F06632; 4+ produktů data-product-collage + URL z get_products. Bez <!DOCTYPE>.' }, ctaText: { type: 'STRING' }, ctaUrl: { type: 'STRING' }, audience: { type: 'STRING', description: 'newsletter | no-newsletter', nullable: true }, fullHtml: { type: 'STRING', description: 'Volitelné: celý dokument jako hotové HTML pro Mailchimp. Jinak se vygeneruje z bodyHtml + Vividbooks obálka.', nullable: true } }, required: ['subject', 'headline', 'bodyHtml', 'ctaText', 'ctaUrl'] } },
  { name: 'get_email_drafts', description: 'Načte seznam existujících email draftů z Email Builderu.', parameters: { type: 'OBJECT', properties: {} } },
  // ── Delegace na specialisty ────────────────────────────────────────
  { name: 'delegate_to_seo_specialist', description: 'Předá zadání SEO specialistovi. Použij pro SEO brief, meta title/description, obsahovou strukturu, search intent, interní prolinkování a obsahovou strategii.', parameters: { type: 'OBJECT', properties: { task: { type: 'STRING', description: 'SEO nebo obsahový úkol.' }, context: { type: 'STRING', description: 'Doplňující kontext: URL, cílová stránka, publikum, produkt, téma.', nullable: true } }, required: ['task'] } },
  { name: 'delegate_to_image_specialist', description: 'Předá zadání image specialistovi. Použij pro cover image, koláž, hero vizuál, promo vizuál nebo doporučení podkladů a kompozice.', parameters: { type: 'OBJECT', properties: { task: { type: 'STRING', description: 'Jaký vizuál má vzniknout.' }, context: { type: 'STRING', description: 'Kontext: účel, rozměr, produkt, stránka, kampaň, reference.', nullable: true } }, required: ['task'] } },
  // ── RAG znalostní báze ────────────────────────────────────────────
  { name: 'rag_get_stats', description: 'Zobrazí statistiku RAG znalostní báze — počty chunků na zdroj (blog, novinky, webinare, produkty, tabs). Použij jako přehled před indexací.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'preview_blog_post', description: 'POUZIJ VZDY MISTO create_blog_post. Pripravi navrh clanku ke schvaleni uzivatelem — clanek se neuklada do DB. Uzivatel musi kliknout Schvalit, pak se teprve ulozi. DULEZITE: Pokud upravujes text existujiciho draftu (uzivatel dal feedback na text), ZACHOVEJ stejne coverImage URL — NEVOLEJ znovu generate_blog_image. generate_blog_image volej POUZE pri tvorbe uplne noveho clanku od zacatku NEBO kdyz uzivatel explicitne chce novy obrazek.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, slug: { type: 'STRING', nullable: true }, excerpt: { type: 'STRING', nullable: true }, author: { type: 'STRING', nullable: true }, category: { type: 'STRING', nullable: true }, content: { type: 'STRING', description: 'Plny HTML obsah clanku, min 400 slov.' }, coverImage: { type: 'STRING', description: 'URL cover obrazku. Pri uprave textu zachovej stejne URL jako v predchozim draftu — nevolej znovu generate_blog_image kvuli zmene textu.', nullable: true }, tags: { type: 'STRING', nullable: true }, readTime: { type: 'STRING', nullable: true } }, required: ['title', 'content'] } },
  { name: 'rag_index_item', description: 'Zaindexuje jednu konkrétní položku do RAG. Volej AUTOMATICKY po každém create_blog_post, create_novinka, create_webinar, update_blog_post, update_novinka, update_webinar. source: blog | novinky | webinare | produkty', parameters: { type: 'OBJECT', properties: { source: { type: 'STRING', description: 'blog | novinky | webinare | produkty' }, id: { type: 'STRING', description: 'ID položky' } }, required: ['source', 'id'] } },
  { name: 'rag_index_source', description: 'Přeindexuje CELÝ zdroj v RAG (smaže staré chunky, vytvoří nové). Trvá déle. source: blog | novinky | webinare | produkty | tabs', parameters: { type: 'OBJECT', properties: { source: { type: 'STRING', description: 'blog | novinky | webinare | produkty | tabs' } }, required: ['source'] } },
  { name: 'rag_remove_item', description: 'Odstraní položku z RAG (volej po delete_product, delete_webinar atd.).', parameters: { type: 'OBJECT', properties: { source: { type: 'STRING', description: 'blog | novinky | webinare | produkty' }, id: { type: 'STRING', description: 'ID položky' } }, required: ['source', 'id'] } },
  // ── Blog obrázky & AI koláže ──────────────────────────────────────
  { name: 'get_product_images', description: 'Vrátí seznam produktů s jejich URL obrázků. Použij před generate_blog_image pro výběr relevantních obrázků k tématu článku.', parameters: { type: 'OBJECT', properties: { filter_category: { type: 'STRING', description: 'Předmět nebo kategorie, např. "Matematika", "Český jazyk"', nullable: true }, filter_name_contains: { type: 'STRING', description: 'Substring v názvu produktu', nullable: true }, limit: { type: 'NUMBER', description: 'Max počet vrácených položek, výchozí 20', nullable: true } } } },
  { name: 'generate_blog_image', description: 'Vygeneruje AI koláž z obrázků produktů (Gemini Image) a uloží ji do Supabase Storage. Vrátí URL. Volej PRED preview_blog_post pokud chces cover obrazek. Styly: ai-table = obálky na stole, ai-knapsack = v batohu, ai-monochrome-classroom = jednobarevná třída (lavice, židle, interaktivní tabule vlevo) + sešity V1 (šité drátěnkou) na stole; ai-custom = vlastní anglický prompt.', parameters: { type: 'OBJECT', properties: { imageUrls: { type: 'ARRAY', items: { type: 'STRING' }, description: 'URL obálek produktů (1–6). Získej přes get_product_images.' }, style: { type: 'STRING', description: 'ai-table | ai-knapsack | ai-monochrome-classroom | ai-custom. Výchozí: ai-table', nullable: true }, styleReferenceUrls: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Jen u ai-monochrome-classroom: 1–3 veřejné URL referenčních obrázků stylu (moodboard). Edge je stáhne před obálkami produktů.', nullable: true }, monochromeColor: { type: 'STRING', description: 'Jen u ai-monochrome-classroom: popis barvy celé scény (např. "matná pastelová mint zelená", "#F5B5A0 coral"). Výchozí: pastelová korálová růžová.', nullable: true }, customPrompt: { type: 'STRING', description: 'Vlastní popis scény v angličtině. Použij jen se style=ai-custom.', nullable: true }, aspectRatio: { type: 'STRING', description: '16:9 (blog cover, doporučeno) | 4:3 | 1:1. Výchozí: 16:9', nullable: true } }, required: ['imageUrls'] } },
  // ── Přiřazení nahraného obrázku k produktu ────────────────────
  { name: 'assign_image_to_product', description: 'Přiřadí URL obrázku k produktu — nahradí jeho pole image. Použij, když uživatel nahraje foto a chce ho přidat k produktu. Nejprve zavolej get_products pro zjištění ID produktu.', parameters: { type: 'OBJECT', properties: { product_id: { type: 'STRING', description: 'ID produktu z get_products' }, image_url: { type: 'STRING', description: 'URL nového obrázku (z nahraného souboru nebo z internetu)' } }, required: ['product_id', 'image_url'] } },
  // ── Přidání obrázku do obsahu blog článku ────────────────────
  { name: 'add_image_to_blog_post', description: 'Přidá obrázek DO OBSAHU existujícího uloženého blog článku jako inline obr��zek. POUZIJ MISTO regenerace celého článku, když uživatel chce vložit/přidat fotku do textu článku. Nemazuje ani nepřepisuje obsah — jen vloží obrázek na zvolené místo. Pro nahrazení titulního (cover) obrázku pouzij update_blog_post s fields={coverImage: url}.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID blog článku z get_blog_posts' }, image_url: { type: 'STRING', description: 'URL obrázku k vložení do obsahu článku' }, position: { type: 'STRING', description: 'end (výchozí) | after_intro | beginning. end = na konec článku, after_intro = po prvním odstavci, beginning = na začátek', nullable: true }, caption: { type: 'STRING', description: 'Popisek pod obrázkem (volitelné)', nullable: true } }, required: ['id', 'image_url'] } },
  // ── Slider blok do blog článku ────────────────────────────────
  { name: 'add_slider_to_blog_post', description: 'Přidá slider (galerie obrázků s šipkami a miniatury) DO OBSAHU existujícího blog článku. Použij pro vložení více obrázků najednou jako proklíkatelnou galerii. Funguje jen pro již uložené články.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID blog článku z get_blog_posts' }, image_urls: { type: 'ARRAY', items: { type: 'STRING' }, description: 'URL obrázků pro slider (min. 2, max. 10)' }, captions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Volitelné popisky pro každý obrázek (stejné pořadí jako image_urls)', nullable: true }, caption: { type: 'STRING', description: 'Globální popisek pod sliderem (volitelné)', nullable: true }, position: { type: 'STRING', description: 'end (výchozí) | after_intro | beginning', nullable: true } }, required: ['id', 'image_urls'] } },
  // ── Tabs blok do blog článku ──────────────────────────────────
  { name: 'add_tabs_to_blog_post', description: 'Přidá záložkový (tabs) blok DO OBSAHU existujícího blog článku. Každý tab má label a textový obsah. Vhodné pro srovnání témat, ročníků, předmětů apod.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID blog článku z get_blog_posts' }, tabs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, content: { type: 'STRING' }, imageUrl: { type: 'STRING', nullable: true } } }, description: 'Záložky — každá má label (název tabu) a content (obsah jako text). Volitelně imageUrl pro obrázek nad textem.' }, heading: { type: 'STRING', description: 'Volitelný nadpis nad celým tabs blokem', nullable: true }, position: { type: 'STRING', description: 'end (výchozí) | after_intro | beginning', nullable: true } }, required: ['id', 'tabs'] } },
  // ── Subject Tabs (taby předmětů / prodejní argumenty) ────────
  { name: 'get_subject_tabs', description: 'Načte taby (záložky) pro konkrétní předmět nebo všechny. Volej PŘED create_subject_tab pro zjištění existujících tabů a pořadí.', parameters: { type: 'OBJECT', properties: { subject: { type: 'STRING', description: 'Název předmětu: "Matematika 1" | "Matematika 2" | "Fyzika" | "Chemie" | "Přírodopis" | "Český jazyk" | "Prvouka". Prázdné = všechny taby.', nullable: true } } } },
  { name: 'create_subject_tab', description: 'Vytvoří nový tab (záložku s prodejním argumentem) pro stránku školního předmětu. Zobrazí se na /predmet/fyzika apod. Automaticky zaindexuje do RAG.', parameters: { type: 'OBJECT', properties: { tabText: { type: 'STRING', description: 'Krátký název záložky / tlačítka (max 40 znaků), př. "Animace rýsování", "Krokové cvičení"' }, contentHeadline: { type: 'STRING', description: 'Nadpis obsahu tabu — výrazný, poutavý pro učitele' }, contentRichText: { type: 'STRING', description: 'Popis obsahu tabu — min 3 věty. Popis výhod, funkcí, co to přináší učitelům/žákům. Bez HTML tagů.' }, subject: { type: 'STRING', description: 'Přesný název předmětu: "Matematika 1" | "Matematika 2" | "Fyzika" | "Chemie" | "Přírodopis" | "Český jazyk" | "Prvouka"' }, contentImage: { type: 'STRING', description: 'URL obrázku (prázdné pokud nemáš)', nullable: true }, order: { type: 'NUMBER', description: 'Pořadí tabu (0 = poslední). Zjisti z get_subject_tabs.', nullable: true }, bgColor: { type: 'STRING', description: 'Barva pozadí (volitelné, hex kód)', nullable: true }, subpage: { type: 'STRING', description: 'Identifikátor podstránky (volitelné)', nullable: true } }, required: ['tabText', 'contentHeadline', 'contentRichText', 'subject'] } },
  { name: 'update_subject_tab', description: 'Aktualizuje existující tab předmětu. Nejdřív zavolej get_subject_tabs pro zjištění ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID tabu z get_subject_tabs' }, tabText: { type: 'STRING', nullable: true }, contentHeadline: { type: 'STRING', nullable: true }, contentRichText: { type: 'STRING', nullable: true }, contentImage: { type: 'STRING', nullable: true }, order: { type: 'NUMBER', nullable: true }, bgColor: { type: 'STRING', nullable: true } }, required: ['id'] } },
  { name: 'delete_subject_tab', description: 'Smaže tab předmětu. Nejdřív zavolej get_subject_tabs pro zjištění ID.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'ID tabu z get_subject_tabs' } }, required: ['id'] } },
  // ── Klasická canvas koláž (handoff do UI) ────────────────────
  { name: 'open_collage_builder', description: 'Otevře Koláž Builder v UI s předvybranými obrázky a stylem. Použij místo generate_blog_image pokud chce uživatel KLASICKÝ styl koláže (scattered = rozházené, grid = mřížka, fan = vějíř) — ne AI generaci. Agent doporučí obrázky a styl, uživatel dokončí koláž v dialogu sám.', parameters: { type: 'OBJECT', properties: { image_urls: { type: 'ARRAY', items: { type: 'STRING' }, description: 'URL obrázků produktů k předvýběru (získej přes get_product_images). Min. 2.' }, style: { type: 'STRING', description: 'scattered (rozházené s rotací) | grid (mřížka) | fan (vějíř). Výchozí: grid' }, note: { type: 'STRING', description: 'Volitelná poznámka uživateli (proč jsi vybral tyto obrázky / tento styl)', nullable: true } }, required: ['image_urls'] } },
];

/** Režim „asistent v aplikaci“ (diktování): jen čtení + RAG + textová pomoc — žádné zápisy do CMS ani Mailchimp. */
const EMBEDDED_ASSISTANT_TOOL_NAMES = new Set([
  'get_products',
  'get_broken_products',
  'get_price_overview',
  'get_dashboard_summary',
  'get_newsletter_stats',
  'search_all',
  'get_hero_slides',
  'get_subject_pages',
  'get_blog_posts',
  'get_webinars',
  'get_notifications',
  'get_novinky',
  'get_email_drafts',
  'get_subject_tabs',
  'get_product_images',
  'rag_get_stats',
]);

const EMBEDDED_ASSISTANT_TOOLS = ADMIN_AGENT_TOOLS.filter((t: { name: string }) => EMBEDDED_ASSISTANT_TOOL_NAMES.has(t.name));

/** Obchodník v aplikaci: stejné čtení webu/RAG jako embedded Web operátor + delegace na CRM (Pipedrive). */
const CRM_ASSISTANT_TOOL_NAMES = new Set([...EMBEDDED_ASSISTANT_TOOL_NAMES, 'sales_crm_orchestrate']);

const CRM_ASSISTANT_TOOLS = [
  ...EMBEDDED_ASSISTANT_TOOLS,
  {
    name: 'sales_crm_orchestrate',
    description:
      'Deleguje na CRM backend (Pipedrive): vyhledání škol, organizací, kontaktů, dealů, přístupových kódů; plánování trasy s kontakty po cestě; kontakt ředitele/učitele; úkoly; Google kalendář (schůzka / čtení kalendáře). Použij při takových dotazích — předej přesné znění požadavku uživatele.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: {
          type: 'STRING',
          description: 'Přesný dotaz uživatele nebo krátké shrnutí požadavku v češtině.',
        },
      },
      required: ['message'],
    },
  },
];

const EMBEDDED_ASSISTANT_SYSTEM = `Jsi **asistent Vividbooks** v mobilní aplikaci (diktování). Tento režim **není** plný Web operátor z administrace.

## Co MÁŠ dělat
- **Informační dotazy** — odpovídej na základě doplnění „Kontext z RAG“ a případně nástrojů **get_*** (jen čtení dat z katalogu / webu).
- **Formulace e-mailů** — pomáhej psát a upravovat texty pro školy a zákazníky: předmět, tón, struktura. Výstup: **jedna** finální verze v odpovědi (Markdown) — jeden předmět a jedno tělo. **Nepřidávej druhou variantu** (žádné „A/B“, dvojí předmět ani „krátká vs. dlouhá“ vedle sebe), pokud uživatel výslovně nepožádá o více možností k porovnání. To je **copy v chatu**, ne ukládání do systému.
- **Ověřování faktů** — pokud potřebuješ ceny, názvy produktů, termíny webinářů, použij příslušný get_* nástroj.

## Co NESMÍŠ (v tomto režimu nejsou nástroje)
- Neměň **CMS**, **web**, **produkty**, **blog**, **novinky**, **webináře**, **hero**, **taby**, **notifikace**.
- Nevytvářej **Mailchimp / Email Builder** šablony, nevolaj \`create_email_campaign_draft\`, neukládej HTML kampaní do canvasu — uživatel dostává jen **textovou pomoc** v chatu.
- Neindexuj ani neměň **RAG** (žádné rag_index_*, rag_remove_*).
- Nepředávej úkoly „specialistům“ na změny webu — můžeš stručně poradit, ale neprovádět je.

## Když uživatel chce změnit web nebo Mailchimp
Stručně vysvětli, že kompletní úpravy patří do **administrace → Web operátor** (plná verze), ne do této aplikace.

## Styl
Česky, stručně, profesionálně. Nevymýšlej si fakta — když nejsou v RAG ani v get_*, řekni to.`;

const CRM_ASSISTANT_SYSTEM = `${EMBEDDED_ASSISTANT_SYSTEM}

## CRM (Pipedrive) — navíc oproti výše
- Máš nástroj **sales_crm_orchestrate** pro vše, co souvisí s **konkrétními školami v CRM, kontakty, dealy, trasou mezi městy, úkoly a kalendářem**.
- Do nástroje vždy předej parametr **message** = přesné znění záměru uživatele (nebo stručné shrnutí).
- Po návratu nástroje uživateli odpověz v **stejném stylu** jako výše (profesionální čeština, Markdown), a využij strukturovaná data z výsledku, pokud jsou k dispozici.
- Dotazy na **nabídku, webináře, produkty, obecné informace z webu** řeš přednostně **get_*** nástroji a kontextem RAG; **sales_crm_orchestrate** použij, když jde o **CRM akci** nebo konkrétní zákazníky v Pipedrive.

## Jedna verze (Obchodník)
Při jakékoli formulaci mailu, novinky nebo obchodního textu: **vždy jen jedna** hotová verze. Nedávej dvě varianty v jedné odpovědi.

## Dotazy na školy / CRM výpis
Když **sales_crm_orchestrate** vrátí \`action: crm_search\` a strukturovaná \`crmData\` (organizace), **nepiš** do textové odpovědi žádné shrnutí dealů — žádné „Ztracené příležitosti“, žádné seznamy škol v Markdownu, žádné A/B. Aplikace zobrazí **klikací karty aktivních zákazníků**; tvoje odpověď má být **prázdná** nebo jedna krátká věta typu „Školy jsou níže.“ Pokud opravdu nemáš co říct, vrať prázdný text.

## Chyby z CRM orchestrátoru
Když výsledek nástroje obsahuje \`orchestrator.success === false\` a neprázdné \`orchestrator.response\`, **převezměň tento text uživateli** (můžeš ho mírně srovnat do souvětí). **Nevymýšlej** obecné věty typu „nedaří se mi připojit k CRM (chyba autorizace)“ nebo „zkontrolujte Pipedrive“, pokud přesně to v \`orchestrator.response\` není.`;

/** Poslední zprávy z Web operátora → chatHistory pro EmailBuilder (Marketing / E-maily). */
function adminAgentMessagesToEmailChatHistory(msgs: any[]): any[] {
  if (!Array.isArray(msgs) || msgs.length === 0) return [];
  const base = Date.now();
  const out: any[] = [];
  let seq = 0;
  for (const m of msgs) {
    const role =
      m.role === 'user' ? 'user' : m.role === 'assistant' || m.role === 'model' ? 'ai' : null;
    if (!role) continue;
    let content = String(m.content ?? '').trim();
    if (Array.isArray(m.images) && m.images.length) {
      content = content
        ? `${content}\n\n[Přiloženo ${m.images.length} obr.]`
        : `[Přiloženo ${m.images.length} obr.]`;
    }
    if (!content) continue;
    if (content.length > 18_000) content = `${content.slice(0, 18_000)}\n\n…(zkráceno)`;
    out.push({
      id: `wo-${base}-${seq}`,
      role,
      content,
      timestamp: new Date(base + seq * 1000).toISOString(),
    });
    seq += 1;
  }
  return out;
}

async function runAdminTool(
  name: string,
  args: any,
  ctx?: { agentMessages?: any[] },
): Promise<{ result: any; action?: any }> {
  const allowed = (globalThis as any).__adminAgentAllowedTools as Set<string> | undefined;
  if (allowed && !allowed.has(name)) {
    return {
      result: {
        error:
          `Nástroj „${name}“ není v tomto režimu dostupný. Pro změny na webu nebo Mailchimp použijte plný Web operátor v administraci.`,
      },
    };
  }
  const ts = new Date().toISOString();

  if (name === 'sales_crm_orchestrate') {
    const msg = String(args?.message ?? '').trim();
    if (!msg) {
      return { result: { error: 'Chybí parametr message.' } };
    }
    const reqCtx = (globalThis as any).__crmAgentRequestContext as {
      googleAccessToken?: string | null;
      lastRouteData?: { origin?: string; destination?: string; locations?: string[] } | null;
      conversationHistory?: any[];
    } | null;
    const hist = Array.isArray(reqCtx?.conversationHistory)
      ? reqCtx!.conversationHistory!.slice(-5).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content ?? ''),
        }))
      : [];
    const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
    const anon = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
    const service = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    /**
     * Brána `/functions/v1` musí dostat **souladné** hlavičky: `Authorization` a `apikey` musí být **stejný** JWT (ověřeno proti produkci).
     * Kombinace `Bearer <service_role>` + `apikey: <anon>` vrací HTTP 401. Preferujeme veřejný anon (stejně jako klientské volání).
     */
    const gate = anon || service;
    if (!base || !gate) {
      return { result: { error: 'Chybí SUPABASE_URL nebo SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY pro volání CRM.' } };
    }
    try {
      const res = await fetch(`${base}/functions/v1/make-server-954b19ad/agent/orchestrate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gate}`,
          apikey: gate,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: msg,
          conversationHistory: hist,
          googleAccessToken: reqCtx?.googleAccessToken ?? null,
          lastRouteData: reqCtx?.lastRouteData ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const emptyCrm = { organizations: [] as any[], persons: [] as any[], deals: [] as any[] };

      if (!res.ok) {
        const apiMsg =
          typeof (data as any)?.message === 'string'
            ? (data as any).message
            : typeof (data as any)?.msg === 'string'
              ? (data as any).msg
              : '';
        const payload = {
          success: false,
          action: 'crm_search',
          response:
            res.status === 401
              ? `Volání CRM backendu selhalo (HTTP 401). Nasazení: \`supabase functions deploy make-server-954b19ad --no-verify-jwt\` (brána), případně zkontrolujte SUPABASE_URL a klíče u funkcí.`
              : `Volání CRM backendu selhalo (HTTP ${res.status}). ${apiMsg || 'Zkuste to prosím znovu.'}`,
          voiceSummary: 'CRM backend nedostupný.',
          crmData: emptyCrm,
        };
        (globalThis as any).__lastCrmOrchestratorPayload = payload;
        return {
          result: {
            ok: false,
            orchestrator: payload,
            hint: 'Přepiš uživateli přesně orchestrator.response. Nevymýšlej vlastní omluvy za „autorizaci Pipedrive“ ani obecné technické fráze.',
          },
        };
      }

      (globalThis as any).__lastCrmOrchestratorPayload = data;
      const crmSearchWithOrgs =
        data?.action === 'crm_search' &&
        Array.isArray(data?.crmData?.organizations) &&
        data.crmData.organizations.length > 0;
      const orchestratorFailed =
        data?.success === false && typeof (data as any)?.response === 'string' && String((data as any).response).trim();
      const hint = crmSearchWithOrgs
        ? 'CRM hledání škol: NEPISUJ textové shrnutí dealů ani „ztracené příležitosti“. Odpověď = prázdný řetězec. Karty aktivních zákazníků už zobrazí aplikace.'
        : orchestratorFailed
          ? 'Orchestrátor vrátil success=false — přepiš uživateli přesně orchestrator.response. Nevymýšlej obecné omluvy za autorizaci CRM ani Pipedrive, pokud to není v orchestrator.response.'
          : 'Shrň uživateli odpověď z orchestrator.response; strukturovaná data (crmData, routeData) jsou v orchestrator.';
      return {
        result: {
          ok: true,
          orchestrator: data,
          hint,
        },
      };
    } catch (e: any) {
      return { result: { error: e?.message || 'CRM orchestrátor nedostupný.' } };
    }
  }

  if (name === 'get_products') {
    let products = await getAllProducts();
    if (args.filter_type && args.filter_type !== 'all') products = products.filter((p: any) => p.type === args.filter_type);
    if (args.filter_category) products = products.filter((p: any) => (p.category || '').toLowerCase().includes(args.filter_category.toLowerCase()));
    if (args.filter_name_contains) {
      const needle = args.filter_name_contains.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      products = products.filter((p: any) => {
        const hay = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return hay.includes(needle);
      });
    }
    const fullFields = args.full_fields === true;
    const maxOut = fullFields ? 60 : 250;
    const slice = products.slice(0, maxOut);
    const outProducts = fullFields ? slice : slice.map(slimProductForAgent);
    const truncated = products.length > maxOut;
    console.log(`[AdminAgent] get_products → ${products.length} matched, returning ${outProducts.length} (full_fields=${fullFields}, truncated=${truncated})`);
    return {
      result: {
        count: products.length,
        returned: outProducts.length,
        truncated,
        full_fields: fullFields,
        products: outProducts,
      },
    };
  }
  if (name === 'update_product') {
    const products = await getAllProducts();
    const idx = products.findIndex((p: any) => p.id === args.id);
    if (idx === -1) return { result: { error: `Produkt ${args.id} nenalezen` } };
    const before = { ...products[idx] };
    products[idx] = { ...products[idx], ...args.fields, updatedAt: ts };
    await saveAllProducts(products);
    // Auto-embed do RAG — skip when agent deadline is tight (< 40s remaining)
    const deadline = (globalThis as any).__agentDeadline || Infinity;
    const apiKeyProd = Deno.env.get('GEMINI_API_KEY_RAG');
    let ragEmbedded = false;
    let ragSkipped = false;
    if (apiKeyProd && (deadline - Date.now()) > 40_000) {
      try {
        const updatedProduct = products[idx];
        const rawText = productToText(updatedProduct);
        const chunks = chunkText(rawText);
        const existingAll = await loadAllChunks();
        for (const ch of existingAll.filter((c: any) => c?.metadata?.source === 'produkty' && c?.metadata?.sourceId === args.id)) {
          await removeChunk(ch.id);
        }
        for (let ci = 0; ci < chunks.length; ci++) {
          const embedding = await embedText(chunks[ci]);
          await saveChunk({ id: `produkty_${args.id}_${ci}`, text: chunks[ci], embedding, embeddingDims: embedding.length, metadata: { source: 'produkty', sourceId: args.id, title: updatedProduct.name || '', chunkIndex: ci, tokens: Math.round(chunks[ci].length / 4), quality: qualityScore(chunks[ci]), createdAt: ts } });
          await new Promise(r => setTimeout(r, 60));
        }
        ragEmbedded = true;
        console.log(`[AdminAgent] update_product auto-RAG: ${args.id} → ${chunks.length} chunků`);
      } catch (ragErr: any) { console.log(`[AdminAgent] update_product RAG chyba: ${ragErr.message}`); }
    } else if (apiKeyProd) {
      ragSkipped = true;
      console.log(`[AdminAgent] update_product RAG skipped — deadline tight (${deadline - Date.now()}ms left)`);
    }
    return { result: { success: true, id: args.id, name: before.name, ragEmbedded, ragSkipped }, action: { type: 'update_product', id: args.id, name: before.name, fields: args.fields, ragEmbedded, ragSkipped, reviewPath: `/admin/kolekce/produkty` } };
  }
  if (name === 'bulk_update_products') {
    let products = await getAllProducts();
    let filtered = products;
    if (args.filter_type) filtered = filtered.filter((p: any) => p.type === args.filter_type);
    if (args.filter_category) filtered = filtered.filter((p: any) => (p.category || '').toLowerCase().includes(args.filter_category.toLowerCase()));
    if (args.filter_name_contains) {
      const needle = args.filter_name_contains.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      filtered = filtered.filter((p: any) => {
        const hay = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return hay.includes(needle);
      });
    }
    console.log(`[AdminAgent] bulk_update_products → ${filtered.length} produktů k úpravě, fields=${JSON.stringify(args.fields)}`);
    const ids = new Set(filtered.map((p: any) => p.id));
    const updated = products.map((p: any) => ids.has(p.id) ? { ...p, ...args.fields, updatedAt: ts } : p);
    await saveAllProducts(updated);
    // Skip RAG entirely in bulk updates to prevent timeouts — user can reindex via rag_index_source
    let ragNote = `${filtered.length} produktů upraveno. Pro aktualizaci RAG spusť rag_index_source.`;
    const nameSample = filtered.slice(0, 40).map((p: any) => p.name);
    return {
      result: {
        success: true,
        updatedCount: ids.size,
        nameSample,
        nameSampleCount: nameSample.length,
        namesTruncated: filtered.length > nameSample.length,
        ragNote,
      },
      action: { type: 'bulk_update_products', count: ids.size, fields: args.fields, ragNote, reviewPath: '/admin/kolekce/produkty' },
    };
  }
  if (name === 'create_product') {
    const newProduct: any = { id: `sb-${Date.now()}`, createdAt: ts, updatedAt: ts, ...args };
    const products = await getAllProducts();
    await saveAllProducts([...products, newProduct]);
    // Auto-embed do RAG — skip when deadline tight
    const createDeadline = (globalThis as any).__agentDeadline || Infinity;
    const apiKeyCreate = Deno.env.get('GEMINI_API_KEY_RAG');
    let ragEmbedded = false;
    if (apiKeyCreate && (createDeadline - Date.now()) > 40_000) {
      try {
        const rawText = productToText(newProduct);
        const chunks = chunkText(rawText);
        for (let ci = 0; ci < chunks.length; ci++) {
          const embedding = await embedText(chunks[ci]);
          await saveChunk({ id: `produkty_${newProduct.id}_${ci}`, text: chunks[ci], embedding, embeddingDims: embedding.length, metadata: { source: 'produkty', sourceId: newProduct.id, title: newProduct.name || '', chunkIndex: ci, tokens: Math.round(chunks[ci].length / 4), quality: qualityScore(chunks[ci]), createdAt: ts } });
          await new Promise(r => setTimeout(r, 60));
        }
        ragEmbedded = true;
      } catch (ragErr: any) { console.log(`[AdminAgent] create_product RAG chyba: ${ragErr.message}`); }
    } else if (apiKeyCreate) {
      console.log(`[AdminAgent] create_product RAG skipped — deadline tight`);
    }
    console.log(`[AdminAgent] create_product → id=${newProduct.id}, name=${newProduct.name}, ragEmbedded=${ragEmbedded}`);
    return { result: { success: true, id: newProduct.id, name: newProduct.name, ragEmbedded }, action: { type: 'create_product', id: newProduct.id, name: newProduct.name, reviewPath: '/admin/kolekce/produkty' } };
  }
  if (name === 'get_hero_slides') {
    const items = await getCollection(HERO_SLIDES_KEY);
    return { result: { count: items.length, slides: items } };
  }
  if (name === 'create_hero_slide') {
    const item = { id: `slide-${Date.now()}`, ...args, active: args.active ?? true, createdAt: ts };
    const items = await getCollection(HERO_SLIDES_KEY);
    await saveCollection(HERO_SLIDES_KEY, [...items, item]);
    return { result: { success: true, id: item.id, title: item.title }, action: { type: 'create_hero_slide', id: item.id, title: item.title, reviewPath: '/admin/kolekce/hero-slidy' } };
  }
  if (name === 'update_hero_slide') {
    const items = await getCollection(HERO_SLIDES_KEY);
    const idx = items.findIndex((s: any) => s.id === args.id);
    if (idx === -1) return { result: { error: `Slide ${args.id} nenalezen` } };
    items[idx] = { ...items[idx], ...args.fields, updatedAt: ts };
    await saveCollection(HERO_SLIDES_KEY, items);
    return { result: { success: true, id: args.id }, action: { type: 'update_hero_slide', id: args.id, fields: args.fields, reviewPath: '/admin/kolekce/hero-slidy' } };
  }
  if (name === 'get_subject_pages') {
    const items = await getCollection(SUBJECT_PAGES_KEY);
    const normalize = (v: any) => String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const query = String(args.query || '').trim();
    let filtered = items;
    if (query) {
      const needle = normalize(query);
      filtered = items.filter((item: any) => [
        item.id,
        item.displayName,
        item.slug,
        item.tagline,
      ].some((value: any) => normalize(value).includes(needle)));
    }
    if (args.active_only) filtered = filtered.filter((item: any) => item.isActive !== false);
    const sorted = [...filtered].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    console.log(`[AdminAgent] get_subject_pages → ${sorted.length} items (query=${query || '-'}, active_only=${!!args.active_only})`);
    return { result: { count: sorted.length, subjects: sorted.slice(0, 200) } };
  }
  if (name === 'create_subject_page') {
    const extraFields = (args.extraFields && typeof args.extraFields === 'object') ? args.extraFields : {};
    const item = {
      id: args.id || `subj-agent-${Date.now()}`,
      createdAt: ts,
      updatedAt: ts,
      ...args,
      ...extraFields,
    };
    delete item.extraFields;
    const items = await getCollection(SUBJECT_PAGES_KEY);
    await saveCollection(SUBJECT_PAGES_KEY, [...items, item]);
    await syncSubjectFaqRag(item);
    console.log(`[AdminAgent] create_subject_page → ${item.id} "${item.displayName}"`);
    return {
      result: { success: true, id: item.id, displayName: item.displayName, slug: item.slug },
      action: { type: 'create_subject_page', id: item.id, name: item.displayName, fields: item, reviewPath: '/admin/kolekce/predmety' },
    };
  }
  if (name === 'update_subject_page') {
    const items = await getCollection(SUBJECT_PAGES_KEY);
    const idx = items.findIndex((s: any) => s.id === args.id);
    if (idx === -1) return { result: { error: `Předmět ${args.id} nenalezen` } };
    const before = items[idx];
    const merged = { ...before, ...args.fields, updatedAt: ts };
    items[idx] = merged;
    await saveCollection(SUBJECT_PAGES_KEY, items);
    await syncSubjectFaqRag(merged);
    console.log(`[AdminAgent] update_subject_page ${args.id} "${merged.displayName}" fields=${Object.keys(args.fields || {}).join(',')}`);
    return {
      result: { success: true, id: args.id, displayName: merged.displayName, slug: merged.slug },
      action: { type: 'update_subject_page', id: args.id, name: merged.displayName || before.displayName, fields: args.fields, reviewPath: '/admin/kolekce/predmety' },
    };
  }
  if (name === 'delete_subject_page') {
    const items = await getCollection(SUBJECT_PAGES_KEY);
    const item = items.find((s: any) => s.id === args.id);
    if (!item) return { result: { error: `Předmět ${args.id} nenalezen` } };
    await saveCollection(SUBJECT_PAGES_KEY, items.filter((s: any) => s.id !== args.id));
    try {
      await removeChunk(`predmet_faq_${args.id}`);
    } catch (_) { /* ignore */ }
    console.log(`[AdminAgent] delete_subject_page ${args.id} "${item.displayName}"`);
    return {
      result: { success: true, id: args.id, displayName: item.displayName },
      action: { type: 'delete_subject_page', id: args.id, name: item.displayName, reviewPath: '/admin/kolekce/predmety' },
    };
  }
  if (name === 'get_blog_posts') {
    const items = await getCollection(BLOG_KEY);
    const limit = args.limit || 20;
    return { result: { count: items.length, posts: items.slice(0, limit) } };
  }
  if (name === 'preview_blog_post') {
    // Sestaví kompletní draft ale NEULOŽÍ ho — vrátí jako akci ke schválení frontendem
    const rawContent = args.content || '';
    const contentBlocks = parseContentBlocks(String(rawContent));
    const excerpt = args.excerpt || (contentBlocks.find((b: any) => b.type === 'paragraph')?.text || '').slice(0, 280);
    const wordCount = contentBlocks.filter((b: any) => b.type === 'paragraph').reduce((n: number, b: any) => n + (b.text || '').split(/\s+/).length, 0);
    const readTime = args.readTime ? parseInt(String(args.readTime)) || 5 : Math.max(3, Math.ceil(wordCount / 200));
    const draft = {
      title: args.title,
      slug: args.slug || `blog-${Date.now()}`,
      author: args.author || 'Vividbooks',
      category: args.category || 'Aktuality',
      tags: args.tags || '',
      excerpt,
      readTime,
      coverImage: args.coverImage || args.imageUrl || '',
      content: contentBlocks,
      contentHtml: String(rawContent),
      date: new Date().toLocaleDateString('cs-CZ'),
    };
    console.log(`[AdminAgent] preview_blog_post: "${draft.title}" — ${contentBlocks.length} bloků, cover=${!!draft.coverImage}`);
    return {
      result: { success: true, preview: true, message: 'Náhled připraven. Čekám na schválení uživatele.' },
      action: { type: 'blog_draft_preview', draft, title: draft.title }
    };
  }
  if (name === 'get_product_images') {
    let products = await getAllProducts();
    if (args.filter_category) products = products.filter((p: any) => (p.category || p.predmet || '').toLowerCase().includes((args.filter_category || '').toLowerCase()));
    if (args.filter_name_contains) {
      const needle = (args.filter_name_contains || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      products = products.filter((p: any) => ((p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).includes(needle));
    }
    const limit = args.limit || 20;
    const withImages = products.filter((p: any) => p.image || p.coverImage).slice(0, limit);
    console.log(`[AdminAgent] get_product_images → ${withImages.length} produktů s obrázky`);
    return { result: { count: withImages.length, products: withImages.map((p: any) => ({ id: p.id, name: p.name, category: p.category || p.predmet, imageUrl: p.image || p.coverImage, coverImageUrl: p.coverImage || p.image })) } };
  }
  if (name === 'generate_blog_image') {
    const geminiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!geminiKey) return { result: { error: 'GEMINI_API_KEY_RAG není nastaven.' } };

    const MAX_INLINE = 8;
    const MAX_STYLE_REFS = 3;
    const style = args.style || 'ai-table';
    const aspectRatio = args.aspectRatio || '16:9';

    const productUrls: string[] = (args.imageUrls || [])
      .filter((u: unknown) => typeof u === 'string' && (u as string).trim())
      .slice(0, 6)
      .map((u: string) => u.trim());
    if (productUrls.length === 0) return { result: { error: 'imageUrls musí obsahovat alespoň jednu URL obálky produktu.' } };

    const styleRefUrls: string[] =
      style === 'ai-monochrome-classroom' && Array.isArray(args.styleReferenceUrls)
        ? args.styleReferenceUrls
            .filter((u: unknown) => typeof u === 'string' && (u as string).trim())
            .slice(0, MAX_STYLE_REFS)
            .map((u: string) => u.trim())
        : [];

    const monochromeColor =
      (args.monochromeColor && String(args.monochromeColor).trim()) || 'matte pastel coral-pink';

    async function pushImageFromUrl(
      url: string,
      acc: { inlineData: { mimeType: string; data: string } }[],
    ): Promise<boolean> {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'VividBooks-AI/1.0' } });
        if (!res.ok) {
          console.log(`[generate_blog_image] Přeskočen ${url}: ${res.status}`);
          return false;
        }
        const ct = res.headers.get('content-type') || 'image/jpeg';
        const mimeType = ct.split(';')[0].trim();
        const buf = await res.arrayBuffer();
        acc.push({ inlineData: { mimeType, data: encodeBase64(new Uint8Array(buf)) } });
        return true;
      } catch (e: any) {
        console.log(`[generate_blog_image] Chyba ${url}: ${e.message}`);
        return false;
      }
    }

    const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
    let styleLoaded = 0;
    for (const url of styleRefUrls) {
      if (imageParts.length >= MAX_INLINE) break;
      if (await pushImageFromUrl(url, imageParts)) styleLoaded++;
    }
    for (const url of productUrls) {
      if (imageParts.length >= MAX_INLINE) break;
      await pushImageFromUrl(url, imageParts);
    }
    const productLoaded = imageParts.length - styleLoaded;
    if (productLoaded === 0) return { result: { error: 'Nepodařilo se načíst žádný obrázek produktu.' } };

    const AI_PROMPTS_LOCAL: Record<string, string> = {
      'ai-table': `Create a beautiful, realistic overhead photograph of these ${productLoaded} educational workbook covers (Czech school notebooks / sešity) arranged naturally and casually on a clean light wooden desk surface. The arrangement is organic — slightly overlapping, with varied gentle rotations, all covers clearly visible. Warm soft natural daylight. Inviting, study-friendly mood. Show the actual cover artwork faithfully. No extra objects or text.`,
      'ai-knapsack': `Create a realistic photograph of an open school backpack with these ${productLoaded} educational workbook covers (Czech school notebooks / sešity) spilling out naturally onto a wooden desk. Some books inside, some partially out. Warm natural lighting, cozy school atmosphere. Show the actual cover artwork faithfully. No extra text.`,
    };

    let basePrompt: string;
    if (style === 'ai-monochrome-classroom') {
      const refBlock =
        styleLoaded > 0
          ? `STYLE REFERENCES: The first ${styleLoaded} attached image(s) show the target look — minimalist monochromatic matte classroom (desk + chairs + seamless backdrop), soft diffused light, modern tubular school furniture, subtle shadows for depth only. Copy this visual language and camera mood, but recolor the ENTIRE new scene to the single hue specified below (ignore the reference images' original colors).\n\n`
          : '';
      const productBlock = `PRODUCT NOTEBOOK COVERS: The last ${productLoaded} attached image(s) are real workbook cover artworks. Place them as physical notebooks resting on the desk — reproduce each cover design faithfully.\n\n`;
      const sceneBlock = `SCENE: Monochromatic Czech classroom still-life. One unified matte color throughout: ${monochromeColor} — applied to desk, chairs, floor, wall, and any visible wall-mounted interactive whiteboard / smart display (same hue; depth from lightness gradients only). Include a modern school desk with rounded corners and a long shallow integrated pencil groove; tubular metal frame; at least one chair with a round seat and curved backrest. CAMERA (CRITICAL): medium-to-tight close-up centered on the desk top — the ${productLoaded} physical notebook(s) must be large in frame (roughly half to two-thirds of the image area), cover art legible. Use a moderate three-quarter or slightly elevated angle toward the desk front, NOT a distant high-angle room establishing shot. Prefer cropping out most of the empty floor and distant wall; if a whiteboard appears, only as a partial strip on the left edge, secondary to the books. Clean surreal product-render aesthetic.\n\n`;
      const v1Block = `NOTEBOOK BINDING (MANDATORY — Czech school "V1" sešit): Each item must read as a thin stitched notebook, NOT a thick book. Use saddle-stitch / brochure binding: folded paper signatures, 2–3 visible metal staples along the spine, a soft paper fold at the spine, flexible low profile, matte paper edges visible at the fore edge. FORBIDDEN: thick square glued spine, perfect binding, hardcover brick block shape.\n\n`;
      const tail = `No extra text beyond what appears on the printed covers. No second accent color breaking the monochrome world.`;
      basePrompt = refBlock + productBlock + sceneBlock + v1Block + tail;
    } else if (style === 'ai-custom' && args.customPrompt) {
      basePrompt = args.customPrompt;
    } else {
      basePrompt = AI_PROMPTS_LOCAL[style] || AI_PROMPTS_LOCAL['ai-table'];
    }

    const aspectInstruction =
      aspectRatio !== '1:1'
        ? `OUTPUT FORMAT: Generate this image in ${aspectRatio} aspect ratio (width:height). Compose the scene natively in this ratio.\n\n`
        : '';
    const finalPrompt = aspectInstruction + basePrompt;
    console.log(
      `[AdminAgent] generate_blog_image: styleRefs=${styleLoaded} products=${productLoaded} style=${style} aspect=${aspectRatio}`,
    );
    // Gemini call
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${geminiKey}`;
    const geminiBody = { contents: [{ role: 'user', parts: [...imageParts, { text: finalPrompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } };
    const geminiRes = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) });
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.log(`[generate_blog_image] Gemini error ${geminiRes.status}: ${errText.slice(0, 300)}`);
      return { result: { error: `Gemini chyba ${geminiRes.status}: ${errText.slice(0, 150)}` } };
    }
    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.data);
    if (!imgPart) {
      const textPart = parts.find((p: any) => p.text);
      return { result: { error: `Gemini nevygeneroval obrázek. ${textPart?.text?.slice(0, 150) || 'Neznámá chyba'}` } };
    }
    const { mimeType: outMime, data: outB64 } = imgPart.inlineData;
    const ext = outMime?.includes('png') ? 'png' : 'jpg';
    const binaryStr = atob(outB64);
    const outBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) outBytes[i] = binaryStr.charCodeAt(i);
    const sb = await getStorageClient();
    const filename = `blog-ai-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from(IMAGE_BUCKET).upload(filename, outBytes.buffer, { contentType: outMime, upsert: false });
    if (upErr) return { result: { error: `Storage upload selhal: ${upErr.message}` } };
    const { data: pubData } = sb.storage.from(IMAGE_BUCKET).getPublicUrl(filename);
    console.log(`[generate_blog_image] Hotovo → ${pubData.publicUrl}`);
    return { result: { success: true, imageUrl: pubData.publicUrl, style, aspectRatio }, action: { type: 'generate_blog_image', imageUrl: pubData.publicUrl, style, sourceCount: imageParts.length } };
  }
  if (name === 'create_blog_post') {
    // Parsuj HTML obsah → strukturované bloky (BlogBlock[]) pro správný rendering
    const rawContent = args.content || '';
    let contentBlocks: any[];
    if (Array.isArray(rawContent)) {
      contentBlocks = rawContent; // agent předal přímo pole bloků
    } else {
      // HTML string → parseContentBlocks
      contentBlocks = parseContentBlocks(String(rawContent));
    }
    const excerpt = args.excerpt || (contentBlocks.find((b: any) => b.type === 'paragraph')?.text || '').slice(0, 280);
    const wordCount = contentBlocks.filter((b: any) => b.type === 'paragraph').reduce((n: number, b: any) => n + (b.text || '').split(/\s+/).length, 0);
    const readTime = args.readTime ? parseInt(String(args.readTime)) || 5 : Math.max(3, Math.ceil(wordCount / 200));
    // coverImage: přijmeme buď coverImage nebo imageUrl
    const coverImage = args.coverImage || args.imageUrl || '';
    const item = {
      id: `blog-${Date.now()}`,
      slug: args.slug || `blog-${Date.now()}`,
      published: false,
      date: new Date().toLocaleDateString('cs-CZ'),
      title: args.title,
      author: args.author || 'Vividbooks',
      category: args.category || 'Aktuality',
      tags: args.tags || '',
      excerpt,
      readTime,
      coverImage,
      content: contentBlocks,
      contentHtml: typeof rawContent === 'string' ? rawContent : '',
      createdAt: ts,
    };
    const items = await getCollection(BLOG_KEY);
    await saveCollection(BLOG_KEY, [...items, item]);
    console.log(`[AdminAgent] create_blog_post: "${item.title}" — ${contentBlocks.length} bloků, cover=${!!coverImage}`);
    return { result: { success: true, id: item.id, title: item.title, blocksCount: contentBlocks.length, hasCover: !!coverImage }, action: { type: 'create_blog_post', id: item.id, title: item.title, reviewPath: `/admin/blog` } };
  }
  if (name === 'get_webinars') {
    const items = await getCollection(WEBINARS_KEY);
    const filtered = args.upcoming_only ? items.filter((w: any) => !w.isPast) : items;
    return { result: { count: filtered.length, webinars: filtered.map((w: any) => ({ id: w.id, title: w.title, day: w.day, monthName: w.monthName, year: w.year, time: w.time, isPast: w.isPast })) } };
  }
  if (name === 'create_webinar') {
    const item = { id: `webinar-${Date.now()}`, isPast: false, ...args, createdAt: ts };
    const items = await getCollection(WEBINARS_KEY);
    await saveCollection(WEBINARS_KEY, [...items, item]);
    return { result: { success: true, id: item.id, title: item.title }, action: { type: 'create_webinar', id: item.id, title: item.title, reviewPath: '/marketing/webinare' } };
  }
  if (name === 'get_notifications') {
    const items = await getCollection(NOTIFICATIONS_KEY);
    return { result: { count: items.length, notifications: items } };
  }
  if (name === 'create_notification') {
    const item = { id: `notif-${Date.now()}`, active: true, ...args, createdAt: ts };
    const items = await getCollection(NOTIFICATIONS_KEY);
    await saveCollection(NOTIFICATIONS_KEY, [...items, item]);
    return { result: { success: true, id: item.id }, action: { type: 'create_notification', id: item.id, text: args.text, reviewPath: '/admin/kolekce/notifikace' } };
  }
  if (name === 'update_notification') {
    const items = await getCollection(NOTIFICATIONS_KEY);
    const idx = items.findIndex((n: any) => n.id === args.id);
    if (idx === -1) return { result: { error: `Notifikace ${args.id} nenalezena` } };
    items[idx] = { ...items[idx], ...args.fields, updatedAt: ts };
    await saveCollection(NOTIFICATIONS_KEY, items);
    return { result: { success: true, id: args.id }, action: { type: 'update_notification', id: args.id, reviewPath: '/admin/kolekce/notifikace' } };
  }
  if (name === 'delete_notification') {
    const items = await getCollection(NOTIFICATIONS_KEY);
    const target = items.find((n: any) => n.id === args.id);
    if (!target) return { result: { error: `Notifikace ${args.id} nenalezena` } };
    await saveCollection(NOTIFICATIONS_KEY, items.filter((n: any) => n.id !== args.id));
    console.log(`[AdminAgent] delete_notification → id=${args.id}`);
    return { result: { success: true, id: args.id }, action: { type: 'delete_notification', id: args.id, reviewPath: '/admin/kolekce/notifikace' } };
  }
  if (name === 'get_novinky') {
    const items = await getCollection(NOVINKY_KEY);
    return { result: { count: items.length, novinky: items.slice(0, 20).map((n: any) => ({ id: n.id, title: n.title, slug: n.slug, published: n.published })) } };
  }
  if (name === 'create_novinka') {
    const item = { id: `novinka-${Date.now()}`, slug: `novinka-${Date.now()}`, published: false, date: new Date().toLocaleDateString('cs-CZ'), ...args, createdAt: ts };
    const items = await getCollection(NOVINKY_KEY);
    await saveCollection(NOVINKY_KEY, [...items, item]);
    return { result: { success: true, id: item.id, title: item.title }, action: { type: 'create_novinka', id: item.id, title: item.title, reviewPath: `/admin/novinky` } };
  }
  if (name === 'update_novinka') {
    const items = await getCollection(NOVINKY_KEY);
    const idx = items.findIndex((n: any) => n.id === args.id);
    if (idx === -1) return { result: { error: `Novinka ${args.id} nenalezena` } };
    items[idx] = { ...items[idx], ...args.fields, updatedAt: ts };
    await saveCollection(NOVINKY_KEY, items);
    return { result: { success: true, id: args.id }, action: { type: 'update_novinka', id: args.id, reviewPath: '/admin/novinky' } };
  }
  if (name === 'delete_novinka') {
    const items = await getCollection(NOVINKY_KEY);
    const target = items.find((n: any) => n.id === args.id);
    if (!target) return { result: { error: `Novinka ${args.id} nenalezena` } };
    await saveCollection(NOVINKY_KEY, items.filter((n: any) => n.id !== args.id));
    console.log(`[AdminAgent] delete_novinka → id=${args.id}, title=${target.title}`);
    return { result: { success: true, id: args.id, title: target.title }, action: { type: 'delete_novinka', id: args.id, title: target.title, reviewPath: '/admin/novinky' } };
  }
  // ── Blog update/publish ──────────────────────────────────────────
  if (name === 'update_blog_post') {
    const items = await getCollection(BLOG_KEY);
    const idx = items.findIndex((p: any) => p.id === args.id);
    if (idx === -1) return { result: { error: `Blog ${args.id} nenalezen` } };
    items[idx] = { ...items[idx], ...args.fields, updatedAt: ts };
    await saveCollection(BLOG_KEY, items);
    return { result: { success: true, id: args.id, title: items[idx].title }, action: { type: 'update_blog_post', id: args.id, title: items[idx].title, reviewPath: '/admin/blog' } };
  }
  if (name === 'publish_blog_post') {
    const items = await getCollection(BLOG_KEY);
    const idx = items.findIndex((p: any) => p.id === args.id);
    if (idx === -1) return { result: { error: `Blog ${args.id} nenalezen` } };
    items[idx] = { ...items[idx], published: args.published, updatedAt: ts };
    await saveCollection(BLOG_KEY, items);
    return { result: { success: true, id: args.id, published: args.published }, action: { type: 'publish_blog_post', id: args.id, published: args.published, reviewPath: '/admin/blog' } };
  }
  if (name === 'delete_blog_post') {
    const items = await getCollection(BLOG_KEY);
    const target = items.find((p: any) => p.id === args.id);
    if (!target) return { result: { error: `Blog ${args.id} nenalezen` } };
    await saveCollection(BLOG_KEY, items.filter((p: any) => p.id !== args.id));
    console.log(`[AdminAgent] delete_blog_post → id=${args.id}, title=${target.title}`);
    return { result: { success: true, id: args.id, title: target.title }, action: { type: 'delete_blog_post', id: args.id, title: target.title, reviewPath: '/admin/blog' } };
  }
  // ── Webinar update/delete ────────────────────────────────────────
  if (name === 'update_webinar') {
    const items = await getCollection(WEBINARS_KEY);
    const idx = items.findIndex((w: any) => w.id === args.id);
    if (idx === -1) return { result: { error: `Webinář ${args.id} nenalezen` } };
    items[idx] = { ...items[idx], ...args.fields, updatedAt: ts };
    await saveCollection(WEBINARS_KEY, items);
    return { result: { success: true, id: args.id, title: items[idx].title }, action: { type: 'update_webinar', id: args.id, reviewPath: '/marketing/webinare' } };
  }
  if (name === 'delete_webinar') {
    const items = await getCollection(WEBINARS_KEY);
    const item = items.find((w: any) => w.id === args.id);
    if (!item) return { result: { error: `Webinář ${args.id} nenalezen` } };
    await saveCollection(WEBINARS_KEY, items.filter((w: any) => w.id !== args.id));
    return { result: { success: true, id: args.id, title: item.title }, action: { type: 'delete_webinar', id: args.id, title: item.title } };
  }
  // ── Produkt delete/duplicate ─────────────────────────────────────
  if (name === 'delete_product') {
    const products = await getAllProducts();
    const item = products.find((p: any) => p.id === args.id);
    if (!item) return { result: { error: `Produkt ${args.id} nenalezen` } };
    await saveAllProducts(products.filter((p: any) => p.id !== args.id));
    return { result: { success: true, id: args.id, name: item.name }, action: { type: 'delete_product', id: args.id, name: item.name } };
  }
  if (name === 'duplicate_product') {
    const products = await getAllProducts();
    const src = products.find((p: any) => p.id === args.id);
    if (!src) return { result: { error: `Produkt ${args.id} nenalezen` } };
    const newId = `sb-copy-${Date.now()}`;
    const copy = { ...src, id: newId, name: args.new_name || `${src.name} (kopie)`, createdAt: ts, updatedAt: ts };
    await saveAllProducts([...products, copy]);
    return { result: { success: true, id: newId, name: copy.name }, action: { type: 'duplicate_product', id: newId, name: copy.name, reviewPath: '/admin/kolekce/produkty' } };
  }
  // ── Ceny ─────────────────────────────────────────────────────────
  if (name === 'bulk_update_prices_percentage') {
    function parsePrice(raw: string): number | null {
      if (!raw) return null;
      const m = String(raw).replace(/\s/g, '').match(/(\d+[\.,]?\d*)/);
      return m ? parseFloat(m[1].replace(',', '.')) : null;
    }
    function formatPrice(n: number): string {
      const rounded = Math.round(n / 10) * 10;
      return `${rounded},-`;
    }
    let products = await getAllProducts();
    let filtered = products;
    if (args.filter_type) filtered = filtered.filter((p: any) => p.type === args.filter_type);
    if (args.filter_category) filtered = filtered.filter((p: any) => (p.category || '').toLowerCase().includes(args.filter_category.toLowerCase()));
    if (args.filter_name_contains) {
      const needle = args.filter_name_contains.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      filtered = filtered.filter((p: any) => {
        const hay = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return hay.includes(needle);
      });
    }
    const pct = args.percentage / 100;
    const changes: Array<{id: string; name: string; oldPrice: string; newPrice: string}> = [];
    const ids = new Set(filtered.map((p: any) => p.id));
    const updated = products.map((p: any) => {
      if (!ids.has(p.id)) return p;
      const oldNum = parsePrice(p.price);
      if (oldNum === null) return p;
      const newNum = oldNum * (1 + pct);
      const newPrice = formatPrice(newNum);
      changes.push({ id: p.id, name: p.name, oldPrice: p.price, newPrice });
      return { ...p, price: newPrice, updatedAt: ts };
    });
    await saveAllProducts(updated);
    console.log(`[AdminAgent] bulk_update_prices_percentage ${args.percentage}% → ${changes.length} produktů`);
    // Auto-embed pro malé batche — skip when deadline tight
    const priceDeadline = (globalThis as any).__agentDeadline || Infinity;
    const apiKeyPrices = Deno.env.get('GEMINI_API_KEY_RAG');
    let priceRagNote = changes.length > 8 ? `${changes.length} produktů — pro RAG spusť rag_index_source` : '';
    if (apiKeyPrices && changes.length > 0 && changes.length <= 8 && (priceDeadline - Date.now()) > 30_000) {
      const existingAll = await loadAllChunks();
      let priceRagCount = 0;
      for (const ch of changes) {
        try {
          for (const old of existingAll.filter((c: any) => c?.metadata?.source === 'produkty' && c?.metadata?.sourceId === ch.id)) { await removeChunk(old.id); }
          const updatedP = updated.find((x: any) => x.id === ch.id);
          const rawText = productToText(updatedP);
          const pChunks = chunkText(rawText);
          for (let ci = 0; ci < pChunks.length; ci++) {
            const embedding = await embedText(pChunks[ci]);
            await saveChunk({ id: `produkty_${ch.id}_${ci}`, text: pChunks[ci], embedding, embeddingDims: embedding.length, metadata: { source: 'produkty', sourceId: ch.id, title: updatedP?.name || '', chunkIndex: ci, tokens: Math.round(pChunks[ci].length / 4), quality: qualityScore(pChunks[ci]), createdAt: ts } });
            await new Promise(r => setTimeout(r, 60));
          }
          priceRagCount++;
        } catch (e: any) { console.log(`[AdminAgent] prices RAG ${ch.id}: ${e.message}`); }
      }
      priceRagNote = `RAG: ${priceRagCount}/${changes.length} přeindexováno`;
    }
    return { result: { success: true, updatedCount: changes.length, changes: changes.slice(0, 20), ragNote: priceRagNote }, action: { type: 'bulk_update_prices_percentage', count: changes.length, percentage: args.percentage, ragNote: priceRagNote, reviewPath: '/admin/kolekce/produkty' } };
  }
  if (name === 'get_price_overview') {
    const products = await getAllProducts();
    function parseP(raw: string): number | null {
      if (!raw) return null;
      const m = String(raw).replace(/\s/g, '').match(/(\d+[\.,]?\d*)/);
      return m ? parseFloat(m[1].replace(',', '.')) : null;
    }
    const byType: Record<string, number[]> = {};
    for (const p of products) {
      const n = parseP(p.price);
      if (n === null) continue;
      const key = p.type || 'unknown';
      if (!byType[key]) byType[key] = [];
      byType[key].push(n);
    }
    const overview = Object.entries(byType).map(([type, prices]) => ({
      type, count: prices.length,
      min: Math.min(...prices), max: Math.max(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    }));
    return { result: { overview, totalProducts: products.length } };
  }
  // ── Dashboard & statistiky ────────────────────────────────────────
  if (name === 'get_dashboard_summary') {
    const [products, blog, novinky, webinars, notifs, subscribers] = await Promise.all([
      getAllProducts(),
      getCollection(BLOG_KEY),
      getCollection(NOVINKY_KEY),
      getCollection(WEBINARS_KEY),
      getCollection(NOTIFICATIONS_KEY),
      kv.get(NEWSLETTER_KEY) as Promise<any[]>,
    ]);
    const subs = subscribers || [];
    return { result: {
      produkty: { total: products.length, typy: Object.fromEntries([...new Set(products.map((p: any) => p.type || 'unknown'))].map(t => [t, products.filter((p: any) => (p.type || 'unknown') === t).length])) },
      blog: { total: blog.length, published: blog.filter((p: any) => p.published).length, drafts: blog.filter((p: any) => !p.published).length },
      novinky: { total: novinky.length },
      webinare: { total: webinars.length, upcoming: webinars.filter((w: any) => !w.isPast).length, past: webinars.filter((w: any) => w.isPast).length },
      notifikace: { total: notifs.length, active: notifs.filter((n: any) => n.active).length },
      newsletter: { subscribers: subs.length },
    }};
  }
  if (name === 'get_newsletter_stats') {
    const subs = ((await kv.get(NEWSLETTER_KEY)) as any[] | null) || [];
    const bySource: Record<string, number> = {};
    for (const s of subs) { const src = s.source || 'unknown'; bySource[src] = (bySource[src] || 0) + 1; }
    const sorted = [...subs].sort((a, b) => new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime());
    return { result: { total: subs.length, bySource, lastSubscribed: sorted[0]?.subscribedAt || null, last10: sorted.slice(0, 10).map((s: any) => ({ email: s.email, source: s.source, date: s.subscribedAt })) } };
  }
  if (name === 'get_broken_products') {
    const products = await getAllProducts();
    const broken = products.filter((p: any) => !p.image || !p.price || !p.description).map((p: any) => ({
      id: p.id, name: p.name, category: p.category, type: p.type,
      missing: [...(!p.image ? ['image'] : []), ...(!p.price ? ['price'] : []), ...(!p.description ? ['description'] : [])],
    }));
    return { result: { brokenCount: broken.length, total: products.length, products: broken.slice(0, 50) } };
  }
  if (name === 'search_all') {
    const q = (args.query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    function match(text: string) { return (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q); }
    const [products, blog, novinky, webinars] = await Promise.all([getAllProducts(), getCollection(BLOG_KEY), getCollection(NOVINKY_KEY), getCollection(WEBINARS_KEY)]);
    return { result: {
      produkty: products.filter((p: any) => match(p.name) || match(p.category) || match(p.description)).slice(0, 10).map((p: any) => ({ id: p.id, name: p.name, category: p.category, price: p.price })),
      blog: blog.filter((p: any) => match(p.title) || match(p.excerpt) || match(p.content)).slice(0, 5).map((p: any) => ({ id: p.id, title: p.title, published: p.published })),
      novinky: novinky.filter((n: any) => match(n.title) || match(n.excerpt)).slice(0, 5).map((n: any) => ({ id: n.id, title: n.title })),
      webinare: webinars.filter((w: any) => match(w.title) || match(w.subtitle)).slice(0, 5).map((w: any) => ({ id: w.id, title: w.title })),
    }};
  }
  // ── Email kampaně ─────────────────────────────────────────────────
  if (name === 'create_email_campaign_draft') {
    const now = new Date().toISOString();
    const id = `draft-agent-${Date.now()}`;
    const bodyHtml = String(args.bodyHtml || '');
    const headline = String(args.headline || args.subject || '');
    const fullHtmlFromAgent = typeof args.fullHtml === 'string' && args.fullHtml.trim().length > 10 ? args.fullHtml.trim() : '';
    const fullHtml = fullHtmlFromAgent || vividbooksEmailTemplate({
      headline,
      body: bodyHtml,
      ctaText: String(args.ctaText || 'Prohlédnout produkty'),
      ctaUrl: String(args.ctaUrl || 'https://www.vividbooks.com'),
      preheader: String(args.previewText || ''),
    });
    const rawMsgs = Array.isArray(ctx?.agentMessages) && ctx.agentMessages.length > 0
      ? ctx.agentMessages
      : (globalThis as any).__adminAgentRecentMessages || [];
    let chatHistory = adminAgentMessagesToEmailChatHistory(rawMsgs.slice(-20));
    if (chatHistory.length === 0 && rawMsgs.length > 0) {
      chatHistory = [
        {
          id: `wo-fallback-${Date.now()}`,
          role: 'ai',
          content:
            'Zprávy z Web operátora šly uložit jen částečně. Pokračujte v tomto chatu nebo otevřete Web operátora kvůli plné historii.',
          timestamp: now,
        },
      ];
    }
    if (chatHistory.length > 0) {
      chatHistory = [
        ...chatHistory,
        {
          id: `wo-email-seed-${Date.now()}`,
          role: 'ai',
          content:
            '📧 **Draft z Web operátora** — konverzace výše je z chatu s Web operátorem; v Email builderu můžeš pokračovat úpravami nebo psát tomuto AI asistentovi.',
          timestamp: new Date().toISOString(),
        },
      ];
    }
    const draft = {
      id,
      subject: args.subject || '',
      previewText: args.previewText || '',
      headline: args.headline || '',
      bodyHtml,
      fullHtml,
      ctaText: args.ctaText || 'Prohlédnout produkty',
      ctaUrl: args.ctaUrl || 'https://www.vividbooks.com',
      audience: (args.audience === 'no-newsletter' ? 'no-newsletter' : 'newsletter') as 'newsletter' | 'no-newsletter',
      status: 'draft' as const,
      createdAt: now,
      updatedAt: now,
      ...(chatHistory.length > 0 ? { chatHistory } : {}),
    };
    await kv.set(`vb:email-draft:${id}`, draft);
    console.log(`[AdminAgent] create_email_campaign_draft → id=${id} subject="${draft.subject}"`);
    return { result: { success: true, id, subject: draft.subject }, action: { type: 'create_email_campaign_draft', id, subject: draft.subject, reviewPath: '/marketing/emaily' } };
  }
  if (name === 'get_email_drafts') {
    const rows = await kv.getByPrefix('vb:email-draft:');
    const drafts = (rows || []).filter((r: any) => r && r.id).map((r: any) => ({ id: r.id, subject: r.subject, status: r.status, audience: r.audience, updatedAt: r.updatedAt }));
    return { result: { count: drafts.length, drafts } };
  }
  if (name === 'delegate_to_seo_specialist') {
    const task = String(args.task || '').trim();
    const context = String(args.context || '').trim();
    const handoffContent = context ? `${task}\n\nKontext od web operátora:\n${context}` : task;
    const specialist = await runTextSpecialistAgent({
      logPrefix: 'Admin->Seo',
      systemPrompt: SEO_AGENT_SYSTEM_PROMPT,
      messages: buildSpecialistHandoffMessages((globalThis as any).__adminAgentRecentMessages || [], handoffContent),
      productContext: await getAllProducts(),
      model: 'gemini-3.1-pro-preview',
      useRag: true,
    });
    return {
      result: { success: true, delegated: 'seo', reply: specialist.reply },
      action: {
        type: 'delegate_seo_specialist',
        name: 'SEO specialista',
        text: task,
        fields: {
          specialista: 'seo',
          brief: specialist.reply.slice(0, 700),
        },
      },
    };
  }
  if (name === 'delegate_to_image_specialist') {
    const task = String(args.task || '').trim();
    const context = String(args.context || '').trim();
    const handoffContent = context ? `${task}\n\nKontext od web operátora:\n${context}` : task;
    const specialist = await runTextSpecialistAgent({
      logPrefix: 'Admin->Image',
      systemPrompt: IMAGE_AGENT_SYSTEM_PROMPT,
      messages: buildSpecialistHandoffMessages((globalThis as any).__adminAgentRecentMessages || [], handoffContent),
      productContext: await getAllProducts(),
      model: 'gemini-3.1-pro-preview',
      useRag: false,
    });
    return {
      result: { success: true, delegated: 'image', reply: specialist.reply },
      action: {
        type: 'delegate_image_specialist',
        name: 'Image specialista',
        text: task,
        fields: {
          specialista: 'image',
          handoff: specialist.reply.slice(0, 700),
        },
      },
    };
  }
  // ── RAG nástroje ─────────────────────────────────────────────────
  if (name === 'assign_image_to_product') {
    const products = await getAllProducts();
    const idx = products.findIndex((p: any) => p.id === args.product_id);
    if (idx === -1) return { result: { error: `Produkt ${args.product_id} nenalezen.` } };
    const oldImage = products[idx].image;
    products[idx] = { ...products[idx], image: args.image_url, updatedAt: new Date().toISOString() };
    await saveAllProducts(products);
    console.log(`[AdminAgent] assign_image_to_product ${args.product_id} → ${String(args.image_url).slice(0, 80)}`);
    return {
      result: { success: true, productId: args.product_id, productName: products[idx].name, oldImage, newImage: args.image_url },
      action: { type: 'assign_image_to_product', title: products[idx].name, imageUrl: args.image_url, reviewPath: '/admin/kolekce/produkty' },
    };
  }
  if (name === 'add_image_to_blog_post') {
    const items = await getCollection(BLOG_KEY);
    const idx = items.findIndex((p: any) => p.id === args.id);
    if (idx === -1) return { result: { error: `Blog článek ${args.id} nenalezen. Zkontroluj ID přes get_blog_posts.` } };
    const post = items[idx];
    const position = args.position || 'end';
    const imageUrl = String(args.image_url || '');
    const caption = String(args.caption || '');
    if (!imageUrl) return { result: { error: 'Chybí image_url.' } };
    // Build image HTML
    const captionHtml = caption ? `<figcaption style="font-size:0.875rem;color:#666;margin-top:0.5rem;text-align:center;">${caption}</figcaption>` : '';
    const imgHtml = `\n<figure style="margin:1.5rem 0;text-align:center;">\n  <img src="${imageUrl}" alt="${caption}" style="max-width:100%;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);" />\n  ${captionHtml}\n</figure>\n`;
    // Build image content block
    const imageBlock: any = { type: 'image', url: imageUrl, alt: caption };
    let updatedContent: any[] = Array.isArray(post.content) ? [...post.content] : [];
    let updatedHtml: string = post.contentHtml || '';
    if (position === 'beginning') {
      updatedContent = [imageBlock, ...updatedContent];
      updatedHtml = imgHtml + updatedHtml;
    } else if (position === 'after_intro') {
      const firstParaIdx = updatedContent.findIndex((b: any) => b.type === 'paragraph');
      if (firstParaIdx >= 0) {
        updatedContent.splice(firstParaIdx + 1, 0, imageBlock);
      } else {
        updatedContent = [...updatedContent, imageBlock];
      }
      const firstPEnd = updatedHtml.indexOf('</p>');
      if (firstPEnd >= 0) {
        updatedHtml = updatedHtml.slice(0, firstPEnd + 4) + imgHtml + updatedHtml.slice(firstPEnd + 4);
      } else {
        updatedHtml = updatedHtml + imgHtml;
      }
    } else {
      // end (default)
      updatedContent = [...updatedContent, imageBlock];
      updatedHtml = updatedHtml + imgHtml;
    }
    items[idx] = { ...post, content: updatedContent, contentHtml: updatedHtml, updatedAt: ts };
    await saveCollection(BLOG_KEY, items);
    console.log(`[AdminAgent] add_image_to_blog_post: "${post.title}" ← ${imageUrl.slice(0, 60)} position=${position}`);
    return {
      result: { success: true, id: args.id, title: post.title, imageUrl, position, totalImages: updatedContent.filter((b: any) => b.type === 'image').length },
      action: { type: 'add_image_to_blog_post', id: args.id, title: post.title, imageUrl, reviewPath: '/admin/blog' },
    };
  }
  if (name === 'add_slider_to_blog_post') {
    const items = await getCollection(BLOG_KEY);
    const idx = items.findIndex((p: any) => p.id === args.id);
    if (idx === -1) return { result: { error: `Blog článek ${args.id} nenalezen. Zkontroluj ID přes get_blog_posts.` } };
    const post = items[idx];
    const imageUrls: string[] = Array.isArray(args.image_urls) ? args.image_urls : [];
    if (imageUrls.length < 1) return { result: { error: 'Musíš zadat alespoň 1 URL obrázku v image_urls.' } };
    const captions: string[] = Array.isArray(args.captions) ? args.captions : [];
    const sliderBlock: any = {
      type: 'slider',
      images: imageUrls.map((url: string, i: number) => ({ src: url, alt: captions[i] || '', caption: captions[i] || '' })),
      caption: args.caption || '',
    };
    let updatedContent: any[] = Array.isArray(post.content) ? [...post.content] : [];
    const position = args.position || 'end';
    if (position === 'beginning') {
      updatedContent = [sliderBlock, ...updatedContent];
    } else if (position === 'after_intro') {
      const firstParaIdx = updatedContent.findIndex((b: any) => b.type === 'paragraph');
      if (firstParaIdx >= 0) updatedContent.splice(firstParaIdx + 1, 0, sliderBlock);
      else updatedContent = [...updatedContent, sliderBlock];
    } else {
      updatedContent = [...updatedContent, sliderBlock];
    }
    items[idx] = { ...post, content: updatedContent, updatedAt: ts };
    await saveCollection(BLOG_KEY, items);
    console.log(`[AdminAgent] add_slider_to_blog_post: "${post.title}" ← ${imageUrls.length} obrázků position=${position}`);
    return {
      result: { success: true, id: args.id, title: post.title, imageCount: imageUrls.length, position },
      action: { type: 'add_slider_to_blog_post', id: args.id, title: post.title, imageCount: imageUrls.length, reviewPath: '/admin/blog' },
    };
  }
  if (name === 'add_tabs_to_blog_post') {
    const items = await getCollection(BLOG_KEY);
    const idx = items.findIndex((p: any) => p.id === args.id);
    if (idx === -1) return { result: { error: `Blog článek ${args.id} nenalezen. Zkontroluj ID přes get_blog_posts.` } };
    const post = items[idx];
    const tabs: any[] = Array.isArray(args.tabs) ? args.tabs : [];
    if (tabs.length < 1) return { result: { error: 'Musíš zadat alespoň 1 tab v poli tabs.' } };
    const tabsBlock: any = {
      type: 'tabs',
      tabs: tabs.map((t: any) => ({ label: String(t.label || ''), content: String(t.content || ''), imageUrl: t.imageUrl || '' })),
      heading: args.heading || '',
    };
    let updatedContent: any[] = Array.isArray(post.content) ? [...post.content] : [];
    const position = args.position || 'end';
    if (position === 'beginning') {
      updatedContent = [tabsBlock, ...updatedContent];
    } else if (position === 'after_intro') {
      const firstParaIdx = updatedContent.findIndex((b: any) => b.type === 'paragraph');
      if (firstParaIdx >= 0) updatedContent.splice(firstParaIdx + 1, 0, tabsBlock);
      else updatedContent = [...updatedContent, tabsBlock];
    } else {
      updatedContent = [...updatedContent, tabsBlock];
    }
    items[idx] = { ...post, content: updatedContent, updatedAt: ts };
    await saveCollection(BLOG_KEY, items);
    console.log(`[AdminAgent] add_tabs_to_blog_post: "${post.title}" ← ${tabs.length} tabů position=${position}`);
    return {
      result: { success: true, id: args.id, title: post.title, tabCount: tabs.length, position, tabLabels: tabs.map((t: any) => t.label) },
      action: { type: 'add_tabs_to_blog_post', id: args.id, title: post.title, tabCount: tabs.length, tabs: tabs.map((t: any) => t.label), reviewPath: '/admin/blog' },
    };
  }
  if (name === 'open_collage_builder') {
    const imageUrls: string[] = Array.isArray(args.image_urls) ? args.image_urls : [];
    const style: string = args.style || 'grid';
    const note: string = args.note || '';
    if (imageUrls.length < 1) return { result: { error: 'Musíš zadat alespoň 1 URL obrázku v image_urls.' } };
    console.log(`[AdminAgent] open_collage_builder: ${imageUrls.length} obrázků, styl=${style}`);
    return {
      result: {
        note: `Koláž Builder připraven. Styl: ${style}. Předvybrané obrázky: ${imageUrls.length}. Klikněte na tlačítko v kartě níže pro otevření dialogu.`,
        imageUrls, style, agentNote: note,
      },
      action: { type: 'open_collage_builder', imageUrls, style, count: imageUrls.length, note },
    };
  }
  if (name === 'rag_get_stats') {
    try {
      const chunks = await loadAllChunks();
      const bySource: Record<string, number> = {};
      for (const ch of chunks) {
        const src = ch?.metadata?.source || 'unknown';
        bySource[src] = (bySource[src] || 0) + 1;
      }
      return { result: { totalChunks: chunks.length, bySource, note: 'Počty vectorových chunků v RAG indexu pro každý zdroj.' } };
    } catch (e: any) {
      return { result: { error: `Chyba načítání RAG statistik: ${e.message}` } };
    }
  }
  if (name === 'rag_index_item') {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return { result: { error: 'GEMINI_API_KEY_RAG není nastaven.' } };
    const src = args.source as string;
    const itemId = args.id as string;
    // Načti item ze správné kolekce
    let item: any = null;
    if (src === 'blog') {
      const items = await getCollection(BLOG_KEY);
      item = items.find((x: any) => x.id === itemId);
    } else if (src === 'novinky') {
      const items = await getCollection(NOVINKY_KEY);
      item = items.find((x: any) => x.id === itemId);
    } else if (src === 'webinare') {
      const items = await getCollection(WEBINARS_KEY);
      item = items.find((x: any) => x.id === itemId);
    } else if (src === 'produkty') {
      const items = await getAllProducts();
      item = items.find((x: any) => x.id === itemId);
    } else {
      return { result: { error: `Neznámý zdroj: ${src}. Použij: blog | novinky | webinare | produkty` } };
    }
    if (!item) return { result: { error: `Položka ${itemId} ve zdroji ${src} nenalezena.` } };
    // Smaž staré chunky pro tuto položku
    const existing = await loadAllChunks();
    const oldChunks = existing.filter((c: any) => c?.metadata?.source === src && c?.metadata?.sourceId === itemId);
    for (const ch of oldChunks) {
      await removeChunk(ch.id);
      await new Promise(r => setTimeout(r, 20));
    }
    // Převeď na text
    let rawText = '';
    if (src === 'blog') rawText = blogToText(item);
    else if (src === 'novinky') rawText = novinkaToText(item);
    else if (src === 'webinare') rawText = webinarToText(item);
    else if (src === 'produkty') rawText = productToText(item);
    const chunks = chunkText(rawText);
    if (!chunks.length) return { result: { error: `Položka ${itemId} nemá žádný indexovatelný text.` } };
    let ingested = 0;
    for (let ci = 0; ci < chunks.length; ci++) {
      try {
        const embedding = await embedText(chunks[ci]);
        const chunkId = `${src}_${itemId}_${ci}`;
        await saveChunk({
          id: chunkId,
          text: chunks[ci],
          embedding,
          embeddingDims: embedding.length,
          metadata: {
            source: src,
            sourceId: itemId,
            title: item.name || item.title || '',
            subject: item.subject || item.category || '',
            chunkIndex: ci,
            totalChunks: chunks.length,
            tokens: Math.round(chunks[ci].length / 4),
            quality: qualityScore(chunks[ci]),
            createdAt: new Date().toISOString(),
          },
        });
        ingested++;
        await new Promise(r => setTimeout(r, 60));
      } catch (embErr: any) {
        console.log(`[AdminAgent RAG] embed chunk ${ci} failed: ${embErr.message}`);
      }
    }
    const preview = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    console.log(`[AdminAgent] rag_index_item ${src}/${itemId} → ${ingested}/${chunks.length} chunků`);
    return { result: { success: true, source: src, id: itemId, title: item.name || item.title || '', chunksIngested: ingested, oldChunksRemoved: oldChunks.length, preview }, action: { type: 'rag_index_item', source: src, title: item.name || item.title || '', chunks: ingested, preview, reviewPath: '/marketing/rag' } };
  }
  if (name === 'rag_index_source') {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return { result: { error: 'GEMINI_API_KEY_RAG není nastaven.' } };
    const src = args.source as 'produkty' | 'blog' | 'novinky' | 'webinare' | 'tabs' | 'mailchimp';
    const validSources = ['produkty', 'blog', 'novinky', 'webinare', 'tabs'];
    if (!validSources.includes(src)) return { result: { error: `Neplatný zdroj. Povolené hodnoty: ${validSources.join(', ')}` } };
    try {
      const stats = await ingestSource(src, apiKey);
      console.log(`[AdminAgent] rag_index_source ${src} → ${JSON.stringify(stats)}`);
      return { result: { success: true, source: src, ...stats }, action: { type: 'rag_index_source', source: src, ingested: stats.ingested, reviewPath: '/marketing/rag' } };
    } catch (e: any) {
      return { result: { error: `Indexace zdroje ${src} selhala: ${e.message}` } };
    }
  }
  if (name === 'rag_remove_item') {
    const src = args.source as string;
    const itemId = args.id as string;
    const existing = await loadAllChunks();
    const toRemove = existing.filter((c: any) => c?.metadata?.source === src && c?.metadata?.sourceId === itemId);
    for (const ch of toRemove) {
      await removeChunk(ch.id);
      await new Promise(r => setTimeout(r, 20));
    }
    console.log(`[AdminAgent] rag_remove_item ${src}/${itemId} → odstraněno ${toRemove.length} chunků`);
    return { result: { success: true, source: src, id: itemId, removedChunks: toRemove.length }, action: { type: 'rag_remove_item', source: src, id: itemId } };
  }

  /* ── Subject Tabs ─────────────────────────────────────────────── */
  if (name === 'get_subject_tabs') {
    const allTabs = await getCollection(TABS_KEY);
    const subject = args.subject as string | undefined;
    const filtered = subject
      ? allTabs.filter((t: any) => (t.subject || '').trim().toLowerCase() === subject.trim().toLowerCase())
      : allTabs;
    const sorted = [...filtered].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    return { result: { count: sorted.length, tabs: sorted.map((t: any) => ({ id: t.id, tabText: t.tabText, contentHeadline: t.contentHeadline, subject: t.subject, order: t.order })) } };
  }
  if (name === 'create_subject_tab') {
    const newTab: any = {
      id: `tab-agent-${Date.now()}`,
      tabText: args.tabText || '',
      contentHeadline: args.contentHeadline || '',
      contentRichText: args.contentRichText || '',
      contentImage: args.contentImage || '',
      subject: args.subject || '',
      subpage: args.subpage || '',
      order: args.order || 0,
      bgColor: args.bgColor || '',
      createdAt: new Date().toISOString(),
    };
    const allTabs = await getCollection(TABS_KEY);
    await saveCollection(TABS_KEY, [...allTabs, newTab]);
    // RAG embed
    try {
      const ak = Deno.env.get('GEMINI_API_KEY_RAG');
      if (ak) {
        const tabText = [newTab.subject, newTab.tabText, newTab.contentHeadline, newTab.contentRichText].filter(Boolean).join('\n');
        if (tabText.trim()) {
          const emb = await embedText(tabText);
          await saveChunk({ id: `tab_${newTab.id}`, text: tabText, embedding: emb, embeddingDims: emb.length, metadata: { source: 'tabs', sourceId: newTab.id, subject: newTab.subject, title: newTab.contentHeadline || newTab.tabText, chunkIndex: 0, totalChunks: 1, uploadedAt: new Date().toISOString(), tokens: Math.round(tabText.length / 4), quality: qualityScore(tabText) } });
        }
      }
    } catch (ragErr: any) { console.log('[AdminAgent] create_subject_tab RAG error:', ragErr.message); }
    console.log(`[AdminAgent] create_subject_tab → ${newTab.id} subject="${newTab.subject}" tabText="${newTab.tabText}"`);
    return { result: { success: true, id: newTab.id, subject: newTab.subject, tabText: newTab.tabText }, action: { type: 'create_subject_tab', id: newTab.id, subject: newTab.subject, tabText: newTab.tabText, name: newTab.tabText, reviewPath: '/admin/kolekce/tabs' } };
  }
  if (name === 'update_subject_tab') {
    const tabId = args.id as string;
    const updates: any = { ...args };
    delete updates.id;
    const allTabs = await getCollection(TABS_KEY);
    const tab = allTabs.find((t: any) => t.id === tabId);
    if (!tab) return { result: { error: `Tab ${tabId} nenalezen` } };
    const merged = { ...tab, ...updates };
    await saveCollection(TABS_KEY, allTabs.map((t: any) => t.id === tabId ? merged : t));
    // RAG re-embed
    try {
      const ak = Deno.env.get('GEMINI_API_KEY_RAG');
      if (ak) {
        const tabText = [merged.subject, merged.tabText, merged.contentHeadline, merged.contentRichText].filter(Boolean).join('\n');
        if (tabText.trim()) {
          const emb = await embedText(tabText);
          await saveChunk({ id: `tab_${tabId}`, text: tabText, embedding: emb, embeddingDims: emb.length, metadata: { source: 'tabs', sourceId: tabId, subject: merged.subject, title: merged.contentHeadline || merged.tabText, chunkIndex: 0, totalChunks: 1, uploadedAt: new Date().toISOString(), tokens: Math.round(tabText.length / 4), quality: qualityScore(tabText) } });
        }
      }
    } catch (ragErr: any) { console.log('[AdminAgent] update_subject_tab RAG error:', ragErr.message); }
    console.log(`[AdminAgent] update_subject_tab ${tabId} subject="${merged.subject}"`);
    return { result: { success: true, id: tabId }, action: { type: 'update_subject_tab', id: tabId, subject: merged.subject, tabText: merged.tabText, name: merged.tabText, reviewPath: '/admin/kolekce/tabs' } };
  }
  if (name === 'delete_subject_tab') {
    const tabId = args.id as string;
    const allTabs = await getCollection(TABS_KEY);
    const tab = allTabs.find((t: any) => t.id === tabId);
    if (!tab) return { result: { error: `Tab ${tabId} nenalezen` } };
    await saveCollection(TABS_KEY, allTabs.filter((t: any) => t.id !== tabId));
    // Remove from RAG
    try {
      const existing = await loadAllChunks();
      const toRemove = existing.filter((c: any) => c?.metadata?.sourceId === tabId && c?.metadata?.source === 'tabs');
      for (const ch of toRemove) { await removeChunk(ch.id); }
    } catch {}
    console.log(`[AdminAgent] delete_subject_tab ${tabId} subject="${tab.subject}"`);
    return { result: { success: true, id: tabId }, action: { type: 'delete_subject_tab', id: tabId, subject: tab.subject, name: tab.tabText } };
  }

  return { result: { error: `Neznámý nástroj: ${name}` } };
}

function normalizeRoutingText(text: string) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeSubjectLookupText(text: string) {
  return normalizeRoutingText(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function inferMarketingSaveToSubject(task: string, reply: string) {
  const hayTask = normalizeSubjectLookupText(task);
  const hayReply = normalizeSubjectLookupText(reply);
  const hay = `${hayTask}\n${hayReply}`.trim();
  if (!hay) return null;

  const subjects = await getCollection(SUBJECT_PAGES_KEY);
  const sorted = [...subjects].sort((a: any, b: any) => String(b.displayName || '').length - String(a.displayName || '').length);
  const matchedSubjects = sorted.filter((item: any) => {
    const candidates = [
      item.displayName,
      item.slug,
      String(item.displayName || '').replace(/-/g, ' '),
      String(item.slug || '').replace(/-/g, ' '),
    ]
      .map(normalizeSubjectLookupText)
      .filter(Boolean);
    return candidates.some((candidate: string) => hay.includes(candidate));
  });
  if (matchedSubjects.length === 0) return null;

  let targetField = 'heroText';
  if (/(uvod pro ucitele|hero text|uvodni slovo autora|slovo autora|autorske slovo|autor)/.test(hayTask)) targetField = 'heroText';
  else if (/(tagline|podtitulek)/.test(hayTask)) targetField = 'tagline';
  else if (/(rvp|rvp poznamka)/.test(hayTask)) targetField = 'rvpNote';
  else if (/(dolozka|dolozka msmt|schvaleni)/.test(hayTask)) targetField = 'dolozka';

  const batchRequested = /(u vsech predmet|pro vsechny predmety|vsechny predmety|vice polozek|kazdeho z nich|u kazdeho|hlavni predmetove rady)/.test(hayTask)
    || matchedSubjects.length > 1;

  if (batchRequested) {
    const saveTargets = matchedSubjects
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .map((item: any) => {
        const targetSubject = String(item.displayName || item.slug || '').trim();
        const prompt = targetField === 'heroText'
          ? `Ulož z předchozí odpovědi pouze sekci pro předmět "${targetSubject}" do pole heroText. Použij update_subject_page, ne subject tab. Neukládej jiné předměty.`
          : `Ulož z předchozí odpovědi pouze sekci pro předmět "${targetSubject}" do pole ${targetField}. Použij update_subject_page, ne subject tab. Neukládej jiné předměty.`;
        return { subject: targetSubject, targetField, prompt };
      });
    const savePrompt = targetField === 'heroText'
      ? 'Ulož výše uvedené návrhy z předchozí odpovědi do odpovídajících předmětů do pole heroText. Každou sekci přiřaď ke správnému předmětu a pro každý záznam použij update_subject_page. Neukládej nic do rvpNote ani do subject tabů. Pokud některý předmět ve výstupu chybí, přeskoč ho a napiš, které předměty byly uloženy.'
      : `Ulož výše uvedené návrhy z předchozí odpovědi do odpovídajících předmětů do pole ${targetField}. Každou sekci přiřaď ke správnému předmětu a pro každý záznam použij update_subject_page. Neukládej nic do subject tabů.`;
    return {
      batchSave: true,
      batchCount: matchedSubjects.length,
      targetField,
      savePrompt,
      saveTargets,
    };
  }

  const matched = matchedSubjects[0];
  const targetSubject = String(matched.displayName || matched.slug || '').trim();
  const savePrompt = targetField === 'heroText'
    ? `Ulož výše uvedený návrh z předchozí odpovědi do předmětu "${targetSubject}" do pole heroText. Použij update_subject_page, ne subject tab. Ulož celý text beze změny.`
    : `Ulož výše uvedený návrh z předchozí odpovědi do předmětu "${targetSubject}" do pole ${targetField}. Použij update_subject_page, ne subject tab.`;

  return {
    targetSubject,
    targetField,
    savePrompt,
    saveTargets: [{ subject: targetSubject, targetField, prompt: savePrompt }],
  };
}

function buildSpecialistHandoffMessages(history: any[], handoffContent: string) {
  const recent = (Array.isArray(history) ? history : [])
    .filter((m: any) => m && (m.content || (Array.isArray(m.images) && m.images.length > 0)))
    .slice(-9)
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: `${String(m.content || '')}${Array.isArray(m.images) && m.images.length > 0 ? `\n\n[Přiložené obrázky: ${m.images.length}]` : ''}`.trim(),
    }))
    .filter((m: any) => m.content);

  return [...recent, { role: 'user', content: handoffContent.trim() }].slice(-10);
}

function shouldForceAdminToolCall(message: any): boolean {
  const text = normalizeRoutingText(String(message?.content || ''));
  if (!text.trim()) return false;

  return /(uloz vyse uveden|uloz z predchozi odpovedi|pouzij update_subject_page|pouzij create_subject_page|pouzij delete_subject_page|pouzij get_subject_pages|uprav stranku predmetu|uloz to do predmetu|aktualizuj pole|proved aktualizaci pole|najdriv zjisti id predmetu)/.test(text);
}

/** Uživatel chce email/Mailchimp verzi uloženou přes nástroj → canvas vpravo (ne jen text v chatu). */
function userWantsEmailCanvasDraft(message: any): boolean {
  const text = normalizeRoutingText(String(message?.content || ''));
  if (!text.trim()) return false;

  return /(mail\s*chimp|mailchimp|email\s*builder|\bmailing(u|ovy|ova)?\b.{0,60}(sablona|template|html|verz|kampan|newsletter)|sablona.{0,40}(mail|email|mailchimp|mailing)|newsletter.{0,40}(sablona|html|mailchimp|canvas)|(jako|jakoze|dalsi|dals|predchozi).{0,35}verz(i|e)?.{0,25}(mail|email|mailchimp|mailing)|verz(i|e)?.{0,20}(mail|email|mailchimp)|otevri.{0,25}(v\s*)?(canvas|panel|email)|uloz.{0,30}(email|mail|mailing).{0,30}(draft|builder|canvas|mailchimp)|kampan(e|i)?.{0,25}(draft|mailchimp)|vygeneruj.{0,40}\bemail|predmet\s*e-?mailu|telo\s*e-?mailu)/.test(text);
}

function looksLikeFakeToolExecution(reply: string): boolean {
  const text = normalizeRoutingText(reply);
  if (!text.trim()) return false;

  return /(probiha volani nastroju|nyni se pustim do vlozeni|nejdrive zjistim id|pote provedu aktualizaci|pockejte prosim na potvrzeni|get_[a-z_]+\s*\(|update_[a-z_]+\s*\(|create_[a-z_]+\s*\(|delete_[a-z_]+\s*\()/.test(text);
}

/** Model popsal Mailchimp/email strukturu v čistém textu místo create_email_campaign_draft. */
function looksLikeEmailTemplateNarrationWithoutTool(reply: string): boolean {
  const text = normalizeRoutingText(reply);
  if (!text.trim() || text.length < 40) return false;

  const mailCue = /(mailchimp|mailingovs|sablona.{0,40}mail|email builder|\[block|block:\s*image|predmet(\s*e-?mailu)?\s*:|preview\s*text|preheader)/.test(text);
  const structureCue = /(hero|sekci|sekce|cta|body\s*html|inline styly|mailov(a|y) sablona|vizualne)/.test(text);
  return mailCue && structureCue;
}

function inferAdminSpecialistRoute(message: any): { specialist: 'marketing' | 'seo' | 'image' | null; reason?: string } {
  const raw = String(message?.content || '');
  const text = normalizeRoutingText(raw);
  if (!text.trim()) return { specialist: null };

  const seoIntent = /(seo|meta title|meta description|search intent|keyword|klicov[a-z]* slova|klicovky|prolinkovan[iy]|internal linking|obsahov[a-z]* brief|content brief|osnova|outline|h1|h2|serp)/.test(text);
  const imageIntent = /(obrazek|vizual|kolaz|cover|hero image|banner|thumbnail|miniatura|kompozic|image prompt|grafik|vygeneruj.*obraz|navrhni.*vizual)/.test(text);

  const directCmsOps = /(uprav|zmen|smaz|publish|publikuj|odpublikuj|nahraj|prirad|pridej do clanku|vloz do clanku|pridej obrazek|pridej fotku|cenu|variant|shopify|produkt id|najdi id|seznam|prehled|stav|zaindexuj|preindexuj|sync|synchroniz|bulk|hromadn)/.test(text);
  const imageAssetOps = /(prirad k produktu|pridej do clanku|vloz do clanku|nahraj obrazek|pridej obrazek|cover existujiciho clanku)/.test(text);

  if (seoIntent && !directCmsOps) return { specialist: 'seo', reason: 'seo_intent' };
  if (imageIntent && !imageAssetOps) return { specialist: 'image', reason: 'image_intent' };
  return { specialist: null };
}

const ADMIN_AGENT_SYSTEM = `Jsi webový operátor pro Vividbooks CMS. Tvoje role je orchestrátor a operátor webu: čteš data, zapisuješ do CMS, spravuješ produkty, předměty, blog, novinky, webináře, notifikace, taby a RAG indexaci.

## ═══ KRITICKÉ PRAVIDLO ═══
Pokud uživatel požádá o změnu, tvorbu nebo čtení dat, MUSÍŠ zavolat příslušný nástroj. NIKDY jen nepiš text — UDĚLEJ TO.

## ═══ E-MAILY, NEWSLETTERY, DIKTOVÁNÍ — rozliš od CMS úkolů ═══
Často přijde **text jako odchozí e-mail** nebo krátký koncept z diktování (např. „Dobrý den, posílám informace o plánovaných webinářích… S pozdravem, Vítek“).

**Výchozí výklad:** Uživatel chce **pomoc s psaním a úpravou textu** pro příjemce (copy, doplnění faktů, lepší předmět, struktura), **ne** zadání úkolu „vytvoř záznamy v administraci“ ani „pošli mi údaje kvůli vytvoření v systému a zaindexování do RAG“.

**MUSÍŠ:**
- Odpovědět jako **editor / copywriter**: navrhni vylepšené znění, předmět e-mailu, krátký perex nebo druhou variantu těla — **přímo v odpovědi** (Markdown).
- K doplnění faktů použij **kontext RAG** (je v systémovém doplnění) a případně nástroje \`get_webinars\`, \`get_products\`, \`get_novinky\` — jen pokud potřebuješ ověřit reálné termíny, názvy nebo odkazy.
- **Nežádej** uživatele o seznam polí „pro vytvoření v systému“, pokud sám **neřekl**, že má obsah vzniknout **na webu / v CMS**.

**CMS nástroje** (\`create_webinar\`, \`update_webinar\`, \`rag_index_item\`, …) použij **jen** když uživatel výslovně chce obsah **vytvořit, uložit nebo publikovat** na webu (např. „založ webinář v CMS“, „přidej novinku na web“, „publikuj článek“).

**NIKDY** neinterpretuj obecný koncept e-mailu zmíněný o webinářích jako požadavek na **ruční zadávání webinářů do adminu** — pokud neřekl, že to má být v CMS.

## Základní workflow
1. **Čtení** → okamžitě zavolej get_ nástroj, shrň výsledky
2. **Úprava/tvorba** → zavolej akční nástroj, ulož, pak napiš shrnutí
3. **Hromadná změna produktů** → primárně rovnou \`bulk_update_products\` / \`bulk_update_prices_percentage\` s filtry (\`filter_name_contains\`, \`filter_type\`, \`filter_category\`). \`get_products\` jen když potřebuješ zkontrolovat výběr — nevolaj \`full_fields: true\` bez nutnosti (dlouhé popisy zbytečně žerou paměť a mohou shodit edge worker HTTP 546).
4. **Hromadná změna (ostatní)** → get_ pro preview, pak IHNED bulk_ bez dalšího ptaní
5. Nikdy nevymýšlej ID — získej přes get_ nástroj

## Filtry pro produkty
- Písanky → filter_name_contains = "písank"
- Pracovní sešity → filter_type = "workbook"
- Digitální → filter_type = "online"
- Ceny jsou ve formátu "390,-"

## ═══ SPECIALISTÉ A DELEGACE ═══

Máš k dispozici 2 specialisty:
- delegate_to_seo_specialist pro SEO brief, metadata, obsahovou strukturu, search intent, interní prolinkování a obsahovou strategii.
- delegate_to_image_specialist pro cover obrázky, koláže, hero vizuály a obrazový handoff.

### Marketing a copywriting děláš přímo ty
- Marketingové texty, hero texty, CTA, tagline, social copy, newslettery, emaily, landing page copy a delší texty o Vividbooks píšeš SÁM.
- Nepřeposílej marketingové zadání dalšímu agentovi.
- Když uživatel chce text i jeho uložení do CMS, nejdřív si přes get_ nástroj zjisti správný záznam a potom text rovnou ulož.

### Kdy MUSÍŠ delegovat
- Uživatel chce SEO návrh, keyword intent, meta title/description, obsahovou osnovu nebo content brief → deleguj SEO specialistovi.
- Uživatel chce vymyslet nebo připravit vizuál, cover, koláž nebo obrazový směr → deleguj image specialistovi.

### Co naopak děláš ty
- Čteš a upravuješ obsah v CMS.
- Píšeš finální marketingové texty pro Vividbooks.
- Spravuješ produkty, blog, novinky, webináře, tabs, notifikace, email drafty a RAG indexaci.
- Když je úkol primárně operativní (najdi záznam, uprav pole, publikuj, smaž, přidej obrázek do existujícího článku, uprav produkt), proveď ho přímo nástroji.

### Pravidlo tvrdé specializace
- NIKDY sám nepiš SEO brief, pokud to má dělat SEO specialista.
- NIKDY sám nevymýšlej obrazový koncept, pokud to má dělat image specialista.
- Marketingové výstupy píšeš přímo ty v rámci role Web operátora.

## ═══ MARKETING A BRAND VOICE VIVIDBOOKS ═══

### O Vividbooks
- Interaktivní digitální učebnice a pracovní sešity pro ZŠ.
- Předměty: Matematika, Fyzika, Chemie, Přírodopis, Český jazyk, Prvouka.
- Cílové skupiny: učitelé ZŠ, školy, ředitelé, rodiče, žáci.
- Silné stránky: animace a interaktivní lekce, 3D modely, badatelské listy, okamžitá zpětná vazba, Vividboard, soulad s RVP 2025, doložky MŠMT, 14denní trial zdarma.
- Web: www.vividbooks.com

### Tone of voice
- Vždy česky.
- Tón: inspirující, pedagogicky zaměřený, přátelský, profesionální, moderní a důvěryhodný.
- Piš konkrétně, bez prázdných floskulí a bez přehnaného reklamního tónu.
- Nevymýšlej si neexistující funkce, produkty, ceny, akce ani webináře.

### Jak psát marketingové výstupy
- Když to dává smysl, nabídni 2-3 varianty.
- U emailů odděl subject line, preheader, headline, body a CTA.
- U social postů přidej i doporučené hashtagy, pokud jsou vhodné.
- Pokud má být výstup určen k uložení do konkrétního pole v CMS, respektuj cílové pole a jeho účel.

## ═══ WEBOVÉ WORKFLOWS ═══

### Práce s blogem / novinkami / webináři
- Pokud uživatel chce spravovat existující obsah, používej příslušné get_, update_, publish_, delete_ nástroje.
- Pokud chce přidat obrázek do EXISTUJÍCÍHO článku, použij add_image_to_blog_post, ne regeneraci článku.
- Pro slider použij add_slider_to_blog_post.
- Pro tabs v článku použij add_tabs_to_blog_post.

### Taby předmětů
- Před vytvořením nebo úpravou vždy nejdřív zavolej get_subject_tabs.
- Pak teprve create_subject_tab, update_subject_tab nebo delete_subject_tab.

### Předměty / landing pages
- Když uživatel chce upravit pole předmětu, vždy nejdřív zavolej get_subject_pages.
- Pak použij create_subject_page, update_subject_page nebo delete_subject_page.
- Pole jako heroText, authorIntroHeading, authorIntroBody, displayName, slug, tagline, heroColor, heroColorDark, accentColor, grades, stats, features, topics, rvpNote, dolozka, isActive, order a další metadata patří do PŘEDMĚTU, ne do tabu.
- **Často kladené dotazy (FAQ)** u předmětu: pole faqs = JSON pole objektů { "question": "...", "answer": "..." }. Uprav přes update_subject_page s fields: { faqs: [ ... ] }. Po uložení se FAQ sama zaindexují do RAG — **nepotřebuješ** volat rag_index_item.
- "Úvod pro učitele", "hero text", "úvodní slovo autora", "tagline", "barvy předmětu", "ročníky", "statistiky", "RVP poznámka", "doložka", "pořadí", **"FAQ", "časté dotazy u předmětu"** = update_subject_page.
- "Tab", "záložka", "prodejní argument", "Pracovní sešity", "Učební text", "Procvičování" = subject taby, tedy get_subject_tabs + create/update/delete_subject_tab.
- Pokud uživatel řekne "ulož to do předmětu" nebo "uprav stránku předmětu", neukládej to do tabů, ale do subject page.

### Email drafty (Mailchimp-ready HTML) — Canvas
- **KRITICKÉ:** Jakmile uživatel chce **mail verzi**, **Mailchimp šablonu**, **otevřít v canvasu / editoru**, nebo **uložit do Email Builderu**, **NESMÍŠ** odpovědět jen dlouhým textem nebo osnovou bloků v chatu. **VŽDY nejdřív zavolej** \`create_email_campaign_draft\` s plným \`bodyHtml\` + subject, previewText, headline, ctaText, ctaUrl. Krátké potvrzení („Uloženo, otevři panel vpravo“) piš **až po** úspěšném nástroji. Teprve nástroj otevře uživateli email **canvas** (pravý panel).
- **Typy bloků jako \`/admin/mailchimp/generate-email\`:** skládej **(1)–(6)** — **objem textu** převažuje v **(2)**, plus **(3)(4)(6)** dle dat. Střídej **pozadí sekcí**: full-width tabulky (\`#001161\`, oranžová, žlutý tip, šedý \`#E8EDF4\` s bílou vnitřní kartou), ne jen jedna barva. Oranžové CTA \`#F06632\`, \`vb-email-root\` + \`@media\`, 4+ produktů → koláž + URL z \`get_products\`. „Předělej na text“ = souvislé odstavce; „přidej webinář“ = **(6a–c)** z \`get_webinars\`. Font **Arial**.
- **Marketing agent vs. ty:** Generátor v Marketing agentovi (\`generate-email\`) má navíc sestavený kontext (RAG, katalog, historie kampaní) — je **nejvhodnější pro nejbohatší první verzi**, pokud ji uživatel vygeneruje **ručně tam** a pak ji v Email Builderu upraví. Jako Web operátor ten kontext nemáš automaticky: pro plnou paritu **nejdřív načti produkty** (\`get_products\`) a text z briefu uživatele převeď na výše popsané HTML; nebo uživateli stručně řekni, že nejbohatší start je v Marketing agentovi, pokud nechce čekat na ruční kompozici.
- Pokud už v konverzaci existuje obsah emailu z dřívějška, **převeď ho** do plného \`bodyHtml\` podle tohoto layoutu a ulož nástrojem — neopisuj znovu jako Markdown osnovu.
- Seznam draftů: \`get_email_drafts\`.
- Volitelné \`fullHtml\` jen výjimečně; jinak systém obalí \`bodyHtml\` do Vividbooks šablony.
- V canvasu pak může uživatel kliknout **Mailchimp** pro draft kampaně v MC.

## ═══ RAG ZNALOSTNÍ BÁZE ═══

RAG je systém pro vyhledávání obsahu při dotazech na webu. Každý nový obsah musí být zaindexován, aby byl dostupný při odpovídání návštěvníkům.

### Automatická indexace (VŽDY PROVEĎ)
Po každém z těchto nástrojů MUSÍŠ okamžitě zavolat \`rag_index_item\` se správným source a id:
- \`create_blog_post\` → \`rag_index_item(source="blog", id=<vrácené id>)\`
- \`update_blog_post\` → \`rag_index_item(source="blog", id=<id>)\`
- \`create_novinka\` → \`rag_index_item(source="novinky", id=<vrácené id>)\`
- \`update_novinka\` → \`rag_index_item(source="novinky", id=<id>)\`
- \`create_webinar\` → \`rag_index_item(source="webinare", id=<vrácené id>)\`
- \`update_webinar\` → \`rag_index_item(source="webinare", id=<id>)\`
- \`update_product\` → \`rag_index_item(source="produkty", id=<id>)\`

### Po smazání (VŽDY PROVEĎ)
- \`delete_product\` → \`rag_remove_item(source="produkty", id=<id>)\`
- \`delete_webinar\` → \`rag_remove_item(source="webinare", id=<id>)\`

### Manuální dotazy od uživatele
- "zaindexuj blog" → \`rag_index_source(source="blog")\` — celý zdroj najednou
- "co je v RAGu" → \`rag_get_stats()\` — přehled chunků

### Formát výsledku RAG
Po \`rag_index_item\` uveď: "✅ Zaindexováno do RAG (N chunků)"

## ═══ NAHRANÉ OBRÁZKY OD UŽIVATELE ═══

Uživatel může nahrát obrázky přímo do chatu. Když uvidíš obrázek, ROZHODNI co s ním chce — NEPŘEGENERUJ automaticky celý článek:

### KRITICKÉ PRAVIDLO: Obrázek ≠ přegenerování článku
Pokud uživatel nahraje/připojí obrázek a říká "přidej ho do článku", "vlož ho tam", "přidej tuto fotku" apod.:
→ NIKDY nevolej preview_blog_post ani create_blog_post znovu!
→ Zavolej get_blog_posts → najdi správný článek → zavolej add_image_to_blog_post(id, image_url)
→ Obsah článku se zachová, obrázek se jen vloží na dané místo.

### Rozhodovací strom — co chce uživatel s obrázkem:

**A) Přidat obrázek DO TEXTU existujícího uloženého článku** ("přidej tam tento obrázek", "vlož tuto fotku do článku"):
→ get_blog_posts → zjisti ID článku → add_image_to_blog_post(id, image_url, position="end")
→ Použij position="after_intro" pokud chce hned po úvodu, "beginning" na začátek, "end" na konec

**B) VYMĚNIT titulní (cover) obrázek článku** ("změň cover", "dej jiný úvodní obrázek"):
→ get_blog_posts → zjisti ID → update_blog_post(id, fields={coverImage: image_url})

**C) Přidat k produktu** ("přiřaď k produktu", "to je foto X"):
→ get_products → assign_image_to_product(product_id, image_url)

**D) Použít v AI koláži** ("vygeneruj s tímto obrázkem koláž"):
→ generate_blog_image(imageUrls=[image_url, ...dalsiUrl], style="ai-table")

**D1) Monochromatická třída + sešity V1 (šitá vazba) na stole** — styl jako jednobarevné lavice, židle, interaktivní tabule vlevo; obálky z produktů leží na lavici jako tenké sešity se sešívkou, NE tlustá lepená kniha:
→ get_product_images → generate_blog_image(style="ai-monochrome-classroom", imageUrls=[URL obálek], monochromeColor="např. matná mint zelená / sytá žlutá / pastelová korál", styleReferenceUrls=[1–3 veřejné URL moodboardů z Storage — volitelné ale doporučené])

**D2) Klasická canvas koláž** ("udělej klasický grid / scattered koláž"):
→ get_product_images → open_collage_builder(image_urls=[...], style="grid"|"scattered"|"fan")

**E) Vygenerovat nový AI obrázek ze scény** ("nafoť děti s učebnicemi"):
→ generate_blog_image(style="ai-custom", customPrompt="...", imageUrls=[image_url])

**F2) Přidat slider do článku** ("přidej galerii obrázků"):
→ get_blog_posts → add_slider_to_blog_post(id, image_urls=[...])

**F3) Přidat tabs do článku** ("přidej záložky"):
→ get_blog_posts → add_tabs_to_blog_post(id, tabs=[{label, content}])

**F) Uživatel nesdělil záměr** → ZEPTEJ se: "Co chceš s tímto obrázkem udělat? Přidat do článku / vyměnit cover / přiřadit k produktu?"

Vždy popiš co vidíš na obrázku a co jsi s ním udělal.

## Formát odpovědi po akci
✅ **Provedeno**: [co bylo uděláno]
📝 **Rozsah**: [počet změn / co bylo vytvořeno]
🧠 **RAG**: [zda byl obsah zaindexován]
Odkaz ke kontrole bude zobrazen automaticky.`;

function clearAdminAgentGlobals() {
  (globalThis as any).__adminAgentRecentMessages = undefined;
  (globalThis as any).__agentDeadline = undefined;
  (globalThis as any).__embeddedAssistantMode = undefined;
  (globalThis as any).__adminAgentAllowedTools = undefined;
  (globalThis as any).__crmAgentRequestContext = undefined;
  (globalThis as any).__lastCrmOrchestratorPayload = undefined;
}

app.post('/make-server-93a20b6f/admin/admin-agent', async (c) => {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG není nastaven.' }, 500);
    const body = await c.req.json();
    const embeddedAssistant = body.embeddedAssistant === true;
    const crmAssistant = body.crmAssistant === true;
    const { messages } = body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) return c.json({ error: 'Chybí messages.' }, 400);
    (globalThis as any).__lastCrmOrchestratorPayload = undefined;
    (globalThis as any).__crmAgentRequestContext = crmAssistant
      ? {
          googleAccessToken: body.googleAccessToken ?? null,
          lastRouteData: body.lastRouteData ?? null,
          conversationHistory: messages,
        }
      : undefined;
    (globalThis as any).__adminAgentAllowedTools = crmAssistant
      ? CRM_ASSISTANT_TOOL_NAMES
      : embeddedAssistant
        ? EMBEDDED_ASSISTANT_TOOL_NAMES
        : undefined;
    const ALLOWED_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview'];
    const selectedModel: string = (body.model && ALLOWED_MODELS.includes(body.model)) ? body.model : 'gemini-3.1-pro-preview';

    const nowPrague = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
    const todayCZ = nowPrague.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    (globalThis as any).__adminAgentRecentMessages = Array.isArray(messages) ? messages.slice(-15) : [];

    const lastUserIdx = [...messages].map((m: any, i: number) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop() ?? -1;
    const lastUserMessage = lastUserIdx >= 0 ? messages[lastUserIdx] : null;
    const restrictedMode = embeddedAssistant || crmAssistant;
    const forceSubjectPageToolCall = restrictedMode ? false : shouldForceAdminToolCall(lastUserMessage);
    const forceEmailDraftToolCall = restrictedMode ? false : userWantsEmailCanvasDraft(lastUserMessage);
    const routed = restrictedMode ? { specialist: null as const } : inferAdminSpecialistRoute(lastUserMessage);
    if (routed.specialist) {
      const enrichedContent = `${String(lastUserMessage?.content || '')}${Array.isArray(lastUserMessage?.images) && lastUserMessage.images.length > 0 ? `\n\nUživatel přiložil ${lastUserMessage.images.length} obrázek/obrázky.` : ''}`;
      console.log(`[AdminAgent] Pre-routing → ${routed.specialist} (${routed.reason})`);
      if (routed.specialist === 'seo') {
        const data = await runTextSpecialistAgent({
          logPrefix: 'AdminPreRoute->Seo',
          systemPrompt: SEO_AGENT_SYSTEM_PROMPT,
          messages: buildSpecialistHandoffMessages(messages, enrichedContent),
          productContext: await getAllProducts(),
          model: body.model,
          useRag: true,
        });
        clearAdminAgentGlobals();
        return c.json({
          reply: `Předal jsem zadání SEO specialistovi.\n\n${data.reply}`,
          actions: [{
            type: 'delegate_seo_specialist',
            name: 'SEO specialista',
            text: String(lastUserMessage?.content || ''),
            fields: { specialista: 'seo', routeReason: routed.reason },
          }],
        });
      }
      if (routed.specialist === 'image') {
        const data = await runTextSpecialistAgent({
          logPrefix: 'AdminPreRoute->Image',
          systemPrompt: IMAGE_AGENT_SYSTEM_PROMPT,
          messages: buildSpecialistHandoffMessages(messages, enrichedContent),
          productContext: await getAllProducts(),
          model: body.model,
          useRag: false,
        });
        clearAdminAgentGlobals();
        return c.json({
          reply: `Předal jsem zadání image specialistovi.\n\n${data.reply}`,
          actions: [{
            type: 'delegate_image_specialist',
            name: 'Image specialista',
            text: String(lastUserMessage?.content || ''),
            fields: { specialista: 'image', routeReason: routed.reason },
          }],
        });
      }
    }

    let ragSupplement = '';
    const ragQueryText = String(lastUserMessage?.content || '').trim();
    if (ragQueryText.length >= 12 && !/^\(obr[aá]zky\)$/i.test(ragQueryText)) {
      try {
        const rag = await collectRagContextForSpecialist(ragQueryText, 'AdminAgent');
        if (rag.ragContext) {
          ragSupplement = `\n\n## Kontext z RAG (relevantní chunky z knihovny — doplňkové info; přesná aktuální data vždy ověř přes get_ nástroje)\n${rag.ragContext}`;
        }
        console.log(`[AdminAgent] RAG supplement: chunks=${rag.ragChunksUsed} ${JSON.stringify(rag.ragDebug)}`);
      } catch (ragErr: any) {
        console.log(`[AdminAgent] RAG supplement skipped: ${ragErr.message}`);
      }
    }
    const emailCanvasSystemNudge =
      !restrictedMode && forceEmailDraftToolCall
        ? `\n\n## OKAMŽITÝ POŽADAVEK (email → canvas vpravo)\nUživatel chce mail v Email Builderu. **První krok na tomto kole:** volej výhradně \`create_email_campaign_draft\` s plným \`bodyHtml\` z kontextu konverzace a metadaty. Nepíš osnovu ani předmět jen do textu odpovědi — nástroj spustí náhled v panelu.`
        : '';
    const systemText = crmAssistant
      ? `${CRM_ASSISTANT_SYSTEM}\n\n## Aktuální datum\n${todayCZ}${ragSupplement}`
      : embeddedAssistant
        ? `${EMBEDDED_ASSISTANT_SYSTEM}\n\n## Aktuální datum\n${todayCZ}${ragSupplement}`
        : `${ADMIN_AGENT_SYSTEM}\n\n## Aktuální datum\n${todayCZ}${ragSupplement}${emailCanvasSystemNudge}`;

    // Build Gemini contents — support multimodal (images) only for the LAST user message
    // (older messages were already processed in previous turns, re-fetching all would be too slow)

    const contents: any[] = [];
    for (let mi = 0; mi < messages.length; mi++) {
      const m = messages[mi];
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });

      // Only attach images from the most-recent user message to avoid re-fetching history
      if (mi === lastUserIdx && m.role === 'user' && Array.isArray(m.images) && m.images.length > 0) {
        const MAX_IMG_BYTES = 4 * 1024 * 1024; // 4 MB cap
        for (const imgUrl of m.images) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10_000); // 10s per image
            const imgRes = await fetch(imgUrl, { signal: controller.signal });
            clearTimeout(timer);
            if (!imgRes.ok) { console.log(`[AdminAgent] Image HTTP ${imgRes.status} for ${String(imgUrl).slice(0, 60)}`); continue; }
            const buf = await imgRes.arrayBuffer();
            if (buf.byteLength > MAX_IMG_BYTES) {
              console.log(`[AdminAgent] Image too large (${buf.byteLength}B > ${MAX_IMG_BYTES}B), skipping`);
              parts.push({ text: `[Obrázek ${String(imgUrl).slice(0, 60)}... byl příliš velký (${Math.round(buf.byteLength/1024)}KB > 4MB) a nebyl přiložen]` });
              continue;
            }
            // Use encodeBase64 — much faster than btoa string loop
            const base64 = encodeBase64(new Uint8Array(buf));
            const mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
            parts.push({ inlineData: { mimeType, data: base64 } });
            console.log(`[AdminAgent] Attached image ${String(imgUrl).slice(0, 60)} mime=${mimeType} size=${buf.byteLength}B`);
          } catch (imgErr: any) {
            console.log(`[AdminAgent] Image fetch failed for ${String(imgUrl).slice(0, 60)}: ${imgErr.message}`);
            parts.push({ text: `[Nepodařilo se načíst obrázek: ${imgErr.message}]` });
          }
        }
      }

      if (parts.length === 0) parts.push({ text: '' });
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
    }
    // CRITICAL: Gemini REST API requires snake_case "function_declarations", NOT camelCase
    const tools = [{
      function_declarations: crmAssistant
        ? CRM_ASSISTANT_TOOLS
        : embeddedAssistant
          ? EMBEDDED_ASSISTANT_TOOLS
          : ADMIN_AGENT_TOOLS,
    }];
    const allActions: any[] = [];
    const model = selectedModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Deadline guard — Supabase Edge Functions have ~150s wall clock. Reserve ~20s for safety.
    const AGENT_DEADLINE = Date.now() + 130_000;
    // Expose deadline so runAdminTool can skip RAG when time is tight
    (globalThis as any).__agentDeadline = AGENT_DEADLINE;

    /** Dokud nevznikne create_email_campaign_draft, drž vynucené volání tohoto nástroje (i po opravném kole). */
    let restrictToEmailDraftTool = !restrictedMode && forceEmailDraftToolCall;
    if (!restrictedMode && forceEmailDraftToolCall) {
      console.log('[AdminAgent] Email/Mailchimp canvas intent — tool lock activates until create_email_campaign_draft');
    }

    for (let turn = 0; turn < 16; turn++) {
      const remaining = AGENT_DEADLINE - Date.now();
      if (remaining < 20_000) {
        console.log(`[AdminAgent] Deadline approaching (${remaining}ms left), returning partial result at turn ${turn+1}`);
        const crmPartial = (globalThis as any).__lastCrmOrchestratorPayload;
        clearAdminAgentGlobals();
        return c.json({
          reply: `Provedl jsem ${allActions.length} akcí, ale zbývající operace jsem musel přeskočit kvůli časovému limitu. Zkuste prosím pokračovat v novém dotazu.`,
          actions: allActions,
          ...(crmAssistant ? { crmPayload: crmPartial } : {}),
        });
      }
      const geminiBody = {
        system_instruction: { parts: [{ text: systemText }] },
        contents,
        tools,
        tool_config: (() => {
          const emailDraftDone = allActions.some((a: any) => a.type === 'create_email_campaign_draft');
          if (!restrictedMode && restrictToEmailDraftTool && !emailDraftDone) {
            return { function_calling_config: { mode: 'ANY' as const, allowed_function_names: ['create_email_campaign_draft'] } };
          }
          if (turn !== 0) return { function_calling_config: { mode: 'AUTO' as const } };
          if (!restrictedMode && forceSubjectPageToolCall) return { function_calling_config: { mode: 'ANY' as const } };
          return { function_calling_config: { mode: 'AUTO' as const } };
        })(),
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      };
      console.log(`[AdminAgent] Turn ${turn+1} — contents=${contents.length} parts, remaining=${remaining}ms`);
      // Jedno volání Gemini: dříve max 45s — u RAG + function calling často nestačilo. Až 90s, s 1× retry při timeoutu.
      let res: Response | undefined;
      const GEMINI_FETCH_ATTEMPTS = 2;
      for (let attempt = 0; attempt < GEMINI_FETCH_ATTEMPTS; attempt++) {
        const remainingNow = AGENT_DEADLINE - Date.now();
        if (remainingNow < 12_000) {
          console.log(`[AdminAgent] Turn ${turn + 1}: deadline too tight (${remainingNow}ms), stopping Gemini fetch`);
          clearAdminAgentGlobals();
          return c.json({
            reply: `Časový limit agenta (zbývalo málo času). Provedeno ${allActions.length} akcí. Zkuste pokračovat v dalším dotazu.`,
            actions: allActions,
          });
        }
        const perRequestMs = Math.min(90_000, Math.max(15_000, remainingNow - 12_000));
        const geminiController = new AbortController();
        const geminiTimer = setTimeout(() => geminiController.abort(), perRequestMs);
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiBody),
            signal: geminiController.signal,
          });
          clearTimeout(geminiTimer);
          break;
        } catch (fetchErr: any) {
          clearTimeout(geminiTimer);
          const isAbort = fetchErr?.name === 'AbortError' || /abort/i.test(String(fetchErr?.message || ''));
          if (isAbort && attempt < GEMINI_FETCH_ATTEMPTS - 1) {
            console.log(`[AdminAgent] Gemini fetch timeout (attempt ${attempt + 1}/${GEMINI_FETCH_ATTEMPTS}), retrying once…`);
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          console.log(`[AdminAgent] Gemini fetch failed: ${fetchErr.message}`);
          clearAdminAgentGlobals();
          return c.json({
            reply: `Gemini nedostála včas (${isAbort ? 'timeout' : 'síť'}). Provedeno ${allActions.length} akcí. Zkuste stejný dotaz znovu nebo zkrátit zadání.`,
            actions: allActions,
          });
        }
      }
      if (!res) {
        clearAdminAgentGlobals();
        return c.json({
          reply: `Gemini API timeout. Provedeno ${allActions.length} akcí. Zkuste pokračovat v dalším dotazu.`,
          actions: allActions,
        });
      }
      if (!res.ok) {
        const errText = await res.text();
        console.log(`[AdminAgent] Gemini error ${res.status}: ${errText.slice(0, 500)}`);
        clearAdminAgentGlobals();
        return c.json({ error: `Gemini chyba (${res.status}): ${errText.slice(0, 200)}` }, 500);
      }
      const data = await res.json();
      const finishReason = data.candidates?.[0]?.finishReason;
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      console.log(`[AdminAgent] Turn ${turn+1} finishReason=${finishReason} parts=${parts.length} partTypes=${parts.map((p: any) => p.functionCall ? 'fn:'+p.functionCall.name : 'text').join(',')}`);
      contents.push({ role: 'model', parts });

      const funcCalls = parts.filter((p: any) => p.functionCall);
      if (funcCalls.length === 0) {
        const reply = parts.find((p: any) => p.text)?.text || '';
        if (allActions.length === 0 && looksLikeFakeToolExecution(reply) && turn < 15) {
          console.log('[AdminAgent] Detected fake tool narration, forcing another turn with explicit tool instruction');
          contents.push({
            role: 'user',
            parts: [{
              text: restrictedMode
                ? 'Odpověz přímo vlastními slovy. Pokud potřebuješ ověřit fakta z katalogu, zavolej jen get_* nástroje; pro CRM školy/trasy/kalendář sales_crm_orchestrate. Neměň web ani nevytvářej e-mailové šablony v systému.'
                : 'Nepopisuj plán ani pseudo-volání nástrojů. Okamžitě proveď skutečné volání příslušného get_/update_/create_/delete_ nástroje a až potom napiš stručné potvrzení výsledku.',
            }],
          });
          continue;
        }
        const hasEmailDraft = allActions.some((a: any) => a.type === 'create_email_campaign_draft');
        if (!restrictedMode && !hasEmailDraft && looksLikeEmailTemplateNarrationWithoutTool(reply) && turn < 15) {
          restrictToEmailDraftTool = true;
          console.log('[AdminAgent] Mailchimp-style text without create_email_campaign_draft — forcing tool round');
          contents.push({
            role: 'user',
            parts: [{
              text: 'Tuto odpověď uživateli nestačí — aby se otevřel emailový canvas vpravo, MUSÍŠ zavolat nástroj create_email_campaign_draft s plným bodyHtml (inline HTML jako u generate-email: převažuje souvislý text, ne „leták\") + subject, previewText, headline, ctaText, ctaUrl. Nepiš už jen osnovu bloků nebo předmět do čistého textu.',
            }],
          });
          continue;
        }
        console.log(`[AdminAgent] Done turn=${turn+1} actions=${allActions.length} replyLen=${reply.length}`);
        const crmPayloadOut = (globalThis as any).__lastCrmOrchestratorPayload;
        let replyOut = reply;
        if (
          crmAssistant &&
          crmPayloadOut &&
          crmPayloadOut.success === false &&
          typeof crmPayloadOut.response === 'string' &&
          crmPayloadOut.response.trim()
        ) {
          replyOut = crmPayloadOut.response.trim();
        }
        clearAdminAgentGlobals();
        return c.json({
          reply: replyOut,
          actions: allActions,
          ...(crmAssistant ? { crmPayload: crmPayloadOut } : {}),
        });
      }

      const funcResults: any[] = [];
      for (const part of funcCalls) {
        const { name, args } = part.functionCall;
        console.log(`[AdminAgent] Calling tool: ${name} args=${JSON.stringify(args || {}).slice(0, 200)}`);
        try {
          const { result, action } = await runAdminTool(name, args || {}, { agentMessages: messages });
          if (action) allActions.push(action);
          console.log(`[AdminAgent] Tool ${name} result: ${JSON.stringify(result).slice(0, 200)}`);
          // Gemini REST API function response format
          funcResults.push({ functionResponse: { name, response: result } });
        } catch (toolErr: any) {
          console.log(`[AdminAgent] Tool ${name} ERROR: ${toolErr.message}`);
          funcResults.push({ functionResponse: { name, response: { error: toolErr.message } } });
        }
      }
      contents.push({ role: 'user', parts: funcResults });
    }
    clearAdminAgentGlobals();
    return c.json({ reply: 'Agent dosáhl maximálního počtu kroků. Zkuste rozdělit úkol.', actions: allActions });
  } catch (e: any) {
    clearAdminAgentGlobals();
    console.log(`[AdminAgent] Exception: ${e.message}`);
    return c.json({ error: `Chyba: ${e.message}` }, 500);
  }
});

/* ─────────────────────────────────────────────────────────────────
   POST /admin/commit-blog-draft  — uloží schválený draft do DB + zaindexuje do RAG
────────────────────────────────���──────────────────────────────── */
app.post('/make-server-93a20b6f/admin/commit-blog-draft', async (c) => {
  try {
    const body = await c.req.json();
    const { draft } = body;
    if (!draft || !draft.title) return c.json({ error: 'Chybí draft nebo title' }, 400);
    const ts = new Date().toISOString();
    const item = {
      id: `blog-${Date.now()}`,
      slug: draft.slug || `blog-${Date.now()}`,
      published: false,
      date: draft.date || new Date().toLocaleDateString('cs-CZ'),
      title: draft.title,
      author: draft.author || 'Vividbooks',
      category: draft.category || 'Aktuality',
      tags: draft.tags || '',
      excerpt: draft.excerpt || '',
      readTime: draft.readTime || 5,
      coverImage: draft.coverImage || '',
      content: draft.content || [],
      contentHtml: draft.contentHtml || '',
      createdAt: ts,
    };
    const items = await getCollection(BLOG_KEY);
    await saveCollection(BLOG_KEY, [...items, item]);
    console.log(`[CommitBlogDraft] Uložen: "${item.title}" id=${item.id}`);
    // Auto-indexace do RAG
    try {
      const chunk = {
        id: `blog-${item.id}-0`,
        text: `${item.title}\n${item.excerpt}\n${item.content.filter((b: any) => b.type === 'paragraph').map((b: any) => b.text).join('\n')}`.slice(0, 3000),
        metadata: { source: 'blog', sourceId: item.id, title: item.title, date: item.date, category: item.category, url: `/blog/${item.slug}` },
        createdAt: ts,
      };
      const idx = await loadAllChunks();
      idx.push(chunk);
      await saveAllChunks(idx);
      console.log(`[CommitBlogDraft] RAG zaindexován: ${chunk.id}`);
    } catch (ragErr: any) {
      console.log(`[CommitBlogDraft] RAG warning: ${ragErr.message}`);
    }
    return c.json({ success: true, id: item.id, title: item.title, slug: item.slug });
  } catch (e: any) {
    console.log(`[CommitBlogDraft] Chyba: ${e.message}`);
    return c.json({ error: `Chyba při ukládání: ${e.message}` }, 500);
  }
});

const ADMIN_AGENT_CHAT_IDX = 'vb:admin-agent:chats:index';
let adminChatDbAvailableCache: boolean | null = null;

async function hasAdminChatDb(): Promise<boolean> {
  if (adminChatDbAvailableCache !== null) return adminChatDbAvailableCache;
  try {
    const { error } = await getDbClient().from('chat_threads').select('id', { head: true, count: 'exact' }).limit(1);
    adminChatDbAvailableCache = !error;
    if (error) console.log(`[AdminAgentChat] DB unavailable, using KV fallback: ${error.message}`);
  } catch (e: any) {
    console.log(`[AdminAgentChat] DB probe failed, using KV fallback: ${e.message}`);
    adminChatDbAvailableCache = false;
  }
  return adminChatDbAvailableCache;
}

function mapAdminRole(role: string): 'user' | 'assistant' | 'system' | 'tool' {
  if (role === 'assistant' || role === 'system' || role === 'tool') return role;
  return 'user';
}

function buildAdminChatMessageRows(threadId: string, messages: any[]): any[] {
  return (messages || [])
    .filter(Boolean)
    .slice(-60)
    .map((message: any, index: number) => ({
      id: String(message.id || `${threadId}-msg-${index}`),
      thread_id: threadId,
      role: mapAdminRole(message.role),
      message_kind: 'message',
      content: String(message.content || ''),
      content_format: 'text',
      token_count: null,
      metadata: {
        raw: message,
        external_id: String(message.id || `${threadId}-msg-${index}`),
        ts: message.ts || null,
        order: index,
      },
    }));
}

async function getAdminChatFromDb(id: string): Promise<any | null> {
  const sb = getDbClient();
  const { data: thread, error: threadError } = await sb
    .from('chat_threads')
    .select('id,title,created_at,updated_at,last_message_at,metadata')
    .eq('id', id)
    .eq('agent_key', 'admin-agent')
    .maybeSingle();
  if (threadError) throw new Error(threadError.message);
  if (!thread) return null;
  const { data: messages, error: msgError } = await sb
    .from('chat_messages')
    .select('id,role,content,metadata,created_at')
    .eq('thread_id', id)
    .order('created_at', { ascending: true });
  if (msgError) throw new Error(msgError.message);
  const sortedMessages = [...(messages || [])].sort((a: any, b: any) => {
    const aTs = Number(a?.metadata?.raw?.ts ?? a?.metadata?.ts ?? 0);
    const bTs = Number(b?.metadata?.raw?.ts ?? b?.metadata?.ts ?? 0);
    if (aTs && bTs && aTs !== bTs) return aTs - bTs;
    const aOrder = Number(a?.metadata?.order ?? Number.MAX_SAFE_INTEGER);
    const bOrder = Number(b?.metadata?.order ?? Number.MAX_SAFE_INTEGER);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return {
    id: thread.id,
    title: thread.title,
    messages: sortedMessages.map((row: any) => {
      const raw = row.metadata?.raw;
      const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      const contentFromRaw = typeof r.content === 'string' ? r.content : r.content != null ? String(r.content) : '';
      const content = contentFromRaw || (row.content ?? '');
      const role = mapAdminRole(String(r.role ?? row.role ?? 'user'));
      return {
        id: r.id ?? row.id,
        role,
        content,
        ts: typeof r.ts === 'number' ? r.ts : Number(row.metadata?.ts || new Date(row.created_at).getTime()),
        actions: r.actions,
        images: r.images,
        loading: r.loading,
      };
    }),
    actions: Array.isArray(thread.metadata?.actions) ? thread.metadata.actions : [],
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  };
}

app.get('/make-server-93a20b6f/admin/admin-agent-chats', async (c) => {
  try {
    if (await hasAdminChatDb()) {
      try {
        const sb = getDbClient();
        const { data, error } = await sb
          .from('chat_threads')
          .select('id,title,created_at,updated_at,last_message_at,metadata')
          .eq('agent_key', 'admin-agent')
          .order('updated_at', { ascending: false })
          .limit(40);
        if (error) throw error;
        const chats = (data || []).map((row: any) => ({
          id: row.id,
          title: row.title || 'Nový úkol',
          updatedAt: row.updated_at || row.last_message_at || row.created_at,
          createdAt: row.created_at,
          messageCount: Number(row.metadata?.messageCount || 0),
        }));
        if (chats.length > 0) return c.json({ chats });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[AdminAgentChat] List fallback to KV: ${dbErr.message}`);
      }
    }
    return c.json({ chats: (await kv.get(ADMIN_AGENT_CHAT_IDX) as any[] | null) || [] });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});
app.get('/make-server-93a20b6f/admin/admin-agent-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (await hasAdminChatDb()) {
      try {
        const chat = await getAdminChatFromDb(id);
        if (chat) return c.json({ chat });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[AdminAgentChat] Get fallback to KV: ${dbErr.message}`);
      }
    }
    const chat = await kv.get(`vb:admin-agent:chat:${id}`);
    if (!chat) return c.json({ error: 'Nenalezen' }, 404);
    return c.json({ chat });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});
app.post('/make-server-93a20b6f/admin/admin-agent-chats', async (c) => {
  try {
    const { id, title, messages, actions } = await c.req.json();
    if (!id) return c.json({ error: 'Chybí id' }, 400);
    const now = new Date().toISOString();
    if (await hasAdminChatDb()) {
      try {
        const sb = getDbClient();
        const safeMessages = (messages || []).filter((m: any) => m && !m.loading);
        const safeActions = Array.isArray(actions) ? actions.slice(-20) : [];
        const threadPayload = {
          id,
          agent_key: 'admin-agent',
          title: title || 'Nový úkol',
          status: 'active',
          metadata: { actions: safeActions, messageCount: safeMessages.length },
          last_message_at: safeMessages.length ? new Date(safeMessages[safeMessages.length - 1].ts || Date.now()).toISOString() : now,
        };
        const { error: threadError } = await sb.from('chat_threads').upsert(threadPayload);
        if (threadError) throw new Error(threadError.message);
        const { error: deleteError } = await sb.from('chat_messages').delete().eq('thread_id', id);
        if (deleteError) throw new Error(deleteError.message);
        const rows = buildAdminChatMessageRows(id, safeMessages);
        if (rows.length) {
          const { error: insertError } = await sb.from('chat_messages').insert(rows);
          if (insertError) throw new Error(insertError.message);
        }
        return c.json({ ok: true });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[AdminAgentChat] Save fallback to KV: ${dbErr.message}`);
      }
    }
    await kv.set(`vb:admin-agent:chat:${id}`, { id, title, messages, actions: actions || [], updatedAt: now });
    const index = (await kv.get(ADMIN_AGENT_CHAT_IDX) as any[] | null) || [];
    const entry = { id, title: title || 'Nový úkol', updatedAt: now, createdAt: index.find((x: any) => x.id === id)?.createdAt || now, messageCount: messages?.length || 0 };
    const idx = index.findIndex((x: any) => x.id === id);
    if (idx >= 0) index[idx] = entry; else index.unshift(entry);
    if (index.length > 40) index.splice(40);
    await kv.set(ADMIN_AGENT_CHAT_IDX, index);
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});
app.delete('/make-server-93a20b6f/admin/admin-agent-chats/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (await hasAdminChatDb()) {
      try {
        const { error } = await getDbClient().from('chat_threads').delete().eq('id', id).eq('agent_key', 'admin-agent');
        if (error) throw error;
        return c.json({ ok: true });
      } catch (dbErr: any) {
        adminChatDbAvailableCache = false;
        console.log(`[AdminAgentChat] Delete fallback to KV: ${dbErr.message}`);
      }
    }
    await kv.del(`vb:admin-agent:chat:${id}`);
    const index = (await kv.get(ADMIN_AGENT_CHAT_IDX) as any[] | null) || [];
    await kv.set(ADMIN_AGENT_CHAT_IDX, index.filter((x: any) => x.id !== id));
    return c.json({ ok: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

/* ── RAG Status & Scheduled Reindex ─────────────────────────────────────── */
const RAG_SCHEDULE_KEY = 'vb:rag-schedule';

app.get('/make-server-93a20b6f/admin/rag-status', async (c) => {
  try {
    const [chunks, schedule] = await Promise.all([
      loadAllChunks(false),
      kv.get(RAG_SCHEDULE_KEY) as Promise<any>,
    ]);
    const bySource: Record<string, number> = {};
    const lastUpdated: Record<string, string> = {};
    for (const ch of chunks) {
      const src = ch?.metadata?.source || 'unknown';
      bySource[src] = (bySource[src] || 0) + 1;
      const ca = ch?.metadata?.createdAt;
      if (ca && (!lastUpdated[src] || ca > lastUpdated[src])) lastUpdated[src] = ca;
    }
    return c.json({
      totalChunks: chunks.length,
      bySource,
      lastUpdated,
      lastFullReindex: schedule?.lastFullReindex || null,
      nextSources: ['produkty', 'blog', 'novinky', 'webinare', 'tabs'],
    });
  } catch (e: any) {
    console.log('[RAG status] chyba:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

app.post('/make-server-93a20b6f/admin/rag-reindex-all', async (c) => {
  const apiKey = Deno.env.get('GEMINI_API_KEY_RAG');
  if (!apiKey) return c.json({ error: 'GEMINI_API_KEY_RAG není nastaven.' }, 500);
  const body = await c.req.json().catch(() => ({}));
  const sources: Array<'produkty' | 'blog' | 'novinky' | 'webinare' | 'tabs'> =
    body.sources || ['blog', 'novinky', 'webinare', 'tabs'];
  const results: Record<string, any> = {};
  for (const src of sources) {
    try {
      console.log(`[RAG reindex-all] Spouštím ${src}…`);
      const stats = await ingestSource(src, apiKey);
      results[src] = { ok: true, ...stats };
    } catch (e: any) {
      console.log(`[RAG reindex-all] ${src} selhalo: ${e.message}`);
      results[src] = { ok: false, error: e.message };
    }
  }
  const schedule = { lastFullReindex: new Date().toISOString(), sources: results };
  await kv.set(RAG_SCHEDULE_KEY, schedule);
  console.log(`[RAG reindex-all] Hotovo: ${JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]: any) => [k, v.ok ? `${v.ingested}✓` : '✗'])))} `);
  return c.json({ success: true, ...schedule });
});

/* ── Image Upload — pro Admin Agent chat ─────────────────────────────────── */
app.post('/make-server-93a20b6f/admin/upload-image', async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    await ensureAgentUploadBucket(supabase);
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return c.json({ error: 'Chybí soubor (field "file")' }, 400);
    const ext = (file.name || 'image').split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `agent/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const mimeType = file.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg');
    const { error: uploadError } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .upload(fileName, uint8Array, { contentType: mimeType, upsert: true });
    if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);
    // Signed URL platná 7 dní
    const { data: signedData, error: signErr } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);
    if (signErr || !signedData?.signedUrl) throw new Error(`Signed URL: ${signErr?.message}`);
    console.log(`[UploadImage] OK: ${fileName} ${uint8Array.length}B → ${signedData.signedUrl.slice(0, 80)}`);
    return c.json({ success: true, url: signedData.signedUrl, fileName, mimeType, size: uint8Array.length });
  } catch (e: any) {
    console.log(`[UploadImage] Chyba: ${e.message}`);
    return c.json({ error: `Chyba při nahrávání obrázku: ${e.message}` }, 500);
  }
});

/* ── Generic KV get/set for frontend settings ─────────────────────────────── */
const ALLOWED_KV_PREFIXES = ['vb:ai-element-assets', 'vb:email-draft:', 'vb:'];
app.get('/make-server-93a20b6f/kv/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const value = await kv.get(key);
    return c.json({ key, value: value !== null && value !== undefined ? JSON.stringify(value) : null });
  } catch (e: any) {
    console.log('KV get error:', e);
    return c.json({ error: e.message }, 500);
  }
});
app.post('/make-server-93a20b6f/kv', async (c) => {
  try {
    const { key, value } = await c.req.json();
    if (!key) return c.json({ error: 'Missing key' }, 400);
    await kv.set(key, JSON.parse(value));
    return c.json({ success: true });
  } catch (e: any) {
    console.log('KV set error:', e);
    return c.json({ error: e.message }, 500);
  }
});

/**
 * Normalizace pathname pro Supabase Edge:
 * 1) Odstranění `/functions/v1` z cesty (plná URL z gateway).
 * 2) Pokud zbývá např. jen `/admin/…` nebo `/public/…` bez segmentu s názvem funkce,
 *    doplníme `/make-server-93a20b6f` — jinak Hono vrací text „404 Not Found“.
 */
Deno.serve((incoming) => {
  const url = new URL(incoming.url);
  let p = url.pathname;
  const v1 = '/functions/v1';
  if (p === v1 || p.startsWith(v1 + '/')) {
    p = p.slice(v1.length) || '/';
  }
  const fn = 'make-server-93a20b6f';
  const fnRoot = `/${fn}`;
  if (
    p !== fnRoot &&
    !p.startsWith(`${fnRoot}/`) &&
    (p.startsWith('/admin/') || p.startsWith('/public/'))
  ) {
    p = `${fnRoot}${p}`;
  }
  /** Edge někdy doručí jen `/webinar-survey-submit` bez `/make-server-93a20b6f`. */
  if (p === '/webinar-survey-submit' || p.startsWith('/webinar-survey-submit?')) {
    p = `${fnRoot}/webinar-survey-submit${p.slice('/webinar-survey-submit'.length)}`;
  }
  if (p === '/webinar-survey-partial' || p.startsWith('/webinar-survey-partial?')) {
    p = `${fnRoot}/webinar-survey-partial${p.slice('/webinar-survey-partial'.length)}`;
  }
  url.pathname = p;
  return app.fetch(new Request(url.toString(), incoming));
});