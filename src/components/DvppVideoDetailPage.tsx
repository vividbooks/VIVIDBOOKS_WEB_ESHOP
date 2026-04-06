import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Award, Play, ExternalLink, CheckCircle, AlertCircle, Loader2, Search, Building2 } from 'lucide-react';
import { useDvppVideos } from '../contexts/DvppVideosContext';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SEOHead } from './SEOHead';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const ff = "'Fenomen Sans', sans-serif";
const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

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

function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

const STORAGE_KEY = 'dvpp_registered_videos';
function getRegisteredVideos(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function markVideoRegistered(id: string) {
  const arr = getRegisteredVideos();
  if (!arr.includes(id)) { arr.push(id); localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
}

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

export function DvppVideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { videos, topics, loading } = useDvppVideos();

  const video = videos.find(v => v.id === id);

  const emailFromUrl = (searchParams.get('email') || '').trim();
  const emailLooksValid =
    emailFromUrl.length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFromUrl.toLowerCase());
  /** Odkaz z follow-up e-mailu (`?from=email`) — záznam hned přístupný bez registrace / ověření. */
  const fromEmailLink = searchParams.get('from') === 'email';

  const [serverAccessSource, setServerAccessSource] = useState<'webinar' | 'dvpp' | null>(null);
  const [emailAccessDone, setEmailAccessDone] = useState(!emailLooksValid || fromEmailLink);

  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notTeacher, setNotTeacher] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '', email: '', phone: '', position: '',
    gdpr: false, newsletter: false, schoolName: '', ico: '',
  });

  const [schoolResults, setSchoolResults] = useState<{ ico: string; name: string; address?: string }[]>([]);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolSearching, setSchoolSearching] = useState(false);
  const schoolContainerRef = useRef<HTMLDivElement>(null);
  const schoolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (id && getRegisteredVideos().includes(id)) setAlreadyRegistered(true);
  }, [id]);

  useEffect(() => {
    if (fromEmailLink) {
      setServerAccessSource(null);
      setEmailAccessDone(true);
      return;
    }
    if (!emailLooksValid) {
      setServerAccessSource(null);
      setEmailAccessDone(true);
      return;
    }
    if (!id) return;
    let cancelled = false;
    setEmailAccessDone(false);
    (async () => {
      try {
        const res = await fetch(
          `${SERVER}/public/dvpp-recording-access?videoId=${encodeURIComponent(id)}&email=${encodeURIComponent(emailFromUrl)}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.access && (data.source === 'webinar' || data.source === 'dvpp')) {
          setServerAccessSource(data.source);
        } else if (!cancelled) {
          setServerAccessSource(null);
        }
      } finally {
        if (!cancelled) setEmailAccessDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, emailFromUrl, emailLooksValid, fromEmailLink]);

  useEffect(() => {
    if (emailLooksValid && emailFromUrl) {
      setForm((prev) => (prev.email === emailFromUrl ? prev : { ...prev, email: emailFromUrl }));
    }
  }, [emailFromUrl, emailLooksValid]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (schoolContainerRef.current && !schoolContainerRef.current.contains(e.target as Node)) setSchoolOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSchools = async (q: string) => {
    if (q.trim().length < 2) { setSchoolResults([]); setSchoolOpen(false); return; }
    setSchoolSearching(true);
    try {
      const res = await fetch(
        `${SERVER}/school-search?q=${encodeURIComponent(q)}`,
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

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const showVideo =
    alreadyRegistered || submitted || !!serverAccessSource || fromEmailLink;

  const YT_PAT = /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;
  let resolvedYtUrl = video?.youtubeUrl || '';
  if (video && (!resolvedYtUrl || !YT_PAT.test(resolvedYtUrl))) {
    const raw = (video as any)._raw ?? {};
    for (const val of Object.values(raw)) {
      const s = typeof val === 'string' ? val : (typeof val === 'object' && val !== null ? (val as any).url ?? '' : '');
      if (s && YT_PAT.test(String(s))) { resolvedYtUrl = String(s); break; }
    }
  }
  const ytId = resolvedYtUrl ? extractYoutubeId(resolvedYtUrl) : null;

  const videoTopics = video ? topics.filter(t => video.topicIds.includes(t.id)) : [];
  const sameTopicVideos = video
    ? videos.filter(v => v.id !== video.id && v.topicIds.some(tid => video.topicIds.includes(tid))).slice(0, 4)
    : [];

  const orangeText = video?.orangeButtonText || 'Vyzkoušet zdarma';
  const orangeLink = video?.orangeButtonLink || '';
  const certText = video?.greyButtonText || 'Certifikát DVPP';
  const certMode = (video as any)?.certificateLinkMode === 'survey' ? 'survey' : 'external';
  const vSlug = String((video as any)?.slug || video?.id || '');
  const certLinkResolved =
    certMode === 'survey'
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/webinar/${encodeURIComponent(vSlug)}/dvpp-dotaznik`
      : String(video?.certificateUrl || '').trim();
  const showCertButton = certMode === 'survey' || !!certLinkResolved;

  const handleOrangeClick = () => {
    if (orangeLink) window.open(orangeLink, '_blank');
    else navigate('/vyzkousejte');
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
      const res = await fetch(`${SERVER}/dvpp-video-registrace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          videoId: video!.id,
          videoTitle: video!.name,
          videoSlug: (video as any).slug || video!.id,
          youtubeUrl: resolvedYtUrl,
          notTeacher,
          ...form,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Registrace se nezda\u0159ila.');
      markVideoRegistered(video!.id);
      setSubmitted(true);
    } catch (err: any) {
      console.error('DVPP video registration error:', err);
      setError(err.message || 'Nastala chyba p\u0159i odes\u00edl\u00e1n\u00ed. Zkuste to pros\u00edm znovu.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#001161]/40">
          <div className="w-10 h-10 rounded-full border-2 border-[#001161]/20 border-t-[#001161]/60 animate-spin" />
          <p className="text-[14px]" style={{ fontFamily: ff }}>{'Načítám záznam...'}</p>
        </div>
      </div>
    );
  }

  /* ── Ověření e-mailu z odkazu (registrace na webinář / u záznamu), ne když ?from=email ── */
  if (emailLooksValid && !emailAccessDone && !fromEmailLink) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#001161]/40">
          <div className="w-10 h-10 rounded-full border-2 border-[#001161]/20 border-t-[#001161]/60 animate-spin" />
          <p className="text-[14px]" style={{ fontFamily: ff }}>{'Ověřujeme přístup ke záznamu...'}</p>
        </div>
      </div>
    );
  }

  /* ── Not found ───────────────────────────────────────────── */
  if (!video) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-[#001161]/50 text-[15px]" style={{ fontFamily: ff }}>{'Záznam nebyl nalezen.'}</p>
        <Link to="/webinare" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#001161] text-white text-[14px] font-bold hover:opacity-90 transition-opacity" style={{ fontFamily: ff }}>
          <ArrowLeft className="w-4 h-4" />
          {'Zpět na webináře'}
        </Link>
      </div>
    );
  }

  /* ── Video embed component ───────────────────────────────── */
  const VideoEmbed = () => (
    <>
      {ytId ? (
        <div className="relative rounded-[20px] overflow-hidden bg-black shadow-[0_8px_32px_rgba(0,0,0,0.15)]" style={{ aspectRatio: '16/9' }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=1`}
            title={video.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      ) : video.thumbnail ? (
        <div className="relative rounded-[20px] overflow-hidden bg-[#DEE4F1]" style={{ aspectRatio: '16/9' }}>
          <ImageWithFallback src={video.thumbnail} alt={video.name} className="w-full h-full object-cover" />
          {resolvedYtUrl && (
            <a href={resolvedYtUrl} target="_blank" rel="noreferrer"
              className="absolute bottom-4 right-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black/60 text-white text-[13px] font-bold hover:bg-black/80 transition-colors"
              style={{ fontFamily: ff }}>
              <ExternalLink className="w-3.5 h-3.5" />
              {'Otevřít na YouTube'}
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-[20px] bg-[#DEE4F1] flex flex-col items-center justify-center gap-4 text-[#001161]/30" style={{ aspectRatio: '16/9' }}>
          <Play className="w-12 h-12 opacity-30" />
          <p className="text-[14px]" style={{ fontFamily: ff }}>{'Video není k dispozici'}</p>
        </div>
      )}
    </>
  );

  return (
    <>
      <SEOHead
        title={video.name}
        path={`/webinare/zaznam/${video.id}`}
        description={video.description || `Záznam DVPP webináře: ${video.name}`}
        image={video.thumbnail}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="min-h-screen bg-white"
      >
        {/* Zpět */}
        <div className="px-8 md:px-12 pt-6 pb-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#001161]/50 hover:text-[#001161] transition-colors text-[13px] font-bold cursor-pointer"
            style={{ fontFamily: ff }}
          >
            <ArrowLeft className="w-4 h-4" />
            {'Zpět na webináře'}
          </button>
        </div>

        {/* Hlavní layout */}
        <div className="px-8 md:px-12 pt-6 pb-10">

          {/* VIVIDBOOKS + témata */}
          <div className="flex items-center justify-between mb-8">
            <span className="text-[#001161] text-[18px] tracking-tight" style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}>
              VIVIDBOOKS
            </span>
            {videoTopics.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {videoTopics.map(t => (
                  <span key={t.id} className="px-3 py-1 rounded-full bg-[#001161]/6 text-[#001161]/70 text-[12px] font-bold" style={{ fontFamily: ff }}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dvousloupcový layout */}
          <div className="flex flex-col md:flex-row gap-10 md:gap-14 items-start">

            {/* ── Levý sloupec ────────────────────────────────── */}
            <div className="md:w-[260px] shrink-0 flex flex-col gap-5">
              <h1
                className="text-[#001161] text-[30px] md:text-[36px] leading-tight"
                style={{ fontFamily: "'Cooper Light', serif", fontWeight: 300 }}
              >
                {video.name}
              </h1>

              {video.description && (
                <p className="text-[#001161]/55 text-[14px] leading-relaxed" style={{ fontFamily: ff }}>
                  {video.description}
                </p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleOrangeClick}
                  className="w-full py-4 rounded-2xl text-white text-[15px] font-black text-center transition-all hover:opacity-90 active:scale-[0.97] cursor-pointer"
                  style={{ background: '#E8942A', fontFamily: ff, boxShadow: '0 4px 20px rgba(232,148,42,0.30)' }}
                >
                  {orangeText}
                </button>

                {showCertButton && (
                  <button
                    type="button"
                    onClick={() => certLinkResolved && window.open(certLinkResolved, '_blank', 'noopener,noreferrer')}
                    className={`w-full py-4 rounded-2xl text-white text-[15px] font-black text-center transition-all hover:opacity-90 active:scale-[0.97] flex items-center justify-center gap-2.5 ${certLinkResolved ? 'cursor-pointer' : 'cursor-default opacity-50'}`}
                    style={{ background: '#374151', fontFamily: ff }}
                  >
                    <Award className="w-5 h-5" />
                    {certText || 'Certifikát DVPP'}
                  </button>
                )}
              </div>
            </div>

            {/* ── Pravý sloupec ───────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">

                {/* ── VIDEO (po registraci) ─────────────────── */}
                {showVideo ? (
                  <motion.div
                    key="video"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col gap-4"
                  >
                    <VideoEmbed />
                    {serverAccessSource === 'webinar' && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#E8EDF8] border border-[#001161]/12">
                        <CheckCircle className="w-4 h-4 text-[#001161] shrink-0" />
                        <p className="text-[13px] text-[#001161] font-bold" style={{ fontFamily: ff }}>
                          {
                            'Jste přihlášeni jako účastník webináře — záznam je přístupný bez další registrace.'
                          }
                        </p>
                      </div>
                    )}
                    {serverAccessSource === 'dvpp' && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#E8EDF8] border border-[#001161]/12">
                        <CheckCircle className="w-4 h-4 text-[#001161] shrink-0" />
                        <p className="text-[13px] text-[#001161] font-bold" style={{ fontFamily: ff }}>
                          {'Jste již registrováni u tohoto záznamu.'}
                        </p>
                      </div>
                    )}
                    {fromEmailLink && !serverAccessSource && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/80">
                        <CheckCircle className="w-4 h-4 text-amber-800 shrink-0" />
                        <p className="text-[13px] text-amber-950 font-bold" style={{ fontFamily: ff }}>
                          {'Odkaz z e-mailu — záznam máte přístupný bez další registrace.'}
                        </p>
                      </div>
                    )}
                    {submitted && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
                        <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                        <p className="text-[13px] text-green-700 font-bold" style={{ fontFamily: ff }}>
                          {'Registrace proběhla. Potvrzovací e-mail byl odeslán na '}
                          <span className="font-black">{form.email}</span>
                        </p>
                      </div>
                    )}
                  </motion.div>

                ) : (
                  /* ── FORMULÁŘ ─────────────────────────────── */
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Náhled s overlayem */}
                    {(video.thumbnail || ytId) && (
                      <div className="relative rounded-[20px] overflow-hidden mb-6" style={{ aspectRatio: '16/9' }}>
                        <ImageWithFallback
                          src={video.thumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '')}
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-[#001161]/65 flex flex-col items-center justify-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center backdrop-blur-sm">
                            <Play className="w-7 h-7 text-white ml-1" fill="white" />
                          </div>
                          <p className="text-white text-[14px] font-bold px-6 text-center" style={{ fontFamily: ff }}>
                            {'Pro přístup k záznamu se prosím zaregistrujte'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Formulář — stejný jako webinář */}
                    <div className="bg-[#F0F2F8] rounded-[28px] px-6 md:px-10 py-8">
                      <h2 className="text-[#001161] text-[28px] text-center mb-6" style={{ fontFamily: "'Cooper Light', serif" }}>
                        {'Přihlaste se ke sledování'}
                      </h2>

                      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">

                        {/* Toggle: pedagog / certifikát DVPP (ON=zelená, OFF=červená) */}
                        <div className="flex items-center justify-between bg-white rounded-[12px] px-4 py-3 border border-[#001161]/10">
                          <div>
                            <p className="text-[14px] font-semibold text-[#001161] leading-tight" style={{ fontFamily: ff }}>
                              {notTeacher ? 'Nejsem pedagog' : 'Jsem pedagog'}
                            </p>
                            <p className="text-[12px] text-[#001161]/45 leading-tight mt-0.5" style={{ fontFamily: ff }}>
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
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notTeacher ? 'translate-x-0' : 'translate-x-5'}`} />
                          </button>
                        </div>

                        {/* Sekce školy */}
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
                              <p className="text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-1 pl-1" style={{ fontFamily: ff }}>
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
                                  className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 pr-10 text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                                  style={{ fontFamily: ff }}
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
                                              <p className="text-[14px] text-[#001161] font-semibold leading-tight truncate" style={{ fontFamily: ff }}>{s.name}</p>
                                              {s.address && <p className="text-[12px] text-[#001161]/40 mt-0.5" style={{ fontFamily: ff }}>{s.address}{' · I\u010cO: '}{s.ico}</p>}
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
                                className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                                style={{ fontFamily: ff }}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Kontaktní údaje */}
                        <p className="text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mt-2 pl-1" style={{ fontFamily: ff }}>
                          {'Kontaktn\u00ed \u00fadaje'}
                        </p>

                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={e => handleChange('name', e.target.value)}
                          placeholder={'Jm\u00e9no a p\u0159\u00edjmen\u00ed *'}
                          className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                          style={{ fontFamily: ff }}
                        />
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={e => handleChange('email', e.target.value)}
                          placeholder={'V\u00e1\u0161 e-mail *'}
                          className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                          style={{ fontFamily: ff }}
                        />
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={e => handleChange('phone', e.target.value)}
                          placeholder={'Telefon'}
                          className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 text-[15px] text-[#001161] placeholder-[#001161]/40 outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all"
                          style={{ fontFamily: ff }}
                        />

                        <div className="relative">
                          <select
                            required
                            value={form.position}
                            onChange={e => handleChange('position', e.target.value)}
                            className="w-full bg-white border border-[#001161]/10 rounded-[12px] px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15 transition-all appearance-none cursor-pointer"
                            style={{ fontFamily: ff, color: form.position ? '#001161' : 'rgba(0,17,97,0.4)' }}
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

                        {/* GDPR */}
                        <label className="flex items-start gap-3 cursor-pointer mt-1">
                          <div
                            className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${form.gdpr ? 'bg-[#5B4FD8] border-[#5B4FD8]' : 'bg-white border-[#001161]/20'}`}
                            onClick={() => handleChange('gdpr', !form.gdpr)}
                          >
                            {form.gdpr && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="text-[13px] text-[#001161]/70 leading-snug" style={{ fontFamily: ff }} onClick={() => handleChange('gdpr', !form.gdpr)}>
                            {'Souhlas\u00edm se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f podle\u00a0'}
                            <a href="https://www.vividbooks.cz/gdpr" target="_blank" rel="noopener noreferrer" className="underline text-[#5B4FD8] hover:opacity-75" onClick={e => e.stopPropagation()}>
                              {'Z\u00e1sad ochrany osobn\u00edch \u00fadaj\u016f'}
                            </a>
                            {'. *'}
                          </span>
                        </label>

                        {/* Newsletter — stejné jako trial formulář */}
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
                          <span className="text-[13px] text-[#001161]/80 leading-[1.5]" style={{ fontFamily: ff }}>
                            <span className="font-bold text-[#001161]">{'📚 Chci dostávat novinky a tipy do výuky'}</span>
                            <br />
                            {'Novinky, tipy do v\u00fduky a akce \u2014 pos\u00edl\u00e1me je jen tehdy, kdy\u017e stoj\u00ed za p\u0159e\u010dten\u00ed. Bez spamu.'}
                          </span>
                        </label>

                        {error && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <p className="text-red-600 text-[13px]" style={{ fontFamily: ff }}>{error}</p>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full bg-[#FF8C00] hover:bg-[#e67d00] disabled:opacity-60 text-white font-bold text-[16px] py-4 rounded-[14px] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2 flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(255,140,0,0.35)]"
                          style={{ fontFamily: ff }}
                        >
                          {submitting
                            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{'Odes\u00edl\u00e1m...'}</>
                            : 'P\u0159ihl\u00e1sit'
                          }
                        </button>
                        <p className="text-[12px] text-[#001161]/40 text-center" style={{ fontFamily: ff }}>
                          {'* Povinn\u00e9 pole'}
                        </p>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Další záznamy z tématu ─────────────────────────────── */}
        {sameTopicVideos.length > 0 && (
          <div className="border-t border-[#001161]/6 px-8 md:px-12 py-10 bg-[#F5F6FB]">
            <p className="text-[#001161]/40 text-[11px] uppercase tracking-widest font-bold mb-5" style={{ fontFamily: ff }}>
              {'Další záznamy z tématu'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {sameTopicVideos.map(v => {
                const tid = extractYoutubeId(v.youtubeUrl);
                const thumb = v.thumbnail || (tid ? `https://i.ytimg.com/vi/${tid}/mqdefault.jpg` : '');
                return (
                  <button key={v.id} onClick={() => navigate(`/webinare/zaznam/${v.id}`)} className="group text-left cursor-pointer">
                    <div className="relative rounded-xl overflow-hidden bg-[#DEE4F1] aspect-video mb-2 shadow-[0_2px_10px_rgba(0,17,97,0.08)]">
                      {thumb && (
                        <ImageWithFallback src={thumb} alt={v.name} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
                      </div>
                    </div>
                    <p className="text-[#001161] text-[13px] font-bold leading-tight line-clamp-2" style={{ fontFamily: ff }}>
                      {v.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}