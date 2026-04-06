import { projectId, publicAnonKey } from './supabase/info';

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
 * Uloží jednu odpověď dotazníku po webináři (KV) — i bez dokončení celého formuláře.
 */
export async function saveWebinarSurveyPartialAnswer(args: {
  webinarId: string;
  email: string;
  questionId: string;
  value: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${SERVER}/webinar-survey-partial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify({
      webinarId: String(args.webinarId ?? '').trim(),
      email: args.email.trim(),
      questionId: args.questionId.trim(),
      value: args.value,
    }),
  });
  const rawText = await res.text();
  let data: { error?: string; success?: boolean } = {};
  try {
    data = (parseJsonResponseBody(rawText) || {}) as typeof data;
  } catch {
    return { ok: false, error: !res.ok ? `Server (${res.status})` : 'Neplatná odpověď serveru' };
  }
  if (!res.ok) {
    if (res.status === 404) {
      return {
        ok: false,
        error:
          'Uložení odpovědi na serveru není k dispozici (404). Je potřeba znovu nasadit Edge funkci make-server-93a20b6f (endpoint webinar-survey-partial).',
      };
    }
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  if (!data.success) {
    return { ok: false, error: data.error || 'Uložení se nezdařilo' };
  }
  return { ok: true };
}
