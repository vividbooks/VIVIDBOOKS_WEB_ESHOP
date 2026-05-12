import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, CheckCircle, AlertCircle, Radio, Calendar, Search, Building2, Loader2 } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Webinar } from '../data/webinars';
import { useWebinars } from '../contexts/WebinarsContext';
import { useDvppVideos } from '../contexts/DvppVideosContext';
import { WebinarThumbnail } from './WebinarThumbnail';
import { WebinarCard } from './WebinarCard';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { SEOHead, webinarJsonLd } from './SEOHead';
import { marketingUrl } from '../config/marketingSite';
import { WebinarPostRegistrationTrial } from './WebinarPostRegistrationTrial';
import { WebinarPostSurvey } from './WebinarPostSurvey';
import { WebinarRegistrationFormFields } from './WebinarRegistrationFormFields';
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { getMergedWebinarSurveyQuestions, getPreWebinarSurveyQuestions } from '../utils/webinarSurveyDefaults';
import {
  loadSavedDvppContacts,
  rememberDvppContact,
  type SavedDvppContact,
} from '../utils/dvppSavedContacts';

/**
 * Dočasně: před celostránkovým dotazníkem (`?dvppDotaznik=1`) se nezobrazuje krok registrace / light lead.
 * Nastav na `false`, až budete chtít krok znovu zapnout.
 */
const SKIP_DVPP_SURVEY_REGISTRATION_STEP = true;

/** `decodeURIComponent` u neplatného % kódování vyhodí — nechceme shodit celou stránku. */
function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const POSITIONS = [
  'U\u010ditel/ka na Z\u0160',
  'U\u010ditel/ka na S\u0160',
  'U\u010ditel/ka na VO\u0160 nebo V\u0160',
  '\u0158editel/ka \u0161koly',
  'V\u00fdchovn\u00fd/\u00e1 poradce/poradkyn\u011b',
  'Pedagogick\u00fd pracovn\u00edk/ce',
  'Rodi\u010d',
  'Jin\u00e9',
];

interface FormState {
  name: string;
  email: string;
  phone: string;
  position: string;
  gdpr: boolean;
  newsletter: boolean;
  schoolName: string;
  ico: string;
  schoolAddress: string;
  webinarMotivation: string;
  webinarTopicInterest: string;
  usesVividbooks: '' | 'yes' | 'no';
  /** YYYY-MM-DD — brána DVPP dotazníku */
  birthDateIso: string;
}

interface WebinarDetailPageProps {
  webinar: Webinar;
}

const USE_VIVIDBOOKS_QID = 'uses_vividbooks';

function normDvppMatch(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Stejná heuristika jako v adminu — párování webináře k záznamu z `/dvpp-videos` (server doplní `surveyRequireFullRegistration` z KV). */
function matchDvppVideoForWebinarDetail(webinar: Webinar, dvppVideos: { id: string; slug?: string; name?: string; title?: string }[]) {
  if (!dvppVideos?.length) return null;
  const wSlug = normDvppMatch(String(webinar.slug || webinar.id || ''));
  const wTitle = normDvppMatch(String(webinar.title || ''));
  const bySlug = dvppVideos.find((v) => normDvppMatch(String(v.slug || v.id || '')) === wSlug);
  if (bySlug) return bySlug;
  const byTitle = dvppVideos.find((v) => {
    const vt = normDvppMatch(String(v.name || v.title || ''));
    return (
      wTitle.length > 5 &&
      (vt.includes(wTitle.slice(0, Math.floor(wTitle.length * 0.7))) ||
        wTitle.includes(vt.slice(0, Math.floor(vt.length * 0.7))))
    );
  });
  return byTitle ?? null;
}

export function WebinarDetailPage({ webinar }: WebinarDetailPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dotaznikQ = searchParams.get('dotaznik');
  const dvppDotaznikQ = searchParams.get('dvppDotaznik');
  const { webinars } = useWebinars();
  const { videos: dvppVideos, loading: dvppVideosLoading } = useDvppVideos();

  const matchedDvppVideo = useMemo(
    () => matchDvppVideoForWebinarDetail(webinar, dvppVideos),
    [webinar, dvppVideos],
  );

  /**
   * Explicitní boolean z GET `/webinare` má přednost. U statického fallbacku v kontextu pole chybí —
   * server na GET `/dvpp-videos` doplní `surveyRequireFullRegistration` z KV u párového záznamu.
   * Výchozí: bez plné registrace na webinář u dotazníku (`false`).
   */
  const needsDvppForSurveyFlag = typeof webinar.surveyRequireFullRegistration !== 'boolean';
  const requireFullSurveyReg = useMemo(() => {
    if (typeof webinar.surveyRequireFullRegistration === 'boolean') {
      return webinar.surveyRequireFullRegistration;
    }
    const vFlag = matchedDvppVideo?.surveyRequireFullRegistration;
    if (typeof vFlag === 'boolean') return vFlag;
    return false;
  }, [webinar.surveyRequireFullRegistration, matchedDvppVideo]);

  /** Po webináři: DVPP + otevřené otázky (odeslání na stejný endpoint). */
  const postSurveyMerged = useMemo(() => getMergedWebinarSurveyQuestions(webinar), [webinar]);
  /** Před webinářem: motivace / témata (bez DVPP kvízu). */
  const preSurveyQuestions = useMemo(() => getPreWebinarSurveyQuestions(webinar), [webinar]);
  const postRegSurveyHasUsesQuestion = useMemo(
    () => preSurveyQuestions.some((q) => q.id === USE_VIVIDBOOKS_QID),
    [preSurveyQuestions],
  );
  const [postSurveyAnswers, setPostSurveyAnswers] = useState<Record<string, string>>({});
  const onPostSurveyAnswersChange = useCallback((a: Record<string, string>) => {
    setPostSurveyAnswers(a);
  }, []);

  /** Celostránkový dotazník po akci (`?dvppDotaznik=1`) — potřeba dřív než handleSubmit (kontrola registrace). */
  const isSurveyFullPage = useMemo(
    () => dvppDotaznikQ === '1' && postSurveyMerged.length > 0 && webinar.isPast,
    [dvppDotaznikQ, postSurveyMerged.length, webinar.isPast],
  );

  const showPostRegistrationTrial = useMemo(() => {
    if (preSurveyQuestions.length === 0) return true;
    if (!postRegSurveyHasUsesQuestion) return true;
    return postSurveyAnswers[USE_VIVIDBOOKS_QID] === 'no';
  }, [preSurveyQuestions.length, postRegSurveyHasUsesQuestion, postSurveyAnswers]);

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    position: '',
    gdpr: false,
    newsletter: false,
    schoolName: '',
    ico: '',
    schoolAddress: '',
    webinarMotivation: '',
    webinarTopicInterest: '',
    usesVividbooks: '',
    birthDateIso: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  /** `false` = zobrazit registraci / light lead; `true` = dotazník. Ověření e-mailu vůči KV jen po kliknutí na Pokračovat. */
  const [surveyRegOk, setSurveyRegOk] = useState(false);
  /**
   * Celostránkový DVPP bez kroku registrace: e-mail jen po kliknutí na Pokračovat — ne přepínat podle regexu při psaní
   * (jinak např. `jmeno@domena.c` už „projde“ a uživatel nemůže doplnit `.cz`).
   */
  const [dvppEmailGateDone, setDvppEmailGateDone] = useState(false);
  const [savedDvppContacts, setSavedDvppContacts] = useState<SavedDvppContact[]>(() =>
    typeof window !== 'undefined' ? loadSavedDvppContacts() : [],
  );
  useEffect(() => {
    setDvppEmailGateDone(false);
  }, [webinar.id]);
  useEffect(() => {
    if (!isSurveyFullPage || !SKIP_DVPP_SURVEY_REGISTRATION_STEP || dvppEmailGateDone) return;
    setSavedDvppContacts(loadSavedDvppContacts());
  }, [isSurveyFullPage, dvppEmailGateDone, webinar.id]);
  /** Při `SKIP_DVPP_SURVEY_REGISTRATION_STEP` je vždy jako po „Pokračovat“ bez kroku registrace. */
  const surveyRegOkEffective = SKIP_DVPP_SURVEY_REGISTRATION_STEP || surveyRegOk;
  /** Odkaz z připomínkového e-mailu (?dotaznik=1&email=…) — zobrazí poděkování + dotazník bez trial bloku. */
  const [surveyDeepLink, setSurveyDeepLink] = useState(false);
  const [error, setError] = useState('');
  const [notTeacher, setNotTeacher] = useState(false);
  /** Z API po registraci — stejné odkazy jako v e-mailu (vividbooks.com, kalendář Praha). */
  const [postReg, setPostReg] = useState<{
    streamUrl: string;
    calendar: { googleUrl: string; outlookUrl: string; icsBase64: string | null } | null;
  } | null>(null);

  const [schoolResults, setSchoolResults] = useState<{ ico: string; name: string; address?: string }[]>([]);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolSearching, setSchoolSearching] = useState(false);
  const schoolContainerRef = useRef<HTMLDivElement>(null);
  const schoolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (schoolContainerRef.current && !schoolContainerRef.current.contains(e.target as Node)) setSchoolOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /** Staré odkazy `?dotaznik=1` u minulého webináře → `dvppDotaznik=1` (nebo jen odstranit při `prehled=1`). */
  useLayoutEffect(() => {
    if (!webinar.isPast || dotaznikQ !== '1' || postSurveyMerged.length === 0) return;
    const sp = new URLSearchParams(searchParams);
    sp.delete('dotaznik');
    if (sp.get('prehled') === '1') {
      navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
      return;
    }
    sp.set('dvppDotaznik', '1');
    navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
  }, [webinar.isPast, webinar.id, dotaznikQ, postSurveyMerged.length, searchParams, navigate, location.pathname]);

  /** Minulý webinář s obsahem po akci: doplnit `?dvppDotaznik=1` (celostránkový DVPP). `?prehled=1` = klasická stránka. */
  useLayoutEffect(() => {
    if (!webinar.isPast || postSurveyMerged.length === 0) return;
    const sp = new URLSearchParams(searchParams);
    if (sp.get('dvppDotaznik') === '1' || sp.get('prehled') === '1') return;
    sp.set('dvppDotaznik', '1');
    navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
  }, [
    webinar.isPast,
    webinar.id,
    postSurveyMerged.length,
    searchParams,
    navigate,
    location.pathname,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get('email');
    const em = raw ? safeDecodeURIComponent(raw.trim()) : '';
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return;

    const isDvpp = sp.get('dvppDotaznik') === '1';
    const isPre = sp.get('dotaznik') === '1';

    if (isDvpp) {
      if (!webinar.isPast || postSurveyMerged.length === 0) return;
      setForm((prev) => ({ ...prev, email: em }));
      setSurveyDeepLink(true);
      setSurveyRegOk(false);
      window.history.replaceState({}, '', `${window.location.pathname}?dvppDotaznik=1`);
      return;
    }

    if (isPre) {
      if (webinar.isPast || preSurveyQuestions.length === 0) return;
      setForm((prev) => ({ ...prev, email: em }));
      setSubmitted(true);
      setSurveyDeepLink(true);
      window.history.replaceState({}, '', `${window.location.pathname}?dotaznik=1`);
    }
  }, [webinar.id, webinar.isPast, postSurveyMerged.length, preSurveyQuestions.length]);

  /** Scroll k #webinar-dotazník — jen před webinářem (deep link z připomínky). */
  useEffect(() => {
    if (!surveyDeepLink || preSurveyQuestions.length === 0) return;
    if (webinar.isPast) return;
    const t = window.setTimeout(() => {
      document.getElementById('webinar-dotaznik')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
    return () => window.clearTimeout(t);
  }, [surveyDeepLink, webinar.id, preSurveyQuestions.length, webinar.isPast]);

  const fetchSchools = async (q: string) => {
    if (q.trim().length < 2) { setSchoolResults([]); setSchoolOpen(false); return; }
    setSchoolSearching(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/school-search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      setSchoolResults(data.results || []);
      setSchoolOpen((data.results || []).length > 0);
    } catch { setSchoolResults([]); }
    finally { setSchoolSearching(false); }
  };

  const handleSchoolNameChange = (v: string) => {
    setForm(prev => ({ ...prev, schoolName: v }));
    if (schoolTimer.current) clearTimeout(schoolTimer.current);
    schoolTimer.current = setTimeout(() => fetchSchools(v), 350);
    setError('');
  };

  const handleSchoolSelect = (school: { ico: string; name: string; address?: string }) => {
    setForm((prev) => ({
      ...prev,
      schoolName: school.name,
      ico: school.ico,
      schoolAddress: typeof school.address === 'string' ? school.address.trim() : '',
    }));
    setSchoolOpen(false);
    setSchoolResults([]);
  };

  const handleIcoChange = (v: string) => {
    setForm(prev => ({ ...prev, ico: v.replace(/\D/g, '').slice(0, 10) }));
    setError('');
  };

  const applySavedDvppContact = useCallback((c: SavedDvppContact) => {
    setForm((prev) => ({
      ...prev,
      name: c.name,
      email: c.email,
      birthDateIso: c.birthDateIso,
      schoolName: c.schoolName,
      ico: c.ico,
      schoolAddress: '',
    }));
    setSchoolOpen(false);
    setSchoolResults([]);
    setError('');
  }, []);

  const others = webinars.filter(w => w.id !== webinar.id && !w.isPast).slice(0, 2);

  const webinarStart = new Date(
    webinar.year,
    (webinar.monthNum || 1) - 1,
    webinar.day || 1,
    ...((webinar.time || '18:00').split(':').map(Number) as [number, number])
  );
  const webinarEnd = new Date(webinarStart.getTime() + 90 * 60000);
  const nowMs = Date.now();
  const diffMin = (nowMs - webinarStart.getTime()) / 60000;
  const showLiveButton = !webinar.isPast && diffMin > -30 && diffMin < 150;

  const devImminentId = typeof localStorage !== 'undefined' ? localStorage.getItem('vvb_dev_imminent') : null;
  const isDevPreview = devImminentId === webinar.id;
  const showDirectEntry = isDevPreview && !webinar.isPast;

  const siteOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const liveUrl = `${siteOrigin}/webinar/${webinar.id}/live`;

  const downloadIcsFromApi = () => {
    const b64 = postReg?.calendar?.icsBase64;
    if (!b64) {
      downloadIcs();
      return;
    }
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webinar-${webinar.slug || webinar.id}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      downloadIcs();
    }
  };

  const downloadIcs = () => {
    const fmt = (d: Date) => d.toISOString().replace(/[-:]|\\.\\d{3}/g, '').slice(0, 15) + 'Z';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vividbooks//Webinar//CS',
      'BEGIN:VEVENT',
      `UID:webinar-${webinar.id}@vividbooks.cz`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(webinarStart)}`,
      `DTEND:${fmt(webinarEnd)}`,
      `SUMMARY:${webinar.title}`,
      `DESCRIPTION:Webin\u00e1\u0159 Vividbooks\\nP\u0159ipojte se: ${liveUrl}`,
      `URL:${liveUrl}`,
      `LOCATION:${liveUrl}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `webinar-${webinar.id}.ics`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const dvppGateValid = useMemo(() => {
    const icoD = form.ico.replace(/\D/g, '');
    return (
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(form.birthDateIso.trim()) &&
      form.schoolName.trim().length > 0 &&
      icoD.length >= 8
    );
  }, [form.name, form.email, form.birthDateIso, form.schoolName, form.ico]);

  const handleTogglePedagogMode = useCallback(() => {
    setNotTeacher((v) => {
      const next = !v;
      if (!v) {
        setForm((prev) => ({ ...prev, schoolName: '', ico: '', schoolAddress: '' }));
        setSchoolResults([]);
        setSchoolOpen(false);
      }
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notTeacher && !form.schoolName.trim()) {
      setError('Vypl\u0148te pros\u00edm n\u00e1zev \u0161koly.');
      return;
    }
    if (!notTeacher && !form.ico.trim()) {
      setError('Vypl\u0148te pros\u00edm I\u010cO \u0161koly.');
      return;
    }
    if (!form.name.trim() || !form.email.trim() || !form.position) {
      setError('Vypl\u0148te pros\u00edm v\u0161echna povinn\u00e1 pole.');
      return;
    }
    if (!form.gdpr) {
      setError('Souhlas se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f je povinn\u00fd.');
      return;
    }
    if (!form.webinarMotivation.trim() || !form.webinarTopicInterest.trim()) {
      setError(
        'Vypl\u0148te pros\u00edm motivaci registrace a to, co v\u00e1s u t\u00e9matu nejv\u00edce zaj\u00edm\u00e1.',
      );
      return;
    }
    if (form.usesVividbooks !== 'yes' && form.usesVividbooks !== 'no') {
      setError('Vyberte pros\u00edm u polo\u017eky \u201ePou\u017e\u00edv\u00e1m Vividbooks\u201c mo\u017enost Ano nebo Ne.');
      return;
    }
    if (isSurveyFullPage && requireFullSurveyReg) {
      const em = form.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setError('Vypl\u0148te pros\u00edm platn\u00fd e-mail.');
      return;
      }
      setSubmitting(true);
      setError('');
      try {
        const checkRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/public/webinar-registration-check?webinarId=${encodeURIComponent(String(webinar.id))}&email=${encodeURIComponent(em)}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData.registered) {
          setSurveyRegOk(true);
          return;
        }
      } catch {
        setError('Nepoda\u0159ilo se ov\u011b\u0159it registraci. Zkuste to pros\u00edm znovu.');
        return;
      } finally {
        setSubmitting(false);
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/webinar-registrace`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            webinarId: webinar.id,
            webinarTitle: webinar.title,
            webinarSlug: webinar.slug || webinar.id,
            /** Termín + tag pro Mailchimp / Mandrill (Edge nemusí mít v KV čerstvá data) */
            webinarDay: webinar.day,
            webinarMonthNum: webinar.monthNum,
            webinarYear: webinar.year,
            webinarTime: webinar.time,
            webinarMonthName: webinar.monthName,
            mailchimpTagName: webinar.mailchimpTagName,
            notTeacher,
            ...form,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && isSurveyFullPage) {
          setSurveyRegOk(true);
          setSubmitting(false);
          return;
        }
        throw new Error(data.error || 'Registrace se nepoda\u0159ila.');
      }
      const data = await res.json().catch(() => ({}));
      if (typeof data.streamUrl === 'string' && data.streamUrl) {
        setPostReg({
          streamUrl: data.streamUrl,
          calendar:
            data.calendar &&
            typeof data.calendar.googleUrl === 'string' &&
            typeof data.calendar.outlookUrl === 'string'
              ? {
                  googleUrl: data.calendar.googleUrl,
                  outlookUrl: data.calendar.outlookUrl,
                  icsBase64:
                    typeof data.calendar.icsBase64 === 'string' && data.calendar.icsBase64
                      ? data.calendar.icsBase64
                      : null,
                }
              : null,
        });
      } else {
        setPostReg(null);
      }
      if (isSurveyFullPage) {
        setSurveyRegOk(true);
      } else {
      setSubmitted(true);
      }
    } catch (err: any) {
      console.error('Webinar registration error:', err);
      setError(err.message || 'Nastala chyba p\u0159i odes\u00edl\u00e1n\u00ed. Zkuste to pros\u00edm znovu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLightLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Vyplňte prosím jméno, e-mail a telefon.');
      return;
    }
    if (!form.gdpr) {
      setError('Souhlas se zpracováním osobních údajů je povinný.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/webinar-survey-light-lead`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            webinarId: webinar.id,
            webinarTitle: webinar.title,
            webinarSlug: webinar.slug || webinar.id,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            gdpr: true,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Odeslání se nezdařilo.');
      setSurveyRegOk(true);
    } catch (err: any) {
      console.error('Webinar light lead error:', err);
      setError(err.message || 'Nastala chyba při odesílání. Zkuste to prosím znovu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSurveyFullPage) {
    if (!SKIP_DVPP_SURVEY_REGISTRATION_STEP && needsDvppForSurveyFlag && dvppVideosLoading) {
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center bg-[#E8EBF4] px-6 py-16">
          <SEOHead
            title={`${webinar.title} — dotazník`}
            path={`/webinar/${webinar.id}`}
            description={`Dotazník po webináři: ${webinar.title}`}
            jsonLd={webinarJsonLd({
              name: webinar.title,
              description: webinar.title,
              startDate: `${webinar.year}-${String(webinar.monthNum || 1).padStart(2, '0')}-${String(webinar.day || 1).padStart(2, '0')}T${webinar.time || '17:00'}:00`,
              url: marketingUrl(`/webinar/${webinar.id}`),
            })}
          />
          <Loader2 className="h-10 w-10 animate-spin text-[#001161]" aria-hidden />
          <p className="mt-4 font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/70">
            {'Na\u010d\u00edt\u00e1m nastaven\u00ed dotazn\u00edku\u2026'}
          </p>
        </div>
      );
    }
    if (SKIP_DVPP_SURVEY_REGISTRATION_STEP && !dvppEmailGateDone) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[#E8EBF4]"
        >
          <SEOHead
            title={`${webinar.title} — dotazník`}
            path={`/webinar/${webinar.id}`}
            description={`Dotazník po webináři: ${webinar.title}`}
            jsonLd={webinarJsonLd({
              name: webinar.title,
              description: webinar.title,
              startDate: `${webinar.year}-${String(webinar.monthNum || 1).padStart(2, '0')}-${String(webinar.day || 1).padStart(2, '0')}T${webinar.time || '17:00'}:00`,
              url: marketingUrl(`/webinar/${webinar.id}`),
            })}
          />
          <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-4 px-4 py-10 sm:px-6">
            <h1 className="text-center font-['Cooper_Light',serif] text-[26px] text-[#001161] sm:text-[30px]">
              {'Dotazn\u00edk po webin\u00e1\u0159i'}
            </h1>
            <p className="text-center font-['Fenomen_Sans',sans-serif] text-[14px] leading-relaxed text-[#001161]/75">
              {
                'Vypl\u0148te \u00fadaje pro ulo\u017een\u00ed odpov\u011bd\u00ed a certifik\u00e1t. Pot\u00e9 pokra\u010dujte k dotazn\u00edku \u2014 bez p\u0159ihl\u00e1\u0161en\u00ed.'
              }
            </p>
            <div className="rounded-[28px] border border-[#001161]/10 bg-[#F0F2F8] px-5 py-8 md:px-10">
              <label className="mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]">
                {'Jm\u00e9no a p\u0159\u00edjmen\u00ed *'}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
                placeholder="Jana Nováková"
                autoComplete="name"
                autoFocus
              />
              <label className="mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]">
                {'E-mail *'}
              </label>
              <input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
                placeholder="vas@email.cz"
                autoComplete="email"
              />
              <label className="mb-2 block font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161]">
                {'Datum narozen\u00ed *'}
              </label>
              <input
                type="date"
                value={form.birthDateIso}
                onChange={(e) => handleChange('birthDateIso', e.target.value)}
                className="mb-4 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
              />
              <p className="mb-2 font-['Fenomen_Sans',sans-serif] text-[11px] font-bold uppercase tracking-wider text-[#001161]/40">
                {'\u0160kola (vyhled\u00e1v\u00e1n\u00ed) *'}
              </p>
              <div ref={schoolContainerRef} className="relative mb-3">
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={(e) => handleSchoolNameChange(e.target.value)}
                  onFocus={() => schoolResults.length > 0 && setSchoolOpen(true)}
                  placeholder="Název školy"
                  autoComplete="off"
                  className="w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 pr-10 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
                />
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30">
                  {schoolSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </div>
                <AnimatePresence>
                  {schoolOpen && schoolResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-[100] mt-1 max-h-[220px] w-full overflow-y-auto rounded-2xl border border-[#001161]/10 bg-white py-1 shadow-xl"
                    >
                      {schoolResults.map((s, i) => (
                        <button
                          key={`${s.ico}-${i}`}
                          type="button"
                          onClick={() => handleSchoolSelect(s)}
                          className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F0F2F8]"
                        >
                          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#001161]/30 transition-colors group-hover:text-[#5B4FD8]" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold leading-tight text-[#001161]">
                              {s.name}
                            </p>
                            {s.address ? (
                              <p className="mt-0.5 font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40">
                                {s.address}
                                {' · IČO: '}
                                {s.ico}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={form.ico}
                onChange={(e) => handleIcoChange(e.target.value)}
                placeholder="IČO školy"
                maxLength={10}
                className="mb-5 w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
              />
              <button
                type="button"
                disabled={!dvppGateValid}
                onClick={() => {
                  rememberDvppContact({
                    name: form.name,
                    email: form.email,
                    birthDateIso: form.birthDateIso,
                    schoolName: form.schoolName,
                    ico: form.ico,
                  });
                  setSavedDvppContacts(loadSavedDvppContacts());
                  setDvppEmailGateDone(true);
                }}
                className="w-full rounded-[14px] bg-[#001161] py-3.5 font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-white shadow-md transition hover:bg-[#001a8c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {'Pokra\u010dovat k dotazn\u00edku'}
              </button>
            </div>
            {savedDvppContacts.length > 0 && (
              <div className="mt-1 w-full rounded-[20px] border border-[#001161]/10 bg-white/90 px-4 py-3 shadow-sm">
                <p className="mb-2 font-['Fenomen_Sans',sans-serif] text-[12px] font-bold text-[#001161]/70">
                  {'Ulo\u017een\u00e9 identity:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {savedDvppContacts.map((c, i) => (
                    <button
                      key={`${c.savedAt}-${i}`}
                      type="button"
                      onClick={() => applySavedDvppContact(c)}
                      title={`${c.email}\n${c.schoolName}${c.ico ? ` · IČO ${c.ico}` : ''}`}
                      className="inline-flex max-w-full items-center rounded-full border border-[#001161]/15 bg-[#f8f9fc] px-3.5 py-1.5 font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161] transition-colors hover:border-[#5b4fd8]/45 hover:bg-[#fafaff]"
                    >
                      {c.name.trim() || c.email}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      );
    }
    if (!surveyRegOkEffective) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[#E8EBF4]"
        >
          <SEOHead
            title={`${webinar.title} — registrace`}
            path={`/webinar/${webinar.id}`}
            description={`Registrace a dotazník po webináři: ${webinar.title}`}
            jsonLd={webinarJsonLd({
              name: webinar.title,
              description: webinar.title,
              startDate: `${webinar.year}-${String(webinar.monthNum || 1).padStart(2, '0')}-${String(webinar.day || 1).padStart(2, '0')}T${webinar.time || '17:00'}:00`,
              url: marketingUrl(`/webinar/${webinar.id}`),
            })}
          />
          <div className="mx-auto grid w-full max-w-[560px] flex-1 content-start gap-4 px-4 py-8 sm:px-6">
            <h1 className="font-['Cooper_Light',serif] text-center text-[26px] text-[#001161] sm:text-[30px]">
              {requireFullSurveyReg
                ? 'Nejd\u0159\u00edve registrace k webin\u00e1\u0159i'
                : 'Nejd\u0159\u00edve vypl\u0148te kontakt'}
            </h1>
            <p className="text-center font-['Fenomen_Sans',sans-serif] text-[14px] leading-relaxed text-[#001161]/75">
              {requireFullSurveyReg
                ? 'Pro odesl\u00e1n\u00ed odpov\u011bd\u00ed v dotazn\u00edku mus\u00edte b\u00fdt p\u0159ihl\u00e1\u0161eni stejn\u00fdm e-mailem jako u registrace na webin\u00e1\u0159. Vypl\u0148te formul\u00e1\u0159 \u2014 po ulo\u017een\u00ed pokra\u010dujete k dotazn\u00edku.'
                : 'Pro dokon\u010den\u00ed dotazn\u00edku pot\u0159ebujeme jm\u00e9no, e-mail a telefon. Po odesl\u00e1n\u00ed pokra\u010dujete k dotazn\u00edku.'}
            </p>
            <div className="rounded-[28px] bg-[#F0F2F8] px-5 py-8 md:px-10">
              {requireFullSurveyReg ? (
                <WebinarRegistrationFormFields
                  form={form}
                  notTeacher={notTeacher}
                  onTogglePedagogMode={handleTogglePedagogMode}
                  handleChange={handleChange}
                  handleSubmit={handleSubmit}
                  handleSchoolNameChange={handleSchoolNameChange}
                  handleSchoolSelect={handleSchoolSelect}
                  handleIcoChange={handleIcoChange}
                  schoolContainerRef={schoolContainerRef}
                  schoolResults={schoolResults}
                  schoolOpen={schoolOpen}
                  setSchoolOpen={setSchoolOpen}
                  schoolSearching={schoolSearching}
                  error={error}
                  submitting={submitting}
                  positions={POSITIONS}
                  submitButtonText={'Pokra\u010dovat k dotazn\u00edku'}
                />
              ) : (
                <form onSubmit={handleLightLeadSubmit} noValidate className="flex flex-col gap-3">
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Jméno a příjmení *"
                    className="w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
                  />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="E-mail *"
                    className="w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
                  />
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="Telefon *"
                    className="w-full rounded-[12px] border border-[#001161]/10 bg-white px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
                  />
                  <label className="mt-1 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.gdpr}
                      onChange={() => handleChange('gdpr', !form.gdpr)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[#001161]/20 text-[#5B4FD8] focus:ring-[#5B4FD8]/30"
                    />
                    <span className="font-['Fenomen_Sans',sans-serif] text-[13px] leading-snug text-[#001161]/70">
                      {'Souhlas\u00edm se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f podle\u00a0'}
                      <a
                        href="https://www.vividbooks.cz/gdpr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#5B4FD8] underline"
                      >
                        {'Z\u00e1sad ochrany osobn\u00edch \u00fadaj\u016f'}
                      </a>
                      {'. *'}
                    </span>
                  </label>
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-red-600">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 w-full rounded-[14px] bg-[#FF8C00] py-4 font-['Fenomen_Sans',sans-serif] text-[16px] font-bold text-white shadow-[0_6px_20px_rgba(255,140,0,0.35)] transition-all hover:bg-[#e67d00] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  >
                    {submitting ? 'Odesílám…' : 'Pokračovat k dotazníku'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#E8EBF4]"
      >
        <SEOHead
          title={`${webinar.title} — dotazník`}
          path={`/webinar/${webinar.id}`}
          description={`Dotazník po webináři: ${webinar.title}`}
          jsonLd={webinarJsonLd({
            name: webinar.title,
            description: webinar.title,
            startDate: `${webinar.year}-${String(webinar.monthNum || 1).padStart(2, '0')}-${String(webinar.day || 1).padStart(2, '0')}T${webinar.time || '17:00'}:00`,
            url: marketingUrl(`/webinar/${webinar.id}`),
          })}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WebinarPostSurvey
            webinar={webinar}
            email={form.email}
            participantName={form.name}
            participantBirthDateIso={form.birthDateIso}
            participantSchoolName={form.schoolName}
            participantSchoolIco={form.ico.replace(/\D/g, '')}
            onAnswersChange={onPostSurveyAnswersChange}
            scope="post"
            variant="fullscreen"
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-white"
    >
      <SEOHead
        title={webinar.title}
        path={`/webinar/${webinar.id}`}
        description={`DVPP webin\u00e1\u0159: ${webinar.title} \u2014 ${webinar.day}. ${webinar.monthName} ${webinar.year} v ${webinar.time}. Online semin\u00e1\u0159 pro u\u010ditele zdarma s certifik\u00e1tem.`}
        jsonLd={webinarJsonLd({
          name: webinar.title,
          description: webinar.title,
          startDate: `${webinar.year}-${String(webinar.monthNum || 1).padStart(2, '0')}-${String(webinar.day || 1).padStart(2, '0')}T${webinar.time || '17:00'}:00`,
          url: marketingUrl(`/webinar/${webinar.id}`),
        })}
      />

      {/* Breadcrumb — na mobilu v toku stránky, na desktopu pod horní lištou */}
      <div className="relative z-30 border-b border-[#001161]/6 bg-white md:sticky md:top-14 md:bg-white/90 md:backdrop-blur-md">
        <div className="max-w-[900px] mx-auto px-6 h-14 flex items-center gap-2">
          <button
            onClick={() => navigate('/webinare')}
            className="flex items-center gap-1.5 text-[#001161]/60 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            {'Webin\u00e1\u0159e'}
          </button>
          <span className="text-[#001161]/20 text-[13px]">/</span>
          <span className="text-[#001161] font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold truncate max-w-[300px]">
            {webinar.title}
          </span>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-10">

        {/* Live banner */}
        {showLiveButton && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center justify-between gap-4 bg-red-600 rounded-2xl px-6 py-4 shadow-lg shadow-red-600/20"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                <Radio className="w-4 h-4 text-white animate-pulse" />
              </span>
              <div>
                <p className="font-['Fenomen_Sans',sans-serif] font-bold text-white text-[15px] leading-tight">
                  {diffMin >= 0 ? 'Webin\u00e1\u0159 pr\u00e1v\u011b prob\u00edh\u00e1!' : `Za\u010d\u00edn\u00e1me za ${Math.abs(Math.round(diffMin))} min`}
                </p>
                <p className="font-['Fenomen_Sans',sans-serif] text-white/70 text-[12px]">
                  {'Vstupte na \u017eiv\u00e9 vys\u00edl\u00e1n\u00ed a potvrdte svou \u00fa\u010dast.'}
                </p>
              </div>
            </div>
            <a
              href={`/webinar/${webinar.id}/live`}
              className="shrink-0 bg-white hover:bg-gray-100 text-red-600 font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-2.5 rounded-full transition-all hover:scale-105 no-underline"
            >
              {'Vstoupit na stream \u2192'}
            </a>
          </motion.div>
        )}

        {/* Webinar hero card */}
        <div className="flex justify-center mb-10">
          <div className="bg-[#F0F2F8] rounded-[24px] overflow-hidden w-full max-w-[600px]">
            <WebinarThumbnail
              title={webinar.title}
              subtitle={webinar.subtitle}
              day={webinar.day}
              monthName={webinar.monthName}
              time={webinar.time}
              lecturer={webinar.lecturer}
              lecturerAvatar={webinar.lecturerAvatar}
              variant={webinar.thumbnailVariant}
              coverImage={webinar.coverImage}
            />
            <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex flex-col items-center bg-white rounded-[14px] px-4 py-2.5 min-w-[56px] shrink-0">
                <span className="font-['Fenomen_Sans',sans-serif] font-black text-[#001158] text-[26px] leading-none">
                  {webinar.day}
                </span>
                <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001158]/60 leading-tight">
                  {webinar.monthName}
                </span>
                <span className="font-['Fenomen_Sans',sans-serif] font-bold text-[13px] leading-none mt-0.5" style={{ color: '#FF8C00' }}>
                  {webinar.time}
                </span>
              </div>
              <div className="flex-1">
                <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[24px] md:text-[30px] leading-tight mb-2">
                  {webinar.title}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-white/80 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[12px] px-3 py-1 rounded-full border border-[#001161]/10">
                    {'Lekto\u0159i: '}{webinar.lecturer}
                  </span>
                  {webinar.targetAudience && (
                    <span className="bg-white/80 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[12px] px-3 py-1 rounded-full border border-[#001161]/10">
                      {webinar.targetAudience}
                    </span>
                  )}
                </div>
              </div>
              {!webinar.isPast && (
                <div className="shrink-0 flex items-center gap-2">
                  <a
                    href="#registrace"
                    className="bg-[#FF8C00] hover:bg-[#e67d00] text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer no-underline shadow-[0_4px_16px_rgba(255,140,0,0.35)]"
                  >
                    {'P\u0159ihl\u00e1sit se'}
                  </a>
                  {(showDirectEntry || showLiveButton) && (
                    <button
                      onClick={() => navigate(`/webinar/${webinar.id}/live`)}
                      className="flex items-center gap-2 bg-[#001161] hover:bg-[#001161]/85 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_4px_16px_rgba(0,17,97,0.25)]"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      {'Otev\u0159\u00edt webin\u00e1\u0159'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mb-8 max-w-[680px]">
          <div
            className="font-['Fenomen_Sans',sans-serif] text-[#001161] text-[18px] leading-[1.7] font-semibold mb-5 webinar-richtext"
            dangerouslySetInnerHTML={{ __html: webinar.description }}
          />
          {webinar.perks && (
            <div
              className="font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[15px] leading-relaxed webinar-richtext"
              dangerouslySetInnerHTML={{ __html: webinar.perks }}
            />
          )}
        </div>

        {/* Minulý webinář: kvíz + dotazník (ne při ?dvppDotaznik=1 — ten je celostránkově výše) */}
        {webinar.isPast && postSurveyMerged.length > 0 && dvppDotaznikQ !== '1' && (
          <div className="mb-10 max-w-[560px] mx-auto">
            <div className="mb-5 rounded-2xl border border-[#001161]/10 bg-[#F8FAFC] px-5 py-4">
              <p className="font-['Fenomen_Sans',sans-serif] text-[13px] font-semibold text-[#001161] mb-2">
                {'E-mail pro odesl\u00e1n\u00ed odpov\u011bd\u00ed'}
              </p>
              <input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-[#001161]/12 bg-white px-3 py-2.5 text-[14px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 font-['Fenomen_Sans',sans-serif]"
                placeholder="vas@email.cz"
                autoComplete="email"
              />
            </div>
            <WebinarPostSurvey
              webinar={webinar}
              email={form.email}
              participantName={form.name}
              onAnswersChange={onPostSurveyAnswersChange}
              scope="post"
            />
          </div>
        )}

        {/* Registration form */}
        {!webinar.isPast && (
          <div id="registrace" className="max-w-[560px] mx-auto">
            <div className="bg-[#F0F2F8] rounded-[28px] px-6 md:px-10 py-8">
              <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] text-center mb-6">
                {'P\u0159ihlaste se na webin\u00e1\u0159'}
              </h2>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-6 gap-4"
                >
                  <CheckCircle className="w-14 h-14 text-[#27ae60]" />
                  <p className="font-['Fenomen_Sans',sans-serif] text-[#001161] text-[18px] font-bold">
                    {'D\u011bkujeme za va\u0161i registraci'}
                  </p>
                  <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/60 text-[14px] max-w-[360px]">
                    {webinar.day}{`.\u00a0`}{webinar.monthName}{`.\u00a0`}{webinar.year}{` v\u00a0`}{webinar.time}
                    {` \u2014 t\u011b\u0161\u00edme se na va\u0161i \u00fa\u010dast!`}
                  </p>
                  <a
                    href={postReg?.streamUrl || liveUrl}
                    className={
                      showLiveButton
                        ? 'w-full flex items-center justify-between gap-3 bg-red-600 hover:bg-red-700 text-white font-[\'Fenomen_Sans\',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all hover:scale-[1.02] no-underline shadow-lg shadow-red-600/20'
                        : 'w-full flex items-center justify-between gap-3 bg-[#001161] hover:bg-[#001161]/90 text-white font-[\'Fenomen_Sans\',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all hover:scale-[1.02] no-underline shadow-lg shadow-[#001161]/25'
                    }
                  >
                    <span className="flex items-center gap-2 text-left">
                      <Radio className={`w-4 h-4 shrink-0 ${showLiveButton ? 'animate-pulse' : ''}`} />
                      {showLiveButton
                        ? 'Sledovat webin\u00e1\u0159 live'
                        : 'Odkaz na \u017eiv\u00fd p\u0159enos (v den akce)'}
                    </span>
                    <span className="text-white/70 text-[12px] font-normal truncate max-w-[160px]">
                      {(postReg?.streamUrl || liveUrl).replace(/^https?:\/\//, '')}
                    </span>
                  </a>
                  {!showLiveButton ? (
                    <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/50 max-w-[360px] -mt-2">
                      {'\u017eiv\u00fd p\u0159enos b\u011b\u017e\u00ed a\u017e v napl\u00e1novan\u00fd \u010das \u2014 odkaz si ulo\u017ete nebo p\u0159idejte ud\u00e1lost do kalend\u00e1\u0159e n\u00ed\u017ee.'}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={downloadIcsFromApi}
                    className="w-full flex items-center justify-center gap-2.5 bg-white border border-[#001161]/12 hover:border-[#001161]/25 hover:bg-[#f0f2f8] text-[#001161] font-['Fenomen_Sans',sans-serif] font-bold text-[14px] px-5 py-3.5 rounded-2xl transition-all"
                  >
                    <Calendar className="w-5 h-5 shrink-0 text-[#001161]/80" />
                    {'P\u0159idat do kalend\u00e1\u0159e'}
                  </button>

                  <WebinarPostSurvey
                    webinar={webinar}
                    email={form.email}
                    participantName={form.name}
                    onAnswersChange={onPostSurveyAnswersChange}
                    scope="pre"
                  />

                  {showPostRegistrationTrial && !surveyDeepLink ? (
                    <WebinarPostRegistrationTrial
                      form={{
                        name: form.name,
                        email: form.email,
                        phone: form.phone,
                        position: form.position,
                        gdpr: form.gdpr,
                        newsletter: form.newsletter,
                        schoolName: form.schoolName,
                        ico: form.ico,
                      }}
                      notTeacher={notTeacher}
                    />
                  ) : null}
                </motion.div>
              ) : (
                <WebinarRegistrationFormFields
                  form={form}
                  notTeacher={notTeacher}
                  onTogglePedagogMode={handleTogglePedagogMode}
                  handleChange={handleChange}
                  handleSubmit={handleSubmit}
                  handleSchoolNameChange={handleSchoolNameChange}
                  handleSchoolSelect={handleSchoolSelect}
                  handleIcoChange={handleIcoChange}
                  schoolContainerRef={schoolContainerRef}
                  schoolResults={schoolResults}
                  schoolOpen={schoolOpen}
                  setSchoolOpen={setSchoolOpen}
                  schoolSearching={schoolSearching}
                  error={error}
                  submitting={submitting}
                  positions={POSITIONS}
                />
              )}
            </div>
          </div>
        )}

        {/* Other upcoming webinars */}
        {others.length > 0 && (
          <div className="mt-16 pb-12">
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[30px] text-center mb-8">
              {'Dal\u0161\u00ed nadch\u00e1zej\u00edc\u00ed webin\u00e1\u0159e'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-[700px] mx-auto">
              {others.map(w => (
                <WebinarCard key={w.id} webinar={w} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}