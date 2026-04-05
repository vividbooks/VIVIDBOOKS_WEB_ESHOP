import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, CheckCircle, AlertCircle, Radio, Calendar, Search, Building2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Webinar } from '../data/webinars';
import { useWebinars } from '../contexts/WebinarsContext';
import { WebinarThumbnail } from './WebinarThumbnail';
import { WebinarCard } from './WebinarCard';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { SEOHead, webinarJsonLd } from './SEOHead';
import { WebinarPostRegistrationTrial } from './WebinarPostRegistrationTrial';
import { WebinarPostSurvey } from './WebinarPostSurvey';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getResolvedWebinarSurveyQuestions } from '../utils/webinarSurveyDefaults';

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
}

interface WebinarDetailPageProps {
  webinar: Webinar;
}

const USE_VIVIDBOOKS_QID = 'uses_vividbooks';

export function WebinarDetailPage({ webinar }: WebinarDetailPageProps) {
  const navigate = useNavigate();
  const { webinars } = useWebinars();

  const postRegSurveyQuestions = useMemo(() => getResolvedWebinarSurveyQuestions(webinar), [webinar]);
  const postRegSurveyHasUsesQuestion = useMemo(
    () => postRegSurveyQuestions.some((q) => q.id === USE_VIVIDBOOKS_QID),
    [postRegSurveyQuestions],
  );
  const [postSurveyAnswers, setPostSurveyAnswers] = useState<Record<string, string>>({});
  const onPostSurveyAnswersChange = useCallback((a: Record<string, string>) => {
    setPostSurveyAnswers(a);
  }, []);

  const showPostRegistrationTrial = useMemo(() => {
    if (postRegSurveyQuestions.length === 0) return true;
    if (!postRegSurveyHasUsesQuestion) return true;
    return postSurveyAnswers[USE_VIVIDBOOKS_QID] === 'no';
  }, [postRegSurveyQuestions.length, postRegSurveyHasUsesQuestion, postSurveyAnswers]);

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    position: '',
    gdpr: false,
    newsletter: false,
    schoolName: '',
    ico: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('dotaznik') !== '1') return;
    const raw = sp.get('email');
    const em = raw ? decodeURIComponent(raw.trim()) : '';
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return;
    if (postRegSurveyQuestions.length === 0) return;
    setForm(prev => ({ ...prev, email: em }));
    setSubmitted(true);
    setSurveyDeepLink(true);
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      document.getElementById('webinar-dotaznik')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 450);
  }, [webinar.id, postRegSurveyQuestions.length]);

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

  const handleSchoolSelect = (school: { ico: string; name: string }) => {
    setForm(prev => ({ ...prev, schoolName: school.name, ico: school.ico }));
    setSchoolOpen(false); setSchoolResults([]);
  };

  const handleIcoChange = (v: string) => {
    setForm(prev => ({ ...prev, ico: v.replace(/\D/g, '').slice(0, 10) }));
    setError('');
  };

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
      : (import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
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
      setSubmitted(true);
    } catch (err: any) {
      console.error('Webinar registration error:', err);
      setError(err.message || 'Nastala chyba p\u0159i odes\u00edl\u00e1n\u00ed. Zkuste to pros\u00edm znovu.');
    } finally {
      setSubmitting(false);
    }
  };

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
          url: `https://www.vividbooks.com/webinar/${webinar.id}`,
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
                    onAnswersChange={onPostSurveyAnswersChange}
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
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">

                  {/* ── Switch: pedagog / certifikát DVPP (ON=zelená, OFF=červená) ── */}
                  <div className="flex items-center justify-between bg-white rounded-[12px] px-4 py-3 border border-[#001161]/10">
                    <div>
                      <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold text-[#001161] leading-tight">
                        {notTeacher ? 'Nejsem pedagog' : 'Jsem pedagog'}
                      </p>
                      <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/45 leading-tight mt-0.5">
                        {notTeacher
                          ? 'Nepot\u0159ebuji certifik\u00e1t DVPP'
                          : 'Po webin\u00e1\u0159i obdr\u017e\u00edm certifik\u00e1t DVPP'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNotTeacher(v => !v);
                        if (!notTeacher) {
                          setForm(prev => ({ ...prev, schoolName: '', ico: '' }));
                          setSchoolResults([]);
                          setSchoolOpen(false);
                        }
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#001161]/30 ${notTeacher ? 'bg-red-500' : 'bg-emerald-600'}`}
                      aria-checked={!notTeacher}
                      role="switch"
                      aria-label={notTeacher ? 'Zapnout režim pedagog s certifikátem DVPP' : 'Vypnout — nejsem pedagog'}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notTeacher ? 'translate-x-0' : 'translate-x-5'}`}
                      />
                    </button>
                  </div>

                  {/* ── Informace o škole (skryje se, pokud není učitel) ── */}
                  <AnimatePresence initial={false}>
                    {!notTeacher && (
                      <motion.div
                        key="school-section"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                        className="flex flex-col gap-3 overflow-visible"
                      >
                        <p className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-1 pl-1">
                          {'Informace o \u0161kole'}
                        </p>

                        <div ref={schoolContainerRef} className="relative">
                          <input
                            type="text"
                            value={form.schoolName}
                            onChange={e => handleSchoolNameChange(e.target.value)}
                            onFocus={() => schoolResults.length > 0 && setSchoolOpen(true)}
                            placeholder={'\u00a0N\u00e1zev \u0161koly'}
                            autoComplete="off"
                            className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 pr-10 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                          />
                          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30">
                            {schoolSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </div>
                          <AnimatePresence>
                            {schoolOpen && schoolResults.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.15 }}
                                className="absolute z-[100] mt-1 w-full bg-white border border-[#001161]/10 rounded-2xl shadow-xl overflow-hidden"
                              >
                                <div className="max-h-[220px] overflow-y-auto py-1">
                                  {schoolResults.map((s, i) => (
                                    <button key={`${s.ico}-${i}`} type="button" onClick={() => handleSchoolSelect(s)}
                                      className="w-full text-left px-4 py-3 hover:bg-[#F0F2F8] transition-colors flex items-start gap-3 group">
                                      <Building2 className="w-4 h-4 text-[#001161]/30 mt-0.5 shrink-0 group-hover:text-[#5B4FD8] transition-colors" />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161] font-semibold leading-tight truncate">{s.name}</p>
                                        {s.address && <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 mt-0.5">{s.address}{' · I\u010cO: '}{s.ico}</p>}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.ico}
                          onChange={e => handleIcoChange(e.target.value)}
                          placeholder={'I\u010cO \u0161koly'}
                          maxLength={10}
                          className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Kontaktní údaje ── */}
                  <p className="font-['Fenomen_Sans',sans-serif] text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-2 pl-1">
                    {'Kontaktn\u00ed \u00fadaje'}
                  </p>

                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder={'Jm\u00e9no a p\u0159\u00edjmen\u00ed *'}
                    className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                  />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder={'V\u00e1\u0161 e-mail *'}
                    className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                  />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    placeholder={'Telefon'}
                    className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                  />

                  <div className="relative">
                    <select
                      required
                      value={form.position}
                      onChange={e => handleChange('position', e.target.value)}
                      className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all appearance-none cursor-pointer"
                      style={{ color: form.position ? '#001161' : 'rgba(0,17,97,0.4)' }}
                    >
                      <option value="" disabled>{'Va\u0161e pozice *'}</option>
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/40">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer mt-1">
                    <div
                      className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${form.gdpr ? 'bg-[#5B4FD8] border-[#5B4FD8]' : 'bg-white border-[#001161]/20'}`}
                      onClick={() => handleChange('gdpr', !form.gdpr)}
                    >
                      {form.gdpr && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/70 leading-snug" onClick={() => handleChange('gdpr', !form.gdpr)}>
                      {'Souhlas\u00edm se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f podle\u00a0'}
                      <a href="https://www.vividbooks.cz/gdpr" target="_blank" rel="noopener noreferrer" className="underline text-[#5B4FD8] hover:opacity-75" onClick={e => e.stopPropagation()}>
                        {'Z\u00e1sad ochrany osobn\u00edch \u00fadaj\u016f'}
                      </a>
                      {'. *'}
                    </span>
                  </label>

                  {/* Stejné jako trial formulář — přepínač + krémový box + copy */}
                  <label className="flex items-start gap-3 cursor-pointer bg-[#FFF7ED] rounded-xl px-4 py-3 border border-[#E8942A]/20">
                    <span className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={form.newsletter}
                        onChange={() => handleChange('newsletter', !form.newsletter)}
                        className="sr-only peer"
                      />
                      <span className="block w-[42px] h-[24px] bg-[#001161]/15 rounded-full peer-checked:bg-[#E8942A] transition-colors" />
                      <span className="absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-[18px]" />
                    </span>
                    <span className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/80 leading-[1.5]">
                      <span className="font-bold text-[#001161]">{'📚 Chci dostávat novinky a tipy do výuky'}</span>
                      <br />
                      {'Novinky, tipy do v\u00fduky a akce \u2014 pos\u00edl\u00e1me je jen tehdy, kdy\u017e stoj\u00ed za p\u0159e\u010dten\u00ed. Bez spamu.'}
                    </span>
                  </label>

                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="font-['Fenomen_Sans',sans-serif] text-red-600 text-[13px]">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#FF8C00] hover:bg-[#e67d00] disabled:opacity-60 text-white font-['Fenomen_Sans',sans-serif] font-bold text-[16px] py-4 rounded-[14px] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2 flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(255,140,0,0.35)]"
                  >
                    {submitting
                      ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{'Odes\u00edl\u00e1m...'}</>
                      : 'P\u0159ihl\u00e1sit'
                    }
                  </button>
                  <p className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 text-center">
                    {'* Povinn\u00e9 pole'}
                  </p>
                </form>
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