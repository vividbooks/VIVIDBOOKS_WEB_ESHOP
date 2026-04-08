import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { PostWebinarPart2Step } from '../data/webinars';
import { SurveyFlowProgressBar } from './SurveyFlowProgressBar';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const BG_STAGE = '#E8EBF4';
const NAVY = '#001161';
const QUESTION_MUTED = '#4E5871';
const PURPLE = '#7C3AED';
const ANSWER_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-2.5 text-[14px] font-bold text-white shadow-md shadow-[#001161]/20 transition hover:bg-[#001a8c] disabled:opacity-45';

type Props = {
  steps: PostWebinarPart2Step[];
  answers: Record<string, string>;
  onAnswerChange: (id: string, value: string) => void;
  onComplete: () => void;
  variant?: 'default' | 'fullscreen';
  flowProgressTotal?: number;
  flowProgressFilled?: number;
  onStepChange?: (step: number) => void;
  /** Částečné uložení jedné odpovědi (KV). */
  onSavePartialAnswer?: (questionId: string, value: string) => Promise<void>;
};

function canAdvance(
  step: PostWebinarPart2Step,
  answers: Record<string, string>,
): boolean {
  if (step.type === 'intro') return true;
  if (step.type === 'open') return true;
  return !!answers[step.id]?.trim();
}

export function WebinarPostSurveyPart2Player({
  steps,
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
  const total = steps.length;
  const [step, setStep] = useState(0);
  const [partialSaving, setPartialSaving] = useState(false);
  const [partialErr, setPartialErr] = useState('');

  const current = total > 0 ? steps[step] : null;

  const filledBars = step;

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    setPartialErr('');
  }, [step]);

  const useFlowProgress =
    typeof flowProgressTotal === 'number' && flowProgressTotal > 0 && typeof flowProgressFilled === 'number';

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const goNext = useCallback(() => {
    if (!current || total === 0) return;
    if (!canAdvance(current, answers)) return;
    if (onSavePartialAnswer && current.type !== 'intro') {
      let v = '';
      if (current.type === 'open' || current.type === 'abc') {
        v = (answers[current.id] || '').trim();
      }
      if (v) {
        void onSavePartialAnswer(current.id, v).catch((e) => {
          setPartialErr(e instanceof Error ? e.message : 'Uložení se nezdařilo');
        });
      }
    }
    if (step >= total - 1) {
      onComplete();
      return;
    }
    setStep((s) => s + 1);
  }, [current, answers, step, total, onComplete, onSavePartialAnswer]);

  const handleSavePartial = useCallback(async () => {
    if (!current || current.type === 'intro' || !onSavePartialAnswer) return;
    let v = '';
    if (current.type === 'open') {
      v = (answers[current.id] || '').trim();
    } else if (current.type === 'abc') {
      v = (answers[current.id] || '').trim();
    } else {
      return;
    }
    if (!v) return;
    setPartialErr('');
    setPartialSaving(true);
    try {
      await onSavePartialAnswer(current.id, v);
    } catch (e) {
      setPartialErr(e instanceof Error ? e.message : 'Uložení se nezdařilo');
    } finally {
      setPartialSaving(false);
    }
  }, [current, answers, onSavePartialAnswer]);

  if (total === 0 || !current) return null;

  const letters = ['A', 'B', 'C', 'D'] as const;

  const renderSlideBody = () => {
    if (current.type === 'intro') {
      return (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5"
        >
          <div
            className="flex min-h-0 w-full flex-1 flex-row items-center gap-4 rounded-[20px] px-5 py-8 shadow-inner sm:gap-8 sm:rounded-[28px] sm:px-8 sm:py-10 md:px-12"
            style={{ backgroundColor: '#475569' }}
          >
            <div
              className="flex shrink-0 items-center justify-center text-[clamp(3.5rem,12vw,5rem)] leading-none"
              aria-hidden
            >
              🤔
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p style={{ ...FF, color: '#fff' }} className="text-[clamp(1.1rem,3vw,1.45rem)] font-semibold leading-snug">
                {current.title}
              </p>
              {current.subtitle ? (
                <p style={{ ...FF, color: 'rgba(255,255,255,0.85)' }} className="mt-3 text-[16px] leading-relaxed sm:text-[17px]">
                  {current.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </motion.div>
      );
    }

    if (current.type === 'open') {
      return (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1 flex-col px-5 py-6 sm:px-12 sm:py-8 md:px-14"
        >
          <div className="flex min-h-0 flex-1 flex-col items-center">
            <p
              style={{ ...FF, color: QUESTION_MUTED }}
              className="max-w-4xl text-center text-[clamp(1.3rem,3.2vw,1.85rem)] font-bold leading-snug md:leading-relaxed md:text-[1.85rem] lg:text-[2.05rem]"
            >
              {current.label}
            </p>
            {current.sublabel ? (
              <p style={{ ...FF, color: QUESTION_MUTED }} className="mt-4 max-w-4xl text-center text-[16px] leading-relaxed opacity-90 sm:text-[17px]">
                {current.sublabel}
              </p>
            ) : null}
            <textarea
              value={answers[current.id] || ''}
              onChange={(e) => onAnswerChange(current.id, e.target.value)}
              placeholder={current.placeholder || 'Vaše odpověď'}
              rows={fs ? 8 : 5}
              className="mt-6 w-full max-w-4xl flex-1 min-h-[140px] resize-y rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-[15px] text-[#334155] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 sm:min-h-[180px] md:text-[16px]"
              style={FF}
            />
            {onSavePartialAnswer ? (
              <div className="mt-5 flex w-full max-w-4xl flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={
                    partialSaving || !(answers[current.id] || '').trim()
                  }
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
          </div>
          <p style={{ ...FF }} className="mt-4 text-center text-[12px] text-slate-400 sm:mt-5">
            {step + 1}
            {' / '}
            {total}
          </p>
        </motion.div>
      );
    }

    /* abc */
    return (
      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 flex-[1.05] flex-col items-center justify-center px-5 py-4 sm:px-12 sm:py-6 md:px-14">
          <p
            style={{ ...FF, color: QUESTION_MUTED }}
            className="max-w-4xl text-center text-[clamp(1.3rem,3.2vw,1.85rem)] font-bold leading-snug md:leading-relaxed md:text-[1.85rem] lg:text-[2.05rem]"
          >
            {current.label}
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end pb-5 sm:pb-7">
          <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 px-4 sm:gap-4 sm:px-6 md:px-10">
            {current.options.slice(0, 4).map((opt, oi) => {
              const letter = letters[oi];
              const sel = answers[current.id] === opt;
              return (
                <button
                  key={`${current.id}-${oi}`}
                  type="button"
                  onClick={() => onAnswerChange(current.id, opt)}
                  className={`relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all md:gap-4 md:p-4 ${
                    sel ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'
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
          {onSavePartialAnswer && answers[current.id]?.trim() ? (
            <div className="mx-auto mt-4 flex w-full max-w-4xl flex-col items-center gap-2 px-4 sm:px-6 md:px-10">
              <button
                type="button"
                disabled={partialSaving}
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
          <p style={{ ...FF }} className="mt-4 text-center text-[12px] text-slate-400 sm:mt-5">
            {step + 1}
            {' / '}
            {total}
          </p>
        </div>
      </motion.div>
    );
  };

  const nextDisabled = !canAdvance(current, answers);

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
            disabled={step <= 0}
            className="pointer-events-auto z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 disabled:opacity-35"
            aria-label="Zpět"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={nextDisabled}
            className="pointer-events-auto z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-95 disabled:opacity-35"
            style={{ backgroundColor: PURPLE }}
            aria-label={step >= total - 1 ? 'Dokončit' : 'Další'}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div className="relative z-[1] mx-auto flex w-full min-h-0 max-w-[640px] flex-col px-11 sm:px-10 md:px-6">
          <div className="mb-6">
            {useFlowProgress ? (
              <SurveyFlowProgressBar total={flowProgressTotal} filled={flowProgressFilled} />
            ) : (
              <div className="flex justify-center gap-1.5 px-2">
                {Array.from({ length: total }, (_, i) => (
                  <div
                    key={i}
                    className="h-1.5 max-w-[48px] flex-1 rounded-full transition-colors duration-300"
                    style={{
                      backgroundColor: i < filledBars ? NAVY : 'rgba(0,17,97,0.12)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="min-h-[min(70vh,520px)] overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80">
            <div className="flex min-h-[min(70vh,520px)] flex-col">
              <AnimatePresence mode="wait">{renderSlideBody()}</AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]"
      style={{ backgroundColor: BG_STAGE }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4
          max-md:top-0 max-md:min-h-[3.5rem] max-md:pt-[max(0.35rem,env(safe-area-inset-top))] max-md:pb-2
          md:inset-y-0 md:min-h-0 md:px-5 md:py-0 md:pt-0 md:pb-0"
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={step <= 0}
          className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-500 shadow-md backdrop-blur-sm transition hover:bg-white disabled:opacity-30"
          aria-label="Zpět"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={nextDisabled}
          className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:opacity-35"
          aria-label={step >= total - 1 ? 'Dokončit' : 'Další'}
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      <div className="relative z-[1] mx-auto flex min-h-0 w-full max-w-[min(1120px,100%)] flex-1 flex-col px-4 max-md:pt-16 sm:px-6 md:px-8 md:pt-0">
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
                    backgroundColor: i < filledBars ? NAVY : 'rgba(0,17,97,0.1)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[1.65rem] bg-white shadow-[0_24px_64px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 sm:rounded-[2rem]">
          <div className="flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">{renderSlideBody()}</AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
