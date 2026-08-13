/**
 * Typ kontaktu z Mailchimp / webinářových tagů.
 * Jeden kontakt může mít víc bucketů (matematika + 1. stupeň).
 * `wb-webinar` = byl na jakémkoli webináři (včetně „Webinar form“).
 */

export const WEBINAR_AUDIENCE_DEFS = [
  { slug: 'wb-webinar', name: 'Web · Byl na webináři' },
  { slug: 'wb-matematika', name: 'Web · Matematika' },
  { slug: 'wb-fyzika', name: 'Web · Fyzika' },
  { slug: 'wb-chemie', name: 'Web · Chemie' },
  { slug: 'wb-prirodopis', name: 'Web · Přírodopis' },
  { slug: 'wb-1stupen', name: 'Web · 1. stupeň' },
  { slug: 'wb-cesky', name: 'Web · Český jazyk' },
  { slug: 'wb-reditel', name: 'Web · Ředitelé' },
  { slug: 'wb-ai', name: 'Web · AI ve výuce' },
  { slug: 'wb-vividboard', name: 'Web · Vividboard' },
  { slug: 'wb-produkt', name: 'Web · Produkt / úvod' },
] as const;

export type WebinarAudienceSlug = (typeof WEBINAR_AUDIENCE_DEFS)[number]['slug'];

export const WEBINAR_AUDIENCE_SLUGS: WebinarAudienceSlug[] = WEBINAR_AUDIENCE_DEFS.map((d) => d.slug);

export function foldTagName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-·•–—_/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE_EXACT = new Set([
  '',
  '-',
  'customer',
  'user',
  'school',
  'business',
  'akademie',
  'ict',
  'minihry',
  'trial sales',
  'trial form',
  'order form',
  'catalog form',
  'newsletter',
  'newsletter form',
  'b2c vividbooks',
]);

export function isSystemAudienceTagName(name: string): boolean {
  const n = foldTagName(name);
  return n.startsWith('eng ') || n.startsWith('web ');
}

export function isNoiseTagName(name: string): boolean {
  const n = foldTagName(name);
  if (NOISE_EXACT.has(n)) return true;
  if (isSystemAudienceTagName(name)) return true;
  if (n.startsWith('smazat')) return true;
  if (n.includes('clicked on trial') || n.includes('received birthday')) return true;
  if (n.includes('gazdik')) return true;
  return false;
}

/** Historické MC tagy webinářů: celý název + datum, `webinar-*`, `dvpp-video-*`, Webinar form. */
export function isWebinarEventTagName(name: string): boolean {
  if (isNoiseTagName(name)) return false;
  const n = foldTagName(name);
  if (n === 'webinar form' || n === 'webinar registrace') return true;
  if (n.startsWith('webinar ') || n.startsWith('dvpp video')) return true;
  if (n.includes('webinar')) return true;
  if (n.includes('meet.google.com')) return true;
  const hasYear = /\b20[1-3]\d\b/.test(n);
  const hasDate =
    /\d{1,2}\.\s*\d{1,2}\.\s*20[1-3]\d/.test(n)
    || /\d{1,2}\/\d{1,2}\/20[1-3]\d/.test(n)
    || /\bod\s+\d{1,2}[.:]\d{2}/.test(n);
  return hasYear && hasDate;
}

function isCatchAllWebinarTag(n: string): boolean {
  return n === 'webinar form' || n === 'webinar registrace';
}

function isSubjectHintTag(n: string): boolean {
  return (
    n.includes('interest')
    || n.includes('interested')
    || /1\.?\s*stup/.test(n)
    || n === 'reditele'
    || n.includes('letni vzdelavani reditel')
    || n === 'vividboard'
    || n === 'prirodopis'
    || n.includes('kampan matematika')
    || n.includes('matematika 1')
    || n === 'jak na fyziku'
  );
}

function hasHigherGrade(n: string): boolean {
  return /[6-9]\.?\s*rocnik/.test(n);
}

function hasFirstGradeYear(n: string): boolean {
  if (/1\.?\s*rocnik/.test(n)) return true;
  if (/2\.?\s*rocnik/.test(n) && (n.includes('prvouk') || n.includes('matemat') || n.includes('predstaveni'))) {
    return true;
  }
  return false;
}

export function classifyTagBuckets(name: string): WebinarAudienceSlug[] {
  if (isNoiseTagName(name) || isSystemAudienceTagName(name)) return [];
  const n = foldTagName(name);
  if (!n) return [];

  const isEvent = isWebinarEventTagName(name);
  const isHint = isSubjectHintTag(n);
  const out = new Set<WebinarAudienceSlug>();

  if (
    n.includes('reditel')
    || n.includes('vedeni skoly')
    || n.includes('financni rizeni')
    || n.includes('pohledu redit')
    || n.includes('pohledem ministra')
    || n.includes('jako lidr')
    || n.includes('letni vzdelavani')
  ) {
    out.add('wb-reditel');
  }

  if (
    /1\.?\s*stup/.test(n)
    || n.includes('prvni stup')
    || n.includes('1stupe')
    || n.includes('prvouk')
    || n.includes('psaci pismo')
    || n.includes('badame na prvnim')
    || (hasFirstGradeYear(n) && !hasHigherGrade(n))
  ) {
    out.add('wb-1stupen');
  }

  if (
    n.includes('matemat')
    || n.includes('matika')
    || n.includes('zlomky')
    || n.includes('desetinna')
    || n.includes('procenta')
    || n.includes('algebraick')
    || n.includes('geometri')
    || n.includes('rysovan')
    || n.includes('jednotkami')
    || n.includes('umernost')
    || n.includes('souboj trid')
  ) {
    out.add('wb-matematika');
  }

  if (n.includes('fyzik') || n.includes('elektricky obvod') || n.includes('fyzikalni')) {
    out.add('wb-fyzika');
  }

  if (n.includes('chemi')) out.add('wb-chemie');

  if (n.includes('prirodopis') || n.includes('badame na prvnim')) {
    out.add('wb-prirodopis');
  }

  if (n.includes('cesky jazyk') || n.includes('cestina') || n.includes('psaci pismo')) {
    out.add('wb-cesky');
  }

  if (
    n.includes('umela inteligence')
    || n.includes('umelou inteligenci')
    || n.includes('ai v praxi')
    || n.includes('superucitel')
    || n.includes('diky ai')
    || (/\bai\b/.test(n) && (n.includes('vyuce') || n.includes('pedagog') || n.includes('skol')))
  ) {
    out.add('wb-ai');
  }

  if (n.includes('vividboard')) out.add('wb-vividboard');

  const hasSubject = [...out].some((s) => s !== 'wb-reditel');

  const productish =
    n.includes('uvod do vividbooks')
    || n.includes('nova aplikace')
    || n.includes('predstaveni novych funkci')
    || n.includes('online setkani')
    || n.includes('setkani vividbooks')
    || n.includes('v kostce')
    || n.includes('jak efektivne pouzivat')
    || n.includes('ucitele ucitelum')
    || n.includes('nastroje pro interaktivni')
    || n.includes('stredobod interaktivni')
    || n.includes('tvorba interaktivnich')
    || n.includes('tvorba zabavne vyuky')
    || n.includes('projektovou vyuku')
    || n.includes('skupinovou praci')
    || n.includes('nova temata podle noveho rvp')
    || n.includes('improvizace')
    || n.includes('rodicovsky handbook')
    || n.includes('editor pracovnich listu')
    || n.includes('jak zpestrit hodinu')
    || n.includes('vstupte do noveho skolniho');

  if (productish && !hasSubject) out.add('wb-produkt');

  if (isEvent && out.size === 0 && !isCatchAllWebinarTag(n)) {
    out.add('wb-produkt');
  }

  if (!isEvent && !isHint && out.size === 0) return [];
  return [...out];
}

export function classifyContactFromTagNames(names: string[]): WebinarAudienceSlug[] {
  const buckets = new Set<WebinarAudienceSlug>();
  let anyEvent = false;
  for (const name of names) {
    if (!name?.trim()) continue;
    if (isWebinarEventTagName(name)) anyEvent = true;
    for (const b of classifyTagBuckets(name)) buckets.add(b);
  }
  if (anyEvent) buckets.add('wb-webinar');
  return [...buckets];
}
