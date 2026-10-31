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
  /** Pozadí karty (zatím jednotná světlá šedá webu; lze dát každé řadě jinou). */
  bg: string;
  /** Řada zatím není v katalogu — ukázat zástupné obálky místo skrytí karty. */
  placeholder?: boolean;
  match?: (lowerName: string) => boolean;
  /** Karta digitální učebnice — obrázek online produktu předmětu (prop `digitalProduct`). */
  digital?: boolean;
  /** Z katalogu: obálky kterých ročníků dát přes sebe (pořadí v seznamu ročníků řady), aby karty nebyly stejné. */
  coverGrades?: [number, number];
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
    coverGrades: [0, 2],
    match: (n) => n.includes('krok za krokem'),
  },
  {
    key: 'pro-vsechny',
    title: 'Pro všechny',
    label: 'Pracovní sešity',
    description: 'Spousta úloh v různých úrovních',
    typ: 'pro-vsechny',
    bg: '#f8f9fc',
    coverGrades: [1, 3],
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
      { name: 'Fyzika 7 · Krok za krokem', image: `${APP_COVERS}/fyzika-kzk-7-19456.png` },
      { name: 'Fyzika 6 · Krok za krokem', image: `${APP_COVERS}/fyzika-kzk-6-19456.png` },
    ],
  },
  {
    key: 'pro-vsechny',
    title: 'Pro všechny',
    label: 'Pracovní sešity',
    description: 'Spousta úloh v různých úrovních',
    bg: '#f8f9fc',
    coverGrades: [3, 1],
    match: (n) => n.includes('pracovní sešit'),
  },
  {
    key: 'moje-fyzika',
    title: 'Moje Fyzika',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    bg: '#f8f9fc',
    staticCovers: [
      { name: 'Fyzika 8 · Učebnice / portfolio', image: `${APP_COVERS}/fyzika-portfolio-8-19456.png` },
      { name: 'Fyzika 6 · Učebnice / portfolio', image: `${APP_COVERS}/fyzika-portfolio-6-19456.png` },
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

/** Skupiny homepage (podle předmětu), které místo pásu sešitů ukazují karty řad. */
export const SERIES_BY_GROUP: Record<string, SeriesDef[]> = {
  'Matematika 2. stupeň': MATH_SERIES,
  Fyzika: PHYSICS_SERIES,
};

const byOrder = (a: any, b: any) => (a.poradi ?? 999) - (b.poradi ?? 999);
const gradeOf = (name: string) => name.match(/(\d+)\.\s*ročník/i)?.[1] ?? name;

/** Dvě obálky různých ročníků: z každého ročníku první díl, pak vybrané podle `coverGrades`. */
function pickCovers(books: any[], [front, back]: [number, number] = [0, 1]): Cover[] {
  const perGrade = new Map<string, any>();
  [...books].sort(byOrder).forEach((b) => {
    const g = gradeOf(String(b.name || ''));
    if (!perGrade.has(g)) perGrade.set(g, b);
  });
  const list = [...perGrade.values()];
  if (list.length === 0) return [];
  const picked = [list[front % list.length], list[back % list.length]];
  return (picked[0] === picked[1] ? [picked[0]] : picked).map((b) => ({ name: b.name, image: b.image }));
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
      : s.staticCovers ?? pickCovers(
      books.filter((b) => b.image && s.match?.(String(b.name || '').toLowerCase())),
      s.coverGrades,
    ),
  })).filter((s) => s.covers.length > 0 || s.placeholder);

  return (
    <div className="mt-3 mb-5 -mx-4 md:mx-0 px-4 md:px-0">
      <div
        className={`flex gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory pb-2 md:pb-0 md:grid md:overflow-visible ${
          cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
        }`}
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map((s) => {
          const [front, back] = s.covers;
          const href = s.typ ? `${subjectPath}?typ=${s.typ}` : subjectPath;
          return (
            <a
              key={s.key}
              href={href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                navigate(href);
              }}
              style={{ backgroundColor: s.bg }}
              className="group/series snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto flex items-stretch gap-4 rounded-[20px] p-4 lg:p-5 min-h-[190px] lg:min-h-[220px] transition-all duration-200 hover:shadow-[0_12px_32px_-12px_rgba(0,17,97,0.25)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#001161]/30 focus-visible:ring-offset-2"
            >
              <div className="relative w-[42%] max-w-[160px] shrink-0 self-center aspect-[3/4]">
                {s.digital && front && (
                  <img
                    src={front.image}
                    alt={front.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover/series:-translate-y-1"
                  />
                )}
                {!front && (
                  <>
                    <div className="absolute left-[14%] top-[2%] w-[78%] aspect-[210/297] rounded-[6px] bg-[#001161] shadow-md transition-transform duration-300 rotate-[8deg] group-hover/series:rotate-[11deg]" />
                    <div className="absolute left-0 bottom-[2%] w-[78%] aspect-[210/297] rounded-[6px] bg-[#001161] shadow-lg ring-1 ring-white/25 transition-transform duration-300 group-hover/series:-translate-y-1 flex items-center px-2">
                      <span className="text-white font-['Fenomen_Sans',sans-serif] font-bold text-[13px] lg:text-[16px] leading-[1.05]">
                        {s.title}
                      </span>
                    </div>
                  </>
                )}
                {back && !s.digital && (
                  <img
                    src={back.image}
                    alt=""
                    loading="lazy"
                    className="absolute left-[14%] top-[2%] w-[78%] rounded-[6px] shadow-md transition-transform duration-300 rotate-[8deg] group-hover/series:rotate-[11deg]"
                  />
                )}
                {front && !s.digital && (
                  <img
                    src={front.image}
                    alt={front.name}
                    loading="lazy"
                    className="absolute left-0 bottom-[2%] w-[78%] rounded-[6px] shadow-lg transition-transform duration-300 group-hover/series:-translate-y-1"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="self-end rounded-full bg-white px-2.5 py-1 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[11px] lg:text-[12px] font-bold whitespace-nowrap">
                  {s.label}
                </span>
                <h3 className="my-auto py-3 text-[#001161] font-['Fenomen_Sans',sans-serif] font-semibold text-[17px] lg:text-[21px] leading-[1.1]">
                  {s.title}
                </h3>
                <p className="text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[14px] lg:text-[15px] leading-snug">
                  {s.description}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
