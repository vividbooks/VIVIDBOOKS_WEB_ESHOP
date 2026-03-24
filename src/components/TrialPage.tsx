import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, CheckCircle, BookOpen, Sparkles, User, Search, Building2, AlertCircle, CheckCircle2, Clock, Loader2, Mail, Users, MessageCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SEOHead } from './SEOHead';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { flashInvalidField } from '../utils/formFieldHighlight';

// Telefony obchodního týmu — stejný zdroj jako ContactPage
const TEAM_PHONES: Record<string, string> = {
  'jiri@vividbooks.com':    '+420 606 630 542',
  'iveta@vividbooks.com':   '+420 774 935 055',
  'eva.b@vividbooks.com':   '+420 775 195 709',
  'eduard@vividbooks.com':  '+420 602 227 674',
  'gabriela@vividbooks.com':'+420 605 870 896',
  'albert@vividbooks.cz':   '+420 736 353 702',
};

// Fotky obchodního týmu — stejný zdroj jako ContactPage
const TEAM_PHOTOS: Record<string, string> = {
  'jiri@vividbooks.com':    'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/6811b8e537e9180f0677007a_Sni%CC%81mek%20obrazovky%202025-04-30%20v%C2%A07.45.00.png',
  'iveta@vividbooks.com':   'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0f591597464fe410a0_obchodni-zastupce-vividbooks-iveta-fiserova.webp',
  'eva.b@vividbooks.com':   'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0fed611ead6c658025_obchodni-zastupce-vividbooks-eva-bukolska.webp',
  'eduard@vividbooks.com':  'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0f6373773f769b3a3b_obchodni-zastupce-vividbooks-eduard-malachovsky.webp',
  'gabriela@vividbooks.com':'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/68499506e61fe43631528e42_gabriela-vividbooks.avif',
  'albert@vividbooks.cz':   'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/690b392f4f46c83e726f7095_albert.jpg',
};

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

const POSITIONS = [
  'U\u010ditel/ka',
  '\u0158editel/ka',
  'Z\u00e1stupce/kyn\u011b \u0159editele',
  'Metodik/\u010dka',
  'Rodi\u010d',
  'Jin\u00e9',
];

const SUBJECTS_2ND = ['Fyzika', 'Chemie', 'Matematika', 'P\u0159\u00edrodopis', '\u010cesk\u00fd jazyk', 'Jin\u00e9'];
const SUBJECTS_1ST = ['Matematika', 'Prvouka', '\u010cesk\u00fd jazyk', 'Jin\u00e9'];

const INPUT_CLASS =
  "w-full text-[15px] text-[#001161] bg-white border border-[#001161]/12 rounded-xl px-5 py-3.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all placeholder:text-[#001161]/35";

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

interface VvbIdentity {
  email: string; name: string; webinarId?: string; webinarTitle?: string;
  trialActivated: boolean; since: string; expires?: string;
}
interface SchoolResult { ico: string; name: string; address?: string; }
interface PdOwner { name: string; firstName: string; email: string; phone: string; photoUrl: string; }
type PipedriveStatus = 'new' | 'known' | 'in_progress' | 'past_request' | 'active_subscription' | 'unknown' | 'invalid' | null;

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

/* ── Subject checkbox ── */
function SubjectCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-left ${checked ? 'bg-[#7C3AED]/8 border-[#7C3AED]/40' : 'bg-white border-[#001161]/10 hover:border-[#7C3AED]/30'}`}>
      <span className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-[#7C3AED] border-[#7C3AED]' : 'border-[#001161]/20 bg-white'}`}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span style={FF} className="text-[14px] text-[#001161] font-medium">{label}</span>
    </button>
  );
}

/* ── PD config ── */
const PD_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  new:                 { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: <CheckCircle2 className="w-4 h-4" /> },
  known:               { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: <Building2 className="w-4 h-4" /> },
  in_progress:         { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: <Clock className="w-4 h-4" /> },
  past_request:        { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: <Clock className="w-4 h-4" /> },
  active_subscription: { color: '#7C3AED', bg: '#f5f3ff', border: '#ddd6fe', icon: <Sparkles className="w-4 h-4" /> },
  unknown:             { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', icon: <AlertCircle className="w-4 h-4" /> },
};

/* ── School autocomplete ── */
function SchoolSearch({
  schoolName, ico, onSelect, onIcoChange,
  pdStatus, pdMessage, pdLoading, colleagues, owner, products,
}: {
  schoolName: string; ico: string;
  onSelect: (name: string, ico: string) => void;
  onIcoChange: (ico: string) => void;
  pdStatus: PipedriveStatus; pdMessage: string; pdLoading: boolean;
  colleagues: string[];
  owner: PdOwner | null;
  products: string[];
}) {
  const [query, setQuery] = useState(schoolName);
  const [results, setResults] = useState<SchoolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [icoInput, setIcoInput] = useState(ico);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(schoolName); }, [schoolName]);
  useEffect(() => { setIcoInput(ico); }, [ico]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSchools = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`${SERVER}/school-search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      setResults(data.results || []);
      setOpen((data.results || []).length > 0);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const debouncedSearch = useDebouncedCallback(fetchSchools, 350);

  const handleNameChange = (v: string) => { setQuery(v); onSelect(v, ico); debouncedSearch(v); };
  const handleSelect = (school: SchoolResult) => {
    setQuery(school.name); setIcoInput(school.ico);
    onSelect(school.name, school.ico); setOpen(false); setResults([]);
  };
  const handleIcoChange = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 10);
    setIcoInput(clean); onIcoChange(clean);
  };

  const cfg = pdStatus ? PD_CFG[pdStatus] : null;
  const colleagueText = colleagues.length > 0 ? colleagues.join(', ') : null;

  return (
    <div className="space-y-3">
      {/* School name */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input type="text" value={query} onChange={e => handleNameChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={'N\u00e1zev \u0161koly *'} className={`${INPUT_CLASS} pr-10`}
            style={FF} autoComplete="off" />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#001161]/30 pointer-events-none">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </div>
        </div>
        <AnimatePresence>
          {open && results.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 mt-1 w-full bg-white border border-[#001161]/10 rounded-2xl shadow-xl overflow-hidden">
              <div className="max-h-[260px] overflow-y-auto py-1">
                {results.map((school, i) => (
                  <button key={`${school.ico}-${i}`} type="button" onClick={() => handleSelect(school)}
                    className="w-full text-left px-4 py-3 hover:bg-[#F0F2F8] transition-colors flex items-start gap-3 group">
                    <Building2 className="w-4 h-4 text-[#001161]/30 mt-0.5 shrink-0 group-hover:text-[#7C3AED] transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p style={FF} className="text-[14px] text-[#001161] font-semibold leading-tight truncate">{school.name}</p>
                      <p style={FF} className="text-[12px] text-[#001161]/45 mt-0.5">
                        {school.address && <span>{school.address} · </span>}{'I\u010cO: '}{school.ico}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* IČO */}
      <div className="relative">
        <input type="text" inputMode="numeric" value={icoInput}
          onChange={e => handleIcoChange(e.target.value)}
          placeholder={'I\u010cO \u0161koly *'} maxLength={10}
          className={`${INPUT_CLASS} pr-10`} style={FF} />
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {pdLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-[#001161]/30" />
            : cfg ? <span style={{ color: cfg.color }}>{cfg.icon}</span> : null}
        </div>
      </div>

      {/* Pipedrive status card */}
      <AnimatePresence>
        {cfg && pdMessage && !pdLoading && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {pdStatus === 'active_subscription' ? (
              /* ══ ACTIVE SUBSCRIPTION — rozšířená karta ══ */
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${cfg.border}` }}>

                {/* Header */}
                <div className="flex items-center gap-2.5 px-4 pt-4 pb-3" style={{ backgroundColor: cfg.bg }}>
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <p style={{ ...FF, color: cfg.color }} className="text-[14px] font-bold">{pdMessage}</p>
                </div>

                <div className="px-4 pb-4 space-y-3" style={{ backgroundColor: cfg.bg }}>

                  {/* ── Deal owner card ── */}
                  {owner && (() => {
                    const mailSubject = encodeURIComponent(`\u017d\u00e1dost o p\u0159\u00edstupov\u00e9 k\u00f3dy Vividbooks \u2013 ${schoolName || ico}`);
                    const mailBody = encodeURIComponent(
                      `Dobr\u00fd den ${owner.firstName},\n\nz\u00e1d\u00e1m o p\u0159\u00edstupov\u00e9 k\u00f3dy k digit\u00e1ln\u00edm u\u010debnic\u00edm Vividbooks pro na\u0161i \u0161kolu:\n\n\u0160kola: ${schoolName || '\u2013'}\nI\u010cO: ${ico || '\u2013'}\n\nD\u011bkuji za vy\u0159\u00edzen\u00ed.`
                    );
                    return (
                      <div className="bg-white rounded-xl overflow-hidden">
                        {/* Top row: photo + name + CTA */}
                        <div className="flex items-center gap-3 p-3.5">
                          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-[#7C3AED]/10 flex items-center justify-center">
                            {(TEAM_PHOTOS[owner.email?.toLowerCase()] || owner.photoUrl) ? (
                              <ImageWithFallback
                                src={TEAM_PHOTOS[owner.email?.toLowerCase()] || owner.photoUrl}
                                alt={owner.firstName}
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <User className="w-6 h-6 text-[#7C3AED]/50" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p style={FF} className="text-[11px] text-[#001161]/45 mb-0.5">
                              {'O va\u0161i \u0161kolu se star\u00e1:'}
                            </p>
                            <p style={{ ...FF, color: cfg.color }} className="text-[15px] font-bold leading-tight truncate">
                              {owner.name}
                            </p>
                          </div>
                          <a
                            href={owner.email ? `mailto:${owner.email}?subject=${mailSubject}&body=${mailBody}` : '#'}
                            className="shrink-0 inline-flex items-center gap-1.5 text-white font-bold text-[12px] px-3 py-2 rounded-lg no-underline transition-all hover:opacity-90 active:scale-95"
                            style={{ ...FF, backgroundColor: cfg.color }}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {'Po\u017e\u00e1dat o k\u00f3dy'}
                          </a>
                        </div>
                        {/* Bottom row: email + phone */}
                        {(() => {
                          const teamPhone = TEAM_PHONES[owner.email?.toLowerCase()];
                          return (
                            <div className="flex items-stretch border-t" style={{ borderColor: `${cfg.color}20` }}>
                              {owner.email && (
                                <a
                                  href={`mailto:${owner.email}`}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 no-underline transition-colors hover:bg-[#7C3AED]/5 min-w-0"
                                  style={{ ...FF, color: cfg.color, fontSize: '12px' }}
                                >
                                  <Mail className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{owner.email}</span>
                                </a>
                              )}
                              {teamPhone && (
                                <>
                                  {owner.email && <div className="w-px self-stretch" style={{ backgroundColor: `${cfg.color}20` }} />}
                                  <Link
                                    to="/kontakt"
                                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 no-underline transition-colors hover:bg-[#7C3AED]/5 font-bold"
                                    style={{ ...FF, color: cfg.color, fontSize: '13px' }}
                                  >
                                    <Phone className="w-3.5 h-3.5 shrink-0" />
                                    {teamPhone}
                                  </Link>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}



                  {/* ── Colleagues ── */}
                  {colleagueText && (
                    <div className="bg-white/70 rounded-xl px-3.5 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Users className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.color }} />
                        <p style={FF} className="text-[11px] text-[#001161]/50 font-bold uppercase tracking-wide">
                          {'Kolegov\u00e9 s p\u0159\u00edstupem ve va\u0161\u00ed \u0161kole'}
                        </p>
                      </div>
                      <p style={{ ...FF, color: cfg.color }} className="text-[13px] font-bold">{colleagueText}</p>
                    </div>
                  )}

                  {/* ── No owner fallback ── */}
                  {!owner && (
                    <div className="flex items-start gap-2.5">
                      <p style={FF} className="text-[13px] text-[#001161]/70">
                        {'Napi\u0161te n\u00e1m na\u00a0'}
                        <a href="mailto:hello@vividbooks.com" className="font-bold no-underline hover:opacity-75" style={{ color: cfg.color }}>
                          hello@vividbooks.com
                        </a>
                        {' a po\u0161leme v\u00e1m p\u0159\u00edstupov\u00fd k\u00f3d.'}
                      </p>
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[13px]"
                style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                <span className="mt-0.5 shrink-0">{cfg.icon}</span>
                <span style={FF} className="leading-snug">{pdMessage}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main TrialPage
══════════════════════════════════════════ */
export function TrialPage() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');

  const [identity, setIdentity] = useState<VvbIdentity | null>(null);
  const [tokenLoading, setTokenLoading] = useState(!!tokenParam);
  const [tokenError, setTokenError] = useState('');

  // School + Pipedrive
  const [schoolName, setSchoolName] = useState('');
  const [ico, setIco] = useState('');
  const [pdStatus, setPdStatus] = useState<PipedriveStatus>(null);
  const [pdMessage, setPdMessage] = useState('');
  const [pdLoading, setPdLoading] = useState(false);
  const [colleagues, setColleagues] = useState<string[]>([]);
  const [owner, setOwner] = useState<PdOwner | null>(null);
  const [products, setProducts] = useState<string[]>([]);

  // Form
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '' });
  const [subjects2nd, setSubjects2nd] = useState<string[]>([]);
  const [subjects1st, setSubjects1st] = useState<string[]>([]);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Email dedup
  const [emailCheck, setEmailCheck] = useState<{ canRequest: boolean; alreadyRequested?: boolean; cooldownDateStr?: string; daysLeft?: number; cooldownExpired?: boolean } | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  const isTeacher = form.position === 'U\u010ditel/ka';

  useEffect(() => {
    const saved = localStorage.getItem('vvb_identity');
    if (saved) {
      try {
        const parsed: VvbIdentity = JSON.parse(saved);
        if (parsed.expires && new Date(parsed.expires) < new Date()) localStorage.removeItem('vvb_identity');
        else setIdentity(parsed);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!tokenParam) return;
    setTokenLoading(true);
    fetch(`${SERVER}/verify-token/${tokenParam}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          const id: VvbIdentity = { email: data.email, name: data.name, webinarId: data.webinarId, webinarTitle: data.webinarTitle, trialActivated: true, since: new Date().toISOString(), expires: data.expires };
          setIdentity(id); localStorage.setItem('vvb_identity', JSON.stringify(id));
        } else setTokenError(data.error || 'Neplatn\u00fd odkaz.');
      })
      .catch(() => setTokenError('Nepoda\u0159ilo se ov\u011b\u0159it odkaz.'))
      .finally(() => setTokenLoading(false));
  }, [tokenParam]);

  // Pipedrive check on IČO
  const pdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pdTimer.current) clearTimeout(pdTimer.current);
    if (!ico || ico.length < 6) { setPdStatus(null); setPdMessage(''); setColleagues([]); setOwner(null); setProducts([]); return; }
    pdTimer.current = setTimeout(async () => {
      setPdLoading(true);
      try {
        const res = await fetch(`${SERVER}/school-pipedrive-check?ico=${encodeURIComponent(ico)}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
        const data = await res.json();
        setPdStatus(data.status || 'unknown');
        setPdMessage(data.message || '');
        setColleagues(data.colleagues || []);
        setOwner(data.owner || null);
        setProducts(data.products || []);
        if (data.orgName && !schoolName) setSchoolName(data.orgName);
      } catch { setPdStatus('unknown'); setPdMessage(''); setColleagues([]); setOwner(null); setProducts([]); }
      finally { setPdLoading(false); }
    }, 600);
  }, [ico]);

  // Email dedup check
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkEmail = (email: string) => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (!email || !email.includes('@') || !email.includes('.')) { setEmailCheck(null); return; }
    emailTimer.current = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const res = await fetch(`${SERVER}/check-trial-email?email=${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
        setEmailCheck(await res.json());
      } catch { setEmailCheck(null); }
      finally { setEmailChecking(false); }
    }, 700);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setFormError('');
    if (name === 'email') checkEmail(value);
    if (name === 'position') { setSubjects2nd([]); setSubjects1st([]); }
  };

  const toggleSubject = (list: string[], setList: (v: string[]) => void, subject: string) =>
    setList(list.includes(subject) ? list.filter(s => s !== subject) : [...list, subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const flash = (id: string) => setTimeout(() => flashInvalidField(document.getElementById(id)), 0);

    if (!gdprConsent) {
      setFormError('Souhlas se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f je povinn\u00fd.');
      flash('trial-field-gdpr');
      return;
    }
    if (!schoolName.trim() || !ico.trim()) {
      setFormError('Vypl\u0148te pros\u00edm n\u00e1zev \u0161koly a I\u010cO.');
      flash('trial-field-school');
      return;
    }
    if (!form.name.trim()) { setFormError('Vypl\u0148te pros\u00edm jm\u00e9no.'); flash('trial-field-name'); return; }
    if (!form.email.trim()) { setFormError('Vypl\u0148te pros\u00edm e-mail.'); flash('trial-field-email'); return; }
    if (!form.phone.trim()) { setFormError('Vypl\u0148te pros\u00edm telefon.'); flash('trial-field-phone'); return; }
    if (!form.position) { setFormError('Vyberte pros\u00edm pozici.'); flash('trial-field-position'); return; }
    if (emailCheck && !emailCheck.canRequest) {
      setFormError(`S t\u00edmto e-mailem byl trial ji\u017e po\u017e\u00e1d\u00e1n. Dal\u0161\u00ed \u017e\u00e1dost m\u016f\u017eete podat od ${emailCheck.cooldownDateStr}.`);
      flash('trial-field-email');
      return;
    }
    if (isTeacher && subjects2nd.length === 0 && subjects1st.length === 0) {
      setFormError('Vyberte pros\u00edm alespo\u0148 jeden p\u0159edm\u011bt.');
      flash('trial-field-subjects');
      return;
    }
    setSubmitting(true); setFormError('');
    try {
      const res = await fetch(`${SERVER}/newsletter-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, position: form.position, schoolName: schoolName.trim(), ico: ico.trim(), subjects2nd: isTeacher ? subjects2nd : [], subjects1st: isTeacher ? subjects1st : [], newsletter: newsletterConsent, gdpr: gdprConsent, source: 'trial-form', pipedriveStatus: pdStatus }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); console.error('[TrialPage] Submit error:', d); }
      setSubmitted(true);
    } catch (err: any) { console.error('[TrialPage] Submit exception:', err); setSubmitted(true); }
    finally { setSubmitting(false); }
  };

  if (tokenParam && tokenLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#7C3AED]/20 border-t-[#7C3AED] rounded-full animate-spin" />
          <p style={FF} className="text-[#001161]/60 text-[15px]">{'Ov\u011b\u0159uji v\u00e1\u0161 p\u0159\u00edstup\u2026'}</p>
        </div>
      </div>
    );
  }

  if (identity && identity.trialActivated) {
    const expiresDate = identity.expires ? new Date(identity.expires).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <SEOHead title="Vyzkou\u0161ejte zdarma" path="/vyzkousejte" description="14denn\u00ed zku\u0161ebn\u00ed p\u0159\u00edstup k digit\u00e1ln\u00edm u\u010debnic\u00edm Vividbooks zdarma." />
        <div className="w-full max-w-[520px]">
          <div className="bg-gradient-to-br from-[#7C3AED]/10 to-[#5B4FD8]/5 border border-[#7C3AED]/20 rounded-[28px] p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#7C3AED]/15 mb-5">
              <Sparkles className="w-8 h-8 text-[#7C3AED]" />
            </div>
            <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] leading-[1.2] mb-2">
              {'V\u00edt\u00e1me v\u00e1s, '}{identity.name.split(' ')[0]}{'!'}
            </h1>
            {identity.webinarTitle && (
              <p style={FF} className="text-[#7C3AED] text-[14px] font-bold mb-4">{'Po registraci na: '}{identity.webinarTitle}</p>
            )}
            <div className="bg-white rounded-2xl p-5 mb-6 text-left space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p style={FF} className="font-bold text-[#001161] text-[14px]">{'Zku\u0161ebn\u00ed p\u0159\u00edstup aktivov\u00e1n'}</p>
                  {expiresDate && <p style={FF} className="text-[#001161]/50 text-[12px]">{'Platnost do: '}{expiresDate}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-[#001161]/40 shrink-0" />
                <p style={FF} className="text-[#001161]/60 text-[13px]">{identity.email}</p>
              </div>
            </div>
            <p style={FF} className="text-[#001161]/60 text-[14px] mb-6">{'Na\u0161 obchodn\u00ed z\u00e1stupce v\u00e1m br\u007ey odp\u00ed\u0161e s p\u0159\u00edstupov\u00fdmi \u00fadaji.'}</p>
            <a href="/" className="inline-flex items-center gap-2 bg-[#001161] hover:bg-[#001161]/90 text-white font-bold text-[15px] px-8 py-3.5 rounded-full transition-all hover:scale-105 no-underline" style={FF}>
              {'Prohl\u00e9dnout u\u010debnice'}
            </a>
            <button onClick={() => { localStorage.removeItem('vvb_identity'); setIdentity(null); }}
              className="block mx-auto mt-4 text-[12px] text-[#001161]/30 hover:text-[#001161]/60 transition-colors cursor-pointer" style={FF}>
              {'Odhl\u00e1sit se'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (tokenParam && tokenError) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] text-center">
          <div className="bg-red-50 border border-red-200 rounded-[24px] p-8">
            <p style={FF} className="text-red-600 text-[16px] font-bold mb-2">{'Neplatn\u00fd odkaz'}</p>
            <p style={FF} className="text-[#001161]/60 text-[14px] mb-6">{tokenError}</p>
            <a href="/vyzkousejte" style={FF} className="text-[#7C3AED] font-bold text-[14px] underline hover:opacity-75">{'Zkusit znovu'}</a>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <SEOHead title="Vyzkou\u0161ejte zdarma" path="/vyzkousejte"
        description="Z\u00edskejte 14denn\u00ed zku\u0161ebn\u00ed p\u0159\u00edstup k digit\u00e1ln\u00edm u\u010debnic\u00edm Vividbooks zdarma." />
      <div className="w-full max-w-[520px]">

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#E8942A]/10 mb-5">
            <BookOpen className="w-8 h-8 text-[#E8942A]" />
          </div>
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[36px] leading-[1.2] mb-4">
            {'Vyzkou\u0161ejte u\u010debn\u00ed materi\u00e1ly Vividbooks zdarma na 14 dn\u00ed.'}
          </h1>
          <p style={FF} className="text-[#001161]/60 text-[15px] md:text-[16px] leading-relaxed">
            {'Vypl\u0148te formul\u00e1\u0159 nebo n\u00e1m zavolejte na'}
            <Link to="/kontakt" className="inline-flex items-center gap-1.5 text-[#E8942A] font-bold hover:underline ml-1" style={FF}>
              <Phone className="w-4 h-4" /> +420 602 227 674
            </Link>
          </p>
        </div>

        {submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#F0FDF4] border border-green-200 rounded-[20px] p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[24px] mb-2">{'D\u011bkujeme!'}</h2>
            <p style={FF} className="text-[#001161]/60 text-[15px]">{'Ozveme se v\u00e1m co nejd\u0159\u00edve s p\u0159\u00edstupov\u00fdmi \u00fadaji.'}</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#DDDAEC]/50 rounded-[24px] p-7 md:p-10 space-y-4">

            <div id="trial-field-school" className="pb-1 rounded-[18px] p-1 -m-1">
              <p style={FF} className="text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest mb-2 pl-1">
                {'Informace o \u0161kole'}
              </p>
              <SchoolSearch
                schoolName={schoolName} ico={ico}
                onSelect={(name, icoVal) => { setSchoolName(name); setIco(icoVal); }}
                onIcoChange={setIco}
                pdStatus={pdStatus} pdMessage={pdMessage} pdLoading={pdLoading}
                colleagues={colleagues} owner={owner} products={products}
              />
            </div>

            <div className="space-y-2 py-1">
              {pdStatus === 'active_subscription' && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#001161]/8" />
                  <p style={FF} className="text-[13px] font-bold text-[#7C3AED] text-center whitespace-nowrap">
                    {'nebo si za\u017e\u00e1dejte o nov\u00fd zku\u0161ebn\u00ed p\u0159\u00edstup'}
                  </p>
                  <div className="flex-1 h-px bg-[#001161]/8" />
                </div>
              )}
              <p style={FF} className="text-[11px] font-bold text-[#001161]/40 uppercase tracking-widest text-center pl-1">
                {'Kontaktn\u00ed \u00fadaje'}
              </p>
            </div>

            <input id="trial-field-name" type="text" name="name" required value={form.name} onChange={handleChange}
              placeholder={'Jm\u00e9no a p\u0159\u00edjmen\u00ed *'} className={INPUT_CLASS} style={FF} />

            <div id="trial-field-email">
              <div className="relative">
                <input type="email" name="email" required value={form.email} onChange={handleChange}
                  placeholder={'V\u00e1\u0161 e-mail *'} className={`${INPUT_CLASS} pr-10`} style={FF} />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {emailChecking
                    ? <Loader2 className="w-4 h-4 animate-spin text-[#001161]/30" />
                    : emailCheck
                      ? emailCheck.canRequest ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />
                      : null}
                </div>
              </div>
              <AnimatePresence>
                {emailCheck && !emailCheck.canRequest && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-2 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p style={FF} className="text-[13px] text-amber-800 font-bold">{'S t\u00edmto e-mailem byl trial ji\u017e po\u017e\u00e1d\u00e1n'}</p>
                      <p style={FF} className="text-[12px] text-amber-700 mt-0.5">
                        {'Dal\u0161\u00ed \u017e\u00e1dost m\u016f\u017eete podat od '}{emailCheck.cooldownDateStr}{' ('}{emailCheck.daysLeft}{' dn\u00ed).'}
                      </p>
                    </div>
                  </motion.div>
                )}
                {emailCheck?.canRequest && emailCheck.alreadyRequested && emailCheck.cooldownExpired && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <p style={FF} className="text-[12px] text-green-700">{'P\u0159edchoz\u00ed trial vypr\u0161el \u2014 m\u016f\u017eete \u017e\u00e1dat znovu.'}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <input id="trial-field-phone" type="tel" name="phone" required value={form.phone} onChange={handleChange}
              placeholder="Telefon *" className={INPUT_CLASS} style={FF} />

            <select id="trial-field-position" name="position" required value={form.position} onChange={handleChange}
              className={`${INPUT_CLASS} cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23001161%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_20px_center]`}
              style={FF}>
              <option value="" disabled>{'Va\u0161e pozice *'}</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <AnimatePresence>
              {isTeacher && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div id="trial-field-subjects" className="bg-white/60 rounded-2xl p-5 space-y-5 border border-[#001161]/8">
                    <p style={FF} className="text-[14px] font-bold text-[#001161] text-center">{'Jak\u00fd p\u0159edm\u011bt u\u010d\u00edte? *'}</p>
                    <div>
                      <p style={FF} className="text-[11px] font-bold text-[#7C3AED] uppercase tracking-widest mb-3 text-center">{'2. STUPE\u0147'}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SUBJECTS_2ND.map(s => (
                          <SubjectCheckbox key={`2-${s}`} label={s} checked={subjects2nd.includes(s)}
                            onChange={() => toggleSubject(subjects2nd, setSubjects2nd, s)} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={FF} className="text-[11px] font-bold text-[#7C3AED] uppercase tracking-widest mb-3 text-center">{'1. STUPE\u0147'}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {SUBJECTS_1ST.map(s => (
                          <SubjectCheckbox key={`1-${s}`} label={s} checked={subjects1st.includes(s)}
                            onChange={() => toggleSubject(subjects1st, setSubjects1st, s)} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <label id="trial-field-gdpr" className="flex items-start gap-3 cursor-pointer pt-2 rounded-[14px] p-1 -m-1">
              <span className="relative flex-shrink-0 mt-0.5">
                <input type="checkbox" checked={gdprConsent} onChange={() => setGdprConsent(!gdprConsent)} className="sr-only peer" required />
                <span className="block w-[42px] h-[24px] bg-[#001161]/15 rounded-full peer-checked:bg-[#E8942A] transition-colors" />
                <span className="absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-[18px]" />
              </span>
              <span style={FF} className="text-[13px] text-[#001161]/80 leading-[1.5]">
                {'Souhlas\u00edm se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f podle '}
                <a href="#" className="underline text-[#001161] hover:text-[#E8942A] transition-colors">{'Z\u00e1sad ochrany osobn\u00edch \u00fadaj\u016f.'}</a>
                {' *'}
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer bg-[#FFF7ED] rounded-xl px-4 py-3 border border-[#E8942A]/20">
              <span className="relative flex-shrink-0 mt-0.5">
                <input type="checkbox" checked={newsletterConsent} onChange={() => setNewsletterConsent(!newsletterConsent)} className="sr-only peer" />
                <span className="block w-[42px] h-[24px] bg-[#001161]/15 rounded-full peer-checked:bg-[#E8942A] transition-colors" />
                <span className="absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-[18px]" />
              </span>
              <span style={FF} className="text-[13px] text-[#001161]/80 leading-[1.5]">
                <span className="font-bold text-[#001161]">{'📚 Chci dostávat novinky a tipy do výuky'}</span>
                <br />{'Jednou m\u011bs\u00ed\u010dn\u011b: nov\u00e9 tituly, metodick\u00e9 tipy a akce. Bez spamu.'}
              </span>
            </label>

            {formError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p style={FF} className="text-red-600 text-[13px]">{formError}</p>
              </div>
            )}

            <button type="submit"
              disabled={!gdprConsent || submitting || (!!emailCheck && !emailCheck.canRequest)}
              className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-[16px] px-6 py-4 rounded-xl transition-all hover:scale-[1.02] cursor-pointer shadow-lg shadow-[#7C3AED]/25"
              style={FF}>
              {submitting
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{'Odes\u00edl\u00e1m\u2026'}</>
                : 'Z\u00edskat p\u0159\u00edstup zdarma'}
            </button>

            <p style={FF} className="text-[13px] text-[#001161]/40 pt-1">{'* Povinn\u00e9 pole'}</p>
          </form>
        )}
      </div>
    </motion.div>
  );
}