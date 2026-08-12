/**
 * Server-side napojení AI HTML na bloky Email Builderu (webinář / koláž)
 * + odstranění divného duplicitního hero (šablona už má headline).
 */

type WebinarLike = {
  id?: string;
  slug?: string;
  title?: string;
  subtitle?: string;
  day?: number;
  monthName?: string;
  monthNum?: number;
  year?: number;
  time?: string;
  lecturer?: string;
  lecturerAvatar?: string;
  coverImage?: string;
  thumbnailVariant?: number;
  isPast?: boolean;
  targetAudience?: string;
  coverImageBgColor?: string;
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function randomBlockId(): string {
  return `vb-block-${Math.random().toString(36).slice(2, 10)}`;
}

function encodePayload(obj: unknown): string {
  const json = JSON.stringify(obj);
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return btoa(json);
  }
}

function webinarUrl(siteOrigin: string, w: WebinarLike): string {
  const seg = encodeURIComponent(String(w.slug || w.id || 'webinar').trim());
  return `${siteOrigin.replace(/\/$/, '')}/webinar/${seg}`;
}

function snapshotFrom(w: WebinarLike) {
  const tv = w.thumbnailVariant;
  return {
    id: String(w.id || ''),
    slug: String(w.slug || w.id || ''),
    title: String(w.title || 'Webinář').trim(),
    subtitle: String(w.subtitle || '').trim(),
    day: Number(w.day) || 1,
    monthName: String(w.monthName || '').trim(),
    monthNum: Number(w.monthNum) || 1,
    year: Number(w.year) || new Date().getFullYear(),
    time: String(w.time || '18:00').trim(),
    lecturer: String(w.lecturer || '').trim(),
    lecturerAvatar: String(w.lecturerAvatar || '').trim(),
    coverImage: String(w.coverImage || '').trim(),
    thumbnailVariant: tv === 1 || tv === 2 ? tv : 3,
    isPast: w.isPast === true,
    targetAudience: String(w.targetAudience || '').trim(),
    coverImageBgColor: /^#[0-9A-Fa-f]{6}$/.test(String(w.coverImageBgColor || ''))
      ? String(w.coverImageBgColor)
      : '#ffffff',
  };
}

/** Kompaktní editovatelný webinářový blok (stejné atributy jako editor). */
export function buildServerWebinarBlockHtml(
  siteOrigin: string,
  w: WebinarLike,
  layout: 'hero' | 'compact' | 'pill' = 'compact',
  blockId = randomBlockId(),
): string {
  const s = snapshotFrom(w);
  const href = webinarUrl(siteOrigin, s);
  const lay = layout === 'hero' || layout === 'pill' ? layout : 'compact';
  const layoutHeight = lay === 'pill' ? 88 : 140;
  const encoded = encodePayload({
    v: 1,
    layout: lay,
    snapshot: s,
    ...(lay !== 'hero' ? { layoutHeight } : {}),
  });
  const cta = s.isPast ? 'Záznam' : 'Přihlásit se';
  const mo = s.monthName ? s.monthName.slice(0, 3).toLowerCase() : '';
  const dateLine = `${s.day}. ${mo}. ${s.year} od ${s.time}`;
  const bg = '#F0F2F8';

  let inner: string;
  if (lay === 'pill') {
    const badge =
      `<div style="text-align:center;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:6px 8px;min-width:44px;">` +
      `<div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:16px;line-height:1;color:#001158;">${s.day}</div>` +
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#001158;opacity:0.65;line-height:1.1;margin-top:2px;">${escapeHtml(s.monthName)}</div>` +
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#FF8C00;line-height:1;margin-top:4px;">${escapeHtml(s.time)}</div>` +
      `</div>`;
    inner =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" ` +
      `style="border-collapse:collapse;background-color:${bg};border-radius:16px;overflow:hidden;border:1px solid #dde1e8;min-height:${layoutHeight}px;">` +
      `<tr>` +
      `<td class="vb-wb-stack" valign="middle" style="padding:10px 10px 14px 14px;width:56px;background-color:${bg};">${badge}</td>` +
      `<td class="vb-wb-stack" valign="middle" style="padding:10px 10px 14px 10px;background-color:${bg};font-family:Arial,Helvetica,sans-serif;">` +
      `<p style="margin:0;font-size:15px;font-weight:700;line-height:1.3;color:#001158;">${escapeHtml(s.title)}</p>` +
      (s.subtitle
        ? `<p style="margin:2px 0 0 0;font-size:11px;line-height:1.3;color:#001158;opacity:0.7;">${escapeHtml(s.subtitle)}</p>`
        : '') +
      `</td>` +
      `<td class="vb-wb-stack" valign="middle" align="right" style="padding:10px 14px 14px 10px;white-space:nowrap;background-color:${bg};">` +
      `<a href="${safeAttr(href)}" class="vb-webinar-cta" style="display:inline-block;background-color:#FF8C00;color:#ffffff;font-size:12px;font-weight:700;padding:10px 18px;border-radius:12px;text-decoration:none;">${escapeHtml(cta)}</a>` +
      `</td></tr></table>`;
  } else {
    const cover = s.coverImage
      ? `<a href="${safeAttr(href)}" style="display:block;line-height:0;text-decoration:none;">` +
        `<img src="${safeAttr(s.coverImage)}" alt="${safeAttr(s.title.slice(0, 80))}" width="600" ` +
        `style="display:block;width:100%;max-width:100%;height:auto;margin:0;border:0;border-radius:16px 0 0 16px;" /></a>`
      : `<div style="background:#001158;border-radius:16px 0 0 16px;padding:16px 12px;min-height:120px;">` +
        `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#F5D645;">DVPP zdarma</p>` +
        `<p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;color:#ffffff;line-height:1.25;">${escapeHtml(s.title)}</p>` +
        `</div>`;

    inner =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" ` +
      `style="border-collapse:collapse;background-color:${bg};border-radius:20px;overflow:hidden;border:1px solid #dde1e8;margin:0 0 14px 0;">` +
      `<tr>` +
      `<td valign="top" width="46%" style="width:46%;padding:0;vertical-align:top;">${cover}</td>` +
      `<td valign="middle" width="54%" style="width:54%;padding:14px 16px;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;">` +
      `<p style="margin:0 0 6px 0;font-size:15px;font-weight:700;line-height:1.3;color:#001158;">${escapeHtml(s.title)}</p>` +
      (s.subtitle
        ? `<p style="margin:0 0 6px 0;font-size:12px;line-height:1.35;color:#001158;opacity:0.75;">${escapeHtml(s.subtitle)}</p>`
        : '') +
      `<p style="margin:0 0 10px 0;font-size:12px;font-weight:600;color:#001158;">${escapeHtml(dateLine)}</p>` +
      `<a href="${safeAttr(href)}" class="vb-webinar-cta" style="display:inline-block;background-color:#FF8C00;color:#ffffff;font-size:11px;font-weight:700;padding:9px 16px;border-radius:10px;text-decoration:none;">${escapeHtml(cta)}</a>` +
      `</td></tr></table>`;
  }

  const heightAttr = lay !== 'hero' ? ` data-vb-wb-height="${layoutHeight}"` : '';
  return (
    `<div data-vb-block="webinar" data-email-webinar="true" data-vb-block-id="${safeAttr(blockId)}" ` +
    `data-vb-wb-layout="${lay}" data-vb-wb-encoded="${safeAttr(encoded)}"${heightAttr} ` +
    `style="padding:0;background:transparent;">${inner}</div>`
  );
}

function findWebinar(list: WebinarLike[], key: string): WebinarLike | null {
  const k = key.trim().toLowerCase();
  if (!k) return null;
  return (
    list.find((w) => String(w.slug || '').toLowerCase() === k) ||
    list.find((w) => String(w.id || '').toLowerCase() === k) ||
    list.find((w) => String(w.title || '').toLowerCase().includes(k)) ||
    null
  );
}

/** Odstraní krátký tmavý „hero“ v bodyHtml — ten už řeší šablona přes pole headline. */
export function stripDuplicateEmailHero(bodyHtml: string, headline?: string): string {
  let html = bodyHtml;
  // Explicitní editor hero bloky
  html = html.replace(
    /<div[^>]*data-vb-block=["']hero["'][^>]*>[\s\S]*?<\/div>/gi,
    '',
  );
  const hl = String(headline || '').trim();
  if (hl.length >= 8) {
    const escaped = hl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<div[^>]*(?:background(?:-color)?\\s*:\\s*#00116[18]|#00116[18])[^>]*>[\\s\\S]{0,400}?${escaped}[\\s\\S]{0,200}?<\\/div>`,
      'gi',
    );
    html = html.replace(re, '');
  }
  // Prázdné krátké tmavé boxy jen s h1/h2
  html = html.replace(
    /<div[^>]*style="[^"]*background(?:-color)?:\s*#00116[18][^"]*"[^>]*>\s*<(?:h1|h2)[^>]*>[^<]{0,80}<\/(?:h1|h2)>\s*<\/div>/gi,
    '',
  );
  return html;
}

function matchWebinarsInHtml(html: string, webinars: WebinarLike[]): WebinarLike[] {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const upcoming = webinars.filter((w) => !w.isPast);
  const pool = upcoming.length ? upcoming : webinars;
  const matched: WebinarLike[] = [];
  for (const w of pool) {
    const title = String(w.title || '').trim();
    if (title.length < 6) continue;
    const needle = title.toLowerCase().slice(0, Math.min(48, title.length));
    if (plain.includes(needle)) {
      matched.push(w);
      continue;
    }
    // datumová shoda: "25. 8." / "25.8."
    const day = Number(w.day);
    const month = Number(w.monthNum);
    if (day > 0 && month > 0) {
      const d1 = `${day}. ${month}.`;
      const d2 = `${day}.${month}.`;
      const d3 = `${day}. ${month}`;
      if (plain.includes(d1) || plain.includes(d2) || plain.includes(`${day}. 8`) && month === 8) {
        // title word overlap
        const words = title.toLowerCase().split(/\s+/).filter((x) => x.length > 4).slice(0, 3);
        if (words.some((word) => plain.includes(word))) matched.push(w);
      }
    }
  }
  // unique by id/slug
  const seen = new Set<string>();
  return matched.filter((w) => {
    const k = String(w.slug || w.id || w.title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 6);
}

export function hydrateEmailBodyForBuilder(
  bodyHtml: string,
  opts: {
    webinars: WebinarLike[];
    siteOrigin: string;
    headline?: string;
    forceInjectWebinars?: boolean;
  },
): { html: string; notes: string[] } {
  const notes: string[] = [];
  let html = String(bodyHtml || '');
  if (!html.trim()) return { html, notes };

  const beforeHero = html;
  html = stripDuplicateEmailHero(html, opts.headline);
  if (html !== beforeHero) notes.push('Odstraněn duplicitní tmavý hero (titulek už je v šabloně).');

  // Placeholdery data-ai-webinar-slug
  html = html.replace(
    /<div([^>]*\bdata-ai-webinar-slug=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/div>/gi,
    (_full, _attrs: string, slug: string) => {
      const layoutMatch = String(_attrs).match(/data-ai-webinar-layout=["'](hero|compact|pill)["']/i);
      const layoutRaw = (layoutMatch?.[1] || 'compact').toLowerCase();
      const layout = (
        layoutRaw === 'hero' || layoutRaw === 'pill' ? layoutRaw : 'compact'
      ) as 'hero' | 'compact' | 'pill';
      const idMatch = String(_attrs).match(/data-vb-block-id=["']([^"']+)["']/i);
      const blockId = idMatch?.[1] || randomBlockId();
      const found = findWebinar(opts.webinars, slug);
      if (!found) {
        notes.push(`Webinář slug „${slug}“ v CMS chybí.`);
        return _full;
      }
      notes.push(`Webinář „${found.title}“ → editovatelný blok.`);
      return buildServerWebinarBlockHtml(opts.siteOrigin, found, layout, blockId);
    },
  );

  const hasRealWebinar = /data-email-webinar\s*=\s*["']true["']/i.test(html);
  const matched = matchWebinarsInHtml(html, opts.webinars);
  const shouldInject =
    !hasRealWebinar &&
    matched.length > 0 &&
    (opts.forceInjectWebinars ||
      /webin[aá]?[rř]|dvpp|školen|naživo|přihlásit/i.test(html));

  if (shouldInject) {
    const blocks = matched
      .map((w) => buildServerWebinarBlockHtml(opts.siteOrigin, w, 'compact'))
      .join('\n');
    const section =
      `<div data-vb-block="section" data-vb-section-fill="plain" data-vb-block-id="${randomBlockId()}" style="padding:0;background:transparent;">` +
      `<div data-vb-block="text" data-vb-block-id="${randomBlockId()}" style="padding:10px 24px;background:transparent;">` +
      `<h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#F06632;">Ukážeme vám všechno naživo</h2>` +
      `</div>${blocks}</div>`;

    const listBlockRe =
      /<div([^>]*data-vb-block=["']text["'][^>]*)>([\s\S]*?(?:\d{1,2}\.\s*\d{1,2}\.[\s\S]*?){2,}[\s\S]*?)<\/div>/i;
    if (listBlockRe.test(html)) {
      html = html.replace(listBlockRe, section);
      notes.push(`Textový seznam nahrazen ${matched.length} bloky webinářů s odkazy.`);
    } else {
      const rootRe = /(<div[^>]*class=["'][^"']*vb-email-root[^"']*["'][^>]*>)([\s\S]*)(<\/div>\s*)$/i;
      if (rootRe.test(html)) {
        html = html.replace(rootRe, `$1$2${section}$3`);
      } else {
        html += section;
      }
      notes.push(`Doplněno ${matched.length} bloků webinářů s odkazy.`);
    }
  }

  return { html, notes };
}
