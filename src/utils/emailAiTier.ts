/** Sdílená preference Pro / Lite pro `generate-email` (Email Builder, Content Canvas, Marketing agent). */
export const EMAIL_BUILDER_AI_TIER_KEY = 'vb-email-builder-ai-tier';

export type EmailAiTier = 'lite' | 'pro';

export function getStoredEmailAiTier(): EmailAiTier {
  if (typeof window === 'undefined') return 'lite';
  try {
    return window.localStorage.getItem(EMAIL_BUILDER_AI_TIER_KEY) === 'pro' ? 'pro' : 'lite';
  } catch {
    return 'lite';
  }
}

/** Chybová odpověď od Gemini (503 high demand, 429, …). */
export function geminiErrorLooksOverloaded(message: string): boolean {
  return /503|504|429|UNAVAILABLE|high demand|resource_exhausted|přetížen|nedostupná|MC gen: Gemini 503/i.test(
    message,
  );
}

/**
 * POST na `/admin/mailchimp/generate-email` s jedním opakováním po ~7 s při 503/429 nebo textu o přetížení.
 * Vrací poslední `response` + `data` (JSON tělo).
 */
export async function fetchGenerateEmailWithRetry(
  url: string,
  headers: HeadersInit,
  body: Record<string, unknown>,
  onBeforeRetry?: () => void,
): Promise<{ response: Response; data: Record<string, unknown> }> {
  const run = async () => {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = (await response.json()) as Record<string, unknown>;
    return { response, data };
  };
  let { response, data } = await run();
  const errStr = typeof data.error === 'string' ? data.error : '';
  const shouldRetry =
    response.status === 503 ||
    response.status === 429 ||
    (Boolean(errStr) && geminiErrorLooksOverloaded(errStr));
  if (shouldRetry) {
    onBeforeRetry?.();
    await new Promise((r) => setTimeout(r, 7000));
    ({ response, data } = await run());
  }
  return { response, data };
}
