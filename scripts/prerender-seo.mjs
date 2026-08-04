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
function pageFromSitemapPath(pathname) {
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
    const slug = pathname.slice('/produkt/'.length);
    const title = slugToTitle(slug);
    return {
      path: pathname,
      title,
      description: `${title} — produkt Vividbooks pro základní školy. Pracovní sešity a digitální učebnice.`,
      h1: title,
      h2: 'Produkt Vividbooks',
      answer: `${title} je produkt Vividbooks pro české základní školy. Součást nabídky pracovních sešitů a digitálních učebnic s online podporou.`,
      jsonLd: [
        breadcrumbJsonLd([
          { name: 'Katalog', url: '/' },
          { name: title, url: pathname },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: title,
          description: `${title} — Vividbooks`,
          brand: { '@type': 'Organization', name: SITE_NAME },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'CZK',
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: SITE_NAME },
          },
        },
      ],
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

function collectPages() {
  const byPath = new Map();
  for (const page of SEO_PAGES) {
    byPath.set(page.path, page);
  }

  let fromSitemap = 0;
  for (const pathname of loadSitemapPaths()) {
    if (byPath.has(pathname)) continue;
    const page = pageFromSitemapPath(pathname);
    if (!page) continue;
    byPath.set(pathname, page);
    fromSitemap += 1;
  }

  return { pages: [...byPath.values()], fromSitemap };
}

function main() {
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

  const { pages, fromSitemap } = collectPages();
  let written = 0;

  for (const page of pages) {
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
    `[prerender-seo] Wrote ${written} pages (${SEO_PAGES.length} curated + ${fromSitemap} from sitemap) + 404.html → ${outDir}`,
  );
}

main();
