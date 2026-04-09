import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { PostWebinarQuizQuestion } from '../data/webinars';
import { SurveyFlowProgressBar } from './SurveyFlowProgressBar';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COOPER = { fontFamily: "'Cooper Light', serif" } as const;

/** Pozadí „plátna“ jako Vividboard (Web vividbooks + Vividbooks40 slide) */
const BG_STAGE = '#E8EBF4';
const NAVY = '#001161';
/** Text otázky — stejná šedá jako ABCSlideView ve Vividbooks40 */
const QUESTION_MUTED = '#4E5871';
const PURPLE = '#7C3AED';
const INTRO_FILL = '#C2DFFF';
/** Tlačítko „Odpovědět“ — plná výplň (bez gradientu), stejná námořní jako primární CTA na webu. */
const ANSWER_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-2.5 text-[14px] font-bold text-white shadow-md shadow-[#001161]/20 transition hover:bg-[#001a8c] disabled:opacity-50';

const WRONG_ANSWER_HINT =
  'Tato odpov\u011b\u010f nebyla spr\u00e1vn\u00e1. M\u016f\u017eete pokra\u010dovat d\u00e1l.';

type Props = {
  webinarTitle: string;
  questions: PostWebinarQuizQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, optionText: string) => void;
  onComplete: () => void;
  variant?: 'default' | 'fullscreen';
  /** Celkový počet segmentů v celém průvodci (DVPP + zpětná vazba + odeslání + certifikát). */
  flowProgressTotal?: number;
  /** Kolik segmentů je vyplněných v tomto celkovém průvodci. */
  flowProgressFilled?: number;
  /** Sledování kroku pro rodiče (globální progress). */
  onStepChange?: (step: number) => void;
  /** Uložení jedné odpovědi na server (částečný zápis) — po webináři. */
  onSavePartialAnswer?: (
    questionId: string,
    value: string,
  ) => Promise<void | { wrongAnswer?: boolean }>;
};

/**
 * Průvodce ve stylu Vividboard (viz Vividbooks40 `ABCSlideView`): bílá „stage“ karta,
 * otázka nahoře, mřížka 2×2 dole, postranní navigace.
 */
export function WebinarDvppQuizPlayer({
  webinarTitle,
  questions,
  answers,
  onAnswerChange,
  onComplete,
  variant = 'default',
  flowProgressTotal,
  flowProgressFilled,
  onStepChange,
  onSavePartialAnswer,
}: Props) {
  const fs = variant === 'fullscreen';
  const total = questions.length;
  const [partialSaving, setPartialSaving] = useState(false);
  const [partialErr, setPartialErr] = useState('');
  /** Zabrání dvojitému kliku na „Další“ před dokončením zápisu na server. */
  const [navBusy, setNavBusy] = useState(false);
  const navBusyRef = useRef(false);
  const partialAnswerLockRef = useRef(false);
  /** -1 = úvodní obrazovka, 0..total-1 = otázky */
  const [step, setStep] = useState(-1);
  const [wrongAnswerHint, setWrongAnswerHint] = useState('');

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    setPartialErr('');
  }, [step]);

  /** Pruh jen pro otázky (úvod = žádný segment nevyplněný). */
  const filledQuestionSlots = step < 0 ? 0 : Math.min(step + 1, total);

  const useFlowProgress =
    typeof flowProgressTotal === 'number' && flowProgressTotal > 0 && typeof flowProgressFilled === 'number';

  const currentQ = step >= 0 && step < total ? questions[step] : null;
  const selectedForCurrent = currentQ ? answers[currentQ.id] : undefined;

  const selectOption = useCallback(
    (questionId: string, opt: string) => {
      setWrongAnswerHint('');
      onAnswerChange(questionId, opt);
    },
    [onAnswerChange],
  );

  const goPrev = useCallback(() => {
    setWrongAnswerHint('');
    setStep((s) => Math.max(-1, s - 1));
  }, []);

  const goNext = useCallback(() => {
    if (navBusyRef.current || partialSaving) return;
    if (step === -1) {
      setStep(0);
      return;
    }
    if (step >= 0 && step < total) {
      if (!selectedForCurrent) return;
      setWrongAnswerHint('');
      navBusyRef.current = true;
      setNavBusy(true);
      void (async () => {
        try {
          if (onSavePartialAnswer && currentQ && selectedForCurrent) {
            try {
              const res = await onSavePartialAnswer(currentQ.id, selectedForCurrent);
              if (res && typeof res === 'object' && res.wrongAnswer) setWrongAnswerHint(WRONG_ANSWER_HINT);
            } catch (e) {
              setPartialErr(e instanceof Error ? e.message : 'Uložení se nezdařilo');
              return;
            }
          }
          if (step === total - 1) {
            onComplete();
            return;
          }
          setStep((s) => s + 1);
        } finally {
          navBusyRef.current = false;
          setNavBusy(false);
        }
      })();
    }
  }, [step, total, selectedForCurrent, onComplete, onSavePartialAnswer, currentQ, partialSaving]);

  const handleSavePartial = useCallback(async () => {
    if (!currentQ || !selectedForCurrent || !onSavePartialAnswer) return;
    if (partialAnswerLockRef.current) return;
    partialAnswerLockRef.current = true;
    setPartialErr('');
    setPartialSaving(true);
    try {
      const res = await onSavePartialAnswer(currentQ.id, selectedForCurrent);
      if (res && typeof res === 'object' && res.wrongAnswer) setWrongAnswerHint(WRONG_ANSWER_HINT);
      else setWrongAnswerHint('');
    } catch (e) {
      setPartialErr(e instanceof Error ? e.message : 'Uložení se nezdařilo');
    } finally {
      partialAnswerLockRef.current = false;
      setPartialSaving(false);
    }
  }, [currentQ, selectedForCurrent, onSavePartialAnswer]);

  if (total === 0) return null;

  const letters = ['A', 'B', 'C', 'D'] as const;

  if (!fs) {
    return (
      <div
        className="relative flex min-h-0 w-full flex-col rounded-[24px] py-6 px-3 sm:px-6 md:px-10"
        style={{ backgroundColor: '#F3F5FA' }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-0 sm:px-1 md:-mx-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={step <= -1}
            className="pointer-events-auto z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:opacity-35 disabled:hover:bg-white"
            aria-label="Zpět"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={
              navBusy ||
              partialSaving ||
              (step === -1
                ? false
                : step >= 0 && step < total
                  ? !selectedForCurrent
                  : true)
            }
            className="pointer-events-auto z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-95 disabled:opacity-35"
            style={{ backgroundColor: PURPLE }}
            aria-label={step === total - 1 ? 'Dokončit' : 'Další'}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div className="relative z-[1] mx-auto flex w-full min-h-0 max-w-[640px] flex-col px-11 sm:px-10 md:px-6">
          <div className="mb-6">
            {useFlowProgress ? (
              <SurveyFlowProgressBar total={flowProgressTotal} filled={flowProgressFilled} className="mb-0" />
            ) : (
              <div className="flex justify-center gap-1.5 px-2">
                {Array.from({ length: total }, (_, i) => (
                  <div
                    key={i}
                    className="h-1.5 max-w-[48px] flex-1 rounded-full transition-colors duration-300"
                    style={{
                      backgroundColor: i < filledQuestionSlots ? NAVY : 'rgba(0,17,97,0.12)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {step >= 0 && wrongAnswerHint ? (
            <div
              role="status"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[13px] leading-snug text-amber-950"
              style={FF}
            >
              {wrongAnswerHint}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {step === -1 && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-[20px] border-4 p-6 text-center shadow-sm sm:p-10"
                style={{ borderColor: NAVY, backgroundColor: INTRO_FILL }}
              >
                <p style={{ ...FF, color: NAVY }} className="text-[15px] font-medium sm:text-[16px]">
                  {'Vědomostní test pro získání'}
                </p>
                <p
                  style={{ ...COOPER, color: NAVY }}
                  className="mt-3 text-[28px] leading-tight tracking-tight sm:text-[36px]"
                >
                  {'Certifikátu DVPP'}
                </p>
                <p style={{ ...FF, color: NAVY }} className="mt-5 text-[14px] leading-relaxed opacity-90 sm:text-[15px]">
                  {'Po webináři '}
                  <span className="font-semibold">{`„${webinarTitle}“`}</span>
                </p>
              </motion.div>
            )}

            {currentQ && (
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-[22px] bg-white p-6 shadow-[0_8px_40px_rgba(0,17,97,0.08)] ring-1 ring-[#001161]/6 sm:p-8"
              >
                <p
                  style={{ ...FF, color: '#334155' }}
                  className="text-center text-[21px] font-bold leading-snug sm:text-[24px] sm:leading-snug"
                >
                  {currentQ.label}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {currentQ.options.slice(0, 4).map((opt, oi) => {
                    const letter = letters[oi];
                    const sel = answers[currentQ.id] === opt;
                    return (
                      <button
                        key={`${currentQ.id}-${oi}`}
                        type="button"
                        onClick={() => selectOption(currentQ.id, opt)}
                        className={`flex w-full items-stretch gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-all ${
                          sel
                            ? 'border-[#7C3AED] bg-[#7C3AED]/[0.06] shadow-sm'
                            : 'border-[#E2E8F0] bg-white hover:border-[#001161]/20 hover:bg-slate-50/80'
                        }`}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold"
                          style={{
                            ...FF,
                            color: sel ? PURPLE : '#64748B',
                            backgroundColor: sel ? 'rgba(124,58,237,0.12)' : '#F1F5F9',
                          }}
                        >
                          {letter}
                        </span>
                        <span
                          style={{ ...FF, color: '#334155' }}
                          className="flex min-h-[44px] items-center text-[16px] font-normal leading-snug sm:text-[17px]"
                        >
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {onSavePartialAnswer && currentQ && selectedForCurrent ? (
                  <div className="mt-5 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      disabled={partialSaving || navBusy}
                      onClick={() => void handleSavePartial()}
                      className={ANSWER_BTN}
                      style={FF}
                    >
                      {partialSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {'Odpov\u011bd\u011bt'}
                    </button>
                    {partialErr ? (
                      <p style={FF} className="text-center text-[12px] text-red-600">
                        {partialErr}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <p style={{ ...FF }} className="mt-6 text-center text-[12px] text-slate-400">
                  {step + 1}
                  {' / '}
                  {total}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  /* ── Fullscreen: layout jako Vividbooks40 ABCSlideView (desktop bez obrázku) ── */
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: BG_STAGE }}
    >
      {/* Mobil: šipky v horním řádku; md+: po stranách, vertikálně uprostřed */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4
          max-md:top-0 max-md:min-h-[3.5rem] max-md:pt-[max(0.35rem,env(safe-area-inset-top))] max-md:pb-2
          md:inset-y-0 md:min-h-0 md:px-5 md:py-0 md:pt-0 md:pb-0"
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={step <= -1}
          className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-md backdrop-blur-sm transition hover:bg-white disabled:opacity-30"
          aria-label="Zpět"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={
            navBusy ||
            partialSaving ||
            (step === -1
              ? false
              : step >= 0 && step < total
                ? !selectedForCurrent
                : true)
          }
          className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:opacity-35"
          aria-label={step === total - 1 ? 'Dokončit' : 'Další'}
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      <div className="relative z-[1] mx-auto flex min-h-0 w-full max-w-[min(1120px,100%)] flex-1 flex-col px-4 max-md:pt-16 sm:px-6 md:px-8 md:pt-0">
        {/* Progress nad „slide“ — mimo bílou kartu */}
        <div className="mb-3 shrink-0 pt-1 sm:mb-4">
          {useFlowProgress ? (
            <SurveyFlowProgressBar total={flowProgressTotal} filled={flowProgressFilled} />
          ) : (
            <div className="flex justify-center gap-1.5 px-2">
              {Array.from({ length: total }, (_, i) => (
                <div
                  key={i}
                  className="h-1.5 max-w-[56px] flex-1 rounded-full transition-colors duration-300 sm:max-w-[64px]"
                  style={{
                    backgroundColor: i < filledQuestionSlots ? NAVY : 'rgba(0,17,97,0.1)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {step >= 0 && wrongAnswerHint ? (
          <div
            role="status"
            className="mb-2 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-[13px] leading-snug text-amber-950 sm:mb-3"
            style={FF}
          >
            {wrongAnswerHint}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 sm:rounded-[2rem]">
          <div className="flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              {step === -1 && (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5"
                >
                  <div
                    className="flex min-h-0 w-full flex-1 flex-col justify-center rounded-[18px] border-4 px-5 py-8 text-center shadow-inner sm:rounded-[22px] sm:px-8 sm:py-12 md:px-12"
                    style={{ borderColor: NAVY, backgroundColor: INTRO_FILL }}
                  >
                    <p style={{ ...FF, color: NAVY }} className="text-[16px] font-medium sm:text-[18px]">
                      {'Vědomostní test pro získání'}
                    </p>
                    <p
                      style={{ ...COOPER, color: NAVY }}
                      className="mt-4 text-[clamp(1.75rem,5vw,2.75rem)] leading-tight tracking-tight"
                    >
                      {'Certifikátu DVPP'}
                    </p>
                    <p style={{ ...FF, color: NAVY }} className="mt-6 text-[15px] leading-relaxed opacity-90 sm:text-[16px]">
                      {'Po webináři '}
                      <span className="font-semibold">{`„${webinarTitle}“`}</span>
                    </p>
                  </div>
                </motion.div>
              )}

              {currentQ && (
                <motion.div
                  key={currentQ.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain md:overflow-hidden"
                >
                  {/* Mobil: otázka + tlačítka pod sebou, scroll — bez flex-shrink, který maže výšku textu */}
                  <div className="flex min-h-0 shrink-0 flex-col items-center justify-center px-6 pb-7 pt-8 sm:px-8 sm:pb-6 sm:pt-7 md:flex md:min-h-0 md:flex-[1.15] md:px-14 md:py-6">
                    <p
                      style={{ ...FF, color: QUESTION_MUTED }}
                      className="max-w-4xl text-center text-[clamp(1.05rem,4.2vw,1.85rem)] font-bold leading-snug sm:text-[clamp(1.1rem,3.5vw,2.05rem)] md:leading-relaxed md:text-[1.85rem] lg:text-[2.1rem]"
                    >
                      {currentQ.label}
                    </p>
                  </div>

                  <div className="flex min-h-0 shrink-0 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:pb-7 md:flex md:flex-1 md:justify-end md:pb-7">
                    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-2.5 px-3 sm:grid-cols-2 sm:gap-4 sm:px-6 md:px-10">
                      {currentQ.options.slice(0, 4).map((opt, oi) => {
                        const letter = letters[oi];
                        const sel = answers[currentQ.id] === opt;
                        return (
                          <button
                            key={`${currentQ.id}-${oi}`}
                            type="button"
                            onClick={() => selectOption(currentQ.id, opt)}
                            className={`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all md:gap-4 md:p-4 ${
                              sel
                                ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'
                            }`}
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold md:h-10 md:w-10 md:text-[14px]"
                              style={{
                                ...FF,
                                backgroundColor: sel ? '#c7d2fe' : '#cbd5e1',
                                color: sel ? '#3730a3' : '#475569',
                              }}
                            >
                              {letter}
                            </span>
                            <span
                              style={{ ...FF, color: QUESTION_MUTED }}
                              className="flex min-h-[48px] flex-1 items-center text-[16px] font-medium leading-snug md:text-[18px] md:leading-relaxed"
                            >
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {onSavePartialAnswer && currentQ && selectedForCurrent ? (
                      <div className="mt-4 flex flex-col items-center gap-2 sm:mt-5">
                        <button
                          type="button"
                          disabled={partialSaving || navBusy}
                          onClick={() => void handleSavePartial()}
                          className={`${ANSWER_BTN} py-3 text-[15px] shadow-lg`}
                          style={FF}
                        >
                          {partialSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {'Odpov\u011bd\u011bt'}
                        </button>
                        {partialErr ? (
                          <p style={FF} className="text-center text-[12px] text-red-600">
                            {partialErr}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <p style={{ ...FF }} className="mt-4 text-center text-[12px] text-slate-400 sm:mt-5">
                      {step + 1}
                      {' / '}
                      {total}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
