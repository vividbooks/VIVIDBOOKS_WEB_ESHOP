/**
 * Vercel Routing Middleware — náhled odkazu (OG / Twitter) pro produkt, který vznikl
 * po posledním buildu a nemá tedy předrenderované HTML ze scripts/prerender-seo.mjs.
 *
 * Má-li produkt statické /produkt/:slug/index.html, nic neděláme. Jinak vezmeme
 * neutrální SPA shell (spa.html) a dosadíme do něj title, popis a obrázek z živého katalogu.
 * Slug musí sedět s assignProductSlugs v prerender-seo.mjs (a src/utils/slugify.ts).
 */
export const config = { matcher: '/produkt/:slug' };

const PROJECT_ID = 'iekkundgizzdbmkzatdl';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJla2t1bmRnaXp6ZGJta3phdGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjYwMDIsImV4cCI6MjA4OTUwMjAwMn0.PsD7gEnhCushlJwnCkFIwfrGLws0KFa0QsCb54_6WHk';
const PRODUCTS_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-93a20b6f/products`;
const SITE_URL = 'https://www.vividbooks.com';
const SITE_NAME = 'Vividbooks';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const CATALOG_TTL_MS = 5 * 60 * 1000;

let catalogCache = null;

function slugifyText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

function productsBySlug(products) {
  const byBase = new Map();
  for (const product of products) {
    const base = productBaseSlug(product);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(product);
  }
  const bySlug = new Map();
  for (const [base, group] of byBase) {
    group.sort((a, b) => productIdentity(a).localeCompare(productIdentity(b), 'cs'));
    group.forEach((product, idx) => bySlug.set(idx <= 0 ? base : `${base}-${idx + 1}`, product));
  }
  return bySlug;
}

async function loadCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.bySlug;
  const res = await fetch(PRODUCTS_URL, {
    headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const products = Array.isArray(data?.products) ? data.products : [];
  catalogCache = { at: Date.now(), bySlug: productsBySlug(products) };
  return catalogCache.bySlug;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainText(value, maxLen) {
  const t = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

export function applyProductMeta(shell, product, pathname) {
  const name = String(product.name || product.title || '').trim() || SITE_NAME;
  const title = `${name} | ${SITE_NAME}`;
  const description =
    plainText(product.description, 300) ||
    `${name} — produkt Vividbooks pro základní školy. Pracovní sešity a digitální učebnice.`;
  const image = String(product.image || '').trim() || DEFAULT_OG_IMAGE;
  const canonical = `${SITE_URL}${pathname}`;
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const alt = escapeAttr(`${name} — ${SITE_NAME}`);

  const head = `
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:image:alt" content="${alt}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="cs_CZ" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    <meta name="twitter:image:alt" content="${alt}" />
`;

  return shell
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*\bname=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${d}" />`)
    .replace(/<\/head>/i, `${head}  </head>`);
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const slug = decodeURIComponent(url.pathname.slice('/produkt/'.length)).replace(/\/+$/, '');
    if (!slug || slug.includes('/')) return;

    // Předrenderovaná stránka z buildu má přednost (nese i JSON-LD a tělo pro crawlery).
    const prerendered = await fetch(new URL(`/produkt/${encodeURIComponent(slug)}/index.html`, url));
    if (prerendered.ok) return;

    const catalog = await loadCatalog();
    const product = catalog?.get(slug);
    if (!product) return;

    const shellRes = await fetch(new URL('/spa.html', url));
    if (!shellRes.ok) return;
    const html = applyProductMeta(await shellRes.text(), product, `/produkt/${slug}`);
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=300',
      },
    });
  } catch {
    // Při jakékoli chybě necháme Vercel servírovat obvyklý SPA shell.
  }
}
