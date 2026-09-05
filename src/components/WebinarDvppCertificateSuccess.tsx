import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Award, Download } from 'lucide-react';
import type { Webinar } from '../data/webinars';
import { buildCertificateDocument } from '../lib/webinarCertificateDocument';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER_EDGE = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COOPER = { fontFamily: "'Cooper Light', serif" } as const;

/**
 * A4 na šířku v CSS pixelech (297 × 210 mm při 96 dpi). Certifikát se sází na přesnou
 * tiskovou velikost a náhled se jen proporcionálně zmenší transformem — náhled i PDF
 * jsou tak identické.
 */
const CERTIFICATE_PAGE_WIDTH_PX = 1122.52;
const CERTIFICATE_PAGE_HEIGHT_PX = 793.7;

/** Náhled certifikátu v přesné tiskové velikosti, zmenšený na šířku kontejneru. */
function CertificatePreview({
  srcDoc,
  className = '',
}: {
  srcDoc: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CERTIFICATE_PAGE_WIDTH_PX);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`w-full text-left ${className}`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#001161]/50">
        {'N\u00e1hled'}
      </p>
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl border border-[#001161]/12 bg-white shadow-sm"
        style={{ aspectRatio: '297 / 210' }}
      >
        <iframe
          title="Náhled certifikátu"
          srcDoc={srcDoc}
          scrolling="no"
          className="absolute left-0 top-0 border-0 bg-white"
          style={{
            width: `${CERTIFICATE_PAGE_WIDTH_PX}px`,
            height: `${CERTIFICATE_PAGE_HEIGHT_PX}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            visibility: scale > 0 ? 'visible' : 'hidden',
          }}
        />
      </div>
      <p style={FF} className="mt-2 text-center text-[11px] text-[#001161]/45">
        {'Stejn\u00e9 zobrazen\u00ed jako p\u0159i tisku nebo v PDF'}
      </p>
    </div>
  );
}

export function WebinarDvppCertificateSuccess({
  webinar,
  email,
  participantName = '',
  participantBirthDateIso = '',
  participantSchoolName = '',
  participantSchoolIco = '',
  variant = 'default',
  certificateKind,
}: {
  webinar: Webinar;
  email: string;
  participantName?: string;
  /** YYYY-MM-DD z brány dotazníku — přeskočí modal „Údaje pro certifikát“, pokud je kompletní. */
  participantBirthDateIso?: string;
  participantSchoolName?: string;
  participantSchoolIco?: string;
  variant?: 'default' | 'fullscreen';
  /** `dvpp` = text o ověření znalostí; `feedback` = jen dotazník bez DVPP kvízu. */
  certificateKind: 'dvpp' | 'feedback';
}) {
  const fs = variant === 'fullscreen';

  const gateBirth = (participantBirthDateIso || '').trim();
  const gateNameOk = (participantName || '').trim().length > 0;
  const gateBirthOk = /^\d{4}-\d{2}-\d{2}$/.test(gateBirth);
  const skipProfileFromGate = certificateKind === 'dvpp' && gateNameOk && gateBirthOk;

  const needProfile = certificateKind === 'dvpp';
  const [profileOpen, setProfileOpen] = useState(() => needProfile && !skipProfileFromGate);
  const [displayName, setDisplayName] = useState(() => (participantName || '').trim());
  const [birthDateIso, setBirthDateIso] = useState(() => gateBirth);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');

  const birthOk = useMemo(() => {
    if (!needProfile) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(birthDateIso.trim());
  }, [needProfile, birthDateIso]);

  const canContinue = displayName.trim().length > 0 && birthOk;

  const certificateHtml = useMemo(
    () =>
      buildCertificateDocument({
        webinar,
        email,
        participantName: displayName.trim() || participantName,
        birthDateIso: needProfile ? birthDateIso.trim() : undefined,
        kind: certificateKind,
      }),
    [webinar, email, participantName, displayName, birthDateIso, certificateKind, needProfile],
  );

  const openPrintablePdf = useCallback(() => {
    /** `about:blank` + `document.write` bývá v novém okně prázdné (noopener / CSP). Blob URL je spolehlivější. */
    const blob = new Blob([certificateHtml], { type: 'text/html;charset=utf-8' });
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
  }, [certificateHtml]);

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
          schoolName: (participantSchoolName || '').trim(),
          schoolIco: (participantSchoolIco || '').replace(/\D/g, '').slice(0, 10),
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
  }, [
    needProfile,
    webinar.id,
    email,
    displayName,
    birthDateIso,
    participantSchoolName,
    participantSchoolIco,
  ]);

  const didAutoSaveCert = useRef(false);
  useEffect(() => {
    if (!skipProfileFromGate || profileOpen || didAutoSaveCert.current) return;
    didAutoSaveCert.current = true;
    void saveCertificateProfileToServer();
  }, [skipProfileFromGate, profileOpen, saveCertificateProfileToServer]);

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
              <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">
                {'E-mail'}
              </span>
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
        <CertificatePreview
          srcDoc={certificateHtml}
          className="mx-auto mt-8 w-full max-w-[min(920px,100%)] px-0"
        />
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
            {profileSaving ? 'Ukládám…' : 'Pokračovat k certifikátu a PDF'}
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
        <h2
          style={COOPER}
          className="text-[20px] font-normal leading-snug text-[#001161] sm:text-[22px]"
        >
          {certificateKind === 'dvpp'
            ? 'Hotovo — máte splněné ověření znalostí (DVPP)'
            : 'Děkujeme za vyplnění dotazníku'}
        </h2>
        <p style={FF} className="mt-3 text-[14px] leading-relaxed text-[#001161]/70">
          {certificateKind === 'dvpp'
            ? 'Níže je certifikát v podobě, v jaké se vytiskne. Stáhněte si ho jako PDF — v okně tisku zvolte „Uložit jako PDF“.'
            : 'Níže je potvrzení v podobě, v jaké se vytiskne. Stáhněte si ho jako PDF — v okně tisku zvolte „Uložit jako PDF“.'}
        </p>

        <CertificatePreview srcDoc={certificateHtml} className="mx-auto mt-8" />

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
            'V Chrome nebo Edge v okně tisku zvolte „Uložit jako PDF“ a nastavení stránky nechte na A4 na šířku.'
          }
        </p>
      </div>
    </motion.div>
  );
}
