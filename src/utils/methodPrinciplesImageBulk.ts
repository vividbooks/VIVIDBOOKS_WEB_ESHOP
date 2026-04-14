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

export type PrincipleMatch = { file: File; index: number; how: 'title-exact' | 'title-fuzzy' | 'numeric-order' };

export type MethodPrincipleTemplateRow = {
  title: string;
  body?: string;
  visualId?: number;
  imageUrl?: string;
};

/** Šablona + data z CMS: doplní chybější karty ze šablony, navíc přidá řádky z CMS bez páru na konec. */
export function mergeMethodPrinciplesWithTemplate<T extends MethodPrincipleTemplateRow>(
  template: T[],
  existing: Partial<T>[],
): T[] {
  const ex = existing.map((x) => ({ ...x })) as T[];
  const used = new Set<number>();
  const rows: T[] = template.map((tpl) => {
    const idx = ex.findIndex((x, i) => {
      if (used.has(i)) return false;
      if (tpl.visualId != null && x.visualId != null && Number(x.visualId) === Number(tpl.visualId)) return true;
      return methodPrincipleTitleToFileStem(String(x.title ?? '')) === methodPrincipleTitleToFileStem(String(tpl.title));
    });
    if (idx >= 0) {
      used.add(idx);
      const found = ex[idx];
      return {
        ...tpl,
        ...found,
        title: (found.title as string) || tpl.title,
        body: (found.body as string | undefined) ?? tpl.body,
        visualId: found.visualId ?? tpl.visualId,
        imageUrl: (found.imageUrl as string | undefined) ?? tpl.imageUrl ?? '',
      } as T;
    }
    return { ...tpl, imageUrl: tpl.imageUrl ?? '' } as T;
  });
  const orphans = ex.filter((_, i) => !used.has(i)) as T[];
  return [...rows, ...orphans];
}

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
      // 1.png = první karta v seznamu (pořadí jako v UI)
      if (n >= 1 && n <= rows.length && !used.has(n - 1)) {
        idx = n - 1;
        how = 'numeric-order';
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
