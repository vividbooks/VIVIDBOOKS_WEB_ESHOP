import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, CheckCircle, BookOpen, Sparkles, User, Search, Building2, AlertCircle, CheckCircle2, Clock, Loader2, Mail, Users, MessageCircle, ExternalLink } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SEOHead } from './SEOHead';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { flashInvalidField } from '../utils/formFieldHighlight';
import {
  submitFreeTrialAjax,
  type FreeTrialFields,
  type FreeTrialSubmitResult,
} from '../utils/trialSubmit';
import { TrialTrainingVideosList } from './TrialTrainingVideosList';

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

/** Skryté ve výchozím stavu. Zapnutí: VITE_SHOW_PIPEDRIVE_ICO_DEBUG=true nebo ?pipedriveDebug=1 */
function showPipedriveIcoDebugControls(): boolean {
  if (import.meta.env.VITE_SHOW_PIPEDRIVE_ICO_DEBUG === 'true') return true;
  if (typeof window !== 'undefined' && /(?:^|[?&])pipedriveDebug=1(?:&|$)/.test(window.location.search)) return true;
  return false;
}

const POSITIONS = [
  'U\u010ditel/ka',
  '\u0158editel/ka',
  'Z\u00e1stupce/kyn\u011b \u0159editele',
  'Metodik/\u010dka',
  'Rodi\u010d',
  'Jin\u00e9',
];

/** Hodnoty jako ve Webflow (Mailchimp / integrace) */
const TEACHER_SUBJECTS_1ST: Array<{ value: string; label: string }> = [
  { value: 'Mathematics-1', label: 'Matematika' },
  { value: 'PrimaryScience', label: 'Prvouka' },
  { value: 'CzechLang-1', label: '\u010cesk\u00fd jazyk' },
  { value: 'Other-1', label: 'Jin\u00e9' },
];
const TEACHER_SUBJECTS_2ND: Array<{ value: string; label: string }> = [
  { value: 'Physics', label: 'Fyzika' },
  { value: 'Chemistry', label: 'Chemie' },
  { value: 'Mathematics-2', label: 'Matematika' },
  { value: 'NaturalHistory', label: 'P\u0159\u00edrodopis' },
  { value: 'CzechLang-2', label: '\u010cesk\u00fd jazyk' },
  { value: 'Other-2', label: 'Jin\u00e9' },
];

const DEPUTY_SCHOOL_STAGES: Array<{ value: string; label: string }> = [
  { value: 'SchoolStage-1', label: '1. stupe\u0148' },
  { value: 'SchoolStage-2', label: '2. stupe\u0148' },
];

const INPUT_CLASS =
  "w-full text-[15px] text-[#001161] bg-white border border-[#001161]/12 rounded-xl px-5 py-3.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all placeholder:text-[#001161]/35";

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

interface VvbIdentity {
  email: string; name: string; webinarId?: string; webinarTitle?: string;
  trialActivated: boolean; since: string; expires?: string;
}
interface SchoolResult { ico: string; name: string; address?: string; }
export interface PdOwner { name: string; firstName: string; email: string; phone: string; photoUrl: string; }
export type PipedriveStatus =
  | 'new'
  | 'known'
  | 'in_progress'
  | 'past_request'
  | 'active_trial'
  | 'active_subscription'
  | 'unknown'
  | 'invalid'
  | null;

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
  active_trial:        { color: '#7C3AED', bg: '#f5f3ff', border: '#ddd6fe', icon: <BookOpen className="w-4 h-4" /> },
  active_subscription: { color: '#7C3AED', bg: '#f5f3ff', border: '#ddd6fe', icon: <Sparkles className="w-4 h-4" /> },
  unknown:             { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', icon: <AlertCircle className="w-4 h-4" /> },
};

/* ── School autocomplete ── */
export function SchoolSearch({
  schoolName, ico, onSelect, onIcoChange,
  pdStatus, pdMessage, pdLoading, colleagues, owner, products,
  hidePipedriveStatusCard,
  pipedriveDebug,
  readOnly,
}: {
  schoolName: string; ico: string;
  onSelect: (name: string, ico: string) => void;
  onIcoChange: (ico: string) => void;
  pdStatus: PipedriveStatus; pdMessage: string; pdLoading: boolean;
  colleagues: string[];
  owner: PdOwner | null;
  products: string[];
  hidePipedriveStatusCard?: boolean;
  /** Jen zobrazení školy + CRM karty (bez editace polí) */
  readOnly?: boolean;
  pipedriveDebug?: {
    raw: unknown | null;
    open: boolean;
    onToggle: () => void;
  };
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
  /** Zkušební přístup, placený přístup nebo rozjetý krok v CRM — stejná velká karta */
  const showExpandedLicenseCard =
    pdStatus === 'active_subscription' ||
    pdStatus === 'active_trial' ||
    pdStatus === 'in_progress';
  const expandCfg = PD_CFG.active_subscription;
  const colleagueText = colleagues.length > 0 ? colleagues.join(', ') : null;
  const isTrialTestingCard = pdStatus === 'active_trial';
  const isOpenDealProgress = pdStatus === 'in_progress';

  return (
    <div className="space-y-3">
      {readOnly ? (
        <div className="rounded-xl border border-[#001161]/10 bg-white px-4 py-3 space-y-1">
          <p style={FF} className="text-[14px] font-semibold text-[#001161] leading-snug">
            {schoolName || '\u2014'}
          </p>
          <p style={FF} className="text-[14px] text-[#001161]/70">
            {ico ? `I\u010cO: ${ico}` : '\u2014'}
          </p>
        </div>
      ) : (
        <>
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
          <div className="space-y-2">
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a
                href="https://ares.gov.cz/ekonomicke-subjekty"
                target="_blank"
                rel="noopener noreferrer"
                style={FF}
                className="inline-block text-[13px] text-[#7C3AED] underline underline-offset-2 hover:opacity-80"
              >
                {'Nezn\u00e1te va\u0161e I\u010c? Zde ho m\u016f\u017eete naj\u00edt'}
              </a>
              {pipedriveDebug && ico.length >= 6 && (
                <button
                  type="button"
                  onClick={pipedriveDebug.onToggle}
                  style={FF}
                  className="text-[12px] font-semibold text-[#001161]/50 hover:text-[#7C3AED] underline-offset-2 hover:underline"
                >
                  {pipedriveDebug.open ? 'Skr\u00fdt JSON (Pipedrive)' : 'Dev \u2014 JSON (Pipedrive)'}
                </button>
              )}
            </div>
            {pipedriveDebug?.open && (
              <div
                className="rounded-xl border border-[#001161]/12 bg-[#0f172a]/95 p-3 max-h-[min(420px,50vh)] overflow-auto"
                style={FF}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  school-pipedrive-check (+ pipedriveApi = surov\u00e9 dealy Pipedrive, jen v Dev)
                </p>
                {pipedriveDebug.raw == null ? (
                  <p className="text-[12px] text-slate-400">Na\u010d\u00edt\u00e1m\u2026</p>
                ) : (
                  <pre className="text-[11px] leading-relaxed text-emerald-100/95 whitespace-pre-wrap break-all m-0 font-mono">
                    {typeof pipedriveDebug.raw === 'string' ? pipedriveDebug.raw : JSON.stringify(pipedriveDebug.raw, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {readOnly && pdLoading && (
        <div className="flex items-center gap-2 text-[#001161]/55 text-[13px]" style={FF}>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {'Na\u010d\u00edt\u00e1m informace o \u0161kole z CRM\u2026'}
        </div>
      )}

      {/* Pipedrive status card */}
      <AnimatePresence>
        {!hidePipedriveStatusCard && cfg && pdMessage && !pdLoading && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {showExpandedLicenseCard ? (
              /* ══ Předplatné nebo aktivní zkušební přístup (in_progress) — stejná karta ══ */
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${expandCfg.border}` }}>

                {/* Header */}
                <div className="px-4 pt-4 pb-3 space-y-2.5" style={{ backgroundColor: expandCfg.bg }}>
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: expandCfg.color }}>{expandCfg.icon}</span>
                    <p style={{ ...FF, color: expandCfg.color }} className="text-[14px] font-bold">
                      {isTrialTestingCard
                        ? '\u0160kola pr\u00e1v\u011b testuje digit\u00e1ln\u00ed u\u010debnice (zku\u0161ebn\u00ed p\u0159\u00edstup)'
                        : pdMessage}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#001161]/8 bg-white/55 px-3.5 py-3 space-y-2.5">
                    <p style={FF} className="text-[13px] font-bold text-[#001161] leading-snug">
                      {isTrialTestingCard
                        ? '\u0160kola pr\u00e1v\u011b testuje Vividbooks. Nov\u00e9 p\u0159\u00edstupov\u00e9 k\u00f3dy z tohoto formul\u00e1\u0159e nez\u00edsk\u00e1te \u2014 pot\u0159ebujete-li p\u0159\u00edstup, obra\u0165te se na kolegy v seznamu n\u00ed\u017ee nebo vyu\u017eijte kontakt v kart\u011b.'
                        : isOpenDealProgress
                          ? 'Nov\u00e9 p\u0159\u00edstupov\u00e9 k\u00f3dy z tohoto formul\u00e1\u0159e te\u010f nez\u00edsk\u00e1te. Pokud pot\u0159ebujete pomoct s p\u0159\u00edstupem, obra\u0165te se na kolegy n\u00ed\u017ee nebo napi\u0161te kontaktu z t\u00fdmu Vividbooks v kart\u011b.'
                          : 'Nov\u00e9 p\u0159\u00edstupov\u00e9 k\u00f3dy z tohoto formul\u00e1\u0159e nez\u00edsk\u00e1te \u2014 \u0161kola u\u017e m\u00e1 aktivn\u00ed p\u0159\u00edstup k u\u010debn\u00edcm.'}
                    </p>
                    <p style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45">
                      {'Co m\u016f\u017eete ud\u011blat'}
                    </p>
                    <ul className="space-y-2 list-none m-0 p-0">
                      <li className="flex gap-2.5" style={FF}>
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: expandCfg.color }} aria-hidden />
                        <span className="text-[13px] text-[#001161]/75 leading-snug">
                          <span className="font-bold text-[#001161]">{'Kolegov\u00e9'}</span>
                          {' \u2014 zeptejte se n\u011bkoho ze seznamu '}
                          <span className="whitespace-nowrap text-[#001161]/90 font-semibold">{'n\u00ed\u017ee'}</span>
                          {'.'}
                        </span>
                      </li>
                      <li className="flex gap-2.5" style={FF}>
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: expandCfg.color }} aria-hidden />
                        <span className="text-[13px] text-[#001161]/75 leading-snug">
                          <span className="font-bold text-[#001161]">{'Kontakt z t\u00fdmu Vividbooks'}</span>
                          {' \u2014 '}
                          {owner ? (
                            <>
                              {'napi\u0161te pros\u00edm osob\u011b v kart\u011b '}
                              <span className="whitespace-nowrap text-[#001161]/90 font-semibold">{'n\u00ed\u017ee'}</span>
                              {'.'}
                            </>
                          ) : (
                            <>
                              {'napi\u0161te n\u00e1m na '}
                              <a href="mailto:hello@vividbooks.com" className="font-bold text-[#001161] underline underline-offset-2 decoration-[#001161]/25 hover:opacity-80" style={{ color: expandCfg.color }}>
                                hello@vividbooks.com
                              </a>
                              {'.'}
                            </>
                          )}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="px-4 pb-4 space-y-3" style={{ backgroundColor: expandCfg.bg }}>

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
                            <p style={{ ...FF, color: expandCfg.color }} className="text-[15px] font-bold leading-tight truncate">
                              {owner.name}
                            </p>
                          </div>
                          <a
                            href={owner.email ? `mailto:${owner.email}?subject=${mailSubject}&body=${mailBody}` : '#'}
                            className="shrink-0 inline-flex items-center gap-1.5 text-white font-bold text-[12px] px-3 py-2 rounded-lg no-underline transition-all hover:opacity-90 active:scale-95"
                            style={{ ...FF, backgroundColor: expandCfg.color }}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {'Napsat o p\u0159\u00edstup'}
                          </a>
                        </div>
                        {/* Bottom row: email + phone */}
                        {(() => {
                          const teamPhone = TEAM_PHONES[owner.email?.toLowerCase()];
                          return (
                            <div className="flex items-stretch border-t" style={{ borderColor: `${expandCfg.color}20` }}>
                              {owner.email && (
                                <a
                                  href={`mailto:${owner.email}`}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 no-underline transition-colors hover:bg-[#7C3AED]/5 min-w-0"
                                  style={{ ...FF, color: expandCfg.color, fontSize: '12px' }}
                                >
                                  <Mail className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{owner.email}</span>
                                </a>
                              )}
                              {teamPhone && (
                                <>
                                  {owner.email && <div className="w-px self-stretch" style={{ backgroundColor: `${expandCfg.color}20` }} />}
                                  <Link
                                    to="/kontakt"
                                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 no-underline transition-colors hover:bg-[#7C3AED]/5 font-bold"
                                    style={{ ...FF, color: expandCfg.color, fontSize: '13px' }}
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
                        <Users className="w-3.5 h-3.5 shrink-0" style={{ color: expandCfg.color }} />
                        <p style={FF} className="text-[11px] text-[#001161]/50 font-bold uppercase tracking-wide">
                          {'Kolegov\u00e9 s p\u0159\u00edstupem ve va\u0161\u00ed \u0161kole'}
                        </p>
                      </div>
                      <p style={{ ...FF, color: expandCfg.color }} className="text-[13px] font-bold">{colleagueText}</p>
                    </div>
                  )}

                  {/* ── No owner fallback ── */}
                  {!owner && (
                    <div className="flex items-start gap-2.5">
                      <p style={FF} className="text-[13px] text-[#001161]/70 leading-relaxed">
                        {colleagueText ? (
                          <>
                            {'Kontaktn\u00ed osobu pro tuto \u0161kolu tu te\u010f nezobrazujeme\u00a0\u2014 zkuste pros\u00edm kolegy v\u00fd\u0161e, p\u0159\u00edpadn\u011b n\u00e1m napi\u0161te na\u00a0'}
                            <a href="mailto:hello@vividbooks.com" className="font-bold no-underline hover:opacity-75" style={{ color: expandCfg.color }}>
                              hello@vividbooks.com
                            </a>
                            .
                          </>
                        ) : (
                          <>
                            {'Napi\u0161te n\u00e1m pros\u00edm na\u00a0'}
                            <a href="mailto:hello@vividbooks.com" className="font-bold no-underline hover:opacity-75" style={{ color: expandCfg.color }}>
                              hello@vividbooks.com
                            </a>
                            {' a domluv\u00edme p\u0159\u00edstup pro va\u0161i \u0161kolu.'}
                          </>
                        )}
                      </p>
                    </div>
                  )}

                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-[13px]"
                style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                <span className="mt-0.5 shrink-0">{cfg.icon}</span>
                {(pdStatus === 'new' || pdStatus === 'known') && pdMessage.includes('\n\n') ? (
                  <div style={FF} className="leading-snug min-w-0 flex-1">
                    {(() => {
                      const parts = pdMessage.split('\n\n');
                      const head = parts[0] ?? '';
                      const tail = parts.slice(1).join('\n\n');
                      return (
                        <>
                          <p style={FF} className="font-bold m-0 mb-1.5 text-[14px]">{head}</p>
                          <p style={FF} className="m-0 opacity-90 leading-relaxed">{tail}</p>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <span style={FF} className="leading-snug">{pdMessage}</span>
                )}
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
  /** CRM: od posledního trial dealu podle IČO neuplynulo 6×30 dní */
  const [trialCooldownActive, setTrialCooldownActive] = useState(false);
  const [trialNextEligibleAt, setTrialNextEligibleAt] = useState<string | null>(null);
  /** Dev: poslední odpověď school-pipedrive-check (jen když je zapnutý debug UI) */
  const [pdCheckRaw, setPdCheckRaw] = useState<unknown | null>(null);
  const [pdCheckDebugOpen, setPdCheckDebugOpen] = useState(false);

  // Form
  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '' });
  /** Kódy předmětů (Webflow data-value), např. Mathematics-1 */
  const [subjects2nd, setSubjects2nd] = useState<string[]>([]);
  const [subjects1st, setSubjects1st] = useState<string[]>([]);
  /** Zástupce ředitele: SchoolStage-1 | SchoolStage-2 */
  const [schoolStages, setSchoolStages] = useState<string[]>([]);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  /** Po úspěchu z API: přístupové kódy (žák / učitel) */
  const [trialResult, setTrialResult] = useState<FreeTrialSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Email dedup
  const [emailCheck, setEmailCheck] = useState<{ canRequest: boolean; alreadyRequested?: boolean; cooldownDateStr?: string; daysLeft?: number; cooldownExpired?: boolean } | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  const isTeacher = form.position === 'U\u010ditel/ka';
  const isDeputy = form.position === 'Z\u00e1stupce/kyn\u011b \u0159editele';

  /** Rozšířená fialová karta + bez formuláře — předplatné, zkušební přístup nebo rozjetý krok v CRM. */
  const schoolHasActiveLicense =
    (pdStatus === 'active_subscription' ||
      pdStatus === 'active_trial' ||
      pdStatus === 'in_progress') &&
    !!pdMessage &&
    !pdLoading;

  const schoolHasRecentTrialBlock =
    trialCooldownActive &&
    !pdLoading &&
    !schoolHasActiveLicense &&
    pdStatus !== 'unknown' &&
    pdStatus !== 'invalid' &&
    pdStatus !== null &&
    ico.length >= 6;

  const trialNextEligibleDisplay = useMemo(() => {
    if (!trialNextEligibleAt) return null;
    const d = new Date(trialNextEligibleAt);
    if (Number.isNaN(d.getTime())) return null;
    return {
      dateStr: d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }),
      daysLeft: Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
    };
  }, [trialNextEligibleAt]);

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
    if (!ico || ico.length < 6) {
      setPdStatus(null);
      setPdMessage('');
      setColleagues([]);
      setOwner(null);
      setProducts([]);
      setTrialCooldownActive(false);
      setTrialNextEligibleAt(null);
      setPdCheckRaw(null);
      setPdCheckDebugOpen(false);
      return;
    }
    pdTimer.current = setTimeout(async () => {
      setPdLoading(true);
      const debugHud = showPipedriveIcoDebugControls();
      if (debugHud) setPdCheckRaw(null);
      try {
        const url = `${SERVER}/school-pipedrive-check?ico=${encodeURIComponent(ico)}${debugHud ? '&includePipedriveRaw=1' : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
        const text = await res.text();
        let data: Record<string, unknown> = {};
        try {
          data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          if (debugHud) {
            setPdCheckRaw({
              _request: { ico, url, httpStatus: res.status, ok: res.ok, jsonParseFailed: true },
              _rawBody: text.slice(0, 4000),
            });
          }
          setPdStatus('unknown');
          setPdMessage('');
          setColleagues([]);
          setOwner(null);
          setProducts([]);
          setTrialCooldownActive(false);
          setTrialNextEligibleAt(null);
          return;
        }
        if (debugHud) {
          setPdCheckRaw({
            _request: { ico, url, httpStatus: res.status, ok: res.ok },
            ...data,
          });
        }
        setPdStatus((data.status as PipedriveStatus) || 'unknown');
        setPdMessage(typeof data.message === 'string' ? data.message : '');
        setColleagues(Array.isArray(data.colleagues) ? (data.colleagues as string[]) : []);
        setOwner((data.owner as PdOwner | null) ?? null);
        setProducts(Array.isArray(data.products) ? (data.products as string[]) : []);
        setTrialCooldownActive(!!data.trialCooldownActive);
        setTrialNextEligibleAt(typeof data.trialNextEligibleAt === 'string' ? data.trialNextEligibleAt : null);
        if (typeof data.orgName === 'string' && data.orgName) {
          setSchoolName((prev) => (prev.trim() ? prev : data.orgName as string));
        }
      } catch (e) {
        if (debugHud) {
          setPdCheckRaw({
            _request: { ico, endpoint: 'school-pipedrive-check' },
            _networkError: String(e instanceof Error ? e.message : e),
          });
        }
        setPdStatus('unknown');
        setPdMessage('');
        setColleagues([]);
        setOwner(null);
        setProducts([]);
        setTrialCooldownActive(false);
        setTrialNextEligibleAt(null);
      } finally {
        setPdLoading(false);
      }
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
    if (name === 'position') {
      setSubjects2nd([]);
      setSubjects1st([]);
      setSchoolStages([]);
    }
  };

  const toggleSubject = (list: string[], setList: (v: string[]) => void, code: string) =>
    setList(list.includes(code) ? list.filter(s => s !== code) : [...list, code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (schoolHasActiveLicense || schoolHasRecentTrialBlock) return;
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
    if (isDeputy && schoolStages.length === 0) {
      setFormError('Vyberte pros\u00edm alespo\u0148 jeden stupe\u0148 \u0161koly.');
      flash('trial-field-deputy-stages');
      return;
    }
    setSubmitting(true);
    setFormError('');
    const payload: FreeTrialFields = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      position: form.position,
      schoolName: schoolName.trim(),
      vat: ico.trim(),
      gdpr: gdprConsent,
      newsletter: newsletterConsent,
      teacherSubjects: isTeacher ? [...subjects1st, ...subjects2nd] : [],
      schoolStages: isDeputy ? schoolStages : [],
    };
    try {
      const result = await submitFreeTrialAjax(payload);
      if (result.status === 'error') {
        setFormError(result.message);
        return;
      }
      setTrialResult(result);
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nepodařilo se odeslat formulář.';
      setFormError(msg);
      console.error('[TrialPage] free-trial-ajax:', err);
    } finally {
      setSubmitting(false);
    }
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
            <p style={FF} className="text-[#001161]/60 text-[14px] mb-6">{'T\u00fdm Vividbooks v\u00e1m brzy po\u0161le p\u0159\u00edstupov\u00e9 \u00fadaje.'}</p>
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
            {trialResult?.status === 'codes' ? (
              <>
                <p style={FF} className="text-[#001161]/70 text-[14px] mb-6 leading-snug">
                  {trialResult.kind === 'existing_trial'
                    ? 'Va\u0161e \u0161kola u\u017e m\u00e1 aktivn\u00ed zku\u0161ebn\u00ed p\u0159\u00edstup. Pro p\u0159ihl\u00e1\u0161en\u00ed pou\u017eijte tyto k\u00f3dy:'
                    : 'Va\u0161e p\u0159\u00edstupov\u00e9 k\u00f3dy pro zku\u0161ebn\u00ed verzi:'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto">
                  <div className="rounded-[14px] bg-white border border-[#001161]/10 px-4 py-3 shadow-sm">
                    <p style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45 mb-1">
                      {'K\u00f3d pro u\u010ditele'}
                    </p>
                    <p style={FF} className="font-mono text-[18px] font-bold text-[#001161] tracking-wide break-all">
                      {trialResult.teacherCode}
                    </p>
                  </div>
                  <div className="rounded-[14px] bg-white border border-[#001161]/10 px-4 py-3 shadow-sm">
                    <p style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45 mb-1">
                      {'K\u00f3d pro \u017e\u00e1ka'}
                    </p>
                    <p style={FF} className="font-mono text-[18px] font-bold text-[#001161] tracking-wide break-all">
                      {trialResult.studentCode}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p style={FF} className="text-[#001161]/60 text-[15px]">
                {'Ozveme se v\u00e1m co nejd\u0159\u00edve s p\u0159\u00edstupov\u00fdmi \u00fadaji.'}
              </p>
            )}
            <a
              href="https://app.vividbooks.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-4 font-bold text-[16px] text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9]"
              style={FF}>
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              {'Otev\u0159\u00edt aplikaci'}
            </a>
            <TrialTrainingVideosList />
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
                hidePipedriveStatusCard={schoolHasRecentTrialBlock}
                pipedriveDebug={showPipedriveIcoDebugControls()
                  ? { raw: pdCheckRaw, open: pdCheckDebugOpen, onToggle: () => setPdCheckDebugOpen((v) => !v) }
                  : undefined}
              />
            </div>

            {schoolHasRecentTrialBlock && (() => {
              const extendMail = owner?.email || 'hello@vividbooks.com';
              const extendSubject = encodeURIComponent('Prodlou\u017een\u00ed p\u0159\u00edstupu k u\u010debn\u00edcm Vividbooks');
              const extendBody = encodeURIComponent(
                `Dobr\u00fd den,\n\npros\u00edm o prodlou\u017een\u00ed / up\u0159esn\u011bn\u00ed p\u0159\u00edstupu k digit\u00e1ln\u00edm u\u010debnic\u00edm Vividbooks pro \u0161kolu:\n${schoolName || ''}\nI\u010cO: ${ico}\n\nD\u011bkuji.`,
              );
              const extendHref = `mailto:${extendMail}?subject=${extendSubject}&body=${extendBody}`;
              return (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl overflow-hidden border border-amber-200 bg-amber-50/90"
              >
                <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
                  <Clock className="w-4 h-4 shrink-0 text-amber-600" aria-hidden />
                  <p style={FF} className="text-[14px] font-bold text-amber-900">
                    {'Tato \u0161kola dostala p\u0159\u00edstup ned\u00e1vno'}
                  </p>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <div className="rounded-xl border border-amber-200/80 bg-white/70 px-3.5 py-3 space-y-2.5">
                    <p style={FF} className="text-[13px] text-[#001161]/80 leading-relaxed m-0">
                      {'Zku\u0161ebn\u00ed p\u0159\u00edstupy vyd\u00e1v\u00e1me ka\u017ed\u00e9 \u0161kole jednou za \u0161est m\u011bs\u00edc\u016f.'}
                    </p>
                    <div className="rounded-lg bg-amber-50/90 border border-amber-100 px-3 py-2.5">
                      <p style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45 mb-2">
                        {'Napi\u0161te n\u00e1m'}
                      </p>
                      <div className="flex gap-3 items-start">
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-amber-200/80 bg-amber-100/40 shadow-sm">
                          <ImageWithFallback
                            src={TEAM_PHOTOS['gabriela@vividbooks.com']}
                            alt="Gabriela"
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                        <p style={FF} className="text-[13px] text-[#001161]/80 leading-snug m-0 flex-1 min-w-0 pt-0.5">
                          {'Pot\u0159ebujete p\u0159\u00edstup d\u0159\u00edv? Napi\u0161te pros\u00edm na '}
                          <a
                            href={extendHref}
                            className="inline-flex items-center gap-1.5 font-bold text-amber-900 underline underline-offset-2 hover:opacity-80"
                            style={FF}
                          >
                            <Mail className="w-4 h-4 shrink-0" aria-hidden />
                            {extendMail}
                          </a>
                          {owner?.name ? (
                            <span className="text-[#001161]/70">
                              {' ('}
                              {owner.name}
                              {').'}
                            </span>
                          ) : (
                            '.'
                          )}
                        </p>
                      </div>
                    </div>
                    <p style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45 pt-0.5 m-0">
                      {'Dal\u0161\u00ed \u017e\u00e1dost p\u0159es tento formul\u00e1\u0159'}
                    </p>
                    <ul className="space-y-2 list-none m-0 p-0">
                      <li className="flex gap-2.5" style={FF}>
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                        <span className="text-[13px] text-[#001161]/75 leading-snug">
                          {trialNextEligibleDisplay ? (
                            <>
                              {'Nov\u00fd p\u0159\u00edstup z tohoto formul\u00e1\u0159e bude mo\u017en\u00fd od '}
                              <span className="font-bold text-amber-900">{trialNextEligibleDisplay.dateStr}</span>
                              {trialNextEligibleDisplay.daysLeft > 0 ? (
                                <>
                                  {' ('}
                                  {'za '}
                                  <span className="font-semibold text-[#001161]">{trialNextEligibleDisplay.daysLeft}</span>
                                  {'\u00a0dn\u00ed).'}
                                </>
                              ) : (
                                '.'
                              )}
                            </>
                          ) : (
                            <>
                              {'Term\u00edn dal\u0161\u00edho p\u0159\u00edstupu z formul\u00e1\u0159e v\u00e1m r\u00e1di potvrd\u00edme na '}
                              <a href="mailto:hello@vividbooks.com" className="font-bold text-amber-800 underline underline-offset-2 hover:opacity-80">
                                hello@vividbooks.com
                              </a>
                              .
                            </>
                          )}
                        </span>
                      </li>
                      {colleagues.length > 0 ? (
                        <li className="flex gap-2.5" style={FF}>
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                          <span className="text-[13px] text-[#001161]/75 leading-snug">
                            <span className="font-bold text-[#001161]">
                              {'Kolegov\u00e9 s p\u0159\u00edstupem ve va\u0161\u00ed \u0161kole'}
                            </span>
                            {': '}
                            <span className="font-semibold text-[#001161]">{colleagues.join(', ')}</span>
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              </motion.div>
              );
            })()}

            {!schoolHasActiveLicense && !schoolHasRecentTrialBlock && (
              <>
            <div className="space-y-2 py-1">
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
                    <p style={FF} className="text-[14px] font-bold text-[#001161]">{'U\u010d\u00edte? *'}</p>
                    <div>
                      <p style={FF} className="text-[12px] font-semibold text-[#001161]/70 mb-3">{'1. stupe\u0148'}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {TEACHER_SUBJECTS_1ST.map(({ value, label }) => (
                          <SubjectCheckbox
                            key={`1-${value}`}
                            label={label}
                            checked={subjects1st.includes(value)}
                            onChange={() => toggleSubject(subjects1st, setSubjects1st, value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={FF} className="text-[12px] font-semibold text-[#001161]/70 mb-3">{'2. stupe\u0148'}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {TEACHER_SUBJECTS_2ND.map(({ value, label }) => (
                          <SubjectCheckbox
                            key={`2-${value}`}
                            label={label}
                            checked={subjects2nd.includes(value)}
                            onChange={() => toggleSubject(subjects2nd, setSubjects2nd, value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isDeputy && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div id="trial-field-deputy-stages" className="bg-white/60 rounded-2xl p-5 space-y-3 border border-[#001161]/8">
                    <p style={FF} className="text-[14px] font-bold text-[#001161]">{'Na jak\u00e9m stupni? *'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {DEPUTY_SCHOOL_STAGES.map(({ value, label }) => (
                        <SubjectCheckbox
                          key={value}
                          label={label}
                          checked={schoolStages.includes(value)}
                          onChange={() => toggleSubject(schoolStages, setSchoolStages, value)}
                        />
                      ))}
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
                <Link to="/kontakt" className="underline text-[#001161] hover:text-[#E8942A] transition-colors">{'Z\u00e1sad ochrany osobn\u00edch \u00fadaj\u016f.'}</Link>
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
                <br />
                {'Novinky, tipy do v\u00fduky a akce \u2014 pos\u00edl\u00e1me je jen tehdy, kdy\u017e stoj\u00ed za p\u0159e\u010dten\u00ed. Bez spamu.'}
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
              </>
            )}
          </form>
        )}
      </div>
    </motion.div>
  );
}