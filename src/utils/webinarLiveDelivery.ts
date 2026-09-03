import type { Webinar } from '../data/webinars';

/**
 * Jak se divák dostane k vysílání na `/webinar/…/live`.
 *
 * `youtube_redirect` je záměrně nejchudší cesta: web si jen poznamená, že divák
 * přišel, a pošle ho na YouTube. Nic dalšího se nemůže pokazit — a proto se na
 * něj spadne jen tehdy, když je odkaz na stream skutečně použitelný.
 */
export type LiveDeliveryPlan =
  | { kind: 'youtube_redirect'; streamUrl: string }
  | { kind: 'google_meet' }
  | { kind: 'live_stream' };

type WebinarLike = Pick<Webinar, 'liveDeliveryMode' | 'youtubeUrl'> & {
  liveUrl?: string;
  recordingUrl?: string;
};

/** Odkaz na vysílání v pořadí, v jakém ho bereme na live stránce. */
export function liveStreamUrlOf(w: WebinarLike): string {
  return String(w.liveUrl || w.youtubeUrl || w.recordingUrl || '').trim();
}

/** Na cizí schéma (`javascript:` apod.) diváka nikdy neposíláme. */
function isSafeStreamUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function resolveLiveDelivery(w: WebinarLike): LiveDeliveryPlan {
  if (w.liveDeliveryMode === 'google_meet') return { kind: 'google_meet' };

  if (w.liveDeliveryMode === 'youtube_redirect') {
    const streamUrl = liveStreamUrlOf(w);
    /* Bez použitelné URL není kam přesměrovat → běžná live stránka s čekárnou. */
    if (isSafeStreamUrl(streamUrl)) return { kind: 'youtube_redirect', streamUrl };
  }

  return { kind: 'live_stream' };
}

/** „přihlášeno 1 účastník / 3 účastníci / 120 účastníků“ pro mezistránku před přesměrováním. */
export function attendeesCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 1) return '1 účastník';
  if (n >= 2 && n <= 4) return `${n} účastníci`;
  return `${n} účastníků`;
}
