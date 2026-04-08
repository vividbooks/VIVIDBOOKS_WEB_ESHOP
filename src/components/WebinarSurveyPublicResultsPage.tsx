import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { SEOHead } from './SEOHead';
import {
  WebinarSurveyResponsesPanel,
  type SurveyQuestionRow,
  type SurveyResponseRow,
} from './admin/WebinarSurveyResponsesPanel';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;

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

/**
 * Veřejný sdílený přehled odpovědí dotazníku po webináři (tajný odkaz z administrace).
 */
export function WebinarSurveyPublicResultsPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    webinarId: string;
    webinarTitle: string;
    questions: SurveyQuestionRow[];
    responses: SurveyResponseRow[];
  } | null>(null);

  useEffect(() => {
    if (!token?.trim()) {
      setError('Chybí platný odkaz.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${SERVER}/public/webinar-survey-results/${encodeURIComponent(token.trim())}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        const rawText = await res.text();
        const d = parseJsonResponseBody(rawText) as {
          error?: string;
          webinarId?: string;
          webinarTitle?: string;
          questions?: SurveyQuestionRow[];
          responses?: SurveyResponseRow[];
        };
        if (!res.ok) throw new Error(d?.error || rawText.slice(0, 200) || 'Nepodařilo se načíst data.');
        if (cancelled) return;
        setPayload({
          webinarId: String(d?.webinarId || ''),
          webinarTitle: String(d?.webinarTitle || 'Webinář'),
          questions: Array.isArray(d?.questions) ? d.questions : [],
          responses: Array.isArray(d?.responses) ? d.responses : [],
        });
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chyba');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const path = `/webinar-dotaznik-vysledky/${encodeURIComponent(token || '')}`;

  return (
    <div className="min-h-[60vh] w-full max-w-4xl mx-auto px-4 py-8 md:py-12">
      <SEOHead
        title={payload ? `Výsledky dotazníku: ${payload.webinarTitle}` : 'Výsledky dotazníku'}
        description="Sdílený přehled odpovědí z dotazníku po webináři."
        path={path}
        noIndex
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#001161]/40" />
          <p className="font-['Fenomen_Sans',sans-serif] text-[13px] text-[#001161]/55">Načítám přehled…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50/80 px-5 py-8 text-center">
          <p className="font-['Fenomen_Sans',sans-serif] text-[14px] font-semibold text-red-800">{error}</p>
          <p className="mt-2 text-[12px] text-red-700/80">
            Odkaz mohl být zrušen nebo nahrazen novým v administraci webináře.
          </p>
        </div>
      ) : payload ? (
        <WebinarSurveyResponsesPanel
          webinarId={payload.webinarId}
          title={`Odpovědi účastníků — ${payload.webinarTitle}`}
          subtitle="Sdílený přehled bez e-mailů účastníků. Obsah odpovídá stavu v době načtení stránky."
          embedded={{ questions: payload.questions, responses: payload.responses }}
          publicView
          className="rounded-2xl border border-emerald-100 shadow-sm overflow-hidden bg-white"
        />
      ) : null}
    </div>
  );
}
