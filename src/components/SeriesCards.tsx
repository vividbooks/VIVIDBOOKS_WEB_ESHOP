import React from 'react';
import { useLocation } from 'react-router';
import { productDetailPath, subjectToSlug } from '../utils/slugify';
import { TEST_HOMEPAGE_PATH } from '../config/testHomepage';
import { useProducts } from '../contexts/ProductsContext';
import { CLOVEK_A_JEHO_SVET, catalogGroupMembers } from '../utils/catalogGroups';

/**
 * Homepage (zatím jen testovací kopie, TEST_HOMEPAGE_PATH): místo pásu sešitů předmětu tři velké karty řad.
 * Obálky bere z reálných produktů dané řady — na testovací verzi včetně neveřejných (`unpublished`).
 * Řada bez obálek se nezobrazí, pokud nemá `placeholder` (pak místo obálek modré sešity s názvem řady).
 */

type Cover = { name: string; image: string; product?: any };

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
  /** Ve spojeném řádku (APP_ONLY_GROUPS): předmět, jehož nadpis stojí nad kartou. Web pro něj nemá stránku
   * předmětu, takže karta vede na detail prvního sešitu řady (bez sešitu na `href`). */
  subject?: string;
  match?: (lowerName: string) => boolean;
  /** Karta digitální učebnice — obrázek online produktu předmětu (prop `digitalProduct`). */
  digital?: boolean;
  /** Z katalogu: obálky kterých ročníků dát přes sebe (pořadí v seznamu ročníků řady; první je vpředu), aby karty nebyly stejné. */
  coverGrades?: number[];
  /** Text rozklikávacího „Více o řadě …“ na stránce předmětu; bez něj zástupný [TEXT] (texty nevymýšlet). */
  about?: string;
};

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
    // Skill vividbooks + popisek řady na živé stránce předmětu.
    about: 'Pro učitele, kteří nechají žáky samostatně objevovat. Vede žáky k vlastnímu objevování a procvičení učiva, v sešitě je víc volného místa na řešení.',
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
    about: 'Hodně procvičování a diferenciace: úlohy ve 3 úrovních obtížnosti (zelená, oranžová, červená) a rozsáhlá online aplikace s tisíci úlohami. Díky pestrým úlohám různé obtížnosti vede k důkladnému pochopení. Obě řady lze kombinovat.',
  },
  {
    key: 'moje-matematika',
    title: 'Moje Matematika',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    typ: 'moje-matematika',
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
    about: 'Tisíce příkladů v různých obtížnostech, soutěže a interaktivní pracovní listy. Zdarma od 15 ks sešitů. Lze zakoupit i samostatně bez sešitů.',
  },
];

const PHYSICS_SERIES: SeriesDef[] = [
  {
    key: 'krok',
    title: 'Krok za krokem',
    label: 'Pracovní sešity',
    description: 'Žáci objevují fyzikální jevy',
    typ: 'krok',
    bg: '#f8f9fc',
    match: (n) => n.includes('krok za krokem'),
  },
  {
    key: 'pro-vsechny',
    title: 'Pro všechny',
    label: 'Pracovní sešity',
    description: 'Spousta úloh v různých úrovních',
    typ: 'pro-vsechny',
    bg: '#f8f9fc',
    coverGrades: [0, 1, 2],
    match: (n) => n.includes('pracovní sešit') && !n.includes('krok za krokem'),
  },
  {
    key: 'moje-fyzika',
    title: 'Moje Fyzika',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    typ: 'moje-fyzika',
    bg: '#f8f9fc',
    match: (n) => n.includes('moje fyzika'),
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

const BIOLOGY_SERIES: SeriesDef[] = [
  {
    key: 'sesity',
    title: 'Pracovní sešity',
    label: '6.–9. ročník',
    description: 'Sešit ke každému ročníku',
    typ: 'sesity',
    bg: '#f8f9fc',
    coverGrades: [0, 1, 2],
    match: (n) => n.includes('pracovní sešit'),
  },
  {
    key: 'muj-prirodopis',
    title: 'Můj Přírodopis',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    typ: 'muj-prirodopis',
    bg: '#f8f9fc',
    match: (n) => n.includes('můj přírodopis'),
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

const CHEMISTRY_SERIES: SeriesDef[] = [
  {
    key: 'sesity',
    title: 'Pracovní sešity',
    label: '8.–9. ročník',
    description: 'Sešit ke každému ročníku',
    typ: 'sesity',
    bg: '#f8f9fc',
    coverGrades: [0, 1],
    match: (n) => n.includes('pracovní sešit'),
  },
  {
    key: 'rvp-2025',
    title: 'Chemie podle RVP 2025',
    label: 'Učebnice',
    description: 'Nová učebnice pro 8. a 9. ročník',
    typ: 'rvp-2025',
    bg: '#f8f9fc',
    match: (n) => n.includes('rvp 2025'),
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

/** Dějepis a zeměpis: na webu zatím jen neveřejné sešity; testovací stránky předmětů je ukazují. */
const HISTORY_SERIES: SeriesDef[] = [
  {
    key: 'dejepis-krok',
    title: 'Krok za krokem',
    label: 'Pracovní sešity',
    description: 'Sešit pro 6., 7., 8. a 9. ročník',
    typ: 'krok',
    bg: '#f8f9fc',
    match: (n) => n.includes('dějepis') && n.includes('krok za krokem'),
  },
  {
    key: 'muj-dejepis',
    title: 'Můj Dějepis',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    typ: 'muj-dejepis',
    bg: '#f8f9fc',
    // 6. ročník má zatím jen zástupnou obálku — dopředu skutečné obálky 7.–9. ročníku.
    coverGrades: [1, 2, 3],
    placeholder: true,
    match: (n) => n.includes('můj dějepis'),
  },
];

const GEO_SERIES: SeriesDef[] = [
  {
    key: 'zemepis-sesity',
    title: 'Zeměpis obecný nebo regionální',
    label: 'Pracovní sešity',
    description: 'Dva typy sešitů podle zaměření výuky',
    typ: 'sesity',
    bg: '#f8f9fc',
    placeholder: true,
    placeholderText: 'Zeměpis',
    match: (n) => n.includes('zeměpis obecný') || n.includes('zeměpis regionální'),
  },
  {
    key: 'muj-zemepis',
    title: 'Můj Zeměpis',
    label: 'Učebnice / portfolio',
    description: 'Učební text s vlastním prostorem',
    typ: 'muj-zemepis',
    bg: '#f8f9fc',
    placeholder: true,
    match: (n) => n.includes('můj zeměpis'),
  },
];

/** Homepage: dějepis a zeměpis v jednom řádku, karty vedou na testovací stránku svého předmětu. */
const HISTORY_GEO_SERIES: SeriesDef[] = [
  ...HISTORY_SERIES.map((x) => ({ ...x, subject: 'Dějepis' })),
  ...GEO_SERIES.map((x) => ({ ...x, subject: 'Zeměpis' })),
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
  typ: 'digital',
  bg: '#f8f9fc',
  digital: true,
};

const APP_LIBRARY = 'https://nove.vividbooks.com/knihovna';

/** Sešit předmětu bez stránky na webu: obálka a proklik ze sešitu, bez něj zástupná obálka a knihovna aplikace. */
const appOnlyCard = (key: string, title: string, label: string, description: string, href: string, placeholderText: string, match: (n: string) => boolean): SeriesDef => ({
  key,
  title,
  label,
  description,
  bg: '#f8f9fc',
  placeholder: true,
  placeholderText,
  href,
  match,
});

const MATH1_SERIES: SeriesDef[] = [
  gradeCard(1, 'Tři díly a Početníček'),
  gradeCard(2, 'Tři díly a Početníček'),
  gradeCard(3, 'Tři díly'),
  DIGITAL_CARD,
];

const CJS_HREF = `${APP_LIBRARY}/stupen-1/clovek-a-jeho-svet`;
/** 4. ročník Člověka a jeho světa (vlastivěda, přírodověda) a informatika; zatím jen 4. ročník (5. je v aplikaci taky). */
const VLASTIVEDA_4_CARD: SeriesDef = { ...appOnlyCard('vlastiveda-4', '4. ročník', 'Vlastivěda', 'Vlastivěda pro 4. ročník', CJS_HREF, 'Vlastivěda 4', (n) => n.startsWith('vlastivěda')), href: undefined, rocnik: '4' };
const PRIRODOVEDA_4_CARD: SeriesDef = { ...appOnlyCard('prirodoveda-4', '4. ročník', 'Přírodověda', 'Přírodověda pro 4. ročník', CJS_HREF, 'Přírodověda 4', (n) => n.startsWith('přírodověda')), href: undefined, rocnik: '4' };
const INFORMATIKA_SERIES: SeriesDef[] = [
  { ...appOnlyCard('informatika-4', '4. ročník', 'Pracovní sešit', 'Informatika pro 4. ročník', `${APP_LIBRARY}/stupen-1/informatika`, 'Informatika 4', (n) => n.startsWith('informatika')), href: undefined, rocnik: '4' },
];

const PRVOUKA_SERIES: SeriesDef[] = [
  gradeCard(1, 'Pracovní sešit ve dvou dílech'),
  gradeCard(2, 'Pracovní sešit ve dvou dílech'),
  gradeCard(3, 'Pracovní sešit, 1. díl'),
  DIGITAL_CARD,
];

/** Člověk a jeho svět: Prvouka 1.–3. ročník, Vlastivěda a Přírodověda 4. ročník, digitální učebnice Prvouky. */
const CLOVEK_SERIES: SeriesDef[] = [
  { ...gradeCard(1, 'Prvouka, pracovní sešit ve dvou dílech'), label: 'Prvouka' },
  { ...gradeCard(2, 'Prvouka, pracovní sešit ve dvou dílech'), label: 'Prvouka' },
  { ...gradeCard(3, 'Prvouka, pracovní sešit ve dvou dílech'), label: 'Prvouka' },
  DIGITAL_CARD,
  // Vlastivěda a přírodověda (4. ročník) vedle sebe na samostatném řádku.
  VLASTIVEDA_4_CARD,
  PRIRODOVEDA_4_CARD,
];

const CZECH_SERIES: SeriesDef[] = [
  {
    key: 'pisanky',
    title: 'Písanky',
    label: 'Vázané i nevázané písmo',
    description: 'Písanky ve třech dílech a čáranky',
    typ: 'pisanky',
    bg: '#f8f9fc',
    coverParts: true,
    match: (n) => n.includes('pro vázané písmo') || n.includes('pro nevázané písmo'),
  },
  {
    key: 'slabikare',
    title: 'Slabikáře',
    label: 'Čtení',
    description: 'Slabikář ve třech dílech',
    typ: 'slabikare',
    bg: '#f8f9fc',
    coverParts: true,
    match: (n) => n.includes('slabikář'),
  },
  {
    key: 'ctenarska-gramotnost',
    title: 'Čtenářská gramotnost',
    label: 'Sešity',
    description: 'První čtení, Čteme o vlastivědě, o přírodovědě a o informatice',
    typ: 'ctenarska-gramotnost',
    bg: '#f8f9fc',
    placeholder: true,
    placeholderText: 'První čtení',
    match: (n) => n.includes('první čtení') || n.includes('čteme o'),
  },
  DIGITAL_CARD,
];

/**
 * Řádky z předmětů, které na webu nemají stránku předmětu: na testovací homepage se přidají za `after`
 * a sešity kategorií `categories` (zatím neveřejné) se do nich sloučí; tlačítko celého předmětu chybí.
 */
export const APP_ONLY_GROUPS: { group: string; after: string; stupen: 1 | 2; categories: string[]; /** Řádek má vlastní nadpis a stránku předmětu (ne nadpisy v kartách). */ ownPage?: boolean }[] = [
  { group: 'Dějepis a zeměpis', after: 'Přírodopis', stupen: 2, categories: ['Dějepis', 'Zeměpis'] },
  { group: 'Informatika', after: CLOVEK_A_JEHO_SVET, stupen: 1, categories: ['Informatika'], ownPage: true },
];

/** Produkt v testovací variantě: ukázat i neveřejné (připravené) sešity; levácké a jinak skryté ne. */
export const isTestCatalogVisible = (p: any) =>
  (!p.hideFromCatalog || p.unpublished === true) && p.handedness !== 'left';

const seriesOfBook = (group: string, p: any): SeriesDef | undefined => {
  const name = String(p.name || '').toLowerCase();
  return (SERIES_BY_GROUP[group] ?? []).find((s) =>
    s.typ && (s.digital ? p.type === 'online' : p.type !== 'online' && !!s.match?.(name)));
};

/** Filtr `?typ=` testovací stránky předmětu podle karty řady; bez platné řady `null`. */
export function seriesBookFilter(group: string, typ: string | null): ((p: any) => boolean) | null {
  if (!typ || !(SERIES_BY_GROUP[group] ?? []).some((s) => s.typ === typ)) return null;
  return (p) => seriesOfBook(group, p)?.typ === typ;
}

/** Bez filtru řady: sešity v blocích podle řad (pořadí karet), nezařazené na konec; `null` u předmětů po ročnících. */
export function seriesBookBlocks(group: string, books: any[]): { key: string; title: string; books: any[] }[] | null {
  const series = (SERIES_BY_GROUP[group] ?? []).filter((s) => s.typ);
  if (series.filter((s) => !s.digital).length < 2) return null;
  const blocks = series.map((s) => ({
    key: s.key,
    title: s.digital ? 'Digitální přístup' : s.title,
    books: books.filter((p) => seriesOfBook(group, p) === s),
  }));
  const rest = books.filter((p) => !seriesOfBook(group, p));
  return [...blocks, { key: 'dalsi', title: 'Další tituly', books: rest }].filter((b) => b.books.length > 0);
}

/** Skupiny homepage (podle předmětu), které místo pásu sešitů ukazují karty řad. */
export const SERIES_BY_GROUP: Record<string, SeriesDef[]> = {
  'Matematika 2. stupeň': MATH_SERIES,
  Fyzika: PHYSICS_SERIES,
  Přírodopis: BIOLOGY_SERIES,
  Chemie: CHEMISTRY_SERIES,
  'Dějepis a zeměpis': HISTORY_GEO_SERIES,
  Dějepis: HISTORY_SERIES,
  Zeměpis: GEO_SERIES,
  'Matematika 1. stupeň': MATH1_SERIES,
  Prvouka: PRVOUKA_SERIES,
  'Český jazyk': CZECH_SERIES,
  [CLOVEK_A_JEHO_SVET]: CLOVEK_SERIES,
  Informatika: INFORMATIKA_SERIES,
};

/** Obálky témat digitální učebnice z aplikace (knihovna nove.vividbooks.com) — pro návrhy náhledu digitální učebnice. */
const APP_ASSETS = 'https://qypiuvqglsmxdsnyazih.supabase.co/storage/v1/object/public/platform-admin/files/assets/';
const DIGITAL_TOPICS: Record<string, Cover[]> = {
  Fyzika: [
    { name: 'Základy', image: `${APP_ASSETS}56445062-fb40-431a-b971-78c9167bbbdb-book-ae196c64-2124-4951-9b09-279dbea1b387-ae196c64-2124-4951-9b09-279dbea1b387/image/694d5ba44611ad23cba1db1a88dac0a49e99eaf6.jpg` },
    { name: 'Síly', image: `${APP_ASSETS}56445062-fb40-431a-b971-78c9167bbbdb-book-4b7cba6d-1dcf-4e74-aecd-92e9d4b69ea2-4b7cba6d-1dcf-4e74-aecd-92e9d4b69ea2/image/edfc05ce3ae2d7b84f8c5d9344c0ea22f8e98750.png` },
    { name: 'Kapaliny a plyny', image: `${APP_ASSETS}56445062-fb40-431a-b971-78c9167bbbdb-book-11-8a5f2956-ed92-4dea-b3fa-3754cef76d8a/image/7c696505e7652e5fb624dacb5d10c8a634c5e334.jpg` },
    { name: 'Optika', image: `${APP_ASSETS}56445062-fb40-431a-b971-78c9167bbbdb-book-6985106b-2525-43ef-8bea-dc59ff7c5156-6985106b-2525-43ef-8bea-dc59ff7c5156/image/166d06f23f949113ba94a742e9d8ec7ceaab6b3c.png` },
    { name: 'Energie', image: `${APP_ASSETS}56445062-fb40-431a-b971-78c9167bbbdb-book-1e01327f-17f2-40ca-86ed-be522a801ef3-1e01327f-17f2-40ca-86ed-be522a801ef3/image/a7e8d198aeaff00a2fcffbe714479e00e44d8a06.png` },
    { name: 'Akustika', image: `${APP_ASSETS}56445062-fb40-431a-b971-78c9167bbbdb-book-0256c342-a33e-4451-ad8b-5ae9dd94d401-0256c342-a33e-4451-ad8b-5ae9dd94d401/image/4f64b9f4bef72e1e9220c9aa5fb445c27b17b011.png` },
  ],
  'Přírodopis': [
    { name: 'Vznik života', image: `${APP_ASSETS}87d4d9a7-b620-4c44-9f9a-b3315086aabe-book-107-ba259038-719a-443a-a973-6a228893d4d8/image/3badc55e5a140b3540dd9799990278d9ccd8ce17.jpg` },
    { name: 'Bezobratlí živočichové', image: `${APP_ASSETS}87d4d9a7-b620-4c44-9f9a-b3315086aabe-book-6d9d8ce2-460e-43b8-a4be-16fe14cf0816-6d9d8ce2-460e-43b8-a4be-16fe14cf0816/image/d84b777b8ad1cb8e886bc44f60766475628c4159.jpg` },
    { name: 'Obratlovci', image: `${APP_ASSETS}87d4d9a7-b620-4c44-9f9a-b3315086aabe-book-8aaf292b-8c75-43f9-a8f7-f82609fc01be-8aaf292b-8c75-43f9-a8f7-f82609fc01be/image/38c447f3b44444bd4bd60a49ca5d692aeb0d6fc8.jpg` },
    { name: 'Houby a vyšší rostliny', image: `${APP_ASSETS}87d4d9a7-b620-4c44-9f9a-b3315086aabe-book-110-2348614c-7abd-42c1-946a-05b2f91da8b2/image/5091925419293a9fee046406bc8855c603becd2b.jpg` },
    { name: 'Člověk', image: `${APP_ASSETS}87d4d9a7-b620-4c44-9f9a-b3315086aabe-book-eb616f84-b40a-48dd-8aa8-098b557fa3bd-eb616f84-b40a-48dd-8aa8-098b557fa3bd/image/f9d71ff80c2f4de1086e8b98574182f8c30306e6.png` },
    { name: 'Geologie', image: `${APP_ASSETS}87d4d9a7-b620-4c44-9f9a-b3315086aabe-book-5288b72e-0145-4dae-b2d4-3a8490c11639-5288b72e-0145-4dae-b2d4-3a8490c11639/image/db137bb646599261dc0320d9f5048b2336f69c80.jpg` },
  ],
  Chemie: [
    { name: 'Chemie a bezpečnost', image: `${APP_ASSETS}48d19b2f-442d-4816-ae2b-a3ca6910ee8e-book-100-d9d44eb8-7c8c-44be-aa17-30ef39340d53/image/e82a893a4651b3d11c439d505348620172b2cf7c.png` },
    { name: 'Chemické látky a směsi', image: `${APP_ASSETS}48d19b2f-442d-4816-ae2b-a3ca6910ee8e-book-82-c044f1e8-6fc2-459f-83e5-225ffae73987/image/2daa1873bec0d581bd5c6905e049172324fea112.png` },
    { name: 'Atomy a prvky', image: `${APP_ASSETS}48d19b2f-442d-4816-ae2b-a3ca6910ee8e-book-73-f9014f55-63a1-4c71-911c-155cacc2e213/image/f10bdfb5ad270ba7c16273bab0ff8fd997d3e2ae.png` },
    { name: 'Chemická vazba', image: `${APP_ASSETS}48d19b2f-442d-4816-ae2b-a3ca6910ee8e-book-75b66a7c-90c8-49ff-bb20-2745db19c114-75b66a7c-90c8-49ff-bb20-2745db19c114/image/bb25d2d2d9b30538677837aa0f2e2467d66cde63.png` },
    { name: 'Chemické reakce', image: `${APP_ASSETS}48d19b2f-442d-4816-ae2b-a3ca6910ee8e-book-59c5badf-42c6-4e9f-98b1-b9a0e72cacc0-59c5badf-42c6-4e9f-98b1-b9a0e72cacc0/image/11d8c29c48f4273cede18cf5fbcdb16dcec21c31.png` },
    { name: 'Anorganické sloučeniny', image: `${APP_ASSETS}48d19b2f-442d-4816-ae2b-a3ca6910ee8e-book-9a908be8-f99a-470a-b507-e1366d279029-9a908be8-f99a-470a-b507-e1366d279029/image/57705e740a7154c5f8c96e988daad3b35965275b.jpg` },
  ],
};

/** Dlaždice ročníků jako v knihovně aplikace (matematika a 1. stupeň nemají obálky témat). */
const DIGITAL_GRADES: Record<string, string[]> = {
  'Matematika 2. stupeň': ['6₁', '6₂', '7₁', '7₂', '8₁', '8₂', '9₁', '9₂'],
  Fyzika: ['6', '7', '8', '9'],
  'Přírodopis': ['6', '7', '8', '9'],
  Chemie: ['8', '9'],
  'Matematika 1. stupeň': ['1₁', '1₂', '1₃', '2₁', '2₂', '2₃'],
  'Český jazyk': ['1', '2', '3', '4', '5'],
  Prvouka: ['1', '2', '3'],
};
/** Pastelové barvy dlaždic — z palety štítků předmětů (CATEGORY_BG v UnifiedBookCard). */
const TILE_BG = ['#EEEAFF', '#E2F8FF', '#E8F9EE', '#FFF8E0', '#FFF2EC', '#FEF1F1'];

/**
 * Návrhy náhledu karty digitální učebnice (jen testovací homepage, `?dig=1`–`5`; bez parametru produktový obrázek).
 * 1 vějíř obálek témat · 2 tablet s knihovnou témat · 3 okno prohlížeče · 4 dlaždice ročníků · 5 sešit + tablet.
 */
function DigitalPreview({ variant, group, product, workbook, eager = false }: {
  variant: number;
  /** Kompaktní dlaždice (stránka předmětu): načíst hned — líné načítání ve vodorovném pásu na mobilu nenaběhne. */
  eager?: boolean;
  group: string;
  product?: Cover;
  workbook?: Cover;
}) {
  const topics = DIGITAL_TOPICS[group] ?? [];
  const grades = DIGITAL_GRADES[group] ?? [];
  // Bez obálek témat (matematika, 1. stupeň) padají návrhy 1–3 na dlaždice ročníků.
  const v = variant >= 1 && variant <= 3 && topics.length < 3 ? 4 : variant;
  const imgCls = 'absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover/series:-translate-y-1';

  if (v === 1) {
    const pos = [
      'z-[3] shadow-lg group-hover/series:-translate-y-1',
      'z-[1] shadow-md -rotate-[14deg] -translate-x-[18%] group-hover/series:-rotate-[18deg] group-hover/series:-translate-x-[24%]',
      'z-[2] shadow-md rotate-[14deg] translate-x-[18%] group-hover/series:rotate-[18deg] group-hover/series:translate-x-[24%]',
    ];
    return (
      <>
        {topics.slice(0, 3).map((c, i) => (
          <img key={c.image} src={c.image} alt={i === 0 ? c.name : ''} loading={eager ? 'eager' : 'lazy'}
            className={`absolute left-[24%] bottom-[14%] w-[52%] origin-bottom rounded-[6px] transition-transform duration-300 ${pos[i]}`} />
        ))}
      </>
    );
  }
  if (v === 2) {
    return (
      <div className="absolute inset-x-[2%] top-[16%] -rotate-[4deg] rounded-[12px] bg-[#001161] p-[4%] shadow-lg transition-transform duration-300 group-hover/series:rotate-0">
        <div className="grid grid-cols-3 gap-[4%] rounded-[6px] bg-white p-[5%]">
          {topics.slice(0, 6).map((c) => (
            <img key={c.image} src={c.image} alt="" loading={eager ? 'eager' : 'lazy'} className="aspect-[570/808] w-full rounded-[3px] object-cover" />
          ))}
        </div>
      </div>
    );
  }
  if (v === 3) {
    return (
      <div className="absolute inset-x-0 top-[18%] overflow-hidden rounded-[10px] bg-white shadow-lg ring-1 ring-[#001161]/10 transition-transform duration-300 group-hover/series:-translate-y-1">
        <div className="flex items-center gap-[3%] bg-[#F0F2F8] px-[5%] py-[3%]">
          {[0, 1, 2].map((i) => <span key={i} className="size-[6px] rounded-full bg-[#001161]/25" />)}
          <span className="ml-[3%] truncate rounded-full bg-white px-2 text-[9px] text-[#001161]/60 font-['Fenomen_Sans',sans-serif]">nove.vividbooks.com</span>
        </div>
        <div className="grid grid-cols-3 gap-[5%] p-[6%]">
          {topics.slice(0, 3).map((c) => (
            <div key={c.image} className="min-w-0">
              <img src={c.image} alt="" loading={eager ? 'eager' : 'lazy'} className="aspect-[570/808] w-full rounded-[3px] object-cover shadow-sm" />
              <p className="mt-1 truncate text-center text-[8px] text-[#001161]/70 font-['Fenomen_Sans',sans-serif]">{c.name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (v === 4 && grades.length > 0) {
    const cols = grades.length > 6 ? 'grid-cols-4' : grades.length > 4 ? 'grid-cols-3' : 'grid-cols-2';
    return (
      <div className={`absolute top-[10%] rounded-[14px] bg-white p-[7%] shadow-lg ring-1 ring-[#001161]/5 transition-transform duration-300 group-hover/series:-translate-y-1 ${grades.length <= 4 ? 'inset-x-[16%]' : 'inset-x-0'}`}>
        <div className={`grid ${cols} gap-[8%]`}>
          {grades.map((g, i) => (
            <span key={g} style={{ backgroundColor: TILE_BG[i % TILE_BG.length] }}
              className="flex aspect-square items-center justify-center rounded-[8px] text-[#001161] font-['Fenomen_Sans',sans-serif] font-bold text-[15px] lg:text-[17px]">
              {g}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (v === 5 && workbook && product) {
    return (
      <>
        <img src={workbook.image} alt="" loading={eager ? 'eager' : 'lazy'}
          className="absolute left-[6%] top-[8%] w-[46%] -rotate-[8deg] rounded-[6px] shadow-md transition-transform duration-300 group-hover/series:-rotate-[12deg]" />
        <img src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'}
          className="absolute right-0 bottom-[2%] w-[80%] object-contain transition-transform duration-300 group-hover/series:-translate-y-1" />
      </>
    );
  }
  return product ? <img src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'} className={imgCls} /> : null;
}

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
    .map((b) => ({ name: b.name, image: b.image, product: b }));
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
  return picked.map((b) => ({ name: b.name, image: b.image, product: b }));
}

export function SeriesCards({
  mainGroup,
  books,
  digitalProduct,
  navigate,
  compact = false,
}: {
  mainGroup: string;
  books: any[];
  /** Online produkt předmětu (digitální učebnice); bez obrázku se karta digitální učebnice nezobrazí. */
  digitalProduct?: { name?: string; image?: string };
  navigate: (path: string) => void;
  /** Nízké karty naležato (stránka předmětu) — víc místa pro produkty pod nimi. */
  compact?: boolean;
}) {
  /** Karty jsou jen na testovací verzi — vedou na testovací stránku předmětu (s dlaždicemi řad nahoře). */
  const subjectPath = `${TEST_HOMEPAGE_PATH}/predmet/${subjectToSlug(catalogGroupMembers(mainGroup)[0])}`;
  const location = useLocation();
  const { products } = useProducts();
  /** Návrh náhledu digitální učebnice: `?dig=1`–`5` (jen pro srovnání variant). */
  const digVariant = Number(new URLSearchParams(location.search).get('dig')) || 0;
  /** Na stránce předmětu je karta aktivní, když její filtr odpovídá adrese. */
  const isActiveHref = (href: string) => {
    const [path, query] = href.split('?');
    if (!query || path !== location.pathname) return false;
    const current = new URLSearchParams(location.search);
    return [...new URLSearchParams(query)].every(([k, v]) => current.get(k) === v);
  };
  /** Rozbalený popis řady („Více o řadě …“) na stránce předmětu. */
  const [aboutKey, setAboutKey] = React.useState<string | null>(null);
  const toggleAbout = (key: string) => setAboutKey((k) => (k === key ? null : key));
  const aboutLabel = (s: SeriesDef) => (s.digital ? 'Více o digitální učebnici' : `Více o řadě ${s.title}`);
  const workbookCover = pickCovers(books.filter((b) => b.image), [0])[0];
  const cards = (SERIES_BY_GROUP[mainGroup] ?? []).map((s) => ({
    ...s,
    covers: s.digital
      ? (digitalProduct?.image ? [{ name: digitalProduct.name || s.title, image: digitalProduct.image }] : [])
      : (() => {
        const own = books.filter((b) => b.image && s.match?.(String(b.name || '').toLowerCase()));
        return s.coverParts ? pickParts(own) : pickCovers(own, s.coverGrades);
      })(),
  })).filter((s) => s.covers.length > 0 || s.placeholder);
  /** Na xl karty vedle sebe a na výšku (obálka nahoře, text pod ní); 4 karty níž v mřížce 2×2. */
  const four = cards.length >= 4;
  const stacked = !compact && cards.length >= 1;

  const renderCard = (s: (typeof cards)[number]) => {
          const [front] = s.covers;
          // Karta ze spojeného řádku: stránka svého předmětu, pokud ji test má, jinak detail sešitu.
          const ownPage = s.subject && SERIES_BY_GROUP[s.subject];
          const cardPath = ownPage ? `${TEST_HOMEPAGE_PATH}/predmet/${subjectToSlug(s.subject!)}` : subjectPath;
          const filterHref = s.subject && !ownPage && front?.product
            ? productDetailPath(front.product, products)
            : s.href
            ? s.href
            : s.typ
            ? `${cardPath}?typ=${s.typ}`
            : s.rocnik ? `${cardPath}?rocnik=${s.rocnik}` : cardPath;
          const active = isActiveHref(filterHref);
          // Na stránce předmětu: přepnutí řady zachová vybraný ročník; druhý klik na aktivní kartu řadu zruší.
          const keptRocnik = !s.href && !s.rocnik && location.pathname === subjectPath
            ? new URLSearchParams(location.search).get('rocnik')
            : null;
          const withRocnik = (url: string) =>
            keptRocnik ? `${url}${url.includes('?') ? '&' : '?'}rocnik=${keptRocnik}` : url;
          const href = withRocnik(active ? subjectPath : filterHref);
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
              aria-current={active ? 'page' : undefined}
              ref={active ? (el) => {
                // Na mobilu (vodorovný pás) posunout pás na vybranou dlaždici.
                const strip = el?.parentElement;
                if (el && strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = el.offsetLeft - strip.offsetLeft;
              } : undefined}
              className={`group/series relative ${active ? 'ring-2 ring-inset ring-[#001161]' : ''} snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto flex items-stretch gap-4 ${stacked ? 'xl:flex-col xl:gap-0' : ''} rounded-[20px] ${compact ? 'p-3 lg:p-3.5 min-h-[120px]' : 'p-4 lg:p-5 min-h-[190px] lg:min-h-[220px]'} transition-all duration-200 hover:shadow-[0_12px_32px_-12px_rgba(0,17,97,0.25)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#001161]/30 focus-visible:ring-offset-2`}
            >
              <div className={`relative shrink-0 self-center aspect-square ${compact ? 'w-[40%] max-w-[124px] mr-3' : 'w-[46%] max-w-[180px]'} ${stacked ? 'xl:w-full xl:max-w-[190px] xl:self-center xl:mt-9' : ''}`}>
                {s.digital && front && (
                  <DigitalPreview variant={digVariant} group={mainGroup} product={front} workbook={workbookCover} eager={compact} />
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
                    if (c) return <img key={i} src={c.image} alt={i === 0 ? c.name : ''} loading={compact ? 'eager' : 'lazy'} className={cls} />;
                    return (
                      <div key={i} className={`${cls} aspect-[210/297] bg-[#001161] ring-1 ring-white/25 flex items-center px-2`}>
                        {i === 0 && (
                          <span className={`text-white font-['Fenomen_Sans',sans-serif] font-bold leading-[1.05] ${compact ? 'text-[9px]' : 'text-[12px] lg:text-[14px]'}`}>
                            {s.placeholderText ?? s.title}
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Štítek nesmí přetéct z úzké karty: max. šířka sloupce, delší text se zalomí. */}
                <span className={`self-start max-w-full rounded-[12px] bg-white px-2.5 ${stacked ? 'xl:absolute xl:top-4 xl:left-4 xl:z-10 xl:max-w-[calc(100%-2rem)]' : ''} py-1 text-[#001161]/70 font-['Fenomen_Sans',sans-serif] text-[11px] lg:text-[12px] font-bold leading-tight`}>
                  {s.label}
                </span>
                <h3 className={`${compact ? 'mt-auto pt-2 pb-0.5 !text-[15px]' : 'my-auto py-3'} ${stacked ? 'xl:my-0 xl:pt-5 xl:pb-1' : ''} text-[#001161] font-['Fenomen_Sans',sans-serif] font-semibold text-[16px] lg:text-[18px] leading-[1.1]`}>
                  {s.title}
                </h3>
                {compact && !s.rocnik ? (
                  // Stránka předmětu: místo popisku jen rozklikávací „Více o řadě …“ (text pod dlaždicemi).
                  <span
                    role="button"
                    tabIndex={0}
                    aria-expanded={aboutKey === s.key}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleAbout(s.key); }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault(); e.stopPropagation(); toggleAbout(s.key);
                    }}
                    className="self-start inline-flex items-center gap-1 text-[#001161]/70 hover:text-[#001161] font-['Fenomen_Sans',sans-serif] text-[12px] lg:text-[12.5px] leading-snug underline decoration-[#001161]/30 underline-offset-[3px] cursor-pointer"
                  >
                    {aboutLabel(s)}
                    <svg className={`w-3 h-3 shrink-0 transition-transform ${aboutKey === s.key ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                ) : (
                  <p className={`text-[#001161]/70 font-['Fenomen_Sans',sans-serif] leading-snug ${compact ? 'text-[12px] lg:text-[12.5px]' : 'text-[13px] lg:text-[14px]'}`}>
                    {s.description}
                  </p>
                )}
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
      <div className={`mb-5 grid gap-y-4 md:gap-x-5 ${cards.length === 1 ? 'md:grid-cols-2 xl:grid-cols-4' : COLS[Math.min(cards.length, 4)]}`}>
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
    <div className={`${compact ? 'mb-2' : 'mt-3 mb-5'} -mx-4 md:mx-0 px-4 md:px-0`}>
      <div
        className={stripClass(four || compact ? 'md:grid-cols-2 xl:grid-cols-4' : cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4')}
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map(renderCard)}
      </div>
      {compact && (() => {
        const open = cards.find((c) => c.key === aboutKey);
        if (!open) return null;
        return (
          <div className="mt-3 rounded-[14px] bg-[#f8f9fc] px-4 py-3 font-['Fenomen_Sans',sans-serif] text-[#001161]">
            <p className="text-[14px] font-semibold">{aboutLabel(open)}</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[#001161]/75">{open.about ?? '[TEXT]'}</p>
          </div>
        );
      })()}
    </div>
  );
}
