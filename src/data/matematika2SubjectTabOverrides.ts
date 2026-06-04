import type { SubjectTabContentOverride } from '../components/SubjectTabsSection';

export const APLIKACE_RYSOVANI_TAB_TEXT = 'Aplikace Rýsování';

export const APLIKACE_RYSOVANI_CONTENT_RICH_TEXT =
  'Představujeme naši novou aplikaci pro rýsování, která žákům umožňuje pracovat s digitálním pravítkem a kružítkem přímo na obrazovce. Tento moderní nástroj usnadňuje výuku geometrie a rozvíjí prostorovou představivost. Ideální pro interaktivní tabule i individuální práci na tabletech.';

export function isMatematika2TabsSubject(subject: string): boolean {
  const lower = subject.toLowerCase();
  return (
    lower.includes('matematika') &&
    (lower.includes('2') || lower.includes('druh') || lower.includes('second'))
  );
}

export function getMatematika2TabOverrides(
  subject: string,
): Record<string, SubjectTabContentOverride> | undefined {
  if (!isMatematika2TabsSubject(subject)) return undefined;
  return {
    [APLIKACE_RYSOVANI_TAB_TEXT]: {
      contentRichText: APLIKACE_RYSOVANI_CONTENT_RICH_TEXT,
    },
  };
}
