/**
 * Post-build SEO prerender pro AI / retrieval crawlers i link preview (Slack, iMessage, …).
 * Vezme Vite shell (build/index.html nebo docs/) a pro každou stránku
 * zapíše HTML s title, canonical, OG, JSON-LD a sémantickým tělem.
 *
 * Zdroje:
 * - curated SEO_PAGES
 * - blog / novinky / webinář ze sitemap (lokální + živá Edge sitemap)
 * - **všechny produkty z katalogu API** (ne jen zastaralý public/sitemap.xml)
 * - homepage OG z prvního aktivního hero slideru (`/public/hero-slidy`)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_OG_IMAGE,
  NAV_LINKS,
  ORGANIZATION_JSON_LD,
  SEO_PAGES,
  SITE_NAME,
  SITE_URL,
} from './seo-pages.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = process.env.DOCS_BUILD === '1' ? path.join(root, 'docs') : path.join(root, 'build');

/** Prefixy ze sitemap, které prerenderujeme (kromě ručního katalogu SEO_PAGES). */
const SITEMAP_PREFIXES = ['/blog/', '/novinky/', '/produkt/', '/webinar/', '/webinare/zaznam/', '/balicek/'];

/** Drž v souladu s src/utils/supabase/info.tsx — veřejný anon klíč pro načtení katalogu při buildu. */
const PROJECT_ID = 'iekkundgizzdbmkzatdl';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJla2t1bmRnaXp6ZGJta3phdGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjYwMDIsImV4cCI6MjA4OTUwMjAwMn0.PsD7gEnhCushlJwnCkFIwfrGLws0KFa0QsCb54_6WHk';
const EDGE_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-93a20b6f`;
const PRODUCTS_URL = `${EDGE_BASE}/products`;
const HERO_SLIDES_URL = `${EDGE_BASE}/public/hero-slidy`;
const LIVE_SITEMAP_URL = `${EDGE_BASE}/sitemap.xml`;
const WEBINARS_URL = `${EDGE_BASE}/webinare`;
const BLOG_URL = `${EDGE_BASE}/admin/blog`;
const NOVINKY_URL = `${EDGE_BASE}/admin/novinky`;
const DVPP_VIDEOS_URL = `${EDGE_BASE}/dvpp-videos`;
const BUNDLES_URL = `${EDGE_BASE}/product-bundles`;

function authHeaders() {
  return { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function fullTitle(page) {
  if (page.path === '/') return page.title;
  if (page.title.includes(SITE_NAME)) return page.title;
  return `${page.title} | ${SITE_NAME}`;
}

function canonicalUrl(pagePath) {
  if (pagePath === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${pagePath}`;
}

function ogTypeFor(page) {
  if (page.ogType) return page.ogType;
  if (String(page.path || '').startsWith('/produkt/')) return 'product';
  return 'website';
}

function buildHeadInjection(page) {
  const title = fullTitle(page);
  const description = page.description;
  const canonical = canonicalUrl(page.path);
  const image = page.image || DEFAULT_OG_IMAGE;
  const imageAlt = page.imageAlt || `${page.h1} — ${SITE_NAME}`;
  const ogType = ogTypeFor(page);

  const allJsonLd = [ORGANIZATION_JSON_LD, ...(page.jsonLd || [])];

  const jsonLdScripts = allJsonLd
    .map(
      (ld) =>
        `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ');

  return `
    <!-- SEO prerender (build-time) -->
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:image:alt" content="${escapeAttr(imageAlt)}" />
    <meta property="og:type" content="${escapeAttr(ogType)}" />
    <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
    <meta property="og:locale" content="cs_CZ" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    <meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}" />
    ${jsonLdScripts}
    <!-- /SEO prerender -->
`;
}

/** Odstraní staré canonical / OG / Twitter tagy ze shellu, ať crawler nebere první (obecné) meta. */
function stripShareMeta(html) {
  return html
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*\bname=["']twitter:[^"']+["'][^>]*>\s*/gi, '');
}

function plainText(value, maxLen = 300) {
  const t = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

function buildBodyHtml(page) {
  const nav = NAV_LINKS.map(
    (link) => `<a href="${escapeAttr(link.href)}">${escapeHtml(link.label)}</a>`,
  ).join(' · ');

  const h2 = page.h2
    ? `<h2>${escapeHtml(page.h2)}</h2>`
    : '';

  return `<main id="seo-prerender">
  <nav aria-label="Hlavní navigace">${nav}</nav>
  <article>
    <h1>${escapeHtml(page.h1)}</h1>
    ${h2}
    <p data-answer-capsule="true">${escapeHtml(page.answer)}</p>
    <p>${escapeHtml(page.description)}</p>
    <section>
      <h2>Další stránky</h2>
      <ul>
        ${NAV_LINKS.map(
          (link) =>
            `<li><a href="${escapeAttr(link.href)}">${escapeHtml(link.label)}</a></li>`,
        ).join('\n        ')}
      </ul>
    </section>
  </article>
</main>`;
}

function applyPageToTemplate(template, page) {
  const title = fullTitle(page);
  const description = page.description;
  const headInjection = buildHeadInjection(page);
  const bodyHtml = buildBodyHtml(page);

  let html = template;

  // Remove previous prerender head block if re-running
  html = html.replace(/\n?\s*<!-- SEO prerender \(build-time\) -->[\s\S]*?<!-- \/SEO prerender -->\n?/g, '\n');
  // Shell / starší build může mít obecné OG — pryč, ať zůstane jen per-URL sada.
  html = stripShareMeta(html);

  // Title
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  } else {
    html = html.replace(/<\/head>/i, `    <title>${escapeHtml(title)}</title>\n  </head>`);
  }

  // Meta description
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${escapeAttr(description)}" />`,
    );
  } else {
    html = html.replace(
      /<\/head>/i,
      `    <meta name="description" content="${escapeAttr(description)}" />\n  </head>`,
    );
  }

  // Inject SEO head before </head>
  html = html.replace(/<\/head>/i, `${headInjection}  </head>`);

  // Inject crawlable body into #root
  if (/<div id="root">[\s\S]*?<\/div>/i.test(html)) {
    html = html.replace(
      /<div id="root">[\s\S]*?<\/div>/i,
      `<div id="root">${bodyHtml}</div>`,
    );
  } else if (/<div id="root"><\/div>/i.test(html)) {
    html = html.replace(
      /<div id="root"><\/div>/i,
      `<div id="root">${bodyHtml}</div>`,
    );
  } else {
    throw new Error('Template missing <div id="root">…</div>');
  }

  return html;
}

function outputPathFor(pagePath) {
  if (pagePath === '/') return path.join(outDir, 'index.html');
  const segments = pagePath.replace(/^\//, '').split('/').filter(Boolean);
  return path.join(outDir, ...segments, 'index.html');
}

function slugToTitle(slug) {
  const cleaned = decodeURIComponent(slug)
    .replace(/----+/g, ' — ')
    .replace(/---/g, ' — ')
    .replace(/--/g, ' – ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Vividbooks';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Stejná logika jako src/utils/slugify.ts — kvůli párování /produkt/:slug s katalogem. */
function slugifyText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function productBaseSlug(product) {
  const fromName = slugifyText(String(product?.name ?? product?.title ?? '').trim());
  if (fromName) return fromName;
  return slugifyText(String(product?.id ?? '').trim()) || 'produkt';
}

function productIdentity(product) {
  return String(product?.id ?? product?.name ?? product?.title ?? '').trim();
}

function assignProductSlugs(products) {
  const byBase = new Map();
  for (const product of products) {
    const base = productBaseSlug(product);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(product);
  }
  const slugById = new Map();
  for (const [, group] of byBase) {
    group.sort((a, b) => productIdentity(a).localeCompare(productIdentity(b), 'cs'));
    group.forEach((product, idx) => {
      const base = productBaseSlug(product);
      const slug = idx <= 0 ? base : `${base}-${idx + 1}`;
      slugById.set(productIdentity(product), slug);
    });
  }
  return slugById;
}

function parsePriceTextToKc(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (/zdarma/i.test(text)) return 0;
  const compact = text.replace(/\s/g, '');
  if (/^[^\d]*$/.test(compact)) return null;
  const normalized = compact
    .replace(/Kč/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function parseMerchVariantPriceToKc(variant) {
  const fromText = parsePriceTextToKc(variant?.price);
  if (fromText !== null) return fromText;
  if (typeof variant?.priceAmount === 'number' && Number.isFinite(variant.priceAmount)) {
    return Math.max(0, variant.priceAmount);
  }
  return null;
}

/** Stejná pravidla jako src/utils/productPrice.ts `getProductOfferPriceKc`. */
function parseProductPriceKc(product) {
  const fromText = parsePriceTextToKc(product?.price);
  if (fromText !== null) return fromText;

  const merch = product?.merchVariants;
  if (Array.isArray(merch)) {
    for (const variant of merch) {
      const variantKc = parseMerchVariantPriceToKc(variant);
      if (variantKc !== null) return variantKc;
    }
  }

  const priceText = String(product?.price ?? '').trim();
  if (priceText) return null;

  if (typeof product?.priceAmount === 'number' && Number.isFinite(product.priceAmount)) {
    return Math.max(0, product.priceAmount);
  }
  return null;
}

function formatOfferPrice(priceKc) {
  if (!Number.isFinite(priceKc)) return null;
  // Google chce holé desetinné číslo jako string (bez měny a oddělovačů tisíců).
  return Number.isInteger(priceKc) ? String(priceKc) : priceKc.toFixed(2);
}

async function fetchProductsCatalog() {
  try {
    const res = await fetch(PRODUCTS_URL, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      console.warn(`[prerender-seo] products fetch failed: HTTP ${res.status}`);
      return { bySlug: new Map(), count: 0 };
    }
    const data = await res.json();
    const products = Array.isArray(data?.products) ? data.products : [];
    const slugById = assignProductSlugs(products);
    const bySlug = new Map();
    for (const product of products) {
      const slug = slugById.get(productIdentity(product));
      if (slug) bySlug.set(slug, product);
    }
    return { bySlug, count: products.length };
  } catch (err) {
    console.warn(`[prerender-seo] products fetch error: ${err?.message || err}`);
    return { bySlug: new Map(), count: 0 };
  }
}

/** OG obrázek musí být absolutní URL — relativní cesty Slack ani Facebook nenačtou. */
function absoluteImageUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${SITE_URL}${value}`;
  return null;
}

/**
 * Obsahové kolekce pro OG náhledy (webináře, blog, novinky, záznamy, balíčky).
 * Bez nich by `page.image` zůstalo prázdné a `buildHeadInjection` by spadlo na DEFAULT_OG_IMAGE.
 */
async function fetchCollection(url, pick, label) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      console.warn(`[prerender-seo] ${label} fetch failed: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items = pick(data);
    return Array.isArray(items) ? items.filter(Boolean) : [];
  } catch (err) {
    console.warn(`[prerender-seo] ${label} fetch error: ${err?.message || err}`);
    return [];
  }
}

/**
 * Mapa pro vyhledání podle libovolného klíče (slug i id — obojí je platná URL),
 * plus `canonical` = jen jeden klíč na položku, aby se stránka nezapsala dvakrát.
 */
function indexBy(items, keys) {
  const map = new Map();
  const canonical = [];
  for (const item of items) {
    let first = null;
    for (const key of keys) {
      const value = String(item?.[key] ?? '').trim();
      if (!value) continue;
      if (!first) first = value;
      if (!map.has(value)) map.set(value, item);
    }
    if (first) canonical.push(first);
  }
  return { map, canonical: [...new Set(canonical)] };
}

async function fetchContentCatalogs() {
  const [webinars, blog, novinky, dvpp, bundles] = await Promise.all([
    fetchCollection(WEBINARS_URL, (d) => d?.items, 'webinare'),
    fetchCollection(BLOG_URL, (d) => d?.items, 'blog'),
    fetchCollection(NOVINKY_URL, (d) => d?.items, 'novinky'),
    fetchCollection(DVPP_VIDEOS_URL, (d) => d?.videos, 'dvpp-videos'),
    fetchCollection(BUNDLES_URL, (d) => d?.bundles, 'product-bundles'),
  ]);

  // Koncepty nemají veřejnou stránku — prerenderovat je znamená nabídnout crawlerům 404.
  const webinarIdx = indexBy(webinars, ['slug', 'id']);
  const blogIdx = indexBy(blog.filter((p) => p?.published !== false), ['slug', 'id']);
  const novinkyIdx = indexBy(novinky.filter((p) => p?.published !== false), ['slug', 'id']);
  const dvppIdx = indexBy(dvpp, ['id']);
  const bundlesIdx = indexBy(bundles.filter((b) => b?.isActive !== false), ['id']);

  return {
    webinarsBySlug: webinarIdx.map,
    blogBySlug: blogIdx.map,
    novinkyBySlug: novinkyIdx.map,
    dvppById: dvppIdx.map,
    bundlesById: bundlesIdx.map,
    canonical: {
      '/webinar/': webinarIdx.canonical,
      '/blog/': blogIdx.canonical,
      '/novinky/': novinkyIdx.canonical,
      '/webinare/zaznam/': dvppIdx.canonical,
      '/balicek/': bundlesIdx.canonical,
    },
    counts: {
      webinare: webinars.length,
      blog: blogIdx.canonical.length,
      novinky: novinkyIdx.canonical.length,
      zaznamy: dvpp.length,
      balicky: bundlesIdx.canonical.length,
    },
  };
}

/** První aktivní hero slide (CMS) — OG náhled homepage. */
async function fetchHomepageHeroOg() {
  try {
    const res = await fetch(HERO_SLIDES_URL, { headers: authHeaders() });
    if (!res.ok) {
      console.warn(`[prerender-seo] hero-slidy fetch failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const active = items
      .filter((s) => s && s.isActive !== false && s.hidden !== true)
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
    const slide = active[0];
    if (!slide) return null;

    const title = plainText(slide.title || '', 110).replace(/\s*·\s*/g, ' — ') || SITE_NAME;
    const subtitle = plainText(slide.subtitle || slide.bottom || '', 200);
    const image = String(slide.image || slide.coverImage || slide.bgImage || '').trim();
    const absoluteImage =
      !image
        ? null
        : /^https?:\/\//i.test(image)
          ? image
          : image.startsWith('/')
            ? `${SITE_URL}${image}`
            : null;

    return {
      title: title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`,
      description:
        subtitle ||
        'Digitální učebnice a pracovní sešity Vividbooks pro české základní školy.',
      h1: title.replace(/\s*\|\s*Vividbooks\s*$/i, '').trim() || title,
      answer: subtitle
        ? `${title}. ${subtitle}`
        : `${title}. Aktuální novinka na homepage Vividbooks.`,
      ...(absoluteImage
        ? { image: absoluteImage, imageAlt: `${title} — ${SITE_NAME}` }
        : {}),
    };
  } catch (err) {
    console.warn(`[prerender-seo] hero-slidy error: ${err?.message || err}`);
    return null;
  }
}

/** Stáhne živou Edge sitemap (obsahuje aktuální produkty) do outDir. */
async function syncLiveSitemap() {
  try {
    const res = await fetch(LIVE_SITEMAP_URL, { headers: authHeaders() });
    if (!res.ok) {
      console.warn(`[prerender-seo] live sitemap fetch failed: HTTP ${res.status}`);
      return false;
    }
    const xml = await res.text();
    if (!xml.includes('<urlset')) {
      console.warn('[prerender-seo] live sitemap: unexpected body');
      return false;
    }
    writeFileSync(path.join(outDir, 'sitemap.xml'), xml, 'utf8');
    // Drž public/sitemap.xml v syncu pro další lokální běhy (best-effort).
    try {
      writeFileSync(path.join(root, 'public', 'sitemap.xml'), xml, 'utf8');
    } catch {
      /* ignore */
    }
    console.log('[prerender-seo] Synced sitemap.xml from Edge API');
    return true;
  } catch (err) {
    console.warn(`[prerender-seo] live sitemap error: ${err?.message || err}`);
    return false;
  }
}

/** Posun Prahy vůči UTC v daný okamžik (`+02:00` v létě, `+01:00` v zimě) — kvůli Event JSON-LD. */
function pragueUtcOffset(utcMillis) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(utcMillis));
  const name = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+01:00';
  const match = name.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : '+01:00';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** `2026-09-30T18:00:00+02:00` z polí webináře (day/monthNum/year/time), jinak null. */
function webinarStartDateIso(webinar, addMinutes = 0) {
  const year = Number(webinar?.year);
  const month = Number(webinar?.monthNum);
  const day = Number(webinar?.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const [rawHour, rawMinute] = String(webinar?.time || '').split(':');
  const hour = Number.isFinite(Number(rawHour)) ? Number(rawHour) : 0;
  const minute = Number.isFinite(Number(rawMinute)) ? Number(rawMinute) : 0;

  const utc = Date.UTC(year, month - 1, day, hour, minute) + addMinutes * 60_000;
  const shifted = new Date(utc);
  return (
    `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}` +
    `T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:00${pragueUtcOffset(utc)}`
  );
}

function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

/** Odvozený SEO záznam ze slug path (blog / novinky / produkt / webinář / záznam / balíček). */
function pageFromSitemapPath(pathname, catalogs = {}) {
  const {
    productsBySlug = new Map(),
    webinarsBySlug = new Map(),
    blogBySlug = new Map(),
    novinkyBySlug = new Map(),
    dvppById = new Map(),
    bundlesById = new Map(),
  } = catalogs;

  if (pathname.startsWith('/blog/')) {
    const slug = decodeURIComponent(pathname.slice('/blog/'.length));
    const post = blogBySlug.get(slug) || null;
    const title = String(post?.title || '').trim() || slugToTitle(slug);
    const description =
      plainText(post?.excerpt || post?.contentHtml || '', 300) ||
      `${title} — článek na blogu Vividbooks o moderním vzdělávání a digitálních učebnicích.`;
    const image = absoluteImageUrl(post?.coverImage);
    const author = String(post?.author || '').trim();

    return {
      path: pathname,
      title,
      description,
      h1: title,
      h2: String(post?.category || '').trim() || 'Blog Vividbooks',
      answer: `${title}. ${description}`.slice(0, 400),
      ...(image ? { image, imageAlt: `${title} — ${SITE_NAME}` } : {}),
      ogType: 'article',
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Blog', url: '/blog' },
          { name: title, url: pathname },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description: description.slice(0, 500),
          ...(image ? { image } : {}),
          author: {
            '@type': author ? 'Person' : 'Organization',
            name: author || SITE_NAME,
          },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.svg` },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${pathname}` },
        },
      ],
    };
  }

  if (pathname.startsWith('/novinky/')) {
    const slug = decodeURIComponent(pathname.slice('/novinky/'.length));
    const post = novinkyBySlug.get(slug) || null;
    const title = String(post?.title || '').trim() || slugToTitle(slug);
    const description =
      plainText(post?.excerpt || post?.contentHtml || '', 300) ||
      `${title} — novinka z Vividbooks o produktech a digitálních učebnicích.`;
    const image = absoluteImageUrl(post?.coverImage);

    return {
      path: pathname,
      title,
      description,
      h1: title,
      h2: String(post?.category || '').trim() || 'Novinky Vividbooks',
      answer: `${title}. ${description}`.slice(0, 400),
      ...(image ? { image, imageAlt: `${title} — ${SITE_NAME}` } : {}),
      ogType: 'article',
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Novinky', url: '/novinky' },
          { name: title, url: pathname },
        ]),
      ],
    };
  }

  if (pathname.startsWith('/produkt/')) {
    const slug = decodeURIComponent(pathname.slice('/produkt/'.length));
    const catalogProduct = productsBySlug.get(slug) || null;
    const title = String(catalogProduct?.name || '').trim() || slugToTitle(slug);
    const rawDescription = String(catalogProduct?.description || '').trim();
    const description =
      rawDescription ||
      `${title} — produkt Vividbooks pro základní školy. Pracovní sešity a digitální učebnice.`;
    const image = String(catalogProduct?.image || '').trim() || undefined;
    const priceKc = catalogProduct ? parseProductPriceKc(catalogProduct) : null;
    const price = priceKc === null ? null : formatOfferPrice(priceKc);
    const category = String(catalogProduct?.category || '').trim();

    const jsonLd = [
      breadcrumbJsonLd([
        { name: 'Katalog', url: '/' },
        ...(category
          ? [{
              name: category,
              url: `/predmet/${slugifyText(category)}`,
            }]
          : []),
        { name: title, url: pathname },
      ]),
    ];

    // Product snippet vyžaduje validní offers.price — bez ceny schema nevypisujeme.
    // Merchant listings doporučují i offers.validFrom (spolu s priceValidUntil).
    if (price !== null) {
      const validFrom = new Date().toISOString().slice(0, 10);
      const priceValidUntil = new Date();
      priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: title,
        description: description.slice(0, 5000),
        ...(image ? { image } : {}),
        ...(category ? { category } : {}),
        brand: { '@type': 'Brand', name: SITE_NAME },
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}${pathname}`,
          price,
          priceCurrency: 'CZK',
          validFrom,
          priceValidUntil: priceValidUntil.toISOString().slice(0, 10),
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: SITE_NAME },
        },
      });
    }

    return {
      path: pathname,
      title,
      description: description.slice(0, 300),
      h1: title,
      h2: category || 'Produkt Vividbooks',
      answer: `${title} je produkt Vividbooks pro české základní školy. Součást nabídky pracovních sešitů a digitálních učebnic s online podporou.`,
      ...(image ? { image, imageAlt: `${title} — ${SITE_NAME}` } : {}),
      jsonLd,
    };
  }

  if (pathname.startsWith('/webinare/zaznam/')) {
    const id = decodeURIComponent(pathname.slice('/webinare/zaznam/'.length)).split('/')[0];
    if (!id) return null;
    const video = dvppById.get(id) || null;
    const name = String(video?.name || '').trim() || slugToTitle(id);
    const title = `Záznam webináře: ${name}`;
    const description =
      plainText(video?.description || '', 300) ||
      `Záznam webináře ${name} — DVPP video Vividbooks zdarma pro učitele, včetně certifikátu o absolvování.`;
    const image = absoluteImageUrl(video?.thumbnail);

    return {
      path: pathname,
      title,
      description,
      h1: title,
      h2: 'Záznam DVPP webináře',
      answer: `${name} — záznam webináře Vividbooks. ${description}`.slice(0, 400),
      ...(image ? { image, imageAlt: `${name} — ${SITE_NAME}` } : {}),
      ogType: 'video.other',
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Webináře', url: '/webinare' },
          { name: title, url: pathname },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name,
          description: description.slice(0, 500),
          ...(image ? { thumbnailUrl: image } : {}),
          ...(video?.youtubeUrl ? { embedUrl: String(video.youtubeUrl) } : {}),
          publisher: { '@type': 'Organization', name: SITE_NAME },
        },
      ],
    };
  }

  if (pathname.startsWith('/balicek/')) {
    const id = decodeURIComponent(pathname.slice('/balicek/'.length)).split('/')[0];
    if (!id) return null;
    const bundle = bundlesById.get(id) || null;
    const title = String(bundle?.title || '').trim() || slugToTitle(id);
    const description =
      plainText(bundle?.description || '', 300) ||
      `${title} — zvýhodněný balíček pracovních sešitů Vividbooks pro základní školy.`;

    return {
      path: pathname,
      title,
      description,
      h1: title,
      h2: 'Balíček Vividbooks',
      answer: `${title}. ${description}`.slice(0, 400),
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Katalog', url: '/katalog' },
          { name: title, url: pathname },
        ]),
      ],
    };
  }

  if (pathname.startsWith('/webinar/')) {
    const rest = pathname.slice('/webinar/'.length);
    // Jen detail /webinar/:id — ne /live, /dotaznik ani /dvpp-dotaznik.
    const parts = rest.split('/').filter(Boolean);
    if (parts.length !== 1) return null;
    const id = decodeURIComponent(parts[0]);

    const webinar = webinarsBySlug.get(id) || null;
    const title = String(webinar?.title || '').trim() || `Webinář ${slugToTitle(id)}`;
    const image = absoluteImageUrl(webinar?.coverImage);
    const audience = String(webinar?.targetAudience || '').trim();
    const dateLabel =
      webinar?.day && webinar?.monthName && webinar?.year
        ? `${webinar.day}. ${String(webinar.monthName).toLowerCase()} ${webinar.year}${webinar.time ? ` v ${webinar.time}` : ''}`
        : '';

    const bodyText = plainText(webinar?.description || '', 220);
    const description =
      [
        dateLabel ? `DVPP webinář zdarma ${dateLabel}.` : '',
        audience ? `${audience}.` : '',
        bodyText,
      ]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      `${title} — DVPP webinář Vividbooks pro učitele. Interaktivní výuka a digitální učebnice.`;

    const jsonLd = [
      breadcrumbJsonLd([
        { name: 'Webináře', url: '/webinare' },
        { name: title, url: pathname },
      ]),
    ];

    // Event snippet dává smysl jen s reálným datem — u neznámého webináře ho vynecháme.
    const startDate = webinarStartDateIso(webinar);
    if (startDate) {
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: title,
        description: description.slice(0, 500),
        startDate,
        ...(Number(webinar?.durationMinutes) > 0
          ? { endDate: webinarStartDateIso(webinar, Number(webinar.durationMinutes)) }
          : {}),
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: { '@type': 'VirtualLocation', url: `${SITE_URL}${pathname}` },
        ...(image ? { image } : {}),
        organizer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'CZK',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}${pathname}`,
        },
      });
    }

    return {
      path: pathname,
      title,
      description: description.slice(0, 300),
      h1: title,
      h2: audience || 'DVPP webinář Vividbooks',
      answer: `${title}. ${description}`.slice(0, 400),
      ...(image ? { image, imageAlt: `${title} — ${SITE_NAME}` } : {}),
      jsonLd,
    };
  }

  return null;
}

function loadSitemapPaths() {
  const candidates = [
    path.join(outDir, 'sitemap.xml'),
    path.join(root, 'public', 'sitemap.xml'),
  ];
  const sitemapPath = candidates.find((p) => existsSync(p));
  if (!sitemapPath) {
    console.warn('[prerender-seo] sitemap.xml not found — skipping dynamic pages');
    return [];
  }

  const xml = readFileSync(sitemapPath, 'utf8');
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
  const paths = [];

  for (const loc of locs) {
    let pathname;
    try {
      pathname = new URL(loc).pathname.replace(/\/+$/, '') || '/';
    } catch {
      continue;
    }
    if (!SITEMAP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) continue;
    // jen přímé detaily webinářů (/webinar/:id), ne /live /dotaznik
    if (pathname.startsWith('/webinar/')) {
      const parts = pathname.slice('/webinar/'.length).split('/').filter(Boolean);
      if (parts.length !== 1) continue;
    }
    paths.push(pathname);
  }

  return [...new Set(paths)];
}

async function collectPages(catalogs, homepageHeroOg = null) {
  const { productsBySlug } = catalogs;
  const byPath = new Map();
  for (const page of SEO_PAGES) {
    byPath.set(page.path, { ...page });
  }

  // Homepage: OG z prvního hero slideru (aktuální kampaň), ne obecný og-image.png.
  if (homepageHeroOg && byPath.has('/')) {
    const home = byPath.get('/');
    byPath.set('/', {
      ...home,
      title: homepageHeroOg.title || home.title,
      description: homepageHeroOg.description || home.description,
      h1: homepageHeroOg.h1 || home.h1,
      answer: homepageHeroOg.answer || home.answer,
      ...(homepageHeroOg.image
        ? { image: homepageHeroOg.image, imageAlt: homepageHeroOg.imageAlt }
        : {}),
    });
  }

  let fromSitemap = 0;
  for (const pathname of loadSitemapPaths()) {
    if (byPath.has(pathname)) continue;
    const page = pageFromSitemapPath(pathname, catalogs);
    if (!page) continue;
    byPath.set(pathname, page);
    fromSitemap += 1;
  }

  /*
   * Obsah vždy z živých kolekcí — sitemap zaostává za novými produkty, webináři
   * i články, a právě ty se sdílejí nejčastěji. Klíč mapy je slug/id, ne celá cesta,
   * takže tady se z něj skládá URL.
   */
  let fromCatalog = 0;
  const catalogRoutes = [
    ['/produkt/', [...productsBySlug.keys()]],
    ...Object.entries(catalogs.canonical || {}),
  ];

  for (const [prefix, keys] of catalogRoutes) {
    for (const key of keys || []) {
      const pathname = `${prefix}${key}`;
      const page = pageFromSitemapPath(pathname, catalogs);
      if (!page) continue;
      if (!byPath.has(pathname)) fromCatalog += 1;
      byPath.set(pathname, page);
    }
  }

  return { pages: [...byPath.values()], fromSitemap, fromCatalog };
}

async function main() {
  const templatePath = path.join(outDir, 'index.html');
  if (!existsSync(templatePath)) {
    console.error(`[prerender-seo] Missing ${templatePath}. Run vite build first.`);
    process.exit(1);
  }

  // Vite už mohl zapsat homepage — čteme shell před přepsáním curated home stránkou.
  // Pokud už obsahuje seo-prerender (re-run), odebereme body a head SEO blok.
  let template = readFileSync(templatePath, 'utf8');
  template = template.replace(/\n?\s*<!-- SEO prerender \(build-time\) -->[\s\S]*?<!-- \/SEO prerender -->\n?/g, '\n');
  template = template.replace(/<div id="root">[\s\S]*?<\/div>/i, '<div id="root"></div>');
  template = stripShareMeta(template);

  await syncLiveSitemap();

  const { bySlug: productsBySlug, count: productCount } = await fetchProductsCatalog();
  console.log(`[prerender-seo] Loaded ${productCount} products for Product OG + JSON-LD`);

  const contentCatalogs = await fetchContentCatalogs();
  const c = contentCatalogs.counts;
  console.log(
    `[prerender-seo] Loaded content for OG: ${c.webinare} webinářů, ${c.blog} článků, ` +
      `${c.novinky} novinek, ${c.zaznamy} záznamů, ${c.balicky} balíčků`,
  );

  const catalogs = { ...contentCatalogs, productsBySlug };

  const homepageHeroOg = await fetchHomepageHeroOg();
  if (homepageHeroOg?.image) {
    console.log(`[prerender-seo] Homepage OG from hero: ${homepageHeroOg.h1}`);
  } else {
    console.warn('[prerender-seo] Homepage hero OG unavailable — using curated defaults');
  }

  const { pages, fromSitemap, fromCatalog } = await collectPages(catalogs, homepageHeroOg);
  let written = 0;
  let productsWithPrice = 0;
  let withOwnImage = 0;

  for (const page of pages) {
    if (page.image) withOwnImage += 1;
    if (page.path.startsWith('/produkt/') && Array.isArray(page.jsonLd)) {
      if (page.jsonLd.some((ld) => ld?.['@type'] === 'Product' && ld?.offers?.price != null)) {
        productsWithPrice += 1;
      }
    }
    const html = applyPageToTemplate(template, page);
    const outPath = outputPathFor(page.path);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
    written += 1;
  }

  // SPA fallback: obecný brand OG (ne aktuální homepage kampaň).
  const fallbackHtml = applyPageToTemplate(template, {
    path: '/',
    title: `${SITE_NAME} – Učení, které inspiruje a baví.`,
    description:
      'Kompletní katalog interaktivních digitálních učebnic a pracovních sešitů Vividbooks pro české základní školy.',
    h1: SITE_NAME,
    h2: 'Digitální učebnice a pracovní sešity pro ZŠ',
    answer:
      'Vividbooks jsou učební materiály pro české základní školy: pracovní sešity a tiskoviny se smysluplně doplňují s online podporou.',
    image: DEFAULT_OG_IMAGE,
    imageAlt: `${SITE_NAME} — učení, které inspiruje a baví`,
  });
  writeFileSync(path.join(outDir, '404.html'), fallbackHtml, 'utf8');

  console.log(
    `[prerender-seo] Wrote ${written} pages (${SEO_PAGES.length} curated + ${fromSitemap} sitemap + ${fromCatalog} new from catalog; ` +
      `${productsWithPrice} products with price; ${withOwnImage}/${written} with own OG image) + 404.html → ${outDir}`,
  );
}

main().catch((err) => {
  console.error('[prerender-seo] Fatal:', err);
  process.exit(1);
});
