/** Dočasný hotfix 1. 9. 2026: vlastní live stream spadl. */
export const TONIGHT_YOUTUBE_LIVE = 'https://www.youtube.com/watch?v=yeh86gzG_zo';

export function isTonightYoutubeHotfix(idOrSlug?: string): boolean {
  return String(idOrSlug || '').includes('jak-nadchnout-zaky-pro-matematiku-na-2-stupni');
}

export function webinarWatchUrl(idOrSlug: string | undefined, fallbackPath: string): string {
  return isTonightYoutubeHotfix(idOrSlug) ? TONIGHT_YOUTUBE_LIVE : fallbackPath;
}
