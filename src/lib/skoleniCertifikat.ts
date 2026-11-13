/**
 * Certifikát ze školení pro školu — sdílené typy, texty a sazba dokumentu.
 * Backend: `src/supabase/functions/server/skoleniCertifikaty.ts`.
 */
import type { Webinar } from '../data/webinars';
import { buildCertificateDocument, type CertificateCopy } from './webinarCertificateDocument';

export type SkoleniCertKind = 'dvpp' | 'ucast';
export type SkoleniCertForm = 'online' | 'prezencni';

/** Co o školení smí vědět učitel s odkazem. */
export interface SkoleniCertPublic {
  token: string;
  title: string;
  schoolName: string;
  dateIso: string;
  time: string;
  durationMinutes: number;
  lecturer: string;
  form: SkoleniCertForm;
  kind: SkoleniCertKind;
  restricted: boolean;
}

export const SKOLENI_KIND_LABEL: Record<SkoleniCertKind, string> = {
  dvpp: 'Certifikát DVPP',
  ucast: 'Potvrzení o účasti',
};

const COPY: Record<SkoleniCertKind, CertificateCopy> = {
  dvpp: {
    pill: 'Osvědčení DVPP',
    title: 'Certifikát',
    titleSub: 'o absolvování vzdělávacího programu',
    lead: 'Potvrzujeme, že',
    body: 'absolvoval(a) školení',
    note: 'Osvědčení o průběžném vzdělávání podle § 10 vyhlášky č. 317/2005 Sb.',
    seal: ['Vividbooks', 'DVPP', 'školení'],
  },
  ucast: {
    pill: 'Potvrzení o účasti',
    title: 'Potvrzení',
    titleSub: 'o účasti na školení',
    lead: 'Potvrzujeme, že',
    body: 'se zúčastnil(a) školení',
    note: 'Potvrzení dokládá účast na školení. Nenahrazuje certifikát DVPP.',
    seal: ['Vividbooks', 'Účast', 'potvrzeno'],
  },
};

export function formatSkoleniDateCs(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map((p) => parseInt(p, 10));
  if (!y || !m || !d) return '';
  return `${d}. ${m}. ${y}`;
}

export function buildSkoleniCertificateHtml(
  skoleni: SkoleniCertPublic,
  participant: { name: string; email: string; birthDateIso?: string },
  issuedAt?: Date,
): string {
  const [y, m, d] = skoleni.dateIso.split('-').map((p) => parseInt(p, 10));
  /** Sazba certifikátu čte z webináře jen těchto pár polí. */
  const asWebinar = {
    id: `skoleni-${skoleni.token}`,
    title: skoleni.title,
    day: d || 1,
    monthNum: m || 1,
    year: y || new Date().getFullYear(),
    time: skoleni.time,
    durationMinutes: skoleni.durationMinutes,
    lecturer: skoleni.lecturer,
  } as unknown as Webinar;

  return buildCertificateDocument({
    webinar: asWebinar,
    email: participant.email,
    participantName: participant.name,
    birthDateIso: skoleni.kind === 'dvpp' ? participant.birthDateIso : undefined,
    kind: skoleni.kind === 'dvpp' ? 'dvpp' : 'feedback',
    copy: COPY[skoleni.kind],
    formLabel: skoleni.form === 'prezencni' ? 'prezenční formou' : 'distanční formou',
    documentTitle: SKOLENI_KIND_LABEL[skoleni.kind],
    issuedAt,
  });
}

/** Otevře certifikát v novém okně a spustí tisk (uložení do PDF). Vrací false, když prohlížeč okno zablokoval. */
export function printCertificateHtml(html: string): boolean {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  let printed = false;
  const print = () => {
    if (printed) return;
    printed = true;
    try {
      w.focus();
      w.print();
    } catch {
      /* okno zavřené dřív, než se stihlo vytisknout */
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  w.addEventListener('load', print, { once: true });
  window.setTimeout(print, 600);
  return true;
}
