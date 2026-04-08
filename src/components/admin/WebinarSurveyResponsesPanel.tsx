import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ClipboardList, Download, Link2, Loader2, RefreshCw } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { parseJsonResponseBody } from '../../utils/parseJsonResponseBody';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

export type SurveyQuestionRow = { id: string; type: string; label: string; options?: string[] };

export type SurveyResponseRow = {
  email?: string;
  name?: string;
  answers?: Record<string, string>;
  submittedAt?: string;
  /** Částečné odpovědi (ještě neodeslaný celý dotazník). */
  partial?: boolean;
};

function getAnswerRaw(r: SurveyResponseRow, qid: string): string {
  return r.answers?.[qid] != null ? String(r.answers[qid]) : '';
}

function formatAnswerForCell(q: SurveyQuestionRow, raw: string): string {
  if (!raw) return '—';
  if (q.type === 'yes_no') {
    if (raw === 'yes') return 'Ano';
    if (raw === 'no') return 'Ne';
  }
  return raw;
}

type Responder = { name: string; email: string };

function responderLabel(r: SurveyResponseRow): Responder {
  return {
    name: (r.name || '').trim() || '—',
    email: (r.email || '').trim() || '',
  };
}

/** Horizontální „sloupcový“ pruh + rozbalení kdo odpověděl. */
function ChoiceOptionBar({
  label,
  count,
  maxCount,
  responders,
  hideEmails,
}: {
  label: string;
  count: number;
  maxCount: number;
  responders: Responder[];
  /** Veřejný náhled — bez e-mailů u jmen. */
  hideEmails?: boolean;
}) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2 text-[11px] text-gray-700">
        <span className="leading-snug min-w-0 flex-1">{label}</span>
        <span className="shrink-0 font-bold tabular-nums text-[#001161]">{count}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200/90 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {count > 0 ? (
        <details className="group text-[10px] text-emerald-800/90">
          <summary className="cursor-pointer list-none flex items-center gap-1 select-none hover:text-emerald-900 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" />
            <span className="font-semibold">Kdo odpověděl ({count})</span>
          </summary>
          <ul className="mt-1.5 ml-4 space-y-1 border-l border-emerald-200/80 pl-2.5 text-[11px] text-gray-800">
            {responders.map((p, i) => (
              <li key={`${p.email || 'x'}-${i}`}>
                <span className="font-semibold text-[#001161]">{p.name}</span>
                {!hideEmails && p.email ? (
                  <span className="text-gray-500 font-mono text-[10px]">{` · ${p.email}`}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function csvEscape(s: string): string {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function WebinarSurveyResponsesPanel({
  webinarId,
  title = 'Přehled odpovědí dotazníku',
  subtitle,
  className = '',
  /** Přednačtená data (veřejná stránka) — bez dotazu na admin API. */
  embedded,
  /** Skrytí e-mailů v tabulce a u „Kdo odpověděl“ (veřejný odkaz). */
  publicView = false,
  /** Tlačítka veřejného odkazu vedle CSV (jen admin). */
  showPublicLinkToolbar = false,
}: {
  webinarId: string;
  title?: string;
  /** Např. vysvětlení, že jde o kvíz DVPP + zpětnou vazbu + otázky z CMS. */
  subtitle?: string;
  className?: string;
  embedded?: { questions: SurveyQuestionRow[]; responses: SurveyResponseRow[] } | null;
  publicView?: boolean;
  showPublicLinkToolbar?: boolean;
}) {
  const [loading, setLoading] = useState(!embedded);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestionRow[]>(embedded?.questions ?? []);
  const [responses, setResponses] = useState<SurveyResponseRow[]>(embedded?.responses ?? []);
  const [publicLinkUrl, setPublicLinkUrl] = useState<string | null>(null);
  const [publicLinkBusy, setPublicLinkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!webinarId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${SERVER}/admin/webinar-survey/${encodeURIComponent(webinarId)}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      const rawText = await res.text();
      const d = (parseJsonResponseBody(rawText) || {}) as {
        error?: string;
        questions?: SurveyQuestionRow[];
        responses?: SurveyResponseRow[];
      };
      if (!res.ok) throw new Error(d?.error || rawText.slice(0, 200) || 'Chyba');
      setQuestions(Array.isArray(d?.questions) ? d.questions : []);
      setResponses(Array.isArray(d?.responses) ? d.responses : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Chyba');
      setQuestions([]);
      setResponses([]);
    } finally {
      setLoading(false);
    }
  }, [webinarId]);

  useEffect(() => {
    if (embedded) {
      setQuestions(embedded.questions);
      setResponses(embedded.responses);
      setLoading(false);
      setError(null);
      return;
    }
    void load();
  }, [embedded, load]);

  useEffect(() => {
    if (!showPublicLinkToolbar || !webinarId || embedded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${SERVER}/admin/webinar-survey-public-link/${encodeURIComponent(webinarId)}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        const rawText = await res.text();
        const d = parseJsonResponseBody(rawText) as { url?: string | null };
        if (!cancelled && typeof d?.url === 'string' && d.url) setPublicLinkUrl(d.url);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showPublicLinkToolbar, webinarId, embedded]);

  const createOrCopyPublicLink = useCallback(
    async (rotate: boolean) => {
      if (!webinarId) return;
      setPublicLinkBusy(true);
      try {
        const res = await fetch(`${SERVER}/admin/webinar-survey-public-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ webinarId, rotate }),
        });
        const rawText = await res.text();
        const d = (parseJsonResponseBody(rawText) || {}) as { error?: string; url?: string };
        if (!res.ok) throw new Error(d?.error || rawText.slice(0, 200) || 'Chyba');
        const u = typeof d?.url === 'string' ? d.url : '';
        if (!u && res.ok) {
          throw new Error('Server nevrátil platný odkaz — zkuste znovu nebo Edge logy.');
        }
        if (u) {
          setPublicLinkUrl(u);
          await navigator.clipboard.writeText(u);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Chyba odkazu');
      } finally {
        setPublicLinkBusy(false);
      }
    },
    [webinarId],
  );

  const copyOrCreatePublicLink = useCallback(async () => {
    if (publicLinkUrl) {
      try {
        await navigator.clipboard.writeText(publicLinkUrl);
      } catch {
        /* ignore */
      }
      return;
    }
    await createOrCopyPublicLink(false);
  }, [publicLinkUrl, createOrCopyPublicLink]);

  const exportCsv = useCallback(() => {
    const qh = questions.map((q) => q.label.replace(/\s+/g, ' ').trim());
    const headers = publicView
      ? ['Datum odeslání', 'Jméno', ...qh]
      : ['Datum odeslání', 'Jméno', 'E-mail', ...qh];
    const rows = responses.map((r) => {
      const date = r.submittedAt
        ? `${r.partial ? 'rozpracováno · ' : ''}${new Date(r.submittedAt).toLocaleString('cs-CZ')}`
        : '';
      const base = publicView ? [date, r.name || ''] : [date, r.name || '', r.email || ''];
      const ans = questions.map((q) => {
        const raw = r.answers?.[q.id] != null ? String(r.answers![q.id]) : '';
        return formatAnswerForCell(q, raw);
      });
      return [...base, ...ans];
    });
    const csv =
      '\uFEFF' +
      [headers, ...rows].map((line) => line.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dotaznik-${webinarId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [webinarId, questions, responses, publicView]);

  return (
    <div className={className}>
      <div className="flex flex-col gap-1 border-b border-gray-100 bg-emerald-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <ClipboardList className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-[12px] font-bold text-emerald-900 leading-tight">{title}</h3>
            {subtitle ? (
              <p className="text-[10px] text-emerald-800/80 mt-0.5 leading-snug">{subtitle}</p>
            ) : (
              <p className="text-[10px] text-emerald-800/80 mt-0.5 leading-snug">
                {publicView
                  ? 'Sdílený přehled bez e-mailů účastníků. Počty a textové odpovědi odpovídají stavu v době načtení stránky.'
                  : 'Odpovědi jsou uložené pod e-mailem účastníka. Průběžné uložení po jednotlivých otázkách se zobrazí jako rozpracováno, dokud účastník neodešle celý dotazník. Zahrnuje DVPP, druhou část zpětné vazby a otázky z CMS.'}
              </p>
            )}
          </div>
        </div>
        {responses.length > 0 && questions.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {showPublicLinkToolbar ? (
              <>
                <button
                  type="button"
                  disabled={publicLinkBusy}
                  onClick={() => void copyOrCreatePublicLink()}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                  title={
                    publicLinkUrl
                      ? 'Zkopírovat adresu do schránky'
                      : 'Vytvoří tajný odkaz a zkopíruje ho do schránky'
                  }
                >
                  {publicLinkBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  {publicLinkUrl ? 'Zkopírovat veřejný odkaz' : 'Vytvořit veřejný odkaz'}
                </button>
                {publicLinkUrl ? (
                  <button
                    type="button"
                    disabled={publicLinkBusy}
                    onClick={() => {
                      if (!confirm('Starý odkaz přestane fungovat. Pokračovat?')) return;
                      void createOrCopyPublicLink(true);
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Obnovit odkaz
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-900 hover:bg-emerald-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <p className="px-4 py-4 text-center text-[12px] text-red-500">{error}</p>
      ) : questions.length === 0 ? (
        <p className="px-4 py-4 text-center text-[12px] text-gray-400">
          U tohoto webináře není v datech žádná sada otázek (vypnutý dotazník nebo prázdný záznam).
        </p>
      ) : (
        <div className="space-y-4 p-4">
          <p className="text-[11px] text-gray-500">
            {'Odeslání: '}
            <strong className="text-[#001161]">{responses.length}</strong>
          </p>

          <div className="space-y-3">
            {questions.map((q) => {
              const vals = responses
                .map((r) => getAnswerRaw(r, q.id))
                .filter(Boolean);

              const renderOpenText = () => {
                const rows = responses
                  .map((r) => ({ r, raw: getAnswerRaw(r, q.id).trim() }))
                  .filter(({ raw }) => raw.length > 0);
                if (rows.length === 0) {
                  return (
                    <p className="text-[11px] text-gray-400">{'Zatím žádné textové odpovědi.'}</p>
                  );
                }
                return (
                  <ul className="space-y-3">
                    {rows.map(({ r, raw }, idx) => {
                      const { name, email } = responderLabel(r);
                      return (
                        <li
                          key={`${r.email || 'x'}-${idx}`}
                          className="rounded-lg border border-gray-100 bg-white/90 px-3 py-2.5"
                        >
                          <p className="text-[11px] leading-snug">
                            <span className="font-bold text-[#001161]">{name}</span>
                            {!publicView && email ? (
                              <span className="font-mono text-[10px] text-gray-500">{` · ${email}`}</span>
                            ) : null}
                          </p>
                          <p className="text-[12px] text-gray-800 mt-1.5 whitespace-pre-wrap break-words leading-relaxed">
                            {raw}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                );
              };

              if (q.type === 'yes_no') {
                const ano = responses.filter((r) => getAnswerRaw(r, q.id) === 'yes').map(responderLabel);
                const ne = responses.filter((r) => getAnswerRaw(r, q.id) === 'no').map(responderLabel);
                const max = Math.max(ano.length, ne.length, 1);
                return (
                  <div key={q.id} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                    <p className="text-[12px] font-bold text-[#001161] mb-3 leading-snug">{q.label}</p>
                    <div className="space-y-4">
                      <ChoiceOptionBar
                        label="Ano"
                        count={ano.length}
                        maxCount={max}
                        responders={ano}
                        hideEmails={publicView}
                      />
                      <ChoiceOptionBar
                        label="Ne"
                        count={ne.length}
                        maxCount={max}
                        responders={ne}
                        hideEmails={publicView}
                      />
                    </div>
                  </div>
                );
              }

              if (q.type === 'abc' && q.options?.length) {
                const counts = q.options.map((opt) => ({
                  opt,
                  responders: responses
                    .filter((r) => getAnswerRaw(r, q.id) === opt)
                    .map(responderLabel),
                }));
                const maxCount = Math.max(...counts.map((c) => c.responders.length), 1);
                return (
                  <div key={q.id} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                    <p className="text-[12px] font-bold text-[#001161] mb-3 leading-snug">{q.label}</p>
                    <div className="space-y-4">
                      {counts.map(({ opt, responders }) => (
                        <ChoiceOptionBar
                          key={opt}
                          label={opt}
                          count={responders.length}
                          maxCount={maxCount}
                          responders={responders}
                          hideEmails={publicView}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={q.id} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                  <p className="text-[12px] font-bold text-[#001161] mb-2 leading-snug">{q.label}</p>
                  <p className="text-[10px] text-gray-500 mb-2">
                    {'Otevřená odpověď · '}
                    <strong className="text-gray-600">{vals.length}</strong>
                    {' odpovědí'}
                  </p>
                  {renderOpenText()}
                </div>
              );
            })}
          </div>

          {responses.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-4">Zatím žádné odeslané odpovědi.</p>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[min(480px,55vh)] overflow-y-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-2 py-2 font-bold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-100 z-10">
                        Datum
                      </th>
                      <th className="px-2 py-2 font-bold text-gray-600 whitespace-nowrap min-w-[100px]">Jméno</th>
                      {!publicView ? (
                        <th className="px-2 py-2 font-bold text-gray-600 whitespace-nowrap min-w-[160px]">E-mail</th>
                      ) : null}
                      {questions.map((q) => (
                        <th
                          key={q.id}
                          className="px-2 py-2 font-bold text-[#001161] min-w-[140px] max-w-[220px] align-bottom"
                          title={q.label}
                        >
                          <span className="line-clamp-3">{q.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {responses.map((r, ri) => (
                      <tr key={`${r.email || 'x'}-${ri}`} className="hover:bg-gray-50/80">
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-100">
                          {r.partial ? (
                            <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                              rozpracováno
                            </span>
                          ) : null}
                          {r.submittedAt
                            ? new Date(r.submittedAt).toLocaleString('cs-CZ')
                            : '—'}
                        </td>
                        <td className="px-2 py-2 text-gray-800">{r.name || '—'}</td>
                        {!publicView ? (
                          <td className="px-2 py-2 text-gray-700 font-mono text-[10px]">{r.email || '—'}</td>
                        ) : null}
                        {questions.map((q) => {
                          const raw = r.answers?.[q.id] != null ? String(r.answers[q.id]) : '';
                          const cell = formatAnswerForCell(q, raw);
                          return (
                            <td key={q.id} className="px-2 py-2 text-gray-700 align-top max-w-[240px]">
                              <span className="line-clamp-6 break-words" title={cell}>
                                {cell || '—'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
