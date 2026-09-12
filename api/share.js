/**
 * Náhledy odkazů pro obsah, který při posledním buildu ještě neexistoval.
 *
 * Prerender (scripts/prerender-seo.mjs) pokrývá všechno, co bylo v CMS v době nasazení.
 * Webinář nebo článek založený po deployi ale žádný statický soubor nemá, takže Vercel
 * na jeho adresu pošle SPA shell — a s ním i OG tagy homepage. Slack pak u odkazu na
 * nový webinář ukáže aktuální hero slide z titulky.
 *
 * Tahle funkce dostane jen požadavky od náhledových robotů (podmínka na User-Agent
 * v `vercel.json`), takže pro lidi se nemění vůbec nic. Roboti JavaScript nespouštějí,
 * proto jim stačí malé HTML se správnými meta tagy.
 *
 * Statické soubory mají přednost před `rewrites`, takže prerenderované stránky sem
 * nikdy nedorazí — funkce řeší výhradně čerstvý obsah.
 */
export const config = { runtime: 'edge' };

const SITE_URL = 'https://www.vividbooks.com';
const SITE_NAME = 'Vividbooks';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

const PROJECT_ID = 'iekkundgizzdbmkzatdl';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJla2t1bmRnaXp6ZGJta3phdGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjYwMDIsImV4cCI6MjA4OTUwMjAwMn0.PsD7gEnhCushlJwnCkFIwfrGLws0KFa0QsCb54_6WHk';
const EDGE_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-93a20b6f`;

/** Cesta → odkud vzít data a jak z položky poskládat náhled. */
const ROUTES = [
  {
    prefix: '/webinare/zaznam/',
    url: `${EDGE_BASE}/dvpp-videos`,
    pick: (d) => d?.videos,
    keys: ['id'],
    render: (v) => ({
      title: `Záznam webináře: ${v.name}`,
      description:
        text(v.description) ||
        `Záznam webináře ${v.name} — DVPP video Vividbooks zdarma pro učitele, včetně certifikátu o absolvování.`,
      image: v.thumbnail,
      type: 'video.other',
    }),
  },
  {
    prefix: '/webinar/',
    url: `${EDGE_BASE}/webinare`,
    pick: (d) => d?.items,
    keys: ['slug', 'id'],
    render: (w) => {
      const date =
        w.day && w.monthName && w.year
          ? `DVPP webinář zdarma ${w.day}. ${String(w.monthName).toLowerCase()} ${w.year}${w.time ? ` v ${w.time}` : ''}.`
          : '';
      const audience = text(w.targetAudience);
      return {
        title: w.title,
        description:
          [date, audience ? `${audience}.` : '', text(w.description, 220)]
            .filter(Boolean)
            .join(' ') || `${w.title} — DVPP webinář Vividbooks pro učitele.`,
        image: w.coverImage,
      };
    },
  },
  {
    prefix: '/blog/',
    url: `${EDGE_BASE}/admin/blog`,
    pick: (d) => d?.items,
    keys: ['slug', 'id'],
    render: (p) => ({
      title: p.title,
      description:
        text(p.excerpt || p.contentHtml) ||
        `${p.title} — článek na blogu Vividbooks o moderním vzdělávání a digitálních učebnicích.`,
      image: p.coverImage,
      type: 'article',
    }),
  },
  {
    prefix: '/novinky/',
    url: `${EDGE_BASE}/admin/novinky`,
    pick: (d) => d?.items,
    keys: ['slug', 'id'],
    render: (p) => ({
      title: p.title,
      description:
        text(p.excerpt || p.contentHtml) ||
        `${p.title} — novinka z Vividbooks o produktech a digitálních učebnicích.`,
      image: p.coverImage,
      type: 'article',
    }),
  },
  {
    prefix: '/balicek/',
    url: `${EDGE_BASE}/product-bundles`,
    pick: (d) => d?.bundles,
    keys: ['id'],
    render: (b) => ({
      title: b.title,
      description:
        text(b.description) ||
        `${b.title} — zvýhodněný balíček pracovních sešitů Vividbooks pro základní školy.`,
    }),
  },
];

function text(value, maxLen = 300) {
  const t = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteImageUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${SITE_URL}${value}`;
  return null;
}

function findItem(items, keys, wanted) {
  for (const key of keys) {
    const hit = items.find((item) => String(item?.[key] ?? '').trim() === wanted);
    if (hit) return hit;
  }
  return null;
}

async function previewFor(pathname) {
  const route = ROUTES.find((r) => pathname.startsWith(r.prefix));
  if (!route) return null;

  const rest = pathname.slice(route.prefix.length).split('/').filter(Boolean);
  // Jen detail — /webinar/x/live a spol. mají vlastní stránku bez sdíleného náhledu.
  if (rest.length !== 1) return null;

  let wanted;
  try {
    wanted = decodeURIComponent(rest[0]);
  } catch {
    wanted = rest[0];
  }

  const res = await fetch(route.url, {
    headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
  });
  if (!res.ok) return null;

  const items = route.pick(await res.json());
  if (!Array.isArray(items)) return null;

  const item = findItem(items, route.keys, wanted);
  if (!item) return null;

  const preview = route.render(item);
  if (!preview?.title) return null;
  return preview;
}

function htmlFor(pathname, preview) {
  const canonical = `${SITE_URL}${pathname}`;
  const rawTitle = String(preview?.title || `${SITE_NAME} – Učení, které inspiruje a baví.`);
  const title = rawTitle.includes(SITE_NAME) ? rawTitle : `${rawTitle} | ${SITE_NAME}`;
  const description = String(
    preview?.description ||
      'Digitální učebnice a pracovní sešity Vividbooks pro české základní školy.',
  );
  const image = absoluteImageUrl(preview?.image) || DEFAULT_OG_IMAGE;
  const type = preview?.type || 'website';

  const e = escapeHtml;
  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <title>${e(title)}</title>
    <meta name="description" content="${e(description)}" />
    <link rel="canonical" href="${e(canonical)}" />
    <meta property="og:title" content="${e(title)}" />
    <meta property="og:description" content="${e(description)}" />
    <meta property="og:url" content="${e(canonical)}" />
    <meta property="og:image" content="${e(image)}" />
    <meta property="og:image:alt" content="${e(rawTitle)} — ${e(SITE_NAME)}" />
    <meta property="og:type" content="${e(type)}" />
    <meta property="og:site_name" content="${e(SITE_NAME)}" />
    <meta property="og:locale" content="cs_CZ" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${e(title)}" />
    <meta name="twitter:description" content="${e(description)}" />
    <meta name="twitter:image" content="${e(image)}" />
  </head>
  <body>
    <main>
      <h1>${e(rawTitle)}</h1>
      <p>${e(description)}</p>
      <p><a href="${e(canonical)}">${e(canonical)}</a></p>
    </main>
  </body>
</html>
`;
}

export default async function handler(request) {
  const pathname = new URL(request.url).searchParams.get('path') || '/';

  let preview = null;
  try {
    // Náhled nesmí selhat na chybě API — bez dat pošleme aspoň značkový fallback.
    preview = await previewFor(pathname);
  } catch {
    preview = null;
  }

  return new Response(htmlFor(pathname, preview), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Náhledy se sdílejí v dávkách — krátká cache ušetří opakované dotazy do CMS.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
