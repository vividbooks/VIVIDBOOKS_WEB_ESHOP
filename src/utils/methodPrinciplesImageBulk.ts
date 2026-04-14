/**
 * Párování názvů souborů k metodickým kartám předmětu (hromadný upload v Migraci dat).
 */

export function methodPrincipleTitleToFileStem(title: string): string {
  return String(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Bez přípony: ořízne cestu, diakritiku, volitelný číselný prefix (01-nazev). */
export function fileNameToMatchStem(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '');
  const noExt = base.replace(/\.(png|jpe?g|webp|gif|svg)$/i, '');
  return noExt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\d+[-_\s.]+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export type PrincipleMatch = { file: File; index: number; how: 'title-exact' | 'title-fuzzy' | 'visualId' };

export function matchFilesToPrincipleIndices(
  files: File[],
  rows: { title: string; visualId?: number }[],
): PrincipleMatch[] {
  const out: PrincipleMatch[] = [];
  const used = new Set<number>();
  const titleStems = rows.map((r) => methodPrincipleTitleToFileStem(r.title));

  for (const file of files) {
    const stem = fileNameToMatchStem(file.name);
    if (!stem) continue;

    let idx = -1;
    let how: PrincipleMatch['how'] = 'title-exact';

    const onlyNum = /^(\d+)$/.exec(stem);
    if (onlyNum) {
      const n = parseInt(onlyNum[1], 10);
      const byVid = rows.findIndex((r, i) => !used.has(i) && r.visualId === n);
      if (byVid >= 0) {
        idx = byVid;
        how = 'visualId';
      }
    }

    if (idx < 0) {
      idx = titleStems.findIndex((t, i) => !used.has(i) && t === stem);
      how = 'title-exact';
    }

    if (idx < 0) {
      idx = titleStems.findIndex(
        (t, i) =>
          !used.has(i)
          && t.length > 3
          && stem.length > 3
          && (stem.includes(t) || t.includes(stem)),
      );
      how = 'title-fuzzy';
    }

    if (idx >= 0) {
      used.add(idx);
      out.push({ file, index: idx, how });
    }
  }
  return out;
}
