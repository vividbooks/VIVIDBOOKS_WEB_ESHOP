/**
 * Komu po webináři odešel záznam a kdo ho otevřel (rozesílka „po webináři", KV `webinar_post_followup_track_v1_<webinarId>`).
 * Exportuje se do Kabinetu s registracemi, aby CRM u „Přihlásili se, ale nepřišli" ukázalo „záznam odeslán"
 * místo výzvy ho poslat (ZV-16, Iveta 8. 10. 2026).
 */
export const FOLLOWUP_TRACK_KV_PREFIX = 'webinar_post_followup_track_v1_';

export interface RecordingTrack { recordingSentAt: string | null; recordingOpenedAt: string | null }

/** Klíče KV se stavem rozesílky pro webináře na stránce exportu. */
export const followupTrackKeys = (webinarIds: string[]) => [...new Set(webinarIds.filter(Boolean))].map((id) => `${FOLLOWUP_TRACK_KV_PREFIX}${id}`);

/** Stav rozesílky jednoho příjemce z uložené hodnoty KV (neznámý tvar = nic neodešlo). */
export function recordingTrackFor(state: unknown, email: string): RecordingTrack {
  const none: RecordingTrack = { recordingSentAt: null, recordingOpenedAt: null };
  if (!state || typeof state !== 'object') return none;
  const recipients = (state as { recipients?: unknown }).recipients;
  if (!recipients || typeof recipients !== 'object') return none;
  const hit = (recipients as Record<string, unknown>)[email.toLowerCase().trim()];
  if (!hit || typeof hit !== 'object') return none;
  const t = hit as { sentAt?: unknown; openedAt?: unknown };
  return {
    recordingSentAt: typeof t.sentAt === 'string' ? t.sentAt : null,
    recordingOpenedAt: typeof t.openedAt === 'string' ? t.openedAt : null,
  };
}
