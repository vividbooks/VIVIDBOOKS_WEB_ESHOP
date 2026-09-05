/**
 * /kviz — „Jaký jste učitel?“ 8 obrazovek, 40 sekund. Výsledek = typ učitele + profil pro doporučení.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { dvppApi } from '../../utils/dvppApi';
import { DvppButton, DvppCard, DvppShell, ProgressBar } from './DvppShell';
import { useDvppSession } from './DvppSession';
import { SchoolPicker } from './SchoolPicker';

type Q = { key: string; title: string; hint?: string; multi?: boolean; options: Array<{ value: string; label: string }>; school?: boolean };

const QUESTIONS: Q[] = [
  { key: 'school', title: 'Kde učíte?', hint: 'Podle školy spočítáme milník sborovny.', options: [], school: true },
  { key: 'subjects', title: 'Co učíte?', multi: true, options: [
    { value: 'matematika', label: 'Matematiku' }, { value: 'fyzika', label: 'Fyziku' }, { value: 'chemie', label: 'Chemii' }, { value: 'prirodopis', label: 'Přírodopis' },
    { value: 'prvouka', label: 'Prvouku / 1. stupeň' }, { value: 'cesky-jazyk', label: 'Češtinu' }, { value: 'other', label: 'Něco jiného' },
  ] },
  { key: 'stages', title: 'Který stupeň?', multi: true, options: [{ value: '1', label: '1. stupeň' }, { value: '2', label: '2. stupeň' }] },
  { key: 'role', title: 'Jaká je vaše role?', options: [
    { value: 'ucitel', label: 'Učitel/ka' }, { value: 'reditel', label: 'Ředitel/ka' }, { value: 'zastupce', label: 'Zástupce' },
    { value: 'asistent', label: 'Asistent/ka pedagoga' }, { value: 'metodik', label: 'Metodik / koordinátor' }, { value: 'student', label: 'Student/ka učitelství' },
  ] },
  { key: 'dvpp_hours_need', title: 'Kolik hodin DVPP potřebujete letos doložit?', options: [
    { value: '0', label: 'Žádné, chci se jen učit' }, { value: 'do8', label: 'Do 8 hodin' }, { value: '8-16', label: '8 až 16 hodin' }, { value: 'vice', label: 'Víc než 16' },
  ] },
  { key: 'pain_point', title: 'Co vás teď ve výuce nejvíc pálí?', options: [
    { value: 'motivace', label: 'Motivace žáků' }, { value: 'diferenciace', label: 'Různě rychlé děti v jedné třídě' }, { value: 'ai', label: 'Jak na AI' },
    { value: 'svp', label: 'ŠVP a nové RVP' }, { value: 'hodnoceni', label: 'Hodnocení' }, { value: 'tabule', label: 'Interaktivní tabule a aplikace' },
  ] },
  { key: 'style', title: 'Ideální hodina podle vás?', options: [
    { value: 'objevovani', label: 'Děti objevují, já jen nasměruju' }, { value: 'procvicovani', label: 'Hodně procvičování, každý svým tempem' },
    { value: 'vyklad', label: 'Dobrý výklad s příběhem' }, { value: 'planovani', label: 'Promyšlený plán a jasná struktura' },
  ] },
  { key: 'decides', title: 'Kdo u vás rozhoduje o učebnicích a DVPP?', options: [
    { value: 'ja', label: 'Já sám/sama' }, { value: 'reditel', label: 'Ředitel/ka' }, { value: 'komise', label: 'Předmětová komise' }, { value: 'nevim', label: 'Nevím' },
  ] },
];

const TYPES: Record<string, { title: string; text: string }> = {
  badatel: { title: 'Badatel', text: 'Necháte děti přijít na věci samy. Vyberali jsme vám záznamy s pokusy, aktivitami a otázkami, které rozjedou hodinu.' },
  trener: { title: 'Trenér', text: 'Věříte, že dovednost dělá opakování. Doporučíme diferenciaci, procvičování a hodnocení, které nezabere večer.' },
  vypravec: { title: 'Vypravěč', text: 'Umíte děti vtáhnout. Doporučíme záznamy o motivaci, výkladu s příběhem a interaktivní tabuli.' },
  architekt: { title: 'Architekt', text: 'Máte rádi plán a strukturu. Doporučíme ŠVP, nové RVP, AI v přípravě a systém hodnocení.' },
};

export function DvppQuizPage() {
  const { me, loading, refresh } = useDvppSession();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next') || '/knihovna';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const questions = useMemo(() => (me?.school ? QUESTIONS.filter((q) => !q.school) : QUESTIONS), [me?.school]);
  const q = questions[step];

  const toggle = (value: string) => {
    if (!q) return;
    if (q.multi) {
      const cur = Array.isArray(answers[q.key]) ? (answers[q.key] as string[]) : [];
      setAnswers({ ...answers, [q.key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
    } else {
      setAnswers({ ...answers, [q.key]: value });
      window.setTimeout(() => setStep((s) => Math.min(s + 1, questions.length)), 180);
    }
  };

  const finish = async () => {
    setSaving(true); setError('');
    try {
      const role = String(answers.role || '');
      const position = role === 'reditel' ? 'Ředitel/ka školy' : role === 'zastupce' ? 'Zástupce ředitele' : role === 'student' ? 'Student/ka' : role === 'asistent' ? 'Asistent/ka pedagoga' : undefined;
      const r = await dvppApi.updateMe({ profile: answers, ...(position ? { position } : {}) });
      setResult(r.me.teacherType);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Nepodařilo se uložit.'); } finally { setSaving(false); }
  };

  const answered = q ? (q.school ? !!me?.school : q.multi ? (answers[q.key] as string[] | undefined)?.length : !!answers[q.key]) : true;

  return (
    <DvppShell title="Jaký jste učitel?" description="Osm otázek, čtyřicet sekund. Podle odpovědí vám vybereme záznamy do knihovny DVPP zdarma." path="/kviz">
      <div className="mx-auto max-w-[620px]">
        {!loading && !me ? (
          <DvppCard className="text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-[#F06632]" />
            <h1 className="mb-2 text-[24px] font-extrabold text-[#001161]">Nejdřív se přihlaste</h1>
            <p className="mb-4 text-[15px] text-[#3a4270]">Kvíz ukládáme k vašemu účtu, aby knihovna doporučovala správné záznamy.</p>
            <DvppButton to="/knihovna/prihlaseni?next=/kviz">Přihlásit se e-mailem</DvppButton>
          </DvppCard>
        ) : null}
        {me && result ? (
          <DvppCard className="text-center">
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#F06632]">Váš typ</p>
            <h1 className="mb-2 text-[32px] font-extrabold text-[#001161]">{TYPES[result]?.title || 'Učitel'}</h1>
            <p className="mb-5 text-[15px] text-[#3a4270]">{TYPES[result]?.text}</p>
            <DvppButton onClick={() => navigate(next)}>Otevřít doporučené záznamy</DvppButton>
          </DvppCard>
        ) : null}
        {me && !result && q ? (
          <DvppCard>
            <ProgressBar value={step + 1} max={questions.length} />
            <p className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-wide text-[#6b7398]">Otázka {step + 1} z {questions.length}</p>
            <h1 className="mb-1 text-[24px] font-extrabold leading-tight text-[#001161]">{q.title}</h1>
            {q.hint ? <p className="mb-4 text-[14px] text-[#6b7398]">{q.hint}</p> : <div className="mb-4" />}
            {q.school ? (
              <SchoolPicker onPicked={async () => { await refresh(); setStep((s) => s + 1); }} />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o) => {
                  const sel = q.multi ? ((answers[q.key] as string[] | undefined) || []).includes(o.value) : answers[q.key] === o.value;
                  return (
                    <button key={o.value} type="button" onClick={() => toggle(o.value)} className={`rounded-xl border px-4 py-3 text-left text-[15px] font-semibold transition ${sel ? 'border-[#001161] bg-[#001161] text-white' : 'border-[#001161]/15 bg-white text-[#001161] hover:bg-[#f0f2f8]'}`}>{o.label}</button>
                  );
                })}
              </div>
            )}
            <div className="mt-5 flex items-center justify-between">
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6b7398] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Zpět</button>
              {step < questions.length - 1 ? (
                <DvppButton variant="secondary" onClick={() => setStep((s) => s + 1)} disabled={!answered}>Dál <ChevronRight className="h-4 w-4" /></DvppButton>
              ) : (
                <DvppButton onClick={() => void finish()} disabled={!answered || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Ukázat výsledek</DvppButton>
              )}
            </div>
            {error ? <p className="mt-3 text-[13px] text-[#b3261e]">{error}</p> : null}
          </DvppCard>
        ) : null}
      </div>
    </DvppShell>
  );
}
