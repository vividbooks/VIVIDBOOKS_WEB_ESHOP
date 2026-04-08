import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Award, Download, ImageDown } from 'lucide-react';
import { toast } from 'sonner';
import type { Webinar } from '../data/webinars';
import logoPaths from '../imports/svg-fupfguvmdt';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER_EDGE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COOPER = { fontFamily: "'Cooper Light', serif" } as const;

/** Export PNG z náhledu — 4× oproti 1:1 CSS pixelům (ostřejší drobný text v patičce). */
const CERTIFICATE_PNG_PIXEL_RATIO = 4;

/** Stejné URL jako `src/styles/globals.css` — tisk/PDF z blob URL nezdědí globální CSS. */
const FONT_FACE_PRINT_BLOCK = `
    @font-face {
      font-family: 'Fenomen Sans';
      src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Book.otf') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Fenomen Sans';
      src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Semi%20Bold.otf') format('opentype');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Cooper Light';
      src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Cooper-Light.otf') format('opentype');
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }
`;

/** Údaje vystavitele — texty patičky; design se doladí později. */
const CERT_ORG = {
  representativeName: 'MgA. Vít Škop',
  representativeTitle: 'statutární zástupce vzdělávacího zařízení',
  companyName: 'Vividbooks s.r.o.',
  addressLine1: 'Nad Královskou oborou 33',
  addressLine2: 'Praha 7, 170 00',
} as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Pouze https — pro tisk/PDF z blob URL; prázdné = žádný obrázek. */
function certificateImageUrl(raw: string | undefined): string {
  const u = (raw || '').trim();
  return /^https:\/\//i.test(u) ? u : '';
}

/** Stejné SVG tvary jako `WebinarThumbnail` — tisk bez Reactu. */
const WEBINAR_SHAPE_SVG: Record<1 | 2 | 3, string> = {
  1: `<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="160" cy="40" r="60" fill="white" opacity="0.15"/><circle cx="120" cy="160" r="50" fill="white" opacity="0.12"/><ellipse cx="130" cy="100" rx="38" ry="38" fill="#F472B6" opacity="0.9"/><ellipse cx="130" cy="72" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="130" cy="128" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="102" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><ellipse cx="158" cy="100" rx="22" ry="22" fill="#F9A8D4" opacity="0.85"/><circle cx="130" cy="100" r="25" fill="#EC4899" opacity="0.95"/><circle cx="175" cy="165" r="55" fill="white" opacity="0.15"/><circle cx="30" cy="30" r="30" fill="white" opacity="0.08"/></svg>`,
  2: `<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="70" y="30" width="110" height="32" rx="4" fill="#9B59B6"/><rect x="70" y="68" width="110" height="32" rx="4" fill="#E74C3C"/><rect x="70" y="106" width="110" height="32" rx="4" fill="#E8E8E8"/><rect x="70" y="144" width="110" height="32" rx="4" fill="#2ECC71"/><circle cx="30" cy="50" r="20" fill="white" opacity="0.1"/><circle cx="20" cy="140" r="30" fill="white" opacity="0.08"/></svg>`,
  3: `<svg viewBox="0 0 200 200" class="cert-wt-shapes-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="145" cy="100" r="60" fill="#2ECC71" opacity="0.95"/><path d="M85 100 A60 60 0 0 1 145 40 L145 100 Z" fill="#27AE60" opacity="0.9"/><rect x="105" y="60" width="50" height="50" rx="4" fill="#E74C3C" opacity="0.9"/><rect x="120" y="115" width="35" height="35" rx="4" fill="white" opacity="0.9"/><circle cx="90" cy="150" r="20" fill="#3498DB" opacity="0.9"/><circle cx="165" cy="55" r="10" fill="#3498DB" opacity="0.85"/></svg>`,
};

/** Stejné logo jako v katalogu (`CatalogLayout` → `VividbooksLogo`) — inline SVG pro tisk/PDF bez externích souborů. */
const VIVID_CERT_LOGO_VIEWBOX = '0 0 1786.62 869.93';
const VIVID_CERT_LOGO_PATH_KEYS = [
  'p299c6b00',
  'p3cc4870',
  'p98d9300',
  'pf524b00',
  'p26e2d80',
  'p15998cf0',
  'p1bd3b900',
  'p19a24c00',
  'p34d64300',
  'p396dedf0',
] as const;

function buildVividbooksLogoSvgForCertificate(): string {
  const paths = VIVID_CERT_LOGO_PATH_KEYS.map((k) => {
    const d = (logoPaths as Record<string, string>)[k];
    return `<path d="${escapeHtml(d)}" fill="#001161"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIVID_CERT_LOGO_VIEWBOX}" fill="none" class="cert-logo-svg" aria-label="Vividbooks" role="img">${paths}</svg>`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Řádek typu „dne 3. 3. 2026 od 18.00“ z údajů webináře. */
function formatEventLineCs(w: Webinar): string {
  return `dne ${w.day}. ${pad2(w.monthNum)}. ${w.year} od ${(w.time || '—').replace(':', '.')}`;
}

/** Délka akce do textu (např. 90 min → 1,5 hodiny) — hrubá formulace, stačí pro patičku. */
function formatDurationHoursCs(minutes: number): string {
  const h = minutes / 60;
  const s = Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10).replace('.', ',');
  if (h === 1) return `${s} hodina`;
  if (h > 1 && h < 5) return `${s} hodiny`;
  return `${s} hodin`;
}

function formatBirthDateCs(iso: string): string {
  const p = iso.trim().split('-');
  if (p.length !== 3) return '';
  const y = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  const d = parseInt(p[2], 10);
  if (!y || !m || !d) return '';
  return `${d}. ${m}. ${y}`;
}

function formatIssuedPragueCs(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function buildPrintableCertificateDocument(opts: {
  webinar: Webinar;
  email: string;
  participantName: string;
  birthDateIso?: string;
  kind: 'dvpp' | 'feedback';
  /** Náhled v iframe — bez vynucené výšky na celou obrazovku. */
  previewMode?: boolean;
}): string {
  const { webinar, email, participantName, birthDateIso, kind, previewMode = false } = opts;
  /** Jedna stránka A4 na šířku: výška tiskové oblasti ≈ 210mm − okraje @page (viz @media print). */
  const sheetMinH = previewMode ? 'auto' : '186mm';
  const bodyPad = previewMode ? '10px' : '0';
  const vividbooksLogoSvg = buildVividbooksLogoSvgForCertificate();
  const title = escapeHtml(webinar.title);
  const lecturer = escapeHtml(webinar.lecturer || '');
  const when = escapeHtml(
    `${webinar.day}.\u00a0${webinar.monthName}\u00a0${webinar.year}, ${webinar.time}`,
  );
  const durationMin = typeof webinar.durationMinutes === 'number' ? webinar.durationMinutes : 120;
  const durationPhrase = formatDurationHoursCs(durationMin);
  const who = escapeHtml(participantName.trim() || email.trim() || 'účastník');
  const mail = escapeHtml(email.trim());
  const birth =
    birthDateIso && formatBirthDateCs(birthDateIso)
      ? escapeHtml(formatBirthDateCs(birthDateIso))
      : '';
  const issued = escapeHtml(formatIssuedPragueCs(new Date()));
  const eventLine = escapeHtml(formatEventLineCs(webinar));

  const head =
    kind === 'dvpp'
      ? 'Potvrzení o splnění ověření znalostí z webináře (DVPP)'
      : 'Potvrzení o vyplnění dotazníku po webináři';

  const bodyPara =
    kind === 'dvpp'
      ? `Tímto se potvrzuje, že níže uvedený účastník úspěšně absolvoval ověření znalostí z webináře v rozsahu vzdělávací akce zařazené do systému DVPP. Ověření bylo provedeno vyplněním dotazníku po skončení akce.`
      : `Tímto se potvrzuje vyplnění zpětné vazby po webináři níže uvedeným účastníkem. Doklad slouží pro vaši evidenci; nenahrazuje oficiální certifikát z akreditované dráhy, pokud ho škola vyžaduje samostatně.`;

  const footNote =
    kind === 'dvpp'
      ? `Toto potvrzení slouží jako doklad o splnění povinnosti ověření znalostí v rámci účasti na akci (dle pravidel vaší školy a platné legislativy). V případě dotazů kontaktujte organizátora na podpoře Vividbooks.`
      : `Tento doklad potvrzuje účast na zpětné vazbě. Pro oficiální certifikát DVPP použijte odkaz u webináře nebo pokyny od organizátora.`;

  const orgRep = escapeHtml(CERT_ORG.representativeName);
  const orgTitle = escapeHtml(CERT_ORG.representativeTitle);
  const orgCo = escapeHtml(CERT_ORG.companyName);
  const orgA1 = escapeHtml(CERT_ORG.addressLine1);
  const orgA2 = escapeHtml(CERT_ORG.addressLine2);

  /** Dynamická patička — data z webináře (4 sloupce). */
  const footerBlockDvpp = `
    <div class="footer-wrap footer-dvpp-full">
      <div class="footer-grid">
        <div class="footer-col">
          <p class="footer-h">Osv\u011bd\u010den\u00ed o \u00fa\u010dasti</p>
          <p class="footer-sub">V online vzd\u011bl\u00e1vac\u00edm programu:</p>
          <p class="footer-strong">${title}</p>
          <p class="footer-meta">${eventLine}</p>
        </div>
        <div class="footer-col footer-col-wide">
          <p class="footer-p">
            Program prob\u011bhl distan\u010dn\u00ed formou, v rozsahu <strong>${escapeHtml(durationPhrase)}</strong>.
            Lektorem webin\u00e1\u0159e byl <strong>${lecturer || '—'}</strong>.
            Program byl zakon\u010den dotazn\u00edkov\u00fdm \u0161et\u0159en\u00edm.
          </p>
        </div>
        <div class="footer-col">
          <p class="footer-p">${orgRep}</p>
          <p class="footer-p">V Praze dne ${issued}</p>
          <p class="footer-small">${orgTitle}</p>
        </div>
        <div class="footer-col">
          <p class="footer-strong">${orgCo}</p>
          <p class="footer-p">${orgA1}</p>
          <p class="footer-p">${orgA2}</p>
        </div>
      </div>
    </div>
  `;

  const footerBlockFeedback = `
    <div class="footer-wrap footer-simple">
      <p class="footer-p"><strong>${orgCo}</strong>, ${orgA1}, ${orgA2}</p>
      <p class="footer-small">Vydáno elektronicky: ${issued} — ${orgRep}, ${orgTitle}</p>
    </div>
  `;

  const birthRow =
    birth && kind === 'dvpp'
      ? `<div class="birth">Datum narození: <strong>${birth}</strong></div>`
      : '';

  const birthLineDvpp = birth || '—';

  const sheetOuterClass = `sheet${previewMode ? ' sheet-preview' : ''}${kind === 'dvpp' ? ' sheet-dvpp' : ' sheet-feedback'}`;

  /** Vpravo stejná dlaždice jako WebinarCard (thumbnail + lišta s datem; bez CTA). */
  const coverUrlRight = certificateImageUrl(webinar.coverImage);
  const avatarUrl = certificateImageUrl(webinar.lecturerAvatar);
  const monthShort = (webinar.monthName || '').trim().slice(0, 3).toLowerCase();
  const thumbDateLine = escapeHtml(
    `${webinar.day}. ${monthShort}. ${webinar.year} od ${(webinar.time || '—').replace(':', '.')}`,
  );
  const subEsc = escapeHtml((webinar.subtitle || '').trim());
  const shapeKey = (webinar.thumbnailVariant === 2 || webinar.thumbnailVariant === 3
    ? webinar.thumbnailVariant
    : 1) as 1 | 2 | 3;
  const rightVisualHtml = coverUrlRight
    ? `<img class="cert-wt-cover" src="${escapeHtml(coverUrlRight)}" alt="" />`
    : WEBINAR_SHAPE_SVG[shapeKey];
  const avatarHtml = avatarUrl
    ? `<img class="cert-wt-avatar" src="${escapeHtml(avatarUrl)}" alt="" />`
    : '';
  const subtitleBlock = subEsc ? `<p class="cert-wt-sub">${subEsc}</p>` : '';
  const lecturerBlock = lecturer
    ? `<p class="cert-wt-lecturer">${lecturer}</p>`
    : '';

  const monthNameBar = escapeHtml((webinar.monthName || '').trim());
  const timeBar = escapeHtml((webinar.time || '—').replace(':', '.'));
  const pillLecturer = lecturer ? `Lekto\u0159i: ${lecturer}` : '';
  const pillAudienceRaw = webinar.relatedSubjects?.[0] || webinar.tags?.[0];
  const pillAudience = pillAudienceRaw ? escapeHtml(String(pillAudienceRaw)) : '';
  const pillsHtml =
    pillLecturer || pillAudience
      ? `<div class="cert-wc-pills">${pillLecturer ? `<span class="cert-wc-pill">${pillLecturer}</span>` : ''}${
          pillAudience ? `<span class="cert-wc-pill">${pillAudience}</span>` : ''
        }</div>`
      : '';

  const thumbInnerBlock = coverUrlRight
    ? `<div class="cert-webinar-thumb cert-webinar-thumb-coveronly"><img class="cert-wt-cover-full" src="${escapeHtml(coverUrlRight)}" alt="" /></div>`
    : `<div class="cert-webinar-thumb">
        <div class="cert-wt-yellow">
          <div class="cert-wt-yellow-top">
            ${subtitleBlock}
            <p class="cert-wt-title">${title}</p>
          </div>
          <div class="cert-wt-yellow-bot">
            <p class="cert-wt-meta">DVPP Webin\u00e1\u0159 zdarma</p>
            <p class="cert-wt-meta">${thumbDateLine}</p>
            ${lecturerBlock}
            ${avatarHtml}
          </div>
        </div>
        <div class="cert-wt-right">${rightVisualHtml}</div>
      </div>`;

  const dvppBlock = `
  <div class="cert-inner cert-dvpp-frame">
    <div class="cert-dvpp-split">
      <div class="cert-content-col">
        <div class="cert-content-head">
          <div class="cert-logo-img-wrap">
            ${vividbooksLogoSvg}
          </div>
          <p class="cert-kicker">Vzd\u011bl\u00e1v\u00e1n\u00ed u\u010ditel\u016f</p>
          <h1 class="cert-main-title">Certifik\u00e1t DVPP</h1>
          <p class="cert-subtitle">Ov\u011b\u0159en\u00ed znalost\u00ed</p>
        </div>
        <div class="cert-participant-wrap">
          <div class="cert-participant">
            <p class="cert-participant-label">\u00da\u010dastn\u00edk</p>
            <p class="cert-name">${who}</p>
            <p class="cert-dob">Datum narozen\u00ed: <strong>${birthLineDvpp}</strong></p>
          </div>
        </div>
      </div>
      <div class="cert-wc-column" aria-hidden="true">
        <div class="cert-wc-card">
          <div class="cert-wc-thumb-wrap">
            ${thumbInnerBlock}
          </div>
          <div class="cert-wc-bar">
            <div class="cert-wc-date">
              <span class="cert-wc-day">${webinar.day}</span>
              <span class="cert-wc-mon">${monthNameBar}</span>
              <span class="cert-wc-time">${timeBar}</span>
            </div>
            <div class="cert-wc-bar-main">
              <p class="cert-wc-bar-title">${title}</p>
              ${pillsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
    ${footerBlockDvpp}
  </div>`;

  const feedbackBlock = `
    <div class="brand">Vividbooks — vzdělávání učitelů</div>
    <h1>${head}</h1>
    <div class="meta">
      <strong>Webinář:</strong> ${title}<br/>
      <strong>Datum konání:</strong> ${when}<br/>
      <strong>Lektor:</strong> ${lecturer || '—'}<br/>
      <strong>Odhadovaný rozsah akce:</strong> ${durationMin} min (${escapeHtml(durationPhrase)})
    </div>
    <p class="text">${bodyPara}</p>
    <div class="participant">
      <div class="label">Účastník</div>
      <div class="name">${who}</div>
      <div class="em">${mail}</div>
      ${birthRow}
    </div>
    <p class="text body-note">${footNote}</p>
    ${footerBlockFeedback}`;

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>${kind === 'dvpp' ? 'Certifik\u00e1t DVPP' : head}</title>
  <link rel="preconnect" href="https://iekkundgizzdbmkzatdl.supabase.co" crossorigin />
  <link rel="preload" href="https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Cooper-Light.otf" as="font" type="font/otf" crossorigin />
  <link rel="preload" href="https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Book.otf" as="font" type="font/otf" crossorigin />
  <style>
    ${FONT_FACE_PRINT_BLOCK}
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    html {
      height: 100%;
    }
    body {
      margin: 0;
      padding: ${bodyPad};
      min-height: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    strong { font-weight: 600; }
    .sheet {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: ${sheetMinH};
    }
    .sheet-feedback {
      border: 3px solid #001161;
      border-radius: 12px;
      padding: 22px 28px 18px;
      background: linear-gradient(180deg, #f8fafc 0%, #fff 36%);
      display: flex;
      flex-direction: column;
    }
    .sheet-dvpp {
      border: 3px solid #001161;
      border-radius: 14px;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      background: #fff;
    }
    .sheet-dvpp .cert-inner.cert-dvpp-frame {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      width: 100%;
    }
    .sheet-dvpp .cert-dvpp-split {
      flex: 1 1 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 0;
      width: 100%;
      align-items: stretch;
      gap: 0;
    }
    .sheet-dvpp .cert-wc-column {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: stretch;
      align-self: stretch;
      height: 100%;
      min-height: 0;
      min-width: 0;
      padding: 10px 12px 10px 6px;
      background: #f0f2f8;
    }
    .sheet-dvpp .cert-wc-card {
      flex: 0 0 auto;
      width: 100%;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      background: #f0f2f8;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 17, 88, 0.08);
    }
    /* Jako WebinarThumbnail: poměr 16∶9 */
    .sheet-dvpp .cert-wc-thumb-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      flex: 0 0 auto;
      overflow: hidden;
      background: #001158;
    }
    .sheet-dvpp .cert-webinar-thumb {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #001158;
    }
    .sheet-dvpp .cert-webinar-thumb-coveronly {
      position: absolute;
      inset: 0;
    }
    .sheet-dvpp .cert-wt-cover-full {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .sheet-dvpp .cert-wt-yellow {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 58%;
      z-index: 2;
      box-sizing: border-box;
      background: #f5d645;
      border-radius: 0 20px 20px 0;
      padding: 14px 12px 14px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wt-yellow-top { flex-shrink: 0; }
    .sheet-dvpp .cert-wt-yellow-bot { flex-shrink: 0; }
    .sheet-dvpp .cert-wt-sub {
      margin: 0 0 6px;
      font-size: 11px;
      line-height: 1.25;
      color: #001158;
      opacity: 0.75;
      font-weight: 500;
    }
    .sheet-dvpp .cert-wt-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      line-height: 1.12;
      color: #001158;
      letter-spacing: -0.02em;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      overflow: hidden;
    }
    .sheet-dvpp .cert-wt-meta {
      margin: 0 0 4px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.35;
      color: #001158;
    }
    .sheet-dvpp .cert-wt-lecturer {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.3;
      color: #001158;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-dvpp .cert-wt-avatar {
      width: 44px;
      height: 44px;
      border-radius: 999px;
      object-fit: cover;
      border: 2px solid rgba(0, 17, 88, 0.22);
      display: block;
    }
    .sheet-dvpp .cert-wt-right {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 48%;
      z-index: 1;
      overflow: hidden;
      background: #001158;
    }
    .sheet-dvpp .cert-wt-cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .sheet-dvpp .cert-wt-shapes-svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    /* Spodní lišta jako WebinarCard (bez tlačítka) */
    .sheet-dvpp .cert-wc-bar {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px 12px;
      background: transparent;
    }
    .sheet-dvpp .cert-wc-date {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fff;
      border-radius: 10px;
      padding: 6px 10px;
      min-width: 46px;
    }
    .sheet-dvpp .cert-wc-day {
      font-size: 18px;
      font-weight: 800;
      color: #001158;
      line-height: 1;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wc-mon {
      font-size: 10px;
      color: rgba(0, 17, 88, 0.55);
      line-height: 1.2;
      text-align: center;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wc-time {
      font-size: 11px;
      font-weight: 700;
      color: #ff8c00;
      line-height: 1;
      margin-top: 4px;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-wc-bar-main {
      flex: 1 1 auto;
      min-width: 0;
    }
    .sheet-dvpp .cert-wc-bar-title {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      color: #001158;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
    }
    .sheet-dvpp .cert-wc-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .sheet-dvpp .cert-wc-pill {
      font-size: 8px;
      font-weight: 600;
      padding: 4px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      color: #001158;
      background: #fff;
      line-height: 1.2;
      font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
    }
    .sheet-dvpp .cert-content-col {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 12px 12px 8px 14px;
      border-right: 1px solid rgba(0, 17, 97, 0.1);
      background: #fff;
    }
    .sheet-dvpp .footer-wrap.footer-dvpp-full {
      margin-top: auto;
      padding: 10px 14px 12px;
      width: 100%;
      flex-shrink: 0;
    }
    .sheet-dvpp .footer-dvpp-full .footer-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 0.95fr) minmax(0, 1fr);
      gap: 10px 14px;
      font-size: 9px;
    }
    .sheet-dvpp .cert-content-head {
      text-align: center;
      flex-shrink: 0;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(0, 17, 97, 0.12);
    }
    .sheet-dvpp .cert-logo-img-wrap {
      margin: 0 auto 10px;
      text-align: center;
    }
    .sheet-dvpp .cert-logo-svg {
      display: block;
      margin: 0 auto;
      width: 100%;
      max-width: 150px;
      height: auto;
    }
    .sheet-dvpp .cert-kicker {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #6366f1;
    }
    .sheet-dvpp .cert-main-title {
      margin: 0 0 6px;
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 28px;
      font-weight: 300;
      line-height: 1.15;
      color: #001161;
      font-synthesis: none;
    }
    .sheet-dvpp .cert-subtitle {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      letter-spacing: 0.02em;
    }
    .sheet-dvpp .cert-participant-wrap {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 12px 0;
    }
    .sheet-dvpp .cert-participant {
      width: 100%;
      margin: 0;
      padding: 16px 18px;
      text-align: center;
      background: #fff;
      border-radius: 12px;
      border: 1px solid rgba(0, 17, 97, 0.12);
      box-shadow: none;
      border-left: 5px solid #f5d645;
    }
    .sheet-dvpp .cert-participant-label {
      margin: 0 0 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #64748b;
    }
    .sheet-dvpp .cert-name {
      margin: 0 0 8px;
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 22px;
      font-weight: 300;
      color: #001161;
      line-height: 1.2;
      font-synthesis: none;
    }
    .sheet-dvpp .cert-dob {
      margin: 0;
      font-size: 12px;
      color: #475569;
      line-height: 1.45;
    }
    .brand { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #001161; font-weight: 600; margin-bottom: 8px; }
    h1 {
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 20px;
      font-weight: 300;
      line-height: 1.25;
      margin: 0 0 14px;
      color: #001161;
    }
    .meta { font-size: 12px; color: #475569; margin-bottom: 12px; line-height: 1.5; }
    .meta strong { color: #0f172a; }
    p.text {
      font-size: 12px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 12px;
    }
    .participant {
      margin: 14px 0;
      padding: 14px 16px;
      background: #e8ebf4;
      border-radius: 10px;
      border-left: 4px solid #001161;
    }
    .participant .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px; }
    .participant .name {
      font-family: 'Cooper Light', Georgia, serif;
      font-size: 17px;
      font-weight: 300;
      color: #001161;
    }
    .participant .em { font-size: 12px; color: #475569; margin-top: 4px; }
    .birth { font-size: 12px; color: #334155; margin-top: 8px; }
    .body-note { font-size: 11px; margin-top: 8px; }
    .footer-wrap {
      margin-top: auto;
      padding: 14px 22px 18px;
      border-top: 2px solid #c7d2fe;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 0.95fr) minmax(0, 1fr);
      gap: 10px 14px;
      align-items: start;
      font-size: 9px;
      line-height: 1.35;
      color: #1e293b;
    }
    .footer-h {
      margin: 0 0 4px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #001161;
    }
    .footer-sub { margin: 0 0 2px; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .footer-strong { margin: 0 0 4px; font-weight: 700; font-size: 10px; }
    .footer-meta { margin: 0; font-size: 9px; color: #475569; }
    .footer-p { margin: 0 0 6px; }
    .footer-p strong { color: #0f172a; }
    .footer-small { margin: 0; font-size: 8px; color: #64748b; }
    .footer-col-wide .footer-p { font-size: 9px; }
    .footer-simple { font-size: 10px; color: #475569; }
    .footer-simple .footer-p { margin: 0 0 6px; }
    .sheet-preview.sheet-feedback .footer-wrap,
    .sheet-preview .footer-wrap {
      margin-top: 16px;
    }
    .sheet-dvpp.sheet-preview .cert-inner.cert-dvpp-frame {
      min-height: 400px;
    }
    @media print {
      html, body {
        height: 100%;
      }
      .footer-grid { break-inside: avoid; }
      .sheet-dvpp {
        min-height: 186mm;
        page-break-inside: avoid;
      }
      .sheet-dvpp .cert-inner.cert-dvpp-frame {
        break-inside: avoid;
        min-height: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="${sheetOuterClass}">
    ${kind === 'dvpp' ? dvppBlock : feedbackBlock}
  </div>
</body>
</html>`;
}

function CertificatePreviewIframe({
  srcDoc,
  className = '',
  iframeRef,
}: {
  srcDoc: string;
  className?: string;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}) {
  return (
    <div className={`w-full text-left ${className}`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#001161]/50">
        {'N\u00e1hled'}
      </p>
      <div className="overflow-hidden rounded-xl border border-[#001161]/12 bg-slate-100 shadow-inner">
        <iframe
          ref={iframeRef}
          title="Náhled potvrzení"
          srcDoc={srcDoc}
          className="block aspect-[297/210] h-auto w-full border-0 bg-white"
        />
      </div>
      <p style={FF} className="mt-2 text-center text-[11px] text-[#001161]/45">
        {'Stejn\u00e9 zobrazen\u00ed jako p\u0159i tisku nebo PDF'}
      </p>
    </div>
  );
}

export function WebinarDvppCertificateSuccess({
  webinar,
  email,
  participantName = '',
  variant = 'default',
  certificateKind,
}: {
  webinar: Webinar;
  email: string;
  participantName?: string;
  variant?: 'default' | 'fullscreen';
  /** `dvpp` = text o ověření znalostí; `feedback` = jen dotazník bez DVPP kvízu. */
  certificateKind: 'dvpp' | 'feedback';
}) {
  const fs = variant === 'fullscreen';

  const needProfile = certificateKind === 'dvpp';
  const [profileOpen, setProfileOpen] = useState(needProfile);
  const [displayName, setDisplayName] = useState(() => (participantName || '').trim());
  const [birthDateIso, setBirthDateIso] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [pngDownloading, setPngDownloading] = useState(false);
  const certificateIframeRef = useRef<HTMLIFrameElement>(null);

  const birthOk = useMemo(() => {
    if (!needProfile) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(birthDateIso.trim());
  }, [needProfile, birthDateIso]);

  const canContinue = displayName.trim().length > 0 && birthOk;

  const previewSrcDoc = useMemo(
    () =>
      buildPrintableCertificateDocument({
        webinar,
        email,
        participantName: displayName.trim() || participantName,
        birthDateIso: needProfile ? birthDateIso.trim() : undefined,
        kind: certificateKind,
        previewMode: true,
      }),
    [webinar, email, participantName, displayName, birthDateIso, certificateKind, needProfile],
  );

  const downloadCertificatePng = useCallback(async () => {
    const iframe = certificateIframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) {
      toast.error('Náhled ještě není připraven — zkuste za chvíli znovu.');
      return;
    }
    const sheet = doc.querySelector('.sheet') as HTMLElement | null;
    if (!sheet) {
      toast.error('Certifikát v náhledu nebyl nalezen.');
      return;
    }
    setPngDownloading(true);
    try {
      await doc.fonts?.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(sheet, {
        pixelRatio: CERTIFICATE_PNG_PIXEL_RATIO,
        cacheBust: true,
        backgroundColor: '#ffffff',
      });
      const slug = String(webinar.slug || webinar.id || 'webinar').replace(/[^a-zA-Z0-9-_]+/g, '-');
      const a = document.createElement('a');
      a.download = `certifikat-dvpp-${slug}.png`;
      a.href = dataUrl;
      a.rel = 'noopener';
      a.click();
    } catch (e) {
      console.error('[certificate] PNG export', e);
      toast.error(e instanceof Error ? e.message : 'PNG se nepodařilo vytvořit.');
    } finally {
      setPngDownloading(false);
    }
  }, [webinar.id, webinar.slug]);

  const openPrintablePdf = useCallback(() => {
    const html = buildPrintableCertificateDocument({
      webinar,
      email,
      participantName: displayName.trim() || participantName,
      birthDateIso: needProfile ? birthDateIso.trim() : undefined,
      kind: certificateKind,
    });
    /** `about:blank` + `document.write` bývá v novém okně prázdné (noopener / CSP). Blob URL je spolehlivější. */
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      URL.revokeObjectURL(url);
      return;
    }
    let printed = false;
    const schedulePrint = () => {
      if (printed) return;
      printed = true;
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }, 1500);
    };
    w.addEventListener('load', schedulePrint, { once: true });
    window.setTimeout(schedulePrint, 600);
  }, [webinar, email, participantName, displayName, birthDateIso, certificateKind, needProfile]);

  const saveCertificateProfileToServer = useCallback(async (): Promise<boolean> => {
    if (!needProfile) return true;
    setProfileSaveError('');
    setProfileSaving(true);
    try {
      const res = await fetch(`${SERVER_EDGE}/webinar-dvpp-certificate-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          webinarId: String(webinar.id ?? '').trim(),
          email: email.trim(),
          participantName: displayName.trim(),
          birthDateIso: birthDateIso.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return true;
    } catch (e) {
      setProfileSaveError(e instanceof Error ? e.message : 'Chyba');
      return false;
    } finally {
      setProfileSaving(false);
    }
  }, [needProfile, webinar.id, email, displayName, birthDateIso]);

  if (profileOpen && needProfile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={
          fs
            ? 'flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-10'
            : 'w-full mt-6 border-t border-[#001161]/10 pt-8'
        }
      >
        <div className={fs ? 'w-full max-w-md' : 'mx-auto w-full max-w-[480px]'}>
          <h2 style={COOPER} className="text-[18px] font-normal text-[#001161] sm:text-[20px]">
            {'Údaje pro certifikát'}
          </h2>
          <p style={FF} className="mt-2 text-[13px] leading-relaxed text-[#001161]/70">
            {
              'Zkontrolujte jméno a doplňte datum narození. Údaje se uloží pro certifikát (bez nutnosti být registrovaný na webinář). Mailchimp se doplní jen pokud tam už kontakt máte. Propíšou se do tisku a PDF.'
            }
          </p>
          <div className="mt-6 flex flex-col gap-4 text-left">
            <label style={FF} className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">
                {'Jméno a příjmení'}
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40"
                autoComplete="name"
              />
            </label>
            <label style={FF} className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">{'E-mail'}</span>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-[#001161]/10 bg-slate-50 px-4 py-3 text-[15px] text-[#001161]/70"
              />
            </label>
            <label style={FF} className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">
                {'Datum narození'} <span className="text-red-600">*</span>
              </span>
              <input
                type="date"
                value={birthDateIso}
                onChange={(e) => setBirthDateIso(e.target.value)}
                className="w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40"
                required
              />
            </label>
          </div>
        </div>
        <CertificatePreviewIframe
          srcDoc={previewSrcDoc}
          iframeRef={certificateIframeRef}
          className="mx-auto mt-8 w-full max-w-[min(920px,100%)] px-0"
        />
        <div className="mx-auto mt-4 flex w-full max-w-[min(920px,100%)] justify-center px-0">
          <button
            type="button"
            onClick={() => void downloadCertificatePng()}
            disabled={pngDownloading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#001161]/20 bg-white px-5 py-2.5 text-[13px] font-semibold text-[#001161] shadow-sm transition hover:bg-[#001161]/5 disabled:cursor-not-allowed disabled:opacity-50"
            style={FF}
          >
            <ImageDown className="h-4 w-4 shrink-0" />
            {pngDownloading ? 'Generuji PNG…' : 'Stáhnout PNG (4× rozlišení)'}
          </button>
        </div>
        <div className={fs ? 'w-full max-w-md' : 'mx-auto w-full max-w-[480px]'}>
          {profileSaveError ? (
            <p style={FF} className="mt-4 text-[12px] text-red-600">
              {profileSaveError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canContinue || profileSaving}
            onClick={async () => {
              const ok = await saveCertificateProfileToServer();
              if (ok) setProfileOpen(false);
            }}
            className="mt-6 w-full rounded-xl bg-[#001161] px-6 py-3 text-[15px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={FF}
          >
            {profileSaving ? 'Ukládám…' : 'Pokračovat k potvrzení a PDF'}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={
        fs
          ? 'flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10'
          : 'w-full mt-6 border-t border-[#001161]/10 pt-8'
      }
    >
      <div
        className={
          fs
            ? 'w-full max-w-[min(920px,100%)] text-center'
            : 'mx-auto w-full max-w-[min(920px,100%)] text-center'
        }
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#001161]/8">
          <Award className="h-9 w-9 text-[#001161]" strokeWidth={1.5} />
        </div>
        <h2 style={COOPER} className="text-[20px] font-normal leading-snug text-[#001161] sm:text-[22px]">
          {certificateKind === 'dvpp'
            ? 'Hotovo — máte splněné ověření znalostí (DVPP)'
            : 'Děkujeme za vyplnění dotazníku'}
        </h2>
        <p style={FF} className="mt-3 text-[14px] leading-relaxed text-[#001161]/70">
          {certificateKind === 'dvpp'
            ? 'Níže je náhled stejný jako při tisku / PDF. PNG lze stáhnout ve vysokém rozlišení (4×); PDF přes tisk v prohlížeči (Uložit jako PDF).'
            : 'Níže je náhled; můžete vytisknout nebo uložit potvrzení o vyplnění zpětné vazby (PNG ve 4× rozlišení nebo PDF přes tisk).'}
        </p>

        <CertificatePreviewIframe
          srcDoc={previewSrcDoc}
          iframeRef={certificateIframeRef}
          className="mx-auto mt-8"
        />

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={openPrintablePdf}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:scale-[1.02]"
            style={FF}
          >
            <Download className="h-4 w-4 shrink-0" />
            {'Stáhnout PDF (tisk → Uložit jako PDF)'}
          </button>
          <button
            type="button"
            onClick={() => void downloadCertificatePng()}
            disabled={pngDownloading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#001161]/12 bg-white px-6 py-3 text-[14px] font-bold text-[#001161] shadow-sm transition hover:bg-[#001161]/5 disabled:cursor-not-allowed disabled:opacity-50"
            style={FF}
          >
            <ImageDown className="h-4 w-4 shrink-0" />
            {pngDownloading ? 'Generuji PNG…' : 'Stáhnout PNG (4× rozlišení)'}
          </button>
        </div>
        {needProfile ? (
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="mt-4 text-[13px] font-semibold text-[#001161]/50 underline-offset-2 hover:text-[#001161]/80 hover:underline"
            style={FF}
          >
            {'Upravit údaje pro certifikát'}
          </button>
        ) : null}
        <p style={FF} className="mt-4 text-[12px] text-[#001161]/45">
          {
            'V Chrome nebo Edge v okně tisku zvolte „Uložit jako PDF“. Obsah potvrzení odpovídá údajům o webináři a vaší registraci.'
          }
        </p>
      </div>
    </motion.div>
  );
}
