/** České názvy měsíců jako v CMS webinářů (WebinareEditor MONTHS_CS). */
export const CS_MONTH_NAMES_CZ = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
] as const;

export type WebinarLikeForSort = {
  year: number;
  monthNum?: number;
  day: number;
  monthName?: string;
  time?: string;
  isPast?: boolean;
};

/** Čas začátku akce v ms — pro řazení (nejbližší budoucí = nejnižší ts mezi upcoming). */
export function webinarEventTimestampMs(w: WebinarLikeForSort): number {
  let monthIdx = 0;
  if (typeof w.monthNum === 'number' && w.monthNum >= 1 && w.monthNum <= 12) {
    monthIdx = w.monthNum - 1;
  } else if (w.monthName) {
    const mn = String(w.monthName).trim().toLowerCase();
    const idx = CS_MONTH_NAMES_CZ.findIndex((m) => m.toLowerCase() === mn);
    if (idx >= 0) monthIdx = idx;
  }
  const d = new Date(w.year, monthIdx, Number(w.day) || 1);
  const t = w.time ? String(w.time).match(/^(\d{1,2}):(\d{2})/) : null;
  if (t) d.setHours(parseInt(t[1], 10), parseInt(t[2], 10), 0, 0);
  return d.getTime();
}

/** Plánované první (nejbližší nahoře), minulé podle data sestupně. */
export function compareWebinarsBySchedule(a: WebinarLikeForSort, b: WebinarLikeForSort): number {
  const ap = !!a.isPast;
  const bp = !!b.isPast;
  if (ap !== bp) return ap ? 1 : -1;
  const ta = webinarEventTimestampMs(a);
  const tb = webinarEventTimestampMs(b);
  if (!ap) return ta - tb;
  return tb - ta;
}
