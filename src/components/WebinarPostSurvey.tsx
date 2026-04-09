import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ClipboardList, Loader2 } from 'lucide-react';
import type { PostWebinarQuizQuestion, Webinar, WebinarSurveyQuestion } from '../data/webinars';
import {
  getMergedWebinarSurveyQuestions,
  getPostWebinarPart2AnswerIds,
  getPostWebinarPart2Steps,
  getPreWebinarSurveyQuestions,
  webinarPostWebinarQuizAsSurveyQuestions,
} from '../utils/webinarSurveyDefaults';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { WebinarDvppCertificateSuccess } from './WebinarDvppCertificateSuccess';
import { WebinarDvppQuizPlayer } from './WebinarDvppQuizPlayer';
import { WebinarPostSurveyPart2Player } from './WebinarPostSurveyPart2Player';
import { SurveyFlowProgressBar } from './SurveyFlowProgressBar';
import { saveWebinarSurveyPartialAnswer } from '../utils/webinarSurveyPartialSave';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

function isRestQuestionAnswered(q: WebinarSurveyQuestion, answers: Record<string, string>): boolean {
  const v = (answers[q.id] || '').trim();
  if (q.type === 'open') return v.length > 0;
  if (q.type === 'abc') return v.length > 0;
  if (q.type === 'yes_no') return v === 'yes' || v === 'no';
  return true;
}

/** Jen lokální `npm run dev` — přeskočení na konec (certifikát) bez vyplňování. */
function DevPostSurveySkipBar({
  onSkip,
  active,
}: {
  onSkip: () => void;
  active: boolean;
}) {
  if (!import.meta.env.DEV || !active) return null;
  return (
    <div
      className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[200] flex flex-wrap items-center justify-center gap-2 border-t border-amber-400/80 bg-amber-50/95 px-3 py-2 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-900">DEV</span>
      <button
        type="button"
        onClick={onSkip}
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-amber-700"
      >
        {'P\u0159esko\u010dit na certifik\u00e1t'}
      </button>
    </div>
  );
}

function parseJsonResponseBody(text: string): unknown {
  const strippedBom = text.replace(/\uFEFF/g, '').trim();
  if (!strippedBom) return null;
  try {
    return JSON.parse(strippedBom);
  } catch {
    let candidate = strippedBom;
    for (let s = 0; s < 8; s++) {
      const m = candidate.match(/^(true|false|null)\b\s*(?:,\s*)?/i);
      if (!m) break;
      candidate = candidate.slice(m[0].length).trim();
    }
    return JSON.parse(candidate);
  }
}

export function WebinarPostSurvey({
  webinar,
  email,
  onAnswersChange,
  variant = 'default',
  scope = 'post',
  participantName = '',
  participantBirthDateIso = '',
  participantSchoolName = '',
  participantSchoolIco = '',
}: {
  webinar: Webinar;
  email: string;
  /** Aktuální odpovědi — pro rodiče (např. zobrazení trial jen při „Nepoužívám“). */
  onAnswersChange?: (answers: Record<string, string>) => void;
  /** `pre` = jen otázky před webinářem (bez DVPP). `post` = DVPP + dotazník po akci. */
  scope?: 'pre' | 'post';
  /** Celostránkový režim (`?dvppDotaznik=1`): bez horního okraje, kvíz vyplní šířku/výšku. */
  variant?: 'default' | 'fullscreen';
  /** Jméno z registrace — do potvrzení / certifikátu po odeslání. */
  participantName?: string;
  /** Datum narození (YYYY-MM-DD) z brány DVPP — předvyplní certifikát. */
  participantBirthDateIso?: string;
  participantSchoolName?: string;
  participantSchoolIco?: string;
}) {
  const fs = variant === 'fullscreen';
  const mergedQuestions = useMemo(
    () =>
      scope === 'pre'
        ? getPreWebinarSurveyQuestions(webinar)
        : getMergedWebinarSurveyQuestions(webinar),
    [webinar, scope],
  );
  const dvppIds = useMemo(
    () =>
      scope === 'pre'
        ? new Set<string>()
        : new Set(webinarPostWebinarQuizAsSurveyQuestions(webinar).map((q) => q.id)),
    [webinar, scope],
  );
  const part2AnswerIds = useMemo(
    () => (scope === 'post' ? getPostWebinarPart2AnswerIds(webinar) : new Set<string>()),
    [webinar, scope],
  );

  const part2Steps = useMemo(
    () => (scope === 'post' ? getPostWebinarPart2Steps(webinar) : []),
    [webinar, scope],
  );

  const restQuestions = useMemo(
    () => mergedQuestions.filter((q) => !dvppIds.has(q.id) && !part2AnswerIds.has(q.id)),
    [mergedQuestions, dvppIds, part2AnswerIds],
  );

  const dvppRaw = useMemo((): PostWebinarQuizQuestion[] => {
    if (scope === 'pre') return [];
    const raw = webinar.postWebinarQuizQuestions;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (q): q is PostWebinarQuizQuestion =>
        !!q &&
        q.type === 'abc' &&
        typeof q.label === 'string' &&
        q.label.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length >= 2,
    );
  }, [webinar, scope]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  /** Po dokončení průvodce DVPP se zobrazí zbytek dotazníku (otevřené otázky). */
  const [dvppPhaseDone, setDvppPhaseDone] = useState(false);
  /** Po druhé části (slide zpětná vazba) formulář se zbylými otázkami z CMS / výchozími. */
  const [part2PhaseDone, setPart2PhaseDone] = useState(false);
  const [dvppNavStep, setDvppNavStep] = useState(-1);
  const [part2NavStep, setPart2NavStep] = useState(0);
  const [restPartialSavingId, setRestPartialSavingId] = useState<string | null>(null);
  const [restPartialFlashId, setRestPartialFlashId] = useState<string | null>(null);
  const [restPartialErr, setRestPartialErr] = useState('');

  const restQuestionsComplete = useMemo(
    () => restQuestions.every((q) => isRestQuestionAnswered(q, answers)),
    [restQuestions, answers],
  );

  useEffect(() => {
    onAnswersChange?.(answers);
  }, [answers, onAnswersChange]);

  const autoSubmitEmptyRestRef = useRef(false);

  useEffect(() => {
    setDvppNavStep(-1);
    setPart2NavStep(0);
    autoSubmitEmptyRestRef.current = false;
  }, [webinar.id]);

  const postFlow = scope === 'post';
  const dvppSeg = postFlow && dvppRaw.length > 0 ? 1 + dvppRaw.length : 0;
  const part2Seg = postFlow ? part2Steps.length : 0;
  const restSeg = postFlow ? 1 : 0;
  const certSeg = postFlow ? 1 : 0;
  const totalProgressSegments = postFlow ? dvppSeg + part2Seg + restSeg + certSeg : 0;

  const showDvppWizard = dvppRaw.length > 0 && !dvppPhaseDone;
  const showPart2Wizard =
    scope === 'post' &&
    part2Steps.length > 0 &&
    !part2PhaseDone &&
    (dvppRaw.length === 0 || dvppPhaseDone);

  const globalSegmentIndex = useMemo(() => {
    if (!postFlow || totalProgressSegments === 0) return 0;
    if (done) return totalProgressSegments;
    if (showDvppWizard) {
      if (dvppNavStep < 0) return 0;
      return Math.min(1 + dvppNavStep, dvppSeg);
    }
    if (showPart2Wizard) {
      return Math.min(dvppSeg + part2NavStep, dvppSeg + part2Seg);
    }
    return dvppSeg + part2Seg;
  }, [
    postFlow,
    totalProgressSegments,
    done,
    showDvppWizard,
    showPart2Wizard,
    dvppNavStep,
    part2NavStep,
    dvppSeg,
    part2Seg,
  ]);

  const progressFilled = useMemo(() => {
    if (!postFlow || totalProgressSegments === 0) return 0;
    if (done) return totalProgressSegments;
    let filled = globalSegmentIndex;
    if (!showDvppWizard && !showPart2Wizard && filled === 0 && totalProgressSegments > 0) {
      filled = 1;
    }
    return Math.min(filled, totalProgressSegments);
  }, [
    postFlow,
    totalProgressSegments,
    done,
    globalSegmentIndex,
    showDvppWizard,
    showPart2Wizard,
  ]);

  const devSkipToCertificate = useCallback(() => {
    setDvppPhaseDone(true);
    setPart2PhaseDone(true);
    setDone(true);
  }, []);

  const submit = useCallback(async () => {
    if (restQuestions.length > 0 && !restQuestionsComplete) {
      setError('Vyplňte prosím všechny otázky v této části.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${SERVER}/webinar-survey-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          webinarId: String(webinar.id ?? '').trim(),
          email: email.trim(),
          answers,
        }),
      });
      const rawText = await res.text();
      let data: { error?: string; success?: boolean } = {};
      try {
        data = (parseJsonResponseBody(rawText) || {}) as typeof data;
      } catch {
        const trimmed = rawText.trim();
        const plain404 =
          res.status === 404 &&
          (trimmed === '404 Not Found' || trimmed === 'Not Found' || /^404\b/i.test(trimmed));
        throw new Error(
          plain404
            ? 'Dotazn\u00edk na serveru nenalezen \u2014 nasa\u010fte pros\u00edm edge funkci make-server-93a20b6f (webinar-survey-submit) nebo zkuste pozd\u011bji.'
            : !res.ok
              ? `Server (${res.status}): ${rawText.slice(0, 200)}`
              : 'Neplatn\u00e1 odpov\u011b\u0111 serveru',
        );
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setSubmitting(false);
    }
  }, [answers, email, webinar.id, restQuestions.length, restQuestionsComplete]);

  const savePartialAnswer = useCallback(
    async (questionId: string, value: string): Promise<void | { wrongAnswer?: boolean }> => {
      if (scope !== 'post') return;
      const r = await saveWebinarSurveyPartialAnswer({
        webinarId: String(webinar.id ?? '').trim(),
        email: email.trim(),
        questionId,
        value,
      });
      if (!r.ok) throw new Error(r.error || 'Chyba');
      return 'wrongAnswer' in r && r.wrongAnswer ? { wrongAnswer: true } : undefined;
    },
    [scope, webinar.id, email],
  );

  const saveRestQuestionPartial = useCallback(
    async (q: { id: string; type: string }) => {
      if (scope !== 'post') return;
      const raw = (answers[q.id] || '').trim();
      if (!raw) return;
      setRestPartialErr('');
      setRestPartialSavingId(q.id);
      try {
        const r = await saveWebinarSurveyPartialAnswer({
          webinarId: String(webinar.id ?? '').trim(),
          email: email.trim(),
          questionId: q.id,
          value: raw,
        });
        if (!r.ok) throw new Error(r.error || 'Chyba');
        setRestPartialFlashId(q.id);
        window.setTimeout(() => {
          setRestPartialFlashId((cur) => (cur === q.id ? null : cur));
        }, 2200);
      } catch (e) {
        setRestPartialErr(e instanceof Error ? e.message : 'Chyba');
      } finally {
        setRestPartialSavingId(null);
      }
    },
    [scope, webinar.id, email, answers],
  );

  useEffect(() => {
    if (scope !== 'post') return;
    if (done || skipped) return;
    if (mergedQuestions.length === 0) return;
    if (showDvppWizard || showPart2Wizard) return;
    if (restQuestions.length > 0) return;
    if (submitting) return;
    if (autoSubmitEmptyRestRef.current) return;
    autoSubmitEmptyRestRef.current = true;
    void submit();
  }, [
    scope,
    done,
    skipped,
    mergedQuestions.length,
    showDvppWizard,
    showPart2Wizard,
    restQuestions.length,
    submitting,
    submit,
  ]);

  if (done) {
    if (scope === 'post') {
      return (
        <div
          className={
            fs ? 'flex min-h-0 w-full flex-1 flex-col overflow-y-auto' : 'w-full'
          }
        >
          {totalProgressSegments > 0 ? (
            <div
              className={
                fs
                  ? 'shrink-0 px-4 pt-4 sm:px-6'
                  : 'mb-4 flex justify-center px-2'
              }
            >
              <SurveyFlowProgressBar total={totalProgressSegments} filled={totalProgressSegments} />
            </div>
          ) : null}
          <WebinarDvppCertificateSuccess
            webinar={webinar}
            email={email}
            participantName={participantName}
            participantBirthDateIso={participantBirthDateIso}
            participantSchoolName={participantSchoolName}
            participantSchoolIco={participantSchoolIco}
            variant={fs ? 'fullscreen' : 'default'}
            certificateKind={dvppRaw.length > 0 ? 'dvpp' : 'feedback'}
          />
        </div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          fs
            ? 'flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center'
            : 'w-full mt-6 border-t border-[#001161]/10 pt-6 text-left'
        }
      >
        <p style={FF} className="text-[13px] text-[#001161]/70">
          {'D\u011bkujeme za odpov\u011bdi \u2014 pom\u016fh\u00e1 n\u00e1m to p\u0159ipravit obsah.'}
        </p>
      </motion.div>
    );
  }

  if (mergedQuestions.length === 0 || skipped) return null;

  if (showDvppWizard) {
    return (
      <motion.div
        id="webinar-dotaznik"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          fs
            ? 'flex min-h-0 w-full flex-1 flex-col overflow-y-auto'
            : 'mt-6 w-full border-t border-[#001161]/10 pt-6 text-left'
        }
      >
        <WebinarDvppQuizPlayer
          key={webinar.id}
          variant={fs ? 'fullscreen' : 'default'}
          webinarTitle={webinar.title}
          questions={dvppRaw}
          answers={answers}
          onAnswerChange={(id, opt) => setAnswers((a) => ({ ...a, [id]: opt }))}
          onComplete={() => setDvppPhaseDone(true)}
          flowProgressTotal={totalProgressSegments}
          flowProgressFilled={progressFilled}
          onStepChange={setDvppNavStep}
          onSavePartialAnswer={scope === 'post' ? savePartialAnswer : undefined}
        />
        {!fs ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setSkipped(true)}
              className="text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70"
              style={FF}
            >
              {'P\u0159esko\u010dit cel\u00fd dotazn\u00edk'}
            </button>
          </div>
        ) : null}
        <DevPostSurveySkipBar onSkip={devSkipToCertificate} active={postFlow} />
      </motion.div>
    );
  }

  if (showPart2Wizard) {
    return (
      <motion.div
        id="webinar-dotaznik"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          fs
            ? 'flex min-h-0 w-full flex-1 flex-col overflow-y-auto'
            : 'mt-6 w-full border-t border-[#001161]/10 pt-6 text-left'
        }
      >
        <WebinarPostSurveyPart2Player
          variant={fs ? 'fullscreen' : 'default'}
          steps={part2Steps}
          answers={answers}
          onAnswerChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
          onComplete={() => setPart2PhaseDone(true)}
          flowProgressTotal={totalProgressSegments}
          flowProgressFilled={progressFilled}
          onStepChange={setPart2NavStep}
          onSavePartialAnswer={scope === 'post' ? savePartialAnswer : undefined}
        />
        {!fs ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setSkipped(true)}
              className="text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70"
              style={FF}
            >
              {'P\u0159esko\u010dit cel\u00fd dotazn\u00edk'}
            </button>
          </div>
        ) : null}
        <DevPostSurveySkipBar onSkip={devSkipToCertificate} active={postFlow} />
      </motion.div>
    );
  }

  const emptyRestPostFinal =
    scope === 'post' &&
    restQuestions.length === 0 &&
    !showDvppWizard &&
    !showPart2Wizard;

  if (emptyRestPostFinal) {
    return (
      <motion.div
        id="webinar-dotaznik"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          fs
            ? 'flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-8 md:px-12'
            : 'mt-6 w-full border-t border-[#001161]/10 pt-6 text-left'
        }
      >
        {totalProgressSegments > 0 ? (
          <div
            className={fs ? 'mx-auto mb-4 w-full max-w-[min(1120px,100%)] shrink-0' : 'mb-4 flex justify-center'}
          >
            <SurveyFlowProgressBar total={totalProgressSegments} filled={progressFilled} />
          </div>
        ) : null}
        <div className={fs ? 'mx-auto flex w-full max-w-[min(720px,100%)] flex-col items-center' : 'flex flex-col items-center'}>
          {error ? (
            <>
              <p style={FF} className="mb-3 text-[13px] text-red-600">
                {error}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={FF}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {'Odeslat odpov\u011bdi'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setSkipped(true)}
                  className="text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70"
                  style={FF}
                >
                  {'P\u0159esko\u010dit'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-center py-10" aria-busy="true" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-[#001161]" />
            </div>
          )}
        </div>
        <DevPostSurveySkipBar onSkip={devSkipToCertificate} active={postFlow} />
      </motion.div>
    );
  }

  return (
    <motion.div
      id="webinar-dotaznik"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        fs
          ? 'flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-8 md:px-12'
          : 'mt-6 w-full border-t border-[#001161]/10 pt-6 text-left'
      }
    >
      {totalProgressSegments > 0 ? (
        <div className={fs ? 'mx-auto mb-4 w-full max-w-[min(1120px,100%)] shrink-0' : 'mb-4 flex justify-center'}>
          <SurveyFlowProgressBar total={totalProgressSegments} filled={progressFilled} />
        </div>
      ) : null}
      <div className={fs ? 'mx-auto w-full max-w-[min(720px,100%)]' : undefined}>
      {restQuestions.length > 0 && (
        <>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#001161]/8">
              <ClipboardList className="h-5 w-5 text-[#001161]" />
            </div>
            <div>
              <h3 style={FF} className="text-[16px] font-bold text-[#001161] leading-snug">
                {'Pomozte n\u00e1m porozum\u011bt, kdo p\u0159ich\u00e1z\u00ed na webin\u00e1\u0159'}
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            {restQuestions.map((q) => (
              <div key={q.id}>
                <label style={FF} className="block text-[13px] font-semibold text-[#001161] mb-1.5">
                  {q.label}
                </label>
                {q.type === 'open' && (
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-[#001161]/12 bg-white px-3 py-2.5 text-[14px] text-[#001161] outline-none focus:border-[#5B4FD8] focus:ring-2 focus:ring-[#5B4FD8]/15"
                    style={FF}
                  />
                )}
                {q.type === 'abc' && q.options && q.options.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#001161]/10 bg-white px-3 py-2 text-[14px] text-[#001161] hover:bg-[#F0F2F8]"
                        style={FF}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                          className="accent-[#001161]"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'yes_no' && (
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { v: 'yes', l: 'Ano' },
                        { v: 'no', l: 'Ne' },
                      ] as const
                    ).map(({ v, l }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                        className={`rounded-xl px-4 py-2 text-[14px] font-bold transition-all ${
                          answers[q.id] === v
                            ? 'bg-[#001161] text-white shadow-md'
                            : 'bg-[#F0F2F8] text-[#001161] hover:bg-[#e4e8f4]'
                        }`}
                        style={FF}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                {scope === 'post' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        restPartialSavingId === q.id ||
                        !(
                          (q.type === 'open' && (answers[q.id] || '').trim()) ||
                          (q.type === 'abc' &&
                            q.options &&
                            q.options.length > 0 &&
                            !!(answers[q.id] || '').trim()) ||
                          (q.type === 'yes_no' &&
                            (answers[q.id] === 'yes' || answers[q.id] === 'no'))
                        )
                      }
                      onClick={() => void saveRestQuestionPartial(q)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2 text-[13px] font-bold text-white shadow-md shadow-[#001161]/20 transition hover:bg-[#001a8c] disabled:opacity-45"
                      style={FF}
                    >
                      {restPartialSavingId === q.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {'Odpov\u011bd\u011bt'}
                    </button>
                    {restPartialFlashId === q.id ? (
                      <span
                        style={FF}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        {'Ulo\u017eeno'}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {scope === 'post' && restPartialErr ? (
            <p style={FF} className="mt-2 text-[13px] text-red-600">
              {restPartialErr}
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p style={FF} className="mt-3 text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={submitting || (restQuestions.length > 0 && !restQuestionsComplete)}
          onClick={submit}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition-all hover:scale-[1.02] disabled:opacity-50"
          style={FF}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {'Odeslat odpov\u011bdi'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => setSkipped(true)}
          className="text-[13px] font-semibold text-[#001161]/40 hover:text-[#001161]/70"
          style={FF}
        >
          {'P\u0159esko\u010dit'}
        </button>
      </div>
      <DevPostSurveySkipBar onSkip={devSkipToCertificate} active={postFlow} />
      </div>
    </motion.div>
  );
}
