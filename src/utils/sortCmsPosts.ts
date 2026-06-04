const CS_MONTHS: Record<string, number> = {
  ledna: 0,
  unora: 1,
  brezna: 2,
  dubna: 3,
  kvetna: 4,
  cervna: 5,
  cervence: 6,
  srpna: 7,
  zari: 8,
  rijna: 9,
  listopadu: 10,
  prosince: 11,
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Parse Czech dates like "4. června 2026" or ISO strings. */
export function parseCsDateMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;

  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return iso;

  const m = s.match(/^(\d{1,2})\.\s*([^\s.]+)\s+(\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = CS_MONTHS[norm(m[2])];
    const year = parseInt(m[3], 10);
    if (month != null && day >= 1 && day <= 31) {
      return new Date(year, month, day).getTime();
    }
  }
  return null;
}

function idTimestampMs(id: unknown): number | null {
  if (typeof id !== 'string') return null;
  const m = id.match(/(?:novinka|blog)-(\d{10,})$/);
  if (!m) return null;
  const t = parseInt(m[1], 10);
  return Number.isFinite(t) ? t : null;
}

/** Newest first: date → updatedAt → createdAt → id timestamp. */
export function cmsPostSortTime(post: Record<string, unknown>): number {
  return (
    parseCsDateMs(post.date) ??
    parseCsDateMs(post.updatedAt) ??
    parseCsDateMs(post.createdAt) ??
    idTimestampMs(post.id) ??
    0
  );
}

export function sortCmsPosts<T extends Record<string, unknown>>(posts: T[]): T[] {
  return [...posts].sort((a, b) => cmsPostSortTime(b) - cmsPostSortTime(a));
}
