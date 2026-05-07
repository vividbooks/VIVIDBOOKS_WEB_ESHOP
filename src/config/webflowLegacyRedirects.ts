/**
 * Mapování starých Webflow cest → nový marketing web (React Router).
 * Jedna pravda pro runtime přesměrování i pro migrační skript `npm run webflow-migration`.
 */
import { WEBFLOW_LEGACY_MANUAL_OVERRIDES } from './webflowLegacyManualOverrides';
import {
  ESHOP_PUBLIC_ORIGIN,
  LEGACY_APP_NEWS_TO_NOVINKA_SLUG,
  LEGACY_CS_BLOG_SLUG_MAP,
  LEGACY_SHORT_LINK_TARGETS,
} from './webflowLegacySlugMaps';

export type LegacyRedirectResolution =
  | { kind: 'none' }
  | { kind: 'internal'; target: string; ruleId: string }
  | { kind: 'external'; target: string; ruleId: string };

export const WEBFLOW_LEGACY_FALLBACK_INTERNAL = '/';

/** Přihlášení / otevření učebnic na aplikační doméně */
export function webflowLegacyAppOrigin(): string {
  const env = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_ORIGIN;
  if (typeof env === 'string' && env.trim()) return env.replace(/\/$/, '');
  return 'https://app.vividbooks.com';
}

type ExactRule = { ruleId: string; path: string; target: string };

/** Nahradí prefix za targetPrefix a připojí zbytek cesty (zůstatek za prefixem). */
type PrefixAppendRule = { ruleId: string; prefix: string; targetPrefix: string };

/** Po spárování prefixu ignorovat zbytek — přejít jen na `target`. */
type PrefixCollapseRule = { ruleId: string; prefix: string; target: string };

const LEGACY_EXACT_INTERNAL: ExactRule[] = [
  { ruleId: 'exact.objednat.cs', path: '/cs/cenik', target: '/objednat' },
  { ruleId: 'exact.blog-index.cs', path: '/cs/blog', target: '/blog' },
  { ruleId: 'exact.webinare.cs', path: '/cs/webinare', target: '/webinare' },
  { ruleId: 'exact.webinare.en', path: '/en/webinars', target: '/webinare' },
  { ruleId: 'exact.webinare.es', path: '/es/seminarios-web', target: '/webinare' },
  { ruleId: 'exact.kontakt.cs', path: '/cs/kontakt', target: '/kontakt' },
  { ruleId: 'exact.kontakt.en', path: '/en/contact', target: '/kontakt' },
  { ruleId: 'exact.kontakt.es', path: '/es/contacto', target: '/kontakt' },
  { ruleId: 'exact.pricing.en', path: '/en/pricing', target: '/objednat' },
  { ruleId: 'exact.pricing.es', path: '/es/precios', target: '/objednat' },
  { ruleId: 'exact.home.en', path: '/en', target: '/' },
  { ruleId: 'exact.home.es', path: '/es', target: '/' },
  { ruleId: 'exact.domskola', path: '/cs/domskola', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.domskola-dekujeme', path: '/cs/domskola-dekujeme', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.katalog-jeden-krok', path: '/cs/katalog-jeden-krok', target: '/objednat' },
  { ruleId: 'exact.katalog-registrace', path: '/cs/katalog-registrace', target: '/objednat' },
  { ruleId: 'exact.mobilni-aplikace', path: '/cs/mobilni-aplikace', target: '/dalsi-produkty' },
  { ruleId: 'exact.podporovana-zarizeni', path: '/cs/podporovana-zarizeni-cz', target: '/dalsi-produkty' },
  { ruleId: 'exact.poptat-mentoring', path: '/cs/poptat-mentoring-program', target: '/kontakt' },
  { ruleId: 'exact.rozsirena-realita.cs', path: '/cs/rozsirena-realita', target: '/vyzkousejte' },
  { ruleId: 'exact.testing.cs', path: '/cs/testing', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.otevrit-ucebnice.cs', path: '/cs/otevrit-ucebnice', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.about.en', path: '/en/about', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.augmented.en', path: '/en/augmented-reality', target: '/vyzkousejte' },
  { ruleId: 'exact.mobile-apps.en', path: '/en/mobile-apps', target: '/dalsi-produkty' },
  { ruleId: 'exact.supported-devices.en', path: '/en/supported-devices', target: '/dalsi-produkty' },
  { ruleId: 'exact.carrera.es', path: '/es/carrera', target: '/kontakt' },
  { ruleId: 'exact.dispositivos.es', path: '/es/dispositivos-compatibles', target: '/dalsi-produkty' },
  { ruleId: 'exact.mobile-apps.es', path: '/es/mobile-apps-es', target: '/dalsi-produkty' },
  { ruleId: 'exact.realidad.es', path: '/es/realidad-aumentada', target: '/vyzkousejte' },
  { ruleId: 'exact.sobre.es', path: '/es/sobre-nosotros', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.webinars-ty.es', path: '/es/webinars-ty-es', target: '/webinare' },
  { ruleId: 'exact.interaktivni-licence', path: '/cs/interaktivni-licence', target: '/' },
  { ruleId: 'exact.jak-zacit', path: '/cs/jak-zacit-s-vividbooks', target: '/webinare' },
  { ruleId: 'exact.dvpp-kurz', path: '/cs/dvpp-akreditovany-kurz', target: '/webinare' },
  { ruleId: 'exact.dvpp-webinare', path: '/cs/dvpp-webinare', target: '/webinare' },
  { ruleId: 'exact.didakticke', path: '/cs/didakticke-obrazy-a-plakaty', target: '/dalsi-produkty' },
  { ruleId: 'exact.tistene', path: '/cs/unikatni-tistene-pracovni-sesity-a-ucebnice', target: '/dalsi-produkty' },
  { ruleId: 'exact.vividboard-root', path: '/cs/vividboard', target: '/vividboard' },
  { ruleId: 'exact.vividboard.en', path: '/en/vividboard', target: '/vividboard' },
  { ruleId: 'exact.pisanky', path: '/cs/pisanky', target: '/predmet/cesky-jazyk' },
  { ruleId: 'exact.skolni-sesity', path: '/cs/skolni-sesity', target: '/dalsi-produkty' },
  { ruleId: 'exact.minihry', path: '/cs/minihry', target: '/vyzkousejte' },
  { ruleId: 'exact.ziva-ukazka', path: '/cs/ziva-ukazka', target: '/vyzkousejte' },
  { ruleId: 'exact.star-root.sk', path: '/hviezda-vyucby', target: '/akce' },
  { ruleId: 'exact.star-root.cz', path: '/hvezda-vyuky', target: '/akce' },
  { ruleId: 'exact.privacy', path: '/privacy-policy', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.kariera', path: '/cs/kariera', target: '/kontakt' },
  { ruleId: 'exact.nasi-zakaznici', path: '/cs/nasi-zakaznici', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.proc-to-delame', path: '/cs/proc-to-delame', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.mobile-menu.cs', path: '/cs/mobile-menu', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.mobile-menu.en', path: '/en/mobile-menu', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.mobile-menu.es', path: '/es/mobile-menu-es', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.odhlaseni-newsletter', path: '/cs/odhlaseni-z-newsletteru', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'exact.studenti', path: '/cs/studenti', target: '/vyzkousejte' },
  { ruleId: 'exact.webinar-ty', path: '/cs/webinar-ty', target: '/webinare' },
];

const LEGACY_PREFIX_APPEND: PrefixAppendRule[] = [
  { ruleId: 'prefix.blog.en', prefix: '/en/blog/', targetPrefix: '/blog/' },
  { ruleId: 'prefix.blog.es', prefix: '/es/blog/', targetPrefix: '/blog/' },
];

const LEGACY_PREFIX_COLLAPSE: PrefixCollapseRule[] = [
  { ruleId: 'collapse.vividboard.cs', prefix: '/cs/vividboard/', target: '/vividboard' },
  { ruleId: 'collapse.dvpp-webinare', prefix: '/dvpp-webinare/', target: '/webinare' },
  { ruleId: 'collapse.jobs', prefix: '/jobs/', target: '/kontakt' },
  { ruleId: 'collapse.kampan', prefix: '/cs/kampan/', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL },
  { ruleId: 'collapse.studenti-ucitelstvi', prefix: '/cs/studenti-ucitelstvi/', target: '/vyzkousejte' },
];

const LEGACY_PREDMET_SLUGS = [
  'matematika',
  'matematika-1-stupen',
  'matematika-2-stupen-new',
  'matematika---2-stupen-old',
  'fyzika',
  'chemie',
  'prirodopis',
  'prvouka',
  'cesky-jazyk',
  'dokonceni-matematiky',
] as const;

function canonicalPredmetSlug(slug: string): string {
  if (
    slug === 'matematika-1-stupen'
    || slug === 'matematika-2-stupen-new'
    || slug === 'matematika---2-stupen-old'
    || slug === 'dokonceni-matematiky'
  )
    return 'matematika';
  return slug;
}

export function normalizeLegacyPathname(pathname: string): string {
  if (!pathname) return '/';
  let p = pathname.split('?')[0]?.split('#')[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function tryManualOverride(path: string): LegacyRedirectResolution | null {
  const v = WEBFLOW_LEGACY_MANUAL_OVERRIDES[path]?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return { kind: 'external', target: v, ruleId: 'manual.override' };
  return { kind: 'internal', target: normalizeLegacyPathname(v), ruleId: 'manual.override' };
}

function resolveTrial(path: string): LegacyRedirectResolution | null {
  if (!path.includes('free-trial')) return null;
  return { kind: 'internal', target: '/vyzkousejte', ruleId: 'pattern.free-trial' };
}

function resolveUkazky(path: string): LegacyRedirectResolution | null {
  if (path.startsWith('/cs/ukazky')) return { kind: 'internal', target: '/vyzkousejte', ruleId: 'prefix.ukazky' };
  return null;
}

function resolveLegacyShortLink(path: string): LegacyRedirectResolution | null {
  if (!path.startsWith('/links/')) return null;
  const hit = LEGACY_SHORT_LINK_TARGETS[path];
  const eshopHome = `${ESHOP_PUBLIC_ORIGIN.replace(/\/$/, '')}/`;
  if (hit) {
    if (hit.kind === 'internal')
      return { kind: 'internal', target: normalizeLegacyPathname(hit.path), ruleId: 'mapped.links' };
    return { kind: 'external', target: hit.url, ruleId: 'external.links' };
  }
  return { kind: 'external', target: eshopHome, ruleId: 'external.links-default' };
}

function resolveLegacyCsBlog(path: string): LegacyRedirectResolution | null {
  if (!path.startsWith('/cs/blog/')) return null;
  const slug = path.slice('/cs/blog/'.length);
  if (!slug) return { kind: 'internal', target: '/blog', ruleId: 'fallback.blog-cs' };
  const mapped = LEGACY_CS_BLOG_SLUG_MAP[slug];
  if (mapped) return { kind: 'internal', target: `/blog/${mapped}`, ruleId: 'mapped.blog-cs' };
  return { kind: 'internal', target: '/blog', ruleId: 'fallback.blog-cs' };
}

function resolveLegacyAppNews(path: string): LegacyRedirectResolution | null {
  if (!path.startsWith('/app-news/')) return null;
  const slug = path.slice('/app-news/'.length);
  if (!slug) return { kind: 'internal', target: '/novinky', ruleId: 'fallback.app-news' };
  const mapped = LEGACY_APP_NEWS_TO_NOVINKA_SLUG[slug];
  if (mapped) return { kind: 'internal', target: `/novinky/${mapped}`, ruleId: 'mapped.app-news' };
  return { kind: 'internal', target: '/novinky', ruleId: 'fallback.app-news' };
}

export function resolveWebflowLegacyRedirect(pathname: string): LegacyRedirectResolution {
  const path = normalizeLegacyPathname(pathname);

  const manualHit = tryManualOverride(path);
  if (manualHit) return manualHit;

  const trial = resolveTrial(path);
  if (trial) return trial;

  const uk = resolveUkazky(path);
  if (uk) return uk;

  const shortLink = resolveLegacyShortLink(path);
  if (shortLink) return shortLink;

  for (const r of LEGACY_EXACT_INTERNAL) {
    if (r.path === path) return { kind: 'internal', target: r.target, ruleId: r.ruleId };
  }

  const csBlog = resolveLegacyCsBlog(path);
  if (csBlog) return csBlog;

  const appNews = resolveLegacyAppNews(path);
  if (appNews) return appNews;

  const appendSorted = [...LEGACY_PREFIX_APPEND].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of appendSorted) {
    if (path.startsWith(r.prefix)) {
      const rest = path.slice(r.prefix.length);
      const target = `${r.targetPrefix}${rest}`.replace(/\/{2,}/g, '/');
      return { kind: 'internal', target, ruleId: r.ruleId };
    }
  }

  const collapseSorted = [...LEGACY_PREFIX_COLLAPSE].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of collapseSorted) {
    if (path.startsWith(r.prefix))
      return { kind: 'internal', target: r.target, ruleId: r.ruleId };
  }

  const csPredmetPrefix = '/cs/';
  if (path.startsWith(csPredmetPrefix)) {
    const slug = path.slice(csPredmetPrefix.length);
    if ((LEGACY_PREDMET_SLUGS as readonly string[]).includes(slug))
      return {
        kind: 'internal',
        target: `/predmet/${canonicalPredmetSlug(slug)}`,
        ruleId: 'predmet.cs-slug',
      };
  }

  const enPairs = [
    { from: '/en/physics', slug: 'fyzika' },
    { from: '/en/chemistry', slug: 'chemie' },
  ];
  for (const e of enPairs) {
    if (path === e.from) return { kind: 'internal', target: `/predmet/${e.slug}`, ruleId: 'predmet.en-subject' };
  }

  const esPairs = [
    { from: '/es/fisica', slug: 'fyzika' },
    { from: '/es/quimica', slug: 'chemie' },
  ];
  for (const e of esPairs) {
    if (path === e.from) return { kind: 'internal', target: `/predmet/${e.slug}`, ruleId: 'predmet.es-subject' };
  }

  const matematikaLang = ['/en/mathematics', '/es/matematicas'];
  if (matematikaLang.includes(path))
    return { kind: 'internal', target: '/predmet/matematika', ruleId: 'predmet.matematika-lang' };

  if (path.startsWith('/docs/'))
    return { kind: 'internal', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL, ruleId: 'prefix.docs-fallback' };

  if (path.startsWith('/school/cz/') || path.startsWith('/school/sk/')) {
    const remainderRaw = path.replace(/^\/school\/(?:cz|sk)/, '');
    const remainder = normalizeLegacyPathname(remainderRaw.startsWith('/') ? remainderRaw : `/${remainderRaw}`);
    const nestedTrial = resolveTrial(remainder);
    if (nestedTrial) return { ...nestedTrial, ruleId: `${nestedTrial.ruleId}.school-mirror` };
    const nestedUk = resolveUkazky(remainder);
    if (nestedUk) return { ...nestedUk, ruleId: `${nestedUk.ruleId}.school-mirror` };
    const nested = resolveWebflowLegacyRedirect(remainder);
    if (nested.kind !== 'none') return { ...nested, ruleId: `${nested.ruleId}.school-mirror` };
    const paddedCs = remainder.startsWith('/cs/') ? remainder : `/cs${remainder}`;
    const nestedCs = resolveWebflowLegacyRedirect(paddedCs);
    if (nestedCs.kind !== 'none') return { ...nestedCs, ruleId: `${nestedCs.ruleId}.school-as-cs` };
    return { kind: 'internal', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL, ruleId: 'fallback.school' };
  }

  return { kind: 'none' };
}

/** Kam přesměrovat Webflow URL bez ekvivalentu na novém webu */
export function resolveWebflowLegacyWithFallback(pathname: string): LegacyRedirectResolution {
  const r = resolveWebflowLegacyRedirect(pathname);
  if (r.kind !== 'none') return r;
  if (!pathnameLooksLikeWebflowLegacy(pathname)) return r;
  return { kind: 'internal', target: WEBFLOW_LEGACY_FALLBACK_INTERNAL, ruleId: 'fallback.webflow-shape' };
}

/** Legacy URL rozšíří SPA přesměrování (GitHub Pages bez CDN redirectů). */
export function pathnameLooksLikeWebflowLegacy(pathname: string): boolean {
  const p = normalizeLegacyPathname(pathname);
  if (
    p.startsWith('/cs/')
    || p.startsWith('/en/')
    || p.startsWith('/es/')
    || p.startsWith('/school/')
    || p.startsWith('/app-news/')
    || p.startsWith('/docs/')
    || p.startsWith('/dvpp-webinare/')
    || p.startsWith('/links/')
    || p.startsWith('/jobs/')
  )
    return true;
  if (
    p === '/privacy-policy'
    || p === '/hvezda-vyuky'
    || p === '/hviezda-vyucby'
    || p === '/en'
    || p === '/es'
  )
    return true;
  return false;
}
