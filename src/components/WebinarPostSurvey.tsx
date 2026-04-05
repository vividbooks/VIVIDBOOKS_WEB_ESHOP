import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Loader2 } from 'lucide-react';
import type { Webinar } from '../data/webinars';
import { getResolvedWebinarSurveyQuestions } from '../utils/webinarSurveyDefaults';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

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
}: {
  webinar: Webinar;
  email: string;
  /** Aktuální odpovědi — pro rodiče (např. zobrazení trial jen při „Nepoužívám“). */
  onAnswersChange?: (answers: Record<string, string>) => void;
}) {
  const questions = useMemo(() => getResolvedWebinarSurveyQuestions(webinar), [webinar]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    onAnswersChange?.(answers);
  }, [answers, onAnswersChange]);

  if (questions.length === 0 || skipped) return null;

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mt-6 pt-6 border-t border-[#001161]/10 text-left"
      >
        <p style={FF} className="text-[13px] text-[#001161]/70">
          {'D\u011bkujeme za odpov\u011bdi \u2014 pom\u016fh\u00e1 n\u00e1m to p\u0159ipravit obsah.'}
        </p>
      </motion.div>
    );
  }

  const submit = async () => {
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
  };

  return (
    <motion.div
      id="webinar-dotaznik"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full mt-6 pt-6 border-t border-[#001161]/10 text-left"
    >
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
        {questions.map((q) => (
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
          </div>
        ))}
      </div>

      {error ? (
        <p style={FF} className="mt-3 text-[13px] text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
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
    </motion.div>
  );
}
