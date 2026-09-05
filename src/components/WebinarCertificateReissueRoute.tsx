import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { Award, ClipboardList, Loader2 } from 'lucide-react';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarDvppCertificateSuccess } from './WebinarDvppCertificateSuccess';
import { WebinarUnavailableNotice } from './WebinarUnavailableNotice';
import { SEOHead } from './SEOHead';
import { loadSavedDvppContacts } from '../utils/dvppSavedContacts';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COOPER = { fontFamily: "'Cooper Light', serif" } as const;

type CheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; surveySubmitted: boolean }
  | { status: 'error'; message: string };

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Znovuvydání certifikátu: `/webinar/:slug/certifikat` (volitelně `?email=`).
 *
 * Certifikát nikde neleží — sází se v prohlížeči z dat webináře a účastníka. Kdo si
 * po dotazníku zavřel okno, musel dosud psát na podporu. Tady stačí e-mail: server
 * potvrdí, že dotazník byl odeslaný, a certifikát se vykreslí znovu.
 *
 * Jméno a datum narození server záměrně nevrací (byla by z toho veřejná vyhledávačka
 * data narození podle e-mailu). Když je prohlížeč zná z minula, předvyplní se z
 * `localStorage`; jinak se na ně zeptá modal v `WebinarDvppCertificateSuccess`.
 */
export function WebinarCertificateReissueRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { webinars, loading } = useWebinars();

  const webinar = webinars.find((w) => w.id === id || w.slug === id);

  const emailFromQuery = (searchParams.get('email') || '').trim().toLowerCase();
  const [email, setEmail] = useState(emailFromQuery);
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  const autoCheckedFor = useRef('');

  const savedContact = useMemo(() => {
    const em = email.trim().toLowerCase();
    if (!em) return null;
    return loadSavedDvppContacts().find((c) => c.email.trim().toLowerCase() === em) || null;
  }, [email]);

  const runCheck = useCallback(
    async (rawEmail: string) => {
      const em = rawEmail.trim().toLowerCase();
      if (!webinar || !isEmail(em)) {
        setCheck({ status: 'error', message: 'Zadejte prosím platný e-mail.' });
        return;
      }
      setCheck({ status: 'loading' });
      try {
        const res = await fetch(
          `${SERVER}/public/webinar-registration-check?webinarId=${encodeURIComponent(String(webinar.id))}&email=${encodeURIComponent(em)}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        const data = (await res.json().catch(() => ({}))) as {
          surveySubmitted?: boolean;
          error?: string;
        };
        if (res.status === 429) {
          setCheck({
            status: 'error',
            message: 'Příliš mnoho pokusů za sebou. Zkuste to prosím za minutu.',
          });
          return;
        }
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setCheck({ status: 'done', surveySubmitted: !!data.surveySubmitted });
      } catch (e) {
        setCheck({
          status: 'error',
          message:
            e instanceof Error && e.message
              ? `Ověření se nepodařilo: ${e.message}`
              : 'Ověření se nepodařilo. Zkuste to prosím znovu.',
        });
      }
    },
    [webinar],
  );

  /** S e-mailem v odkazu (z potvrzovacího e-mailu) se neptáme na nic — rovnou ověříme. */
  useEffect(() => {
    if (!webinar || !emailFromQuery || !isEmail(emailFromQuery)) return;
    if (autoCheckedFor.current === emailFromQuery) return;
    autoCheckedFor.current = emailFromQuery;
    void runCheck(emailFromQuery);
  }, [webinar, emailFromQuery, runCheck]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-[#001161]/40">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span style={FF} className="text-[14px]">
          {'Načítám…'}
        </span>
      </div>
    );
  }

  if (!webinar) return <WebinarUnavailableNotice />;

  const canonicalSeg = String(webinar.slug || webinar.id || '').trim();
  if (id && canonicalSeg && id !== canonicalSeg) {
    const qs = searchParams.toString();
    return (
      <Navigate
        to={`/webinar/${encodeURIComponent(canonicalSeg)}/certifikat${qs ? `?${qs}` : ''}`}
        replace
      />
    );
  }

  const certificatePath = `/webinar/${canonicalSeg}/certifikat`;
  const dotaznikUrl = `/webinar/${encodeURIComponent(canonicalSeg)}/dvpp-dotaznik${
    isEmail(email) ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ''
  }`;
  const hasQuiz = Array.isArray(webinar.postWebinarQuizQuestions)
    ? webinar.postWebinarQuizQuestions.some(
        (q) => q && q.type === 'abc' && Array.isArray(q.options) && q.options.length >= 2,
      )
    : false;

  const seo = (
    <SEOHead
      title={`Certifikát — ${webinar.title}`}
      path={certificatePath}
      description={`Znovu vystavit certifikát z webináře ${webinar.title}.`}
      noIndex
    />
  );

  if (check.status === 'done' && check.surveySubmitted) {
    return (
      <div className="flex min-h-[70vh] flex-col bg-[#E8EBF4]">
        {seo}
        <WebinarDvppCertificateSuccess
          webinar={webinar}
          email={email.trim().toLowerCase()}
          participantName={savedContact?.name || ''}
          participantBirthDateIso={savedContact?.birthDateIso || ''}
          participantSchoolName={savedContact?.schoolName || ''}
          participantSchoolIco={savedContact?.ico || ''}
          variant="fullscreen"
          certificateKind={hasQuiz ? 'dvpp' : 'feedback'}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16">
      {seo}
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#001161]/8 bg-white p-9 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#001161]/8">
          {check.status === 'done' ? (
            <ClipboardList className="h-6 w-6 text-[#001161]" strokeWidth={1.5} />
          ) : (
            <Award className="h-6 w-6 text-[#001161]" strokeWidth={1.5} />
          )}
        </div>

        {check.status === 'done' && !check.surveySubmitted ? (
          <>
            <h1 style={COOPER} className="mb-2 text-[21px] font-normal text-[#001161]">
              {'Dotazník k tomuto webináři zatím nemáme'}
            </h1>
            <p style={FF} className="mb-7 text-[14px] leading-relaxed text-[#001161]/60">
              {
                'Certifikát vystavujeme po vyplnění krátkého dotazníku. Zabere pár minut a certifikát dostanete hned na konci.'
              }
            </p>
            <Link
              to={dotaznikUrl}
              style={FF}
              className="flex items-center justify-center gap-2 rounded-full bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-[#001a8c]"
            >
              {'Vyplnit dotazník'}
            </Link>
            <button
              type="button"
              onClick={() => setCheck({ status: 'idle' })}
              style={FF}
              className="mt-4 text-[13px] font-semibold text-[#001161]/50 underline-offset-2 hover:text-[#001161]/80 hover:underline"
            >
              {'Zkusit jiný e-mail'}
            </button>
          </>
        ) : (
          <>
            <h1 style={COOPER} className="mb-2 text-[21px] font-normal leading-snug text-[#001161]">
              {'Certifikát z webináře'}
            </h1>
            <p style={FF} className="mb-1 text-[14px] font-semibold text-[#001161]/80">
              {webinar.title}
            </p>
            <p style={FF} className="mb-7 text-[14px] leading-relaxed text-[#001161]/60">
              {
                'Zadejte e-mail, se kterým jste vyplnili dotazník. Certifikát vám znovu vykreslíme a můžete si ho uložit jako PDF.'
              }
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runCheck(email);
              }}
              className="flex flex-col gap-3 text-left"
            >
              <label style={FF} className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">
                  {'E-mail'}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40"
                />
              </label>
              <button
                type="submit"
                disabled={check.status === 'loading' || !isEmail(email.trim())}
                style={FF}
                className="mt-1 flex items-center justify-center gap-2 rounded-full bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-[#001a8c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {check.status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {'Ověřuji…'}
                  </>
                ) : (
                  'Zobrazit certifikát'
                )}
              </button>
            </form>

            {check.status === 'error' ? (
              <p style={FF} className="mt-4 text-[13px] text-red-600">
                {check.message}
              </p>
            ) : null}

            <p style={FF} className="mt-6 text-[12px] leading-relaxed text-[#001161]/45">
              {'Dotazník jste ještě nevyplnili? '}
              <Link to={dotaznikUrl} className="font-semibold underline underline-offset-2">
                {'Otevřít dotazník'}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
