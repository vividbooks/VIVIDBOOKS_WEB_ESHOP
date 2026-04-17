import type { Webinar } from '../../data/webinars';

export type EmailWebinarLayout = 'hero' | 'compact';

/** Data uložená v mailu (soběstačné HTML + base64 JSON). */
export type EmailWebinarSnapshot = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  day: number;
  monthName: string;
  monthNum: number;
  year: number;
  time: string;
  lecturer: string;
  lecturerAvatar: string;
  coverImage: string;
  thumbnailVariant: 1 | 2 | 3;
  isPast: boolean;
  targetAudience: string;
  /** Pozadí levé „barevné“ části u kompaktního bloku s cover obrázkem (#rrggbb). */
  coverImageBgColor: string;
};

export type EmailWebinarPayloadV1 = {
  v: 1;
  layout: EmailWebinarLayout;
  snapshot: EmailWebinarSnapshot;
};

const SITE = 'https://www.vividbooks.com';
/** Stejné pozadí karty jako `WebinarCard` — spodní lišta + obal. */
const WEBINAR_CARD_BG = '#F0F2F8';

export const EMPTY_EMAIL_WEBINAR_SNAPSHOT: EmailWebinarSnapshot = {
  id: '',
  slug: '',
  title: 'Webinář',
  subtitle: '',
  day: 1,
  monthName: 'Leden',
  monthNum: 1,
  year: new Date().getFullYear(),
  time: '18:00',
  lecturer: '',
  lecturerAvatar: '',
  coverImage: '',
  thumbnailVariant: 3,
  isPast: false,
  targetAudience: '',
  coverImageBgColor: '#ffffff',
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function normalizeBackdropHex(input: string | undefined, fallback: string): string {
  const s = (input || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return fallback;
}

export function webinarDetailPath(snapshot: EmailWebinarSnapshot): string {
  const seg = encodeURIComponent((snapshot.slug || snapshot.id || '').trim() || 'webinar');
  return `${SITE}/webinar/${seg}`;
}

export function snapshotFromWebinar(w: Webinar): EmailWebinarSnapshot {
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
    thumbnailVariant: w.thumbnailVariant === 1 || w.thumbnailVariant === 2 ? w.thumbnailVariant : 3,
    isPast: w.isPast === true,
    targetAudience: String(w.targetAudience || '').trim(),
    coverImageBgColor: normalizeBackdropHex(w.coverImageBgColor, '#ffffff'),
  };
}

function normalizeSnapshot(raw: Partial<EmailWebinarSnapshot> | undefined): EmailWebinarSnapshot {
  const b = { ...EMPTY_EMAIL_WEBINAR_SNAPSHOT, ...raw };
  const tv = b.thumbnailVariant;
  const thumbnailVariant = tv === 1 || tv === 2 ? tv : 3;
  return {
    ...b,
    thumbnailVariant,
    day: Number(b.day) || 1,
    monthNum: Number(b.monthNum) || 1,
    year: Number(b.year) || new Date().getFullYear(),
    isPast: b.isPast === true,
    coverImageBgColor: normalizeBackdropHex(b.coverImageBgColor, '#ffffff'),
  };
}

export function encodeWebinarPayload(layout: EmailWebinarLayout, snapshot: EmailWebinarSnapshot): string {
  const payload: EmailWebinarPayloadV1 = {
    v: 1,
    layout,
    snapshot: normalizeSnapshot(snapshot),
  };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return btoa(JSON.stringify({ v: 1, layout: 'hero', snapshot: EMPTY_EMAIL_WEBINAR_SNAPSHOT }));
  }
}

export function decodeWebinarPayload(raw: string | null | undefined): {
  layout: EmailWebinarLayout;
  snapshot: EmailWebinarSnapshot;
} {
  if (!raw || !raw.trim()) {
    return { layout: 'hero', snapshot: { ...EMPTY_EMAIL_WEBINAR_SNAPSHOT } };
  }
  try {
    const json = JSON.parse(decodeURIComponent(escape(atob(raw.trim()))));
    const layout: EmailWebinarLayout = json.layout === 'compact' ? 'compact' : 'hero';
    const snapshot = normalizeSnapshot(json.snapshot);
    return { layout, snapshot };
  } catch {
    return { layout: 'hero', snapshot: { ...EMPTY_EMAIL_WEBINAR_SNAPSHOT } };
  }
}

/** Dekorativní pravá část náhledu (bez cover obrázku) — tabulkově pro e-mail klienty. */
function decorativeShapesTable(): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;height:200px;">` +
    `<tr>` +
    `<td width="52%" valign="top" bgcolor="#2ECC71" style="padding:0;background-color:#2ECC71;border-radius:0 90px 90px 0;">&nbsp;</td>` +
    `<td width="48%" valign="top" bgcolor="#001158" style="padding:0;background-color:#001158;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    `<tr><td bgcolor="#E74C3C" height="72" style="background-color:#E74C3C;font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td bgcolor="#001158" height="64" style="background-color:#001158;text-align:center;vertical-align:middle;">` +
    `<span style="display:inline-block;width:44px;height:44px;background:#ffffff;border-radius:6px;font-size:0;line-height:0;">&nbsp;</span>` +
    `</td></tr>` +
    `<tr><td bgcolor="#9B59B6" height="64" style="background-color:#9B59B6;font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `</table></td></tr></table>`
  );
}

/** Jednotná bílá datumovka (velký spodní pruh i kompaktní varianta). */
function webinarDateBadgeHtml(snapshot: EmailWebinarSnapshot, compact: boolean): string {
  const pad = compact ? '6px 8px' : '8px 10px';
  const dayFs = compact ? '16px' : '18px';
  return (
    `<div style="text-align:center;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:${pad};min-width:44px;">` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:${dayFs};line-height:1;color:#001158;">${snapshot.day}</div>` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#001158;opacity:0.65;line-height:1.1;margin-top:2px;">${escapeHtml(snapshot.monthName)}</div>` +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#FF8C00;line-height:1;margin-top:4px;">${escapeHtml(snapshot.time)}</div>` +
    `</div>`
  );
}

function ctaLabel(snapshot: EmailWebinarSnapshot): string {
  return snapshot.isPast ? 'Záznam' : 'Přihlásit se';
}

function metaDateLine(snapshot: EmailWebinarSnapshot): string {
  const mo = snapshot.monthName ? snapshot.monthName.slice(0, 3).toLowerCase() : '';
  return escapeHtml(`${snapshot.day}. ${mo}. ${snapshot.year} od ${snapshot.time}`);
}

function bottomBarRow(snapshot: EmailWebinarSnapshot): string {
  const href = safeAttr(webinarDetailPath(snapshot));
  const title = escapeHtml(snapshot.title);
  const cta = escapeHtml(ctaLabel(snapshot));
  const bg = WEBINAR_CARD_BG;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="border-collapse:collapse;width:100%;background-color:${bg};">` +
    `<tr>` +
    `<td valign="middle" bgcolor="${bg}" style="padding:14px 10px 14px 14px;width:56px;background-color:${bg};">` +
    `${webinarDateBadgeHtml(snapshot, false)}` +
    `</td>` +
    `<td valign="middle" bgcolor="${bg}" style="padding:14px 10px;background-color:${bg};font-family:Arial,Helvetica,sans-serif;">` +
    `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.3;color:#001158;">${title}</p>` +
    `</td>` +
    `<td valign="middle" align="right" bgcolor="${bg}" style="padding:14px 14px 14px 10px;white-space:nowrap;background-color:${bg};">` +
    `<a href="${href}" class="vb-webinar-cta" style="display:inline-block;background-color:#FF8C00;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;padding:12px 20px;border-radius:12px;text-decoration:none;box-shadow:0 2px 6px rgba(0,0,0,0.12);">${cta}</a>` +
    `</td></tr></table>`
  );
}

function heroTopTable(snapshot: EmailWebinarSnapshot): string {
  if (snapshot.coverImage) {
    const img = safeAttr(snapshot.coverImage);
    const alt = safeAttr(snapshot.title.slice(0, 120));
    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#001158;border-radius:16px 16px 0 0;overflow:hidden;">` +
      `<tr><td style="padding:0;line-height:0;font-size:0;">` +
      `<a href="${safeAttr(webinarDetailPath(snapshot))}" style="text-decoration:none;">` +
      `<img src="${img}" alt="${alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />` +
      `</a></td></tr></table>`
    );
  }

  const subtitle = snapshot.subtitle
    ? `<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;color:#001158;opacity:0.8;">${escapeHtml(snapshot.subtitle)}</p>`
    : '';
  const av = snapshot.lecturerAvatar
    ? `<img src="${safeAttr(snapshot.lecturerAvatar)}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border-radius:999px;border:2px solid rgba(0,17,88,0.15);object-fit:cover;margin-top:6px;" />`
    : '';
  const lect = snapshot.lecturer
    ? `<p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:#001158;line-height:1.2;">${escapeHtml(snapshot.lecturer)}</p>`
    : '';

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#001158;border-radius:16px 16px 0 0;">` +
    `<tr>` +
    `<td valign="top" width="58%" style="width:58%;background-color:#F5D645;padding:16px 14px;border-radius:0 20px 20px 0;vertical-align:top;">` +
    `<div>${subtitle}` +
    `<h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:900;line-height:1.15;color:#001158;">${escapeHtml(snapshot.title)}</h2></div>` +
    `<div style="margin-top:14px;">` +
    `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:#001158;">DVPP Webinář zdarma</p>` +
    `<p style="margin:2px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:#001158;">${metaDateLine(snapshot)}</p>` +
    `${lect}${av}` +
    `</div></td>` +
    `<td valign="top" width="42%" style="width:42%;padding:0;vertical-align:top;background-color:#001158;">${decorativeShapesTable()}</td>` +
    `</tr></table>`
  );
}

/** Zúžená dekorace vpravo u kompaktního bloku bez coveru (stejná estetika jako velký náhled). */
function compactDecorativeShapesTable(): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;height:132px;">` +
    `<tr>` +
    `<td width="48%" valign="top" bgcolor="#2ECC71" style="padding:0;background-color:#2ECC71;border-radius:0 48px 48px 0;">&nbsp;</td>` +
    `<td width="52%" valign="top" bgcolor="#001158" style="padding:0;background-color:#001158;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    `<tr><td bgcolor="#E74C3C" height="44" style="background-color:#E74C3C;font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `<tr><td bgcolor="#001158" height="44" style="background-color:#001158;text-align:center;vertical-align:middle;">` +
    `<span style="display:inline-block;width:28px;height:28px;background:#ffffff;border-radius:5px;font-size:0;line-height:0;">&nbsp;</span>` +
    `</td></tr>` +
    `<tr><td bgcolor="#9B59B6" height="44" style="background-color:#9B59B6;font-size:0;line-height:0;">&nbsp;</td></tr>` +
    `</table></td></tr></table>`
  );
}

function compactBlock(snapshot: EmailWebinarSnapshot): string {
  const href = safeAttr(webinarDetailPath(snapshot));
  const bg = WEBINAR_CARD_BG;
  const cta = escapeHtml(ctaLabel(snapshot));
  const thumbBackdrop = normalizeBackdropHex(snapshot.coverImageBgColor, '#ffffff');

  const leftCol = snapshot.coverImage
    ? `<a href="${href}" style="display:block;line-height:0;text-decoration:none;">` +
      `<img src="${safeAttr(snapshot.coverImage)}" alt="${safeAttr(snapshot.title.slice(0, 80))}" width="600" ` +
      `style="display:block;width:100%;max-width:100%;height:auto;margin:0;border:0;border-radius:16px 0 0 16px;" />` +
      `</a>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#001158;border-radius:16px 0 0 16px;overflow:hidden;">` +
      `<tr>` +
      `<td valign="top" width="64%" style="width:64%;background-color:#F5D645;padding:10px 8px 10px 10px;vertical-align:top;">` +
      (snapshot.subtitle
        ? `<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.25;color:#001158;opacity:0.85;">${escapeHtml(snapshot.subtitle)}</p>`
        : '') +
      `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;color:#001158;">DVPP Webinář zdarma</p>` +
      `<p style="margin:2px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;color:#001158;">${metaDateLine(snapshot)}</p>` +
      `</td>` +
      `<td valign="top" width="36%" style="width:36%;padding:0;vertical-align:top;background-color:#001158;">${compactDecorativeShapesTable()}</td>` +
      `</tr></table>`;

  const leftOuterBg = snapshot.coverImage ? thumbBackdrop : '#001158';

  const subtitle =
    snapshot.coverImage && snapshot.subtitle
      ? `<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.35;color:#001158;opacity:0.75;">${escapeHtml(snapshot.subtitle)}</p>`
      : '';
  const metaPlain = `${snapshot.day}. ${snapshot.monthName ? snapshot.monthName.slice(0, 3).toLowerCase() : ''}. ${snapshot.year} od `;
  const metaHtml =
    `<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;line-height:1.4;color:#001158;">` +
    `${escapeHtml(metaPlain)}` +
    `<span style="color:#FF8C00;font-weight:700;">${escapeHtml(snapshot.time)}</span>` +
    `</p>`;

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" ` +
    `style="border-collapse:collapse;background-color:${bg};border-radius:20px;overflow:hidden;border:1px solid #dde1e8;">` +
    `<tr>` +
    `<td valign="top" bgcolor="${leftOuterBg}" width="50%" ` +
    `style="width:50%;padding:0;vertical-align:top;background-color:${leftOuterBg};border-radius:16px 0 0 16px;">${leftCol}</td>` +
    `<td valign="middle" bgcolor="${bg}" width="50%" style="width:50%;padding:14px 16px 14px 14px;vertical-align:middle;background-color:${bg};">` +
    `<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.3;color:#001158;">${escapeHtml(snapshot.title)}</p>` +
    `${subtitle}` +
    `${metaHtml}` +
    `<a href="${href}" class="vb-webinar-cta" style="display:inline-block;background-color:#FF8C00;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;padding:8px 16px;border-radius:10px;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,0.1);">${cta}</a>` +
    `</td></tr></table>`
  );
}

export function buildWebinarInnerHtml(layout: EmailWebinarLayout, snapshot: EmailWebinarSnapshot): string {
  const s = normalizeSnapshot(snapshot);
  if (!s.id && !s.title.trim()) {
    return (
      `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;text-align:center;line-height:1.5;padding:16px 12px;">` +
      `Vyberte webinář v postranním panelu — náhled se promítne do mailu.` +
      `</p>`
    );
  }
  if (layout === 'compact') {
    return compactBlock(s);
  }
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${WEBINAR_CARD_BG};border-radius:20px;overflow:hidden;">` +
    `<tr><td style="padding:0;background-color:${WEBINAR_CARD_BG};">${heroTopTable(s)}</td></tr>` +
    `<tr><td bgcolor="${WEBINAR_CARD_BG}" style="padding:0;background-color:${WEBINAR_CARD_BG};border-top:1px solid #dde1e8;border-radius:0 0 20px 20px;">${bottomBarRow(s)}</td></tr>` +
    `</table>`
  );
}

export function buildWebinarBlockHtml(
  layout: EmailWebinarLayout,
  snapshot: EmailWebinarSnapshot,
  blockId: string,
): string {
  const s = normalizeSnapshot(snapshot);
  const d: EmailWebinarLayout = layout === 'compact' ? 'compact' : 'hero';
  const encoded = encodeWebinarPayload(d, s);
  const inner = buildWebinarInnerHtml(d, s);
  const id = safeAttr(blockId);
  const encAttr = safeAttr(encoded);
  const lay = safeAttr(d);
  return (
    `<div data-vb-block="webinar" data-email-webinar="true" data-vb-block-id="${id}" ` +
    `data-vb-wb-layout="${lay}" data-vb-wb-encoded="${encAttr}" ` +
    `style="padding:0;background:transparent;">${inner}</div>`
  );
}

export function readWebinarStateFromElement(el: Element | null): {
  layout: EmailWebinarLayout;
  snapshot: EmailWebinarSnapshot;
} {
  if (!el) {
    return { layout: 'hero', snapshot: { ...EMPTY_EMAIL_WEBINAR_SNAPSHOT } };
  }
  const raw = el.getAttribute('data-vb-wb-encoded');
  const layoutAttr = el.getAttribute('data-vb-wb-layout');
  const decoded = decodeWebinarPayload(raw);
  if (layoutAttr === 'compact' || layoutAttr === 'hero') {
    decoded.layout = layoutAttr;
  }
  return decoded;
}
