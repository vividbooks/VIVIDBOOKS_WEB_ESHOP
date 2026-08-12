/**
 * Kontext z veřejných URL + CMS pro generate-email.
 * AI v Email Builderu dřív URL z promptu jen četla jako text — teď je načteme.
 */

const MAX_URLS = 4;
const FETCH_TIMEOUT_MS = 9_000;
const MAX_HTML_BYTES = 350_000;
const MAX_IMAGES = 14;
const MAX_TEXT_CHARS = 6_000;

const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi;

export function extractUrlsFromText(text: string): string[] {
  const raw = String(text || '');
  const found = raw.match(URL_RE) || [];
  const cleaned = found.map((u) => u.replace(/[.,;:!?)]+$/, ''));
  const uniq: string[] = [];
  for (const u of cleaned) {
    if (!uniq.includes(u)) uniq.push(u);
    if (uniq.length >= MAX_URLS) break;
  }
  return uniq;
}

function isBlockedFetchHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(10\.|192\.168\.|169\.254\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function absolutizeUrl(href: string, base: string): string | null {
  const h = href.trim();
  if (!h || h.startsWith('data:') || h.startsWith('javascript:') || h.startsWith('#')) return null;
  try {
    return new URL(h, base).href;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function metaContent(html: string, nameOrProp: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${nameOrProp}["']`,
    'i',
  );
  const m = html.match(re) || html.match(re2);
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : '';
}

function extractTitle(html: string): string {
  const og = metaContent(html, 'og:title');
  if (og) return og;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? stripTags(m[1]).slice(0, 200) : '';
}

function extractImages(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const abs = absolutizeUrl(raw, pageUrl);
    if (!abs) return;
    if (!/\.(png|jpe?g|webp|gif)(\?|$)/i.test(abs) && !/\/storage\/v1\/object\/public\//i.test(abs)) {
      // povolit i CDN bez přípony, pokud vypadá jako image path
      if (!/\/(image|img|media|upload|aplikace|hero|cover)/i.test(abs)) return;
    }
    if (out.includes(abs)) return;
    out.push(abs);
  };

  const og = metaContent(html, 'og:image') || metaContent(html, 'twitter:image');
  if (og) push(og);

  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) && out.length < MAX_IMAGES) {
    push(m[1]);
  }

  // Vite / SPA: často jsou asset URL v JSON nebo module scriptách
  const assetRe =
    /(?:src|url|image|contentImage|coverImage|poster)["']?\s*[:=]\s*["']([^"']+\.(?:png|jpe?g|webp|gif)(?:\?[^"']*)?)["']/gi;
  while ((m = assetRe.exec(html)) && out.length < MAX_IMAGES) {
    push(m[1]);
  }

  return out.slice(0, MAX_IMAGES);
}

function extractMainText(html: string): string {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ');
  const article = h.match(/<article[\s\S]*?<\/article>/i)?.[0];
  const main = h.match(/<main[\s\S]*?<\/main>/i)?.[0];
  const body = h.match(/<body[\s\S]*?<\/body>/i)?.[0];
  const chunk = article || main || body || h;
  return stripTags(chunk).slice(0, MAX_TEXT_CHARS);
}

export type FetchedPageContext = {
  url: string;
  ok: boolean;
  title?: string;
  description?: string;
  images: string[];
  text?: string;
  error?: string;
};

export async function fetchPageForEmailContext(url: string): Promise<FetchedPageContext> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, ok: false, images: [], error: 'neplatná URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { url, ok: false, images: [], error: 'jen http(s)' };
  }
  if (isBlockedFetchHost(parsed.hostname)) {
    return { url, ok: false, images: [], error: 'blokovaný host' };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.href, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'VividbooksEmailAI/1.0 (+https://www.vividbooks.com)',
      },
    });
    if (!res.ok) {
      return { url: parsed.href, ok: false, images: [], error: `HTTP ${res.status}` };
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('image/')) {
      return {
        url: parsed.href,
        ok: true,
        title: 'Přímý obrázek',
        images: [parsed.href],
        text: '',
      };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const html = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    const title = extractTitle(html);
    const description =
      metaContent(html, 'og:description') || metaContent(html, 'description') || '';
    const images = extractImages(html, parsed.href);
    const text = extractMainText(html);
    return {
      url: parsed.href,
      ok: true,
      title,
      description,
      images,
      text,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { url: parsed.href, ok: false, images: [], error: msg.slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

export async function buildFetchedUrlsCtxFromList(
  urls: string[],
  heading = 'Obsah načtený z URL (živě z webu)',
): Promise<string> {
  const uniq: string[] = [];
  for (const u of urls) {
    const clean = String(u || '').trim();
    if (!clean || uniq.includes(clean)) continue;
    uniq.push(clean);
    if (uniq.length >= MAX_URLS) break;
  }
  if (!uniq.length) return '';

  const pages = await Promise.all(uniq.map((u) => fetchPageForEmailContext(u)));
  const blocks: string[] = [
    `\n\n## ${heading}\n`,
    'Toto jsou reálná data stažená ze stránek. ',
    'Obrázky z pole img: a odkazy smíš použít. Nevymýšlej jiné URL.\n',
  ];

  for (const p of pages) {
    if (!p.ok) {
      blocks.push(`\n### URL (selhalo): ${p.url}\nChyba: ${p.error || 'neznámá'}\n`);
      continue;
    }
    blocks.push(`\n### ${p.title || 'Stránka'}\nURL: ${p.url}\n`);
    if (p.description) blocks.push(`Popis: ${p.description}\n`);
    if (p.images.length) {
      blocks.push('Obrázky (použij tyto URL):\n');
      p.images.forEach((img, i) => blocks.push(`${i + 1}. img: ${img}\n`));
    } else {
      blocks.push('(Na stránce se nepodařilo najít obrázky v HTML — SPA může renderovat až v JS.)\n');
    }
    if (p.text?.trim()) {
      blocks.push(`\nText stránky (zkráceno):\n${p.text.trim()}\n`);
    }
  }
  return blocks.join('');
}

export async function buildFetchedUrlsCtx(textWithUrls: string): Promise<string> {
  return buildFetchedUrlsCtxFromList(
    extractUrlsFromText(textWithUrls),
    'Obsah načtený z URL v zadání (živě z webu)',
  );
}

export function buildHeroSlidesCtx(
  slides: any[],
  toAbsolute: (path: string) => string,
  preferFast: boolean,
): string {
  if (!Array.isArray(slides) || !slides.length) return '';
  const limit = preferFast ? 8 : 16;
  const lines = slides.slice(0, limit).map((s: any, i: number) => {
    const title = String(s.title || s.headline || s.name || `Slide ${i + 1}`).trim();
    const subtitle = String(s.subtitle || s.text || s.description || '').trim().slice(0, 220);
    const imgRaw = String(
      s.image || s.imageUrl || s.coverImage || s.heroVideoPoster || s.poster || '',
    ).trim();
    const img = imgRaw
      ? imgRaw.startsWith('http')
        ? imgRaw
        : toAbsolute(imgRaw.startsWith('/') ? imgRaw : `/${imgRaw}`)
      : '';
    const link = String(s.link || s.href || s.ctaUrl || s.url || '').trim();
    return `- **${title}**${subtitle ? ' — ' + subtitle : ''}${img ? ' | img: ' + img : ''}${link ? ' | url: ' + link : ''}`;
  });
  return (
    '\n\n## Hero slidery (homepage CMS):\n' +
    'Když uživatel chce obrázky/hero z webu / homepage, použij tyto img URL.\n' +
    lines.join('\n')
  );
}

export function buildSubjectTabsCtx(
  tabs: any[],
  toAbsolute: (path: string) => string,
  preferFast: boolean,
): string {
  if (!Array.isArray(tabs) || !tabs.length) return '';
  const limit = preferFast ? 20 : 40;
  const lines = tabs.slice(0, limit).map((t: any) => {
    const label = String(t.tabText || t.label || t.title || t.id || 'tab').trim();
    const headline = String(t.contentHeadline || t.headline || '').trim();
    const text = String(t.contentRichText || t.content || t.text || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280);
    const imgRaw = String(t.contentImage || t.image || t.imageUrl || '').trim();
    const img = imgRaw
      ? imgRaw.startsWith('http')
        ? imgRaw
        : toAbsolute(imgRaw.startsWith('/') ? imgRaw : `/${imgRaw}`)
      : '';
    const subject = String(t.subject || t.predmet || '').trim();
    return `- **${label}**${headline ? ' — ' + headline : ''}${subject ? ' [' + subject + ']' : ''}${img ? ' | img: ' + img : ''}${text ? '\n  ' + text : ''}`;
  });
  return (
    '\n\n## Subject tabs / karty na webu (CMS):\n' +
    'Screenshoty a texty karet z adminu (tabs). Použij img URL když uživatel chce obsah z webu/slideru předmětu.\n' +
    lines.join('\n')
  );
}

export function buildFixedPagesCtx(pages: any[], preferFast: boolean): string {
  if (!Array.isArray(pages) || !pages.length) return '';
  const limit = preferFast ? 6 : 12;
  const lines = pages.slice(0, limit).map((p: any) => {
    const title = String(p.title || p.name || p.slug || 'stránka').trim();
    const slug = String(p.slug || p.path || '').trim();
    const body = String(p.content || p.body || p.html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    return `- **${title}**${slug ? ' | slug: ' + slug : ''}${body ? '\n  ' + body : ''}`;
  });
  return '\n\n## Fixed pages (CMS texty):\n' + lines.join('\n');
}
