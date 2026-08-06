/**
 * Post-build SEO prerender pro AI / retrieval crawlers.
 * Vezme Vite shell (build/index.html nebo docs/) a pro každou stránku
 * z seo-pages.mjs + public/sitemap.xml zapíše HTML s title, canonical, OG, JSON-LD a sémantickým tělem.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const SITEMAP_PREFIXES = ['/blog/', '/novinky/', '/produkt/', '/webinar/'];

/** Drž v souladu s src/utils/supabase/info.tsx — veřejný anon klíč pro načtení katalogu při buildu. */
const PROJECT_ID = 'iekkundgizzdbmkzatdl';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJla2t1bmRnaXp6ZGJta3phdGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjYwMDIsImV4cCI6MjA4OTUwMjAwMn0.PsD7gEnhCushlJwnCkFIwfrGLws0KFa0QsCb54_6WHk';
const PRODUCTS_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-93a20b6f/products`;

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

function buildHeadInjection(page) {
  const title = fullTitle(page);
  const description = page.description;
  const canonical = canonicalUrl(page.path);
  const image = page.image || DEFAULT_OG_IMAGE;
  const imageAlt = page.imageAlt || `${page.h1} — ${SITE_NAME}`;

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
    <meta property="og:type" content="website" />
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

  // Remove previous prerender head block if re-running
  html = html.replace(/\n?\s*<!-- SEO prerender \(build-time\) -->[\s\S]*?<!-- \/SEO prerender -->\n?/g, '\n');

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

function parseProductPriceKc(product) {
  if (typeof product?.priceAmount === 'number' && Number.isFinite(product.priceAmount)) {
    return Math.max(0, product.priceAmount);
  }
  const text = String(product?.price ?? '').trim();
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

function formatOfferPrice(priceKc) {
  if (!Number.isFinite(priceKc)) return null;
  // Google chce holé desetinné číslo jako string (bez měny a oddělovačů tisíců).
  return Number.isInteger(priceKc) ? String(priceKc) : priceKc.toFixed(2);
}

async function fetchProductsCatalog() {
  try {
    const res = await fetch(PRODUCTS_URL, {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
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

/** Odvozený SEO záznam ze slug path (blog / novinky / produkt / webinar). */
function pageFromSitemapPath(pathname, productsBySlug = new Map()) {
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.slice('/blog/'.length);
    const title = slugToTitle(slug);
    return {
      path: pathname,
      title,
      description: `${title} — článek na blogu Vividbooks o moderním vzdělávání a digitálních učebnicích.`,
      h1: title,
      h2: 'Blog Vividbooks',
      answer: `${title}. Článek Vividbooks o vzdělávání, výuce a digitálních učebnicích pro české základní školy.`,
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Blog', url: '/blog' },
          { name: title, url: pathname },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description: `${title} — blog Vividbooks`,
          author: { '@type': 'Organization', name: SITE_NAME },
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
    const slug = pathname.slice('/novinky/'.length);
    const title = slugToTitle(slug);
    return {
      path: pathname,
      title,
      description: `${title} — novinka z Vividbooks o produktech a digitálních učebnicích.`,
      h1: title,
      h2: 'Novinky Vividbooks',
      answer: `${title}. Aktuální novinka z Vividbooks — informace o produktech, aktualizacích a dění ve firmě.`,
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
    if (price !== null) {
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

  if (pathname.startsWith('/webinar/')) {
    const rest = pathname.slice('/webinar/'.length);
    // /webinar/:id nebo /webinar/:id/live — bereme jen detail, ne /live /dotaznik
    const id = rest.split('/').filter(Boolean)[0];
    if (!id || rest.includes('/')) {
      // přeskoč nested jako /webinar/x/live pokud path má víc segmentů kromě id
      const parts = rest.split('/').filter(Boolean);
      if (parts.length !== 1) return null;
    }
    const title = `Webinář ${slugToTitle(id)}`;
    return {
      path: pathname,
      title,
      description: `${title} — DVPP webinář Vividbooks pro učitele. Interaktivní výuka a digitální učebnice.`,
      h1: title,
      h2: 'DVPP webinář Vividbooks',
      answer: `${title}. Webinář Vividbooks pro učitele — tipy k interaktivní výuce a digitálním učebnicím, často akreditované DVPP.`,
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Webináře', url: '/webinare' },
          { name: title, url: pathname },
        ]),
      ],
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

async function collectPages(productsBySlug) {
  const byPath = new Map();
  for (const page of SEO_PAGES) {
    byPath.set(page.path, page);
  }

  let fromSitemap = 0;
  for (const pathname of loadSitemapPaths()) {
    if (byPath.has(pathname)) continue;
    const page = pageFromSitemapPath(pathname, productsBySlug);
    if (!page) continue;
    byPath.set(pathname, page);
    fromSitemap += 1;
  }

  return { pages: [...byPath.values()], fromSitemap };
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

  const { bySlug: productsBySlug, count: productCount } = await fetchProductsCatalog();
  console.log(`[prerender-seo] Loaded ${productCount} products for Product JSON-LD prices`);

  const { pages, fromSitemap } = await collectPages(productsBySlug);
  let written = 0;
  let productsWithPrice = 0;

  for (const page of pages) {
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

  // SPA fallback for unknown routes on GitHub Pages
  const homePath = path.join(outDir, 'index.html');
  const fallbackPath = path.join(outDir, '404.html');
  copyFileSync(homePath, fallbackPath);

  console.log(
    `[prerender-seo] Wrote ${written} pages (${SEO_PAGES.length} curated + ${fromSitemap} from sitemap; ${productsWithPrice} products with price) + 404.html → ${outDir}`,
  );
}

main().catch((err) => {
  console.error('[prerender-seo] Fatal:', err);
  process.exit(1);
});
