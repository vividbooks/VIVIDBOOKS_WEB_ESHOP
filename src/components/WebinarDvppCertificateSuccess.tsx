import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { Award, Download, ExternalLink } from 'lucide-react';
import type { Webinar } from '../data/webinars';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPrintableCertificateDocument(opts: {
  webinar: Webinar;
  email: string;
  participantName: string;
  kind: 'dvpp' | 'feedback';
}): string {
  const { webinar, email, participantName, kind } = opts;
  const title = escapeHtml(webinar.title);
  const lecturer = escapeHtml(webinar.lecturer || '');
  const when = escapeHtml(
    `${webinar.day}.\u00a0${webinar.monthName}\u00a0${webinar.year}, ${webinar.time}`,
  );
  const duration = typeof webinar.durationMinutes === 'number' ? webinar.durationMinutes : 120;
  const who = escapeHtml(participantName.trim() || email.trim() || 'účastník');
  const mail = escapeHtml(email.trim());
  const issued = escapeHtml(
    new Intl.DateTimeFormat('cs-CZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
  );

  const head =
    kind === 'dvpp'
      ? 'Potvrzení o splnění ověření znalostí z webináře (DVPP)'
      : 'Potvrzení o vyplnění dotazníku po webináři';

  const bodyPara =
    kind === 'dvpp'
      ? `Tímto se potvrzuje, že níže uvedený účastník úspěšně absolvoval ověření znalostí z webináře v rozsahu vzdělávací akce akreditované v systému DVPP (dle platného zákona o pedagogických pracovnících a souvisejících předpisů). Ověření bylo provedeno vyplněním dotazníku po skončení akce.`
      : `Tímto se potvrzuje vyplnění zpětné vazby po webináři níže uvedeným účastníkem. Doklad slouží pro vaši evidenci; nenahrazuje oficiální certifikát DVPP z akreditované dráhy, pokud ho škola vyžaduje samostatně.`;

  const footNote =
    kind === 'dvpp'
      ? `Toto potvrzení slouží jako doklad o splnění povinnosti ověření znalostí v rámci účasti na akci (dle pravidel vaší školy a platné legislativy). V případě dotazů kontaktujte organizátora na podpoře Vividbooks.`
      : `Tento doklad potvrzuje účast na zpětné vazbě. Pro oficiální certifikát DVPP použijte odkaz u webináře nebo pokyny z organizátora.`;

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>${head}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      border: 3px solid #001161;
      border-radius: 12px;
      padding: 28px 36px;
      min-height: calc(100vh - 28mm);
      background: linear-gradient(180deg, #f8fafc 0%, #fff 40%);
    }
    .brand { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #001161; font-weight: 700; margin-bottom: 8px; }
    h1 {
      font-size: 22px;
      line-height: 1.25;
      margin: 0 0 18px;
      color: #001161;
      font-weight: 800;
    }
    .meta { font-size: 13px; color: #475569; margin-bottom: 16px; line-height: 1.5; }
    .meta strong { color: #0f172a; }
    p.text {
      font-size: 13px;
      line-height: 1.65;
      color: #334155;
      margin: 0 0 14px;
    }
    .participant {
      margin: 20px 0;
      padding: 16px 18px;
      background: #e8ebf4;
      border-radius: 10px;
      border-left: 4px solid #001161;
    }
    .participant .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px; }
    .participant .name { font-size: 18px; font-weight: 700; color: #001161; }
    .participant .em { font-size: 13px; color: #475569; margin-top: 4px; }
    .foot {
      margin-top: 22px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11px;
      color: #64748b;
    }
    .sig { text-align: right; }
    .sig .line { margin-top: 36px; border-top: 1px solid #94a3b8; padding-top: 6px; min-width: 200px; display: inline-block; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand">Vividbooks — vzdělávání učitelů</div>
    <h1>${head}</h1>
    <div class="meta">
      <strong>Webinář:</strong> ${title}<br/>
      <strong>Datum konání:</strong> ${when}<br/>
      <strong>Lektor:</strong> ${lecturer || '—'}<br/>
      <strong>Odhadovaný rozsah akce:</strong> ${duration} min
    </div>
    <p class="text">${bodyPara}</p>
    <div class="participant">
      <div class="label">Účastník</div>
      <div class="name">${who}</div>
      <div class="em">${mail}</div>
    </div>
    <p class="text" style="font-size:12px;">
      ${footNote}
    </p>
    <div class="foot">
      <span>Vydáno elektronicky: ${issued}</span>
      <div class="sig">
        <div class="line">Organizátor: Vividbooks</div>
      </div>
    </div>
  </div>
</body>
</html>`;
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
  const externalCertUrl = (webinar.certificateUrl || '').trim();
  const certBtn = (webinar.greyButtonText || 'Certifikát DVPP').trim();
  const certMode = webinar.certificateLinkMode === 'survey' ? 'survey' : 'external';
  /** `survey` = odkaz se má ukázat až po vyplnění dotazníku na webu — jsme na obrazovce po odeslání, odkaz zobrazíme. */
  const showExternalCertButton =
    !!externalCertUrl && (certMode === 'external' || certMode === 'survey');

  const openPrintablePdf = useCallback(() => {
    const html = buildPrintableCertificateDocument({
      webinar,
      email,
      participantName,
      kind: certificateKind,
    });
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    }, 200);
  }, [webinar, email, participantName, certificateKind]);

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
            ? 'w-full max-w-lg text-center'
            : 'mx-auto w-full max-w-[560px] text-center'
        }
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#001161]/8">
          <Award className="h-9 w-9 text-[#001161]" strokeWidth={1.5} />
        </div>
        <h2 style={FF} className="text-[20px] font-bold leading-snug text-[#001161] sm:text-[22px]">
          {certificateKind === 'dvpp'
            ? 'Hotovo — máte splněné ověření znalostí (DVPP)'
            : 'Děkujeme za vyplnění dotazníku'}
        </h2>
        <p style={FF} className="mt-3 text-[14px] leading-relaxed text-[#001161]/70">
          {certificateKind === 'dvpp'
            ? 'Níže si stáhněte potvrzení ve formátu PDF (přes tisk v prohlížeči) a případně použijte odkaz na oficiální certifikát, pokud ho má tento webinář k dispozici.'
            : 'Níže si můžete vytisknout nebo uložit potvrzení o vyplnění zpětné vazby.'}
        </p>

        {/* Náhled — zjednodušená vizuální karta */}
        <div
          className="mt-8 rounded-2xl border-2 border-[#001161] bg-gradient-to-b from-[#f8fafc] to-white p-6 text-left shadow-lg shadow-slate-200/80"
          aria-hidden
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#001161]">Vividbooks</p>
          <p style={FF} className="mt-2 text-[15px] font-extrabold leading-snug text-[#001161]">
            {certificateKind === 'dvpp'
              ? 'Potvrzení o splnění ověření znalostí (DVPP)'
              : 'Potvrzení o vyplnění dotazníku'}
          </p>
          <p style={FF} className="mt-3 text-[12px] text-slate-600">
            {webinar.title}
          </p>
          <p style={FF} className="mt-1 text-[11px] text-slate-500">
            {webinar.day}. {webinar.monthName} {webinar.year} · {webinar.time}
          </p>
          <div className="mt-4 rounded-xl border-l-4 border-[#001161] bg-[#E8EBF4] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Účastník</p>
            <p style={FF} className="text-[14px] font-bold text-[#001161]">
              {(participantName || email || '').trim() || '—'}
            </p>
          </div>
        </div>

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
          {showExternalCertButton ? (
            <a
              href={externalCertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#001161]/15 bg-white px-6 py-3 text-[14px] font-bold text-[#001161] transition hover:bg-[#f8fafc]"
              style={FF}
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              {certBtn}
            </a>
          ) : null}
        </div>
        <p style={FF} className="mt-4 text-[12px] text-[#001161]/45">
          {
            'V Chrome nebo Edge v okně tisku zvolte „Uložit jako PDF“. Obsah potvrzení odpovídá údajům o webináři a vaší registraci.'
          }
        </p>
      </div>
    </motion.div>
  );
}
