/** Sdílený tvar audience filtru (kampaně + Audience → uložit jako tag). */

export type MailingAudienceFilter = {
  includeTagIds?: string[];
  excludeTagIds?: string[];
  sources?: string[];
  subjectInterestSlugs?: string[];
  positionLabels?: string[];
};

export const MAILING_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'webinar', label: 'Webinář' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'trial', label: 'Trial' },
  { value: 'checkout', label: 'Eshop' },
  { value: 'mailchimp_import', label: 'Import MC' },
  { value: 'manual', label: 'Ručně' },
  { value: 'other', label: 'Jiné' },
];

export const MAILING_SUBJECT_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'matematika', label: 'Matematika' },
  { slug: 'fyzika', label: 'Fyzika' },
  { slug: 'chemie', label: 'Chemie' },
  { slug: 'prirodopis', label: 'Přírodopis' },
  { slug: 'prvouka', label: 'Prvouka / 1. stupeň' },
  { slug: 'cesky-jazyk', label: 'Český jazyk' },
];

export function isWebinarTagName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (n.startsWith('web ·') || n.startsWith('eng ·')) return false;
  if (n === 'webinar-registrace' || n.startsWith('webinar-') || n.includes('webinář') || n.includes('webinar')) {
    return true;
  }
  const fold = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hasYear = /\b20[1-3]\d\b/.test(fold);
  const hasDate =
    /\d{1,2}\.\s*\d{1,2}\.\s*20[1-3]\d/.test(fold)
    || /\d{1,2}\/\d{1,2}\/20[1-3]\d/.test(fold)
    || /\bod\s+\d{1,2}[.:]\d{2}/.test(fold);
  if (hasYear && hasDate) return true;
  if (fold.startsWith('dvpp-video') || fold.startsWith('dvpp video')) return true;
  return false;
}

export function isFirstGradeTagName(name: string): boolean {
  const n = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /1\.?\s*stup/.test(n) || n.includes('prvni stup') || n.includes('1stupe');
}

export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function summarizeAudienceFilter(
  filter: MailingAudienceFilter,
  tagNamesById: Map<string, string>,
): string {
  const parts: string[] = [];
  if (filter.sources?.length) {
    const labels = filter.sources.map(
      (s) => MAILING_SOURCE_OPTIONS.find((o) => o.value === s)?.label || s,
    );
    parts.push(`zdroj: ${labels.join(', ')}`);
  }
  if (filter.subjectInterestSlugs?.length) {
    const labels = filter.subjectInterestSlugs.map(
      (s) => MAILING_SUBJECT_OPTIONS.find((o) => o.slug === s)?.label || s,
    );
    parts.push(`předmět: ${labels.join(', ')}`);
  }
  if (filter.includeTagIds?.length) {
    parts.push(`tagy: ${filter.includeTagIds.map((id) => tagNamesById.get(id) || id).join(', ')}`);
  }
  if (filter.excludeTagIds?.length) {
    parts.push(`bez: ${filter.excludeTagIds.map((id) => tagNamesById.get(id) || id).join(', ')}`);
  }
  if (filter.positionLabels?.length) {
    parts.push(`pozice: ${filter.positionLabels.join(', ')}`);
  }
  return parts.length ? parts.join(' · ') : 'všichni přihlášení';
}
