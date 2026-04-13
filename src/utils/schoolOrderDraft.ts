import { useEffect, useState } from 'react';

const SCHOOL_ORDER_DRAFT_KEY = 'vvb_school_order_draft_v1';
const SCHOOL_ORDER_DRAFT_EVENT = 'vvb-school-order-draft-changed';

export interface SchoolOrderDraft {
  selSubjects: string[];
  selTypes: string[];
  students2: number;
  licYears: number;
  digitalSubjects: string[];
  vividboardCount: number;
  /** Počty balíčků (školský formulář) podle ID z KV. */
  bundleQuantities?: Record<string, number>;
  /**
   * Jen `nx_plus_one_subject`: jedna sada = mapa productId → ks (stejná pro každý řádek počtu balíčků).
   */
  subjectBundleSelections?: Record<string, Record<string, number>>;
}

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function sanitizeBundleQuantities(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Math.floor(Number(v));
    if (n > 0) out[k] = n;
  }
  return out;
}

export function sanitizeSubjectBundleSelections(raw: unknown): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Record<string, number>> = {};
  for (const [bundleId, inner] of Object.entries(raw as Record<string, unknown>)) {
    if (!inner || typeof inner !== 'object') continue;
    const row: Record<string, number> = {};
    for (const [pid, q] of Object.entries(inner as Record<string, unknown>)) {
      const n = Math.max(0, Math.floor(Number(q) || 0));
      if (n > 0) row[pid] = n;
    }
    if (Object.keys(row).length > 0) out[bundleId] = row;
  }
  return out;
}

function sanitizeDraft(raw: any): SchoolOrderDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const subjectBundleSelections = sanitizeSubjectBundleSelections(raw.subjectBundleSelections);
  return {
    selSubjects: Array.isArray(raw.selSubjects) ? raw.selSubjects.filter((v) => typeof v === 'string') : [],
    selTypes: Array.isArray(raw.selTypes) ? raw.selTypes.filter((v) => typeof v === 'string') : [],
    students2: Number(raw.students2) > 0 ? Number(raw.students2) : 100,
    licYears: Number(raw.licYears) > 0 ? Number(raw.licYears) : 1,
    digitalSubjects: Array.isArray(raw.digitalSubjects) ? raw.digitalSubjects.filter((v) => typeof v === 'string') : [],
    vividboardCount: Number(raw.vividboardCount) > 0 ? Number(raw.vividboardCount) : 1,
    bundleQuantities: sanitizeBundleQuantities(raw.bundleQuantities),
    ...(Object.keys(subjectBundleSelections).length > 0 ? { subjectBundleSelections } : {}),
  };
}

function emitDraftChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SCHOOL_ORDER_DRAFT_EVENT));
}

export function readSchoolOrderDraft(): SchoolOrderDraft | null {
  if (!canUseStorage()) return null;
  try {
    return sanitizeDraft(JSON.parse(window.localStorage.getItem(SCHOOL_ORDER_DRAFT_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function writeSchoolOrderDraft(draft: SchoolOrderDraft) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SCHOOL_ORDER_DRAFT_KEY, JSON.stringify(draft));
  emitDraftChanged();
}

/** Stejné klíče jako OrderPage — pro předvýběr předmětu z kategorie produktu. */
const ALL_SCHOOL_SUBJECT_KEYS = [
  'Matematika 2. stupe\u0148',
  'Fyzika',
  'P\u0159\u00edrodopis',
  'Chemie',
  'Matematika 1. stupe\u0148',
  'Prvouka',
  '\u010cesk\u00fd jazyk',
] as const;

/** Jedna shoda s logikou předvýběru ve školním formuláři (OrderPage initSubjects). */
export function matchSchoolSubjectKeysFromCategory(category: string | undefined | null): string[] {
  if (!category) return [];
  const pc = category.toLowerCase();
  const match = ALL_SCHOOL_SUBJECT_KEYS.find(
    (k) =>
      k.toLowerCase().includes(pc) ||
      pc.includes(k.toLowerCase().split(' ')[0] || ''),
  );
  return match ? [match] : [];
}

export type MergeSchoolOrderDraftOptions = {
  /** Přepsat počty balíčků jen z `partial` (bez sloučení se starým draftem). */
  replaceBundleQuantities?: boolean;
  /** Přepsat výběry předmětových balíčků jen z `partial`. */
  replaceSubjectBundleSelections?: boolean;
};

export function mergeSchoolOrderDraft(
  partial: Partial<SchoolOrderDraft>,
  options?: MergeSchoolOrderDraftOptions,
) {
  const current = readSchoolOrderDraft();
  const bundleQuantities = options?.replaceBundleQuantities
    ? sanitizeBundleQuantities(partial.bundleQuantities ?? {})
    : sanitizeBundleQuantities({
        ...(current?.bundleQuantities || {}),
        ...(partial.bundleQuantities || {}),
      });
  const subjectBundleSelections = options?.replaceSubjectBundleSelections
    ? sanitizeSubjectBundleSelections(partial.subjectBundleSelections ?? {})
    : sanitizeSubjectBundleSelections({
        ...(current?.subjectBundleSelections || {}),
        ...(partial.subjectBundleSelections || {}),
      });
  const next: SchoolOrderDraft = {
    selSubjects: Array.from(new Set([...(current?.selSubjects || []), ...(partial.selSubjects || [])])),
    selTypes: Array.from(new Set([...(current?.selTypes || []), ...(partial.selTypes || [])])),
    students2: partial.students2 ?? current?.students2 ?? 100,
    licYears: partial.licYears ?? current?.licYears ?? 1,
    digitalSubjects: Array.from(new Set([...(current?.digitalSubjects || []), ...(partial.digitalSubjects || [])])),
    vividboardCount: partial.vividboardCount ?? current?.vividboardCount ?? 1,
    ...(Object.keys(bundleQuantities).length > 0 ? { bundleQuantities } : {}),
    ...(Object.keys(subjectBundleSelections).length > 0 ? { subjectBundleSelections } : {}),
  };
  writeSchoolOrderDraft(next);
  return next;
}

export function clearSchoolOrderDraft() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(SCHOOL_ORDER_DRAFT_KEY);
  emitDraftChanged();
}

export function getSchoolOrderDraftExtraCount(draft: SchoolOrderDraft | null) {
  if (!draft) return 0;
  let count = 0;
  if (draft.selTypes.includes('vividboard')) count += Math.max(1, draft.vividboardCount || 1);
  if (draft.selTypes.includes('digital')) count += 1;
  return count;
}

export function hasSchoolOrderDraft(draft: SchoolOrderDraft | null) {
  if (!draft) return false;
  const bq = draft.bundleQuantities || {};
  const hasBundles = Object.values(bq).some((q) => Number(q) > 0);
  return draft.selSubjects.length > 0 || draft.selTypes.length > 0 || getSchoolOrderDraftExtraCount(draft) > 0 || hasBundles;
}

export function useSchoolOrderDraftMeta() {
  const [draft, setDraft] = useState<SchoolOrderDraft | null>(() => readSchoolOrderDraft());

  useEffect(() => {
    const refresh = () => setDraft(readSchoolOrderDraft());
    window.addEventListener('storage', refresh);
    window.addEventListener(SCHOOL_ORDER_DRAFT_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(SCHOOL_ORDER_DRAFT_EVENT, refresh);
    };
  }, []);

  return {
    draft,
    hasDraft: hasSchoolOrderDraft(draft),
    extraCount: getSchoolOrderDraftExtraCount(draft),
  };
}
