/**
 * DVPP zdarma — čistá logika obsahu záznamů (bez Deno): kapitoly, upoutávky, výběr „nové v knihovně“.
 * Sdílí ji server i klient (import přes relativní cestu), testuje se v scripts/run-unit-tests.ts.
 */

export type Chapter = { t: number; title: string };

/** „mm:ss Název“ nebo „h:mm:ss Název“ na řádek → kapitoly seřazené podle času. Neplatné řádky se přeskočí. */
export function parseChapters(text: string): Chapter[] {
  const out: Chapter[] = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–—]?\s*(.+)$/);
    if (!m) continue;
    const [, a, b, c, title] = m;
    const t = c !== undefined ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
    if (!Number.isFinite(t) || !title.trim()) continue;
    out.push({ t, title: title.trim().slice(0, 120) });
  }
  return out.sort((x, y) => x.t - y.t);
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function chaptersToText(chapters: Chapter[] | null | undefined): string {
  return (chapters || []).map((c) => `${formatTime(c.t)} ${c.title}`).join('\n');
}

/** Kapitola, ve které je daná pozice (pro zvýraznění v seznamu). */
export function currentChapterIndex(chapters: Chapter[], position: number): number {
  let idx = -1;
  for (let i = 0; i < chapters.length; i++) if (chapters[i].t <= position) idx = i;
  return idx;
}

export type DigestVideo = { id: string; name: string; slug: string; thumbnail?: string; addedAt?: string; updatedAt?: string; importedAt?: string; lecturer?: string; durationMinutes?: number };

/** Záznamy přidané za posledních N dní (podle addedAt/importedAt/updatedAt), jinak posledních `fallback` v pořadí katalogu. */
export function pickNewVideos(videos: DigestVideo[], sinceDays: number, now: Date, fallback = 4): DigestVideo[] {
  const since = now.getTime() - sinceDays * 86400_000;
  const dated = videos
    .map((v) => ({ v, at: Date.parse(v.addedAt || v.importedAt || v.updatedAt || '') }))
    .filter((x) => Number.isFinite(x.at) && x.at >= since)
    .sort((a, b) => b.at - a.at)
    .map((x) => x.v);
  if (dated.length) return dated.slice(0, 6);
  return videos.slice(0, fallback);
}

/** Subject digestu: první nový záznam jako háček, jinak obecný. */
export function digestSubject(newVideos: DigestVideo[], weekLabel: string): string {
  const first = newVideos[0];
  if (first) return `Nové v knihovně: ${first.name}`.slice(0, 90);
  return `Knihovna DVPP zdarma: co je nového (${weekLabel})`;
}
