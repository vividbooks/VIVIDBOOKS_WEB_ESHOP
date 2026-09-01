/**
 * Záchranná síť pro live stránku webináře.
 *
 * 1. 9. 2026 selhal Edge endpoint se seznamem webinářů. Kontext spadl na statická
 * data, ta právě probíhající webinář neobsahovala, a `WebinarLiveRoute` proto
 * divákům uprostřed vysílání zavřela stránku. Přímý odkaz na YouTube přitom
 * fungoval celou dobu.
 *
 * Proto si při každém úspěšném zobrazení live stránky uložíme odkaz na stream.
 * Když API později selže, umíme diváka poslat rovnou na YouTube místo toho,
 * abychom ho odstřihli.
 */

const STORE_KEY = 'vvb_live_fallback_v1';
/** Po dvou dnech je odkaz bezcenný a jen by mohl poslat diváka na starý stream. */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

type Entry = { url: string; at: number };
type Store = Record<string, Entry>;

function readStore(): Store {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function keysFor(webinar: { id?: string; slug?: string }): string[] {
  return [webinar.slug, webinar.id].filter((k): k is string => Boolean(k && k.trim()));
}

export function rememberLiveUrl(webinar: { id?: string; slug?: string }, url: string): void {
  if (!url || !/^https?:\/\//i.test(url)) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const store = readStore();
    const at = Date.now();
    for (const key of keysFor(webinar)) store[key] = { url, at };
    for (const [key, entry] of Object.entries(store)) {
      if (!entry?.at || at - entry.at > MAX_AGE_MS) delete store[key];
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* privátní režim / plná storage — fallback je jen bonus, nesmí nic rozbít */
  }
}

export function recallLiveUrl(idOrSlug?: string): string | null {
  if (!idOrSlug) return null;
  const entry = readStore()[idOrSlug];
  if (!entry?.url || !entry.at) return null;
  if (Date.now() - entry.at > MAX_AGE_MS) return null;
  return entry.url;
}
