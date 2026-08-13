/**
 * Jednotný vizuál transakčních e-mailů (objednávky, poptávky, DVPP…) —
 * stejná navy hlavička + logo + zaoblená karta jako u webinářových mailů.
 */

export const VB_EMAIL_NAVY = '#001161';
export const VB_EMAIL_ORANGE = '#E8942A';
export const VB_EMAIL_CANVAS = '#f5f6fa';
export const VB_EMAIL_CARD_RADIUS = '20px';
export const VB_EMAIL_LOGO_PX = 66;

export function vividbooksEmailLogoUrl(): string {
  const fromEnv = Deno.env.get('EMAIL_HEADER_LOGO_URL')?.trim();
  if (fromEnv) return fromEnv;
  return 'https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/logo_vividbooks.png';
}

function getPublicSiteOriginFallback(): string {
  const raw = (Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || '').trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'https://www.vividbooks.com';
}

function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Vycentrované logo + uppercase podnadpis (webinářový vzor). */
export function buildVividbooksBrandHeaderRow(
  subtitlePlain: string,
  opts?: { headerPadding?: string; headerRadius?: string },
): string {
  const logoSrc = escAttr(vividbooksEmailLogoUrl());
  const site = escAttr(getPublicSiteOriginFallback());
  const sub = escAttr(subtitlePlain);
  const padding = opts?.headerPadding ?? '22px 24px 20px';
  const radius = opts?.headerRadius ?? `${VB_EMAIL_CARD_RADIUS} ${VB_EMAIL_CARD_RADIUS} 0 0`;
  const w = VB_EMAIL_LOGO_PX;
  // Bez bílého čipu — tyto maily mají EMAIL_FORCE_LIGHT_HEAD (light only).
  return `<tr><td class="vb-force-light-header dm-header" style="background:${VB_EMAIL_NAVY};padding:${padding};border-radius:${radius};text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 12px;">
<a class="vb-email-logo-wrap" href="${site}" style="text-decoration:none;border:0;display:inline-block;line-height:0;">
<img class="vb-email-logo" src="${logoSrc}" alt="Vividbooks" width="${w}" style="display:block;margin:0 auto;width:${w}px;max-width:${w}px;height:auto;border:0;outline:none;" />
</a>
</td></tr><tr><td align="center" style="padding:0;">
<p style="margin:0;color:rgba(255,255,255,0.65);font-size:11px;text-transform:uppercase;letter-spacing:2px;">${sub}</p>
</td></tr></table>
</td></tr>`;
}

/** Oranžové pill CTA jako u webinářů. */
export function buildVividbooksBrandCta(href: string, label: string): string {
  return `<a href="${escAttr(href)}" style="display:inline-block;background:${VB_EMAIL_ORANGE};color:#ffffff !important;font-weight:800;font-size:15px;padding:14px 28px;border-radius:100px;text-decoration:none;">${escAttr(label)}</a>`;
}

export type VividbooksBrandShellOpts = {
  /** <title> */
  title: string;
  /** Uppercase podnadpis v navy hlavičce */
  headerSubtitle: string;
  /** HTML těla (uvnitř bílé karty) */
  content: string;
  /** Volitelný HTML do patičky (default kontakt) */
  footerHtml?: string;
  /** Vložit do <head> (typicky EMAIL_FORCE_LIGHT_HEAD) */
  headExtra?: string;
};

/**
 * Plná HTML zpráva: canvas + zaoblená karta + logo hlavička + obsah + patička.
 */
export function buildVividbooksBrandShell(opts: VividbooksBrandShellOpts): string {
  const year = new Date().getFullYear();
  const footer =
    opts.footerHtml ??
    `<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
Máte dotaz? Napište nám na <a href="mailto:hello@vividbooks.com" style="color:${VB_EMAIL_NAVY};font-weight:700;text-decoration:underline;">hello@vividbooks.com</a><br/>
&copy; ${year} Vividbooks
</p>`;

  return `<!DOCTYPE html>
<html lang="cs" style="color-scheme:light only;">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escAttr(opts.title)}</title>
${opts.headExtra || ''}
</head>
<body class="vb-force-light" style="margin:0;padding:0;background:${VB_EMAIL_CANVAS};font-family:Arial,Helvetica,sans-serif;color:#1a1a22;color-scheme:light only;">
<table role="presentation" class="vb-force-light" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${VB_EMAIL_CANVAS};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" class="vb-force-light-card" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:${VB_EMAIL_CARD_RADIUS};overflow:hidden;box-shadow:0 4px 24px rgba(0,17,97,0.08);">
${buildVividbooksBrandHeaderRow(opts.headerSubtitle)}
<tr><td class="vb-force-light-text" style="padding:36px 36px 28px;background:#ffffff;color:#1a1a22;font-size:15px;line-height:1.65;">
${opts.content}
</td></tr>
<tr><td class="vb-force-light-muted" style="background:#f8f9fc;padding:20px 36px;border-top:1px solid #edf2f7;">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
