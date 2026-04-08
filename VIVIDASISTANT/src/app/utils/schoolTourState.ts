/** Jen záloha / migrace — pravda je na serveru (KV). */
export const SCHOOL_TOUR_LOCAL_STORAGE_LEGACY = 'assistant_school_tour_flags_v1';

export type SchoolTourFlags = {
  vitekVisited: boolean;
  vitekPlanned: boolean;
  ivetaVisited: boolean;
  ivetaPlanned: boolean;
  danVisited: boolean;
  danPlanned: boolean;
};

export type TourPrimaryCategory =
  | 'vitekVisited'
  | 'ivetaVisited'
  | 'danVisited'
  | 'vitekPlanned'
  | 'ivetaPlanned'
  | 'danPlanned'
  | 'none';

export const TOUR_FLAG_LABELS: { key: keyof SchoolTourFlags; label: string }[] = [
  { key: 'vitekVisited', label: 'Vítek navštívil' },
  { key: 'vitekPlanned', label: 'Vítek plánuje' },
  { key: 'ivetaVisited', label: 'Iveta navštívila' },
  { key: 'ivetaPlanned', label: 'Iveta plánuje' },
  { key: 'danVisited', label: 'Dan navštívil' },
  { key: 'danPlanned', label: 'Dan plánuje' },
];

export function emptySchoolTourFlags(): SchoolTourFlags {
  return {
    vitekVisited: false,
    vitekPlanned: false,
    ivetaVisited: false,
    ivetaPlanned: false,
    danVisited: false,
    danPlanned: false,
  };
}

export function parseRemoteFlagsRecord(raw: Record<string, unknown>): Record<number, SchoolTourFlags> {
  const out: Record<number, SchoolTourFlags> = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    out[id] = { ...emptySchoolTourFlags(), ...(v as Partial<SchoolTourFlags>) };
  }
  return out;
}

/** Záloha v prohlížeči (fallback při chybě API). */
export function loadAllTourFlags(): Record<number, SchoolTourFlags> {
  try {
    const raw = localStorage.getItem(SCHOOL_TOUR_LOCAL_STORAGE_LEGACY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SchoolTourFlags>;
    const out: Record<number, SchoolTourFlags> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      out[id] = { ...emptySchoolTourFlags(), ...v };
    }
    return out;
  } catch {
    return {};
  }
}

/** @deprecated Pravda je na serveru — ponecháno jen pro případné lokální zálohy. */
export function saveAllTourFlags(map: Record<number, SchoolTourFlags>) {
  try {
    const serial: Record<string, SchoolTourFlags> = {};
    for (const [k, v] of Object.entries(map)) {
      serial[String(k)] = v;
    }
    localStorage.setItem(SCHOOL_TOUR_LOCAL_STORAGE_LEGACY, JSON.stringify(serial));
  } catch {
    // ignore quota
  }
}

/** První významný stav pro barvu na mapě a filtry (návštěva má přednost před plánem). */
export function getPrimaryTourCategory(flags: SchoolTourFlags): TourPrimaryCategory {
  if (flags.vitekVisited) return 'vitekVisited';
  if (flags.ivetaVisited) return 'ivetaVisited';
  if (flags.danVisited) return 'danVisited';
  if (flags.vitekPlanned) return 'vitekPlanned';
  if (flags.ivetaPlanned) return 'ivetaPlanned';
  if (flags.danPlanned) return 'danPlanned';
  return 'none';
}

export const TOUR_CATEGORY_COLORS: Record<TourPrimaryCategory, string> = {
  vitekVisited: '#16A34A',
  ivetaVisited: '#9333EA',
  danVisited: '#EA580C',
  vitekPlanned: '#4ADE80',
  ivetaPlanned: '#C084FC',
  danPlanned: '#FBBF24',
  none: '#6B7280',
};

export const TOUR_CATEGORY_LABELS: Record<TourPrimaryCategory, string> = {
  vitekVisited: 'Vítek navštívil',
  ivetaVisited: 'Iveta navštívila',
  danVisited: 'Dan navštívil',
  vitekPlanned: 'Vítek plánuje',
  ivetaPlanned: 'Iveta plánuje',
  danPlanned: 'Dan plánuje',
  none: 'Bez označení',
};
