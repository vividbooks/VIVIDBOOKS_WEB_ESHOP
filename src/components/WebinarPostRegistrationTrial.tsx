import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { SchoolSearch, type PdOwner, type PipedriveStatus } from './TrialPage';
import { submitFreeTrialAjax, type FreeTrialFields, type FreeTrialSubmitResult } from '../utils/trialSubmit';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { TrialTrainingVideosList } from './TrialTrainingVideosList';
import { isValidEmailFormat, EMAIL_FORMAT_HINT_CS } from '../utils/emailValidation';
import { appUrl } from '../utils/publicSiteUrl';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

export interface WebinarTrialFormSnapshot {
  name: string;
  email: string;
  phone: string;
  position: string;
  gdpr: boolean;
  newsletter: boolean;
  schoolName: string;
  ico: string;
}

function isWebinarTeacherLikePosition(position: string): boolean {
  return /Učitel|Pedagogický/i.test(position);
}

/** Stejná logika jako trial API — výchozí předmět pro učitelské role z webináře */
function buildTrialFieldsFromWebinar(form: WebinarTrialFormSnapshot): FreeTrialFields {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    position: form.position,
    schoolName: form.schoolName.trim(),
    vat: form.ico.replace(/\D/g, '').slice(0, 10),
    gdpr: form.gdpr,
    newsletter: form.newsletter,
    teacherSubjects: isWebinarTeacherLikePosition(form.position) ? ['Other-2'] : [],
    schoolStages: [],
  };
}

interface WebinarPostRegistrationTrialProps {
  form: WebinarTrialFormSnapshot;
  notTeacher: boolean;
}

export function WebinarPostRegistrationTrial({ form, notTeacher }: WebinarPostRegistrationTrialProps) {
  const [pdStatus, setPdStatus] = useState<PipedriveStatus>(null);
  const [pdMessage, setPdMessage] = useState('');
  const [pdLoading, setPdLoading] = useState(false);
  const [colleagues, setColleagues] = useState<string[]>([]);
  const [owner, setOwner] = useState<PdOwner | null>(null);
  const [products, setProducts] = useState<string[]>([]);

  const [emailCheck, setEmailCheck] = useState<{
    canRequest: boolean;
    alreadyRequested?: boolean;
    cooldownDateStr?: string;
    daysLeft?: number;
    cooldownExpired?: boolean;
  } | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  const [trialResult, setTrialResult] = useState<FreeTrialSubmitResult | null>(null);
  const [trialSubmitting, setTrialSubmitting] = useState(false);
  const [trialError, setTrialError] = useState('');

  const ico = form.ico.replace(/\D/g, '').slice(0, 10);

  /**
   * O existenci aktivního trialu / licence rozhoduje VÝHRADNĚ legacy Vividbooks
   * API (`POST api.vividbooks.com/web/free-trial-ajax`) podle CIN/IČO — nikdy
   * Pipedrive. Tlačítko „Chci přístup" je proto dostupné vždy: když API vrátí
   * kódy, zákazník je dostane; když ne, zobrazí se hláška s kontaktem na
   * obchodníka. Stav `active_trial` z Pipedrive (otevřený deal v CRM) je jen
   * informativní a nesmí nic blokovat.
   */

  const pdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (notTeacher || ico.length < 6) {
      setPdStatus(null);
      setPdMessage('');
      setColleagues([]);
      setOwner(null);
      setProducts([]);
      return;
    }
    if (pdTimer.current) clearTimeout(pdTimer.current);
    pdTimer.current = setTimeout(async () => {
      setPdLoading(true);
      try {
        const res = await fetch(`${SERVER}/school-pipedrive-check?ico=${encodeURIComponent(ico)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        const data = (await res.json()) as Record<string, unknown>;
        setPdStatus((data.status as PipedriveStatus) || 'unknown');
        setPdMessage(typeof data.message === 'string' ? data.message : '');
        setColleagues(Array.isArray(data.colleagues) ? (data.colleagues as string[]) : []);
        setOwner((data.owner as PdOwner | null) ?? null);
        setProducts(Array.isArray(data.products) ? (data.products as string[]) : []);
      } catch {
        setPdStatus('unknown');
        setPdMessage('');
        setColleagues([]);
        setOwner(null);
        setProducts([]);
      } finally {
        setPdLoading(false);
      }
    }, 600);
  }, [ico, notTeacher]);

  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const email = form.email.trim();
    if (notTeacher || !email || !isValidEmailFormat(email)) {
      setEmailCheck(null);
      return;
    }
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const res = await fetch(`${SERVER}/check-trial-email?email=${encodeURIComponent(email)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        setEmailCheck(await res.json());
      } catch {
        setEmailCheck(null);
      } finally {
        setEmailChecking(false);
      }
    }, 400);
  }, [form.email, notTeacher]);

  const handleOneClickTrial = async () => {
    if (!form.gdpr) {
      setTrialError('Chyb\u00ed souhlas se zpracov\u00e1n\u00edm \u00fadaj\u016f z registrace.');
      return;
    }
    if (emailCheck?.emailInvalid && emailCheck.message) {
      setTrialError(emailCheck.message);
      return;
    }
    if (!isValidEmailFormat(form.email.trim())) {
      setTrialError(EMAIL_FORMAT_HINT_CS);
      return;
    }
    setTrialSubmitting(true);
    setTrialError('');
    try {
      const vr = await fetch(
        `${SERVER}/validate-email?email=${encodeURIComponent(form.email.trim())}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      const vd = (await vr.json()) as { ok?: boolean; message?: string };
      if (!vd.ok) {
        setTrialError(typeof vd.message === 'string' ? vd.message : EMAIL_FORMAT_HINT_CS);
        return;
      }
      const payload = buildTrialFieldsFromWebinar(form);
      const result = await submitFreeTrialAjax(payload);
      if (result.status === 'error') {
        setTrialError(result.message);
        return;
      }
      setTrialResult(result);
    } catch (e) {
      setTrialError(e instanceof Error ? e.message : 'Odesl\u00e1n\u00ed se nezda\u0159ilo.');
    } finally {
      setTrialSubmitting(false);
    }
  };

  if (notTeacher) {
    return (
      <div className="w-full mt-6 pt-6 border-t border-[#001161]/10 text-left">
        <p style={FF} className="text-[14px] font-bold text-[#001161] mb-2">
          {'Zkusit Vividbooks zdarma'}
        </p>
        <p style={FF} className="text-[13px] text-[#001161]/65 leading-relaxed mb-4">
          {'Pro 14denn\u00ed p\u0159\u00edstup pot\u0159ebujeme n\u00e1zev \u0161koly a I\u010cO. Vypln\u011bte pros\u00edm zku\u0161ebn\u00ed formul\u00e1\u0159.'}
        </p>
        <Link
          to="/vyzkousejte"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 font-bold text-[14px] text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] no-underline"
          style={FF}
        >
          {'P\u0159ej\u00edt na zku\u0161ebn\u00ed p\u0159\u00edstup'}
        </Link>
      </div>
    );
  }

  if (trialResult?.status === 'codes') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mt-6 pt-6 border-t border-[#001161]/10 text-left"
      >
        <div className="rounded-[20px] border border-green-200 bg-[#F0FDF4] p-6">
          <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-500" />
          <h3 className="mb-2 text-center font-['Cooper_Light',serif] text-[22px] text-[#001161]">
            {'Zku\u0161ebn\u00ed p\u0159\u00edstup'}
          </h3>
          <p style={FF} className="mb-5 text-center text-[13px] text-[#001161]/70 leading-snug">
            {trialResult.kind === 'existing_trial'
              ? 'Va\u0161e \u0161kola u\u017e m\u00e1 aktivn\u00ed zku\u0161ebn\u00ed p\u0159\u00edstup. Pro p\u0159ihl\u00e1\u0161en\u00ed pou\u017eijte tyto k\u00f3dy:'
              : 'Va\u0161e p\u0159\u00edstupov\u00e9 k\u00f3dy pro zku\u0161ebn\u00ed verzi:'}
          </p>
          <div className="mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 shadow-sm">
              <p style={FF} className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                {'K\u00f3d pro u\u010ditele'}
              </p>
              <p style={FF} className="font-mono text-[17px] font-bold tracking-wide text-[#001161] break-all">
                {trialResult.teacherCode}
              </p>
            </div>
            <div className="rounded-[14px] border border-[#001161]/10 bg-white px-4 py-3 shadow-sm">
              <p style={FF} className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                {'K\u00f3d pro \u017e\u00e1ka'}
              </p>
              <p style={FF} className="font-mono text-[17px] font-bold tracking-wide text-[#001161] break-all">
                {trialResult.studentCode}
              </p>
            </div>
          </div>
          <a
            href={appUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] no-underline"
            style={FF}
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            {'Otev\u0159\u00edt aplikaci'}
          </a>
          <TrialTrainingVideosList compact sectionClassName="mt-5 border-t border-green-200/70 pt-5" />
        </div>
      </motion.div>
    );
  }

  if (trialResult?.status === 'thank_only') {
    return (
      <div className="w-full mt-6 pt-6 border-t border-[#001161]/10 text-left">
        <p style={FF} className="text-[14px] text-[#001161]/75 leading-relaxed">
          {'D\u011bkujeme za \u017e\u00e1dost. Ozveme se v\u00e1m co nejd\u0159\u00edve s p\u0159\u00edstupov\u00fdmi \u00fadaji na e-mail.'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full mt-6 pt-6 border-t border-[#001161]/10 text-left space-y-4">
      <div>
        <h3 style={FF} className="text-[16px] font-bold text-[#001161] mb-1">
          {'Vyzkou\u0161ejte Vividbooks'}
        </h3>
        <p style={FF} className="text-[13px] text-[#001161]/60 leading-relaxed">
          {'M\u00e1te z\u00e1jem o 14denn\u00ed p\u0159\u00edstup k digit\u00e1ln\u00edm u\u010debnic\u00edm? Sta\u010d\u00ed jeden klik \u2014 stejn\u011b jako u zku\u0161ebn\u00edho formul\u00e1\u0159e v\u00e1m p\u0159ijde potvrzen\u00ed a p\u0159\u00edstupov\u00e9 k\u00f3dy.'}
        </p>
      </div>

      <SchoolSearch
        readOnly
        schoolName={form.schoolName}
        ico={ico}
        onSelect={() => {}}
        onIcoChange={() => {}}
        pdStatus={pdStatus}
        pdMessage={pdMessage}
        pdLoading={pdLoading}
        colleagues={colleagues}
        owner={owner}
        products={products}
        hidePipedriveStatusCard={
          // Karta „škola právě testuje" z Pipedrive nemusí odpovídat skutečné
          // platnosti licence — o trialu rozhodne až api.vividbooks.com.
          pdStatus === 'active_trial'
        }
      />

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleOneClickTrial}
          disabled={
            trialSubmitting
            || !form.gdpr
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
          style={FF}
        >
          {trialSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {'Odes\u00edl\u00e1m\u2026'}
            </>
          ) : (
            'Chci p\u0159\u00edstup'
          )}
        </button>
        <div className="flex items-center justify-center gap-2 min-h-[20px]">
          {emailChecking && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#001161]/35" />}
          {emailCheck?.emailInvalid && emailCheck.message && (
            <p style={FF} className="text-[12px] text-red-700 text-center">
              {emailCheck.message}
            </p>
          )}
        </div>
      </div>

      {trialError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p style={FF} className="text-[13px] text-red-700">
            {trialError}
          </p>
        </div>
      )}

      <p style={FF} className="text-[11px] text-[#001161]/40">
        {'Souhlas se zpracov\u00e1n\u00edm \u00fadaj\u016f z registrace na webin\u00e1\u0159 se vztahuje i na tuto \u017e\u00e1dost o zku\u0161ebn\u00ed p\u0159\u00edstup.'}
      </p>
    </div>
  );
}
