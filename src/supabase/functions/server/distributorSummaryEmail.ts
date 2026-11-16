/**
 * Doručení shrnutí distributorské objednávky (`send-order-email`, typ `distributor_order_received`).
 *
 * Proč (VB-2026-0617 9. 11., VB-2026-0621 11. 11.): volání `send-order-email` z handleru
 * `POST /distributor/orders` nemělo časový limit. Když se požadavek zasekl, brána Supabase
 * po 150 s vrátila 504, handler skončil uprostřed a do `order_events` se nezapsal ani úspěch,
 * ani chyba. Formulář pak objednávku odeslal znovu (stejné `submissionId`), deduplikace vrátila
 * původní objednávku – ale shrnutí už nikdo neposlal.
 *
 * Teď: každý pokus má limit (výchozí 20 s), po vypršení / chybě sítě jeden další pokus;
 * deduplikovaný POST shrnutí doplní, když k objednávce žádné úspěšně odeslané není.
 *
 * Testy: `deno test --no-check --node-modules-dir=none src/supabase/functions/server/distributorSummaryEmail_test.ts`
 */
import { distributorSummaryEmailSent } from '../../../../supabase/functions/_shared/distributor-order-email.ts';

export const DISTRIBUTOR_SUMMARY_EMAIL_TIMEOUT_MS = 20_000;

export type SummaryEmailSendDeps = {
  /** Jeden pokus o volání `send-order-email`; musí respektovat `signal`. */
  send: (signal: AbortSignal) => Promise<Response>;
  timeoutMs?: number;
  /** Celkový počet pokusů (výchozí 2). Opakuje se jen při vypršení limitu nebo chybě sítě. */
  attempts?: number;
  log?: (message: string) => void;
};

/**
 * Pošle shrnutí. HTTP chyba z `send-order-email` se neopakuje (funkce už chybu zapsala
 * do `order_events` a e-mail mohl být odmítnut příjemcem) – vyhodí se hned.
 */
export async function sendDistributorSummaryEmail(deps: SummaryEmailSendDeps): Promise<void> {
  const timeoutMs = deps.timeoutMs ?? DISTRIBUTOR_SUMMARY_EMAIL_TIMEOUT_MS;
  const attempts = Math.max(1, deps.attempts ?? 2);
  const log = deps.log ?? ((m: string) => console.log(m));
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        /** Nejdřív vlastní chyba (vyhraje `race`), pak zrušit rozjeté volání. */
        reject(new Error(`send-order-email neodpověděl do ${Math.round(timeoutMs / 1000)} s`));
        controller.abort();
      }, timeoutMs);
    });
    let res: Response;
    try {
      res = await Promise.race([deps.send(controller.signal), timeout]);
    } catch (err) {
      lastError = err;
      log(`[distributor] shrnutí e-mail pokus ${attempt}/${attempts}: ${(err as Error)?.message || err}`);
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string })?.error || `send-order-email HTTP ${res.status}`);
    }
    return;
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'send-order-email selhal'));
}

/**
 * Deduplikovaný POST doplní shrnutí až u objednávky starší než tato mez – dřív může původní
 * požadavek pořád běžet (dvojklik) a shrnutí by odešlo dvakrát. Původní požadavek po opravě
 * skončí nejpozději ~1 min po založení; brána ho dřív utnula po 150 s, opakované odeslání
 * z formuláře přichází až po tom.
 */
export const DISTRIBUTOR_SUMMARY_RESEND_MIN_AGE_MS = 90_000;

export type EnsureSummaryEmailDeps = {
  /** Stáří objednávky v ms (`now - orders.created_at`); NaN = neznámé → bere se jako staré. */
  orderAgeMs: number;
  /** `order_events` typu `email` k objednávce (stačí sloupec `details`). */
  loadEmailEvents: () => Promise<Array<{ details?: unknown }> | null>;
  send: () => Promise<void>;
  recordError: (message: string) => Promise<void>;
  log?: (message: string) => void;
};

/**
 * Deduplikovaný POST: když k objednávce ještě není úspěšně odeslané shrnutí, pošle ho.
 * Výsledek: `already_sent` | `too_early` | `sent` | `failed`. Nikdy nevyhazuje (objednávka už existuje).
 */
export async function ensureDistributorSummaryEmail(
  deps: EnsureSummaryEmailDeps,
): Promise<'already_sent' | 'too_early' | 'sent' | 'failed'> {
  const log = deps.log ?? ((m: string) => console.log(m));
  try {
    if (distributorSummaryEmailSent(await deps.loadEmailEvents())) return 'already_sent';
  } catch (err) {
    log(`[distributor] kontrola odeslaného shrnutí selhala, posílám znovu: ${(err as Error)?.message || err}`);
  }
  if (Number.isFinite(deps.orderAgeMs) && deps.orderAgeMs < DISTRIBUTOR_SUMMARY_RESEND_MIN_AGE_MS) {
    return 'too_early';
  }
  try {
    await deps.send();
    return 'sent';
  } catch (err) {
    const message = String((err as Error)?.message || err || 'send failed');
    log(`[distributor] doplnění shrnutí: ${message}`);
    try {
      await deps.recordError(message);
    } catch {
      /* best-effort */
    }
    return 'failed';
  }
}
