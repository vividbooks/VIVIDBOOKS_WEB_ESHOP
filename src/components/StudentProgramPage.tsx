import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useSearchParams } from 'react-router';
import {
  GraduationCap, Mail, CheckCircle, CheckCircle2, AlertCircle, Loader2, Sparkles, BookOpen, Users, ExternalLink,
  School, Clock, ShieldCheck, Phone, Search, Send, HelpCircle, ArrowRight,
} from 'lucide-react';
import { SEOHead } from './SEOHead';
import { TrialTrainingVideosList } from './TrialTrainingVideosList';
import { SubjectCheckbox } from './TrialSubjectCheckbox';
import { TEACHER_SUBJECTS_1ST, TEACHER_SUBJECTS_2ND } from '../utils/trialSubjectOptions';
import { isValidEmailFormat, EMAIL_FORMAT_HINT_CS } from '../utils/emailValidation';
import { flashInvalidField } from '../utils/formFieldHighlight';
import { APP_ENTRY_PATH } from '../config/publicUrls';
import {
  checkStudentEmail,
  fetchStudentSelf,
  registerStudent,
  searchSchoolsRegistry,
  updateStudentSelf,
  verifyStudentToken,
  type CheckEmailResult,
  type RegisterResult,
  type StudentProgramStudentView,
} from '../utils/studentProgramApi';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const INPUT_CLASS =
  'w-full text-[15px] text-[#001161] bg-white border border-[#001161]/12 rounded-xl px-5 py-3.5 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all placeholder:text-[#001161]/35';
const SELECT_ARROW =
  "appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23001161%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_20px_center] cursor-pointer";

const PAGE_TITLE = 'Vividbooks pro studenty učitelství zdarma';
const PAGE_DESC =
  'Studujete učitelství? Získejte přístup do Vividbooks zdarma po celou dobu studia. Stačí univerzitní e-mail — materiály, se kterými učí přes 600 základních škol.';

const MONTHS_CS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

function graduationOptions(): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  const startYear = now.getFullYear();
  for (let y = startYear; y <= startYear + 7; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === startYear && m < now.getMonth() + 1) continue;
      // Konec studia bývá v červnu nebo v září — ostatní měsíce nabídneme taky, ale až po nich.
      out.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS_CS[m - 1]} ${y}` });
    }
  }
  return out;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ══════════════════════════════════════════
   Kódy + „jak začít“ (po ověření i v aktualizaci)
══════════════════════════════════════════ */
function AccessCard({ student, codesPending }: { student: StudentProgramStudentView; codesPending?: boolean }) {
  const hasCodes = !!(student.teacherCode && student.studentCode);
  return (
    <div className="bg-[#F0FDF4] border border-green-200 rounded-[24px] p-6 md:p-8 text-center">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[26px] leading-tight mb-2">
        {student.firstName ? `Vítejte, ${student.firstName}!` : 'Vítejte ve Vividbooks!'}
      </h2>
      <p style={FF} className="text-[#001161]/70 text-[14px] mb-5 leading-snug">
        {hasCodes
          ? 'Váš přístup je aktivní. Kódy jsme poslali i e-mailem, ať je máte po ruce.'
          : codesPending
            ? 'Přístup máme založený. Kódy pro vaši fakultu právě připravujeme ručně — pošleme je e-mailem nejpozději do dvou pracovních dnů.'
            : 'Váš přístup je aktivní.'}
      </p>
      {hasCodes && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto mb-5">
          <div className="rounded-[14px] bg-white border border-[#001161]/10 px-4 py-3 shadow-sm">
            <p style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45 mb-1">Kód pro učitele</p>
            <p style={FF} className="font-mono text-[18px] font-bold text-[#001161] tracking-wide break-all">{student.teacherCode}</p>
          </div>
          <div className="rounded-[14px] bg-white border border-[#001161]/10 px-4 py-3 shadow-sm">
            <p style={FF} className="text-[11px] font-bold uppercase tracking-wide text-[#001161]/45 mb-1">Kód pro žáka</p>
            <p style={FF} className="font-mono text-[18px] font-bold text-[#001161] tracking-wide break-all">{student.studentCode}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl p-5 text-left space-y-3 max-w-md mx-auto mb-5">
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[12px] font-bold flex items-center justify-center shrink-0" style={FF}>1</span>
          <p style={FF} className="text-[#001161]/75 text-[13px] leading-snug">Otevřete aplikaci a zvolte přihlášení <strong>kódem školy</strong>. Zadejte kód pro učitele a svůj e-mail.</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[12px] font-bold flex items-center justify-center shrink-0" style={FF}>2</span>
          <p style={FF} className="text-[#001161]/75 text-[13px] leading-snug">Zabezpečte účet heslem nebo Googlem — odemkne se <strong>Můj obsah</strong> pro vlastní přípravy.</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[12px] font-bold flex items-center justify-center shrink-0" style={FF}>3</span>
          <p style={FF} className="text-[#001161]/75 text-[13px] leading-snug">Kód pro žáka použijte v anonymním okně, když chcete vidět hodinu očima dětí.</p>
        </div>
        {student.accessValidUntil && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#001161]/8">
            <Clock className="w-4 h-4 text-[#001161]/40 shrink-0" />
            <p style={FF} className="text-[#001161]/55 text-[12px]">Přístup platí do {fmtDate(student.accessValidUntil)} (konec studia + půl roku). Když se studium protáhne, stačí datum upravit.</p>
          </div>
        )}
      </div>
      <Link
        to={APP_ENTRY_PATH}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-4 font-bold text-[16px] text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.02] hover:bg-[#6D28D9] no-underline"
        style={FF}
      >
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
        Otevřít aplikaci
      </Link>
      <TrialTrainingVideosList />
    </div>
  );
}

/* ══════════════════════════════════════════
   Registrační formulář
══════════════════════════════════════════ */
function StudentRegistrationForm({ presetFacultyId }: { presetFacultyId?: string | null }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    universityEmail: '',
    personalEmail: '',
    phone: '',
    facultyId: presetFacultyId || '',
    studyProgramme: '',
    expectedGraduation: '',
    consentTerms: false,
    newsletter: true,
  });
  const [stages, setStages] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [emailCheck, setEmailCheck] = useState<CheckEmailResult | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const debouncedEmail = useDebounced(form.universityEmail.trim().toLowerCase(), 500);
  const gradOptions = useMemo(graduationOptions, []);

  useEffect(() => {
    if (!debouncedEmail || !isValidEmailFormat(debouncedEmail)) {
      setEmailCheck(null);
      return;
    }
    let cancelled = false;
    setEmailChecking(true);
    checkStudentEmail(debouncedEmail)
      .then((r) => {
        if (cancelled) return;
        setEmailCheck(r);
        if (r.ok) {
          setForm((f) => {
            const stillValid = r.faculties.some((x) => x.id === f.facultyId);
            return { ...f, facultyId: stillValid ? f.facultyId : r.faculties.length === 1 ? r.faculties[0].id : f.facultyId && r.faculties.some((x) => x.id === f.facultyId) ? f.facultyId : '' };
          });
        }
      })
      .catch(() => {
        if (!cancelled) setEmailCheck({ ok: false, reason: 'error' });
      })
      .finally(() => {
        if (!cancelled) setEmailChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedEmail]);

  const flash = (id: string) => flashInvalidField(document.getElementById(id));
  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setFormError('');
  };
  const toggleStage = (v: string) => {
    setStages((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
    setFormError('');
  };
  const toggleSubject = (v: string) => {
    setSubjects((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
    setFormError('');
  };

  const subjectOptions = useMemo(() => {
    const list: Array<{ value: string; label: string; stage: string }> = [];
    if (stages.includes('SchoolStage-1')) list.push(...TEACHER_SUBJECTS_1ST.map((o) => ({ ...o, stage: '1. stupeň' })));
    if (stages.includes('SchoolStage-2')) list.push(...TEACHER_SUBJECTS_2ND.map((o) => ({ ...o, stage: '2. stupeň' })));
    return list;
  }, [stages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.firstName.trim()) { setFormError('Vyplňte prosím jméno.'); flash('sp-first'); return; }
    if (!form.lastName.trim()) { setFormError('Vyplňte prosím příjmení.'); flash('sp-last'); return; }
    const uni = form.universityEmail.trim().toLowerCase();
    if (!uni || !isValidEmailFormat(uni)) { setFormError(EMAIL_FORMAT_HINT_CS); flash('sp-uni'); return; }
    if (emailCheck && !emailCheck.ok && emailCheck.reason === 'not_university') {
      setFormError('Použijte prosím e-mail své univerzity (např. …@cuni.cz, …@mail.muni.cz). Když ho škola nemá, napište nám na hello@vividbooks.com.');
      flash('sp-uni');
      return;
    }
    if (emailCheck?.ok && emailCheck.faculties.length > 1 && !form.facultyId) { setFormError('Vyberte prosím fakultu.'); flash('sp-faculty'); return; }
    const pers = form.personalEmail.trim().toLowerCase();
    if (pers && !isValidEmailFormat(pers)) { setFormError('Osobní e-mail nemá správný formát.'); flash('sp-pers'); return; }
    if (pers && pers === uni) { setFormError('Osobní e-mail musí být jiný než univerzitní.'); flash('sp-pers'); return; }
    if (!form.expectedGraduation) { setFormError('Vyberte prosím předpokládaný konec studia.'); flash('sp-grad'); return; }
    if (stages.length === 0) { setFormError('Vyberte prosím stupeň, na který se připravujete.'); flash('sp-stages'); return; }
    if (subjects.length === 0) { setFormError('Vyberte aspoň jeden předmět.'); flash('sp-subjects'); return; }
    if (!form.consentTerms) { setFormError('Potřebujeme váš souhlas s podmínkami programu.'); flash('sp-consent'); return; }

    setSubmitting(true);
    setFormError('');
    try {
      const utm: Record<string, string> = {};
      try {
        const sp = new URLSearchParams(window.location.search);
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'f']) {
          const v = sp.get(k);
          if (v) utm[k] = v;
        }
      } catch {}
      const r = await registerStudent({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        universityEmail: uni,
        personalEmail: pers,
        phone: form.phone.trim(),
        facultyId: form.facultyId || (emailCheck?.ok ? emailCheck.faculties[0]?.id || '' : ''),
        studyProgramme: form.studyProgramme.trim(),
        subjects,
        schoolStages: stages,
        expectedGraduation: form.expectedGraduation,
        consentTerms: form.consentTerms,
        newsletter: form.newsletter,
        source: 'web-studenti',
        utm,
      });
      setResult(r);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Odeslání se nepodařilo. Zkuste to prosím znovu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const isPending = result.status === 'pending';
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#F0FDF4] border border-green-200 rounded-[24px] p-8 text-center">
        <Mail className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[24px] mb-2">
          {isPending ? 'Zkontrolujte univerzitní schránku' : result.status === 'already_active' ? 'Už máte přístup' : 'Ozvěte se nám'}
        </h2>
        <p style={FF} className="text-[#001161]/70 text-[14px] leading-relaxed max-w-md mx-auto">
          {isPending ? (
            <>
              Poslali jsme ověřovací odkaz na <strong>{form.universityEmail.trim()}</strong>. Klikněte na něj a přístup se aktivuje během chvilky. Odkaz platí 7 dní — když e-mail nevidíte, mrkněte do spamu.
            </>
          ) : (
            result.message
          )}
        </p>
        {isPending && !result.emailSent && (
          <p style={FF} className="mt-4 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            E-mail se nepodařilo odeslat. Zkuste registraci za pár minut znovu, nebo nám napište na hello@vividbooks.com.
          </p>
        )}
      </motion.div>
    );
  }

  const uniOk = emailCheck?.ok === true;
  const uniBad = emailCheck && !emailCheck.ok && emailCheck.reason === 'not_university';

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input id="sp-first" name="firstName" placeholder="Jméno *" value={form.firstName} onChange={handle} className={INPUT_CLASS} style={FF} autoComplete="given-name" />
        <input id="sp-last" name="lastName" placeholder="Příjmení *" value={form.lastName} onChange={handle} className={INPUT_CLASS} style={FF} autoComplete="family-name" />
      </div>

      <div id="sp-uni" className="rounded-[18px] p-1 -m-1">
        <div className="relative">
          <input
            name="universityEmail"
            type="email"
            placeholder="Univerzitní e-mail *"
            value={form.universityEmail}
            onChange={handle}
            className={`${INPUT_CLASS} pr-12 ${uniOk ? 'border-green-400 focus:border-green-500 focus:ring-green-500/20' : uniBad ? 'border-red-300' : ''}`}
            style={FF}
            autoComplete="email"
            inputMode="email"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            {emailChecking ? <Loader2 className="w-5 h-5 text-[#001161]/40 animate-spin" /> : uniOk ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : uniBad ? <AlertCircle className="w-5 h-5 text-red-400" /> : null}
          </span>
        </div>
        <AnimatePresence>
          {uniOk && emailCheck.ok && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={FF} className="text-[12px] text-green-700 px-2 pt-2">
              {emailCheck.university}{emailCheck.existingStatus && emailCheck.existingStatus !== 'pending' ? ' — tenhle e-mail už přístup má, po odeslání vám pošleme údaje znovu.' : ' — skvělé, univerzitní adresa sedí.'}
            </motion.p>
          )}
          {uniBad && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={FF} className="text-[12px] text-red-600 px-2 pt-2">
              Doména <strong>{emailCheck.domain}</strong> není v seznamu českých univerzit s učitelstvím. Použijte školní e-mail — nebo nám napište na hello@vividbooks.com, doplníme ji.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {uniOk && emailCheck.ok && emailCheck.faculties.length > 1 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <select id="sp-faculty" name="facultyId" value={form.facultyId} onChange={handle} className={`${INPUT_CLASS} ${SELECT_ARROW}`} style={FF}>
              <option value="" disabled>Fakulta *</option>
              {emailCheck.faculties.map((f) => (
                <option key={f.id} value={f.id}>{f.faculty} ({f.facultyShort})</option>
              ))}
            </select>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div id="sp-pers" className="rounded-[14px] p-1 -m-1">
          <input name="personalEmail" type="email" placeholder="Osobní e-mail (doporučeno)" value={form.personalEmail} onChange={handle} className={INPUT_CLASS} style={FF} inputMode="email" />
        </div>
        <input name="phone" type="tel" placeholder="Telefon (nepovinné)" value={form.phone} onChange={handle} className={INPUT_CLASS} style={FF} autoComplete="tel" inputMode="tel" />
      </div>
      <p style={FF} className="text-[12px] text-[#001161]/50 px-2 -mt-1 leading-snug">
        Osobní e-mail použijeme, až vám školní schránka skončí — ať o přístup nepřijdete. Telefon jen pro pozvánky na workshopy pro budoucí učitele.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="studyProgramme" placeholder="Studijní program / obor" value={form.studyProgramme} onChange={handle} className={INPUT_CLASS} style={FF} />
        <select id="sp-grad" name="expectedGraduation" value={form.expectedGraduation} onChange={handle} className={`${INPUT_CLASS} ${SELECT_ARROW}`} style={FF}>
          <option value="" disabled>Předpokládaný konec studia *</option>
          {gradOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div id="sp-stages" className="bg-white/60 rounded-2xl p-5 space-y-4 border border-[#001161]/8">
        <p style={FF} className="text-[14px] font-bold text-[#001161]">Na jaký stupeň se připravujete? *</p>
        <div className="grid grid-cols-2 gap-2">
          <SubjectCheckbox label="1. stupeň ZŠ" checked={stages.includes('SchoolStage-1')} onChange={() => toggleStage('SchoolStage-1')} />
          <SubjectCheckbox label="2. stupeň ZŠ" checked={stages.includes('SchoolStage-2')} onChange={() => toggleStage('SchoolStage-2')} />
        </div>
        <AnimatePresence>
          {subjectOptions.length > 0 && (
            <motion.div id="sp-subjects" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <p style={FF} className="text-[13px] font-bold text-[#001161] mb-2 pt-1">Které předměty chcete učit? *</p>
              <div className="grid grid-cols-2 gap-2">
                {subjectOptions.map((o) => (
                  <SubjectCheckbox key={o.value} label={stages.length > 1 ? `${o.label} (${o.stage})` : o.label} checked={subjects.includes(o.value)} onChange={() => toggleSubject(o.value)} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <label id="sp-consent" className="flex items-start gap-3 cursor-pointer pt-1 rounded-[14px] p-1 -m-1">
        <input type="checkbox" name="consentTerms" checked={form.consentTerms} onChange={handle} className="mt-1 w-4 h-4 accent-[#7C3AED]" />
        <span style={FF} className="text-[13px] text-[#001161]/70 leading-snug">
          Souhlasím s podmínkami studentského programu: přístup je určen jen pro mé studium, jednou za půl roku mi Vividbooks napíše ohledně stavu studia a po jeho skončení mi přístup zůstává ještě 6 měsíců. *
        </span>
      </label>
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" name="newsletter" checked={form.newsletter} onChange={handle} className="mt-1 w-4 h-4 accent-[#7C3AED]" />
        <span style={FF} className="text-[13px] text-[#001161]/70 leading-snug">
          Chci dostávat tipy do výuky, pozvánky na webináře a workshopy pro studenty učitelství (max. 2× měsíčně).
        </span>
      </label>

      {formError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p style={FF} className="text-[13px] text-red-700">{formError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-4 font-bold text-[16px] text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:scale-[1.01] hover:bg-[#6D28D9] disabled:opacity-60 disabled:hover:scale-100"
        style={FF}
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
        {submitting ? 'Odesílám…' : 'Získat přístup zdarma'}
      </button>
      <p style={FF} className="text-[11px] text-[#001161]/40 text-center leading-snug">
        Vaše údaje zpracováváme podle <a href="https://www.vividbooks.cz/gdpr" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#001161]/70">zásad ochrany osobních údajů</a>. Přístup je vázaný na univerzitní e-mail a je nepřenosný.
      </p>
    </form>
  );
}

/* ══════════════════════════════════════════
   Marketingové bloky microsite
══════════════════════════════════════════ */
const BENEFITS = [
  { icon: BookOpen, title: 'Knihovna hotových materiálů', text: 'Interaktivní lekce, pracovní listy, učební texty a metodiky pro matematiku, fyziku, chemii, přírodopis a prvouku — to samé, co používají učitelé ve školách.' },
  { icon: Sparkles, title: 'Vividboard a vlastní přípravy', text: 'Postavte si hodinu na praxi: aktivity, hlasování, soutěže. Editor dokumentu a pracovního listu pro vlastní materiály a seminární práce.' },
  { icon: Users, title: 'Pohled žáka i učitele', text: 'Dva kódy — učitelský a žákovský. Vyzkoušíte, jak hodina vypadá z lavice, a naučíte se s materiály pracovat dřív, než stanete před třídou.' },
  { icon: ShieldCheck, title: 'Zdarma po celou dobu studia', text: 'Žádná platební karta, žádný závazek. Přístup platí po dobu studia a ještě půl roku po něm, ať máte materiály po ruce i v prvním roce ve škole.' },
];

const STEPS = [
  { n: '1', title: 'Zadejte univerzitní e-mail', text: 'Poznáme podle něj fakultu. Fungují adresy všech českých univerzit s učitelskými programy.' },
  { n: '2', title: 'Potvrďte odkaz v e-mailu', text: 'Přijde během minuty. Kliknutím ověříte, že jste student, a přístup se aktivuje.' },
  { n: '3', title: 'Otevřete aplikaci', text: 'Dostanete dva kódy a rovnou můžete začít — na počítači, tabletu i v učebně na praxi.' },
];

const FAQ = [
  { q: 'Kdo má na přístup nárok?', a: 'Studenti bakalářských, magisterských i doktorských programů zaměřených na učitelství na českých univerzitách — pedagogické fakulty i další fakulty s učitelskými obory (přírodovědecké, filozofické, MFF a další).' },
  { q: 'Jak dlouho přístup platí?', a: 'Po celou dobu studia podle data, které zadáte, plus 6 měsíců po jeho skončení. Jednou za půl roku vám napíšeme a zeptáme se, jestli ještě studujete — datum můžete kdykoli upravit.' },
  { q: 'Můžu materiály použít na praxi ve škole?', a: 'Ano, přesně na to je program určený. Promítejte lekce, spouštějte aktivity ve vividboardu a tiskněte pracovní listy pro žáky. Jen prosím nepředávejte kódy dál — přístup je vázaný na vás.' },
  { q: 'Co když má škola, kde budu učit, o Vividbooks zájem?', a: 'Skvělé! Po skončení studia se vás zeptáme, kam nastupujete, a vaší škole rádi ukážeme Vividbooks a připravíme nezávaznou kalkulaci. Škola si může Vividbooks nejdřív 14 dní vyzkoušet zdarma.' },
  { q: 'Můj univerzitní e-mail systém nezná.', a: 'Napište nám na hello@vividbooks.com — doplníme doménu a přístup založíme ručně.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#001161]/8 rounded-2xl bg-white overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer">
        <span style={FF} className="text-[15px] font-bold text-[#001161]">{q}</span>
        <HelpCircle className={`w-5 h-5 shrink-0 transition-transform ${open ? 'text-[#7C3AED] rotate-12' : 'text-[#001161]/30'}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p style={FF} className="px-5 pb-5 text-[14px] text-[#001161]/70 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════
   /studenti
══════════════════════════════════════════ */
export function StudentProgramPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const presetFaculty = searchParams.get('f');
  const [verifying, setVerifying] = useState(!!token);
  const [verified, setVerified] = useState<{ student: StudentProgramStudentView; codesPending?: boolean; alreadyVerified?: boolean } | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setVerifying(true);
    verifyStudentToken(token)
      .then((r) => {
        if (cancelled) return;
        if (r.valid && r.student) setVerified({ student: r.student, codesPending: r.codesPending, alreadyVerified: r.alreadyVerified });
        else setVerifyError(r.error || 'Odkaz je neplatný.');
      })
      .catch(() => {
        if (!cancelled) setVerifyError('Ověření se nepodařilo. Zkuste odkaz otevřít znovu.');
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (token && verifying) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <SEOHead title={PAGE_TITLE} path="/studenti" description={PAGE_DESC} noIndex />
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#7C3AED]/20 border-t-[#7C3AED] rounded-full animate-spin" />
          <p style={FF} className="text-[#001161]/60 text-[15px]">Ověřuji váš e-mail a připravuji přístup…</p>
        </div>
      </div>
    );
  }

  if (token && verified) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <SEOHead title={PAGE_TITLE} path="/studenti" description={PAGE_DESC} noIndex />
        <div className="w-full max-w-[560px]">
          {verified.alreadyVerified && (
            <p style={FF} className="text-center text-[13px] text-[#001161]/50 mb-3">Tenhle odkaz jste už použili — tady jsou vaše údaje.</p>
          )}
          <AccessCard student={verified.student} codesPending={verified.codesPending} />
        </div>
      </motion.div>
    );
  }

  if (token && verifyError) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <SEOHead title={PAGE_TITLE} path="/studenti" description={PAGE_DESC} noIndex />
        <div className="w-full max-w-[440px] text-center">
          <div className="bg-red-50 border border-red-200 rounded-[24px] p-8">
            <p style={FF} className="text-red-600 text-[16px] font-bold mb-2">Odkaz nefunguje</p>
            <p style={FF} className="text-[#001161]/60 text-[14px] mb-6">{verifyError}</p>
            <Link to="/studenti" style={FF} className="text-[#7C3AED] font-bold text-[14px] underline hover:opacity-75">Zaregistrovat se znovu</Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="px-4 pb-20">
      <SEOHead
        title={PAGE_TITLE}
        path="/studenti"
        description={PAGE_DESC}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Offer',
          name: 'Vividbooks pro studenty učitelství',
          price: '0',
          priceCurrency: 'CZK',
          eligibleCustomerType: 'Student',
          description: PAGE_DESC,
          url: 'https://www.vividbooks.com/studenti',
        }}
      />

      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-[1040px] mx-auto pt-12 md:pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#E8942A]/10 text-[#B45309] px-4 py-1.5 mb-6" style={FF}>
          <GraduationCap className="w-4 h-4" />
          <span className="text-[12px] font-bold uppercase tracking-wide">Pro studenty učitelství</span>
        </div>
        <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[34px] md:text-[52px] leading-[1.1] mb-5 max-w-[820px] mx-auto">
          Vividbooks zdarma po celou dobu studia.
        </h1>
        <p style={FF} className="text-[#001161]/65 text-[16px] md:text-[18px] leading-relaxed max-w-[640px] mx-auto mb-8">
          Připravujete se na učení? Mějte v ruce pracovní sešity a učební materiály, se kterými učí přes 600 základních škol. Stačí univerzitní e-mail — přístup máte do minuty.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button type="button" onClick={scrollToForm} className="inline-flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg shadow-[#7C3AED]/25 cursor-pointer" style={FF}>
            Získat přístup zdarma <ArrowRight className="w-4 h-4" />
          </button>
          <Link to="/aplikace" className="inline-flex items-center gap-2 text-[#001161] font-bold text-[15px] px-6 py-4 rounded-full border border-[#001161]/12 hover:bg-white transition-all no-underline" style={FF}>
            Co je v aplikaci
          </Link>
        </div>
        <p style={FF} className="text-[12px] text-[#001161]/45 mt-5">Bez karty · bez závazku · platí i půl roku po státnicích</p>
      </motion.section>

      {/* Benefity */}
      <section className="max-w-[1040px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
        {BENEFITS.map((b) => (
          <div key={b.title} className="bg-white border border-[#001161]/8 rounded-[24px] p-6 flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
              <b.icon className="w-6 h-6 text-[#7C3AED]" />
            </div>
            <div>
              <h3 style={FF} className="text-[16px] font-bold text-[#001161] mb-1">{b.title}</h3>
              <p style={FF} className="text-[14px] text-[#001161]/65 leading-relaxed">{b.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Jak to funguje + formulář */}
      <section ref={formRef} className="max-w-[1040px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-8 items-start mb-16 scroll-mt-24">
        <div>
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[34px] leading-tight mb-6">Tři kroky a učíte.</h2>
          <div className="space-y-5">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="w-9 h-9 rounded-full bg-[#001161] text-white text-[14px] font-bold flex items-center justify-center shrink-0" style={FF}>{s.n}</span>
                <div>
                  <p style={FF} className="text-[16px] font-bold text-[#001161]">{s.title}</p>
                  <p style={FF} className="text-[14px] text-[#001161]/65 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-[#001161] text-white rounded-[24px] p-6">
            <div className="flex items-center gap-2 mb-2">
              <School className="w-5 h-5 text-[#E8942A]" />
              <p style={FF} className="text-[15px] font-bold">Pro fakulty a katedry</p>
            </div>
            <p style={FF} className="text-[14px] text-white/75 leading-relaxed mb-3">
              Chcete Vividbooks pro celý ročník nebo didaktický seminář? Pošleme vzorky tištěných pracovních sešitů zdarma a přijedeme udělat workshop pro studenty.
            </p>
            <a href="mailto:vitek@vividbooks.com?subject=Vividbooks%20pro%20studenty%20u%C4%8Ditelstv%C3%AD" className="inline-flex items-center gap-2 text-[#E8942A] font-bold text-[14px] hover:underline" style={FF}>
              <Mail className="w-4 h-4" /> vitek@vividbooks.com
            </a>
          </div>
        </div>
        <div className="bg-[#f5f6fa] border border-[#001161]/6 rounded-[28px] p-6 md:p-8">
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[24px] leading-tight mb-1">Založit studentský přístup</h2>
          <p style={FF} className="text-[13px] text-[#001161]/55 mb-6">Trvá to dvě minuty. Hvězdička = povinné.</p>
          <StudentRegistrationForm presetFacultyId={presetFaculty} />
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[760px] mx-auto">
        <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] leading-tight mb-6 text-center">Časté otázky</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
        <p style={FF} className="text-center text-[13px] text-[#001161]/50 mt-8">
          Máte jinou otázku? Napište na <a href="mailto:hello@vividbooks.com" className="underline">hello@vividbooks.com</a> nebo zavolejte <Link to="/kontakt" className="underline">našemu týmu</Link>.
        </p>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════
   /studenti/aktualizace?t=… — self-service
══════════════════════════════════════════ */
export function StudentProgramUpdatePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || '';
  const [student, setStudent] = useState<StudentProgramStudentView | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [loadError, setLoadError] = useState('');
  const [studyStatus, setStudyStatus] = useState<'studying' | 'graduated' | 'ended' | ''>('');
  const [graduation, setGraduation] = useState('');
  const [uses, setUses] = useState<'yes' | 'no' | 'sometimes' | ''>('');
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [employerStatus, setEmployerStatus] = useState<'teaching' | 'not_teaching' | 'studying_further' | ''>('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<Array<{ ico: string; name: string; address: string; kraj: string }>>([]);
  const [schoolSearching, setSchoolSearching] = useState(false);
  const [school, setSchool] = useState<{ name: string; ico: string } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const gradOptions = useMemo(graduationOptions, []);
  const debouncedSchool = useDebounced(schoolQuery.trim(), 400);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchStudentSelf(token)
      .then((s) => {
        if (cancelled) return;
        setStudent(s);
        setPhone(s.phone || '');
        setPersonalEmail(s.personalEmail || '');
        setNewsletter(s.newsletter);
        if (s.expectedGraduation) setGraduation(s.expectedGraduation.slice(0, 7));
        if (s.employerSchoolName) setSchool({ name: s.employerSchoolName, ico: s.employerSchoolIco || '' });
        if (s.status === 'alumni') setStudyStatus('graduated');
        if (s.employerStatus !== 'unknown') setEmployerStatus(s.employerStatus);
        if (s.usesInPractice === true) setUses('yes');
        if (s.usesInPractice === false) setUses('no');
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Odkaz je neplatný.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (debouncedSchool.length < 3 || school) {
      setSchoolResults([]);
      return;
    }
    let cancelled = false;
    setSchoolSearching(true);
    searchSchoolsRegistry(debouncedSchool)
      .then((r) => {
        if (!cancelled) setSchoolResults(r.slice(0, 8));
      })
      .finally(() => {
        if (!cancelled) setSchoolSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSchool, school]);

  const submit = useCallback(async () => {
    if (!student || saving) return;
    if (!studyStatus) {
      setError('Vyberte prosím, jak na tom se studiem jste.');
      return;
    }
    if (studyStatus === 'studying' && !graduation) {
      setError('Doplňte prosím předpokládaný konec studia.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const s = await updateStudentSelf(token, {
        studyStatus,
        expectedGraduation: graduation || undefined,
        usesInPractice: uses === 'yes' || uses === 'sometimes' ? true : uses === 'no' ? false : null,
        phone,
        personalEmail,
        employerStatus: studyStatus === 'graduated' ? employerStatus : '',
        employerSchoolName: studyStatus === 'graduated' && employerStatus === 'teaching' ? school?.name || schoolQuery.trim() : '',
        employerSchoolIco: studyStatus === 'graduated' && employerStatus === 'teaching' ? school?.ico || '' : '',
        feedback,
        newsletter,
      });
      setStudent(s);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení se nepodařilo.');
    } finally {
      setSaving(false);
    }
  }, [student, saving, studyStatus, graduation, uses, phone, personalEmail, employerStatus, school, schoolQuery, feedback, newsletter, token]);

  const head = <SEOHead title="Moje studium — Vividbooks" path="/studenti/aktualizace" description="Aktualizace studentského přístupu Vividbooks." noIndex />;

  if (!token || loadError) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        {head}
        <div className="w-full max-w-[440px] text-center bg-red-50 border border-red-200 rounded-[24px] p-8">
          <p style={FF} className="text-red-600 text-[16px] font-bold mb-2">Odkaz nefunguje</p>
          <p style={FF} className="text-[#001161]/60 text-[14px] mb-6">{loadError || 'V adrese chybí ověřovací token. Použijte odkaz z e-mailu od Vividbooks.'}</p>
          <Link to="/studenti" style={FF} className="text-[#7C3AED] font-bold text-[14px] underline hover:opacity-75">Zpět na studentský program</Link>
        </div>
      </div>
    );
  }

  if (loading || !student) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        {head}
        <div className="w-10 h-10 border-3 border-[#7C3AED]/20 border-t-[#7C3AED] rounded-full animate-spin" />
      </div>
    );
  }

  if (saved) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        {head}
        <div className="w-full max-w-[560px] space-y-4">
          <div className="bg-[#F0FDF4] border border-green-200 rounded-[24px] p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[24px] mb-1">Děkujeme!</h2>
            <p style={FF} className="text-[#001161]/70 text-[14px]">
              {student.status === 'alumni'
                ? 'Gratulujeme k dokončení studia. Přístup vám zůstává ještě půl roku — a když jste uvedli školu, ozveme se jí s ukázkou.'
                : student.status === 'declined'
                  ? 'Rozumíme. Přístup ukončíme a už vám nebudeme psát. Kdykoli se můžete vrátit.'
                  : 'Máme to zapsané. Přístup běží dál a napíšeme si zase za půl roku.'}
            </p>
          </div>
          {student.status !== 'declined' && <AccessCard student={student} />}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="min-h-[70vh] flex items-start justify-center px-4 py-12">
      {head}
      <div className="w-full max-w-[600px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#7C3AED]/10 mb-4">
            <GraduationCap className="w-7 h-7 text-[#7C3AED]" />
          </div>
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] md:text-[34px] leading-tight mb-2">
            {student.firstName ? `${student.firstName}, jak se vám daří?` : 'Jak se vám daří?'}
          </h1>
          <p style={FF} className="text-[#001161]/60 text-[15px]">
            {student.faculty ? `${student.faculty.faculty} ${student.faculty.universityShort} · ` : ''}
            přístup do {fmtDate(student.accessValidUntil) || '—'}
          </p>
        </div>

        <div className="bg-[#f5f6fa] border border-[#001161]/6 rounded-[28px] p-6 md:p-8 space-y-6">
          <div>
            <p style={FF} className="text-[14px] font-bold text-[#001161] mb-3">Jak jste na tom se studiem? *</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <SubjectCheckbox label="Ještě studuji" checked={studyStatus === 'studying'} onChange={() => setStudyStatus('studying')} />
              <SubjectCheckbox label="Dostudoval/a jsem" checked={studyStatus === 'graduated'} onChange={() => setStudyStatus('graduated')} />
              <SubjectCheckbox label="Studium jsem ukončil/a" checked={studyStatus === 'ended'} onChange={() => setStudyStatus('ended')} />
            </div>
          </div>

          <AnimatePresence>
            {studyStatus === 'studying' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <p style={FF} className="text-[14px] font-bold text-[#001161] mb-2">Předpokládaný konec studia *</p>
                <select value={graduation} onChange={(e) => setGraduation(e.target.value)} className={`${INPUT_CLASS} ${SELECT_ARROW}`} style={FF}>
                  <option value="" disabled>Vyberte měsíc</option>
                  {gradOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </motion.div>
            )}
            {studyStatus === 'graduated' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">
                <div>
                  <p style={FF} className="text-[14px] font-bold text-[#001161] mb-2">Co teď děláte?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <SubjectCheckbox label="Učím ve škole" checked={employerStatus === 'teaching'} onChange={() => setEmployerStatus('teaching')} />
                    <SubjectCheckbox label="Studuji dál" checked={employerStatus === 'studying_further'} onChange={() => setEmployerStatus('studying_further')} />
                    <SubjectCheckbox label="Neučím" checked={employerStatus === 'not_teaching'} onChange={() => setEmployerStatus('not_teaching')} />
                  </div>
                </div>
                {employerStatus === 'teaching' && (
                  <div>
                    <p style={FF} className="text-[14px] font-bold text-[#001161] mb-2">Ve které škole?</p>
                    {school ? (
                      <div className="flex items-center justify-between gap-3 bg-white border border-green-300 rounded-xl px-4 py-3">
                        <div>
                          <p style={FF} className="text-[14px] font-bold text-[#001161]">{school.name}</p>
                          {school.ico && <p style={FF} className="text-[12px] text-[#001161]/50">IČO {school.ico}</p>}
                        </div>
                        <button type="button" onClick={() => { setSchool(null); setSchoolQuery(''); }} style={FF} className="text-[12px] text-[#7C3AED] font-bold underline cursor-pointer">Změnit</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#001161]/35 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input value={schoolQuery} onChange={(e) => setSchoolQuery(e.target.value)} placeholder="Název školy nebo obec" className={`${INPUT_CLASS} pl-11`} style={FF} />
                        {schoolSearching && <Loader2 className="w-4 h-4 text-[#001161]/35 absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />}
                        {schoolResults.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#001161]/10 rounded-xl shadow-lg overflow-hidden">
                            {schoolResults.map((r) => (
                              <button key={`${r.ico}-${r.name}`} type="button" onClick={() => { setSchool({ name: r.name, ico: r.ico }); setSchoolResults([]); }} className="w-full text-left px-4 py-2.5 hover:bg-[#7C3AED]/5 cursor-pointer border-b border-[#001161]/5 last:border-0">
                                <p style={FF} className="text-[13px] font-bold text-[#001161]">{r.name}</p>
                                <p style={FF} className="text-[11px] text-[#001161]/50">{r.address}{r.kraj ? ` · ${r.kraj}` : ''}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p style={FF} className="text-[12px] text-[#001161]/50 mt-2">Vaší škole rádi ukážeme Vividbooks a připravíme nezávaznou kalkulaci — nic se neděje bez vašeho souhlasu.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {studyStatus !== 'ended' && (
            <div>
              <p style={FF} className="text-[14px] font-bold text-[#001161] mb-3">Používáte Vividbooks?</p>
              <div className="grid grid-cols-3 gap-2">
                <SubjectCheckbox label="Pravidelně" checked={uses === 'yes'} onChange={() => setUses('yes')} />
                <SubjectCheckbox label="Občas" checked={uses === 'sometimes'} onChange={() => setUses('sometimes')} />
                <SubjectCheckbox label="Zatím ne" checked={uses === 'no'} onChange={() => setUses('no')} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p style={FF} className="text-[13px] font-bold text-[#001161] mb-1.5 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Telefon</p>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+420 …" className={INPUT_CLASS} style={FF} inputMode="tel" />
            </div>
            <div>
              <p style={FF} className="text-[13px] font-bold text-[#001161] mb-1.5 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Osobní e-mail</p>
              <input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="Pro dobu po škole" className={INPUT_CLASS} style={FF} inputMode="email" />
            </div>
          </div>

          <div>
            <p style={FF} className="text-[13px] font-bold text-[#001161] mb-1.5">Co vám ve Vividbooks chybí nebo naopak pomohlo?</p>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Nepovinné — ale každý vzkaz čteme." className={`${INPUT_CLASS} resize-none`} style={FF} />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-1 w-4 h-4 accent-[#7C3AED]" />
            <span style={FF} className="text-[13px] text-[#001161]/70 leading-snug">Chci pozvánky na webináře a workshopy pro budoucí učitele.</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p style={FF} className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          <button type="button" onClick={() => void submit()} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-6 py-4 font-bold text-[16px] text-white shadow-lg shadow-[#7C3AED]/25 transition-all hover:bg-[#6D28D9] disabled:opacity-60 cursor-pointer" style={FF}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>

        {student.teacherCode && (
          <div className="mt-6 bg-white border border-[#001161]/8 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div style={FF} className="text-[13px] text-[#001161]/60">
              Vaše kódy: <span className="font-mono font-bold text-[#001161]">{student.teacherCode}</span> (učitel) · <span className="font-mono font-bold text-[#001161]">{student.studentCode}</span> (žák)
            </div>
            <Link to={APP_ENTRY_PATH} target="_blank" rel="noopener noreferrer" style={FF} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#7C3AED] no-underline hover:underline">
              Otevřít aplikaci <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
