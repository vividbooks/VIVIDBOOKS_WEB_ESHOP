import type { Webinar } from '../data/webinars';
import logoPaths from '../imports/svg-fupfguvmdt';

/**
 * Tisknutelný certifikát z webináře (A4 na šířku) jako samostatný HTML dokument.
 *
 * Dokument je záměrně bez jakýchkoli externích obrázků a bez layoutu, který se láme
 * při přerenderování (`aspect-ratio`, `-webkit-line-clamp`, vložené screenshoty karet).
 * Sází se na přesnou tiskovou velikost, takže náhled v iframe i tisk do PDF dávají
 * stejný výsledek.
 */

export type CertificateKind = 'dvpp' | 'feedback';

/** Údaje vystavitele — patička certifikátu. */
export const CERT_ORG = {
  representativeName: 'MgA. Vít Škop',
  representativeTitle: 'statutární zástupce vzdělávacího zařízení',
  companyName: 'Vividbooks s.r.o.',
  addressLine1: 'Nad Královskou oborou 33',
  addressLine2: 'Praha 7, 170 00',
} as const;

/** Stejné URL jako `src/styles/globals.css` — tisk z blob URL nezdědí globální CSS. */
const FONT_FACE_BLOCK = `
  @font-face {
    font-family: 'Fenomen Sans';
    src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Book.otf') format('opentype');
    font-weight: 400;
    font-style: normal;
    font-display: block;
  }
  @font-face {
    font-family: 'Fenomen Sans';
    src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Fenomen%20Sans%20Semi%20Bold.otf') format('opentype');
    font-weight: 600;
    font-style: normal;
    font-display: block;
  }
  @font-face {
    font-family: 'Cooper Light';
    src: url('https://iekkundgizzdbmkzatdl.supabase.co/storage/v1/object/public/Admin%20math/Cooper-Light.otf') format('opentype');
    font-weight: 300;
    font-style: normal;
    font-display: block;
  }
`;

const LOGO_VIEWBOX = '0 0 1786.62 869.93';
const LOGO_PATH_KEYS = [
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLogoSvg(): string {
  const paths = LOGO_PATH_KEYS.map((k) => {
    const d = (logoPaths as Record<string, string>)[k];
    return `<path d="${escapeHtml(d)}" fill="#001161"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}" fill="none" class="cert-logo" role="img" aria-label="Vividbooks">${paths}</svg>`;
}

/** Např. „1. 9. 2026 od 18.00“. */
function formatEventLineCs(w: Webinar): string {
  return `${w.day}. ${w.monthNum}. ${w.year} od ${(w.time || '—').replace(':', '.')}`;
}

/** Délka akce slovy (90 min → „1,5 hodiny“). */
export function formatDurationHoursCs(minutes: number): string {
  const h = minutes / 60;
  const s = Number.isInteger(h) ? String(h) : String(Math.round(h * 10) / 10).replace('.', ',');
  if (h === 1) return `${s} hodina`;
  if (h > 1 && h < 5) return `${s} hodiny`;
  return `${s} hodin`;
}

export function formatBirthDateCs(iso: string): string {
  const p = iso.trim().split('-');
  if (p.length !== 3) return '';
  const y = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  const d = parseInt(p[2], 10);
  if (!y || !m || !d) return '';
  return `${d}. ${m}. ${y}`;
}

function formatIssuedPragueCs(d: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    d,
  );
}

/**
 * Číslo osvědčení — deterministické z webináře a e-mailu, aby opakované stažení
 * dalo stejné číslo a školy měly certifikát podle čeho dohledat.
 */
export function certificateNumber(
  kind: CertificateKind,
  webinar: Webinar,
  email: string,
): string {
  const seed = `${String(webinar.id ?? '')}|${email.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  const code = Math.abs(h).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return `VB-${kind === 'dvpp' ? 'DVPP' : 'ZV'}-${webinar.year}-${code}`;
}

const CERT_CSS = `
* { box-sizing: border-box; }
html {
  background: #ffffff;
  color-scheme: only light;
}
body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  font-family: 'Fenomen Sans', ui-sans-serif, system-ui, sans-serif;
  color: #001161;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
strong { font-weight: 600; }
.cooper { font-family: 'Cooper Light', Georgia, serif; font-weight: 300; font-synthesis: none; }

.page {
  width: 297mm;
  height: 210mm;
  padding: 8mm;
  background: #ffffff;
  display: flex;
  overflow: hidden;
}
.frame {
  flex: 1 1 auto;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12mm 16mm 10mm;
  background: #ffffff;
  border: 1.5px solid #001161;
  border-radius: 3px;
}
.frame::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 6px;
  background: #f5d645;
}
.frame::after {
  content: '';
  position: absolute;
  inset: 3.5mm;
  border: 0.75px solid rgba(0, 17, 97, 0.16);
  border-radius: 1px;
  pointer-events: none;
}

.cert-top {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.cert-logo { display: block; width: 148px; height: auto; }
.cert-kicker {
  margin: 6px 0 0;
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: rgba(0, 17, 97, 0.5);
}
.cert-badge { text-align: right; }
.cert-pill {
  display: inline-block;
  padding: 6px 13px;
  border-radius: 999px;
  background: #001161;
  color: #ffffff;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.cert-no {
  margin: 8px 0 0;
  font-size: 8.5px;
  letter-spacing: 0.06em;
  color: rgba(0, 17, 97, 0.45);
}

.cert-mid {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3mm 0 1mm;
}
.cert-title { margin: 0; font-size: 60px; line-height: 1; letter-spacing: -0.015em; }
.cert-title-sub {
  margin: 12px 0 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(0, 17, 97, 0.55);
}
.cert-rule { width: 56px; height: 3px; margin: 18px 0 20px; background: #f5d645; }
.cert-lead { margin: 0; font-size: 12px; letter-spacing: 0.04em; color: rgba(0, 17, 97, 0.55); }
.cert-name { margin: 10px 0 0; font-size: 46px; line-height: 1.1; color: #001161; }
.cert-nameline { width: 130mm; height: 1px; margin: 14px 0 10px; background: rgba(0, 17, 97, 0.16); }
.cert-dob { margin: 0; font-size: 11.5px; color: rgba(0, 17, 97, 0.55); }
.cert-body { margin: 20px 0 0; font-size: 12px; color: rgba(0, 17, 97, 0.55); }
.cert-program {
  margin: 8px 0 0;
  max-width: 200mm;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.26;
  letter-spacing: -0.012em;
}
.cert-meta { margin: 14px 0 0; font-size: 11.5px; line-height: 1.75; color: rgba(0, 17, 97, 0.62); }
.cert-meta strong { color: #001161; }
.cert-note { margin: 12px 0 0; font-size: 10px; color: rgba(0, 17, 97, 0.42); }

.cert-foot {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10mm;
  align-items: end;
  padding-top: 6mm;
  border-top: 1px solid rgba(0, 17, 97, 0.1);
}
.cert-fcol { font-size: 9px; line-height: 1.55; color: rgba(0, 17, 97, 0.6); }
.cert-fh {
  margin: 0 0 5px;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(0, 17, 97, 0.4);
}
.cert-fcol strong { font-size: 10px; color: #001161; }
.cert-sig { text-align: right; }
.cert-sigline { width: 52mm; height: 1px; margin: 0 0 6px auto; background: rgba(0, 17, 97, 0.28); }
.cert-signame { font-size: 11px; font-weight: 600; color: #001161; }

.cert-seal {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 2mm;
  border-radius: 999px;
  background: #001161;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}
.cert-seal::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  border: 1px solid rgba(245, 214, 69, 0.55);
}
.cert-seal-1 {
  font-size: 6.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}
.cert-seal-2 { font-size: 17px; font-weight: 600; letter-spacing: 0.02em; color: #ffffff; }
.cert-seal-3 {
  font-size: 6.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #f5d645;
}

@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #ffffff !important; }
  .page { page-break-inside: avoid; break-inside: avoid; }
}
`;

export interface CertificateDocumentInput {
  webinar: Webinar;
  email: string;
  participantName?: string;
  /** YYYY-MM-DD; u `feedback` se nepoužívá. */
  birthDateIso?: string;
  kind: CertificateKind;
  /** Datum vydání — kvůli testovatelnosti lze předat. */
  issuedAt?: Date;
}

const COPY: Record<
  CertificateKind,
  {
    pill: string;
    title: string;
    titleSub: string;
    lead: string;
    body: string;
    note: string;
    seal: [string, string, string];
  }
> = {
  dvpp: {
    pill: 'Osvědčení DVPP',
    title: 'Certifikát',
    titleSub: 'o účasti v online vzdělávacím programu',
    lead: 'Potvrzujeme, že',
    body: 'absolvoval(a) online vzdělávací program',
    note: 'Program byl zakončen dotazníkovým šetřením a ověřením znalostí.',
    seal: ['Vividbooks', 'DVPP', 'ověřeno'],
  },
  feedback: {
    pill: 'Potvrzení o účasti',
    title: 'Potvrzení',
    titleSub: 'o účasti na webináři a vyplnění zpětné vazby',
    lead: 'Potvrzujeme, že',
    body: 'se zúčastnil(a) online webináře',
    note: 'Potvrzení dokládá účast a vyplnění zpětné vazby. Nenahrazuje certifikát DVPP.',
    seal: ['Vividbooks', 'Účast', 'potvrzeno'],
  },
};

/** Kompletní HTML dokument certifikátu — pro náhled v iframe i pro tisk do PDF. */
export function buildCertificateDocument(input: CertificateDocumentInput): string {
  const { webinar, email, kind } = input;
  const copy = COPY[kind];

  const title = escapeHtml(webinar.title || '');
  const lecturer = escapeHtml((webinar.lecturer || '').trim());
  const name = (input.participantName || '').trim();
  const who = escapeHtml(name || email.trim() || 'účastník');
  const durationMin =
    typeof webinar.durationMinutes === 'number' ? webinar.durationMinutes : 120;
  const durationPhrase = escapeHtml(formatDurationHoursCs(durationMin));
  const eventLine = escapeHtml(formatEventLineCs(webinar));
  const issued = escapeHtml(formatIssuedPragueCs(input.issuedAt ?? new Date()));
  const certNo = escapeHtml(certificateNumber(kind, webinar, email));

  const birth = kind === 'dvpp' ? formatBirthDateCs(input.birthDateIso || '') : '';
  /** Bez jména je v hlavním řádku už e-mail, druhý stejný řádek by byl duplicitní. */
  const identityLine = birth
    ? `datum narození <strong>${escapeHtml(birth)}</strong>`
    : name
      ? escapeHtml(email.trim())
      : '';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="only light" />
<title>${kind === 'dvpp' ? 'Certifikát DVPP' : 'Potvrzení o účasti'} — ${title}</title>
<link rel="preconnect" href="https://iekkundgizzdbmkzatdl.supabase.co" crossorigin />
<style>${FONT_FACE_BLOCK}${CERT_CSS}</style>
</head>
<body>
<div class="page">
  <div class="frame">
    <div class="cert-top">
      <div>
        ${buildLogoSvg()}
        <p class="cert-kicker">Vzdělávání učitelů</p>
      </div>
      <div class="cert-badge">
        <span class="cert-pill">${escapeHtml(copy.pill)}</span>
        <p class="cert-no">č. ${certNo}</p>
      </div>
    </div>

    <div class="cert-mid">
      <h1 class="cert-title cooper">${escapeHtml(copy.title)}</h1>
      <p class="cert-title-sub">${escapeHtml(copy.titleSub)}</p>
      <div class="cert-rule"></div>
      <p class="cert-lead">${escapeHtml(copy.lead)}</p>
      <p class="cert-name cooper">${who}</p>
      <div class="cert-nameline"></div>
      ${identityLine ? `<p class="cert-dob">${identityLine}</p>` : ''}
      <p class="cert-body">${escapeHtml(copy.body)}</p>
      <p class="cert-program">${title}</p>
      <p class="cert-meta">
        ${eventLine} &#183; distanční formou &#183; v rozsahu <strong>${durationPhrase}</strong>${
          lecturer ? `<br />lektor <strong>${lecturer}</strong>` : ''
        }
      </p>
      <p class="cert-note">${escapeHtml(copy.note)}</p>
    </div>

    <div class="cert-foot">
      <div class="cert-fcol">
        <p class="cert-fh">Vzdělávací zařízení</p>
        <strong>${escapeHtml(CERT_ORG.companyName)}</strong><br />
        ${escapeHtml(CERT_ORG.addressLine1)}<br />
        ${escapeHtml(CERT_ORG.addressLine2)}
      </div>
      <div class="cert-seal">
        <span class="cert-seal-1">${escapeHtml(copy.seal[0])}</span>
        <span class="cert-seal-2">${escapeHtml(copy.seal[1])}</span>
        <span class="cert-seal-3">${escapeHtml(copy.seal[2])}</span>
      </div>
      <div class="cert-fcol cert-sig">
        <p class="cert-fh">Vydáno elektronicky</p>
        <div class="cert-sigline"></div>
        <span class="cert-signame">${escapeHtml(CERT_ORG.representativeName)}</span><br />
        ${escapeHtml(CERT_ORG.representativeTitle)}<br />
        V Praze dne ${issued}
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}
