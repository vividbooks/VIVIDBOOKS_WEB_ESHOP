import React from 'react';
import { subjectToSlug } from '../utils/slugify';

/**
 * Homepage (zatím jen /homepage-test): místo pásu sešitů předmětu tři velké karty řad.
 * Obálky bere z reálných produktů dané řady, nebo ze `staticCovers` (řady, které zatím jsou jen
 * v aplikaci nove.vividbooks.com, ne v katalogu webu). Řada bez obálek se nezobrazí, pokud nemá
 * `placeholder` (pak místo obálek dva modré sešity s názvem řady).
 */

type Cover = { name: string; image: string };

type SeriesDef = {
  key: string;
  title: string;
  label: string;
  description: string;
  /** Hodnota `?typ=` na stránce předmětu (SERIES_TYP_PARAMS v SubjectPage); bez ní vede karta na celý předmět. */
  typ?: string;
  /** Hodnota `?rocnik=` na stránce předmětu (karty po ročnících na 1. stupni). */
  rocnik?: string;
  /** Z katalogu: obálky dílů jedné řady (1. díl vpředu) místo různých ročníků. */
  coverParts?: boolean;
  /** Pozadí karty (zatím jednotná světlá šedá webu; lze dát každé řadě jinou). */
  bg: string;
  /** Řada zatím není v katalogu — ukázat zástupné obálky místo skrytí karty. */
  placeholder?: boolean;
  /** Text na zástupné obálce (výchozí `title`). */
  placeholderText?: string;
  /** Vlastní proklik (např. do knihovny aplikace, když web obsah nemá). */
  href?: string;
  /** Ve spojeném řádku (APP_ONLY_GROUPS): předmět, jehož nadpis stojí nad kartou. */
  subject?: string;
  match?: (lowerName: string) => boolean;
  /** Karta digitální učebnice — obrázek online produktu předmětu (prop `digitalProduct`). */
  digital?: boolean;
  /** Z katalogu: obálky kterých ročníků dát přes sebe (pořadí v seznamu ročníků řady; první je vpředu), aby karty nebyly stejné. */
  coverGrades?: number[];
  /** Obálky z aplikace (storage platform-admin) pro řady, které v katalogu webu ještě nejsou; první je vpředu. */
  staticCovers?: Cover[];
};

const APP_COVERS = 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/illustrations/obalky';

const MATH_SERIES: SeriesDef[] = [
  {
    key: 'krok',
    title: 'Krok za krokem',
    label: 'Pracovní sešity',
    description: 'Žáci objevují matematické jevy',
    typ: 'krok',
    bg: '#f8f9fc',
    coverGrades: [0, 2, 3],
    match: (n) => n.includes('krok za krokem'),
  },
  {
    key: 'pro-vsechny',
    title: 'Pro všechny',
    label: 'Pracovní sešity',
    description: 'Spousta úloh v různých úrovních',
    typ: 'pro-vsechny',
    bg: '#f8f9fc',
    coverGrades: [0, 1, 3],
    match: (n) => n.includes('pro všechny'),
  },
  {
    key: 'moje-matematika',
    title: 'Moje Matematika',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    bg: '#f8f9fc',
    placeholder: true,
    match: (n) => n.includes('moje matematik'),
  },
  {
    key: 'digital',
    title: 'Digitální učebnice',
    label: 'Digitální přístup',
    description: 'Celá učebnice online, na tabuli i u žáků',
    typ: 'digital',
    bg: '#f8f9fc',
    digital: true,
  },
];

const PHYSICS_SERIES: SeriesDef[] = [
  {
    key: 'krok',
    title: 'Krok za krokem',
    label: 'Pracovní sešity',
    description: 'Žáci objevují fyzikální jevy',
    bg: '#f8f9fc',
    staticCovers: [
      { name: 'Fyzika 6 · Krok za krokem', image: `${APP_COVERS}/fyzika-kzk-6-19456.png` },
      { name: 'Fyzika 7 · Krok za krokem', image: `${APP_COVERS}/fyzika-kzk-7-19456.png` },
    ],
  },
  {
    key: 'pro-vsechny',
    title: 'Pro všechny',
    label: 'Pracovní sešity',
    description: 'Spousta úloh v různých úrovních',
    bg: '#f8f9fc',
    coverGrades: [0, 1, 2],
    match: (n) => n.includes('pracovní sešit'),
  },
  {
    key: 'moje-fyzika',
    title: 'Moje Fyzika',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    bg: '#f8f9fc',
    staticCovers: [
      { name: 'Fyzika 6 · Učebnice / portfolio', image: `${APP_COVERS}/fyzika-portfolio-6-19456.png` },
      { name: 'Fyzika 7 · Učebnice / portfolio', image: `${APP_COVERS}/fyzika-portfolio-7-20261028b.png` },
      { name: 'Fyzika 8 · Učebnice / portfolio', image: `${APP_COVERS}/fyzika-portfolio-8-19456.png` },
    ],
  },
  {
    key: 'digital',
    title: 'Digitální učebnice',
    label: 'Digitální přístup',
    description: 'Celá učebnice online, na tabuli i u žáků',
    bg: '#f8f9fc',
    digital: true,
  },
];

const BIOLOGY_SERIES: SeriesDef[] = [
  {
    key: 'sesity',
    title: 'Pracovní sešity',
    label: '6.–9. ročník',
    description: 'Sešit ke každému ročníku',
    bg: '#f8f9fc',
    coverGrades: [0, 1, 2],
    match: (n) => n.includes('pracovní sešit'),
  },
  {
    key: 'muj-prirodopis',
    title: 'Můj Přírodopis',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    bg: '#f8f9fc',
    staticCovers: [
      { name: 'Přírodopis 6 · Učebnice / portfolio', image: `${APP_COVERS}/prirodopis-portfolio-6-91865.png` },
      { name: 'Přírodopis 7 · Učebnice / portfolio', image: `${APP_COVERS}/prirodopis-portfolio-7-91865.png` },
      { name: 'Přírodopis 8 · Učebnice / portfolio', image: `${APP_COVERS}/prirodopis-portfolio-8-91865.png` },
    ],
  },
  {
    key: 'digital',
    title: 'Digitální učebnice',
    label: 'Digitální přístup',
    description: 'Celá učebnice online, na tabuli i u žáků',
    bg: '#f8f9fc',
    digital: true,
  },
];

const CHEMISTRY_SERIES: SeriesDef[] = [
  {
    key: 'sesity',
    title: 'Pracovní sešity',
    label: '8.–9. ročník',
    description: 'Sešit ke každému ročníku',
    bg: '#f8f9fc',
    coverGrades: [0, 1],
    match: (n) => n.includes('pracovní sešit'),
  },
  {
    key: 'rvp-2025',
    title: 'Chemie podle RVP 2025',
    label: 'Učebnice',
    description: 'Nová učebnice pro 8. a 9. ročník',
    bg: '#f8f9fc',
    staticCovers: [
      { name: 'Chemie podle RVP 2025 · 8. ročník', image: 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/illustrations/chemie-rvp/obalka-8-mukycssf.png' },
      { name: 'Chemie podle RVP 2025 · 9. ročník', image: 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/illustrations/chemie-rvp/obalka-9-mukycv6j.png' },
    ],
  },
  {
    key: 'digital',
    title: 'Digitální učebnice',
    label: 'Digitální přístup',
    description: 'Celá učebnice online, na tabuli i u žáků',
    bg: '#f8f9fc',
    digital: true,
  },
];

const HISTORY_COVERS = 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/covers';

const HISTORY_HREF = 'https://nove.vividbooks.com/knihovna/stupen-2/dejepis';

/** Dějepis a zeměpis v jednom řádku (oba zatím jen v aplikaci). */
const HISTORY_GEO_SERIES: SeriesDef[] = [
  {
    key: 'dejepis-krok',
    subject: 'Dějepis',
    title: 'Krok za krokem',
    label: 'Pracovní sešity',
    description: 'Sešit pro 7., 8. a 9. ročník',
    bg: '#f8f9fc',
    href: HISTORY_HREF,
    staticCovers: [
      { name: 'Dějepis 7 · Krok za krokem', image: `${HISTORY_COVERS}/dejepis-krok-za-krokem-7-20261027.jpg` },
      { name: 'Dějepis 8 · Krok za krokem', image: `${HISTORY_COVERS}/dejepis-krok-za-krokem-8-20261027.jpg` },
      { name: 'Dějepis 9 · Krok za krokem', image: `${HISTORY_COVERS}/dejepis-krok-za-krokem-9-20261027.jpg` },
    ],
  },
  {
    key: 'muj-dejepis',
    subject: 'Dějepis',
    title: 'Můj Dějepis',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    bg: '#f8f9fc',
    // V aplikaci jsou zatím jen jednobarevné plochy bez názvu — proto zástupné obálky.
    placeholder: true,
    href: HISTORY_HREF,
  },
  {
    key: 'zemepis-sesity',
    subject: 'Zeměpis',
    title: 'Zeměpis obecný nebo regionální',
    label: 'Pracovní sešity',
    description: 'Dva typy sešitů podle zaměření výuky',
    bg: '#f8f9fc',
    // Zatím bez obálek (v aplikaci tematické sešity pro 6. ročník).
    placeholder: true,
    placeholderText: 'Zeměpis',
    href: 'https://nove.vividbooks.com/knihovna/stupen-2/zemepis',
  },
  {
    key: 'muj-zemepis',
    subject: 'Zeměpis',
    title: 'Můj Zeměpis',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    bg: '#f8f9fc',
    // V aplikaci zatím tematické sešity pro 6. ročník, bez obálek.
    placeholder: true,
    href: 'https://nove.vividbooks.com/knihovna/stupen-2/zemepis',
  },
];

/** Karta po ročnících (1. stupeň): obálky dílů daného ročníku, proklik s filtrem ročníku. */
const gradeCard = (rocnik: number, description: string): SeriesDef => ({
  key: `rocnik-${rocnik}`,
  title: `${rocnik}. ročník`,
  label: 'Pracovní sešity',
  description,
  rocnik: String(rocnik),
  bg: '#f8f9fc',
  coverParts: true,
  match: (n) => n.includes(`${rocnik}. ročník`) && n.includes('díl'),
});

const DIGITAL_CARD: SeriesDef = {
  key: 'digital',
  title: 'Digitální učebnice',
  label: 'Digitální přístup',
  description: 'Celá učebnice online, na tabuli i u žáků',
  bg: '#f8f9fc',
  digital: true,
};

// Matematika 1. st.: v aplikaci je i 3. ročník, ale zatím bez obálek — karta až budou.
const APP_LIBRARY = 'https://nove.vividbooks.com/knihovna';

/** Sešit, který je zatím jen v aplikaci a nemá obálku: zástupné obálky, proklik do knihovny aplikace. */
const appOnlyCard = (key: string, title: string, label: string, description: string, href: string, placeholderText = title): SeriesDef => ({
  key,
  title,
  label,
  description,
  bg: '#f8f9fc',
  placeholder: true,
  placeholderText,
  href,
});

const MATH1_SERIES: SeriesDef[] = [
  gradeCard(1, 'Tři díly a Početníček'),
  gradeCard(2, 'Tři díly a Početníček'),
  // 3. ročník je zatím jen v aplikaci, bez obálek.
  appOnlyCard('rocnik-3', '3. ročník', 'Pracovní sešity', 'Tři díly, zatím v aplikaci', `${APP_LIBRARY}/stupen-1/matematika`, 'Matematika 3'),
  DIGITAL_CARD,
];

const CJS_HREF = `${APP_LIBRARY}/stupen-1/clovek-a-jeho-svet`;
/** Vlastivěda, přírodověda a informatika v jednom řádku; zatím jen 4. ročník (5. je v aplikaci taky). */
const CJS_INFO_SERIES: SeriesDef[] = [
  { ...appOnlyCard('vlastiveda-4', '4. ročník', 'Pracovní sešit', 'Vlastivěda pro 4. ročník', CJS_HREF, 'Vlastivěda 4'), subject: 'Vlastivěda' },
  { ...appOnlyCard('prirodoveda-4', '4. ročník', 'Pracovní sešit', 'Přírodověda pro 4. ročník', CJS_HREF, 'Přírodověda 4'), subject: 'Přírodověda' },
  { ...appOnlyCard('informatika-4', '4. ročník', 'Pracovní sešit', 'Informatika pro 4. ročník', `${APP_LIBRARY}/stupen-1/informatika`, 'Informatika 4'), subject: 'Informatika' },
];

const PRVOUKA_SERIES: SeriesDef[] = [
  gradeCard(1, 'Pracovní sešit ve dvou dílech'),
  gradeCard(2, 'Pracovní sešit ve dvou dílech'),
  gradeCard(3, 'Pracovní sešit, 1. díl'),
  DIGITAL_CARD,
];

const CZECH_SERIES: SeriesDef[] = [
  {
    key: 'vazane',
    title: 'Vázané písmo',
    label: 'Písanky a čáranka',
    description: 'Písanka ve třech dílech a čáranka',
    bg: '#f8f9fc',
    coverParts: true,
    match: (n) => n.includes('pro vázané písmo'),
  },
  {
    key: 'nevazane',
    title: 'Nevázané písmo',
    label: 'Písanky a čáranka',
    description: 'Písanka ve třech dílech a čáranka',
    bg: '#f8f9fc',
    coverParts: true,
    match: (n) => n.includes('pro nevázané písmo'),
  },
  {
    key: 'slabikare',
    title: 'Slabikáře',
    label: 'Čtení',
    description: 'Slabikář ve třech dílech',
    bg: '#f8f9fc',
    staticCovers: [
      { name: 'Slabikář 1', image: `${APP_COVERS}/slabikar-1-20261028c.png` },
      { name: 'Slabikář 2', image: `${APP_COVERS}/slabikar-2-20261028c.png` },
      { name: 'Slabikář 3', image: `${APP_COVERS}/slabikar-3-20261028c.png` },
    ],
  },
  DIGITAL_CARD,
];

/**
 * Řádky z předmětů, které v katalogu webu zatím nejsou (jen v aplikaci): na testovací homepage se přidají
 * za `after`; každá karta vede do svého předmětu v aplikaci (`href`), tlačítko celého předmětu chybí.
 */
export const APP_ONLY_GROUPS: { group: string; after: string; stupen: 1 | 2 }[] = [
  { group: 'Dějepis a zeměpis', after: 'Chemie', stupen: 2 },
  { group: 'Vlastivěda, přírodověda a informatika', after: 'Prvouka', stupen: 1 },
];

/** Skupiny homepage (podle předmětu), které místo pásu sešitů ukazují karty řad. */
export const SERIES_BY_GROUP: Record<string, SeriesDef[]> = {
  'Matematika 2. stupeň': MATH_SERIES,
  Fyzika: PHYSICS_SERIES,
  Přírodopis: BIOLOGY_SERIES,
  Chemie: CHEMISTRY_SERIES,
  'Dějepis a zeměpis': HISTORY_GEO_SERIES,
  'Matematika 1. stupeň': MATH1_SERIES,
  Prvouka: PRVOUKA_SERIES,
  'Český jazyk': CZECH_SERIES,
  'Vlastivěda, přírodověda a informatika': CJS_INFO_SERIES,
};

const byOrder = (a: any, b: any) => (a.poradi ?? 999) - (b.poradi ?? 999);
const gradeOf = (name: string) => name.match(/(\d+)\.\s*ročník/i)?.[1] ?? name;
/** Podle ročníku (6. první), v rámci ročníku podle `poradi` (1. díl před 2.). */
const byGrade = (a: any, b: any) =>
  (Number(gradeOf(String(a.name || ''))) || 99) - (Number(gradeOf(String(b.name || ''))) || 99) || byOrder(a, b);

const partOf = (name: string) => Number(name.match(/(\d+)\.\s*díl/i)?.[1]) || 99;

/** Až tři díly jedné řady: podle čísla dílu (bez dílu, např. čáranka, až za nimi), pak podle `poradi`. */
function pickParts(books: any[]): Cover[] {
  return [...books]
    .sort((a, b) => partOf(String(a.name || '')) - partOf(String(b.name || '')) || byOrder(a, b))
    .slice(0, 3)
    .map((b) => ({ name: b.name, image: b.image }));
}

/** Obálky různých ročníků (až tři): z každého ročníku první díl, pak vybrané podle `coverGrades`. */
function pickCovers(books: any[], order: number[] = [0, 1, 2]): Cover[] {
  const perGrade = new Map<string, any>();
  [...books].sort(byGrade).forEach((b) => {
    const g = gradeOf(String(b.name || ''));
    if (!perGrade.has(g)) perGrade.set(g, b);
  });
  const list = [...perGrade.values()];
  if (list.length === 0) return [];
  const picked = [...new Set(order.map((i) => list[i % list.length]))];
  return picked.map((b) => ({ name: b.name, image: b.image }));
}

export function SeriesCards({
  mainGroup,
  books,
  digitalProduct,
  navigate,
}: {
  mainGroup: string;
  books: any[];
  /** Online produkt předmětu (digitální učebnice); bez obrázku se karta digitální učebnice nezobrazí. */
  digitalProduct?: { name?: string; image?: string };
  navigate: (path: string) => void;
}) {
  const subjectPath = `/predmet/${subjectToSlug(mainGroup)}`;
  const cards = (SERIES_BY_GROUP[mainGroup] ?? []).map((s) => ({
    ...s,
    covers: s.digital
      ? (digitalProduct?.image ? [{ name: digitalProduct.name || s.title, image: digitalProduct.image }] : [])
      : s.staticCovers ?? (() => {
        const own = books.filter((b) => b.image && s.match?.(String(b.name || '').toLowerCase()));
        return s.coverParts ? pickParts(own) : pickCovers(own, s.coverGrades);
      })(),
  })).filter((s) => s.covers.length > 0 || s.placeholder);
  /** Na xl karty vedle sebe a na výšku (obálka nahoře, text pod ní); 4 karty níž v mřížce 2×2. */
  const four = cards.length >= 4;
  const stacked = cards.length >= 1;

  const renderCard = (s: (typeof cards)[number]) => {
          const [front] = s.covers;
          const href = s.href
            ? s.href
            : s.typ
            ? `${subjectPath}?typ=${s.typ}`
            : s.rocnik ? `${subjectPath}?rocnik=${s.rocnik}` : subjectPath;
          return (
            <a
              key={s.key}
              href={href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || /^https?:/.test(href)) return;
                e.preventDefault();
                navigate(href);
              }}
              style={{ backgroundColor: s.bg }}
              className={`group/series relative snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto flex items-stretch gap-4 ${stacked ? 'xl:flex-col xl:gap-0' : ''} rounded-[20px] p-4 lg:p-5 min-h-[190px] lg:min-h-[220px] transition-all duration-200 hover:shadow-[0_12px_32px_-12px_rgba(0,17,97,0.25)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#001161]/30 focus-visible:ring-offset-2`}
            >
              <div className={`relative w-[46%] max-w-[180px] shrink-0 self-center aspect-square ${stacked ? 'xl:w-full xl:max-w-[190px] xl:self-center xl:mt-9' : ''}`}>
                {s.digital && front && (
                  <img
                    src={front.image}
                    alt={front.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover/series:-translate-y-1"
                  />
                )}
                {!s.digital && (() => {
                  /* Vějíř: obálky otočené kolem společného bodu dole, první vpředu uprostřed. */
                  const placeholder = s.covers.length === 0;
                  const slots = placeholder ? [null, null, null] : s.covers;
                  const pos = [
                    'z-[3] shadow-lg group-hover/series:-translate-y-1',
                    'z-[1] shadow-md -rotate-[14deg] -translate-x-[18%] group-hover/series:-rotate-[18deg] group-hover/series:-translate-x-[24%]',
                    'z-[2] shadow-md rotate-[14deg] translate-x-[18%] group-hover/series:rotate-[18deg] group-hover/series:translate-x-[24%]',
                  ];
                  const order = slots.length === 2 ? [0, 2] : [0, 1, 2];
                  return slots.map((c, i) => {
                    const cls = `absolute left-[24%] bottom-[14%] w-[52%] origin-bottom rounded-[6px] transition-transform duration-300 ${pos[order[i]]}`;
                    if (c) return <img key={i} src={c.image} alt={i === 0 ? c.name : ''} loading="lazy" className={cls} />;
                    return (
                      <div key={i} className={`${cls} aspect-[210/297] bg-[#001161] ring-1 ring-white/25 flex items-center px-2`}>
                        {i === 0 && (
                          <span className="text-white font-['Fenomen_Sans',sans-serif] font-bold text-[12px] lg:text-[14px] leading-[1.05]">
                            {s.placeholderText ?? s.title}
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={`self-start rounded-full bg-white px-2.5 ${stacked ? 'xl:absolute xl:top-4 xl:left-4 xl:z-10' : ''} py-1 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[11px] lg:text-[12px] font-bold whitespace-nowrap`}>
                  {s.label}
                </span>
                <h3 className={`my-auto py-3 ${stacked ? 'xl:my-0 xl:pt-5 xl:pb-1' : ''} text-[#001161] font-['Fenomen_Sans',sans-serif] font-semibold text-[16px] lg:text-[18px] leading-[1.1]`}>
                  {s.title}
                </h3>
                <p className="text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[13px] lg:text-[14px] leading-snug">
                  {s.description}
                </p>
              </div>
            </a>
          );
  };

  const stripClass = (cols: string) =>
    `flex gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory pb-2 md:pb-0 md:grid md:overflow-visible ${cols}`;

  /* Spojený řádek: nad kartami nadpisy předmětů (Dějepis | Zeměpis), šířka sloupců podle počtu karet. */
  if (cards.some((c) => c.subject)) {
    const blocks: { subject: string; items: typeof cards }[] = [];
    cards.forEach((c) => {
      const last = blocks[blocks.length - 1];
      if (last && last.subject === c.subject) last.items.push(c);
      else blocks.push({ subject: c.subject ?? '', items: [c] });
    });
    const COLS: Record<number, string> = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' };
    const SPAN: Record<number, string> = { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4' };
    return (
      <div className={`mb-5 grid gap-y-4 md:gap-x-5 ${COLS[Math.min(cards.length, 4)]}`}>
        {blocks.map((b) => (
          <div key={b.subject} className={`min-w-0 flex flex-col ${SPAN[b.items.length] ?? ''}`}>
            <h2 className="mb-3 text-[#001161] font-['Cooper_Light',serif] text-[24px] md:text-[34px] xl:text-[41px] leading-tight whitespace-nowrap">
              {b.subject}
            </h2>
            <div className="flex-1 -mx-4 md:mx-0 px-4 md:px-0">
              <div className={`${stripClass(COLS[b.items.length] ?? '')} md:h-full`} style={{ scrollbarWidth: 'none' }}>
                {b.items.map(renderCard)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 mb-5 -mx-4 md:mx-0 px-4 md:px-0">
      <div
        className={stripClass(four ? 'md:grid-cols-2 xl:grid-cols-4' : cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4')}
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map(renderCard)}
      </div>
    </div>
  );
}
