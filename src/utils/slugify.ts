export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

const SLUG_TO_SUBJECT: Record<string, string> = {
  'matematika-2-stupen': 'Matematika 2. stupe\u0148',
  'matematika-1-stupen': 'Matematika 1. stupe\u0148',
  'fyzika': 'Fyzika',
  'chemie': 'Chemie',
  'prirodopis': 'P\u0159\u00edrodopis',
  'anglicky-jazyk': 'Anglick\u00fd jazyk',
  'cesky-jazyk': '\u010cesk\u00fd jazyk',
  'prvouka': 'Prvouka',
  '2-stupen': '2. stupe\u0148',
  '1-stupen': '1. stupe\u0148',
};

export const subjectToSlug = (subject: string): string => slugify(subject);
export const slugToSubject = (slug: string): string | null => SLUG_TO_SUBJECT[slug] ?? null;
