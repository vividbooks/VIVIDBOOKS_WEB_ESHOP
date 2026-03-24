/** Položka „Často kladené dotazy“ na stránce předmětu + RAG. */
export type SubjectFaqItem = { question: string; answer: string };

export interface SubjectPageData {
  id: string;
  slug: string;
  displayName: string;
  tagline: string;
  heroColor: string;
  heroColorDark: string;
  accentColor: string;
  grades: string[];
  stats: { value: string; label: string }[];
  features: { title: string; desc: string; color: string; visualKey: string }[];
  topics: { grade: string; items: { label: string; color: string; emoji: string }[] }[];
  rvpNote: string;
  dolozka?: string;
  /**
   * Jeden blok pro web operátora: nadpis + prázdný řádek + text po rozkliknutí.
   * Má přednost před authorIntroHeading / authorIntroBody.
   */
  heroText?: string;
  /** Nadpis pod názvem předmětu (hero), např. úvod autora */
  authorIntroHeading?: string;
  /** Text úvodu (plain) */
  authorIntroBody?: string;
  /** Často kladené dotazy (admin, web, indexace do RAG). */
  faqs?: SubjectFaqItem[];
  isActive: boolean;
  order: number;
}

const FAQ_TRIAL =
  'Ano — na str\u00e1nce \u201eVyzkou\u0161ejte zdarma\u201c si m\u016f\u017eete z\u0159\u00eddit 14denn\u00ed p\u0159\u00edstup k digit\u00e1ln\u00edm uk\u00e1zk\u00e1m bez z\u00e1vazku.';
const FAQ_ORDER =
  'V menu zvolte \u201eObjednat pro \u0161kolu\u201c nebo n\u00e1s kontaktujte na hello@vividbooks.com nebo +420\u00a0602\u00a0227\u00a0674 \u2014 p\u0159iprav\u00edme nab\u00eddku podle ro\u010dn\u00edk\u016f a po\u010dtu \u017e\u00e1k\u016f.';
const FAQ_RVP =
  'Ano. Materi\u00e1ly Vividbooks jsou p\u0159ipravov\u00e1ny v souladu s RVP Z\u0160; u vybran\u00fdch ti\u0161t\u011bn\u00fdch se\u0161it\u016f uv\u00e1d\u00edme dolo\u017eku M\u0160MT, kde plat\u00ed.';

/** Spole\u010dn\u00e9 z\u00e1v\u011br\u010dn\u00e9 ot\u00e1zky + specifick\u00e9 pro p\u0159edm\u011bt (naho\u0159e). */
function subjectFaqs(slug: string, displayName: string, specific: SubjectFaqItem[]): SubjectFaqItem[] {
  const url = `https://www.vividbooks.com/predmet/${slug}`;
  return [
    ...specific,
    {
      question: `Je obsah ${displayName} v souladu s RVP?`,
      answer: FAQ_RVP,
    },
    {
      question: 'M\u016f\u017eeme si digit\u00e1ln\u00ed v\u00fcku vyzkou\u0161et?',
      answer: FAQ_TRIAL,
    },
    {
      question: 'Jak objedn\u00e1me materi\u00e1ly pro \u0161kolu?',
      answer: FAQ_ORDER,
    },
    {
      question: `Kde najdu p\u0159ehled titul\u016f z ${displayName}?`,
      answer: `Na str\u00e1nce p\u0159edm\u011btu ${url} jsou v\u0161echny dostupn\u00e9 se\u0161ity a digit\u00e1ln\u00ed licence, kter\u00e9 k dan\u00e9mu p\u0159edm\u011btu nab\u00edz\u00edme.`,
    },
  ];
}

export const SUBJECT_PAGES: SubjectPageData[] = [
  {
    id: 'subj-matematika',
    slug: 'matematika',
    displayName: 'Matematika',
    tagline: 'Od z\u00e1klad\u016f po funkce \u2014 interaktivn\u011b, srozumiteln\u011b, modern\u011b.',
    heroColor: '#e8f0fb',
    heroColorDark: '#b8d4f5',
    accentColor: '#4a7fd4',
    grades: ['2. stupe\u0148', '1. stupe\u0148'],
    stats: [
      { value: '30+', label: 'se\u0161it\u016f a u\u010debnic' },
      { value: '6', label: 'ro\u010dn\u00edk\u016f' },
      { value: '1200+', label: 'interaktivn\u00edch aktivit' },
      { value: 'M\u0160MT', label: 'd\u016fle\u017eka schv\u00e1len\u00ed' },
    ],
    features: [
      { title: 'Interaktivn\u00ed r\u00fdsov\u00e1n\u00ed', desc: 'Kru\u017enice, \u00fahel, t\u011b\u017enice \u2014 v\u0161e p\u0159\u00edmo na dotykov\u00e9 obrazovce s digit\u00e1ln\u00edm kru\u017e\u00edtkem a prav\u00edtkem.', color: 'bg-[#b8d4f5]', visualKey: 'geom' },
      { title: 'Animovan\u00e9 postupy', desc: 'Ka\u017ed\u00fd krok v\u00fdpo\u010dtu rozlo\u017een\u00fd krok za krokem s vizu\u00e1ln\u00ed animac\u00ed.', color: 'bg-[#f9c97c]', visualKey: 'algebra' },
      { title: 'Statistika \u017eiv\u011b', desc: 'Grafy, tabulky a diagramy, kter\u00e9 \u017e\u00e1ci sami sestavuj\u00ed a okam\u017eit\u011b vid\u00ed v\u00fdsledky.', color: 'bg-[#c9e6c8]', visualKey: 'stats' },
      { title: 'Prostorov\u00e1 geometrie', desc: '3D t\u011blesa, kter\u00e1 lze ot\u00e1\u010det a prozkoumat ze v\u0161ech stran.', color: 'bg-[#e8d5f5]', visualKey: '3d' },
      { title: 'Okam\u017eit\u00e1 zp\u011btn\u00e1 vazba', desc: 'V\u00edce pokus\u016f, \u017e\u00e1dn\u00fd stres \u2014 chyba je sou\u010d\u00e1st\u00ed u\u010den\u00ed.', color: 'bg-[#fde8d0]', visualKey: 'feedback' },
      { title: 'Podle RVP 2025', desc: 'Pln\u011b slad\u011bn\u00fd s nov\u00fdm r\u00e1mcov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visualKey: 'rvp' },
    ],
    topics: [
      { grade: '2. stupe\u0148', items: [
        { label: 'P\u0159irozen\u00e1 \u010d\u00edsla', color: '#b8d4f5', emoji: '\uD83D\uDD22' },
        { label: 'Cel\u00e1 \u010d\u00edsla', color: '#c9e6c8', emoji: '\u2795' },
        { label: 'Zlomky', color: '#f9c97c', emoji: '\u00BD' },
        { label: 'Desetinn\u00e1 \u010d\u00edsla', color: '#fde8d0', emoji: '\uD83D\uDCCD' },
        { label: 'Procenta a pom\u011bry', color: '#e8d5f5', emoji: '%' },
        { label: 'Mocniny a odmocniny', color: '#d0eef5', emoji: '\u00B2 \u221A' },
        { label: 'Rovnice', color: '#f9c97c', emoji: '\u2696\uFE0F' },
        { label: 'Nerovnice', color: '#b8d4f5', emoji: '\u2260' },
        { label: 'Funkce a grafy', color: '#c9e6c8', emoji: '\uD83D\uDCC8' },
        { label: 'Rovinn\u00e1 geometrie', color: '#e8d5f5', emoji: '\uD83D\uDCD0' },
        { label: 'Prostorov\u00e1 geometrie', color: '#fde8d0', emoji: '\uD83E\uDDE0' },
        { label: 'Statistika', color: '#d0eef5', emoji: '\uD83D\uDCCA' },
        { label: 'Kombinatorika', color: '#f9c97c', emoji: '\uD83C\uDFB2' },
      ]},
      { grade: '1. stupe\u0148', items: [
        { label: '\u010c\u00edsla do 1\u00a0000\u00a0000', color: '#b8d4f5', emoji: '\uD83D\uDD22' },
        { label: 'S\u010d\u00edt\u00e1n\u00ed a od\u010d\u00edt\u00e1n\u00ed', color: '#c9e6c8', emoji: '\u2795' },
        { label: 'N\u00e1soben\u00ed a d\u011blen\u00ed', color: '#f9c97c', emoji: '\u00D7' },
        { label: 'Geometrick\u00e9 tvary', color: '#e8d5f5', emoji: '\uD83D\uDCD0' },
        { label: 'M\u011b\u0159en\u00ed a jednotky', color: '#fde8d0', emoji: '\uD83D\uDCCF' },
        { label: 'Slovn\u00ed \u00falohy', color: '#d0eef5', emoji: '\uD83D\uDCAC' },
        { label: 'Grafy a tabulky', color: '#c9e6c8', emoji: '\uD83D\uDCCA' },
        { label: 'Zlomky', color: '#f9c97c', emoji: '\u00BD' },
      ]},
    ],
    rvpNote: 'Se\u0161ity Matematika jsou pln\u011b v souladu s nov\u00fdm RVP 2025 a zahrnuj\u00ed v\u0161echna nov\u00e1 pr\u016f\u0159ezov\u00e1 t\u00e9mata.',
    dolozka: 'M\u0160MT \u010c.j. 22903/2018-2 \u2014 Dolo\u017eka schv\u00e1len\u00ed pro Z\u0160',
    faqs: subjectFaqs('matematika', 'Matematika', [
      {
        question: '\u010c\u00edm se li\u0161\u00ed \u0159ada \u201eKrok za krokem\u201c od \u201ePro v\u0161echny\u201c?',
        answer:
          '\u201eKrok za krokem\u201c je ur\u010dena \u017e\u00e1k\u016fm, kte\u0159\u00ed pot\u0159ebuj\u00ed jemn\u011bj\u0161\u00ed tempo a v\u00edce vod\u011bt. \u201ePro v\u0161echny\u201c pokr\u00fdv\u00e1 standardn\u00ed tempo v\u00fdkladu a procvi\u010dov\u00e1n\u00ed pro b\u011b\u017enou t\u0159\u00eddu. Ob\u011b \u0159ady jsou dostupn\u00e9 jako ti\u0161t\u011bn\u00e9 se\u0161ity i s digit\u00e1ln\u00edmi materi\u00e1ly.',
      },
      {
        question: 'Pro kter\u00e9 ro\u010dn\u00edky je matematika u Vividbooks?',
        answer:
          'Nab\u00edz\u00edme materi\u00e1ly pro 1. i 2. stupe\u0148 Z\u0160 \u2014 od prvn\u00edho ro\u010dn\u00edku a\u017e po dev\u00e1t\u00fd. Konkr\u00e9tn\u00ed ro\u010dn\u00edky a \u0159ady vid\u00edte na str\u00e1nce p\u0159edm\u011btu a v katalogu produkt\u016f.',
      },
      {
        question: 'Obsahuje digit\u00e1ln\u00ed matematika interaktivn\u00ed r\u00fdsov\u00e1n\u00ed a 3D geometrii?',
        answer:
          'Ano. Digit\u00e1ln\u00ed u\u010debnice zahrnuj\u00ed mimo jin\u00e9 r\u00fdsov\u00e1n\u00ed na obrazovce, animovan\u00e9 postupy v\u00fdpo\u010dt\u016f a prostorovou geometrii s ot\u00e1\u010deteln\u00fdmi modely.',
      },
    ]),
    isActive: true,
    order: 1,
  },
  {
    id: 'subj-fyzika',
    slug: 'fyzika',
    displayName: 'Fyzika',
    tagline: 'Experimenty, grafy a re\u00e1ln\u00e9 jevy \u2014 fyzika, kter\u00e1 d\u00e1v\u00e1 smysl.',
    heroColor: '#fff8e8',
    heroColorDark: '#f9c97c',
    accentColor: '#e08000',
    grades: ['2. stupe\u0148'],
    stats: [
      { value: '12+', label: 'se\u0161it\u016f' },
      { value: '4', label: 'ro\u010dn\u00edky' },
      { value: '500+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'Virtu\u00e1ln\u00ed experimenty', desc: 'Pokusy, kter\u00e9 nelze ud\u011blat ve t\u0159\u00edd\u011b \u2014 digit\u00e1ln\u011b a bezpe\u010dn\u011b.', color: 'bg-[#f9c97c]', visualKey: 'geom' },
      { title: 'Dynamick\u00e9 grafy', desc: 'Pohyb, s\u00edla, energie \u2014 \u017eiv\u011b zobrazeno na interaktivn\u00edch grafech.', color: 'bg-[#b8d4f5]', visualKey: 'stats' },
      { title: 'Okam\u017eit\u00e1 zp\u011btn\u00e1 vazba', desc: 'Testov\u00e1n\u00ed pochopen\u00ed s okam\u017eit\u00fdm vyhodnocen\u00edm.', color: 'bg-[#c9e6c8]', visualKey: 'feedback' },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visualKey: 'rvp' },
    ],
    topics: [
      { grade: '2. stupe\u0148', items: [
        { label: 'Mechanika', color: '#b8d4f5', emoji: '\u2699\uFE0F' },
        { label: 'Termika', color: '#f9c97c', emoji: '\uD83C\uDF21\uFE0F' },
        { label: 'Optika', color: '#c9e6c8', emoji: '\uD83D\uDD2D' },
        { label: 'Elekt\u0159ina', color: '#e8d5f5', emoji: '\u26A1' },
        { label: 'Magnetismus', color: '#fde8d0', emoji: '\uD83E\uDDF2' },
        { label: 'Zvuk a vln\u011bn\u00ed', color: '#d0eef5', emoji: '\uD83D\uDD0A' },
        { label: 'Astrofyzika', color: '#f9c97c', emoji: '\uD83C\uDF0C' },
      ]},
    ],
    rvpNote: 'Fyzika se\u0161ity respektuj\u00ed nov\u00fd RVP a propojuj\u00ed teorii s re\u00e1ln\u00fdmi aplikacemi.',
    faqs: subjectFaqs('fyzika', 'Fyzika', [
      {
        question: 'Jsou ve fyzice u Vividbooks virtu\u00e1ln\u00ed experimenty a simulace?',
        answer:
          'Ano. \u017e\u00e1ci pracuj\u00ed s interaktivn\u00edmi experimenty a grafy, kter\u00e9 dopl\u0148uj\u00ed l\u00e1tku z ti\u0161t\u011bn\u00fdch se\u0161it\u016f \u2014 bezpe\u010dn\u011b a opakovateln\u011b.',
      },
      {
        question: 'Pro kter\u00fd stupe\u0148 je fyzika ur\u010dena?',
        answer: 'Materi\u00e1ly jsou prim\u00e1rn\u011b pro 2. stupe\u0148 Z\u0160 (ni\u017e\u0161\u00ed a vy\u0161\u0161\u00ed ro\u010dn\u00edky podle nab\u00eddky v katalogu).',
      },
      {
        question: 'Jak fyzika souvis\u00ed s p\u0159\u00edpravou na testy a zkou\u0161en\u00ed?',
        answer:
          'Sou\u010d\u00e1st\u00ed jsou \u00fakoly s okam\u017eitou zp\u011btnou vazbou, kter\u00e9 pom\u00e1haj\u00ed ov\u011b\u0159it pochopen\u00ed pojm\u016f a souvislost\u00ed.',
      },
    ]),
    isActive: true,
    order: 2,
  },
  {
    id: 'subj-prirodopis',
    slug: 'prirodopis',
    displayName: 'P\u0159\u00edrodopis',
    tagline: '\u017divotn\u00ed prost\u0159ed\u00ed, evoluce a \u010dlov\u011bk \u2014 interaktivn\u011b.',
    heroColor: '#edf7ed',
    heroColorDark: '#c9e6c8',
    accentColor: '#2e7d32',
    grades: ['2. stupe\u0148'],
    stats: [
      { value: '10+', label: 'se\u0161it\u016f' },
      { value: '4', label: 'ro\u010dn\u00edky' },
      { value: '600+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'Interaktivn\u00ed atlasy', desc: 'Rostliny, \u017eivo\u010dich\u00e9, miner\u00e1ly \u2014 p\u0159\u00edmo v se\u0161it\u011b s rozpozn\u00e1v\u00e1n\u00edm.', color: 'bg-[#c9e6c8]', visualKey: 'geom' },
      { title: 'Videa a animace', desc: 'Biologick\u00e9 procesy vid\u011bt na\u017eivo \u2014 bun\u011b\u010dn\u00e9 d\u011blen\u00ed, fotosynteza, ekosyst\u00e9my.', color: 'bg-[#b8d4f5]', visualKey: 'stats' },
      { title: 'Zp\u011btn\u00e1 vazba', desc: 'Testy a kv\u00edzy s okam\u017eit\u00fdm vyhodnocen\u00edm.', color: 'bg-[#fde8d0]', visualKey: 'feedback' },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visualKey: 'rvp' },
    ],
    topics: [
      { grade: '2. stupe\u0148', items: [
        { label: 'Biologie bu\u0148ky', color: '#c9e6c8', emoji: '\uD83D\uDD2C' },
        { label: 'Botanika', color: '#b8d4f5', emoji: '\uD83C\uDF3F' },
        { label: 'Zoologie', color: '#f9c97c', emoji: '\uD83E\uDD81' },
        { label: 'Ekologie', color: '#e8d5f5', emoji: '\uD83C\uDF0D' },
        { label: 'Geologie', color: '#fde8d0', emoji: '\uD83E\uDEA8' },
        { label: '\u010clov\u011bk', color: '#d0eef5', emoji: '\uD83E\uDDEC' },
      ]},
    ],
    rvpNote: 'P\u0159\u00edrodopis se\u0161ity jsou v souladu s RVP 2025 a rozv\u00edj\u00ed ekologick\u00e9 my\u0161len\u00ed.',
    authorIntroHeading: '\u2013 \u010c\u00edm je p\u0159\u00edrodopis jin\u00fd? \u00davodn\u00ed slovo autora',
    authorIntroBody:
      'P\u0159\u00edrodopis ve Vividbooks propojuje biologii, ekologii a geologii v jeden srozumiteln\u00fd p\u0159\u00edb\u011bh. Klademe d\u016fraz na souvislosti v p\u0159\u00edrod\u011b a praktickou aplikaci v \u0161kole \u2014 bez zbyte\u010dn\u00e9 encyklopedi\u010dnosti. Tento text si uprav\u00edte v administraci v kolekci P\u0159edm\u011bty.',
    faqs: subjectFaqs('prirodopis', 'P\u0159\u00edrodopis', [
      {
        question: 'Co znamenaj\u00ed \u201e3D modely\u201c a badatelsk\u00e9 listy u p\u0159\u00edrodopisu?',
        answer:
          '\u017d\u00e1ci pracuj\u00ed s interaktivn\u00edmi modely organism\u016f a jev\u016f a s listy, kter\u00e9 vedou k pozorov\u00e1n\u00ed, hypot\u00e9ze a z\u00e1v\u011bru \u2014 v duchu badatelsky orientovan\u00e9 v\u00fdky.',
      },
      {
        question: 'Je p\u0159\u00edrodopis vhodn\u00fd pro kombinaci ti\u0161t\u011bn\u00e9ho se\u0161itu a tabule?',
        answer:
          'Ano. Ti\u0161t\u011bn\u00fd se\u0161it dopl\u0148ujeme digit\u00e1ln\u00edmi aktivitami vhodn\u00fdmi pro interaktivn\u00ed tabuli nebo samostatnou pr\u00e1ci \u017e\u00e1k\u016f.',
      },
      {
        question: 'Pokr\u00fdv\u00e1 p\u0159\u00edrodopis ekologii a geologii?',
        answer: 'Ano. T\u00e9mata zahrnuj\u00ed biologii, ekologii i z\u00e1klady geologie v propojen\u00fdch kapitol\u00e1ch.',
      },
    ]),
    isActive: true,
    order: 3,
  },
  {
    id: 'subj-chemie',
    slug: 'chemie',
    displayName: 'Chemie',
    tagline: 'Atomy, reakce a pokusy \u2014 chemie, kter\u00e1 ohromuje.',
    heroColor: '#f3edf7',
    heroColorDark: '#e8d5f5',
    accentColor: '#7b2d8b',
    grades: ['2. stupe\u0148'],
    stats: [
      { value: '8+', label: 'se\u0161it\u016f' },
      { value: '3', label: 'ro\u010dn\u00edky' },
      { value: '400+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'Virtu\u00e1ln\u00ed laborato\u0159', desc: 'Bezpe\u010dn\u00e9 chemick\u00e9 pokusy v digit\u00e1ln\u00edm prost\u0159ed\u00ed.', color: 'bg-[#e8d5f5]', visualKey: 'geom' },
      { title: '3D molekuly', desc: 'Prostorov\u00e9 modely molekul, kter\u00e9 \u017e\u00e1ci mohou ot\u00e1\u010det.', color: 'bg-[#b8d4f5]', visualKey: '3d' },
      { title: 'Zp\u011btn\u00e1 vazba', desc: 'Testov\u00e1n\u00ed s okam\u017eit\u00fdm vyhodnocen\u00edm.', color: 'bg-[#c9e6c8]', visualKey: 'feedback' },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visualKey: 'rvp' },
    ],
    topics: [
      { grade: '2. stupe\u0148', items: [
        { label: '\u010cist\u00e9 l\u00e1tky a sm\u011bsi', color: '#e8d5f5', emoji: '\uD83E\uDDEA' },
        { label: 'Atomy a prvky', color: '#b8d4f5', emoji: '\u269B\uFE0F' },
        { label: 'Chemick\u00e9 reakce', color: '#f9c97c', emoji: '\uD83D\uDCA5' },
        { label: 'Anorganick\u00e1 chemie', color: '#c9e6c8', emoji: '\uD83D\uDD29' },
        { label: 'Organick\u00e1 chemie', color: '#fde8d0', emoji: '\uD83C\uDF3F' },
        { label: 'Biochemie', color: '#d0eef5', emoji: '\uD83E\uDDEC' },
      ]},
    ],
    rvpNote: 'Chemie se\u0161ity propojuj\u00ed teorii s ka\u017edodenn\u00edm \u017eivotem a bezpe\u010dnost\u00ed.',
    faqs: subjectFaqs('chemie', 'Chemie', [
      {
        question: 'Jak prob\u00edhaj\u00ed \u201evirtu\u00e1ln\u00ed pokusy\u201c v chemii?',
        answer:
          '\u017d\u00e1ci spou\u0161t\u011bj\u00ed simulace reakc\u00ed a pozoruj\u00ed jevy na obrazovce bez rizika a bez spot\u0159eby chemik\u00e1li\u00ed \u2014 jako dopln\u011bk k l\u00e1tce v se\u0161itu.',
      },
      {
        question: 'Jsou v nab\u00eddce 3D modely molekul?',
        answer: 'Ano. Prostorov\u00e9 modely molekul \u017e\u00e1ci ot\u00e1\u010dej\u00ed a zkoumaj\u00ed z r\u016fzn\u00fdch \u00fahl\u016f, co\u017e pom\u00e1h\u00e1 pochopit strukturu l\u00e1tek.',
      },
      {
        question: 'Pro kter\u00e9 ro\u010dn\u00edky je chemie?',
        answer: 'Materi\u00e1ly c\u00edl\u00edme na 2. stupe\u0148 Z\u0160; konkr\u00e9tn\u00ed ro\u010dn\u00edky najdete u jednotliv\u00fdch titul\u016f v katalogu.',
      },
    ]),
    isActive: true,
    order: 4,
  },
  {
    id: 'subj-prvouka',
    slug: 'prvouka',
    displayName: 'Prvouka',
    tagline: 'Sv\u011bt kolem n\u00e1s \u2014 zv\u00edda\u010dka pro nejmen\u0161\u00ed.',
    heroColor: '#fff3e0',
    heroColorDark: '#fde8d0',
    accentColor: '#e65100',
    grades: ['1. stupe\u0148'],
    stats: [
      { value: '8+', label: 'se\u0161it\u016f' },
      { value: '3', label: 'ro\u010dn\u00edky' },
      { value: '700+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'P\u0159\u00edroda kolem n\u00e1s', desc: 'Ro\u010dn\u00ed obdob\u00ed, zv\u00ed\u0159ata, rostliny \u2014 v\u0161e interaktivn\u011b.', color: 'bg-[#fde8d0]', visualKey: 'geom' },
      { title: '\u010clov\u011bk a spole\u010dnost', desc: 'Rodina, \u0161kola, obec \u2014 v\u00fdchova k ob\u010danstv\u00ed od prvn\u00ed t\u0159\u00eddy.', color: 'bg-[#c9e6c8]', visualKey: 'feedback' },
      { title: 'Zp\u011btn\u00e1 vazba', desc: 'Hern\u00ed aktivity s okam\u017eit\u00fdm vyhodnocen\u00edm.', color: 'bg-[#b8d4f5]', visualKey: 'algebra' },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visualKey: 'rvp' },
    ],
    topics: [
      { grade: '1. stupe\u0148', items: [
        { label: 'Ro\u010dn\u00ed obdob\u00ed', color: '#c9e6c8', emoji: '\uD83C\uDF42' },
        { label: 'Zv\u00ed\u0159ata', color: '#fde8d0', emoji: '\uD83D\uDC3E' },
        { label: 'Rostliny', color: '#b8d4f5', emoji: '\uD83C\uDF31' },
        { label: 'Rodina a dom\u00e1cnost', color: '#f9c97c', emoji: '\uD83C\uDFE1' },
        { label: 'Obec a m\u011bsto', color: '#e8d5f5', emoji: '\uD83C\uDFD9\uFE0F' },
        { label: 'Lidsk\u00e9 t\u011blo', color: '#d0eef5', emoji: '\uD83E\uDDD4' },
        { label: 'Bezpe\u010dnost', color: '#fde8d0', emoji: '\uD83D\uDEE1\uFE0F' },
      ]},
    ],
    rvpNote: 'Prvouka se\u0161ity jsou navr\u017eeny pro hrav\u00e9 u\u010den\u00ed v 1.\u20133. ro\u010dn\u00edku.',
    faqs: subjectFaqs('prvouka', 'Prvouka', [
      {
        question: 'Je prvouka vhodn\u00e1 pro 1. stupe\u0148?',
        answer:
          'Ano. Materi\u00e1ly jsou tvo\u0159eny pro \u017e\u00e1ky 1. stupn\u011b s d\u016frazem na hravost, kr\u00e1tk\u00e9 aktivity a srozumiteln\u00fd jazyk.',
      },
      {
        question: 'Co v prvouce najdu krom\u011b p\u0159\u00edrody?',
        answer:
          'Zahrnujeme t\u00e9mata \u010dlov\u011bka ve spole\u010dnosti, bezpe\u010dnosti a orientace v okol\u016f \u0161koly a obce.',
      },
      {
        question: 'Maj\u00ed se\u0161ity okam\u017eitou zp\u011btnou vazbu?',
        answer: 'Digit\u00e1ln\u00ed \u010d\u00e1sti obsahuj\u00ed interaktivn\u00ed \u00fakoly s okam\u017eit\u00fdm vyhodnocen\u00edm, kter\u00e9 podporuj\u00ed motivaci nejmlad\u0161\u00edch \u017e\u00e1k\u016f.',
      },
    ]),
    isActive: true,
    order: 5,
  },
  {
    id: 'subj-cesky-jazyk',
    slug: 'cesky-jazyk',
    displayName: '\u010cesk\u00fd jazyk',
    tagline: 'Psan\u00ed, \u010dten\u00ed a mluvnice \u2014 s radost\u00ed a bez strachu.',
    heroColor: '#fef9e8',
    heroColorDark: '#fff3a4',
    accentColor: '#c4a000',
    grades: ['1. stupe\u0148'],
    stats: [
      { value: '10+', label: 'se\u0161it\u016f' },
      { value: '5', label: 'ro\u010dn\u00edk\u016f' },
      { value: '800+', label: 'aktivit' },
      { value: 'M\u0160MT', label: 'd\u016flo\u017eka' },
    ],
    features: [
      { title: 'Interaktivn\u00ed dikt\u00e1ty', desc: 'Psan\u00ed s okam\u017eit\u00fdm vyhodnocen\u00edm a n\u00e1pov\u011bdou.', color: 'bg-[#fff3a4]', visualKey: 'algebra' },
      { title: '\u010cten\u00ed s porozum\u011bn\u00edm', desc: 'Texty s vestav\u011bn\u00fdmi cvi\u010den\u00edmi a animovan\u00fdmi ilustracemi.', color: 'bg-[#b8d4f5]', visualKey: 'feedback' },
      { title: 'Mluvnice p\u0159\u00edstupn\u011b', desc: 'Gramatika vysv\u011btlen\u00e1 jednoduche, s mno\u017estv\u00edm p\u0159\u00edklad\u016f.', color: 'bg-[#c9e6c8]', visualKey: 'geom' },
      { title: 'Podle RVP 2025', desc: 'Soulad s nov\u00fdm vzd\u011bl\u00e1vac\u00edm programem.', color: 'bg-[#d0eef5]', visualKey: 'rvp' },
    ],
    topics: [
      { grade: '1. stupe\u0148', items: [
        { label: 'Abeceda a h\u00e1\u010dky', color: '#fff3a4', emoji: '\uD83D\uDD24' },
        { label: 'Psan\u00ed a dikt\u00e1ty', color: '#b8d4f5', emoji: '\u270F\uFE0F' },
        { label: '\u010cten\u00ed', color: '#c9e6c8', emoji: '\uD83D\uDCD6' },
        { label: 'Slovn\u00ed druhy', color: '#fde8d0', emoji: '\uD83C\uDFF7\uFE0F' },
        { label: 'V\u011bty', color: '#e8d5f5', emoji: '\uD83D\uDCAC' },
        { label: 'Pravopis', color: '#d0eef5', emoji: '\u2705' },
        { label: 'Literatura', color: '#f9c97c', emoji: '\uD83D\uDCDA' },
      ]},
    ],
    rvpNote: '\u010cesk\u00fd jazyk se\u0161ity rozv\u00edj\u00ed \u010dten\u00e1\u0159skou gramotnost od 1. ro\u010dn\u00edku.',
    faqs: subjectFaqs('cesky-jazyk', '\u010cesk\u00fd jazyk', [
      {
        question: 'Jak \u010desk\u00fd jazyk podporuje psan\u00ed a \u010dten\u00ed?',
        answer:
          'V digit\u00e1ln\u00ed podob\u011b najdete interaktivn\u00ed dikt\u00e1ty, cvi\u010den\u00ed k text\u016fm a srozumiteln\u011b vysv\u011btlenou mluvnici s okam\u017eitou zp\u011btnou vazbou.',
      },
      {
        question: 'Od kter\u00e9ho ro\u010dn\u00edku materi\u00e1ly za\u010d\u00ednaj\u00ed?',
        answer: 'Nab\u00edz\u00edme p\u00edsanky a pracovn\u00ed se\u0161ity od 1. ro\u010dn\u00edku v\u010detn\u011b pokra\u010dov\u00e1n\u00ed pro vy\u0161\u0161\u00ed ro\u010dn\u00edky 1. stupn\u011b.',
      },
      {
        question: 'Je vhodn\u00fd \u010desk\u00fd jazyk pro diferenciaci v t\u0159\u00edd\u011b?',
        answer:
          'Ano. Kombinace ti\u0161t\u011bn\u00fdch se\u0161it\u016f a digit\u00e1ln\u00edch aktivit umo\u017e\u0148uje u\u010ditel\u016fm p\u0159izp\u016fsobit tempo a obt\u00ed\u017enost.',
      },
    ]),
    isActive: true,
    order: 6,
  },
];
